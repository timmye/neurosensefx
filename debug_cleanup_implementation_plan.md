# Debug Cleanup Implementation Plan

[Overview]
Remove excessive debug logging from NeuroSense FX codebase while preserving essential connection and error logging to reduce console noise and improve performance.

The codebase currently has 200+ console statements with heavy focus on component resize/move operations. This cleanup will eliminate verbose debugging while maintaining critical visibility into system health and connectivity issues.

[Types]
Console logging categorization for cleanup approach:

Essential (KEEP):
- Connection success/failure logging
- Critical error logging (console.error)
- WebSocket status changes
- Data subscription failures
- Component lifecycle critical errors

Non-essential (REMOVE):
- Drag operation detailed logging
- Resize operation detailed logging  
- Canvas sizing step-by-step logging
- Render pipeline detailed logging
- Component state change logging
- Performance measurement logging

Conditional (KEEP with throttling):
- Significant state changes only
- Error conditions only
- Operation completion only

[Files]
Files requiring debug cleanup with specific changes:

New files to be created:
- None (cleanup only)

Existing files to be modified:
- src/components/FloatingDisplay.svelte - Remove 30+ debug statements, keep 5 essentials
- src/stores/floatingStore.js - Remove 10+ debug statements, keep 3 essentials  
- src/components/ResizeHandle.svelte - Remove 4 debug statements, keep 1 essential
- src/components/viz/Container.svelte - Remove 5 debug statements, keep 2 essentials
- src/components/viz/ContainerDebug.svelte - Keep as-is (dedicated debug component)
- src/components/config/ConnectionManager.svelte - Keep essential connection logging
- src/components/SymbolPalette.svelte - Remove 2 performance debug statements
- src/App.svelte - Keep essential error logging

Files to be deleted:
- None

Configuration file updates:
- None (console behavior is runtime)

[Functions]
Function modifications for debug cleanup:

Modified functions:
- handleDragMove() - Remove detailed drag logging, keep error logging only
- handleResizeMove() - Remove detailed resize logging, keep error logging only  
- render() - Remove detailed pipeline logging, keep error logging only
- updateCanvasSizeUnified() - Remove step-by-step sizing logging
- scaleToCanvas() - Remove configuration logging
- startDrag() - Remove detailed parameter logging
- startResize() - Remove detailed parameter logging

Removed functions:
- None (only console statements removed)

[Classes]
Class modifications for debug cleanup:

Modified classes:
- FloatingDisplay component - Remove debug reactive statements and logging calls
- ResizeHandle component - Remove click debug logging
- Container component - Remove sizing debug logging

Removed classes:
- None

[Dependencies]
Dependency modifications:

No new dependencies required.
Existing debugLogger.js usage:
- Consider migrating essential logging to debugLogger.js for consistency
- Maintain current console.error pattern for critical errors

[Testing]
Testing approach for debug cleanup:

Test file requirements:
- Verify application still functions without debug output
- Confirm error conditions still produce appropriate logging
- Validate connection status logging remains functional

Existing test modifications:
- None required (functional tests should pass)

Validation strategies:
- Manual testing with browser console monitoring
- Verify resize/drag operations work without verbose logging
- Check connection establishment logging still appears
- Confirm error conditions are still visible

[Implementation Order]
Implementation sequence for debug cleanup:

1. Clean FloatingDisplay.svelte - Remove verbose drag/resize/render logging
2. Clean floatingStore.js - Remove global action debug logging  
3. Clean ResizeHandle.svelte - Remove handle click debug logging
4. Clean Container.svelte - Remove canvas sizing debug logging
5. Clean other components - Remove remaining non-essential debug statements
6. Test application functionality - Verify operations work without debug noise
7. Validate essential logging - Confirm connection/error logging remains
8. Final console verification - Ensure clean console output in normal operation
