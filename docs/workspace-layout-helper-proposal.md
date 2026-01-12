# Workspace Layout Helper - Feature Proposal

## Problem

Current workspace management requires manual positioning of each display. When adding multiple symbols, displays spawn at the same default position and must be dragged and resized individually. This becomes tedious with more than ~5 displays.

## Context

From user feedback and observing the workspace editor prototype:
- Traders manually arrange displays in rows and columns
- Some displays use full height (350px), others half height (174px)
- Adding new displays disrupts existing layout
- No built-in alignment or grid snapping exists

## Proposed Solution

Add a layout helper that:
1. **Auto-detects display sizes** from the current workspace
2. **Arranges displays in a grid** with consistent spacing
3. **Shows a preview** before applying changes
4. **Accessible via keyboard shortcut** (Alt+L)

### Core Features

**Auto Size Detection**
- Analyzes existing display heights to identify size types
- Works with any number of size variations (not just full/half)
- No manual configuration required

**Grid Layout**
- Calculates columns based on screen width and element width
- Groups displays by size type
- Arranges in rows with consistent gaps
- Shows if layout exceeds screen height

**Tidy Spacing**
- Snaps displays to nearest grid position
- Preserves rough positioning
- Cleans up alignment

## User Value

**Time**
- Manual layout: 1-3 minutes for 10+ displays
- Auto layout: ~2 seconds
- Reduced friction when adding/removing symbols

**Consistency**
- Predictable spacing and alignment
- Reproducible layouts across sessions
- Easier to find specific symbols at a glance

**Scalability**
- Managing 15-20 displays becomes practical
- No additional effort for larger workspaces

## Example Workflows

**Morning Setup**
Trader loads 12 pairs (6 full-height, 6 half-height). Currently spends time arranging rows. With layout helper: add pairs → Alt+L → Auto Layout → done.

**Expanding Watchlist**
Trader adds 5 new pairs during volatility. Currently these spawn on top of existing displays. With layout helper: add pairs → Alt+L → Auto Layout → all 15 displays arranged.

**Quick Scans**
Trader wants to scan 20 pairs at compact size. Currently not practical due to layout effort. With layout helper: add pairs → resize one → Alt+L → all resize and arrange.

## Layout Protections

Auto-layout features can destroy carefully arranged workspaces. The following protections prevent data loss:

**Preview Before Apply**
- Modal shows exact new positions before any changes
- Visual overlay of "before" vs "after" state
- Lists which displays will move and by how much
- Explicit "Apply" button required

**Undo Capability**
- Ctrl+Z restores previous layout immediately
- Undo history persists across session
- Multiple undo levels (last 5 layouts)

**Save Before Modify**
- Current layout automatically saved to temporary slot
- "Restore Previous" button always available in modal
- Auto-saved before any layout operation

**Scope Control**
- "Apply to All" vs "Apply to Selected" option
- "Only New Displays" mode — leaves positioned displays untouched
- Shift+Click to exclude specific displays from layout

**Non-Destructive Default**
- Tidy Spacing mode: small adjustments, not full re-layout
- Grid snap only, no position changes beyond snapping
- Always opt-in, never auto-applies

**Validation & Warnings**
- Warning if >50% of displays will move significantly (>100px)
- Warning if layout exceeds screen bounds
- "Layout seems already organized" detection — suggest skipping

**Emergency Restore**
- Escape key cancels pending layout
- "Revert to Last Saved Workspace" in menu
- Auto-backup on workspace load (one deep)

## Technical Implementation

### Store Changes

**Batch Update Action**
```javascript
// src/stores/workspace.js - add to actions
batchUpdateDisplays: (updates) => {
  // updates: Map<displayId, { position?, size? }>
  workspaceStore.update(state => {
    const newDisplays = new Map(state.displays);
    for (const [id, changes] of updates) {
      const display = newDisplays.get(id);
      if (display) newDisplays.set(id, { ...display, ...changes });
    }
    return { ...state, displays: newDisplays };
  });
}
```

**Undo History System**
```javascript
// Add to initialState
history: [],
historyIndex: -1,
maxHistory: 5

// Add to actions
undo: () => { /* restore previous state */ },
redo: () => { /* restore next state */ },
saveToHistory: () => { /* push state snapshot */ }
```

### Layout Algorithms

**Size Detection (Histogram)**
```javascript
// src/lib/workspace-layout/detectSizes.js
export function detectSizeTypes(displays, tolerance = 10) {
  const heights = displays.map(d => d.size.height);
  const groups = [];

  for (const h of heights) {
    const existing = groups.find(g => Math.abs(g.height - h) <= tolerance);
    if (existing) existing.count++;
    else groups.push({ height: h, count: 1 });
  }

  return groups.sort((a, b) => b.count - a.count);
}
```

**Shelf Packing Layout**
```javascript
// src/lib/workspace-layout/shelfPack.js
export function layoutShelf(displays, screenWidth, gap, margin) {
  const shelves = [];
  let currentShelf = { y: margin, height: 0, items: [], x: margin };

  for (const display of displays) {
    const w = display.size.width;
    const h = display.size.height;

    if (currentShelf.x + w > screenWidth - margin) {
      shelves.push(currentShelf);
      currentShelf = {
        y: shelves.reduce((sum, s) => sum + s.height + gap, margin),
        height: h,
        items: [],
        x: margin
      };
    }

    currentShelf.height = Math.max(currentShelf.height, h);
    currentShelf.items.push({ ...display, position: { x: currentShelf.x, y: currentShelf.y } });
    currentShelf.x += w + gap;
  }

  if (currentShelf.items.length) shelves.push(currentShelf);
  return shelves.flatMap(s => s.items);
}
```

### Modal Component

**LayoutModal.svelte** (reuse WorkspaceModal pattern)
```svelte
<script>
  export let show = false;
  export let calculatedLayout = null; // { displays: [], fit: boolean }
  const dispatch = createEventDispatcher();

  function handleApply() {
    dispatch('apply', { layout: calculatedLayout });
  }
</script>

{#if show && calculatedLayout}
<div class="modal-overlay">
  <div class="layout-modal">
    <h2>Layout Preview</h2>
    <div class="layout-info">
      {calculatedLayout.fit ? '✓ Fits on screen' : '⚠ Overflow: ' + calculatedLayout.overflow + 'px'}
    </div>
    <div class="modal-buttons">
      <button on:click={handleApply}>Apply Layout</button>
      <button on:click={() => dispatch('cancel')}>Cancel</button>
    </div>
  </div>
</div>
{/if}
```

### Keyboard Integration

**Workspace.svelte** - Add Alt+L handler
```javascript
function handleKeydown(event) {
  // ... existing handlers ...
  if (event.altKey && event.key.toLowerCase() === 'l') {
    event.preventDefault();
    showLayoutDialog();
    return;
  }
}
```

### Scope Reduction (Phase 1 MVP)

**Removed from MVP:**
- Multi-selection system ("Apply to Selected")
- "Only New Displays" mode
- Shift+Click exclusion

**Reason:** Selection system is 2-3 hours additional work. Can be Phase 2.

**Revised Estimate:** 10-12 hours for Phase 1 MVP

## Crystal Clarity Compliance

### Framework-First Dependencies
All proposed changes use existing frameworks only:

| Framework | Usage | Compliance |
|-----------|-------|------------|
| Svelte stores | State management, undo history | ✓ Direct API |
| Svelte events | Modal dispatch, component comms | ✓ Direct API |
| No new libraries | Pure JS algorithms | ✓ Zero deps |

### File Size Limits

**Proposed Files:**
```
src/lib/workspace-layout/
├── detectSizes.js      (~25 lines) ✓ <120
├── shelfPack.js        (~30 lines) ✓ <120
└── index.js            (~15 lines) ✓ <120

src/components/
└── LayoutModal.svelte  (~60 lines) ✓ <120
```

**Modified Files:**
- `src/stores/workspace.js`: +80 lines (undo, batch) → ~360 total
  - Within reason for core store (can extract if needed)

**Store Changes Option:** If undo grows large, extract:
```
src/stores/
├── workspace.js        (existing, unchanged)
└── workspaceUndo.js    (~80 lines) - undo actions wrapper
```

### Function Size Limits

**detectSizes.js** - All functions <15 lines:
```javascript
detectSizeTypes()      // ~12 lines
// Groups heights into clusters by tolerance
```

**shelfPack.js** - All functions <15 lines:
```javascript
layoutShelf()          // ~14 lines
// Shelf packing for variable-height rectangles
```

**Store Actions** - Each <15 lines:
```javascript
batchUpdateDisplays()  // ~8 lines
saveToHistory()        // ~6 lines
undo()                 // ~4 lines
redo()                 // ~4 lines
```

### No Custom Abstractions

**Direct framework usage:**
- `workspaceStore.update()` - Svelte store API (no wrapper)
- `createEventDispatcher()` - Svelte event API (no wrapper)
- `new Map()` - Native JS (no custom data structures)
- Array methods - Native JS (no lodash/utility libs)

### Single Responsibility

**Each module has one job:**
| File | Responsibility | Lines |
|------|----------------|-------|
| detectSizes.js | Size type detection only | ~25 |
| shelfPack.js | Layout calculation only | ~30 |
| LayoutModal.svelte | Preview UI only | ~60 |
| workspace.js | State management only | +80 |

### Risks & Mitigations

**Risk:** Undo system in workspace.js could grow large
**Mitigation:** Extract to `workspaceUndo.js` if >100 lines added

**Risk:** Preview modal could become complex with visual overlay
**Mitigation:** Phase 1 uses text preview only; visual overlay Phase 2

**Risk:** Layout algorithms might need optimization for 50+ displays
**Mitigation:** Shelf packing is O(n); acceptable for typical 10-20 displays

## Open Questions

- Should layout be auto-applied on import or always manual?
- How to handle displays that don't fit on screen?
- Should settings persist per workspace or globally?
- How many undo levels to store? (proposed: 5)

---

**Status:** Proposed | **Priority:** Medium | **Estimate:** 10-12 hours
