# FX Basket Zero-Tolerance Design

**Date**: 2026-01-15
**Status**: Design Complete - Ready for Implementation
**Principle**: Fail-Closed - NO inaccurate data shall be displayed

---

## Executive Summary

All previous "fixes" were **patch jobs** on a fundamentally flawed design:
- 50% threshold → Race condition (852% variance)
- 80% timeout fallback → Still allows 20% data loss (INACCURATE)
- 100% threshold → But what if a pair never arrives? (No answer)

**This design implements ZERO tolerance for incomplete data through a fail-closed state machine.**

---

## The Core Problem: Patch Jobs on Patch Jobs

### History of Failed Attempts

```
ORIGINAL DESIGN (Flawed from start):
├─> 50% threshold
├─> Race condition (852% variance)
└─> Fundamentally broken

FIX ATTEMPT 1 (Complete-Set):
├─> Wait for 100% of pairs
├─> But: 15s timeout with 80% fallback
└─> STILL allows inaccurate results (20% data loss)

FIX ATTEMPT 2 (80% Minimum):
├─> Added minimum coverage check
├─> But: Still initializes at 80%
└─> STILL allows inaccurate results (20% data loss)

USER REQUIREMENT:
"NO coverage tolerance - cannot have inaccuracy due to implementation laziness"
```

### The Fundamental Flaw

Every previous approach tried to make **partial data work**:
- "50% is good enough"
- "80% is good enough"
- "95% is good enough"
- "80% with timeout is acceptable"

**But for financial calculations, partial data = WRONG data.**

---

## Zero-Tolerance Design

### Core Principle

**FAIL-CLOSED**: The system MUST NOT display basket values unless ALL data is confirmed valid.

### State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FX BASKET ZERO-TOLERANCE STATE MACHINE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [FAILED] ──────► Initial state (no data received)                          │
│     │                                                                       │
│     ▼                                                                       │
│  [WAITING] ◄────────────────────────────────────────────────────────────┐   │
│     │                                                                    │   │
│     │ Message arrives:                                                    │   │
│     │ ├─> Validate data (NaN/Infinity/zero check)                         │   │
│     │ ├─> Track received pairs                                            │   │
│     │ ├─> Start 15s timeout on first pair                                │   │
│     │ └─> Update UI: "Initializing... (X/30 pairs)"                       │   │
│     │                                                                    │   │
│     │ Conditions:                                                         │   │
│     │ ├─> 100% coverage + all valid → [READY]                             │   │
│     │ └─> Timeout with <100% → [ERROR]                                   │   │
│     │                                                                    │   │
│  [READY]                                                                  │   │
│     │                                                                      │   │
│     │ All 30 pairs received and validated                                  │   │
│     │ Display basket values with 100% confidence                          │   │
│     │                                                                      │   │
│  [ERROR]                                                                  │   │
│     │                                                                      │   │
│     │ Timeout fires with insufficient data                                 │   │
│     │ Display: "Unable to initialize - missing X pairs: [list]"            │   │
│     │ Show "Retry" button                                                  │   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Rules

| Rule | Description |
|------|-------------|
| **100% Required** | All 30 pairs must be received |
| **Valid Data Only** | NaN, Infinity, zero, negative prices rejected |
| **No Partial Initialization** | 99.9% = 0% (fail-closed) |
| **Clear Error Messages** | Show exactly which pairs are missing |
| **Actionable Recovery** | Retry and Continue-Waiting options |
| **Clean State Reset** | Fresh start on reconnect |

---

## Edge Cases - Exact Behavior

### Edge Case 1: EURUSD Never Arrives

```
Time 0s:    [WAITING] "Initializing... (0/30 pairs)"
Time 5s:    [WAITING] "Initializing... (29/30 pairs)"
Time 15s:   [ERROR] "Unable to initialize - missing 1 pair: EURUSD"
            └─> Show "Retry" button
```

### Edge Case 2: Invalid Data (NaN/Infinity)

```
Message arrives: { symbol: 'EURUSD', todaysOpen: NaN }
                  │
                  ▼
             DATA VALIDATION LAYER
             ┌─────────────────────────────────┐
             │ IF (price === NaN OR Infinity) │
             │ THEN                           │
             │   ├─> REJECT message           │
             │   ├─> DO NOT store in Map      │
             │   ├─> DO NOT track as received │
             │   └─> Log warning             │
             └─────────────────────────────────┘
                  │
                  ▼
            EURUSD never counted as "received"
            Timeout fires → Error message includes EURUSD
```

### Edge Case 3: WebSocket Disconnects

```
Time 0s:    [WAITING] "Initializing... (0/30 pairs)"
Time 2s:    [WAITING] "Initializing... (15/30 pairs)"
Time 2.1s:  [ERROR] "Connection lost - 15/30 pairs received"
            └─> Show "Retry" button
            └─> Clear state (prepare for fresh start)
```

---

## Implementation Summary

### Files to Modify

1. **fxBasketData.js** (~200 lines)
   - Add state enumeration and error types
   - Add data validation function
   - Modify trackReceivedPair() with validation
   - Replace handleTimeout() with fail-closed logic
   - Add detectMissingPairs() function

2. **fxBasketDataProcessor.js** (~80 lines)
   - Add validation layer before updatePrice()
   - Reject invalid messages
   - Log rejections

3. **fxBasketOrchestrator.js** (~150 lines)
   - Add state-based rendering
   - Add progress display (WAITING state)
   - Add error message display (ERROR state)
   - Add retry button

### New Functions Required

| Function | Purpose | Lines |
|----------|---------|-------|
| `validatePriceData()` | Validate prices at ingestion | ~20 |
| `detectMissingPairs()` | Identify which pairs failed to arrive | ~5 |
| `handleTimeout()` | Fail-closed timeout handler | ~30 |
| `renderWaitingState()` | Show initialization progress | ~25 |
| `renderErrorState()` | Show detailed error messages | ~40 |

---

## Testing Requirements

### Required Tests

1. **Missing Pair Rejection** - Verify 1+ missing pairs → ERROR state
2. **Invalid Data Rejection** - Verify NaN/Infinity rejected
3. **Timeout Behavior** - Verify 15s timeout → ERROR with missing list
4. **Connection Loss** - Verify disconnect → ERROR with retry
5. **State Transitions** - Verify all valid/invalid transitions
6. **UI Rendering** - Verify each state displays correctly

---

## Comparison: Previous vs Zero-Tolerance

| Aspect | Previous (80% fallback) | Zero-Tolerance |
|--------|------------------------|---------------|
| **Coverage Tolerance** | 20% data loss allowed | ZERO tolerance |
| **Invalid Data** | Silently corrupts calculations | Rejected immediately |
| **Missing Pairs** | Hidden from user | Clearly listed |
| **User Trust** | Low (shows possibly wrong data) | High (accurate or error) |
| **Debugging** | Difficult (silent failures) | Easy (clear error messages) |

---

## Why This Is NOT a Patch Job

Previous fixes tried to make **partial data work**:
- "80% is good enough"
- "Graceful degradation"
- "User experience over correctness"

This design accepts **no partial data**:
- "100% or nothing"
- "Fail-closed by default"
- "Correctness over convenience"

---

## Implementation Timeline

| Phase | Task | Time |
|-------|------|------|
| 1 | Add validation layer | 1 hour |
| 2 | Implement state machine | 1 hour |
| 3 | Update UI rendering | 2 hours |
| 4 | Add error handling | 1 hour |
| 5 | Testing | 2 hours |
| **Total** | | **~7 hours** |

---

**Document Status**: Ready for Implementation
**Estimated Time**: 7 hours
**Risk**: LOW (fail-closed by design)
**User Impact**: POSITIVE (100% accurate or clear error)
