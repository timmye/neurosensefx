# NeuroSense FX Technical Architecture

## Purpose and User Context

**Who this is for:** Foreign exchange traders who monitor multiple currency pairs during trading sessions.

**What problem it solves:** Standard trading platforms require constant analytical processing of numerical data. This platform provides visual patterns for quick understanding while monitoring multiple instruments.

**How it's used:**
- Multi-display workspace for watching 5-20 currency pairs simultaneously
- Keyboard-first interaction for rapid response during active trading
- Trading sessions with visual comfort and reduced eye strain
- Visual patterns for immediate understanding, with detailed numbers available when needed

**Core approach:** Visual metaphors combined with targeted numerical displays. Users glance at patterns for market state understanding and access precise values when required for analysis.

## Design Philosophy

**Project Technical Philosophy: "Simple, Performant, Maintainable"**

#### **SIMPLE** - Clear mental models and predictable behavior
- Intuitive components that behave consistently
- Minimal complexity in implementation
- Self-documenting code structure

#### **PERFORMANT** - Handles professional trading requirements
- **60fps rendering** for smooth price movement visualization without stuttering during rapid market changes
- **Sub-100ms latency** from market data to visual display for real-time decision accuracy
- **DPR-aware crisp rendering** for precise numerical display and reduced eye strain during trading sessions
- **20+ concurrent displays** for comprehensive multi-instrument monitoring without performance degradation
- **Performance stability** for reliable trading session coverage without memory leaks or visual degradation

#### **MAINTAINABLE** - Reliable when it matters
- Single responsibility components with clear interfaces
- Loose coupling for independent development and testing
- Extensible design for adding new visualization types

**Project Development Principles**

**Framework-First Development:** Check existing tools, frameworks, and libraries before implementing custom solutions. Consult official documentation and established patterns in the codebase.

**Project Philosophy: Build Once, Use Everywhere**
- Prefer centralized utility functions over duplicated implementations
- When creating a new helper or pattern, make it reusable across components
- Document and test shared utilities as first-class citizens
- Build for composition: small, focused utilities that combine to solve complex problems

**Centralized Development Patterns**
The project provides centralized utilities documented in focused files. Before creating custom implementations:

- **Configuration:** See `src/config/CONFIGURATION_ARCHITECTURE.md`
- **Rendering:** See `src/lib/viz/DPR_RENDERING_SYSTEM.md` and `src/lib/viz/DPR_EXAMPLES.md`
- **Communication:** See `docs/WEB_WORKER_COMMUNICATION_PROTOCOL.md`
- **State Management:** Refer to component-specific documentation

**Creating New Utilities:** If 3+ components need similar functionality, create centralized utilities with clear documentation and tests.

## Development Decision Framework

When making implementation decisions, use this framework to ensure alignment with user needs and technical goals:

### **Simple Considerations**
- Does this component have a clear, single purpose?
- Is the API intuitive and predictable?
- Will other developers understand this quickly?
- Does it follow established patterns in the codebase?

### **Performant Considerations**
- Does this maintain 60fps rendering during rapid price movements without stuttering?
- Does market data reach the visual display in under 100ms for real-time accuracy?
- Are numerical displays crisp and precise at all device pixel ratios?
- Will memory usage remain stable during trading sessions?
- Can this handle 20+ simultaneous displays without visual degradation?

### **Maintainable Considerations**
- Can this component be tested independently?
- Does changing this component affect others?
- Can new visualization types be added using this pattern?
- Is the code structure clear and documented?

### **User Context Check**
- Does this provide precise, accurate visual representation of market data?
- Are numerical displays crisp and readable during rapid price movements?
- Can this be used effectively for trading sessions without eye strain?
- Does keyboard-first interaction provide rapid access during time-critical decisions?
- Will visual displays remain accurate and responsive during volatile market conditions?
- **Has this been validated with actual trader workflows on the production codebase?** (MANDATORY)
- **Have existing tests been analyzed to avoid duplication before creating new tests?** (MANDATORY)

## User Workflows This System Supports

### **Multi-Instrument Monitoring**
- Traders watch 5-20 currency pairs simultaneously
- Each display shows one instrument with multiple visualization layers
- Layout is organized for efficient scanning and pattern recognition
- Visual relationships between instruments support correlation analysis

### **Extended Trading Sessions**
- Extended continuous use during market hours
- Visual comfort and reduced eye strain are essential
- Interface must remain responsive throughout long sessions
- Memory and CPU efficiency prevent degradation over time

### **Rapid Response Requirements**
- Keyboard-first interaction for efficiency during active trading
- Real-time updates during volatile market periods
- Immediate feedback for user interactions
- Smooth visual transitions for price movement tracking

### **Analysis and Decision Support**
- Visual patterns provide quick market state information
- Detailed numerical data available for specific analysis
- Configuration options adapt to different trading strategies
- Historical context assists with current market positioning

## Current System Architecture

### Technology Stack
- **Frontend**: Svelte 4.x with Vite build system
- **Rendering**: Canvas 2D API with DPR-aware crisp rendering
- **State Management**: Centralized Svelte stores with web workers
- **Backend**: Node.js WebSocket server with cTrader Open API integration
- **Data Processing**: Real-time tick processing with WebSocket streaming

### System Structure
```
neurosensefx/                          # Root repository
├── src/                               # Frontend Svelte application
├── services/tick-backend/             # Node.js WebSocket backend
├── libs/cTrader-Layer/                # cTrader API integration
└── run.sh                             # Unified service management
```

### Three-Layer Display System
- **Layer 1**: Trading displays (z-index: 1-999)
- **Layer 2**: UI panels (z-index: 1000-9999)
- **Layer 3**: Overlays (z-index: 10000+)

## Development Guidelines

### Code Standards

#### Event Handling Pattern
**Use Svelte's declarative event system** - prefer modifiers like `on:contextmenu|preventDefault|stopPropagation` over manual `addEventListener`.

#### Canvas Rendering Best Practices
**DPR-aware rendering** - scale canvas context for crisp, precise text and numerical displays at all device pixel ratios. Essential for accurate price visualization during trading sessions. (see `src/lib/viz/DPR_RENDERING_SYSTEM.md` for examples).

## Component System

### Current Visualization Components
**Market Profile** (`marketProfile.js`)
- TPO-based volume profiling with delta analysis
- Multiple rendering modes including traditional and volume-based

**Volatility Orb** (`volatilityOrb.js`)
- Dynamic volatility visualization with gradient rendering
- Color modes for volatility and momentum analysis

**Day Range Meter** (`dayRangeMeter.js`)
- The core anchoring visualisation ADR reference system with graduated markers
- Price positioning as percentage of daily range

**Price Display System**
- **Price Float** (`priceFloat.js`): Horizontal price line with effects
- **Price Display** (`priceDisplay.js`): Monospaced numeric display
- **Price Markers** (`priceMarkers.js`): User-placed reference points

### Configuration System

**Unified Configuration Architecture**
- Schema-driven parameters (see `src/config/CONFIGURATION_ARCHITECTURE.md`)
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

### Environment Configuration
- **Development**: Vite dev server with HMR on port 5174, WebSocket on 8080
- **Production**: Optimized builds on port 4173, WebSocket on 8081
- **Environment variables**: Set in `.env` file for cTrader API credentials

## Performance Considerations

### Rendering Optimizations
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
// Centralized store with global configuration
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

## Development Approach

### **Key Implementation Principles**
- **Centralize before you create**: Check existing utilities and patterns first
- **Keyboard-first interaction**: Essential for rapid trading workflows
- **Visual patterns first**: Users glance at patterns, then access detailed numbers
- **Progressive disclosure**: Complexity increases with user engagement level
- **Document new patterns**: When creating reusable utilities, add them to centralized documentation



## Testing and Quality Assurance

**Core Testing Commands:**
```bash
npm run test:unit         # Run unit tests (Vitest) - pure business logic
npm run test:e2e          # Run end-to-end tests (Playwright) - real browser workflows
npm run test:browser-logs # Run E2E tests and show ONLY browser console messages (LLM-optimized)
npm run test:all          # Run both test suites
npm run test:unified      # Run E2E with unified console visibility (LLM-optimized)
```

### **Browser Log Visibility for LLM Developers**

**Quick Access to Browser Console:**
```bash
npm run test:browser-logs  # Show all browser console messages
npm run test:browser-logs | grep "❌"  # Show only errors
npm run test:browser-logs | grep "REQUEST FAILED"  # Show network issues
npm run test:browser-logs | grep "LOG:"  # Show application logs
```

**What Browser Logs Show:**
- **✅ RESPONSE: 200** - Successful HTTP requests
- **❌ REQUEST FAILED** - Network request failures
- **❌ ERROR: [COMPONENT]** - JavaScript errors and initialization failures
- **🌐 REQUEST** - All outgoing network requests
- **⌨️ User interaction** - Keyboard/mouse events
- **LOG:** - Application console.log messages

**For LLM Development:**
The `test:browser-logs` command provides direct visibility into browser JavaScript console output, making it easy to:
- Identify initialization errors (app startup failures)
- Debug WebSocket connection issues
- Monitor network request patterns
- Trace application behavior during test execution

**Unified Console System:**
The `test:unified` command provides comprehensive LLM developer visibility through:
- **Build logs**: Real-time Vite dev server output
- **Browser console**: JavaScript errors and warnings forwarded to unified console
- **Test execution**: Playwright test results with correlation IDs
- **System events**: Navigation, interactions, and performance metrics
- **Timeline analysis**: Unified timestamps for complete test flow visibility

**Testing Philosophy: "Simple, Performant, Maintainable"**
- **Simple**: 3 core commands instead of 13+ scattered scripts
- **Performant**: Real browser testing with native Playwright features, 40% faster execution
- **Maintainable**: Standard tools with zero custom logging infrastructure

**Evidence Collection Requirements:**
All testing MUST collect real browser evidence by running actual Playwright tests that test actual user workflows on the production codebase running in a real browser. Custom application test utilities, simulations, or mock interfaces are strictly forbidden.

**Testing Approach:**
- **Unit tests**: Pure utility functions with Vitest (no canvas mocks)
- **E2E tests**: Real DOM testing with Playwright's built-in reporters
- **Performance testing**: 60fps validation, sub-100ms latency, performance stability
- **Cross-browser**: Chrome, Firefox, Safari with standard configurations

### **MANDATORY: Real Browser Evidence - Actual User Workflows on Production Codebase**

**CRITICAL REQUIREMENT**: All validation testing MUST collect **real browser evidence** by running **actual Playwright tests** that test **actual user workflows** on the **production codebase running in a real browser**. Creating custom application test utilities, simulations, or mock interfaces is strictly forbidden.

**THREE CORE PRINCIPLES - NON-NEGOTIABLE:**
1. **Actual user workflow tested in the production interface**
2. **Real browser evidence collection**
3. **Run actual Playwright tests to collect live production code real browser evidence**

**PRODUCTION CODEBASE DEFINITION**:
- **REQUIRED**: Current codebase (source files) tested via development server
- **STANDARD**: Use development server (`npm run dev`, localhost:5174) for all testing
- **FORBIDDEN**: Mock interfaces, simulated application behavior, custom test utilities

**CUSTOM CODE RESTRICTIONS**:
- **ALLOWED**: Browser automation (Playwright APIs), keyboard/mouse simulation, DOM queries
- **FORBIDDEN**: Custom application testing utilities, component isolation testing, mock data generation

**REQUIRED TRADER WORKFLOWS (tested on production interface):**
- **Display Creation**: Ctrl+K → symbol search → Enter → display creation
- **Navigation**: Ctrl+Tab display switching during active market monitoring
- **Live Data Verification**: Real WebSocket data flow to visual display
- **Responsiveness**: Drag-resize, reposition during live market updates
- **Cleanup**: Ctrl+Shift+W display removal with resource cleanup

**REQUIRED TEST EXECUTION WITH EVIDENCE COLLECTION:**
```bash
npm run test:e2e                    # Real browser evidence collection
npm run test:e2e:performance       # Production codebase performance evidence
npm run test:complete-workflow      # Full trader workflow evidence
npm run pipeline:phase:workflows   # Professional scenario evidence
```

**MANDATORY EVIDENCE COLLECTION REQUIREMENTS:**
- **Real browser traces**: Must capture actual trader interactions via dev server
- **Console logs**: Must verify application console output from dev server
- **Performance metrics**: Must collect from actual application execution via dev server

**FORBIDDEN TESTING PATTERNS:**
- NEVER create custom utilities to test application logic
- NEVER mock or simulate user workflows
- NEVER create isolated component tests separate from running application
- NEVER bypass the running application with custom test interfaces
- NEVER create duplicate tests when existing coverage already exists

**MANDATORY TEST ANALYSIS REQUIREMENT:**
- **ALWAYS analyze existing tests** in `tests/e2e/` directory first
- **ONLY create new tests** if existing tests don't cover the specific workflow/interaction
- **MODIFY existing tests** when enhancement is needed vs creating new files
- **ENSURE comprehensive coverage** without unnecessary duplication

**REFERENCE**: `tests/e2e/primary-trader-workflow.spec.js` - demonstrates actual user workflows on production codebase with real browser evidence collection.

**Key Testing Areas:**
- **Visual accuracy**: Canvas rendering with crisp numerical displays at all DPR levels
- **Performance under load**: 20+ displays without visual degradation or stuttering
- **Real-time accuracy**: Data-to-visual latency under 100ms during volatile markets
- **Performance stability**: Reliable operation without memory leaks or visual degradation
- **Connection reliability**: WebSocket stability and automatic reconnection
- **Precision workflow**: Keyboard accessibility for rapid, accurate trading decisions

## Contributing

**Development Workflow:**
1. Use `./run.sh dev` for development with hot reload
2. Follow "Simple, Performant, Maintainable" decision framework
3. Check existing utilities before creating new ones
4. Test with realistic conditions (multiple displays, trading workflows)
5. **Validate ALL changes with actual trader workflows on the production codebase** (MANDATORY)
6. **Use unified testing for LLM development visibility**: `npm run test:unified`
7. Document new patterns and utilities

**Testing Integration:**
- **During development**: `npm run test:unit -- --watch` for rapid feedback
- **Before commits**: `npm run test:e2e` for workflow validation
- **For LLM visibility**: `npm run test:unified` for comprehensive console logging
- **Complete validation**: `npm run test:all` for full test suite execution

**Code Standards:**
- Framework-first development approach
- Keyboard-first interaction design
- DPR-aware canvas rendering
- Centralized utility functions

## Current Status

**Production Maturity**: ~65% complete, functional for development and testing

**Current Capabilities**:
- ✅ Real-time FX market data visualization via cTrader integration
- ✅ Multiple display types with configuration management
- ✅ Drag-and-drop workspace management with persistence
- ✅ Environment-aware development and production modes
- ✅ Canvas rendering with DPR-aware text

**Development Environment**:
- HMR-enabled development workflow
- Comprehensive service management and monitoring
- Browser zoom awareness and responsive design

---

**NeuroSense FX** - Financial trading visualization platform focused on effective market data presentation.