# NeuroSense FX

A foreign exchange trading visualization platform that provides visual patterns for quick market understanding while monitoring multiple currency pairs.

## Features

- Real-time FX market data visualization via cTrader integration
- Multiple display types with configuration management
- Drag-and-drop workspace management with persistence
- Canvas rendering with DPR-aware crisp text
- WebSocket-based real-time data streaming

## Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- cTrader API credentials (set in `.env`)

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```
The application will be available at http://localhost:5174

### Production Build
```bash
npm run build
npm run preview
```
The production build will be available at http://localhost:4173

## Environment Variables

Create a `.env` file based on `.env.example`:
```
CTRADER_API_ID=your_api_id
CTRADER_API_SECRET=your_api_secret
```

## Service Management

Use the provided scripts for service management:
```bash
./run.sh start      # Start all services
./run.sh stop       # Stop all services
./run.sh status     # Check service status
./run.sh logs       # View service logs
```

## Technology Stack

- **Frontend**: Svelte 4.x with Vite build system
- **Rendering**: Canvas 2D API with DPR-aware rendering
- **State Management**: Svelte stores
- **Backend**: Node.js WebSocket server with cTrader Open API
- **Data Processing**: Real-time tick processing with WebSocket streaming

## Project Structure

```
src/                    # Frontend Svelte application
├── components/         # Svelte components
├── lib/               # Utility libraries and visualizers
└── App.svelte         # Main application component

services/              # Backend services
├── tick-backend/      # WebSocket backend
└── ...

libs/                  # External libraries
└── cTrader-Layer/     # cTrader API integration
```

## License

Private - All rights reserved