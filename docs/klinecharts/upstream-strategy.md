# KLineChart: Version Status, v10 Adoption Strategy & Upstream Contribution

> **Status snapshot: 2026-06-29.** Living document — re-verify the snapshot table whenever
> revisiting. This is the entry-point reference for "what's our KLineChart situation?"
>
> **Companion docs (do not duplicate here):**
> - [`custom-chart-features.md`](./custom-chart-features.md) — full inventory of the custom
>   features we built on top of KLineChart, grouped by subsystem (x-axis, overlays, drawing
>   persistence, data pipeline, etc.) with file references.
> - [`upstream-pr-calendar-axis.md`](./upstream-pr-calendar-axis.md) — deep v9-vs-v10 axis-API
>   analysis and PR-viability study for the calendar X-axis (dated 2026-04-18).

---

## 1. Do we modify the package? — No

We consume `klinecharts` **unmodified, straight from npm.**

- `node_modules/klinecharts/` is a pristine install — not a git repo, not tracked, no local edits.
- No `patches/` directory, no `patch-package`, no `postinstall` hook in `package.json`.
- Not vendored into `libs/` (only `cTrader-Layer` is vendored there).
- All custom functionality sits **on top of the public API**
  (`registerOverlay`, `registerIndicator`, `registerXAxis`, `setCustomApi`, `createIndicator`,
  action subscriptions) — **~4,465 LOC in `src/lib/chart/`.** See `custom-chart-features.md`.

We are a well-behaved downstream consumer, not a fork. That is the correct posture for
contributing back: our deltas are observable through the public extension API, not buried in
patched internals.

### Pin safety

`package.json` declares `"klinecharts": "^9.8.12"`, which resolves to `>=9.8.12 <10.0.0`.
Because **9.8.12 is the last v9 release** (see snapshot below), a fresh `npm install` pins to
exactly 9.8.12 and **will never silently jump to v10.** "Do nothing" is a stable, intentional
position, not neglect.

---

## 2. Upstream version snapshot (2026-06-29)

From `npm view klinecharts dist-tags`:

| Tag / source | Version |
|---|---|
| **installed** | `9.8.12` |
| **`latest` (npm)** | `10.0.0-beta3` |
| `alpha` (npm) | `10.0.0-alpha9` |

- **`9.8.12` is the final v9 release** — the published version list jumps straight from
  `9.8.12` to `10.0.0-alpha1`. There are **no missing 9.8.x patches** to pick up.
- **v9 is end-of-life** — no future 9.x patches will ship.
- **v10 is a ground-up rewrite** (TypeScript, new `init(ds, options)`, multiple Y-axes,
  continuous-drawing mode + a new built-in `brush` overlay, keyboard-shortcut support, and
  notably **different historical-data loading**). It is still in **beta**.
- The maintainers' own companion app wrapper (`klinecharts/pro`) has **not yet ported to v10**
  (open issue). When the project's own full-app product isn't on v10 yet, that is a strong
  "v10 is not production-ready" signal.

Resources: [repo](https://github.com/klinecharts/KLineChart), [changelog](https://klinecharts.com/guide/changelog),
[v9→v10 migration guide](https://klinecharts.com/en-US/guide/v9-to-v10), legacy [v9 docs](https://v9.klinecharts.com/).

---

## 3. Adoption strategy: stay on v9 — watch, don't chase

**Decision (2026-06-29): remain on 9.8.12. Do not migrate to the v10 beta yet.**

### Why staying is correct now

1. **We're already pin-protected** from accidental v10 uptake (see §1). Doing nothing is safe.
2. **Beta + our own rewrite = churn.** v10 is `beta3` after nine alphas — the API is not frozen.
   Migrating means re-implementing overlay registration and data loading against a target that
   can still break between point releases. (The explicit worry: "rewrite some things, then it
   changes again" — that is the real risk with a beta.)
3. **The maintainers' own `pro` wrapper hasn't ported.** Don't volunteer to be the bleeding-edge
   consumer who discovers the bugs.
4. **Our custom layer is real migration cost, not a bump** (~4,465 LOC on the v9 extension APIs).

### Why this isn't complacency

The counter-argument is valid but affects *timing*, not *direction*: v9 is EOL (no future
patches), and v10 ships features we hand-rolled (continuous drawing, `brush` overlay, multiple
Y-axes). That argues for migrating **eventually**, not **now**.

### Revisit triggers — migrate on a signal, not a calendar

Revisit the decision when **any** of these fire:

- v10 reaches a **stable / release-candidate** tag, **or**
- the `klinecharts/pro` wrapper **ports to v10** (independent readiness signal), **or**
- we genuinely **need a v10-only feature** we can't replicate on v9.

Do not migrate on a schedule. Do not migrate just because "v9 is old."

### Migration risk areas (when the time comes)

Per the v9→v10 guide and our own code, the two most likely breakage points are:

- **Historical-data loading** — the largest behavioral change; our custom loader
  (`chartDataLoader.js`, which bypasses `setDataLoader` entirely) must be re-validated.
- **Overlay / axis registration APIs** — `registerOverlay` / `registerXAxis` signatures are
  similar but not identical (see `upstream-pr-calendar-axis.md` for the axis diff). Every custom
  overlay and the `calendar` axis must be re-tested.

Keep the **upstream-workaround list** (§4.2) with the migration checklist — those are the spots
most likely to behave differently or get fixed upstream.

---

## 4. Upstream contribution assessment

### 4.1 Guiding principle: fix the API limitation, don't paper over it

The most valuable contributions fix a root API limitation rather than ship a workaround for it.
Contributing a workaround entrenches the limitation — every downstream user after you rebuilds
the same duct tape and inherits the same latent bug. **Order of operations: file the API issue
first; build/port the feature on the fixed API second.** (See §4.3 for the concrete case.)

### 4.2 Contribution tiering (2026-06-29 reassessment)

This **supersedes** the "Upstream PR Candidates" table in `custom-chart-features.md`, which was
written from a *useful-feature* lens. The reassessment below applies a stricter
*contribution-readiness* lens: how much is coupled to our app (cTrader feed, symbol-scoped
IndexedDB, brand palette) vs. how much is a clean, generalizable library feature.

| Tier | Feature group | Contribution fit | Why |
|---|---|---|---|
| **A** | Interactive built-in overlays (`ignoreEvent:true`) | **Issue / PR vs v10** | Pure upstream bug; we already isolated the repro. Version-agnostic. |
| **A** | Calendar X-axis + timezone-aware ticks | **Issue first (API gap), then feature** | Library-grade algorithm, but gated on the `createTicks` chart-instance fix (§4.3). |
| **B** | Shape overlays (`rectOverlay`, `circleOverlay`, `polygonOverlay`, `arcOverlay`, `arrowOverlay`) | **Example / docs PR vs v10** | Useful primitives not in the built-in set. Verify v10 hasn't already added them (v10 added `brush`). |
| **B** | Zoom-aware label tiers (`TRANSITION_MATRIX`) | **Possible enhancement** | v10 added static per-period format strings but no adaptive zoom transitions. |
| **C** | Drawing system + IndexedDB persistence + undo/redo command stack | **Keep in-app** | Coupled to symbol-scoped persistence + authenticated backend sync. KLineChart v10 now has continuous-drawing mode, reducing the gap. |
| **C** | Light/dark themes | **Keep in-app** | Branded palette (slate/green-accent, Georgia Pro). Cosmetic. |
| **C** | Data pipeline (custom loader, tick batching, reload orchestration, bar cache) | **Keep in-app** | Coupled to the cTrader WebSocket feed. |
| **C** | Quick Ruler, Price Markers | **Keep in-app** | App-specific UI; Price Markers render on a separate canvas layer outside KLineChart entirely. |

**Reconciliation note for `custom-chart-features.md`:** that doc's candidate table ranked
drawing undo/redo (#2), Quick Ruler (#3), IndexedDB bar cache (#4), and timeframe switching (#5)
as contribution candidates. Under the stricter coupling analysis these are **Tier C — keep
in-app**, not library contributions. The genuinely viable candidates are calendar X-axis (#1),
shape overlays (#6), and zoom tiers (#7).

### 4.3 The two high-value, version-agnostic candidates → file as issues first

These cost nothing to file, help the project, and — strategically — give us signal on maintainer
responsiveness *and* whether our migration pain points get fixed before we ever move to v10
(which would make a future migration cheaper).

#### (A) Built-in overlays block interaction (`ignoreEvent: true`)

We re-register several built-in overlays because the v9.8.x built-ins set `ignoreEvent: true`,
making them unselectable / undraggable / not right-clickable:

- `src/lib/chart/overlaysAnnotations.js` — re-registers `simpleAnnotation` and `simpleTag`.
  (The file even carries a note: *"Remove if upstream klinecharts v9.8.x ignoreEvent:true issue
  is fixed."*)
- `src/lib/chart/overlaysChannels.js` — re-registers `parallelStraightLine` and `fibonacciLine`
  (built-ins don't render as desired).
- `src/lib/chart/overlaysPriceLines.js` — same pattern.

Each module has a guard that warns if the built-in overlay name changes — i.e. we already
anticipated upstream drift. **Action:** file an issue (or PR) proposing built-ins allow
interaction, or at minimum make `ignoreEvent` configurable. First verify whether v10 built-ins
still behave this way.

#### (B) `registerXAxis.createTicks` receives no chart instance

`createTicks({ range, bounding, defaultTicks })` is **not passed the chart instance** it is being
called on behalf of. For a single-chart app that's fine; NeuroSense FX runs **multiple charts**,
each with its own timezone and time window, and the callback can't tell which chart is asking.

Our workaround (`src/lib/chart/xAxisCustom.js`, the `chartRegistry` Map + `_lastChart` pointer,
~lines 76–106) stamps `_lastChart` right before each chart renders and reads it back in
`createTicks`. It works **only because** we bet that rendering is synchronous and non-interleaved
within a frame — a timing implementation detail. If KLineChart ever batches, defers, or reorders
rendering, chart A silently starts drawing chart B's timezone labels with no error.

**Action:** file an issue proposing `createTicks` receive the chart instance (or registration
support per-instance context). **This is the prerequisite for contributing the calendar axis
itself** — see §4.1 and `upstream-pr-calendar-axis.md` ("Required Generalization"), which already
identifies removing the `_lastChart` workaround as a blocker for upstream acceptance.

> "Ride on the API fix first" — explained: the calendar axis is a strong, reusable feature, but
> its *value as a contribution* is gated by this API gap. If we contributed the axis today with
> the `_lastChart` hack, every downstream user rebuilds the same hack and inherits the timing bug.
> Fix the API, then the axis becomes a clean contribution that rides on the fix.

### 4.4 v9-EOL caveat for any code contribution

v9 is end-of-life. **Do not invest effort in v9 PRs.** Any code PR should target the v10 beta and
be **re-implemented, not copy-pasted**, from our v9 JS (v10 is TypeScript-first; state management
and Svelte-store dependencies must be generalized — see the "Required Generalization" section of
`upstream-pr-calendar-axis.md`). Issues, however, are version-agnostic and can be filed now.

### 4.5 Action checklist

- [ ] File v10 issue (A): built-in overlays `ignoreEvent: true` blocks interaction.
- [ ] File v10 issue (B): `registerXAxis.createTicks` should receive the chart instance
      (multi-chart support).
- [ ] If/when the maintainers respond positively to (B), evaluate porting the calendar axis as a
      v10 feature PR (re-implement in TS, generalize config, add tests).
- [ ] Before any v10 migration: re-verify whether (A) and (B) were fixed — if so, the
      `overlaysAnnotations/Channels/PriceLines` re-registrations and the `_lastChart` workaround
      may be removable.

---

## 5. Decision log

| Date | Decision |
|---|---|
| 2026-06-29 | Remain on `9.8.12`; do not chase v10 beta. Watch-don't-chase posture with explicit revisit triggers (§3). Contribution focus = file issues (A) and (B) against v10, not v9 PRs. |
