# Credential Exposure Remediation — cTrader Open API (LIVE)

> **Status:** Live credential exposure on a **public** repo (`github.com/timmye/neurosensefx`).
> **Trigger file:** `.idx/dev.nix` — tracked, pushed to 7 branches incl. `origin/main`.
> **Severity:** HIGH — a live, never-rotated app secret matching the active backend config.
> Created 2026-06-25. This is an operational runbook, not a code feature.

## Objective

Invalidate every exposed credential, restore backend authentication, remove the secret
from tracking **and** history, and prevent recurrence.

## Credential inventory (grounded in `config.js` + `CTraderSession.js`)

All fields below are `required()` in `config.js` and loaded from the **root `.env`**
(`config.js:7` → `../../.env`). Fingerprints compare the committed `.idx/dev.nix` value
to the active `.env`.

| Field | Sensitivity | Exposed status | Action |
| --- | --- | --- | --- |
| `CTRADER_CLIENT_SECRET` | **CRITICAL** (static app master) | **LIVE** — dev.nix == `.env` (fp `f00cd606…`), never rotated since 2025-09-29 | **REGENERATE** |
| `CTRADER_REFRESH_TOKEN` | HIGH (mints access tokens) | stale in dev.nix (`…XJTU`), possibly still valid | revoke via re-authorization |
| `CTRADER_ACCESS_TOKEN` | medium (30-day bearer) | committed value (2025-09-29) is **expired** | re-authorize → fresh |
| `CTRADER_CLIENT_ID` | low (semi-public, pairs w/ secret) | live, exposed | keep (new only if new app) |
| `CTRADER_ACCOUNT_ID` (`38998989`) | none (identifier) | exposed | no action |
| `HOST` / `PORT` (`live.ctraderapi.com:5035`) | none | public endpoint | no action |

**Threat model:** `client_id` + `client_secret` + a still-valid `refresh_token` lets an
attacker mint fresh access tokens for account `38998989`. The secret is the linchpin —
regenerating it invalidates the exposed value and (per cTrader's OAuth2 model) breaks token
refresh under the old secret. Re-authorization then revokes the old refresh chain.

Reference: cTrader Open API — access tokens expire after ~30 days (2,628,000s); refresh
tokens generate new access tokens; client secret is managed in the Open API developer
portal. See Sources.

---

## Phase 0 — Preparation
- Confirm you own the app at the cTrader Open API developer portal.
- `cp .env .env.bak` (rollback safety — only useful if rotation not yet done).
- Expect brief backend downtime during the cutover.

## Phase 1 — Rotate at the provider (owner-only, you)
1. cTrader Open API developer portal → your application.
2. **Regenerate the client secret** (or create a new app → new `client_id` + `client_secret`).
3. **Revoke** the existing authorization for account `38998989` (kills old access/refresh tokens).
4. **Re-run the OAuth authorization flow** for account `38998989` → obtain a fresh `access_token` + `refresh_token`.
5. Record the new values (4 of them: client_id if changed, client_secret, access_token, refresh_token).
   - **Verify:** you hold fresh values and the old secret no longer works in the portal.

## Phase 2 — Update local config (root `.env`)
1. Edit root `.env`:
   - `CTRADER_CLIENT_SECRET` → new
   - `CTRADER_ACCESS_TOKEN` → new
   - `CTRADER_REFRESH_TOKEN` → new
   - `CTRADER_CLIENT_ID` → new (only if new app)
   - `CTRADER_ACCOUNT_ID` → unchanged (`38998989`)
2. Confirm `services/tick-backend/.env` does **not** override these (it shouldn't — `config.js` reads root `.env`).
   - **Verify:** `grep -cE 'CTRADER_(CLIENT_SECRET|ACCESS_TOKEN|REFRESH_TOKEN)' .env` shows 3 hits with new last-4 chars.

## Phase 3 — Restart & verify backend
1. `./run.sh stop && ./run.sh dev` (or `start`).
2. Watch logs: initial auth succeeds; no persistent `CH_ACCESS_TOKEN_INVALID` / auth errors.
3. `GET http://localhost:8080/health` → `feeds.ctrader` healthy, live ticks flowing.
4. Confirm `persistTokens()` wrote refreshed tokens back to `.env` (last-4 changed again) — proves the refresh flow works under the **new** secret.
   - **Verify:** `/health` OK + ticks flowing + `.env` tokens advanced.

## Phase 4 — Remove the secret from tracking
1. `git rm --cached .idx/dev.nix` (delete the file, or replace with a values-stripped template).
2. Broaden `.gitignore`: add `**/.idx/`; ensure `**/.claude/settings*.json`, `.claude/_settings.json`, `**/.env_status`, `verbose/` are covered.
3. Commit the untrack + ignore additions.
   - **Verify:** `git ls-files .idx/dev.nix` → empty; `git check-ignore .idx/dev.nix` → matches.

## Phase 5 — Purge history (justified — the secret was LIVE)
Because the value was live (not just a dead rotated token), scrub the blob:
1. `git filter-repo` (preferred) or BFG to remove `.idx/dev.nix`, `src/.claude/settings.json`, `.claude/_settings.json` from **all** history.
2. Force-push **every** branch + tags: `origin/main`, `feed-supervision`, `Radical`, `baseline-pre-frontend`, `phase3-legacy-migration`, `pristine-baseline-20251009`.
3. Coordinate: every clone must re-clone; GitHub may retain cached blobs briefly.
   - **Verify:** `git log --all -p | grep <old-secret-fragment>` → nothing; GitHub blob URLs 404.
   - **Note:** history scrub only fully "cleans" GitHub because Phase 1 already made the values inert. Scrub ≠ rotation.

## Phase 6 — Forward prevention
1. Add a **gitleaks** pre-commit hook (`.pre-commit-config.yaml`) — rejects future secret commits.
2. Enable **GitHub Push Protection / Secret Scanning** on the repo.
3. Keep all secrets in env-only (`.env`, gitignored) or a secrets manager — never in `.nix`/`.json` configs.
   - **Verify:** hook installed; push protection on; a fake-secret test commit is rejected.

---

## Rollback
- If the backend fails to auth after Phase 2–3: restore `cp .env.bak .env` — **but only if Phase 1 was NOT completed** (old secret still valid). If Phase 1 is done, old creds are dead; fix forward with the correct new values.

## Out of scope (tracked separately)
- General tidiness cleanup (dead devDeps, tracked runtime junk, stale docs) — see the tidiness audit.
