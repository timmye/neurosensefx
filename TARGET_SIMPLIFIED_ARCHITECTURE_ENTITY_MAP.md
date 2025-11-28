# Target Simplified Architecture Entity Map - NeuroSense FX

## System Overview
The simplified NeuroSense FX architecture follows the "Simple, Performant, Maintainable" philosophy with minimal complexity, clear boundaries, and essential functionality only. This architecture reduces the system from ~85 files to ~20 files while maintaining all core capabilities.

## 🏗️ SIMPLIFIED CORE SYSTEM

### STREAMLINED APPLICATION LAYER
```
┌─────────────────────────────────────────────────────────────┐
│                     SIMPLIFIED MAIN                         │
│                                                             │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│ │     App.svelte  │  │   main.js       │  │ marketData.js   ││
│ │                 │  │                 │  │                 ││
│ │ - UI Root       │  │ - App Init      │  │ - WebSocket     ││
│ │ - Router        │  │ - Store Setup   │  │   Connection    ││
│ │ - Global        │  │ - Error Setup   │  │ - Data          ││
│ │   Styles        │  │ - Performance   │  │   Processing    ││
│ └─────────────────┘  └─────────────────┘  └─────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### UNIFIED STATE MANAGEMENT
```
┌─────────────────────────────────────────────────────────────┐
│                   SINGLE STORE SYSTEM                       │
│                                                             │
│                     ┌─────────────────┐                     │
│                     │   appStore.js   │                     │
│                     │                 │                     │
│                     │ ┌─────────────┐ │                     │
│                     │ │   STATE     │ │                     │
│                     │ │ - displays  │ │                     │
│                     │ │ - symbols   │ │                     │
│                     │ │ - ui        │ │                     │
│                     │ │ - config    │ │                     │
│                     │ └─────────────┘ │                     │
│                     │                 │                     │
│                     │ ┌─────────────┐ │                     │
│                     │ │  ACTIONS    │ │                     │
│                     │ │ - addDisplay│ │                     │
│                     │ │ - removeDisp│ │                     │
│                     │ │ - updateUI  │ │                     │
│                     │ │ - setConfig │ │                     │
│                     │ └─────────────┘ │                     │
│                     └─────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

## 🌐 SIMPLIFIED DATA FLOW

### DIRECT DATA PROCESSING
```
┌─────────────────────────────────────────────────────────────┐
│                STREAMLINED DATA LAYER                        │
│                                                             │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│ │  WebSocket      │  │  marketData.js  │  │  Single Worker  ││
│ │  Connection     │  │                 │  │   (Optional)    ││
│ │                 │  │ - Connection    │  │                 ││
│ │ - Real-time     │  │   Management    │  │ - Heavy         ││
│ │   Data Stream   │  │ - Data          │  │   Processing    ││
│ │ - Auto          │  │   Validation    │  │ - Off Main      ││
│ │   Reconnect     │  │ - State         │  │   Thread        ││
│ │ - Error         │  │   Updates       │  │ - Performance   ││
│ │   Handling      │  │ - Simple Schema │  │   Only          ││
│ └─────────────────┘  └─────────────────┘  └─────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## 🎨 UNIFIED VISUALIZATION SYSTEM

### DIRECT RENDERING ARCHITECTURE
```
┌─────────────────────────────────────────────────────────────┐
│                  UNIFIED RENDERING ENGINE                   │
│                                                             │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│ │ TradingDisplay  │  │  visualizer.js  │  │  canvasUtils.js ││
│ │     .svelte     │  │                 │  │                 ││
│ │                 │  │ - Render        │  │ - DPR Scaling   ││
│ │ - Single        │  │   Engine        │  │ - Crisp Text    ││
│ │   Component     │  │ - All Chart     │  │ - Performance   ││
│ │ - All Chart     │  │   Types         │  │ - Memory        ││
│ │   Types         │  │ - Direct State  │  │   Management    ││
│ │ - Direct Store  │  │   Binding       │  │ - Bounds        ││
│ │   Binding       │  │ - Simple Config │  │   Calculation   ││
│ └─────────────────┘  └─────────────────┘  └─────────────────┘│
│                                                             │
│                ┌─────────────────────────────┐             │
│                │     VISUALIZATION MODULES   │             │
│                │                             │             │
│                │ ┌─────────────┐ ┌─────────┐ │             │
│                │ │Market      │ │Volatility│ │             │
│                │ │Profile     │ │   Orb    │ │             │
│                │ └─────────────┘ └─────────┘ │             │
│                │ ┌─────────────┐ ┌─────────┐ │             │
│                │ │Price       │ │Day Range│ │             │
│                │ │Display     │ │  Meter  │ │             │
│                │ └─────────────┘ └─────────┘ │             │
│                └─────────────────────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

## ⌨️ SIMPLIFIED INTERACTION SYSTEM

### DIRECT EVENT HANDLING
```
┌─────────────────────────────────────────────────────────────┐
│                  UNIFIED INTERACTION ENGINE                 │
│                                                             │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│ │ TradingDisplay  │  │   keyboard.js   │  │   utils.js      ││
│ │     .svelte     │  │                 │  │                 ││
│ │                 │  │ - Shortcut      │  │ - Search        ││
│ │ - Direct Event  │  │   Handling      │  │   Functions     ││
│ │   Handling      │  │ - Context       │  │ - Formatting    ││
│ │ - Built-in      │  │   Management    │  │ - Validation    ││
│ │   Gestures      │  │ - Simple        │  │ - DOM Helpers   ││
│ │ - Store         │  │   Registration  │  │ - Performance   ││
│ │   Integration   │  │ - Prevention    │  │   Helpers       ││
│ └─────────────────┘  └─────────────────┘  └─────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## 🔧 MINIMAL CONFIGURATION SYSTEM

### SIMPLE CONFIG MANAGEMENT
```
┌─────────────────────────────────────────────────────────────┐
│                  UNIFIED CONFIGURATION                      │
│                                                             │
│                     ┌─────────────────┐                     │
│                     │   config.js     │                     │
│                     │                 │                     │
│                     │ ┌─────────────┐ │                     │
│                     │ │ DEFAULTS   │ │                     │
│                     │ │ - Chart     │ │                     │
│                     │ │   Settings │ │                     │
│                     │ │ - UI        │ │                     │
│                     │ │   Settings │ │                     │
│                     │ │ - Trading   │ │                     │
│                     │ │   Settings │ │                     │
│                     │ └─────────────┘ │                     │
│                     │                 │                     │
│                     │ ┌─────────────┐ │                     │
│                     │ │ SCHEMA     │ │                     │
│                     │ │ - Type      │ │                     │
│                     │ │   Safety    │ │                     │
│                     │ │ - Validation│ │                     │
│                     │ │ - Runtime   │ │                     │
│                     │ │   Updates   │ │                     │
│                     │ └─────────────┘ │                     │
│                     │                 │                     │
│                     │ ┌─────────────┐ │                     │
│                     │ │ PERSISTENCE│ │                     │
│                     │ │ - Local     │ │                     │
│                     │ │   Storage   │ │                     │
│                     │ │ - Workspace │ │                     │
│                     │ │   Save/Load │ │                     │
│                     │ │ - Export/   │ │                     │
│                     │ │   Import    │ │                     │
│                     │ └─────────────┘ │                     │
│                     └─────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

## 🧪 SIMPLIFIED TESTING

### DIRECT TESTING APPROACH
```
┌─────────────────────────────────────────────────────────────┐
│                     TESTING SYSTEM                          │
│                                                             │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│ │  e2e tests      │  │  browser tests  │  │  unit tests     ││
│ │                 │  │                 │  │                 ││
│ │ - User          │  │ - Real Browser  │  │ - Pure          ││
│ │   Workflows     │  │   Evidence      │  │   Functions     ││
│ │ - Integration   │  │ - Performance   │  │ - Business      ││
│ │ - End-to-End    │  │   Validation    │  │   Logic         ││
│ └─────────────────┘  └─────────────────┘  └─────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## 🎯 SIMPLIFICATION BENEFITS

### FILE COUNT REDUCTION
```
BEFORE: ~85 Specialized Files
AFTER:  ~20 Essential Files

REDUCTION: 76% Fewer Files
├── Stores: 6 → 1 (83% reduction)
├── Utils: 25 → 1 (96% reduction)
├── Visualization: 15 → 3 (80% reduction)
├── Performance: 12 → 0 (100% reduction - integrated)
├── Testing: 15 → 3 (80% reduction)
└── Configuration: 8 → 1 (87% reduction)
```

### COMPLEXITY METRICS
```
┌─────────────────────────────────────────────────────────────┐
│                  COMPLEXITY COMPARISON                       │
│                                                             │
│ METRIC                    │ CURRENT │ SIMPLIFIED │ REDUCTION│
│ ──────────────────────────┼─────────┼────────────┼──────────┤
│ Total Files               │   85    │     20     │   76%    │
│ Abstraction Layers        │    5    │      2     │   60%    │
│ Store Dependencies        │    6    │      1     │   83%    │
│ Initialization Steps      │   12    │      3     │   75%    │
│ Error Handling Systems     │    8    │      1     │   87%    │
│ Performance Trackers      │    6    │      0     │  100%    │
│ Configuration Sources     │    5    │      1     │   80%    │
│ Testing Utilities         │   10    │      2     │   80%    │
└─────────────────────────────────────────────────────────────┘
```

## 🔗 SIMPLIFIED ARCHITECTURE PRINCIPLES

### 1. SINGLE STORE ARCHITECTURE
- **All state** in one reactive store
- **Simple actions** for all operations
- **No store synchronization** complexity
- **Direct component binding** to store state

### 2. DIRECT VISUALIZATION
- **One component** for all chart types
- **Unified rendering engine** for all visualizations
- **Direct store binding** - no intermediate layers
- **Simple configuration** with defaults and overrides

### 3. STREAMLINED DATA FLOW
- **WebSocket → Store → Component** (3 steps)
- **No worker manager** complexity (single optional worker)
- **Direct state updates** from data events
- **Simple schema** validation

### 4. MINIMAL UTILITIES
- **One utility file** for common functions
- **Built-in browser APIs** where possible
- **No specialized performance monitoring** (use browser DevTools)
- **Simple error boundaries** in main components

### 5. DIRECT INTERACTION
- **Built-in Svelte event handling**
- **Simple keyboard shortcut system**
- **Direct store actions** from events
- **No complex event coordination layers**

## 🚀 MIGRATION PATH

### PHASE 1: CONSOLIDATION (Week 1-2)
1. **Create unified appStore** - migrate state from 6 stores
2. **Build TradingDisplay component** - consolidate all visualizations
3. **Simplify data layer** - replace wsClient + workerManager

### PHASE 2: SIMPLIFICATION (Week 3-4)
1. **Remove specialized utilities** - consolidate into utils.js
2. **Eliminate performance monitoring** - use browser DevTools
3. **Direct integration** - remove abstraction layers

### PHASE 3: VALIDATION (Week 5-6)
1. **Performance testing** - ensure 60fps maintained
2. **Feature validation** - ensure all capabilities preserved
3. **Simplification verification** - document complexity reduction

## ✅ SUCCESS CRITERIA

### FUNCTIONAL REQUIREMENTS
- [ ] Real-time FX data visualization
- [ ] Multiple chart types (Market Profile, Volatility Orb, etc.)
- [ ] Keyboard shortcuts and interactions
- [ ] Workspace persistence
- [ ] 60fps rendering performance
- [ ] 20+ concurrent display support

### SIMPLICITY REQUIREMENTS
- [ ] <25 total files in codebase
- [ ] Single store for all state
- [ ] <5 second cold start time
- [ ] <2MB bundle size
- [ ] Zero configuration required for basic use
- [ ] Intuitive code structure (new developer productive in <4 hours)

This simplified architecture maintains all essential trading functionality while dramatically reducing complexity, maintenance burden, and development friction.