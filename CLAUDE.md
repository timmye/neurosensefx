# NeuroSense FX Technical Architecture

## Purpose and User Context

**Who**: Foreign exchange traders monitoring multiple currency pairs during trading sessions.

**What problem it solves**: Standard trading platforms require constant analytical processing of numerical data. This platform provides visual patterns for quick understanding while monitoring multiple instruments.

**How it's used**: Multi-display workspace with keyboard-first interaction for rapid response during active trading. Visual patterns provide immediate understanding, with detailed numbers available when needed.

## Design Philosophy

**"Simple, Performant, Maintainable"**

### SIMPLE - Clear mental models and predictable behavior
- Intuitive components that behave consistently
- Minimal complexity in implementation
- Self-documenting code structure

### PERFORMANT - Handles professional trading requirements
- **60fps rendering** for smooth price movement visualization
- **Sub-100ms latency** from market data to visual display
- **DPR-aware crisp rendering** for precise numerical display
- **20+ concurrent displays** without performance degradation
- **Performance stability** without memory leaks or visual degradation

### MAINTAINABLE - Reliable when it matters
- Single responsibility components with clear interfaces
- Loose coupling for independent development and testing
- Extensible design for adding new visualization types

## Development Principles

**Framework-First Development**: Check existing tools, frameworks, and libraries before implementing custom solutions.

**Build Once, Use Everywhere**: Prefer centralized utility functions over duplicated implementations. When creating new helpers, make them reusable across components.

**Centralized Patterns**: Before creating custom implementations:
- **Configuration**: `src/config/CONFIGURATION_ARCHITECTURE.md`
- **Rendering**: `src/lib/viz/DPR_RENDERING_SYSTEM.md` and `src/lib/viz/DPR_EXAMPLES.md`
- **Communication**: `docs/WEB_WORKER_COMMUNICATION_PROTOCOL.md`

**Creating New Utilities**: If 3+ components need similar functionality, create centralized utilities with clear documentation and tests.

## Decision Framework

### Simple Considerations
- Clear, single purpose? Intuitive and predictable API?
- Follows established patterns in the codebase?

### Performant Considerations
- Maintains 60fps rendering during rapid price movements?
- Sub-100ms market data to visual display latency?
- Crisp, precise displays at all device pixel ratios?
- Stable memory usage during trading sessions?
- Handles 20+ simultaneous displays without degradation?

### Maintainable Considerations
- Can be tested independently? Changes affect others?
- Can new visualization types be added using this pattern?
- Clear code structure and documentation?

### User Context Check (MANDATORY)
- **Has this been validated with actual trader workflows on the production codebase?**
- **Have existing tests been analyzed to avoid duplication before creating new tests?**

## System Architecture

### Technology Stack
- **Frontend**: Svelte 4.x with Vite build system
- **Rendering**: Canvas 2D API with DPR-aware crisp rendering
- **State Management**: Centralized Svelte stores with web workers
- **Backend**: Node.js WebSocket server with cTrader Open API integration
- **Data Processing**: Real-time tick processing with WebSocket streaming

### System Structure
```
neurosensefx/
├── src/                    # Frontend Svelte application
├── services/tick-backend/  # Node.js WebSocket backend
├── libs/cTrader-Layer/     # cTrader API integration
└── run.sh                  # Service management
```

### Display Layers
- **Layer 1**: Trading displays (z-index: 1-999)
- **Layer 2**: UI panels (z-index: 1000-9999)
- **Layer 3**: Overlays (z-index: 10000+)

## Development Guidelines

### Code Standards
- **Event Handling**: Use Svelte's declarative event system (`on:contextmenu|preventDefault|stopPropagation`)
- **Canvas Rendering**: DPR-aware rendering for crisp text and numerical displays (see `src/lib/viz/DPR_RENDERING_SYSTEM.md`)

## Component System

### Visualization Components
- **Market Profile** (`marketProfile.js`): TPO-based volume profiling with delta analysis
- **Volatility Orb** (`volatilityOrb.js`): Dynamic volatility visualization with gradient rendering
- **Day Range Meter** (`dayRangeMeter.js`): ADR reference system with graduated markers
- **Price Display System**: Price Float (horizontal line), Price Display (monospaced), Price Markers (user-placed)

### Configuration System
- Schema-driven parameters (`src/config/CONFIGURATION_ARCHITECTURE.md`)
- Global configuration through `displayStore.defaultConfig`
- New displays inherit current runtime settings automatically
- Real-time configuration updates without restart

## Development Workflow

### Service Management
```bash
./run.sh dev       # Development with HMR (frontend 5174 + backend 8080)
./run.sh start     # Production mode (frontend 4173 + backend 8081)
./run.sh stop      # Stop all services
./run.sh status    # Check service health
./run.sh logs      # View service logs
```

### Environment
- **Development**: Vite dev server with HMR (port 5174), WebSocket (8080)
- **Production**: Optimized builds (port 4173), WebSocket (8081)
- **Environment variables**: Set in `.env` for cTrader API credentials

## Performance Optimizations

### Rendering
- DPR-aware text rendering for crisp display across devices
- RequestAnimationFrame for smooth 60fps updates
- Web Workers for heavy computation off main thread
- Dirty rectangle rendering where possible

### Memory Management
- Object lifecycle management to minimize pressure
- Dynamic resource allocation based on active display count
- Efficient update frequency for market data processing

### WebSocket Communication
- Connection management with automatic reconnection
- Structured message protocol for reliable data delivery
- Heartbeat mechanism for connection health monitoring

## Implementation Patterns

### State Management
```javascript
export const displayStore = writable({
  displays: new Map(),
  activeDisplays: [],
  defaultConfig: getEssentialDefaultConfig(),
  workspace: { layout: [], preferences: {} }
});
```

### Component Architecture
- Single responsibility principle with clear interfaces
- Configuration inheritance from runtime defaults
- Event-driven communication patterns
- Graceful degradation for edge cases

### Key Principles
- **Centralize before you create**: Check existing utilities first
- **Keyboard-first interaction**: Essential for rapid trading workflows
- **Visual patterns first**: Users glance at patterns, then access detailed numbers
- **Progressive disclosure**: Complexity increases with user engagement



## Testing and Quality Assurance

**Core Testing Commands:**
```bash
npm run test:unit         # Unit tests (Vitest) - pure business logic
npm run test:e2e          # End-to-end tests (Playwright) with integrated browser-logs
npm run test:browser-logs # Enhanced browser console system for comprehensive visibility
npm run test:all          # Complete test suite execution
```

### Enhanced Browser Console System

The enhanced browser console system provides comprehensive system visibility with emoji-based classification and focused log collectors for optimal LLM developer experience.

**System Features:**
- **Automatic Classification**: All console messages classified with visual emoji indicators (🌐⌨️❌✅🔥⚠️💡📦)
- **Focused Collectors**: Specialized log collectors for keyboard, performance, network, and error monitoring
- **Health Check Utilities**: Automated system validation and error analysis
- **Zero Infrastructure Overhead**: Pure Playwright native events with <1ms performance impact
- **LLM-Optimized Output**: Visual patterns and structured data for rapid comprehension

**Quick Access to System Visibility:**
```bash
npm run test:browser-logs  # Comprehensive console analysis with classification
npm run test:browser-logs | grep "❌"  # Error-focused debugging
npm run test:browser-logs | grep "🌐"  # Network activity monitoring
npm run test:browser-logs | grep "⌨️"  # Keyboard system debugging
npm run test:browser-logs | grep "🔥"  # Critical error identification
```

**Enhanced Classification System:**
- **🌐 Network Activity**: HTTP requests, WebSocket connections, API calls
- **⌨️ User Interactions**: Keyboard events, mouse actions, shortcut processing
- **❌ System Errors**: JavaScript errors, component failures, initialization issues
- **✅ Success Events**: Successful operations, completed workflows, achievements
- **🔥 Critical Issues**: Server errors, network failures, system crashes
- **⚠️ Warnings**: Deprecation notices, performance warnings, edge cases
- **💡 Debug Information**: Development logs, performance metrics, system insights
- **📦 Asset Loading**: Static resource requests, module loading, component imports

**Testing Philosophy: "Simple, Performant, Maintainable"**
- **Simple**: Centralized utility with drop-in integration, clear visual patterns
- **Performant**: Native Playwright events, single event handler setup, minimal overhead
- **Maintainable**: Consistent classification across all tests, reusable collectors

### Evidence Collection Requirements

**MANDATORY**: All testing MUST collect real browser evidence by running actual Playwright tests that test actual user workflows on the production codebase running in a real browser. Custom application test utilities, simulations, or mock interfaces are strictly forbidden.

**Production Codebase Definition:**
- **REQUIRED**: Current codebase tested via development server (`npm run dev`, localhost:5174)
- **FORBIDDEN**: Mock interfaces, simulated application behavior, custom test utilities

**Allowed Code:**
- Browser automation (Playwright APIs), keyboard/mouse simulation, DOM queries

**Forbidden Code:**
- Custom application testing utilities, component isolation testing, mock data generation

**Required Trader Workflows:**
- **Display Creation**: Ctrl+K → symbol search → Enter → display creation
- **Navigation**: Ctrl+Tab display switching during active market monitoring
- **Live Data Verification**: Real WebSocket data flow to visual display
- **Responsiveness**: Drag-resize, reposition during live market updates
- **Cleanup**: Ctrl+Shift+W display removal with resource cleanup

**Test Execution:**
```bash
npm run test:e2e                    # Primary workflow + enhanced browser-logs integration
npm run test:browser-logs           # Comprehensive system visibility and console analysis
npm run test:all                    # Complete test suite with unified logging
```

**Evidence Requirements:**
- Real browser traces of actual trader interactions via dev server
- Console logs verifying application console output from dev server
- Performance metrics from actual application execution

**Forbidding Testing Patterns:**
- NEVER create custom utilities to test application logic
- NEVER mock or simulate user workflows
- NEVER create isolated component tests separate from running application
- NEVER bypass the running application with custom test interfaces

**Test Analysis Requirements:**
- **ALWAYS analyze existing tests** in `tests/e2e/` directory first
- **ONLY create new tests** if existing tests don't cover the specific workflow
- **MODIFY existing tests** when enhancement is needed vs creating new files

**Reference**: `tests/e2e/primary-trader-workflow.spec.js` - demonstrates actual user workflows with real browser evidence collection.

**Key Testing Areas:**
- Visual accuracy: Canvas rendering with crisp numerical displays at all DPR levels
- Performance: 20+ displays without visual degradation or stuttering
- Real-time accuracy: Data-to-visual latency under 100ms
- Performance stability: Reliable operation without memory leaks
- Connection reliability: WebSocket stability and automatic reconnection
- Precision workflow: Keyboard accessibility for rapid, accurate trading decisions

## Contributing

**Development Workflow:**
1. Use `./run.sh dev` for development with hot reload
2. Follow "Simple, Performant, Maintainable" decision framework
3. Check existing utilities before creating new ones
4. Test with realistic conditions (multiple displays, trading workflows)
5. **Validate ALL changes with actual trader workflows on the production codebase** (MANDATORY)
6. **Use enhanced browser console for comprehensive system visibility**: `npm run test:browser-logs`
7. Document new patterns and utilities

**Testing Integration:**
- **Development**: `npm run test:unit -- --watch` for rapid feedback
- **Before commits**: `npm run test:e2e` for workflow validation with integrated browser-logs
- **System visibility**: `npm run test:browser-logs` for comprehensive console analysis
- **Complete validation**: `npm run test:all` for full test suite execution

**Code Standards:**
- Framework-first development approach
- Keyboard-first interaction design
- DPR-aware canvas rendering
- Centralized utility functions

## Current Status

**Production Maturity**: ~65% complete, functional for development and testing

**Current Capabilities:**
- ✅ Real-time FX market data visualization via cTrader integration
- ✅ Multiple display types with configuration management
- ✅ Drag-and-drop workspace management with persistence
- ✅ Environment-aware development and production modes
- ✅ Canvas rendering with DPR-aware text

**Development Environment:**
- HMR-enabled development workflow
- Comprehensive service management and monitoring
- Browser zoom awareness and responsive design

---

**NeuroSense FX** - Financial trading visualization platform focused on effective market data presentation.