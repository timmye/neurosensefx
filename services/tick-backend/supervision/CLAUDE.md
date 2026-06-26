# services/tick-backend/supervision/

Feed recovery & supervision tier layered over the data feeds: owns the cTrader connection lifecycle via an explicit state machine and recovers from stale-data and offline conditions. See `README.md` for the architecture rationale, the ports/interfaces design, and the state-machine / retry-policy contracts.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `FeedSupervisor.js` | Lifecycle owner for N feeds; injectable clock/transport; applies RetryPolicy, observes HealthSensor, enforces the connect-phase deadline; per-feed isolation; emits ObservableState for `/health` | Implementing recovery behavior, debugging feed health, adding a supervised feed |
| `CTraderTransportAdapter.js` | **Thin pass-through** over the internal cTrader-Layer library (Phase 3 / B1+B2): the layer now owns open-reject (L1), leak-free heartbeat (L2), close-rejects-pending (L3), and the per-RPC TTL (L4), so the adapter is just glue — idempotent `open()` guard (one connection per app/account), a connection-factory seam (testability), thin `sendCommand`/`sendHeartbeat` delegates, and `on`/`removeListener`/`removeAllListeners` pass-throughs so FeedSupervisor still observes conn `'close'`/`'error'` | Connection lifecycle, the open-idempotency guard, debugging the cTrader reconnect loop |
| `FeedState.js` | Explicit validated state machine for one feed (`FeedStates` + `LEGAL_TRANSITIONS`); no terminal DEAD state | Modifying lifecycle states, debugging illegal-transition errors |
| `HealthSensor.js` | Splits data-ness from liveness: tracks data ticks and heartbeats separately; `compute()`/`check()` return HEALTHY/DEGRADED/STALE | Tuning staleness thresholds, debugging partial-stall detection |
| `RetryPolicy.js` | Pure exponential-backoff delay calculator; stateless counting; capped + jittered; never returns a terminal | Tuning reconnect backoff, debugging retry escalation |
| `RealClock.js` | Production Clock implementation delegating to global `setTimeout`/`clearTimeout`/`Date.now` | Swapping the injected clock, understanding test/prod clock wiring |
| `interfaces.js` | JSDoc-only contracts (`Transport`, `Feed`, `Clock` typedefs) the supervisor and adapters implement | Understanding the ports/contracts, building a new Transport/Feed/Clock |

## Build/Test

```bash
# Offline supervision tests (no creds/PG/Redis/network) — run from services/tick-backend/
npx vitest run __tests__/supervision
```
