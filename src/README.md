# Frontend (src/)

NeuroSense FX is a local-first Svelte SPA. The UI is a fixed-viewport "workspace" of draggable, canvas-rendering floating displays fed by a backend WebSocket gateway.

## Auth Gate

`App.svelte` is an auth gate, not an anonymous-mode shell (ref: DL-011). On mount it calls `checkSession()` against `authStore`. While `isLoading` is true it shows a loading state; otherwise it renders either `Workspace` (authenticated) or `LoginForm` (not). There is no anonymous/public mode — every user must register. The cutover is hard, so any feature assuming unauthenticated access is invalid.

## Display Creation Model

Displays are created exclusively via Alt-key shortcuts handled in `lib/workspaceKeyboardShortcuts.js` (extracted from `Workspace.svelte`). There is no menu/toolbar to spawn displays:

- **Alt+A** — cTrader-backed currency display (Day Range Meter + Market Profile)
- **Alt+T** — TradingView-backed display
- **Alt+B** — FX Basket strength display (8 baskets, 28 pairs)
- **Alt+I** — Price Ticker
- **Alt+W** — workspace configuration modal
- **Alt+R** — reinitialize all connections
- **?** / **/** — keyboard shortcuts help overlay

Each Alt shortcut creates one display of a fixed type; the display type is bound to its shortcut, not user-selectable after creation.

## Rendering Dispatch

`lib/visualizers.js` is imported for side effects by `App.svelte` and provides the top-level render dispatch used by `FloatingDisplay`. It wires the Day Range orchestrator, Market Profile orchestrator, and status renderer together. Two entry points: `renderDayRange` (Day Range Meter only) and `renderDayRangeWithMarketProfile` (composite: Market Profile background + Day Range Meter overlay, with a "Waiting for market data…" status fallback).

## Persistence Surfaces

- **Workspace layout** — `stores/workspace.js`: localStorage + server sync, plus headlines widget state and import/export.
- **Display state** — `stores/displayStore.js`: display Map, z-index, selection, chart ghost.
- **Chart theme** — `stores/themeStore.js`: light/dark preference, persisted to `localStorage` under `nsfx-chart-theme`.
- **Chart drawings** — `lib/chart/drawingStore.js`: IndexedDB (Dexie.js), scoped by `symbol+resolution`.

## Dependencies (intentionally minimal)

- Svelte stores as the single source of reactive truth.
- interact.js (drag/drop/resize) loaded via CDN — no npm wrapper.
- Canvas 2D for all non-chart visualization (DPR-aware via `displayCanvasRenderer.js`).
- KLineChart for the candlestick chart window (see `lib/chart/`).
- Dexie.js for IndexedDB-backed caches (bars, drawings).

No lodash, no d3, no three.js. All non-chart rendering is custom Canvas 2D code.

## Development

```bash
# From project root
./run.sh dev          # Vite dev server with HMR (frontend), backend auto-started
./run.sh status       # Check service health
./run.sh stop         # Stop all services
```

Frontend dev requires PostgreSQL 15+ and Redis 7+ running (see `docs/local-dev-setup.md`). E2E tests require a running backend — see `tests/CLAUDE.md`.
