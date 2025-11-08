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

### Frontend Architecture: Svelte 4.x + Canvas 2D

#### Component Hierarchy & Responsibilities

**Main Application Container** (`src/App.svelte`):
- Orchestrates global application state
- Manages WebSocket connection lifecycle
- Handles error boundaries and recovery

**Visualization Container** (`src/components/viz/Container.svelte`):
- Central rendering orchestrator using `requestAnimationFrame`
- Manages display lifecycle and resource allocation
- Implements three-layer z-index system
- Handles display collision detection and grid snapping

**Display Components** (`src/components/viz/Display.svelte`):
- Individual trading display instances
- Manages display-specific state and configuration
- Handles user interactions and drag-and-drop
- Implements workspace persistence

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

#### WebSocket Server Implementation
```javascript
// Real-time data streaming architecture
class WebSocketServer {
  constructor() {
    this.wss = new WebSocketServer({ port: 8080 });
    this.clients = new Set();
    this.dataProcessor = new MarketDataProcessor();
  }

  broadcast(data) {
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }
}
```

#### cTrader Integration Layer
```javascript
// Real-time tick processing with validation
class TickProcessor {
  processTick(rawTick) {
    const tick = {
      timestamp: Date.now(),
      symbol: rawTick.symbol,
      bid: this.validatePrice(rawTick.bid),
      ask: this.validatePrice(rawTick.ask),
      volume: rawTick.volume || 0
    };

    this.updateCalculations(tick);
    this.broadcastToClients(tick);
  }
}
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

### Market Profile Implementation

#### Six Rendering Modes Architecture
```javascript
// Market Profile rendering modes with delta analysis
class MarketProfile {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mode = config.mode || 'traditional';
    this.deltaMode = config.deltaMode || 'none';
  }

  render(marketData) {
    switch (this.mode) {
      case 'traditional':
        this.renderTraditionalProfile(marketData);
        break;
      case 'delta':
        this.renderDeltaProfile(marketData);
        break;
      case 'volume':
        this.renderVolumeProfile(marketData);
        break;
      case 'composite':
        this.renderCompositeProfile(marketData);
        break;
      case 'split':
        this.renderSplitProfile(marketData);
        break;
      case 'accumulated':
        this.renderAccumulatedProfile(marketData);
        break;
    }
  }

  renderDeltaProfile(data) {
    const { buyVolume, sellVolume } = this.calculateDelta(data);
    this.renderSideBySideProfiles(buyVolume, sellVolume);
  }
}
```

### Volatility Orb Visualization

#### Multi-Mode Architecture
```javascript
// Volatility Orb with multiple visualization modes
class VolatilityOrb {
  constructor(x, y, radius, config) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.mode = config.mode || 'gradient';
    this.colorMode = config.colorMode || 'volatility';
  }

  render(volatilityData) {
    this.ctx.save();

    switch (this.mode) {
      case 'gradient':
        this.renderGradientOrb(volatilityData);
        break;
      case 'segments':
        this.renderSegmentedOrb(volatilityData);
        break;
      case 'pulse':
        this.renderPulsingOrb(volatilityData);
        break;
      case 'radial':
        this.renderRadialOrb(volatilityData);
        break;
    }

    this.ctx.restore();
  }

  renderGradientOrb(data) {
    const gradient = this.ctx.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, this.radius
    );

    const color = this.getVolatilityColor(data.currentVolatility);
    gradient.addColorStop(0, color.high);
    gradient.addColorStop(0.7, color.medium);
    gradient.addColorStop(1, color.low);

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    this.ctx.fill();
  }
}
```

### Day Range Meter Implementation

#### ADR Reference System
```javascript
// Day Range Meter with graduated markers
class DayRangeMeter {
  constructor(x, y, height, config) {
    this.x = x;
    this.y = y;
    this.height = height;
    this.adr = config.adr || 100; // Average Daily Range
  }

  render(currentPrice, dayHigh, dayLow) {
    const dayRange = dayHigh - dayLow;
    const adrPercent = (dayRange / this.adr) * 100;

    // Render vertical meter
    this.renderVerticalMeter();

    // Render current price position
    const pricePosition = this.calculatePricePosition(currentPrice, dayHigh, dayLow);
    this.renderPriceIndicator(pricePosition);

    // Render ADR proximity alert
    if (adrPercent > 80) {
      this.renderADRAlert(adrPercent);
    }
  }

  renderVerticalMeter() {
    // Vertical line with graduated markers
    this.ctx.strokeStyle = '#4a5568';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(this.x, this.y);
    this.ctx.lineTo(this.x, this.y + this.height);
    this.ctx.stroke();

    // Graduated markers
    for (let i = 0; i <= 10; i++) {
      const y = this.y + (this.height / 10) * i;
      this.ctx.beginPath();
      this.ctx.moveTo(this.x - 5, y);
      this.ctx.lineTo(this.x + 5, y);
      this.ctx.stroke();
    }
  }
}
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
    },
    "ghcr.io/devcontainers/features/playwright:1": {}
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "svelte.svelte-vscode",
        "esbenp.prettier-vscode",
        "dbaeumer.vscode-eslint",
        "ms-playwright.playwright"
      ]
    }
  },
  "postCreateCommand": "npm install && npm run test:e2e --install && bash setup_mcp.sh"
}
```

#### Development Workflow Integration
```bash
# Service management through unified script
./run.sh start     # Starts frontend (5173) + backend (8080)
./run.sh stop      # Graceful shutdown of all services
./run.sh status    # Health check of all services
./run.sh logs      # Real-time log streaming

# Development commands
npm run dev        # Frontend development server with hot reload
npm run test       # Playwright test suite
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

### Performance Benchmarks

#### Target Performance Metrics
```javascript
const PERFORMANCE_TARGETS = {
  latency: {
    dataToVisual: 100,    // ms
    userInteraction: 16,  // ms (1 frame at 60fps)
    configurationUpdate: 50 // ms
  },
  throughput: {
    maxDisplays: 20,
    maxTicksPerSecond: 1000,
    maxUserInteractionsPerSecond: 60
  },
  resources: {
    maxMemoryUsage: 500 * 1024 * 1024, // 500MB
    maxCPUUsage: 80, // percent
    maxNetworkBandwidth: 1 * 1024 * 1024 // 1MB/s
  }
};
```

## Current Technical State & Known Issues

### Production Readiness Assessment

#### Completed Features (98% Complete)
- ✅ Core rendering engine with Canvas 2D DPR-aware rendering
- ✅ Three-layer floating display system with collision detection
- ✅ Market Profile with all 6 rendering modes including delta analysis
- ✅ Volatility Orb with multiple visualization modes
- ✅ Real-time WebSocket data streaming with reconnection logic
- ✅ Unified configuration system with schema validation
- ✅ Workspace persistence and layout management
- ✅ Comprehensive testing infrastructure with Playwright
- ✅ Memory optimization and performance monitoring
- ✅ Browser zoom awareness and crisp text rendering

#### Remaining Work (2% In Progress)
- 🔄 MCP (Model Context Protocol) server integration optimization
- 🔄 Minor performance optimizations for edge cases
- 🔄 Additional accessibility testing and improvements
- 🔄 Documentation refinement and API stabilization

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

#### Code Quality Improvements
- **TypeScript Migration**: Gradual migration of JavaScript modules to TypeScript
- **Error Boundary Implementation**: Better error boundaries for display components
- **Memory Leak Detection**: Enhanced memory leak detection in development mode

## Development Priorities & Roadmap

### Immediate Priorities (Next 2 weeks)
1. **MCP Server Integration**: Complete robust MCP setup for enhanced development experience
2. **Edge Case Performance**: Optimize rendering for high display counts (15+ displays)
3. **Accessibility Enhancement**: Complete screen reader support and keyboard navigation
4. **Browser Compatibility**: Final testing on Safari and Firefox

### Short-term Goals (Next month)
1. **TypeScript Migration**: Core rendering engine migration to TypeScript
2. **Advanced Alerting**: Implement sophisticated pattern recognition alerts
3. **Mobile Responsiveness**: Basic mobile display capabilities
4. **Plugin Architecture**: Foundation for third-party visualization plugins

### Long-term Vision (3-6 months)
1. **Multi-Asset Support**: Expand beyond FX to stocks, crypto, and commodities
2. **Machine Learning Integration**: Pattern recognition and predictive analytics
3. **Collaborative Features**: Shared workspaces and real-time collaboration
4. **Cloud Deployment**: SaaS deployment with multi-tenant architecture

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