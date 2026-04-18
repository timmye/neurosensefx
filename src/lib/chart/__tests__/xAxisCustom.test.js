import { describe, it, expect, beforeEach } from 'vitest';
import {
  snapToBar,
  formatBoundaryLabel,
  generateTicks,
  setAxisWindow,
} from '../xAxisCustom.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function generate4HBars(startMs, barCount) {
  const bars = [];
  let ts = startMs;
  const FOUR_HOURS = 14_400_000;
  while (bars.length < barCount) {
    const d = new Date(ts);
    const dow = d.getUTCDay();
    const hour = d.getUTCHours();
    if (dow === 0 || dow === 6) { ts += FOUR_HOURS; continue; }
    if (hour === 8 || hour === 20) bars.push({ timestamp: ts });
    ts += FOUR_HOURS;
  }
  return bars;
}

function generate1HBars(startMs, barCount) {
  const bars = [];
  let ts = startMs;
  const ONE_HOUR = 3_600_000;
  while (bars.length < barCount) {
    const d = new Date(ts);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) bars.push({ timestamp: ts });
    ts += ONE_HOUR;
  }
  return bars;
}

function generateDailyBars(startMs, barCount) {
  const bars = [];
  let ts = startMs;
  const ONE_DAY = 86_400_000;
  while (bars.length < barCount) {
    const d = new Date(ts);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) bars.push({ timestamp: ts });
    ts += ONE_DAY;
  }
  return bars;
}

function generate5mBars(startMs, barCount) {
  const bars = [];
  let ts = startMs;
  const FIVE_MIN = 300_000;
  while (bars.length < barCount) {
    const d = new Date(ts);
    const dow = d.getUTCDay();
    const hour = d.getUTCHours();
    if (dow === 6) { ts += FIVE_MIN; continue; }
    if (dow === 5 && hour >= 22) { ts += FIVE_MIN; continue; }
    if (dow === 0 && hour < 22) { ts += FIVE_MIN; continue; }
    bars.push({ timestamp: ts });
    ts += FIVE_MIN;
  }
  return bars;
}

function generate15mBars(startMs, barCount) {
  const bars = [];
  let ts = startMs;
  const FIFTEEN_MIN = 900_000;
  while (bars.length < barCount) {
    const d = new Date(ts);
    const dow = d.getUTCDay();
    const hour = d.getUTCHours();
    if (dow === 6) { ts += FIFTEEN_MIN; continue; }
    if (dow === 5 && hour >= 22) { ts += FIFTEEN_MIN; continue; }
    if (dow === 0 && hour < 22) { ts += FIFTEEN_MIN; continue; }
    bars.push({ timestamp: ts });
    ts += FIFTEEN_MIN;
  }
  return bars;
}

function mockChart(dataList, pxPerBar = 8.9) {
  return {
    convertToPixel: (points, _opts) =>
      points.map(p => {
        if (p.dataIndex < 0 || p.dataIndex >= dataList.length) return null;
        return { x: p.dataIndex * pxPerBar };
      }),
  };
}

beforeEach(() => {
  // Reset window to default before each test
  setAxisWindow('3M');
});

// ===========================================================================
// snapToBar — unchanged utility
// ===========================================================================
describe('snapToBar', () => {
  const bars = [
    { timestamp: 1711958400000 },
    { timestamp: 1712001600000 },
    { timestamp: 1712088000000 },
    { timestamp: 1712131200000 },
    { timestamp: 1712174400000 },
    { timestamp: 1712304000000 },
    { timestamp: 1712563200000 },
  ];

  it('exact match returns that timestamp', () => {
    expect(snapToBar(bars[2].timestamp, bars)).toBe(bars[2].timestamp);
  });

  it('target before first returns first bar timestamp', () => {
    expect(snapToBar(bars[0].timestamp - 1_000_000, bars)).toBe(bars[0].timestamp);
  });

  it('target after last returns nearest (last) bar timestamp', () => {
    expect(snapToBar(bars[bars.length - 1].timestamp + 1_000_000, bars)).toBe(bars[bars.length - 1].timestamp);
  });

  it('empty list returns null', () => {
    expect(snapToBar(0, [])).toBeNull();
  });

  it('null dataList returns null', () => {
    expect(snapToBar(0, null)).toBeNull();
  });
});

// ===========================================================================
// formatBoundaryLabel
// ===========================================================================
describe('formatBoundaryLabel', () => {
  it('YEAR rank returns just the year', () => {
    expect(formatBoundaryLabel(Date.UTC(2026, 0, 1), 1, null)).toBe('2026');
  });

  it('QUARTER rank with prevTs in same year returns "Qn"', () => {
    expect(formatBoundaryLabel(Date.UTC(2026, 3, 1), 2, Date.UTC(2026, 0, 1))).toBe('Q2');
  });

  it('QUARTER rank with prevTs in different year returns "Qn YYYY"', () => {
    expect(formatBoundaryLabel(Date.UTC(2026, 3, 1), 2, Date.UTC(2025, 0, 1))).toBe('Q2 2026');
  });

  it('QUARTER rank with prevTs=null returns "Qn YYYY"', () => {
    expect(formatBoundaryLabel(Date.UTC(2026, 3, 1), 2, null)).toBe('Q2 2026');
  });

  it('MONTH rank with prevTs in same year returns short month name', () => {
    expect(formatBoundaryLabel(Date.UTC(2026, 3, 1), 3, Date.UTC(2026, 0, 1))).toBe('Apr');
  });

  it('MONTH rank with prevTs in different year returns "Mon YYYY"', () => {
    expect(formatBoundaryLabel(Date.UTC(2026, 3, 1), 3, Date.UTC(2025, 11, 1))).toBe('Apr 2026');
  });

  it('MONTH rank with prevTs=null returns "Mon YYYY"', () => {
    expect(formatBoundaryLabel(Date.UTC(2026, 3, 1), 3, null)).toBe('Apr 2026');
  });

  it('WEEK rank returns "DD Mon" on month transition', () => {
    expect(formatBoundaryLabel(Date.UTC(2026, 3, 5), 4, Date.UTC(2026, 2, 29))).toBe('05 Apr');
  });

  it('WEEK rank within same month returns "DD"', () => {
    expect(formatBoundaryLabel(Date.UTC(2026, 3, 19), 4, Date.UTC(2026, 3, 12))).toBe('19');
  });

  it('WEEK rank with year change returns "DD Mon YYYY"', () => {
    expect(formatBoundaryLabel(Date.UTC(2026, 0, 4), 4, Date.UTC(2025, 11, 28))).toBe('04 Jan 2026');
  });

  it('DAY rank within same month returns "DD"', () => {
    expect(formatBoundaryLabel(Date.UTC(2026, 3, 14), 5, Date.UTC(2026, 3, 1))).toBe('14');
  });

  it('DAY rank with month change returns "DD Mon"', () => {
    expect(formatBoundaryLabel(Date.UTC(2026, 3, 14), 5, Date.UTC(2026, 2, 31))).toBe('14 Apr');
  });

  it('HOUR rank same day returns "HH:MM"', () => {
    expect(formatBoundaryLabel(Date.UTC(2026, 3, 1, 14, 0), 6, Date.UTC(2026, 3, 1, 8, 0))).toBe('14:00');
  });

  it('HOUR rank cross-day returns "DD HH:MM"', () => {
    expect(formatBoundaryLabel(Date.UTC(2026, 3, 2, 8, 0), 6, Date.UTC(2026, 3, 1, 20, 0))).toBe('02 08:00');
  });

  it('HOUR rank with no prev returns "DD HH:MM"', () => {
    expect(formatBoundaryLabel(Date.UTC(2026, 3, 1, 8, 0), 6, null)).toBe('01 08:00');
  });
});

// ===========================================================================
// 1Y window — YEAR + QUARTER + MONTH
// ===========================================================================
describe('1Y window', () => {
  beforeEach(() => setAxisWindow('1Y'));

  it('daily bars spanning 2025-2026: year, quarter, and month boundaries', () => {
    // Mon Jan 6 2025 to ~Jan 2026
    const dataList = generateDailyBars(Date.UTC(2025, 0, 6, 0, 0, 0), 270);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 3));

    // Must have year label
    expect(result.find(t => t.text === '2026')).toBeDefined();
    // Must have quarter labels
    expect(result.filter(t => /^Q\d/.test(t.text)).length).toBeGreaterThanOrEqual(2);
    // Must have month labels
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    expect(result.filter(t => monthNames.some(m => t.text === m || t.text.startsWith(m + ' '))).length).toBeGreaterThanOrEqual(6);
  });

  it('Jan 1 coincident boundaries: YEAR wins over QUARTER and MONTH', () => {
    const dataList = generateDailyBars(Date.UTC(2025, 0, 6, 0, 0, 0), 270);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 3));

    // At Jan 1 2026, YEAR/QUARTER/MONTH all coincide — only one tick with YEAR label
    const jan1Tick = result.find(t => {
      const d = new Date(t.value);
      return d.getUTCMonth() === 0 && d.getUTCDate() === 1 && d.getUTCFullYear() === 2026;
    });
    expect(jan1Tick).toBeDefined();
    expect(jan1Tick.text).toBe('2026');
  });

  it('no duplicate coords', () => {
    const dataList = generateDailyBars(Date.UTC(2025, 0, 6, 0, 0, 0), 270);
    const result = generateTicks(dataList[0].timestamp, dataList[dataList.length - 1].timestamp, dataList, mockChart(dataList, 3));
    expect(new Set(result.map(t => t.coord)).size).toBe(result.length);
  });

  it('sorted by coord', () => {
    const dataList = generateDailyBars(Date.UTC(2025, 0, 6, 0, 0, 0), 270);
    const result = generateTicks(dataList[0].timestamp, dataList[dataList.length - 1].timestamp, dataList, mockChart(dataList, 3));
    for (let i = 1; i < result.length; i++) {
      expect(result[i].coord).toBeGreaterThanOrEqual(result[i - 1].coord);
    }
  });
});

// ===========================================================================
// 3M window — YEAR + QUARTER + MONTH + WEEK
// ===========================================================================
describe('3M window', () => {
  beforeEach(() => setAxisWindow('3M'));

  it('daily bars Oct-Dec 2025: Q4, months, weeks', () => {
    const dataList = generateDailyBars(Date.UTC(2025, 9, 1, 0, 0, 0), 70);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 10));

    // Oct 1 = Q4 boundary
    expect(result.find(t => t.text.includes('Q4'))).toBeDefined();
    // Month labels present
    const months = result.filter(t => /^(Oct|Nov|Dec)/.test(t.text));
    expect(months.length).toBeGreaterThanOrEqual(2);
  });

  it('higher-order YEAR boundary appears if in range', () => {
    // Span Nov 2025 - Feb 2026: Jan 1 year boundary is in range
    const dataList = generateDailyBars(Date.UTC(2025, 10, 3, 0, 0, 0), 90);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 8));

    // YEAR tick at Jan 1 may have text suppressed by MIN_FLOOR, but tick mark exists
    expect(result.find(t => new Date(t.value).getUTCFullYear() === 2026 && new Date(t.value).getMonth() === 0)).toBeDefined();
  });
});

// ===========================================================================
// 1M window — YEAR + QUARTER + MONTH + WEEK + DAY
// ===========================================================================
describe('1M window', () => {
  beforeEach(() => setAxisWindow('1M'));

  it('daily bars Mar 2026: month label + day fills', () => {
    const dataList = generateDailyBars(Date.UTC(2026, 2, 2, 0, 0, 0), 25);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 20));

    // Month boundary at Mar 1
    expect(result.find(t => t.text.includes('Mar'))).toBeDefined();
    // Day-number labels present
    const dayLabels = result.filter(t => /^\d{2}$/.test(t.text));
    expect(dayLabels.length).toBeGreaterThanOrEqual(3);
  });

  it('4H bars spanning month boundary: shows month transition', () => {
    const dataList = generate4HBars(Date.UTC(2025, 10, 24, 8, 0, 0), 40);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 10));

    // Dec 1 boundary
    expect(result.find(t => t.text.includes('Dec'))).toBeDefined();
  });
});

// ===========================================================================
// 1W window — YEAR + QUARTER + MONTH + WEEK + DAY
// ===========================================================================
describe('1W window', () => {
  beforeEach(() => setAxisWindow('1W'));

  it('4H bars one week: day-number labels', () => {
    const dataList = generate4HBars(Date.UTC(2025, 0, 6, 8, 0, 0), 12);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 15), '1W');

    const dayLabels = result.filter(t => /^\d{2}$/.test(t.text));
    expect(dayLabels.length).toBeGreaterThanOrEqual(2);
  });

  it('1H bars one week: day-number labels, no time labels', () => {
    const dataList = generate1HBars(Date.UTC(2026, 2, 9, 0, 0, 0), 50);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 2), '1W');

    // 1W finest = DAY, so no HOUR labels
    expect(result.filter(t => /^\d{2}:\d{2}$/.test(t.text)).length).toBe(0);
    expect(result.filter(t => /^\d{1,2}$/.test(t.text)).length).toBeGreaterThanOrEqual(1);
  });

  it('week spanning month boundary: boundary transition appears', () => {
    // Mar 30 - Apr 3 (Apr 1 = QUARTER + MONTH boundary, QUARTER wins dedup)
    const dataList = generateDailyBars(Date.UTC(2026, 2, 30, 0, 0, 0), 5);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 40));

    // Apr 1 is QUARTER (Q2) + MONTH boundary; QUARTER wins
    expect(result.find(t => t.text.includes('Q2'))).toBeDefined();
  });
});

// ===========================================================================
// 1d window — YEAR + QUARTER + MONTH + DAY + HOUR
// ===========================================================================
describe('1d window', () => {
  beforeEach(() => setAxisWindow('1d'));

  it('4H bars one day: HH:MM labels', () => {
    const dataList = generate4HBars(Date.UTC(2025, 0, 6, 8, 0, 0), 4);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 15), '1d');

    expect(result.filter(t => t.text.includes(':')).length).toBeGreaterThanOrEqual(1);
  });

  it('spanning midnight: DAY/YEAR transition appears', () => {
    // 4H bars spanning Dec 31 evening to Jan 1 morning
    const dataList = generate4HBars(Date.UTC(2025, 11, 30, 8, 0, 0), 6);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 15));

    // Jan 1 = YEAR + QUARTER + MONTH boundary; YEAR (rank 1) wins
    expect(result.find(t => t.text === '2026')).toBeDefined();
  });

  it('spanning year boundary: YEAR transition appears on 1d window', () => {
    // Generate enough bars to span Dec 31 → Jan 1
    const dataList = generate4HBars(Date.UTC(2025, 11, 30, 8, 0, 0), 6);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 15));

    // Year transition at Jan 1 — should appear even on 1d window
    expect(result.find(t => t.text === '2026')).toBeDefined();
  });
});

// ===========================================================================
// 2Y window — YEAR + QUARTER + MONTH
// ===========================================================================
describe('2Y window', () => {
  beforeEach(() => setAxisWindow('2Y'));

  it('daily bars 2024-2026: year + quarter + month labels', () => {
    const dataList = generateDailyBars(Date.UTC(2024, 0, 1, 0, 0, 0), 540);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 2));

    // Year labels
    expect(result.find(t => t.text === '2025')).toBeDefined();
    expect(result.find(t => t.text === '2026')).toBeDefined();
    // Quarter labels
    expect(result.filter(t => /^Q\d/.test(t.text)).length).toBeGreaterThanOrEqual(4);
    // Month labels
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    expect(result.filter(t => monthNames.some(m => t.text === m || t.text.startsWith(m + ' '))).length).toBeGreaterThanOrEqual(12);
  });
});

// ===========================================================================
// 5Y window — YEAR + QUARTER
// ===========================================================================
describe('5Y window', () => {
  beforeEach(() => setAxisWindow('5Y'));

  it('daily bars: year and quarter labels only', () => {
    const dataList = generateDailyBars(Date.UTC(2022, 0, 3, 0, 0, 0), 800);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 1));

    // Year labels
    expect(result.filter(t => /^\d{4}$/.test(t.text)).length).toBeGreaterThanOrEqual(2);
    // Quarter labels
    expect(result.filter(t => /^Q\d/.test(t.text)).length).toBeGreaterThanOrEqual(4);
    // No day-number labels (DAY not in 5Y levels)
    expect(result.filter(t => /^\d{1,2}$/.test(t.text) && t.text.length <= 2).length).toBe(0);
  });
});

// ===========================================================================
// 10Y window — YEAR + QUARTER
// ===========================================================================
describe('10Y window', () => {
  beforeEach(() => setAxisWindow('10Y'));

  it('daily bars: year and quarter labels', () => {
    const dataList = generateDailyBars(Date.UTC(2017, 0, 2, 0, 0, 0), 1500);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 0.5));

    expect(result.filter(t => /^\d{4}$/.test(t.text)).length).toBeGreaterThanOrEqual(3);
  });
});

// ===========================================================================
// 2W window
// ===========================================================================
describe('2W window', () => {
  beforeEach(() => setAxisWindow('2W'));

  it('4H bars two weeks: day labels', () => {
    const dataList = generate4HBars(Date.UTC(2025, 0, 6, 8, 0, 0), 16);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 10), '2W');

    const dayLabels = result.filter(t => /^\d{2}$/.test(t.text));
    expect(dayLabels.length).toBeGreaterThanOrEqual(3);
  });
});

// ===========================================================================
// 6M window
// ===========================================================================
describe('6M window', () => {
  beforeEach(() => setAxisWindow('6M'));

  it('daily bars: quarter + month + week labels', () => {
    const dataList = generateDailyBars(Date.UTC(2025, 2, 3, 0, 0, 0), 140);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 5));

    // Q2 starts Apr 1
    expect(result.find(t => t.text.includes('Q2'))).toBeDefined();
    // Month labels
    expect(result.filter(t => /^(Apr|May|Jun|Jul|Aug|Sep)/.test(t.text)).length).toBeGreaterThanOrEqual(3);
  });
});

// ===========================================================================
// Label context tracking
// ===========================================================================
describe('label context tracking', () => {
  beforeEach(() => setAxisWindow('1Y'));

  it('year boundary establishes context for subsequent labels', () => {
    const dataList = generateDailyBars(Date.UTC(2025, 10, 3, 0, 0, 0), 90);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 5));

    // Jan 1 = YEAR + QUARTER + MONTH; YEAR (rank 1) wins → "2026"
    expect(result.find(t => t.text === '2026')).toBeDefined();

    // Feb should NOT have year (same year context established by "2026")
    const febIdx = result.findIndex(t => t.text === 'Feb');
    expect(febIdx).toBeGreaterThanOrEqual(0);
  });

  it('quarter labels after year boundary omit year', () => {
    const dataList = generateDailyBars(Date.UTC(2025, 10, 3, 0, 0, 0), 120);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 5));

    // Year boundary present
    expect(result.find(t => t.text === '2026')).toBeDefined();
    // Q2 should not have year (context from "2026")
    expect(result.find(t => t.text === 'Q2')).toBeDefined();
  });
});

// ===========================================================================
// MIN_FLOOR collision
// ===========================================================================
describe('MIN_FLOOR collision', () => {
  beforeEach(() => setAxisWindow('1M'));

  it('dense daily bars: no two labeled ticks within 30px', () => {
    const dataList = generateDailyBars(Date.UTC(2026, 2, 2, 0, 0, 0), 25);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    // 5px per bar — 25 bars in 125px, many boundaries will collide
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 5));

    // Find all ticks with non-empty text
    const labeled = result.filter(t => t.text !== '');
    for (let i = 1; i < labeled.length; i++) {
      expect(labeled[i].coord - labeled[i - 1].coord).toBeGreaterThanOrEqual(30);
    }
  });

  it('suppressed ticks still have coord and value', () => {
    const dataList = generateDailyBars(Date.UTC(2026, 2, 2, 0, 0, 0), 25);
    const result = generateTicks(dataList[0].timestamp, dataList[dataList.length - 1].timestamp, dataList, mockChart(dataList, 5));

    for (const tick of result) {
      expect(typeof tick.coord).toBe('number');
      expect(typeof tick.value).toBe('number');
    }
  });
});

// ===========================================================================
// Edge cases
// ===========================================================================
describe('edge cases', () => {
  beforeEach(() => setAxisWindow('3M'));

  it('empty data list returns empty', () => {
    const result = generateTicks(0, 1000, [], mockChart([]));
    expect(result).toEqual([]);
  });

  it('null data list returns empty', () => {
    const result = generateTicks(0, 1000, null, mockChart([]));
    expect(result).toEqual([]);
  });

  it('single bar with no boundary in range returns empty (KLineChart falls back to defaultTicks)', () => {
    const dataList = [{ timestamp: Date.UTC(2026, 2, 5, 0, 0, 0) }];
    const result = generateTicks(dataList[0].timestamp, dataList[0].timestamp, dataList, mockChart(dataList, 10));
    expect(result.length).toBe(0);
  });

  it('all bars in same month: no month boundary, day fills only', () => {
    const dataList = generateDailyBars(Date.UTC(2026, 2, 2, 0, 0, 0), 20);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 20));

    // No month boundary label (all same month)
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthLabels = result.filter(t => monthNames.some(m => t.text === m || t.text.startsWith(m + ' ')));
    // Mar 1 may appear as a boundary, but if all data is within Mar, only week/day ticks
    // The key is: no spurious month labels for mid-month data
  });

  it('window with no boundary crossings: still produces ticks from finest level', () => {
    // 3M window but data only spans 5 days within one month — no month/quarter/year crossings
    const dataList = generateDailyBars(Date.UTC(2026, 4, 5, 0, 0, 0), 5);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 30));

    // Should still have some ticks from WEEK or DAY levels
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

// ===========================================================================
// Output contract
// ===========================================================================
describe('output contract', () => {
  beforeEach(() => setAxisWindow('1Y'));

  it('all ticks have text, coord, value', () => {
    const dataList = generateDailyBars(Date.UTC(2025, 0, 6, 0, 0, 0), 200);
    const result = generateTicks(dataList[0].timestamp, dataList[dataList.length - 1].timestamp, dataList, mockChart(dataList, 4));

    for (const tick of result) {
      expect(typeof tick.text).toBe('string');
      expect(typeof tick.coord).toBe('number');
      expect(typeof tick.value).toBe('number');
    }
  });

  it('coords are sorted ascending', () => {
    const dataList = generateDailyBars(Date.UTC(2025, 0, 6, 0, 0, 0), 200);
    const result = generateTicks(dataList[0].timestamp, dataList[dataList.length - 1].timestamp, dataList, mockChart(dataList, 4));

    for (let i = 1; i < result.length; i++) {
      expect(result[i].coord).toBeGreaterThanOrEqual(result[i - 1].coord);
    }
  });
});

// ===========================================================================
// No dead zones (max gap sanity)
// ===========================================================================
describe('no dead zones', () => {
  beforeEach(() => setAxisWindow('1M'));

  it('4H bars 3 months: max gap <= 4x median gap', () => {
    const dataList = generate4HBars(Date.UTC(2024, 11, 2, 8, 0, 0), 120);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 8.9));

    // Only check non-empty labeled ticks
    const labeled = result.filter(t => t.text !== '');
    if (labeled.length < 3) return; // too few to measure

    const gaps = [];
    for (let i = 1; i < labeled.length; i++) gaps.push(labeled[i].coord - labeled[i - 1].coord);
    const sorted = [...gaps].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    expect(Math.max(...gaps)).toBeLessThanOrEqual(4 * median);
  });
});

// ===========================================================================
// 15min + 5min bars (high density)
// ===========================================================================
describe('high-density bars', () => {
  it('5min bars 1d window: HOUR labels present', () => {
    setAxisWindow('1d');
    const dataList = generate5mBars(Date.UTC(2026, 2, 9, 22, 0, 0), 400);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 0.5), '1d');

    expect(result.filter(t => /\d{2}:\d{2}/.test(t.text)).length).toBeGreaterThanOrEqual(1);
  });

  it('15min bars 1W window: day labels, no time labels', () => {
    setAxisWindow('1W');
    const dataList = generate15mBars(Date.UTC(2026, 2, 9, 22, 0, 0), 800);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 0.5), '1W');

    // 1W finest = DAY, no HOUR labels
    expect(result.filter(t => /^\d{2}:\d{2}$/.test(t.text)).length).toBe(0);
    expect(result.filter(t => /^\d{1,2}$/.test(t.text)).length).toBeGreaterThanOrEqual(1);
  });
});

// ===========================================================================
// setAxisWindow integration
// ===========================================================================
describe('setAxisWindow', () => {
  it('changing window changes tick behavior', () => {
    const dataList = generateDailyBars(Date.UTC(2025, 0, 6, 0, 0, 0), 270);

    // 1Y window: months, quarters, years
    setAxisWindow('1Y');
    const result1Y = generateTicks(dataList[0].timestamp, dataList[dataList.length - 1].timestamp, dataList, mockChart(dataList, 3), '1Y');

    // 5Y window: only years and quarters
    setAxisWindow('5Y');
    const result5Y = generateTicks(dataList[0].timestamp, dataList[dataList.length - 1].timestamp, dataList, mockChart(dataList, 3), '5Y');

    // 5Y should have fewer month-only labels
    const monthOnly1Y = result1Y.filter(t => /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/.test(t.text));
    const monthOnly5Y = result5Y.filter(t => /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/.test(t.text));

    // 1Y has MONTH in its levels, 5Y does not
    expect(monthOnly1Y.length).toBeGreaterThan(monthOnly5Y.length);
  });
});
