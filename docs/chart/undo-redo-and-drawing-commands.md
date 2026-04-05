# Chart Undo/Redo & Drawing Commands

## Architecture

The undo/redo system uses a **Command pattern** implemented in `src/lib/chart/drawingCommands.js`.

```
DrawingCommandStack (max 50)
  ├── undoStack: Command[]
  └── redoStack: Command[]

Commands:
  ├── CreateDrawingCommand  — creates overlay + persists to DB
  └── DeleteDrawingCommand  — removes overlay + removes from DB (unwired)
```

Each command implements `execute()` and `undo()`. The stack calls `execute()` on push, `undo()` on Ctrl+Z, and re-calls `execute()` on Ctrl+Y.

## Trigger Points

| Trigger | Location | Action |
|---------|----------|--------|
| Undo button | `ChartToolbar.svelte:88` | `commandStack.undo()` |
| Redo button | `ChartToolbar.svelte:94` | `commandStack.redo()` |
| Ctrl+Z | `ChartDisplay.svelte:171` | `commandStack.undo()` (chart focused) |
| Ctrl+Y / Ctrl+Shift+Z | `ChartDisplay.svelte:175` | `commandStack.redo()` (chart focused) |
| Ctrl+Z (workspace) | `Workspace.svelte:127` | No-op — prevents browser default |

Keyboard shortcuts fire on the focused chart element (`tabindex="0"`) before the workspace-level handler, so chart-scoped undo works correctly.

## CreateDrawingCommand

The only command currently wired into the UI.

**Flow:**
1. User selects a drawing tool in `ChartToolbar`
2. KLineChart fires `onDrawEnd` callback
3. `ChartToolbar` dispatches `drawingCreated` event with overlay data
4. `ChartDisplay.handleDrawingCreated()` creates a `CreateDrawingCommand` and pushes it to the stack
5. `command.execute()` is called (no-op — overlay already exists from user drawing)
6. `command.persist()` saves to IndexedDB + debounced server sync

**Undo:** Removes the overlay from the chart and deletes the DB record.
**Redo:** Re-creates the overlay on the chart (does **not** re-persist to DB).

## DeleteDrawingCommand

Fully implemented with undo support but **never instantiated**. No UI path exists to create individual delete commands.

**Execute:** Removes overlay from chart + deletes DB record.
**Undo:** Re-creates overlay from serialized snapshot (including `extendData`).

## Stack Lifecycle

The `commandStack` is per-chart, created fresh on mount in `ChartDisplay.svelte:36`.

**Cleared on:**
- Symbol change (`ChartDisplay.svelte:250`)
- Resolution change (`ChartDisplay.svelte:281`)
- Chart destroy (`ChartDisplay.svelte:531`)
- "Clear" button (`ChartToolbar.svelte:102`)

## Known Issues

### 1. Redo doesn't re-persist to DB
After undo + redo, the overlay is restored visually but the DB record is gone. On chart reload the drawing disappears.

`CreateDrawingCommand.execute()` only calls `chart.createOverlay()` — it does not call `persist()`. The persist call only happens in the initial `handleDrawingCreated` flow.

### 2. Individual delete is unwired
`DeleteDrawingCommand` exists but no UI creates it. Missing interactions:
- Click-to-select a drawing overlay
- Right-click context menu or delete key
- Overlay selection API from KLineChart

### 3. Stack is ephemeral
Navigating away (symbol/resolution change) or component destroy wipes the stack. Undo history does not survive navigation.

### 4. Clear button has no confirmation
"Clear" removes all overlays and wipes undo history with no user confirmation.

### 5. extendData gap (fixed)
Annotation text (`extendData`) was not threaded through the save/restore pipeline. Fixed in commit `2fbb6e3` — now persisted and restored correctly.

## Data Flow: Drawing Creation to Persistence

```
ChartToolbar
  ├── createOverlay({ name, extendData, styles, onDrawEnd })
  │     └── KLineChart renders overlay with text
  └── onDrawEnd → dispatch('drawingCreated', {
        overlayId, overlayType, points, styles, extendData
      })
            │
            ▼
ChartDisplay.handleDrawingCreated()
  ├── new CreateDrawingCommand(chart, store, symbol, resolution,
  │     overlayType, points, styles, extendData)
  ├── commandStack.execute(command)
  └── command.persist()
        ├── drawingStore.save() → IndexedDB
        └── _debouncedServerSync() → PUT /api/drawings/:symbol/:resolution
```

## Data Flow: Reload / Restore

```
ChartDisplay.restoreDrawings()
  ├── drawingStore.load() → server (if auth) or IndexedDB
  └── for each drawing:
        chart.createOverlay({
          id, name, points, styles, extendData
        })
```

---

## KLineChart Overlay Interaction API (v9.8.12)

KLineChart provides 13 overlay event callbacks. The project currently uses only `onDrawEnd`.

### Event Callbacks

| Callback | Trigger | We use it? |
|----------|---------|-----------|
| `onDrawStart` | Drawing gesture starts | No |
| `onDrawing` | During drawing | No |
| `onDrawEnd` | Drawing gesture completes | **Yes** |
| `onClick` | Single click on overlay | No |
| `onDoubleClick` | Double-click on overlay | No |
| `onRightClick` | Right-click on overlay | No |
| `onPressedMoveStart` | Click-drag begins | No |
| `onPressedMoving` | Click-drag in progress | No |
| `onPressedMoveEnd` | Click-drag ends | No |
| `onMouseEnter` | Mouse enters overlay figure | No |
| `onMouseLeave` | Mouse leaves overlay figure | No |
| `onRemoved` | Overlay is removed | No |
| `onSelected` | Overlay becomes selected | No |
| `onDeselected` | Overlay loses selection | No |

All callbacks receive an `OverlayEvent`:
```typescript
interface OverlayEvent {
  overlay: Overlay;       // the overlay instance
  figureKey?: string;     // which figure was hit
  figureIndex?: number;   // figure array index
  x, y, pageX, pageY;    // coordinates
}
```
Returning `true` from a callback prevents default behavior.

### Built-in Overlay Behaviors (no code needed)

- **Click-to-select**: Overlays become selected when clicked, deselected when clicking elsewhere
- **Drag-to-move**: Selected overlays show control points and are draggable; points auto-update
- **Magnet modes**: `normal`, `weak_magnet`, `strong_magnet` — snaps points to OHLC values

### Overlay Query & Modification API

| Method | Description |
|--------|-------------|
| `chart.getOverlayById(id)` | Get overlay instance by ID |
| `chart.overrideOverlay(config)` | Modify overlay properties after creation |
| `chart.removeOverlay(id \| { id, groupId, name })` | Remove by ID, group, or type; no args = remove all |
| `overlay.lock` | `true` disables all interaction on the overlay |

### What Needs Custom Implementation

| Feature | Approach |
|---------|----------|
| Right-click context menu | Use `onRightClick` callback + custom HTML menu positioned at coordinates |
| Delete key to remove | Listen to `keydown` + track selected overlay via `onSelected`/`onDeselected` |
| Double-click to delete | Use `onDoubleClick` callback, call `chart.removeOverlay({ id })` |
| Undo-able delete | Create `DeleteDrawingCommand` — class already exists in `drawingCommands.js` |

### Proposed Interaction Model

The highest-value interactions to wire up, in priority order:

1. **Right-click → Delete** — use `onRightClick` on each overlay, call `DeleteDrawingCommand` (already implemented), push to command stack for undo support
2. **Delete key on selected overlay** — track selected overlay ID via `onSelected`/`onDeselected`, listen for `Delete` keydown, create `DeleteDrawingCommand`
3. **Move/resize** — already works natively, no code needed
4. **Double-click annotation to edit text** — use `onDoubleClick` on `simpleAnnotation` overlays, prompt for new text, call `chart.overrideOverlay()` to update `extendData`
