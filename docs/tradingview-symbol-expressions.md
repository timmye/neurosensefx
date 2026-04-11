# TradingView Symbol Math Expressions

**Date:** 2026-04-11
**Status:** Researched — ready for implementation

## Summary

TradingView's WebSocket `resolve_symbol` natively supports math expressions (e.g., `DE02Y/US02Y`, `1/XAUUSD`, `FX:EURUSD*GBPUSD`). The backend passes symbols raw to TradingView with zero transformation. The only blockers are in the frontend, where `formatSymbol()` strips `/` and uppercase-truncates all symbols before they reach the WebSocket.

## Verified Expressions

Tested against live TradingView WebSocket (authenticated session) via `scripts/test-tv-expression-resolve.cjs`:

| Expression | Resolve | Series (OHLC) | Notes |
|---|---|---|---|
| `DE02Y/US02Y` | PASS | 10/10 candles | Bond yield spread |
| `FX:EURUSD/FX:GBPUSD` | PASS | — | FX cross with exchange prefix |
| `1/XAUUSD` | PASS | 10/10 candles | Gold inverse |
| `EURUSD` | PASS | — | Control |
| `FX:EURUSD` | PASS | — | Prefixed control |
| `TVC:US02Y` | PASS | — | US 2-year yield |
| `BITSTAMP:BTCUSD*1000` | PASS | — | Crypto with scalar |
| `EUREX:DE02Y` | FAIL | — | Wrong exchange prefix (bare name works) |
| `CBOT:US02Y` | FAIL | — | Wrong exchange prefix (bare name works) |

## Data Path

```
Client WS
  → { type: 'get_symbol_data_package', symbol: "DE02Y/US02Y", source: 'tradingview' }
    │
    ▼
WebSocketServer.handleSubscribe()              ← RAW pass-through, no validation
  → RequestCoordinator.handleTradingViewRequest()  ← RAW pass-through
    │
    ▼
TradingViewSession.subscribeToSymbol()         ← RAW pass-through
  → TradingViewSubscriptionManager.createD1Session()  ← RAW to resolve_symbol
  → TradingViewSubscriptionManager.createM1Session()  ← RAW to resolve_symbol
    │
    ▼
TradingView WS → resolve_symbol({ symbol: "DE02Y/US02Y" })  ← NATIVELY SUPPORTED
  → timescale_update / series_completed → OHLC candle data
    │
    ▼
TradingViewCandleHandler → DataRouter → broadcast to clients
```

**Backend is fully compatible.** Every component from `WebSocketServer` through `TradingViewSubscriptionManager` passes the symbol string raw. No backend changes required.

## Chokepoints (Frontend Only)

Three locations destroy math expressions before they reach the backend:

### 1. `src/lib/displayDataProcessor.js:31-39` — `formatSymbol()`

```javascript
export function formatSymbol(symbol) {
  return symbol.replace('/', '').toUpperCase();
}
```

Called by `FloatingDisplay.svelte`, `PriceTicker.svelte`, and other components before subscribing. Strips `/` from expressions like `DE02Y/US02Y` → `DE02YUS02Y`.

### 2. `src/lib/keyboardHandler.js:11,18,25` — Alt+T / Alt+A shortcuts

```javascript
workspaceActions.addDisplay(symbol.replace('/', '').trim().toUpperCase(), null, source);
```

User types `DE02Y/US02Y` in the prompt, slash is stripped before the display is even created.

### 3. `src/stores/marketDataStore.js:92` — subscription entry point

```javascript
const formattedSymbol = formatSymbol(symbol);
unsubscribeSymbol = subscribeToSymbol(formattedSymbol, source, { adr: 14 });
```

Calls `formatSymbol()` on every symbol before subscribing, regardless of source.

## Implementation Approach

**Rule:** Only apply `formatSymbol()` (slash stripping, uppercase) for `cTrader` source. Pass raw for `tradingview` source.

| File | Change |
|---|---|
| `src/lib/displayDataProcessor.js` | `formatSymbol(symbol, source)` — skip transform when `source === 'tradingview'` |
| `src/lib/keyboardHandler.js` | Stop stripping `/` when creating TradingView displays |
| `src/stores/marketDataStore.js` | Pass `source` through to `formatSymbol()` |

No backend changes. No new modules. No derived-symbol calculator needed.

## What Works Out of the Box

After fixing the three frontend chokepoints:

- **Price tickers** — D1 candles give current price, ADR, daily range
- **Charts** — M1/D1 candles give full OHLC charting
- **Market Profile** — M1 candles feed TPO calculation
- **TWAP** — M1 candles feed time-weighted average
- **Bond futures** — `DE02Y`, `US02Y` available on TradingView (not on cTrader broker)
- **Scalars** — `1000*XAUUSD`, `1/XAUUSD` work natively

## Test Scripts

| Script | What it tests |
|---|---|
| `scripts/test-tv-expression-resolve.cjs` | Whether TradingView `resolve_symbol` accepts expressions |
| `scripts/test-tv-expression-series.cjs` | Whether OHLC candle data flows for expressions |
| `scripts/test-symbol-math-parser.cjs` | Expression parser (standalone, not needed if TV handles math natively) |
| `scripts/test-symbol-math-ticks.cjs` | Derived tick calculator (standalone, not needed if TV handles math natively) |
| `scripts/test-available-symbols.cjs` | cTrader symbol availability diagnostic |

## cTrader Consideration

cTrader's API does NOT support math expressions — it only accepts single symbols from its symbol map. The parser and tick calculator scripts (`test-symbol-math-parser.cjs`, `test-symbol-math-ticks.cjs`) were written before discovering TradingView handles this natively. They remain useful reference if cTrader-side math is ever needed, but the recommended path is to route expression-based subscriptions through TradingView only.

## Limitations

- Expressions only work with `source: 'tradingview'` — cTrader subscriptions must use single symbols
- TradingView uses candle data (OHLC), not tick-level bid/ask — derived spreads won't have true bid/ask spreads
- Symbol names must match TradingView's namespace (e.g., `DE02Y` not `EUREX:DE02Y`, `US02Y` not `CBOT:US02Y`)
- Unauthenticated TradingView sessions may have limited symbol access
