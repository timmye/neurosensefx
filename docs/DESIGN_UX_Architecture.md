# NeuroSense FX UX Architecture

## Overview

This document serves as the central reference for understanding how users experience and interact with NeuroSense FX. It bridges the gap between high-level design principles ([NeuroSense_FX_Design_Document.md](NeuroSense_FX_Design_Document.md)) and technical implementation ([CLAUDE.md](CLAUDE.md), individual component design documents).

The UX Architecture explains **why** the system is designed this way, **how** components work together to support professional trading workflows, and **what** developers need to understand to maintain and extend the system while preserving its core cognitive design principles.

### 🎯 **Project Technical Philosophy: "Simple, Performant, Maintainable"**

Every development decision should be evaluated against these three pillars:

#### **SIMPLE**
- **Clear Mental Models**: Components should be intuitive to understand and modify
- **Minimal Complexity**: Avoid over-engineering and unnecessary abstraction
- **Predictable Behavior**: Consistent APIs and interaction patterns
- **Self-Documenting Code**: Code should explain its purpose through structure

#### **PERFORMANT**
- **60fps Guarantee**: All rendering must maintain smooth 60fps performance
- **Sub-100ms Latency**: Data-to-visual updates under 100ms threshold
- **Memory Efficiency**: Minimal footprint with intelligent resource management
- **Scalable Architecture**: Graceful performance with 20+ concurrent displays

#### **MAINTAINABLE**
- **Single Responsibility**: Each component has a clear, focused purpose
- **Loose Coupling**: Components interact through well-defined interfaces
- **Extensible Design**: Easy to add new features without breaking existing ones
- **Comprehensive Documentation**: Clear rationale for design decisions

> **LLM Developer Guidance**: When approaching any task, always consider: "Is this solution simple, performant, and maintainable?" If not, refactor until it is.

---

## 1. Interface Hierarchy & Navigation

### 1.1. Workspace Level Architecture

The workspace is the primary container for all trading activities. It provides:

- **Symbol Palette**: Search and subscription interface for creating new trading displays
- **Floating Display Management**: Drag-and-drop positioning, resizing, and organization
- **Multi-Instrument Monitoring**: Simultaneous observation of multiple currency pairs
- **Workspace Persistence**: Layout and preference memory between sessions

### 1.2. Display Level Architecture

Each trading display is a self-contained visualization unit with:

- **Header**: Symbol identification and display controls
- **Canvas**: Core visualization area containing all components
- **Context Integration**: Right-click access to relevant controls and configuration

### 1.3. Component Hierarchy

```
FloatingDisplay
├── Header
│   ├── Symbol Name
│   └── Close Controls
├── Display Canvas
│   ├── ADR Axis (Primary Reference System)
│   │   ├── Day Range Meter
│   │   ├── ADR Boundary Lines
│   │   └── ADR Markers
│   ├── Price Tracking System
│   │   ├── Price Float (Visual position indicator)
│   │   └── Price Display (Numeric representation)
│   ├── Market Analysis Components
│   │   ├── Market Profile (Price distribution)
│   │   └── Volatility Orb (Market conditions)
│   └── User Interaction Elements
│       ├── Price Markers (User-placed references)
│       └── Hover Indicators
└── Context Menu Integration
```

---

## 2. Component Integration Architecture

### 2.1. Visual Priority System

Components are organized by visual priority to support progressive information disclosure:

| Priority | Components | Update Frequency | Cognitive Load | User Purpose |
|----------|------------|------------------|----------------|--------------|
| **Critical** | Day Range Meter, Price Float, Price Display | 60fps | Low | Immediate market state |
| **Important** | Market Profile | 30fps | Medium | Distribution analysis |
| **Background** | Volatility Orb | 10fps | Very Low | Market context awareness |

### 2.2. Spatial Organization

#### ADR Axis as Primary Reference
- **Purpose**: Provides consistent spatial context for all price-related information
- **Location**: Vertical reference line with configurable horizontal position
- **Function**: All components reference their position relative to this axis

#### Component Positioning Strategy
```
Canvas Layout (220px × 120px default):
┌─────────────────────────────────────────────────────────┐
│ Header: Symbol Name & Controls                          │
├─────────────────────────────────────────────────────────┤
|            ADR Axis                                    |
│              │ Market Profile (extends right)          │
│  ────┤──────────────────────────────────────────│
│              │ Volatility Orb (background, centered)   │
│              │                                          │
│ Price Float ─┼─── Current Price Position                │
│ Price Display│    [digits track with price]             │
└─────────────────────────────────────────────────────────┘
```

### 2.3. Data Flow Architecture

```
Market Data (WebSocket)
    ↓
Data Processor (Validation & Normalization)
    ↓
Display Store (State Management)
    ↓
┌─────────────────────────────────────────┐
│ Component Distribution                  │
├─────────────────┬───────────────────────┤
│ Critical Path   │ Secondary Path        │
│ (60fps updates) │ (30fps updates)       │
├─────────────────┼───────────────────────┤
│ • Price Float   │ • Market Profile      │
│ • Price Display │ • Volatility Orb      │
│ • Day Range     │                       │
└─────────────────┴───────────────────────┘
```

### 2.4. Interaction Patterns

#### Progressive Disclosure Workflow
1. **Glance Level (1-2 seconds)**:
   - Day Range Meter shows price context
   - Price Float indicates current position
   - Volatility Orb provides market sentiment

2. **Focus Level (5-10 seconds)**:
   - Price Display shows exact values
   - Market Profile reveals distribution patterns
   - Component relationships become apparent

3. **Analysis Level (30+ seconds)**:
   - Multi-display correlations
   - Pattern recognition across components
   - Detailed configuration adjustments

---

## 3. User Workflow Documentation

### 3.1. Core Trading Workflows

#### Market Monitoring Workflow
```
1. Market Assessment (Glance)
   ├── ADR position: Where is price in the ADR?
   ├── Volatility state: Calm, Normal, Active, Volatile?
   

2. Context Building (Focus)
   ├── Distribution analysis: Where is price concentration?
   ├── Historical context: How does current compare to recent?
   └── Risk assessment: What are the boundaries?

3. Decision Support (Analysis)
   ├── Cross-instrument comparison
   └── Pattern recognition and alert setup
```

#### Multi-Display Management Workflow
```
1. Initial Setup
   ├── Symbol search and selection
   ├── Display positioning and sizing
   └── Workspace layout organization

2. Ongoing Monitoring
   ├── Simultaneous multi-instrument observation
   ├── Cross-correlation analysis
   └── Alert and notification management

3. Workspace Optimization
   ├── Layout refinement based on usage patterns
   ├── Display configuration fine-tuning
   └── Performance optimization for display count
```

### 3.2. Configuration Workflow

#### Right-Click Context Menu System
- **Workspace-level**: Global workspace management
- **Display-level**: Individual display controls
- **Canvas-level**: Component-specific configuration

The Unified Context Menu ([src/components/UnifiedContextMenu/](src/components/UnifiedContextMenu/)) provides contextual access to 85+ parameters organized by component and function.

---

## 4. Performance & Cognitive Design Framework

### 4.1. Performance Architecture

#### System-Wide Performance Budget
```javascript
const PERFORMANCE_BUDGET = {
  frameTime: 16.67,        // 60fps target
  totalMemory: 500 * 1024 * 1024, // 500MB system limit
  maxDisplays: 20,         // Concurrent displays
  updatePriorities: {
    critical: ['DayRangeMeter', 'PriceFloat', 'PriceDisplay'],
    important: ['MarketProfile'],
    background: ['VolatilityOrb']
  },
  latencyTargets: {
    dataToVisual: 100,     // ms maximum
    userInteraction: 16,   // ms (1 frame)
    configurationUpdate: 50 // ms
  }
};
```

#### Resource Allocation Strategy
- **CPU Budgeting**: Critical components get priority processing
- **Memory Management**: Object pooling and efficient data structures
- **Rendering Optimization**: Dirty rectangle updates and layered canvases

### 4.2. Cognitive Design Principles

#### Pre-Attentive Processing
Components leverage visual attributes processed without conscious effort:
- **Color Encoding**: Market sentiment (Volatility Orb), trend direction (Price Float)
- **Motion Cues**: Price changes (Price Float), volatility shifts (Volatility Orb)
- **Spatial Positioning**: Price context (Day Range Meter), distribution (Market Profile)
- **Size Variation**: Significance of market movements, activity levels

#### Cognitive Load Management
- **Information Hierarchy**: Critical information most prominent
- **Progressive Disclosure**: Complexity increases with user engagement
- **Pattern Recognition**: Visual patterns easier to process than numerical analysis
- **Spatial Memory**: Consistent positioning supports memory and orientation

#### Decision Support Architecture
```
Glance → Pattern Recognition → Intuitive Assessment
    ↓
Focus → Detailed Analysis → Confirmation
    ↓
Analysis → Complex Correlations → Decision
```

---

## 5. Developer Integration Guide

### 5.1. Understanding the System Mental Model

#### Core Design Philosophy
NeuroSense FX is built on **human-centric design principles** guided by our technical philosophy:

> **"The technology should be invisible, allowing traders to focus on market patterns rather than interface mechanics."**

This invisibility is achieved through **SIMPLE** components that are intuitive, **PERFORMANT** rendering that never distracts, and **MAINTAINABLE** code that ensures reliability.

This means:
- **Sub-100ms latency**: Updates feel immediate and responsive
- **60fps rendering**: No cognitive dissonance from stuttering displays
- **Pre-attentive design**: Information understood without conscious effort
- **Progressive disclosure**: Complexity scales with user engagement

#### Component Interaction Patterns
When working with components, remember:

1. **ADR Axis is Primary Reference**: All components position relative to this axis (**SIMPLE** mental model)
2. **Critical Path Gets Priority**: Price tracking components update every frame (**PERFORMANT**)
3. **Background Elements Support**: Volatility and distribution provide context (**MAINTAINABLE** separation of concerns)
4. **User Workflow Drives Design**: Components support glance → focus → analysis progression

**Technical Philosophy in Action:**
- **SIMPLE**: Each component has one clear purpose and predictable behavior
- **PERFORMANT**: Update priorities ensure 60fps performance even with 20+ displays
- **MAINTAINABLE**: Clear separation between critical, important, and background rendering paths

### 5.2. Making Implementation Decisions

**Technical Philosophy Framework**
Every implementation decision must satisfy all three pillars:

**SIMPLE Implementation Decisions:**
- **Clear API Design**: Components expose intuitive, minimal interfaces
- **Predictable State**: State changes follow clear, documented patterns
- **Self-Documenting Structure**: Code organization explains purpose without extensive comments
- **Minimal Dependencies**: Avoid unnecessary coupling between components

**PERFORMANT Implementation Decisions:**
- **Profile Before Optimizing**: Use performance monitoring tools to identify actual bottlenecks
- **Respect the 60fps Budget**: Each component must contribute to overall performance
- **Memory Efficiency**: Object pooling and minimal allocation in render loops
- **Sub-100ms Latency**: Data-to-visual updates must complete within 100ms threshold

**MAINTAINABLE Implementation Decisions:**
- **Single Responsibility**: Each component has one clear, focused purpose
- **Loose Coupling**: Components interact through well-defined interfaces only
- **Extensible Design**: Easy to add new features without breaking existing functionality
- **Comprehensive Testing**: Clear patterns for validating component behavior

#### Integration Patterns
When adding new components or modifying existing ones:

1. **Refer to ADR Axis**: Position relative to primary reference system (**SIMPLE** mental model)
2. **Follow Priority System**: Assign appropriate update frequency and visual priority (**PERFORMANT**)
3. **Maintain Data Flow**: Connect to display store and follow established patterns (**MAINTAINABLE**)
4. **Support User Workflow**: Ensure component supports glance → focus → analysis progression

> **LLM Developer Decision Framework**: Before implementing any solution, ask:
> - Is it **SIMPLE** (clear, intuitive, minimal complexity)?
> - Is it **PERFORMANT** (60fps, sub-100ms latency, memory efficient)?
> - Is it **MAINTAINABLE** (single responsibility, loose coupling, extensible)?
>
> If the answer to any question is "no," refactor until all three are satisfied.

### 5.3. Component Development Guidelines

#### Creating New Visualization Components
Follow the established patterns from existing components, always applying the technical philosophy:

1. **Foundation Architecture** ([src/lib/viz/](src/lib/viz/)):
   ```javascript
   class NewComponent {
     constructor(canvas, config) {
       this.canvas = canvas;
       this.ctx = canvas.getContext('2d');
       this.config = { ...defaultConfig, ...config };

       // SIMPLE: Clear initialization pattern
       // PERFORMANT: Minimal setup overhead
       // MAINTAINABLE: Single responsibility for rendering
     }

     render(data) {
       // Implementation follows DPR-aware patterns
       // Bounds checking and performance optimization
       // Consistent coordinate system

       // SIMPLE: Predictable render method
       // PERFORMANT: Optimized for 60fps
       // MAINTAINABLE: Clear data flow
     }
   }
   ```

2. **Configuration Integration**:
   - Add parameters to appropriate parameter group ([src/components/UnifiedContextMenu/utils/parameterGroups.js](src/components/UnifiedContextMenu/utils/parameterGroups.js))
   - Follow percentage-to-decimal conversion patterns (**SIMPLE** consistency)
   - Include performance impact documentation (**PERFORMANT** transparency)
   - Use established validation patterns (**MAINTAINABLE** reliability)

3. **Display Integration** ([src/components/viz/Container.svelte](src/components/viz/Container.svelte)):
   - Add to rendering pipeline with appropriate priority (**PERFORMANT**)
   - Include in dirty rectangle optimization (**PERFORMANT**)
   - Support responsive sizing and DPR awareness (**MAINTAINABLE**)
   - Follow established lifecycle patterns (**SIMPLE**)

#### Performance Optimization Patterns
**Technical Philosophy in Performance:**

- **Dirty Rectangle Rendering**: Only update changed regions (**PERFORMANT** + **SIMPLE** logic)
- **Object Pooling**: Reuse objects to minimize garbage collection (**PERFORMANT** + **MAINTAINABLE** resource management)
- **Layered Canvas**: Separate canvases for different update frequencies (**PERFORMANT** + **MAINTAINABLE** separation)
- **RequestAnimationFrame**: Never use setInterval for animations (**PERFORMANT** + **SIMPLE** timing)

> **LLM Developer Guidance**: Always choose the performance optimization that also enhances simplicity and maintainability. Avoid optimizations that add complexity without measurable performance benefits.

### 5.4. Testing and Validation

#### Performance Testing
**Technical Philosophy in Testing:**

- **60fps Validation**: Test with maximum component count (20+ displays) (**PERFORMANT** + **MAINTAINABLE** reliability)
- **Memory Leak Detection**: Extended session testing (8+ hours) (**MAINTAINABLE** + **PERFORMANT** resource management)
- **Latency Measurement**: Data-to-visual update timing validation (**PERFORMANT** + **SIMPLE** metrics)
- **Resource Usage**: CPU and memory profiling under load (**PERFORMANT** + **SIMPLE** monitoring)

#### UX Validation
**Technical Philosophy in User Experience:**

- **Glance Testing**: Can users understand market state in 1-2 seconds? (**SIMPLE** immediate comprehension)
- **Workflow Testing**: Does component support progressive disclosure? (**MAINTAINABLE** consistent patterns)
- **Cognitive Load Assessment**: Is information appropriately prioritized? (**SIMPLE** mental model)
- **Pattern Recognition**: Does component support intuitive understanding? (**SIMPLE** user experience)

#### Testing Philosophy for LLM Developers
> **"Simple, Performant, Maintainable Testing"**:
> - **SIMPLE**: Clear test scenarios that validate specific behaviors
> - **PERFORMANT**: Tests that run quickly and provide immediate feedback
> - **MAINTAINABLE**: Tests that remain stable as the system evolves

---

## 6. Integration with Architecture Documents

### 6.1. Relationship to Core Documents

#### NeuroSense_FX_Design_Document.md
- **Purpose**: High-level design philosophy and scientific principles
- **Connection**: UX Architecture implements these principles in concrete component interactions
- **Reference**: When making architectural decisions, refer to cognitive psychology and human factors sections

#### CLAUDE.md
- **Purpose**: Technical implementation details and code architecture
- **Connection**: UX Architecture provides the "why" behind technical patterns
- **Reference**: When implementing components, use UX Architecture to understand performance and cognitive constraints

#### Component DESIGN_*.md Files
- **Purpose**: Detailed technical specifications for individual components
- **Connection**: UX Architecture explains how components work together as a cohesive system
- **Reference**: When developing components, use UX Architecture to understand integration patterns

### 6.2. Cross-Reference System

#### Key Architecture Documents
- **[Container-Display Architecture](docs/DESIGN_Container_Display_Architecture.md)**: Responsive behavior and layout management
- **[Unified Context Menu Architecture](docs/DESIGN_Unified_ContextMenu_Architecture.md)**: Configuration management across 85+ parameters
- **[Geometry Foundation](docs/DESIGN_Geometry_Foundation.md)**: Unified coordinate systems and spatial relationships
- **[Market Profile Design](docs/DESIGN_MARKETPROFILE.md)**: Price distribution visualization
- **[Volatility Orb Design](docs/DESIGN_Volatility_Orb.md)**: Market condition visualization
- **[Day Range Meter Design](docs/DESIGN_DayRangeMeter.md)**: ADR reference system
- **[Price Display Design](docs/DESIGN_Price_Display.md)**: Numeric price representation
- **[Price Float Design](docs/DESIGN_Price_Float.md)**: Visual price tracking

#### Code Integration Points
- **[Display Store](src/stores/displayStore.js)**: State management and configuration
- **[Visualization Container](src/components/viz/Container.svelte)**: Rendering orchestration
- **[Unified Configuration](src/lib/viz/UnifiedConfig.js)**: Parameter management
- **[Performance Monitor](src/lib/viz/PerformanceMonitor.js)**: System performance tracking

---

## 7. Documentation Maintenance

### 7.1. Keeping This Document Current

This UX Architecture document should be updated when:

1. **New Components Added**: Update component hierarchy and integration patterns
2. **Workflow Changes**: Modify user workflow documentation to reflect new patterns
3. **Performance Architecture Changes**: Update performance budget and constraints
4. **User Feedback Incorporated**: Revise cognitive design sections based on user research

### 7.2. Validation Process

#### Regular Review Checklist
- [ ] Component hierarchy reflects current implementation
- [ ] Performance constraints match measured system behavior
- [ ] User workflow documentation matches actual user behavior
- [ ] Cross-references are accurate and up-to-date
- [ ] Developer integration guidelines remain relevant

#### Community Contribution
When making changes to the UX system:
1. Update this document to reflect changes
2. Update cross-references to related documents
3. Validate that cognitive design principles are maintained
4. Test that performance constraints are respected
5. Ensure developer guidelines remain accurate

---

## Conclusion

The UX Architecture serves as the living bridge between human-centered design principles and technical implementation. It ensures that as the system evolves, it continues to serve the core mission of reducing cognitive load and extending human capabilities for professional traders.

### **Final Technical Philosophy Guidance**

Every technical decision should be evaluated against three fundamental questions:

1. **"Is this SIMPLE?"** - Does it have clear mental models, minimal complexity, and predictable behavior?
2. **"Is this PERFORMANT?"** - Does it maintain 60fps, sub-100ms latency, and memory efficiency?
3. **"Is this MAINTAINABLE?"** - Does it have single responsibility, loose coupling, and extensible design?

And the overarching question: **"Does this serve the trader's cognitive needs and support their natural workflow?"**

When in doubt during development, refer to this document to understand the user experience context and make decisions that preserve both the **human-centered design philosophy** and the **technical philosophy** of "Simple, Performant, Maintainable."

---

**For LLM Developers**: This document provides the complete context needed to understand not just **what** to build, but **why** we build it this way. Every implementation should honor the legacy of human-centered design while adhering to our technical philosophy.

---

*This document is part of the NeuroSense FX documentation ecosystem. For the complete picture, also refer to the [NeuroSense_FX_Design_Document.md](NeuroSense_FX_Design_Document.md) for high-level design principles and [CLAUDE.md](CLAUDE.md) for technical implementation details.*