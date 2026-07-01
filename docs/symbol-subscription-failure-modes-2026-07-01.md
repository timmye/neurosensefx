# Symbol Subscription — Failure Modes & Trader-Feedback Intelligence

**Date:** 2026-07-01
**Status:** Investigation complete. Reference doc; grounds the future `plans/symbol-entry-unified.md`. No code changed.
**Scope:** Every way a symbol subscription can fail, what the server returns for each, and what we *can* tell the trader — with cTrader and TradingView distinguished so the nuances can be compared and reconciled.

---

## 0. TL;DR

A trader who enters a bad symbol today sees **"Waiting for market data…"** (or a misleading **"CONNECTED: EURUSD"**, or a frozen **`…`**) — **never the actual error.** That is not because the system doesn't know it failed; it's two plumbing gaps:

1. **The wire discards the taxonomy.** The backend classifies cTrader rejections richly (`SYMBOL_NOT_FOUND` / `RATE_LIMIT` / `PERMANENT` / `ALREADY_SUBSCRIBED`, with raw `errorCode`) but sends the client only `{ type:'error', message:"…", symbol, source }` — **no `code`** (`RequestCoordinator.js:284`).
2. **The renderer ignores per-symbol status.** The store *does* set `status:'error'` on the error frame (`marketDataStore.js:171`), but no component reads it reactively (confirmed: `marketDataStore.js:43` `METADATA_KEYS` comment — *"no .svelte component reads [status/error] reactively"*). What *is* rendered is the **global WebSocket** connection status, which reads `connected` whenever the socket is up.

So the error is computed and then thrown away twice. The fix is plumbing, not detection — the intelligence already exists.

---

## 1. Routing model — source is fixed by display type

Source is **not** chosen by the trader or inferred from the symbol. It is fixed by the display type selected in the `+` menu (`AddMenu.svelte` `SOURCE` map). This determines *which* failure modes are even possible:

| Display type (menu action) | Source | Can use expressions? | Known-universe pre-check possible? |
|---|---|---|---|
| Price Ticker (`Alt+I`) | **TradingView** (solo) | yes | no |
| cTrader Display (`Alt+A`) | **cTrader** (always) | **no** | **yes** (`availableSymbols`) |
| TradingView Display (`Alt+T`) | **TradingView** | yes | no |
| FX Basket (`Alt+B`) | cTrader (basket of pairs) | no | yes |

**Consequence:** a *cTrader Display* fed a TV-only symbol or an expression (e.g. `DE02Y/US02Y`) will **always** fail on cTrader. A *Ticker* fed a cTrader-only symbol may still resolve on TV (TV carries `FX:EURUSD` etc.). This asymmetry is the core thing to reconcile (§5).

---

## 2. The two gaps (root cause of the reported symptom)

| Gap | What happens | Evidence |
|---|---|---|
| **G1 — wire** | `notifyClientsError` sends `{type:'error', message, symbol, source}`. The `errorCode`/category is folded into the `message` string by `describeError()` but **not sent as a structured field**. | `RequestCoordinator.js:284-294`; `utils/Logger.js:85` |
| **G2 — renderer** | Error frame sets `marketDataStore.status='error'` + `error:message`, but **no renderer reads per-symbol status**. Renders instead read the *global* WS status → show `CONNECTED: EURUSD` while the socket is up. | `marketDataStore.js:43,171`; `FloatingDisplay.svelte:61-76`; `displayCanvasRenderer.js:137` |

G2 alone (pure frontend) closes the visible symptom. G1 upgrades the messages from vague to precise. Both are independent and additive.

---

## 3. cTrader failure modes

| Failure | Backend signal | Time to signal | What the trader sees **today** | Proposed trader message (+ action) |
|---|---|---|---|---|
| **Symbol genuinely absent** (map loaded) | `SYMBOL_NOT_FOUND` → classified `PERMANENT`, **no retry** | **fast** (~1–2s: 300 ms queue + API RTT) | `CONNECTED: EURUSD` / `Waiting…` | **"EURUSD isn't available on your cTrader account."** `[Remove]` |
| **Rate-limited** | `REQUEST_FREQUENCY_EXCEEDED` / `SPEED_OVERLIMIT` / `BLOCKED_PAYLOAD_TYPE` / `TOO_MANY_REQUESTS` → `RATE_LIMIT`, retried **3×** (500 ms→1 s→2 s) | ~3.5 s | (same misleading state) | **"Broker is busy — retrying…"** → if exhausted: **"Couldn't subscribe right now — try again."** `[Retry]` |
| **Hung request** | `Promise.race` → `'Request timed out'` | **30 s** (`fetchTimeout`) | (same) | **"No response from the broker — try again."** `[Retry]` |
| **Restore-path unresolved** (after reconnect) | deferred → retried once on map refresh → `log.warn` + **skip** | **never (silent)** | display goes **stale with no notice** | **"EURUSD stopped streaming after reconnect."** `[Retry]` `[Remove]` ← *currently a reliability bug (mode #4), see §8* |
| **Map not loaded at subscribe** (edge) | `getSymbolId→null` → throws `SYMBOL_NOT_FOUND` (**false negative**) | fast | (same) | *(should not surface to the trader — fix is a backend authoritative-map check, §8)* |

`fetchTimeout = 30000` ms (`RequestCoordinator.js:11`). Retry budget = 3, exponential (`MAX_RETRIES=3`, `INITIAL_RETRY_DELAY_MS=500`).

---

## 4. TradingView failure modes

| Failure | Backend signal | Time to signal | What the trader sees **today** | Proposed trader message (+ action) |
|---|---|---|---|---|
| **Resolve throws** (bad symbol / wrong namespace) | `subscribeToSymbol` rejects | **fast** | `…` (ticker) / `CONNECTED:` | **"TradingView couldn't resolve this symbol."** + hint: *"try without an exchange prefix (e.g. `DE02Y` not `EUREX:DE02Y`), or use a cTrader Display for broker symbols."* |
| **No candle arrives** | listener armed, `series_completed`/candle never comes → `fetchTimeout` | **30 s** | (same) | **"No data from TradingView for this symbol — check the symbol."** `[Retry]` `[Remove]` |
| **TV feed disconnected** (D4) | subscribe **skipped**, deferred to timeout | **30 s** | (same) | **"TradingView feed is disconnected — try again shortly."** `[Retry]` |
| **Expression on a cTrader Display** | (surfaces as cTrader `SYMBOL_NOT_FOUND`) | fast | `CONNECTED:` | **"Expressions like `A/B` need a TradingView Display, not cTrader."** ← *cross-source guidance, §5* |

TV has **no rate-limit-retry** on resolve failures (it has an IP-ban *spacing* queue, 500 ms between subscribes, but a resolve fail errors out rather than retrying). TV self-reconnects and never gives up (`ReconnectionManager`), but an in-flight subscribe during a disconnect window just times out (D4).

---

## 5. Reconciliation — cTrader vs TradingView (the nuances)

| Dimension | cTrader | TradingView | Nuance / how to reconcile |
|---|---|---|---|
| **Negative-feedback speed** | **fast** (~1–2 s; symbol map is local) | **slow** (≤30 s; waits on candle timeout) | cTrader can reject instantly from its local map; TV must wait for data that may never arrive. **cTrader Displays give faster "bad symbol" feedback than TV-backed ones.** |
| **Known universe (pre-validation)** | **yes** — full `availableSymbols` list broadcast on `connected` | **no** enumerable list — `resolve` is the only oracle | cTrader Displays can be pre-validated client-side (instant reject, no round-trip). TV cannot; it must attempt and wait. |
| **Expression support** | **no** (single instruments only) | **yes** (`A/B`, `1/X`, `FX:EURUSD*GBPUSD`) | An expression on a cTrader Display always fails → the message should **steer the trader to a TV Display**, not just say "not found." |
| **Rate limiting** | yes (`REQUEST_FREQUENCY_EXCEEDED`…), **retried transparently** | IP-ban spacing queue; resolve fails **do not retry** | cTrader degrades gracefully then errors; TV errors outright. Different retry semantics → different messages ("retrying" vs "try again"). |
| **Reconnect behavior** | supervised feed + restore runner (**silent-skip defect**) | self-reconnect, never gives up; in-flight subscribe times out | cTrader risk = silent staleness (mode #4); TV risk = 30 s timeout. Both need a "stale/no-data" surface. |
| **Worst-case wait** | 30 s (`fetchTimeout`) | 30 s (`fetchTimeout`) | Same ceiling — both gated by the 30 s fetchTimeout. UX must tolerate up to 30 s on the slow paths. |
| **Disconnected at subscribe** | `getSymbolDataPackage` throws → **fast error** | D4: subscribe skipped → **30 s timeout** | cTrader errors fast; TV waits the full timeout. |
| **Data character** (why both exist) | **real bid/ask ticks** | **candle-derived** (no true bid/ask) | This is the reason both sources are exposed. It affects *which* source a symbol *should* use — relevant if routing ever becomes smart. |

**Reconciliation takeaway:** the two sources fail in *different ways at different speeds*. cTrader is the **fast, authoritative rejector** for its universe; TV is the **universal-but-slow oracle** that accepts nearly anything but is slow to say no. A good UX exploits both: pre-validate cTrader Displays against `availableSymbols` (instant), and give TV-backed displays an honest time-bounded "resolving…" state with a real error at the 30 s ceiling.

---

## 6. Proposed trader-message vocabulary (reconciled)

Deliberately non-technical, actionable, and **consistent across sources where the failure is the same, distinct where the nuance differs**. Requires G1 (`code` on the wire) + G2 (status rendered) to be honest.

| State / failure | cTrader message | TradingView message |
|---|---|---|
| **Resolving (pending)** | *"Resolving EURUSD…"* (time-bounded, honest) | *"Resolving EURUSD…"* |
| **Symbol not available** | *"EURUSD isn't available on your cTrader account."* `[Remove]` | *"TradingView couldn't resolve this symbol."* + namespace hint |
| **Expression on wrong source** | *"Expressions need a TradingView Display."* (steer to TV) | *(n/a — TV accepts expressions)* |
| **Rate-limited / busy** | *"Broker is busy — retrying…"* | *(n/a — TV doesn't retry resolve)* |
| **Timeout / no data** | *"No response from the broker — try again."* | *"No data from TradingView — check the symbol."* |
| **Disconnected at subscribe** | *"cTrader feed disconnected — try again."* | *"TradingView feed disconnected — try again shortly."* |
| **Stale after reconnect** | *"EURUSD stopped streaming after reconnect."* `[Retry]` | *(TV self-recovers)* |
| **Profile calc failed** (both) | *"Couldn't build the market profile (price data OK)."* | same |
| **Global socket down** | *"Disconnected from server — reconnecting."* | same |

A key upgrade vs today: **"Resolving EURUSD…"** replaces the indefinite **"Waiting for market data…"** — same pending state, but now bounded by an actual error at the end instead of silence.

> **Note:** the precise code-keyed wording in the table above requires Layer A (error `code` on the wire). The current implementation pass is Layer B only and shows **generic state messages** (see §6.2).

### 6.1 Ticker rendering — symbol field, as-is (agreed 2026-07-01)

**Constraint: no design changes and no new buttons for an error message.** The 240×80 ticker reuses its existing chrome only — the `↻`/`×` corner buttons already provide retry/remove; nothing is added.

The status text occupies the **symbol field, rendered with its existing styling** (16px / 600 / `text-transform:uppercase` / `text-overflow:ellipsis` / `--text-label`). The identity column is 105px (89px inner), giving a **~8–9 char budget** before ellipsis. The price field is left untouched (its existing `…` placeholder).

**Only the terminal-error state swaps the symbol field** to a status word; the pending state is unchanged (today's `symbol + …` already reads as "loading"):

| State | Symbol field | Price field |
|---|---|---|
| Pending (resolving) | `EURUSD` *(unchanged)* | `…` *(unchanged)* |
| Error (won't resolve / no data) | `NO DATA` | `…` |
| Error (disconnected) | `OFFLINE` | `…` |

(`text-transform:uppercase` uppercases automatically — store `"No data"`, renders `NO DATA`. Both ≤7 chars, safe under the ~8–9 budget.)

**Trade-off (conscious):** the symbol is hidden while errored. Acceptable — the trader just typed it, the ticker is non-functional, and `↻`/`×` act on it. The symbol returns the moment it re-resolves (retry or workspace reload restarts the subscription → pending → symbol shows again).

### 6.2 Implementation scope — Layer B only (this pass)

This pass implements **Layer B only** (§8): render the per-symbol `marketDataStore.status`/`error` that already exists but is currently ignored (G2). It does **not** add the error `code` to the wire (Layer A, deferred).

Consequence: without Layer A the frontend cannot reliably distinguish `SYMBOL_NOT_FOUND` from `TIMEOUT` from `RATE_LIMIT`, so this pass shows **generic state messages** (pending → "Resolving…"; error → "No data available", or `NO DATA`/`OFFLINE` on the ticker), not the precise code-keyed wording in §6's table. The status plumbing is built so that swapping in precise messages later is a one-line map once Layer A ships.

**Hard constraints for this pass:**
- **No new buttons** — reuse existing `↻` (retry) / `×` (remove).
- **No design/layout changes** — reuse existing renderers (`renderStatusMessage` / `renderErrorMessage` for canvas displays; the symbol-field swap for the ticker).
- No new dependencies; Svelte 4; no `console.error` on expected paths.
- Applies to all market-data displays: **PriceTicker**, **FloatingDisplay** (cTrader/TV), **FxBasketDisplay**.

---

## 7. Intelligence inventory — what exists vs. what's used

| Intelligence source | Where it lives | Used today? |
|---|---|---|
| cTrader `errorCode` taxonomy (`ALREADY_SUBSCRIBED`/`RATE_LIMIT`/`PERMANENT`/`SYMBOL_NOT_FOUND`) | backend | ❌ discarded at the wire (G1) |
| cTrader full `availableSymbols` list | `StatusBroadcaster.js` → WS `status` frame on `connected` | ❌ frontend never stores it (0 consumers in `src/`) |
| Per-symbol `status` (`pending`/`connected`/`error`) + `error` | `marketDataStore` | ❌ not rendered (G2) |
| Global WS connection status | `connectionManager` | ✅ the **only** thing rendered — and it's the wrong axis |
| `profileError` frames | `DataRouter.routeProfileError` | ❌ not surfaced per-symbol |
| Source known upfront from display type | `AddMenu` `SOURCE` map | ⚠️ drives routing, not feedback |
| TV resolve success = `symbolDataPackage` arrives | `RequestCoordinator.js:319` | ✅ (how data flows) |

---

## 8. What we can do with it — three independent layers

Each is shippable on its own; they compose.

**Layer A — stop discarding the code (close G1).** Add `code`/`category` to the error frame in `notifyClientsError` + the TV/timeout emitters. Small, additive, backward-compatible. Unlocks precise messages (§6).

**Layer B — render per-symbol status (close G2).** Wire `marketDataStore.status`/`error` into the canvas + header; introduce the §6 vocabulary. **Pure frontend, highest leverage, lowest risk** — and it works even *before* Layer A (shows the free-text message until A lands).

**Layer C — pre-validate cTrader Displays against `availableSymbols`.** Because a cTrader Display's source is fixed and the backend broadcasts cTrader's full instrument list, reject non-tradable symbols **instantly, client-side** — no round-trip, and it sidesteps the false-negative edge (§3 mode #5). TV displays/tickers stay on the Layer-A/B runtime path (no flat list for expressions).

**Off this path (reliability, not UX):** the **restore-path silent skip** (§3 mode #4) is a genuine defect — a symbol silently dies after reconnect. It belongs with `plans/ctrader-layer-hardening.md`, not the entry UX. Cross-link only.

---

## 9. Sequencing recommendation

1. **Layer B first** — pure frontend, closes the exact reported symptom ("waiting for market data… forever"), shows *some* error message immediately.
2. **Layer A** — upgrades those messages to precise, code-driven ones.
3. **Layer C** — cTrader Display instant-reject fast path (nice-to-have; `SYMBOL_NOT_FOUND` is already fast, C just makes it instant + removes the false-negative edge).
4. **Mode #4** — reliability hardening, via the layer-hardening plan.

---

## 10. Verified findings log (file:line evidence)

| Finding | Evidence |
|---|---|
| Error frame carries no `code` | `RequestCoordinator.js:284-294` (`notifyClientsError` → `{type,message,symbol,source}`) |
| cTrader taxonomy exists | `utils/ctraderErrorCode.js` (`ALREADY_SUBSCRIBED`/`RATE_LIMIT`/`PERMANENT`/`UNKNOWN`); `CTraderSession.js:890,924,950` (`SYMBOL_NOT_FOUND`) |
| `describeError` folds code into message string | `utils/Logger.js:85` |
| Rate-limit retry budget | `RequestCoordinator.js`: `MAX_RETRIES=3`, `INITIAL_RETRY_DELAY_MS=500`, `handleFetchError:259` (retries `REQUEST_FREQUENCY_EXCEEDED`/`BLOCKED_PAYLOAD_TYPE`) |
| `fetchTimeout = 30000` | `RequestCoordinator.js:11`; enforced `RequestCoordinator.js:124,365` |
| Store sets `status:'error'` on error frame | `marketDataStore.js:171` |
| Status/error not reactively consumed | `marketDataStore.js:43` (`METADATA_KEYS` comment); grep: no `.status`/`.error` reactive reads in display components |
| Renderer uses *global* connection status, not per-symbol | `FloatingDisplay.svelte:61-76`; `displayCanvasRenderer.js:133-149`; `DisplayHeader.svelte:67-71` |
| "Waiting for market data…" source | `visualizers.js:22` (`renderStatusMessage`) |
| "CONNECTED: {symbol}" rendered when socket up | `displayCanvasRenderer.js:137-138` |
| TV timeout error | `RequestCoordinator.js:357-365` |
| TV resolve-throw error | `RequestCoordinator.js:378-396` |
| TV D4 disconnect-defer | `RequestCoordinator.js:371-376` |
| Restore-path silent skip | `CTraderSession.js:269-286` (`_onSymbolMapRefreshed`), `:670-685` (`_runRestoreTask` defer) |
| `availableSymbols` broadcast but unused client-side | `StatusBroadcaster.js:18-39`; 0 `availableSymbols` consumers in `src/` |
| `profileError` channel | `DataRouter.js:48-57`; `MarketProfileService.js:153,278` |
| Source fixed by display type | `AddMenu.svelte` `SOURCE` map (`ticker`/`tradingview`→`tradingview`, `ctrader`→`ctrader`) |
| TV expression support / cTrader none | `docs/tradingview-symbol-expressions.md`; `tradingview-symbol-expressions.md` §cTrader Consideration |

---

## 11. Open / to-confirm (not blocking)

- Whether a TV `resolve_symbol` not-found **throws** (fast error) vs. falls through to the 30 s timeout — both code paths exist (`RequestCoordinator.js:378` catch vs `:357` timeout). Determined at runtime by whether `subscribeToSymbol` rejects. Confirm against a live run when implementing Layer A.
- Exact `connectionStatus` value rendered for a *pending* cTrader Display (whether it's `CONNECTED:` or blank) — depends on `getConnectionStatus()` initial emission; verify during Layer B implementation.