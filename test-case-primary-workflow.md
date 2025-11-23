# Test: Primary Trader workflow - Create and Use a BTCUSD display

## Prerequisites

**Environment Requirements:**
- WebSocket backend running (confirm with `./run.sh status`)
- BTCUSD symbol available in symbol list
- No existing displays in workspace
- Network connectivity to data source

**For Development:**
- Standard startup procedure: `./run.sh dev`
- Expect environment warning badge
- Live market data expected

**For Production:**
- Standard startup procedure: `./run.sh start`
- Live market data expected
- Sub-100ms latency from data to visual display

---

## Test Steps

### 1. Create BTCUSD Display via Symbol Palette

**Action:**
1. Press `Ctrl+K`. The symbol palette should show with search box text input focused.
2. Type `BTCUSD` and hit `Enter`. A new BTCUSD chart should appear.
3. Press `Esc`. Text box clears. Press `Esc` again, symbol palette closes.

**Expected:**
- Live data and all visualisations initialise correctly
- Symbol palette focuses search input immediately when opened
- Search results show BTCUSD as selectable option
- Display creation completes without errors

**Console Verification:**
- ✓ `"Creating display for symbol: BTCUSD"`
- ✓ `"Successfully subscribed display to data"`
- ✓ `"Display created with ID: {displayId}"`
- ✓ `"Canvas rendered for symbol: BTCUSD"`
- ✓ `"Initial data packet received for BTCUSD"`
- ✗ No `"Timeout waiting for BTCUSD data"` errors
- ✗ No WebSocket connection errors

**System State Verification:**
- ✓ `displayStore.displays` contains new BTCUSD display entry
- ✓ `display.displays.get(displayId).symbol === "BTCUSD"`
- ✓ `display.displays.get(displayId).ready === true`
- ✓ Canvas element exists in DOM with correct dimensions
- ✗ No display creation failures in system state

### 2. Navigate and Verify Display Selection

**Action:**
Press `Ctrl+Tab` to highlight the BTCUSD canvas, showing it's selected.

**Expected:**
- The BTCUSD canvas is visually highlighted as the active element
- Visual feedback indicates focused display state
- Canvas border or styling changes to indicate selection

**Console Verification:**
- ✓ `"focusDisplay"` event triggered
- ✗ No focus-related errors

### 3. Verify Data Connection and Live Updates

**Action:**
Wait for data initialization and observe price updates.

**Expected:**
- Live price data appears within 5 seconds of display creation
- Chart visualizations render with current market data
- Price values update in real-time
- All visualisations report succesful intialisation, bounds and redering update

**Console Verification:**
- ✓ WebSocket subscription confirmation messages
- ✓ `"display ready"` or similar data readiness indicators
- ✓ Market data tick messages arriving: `"Tick received for BTCUSD"`
- ✓ Price update messages: `"Price updated: {price}"`
- ✓ Visualization rendering logs: `"Market profile rendered"` or `"Volatility orb updated"`
- ✗ No data timeout or connection errors


### 4. Test Display Responsiveness

**Action:**
Drag resize and move the BTCUSD display to test responsiveness.

**Expected:**
- The canvas is rendered with all expected visualisations responsive to container changes
- The data is live and is not a placeholder/error state
- Chart content scales smoothly and correctly to fit new dimensions
- No breaking or unreadable content during resize

**Console Verification:**
- ✓ Resize event logs: `"Display resized: {width}x{height}"`
- ✓ Canvas re-rendering messages: `"Canvas re-rendered at {width}x{height}"`
- ✓ Visualization adaptation logs: `"Market profile scaled to new dimensions"`
- ✓ DPI scaling logs: `"DPI-aware rendering applied: {scale}x"`
- ✗ No canvas rendering errors or warnings
- ✗ No memory leak warnings during extended resizing

**System State Verification:**
- ✓ All vislualisations: Succesful rendering with conatiner changes
- ✓ `display.displays.get(displayId).dimensions` updated correctly
- ✓ Canvas element dimensions match expected resize values
- ✓ No frozen or stuck visualizations after resize
- ✗ No orphaned rendering contexts or memory growth

### 5. Close the Display

**Action:**
With BTCUSD display highlighted, type `Ctrl+Shift+W` to close the display.

**Expected:**
- The BTCUSD chart disappears from workspace
- Worker cleanup completes properly
- Workspace state updates correctly

**Console Verification:**
- ✓ `"closeDisplay"` event triggered
- ✓ Worker termination messages
- ✓ Workspace persistence save completion
- ✗ No cleanup-related errors or memory leaks
- ✗ No orphaned worker processes

**Workspace Verification:**
- ✓ Display removed from active displays list
- ✓ Workspace persists correctly after display removal
- ✓ UI state returns to empty workspace state

---

## Additional Verification Criteria

### **Console Log Patterns to Check For:**

### **Performance Standards (Console-Verifiable):**
- **DPI rendering logs**: `"DPI-aware rendering applied: {scale}x"` for crisp text
- **Memory monitoring**: No memory leak warnings during testing
- **Resize responsiveness**: All visualizations log successful scaling events

### **Accessibility and UX Standards (Console-Verifiable):**
- **Keyboard events**: Console logs `"Keyboard shortcut triggered: {key}"` for all interactions
- **Focus management**: `"Focus set to display: {displayId}"` logs for navigation
- **Error handling**: Specific error messages logged for user feedback
- **Loading states**: `"Loading symbol data..."` and `"Data ready"` progress logs

### **Environment-Specific Behavior:**

**Development Mode:**
- Environment warning badge visible
- Debug console messages present
- Live market data required


**Production Mode:**
- No environment warnings
- Live market data required
- Performance standards must be met
- Professional-grade visual quality expected

---

## Cleanup and Reset

After test completion:
1. Verify all workers are terminated
2. Check for memory leaks in browser dev tools
3. Confirm workspace state is clean
4. Reset environment if needed for additional tests

---