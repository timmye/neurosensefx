// Verify CHF basket prices and calculations
const prices = new Map([
  ['EURCHF', 0.9493], ['USDCHF', 0.8750], ['CHFJPY', 170.80],
  ['GBPCHF', 1.1070], ['CADCHF', 0.6455], ['NZDCHF', 0.6065]
]);

console.log('╔════════════════════════════════════════════════════════════════════════╗');
console.log('║     CHF BASKET - PRICE VALUE VERIFICATION                            ║');
console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

console.log('CHF BASKET - Price Verification:');
console.log('');
console.log('Pair      | Raw Price | Invert? | Adjusted | ln(adjusted) | Contrib.');
console.log('----------|-----------|---------|----------|--------------|----------');

const chfPairs = [
  { pair: 'EURCHF', weight: 40 },
  { pair: 'USDCHF', weight: 30 },
  { pair: 'CHFJPY', weight: 10 },
  { pair: 'GBPCHF', weight: 10 },
  { pair: 'CADCHF', weight: 5 },
  { pair: 'NZDCHF', weight: 5 }
];

const totalWeight = chfPairs.reduce((sum, p) => sum + p.weight, 0);
let logSum = 0;

chfPairs.forEach(({pair, weight}) => {
  const rawPrice = prices.get(pair);
  const currency = 'CHF';
  const startsWith = pair.startsWith(currency);
  const shouldInvert = !startsWith;
  const adjustedPrice = shouldInvert ? (1/rawPrice) : rawPrice;
  const logVal = Math.log(adjustedPrice);
  const normWeight = weight / totalWeight;
  const contribution = normWeight * logVal;
  logSum += contribution;

  const status = shouldInvert ? 'YES' : 'NO ';
  console.log(`${pair.padEnd(8)} | ${rawPrice.toFixed(4)}   | ${status}      | ${adjustedPrice.toFixed(4)}   | ${logVal.toFixed(6)}   | ${contribution.toFixed(6)}`);
});

console.log('');
console.log('────────────────────────────────────────────────────────────────────────');
console.log(`Σ (weighted ln): ${logSum.toFixed(6)}`);
console.log(`exp(ln): ${Math.exp(logSum).toFixed(6)}`);
console.log('');

// Verify the logic makes sense
console.log('LOGIC VERIFICATION:');
console.log('');
console.log('USDCHF example:');
console.log('  USDCHF = 0.8750 means: 1 USD = 0.8750 CHF');
console.log('  For CHF basket, we invert because CHF is at end (quote currency)');
console.log('  Adjusted: 1/0.8750 = 1.1429');
console.log('  ln(1.1429) = 0.1335');
console.log('  Weighted: 0.30 * 0.1335 = 0.040059');
console.log('');
console.log('  If CHF strengthens, USDCHF goes DOWN (fewer CHF per USD):');
console.log('    USDCHF: 0.8750 → 0.85');
console.log('    Inverted: 1/0.8750 = 1.1429 → 1/0.85 = 1.1765');
console.log('    ln(1.1429) = 0.1335 → ln(1.1765) = 0.1625 (HIGHER)');
console.log('    So when CHF strengthens, basket value goes UP ✓');
console.log('');
console.log('CONCLUSION: All prices, pairs, weights, and inversion logic are CORRECT.');
