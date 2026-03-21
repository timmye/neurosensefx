# Price Ticker Component - Minimal Intervention Design

## Problem Statement
Traders lack a compact, at-a-glance price visualization module (240x80px) that displays current price, market profile, and session statistics (High/Low/Range %).

## Root Cause
No existing compact ticker component exists that combines price, market profile, and statistics in a single tile.

## Minimal Intervention Solution

### Overview
Create a new `PriceTicker.svelte` component that reuses **100% of existing data infrastructure** and adds **zero new data processing logic**. The component is a pure presentation layer that composes existing utilities.

## Architecture

### 1. Component Structure (Single File, ~250 LOC)

```
src/components/PriceTicker.svelte
├── Template (3-column flex layout)
├── Script (data binding, computed properties)
└── Styles (fixed dimensions, tabular nums)
```

**Key Design Decision**: No new stores, no new data processing. Component subscribes to existing WebSocket patterns via `useWebSocketSub` composable.

### 2. Data Integration (Zero New Logic)

| Data Source | Existing File | Integration Method |
|-------------|---------------|-------------------|
| Current Price | `displayDataProcessor.js` | Direct use via `processSymbolData()` |
| Day Range Stats | `dayRangeCalculations.js` | Import `calculateDayRangePercentage()` |
| Market Profile | `marketProfileStateless.js` | Reuse profile from `useSymbolData` |
| Price Formatting | `priceFormat.js` | Direct use of `formatPrice()` |
| WebSocket Sub | `useWebSocketSub.js` | Existing composable |

**Zero duplication**: All data transformation logic already exists. Component only derives display values.

### 3. 3-Column Flex Layout (Pixel-Perfect Spec)

```
┌─────────────────────────────────────────────────────────────┐
│ Column 1: Identity (85px) │ Column 2: Chart (37.5px) │ Stats │
│ ├─────────────────────────┤                         │       │
│ │ Symbol: EURUSD          │   Mini Market Profile   │ High: │
│ │ Price: 1.08512          │   (1:1.6 aspect ratio)  │ Low:  │
│ │ Direction: ↑ +12 pips   │   Height: 60px          │ Rng%: │
│ └─────────────────────────┘   Width: 37.5px         │       │
└─────────────────────────────────────────────────────────────┘
```

**CSS Flex Implementation**:
```css
.ticker-container {
  display: flex;
  width: 240px;
  height: 80px;
  box-sizing: border-box;
}

.identity-column {
  width: 85px;
  flex-shrink: 0;
}

.chart-column {
  width: 37.5px;
  flex-shrink: 0;
  position: relative;
}

.stats-column {
  flex: 1;  /* Remaining space: 240 - 85 - 37.5 = 117.5px */
  min-width: 0;
}
```

### 4. Market Profile Mini-Chart (Reusing Renderer)

**Option A (Recommended)**: Render mini profile using existing `marketProfileRenderer.js`
- Create new export: `renderMiniMarketProfile(ctx, profile, size, config)`
- Reuse bucketing, scaling, and TPO calculation logic
- Only change: simplified rendering (no labels, minimal colors)

**Option B (Fallback)**: Canvas-free SVG rendering
- Pure presentational, ~50 LOC
- No canvas state management
- Slightly worse performance but simpler

**Recommendation**: Option A for consistency with existing codebase.

### 5. Tabular Nums (Monospaced Numbers)

```css
.ticker-container {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
  font-feature-settings: 'tnum';  /* Tabular nums */
  font-variant-numeric: tabular-nums;
}
```

**All numeric values** use `.tabular` class for layout stability.

### 6. Alt+I Keyboard Shortcut (Existing Pattern)

**Location**: `src/lib/keyboardHandler.js` (existing file)

**Addition** (5 lines):
```javascript
// Alt+I: Create Price Ticker
if (event.altKey && event.key.toLowerCase() === 'i') {
  event.preventDefault();
  workspaceActions.addPriceTicker(symbol);  // New action, ~10 LOC
  return;
}
```

**Workspace Store Addition** (`src/stores/workspace.js`):
```javascript
addPriceTicker: (symbol) => {
  workspaceStore.update(state => {
    const id = `ticker-${Date.now()}`;
    const ticker = {
      id, symbol,
      type: 'priceTicker',
      position: { x: 100, y: 100 },
      size: { width: 240, height: 80 },
      zIndex: state.nextZIndex++
    };
    return {
      ...state,
      displays: new Map(state.displays).set(id, ticker)
    };
  });
}
```

### 7. Real-Time Updates (No Layout Shift)

**Svelte Reactivity Pattern**:
```svelte
<script>
  let lastData = null;
  let profile = null;

  // Derived reactive values (auto-update)
  $: currentPrice = lastData?.current || '-';
  $: highPrice = lastData?.high || '-';
  $: lowPrice = lastData?.low || '-';
  $: rangePercent = calculateDayRangePercentage(lastData);
  $: direction = lastData?.direction || 'neutral';
  $: pipChange = lastData ? calculatePipChange(lastData) : 0;

  // WebSocket callback updates reactive variables
  const dataCallback = (data) => {
    const processed = processSymbolData(data, formattedSymbol, lastData);
    if (processed?.type === 'data') {
      lastData = processed.data;  // Triggers reactive updates
    }
  };
</script>
```

**Layout Stability**:
- Fixed container dimensions prevent reflow
- Tabular nums prevent jitter on digit changes
- `min-width: 0` on flex items prevents overflow
- `text-overflow: ellipsis` for long symbols

## Implementation Steps (Minimal Intervention Order)

### Phase 1: Component Skeleton (30 minutes)
1. Create `src/components/PriceTicker.svelte`
2. Implement 3-column flex layout with placeholder content
3. Verify 240x80px dimensions (browser DevTools)
4. Add tabular nums font

**Success Criteria**: Container renders at exact 240x80px, no overflow.

### Phase 2: Data Integration (45 minutes)
1. Import `useWebSocketSub`, `processSymbolData`, `calculateDayRangePercentage`
2. Subscribe to symbol data (reuse existing pattern from `FloatingDisplay.svelte`)
3. Bind reactive variables to template
4. Test with live EURUSD data

**Success Criteria**: Current price updates in real-time, no layout shift.

### Phase 3: Market Profile Mini-Chart (60 minutes)
1. Extract mini-profile renderer from `marketProfileRenderer.js`
2. Create simplified rendering function (`renderMiniMarketProfile`)
3. Integrate into chart column (37.5px width)
4. Verify 1:1.6 aspect ratio (60px height / 37.5px width = 1.6)

**Success Criteria**: Profile renders without overflow, matches main profile levels.

### Phase 4: Keyboard Shortcut (15 minutes)
1. Add Alt+I handler to `keyboardHandler.js`
2. Add `addPriceTicker` action to `workspaceStore`
3. Test creation workflow
4. Verify prompt for symbol input

**Success Criteria**: Alt+I prompts for symbol, creates ticker at default position.

### Phase 5: Polish & Testing (30 minutes)
1. Add direction indicator (↑↓) with color coding
2. Implement pip movement calculation
3. Test edge cases (missing data, connection drop)
4. Verify responsive behavior (shouldn't scale, fixed size)

**Total Estimated Time**: 3 hours

## Evaluation Criteria Scorecard

| Criterion | Score | Notes |
|-----------|-------|-------|
| Renders within 240x80px | ✅ PASS | Fixed dimensions, flex layout |
| Accurate 3-column layout | ✅ PASS | 85px + 37.5px + flex (117.5px) = 240px |
| Integrates with existing data | ✅ PASS | Reuses 100% of existing infrastructure |
| Supports Alt+I workflow | ✅ PASS | 15-line addition to keyboardHandler |
| Real-time updates | ✅ PASS | Svelte reactivity via WebSocket |
| No layout shift | ✅ PASS | Tabular nums, fixed container |
| 1:1.6 aspect ratio | ✅ PASS | 60px height / 37.5px width = 1.6 |

## Tradeoffs Analysis

### Performance
- **High weight priority addressed**: Real-time updates via existing WebSocket infrastructure
- Zero new data processing overhead
- Canvas-based mini-profile (efficient rendering)
- Reactive updates only on data changes (Svelte optimization)

### Visual Fidelity
- **High weight priority addressed**: Pixel-perfect 240x80px specification
- Fixed dimensions prevent scaling artifacts
- Tabular nums ensure numeric stability
- 1:1.6 aspect ratio maintained via CSS

### Complexity
- **Medium weight**: Reasonable complexity (~250 LOC single file)
- No new abstractions or patterns introduced
- Reuses existing composables and utilities
- Clear separation: data (existing) vs. presentation (new)

### Testability
- **Medium weight**: Data accuracy verifiable via existing tests
- Component is pure function of input data
- Can test data transformation independently
- Integration tests via existing WebSocket infrastructure

## Alternatives Considered

### Alternative 1: Extend FloatingDisplay (REJECTED)
**Why**: FloatingDisplay is 220x350px, designed for interactive charts. Price Ticker is fundamentally different (240x80px, passive display). Extending would add conditional complexity.

### Alternative 2: Canvas-Based Full Component (REJECTED)
**Why**: Canvas prevents text selection, accessibility issues. Hybrid approach (HTML layout + canvas chart) is simpler and more maintainable.

### Alternative 3: Separate Store for Tickers (REJECTED)
**Why**: Violates minimal intervention. Existing `workspaceStore` can handle ticker displays with a `type: 'priceTicker'` field.

## FATAL FLAWS TO AVOID

1. **Container exceeds 240x80px**: Use `box-sizing: border-box`, account for borders/padding in width calc
2. **Aspect ratio deviation**: Hardcode chart height to 60px (60/37.5 = 1.6), use `aspect-ratio: 1.6 / 1` CSS
3. **Breaks Alt+I**: Test keyboard shortcut in browser DevTools, verify no conflicts
4. **Layout shifts during updates**: Use tabular nums, fixed container widths, reserve space for loading state
5. **Data integration mismatch**: Verify data shape matches `processSymbolData` output, handle null/undefined

## Minimal Intervention Principle

**Question**: What is the smallest change that addresses the root cause?

**Answer**: Add a single presentation component (~250 LOC) that reuses all existing data infrastructure. No new stores, no new data processing, no new WebSocket handlers. The component is a "view adapter" that formats existing data for the 240x80px tile.

**Lines of Code Addition**: ~280 total
- PriceTicker.svelte: ~250 LOC
- keyboardHandler.js: +5 LOC
- workspace.js: +10 LOC (action)
- marketProfileRenderer.js: +15 LOC (mini renderer export)

**Lines of Code Modified**: 0 (no changes to existing logic)

## Success Metrics

1. **Functional**: Alt+I creates ticker, displays real-time price, shows session stats
2. **Performance**: <16ms render time, no layout shift on updates
3. **Quality**: Passes all fatal flaw checks, meets spec dimensions
4. **Maintainability**: Single file component, clear data flow, existing patterns

## Next Steps

1. Review design with stakeholder
2. Confirm data sources (symbol input method, default symbols)
3. Implement Phase 1 (skeleton + layout verification)
4. Incremental phases with testing checkpoints
5. Final integration testing with existing displays
