#!/usr/bin/env node
'use strict';

// Standalone simulation: derived symbol prices from multiple real symbol tick streams.
// No project dependencies required.

// ---------------------------------------------------------------------------
// Parsed-expression format (same shape the real parser produces)
// Each token is either { type: 'operand', value: string } or { type: 'operator', value: string }.
// Operands are symbol names or numeric literals (strings).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DerivedSymbolCalculator
// ---------------------------------------------------------------------------

class DerivedSymbolCalculator {
  /**
   * @param {{ type: 'operand'|'operator', value: string }[]} expression
   * @param {string} humanLabel  e.g. "DE02Y/US02Y"
   */
  constructor(expression, humanLabel) {
    this.expression = expression;
    this.humanLabel = humanLabel;
    this.operands = expression.filter(t => t.type === 'operand').map(t => t.value);
    this.operators = expression.filter(t => t.type === 'operator').map(t => t.value);

    // latest tick per operand: { bid, ask }
    this._ticks = {};
  }

  /**
   * Feed a new tick for a constituent symbol.
   * @param {string} symbol
   * @param {{ bid: number, ask: number }} tick
   */
  onTick(symbol, tick) {
    if (!this.operands.includes(symbol)) return;
    this._ticks[symbol] = tick;
  }

  /** Whether every operand has received at least one tick. */
  get ready() {
    return this.operands.every(op => op in this._ticks);
  }

  /**
   * Compute the derived mid, bid, ask.
   * Returns null when not all operands have data.
   */
  compute() {
    if (!this.ready) return null;

    const mids = this.operands.map(op => {
      const t = this._ticks[op];
      return (t.bid + t.ask) / 2;
    });

    const bids = this.operands.map(op => this._ticks[op].bid);
    const asks = this.operands.map(op => this._ticks[op].ask);

    const derivedMid = this._eval(mids);
    let derivedBid = this._eval(bids);
    let derivedAsk = this._eval(asks);

    // For division operations, bid/ask can invert (e.g., 1/XAUUSD: dividing by a
    // larger ask yields a smaller number, so raw bid > raw ask). Swap to maintain
    // the invariant bid <= ask.
    if (derivedBid > derivedAsk) {
      [derivedBid, derivedAsk] = [derivedAsk, derivedBid];
    }

    return { mid: derivedMid, bid: derivedBid, ask: derivedAsk };
  }

  _eval(values) {
    let acc = values[0];
    for (let i = 0; i < this.operators.length; i++) {
      const rhs = values[i + 1];
      switch (this.operators[i]) {
        case '+': acc += rhs; break;
        case '-': acc -= rhs; break;
        case '*': acc *= rhs; break;
        case '/': acc = rhs !== 0 ? acc / rhs : NaN; break;
        default:  acc = NaN;
      }
    }
    return acc;
  }
}

// ---------------------------------------------------------------------------
// Expression helper — simple string parser
// ---------------------------------------------------------------------------

function parseExpression(str) {
  const tokens = [];
  // Split on operators while keeping them
  const parts = str.split(/(\+|\-|\*|\/)/);
  for (const p of parts) {
    const trimmed = p.trim();
    if (trimmed === '') continue;
    if (/^[+\-*/]$/.test(trimmed)) {
      tokens.push({ type: 'operator', value: trimmed });
    } else {
      tokens.push({ type: 'operand', value: trimmed });
    }
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Tick simulator
// ---------------------------------------------------------------------------

function createTickSimulator(baseSymbols) {
  /**
   * baseSymbols: { [symbol]: { mid, spread } }
   *   mid   — centre price
   *   spread — half-spread in price units
   */
  const state = {};
  for (const [sym, cfg] of Object.entries(baseSymbols)) {
    state[sym] = { mid: cfg.mid, spread: cfg.spread };
  }

  function nextTick(symbol) {
    const s = state[symbol];
    // random walk on mid
    const volatility = s.mid * 0.00005; // 0.005% per tick
    s.mid += (Math.random() - 0.5) * 2 * volatility;
    const halfSpread = s.spread + (Math.random() - 0.5) * s.spread * 0.1;
    return {
      bid: s.mid - halfSpread,
      ask: s.mid + halfSpread,
    };
  }

  return { nextTick };
}

// ---------------------------------------------------------------------------
// Derived symbol definitions
// ---------------------------------------------------------------------------

const derivedDefs = [
  { label: 'DE02Y/US02Y', expr: 'DE02Y/US02Y' },
  { label: '1/XAUUSD',    expr: '1/XAUUSD' },
  { label: 'EURUSD*GBPUSD', expr: 'EURUSD*GBPUSD' },
  { label: 'EURUSD-GBPUSD', expr: 'EURUSD-GBPUSD' },
  { label: '1000*XAUUSD', expr: '1000*XAUUSD' },
  { label: 'DE02Y-US02Y', expr: 'DE02Y-US02Y' },
];

// Constituent symbol base prices
const baseSymbols = {
  EURUSD: { mid: 1.0850, spread: 0.00010 },
  GBPUSD: { mid: 1.2650, spread: 0.00015 },
  XAUUSD: { mid: 2350.00, spread: 0.30 },
  DE02Y:  { mid: 132.50,  spread: 0.02 },
  US02Y:  { mid: 4.30,    spread: 0.005 },
};

// ---------------------------------------------------------------------------
// Main simulation
// ---------------------------------------------------------------------------

function main() {
  const sim = createTickSimulator(baseSymbols);

  // Build calculators
  const calculators = derivedDefs.map(d => {
    const expr = parseExpression(d.expr);
    return new DerivedSymbolCalculator(expr, d.label);
  });

  const allConstituents = [...new Set(
    calculators.flatMap(c => c.operands).filter(o => !/^\d+(\.\d+)?$/.test(o))
  )];

  // Collect constituent symbols that are real (not numeric literals)
  // Numeric literals are handled by the calculator as static operands.
  // For static numeric operands, we seed them as "ticks" with bid===ask===value.
  for (const calc of calculators) {
    for (const op of calc.operands) {
      if (/^\d+(\.\d+)?$/.test(op)) {
        const v = parseFloat(op);
        calc.onTick(op, { bid: v, ask: v });
      }
    }
  }

  const DURATION_MS = 3000;
  const INTERVAL_MS = 100;
  const start = Date.now();
  let tick = 0;

  console.log('='.repeat(72));
  console.log('  Derived Symbol Math — Tick Simulation');
  console.log('='.repeat(72));
  console.log(`  Duration: ${DURATION_MS / 1000}s | Interval: ${INTERVAL_MS}ms`);
  console.log(`  Constituents: ${allConstituents.join(', ')}`);
  console.log(`  Derived symbols: ${derivedDefs.map(d => d.label).join(', ')}`);
  console.log('-'.repeat(72));

  const timer = setInterval(() => {
    const elapsed = Date.now() - start;
    if (elapsed >= DURATION_MS) {
      clearInterval(timer);
      console.log('-'.repeat(72));
      console.log('  Simulation complete.');
      return;
    }

    tick++;
    const pad = String(tick).padStart(3, ' ');

    // Generate ticks for every constituent
    const constituentTicks = {};
    for (const sym of allConstituents) {
      constituentTicks[sym] = sim.nextTick(sym);
    }

    // Feed ticks into calculators
    for (const calc of calculators) {
      for (const sym of allConstituents) {
        if (calc.operands.includes(sym)) {
          calc.onTick(sym, constituentTicks[sym]);
        }
      }
    }

    // Print header every 5 ticks (or first tick)
    if (tick === 1 || tick % 5 === 1) {
      console.log('');
      console.log(
        `${'Tick'.padEnd(6)} ${'Symbol'.padEnd(18)} ${'Mid'.padEnd(16)} ${'Bid'.padEnd(16)} ${'Ask'.padEnd(16)} Spread`
      );
      console.log('-'.repeat(72));
    }

    // Print constituent ticks
    for (const sym of allConstituents) {
      const t = constituentTicks[sym];
      const mid = ((t.bid + t.ask) / 2);
      const spread = t.ask - t.bid;
      console.log(
        `${pad}   ${sym.padEnd(18)} ${mid.toFixed(sym === 'XAUUSD' ? 2 : 4).padEnd(16)} ${t.bid.toFixed(sym === 'XAUUSD' ? 2 : 4).padEnd(16)} ${t.ask.toFixed(sym === 'XAUUSD' ? 2 : 4).padEnd(16)} ${spread.toFixed(sym === 'XAUUSD' ? 2 : 5)}`
      );
    }

    // Print derived ticks
    for (const calc of calculators) {
      const result = calc.compute();
      if (!result) {
        console.log(`${pad}   ${calc.humanLabel.padEnd(18)} ${'waiting...'.padEnd(16)}`);
        continue;
      }
      const spread = result.ask - result.mid !== undefined ? result.ask - result.bid : 0;
      const decimals = result.mid > 100 ? 2 : result.mid > 1 ? 4 : 6;
      console.log(
        `${pad} > ${calc.humanLabel.padEnd(17)} ${result.mid.toFixed(decimals).padEnd(16)} ${result.bid.toFixed(decimals).padEnd(16)} ${result.ask.toFixed(decimals).padEnd(16)} ${spread.toFixed(decimals + 1)}`
      );
    }
  }, INTERVAL_MS);
}

main();
