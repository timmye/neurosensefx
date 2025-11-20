# hoverIndicator Design Specification

## Executive Summary

hoverIndicator provides traders with precise vertical hover tracking and delta measurement capabilities, enabling exact price level identification and distance calculation between market points with pixel-perfect accuracy and responsive real-time updates.

## Core Features

- **Vertical Hover Line**: Configurable horizontal line that follows mouse movement across canvas
- **Real-time Price Display**: Current price shown on right side of canvas at hover position (configurable)
- **DeltaMode**: Right-click + drag interaction to measure distance between two price points
  - Shows start price, current hover price, and delta (absolute and/or percentage)
  - Visual connection line between measurement points
- **PriceMarkers Integration**: Seamless visual appearance as part of the price markers system

## Technical Implementation

### Function Signature
```javascript
export function drawHoverIndicator(ctx, renderingContext, config, state, y, hoverState)
```

### Rendering Pipeline Position
Drawn after `priceMarkers` and before `priceDisplay` to appear as interactive overlay.

### Integration Points
- **Mouse Events**:Event handling architechture - docs/patterns/event-handling-architecture.md. Svelte's declarative event system as the single source of truth for all UI interactions. Only use manual event listeners for specialized cases that Svelte cannot handle.
- **Hover State Store**: Reactive state management for cross-component communication
- **PriceMarkers**: Visual consistency with existing marker system (line styles, colors)

## Configuration Parameters

### Essential Parameters
```javascript
hoverIndicator: {
  showHoverLine: { type: 'boolean', default: true },
  showPriceDisplay: { type: 'boolean', default: true },
  lineColor: { type: 'string', default: 'rgba(100, 150, 200, 0.8)' },
  lineWidth: { type: 'number', default: 1 },
  priceDisplayPosition: { type: 'select', options: ['right', 'left'], default: 'right' }
}
```

### DeltaMode Parameters
```javascript
deltaMode: {
  enableDeltaMode: { type: 'boolean', default: true },
  displayFormat: { type: 'select', options: ['absolute', 'percentage', 'both'], default: 'both' },
  connectionLineColor: { type: 'string', default: 'rgba(150, 200, 100, 0.6)' },
  connectionLineWidth: { type: 'number', default: 2 }
}
```

## Performance Notes

- **High-Frequency Updates**: Acceptable performance cost during active hover for maximum responsiveness
- **Bounds Checking**: Skip rendering when hover position outside content area
- **Early Exits**: Return immediately when disabled or no valid hover state
- **DPR-Aware Rendering**: Sub-pixel alignment for crisp line rendering

## User Interaction

### Standard Hover Mode
- Mouse movement → vertical line follows cursor
- Price display updates in real-time at hover position
- Visual feedback identical to priceMarkers styling

### DeltaMode
- Right-click + hold → start measurement point
- Drag to new position → show start price, current price, and delta
- Release → clear measurement, return to standard hover

## Integration Requirements

- **Mouse Event System**:Svelte's declarative event system as the single source of truth for all UI interactions. Only use manual event listeners for specialized cases that Svelte cannot handle.
- **State Management**: Add hoverState store for reactive updates
- **Workspace Persistence**: Save hover indicator preferences with other display settings
- **Error Handling**: Graceful fallback when hover state invalid