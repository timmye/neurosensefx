# Feature Parity Checklist

## MUST SURVIVE

### Core Interactions
- [ ] Drag floating displays
- [ ] Displays persist position on refresh
- [ ] Multiple displays can be open simultaneously
- [ ] Click to focus/bring to front
- [ ] Real-time price updates render smoothly

### Keyboard Shortcuts
- [ ] Shortcut to open new display
- [ ] Shortcut to close focused display
- [ ] Shortcuts documented and working

### Data Flow
- [ ] WebSocket connects to data source
- [ ] Symbol data routes to correct display
- [ ] Data updates trigger canvas re-render
- [ ] Connection loss handled gracefully

### Visual Quality
- [ ] DPR-aware rendering (crisp on Retina)
- [ ] Day Range Meter renders correctly
- [ ] Price labels readable
- [ ] Visual feedback on interaction

## CAN BE SIMPLIFIED

### Advanced Positioning
- Grid snapping (start without, add if needed)
- Collision detection (start without)
- Smart positioning (start without)

### Performance Infrastructure
- Performance monitoring (remove entirely)
- Memory tracking (remove entirely)
- Debug logging (remove entirely)

### Complex Validation
- Coordinate validation (simplify to bounds check)
- State validation (remove entirely)
- Schema validation (remove entirely)

## ACCEPTABLE REGRESSIONS

### During Initial Implementation
- Fewer visualization types (start with Day Range Meter only)
- No advanced layout features
- Simplified error messages
- No performance analytics