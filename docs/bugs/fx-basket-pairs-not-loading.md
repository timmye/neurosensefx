# Bug: FX Basket — Pairs Not Loading (Day Range Basket)

## Symptom
FX Basket fails to load all 28 currency pairs. Shows stuck at WAITING, ERROR state, or no pairs appearing.

## Root Cause (CONFIRMED)
**CTrader socket connection times out**, so `symbolLoader.loadAllSymbols()` never runs and the `symbolMap` remains empty. Every `getSymbolDataPackage()` call fails with `"Symbol not found in map"` because cTrader symbols were never loaded into the map.

### Evidence from backend logs:
- `[ERROR] CTraderConnection error: Error [ERR_SOCKET_CONNECTION_TIMEOUT]: Socket connection timeout` — repeated ~20x
- `[COALESCE] Failed EURUSD:14 after 0 retries: Error: Symbol not found in map: EURUSD` — one per pair
- `"availableSymbols":[]` broadcast — symbol map never populated
- TradingView symbols (NAS100, XAUUSD, GER40) work fine — separate unauthenticated path

### Data flow breakdown:
1. `CTraderSession.connect()` opens socket → **TIMEOUT** before cTrader API handshake completes
2. `loadAllSymbols()` at line 86 of `CTraderSession.js` never runs
3. `symbolMap` stays empty (populated by `ProtoOASymbolsListReq` response in `CTraderSymbolLoader.js:19-27`)
4. Every `getSymbolDataPackage()` call hits `this.symbolLoader.getSymbolId(symbolName)` → throws `"Symbol not found"`
5. FX Basket state machine times out at 10s with ERROR, all 28 pairs missing

## Timeline of Recent Changes

| Commit | Description | Area | Affected by root cause? |
|--------|-------------|------|------------------------|
| `5008b39` | Profile broadcast: removed `source`, added `feedSource`, broadcast to both sources | DataRouter, subscriptionManager, marketDataStore | No — uses `profileUpdate`, not `symbolDataPackage`/`tick` |
| `2171a89` | Added `data.initialPrice` fallback for current price on `symbolDataPackage` | fxBasketSubscription | No — never reaches this code because symbol lookup fails first |
| `813418e` | Unified tick price: cTrader sends `price` instead of `bid/ask`, mid-price calc | CTraderEventHandler, WebSocketServer, fxBasketSubscription | No — same issue, symbols never resolve |
| `0ad7b8b` | Refactor: extracted FX basket from god store, deleted dead Path B code | fxBasket module extraction | No — architectural change, not data flow |

## Assessment: Recent commits are NOT regressions

All four recent commits touched code that lives **downstream** of the cTrader connection failure. The `symbolDataPackage`/`tick` messages never reach the frontend because they're rejected server-side before being sent. The changes to `profileUpdate`, `initialPrice`, and tick price semantics are valid fixes but have zero effect while the cTrader connection is broken.

The R1–R4 risks assessed in the initial analysis were eliminated:
- **R1 (missing `open` field)**: Eliminated. `RequestCoordinator.js:196-215` sends `todaysOpen` correctly. `fxBasketSubscription.js:46` checks `(data.open || data.todaysOpen)` — would work if symbols loaded.
- **R2 (source removal)**: Not applicable. FX Basket uses `symbolDataPackage`/`tick`, not `profileUpdate`.
- **R3 (mid-price divergence)**: Not applicable. Tick messages never reach FX Basket.
- **R4 (broadcast both sources)**: Cosmetic, no functional impact.

## Complexity assessment
The recent commits added legitimate fixes without introducing regressions in the FX Basket path. The `profileUpdate` → `feedSource` rename adds minor cognitive load but serves a real need (TradingView-primary priority). The dual-path architecture (chart store vs FX Basket) is intentional — they have different requirements.

## Fix
Resolve the cTrader socket connection timeout. Check:
1. Environment variables (`CTRADE_HOST`, `CTRADE_PORT` or equivalent) — are they pointing to a reachable host?
2. Is the cTrader API server running and accepting connections from this machine?
3. Any firewall/network rules blocking the WebSocket connection?

The `SocketConnection` at `libs/cTrader-Layer/build/entry/node/main.js` times out before completing the handshake. Once the connection succeeds, `loadAllSymbols()` will populate the symbol map and all 28 FX pairs will resolve normally.
