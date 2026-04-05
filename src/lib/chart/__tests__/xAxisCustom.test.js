import { describe, it, expect } from 'vitest';
import {
  snapToBar,
  formatBoundaryLabel,
  formatBaseLabel,
  generateTicks,
  setAxisResolution,
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

// ===========================================================================
// snapToBar
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

  it('weekend gap: Saturday target snaps to nearest bar (Friday)', () => {
    expect(snapToBar(1712390400000, bars)).toBe(bars[5].timestamp);
  });

  it('empty list returns null', () => {
    expect(snapToBar(0, [])).toBeNull();
  });

  it('null dataList returns null', () => {
    expect(snapToBar(0, null)).toBeNull();
  });

  it('single element: exact match returns that timestamp', () => {
    expect(snapToBar(1000, [{ timestamp: 1000 }])).toBe(1000);
  });

  it('single element: non-match returns that timestamp', () => {
    expect(snapToBar(500, [{ timestamp: 1000 }])).toBe(1000);
    expect(snapToBar(1500, [{ timestamp: 1000 }])).toBe(1000);
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
});

// ===========================================================================
// formatBaseLabel
// ===========================================================================
describe('formatBaseLabel', () => {
  describe('INTRADAY tier', () => {
    it('cross-day with no prevTs returns "DD HH:mm"', () => {
      expect(formatBaseLabel(Date.UTC(2024, 3, 2, 20, 0, 0), null, 'INTRADAY')).toBe('02 20:00');
    });

    it('cross-day with prevTs on different day returns "DD HH:mm"', () => {
      expect(formatBaseLabel(Date.UTC(2024, 3, 2, 20, 0, 0), Date.UTC(2024, 3, 1, 20, 0, 0), 'INTRADAY')).toBe('02 20:00');
    });

    it('same-day returns "HH:mm" only', () => {
      expect(formatBaseLabel(Date.UTC(2024, 3, 1, 20, 0, 0), Date.UTC(2024, 3, 1, 8, 0, 0), 'INTRADAY')).toBe('20:00');
    });
  });

  describe('MULTIDAY tiers', () => {
    it('cross-day tick returns "DD"', () => {
      expect(formatBaseLabel(Date.UTC(2024, 3, 2, 20, 0, 0), Date.UTC(2024, 3, 1, 20, 0, 0), 'WEEKLY')).toBe('02');
    });

    it('same-day tick returns empty (suppressed)', () => {
      expect(formatBaseLabel(Date.UTC(2024, 3, 1, 20, 0, 0), Date.UTC(2024, 3, 1, 8, 0, 0), 'WEEKLY')).toBe('');
    });

    it('first tick (no prevTs) returns "DD"', () => {
      expect(formatBaseLabel(Date.UTC(2024, 3, 1, 8, 0, 0), null, 'MONTHLY')).toBe('01');
    });
  });
});

// ===========================================================================
// INTRADAY tier
// ===========================================================================
describe('INTRADAY tier', () => {
  it('4H bars, ~1 day: shows time labels', () => {
    const dataList = generate4HBars(Date.UTC(2025, 0, 6, 8, 0, 0), 4);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('4h');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 15), null);

    expect(result.filter(t => t.text.includes(':')).length).toBeGreaterThanOrEqual(1);
  });

  it('1H bars, ~2 days: shows time labels', () => {
    const dataList = generate1HBars(Date.UTC(2025, 0, 6, 0, 0, 0), 20);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('1h');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 3), null);

    expect(result.filter(t => t.text.includes(':')).length).toBeGreaterThanOrEqual(1);
  });

  it('5min bars, ~1.5 days: shows time labels, reasonable count', () => {
    const dataList = generate5mBars(Date.UTC(2026, 2, 9, 22, 0, 0), 400);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('5m');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 0.5), null);

    expect(result.filter(t => /\d{2}:\d{2}/.test(t.text)).length).toBeGreaterThanOrEqual(1);
    expect(result.length).toBeGreaterThanOrEqual(5);
    expect(result.length).toBeLessThanOrEqual(25);
  });
});

// ===========================================================================
// DAILY tier
// ===========================================================================
describe('DAILY tier', () => {
  it('4H bars, ~1 week: day numbers, no time-only labels', () => {
    const dataList = generate4HBars(Date.UTC(2025, 0, 6, 8, 0, 0), 12);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('4h');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 15), null);

    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.filter(t => /^\d{2}:\d{2}$/.test(t.text)).length).toBe(0);
  });

  it('1H bars, ~2 weeks: day numbers, no time-only labels', () => {
    const dataList = generate1HBars(Date.UTC(2026, 2, 9, 0, 0, 0), 100);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('1h');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 1.2), null);

    expect(result.filter(t => t.text.includes(':')).length).toBe(0);
    expect(result.filter(t => /^\d{1,2}$/.test(t.text) || /^Jan|^Feb|^Mar/.test(t.text)).length).toBeGreaterThanOrEqual(1);
  });
});

// ===========================================================================
// WEEKLY tier
// ===========================================================================
describe('WEEKLY tier', () => {
  it('4H bars, ~6 weeks: month boundaries + day numbers', () => {
    const dataList = generate4HBars(Date.UTC(2024, 10, 4, 8, 0, 0), 80);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('4h');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 8.9), null);

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    expect(result.filter(t => monthNames.some(m => t.text === m || t.text.startsWith(m + ' '))).length).toBeGreaterThanOrEqual(1);
    expect(result.filter(t => /^\d{1,2}$/.test(t.text)).length).toBeGreaterThanOrEqual(1);
  });
});

// ===========================================================================
// MONTHLY tier
// ===========================================================================
describe('MONTHLY tier', () => {
  it('4H bars, ~3 months: month boundaries + day numbers', () => {
    const dataList = generate4HBars(Date.UTC(2024, 11, 2, 8, 0, 0), 120);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('4h');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 8.9), null);

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    expect(result.filter(t => monthNames.some(m => t.text === m || t.text.startsWith(m + ' '))).length).toBeGreaterThanOrEqual(1);
    expect(result.filter(t => /^\d{1,2}$/.test(t.text)).length).toBeGreaterThanOrEqual(1);
  });

  it('4H bars, ~6 months (year boundary): month boundaries + day fills, no Q labels', () => {
    const dataList = generate4HBars(Date.UTC(2024, 6, 1, 8, 0, 0), 200);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('4h');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 8.9), null);

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    expect(result.filter(t => monthNames.some(m => t.text === m || t.text.startsWith(m + ' '))).length).toBeGreaterThanOrEqual(3);
    expect(result.filter(t => /^\d{1,2}$/.test(t.text)).length).toBeGreaterThanOrEqual(5);
    // MONTHLY tier should NOT show quarter labels
    expect(result.filter(t => /^Q\d/.test(t.text)).length).toBe(0);

    for (let i = 1; i < result.length; i++) {
      expect(result[i].coord).toBeGreaterThanOrEqual(result[i - 1].coord);
    }
  });

  it('no dead zones: max gap <= 3x median gap', () => {
    const dataList = generate4HBars(Date.UTC(2024, 11, 2, 8, 0, 0), 120);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('4h');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 8.9), null);

    if (result.length < 3) return;
    const gaps = [];
    for (let i = 1; i < result.length; i++) gaps.push(result[i].coord - result[i - 1].coord);
    const sorted = [...gaps].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    expect(Math.max(...gaps)).toBeLessThanOrEqual(3 * median);
  });
});

// ===========================================================================
// QUARTERLY tier
// ===========================================================================
describe('QUARTERLY tier', () => {
  it('daily bars, ~8 months: boundaries + day fill', () => {
    const dataList = generateDailyBars(Date.UTC(2025, 5, 2, 0, 0, 0), 180);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('D');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 5), null);

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    expect(result.filter(t => monthNames.some(m => t.text === m || t.text.startsWith(m + ' ')) || /^Q\d/.test(t.text)).length).toBeGreaterThanOrEqual(1);
    expect(result.filter(t => /^\d{1,2}$/.test(t.text)).length).toBeGreaterThanOrEqual(1);
  });
});

// ===========================================================================
// YEARLY tier
// ===========================================================================
describe('YEARLY tier', () => {
  it('daily bars, ~1 year: year + quarter + month boundaries', () => {
    const dataList = generateDailyBars(Date.UTC(2025, 0, 6, 0, 0, 0), 260);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('D');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 3), null);

    expect(result.filter(t => /^\d{4}$/.test(t.text)).length).toBeGreaterThanOrEqual(1);
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    expect(result.filter(t => monthNames.some(m => t.text === m || t.text.startsWith(m + ' '))).length).toBeGreaterThanOrEqual(3);
    expect(result.filter(t => /^Q\d/.test(t.text)).length).toBeGreaterThanOrEqual(1);
  });
});

// ===========================================================================
// Cross-tier consistency
// ===========================================================================
describe('cross-tier consistency', () => {
  it('no time-only labels in any MULTIDAY tier', () => {
    const scenarios = [
      { bars: generate4HBars(Date.UTC(2024, 10, 4, 8, 0, 0), 80), px: 8.9, res: '4h' },
      { bars: generate4HBars(Date.UTC(2024, 11, 2, 8, 0, 0), 120), px: 8.9, res: '4h' },
      { bars: generate4HBars(Date.UTC(2024, 6, 1, 8, 0, 0), 200), px: 8.9, res: '4h' },
      { bars: generateDailyBars(Date.UTC(2025, 0, 6, 0, 0, 0), 260), px: 3, res: 'D' },
    ];

    for (const { bars, px, res } of scenarios) {
      const fromTs = bars[0].timestamp;
      const toTs = bars[bars.length - 1].timestamp;
      setAxisResolution(res);
      const result = generateTicks(fromTs, toTs, bars, mockChart(bars, px), null);
      expect(result.filter(t => /^\d{2}:\d{2}$/.test(t.text)).length).toBe(0);
    }
  });

  it('after MONTH boundary, next tick is day-only number', () => {
    const dataList = generate4HBars(Date.UTC(2024, 11, 2, 8, 0, 0), 120);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('4h');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 8.9), null);

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthIdx = result.findIndex(t => monthNames.some(m => t.text === m || t.text.startsWith(m + ' ')));
    expect(monthIdx).toBeGreaterThanOrEqual(0);

    if (monthIdx + 1 < result.length) {
      expect(result[monthIdx + 1].text).toMatch(/^\d{1,2}$/);
    }
  });

  it('after YEAR boundary, no year repetition', () => {
    const dataList = generate4HBars(Date.UTC(2024, 11, 2, 8, 0, 0), 120);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('4h');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 8.9), null);

    const yearIdx = result.findIndex(t => /^\d{4}$/.test(t.text));
    if (yearIdx >= 0) {
      const year = result[yearIdx].text;
      for (let i = yearIdx + 1; i < result.length; i++) {
        expect(result[i].text).not.toMatch(new RegExp(`${year}$`));
      }
    }
  });
});

// ===========================================================================
// Tick spacing
// ===========================================================================
describe('tick spacing', () => {
  it('MULTIDAY: consecutive ticks >= 30px apart', () => {
    const dataList = generate4HBars(Date.UTC(2024, 11, 2, 8, 0, 0), 120);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('4h');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 8.9), null);

    for (let i = 1; i < result.length; i++) {
      expect(Math.abs(result[i].coord - result[i - 1].coord)).toBeGreaterThanOrEqual(30);
    }
  });

  it('INTRADAY: consecutive ticks >= 30px apart', () => {
    const dataList = generate4HBars(Date.UTC(2025, 0, 6, 8, 0, 0), 6);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('4h');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 15), null);

    for (let i = 1; i < result.length; i++) {
      expect(Math.abs(result[i].coord - result[i - 1].coord)).toBeGreaterThanOrEqual(30);
    }
  });
});

// ===========================================================================
// Pipeline basics
// ===========================================================================
describe('pipeline basics', () => {
  it('returns ticks with text, coord, value in coord-sorted order', () => {
    const dataList = generate4HBars(Date.UTC(2025, 0, 6, 8, 0, 0), 80);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('4h');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 8.9), null);

    for (let i = 1; i < result.length; i++) {
      expect(result[i].coord).toBeGreaterThanOrEqual(result[i - 1].coord);
    }
    for (const tick of result) {
      expect(typeof tick.text).toBe('string');
      expect(tick.text.length).toBeGreaterThan(0);
      expect(typeof tick.coord).toBe('number');
      expect(typeof tick.value).toBe('number');
    }
  });

  it('higher rank wins at overlapping boundaries (Jan 1 = YEAR + QUARTER + MONTH)', () => {
    // Use enough bars to span into YEARLY tier (>12 months) where YEAR/QUARTER/MONTH all exist
    const dailyBars = generateDailyBars(Date.UTC(2025, 0, 6, 0, 0, 0), 350);
    const fromTs = dailyBars[0].timestamp;
    const toTs = dailyBars[dailyBars.length - 1].timestamp;

    setAxisResolution('D');
    const result = generateTicks(fromTs, toTs, dailyBars, mockChart(dailyBars, 3), null);

    // Year boundary at Jan 1 2026 should show "2026", not "Jan"
    expect(result.find(t => t.text === '2026')).toBeDefined();
    expect(new Set(result.map(t => t.coord)).size).toBe(result.length);
  });

  it('15min, 2-week span: day numbers, no time-only labels', () => {
    const dataList = generate15mBars(Date.UTC(2026, 2, 9, 22, 0, 0), 800);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('15m');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 0.5), null);

    expect(result.filter(t => /^\d{2}:\d{2}$/.test(t.text)).length).toBe(0);
    expect(result.filter(t => /^\d{1,2}$/.test(t.text) || /^Jan|^Feb|^Mar/.test(t.text)).length).toBeGreaterThanOrEqual(1);
  });
});

// ===========================================================================
// End-of-month coverage
// ===========================================================================
describe('end-of-month coverage', () => {
  it('4H data spanning Jan 25-31: end-of-month day labels', () => {
    const dataList = generate4HBars(Date.UTC(2026, 0, 25, 8, 0, 0), 20);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('4h');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 15), null);

    const dayNumbers = result.filter(t => /^\d{1,2}$/.test(t.text)).map(t => parseInt(t.text, 10));
    expect(dayNumbers.filter(d => d >= 25 && d <= 31).length).toBeGreaterThanOrEqual(1);
  });

  it('daily data for 31-day month: end-of-month days appear', () => {
    const dataList = generateDailyBars(Date.UTC(2026, 2, 1, 0, 0, 0), 50);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('D');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 10), null);

    const dayNumbers = result.map(t => t.text)
      .filter(t => /^\d{1,2}/.test(t))
      .map(t => parseInt(t.match(/^\d{1,2}/)[0], 10));
    expect(dayNumbers.filter(d => d >= 25 && d <= 31).length).toBeGreaterThanOrEqual(2);
  });

  it('month boundary at 31st: no dead zone gap', () => {
    const dataList = generateDailyBars(Date.UTC(2026, 2, 25, 0, 0, 0), 15);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('D');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 10), null);

    expect(result.length).toBeGreaterThanOrEqual(2);
    if (result.length >= 3) {
      const gaps = [];
      for (let i = 1; i < result.length; i++) gaps.push(result[i].coord - result[i - 1].coord);
      expect(Math.max(...gaps)).toBeLessThanOrEqual(5 * Math.min(...gaps));
    }
  });
});

// ===========================================================================
// Regression: scenarios that failed with anchor+fill
// ===========================================================================
describe('anchor+fill regression tests', () => {
  it('B5: 4H multi-month produces boundary + day ticks', () => {
    const dataList = generate4HBars(Date.UTC(2024, 11, 2, 8, 0, 0), 120);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('4h');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 8.9), null);

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    expect(result.filter(t => monthNames.some(m => t.text === m || t.text.startsWith(m + ' '))).length).toBeGreaterThan(0);
    expect(result.filter(t => /^\d{1,2}$/.test(t.text)).length).toBeGreaterThan(0);
  });

  it('B6: 4H multi-week has day fill ticks', () => {
    const dataList = generate4HBars(Date.UTC(2024, 11, 2, 8, 0, 0), 120);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('4h');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 8.9), null);

    expect(result.filter(t => /^\d{1,2}$/.test(t.text)).length).toBeGreaterThan(0);
  });

  it('INTRADAY: sub-day span shows time labels', () => {
    const dataList = generate4HBars(Date.UTC(2025, 0, 6, 8, 0, 0), 4);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('4h');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 15), null);

    expect(result.filter(t => t.text.includes(':')).length).toBeGreaterThan(0);
  });

  it('Daily/3 months: fill ticks between boundaries (no dead zones)', () => {
    const dataList = generateDailyBars(Date.UTC(2025, 5, 2, 0, 0, 0), 80);
    const fromTs = dataList[0].timestamp;
    const toTs = dataList[dataList.length - 1].timestamp;

    setAxisResolution('D');
    const result = generateTicks(fromTs, toTs, dataList, mockChart(dataList, 5), null);

    expect(result.length).toBeGreaterThanOrEqual(4);
    expect(result.filter(t => /^\d{1,2}$/.test(t.text)).length).toBeGreaterThanOrEqual(1);
  });
});
