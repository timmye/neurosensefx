# NeuroSense FX Technical Architecture

## Design Philosophy

**NeuroSense FX** is a financial trading visualization platform focused on effective market data presentation. The system combines abstract visual metaphors with targeted numerical displays, leveraging pattern recognition capabilities while providing precise information when needed.

**Project Technical Philosophy: "Simple, Performant, Maintainable"**

#### Core Principles
- **Simple**: Clear mental models and intuitive component design with predictable behavior patterns
- **Performant**: Efficient rendering for smooth visual updates with responsive data-to-visual updates
- **Maintainable**: Single responsibility components with loose coupling and extensible design

## Current System Architecture

### Technology Stack
- **Frontend**: Svelte 4.x with Vite build system
- **Rendering**: Canvas 2D API with DPR-aware crisp rendering
- **State Management**: Centralized Svelte stores with web workers
- **Backend**: Node.js WebSocket server with cTrader Open API integration
- **Data Processing**: Real-time tick processing with WebSocket streaming

### System Structure
```
neurosensefx/                          # Root repository
├── src/                               # Frontend Svelte application
├── services/tick-backend/             # Node.js WebSocket backend
├── libs/cTrader-Layer/                # cTrader API integration
└── run.sh                             # Unified service management
```

### Three-Layer Display System
- **Layer 1**: Trading displays (z-index: 1-999)
- **Layer 2**: UI panels (z-index: 1000-9999)
- **Layer 3**: Overlays (z-index: 10000+)

## Development Guidelines

### Core Development Principles

**Framework-First Development**
- Before implementing any feature, check if the build tool, framework, or standard library already provides it
- Always consult official documentation for the tools in the project before writing custom code
- Established, centralised frameworks and patterns exist to enable development

### Code Standards

#### Event Handling Pattern
**Use Svelte's declarative event system as the single source of truth:**
```javascript
// ✅ Correct: Svelte modifiers for UI interactions
<canvas on:contextmenu|preventDefault|stopPropagation={handleCanvasContextMenu}></canvas>

// ❌ Wrong: Manual listeners competing with framework
onMount(() => {
  canvas.addEventListener('contextmenu', handler); // Don't do this
});
```

#### Canvas Rendering Best Practices
```javascript
// DPR-aware text rendering
function renderCrispText(ctx, text, x, y, fontSize) {
  const dpr = window.devicePixelRatio;
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
  ctx.fillText(text, x / dpr, y / dpr);
  ctx.restore();
}
```

## Component System

### Current Visualization Components
**Market Profile** (`marketProfile.js`)
- TPO-based volume profiling with delta analysis
- Multiple rendering modes including traditional and volume-based

**Volatility Orb** (`volatilityOrb.js`)
- Dynamic volatility visualization with gradient rendering
- Color modes for volatility and momentum analysis

**Day Range Meter** (`dayRangeMeter.js`)
- ADR reference system with graduated markers
- Price positioning as percentage of daily range

**Price Display System**
- **Price Float** (`priceFloat.js`): Horizontal price line with effects
- **Price Display** (`priceDisplay.js`): Monospaced numeric display
- **Price Markers** (`priceMarkers.js`): User-placed reference points

### Configuration System

**Unified Configuration Architecture**
- Schema-driven parameters in `src/data/schema.js`
- Global configuration through `displayStore.defaultConfig`
- New displays inherit current runtime settings automatically
- Real-time configuration updates without restart

## Development Workflow

### Service Management
```bash
./run.sh dev       # Development with HMR (frontend 5174 + backend 8080)
./run.sh start     # Production mode (frontend 4173 + backend 8081)
./run.sh stop      # Stop all services
./run.sh status    # Check service health
./run.sh logs      # View service logs
```

### Environment Configuration
- **Development**: Vite dev server with HMR on port 5174, WebSocket on 8080
- **Production**: Optimized builds on port 4173, WebSocket on 8081
- **Environment variables**: Set in `.env` file for cTrader API credentials

## Performance Considerations

### Rendering Optimizations
- DPR-aware text rendering for crisp display across devices
- RequestAnimationFrame for smooth 60fps updates
- Web Workers for heavy computation off main thread
- Dirty rectangle rendering where possible

### Memory Management
- Object lifecycle management to minimize pressure
- Dynamic resource allocation based on active display count
- Efficient update frequency for market data processing

### WebSocket Communication
- Connection management with automatic reconnection
- Structured message protocol for reliable data delivery
- Heartbeat mechanism for connection health monitoring

## Implementation Patterns

### State Management
```javascript
// Centralized store with global configuration
export const displayStore = writable({
  displays: new Map(),
  activeDisplays: [],
  defaultConfig: getEssentialDefaultConfig(),
  workspace: { layout: [], preferences: {} }
});
```

### Component Architecture
- Single responsibility principle with clear interfaces
- Configuration inheritance from runtime defaults
- Event-driven communication patterns
- Graceful degradation for edge cases

## Current Status

**Production Maturity**: ~65% complete, functional for development and testing

**Current Capabilities**:
- ✅ Real-time FX market data visualization via cTrader integration
- ✅ Multiple display types with configuration management
- ✅ Drag-and-drop workspace management with persistence
- ✅ Environment-aware development and production modes
- ✅ Canvas rendering with DPR-aware text

**Development Environment**:
- HMR-enabled development workflow
- Comprehensive service management and monitoring
- Browser zoom awareness and responsive design

---

**NeuroSense FX** - Financial trading visualization platform focused on effective market data presentation.