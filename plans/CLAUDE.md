# plans/

Implementation plans for features, refactors, and operational tasks.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `frontend-debt-remediation.md` | Frontend debt remediation plan (57 findings, 6 milestones) | Understanding frontend cleanup scope, tracking debt reduction |
| `frontend-cohesion-design-system.md` | Frontend cohesion & design-system implementation plan (tokens + `<DisplayFrame>`/`<IconButton>`/`<AddMenu>`; 8 tasks, staged). Implemented 2026-07-01 | Reviewing the design-system work, extending tokens/display primitives |
| `canvas-theme-system.md` | Cohesive shell-canvas theme system plan — `src/lib/canvasTheme.js` resolver centralizing all shell-canvas colors (mirrors chart-canvas idiom, reads `themeStore`). Implemented 2026-07-01 | Theming shell-canvas renderers, debugging light-theme canvas bugs |
| `frontend-debt-remediation-plan.json` | Machine-readable plan with findings, milestones, and status | Tracking debt remediation progress programmatically |
| `centralized-data-function-implementation.md` | Centralized data function implementation plan | Understanding market data centralization approach |
| `centralized-data-function-implementation-plan.json` | Machine-readable plan for data function centralization | Tracking centralization progress |
| `market-profile-tradingview-implementation.md` | Market Profile TradingView integration plan | Planning TradingView-based Market Profile implementation |
| `backend-reinit.md` | Backend reinitialization feature plan | Implementing Alt+R backend reinit |
| `vps-deployment.md` | VPS deployment plan and checklist | Deploying to production VPS |
| `housekeeping-cleanup.md` | Repo housekeeping cleanup plan | Reviewing repo cleanup scope, tracking file removals |
| `repo-cleanup.md` | Repo cleanup plan | Understanding repo cleanup plan |
| `repo-cleanup-plan.json` | Machine-readable repo cleanup plan | Tracking repo cleanup progress programmatically |
| `charting-system.md` | KLineChart + cTrader API charting system plan (library selection, data pipeline, drawing tools) | Planning candlestick charting with drawing tools and persistence |
| `calendar-xaxis-plan.json` | Machine-readable plan for custom calendar x-axis — decisions, constraints, risks, invisible knowledge | Understanding x-axis design decisions and implementation rationale |
| `x-axis-transition-matrix.md` | Current x-axis implementation plan — window-keyed transition matrix replacing dynamic span classification | Understanding current x-axis algorithm, modifying tick behavior |
| `headlines-widget.md` | FinancialJuice news widget implementation (floating panel, H key, workspace persistence) | Understanding headlines widget architecture, FinancialJuice integration |
| `custom-x-axis.md` | Executed plan for anchor+fill x-axis (retired — see x-axis-transition-matrix.md) | Historical reference only |
| `chart-dark-mode.md` | Dark mode theme implementation plan | Understanding dark mode design, modifying theme system |
| `chart-data-fix.md` | Chart data pipeline fix plan | Debugging data flow issues |
| `chart-drawings-misplacement-diagnosis.md` | Drawing misplacement root cause and fix plan | Debugging drawing position issues |
| `chart-drawing-system-fix.md` | Drawing system fix plan | Understanding drawing system corrections |
| `chart-overlay-design.md` | Chart overlay architecture design | Adding overlay types, understanding overlay system |
| `chart-timezone-display.md` | Timezone display implementation plan | Modifying timezone labels |
| `cross-timeframe-drawing-visibility.md` | Cross-timeframe drawing visibility plan | Understanding pinned drawing display |
| `daily-reset-at-midnight-utc.md` | Daily reset at midnight UTC plan | Understanding daily data reset behavior |
| `data-pipeline-fixes.md` | Data pipeline fix plan | Debugging data pipeline issues |
| `drawing-persistence-100-reliable.md` | Drawing persistence 100% reliability fix plan (implemented, reviewed) | Reviewing drawing persistence implementation history |
| `drawing-persistence-reliability.md` | Drawing persistence reliability analysis: 6 sync boundary bugs (IndexedDB to PostgreSQL) and migration fix | Debugging drawing sync issues, understanding persistence architecture |
| `drawing-architecture-redesign.md` | Drawing architecture redesign implementation plan — Complete (2026-06-01, 125 tests) | Understanding drawing system architecture, reviewing redesign outcomes |
| `marketDataStore-decomposition.md` | marketDataStore.js decomposition plan — DONE (361→205 LOC, 79 new tests) | Understanding store decomposition approach, verifying refactor results |
| `workspace-decomposition.md` | workspace.js god-store (657 LOC) decomposition plan into focused modules | Planning store splits, understanding decomposition strategy |
| `orchestrator-compute-render-split.md` | Orchestrator compute/render split plan (incremental per-domain) | Planning orchestrator refactor, reviewing compute/render separation |
| `event-markers-design.md` | Event markers feature design (vertical line markers for custom events) | Planning event marker implementation |
| `price-flicker-fix.md` | Current price line flicker fix: 4 causes identified across 3 audit rounds | Debugging price display flicker |
| `price-flicker-reconcile.md` | Single-writer reconciliation architecture to eliminate developing bar flicker | Understanding tick-to-bar reconciliation, preventing flicker regression |
| `rolling-time-window-toggle.md` | Developing/rolling time window toggle vs calendar-aligned windows | Implementing rolling window mode |
| `persistence-phase1.md` | Persistence phase 1 implementation plan | Understanding initial persistence design |
| `phase4-auth-and-persistence.md` | Phase 4 auth and persistence plan | Understanding auth+persistence integration |
| `refactor-evaluation-report.md` | Refactor evaluation report | Assessing refactor quality |
| `volatility-background-design.md` | Volatility background display design | Implementing volatility visualization |
| `backend-reliability-fixes.md` | Backend reliability fixes (3 phases, 18 items, from June 2026 assessment) | Executing backend reliability, cleanup, and hardening fixes |
| `feed-recovery-supervision.md` | Feed recovery & supervision plan (path A→B, EXECUTED 2026-06-24): Phase A stop-the-bleeding patches + Phase B supervision tier resolving defects #2/#3/#4/#5 and the WSL2 TLS fallback trap; offline-testable recovery | Reviewing feed recovery/supervision implementation, understanding the supervision tier |
| `feed-loop-stabilization.md` | Feed loop stabilization plan (2026-06-24): round-2 RUNTIME cTrader reconnect loop (Loop-A–H) the offline suite can't see. Diagnostics first (timestamps+errorCode), then structural root — decouple `restoreSubscriptions()` from the `connect()` handshake + persist `symbolLoader` — then throttled/error-aware restore, then data-gated heartbeat re-evaluation. Supervision tier stays; library read-only | Stabilizing the live cTrader reconnect loop, understanding runtime defects beyond the supervision tier (Phases 1–4 implemented 2026-06-24; Phase 5 heartbeat data-gated/pending) |
| `ctrader-layer-hardening.md` | cTrader layer hardening plan (2026-06-26, PROPOSED): now that the layer is an internal fork, move reliability behavior from the supervision tier INTO the layer (open() rejects, leak-free raw heartbeat, close() rejects pending, layer per-RPC TTL, + L5–L10 hardening) and thin the adapter to a pass-through. Retires the "library read-only" guardrail; supervision tier core untouched. All assumptions verified by three parallel investigation agents; Tier 3 backend cleanup gated on the layer fixes | Planning in-layer reliability fixes now that cTrader-Layer is ours; understanding why the adapter's _pending/TTL can only be deleted after the layer gains a TTL too |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `charts/` | Chart-specific implementation plans | Understanding chart feature plans |
