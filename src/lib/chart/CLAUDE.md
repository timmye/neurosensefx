# src/lib/chart/

KLineChart integration: configuration constants, drawing persistence, and undo/redo command pattern.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `chartConfig.js` | Resolution/window constants, barSpace mappings, cTrader period range limits, cache caps | Adding resolutions, modifying bar spacing, changing fetch limits |
| `drawingStore.js` | Drawing persistence via IndexedDB (Dexie.js) scoped by symbol+resolution | Adding drawing storage, debugging persistence, schema migration |
| `drawingCommands.js` | Command pattern for undo/redo (DrawingCommandStack, CreateDrawingCommand, DeleteDrawingCommand) | Adding new command types, modifying undo behavior, debugging drawing operations |
