import { describe, it, expect } from 'vitest';
import {
  snapToBar,
  selectTickInterval,
  detectBoundaryRanks,
  formatBoundaryLabel,
  formatBaseLabel,
  applySuppression,
} from '../xAxisCustom.js';
import { TICK_INTERVALS, RESOLUTION_FLOOR } from '../chartConfig.js';

// ---------------------------------------------------------------------------
// Internal constants (mirrored from xAxisCustom.js since not exported)
// ---------------------------------------------------------------------------
const RANK = { YEAR: 1, QUARTER: 2, MONTH: 3, WEEK: 4, DAY: 5 };

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------
const bars = [
  { timestamp: 1711958400000 }, // Mon Apr 1 2024 08:00 UTC
  { timestamp: 1712001600000 }, // Mon Apr 1 2024 20:00 UTC
  { timestamp: 1712088000000 }, // Tue Apr 2 2024 08:00 UTC
  { timestamp: 1712131200000 }, // Tue Apr 2 2024 20:00 UTC
  { timestamp: 1712174400000 }, // Wed Apr 3 2024 08:00 UTC
  { timestamp: 1712304000000 }, // Fri Apr 5 2024 08:00 UTC
  { timestamp: 1712563200000 }, // Mon Apr 8 2024 08:00 UTC
];

// ---------------------------------------------------------------------------
// 1. selectTickInterval
// ---------------------------------------------------------------------------
describe('selectTickInterval', () => {
  it('for each resolution, selected interval is >= the floor', () => {
    for (const [resolution, floorName] of Object.entries(RESOLUTION_FLOOR)) {
      // Use a moderate span so we don't just hit the floor
      const spanMs = 2_592_000_000; // ~30 days
      const selected = selectTickInterval(resolution, spanMs);
      const floorIdx = TICK_INTERVALS.findIndex(iv => iv.name === floorName);
      const selectedIdx = TICK_INTERVALS.findIndex(iv => iv.name === selected.name);
      // Selected index should be >= floor index (coarser or equal)
      expect(selectedIdx).toBeGreaterThanOrEqual(floorIdx);
    }
  });

  it('4h resolution with 3-month span selects a reasonable interval', () => {
    const spanMs = 7_776_000_000; // ~3 months
    const selected = selectTickInterval('4h', spanMs);
    // With ~90 days of data at 4H, should select something coarser than 1HOUR
    const floorIdx = TICK_INTERVALS.findIndex(iv => iv.name === '1HOUR');
    const selectedIdx = TICK_INTERVALS.findIndex(iv => iv.name === selected.name);
    expect(selectedIdx).toBeGreaterThanOrEqual(floorIdx);
    // Should be a named interval from TICK_INTERVALS
    expect(TICK_INTERVALS.map(iv => iv.name)).toContain(selected.name);
  });

  it('1m resolution with 1-day span selects 2HOUR or similar', () => {
    const spanMs = 86_400_000; // 1 day
    const selected = selectTickInterval('1m', spanMs);
    // Floor for 1m is 1MIN, but 1 day at 1min = 1440 bars, should select coarser
    const selectedIdx = TICK_INTERVALS.findIndex(iv => iv.name === selected.name);
    // 2HOUR index is 5, should be at least around there
    expect(selectedIdx).toBeGreaterThanOrEqual(4); // At least 1HOUR or coarser
  });

  it('D resolution with 1-year span selects MONTH', () => {
    const spanMs = 31_536_000_000; // ~1 year
    const selected = selectTickInterval('D', spanMs);
    expect(selected.name).toBe('MONTH');
  });

  it('very narrow span falls back to floor', () => {
    const spanMs = 60_000; // 1 minute
    const selected = selectTickInterval('4h', spanMs);
    const floorName = RESOLUTION_FLOOR['4h'];
    expect(selected.name).toBe(floorName);
  });
});

// ---------------------------------------------------------------------------
// 2. snapToBar
// ---------------------------------------------------------------------------
describe('snapToBar', () => {
  it('exact match returns that timestamp', () => {
    const target = bars[2].timestamp; // Tue Apr 2 2024 08:00
    const result = snapToBar(target, bars);
    expect(result).toBe(target);
  });

  it('target before first returns first bar timestamp', () => {
    const target = bars[0].timestamp - 1_000_000;
    const result = snapToBar(target, bars);
    expect(result).toBe(bars[0].timestamp);
  });

  it('target after last returns null', () => {
    const target = bars[bars.length - 1].timestamp + 1_000_000;
    const result = snapToBar(target, bars);
    expect(result).toBeNull();
  });

  it('weekend gap: Saturday target snaps to Monday bar', () => {
    // Fri Apr 5 2024 08:00 UTC is bars[5] = 1712304000000
    // Saturday Apr 6 would be 1712304000000 + 86400000 = 1712390400000
    const saturday = 1712390400000;
    const result = snapToBar(saturday, bars);
    // Should snap to Mon Apr 8 2024 08:00 UTC
    expect(result).toBe(bars[6].timestamp);
  });

  it('empty list returns null', () => {
    const result = snapToBar(0, []);
    expect(result).toBeNull();
  });

  it('null dataList returns null', () => {
    const result = snapToBar(0, null);
    expect(result).toBeNull();
  });

  it('single element: exact match returns that timestamp', () => {
    const single = [{ timestamp: 1000 }];
    expect(snapToBar(1000, single)).toBe(1000);
  });

  it('single element: non-match returns that timestamp (before)', () => {
    const single = [{ timestamp: 1000 }];
    expect(snapToBar(500, single)).toBe(1000);
  });

  it('single element: non-match returns null (after)', () => {
    const single = [{ timestamp: 1000 }];
    expect(snapToBar(1500, single)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. formatBoundaryLabel
// ---------------------------------------------------------------------------
describe('formatBoundaryLabel', () => {
  it('YEAR rank returns just the year', () => {
    // Jan 1 2026 00:00 UTC
    const ts = Date.UTC(2026, 0, 1);
    expect(formatBoundaryLabel(ts, RANK.YEAR, null)).toBe('2026');
  });

  it('QUARTER rank with prevTs in same year returns "Qn"', () => {
    // Apr 1 2026 = Q2
    const ts = Date.UTC(2026, 3, 1);
    const prevTs = Date.UTC(2026, 0, 1); // Jan 1 2026, same year
    expect(formatBoundaryLabel(ts, RANK.QUARTER, prevTs)).toBe('Q2');
  });

  it('QUARTER rank with prevTs in different year returns "Qn YYYY"', () => {
    const ts = Date.UTC(2026, 3, 1); // Q2 2026
    const prevTs = Date.UTC(2025, 0, 1); // 2025
    expect(formatBoundaryLabel(ts, RANK.QUARTER, prevTs)).toBe('Q2 2026');
  });

  it('QUARTER rank with prevTs=null returns "Qn YYYY"', () => {
    const ts = Date.UTC(2026, 3, 1);
    expect(formatBoundaryLabel(ts, RANK.QUARTER, null)).toBe('Q2 2026');
  });

  it('MONTH rank with prevTs in same year returns short month name', () => {
    const ts = Date.UTC(2026, 3, 1); // Apr
    const prevTs = Date.UTC(2026, 0, 1); // Jan, same year
    expect(formatBoundaryLabel(ts, RANK.MONTH, prevTs)).toBe('Apr');
  });

  it('MONTH rank with prevTs in different year returns "Mon YYYY"', () => {
    const ts = Date.UTC(2026, 3, 1); // Apr 2026
    const prevTs = Date.UTC(2025, 11, 1); // Dec 2025
    expect(formatBoundaryLabel(ts, RANK.MONTH, prevTs)).toBe('Apr 2026');
  });

  it('MONTH rank with prevTs=null returns "Mon YYYY"', () => {
    const ts = Date.UTC(2026, 3, 1);
    expect(formatBoundaryLabel(ts, RANK.MONTH, null)).toBe('Apr 2026');
  });

  it('WEEK rank returns "DD Mon" format', () => {
    // Sunday Apr 5 2026
    const ts = Date.UTC(2026, 3, 5);
    const prevTs = Date.UTC(2026, 2, 29); // Mar 29 2026, same year
    expect(formatBoundaryLabel(ts, RANK.WEEK, prevTs)).toBe('05 Apr');
  });

  it('WEEK rank with year change returns "DD Mon YYYY"', () => {
    const ts = Date.UTC(2026, 0, 4); // Sun Jan 4 2026
    const prevTs = Date.UTC(2025, 11, 28); // Dec 28 2025
    expect(formatBoundaryLabel(ts, RANK.WEEK, prevTs)).toBe('04 Jan 2026');
  });

  it('DAY rank within same month returns "DD"', () => {
    const ts = Date.UTC(2026, 3, 14); // Apr 14
    const prevTs = Date.UTC(2026, 3, 1); // Apr 1, same month
    expect(formatBoundaryLabel(ts, RANK.DAY, prevTs)).toBe('14');
  });

  it('DAY rank with month change returns "DD Mon"', () => {
    const ts = Date.UTC(2026, 3, 14); // Apr 14
    const prevTs = Date.UTC(2026, 2, 31); // Mar 31
    expect(formatBoundaryLabel(ts, RANK.DAY, prevTs)).toBe('14 Apr');
  });
});

// ---------------------------------------------------------------------------
// 4. formatBaseLabel
// ---------------------------------------------------------------------------
describe('formatBaseLabel', () => {
  it('sub-day interval with same day prevTs returns "HH:mm"', () => {
    // Mon Apr 1 2024 20:00 UTC = 1712001600000
    const ts = 1712001600000;
    const prevTs = 1711958400000; // Mon Apr 1 2024 08:00, same day
    expect(formatBaseLabel(ts, '4HOUR', prevTs)).toBe('20:00');
  });

  it('sub-day interval with prevTs=null returns "DD HH:mm"', () => {
    const ts = 1712001600000; // Mon Apr 1 2024 20:00
    expect(formatBaseLabel(ts, '4HOUR', null)).toBe('01 20:00');
  });

  it('sub-day interval with different day prevTs returns "DD HH:mm"', () => {
    // Tue Apr 2 2024 20:00 UTC (1712088000000)
    const ts = 1712088000000;
    // Mon Apr 1 2024 20:00 UTC (1712001600000), different day
    const prevTs = 1712001600000;
    expect(formatBaseLabel(ts, '4HOUR', prevTs)).toBe('02 20:00');
  });

  it('DAY interval returns "DD"', () => {
    const ts = Date.UTC(2026, 3, 14); // Apr 14
    expect(formatBaseLabel(ts, 'DAY', null)).toBe('14');
  });

  it('WEEK interval returns empty string (boundary handles it)', () => {
    const ts = Date.UTC(2026, 3, 5); // Sunday
    expect(formatBaseLabel(ts, 'WEEK', null)).toBe('');
  });

  it('MONTH interval returns empty string (boundary handles it)', () => {
    const ts = Date.UTC(2026, 3, 1);
    expect(formatBaseLabel(ts, 'MONTH', null)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 5. detectBoundaryRanks
// ---------------------------------------------------------------------------
describe('detectBoundaryRanks', () => {
  it('Jan 1 contains YEAR, QUARTER, MONTH, and DAY ranks', () => {
    const ts = Date.UTC(2026, 0, 1);
    // Jan 1 is not a Sunday in 2026, so no WEEK rank
    const ranks = detectBoundaryRanks(ts);
    expect(ranks).toContain(RANK.YEAR);
    expect(ranks).toContain(RANK.QUARTER);
    expect(ranks).toContain(RANK.MONTH);
    expect(ranks).toContain(RANK.DAY);
  });

  it('Jan 1 2023 (Sunday) also contains WEEK rank', () => {
    // Jan 1 2023 is a Sunday
    const ts = Date.UTC(2023, 0, 1);
    const ranks = detectBoundaryRanks(ts);
    expect(ranks).toContain(RANK.YEAR);
    expect(ranks).toContain(RANK.QUARTER);
    expect(ranks).toContain(RANK.MONTH);
    expect(ranks).toContain(RANK.WEEK);
    expect(ranks).toContain(RANK.DAY);
  });

  it('Apr 1 contains QUARTER, MONTH, and DAY ranks', () => {
    const ts = Date.UTC(2026, 3, 1); // Apr 1 2026 (Wednesday)
    const ranks = detectBoundaryRanks(ts);
    expect(ranks).toContain(RANK.QUARTER);
    expect(ranks).toContain(RANK.MONTH);
    expect(ranks).toContain(RANK.DAY);
    expect(ranks).not.toContain(RANK.YEAR);
  });

  it('May 1 contains MONTH and DAY ranks only', () => {
    const ts = Date.UTC(2026, 4, 1); // May 1 2026 (Friday)
    const ranks = detectBoundaryRanks(ts);
    expect(ranks).toContain(RANK.MONTH);
    expect(ranks).toContain(RANK.DAY);
    expect(ranks).not.toContain(RANK.YEAR);
    expect(ranks).not.toContain(RANK.QUARTER);
  });

  it('any Sunday (WEEK_START_DAY=0) contains WEEK and DAY ranks', () => {
    // Apr 7 2024 is a Sunday
    const ts = Date.UTC(2024, 3, 7);
    const ranks = detectBoundaryRanks(ts);
    expect(ranks).toContain(RANK.WEEK);
    expect(ranks).toContain(RANK.DAY);
  });

  it('regular day (not 1st, not Sunday) contains only DAY rank', () => {
    // Apr 14 2026 is a Tuesday
    const ts = Date.UTC(2026, 3, 14);
    const ranks = detectBoundaryRanks(ts);
    expect(ranks).toEqual([RANK.DAY]);
  });
});

// ---------------------------------------------------------------------------
// 6. applySuppression
// ---------------------------------------------------------------------------
describe('applySuppression', () => {
  // Pre-computed pixel positions to avoid needing a real chart
  const boundaryTicks = [
    { text: 'Apr', coord: 100, value: 100, rank: RANK.MONTH },
    { text: 'May', coord: 300, value: 300, rank: RANK.MONTH },
    { text: 'Jun', coord: 500, value: 500, rank: RANK.MONTH },
  ];

  it('base tick within boundary radius is suppressed', () => {
    // Base tick very close to boundary at coord=100
    const baseTicks = [{ text: '01 14:00', coord: 110, value: 110 }];
    const styles = { size: 12, weight: 'normal', family: 'Helvetica Neue' };
    const result = applySuppression(boundaryTicks, baseTicks, styles);
    expect(result.base).toHaveLength(0);
    expect(result.boundary).toHaveLength(3); // All boundaries survive
  });

  it('base tick outside boundary radius survives', () => {
    // Base tick far from any boundary
    const baseTicks = [{ text: '01 14:00', coord: 200, value: 200 }];
    const styles = { size: 12, weight: 'normal', family: 'Helvetica Neue' };
    const result = applySuppression(boundaryTicks, baseTicks, styles);
    expect(result.base).toHaveLength(1);
  });

  it('empty boundary list means all base ticks survive', () => {
    const baseTicks = [
      { text: '01 08:00', coord: 50, value: 50 },
      { text: '01 12:00', coord: 100, value: 100 },
    ];
    const styles = { size: 12, weight: 'normal', family: 'Helvetica Neue' };
    const result = applySuppression([], baseTicks, styles);
    expect(result.base).toHaveLength(2);
  });

  it('MIN_FLOOR 30px enforced: base tick within combined radius gets suppressed', () => {
    // MIN_FLOOR is 30px per halfWidth, so combined radius >= 60px for short labels.
    // A base tick at 50px away is within the 60px combined radius.
    const narrowBoundary = [
      { text: 'Q1', coord: 100, value: 100, rank: RANK.QUARTER },
    ];
    const baseTicks = [
      { text: '01', coord: 150, value: 150 }, // 50px away
    ];
    const styles = { size: 12, weight: 'normal', family: 'Helvetica Neue' };
    const result = applySuppression(narrowBoundary, baseTicks, styles);
    // 50px < MIN_FLOOR + MIN_FLOOR + PADDING (30+30+8+8=76, but halfWidth is max of text/2+pad or 30)
    // halfWidth(Q1) = max(14/2+8, 30) = max(15, 30) = 30
    // halfWidth(01) = max(14/2+8, 30) = max(15, 30) = 30
    // radius = 30 + 30 = 60, |150-100| = 50 < 60 => suppressed
    expect(result.base).toHaveLength(0);
  });

  it('MIN_FLOOR 30px: base tick beyond combined radius survives', () => {
    const narrowBoundary = [
      { text: 'Q1', coord: 100, value: 100, rank: RANK.QUARTER },
    ];
    const baseTicks = [
      { text: '01', coord: 165, value: 165 }, // 65px away
    ];
    const styles = { size: 12, weight: 'normal', family: 'Helvetica Neue' };
    const result = applySuppression(narrowBoundary, baseTicks, styles);
    // radius = 30 + 30 = 60, |165-100| = 65 > 60 => survives
    expect(result.base).toHaveLength(1);
  });

  it('multiple base ticks: only overlapping ones suppressed', () => {
    const baseTicks = [
      { text: '01 14:00', coord: 110, value: 110 }, // Close to boundary at 100 -> suppressed
      { text: '15 08:00', coord: 200, value: 200 }, // Mid-gap -> survives
      { text: '15 12:00', coord: 290, value: 290 }, // Close to boundary at 300 -> suppressed
    ];
    const styles = { size: 12, weight: 'normal', family: 'Helvetica Neue' };
    const result = applySuppression(boundaryTicks, baseTicks, styles);
    expect(result.base).toHaveLength(1);
    expect(result.base[0].coord).toBe(200);
  });

  it('boundary ticks suppress each other when too close', () => {
    // Two boundaries very close together
    const closeBoundaries = [
      { text: 'Apr 2026', coord: 100, value: 100, rank: RANK.MONTH },
      { text: 'May', coord: 110, value: 110, rank: RANK.MONTH },
    ];
    const styles = { size: 12, weight: 'normal', family: 'Helvetica Neue' };
    const result = applySuppression(closeBoundaries, [], styles);
    // Second boundary should be suppressed by first
    expect(result.boundary).toHaveLength(1);
    expect(result.boundary[0].text).toBe('Apr 2026');
  });
});
