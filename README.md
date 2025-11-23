# NeuroSense FX

A financial trading visualization platform designed for extended market monitoring and analysis.

## Vision & Philosophy

**NeuroSense FX** is designed as an interface for market data visualization, focusing on clear presentation of information through visual elements.

### Project Technical Philosophy: "Simple, Performant, Maintainable"

Every development decision is guided by these three non-negotiable pillars:

#### **SIMPLE**
- Clear mental models and intuitive component design
- Minimal complexity with predictable behavior patterns
- Self-documenting code that explains its purpose through structure

#### **PERFORMANT**
- Efficient rendering for smooth visual updates
- Responsive data-to-visual updates
- Resource management for multiple concurrent displays

#### **MAINTAINABLE**
- Single responsibility components with loose coupling
- Extensible design that's easy to enhance without breaking existing functionality
- Comprehensive documentation with clear decision rationale

## Core Problem Solved

Traditional trading interfaces overload traders with numerical data and cognitive demands during extended sessions, leading to mental fatigue, slower decision-making, and reduced pattern recognition capabilities.

**NeuroSense FX** addresses these issues through a perceptual interface that reduces cognitive load by presenting information visually rather than numerically, leveraging pattern recognition capabilities, and supporting intuitive rather than analytical processing.

## Key Features

### Advanced Visualizations
- **Market Profile**: Price distribution visualization with 6 rendering modes including delta analysis
- **Volatility Orb**: Dynamic volatility visualization with multiple color modes and smooth transitions
- **Day Range Meter**: Vertical ADR reference system with graduated markers and proximity alerts
- **Price Float**: Horizontal line with glow effects and smooth animated transitions
- **Price Display**: Monospaced numeric display tracking vertically with price movement

### Multi-Display Architecture
- **Three-Layer Floating System**: Dynamic displays with intelligent z-index management
- **Workspace Persistence**: Customizable layouts with grid snapping and collision detection
- **Performance Scaling**: Graceful support for 20+ simultaneous displays
- **Glanceability Design**: One-second comprehension of market state with progressive disclosure

## Development Setup

### Prerequisites
- VS Code with Dev Containers extension
- Docker Desktop installed and running
- Git repository clone

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd neurosense-fx
   ```

2. **Open in VS Code**
   ```bash
   code .
   ```

3. **Reopen in Dev Container**
   - VS Code will automatically detect the `.devcontainer/` configuration
   - When prompted, click "Reopen in Container"
   - Wait for container build (first time only)

4. **Automatic Setup**
   - Dependencies install automatically via `postCreateCommand`
   - MCP server configuration initializes

5. **Start Services**
   ```bash
   ./run.sh start
   ```

### Development URLs
- **Development**: Frontend http://localhost:5174, Backend ws://localhost:8080
- **Production**: Frontend http://localhost:4173, Backend ws://localhost:8081

### Service Management
```bash
./run.sh start    # Start all services
./run.sh stop     # Stop all services
./run.sh status   # Check service status
./run.sh logs     # View service logs
```

## Development Commands

### Development Workflow
```bash
# Start development environment
./run.sh dev          # Start development with HMR (frontend 5174 + backend 8080)
./run.sh start        # Start production mode (frontend 4173 + backend 8081)

# Development URLs
# Development: Frontend http://localhost:5174, Backend ws://localhost:8080
# Production: Frontend http://localhost:4173, Backend ws://localhost:8081
```

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Code linting (when implemented)
npm run format       # Code formatting (when implemented)
```

### Project Setup
- [`./setup_project.sh`](setup_project.sh) - Configures the development environment
  - Standard setup: `./setup_project.sh`
  - Clean setup: `./setup_project.sh --clean`

## Architecture Overview

### Technology Stack
- **Frontend**: Svelte 4.x with Vite build system
- **Rendering**: Canvas 2D API with DPR-aware crisp rendering
- **State Management**: Centralized Svelte stores with web workers
- **Backend**: Node.js WebSocket server with cTrader Open API integration
- **Data Processing**: Real-time tick processing with WebSocket streaming

### Monorepo Structure

This repository uses a monorepo architecture to keep concerns separated while maintaining tight integration:

- **`neurosensefx` (Root):** The Svelte frontend application with canvas-based rendering pipeline
- **`services/tick-backend`:** The Node.js backend service connecting to cTrader API
- **`libs/cTrader-Layer`:** Shared library providing low-level cTrader Open API interaction

## Current Status

**Production Maturity**: ~65% complete, functional for development and testing

### Current Capabilities
- ✅ Real-time FX market data visualization via cTrader integration
- ✅ Multiple display types: Market Profile, Volatility Orb, Day Range Meter
- ✅ Drag-and-drop workspace management with persistence
- ✅ Environment-aware development (HMR) and production modes
- ✅ Canvas rendering with DPR-aware text
- ✅ Comprehensive service management and monitoring

## Documentation

**📚 Comprehensive Documentation Hub**: [docs/DOCUMENTATION_INDEX.md](docs/DOCUMENTATION_INDEX.md)

### Key Documentation for Developers

- **🎯 [UX Architecture](docs/DESIGN_UX_Architecture.md)** - Understanding the "why" behind system design (15 min read)
- **🔧 [Technical Architecture](CLAUDE.md)** - Implementation patterns and development guidelines (5 min read)
- **🚀 [Quick Start Guide](docs/DOCUMENTATION_INDEX.md#quick-start-for-developers)** - Get started in 45 minutes

## Design Philosophy

NeuroSense FX focuses on effective presentation of financial information through visual elements and responsive design.

### Core Values
- **Clear Design**: Focus on readable and understandable visual presentation
- **User-Centered Approach**: Design decisions serve user needs
- **Maintainable Implementation**: Clean, well-structured code
- **Responsive System**: Adapts to user interaction and data changes

## Contributing

We welcome contributions that align with our design philosophy. Please see our development guidelines before submitting pull requests.

---

**NeuroSense FX** - Financial trading visualization platform.