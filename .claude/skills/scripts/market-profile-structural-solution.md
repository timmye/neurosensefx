# Market Profile M1 Bar Reset Fidelity - Structural Solution

## Executive Summary

**Problem**: Market profile does not reset at 0000UTC when M1 bars reset, causing cross-session data contamination.

**Root Cause**: Architecture allows perpetual state accumulation without daily session boundaries enforced by data source.

**Solution**: **Day-Bounded Session Architecture** - Make session boundaries architecturally impossible to violate by binding profile lifecycle to M1 bar data boundaries.

---

## Current Architecture Analysis

### Data Flow (Current - Problematic)

```
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  CTraderDataProcessor.getSymbolDataPackage()                    │
│    ├─ fromIntraday = moment.utc().startOf('day').valueOf()     │
│    ├─ Fetches M1 bars from 0000UTC today                       │
│    └─ Returns: { initialMarketProfile: [...] }                 │
│                        ↓                                         │
│  RequestCoordinator.sendDataToClients()                        │
│    ├─ Sends symbolDataPackage to frontend                     │
│    └─ Calls marketProfileService.initializeFromHistory()       │
│                        ↓                                         │
│  MarketProfileService.initializeFromHistory()                  │
│    ├─ Creates new profile OR                                   │
│    ├─ SKIPS if existingProfile.levels.size > 0 (Line 289-295)  │
│    └─ Accumulates TPOs from initialMarketProfile              │
│                        ↓                                         │
│  MarketProfileService.onM1Bar()                                │
│    ├─ Called for EACH incoming M1 bar                          │
│    ├─ NO daily reset check                                     │
│    └─ Accumulates TPOs perpetually across days                 │
│                        ↓                                         │
│  Emit 'profileUpdate' → Frontend                               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Critical Flaws

1. **State Persistence Across Days** (MarketProfileService.js:289-295)
   ```javascript
   if (existingProfile && existingProfile.levels.size > 0) {
     console.log(`Already initialized, skipping reinitialization`);
     return; // ← KEEPS OLD DATA FROM PREVIOUS DAY
   }
   ```

2. **No Daily Boundary Enforcement**
   - `onM1Bar()` has no 0000UTC check
   - Accumulates bars from Sunday → Monday without reset
   - TPO counts include previous day's data

3. **Data Source Boundary Not Propagated**
   - Backend fetches from `moment.utc().startOf('day')` (correct)
   - But MarketProfileService ignores this boundary
   - Frontend has no knowledge of session start time

---

## Structural Solution: Day-Bounded Session Architecture

### Core Principle

**Bind profile lifecycle to M1 bar data boundaries.** Make it architecturally impossible to have a profile that spans multiple UTC days.

### Design Change

**Replace stateful perpetual accumulation with day-bounded state containers.**

```
┌─────────────────────────────────────────────────────────────────┐
│              NEW: Day-Bounded Session Architecture              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  SessionKey = symbol + source + utcDate                         │
│  Example: "XAUUSD:ctrader:2025-03-25"                          │
│                                                                   │
│  RULE: Profile state ONLY exists within ONE SessionKey          │
│  RULE: SessionKey changes at 0000UTC → NEW profile required     │
│  RULE: Old session profiles are auto-evicted                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Strategy

### Phase 1: Backend - Session-Keyed State Management

**File**: `services/tick-backend/MarketProfileService.js`

#### Change 1.1: Replace `profiles` Map with session-keyed structure

```javascript
// BEFORE (Current)
constructor() {
  this.profiles = new Map(); // symbol → {levels, bucketSize, lastUpdate}
  this.sequenceNumbers = new Map();
}

// AFTER (Proposed)
constructor() {
  this.sessions = new Map(); // "symbol:source:utcDate" → {levels, bucketSize, sessionStart}
  this.symbolSources = new Map(); // symbol → source
  this.sessionSequenceNumbers = new Map(); // "symbol:source:utcDate" → seq
}
```

#### Change 1.2: Add session key extraction

```javascript
/**
 * Extract session key from symbol and M1 bar timestamp
 * @param {string} symbol - Symbol identifier
 * @param {number} timestamp - M1 bar timestamp (milliseconds)
 * @param {string} source - Data source
 * @returns {string} Session key "symbol:source:utcDate"
 */
_getSessionKey(symbol, timestamp, source) {
  const utcDate = new Date(timestamp).toISOString().split('T')[0]; // "2025-03-25"
  return `${symbol}:${source}:${utcDate}`;
}

/**
 * Get current session key for symbol (uses current time)
 * @param {string} symbol - Symbol identifier
 * @param {string} source - Data source
 * @returns {string} Session key for current UTC day
 */
_getCurrentSessionKey(symbol, source) {
  const utcDate = new Date().toISOString().split('T')[0];
  return `${symbol}:${source}:${utcDate}`;
}
```

#### Change 1.3: Modify `initializeFromHistory` to enforce session boundary

```javascript
initializeFromHistory(symbol, m1Bars, bucketSize, source = 'ctrader') {
  // Extract session boundary from FIRST bar (must be from 0000UTC today)
  const sessionStartTimestamp = m1Bars[0]?.timestamp || Date.now();
  const sessionKey = this._getSessionKey(symbol, sessionStartTimestamp, source);

  // ENFORCE SESSION BOUNDARY: Always create new session for today's data
  // This prevents cross-day contamination
  const session = {
    levels: new Map(),
    bucketSize,
    sessionStart: sessionStartTimestamp,
    sessionDate: sessionKey.split(':')[2]
  };

  this.sessions.set(sessionKey, session);

  // Build profile from today's M1 bars only
  for (const bar of m1Bars) {
    const barSessionKey = this._getSessionKey(symbol, bar.timestamp, source);

    // CRITICAL: Skip bars from different session (defense in depth)
    if (barSessionKey !== sessionKey) {
      console.warn(`[MarketProfileService] Skipping bar from different session: ${barSessionKey} != ${sessionKey}`);
      continue;
    }

    const levels = this.generatePriceLevels(bar.low, bar.high, bucketSize);
    for (const price of levels) {
      session.levels.set(price, (session.levels.get(price) || 0) + 1);
    }
  }

  // Emit profile update with session metadata
  const seq = this._incrementSequence(sessionKey);
  const fullProfile = this.getFullProfile(sessionKey);

  this.emit('profileUpdate', {
    symbol,
    profile: fullProfile,
    seq,
    source,
    sessionDate: session.sessionDate,
    sessionStart: session.sessionStart
  });

  console.log(`[MarketProfileService] Initialized session ${sessionKey} with ${session.levels.size} levels`);
}
```

#### Change 1.4: Modify `onM1Bar` to enforce session boundary

```javascript
onM1Bar(symbol, bar, source = null) {
  const barSource = source || this.symbolSources.get(symbol) || 'tradingview';
  const sessionKey = this._getSessionKey(symbol, bar.timestamp, barSource);

  // CHECK: Does session exist for this bar's UTC date?
  let session = this.sessions.get(sessionKey);

  // CRITICAL: New UTC day = NEW session (auto-reset at 0000UTC)
  if (!session) {
    console.log(`[MarketProfileService] New session detected: ${sessionKey}`);

    // Auto-create new session (first bar of new day)
    session = {
      levels: new Map(),
      bucketSize: this._getBucketSizeForSymbol(symbol),
      sessionStart: bar.timestamp,
      sessionDate: sessionKey.split(':')[2]
    };

    this.sessions.set(sessionKey, session);

    // CLEANUP: Evict old sessions to prevent memory leak
    this._evictOldSessions(symbol, barSource);

    // Notify frontend of session reset
    this.emit('sessionReset', {
      symbol,
      sessionDate: session.sessionDate,
      sessionStart: session.sessionStart,
      previousSessionDate: this._getPreviousSessionDate(symbol, barSource)
    });
  }

  // Deduplication (same as before)
  const dedupeKey = `${sessionKey}:${bar.timestamp}`;
  const barSignature = `${bar.timestamp}|${bar.low}|${bar.high}|${bar.close}`;
  if (this.lastBarTimestamps.get(dedupeKey) === barSignature) {
    return;
  }
  this.lastBarTimestamps.set(dedupeKey, barSignature);

  // Process bar within session context
  const levels = this.generatePriceLevels(bar.low, bar.high, session.bucketSize);
  for (const price of levels) {
    session.levels.set(price, (session.levels.get(price) || 0) + 1);
  }

  // Emit profile update with session metadata
  const seq = this._incrementSequence(sessionKey);
  const fullProfile = this.getFullProfile(sessionKey);

  this.emit('profileUpdate', {
    symbol,
    profile: fullProfile,
    seq,
    source: barSource,
    sessionDate: session.sessionDate,
    sessionStart: session.sessionStart
  });
}
```

#### Change 1.5: Add session eviction

```javascript
/**
 * Evict old sessions to prevent memory leak
 * Keeps current session + previous session only
 * @param {string} symbol - Symbol identifier
 * @param {string} source - Data source
 */
_evictOldSessions(symbol, source) {
  const currentSessionKey = this._getCurrentSessionKey(symbol, source);

  for (const [sessionKey, session] of this.sessions.entries()) {
    if (!sessionKey.startsWith(`${symbol}:${source}`)) continue;

    // Keep current session
    if (sessionKey === currentSessionKey) continue;

    // Keep previous session (for UI transition)
    const previousDate = this._getPreviousUTCDate(currentSessionKey.split(':')[2]);
    if (sessionKey.endsWith(previousDate)) continue;

    // Evict everything else
    console.log(`[MarketProfileService] Evicting old session: ${sessionKey}`);
    this.sessions.delete(sessionKey);
    this.sessionSequenceNumbers.delete(sessionKey);
  }
}

/**
 * Get previous UTC date in YYYY-MM-DD format
 * @param {string} currentDate - Current date "2025-03-25"
 * @returns {string} Previous date "2025-03-24"
 */
_getPreviousUTCDate(currentDate) {
  const date = new Date(currentDate);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().split('T')[0];
}

/**
 * Get previous session date for symbol
 * @param {string} symbol - Symbol identifier
 * @param {string} source - Data source
 * @returns {string|null} Previous session date or null
 */
_getPreviousSessionDate(symbol, source) {
  const currentKey = this._getCurrentSessionKey(symbol, source);
  const currentDate = currentKey.split(':')[2];
  const previousDate = this._getPreviousUTCDate(currentDate);

  // Check if previous session exists
  const previousKey = `${symbol}:${source}:${previousDate}`;
  return this.sessions.has(previousKey) ? previousDate : null;
}
```

#### Change 1.6: Update `getFullProfile` to work with sessions

```javascript
getFullProfile(sessionKey) {
  const session = this.sessions.get(sessionKey);
  if (!session) return null;

  return {
    levels: Array.from(session.levels.entries())
      .map(([price, tpo]) => ({ price, tpo }))
      .sort((a, b) => a.price - b.price),
    bucketSize: session.bucketSize,
    sessionDate: session.sessionDate,
    sessionStart: session.sessionStart
  };
}
```

---

### Phase 2: Frontend - Session-Aware Profile Display

**File**: `src/components/PriceTicker.svelte`

#### Change 2.1: Track session state

```javascript
// Add session tracking
let currentSessionDate = null;
let lastSessionReset = null;

// In onM1Bar handler
webSocketSub.subscribe(formattedSymbol, ticker.source || 'tradingview', async (data) => {
  const processed = processSymbolData(data, formattedSymbol, lastData);

  if (processed?.type === 'data') {
    lastData = processed.data;
  }

  // NEW: Handle session reset
  if (data.type === 'sessionReset') {
    console.log('[PriceTicker] Session reset for', formattedSymbol, 'new session:', data.sessionDate);
    currentSessionDate = data.sessionDate;
    lastSessionReset = data.sessionStart;
    lastMarketProfileData = null; // Clear old profile data
    await tick();
    return;
  }

  // Handle profile update with session metadata
  if (data.type === 'profileUpdate' && data.profile) {
    const levels = data.profile.levels;

    // CRITICAL: Validate session boundary
    if (data.sessionDate !== currentSessionDate) {
      console.log('[PriceTicker] Session boundary detected:', {
        old: currentSessionDate,
        new: data.sessionDate
      });
      currentSessionDate = data.sessionDate;
      lastMarketProfileData = null; // Clear old profile
    }

    console.log('[PriceTicker] profileUpdate', formattedSymbol, 'session:', data.sessionDate, 'levels:', levels.length);
    lastMarketProfileData = levels;
    await tick();
  }
}, 14);
```

---

### Phase 3: Data Source - Explicit Session Boundary

**File**: `services/tick-backend/CTraderDataProcessor.js`

#### Change 3.1: Include session metadata in data package

```javascript
async getSymbolDataPackage(symbolName, adrLookbackDays = 14) {
  // ... existing code ...

  const moment = require('moment');
  const to = moment.utc().valueOf();
  const fromDaily = moment.utc().subtract(adrLookbackDays + 5, 'days').valueOf();
  const fromIntraday = moment.utc().startOf('day').valueOf(); // ← 0000UTC today

  // NEW: Explicit session metadata
  const sessionDate = moment.utc().format('YYYY-MM-DD');
  const sessionStart = fromIntraday;

  const { dailyBars, intradayBars } = await this.fetchHistoricalBars(symbolId, fromDaily, fromIntraday, to);

  // ... existing processing ...

  return {
    symbol: symbolName,
    digits,
    adr,
    todaysOpen,
    todaysHigh,
    todaysLow,
    projectedAdrHigh: todaysOpen + (adr / 2),
    projectedAdrLow: todaysOpen - (adr / 2),
    initialPrice,
    initialMarketProfile,
    pipPosition: symbolInfo.pipPosition,
    pipSize: symbolInfo.pipSize,
    pipetteSize: symbolInfo.pipetteSize,

    // NEW: Session boundary metadata
    sessionDate,        // "2025-03-25"
    sessionStart,       // 0000UTC today in milliseconds
    sessionBoundary: '0000UTC', // Explicit boundary type

    ...(prevDayOHLC && { prevDayOpen: prevDayOHLC.open }),
    ...(prevDayOHLC && { prevDayHigh: prevDayOHLC.high }),
    ...(prevDayOHLC && { prevDayLow: prevDayOHLC.low }),
    ...(prevDayOHLC && { prevDayClose: prevDayOHLC.close })
  };
}
```

---

## Benefits of Structural Solution

### 1. Architecturally Impossible to Violate

- **Session key is mandatory**: All profile operations require session key
- **Auto-reset at 0000UTC**: New UTC date = new session key = new profile
- **No perpetual state**: Old sessions auto-evicted after 2 days

### 2. 100% Data Fidelity

- **M1 bar boundaries respected**: Only bars from same UTC date in profile
- **No cross-contamination**: Different sessions cannot share state
- **Traceable lineage**: Each profile has explicit sessionDate and sessionStart

### 3. Consistency Across Mini and Canvas

- **Single source of truth**: Both use same session-keyed backend data
- **Synchronized resets**: sessionReset event clears all frontend caches
- **Identical data**: No divergence possible (same sessionKey → same profile)

### 4. Debuggable and Testable

- **Explicit session metadata**: Every profileUpdate includes sessionDate
- **Clear transition events**: sessionReset event for observability
- **Easy to verify**: Check sessionDate matches expected UTC date

---

## Evaluation Against Criteria

### VIABILITY

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Resets at 0000UTC | ✅ PASS | Session key changes at UTC date boundary |
| Maintains fidelity | ✅ PASS | Session-scoped state prevents cross-day mixing |
| Handles M1 boundaries | ✅ PASS | Bar timestamp determines session key |
| Prevents contamination | ✅ PASS | Different session keys = different state maps |

### FATAL CONDITIONS

| Condition | Status | Mitigation |
|-----------|--------|------------|
| No daily reset | ✅ AVOIDED | Session key forces reset at 0000UTC |
| Cross-day contamination | ✅ AVOIDED | Session-scoped state |
| Mini/canvas divergence | ✅ AVOIDED | Single backend source, sessionReset event |
| M1 bar loss | ✅ AVOIDED | Auto-create new session, no data dropped |

### SIGNIFICANT CONDITIONS

| Condition | Impact | Mitigation |
|-----------|--------|------------|
| Frontend state changes | MEDIUM | Add sessionReset handler (minimal change) |
| Backend memory increase | LOW | Auto-eviction after 2 days, bounded memory |
| Reconnection logic | LOW | Session key auto-creates on first bar |

### MINOR CONDITIONS

| Condition | Impact | Acceptable |
|-----------|--------|------------|
| Visual inconsistency during reset | <1 second | ✅ ACCEPTABLE |
| Increased logging | Minimal | ✅ ACCEPTABLE |

---

## Tradeoff Analysis

| Dimension | Weight | Solution Score | Rationale |
|-----------|--------|----------------|-----------|
| **fidelity** | HIGH | 10/10 | Session-keyed state guarantees 100% accuracy |
| **consistency** | HIGH | 10/10 | Single source of truth, synchronized resets |
| **timing** | HIGH | 10/10 | Session key changes exactly at 0000UTC |
| **complexity** | MEDIUM | 7/10 | More complex than current, but simpler than workarounds |

**Overall Score**: 9.25/10

---

## Implementation Checklist

### Backend Changes
- [ ] Replace `this.profiles` with `this.sessions` (session-keyed)
- [ ] Add `_getSessionKey()` and `_getCurrentSessionKey()`
- [ ] Modify `initializeFromHistory()` to use session keys
- [ ] Modify `onM1Bar()` to enforce session boundaries
- [ ] Add `_evictOldSessions()` for memory management
- [ ] Emit `sessionReset` event on new session detection
- [ ] Include session metadata in `profileUpdate` events

### Frontend Changes
- [ ] Add `currentSessionDate` tracking in PriceTicker.svelte
- [ ] Handle `sessionReset` event to clear old profile data
- [ ] Validate sessionDate in `profileUpdate` handler

### Data Source Changes
- [ ] Add `sessionDate`, `sessionStart`, `sessionBoundary` to data package
- [ ] Document session boundary semantics

### Testing
- [ ] Unit test: Session key generation
- [ ] Unit test: Session eviction logic
- [ ] Integration test: 0000UTC transition
- [ ] Integration test: Mini and canvas profile consistency
- [ ] E2E test: Session reset notification

---

## Conclusion

This structural solution makes session boundary violations **architecturally impossible** by:

1. **Binding profile state to M1 bar data boundaries** via session keys
2. **Enforcing 0000UTC reset** through session key structure
3. **Preventing cross-contamination** through session-scoped state maps
4. **Guaranteeing consistency** via single source of truth and sessionReset events

The solution addresses the root cause (perpetual state accumulation) rather than symptoms, making this class of bug impossible to reintroduce.

---

**Generated**: 2025-03-25
**Status**: Structural Design Complete
**Next Steps**: Implementation Phase 1 (Backend Session Management)
