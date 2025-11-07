# Implementation Plan

Implement workspace canvas floating container grid snapping functionality for NeuroSense FX to enable traders to organize displays efficiently while maintaining high performance with 20+ simultaneous displays.

The implementation leverages interact.js's built-in snapping capabilities to provide organized workspace layouts with minimal performance overhead, focusing on grid snapping as the primary priority while establishing foundation for future collision detection.

The system integrates seamlessly with existing floating architecture using centralized state management through displayStore.js and enhances the current interact.js drag/resize setup in FloatingDisplay.svelte with grid snapping modifiers.

[Types]
Single sentence describing the type system changes.

New grid management system with workspace utilities, enhanced interact.js integration, and visual feedback components for organized floating display positioning.

GridSettings type with boolean enabled flag, numeric gridSize, visual feedback options, and performance optimizations. WorkspaceGrid class providing interact.js snap configuration, coordinate utilities, and state management. Enhanced FloatingDisplay component integrating grid snapping modifiers with existing drag/resize functionality. GridOverlay component for optional visual grid lines display. Configuration schema extending existing workspace storage with grid-specific settings.

[Files]
Single sentence describing file modifications.

Create workspace grid utilities, enhance floating display component, update storage persistence, add grid controls, and implement visual feedback system.

New files to be created:
- `src/utils/workspaceGrid.js` - Centralized grid configuration and interact.js integration utilities
- `src/components/GridOverlay.svelte` - Optional visual grid lines overlay component
- `src/stores/gridStore.js` - Grid-specific state management derived from displayStore
- `src/components/GridControls.svelte` - User interface controls for grid settings

Existing files to be modified:
- `src/components/FloatingDisplay.svelte` - Enhanced interact.js setup with grid snapping modifiers
- `src/utils/workspaceStorage.js` - Extended grid settings persistence and validation
- `src/components/FloatingSystemPanel.svelte` - Added grid controls integration
- `src/stores/displayStore.js` - Enhanced with grid actions and state management
- `src/App.svelte` - Global keyboard shortcuts and grid overlay management

Configuration file updates:
- `src/utils/configDefaults.js` - Added grid settings factory defaults
- No package.json dependencies required - uses existing interact.js

[Functions]
Single sentence describing function modifications.

New grid management functions for interact.js integration, coordinate utilities, and visual feedback control.

New functions:
- `WorkspaceGrid.getInteractSnappers()` - Returns interact.js snap configuration array
- `WorkspaceGrid.snapToGrid(x, y)` - Manual coordinate snapping utility
- `WorkspaceGrid.isOnGridLine(coord)` - Grid line detection for visual feedback
- `WorkspaceGrid.updateSettings(newSettings)` - Dynamic grid configuration updates
- `gridActions.enableGrid()` - Global grid snapping enable action
- `gridActions.disableGrid()` - Global grid snapping disable action
- `gridActions.setGridSize(size)` - Grid size update action
- `gridActions.toggleGridLines()` - Visual grid overlay toggle action
- `GridOverlay.renderGridLines()` - CSS-based grid line rendering
- `applyGridSnapModifier()` - Enhanced interact.js configuration function

Modified functions:
- `FloatingDisplay.onMount()` - Enhanced with grid snapping modifier integration
- `displayActions.moveDisplay()` - Added grid state awareness and snapping feedback
- `displayActions.resizeDisplay()` - Enhanced with grid snapping for resize operations
- `workspaceSettings.loadWorkspaceSettings()` - Extended with grid settings validation
- `workspaceSettings.saveWorkspaceSettings()` - Enhanced with grid settings persistence

[Classes]
Single sentence describing class modifications.

New grid management class and enhanced floating display component with integrated snapping capabilities.

New classes:
- `WorkspaceGrid` - Centralized grid configuration and interact.js integration class with methods for snap target generation, coordinate utilities, and state management

Modified classes:
- Enhanced `FloatingDisplay` component class with grid snapping integration through interact.js modifiers, visual feedback systems, and performance optimizations

[Dependencies]
Single sentence describing dependency modifications.

No new dependencies required - leverages existing interact.js and Svelte store system with enhanced grid utilities.

No new npm packages required. Enhanced usage of existing interact.js library (already in dependencies). Utilizes existing Svelte reactive store system. No additional WebSocket or backend dependencies. Grid overlay uses pure CSS for performance. Performance optimized with existing requestAnimationFrame patterns.

[Testing]
Single sentence describing testing approach.

Comprehensive testing strategy covering grid snapping functionality, integration with existing drag/resize, performance validation with 20+ displays, and user experience verification.

Test files to be created:
- `src/test/workspaceGrid.test.js` - Unit tests for WorkspaceGrid class utilities
- `src/test/gridSnapping.test.js` - Integration tests for interact.js grid snapping
- `src/test/gridControls.test.js` - Component tests for grid controls and settings
- `src/test/performance.test.js` - Performance tests with 20+ display scenarios
- `e2e/gridSnapping.spec.ts` - End-to-end workflow testing for grid functionality

Testing requirements:
- Verify 20px grid snapping accuracy for drag operations
- Test grid disable/enable functionality persistence
- Validate grid size changes (10px, 20px, 40px presets)
- Verify visual grid lines overlay show/hide functionality
- Test keyboard shortcuts (Ctrl+G for toggle)
- Performance testing with 20+ simultaneous displays maintaining 60fps
- Integration testing with existing drag/resize collision behavior
- Workspace persistence testing across browser sessions

[Implementation Order]
Single sentence describing the implementation sequence.

Phased implementation starting with core grid utilities, followed by component integration, user controls, visual feedback, and advanced optimizations.

1. Create workspace grid utility class with interact.js integration and coordinate utilities
2. Enhance FloatingDisplay component with grid snapping modifiers integrated into existing interact.js setup
3. Update workspace storage with complete grid settings persistence and validation
4. Add grid controls interface to system panel for user configuration
5. Implement optional visual grid lines overlay component for user guidance
6. Add keyboard shortcuts and global controls for grid functionality
7. Performance optimization for 20+ display scenarios with throttling and memory management
8. Comprehensive testing and validation with performance benchmarks
