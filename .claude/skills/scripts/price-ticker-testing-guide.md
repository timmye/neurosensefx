# Price Ticker Testing Guide

## Pre-Flight Checklist

### 1. Verify Data Sources
- [ ] Backend WebSocket server running (`./run.sh dev`)
- [ ] At least one symbol active (e.g., EURUSD)
- [ ] Market Profile data available for symbol
- [ ] Day Range statistics calculating correctly

### 2. Browser DevTools Setup
- [ ] Open DevTools (F12)
- [ ] Enable DPR logging: Console → filter `[PriceTicker]`
- [ ] Set device pixel ratio to 1 (for initial testing)
- [ ] Enable element highlighting (hover over ticker)

## Test Cases

### Phase 1: Layout & Dimensions (Critical)

#### Test 1.1: Container Dimensions
**Steps**:
1. Press `Alt+I` in browser
2. Enter symbol: `EURUSD`
3. Inspect created element in DevTools

**Expected**:
```css
width: 240px;
height: 80px;
box-sizing: border-box;
```

**Pass Criteria**: Dimensions exactly 240x80px (borders included in box-sizing)

**Fail Indicators**:
- Scrollbars appear
- Dimensions exceed 240x80px
- Content overflows container

---

#### Test 1.2: 3-Column Layout
**Steps**:
1. Inspect `.identity-column`, `.chart-column`, `.stats-column`

**Expected**:
```
.identity-column: width: 85px
.chart-column: width: 37.5px
.stats-column: flex: 1 (computed: 117.5px)
Total: 85 + 37.5 + 117.5 = 240px
```

**Pass Criteria**: Flex layout matches specification exactly

**Fail Indicators**:
- Columns don't add up to 240px
- Flex items overlapping
- Incorrect width on any column

---

#### Test 1.3: Market Profile Aspect Ratio
**Steps**:
1. Inspect `.chart-canvas`
2. Verify canvas dimensions

**Expected**:
```
CSS width: 37.5px
CSS height: 60px
Aspect ratio: 60 / 37.5 = 1.6
```

**Pass Criteria**: Aspect ratio exactly 1.6:1 (Height:Width)

**Fail Indicators**:
- Canvas height not 60px
- Canvas width not 37.5px
- Profile rendering distorted

---

### Phase 2: Data Integration (Critical)

#### Test 2.1: Real-Time Price Updates
**Steps**:
1. Create ticker for active symbol (e.g., EURUSD)
2. Monitor Console for `[PriceTicker]` logs
3. Wait for tick updates (should arrive within 1-2 seconds)

**Expected**:
- Current price updates in real-time
- Price formatting matches pipPosition (e.g., 1.08512 for EURUSD)
- No console errors

**Pass Criteria**: Price updates without layout shift

**Fail Indicators**:
- Price not updating
- Layout shifts during updates
- Console errors from WebSocket

---

#### Test 2.2: Session Statistics
**Steps**:
1. Check High/Low/Range% values
2. Compare with main FloatingDisplay for same symbol

**Expected**:
- High matches FloatingDisplay high
- Low matches FloatingDisplay low
- Range% calculation: `((high - low) / (adrHigh - adrLow)) * 100`

**Pass Criteria**: All statistics accurate to 4 decimal places

**Fail Indicators**:
- Statistics don't match FloatingDisplay
- Range% calculation incorrect
- Values showing as "..." (loading state persists)

---

#### Test 2.3: Market Profile Integration
**Steps**:
1. Inspect mini profile canvas
2. Verify POC line (yellow) at highest TPO level
3. Compare with main FloatingDisplay profile

**Expected**:
- Profile bars render with green intensity gradient
- POC line matches main display's POC price
- Profile shape matches (scaled down)

**Pass Criteria**: Mini profile accurately represents main profile

**Fail Indicators**:
- Canvas blank or shows error
- POC line missing or incorrect
- Profile shape doesn't match main display

---

### Phase 3: Keyboard Shortcuts (Critical)

#### Test 3.1: Alt+I Creation
**Steps**:
1. Ensure workspace has focus (click anywhere)
2. Press `Alt+I`
3. Enter symbol in prompt: `GBPUSD`

**Expected**:
- Prompt appears: "Enter symbol for Price Ticker:"
- After entering symbol, ticker appears in workspace
- Ticker has default position (100, 100)

**Pass Criteria**: Keyboard shortcut creates ticker correctly

**Fail Indicators**:
- Prompt doesn't appear
- Symbol not sanitized (spaces, lowercase)
- Ticker not created in workspace store

---

#### Test 3.2: Keyboard Shortcut Conflicts
**Steps**:
1. Test all other shortcuts: Alt+A, Alt+B, Alt+T, Alt+R
2. Verify Alt+I doesn't conflict

**Expected**:
- Each shortcut works independently
- Alt+I only creates ticker, doesn't trigger other actions

**Pass Criteria**: No keyboard conflicts

**Fail Indicators**:
- Alt+I triggers multiple actions
- Other shortcuts broken

---

### Phase 4: Visual Fidelity (Important)

#### Test 4.1: Tabular Nums (Monospaced)
**Steps**:
1. Observe price updates (should change frequently)
2. Watch for horizontal jitter

**Expected**:
- Digits align vertically during updates
- No horizontal movement when digit count changes
- Font: monospace with `font-variant-numeric: tabular-nums`

**Pass Criteria**: Zero horizontal jitter during updates

**Fail Indicators**:
- Price field shifts left/right
- Statistics reflow on value changes

---

#### Test 4.2: Direction Indicator
**Steps**:
1. Wait for price direction change
2. Observe arrow (↑↓→) and color

**Expected**:
```
Price up: ↑ green, +12.3 pips
Price down: ↓ red, -8.7 pips
Neutral: → gray, 0.0 pips
```

**Pass Criteria**: Direction matches price movement

**Fail Indicators**:
- Wrong arrow for direction
- Color coding incorrect
- Pip calculation wrong

---

#### Test 4.3: Loading States
**Steps**:
1. Create ticker for symbol with no data
2. Observe placeholder state

**Expected**:
- Price shows "..." (italic gray)
- Statistics show "..."
- Canvas shows empty background

**Pass Criteria**: Graceful loading state

**Fail Indicators**:
- Blank fields
- "undefined" or "null" text
- Console errors

---

### Phase 5: Interaction (Important)

#### Test 5.1: Drag & Drop
**Steps**:
1. Click and hold ticker
2. Drag to new position
3. Release

**Expected**:
- Ticker follows cursor smoothly
- Position updates in workspace store
- No lag or jitter

**Pass Criteria**: Drag works like FloatingDisplay

**Fail Indicators**:
- Can't drag ticker
- Position not saved
- Drag behavior different from FloatingDisplay

---

#### Test 5.2: Z-Index Stacking
**Steps**:
1. Create multiple tickers
2. Click each ticker to bring to front

**Expected**:
- Clicked ticker moves to top
- Other tickers below in creation order

**Pass Criteria**: Z-index management consistent

**Fail Indicators**:
- Click doesn't bring to front
- Z-index not updating

---

#### Test 5.3: Close Button
**Steps**:
1. Hover over ticker
2. Click × button (top-right)

**Expected**:
- Ticker removed from workspace
- Store updated (entry deleted)
- No memory leaks (check DevTools Memory)

**Pass Criteria**: Clean removal

**Fail Indicators**:
- Button not visible on hover
- Click doesn't close ticker
- Console errors on removal

---

### Phase 6: Edge Cases (Important)

#### Test 6.1: Missing Data
**Steps**:
1. Disconnect WebSocket (kill backend)
2. Observe ticker behavior
3. Reconnect backend

**Expected**:
- Ticker shows last known values
- No "undefined" errors
- Reconnect resumes updates

**Pass Criteria**: Graceful degradation

**Fail Indicators**:
- Ticker crashes
- Shows "undefined" everywhere
- Doesn't recover on reconnect

---

#### Test 6.2: Symbol with Different Pip Position
**Steps**:
1. Create ticker for XAUUSD (gold, pipPosition=1)
2. Verify price formatting

**Expected**:
- Price shows 2 decimal places: 2034.50
- Pip calculation uses correct divisor

**Pass Criteria**: Formatting adapts to pipPosition

**Fail Indicators**:
- Wrong decimal places
- Pip movement calculation wrong

---

#### Test 6.3: Rapid Creation/Deletion
**Steps**:
1. Press Alt+I rapidly (10 times in 5 seconds)
2. Close all tickers rapidly

**Expected**:
- All tickers created correctly
- No memory leaks
- No console errors

**Pass Criteria**: Handles rapid operations

**Fail Indicators**:
- Browser slows down
- Memory usage climbs
- ID collisions

---

### Phase 7: Performance (Nice-to-Have)

#### Test 7.1: Render Time
**Steps**:
1. Open Chrome DevTools Performance tab
2. Record while creating ticker
3. Analyze "Initial Render" timeline

**Expected**:
- Script execution <16ms (60fps)
- No long tasks (>50ms)
- No forced reflows

**Pass Criteria**: Smooth creation

**Fail Indicators**:
- Main thread blocked >50ms
- Multiple layout recalculations

---

#### Test 7.2: Update Frequency
**Steps**:
1. Monitor update frequency during active trading
2. Count price updates per second

**Expected**:
- Updates match WebSocket tick rate
- No dropped updates
- No duplicate renders

**Pass Criteria**: Efficient updates

**Fail Indicators**:
- Updates lag behind WebSocket
- Excessive re-renders

---

## Automated Tests (Future)

### Unit Tests
```javascript
describe('PriceTicker', () => {
  it('renders at 240x80px', () => {
    const { container } = render(PriceTicker, { props: { ticker } });
    expect(container).toHaveStyle({ width: '240px', height: '80px' });
  });

  it('calculates range percentage correctly', () => {
    const data = { high: 1.0900, low: 1.0800, adrHigh: 1.0950, adrLow: 1.0750 };
    expect(calculateDayRangePercentage(data)).toBe('50.0');
  });
});
```

### Integration Tests
```javascript
test('Alt+I creates ticker with correct data', async ({ page }) => {
  await page.keyboard.press('Alt+I');
  await page.fill('symbol', 'EURUSD');
  await page.press('Enter');

  const ticker = page.locator('[data-ticker-id]');
  await expect(ticker).toBeVisible();
  await expect(ticker).toHaveCSS({ width: '240px', height: '80px' });
});
```

---

## Debugging Commands

### Console API
```javascript
// Get all tickers
window.workspaceStore.getState().displays.forEach((d, id) => {
  if (d.type === 'priceTicker') console.log(d);
});

// Manually create ticker
window.workspaceActions.addPriceTicker('USDJPY');

// Check WebSocket connection
window.connectionManager?.status
```

### Reactivity Debugging
```javascript
// In PriceTicker.svelte, add:
$: console.log('[PriceTicker] lastData updated:', lastData?.current);
```

---

## Success Criteria Summary

| Criterion | Pass/Fail | Notes |
|-----------|-----------|-------|
| Renders at 240x80px | [ ] | DevTools inspection |
| 3-column layout accurate | [ ] | Column widths match spec |
| 1:1.6 aspect ratio | [ ] | Canvas 37.5px × 60px |
| Real-time updates | [ ] | Price changes within 1s |
| Alt+I shortcut | [ ] | Creates ticker correctly |
| No layout shift | [ ] | Tabular nums working |
| Data integration | [ ] | Matches FloatingDisplay |
| Performance <16ms | [ ] | Smooth rendering |

**Overall Status**: [ ] PASS / [ ] FAIL

---

## Issue Template

If test fails, document:

```markdown
### Issue: [Test Name]

**Observed**: What actually happened

**Expected**: What should happen

**Steps**: How to reproduce

**Screenshots**: DevTools screenshots

**Console**: Copy any errors

**Environment**: Browser, DPR, WebSocket status
```
