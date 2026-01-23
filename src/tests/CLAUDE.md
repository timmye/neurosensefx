# src/tests/

End-to-end and unit tests for the frontend application.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `p0-connection-verification.spec.js` | P0 priority connection and WebSocket tests (Alt+A, FloatingDisplay, console errors) | Verifying core connectivity, debugging connection issues |
| `p1-connection-verification.spec.js` | P1 priority connection tests (status callback timing, state transitions, auto-reconnect) | Extended connection verification, timing validation |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `e2e/` | End-to-end browser tests | Writing E2E tests, debugging test failures |

### e2e/

| File | What | When to read |
| ---- | ---- | ------------ |
| `comprehensive-llm-workflow.spec.js` | **Primary regression suite** - Full application workflow (10 phases: init, displays, interaction, viz switching, persistence, shortcuts, lifecycle, markers, recovery) | Running complete E2E regression, LLM developer onboarding |
| `fx-basket.spec.js` | FX Basket feature validation (Alt+B shortcut, 8 baskets, 28 FX pairs, console errors, drag/resize, close) | Testing FX Basket feature, console error detection |
| `fx-basket-live-data.spec.js` | Live WebSocket data flow validation (subscriptions, tick processing, debug API) | Testing real-time data flow, WebSocket integration |
| `message-coordination.spec.js` | Message coordinator tests (symbolDataPackage + tick coordination, 5s timeout, cleanup, independent tracking) | Testing FX Basket coordinator behavior, timeout handling |
| `backend-reinit.spec.js` | Alt+R keyboard shortcut for backend reinitialization | Testing backend reinit feature, keyboard shortcuts |

## Test

```bash
npm test                 # Run all E2E tests (requires backend running)
npx playwright test --ui    # Run tests with Playwright UI
npx playwright test fx-basket  # Run FX Basket tests only
npx playwright test comprehensive-llm-workflow  # Run primary regression suite
```

## Test Structure

**Core Regression (3 files, ~20 tests):**
- `comprehensive-llm-workflow.spec.js` - Full workflow validation
- `p0-connection-verification.spec.js` - Critical connection validation
- `p1-connection-verification.spec.js` - Timing validation

**FX Basket Feature (3 files, ~12 tests):**
- `fx-basket.spec.js` - Alt+B shortcut, baskets, subscriptions
- `fx-basket-live-data.spec.js` - Real-time data flow
- `message-coordination.spec.js` - Coordinator timeout handling

**Feature Tests (1 file, ~1 test):**
- `backend-reinit.spec.js` - Alt+R reinitialization

**Total: 7 files, ~33 tests** (reduced from 10 files, ~46 tests)
