# NeuroSense FX Architecture

## Core Philosophy & Principles

**Framework First**: Use framework primitives directly. Never build what frameworks already provide.

**Simple, Performant, Maintainable**: Every architectural decision serves these three principles.

### Natural Simplicity Principle
Code complexity is a result, not a constraint. Simplicity emerges from:
- **Single responsibility**: Each component has one clear purpose
- **Framework utilization**: Use what frameworks provide
- **No artificial constraints**: Let architecture naturally produce right-sized code

## Current Architecture

### Framework Responsibility Map

```
┌─────────────────────────────────────────────────────────────┐
│                    FRAMEWORK ARCHITECTURE                   │
│                                                             │
│  USER INTERACTION                                           │
│  ┌──────────────┐                                          │
│  │ interact.js  │  ← Drag, drop, resize                    │
│  └──────┬───────┘                                          │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐                                          │
│  │   Svelte     │  ← Reactive UI, components, state       │
│  └──────┬───────┘                                          │
│         │                                                   │
│         ├─────────────┬──────────────┬──────────────┐     │
│         ▼             ▼              ▼              ▼      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Canvas   │  │WebSocket │  │localStorage│  │  Vite    │  │
│  │   2D     │  │   API    │  │    API     │  │  (Dev)   │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│       │              │              │              │        │
│       ▼              ▼              ▼              ▼        │
│  Rendering      Real-time     Persistence     Build/HMR   │
│   DPR-aware      data flow     State saved    Fast reload │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      DATA FLOW                              │
│                                                             │
│  WebSocket Server                                           │
│        │                                                     │
│        │ JSON over WebSocket                                │
│        ▼                                                     │
│  ┌──────────────────┐                                       │
│  │ connectionManager│  Receives tick data                   │
│  │      .js         │  Auto-reconnection + status          │
│  └─────────┬────────┘                                       │
│            │                                                │
│            │ Calls displayDataProcessor callback            │
│            ▼                                                │
│  ┌──────────────────┐                                       │
│  │displayDataProcessor│ Data formatting & processing        │
│  │      .js         │  Symbol formatting                   │
│  └─────────┬────────┘                                       │
│            │                                                │
│            │ Updates Svelte store                           │
│            ▼                                                │
│  ┌──────────────────┐                                       │
│  │ FloatingDisplay  │  Component receives data             │
│  │   .svelte        │  Via $workspace store                 │
│  └─────────┬────────┘                                       │
│            │                                                │
│            │ Passes to visualization registry              │
│            ▼                                                │
│  ┌──────────────────┐                                       │
│  │visualization     │  Gets renderer from registry          │
│  │    Registry      │  Calls render function                │
│  │      .js         │                                       │
│  └─────────┬────────┘                                       │
│            │                                                │
│            │ Calls specific renderer                       │
│            ▼                                                │
│  ┌──────────────────┐                                       │
│  │dayRangeOrchestrator│ Renders via modular system          │
│  │      .js         │  DPR-aware Canvas 2D API              │
│  └─────────┬────────┘                                       │
│            │                                                │
│            ▼                                                │
│  Canvas Element (Visual output)                            │
└─────────────────────────────────────────────────────────────┘
```

### State Management Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    STATE ARCHITECTURE                       │
│                                                             │
│  ┌──────────────────────────────────────────┐              │
│  │         workspace.js (Single Store)      │              │
│  │                                          │              │
│  │  {                                       │              │
│  │    displays: Map<id, Display>,           │              │
│  │    symbols: Set<string>,                 │              │
│  │    activeId: string,                     │              │
│  │    config: {...},                        │              │
│  │    errors: []                            │              │
│  │  }                                       │              │
│  └──────────────────────────────────────────┘              │
│         │                                                   │
│         │ Svelte reactivity ($workspace)                   │
│         │                                                   │
│         ├─────────┬─────────┬─────────┬─────────┐         │
│         ▼         ▼         ▼         ▼         ▼          │
│  ┌──────────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐            │
│  │Workspace │ │Display││Display││Display││Display│            │
│  │ .svelte  │ │   1   │ │  2   │ │  3   │ │  N   │            │
│  └──────────┘ └─────┘ └─────┘ └─────┘ └─────┘            │
│                                                             │
│  ALL components subscribe to same store                    │
│  NO component-to-component communication                   │
│  NO prop drilling beyond one level                         │
└─────────────────────────────────────────────────────────────┘
```
## File Structure

```
src-simple/
├── App.svelte                    → 8 lines - Minimal app entry point
├── main.js                       → 6 lines - Svelte initialization
│
├── stores/
│   └── workspace.js              → 127 lines - Svelte writable store + persistence
│
├── components/
│   ├── Workspace.svelte          → 96 lines - Main container + keyboard navigation
│   ├── FloatingDisplay.svelte    → 111 lines - Display component + interact.js + Canvas + WebSocket
│   └── displays/
│       ├── DisplayHeader.svelte   → Display title and controls
│       └── DisplayCanvas.svelte   → Canvas rendering with visualization registry
│
├── lib/
│   ├── visualizers.js            → 22 lines - Visualization registry and exports
│   ├── visualizationRegistry.js  → 23 lines - Simple registration system
│   │
│   ├── Connection Management
│   │   ├── connectionManager.js  → 46 lines - WebSocket connection with auto-reconnection
│   │   └── displayDataProcessor.js → 45 lines - Data processing and symbol formatting
│   │
│   ├── Day Range Meter Subsystem (16 files, ~800 lines)
│   │   ├── dayRangeCore.js       → Canvas setup and DPR handling
│   │   ├── dayRangeConfig.js     → Configuration management
│   │   ├── dayRangeCalculations.js → Mathematical calculations
│   │   ├── dayRangeElements.js   → UI element rendering
│   │   ├── dayRangeRenderingUtils.js → Rendering utilities
│   │   ├── dayRangeOrchestrator.js → 65 lines - Main coordination
│   │   └── [Specialized renderers for price markers, percentage markers, ADR boundaries]
│   │
│   ├── Market Profile Subsystem (6 files, ~8,000 lines)
│   │   ├── marketProfile.js      → Main market profile visualization
│   │   ├── marketProfileCore.js  → Core functionality
│   │   ├── marketProfileBars.js  → Bar rendering
│   │   ├── marketProfileData.js  → Data processing
│   │   ├── marketProfilePOC.js   → Point of Control rendering
│   │   └── marketProfileRenderers.js → Rendering utilities
│   │
│   └── [Utility modules]         → Single-responsibility helpers
│
└── vite.config.js                → Vite configuration
```

## Implementation Patterns

### Framework Usage Rules

#### ✅ Svelte (UI & State)
**Use Svelte for:**
- All UI components
- All reactive state (`writable`, `derived`)
- Component lifecycle (`onMount`, `onDestroy`)
- Event handling (`on:click`, `on:keydown`)
- Props and binding
- Conditional rendering (`{#if}`, `{#each}`)

**Never:**
- ❌ Build custom reactivity systems
- ❌ Use Redux, MobX, or other state libraries
- ❌ Create event emitters (use Svelte events)

#### ✅ interact.js (Drag & Drop)
**Use interact.js for:**
- Dragging displays (`draggable()`)
- Resizing displays (`resizable()`)
- Gesture handling (`gesturable()`)
- Drop targets (`dropzone()`)

**Never:**
- ❌ Build custom drag logic
- ❌ Use mousedown/mousemove manually
- ❌ Create gesture recognizers
- ❌ Build snap-to-grid (use interact.js modifiers)

#### ✅ Canvas 2D API (Rendering)
**Use Canvas for:**
- All visualizations
- DPR-aware rendering
- Text rendering
- Shape drawing

**Never:**
- ❌ Use Chart.js, D3 for rendering (too heavy)
- ❌ Build custom rendering engines
- ❌ Use SVG (Canvas is faster for real-time)
- ❌ Forget DPR scaling

#### ✅ WebSocket API (Real-time Data)
**Use WebSocket for:**
- Real-time price data
- Connection management
- Data subscription

**Never:**
- ❌ Use Socket.io (too heavy)
- ❌ Use polling instead of WebSocket
- ❌ Build custom protocol (use JSON)

#### ✅ localStorage API (Persistence)
**Use localStorage for:**
- Workspace state persistence
- User preferences
- Display positions

**Never:**
- ❌ Use IndexedDB (too complex for our needs)
- ❌ Use cookies (wrong use case)
- ❌ Build custom storage abstraction

#### ✅ Vite (Build & Dev)
**Vite provides:**
- Hot module replacement (HMR)
- Fast dev server
- Production builds
- Asset optimization

### Common Implementation Patterns

#### Pattern 1: Display Creation
```javascript
// In workspace.js (Svelte store)
export function addDisplay(symbol, position) {
  workspace.update(state => {
    const id = crypto.randomUUID();
    state.displays.set(id, {
      id,
      symbol,
      position,
      size: { width: 220, height: 120 }
    });
    return state;
  });
}
```

#### Pattern 2: Canvas Rendering
```javascript
// In visualization module
export function renderDayRange(canvas, data) {
  // Setup
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.scale(dpr, dpr);

  // Draw
  ctx.fillStyle = '#4CAF50';
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
}
```

#### Pattern 3: WebSocket Subscription
```javascript
// In component lifecycle
onMount(() => {
  const unsubscribe = wsClient.subscribe(display.symbol, (data) => {
    renderVisualization(canvas, data);
  });

  return () => unsubscribe();
});
```

#### Pattern 4: Drag Handling
```javascript
// In component lifecycle
onMount(() => {
  interact(element).draggable({
    listeners: {
      move(event) {
        workspace.updatePosition(display.id, event.dx, event.dy);
      }
    }
  });

  return () => interact(element).unset();
});
```

## Visualization Registry System

The **Visualization Registry** provides a pluggable system for adding new visualizations.

### Core Registry Pattern

```javascript
// visualizationRegistry.js
const visualizations = new Map();

export function register(type, renderer) {
  visualizations.set(type, renderer);
}

export function get(type) {
  return visualizations.get(type);
}

export function getAll() {
  return Array.from(visualizations.keys());
}
```

### Registration and Usage

```javascript
// 1. Create renderer function
export function renderNewVisualization(ctx, data, { width, height }) {
  const dpr = window.devicePixelRatio || 1;
  // DPR-aware rendering implementation
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, width, height);
  // ... visualization logic
}

// 2. Register in visualizers.js
import { renderNewVisualization } from './visualizations/newVisualization.js';
register('newVisualization', renderNewVisualization);

// 3. Use in component
import { get } from '../visualizationRegistry.js';
const renderer = get(displayType);
if (renderer) {
  renderer(ctx, data, { width, height });
}
```

### File Structure Pattern for New Visualizations
```
visualizations/newVisualization/
├── newVisualizationCore.js       → Canvas setup and DPR handling
├── newVisualizationConfig.js     → Configuration management
├── newVisualizationCalculations.js → Mathematical calculations
├── newVisualizationElements.js   → UI element rendering
├── newVisualizationRenderUtils.js → Rendering utilities
└── index.js                      → Main export and registration
```

## Compliance Standards

### Line Count Limits
**Essential for maintaining architectural integrity:**

#### File Size Standards
- **Individual Files**: <120 lines maximum (enforceable standard)
- **Core Components**: <100 lines preferred (target range)
- **Utility Functions**: <50 lines ideal (natural result of single responsibility)

#### Function Size Standards
- **Individual Functions**: <15 lines maximum (enforceable standard)
- **Simple Functions**: <10 lines preferred (natural result)
- **Complex Functions**: <20 lines maximum (requires justification)

### Critical Rules
- ✅ Single store for ALL state
- ✅ Components read via `$workspace`
- ✅ Components write via `workspace.update()`
- ✅ Framework primitives used directly
- ❌ Never component-to-component state sharing
- ❌ Never multiple stores
- ❌ Never prop drilling >1 level
- ❌ Never rebuild framework features

### Framework Decision Tree

When implementing a feature, follow this decision tree:

```
Need to implement [FEATURE]
    │
    ├─ Is it UI/state?
    │  └─ YES → Use Svelte
    │
    ├─ Is it drag/drop/resize?
    │  └─ YES → Use interact.js
    │
    ├─ Is it visual rendering?
    │  └─ YES → Use Canvas 2D API
    │
    ├─ Is it real-time data?
    │  └─ YES → Use WebSocket API
    │
    ├─ Is it persistence?
    │  └─ YES → Use localStorage API
    │
    └─ Is it build/dev?
       └─ YES → Use Vite

If none of above:
    → Question if feature is MUST HAVE
    → Check if framework provides it
    → Only then consider custom code
```


```

## Developer Quick Start

### For Adding New Visualizations

**Step 1: Create Modular Structure**
```javascript
// Follow the 5-6 file pattern established by Day Range Meter
visualizations/newVisualization/
├── newVisualizationCore.js       → Canvas + DPR setup (≤120 lines)
├── newVisualizationConfig.js     → Configuration management (≤120 lines)
├── newVisualizationElements.js   → UI element rendering (≤120 lines)
├── newVisualizationUtils.js      → Utility functions (≤120 lines)
└── index.js                      → Exports and registration (≤50 lines)
```

**Step 2: Framework-First Implementation**
```javascript
// Use Canvas 2D directly - no rendering libraries
export function renderNewVisualization(ctx, data, { width, height }) {
  const dpr = window.devicePixelRatio || 1;
  // DPR-aware implementation
  // Each function ≤15 lines
}
```

**Step 3: Registry Integration**
```javascript
// Register in visualizers.js
import { renderNewVisualization } from './visualizations/newVisualization/index.js';
register('newVisualization', renderNewVisualization);
```

**Step 4: Configuration Inheritance**
```javascript
// Use the established pattern
const config = createVisualizationConfig(s, width, height, getConfig);
```

### Critical Success Factors
1. **Framework Compliance**: Always check what frameworks provide first
2. **Single Responsibility**: One clear purpose per file and function
3. **DPR Awareness**: All Canvas rendering must handle device pixel ratio
4. **Configuration Inheritance**: Use the `getConfig()` pattern for runtime settings
5. **Professional Focus**: Built for actual FX traders during active trading sessions

### Testing Requirements
- **Real Browser Testing**: Use `npm run test:e2e` with actual application
- **Performance Validation**: 60fps rendering with 20+ concurrent displays
- **Trading Workflow**: Validate with actual trader interactions (Ctrl+K, drag-resize, ESC navigation)

## Anti-Patterns (Never Do This)

### ❌ Building What Frameworks Provide
```javascript
// DON'T: Custom drag logic
let isDragging = false;
element.addEventListener('mousedown', () => isDragging = true);

// DO: Use interact.js
interact(element).draggable({
  onmove: (event) => updatePosition(event.dx, event.dy)
});
```

### ❌ Wrapping Framework APIs
```javascript
// DON'T: Canvas abstraction
class CanvasRenderer {
  drawRect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }
}

// DO: Use Canvas 2D directly
ctx.fillStyle = color;
ctx.fillRect(x, y, w, h);
```

### ❌ Custom State Management
```javascript
// DON'T: Event emitters
class StateEmitter {
  listeners = [];
  emit(event) { /* ... */ }
}

// DO: Use Svelte stores
export const workspace = writable({});
```

### ❌ JavaScript Style Overrides
```javascript
// DON'T: Override CSS with JavaScript
canvas.style.position = 'absolute';
canvas.style.top = '-2px';

// DO: Use CSS container approach
<div class="canvas-container">
  <canvas bind:this={canvas} />
</div>
```

## Summary: Framework-First Philosophy

**The frameworks do the heavy lifting:**
- Svelte: UI and state
- interact.js: Drag and drop
- Canvas 2D: Rendering
- WebSocket: Real-time data
- localStorage: Persistence
- Vite: Build and dev

**We provide:**
- Business logic (what to render, when)
- Data flow (how pieces connect)
- User workflows (trading features)
- Compliance validation (maintain standards)
- Visualization registry (pluggable system)

**We never:**
- Rebuild framework features
- Wrap frameworks unnecessarily
- Fight framework patterns
- Violate compliance standards

**Result:**
- Naturally simple code that meets compliance standards
- ~0 lines of framework re-implementation
- 100% maintainability through framework stability
- Professional trading platform operational