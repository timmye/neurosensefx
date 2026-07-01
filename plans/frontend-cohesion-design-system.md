# Frontend Cohesion & Design System — Implementation Plan

**Status:** ✅ IMPLEMENTED 2026-07-01 (all 8 tasks, 6 staged steps). See **Execution record** below. Design ref: `docs/frontend-cohesion-design-2026-06-30.md` (§13).
**Approach:** Option 2 — token layer + shared display primitives + `+` menu. ~400–450 new LOC, ~250–300 net, ~2 days.
**Scope guard:** Chart **internals** untouched. Svelte 4 (no runes). No code-splitting. `window.*` globals stay (E2E-load-bearing).

> ### Execution record (2026-07-01)
> Each step gated by `npm run build` + `npm run test:unit` (**487/487 green**) and a quality-reviewer pass on the structural stages (3 + 5). Build ~625 kB. **No critical/major findings** across 5 review passes; one SHOULD was applied (AddMenu `:focus-visible` rings), one SHOULD debunked (DisplayHeader `:root` font-vars are global/unscoped in compiled CSS — they work).
>
> **Done:** Task 1 tokens + theme wiring (default dark) + `src/index.html` neutralized; Task 2 nine shell files migrated to tokens (hex gate clean); Task 3 `<DisplayFrame>` extraction + green selection (Floating/FxBasket/Headlines) + FloatingDisplay flash removed; Task 4 `<DisplayHeader>` minimal + `<IconButton>`; Task 5 `<AddMenu>` + keyboard re-route; Task 6 logout wired; Task 7 `addDisplay`/`addPriceTicker` optional `size` arg; Task 8 background unified.
>
> **Deviations (sensible, documented; see design doc §13):** (1) **Alt+B stays direct-add** (no symbol → no menu stop); Alt+A/T/I open the menu with the field focused. (2) **`addDisplay` size = the documented fallback** — no-arg/1–3-arg callers keep `defaultSize` for backward-compat; explicit `size` overrides only. (3) **Root `index.html` deleted** (`vite root:'src'` → `src/index.html` is the sole entry). (4) DisplayFrame keeps `:focus` glow per §1.3.
>
> **E2E caveat:** `console-check.spec.js` fails only on a **pre-existing 401** (`checkSession` on an unauthenticated browser — not this work; `authStore` only added `export` to `logout`). Spec hardcodes `localhost:5174` (flaky in WSL2). Full chart-interaction E2E pending a stable backend run.
>
> **Phase-2 carry-over:** chart chrome on tokens, z-index unification, PriceTicker→`<DisplayFrame>` wrap-up, light-theme polish on residual **DOM** `rgba` overlays (the canvas side — all shell-canvas colors — was resolved 2026-07-01 by `src/lib/canvasTheme.js`; see `plans/canvas-theme-system.md`).

---

## Phase 0 — Context & Scope

### Problem
The shell UI is five unrelated visual dialects (46 hex colors, 6 border-radius values, 4 "active" colors), all display-creation goes through browser `prompt()`, and landing/empty-state/logout don't exist as UI. No design system; `themeStore` is vestigial (never wired to the DOM). Full evidence + audit: `docs/frontend-cohesion-design-2026-06-30.md` §2–§4.

### In scope
- `src/styles/tokens.css` — 2-tier role-locked CSS custom properties (primitive → semantic).
- Theme DOM wiring: `themeStore` → `<html data-theme>`. Default theme → `dark`.
- Migrate shell components to tokens (PriceTicker, FloatingDisplay, DisplayHeader, FxBasketDisplay, HeadlinesWidget, WorkspaceModal, KeyboardShortcutsHelp, LoginForm, App, index.html).
- Extract `<DisplayFrame>` (dedup the 3× copy-pasted `.floating-display` + consolidate interact.js setup).
- Consolidate `<DisplayHeader>` (retire Headlines' bespoke header) + `<IconButton>` (refresh/close defined once).
- `<AddMenu>` — the `+` floating button + expand menu (additive display types w/ shortcuts + native symbol field; Chart/News singleton toggles; Shortcuts; Logout).
- Logout UI (re-export + wire `authStore.logout()`).
- `addDisplay` size-param latent-bug fix (backward-compatible).
- Selection: propagate green to FloatingDisplay; remove cyan border from PriceTicker's selected state; remove cyan/magenta flash from FloatingDisplay.
- Background unification (retire plum `#1a0a1a` + blue-black radial).

### Out of scope (explicit)
- **Chart internals** — `ChartDisplay` canvas/KLineChart, `QuickRuler`, `PriceMarkerManager`, chart canvas fonts, price-marker compute, KLineChart config/themes, `chartTheme*`.
- **Chart-adjacent DOM chrome (deferred to Phase 2, alongside toolbar)** — styled *surfaces* the token migration deliberately does not touch this phase (chart ethos = untouched). Named explicitly so nothing is dropped silently:
  - `ChartToolbar.svelte` — toolbar chrome (white+green / slate-dark dialect).
  - `ChartDisplay.svelte` *window frame* — the chart container's own frame (bg/border/focus-glow `#48752c`/resize-handle, `.dark` `#0b0e14`/`#34d399`), distinct from its canvas internals. *(Design doc §2.5 attributes all chart chrome to ChartToolbar; that misses this frame — corrected here.)*
  - `OverlayContextMenu.svelte` — right-click Delete/Lock/Pin menu for drawings (rendered at `ChartDisplay.svelte:490`); hardcoded hex + slate `.dark` palette + z-index `1000/1001`. Already binds `themeStore` directly (`class:dark={$themeStore==='dark'}`), so it stays theme-reactive via its own path — the new `[data-theme]` wiring is **not** required for it. Cheap Phase-2 pickup since it already reads the store.
  - `displays/DisplayCanvas.svelte` — `FloatingDisplay`'s body canvas; `<style>` hardcodes bg `#0a0a0a` (= `--black-900`) + font-family. Child of an in-scope component, but its styling is canvas-bg — left alone this phase.
- **z-index unification** — deferred. Existing raw values (`OverlayContextMenu` 1000/1001, `ChartToolbar` z-15) stay as-is; the token scale (`--z-overlay:10000`/`--z-modal:10001`) is for *new* components only (`<AddMenu>` at 10000 stacks above both legacy values). Reconciling legacy z-index is Phase 2.
- Symbol validation / history / autocomplete (deferred by user).
- Empty-state component (blank + `+` is the empty state), settings surface, layout presets, toast/error-boundary, touch/mobile.
- Atom library + 3-tier tokens (Option 3).

### Verified facts this plan relies on
| Fact | Evidence | Implication |
|---|---|---|
| `themeStore` not wired to DOM | grep `data-theme`/`documentElement` in `src/**` (excl. dist) = empty | Theme-skinning is net-new; safe to add |
| `displayStore` has no unit test | `src/stores/__tests__/` lists 4 files, none for displayStore | `addDisplay` signature change is safe at unit level |
| `addDisplay` callers use 1–3 args | E2E: `addDisplay('EURUSD')`, `addDisplay(s,pos,src)`; keyboard passes a dead 4th `{220×360}` | Add optional `size` as **4th param** = backward-compatible; keyboard arg becomes live (latent-bug fix) |
| `logout()` private + 0 callers | `authStore.js:178`; only API URL + E2E `fetch('/api/logout')` | Re-export it for `<AddMenu>` |
| 'Georgia Pro' = canvas font | chart themes, `dayRangeConfig`, `fxBasketConfig`, `priceMarkerRenderer`, `canvasStatusRenderer` | Font token is **shell DOM only**; canvas fonts untouched |
| `index.html` hardcodes `Arial` + `#1a0a1a` root bg | `index.html:44-45` | Align to neutral + system stack (hardcoded; vars load via JS) |
| `config.defaultSize = 2000×680` | `displayStore.js:9` | Used by chart ghost; day-range panels intend 220×360 (see Task 7) |

### Coverage audit — full styling surface (vet 2026-06-30)
Every hex-bearing file in `src` (excl. `dist/`) classified — confirms nothing is implicitly dropped. New components added by this plan: `styles/tokens.css`, `components/displays/DisplayFrame.svelte`, `components/IconButton.svelte`, `components/AddMenu.svelte`.

| File(s) | Classification |
|---|---|
| `App.svelte`, `index.html` | **In scope** — Task 1 (theme wiring + bg neutralization) |
| `PriceTicker`, `FloatingDisplay`, `FxBasketDisplay`, `HeadlinesWidget`, `displays/DisplayHeader`, `LoginForm`, `WorkspaceModal`, `KeyboardShortcutsHelp`, `Workspace.css` | **In scope** — Task 2 (token migration) |
| `ChartToolbar`, `ChartDisplay` *frame*, `OverlayContextMenu`, `displays/DisplayCanvas` | **Out — chart-adjacent DOM chrome** (Phase 2; named in Out-of-scope) |
| `QuickRuler` (canvas), `PriceMarkerManager` (canvas, no `<style>`) | **Out — chart internals** |
| `Workspace.svelte` | No real hardcoded hex (regex matched `{#each}`); touched in Task 5 to mount `<AddMenu>` |

---

## Phase 1 — Decision & Architecture

### 1.1 Token system (`src/styles/tokens.css`, new)
Two tiers. Primitive = raw values, never consumed directly. Semantic = what components consume; swapped per theme.

```css
:root,
[data-theme="dark"] {
  /* primitive */
  --black-900:#0a0a0a; --black-800:#141414; --black-700:#1a1a1a; --line:#333333;
  --grey-100:#ffffff; --grey-200:#cccccc; --grey-400:#888888; --grey-500:#666666;
  --cyan:#00d4ff;   /* TICKER FLASH ONLY */
  --magenta:#e040fb;/* TICKER FLASH ONLY */
  --green:#00ff00;  /* SELECTION / chart-bound ONLY */
  --blue:#4a9eff;   /* CHROME ACCENT */
  --ok:#4CAF50; --warn:#FF9800; --bad:#F44336; --idle:#9E9E9E;

  /* semantic */
  --bg-app:var(--black-900); --bg-frame:var(--black-800); --bg-header:rgba(42,42,42,.95);
  --border:var(--line);
  --text-primary:var(--grey-100); --text-secondary:var(--grey-200);
  --text-label:var(--grey-400); --text-muted:var(--grey-500);
  --flash-up:var(--cyan); --flash-down:var(--magenta);   /* PriceTicker only */
  --select:var(--green);                                  /* selected/chart-bound */
  --accent:var(--blue);                                   /* focus/active/hover */
  --status-ok:var(--ok); --status-warn:var(--warn); --status-bad:var(--bad); --status-idle:var(--idle);

  /* non-color */
  --sp-1:2px; --sp-2:4px; --sp-3:6px; --sp-4:8px; --sp-6:12px; --sp-8:16px;
  --r-0:0; --r-sm:2px; --r-md:4px;
  --fs-10:10px; --fs-11:11px; --fs-12:12px; --fs-14:14px; --fs-16:16px; --fs-20:20px; --fs-32:32px;
  --lh-tight:1.2;
  --font-ui:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --font-mono:"SF Mono",Monaco,"Cascadia Code",monospace;
  --z-frame:1; --z-header:10; --z-overlay:10000; --z-modal:10001;
  --glow-select:0 0 8px rgba(0,255,0,.5);
  --glow-focus:0 0 8px rgba(74,158,255,.4);
}

[data-theme="light"] {
  /* semantic overrides only — flip the semantic layer here */
  --bg-app:#e8e8e8; --bg-frame:#f4f4f4; --bg-header:rgba(224,224,224,.95);
  --border:#cccccc;
  --text-primary:#1a1a1a; --text-secondary:#333333; --text-label:#555555; --text-muted:#888888;
  /* flash/select/accent hues unchanged; status unchanged */
}
```
- **Import once globally:** `import './styles/tokens.css'` in `src/main.js` (before `new App`).
- **Theme wiring (net-new):** in `App.svelte`, add `import { themeStore } from './stores/themeStore.js'` and `$: if (typeof document !== 'undefined') document.documentElement.dataset.theme = $themeStore;`.
- **Default theme → dark:** `themeStore.js` change `stored === 'dark' ? 'dark' : 'light'` → `stored ?? 'dark'` (i.e. default `dark` when nothing stored; respect stored preference). Effect: new users get dark shell + dark toolbar (matches the existing dark workspace; removes the jarring white toolbar default).

### 1.2 Color role map (locked — each color one job)
| Token | Value | Job | Scope |
|---|---|---|---|
| `--flash-up/down` | cyan / magenta | ticker tick flash | **PriceTicker only** |
| `--select` | green | selected = drives the global chart | all selectable displays |
| `--accent` | blue | focus rings, active menu, hovers | chrome |
| `--status-*` | green/orange/red/grey | connection state | connection dots |

### 1.3 Component architecture
- **`<DisplayFrame>` (`src/components/displays/DisplayFrame.svelte`, new)** — owns: absolute positioning, frame bg/border/radius, **selection ring (`--select`)**, **focus glow (`--accent`)**, optional **flash border (`--flash-*`; ticker-only)**, the resize handle, and the **interact.js setup** (consolidates the 3–4× `createInteractConfig` boilerplate). Props: `{ position, size, zIndex, selected, resizable, flash /* 'up'|'down'|null */, interactCallbacks }`, slots: default (body), `header`. Adopted by FloatingDisplay, FxBasketDisplay, HeadlinesWidget. *(PriceTicker keeps its own shell in this phase — token-only migration — to avoid disturbing its tuned rAF flash logic. Optional wrap-up later.)*
- **`<DisplayHeader>` (existing, extended)** — already shared by Floating + FxBasket. Add a `minimal` mode (symbol + close only) so **Headlines drops its bespoke `.display-header`**. Connection dot + badges remain optional via props.
- **`<IconButton>` (`src/components/IconButton.svelte`, new)** — one component for `↻` refresh / `×` close (and future) with a `variant` (ghost/subtle). Replaces the 4 re-implemented button style blocks.
- **`<AddMenu>` (`src/components/AddMenu.svelte`, new)** — the `+` button (fixed top-right) + expand menu. See Task 5.

### 1.4 Display-type semantics (drives AddMenu structure)
| Kind | Displays | AddMenu behavior |
|---|---|---|
| Additive (new panel + symbol) | Price Ticker, cTrader Display, TradingView Display, FX Basket | click → symbol field → `addPriceTicker`/`addDisplay` |
| Singleton toggle | Chart (follows green-selected ticker), News | click → toggle; item shows open/closed state |

---

## Phase 2 — Refinement (task breakdown)

Each task is independently shippable. Run verification gates (Phase 3) after each.

### Task 1 — Token foundation + theme wiring
**Files:** `src/styles/tokens.css` (new), `src/main.js`, `src/App.svelte`, `src/stores/themeStore.js`, `src/index.html`.
**Changes:**
1. Create `src/styles/tokens.css` (§1.1).
2. `main.js`: `import './styles/tokens.css';` before `new App(...)`.
3. `App.svelte`: import `themeStore`; reactive `$: document.documentElement.dataset.theme = $themeStore;`. Also swap the hardcoded `#1a0a1a` `.loading`/`main` bg → `var(--bg-app)`, color → `var(--text-label)`.
4. `themeStore.js`: default `dark` (§1.1).
5. `index.html`: root `background:#1a0a1a` → `#0a0a0a` (neutral, pre-JS); `font-family:Arial` → the `--font-ui` stack literal (vars not available pre-JS).
**Acceptance:** build clean; app loads dark; toggling theme flips `<html data-theme>` and (once Task 2 lands) the shell swaps.
**Risk:** none (additive).

### Task 2 — Migrate shell components to tokens
**Files:** `PriceTicker.svelte`, `FloatingDisplay.svelte`, `DisplayHeader.svelte`, `FxBasketDisplay.svelte`, `HeadlinesWidget.svelte`, `WorkspaceModal.svelte`, `KeyboardShortcutsHelp.svelte`, `LoginForm.svelte`, `Workspace.css`.
**Changes:** replace hardcoded hex/radius/font with token vars per the role map. Start with **PriceTicker** (defines the tokens → expect ~zero visual change there, *except* **remove `border-color:#00d4ff` from `.ticker-container.selected`** → selected becomes green-only).
**Specific role fixes:**
- `FloatingDisplay.svelte`: `.floating-display` bg→`--bg-frame`, border→`--border`, radius→`--r-md`, focus glow→`--glow-focus`/`--accent`. **Remove `.flash-up/.flash-down` rules (lines ~170-176)** — ticker-only. **Add selection**: when `selected`, apply `--select` ring (Task 3 wires the prop).
- `LoginForm.svelte`: retire plum/indigo (`#2a1a2a`/`#7c5caf`/`#3a2a3a`) → token neutrals + `--accent`. Radius `8px`→`--r-md`, padding `2rem`→`--sp-8`.
- `WorkspaceModal.svelte` + `KeyboardShortcutsHelp.svelte`: retire indigo `rgb(79,70,229)`/blue-black → tokens; radius `8px`→`--r-md`; kill big drop-shadows; padding `24px`→`--sp-6`.
- `Workspace.css`: radial `rgb(26,26,46)/rgb(15,15,30)` → `var(--bg-app)` solid.
**Acceptance:** no hardcoded hex in migrated files (grep gate); visual = PriceTicker-baseline everywhere; theme toggle re-skins the shell.
**Risk:** PriceTicker flash logic untouched (colors only). Verify flash still ticker-only.

### Task 3 — `<DisplayFrame>` extraction + selection propagation
**Files:** `DisplayFrame.svelte` (new); refactor `FloatingDisplay.svelte`, `FxBasketDisplay.svelte`, `HeadlinesWidget.svelte`.
**Changes:**
1. Build `<DisplayFrame>` per §1.3 (frame chrome + interact.js + selection ring + optional flash + resize handle + header/body slots).
2. FloatingDisplay: replace its `.floating-display` wrapper + `createInteractConfig` call with `<DisplayFrame selected={...} resizable flash={null}>`. **Pass `selected={$displayStore.selectedDisplayId === display.id}`** so it shows the green ring.
3. FxBasketDisplay + HeadlinesWidget: same adoption (delete their copy-pasted `.floating-display` blocks).
**Acceptance:** the 3 displays render identically to pre-task; selection ring (green) appears on the focused/chart-driving display; FloatingDisplay no longer flashes.
**Risk:** interact.js binding through a child component — expose the root element from `<DisplayFrame>` (e.g. `bind:this` forwarded via a prop or `createEventDispatcher` on mount) so the parent's `onMount` can hand it to `createInteractConfig`, **or** move `createInteractConfig` *inside* `<DisplayFrame>` (preferred — frame + drag/resize move together). Verify drag/resize/snap unchanged.

### Task 4 — `<DisplayHeader>` consolidation + `<IconButton>`
**Files:** `DisplayHeader.svelte`, `HeadlinesWidget.svelte`, `IconButton.svelte` (new).
**Changes:**
1. `<IconButton variant="ghost">` for `↻`/`×`; use inside DisplayHeader.
2. DisplayHeader: add `minimal` mode (symbol + close only, no badge/connection/refresh).
3. HeadlinesWidget: replace bespoke `.display-header` with `<DisplayHeader minimal symbol="HEADLINES" onClose=...>`.
**Acceptance:** Headlines header matches other displays; one button style across the app.

### Task 5 — `<AddMenu>` (+ native symbol field, Chart/News toggles, keyboard re-route)
**Files:** `AddMenu.svelte` (new), `Workspace.svelte` (mount it), `workspaceKeyboardShortcuts.js`.
**Changes:**
1. `<AddMenu>`: fixed `+` button top-right (`z-index: var(--z-overlay)`). Click → menu. Sections:
   - **Additive** — Price Ticker (`Alt+I`), cTrader Display (`Alt+A`), TradingView Display (`Alt+T`), FX Basket (`Alt+B`). Click → reveal native `<input>` symbol field → on Enter: `formatSymbol(value, source)` then `workspaceActions.addPriceTicker`/`addDisplay` (with size, Task 7). **Replaces `prompt()`.**
   - **Toggles** — Chart (`c`): reads `displayStore` for existing chart → label shows open/closed → click calls `toggleChart()`. News (`H`): reads `headlinesStore.headlinesVisible` → click `toggleHeadlines()`.
   - **Shortcuts** → opens `KeyboardShortcutsHelp` (same as `?`).
   - **Logout** → `logout()` (Task 6).
2. Open/close: `keyManager.pushEscape` to close; click-outside to close.
3. **Keyboard re-route (consistency):** in `workspaceKeyboardShortcuts.js`, change `Alt+A/T/I/B` from `prompt(...)` to opening `<AddMenu>` with the relevant type pre-selected + symbol field focused. (Keep `c`, `H`, `Alt+W/R/M`, arrows, `?` as-is.)
**Acceptance:** mouse + keyboard both use the native symbol field; no `prompt()` remains in add paths; Chart/News toggles reflect state; menu closes on Esc/outside.
**Risk:** keyboard re-route changes long-standing muscle memory fallback — verify `?` overlay + all shortcuts still in `KeyboardShortcutsHelp` (update labels if any change).

### Task 6 — Logout wiring
**Files:** `authStore.js`, `AddMenu.svelte`.
**Changes:** re-export `logout` from `authStore.js` (Batch A4 dropped the export as unused — now it has a caller); call it from the AddMenu Logout item.
**Acceptance:** clicking Logout hits `/api/logout` + reloads → returns to LoginForm. Existing `auth-flow.spec.js` (which calls the API directly) still passes.
**Risk:** none.

### Task 7 — `addDisplay` size-param latent-bug fix
**Files:** `displayStore.js`, `workspaceKeyboardShortcuts.js` (already passing size), `AddMenu.svelte`.
**Changes:**
1. `addDisplay(symbol, position=null, source='tradingview', size=null)`: when `size` provided, use it; else fall back to a **per-type sensible default** (see decision below). `addPriceTicker` similarly accepts optional size (ticker stays fixed 240×80 unless overridden).
2. Decide per-type defaults (verify against E2E in Phase 3):
   - cTrader / TradingView day-range panel: `220×360` (the intent the keyboard path already expressed).
   - FX Basket: `360×360` (grid of pairs needs more room — confirm by opening one).
   - Chart: unchanged (own path via `addChartDisplay` + ghost).
**Acceptance:** new displays spawn at intended compact sizes, not 2000×680; E2E suite still green.
**Risk:** E2E callers use 1–3 args (backward-compatible), but some may implicitly rely on the large default. **Gate: run E2E.** If any spec breaks on size, fall back to "keep `config.defaultSize` for the no-arg path; pass explicit compact size only from keyboard + AddMenu."

### Task 8 — Background unification + index.html polish
**Files:** `App.svelte`, `Workspace.css`, `index.html` (partly Task 1).
**Changes:** ensure the only app background is `--bg-app` (solid neutral); remove the radial gradient and plum. Confirm no flash-of-plum on load (index.html pre-JS bg already neutral from Task 1).
**Acceptance:** calm neutral-black canvas everywhere, including the brief pre-JS load.

---

## Phase 3 — Final Verification

**Per-task gates (run after each task):**
- `npm run build` — clean, bundle ~622 kB (tokens.css adds negligible).
- `npm run test:unit` — **482/482 green** (token migration is CSS-only; displayStore has no unit test, so Task 7 won't touch unit tests).
- `tests/e2e/console-check.spec.js` — zero `console.error` during init (any new expected-condition log → `console.warn`).

**Full E2E run (requires backend + PG + Redis) — at minimum after Tasks 5 + 7:**
- Existing add/logout/persistence/chart specs green.
- Specifically watch: anything asserting display size (Task 7), `window.workspaceActions.addDisplay` shape (unchanged), and that `window.*` globals still exist.

**Manual UI checklist:**
- [ ] App loads dark; theme toggle re-skins the **whole shell** (not just chart).
- [ ] `+` button top-right; menu lists all display types w/ shortcuts; Chart + News show toggle state.
- [ ] Adding a display uses a native symbol field (no browser prompt); spawns at intended compact size.
- [ ] Selecting a display shows a **green** ring on every display type; the **chart re-points** to it.
- [ ] PriceTicker still flashes cyan/magenta on ticks; **no other display flashes**.
- [ ] PriceTicker selected state is green-only (no cyan border).
- [ ] All frames share border/radius/header/close/refresh; Headlines header matches.
- [ ] Logout returns to LoginForm.
- [ ] Keyboard shortcuts all still work (incl. `?` overlay, arrows, `Alt+M`, `c`, `H`).

**Regression watches:** PriceTicker rAF flash; chart follows selection; workspace persistence (drag/resize/autosave); `beforeunload` beacon; FX basket 30s refresh.

---

## Phase 4 — QR (Quality Review)

**Completeness:** every In-scope item ✓; no `prompt()` in add paths; logout reachable; green selection on all selectable displays; flash ticker-only.

**Code:**
- Grep gate: `grep -rn '#[0-9a-fA-F]\{3,8\}' src --include='*.svelte' --include='*.css' | grep -v src/dist` → remaining hex should be **only**: token defs in `tokens.css`; the deferred chart-adjacent chrome (`ChartToolbar`, `ChartDisplay` frame, `OverlayContextMenu`, `DisplayCanvas`); and chart-internal canvas files (`QuickRuler`, `PriceMarkerManager`, `src/lib/**` renderers). Investigate any hex found in the 9 migrated shell files / `App.svelte` / `index.html`.
- No new `console.error` on expected paths; `window.*` globals intact; no DEV-gating of E2E-load-bearing globals.
- No hardcoded `border-radius` outside `{--r-sm,--r-md,50%}` in shell.

**Docs (sync — see Phase 5):** reassessment §2.5 + §4 updated; `components/CLAUDE.md` + `stores/CLAUDE.md` list new files; this plan + the design doc cross-linked.

---

## Phase 5 — Technical Writer (doc-sync)

1. `docs/frontend-architecture-reassessment-2026-06.md`:
   - §2.5 Theme system: "No design tokens. Mix of inline styles and classes." → "Token-driven (2-tier, role-locked); shell skins via `[data-theme]`; default dark."
   - §4 Deferred table: move **"Design tokens"** and **"Shared modal/component base"** → Done (trigger met: this work).
2. `src/components/CLAUDE.md`: add `DisplayFrame.svelte`, `IconButton.svelte`, `AddMenu.svelte`.
3. `src/styles/` (new dir): add a one-line note in `src/CLAUDE.md` for `styles/tokens.css`.
4. Keep `docs/frontend-cohesion-design-2026-06-30.md` as the design reference; link it from the reassessment.

---

## Carry-forward constraints (do not violate)
- `window.*` globals stay (E2E-load-bearing). Never DEV-gate without migrating specs.
- Svelte 4 (no runes). No code-splitting. Chart internals + canvas fonts untouched.
- `console.error` off expected paths (console-check spec).
- Per-item verification before any deletion (no bulk-delete on agent say-so).
- This work un-defers *design tokens* + *shared component/modal base* only. All other reassessment §4 deferrals stand.

## Sequencing summary (5 shippable steps)
1. Tokens + theme wiring + index.html neutral. → 2. Migrate shell to tokens (PriceTicker first). → 3. `<DisplayFrame>` extraction + green selection. → 4. `<DisplayHeader>` + `<IconButton>`. → 5. `<AddMenu>` + logout + size-bug fix + bg unification.

## Deferred to Phase 2 / Option 3
Toolbar chrome on tokens; full atom library; 3-tier component tokens; `chartTheme*` from shared palette via `buildTheme()`; symbol validation/history/autocomplete; settings surface; empty-state component; toasts.
