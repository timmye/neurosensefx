# Claude Context: Simple Implementation

## 🎯 You Are Here: src-simple/

This is the **simple implementation** of NeuroSense FX - achieving functionality through clarity and simplicity, not complexity.

---

## ⚠️ Critical Rules

### Work ONLY in src-simple/
```
✅ ALLOWED:
- Modify files in src-simple/
- Create new files in src-simple/
- Read CONTRACT.md

❌ FORBIDDEN:
- Modify anything in src/ (legacy)
- Import from src/ (use framework features instead)
- Copy patterns from src/ (over-engineered)
```

### Always Read CONTRACT.md First
Before every task: `Read src-simple/CONTRACT.md`

# Tiered Line Count Limits

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
**If approaching limit → refactor to simplify**

---

## 🏗️ Architecture Philosophy

### Three MUST HAVEs
The foundation of this implementation:

1. **Floating interface workspace**
   - Objective: Enable users to organize their trading space
   - Approach: Draggable containers, position persistence, z-index management

2. **Interactive floating elements**
   - Objective: Provide direct manipulation of displays
   - Approach: interact.js for drag, focus management, basic resize

3. **Live visualizations**
   - Objective: Show real-time market data visually
   - Approach: Canvas rendering (DPR-aware), WebSocket data, Day Range Meter

### File Structure
```
src-simple/
├── claude.md                    ← You are here
├── CONTRACT.md                  ← Rules (read first!)
├── stores/
│   └── workspace.js            (~150 lines) - Single store
├── components/
│   ├── Workspace.svelte        (~80 lines) - Container
│   └── FloatingDisplay.svelte  (~120 lines) - Display element
└── lib/
    └── visualizers.js          (~60 lines) - All charts

Target: ~400 lines total
```

### Tech Stack
- **Svelte 4.x**: Reactive components
- **interact.js**: Drag and drop
- **Canvas 2D API**: Rendering (DPR-aware)
- **WebSocket**: Real-time data
- **localStorage**: State persistence

---

## 🔧 Working Process

### Starting a Session

1. **Read CONTRACT.md**
   ```bash
   cat src-simple/CONTRACT.md
   ```

2. **Understand your objective**
   - What user need are you addressing?
   - Is this a MUST HAVE or NICE TO HAVE?
   - What's the simplest implementation?

3. **Check current line counts**
   ```bash
   wc -l stores/*.js components/*.svelte lib/*.js
   ```

4. **Acknowledge understanding**
   ```
   I acknowledge:
   - Working in src-simple/ only
   - Read CONTRACT.md
   - Objective: [what I'm building]
   - Approach: [how I'll build it simply]
   - Line budget: [X lines available]
   ```

### Development Process

**Before adding code:**
- Will this exceed line limits?
- Does the framework already provide this?
- Can I achieve this in <15 lines?
- Is there a simpler approach?

**While coding:**
- Check line counts frequently
- Prefer framework defaults
- Keep functions under 15 lines
- One responsibility per file

**After implementing:**
- Verify line counts under limits
- Test the three MUST HAVEs still work
- Commit with clear message

### Testing Process

**Functional validation:**
```bash
npm run dev

# Verify three MUST HAVEs:
1. Workspace appears and is interactive
2. Elements can be dragged and positioned
3. Visualizations render with live data
```

**Performance validation:**
- Interaction latency <100ms
- Rendering at 60fps
- Memory usage reasonable

---

## 📚 Core Principles

### Simple, Performant, Maintainable

**Simple**
- Minimum code to achieve objective
- Framework defaults over custom solutions
- Readable by any developer in <15 minutes

**Performant**
- Sub-100ms interaction latency
- 60fps rendering maintained
- Efficient use of framework primitives

**Maintainable**
- Single responsibility per file
- Clear naming and structure
- No abstractions unless necessary

### Decision Framework

Before implementing anything:

1. **What user need does this address?**
   - Clear objective required
   - Must support MUST HAVEs

2. **Does the framework provide this?**
   - Check Svelte docs
   - Check interact.js docs
   - Check Canvas API docs

3. **What's the simplest implementation?**
   - Can it be <15 lines?
   - Single function?
   - Direct and clear?

4. **Line count impact?**
   - Check current count
   - Will addition exceed limit?
   - If yes → refactor first

---

## 🚫 Anti-Patterns to Avoid

### ❌ Copying Complexity from src/
```javascript
// DON'T:
import { ComplexValidator } from '../src/utils/validation.js';

// DO:
function isValidPosition(pos) {
  return pos.x >= 0 && pos.y >= 0; // Simple bounds check
}
```

### ❌ Over-Engineering
```javascript
// DON'T:
class DisplayManager {
  constructor() {
    this.observers = [];
    this.queue = [];
    this.cache = new Map();
  }
  // ...100 more lines
}

// DO:
function addDisplay(symbol, position) {
  workspace.update(state => {
    state.displays.set(id, { id, symbol, position });
    return state;
  });
}
```

### ❌ Premature Optimization
```javascript
// DON'T:
const memoizedCalculation = useMemo(() => 
  expensiveCalc(data), [data]); // Not needed yet

// DO:
const result = calculateValue(data); // Simple, direct
// Optimize only when proven necessary
```

### ❌ Abstractions Without Need
```javascript
// DON'T:
function createFactory() {
  return {
    create: (type) => factories[type](),
    // Abstract complexity
  };
}

// DO:
function createDisplay(symbol) {
  return { id: crypto.randomUUID(), symbol };
}
```

---

## 🎯 Feature Categorization

### MUST HAVE
**Definition**: Cannot function without this
**Test**: Would users refuse to use the app without it?
**Approach**: Implement with absolute simplicity

### NICE TO HAVE
**Definition**: Enhances core functionality
**Test**: Would power users miss this?
**Approach**: Implement when MUST HAVEs are solid, keep simple

### COULD HAVE
**Definition**: Optional enhancement
**Test**: Is this rarely used or experimental?
**Approach**: Defer until core and supportive features complete

---

## 🔄 Expansion Process

### When Adding New Features

1. **Categorize first**
   - Is this MUST HAVE, NICE TO HAVE, or COULD HAVE?
   - Document rationale

2. **Design simply**
   - How would framework handle this?
   - What's the minimal implementation?
   - Estimate line count

3. **Implement incrementally**
   - Build smallest working version
   - Test thoroughly
   - Refine if needed (not over-engineer)

4. **Validate principles**
   - Still simple?
   - Still performant?
   - Still maintainable?

### Feature Documentation

When adding features, document:
```markdown
## [Feature Name]

**Category**: [MUST HAVE / NICE TO HAVE / COULD HAVE]

**User Objective**: [What user needs to accomplish]

**Implementation Approach**: [How we achieve it simply]

**Line Count**: [X lines]

**Trade-offs**: [Decisions made for simplicity]
```

---

## 🧭 Navigation

### Key Files

- **CONTRACT.md**: Hard rules and constraints
- **claude.md**: Context and processes (this file)
- **stores/workspace.js**: Single source of truth
- **components/Workspace.svelte**: Container component
- **components/FloatingDisplay.svelte**: Display element
- **lib/visualizers.js**: Visualization engine

### Documentation

- **Feature analysis**: `docs/crystal-clarity/feature-*.md`
- **Implementation docs**: `docs/crystal-clarity/`
- **Architecture decisions**: Documented in code comments or feature docs

---

## 💡 Philosophy

### Crystal Clarity
Every line of code should be obvious in purpose and implementation. If it requires explanation, it's too complex.

### Framework First
Svelte, interact.js, and Canvas API provide robust primitives. Use them directly rather than building abstractions.

### User-Focused
Every feature exists to serve a user need. If the user benefit isn't clear, the feature shouldn't exist.

### Simplicity Scales
Simple code is easier to:
- Understand (onboarding)
- Modify (maintenance)
- Test (quality)
- Extend (growth)

### Trust the Process
The three MUST HAVEs prove this approach works. Continue applying the same rigorous thinking to each addition.

---

## 📖 Quick Reference

### Before Every Session
1. Read CONTRACT.md
2. Understand objective
3. Check line counts
4. Acknowledge understanding

### During Development
1. Question complexity
2. Use framework features
3. Keep functions small
4. Check limits frequently

### After Implementation
1. Verify line counts
2. Test three MUST HAVEs
3. Document decisions
4. Commit clearly

### When Stuck
1. Re-read objective
2. Check framework docs
3. Ask: "What's simpler?"
4. Review CONTRACT.md

---

**Remember**: This implementation succeeds through clarity and simplicity, not cleverness or complexity. Every addition should make the codebase easier to understand, not harder.