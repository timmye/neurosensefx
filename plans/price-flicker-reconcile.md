# Price Flicker Fix — Single-Writer Reconciliation

## Problem

The developing bar flickers between the current tick price and the candle's close/high/low values. This has been "fixed" 5 times (commits 75eff5c, 94b8914, ebab4e0, ee1f8b4, 813418e) but keeps regressing because the root cause is architectural, not a specific code path.

## Root Cause

Two independent subscriptions (`subscribeToBarStore` and `subscribeToLiveTicks`) both call `chart.updateData()` on the developing bar. They receive data from different WS messages (candleUpdate vs tick), processed by different handlers, batched in separate rAFs. The chart renders one value then the other — flicker.

Previous fixes removed or reordered one writer, but the architecture still *allows* competing writers. Nothing prevents the next feature from adding a third.

## Solution

Replace both subscriptions with a single `reconcile()` function that reads from both stores and is the **only** caller of `chart.updateData()` / `chart.applyNewData()`.

### Data flow (before)

```
candleUpdate → bar store → subscribeToBarStore → chart.updateData()  ← WRITER 1
tick → marketStore → subscribeToLiveTicks → chart.updateData()       ← WRITER 2
```

### Data flow (after)

```
candleUpdate → bar store  ──┐
                              ├→ reconcile() → chart.updateData()   ← SINGLE WRITER
tick → marketStore ─────────┘
```

## Changes

### `src/lib/chart/chartTickSubscriptions.js`

**Remove:**
- `subscribeToBarStore()` — dual writer #1
- `subscribeToLiveTicks()` — dual writer #2

**Add:**
- `createReconcile(chart, barStore, marketStore)` — returns an unsubscribe handle
  - Subscribes to both stores
  - On bar store change:
    - `updateType === 'full'` → `chart.applyNewData(all bars)` (full replace)
    - incremental with new timestamp → `chart.updateData(new bar)` + update developing bar
    - incremental with same timestamp → skip (developing bar handled by marketStore sub)
  - On marketStore change (rAF-batched):
    - Read chart's last bar
    - Compute: `high = max(last.high, tick)`, `low = min(last.low, tick)`, `close = tick`
    - `chart.updateData(merged bar)`
  - Single rAF guard prevents multiple writes per frame

**Modify:**
- `chartDataLoader.js` — wire `createReconcile` instead of two separate subscriptions
- `ChartDisplay.svelte` — store single unsubscribe ref instead of two

### Invariant

`chart.updateData()` and `chart.applyNewData()` are called from exactly one function. Both data stores are read-only inputs. This is structurally enforced — no amount of new features can create a competing writer without explicitly calling reconcile internals.

## Reconcile logic for developing bar

```
Given:
  last = chart.getDataList()[last]   (from candle store — open/high/low set by backend)
  tick = marketStore.current          (from tick store — real-time price)

Output:
  open  = last.open                   (never changes for this bar)
  high  = Math.max(last.high, tick)  (bar store high or live tick, whichever is higher)
  low   = Math.min(last.low, tick)   (bar store low or live tick, whichever is lower)
  close = tick                        (always the live price)
```

## Edge cases

1. **No chart yet** (minimized): guard with `if (!chart) return`
2. **No bars yet** (loading): guard with `if (dataList.length === 0) return`
3. **No tick price** (disconnected): guard with `if (mdata.current == null) return`
4. **Full data replace**: use `chart.applyNewData()` not `updateData()` — resets all bars
5. **New bar from candle store**: call `chart.updateData(newBar)` to add it, then the next tick rAF will start writing to it as the developing bar
6. **rAF coalescing**: single rAF guard ensures at most one chart write per frame regardless of how many store updates fire
