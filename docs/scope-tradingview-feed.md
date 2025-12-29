# Scope: TradingView Parallel Data Feed

## Overview

Add TradingView as a second, independent market data source for the **Day Range Meter**. Traders choose their data source when creating a display via keyboard shortcuts (Alt+A for cTrader, Alt+T for TradingView). Two parallel, non-interacting feeds keep the architecture simple and elegant.

**Core Focus:** Day Range Meter visualization using D1 (daily) candles from TradingView.

---

## Current Architecture

```mermaid
flowchart LR
    subgraph CTADER["cTrader Backend"]
        C1[CTraderSession] -->|ProtoOA| C2[Protobuf Decode]
        C2 --> C3[Tick Event]
    end

    subgraph SERVER["WebSocket Server"]
        WSS[WebSocketServer]
        C3 --> WSS
    end

    subgraph CLIENT["Frontend"]
        CM[ConnectionManager]
        DD[displayDataProcessor]
        WSS -->|WebSocket JSON| CM
        CM --> DD
        DD --> ST[workspace Store]
        ST --> FD[FloatingDisplay]
        FD --> DC[DisplayCanvas]
        DC --> DRM[Day Range Meter]
    end

    style CTADER fill:#1a5f3a
    style CLIENT fill:#1a3a5f
    style DRM fill:#3a5f1a
```

---

## Target Architecture

```mermaid
flowchart TB
    subgraph BACKEND["Backend Layer"]
        direction LR

        subgraph CTRADER["cTrader Source"]
            CS[CTraderSession]
        end

        subgraph TV["TradingView Source"]
            TVS[TradingViewSession]
            TVL[tradingview-ws lib]
            TVS --> TVL
        end

        subgraph WSS["WebSocket Server"]
            ROUTER[DataRouter]
        end

        CS -->|tick events| ROUTER
        TVS -->|D1 candle events| ROUTER
    end

    subgraph CLIENT["Client Layer"]
        CM[ConnectionManager]
        DD[displayDataProcessor]
        WS[workspace Store]
    end

    subgraph DISPLAY["Display Layer"]
        FD[FloatingDisplay]
        DC[DisplayCanvas]
        SB[SourceBadge]
        DRM[Day Range Meter]
    end

    ROUTER -->|WebSocket| CM
    CM --> DD
    DD --> WS
    WS --> FD
    FD --> DC
    DC --> DRM
    DC --> SB

    style CTRADER fill:#1a5f3a
    style TV fill:#5f3a1a
    style CLIENT fill:#1a3a5f
    style DRM fill:#3a5f1a
```

**Key Principle: Parallel, non-interacting feeds**
- cTrader feed continues working as-is
- TradingView feed is completely separate
- NO divergence detection, NO source switching, NO averaging, NO comparison logic

---

## Day Range Meter Data Requirements

The Day Range Meter requires specific data fields for proper visualization:

```mermaid
flowchart LR
    subgraph REQUIRED["Day Range Meter Requirements"]
        R1[current]
        R2[open]
        R3[high]
        R4[low]
        R5[adrHigh]
        R6[adrLow]
    end

    subgraph CTRADER["cTrader Provides"]
        C1[current✓]
        C2[open✓]
        C3[high✓]
        C4[low✓]
        C5[adrHigh✓]
        C6[adrLow✓]
    end

    subgraph TV["TradingView D1 Candle"]
        T1[close→current✓]
        T2[open✓]
        T3[high✓]
        T4[low✓]
        T5[adrHigh?]
        T6[adrLow?]
    end

    style REQUIRED fill:#1a3a5f
    style CTRADER fill:#1a5f3a
    style TV fill:#5f3a1a
```

### Critical Finding: ADR Calculation Required

TradingView D1 candles provide OHLC but **NOT** `adrHigh` and `adrLow`. These must be calculated from historical daily candles on the backend.

**ADR (Average Daily Range) Formula:**
```javascript
// From historical D1 candles (excluding today's incomplete candle)
const adr = average(high - low) for last 14 complete days
const adrHigh = today's open + (adr / 2)
const adrLow = today's open - (adr / 2)
```

---

## User Interface

### Keyboard Shortcuts

```mermaid
flowchart LR
    K1[Alt+A] --> D1[Create cTrader Display]
    K2[Alt+T] --> D2[Create TradingView Display]

    style K1 fill:#1a5f3a
    style K2 fill:#5f3a1a
```

### Visual Source Indicator

Each Day Range Meter display shows a source badge:
- **cTrader** - Green badge (existing behavior)
- **TradingView** - Orange badge (new)

```mermaid
flowchart LR
    D[Day Range Meter] --> B[Source Badge]
    B --> |cTrader| G["🟢 cTrader"]
    B --> |TradingView| O["🟠 TradingView"]

    style G fill:#1a5f3a
    style O fill:#5f3a1a
```

---

## Data Flow: D1 Candle to Day Range Meter

```mermaid
flowchart LR
    subgraph TV_FEED["TradingView Feed"]
        direction TB
        T1[D1 Candle] --> T2[OHLC Extraction]
        T2 --> T3[ADR Calculation]
        T3 --> T4["{symbol, open, high, low,\nclose, adrHigh, adrLow}"]
    end

    subgraph CTRADER_FEED["cTrader Feed"]
        direction TB
        C1[ProtoOA Tick] --> C2[Price Calculation]
        C2 --> C3[ADR from M1 bars]
        C3 --> C4["{symbol, bid, ask,\nopen, high, low, adrHigh, adrLow}"]
    end

    subgraph CLIENT["Day Range Meter"]
        DRM["Renders: current price, OHLC,\nADR boundaries, % of ADR"]
    end

    T4 --> DRM
    C4 --> DRM

    style TV_FEED fill:#5f3a1a
    style CTRADER_FEED fill:#1a5f3a
    style DRM fill:#3a5f1a
```

---

## Component Changes

### 1. Backend: New Components

```mermaid
classDiagram
    class TradingViewSession {
        +connect(sessionId)
        +subscribeToSymbol(symbol)
        +getHistoricalAde(symbol, lookbackDays)
        #onCandle(data)
        -calculateAde(historicalCandles)
        -emitCandle(candle)
        +events: connected, candle, error
    }

    class DataRouter {
        +routeFromCTrader(tick)
        +routeFromTradingView(candle)
        +broadcastToClients(message)
    }

    TradingViewSession --> DataRouter
```

### 2. Backend: ADR Calculation (Critical Addition)

```mermaid
flowchart TD
    A[subscribeToSymbol] --> B[Fetch D1 candles]
    B --> C[Get 20 historical days]
    C --> D[Calculate ADR]
    D --> E[adrHigh = open + ADR/2]
    E --> F[adrLow = open - ADR/2]
    F --> G[Send symbolDataPackage]

    style D fill:#5f3a1a
```

**Implementation (~20 lines):**
```javascript
async getHistoricalAde(symbol, lookbackDays = 14) {
  const candles = await this.tvClient.getCandles({
    symbol: symbol,
    period: 'D',
    amount: lookbackDays + 5
  });

  // Exclude partial candles (first and last)
  const completeCandles = candles.slice(1, -1);
  const ranges = completeCandles.map(c => c.high - c.low);
  const adr = ranges.reduce((a, b) => a + b, 0) / ranges.length;

  const lastCandle = candles[candles.length - 1];
  return {
    adrHigh: lastCandle.open + (adr / 2),
    adrLow: lastCandle.open - (adr / 2),
    open: lastCandle.open,
    high: lastCandle.high,
    low: lastCandle.low,
    current: lastCandle.close
  };
}
```

### 3. Client: Modified Components

```mermaid
classDiagram
    class ConnectionManager {
        +subscribeToSymbol(symbol, source)
        -handleMessage(message)
    }

    class displayDataProcessor {
        +processSymbolData(data, source)
        -processTradingViewTick(data)
    }

    class FloatingDisplay {
        +source: 'ctrader' | 'tradingview'
        -renderSourceBadge()
    }

    class DisplayCanvas {
        +render(data, source)
        +renderSourceBadge(source)
    }

    ConnectionManager --> displayDataProcessor
    displayDataProcessor --> FloatingDisplay
    FloatingDisplay --> DisplayCanvas
```

---

## Data Structure Mapping

### TradingView Library Output

```typescript
// tradingview-ws returns D1 candles:
interface Candle {
    time: number      // Unix timestamp
    open: number
    high: number
    low: number
    close: number
    volume: number
}
```

### Our Message Format (Day Range Meter)

```typescript
// TradingView backend emits (with ADR calculated):
interface TradingViewDataPackage {
    type: 'symbolDataPackage'
    source: 'tradingview'
    symbol: string
    open: number
    high: number
    low: number
    current: number      // close price
    adrHigh: number      // CALCULATED from historical
    adrLow: number       // CALCULATED from historical
}

// Real-time updates:
interface TradingViewTick {
    type: 'tick'
    source: 'tradingview'
    symbol: string
    price: number        // close (current price)
    timestamp: number
}

// cTrader backend emits (unchanged):
interface CTraderTick {
    type: 'tick'
    source: 'ctrader'
    symbol: string
    bid: number
    ask: number
    timestamp: number
    pipPosition: number
    pipSize: number
}
```

---

## File Changes Map

```mermaid
mindmap
    root((TradingView<br/>Day Range Feed))
        backend_new
            TradingViewSession.js
                "Wrap tradingview-ws"
                "~80 lines"
                "Includes ADR calculation"
            DataRouter.js
                "Route separate feeds"
                "~30 lines"
                "No aggregation logic"
        backend_modify
            WebSocketServer.js
                "+5 lines"
                "Add router init"
            server.js
                "+3 lines"
                "Init TV session"
            package.json
                "+1 dependency"
                "tradingview-ws"
        client_modify
            keyboardHandler.js
                "+8 lines"
                "Add Alt+T handler"
            displayDataProcessor.js
                "+15 lines"
                "Handle TV data format"
            FloatingDisplay.svelte
                "+5 lines"
                "Show source badge"
            DisplayCanvas.svelte
                "+3 lines"
                "Render source badge"
            workspace.js
                "+2 lines"
                "Store source with display"
```

**Total Impact: ~150 lines** (adhering to Crystal Clarity simplicity)

---

## Implementation Sequence

```mermaid
flowchart TD
    A[Phase 1: Backend] --> B[Phase 2: Client]
    B --> C[Phase 3: Testing]

    subgraph P1["Phase 1: Backend (Lines 1-110)"]
        direction TB
        P1A[Install tradingview-ws] --> P1B[Create TradingViewSession.js]
        P1B --> P1C[Implement ADR calculation]
        P1C --> P1D[Create DataRouter.js]
        P1D --> P1E[Integrate with server.js]
    end

    subgraph P2["Phase 2: Client (Lines 111-150)"]
        direction TB
        P2A[Add Alt+T to keyboardHandler] --> P2B[Update displayDataProcessor]
        P2B --> P2C[Add source badge to FloatingDisplay]
        P2C --> P2D[Update DisplayCanvas for badge]
        P2D --> P2E[Store source in workspace]
    end

    subgraph P3["Phase 3: Day Range Testing"]
        direction TB
        P3A[Create cTrader display] --> P3B[Verify Day Range Meter works]
        P3B --> P3C[Create TradingView display]
        P3C --> P3D[Verify ADR displays correctly]
        P3D --> P3E[Verify badges show correctly]
        P3E --> P3F[Verify no cross-talk]
    end

    style P1 fill:#1a5f3a
    style P2 fill:#1a3a5f
    style P3 fill:#3a5f1a
```

---

## API Contract Changes

### WebSocket Message Format

```mermaid
flowchart LR
    subgraph CTRADER["cTrader (Unchanged)"]
        C1["{type: 'tick', symbol, bid, ask, ...}"]
    end

    subgraph TV["TradingView (New)"]
        T1["{type: 'tick', source: 'tradingview', symbol, price, ...}"]
        T2["{type: 'symbolDataPackage', source: 'tradingview', symbol, open, high, low, current, adrHigh, adrLow}"]
    end

    subgraph REQUEST["Subscribe Request"]
        R1["{action: 'subscribe', symbol, source: 'ctrader' | 'tradingview'}"]
    end

    R1 --> C1
    R1 --> T1
    R1 --> T2

    style CTRADER fill:#1a5f3a
    style TV fill:#5f3a1a
```

---

## Key Integration Points

### TradingView Session Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Disconnected
    Disconnected --> Connecting: connect(sessionId)
    Connecting --> Connected: auth success
    Connecting --> Failed: auth error
    Connected --> FetchingHistory: subscribeToSymbol(symbol)
    FetchingHistory --> Subscribing: ADR calculated
    Subscribing --> Streaming: first candle with ADR
    Streaming --> Streaming: candle updates (close price)
    Streaming --> Disconnected: disconnect()
    Failed --> [*]
```

### Display Creation Flow

```mermaid
flowchart TD
    A[User presses shortcut] --> B{Which key?}
    B -->|Alt+A| C[Create cTrader Day Range display]
    B -->|Alt+T| D[Create TradingView Day Range display]
    C --> E[Subscribe with source='ctrader']
    D --> F[Subscribe with source='tradingview']
    E --> G[Fetch D1 candles + calculate ADR]
    F --> G
    G --> H[Send symbolDataPackage with ADR]
    H --> I[Day Range Meter renders]
    I --> J[Display shows source badge]

    style C fill:#1a5f3a
    style D fill:#5f3a1a
    style J fill:#3a5f1a
```

---

## Complexity Assessment Summary

| Aspect | Lines | Complexity | Rationale |
|--------|-------|------------|-----------|
| Backend new files | ~110 | Low | Framework-first, includes ADR calc |
| Backend modifications | ~8 | Trivial | Add router init |
| Client modifications | ~30 | Low | Keyboard + badge + data handling |
| **Total** | **~150** | **Low** | Parallel feeds, focused on Day Range |

**Crystal Clarity Compliance:**
- Files <120 lines: ✓ (TradingViewSession ~80, DataRouter ~30)
- Functions <15 lines: ✓ (All focused, single-responsibility)
- Framework-first: ✓ (Native WebSocket, tradingview-ws library)
- No abstractions: ✓ (Direct library usage, minimal routing)
- Simple over features: ✓ (Day Range focus only, no bloat)

---

## Success Criteria

- [ ] Alt+A creates cTrader Day Range display (green badge)
- [ ] Alt+T creates TradingView Day Range display (orange badge)
- [ ] Day Range Meter displays correctly with TradingView data
- [ ] ADR (adrHigh/adrLow) calculated and shown accurately
- [ ] Source badge visible on each display
- [ ] Each display receives data from its source only
- [ ] No cross-talk or mixing of data sources
- [ ] Performance unchanged (<2% overhead)
- [ ] All existing cTrader functionality unchanged
- [ ] Code passes all linters (zero violations)

---

## What We Are NOT Doing

**Explicitly excluded to maintain simplicity:**

- ❌ Divergence detection between sources
- ❌ Source switching or fallback
- ❌ Price averaging or comparison
- ❌ DataAggregator component
- ❌ DivergenceDetector component
- ❌ Normalization layer
- ❌ Source preference UI (per-display toggle)
- ❌ Market Profile from TradingView (Day Range only for POC)

**Philosophy**: The trader chooses their source when creating the Day Range display. Simple and elegant.

---

## References

- [tradingview-ws Documentation](https://github.com/endenwer/tradingview-ws)
- [Crystal Clarity Principles](/workspaces/neurosensefx/CLAUDE.md)
- [Day Range Meter Implementation](/workspaces/neurosensefx/src/lib/dayRangeOrchestrator.js)
- [Day Range Data Requirements](/workspaces/neurosensefx/src/lib/dayRangeRenderingUtils.js)
- [CTraderSession Reference](/workspaces/neurosensefx/services/tick-backend/CTraderSession.js)
- [WebSocketServer Reference](/workspaces/neurosensefx/services/tick-backend/WebSocketServer.js)
