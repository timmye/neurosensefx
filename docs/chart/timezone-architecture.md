# Timezone Architecture & Customisation Options

## Current State: UTC-Only

NeuroSense FX was built with UTC as the single timezone throughout the entire stack. No user-facing timezone customisation exists today.

---

## 1. Where Timezones Appear in the System

### 1.1 Data Layer (Backend)

| Component | File | How UTC is used |
|-----------|------|-----------------|
| cTrader protobuf | `libs/cTrader-Layer/protobuf/OpenApiModelMessages.proto` | `utcTimestampInMinutes` field — raw UTC from exchange |
| cTrader event handler | `services/tick-backend/CTraderEventHandler.js:22` | `Number(tb.utcTimestampInMinutes) * 60 * 1000` — converts to UTC ms |
| cTrader data processor | `services/tick-backend/CTraderDataProcessor.js:123,227` | Same conversion; uses `moment.utc()` for historical range queries |
| TradingView handler | `services/tick-backend/TradingViewCandleHandler.js:17-18` | `moment.utc().startOf('day')` for daily boundary |
| TradingView package builder | `services/tick-backend/TradingViewDataPackageBuilder.js:18-21` | `moment.utc().startOf('day')` for today filter |
| WebSocket server | `services/tick-backend/WebSocketServer.js:118-119` | Daily reset at `0000hrs UTC` via `setUTCHours(24,0,0,0)` |
| Market Profile service | `services/tick-backend/MarketProfileService.js:86-90` | Day boundary detection via `_getUtcDayStart()` — resets profile on new UTC day |
| Session manager | `services/tick-backend/sessionManager.js` | `new Date().toISOString()` — ISO/UTC for Redis session storage |
| Database schema | `docker/postgres/init/01-init.sql`, `02-auth-tables.sql` | `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` — no `WITH TIME ZONE` |

**Key point**: All data timestamps are stored/transmitted as UTC epoch milliseconds or ISO strings. This is correct and should not change.

### 1.2 Chart Rendering (Frontend)

| Component | File | How UTC is used |
|-----------|------|-----------------|
| Chart timezone | `src/lib/chart/chartLifecycle.js:97` | `chart.setTimezone('UTC')` — KLineChart configured to UTC |
| X-axis labels | `src/lib/chart/chartAxisFormatter.js:28-34` | Custom formatter using `getUTCFullYear()`, `getUTCHours()`, etc. — all labels render in UTC |
| Calendar boundaries | `src/lib/chart/calendarBoundaries.js:16-21` | `Date.UTC()`, `getUTCDay()`, `getUTCHours()` — week starts Sunday UTC |
| Time window alignment | `src/lib/chart/chartTimeWindows.js:36-63` | `getUTCDay()`, `getUTCMonth()` — weeks snap to Monday UTC, months to 1st UTC |
| Quick ruler | `src/lib/chart/quickRulerUtils.js:17-34` | Duration calculation only (no timezone display) |
| Crosshair tooltip | `src/lib/chart/chartAxisFormatter.js:34` | Always shows `YYYY-MM-DD HH:mm` in UTC |

### 1.3 FX Basket Anchor

| Component | File | How UTC is used |
|-----------|------|-----------------|
| Anchor config | `src/lib/fxBasket/fxBasketConfig.js:15-18` | `timezone: 'America/New_York'` — **only non-UTC reference in frontend** (NY 17:00 close for FX settlement) |

### 1.4 User Preferences / Settings

No timezone preference exists anywhere:
- No settings store for timezone
- No UI selector or dropdown
- No localStorage key for timezone choice
- No per-workspace timezone config

---

## 2. What a Trader Sees Today

A trader in Sydney (UTC+10) looking at a 1-hour EUR/USD chart at 9:00 AM local time sees:
- X-axis labels showing `23:00` (the UTC time)
- Crosshair tooltip showing `2026-04-17 23:00` (UTC)
- Daily candle boundaries at 00:00 UTC (10:00 AM Sydney time)
- Market Profile resets at 00:00 UTC

A trader in New York (UTC-4/EDT) sees:
- X-axis labels showing `23:00` (the same UTC time)
- Daily candle boundaries at 00:00 UTC (8:00 PM previous day EDT)

---

## 3. Customisation Options

### Option A: Display-Only Timezone Shift (Recommended First Step)

**What it does**: Convert only the label rendering to a user-selected timezone. All data, calculations, and server logic remain UTC.

**Scope of changes**:

| File | Change |
|------|--------|
| `src/lib/chart/chartAxisFormatter.js` | Replace `getUTC*()` calls with timezone-aware formatting using `Intl.DateTimeFormat` with the user's chosen IANA timezone |
| `src/lib/chart/calendarBoundaries.js` | `formatBoundaryLabel()` — same Intl-based conversion for boundary tick labels |
| `src/lib/chart/chartLifecycle.js:97` | Change `chart.setTimezone('UTC')` to `chart.setTimezone(userTimezone)` (KLineChart supports IANA strings) |
| `src/lib/chart/quickRulerUtils.js` | No change needed (duration-only, no absolute time display) |
| New: timezone preference store | Simple Svelte store + localStorage persistence |

**What stays UTC** (no change needed):
- All data timestamps (epoch ms)
- Backend processing (cTrader, Market Profile, daily resets)
- Database storage
- Time window alignment calculations
- WebSocket messages

**KLineChart support**: The library natively supports `chart.setTimezone('America/New_York')` with IANA timezone strings. This handles the heavy lifting — our custom `formatAxisLabel` override would need to align with this by using the same timezone.

**Implementation complexity**: Low. Primarily a display-layer change.

**Trader experience**:
- X-axis shows times in their local timezone
- Crosshair tooltip shows local time
- Daily candles still align to 00:00 UTC on the data layer (acceptable for forex which trades 24h)
- No confusion about data integrity

---

### Option B: Display + Session-Aware Daily Boundaries

**What it does**: Option A plus re-aligning daily candle boundaries and Market Profile resets to the trader's local day start.

**Additional scope**:

| File | Change |
|------|--------|
| `services/tick-backend/MarketProfileService.js` | Accept timezone in subscription; `_getUtcDayStart()` becomes timezone-aware |
| `src/lib/chart/chartTimeWindows.js` | Daily window alignment could snap to local midnight instead of UTC midnight |
| Backend WebSocket | Per-connection timezone preference passed on connect |

**Considerations**:
- Market Profile "day" changes meaning per-user — two traders see different profiles for the same symbol
- Daily candle OHLC changes based on timezone — 1D bars would differ
- Significantly more complex: backend needs per-user timezone awareness
- Question: Do traders actually want their daily candles shifted, or just the labels?

**Implementation complexity**: Medium-High. Requires backend changes and per-user state.

---

### Option C: Exchange/Session-Based Timezones

**What it does**: Instead of user-selected timezone, offer presets aligned to major trading sessions/hubs.

**Presets could include**:
- `UTC` (current default)
- `New York (EST/EDT)` — aligns with NY session open/close
- `London (GMT/BST)` — aligns with London session
- `Tokyo (JST)` — aligns with Asian session
- `Sydney (AEST/AEDT)` — aligns with Australasian session
- `Local` — auto-detect from browser via `Intl.DateTimeFormat().resolvedOptions().timeZone`

**Implementation**: Same as Option A technically, but the UI offers a curated list instead of a full timezone picker.

**Advantage**: Simpler UX (5-6 options vs. 400+ IANA timezones). Traders think in sessions, not in `Europe/Berlin`.

**Implementation complexity**: Low (same as Option A, different UI).

---

### Option D: Per-Workspace Timezone

**What it does**: Each workspace (chart instance) can have its own timezone setting.

**Use case**: A trader running a London session chart and a New York session chart simultaneously wants different timezone labels on each.

**Scope**: Same as Option A but the timezone preference is stored per-workspace rather than globally.

**Implementation complexity**: Low-Medium. Workspace persistence already exists.

---

## 4. Recommendation

**Start with Option C (Session presets + Local auto-detect)** implemented as Option A (display-only shift).

Rationale:
1. **Lowest risk** — zero backend changes, zero data layer changes
2. **KLineChart has native support** — `chart.setTimezone()` handles the conversion
3. **Covers 95% of use cases** — traders think in sessions, not arbitrary timezones
4. **Easy to extend** — if traders later want per-workspace (Option D) or full custom (Option A with IANA picker), the display layer is already timezone-aware

**Future consideration**: If traders request shifted daily candles (Option B), that becomes a separate feature decision since it changes data semantics.

---

## 5. Affected Files Summary (Option A/C Implementation)

### Must change
| File | Nature of change |
|------|-----------------|
| `src/lib/chart/chartLifecycle.js` | `chart.setTimezone(userTimezone)` instead of `'UTC'` |
| `src/lib/chart/chartAxisFormatter.js` | Use `Intl.DateTimeFormat` with user timezone instead of `getUTC*()` |
| `src/lib/chart/calendarBoundaries.js` | `formatBoundaryLabel()` — same Intl-based approach |
| New: `src/stores/timezoneStore.js` | Svelte store with preset list, localStorage persistence, `Intl` auto-detect |

### Should review (likely no change needed)
| File | Why |
|------|-----|
| `src/lib/chart/chartTimeWindows.js` | Window alignment stays UTC (data-layer concern) |
| `src/lib/fxBasket/fxBasketConfig.js` | NY anchor is correct for FX settlement, not display |
| `src/lib/chart/quickRulerUtils.js` | Duration-only, no timezone dependency |
| `services/tick-backend/*` | No changes — data remains UTC |

### Must NOT change
| File | Why |
|------|-----|
| `libs/cTrader-Layer/protobuf/*` | Exchange protocol — fixed format |
| `services/tick-backend/CTraderEventHandler.js` | Data pipeline — must stay UTC |
| `services/tick-backend/MarketProfileService.js` | Day boundary — stays UTC unless Option B |
| `services/tick-backend/WebSocketServer.js` | Daily reset — stays UTC |
| `docker/postgres/init/*.sql` | Schema — stays UTC |

---

## 6. Session Preset Reference

| Preset | IANA Identifier | UTC Offset (Apr) | Daylight |
|--------|----------------|-------------------|----------|
| Local | (auto-detected) | varies | varies |
| UTC | `UTC` | +0 | No |
| New York | `America/New_York` | -4 | EDT |
| Chicago | `America/Chicago` | -5 | CDT |
| Denver | `America/Denver` | -6 | MDT |
| Los Angeles | `America/Los_Angeles` | -7 | PDT |
| London | `Europe/London` | +1 | BST |
| Frankfurt | `Europe/Berlin` | +2 | CEST |
| Dubai | `Asia/Dubai` | +4 | No |
| Mumbai | `Asia/Kolkata` | +5:30 | No |
| Singapore | `Asia/Singapore` | +8 | No |
| Hong Kong | `Asia/Hong_Kong` | +8 | No |
| Tokyo | `Asia/Tokyo` | +9 | No |
| Sydney | `Australia/Sydney` | +10 | AEST |
| Auckland | `Pacific/Auckland` | +12 | NZST |
