# src/components/

Svelte UI components for the workspace and visualization displays.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `Workspace.svelte` | Drag-drop workspace container with persistence | Implementing workspace features, debugging persistence |
| `FloatingDisplay.svelte` | Floating display component with interact.js | Modifying displays, debugging drag/resize |
| `PriceTicker.svelte` | Price ticker display with flash animation and mini Market Profile | Implementing price tickers, customizing flash behavior |
| `FxBasketDisplay.svelte` | FX Basket currency pair visualization | Implementing FX pair display |
| `PriceMarkerManager.svelte` | Price marker UI management | Adding marker features |
| `KeyboardShortcutsHelp.svelte` | Keyboard shortcuts overlay dialog | Adding or modifying keyboard shortcuts |
| `WorkspaceModal.svelte` | Workspace configuration dialog | Modifying workspace settings UI |
| `ChartDisplay.svelte` | KLineChart candlestick display bound to selected ticker, drawing tools, interact.js drag/resize | Adding chart features, debugging chart rendering, drawing persistence |
| `ChartToolbar.svelte` | Resolution, window, and drawing tool selectors for chart | Adding chart controls, modifying toolbar layout |
| `BackgroundShader.svelte` | WebGL procedural background with simplex noise patterns | Modifying background visuals, debugging Three.js shader |
| `Workspace.css` | Workspace component styles | Styling workspace components |
| `README.md` | Component architecture overview | Understanding component architecture, display system design |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `displays/` | Specialized display type components | Adding new display types |
