# NeuroSense FX

A foreign exchange trading visualization platform that provides visual patterns for quick market understanding while monitoring multiple currency pairs.

> **Note**: This project uses the [Solatis claude-config](https://github.com/solatis/claude-config/tree/feat/installer) skills framework for structured LLM-assisted development. See `skills/README.md` for the development workflow.

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

### Testing
```bash
npm test                      # Run all E2E tests
npx playwright test --ui      # Run tests with Playwright UI
npx playwright test --headed  # Run tests in headed browser mode
```

Tests cover the complete application workflow including display creation, interaction, persistence, and keyboard shortcuts. See `src/tests/e2e/comprehensive-llm-workflow.spec.js` for details.

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

skills/                # Solatis claude-config skills for structured LLM workflows
├── deepthink/         # Analytical reasoning for open-ended questions
├── problem-analysis/  # Root cause identification workflow
├── planner/           # Implementation planning and execution
├── codebase-analysis/ # Systematic codebase exploration
├── decision-critic/   # Decision stress-testing and validation
├── refactor/          # Code quality and technical debt review
├── prompt-engineer/   # Prompt optimization with 100+ research papers
└── doc-sync/          # Documentation synchronization
```

## Development Workflow

This project uses structured workflows to ensure high-quality LLM-assisted development:

1. **Explore** - Use `codebase-analysis` for large codebase exploration
2. **Think** - Use `deepthink` for analytical questions (most common)
3. **Plan** - Use `planner` to write implementation plans with review cycles
4. **Clear** - `/clear` to start fresh with clean context
5. **Execute** - Use `planner` to execute the approved plan

See [Solatis claude-config](https://github.com/solatis/claude-config/tree/feat/installer) for full documentation.

## License

Private - All rights reserved