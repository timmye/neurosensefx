# NeuroSense FX - Project Brief

## Project Overview
NeuroSense FX is a high-performance, human-centric financial data visualization tool designed for professional Foreign Exchange (FX) traders. The system provides real-time, perceptual insights into market prices and activity through an innovative visual interface that minimizes cognitive fatigue during extended trading sessions (8-12 hours).

## Core Requirements & Goals
- **Performance**: Display up to 20 independent, real-time price feed visualizations in a single browser tab
- **Low Cognitive Load**: Apply human factors, neuroscience, and military display design principles
- **Real-time Processing**: Handle live WebSocket data streams with minimal latency
- **Scalability**: Support multiple currency pairs simultaneously
- **Maintainability**: Lean, simple codebase that's easy to understand and modify
- **Quality Assurance**: Continuous testing to prevent regressions and ensure reliability

## Key Features
1. **220px × 120px Display Area**: Compact, rich visual workspace for each price feed
2. **Day Range Meter**: Primary Y-axis reference showing current price within Average Daily Range (ADR)
3. **Price Float**: Smooth, animated horizontal line representing current FX price
4. **Price Figures**: Price displayed in digits, fx format that moves up and down with price float
5. **Volatility Orb**: Circular visual element indicating market volatility
6. **Market Profile**: Visual representation of price distribution and buy/sell pressure
7. **Event Highlighting**: Visual alerts for significant price movements
8. **Canvas-Centric Interface**: Right-click context menus provide direct access to all 95+ visualization controls

## Target Users
- Professional FX traders requiring extended monitoring sessions
- Trading desks needing multiple simultaneous price feeds
- Financial analysts focused on perceptual market insights
- Users prioritizing speed and efficiency over traditional charting

## Success Metrics
- **Performance**: 60fps rendering with 20 active displays
- **Efficiency**: Reduces cognitive load compared to traditional charting
- **Reliability**: Stable WebSocket connections with minimal data loss
- **Usability**: Intuitive interface requiring minimal training
- **Scalability**: Handles high-frequency data without performance degradation
- **Quality**: Workflow-based baseline tests passing with enhanced browser log monitoring

## Technical Constraints
- Browser-based solution (no desktop application)
- Real-time WebSocket data processing
- Canvas-based rendering for performance
- Web Worker architecture for data processing
- Monorepo structure with separated concerns
- Continuous testing integration for quality assurance
- Unified service management via `./run.sh` commands

## Project Scope
The project includes three main components:
1. **Frontend** (Svelte): Visualization and user interface
2. **Backend** (Node.js): WebSocket server and data processing
3. **cTrader Layer** (TypeScript): Low-level API integration
4. **Testing Infrastructure** (Playwright): Baseline and comprehensive testing

## Current Implementation Status
- **Phase 1**: Canvas-centric interface foundation is COMPLETE ✅
- **FloatingSymbolPalette**: Fully implemented with drag, minimize, and state persistence
- **FloatingCanvas**: Fully functional with event handling
- **CanvasContextMenu**: Complete implementation with 6 tabs and 95+ parameters
- **Baseline Testing**: Fully operational (3 workflow tests with enhanced browser log monitoring)
- **Architecture Confidence**: 100% (solid foundation ready for Phase 3)

## Development Environment
- **Frontend Server**: Vite development server (port 5173)
- **Backend Server**: Node.js WebSocket server (port 8080)
- **Service Management**: Unified interface via `./run.sh` commands
- **Testing**: Playwright e2e testing with baseline test suite
- **MCP Integration**: Serena and Context7 MCP servers for enhanced development
- **Continuous Testing**: Baseline tests run after each change for fast feedback

## Service Management
```bash
# Unified service management (primary interface)
./run.sh start         # Start all services (recommended)
./run.sh stop          # Stop all services
./run.sh status        # Check service status
./run.sh logs          # View service logs
./run.sh cleanup       # Clean up old processes
```

## Testing Strategy
- **Workflow-Based Tests**: 3 primary trader workflow tests following Workflows → Interactions → Technology framework
- **Enhanced Browser Log Monitoring**: Comprehensive console, network, and error tracking
- **Execution Time**: Optimized for fast feedback with detailed reporting
- **Test Coverage**: Complete trader workflows from workspace setup to market analysis
- **Continuous Integration**: Tests run after each code change with monitoring
- **Quality Assurance**: Prevents regressions and ensures reliability with professional validation

This Memory Bank serves as the foundation for understanding project context, requirements, and architectural decisions throughout development.