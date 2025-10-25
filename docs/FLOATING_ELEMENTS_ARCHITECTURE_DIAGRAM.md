# NeuroSense FX Floating Elements - Architecture Diagrams

## Visual Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NEUROSENSE FX FLOATING ARCHITECTURE               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │   USER INPUT    │    │  STATE STORE    │    │   RENDERING     │        │
│  │                 │    │                 │    │                 │        │
│  │ • Mouse Events  │───▶│ • floatingStore │───▶│ • Canvas API    │        │
│  │ • Keyboard      │    │ • GEOMETRY      │    │ • D3.js         │        │
│  │ • Touch         │    │ • Actions       │    │ • Svelte        │        │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘        │
│           │                       │                       │                │
│           └───────────────────────┼───────────────────────┘                │
│                                   │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                        THREE-LAYER SYSTEM                            │  │
│  │                                                                     │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │  │
│  │  │   OVERLAYS      │  │     PANELS      │  │    DISPLAYS     │      │  │
│  │  │  (z: 20000+)    │  │  (z: 1000-9999) │  │   (z: 1-999)    │      │  │
│  │  │                 │  │                 │  │                 │      │  │
│  │  │ • Context Menus │  │ • Symbol Palette│  │ • Price Data    │      │  │
│  │  │ • Modals        │  │ • Debug Panel   │  │ • Market Profile│      │  │
│  │  │ • Notifications │  │ • System Panel  │  │ • Volatility    │      │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW PIPELINE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  MARKET DATA → BACKEND → FRONTEND → STORE → COMPONENTS → CANVAS → USER     │
│      │           │         │         │          │          │         │      │
│      │           │         │         │          │          │         │      │
│  ┌──▼──┐    ┌───▼───┐ ┌───▼───┐ ┌───▼───┐  ┌───▼───┐  ┌──▼──┐  ┌──▼──┐ │
│  │cTrader│───▶│Server │───▶│Client │───▶│Store │───▶│Display│──▶│Canvas│──▶│User│
│  │ API  │    │(8080) │   │(5173) │   │       │   │       │  │      │ │
│  └──────┘    └───────┘   └───────┘   └───────┘   └───────┘  └──────┘ │
│                                                                             │
│  • WebSocket: Real-time price ticks                                        │
│  • Processing: Enrichment with ADR, volatility                             │
│  • Storage: Centralized state management                                    │
│  • Rendering: 60fps canvas updates                                         │
│  • Interaction: Drag, resize, click, hover                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Interaction Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        COMPONENT INTERACTION MAP                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐         ACTIONS         ┌─────────────────┐           │
│  │   USER ACTIONS  │─────────────────────────▶│  FLOATING STORE  │           │
│  │                 │                         │                 │           │
│  │ • Drag          │◀─────────────────────────│ • State Updates  │           │
│  │ • Resize        │    REACTIVE UPDATES     │ • Z-Index Mgmt   │           │
│  │ • Click         │                         │ • Collision Det  │           │
│  │ • Context Menu  │                         │ • Grid Snapping  │           │
│  └─────────────────┘                         └─────────────────┘           │
│                                                        │                    │
│                                                        ▼                    │
│  ┌─────────────────┐    STORE SUBSCRIPTIONS    ┌─────────────────┐           │
│  │   COMPONENTS    │◀──────────────────────────│   REACTIVE      │           │
│  │                 │                           │   UPDATES       │           │
│  │ • FloatingDisplay│                          │                 │           │
│  │ • SymbolPalette │                          │ • Position      │           │
│  │ • ContextMenu   │                          │ • Size          │           │
│  │ • ResizeHandles │                          │ • Active State  │           │
│  └─────────────────┘                          └─────────────────┘           │
│           │                                                            │      │
│           │ RENDERING                                                 │      │
│           ▼                                                            │      │
│  ┌─────────────────┐    CANVAS OPERATIONS     ┌─────────────────┐           │
│  │  VISUALIZATION  │─────────────────────────▶│    CANVAS       │           │
│  │    LIBRARIES    │                         │                 │           │
│  │                 │                         │ • 2D Context    │           │
│  │ • MarketProfile │                         │ • Scaling       │           │
│  │ • DayRangeMeter │                         │ • Drawing       │           │
│  │ • VolatilityOrb │                         │ • Animation     │           │
│  └─────────────────┘                         └─────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Position & Size Calculation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    POSITION & SIZE CALCULATION FLOW                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USER INPUT ──▶ MOUSE DELTA CALCULATION                                     │
│      │                                                                     │
│      ▼                                                                     │
│  ┌─────────────────┐                                                       │
│  │   RAW INPUT     │                                                       │
│  │                 │                                                       │
│  │ • e.movementX   │                                                       │
│  │ • e.movementY   │                                                       │
│  │ • Current Pos   │                                                       │
│  └─────────────────┘                                                       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────┐    TRANSFORM PIPELINE    ┌─────────────────┐           │
│  │  COORDINATE     │─────────────────────────▶│   GEOMETRY      │           │
│  │  TRANSFORMATION │                         │   ENGINE        │           │
│  │                 │                         │                 │           │
│  │ • Add Delta     │                         │ • Grid Snap     │           │
│  │ • 1:1 Scaling   │                         │ • Constraints   │           │
│  │ • Browser Zoom  │                         │ • Collision Det │           │
│  └─────────────────┘                         │ • Viewport Lim  │           │
│                                             └─────────────────┘           │
│                                                       │                    │
│                                                       ▼                    │
│  ┌─────────────────┐    SIZE CALCULATIONS     ┌─────────────────┐           │
│  │   POSITION      │─────────────────────────▶│     SIZE        │           │
│  │                 │                         │                 │           │
│  │ • Constrained X │                         │ • Width/Height  │           │
│  │ • Constrained Y │                         │ • Min/Max Limits│           │
│  │ • Safe Position │                         │ • Aspect Ratio  │           │
│  └─────────────────┘                         └─────────────────┘           │
│           │                                                       │        │
│           └───────────────────┬───────────────────────────────────┘        │
│                               │                                            │
│                               ▼                                            │
│  ┌─────────────────┐    STORE UPDATE          ┌─────────────────┐           │
│  │   FINAL STATE   │─────────────────────────▶│   COMPONENT     │           │
│  │                 │                         │   RE-RENDER     │           │
│  │ • Position XYZ  │                         │                 │           │
│  │ • Size WH       │                         │ • DOM Update    │           │
│  │ • Z-Index       │                         │ • Canvas Resize  │           │
│  │ • Active State  │                         │ • Visual Update  │           │
│  └─────────────────┘                         └─────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Canvas Scaling Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CANVAS SCALING ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    REFERENCE CANVAS     ┌─────────────────┐           │
│  │   CONFIG        │─────────────────────────▶│   STORAGE       │           │
│  │                 │                         │                 │           │
│  │ • Percentages   │                         │ • 220×120px Ref  │           │
│  │ • 85+ Params    │                         │ • % Values      │           │
│  │ • Layout Rules  │                         │ • Aspect Ratio  │           │
│  └─────────────────┘                         └─────────────────┘           │
│           │                                                       │        │
│           ▼                                                       ▼        │
│  ┌─────────────────┐    CONTAINER CALC       ┌─────────────────┐           │
│  │   CONTAINER     │─────────────────────────▶│   DISPLAY SIZE  │           │
│  │                 │                         │                 │           │
│  │ • 240×160px     │                         │ • % → Pixels    │           │
│  │ • Header 40px   │                         │ • Canvas 220×120│           │
│  │ • Padding 8px   │                         │ • Responsive    │           │
│  └─────────────────┘                         └─────────────────┘           │
│                       │                                                 │
│                       ▼                                                 │
│  ┌─────────────────┐    SCALE TO CANVAS       ┌─────────────────┐           │
│  │   SCALE TO      │─────────────────────────▶│   SCALED CONFIG │           │
│  │   CANVAS()      │                         │                 │           │
│  │                 │                         │ • Smart Detect  │           │
│  │ • % Detection   │                         │ • % → Abs Values │           │
│  │ • Canvas Size   │                         │ • All 85+ Params│           │
│  │ • Preserve Ratio│                         │ • Layout Props  │           │
│  └─────────────────┘                         └─────────────────┘           │
│                                 │                                         │
│                                 ▼                                         │
│  ┌─────────────────┐    RENDERING PIPELINE     ┌─────────────────┐           │
│  │   VISUALIZATION │─────────────────────────▶│     CANVAS      │           │
│  │   LIBRARIES     │                         │                 │           │
│  │                 │                         │ • 2D Context    │           │
│  │ • Market Profile│                         │ • Scaled Coords  │           │
│  │ • Day Range     │                         │ • Real-time     │           │
│  │ • Volatility    │                         │ • 60fps Target  │           │
│  └─────────────────┘                         └─────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Collision Detection System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      COLLISION DETECTION SYSTEM                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    EDGE CALCULATION       ┌─────────────────┐           │
│  │   COMPONENT     │─────────────────────────▶│   EDGES OBJ     │           │
│  │   BOUNDS        │                         │                 │           │
│  │                 │                         │ • left, right   │           │
│  │ • Position X,Y  │                         │ • top, bottom   │           │
│  │ • Size W,H      │                         │ • center point  │           │
│  │ • Corners       │                         │ • corners array │           │
│  └─────────────────┘                         └─────────────────┘           │
│              │                                                    │          │
│              ▼                                                    ▼          │
│  ┌─────────────────┐    COLLISION TESTING      ┌─────────────────┐           │
│  │   TEST ALL      │─────────────────────────▶│   COLLISION     │           │
│  │   COMPONENTS    │                         │   RESULT        │           │
│  │                 │                         │                 │           │
│  │ • Iterate Maps  │                         │ • Boolean Flag  │           │
│  │ • Skip Self     │                         │ • Collision Obj │           │
│  │ • Edge Compare  │                         │ • Overlap Area  │           │
│  └─────────────────┘                         └─────────────────┘           │
│                         │                                                  │
│                         ▼                                                  │
│  ┌─────────────────┐    SAFE POSITION FIND    ┌─────────────────┐           │
│  │   SUGGEST       │─────────────────────────▶│   ALTERNATIVES  │           │
│  │   POSITIONS     │                         │                 │           │
│  │                 │                         │ • Left Slide    │           │
│  │ • 4 Directions  │                         │ • Right Slide   │           │
│  │ • Distance Calc │                         │ • Up Slide      │           │
│  │ • Best Fit      │                         │ • Down Slide    │           │
│  └─────────────────┘                         └─────────────────┘           │
│              │                                                            │   │
│              ▼                                                            │   │
│  ┌─────────────────┐    SPIRAL SEARCH           ┌─────────────────┐           │
│  │   ADVANCED      │─────────────────────────▶│   FINAL POSITION │           │
│  │   POSITIONING   │                         │                 │           │
│  │                 │                         │ • Collision Free│           │
│  │ • Spiral Pattern│                         │ • Grid Snapped  │           │
│  │ • Max Attempts  │                         │ • Viewport Safe │           │
│  │ • Fallback      │                         │ • Applied       │           │
│  └─────────────────┘                         └─────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Performance Optimization Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PERFORMANCE OPTIMIZATION FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    INPUT FILTERING        ┌─────────────────┐           │
│  │   USER INPUT    │─────────────────────────▶│   FILTERED      │           │
│  │                 │                         │   INPUT         │           │
│  │ • High Freq     │                         │                 │           │
│  │ • Mouse Move    │                         │ • Threshold Chk │           │
│  │ • Resize Drag   │                         │ • Debounce      │           │
│  │ • Scroll        │                         │ • Rate Limit    │           │
│  └─────────────────┘                         └─────────────────┘           │
│              │                                                            │   │
│              ▼                                                            │   │
│  ┌─────────────────┐    STATE UPDATES           ┌─────────────────┐           │
│  │   STORE         │─────────────────────────▶│   OPTIMIZED     │           │
│  │   OPERATIONS    │                         │   UPDATES       │           │
│  │                 │                         │                 │           │
│  │ • Immutable     │                         │ • Map Operations│           │
│  │ • Batch Updates │                         │ • Selective      │           │
│  │ • Derived Vals  │                         │ • Minimal Render│           │
│  └─────────────────┘                         └─────────────────┘           │
│                       │                                                 │
│                       ▼                                                 │
│  ┌─────────────────┐    CANVAS RENDERING        ┌─────────────────┐           │
│  │   RENDER        │─────────────────────────▶│   OPTIMIZED     │           │
│  │   PIPELINE      │                         │   RENDERING     │           │
│  │                 │                         │                 │           │
│  │ • RAF Loop      │                         │ • Object Pool   │           │
│  │ • Frame Skip    │                         │ • Dirty Rect    │           │
│  │ • 60fps Target  │                         │ • Viewport Cull │           │
│  └─────────────────┘                         └─────────────────┘           │
│                                 │                                         │
│                                 ▼                                         │
│  ┌─────────────────┐    MEMORY MANAGEMENT       ┌─────────────────┐           │
│  │   CLEANUP       │─────────────────────────▶│   HEALTHY       │           │
│  │   SYSTEM        │                         │   MEMORY        │           │
│  │                 │                         │                 │           │
│  │ • Event Remove  │                         │ • No Leaks      │           │
│  │ • RAF Cancel    │                         │ • Pool Reuse    │           │
│  │ • Store Clear   │                         │ • GC Friendly   │           │
│  │ • Component Unm │                         │ • Stable FPS     │           │
│  └─────────────────┘                         └─────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Insights from Architecture

### 1. **Hierarchical Organization**
- **4-Layer Architecture**: Foundation → State → Component → Rendering
- **Clear Separation**: Each layer has distinct responsibilities
- **Upward Data Flow**: User input → processing → storage → rendering

### 2. **Performance First Design**
- **60fps Target**: All optimizations focus on maintaining frame rate
- **Smart Filtering**: Prevents unnecessary calculations
- **Memory Efficiency**: Object pooling and cleanup systems

### 3. **Scalable Patterns**
- **Reference Canvas**: Responsive design foundation
- **Transform Pipeline**: Composable operations
- **Centralized State**: Consistent behavior across components

### 4. **Professional Interactions**
- **1:1 Cursor Scaling**: Precise mouse tracking
- **Smart Collision**: Intelligent positioning
- **Grid Snapping**: Professional alignment options

This architecture enables NeuroSense FX to handle 20+ simultaneous floating displays with real-time market data while maintaining smooth user interactions and professional-grade performance.
