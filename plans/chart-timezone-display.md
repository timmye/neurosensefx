# Plan: Chart Timezone Display (Option A)

## Goal

Allow traders to select a timezone for chart label display. KLineChart display only — all data, backend, and calculations remain UTC.

## Scope

| Layer | Changed? | Details |
|-------|----------|---------|
| Data timestamps | No | Stay UTC epoch ms |
| Backend services | No | Market Profile, daily reset, cTrader all stay UTC |
| Database | No | No schema changes |
| KLineChart display labels | **Yes** | X-axis labels, crosshair tooltip, calendar boundary labels |
| Timezone preference | **New** | Svelte store + localStorage |

## Files

### New

| File | Purpose |
|------|---------|
| `src/stores/timezoneStore.js` | Timezone preference store with presets, localStorage persistence |

### Modify

| File | Change |
|------|--------|
| `src/lib/chart/chartAxisFormatter.js` | Replace `getUTC*()` with timezone-aware formatting |
| `src/lib/chart/calendarBoundaries.js` | `formatBoundaryLabel()` — same timezone-aware formatting |
| `src/lib/chart/chartLifecycle.js` | `chart.setTimezone(userTimezone)` + accept timezone in deps |
| `src/components/ChartDisplay.svelte` | Wire timezone store into `initChart` deps, pass to formatter factory |
| `src/components/ChartToolbar.svelte` | Add timezone selector dropdown |

---

## Step 1 — Create timezone store

**File**: `src/stores/timezoneStore.js`

```
TIMEZONE_PRESETS = [
  { id: 'UTC',        label: 'UTC',            iana: 'UTC' },
  { id: 'LOCAL',      label: 'Local',          iana: null },  // auto-detect
  { id: 'NEW_YORK',   label: 'New York',       iana: 'America/New_York' },
  { id: 'CHICAGO',    label: 'Chicago',        iana: 'America/Chicago' },
  { id: 'DENVER',     label: 'Denver',         iana: 'America/Denver' },
  { id: 'LOS_ANGELES', label: 'Los Angeles',   iana: 'America/Los_Angeles' },
  { id: 'LONDON',     label: 'London',         iana: 'Europe/London' },
  { id: 'FRANKFURT',  label: 'Frankfurt',      iana: 'Europe/Berlin' },
  { id: 'DUBAI',      label: 'Dubai',          iana: 'Asia/Dubai' },
  { id: 'MUMBAI',     label: 'Mumbai',         iana: 'Asia/Kolkata' },
  { id: 'SINGAPORE',  label: 'Singapore',      iana: 'Asia/Singapore' },
  { id: 'HONG_KONG',  label: 'Hong Kong',      iana: 'Asia/Hong_Kong' },
  { id: 'TOKYO',      label: 'Tokyo',          iana: 'Asia/Tokyo' },
  { id: 'SYDNEY',     label: 'Sydney',         iana: 'Australia/Sydney' },
  { id: 'AUCKLAND',   label: 'Auckland',       iana: 'Pacific/Auckland' },
]
```

- Export `writable` store, default `'UTC'`
- Export `resolvedTimezone` derived store: resolves `'LOCAL'` preset to `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Export `TIMEZONE_PRESETS` for the UI
- On init, read from `localStorage('neurosensefx-timezone')`, fall back to `'UTC'`
- On change, write to localStorage

---

## Step 2 — Update chartAxisFormatter.js

**File**: `src/lib/chart/chartAxisFormatter.js`

Current code uses `getUTCFullYear()`, `getUTCHours()`, etc. directly. Replace with a timezone-aware approach.

**Approach**: Accept a `getTimezone` function (same pattern as `getWindow`), use `Intl.DateTimeFormat` to extract localized date/time parts.

```js
export function createAxisFormatter(getWindow, getTimezone) {
  return function formatAxisLabel(dateTimeFormat, timestamp, format, type) {
    const tz = getTimezone();
    const d = new Date(timestamp);

    // Use Intl to get parts in the chosen timezone
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d);

    const year = getPart(parts, 'year');
    const month = getPart(parts, 'month');
    const day = getPart(parts, 'day');
    const hour = getPart(parts, 'hour');
    const minute = getPart(parts, 'minute');

    // Same label logic as before, just using tz-aware parts
    // ...
  };
}
```

- `getPart(parts, type)` — small helper to extract value from Intl parts array
- `Intl.DateTimeFormat` with explicit `timeZone` handles DST automatically
- `'en-GB'` locale gives `dd/MM/yyyy` but we use `formatToParts` and reorder, so locale choice doesn't matter for the parts values
- The tier-based switch logic (INTRADAY → `HH:mm`, DAILY → `DD-MM`, etc.) stays identical — only the part extraction changes

**Key consideration**: `Intl.DateTimeFormat.formatToParts()` creates a new formatter each call. Cache the formatter per timezone string to avoid GC pressure on hot paths (called for every axis tick).

---

## Step 3 — Update calendarBoundaries.js

**File**: `src/lib/chart/calendarBoundaries.js`

Only `formatBoundaryLabel()` (lines 58-107) needs changing. The boundary alignment and stepping functions (`alignToBoundary`, `nextWeek`, `nextDay`, etc.) operate on UTC timestamps and must stay UTC — they compute *where* ticks go, not *what label* they show.

Change `formatBoundaryLabel` signature to accept a timezone parameter:

```js
export function formatBoundaryLabel(ts, rank, prevTs, timezone = 'UTC') {
  // Same structure, use Intl.DateTimeFormat with timezone for parts
  // instead of d.getUTCFullYear() etc.
}
```

This ripples through `xAxisTickGenerator.js:77` which calls `formatBoundaryLabel(tick.ts, tick.rank, prevEmittedTs)` — needs to pass timezone.

---

## Step 4 — Wire timezone through the x-axis pipeline

The x-axis pipeline flow:

```
ChartDisplay → initChart → chart.setCustomApi({ formatDate: formatAxisLabel })
                          → chart.setTimezone(tz)
                          → setAxisChart(chart) → chartRegistry

xAxisCustom.js → createTicks → generateTicks → emitLabeledTicks → formatBoundaryLabel(ts, rank, prevTs)
```

**Changes needed**:

1. **`xAxisCustom.js`**: Store timezone per-chart in `chartRegistry` (alongside `window`). Pass to `generateTicks`.
2. **`xAxisTickGenerator.js`**: Accept timezone parameter, pass through to `formatBoundaryLabel`.
3. **`ChartDisplay.svelte`**:
   - Import timezone store
   - Pass `getTimezone` to `createAxisFormatter`
   - Pass timezone to `setAxisChart` or update `chartRegistry` directly
   - React to timezone changes: call `chart.setTimezone(newTz)` + re-render axis

---

## Step 5 — Update chartLifecycle.js

**File**: `src/lib/chart/chartLifecycle.js:92-104`

```js
export function initChart(chartContainer, deps) {
  const { LIGHT_THEME, formatAxisLabel, setAxisChart, setAxisWindow, currentWindow, timezone } = deps;
  const chart = deps.init(chartContainer, { styles: LIGHT_THEME });

  chart.setCustomApi({ formatDate: formatAxisLabel });
  chart.setTimezone(timezone);  // was 'UTC'

  setAxisChart(chart, timezone);  // pass timezone to registry
  setAxisWindow(currentWindow, chart);
  chart.setPaneOptions({ id: 'x_axis_pane', axisOptions: { name: 'calendar' } });

  return chart;
}
```

Both call sites in `ChartDisplay.svelte` (line 281 un-minimize, line 313 onMount) pass `timezone` in deps.

---

## Step 6 — Add timezone selector to ChartToolbar

**File**: `src/components/ChartToolbar.svelte`

Add a compact dropdown/select next to the window selector. Options from `TIMEZONE_PRESETS`. On change, update the timezone store. The change propagates reactively to all open charts.

---

## Step 7 — Handle timezone change reactively

When the user switches timezone, all open charts need to update. Options:

**Chosen approach**: Since `timezoneStore` is a global Svelte writable, add a reactive subscription in `ChartDisplay.svelte`:

```js
import { timezoneStore } from '../stores/timezoneStore.js';

// Inside ChartDisplay:
$: if (chart && $timezoneStore) {
  chart.setTimezone($timezoneStore);
  // Force axis re-render by re-calling setAxisWindow
  setAxisWindow(currentWindow, chart);
}
```

This avoids needing to re-create the formatter or re-init the chart.

---

## What Stays UTC (explicitly not changing)

| File | Why |
|------|-----|
| `calendarBoundaries.js` — alignment functions | Compute tick positions in UTC; only labels change |
| `chartTimeWindows.js` | Window range calculation; data-layer concern |
| `xAxisTickGenerator.js` — boundary stepping | Steps through UTC timestamps; position unchanged |
| `quickRulerUtils.js` | Duration-only, no absolute time |
| `fxBasketConfig.js` | NY anchor is for FX settlement logic, not display |
| All `services/tick-backend/*` | Data pipeline stays UTC |

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| `Intl.DateTimeFormat` performance on hot axis render path | Cache formatter per timezone string |
| KLineChart internal timezone vs custom formatter mismatch | Set both `chart.setTimezone()` AND custom formatter to same tz |
| DST transitions mid-session | `Intl.DateTimeFormat` handles this natively |
| 'Local' preset changes when user travels | Re-resolve on each store read via derived store |

---

## Testing

- Manual: switch between UTC, New York, Tokyo — verify x-axis labels, crosshair tooltip, calendar boundary labels all update
- Verify DST: set to 'America/New_York', check labels shift by 1 hour around March/November
- Verify data integrity: bar OHLC values unchanged, timestamps in WebSocket messages unchanged
- Edge: 'Local' preset on a machine with no `Intl` support (unlikely in modern browsers)
