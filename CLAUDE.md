# NeuroSense FX

## Project Context

- **Deployment model**: Local-first development. Remote VPS deployment is a future option but not a current priority — incomplete Docker/infra configs for remote hosting are expected and not urgent.
- **Backend**: Open to incremental improvements for robustness and reliability. Not looking for big rewrites — small targeted fixes — BUT core reliability/connection fixes may warrant larger changes when they solve problems at the root (e.g. the feed-supervision tier).
- **Feed reliability**: Backend reliability is a first-class concern. The cTrader feed lifecycle is owned by a supervision tier (`services/tick-backend/supervision/`, see `FeedSupervisor.js`) that detects stale/offline conditions and recovers feeds automatically; backend exposes `GET /health` and dev-only `POST /admin/reconnect` for operations. TradingView runs standalone (self-recovers, not supervised).
- **Backtester** (`backtester/`): Side project, not core or critical. May or may not stay in the repo. Findings are valid but should not drive priority work.
- **Focus area**: Frontend + backend service reliability are the primary concerns. Infrastructure hardening is deferred until remote deployment becomes a priority.

## Structured Development Workflow

This project uses [Solatis claude-config skills](https://github.com/solatis/claude-config/tree/feat/installer) for high-quality LLM-assisted development.

### Core Workflow: explore → plan → execute

1. **Explore**: Use `codebase-analysis` for unfamiliar codebases, security reviews, performance analysis
2. **Think**: Use `deepthink` for questions where answer structure is unknown (taxonomy, trade-offs, definitions)
3. **Plan**: "Use your planner skill to write a plan to plans/my-feature.md"
4. **Clear**: `/clear` - start fresh with clean context
5. **Execute**: "Use your planner skill to execute plans/my-feature.md"

### When to Use Each Skill

| Skill | When to invoke |
|-------|----------------|
| `deepthink` | Questions where answer structure is unknown: taxonomy design, conceptual analysis, "what makes a good X?", trade-off exploration, definitional questions. NOT for problems with verifiable answers or known problem types. |
| `problem-analysis` | Root cause identification - "X is broken, figure out why". Does NOT propose solutions. Use for bugs, component failures, unexpected behavior. |
| `codebase-analysis` | Unfamiliar codebase, security review, performance analysis, architecture evaluation. Forces systematic investigation with file:line evidence. |
| `decision-critic` | Stress-test a decision where you want CRITICISM not agreement. Architectural choices, technology selection, tradeoffs with long-term consequences. |
| `planner` | Write implementation plans with quality gates OR execute approved plans. Has specific phases: Context & Scope → Decision & Architecture → Refinement → Final Verification → QR (completeness, code, docs) → Technical Writer. |
| `refactor` | After LLM-generated features work but code feels messy. Catches what LLM misses: duplication across files, god functions, inconsistent validation. Outputs prioritized work items (does NOT refactor code). |
| `prompt-engineer` | Sub-agent definition misbehaving, Python script prompt underperforming, multi-prompt workflow inconsistent. Uses 100+ research papers for pattern attribution. |
| `doc-sync` | Bootstrapping workflow on existing repo, after major refactors/restructuring, periodic audits for documentation drift. Maintains CLAUDE.md/README.md hierarchy. |

### Key Workflow Principles

- **Context hygiene**: Each task gets precisely the information it needs -- no more
- **Planning before execution**: Forces ambiguities to surface when cheap to fix
- **Review cycles**: Quality gates at every stage (QR-Completeness, QR-Code, QR-Docs, Technical Writer)
- **Cost-effective delegation**: Smaller models for straightforward tasks, escalate only when needed

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `README.md` | Project overview, quick start, technology stack | Onboarding to project |
| `.env.example` | Environment variable template | Setting up development environment |
| `.gitignore` | Git ignore rules | Adding new file types, debugging tracked files |
| `package.json` | Dependencies and npm scripts | Adding packages, running builds |
| `run.sh` | Service management script (start, stop, dev, status, logs, snapshots) | Managing services, starting dev/prod environments |
| `playwright.config.cjs` | Playwright E2E test configuration | Setting up E2E tests, debugging test runner |
| `vitest.config.js` | Vitest unit test configuration | Running unit tests, configuring test runner |
| `vite.config.js` | Vite build configuration with Svelte plugin | Modifying build settings, adding Vite plugins |
| `index.html` | Vite SPA entry point | Modifying HTML shell, adding global scripts |
| `Dockerfile` | Production Docker build | Building production Docker image |
| `Dockerfile.frontend` | Frontend-specific Dockerfile | Building frontend container |
| `Dockerfile.performance` | Performance monitoring Dockerfile | Building performance monitoring stack |
| `docker-compose.yml` | Production compose config | Running full stack locally, configuring service orchestration |
| `docker-compose.dev.yml` | Dev compose override | Starting dev environment, overriding production compose settings |
| `docker-compose.perf.yml` | Performance compose override | Running performance benchmarks, monitoring stack |
| `docker-healthcheck.sh` | Docker health check script | Debugging container health checks |
| `setup_project.sh` | Project setup script | Initial project setup, onboarding to new machine |
| `test-candles-v2.mjs` | Candle data format test script | Debugging candle data pipelines |
| `test-math-expression-candles.cjs` | Math expression candle parser test | Testing symbol math expression parsing |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `backtester/` | SL/TP walk-forward backtester (Python: analyzer, debug scripts, input data, docs) | Running strategy analysis, debugging simulation results |
| `data/` | Runtime data files (historical analysis JSON) | Working with historical basket data |
| `docker/` | Container configurations (nginx, postgres, performance monitoring) | Deploying, containerizing services |
| `docs/` | Architecture and design documentation | Understanding system design decisions |
| `libs/` | In-repo vendored libraries (`cTrader-Layer` fork, consumed via a `file:` dep — not an npm/external dependency) | Integrating with cTrader, modifying the cTrader layer |
| `plans/` | Implementation plans for features and refactors | Executing planned work, reviewing feature scope |
| `scripts/` | Utility and setup scripts | Setting up development environment, running diagnostics |
| `services/` | Backend WebSocket and API services (tick-backend: feeds, supervision tier, HTTP API, auth, persistence) | Working on backend, data streaming, feed reliability |
| `src/` | Frontend Svelte application | Developing UI, adding visualizations |
| `tests/` | Additional E2E test suites (connection stress, reconnect reliability, subscription queue) | Running E2E tests |
| `.devcontainer/` | VS Code Dev Container configuration | Setting up Codespace or containerized dev environment |
| `.vscode/` | VS Code workspace settings and AI rules | Configuring editor behavior |

## Development

Requires PostgreSQL 15+ and Redis 7+ running (see `docs/local-dev-setup.md`).

```bash
./run.sh dev              # Start development with HMR (backend :8080, frontend :5174)
./run.sh start            # Start services (production mode; backend :8081, frontend :4173)
./run.sh stop             # Stop all services
./run.sh status           # Check service health
```

Backend (dev) ports: WebSocket/HTTP on `8080`, Vite frontend on `5174`. Production: backend `8081`, preview `4173`.

### Backend operations (dev)

The backend exposes a small recovery surface (see `services/tick-backend/httpServer.js`):

- `GET http://localhost:8080/health` — no-auth health check; returns feed state from the supervisor (`observableState()`).
- `POST http://localhost:8080/admin/reconnect` — dev-only manual reconnect; body `{ "feed": "ctrader" | "tradingview" | "all" }`. Returns 403 in production.

## Test

E2E tests require a running backend with PostgreSQL and Redis. Pre-auth test suites need a login step before chart interactions.

```bash
npm test                 # Run all E2E tests (requires running backend + PG + Redis)
npm run test:unit        # Run Vitest unit tests
npx playwright test --ui    # Run tests with Playwright UI
```
