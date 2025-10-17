# NeuroSense FX - Project Brief

## Project Overview
NeuroSense FX is a high-performance, human-centric financial data visualization tool designed for professional Foreign Exchange (FX) traders. The system provides real-time, perceptual insights into market prices and activity through an innovative visual interface that minimizes cognitive fatigue during extended trading sessions (8-12 hours).

## Core Requirements & Goals
- **Performance**: Display up to 20 independent, real-time price feed visualizations in a single browser tab
- **Low Cognitive Load**: Apply human factors, neuroscience, and military display design principles
- **Real-time Processing**: Handle live WebSocket data streams with minimal latency
- **Scalability**: Support multiple currency pairs simultaneously
- **Maintainability**: Lean, simple codebase that's easy to understand and modify

## Key Features
1. **220px × 120px Display Area**: Compact, rich visual workspace for each price feed
2. **Day Range Meter**: Primary Y-axis reference showing current price within Average Daily Range (ADR)
3. **Price Float**: Smooth, animated horizontal line representing current FX price
4. **Price Figures**: Price displayed in digits, fx format that moves up and down with price float
4. **Volatility Orb**: Circular visual element indicating market volatility
5. **Market Profile**: Visual representation of price distribution and buy/sell pressure
6. **Event Highlighting**: Visual alerts for significant price movements

## Target Users
- Professional FX traders requiring extended monitoring sessions
- Trading desks needing multiple simultaneous price feeds
- Financial analysts focused on perceptual market insights
- Users prioritizing speed and efficiency over traditional charting

## Success Metrics
- **Performance**: Render time minimal with 20 active displays
- **Efficiency**: Reduces cognitive load compared to traditional charting
- **Reliability**: Stable WebSocket connections with minimal data loss
- **Usability**: Intuitive interface requiring minimal training
- **Scalability**: Handles high-frequency data without performance degradation

## Technical Constraints
- Browser-based solution (no desktop application)
- Real-time WebSocket data processing
- Canvas-based rendering for performance
- Web Worker architecture for data processing
- Monorepo structure with separated concerns

## Project Scope
The project includes three main components:
1. **Frontend** (Svelte): Visualization and user interface
2. **Backend** (Node.js): WebSocket server and data processing
3. **cTrader Layer** (TypeScript): Low-level API integration

This Memory Bank serves as the foundation for understanding project context, requirements, and architectural decisions throughout development.
