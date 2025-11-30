# Simple Implementation Architecture

## Core Philosophy

**Framework First**: Use framework primitives directly. Never build what frameworks already provide.

**Simple, Performant, Maintainable**: Every architectural decision serves these three principles.

## Natural Simplicity Principle

**Code complexity is a result, not a constraint.**

Simplicity emerges from:
- **Single responsibility**: Each component has one clear purpose
- **Framework utilization**: Use what frameworks provide
- **No artificial constraints**: Let architecture naturally produce right-sized code

## Compliance Standards

**Tiered Line Count Limits**: Essential for maintaining Crystal Clarity architecture compliance

### File Size Standards
- **Individual Files**: <120 lines maximum (enforceable standard)
- **Core Components**: <100 lines preferred (target range)
- **Utility Functions**: <50 lines ideal (natural result of single responsibility)

### Function Size Standards
- **Individual Functions**: <15 lines maximum (enforceable standard)
- **Simple Functions**: <10 lines preferred (natural result)
- **Complex Functions**: <20 lines maximum (requires justification)

### Compliance Enforcement
All code must pass architectural compliance checks:
```javascript
// Compliance Check Function
function checkFileCompliance(fileContent) {
  const lines = fileContent.split('\n').length;
  const functions = extractFunctions(fileContent);

  return {
    fileCompliant: lines <= 120,
    functionsCompliant: functions.every(f => f.lines <= 15),
    complexityScore: calculateComplexity(fileContent)
  };
}
```

### Architectural Balance: Standards vs Natural Simplicity

The Crystal Clarity principle balances two concepts:

**1. Compliance Standards** (Required):
- Enforceable limits that maintain architectural integrity
- Prevent complexity creep during scaling
- Provide clear boundaries for team development

**2. Natural Simplicity** (Guiding Philosophy):
- Architecture should naturally produce appropriately sized components
- Single responsibility should naturally lead to focused functions
- Standards validate natural simplicity, don't create it

### Implementation Strategy
```
✅ FIRST: Design with single responsibility
✅ SECOND: Let architecture naturally determine boundaries
✅ THIRD: Validate against compliance standards
✅ RESULT: Naturally simple code that meets standards
```

### Natural Emergence
- **Week 0 Result**: 7 files, 252 lines total (naturally simple)
- **No artificial limits imposed**
- **Architecture produced simplicity, not constraints

### Compliance Reality Check
**Week 0 files demonstrate need for compliance standards:**
- `visualizers.js`: 211 lines (exceeds 120-line standard)
- `FloatingDisplay.svelte`: 180 lines (exceeds 120-line standard)

**Analysis**: These files demonstrate natural architectural boundaries
- **Solution for Week 1**: Split large files during implementation
- **Lesson learned**: Single responsibility leads to natural file sizes
- **Compliance standard validated**: Some natural boundaries need enforced splitting**

---

## Framework Responsibility Map

### What Each Framework Does

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

---

## Framework Usage Rules

### ✅ Svelte (UI & State)

**Use Svelte for:**
- All UI components
- All reactive state (`writable`, `derived`)
- Component lifecycle (`onMount`, `onDestroy`)
- Event handling (`on:click`, `on:keydown`)
- Props and binding
- Conditional rendering (`{#if}`, `{#each}`)

**Example:**
```svelte
<script>
  import { workspace } from '../stores/workspace.js';
  
  function handleClick() {
    workspace.update(state => {
      // Direct state update
      return state;
    });
  }
</script>

<div on:click={handleClick}>
  {#each $workspace.displays as display}
    <Display {display} />
  {/each}
</div>
```

**Never:**
- ❌ Build custom reactivity systems
- ❌ Use Redux, MobX, or other state libraries
- ❌ Create event emitters (use Svelte events)

---

### ✅ interact.js (Drag & Drop)

**Use interact.js for:**
- Dragging displays (`draggable()`)
- Resizing displays (`resizable()`)
- Gesture handling (`gesturable()`)
- Drop targets (`dropzone()`)

**Example:**
```javascript
import interact from 'interactjs';

interact(element)
  .draggable({
    listeners: {
      move(event) {
        // Update position directly
        const x = parseFloat(element.dataset.x) + event.dx;
        const y = parseFloat(element.dataset.y) + event.dy;
        element.style.transform = `translate(${x}px, ${y}px)`;
        element.dataset.x = x;
        element.dataset.y = y;
      }
    }
  })
  .resizable({
    edges: { right: true, bottom: true },
    listeners: {
      move(event) {
        // Update size directly
        element.style.width = `${event.rect.width}px`;
        element.style.height = `${event.rect.height}px`;
      }
    }
  });
```

**Never:**
- ❌ Build custom drag logic
- ❌ Use mousedown/mousemove manually
- ❌ Create gesture recognizers
- ❌ Build snap-to-grid (use interact.js modifiers)

---

### ✅ Canvas 2D API (Rendering)

**Use Canvas for:**
- All visualizations
- DPR-aware rendering
- Text rendering
- Shape drawing

**Example:**
```javascript
export function renderVisualization(canvas, data) {
  // 1. Setup with DPR
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  
  // 2. Draw directly with Canvas API
  ctx.fillStyle = '#4CAF50';
  ctx.fillRect(10, 10, 100, 50);
  
  ctx.font = '12px monospace';
  ctx.fillText('Price: 1.2345', 20, 30);
}
```

**Never:**
- ❌ Use Chart.js, Use D3 for rendering  (too heavy)
- ❌ Build custom rendering engines
- ❌ Use SVG (Canvas is faster for real-time)
- ❌ Forget DPR scaling

---

### ✅ WebSocket API (Real-time Data)

**Use WebSocket for:**
- Real-time price data
- Connection management
- Data subscription

**Example:**
```javascript
export class WebSocketClient {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.subscriptions = new Map();
    
    this.ws.onopen = () => console.log('Connected');
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const callback = this.subscriptions.get(data.symbol);
      if (callback) callback(data);
    };
    this.ws.onerror = (error) => this.handleError(error);
    this.ws.onclose = () => this.reconnect();
  }
  
  subscribe(symbol, callback) {
    this.subscriptions.set(symbol, callback);
    this.ws.send(JSON.stringify({ action: 'subscribe', symbol }));
  }
}
```

**Never:**
- ❌ Use Socket.io (too heavy)
- ❌ Use polling instead of WebSocket
- ❌ Build custom protocol (use JSON)

---

### ✅ localStorage API (Persistence)

**Use localStorage for:**
- Workspace state persistence
- User preferences
- Display positions

**Example:**
```javascript
export function saveWorkspace(state) {
  const serialized = JSON.stringify({
    displays: Array.from(state.displays.entries()),
    config: state.config
  });
  localStorage.setItem('workspace', serialized);
}

export function loadWorkspace() {
  const stored = localStorage.getItem('workspace');
  if (!stored) return null;
  
  const data = JSON.parse(stored);
  return {
    displays: new Map(data.displays),
    config: data.config
  };
}
```

**Never:**
- ❌ Use IndexedDB (too complex for our needs)
- ❌ Use cookies (wrong use case)
- ❌ Build custom storage abstraction

---

### ✅ Vite (Build & Dev)

**Vite provides:**
- Hot module replacement (HMR)
- Fast dev server
- Production builds
- Asset optimization

**Configuration:**
```javascript
// vite.config.js
export default {
  build: {
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false
  },
  server: {
    port: 5173,
    hmr: true
  }
}
```

**Never:**
- ❌ Use Webpack (Vite is simpler)
- ❌ Build custom bundler
- ❌ Create complex build scripts

---

## Component-Framework Integration

### How Components Use Frameworks

```
FloatingDisplay.svelte
├─ Svelte
│  ├─ Component structure
│  ├─ Reactive state ($workspace)
│  └─ Lifecycle (onMount, onDestroy)
│
├─ interact.js
│  ├─ Draggable setup
│  └─ Resizable setup
│
├─ Canvas 2D
│  ├─ Visualization rendering
│  └─ DPR scaling
│
└─ WebSocket
   └─ Data subscription
```

**Example integration:**
```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import interact from 'interactjs';
  import { workspace } from '../stores/workspace.js';
  import { renderDayRange } from '../lib/visualizations/dayRangeMeter.js';
  import { wsClient } from '../lib/data/websocket.js';
  
  export let display;
  
  let canvas;
  let element;
  let unsubscribe;
  
  onMount(() => {
    // interact.js: Setup drag
    interact(element).draggable({
      onmove: (event) => {
        workspace.updatePosition(display.id, event.dx, event.dy);
      }
    });
    
    // Canvas: Setup rendering
    const ctx = setupCanvas(canvas);
    
    // WebSocket: Subscribe to data
    unsubscribe = wsClient.subscribe(display.symbol, (data) => {
      renderDayRange(ctx, data);
    });
  });
  
  onDestroy(() => {
    interact(element).unset();
    if (unsubscribe) unsubscribe();
  });
</script>

<div bind:this={element} class="floating-display">
  <canvas bind:this={canvas} />
</div>
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      DATA FLOW                              │
│                                                             │
│  WebSocket Server                                           │
│        │                                                     │
│        │ JSON over WebSocket                                │
│        ▼                                                     │
│  ┌──────────────┐                                           │
│  │ websocket.js │  Receives tick data                       │
│  └──────┬───────┘                                           │
│         │                                                    │
│         │ Calls callback                                    │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │FloatingDisplay│  Component receives data                 │
│  │   .svelte    │                                           │
│  └──────┬───────┘                                           │
│         │                                                    │
│         │ Passes to renderer                                │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │dayRangeMeter │  Renders to canvas                        │
│  │     .js      │                                           │
│  └──────────────┘                                           │
│         │                                                    │
│         ▼                                                    │
│  Canvas Element (Visual output)                            │
└─────────────────────────────────────────────────────────────┘

KEY POINTS:
- Direct flow, no middleware
- No data transformations unless necessary
- Canvas renders immediately
- No batching (real-time requirement)
```

---

## State Management Architecture

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

**Critical Rules:**
- ✅ Single store for ALL state
- ✅ Components read via `$workspace`
- ✅ Components write via `workspace.update()`
- ❌ Never component-to-component state sharing
- ❌ Never multiple stores
- ❌ Never prop drilling >1 level

---

## File Structure with Framework Responsibilities

```
src-simple/
├── stores/
│   └── workspace.js              → Svelte writable store
│
├── components/
│   ├── Workspace.svelte          → Svelte component
│   │                               + Keyboard events
│   └── displays/
│       ├── FloatingDisplay.svelte → Svelte component
│       │                            + interact.js drag/resize
│       │                            + Canvas rendering
│       │                            + WebSocket subscription
│       ├── DisplayHeader.svelte   → Svelte component
│       └── DisplayCanvas.svelte   → Svelte component
│                                    + Canvas 2D rendering
│
├── lib/
│   ├── visualizations/
│   │   ├── dayRangeMeter.js      → Canvas 2D API
│   │   ├── marketProfile.js      → Canvas 2D API
│   │   └── shared/
│   │       ├── canvas.js         → Canvas setup utilities
│   │       └── geometry.js       → Canvas drawing helpers
│   │
│   ├── data/
│   │   └── websocket.js          → WebSocket API
│   │
│   ├── navigation/
│   │   └── keyboard.js           → Browser keyboard events
│   │                               + Svelte store updates
│   │
│   └── persistence/
│       └── workspace.js          → localStorage API
│                                   + JSON serialization
│
└── vite.config.js                → Vite configuration
```

---

## Framework Decision Tree

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

---

## Common Patterns

### Pattern 1: Display Creation
```javascript
// In workspace.js (Svelte store)
export const workspace = writable({
  displays: new Map()
});

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

### Pattern 2: Canvas Rendering
```javascript
// In dayRangeMeter.js (Canvas 2D)
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

### Pattern 3: WebSocket Subscription
```javascript
// In FloatingDisplay.svelte
onMount(() => {
  const unsubscribe = wsClient.subscribe(display.symbol, (data) => {
    renderVisualization(canvas, data);
  });
  
  return () => unsubscribe();
});
```

### Pattern 4: Drag Handling
```javascript
// In FloatingDisplay.svelte
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

---

## Anti-Patterns (Never Do This)

### ❌ Violating Compliance Standards

**Line Count Violations:**
```javascript
// DON'T: Functions exceeding 15 lines
function complexVisualization(data, config, options, metadata) {
  // 50+ lines violates compliance standard
  // Multiple responsibilities
  // Hard to understand and maintain
}

// DO: Keep functions focused and compliant
function renderData(data) {
  // 10 lines of rendering logic (compliant)
}

function processConfig(config) {
  // 8 lines of config processing (compliant)
}
```

**File Size Violations:**
```javascript
// DON'T: Files exceeding 120 lines
// visualizationManager.js (200+ lines) - VIOLATION
export class VisualizationManager {
  // Too many responsibilities
  // Hard to navigate
  // Violates compliance standard
}

// DO: Split into compliant files
// registry.js (40 lines) - Registration only (compliant)
// factory.js (30 lines) - Creation only (compliant)
// renderer.js (50 lines) - Rendering only (compliant)
```

### ❌ Building What Frameworks Provide
```javascript
// DON'T: Custom drag logic
let isDragging = false;
element.addEventListener('mousedown', () => isDragging = true);
element.addEventListener('mousemove', (e) => {
  if (isDragging) {
    // Manual drag calculation
  }
});

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
  on(event, cb) { /* ... */ }
}

// DO: Use Svelte stores
export const workspace = writable({});
```

---

## Framework Update Policy

**When to update frameworks:**
- Security patches: Immediately
- Minor versions: Quarterly review
- Major versions: Only if compelling reason

**How to update:**
1. Update one framework at a time
2. Test all three MUST HAVEs
3. Check performance targets
4. Commit if stable, rollback if not

**Current versions (as of implementation):**
- Svelte: 4.x (stable)
- interact.js: 1.10.x (stable)
- Vite: 5.x (stable)
- Canvas 2D: Browser native (always current)
- WebSocket: Browser native (always current)
- localStorage: Browser native (always current)

---

## Compliance Validation Framework

### Automated Compliance Checks

```javascript
// File Compliance Validator
export function validateFileCompliance(filePath, content) {
  const lines = content.split('\n').length;
  const functions = extractFunctions(content);

  return {
    passed: lines <= 120,
    fileLines: lines,
    functionViolations: functions.filter(f => f.lines > 15),
    complexityScore: calculateComplexity(content)
  };
}

// Function Complexity Scorer
function calculateComplexity(content) {
  const cyclomaticComplexity = calculateCyclomaticComplexity(content);
  const parameterCount = countParameters(content);
  const nestingDepth = calculateNestingDepth(content);

  return {
    cyclomatic: cyclomaticComplexity,
    parameters: parameterCount,
    nesting: nestingDepth,
    score: calculateScore(cyclomaticComplexity, parameterCount, nestingDepth)
  };
}
```

### Manual Compliance Checklist

#### For Each File:
- [ ] File ≤ 120 lines total
- [ ] Each function ≤ 15 lines
- [ ] Single responsibility principle followed
- [ ] Framework primitives used directly
- [ ] No custom implementations of framework features

#### For Each Function:
- [ ] Function ≤ 15 lines (enforced)
- [ ] Single clear purpose
- [ ] Minimal parameters (≤ 4 preferred)
- [ ] No nested complexity beyond 2 levels

### Compliance Enforcement Process

1. **Pre-commit Check**: Automated validation
2. **Code Review**: Manual verification
3. **Architecture Review**: Periodic compliance audit
4. **Continuous Integration**: Automated checks in CI/CD

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

**We never:**
- Rebuild framework features
- Wrap frameworks unnecessarily
- Fight framework patterns
- Violate compliance standards

**Result:**
- Naturally simple code that meets compliance standards
- ~0 lines of framework re-implementation
- 100% maintainability through framework stability
- Enforced architectural integrity