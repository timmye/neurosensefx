# Container-Content-Rendering Pipeline Documentation

## Container.svelte provides unified display lifecycle management.

The pipeline separates container management, data processing, and visualization rendering into three distinct layers that work together through standardized interfaces.

## Architecture Pattern

### Container Layer (Container.svelte)
Container components handle physical dimensions, DPR scaling, and rendering orchestration. They create a unified rendering context that gets passed to all visualization functions.

```javascript
// Container creates rendering context
const renderingContext = {
  containerSize,     // Physical dimensions
  contentArea,       // Available drawing area
  adrAxisX          // Derived layout positions
};
```

### Content Layer (Rendering Libraries)
Visualization libraries implement `drawFunction(ctx, renderingContext, config, state, y)` pattern. Each library focuses solely on its visualization algorithm without container concerns.

### Configuration Inheritance
New displays inherit runtime settings from `displayStore.defaultConfig`. Configuration updates propagate automatically without restart through reactive Svelte stores.

## Display Lifecycle

### Creation Pattern
```javascript
// 1. Container setup with reactive rendering context
$: if (canvas && config) {
  renderingContext = createRenderingContext(containerSize, config);
}

// 2. Reactive drawing trigger
$: if (ctx && state && config) {
  draw(state, renderingContext, markers);
}
```

### Destruction Pattern
Container components use Svelte's `onDestroy` for cleanup. Rendering libraries are stateless - container manages all lifecycle.

## Integration Points

### Adding New Visualizations
1. Create rendering library in `/src/lib/viz/` with `draw{Name}` export
2. Import and call in Container.svelte draw function
3. Add configuration options to `src/data/schema.js`
4. Inherit from `displayStore.defaultConfig` automatically

### Standard Function Signature
```javascript
export function drawVisualization(ctx, renderingContext, config, state, y) {
  if (!config.showVisualization) return;
  // Rendering implementation using renderingContext dimensions
}
```

The container handles DPR scaling, context management, and error boundaries. Rendering libraries focus purely on visualization algorithms using the provided context and scales.