# Timezone Display Change — Impact Analysis

## Goal

Change chart time labels from UTC to the user's system timezone (or a manual timezone selector).
**Data stays UTC** — only the rendering/display layer changes.

## Architecture: Two Independent Time Rendering Paths

The chart displays time in **two completely separate paths** that both need updating:

### Path 1: KLineChart's `formatDate` Hook (crosshair + tooltip)

**File**: `src/components/ChartDisplay.svelte:78-107`

KLineChart calls `formatAxisLabel(dateTimeFormat, timestamp, format, type)` for three UI elements:

| `type` value | KLineChart enum | UI Element | Current Behaviour |
|---|---|---|---|
| `0` | `FormatDateType.Tooltip` | Candlestick tooltip (legend `{time}` field) | `YYYY-MM-DD HH:mm` in **UTC** |
| `1` | `FormatDateType.Crosshair` | Crosshair vertical line time label | `YYYY-MM-DD HH:mm` in **UTC** |
| `2` | `FormatDateType.XAxis` | X-axis tick labels (transition detection only) | Used by KLineChart's internal `_optimalTickLabel` to compare adjacent ticks |

**For types 0 and 1**: The function manually extracts UTC components (`getUTCFullYear`, `getUTCHours`, etc.) and formats them. This hardcodes UTC display.

**For type 2**: This path is mostly unused because the custom calendar axis (Path 2) handles x-axis rendering. However, KLineChart still calls `formatDate(type=2)` internally for its `_optimalTickLabel` transition detection. The transition format strings (`'YYYY'`, `'YYYY-MM'`, `'MM-DD'`, `'YYYY-MM-DD HH:mm'`) are compared between adjacent ticks to detect when a label should show a higher-level unit. These also use UTC getters.

**Important**: `chart.setTimezone('UTC')` (line 630) passes an `Intl.DateTimeFormat` configured for UTC as the `dateTimeFormat` parameter — but `formatAxisLabel` **ignores it entirely** and uses raw `getUTC*()` calls instead.

### Path 2: Custom Calendar X-Axis

**File**: `src/lib/chart/xAxisCustom.js`

Registered via `registerXAxis({ name: 'calendar' })`. This completely replaces KLineChart's built-in x-axis. It has its own:

| Function | Lines | What it does | Timezone dependency |
|---|---|---|---|
| `formatBoundaryLabel()` | 139-184 | Formats x-axis tick labels (e.g., `15 Apr`, `Q2`, `09:45`) | Uses `getUTC*()` — hardcodes UTC |
| `generateTicks()` | 190-283 | Walks calendar boundaries to place ticks | Uses `alignToBoundary()` which uses `Date.UTC()` |
| `alignToBoundary()` | 105-131 | Snaps to week/day/hour boundaries | Uses `Date.UTC()`, `setUTCHours()` |
| `nextYear/Quarter/Month/Week/Day/Hour()` | 98-103 | Calendar boundary generators | All use `Date.UTC()` |
| `snapToBar()` | 82-92 | Snaps mouse position to nearest bar | Timezone-independent (delta arithmetic) |

**Window alignment** (in `src/lib/chart/chartConfig.js`):

| Function | Lines | What it does | Timezone dependency |
|---|---|---|---|
| `getCalendarAlignedRange()` | 144-177 | Computes data fetch range for a window | `alignWeekRange()`, `alignMonthRange()`, `alignYearRange()` all use `Date.UTC()` |
| `alignWeekRange()` | 94-103 | Snaps to Monday 00:00 UTC | `Date.UTC()` |
| `alignMonthRange()` | 105-113 | Snaps to 1st of month 00:00 UTC | `Date.UTC()` |
| `alignYearRange()` | 115-129 | Snaps to quarter start / Jan 1 UTC | `Date.UTC()` |

**Note**: Window alignment calculations (`getCalendarAlignedRange`) affect **which data is fetched**, not just how it's displayed. If these stay UTC-aligned, the fetch range won't change — only the label rendering shifts. This is likely fine: fetching a UTC-aligned window and displaying it with local-time labels means the user sees the same data, just with shifted labels.

## What Needs to Change (Display Only)

### 1. `formatAxisLabel()` in ChartDisplay.svelte — Crosshair & Tooltip

**Current** (line 79-84):
```js
const d = new Date(timestamp);
const year = d.getUTCFullYear();
const month = d.getUTCMonth();
// ... all getUTC*()
```

**Change to**: Use local time getters (`getFullYear()`, `getMonth()`, etc.) or timezone-aware formatting via the `dateTimeFormat` parameter that KLineChart already passes in.

The `dateTimeFormat` parameter is an `Intl.DateTimeFormat` instance configured to whatever timezone `chart.setTimezone()` is set to. Currently set to `'UTC'` — changing it to a user timezone (or removing the call to let KLineChart default to the browser timezone) would make `dateTimeFormat` do the conversion automatically.

### 2. `formatBoundaryLabel()` in xAxisCustom.js — X-Axis Labels

**Current** (lines 142-146):
```js
const year = d.getUTCFullYear();
const month = d.getUTCMonth();
const day = d.getUTCDate();
const hours = pad2(d.getUTCHours());
const mins = pad2(d.getUTCMinutes());
```

**Change to**: Use local getters or accept a timezone parameter. Since this module doesn't have access to KLineChart's `dateTimeFormat`, it would need either:
- A module-level timezone setting (e.g., `setAxisTimezone('America/New_York')`)
- Local time getters (if system timezone is sufficient)

### 3. `chart.setTimezone('UTC')` in ChartDisplay.svelte

**Current** (line 630): Hardcoded to UTC.

**Change to**: User's timezone or system timezone. This affects the `dateTimeFormat` parameter passed to `formatAxisLabel`.

## What Does NOT Need to Change

| Component | Why |
|---|---|
| All data timestamps | Stay UTC milliseconds — no conversion needed |
| cTrader data processing | Backend receives UTC, sends UTC |
| Market Profile day boundaries | Profile calculations are data-level, not display |
| Backend daily reset | Server-side operation, independent of display timezone |
| Historical data fetch ranges | UTC-aligned fetches are fine — data doesn't change |
| Calendar boundary generators (`nextYear`, etc.) | These generate UTC timestamps for tick placement. The **positions** of ticks don't change — only the **labels** on them change. A tick at UTC midnight is at the same pixel position whether the label says `00:00` or `19:00 ET`. |
| `alignToBoundary()` | Same reasoning — tick positions are timezone-independent |
| Drawing timestamps in IndexedDB | Stored as UTC milliseconds, rendering will pick up the new timezone |
| `ANCHOR_CONFIG.timezone` in fxBasketConfig.js | Dead code — never imported |

## Open Design Question: Window Alignment

The calendar-aligned fetch ranges (`getCalendarAlignedRange`) snap to UTC boundaries (Monday UTC, 1st of month UTC). When displaying in a different timezone:

- A "1W" window fetched from Monday 00:00 UTC shows as Sunday 8pm ET (for ET users)
- The visible data range is still correct, but the "start of week" label might feel off

**Options**:
1. **Leave as-is** — UTC-aligned fetches, local-time labels. Simple, data is correct.
2. **Timezone-align the fetch windows** — Snap to Monday 00:00 in the user's timezone. More intuitive but more complex; requires passing timezone to `getCalendarAlignedRange`.

## Implementation Checklist

- [ ] Add timezone setting (system timezone or manual selector)
- [ ] Change `chart.setTimezone()` to use the new timezone
- [ ] Update `formatAxisLabel()` to use local getters or `dateTimeFormat` parameter
- [ ] Update `formatBoundaryLabel()` in xAxisCustom.js to use local getters
- [ ] Decide whether window alignment stays UTC or shifts to user timezone
- [ ] Test: crosshair tooltip shows local time
- [ ] Test: x-axis labels show local time
- [ ] Test: drawings render correctly with new timezone
- [ ] Test: window boundaries display intuitively
