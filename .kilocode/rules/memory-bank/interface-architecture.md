# NeuroSense FX - Interface Architecture & Functions Map

**Date**: 2025-10-17
**Status**: COMPLETE - Phase 2 Implementation

## System Architecture Overview

```mermaid
graph TB
    subgraph "Frontend (Port 5173)"
        A[App.svelte] --> B[Floating Panels Layer]
        A --> C[Floating Canvases Layer]
        A --> D[Global Context Menu]
        
        B --> E[FloatingSymbolPalette]
        B --> F[FloatingDebugPanel]
        B --> G[FloatingSystemPanel]
        B --> H[FloatingMultiSymbolADR]
        
        C --> I[FloatingCanvas x N]
        I --> J[Container.svelte]
        I --> K[CanvasContextMenu.svelte]
        
        D --> L[6-Tab Interface]
        L --> M[95+ Parameters]
    end
    
    subgraph "State Management"
        N[workspaceState.js]
        O[uiState.js]
        P[canvasRegistry.js]
        Q[configStore.js]
        R[symbolStore.js]
        S[markerStore.js]
    end
    
    subgraph "Backend (Port 8080)"
        T[WebSocketServer.js]
        U[CTraderSession.js]
        V[stream-real.cjs]
    end
    
    subgraph "Data Processing"
        W[dataProcessor.js]
        X[WebSocket Client]
    end
    
    A --> N
    A --> O
    A --> P
    J --> Q
    J --> S
    X --> R
    W --> R
    T --> X
```

## Interface Components Architecture

### 1. Application Root (App.svelte)
**Purpose**: Main application controller and event coordinator
**Key Functions**:
- `addFloatingCanvas()` - Creates new canvas instances
- `handleCanvasContextMenu()` - Manages right-click context menu
- `handleCanvasConfigChange()` - Updates canvas configuration
- `handleCanvasDragStart/Move/End()` - Manages canvas positioning
- `clearWorkspace()` - Resets workspace state

### 2. Floating Panels Layer

#### FloatingSymbolPalette (Position: 20, 20)
**Purpose**: Symbol selection and canvas creation interface
**Key Functions**:
- `handleSymbolSelect()` - Processes symbol selection
- `handleCreateCanvas()` - Creates new canvas for selected symbol
- `handleDragStart/Move/End()` - Panel positioning
- `handleMinimize()` - Panel state management
- `ensurePaletteInViewport()` - Boundary constraint

#### FloatingSystemPanel (Position: 350, 20)
**Purpose**: System controls and data source management
**Key Functions**:
- `handleDataSourceChange()` - Toggles between live/simulated data
- `handleMinimize()` - Panel state management
- `handleDragStart/Move/End()` - Panel positioning
- `ensureSystemInViewport()` - Boundary constraint

#### FloatingDebugPanel (Position: 680, 20)
**Purpose**: Debug information and performance metrics
**Key Functions**:
- `handleMinimize()` - Panel state management
- `handleDragStart/Move/End()` - Panel positioning
- `ensureDebugInViewport()` - Boundary constraint
- State display functions for market profile, price range, current state

#### FloatingMultiSymbolADR (Position: 20, 400)
**Purpose**: Multi-symbol ADR overview visualization
**Key Functions**:
- `handleMinimize()` - Panel state management
- `handleDragStart/Move/End()` - Panel positioning
- `ensureADRInViewport()` - Boundary constraint
- Canvas rendering of multi-symbol ADR data

### 3. Floating Canvases Layer

#### FloatingCanvas (N instances)
**Purpose**: Individual display containers with interactive controls
**Key Functions**:
- `handleRightClick()` - Triggers context menu
- `handleMouseDown()` - Initiates drag operations
- `handleMouseEnter/Leave()` - Hover state management
- `handleClose()` - Canvas removal
- `handleConfigChange()` - Configuration updates

#### Container (Visualization Core)
**Purpose**: Main visualization rendering engine
**Key Functions**:
- `draw()` - Main rendering orchestration
- `handleMouseMove()` - Hover state tracking
- `handleClick()` - Price marker management
- Reactive rendering block - Triggers redraws on data changes

#### CanvasContextMenu (6-Tab Interface)
**Purpose**: Comprehensive parameter control interface
**Key Functions**:
- `handleParameterChange()` - Updates visualization parameters
- `handleSearch()` - Parameter search functionality
- `handleShortcutAction()` - Keyboard navigation
- `switchTab()` - Tab navigation
- `adjustPositionForViewport()` - Boundary constraint

**Tab Structure**:
1. **QuickActionsTab** (12 parameters) - Essential toggles and show/hide controls
2. **PriceDisplayTab** (21 parameters) - Price float and display settings
3. **MarketProfileTab** (20 parameters) - Market profile visualization settings
4. **VolatilityTab** (16 parameters) - Volatility orb and flash settings
5. **LayoutSizingTab** (12 parameters) - Dimensions and positioning
6. **AdvancedTab** (17 parameters) - Power user and experimental features

## State Management Architecture

### 1. workspaceState.js
**Purpose**: Global workspace management and canvas tracking
**Key Functions**:
- `addCanvas()` - Adds new canvas to workspace
- `removeCanvas()` - Removes canvas from workspace
- `updateCanvas()` - Updates canvas properties
- `startDrag()` - Initiates drag operations
- `updateDragPosition()` - Updates position during drag
- `endDrag()` - Completes drag operations
- `toggleGrid()` - Grid display control
- `clearWorkspace()` - Resets workspace

### 2. uiState.js
**Purpose**: UI interaction state and panel visibility
**Key Functions**:
- `setActiveCanvas()` - Sets focused canvas
- `setHoveredCanvas()` - Sets hovered canvas
- `showContextMenu()` - Displays context menu
- `hideContextMenu()` - Hides context menu
- Panel visibility functions for all floating panels
- `hideAllMenus()` - Closes all menus

### 3. canvasRegistry.js
**Purpose**: Canvas metadata and lifecycle management
**Key Functions**:
- `registerCanvas()` - Registers new canvas
- `unregisterCanvas()` - Unregisters canvas
- `markCanvasActive()` - Marks canvas as active
- `bringCanvasToFront()` - Z-index management
- `changeCanvasSymbol()` - Updates canvas symbol
- `getCanvasZIndex()` - Retrieves Z-index

### 4. configStore.js
**Purpose**: Single source of truth for visualization parameters
**Key Functions**:
- `defaultConfig` - 95+ default visualization parameters
- `vizConfig` - Writable store for configuration
- Parameter validation with Zod schemas

### 5. symbolStore.js
**Purpose**: Symbol data management and worker coordination
**Key Functions**:
- `createNewSymbol()` - Creates new symbol with worker
- `dispatchTick()` - Sends tick data to worker
- `updateConfig()` - Updates symbol configuration
- `resetConfig()` - Resets to default configuration
- `removeSymbol()` - Removes symbol and terminates worker

### 6. markerStore.js
**Purpose**: Price marker management
**Key Functions**:
- `add()` - Adds new price marker
- `remove()` - Removes price marker
- Store subscription management

## Data Flow Architecture

### 1. Real-time Data Flow
```
cTrader API → Backend Server → WebSocket → wsClient → symbolStore → dataProcessor → Container → Canvas
```

### 2. Configuration Flow
```
CanvasContextMenu → configStore → symbolStore → dataProcessor → Container → Canvas
```

### 3. User Interaction Flow
```
User Input → Event Handlers → State Updates → Reactive Rendering → Visual Updates
```

## Event Management Architecture

### 1. WorkspaceEventManager
**Purpose**: Centralized event delegation for workspace interactions
**Key Functions**:
- `handleRightClick()` - Context menu triggers
- `handleMouseDown()` - Drag initiation
- `handleMouseMove()` - Drag operations
- `handleMouseUp()` - Drag completion
- `handleKeyDown()` - Keyboard shortcuts
- `handleClickOutside()` - Menu closure

### 2. Component Event Dispatching
**Purpose**: Inter-component communication
**Pattern**: Dispatch → Handle → Update State → Reactive Render

## Data Processing Architecture

### 1. dataProcessor.js (Web Worker)
**Purpose**: Heavy computation off main thread
**Key Functions**:
- `initialize()` - Initializes worker with symbol data
- `processTick()` - Processes incoming tick data
- `updateConfig()` - Updates configuration
- `runCalculationsAndPostUpdate()` - Orchestrates calculations
- `updateVolatility()` - Calculates volatility metrics
- `generateMarketProfile()` - Creates market profile data
- `recalculateVisualRange()` - Calculates visual range
- `postStateUpdate()` - Sends updates to main thread

### 2. wsClient.js
**Purpose**: WebSocket communication and data source management
**Key Functions**:
- `connect()` - Establishes WebSocket connection
- `disconnect()` - Closes WebSocket connection
- `handleSocketMessage()` - Processes incoming messages
- `subscribe()` - Subscribes to symbol data
- `unsubscribe()` - Unsubscribes from symbol data
- `startSimulation()` - Starts simulated data generation
- `stopSimulation()` - Stops simulated data generation

## Visualization Rendering Architecture

### 1. Drawing Order (Container.svelte)
```
1. Background Fill
2. Market Profile
3. Day Range Meter
4. Volatility Orb
5. Price Float
6. Price Display
7. Volatility Metric
8. Price Markers
9. Hover Indicator
10. Flash Overlay
```

### 2. Reactive Rendering Pattern
```javascript
$: if (ctx && state && config && $hoverState !== undefined && $markerStore !== undefined) {
  markers = $markerStore;
  draw(state, config, markers);
}
```

## Performance Optimization Architecture

### 1. Render-on-Update Pattern
- Renders only when data, config, or interaction state changes
- No continuous animation frame loop
- Immediate response to state changes

### 2. Web Worker Architecture
- Heavy computation off main thread
- Message passing for data updates
- Efficient data processing pipelines

### 3. Memory Management
- Proper cleanup of store subscriptions
- Worker termination on symbol removal
- Efficient data structures for 20+ displays

## User Interaction Workflows

### 1. Canvas Creation Workflow
```
1. User opens FloatingSymbolPalette
2. User selects symbol from FXSymbolSelector
3. User clicks "Create Canvas"
4. FloatingSymbolPalette calls handleCreateCanvas()
5. App.svelte creates canvas data
6. Canvas registered in canvasRegistry
7. Canvas added to workspaceState
8. FloatingCanvas component rendered
9. Container component initializes visualization
```

### 2. Canvas Configuration Workflow
```
1. User right-clicks on canvas
2. FloatingCanvas triggers handleRightClick()
3. App.svelte shows CanvasContextMenu
4. User navigates 6 tabs
5. User adjusts 95+ parameters
6. CanvasContextMenu updates configStore
7. symbolStore updates worker
8. Container reactive rendering updates
```

### 3. Workspace Management Workflow
```
1. User drags canvas
2. WorkspaceEventManager handles drag events
3. workspaceState updates canvas position
4. Canvas reactive rendering updates position
5. canvasRegistry updates z-index
```

## Testing Infrastructure Architecture

### 1. Baseline Test Suite (6 tests, 9.7s)
- Application Load Test
- Layout Elements Test
- Empty State Test
- Floating Panels Test
- Console Errors Test
- Enhanced Context Menu Test

### 2. Component-Specific Tests
- Individual component validation
- Integration testing
- Visual regression testing

## Service Management Architecture

### 1. Unified Service Interface (run.sh)
```bash
./run.sh start         # Start all services
./run.sh stop          # Stop all services
./run.sh status        # Check service health
./run.sh logs          # View service logs
./run.sh cleanup       # Clean up old processes
```

### 2. Two-Server Pattern
- Frontend Server (Vite, Port 5173)
- Backend WebSocket Server (Node.js, Port 8080)

## Optimization Recommendations

### 1. Code Cleanup (Priority: High)
- Remove debug logs or implement conditional logging
- Clean up console.log statements in production

### 2. Extract Common Functionality (Priority: Medium)
- Create composables for drag handling
- Unify position persistence patterns
- Extract viewport boundary checks

### 3. Improve Memory Management (Priority: Medium)
- Ensure proper store subscription cleanup
- Optimize Web Worker communication

### 4. Optimize Event Handling (Priority: Low)
- Consolidate global event listeners
- Implement debouncing for frequent events

## Conclusion

The NeuroSense FX floating canvas implementation demonstrates excellent architectural design with a clean, modern codebase. The comprehensive interface architecture provides a solid foundation for the professional trading interface, with efficient data flow, comprehensive user interaction handling, and optimized performance for 20+ simultaneous displays.

This architecture documentation serves as the definitive reference for understanding the complete interface structure and function mappings within the NeuroSense FX system.