# Implementation Plan

Transform NeuroSense FX from a monolithic control panel interface to a professional canvas-centric system where the canvas itself becomes the primary control interface through incremental migration that preserves system stability while building toward the desired future state.

## Vision Context

**Trader Workflow Foundation**: See [Phase1_CanvasCentric_Interface.md#Trader-Workflows](./docs/Phase1_CanvasCentric_Interface.md#trader-workflows)
**Strategic Approach**: Based on incremental migration analysis in [Phase1_Risk_Analysis.md#Incremental-Approach](./docs/Phase1_Risk_Analysis.md#incremental-approach)

## Architecture Decisions

- **Why Canvas-Centric**: Direct manipulation eliminates context switching and maintains visual focus on market data
- **Why Incremental**: Preserves system stability while building toward long-term vision (7-10 weeks vs 9-13 weeks for break-and-rebuild)
- **Why Right-Click**: Leverages existing hover line for spatial context and provides single entry point for all controls
- **Why Dual Control**: Maintains backward compatibility during migration period with zero breaking changes

## Overview

This implementation plan outlines the transformation of NeuroSense FX from a fixed CSS Grid layout with a monolithic ConfigPanel to a canvas-centric interface where right-click context menus provide direct access to all visualization controls. The approach prioritizes trader workflows by eliminating context switching and maintaining visual focus on market data.

The current system uses a fixed three-column layout (ADR panel, visualization grid, ConfigPanel) with 85+ visualization parameters accessible only through a 600+ line monolithic ConfigPanel component. The proposed system introduces floating canvases with right-click context menus while maintaining backward compatibility during the migration period.

## Types

```typescript
// Canvas data structure for workspace management
interface CanvasData {
  id: string;
  symbol: string;
  position: { x: number; y: number };
  config: VisualizationConfig;
  state: VisualizationState;
  isActive: boolean;
  isDragging: boolean;
}

// Workspace state management
interface WorkspaceState {
  canvases: Map<string, CanvasData>;
  activeCanvas: string | null;
  showGrid: boolean;
  dragState: {
    isDragging: boolean;
    canvasId: string | null;
    offset: { x: number; y: number };
  };
}

// UI interaction state
interface UIState {
  activeCanvas: string | null;
  hoveredCanvas: string | null;
  contextMenuOpen: boolean;
  menuPosition: { x: number; y: number };
}

// Context menu control definitions
interface ControlSection {
  title: string;
  controls: ControlDefinition[];
}

interface ControlDefinition {
  type: 'toggle' | 'color' | 'range' | 'select';
  key: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}
```

## Files

### New Files to Create

- `src/stores/workspaceState.js` - Global workspace management store
- `src/stores/uiState.js` - UI interaction state store  
- `src/stores/canvasRegistry.js` - Canvas tracking and registry system
- `src/components/WorkspaceManager.svelte` - Event coordination and workspace management
- `src/components/FloatingCanvas.svelte` - Individual floating display containers
- `src/components/CanvasContextMenu.svelte` - Right-click context menu with all controls
- `src/components/AddDisplayMenu.svelte` - Canvas creation interface
- `src/components/WorkspaceControls.svelte` - Global workspace actions
- `src/utils/WorkspaceEventManager.js` - Event delegation system
- `src/utils/CanvasRenderManager.js` - Performance optimization for canvas rendering

### Existing Files to Modify

- `src/App.svelte` - Add workspace container alongside existing grid layout, implement dual control system
- `src/components/viz/Container.svelte` - Add right-click event handling for context menu
- `src/stores/configStore.js` - Ensure compatibility with workspace state management
- `src/data/symbolStore.js` - Support multi-canvas symbol management
- `src/components/ConfigPanel.svelte` - Add feature flags for gradual deprecation

### Configuration Updates

- `vite.config.js` - No changes needed
- `package.json` - No additional dependencies required

## Functions

### New Functions

- `WorkspaceEventManager.handleRightClick(event)` - Workspace-level right-click handling
- `WorkspaceEventManager.handleMouseDown(event)` - Drag initiation
- `WorkspaceEventManager.handleMouseMove(event)` - Drag handling
- `WorkspaceEventManager.handleMouseUp(event)` - Drag completion
- `CanvasRenderManager.scheduleRender(canvasId)` - Batch rendering optimization
- `CanvasRenderManager.batchRender()` - Process render queue
- `workspaceState.addCanvas(canvasData)` - Add new canvas to workspace
- `workspaceState.removeCanvas(canvasId)` - Remove canvas from workspace
- `workspaceState.updateCanvas(canvasId, updates)` - Update canvas properties
- `uiState.showContextMenu(position, canvasId)` - Display context menu
- `uiState.hideContextMenu()` - Hide context menu

### Modified Functions

- `App.svelte:onMount()` - Initialize workspace event manager alongside existing functionality
- `Container.svelte` event handlers - Add right-click prevention and context menu triggering
- `configStore.updateConfig()` - Ensure workspace state synchronization
- `symbolStore.subscribe()` - Handle multi-canvas symbol updates

## Classes

### New Classes

- `WorkspaceEventManager` - Centralized event delegation system
  - Methods: `setupEventDelegation()`, `handleRightClick()`, `handleMouseDown()`, `handleMouseMove()`, `handleMouseUp()`
  - Purpose: Single event listener at workspace level for performance
- `CanvasRenderManager` - Performance optimization for canvas rendering
  - Methods: `scheduleRender()`, `batchRender()`, `renderCanvas()`
  - Purpose: Batch canvas updates to maintain 60fps performance

### Modified Classes

- No existing classes require modification - current system is function-based

## Dependencies

### New Dependencies

None required - implementation uses existing Svelte 4.2.7, D3.js 7.9.0, and Web Worker architecture.

### Version Changes

No version changes needed - current technology stack supports all required functionality.

### Integration Requirements

- Leverage existing WebSocket communication for real-time data
- Utilize current Web Worker architecture for off-main-thread processing
- Maintain compatibility with existing cTrader API integration
- Preserve current performance optimization patterns

## Testing

### Test Files to Create

- `src/tests/WorkspaceEventManager.test.js` - Event delegation functionality
- `src/tests/FloatingCanvas.test.js` - Canvas drag and drop behavior
- `src/tests/CanvasContextMenu.test.js` - Context menu interactions
- `src/tests/WorkspaceState.test.js` - State management synchronization

### Existing Test Modifications

No existing test files found - comprehensive test suite to be created.

### Validation Strategies

- Performance testing with 10+ floating canvases targeting 60fps
- Memory usage monitoring to stay under 500MB
- Event handling validation to prevent conflicts
- State synchronization testing between ConfigPanel and context menus
- User workflow validation with actual trading scenarios

## Implementation Order

### Phase 1: Foundation Systems (Weeks 1-3)

1. **Workspace State Management** - Create workspaceState.js, uiState.js, and canvasRegistry.js stores
2. **Event System Foundation** - Implement WorkspaceEventManager class with basic right-click handling
3. **FloatingCanvas Component** - Create draggable canvas component with basic functionality
4. **Basic Context Menu** - Implement CanvasContextMenu with essential controls (Market Profile, Volatility Orb, Price Float)
5. **Dual Control Integration** - Modify App.svelte to support both existing grid and new floating canvases

### Phase 2: Enhanced Canvas Features (Weeks 4-7)

6. **Complete Context Menu** - Add all 85+ visualization parameters to context menu
7. **Add Display Functionality** - Implement AddDisplayMenu for creating new canvases
8. **Workspace Management** - Add workspace controls and global actions
9. **Performance Optimization** - Implement CanvasRenderManager and batch rendering
10. **Visual Polish** - Add animations, transitions, and professional styling

### Phase 3: ConfigPanel Sunset (Weeks 8-10)

11. **Feature Flag Implementation** - Add flags to enable/disable ConfigPanel sections
12. **User Migration** - Implement prompts to guide users to canvas controls
13. **ConfigPanel Deprecation** - Remove redundant controls from ConfigPanel
14. **Performance Optimization** - Optimize for pure canvas-centric workflow
15. **Documentation and Training** - Update user guides and create migration documentation

Each phase delivers complete, valuable functionality while maintaining backward compatibility and system stability.
