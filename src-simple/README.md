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