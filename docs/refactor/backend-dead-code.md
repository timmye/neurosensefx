# Backend Dead Code & Legacy Debt Report

- **Service:** `services/tick-backend/`
- **Date:** 2026-06-23
- **Scope:** 25 source files, ~5,000 LOC (excl. tests/node_modules)
- **Method:** Manual categorization. (The project's `refactor` skill script requires Python 3.10+; the environment has Python 3.9, so the script could not run. All findings were verified with direct grep/file evidence. Symbol usage was checked across **both backend source and `__tests__/`** before removal — the unit suite is the final gate.)

The backend is clean on orphaned modules and commented-out code — the real debt is dead dependencies, broken npm scripts, stale docs, and inconsistent logging.

## Tier 1 — Safe, high-confidence deletions

| What | Evidence | Action |
| ---- | -------- | ------ |
| **3 npm scripts point to non-existent files** | `package.json` scripts `test-subscription`→`test/test-subscription.js`, `live-display`→`bin/live-display.js`, `subscribe`→`bin/subscribe.js`. No `bin/` or `test/` directory exists. | Delete these 3 script entries. |
| **`CTraderSymbolLoader.hasSymbol()`** | `CTraderSymbolLoader.js:94` — 0 call sites in backend source or tests; `getSymbolId()` already returns `undefined` for unknown symbols. | Remove method + its JSDoc. |
| **2 unused exports** | `includeField` (`utils/MessageBuilder.js` export block) imported nowhere; `app` (`httpServer.js` export — `server.js` imports only `listen, server, addCandleApiRoutes`). Both are used internally, so drop them from the export blocks only. | Remove from module.exports; keep the definitions. |
| **`protobufjs` dependency** | Declared in backend `package.json`; never `require()`d by backend source (only a code comment references it at `CTraderSession.js:596`). The cTrader layer ships its OWN `protobufjs@5.0.1`; the backend's top-level copy is an unused version-7 duplicate. | Remove from dependencies. |
| **`@rollup/rollup-linux-x64-gnu` devDependency** | `npm ls rollup` is empty — nothing in the backend uses rollup. Orphaned platform binary. | Remove from devDependencies. |
| **`events` dependency** | `require('events')` is used 6× but resolves to the Node.js built-in (core modules take precedence over userland packages on Node 18+). The npm `events@3.3.0` polyfill is dead weight. | Remove from dependencies. |
| **`test-results/.last-run.json` tracked in git** | `services/tick-backend/test-results/.last-run.json` is committed; it is a Playwright runtime artifact. The root `.gitignore` line 191 `/test-results/` is anchored to repo root so it does not match the nested copy. | Untrack the file and un-anchor the `.gitignore` pattern. |

### Investigated but kept (test-consumed — NOT dead)

These were initially flagged as "0 call sites in backend source", but the unit test suite consumes them, so they were retained:

- **`TwapService.getTwap()`** (`TwapService.js`) — used by `__tests__/twapNormalization.test.js` as the accessor to assert TWAP state.
- **`BUFFER_THRESHOLD` + `SLOW_DISCONNECT_CODE`** (`utils/SafeSender.js` exports) — used by `__tests__/backend-reliability.test.js` to deterministically trigger the backpressure disconnect path and assert disconnect code 4002.

Removing either broke 4 unit tests on the first pass; both were restored before commit.

## Tier 2 — Documentation drift (actively misleading)

9. **README architecture diagram is wildly wrong.** `services/tick-backend/README.md` claims `WebSocketServer (206 lines)`, `RequestCoordinator (145)`, `StatusBroadcaster (132)`, `SubscriptionManager (137)` and the "Crystal Clarity" rule "All files <120 lines, all functions <15 lines." Actual sizes: WebSocketServer 700, CTraderSession 603, MarketProfileService 544, RequestCoordinator 395, TradingViewSession 404.
10. **`services/tick-backend/CLAUDE.md` references a deleted file** — lists `test-timeframe.js`, which does not exist.
11. **All backend docs predate the major rework.** `docs/*.md` and `specs/*.txt` are dated 2026-03-20/28; the backend then received heavy churn (2026-06-04 "18 items, 72 tests" reliability refactor; 2026-06-13 prevDay/symbol normalization; 2026-06-23 symbol canonicalization). TwapService, MarketProfileService, HealthMonitor, SafeSender, and RequestCoordinator all changed after these docs were written.
12. **Ad-hoc spec notes with spaces in filenames.** `specs/back end arch after fixing ctrader layer.txt`, `specs/ctrader lib decision.txt` — old decision scratchpads.

## Tier 3 — Structural / design debt (flag, don't prescribe)

13. **No logging layer — 123 raw `console.*` calls, inconsistent gating.** No `Logger` module exists. Only `MarketProfileService.js:4` uses an env guard (`DEBUG_PROFILE === '1'`); the other heavy loggers — WebSocketServer (18), server.js (17), TradingViewSession (13), CTraderSession (8), RequestCoordinator (7), persistenceRoutes (7) — log unconditionally with no levels. A thin logger (levels + env gating) would cut prod noise and standardize `[Module]` prefixes.
14. **Parallel cTrader / TradingView stacks** — CTraderSession↔TradingViewSession, CTraderEventHandler↔TradingViewCandleHandler, SubscriptionManager↔TradingViewSubscriptionManager. Largely inherent (two protocols), but duplicated reconnect/error/backoff logic is where behavior tends to silently diverge.

## What's clean (do not touch)

- Zero `TODO`/`FIXME`/`HACK`/`XXX` markers anywhere in backend source.
- No commented-out executable code blocks (the 297 `//` lines are legitimate prose/explanatory comments).
- No orphaned top-level modules — all 25 source files are reachable from `server.js`.
- Consistent module pattern; good separation of concerns; unit tests exist for the normalization work.

## Suggested order

1. Tier 1 first — all items are low-risk mechanical deletions, one commit.
2. Tier 2 #9–#10 — fix README line counts + drop the `test-timeframe.js` reference; flag the Mar-20 docs for a refresh.
3. Tier 3 #13 — a logger is the only item with real ongoing ROI; treat as its own task.

## Status

Tier 1 executed on branch `chore/backend-dead-code-cleanup` and verified with the backend unit suite (83 passing). Removed: the 3 broken npm scripts, `CTraderSymbolLoader.hasSymbol`, the `includeField` and `app` exports, and the `events` / `protobufjs` / `@rollup/rollup-linux-x64-gnu` dependencies; `test-results/.last-run.json` untracked and the `.gitignore` `test-results/` pattern un-anchored. An initial over-aggressive pass also removed `getTwap` and the SafeSender constants, which broke 4 unit tests — those were restored (see "Investigated but kept" above).

Tier 2 #9–#10 done in a follow-up commit: removed the rotting per-file line-count annotations and the false "Line Limits (<120 lines / <15 lines)" rule from `services/tick-backend/README.md` (replaced with role labels), and dropped the `test-timeframe.js` row from `services/tick-backend/CLAUDE.md`.

Tier 3 #13 — logging layer, **complete**. Added a dependency-free `utils/Logger.js` (`createLogger(module)` → `{debug,info,warn,error}`, threshold from `config.logLevel` / env `LOG_LEVEL`, delegates to `console`, ANSI color in non-prod) and migrated **every** backend source file off raw `console.*` — all 18 files with log calls, zero `console.*` remaining outside `Logger.js`. `MarketProfileService.js` retired its `DEBUG_PROFILE` gate (use `LOG_LEVEL=debug`). Per-client connect/disconnect + heartbeat summary + reconnect scheduling now log at `debug`; server/session startup at `info`; errors/warns unchanged. Missing/inconsistent prefixes (e.g. `[COALESCE]`, `[MarketProfile]`, several unprefixed lines) fixed via the `createLogger(module)` prefix. 83 unit tests still pass. Only Tier 2 #11–#12 (stale Mar-20 docs) remain open.

> Note: `__tests__/drawingVersioning.test.js` fails at collection time with `require('vitest')` in a CommonJS module — this is pre-existing (a skipped-by-default integration test) and unrelated to this cleanup.
