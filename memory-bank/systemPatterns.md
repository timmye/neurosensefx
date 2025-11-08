# NeuroSense FX - System Patterns

## System Architecture Overview

### High-Level Architecture Pattern
NeuroSense FX follows a **Two-Server Architecture** with a **Radical Floating Architecture** pattern for frontend:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Frontend Server  │◄──►│   Backend Server  │◄──►│   cTrader API    │
│  (Vite/5173)      │    │   (Node/8080)     │    │   (External)     │
│                 │    │                 │    │                 │
│ • Svelte UI     │    │ • WebSocket     │    │ • Market Data    │
│ • Canvas Render │    │ • Data Process   │    │ • Price Ticks   │
│ • Hot Reload    │    │ • Client Mgmt    │    │ • Authentication│
│ • Dev Tools     │    │ • API Integration│    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Browser Client  │
                    │                 │
                    │ • Floating Displays │
                    │ • Canvas Renders │
                    │ • Web Worker     │
                    │ • Real-time UI   │
                    └─────────────────┘
         │
         └───────────────────────┼───────────────────────┘
                                 │
```

### Radical Floating Architecture Pattern

#### Three-Layer System
The frontend implements a sophisticated three-layer floating architecture:

```
┌─────────────────────────────────────────────────┐
│ Layer 3: Overlays (z-index: 10000+)                     │
│ • Context Menus                                         │
│ • Modal Dialogs                                         │
│ • Temporary UI Elements                                │
├─────────────────────────────────────────────────┤
│ Layer 2: Panels (z-index: 1000-9999)                   │
│ • Symbol Palette                                        │
│ • Debug Panel                                           │
│ • System Panel                                          │
│ • Configuration Controls                               │
├─────────────────────────────────────────────────┤
│ Layer 1: Displays (z-index: 1-999)                      │
│ • Price Visualization Displays                          │
│ • Market Profile Displays                               │
│ • Volatility Orb Displays                               │
│ • Canvas Elements (220×120px)                          │
└─────────────────────────────────────────────────┘
```

## Key Design Patterns

### 1. Centralized State Management Pattern ✅ COMPLETE
**Purpose**: Single source of truth for all floating elements

**Implementation**:
```javascript
// floatingStore.js - Centralized State Management
const initialState = {
  displays: new Map(),      // Bottom layer: visualization displays
  panels: new Map(),        // Middle layer: UI panels
  overlays: new Map(),      // Top layer: context menus
  
  // Z-index management per layer
  nextDisplayZIndex: 1,
  nextPanelZIndex: 1000,
  nextOverlayZIndex: 10000,
  
  // Active state management
  activeDisplayId: null,
  activePanelId: null,
  
  // Context menu state
  contextMenu: { open: false, x: 0, y: 0, targetId: null, targetType: null },
  
  // Drag state
  draggedItem: { type: null, id: null, offset: { x: 0, y: 0 } }
};
```

**Benefits**:
- Eliminated state fragmentation (replaced 5 legacy stores)
- Unified CRUD operations for all floating elements
- Consistent z-index management across layers
- Reactive updates through Svelte stores

### 2. Two-Server Pattern ✅ COMPLETE
**Purpose**: Separate concerns between UI and data processing

**Frontend Server (Port 5173)**:
```javascript
// vite.config.js
export default defineConfig({
  server: {
    proxy: {
      '/ws': {
        target: 'ws://127.0.0.1:8080',
        ws: true,
      },
    },
  },
});
```

**Backend Server (Port 8080)**:
```javascript
// WebSocketServer.js
const wsServer = new WebSocketServer(port, session);
```

**Benefits**:
- Independent scaling of frontend and backend
- Clear separation of UI and data concerns
- Flexible deployment options
- Hot reload for frontend development

### 3. Canvas Rendering Pattern ✅ COMPLETE
**Purpose**: High-performance visualization for multiple displays

**Implementation**:
```javascript
// FloatingDisplay.svelte - Container-style contentArea approach
function renderDisplay(ctx, data) {
  // Clear canvas using contentArea coordinates (CSS pixels)
  ctx.clearRect(0, 0, contentArea.width, contentArea.height);
  
  // Draw visual elements in unified coordinate space
  drawMarketProfile(ctx, renderingContext, config, state, yScale);
  drawDayRangeMeter(ctx, renderingContext, config, state, yScale);
  drawVolatilityOrb(ctx, renderingContext, config, state, yScale);
  
  // Schedule next frame
  requestAnimationFrame(() => renderDisplay(ctx, data));
}
```

### 4. Coordinate System Unification Pattern ✅ COMPLETE
**Purpose**: Eliminate coordinate system mismatches through unified contentArea approach

**Implementation**:
```javascript
// 🔧 CONTAINER-STYLE: contentArea calculations
const containerSize = config.containerSize || { width: 240, height: 160 };
const contentArea = {
  width: containerSize.width - (config.padding * 2),
  height: containerSize.height - config.headerHeight - config.padding
};

// 🔧 DPR-AWARE: Canvas dimensions with sub-pixel alignment
canvas.width = contentArea.width * dpr;
canvas.height = contentArea.height * dpr;
canvas.style.width = contentArea.width + 'px';
canvas.style.height = contentArea.height + 'px';

// 🔧 CRISP RENDERING: Context configuration for 1px lines
ctx.scale(dpr, dpr);
ctx.translate(0.5, 0.5); // Sub-pixel alignment
ctx.imageSmoothingEnabled = false; // Disable anti-aliasing for crisp lines
```

**Benefits**:
- **Coordinate Consistency**: All visualizations use same contentArea coordinate space
- **DPR Support**: Crisp 1px lines on all display types and zoom levels
- **Performance**: Maintains 60fps with 20+ simultaneous displays

### 5. Component Hierarchy Pattern ✅ COMPLETE
**Purpose**: Consistent component architecture for floating elements

**Implementation**:
```javascript
// FloatingPanel.svelte - Base component
export let type;
export let config = {};
export let position = { x: 50, y: 50 };
export let zIndex = 1000;

// FloatingDisplay.svelte - Specialized for visualizations
// SymbolPalette.svelte - Specialized for symbol selection
// ContextMenu.svelte - Specialized for interactions
```

**Benefits**:
- Consistent behavior across all floating elements
- Unified drag-and-drop functionality
- Shared lifecycle management
- Code reusability

### 6. WebSocket Communication Pattern ✅ COMPLETE
**Purpose**: Real-time data flow between servers and client

**Implementation**:
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
  timestamp: Date.now(),
  adr: { high: 1.0860, low: 1.0820 },
  marketProfile: { /* distribution data */ }
}));
```

**Benefits**:
- Sub-100ms data-to-visual latency
- Real-time market data processing
- Bidirectional communication
- Connection management and retry logic

### 7. Event Delegation Pattern ✅ COMPLETE
**Purpose**: Efficient event handling for multiple floating elements

**Implementation**:
```javascript
// App.svelte - Centralized event handling
function handleWorkspaceClick(event) {
  const target = event.target.closest('[data-floating-id]');
  if (target) {
    const id = target.dataset.floatingId;
    const type = target.dataset.floatingType;
    actions.setActive(type === 'display' ? 'display' : 'panel', id);
  }
}
```

**Benefits**:
- Single event listener for all floating elements
- Efficient memory usage
- Simplified event management
- Consistent interaction patterns

## Data Flow Patterns

### 1. Real-time Data Flow Pattern ✅ COMPLETE
```
cTrader API → Backend Server → Frontend Server → Canvas → User
     ↑           ↓              ↓           ↓        ↓
     └─────────────────────────────────────────────┘
                    User Interactions
```

**Implementation**:
```javascript
// Backend: Data Processing
function processTickData(tick) {
  const enriched = {
    ...tick,
    adr: calculateADR(tick.symbol),
    marketProfile: updateProfile(tick),
    volatility: calculateVolatility(tick)
  };
  broadcastToClients(enriched);
}

// Frontend: Canvas Update
function updateDisplay(displayId, data) {
  const display = displays.get(displayId);
  if (display) {
    display.state = { ...display.state, ...data };
    renderCanvas(display.canvas, display.state);
  }
}
```

### 2. State Synchronization Pattern ✅ COMPLETE
```javascript
// Store Synchronization
floatingStore.subscribe(store => {
  // Update backend with active subscriptions
  const activeSymbols = Array.from(store.displays.values())
    .map(display => display.symbol);
  
  if (activeSymbols.length > 0) {
    ws.send(JSON.stringify({
      type: 'UPDATE_SUBSCRIPTIONS',
      symbols: activeSymbols
    }));
  }
});
```

### 3. Performance Optimization Pattern 🔄 80% COMPLETE
**Object Pooling**:
```javascript
// Canvas Object Pool
const objectPool = {
  points: [],
  rectangles: [],
  
  getPoint(x, y) {
    const point = this.points.pop() || { x: 0, y: 0 };
    point.x = x; point.y = y;
    return point;
  },
  
  releasePoint(point) {
    this.points.push(point);
  }
};
```

**Frame Skipping**:
```javascript
let lastFrameTime = 0;
const targetFrameTime = 1000 / 60; // 60fps

function render(currentTime) {
  if (currentTime - lastFrameTime >= targetFrameTime) {
    updateCanvas();
    lastFrameTime = currentTime;
  }
  requestAnimationFrame(render);
}
```

## Component Relationship Pattern

### Hierarchical Component Structure
```
App.svelte (Root)
├── FloatingPanel.svelte (Base Component)
│   ├── FloatingDisplay.svelte (Visualization) × N
│   │   ├── Canvas Element (220×120px)
│   │   ├── D3.js Visualization Functions
│   │   └── Real-time Data Updates
│   ├── SymbolPalette.svelte (Symbol Selection)
│   ├── FloatingDebugPanel.svelte (Debug Information)
│   └── FloatingSystemPanel.svelte (System Controls)
├── ContextMenu.svelte (Dynamic Context Menus)
└── Web Worker (dataProcessor.js)
    ├── WebSocket Client
    ├── Data Processing Engine
    └── Canvas Update Optimization
```

## Configuration Patterns

### 1. Strategy Pattern (Visualization Modes) 🔄 65% COMPLETE
```javascript
// Volatility Visualization Strategies
const volatilityStrategies = {
  directional: (data) => ({
    color: data.trend > 0 ? '#00ff00' : '#ff0000',
    intensity: Math.abs(data.trend)
  }),
  
  spectrum: (data) => ({
    hue: (data.volatility / 100) * 240,
    intensity: data.volatility
  }),
  
  single: (data) => ({
    color: '#9d4edd',
    intensity: data.volatility
  })
};
```

### 2. Builder Pattern (Display Configuration) ✅ COMPLETE
```javascript
// Display Configuration Builder
class DisplayConfigBuilder {
  constructor() {
    this.config = {
      width: 220,
      height: 120,
      showPriceFloat: true,
      showMarketProfile: true,
      showVolatilityOrb: true,
      colorMode: 'directional'
    };
  }
  
  withDimensions(width, height) {
    this.config.width = width; this.config.height = height;
    return this;
  }
  
  build() { return { ...this.config }; }
}
```

## Error Handling Patterns

### 1. Graceful Degradation Pattern ✅ COMPLETE
```javascript
// WebSocket Connection Handling
function connectWebSocket(url) {
  const ws = new WebSocket(url);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
    startDataProcessing();
  };
  
  ws.onerror = (error) => {
    console.warn('WebSocket error:', error);
    setTimeout(() => connectWebSocket(url), 5000);
  };
  
  ws.onclose = () => {
    console.log('WebSocket closed');
    setTimeout(() => connectWebSocket(url), 1000);
  };
  
  return ws;
}
```

### 2. Circuit Breaker Pattern ✅ COMPLETE
```javascript
// API Protection
let failureCount = 0;
const maxFailures = 5;
let circuitOpen = false;

function callAPI(url) {
  if (circuitOpen) {
    throw new Error('Circuit breaker is open');
  }
  
  return fetch(url)
    .catch(error => {
      failureCount++;
      if (failureCount >= maxFailures) {
        circuitOpen = true;
        setTimeout(() => {
          circuitOpen = false; failureCount = 0;
        },30000);
      }
      throw error;
    });
}
```

## Server-Specific Patterns

### 1. Frontend Server Patterns ✅ COMPLETE
- **Hot Module Replacement**: Instant code updates during development
- **Proxy Configuration**: Route WebSocket requests to backend server
- **Asset Bundling**: Optimize frontend code for production
- **Development Tools**: Source maps, error overlay, fast refresh

### 2. Backend Server Patterns ✅ COMPLETE
- **WebSocket Management**: Handle multiple client connections
- **Data Streaming**: Real-time market data processing
- **Client State**: Track connection status and subscriptions
- **Error Recovery**: Automatic reconnection and data resynchronization

## Performance Patterns

### 1. Dirty Rectangle Pattern 🔄 70% COMPLETE
```javascript
// Dirty Region Tracking
const dirtyRegions = [];

function markDirty(x, y, width, height) {
  dirtyRegions.push({ x, y, width, height });
}

function renderDirtyRegions(ctx) {
  dirtyRegions.forEach(region => {
    ctx.clearRect(region.x, region.y, region.width, region.height);
    redrawRegion(ctx, region);
  });
  dirtyRegions.length = 0;
}
```

### 2. Memory Management Pattern 🔄 75% COMPLETE
```javascript
// Component Cleanup
function cleanupDisplay(displayId) {
  const display = displays.get(displayId);
  if (display) {
    // Cancel animation frames
    if (display.animationFrame) {
      cancelAnimationFrame(display.animationFrame);
    }
    
    // Clear event listeners
    display.canvas.removeEventListener('click', display.clickHandler);
    
    // Release pooled objects
    releasePooledObjects(display.pooledObjects);
  }
}
```

## Enhanced Floating Element Patterns ✅ COMPLETE

### 7. Clean Floating Element Pattern ✅ COMPLETE
**Purpose**: Perfect behavior implementation for floating elements with advanced interactions

**Implementation**:
```javascript
// CleanFloatingElement.svelte - Reference Implementation
function checkCollision(newX, newY, newWidth, newHeight) {
  const others = getAllFloatingElements();
  
  for (const other of others) {
    if (isColliding(newX, newY, newWidth, newHeight, other)) {
      // Smart edge snapping with distance-based positioning
      const positions = [
        { x: other.x - newWidth, y: newY },      // Slide left
        { x: other.x + other.width, y: newY },  // Slide right  
        { x: newX, y: other.y - newHeight },    // Slide up
        { x: newX, y: other.y + other.height }  // Slide down
      ];
      
      // Find position with minimum distance from current
      return { canMove: false, suggestedPosition: findClosestPosition(positions) };
    }
  }
  return { canMove: true };
}

function snapToGrid(value) {
  const gridSize = 20;
  const threshold = gridSize / 2; // Only snap when close to grid line
  
  const offset = value % gridSize;
  const shouldSnap = offset < threshold || offset > (gridSize - threshold);
  
  return shouldSnap ? Math.round(value / gridSize) * gridSize : value;
}
```

**Benefits**:
- Smart collision detection with edge snapping
- Threshold-based grid snapping prevents "massive jumps"
- 8-handle resize system with collision awareness
- Touch detection allows resize when elements touch edges

### 8. Production Integration Pattern ✅ COMPLETE
**Purpose**: Integrate clean behaviors into existing production architecture

**Implementation**:
```javascript
// FloatingDisplay.svelte - Production Integration
// Clean behavior + Canvas rendering + WebSocket integration

// Enhanced behaviors from CleanFloatingElement
let isDragging = false;
let isResizing = false;
let resizeHandle = null;

// Production canvas and data integration
let canvasData = {};
let config = {};
let state = {};
let isActive = false;

// Unified mouse move handler
function handleMouseMove(e) {
  if (isDragging) {
    // Apply clean drag behavior with collision and grid snapping
    const newPosition = calculateNewPosition(e);
    const collision = checkCollision(newPosition.x, newPosition.y);
    
    if (collision.canMove) {
      updatePosition(newPosition);
      actions.updateDrag(newPosition);
    } else if (collision.suggestedPosition) {
      updatePosition(collision.suggestedPosition);
      actions.updateDrag(collision.suggestedPosition);
    }
  } else if (isResizing) {
    // Apply clean resize behavior with collision awareness
    const newSize = calculateNewSize(e);
    const touchingOnly = checkIfOnlyTouching(collision.collision, newSize);
    
    if (touchingOnly) {
      updateSize(newSize);
      actions.resizeDisplay(id, newSize.width, newSize.height);
    }
  }
}
```

**Benefits**:
- Perfect behavior integration with existing production features
- Maintains all WebSocket connectivity and canvas rendering
- Preserves real-time market data visualization

### 9. Unified Context Menu Pattern ✅ COMPLETE
**Purpose**: Single intelligent context menu system that adapts content based on click context

**Implementation**:
```javascript
// Context Detection Engine
function detectContextMenuContext(event) {
  const target = event.target;
  
  // Canvas click - Full parameter controls
  if (target.classList.contains('canvas-element') || target.closest('canvas')) {
    const displayId = target.closest('[data-display-id]')?.dataset.displayId;
    return { 
      type: 'canvas', 
      targetId: displayId, 
      targetType: 'display',
      showTabs: true,
      tabs: ['quickActions', 'priceDisplay', 'marketProfile', 'volatility', 'layoutSizing', 'advanced']
    };
  }
  
  // Other contexts...
  return { type: 'workspace', targetId: null, quickActions: ['addDisplay', 'showSymbolPalette'] };
}
```

**Benefits**:
- **Single Right-Click Rule**: Consistent user experience across entire interface
- **Context-Aware Intelligence**: Menu shows exactly what's needed for current context
- **Architectural Consistency**: All state management through centralized floatingStore

## Container vs Display Architecture Pattern ✅ COMPLETE

### 10. Hierarchical Container-Display Pattern ✅ COMPLETE
**Purpose**: Clear separation between layout/interaction (Container) and content/rendering (Display)

**Implementation**:
```javascript
// Container Layer - Layout & Interaction
$: displayPosition = display?.position || position;
$: displaySize = { 
  width: Math.min(2000, (config.visualizationsContentWidth / 100) * REFERENCE_CANVAS.width), 
  height: Math.min(2000, ((config.meterHeight / 100) * REFERENCE_CANVAS.height) + 40)
};

// Display Layer - Content Rendering
$: scaledConfig = scaleToCanvas(config, displaySize.width, displaySize.height - 40);
```

**Separation of Concerns**:
- **Container**: Position, size, user interaction, visual styling, layout constraints
- **Display**: Content rendering, data processing, visual scaling, performance, canvas interactions

### 11. Reference Canvas Pattern ✅ COMPLETE
**Purpose**: Percentage-based storage with runtime scaling for responsive behavior

**Three-Layer System**:
- **Storage Layer**: Percentages relative to 220×120px reference canvas
- **Container Layer**: Direct calculation from config percentages
- **Display Layer**: Scaled to actual canvas dimensions

### 12. Reactive Independence Pattern ✅ COMPLETE
**Purpose**: Eliminate circular dependencies through independent reactive statements

**Circular Dependency Prevention**:
```javascript
// ✅ AFTER (Independent Reactive Statements):
$: displaySize = { 
  width: (config.visualizationsContentWidth / 100) * REFERENCE_CANVAS.width,
  height: ((config.meterHeight / 100) * REFERENCE_CANVAS.height) + 40
}; // Independent of scaledConfig

$: scaledConfig = scaleToCanvas(config, displaySize.width, displaySize.height - 40);
// Uses container dimensions, not canvas dimensions
```

### 13. Resize Handle Pattern ✅ COMPLETE
**Purpose**: 8-handle resize system with proper coordinate calculations and constraints

**Handle Types**:
- **Corner Handles**: nw, ne, se, sw (resize width + height + position)
- **Edge Handles**: n, s, e, w (resize single dimension + position)

### 14. Stability Assurance Pattern ✅ COMPLETE
**Purpose**: Multiple safety mechanisms to prevent exponential growth and system instability

**Multi-Layer Protection**:
- Input validation, change detection, state consistency check, performance monitoring

## Price Display Foundation Patterns ✅ COMPLETE

### 15. Enhanced Price Formatting Pattern ✅ COMPLETE
**Purpose**: Robust price component separation with comprehensive validation

**Key Features**:
- Multi-level input validation with graceful null returns
- FX convention handling for different digit counts
- Critical percentage-to-decimal conversion with fallbacks

### 16. Dual Positioning Mode Pattern ✅ COMPLETE
**Purpose**: Flexible positioning with runtime selection and percentage conversion

**Key Features**:
- Runtime mode selection (ADR axis vs canvas-relative)
- Percentage-to-decimal conversion for all positioning parameters
- Content-relative dimension calculations

### 17. Optimized Text Rendering Pattern ✅ COMPLETE
**Purpose**: Single-pass measurement with separated rendering for performance

**Key Features**:
- Single text measurement pass for all components
- Cached metrics reuse for background and text rendering
- Independent background/box control

### 18. Comprehensive Error Handling Pattern ✅ COMPLETE
**Purpose**: Multi-level validation with graceful fallbacks and debugging support

**Implementation**:
```javascript
export function drawPriceDisplay(ctx, renderingContext, config, state, y) {
  // Level 1: Parameter validation
  if (!ctx || !renderingContext || !config || !state || !y) {
    console.warn('[PriceDisplay] Missing required parameters, skipping render');
    return;
  }
  // Additional validation levels...
}
```

### 19. Enhancement Pattern ✅ COMPLETE
**Purpose**: Optional features with selective bounds checking for performance

**Key Features**:
- Core elements always render (trader requirements)
- Enhancements only render when in bounds (performance optimization)
- Independent feature control via configuration flags

## Market Profile Delta Visualization Patterns ✅ COMPLETE

### 20. Delta Calculation Pattern ✅ COMPLETE
**Purpose**: Sophisticated market pressure analysis through buy/sell volume differential

**Key Innovation**: Goes beyond traditional volume distribution to show market pressure dynamics
- **Delta Formula**: `delta = buyVolume - sellVolume` per price level
- **Pressure Visualization**: Positive/negative delta with color coding
- **Six Rendering Modes**: Three delta modes complementing existing volume modes

### 21. Six-Mode Rendering Pattern ✅ COMPLETE
**Purpose**: Flexible delta visualization with six distinct rendering approaches

**Three Volume Modes**: `separate`, `combinedLeft`, `combinedRight`
**Three Delta Modes**: `deltaBoth`, `deltaLeft`, `deltaRight`

### 22. Worker Integration Pattern ✅ COMPLETE
**Purpose**: Efficient delta visualization using existing processed data structures

**Benefits**:
- Performance efficiency, data consistency, memory optimization, maintainability

### 23. Configuration Integration Pattern ✅ COMPLETE
**Purpose**: Seamless integration of delta modes with existing configuration system

**Benefits**:
- Seamless integration, backward compatibility, enhanced functionality

## Configuration Architecture Patterns

### Percentage-to-Decimal Conversion Pattern ✅ COMPLETE
**Purpose**: Standardized conversion for all percentage-based configuration parameters

**Implementation**:
```javascript
// Standard conversion pattern for all parameters
const bigFigureRatio = (config.bigFigureFontSizeRatio || 80) / 100;     // 80 → 0.8
const pipsRatio = (config.pipFontSizeRatio || 100) / 100;               // 100 → 1.0
const pipetteRatio = (config.pipetteFontSizeRatio || 70) / 100;         // 70 → 0.7
```

### Feature Flag Independence Pattern ✅ COMPLETE
**Purpose**: Independent control over individual display features

**Implementation**:
```javascript
// Independent boolean flags for each feature
const config = {
  showPriceBackground: true,      // Background fill control
  showPriceBoundingBox: false,    // Border outline control
  showPipetteDigit: true,        // Pipette digit visibility
  priceUseStaticColor: false,     // Directional vs static coloring
};
```

---

These system patterns provide an architectural foundation for NeuroSense FX's radical floating architecture, ensuring performance, maintainability, and scalability while supporting complex requirements of professional trading interfaces. The patterns represent current active approaches used in production, with historical details archived for reference.

*For historical patterns and detailed evolution documentation, see `memory-bank/archive/`*
