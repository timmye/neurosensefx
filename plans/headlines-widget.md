# Headlines Floating Widget

## Summary

Add a resizable, draggable floating "Headlines" panel toggled by the `H` key. Embeds the FinancialJuice news widget in dark mode, matching the existing floating element pattern (interact.js drag/resize, z-index management, close button).

## Architecture

### Singleton toggle (not a display Map entry)

The headlines widget is a single instance with no per-symbol variants. It is modeled as a boolean toggle on the workspace store rather than an entry in the `displays` Map. This keeps it out of workspace export/import and avoids unnecessary serialization.

Position and size are stored as plain state fields on the workspace store with sensible defaults.

### External script loading

The FinancialJuice script (`https://feed.financialjuice.com/widgets/widgets.js`) is loaded dynamically in `onMount`. A `<script>` element is appended to `<head>` with a cache-busting `r` parameter. The `onload` callback calls `FJWidgets.createWidget(options)` to render into a container div.

On `onDestroy`, the script tag and widget DOM are cleaned up.

### Dark mode palette

Uses the app's dark color scheme:
- `backColor: "1e222d"`
- `fontColor: "b2b5be"`

## Files to Change

### 1. `src/components/HeadlinesWidget.svelte` (new)

Floating container component. Follows FxBasketDisplay pattern.

```
Imports: onMount, onDestroy, createInteractConfig, workspaceStore, workspaceActions

State:
  - element (DOM ref for interact.js)
  - interactable (returned by createInteractConfig)

onMount:
  1. Setup interact.js drag/resize via createInteractConfig
     - ignoreFrom: '.financialjuice-container' (prevent drag when scrolling feed)
     - onDragMove → workspaceActions.updateHeadlinesPosition
     - onResizeMove → workspaceActions.updateHeadlinesSize
     - onTap → workspaceActions.bringToFront (N/A for singleton, skip)
  2. Append FinancialJuice <script> to document.head
  3. On script load: call FJWidgets.createWidget with options
     - container: the container div
     - mode: "Dark"
     - width/height: from store defaults
     - backColor: "1e222d"
     - fontColor: "b2b5be"
     - widgetType: "NEWS"

onDestroy:
  1. interactable?.unset()
  2. Remove FinancialJuice <script> from document.head
  3. Clear widget container innerHTML

Template:
  div.floating-display (bind:this={element}, absolute positioning from store)
    DisplayHeader (symbol="HEADLINES", onClose=toggleHeadlines)
    div#financialjuice-news-widget-container (fills remaining space, overflow hidden)
    div.resize-handle

Style:
  .floating-display — same pattern as FxBasketDisplay (bg, border, border-radius, focus styles)
  .resize-handle — same se-resize triangle pattern
  .financialjuice-container — width:100%, height:100%, overflow:hidden
```

### 2. `src/stores/workspace.js`

Add to `initialState`:
```js
headlinesVisible: false,
headlinesPosition: { x: 1200, y: 100 },
headlinesSize: { width: 500, height: 600 }
```

Add actions:
```js
toggleHeadlines: () => {
  workspaceStore.update(state => ({
    ...state,
    headlinesVisible: !state.headlinesVisible
  }));
},

updateHeadlinesPosition: (position) => {
  workspaceStore.update(state => ({ ...state, headlinesPosition: position }));
},

updateHeadlinesSize: (size) => {
  workspaceStore.update(state => ({ ...state, headlinesSize: size }));
}
```

No changes to persistence (loadFromStorage, initPersistence) — headlines state is session-only.

### 3. `src/components/Workspace.svelte`

Add import:
```js
import HeadlinesWidget from './HeadlinesWidget.svelte';
```

Register the `H` key shortcut via `keyManager.register()` (in the `onMount` block alongside other global shortcuts, e.g. after the arrow key registrations):
```js
// h: toggle headlines widget (no modifier keys)
unsubs.push(keyManager.register(
  { key: 'h', ctrl: false, alt: false }, () => {
    workspaceActions.toggleHeadlines();
    return true;
  }, { priority: 10 }
));
```

Note: KeyManager automatically skips handlers when an input/textarea/contentEditable is focused (via `isInputFocused`), so no manual input guard is needed.

Add conditional render block (after the `{#each}` loop, inside `.workspace` div):
```svelte
{#if $workspaceStore.headlinesVisible}
  <HeadlinesWidget />
{/if}
```

### 4. `src/components/KeyboardShortcutsHelp.svelte`

Add entry in the "Workspace" section (after the `Alt+M` Market Profile row):
```svelte
<div class="shortcut-item">
  <span class="keys"><kbd>H</kbd></span>
  <span>Headlines</span>
</div>
```

## Plan Verification (2026-04-18)

### Verified Against Codebase

| Item | Status | Location |
|------|--------|----------|
| `createInteractConfig` utility | Confirmed | `src/lib/interactSetup.js:7-52` |
| `ignoreFrom` interact.js option | Confirmed correct | Used in `interactSetup.js:27-28`, `chartLifecycle.js:64` |
| `DisplayHeader` props — NOT used | Replaced | Inline close-only header (DisplayHeader shows misleading DR/cT badges on non-trading widget) |
| `FxBasketDisplay` floating pattern | Confirmed matches | `src/components/FxBasketDisplay.svelte` |
| `bringToFront` function | Confirmed exists | `src/stores/workspace.js:131-140` (N/A for singleton) |
| Resize handle styling pattern | Confirmed consistent | 16x16 se-resize triangle in FloatingDisplay, FxBasketDisplay, ChartDisplay |
| `H` key not already bound | Confirmed safe | No existing `keyManager.register` for `h` |
| `KeyboardShortcutsHelp` Workspace section | Confirmed | `Alt+M` Market Profile row at line 44-46 |
| KeyManager registration pattern | Confirmed | `src/lib/keyManager.js`, used in `Workspace.svelte` onMount block |
| `{#each}` loop for floating displays | Confirmed | Workspace.svelte template |

### Discrepancies Found

1. **`workspaceActions` is not a separate file** — Plan implies a separate `workspaceActions.js`. All actions are defined inline in `src/stores/workspace.js` as an `actions` object (lines 54-504). New actions (`toggleHeadlines`, `updateHeadlinesPosition`, `updateHeadlinesSize`) must be added there.
2. **No FinancialJuice text formatting support** — The `FJWidgets.createWidget` API is a black-box iframe embed. Only options are `mode` ("Dark"/"Light"), `backColor`, `fontColor`, `width`, `height`, `widgetType`. No font size, font family, bold/italic, line height, or custom CSS injection.

### No Blocking Issues

The plan is structurally sound. Only correction needed: add actions to the `actions` object in `workspace.js`, not a separate file.

## Widget Resize Behavior

The FinancialJuice widget takes fixed `width` and `height` in its options. On interact.js resize, the container div changes size but the widget itself may not reflow automatically. Two approaches:

1. **Re-create widget on resize** — destroy and call `FJWidgets.createWidget` again with new dimensions. This causes a flash/reload of the feed content.
2. **CSS scaling** — let the widget render at initial size, then use CSS `transform: scale()` to fit the container. No content reload but may blur text at extreme sizes.

**Recommendation**: Start with option 1 (re-create on resize) via a debounced resize handler. If the flash is unacceptable, switch to option 2.

## Persistence

Not persisted. The headlines widget reopens at default position on page load. Can be added later by including `headlinesVisible`, `headlinesPosition`, and `headlinesSize` in the workspace persistence payload.

## Implementation Notes (2026-04-18)

### DisplayHeader replaced with inline header
DisplayHeader is designed for trading displays and shows `source`/`showMarketProfile` badges (e.g. "DR/cT"). Using it on a non-trading news widget produced misleading UI. Replaced with a minimal close-only header div matching DisplayHeader styling.

### FJWidgets guard added
`window.FJWidgets.createWidget()` is called only after verifying the global exists. Script tag has `onerror` handler for CDN failures.

### Widget re-created on resize
FinancialJuice widget renders at fixed dimensions. A debounced (300ms) resize handler clears and re-creates the widget via an extracted `createWidget(w, h)` function shared between mount and resize paths.

### meta: false added to key bindings
Both `H` and `C` bindings include `meta: false` to prevent Mac Cmd+H / Cmd+C from incorrectly matching.

### FIXED: FinancialJuice widget not rendering (2026-04-18)
**Root cause**: `FJWidgets.createWidget()` expects `container` as a **string ID** (it calls `document.getElementById(container)` internally), but the code was passing a DOM element reference. This caused `document.getElementById(domElement)` to return `null`, so no iframe was created.

**Fix**: Changed `container` parameter from DOM element to string `'financialjuice-news-widget-container'` in `createWidget()` function in `HeadlinesWidget.svelte`.

**Verification**: All 9 Playwright E2E tests pass. The FJ iframe loads with correct parameters, all CSS/JS assets (bootstrap, dark theme, fontawesome, SignalR) load successfully.

## Risks

| Risk | Mitigation |
|------|-----------|
| FinancialJuice CDN unavailable | Widget container shows empty — no crash. Could add a "loading" message. |
| Script load race condition | Widget creation only fires in `onload` callback. |
| Widget re-init on toggle | Cache-buster `r` parameter + fresh `onMount` each time. |
| Resize flash | Debounce resize handler (300ms) before re-creating widget. |
