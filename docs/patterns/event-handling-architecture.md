# Event Handling Architecture Pattern

## Pattern Name
**Svelte-First Event Handling with Manual PreventDefault**

## Problem Statement
When developing complex interactive applications with multiple event systems, competing architectures can create unpredictable behavior, maintenance overhead, and race conditions. The specific symptoms include:

- Browser default menus appearing instead of custom context menus
- Inconsistent event handling across components
- Manual event listeners competing with framework event modifiers
- Complex debugging due to multiple event propagation paths

## Context
This pattern emerged from fixing canvas right-click context menus in NeuroSense FX, where:

- Multiple event handling architectures coexisted (manual addEventListener, Svelte modifiers, interact.js)
- Canvas elements showed browser context menus instead of trading-specific controls
- Event timing issues prevented `preventDefault()` from working reliably
- The codebase violated the "Simple, Performant, Maintainable" philosophy

## Solution

### Core Principle
**Use Svelte's declarative event system as the single source of truth for all UI interactions. Only use manual event listeners for specialized cases that Svelte cannot handle.**

### Implementation Pattern

#### 1. Canvas Context Menu Handler (The Fix)

**Problem**: Canvas elements showed browser context menu instead of custom trading controls.

**Solution**: Add Svelte event modifiers directly to canvas elements:

```html
<!-- FloatingDisplay.svelte - Canvas users actually see -->
<canvas
  bind:this={canvas}
  class="full-canvas"
  on:contextmenu|preventDefault|stopPropagation={handleCanvasContextMenu}
></canvas>

<!-- Container.svelte - Fallback canvas -->
<canvas
  bind:this={canvas}
  on:contextmenu|preventDefault|stopPropagation={handleCanvasContextMenu}
></canvas>
```

**Handler Function Pattern**:
```javascript
function handleCanvasContextMenu(event) {
  console.log('🎨 [COMPONENT] Canvas context menu triggered (Svelte handler)');

  // Create context object
  const context = {
    type: 'canvas',
    targetId: id,
    targetType: 'display',
    displayId: id,
    symbol: symbol || 'unknown'
  };

  // Show context menu
  displayActions.showContextMenu(event.clientX, event.clientY, id, 'display', context);
}
```

#### 2. Event Architecture Standardization

**Before (Problematic Pattern)**:
```javascript
// ❌ Manual addEventListener fighting Svelte system
onMount(() => {
  const handleContextMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();
    // ... logic
  };
  canvas.addEventListener('contextmenu', handleContextMenu);

  onDestroy(() => {
    canvas.removeEventListener('contextmenu', handleContextMenu);
  });
});
```

**After (Clean Pattern)**:
```javascript
// ✅ Svelte declarative approach
<canvas on:contextmenu|preventDefault|stopPropagation={handleContextMenu}></canvas>

function handleContextMenu(event) {
  // Svelte automatically calls preventDefault() and stopPropagation()
  // ... logic
}
```

#### 3. Event Modifier Guidelines

| Event Type | Recommended Modifiers | Use Case |
|-----------|---------------------|----------|
| Context Menu | `on:contextmenu|preventDefault|stopPropagation` | Canvas right-clicks, custom menus |
| Click | `on:click` | Standard interactions |
| Mouse Down | `on:mousedown` | Drag preparation |
| Keyboard | `on:keydown` | Shortcuts |

#### 4. Interact.js Integration Pattern

**Keep interact.js ONLY for complex gestures**:
```javascript
// ✅ Correct: interact.js for drag/resize
interactable
  .draggable({...})
  .resizable({...})
  .on('tap', (event) => {
    displayActions.setActiveDisplay(id); // ✅ OK for simple tap
  });

// ❌ Avoid: interact.js for context menus
// Use Svelte modifiers instead
```

### When to Use Manual Event Listeners

Only use manual `addEventListener` when:

1. **Event delegation is needed** for performance with many elements
2. **Custom event timing** cannot be achieved with Svelte modifiers
3. **Browser APIs require manual attachment** (e.g., ResizeObserver)
4. **Cross-iframe communication** where events bubble outside Svelte scope

**Example for legitimate manual listener**:
```javascript
onMount(() => {
  const resizeObserver = new ResizeObserver((entries) => {
    // Manual handling required for ResizeObserver API
  });
  resizeObserver.observe(element);

  onDestroy(() => {
    resizeObserver.disconnect();
  });
});
```

## Benefits

1. **Predictable Event Flow**: Single source of truth eliminates race conditions
2. **Framework Alignment**: Leverages Svelte's reactive system instead of fighting it
3. **Maintainability**: Clear, consistent code following Svelte best practices
4. **Performance**: No competing event listeners or unnecessary overhead
5. **Debugging**: Simpler event flow with fewer moving parts
6. **Consistency**: All components follow the same pattern

## Implementation Checklist

- [ ] Remove all manual `addEventListener` calls for UI interactions
- [ ] Replace with Svelte event modifiers using `on:event|modifier` syntax
- [ ] Use `preventDefault|stopPropagation` for context menus
- [ ] Keep interact.js only for drag/resize operations
- [ ] Ensure all canvas elements have proper context menu handlers
- [ ] Test all right-click scenarios (canvas, workspace, icons, panels)
- [ ] Verify no browser default menus appear

## Code Quality Standards

### Event Handler Naming
```javascript
// ✅ Descriptive, component-prefixed names
function handleCanvasContextMenu(event) { }
function handleIconClick(event) { }
function handleWorkspaceRightClick(event) { }

// ❌ Generic names
function handleClick(event) { }
function handler(event) { }
```

### Context Object Structure
```javascript
// ✅ Complete context information
const context = {
  type: 'canvas',           // Context type
  targetId: id,             // Unique identifier
  targetType: 'display',    // Semantic type
  displayId: id,            // Specific to displays
  symbol: symbol || 'unknown' // Additional data
};
```

### Console Logging for Debugging
```javascript
// ✅ Component-identified logging
console.log('🎨 [COMPONENT] Action description', { details });

// 🎨 Prefix indicates UI-related operations
// [COMPONENT] Indicates which component is handling the event
```

## Testing Guidelines

### Manual Testing Scenarios
1. **Canvas Right-Click**: Should show custom context menu, not browser menu
2. **Icon Right-Click**: Should show icon-specific options
3. **Workspace Right-Click**: Should show workspace options
4. **Event Propagation**: Verify clicking child elements doesn't trigger parent handlers
5. **Performance**: Test with multiple displays/panels open

### Automated Testing Pattern
```javascript
// Test event handler presence
const canvas = document.querySelector('canvas');
expect(canvas.hasAttribute('on:contextmenu')).toBe(true);

// Test context creation
const mockEvent = { clientX: 100, clientY: 100, preventDefault: jest.fn() };
handleCanvasContextMenu(mockEvent);
expect(mockEvent.preventDefault).toHaveBeenCalled();
```

## Migration Guide

### Step 1: Identify Manual Listeners
```bash
# Find all addEventListener calls in the codebase
grep -r "addEventListener" src/
```

### Step 2: Classify by Purpose
- **UI Interactions**: Convert to Svelte modifiers
- **API Requirements**: Keep as manual listeners
- **Performance Optimization**: Consider event delegation

### Step 3: Convert Pattern
```javascript
// Before
onMount(() => {
  element.addEventListener('click', handler);
  onDestroy(() => {
    element.removeEventListener('click', handler);
  });
});

// After
<div on:click={handler}></div>
```

### Step 4: Test Thoroughly
- Verify all interactions work as expected
- Test edge cases and timing issues
- Check performance with multiple elements

## Related Patterns

- **Component Communication**: Using `displayActions.showContextMenu()` for centralized state management
- **Context Detection**: Intelligent DOM traversal for context-aware menus
- **Event Cleanup**: Proper onDestroy patterns for manual listeners

## Anti-Patterns

❌ **Mixing Event Systems**:
```javascript
// Don't do this
<div on:click={handler} />
// And also this
element.addEventListener('click', handler);
```

❌ **Missing PreventDefault**:
```javascript
// Don't allow browser defaults for custom interactions
<canvas on:contextmenu={handler}></canvas> // Missing preventDefault
```

❌ **Generic Event Handlers**:
```javascript
// Don't use unclear handler names
function handleEvent(event) { /* unclear purpose */ }
```

## References

- [Svelte Event Modifiers Documentation](https://svelte.dev/docs#template-syntax-element-directives-on-eventname)
- [NeuroSense FX Philosophy: "Simple, Performant, Maintainable"]
- [interact.js Documentation](https://interactjs.io/docs/)

---

**Pattern Status**: ✅ Implemented and validated in NeuroSense FX canvas context menu fix
**Last Updated**: 2025-11-20
**Maintainer**: Development Team