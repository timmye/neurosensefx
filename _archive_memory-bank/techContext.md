# NeuroSense FX - Technical Context

## Technology Stack Overview

### Frontend Technologies
- **Framework**: Svelte 4.2.7 (highly performant, reactive UI framework)
- **Build Tool**: Vite 5.4.19 (fast development server and optimized builds)
- **Rendering**: HTML Canvas 2D API (hardware-accelerated graphics)
- **Animation**: requestAnimationFrame loop (60fps rendering)
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
- **Environment**: Firebase Studio IDX (cloud development environment)

### Shared Libraries
- **cTrader Layer**: @reiryoku/ctrader-layer (TypeScript API wrapper)
- **Protocol Buffers**: OpenAPI message definitions for cTrader

## Development Environment Setup

### Project Structure
```
neurosense-fx/
├── src/                    # Frontend source code
│   ├── components/         # Svelte components
│   ├── data/              # Data handling and stores
│   ├── lib/               # Utility libraries
│   ├── stores/            # Svelte stores
│   └── workers/           # Web Workers
├── services/
│   └── tick-backend/       # Backend Node.js service
├── libs/
│   └── cTrader-Layer/      # Shared TypeScript library
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
3. **Backend**: `node services/tick-backend/server.js` - Start backend server
4. **Frontend Only**: `npm run dev` - Start frontend only
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
│ • Source Maps   │    │ • API Proxy      │    │                 │
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
│   ├── VizDisplay.svelte (individual price display)
│   └── ConfigPanel.svelte (user controls)
├── State Management
│   ├── configStore.js (configuration state)
│   ├── symbolStateStore.js (symbol data)
│   ├── markerStore.js (price markers)
│   └── uiState.js (UI state)
└── Canvas Rendering
    ├── requestAnimationFrame loop
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

## Performance Considerations

### Frontend Rendering Optimization
- **Canvas vs DOM**: Canvas for all dynamic visualizations (20x faster than DOM)
- **Frame Rate**: Locked to 60fps using requestAnimationFrame
- **Batch Updates**: Process multiple ticks before rendering
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

## Technical Constraints

### Browser Compatibility
- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Canvas Support**: Required for all visualizations
- **Web Worker Support**: Required for data processing
- **WebSocket Support**: Required for real-time data
- **ES6 Modules**: Required for modern JavaScript features

### Performance Requirements
- **Minimum**: 30fps with 5 active displays
- **Target**: 60fps with 20 active displays
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
- **Environment Variables**: Configuration via environment variables

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
# Service management options
./run.sh start         # Both servers together (recommended)
npm run dev           # Frontend server only (port 5173)
node server.js        # Backend server only (port 8080)
```

## Dependencies Management

### Frontend Dependencies
```json
{
  "dependencies": {
    "@reiryoku/ctrader-layer": "file:libs/cTrader-Layer",
    "d3": "^7.9.0",
    "svelte": "^4.2.7",
    "zod": "^3.22.4"
  },
  "devDependencies": {
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
- **Performance Context**: Aware of 60fps target, 20 display limit, 500MB memory constraint
- **Architecture Understanding**: Configured for two-server pattern (Vite/5173 + Node/8080)
- **Security**: Shell command execution disabled for safety

This technical context provides comprehensive information about the two-server architecture, technologies, constraints, and MCP integration that guide development decisions.
