# NeuroSense FX Development Contract

## Framework-First Development Agreement

**READ THIS BEFORE EVERY TASK. ACKNOWLEDGE UNDERSTANDING BEFORE PROCEEDING.**

**ALL ACTIVITIES MUST BE DONE IN /src-simple**
**DO NOT OPERATE IN ROOT DIR - SHADOW SIMPLE FRONT END IMPLEMENTATION in /src-simple**
**ROOT IS EXISTING FRONT AND BACK END AND NOT TO BE TOUCHED**

---

## Core Principles

### Simple, Performant, Maintainable

**Simple**
- Minimum code to achieve the goal
- Framework primitives over custom solutions
- Single responsibility per component
- Naturally readable code

**Performant**
- 60fps rendering maintained
- Sub-100ms interaction latency
- DPR-aware crisp rendering
- Performance through simplicity

**Maintainable**
- Single responsibility per file
- Clear naming and structure
- Framework-first patterns
- Professional trading workflows

---

## Framework Responsibility Map

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

## File Structure & Line Count Standards

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

└── vite.config.js                → Vite configuration

src/                 ← Read-only reference (30,000+ lines)
└── [complex implementation - DO NOT MODIFY]
```

## Tiered Line Count Limits

### Core Components (Ultra-Strict)
- stores/workspace.js: 150 lines MAX
- components/Workspace.svelte: 120 lines MAX
- components/FloatingDisplay.svelte: 120 lines MAX
- App.svelte: 20 lines MAX

### Framework Services (Strict)
- lib/connectionManager.js: 100 lines MAX
- lib/displayDataProcessor.js: 100 lines MAX
- lib/visualizers.js: 50 lines MAX
- lib/visualizationRegistry.js: 50 lines MAX

### Visualization Components (Guideline)
- Individual visualizers: <120 lines preferred
- Visualization orchestrators: <80 lines preferred
- Utility modules: <60 lines ideal

## Framework Usage Rules

### ✅ Svelte (UI & State)
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

### ✅ interact.js (Drag & Drop)
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

### ✅ Canvas 2D API (Rendering)
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

### ✅ WebSocket API (Real-time Data)
**Use WebSocket for:**
- Real-time price data
- Connection management
- Data subscription

**Never:**
- ❌ Use Socket.io (too heavy)
- ❌ Use polling instead of WebSocket
- ❌ Build custom protocol (use JSON)

### ✅ localStorage API (Persistence)
**Use localStorage for:**
- Workspace state persistence
- User preferences
- Display positions

**Never:**
- ❌ Use IndexedDB (too complex for our needs)
- ❌ Use cookies (wrong use case)
- ❌ Build custom storage abstraction

## Critical Implementation Patterns

### State Management
```javascript
// ✅ Single store pattern
export const workspace = writable({
  displays: new Map(),
  symbols: new Set(),
  activeId: null,
  config: {}
});

// ✅ Updates via workspace.update()
workspace.update(state => {
  state.displays.set(id, display);
  return state;
});

// ❌ NEVER multiple stores
// ❌ NEVER component-to-component state sharing
// ❌ NEVER prop drilling >1 level
```

### Canvas Rendering
```javascript
// ✅ DPR-aware rendering
export function render(canvas, data) {
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext('2d');

  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.scale(dpr, dpr);

  // Rendering logic here
}
```

### Drag Handling
```javascript
// ✅ Direct interact.js usage
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

## Forbidden Patterns

### ❌ NEVER Do This

```javascript
// ❌ Custom validation layers
function validateDisplayPosition(position) {
  if (!position || typeof position !== 'object') throw new Error(...);
  if (!Number.isFinite(position.x)) throw new Error(...);
  // ... 50 more lines of validation
}

// ❌ Performance monitoring
const startTime = performance.now();
// ... operation
const endTime = performance.now();
logger.recordMetric('operation_time', endTime - startTime);

// ❌ Complex abstractions
class DisplayManager {
  constructor() {
    this.displays = new Map();
    this.observers = [];
    this.syncQueue = [];
    // ... 200 lines of complexity
  }
}

// ❌ Over-engineering
function createDisplay(symbol, config = {}) {
  const enrichedConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    metadata: generateMetadata(),
    validators: createValidators(config),
    // ... unnecessary complexity
  };
}

// ❌ Copying from src/
// Taking ANY pattern from complex implementation
```

### ✅ Do This Instead

```javascript
// ✅ Simple, direct code
function addDisplay(symbol, position = { x: 100, y: 100 }) {
  const id = crypto.randomUUID();
  workspace.update(state => {
    state.displays.set(id, { id, symbol, position, zIndex: state.nextZIndex++ });
    return state;
  });
}

// ✅ Framework-native patterns
import { writable } from 'svelte/store';
export const workspace = writable({ displays: new Map() });

// ✅ Direct usage
interact(element).draggable({
  onmove: (event) => updatePosition(display.id, event.dx, event.dy)
});

// ✅ Canvas 2D API directly
ctx.fillStyle = '#4CAF50';
ctx.fillRect(x, y, width, height);
```

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

## Function Complexity Standards

- **Maximum 15 lines per function**
- **Maximum 3 levels of nesting**
- **No function should do more than one thing**
- **Single clear purpose per file**

## Working Rules

**When modifying src-simple/:**
1. Check line count BEFORE and AFTER changes
2. If approaching limit, refactor to simplify
3. Never exceed hard limits
4. Commit frequently with clear messages

**When referencing src/:**
- Read for data shapes, types, integration points ONLY
- DO NOT copy implementation patterns
- DO NOT import complexity
- Ask yourself: "Is there a simpler way using frameworks?"

## Emergency Brake

### If You Find Yourself:
- Exceeding line count limits
- Creating abstraction layers
- Adding validation systems
- Implementing monitoring
- Copying patterns from src/
- Building "just in case" features

### Immediately:
1. **STOP CODING**
2. **Step back and review this contract**
3. **Ask: "What's the simplest way to achieve the goal?"**
4. **Delete what you just wrote**
5. **Start over with simplicity first**

## Code Review Checklist

Before committing, verify:

### Line Counts
- [ ] workspace.js < 150 lines
- [ ] Workspace.svelte < 120 lines
- [ ] FloatingDisplay.svelte < 120 lines
- [ ] All components follow tiered limits
- [ ] Functions < 15 lines each

### Framework Compliance
- [ ] Svelte used for UI/state only
- [ ] interact.js used for drag/resize only
- [ ] Canvas 2D used for rendering only
- [ ] WebSocket API used for data only
- [ ] localStorage used for persistence only
- [ ] No custom abstractions

### Simplicity
- [ ] Single responsibility per file
- [ ] No patterns copied from src/
- [ ] Framework defaults used
- [ ] No unnecessary complexity

## Success Criteria

### You're On Track When:
- Adding features takes minutes, not hours
- New developers understand code immediately
- Line counts stay well under limits
- No "clever" code exists
- Framework features used directly
- Performance targets easily met

### You've Failed When:
- Need to explain how code works
- Adding features requires understanding complex systems
- Line counts approach or exceed limits
- "Smart" abstractions exist
- Custom implementations replace framework features
- Performance requires optimization

---

## Acknowledgment

**Before starting any task, respond with:**

```
I acknowledge the Framework-First Development Contract:
- I will work ONLY in src-simple/
- I will respect tiered line count limits
- I will use framework primitives over custom solutions
- I will question complexity at every step
- I will maintain the three principles: Simple, Performant, Maintainable

Current task: [describe task]
Target file: [filename]
Current line count: [X lines]
Estimated addition: [Y lines]
Will remain under limit: [YES/NO]
```

---

## The Golden Rule

> **When in doubt, choose the simpler solution.**
>
> If you can't decide between two approaches, choose the one with:
> - Fewer lines of code
> - Fewer abstractions
> - More direct framework usage
> - Better readability
>
> Simplicity is not a constraint—it's the goal.

---

**This contract exists because**: Frameworks provide 95% of what we need. Our job is to use them correctly, not rebuild them. Simplicity emerges from proper framework utilization, not from artificial constraints.

**Your job**: Use frameworks first, ask questions second, and keep it simple.