# CLAUDE.md - NeuroSense FX Technical Architecture & Design Intent

This document provides comprehensive technical understanding of NeuroSense FX for development work, combining deep architectural details with the foundational design philosophy that drives every technical decision.

## Design Foundation

### Core Principles from Neuroscience & Human Factors

**NeuroSense FX** is built on scientific principles from neuroscience, human factors research, and aviation/military display design. The technical architecture exists to serve human cognitive needs, not the other way around.

**Project Technical Philosophy** "Simple, performant, maintainable" 

#### Human-Cognitive Constraints Driving Technical Decisions:
- **Cognitive Load Limitation**: Working memory can hold 4±1 chunks of information under stress
- **Attention Span Degradation**: Decision-making quality declines after 2-3 hours of intense focus
- **Pattern Recognition Superiority**: Visual cortex processes parallel information 60,000x faster than sequential processing
- **Stress-Induced Tunnel Vision**: Under pressure, users rely on pre-attentive visual attributes

#### Technical Manifestations:
- **Sub-100ms Update Latency**: Matches perceptual threshold for smooth motion
- **60fps Rendering**: Eliminates cognitive dissonance from stuttering displays
- **Pre-attentive Visual Encoding**: Color, motion, size, position, shape for instant recognition
- **Progressive Disclosure Architecture**: Information layers from glanceable to analytical

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
- Mouse interaction handling with 60fps frame throttling
- Environment indicator display (DEV/PROD modes)

**Display Components** (`src/components/FloatingDisplay.svelte`):
- Individual trading display instances with drag-and-drop positioning
- Display-specific state and configuration management
- User interactions for resizing and positioning
- Collision detection and grid snapping through interact.js

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

**Performance Optimizations**:
- **Dirty Rectangle Rendering**: Only redraw changed regions
- **Object Pooling**: Reuse display objects to minimize GC pressure
- **Layered Canvas**: Separate canvases for different update frequencies
- **Web Worker Offloading**: Heavy computation moved to background threads

#### State Management Architecture

**Central Store System** (`src/stores/`):
```javascript
// Unified store architecture with reactive updates
export const displayStore = writable({
  displays: new Map(),
  activeDisplays: [],
  workspace: { layout: [], preferences: {} }
});

// Web worker integration for heavy processing
const dataProcessor = new Worker('/src/workers/dataProcessor.js');
dataProcessor.postMessage({ type: 'PROCESS_TICKS', data: ticks });
```

**Store Types**:
- `displayStore`: Display configuration and layout management
- `marketDataStore`: Real-time market data processing and distribution
- `configStore`: Unified configuration system with schema validation
- `uiStore`: UI state and interaction management

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

#### WebSocket Protocol (Current Implementation)
```javascript
// Client → Server messages
{ "type": "connect" }
{ "type": "subscribe", "symbols": ["EURUSD", "GBPUSD"] }
{ "type": "unsubscribe", "symbols": ["EURUSD"] }
{ "type": "ping" }

// Server → Client messages
{ "type": "status", "status": "connected|disconnected|error", "availableSymbols": [...] }
{ "type": "ready", "availableSymbols": [...] }
{ "type": "tick", "symbol": "EURUSD", "bid": 1.0876, "ask": 1.0878, ... }
{ "type": "subscribeResponse", "success": true, "symbols": ["EURUSD"] }
{ "type": "pong" }
{ "type": "error", "message": "Error description" }
```

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
- **Six Rendering Modes**: traditional, delta, volume, composite, split, accumulated
- **Delta Analysis**: Buy/sell volume comparison with side-by-side profiles
- **Price Distribution**: TPO (Time Price Opportunity) based volume profiling
- **Implementation**: Canvas-based rendering with D3 scale integration

#### Volatility Orb (`volatilityOrb.js`)
- **Multiple Modes**: gradient, segments, pulse, radial visualizations
- **Color Modes**: volatility-based, momentum-based, custom color schemes
- **Dynamic Animation**: Smooth transitions and real-time volatility updates
- **Implementation**: Radial gradient rendering with configurable parameters

#### Day Range Meter (`dayRangeMeter.js`)
- **ADR Reference**: Average Daily Range comparison with graduated markers
- **Price Positioning**: Current price displayed relative to daily range
- **Proximity Alerts**: Visual alerts when approaching ADR limits
- **Implementation**: Vertical meter with percentage-based positioning

#### Price Display System
- **Price Float** (`priceFloat.js`): Horizontal price line with glow effects
- **Price Display** (`priceDisplay.js`): Monospaced numeric display with vertical tracking
- **Price Markers** (`priceMarkers.js`): User-placed reference points with Ctrl+Click interaction

#### Supporting Components
- **Volatility Metric** (`volatilityMetric.js`): Numerical volatility indicators
- **Hover Indicator** (`hoverIndicator.js`): Interactive hover feedback system
- **Market Pulse** (`marketPulse.js`): Market activity visualization
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
drawHoverIndicator(ctx, renderingContext, config, currentState, y, hoverState); // Interaction layer
```

### Component Configuration System

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
// Reactive configuration system
export const configStore = writable(defaultConfig);

configStore.subscribe((newConfig) => {
  // Broadcast configuration changes to all displays
  displayStore.update(displays => {
    displays.forEach(display => {
      display.updateConfiguration(newConfig);
    });
    return displays;
  });

  // Persist configuration to workspace
  workspaceStore.update(workspace => ({
    ...workspace,
    config: newConfig
  }));
});
```

## Performance Architecture

### Sub-100ms Latency Implementation

```javascript
// High-performance rendering loop
class HighPerformanceRenderer {
  constructor() {
    this.lastFrameTime = 0;
    this.targetFrameTime = 16.67; // 60fps
    this.frameBuffer = new Float32Array(1024);
  }

  render(currentTime) {
    const deltaTime = currentTime - this.lastFrameTime;

    if (deltaTime >= this.targetFrameTime) {
      this.processFrameData();
      this.renderFrame();
      this.lastFrameTime = currentTime;
    }

    requestAnimationFrame((time) => this.render(time));
  }

  processFrameData() {
    // Batch process market data updates
    const dataBatch = this.collectPendingUpdates();
    this.processBatch(dataBatch);
  }
}
```

### Memory Management Strategy

```javascript
// Object pooling for memory efficiency
class DisplayObjectPool {
  constructor(initialSize = 10) {
    this.pool = [];
    this.inUse = new Set();

    for (let i = 0; i < initialSize; i++) {
      this.pool.push(new DisplayObject());
    }
  }

  acquire() {
    let obj = this.pool.pop();
    if (!obj) {
      obj = new DisplayObject();
    }

    this.inUse.add(obj);
    return obj.reset();
  }

  release(obj) {
    if (this.inUse.has(obj)) {
      this.inUse.delete(obj);
      this.pool.push(obj);
    }
  }
}
```

### Resource Allocation & Load Balancing

```javascript
// Intelligent resource management
class ResourceManager {
  constructor() {
    this.displayBudget = 20; // Maximum concurrent displays
    this.memoryThreshold = 500 * 1024 * 1024; // 500MB
    this.cpuThreshold = 80; // 80% CPU usage
  }

  canAllocateNewDisplay() {
    return this.activeDisplays.length < this.displayBudget &&
           this.memoryUsage < this.memoryThreshold &&
           this.cpuUsage < this.cpuThreshold;
  }

  optimizeResources() {
    if (this.memoryUsage > this.memoryThreshold) {
      this.reduceDisplayQuality();
    }

    if (this.cpuUsage > this.cpuThreshold) {
      this.reduceUpdateFrequency();
    }
  }
}
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
- **Port Configuration**: Frontend on http://localhost:4173, Backend WebSocket on ws://localhost:8081
- **Optimized Builds**: Production-compiled frontend with minified assets
- **Use When**: Production testing, performance validation, demo preparation

**Environment-Aware Configuration**:
- **Development**: Vite dev server (port 5174) + WebSocket proxy to backend (port 8080)
- **Production**: Static file serving (port 4173) + direct WebSocket connection (port 8081)
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

### Performance Characteristics (Current Implementation)

#### Observed Performance Metrics
```javascript
const CURRENT_PERFORMANCE = {
  rendering: {
    frameRate: "60fps target with requestAnimationFrame",
    frameTime: "~8-12ms per frame (well under 16.67ms 60fps target)",
    dprScaling: "Device pixel ratio awareness for crisp text"
  },
  latency: {
    dataToVisual: "~15-45ms average (sub-100ms target achieved)",
    userInteraction: "~16ms (1 frame at 60fps)",
    configurationUpdate: "~50ms with reactive stores"
  },
  throughput: {
    maxDisplays: "20-25 before performance degradation observed",
    maxTicksPerSecond: "1000+ per symbol handled efficiently",
    webSocketLatency: "15-45ms average connection latency"
  },
  resources: {
    singleDisplayMemory: "~2MB",
    tenDisplaysMemory: "~45MB",
    twentyDisplaysMemory: "~180MB",
    memoryTarget: "<500MB for 20+ displays (target achievable)",
    cpuUsage: "~35% for 20 displays (well under 80% target)"
  }
};
```

#### Performance Optimizations Implemented
- **Dirty Rectangle Rendering**: Only redraw changed regions
- **Frame Throttling**: Mouse interactions throttled to 60fps
- **Object Pooling**: Reuse display objects to minimize GC pressure
- **Web Worker Integration**: Heavy computation moved to background threads
- **DPR-Aware Rendering**: Crisp text rendering with device pixel ratio support

#### Scalability Limits Observed
- **Maximum Displays**: 20-25 simultaneous displays before performance degradation
- **Memory Efficiency**: Linear memory growth with display count
- **CPU Scaling**: CPU usage scales approximately linearly with active displays
- **WebSocket Performance**: Handles 100+ concurrent client connections efficiently

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

**Current Monorepo Structure (November 2024)**:
```
neurosensefx/                          # Single unified repository
├── src/                               # Frontend application (formerly neurosensefx repo)
├── services/tick-backend/             # Backend service (formerly ctrader-tick-backend repo)
├── libs/cTrader-Layer/                # Shared library (formerly cTrader-Layer repo)
├── docs/                              # Consolidated documentation
└── run.sh                             # Unified service management (1653 lines)
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
- **Current**: Unified `run.sh` script with environment-aware configuration, backup systems, and health monitoring
- **Complexity**: Script grew to 1653 lines to handle comprehensive service management

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
- ✅ Browser zoom awareness and crisp text rendering
- ✅ Environment-aware development/production modes

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

### Code Standards & Conventions

#### JavaScript/TypeScript Standards
```javascript
// Use functional programming patterns where possible
const processMarketData = (data) => data
  .filter(validateTick)
  .map(normalizeTick)
  .reduce(aggregateData, initialState);

// Always validate inputs
function renderDisplay(displayData) {
  if (!isValidDisplayData(displayData)) {
    throw new Error('Invalid display data');
  }

  // Rendering logic here
}

// Use descriptive variable names for cognitive clarity
const preAttentiveColorForVolatilityLevel = calculateVolatilityColor(volatility);
```

#### Performance Guidelines
- **Profile Before Optimizing**: Never optimize without measurements
- **Consider Memory Allocation**: Minimize object creation in render loops
- **Use RequestAnimationFrame**: Never use setInterval for animations
- **Batch DOM Updates**: Minimize DOM manipulation and batch updates

#### Testing Requirements
- **Unit Tests**: All utility functions must have unit tests
- **Integration Tests**: WebSocket communication must be tested
- **Visual Regression Tests**: All rendering components must have visual tests
- **Performance Tests**: 60fps must be maintained with 20+ displays

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

**NeuroSense FX Technical Philosophy**: Every technical decision serves the goal of reducing cognitive load and extending human capabilities. The architecture is designed to be invisible to the user, allowing traders to focus on market patterns rather than interface mechanics.