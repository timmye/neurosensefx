/**
 * Diagnostic test: exercises generateTicks with realistic data for EVERY major scenario.
 * Dumps the FULL label sequence output so we can see exactly what the chart displays.
 *
 * TEMPORARY FILE — TO BE DELETED AFTER ANALYSIS
 */
import { describe, it, expect } from 'vitest';
import {
  generateTicks,
  setAxisResolution,
} from '../xAxisCustom.js';

// ---------------------------------------------------------------------------
// Test helpers (copied from xAxisCustom.test.js)
// ---------------------------------------------------------------------------

function generate4HBars(startMs, barCount) {
  const bars = [];
  let ts = startMs;
  const FOUR_HOURS = 14_400_000;
  while (bars.length < barCount) {
    const d = new Date(ts);
    const dow = d.getUTCDay();
    const hour = d.getUTCHours();
    if (dow === 0 || dow === 6) {
      ts += FOUR_HOURS;
      continue;
    }
    if (hour === 8 || hour === 20) {
      bars.push({ timestamp: ts });
    }
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
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      bars.push({ timestamp: ts });
    }
    ts += ONE_HOUR;
  }
  return bars;
}

function generateForexBars(startMs, barCount, intervalMs) {
  const bars = [];
  let ts = startMs;
  while (bars.length < barCount) {
    const d = new Date(ts);
    const dow = d.getUTCDay();
    const hour = d.getUTCHours();
    if (dow === 6) { ts += intervalMs; continue; }
    if (dow === 5 && hour >= 22) { ts += intervalMs; continue; }
    if (dow === 0 && hour < 22) { ts += intervalMs; continue; }
    bars.push({ timestamp: ts });
    ts += intervalMs;
  }
  return bars;
}

function generate1mBars(startMs, barCount) {
  return generateForexBars(startMs, barCount, 60_000);
}

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

function generate5mBars(startMs, barCount) {
  return generateForexBars(startMs, barCount, 300_000);
}

function generate15mBars(startMs, barCount) {
  return generateForexBars(startMs, barCount, 900_000);
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

// ---------------------------------------------------------------------------
// Diagnostic scenarios
// ---------------------------------------------------------------------------

describe('DIAGNOSTIC: Full label sequence output for all scenarios', () => {
  const MS_PER_DAY = 86_400_000;

  function runScenario(name, resolution, barGenerator, startMs, barCount, pxPerBar) {
    it(name, () => {
      const dataList = barGenerator(startMs, barCount);
      const fromTs = dataList[0].timestamp;
      const toTs = dataList[dataList.length - 1].timestamp;
      const chart = mockChart(dataList, pxPerBar);
      setAxisResolution(resolution);

      const spanDays = Math.round((toTs - fromTs) / MS_PER_DAY);
      const tier = (toTs - fromTs) <= 2 * MS_PER_DAY ? 'INTRADAY' : 'MULTIDAY';

      const result = generateTicks(fromTs, toTs, dataList, chart, null);

      console.log('');
      console.log(`=== SCENARIO: ${name} ===`);
      console.log(`Resolution: ${resolution}, Span: ${spanDays} days, Tier: ${tier}`);
      console.log(`Data bars: ${dataList.length}, fromTs: ${new Date(fromTs).toISOString()}, toTs: ${new Date(toTs).toISOString()}`);
      console.log(`pxPerBar: ${pxPerBar}, chartWidth (approx): ${(dataList.length * pxPerBar).toFixed(0)}px`);
      console.log(`Total ticks: ${result.length}`);
      console.log(`Full label sequence:`);

      for (let i = 0; i < result.length; i++) {
        const tick = result[i];
        const dateStr = new Date(tick.value).toISOString();
        console.log(`  [${i}] text="${tick.text}" coord=${tick.coord.toFixed(1)} value=${tick.value} (${dateStr})`);
      }

      // Compute gaps for analysis
      if (result.length >= 2) {
        const gaps = [];
        for (let i = 1; i < result.length; i++) {
          gaps.push(result[i].coord - result[i - 1].coord);
        }
        const minGap = Math.min(...gaps);
        const maxGap = Math.max(...gaps);
        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const medianGap = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
        console.log(`Gap analysis: min=${minGap.toFixed(1)}px max=${maxGap.toFixed(1)}px avg=${avgGap.toFixed(1)}px median=${medianGap.toFixed(1)}px`);

        // Flag large gaps (> 3x median)
        for (let i = 1; i < result.length; i++) {
          const gap = result[i].coord - result[i - 1].coord;
          if (gap > 3 * medianGap) {
            console.log(`  ** LARGE GAP at [${i}]: ${gap.toFixed(1)}px (${(gap / medianGap).toFixed(1)}x median) between "${result[i - 1].text}" and "${result[i].text}"`);
          }
        }
      }

      // Basic sanity: result should exist and be sorted
      expect(Array.isArray(result)).toBe(true);
      for (let i = 1; i < result.length; i++) {
        expect(result[i].coord).toBeGreaterThanOrEqual(result[i - 1].coord);
      }
    });
  }

  // Scenario 1: 4H chart, 3-month span (Dec 2024 - Feb 2025) — most common view
  runScenario(
    '4H, 3-month span (Dec 2024 - Feb 2025)',
    '4h',
    generate4HBars,
    Date.UTC(2024, 11, 2, 8, 0, 0), // Mon Dec 2 2024
    200,
    8.9,
  );

  // Scenario 2: 4H chart, 1-week span — zoomed in
  runScenario(
    '4H, 1-week span (zoomed in)',
    '4h',
    generate4HBars,
    Date.UTC(2025, 0, 6, 8, 0, 0), // Mon Jan 6 2025
    20,
    8.9,
  );

  // Scenario 3: 4H chart, 6-month span — zoomed out
  runScenario(
    '4H, 6-month span (zoomed out)',
    '4h',
    generate4HBars,
    Date.UTC(2024, 6, 1, 8, 0, 0), // Mon Jul 1 2024
    400,
    8.9,
  );

  // Scenario 4: 1H chart, 2-week span
  runScenario(
    '1H, 2-week span',
    '1h',
    generate1HBars,
    Date.UTC(2026, 2, 9, 0, 0, 0), // Mon Mar 9 2026
    200,
    5,
  );

  // Scenario 5: 1H chart, 3-day span (INTRADAY)
  runScenario(
    '1H, 3-day span (INTRADAY)',
    '1h',
    generate1HBars,
    Date.UTC(2026, 2, 9, 0, 0, 0), // Mon Mar 9 2026
    50,
    15,
  );

  // Scenario 6: Daily chart, 3-month span
  runScenario(
    'Daily, 3-month span',
    'D',
    generateDailyBars,
    Date.UTC(2025, 9, 1, 0, 0, 0), // Wed Oct 1 2025
    90,
    10,
  );

  // Scenario 7: Daily chart, 1-year span
  runScenario(
    'Daily, 1-year span',
    'D',
    generateDailyBars,
    Date.UTC(2025, 3, 1, 0, 0, 0), // Tue Apr 1 2025
    260,
    3,
  );

  // Scenario 8: 5min chart, 1-day span (INTRADAY)
  runScenario(
    '5min, 1-day span (INTRADAY)',
    '5m',
    generate5mBars,
    Date.UTC(2026, 2, 9, 22, 0, 0), // Sun Mar 9 2026 22:00 (forex open)
    500,
    0.5,
  );

  // Scenario 9: 5min chart, 1-week span (MULTIDAY)
  runScenario(
    '5min, 1-week span (MULTIDAY)',
    '5m',
    generate5mBars,
    Date.UTC(2026, 2, 9, 22, 0, 0), // Sun Mar 9 2026 22:00
    3000,
    0.3,
  );

  // Scenario 10: 15min chart, 1-week span (MULTIDAY)
  runScenario(
    '15min, 1-week span (MULTIDAY)',
    '15m',
    generate15mBars,
    Date.UTC(2026, 2, 9, 22, 0, 0), // Sun Mar 9 2026 22:00
    1000,
    1.5,
  );

  // Scenario 11: 4H chart, year boundary (Dec 2025 - Jan 2026)
  runScenario(
    '4H, year boundary (Dec 2025 - Jan 2026)',
    '4h',
    generate4HBars,
    Date.UTC(2025, 11, 1, 8, 0, 0), // Mon Dec 1 2025
    200,
    8.9,
  );

  // Scenario 12: 4H chart, quarter boundary (Mar-Apr 2026)
  runScenario(
    '4H, quarter boundary (Mar-Apr 2026)',
    '4h',
    generate4HBars,
    Date.UTC(2026, 2, 1, 8, 0, 0), // Sun Mar 1 2026 (next bar Mon Mar 2)
    200,
    8.9,
  );

  // Scenario 13: Daily chart, month-end (Mar 25 - Apr 5 2026) — the dead zone
  runScenario(
    'Daily, month-end (Mar 25 - Apr 5 2026)',
    'D',
    generateDailyBars,
    Date.UTC(2026, 2, 25, 0, 0, 0), // Wed Mar 25 2026
    15,
    10,
  );
});
