# NeuroSense FX Technical Architecture

## Purpose and User Context

**Who this is for:** Foreign exchange traders who monitor multiple currency pairs during extended trading sessions (8+ hours).

**What problem it solves:** Standard trading platforms require constant analytical processing of numerical data. This platform provides visual patterns for quick understanding while monitoring multiple instruments.

**How it's used:**
- Multi-display workspace for watching 5-20 currency pairs simultaneously
- Keyboard-first interaction for rapid response during active trading
- Extended sessions requiring low eye strain and mental fatigue
- Visual patterns for immediate understanding, with detailed numbers available when needed

**Core approach:** Visual metaphors combined with targeted numerical displays. Users glance at patterns for market state understanding and access precise values when required for analysis.

## Design Philosophy

**Project Technical Philosophy: "Simple, Performant, Maintainable"**

#### **SIMPLE** - Clear mental models and predictable behavior
- Intuitive components that behave consistently
- Minimal complexity in implementation
- Self-documenting code structure

#### **PERFORMANT** - Handles professional trading requirements
- 60fps rendering for smooth visual updates during price movements
- Sub-100ms latency so displays feel responsive during active trading
- Supports 20+ concurrent displays for multi-instrument monitoring
- 8+ hour session stability without performance degradation

#### **MAINTAINABLE** - Reliable when it matters
- Single responsibility components with clear interfaces
- Loose coupling for independent development and testing
- Extensible design for adding new visualization types

**Project Development Principles**

**Framework-First Development:** Check existing tools, frameworks, and libraries before implementing custom solutions. Consult official documentation and established patterns in the codebase.

**Project Philosophy: Build Once, Use Everywhere**
- Prefer centralized utility functions over duplicated implementations
- When creating a new helper or pattern, make it reusable across components
- Document and test shared utilities as first-class citizens
- Build for composition: small, focused utilities that combine to solve complex problems

**Centralized Development Patterns**
The project provides centralized utilities documented in focused files. Before creating custom implementations:

- **Configuration:** See `src/config/CONFIGURATION_ARCHITECTURE.md`
- **Rendering:** See `src/lib/viz/DPR_RENDERING_SYSTEM.md` and `src/lib/viz/DPR_EXAMPLES.md`
- **Communication:** See `docs/WEB_WORKER_COMMUNICATION_PROTOCOL.md`
- **State Management:** Refer to component-specific documentation

**Creating New Utilities:** If 3+ components need similar functionality, create centralized utilities with clear documentation and tests.

## Development Decision Framework

When making implementation decisions, use this framework to ensure alignment with user needs and technical goals:

### **Simple Considerations**
- Does this component have a clear, single purpose?
- Is the API intuitive and predictable?
- Will other developers understand this quickly?
- Does it follow established patterns in the codebase?

### **Performant Considerations**
- Does this maintain 60fps with 20+ displays?
- Does data-to-visual update complete in under 100ms?
- Is memory usage reasonable for extended sessions?
- Will this scale to professional trading usage?

### **Maintainable Considerations**
- Can this component be tested independently?
- Does changing this component affect others?
- Can new visualization types be added using this pattern?
- Is the code structure clear and documented?

### **User Context Check**
- Does this support monitoring multiple currency pairs?
- Can this be used effectively for extended trading sessions?
- Does keyboard-first interaction work for this feature?
- Will this remain responsive during active trading?

## User Workflows This System Supports

### **Multi-Instrument Monitoring**
- Traders watch 5-20 currency pairs simultaneously
- Each display shows one instrument with multiple visualization layers
- Layout is organized for efficient scanning and pattern recognition
- Visual relationships between instruments support correlation analysis

### **Extended Trading Sessions**
- 8+ hour continuous use during market hours
- Visual comfort and reduced eye strain are essential
- Interface must remain responsive throughout long sessions
- Memory and CPU efficiency prevent degradation over time

### **Rapid Response Requirements**
- Keyboard-first interaction for efficiency during active trading
- Real-time updates during volatile market periods
- Immediate feedback for user interactions
- Smooth visual transitions for price movement tracking

### **Analysis and Decision Support**
- Visual patterns provide quick market state information
- Detailed numerical data available for specific analysis
- Configuration options adapt to different trading strategies
- Historical context assists with current market positioning

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

### Code Standards

#### Event Handling Pattern
**Use Svelte's declarative event system** - prefer modifiers like `on:contextmenu|preventDefault|stopPropagation` over manual `addEventListener`.

#### Canvas Rendering Best Practices
**DPR-aware rendering** - scale canvas context for crisp text (see `src/lib/viz/DPR_RENDERING_SYSTEM.md` for examples).

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
- Schema-driven parameters (see `src/config/CONFIGURATION_ARCHITECTURE.md`)
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

## Development Approach

### **Key Implementation Principles**
- **Centralize before you create**: Check existing utilities and patterns first
- **Keyboard-first interaction**: Essential for rapid trading workflows
- **Visual patterns first**: Users glance at patterns, then access detailed numbers
- **Progressive disclosure**: Complexity increases with user engagement level
- **Document new patterns**: When creating reusable utilities, add them to centralized documentation



## Testing

**Running Tests:**
```bash
npm run test          # Run unit tests
npm run test:e2e      # Run end-to-end tests (Playwright)
```

**Key Testing Areas:**
- Canvas rendering with multiple displays (20+)
- WebSocket connection stability and reconnection
- Configuration inheritance and persistence
- Keyboard accessibility for all interactions

## Contributing

**Development Workflow:**
1. Use `./run.sh dev` for development with hot reload
2. Follow "Simple, Performant, Maintainable" decision framework
3. Check existing utilities before creating new ones
4. Test with realistic conditions (multiple displays, extended sessions)
5. Document new patterns and utilities

**Code Standards:**
- Framework-first development approach
- Keyboard-first interaction design
- DPR-aware canvas rendering
- Centralized utility functions

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