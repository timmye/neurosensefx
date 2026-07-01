# Frontend Cohesion & Design System — Assessment + Design

**Date:** 2026-06-30 (rev 3 — vet pass: chart-adjacent chrome coverage corrected + z-index noted; rev 2 = chart-in-menu, flash-color role lock, accent resolved)
**Status:** ✅ IMPLEMENTED 2026-07-01 (Option 2, all 8 tasks). See §13 (implementation record). This doc remains the design reference; `docs/frontend-architecture-reassessment-2026-06.md` §2.5/§4 + the dir `CLAUDE.md` indexes are updated.
**Scope:** Frontend shell UX/UI + design system (`src/components/**`, `src/stores/themeStore.js`). **Chart internals are explicitly out of scope** (per project instruction); chart *chrome* (toolbar) is an optional Phase-2 addition only.

---

## 0. TL;DR

The functionality and data plumbing are solid, but the **shell UI is five unrelated visual dialects stacked on top of each other**, every display-creation routed through browser `prompt()`, and three core trader-loop steps (**landing, empty-state, logout**) don't exist as UI at all. There is **no design system**: 46 hex colors, 6 `border-radius` values, and 4 different "selected/active" colors are hardcoded across per-component `<style>` blocks.

**Decision:** Build **Option 2 — token layer + shared display primitives + the `+` menu** (~400–450 new LOC, ~2 days). PriceTicker is the canonical visual baseline. Chart internals untouched. This un-defers two items the prior audits had parked (design tokens, shared modal/component base) because the user has explicitly triggered this work.

**Read before any structural work:** `docs/frontend-architecture-reassessment-2026-06.md` (deferred-items list) and `docs/frontend-sweep-triage-2026-06-29.md` (do-not-retread list). This doc does not re-litigate those.

---

## 1. Current state — the trader loop mapped to reality

| Flow step (intended) | What exists today | Gap |
|---|---|---|
| **Landing page** | None. `App.svelte:20-27` gates on `isAuthenticated` → `LoginForm` or `Workspace`. | LoginForm **is** the landing (decided). |
| **Login / signup** | `LoginForm.svelte` — tabbed login/register, plum palette `#2a1a2a` / `#7c5caf`. | Works; wrong dialect. |
| **Empty workspace** | Blank `.workspace` div, radial-gradient bg, zero affordance. | No first-run entry point (the `+` fixes this). |
| **Discover + add displays** | Keyboard only: `Alt+A/T/I/B`, `c` (chart), `H` (news) → `prompt('Enter symbol:')`. | **No `+`, no menu, no discoverability, native symbol picker.** |
| **Arrange / change / autosave** | interact.js drag/resize, 10px grid-snap, localStorage debounced + server. | Works well. |
| **Logout / close** | `logout()` exists at `authStore.js:178` but is **private + unwired** (0 callers). | **No logout UI** — impossible without devtools. |
| **Monitor (established)** | Persisted workspace restores on login. | Works. |

**Display creation today** (`workspaceKeyboardShortcuts.js:31-63`): every path is `keyManager.register({alt:true}) → prompt('Enter symbol:')`. That is the entire "add display" UX. The only `.svelte` caller of any `add*` action is `addChartDisplay` inside the `c`-key handler (`Workspace.svelte:134`).

---

## 2. Exhaustive display audit (design elements, nested)

Each display resolves to **frame + optional header + body + resize model**. The frame/header/resize "core" is **copy-pasted 3×** (FloatingDisplay, FxBasketDisplay, HeadlinesWidget) — the single biggest DRY win available.

### 2.1 Price Ticker — `PriceTicker.svelte` (595 LOC) — *CANONICAL BASELINE*
- **Frame:** fixed `240×80`, bg `#141414`, border `1px #333`, radius `4px`; no header. `box-sizing:border-box`, `tabular-nums`.
- **Selection:** green outline `2px #00ff00` + `0 0 8px rgba(0,255,0,.5)` glow **+ a cyan `#00d4ff` border**. **Green is meaningful — it marks the symbol driving the global chart** (the selected display re-points the chart). ⚠️ The cyan border mixed into the selected state must go (cyan → ticker-flash-only); selected state becomes **green-only**. Green is to be propagated to *all* selectable displays as the single "chart-bound" signal.
- **Flash:** border `#00d4ff` (up) / `#e040fb` (down), 500ms ease-out; rAF-coalesced. ⚠️ **These two colors are TICKER-ONLY by rule (rev 2)** — see §6.
- **Actions:** `↻` refresh + `×` close, top-right, `18×18`, `opacity:0→1` on hover. *No header bar.*
- **Body:** 3-column flex — (1) identity [symbol 16px/600 `#888`, price 32px/600 `#fff` w/ pip split + pipette], (2) mini market-profile canvas `37.5×80`, (3) stats [H / daily-change% / range% / L] at 11px.
- **Resize:** none (fixed).

### 2.2 cTrader / TradingView display — `FloatingDisplay.svelte` (186) + `DisplayHeader.svelte` (86) + `DisplayCanvas.svelte` (141)
The "market profile / day-range" display. `Alt+A`=cTrader, `Alt+T`=TradingView.
- **Frame:** resizable, bg `#1a1a1a`, border `1px #333`, radius `4px`. Focus: blue `#4a9eff` border + glow. ⚠️ `#1a1a1a` ≠ ticker `#141414`.
- **Selection:** ⚠️ none today — must **gain the green selection treatment** to match the ticker (it's a selectable display that can drive the chart). Blue focus glow stays as the *focus* signal, distinct from green *selection* (see §6).
- **Flash:** cyan/magenta border (`FloatingDisplay.svelte:170-176`). ⚠️ **Must change (rev 2):** flash colors are ticker-only — floating displays lose cyan/magenta (neutral or no flash).
- **Header:** `DisplayHeader` — `40px`, **hidden by default**, revealed by a `20px` top trigger-zone on hover (800ms hide delay). bg `rgba(42,42,42,.95)` + `4px` blur.
- **Header pills:** symbol 16px/600 white; **combined badge** `MP/cT` or `DR/TV` (10px, `#4a9eff` on `#1a1a1a`, radius `2px`); **connection dot** 6px (Material `#4CAF50`/`#FF9800`/`#9E9E9E`/`#F44336`); `↻` refresh; `×` close.
- **Body:** canvas bg `#0a0a0a`, renders day-range or market-profile (toggled `Alt+M`). *(This bg lives in `DisplayCanvas.svelte` and equals `--black-900`; left as-is this phase — deferred chart-adjacent chrome.)*
- **Resize:** se-handle `16×16` diagonal hatch, edges right+bottom, min `150×80`, 10px snap.

### 2.3 FX Basket — `FxBasketDisplay.svelte` (201)
- **Frame:** verbatim copy-paste of 2.2's `.floating-display` block. Header via shared `DisplayHeader` (symbol `"FX BASKET"`, `showMarketProfile=false`).
- **Body:** canvas `#0a0a0a`, basket grid. 30s subscription refresh + freshness check + debug API.
- **Resize:** same se-handle.

### 2.4 News feed (Headlines) — `HeadlinesWidget.svelte` (90)
- **Frame:** copy-paste of `.floating-display` again.
- **Header:** ⚠️ **bespoke** `.display-header` (40px, `rgba(42,42,42,.95)`, *no blur*) — does **not** use `DisplayHeader`. Only "HEADLINES" + `×`. No badge, no connection dot, no refresh.
- **Body:** third-party FinancialJuice widget (`window.FJWidgets`, iframe-like, own colors `1e222d`/`b2b5be`) — **black box; internals cannot be restyled**, only framed.
- **Resize:** se-handle + 300ms-debounced widget recreate. Toggle: `H`; state in `headlinesStore` (not `displayStore`).

### 2.5 Chart — `ChartDisplay.svelte` + `ChartToolbar.svelte` (471) — *SINGLETON; OUT OF SCOPE (internals)*
- **Singleton global display.** `Workspace.svelte:104-122` `toggleChart()` closes if open, creates if closed (key `c`). Arrow-nav skips it (`displayStore.js:130`).
- **Follows the selected (green) ticker.** `Workspace.svelte:24-36` reactively re-points the chart at `selectedDisplayId`'s symbol whenever selection changes. So "the green-highlighted symbol" = the symbol the chart is rendering.
- **Chart-adjacent DOM chrome** (deferred to Phase 2; chart ethos = untouched) — not just the toolbar:
  - `ChartToolbar.svelte` — light-by-default (`#FFFFFF`/`#CCCCCC`/active `#48752c` dark-green) with a `.dark` slate override (`#475569`/`#94a3b8`/`#e2e8f0`) — a **4th + 5th dialect**.
  - `ChartDisplay.svelte` *window frame* — the chart container's own frame (bg `#FAFAFA`, border `#D0D0D0`, focus-glow `#48752c`, resize handle; `.dark` `#0b0e14`/`#34d399`), a styled surface distinct from the canvas internals. *(Rev 2 attributed all chart chrome to ChartToolbar; that missed this frame — corrected in vet.)*
  - `OverlayContextMenu.svelte` — right-click Delete/Lock/Pin menu for drawings (rendered at `ChartDisplay:490`); hardcoded hex + slate `.dark` palette + z-index `1000/1001`. Already binds `themeStore` (`class:dark`), so it stays theme-reactive via its own path.

  All three keep raw hex this phase; they may join tokens in Option 3 / Phase-2 only. Chart *internals* untouched.

### 2.6 Shortcut overlay — `KeyboardShortcutsHelp.svelte` (197)
- Full-screen overlay `rgba(0,0,0,.7)` + 8px blur; card `rgb(20,20,35)` + **indigo** `rgb(79,70,229)` border, radius `8px`; `kbd` keys mono w/ gradient. Hold `?`/`/` to show, keyup hides. ⚠️ Indigo/blue-black family — the "modern web app" look being moved away from.

### 2.7 Workspace modal — `WorkspaceModal.svelte` (182)
- Export/Import/Cancel only. Overlay `rgba(0,0,0,.5)` + 4px blur; card `rgb(26,26,46)` + indigo border, radius `8px`, **padding 24px**, big drop-shadows, indigo buttons, focus-trap + arrow-nav. ⚠️ Most "modern web app" surface in the app.

### 2.8 Cross-cutting shells
- **App bg** `#1a0a1a` (plum). **Workspace bg** `radial-gradient(rgb(26,26,46),rgb(15,15,30))` (blue-black). Neither matches ticker's neutral black.
- **`themeStore.js`** defaults to `'light'`, persists to localStorage — but **every shell color is hardcoded hex**, so the toggle only affects chart internals. Theme system is vestigial for the shell.

### 2.9 Display-type semantics (matters for the `+` menu)

| Kind | Displays | Menu behavior |
|---|---|---|
| **Additive** (one panel per action, per symbol) | Price Ticker, cTrader Display, TradingView Display, FX Basket | Each click creates a new panel → symbol field |
| **Singleton toggle** (one global instance) | **Chart** (follows green-selected ticker), **News** | Each click toggles open/closed; menu shows current state |

---

## 3. Quantified inconsistency (evidence base)

Measured across `src/**/*.svelte`:

| Dimension | Count | Worst offenders |
|---|---|---|
| **Distinct hex colors** | **46** | 3 "blues" (`#00d4ff`, `#4a9eff`, indigo `rgb(79,70,229)`); 4 "active" colors (cyan / `#4a9eff` / `#48752c` green / indigo); 3 near-black backgrounds (`#141414`/`#1a1a1a`/`rgb(26,26,46)`) |
| **`rgb()/rgba()` values** | ~40 | 11 alpha-black variants for overlays/shadows |
| **`border-radius`** | **6 scales** (`2px`×7, `3px`×5, `4px`×10, `6px`×2, `8px`×3, `50%`) | Ticker=4/2, modal/overlay=8, toolbar=3 — no rule |
| **`font-family`** | system-stack **inlined 12×** + 6 `inherit` + 1 mono | No shared token |
| **`box-shadow`** | 14 distinct recipes | 3 different focus glows |
| **`z-index`** | 3+ scales | `OverlayContextMenu` 1000/1001, `ChartToolbar` 15, new tokens 10000/10001 — **deferred** (Phase 2); `<AddMenu>` at 10000 stacks above all |
| **Copy-pasted `.floating-display` block** | **3× verbatim** | FloatingDisplay / FxBasketDisplay / HeadlinesWidget |

**The five dialects:** (1) Ticker cyan/magenta-on-black, (2) Display `#4a9eff` + Material status, (3) Modal/Login indigo-on-blue-black, (4) Toolbar white+green / slate-dark, (5) App plum + blue-black radial. Target: **one role-locked palette** (§6), based on PriceTicker.

---

## 4. Missing UX flows

**Core (block the intended loop):**
1. **Logout UI** — `logout()` private + unwired. Net-new build; lives in the `+` menu.
2. **First-run / empty workspace** — blank screen, zero affordance. Decided: empty workspace + the `+` is sufficient (no heavy empty-state component).
3. **Symbol entry UI** — every add path is `prompt()`. Decided: replace with a native text field reusing `formatSymbol()`. **Validation / history / autocomplete deferred (scoped out).**

**Resolved (rev 2):**
4. **Selection treatment — RULE LOCKED.** Green = the selected / chart-bound symbol (drives the global chart), propagated to *all* selectable displays (ticker + floating). Cyan border currently mixed into the ticker's selected state is removed (cyan → ticker-flash-only). Keyboard *focus* rings use the general accent (`--accent`, §6), kept visually distinct from green selection.
5. **Chart in the `+` menu — YES (was missing).** Chart is a singleton toggle that follows the green-highlighted ticker; it belongs in the menu alongside News (also a singleton toggle), separate from the additive display types.

**Should-decide (not in original brief):**
6. **Global status surface** — per-display connection dots exist, but no workspace-level "connected / logged-in-as" indicator. Optional; the `+` menu could host a status line.
7. **Settings surface** — theme, timezone, flash, grid-snap are scattered. Optional; the `+` menu is the natural home if wanted.

**Explicitly deferred (conscious skip):** layout presets / multi-workspace / reset-layout; touch/mobile (interact.js disabled on iOS; ethos is desktop); toast/error-boundary (deferred per reassessment §4 until non-technical users).

---

## 5. Design ethos → concrete rules

*Lean, simple, boxy, space-efficient; not modern-web padding/curves; every pixel justified.*

- **Radius:** one scale, default `4px` (frame) / `2px` (insets). **Retire `3/6/8px`.**
- **Spacing:** 4px grid (`2/4/6/8/12/16`). No `24px` padding blocks.
- **Shadow:** kill big modal drop-shadows. Glow only for selection/focus, one recipe.
- **Color (role-locked, rev 2):** neutral-black backgrounds; **cyan + magenta = ticker flash ONLY**; **green = selection / chart-bound symbol ONLY**; **blue `#4a9eff` = general chrome accent** (focus rings, active menu, hovers); semantic status tokens; 4-step grey text ramp.
- **Motion:** flash + focus only; no fade-in theatre.

---

## 6. Token taxonomy (primitive → semantic, role-locked)

Two-tier from day one so the Option-2→3 path is near-free. **Color tokens are role-locked** — each color has exactly one job; none is a general accent except `--accent`.

```
/* —— primitive (raw values; never consumed directly by components) —— */
--black-900:#0a0a0a  --black-800:#141414  --black-700:#1a1a1a  --line:#333333
--grey-100:#ffffff --grey-200:#cccccc --grey-400:#888888 --grey-500:#666666
--cyan:#00d4ff  --magenta:#e040fb     /* TICKER FLASH ONLY — not a general accent */
--green:#00ff00                       /* SELECTION / chart-bound symbol ONLY */
--ok:#4CAF50 --warn:#FF9800 --bad:#F44336 --idle:#9E9E9E   /* connection status */

/* —— semantic (what components consume; swap here for [data-theme]) —— */
--bg-app --bg-frame --bg-header --border
--text-primary --text-secondary --text-label --text-muted
--flash-up:var(--cyan)  --flash-down:var(--magenta)   /* PriceTicker ONLY */
--select:var(--green)                                   /* selected/chart-bound display */
--accent:#4a9eff                        /* general chrome: focus, active menu, hovers */
--status-ok --status-warn --status-bad --status-idle
```

### Color role map (the one source of truth)

| Token | Value | Role | Scope |
|---|---|---|---|
| `--flash-up` | `#00d4ff` cyan | price-up tick border flash | **PriceTicker ONLY** |
| `--flash-down` | `#e040fb` magenta | price-down tick border flash | **PriceTicker ONLY** |
| `--select` | `#00ff00` green | selected display = symbol driving the global chart | all selectable displays (ticker + floating) |
| `--accent` | `#4a9eff` blue | general chrome: focus rings, active menu item, hovers | menus, buttons, focus |
| `--status-*` | green/orange/red/grey | connection state | connection dots only |

**Resolved (rev 2):** `--accent = #4a9eff` blue — already the FloatingDisplay focus color and a different hue from the ticker's flash cyan, so it introduces no new color. Used for focus rings, active menu item, and hovers. Each color now has exactly one job: cyan/magenta = ticker flash, green = selection/chart-bound, blue = chrome accent, status set = connection.

Theme = swap the semantic layer via `[data-theme="dark|light"]`; the shell finally obeys `themeStore`.

---

## 7. Three options (simple → complex) + decision

| | **Option 1 — Token layer** | **Option 2 — Tokens + primitives** ✅ | **Option 3 — Full atomic system** |
|---|---|---|---|
| **What** | One `tokens.css` + migrate ~8 shell components' hardcoded hex/radius/font → `var(...)`. No new components. | Opt 1 **+** `<DisplayFrame>` (kills the 3× copy-paste), shared `<DisplayHeader>` everywhere (Headlines stops being bespoke), `<IconButton>` (refresh/close once), `<AddMenu>` (`+` menu + symbol field + logout). | Opt 2 **+** 3-tier tokens, full atom library (`Button`/`Badge`/`Pill`/`ConnectionDot`/`Kbd`/`Segmented`/`Menu`/`Overlay`/`Field`), toolbar chrome joins tokens, palette feeds `chartTheme*` via `buildTheme()`, preview page. |
| **New LOC** | ~150 | **~400–450** | ~1200 |
| **Deleted LOC** | ~0 (edits) | ~150–200 (dedup) | ~400–600 |
| **Net Δ** | +~150 | **+~250–300** | +~600–800 |
| **Chart internals?** | No | No | No (chrome only) |
| **Effort** | 0.5–1 day | **~2 days** | 5–8 days |
| **Gets** | Single source of truth; theme works; color/radius/font consistent. *No UX change.* | Above **+** `+` menu (incl. Chart + News toggles), logout, native symbol entry, empty-state hook, DRY display core, green-selection propagated. | Above **+** toolbar unified, scalable atoms, lowest long-term drift. |
| **Risk** | Very low. | Low. | Medium. |

**Decision: Option 2.** Smallest change that delivers **both** visual cohesion (tokens) **and** the missing UX flows. Option 1 leaves the UX keyboard-only; Option 3's extra atoms + toolbar unification are better as **Phase 2** once the token layer proves out.

### Option 2 → Option 3 is a clean, near-zero-throwaway path
Option 3 is a strict superset. The only 2→3 cost is folding the 4 ad-hoc components into a formal atom library (rename + variant APIs) — additive, nothing deleted. Structuring tokens as **two-tier from day one** makes the token side ~free; Option 3 then only adds a component-token tier + the atom library + toolbar chrome.

### Sequencing (each step independently shippable)
1. `tokens.css` (2-tier, role-locked); migrate PriceTicker first (defines the tokens — zero visual change there apart from dropping the cyan border from its selected state).
2. Migrate FloatingDisplay / DisplayHeader / FxBasketDisplay / HeadlinesWidget to tokens; extract `<DisplayFrame>` (dedup); **add green selection to FloatingDisplay**, **remove cyan/magenta flash from FloatingDisplay**.
3. `<AddMenu>` (`+` top-right). Two item kinds — **additive**: Price Ticker (`Alt+I`), cTrader Display (`Alt+A`), TradingView Display (`Alt+T`), FX Basket (`Alt+B`) → new panel + native symbol field (replacing `prompt()`); **singleton toggles**: Chart (`c` — follows the green-highlighted ticker; shows open/closed state), News (`H`). Plus "Shortcuts" → overlay, Logout → wire `logout()`.
4. Empty-state hook + optional global status line; retire plum/indigo/radial backgrounds for the token neutral.
5. *(Phase 2 / Option 3)* toolbar chrome + atom library.

---

## 8. Locked scope (user decisions, 2026-06-30)

- **Landing** = LoginForm. No new page.
- **First-run** = empty workspace + the `+`. No empty-state component (blank is fine).
- **Symbol entry** = native text field replacing `prompt()`, reusing `formatSymbol()`. **Validation / history / autocomplete deferred.**
- **Logout** wired into the `+` menu (net-new).
- **Chart in `+` menu** = yes, as a singleton toggle that follows the green-selected ticker.
- **Color roles (rev 2):** cyan + magenta = ticker flash ONLY; green = selection / chart-bound ONLY; **blue `#4a9eff` = general chrome accent**; FloatingDisplay loses its cyan/magenta flash and gains green selection.
- **Chart internals** untouched.

---

## 9. UX outcome — the user perspective

### Before (today)
A trader opens the app, logs in, and lands on a blank dark canvas. There is no `+`, no menu, no hint of what's possible. To add anything they must **already know** that `Alt+A` means "cTrader display" and then type a symbol into a raw browser `prompt()`. Each thing they add looks like it came from a different application: a cyan-and-magenta ticker, a blue-glowing day-range panel, an indigo modal, a green toolbar. There is no way to log out. It feels like a prototype held together with keyboard shortcuts.

### After (Option 2)

**Signup / onboarding / logout loop**
- The login form *is* the landing page — clean, boxy, on-brand (indigo/plum gone; the same neutral + restrained accent as the rest of the app). Register, log in.
- You land on a **plain workspace**: neutral-black canvas, a single small `+` icon in the top-right corner. Nothing else. That calm emptiness *is* the empty state.
- Everything you need — adding things, seeing shortcuts, leaving — is behind that one `+`. Logout is a menu item. The loop is tight: land → login → workspace → `+` → … → `+` → Logout → login.

**Early trader — establish a workspace to taste**
- You click `+`. A menu opens. Under **additive types** it lists Price Ticker, cTrader Display, TradingView Display, FX Basket — each with its keyboard shortcut shown beside it. Under **toggles** it lists Chart (follows the highlighted ticker) and News, each showing whether it's currently open. Plus *Shortcuts* (opens the `?` overlay) and *Logout*. Discovery is now visual and mouse-driven; the keyboard still works for power users.
- You pick *Price Ticker*; a symbol field appears (a real input, not a browser prompt); you type `EURUSD`; the ticker appears. You drag it where you want. It autosaves.
- You add a cTrader day-range panel, an FX Basket, the News widget. **They all share one frame.** You click a ticker to drive the chart — that ticker lights **green** (the one signal that means "the chart is tracking me"), the chart re-points to it. Same border, same corner, same hover-header, same `×`/`↻` everywhere. It finally reads as **one application**.
- You arrange them, close the tab. Next login: **exactly as you left it.**

**Established trader — monitor, adjust, leave**
- Log in → your saved layout restores instantly. Monitor.
- Need to add or change something → `+` or keyboard (parity). Toggle the chart on/off from the menu; pick a different ticker to re-point it.
- `+` → Logout when done.

**The cohesion payoff, in user terms**
- **One visual language** — no more indigo-over-cyan-over-green cacophony.
- **Color means something** — green = "this is what the chart tracks"; cyan/magenta = a ticker just ticked; everything else is calm neutral. No color is decorative.
- **Mouse + keyboard parity** — nothing hidden behind secret keys; nothing forces the mouse.
- **Predictable controls** — close is always close, refresh is always refresh, same place, same size.
- **A theme toggle that actually toggles** the whole app, not just the chart.

**What does *not* change (managed expectations)**
- The chart's internals look the same (untouched).
- Symbol entry is still manual typing — no autocomplete/history/recents this phase.
- No toast notifications, no settings panel, no saved layout presets yet.
- The News widget's *internals* keep their third-party look; only its frame matches.

---

## 10. Constraints honored (carry-forward from prior audits)

- **`window.*` globals stay** (`workspaceStore`, `workspaceActions`, `displayStore`, `fxBasketDebug`) — E2E-load-bearing across 30+ spec files. Never DEV-gate without migrating the specs first.
- **Stay on Svelte 4** — no runes migration (deferred, reassessment §4).
- **No code-splitting** — deferred (bundle ~622 kB is fine).
- **`console.error` stays off expected paths** — `tests/e2e/console-check.spec.js:49` asserts zero errors during init; use `console.warn`.
- **Per-item verification before deletion** — bulk-delete on agent say-so has produced false positives (`mergeWithPersisted`) and false negatives (`computeMiniMarketProfile`) before.
- **Chart internals untouched.**
- This work **un-defers** two parked items with explicit trigger: *design tokens* and *shared component/modal base* (reassessment §4). All other deferrals stand.

---

## 11. Verified findings log (this pass)

| Finding | Evidence | Status |
|---|---|---|
| `logout()` has no UI | `authStore.js:178` private; 0 callers (only API URL + E2E `fetch('/api/logout')`) | Verified |
| No `+`/menu/add-button in any `.svelte` | only `.svelte` caller of `add*` is `addChartDisplay` in `Workspace.svelte:134` (the `c` key) | Verified |
| No landing page / no empty-state / no global status | grep returns nothing; `App.svelte` gates on `isAuthenticated` only | Verified |
| `addDisplay` silently ignores intended size | `workspace.js:55` spreads `displayActions`; `addDisplay(symbol,position,source)` is 3-param — keyboard path's 4th arg `{220×360}` is dropped; actual size = `config.defaultSize` **2000×680** (`displayStore.js:9`) | Verified — **latent bug** (shortcut intends compact panels, users get 2000×680 giants) |
| `.floating-display` copy-pasted 3× | FloatingDisplay / FxBasketDisplay / HeadlinesWidget `<style>` blocks near-identical | Verified |
| 46 hex / 6 radius / 5 dialects | mechanical sweep `src/**/*.svelte` | Verified |
| `themeStore` vestigial for shell | defaults `'light'`; all shell colors hardcoded hex | Verified |
| Chart = singleton following green-selected ticker | `toggleChart()` `Workspace.svelte:104-122`; reactive re-point `:24-36`; arrow-nav skips chart `displayStore.js:130` | Verified |
| Flash colors currently shared (ticker + FloatingDisplay) | `PriceTicker.svelte` + `FloatingDisplay.svelte:170-176` both flash cyan/magenta | Verified — rule change: ticker-only |

---

## 12. Next step

Implementation plan → `plans/frontend-cohesion-design-system.md` (planner phases: Context & Scope → Decision & Architecture → Refinement → Final Verification → QR). Then `/clear` and execute.

**All color roles resolved (rev 2).** No open design decisions remain.

---

## 13. Implementation record (2026-07-01)

Option 2 implemented end-to-end in 6 staged steps, each gated by `npm run build` + `npm run test:unit` (487/487 green) and a quality-reviewer pass on the structural stages. Build ~625 kB. No critical/major findings across 5 review passes. New files: `src/styles/tokens.css`, `src/components/displays/DisplayFrame.svelte`, `src/components/IconButton.svelte`, `src/components/AddMenu.svelte`.

**Landed (all 8 plan tasks):** 2-tier role-locked tokens + `themeStore`→`<html data-theme>` (default **dark**); 9 shell components migrated off hardcoded hex/radius/font; `<DisplayFrame>` (owns interact.js + green `--select` ring + `--accent` focus glow) adopted by Floating/FxBasket/Headlines — 3× `.floating-display` dedup'd, FloatingDisplay cyan/magenta flash removed (ticker-only now); `<IconButton>` + DisplayHeader `minimal` mode (Headlines bespoke header retired); `<AddMenu>` (native symbol field replacing `prompt()`, Chart/News singleton toggles w/ state, Shortcuts, Logout); `addDisplay`/`addPriceTicker` optional 4th `size` arg (latent-bug fix — keyboard's ignored `{220×360}` is live); background unified (plum/radial → `--bg-app`; pre-JS `src/index.html` neutralized); `logout()` re-exported + wired.

**Deviations from this design (sensible, documented):**
- **Alt+B (FX Basket) stays a direct add**, not routed through the `+` menu — it needs no symbol, so a symbol-field menu stop is pointless. The `+` menu still lists FX Basket (click adds directly). Only the symbol types (Alt+A/T/I) open the menu with the field focused.
- **`addDisplay` size strategy = the plan's documented fallback:** no-arg / 1–3-arg callers (incl. E2E `window.workspaceActions.addDisplay(...)`) keep `defaultSize` (2000×680) for backward-compat; only an explicit `size` arg overrides (keyboard Alt+A/T = 220×360, FX Basket = 360×360). Safer than inferring per-type defaults given E2E reliance on the large default.
- **`<DisplayFrame>` keeps a blue `:focus` glow** (per §1.3) in addition to the green selection ring; full PriceTicker parity (green-only) is deferred until PriceTicker adopts `<DisplayFrame>`.
- **Root `index.html` deleted** — `vite.config.js` sets `root:'src'`, so `src/index.html` is the sole entry; the root file was a stale, script-less, never-served duplicate that caused a wrong-file edit. Root `CLAUDE.md` corrected.

**E2E caveat (do not chase as a regression):** `console-check.spec.js` fails only on a **pre-existing 401** from `checkSession()` on an unauthenticated browser — NOT this work (`authStore` only gained `export` on `logout`; `checkSession` untouched). The spec also hardcodes `localhost:5174` (flaky in WSL2; the Playwright config itself uses `os.hostname()`). Full chart-interaction E2E still wants a stable backend run.

**Carried to Phase 2 / Option 3 (still deferred — do not re-flag):** chart chrome on tokens (ChartToolbar / ChartDisplay frame / OverlayContextMenu); z-index unification; PriceTicker → `<DisplayFrame>` wrap-up (incl. tokenizing its raw-rgba close/refresh buttons); light-theme polish on residual **DOM** `rgba` overlays/glows (KeyboardShortcutsHelp / WorkspaceModal); atom library + 3-tier component tokens. *(The canvas side — `DisplayCanvas` bg + every shell-canvas color — was resolved by the `canvasTheme.js` follow-up directly below.)*

**Canvas-theme carry-over — RESOLVED (2026-07-01):** the shell-canvas gap is closed by `src/lib/canvasTheme.js`. Canvas renderers had hardcoded ~38 dark-assuming colors (only the PriceTicker mini-profile branched on theme — the cause of the 5-commit TWAP-dot saga `7120604`→`a9469bf`), so light theme was silently broken on the day-range meter + FX basket (dark canvas blocks, white text, `rgba(10,10,10,.7)` label backgrounds). One centralized resolver (`getCanvasColors()`) every shell canvas now reads at paint time — `DARK`/`LIGHT` are module constants built once, a single app-lifetime `themeStore.subscribe` caches the resolved set, so resolution is a plain variable read (zero per-frame `get()`/allocation — cheaper than the chart canvas's per-color `get()`). It mirrors the chart-canvas `chart/themeColors.js` idiom but binds to the shell store: **DOM = CSS tokens, canvas = JS resolver** is now the consistent boundary app-wide. Full sweep of ~16 renderers; config-driven ones themified at `getConfig()` time (renderers/compute unchanged, tests inject own configs); `isLight` plumbing retired; repaint-on-theme hooks added to `DisplayCanvas` + `FxBasketDisplay` (was only `PriceTicker`); legacy `colors.js` `COLORS` retired. `src/lib/chart/**` deliberately untouched (separate resolver, deferred). Build clean, 487/487 unit tests green. See `plans/canvas-theme-system.md`.
