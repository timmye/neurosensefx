# NeuroSense FX

A sophisticated financial trading visualization platform designed for professional Foreign Exchange traders who require extended market monitoring capabilities during 8-12 hour trading sessions.

## Vision & Philosophy

**NeuroSense FX** is fundamentally designed as a human-centric trading interface that minimizes cognitive fatigue during extended trading sessions. The core philosophy works with human cognitive strengths rather than against them, applying principles from neuroscience, human factors, and military/aviation display design.

The system combines abstract visual metaphors with targeted numerical displays, leveraging the brain's superior ability to process visual patterns and spatial relationships while providing precise numerical information when needed.

## Core Problem Solved

Traditional trading interfaces overload traders with numerical data and cognitive demands during extended sessions, leading to:
- Mental fatigue and slower decision-making
- Increased error rates under pressure
- Reduced pattern recognition capabilities
- Limited sustained attention span

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

### Real-Time Performance
- **Sub-100ms Latency**: Data to visual update under 100ms
- **60fps Rendering**: Smooth animation with DPR-aware crisp text
- **8+ Hour Operation**: Stable continuous operation during extended sessions
- **Memory Efficiency**: Under 500MB usage with active displays

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
   - Playwright browsers install for testing
   - MCP server configuration initializes

5. **Start Services**
   ```bash
   ./run.sh start
   ```

### Development URLs
- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend**: ws://localhost:8080 (WebSocket server)

### Service Management
```bash
./run.sh start    # Start all services
./run.sh stop     # Stop all services
./run.sh status   # Check service status
./run.sh logs     # View service logs
```

## User Experience

### Three-Level Comprehension
- **Glance Level** (1-2 seconds): Immediate market state understanding
- **Focus Level** (5-10 seconds): Detailed price and volatility analysis
- **Analysis Level** (30+ seconds): Comprehensive pattern recognition

### Visual Processing Optimization
- **Pre-attentive Attributes**: Color, motion, size, position, shape for instant recognition
- **Parallel Processing**: Multiple visual elements processed simultaneously
- **Cognitive Load Minimization**: Perceptual processing over analytical thinking
- **Sustained Attention**: Fatigue-resistant design for extended sessions

### Alerting Philosophy
Subtle perceptual alerts rather than disruptive notifications:
- ADR proximity pulses for range trading
- Volatility orb flashes for volatility changes
- Pattern recognition cues through visual highlighting

## Architecture Overview

### Technology Stack
- **Frontend**: Svelte 4.x with Vite build system
- **Rendering**: Canvas 2D API with DPR-aware crisp rendering
- **State Management**: Centralized Svelte stores with web workers
- **Backend**: Node.js WebSocket server with cTrader Open API integration
- **Data Processing**: Real-time tick processing with WebSocket streaming

### Three-Layer System
- **Layer 1**: Trading displays (z-index: 1-999)
- **Layer 2**: UI panels (z-index: 1000-9999)
- **Layer 3**: Overlays (z-index: 10000+)

### Component Architecture
- **Unified Configuration**: Schema-driven parameter management
- **Auto-Generated Controls**: Dynamic UI from configuration schema
- **Real-time Updates**: Live configuration changes without restart
- **Workspace Persistence**: Layout and preference storage

## Monorepo Structure

This repository uses a monorepo architecture to keep concerns separated while maintaining tight integration:

- **`neurosensefx` (Root):** The Svelte frontend application with canvas-based rendering pipeline
- **`services/tick-backend`:** The Node.js backend service connecting to cTrader API
- **`libs/cTrader-Layer`:** Shared library providing low-level cTrader Open API interaction

## Commands & Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run test         # Run Playwright tests
npm run test:e2e     # End-to-end testing
npm run lint         # Code linting
npm run format       # Code formatting
```

### Project Setup
- [`./setup_project.sh`](setup_project.sh) - Configures the development environment
  - Standard setup: `./setup_project.sh`
  - Clean setup: `./setup_project.sh --clean`

### Testing Infrastructure
- **Playwright**: End-to-end testing with multiple browsers
- **Visual Regression**: Automated UI testing
- **Performance Monitoring**: Frame rate and memory usage tracking
- **Component Testing**: Unit testing for core functionality

## Configuration & Customization

### Display Customization
- **Layout Management**: Drag-and-drop display positioning
- **Visual Preferences**: Customizable colors, sizes, and modes
- **Workspace Profiles**: Save and restore different layouts
- **Accessibility**: Support for diverse user abilities

### Advanced Settings
- **Performance Tuning**: Adjustable quality vs. performance settings
- **Data Sources**: Configurable market data providers
- **Alert Preferences**: Customizable notification thresholds
- **Keyboard Shortcuts**: Fully configurable key bindings

## Current Status

**Production Maturity**: 98% complete, production-ready
- Core functionality fully operational
- Architecture stable and well-documented
- Performance meets professional trading requirements
- Comprehensive testing infrastructure
- Currently in optimization and enhancement phase

### Recent Achievements
- Memory bank optimization for development efficiency
- Market profile delta modes completion
- Browser zoom awareness implementation
- Comprehensive browser compatibility testing
- Real-time configuration system implementation

## Documentation

For detailed technical information, see:
- **[Front-End Documentation](./docs/Front_End_Documentation.md):** Technical architecture guide
- **[Design Intent](./docs/NeuroSense_FX_Design_Document.md):** Core design philosophy
- **[Local Development Guide](./README_LOCAL_DEV.md):** Detailed setup instructions

## Design Philosophy

The innovation in NeuroSense FX lies not in specific technologies but in recognizing that effective technology extends human capabilities while respecting human limitations. This platform represents a fundamentally new paradigm for financial information presentation.

### Core Values
- **Scientific Foundation**: Grounded in neuroscience and human factors research
- **User-Centered Design**: Every decision serves the trader's cognitive needs
- **Technology Agnostic**: Implementation adapts to changing technologies
- **Adaptive Evolution**: System evolves with user needs and capabilities

## Contributing

We welcome contributions that align with our human-centered design philosophy. Please see our development guidelines and testing requirements before submitting pull requests.

---

**NeuroSense FX** - Extending human capabilities while respecting human limitations in financial trading.
