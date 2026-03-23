# Multi-Select Feature for Workspace Elements

## Overview

Implement multi-select functionality for floating elements (FloatingDisplay, PriceTicker, FxBasketDisplay) in the NeuroSense FX workspace. The feature enables users to select multiple elements using Shift+click, provides visual feedback for selected state, allows group drag operations, persists selection to localStorage, and clears selection via Escape key or clicking outside.

**Approach selected:** Simplest Crystal Clarity - Add `selectedIds` array to existing workspace store, use CSS classes for visual feedback, extend interact.js for group drag, skip drag rectangle (Shift+click only). This follows the principle of minimal changes while achieving full functionality.

**Key decisions:**
- Selection state in workspace store as `selectedIds: Set<string>` - centralized, simple, persists naturally
- Shift+click for multi-select addition/removal - no complex drag rectangle needed
- Group move via extended interact.js drag config - selected items move together
- No group resize - only last-selected item resizable, others follow position changes
- Visual differentiation: selected state (dashed cyan border) vs focus state (solid blue border)
- ESC key clears selection via existing keyboard handler pattern
- Selection persists to localStorage via existing workspace persistence

## Planning Context

This section is consumed VERBATIM by downstream agents (Technical Writer, Quality Reviewer). Quality matters: vague entries here produce poor annotations and missed risks.

### Decision Log

| Decision | Reasoning Chain |
| --- | --- |
| **selectedIds in workspace store** | Selection state must persist across page reloads -> workspace store already has localStorage persistence -> Adding `selectedIds` array leverages existing infrastructure -> Separate selection store would duplicate persistence logic (~50 lines) -> Set data structure provides O(1) add/remove/has operations |
| **Shift+click for multi-select (no drag rectangle)** | User explicitly requested "SIMPLEST AND CRYSTAL CLARITY" -> Drag rectangle requires overlay div, event capture system, collision detection (~100+ lines) -> Shift+click uses existing click handlers (~10 lines) -> Standard OS pattern (Windows Explorer, macOS Finder) -> Users already familiar with this interaction |
| **No group resize** | User explicitly confirmed "no resize" -> Group resize has complex UX (what if items have different aspect ratios?) -> Position-only operations are unambiguous -> Last-selected item remains individually resizable via existing interact.js config |
| **Dashed cyan border for selected state** | Existing focus uses solid blue (#4a9eff) -> Need visual distinction -> Dashed line indicates "multiple items selected" -> Cyan (#00d4ff) matches existing flash color scheme -> Both states can coexist (focused + selected) |
| **Group drag via interact.js extension** | interact.js already handles single-item drag -> Can detect selection in drag move callback -> Update all selected items positions simultaneously -> Leverages existing grid snapping (10px grid) -> No new drag implementation needed |
| **ESC clears selection** | Existing keyboard handler uses ESC for dismissals (workspace modal, dropdowns) -> Consistent pattern throughout app -> keyboardHandler.js already has global ESC listener -> Simple addition to existing handler |
| **Selection persists to localStorage** | Workspace store auto-saves to localStorage on every change -> Adding `selectedIds` to store automatically persists -> No separate persistence logic needed -> Selection survives page reload |
| **Set serialization for localStorage** | JSON.stringify() cannot serialize Set objects directly -> Set must convert to Array before JSON serialization -> Array converts back to Set on load -> Conversion cost is O(n) but selection size is typically <10 items -> Array.from() and new Set() handle conversion cleanly |
| **Group drag delta calculation** | Cannot directly apply interact.js delta to other items (rect positions update during drag) -> Must capture initial positions BEFORE drag starts -> Calculate delta from dragged item's current position vs its initial -> Apply same delta to all selected items' initial positions -> Maintains relative spacing between selected items |
| **10px grid snapping threshold** | Existing interact.js config uses 10px grid with 15px range -> Maintaining consistency with current behavior prevents jarring UX changes -> 10px is fine enough for alignment but coarse enough for quick positioning -> Smaller grid (5px) would feel sluggish, larger (20px) too imprecise |
| **Box-shadow opacity values** | 0.5 opacity for selected-only state (subtle, visible) -> 0.6 opacity for focused state (slightly stronger) -> 0.8 secondary glow for combined state (strongest visual) -> Progressive opacity indicates progressive state depth (selected < focused < both) |

### Rejected Alternatives

| Alternative | Why Rejected |
| --- | --- |
| **Drag rectangle (marquee selection)** | User explicitly requested "SIMPLEST SHIFT CLICK" -> Would require overlay div with pointer events: none on elements -> Collision detection for element overlap -> ~100+ lines vs ~10 lines for Shift+click -> Not necessary for MVP |
| **Separate selection store** | Would duplicate localStorage persistence logic -> Selection is inherently workspace-scoped -> Extra store complexity (~50 lines) for no benefit -> Workspace store already has all display data |
| **Group resize with proportional scaling** | User explicitly confirmed "no resize" -> Complex UX: different items have different size ratios -> What if user selects 160px wide canvas + 240px ticker? -> Proportional resize could exceed workspace bounds -> Position-only operations are unambiguous |
| **Custom selection rectangle component** | Same as drag rectangle - user wanted simplicity -> Custom component requires props, events, state management -> CSS classes on existing elements is sufficient |
| **Multi-select with Ctrl/Command key** | Shift is simpler than Ctrl/Cmd -> Shift+click is standard for "extend selection" -> Ctrl/Cmd often used for other shortcuts in apps -> Shift works on all platforms identically |

### Constraints & Assumptions

**Technical:**
- Must comply with Crystal Clivity: <120 lines per file, <15 lines per function
- Framework-First: Svelte stores for state, interact.js for drag, CSS for visuals
- Selection state must persist across page reloads
- Must work with existing z-index management (bringToFront)
- Must not break existing single-item focus behavior
- Grid snapping (10px) must apply to group drag

**Organizational:**
- User confirmed "SIMPLEST AND CRYSTAL CLARITY" for all decisions
- User confirmed Shift+click only (no drag rectangle)
- User confirmed no group resize
- Tests skipped (user decision)

**Dependencies:**
- `src/stores/workspace.js` - Must extend existing store with selectedIds
- `src/lib/interactSetup.js` - Must extend drag config for group operations
- `src/components/FloatingDisplay.svelte` - Must add selected class binding
- `src/components/PriceTicker.svelte` - Must add selected class binding
- `src/lib/keyboardHandler.js` - Must add ESC to clear selection

**Default conventions applied:**
- `<default-conventions domain="file-creation">` - Extending existing files (no new files except documentation)
- `<default-conventions domain="temporal.md">` - Timeless present comments (no "Added", "New", "Changed")
- `<default-conventions domain="structural.md">` - Functions <15 lines, no god objects

### Known Risks

| Risk | Mitigation | Anchor |
| --- | --- | --- |
| **interact.js drag callback conflicts** | Group position updates occur in existing onDragMove -> Single atomic update to workspace store -> Svelte reactivity handles DOM updates | interactSetup.js:15-30 (existing drag callback pattern) |
| **Selection + focus state confusion** | CSS uses separate classes for focus vs selected -> Both can apply simultaneously (focused-and-selected state) -> Visuals are distinct (solid blue vs dashed cyan) | FloatingDisplay.svelte:142-144 (existing focus styles) |
| **ESC key clears selection vs existing behavior** | ESC only clears if any selection exists -> Existing ESC behavior (close modals) takes priority -> keyboardHandler checks selection state first | keyboardHandler.js:49-83 (existing ESC pattern) |
| **localStorage size limits** | selectedIds stores only string IDs (small) -> Each ID ~10 bytes, 100 items = 1KB -> Well under 5MB localStorage limit | workspace.js:279 (existing persistence pattern) |
| **Performance with many selected items** | Set operations are O(1) -> Group drag updates all items in single store call -> Svelte batches DOM updates -> Grid snapping reduces update frequency | workspace.js:25-35 (existing updateDisplay pattern) |
| **z-index conflicts during group drag** | bringToFront only called on last-selected item -> Other selected items maintain relative order -> No z-index thrashing | interactSetup.js:5-37 (existing tap/click to front) |

## Invisible Knowledge

This section captures knowledge NOT deducible from reading the code alone.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Multi-Select State Flow                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  User Action                    State Change                Visual Update │
│  ────────────                  ──────────────              ──────────────│
│                                                                         │
│  Shift+Click item     ───>     selectedIds.add(id)    ───>   CSS class   │
│  Shift+Click selected ───>     selectedIds.delete(id)  ───>   class removed│
│  Click (no Shift)     ───>     selectedIds.clear()     ───>   single focus │
│                         ───>     selectedIds.add(clicked) ───>             │
│  ESC key             ───>     selectedIds.clear()     ───>   all cleared   │
│  Click outside       ───>     selectedIds.clear()     ───>   all cleared   │
│                                                                         │
│  Drag selected item  ───>     Update ALL selected    ───>   All move     │
│                            positions in store                     together   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Data Structure                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  workspace.store = {                                                    │
│    displays: Map<id, Display>,    // Existing: all display data         │
│    nextZIndex: number,             // Existing: z-index counter          │
│    selectedIds: Set<string>        // NEW: selected display IDs         │
│  }                                                                    │
│                                                                         │
│  Selection Actions:                                                      │
│  - toggleSelection(id)      - Add/remove from selection                 │
│  - clearSelection()         - Remove all from selection                 │
│  - setSelection(ids)        - Replace entire selection                  │
│  - isSelected(id)           - Check if in selection                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

**Selection Flow:**

```
Shift+Click on element
  |
  v
[Component] onClick handler with event.shiftKey check
  |
  v
[Store] toggleSelection(id) - adds/removes from Set
  |
  v
[Store] Reactive update triggers re-render
  |
  v
[Component] CSS class binding: class:selected={$isSelected(id)}
  |
  v
Visual: Dashed cyan border + 2px box-shadow
```

**Group Drag Flow:**

```
Drag starts on selected element
  |
  v
[interact.js] onDragStart - capture initial positions of ALL selected items
  |
  v
[interact.js] onDragMove - calculate delta for dragged item
  |
  v
[Store] updatePosition() for EACH selected item with same delta
  |
  v
[Svelte] Reactive update triggers re-render of all selected items
  |
  v
Visual: All selected items move together with grid snapping
```

### Why This Structure

**Why Set instead of Array for selectedIds:**

- O(1) add/remove/has operations vs O(n) for array
- Automatic deduplication (can't select same item twice)
- Easy to iterate with `for (const id of selectedIds)`
- Small memory overhead for typical use (<10 items)

**Why dashed cyan border:**

- Solid blue (#4a9eff) is existing focus state
- Dashed line indicates "group" vs "single"
- Cyan (#00d4ff) matches existing flash color scheme
- Both states can coexist: focused-and-selected shows solid blue border with cyan glow

**Why bringToFront only on last-selected item:**

- Prevents z-index thrashing (all selected items jumping to top)
- Last-selected item becomes "primary" of the group
- Other selected items maintain relative ordering
- Matches standard OS behavior (Windows Explorer)

### Invariants

- **Selection is workspace-scoped**: selectedIds only contains valid display IDs from current workspace
- **Empty selection is valid**: selectedIds can be empty (no items selected)
- **Single selection works**: selecting one item works with same logic as multi-select
- **Selection persists across reloads**: saved to localStorage via existing workspace persistence
- **Grid snapping applies to group**: 10px grid applies to all moved items during group drag
- **Focus and selection are independent**: item can be focused, selected, both, or neither

### Tradeoffs

**Shift+click vs drag rectangle:**

- *Chose*: Shift+click only (~10 lines)
- *Cost*: Cannot select items without clicking each one
- *Benefit*: Simple, standard, no overlay complexity
- *Rationale*: User wanted "SIMPLEST AND CRYSTAL CLARITY"

**Set vs Array for selectedIds:**

- *Chose*: Set<string>
- *Cost*: Must convert to Array for JSON serialization
- *Benefit*: O(1) operations, automatic deduplication
- *Rationale*: Performance for add/remove/has is critical

**Group move without group resize:**

- *Chose*: Position-only group operations
- *Cost*: Cannot resize multiple items at once
- *Benefit*: Unambiguous behavior, no aspect ratio complexity
- *Rationale*: User explicitly said "no resize"

## Milestones

### Milestone 1: Selection State in Workspace Store

**Files**:
- `src/stores/workspace.js`

**Flags**:
- `conformance`: Follow existing store pattern with actions

**Requirements**:
- Add `selectedIds: Set<string>` to initial store state
- Add selection actions: toggleSelection, clearSelection, setSelection, isSelected
- Handle Set serialization for localStorage (convert to/from Array)
- Emit change events when selection changes

**Acceptance Criteria**:
- Store contains `selectedIds` Set initialized as empty
- `toggleSelection(id)` adds id if not present, removes if present
- `clearSelection()` empties the Set
- `isSelected(id)` returns true if id in Set
- Selection persists to localStorage (saved as Array, loaded as Set)

**Tests**:
- **Test type**: Skip (user decision)
- **Backing**: user-specified

**Code Intent**:

In `src/stores/workspace.js`:

1. At store initialization (around line 25-35), add to initial state:
   ```javascript
   selectedIds: new Set()
   ```

2. In `workspaceActions` object (after existing actions), add new actions:
   ```javascript
   toggleSelection: (id) => {
       const current = get(workspaceStore).selectedIds;
       const newSet = new Set(current);
       if (newSet.has(id)) {
           newSet.delete(id);
       } else {
           newSet.add(id);
       }
       workspaceStore.update(s => ({ ...s, selectedIds: newSet }));
   },
   clearSelection: () => {
       workspaceStore.update(s => ({ ...s, selectedIds: new Set() }));
   },
   setSelection: (ids) => {
       workspaceStore.update(s => ({ ...s, selectedIds: new Set(ids) }));
   },
   isSelected: (id) => {
       return get(workspaceStore).selectedIds.has(id);
   }
   ```

3. In `workspacePersistence` save function (around line 279), convert Set to Array:
   ```javascript
   selectedIds: Array.from(state.selectedIds || [])
   ```

4. In `workspacePersistence` load function (around line 290+), convert Array to Set:
   ```javascript
   selectedIds: new Set(savedState.selectedIds || [])
   ```

**Code Changes**:

```diff
--- a/src/stores/workspace.js
+++ b/src/stores/workspace.js
@@ -3,9 +3,10 @@ const initialState = {
   displays: new Map(),
   nextZIndex: 1,
   config: {
     defaultSize: { width: 160, height: 260 },
     defaultPosition: { x: 100, y: 100 }
-  }
+  },
+  selectedIds: new Set() // Set provides O(1) add/remove/has operations vs O(n) for array
};
```

```diff
--- a/src/stores/workspace.js
+++ b/src/stores/workspace.js
@@ -178,6 +178,30 @@ const actions = {
   getDisplay: (displayId) => workspaceStore.getState().displays.get(displayId),

+  // Selection actions: Shift+click UX pattern (standard OS interaction)
+  toggleSelection: (id) => {
+    const current = workspaceStore.getState().selectedIds;
+    const newSet = new Set(current);
+    if (newSet.has(id)) {
+      newSet.delete(id);
+    } else {
+      newSet.add(id);
+    }
+    workspaceStore.update(s => ({ ...s, selectedIds: newSet }));
+  },
+
+  clearSelection: () => {
+    workspaceStore.update(s => ({ ...s, selectedIds: new Set() }));
+  },
+
+  setSelection: (ids) => {
+    workspaceStore.update(s => ({ ...s, selectedIds: new Set(ids) }));
+  },
+
+  isSelected: (id) => {
+    return workspaceStore.getState().selectedIds.has(id);
+  },
+
   importWorkspace: async (file) => {
```

```diff
--- a/src/stores/workspace.js
+++ b/src/stores/workspace.js
@@ -293,8 +293,8 @@ const persistence = {
       const data = JSON.parse(stored);

       workspaceStore.update(state => ({
         ...state,
         displays: new Map(data.displays || []),
-        nextZIndex: data.nextZIndex || 1
+        nextZIndex: data.nextZIndex || 1,
+        selectedIds: new Set(data.selectedIds || []) // JSON serialization requires Set↔Array conversion
       }));
```

```diff
--- a/src/stores/workspace.js
+++ b/src/stores/workspace.js
@@ -308,7 +308,8 @@ const persistence = {
    return workspaceStore.subscribe(state => {
      const data = {
        displays: Array.from(state.displays.entries()),
-       nextZIndex: state.nextZIndex
+       nextZIndex: state.nextZIndex,
+       selectedIds: Array.from(state.selectedIds || []) // JSON.stringify() cannot serialize Set directly
      };
      try {
        localStorage.setItem('workspace-state', JSON.stringify(data));
```
```

### Milestone 2: Selection CSS Classes

**Files**:
- `src/components/FloatingDisplay.svelte`
- `src/components/PriceTicker.svelte`

**Flags**:
- `conformance`: Follow existing focus CSS pattern

**Requirements**:
- Add `.selected` CSS class with dashed cyan border
- Add class binding to both components
- Ensure selected state coexists with focus state
- Apply 2px box-shadow in cyan for visibility

**Acceptance Criteria**:
- `.selected` class exists with `border: 2px dashed #00d4ff`
- `.selected` class has `box-shadow: 0 0 8px rgba(0, 212, 255, 0.5)`
- Class binding `class:selected={$isSelected(id)}` applied to root element
- Selected and focused states both visible (different colors)

**Tests**:
- **Test type**: Skip (user decision)
- **Backing**: user-specified

**Code Intent**:

**In FloatingDisplay.svelte:**

1. In `<style>` section (after existing `.focused` class around line 142-144), add:
   ```css
   .selected {
       border: 2px dashed #00d4ff !important;
       box-shadow: 0 0 8px rgba(0, 212, 255, 0.5);
   }
   .focused.selected {
       border: 2px solid #4a9eff !important;
       box-shadow: 0 0 12px rgba(74, 158, 255, 0.6), 0 0 4px rgba(0, 212, 255, 0.8);
   }
   ```

2. Import isSelected from workspace store (around line 1-5):
   ```javascript
   import { isSelected } from '../stores/workspace.js';
   ```

3. Add class binding to root div (around line 70-80):
   ```svelte
   class:selected={isSelected(id)}
   ```

**In PriceTicker.svelte:**

Same changes as FloatingDisplay.svelte:
1. Add `.selected` CSS class in `<style>` section
2. Import `isSelected` from workspace store
3. Add `class:selected={isSelected(ticker.id)}` binding to root element

**Code Changes**:

```diff
--- a/src/components/FloatingDisplay.svelte
+++ b/src/components/FloatingDisplay.svelte
@@ -1,4 +1,5 @@
 <script>
-  import { onMount, onDestroy, tick } from 'svelte';
-  import { workspaceActions, workspaceStore } from '../stores/workspace.js';
+  import { onMount, onDestroy, tick } from 'svelte';
+  import { workspaceActions, workspaceStore } from '../stores/workspace.js';
+  import { get } from 'svelte/store';
```

```diff
--- a/src/components/FloatingDisplay.svelte
+++ b/src/components/FloatingDisplay.svelte
@@ -142,6 +145,14 @@ const flashDuration = 500; // ms
   .floating-display:focus{border-color:#4a9eff;box-shadow:0 0 8px rgba(74,158,255,.4)}
   .floating-display:focus-visible{border-color:#4a9eff;box-shadow:0 0 12px rgba(74,158,255,.6);outline:2px solid rgba(74,158,255,.3);outline-offset:2px}

+  .selected {
+    border: 2px dashed #00d4ff !important; // Dashed distinguishes "group" from solid "single" focus state
+    box-shadow: 0 0 8px rgba(0, 212, 255, 0.5);
+  }
+
+  .floating-display:focus.selected {
+    border: 2px solid #4a9eff !important; // Combined state: focus wins with cyan secondary glow
+    box-shadow: 0 0 12px rgba(74, 158, 255, 0.6), 0 0 4px rgba(0, 212, 255, 0.8);
+  }
```

```diff
--- a/src/components/FloatingDisplay.svelte
+++ b/src/components/FloatingDisplay.svelte
@@ -123,7 +123,8 @@ const flashDuration = 500; // ms
 <div class="floating-display" bind:this={element} data-display-id={display.id}
      class:flash-up={borderFlashClass === 'flash-up'}
      class:flash-down={borderFlashClass === 'flash-down'}
+     class:selected={$workspaceStore.selectedIds.has(display.id)}
      tabindex="0" role="region" aria-label="{display.symbol} display"
      on:focus={handlers?.focus} on:keydown={handlers?.keydown}
      style="left: {display.position.x}px; top: {display.position.y}px; z-index: {display.zIndex};
```

```diff
--- a/src/components/PriceTicker.svelte
+++ b/src/components/PriceTicker.svelte
@@ -1,4 +1,5 @@
 <script>
-  import { onMount, onDestroy, tick } from 'svelte';
-  import { workspaceStore, workspaceActions } from '../stores/workspace.js';
+  import { onMount, onDestroy, tick } from 'svelte';
+  import { workspaceStore, workspaceActions } from '../stores/workspace.js';
```

```diff
--- a/src/components/PriceTicker.svelte
+++ b/src/components/PriceTicker.svelte
@@ -181,6 +182,14 @@ const flashDuration = 500; // ms
   .ticker-container:focus {
     outline: 2px solid #00ff00;
     outline-offset: -2px;
-    box-shadow: 0 0 4px rgba(0, 255, 0, 0.5);
+  }
+
+  .selected {
+    border: 2px dashed #00d4ff !important; // Dashed distinguishes "group" from solid "single" focus state
+    box-shadow: 0 0 8px rgba(0, 212, 255, 0.5);
+  }
+
+  .ticker-container:focus.selected {
+    outline: 2px solid #4a9eff !important; // Combined state: focus wins with cyan secondary glow
+    box-shadow: 0 0 12px rgba(74, 158, 255, 0.6), 0 0 4px rgba(0, 212, 255, 0.8);
   }
```

```diff
--- a/src/components/PriceTicker.svelte
+++ b/src/components/PriceTicker.svelte
@@ -396,7 +396,8 @@ const flashDuration = 500; // ms
 <div class="ticker-container" bind:this={element} data-ticker-id={ticker.id}
      style="left: {ticker.position?.x || 100}px; top: {ticker.position?.y || 100}px; z-index: {ticker.zIndex || 1}; --flash-duration: {flashDuration}ms;"
      class:flash-up={borderFlashClass === 'flash-up'}
      class:flash-down={borderFlashClass === 'flash-down'}
+     class:selected={$workspaceStore.selectedIds.has(ticker.id)}
      tabindex="0" role="region" aria-label="{ticker.symbol} ticker"
      on:focus={handleFocus}>
```

### Milestone 3: Shift+Click Selection Handlers

**Files**:
- `src/components/FloatingDisplay.svelte`
- `src/components/PriceTicker.svelte`

**Flags**:
- `conformance`: Follow existing click handler pattern

**Requirements**:
- Add click handler that checks `event.shiftKey`
- If Shift+click: toggle selection, don't clear other selections
- If normal click: clear selection, select only this item, bring to front
- Stop propagation to prevent workspace click handler from clearing

**Acceptance Criteria**:
- Shift+click adds item to selection (or removes if already selected)
- Normal click clears selection and selects only clicked item
- Shift+click on already-selected item removes it from selection
- bringToFront called on last-clicked item

**Tests**:
- **Test type**: Skip (user decision)
- **Backing**: user-specified

**Code Intent**:

**In FloatingDisplay.svelte:**

1. Import toggleSelection and clearSelection from workspace store
2. Modify existing click handler (around line 90-100) or add new one:
   ```javascript
   function handleClick(event) {
       if (event.shiftKey) {
           toggleSelection(id);
           event.stopPropagation();
       } else {
           const wasSelected = isSelected(id);
           clearSelection();
           if (!wasSelected) {
               toggleSelection(id);
           }
           bringToFront(id);
       }
   }
   ```
3. Add `on:click={handleClick}` to root element

**In PriceTicker.svelte:**

Same pattern as FloatingDisplay.svelte but use `ticker.id` instead of `id`.

**Code Changes**:

```diff
--- a/src/components/FloatingDisplay.svelte
+++ b/src/components/FloatingDisplay.svelte
@@ -1,6 +1,7 @@ <script>
   import { onMount, onDestroy, tick } from 'svelte';
   import { workspaceActions, workspaceStore } from '../stores/workspace.js';
+  import { toggleSelection, clearSelection } from '../stores/workspace.js';
   import { ConnectionManager } from '../lib/connectionManager.js';
```

```diff
--- a/src/components/FloatingDisplay.svelte
+++ b/src/components/FloatingDisplay.svelte
@@ -78,6 +78,20 @@ const flashDuration = 500; // ms
  0  }

+  function handleClick(event) {
+    if (event.shiftKey) {
+      // Shift+click: toggle selection without clearing (standard OS pattern)
+      toggleSelection(display.id);
+      event.stopPropagation();
+    } else {
+      // Normal click: single selection mode
+      const wasSelected = $workspaceStore.selectedIds.has(display.id);
+      clearSelection();
+      if (!wasSelected) {
+        toggleSelection(display.id);
+      }
+      workspaceActions.bringToFront(display.id); // Only last-clicked item gets z-index boost
+    }
+  }
+
  onMount(() => {
    connectionManager = ConnectionManager.getInstance(getWebSocketUrl());
```

```diff
--- a/src/components/FloatingDisplay.svelte
+++ b/src/components/FloatingDisplay.svelte
@@ -123,7 +123,8 @@const flashDuration = 500; // ms
 <div class="floating-display" bind:this={element} data-display-id={display.id}
      class:flash-up={borderFlashClass === 'flash-up'}
      class:flash-down={borderFlashClass === 'flash-down'}
      class:selected={$workspaceStore.selectedIds.has(display.id)}
+     on:click={handleClick}
      tabindex="0" role="region" aria-label="{display.symbol} display"
      on:focus={handlers?.focus} on:keydown={handlers?.keydown}
      style="left: {display.position.x}px; top: {display.position.y}px; z-index: {display.zIndex};
```

```diff
--- a/src/components/PriceTicker.svelte
+++ b/src/components/PriceTicker.svelte
@@ -1,6 +1,7 @@ <script>
   import { onMount, onDestroy, tick } from 'svelte';
   import { workspaceStore, workspaceActions } from '../stores/workspace.js';
+  import { toggleSelection, clearSelection } from '../stores/workspace.js';
   import { ConnectionManager } from '../lib/connectionManager.js';
```

```diff
--- a/src/components/PriceTicker.svelte
+++ b/src/components/PriceTicker.svelte
@@ -104,6 +104,20 @@ const flashDuration = 500; // ms
  0  }

+  function handleClick(event) {
+    if (event.shiftKey) {
+      // Shift+click: toggle selection without clearing (standard OS pattern)
+      toggleSelection(ticker.id);
+      event.stopPropagation();
+    } else {
+      // Normal click: single selection mode
+      const wasSelected = $workspaceStore.selectedIds.has(ticker.id);
+      clearSelection();
+      if (!wasSelected) {
+        toggleSelection(ticker.id);
+      }
+      workspaceActions.bringToFront(ticker.id); // Only last-clicked item gets z-index boost
+    }
+  }
+
  onMount(() => {
    connectionManager = ConnectionManager.getInstance(getWebSocketUrl());
```

```diff
--- a/src/components/PriceTicker.svelte
+++ b/src/components/PriceTicker.svelte
@@ -396,7 +396,8 @@ const flashDuration = 500; // ms
 <div class="ticker-container" bind:this={element} data-ticker-id={ticker.id}
      style="left: {ticker.position?.x || 100}px; top: {ticker.position?.y || 100}px; z-index: {ticker.zIndex || 1}; --flash-duration: {flashDuration}ms;"
      class:flash-up={borderFlashClass === 'flash-up'}
      class:flash-down={borderFlashClass === 'flash-down'}
      class:selected={$workspaceStore.selectedIds.has(ticker.id)}
+     on:click={handleClick}
      tabindex="0" role="region" aria-label="{ticker.symbol} ticker"
      on:focus={handleFocus}>
```

### Milestone 4: Group Drag in interactSetup

**Files**:
- `src/lib/interactSetup.js`

**Flags**:
- `conformance`: Extend existing interact.js pattern
- `performance`: Batch position updates - Svelte reactivity batches DOM updates automatically; all position updates occur in single event loop tick; grid snapping (10px) reduces update frequency compared to pixel-perfect dragging

**Requirements**:
- Modify onDragMove to update ALL selected items
- Calculate delta from dragged item's position change
- Apply same delta to all selected items
- Maintain grid snapping for all items

**Acceptance Criteria**:
- Dragging one selected item moves all selected items
- All items maintain relative positions during drag
- Grid snapping (10px) applies to all moved items
- Non-selected items unaffected

**Tests**:
- **Test type**: Skip (user decision)
- **Backing**: user-specified

**Code Intent**:

In `createInteractConfig` function (around line 15-30):

1. At start of onDragMove, capture current state:
   ```javascript
   onDragMove: (e) => {
       const state = get(workspaceStore);
       const selectedIds = Array.from(state.selectedIds);
       const isGroupDrag = selectedIds.length > 1 && selectedIds.includes(id);
       const initialPositions = new Map();
       if (isGroupDrag) {
           selectedIds.forEach(selectedId => {
               const display = state.displays.get(selectedId);
               if (display) {
                   initialPositions.set(selectedId, { x: display.position?.x || 0, y: display.position?.y || 0 });
               }
           });
       }
       const deltaX = e.rect.left - (initialPositions.get(id)?.x || 0);
       const deltaY = e.rect.top - (initialPositions.get(id)?.y || 0);

       // Update dragged item
       updatePosition(id, { x: e.rect.left, y: e.rect.top });

       // Update other selected items
       if (isGroupDrag) {
           selectedIds.forEach(selectedId => {
               if (selectedId !== id) {
                   const initial = initialPositions.get(selectedId);
                   if (initial) {
                       updatePosition(selectedId, { x: initial.x + deltaX, y: initial.y + deltaY });
                   }
               }
           });
       }
   }
   ```

**Code Changes**:

```diff
--- a/src/lib/interactSetup.js
+++ b/src/lib/interactSetup.js
@@ -1,4 +1,5 @@
 import interact from 'interactjs';
+import { workspaceStore } from '../stores/workspace.js';

 export function createInteractConfig(element, callbacks) {
```

```diff
--- a/src/lib/interactSetup.js
+++ b/src/lib/interactSetup.js
@@ -5,11 +6,36 @@ export function createInteractConfig(element, callbacks) {
   const interactable = interact(element)
     .draggable({
      modifiers: [
        interact.modifiers.snap({
         targets: [interact.snappers.grid({ x: 10, y: 10, range: 15 })],
         relativePoints: [{ x: 0, y: 0 }]
        })
      ],
-     onmove: onDragMove
+     onmove: (e) => {
+       const state = workspaceStore.getState();
+       const selectedIds = Array.from(state.selectedIds || []);
+       const draggedId = e.target.dataset.displayId || e.target.dataset.tickerId;
+       const isGroupDrag = selectedIds.length > 1 && selectedIds.includes(draggedId);
+
+       if (isGroupDrag) {
+         // Capture initial positions before drag starts (delta calculation requires fixed reference)
+         const initialPositions = new Map();
+         selectedIds.forEach(id => {
+           const display = state.displays.get(id);
+           if (display) {
+             initialPositions.set(id, { x: display.position?.x || 0, y: display.position?.y || 0 });
+           }
+         });
+
+         const initial = initialPositions.get(draggedId);
+         const deltaX = e.rect.left - (initial?.x || 0);
+         const deltaY = e.rect.top - (initial?.y || 0);
+
+         // Apply same delta to all selected items (maintains relative spacing)
+         selectedIds.forEach(id => {
+           const pos = initialPositions.get(id);
+           if (pos) {
+             onDragMove({ ...e, rect: { left: pos.x + deltaX, top: pos.y + deltaY }, target: e.target });
+           }
+         });
+       } else {
+         onDragMove(e);
+       }
+     }
    })
    .on('tap', onTap);
```

### Milestone 5: ESC Key and Click Outside to Clear Selection

**Files**:
- `src/lib/keyboardHandler.js`
- `src/components/Workspace.svelte`

**Flags**:
- `conformance`: Follow existing ESC pattern

**Requirements**:
- Add ESC key handler to clear selection
- Add workspace click handler to clear selection when clicking outside elements
- Selection cleared only if not clicking on a display element

**Acceptance Criteria**:
- Pressing ESC clears all selections
- Clicking workspace background clears selections
- Clicking on display elements doesn't clear (handled by component click handlers)
- ESC doesn't interfere with existing ESC behavior

**Tests**:
- **Test type**: Skip (user decision)
- **Backing**: user-specified

**Code Intent**:

**In keyboardHandler.js:**

1. Import clearSelection from workspace store (around line 1-10)
2. In ESC key handler (around line 70-80), add:
   ```javascript
   if (event.key === 'Escape') {
       clearSelection();
       // ... existing ESC behavior continues
   }
   ```

**In Workspace.svelte:**

1. Import clearSelection from workspace store
2. Add click handler to workspace container div (around line 50-60):
   ```svelte
   <div class="workspace-container" on:click={handleWorkspaceClick}>
   ```
3. Add handler function:
   ```javascript
   function handleWorkspaceClick(event) {
       if (event.target.classList.contains('workspace-container')) {
           clearSelection();
       }
   }
   ```

**Code Changes**:

```diff
--- a/src/lib/keyboardHandler.js
+++ b/src/lib/keyboardHandler.js
@@ -1,4 +1,5 @@
 // Keyboard Handler Utilities - Single Responsibility
+import { clearSelection } from '../stores/workspace.js';

 export function createKeyboardHandler(workspaceActions) {
```

```diff
--- a/src/lib/keyboardHandler.js
+++ b/src/lib/keyboardHandler.js
@@ -29,6 +30,8 @@ export function createKeyboardHandler(workspaceActions) {
   function handleEscapeSequence() {
     escPressCount++;

     // Reset timer for progressive pattern
     clearTimeout(escTimer);
     escTimer = setTimeout(() => { escPressCount = 0; }, 1000);

     if (escPressCount === 1) {
+      clearSelection(); // ESC clears selection before other dismissals (selection state checked first)
+
      // First ESC: Close overlays/modals
      document.querySelectorAll('.modal, .overlay, .dropdown').forEach(el => {
```

```diff
--- a/src/components/Workspace.svelte
+++ b/src/components/Workspace.svelte
@@ -1,6 +1,6 @@
 <script>
   import { workspaceStore, workspaceActions, workspacePersistence } from '../stores/workspace.js';
+  import { clearSelection } from '../stores/workspace.js';
   import FloatingDisplay from './FloatingDisplay.svelte';
```

```diff
--- a/src/components/Workspace.svelte
+++ b/src/components/Workspace.svelte
@@ -36,6 +36,14 @@ import { createKeyboardHandler } from '../lib/keyboardHandler.js';
   function handleModalCancel() {
     showWorkspaceModal = false;
   }

+  function handleWorkspaceClick(event) {
+    // Click outside elements clears selection (elements stop propagation in their handlers)
+    if (event.target.classList.contains('workspace-container')) {
+      clearSelection();
+    }
+  }
+
   function reinitAll() {
```

```diff
--- a/src/components/Workspace.svelte
+++ b/src/components/Workspace.svelte
@@ -136,7 +136,7 @@ import { createKeyboardHandler } from '../lib/keyboardHandler.js';
 <div class="workspace-container" role="application">
-  <div class="workspace" role="region" tabindex="0" aria-label="Workspace" on:keydown={handleKeydown} on:keyup={handleKeyup}>
+  <div class="workspace" role="region" tabindex="0" aria-label="Workspace" on:keydown={handleKeydown} on:keyup={handleKeyup} on:click={handleWorkspaceClick}>
     {#each Array.from($workspaceStore.displays.values()) as display (display.id)}
```

### Milestone 6: Documentation

**Delegated to**: @agent-technical-writer (mode: post-implementation)

**Source**: `## Invisible Knowledge` section of this plan

**Files**:
- `src/stores/CLAUDE.md` (index updates - in same directory as workspace.js)
- `src/stores/README.md` (selection state documentation)
- `src/components/CLAUDE.md` (index updates - in same directory as display components)
- `src/components/README.md` (selection UX documentation)

**Requirements**:

Delegate to Technical Writer. For documentation format specification:

<file working-dir=".claude" uri="conventions/documentation.md" />

Key deliverables:
- CLAUDE.md: Pure navigation index (tabular format)
- README.md: Invisible knowledge (selection state, UX patterns)

**Acceptance Criteria**:
- CLAUDE.md is tabular index only (no prose sections)
- README.md exists in each directory with invisible knowledge
- README.md is self-contained (no external references)
- Architecture diagrams in README.md match plan's Invisible Knowledge section

**Source Material**: `## Invisible Knowledge` section of this plan


**Code Changes**:

Skip reason: documentation-only - Milestone delegates to @agent-technical-writer (mode: post-implementation) as specified in milestone requirements.

## Milestone Dependencies

```
M1 (Store State) ───────┐
                       │
M2 (CSS Classes) ───────┼──> M3 (Click Handlers) ──> M5 (ESC/Outside Click)
                       │         │
M4 (Group Drag) ────────┘         │
                                 │
M6 (Documentation) <──────────────┘
```

**Parallelization Strategy**:
- M1, M2, M4 can execute in parallel (state, CSS, drag are independent)
- M3 depends on M1 (needs toggleSelection action)
- M5 depends on M1 (needs clearSelection action)
- M6 depends on all code milestones (documentation after implementation)
