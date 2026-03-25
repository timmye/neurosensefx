# NeuroSense FX

## Structured Development Workflow

This project uses [Solatis claude-config skills](https://github.com/solatis/claude-config/tree/feat/installer) for high-quality LLM-assisted development.

### Core Workflow: explore → plan → execute

1. **Explore**: Use `codebase-analysis` for large codebase exploration
2. **Think**: Use `deepthink` for analytical questions (trade-offs, architecture, "why is this happening?")
3. **Plan**: "Use your planner skill to write a plan to plans/my-feature.md"
4. **Clear**: `/clear` - start fresh with clean context
5. **Execute**: "Use your planner skill to execute plans/my-feature.md"

### When to Use Each Skill

| Skill | When to invoke |
|-------|----------------|
| `deepthink` | Analytical questions, trade-offs, architecture, "why does this keep happening?" |
| `problem-analysis` | Root cause investigation - "X is broken, figure out why" |
| `codebase-analysis` | Large codebase exploration before proposing changes |
| `decision-critic` | Stress-test a specific decision before committing |
| `planner` | Write implementation plans OR execute approved plans |
| `refactor` | After features work but code feels messy |
| `prompt-engineer` | Optimizing prompts that aren't performing well |
| `doc-sync` | Synchronize documentation across the repository |

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
