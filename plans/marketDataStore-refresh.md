# marketDataStore Refresh — Equality Gate + Error Handling

- **Date:** 2026-06-29
- **Status:** Approved (assessment complete, ready to execute)
- **Scope:** `src/stores/marketDataStore.js` (hot path only) + one new unit-test file
- **Type:** Small, targeted reliability + perf fix at the root (per CLAUDE.md, reliability is first-class and justifies changes that fix real problems at the core)
- **Source assessment:** `/codebase-analysis` of `marketDataStore.js` (this session)

---

## 1. Context & prior art (do not re-derive)

- **`docs/frontend-sweep-triage-2026-06-29.md` §3.2 "root-cause note"** names this exact work:
  > `marketDataStore.js:60-76` emits a brand-new spread object every tick… A future pass that gates that spread on "did price-relevant fields change" would retire several items at once.

  This **is** that future pass. It is **not** in the Deferred list.
- **`docs/frontend-architecture-reassessment-2026-06.md` §2.4**: store decomposed 361→205 LOC in `5ce5c4d`; normalization/profile-merge/daily-reset already extracted to pure modules (79 unit tests across them).
- **`docs/frontend-sweep-triage-2026-06-29.md` §3.2 #4**: `PriceTicker.svelte:169-184` mini-profile canvas redraw per-tick with no rAF coalescing = "Tier 2 #4, still open." This doc's gate removes the no-information paints that drive it; the complementary rAF-coalescing fix for PriceTicker is tracked separately under Tier 2 #4 (out of scope here).
- **§5 standing constraints (carry forward):**
  - `window.*` globals are E2E-load-bearing → do not alter `window.marketDataStore` (already DEV-gated at `marketDataStore.js:215`).
  - `console.error` is asserted to be zero on expected paths by `src/tests/e2e/console-check.spec.js:49` → use `console.warn` on expected error paths.
  - Dead-code claims need both-direction verification.

---

## 2. The two problems (verified from source)

### Problem A — per-tick allocation, no price-relevance gate  `[HIGH · perf]`
`handleStoreUpdate` (`marketDataStore.js:60-76`) unconditionally runs:
```js
store.update(current => ({ ...current, ...normalized, clientReceivedAt, latency, status:'connected', error:null, lastUpdate }));
```
on **every** tick. The spread is a new object reference every time → every `$marketData` subscriber is notified every tick, including ticks where the mid price did not change (spread jitter around an unchanged mid, redundant forwards). Real per-tick cost (per sweep-triage §3.2): the `PriceTicker` mini-profile canvas redraw (`:169-184`, uncoalesced). The `DisplayCanvas` path is already rAF-coalesced (`DisplayCanvas.svelte:28-37`).

### Problem B — normalize errors silently swallowed, "Connected" stays green  `[MEDIUM · reliability]`
No `try/catch` in `handleStoreUpdate` / the message callback. If the normalize path throws on a frame, `subscriptionManager.dispatch` catches it (`subscriptionManager.js:146-148`: `try { cb(message); } catch (e) { console.error(...) }`), **logs and drops the tick**, and the store keeps `status:'connected'` — a stale-positive trust signal. The store already has `error`/`status` fields and an existing `data.type === 'error'` branch (`:127-135`) that does the right thing, but a *thrown* error never reaches it. Inconsistent with `authStore`'s catch-+-set-`error`-state convention.

---

## 3. Why it matters (trader impact)

A trading workstation must never compromise two things: **responsiveness when the market is moving**, and an **honest status light**.

- **A → responsiveness under load.** Quiet hours mask it; fast markets (NFP, FOMC, London/NY overlap) expose it. With N tickers open, every tick = N canvas paints on the main thread, plus ticks that carry no new information. The UI gets sluggish exactly when speed matters most — and it scales with how many tickers are open. *(Workload-dependent severity.)*
- **B → silent staleness.** A trader glances at the green "Connected" badge, trusts a frozen quote, and acts on a stale price. Silent staleness is strictly worse than an obvious disconnect — you don't know to distrust the number. Low-frequency (normalizer is defensive) but high-consequence, and most likely during reconnect instability / backend contract drift — the moment a trader most needs to know "what did I miss?"
- **Compounding:** both peak at the same instant (volatile market after a reconnect blip = high tick rate **and** unstable frames).

**After the fixes:** the UI stops paying for no-information ticks (stays fast when busy); a tick that can't be parsed sets `status:'error'` with the reason (price preserved) instead of silently freezing, so the status badge becomes trustworthy again.

---

## 4. Implementation spec

All changes in `src/stores/marketDataStore.js`. Match surrounding conventions; do not invent new patterns.

### 4.1 Equality gate + error handling in `handleStoreUpdate`

**Non-obvious, verified mechanism:** the gate must **skip the `store.update` call entirely** — returning the same object reference from the update callback does *not* suppress notification, because Svelte's `writable.set` gates on `safe_not_equal`, which returns `true` even for two identical object references. So we peek at current state non-reactively with `get(store)` (this also makes the currently-unused `get` import purposeful — resolves the dead-import finding).

Replace `handleStoreUpdate` (`:49-77`) with:

```js
// Fields whose change is the ONLY reason to notify subscribers. Pure-metadata
// fields (timestamps, latency, status, error) are excluded — verified 2026-06-29:
// no .svelte component reads them reactively. If a latency/status indicator is
// ever added, revisit this set (or split the store).
const METADATA_KEYS = new Set([
  'receivedAt', 'sentAt', 'clientReceivedAt', 'latency', 'lastUpdate', 'status', 'error'
]);

// Returns true if `normalized` changes a field subscribers render. Reference
// equality is safe here: normalizeSymbolDataPackage reuses currentState.marketProfile
// (same ref) and prevDayOHLC is either null or a fresh object; all other gated
// fields are primitives.
function priceRelevantChanged(current, normalized) {
  for (const k in normalized) {
    if (METADATA_KEYS.has(k)) continue;
    if (normalized[k] !== current[k]) return true;
  }
  return false;
}

function handleStoreUpdate(symbol, data) {
  const store = getMarketDataStore(symbol);
  const clientReceivedAt = Date.now();

  if (import.meta.env.DEV) {
    const validation = validateWebSocketMessage(data, 'marketDataStore');
    logValidationResult('marketDataStore', validation, data);
  }

  const current = get(store);

  let normalized;
  try {
    normalized = data.type === 'symbolDataPackage'
      ? normalizeSymbolDataPackage(data, current)
      : data.type === 'tick'
        ? normalizeTick(data, current)
        : {};
  } catch (e) {
    // Surface the error state; PRESERVE current price (no UI flicker on a
    // transient bad frame). console.warn — console-check.spec asserts zero
    // console.error on expected paths. Dispatch-layer catch stays as backstop.
    console.warn('[marketDataStore] normalize failed — surfacing error, preserving price:', e);
    store.update(cur => ({
      ...cur,
      status: 'error',
      error: e?.message || 'Normalize failed',
      lastUpdate: clientReceivedAt
    }));
    return;
  }

  // Skip the notification when no price-relevant field changed — UNLESS we are
  // currently in an error state, so the next good tick can recover status to
  // 'connected' even if the price itself did not move (see test #4).
  if (!priceRelevantChanged(current, normalized) && current.status !== 'error') return;

  const latency = calculateLatency(data, clientReceivedAt);
  store.update(cur => ({
    ...cur,
    ...normalized,
    clientReceivedAt,
    latency,
    status: 'connected',
    error: null,
    lastUpdate: clientReceivedAt
  }));
}
```

Notes for the implementer:
- `normalized` is computed **before** `store.update` (it was inside the callback before). This is semantically equivalent: nothing else mutates the store between `get(store)` and `store.update` (synchronous), and the normalize functions are pure.
- The `current.status !== 'error'` clause is the **error-status recovery** rule — lock it down with test #4.

### 4.2 Error handling in the `profileUpdate` branch

Wrap the `mergeProfileUpdate` call (inside `subscribeToSymbol`'s callback, `:110-116`) so a merge throw surfaces `status:'error'` instead of escaping to the dispatch-layer backstop:

```js
if (data.type === 'profileUpdate') {
  const store = getMarketDataStore(symbol);
  store.update(current => {
    try {
      const updated = mergeProfileUpdate(current, data);
      return updated ?? current;
    } catch (e) {
      console.warn('[marketDataStore] profile merge failed:', e);
      return { ...current, status: 'error', error: e?.message || 'Profile merge failed', lastUpdate: Date.now() };
    }
  });
}
```

- Do **not** add an equality gate to `profileUpdate`/`twapUpdate` — out of scope (infrequent; the finding was the tick path). Only add the `try/catch`.
- `twapUpdate` (`:117-126`) is trivial (optional chaining only) — wrapping it is optional for consistency; not required.

### 4.3 Resolves (free) — dead `get` import
The equality gate uses `get(store)`, so the `get` named import (`:1`) becomes purposeful. No separate action needed; do **not** remove it.

---

## 5. Test contract (write FIRST, TDD)

New file: `src/stores/__tests__/marketDataStore.test.js`. Runs under `npm run test:unit` (vitest, `environment: 'node'` — no backend/PG/Redis needed).

**Mock strategy** — test through the public API (`subscribeToSymbol` → captured callback → `get(getMarketDataStore(...))`); do not export `handleStoreUpdate`:
- `vi.mock('../lib/connectionManager.js')` — `getInstance()` returns an object whose `subscribeAndRequest(sym, cb)` **captures `cb`** and returns a spy unsubscribe; stub `addSystemSubscription`/`addStatusCallback` to return no-op unsubs; provide `status`/`displayStatus` getters.
- `vi.mock('../lib/displayDataProcessor.js')` — `getWebSocketUrl: () => 'ws://test'`.
- `vi.mock('../lib/dataContracts.js')` — passthrough `validateWebSocketMessage: () => ({ valid:true, errors:[] })`, `logValidationResult: () => {}`.
- For the error test, control the throw via the **mocked normalizer module**: `vi.mock('./marketDataNormalizer.js', …)` with a factory whose `normalizeTick` throws when `data.__forceThrow` is set, else delegates to the real implementation (dynamic-import the real module inside the factory, or re-implement minimally). This avoids ESM binding-pitfalls with `vi.spyOn`.

**Notification counter helper:**
```js
function tracker(symbol) {
  let calls = 0;
  const last = {};
  const unsub = getMarketDataStore(symbol).subscribe(v => { calls++; Object.assign(last, v); });
  return { unsub, calls: () => calls, last: () => last };
}
```

**The 5 cases (the regression contract):**

| # | Name | Setup | Assert |
|---|------|-------|--------|
| 1 | notify on price change | subscribe('EURUSD'); emit tick `{type:'tick', price:1.1000}` | tracker.calls() incremented; `get(store).current === 1.1` |
| 2 | **skip on same price** (the gate) | emit tick `{type:'tick', price:1.1000}` again | tracker.calls() **not** incremented; `get(store).latency` / `lastUpdate` **unchanged** (documents intentional freeze) |
| 3 | notify on non-current price-relevant change | emit `symbolDataPackage` with same `current` but changed `open`/`adrHigh` | tracker.calls() **incremented** (gate lets it through) |
| 4 | error → status, price preserved, recovery | emit tick with `__forceThrow:true` → then emit a good tick with the **same** price as the last good value | after throw: `status==='error'`, `error` set, `current` **preserved** (not null); after the good same-price tick: `status==='connected'`, `error===null` |
| 5 | refcount lifecycle | subscribe('EURUSD') twice → unsub once → unsub again | after 1st unsub: connection unsubscribe **not** called, store still active; after 2nd unsub: connection unsubscribe called **once**, store `status==='stale'` |

Each test should reset module state between cases (`clearAllStores` via the DEV window object is unavailable in node — instead use fresh symbols per test, or expose a reset through the mock). Prefer fresh symbols per test to avoid depending on private internals.

**TDD expectation:** before the change, tests #2 and #4 fail (current code always notifies; current code has no error-state recovery). After the change, all 5 pass.

---

## 6. Sequencing & safety

1. **Write the test file** (5 cases). Run → confirm #2 and #4 fail red against current code (proves the tests actually exercise the new behavior).
2. **Implement §4.1 + §4.2** in `marketDataStore.js`.
3. **Run `npm run test:unit`** → all 5 green. Also confirm the existing 79 pure-module tests still pass (they must — the change doesn't touch their modules).
4. **Quality review** (separate agent): diff against this spec + conventions.

**Self-contained & safe because:**
- No subscriber changes (PriceTicker/DisplayCanvas/etc. untouched).
- No `window.*` changes; no `clearStore` re-export; no connection-layer changes.
- Verified zero `.svelte` consumer of the frozen metadata fields → no reactivity regression.
- Error path preserves `current` → no price flicker.
- Connection liveness is owned by `connectionManager`/supervision, not by these notifications → supervision unaffected.

**Needs runtime confirmation (not blocking):** the *magnitude* of the perf win depends on same-mid-tick frequency against a live backend. The gate is correct either way.

---

## 7. Non-goals (explicit)

- Do **not** gate `profileUpdate`/`twapUpdate` (out of scope).
- Do **not** add rAF coalescing to PriceTicker here (that's Tier 2 #4, tracked separately — complementary, not blocking).
- Do **not** re-export `clearStore`/`clearAllStores` (verified no importer, no test dependency).
- Do **not** touch `window.marketDataStore`, `setupDailyResetHandler`, or the connection layer.
- Do **not** re-recommend deferred items (TypeScript migration, code-splitting, Svelte 5).
- Extracting `calculateLatency` to `marketDataNormalizer.js` is **optional/cosmetic** — only if time permits; not required.

---

## 8. Out-of-scope follow-ups (noted, not actioned)

- PriceTicker rAF coalescing (Tier 2 #4) — complementary perf win on the *rendering* side.
- If a latency/status indicator is ever added to the UI, revisit `METADATA_KEYS` or split the store into price vs. metadata (Strategy B) so that consumer can react to per-tick metadata without forcing price components to.
