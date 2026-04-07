# Design Decision Record: Multi-Select Drawings (Shift-Click)

**Date:** 2026-04-06
**Status:** Design Complete - Pending Implementation
**Author:** Product/UX Analysis
**Scope:** Chart drawing selection, context menu, batch operations (ChartDisplay, OverlayContextMenu, drawingCommands)
**Depends on:** None (independent of cross-TF pin mode)
**Complements:** Cross-TF pin mode (batch pin/unpin is a multi-select action)

---

## 1. Problem Statement

Currently, only one drawing can be selected at a time (`selectedOverlayId` scalar in `ChartDisplay.svelte`). Traders working with many drawings need to delete, lock, or pin multiple drawings one at a time, which is tedious. Multi-select via shift-click enables batch operations on multiple drawings simultaneously.

### Current System State

- `selectedOverlayId` (scalar) holds one overlay ID or null
- `onSelected` callback sets it, `onDeselected` clears it
- Right-click context menu operates on a single overlay via `contextMenu.overlayId`
- KLineChart has **no built-in multi-select** -- only one overlay selected at a time internally
- Delete key deletes the single selected overlay
- Lock/unlock toggles per-overlay via `chart.overrideOverlay({ id, lock })`
- Undo/redo uses a `DrawingCommandStack` with per-command granularity

### KLineChart Constraints

KLineChart v9.x provides overlay interaction callbacks (`onSelected`, `onDeselected`, `onRightClick`, `onClick`, `onPressedMoveStart/Moving/End`). The library manages its own internal single-selection state -- when one overlay is selected, clicking another deselects the first. There is no built-in multi-select.

---

## 2. Selection Model

### 2.1 State

Replace the scalar `selectedOverlayId` with a `Set`:

```javascript
let selectedOverlayIds = new Set();        // all selected overlay IDs
let shiftHeld = false;                     // shift key state
let originalOverlayStyles = new Map();     // overlayId -> pre-selection styles (for restoration)
```

### 2.2 Shift Key Tracking

KLineChart overlay callbacks (`onSelected`, `onRightClick`) receive an `OverlayEvent` that does **not** include the native DOM `MouseEvent`. Shift-key state must be tracked independently:

```javascript
// In ChartDisplay.svelte onMount
const chartContainer = /* chart DOM element */;
chartContainer.addEventListener('mousedown', (e) => {
  shiftHeld = e.shiftKey;
});
```

This works because DOM `mousedown` fires synchronously before KLineChart's internal click handler.

### 2.3 Selection Rules

| User Action | Selection Result |
|---|---|
| Click overlay (no modifier) | Clear all, select only this overlay |
| Shift+click unselected overlay | Add to selection |
| Shift+click already-selected overlay | Remove from selection (toggle) |
| Click empty chart area | Clear all selection |
| Escape key | Clear all selection |
| Ctrl+A | Select all overlays on current timeframe |
| Delete/Backspace (with selection) | Delete all selected overlays |

No hard limit on selection count. Trading charts rarely have more than 20-30 drawings per timeframe.

---

## 3. Visual Indicators

Since KLineChart only supports one internally "selected" overlay (showing control points), multi-selected overlays get a **custom style override**:

```javascript
function applyMultiSelectVisual(overlayId) {
  const overlay = chart.getOverlayById(overlayId);
  if (!overlay) return;
  originalOverlayStyles.set(overlayId, overlay.styles);
  chart.overrideOverlay({
    id: overlayId,
    styles: {
      ...overlay.styles,
      line: { ...overlay.styles?.line, style: 'dashed', dashedValue: [4, 4] },
    },
  });
}

function removeMultiSelectVisual(overlayId) {
  const original = originalOverlayStyles.get(overlayId);
  if (original) {
    chart.overrideOverlay({ id: overlayId, styles: original });
    originalOverlayStyles.delete(overlayId);
  }
}

function clearMultiSelectVisuals() {
  for (const id of selectedOverlayIds) {
    removeMultiSelectVisual(id);
  }
  originalOverlayStyles.clear();
}
```

| State | Appearance |
|---|---|
| Normal | User-chosen or theme default style |
| KLineChart "selected" (single/last-clicked) | Control points visible, native highlight |
| Multi-selected (not KLineChart active) | Dashed line overlay indicator |
| Locked | No control points |
| Pinned + foreign (from cross-TF feature) | 50% faded, locked, TF badge -- not selectable |

The last-shift-clicked overlay gets KLineChart's native selection UI (control points). Other multi-selected overlays get the dashed style. This dual-indicator approach works within KLineChart's single-selection constraint.

---

## 4. Modified Overlay Callbacks

```javascript
function getOverlayCallbacks() {
  return {
    onSelected: (event) => {
      const overlayId = event.overlay.id;
      if (activeDrawingTool) return;  // don't interfere with active drawing gesture

      if (shiftHeld) {
        if (selectedOverlayIds.has(overlayId)) {
          removeMultiSelectVisual(overlayId);
          selectedOverlayIds.delete(overlayId);
        } else {
          selectedOverlayIds.add(overlayId);
          applyMultiSelectVisual(overlayId);
        }
      } else {
        clearMultiSelectVisuals();
        selectedOverlayIds.clear();
        selectedOverlayIds.add(overlayId);
      }
    },

    onDeselected: () => {
      if (!shiftHeld) {
        clearMultiSelectVisuals();
        selectedOverlayIds.clear();
      }
    },

    onRightClick: (event) => {
      const overlayId = event.overlay.id;
      // If right-clicked overlay not in selection, reset to single-select
      if (!selectedOverlayIds.has(overlayId)) {
        clearMultiSelectVisuals();
        selectedOverlayIds.clear();
        selectedOverlayIds.add(overlayId);
      }
      isOverlayLocked = event.overlay.lock;
      contextMenu = {
        visible: true,
        x: event.x,
        y: event.y,
        overlayId,
        selectionCount: selectedOverlayIds.size,
      };
      return true;
    },
  };
}
```

---

## 5. Context Menu

### 5.1 Enhanced OverlayContextMenu

```svelte
<script>
  export let visible = false;
  export let x = 0;
  export let y = 0;
  export let selectionCount = 1;
  export let allLocked = false;
  export let allPinned = false;
</script>

{#if visible}
  <div class="context-menu" style="left: {x}px; top: {y}px">
    <button on:click={handleDelete}>
      {selectionCount > 1 ? `Delete ${selectionCount} drawings` : 'Delete'}
    </button>
    <button on:click={handleToggleLock}>
      {selectionCount > 1
        ? (allLocked ? `Unlock ${selectionCount} drawings` : `Lock ${selectionCount} drawings`)
        : (allLocked ? 'Unlock' : 'Lock')}
    </button>
    <button on:click={handleTogglePin}>
      {selectionCount > 1
        ? (allPinned ? `Unpin ${selectionCount} drawings` : `Pin ${selectionCount} drawings`)
        : (allPinned ? 'Unpin' : 'Pin as Key Level')}
    </button>
  </div>
{/if}
```

### 5.2 Right-Click Logic

- Right-clicked overlay already in selection set -> show multi-select context menu for current selection
- Right-clicked overlay NOT in selection set -> clear selection, select only this one, show single-item menu
- Right-click empty space -> close menu, no selection change

---

## 6. Batch Operations

### 6.1 BatchDeleteCommand (Undo-Supported)

```javascript
export class BatchDeleteDrawingCommand {
  constructor(chart, store, items) {
    // items: Array<{ overlayId, dbId, serializedDrawing }>
    this.chart = chart;
    this.store = store;
    this.items = items;
    this.description = `Delete ${items.length} drawings`;
  }

  execute() {
    for (const item of this.items) {
      this.chart.removeOverlay({ id: item.overlayId });
      if (item.dbId) this.store.remove(item.dbId);
      cleanupSelection(item.overlayId);
    }
  }

  undo() {
    for (const item of this.items) {
      const opts = {
        id: item.serializedDrawing.overlayId,
        name: item.serializedDrawing.overlayType,
        points: item.serializedDrawing.points,
        styles: item.serializedDrawing.styles,
      };
      if (item.serializedDrawing.extendData != null) {
        opts.extendData = item.serializedDrawing.extendData;
      }
      this.chart.createOverlay(opts);
      this.store.save(item.serializedDrawing);
    }
  }
}
```

Undo stack records the batch as a **single atomic unit**. Ctrl+Z restores all deleted drawings at once.

### 6.2 Batch Lock/Unlock

```javascript
function handleBatchToggleLock(targetState) {
  for (const overlayId of selectedOverlayIds) {
    chart.overrideOverlay({ id: overlayId, lock: targetState });
    const dbId = overlayDbIdMap.get(overlayId);
    if (dbId) drawingStore.update(dbId, { locked: targetState });
  }
}
```

No undo command needed for lock state (traders rarely undo a lock toggle).

### 6.3 Batch Pin/Unpin (requires cross-TF pin feature)

```javascript
function handleBatchTogglePin(targetState) {
  for (const overlayId of selectedOverlayIds) {
    const dbId = overlayDbIdMap.get(overlayId);
    if (dbId) drawingStore.update(dbId, { pinned: targetState });
  }
}
```

Pinning takes effect on next TF switch (when `restoreDrawings()` reloads).

---

## 7. Keyboard Shortcuts

| Shortcut | Action | Context |
|---|---|---|
| **Escape** | Clear multi-selection | Chart focused |
| **Delete / Backspace** | Delete all selected overlays | Selection non-empty |
| **Ctrl+A** | Select all overlays on current TF | Chart focused |
| **Shift+Click** | Toggle overlay in/out of selection | Any overlay |
| **Ctrl+Z** | Undo (batch operations via BatchDeleteCommand) | Chart focused |

Ctrl+A uses the existing `overlayDbIdMap` keys to enumerate all current-TF overlays (v9 compatible, no need for KLineChart v10 `getOverlays()` API):

```javascript
if (e.ctrlKey && e.key === 'a') {
  e.preventDefault();
  clearMultiSelectVisuals();
  selectedOverlayIds.clear();
  for (const overlayId of overlayDbIdMap.keys()) {
    selectedOverlayIds.add(overlayId);
    applyMultiSelectVisual(overlayId);
  }
}
```

---

## 8. Edge Cases

| Scenario | Resolution |
|---|---|
| Mixed locked/unlocked in selection | Context menu shows "Lock N drawings" (sets all to locked) |
| Mixed pinned/unpinned in selection | Context menu shows "Pin N drawings" (sets all to pinned) |
| Timeframe switch while multi-selected | `clearMultiSelectVisuals()` + `selectedOverlayIds.clear()` in `handleResolutionChange()` |
| Symbol switch while multi-selected | Same as timeframe switch |
| Active drawing tool + shift-click | `onSelected` returns early if `activeDrawingTool` is set |
| Drawing deleted externally (undo/clear) | `cleanupSelection(overlayId)` removes stale ID from set |
| Foreign pinned drawings (cross-TF feature) | Not selectable (locked=true prevents events). Multi-select only works on current-TF drawings. |

---

## 9. Group Move (Deferred)

Moving multiple selected drawings as a group is the most requested multi-select action but has significant technical barriers:

1. KLineChart's `onPressedMoving` provides coordinates for the dragged overlay only
2. No API to programmatically move other overlays by a delta
3. Would require `overrideOverlay({ id, points })` with recalculated absolute points on every drag frame (60fps * N overlays = high API call rate)
4. Coordinate conversion between pixel (drag) and data (points) is complex

**Recommendation:** Defer to v2. Batch delete/lock/pin provide the highest value with lowest risk.

If implemented later, the approach would be:
- On `onPressedMoveStart` on any multi-selected overlay, record starting points for all selected overlays
- On `onPressedMoving`, compute pixel delta, convert to data-coordinate delta, apply to all other overlays
- On `onPressedMoveEnd`, persist final positions via a `BatchMoveCommand`

---

## 10. Implementation Plan (2-3 days)

| Step | File | Change |
|---|---|---|
| 1 | `ChartDisplay.svelte` | Replace `selectedOverlayId` with `selectedOverlayIds` Set, add shift tracking via mousedown listener, modify `getOverlayCallbacks()` |
| 2 | `src/lib/chart/drawingCommands.js` | Add `BatchDeleteDrawingCommand` |
| 3 | `src/components/OverlayContextMenu.svelte` | Accept `selectionCount`, `allLocked`, `allPinned` props, dynamic labels |
| 4 | `ChartDisplay.svelte` | Add keyboard handlers for Escape, Ctrl+A, batch Delete |
| 5 | `ChartDisplay.svelte` | Add `cleanupSelection()` in resolution/symbol change handlers |

### Files NOT changed

- `drawingStore.js` -- batch operations call existing `remove()` per item
- `customOverlays.js` -- overlay registrations unchanged
- Server-side -- no new endpoints

---

## 11. Competitive Landscape

| Platform | Multi-Select Approach |
|---|---|
| **TradingView** | Ctrl+click multi-select, batch delete |
| **ThinkorSwim** | Shift+click multi-select |
| **MetaTrader 5** | No multi-select |
| **NinjaTrader** | Multi-select via drawing collection panel |
| **Sierra Chart** | No native multi-select |
| **cTrader** | No multi-select |
