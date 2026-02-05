# Quick Start: FX Basket E2E Tests

## Location
**Test File:** `/workspaces/neurosensefx/src/tests/e2e/fx-basket.spec.js`

## Prerequisites

1. **Start the application:**
   ```bash
   cd /workspaces/neurosensefx
   npm run dev
   ```

2. **Ensure backend is running:**
   ```bash
   ./run.sh start
   ```

## Run Tests

### All FX Basket Tests
```bash
npx playwright test fx-basket
```

### With UI (Recommended for Debugging)
```bash
npx playwright test fx-basket --ui
```

### Specific Test
```bash
# Test console errors (CRITICAL)
npx playwright test fx-basket --grep "Console has no errors"

# Test Alt+B shortcut
npx playwright test fx-basket --grep "Alt+B creates"

# Test 8 currency baskets
npx playwright test fx-basket --grep "8 currency baskets"
```

## Test Coverage

1. ✅ **Alt+B Shortcut** - Creates FX Basket display
2. ✅ **Symbol Display** - Shows "FX BASKET"
3. ✅ **Console Errors** - **ZERO TOLERANCE** (critical test)
4. ✅ **8 Currency Baskets** - USD, EUR, JPY, GBP, AUD, CAD, CHF, NZD
5. ✅ **WebSocket** - Subscribes to 28 FX pairs
6. ✅ **Drag** - interact.js drag functionality
7. ✅ **Resize** - interact.js resize functionality
8. ✅ **Close Button** - Removes display
9. ✅ **Full Workflow** - End-to-end integration

## Key Features Tested

- **Keyboard Shortcut:** Alt+B creates display
- **Symbol:** "FX_BASKET" appears in header
- **Console:** **No errors allowed**
- **Rendering:** All 8 baskets visible
- **WebSocket:** All 28 pairs subscribed
- **Interaction:** Drag and resize work
- **Lifecycle:** Close button works

## Expected Results

```
Running 9 tests using 1 worker

✓ FX Basket - Alt+B Workflow (15.2s)
  ✓ Alt+B creates FX Basket display
  ✓ Display shows FX BASKET symbol
  ✓ Console has no errors
  ✓ Display shows 8 currency baskets
  ✓ WebSocket subscribes to FX pairs
  ✓ Display is draggable
  ✓ Display is resizable
  ✓ Close button works
  ✓ Full Alt+B workflow integration

9 passed (15.2s)
```

## Troubleshooting

### Tests not found?
```bash
# Run from project root
cd /workspaces/neurosensefx
npx playwright test fx-basket
```

### Console errors?
```bash
# Run with UI to see live console
npx playwright test fx-basket --ui
```

### WebSocket not connecting?
```bash
# Check backend status
./run.sh status

# Restart if needed
./run.sh stop && ./run.sh start
```

## View Results

```bash
# HTML report
npx playwright show-report

# Screenshots (on failure)
ls test-results/*/screenshots/

# Videos (on failure)
ls test-results/*/videos/
```

## Documentation

See **FX_BASKET_TEST_README.md** for comprehensive documentation.
