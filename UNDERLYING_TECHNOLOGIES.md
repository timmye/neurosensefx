# Underlying Technologies for NeuroSense FX Floating Interface

## Core Technologies

1. **HTML5 Canvas API**
   - Real-time data visualization and rendering
   - Custom chart components (price floats, volatility orbs, market profiles)
   - Hardware-accelerated 2D graphics

2. **CSS3 Transforms & Animations**
   - Smooth UI transitions and floating element animations
   - Hardware-accelerated transforms for 60 FPS performance
   - Glass-morphism effects and visual styling

3. **Custom Drag & Drop Implementation**
   - Draggable floating panels and icons
   - Position persistence and constraint management
   - Z-index layering for proper element stacking

4. **LocalStorage API**
   - User preference and workspace layout persistence
   - Element positioning data storage
   - Cross-session state management

5. **JavaScript Event System**
   - Comprehensive keyboard shortcuts
   - Mouse/touch interaction handling
   - Event delegation for performance optimization

## Supporting Technologies

6. **CSS Variables (Custom Properties)**
   - Dynamic theming and design system
   - Consistent spacing and color management
   - Real-time style updates

7. **RequestAnimationFrame API**
   - Smooth 60 FPS canvas rendering
   - Optimized animation timing
   - Browser-friendly animation loops

8. **JSON (JavaScript Object Notation)**
   - Workspace configuration storage
   - Data serialization for import/export
   - State management format

## Potential Enhancement (Not Currently Implemented)

9. **Web Workers**
   - Background data processing (see src/workers/dataProcessor.js)
   - Non-blocking computation for complex calculations
   - Parallel processing for multi-symbol data analysis
   - Canvas rendering in separate threads to prevent UI blocking

## Performance Considerations

- **Canvas Limit**: ~20 concurrent canvases for optimal performance
- **Memory Usage**: ~50-100MB total application footprint
- **Storage Limit**: 5-10MB per domain in LocalStorage
- **Rendering Budget**: 16.67ms per frame for 60 FPS target

## Browser Compatibility

- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Universal support for all core APIs
- Progressive enhancement for older browsers