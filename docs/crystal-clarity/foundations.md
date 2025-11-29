# NeuroSense FX Technical Foundations

## Core Framework Stack

### Frontend Framework
- **Svelte 4.2.7** - Reactive UI framework with compiler optimizations
- **Vite 5.4.19** - Fast build tool with Hot Module Replacement (HMR)
- **@sveltejs/vite-plugin-svelte 3.0.1** - Official Svelte-Vite integration

### Data Visualization
- **D3.js 7.9.0** - Comprehensive data visualization library
- **d3-scale 4.0.2** - Scaling utilities for data visualization
- **Canvas 2D API** - High-performance rendering with DPR awareness

### Real-time Communication
- **WebSocket (ws) 8.18.3** - Real-time market data streaming
- **@reety/ctrader-layer** - cTrader API integration (local file)

### Development Tools
- **Vitest 1.0.0** - Fast unit testing framework
- **Playwright 1.56.1** - Cross-browser e2e testing
- **ESLint 8.56.0 + Prettier 3.1.1** - Code quality tools

## Build Configuration

### Development Environment
- Development server: `localhost:5174` with HMR
- WebSocket proxy: `ws://127.0.0.1:8080`
- File watching with 100ms polling interval
- Network-accessible development host

### Production Optimizations
- Modern ES2020 target for optimal performance
- Strategic code splitting:
  - `vendor-core`: Svelte + D3 utilities
  - `vendor-trading`: cTrader + WebSocket + drag-drop
  - `viz-core`: Visualization modules
  - `perf-monitoring`: Performance tools
- Terser minification with console removal
- Tree shaking for optimal bundle size

### Environment Awareness
- Built-in environment variables:
  - `__DEV__`, `__PROD__` for mode detection
  - `__FRONTEND_PORT__` for dynamic configuration
- Environment-specific port allocation

## Available Capabilities

### Reactive UI Development
```javascript
// Svelte reactivity system
let price = 0;
$: formattedPrice = price.toFixed(5);
```

### High-Performance Rendering
```javascript
// DPR-aware Canvas rendering
const dpr = window.devicePixelRatio || 1;
canvas.width = rect.width * dpr;
canvas.height = rect.height * dpr;
ctx.scale(dpr, dpr);
```

### Real-time Data Streaming
```javascript
// WebSocket integration
const ws = new WebSocket('ws://127.0.0.1:8080');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  updateDisplay(data);
};
```

### Module System
- Full ESM support with dynamic imports
- Top-level await for async initialization
- Modern browser API integration

### Testing Infrastructure
```javascript
// Playwright e2e testing
test('display creation workflow', async ({ page }) => {
  await page.goto('http://localhost:5174');
  await page.keyboard.press('Control+k');
  // ... test implementation
});
```

## Development Workflow

### Service Management
```bash
./run.sh dev     # Development with HMR
./run.sh start   # Production mode
./run.sh test    # Run test suite
```

### Hot Module Replacement
- Instant component updates without state loss
- Fast iteration cycle for development
- Automatic browser refresh on file changes

### Code Quality
- ESLint integration with Svelte-specific rules
- Prettier formatting for consistent code style
- TypeScript compatibility via JSDoc annotations

## Performance Foundations

### Rendering Pipeline
- RequestAnimationFrame for 60fps updates
- Canvas 2D API for high-performance drawing
- DPR-aware text rendering for crisp displays

### Memory Management
- Object lifecycle management
- Efficient update frequency handling
- Resource cleanup on component destruction

### Network Optimization
- WebSocket connection pooling
- Structured message protocol
- Automatic reconnection handling

## Simplification Opportunities

### Core Patterns to Leverage
1. **Component Architecture**: Single responsibility Svelte components
2. **State Management**: Centralized stores with reactive updates
3. **Event System**: Declarative event handling with Svelte directives
4. **Configuration**: Schema-driven parameters with Zod validation

### Build Optimization Strategy
1. **Code Splitting**: Separate visualization from utility functions
2. **Tree Shaking**: Eliminate unused code paths
3. **Dynamic Imports**: Load features on-demand
4. **Bundle Analysis**: Monitor and optimize chunk sizes

## Framework Strengths for Simple Implementation

### Development Speed
- HMR eliminates build delays
- Svelte's minimal syntax reduces cognitive load
- Comprehensive error reporting

### Performance
- Compiled Svelte components run efficiently
- Vite's optimized builds minimize overhead
- Modern browser features fully supported

### Maintainability
- Clear separation of concerns
- Standardized tooling and workflows
- Comprehensive testing infrastructure

### Extensibility
- Plugin-based architecture for new features
- Modular design supports incremental development
- Framework-agnostic utility functions

---

This foundation provides a robust, modern JavaScript stack optimized for building high-performance trading visualization applications with minimal complexity.