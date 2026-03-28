# src/tests/e2e/

Frontend E2E browser tests (Playwright).

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `comprehensive-llm-workflow.spec.js` | **Primary regression suite** — Full application workflow (10 phases) | Running complete E2E regression, LLM developer onboarding |
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
| `QUICK_START.md` | Quick start guide for running E2E tests | Getting started with test execution |
