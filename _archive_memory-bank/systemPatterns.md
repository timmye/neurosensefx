# NeuroSense FX - System Patterns

## System Architecture Overview

### High-Level Architecture Pattern
NeuroSense FX follows a **Three-Server Architecture** pattern with a **Model-View-Worker (MVW)** pattern extending traditional MVC with Web Workers for performance:

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
                    │ • Canvas Renders │
                    │ • Web Worker     │
                    │ • Real-time UI   │
                    └─────────────────┘
         │
         └───────────────────────┼───────────────────────┘
                                 │
```

### Component Relationship Pattern

#### Hierarchical Component Structure
```
Frontend Server (Port 5173)
├── App.svelte (Root)
├── Container.svelte (Main Visualization Controller)
│   ├── VizDisplay.svelte (Individual Price Display) × N
│   │   ├── Canvas Element (220×120px)
│   │   ├── Drawing Functions (D3.js + Canvas 2D)
│   │   └── Animation Loop (requestAnimationFrame)
│   └── ConfigPanel.svelte (User Controls)
├── Data Stores (Svelte Stores)
│   ├── configStore.js
│   ├── symbolStateStore.js
│   ├── markerStore.js
│   └── uiStateStore.js
└── Web Worker
    ├── dataProcessor.js
    ├── WebSocket Client
    └── Calculation Engine

Backend Server (Port 8080)
├── WebSocket Server
├── cTrader API Client
├── Data Processing Engine
└── Client Management
```

## Key Design Patterns

### 1. Two-Server Pattern (Frontend/Backend Separation)
**Purpose**: Separate concerns between UI and data processing

**Implementation**:
```javascript
// Frontend Server (Vite)
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

// Backend Server (Node.js)
const wsServer = new WebSocketServer(port, session);
```

**Benefits**:
- Independent scaling of frontend and backend
- Clear separation of UI and data concerns
- Flexible deployment options for development workflows

### 2. Observer Pattern (State Management)
**Purpose**: Reactive updates when data changes

**Implementation**:
```javascript
// Svelte Store Pattern
import { writable, derived } from 'svelte/store';

const symbolStore = writable({});
const activeSymbols = derived(symbolStore, $symbols => 
  Object.keys($symbols).filter(key => $symbols[key].active)
);
```

**Benefits**:
- Automatic UI updates when data changes
- Decoupled components from data sources
- Efficient reactivity with minimal overhead

### 3. Worker Pattern (Data Processing)
**Purpose**: Offload heavy computation from UI thread

**Implementation**:
```javascript
// Frontend Server (Main Thread)
const worker = new Worker('/src/workers/dataProcessor.js');
worker.postMessage({ type: 'PROCESS_TICKS', data: ticks });

// Web Worker Thread
self.onmessage = (event) => {
  const { type, data } = event.data;
  if (type === 'PROCESS_TICKS') {
    const processed = processMarketData(data);
    self.postMessage({ type: 'DATA_READY', data: processed });
  }
};
```

**Benefits**:
- Prevents UI blocking during heavy calculations
- Maintains 60fps rendering under load
- Enables parallel processing of market data

### 4. Canvas Pattern (High-Performance Rendering)
**Purpose**: Efficient visual updates for multiple displays

**Implementation**:
```javascript
// VizDisplay.svelte
function renderDisplay(ctx, data) {
  // Clear canvas
  ctx.clearRect(0, 0, 220, 120);
  
  // Draw visual elements
  drawMarketProfile(ctx, data.profile);
  drawPriceFloat(ctx, data.price);
  drawVolatilityOrb(ctx, data.volatility);
  
  // Schedule next frame
  requestAnimationFrame(() => renderDisplay(ctx, data));
}
```

**Benefits**:
- 20x faster than DOM manipulation
- Hardware-accelerated rendering
- Precise control over visual updates

### 5. PubSub Pattern (Event Communication)
**Purpose**: Loose coupling between components

**Implementation**:
```javascript
// Event Bus Pattern
const eventBus = new EventTarget();

function publish(event, data) {
  eventBus.dispatchEvent(new CustomEvent(event, { detail: data }));
}

function subscribe(event, callback) {
  eventBus.addEventListener(event, (e) => callback(e.detail));
}
```

**Benefits**:
- Components communicate without direct references
- Easy to add/remove event listeners
- Scalable event architecture

### 6. Factory Pattern (Display Creation)
**Purpose**: Consistent creation of visualization displays

**Implementation**:
```javascript
// Display Factory
function createVizDisplay(symbol, config) {
  return {
    symbol,
    config,
    canvas: document.createElement('canvas'),
    ctx: null,
    isActive: true,
    
    init(container) {
      this.canvas.width = 220;
      this.canvas.height = 120;
      this.ctx = this.canvas.getContext('2d');
      container.appendChild(this.canvas);
    },
    
    render(data) {
      renderDisplay(this.ctx, data);
    }
  };
}
```

**Benefits**:
- Consistent display creation
- Encapsulated display logic
- Easy to extend with new display types

## Data Flow Patterns

### 1. Two-Way Data Flow
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

## Performance Patterns

### 1. Object Pooling Pattern
**Purpose**: Minimize garbage collection in render loops

**Implementation**:
```javascript
// Canvas Object Pool
const objectPool = {
  points: [],
  rectangles: [],
  
  getPoint(x, y) {
    const point = this.points.pop() || { x: 0, y: 0 };
    point.x = x;
    point.y = y;
    return point;
  },
  
  releasePoint(point) {
    this.points.push(point);
  }
};
```

### 2. Dirty Rectangle Pattern
**Purpose**: Only update changed canvas regions

**Implementation**:
```javascript
// Dirty Region Tracking
const dirtyRegions = [];

function markDirty(x, y, width, height) {
  dirtyRegions.push({ x, y, width, height });
}

function renderDirtyRegions(ctx) {
  dirtyRegions.forEach(region => {
    // Clear only dirty region
    ctx.clearRect(region.x, region.y, region.width, region.height);
    // Redraw only affected area
    redrawRegion(ctx, region);
  });
  dirtyRegions.length = 0; // Clear array
}
```

### 3. Frame Skipping Pattern
**Purpose**: Maintain performance under heavy load

**Implementation**:
```javascript
let lastFrameTime = 0;
const targetFrameTime = 1000 / 60; // 60fps

function render(currentTime) {
  if (currentTime - lastFrameTime >= targetFrameTime) {
    // Render frame
    updateCanvas();
    lastFrameTime = currentTime;
  }
  
  requestAnimationFrame(render);
}
```

## Error Handling Patterns

### 1. Graceful Degradation Pattern
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
    setTimeout(() => connectWebSocket(url), 5000); // Retry
  };
  
  ws.onclose = () => {
    console.log('WebSocket closed');
    setTimeout(() => connectWebSocket(url), 1000); // Reconnect
  };
  
  return ws;
}
```

### 2. Circuit Breaker Pattern
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
          circuitOpen = false;
          failureCount = 0;
        }, 30000); // Reset after 30 seconds
      }
      throw error;
    })
    .then(response => {
      failureCount = 0; // Reset on success
      return response;
    });
}
```

## Configuration Patterns

### 1. Strategy Pattern (Visualization Modes)
```javascript
// Visualization Strategies
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

function getVolatilityVisualization(mode, data) {
  const strategy = volatilityStrategies[mode];
  return strategy ? strategy(data) : volatilityStrategies.directional(data);
}
```

### 2. Builder Pattern (Display Configuration)
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
    this.config.width = width;
    this.config.height = height;
    return this;
  }
  
  withPriceFloat(enabled) {
    this.config.showPriceFloat = enabled;
    return this;
  }
  
  build() {
    return { ...this.config };
  }
}
```

## Server-Specific Patterns

### 1. Frontend Server Patterns
- **Hot Module Replacement**: Instant code updates during development
- **Proxy Configuration**: Route WebSocket requests to backend
- **Asset Bundling**: Optimize frontend code for production

### 2. Backend Server Patterns
- **WebSocket Management**: Handle multiple client connections
- **Data Streaming**: Real-time market data processing
- **Client State**: Track connection status and subscriptions

These system patterns provide the architectural foundation for NeuroSense FX's two-server architecture, ensuring performance, maintainability, and scalability.
