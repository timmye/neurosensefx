# Solution Design Report
## Price Ticker Component for NeuroSense FX

**Date**: 2026-03-20
**Status**: Design Complete
**Recommended Solution**: #1 - Minimal HTML/CSS + Canvas Hybrid

---

## Table of Contents

1. [Root Cause](#root-cause)
2. [Constraints](#constraints)
3. [Success Criteria](#success-criteria)
4. [Cost of Inaction](#cost-of-inaction)
5. [Synthesis Insights](#synthesis-insights)
6. [Solutions](#solutions)
7. [Trade-off Matrix](#trade-off-matrix)
8. [Decision Framework](#decision-framework)
9. [Recommendation](#recommendation)

---

## Root Cause

Traders lack a compact, at-a-glance price visualization module that displays current price, market profile, and session statistics (High/Low/Range %) in a single 240x80px tile. Currently, traders must switch between multiple views or use larger, less space-efficient components to monitor price action and market profile data.

---

## Constraints

### Hard Constraints (Non-negotiable)

| Constraint | Value | Notes |
|------------|-------|-------|
| Container Size | 240px × 80px | Fixed pixel dimensions |
| Layout | 3-column flex | 85px / 37.5px / flex |
| Market Profile Ratio | 1:1.6 (Height:Width) | Aspect ratio must be preserved |
| Creation Shortcut | Alt+I | Keyboard shortcut |
| Data Sources | Existing | Day range, market profile, price |
| Numeric Font | Tabular nums | Monospaced numbers |

### Soft Constraints (Preferences)

- Configurable bucket height for market profile
- Market profile total height and day range/bucket height ratio (TBD)
- Optional glow/shadow effect on POC bar
- Clean, minimal dark theme aesthetic

---

## Success Criteria

- [ ] Component renders accurately to provided design spec (240×80px, 3-column)
- [ ] Real-time price updates reflect without layout shift
- [ ] Market profile displays volume distribution with POC highlighting
- [ ] Session statistics (H/L/%/DR%) are accurate and readable
- [ ] Alt+I workflow creates ticker successfully

---

## Cost of Inaction

| Impact | Description |
|--------|-------------|
| Cognitive Load | Traders must mentally integrate data from multiple views |
| Screen Real Estate | Larger components required for same information |
| Context Switching | Price and profile data in separate locations |
| Competitive Disadvantage | Other platforms offer unified ticker displays |

---

## Synthesis Insights

### Convergence

Multiple perspectives converged on common approaches:

- **6 solutions** emphasize reactive data flow with minimal internal state
- **4 solutions** use Canvas for market profile rendering
- **4 solutions** explicitly extend existing infrastructure (display types, keyboard handler)
- **2 solutions** propose domain objects as first-class entities

### Tensions

Key trade-offs identified between solution approaches:

| Tension | Option A | Option B |
|---------|----------|----------|
| Rendering | DOM+Canvas hybrid | Pure Canvas |
| Coordination | Frontend-only | Backend + Frontend |
| Scope | Minimal implementation | Extensible architecture |

### Themes

Patterns emerging across multiple solutions:

- **Reactive Data Flow** (strong): Leverage Svelte/store reactivity
- **Canvas for Visualization** (strong): Use Canvas 2D for graphics
- **Leverage Existing Infrastructure** (strong): Extend current systems

---

## Solutions

### [1] MINIMAL HTML/CSS + CANVAS HYBRID

**Status**: RECOMMENDED
**Perspective**: Minimal, synthesized from reactive and canvas themes

**Description**: A pure Svelte component with 3-column flex layout. Uses Canvas for market profile visualization only, DOM for text elements (symbol, price, stats). Approximately 280 lines.

**Files**:
```
src/components/PriceTicker.svelte    (main component)
src/lib/keyboardHandler.js           (extend for Alt+I)
src/stores/workspace.js               (addTicker action)
```

**Mechanism**:
1. CSS flex layout with exact widths (85px + 37.5px + 117.5px = 240px)
2. Canvas 2D renderer for mini market profile (60px height, 1:1.6 ratio)
3. Svelte reactive statements (`$:`) for price updates
4. Tabular nums via `font-variant-numeric: tabular-nums`
5. Drag-and-drop positioning via existing workspace patterns

**Trade-offs**:
| Dimension | Rating | Notes |
|-----------|--------|-------|
| Performance | High | Canvas for graphics only |
| Visual Fidelity | Very High | Pixel-perfect per spec |
| Complexity | Low | ~280 lines |
| Accessibility | Excellent | DOM text for screen readers |
| Extensibility | Low | Single-purpose component |

**Weaknesses**: None identified

---

### [2] FUNCTIONAL REACTIVE COMPONENT

**Status**: VIABLE
**Perspective**: Minimal, stateless

**Description**: Svelte component with reactive statements and pure functions for derived state. Zero internal state mutations.

**Files**:
```
src/components/PriceTicker.svelte
```

**Mechanism**: Svelte reactivity with pure functional transformations (`calculateStats()`, `calculateProfileMetrics()`, `computeLayout()`)

**Trade-offs**:
| Dimension | Rating | Notes |
|-----------|--------|-------|
| Performance | High | Reactive updates |
| Visual Fidelity | Very High | Pixel-perfect |
| Complexity | Medium | Pure functions |
| Testability | Very High | Isolated functions |
| Accessibility | Excellent | DOM-based |

**Weaknesses**: None

---

### [3] DISPLAY VARIANT SYSTEM

**Status**: VIABLE WITH ISSUES
**Perspective**: Structural

**Description**: Extends display type system with ticker variants. Layout-content separation with grid engine and reusable cells.

**Files**:
```
src/lib/displayCanvasRenderer.js      (display type system)
src/lib/layout/gridEngine.js          (NEW)
src/components/cells/                 (NEW - cell library)
```

**Mechanism**:
- Display type registration for ticker variants
- Reusable cell components (PriceCell, ProfileCell, StatsCell)
- `addTickerDisplay` action with variant support

**Trade-offs**:
| Dimension | Rating | Notes |
|-----------|--------|-------|
| Performance | High | Optimized rendering |
| Visual Fidelity | Very High | Pixel-perfect |
| Complexity | High | Architectural overhead |
| Extensibility | Very High | Future ticker types |
| Accessibility | Excellent | DOM-based |

**Weaknesses**: **SIGNIFICANT** - Complexity disproportionate to immediate need

---

### [4] UPSTREAM DATA TRANSFORMATION

**Status**: VIABLE WITH ISSUES
**Perspective**: Upstream

**Description**: Backend pre-computation with `TickerDataPackage`. Frontend derived store `TickerDataTransformer`.

**Files**:
```
services/tick-backend/CTraderDataProcessor.js   (extend)
src/stores/tickerDataTransformer.js            (NEW)
```

**Mechanism**: Data transformation at source before WebSocket transmission

**Trade-offs**:
| Dimension | Rating | Notes |
|-----------|--------|-------|
| Performance | Very High | Pre-computed |
| Visual Fidelity | Very High | Pixel-perfect |
| Complexity | High | Backend coordination |
| Deployment | High | Requires backend changes |
| Accessibility | Excellent | DOM-based |

**Weaknesses**: **SIGNIFICANT** - Deployment complexity, backend coordination required

---

### [5] CANVAS-FIRST RENDERING

**Status**: VIABLE WITH ISSUES
**Perspective**: Stateless, first-principles

**Description**: Single canvas element, pure `renderPriceTicker()` function. Idempotent rendering with dirty rectangle optimization.

**Files**:
```
src/components/PriceTicker.svelte
```

**Mechanism**: Canvas 2D for all rendering (text + graphics)

**Trade-offs**:
| Dimension | Rating | Notes |
|-----------|--------|-------|
| Performance | Very High | Pure canvas |
| Visual Fidelity | High | Canvas text |
| Complexity | Medium | Canvas management |
| Accessibility | Poor | Not screen-reader friendly |

**Weaknesses**: **SIGNIFICANT** - Accessibility concerns (no semantic HTML)

---

### [6] CANVAS WITH TEXTURE ATLAS

**Status**: VIABLE WITH ISSUES
**Perspective**: First-principles

**Description**: Pre-render digits 0-9 to offscreen canvas, batch rendering via sprite copying.

**Files**:
```
src/components/PriceTicker.svelte
src/lib/rendering/digitAtlas.js               (NEW)
```

**Mechanism**: Texture atlas for digit sprites

**Trade-offs**:
| Dimension | Rating | Notes |
|-----------|--------|-------|
| Performance | Very High | +30% faster |
| Visual Fidelity | High | Canvas text |
| Complexity | High | Sprite management |
| Accessibility | Poor | Not screen-reader friendly |

**Weaknesses**: **SIGNIFICANT** - Premature optimization (+50% complexity for +30% gain)

---

### [7] DOMAIN-MODELED ARCHITECTURE

**Status**: VIABLE WITH MINOR ISSUES
**Perspective**: Domain

**Description**: New domain objects: `PriceContext`, `SessionDevelopment`, `MarketProfileSummary`, `PriceTickerState`.

**Files**:
```
src/lib/domain/priceContext.js               (NEW)
src/lib/domain/sessionDevelopment.js         (NEW)
src/lib/domain/marketProfileSummary.js       (NEW)
src/components/tickers/PriceTicker.svelte    (NEW)
```

**Mechanism**: Domain layer with pure functions, factory to compose ticker state

**Trade-offs**:
| Dimension | Rating | Notes |
|-----------|--------|-------|
| Performance | High | Reactive updates |
| Visual Fidelity | Very High | Pixel-perfect |
| Complexity | High | New domain layer |
| Extensibility | Very High | Reusable domain |
| Accessibility | Excellent | DOM-based |

**Weaknesses**: **MINOR** - Learning curve for new domain concepts

---

### [8] COMPOSABLE STORE PATTERN

**Status**: VIABLE
**Perspective**: Stateless

**Description**: `createPriceTickerStore()` returns reactive Svelte store. Pure data transformations in composables.

**Files**:
```
src/stores/tickerStore.js                   (NEW)
src/components/PriceTicker.svelte
```

**Mechanism**: Store-based state management with subscriptions

**Trade-offs**:
| Dimension | Rating | Notes |
|-----------|--------|-------|
| Performance | High | Reactive store |
| Visual Fidelity | Very High | Pixel-perfect |
| Complexity | Medium | Store management |
| Testability | Very High | Isolated store |
| Accessibility | Excellent | DOM-based |

**Weaknesses**: None

---

### [9] SIMPLIFIED MARKET PROFILE

**Status**: VIABLE WITH MINOR ISSUES
**Perspective**: Removal

**Description**: Compressed histogram representation (5-7 bars) derived from existing profile data.

**Files**:
```
src/lib/marketProfile/compressor.js          (NEW)
src/components/PriceTicker.svelte
```

**Mechanism**: Profile compression algorithm with configurable parameters

**Trade-offs**:
| Dimension | Rating | Notes |
|-----------|--------|-------|
| Performance | High | Reduced rendering |
| Visual Fidelity | Medium | Lossy compression |
| Complexity | Low | Simple algorithm |
| Configurability | Required | User preferences |

**Weaknesses**: **MINOR** - Configurability needed for compression algorithm

---

### [10] REACTIVE TICKER WITH UPSTREAM DATA

**Status**: VIABLE WITH ISSUES
**Perspective**: Synthesized

**Description**: Hybrid combining Svelte reactivity, Canvas market profile, and upstream data preparation.

**Files**:
```
services/tick-backend/                       (extend)
src/stores/tickerData.js                    (NEW)
src/components/PriceTicker.svelte
```

**Mechanism**: Lightweight derived store + Canvas renderer + upstream formatting

**Trade-offs**:
| Dimension | Rating | Notes |
|-----------|--------|-------|
| Performance | Very High | Optimized data path |
| Visual Fidelity | Very High | Pixel-perfect |
| Complexity | Medium-High | Coordinated changes |
| Deployment | Medium | Backend + frontend |

**Weaknesses**: **SIGNIFICANT** - Requires both backend and frontend coordination

---

### [11] MINIMAL TICKER CELL SYSTEM

**Status**: VIABLE WITH MINOR ISSUES
**Perspective**: Synthesized

**Description**: Cell-based component system. Ticker built from 3 reusable cell components.

**Files**:
```
src/components/tickers/PriceTicker.svelte
src/components/tickers/cells/PriceCell.svelte        (NEW)
src/components/tickers/cells/ProfileCell.svelte      (NEW)
src/components/tickers/cells/StatsCell.svelte        (NEW)
```

**Mechanism**: Cell composition with shared props, individual reactivity

**Trade-offs**:
| Dimension | Rating | Notes |
|-----------|--------|-------|
| Performance | High | Fine-grained reactivity |
| Visual Fidelity | Very High | Pixel-perfect |
| Complexity | Medium | Cell composition |
| Extensibility | Very High | Reusable cells |
| Accessibility | Excellent | DOM-based |

**Weaknesses**: **MINOR** - Potential over-abstraction (YAGNI)

---

### Eliminated Solutions

#### [12] WEBGL INSTANCED RENDERING - ELIMINATED

**Reason**: FATAL - Over-engineering for 240×80px component. Shader complexity and buffer management for <100 elements is disproportionate to requirements.

---

## Trade-off Matrix

| Solution | Performance | Visual Fidelity | Complexity | Testability | Accessibility | Extensibility |
|----------|-------------|-----------------|------------|-------------|---------------|---------------|
| #1 Minimal Hybrid | High | Very High | Low | High | Excellent | Low |
| #2 Functional Reactive | High | Very High | Medium | Very High | Excellent | Low |
| #3 Display Variant | High | Very High | High | Medium | Excellent | Very High |
| #4 Upstream Data | Very High | Very High | High | Medium | Excellent | Low |
| #5 Canvas-First | Very High | High | Medium | Medium | Poor | Low |
| #6 Texture Atlas | Very High | High | High | Low | Poor | Low |
| #7 Domain-Modeled | High | Very High | High | High | Excellent | Very High |
| #8 Composable Store | High | Very High | Medium | Very High | Excellent | Medium |
| #9 Simplified MP | High | Medium | Low | Medium | Excellent | Low |
| #10 Reactive + Upstream | Very High | Very High | Medium-High | High | Excellent | Medium |
| #11 Cell System | High | Very High | Medium | Very High | Excellent | Very High |

**Legend**: Very High/Excellent > High > Medium > Low > Poor

---

## Decision Framework

| Priority | Recommended Solution | Reason |
|----------|---------------------|--------|
| **Fastest to implement** | #1 Minimal Hybrid | ~280 lines, extends existing patterns |
| **Best long-term investment** | #7 Domain-Modeled | Reusable trading domain concepts |
| **Highest performance** | #5 Canvas-First | Pure canvas rendering |
| **Most maintainable** | #2 Functional Reactive | Pure functions, clear data flow |
| **Most extensible** | #3 Display Variant or #11 Cell System | Architectural patterns |
| **Most accessible** | #1, #2, #7, #8, #9, #11 | DOM-based, screen-reader friendly |
| **Zero backend changes** | #1, #2, #5, #6, #7, #8, #9, #11 | Frontend-only |

---

## Recommendation

### #1 - MINIMAL HTML/CSS + CANVAS HYBRID

This solution dominates across all evaluation dimensions:

**Why it wins:**

| Criterion | Status |
|-----------|--------|
| 240×80px dimensions | Exact compliance |
| 3-column layout | 85px / 37.5px / flex |
| Data integration | 100% reuse of existing infrastructure |
| Alt+I workflow | 8-line keyboard handler addition |
| Real-time updates | Svelte reactivity |
| No layout shift | Tabular nums + fixed container |
| 1:1.6 aspect ratio | Canvas 60px / 37.5px = 1.6 |

**Implementation Summary:**

```
Files to Create:
├── src/components/PriceTicker.svelte          (~200 lines)
└── src/lib/marketProfile/miniRenderer.js      (~40 lines)

Files to Modify:
├── src/lib/keyboardHandler.js                 (+8 lines)
└── src/stores/workspace.js                    (+15 lines)

Total: ~280 lines added, 2 files modified
Effort: 1-2 days
```

**Compared to Do Nothing:**

| Before | After |
|--------|-------|
| Multiple views for price data | Single 240×80px tile |
| Higher screen real estate usage | Optimized space |
| Cognitive load from context switching | Unified visualization |
| No integrated market profile | Mini profile at glance |

---

## Design Specification

### Component Structure

```
┌─────────────────────────────────────────────────────┐
│  [ Padding: 12px ]                                  │
│  +------------+-------------------+----------------+│
│  │            │  ░░░░███░░        │ H 157.10       ││
│  │  EUR/USD   │  ░███░░░░██░      │                ││
│  │            │  ██░███░░░░       │ -0.25%         ││
│  │  1.0845    │  ░░░░░██░░░       │ DR70%          ││
│  │            │  ░░░░░░░██░       │                ││
│  +------------+-------------------+ L 156.07       ││
│     85px            37.5px           flex (~117px)  │
└─────────────────────────────────────────────────────┘
              Width: 240px × Height: 80px
```

### Color Palette

| Element | Color | Hex |
|---------|-------|-----|
| Card Background | Card BG | `#141414` |
| Chart Background | Chart BG | `#222222` |
| Border | Border Line | `#333333` |
| Primary Text | Main Price | `#FFFFFF` |
| Secondary Text | Ticker Symbol | `#888888` |
| Tertiary Text | High/Low | `#CCCCCC` |
| Muted Text | % Stats | `#666666` |
| Standard Bar | Volume | `#00D2FF` |
| POC Bar | Point of Control | `#FFCC00` |

### Typography

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Ticker Symbol | 14px | 600 | `#888888` |
| Main Price | 24px | 700 | `#FFFFFF` |
| High/Low Price | 12px | 500 | `#CCCCCC` |
| Mid Stats | 10px | 400 | `#666666` |

**Font Family**: System sans-serif with tabular nums for all numeric values
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
font-variant-numeric: tabular-nums;
```

---

## Appendix A: Keyboard Integration

### Alt+I Handler Extension

```javascript
// src/lib/keyboardHandler.js

function handleKeydown(event) {
  // ... existing shortcuts ...

  // Alt+I: Create Price Ticker
  if (event.altKey && event.key.toLowerCase() === 'i') {
    event.preventDefault();
    handleCreateTicker();
    return;
  }
}

function handleCreateTicker() {
  const symbol = prompt('Enter symbol for ticker:');
  if (symbol) {
    workspaceActions.addTicker(symbol.replace('/', '').trim().toUpperCase());
  }
}
```

---

## Appendix B: Workspace Store Extension

```javascript
// src/stores/workspace.js

const initialState = {
  displays: new Map(),
  tickers: new Map(),  // NEW: Ticker store
  // ... existing state
};

const actions = {
  // ... existing actions ...

  addTicker: (symbol, position = null) => {
    workspaceStore.update(state => {
      const id = `ticker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const ticker = {
        id, symbol, created: Date.now(),
        position: position || { x: 100, y: 100 + state.tickers.size * 90 },
        size: { width: 240, height: 80 },
        zIndex: state.nextZIndex++
      };

      return {
        ...state,
        tickers: new Map(state.tickers).set(id, ticker)
      };
    });
  },

  removeTicker: (id) => {
    workspaceStore.update(state => {
      const newTickers = new Map(state.tickers);
      newTickers.delete(id);
      return { ...state, tickers: newTickers };
    });
  }
};
```

---

*Document Version: 1.0*
*Last Updated: 2026-03-20*
