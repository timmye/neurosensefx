# src/lib/chart/

KLineChart integration: configuration constants, custom calendar x-axis, drawing persistence, and undo/redo command pattern.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `chartConfig.js` | Resolution/window constants, barSpace mappings, TRANSITION_MATRIX (11-window tick level definitions), cTrader period range limits, cache caps | Adding resolutions, modifying bar spacing, changing transition matrix levels, changing fetch limits |
| `xAxisCustom.js` | Custom calendar-aware x-axis via registerXAxis — reads TRANSITION_MATRIX from chartConfig, uses module-state `setAxisWindow()` for window updates, rank-priority MIN_FLOOR collision suppression. Exports: setAxisChart, setAxisWindow, snapToBar, formatBoundaryLabel, generateTicks | Modifying x-axis behavior, adjusting tick density, changing label formats |
| `customOverlays.js` | Interactive drawing overlay registrations (rect, circle, polygon, arc) | Adding new drawing overlay types |
| `chartThemeLight.js` | Light theme styles for KLineChart (colors, fonts, grid, crosshair) | Changing chart appearance, modifying font metrics for x-axis suppression |
| `drawingStore.js` | Drawing persistence via IndexedDB (Dexie.js) scoped by symbol+resolution. Exposed as `window.drawingStore` for E2E test access | Adding drawing storage, debugging persistence, schema migration, writing E2E tests |
| `drawingCommands.js` | Command pattern for undo/redo (DrawingCommandStack, CreateDrawingCommand, DeleteDrawingCommand) | Adding new command types, modifying undo behavior, debugging drawing operations |
| `BAR_SPACE_RENDERING.md` | How barSpace controls candle width, viewport positioning, and the time window logic chain | Debugging candle rendering, understanding bar spacing, modifying viewport behavior |
