# services/tick-backend/__tests__/

Backend unit test suite (reliability, market profile/TWAP symbol normalization, drawing versioning, feed recovery supervision). Run from this directory with `npx vitest run` (config: `vitest.config.js`, includes `__tests__/**/*.test.js`). The supervision/characterization suites run fully **offline** (no creds/PG/Redis/network).

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `backend-reliability.test.js` | Reliability acceptance criteria (SafeSender backpressure, graceful shutdown, reconnect, token persistence, module smoke loads) | Verifying reliability fixes, checking module load health |
| `reconnectionManager.test.js` | `ReconnectionManager` behavioral test: never gives up (retries indefinitely at capped jittered maxDelay), `reset()` zeroes counter+delay+timer | Debugging reconnect give-up (#5), verifying reset semantics |
| `marketProfileNormalization.test.js` | Canonical symbol normalization across feeds for MarketProfileService (regression: stale-data-after-hours) | Debugging market profile freezes, cross-feed symbol keying |
| `twapNormalization.test.js` | Canonical symbol normalization for TwapService + the shared `normalizeSymbol` util | Debugging TWAP staleness, symbol canonicalization |
| `drawingVersioning.test.js` | Drawing version conflict and resolution tests (integration; skipped by default) | Debugging drawing version handling, testing concurrent edits |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `supervision/` | Feed-recovery supervision tests (run offline): `recovery.test.js` (North Star behavioral recovery suite — self-heal, hang-after-open rescued by deadline, hung-command backstop, DEGRADED→reconnect, false-staleness #3 doesn't trip, never-received→STALE→reconnect, reset, subscriptions preserved across reconnect, per-feed isolation); `feedSupervisor.test.js`; `retryPolicy.test.js`; `feedState.test.js`; `healthSensor.test.js`; `ctraderTransportAdapter.test.js`; `recoveryRoutes.test.js` | Verifying feed recovery/supervision behavior offline, debugging the supervisor tier |
| `characterization/` | B0 safety-net tests written before extraction: `ctraderConnect.test.js` / `tradingviewConnect.test.js` script the full cTrader protobuf handshake (app-auth → account-auth → symbols-list → subscribe) with faked I/O and assert subscription restore symbol-for-symbol (uses `helpers/ctraderFake.js`) | Locking in current connect/subscribe behavior before refactoring feeds |
| `fakes/` | Test doubles for offline supervision tests: `FakeClock.js`, `FakeTransport.js`, `FakeFeed.js` | Writing/reusing deterministic test doubles for recovery tests |
