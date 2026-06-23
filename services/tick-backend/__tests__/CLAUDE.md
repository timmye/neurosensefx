# services/tick-backend/__tests__/

Backend unit test suite (reliability, market profile/TWAP symbol normalization, drawing versioning). Run from this directory with `npx vitest run` (config: `vitest.config.js`, includes `__tests__/**/*.test.js`).

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `backend-reliability.test.js` | Reliability acceptance criteria (SafeSender backpressure, graceful shutdown, reconnect, token persistence, module smoke loads) | Verifying reliability fixes, checking module load health |
| `marketProfileNormalization.test.js` | Canonical symbol normalization across feeds for MarketProfileService (regression: stale-data-after-hours) | Debugging market profile freezes, cross-feed symbol keying |
| `twapNormalization.test.js` | Canonical symbol normalization for TwapService + the shared `normalizeSymbol` util | Debugging TWAP staleness, symbol canonicalization |
| `drawingVersioning.test.js` | Drawing version conflict and resolution tests (integration; skipped by default) | Debugging drawing version handling, testing concurrent edits |
