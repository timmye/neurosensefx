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
| `chart-display.spec.js` | Chart display "c" key workflow (10 tests: create, dimensions, minimize/restore, toolbar buttons, resolution switching, store persistence, console errors) | Testing chart window creation, toolbar interactions, state management |
| `headlines-workflow.spec.js` | Full workflow E2E test for headlines (login, H-key toggle, close button, rapid stress, console audit) | Testing headlines widget end-to-end workflow |
| `headlines-widget.spec.js` | Debug/unit tests for headlines (store state, key binding, FinancialJuice script, DOM visibility) | Debugging headlines widget issues, unit testing widget features |
| `workspace-drawing-persistence.spec.js` | Drawing export/import round-trip (v1.1.0 drawings in IndexedDB, v1.0.0 backward compat, full round-trip) | Testing drawing persistence across workspace export/import |
| `QUICK_START.md` | Quick start guide for running E2E tests | Getting started with test execution |
