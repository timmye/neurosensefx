# NeuroSense FX - Technical Context

## Technology Stack Overview

### Frontend Technologies
- **Framework**: Svelte 4.2.7 (highly performant, reactive UI framework)
- **Build Tool**: Vite 5.4.19 (fast development server and optimized builds)
- **Rendering**: HTML Canvas 2D API (hardware-accelerated graphics)
- **Animation**: Reactive rendering on data updates (not continuous requestAnimationFrame)
- **Visualization**: D3.js 7.9.0 (data-driven visualizations)
- **State Management**: Svelte stores (reactive state management)
- **Validation**: Zod 3.22.4 (runtime type validation)

### Backend Technologies
- **Runtime**: Node.js (JavaScript runtime)
- **Communication**: WebSockets (real-time bidirectional communication)
- **Data Processing**: Custom Node.js server
- **API Integration**: cTrader Open API (FX market data)

### Development Tools
- **Package Manager**: npm (Node.js package management)
- **Code Quality**: ESLint 8.56.0 (JavaScript linting)
- **Code Formatting**: Prettier 3.1.1 (consistent code formatting)
- **Version Control**: Git (source control management)
- **Environment**: VSCode dev contaienr

### Testing Infrastructure
- **Testing Framework**: Playwright (browser automation)
- **Baseline Testing**: 6 core workflow tests for continuous validation
- **Test Execution**: Under 30 seconds for baseline suite
- **Browser Testing**: Chromium (baseline), Chrome/Firefox/Safari/Edge (comprehensive)
- **Test Scripts**: Automated scripts for running and monitoring tests

### Shared Libraries
- **cTrader Layer**: @reiryoku/ctrader-layer (TypeScript API wrapper)
- **Protocol Buffers**: OpenAPI message definitions for cTrader
- **interact.js**: JavaScript library for drag and drop, resize and multi-touch gestures with inertia and snapping

## Development Environment Setup

### Project Structure
```
neurosense-fx/
├── src/                    # Frontend source code
│   ├── components/         # Svelte components
│   │   ├── shared/         # Shared UI components
│   │   │   └── InteractWrapper.svelte  # Unified drag functionality
│   ├── constants/          # Application constants
│   │   └── zIndex.js        # Z-index hierarchy for floating elements
│   ├── composables/        # Reusable Svelte composables
│   │   └── useDraggable.js  # Custom drag functionality
│   ├── data/              # Data handling and stores
│   │   └── ConnectionManager.js  # Centralized data flow management
│   ├── lib/               # Utility libraries
│   ├── stores/            # Svelte stores
│   ├── utils/             # Utility functions
│   │   └── positionPersistence.js  # Unified position persistence utilities
│   └── workers/           # Web Workers
├── services/
│   └── tick-backend/       # Backend Node.js service
├── libs/
│   └── cTrader-Layer/      # Shared TypeScript library
├── e2e/                   # End-to-end tests
│   ├── baseline/          # Baseline test suite (6 tests)
│   └── add-display-menu/  # Component-specific tests
├── scripts/               # Test and utility scripts
│   ├── test-baseline.sh   # Baseline test runner
│   └── monitor-baseline.cjs # Test output monitor
├── memory-bank/           # Project documentation
└── docs/                  # Additional documentation
```

### Build Configuration
- **Vite Config**: `vite.config.js` - Frontend server configuration
- **ESLint Config**: `.eslintrc.json` - Code quality rules
- **Prettier Config**: `.prettierrc` - Code formatting standards
- **TypeScript Config**: `tsconfig.json` (for cTrader layer)

### Development Workflow
1. **Setup**: `./setup_project.sh` - Automated environment configuration
2. **Development**: `./run.sh start` - Start all services (recommended)
3. **Testing**: `npm run test:baseline` - Run baseline tests (continuous workflow)
4. **Backend**: `./run.sh start` (starts both frontend and backend)
5. **Production**: `npm run build` - Create optimized build
6. **Quality**: `npm run lint` - Run code quality checks

## Technical Architecture

### Two-Server Architecture Pattern
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Frontend Server  │◄──►│   Backend Server  │◄──►│   cTrader API    │
│  (Vite/5173)      │    │   (Node/8080)     │    │   (External)     │
│                 │    │                 │    │                 │
│ • Svelte App    │    │ • WebSocket     │    │ • Market Data    │
│ • Hot Reload    │    │ • Data Process   │    │ • Price Ticks   │
│ • Dev Tools     │    │ • Client Mgmt    │    │ • Authentication│
│ • Source Maps   │    │ • API Integration│    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  │
                     ┌─────────────────┐
                     │  Browser Client  │
                     │                 │
                     │ • Canvas Renders │
                     │ • Web Worker     │
                     │ • Real-time UI   │
                     └─────────────────┘
```

### Frontend Server Architecture
```
Frontend Server (Port 5173)
├── Svelte Components
│   ├── Container.svelte (main visualization container)
│   ├── FloatingCanvas.svelte (floating display containers)
│   └── ConfigPanel.svelte (user controls)
├── State Management
│   ├── configStore.js (configuration state)
│   ├── symbolStateStore.js (symbol data)
│   ├── markerStore.js (price markers)
│   ├── workspaceState.js (workspace management)
│   └── uiState.js (UI state)
└── Canvas Rendering
    ├── Reactive rendering on data updates
    ├── Canvas 2D API drawing
    └── D3.js visualizations

Web Worker (Data Processing)
├── WebSocket Client
├── Data Processing
│   ├── Tick aggregation
│   ├── Market profile calculation
│   ├── Volatility analysis
│   └── ADR computation
└── Message Passing
    ├── postMessage to main thread
    └── onmessage from main thread
```

### Backend Server Architecture
```
Backend Server (Port 8080)
├── WebSocket Server
├── cTrader API Client
├── Data Processing
└── Client Management
```

## Rendering Architecture

### Reactive Rendering Pattern
NeuroSense FX uses a **render-on-update architecture** rather than continuous animation:

```javascript
// From Container.svelte - Reactive rendering block
$: if (ctx && state && config && $hoverState !== undefined && $markerStore !== undefined) {
  markers = $markerStore; // Update local markers variable
  draw(state, config, markers); // Trigger draw when data changes
}
```

**Key Characteristics**:
- **Event-Driven**: Renders only when data, config, or interaction state changes
- **Svelte Reactivity**: Leverages Svelte's reactive statements (`$:`) for efficient updates
- **Immediate Response**: No animation frame delay - renders immediately on state change
- **Performance Optimized**: No unnecessary rendering when data is static

### Drawing Order (Container.svelte)
```javascript
// Core visualizations (bottom layer)
drawMarketProfile(ctx, currentConfig, currentState, y);
drawDayRangeMeter(ctx, currentConfig, currentState, y);
drawVolatilityOrb(ctx, currentConfig, currentState, visualizationsContentWidth, meterHeight);
drawPriceFloat(ctx, currentConfig, currentState, y);
drawPriceDisplay(ctx, currentConfig, currentState, y, visualizationsContentWidth);
drawVolatilityMetric(ctx, currentConfig, currentState, visualizationsContentWidth, meterHeight);

// Interactive elements (middle layer)
drawPriceMarkers(ctx, currentConfig, currentState, y, markers);

// UI overlays (top layer)
drawHoverIndicator(ctx, currentConfig, currentState, y, $hoverState);
```

## Performance Considerations

### Frontend Rendering Optimization
- **Canvas vs DOM**: Canvas for all dynamic visualizations (20x faster than DOM)
- **Reactive Rendering**: Only renders when data actually changes
- **Immediate Updates**: No animation frame delay for instant response
- **Batch Updates**: Process multiple ticks before triggering re-render
- **Offscreen Canvas**: Pre-render complex visualizations when possible

### Data Processing Optimization
- **Web Workers**: All heavy computation off main thread
- **Message Throttling**: Limit data transfer between worker and main thread
- **Memory Management**: Efficient data structures for 20+ displays
- **Garbage Collection**: Minimize object creation in render loops

### Network Optimization
- **WebSocket Compression**: Enable message compression
- **Connection Pooling**: Reuse WebSocket connections
- **Fallback Handling**: Graceful degradation on connection loss
- **Data Caching**: Cache processed data for re-use

## Testing Infrastructure

### Baseline Testing Strategy
- **Purpose**: Fast, reliable feedback on core canvas-centric workflows
- **Test Count**: Exactly 5 tests (scope creep prevention)
- **Execution Time**: Under 30 seconds (when app loads properly)
- **Browser**: Chromium only for consistency
- **Focus**: Essential workflows only

### Test Commands
```bash
# Primary development workflow
npm run test:baseline              # Run baseline tests (6 tests, < 30s)

# Enhanced monitoring
npm run test:baseline:monitor     # Run with detailed output

# Component-specific testing
npm run test:component            # Test individual components

# Comprehensive testing
npm run test:full                 # All tests, < 10min
```

### Test Coverage
1. **Application Load Test** - Verifies error-free loading
2. **Layout Elements Test** - Validates floating panel visibility
3. **Empty State Test** - Checks workspace empty state
4. **Floating Panels Test** - Validates panel structure and controls
5. **Console Errors Test** - Ensures no critical errors
6. **Enhanced Context Menu Test** - Validates tabbed interface

### Testing Best Practices
- **Continuous Testing**: Run baseline tests after each code change
- **LLM-Friendly Design**: Clear output and error messages for programmatic access
- **Fast Feedback**: Under 30 seconds execution enables continuous testing
- **Scope Control**: Exactly 5 tests prevents scope creep

## Technical Constraints

### Browser Compatibility
- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Canvas Support**: Required for all visualizations
- **Web Worker Support**: Required for data processing
- **WebSocket Support**: Required for real-time data
- **ES6 Modules**: Required for modern JavaScript features

### Performance Requirements
- **Minimum**: 30fps with 5 active displays
- **Target**: 60fps equivalent response time with 20 active displays
- **Memory**: < 500MB RAM usage
- **CPU**: < 50% single core usage
- **Network**: < 100ms latency for data updates

### Data Limitations
- **Tick Rate**: Up to 100 ticks/second per symbol
- **Symbols**: Maximum 20 simultaneous displays
- **History**: 24-hour rolling window for market profile
- **WebSocket**: Maximum 1MB/second data transfer

## Development Constraints

### Code Quality Standards
- **ESLint**: Enforce consistent coding patterns
- **Prettier**: Maintain code formatting consistency
- **TypeScript**: Used for cTrader layer integration
- **Modular Design**: Keep components focused and reusable

### Security Considerations
- **API Keys**: Secure storage of cTrader credentials
- **WebSocket**: Secure connection protocols
- **Data Validation**: Zod schemas for all data structures
- **Cross-Origin**: CORS configuration for API access

### Deployment Requirements
- **Frontend**: Can be deployed to any static web server
- **Backend**: Requires Node.js runtime environment
- **WebSocket Port**: Default port 8080 (configurable)
- **Environment Variables**: Configuration via environment

## Server Configuration Details

### Frontend Server (Vite)
```javascript
// vite.config.js
export default defineConfig({
  plugins: [svelte()],
  server: {
    host: true, // Allow external connections
    proxy: {
      '/ws': {
        target: 'ws://127.0.0.1:8080', // Proxy to backend
        ws: true, // WebSocket proxy
      },
    },
  },
});
```

### Backend Server (Node.js)
```javascript
// services/tick-backend/server.js
const port = process.env.WS_PORT || 8080;
const session = new CTraderSession();
const wsServer = new WebSocketServer(port, session);
```

### Service Management (run.sh)
```bash
# Unified service management (primary interface)
./run.sh start         # Start all services (recommended)
./run.sh stop          # Stop all services
./run.sh status        # Check service status
./run.sh logs          # View service logs
./run.sh cleanup       # Clean up old processes
```

## Dependencies Management

### Frontend Dependencies
```json
{
  "dependencies": {
    "@reiryoku/ctrader-layer": "file:libs/cTrader-Layer",
    "d3": "^7.9.0",
    "interactjs": "^1.10.17",
    "svelte": "^4.2.7",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@playwright/test": "^1.56.0",
    "@sveltejs/vite-plugin-svelte": "^3.0.1",
    "eslint": "^8.56.0",
    "eslint-plugin-svelte": "^2.35.1",
    "prettier": "^3.1.1",
    "vite": "^5.4.19"
  }
}
```

### Tooling Versions
- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **Git**: 2.x or higher
- **VS Code**: Recommended IDE with Svelte extensions

### MCP Servers Integration
- **Context7 MCP Server**: Up-to-date library documentation access
  - Resolves library names to documentation IDs
  - Fetches current documentation for any library
  - Essential for maintaining accurate API references
  
- **Serena MCP Server**: Semantic code analysis and editing toolkit
  - **Installation**: UVX-based installation in DevContainer
  - **Configuration**: Project-specific YAML at `.serena/project.yml`
  - **Context**: IDE-assistant mode for VSCode integration
  - **Available Tools**: 
    - Symbol navigation (`find_symbol`, `find_references`, `find_definitions`)
    - Semantic editing (`edit_symbol`, `replace_symbol_body`)
    - Memory management (`write_memory`, `read_memory`, `list_memories`)
    - Project management (`activate_project`, `get_current_config`)
    - File operations (`list_dir`, `find_file`, `search_for_pattern`)
  - **Language Support**: JavaScript/TypeScript with TypeScript Language Server
  - **Web Dashboard**: Available at `http://127.0.0.1:24282/dashboard/index.html`
  - **Setup Script**: `./scripts/setup_serena.sh` for automated installation
  
- **Web Search Prime MCP Server**: Web search capabilities
  - Configurable search parameters (count, recency, content size)
  - Location filtering ("cn" Chinese region default, "us" available)
  - Manual location specification recommended for US region results
  - Tool: `webSearchPrime` with full parameter control

### Serena MCP Configuration
- **Project Configuration**: `.serena/project.yml` with NeuroSense FX specific settings
- **Language**: JavaScript (auto-detected, with TypeScript support)
- **Key Directories**: Configured for `src/components/viz`, `src/stores`, `src/workers`, `services/tick-backend`, `libs/cTrader-Layer`, `memory-bank`
- **Performance Context**: Aware of reactive rendering architecture, 20 display limit, 500MB memory constraint
- **Architecture Understanding**: Configured for two-server pattern (Vite/5173 + Node/8080)
- **Security**: Shell command execution disabled for safety

## Performance Monitoring

### Key Metrics
- **Response Time**: <100ms for user interactions (equivalent to 60fps)
- **Memory Usage**: <500MB with multiple displays
- **Data Latency**: <100ms from data receipt to visual update
- **Render Efficiency**: Only renders when data changes

### Monitoring Tools
- **Browser DevTools**: Performance profiling
- **MCP Tools**: Enhanced development capabilities
- **Service Logs**: `./run.sh logs [frontend|backend|all]`
- **Health Checks**: `./run.sh status`
- **Baseline Tests**: `npm run test:baseline` for continuous validation

This technical context provides comprehensive information about the two-server architecture, reactive rendering system, testing infrastructure, technologies, constraints, and MCP integration that guide development decisions.

## Recent Technical Enhancements (2025-10-18)

### Frontend Layering Structure
- **Z-Index Hierarchy Standardization**: Implemented standardized z-index hierarchy in `src/constants/zIndex.js`
  - BACKGROUND: 1 (Workspace container)
  - FLOATING_BASE: 1000 (Base for floating panels layer)
  - SYMBOL_PALETTE: 1001 (FloatingSymbolPalette)
  - DEBUG_PANEL: 1002 (FloatingDebugPanel)
  - SYSTEM_PANEL: 1003 (FloatingSystemPanel)
  - ADR_PANEL: 1004 (FloatingMultiSymbolADR)
  - FLOATING_CANVAS_BASE: 2000 (Base for floating canvases)
  - DRAGGING: 9999 (Any element being dragged)
  - CONTEXT_MENU: 10000 (CanvasContextMenu - always on top)

### Floating Panel Implementation with Interact.js
- **InteractWrapper Component**: Core component providing unified drag functionality
  - Uses interact.js library for robust drag operations
  - Implements viewport boundary checking with automatic adjustment
  - Provides position persistence via PositionPersistence utilities
  - Handles both mouse and touch events
  - Supports inertia and snap configuration support
- **PositionPersistence Utilities**: Unified position persistence utilities
  - Provides consistent localStorage-based persistence
  - Handles both position and state persistence
  - Includes methods for clearing and retrieving all saved positions

### Event Handling Architecture
- **WorkspaceEventManager**: Centralized event delegation with single listeners for multiple elements
- **InteractWrapper Integration**: Unified drag functionality using interact.js library
- **useDraggable Composable**: Custom drag implementation for components not using InteractWrapper
- **Event Flow Documentation**: Complete documentation of event handling patterns and flows

### Connection Management Architecture
- **ConnectionManager Class**: Centralized data flow management
  - Canvas subscription management (tracks which canvases are subscribed to which symbols)
  - Symbol data caching (caches symbol data to avoid duplicate requests)
  - Connection monitoring (monitors WebSocket status and handles reconnections)
  - Data source mode switching (handles switching between live and simulated data)

### Symbol Selection Implementation
- **FXSymbolSelector Component**: Advanced symbol selection with fuzzy search
  - Fuzzy matching implementation for symbol search
  - Full keyboard support with arrow keys and shortcuts
  - Visual feedback with matching character highlighting and subscription status
  - Debounced search implementation for performance optimization
  - Full ARIA support for screen readers

### New Dependencies
- **interactjs**: Added for unified drag functionality across all floating panels
  - Version: ^1.10.17
  - Purpose: Provides robust drag and drop, resize and multi-touch gestures with inertia and snapping

These technical enhancements provide a solid foundation for the floating workspace interface with consistent behavior, efficient event handling, and professional user experience. The implementation of standardized z-index hierarchy, unified drag functionality, and enhanced connection management significantly improves the maintainability and user experience of the application.