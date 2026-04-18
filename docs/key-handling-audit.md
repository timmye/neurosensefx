# Keyboard Handling Audit

## DOM & Focus Architecture

Understanding how keys actually reach handlers requires knowing the DOM structure and focus model.

```
div.workspace-container
├── BackgroundShader
└── div.workspace (tabindex="0", focused on mount)
    ├── FloatingDisplay (tabindex="0")
    │   ├── DisplayHeader (tabindex="0")
    │   ├── DisplayCanvas
    │   └── PriceMarkerManager → priceMarkerInteraction.js
    │       └── priceMarkerDropdown.js
    ├── FxBasketDisplay (tabindex="0")
    ├── PriceTicker (tabindex="0")
    ├── ChartDisplay (tabindex="0")
    │   ├── ChartHeader (tabindex="0")
    │   ├── ChartToolbar
    │   └── chartContainer
    ├── WorkspaceModal (conditional, tabindex on buttons)
    └── KeyboardShortcutsHelp (conditional)
```

### Focus Model

- **Workspace** gets focus on mount (`Workspace.svelte:213`). It is the default focus owner.
- **Clicking a display** moves focus to it: ChartDisplay via `mousedown → element.focus()` (`ChartDisplay.svelte:350`), FloatingDisplay/FxBasket/PriceTicker via native click-to-focus (all have `tabindex="0"`).
- **All displays are DOM children of Workspace.** Keydown events on a display bubble up to Workspace. Both handlers fire on every keypress.
- **Three handlers bypass the bubble chain** by registering on `document` directly: ChartDisplay (Delete/Backspace), OverlayContextMenu (Escape), priceMarkerInteraction (Escape). These fire last, after bubbling completes.

### Event Propagation Order (chart focused, key pressed)

```
1. ChartDisplay.handlers.keydown          ← element-level (Svelte on:keydown)
2. Workspace.handleKeydown                 ← ancestor (Svelte on:keydown)
   └── keyboardHandler.handleKeydown()     ← called inline, not a separate listener
3. ...ancestors...
4. document
   ├── ChartDisplay.handleDocumentKeydown  ← Delete/Backspace
   ├── OverlayContextMenu.handleKeydown    ← Escape
   └── priceMarkerInteraction._escapeHandler ← Escape
```

---

## Trader Workflow States

Each state describes what the trader is doing, what element has focus, which keys should work, and what actually happens.

---

### State 1: Login Screen

**What the trader is doing:** Entering credentials.

**Focused element:** `<input type="email">` or `<input type="password">` inside LoginForm.

**Keys that should work:** Typing, Tab (navigate fields), Enter (submit), ArrowLeft/Right (move cursor in input).

**What actually happens:** Correct. All keyboard handling is scoped to the LoginForm's `on:keydown` on tab buttons, and `on:submit|preventDefault` on the form. Global handlers do fire (they bubble from input → ... → workspace → document) but keyboardHandler.js has an input guard at line 82 that skips arrow keys. However, `Alt+A/B/T/I` would still fire and open a `prompt()` dialog while the trader is mid-keystroke.

**Problem:** No input guard on Alt+ shortcuts. A trader typing "b" in an input who holds Alt (e.g., AltGr layouts) could accidentally trigger Alt+B.

---

### State 2: Empty Workspace

**What the trader is doing:** Just logged in, workspace is empty.

**Focused element:** `div.workspace` (set on mount, line 213).

**Keys that should work:** `Alt+A` (create display), `Alt+T` (TradingView), `Alt+B` (FX Basket), `Alt+I` (ticker), `?` (show help), arrow keys (no-op, nothing to navigate).

**What actually happens:** Correct. All shortcuts work, arrow keys fire but `selectNextDisplay` is a no-op with no displays.

---

### State 3: Workspace with Displays, Nothing Focused

**What the trader is doing:** Clicked empty workspace area to defocus all displays.

**Focused element:** `div.workspace`.

**Keys that should work:** All global shortcuts, arrow keys to navigate between displays.

**What actually happens:** Correct. Arrow keys call `workspaceActions.selectNextDisplay(event.key)`.

---

### State 4: Display Focused (FloatingDisplay)

**What the trader is doing:** Clicked on a floating display (day range / market profile).

**Focused element:** `div.floating-display` (tabindex="0", gets focus via native click).

**Keys that should work:** `Alt+M` (toggle market profile for this display), all global shortcuts.

**What actually happens:** Mostly correct. The FloatingDisplay's `on:keydown` fires first and handles `Alt+M`. The event then bubbles to Workspace which handles everything else. The `c` key in Workspace (toggle chart) also fires, which may be unexpected — the trader might press `c` thinking it only affects the chart, but it creates/toggles the chart regardless of which display is focused.

**Problem:** `c` key in Workspace has no scope check — it fires when any display has focus, not just when the trader intends chart interaction.

---

### State 5: Chart Focused, No Overlays Selected

**What the trader is doing:** Clicked on the chart to interact with it.

**Focused element:** `div.chart-window` (tabindex="0", focused via `mousedown → element.focus()` at `ChartDisplay.svelte:350`).

**Keys that should work:** `Escape` (close chart), `Ctrl+Z` (undo drawing), `Ctrl+Y` / `Ctrl+Shift+Z` (redo drawing).

**What actually happens:**
- `Escape` — ChartDisplay handler fires (closes chart) ✓. Then event bubbles to Workspace, which calls keyboardHandler's progressive escape. The chart is already gone, so the DOM query finds nothing. Harmless but wasteful.
- `Ctrl+Z` — ChartDisplay handler fires, calls `commandStack.undo()` ✓. Then event bubbles to Workspace, which has a no-op at line 127 that returns without calling keyboardHandler. KeyboardHandler's `preventDefault()` for Ctrl+Z is never reached. Works correctly by accident.
- `Ctrl+Y` — Same flow, works correctly.

**Status:** Functional but fragile — depends on Workspace's no-op not having `preventDefault()`.

---

### State 6: Chart Focused, Overlay Selected

**What the trader is doing:** Drew something on the chart, clicked to select it.

**Focused element:** `div.chart-window`.

**Keys that should work:** `Delete` / `Backspace` (delete selected overlay), `Ctrl+Z` (undo), `Escape` (deselect overlay, then close chart on second press).

**What actually happens:**
- `Delete` / `Backspace` — ChartDisplay's element-level handler doesn't handle these. Event bubbles to Workspace (no match). Bubbles to document. `ChartDisplay.handleDocumentKeydown` fires, checks `selectedOverlayId && chart`, deletes the overlay ✓.
- `Ctrl+Z` — Works as in State 5 ✓.
- `Escape` — ChartDisplay handler fires: `e.key === 'Escape'` → `handlers.close()` — **closes the entire chart, not just deselects the overlay.** There is no "deselect" step.

**Problem:** Escape on a chart with a selected overlay destroys the chart instead of deselecting. The trader loses their drawing context.

---

### State 7: Context Menu Open

**What the trader is doing:** Right-clicked on the chart, context menu is visible.

**Focused element:** Still `div.chart-window` (the context menu doesn't steal focus — it registers on `document`).

**Keys that should work:** `Escape` (close context menu ONLY), arrow keys (navigate menu items if implemented).

**What actually happens:**
1. ChartDisplay's `on:keydown` fires: `Escape` → `handlers.close()` → **closes the entire chart**.
2. Event bubbles to Workspace: keyboardHandler's progressive escape fires, DOM queries for `.modal, .overlay, .dropdown`.
3. Event bubbles to document: OverlayContextMenu's handler fires, dispatches `close` → but the chart (and likely the context menu within it) is already destroyed.

**Problem:** Pressing Escape with the context menu open **closes the chart**. The context menu close handler never gets a chance to run properly because the chart (its parent) is already removed from the DOM. This is a critical UX bug.

---

### State 8: Price Marker Dropdown Open

**What the trader is doing:** Clicked a price marker, dropdown configuration panel is visible.

**Focused element:** Likely an element inside the price marker dropdown.

**Keys that should work:** `Escape` (close dropdown ONLY).

**What actually happens:**
1. Keydown fires on whatever element in the dropdown has focus.
2. Bubbles through FloatingDisplay → Workspace → keyboardHandler (progressive escape fires, may try to remove `.dropdown` via DOM query).
3. Bubbles to document: `priceMarkerInteraction._escapeHandler` fires → `this.hideDropdown()` ✓.

**Problem:** The DOM query in keyboardHandler's escape sequence (`document.querySelectorAll('.modal, .overlay, .dropdown').forEach(el => el.close ? el.close() : el.remove())`) could forcefully remove the dropdown element from the DOM, bypassing the proper cleanup in `priceMarkerInteraction`. The `document.addEventListener` handler also fires, so both paths compete.

---

### State 9: Workspace Modal Open

**What the trader is doing:** Pressed `Alt+W`, workspace controls modal is showing.

**Focused element:** First button inside the modal (auto-focused via `tick().then(() => focusElement(0))`).

**Keys that should work:** `Escape` (close modal), `Tab` / `Shift+Tab` (navigate buttons), `Arrow keys` (navigate buttons).

**What actually happens:**
1. Modal's `on:keydown` fires on the modal overlay div: `Escape` → `handleCancel()` → closes modal ✓.
2. Event bubbles to Workspace. Modal is now unmounted. keyboardHandler fires, DOM query finds nothing.
3. `restoreWorkspaceFocus()` runs, re-focuses workspace after a `setTimeout(0)`.

**Status:** Functional, but relies on the modal being unmounted synchronously before the event finishes bubbling. If the unmount is ever made async, the Workspace handler would fire on a now-phantom modal.

---

### State 10: Keyboard Help Overlay (Holding ?)

**What the trader is doing:** Holding `?` to view keyboard shortcuts reference.

**Focused element:** `div.workspace`.

**Keys that should work:** Release `?` to hide help. Other keys should be ignored while help is visible.

**What actually happens:** While holding `?`, `showKeyboardHelp = true`. Any other key pressed simultaneously would fire through the normal handler chain. On keyup of `?`, `showKeyboardHelp = false`. No blocking of other shortcuts while help is shown.

**Problem:** Holding `?` and accidentally pressing `Escape` would trigger progressive escape. No "modal-like" blocking while help overlay is shown.

---

## Complete Key Binding Reference

### Navigation & Creation

| Key | Context | Action | Handler |
|-----|---------|--------|---------|
| `Alt+A` | Anywhere | Create cTrader display (prompts for symbol) | `keyboardHandler.js:52` |
| `Alt+B` | Anywhere | Create FX Basket display | `keyboardHandler.js:59` |
| `Alt+T` | Anywhere | Create TradingView display (prompts for symbol) | `keyboardHandler.js:66` |
| `Alt+I` | Anywhere | Create Price Ticker (prompts for symbol) | `keyboardHandler.js:73` |
| `ArrowUp/Down/Left/Right` | Not in INPUT/TEXTAREA | Navigate between displays | `keyboardHandler.js:80` |
| `?` / `/` | Anywhere | Show keyboard shortcuts help (hold) | `Workspace.svelte:104` |
| `Alt+W` | Anywhere | Open workspace controls modal | `Workspace.svelte:108` |
| `Alt+R` | Anywhere | Reinitialize all connections | `Workspace.svelte:113` |
| `c` | Anywhere (not Ctrl/Alt) | Toggle chart for selected ticker | `Workspace.svelte:120` |

### Display Interaction

| Key | Context | Action | Handler |
|-----|---------|--------|---------|
| `Alt+M` | FloatingDisplay focused | Toggle market profile | `FloatingDisplay.svelte:41` |
| `Enter` / `Space` | DisplayHeader focused | Focus/select display | `DisplayHeader.svelte:7` |
| `Enter` / `Space` | ChartHeader focused | Focus/select chart | `ChartHeader.svelte:9` |

### Chart Operations

| Key | Context | Action | Handler |
|-----|---------|--------|---------|
| `Escape` | ChartDisplay focused | Close chart | `ChartDisplay.svelte:258` |
| `Ctrl+Z` | ChartDisplay focused | Undo last drawing | `ChartDisplay.svelte:260` |
| `Ctrl+Y` | ChartDisplay focused | Redo last drawing | `ChartDisplay.svelte:261` |
| `Ctrl+Shift+Z` | ChartDisplay focused | Redo last drawing | `ChartDisplay.svelte:261` |
| `Delete` / `Backspace` | Anywhere (document-level) | Delete selected chart overlay | `ChartDisplay.svelte:267` |

### Escape (Progressive)

| Key | Context | Action | Handler |
|-----|---------|--------|---------|
| `Escape` (1st press) | Anywhere | Close overlays/modals/dropdowns | `keyboardHandler.js:30-47` |
| `Escape` (2nd press, within 1s) | Anywhere | Clear all display focus | `keyboardHandler.js:42-46` |

### Modal & Form Navigation

| Key | Context | Action | Handler |
|-----|---------|--------|---------|
| `Escape` | WorkspaceModal open | Close modal | `WorkspaceModal.svelte:24` |
| `Tab` / `Shift+Tab` | WorkspaceModal open | Navigate buttons | `WorkspaceModal.svelte:39-45` |
| `Arrow keys` | WorkspaceModal open | Navigate buttons | `WorkspaceModal.svelte:33-38` |
| `ArrowLeft/Right` | LoginForm tabs | Switch login/register tab | `LoginForm.svelte:39-40` |

### Overlay & Dropdown

| Key | Context | Action | Handler |
|-----|---------|--------|---------|
| `Escape` | OverlayContextMenu visible | Close context menu | `OverlayContextMenu.svelte:33` |
| `Escape` | Price marker dropdown visible | Hide dropdown | `priceMarkerInteraction.js:35` |

---

## Identified Bugs

### BUG-1: Chart undo/redo is fragile (may break silently)

**Severity:** High

**Location:** `Workspace.svelte:127-134`, `keyboardHandler.js:94-106`, `ChartDisplay.svelte:258-261`

Ctrl+Z works only because Workspace's no-op handler at line 127 does an early `return` before calling `keyboardHandler.handleKeydown()` at line 136. If anyone adds logic after the return, or reorders the conditions, keyboardHandler's `preventDefault()` will eat the event and chart undo breaks silently.

The no-op in keyboardHandler (lines 94-106) actively calls `preventDefault()` for Ctrl+Z/Y with the comment "Could be implemented later" — but it's already implemented in ChartDisplay. These are stale placeholders that block the real handler.

### BUG-2: Escape closes chart when context menu is open

**Severity:** Critical

**Location:** `ChartDisplay.svelte:258`, `OverlayContextMenu.svelte:33`

When the context menu is open and the trader presses Escape, ChartDisplay's handler closes the entire chart before the context menu's document-level handler can fire. The trader loses their chart and drawing state.

### BUG-3: Escape closes chart when overlay is selected (no deselect step)

**Severity:** High

**Location:** `ChartDisplay.svelte:258`

Pressing Escape with a selected chart overlay should first deselect the overlay (clear `selectedOverlayId`), then close the chart on a second press. Currently it jumps straight to closing.

### BUG-4: Delete/Backspace fires in text inputs

**Severity:** High

**Location:** `ChartDisplay.svelte:266-272`

The document-level Delete/Backspace handler does not check if an `<input>` or `<textarea>` is focused. Typing in the login form and pressing Backspace will delete chart overlays.

### BUG-5: Alt+ shortcuts fire in text inputs

**Severity:** Medium

**Location:** `keyboardHandler.js:52-77`, `Workspace.svelte:104,120`

Only the arrow key handler in keyboardHandler has an input guard (line 82). Alt+A/B/T/I, `?`, and `c` all fire even when the trader is typing in an input field.

### BUG-6: Escape sequence uses DOM queries to find closable elements

**Severity:** Medium

**Location:** `keyboardHandler.js:39-41`

`document.querySelectorAll('.modal, .overlay, .dropdown').forEach(el => el.close ? el.close() : el.remove())` is a brute-force approach that:
- May call `el.remove()` on elements that have proper cleanup (like price marker dropdown's `destroy()` method), bypassing cleanup
- Couples keyboard behavior to CSS class names (fragile — rename a class and escape stops working)
- Doesn't guarantee ordering (closes all at once instead of progressively)

### BUG-7: No-op Ctrl+Z/Y handlers in Workspace

**Severity:** Low

**Location:** `Workspace.svelte:127-134`

These handlers match Ctrl+Z/Y but do nothing — no `preventDefault()`, no action, just a comment "could be implemented later". They exist only to prevent the event from reaching keyboardHandler's equally useless placeholder. Dead code.

### BUG-8: 'c' key has no input guard or context check

**Severity:** Medium

**Location:** `Workspace.svelte:120-124`

The `c` key toggles the chart from any focus context, including when the trader is typing in an input. It also fires when a FloatingDisplay or FxBasket is focused, where the trader may not intend chart interaction.

---

## Proposed Architecture: Centralized Key Manager

### Design Principles

1. **Single document listener** — one `keydown` handler on `document`, not scattered `on:keydown` directives and `document.addEventListener` calls.
2. **Priority-based resolution** — the most specific/relevant handler wins. Ties go to the higher-priority handler.
3. **Input-safe by default** — every handler respects active text input unless explicitly opted in.
4. **Escape stack** — a LIFO stack of escape handlers. Components push when they open, pop when they close. No DOM queries.
5. **Explicit opt-in for bubbling** — handlers declare whether they want to allow fallback to lower-priority handlers.

### KeyManager API

```js
// src/lib/keyManager.js

const keyManager = {
  // Register a handler. Returns an unsubscribe function.
  // priority: 0 (global) to 100 (highest). Higher wins.
  // Returns false from handler to allow lower-priority handlers to run.
  register(binding, handler, { priority = 0, allowInput = false }),

  // Escape stack — push/pop for layered overlays
  pushEscape(handler),   // returns pop function
  popEscape(handler),

  // Convenience: check if a text input is focused
  isInputFocused(),

  // Lifecycle
  init(),    // attaches single document listener
  destroy(), // removes listener, clears all registrations
};
```

### Priority Tiers

| Priority | Tier | Use Case |
|----------|------|----------|
| 0 | Global | Display creation (Alt+A/B/T/I/W/R), navigation (arrows), help (?) |
| 10 | Display | Display-specific shortcuts (Alt+M, 'c') |
| 20 | Active widget | Modal navigation, form submission |
| 30 | Overlay | Context menu, dropdown — these need Escape exclusivity |
| 40 | Chart active | Chart undo/redo (Ctrl+Z/Y), overlay operations (Delete) |
| 50 | Text input | Browser-default typing behavior — all shortcuts suppressed |

### Resolution Algorithm

```
keydown event fires on document:

1. if isInputFocused() && handler.allowInput !== true → skip handler
2. collect all handlers matching the key combination
3. sort by priority (descending)
4. execute highest-priority handler
5. if handler returns false → continue to next handler
6. if handler returns true/undefined → stop propagation
7. for Escape specifically: check escape stack first, then fall through
```

### Escape Stack Behavior

Instead of the current "count ESC presses in 1 second" approach:

```
Component opens context menu:
  const closeMenu = keyManager.pushEscape(() => {
    contextMenu.close();
  });

Component closes:
  closeMenu();  // or keyManager.popEscape(handler)

Trader presses Escape:
  1. Check escape stack (LIFO)
  2. If stack has items → pop and execute top handler → STOP
  3. If stack is empty → clear display focus → STOP
```

This guarantees:
- The most recently opened overlay closes first
- No DOM queries or CSS class coupling
- Each component controls its own cleanup
- No race conditions from multiple simultaneous handlers

---

## File Impact

| File | Change |
|------|--------|
| `src/lib/keyManager.js` | **New** — central key registry, escape stack, input guard |
| `src/lib/keyboardHandler.js` | **Delete** — fully replaced by KeyManager |
| `src/components/Workspace.svelte` | Remove inline keydown/keyup handlers. Register global shortcuts (Alt+A/B/T/I, arrows, ?, c) with KeyManager in `onMount`. Remove `keyboardHandler` import. |
| `src/components/ChartDisplay.svelte` | Remove `on:keydown` and `document.addEventListener('keydown')`. Register chart shortcuts (Escape, Ctrl+Z/Y, Delete) with KeyManager. Add Escape stack push for overlay selection (deselect before close). Add input guard to Delete. |
| `src/components/FloatingDisplay.svelte` | Remove `on:keydown`. Register Alt+M with KeyManager. |
| `src/components/OverlayContextMenu.svelte` | Remove `document.addEventListener('keydown')`. Use `keyManager.pushEscape()` in `onMount`, pop in `onDestroy`. |
| `src/components/WorkspaceModal.svelte` | Remove `on:keydown`. Use `keyManager.pushEscape()` when shown, pop when hidden. Register Tab/Arrow navigation at modal priority. |
| `src/components/LoginForm.svelte` | No change — already scoped to element, no conflicts. |
| `src/lib/priceMarkerInteraction.js` | Remove `document.addEventListener('keydown')`. Accept a `pushEscape`/`popEscape` callback from the KeyManager. |
| `src/components/displays/DisplayHeader.svelte` | No change — Enter/Space for accessibility, scoped to element. |
| `src/components/displays/ChartHeader.svelte` | No change — Enter/Space for accessibility, scoped to element. |
| `src/components/KeyboardShortcutsHelp.svelte` | Update shortcut reference to match KeyManager registry. Consider using escape stack while shown. |

---

## Escape Behavior Redesign

### Current Behavior (Broken)

```
ESC press → keyboardHandler counts presses
  1st press: querySelectorAll('.modal, .overlay, .dropdown') → force remove
  2nd press: querySelectorAll('.focused') → remove class
```

### Proposed Behavior

```
ESC press → keyManager checks escape stack (LIFO)
  Stack has items → pop top → execute (e.g., "close context menu")
  Stack empty → clear display focus (workspaceActions.setSelectedDisplay(null))
```

### Example: Trader opens context menu on chart

```
1. Chart already focused
2. Trader right-clicks → context menu appears
3. OverlayContextMenu.onMount → keyManager.pushEscape(() => closeMenu())
4. Escape stack: [closeMenu]
5. Trader presses Escape
6. keyManager pops closeMenu → menu closes
7. Escape stack: []
8. Chart is still focused, overlay still selected
9. Trader presses Escape again
10. Stack empty → ChartDisplay pushes escape handler for "deselect overlay"
    → selectedOverlayId = null
11. Trader presses Escape again
12. Stack empty → ChartDisplay's escape handler at priority 40 → close chart
```

Wait — the overlay deselect shouldn't use the escape stack. The escape stack is for overlays/menus. Chart's own Escape behavior should be:
1. If overlay selected → deselect (clear selectedOverlayId)
2. If no overlay selected → close chart

This is a state machine within ChartDisplay, not escape stack items. The escape stack handles things that appear ON TOP of the chart (context menu, dropdown).

---

## Chart Escape State Machine

```
ChartDisplay focused:
  selectedOverlayId exists?
    → ESC: clear selectedOverlayId, return false (let event continue if needed)
    → DELETE/BACKSPACE: delete overlay

  selectedOverlayId is null?
    → ESC: close chart

  Context menu open on top?
    → ESC: close context menu (escape stack, higher priority than chart)
```

---

## Immediate Fixes (Before Full Migration)

These can be applied independently of the KeyManager migration:

### FIX-1: Remove no-op Ctrl+Z/Y from keyboardHandler.js

Delete lines 94-106 in `keyboardHandler.js`. These call `preventDefault()` on events that ChartDisplay actually handles, and they serve no purpose.

### FIX-2: Remove no-op Ctrl+Z/Y from Workspace.svelte

Delete lines 126-134 in `Workspace.svelte`. These are dead code with no `preventDefault()` and no action.

### FIX-3: Add input guard to Delete/Backspace handler

In `ChartDisplay.svelte:266`, add before the overlay check:

```js
function handleDocumentKeydown(e) {
  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedOverlayId && chart) {
    e.preventDefault(); e.stopPropagation();
    drawingHandlers.handleOverlayDelete(selectedOverlayId);
    selectedOverlayId = null;
  }
}
```

### FIX-4: Add input guard to Workspace keydown

In `Workspace.svelte:102`, add an early return at the top of `handleKeydown`:

```js
function handleKeydown(event) {
  const tag = event.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable) return;
  // ... rest of handler
}
```

This guards `?`, `Alt+W`, `Alt+R`, `c`, and the delegation to `keyboardHandler`.

### FIX-5: Add overlay deselect step before chart close

In `ChartDisplay.svelte:258`, change the Escape handler:

```js
keydown: (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    if (selectedOverlayId) {
      selectedOverlayId = null;  // deselect first
    } else {
      handlers.close();  // close chart only if nothing selected
    }
    return;
  }
  // ... rest
}
```

Note: This only works when the chart has focus. When the context menu is open (BUG-2), the chart handler fires first and would still close the chart. The full KeyManager migration is needed to fix BUG-2 properly.
