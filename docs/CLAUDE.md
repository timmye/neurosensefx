# docs/

Architecture, design, and implementation documentation.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `admin-panel-scope.md` | System admin panel scope document | Planning admin panel features, reviewing scope requirements |
| `centralized-data-function-post-implementation-review.md` | Post-implementation review of centralized data function | Reviewing centralized data function outcomes, auditing implementation |
| `currency_basket_indicator.txt` | Currency basket indicator reference material | Understanding basket currency composition |
| `dev-lifecycle-modernization.md` | Dev service recovery endpoint design | Implementing backend reinit, debugging service restart behavior |
| `health-endpoint.md` | `/health` + `/admin/reconnect` practical usage: how to invoke, read the feed state, monitor/alert, and force reconnects | Operating/monitoring the backend, debugging feed recovery, wiring Docker healthchecks |
| `hosting.md` | Hosting and deployment guide | Setting up hosting infrastructure, evaluating deployment options |
| `vps-deployment-pathway.md` | VPS deployment steps and configuration | Planning VPS deployment, infrastructure provisioning |
| `tunnel-optimization.md` | Tunnel (zrok) optimization notes | Debugging connection tunnel performance, optimizing remote access |
| `weekly-market-profile-implementation-plan.md` | Weekly implementation roadmap | Planning market profile feature work |
| `workspace-editor.html` | Standalone workspace layout editor tool | Debugging workspace editor, testing editor UI standalone |
| `chart-data-pipeline-spec.md` | Chart data pipeline specification | Understanding chart data flow, implementing pipeline changes |
| `data-pipeline-audit.md` | Data pipeline architecture audit | Reviewing data flow, identifying pipeline issues |
| `data-volume-pipeline.md` | Data volume processing pipeline documentation | Understanding volume data processing, debugging volume pipeline |
| `dual-source-architecture.md` | Dual data source architecture design | Understanding multi-source data integration |
| `key-handling-audit.md` | Keyboard handler audit and centralization plan | Understanding key handling architecture, adding keyboard shortcuts |
| `local-dev-setup.md` | Step-by-step local dev setup with auth, PostgreSQL, Redis | Setting up development environment, onboarding |
| `mobile-support.md` | Mobile device support and responsive design notes | Implementing mobile features, debugging responsive layouts |
| `timeframe-switching-regression.md` | Regression analysis of timeframe switching bug | Debugging timeframe switch issues, understanding regression history |
| `tradingview-subscription-latency-analysis.md` | TradingView subscription latency analysis | Debugging subscription latency, tuning timing thresholds |
| `tradingview-symbol-expressions.md` | TradingView symbol expression reference | Understanding symbol format, adding new symbol types |
| `backend-architecture-assessment-2026-06.md` | Backend architecture assessment (`services/tick-backend/`, 25 files, ~4,500 LOC, dual cTrader + TradingView sources) | Starting backend structural work, understanding backend data flow |
| `backend-assessment-plain-english-2026-06.md` | Non-technical backend summary (companion to backend-architecture-assessment) | Explaining backend state to non-developers, high-level overview |
| `frontend-architecture-assessment-2026-06.md` | Original architecture assessment — completed. All P0/P1 resolved. Historical record. | Understanding why decisions were made, verifying past findings |
| `frontend-architecture-reassessment-2026-06.md` | **Current frontend architecture state, active targets, and deferred items.** | **Starting any frontend structural work.** Read this first. |
| `frontend-audit-2026-06-23.md` | Dead code, inefficiencies & UX debt inventory (follow-up to background removal). Verified findings + debunked agent claims. | Planning frontend cleanup; deciding which dead code/UX debt to tackle |
| `architecture-assessment-non-frontend-2026-06.md` | Backend, backtester, and infra assessment. Categorized: actionable now vs deferred (remote deployment) vs informational (backtester). | **Starting any backend structural work.** Read for current known issues. |
| `orchestrator-unification-reassessment.md` | Orchestrator compute/render split — done, 51 unit tests added | Understanding orchestrator compute functions, testing layout/scaling logic |
| `price-scale-unification-report.md` | Price-scale unification report — DONE (2026-06-03), implemented and verified | Understanding price-scale handling, verifying unification outcomes |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `adr/` | Architecture Decision Records | Reviewing architectural decision records |
| `analysis/` | Codebase analysis and metrics | Reading codebase analysis, assessing technical debt |
| `crystal-clarity/` | Crystal Clarity architectural documentation | Accessing crystal-clarity design documentation |
| `design/` | Feature solution designs | Reviewing solution designs before implementation |
| `fx_basket/` | FX Basket design documentation and methodology | Understanding FX basket design alternatives and implementation |
| `chart/` | Chart x-axis design, KLineChart knowledge base, time window logic, drawing persistence scope | Understanding chart architecture, modifying x-axis behavior |
| `bugs/` | Bug investigation reports and root cause analyses | Debugging recurring issues, understanding known bugs |
| `debug/` | Debug investigation notes and root cause analyses | Reading past debug investigations, understanding known issues |
| `klinecharts/` | KLineChart API reference, upstream PR strategy, custom feature inventory | Debugging KLineChart integration, assessing upstream contributions |
| `architecture/` | Architecture review and redesign documents (feed recovery & supervision) | Reviewing architecture redesigns, understanding supervision tier design |
| `refactor/` | Refactoring and dead-code analysis reports | Planning cleanup, identifying dead code before removal |
