# NeuroSense FX - System Architecture

## High-Level Architecture Overview

### Two-Server Architecture Pattern
NeuroSense FX follows a **Two-Server Architecture** pattern with a **Model-View-Worker (MVW)** pattern extending traditional MVC with Web Workers for performance:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Frontend Server  │◄──►│   Backend Server  │◄──►│   cTrader API    │
│  (Vite/5173)      │    │   (Node/8080)     │    │   (External)     │
│                 │    │                 │    │                 │
│ • Svelte App    │    │ • WebSocket     │    │ • Market Data    │
│ • Pure Floating │    │ • Data Process   │    │ • Price Ticks   │
│ • Dev Tools     │    │ • Client Mgmt    │    │ • Authentication│
│ • Source Maps   │    │ • API Integration│    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                  │
                     ┌─────────────────┐
                     │   Browser Client  │
                     │                 │
                     │ • Canvas Renders │
                     │ • Web Worker     │
                     │ • Real-time UI   │
                     └─────────────────┘
```

## Component Architecture

### Frontend Server Architecture (Port 5173)
```
Frontend Server (Port 5173)
├── App.svelte (Root Application - Simplified)
│   ├── FloatingSymbolPalette.svelte (Symbol selection, visible by default)
│   ├── FloatingDebugPanel.svelte (Debug info, visible by default)
│   ├── FloatingSystemPanel.svelte (System controls, visible by default)
│   ├── FloatingMultiSymbolADR.svelte (ADR overview, visible by default)
│   ├── FloatingCanvas.svelte (Individual display containers)
│   │   ├── CanvasContextMenu.svelte (6 tabs, 95+ parameters)
│   │   │   ├── QuickActionsTab.svelte
│   │   │   ├── PriceDisplayTab.svelte
│   │   │   ├── MarketProfileTab.svelte
│   │   │   ├── VolatilityTab.svelte
│   │   │   ├── LayoutSizingTab.svelte
│   │   │   └── AdvancedTab.svelte
│   │   └── Container.svelte (Visualization rendering)
│   ├── State Management
│   │   ├── workspaceState.js (Canvas management)
│   │   ├── uiState.js (UI state - all panels visible by default)
│   │   ├── canvasRegistry.js (Canvas tracking)
│   │   └── configStore.js (Configuration state)
│   └── Event Management
│       └── WorkspaceEventManager.js (Centralized event handling)
├── Canvas Rendering
│   ├── Reactive rendering on data updates
│   ├── Canvas 2D API drawing
│   └── D3.js visualizations
└── Testing Infrastructure
    ├── Baseline test suite (6 tests, 9.7s)
    ├── Component-specific tests
    ├── Integration tests
    └── Performance validation

Web Worker (Data Processing)
├── dataProcessor.js
├── WebSocket Client
├── Calculation Engine
└── Message Passing
    ├── postMessage to main thread
    └── onmessage from main thread
```

### Backend Server Architecture (Port 8080)
```
Backend Server (Port 8080)
├── server.js (Main server file)
├── WebSocketServer.js (WebSocket handling)
├── CTraderSession.js (cTrader API integration)
└── stream-real.cjs (Real-time data streaming)
```

### Service Management Architecture
```
Service Management (Unified Interface)
├── run.sh (Primary service management script)
│   ├── start (Start all services)
│   ├── stop (Stop all services)
│   ├── status (Check service health)
│   ├── logs (View service logs)
│   └── cleanup (Clean up old processes)
├── Process Management
│   ├── PID files for process tracking
│   ├── Health checks for service monitoring
│   └── Graceful shutdown handling
└── Environment Detection
    ├── Container mode (extended timeouts)
    └── Host mode (standard timeouts)
```

### Testing Architecture
```
Testing Infrastructure
├── Baseline Test Suite
│   ├── e2e/baseline/workflow-tests.spec.ts (6 core tests)
│   ├── scripts/test-baseline.sh (test runner)
│   └── scripts/monitor-baseline.cjs (output monitor)
├── Component Tests
│   └── e2e/add-display-menu/ (component-specific tests)
├── Test Configuration
│   ├── e2e/baseline/config.ts (baseline test config)
│   └── playwright.config.ts (global test config)
└── Test Reports
    ├── JSON reports for programmatic access
    └── HTML reports for detailed analysis
```

## Key Architectural Patterns

### 1. Two-Server Pattern (Frontend/Backend Separation)
**Purpose**: Separate concerns between UI and data processing

**Implementation**:
```javascript
// Frontend Server (Vite)
// vite.config.js
export default defineConfig({
  plugins: [svelte()],
  server: {
    host: true, // Allow external connections
    proxy: {
      '/ws': {
        target: 'ws://127.0.0.1:8080',
        ws: true, // WebSocket proxy
      },
    },
  },
});

// Backend Server (Node.js)
// services/tick-backend/server.js
const port = process.env.WS_PORT || 8080;
const session = new CTraderSession();
const wsServer = new WebSocketServer(port, session);
```

**Benefits**:
- Independent scaling of frontend and backend
- Clear separation of UI and data concerns
- Flexible deployment options for development workflows

### 2. Pure Floating Workspace Pattern
**Purpose**: Provide a modern, flexible interface without traditional grid constraints

**Implementation**:
```javascript
// App.svelte - Pure floating workspace
<main>
  <!-- Floating Panels Layer -->
  <FloatingSymbolPalette />
  <FloatingDebugPanel />
  <FloatingSystemPanel />
  <FloatingMultiSymbolADR />
  
  <!-- Floating Canvases Layer -->
  <div class="floating-canvases-layer">
    {#each Array.from($workspaceState.canvases.values()) as canvas (canvas.id)}
      <FloatingCanvas
        id={canvas.id}
        symbol={canvas.symbol}
        config={canvas.config}
        state={canvas.state}
        position={canvas.position}
        on:contextMenu={handleCanvasContextMenu}
      />
    {/each}
  </div>
</main>
```

**Benefits**:
- Flexible positioning of interface elements
- No constraints from traditional grid layouts
- Professional trading interface experience
- Immediate access to all controls

### 3. Default Visibility Pattern
**Purpose**: Provide immediate functionality without manual configuration

**Implementation**:
```javascript
// uiState.js - All panels visible by default
const initialUIState = {
  floatingSymbolPaletteOpen: true,    // Visible by default
  floatingDebugPanelOpen: true,       // Visible by default
  floatingSystemPanelOpen: true,      // Visible by default
  floatingADRPanelOpen: true,         // Visible by default
  // Strategic default positions
  floatingSymbolPalettePosition: { x: 20, y: 20 },
  floatingDebugPanelPosition: { x: 680, y: 20 },
  floatingSystemPanelPosition: { x: 350, y: 20 },
  floatingADRPanelPosition: { x: 20, y: 400 },
};
```

**Benefits**:
- Zero training required for basic operations
- Immediate functionality on application load
- Professional appearance from first use
- No manual toggling needed

### 4. Canvas-Centric Control Pattern
**Purpose**: Provide comprehensive control access directly from visualization elements

**Implementation**:
```javascript
// FloatingCanvas.svelte - Right-click context menu
function handleRightClick(event) {
  event.preventDefault();
  
  // Mark as active in registry
  registryActions.markCanvasActive(id);
  
  // Dispatch event to show global context menu
  dispatch('contextMenu', {
    canvasId: id,
    position: { x: event.clientX, y: event.clientY }
  });
}

// CanvasContextMenu.svelte - Complete parameter control
<CanvasContextMenu
  position={contextMenuPosition}
  canvasId={contextMenuCanvasId}
  config={contextMenuConfig}
  on:configChange={handleCanvasConfigChange}
  on:configReset={handleCanvasConfigReset}
  on:close={handleContextMenuClose}
/>
```

**Benefits**:
- All 95+ visualization parameters accessible via right-click
- Contextual control access
- No need for separate control panels
- Professional trading workflow

### 5. Unified Service Management Pattern
**Purpose**: Single interface for managing all services

**Implementation**:
```bash
# Unified service management (primary interface)
./run.sh start         # Start all services (recommended)
./run.sh stop          # Stop all services
./run.sh status        # Check service status
./run.sh logs          # View service logs
./run.sh cleanup       # Clean up old processes
```

**Benefits**:
- Consistent service management across environments
- Simplified operational procedures
- Comprehensive health monitoring and logging
- Proper process cleanup and PID management

### 6. Observer Pattern (State Management)
**Purpose**: Reactive updates when data changes

**Implementation**:
```javascript
// Svelte Store Pattern
// src/stores/workspaceState.js
import { writable, derived } from 'svelte/store';

const workspaceState = writable(initialWorkspaceState);
export const activeCanvas = derived(
  workspaceState,
  $workspaceState => {
    if (!$workspaceState.activeCanvas) return null;
    return $workspaceState.canvases.get($workspaceState.activeCanvas);
  }
);
```

**Benefits**:
- Automatic UI updates when data changes
- Decoupled components from data sources
- Efficient reactivity with minimal overhead

### 7. Comprehensive Event Handling Architecture
**Purpose**: Sophisticated event management for floating workspace with centralized delegation, composables, and reactive state management

**Reference**: See [`memory-bank/event-handling-architecture.md`](memory-bank/event-handling-architecture.md) for complete documentation

**Core Components**:

#### WorkspaceEventManager.js - Centralized Event Delegation
```javascript
// src/utils/WorkspaceEventManager.js
export class WorkspaceEventManager {
  constructor(workspaceElement) {
    this.workspace = workspaceElement;
    this.setupEventDelegation();
  }
  
  setupEventDelegation() {
    // Single listener for all canvas interactions
    this.workspace.addEventListener('contextmenu', this.handleRightClick.bind(this));
    this.workspace.addEventListener('mousedown', this.handleMouseDown.bind(this));
    
    // Document-level listeners for drag operations
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    
    // Keyboard shortcuts
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }
}
```

#### InteractWrapper.svelte - Unified Drag with Interact.js
**Purpose**: Standardized drag functionality using interact.js library for all floating panels

**Implementation**:
```javascript
// src/components/shared/InteractWrapper.svelte
import interact from 'interactjs';
import { PositionPersistence } from '../../utils/positionPersistence.js';

// Initialize interact.js
const initializeInteract = () => {
  interactInstance = interact(element);
  
  // Configure draggable
  interactInstance.draggable({
    inertia: inertia ? {
      resistance: 10,
      minSpeed: 200,
      endSpeed: 100
    } : false,
    
    // Event listeners
    onstart: (event) => {
      isDragging = true;
      dispatch('dragStart', { event, position });
    },
    
    onmove: (event) => {
      const boundedPosition = ensureInBounds({ x, y });
      savePosition(boundedPosition);
      dispatch('dragMove', { event, position: boundedPosition });
    },
    
    onend: (event) => {
      isDragging = false;
      dispatch('dragEnd', { event, position: finalPosition });
    }
  });
};
```

#### useDraggable.js - Composable for Custom Drag Implementation
**Purpose**: Custom drag implementation for components not using InteractWrapper

```javascript
// src/composables/useDraggable.js
export function useDraggable(options = {}) {
  // State management
  let position = { ...defaultPosition };
  let isDragging = false;
  let isMinimized = defaultMinimized;
  
  // Event handlers with viewport boundary checking
  const handleDragStart = (event) => {
    isDragging = true;
    // Calculate offset and add global listeners
  };
  
  const handleDragMove = (event) => {
    if (!isDragging) return;
    // Update position with boundary checking
  };
  
  // Return reactive state and handlers
  return {
    position, isDragging, isMinimized,
    handleDragStart, handleMinimize, handleClose
  };
}
```

#### Three-Store Pattern for State Management
- **workspaceState.js**: Canvas management, drag state, active canvas tracking
- **uiState.js**: UI interaction state, context menu visibility, panel visibility
- **canvasRegistry.js**: Canvas metadata, Z-index management, symbol-to-canvas mapping

**Event Flow Architecture**:
1. **Canvas Interactions**: Right-click → context menu, Mousedown → drag operations
2. **Floating Panel Events**: Drag with InteractWrapper/useDraggable, state changes with localStorage persistence
3. **Reactive Rendering**: Svelte reactive statements trigger renders only on state changes

**Benefits**:
- Single event listener for multiple elements through delegation
- Consistent drag behavior across all floating components
- Efficient state management with specialized stores
- Proper cleanup and resource management
- Viewport boundary checking and position persistence
- Keyboard shortcuts for power users
- Performance optimized for 20+ displays

### 8. Environment-Based Debug Logging Pattern
**Purpose**: Provide structured logging that adapts to development and production environments

**Implementation**:
```javascript
// src/utils/debugLogger.js
// Check if we're in development mode
const DEBUG = import.meta.env.DEV;

/**
 * Logs debug messages only in development mode
 */
export function debugLog(tag, message, data = null) {
  if (!DEBUG) return;
  
  if (data) {
    console.log(`🔍 DEBUG: ${tag} ${message}`, data);
  } else {
    console.log(`🔍 DEBUG: ${tag} ${message}`);
  }
}

/**
 * Creates a logger with a predefined tag
 */
export function createLogger(tag) {
  return {
    debug: (message, data) => debugLog(tag, message, data),
    warn: (message, data) => warnLog(tag, message, data),
    error: (message, data) => errorLog(tag, message, data)
  };
}
```

**Benefits**:
- Zero console output in production
- Structured logging with component-specific tags
- Consistent log formatting across the application
- Easy identification of log sources

## Data Flow Architecture

### 1. Real-time Data Flow
```
cTrader API → Backend Server → Frontend Server → Canvas
    ↑           ↓              ↓           ↓
    └─────────────────────────────────────────┘
                    User Interactions
```

### 2. WebSocket Communication Pattern
```javascript
// Frontend to Backend
ws.send(JSON.stringify({
  type: 'SUBSCRIBE',
  symbol: 'EURUSD'
}));

// Backend to Frontend
ws.send(JSON.stringify({
  type: 'TICK_DATA',
  symbol: 'EURUSD',
  price: 1.0845,
  timestamp: Date.now()
}));
```

### 3. Worker Communication Pattern
```javascript
// Main Thread to Worker
worker.postMessage({
  type: 'PROCESS_TICKS',
  data: ticks
});

// Worker to Main Thread
self.postMessage({
  type: 'RENDER_DATA',
  data: processedData
});
```

### 4. State Synchronization Pattern
```javascript
// Store Synchronization
symbolStore.subscribe(symbols => {
  // Update backend with new symbol list
  ws.send(JSON.stringify({
    type: 'UPDATE_SUBSCRIPTIONS',
    symbols: Object.keys(symbols)
  }));
});
```

## State Management Architecture

### Three-Store Pattern
```javascript
// src/stores/workspaceState.js - Global workspace management
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

// src/stores/uiState.js - UI interaction state  
interface UIState {
  activeCanvas: string | null;
  hoveredCanvas: string | null;
  contextMenuOpen: boolean;
  menuPosition: { x: number; y: number };
  floatingSymbolPaletteOpen: boolean;    // Visible by default
  floatingDebugPanelOpen: boolean;       // Visible by default
  floatingSystemPanelOpen: boolean;      // Visible by default
  floatingADRPanelOpen: boolean;         // Visible by default
}

// Canvas data structure
interface CanvasData {
  id: string;
  symbol: string;
  position: { x: number; y: number };
  config: VisualizationConfig;
  state: VisualizationState;
  isActive: boolean;
  isDragging: boolean;
}
```

## Rendering Architecture

### Reactive Rendering Pattern
NeuroSense FX uses a **render-on-update architecture** rather than continuous animation:

```javascript
// From src/components/viz/Container.svelte - Reactive rendering block
$: if (ctx && state && config && $hoverState !== undefined && $markerStore !== undefined) {
  markers = $markerStore; // Update local markers variable
  draw(state, config, markers); // Trigger draw when data changes
}
```

**Key Characteristics**:
- **Event-Driven**: Renders only when data, config, or interaction state changes
- **Svelte Reactivity**: Leverages Svelte's reactive statements (`$:`) for efficient updates
- **Immediate Response**: No animation frame delay - renders immediately on state change
- **Performance Optimized**: No unnecessary rendering when data is static

### Drawing Order (Container.svelte)
```javascript
// Core visualizations (bottom layer)
drawMarketProfile(ctx, currentConfig, currentState, y);
drawDayRangeMeter(ctx, currentConfig, currentState, y);
drawVolatilityOrb(ctx, currentConfig, currentState, visualizationsContentWidth, meterHeight);
drawPriceFloat(ctx, currentConfig, currentState, y);
drawPriceDisplay(ctx, currentConfig, currentState, y, visualizationsContentWidth);
drawVolatilityMetric(ctx, currentConfig, currentState, visualizationsContentWidth, meterHeight);

// Interactive elements (middle layer)
drawPriceMarkers(ctx, currentConfig, currentState, y, markers);

// UI overlays (top layer)
drawHoverIndicator(ctx, currentConfig, currentState, y, $hoverState);
```

## File Structure

### Source Code Organization
```
src/
├── components/              # Svelte components
│   ├── FloatingSymbolPalette.svelte    # Symbol selection and canvas creation
│   ├── FloatingDebugPanel.svelte       # Debug information display
│   ├── FloatingSystemPanel.svelte      # System controls and data source
│   ├── FloatingMultiSymbolADR.svelte   # ADR overview panel
│   ├── FloatingCanvas.svelte           # Individual display containers
│   ├── CanvasContextMenu.svelte        # Right-click context menu
│   │   ├── tabs/                        # Context menu tabs
│   │   │   ├── QuickActionsTab.svelte
│   │   │   ├── PriceDisplayTab.svelte
│   │   │   ├── MarketProfileTab.svelte
│   │   │   ├── VolatilityTab.svelte
│   │   │   ├── LayoutSizingTab.svelte
│   │   │   └── AdvancedTab.svelte
│   │   └── utils/                       # Context menu utilities
│   │       ├── parameterGroups.js
│   │       ├── searchUtils.js
│   │       ├── keyboardShortcuts.js
│   │       └── parameterValidation.js
│   ├── shared/                  # Shared UI components
│   │   ├── InteractWrapper.svelte    # Unified drag functionality with interact.js
│   │   ├── FloatingPanel.svelte      # Base component for floating panels
│   │   ├── InfoGrid.svelte          # Grid-based information display
│   │   ├── StatusDisplay.svelte     # Status indicator component
│   │   └── SectionHeader.svelte     # Section header component
│   ├── FXSymbolSelector.svelte      # Advanced symbol selection with fuzzy search
│   └── viz/                     # Visualization components
│       └── Container.svelte     # Main visualization container
├── data/                   # Data handling and stores
│   ├── ConnectionManager.js        # Centralized data flow management
│   ├── symbolStore.js               # Symbol data management
│   ├── schema.js                    # Data validation schemas
│   ├── fuzzyMatch.js                # Fuzzy search implementation
│   └── wsClient.js                  # WebSocket client
├── constants/              # Application constants
│   └── zIndex.js                    # Z-index hierarchy for floating elements
├── composables/           # Reusable Svelte composables
│   └── useDraggable.js              # Custom drag functionality
├── lib/                    # Utility libraries
│   ├── d3-utils.js              # D3.js utilities
│   └── viz/                     # Visualization libraries
├── stores/                 # Svelte stores
│   ├── workspaceState.js        # Workspace state management
│   ├── uiState.js               # UI state management
│   ├── canvasRegistry.js        # Canvas tracking
│   └── configStore.js           # Configuration state
├── utils/                  # Utility functions
│   ├── debugLogger.js           # Environment-based debug logging
│   ├── positionPersistence.js   # Unified position persistence utilities
│   └── WorkspaceEventManager.js # Event delegation system
└── workers/                # Web Workers
    └── dataProcessor.js         # Data processing worker
```

### Services Organization
```
services/
└── tick-backend/           # Backend Node.js service
    ├── server.js               # Main server file
    ├── WebSocketServer.js      # WebSocket handling
    ├── CTraderSession.js       # cTrader API integration
    └── stream-real.cjs         # Real-time data streaming
```

### Libraries Organization
```
libs/
└── cTrader-Layer/          # Shared TypeScript library
    ├── src/                    # Library source code
    ├── protobuf/               # Protocol buffer definitions
    └── entry/                  # Entry points for different platforms
```

### Testing Organization
```
e2e/
├── baseline/               # Baseline test suite (6 tests)
│   ├── workflow-tests.spec.ts    # Core workflow tests
│   ├── config.ts                 # Test configuration
│   └── fixtures.ts               # Test fixtures
├── add-display-menu/        # Component-specific tests
│   ├── basic-functionality.spec.ts
│   ├── symbol-selection.spec.ts
│   └── integration.spec.ts
└── scripts/               # Test utility scripts
    ├── test-baseline.sh          # Baseline test runner
    └── monitor-baseline.cjs      # Test output monitor
```

### Service Management Organization
```
run.sh                     # Unified service management
├── start                   # Start all services
├── stop                    # Stop all services
├── status                  # Check service health
├── logs                    # View service logs
├── cleanup                 # Clean up old processes
├── start-background        # Start in background (DevContainer)
└── wait-for-services       # Wait for services to be ready
```

## Shared UI Components Architecture

### InfoGrid Component
**Purpose**: Display structured information in a grid layout

**Implementation**:
```javascript
// src/components/shared/InfoGrid.svelte
export let data = [];           // Array of { label, value } objects
export let columns = 2;         // Number of columns (default: 2)
export let fontSize = '11px';   // Font size for text
export let gap = '4px 8px';     // Gap between grid items
```

**Features**:
- Responsive grid layout with configurable columns
- Automatic value formatting for different data types
- Graceful handling of missing or null values
- Customizable styling through CSS variables

### StatusDisplay Component
**Purpose**: Show status indicators with visual feedback

**Implementation**:
```javascript
// src/components/shared/StatusDisplay.svelte
export let status = 'unknown';  // Status value (connected, disconnected, etc.)
export let text = '';           // Optional custom text
export let showIndicator = true; // Show/hide status indicator
export let size = 'medium';     // Size variation (small, medium, large)
```

**Features**:
- Color-coded status indicators (green for connected, red for error, etc.)
- Multiple size variations for different UI contexts
- Default text based on status value
- Configurable visibility of indicator

### SectionHeader Component
**Purpose**: Consistent section headings throughout the application

**Implementation**:
```javascript
// src/components/shared/SectionHeader.svelte
export let title = '';              // Header text
export let level = 4;               // Heading level (h1-h6)
export let showBorder = true;       // Show/hide bottom border
export let uppercase = true;        // Uppercase text
export let letterSpacing = '0.5px';  // Letter spacing
export let fontSize = '11px';       // Font size
export let fontWeight = '600';      // Font weight
```

**Features**:
- Configurable heading levels (h1-h6) with appropriate default styling
- Optional bottom border for visual separation
- Customizable typography properties
- Uppercase option for section headers

## Debug Logging Architecture

### Environment-Based Logging System
**Purpose**: Provide structured debugging that adapts to development and production environments

**Core Functions**:
```javascript
// src/utils/debugLogger.js

// Development-only logging
debugLog(tag, message, data);

// Environment-agnostic warnings
warnLog(tag, message, data);

// Environment-agnostic errors
errorLog(tag, message, data);

// Component-specific logger
const logger = createLogger('ComponentName');
logger.debug('Message', data);
```

**Features**:
- Zero console output in production environment
- Component-specific tagging for easy log filtering
- Structured logging with consistent formatting
- Visual indicators (🔍 for debug, ⚠️ for warnings, ❌ for errors)

## Optimization Recommendations

### Code Quality Improvements (Phase 1 - COMPLETED ✅)
1. **Debug Logging Implementation**
   - Created environment-based debug logging utility
   - Implemented structured logging with component tags
   - Removed debug console.log statements from production code

2. **Shared UI Components**
   - Implemented InfoGrid for consistent data display
   - Created StatusDisplay for status indicators
   - Built SectionHeader for consistent headings
   - Enhanced code maintainability through component reuse

### Performance Enhancements (Phase 2 - RECOMMENDED)
1. **Event Handling Optimization**
   - Extend event delegation patterns for complex interactions
   - Optimize useDraggable composable for better performance
   - Implement enhanced cleanup patterns

2. **Memory Management Improvements**
   - Add memory usage monitoring for development
   - Implement enhanced cleanup for destroyed components
   - Optimize data structures for large workspaces

3. **Rendering Optimization**
   - Implement selective rendering for off-screen canvases
   - Add viewport-based rendering optimizations
   - Optimize frame rate with multiple displays

## Security Architecture

### Data Validation
- **Zod Schemas**: Runtime type validation for all data structures
- **Input Sanitization**: Clean all user inputs
- **API Validation**: Validate all API responses

### Connection Security
- **WebSocket Security**: Secure WebSocket connections
- **API Key Management**: Secure storage of cTrader credentials
- **CORS Configuration**: Proper cross-origin resource sharing setup

## Testing Architecture

### Testing Strategy
```
Testing Infrastructure
├── Baseline Tests (Primary)
│   ├── 6 core workflow tests
│   ├── <30s execution time
│   └── Continuous validation
├── Component Tests
│   └── Individual component validation
├── Integration Tests
│   └── Component interaction validation
└── Performance Tests
    └── 60fps with 20+ displays
```

### Test Types
1. **Baseline Tests**: Core workflow validation (6 tests, <30s)
2. **Component Tests**: Individual component functionality
3. **Integration Tests**: Component interaction validation
4. **Performance Tests**: 60fps validation with multiple displays

### Continuous Testing
```bash
# Primary development workflow
npm run test:baseline              # 6 tests, < 30s

# Enhanced monitoring
npm run test:baseline:monitor     # Detailed output

# Component-specific testing
npm run test:component            # Individual components

# Comprehensive testing
npm run test:full                 # All tests, < 10min
```

## Deployment Architecture

### Development Environment
- **Frontend Server**: Vite development server (port 5173)
- **Backend Server**: Node.js WebSocket server (port 8080)
- **Service Management**: Unified `./run.sh` interface
- **Hot Reload**: Automatic code updates during development
- **Dev Tools**: Browser development tools integration
- **Continuous Testing**: Baseline tests run after each change
- **Health Monitoring**: `./run.sh status` for service health checks

### Production Considerations
- **Frontend**: Static file deployment (any web server)
- **Backend**: Node.js runtime required
- **WebSocket Port**: Configurable (default 8080)
- **Environment Variables**: Configuration via environment
- **Service Management**: Production deployment scripts

This architecture provides the foundation for NeuroSense FX's high-performance, human-centric financial data visualization system with comprehensive testing infrastructure, unified service management, shared UI components, environment-based debug logging, and standardized floating panel implementation using Interact.js.

### Frontend Layering Structure (2025-10-18)

#### Z-Index Hierarchy Standardization
The application implements a standardized z-index hierarchy for consistent layering of floating elements:

```javascript
// src/constants/zIndex.js
export const Z_INDEX_LEVELS = {
  BACKGROUND: 1,              // Workspace container
  FLOATING_BASE: 1000,        // Base for floating panels layer
  SYMBOL_PALETTE: 1001,       // FloatingSymbolPalette
  DEBUG_PANEL: 1002,          // FloatingDebugPanel
  SYSTEM_PANEL: 1003,         // FloatingSystemPanel
  ADR_PANEL: 1004,            // FloatingMultiSymbolADR
  FLOATING_CANVAS_BASE: 2000, // Base for floating canvases
  DRAGGING: 9999,             // Any element being dragged
  CONTEXT_MENU: 10000         // CanvasContextMenu (always on top)
};
```

#### Floating Panel Implementation with Interact.js
All floating panels use the InteractWrapper component for consistent drag behavior:

1. **InteractWrapper.svelte**: Core component providing unified drag functionality
   - Uses interact.js library for robust drag operations
   - Implements viewport boundary checking
   - Provides position persistence via PositionPersistence utilities
   - Handles both mouse and touch events
   - Supports inertia and snap configurations

2. **PositionPersistence.js**: Unified position persistence utilities
   - Provides consistent localStorage-based persistence
   - Handles both position and state persistence
   - Includes methods for clearing and retrieving all saved positions

3. **Z-Index Management**: Standardized z-index hierarchy ensures proper layering
   - Floating panels use z-index values 1001-1004
   - Canvases use z-index values starting at 2000
   - Dragging elements use z-index 9999
   - Context menus always use z-index 10000

#### Connection Management Architecture
The ConnectionManager class provides centralized data flow management:

1. **Canvas Subscription Management**: Tracks which canvases are subscribed to which symbols
2. **Symbol Data Caching**: Caches symbol data to avoid duplicate requests
3. **Connection Monitoring**: Monitors WebSocket status and handles reconnections
4. **Data Source Mode Switching**: Handles switching between live and simulated data

#### Symbol Selection Implementation
The FXSymbolSelector component provides advanced symbol selection:

1. **Fuzzy Search**: Implements fuzzy matching for symbol search
2. **Keyboard Navigation**: Full keyboard support with arrow keys and shortcuts
3. **Visual Feedback**: Highlights matching characters and shows subscription status
4. **Debounced Search**: Implements debounced search for performance
5. **Accessibility**: Full ARIA support for screen readers

This comprehensive frontend architecture provides a solid foundation for the floating workspace interface with consistent behavior, efficient event handling, and professional user experience.