# Plan: Frontend Sweep — Batch B (naming/accuracy cleanups)

## Scope
Three non-bug, naming/accuracy cleanups in the Svelte 4 SPA. Symbol names unchanged; only file paths (B2/B3) + one re-export deletion (B4). Safety net: `npm run test:unit` (482) + `npm run build`. No E2E. No commit.

## B2 — marketProfileHandler.js → marketProfileMerger.js
- `git mv src/stores/marketProfileHandler.js src/stores/marketProfileMerger.js`
- Rewire importer `src/stores/marketDataStore.js:6` → `'./marketProfileMerger.js'`
- Rewire test `src/stores/__tests__/marketProfileHandler.test.js:2` → `'../marketProfileMerger.js'`
- Doc refs → update filename only (keep descriptions): `docs/frontend-architecture-assessment-2026-06.md`, `docs/frontend-architecture-reassessment-2026-06.md`, `docs/frontend-sweep-triage-2026-06-29.md`, `src/stores/CLAUDE.md`

## B3 — markerStore.js → markerActions.js
- `git mv src/stores/markerStore.js src/stores/markerActions.js`
- Rewire importers (paths only): `src/components/PriceMarkerManager.svelte`, `src/lib/priceMarkers/priceMarkerDropdown.js`, `src/lib/priceMarkers/priceMarkerInteraction.js`, `src/stores/workspace.js`
- Doc refs (6): assessment, reassessment, audit-2026-06-23, orchestrator-unification-reassessment, triage, stores/CLAUDE.md — filename only, keep descriptions
- tests/ + .cjs/.mjs: none found

## B4 — drop re-exports from xAxisCustom.js + rewire test
- VERIFIED: all 3 symbols (`generateTicks`, `snapToBar`, `formatBoundaryLabel`) come from ONE source module `./xAxisTickGenerator.js` (not 3 separate modules)
- Delete `export { snapToBar, formatBoundaryLabel, generateTicks };` (line 23)
- Rewire `src/lib/chart/__tests__/xAxisCustom.test.js` imports: pull `snapToBar, formatBoundaryLabel, generateTicks` from `../xAxisTickGenerator.js`; keep `setAxisWindow` from `../xAxisCustom.js`
- Update `src/lib/chart/CLAUDE.md:47` — no longer a "re-export barrel"
- ChartDisplay unaffected (only imports set-axis functions)

## Doc-sync triage
- `docs/frontend-sweep-triage-2026-06-29.md` §6: mark B2/B3/B4 ✅ done; note B1 deliberately skipped

## Exclusions
- B1 (getConfig) — skip
- No window.* / E2E; unit tests only
- No symbol name changes

## Verify
1. `npm run test:unit` green (expect 482; xAxisCustom.test.js 54 still pass)
2. `npm run build` succeeds
3. grep repo-wide for `marketProfileHandler`, `markerStore.js`, dropped re-export → zero active refs (historical "deferred/skipped" mentions OK)
