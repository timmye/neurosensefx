# Price Axis Precision Bug

## Status: Confirmed

## Symptom
KLineChart price axis (Y-axis) labels show wrong decimal precision for non-EURUSD-like symbols.
Example: USDJPY shows "159.50000" (5 decimals) instead of "159.500" (3 decimals).

## Root Cause
`applyPricePrecision` in `ChartDisplay.svelte:81-85` is a one-shot synchronous read of the
market data store. It reads `digits` and `pipPosition` once at chart init, before the
WebSocket `symbolDataPackage` has arrived. The store defaults are `digits: null, pipPosition: 4`,
so precision is always set to 5 (`null ?? (4) + 1 = 5`). When real data arrives later with
correct `digits`, nothing re-applies the precision to the chart.

## Data Flow

```
ChartDisplay mounts
  → setTimeout(0) → initChart()
    → requestAnimationFrame → applyPricePrecision(symbol)   ← reads store (defaults)
    → requestAnimationFrame → loadChartData(symbol)
      → WebSocket: get_symbol_data_package                  ← async, arrives later
        → marketDataStore updates: digits=3, pipPosition=2
        → NOTHING re-calls applyPricePrecision               ← BUG: no reactive path
```

## Affected Scenarios

| Scenario | Store at call time | Precision set | Correct? |
|---|---|---|---|
| Fresh EURUSD chart | digits=null, pipPosition=4 | 5 | Yes (lucky) |
| Fresh USDJPY chart | digits=null, pipPosition=4 | 5 | **No** (needs 3) |
| Fresh XAUUSD chart | digits=null, pipPosition=4 | 5 | **No** (needs 2) |
| Switch to prev-loaded symbol | digits=correct | correct | Yes (stale data) |

## Verification
Run: `npm run test:unit -- src/lib/chart/__tests__/pricePrecision.test.js`

## Files

| File | Role |
|---|---|
| `src/components/ChartDisplay.svelte:81-85` | One-shot `applyPricePrecision` — no reactivity |
| `src/stores/marketDataStore.js:57-60` | Default `digits: null, pipPosition: 4` |
| `src/lib/chart/reloadChart.js:25-26` | Only re-calls on explicit symbol change |
| `src/lib/chart/chartDataLoader.js` | Data pipeline — no precision update hook |
| `src/lib/chart/chartTickSubscriptions.js` | Bar/tick subscriptions — no precision update |
