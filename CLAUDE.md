# CLAUDE.md - NeuroSense FX Technical Architecture & Design Intent

This document provides comprehensive technical understanding of NeuroSense FX for development work, combining deep architectural details with the foundational design philosophy that drives every technical decision.

## Design Foundation

### Design Principles

**NeuroSense FX** is designed with attention to human factors and display design principles. The technical architecture focuses on creating an effective interface for market data visualization.

**Project Technical Philosophy** "Simple, performant, maintainable" 

#### Technical Design Principles:
- **Responsive Updates**: Fast visual updates for market data changes
- **Visual Encoding**: Color, motion, size, position, shape for information display
- **Progressive Disclosure**: Information layers from glanceable to analytical

### Visual Processing Optimization Architecture

```javascript
// Pre-attentive attribute mapping for instant recognition
const visualAttributes = {
  volatility: { color: 'hue', size: 'radius', motion: 'pulse' },
  pricePosition: { position: 'vertical', color: 'gradient' },
  volume: { opacity: 'alpha', size: 'width' },
  trend: { motion: 'direction', color: 'progression' }
};
```

## Technical Architecture Deep-Dive

### Current System Structure: Monorepo Architecture

**Project Organization (November 2024)**:
```
neurosensefx/                          # Root repository
├── src/                               # Frontend Svelte application
├── services/
│   └── tick-backend/                  # Node.js WebSocket backend
├── libs/
│   └── cTrader-Layer/                 # Fixed cTrader API integration
├── docs/                              # Comprehensive documentation hub
└── run.sh                             # Unified service management (1653 lines)
```

**Evolution Note**: The system evolved from a 3-repository structure (separate frontend, backend, and library repositories) to a unified monorepo for simplified development workflow and coordinated deployment.

### Frontend Architecture: Svelte 4.x + Canvas 2D

#### Component Hierarchy & Responsibilities

**Main Application Container** (`src/App.svelte`):
- Global application state orchestration through displayStore
- WebSocket client connection lifecycle management via wsClient.js
- Environment-aware initialization (development vs production modes)
- Keyboard shortcut handling (Ctrl+K for symbol palette, Ctrl+N for new display)
- Error boundaries and graceful degradation

**Visualization Container** (`src/components/viz/Container.svelte`):
- Canvas rendering orchestrator using requestAnimationFrame
- DPR (device pixel ratio) awareness for crisp text rendering
- Multi-component rendering pipeline (Market Profile, Volatility Orb, Day Range Meter, etc.)
- Mouse interaction handling with frame throttling for performance
- Environment indicator display (DEV/PROD modes)

**Display Components** (`src/components/FloatingDisplay.svelte`):
- Individual trading display instances with drag-and-drop positioning
- **Configuration Inheritance**: New displays automatically inherit current runtime settings
- Display-specific state and configuration management
- User interactions for resizing and positioning
- Collision detection and grid snapping through interact.js

**Configuration Inheritance for New Displays**:
When users create new displays (Ctrl+N or from Symbol Palette), the system now properly inherits the current runtime configuration:

```javascript
// Display creation with automatic configuration inheritance
createNewSymbol: (symbol, data) => {
  // New display inherits current runtime settings (not factory defaults)
  const displayId = displayActions.addDisplay(symbol, {
    x: 100 + Math.random() * 200,
    y: 100 + Math.random() * 100
  });

  // Initialize worker with received data and inherited configuration
  displayActions.initializeWorker(symbol, displayId, data);
}
```

**Data Flow Architecture**:
```javascript
// Current WebSocket client pattern
import { subscribe, unsubscribe } from './data/wsClient.js';

// Market data distribution through Svelte stores
import { displayStore, displayActions } from './stores/displayStore.js';
import symbolService from './services/symbolService.js';
```

#### Rendering Pipeline: Canvas 2D with DPR Awareness

```javascript
// Crisp text rendering implementation
function renderCrispText(ctx, text, x, y, fontSize) {
  const dpr = window.devicePixelRatio;
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x / dpr, y / dpr);
  ctx.restore();
}
```

**Rendering Optimizations**:
- **Dirty Rectangle Rendering**: Only redraw changed regions when possible
- **Layered Canvas**: Separate canvases for different update frequencies
- **Web Worker Integration**: Heavy computation moved to background threads

#### State Management Architecture

**Central Store System** (`src/stores/`):
```javascript
// Simplified display store with global configuration only
export const displayStore = writable({
  displays: new Map(),
  activeDisplays: [],
  defaultConfig: getEssentialDefaultConfig(), // Current runtime configuration
  workspace: { layout: [], preferences: {} }
});
```

**Configuration Management**:
- Global configuration through `displayStore.defaultConfig`
- Schema validation via `visualizationSchema.js`
- Workspace persistence with layout and configuration restoration
- New displays inherit current global settings automatically

### Backend Architecture: Node.js + WebSocket

#### Current Backend Implementation

**WebSocket Server** (`services/tick-backend/WebSocketServer.js`):
- Environment-aware port configuration (dev: 8080, prod: 8081)
- Client subscription management with Map-based tracking
- cTrader session event handling and status broadcasting
- Graceful degradation when cTrader connection fails

**cTrader Integration** (`services/tick-backend/CTraderSession.js`):
- Uses `@reiryoku/ctrader-layer` library (file:libs/cTrader-Layer)
- Real-time tick processing with event-driven architecture
- Connection management with automatic reconnection
- Error handling and graceful degradation capabilities

#### WebSocket Protocol (Enhanced Implementation)
```javascript
// Client → Server messages
{ "type": "get_symbol_data_package", "symbol": "EURUSD", "adrLookbackDays": 14 }
{ "type": "subscribe", "symbols": ["EURUSD", "GBPUSD"] }
{ "type": "unsubscribe", "symbols": ["EURUSD"] }
{ "type": "ping" }

// Server → Client messages
{ "type": "status", "status": "connected|disconnected|error", "availableSymbols": [...], "message": "Error description" }
{ "type": "ready", "availableSymbols": [...] }
{ "type": "symbolDataPackage", "symbol": "EURUSD", "digits": 5, "adr": 0.0023, "initialMarketProfile": [...] }
{ "type": "tick", "symbol": "EURUSD", "bid": 1.0876, "ask": 1.0878, "timestamp": 1678901234567 }
{ "type": "subscribeResponse", "success": true, "symbols": ["EURUSD"] }
{ "type": "pong" }
{ "type": "error", "message": "Error description" }
```

**Enhanced Protocol Features**:
- **Symbol Data Package**: Comprehensive initial data including ADR calculation and market profile initialization
- **ADR Integration**: Advanced daily range calculation with configurable lookback periods
- **Enhanced Error Handling**: Structured error messages with detailed context

#### Backend Service Architecture
```javascript
// Current server.js structure
const WebSocketServer = require('./WebSocketServer');
const { CTraderSession } = require('./CTraderSession');

// Environment-aware port configuration
const port = process.env.WS_PORT || (process.env.NODE_ENV === 'production' ? 8081 : 8080);

const session = new CTraderSession();
const wsServer = new WebSocketServer(port, session);
```

### Three-Layer Floating System Architecture

#### Z-Index Management Strategy
```javascript
// Intelligent z-index allocation
const Z_INDEX_RANGES = {
  DISPLAYS: { min: 1, max: 999 },      // Trading displays
  UI_PANELS: { min: 1000, max: 9999 }, // Configuration panels
  OVERLAYS: { min: 10000, max: 99999 } // Alert overlays
};

// Dynamic z-index management on interaction
function bringToFront(display) {
  const maxZIndex = Math.max(...activeDisplays.map(d => d.zIndex));
  display.zIndex = maxZIndex + 1;
  resortDisplays();
}
```

#### Collision Detection & Grid Snapping
```javascript
// Efficient collision detection using spatial indexing
class SpatialIndex {
  constructor(gridSize = 50) {
    this.gridSize = gridSize;
    this.grid = new Map();
  }

  addDisplay(display) {
    const cells = this.getCellsForDisplay(display);
    cells.forEach(cell => {
      if (!this.grid.has(cell)) this.grid.set(cell, []);
      this.grid.get(cell).push(display);
    });
  }

  checkCollisions(display) {
    const nearbyDisplays = this.getNearbyDisplays(display);
    return nearbyDisplays.filter(d => this.isColliding(display, d));
  }
}
```

## Component System Deep-Dive

### Current Visualization Components (November 2024)

**Available Components in `src/lib/viz/`**:

#### Market Profile (`marketProfile.js`)
- **TPO-based Volume Profiling**: Time Price Opportunity analysis with volume distribution
- **Delta Analysis**: Buy/sell pressure comparison and market flow visualization
- **Implementation**: Canvas-based rendering with cognitive architecture approach

#### Volatility Orb (`volatilityOrb.js`)
- **Gradient-based Visualization**: Radial volatility rendering with smooth transitions
- **Color Modes**: volatility-based and momentum-based color schemes
- **Dynamic Animation**: Real-time volatility updates with configurable radius

#### Day Range Meter (`dayRangeMeter.js`)
- **ADR Integration**: Average Daily Range calculation with graduated markers
- **Price Positioning**: Current price displayed as percentage of daily range
- **Visual Alerts**: Proximity warnings when approaching ADR limits

#### Price Display System
- **Price Float** (`priceFloat.js`): Horizontal price line with glow effects
- **Price Display** (`priceDisplay.js`): Monospaced numeric display with vertical tracking
- **Price Markers** (`priceMarkers.js`): User-placed reference points with Ctrl+Click interaction

#### Supporting Components
- **Volatility Metric** (`volatilityMetric.js`): Numerical volatility indicators
- **Market Pulse** (`marketPulse.js`): Market activity visualization with requestAnimationFrame
- **Multi-Symbol ADR** (`multiSymbolADR.js`): Cross-symbol average daily range analysis

### Component Integration Pattern

**Current Rendering Pipeline** (from Container.svelte):
```javascript
// Rendering order (z-index consideration)
drawVolatilityOrb(ctx, renderingContext, config, currentState, y);      // Background layer
drawMarketProfile(ctx, renderingContext, config, currentState, y);     // Main visualization
drawVolatilityMetric(ctx, renderingContext, config, currentState);     // Metric overlay
drawDayRangeMeter(ctx, renderingContext, config, currentState, y);     // Reference system
drawPriceMarkers(ctx, renderingContext, config, currentState, y, markers); // User annotations
drawPriceFloat(ctx, renderingContext, config, currentState, y);        // Price indicator
drawPriceDisplay(ctx, renderingContext, config, currentState, y);      // Numerical display
```

### Component Configuration System

**Unified Configuration Inheritance Architecture** (November 2024):
The configuration system now implements proper inheritance where new displays automatically inherit current runtime settings instead of stale factory defaults.

**Schema-Driven Parameters** (current implementation):
```javascript
// Configuration examples for current components
const marketProfileConfig = {
  mode: 'traditional',           // Rendering mode selection
  deltaMode: 'none',            // Delta analysis overlay
  colorScheme: 'green-red'      // Visual color palette
};

const volatilityOrbConfig = {
  mode: 'gradient',             // Visualization style
  colorMode: 'volatility',      // Color mapping strategy
  updateSpeed: 300,             // Animation update interval (ms)
  radius: 15                    // Orb size in pixels
};
```

**Configuration Inheritance Flow**:
```javascript
// 1. User modifies global configuration (e.g., changes marketProfile.mode)
displayActions.updateGlobalConfig('marketProfile.mode', 'delta');

// 2. Runtime configuration updates immediately
displayStore.defaultConfig = {
  marketProfile: { mode: 'delta', ...otherSettings },
  ...otherComponents
};

// 3. New displays automatically inherit current runtime settings
addDisplay(symbol, position, config = {}) {
  const display = {
    config: {
      ...currentRuntimeConfig, // Inherit all user modifications
      ...config, // Allow specific overrides
    }
  };
}

// 4. Workspace persistence saves complete runtime state
workspacePersistenceManager.saveCompleteWorkspace(displays, panels, icons, runtimeConfig);
```

**Configuration Management Classes**:

**ConfigDefaultsManager** (`src/utils/configDefaults.js`):
- **Factory Defaults**: Original immutable values from visualizationSchema.js
- **User Defaults**: User-modified parameters that override factory defaults
- **Effective Defaults**: Merged configuration (factory + user overrides)
- **Configuration Validation**: Schema validation and range checking
- **State Persistence**: Import/export for workspace restoration

**WorkspacePersistenceManager** (`src/utils/workspacePersistence.js`):
- **Complete Runtime Config**: Stores full runtime configuration for seamless restoration
- **Workspace Layout**: Display positions, sizes, and arrangement
- **Configuration Inheritance**: Ensures new displays inherit current settings
- **Migration Support**: Handles legacy format upgrades transparently
```

## Configuration System Architecture

### Unified Schema-Driven Configuration

```javascript
// Centralized schema definition
const configurationSchema = {
  marketProfile: {
    parameters: [
      { name: 'mode', type: 'select', options: ['traditional', 'delta', 'volume'] },
      { name: 'deltaMode', type: 'select', options: ['none', 'overlay', 'side-by-side'] },
      { name: 'colorScheme', type: 'select', options: ['green-red', 'blue-yellow'] }
    ]
  },
  volatilityOrb: {
    parameters: [
      { name: 'mode', type: 'select', options: ['gradient', 'segments', 'pulse'] },
      { name: 'colorMode', type: 'select', options: ['volatility', 'momentum', 'custom'] },
      { name: 'updateSpeed', type: 'range', min: 100, max: 1000, step: 100 }
    ]
  }
};

// Auto-generated UI components from schema
function generateParameterControls(groupName, groupConfig) {
  return groupConfig.parameters.map(param => {
    switch (param.type) {
      case 'select':
        return createSelectControl(param);
      case 'range':
        return createRangeControl(param);
      case 'checkbox':
        return createCheckboxControl(param);
      default:
        return null;
    }
  }).filter(Boolean);
}
```

### Real-time Configuration Updates

```javascript
// Reactive configuration system with workspace persistence
export const configStore = writable(defaultConfig);

configStore.subscribe((newConfig) => {
  // Broadcast configuration changes to all displays
  displayStore.update(displays => {
    displays.forEach(display => {
      display.updateConfiguration(newConfig);
    });
    return displays;
  });

  // Persist complete configuration to workspace with runtime defaults
  workspacePersistenceManager.saveGlobalConfig({ parameter: value }, fullRuntimeConfig);
});
```

**Workspace Restoration with Configuration Inheritance**:
The system now properly restores workspaces with complete runtime configuration:

```javascript
// Workspace initialization with proper configuration restoration
async initializeWorkspace() {
  const workspaceData = await workspacePersistenceManager.initializeWorkspace();

  // 🔧 CRITICAL FIX: Update store's defaultConfig with restored runtime defaults
  if (workspaceData.defaults) {
    displayStore.update(store => ({
      ...store,
      defaultConfig: workspaceData.defaults // Restore effective runtime defaults
    }));
  }

  // Restore displays using restored runtime defaults
  workspaceData.layout.displays.forEach(displayData => {
    const display = {
      ...displayData,
      config: {
        ...restoredRuntimeDefaults, // Use restored runtime defaults
        ...displayData.config, // Preserve saved config overrides
        containerSize: displayData.size
      }
    };
  });
}
```

**Configuration Testing & Validation**:
The system includes comprehensive testing functions for configuration inheritance:

```javascript
// Browser console testing for configuration inheritance
window.testConfigInheritance = async () => {
  // 1. Verify current runtime config is applied to new displays
  // 2. Test workspace persistence and restoration
  // 3. Validate factory reset functionality
  // 4. Confirm new displays inherit user modifications
};
```


## Development Workflow & Process

### HMR-Enabled Development Workflow

**NeuroSense FX now supports Hot Module Replacement (HMR) for rapid development**

#### Two Development Modes

**1. Development Mode (`./run.sh dev`) - For Active Coding**
- **Hot Module Replacement**: Changes appear in browser automatically within 1-2 seconds
- **Visible Logs**: Real-time compilation output and error messages in terminal
- **Foreground Process**: Development server runs in attached terminal with full logging
- **Port Configuration**: Frontend on http://localhost:5174, Backend WebSocket on ws://localhost:8080
- **Vite HMR**: WebSocket-based hot reload with error overlay in browser
- **Use When**: Actively coding, debugging, or experimenting with UI changes

**2. Production Mode (`./run.sh start`)** - For Testing & Production
- **Background Services**: Runs detached like production environment
- **Manual Refresh**: Requires manual browser reload for changes to appear
- **Realistic Testing**: Simulates actual user experience with optimized builds
- **Port Configuration**: Frontend on http://localhost:5174, Backend WebSocket on ws://localhost:8081
- **Optimized Builds**: Production-compiled frontend with minified assets
- **Use When**: Production testing, performance validation, demo preparation

**Environment-Aware Configuration**:
- **Development**: Vite dev server (port 5174) + WebSocket proxy to backend (port 8080)
- **Production**: Static file serving (port 5174) + direct WebSocket connection (port 8081)
- **Automatic Detection**: System detects NODE_ENV and configures ports accordingly

#### Development Workflow Best Practices

**Daily Development Cycle:**
```bash
# Start coding session
./run.sh dev
# → Backend starts in background
# → Frontend starts with HMR in foreground
# → Browser opens automatically to localhost:5174
# → Make code changes → Browser updates automatically

# Switch to testing mode
./run.sh restart
# → Both services run in background
# → Manual browser refresh for changes
# → Realistic testing environment
```

**What Gets Hot Reloaded:**
- ✅ **Svelte Components**: Template, script, and style changes update instantly
- ✅ **JavaScript Modules**: Function and variable changes trigger full refresh
- ✅ **CSS Changes**: Style updates apply without full page reload
- ✅ **Configuration Files**: Most config changes update automatically

**What Requires Full Restart:**
- 🔄 **Vite Configuration**: Changes to vite.config.js require server restart
- 🔄 **WebSocket Proxy**: Backend connection changes need restart
- 🔄 **New Dependencies**: Package.json changes require npm install + restart

#### File Watching Performance

**Optimized Watching Configuration:**
```javascript
// vite.config.js - HMR Settings
watch: {
  usePolling: true,        // Reliable file change detection
  interval: 100,           // Check every 100ms for changes
  ignored: ['**/node_modules/**', '**/.git/**', '**/logs/**']
}
```

**HMR WebSocket Configuration:**
- **Protocol**: WebSocket (ws://) for low-latency communication
- **Port**: 5174 (auto-configured to avoid conflicts)
- **Error Overlay**: Browser overlay shows compilation errors instantly

#### Key Benefits

**For Active Development:**
- **70% faster iteration**: No manual restart/reload cycle
- **Instant visual feedback**: See changes immediately in browser
- **Better error visibility**: Compilation errors shown as browser overlay
- **Maintained state**: Component state preserved during hot reloads

**For Testing & Validation:**
- **Realistic behavior**: Production-like background service mode
- **Full refresh testing**: Ensures app works from cold start
- **Performance validation**: Test actual startup times and behavior

### Snapshot Management Workflow

**NeuroSense FX includes git-based snapshot management for creating immutable stable builds**

#### Snapshot Philosophy
The snapshot system follows the project's "Simple, Performant, Maintainable" philosophy:
- **Simple**: Uses existing git infrastructure, no new complexity
- **Performant**: Instant rollback with `git checkout`, zero storage overhead
- **Maintainable**: Git handles all complexity, no additional maintenance

#### Core Commands

**Create Stable Snapshot:**
```bash
# Build and protect current version
npm run build:prod
./run.sh snapshot_save
# Output: ✅ Saved as: stable-20241119-143000
```

**List Available Snapshots:**
```bash
./run.sh snapshot_show
# Output:
# 📋 Available Stable Snapshots:
#   🏷️ stable-20241119-143000
#     Created: 2024-11-19 14:30:00
```

**Deploy Specific Snapshot:**
```bash
./run.sh snapshot_use stable-20241119-143000
./run.sh start
# Deploy stable version for client demo
```

**Return to Development:**
```bash
./run.sh back_to_work
# Returns to main/master branch for continued development
```

#### Workflow Examples

**Client Demo Preparation:**
```bash
# 1. Prepare stable build
npm run build:prod
./run.sh snapshot_save

# 2. Deploy for demo
./run.sh snapshot_use stable-20241119-143000
./run.sh start

# 3. Quick rollback if needed
./run.sh back_to_work
./run.sh start
```

**Development Continuation:**
```bash
# Development can continue immediately
./run.sh back_to_work
./run.sh dev

# Container rebuilds are safe - /dist persists
# No need to rebuild stable version
```

#### Container Rebuild Safety

The DevContainer is configured with `/dist` folder persistence:
- **No Rebuilding Required**: Build artifacts survive container restarts
- **Immediate Development**: Can resume work without rebuilding
- **Stable Versions Protected**: Production snapshots remain available

### Quick Snapshot Workflow

**For stable versions and demos:**
```bash
npm run build:prod
./run.sh snapshot_save      # Creates stable-YYYYMMDD-HHMMSS
./run.sh start              # Deploy stable version
```

**Return to development:**
```bash
./run.sh back_to_work       # Return to main branch
./run.sh dev                # Resume development with HMR
```

**Use snapshots for:** client demos, production deployments
**Use regular dev for:** active coding, experiments

## DevContainer Development Environment

### Container Configuration Analysis

#### `.devcontainer/devcontainer.json`
```json
{
  "name": "NeuroSense FX Development",
  "build": {
    "dockerfile": "Dockerfile",
    "context": ".."
  },
  "features": {
    "ghcr.io/devcontainers/features/node:1": {
      "version": "20"
    }
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "svelte.svelte-vscode",
        "esbenp.prettier-vscode",
        "dbaeumer.vscode-eslint"
      ]
    }
  },
  "postCreateCommand": "npm install && bash setup_mcp.sh"
}
```

#### Development Workflow Integration
```bash
# Service management through unified script
./run.sh dev       # Start development server with HMR (port 5174)
./run.sh start     # Start services in background (port 5174)
./run.sh stop      # Graceful shutdown of all services
./run.sh restart   # Restart services in background mode
./run.sh status    # Health check of all services
./run.sh logs      # Real-time log streaming

# Development commands
npm run dev        # Frontend development server with hot reload
npm run build      # Production build optimization
```

## Implementation Patterns & Best Practices

### Event Handling Architecture (Svelte-First)
**Pattern Documentation**: See `docs/patterns/event-handling-architecture.md` for comprehensive guidelines

**Core Principle**: Use Svelte's declarative event system as the single source of truth for all UI interactions. Only use manual event listeners for specialized cases that Svelte cannot handle.

**Event Modifier Pattern**:
```javascript
// ✅ Correct: Svelte modifiers for UI interactions
<canvas on:contextmenu|preventDefault|stopPropagation={handleCanvasContextMenu}></canvas>

// ❌ Wrong: Manual listeners competing with framework
<script>
onMount(() => {
  canvas.addEventListener('contextmenu', handler); // Don't do this
});
</script>
```

### Canvas Rendering Best Practices

```javascript
// Efficient canvas rendering patterns
class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dirtyRegions = new Set();
  }

  // Dirty rectangle optimization
  markDirty(x, y, width, height) {
    this.dirtyRegions.add({ x, y, width, height });
  }

  renderFrame() {
    if (this.dirtyRegions.size === 0) return;

    // Clear only dirty regions
    this.dirtyRegions.forEach(region => {
      this.ctx.clearRect(region.x, region.y, region.width, region.height);
    });

    // Render only dirty regions
    this.renderDirtyRegions();

    this.dirtyRegions.clear();
  }
}
```

### WebSocket Communication Patterns

```javascript
// Reliable WebSocket communication with reconnection
class ReliableWebSocket {
  constructor(url) {
    this.url = url;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.startHeartbeat();
    };

    this.ws.onclose = () => {
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
    }
  }
}
```

### Error Handling & Recovery

```javascript
// Comprehensive error handling strategy
class ErrorHandler {
  constructor() {
    this.errorCounts = new Map();
    this.maxErrorCount = 5;
  }

  handleError(error, context) {
    const errorKey = `${error.type}-${context}`;
    const count = this.errorCounts.get(errorKey) || 0;

    if (count >= this.maxErrorCount) {
      this.handleCriticalError(error, context);
    } else {
      this.handleRecoverableError(error, context);
      this.errorCounts.set(errorKey, count + 1);
    }
  }

  handleRecoverableError(error, context) {
    console.warn(`Recoverable error in ${context}:`, error);

    switch (error.type) {
      case 'WEBSOCKET_DISCONNECT':
        this.reconnectWebSocket();
        break;
      case 'RENDER_FAILURE':
        this.resetRenderer();
        break;
      case 'DATA_VALIDATION':
        this.skipDataUpdate();
        break;
    }
  }

  handleCriticalError(error, context) {
    console.error(`Critical error in ${context}:`, error);
    this.notifyUser(error);
    this.enterSafeMode();
  }
}
```

## Design Constraints & Requirements

### Critical Design Constraints

#### Display Constraints
- **Display Area**: 220px × 120px per display (resizable with minimum constraints)
- **Update Threshold**: 100ms maximum latency for data-to-visual updates
- **Memory Budget**: 50MB maximum per active display
- **CPU Budget**: 5% maximum CPU per display at 60fps

#### Data Accuracy Constraints
- **Zero Tolerance for Data Errors**: Price and volume data must be 100% accurate
- **Temporal Consistency**: All displays must show synchronized data timestamps
- **Validation Required**: All incoming data must pass validation before rendering
- **Audit Trail**: All data updates must be logged for debugging

#### Accessibility Constraints
- **Keyboard Accessibility**: Primary interaction method must be keyboard-only
- **Screen Reader Support**: All visual information must have text equivalents
- **Color Blindness**: Information must not rely solely on color differentiation
- **High Contrast**: Support for high contrast display modes

### Rendering Approach
The system uses Canvas 2D with DPR (Device Pixel Ratio) awareness for crisp text rendering. RequestAnimationFrame is used for smooth visual updates. The architecture supports multiple concurrent displays through efficient resource management and optimized rendering patterns.

### Scalability Considerations
- **Display Management**: System supports multiple floating displays with collision detection
- **Memory Management**: Object lifecycle management to minimize memory pressure
- **Update Frequency**: Market data updates are processed efficiently through WebSocket connections
- **Resource Allocation**: Dynamic resource management based on active display count

## Historical Context & System Evolution

### Multi-Repository to Monorepo Transition

**Original Architecture (Historical)**:
The system initially existed as three separate repositories:
- `neurosensefx`: Frontend Svelte application
- `ctrader-tick-backend`: Independent Node.js WebSocket backend service
- `cTrader-Layer`: Standalone shared library for cTrader Open API integration

**Transition Catalysts**:
- **Development Workflow Complexity**: Coordinating changes across three repositories
- **Dependency Management**: Version synchronization challenges between repositories
- **Deployment Coordination**: Complex release management requiring cross-repository alignment
- **Development Experience**: Onboarding friction with multiple repository setup

**Current Monorepo Structure (November 2025)**:
```
neurosensefx/                          # Single unified repository
├── src/                               # Frontend application (formerly neurosensefx repo)
├── services/tick-backend/             # Backend service (formerly ctrader-tick-backend repo)
├── libs/cTrader-Layer/                # Shared library (formerly cTrader-Layer repo)
├── docs/                              # Consolidated documentation
└── run.sh                             # Unified service management (1844 lines)
```

**Benefits Achieved**:
- ✅ **Unified Development**: Single repository setup for complete development environment
- ✅ **Coordinated Changes**: Frontend/backend changes in single pull request
- ✅ **Simplified Dependency Management**: Single package.json with cross-references
- ✅ **Streamlined Deployment**: Coordinated version releases
- ✅ **Enhanced Service Management**: Comprehensive `run.sh` script managing all services

**Trade-offs Encountered**:
- ❌ **Repository Size**: Larger single repository (166MB node_modules footprint)
- ❌ **Independent Deployment**: Backend cannot be deployed separately from frontend
- ❌ **Repository Scope**: Mixed concerns within single repository boundaries
- ❌ **Development Overhead**: Full stack required for simple frontend changes

### Technical Architecture Evolution

**WebSocket Protocol Evolution**:
- **Initial**: Direct cTrader Open API implementation in backend
- **Current**: Library-based integration using `@reiryoku/ctrader-layer` (file-based dependency)
- **Protocol**: Simplified message format with focus on reliability and performance

**Service Management Evolution**:
- **Initial**: Separate service startup scripts for frontend and backend
- **HMR Implementation** (November 2025): Added separate development and production environments with Vite HMR
- **Current**: Unified `run.sh` script with environment-aware configuration, backup systems, and health monitoring
- **Complexity**: Script grew to 1844 lines to handle comprehensive service management

**Major Development Improvements**:
- **HMR Development Environment**: Implemented Hot Module Replacement for rapid iteration (November 2025)
- **Event Handling Architecture**: Established Svelte-first patterns for UI interactions (November 2025)
- **Configuration Inheritance**: Streamlined global configuration system (2025)

## Current Technical State & Known Issues

### Production Readiness Assessment

#### Current Implementation Status (~75% Complete)
- ✅ Core rendering engine with Canvas 2D DPR-aware rendering
- ✅ Three-layer floating display system with collision detection
- ✅ Market Profile with 6 rendering modes including delta analysis
- ✅ Volatility Orb with multiple visualization modes
- ✅ Real-time WebSocket data streaming with reconnection logic
- ✅ Unified configuration system with schema validation
- ✅ Workspace persistence and layout management
- ✅ **Canvas Context Menu System**: Fixed browser context menu issues (November 2025)
- ✅ **Svelte-First Event Handling Architecture**: Established unified event patterns
- ✅ Browser zoom awareness and crisp text rendering
- ✅ Environment-aware development/production modes

#### Canvas Context Menu Fix (November 2025)
**Problem**: Canvas elements showed browser default context menu instead of trading-specific controls
**Solution**: Implemented Svelte-first event handling architecture
**Files Modified**:
- `src/components/FloatingDisplay.svelte`: Added `on:contextmenu|preventDefault|stopPropagation` to user-facing canvas
- `src/components/viz/Container.svelte`: Replaced manual `addEventListener` with Svelte modifiers
- `src/components/UnifiedContextMenu.svelte`: Context detection engine (already working)
- **Pattern Documentation**: Created comprehensive event handling architecture pattern at `docs/patterns/`

**Key Architecture Change**:
> **Use Svelte's declarative event system as the single source of truth for all UI interactions. Only use manual event listeners for specialized cases that Svelte cannot handle.**

#### Implementation Gaps 


### Known Technical Debt

#### Performance Optimizations Needed
```javascript
// TODO: Optimize rendering for display counts > 15
if (activeDisplays.length > 15) {
  // Implement LOD (Level of Detail) system
  this.reduceRenderQuality();
}

// TODO: Implement smart object pooling
const displayPool = new SmartObjectPool({
  initialSize: 10,
  maxSize: 30,
  growthFactor: 1.5
});
```

#ecture

## Development Guidelines

### Core Development Principles

Our development approach follows the "Simple, performant, maintainable" philosophy with these core principles that guide every implementation decision:

#### **Framework-First Development**
- **Before implementing any feature, check if the build tool, framework, or standard library already provides it**
- Leverage existing solutions in Svelte, Vite, Node.js, and browser APIs before writing custom implementations
- Framework features are typically better optimized, more maintainable, and follow established patterns

#### **Friction-Driven Problem Solving**
- **When hitting implementation friction, stop and research whether you're solving the problem the right way**
- Implementation difficulty often indicates architectural misalignment
- High friction signals need for pattern research, framework documentation review, or approach reconsideration

#### **Documentation-First Implementation**
- **Always consult official documentation for the tools in the project before writing custom code**
- Official docs reveal built-in solutions, best practices, and performance considerations
- Understanding intended usage patterns prevents reinventing existing functionality

#### **Principle Application Examples**
```javascript
// ✅ Framework-first: Use Svelte's built-in event system
<canvas on:contextmenu|preventDefault|stopPropagation={handleContextMenu}></canvas>

// ✅ Framework-first: Use Vite's environment-aware configuration
export const prerender = false; // Let Vite handle dev/production differences

// ✅ Framework-first: Leverage browser WebSocket API
const ws = new WebSocket(`${protocol}//${host}:${port}`);

// ✅ Documentation-first: Use requestAnimationFrame for smooth animations
function animate() {
  renderFrame();
  requestAnimationFrame(animate);
}
```

### Code Standards & Conventions

#### JavaScript/TypeScript Standards
```javascript
// Use imperative patterns with clear error handling
function processMarketData(data) {
  if (!data || !Array.isArray(data)) {
    console.warn('Invalid market data received');
    return [];
  }

  const processedTicks = [];
  for (const tick of data) {
    if (validateTick(tick)) {
      processedTicks.push(normalizeTick(tick));
    }
  }
  return processedTicks;
}

// Use descriptive variable names for cognitive clarity
const volatilityColor = calculateVolatilityColor(volatility);
const priceDisplayY = calculatePricePosition(currentPrice, containerHeight);
```

#### Performance Guidelines
- **Profile Before Optimizing**: Never optimize without measurements
- **Consider Memory Allocation**: Minimize object creation in render loops
- **Use RequestAnimationFrame**: Preferred for animations (performance.now() for timing)
- **Batch DOM Updates**: Minimize DOM manipulation and batch updates

#### Testing Approach
- **Demo Scripts**: Use timing scripts and interactive testing for validation
- **Manual Testing**: Browser-based testing for rendering and WebSocket functionality
- **Performance Monitoring**: Built-in performance monitoring with performance.now()

### Git Workflow & Commit Standards

#### Commit Message Format
```
type(scope): description

[optional body]

[optional footer]

Examples:
feat(market-profile): add delta analysis rendering mode
fix(websocket): implement reconnection logic with exponential backoff
perf(rendering): optimize dirty rectangle clearing for 15+ displays
docs(readme): update DevContainer setup instructions
```

#### Branch Naming Convention
- `feature/feature-name`: New features
- `fix/issue-description`: Bug fixes
- `perf/optimization-area`: Performance improvements
- `docs/documentation-updates`: Documentation changes

---

**NeuroSense FX Technical Philosophy**: The architecture focuses on creating an efficient interface for market data visualization, allowing users to focus on market patterns rather than interface mechanics.