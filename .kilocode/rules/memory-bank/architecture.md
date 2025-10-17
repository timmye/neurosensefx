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

### 7. Centralized Event Management Pattern
**Purpose**: Efficient event handling for multiple floating elements

**Implementation**:
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
  }
}
```

**Benefits**:
- Single event listener for multiple elements
- Efficient handling of dynamic content
- Consistent event flow across the application

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
│   └── viz/                     # Visualization components
│       └── Container.svelte     # Main visualization container
├── data/                   # Data handling and stores
│   ├── symbolStore.js           # Symbol data management
│   ├── schema.js                # Data validation schemas
│   └── wsClient.js              # WebSocket client
├── lib/                    # Utility libraries
│   ├── d3-utils.js              # D3.js utilities
│   └── viz/                     # Visualization libraries
├── stores/                 # Svelte stores
│   ├── workspaceState.js        # Workspace state management
│   ├── uiState.js               # UI state management
│   ├── canvasRegistry.js        # Canvas tracking
│   └── configStore.js           # Configuration state
├── utils/                  # Utility functions
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

This architecture provides the foundation for NeuroSense FX's high-performance, human-centric financial data visualization system with comprehensive testing infrastructure and unified service management.