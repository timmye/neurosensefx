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
| `e2e/` | End-to-end browser tests (Playwright) — see `e2e/CLAUDE.md` | Writing E2E tests, debugging test failures |

## Test

```bash
npm test                 # Run all E2E tests (requires backend running)
npx playwright test --ui    # Run tests with Playwright UI
npx playwright test fx-basket  # Run FX Basket tests only
npx playwright test comprehensive-llm-workflow  # Run primary regression suite
```
