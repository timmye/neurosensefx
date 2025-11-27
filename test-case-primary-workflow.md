# Test: Primary Trader workflow - Create and Use a BTCUSD display

## Prerequisites

**Environment Requirements:**
- WebSocket backend running (confirm with `./run.sh status`) (? confirm)
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

### 2. Navigate and Verify Display Selection

**Action:**
Press `Ctrl+Tab` to highlight the BTCUSD canvas, showing it's selected.

**Expected:**
- The BTCUSD canvas is visually highlighted as the active element
- Visual feedback indicates focused display state
- Canvas border or styling changes to indicate selection

### 3. Verify Data Connection and Live Updates

**Action:**
Wait for data initialization and observe price updates.

**Expected:**
- Live price data appears within 5 seconds of display creation
- Chart visualizations render with current market data
- Price values update in real-time
- All visualisations report succesful intialisation, bounds and redering update

### 4. Test Display Responsiveness

**Action:**
Drag resize and move the BTCUSD display to test responsiveness.

**Expected:**
- The canvas is rendered with all expected visualisations responsive to container changes
- The data is live and is not a placeholder/error state
- Chart content scales smoothly and correctly to fit new dimensions
- No breaking or unreadable content during resize

### 5. Close the Display

**Action:**
With BTCUSD display highlighted, type `Ctrl+Shift+W` to close the display.

**Expected:**
- The BTCUSD chart disappears from workspace
- Worker cleanup completes properly
- Workspace state updates correctly

---


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