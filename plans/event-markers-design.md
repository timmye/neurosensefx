# Event Markers — Design Document

## Overview

Traders enter custom events (past or future) that display as vertical line markers at specific timestamps on charts. Events can be **global** (all charts) or **pair-specific** (one symbol). Hovering shows event detail (title, description, type, timestamp).

## User Behaviour

### Flows

| Action | Behaviour |
|--------|-----------|
| Add global event | Modal form → persist with `symbol = NULL` → vertical line appears on every open chart immediately |
| Add pair-specific event | Modal form with symbol auto-filled from active chart → persist with `symbol = 'EURUSD'` → only charts showing that symbol render it |
| Add event at candle | Click candle → context menu "Add Event Here" → modal form with timestamp pre-filled from clicked candle |
| Hover marker | `onMouseEnter` on overlay → DOM tooltip with title, description, type, scope (global/symbol), formatted timestamp |
| Edit event | Right-click marker → context menu "Edit Event" → modal form pre-populated → update persists, all charts re-render |
| Delete event | Right-click → "Delete Event" → overlay removed from all charts via store reactivity, row deleted from DB |
| Switch symbol | `clearChartState()` removes all overlays → reload → restore drawings → restore event markers for new symbol + globals |
| Open new chart | After mount → init → data load → restore drawings → restore event markers (global + symbol-specific) |
| Navigate to event | Double-click event marker → chart scrolls to event timestamp (for events outside visible range) |
| Manage events | Event list panel accessible from toolbar — search, filter, edit, delete all events |

### Entry Points

- Toolbar button on `ChartDisplay.svelte` (drawing tools row, after drawing tools, before action buttons)
- Right-click context menu on chart canvas ("Add Event Here" option)
- Right-click on existing event marker → Edit / Delete
- Keyboard shortcut (TBD)

### Event Form Specification

**Type:** Modal overlay, matching `WorkspaceModal.svelte` pattern (fixed position, z-index: 10000, escape-stack integration via `keyManager`).

**Fields:**

| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| Title | text input | Yes | — | 1-255 chars |
| Description | textarea | No | — | Max 2000 chars |
| Event Type | select | Yes | 'custom' | From predefined list: custom, economic, news, alert |
| Timestamp | datetime-local input | Yes | Current time | Any valid timestamp |
| Scope | toggle (Global / This Pair) | Yes | This Pair | — |
| Symbol | text (read-only) | — | Active chart symbol | Hidden when scope = Global |
| Color | color picker | No | Auto by event_type | Hex color |

**Timezone display:** Show `$resolvedTimezone` label prominently next to datetime input. Stored as UTC ms.

**Error states:** Server rejection → rollback optimistic update, show error message in modal. Disable inputs during submit (matching `LoginForm.svelte` pattern).

**Loading state:** Submit button shows spinner, all inputs disabled.

## Architecture

### Data Model

New `event_markers` table — **individual rows per event**, not JSONB blob (unlike price_markers/drawings). Structured columns enable filtering by symbol and timestamp range.

> **Deliberate departure from existing pattern:** Existing tables (`price_markers`, `drawings`, `workspaces`) use bulk JSONB upsert per symbol. Event markers use individual-row CRUD because events are cross-chart entities that need filtering by symbol and timestamp range. JSONB would require loading all events for all symbols on startup and GIN indexes for containment queries.

```sql
CREATE TABLE IF NOT EXISTS event_markers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(50),                -- NULL = global
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) DEFAULT 'custom',
    event_timestamp BIGINT NOT NULL,    -- Unix ms, consistent with KLineChart
    color VARCHAR(20),                  -- optional user override
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_event_markers_user_symbol
    ON event_markers(user_id, symbol);
CREATE INDEX idx_event_markers_user_global
    ON event_markers(user_id) WHERE symbol IS NULL;
```

### API Endpoints

Added to `services/tick-backend/persistenceRoutes.js`:

| Method | Path | Purpose | Response |
|--------|------|---------|----------|
| GET | `/api/events` | Load all events for user | `{ events: [...] }` |
| GET | `/api/events?from=:ts&to=:ts` | Range-filtered load (future) | `{ events: [...] }` |
| POST | `/api/events` | Create event | `{ event: {...} }` |
| PUT | `/api/events/:id` | Update event | `{ event: {...} }` |
| DELETE | `/api/events/:id` | Delete event | `{ ok: true }` |

Initial implementation uses `GET /api/events` (load all). Range-filtered variant added when unbounded growth becomes a concern.

### Frontend State

New `src/stores/eventStore.js`:

```
State:    Map<eventId, eventObject>
Actions:  loadAll() / addEvent() / updateEvent() / deleteEvent()
Derived:  getGlobalEvents() / getEventsForSymbol(symbol)
Sync:     Optimistic local update → debounced server sync
```

> **New store pattern (not a copy of existing):** `workspace.js` uses a writable store with action methods. `priceMarkerPersistence.js` is pure functions, not a store. `eventStore.js` introduces derived stores + optimistic sync with rollback — a new pattern justified by cross-chart coordination needs.

**Initialization:** Triggered from `workspace.js:persistence.loadFromStorage()` (same flow as workspace load), NOT from `authStore.login()`. The `login()` function does not trigger workspace or drawing loads — those happen via the persistence init path.

### Chart Rendering

New overlay registration in `src/lib/chart/overlaysEventMarkers.js`:

```javascript
registerOverlay({
  name: 'eventMarker',
  totalStep: 1,                       // programmatic only, no click-to-create
  needDefaultPointFigure: false,       // no diamond handle at point
  lock: true,                          // prevent user dragging
  styles: {
    line: { style: 'dashed' }          // distinguish from grid lines
  },
  createPointFigures: ({ overlay, coordinates, bounding }) => {
    // Vertical line spanning full chart height using KLineChart coordinates
    const x = coordinates[0].x;
    return [{
      type: 'line',
      attrs: {
        coordinates: [
          { x, y: 0 },
          { x, y: bounding.height }
        ]
      },
      styles: {
        style: 'dashed',
        color: overlay.extendData?.color || '#48752c',
        dashValue: [6, 3]               // distinct from grid dash pattern [2, 2]
      }
    }];
  },
  createXAxisFigures: ({ coordinates, bounding, overlay }) => {
    // Colored label pill in x-axis pane
    return [{
      type: 'text',
      attrs: {
        x: coordinates[0].x,
        y: bounding.height / 2,
        text: truncateTitle(overlay.extendData?.title || ''),
        align: 'center',
        baseline: 'middle'
      },
      styles: {
        color: '#FFFFFF',
        backgroundColor: overlay.extendData?.color || '#48752c',
        borderRadius: 3,
        paddingLeft: 4,
        paddingRight: 4,
        paddingTop: 2,
        paddingBottom: 2
      },
      ignoreEvent: true                 // prevent intercepting mouse events
    }];
  },
  onMouseEnter: ({ overlay, chart }) => { /* show tooltip */ },
  onMouseLeave: ({ overlay, chart }) => { /* hide tooltip */ },
  onRightClick: ({ overlay, chart }) => { /* open context menu */ },
});
```

> **Risk: `createXAxisFigures` is untested in this codebase.** This is the first use of this KLineChart API. Verify it exists in klinecharts v9.8.12 before implementation (per project convention in MEMORY.md). If it doesn't work as expected, fallback to DOM-based labels positioned absolutely below the chart canvas.

> **Visual distinction from `simpleAnnotation`:** Annotations are short vertical lines (50px) with arrow heads, drawn from a click point upward. Event markers are full-height dashed lines with x-axis pill labels. Different dash pattern `[6, 3]` vs grid `[2, 2]`. Different color palette (event colors vs annotation green `#48752c`).

### Tooltip Design

**Mounting:** DOM element attached to the `chart-window` div (parent of `chart-canvas-container`), NOT inside `chart-canvas-container` which has `overflow: hidden`. Use `position: absolute` relative to `chart-window`, computed from the overlay's chart-relative x coordinate.

**Z-index:** 20-50 — above chart canvas and toolbar (15), below context menu (1000).

**Crosshair coexistence:** KLineChart's crosshair shows OHLC data at cursor. Event tooltip appears at a fixed offset from the marker (not cursor-following) to avoid occlusion. Both can display simultaneously.

**Content:** Title (bold), description (truncated), event type badge, formatted timestamp, scope indicator (Global / EURUSD).

**Lifecycle:** One tooltip DOM element per `ChartDisplay`, reused across events. Created on chart mount, hidden by default, shown/hidden via `onMouseEnter`/`onMouseLeave`.

### Overlay Lifecycle Manager

New `src/lib/chart/eventMarkerManager.js` — factory pattern matching existing convention (`createOverlayRestore`, `createReloadChart`, `createChartDataLoader`):

```javascript
export function createEventMarkerManager(deps) {
  // deps: { get chart() {}, eventStore, overlayMeta, chartSubs }
  const eventToOverlayMap = new Map();  // eventId → overlayId (OWN tracking, not in overlayMeta)

  return {
    restoreEventMarkers(symbol) { ... },
    onVisibleRangeChange(from, to) { ... },
    onEventStoreChange(eventId, changeType) { ... },
    dispose() { ... }
  };
}
```

**Own tracking:** `eventToOverlayMap` is a private Map inside the manager, NOT stored in `overlayMeta`. This prevents `overlayMeta.clear()` during symbol change from orphaning the mapping.

**Visible range filtering:** Only create overlays for events within `[from - buffer, to + buffer]` where buffer = 20% of visible range. Remove overlays that scroll out of range.

> **CRITICAL: `subscribeVisibleRangeChange` in `chartSubscriptions.js:32-36` is a single-handler slot.** It's already used by progressive history loading in `chartLifecycle.js:42-55`. The manager MUST NOT subscribe independently — it will silently replace the progressive loader.
>
> **Fix:** Compose a single handler in `chartLifecycle.js` that calls both progressive loading AND `eventMarkerManager.onVisibleRangeChange()`.

## Integration Points

### Where event markers hook into existing flows

1. **App init** → `workspace.js:persistence.loadFromStorage()` triggers `eventStore.loadAll()` (same init path as workspace)
2. **Chart mount** → `initChart` → `loadChartData` → `restoreDrawings` callback → **`eventMarkerManager.restoreEventMarkers(symbol)`** (appended to existing callback chain)
3. **Symbol change** → `clearChartState()` removes all overlays → `overlayMeta.clear()` wipes drawing metadata → data reload → drawing restore → event marker restore (manager rebuilds `eventToOverlayMap` from scratch)
4. **Chart dispose** → `eventMarkerManager.dispose()` unsubscribes from store, clears map. KLineChart's `dispose()` removes canvas overlays.
5. **Right-click context menu** → `OverlayContextMenu.svelte` needs new prop: `overlayName` (currently only receives `visible`, `x`, `y`, `isLocked`, `isPinned` — no overlay name). `ChartDisplay.svelte:108-113` must pass the overlay name from `chart.getOverlayById(contextMenu.overlayId)`.

### Cross-chart deletion

When event deleted from chart A, all other charts remove the overlay:

```
eventStore.deleteEvent(id)
  → store update triggers Svelte subscriptions in all ChartDisplays
    → each eventMarkerManager.onEventStoreChange(id, 'delete')
      → chart.removeOverlay(eventToOverlayMap.get(id))
      → eventToOverlayMap.delete(id)
```

Svelte store reactivity provides the coordination. No new cross-chart communication needed.

### Overlay ID tracking

**Do NOT store event marker tracking in `overlayMeta`.** The `overlayMeta` API only exposes `setDbId(overlayId, dbId)` and `setPinned(overlayId, pinned)` — there is no generic `set()` method. And `reloadChart.js:clearChartState()` calls `overlayMeta.clear()` which would wipe event tracking on every symbol change.

Instead, `eventMarkerManager` maintains its own `Map<eventId, overlayId>` independently. This survives `overlayMeta.clear()` and is rebuilt during `restoreEventMarkers()`.

## X-Axis Label Collision

Event marker labels render in the same x-axis pane as calendar tick labels. KLineChart draws overlay x-axis figures on top of axis tick figures — no built-in collision handling.

**Approach: Accept overlap at low density, extend tick generator for collision avoidance.**

The `xAxisTickGenerator.js` already implements `MIN_FLOOR = 30` pixel gap-based deduplication for calendar ticks. Event marker positions can be injected as "reserved" coordinates so nearby calendar ticks are suppressed. This couples the x-axis system to the event store, so it's deferred to a follow-up if visual overlap becomes an issue.

**Multiple events at same timestamp:** Stagger x-axis labels vertically by computing the overlap count at render time. If 5+ events share a timestamp and labels overflow the x-axis pane height, show a single "N events" pill instead.

## Edge Cases

| Case | Behaviour |
|------|-----------|
| Events outside visible range | Not rendered — overlay manager filters by visible range ± buffer |
| Multiple events at same timestamp | Vertical lines overlap; x-axis labels stagger vertically. If >5, show "N events" pill |
| Global event unbounded growth | Initial: load all. Future: range-filtered `GET /api/events?from=&to=` |
| Offline create/delete | **v1: Fire-and-forget debounced sync, matching existing `priceMarkerPersistence.js` pattern. Offline writes are lost if server unreachable — accepted tradeoff for v1.** A pending queue with replay is deferred to v2. |
| Timezone handling | Timestamps stored as UTC ms. Form uses `$resolvedTimezone` from `timezoneStore.js`. Timezone label shown next to datetime input |
| Symbol change before events loaded | Event restore is async — chart renders without events until load completes, then overlays are created |
| `chart.createOverlay()` returns null | Event timestamp is outside loaded data range — overlay silently skipped. When data loads for that range, visible range change triggers retry |
| `chart.clearData()` during reload | KLineChart removes all bars — overlays lose coordinate mapping. After data loads, `restoreEventMarkers()` re-creates overlays with correct coordinates |
| Workspace export/import | Events included as individual objects in export bundle (not per-symbol arrays) |
| `extendData` payload size | Keep description truncated in `extendData` (max 200 chars). Full description fetched from store on tooltip render, not stored in overlay |

## Files to Create/Modify

### New files

| File | Purpose |
|------|---------|
| `src/lib/chart/overlaysEventMarkers.js` | Overlay registration (registerOverlay) |
| `src/lib/chart/eventMarkerManager.js` | Per-chart overlay lifecycle factory (create/remove/filter by range) |
| `src/stores/eventStore.js` | Event state management + server sync (new pattern: writable + derived + optimistic) |
| `src/components/EventMarkerModal.svelte` | Modal form for add/edit event (matching WorkspaceModal pattern) |
| `src/components/EventMarkerTooltip.svelte` | Hover tooltip DOM element (one per chart display) |
| `docker/postgres/init/03-event-markers.sql` | Table DDL + indexes |

### Modified files

| File | Change |
|------|--------|
| `services/tick-backend/persistenceRoutes.js` | Add event CRUD endpoints (new query pattern — individual rows, not JSONB upsert) |
| `src/lib/chart/chartLifecycle.js` | Compose visibleRange handler (progressive loading + event markers). Add event marker restore after drawing restore in callback chain. |
| `src/lib/chart/reloadChart.js` | Include `eventMarkerManager.restoreEventMarkers(symbol)` in reload chain |
| `src/components/ChartDisplay.svelte` | Import `createEventMarkerManager`, initialize in onMount, pass `deps`. Add tooltip DOM element. Add `overlayName` to context menu invocation. |
| `src/components/OverlayContextMenu.svelte` | Accept `overlayName` prop. Branch menu items: events → Edit/Delete, drawings → Lock/Pin/Delete |
| `src/stores/workspace.js` | Trigger `eventStore.loadAll()` in `persistence.loadFromStorage()` |
| `src/lib/chart/chartSubscriptions.js` | DO NOT add separate subscription — compose in chartLifecycle.js instead |

## Performance

### Budget (requires micro-benchmark before implementation)

| Metric | Target | Risk |
|--------|--------|------|
| Initial event load (API) | < 200ms for 500 events | Low |
| Store memory (500 events) | < 200KB | Low |
| Overlay creation per chart | < 50ms for 50 visible events | Medium |
| Render cycle overhead | < 1ms per frame for 50 overlays | **HIGH — unvalidated** |
| Visible range filter latency | < 5ms on pan/zoom | Medium |

> **Performance risk:** KLineChart iterates ALL overlays every frame (`overlays.forEach`), calling `createPointFigures` + `createXAxisFigures` per overlay. Existing overlays are 0-10 per chart. Adding 50 event markers is a 5-10x increase. The <1ms/frame budget assumes ~0.02ms per overlay callback — must be validated with a micro-benchmark before implementation.
>
> **Fallback if budget exceeded:** Batch all events into a single overlay with multiple points instead of one overlay per event. Or render event lines as a custom KLineChart indicator (indicators render once per frame, not per-instance).

### Pre-implementation benchmark

Create a test chart with 50 overlays using the proposed event marker registration. Measure frame time with `performance.now()` around `createPointFigures` + `createXAxisFigures` during pan/zoom. If >1ms, switch to single-overlay or indicator approach.

## Open Questions

- Recurring events (e.g., "NFP every first Friday") — deferred, adds significant complexity
- Multi-user event sharing — deferred, requires different auth model
- External calendar import (ForexFactory economic calendar) — deferred, API integration
- Color assignment — user-chosen per event, or auto-assigned by event_type?
- `createXAxisFigures` API verification — must confirm it works in klinecharts v9.8.12 before implementation
- Event list panel UI — needed for managing large event collections, deferred to v2
