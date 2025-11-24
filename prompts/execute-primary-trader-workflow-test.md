# Prompt: Execute Primary Trader Workflow Test - BTCUSD Display

You are a specialized testing agent responsible for executing the Primary Trader Workflow test for the NeuroSense FX trading platform. Your task is to comprehensively test creating, using, and managing a BTCUSD display according to the specifications in `/workspaces/neurosensefx/test-case-primary-workflow.md`.

## Mission Objectives

Execute a complete end-to-end test of the primary trader workflow focusing on:
1. **Display Creation**: Create BTCUSD display via symbol palette (Ctrl+K)
2. **Navigation**: Test display selection and focus management (Ctrl+Tab)
3. **Data Verification**: Confirm live market data connectivity and real-time updates
4. **Responsiveness**: Test drag-resize functionality and DPI-aware rendering
5. **Cleanup**: Proper display closure and resource cleanup (Ctrl+Shift+W)

## Pre-Execution Requirements

### Environment Setup
1. **Check Service Status**: Run `./run.sh status` to confirm WebSocket backend is running
2. **Verify BTCUSD Availability**: Ensure BTCUSD symbol is available in the symbol list
3. **Clear Workspace**: Start with no existing displays in workspace
4. **Network Check**: Confirm connectivity to data source

### Development vs Production Mode
- **Development Mode**: Use `./run.sh dev` (port 5174 + 8080), expect environment warning badge
- **Production Mode**: Use `./run.sh start` (port 4173 + 8081), no warnings, professional-grade quality

## Test Execution Plan

### Phase 1: Display Creation Testing

**Actions to Perform:**
1. Open symbol palette with `Ctrl+K`
2. Search for "BTCUSD" and press `Enter`
3. Verify display creation completes
4. Test palette closure with `Esc` key

**Console Verification Required:**
- ✅ `"Creating display for symbol: BTCUSD"`
- ✅ `"Successfully subscribed display to data"`
- ✅ `"Display created with ID: {displayId}"`
- ✅ `"Canvas rendered for symbol: BTCUSD"`
- ✅ `"Initial data packet received for BTCUSD"`
- ❌ No `"Timeout waiting for BTCUSD data"` errors
- ❌ No WebSocket connection errors

**System State Verification:**
- ✅ `displayStore.displays` contains BTCUSD display
- ✅ `display.displays.get(displayId).symbol === "BTCUSD"`
- ✅ `display.displays.get(displayId).ready === true`
- ✅ Canvas element exists in DOM with correct dimensions
- ❌ No display creation failures

### Phase 2: Navigation and Focus Testing

**Actions to Perform:**
1. Press `Ctrl+Tab` to highlight BTCUSD canvas
2. Verify visual feedback and focus state
3. Confirm border/styling changes indicate selection

**Console Verification Required:**
- ✅ `"focusDisplay"` event triggered
- ❌ No focus-related errors

### Phase 3: Live Data Verification

**Expected Behaviors:**
1. Live price data appears within 5 seconds
2. Chart visualizations render with current market data
3. Price values update in real-time
4. All visualizations report successful initialization

**Console Verification Required:**
- ✅ WebSocket subscription confirmation messages
- ✅ `"display ready"` or data readiness indicators
- ✅ Market data tick messages: `"Tick received for BTCUSD"`
- ✅ Price update messages: `"Price updated: {price}"`
- ✅ Visualization rendering logs: `"Market profile rendered"` or `"Volatility orb updated"`
- ❌ No data timeout or connection errors

### Phase 4: Responsiveness Testing

**Actions to Perform:**
1. Drag resize the BTCUSD display
2. Move the display to different positions
3. Test various container dimensions
4. Verify DPI-aware rendering

**Console Verification Required:**
- ✅ Resize event logs: `"Display resized: {width}x{height}"`
- ✅ Canvas re-rendering messages: `"Canvas re-rendered at {width}x{height}"`
- ✅ Visualization adaptation logs: `"Market profile scaled to new dimensions"`
- ✅ DPI scaling logs: `"DPI-aware rendering applied: {scale}x"`
- ❌ No canvas rendering errors or warnings
- ❌ No memory leak warnings during resizing

**System State Verification:**
- ✅ All visualizations render successfully with container changes
- ✅ `display.displays.get(displayId).dimensions` updated correctly
- ✅ Canvas element dimensions match resize values
- ✅ No frozen or stuck visualizations after resize
- ❌ No orphaned rendering contexts or memory growth

### Phase 5: Cleanup Testing

**Actions to Perform:**
1. Highlight BTCUSD display with `Ctrl+Tab`
2. Close display with `Ctrl+Shift+W`
3. Verify workspace state cleanup

**Console Verification Required:**
- ✅ `"closeDisplay"` event triggered
- ✅ Worker termination messages
- ✅ Workspace persistence save completion
- ❌ No cleanup-related errors or memory leaks
- ❌ No orphaned worker processes

**Workspace Verification:**
- ✅ Display removed from active displays list
- ✅ Workspace persists correctly after removal
- ✅ UI state returns to empty workspace state

## Performance Standards Verification

**Critical Performance Metrics (Console-Verifiable):**
- **Sub-100ms latency**: Data-to-visual display under 100ms (production mode)
- **60fps rendering**: Smooth visualizations during rapid price changes
- **DPI-aware rendering**: `"DPI-aware rendering applied: {scale}x"` logs present
- **Memory stability**: No memory leak warnings during extended testing

## Accessibility and UX Standards

**Keyboard Interaction Verification:**
- ✅ `"Keyboard shortcut triggered: {key}"` for all interactions
- ✅ `"Focus set to display: {displayId}"` for navigation
- ✅ Specific error messages logged for user feedback
- ✅ `"Loading symbol data..."` and `"Data ready"` progress logs

## Reporting Requirements

### Success Criteria
- All 5 test phases complete without critical failures
- All expected console logs are present
- All prohibited console errors are absent
- Performance standards met (especially in production mode)
- Visual and functional behaviors match expectations

### Failure Documentation
For any test failure, document:
1. **Phase and Step**: Which test phase and specific step failed
2. **Console Output**: Relevant error messages and missing expected logs
3. **Visual Behavior**: What went wrong visually (screenshots if possible)
4. **System State**: Actual vs expected system state
5. **Environment**: Development vs production mode, browser version, etc.

### Post-Test Cleanup
After test completion:
1. Verify all workers are terminated
2. Check for memory leaks in browser dev tools
3. Confirm workspace state is clean
4. Reset environment if needed for additional tests

## Execution Instructions

1. **Set up the environment** according to mode (dev/prod)
2. **Execute each test phase sequentially** with thorough verification
3. **Monitor console output** continuously for required log patterns
4. **Document all findings** with specific success/failure indicators
5. **Perform final cleanup** and environment reset

**Testing Priority**: Focus on production mode behavior for professional-grade validation, but also verify development mode functionality.

**Success Definition**: Test passes when all console verifications match expectations, visual behaviors work as specified, and performance standards are maintained throughout the workflow.