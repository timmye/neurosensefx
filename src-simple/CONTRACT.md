# Simple Implementation Contract

## For All Claude Code Sessions Working on NeuroSense FX

**READ THIS BEFORE EVERY TASK. ACKNOWLEDGE UNDERSTANDING BEFORE PROCEEDING.**

---

## Core Principles

### Simple, Performant, Maintainable

**Simple**
- Minimum code to achieve the goal
- No abstractions unless absolutely necessary
- Framework defaults over custom solutions
- Readable by any developer in under 15 minutes

**Performant**
- Sub-100ms interaction latency
- 60fps rendering maintained
- Efficient framework usage
- Performance through simplicity, not optimization

**Maintainable**
- Single responsibility per file
- Clear naming and structure
- Self-documenting code
- Easy to modify and extend

---
## must read the readme ##
src-simple/README.md

## The Architecture: Shadow Implementation

### What This Means

```
src-simple/          ← Work ONLY here
├── stores/
│   └── workspace.js        
├── components/
│   ├── Workspace.svelte    
│   └── FloatingDisplay.svelte 
└── lib/
    └── visualizers.js      

src/                 ← Read-only reference (30,000+ lines)
└── [complex implementation - DO NOT MODIFY]

src-migration/       ← Integration layer only
└── FeatureRouter.svelte
```

### Working Rules

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

---

## Tiered Line Count Limits

### Tier 1: Core (Ultra-Strict)
- stores/*.js: 150 lines MAX
- components/Workspace.svelte: 120 lines MAX
- components/displays/FloatingDisplay.svelte: 120 lines MAX

### Tier 2: Visualizations (Strict)
- lib/visualizations/*.js: 200 lines MAX per visualization
- Rationale: Traders need complete, functional visualizations
- Trade-off: Accept larger files for visual completeness

### Tier 3: Performance & Errors (Strict)
- lib/performance/*.js: 150 lines MAX
- lib/errors/*.js: 150 lines MAX
- Rationale: Critical infrastructure needs space

### Tier 4: Utilities (Guideline)
- lib/*/shared/*.js: 150 lines SUGGESTED
- Can exceed if justified (document rationale)

## When to Split Files

Split ANY file that:
- Exceeds its tier limit
- Does more than one thing
- Is hard to understand in 5 minutes
- Has multiple developers confused

**If you're about to exceed a limit:**
1. STOP immediately
2. Refactor existing code to simplify
3. Question if the feature is a MUST HAVE
4. Ask human before proceeding

### Function Complexity
- Maximum 15 lines per function
- Maximum 3 levels of nesting
- No function should do more than one thing

### File Responsibility
- One clear purpose per file
- No "utils" or "helpers" collections
- Name must describe exact responsibility

---

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

---

## Framework Usage Guidelines

### Svelte Stores
```javascript
// ✅ Simple store
export const workspace = writable(initialState);

// ✅ Direct updates
workspace.update(state => { 
  state.displays.set(id, display);
  return state;
});

// ❌ Complex derived stores
export const displaysBySymbol = derived(
  [workspace, filters, sorting],
  ([$workspace, $filters, $sorting]) => {
    // 50 lines of complex logic
  }
);
```

### interact.js
```javascript
// ✅ Direct usage
interact(element)
  .draggable({ onmove: handleMove })
  .resizable({ edges: { right: true, bottom: true } });

// ❌ Custom wrappers
class InteractionManager {
  setupDraggable(element, options) {
    // Custom abstraction layer
  }
}
```

### Canvas API
```javascript
// ✅ Direct rendering
const ctx = canvas.getContext('2d');
ctx.fillRect(x, y, width, height);

// ❌ Custom rendering engine
class RenderEngine {
  constructor(canvas) {
    this.layers = [];
    this.renderQueue = [];
    // Complex rendering system
  }
}
```

---

## Decision Framework

Before writing ANY code, answer these questions:

### 1. Is This a MUST HAVE?
- Does it support workspace, interactive elements, or visualizations?
- If NO → Don't implement it
- If YES → Continue to question 2

### 2. Does the Framework Already Do This?
- Check Svelte, interact.js, Canvas API docs
- If YES → Use framework feature directly
- If NO → Continue to question 3

### 3. What's the Simplest Possible Implementation?
- Can you write it in under 15 lines?
- Does it need only one function?
- Can a junior developer understand it immediately?
- If NO to any → Simplify further

### 4. Will This Push Line Count Over Limit?
- Check current line count
- Estimate addition
- If OVER LIMIT → Refactor before adding

---

## Code Review Checklist

Before committing, verify:

### Line Counts
- [ ] workspace.js < 150 lines
- [ ] Workspace.svelte < 80 lines
- [ ] FloatingDisplay.svelte < 120 lines
- [ ] visualizers.js < 60 lines
- [ ] Total < 410 lines

### Simplicity
- [ ] No functions over 15 lines
- [ ] No abstractions or utility layers
- [ ] Framework defaults used
- [ ] No patterns copied from src/

### Functionality
- [ ] Three MUST HAVEs still working
- [ ] No regressions introduced
- [ ] Performance targets met (<100ms, 60fps)

### Maintainability
- [ ] Code is self-documenting
- [ ] Clear naming conventions
- [ ] Single responsibility per file
- [ ] Easy to understand and modify

---

## When You're Tempted to Add Complexity

**STOP and ask:**

1. "Does the complex implementation in src/ do this?"
   - If YES: "Is it actually necessary or over-engineered?"
   - Often the answer is: "Over-engineered, we don't need it"

2. "Will this make the code harder to understand?"
   - If YES: Don't do it

3. "Am I solving a problem that doesn't exist yet?"
   - If YES: Don't do it (YAGNI principle)

4. "Can I delete code instead of adding code?"
   - Always look for deletion opportunities first

---

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

---

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
I acknowledge the Simple Implementation Contract:
- I will work ONLY in src-simple/
- I will respect hard line count limits
- I will use framework defaults over custom solutions
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

## Emergency Contact

If you genuinely need to violate these principles:
1. Document WHY in detail
2. Explain what you tried first
3. Get explicit human approval
4. Add to decision log with justification

**Note**: In 95% of cases, you don't actually need to violate these principles. You need to simplify your approach.

---

**This contract exists because**: We've already built the complex version (30,000+ lines). It worked but was unmaintainable. This is our chance to do it right: simple, clear, and maintainable. Don't repeat the mistakes of complexity creep.

**Your job**: Keep it simple. That's it. That's the entire job.