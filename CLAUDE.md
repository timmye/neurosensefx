# NeuroSense FX

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
| `skills/` | Solatis claude-config skills for structured LLM workflows | Using development skills |

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
