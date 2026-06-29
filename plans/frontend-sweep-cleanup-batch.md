# Frontend Sweep — Cleanup Batch A (Execute)

Source of truth: `docs/frontend-sweep-triage-2026-06-29.md` §6 (items A1–A14). Line numbers below
were **re-verified against current source** on 2026-06-29 via grep; doc line numbers had not drifted
materialally. Every deletion/drop-export was re-confirmed to have **0 external AND 0 test importers**
before acting.

## Scope

Low-risk frontend cleanup in `src/`: drop unused exports, delete one genuinely-dead function,
debounce one hot localStorage write, dev-gate noisy production logs, downgrade expected-condition
errors to warnings, fix one comment contradiction. **No file renames, no symbol renames, no call-site
changes.** Changes left in working tree — no commit/push.

## Verified actions

### Dead code

| # | File:line (verified) | Action | Verified 0 importers |
|---|---|---|---|
| A1 | `lib/fxBasket/fxBasketConfig.js:29` | delete `export const fxBasketConfig = defaultConfig;` (keep `defaultConfig`, `getConfig`) | yes — other files import `getConfig`/`CURRENCIES`/`ZONE_COLORS`/`BASKET_ZONES`, not `fxBasketConfig` |
| A2 | `lib/chart/dateFormatter.js:14` | drop `export` on `getFormatter` (called internally at :33) | yes |
| A3 | `lib/fxBasket/fxBasketElements.js:170` | drop `export` on `detectClusters` (called internally at :184) | yes |
| A4 | `stores/authStore.js:178` | drop `export` on `logout` | yes — only `/api/logout` URL strings in e2e, no fn import |
| A5 | `stores/marketDataStore.js:193,206` | drop `export` on `clearStore` + `clearAllStores` | yes — referenced only inside the DEV-only `window.marketDataStore` debug object (:221-222), not imported |
| A6 | `stores/markerStore.js:92` | drop `export` on `getStorageKey` ONLY (keep fn — used :107,:125,:135) | yes |
| A7 | `stores/markerStore.js:155–~173` | **delete** `mergeWithPersisted` fn entirely | yes — only a stale comment in `server-persistence.spec.js:612`, no call |
| A8 | `stores/authStore.js:7` | remove `get` from `import { writable, get } from 'svelte/store';` | yes — only `.get(k)` Map calls remain (not svelte `get`) |
| A9 | `lib/dayRange/dayRangeElements.js:4` | remove `COLORS` from import binding (keep other 3); leave `COLORS` export in `lib/colors.js` | yes — `COLORS.` never dereferenced in file |
| A10 | `lib/dayRange/dayRangeCore.js:93` | delete `export { formatPrice } from '../priceFormat.js';` | yes — no importer pulls `formatPrice` from `dayRangeCore` |

### Performance (A11) — `stores/workspace.js` `initPersistence.syncToStorage` (~:284-296)

Problem: `localStorage.setItem('workspace-state', JSON.stringify(data))` runs synchronously on every
`displayStore`/`headlinesStore` change (every drag frame). Only the server `fetch` is debounced (2s).

Fix (preserves `beforeunload` semantics **exactly**):
- Add `let lsTimer = null;` next to existing `debounceTimer` in the `initPersistence` closure.
- **Keep** `_lastWorkspaceData = data;` immediate (unchanged) — `flushPending()` reads it on
  `beforeunload` via `sendBeacon`, so it must always hold the latest data.
- Replace the immediate `localStorage.setItem(...)` block with a debounced write: clear+reset
  `lsTimer` (300ms, same pattern as `debounceTimer`); on fire, `localStorage.setItem('workspace-state',
  JSON.stringify(_lastWorkspaceData))` inside the existing try/catch. (`_lastWorkspaceData` is kept
  current, so capturing `data` vs reading `_lastWorkspaceData` are equivalent.)
- Do **not** touch the server-fetch debounce, the subscription wiring, or `flushPending`.

### Production logging

**A12 — dev-gate ungated `console.log`** with `if (import.meta.env.DEV) console.log(...)`. Leave
existing `console.warn` as-is. Leave already-gated logs (Workspace.svelte:139 block, fxBasketSubscription.js:45).
Files + verified lines:
- `components/Workspace.svelte`: :41 (`✅ Workspace export initiated`), :97 (reinit requested),
  :167 (backend acknowledged reinit), :175 (Ready banner). Leave :139 (already gated).
- `stores/workspace.js`: :161 (`✅ Workspace imported successfully`), :219 (`Workspace exported successfully`).
- `lib/fxBasket/fxBasketStateMachine.js`: :88 (`All pairs received` progress).
- `lib/fxBasket/fxBasketSubscription.js`: :14, :92, :97 (subscription progress).
- `stores/dailyResetHandler.js`: :27 (daily reset).
- `stores/authStore.js`: :101 (`Local data migrated to server`).

**A13 — expected-condition `console.error` → `console.warn`** (protects
`tests/e2e/console-check.spec.js:49` which asserts 0 errors during init):
- `lib/fxBasket/fxBasketStateMachine.js`: :91, :92, :93 (Insufficient/Missing/Failed pairs → sets
  recoverable `BasketState.ERROR`) → warn.
- `stores/workspace.js`: :119, :127, :133, :140 (drawing save/rollback/clear/restore during **import**;
  :140 comment literally says "non-fatal") → warn.
- **Keep as `console.error`** (genuine unexpected failures, not init-flow): workspace.js :163
  (`Failed to import workspace`), :221 (`Failed to export workspace`, also `throw`s).

### Naming contradiction (A14) — `lib/priceFormat.js`

Verified: `formatPriceWithPipPosition` is imported by `displayCanvasRenderer.js` + `priceMarkerBase.js`
(2 sites); `formatPrice` by `quickRulerUtils.js` (1 site). Both used. Resolution is **comment-only**:
- `formatPriceWithPipPosition`: remove "Legacy alias … DEPRECATED" wording → mark as a supported alias.
- `formatPrice`: leave un-marked (it is the primitive the alias delegates to).
No rename, no call-site change.

## Exclusions (do NOT touch)

`window.*` globals (E2E-load-bearing); `renderBoundaryLabels` (intentional no-op stub);
`computeMiniMarketProfile` (false positive — test importer); `xAxisCustom.js:23` re-exports
(test-imported, Batch B); `displayDataProcessor.js` dev-port detection (not a defect); no file/symbol
renames; no `getConfig`/`marketProfileHandler`/`markerStore` renames (Batch B).

## Verification gate

1. `npm run test:unit` (Vitest) — green.
2. `npm run build` (vite build) — succeeds.
3. Grep confirms 0 dangling references to: `mergeWithPersisted`, `fxBasketConfig` (as import),
   `logout`/`clearStore`/`clearAllStores`/`getStorageKey`/`getFormatter`/`detectClusters` (as imports),
   the `formatPrice` re-export from `dayRangeCore`, the `COLORS` import in `dayRangeElements`.
4. A11: `_lastWorkspaceData` still assigned immediately; server-fetch debounce + `flushPending`
   unchanged.
