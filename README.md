# NeuroSense FX

A foreign exchange trading visualization platform that provides visual patterns for quick market understanding while monitoring multiple currency pairs.

> **Development Workflow**: This project uses the [Solatis claude-config](https://github.com/solatis/claude-config/tree/feat/installer) skills framework for structured LLM-assisted development. See `CLAUDE.md` for skill usage guidance.

## Features

- Real-time FX market data visualization via cTrader integration (with TradingView as a secondary feed)
- Supervised feed reliability: the backend detects stale/offline data and auto-recovers feeds (see Backend Feed Reliability below)
- Multiple display types with configuration management
- Drag-and-drop workspace management with persistence
- Canvas rendering with DPR-aware crisp text
- Light/dark chart theme with `localStorage` persistence
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
./setup_project.sh
```
Installs all three dependency trees (frontend, backend, and the vendored cTrader layer) and builds the layer. Safe to re-run (use `--clean` to start fresh).

> The cTrader integration layer (`libs/cTrader-Layer/`) is an **internal vendored fork** — its
> compiled output is committed to this repo, so a fresh clone needs no submodule init, no external
> clone, and no npm fetch. The setup script rebuilds it to stay in sync; (re)build it manually only
> when editing its sources: `cd libs/cTrader-Layer && npx ttsc` (see `libs/cTrader-Layer/CLAUDE.md`).

PostgreSQL 15+, Redis 7+, and a populated `.env` are also required. **New here?** Start with the
[developer onboarding journey](docs/onboarding.md), then see [docs/local-dev-setup.md](docs/local-dev-setup.md)
for the exact commands.

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

Create a `.env` file based on `.env.example`. Required variables include cTrader API credentials, the frontend WebSocket URL, and PostgreSQL/Redis connection settings:
```
# cTrader API credentials (obtain from cTrader)
CTRADER_CLIENT_ID=your_client_id
CTRADER_CLIENT_SECRET=your_client_secret
CTRADER_ACCESS_TOKEN=your_access_token
CTRADER_REFRESH_TOKEN=your_refresh_token
CTRADER_ACCOUNT_ID=your_account_id
CTRADER_HOST_TYPE=LIVE
HOST=live.ctraderapi.com
PORT=5035

# Frontend -> backend WebSocket URL (dev port 8080; production 8081)
VITE_BACKEND_URL=ws://localhost:8080

# PostgreSQL (auth + persistence)
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=neurosensefx_dev
PG_USER=neurosensefx
PG_PASSWORD=your_password

# Redis (sessions)
REDIS_URL=redis://localhost:6379
```

See [docs/local-dev-setup.md](docs/local-dev-setup.md) for the full setup guide.

## Service Management

Use the provided scripts for service management:
```bash
./run.sh dev        # Start development with HMR (backend :8080, frontend :5174)
./run.sh start      # Start all services (production mode; backend :8081, frontend :4173)
./run.sh stop       # Stop all services
./run.sh status     # Check service status
./run.sh logs       # View service logs
```

### Backend Feed Reliability

The backend runs a feed-supervision tier (`services/tick-backend/supervision/`) that owns the cTrader connection lifecycle: it detects stale/offline conditions and recovers the feed automatically (capped+jittered backoff, never gives up). TradingView runs as a standalone self-recovering session. Two operational endpoints are exposed alongside the WebSocket/HTTP server:

- `GET http://localhost:8080/health` — no-auth health check returning current feed state.
- `POST http://localhost:8080/admin/reconnect` — dev-only manual reconnect trigger; body `{ "feed": "ctrader" | "tradingview" | "all" }` (returns 403 in production).

> Port note: dev backend is `8080`; production backend is `8081`.

## Strategy Backtesting

The `backtester/` directory contains a Python-based walk-forward analyzer that tests alternative SL/TP parameters against real historical OHLC data from the cTrader backend.

```bash
pip install -r backtester/requirements.txt

# Single SL/TP test (requires running backend)
python backtester/sl_tp_analyzer.py backtester/data/20260430_full_history.csv \
    --sl 25 --tp 60 --timeframe 15m --backend http://localhost:8080

# Grid sweep (tests all SL×TP combinations)
python backtester/sl_tp_analyzer.py backtester/data/20260430_full_history.csv \
    --sl-range 20,25,30,40 --tp-range 40,60,90,120 --timeframe 15m
```

Results (cumulative P/L charts, per-trade CSVs) are saved to `backtester/results/`. See [backtester/README.md](backtester/README.md) for full documentation.

## Technology Stack

- **Frontend**: Svelte 4.x with Vite build system
- **Rendering**: Canvas 2D API with DPR-aware rendering
- **State Management**: Svelte stores (incl. theme, timezone, market data stores)
- **Backend**: Node.js (>=18) WebSocket server with cTrader Open API, plus a TradingView WebSocket feed, and an Express HTTP server for auth and persistence
- **Feed Reliability**: FeedSupervisor tier driving the cTrader connection lifecycle (auto-recovery on stale/offline); TradingView self-recovers
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
├── tick-backend/      # WebSocket backend, Express HTTP server, auth, persistence,
│                      #   and supervision/ (feed-supervisor tier + /health, /admin/reconnect)
└── ...

backtester/            # SL/TP walk-forward backtester (Python)
├── sl_tp_analyzer.py  # Simulation engine, OHLC fetcher, charting, CSV output
├── debug_*.py         # Debug scripts for trade verification
├── data/              # Input trade logs, ADR reference data, SL overrides
├── docs/              # Bug analysis, implementation plans
└── results/           # Generated output (gitignored)
```

## License

Private - All rights reserved
