# Fix: Current Price Flicker

## Problem

The current price line flickers. Four causes identified across three audit rounds.

### Cause 1: Bar store wipes live tick modification (REVERTED — wrong approach)

Two independent subscriptions write to the chart's last bar:
- **Path A** (`subscribeToLiveTicks`): `marketDataStore.current` → rAF → `chart.updateData(close=tickPrice)`
- **Path B** (`subscribeToBarStore`): `chartBarStore.bars` → `chart.applyNewData()` (full) or `chart.updateData()` (incremental)

Original fix: synchronous `patchLastBarWithTick()` after bar-store writes.
**Problem:** Created a second synchronous write path that raced with `subscribeToLiveTicks`'s rAF callback. KLineChart's `addData` is async (yields for indicator calc), so two rapid `updateData` calls interleave their async chains. The canvas rAF guard coalesces paint but intermediate state mutations cause visual artifacts.
**Resolution:** Reverted. `subscribeToLiveTicks` is the sole writer for real-time close. Bar store delivers OHLC data only.

### Cause 2: Trendbar close vs spot bid oscillation (FIXED)

cTrader sends two mutually exclusive event types that produce ticks with different price semantics:

1. **Trendbar events**: `processTrendbarEntry` → tick with `bid: trendbarClose, ask: trendbarClose`
2. **Spot events**: `processSpotEvent` → tick with `bid: spotBid, ask: spotAsk` (real spread)

Frontend's `data.price ??` chain: trendbar ticks had no `price` → fell to `data.bid` = trendbarClose. Spot ticks had no `price` → fell to mid `(bid+ask)/2`. Two different prices (~half-spread apart) alternating on every tick.

**Fix:** Both event types now include a `price` field:
- Trendbar: `price: trendbarClose` (the bar's computed close)
- Spot: `price: (bid+ask)/2` (the mid-quote)

Frontend uses `data.price` directly — no bid/ask ambiguity.

### Cause 3: Mid-price consistency (FIXED)

Frontend mid-price `(bid+ask)/2` when bid≠ask applied consistently across all price consumers:
- `marketDataStore.js` — tick and symbolDataPackage normalization
- `fxBasketSubscription.js` — basket tick handler

### Cause 4: Cross-source store sharing (INFO)

One `marketDataStore` per symbol regardless of source. cTrader and TradingView both write `current` to the same store. TradingView alone is stable (sends single `price` field). Cross-source overwrite only matters when both are active for the same symbol — acceptable.

## Changes

### 1. `services/tick-backend/CTraderEventHandler.js` — both tick types send `price` (DONE)

- Trendbar ticks (line 34): `price: close` instead of `bid/ask`
- Spot ticks (line 100): `price: (bid+ask)/2` alongside bid/ask

### 2. `services/tick-backend/WebSocketServer.js` — lastPrices prefers `tick.price` (DONE)

`lastPrices` computation: `tick.price ?? ((bid+ask)/2) ?? bid ?? ask`

### 3. `src/stores/marketDataStore.js` — mid-price normalization (DONE)

- Tick: `data.price ?? midPrice ?? data.bid ?? data.ask`
- symbolDataPackage: same mid-price logic for `current` and `previousPrice`

### 4. `src/lib/fxBasket/fxBasketSubscription.js` — mid-price for basket ticks (DONE)

Tick handler uses `(bid+ask)/2` when bid≠ask.

### 5. `src/lib/chart/chartTickSubscriptions.js` — reverted patchLastBarWithTick (DONE)

Removed `patchLastBarWithTick` and `marketStore` from deps. `subscribeToLiveTicks` is the sole real-time close writer.

### 6. `src/lib/chart/chartDataLoader.js` — reverted marketStore from deps (DONE)

Removed `marketStore` from `subscribeToBarStore` deps.

## Verification

- Trendbar tick: has `price` → used directly (no bid/ask fallback)
- Spot tick: has `price` → used directly (mid, no bid/ask fallback)
- TradingView tick: has `price` → used directly
- Single writer to chart close: `subscribeToLiveTicks` only (no race)
- KLineChart: one `updateData` per rAF (no interleaving)
- FX basket: consistent mid-price logic
