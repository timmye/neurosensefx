# Backend Documentation

> ⚠️ **The files in this directory were last updated 2026-03-20 and predate the June 2026
> backend rework** (reliability fixes across 18 items / 72 tests, TWAP & Market-Profile
> symbol normalization, the leveled logger in `utils/Logger.js`, and symbol-key
> canonicalization). **Treat them as historical.** For the current, authoritative picture:
> - `services/tick-backend/README.md` — architecture overview (refreshed)
> - `services/tick-backend/CLAUDE.md` — file index
> - `docs/refactor/backend-dead-code.md` — recent cleanup + logging work
> - the source itself under `services/tick-backend/`

## Files

| File | Status | Notes |
| ---- | ------ | ----- |
| `WebSocket_API.md` | ⚠️ Historical | Was labeled "source of truth"; predates the rework — verify against `WebSocketServer.js` / `utils/MessageBuilder.js` |
| `PROTOCOL_SPECIFICATION.md` | ⚠️ Historical | Was labeled "definitive"; message types/fields may have changed |
| `Architecture_Documentation.md` | ⚠️ Historical | High-level design overview; module sizes/line counts are stale |
| `API_Documentation.md` | 🗑️ Deprecated | Already self-labeled deprecated/outdated |
| `initial api/` | 🗑️ Legacy | Historical setup guides only |

## Where the live protocol actually lives

The authoritative message format is defined in code, not these docs:

- **Outbound messages** — `utils/MessageBuilder.js` (`buildCTraderMessage`, `buildTradingViewMessage`, `buildCandleUpdateMessage`, `buildPrevDayFields`)
- **Inbound handling** — `WebSocketServer.js` (`handleMessage` and the `VALID_TYPES` switch)
- **Data routing** — `DataRouter.js`
- **Auth/persistence HTTP routes** — `authRoutes.js`, `persistenceRoutes.js`, `httpServer.js`
