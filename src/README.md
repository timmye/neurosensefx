# Simple Implementation

This directory contains the crystal-clear implementation of NeuroSense FX's three MUST HAVEs.

## Principles

1. **Simple**: Each file does ONE thing
2. **Performant**: Sub-100ms interaction latency
3. **Maintainable**: Readable in under 1 hour

## Line Count Targets (HARD LIMITS)

- `stores/workspace.js`: 150 lines MAX
- `components/Workspace.svelte`: 80 lines MAX
- `components/FloatingDisplay.svelte`: 100 lines MAX
- `lib/visualizers.js`: 60 lines MAX

**Total Target**: 390 lines for all three MUST HAVEs

## The Three MUST HAVEs

### MUST HAVE 1: Establish Floating Interface Workspace
- Draggable workspace container
- Position persistence via localStorage
- Basic z-index management

### MUST HAVE 2: Create Interactive Floating Element
- Individual draggable displays
- Basic resize capability
- Focus management

### MUST HAVE 3: Show Live Visualizations Inside
- Canvas rendering with DPR awareness
- WebSocket real-time data integration
- Day Range Meter visualization

## Rules for Implementation

### ALLOWED:
- Framework documentation (Svelte, interact.js, Canvas API)
- Reading src/ ONLY for data shapes and types
- Using Plan 1 code examples as starting templates

### FORBIDDEN:
- Copying implementation patterns from src/
- Building abstractions or utility layers
- Adding validation, monitoring, or performance infrastructure
- "Improving" existing complex patterns

## Framework Usage

**Svelte Stores**: Single source of truth
- Use writable() for workspace state
- No derived stores unless absolutely necessary
- No complex synchronization logic

**interact.js**: Direct usage
- draggable() for movement
- resizable() for sizing
- No custom wrappers or abstractions

**Canvas Rendering**: DPR-aware basics
- Standard Canvas 2D API
- Device pixel ratio handling
- No custom rendering engines

**WebSocket**: Direct data flow
- Subscribe to symbol data
- Render on data receive
- No worker processing initially
## Development

**Start (Recommended for Shadow Implementation):**
```bash

Development Environment:
```bash
# From project root (not /src-simple)
./run.sh backend 
./run.sh dev-simple

# Opens:
# - Backend: ws://localhost:8080
# - Frontend: http://localhost:5175 (Simple front end)
# Stop: ./run.sh stop
```

### Crystal Clarity Frontend Testing
```bash
# Enhanced Console Monitoring
npm run test:console             # Comprehensive console logging analysis
npm run test:console:headed      # Console monitoring with visible browser
npm run test:console:ui          # Interactive console debugging with UI
```

### Enhanced Console Monitoring System
The enhanced console monitoring provides comprehensive system visibility with emoji-based classification:

**Features:**
- 🌐 **Network Activity**: HTTP requests, WebSocket connections, API calls
- ⌨️ **User Interactions**: Keyboard events, mouse actions, shortcut processing
- ❌ **System Errors**: JavaScript errors, component failures, initialization issues
- ✅ **Success Events**: Successful operations, completed workflows
- 🔥 **Critical Issues**: Server errors, network failures, system crashes
- ⚠️ **Warnings**: Deprecation notices, performance warnings
- 💡 **Debug Information**: Development logs, performance metrics
- 📦 **Asset Loading**: Static resource requests, module loading

**Quick Console Debugging:**
```bash
npm run test:console              # Full console analysis with classification
npm run test:console:headed       # See browser activity in real-time
npm run test:console:ui           # Interactive debugging interface
```

## Usage Instructions

**Creating Displays:**
- Press **Alt+A** to create a new trading display
- Enter a currency symbol (e.g., EUR/USD, GBP/USD)
- Display appears as a draggable floating window

**Interactive Features:**
- Drag displays by their headers to reposition
- Click the × button to close displays
- Displays automatically persist between sessions