# src/lib/chart/

KLineChart integration: configuration constants, custom calendar x-axis, drawing persistence, and undo/redo command pattern.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `chartConfig.js` | Resolution/window constants, barSpace mappings, tick interval matrix (TICK_INTERVALS, RESOLUTION_FLOOR), cTrader period range limits, cache caps | Adding resolutions, modifying bar spacing, changing tick intervals, changing fetch limits |
| `xAxisCustom.js` | Custom calendar-aware x-axis via registerXAxis — two-pass tick generation with boundary detection, interval selection, and label suppression | Modifying x-axis behavior, adjusting tick density, changing label formats |
| `customOverlays.js` | Interactive drawing overlay registrations (rect, circle, polygon, arc) | Adding new drawing overlay types |
| `chartThemeLight.js` | Light theme styles for KLineChart (colors, fonts, grid, crosshair) | Changing chart appearance, modifying font metrics for x-axis suppression |
| `drawingStore.js` | Drawing persistence via IndexedDB (Dexie.js) scoped by symbol+resolution | Adding drawing storage, debugging persistence, schema migration |
| `drawingCommands.js` | Command pattern for undo/redo (DrawingCommandStack, CreateDrawingCommand, DeleteDrawingCommand) | Adding new command types, modifying undo behavior, debugging drawing operations |
