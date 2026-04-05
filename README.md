# NeuroSense FX

A foreign exchange trading visualization platform that provides visual patterns for quick market understanding while monitoring multiple currency pairs.

> **Development Workflow**: This project uses the [Solatis claude-config](https://github.com/solatis/claude-config/tree/feat/installer) skills framework for structured LLM-assisted development. See `CLAUDE.md` for skill usage guidance.

## Features

- Real-time FX market data visualization via cTrader integration
- Multiple display types with configuration management
- Drag-and-drop workspace management with persistence
- Canvas rendering with DPR-aware crisp text
- WebSocket-based real-time data streaming
- User authentication (register/login/logout) with session management
- Server-side persistence for workspaces, chart drawings, and price markers (PostgreSQL)
- Automatic migration of browser data to server on first login

## Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- cTrader API credentials (set in `.env`)
- PostgreSQL 15+ and Redis 7+ (via Docker or native install; see [docs/local-dev-setup.md](docs/local-dev-setup.md))

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

Create a `.env` file based on `.env.example`. Required variables include cTrader API credentials and database connection settings:
```
CTRADER_API_ID=your_api_id
CTRADER_API_SECRET=your_api_secret
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=neurosensefx_dev
PG_USER=neurosensefx
PG_PASSWORD=your_password
REDIS_URL=redis://localhost:6379
```

See [docs/local-dev-setup.md](docs/local-dev-setup.md) for the full setup guide.

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
- **Backend**: Node.js WebSocket server with cTrader Open API, Express HTTP server for auth and persistence
- **Authentication**: bcrypt password hashing, Redis-backed sessions (HTTP-only cookies, 30-day TTL)
- **Database**: PostgreSQL 15 for workspaces, drawings, and price markers
- **Cache**: Redis 7 for session storage
- **Data Processing**: Real-time tick processing with WebSocket streaming

## Project Structure

```
src/                    # Frontend Svelte application
├── components/         # Svelte components (includes LoginForm.svelte)
├── stores/             # Svelte stores (includes authStore.js for session state)
├── lib/               # Utility libraries and visualizers
└── App.svelte         # Main application component

services/              # Backend services
├── tick-backend/      # WebSocket backend, Express HTTP server, auth, persistence
└── ...

libs/                  # External libraries
└── cTrader-Layer/     # cTrader API integration

skills/                # Solatis claude-config skills
├── deepthink/         # Structured reasoning for questions with unknown answer structure
├── problem-analysis/  # Root cause identification (does NOT propose solutions)
├── codebase-analysis/ # Systematic codebase exploration with evidence requirements
├── decision-critic/   # Decision stress-testing (adversarial, not sycophantic)
├── planner/           # Implementation planning/execution with quality gates
├── refactor/          # Technical debt analysis (10 smell categories in parallel)
├── prompt-engineer/   # Prompt optimization with 100+ research papers
├── doc-sync/          # CLAUDE.md/README.md hierarchy synchronization
└── scripts/           # Python skill implementations
```

## License

Private - All rights reserved
