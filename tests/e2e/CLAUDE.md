# tests/e2e/

Integration-focused E2E test suites — connection stress, reconnect reliability, subscription queue behavior.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `connection-stress.spec.js` | Connection stress tests (concurrent tabs, timing, data flow) | Testing WebSocket connection robustness under load |
| `playwright-stress.config.cjs` | Playwright config for stress test runs | Configuring stress test execution |
| `reconnect-reliability.spec.js` | Reconnect reliability tests (__SYSTEM__ filter, subscription restore, batch-of-10) | Testing WebSocket reconnection behavior, subscription restoration, batch timing |
| `tv-subscription-queue.spec.js` | TradingView subscription queue tests (timing, bans, system errors) | Testing subscription queue behavior under load |
| `workspace_import_test_file.json` | Test workspace import fixture | Debugging workspace import test data |
