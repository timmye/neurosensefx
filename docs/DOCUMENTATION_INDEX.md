# NeuroSense FX Documentation Hub

## Overview

This index provides a complete guide to NeuroSense FX documentation, organized by purpose and audience. It serves as the central navigation system for understanding the project from high-level design philosophy to detailed technical implementation.

## Quick Start for Developers

**New to NeuroSense FX? Start here:**

1. **[UX Architecture](DESIGN_UX_Architecture.md)** - **⭐ CRITICAL** - Understand the "why" behind system design and our technical philosophy (15 min read)
2. **[Technical Architecture](../CLAUDE.md)** - Learn the technical implementation patterns (20 min read)
3. **[Component Quick Start](#component-documentation)** - Choose your first component to explore
4. **[Development Setup](../README.md)** - Get the development environment running

### 🎯 **Project Technical Philosophy: "Simple, Performant, Maintainable"**

Before writing any code, understand that every decision must satisfy these three pillars:

- **SIMPLE**: Clear mental models, minimal complexity, predictable behavior
- **PERFORMANT**: 60fps guarantee, sub-100ms latency, memory efficiency
- **MAINTAINABLE**: Single responsibility, loose coupling, extensible design

> **LLM Developer Tip**: The UX Architecture document explains how to apply this philosophy to real development scenarios.

---

## Documentation by Purpose

### 🧠 Strategic Design & Philosophy

| Document | Purpose | Audience | Reading Time |
|----------|---------|----------|--------------|
| **[NeuroSense FX Design Document](NeuroSense_FX_Design_Document.md)** | High-level design philosophy, neuroscience foundation, user experience principles | All stakeholders | 20 min |
| **[UX Architecture](DESIGN_UX_Architecture.md)** | **⭐ CENTRAL REFERENCE** - How components work together to support trading workflows | **Developers, Designers** | **15 min** |
| **[CLAUDE.md](../CLAUDE.md)** | Technical architecture, implementation patterns, development guidelines | **Developers** | **25 min** |

### 🏗️ System Architecture & Integration

| Document | Purpose | Key Sections |
|----------|---------|--------------|
| **[Container-Display Architecture](DESIGN_Container_Display_Architecture.md)** | Responsive behavior, layout management, display lifecycle | Floating system, collision detection, workspace persistence |
| **[Unified Context Menu Architecture](DESIGN_Unified_ContextMenu_Architecture.md)** | Configuration management across 85+ parameters | Parameter groups, real-time updates, schema validation |
| **[Geometry Foundation](DESIGN_Geometry_Foundation.md)** | Unified coordinate systems, spatial relationships, DPR awareness | Coordinate transformation, responsive scaling |
| **[Performance Architecture](src/lib/viz/PerformanceMonitor.js)** | System performance monitoring and optimization | Performance budgets, resource allocation |

### 📊 Component Documentation

| Component | Design Doc | Implementation | Status |
|-----------|------------|----------------|---------|
| **[Market Profile](DESIGN_MARKETPROFILE.md)** | 6 rendering modes, delta analysis, color coding | [src/lib/viz/marketProfile.js](../src/lib/viz/marketProfile.js) | ✅ Production Ready |
| **[Volatility Orb](DESIGN_VOLATILITYORB.md)** | Multi-mode visualization, market sentiment | [src/lib/viz/volatilityOrb.js](../src/lib/viz/volatilityOrb.js) | ✅ Production Ready |
| **[Day Range Meter](DESIGN_DayRangeMeter.md)** | ADR reference system, graduated markers | [src/lib/viz/dayRangeMeter.js](../src/lib/viz/dayRangeMeter.js) | ✅ Production Ready |
| **[Price Display](DESIGN_PRICEDISPLAY.md)** | Crisp text rendering, monospace fonts | [src/lib/viz/priceDisplay.js](../src/lib/viz/priceDisplay.js) | ✅ Production Ready |
| **[Price Float](DESIGN_PRICEFLOAT.md)** | Visual price tracking, smooth animations | [src/lib/viz/priceFloat.js](../src/lib/viz/priceFloat.js) | ✅ Production Ready |
| **[Status Panel](DESIGN_StatusPanel.md)** | Real-time connectivity & data delay monitoring | [src/components/StatusPanel/](../src/components/StatusPanel/) | ✅ Production Ready |

### 🛠️ Development & Implementation

| Resource | Purpose | Location |
|----------|---------|----------|
| **[Development Setup](../README.md)** | Environment setup, running services, manual testing workflow | Project root |
| **[Visualization Library](../src/lib/viz/README.md)** | Component library architecture and usage patterns | [src/lib/viz/README.md](../src/lib/viz/README.md) |
| **[Geometry Foundation](DESIGN_UNIFIED_GEOMETRY_FOUNDATION.md)** | **Component positioning, sizing, and spatial relationships** | **Essential for layout work** |
| **[Configuration System](../src/lib/viz/UnifiedConfig.js)** | Parameter management, schema validation | [src/lib/viz/UnifiedConfig.js](../src/lib/viz/UnifiedConfig.js) |
| **[Display Store](../src/stores/displayStore.js)** | State management, data flow architecture | [src/stores/displayStore.js](../src/stores/displayStore.js) |

### 📋 Reference Materials

| Resource | Purpose | Location |
|----------|---------|----------|
| **[Schema Definition](../src/data/schema.js)** | Data structure validation, market data format | [src/data/schema.js](../src/data/schema.js) |
| **[Parameter Groups](../src/components/UnifiedContextMenu/utils/parameterGroups.js)** | All 85+ component parameters | [src/components/UnifiedContextMenu/utils/parameterGroups.js](../src/components/UnifiedContextMenu/utils/parameterGroups.js) |
| **[WebSocket Client](../src/data/wsClient.js)** | Real-time data streaming, connection management | [src/data/wsClient.js](../src/data/wsClient.js) |
| **[DevContainer Setup](../.devcontainer/)** | Development environment configuration | [.devcontainer/](../.devcontainer/) |

---

## Learning Paths

### 🚀 New Developer Path

1. **System Understanding** (45 min)
   - [UX Architecture](DESIGN_UX_Architecture.md) - **⭐ START HERE** - Understand the "why" + technical philosophy
   - [Technical Architecture](../CLAUDE.md) - Learn the "how"
   - [Development Setup](../README.md) - Get your environment running

2. **Component Deep Dive** (30 min)
   - Choose one component from [Component Documentation](#component-documentation)
   - **Recommended**: Start with [Status Panel](DESIGN_StatusPanel.md) for understanding system monitoring and data flow
   - Read design document + examine implementation
   - [Configuration System](../src/lib/viz/UnifiedConfig.js) - Understand parameters

3. **Hands-On Development** (60+ min)
   - [Visualization Library](../src/lib/viz/README.md) - Component architecture
   - [Display Store](../src/stores/displayStore.js) - State management
   - Make your first modification or addition

**Philosophy Checkpoint**: Before starting step 3, review the "Simple, Performant, Maintainable" framework in the UX Architecture document.

### 🎨 Designer/UX Researcher Path

1. **Design Philosophy** (30 min)
   - [NeuroSense FX Design Document](NeuroSense_FX_Design_Document.md) - Scientific foundations
   - [UX Architecture](DESIGN_UX_Architecture.md) - User experience patterns

2. **Component Exploration** (45 min)
   - Browse [Component Documentation](#component-documentation) for visual design patterns
   - [Configuration System](../src/lib/viz/UnifiedConfig.js) - Understand customization options
   - [Parameter Groups](../src/components/UnifiedContextMenu/utils/parameterGroups.js) - User control options

3. **Integration Understanding** (30 min)
   - [Container-Display Architecture](DESIGN_Container_Display_Architecture.md) - Layout behavior
   - [Unified Context Menu](DESIGN_Unified_ContextMenu_Architecture.md) - User interaction patterns

### 🔧 Advanced Developer Path

1. **Architecture Mastery** (60 min)
   - [Technical Architecture](../CLAUDE.md) - Complete system understanding
   - [Performance Architecture](src/lib/viz/PerformanceMonitor.js) - Optimization patterns
   - [Geometry Foundation](DESIGN_Geometry_Foundation.md) - Coordinate systems

2. **Performance Deep Dive** (45 min)
   - [Performance Monitor](../src/lib/viz/PerformanceMonitor.js) - Monitoring system
   - [Display Store](../src/stores/displayStore.js) - State optimization
   - Component-specific performance patterns (see individual design docs)

3. **Extension & Customization** (60+ min)
   - [Component Documentation](#component-documentation) - Understanding existing patterns
   - [Configuration System](../src/lib/viz/UnifiedConfig.js) - Adding new parameters
   - [Schema Definition](../src/data/schema.js) - Data structure extensions

---

## Common Questions

### ❓ Where do I start if I want to modify a component?
1. **Philosophy First**: Review "Simple, Performant, Maintainable" framework in [UX Architecture](DESIGN_UX_Architecture.md)
2. **Design Document**: Read the component's design document (from [Component Documentation](#component-documentation))
3. **Implementation**: Examine the implementation in [src/lib/viz/](../src/lib/viz/)
4. **Integration Patterns**: Check [UX Architecture](DESIGN_UX_Architecture.md) for integration patterns
5. **Configuration**: Review [Parameter Groups](../src/components/UnifiedContextMenu/utils/parameterGroups.js) for configuration options

### ❓ How do I add a new visualization component?
1. **Philosophy Framework**: Apply "Simple, Performant, Maintainable" principles from [UX Architecture](DESIGN_UX_Architecture.md)
2. **Design Phase**: Create a design document following existing patterns
3. **Architecture**: Understand [Container-Display Architecture](DESIGN_Container_Display_Architecture.md)
4. **Implementation**: Follow patterns in [src/lib/viz/](../src/lib/viz/) and [UX Architecture](DESIGN_UX_Architecture.md#5-developer-integration-guide)
5. **Integration**: Add to [Parameter Groups](../src/components/UnifiedContextMenu/utils/parameterGroups.js) and configuration system

### ❓ How do performance requirements work?
- **Philosophy**: 60fps guarantee is a **PERFORMANT** pillar requirement
- **System-wide**: [Performance Architecture](DESIGN_UX_Architecture.md#41-performance-architecture)
- **Component-specific**: Each design document includes performance requirements
- **Monitoring**: [Performance Monitor](../src/lib/viz/PerformanceMonitor.js)
- **Guidelines**: [UX Architecture](DESIGN_UX_Architecture.md#51-understanding-the-system-mental-model)

### ❓ Where are user configuration options defined?
- **All parameters**: [Parameter Groups](../src/components/UnifiedContextMenu/utils/parameterGroups.js) (85+ parameters)
- **Schema validation**: [Schema Definition](../src/data/schema.js)
- **UI generation**: [Unified Context Menu](DESIGN_Unified_ContextMenu_Architecture.md)
- **Real-time updates**: [Display Store](../src/stores/displayStore.js)

### ❓ How does the Status Panel monitor system health?
- **Real-time monitoring**: [Status Panel](DESIGN_StatusPanel.md) tracks internet, WebSocket, and data delay
- **NeuroSense design**: Blue=good, Purple=warning, Red=disconnected (red only for connection loss)
- **Trader-focused**: Millisecond data delay tracking from real tick timestamps
- **Performance impact**: Sub-100ms response, zero impact on trading displays

### ❓ How do I debug performance issues?
1. **Philosophy Check**: Are you maintaining 60fps? (**PERFORMANT** pillar)
2. **Performance Monitor**: Use [src/lib/viz/PerformanceMonitor.js](../src/lib/viz/PerformanceMonitor.js)
3. **Performance Budgets**: Check [UX Architecture](DESIGN_UX_Architecture.md#41-performance-architecture)
4. **Component Patterns**: Review individual component design documents
5. **Profiling Tools**: Use browser DevTools with component-specific guidance

### ❓ How do I know if my solution follows the technical philosophy?
Before committing any code, ask:
- **SIMPLE**: Is this solution clear, intuitive, and minimal complexity?
- **PERFORMANT**: Does this maintain 60fps and sub-100ms latency?
- **MAINTAINABLE**: Does this have single responsibility and loose coupling?

If any answer is "no," refactor until all three are satisfied.

---

## Document Status & Maintenance

### ✅ Current Status (November 2024)

| Document | Status | Last Updated |
|----------|--------|--------------|
| **UX Architecture** | ⭐ **LIVING REFERENCE** | November 8, 2024 |
| **Technical Architecture (CLAUDE.md)** | ✅ Current | November 8, 2024 |
| **Component Design Documents** | ✅ Production Ready | November 8, 2024 |
| **Integration Architecture** | ✅ Current | November 8, 2024 |

### 🔄 Maintenance Schedule

- **Monthly**: Review UX Architecture for accuracy with current implementation
- **Quarterly**: Validate cross-references and navigation paths
- **As Needed**: Update when components or workflows change
- **Community**: Contributions welcome via pull requests

### 📝 Contributing to Documentation

When making changes to the system:

1. **Update relevant design documents** before merging code changes
2. **Review cross-references** in this index to ensure they remain accurate
3. **Test documentation paths** to verify new developers can follow them
4. **Update this index** when adding or restructuring documents

---

## Project Context

### 🎯 Mission Statement

> **"Create a human-centric visual trading interface that reduces cognitive load and extends human capabilities for professional Foreign Exchange traders."**

### 📊 Current Project Status

- **Overall Completion**: 98% Production Ready
- **Core Features**: ✅ Complete (Market Profile, Volatility Orb, Day Range Meter, Price Display/Float)
- **Architecture**: ✅ Complete (Three-layer floating system, unified configuration, workspace persistence)
- **Performance**: ✅ Complete (60fps rendering, sub-100ms latency, 20+ display support)
- **Documentation**: 🔄 In Progress (This index and UX Architecture integration)

### 🔮 Next Steps

1. **Complete MCP Server Integration** - Enhanced development experience
2. **Edge Case Performance** - Optimization for 15+ displays
3. **Accessibility Enhancement** - Screen reader support and keyboard navigation
4. **Browser Compatibility** - Safari and Firefox final testing

---

*This documentation index is maintained as part of the NeuroSense FX project. For the most current information, check the project repository and individual document update timestamps.*