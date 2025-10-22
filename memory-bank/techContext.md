# NeuroSense FX - Technical Context

## Technology Stack Overview

### Frontend Technologies ✅ COMPLETE

#### **Core Framework**
- **Svelte 4.2.7**: Reactive UI framework chosen for performance and simplicity
  - Minimal runtime overhead
  - Built-in state management with stores
  - Excellent TypeScript support
  - Component-based architecture

#### **Build Tools**
- **Vite 5.4.19**: Next-generation build tool and development server
  - Lightning-fast hot module replacement
  - Optimized development experience
  - Production-ready bundling
  - WebSocket proxy configuration for backend integration

#### **Visualization Libraries**
- **D3.js 7.9.0**: Data-driven visualization library
  - Powerful data binding and manipulation
  - Extensive visualization primitives
  - SVG and Canvas rendering support
  - Custom visualization components

#### **UI Interaction**
- **interact.js 1.10.27**: Drag and drop, resize, and gesture library
  - Multi-touch gesture support
  - Smooth drag-and-drop functionality
  - Resize handles for floating panels
  - Custom interaction constraints

#### **Data Validation**
- **Zod 3.22.4**: TypeScript-first schema validation
  - Runtime type validation
  - Infer TypeScript types from schemas
  - API response validation
  - Configuration validation

### Backend Technologies ✅ COMPLETE

#### **Runtime Environment**
- **Node.js**: JavaScript runtime for backend server
  - WebSocket server implementation
  - Real-time data processing
  - API integration layer
  - Client connection management

#### **WebSocket Communication**
- **ws 8.18.3**: WebSocket library for Node.js
  - High-performance WebSocket server
  - Connection lifecycle management
  - Message broadcasting
  - Error handling and recovery

#### **cTrader Integration**
- **@reiryoku/ctrader-layer**: Custom TypeScript wrapper for cTrader API
  - Type-safe API integration
  - Authentication handling
  - Real-time market data streaming
  - Error handling and retry logic

### Development Tools ✅ COMPLETE

#### **Testing Framework**
- **Playwright 1.56.0**: End-to-end testing framework
  - Cross-browser testing (Chrome, Firefox, Safari, Edge)
  - Visual regression testing
  - API testing capabilities
  - Parallel test execution

#### **Code Quality**
- **ESLint 8.56.0**: JavaScript/TypeScript linting
  - Code consistency enforcement
  - Error detection
  - Style guidelines
  - Integration with Svelte

#### **Code Formatting**
- **Prettier 3.1.1**: Opinionated code formatter
  - Consistent code formatting
  - Automatic code fixing
  - Integration with ESLint
  - Custom formatting rules

#### **TypeScript Support**
- **@types/node 24.7.2**: Node.js type definitions
  - Type safety for Node.js APIs
  - Improved development experience
  - Better IDE support
  - Runtime type checking

## Development Environment Setup

### **Project Structure**
```
neurosense-fx/
├── src/                          # Frontend source code
│   ├── components/               # Svelte components
│   │   ├── FloatingDisplay.svelte
│   │   ├── FloatingPanel.svelte
│   │   ├── ContextMenu.svelte
│   │   └── SymbolPalette.svelte
│   ├── stores/                   # Svelte stores
│   │   ├── floatingStore.js     # Centralized state management
│   │   └── markerStore.js       # Marker state
│   ├── lib/                      # Utility libraries
│   │   └── viz/                  # Visualization components
│   │       ├── dayRangeMeter.js
│   │       ├── priceDisplay.js
│   │       └── marketProfile.js
│   ├── workers/                  # Web Workers
│   │   └── dataProcessor.js     # Data processing worker
│   ├── utils/                    # Utility functions
│   └── App.svelte               # Root component
├── services/                     # Backend services
│   └── tick-backend/            # WebSocket backend
│       ├── server.js            # Main server file
│       ├── WebSocketServer.js   # WebSocket handling
│       └── CTraderSession.js    # cTrader API integration
├── libs/                        # External libraries
│   └── cTrader-Layer/          # TypeScript API wrapper
├── tests/                       # Test files
├── e2e/                         # End-to-end tests
├── docs/                        # Documentation
├── scripts/                     # Build and utility scripts
└── memory-bank/                 # Project memory bank
```

### **Development Server Configuration**

#### **Frontend Server (Vite)**
```javascript
// vite.config.js
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: 'ws://127.0.0.1:8080',
        ws: true,
        changeOrigin: true
      }
    }
  },
  plugins: [sveltekit()]
});
```

#### **Backend Server (Node.js)**
```javascript
// services/tick-backend/server.js
const WebSocketServer = require('./WebSocketServer');
const CTraderSession = require('./CTraderSession');

const server = new WebSocketServer(8080);
const ctrader = new CTraderSession();

server.start();
```

### **Package Management**
```json
{
  "scripts": {
    "dev": "vite",                    # Start frontend server
    "start": "./run.sh start",        # Start both servers
    "stop": "./run.sh stop",          # Stop both servers
    "status": "./run.sh status",      # Check server status
    "test": "npm run test:baseline",  # Run baseline tests
    "build": "vite build",            # Build for production
    "preview": "vite preview"         # Preview production build
  }
}
```

## Performance Optimization

### **Canvas Rendering Optimization** 🔄 80% COMPLETE

#### **Hardware Acceleration**
- **GPU Acceleration**: Canvas 2D context with hardware acceleration
- **RequestAnimationFrame**: Smooth 60fps rendering loop
- **Object Pooling**: Reuse canvas objects to reduce garbage collection
- **Dirty Rectangle Rendering**: Only update changed canvas regions

#### **Memory Management**
- **Web Workers**: Offload data processing from main thread
- **Lazy Loading**: Load visualization components on demand
- **Memory Pooling**: Reuse frequently allocated objects
- **Component Cleanup**: Proper cleanup on component destruction

### **WebSocket Optimization** ✅ COMPLETE

#### **Connection Management**
- **Connection Pooling**: Efficient client connection handling
- **Message Batching**: Batch multiple updates for efficiency
- **Compression**: Message compression for large data payloads
- **Reconnection Logic**: Automatic reconnection with exponential backoff

#### **Data Processing**
- **Stream Processing**: Real-time data stream processing
- **Data Caching**: Cache computed values for reuse
- **Throttling**: Rate limit updates to prevent flooding
- **Prioritization**: Prioritize critical data updates

## Browser Compatibility

### **Target Browsers** ✅ COMPLETE
- **Chrome 90+**: Primary development target
- **Firefox 88+**: Full feature support
- **Safari 14+**: Modern Safari support
- **Edge 90+**: Chromium-based Edge support

### **Feature Requirements**
- **WebSocket API**: Real-time communication
- **Canvas 2D API**: Hardware-accelerated rendering
- **ES6 Modules**: Modern JavaScript module system
- **Web Workers**: Background data processing
- **RequestAnimationFrame**: Smooth animations

### **Polyfills and Fallbacks**
- **WebSocket Polyfill**: For older browser support
- **Canvas Fallback**: Basic rendering for unsupported browsers
- **ES6 Shim**: For older JavaScript environments

## Security Considerations

### **Frontend Security** ✅ COMPLETE
- **Content Security Policy**: Restrict resource loading
- **XSS Prevention**: Input sanitization and validation
- **Secure WebSocket**: WSS for production deployments
- **Authentication**: Token-based authentication system

### **Backend Security** ✅ COMPLETE
- **Input Validation**: Zod schema validation
- **Rate Limiting**: Prevent API abuse
- **CORS Configuration**: Cross-origin resource sharing
- **Environment Variables**: Secure configuration management

## Deployment Architecture

### **Development Environment**
```bash
# Start development servers
./run.sh start

# Frontend: http://localhost:5173
# Backend: ws://localhost:8080
```

### **Production Deployment**
```bash
# Build frontend
npm run build

# Deploy backend (Node.js)
node services/tick-backend/server.js

# Serve frontend (static files)
npm run preview
```

### **Container Support** 🔄 IN PROGRESS
- **Dockerfile**: Containerized deployment
- **Docker Compose**: Multi-service orchestration
- **Environment Configuration**: Production-ready settings
- **Health Checks**: Service monitoring and recovery

## Monitoring and Debugging

### **Development Tools** ✅ COMPLETE
- **Browser DevTools**: Chrome DevTools integration
- **Svelte DevTools**: Component debugging
- **WebSocket Inspector**: Real-time message monitoring
- **Performance Profiler**: Canvas rendering performance

### **Production Monitoring** 🔄 PLANNED
- **Error Tracking**: Sentry integration
- **Performance Monitoring**: Rendering performance metrics
- **Usage Analytics**: Feature usage tracking
- **Health Monitoring**: Service health checks

## Testing Strategy

### **Unit Testing** 🔄 PLANNED
- **Component Testing**: Svelte component unit tests
- **Utility Testing**: Function and class testing
- **Store Testing**: State management testing
- **API Testing**: Backend endpoint testing

### **Integration Testing** 🔄 70% COMPLETE
- **WebSocket Testing**: Real-time communication testing
- **Canvas Testing**: Visualization rendering testing
- **Data Flow Testing**: End-to-end data flow validation
- **Performance Testing**: Load and stress testing

### **End-to-End Testing** ✅ COMPLETE
- **Playwright Tests**: Cross-browser E2E testing
- **Visual Regression**: UI consistency testing
- **User Workflow Testing**: Complete user journey testing
- **Accessibility Testing**: WCAG compliance testing

## Technical Constraints and Limitations

### **Browser Limitations**
- **Single-threaded Rendering**: Canvas rendering on main thread
- **Memory Limits**: Browser memory constraints
- **WebSocket Connection Limits**: Connection pooling requirements
- **Cross-origin Restrictions**: CORS and security policies

### **Performance Constraints**
- **60fps Target**: Maintain smooth animations
- **20 Display Limit**: Maximum simultaneous displays
- **Sub-100ms Latency**: Real-time data update requirements
- **500MB Memory Limit**: Browser memory usage constraints

### **Development Constraints**
- **Browser-based**: No desktop application deployment
- **Real-time Requirements**: WebSocket connection dependency
- **Canvas Complexity**: Limited 2D rendering capabilities
- **API Dependencies**: External cTrader API availability

This technical context provides the foundation for understanding the technology stack, development environment, and technical constraints that shape the NeuroSense FX implementation.
