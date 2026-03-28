# docs/

Architecture, design decisions, and analysis documentation accumulated during development.

## Connection & Backend

| File | What | When to read |
| ---- | ---- | ------------ |
| `backend-connection-management-assessment.md` | Connection management architecture assessment | Evaluating connection patterns |
| `backend-connection-refactor-plan.md` | Connection refactoring implementation plan | Refactoring connection layer |
| `backend-connection-interim-patches.md` | Interim patches before full refactor | Applying temporary fixes |
| `backend-error-handling-analysis.md` | Error handling patterns and gaps | Improving error resilience |
| `connection-handling-analysis.md` | Connection lifecycle analysis | Debugging connection issues |
| `connection-data-management-analysis.md` | Data management during connection events | Handling data across reconnections |
| `ADR-websocket-symbol-error-fix.md` | WebSocket symbol error fix documentation | Debugging symbol subscription errors |
| `ctrader-pipPosition-integration.md` | cTrader pipPosition field integration | Working with pip position values |

## Data Pipeline

| File | What | When to read |
| ---- | ---- | ------------ |
| `data-pipeline-architecture.md` | End-to-end data pipeline design | Understanding data flow from source to display |
| `data-pipeline-centralized-function-assessment.md` | Centralized data function evaluation | Evaluating data centralization approach |
| `data-pipeline-reactivity-assessment.md` | Svelte reactivity in data pipeline | Debugging reactive data updates |
| `centralized-data-function-post-implementation-review.md` | Post-implementation review of centralized data function | Assessing centralization results |

## FX Basket

| File | What | When to read |
| ---- | ---- | ------------ |
| `fx-basket-scope.md` | FX Basket feature scope definition | Scoping basket features |
| `fx-basket-implementation-plan.md` | Implementation plan for FX Basket | Planning basket development |
| `fx-basket-adr-proposal.md` | ADR derivation methodology proposal | Understanding ADR zone calculations |
| `fx-basket-adr-derivation-analysis.md` | ADR derivation mathematical analysis | Verifying ADR formulas |
| `fx-basket-adr-derivation-summary.md` | ADR derivation summary | Quick ADR methodology overview |
| `fx-basket-adr-display-proposal.md` | ADR display visual proposal | Designing ADR zone display |
| `fx-basket-all-28-pairs-fix.md` | Fix for all 28 currency pairs coverage | Debugging missing pairs |
| `fx-basket-data-path-timing.md` | Data flow timing analysis for basket | Debugging basket update delays |
| `fx-basket-historical-results.md` | Historical backtest results | Evaluating basket performance |
| `fx-basket-stall-diagnosis.md` | Stall diagnosis and resolution | Debugging frozen basket display |
| `fx-basket-zone-colors.md` | Zone color scheme definitions | Customizing basket zone colors |

## Market Profile

| File | What | When to read |
| ---- | ---- | ------------ |
| `market-profile-solution-design.md` | Comprehensive solution architecture | Understanding Market Profile system design |
| `market-profile-solution-summary.md` | Condensed solution overview | Quick design reference |
| `market-profile-architectural-analysis.md` | Architecture analysis and evaluation | Reviewing component structure |
| `market-profile-architectural-forensic-review.md` | Deep forensic review of architecture issues | Debugging systemic issues |
| `market-profile-optimization-assessment.md` | Performance optimization analysis | Tuning Market Profile rendering |
| `market-profile-implementation-summary.md` | Implementation walkthrough | Understanding current implementation |
| `market-profile-reactivity-bug-analysis.md` | Reactivity bug root cause analysis | Debugging reactive update failures |
| `market-profile-reactivity-fix-applied.md` | Applied fix documentation | Verifying reactivity fix |
| `market-profile-refactor-assessment.md` | Refactoring assessment and recommendations | Planning Market Profile refactoring |
| `market-profile-stateless-solution.md` | Stateless rendering approach | Understanding stateless design |
| `market-profile-stateless-final-report.md` | Final stateless implementation report | Reviewing stateless results |
| `market-profile-data-strategy-analysis.md` | Data management strategy | Choosing data handling approach |
| `market-profile-detail-loss-analysis.md` | Detail loss during rendering analysis | Debugging visual fidelity |
| `market-profile-tick-data-performance-analysis.md` | Tick data throughput analysis | Optimizing tick processing |
| `market-profile-timebase-analysis.md` | Time-based bucketing analysis | Debugging time bucket calculations |
| `market-profile-accuracy-failure-patterns.md` | Accuracy failure pattern catalog | Diagnosing profile accuracy issues |
| `market-profile-troubleshooting-log.md` | Historical troubleshooting log | Resolving recurring issues |
| `market-profile-upstream-prevention-solution.md` | Upstream data validation solution | Preventing bad data propagation |
| `weekly-market-profile-implementation-plan.md` | Weekly implementation roadmap | Planning Market Profile work |

## Sigma Markers

| File | What | When to read |
| ---- | ---- | ------------ |
| `sigma-calculation-method.md` | Standard deviation calculation methodology | Understanding sigma computation |
| `sigma-magnitudes-explained.md` | Sigma magnitude interpretation | Explaining sigma scale to stakeholders |
| `sigma-magnitudes-plain-language.md` | Non-technical sigma explanation | Documentation reference |
| `sigma-markers-scope.md` | Sigma markers feature scope | Scoping sigma marker features |
| `sigma-markers-scope-minimal.md` | Minimal sigma markers scope | Planning MVP sigma implementation |
| `sigma-markers-scope-simplest.md` | Simplest sigma markers approach | Quick sigma implementation |

## TWAP

| File | What | When to read |
| ---- | ---- | ------------ |
| `twap-implementation-scope.md` | TWAP feature scope and design | Planning TWAP implementation |
| `twap-simplified.md` | Simplified TWAP approach | Quick TWAP reference |

## Workspace & Display

| File | What | When to read |
| ---- | ---- | ------------ |
| `workspace-layout-helper-proposal.md` | Workspace layout utility proposal | Improving workspace layout |
| `diagnosis-workspace-import-symbol-rendering.md` | Import/rendering bug diagnosis | Debugging workspace import issues |
| `display-status-enhancement-proposal.md` | Display status indicator proposal | Enhancing status display |
| `scope-fx-basket-display.md` | FX Basket display scope | Scoping basket display features |
| `scope-tradingview-feed.md` | TradingView data feed scope | Scoping TradingView integration |
| `multi-select-plan.md` | Multi-symbol selection design plan | Implementing multi-select |

## Verification Reports

| File | What | When to read |
| ---- | ---- | ------------ |
| `P0-VERIFICATION-REPORT.md` | P0 priority feature verification results | Validating core features |
| `P1-VERIFICATION-REPORT.md` | P1 priority feature verification results | Validating extended features |

## Deployment & Infrastructure

| File | What | When to read |
| ---- | ---- | ------------ |
| `hosting.md` | Hosting and deployment guide | Setting up production hosting |
| `vps-deployment-pathway.md` | VPS deployment steps and configuration | Deploying to VPS |
| `crystal-clarity-refactoring-plan.md` | Crystal Clarity migration plan | Planning frontend migration |

## Other

| File | What | When to read |
| ---- | ---- | ------------ |
| `currency_basket_indicator.txt` | Currency basket indicator reference material | Understanding basket methodology |
| `adr-standard-deviation-conversion.md` | ADR to standard deviation conversion | Converting between ADR and sigma |
| `symbol-stall-analysis.md` | Symbol data stall analysis | Debugging symbol data freezes |
| `symbol-stall-root-cause.md` | Symbol stall root cause | Fixing symbol data stalls |
| `solis-skills-fix-failure-analysis.md` | Skills integration failure analysis | Debugging claude-config skills issues |
| `workspace-editor.html` | Standalone workspace layout editor tool | Designing workspace layouts |

## Subdirectories

| Directory | What | When to read |
| --------- | ---- | ------------ |
| `crystal-clarity/` | Crystal Clarity architectural documentation | Understanding design philosophy, implementation principles |
| `analysis/` | Codebase analysis and metrics | Reviewing complexity reduction results |
| `adr/` | Architecture Decision Records | Understanding architectural decisions and their rationale |
| `design/` | Feature solution designs | Understanding feature design before implementation |
| `fx_basket/` | FX Basket design documentation and methodology | Understanding basket construction, weighting, and alternative designs |
