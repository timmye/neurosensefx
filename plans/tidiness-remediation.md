# Tidiness Remediation — Status Tracker

> Living document. Last updated 2026-06-25. Branch: `feed-supervision` (commits local, **not pushed**).
> Tracks the **re-verified** tidiness audit + the cTrader credential exposure.
> The credential cutover is **blocked on cTrader app #3 registration** (approval may take hours/days).

## Legend
`DONE` · `PENDING-CREDENTIAL` (blocked on app #3) · `DECISION-NEEDED` (your call) · `NO-ACTION` (intentional/leave) · `INVALID` (original audit wrong)

---

## Credential exposure (HIGH) — full runbook: `plans/credential-exposure-remediation.md`

| Phase | Status |
| --- | --- |
| 4 — untrack `.idx/dev.nix` + leaked configs + junk; broaden `.gitignore` | ✅ DONE (commit `86dc80e`) |
| 1–3 — register app #3, authorize acct `38998989`, update `.env`, verify backend | ⏳ PENDING app #3 |
| Delete apps #1 + #2 (this is what actually kills the LIVE secret) | ⏳ after cutover verified |
| 5 — history scrub across all 7 branches | ⏳ only meaningful AFTER rotation |
| 6 — gitleaks pre-commit + GitHub Push Protection | ⏳ after scrub |

> **Reminder:** the leaked `CLIENT_SECRET` stays **LIVE** until apps #1+#2 are deleted. Untracking ≠ revocation. Switching the backend to app #3 alone does not close the exposure.

---

## Tidiness findings (each independently re-verified)

### ✅ DONE (executed this session)
- **`54d0136`** — Removed dead devDeps `canvas`, `jsdom`, `eslint`, `eslint-plugin-svelte` + the broken `lint` script. `npm run build` passes; **482/482 unit tests pass**.
- **`25e5207`** — Deleted `plans/volatility-background-design.md`; removed stale `BackgroundShader` row from `docs/data-pipeline-audit.md`; added SUPERSEDED banner to `docs/frontend-architecture-assessment-2026-06.md`.
- **`e4d56d2`** — Doc-sync: `supervision/` CLAUDE+README, index drift fixes, root README accuracy.
- **`86dc80e`** — Untracked runtime junk (`.env_status`×3, `.gitmodules`, `verbose/.last-run.json`) + leaked `.claude` settings + `.idx/dev.nix`.

### 🚫 NO-ACTION (intentional / not cruft — leave as-is)
- `services/tick-backend/supervision/interfaces.js` — JSDoc contract anchor cited by test fakes (dead *code*, living *documentation*).
- `services/tick-backend/specs/*.txt` — historical decision-notes (rationale for abandoning `@reiryoku/ctrader-layer`).
- `tests/` (root) — LIVE E2E stress suite (own config/specs); NOT housekeeping leftovers.
- `plans/custom-x-axis.md` — historical; the code (`xAxisCustom.js`) is live and imported.

### ❌ INVALID (original audit was WRONG — do not act)
- **`ws`** frontend runtime dep — **USED** by `test-candles-v2.mjs` + `test-math-expression-candles.cjs`. Kept.

### 🟡 DECISION-NEEDED (your call — facts verified, safe defaults suggested)
| Item | Verified fact | Safe default |
| --- | --- | --- |
| `@reiryoku/ctrader-layer` (root pkg dep) | Zero `src/` imports; backend has its own `file:` ref; build + 482 tests pass without it | `npm uninstall @reiryoku/ctrader-layer` (severs root symlink only; `libs/` untouched). Low risk. |
| `backtester/` | Self-contained (no `src/`/`services/` imports); 46 throwaway files in `results/`; `__pycache__` | Keep & trim cruft, OR remove the whole dir (clean isolated cut). CLAUDE.md: "may or may not stay." |
| `services/tick-backend/UI/` | Empty placeholder (only a CLAUDE.md) | Remove (UI lives in `src/`). |
| `services/tick-backend/docs/initial api/` | Self-labeled legacy IDX setup guide | Remove (IDX abandoned for devcontainer). |
| `test-candles-v2.mjs`, `test-math-expression-candles.cjs` | Not wired to any npm script; duplicate the `scripts/test-*.cjs` pattern | Move to `scripts/` or delete. (**They use `ws` — keep `ws` regardless.**) |
| `.npmrc-container`, `.npmrc-wsl2` | Unreferenced env npm tuning files | Remove unless you manually `cp` them during setup. |
| `docs/crystal-clarity/` | Design-phase stub (no code under any `crystal-clarity` path) | Fold `DESIGN_dayRangeMeter` into `docs/chart/`, or leave. |
| `libs/cTrader-Layer/entry/README.md`, `entry/node/README.md` | 0-byte empty files (vendored lib) | Leave (vendored; low value to touch). |
| `plans/repo-cleanup.md` ≡ `plans/repo-cleanup-plan.json` | Byte-identical duplicates (a completed cleanup plan) | Delete both, or keep one. |

---

## Original P0 (Anthropic token) — RESOLVED
The committed value in `src/.claude/settings.json` was **dead** (already rotated); the live token was never committed. Untracked in commit `86dc80e`. History scrub of that dead value is optional.

---

## Next actions (when app #3 is authorized)
1. **You** — authorize app #3 for account `38998989` (LIVE) → obtain `access_token` + `refresh_token`.
2. **You/Me** — write the 4 new values into root `.env` (`CLIENT_ID` if new app, `CLIENT_SECRET`, `ACCESS_TOKEN`, `REFRESH_TOKEN`; `ACCOUNT_ID` unchanged).
3. **Me** — `./run.sh stop && ./run.sh dev`; verify `GET /health` healthy + ticks flowing + `persistTokens` advanced.
4. **You** — delete apps #1 + #2 in the portal (kills the leaked secret).
5. **Me** — history scrub across all 7 branches + wire gitleaks + GitHub Push Protection.
