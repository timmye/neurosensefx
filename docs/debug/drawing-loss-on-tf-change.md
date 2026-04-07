# Debug: All Drawings Disappear on Timeframe Change

**Date:** 2026-04-07
**Status:** RESOLVED
**Symptom:** ALL drawings (not just pinned) disappear when switching timeframes.

## Root Cause

**Booleans are not valid IndexedDB key types.** The compound index `[symbol+pinned]` with `pinned` as boolean caused `IDBKeyRange.only(['EURUSD', true])` to throw `DataError`. Since `restoreDrawings()` is async with no try/catch, the unhandled rejection silently killed the entire function — NO drawings rendered, not even the local ones already loaded.

**Why it affected ALL drawings (not just pinned):** `loadPinned()` was called BEFORE the render loop in `restoreDrawings()`. When it threw, execution skipped the render loop entirely.

**Why previous fixes didn't work:**
- Fix 1 (`1` → `true`): Wrong problem — the issue isn't boolean vs number, it's that booleans aren't valid IndexedDB keys AT ALL
- Fix 2 (`data.length > 0` guard): Fixed a real but unrelated `load()` issue — didn't address `loadPinned()` throwing
- Fix 3 (combined guard): Same as fix 2

## The Fix

Replaced `[symbol+pinned]` compound index with plain `symbol` index + `.and()` filter:

```javascript
// Schema: compound index removed, plain symbol index added
db.version(2).stores({
  drawings: '++id, [symbol+resolution], symbol, overlayType, createdAt',
});

// Query: filter by pinned after index lookup
async loadPinned(symbol) {
  return db.drawings.where('symbol').equals(symbol).and(d => d.pinned === true).toArray();
}
```

This avoids putting a boolean into an IndexedDB key path entirely.

## Fix Attempts (chronological)

| # | Fix | Result | Why it failed |
|---|-----|--------|---------------|
| 1 | `loadPinned` query `[symbol, 1]` → `[symbol, true]` | No change | Booleans aren't valid IDB keys regardless of representation |
| 2 | `load()` guard `data.length > 0` but kept `return data` | No change | Wrong code path; `load()` wasn't the issue |
| 3 | Combined guard `data && Array.isArray(data) && data.length > 0` | No change | Same — `load()` wasn't causing the loss |
| 4 | Removed `[symbol+pinned]` compound index, use `symbol` + `.and()` | **Fixed** | Eliminates boolean from IDB key path |

## Investigation Threads

- [x] Thread 1: Trace complete data flow on TF change — found `loadPinned()` throws before render loop
- [x] Thread 2: Dexie v2 schema upgrade impact — upgrade preserves data, but compound index with boolean is invalid
- [x] Thread 3: Diff against pre-implementation code — confirmed `loadPinned()` call is the only structural change affecting drawing rendering
- [x] Thread 4: restoreDrawings logic — no try/catch around `loadPinned()` allows silent failure

## Lesson

IndexedDB key types are restricted to: number, string, Date, BufferSource, and arrays of those types. Booleans, null, undefined, and objects are NOT valid keys. Dexie compound indexes pass values directly to `IDBKeyRange`, so the same restriction applies. When using boolean flags for filtering, use `.and()` collection filters instead of compound indexes.
