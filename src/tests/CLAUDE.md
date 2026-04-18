# src/tests/

End-to-end and unit tests for the frontend application.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `p0-connection-verification.spec.js` | P0 priority connection and WebSocket tests (Alt+A, FloatingDisplay, console errors) | Verifying core connectivity, debugging connection issues |
| `p1-connection-verification.spec.js` | P1 priority connection tests (status callback timing, state transitions, auto-reconnect) | Extended connection verification, timing validation |
| `market-profile-comprehensive.spec.js` | Comprehensive Market Profile E2E tests | Testing Market Profile rendering and behavior |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `e2e/` | End-to-end browser tests | Writing E2E tests, debugging test failures |

### e2e/

| File | What | When to read |
| ---- | ---- | ------------ |
| `comprehensive-llm-workflow.spec.js` | **Primary regression suite** - Full application workflow (10 phases) | Running complete E2E regression, LLM developer onboarding |
| `fx-basket.spec.js` | FX Basket feature validation (Alt+B, 8 baskets, 28 pairs) | Testing FX Basket feature |
| `fx-basket-live-data.spec.js` | Live WebSocket data flow validation | Testing real-time data flow, WebSocket integration |
| `message-coordination.spec.js` | Message coordinator tests (timeout, cleanup, tracking) | Testing coordinator behavior, timeout handling |
| `backend-reinit.spec.js` | Alt+R backend reinitialization | Testing backend reinit feature |
| `price-ticker.spec.js` | Price Ticker display feature tests | Testing price ticker rendering and behavior |
| `price-markers-import.spec.js` | Price marker import functionality | Testing marker import from workspace files |
| `console-check.spec.js` | Browser console error detection | Checking for runtime errors in browser |
| `batched-import-rate-limit.spec.js` | Batched import with rate limiting | Testing workspace import under load |
| `previous-day-ohlc.spec.js` | Previous day OHLC data validation | Testing OHLC data accuracy |
| `prevDay-ohlc-simple.spec.js` | Simplified previous day OHLC tests | Quick OHLC verification |
| `chart-display.spec.js` | Chart display "c" key workflow (10 tests) | Testing chart creation, toolbar, resolution switching |
| `headlines-workflow.spec.js` | Full workflow E2E test for headlines (login, H-key toggle, close, rapid stress, console audit) | Testing headlines widget end-to-end workflow |
| `headlines-widget.spec.js` | Debug/unit tests for headlines (store state, key binding, FJ script, DOM visibility) | Debugging headlines widget issues |

## Test

```bash
npm test                 # Run all E2E tests (requires backend running)
npx playwright test --ui    # Run tests with Playwright UI
npx playwright test fx-basket  # Run FX Basket tests only
npx playwright test comprehensive-llm-workflow  # Run primary regression suite
```
