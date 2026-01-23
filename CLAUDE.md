# NeuroSense FX

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `README.md` | Project overview, quick start, technology stack | Onboarding to project |
| `package.json` | Dependencies and npm scripts | Adding packages, running builds |
| `.env.example` | Environment variable template | Setting up development environment |
| `run.sh` | Service management script (start, stop, dev, status, logs, snapshots) | Managing services, starting dev/prod environments |
| `playwright.config.cjs` | Playwright E2E test configuration | Setting up E2E tests, debugging test runner |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `src/` | Frontend Svelte application | Developing UI, adding visualizations |
| `services/` | Backend WebSocket and API services | Working on backend, data streaming |
| `libs/` | External library integrations | Integrating with cTrader API |
| `docker/` | Container configurations | Deploying, containerizing services |
| `scripts/` | Utility and setup scripts | Setting up development environment |
| `docs/` | Architecture and design documentation | Understanding system design decisions |

## Development

```bash
./run.sh dev              # Start development with HMR
./run.sh start            # Start services (production mode)
./run.sh stop             # Stop all services
./run.sh status           # Check service health
```

## Test

```bash
npm test                 # Run all E2E tests (requires running backend)
npx playwright test --ui    # Run tests with Playwright UI
```
