# Interaction Architecture Overhaul Plan
## LLM Vision: Rip It Out & Use interact.js

### **Core Problem Diagnosis**

NeuroSense FX has **three competing interaction systems** creating architectural chaos:

1. **InteractionManager.js** (~100 lines) - Custom drag/resize authority
2. **useDraggable.js** (~200 lines) - Legacy composable with localStorage/thresholds  
3. **floatingStore.js** (~400 lines) - Custom GEOMETRY engine and state machines

**Result**: 1000+ lines of custom code that can't handle basic resize operations reliably.

### **Root Cause Analysis**

The architecture suffers from **competing authorities syndrome**:

```javascript
// THREE different ways to track SAME drag operation:
InteractionManager: this.activeInteraction = 'drag'
floatingStore: draggedItem = { type, id, offset }
floatingStore: resizeState = { isResizing, displayId, handleType }
```

When user resizes FloatingDisplay:
1. **InteractionManager** adds global mousemove/mouseup listeners
2. **useDraggable.js** (via SymbolPalette → FloatingPanel) ALSO has global listeners  
3. **Systems interfere** → resize ends immediately → "snap back" behavior

### **The Over-Engineering Reality Check**

**What we built vs. what we needed:**

| Custom System | Lines of Code | Function | Reality |
|---------------|----------------|------------|----------|
| InteractionManager | ~100 | Manual global listener management | Error-prone, no inertia |
| useDraggable.js | ~200 | Touch/drag thresholds, viewport checks | Reinventing wheel poorly |
| GEOMETRY engine | ~400 | Collision detection, transforms | Over-complicated math |
| **TOTAL** | **~700+** | **Basic drag/resize** | **Fundamentally broken** |

**interact.js solution:**
```javascript
// 50 lines total, battle-tested, full-featured
interact('.floating-display').draggable().resizable();
```

### **Strategic Decision: Wholesale Replacement**

**Why we're choosing interact.js:**

1. **Reliability**: Years of production edge cases vs. our broken resize
2. **Features**: Inertia, constraints, multi-touch built-in  
3. **Maintenance**: Actively maintained vs. our custom debt
4. **Bundle Size**: 50kb minified vs. our 1000+ lines of bugs
5. **Focus**: Trading interface reliability > NIH (Not Invented Here) syndrome

### **Execution Plan: Surgical Removal**

#### **Phase 1: Nuclear Removal (1-2 hours)**

**Files to DELETE completely:**
```bash
rm src/managers/InteractionManager.js
rm src/composables/useDraggable.js
```

**Code to REMOVE from floatingStore.js:**
- Remove `draggedItem` state object
- Remove `resizeState` state object  
- Remove `dragState` state object
- Remove entire `GEOMETRY.TRANSFORMS` object (~150 lines)
- Remove entire `GEOMETRY.EDGES` object (~100 lines)
- Remove `geometryActions` export (~50 lines)
- Remove all collision/transform functions (~100 lines)

**Keep ONLY:**
- Basic component Maps (`displays`, `panels`, `icons`)
- Simple actions (`addDisplay`, `removeDisplay`, `moveDisplay`, `resizeDisplay`)
- GEOMETRY.DIMENSIONS for constants only

#### **Phase 2: interact.js Integration (2-3 hours)**

**Install:**
```bash
npm install interactjs
```

**FloatingDisplay.svelte replacement:**
```javascript
import interact from 'interactjs';

onMount(() => {
  interact(element)
    .draggable({
      inertia: true,
      modifiers: [
        interact.modifiers.restrictEdges({
          inner: { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }
        })
      ],
      onmove: (event) => {
        const { dx, dy } = event;
        const newPosition = {
          x: displayPosition.x + dx,
          y: displayPosition.y + dy
        };
        actions.moveDisplay(id, newPosition);
      }
    })
    .resizable({
      edges: { left: true, right: true, bottom: true, top: true },
      modifiers: [
        interact.modifiers.restrictSize({
          min: { width: 240, height: 160 }
        })
      ],
      onmove: (event) => {
        const { rect } = event;
        actions.resizeDisplay(id, rect.width, rect.height);
      }
    });
});
```

**FloatingPanel.svelte replacement:**
```javascript
onMount(() => {
  interact(element)
    .draggable({
      inertia: true,
      modifiers: [
        interact.modifiers.restrictEdges({
          inner: { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }
        })
      ],
      onmove: (event) => {
        const { dx, dy } = event;
        const newPosition = {
          x: panelPosition.x + dx,
          y: panelPosition.y + dy
        };
        actions.movePanel(id, newPosition);
      }
    });
});
```

#### **Phase 3: Store Simplification (1 hour)**

**Simplified floatingStore.js:**
```javascript
const initialState = {
  displays: new Map(),
  panels: new Map(),
  icons: new Map(),
  activeDisplayId: null,
  activePanelId: null,
  contextMenu: { open: false, x: 0, y: 0 }
};

// Remove ALL interaction state management
// No draggedItem, no resizeState, no dragState
// Keep only data and simple actions
```

**Simplified actions:**
```javascript
export const actions = {
  // Data operations only
  addDisplay: (symbol, position) => { /* simple map update */ },
  removeDisplay: (id) => { /* simple map delete */ },
  moveDisplay: (id, position) => { /* simple position update */ },
  resizeDisplay: (id, width, height) => { /* simple size update */ },
  // Panel operations similarly simplified
};
```

### **Expected Outcomes**

**Before:** 1000+ lines, broken resize, ongoing debugging
**After:** 50 lines, working interactions, focus on trading features

**Benefits:**
1. **Reliable drag/resize** - actually works
2. **Better UX** - inertia, smooth transitions
3. **Mobile support** - touch gestures included
4. **Maintainable** - proven library, clear patterns
5. **Faster development** - focus on trading features

### **Risk Mitigation**

**Low Risk:**
- interact.js is production-proven (years of use)
- Simple replacement patterns
- Easy rollback if needed

**Rollback Plan:**
- Git branch before changes
- Keep deleted files in backup for 48 hours
- Test with single display first, then expand

### **Success Criteria**

**Wholesale success looks like:**
1. Resize works immediately after implementation
2. No more "snap back" behavior
3. Drag feels smooth with inertia
4. All components use consistent interaction patterns
5. Zero custom interaction code in codebase

### **The Bottom Line**

**This is admitting over-engineering and choosing pragmatism.**

Our custom interaction code is like building a custom car engine when Ferrari already sells proven ones. The result is predictable: our engine doesn't start, while the Ferrari just works.

**Decision: Replace our broken custom engine with the Ferrari.**

---

*Use this document as source of truth during execution. When confusion arises, return to this plan rather than generating additional analysis docs.*
