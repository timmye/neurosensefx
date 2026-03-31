# Daily Reset at 0000hrs UTC

## Problem

No proactive midnight scheduler exists. All session-bound data (market profile, FX basket, day range meter, TWAP) accumulates across UTC midnight for connected clients. The only reset path is inside `MarketProfileService.initializeFromHistory()`, which only fires on new subscriptions/reconnections.

## Approach

Add a daily reset scheduler to `WebSocketServer.js` (the only service with access to all required sub-services). On midnight UTC, reset backend state and broadcast a `dailyReset` message so the frontend can refresh its data.

## Changes

### 1. `services/tick-backend/SubscriptionManager.js` — add `getActiveSymbols()`

New method that iterates `this.backendSubscriptions` keys (`"symbol:source"` format), splits on `:`, returns unique symbols array.

### 2. `services/tick-backend/WebSocketServer.js` — add daily reset scheduler

- **`scheduleDailyReset()`** — calculates ms until next 0000 UTC, sets `setTimeout`, calls `performDailyReset()` then re-schedules
- **`performDailyReset()`** — for each active symbol:
  1. `twapService.resetDaily(symbol)` (method exists, just never called)
  2. `marketProfileService.cleanupSymbol(symbol)` (method exists at line 39)
  3. Broadcast `{ type: 'dailyReset', symbols, timestamp }` to all connected clients via `this.wss.clients`
- **Cleanup**: clear the timer ref in the existing `close()` method alongside heartbeat cleanup

### 3. `services/tick-backend/RequestCoordinator.js` — add `refreshAllSubscribers(symbol)`

New method that:
1. Gets subscribed clients via `subscriptionManager.getSubscribedClients(symbol, source)`
2. Calls `wsServer.cTraderSession.getSymbolDataPackage(symbol)` to fetch fresh data
3. Calls `sendDataToClients(data, clients)` which re-sends `symbolDataPackage` and triggers `initializeFromHistory()` for both MarketProfile and TWAP

Call this from `performDailyReset()` after cleanup, before broadcasting `dailyReset`.

### 4. `src/stores/marketDataStore.js` — handle `dailyReset` message

Add a system-level listener (via `addSystemSubscription` or direct WebSocket message handler) for `{ type: 'dailyReset' }`. On receipt, for each affected symbol reset `open`, `high`, `low`, `adrHigh`, `adrLow` to `null` and `marketProfile` to `null`. The fresh `symbolDataPackage` and `profileUpdate` messages arriving from step 3 will repopulate these.

### 5. `src/components/FxBasketDisplay.svelte` — handle `dailyReset` for basket

Listen for the `dailyReset` message (via system subscription or a store/event). On receipt, call the existing `handleRefresh()` pattern: `unsubscribe()` then `subscribeBasket()` with the same pairs. This tears down the state machine, volatility EWMA, and baseline Maps, then rebuilds from fresh `symbolDataPackage` messages with today's open prices.

### 6. `services/tick-backend/MarketProfileService.js` — add day-boundary guard in `onM1Bar()`

At the top of `onM1Bar()`, compare the incoming bar's UTC day with the existing profile's `lastUpdate` UTC day. If different, call `cleanupSymbol()` before processing the bar. This is a safety net for the rare case where the scheduler fires late or a bar arrives before the scheduler.

## Execution Order

1. SubscriptionManager.getActiveSymbols() — no dependencies
2. MarketProfileService.onM1Bar() day-boundary guard — no dependencies
3. RequestCoordinator.refreshAllSubscribers() — depends on (1)
4. WebSocketServer scheduler + performDailyReset() — depends on (1), (3)
5. Frontend marketDataStore dailyReset handler — no backend dependency
6. Frontend FxBasketDisplay dailyReset handler — no backend dependency

Steps 1-2 can be done in parallel. Steps 5-6 can be done in parallel. Step 4 is the integration point.

## Out of Scope

- TWAP frontend storage fix (pre-existing bug, separate concern)
- Market profile calculation algorithm changes
- TradingView data path changes
