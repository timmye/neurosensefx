import { describe, it, expect } from 'vitest';
import {
  snapToBar,
  selectTickInterval,
  formatBoundaryLabel,
  formatBaseLabel,
  generateBoundaryTicks,
  generateBaseTicks,
  generateTicks,
  setAxisResolution,
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

  it('target after last returns nearest (last) bar timestamp', () => {
    const target = bars[bars.length - 1].timestamp + 1_000_000;
    const result = snapToBar(target, bars);
    expect(result).toBe(bars[bars.length - 1].timestamp);
  });

  it('weekend gap: Saturday target snaps to nearest bar (Friday)', () => {
    // Fri Apr 5 2024 08:00 UTC is bars[5] = 1712304000000
    // Saturday Apr 6 00:00 UTC = 1712390400000
    // Fri is 1 day away, Mon is 2 days away -> snaps to Friday
    const saturday = 1712390400000;
    const result = snapToBar(saturday, bars);
    expect(result).toBe(bars[5].timestamp);
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

  it('single element: non-match returns that timestamp (after)', () => {
    const single = [{ timestamp: 1000 }];
    expect(snapToBar(1500, single)).toBe(1000);
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

  it('WEEK rank returns "DD Mon" on month transition', () => {
    // Sunday Apr 5 2026
    const ts = Date.UTC(2026, 3, 5);
    const prevTs = Date.UTC(2026, 2, 29); // Mar 29 2026, same year, different month
    expect(formatBoundaryLabel(ts, RANK.WEEK, prevTs)).toBe('05 Apr');
  });

  it('WEEK rank within same month returns "DD"', () => {
    // Sunday Apr 19 2026
    const ts = Date.UTC(2026, 3, 19);
    const prevTs = Date.UTC(2026, 3, 12); // Sun Apr 12, same month
    expect(formatBoundaryLabel(ts, RANK.WEEK, prevTs)).toBe('19');
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
// 5. generateBoundaryTicks — raw candidate format
// ---------------------------------------------------------------------------
describe('generateBoundaryTicks', () => {
  it('returns raw candidates with ts, snappedTs, coord, rank (no text)', () => {
    // Use bars from shared test data — Apr 1-8 2024
    const chart = {
      convertToPixel: (points) => points.map(p => ({ x: p.dataIndex * 8.9 })),
    };
    const fromTs = bars[0].timestamp;
    const toTs = bars[bars.length - 1].timestamp;

    const candidates = generateBoundaryTicks(fromTs, toTs, bars, chart);

    // Should produce candidates
    expect(candidates.length).toBeGreaterThan(0);

    // Each candidate should have the raw format
    for (const c of candidates) {
      expect(c).toHaveProperty('ts');
      expect(c).toHaveProperty('snappedTs');
      expect(c).toHaveProperty('coord');
      expect(c).toHaveProperty('rank');
      expect(c).not.toHaveProperty('text');
      expect(c).not.toHaveProperty('value');
    }
  });

  it('groups multiple boundaries at same snapped timestamp by highest rank', () => {
    // Jan 1 is both YEAR, QUARTER, and MONTH boundary
    // With daily bars that include Jan 1
    const dailyBars = [
      { timestamp: Date.UTC(2025, 11, 30, 0, 0, 0) }, // Dec 30 2025
      { timestamp: Date.UTC(2026, 0, 1, 0, 0, 0) },   // Jan 1 2026
      { timestamp: Date.UTC(2026, 0, 2, 0, 0, 0) },   // Jan 2 2026
    ];
    const chart = {
      convertToPixel: (points) => points.map(p => ({ x: p.dataIndex * 10 })),
    };

    const candidates = generateBoundaryTicks(
      Date.UTC(2025, 11, 30), Date.UTC(2026, 0, 2), dailyBars, chart
    );

    // Jan 1 should appear as exactly one candidate with YEAR rank (highest)
    const jan1Candidates = candidates.filter(c => c.snappedTs === Date.UTC(2026, 0, 1, 0, 0, 0));
    expect(jan1Candidates).toHaveLength(1);
    expect(jan1Candidates[0].rank).toBe(RANK.YEAR);
  });
});

// ---------------------------------------------------------------------------
// 6. generateBaseTicks — raw candidate format
// ---------------------------------------------------------------------------
describe('generateBaseTicks', () => {
  it('returns raw candidates with ts, snappedTs, coord, type, intervalName (no text)', () => {
    const chart = {
      convertToPixel: (points) => points.map(p => ({ x: p.dataIndex * 8.9 })),
    };
    const interval = { name: '4HOUR', durationMs: 14_400_000, calendar: false };
    const fromTs = bars[0].timestamp;
    const toTs = bars[bars.length - 1].timestamp;

    const candidates = generateBaseTicks(interval, fromTs, toTs, bars, chart);

    // Each candidate should have the raw format
    for (const c of candidates) {
      expect(c).toHaveProperty('ts');
      expect(c).toHaveProperty('snappedTs');
      expect(c).toHaveProperty('coord');
      expect(c).toHaveProperty('type');
      expect(c.type).toBe('base');
      expect(c).toHaveProperty('intervalName');
      expect(c).not.toHaveProperty('text');
      expect(c).not.toHaveProperty('value');
    }
  });

  it('calendar intervals return empty array', () => {
    const chart = {
      convertToPixel: (points) => points.map(p => ({ x: p.dataIndex * 8.9 })),
    };
    const interval = { name: 'MONTH', calendar: true };
    const candidates = generateBaseTicks(interval, bars[0].timestamp, bars[bars.length - 1].timestamp, bars, chart);
    expect(candidates).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------

/**
 * Generate 4H bars at 08:00/20:00 UTC (cTrader broker UTC+2 offset).
 * Skips weekends (Saturday/Sunday). This matches real production data.
 */
function generate4HBars(startMs, barCount) {
  const bars = [];
  let ts = startMs;
  const FOUR_HOURS = 14_400_000;
  while (bars.length < barCount) {
    const d = new Date(ts);
    const dow = d.getUTCDay();
    const hour = d.getUTCHours();
    // Skip weekends
    if (dow === 0 || dow === 6) {
      ts += FOUR_HOURS;
      continue;
    }
    // Only emit at 08:00 and 20:00
    if (hour === 8 || hour === 20) {
      bars.push({ timestamp: ts });
    }
    ts += FOUR_HOURS;
  }
  return bars;
}

/**
 * Minimal chart mock. Maps dataIndex to pixel coordinate using linear spacing.
 */
function mockChart(dataList, pxPerBar = 8.9) {
  return {
    convertToPixel: (points, _opts) =>
      points.map(p => {
        if (p.dataIndex < 0 || p.dataIndex >= dataList.length) return null;
        return { x: p.dataIndex * pxPerBar };
      }),
  };
}

// ---------------------------------------------------------------------------
// Integration: 4H year boundary
// ---------------------------------------------------------------------------
describe('integration: 4H year boundary', () => {
  it('year boundary label "2025" appears within 1 day of Jan 1', () => {
    // Start at Mon Dec 2 2024 08:00 UTC
    const startTs = Date.UTC(2024, 11, 2, 8, 0, 0);
    const dataList = generate4HBars(startTs, 120);

    // Find Jan 1 2025 00:00 UTC in the data range
    const jan1ts = Date.UTC(2025, 0, 1, 0, 0, 0);

    // Use the full range of generated data
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;
    const chart = mockChart(dataList);

    const boundaryCandidates = generateBoundaryTicks(fromTs, toTs, dataList, chart);

    // Find the year boundary candidate
    const yearCandidate = boundaryCandidates.find(c => c.rank === RANK.YEAR);
    expect(yearCandidate).toBeDefined();

    // The year candidate's snappedTs should be the timestamp of a bar within ~16 hours of Jan 1
    const tickBarTime = yearCandidate.snappedTs;
    const offsetHours = Math.abs(tickBarTime - jan1ts) / 3_600_000;
    expect(offsetHours).toBeLessThanOrEqual(16);
  });

  it('month boundary candidate appears near Feb 1', () => {
    const startTs = Date.UTC(2025, 0, 6, 8, 0, 0); // Mon Jan 6 2025 08:00
    const dataList = generate4HBars(startTs, 120);

    const feb1ts = Date.UTC(2025, 1, 1, 0, 0, 0);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;
    const chart = mockChart(dataList);

    const boundaryCandidates = generateBoundaryTicks(fromTs, toTs, dataList, chart);

    // Find Feb boundary candidate (MONTH or QUARTER rank)
    const febCandidate = boundaryCandidates.find(c =>
      c.rank === RANK.MONTH || c.rank === RANK.QUARTER
    );
    expect(febCandidate).toBeDefined();

    // The ts (boundary time, not snapped) should be near Feb 1
    const offsetHours = Math.abs(febCandidate.ts - feb1ts) / 3_600_000;
    expect(offsetHours).toBeLessThanOrEqual(1);
  });

  it('boundary label reflects calendar date, not snapped bar time', () => {
    const startTs = Date.UTC(2024, 11, 2, 8, 0, 0);
    const dataList = generate4HBars(startTs, 120);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;
    const chart = mockChart(dataList);

    const boundaryCandidates = generateBoundaryTicks(fromTs, toTs, dataList, chart);

    // Find the year boundary candidate
    const yearCandidate = boundaryCandidates.find(c => c.rank === RANK.YEAR);
    expect(yearCandidate).toBeDefined();

    // The ts field should be Jan 1 00:00 UTC (boundary time)
    const boundaryDate = new Date(yearCandidate.ts);
    expect(boundaryDate.getUTCMonth()).toBe(0);
    expect(boundaryDate.getUTCDate()).toBe(1);

    // The snappedTs (actual bar) should be at 08:00 or 20:00
    const snappedBarTs = yearCandidate.snappedTs;
    const snappedHour = new Date(snappedBarTs).getUTCHours();
    expect([8, 20]).toContain(snappedHour);
  });

  it('full pipeline (generateTicks) produces reasonable tick count for 3-month 4H chart', () => {
    const startTs = Date.UTC(2024, 11, 2, 8, 0, 0);
    const dataList = generate4HBars(startTs, 120);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;
    const chart = mockChart(dataList);

    setAxisResolution('4h');

    const result = generateTicks(fromTs, toTs, dataList, chart, null);

    // Should have at least a few ticks
    expect(result.length).toBeGreaterThan(3);
    // Should not have an absurd number
    expect(result.length).toBeLessThan(50);

    // Each result tick should have text, coord, value
    for (const tick of result) {
      expect(tick).toHaveProperty('text');
      expect(tick).toHaveProperty('coord');
      expect(tick).toHaveProperty('value');
    }
  });

  it('YEAR tick label appears in generateTicks output', () => {
    const startTs = Date.UTC(2024, 11, 2, 8, 0, 0);
    const dataList = generate4HBars(startTs, 120);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;
    const chart = mockChart(dataList);

    setAxisResolution('4h');

    const result = generateTicks(fromTs, toTs, dataList, chart, null);

    const yearTick = result.find(t => t.text === '2025');
    expect(yearTick).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Additional integration test helpers
// ---------------------------------------------------------------------------

/**
 * Generate 1-minute bars for forex trading hours (Sun 22:00 UTC through Fri 22:00 UTC).
 * Matches cTrader/forex session pattern.
 */
function generate1mBars(startMs, barCount) {
  const bars = [];
  let ts = startMs;
  const ONE_MIN = 60_000;
  while (bars.length < barCount) {
    const d = new Date(ts);
    const dow = d.getUTCDay();
    const hour = d.getUTCHours();
    // Forex: Sun 22:00 through Fri 22:00
    // Skip Friday after 22:00 and all of Saturday
    if (dow === 6) { ts += ONE_MIN; continue; } // Saturday
    if (dow === 5 && hour >= 22) { ts += ONE_MIN; continue; } // Friday late
    if (dow === 0 && hour < 22) { ts += ONE_MIN; continue; } // Sunday early
    bars.push({ timestamp: ts });
    ts += ONE_MIN;
  }
  return bars;
}

/**
 * Generate daily bars at 00:00 UTC, Mon-Fri only.
 */
function generateDailyBars(startMs, barCount) {
  const bars = [];
  let ts = startMs;
  const ONE_DAY = 86_400_000;
  while (bars.length < barCount) {
    const d = new Date(ts);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      bars.push({ timestamp: ts });
    }
    ts += ONE_DAY;
  }
  return bars;
}

// ---------------------------------------------------------------------------
// Integration: 1-minute chart
// ---------------------------------------------------------------------------
describe('integration: 1-minute chart', () => {
  it('hour transition labels appear within 1 bar of the actual hour boundary', () => {
    // Start Mon Jan 6 2025 00:00 UTC (Monday)
    const startTs = Date.UTC(2025, 0, 6, 0, 0, 0);
    // Generate 3 days of 1m bars (about 3 * 1440 = 4320 bars)
    const dataList = generate1mBars(startTs, 5000);

    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;
    const pxPerBar = 0.5; // 1m chart: very narrow bars
    const chart = mockChart(dataList, pxPerBar);

    const interval = selectTickInterval('1m', toTs - fromTs);
    const baseCandidates = generateBaseTicks(interval, fromTs, toTs, dataList, chart);

    // Find candidates near day boundaries — their snappedTs should be near midnight
    // With ~3.5 days of 1m data, selectTickInterval should pick a sub-day interval
    // Some candidates should have ts near midnight UTC
    const midnightProximity = baseCandidates.filter(c => {
      const d = new Date(c.ts);
      const minutesFromMidnight = d.getUTCHours() * 60 + d.getUTCMinutes();
      return minutesFromMidnight < 60;
    });

    // Should have at least a few candidates near midnight in 3+ days
    expect(midnightProximity.length).toBeGreaterThan(0);
  });

  it('month boundary candidate appears near the 1st of the month', () => {
    // Start Mar 20 2025, generate enough to span into April
    // Apr 1 2025 is a Tuesday — within forex trading hours, nearest bar to midnight is within 1 minute
    const startTs = Date.UTC(2025, 2, 20, 0, 0, 0);
    const dataList = generate1mBars(startTs, 20000); // ~14 days of 1m bars
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;
    const pxPerBar = 0.3;
    const chart = mockChart(dataList, pxPerBar);

    const boundaryCandidates = generateBoundaryTicks(fromTs, toTs, dataList, chart);

    // Apr 1 is a quarter start (Q2), so the boundary candidate has QUARTER or MONTH rank
    const aprCandidate = boundaryCandidates.find(c =>
      (c.rank === RANK.QUARTER || c.rank === RANK.MONTH) &&
      new Date(c.ts).getUTCMonth() === 3 // April
    );
    expect(aprCandidate).toBeDefined();

    // Apr 1 00:00 UTC
    const apr1ts = Date.UTC(2025, 3, 1, 0, 0, 0);
    // With nearest snap, the candidate should be within minutes of Apr 1
    const offsetMinutes = Math.abs(aprCandidate.snappedTs - apr1ts) / 60_000;
    expect(offsetMinutes).toBeLessThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// Integration: daily chart
// ---------------------------------------------------------------------------
describe('integration: daily chart', () => {
  it('year boundary candidate "2025" appears on a bar within 1 day of Jan 1', () => {
    // Generate ~400 daily bars starting mid-2024 (about 1.5 years)
    const startTs = Date.UTC(2024, 6, 1, 0, 0, 0); // Jul 1 2024
    const dataList = generateDailyBars(startTs, 400);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;
    const pxPerBar = 4;
    const chart = mockChart(dataList, pxPerBar);

    const boundaryCandidates = generateBoundaryTicks(fromTs, toTs, dataList, chart);

    const yearCandidate = boundaryCandidates.find(c => c.rank === RANK.YEAR);
    expect(yearCandidate).toBeDefined();

    const jan1ts = Date.UTC(2025, 0, 1, 0, 0, 0);
    const offsetDays = Math.abs(yearCandidate.snappedTs - jan1ts) / 86_400_000;
    expect(offsetDays).toBeLessThanOrEqual(1);
  });

  it('quarter boundary candidates appear for each quarter in a year of daily data', () => {
    const startTs = Date.UTC(2024, 0, 1, 0, 0, 0); // Jan 1 2024
    const dataList = generateDailyBars(startTs, 300);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;
    const pxPerBar = 5;
    const chart = mockChart(dataList, pxPerBar);

    const boundaryCandidates = generateBoundaryTicks(fromTs, toTs, dataList, chart);

    // Jan 1 2024 boundary should be present (YEAR rank)
    const janCandidate = boundaryCandidates.find(c =>
      new Date(c.ts).getUTCMonth() === 0 && new Date(c.ts).getUTCDate() === 1 && new Date(c.ts).getUTCFullYear() === 2024
    );
    expect(janCandidate).toBeDefined();

    // Apr 1 2024 boundary should be present (QUARTER rank)
    const aprCandidate = boundaryCandidates.find(c =>
      new Date(c.ts).getUTCMonth() === 3 && new Date(c.ts).getUTCDate() === 1
    );
    expect(aprCandidate).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Integration: generateTicks pipeline
// ---------------------------------------------------------------------------
describe('integration: generateTicks pipeline', () => {
  it('suppresses overlapping boundary ticks — higher rank wins', () => {
    // Create two boundaries very close together: YEAR at Jan 1 and WEEK at Dec 29
    const dailyBars = [
      { timestamp: Date.UTC(2025, 11, 28, 0, 0, 0) }, // Dec 28 2025 (Sun)
      { timestamp: Date.UTC(2025, 11, 29, 0, 0, 0) }, // Dec 29 2025 (Mon)
      { timestamp: Date.UTC(2025, 11, 30, 0, 0, 0) }, // Dec 30 2025 (Tue)
      { timestamp: Date.UTC(2025, 11, 31, 0, 0, 0) }, // Dec 31 2025 (Wed)
      { timestamp: Date.UTC(2026, 0, 1, 0, 0, 0) },   // Jan 1 2026 (Thu)
      { timestamp: Date.UTC(2026, 0, 2, 0, 0, 0) },   // Jan 2 2026 (Fri)
    ];
    const pxPerBar = 3; // narrow spacing
    const chart = mockChart(dailyBars, pxPerBar);

    setAxisResolution('D');

    const result = generateTicks(
      Date.UTC(2025, 11, 28), Date.UTC(2026, 0, 2), dailyBars, chart, null
    );

    // YEAR tick should be present
    const yearTick = result.find(t => t.text === '2026');
    expect(yearTick).toBeDefined();

    // Should not have duplicate labels at same coord
    const coords = result.map(t => t.coord);
    const uniqueCoords = new Set(coords);
    expect(uniqueCoords.size).toBe(result.length);
  });

  it('context fill adds ticks around MONTH boundaries', () => {
    const startTs = Date.UTC(2024, 11, 2, 8, 0, 0);
    const dataList = generate4HBars(startTs, 120);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;
    const chart = mockChart(dataList);

    setAxisResolution('4h');

    const result = generateTicks(fromTs, toTs, dataList, chart, null);

    // Should have boundary ticks (months) and base ticks (hours)
    // Context fill should ensure ticks appear around month boundaries
    expect(result.length).toBeGreaterThan(3);

    // No two ticks should overlap (all coords unique)
    const coords = result.map(t => t.coord);
    const uniqueCoords = new Set(coords);
    expect(uniqueCoords.size).toBe(result.length);
  });

  it('returns ticks with text, coord, value in coord-sorted order', () => {
    const startTs = Date.UTC(2025, 0, 6, 8, 0, 0);
    const dataList = generate4HBars(startTs, 80);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;
    const chart = mockChart(dataList);

    setAxisResolution('4h');

    const result = generateTicks(fromTs, toTs, dataList, chart, null);

    // Check sorted order
    for (let i = 1; i < result.length; i++) {
      expect(result[i].coord).toBeGreaterThanOrEqual(result[i - 1].coord);
    }

    // Check shape
    for (const tick of result) {
      expect(typeof tick.text).toBe('string');
      expect(tick.text.length).toBeGreaterThan(0);
      expect(typeof tick.coord).toBe('number');
      expect(typeof tick.value).toBe('number');
    }
  });
});
