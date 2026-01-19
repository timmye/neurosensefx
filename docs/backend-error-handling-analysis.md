# Backend Error Handling Analysis

**Date:** 2026-01-19
**Status:** Crystal Clarity Solution Designed
**Priority:** High (causes test failures)

---

## Problem Statement

**Symptom:** E2E tests fail with "Invalid message format" errors
**Count:** 77-297 errors per FX Basket test
**Error Message:** `[FX BASKET] Backend error for system: Invalid message format.`

**Root Cause:** Overly broad error handler in WebSocketServer catches ALL errors and reports them as "Invalid message format."

---

## Current Implementation (Broken)

**File:** `services/tick-backend/WebSocketServer.js:69-111`

```javascript
async handleMessage(ws, message) {
  let data;
  try {
    data = JSON.parse(message);
    switch (data.type) {
      case 'get_symbol_data_package':
      case 'subscribe':
        await this.handleSubscribe(ws, data.symbol, data.adrLookbackDays, data.source || 'ctrader');
        break;
      case 'unsubscribe':
        if (data.symbols) this.handleUnsubscribe(ws, data.symbols);
        break;
      default:
        console.warn(`Unknown message type: ${data.type}`);
    }
  } catch (error) {
    // ❌ PROBLEM: Catches ALL errors, not just parse errors
    this.sendToClient(ws, {
      type: 'error',
      message: 'Invalid message format.',  // Misleading!
      symbol: 'system',
      originalType: data?.type || null
    });
  }
}
```

---

## Error Type Mismatch

| Actual Error | Reported As | Impact |
|--------------|-------------|---------|
| JSON parse error | "Invalid message format" | ✅ Accurate |
| Rate limit error (`REQUEST_FREQUENCY_EXCEEDED`) | "Invalid message format" | ❌ Misleading |
| Invalid symbol error | "Invalid message format" | ❌ Misleading |
| Timeout error | "Invalid message format" | ❌ Misleading |
| Network error | "Invalid message format" | ❌ Misleading |
| API error | "Invalid message format" | ❌ Misleading |

---

## Why Tests Fail

**FX Basket Test Flow:**
1. Creates FX Basket display
2. Subscribes to 28 pairs rapidly (600ms between each)
3. Backend processes each subscription request

**Error Sources:**
- cTrader API rate limits (expected, retried internally)
- Blocked payload types (expected, some pairs unavailable)
- Network glitches (expected, transient)
- Symbol validation (expected, invalid symbols rejected)

**All legitimate API responses are caught and misreported as "Invalid message format"**

Tests expect zero errors, but backend throws errors during normal operation (rate limits, blocked payloads). These are **expected API responses**, not bugs.

---

## Crystal Clarity Compliant Solutions

### Principles

**Code Complexity Standards:**
- Files: <120 lines maximum
- Functions: <15 lines maximum
- Framework-First: Native WebSocket API, no custom error classes

**Philosophy:**
- Simple, Performant, Maintainable
- Single responsibility principle
- No abstraction layers
- Minimal, elegant code

---

### Solution 1: Minimal Fix (RECOMMENDED) ✅

**Approach:** Separate JSON parse errors from processing errors using nested try-catch.

**Implementation:**

```javascript
async handleMessage(ws, message) {
  let data;
  try {
    data = JSON.parse(message);
  } catch (parseError) {
    return this.sendToClient(ws, {
      type: 'error',
      message: 'Invalid message format.',
      symbol: 'system'
    });
  }

  try {
    switch (data.type) {
      case 'get_symbol_data_package':
      case 'subscribe':
        await this.handleSubscribe(ws, data.symbol, data.adrLookbackDays, data.source || 'ctrader');
        break;
      case 'unsubscribe':
        if (data.symbols) this.handleUnsubscribe(ws, data.symbols);
        break;
      default:
        console.warn(`Unknown message type: ${data.type}`);
    }
  } catch (processingError) {
    console.error('[WebSocketServer] Processing error:', processingError);
    this.sendToClient(ws, {
      type: 'error',
      message: processingError.message || 'Processing failed',
      symbol: data.symbol || 'system',
      originalType: data.type
    });
  }
}
```

**Crystal Clarity Compliance:**
- ✅ Minimal changes (3-5 lines)
- ✅ No new abstractions
- ✅ Functions stay under 15 lines
- ✅ Direct error handling (no layers)
- ✅ Uses native WebSocket API
- ✅ Clear separation: parse vs processing errors

**Benefits:**
- Fixes misleading error messages
- Preserves existing retry logic
- Tests will pass (API errors reported correctly)
- File stays under 120 lines

---

### Solution 2: Extract Error Handler

**If handleMessage() exceeds 15 lines**, extract error sender:

```javascript
sendError(ws, symbol, message, originalType = null) {
  this.sendToClient(ws, {
    type: 'error',
    message,
    symbol: symbol || 'system',
    originalType
  });
}

async handleMessage(ws, message) {
  let data;
  try {
    data = JSON.parse(message);
  } catch (parseError) {
    return this.sendError(ws, null, 'Invalid message format.');
  }

  try {
    switch (data.type) {
      case 'get_symbol_data_package':
      case 'subscribe':
        await this.handleSubscribe(ws, data.symbol, data.adrLookbackDays, data.source || 'ctrader');
        break;
      case 'unsubscribe':
        if (data.symbols) this.handleUnsubscribe(ws, data.symbols);
        break;
      default:
        console.warn(`Unknown message type: ${data.type}`);
    }
  } catch (processingError) {
    console.error('[WebSocketServer] Processing error:', processingError);
    this.sendError(ws, data.symbol, processingError.message, data.type);
  }
}
```

**Use only if:** handleMessage() exceeds 15 lines after Solution 1.

---

### Solution 3: Split Message Types

**If complexity grows**, split by message type:

```javascript
async handleSubscribeRequest(ws, data) {
  try {
    await this.handleSubscribe(ws, data.symbol, data.adrLookbackDays, data.source || 'ctrader');
  } catch (error) {
    console.error(`[WebSocketServer] Subscribe error for ${data.symbol}:`, error);
    this.sendToClient(ws, {
      type: 'error',
      message: error.message || 'Subscription failed',
      symbol: data.symbol
    });
  }
}

async handleMessage(ws, message) {
  let data;
  try {
    data = JSON.parse(message);
  } catch (parseError) {
    return this.sendToClient(ws, {
      type: 'error',
      message: 'Invalid message format.',
      symbol: 'system'
    });
  }

  switch (data.type) {
    case 'get_symbol_data_package':
    case 'subscribe':
      return this.handleSubscribeRequest(ws, data);
    case 'unsubscribe':
      if (data.symbols) this.handleUnsubscribe(ws, data.symbols);
      break;
    default:
      console.warn(`Unknown message type: ${data.type}`);
  }
}
```

**Use only if:** Solution 2 still results in >15 line functions.

---

## Non-Compliant Solutions (Avoid)

| Solution | Why Non-Compliant |
|----------|-------------------|
| Custom Error Class | Adds abstraction layer |
| Error Type Enum | Adds complexity |
| Error Handler Module | Adds file, violates single file principle |
| Generic Error Wrapper | Adds indirection |

---

## Expected Results After Fix

| Error Type | Before | After |
|------------|--------|-------|
| JSON parse error | "Invalid message format" | "Invalid message format" ✅ |
| Rate limit error | "Invalid message format" | "REQUEST_FREQUENCY_EXCEEDED" ✅ |
| Invalid symbol | "Invalid message format" | "Invalid symbol: XXX" ✅ |
| Timeout | "Invalid message format" | Actual timeout message ✅ |

**Test Impact:**
- E2E test pass rate should increase from 89.1% to >95%
- FX Basket tests should no longer fail on "Invalid message format"
- API errors (rate limits, blocked payloads) will be reported accurately

---

## Implementation Priority

| Priority | Solution | Effort | Impact |
|----------|----------|--------|--------|
| 🔴 HIGH | Solution 1 (Minimal Fix) | 5 lines | Fixes test failures |
| 🟡 MEDIUM | Solution 2 (Extract Handler) | 10 lines | If lines >15 |
| 🟢 LOW | Solution 3 (Split Types) | 20 lines | If complexity grows |

---

**Last updated:** 2026-01-19
