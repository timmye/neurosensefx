# NeuroSense FX Development Patterns

## Overview
This directory contains architectural patterns and best practices established during NeuroSense FX development, aligned with our philosophy of **"Simple, Performant, Maintainable"**.

## Available Patterns

### 📱 [Event Handling Architecture](./event-handling-architecture.md)
**Focus**: Svelte-First Event Handling with Manual PreventDefault

**Problem Solved**: Canvas right-click showing browser context menu instead of trading controls
**Key Insight**: Use Svelte's declarative event system as single source of truth

**Quick Reference**:
```html
<!-- ✅ Correct: Svelte modifiers -->
<canvas on:contextmenu|preventDefault|stopPropagation={handleCanvasContextMenu}></canvas>

<!-- ❌ Wrong: Manual listeners competing with framework -->
<script>
onMount(() => {
  canvas.addEventListener('contextmenu', handler); // Don't do this
});
</script>
```

## Pattern Categories

### 🎨 UI Interaction Patterns
- Event handling architecture (above)
- Context menu systems
- Drag and drop with interact.js
- Keyboard shortcuts

### 🔧 Component Architecture
- Container-Content-Rendering pipeline
- Store management patterns
- Component lifecycle management

### 📊 Data Flow Patterns
- WebSocket integration
- Market data processing
- Configuration inheritance
- Workspace persistence

### 🎯 Performance Patterns
- Canvas rendering optimization
- Memory management
- RequestAnimationFrame usage
- Dirty rectangle rendering

### 🛠️ Development Workflow
- HMR-enabled development
- Snapshot management
- Environment awareness
- Debug logging

## Pattern Application Guidelines

### When to Create a Pattern
1. **Solves a recurring problem** across multiple components
2. **Aligns with project philosophy** (Simple, Performant, Maintainable)
3. **Has been tested and validated** in production
4. **Reduces complexity** rather than adding abstractions

### Pattern Structure
Each pattern document includes:
- **Problem Statement**: What issue this solves
- **Context**: When and where this pattern applies
- **Solution**: Detailed implementation with code examples
- **Benefits**: Why this approach is better
- **Anti-Patterns**: What to avoid
- **Migration Guide**: How to adopt the pattern

## Philosophy Alignment

### Simple
- Clear, readable code
- Minimal abstractions
- Direct solutions to problems

### Performant
- Efficient resource usage
- Optimized rendering
- Minimal overhead

### Maintainable
- Consistent patterns
- Clear documentation
- Easy to modify and extend

## Contributing Patterns

When adding new patterns:

1. **Validate the solution**: Test thoroughly in the actual application
2. **Document the process**: Show problem → solution transformation
3. **Include code examples**: Real, working code from the codebase
4. **Provide migration path**: How others can adopt this pattern
5. **Test with examples**: Include testing guidelines

## Pattern Evolution

Patterns should evolve based on:
- **Real-world usage**: Feedback from actual development
- **Framework changes**: Adapting to new Svelte/Web features
- **Performance insights**: Data from production usage
- **Team experience**: Lessons learned from implementation

---

**Last Updated**: 2025-11-20
**Maintainers**: NeuroSense FX Development Team
**Philosophy**: Simple, Performant, Maintainable