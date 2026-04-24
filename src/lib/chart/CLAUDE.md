# src/lib/chart/

KLineChart integration: configuration constants, custom calendar x-axis, drawing persistence, and undo/redo command pattern.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `barCache.js` | IndexedDB bar cache CRUD (Dexie.js) + eviction | Adding cache queries, debugging bar persistence, modifying eviction policy |
| `barMerge.js` | Optimized OHLC bar merge: Map dedup, conditional sort, fast-path findIndex | Debugging bar data integrity, tick merge behavior |
| `cacheFreshness.js` | Staleness check for cached bars (2 bar-period threshold) | Modifying cache freshness logic, debugging stale data issues |
| `calendarBoundaries.js` | Calendar boundary alignment, stepping functions, rank-priority label formatting | Modifying x-axis label formats, adding boundary types |
| `candleMessages.js` | WebSocket candleUpdate/candleHistory handlers, connection ready retry logic | Debugging candle data flow, modifying history merge, WS reconnection behavior |
| `chartAxisFormatter.js` | Tier-adaptive KLineChart formatDate override factory | Modifying date label format per window tier |
| `chartBarSpace.js` | Bar space calculation factory: candle count via binary search, DEV logging | Modifying candle width, debugging bar space issues |
| `chartConfig.js` | Re-export barrel for chartConstants + chartTimeWindows | Adding chart config imports — prefer importing from specific modules |
| `chartConstants.js` | Resolution/window/display constants, TRANSITION_MATRIX, period range limits, cache caps | Adding resolutions, modifying bar spacing, changing fetch limits |
| `chartDataLoader.js` | Chart data loader factory: resets bar store, subscribes bars+ticks, triggers historical load | Debugging data loading pipeline, modifying subscription flow |
| `chartDrawingHandlers.js` | Drawing event handler factory: create/delete/lock/pin/clear + undo/redo integration | Adding drawing interactions, modifying context menu behavior |
| `chartLifecycle.js` | Chart init + lifecycle setup: initChart, resize observer, indicators, actions, interact, wheel | Debugging chart initialization, modifying mount behavior |
| `chartOverlayRestore.js` | Drawing restore factory: merge local+pinned drawings, render with overlayMeta tracking | Debugging drawing persistence, modifying restore behavior |
| `chartRequests.js` | WebSocket request helpers: candle subscribe/unsubscribe/history via ConnectionManager singleton | Debugging WS message flow, modifying candle request format |
| `chartResize.js` | rAF-coalesced resize scheduling | Debugging resize timing, adding resize-triggered logic |
| `chartSubscriptions.js` | Lifecycle-managed KLineChart action subscribe/unsubscribe (zoom, visibleRange, dataReady) | Debugging action handler leaks, adding new action subscriptions |
| `chartThemeLight.js` | Light theme styles for KLineChart (colors, fonts, grid, crosshair) | Changing chart appearance, modifying font metrics |
| `chartThemeDark.js` | Dark theme styles for KLineChart (slate/green-accent palette) | Changing dark mode appearance, modifying dark theme |
| `dateFormatter.js` | Date formatting utilities for chart labels | Modifying date display format |
| `themeColors.js` | Shared theme color constants and lookups | Accessing theme colors programmatically |
| `chartTickSubscriptions.js` | Single-writer reconciliation: createReconcile, mapBarToKline, applyDataToChart | Debugging data-to-chart pipeline, modifying bar/tick reconciliation |
| `chartTimeWindows.js` | Calendar-aligned time range computation, barSpace calculation | Modifying time window logic, changing calendar alignment |
| `dataSearch.js` | Binary search utilities: dataIndexOf, snapToBar | Debugging x-axis coordinate mapping |
| `DeleteDrawingCommand.js` | Delete drawing command with async undo re-persist to IndexedDB | Debugging delete undo behavior |
| `drawingCommands.js` | Command pattern: DrawingCommandStack + CreateDrawingCommand + re-export DeleteDrawingCommand | Adding new command types, modifying undo behavior |
| `drawingStore.js` | Drawing persistence via IndexedDB (Dexie.js) scoped by symbol+resolution, debounced server sync | Adding drawing storage, debugging persistence |
| `fadedStyleDefaults.js` | FADED_LINE/TEXT/POINT/SHAPE constants and getFadedStyles() lookup | Modifying faded overlay styles |
| `overlayMeta.js` | Unified overlay metadata map (dbId + pinned tracking) | Debugging overlay-to-dbId mapping, adding overlay metadata |
| `overlaysAnnotations.js` | simpleAnnotation + simpleTag overlay registrations | Adding annotation overlay types |
| `overlaysChannels.js` | parallelStraightLine + fibonacciLine overlay registrations | Adding channel overlay types |
| `overlaysIndicators.js` | symbolWatermark + AD indicator registrations | Adding indicator types |
| `overlaysPriceLines.js` | horizontalRayLine + rulerPriceLine overlay registrations | Adding price line overlay types |
| `overlaysShapes.js` | rect, circle, polygon, arc, arrow overlay registrations | Adding shape overlay types |
| `quickRulerUtils.js` | Ruler data formatting: pixel-to-data conversion, bar/time/price/range/percent calc | Debugging ruler display, modifying ruler calculations |
| `reloadChart.js` | Shared teardown/reload/restore factory for symbol/source/refresh changes | Debugging symbol/source switching |
| `resolutionMapping.js` | Programmatic inverse of RESOLUTION_TO_PERIOD | Adding resolution mappings |
| `rulerData.js` | Ruler market data computation (recalcRulerData) | Debugging ruler data flow |
| `rulerOverlays.js` | Ruler overlay create/update/remove | Debugging ruler overlay rendering |
| `rulerPosition.js` | Pixel offset + data window style computation | Debugging ruler positioning |
| `styleUtils.js` | Color fade utilities + re-export getFadedStyles | Modifying overlay color fading |
| `xAxisCustom.js` | Re-export barrel for xAxisTickGenerator + calendarBoundaries + dataSearch | Modifying x-axis — prefer importing from specific modules |
| `xAxisTickGenerator.js` | Tick generation pipeline: collect candidates, dedup, emit labeled ticks | Debugging tick density, modifying tick generation |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `__tests__/` | Unit tests for chart modules | Running chart tests, adding test coverage |

## Documentation

| File | What | When to read |
| ---- | ---- | ------------ |
| `BAR_SPACE_RENDERING.md` | How barSpace controls candle width, viewport positioning, and the time window logic chain | Debugging candle rendering, understanding bar spacing |
