# ADR: WebSocket Symbol Error Fix

## Status
Proposed - 2025-12-18

## Executive Summary
WebSocketServer.js sends error messages without the `symbol` field, causing undefined symbol propagation in connectionManager logs. While the status display correctly shows "CONNECTED: AUDUSD", error logs display confusion due to missing symbol context.

## Root Cause Analysis
1. **WebSocketServer.js line 82**: Error messages sent without symbol field
2. **WebSocketServer.js line 90**: Symbol validation error missing symbol
3. **WebSocketServer.js line 133**: Data package error missing symbol
4. **connectionManager.js line 30-44**: Attempts to log undefined symbols

## Crystal Clarity Violations
- **Files exceed 120 lines**: WebSocketServer.js (189 lines), connectionManager.js (132 lines)
- **Functions exceed 15 lines**: handleMessage (29 lines), connectionManager.onmessage (22 lines)
- **Framework violations**: Custom error handling instead of native WebSocket patterns
- **Over-engineering**: Error messages go through subscription lookup unnecessarily

## Solution Approaches (Ranked by Simplicity)

### Solution 1: Minimal Fix (Framework-First)
**Approach**: Add symbol field to error messages only

**Code Changes**:
```javascript
// WebSocketServer.js line 82
this.sendToClient(ws, { type: 'error', symbol: symbolName || 'unknown', message: 'Invalid message format.' });

// WebSocketServer.js line 90
return this.sendToClient(ws, { type: 'error', symbol: symbolName, message: `Invalid symbol: ${symbolName}` });

// WebSocketServer.js line 133
this.sendToClient(ws, { type: 'error', symbol: symbolName, message: `Failed to get data for ${symbolName}: ${error.message}` });
```

**Crystal Clarity Impact**:
- ✅ Maintains existing structure
- ❌ No reduction in file/function size
- ✅ Zero performance impact
- ✅ Immediate fix for logging confusion

**Implementation**: 3 lines changed, 5 minutes

### Solution 2: Extract Error Handler (Simple Refactor)
**Approach**: Extract error handling to dedicated method under 15 lines

**Code Changes**:
```javascript
// Add to WebSocketServer.js (lines 157-161)
sendError(ws, symbol, message) {
  this.sendToClient(ws, { type: 'error', symbol: symbol || 'unknown', message });
}

// Replace error sends with:
this.sendError(ws, symbolName, 'Invalid message format.');
this.sendError(ws, symbolName, `Invalid symbol: ${symbolName}`);
this.sendError(ws, symbolName, `Failed to get data for ${symbolName}: ${error.message}`);
```

**Crystal Clarity Impact**:
- ✅ Reusable error handling
- ✅ Consistent error format
- ✅ Small step toward line reduction
- ❌ Still over 120 lines total

**Implementation**: Add 4-line method, update 3 calls, 10 minutes

### Solution 3: Crystal Clarity Compliance (Full Refactor)
**Approach**: Split WebSocketServer into focused components under 120/15 line limits

**Code Changes**:
1. **Extract MessageHandler.js** (< 100 lines):
```javascript
// handleMessage method split into:
- validateMessage() (5 lines)
- routeMessage() (8 lines)
- handleSubscribe() (10 lines)
- handleUnsubscribe() (5 lines)
```

2. **Extract ErrorHandler.js** (< 50 lines):
```javascript
// Centralized error handling with symbol context
- sendError() (4 lines)
- logError() (3 lines)
- formatErrorMessage() (5 lines)
```

3. **Reduce WebSocketServer.js** to < 120 lines:
- Core connection management only
- Event handling delegation
- Broadcast coordination

**Crystal Clarity Impact**:
- ✅ Full compliance with <120/<15 line limits
- ✅ Single responsibility per file
- ✅ Framework-first error handling
- ✅ 99% complexity reduction maintained
- ✅ Testable components

**Implementation**: 3 new files, refactor existing, 45 minutes

## Recommendation
**Implement Solution 1 immediately** for quick fix, **follow with Solution 3** within next sprint for full Crystal Clarity compliance.

## Verification Methods
1. Send invalid message format → Check error log includes symbol
2. Request invalid symbol → Verify error shows symbol name
3. Trigger data package error → Confirm symbol in error message
4. Monitor connectionManager logs → No undefined symbols
5. Verify status display still works correctly

## Next Steps
1. Apply Solution 1 changes
2. Test error scenarios
3. Plan Solution 3 implementation
4. Update documentation
5. Monitor production logs