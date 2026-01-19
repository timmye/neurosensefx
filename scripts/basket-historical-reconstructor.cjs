#!/usr/bin/env node

/**
 * FX Basket Historical Reconstructor
 *
 * Standalone CLI tool to reconstruct historical basket values from cTrader D1 bars.
 * Outputs empirical daily ranges and statistics for all 8 currency baskets.
 *
 * Usage:
 *   node scripts/basket-historical-reconstructor.js --days 90
 *   node scripts/basket-historical-reconstructor.js --days 90 --output data/results.json
 *
 * Output:
 *   JSON file with daily basket values and statistical analysis
 */

const path = require('path');
const fs = require('fs');

// Dependencies are in services/tick-backend/node_modules
const dotenv = require(path.resolve(__dirname, '../services/tick-backend/node_modules/dotenv'));
const moment = require(path.resolve(__dirname, '../services/tick-backend/node_modules/moment'));

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Import cTrader connection (CommonJS)
const { CTraderConnection } = require('../libs/cTrader-Layer/build/entry/node/main');

// Basket definitions - duplicated here for standalone operation
const BASKET_DEFINITIONS = {
  'USD': { pairs: ['EURUSD', 'USDJPY', 'GBPUSD', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD'], weights: [20, 15, 13, 10, 30, 7, 5] },
  'EUR': { pairs: ['EURUSD', 'EURJPY', 'EURGBP', 'EURAUD', 'EURCHF', 'EURCAD', 'EURNZD'], weights: [25, 15, 20, 10, 15, 10, 5] },
  'JPY': { pairs: ['EURJPY', 'USDJPY', 'GBPJPY', 'AUDJPY', 'CADJPY', 'CHFJPY', 'NZDJPY'], weights: [25, 30, 15, 10, 10, 5, 5] },
  'GBP': { pairs: ['EURGBP', 'GBPUSD', 'GBPJPY', 'GBPAUD', 'GBPCAD', 'GBPCHF', 'GBPNZD'], weights: [35, 30, 10, 8, 8, 5, 4] },
  'AUD': { pairs: ['EURAUD', 'AUDUSD', 'AUDJPY', 'GBPAUD', 'AUDCAD', 'AUDCHF', 'AUDNZD'], weights: [20, 25, 20, 10, 10, 5, 10] },
  'CAD': { pairs: ['EURCAD', 'USDCAD', 'CADJPY', 'GBPCAD', 'AUDCAD', 'CADCHF', 'NZDCAD'], weights: [15, 40, 10, 10, 10, 8, 7] },
  'CHF': { pairs: ['EURCHF', 'USDCHF', 'CHFJPY', 'GBPCHF', 'CADCHF', 'AUDCHF', 'NZDCHF'], weights: [30, 35, 16, 8, 5, 4, 2] },
  'NZD': { pairs: ['EURNZD', 'NZDUSD', 'NZDJPY', 'GBPNZD', 'NZDCAD', 'NZDCHF', 'AUDNZD'], weights: [15, 25, 15, 10, 10, 5, 20] },
};

// Get all unique pairs from all basket definitions
function getAllPairs() {
  const pairSet = new Set();
  for (const basket of Object.values(BASKET_DEFINITIONS)) {
    basket.pairs.forEach(pair => pairSet.add(pair));
  }
  return Array.from(pairSet);
}

// Calculate price from raw cTrader value
function calculatePrice(rawValue, digits) {
  if (typeof rawValue !== 'number') return 0;
  const price = rawValue / 100000.0;
  return Number(price.toFixed(digits));
}

// Calculate ln-weighted basket value
function calculateBasketValue(currency, priceMap, digitsMap) {
  const basket = BASKET_DEFINITIONS[currency];
  if (!basket) return null;

  let logSum = 0;
  let availableWeight = 0;
  const totalWeight = basket.weights.reduce((a, b) => a + b, 0);

  for (let i = 0; i < basket.pairs.length; i++) {
    const pair = basket.pairs[i];
    const price = priceMap.get(pair);
    if (!price) continue;

    const adjustedPrice = pair.startsWith(currency) ? price : (1 / price);
    const normalizedWeight = basket.weights[i] / totalWeight;
    const logValue = Math.log(adjustedPrice);
    logSum += normalizedWeight * logValue;
    availableWeight += basket.weights[i];
  }

  const coverage = availableWeight / totalWeight;
  if (coverage < 1.0) return null;

  return logSum;
}

// Normalize to 100 baseline
function normalizeToBaseline(currentLog, baselineLog) {
  if (baselineLog === null || currentLog === null) return null;
  return (Math.exp(currentLog) / Math.exp(baselineLog)) * 100;
}

// Calculate statistics from array of numbers
function calculateStatistics(values) {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / n;

  // Median
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  // Percentiles
  const p95Index = Math.min(Math.floor(n * 0.95), n - 1);
  const p5Index = Math.min(Math.floor(n * 0.05), n - 1);

  // Standard deviation
  const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
  const stddev = Math.sqrt(variance);

  return {
    median,
    mean,
    min: sorted[0],
    max: sorted[n - 1],
    p5: sorted[p5Index],
    p95: sorted[p95Index],
    stddev,
    count: n
  };
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    days: 90,
    output: path.join(__dirname, '../data/fx-basket-historical-analysis.json')
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) {
      config.days = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      config.output = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
FX Basket Historical Reconstructor

Usage:
  node basket-historical-reconstructor.js [options]

Options:
  --days <n>       Number of days to analyze (default: 90, max: 365)
  --output <path>  Output JSON file path (default: ../data/fx-basket-historical-analysis.json)
  --help, -h       Show this help message

Example:
  node basket-historical-reconstructor.js --days 90
      `);
      process.exit(0);
    }
  }

  if (config.days < 1 || config.days > 365) {
    console.error('Error: days must be between 1 and 365');
    process.exit(1);
  }

  return config;
}

// Main reconstruction function
async function reconstructHistoricalBaskets(config) {
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║  FX Basket Historical Reconstructor                              ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝`);
  console.log(`\nConfiguration:`);
  console.log(`  Days to analyze: ${config.days}`);
  console.log(`  Output file: ${config.output}`);

  // Validate environment variables
  const requiredEnvVars = ['CTRADER_CLIENT_ID', 'CTRADER_CLIENT_SECRET', 'CTRADER_ACCESS_TOKEN', 'CTRADER_ACCOUNT_ID', 'HOST', 'PORT'];
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingVars.length > 0) {
    console.error(`\n❌ Error: Missing required environment variables: ${missingVars.join(', ')}`);
    console.error(`Please set up your .env file with cTrader credentials.\n`);
    process.exit(1);
  }

  // Create connection
  console.log(`\n📡 Connecting to cTrader API...`);
  const connection = new CTraderConnection({
    host: process.env.HOST,
    port: Number(process.env.PORT),
  });

  let symbolMap = new Map();
  let symbolInfoCache = new Map();

  try {
    await connection.open();
    console.log(`   ✅ Connected`);

    // Authenticate
    console.log(`\n🔐 Authenticating...`);
    await connection.sendCommand('ProtoOAApplicationAuthReq', {
      clientId: process.env.CTRADER_CLIENT_ID,
      clientSecret: process.env.CTRADER_CLIENT_SECRET
    });
    await connection.sendCommand('ProtoOAAccountAuthReq', {
      ctidTraderAccountId: Number(process.env.CTRADER_ACCOUNT_ID),
      accessToken: process.env.CTRADER_ACCESS_TOKEN
    });
    console.log(`   ✅ Authenticated`);

    // Load symbols
    console.log(`\n📊 Loading symbol list...`);
    const symbolsResponse = await connection.sendCommand('ProtoOASymbolsListReq', {
      ctidTraderAccountId: Number(process.env.CTRADER_ACCOUNT_ID)
    });

    symbolsResponse.symbol.forEach(s => {
      symbolMap.set(s.symbolName, Number(s.symbolId));
    });
    console.log(`   ✅ Loaded ${symbolMap.size} symbols`);

    // Get symbol info for digits
    console.log(`\n🔍 Fetching symbol metadata for FX pairs...`);
    const allPairs = getAllPairs();
    const digitsMap = new Map();

    for (const pair of allPairs) {
      const symbolId = symbolMap.get(pair);
      if (!symbolId) {
        console.warn(`   ⚠️  Symbol not found: ${pair}`);
        continue;
      }

      const symbolResponse = await connection.sendCommand('ProtoOASymbolByIdReq', {
        ctidTraderAccountId: Number(process.env.CTRADER_ACCOUNT_ID),
        symbolId: [symbolId]
      });

      if (symbolResponse.symbol && symbolResponse.symbol.length > 0) {
        const info = symbolResponse.symbol[0];
        digitsMap.set(pair, Number(info.digits));
      }
    }
    console.log(`   ✅ Fetched metadata for ${digitsMap.size} pairs`);

    // Fetch historical D1 bars
    console.log(`\n📈 Fetching historical D1 bars...`);
    const to = moment.utc().valueOf();
    const from = moment.utc().subtract(config.days + 5, 'days').valueOf();

    const historicalData = {}; // { pair: { date: { open, high, low, close } } }

    for (let i = 0; i < allPairs.length; i++) {
      const pair = allPairs[i];
      const symbolId = symbolMap.get(pair);
      if (!symbolId) continue;

      process.stdout.write(`\r   Fetching ${i + 1}/${allPairs.length}: ${pair.padEnd(8)} `);

      const barsResponse = await connection.sendCommand('ProtoOAGetTrendbarsReq', {
        ctidTraderAccountId: Number(process.env.CTRADER_ACCOUNT_ID),
        symbolId,
        period: 'D1',
        fromTimestamp: from,
        toTimestamp: to
      });

      if (barsResponse.trendbar && barsResponse.trendbar.length > 0) {
        const digits = digitsMap.get(pair) || 5;
        historicalData[pair] = {};

        barsResponse.trendbar.forEach(bar => {
          const date = moment.utc(Number(bar.utcTimestampInMinutes) * 60 * 1000).format('YYYY-MM-DD');
          const low = calculatePrice(Number(bar.low), digits);
          const open = calculatePrice(Number(bar.low) + Number(bar.deltaOpen), digits);
          const high = calculatePrice(Number(bar.low) + Number(bar.deltaHigh), digits);
          const close = calculatePrice(Number(bar.low) + Number(bar.deltaClose), digits);

          historicalData[pair][date] = { open, high, low, close };
        });
      }
    }
    console.log(`\n   ✅ Fetched D1 bars for all pairs`);

    // Close connection - CTraderConnection doesn't have explicit close, just let it exit
    if (connection && typeof connection.close === 'function') {
      connection.close();
    } else if (connection && typeof connection.disconnect === 'function') {
      connection.disconnect();
    }
    console.log(`\n🔌 Disconnected from cTrader API`);

    // Reconstruct basket values per day
    console.log(`\n🧮 Reconstructing basket values...`);

    // Find all dates
    const dates = new Set();
    Object.values(historicalData).forEach(pairData => {
      Object.keys(pairData).forEach(date => dates.add(date));
    });
    const sortedDates = Array.from(dates).sort();

    console.log(`   Found ${sortedDates.length} trading days`);

    const basketData = {}; // { currency: [ { date, open, high, low, close, range } ] }

    for (const currency of Object.keys(BASKET_DEFINITIONS)) {
      process.stdout.write(`\r   Processing ${currency.padEnd(4)} `);

      const dailyValues = [];

      for (const date of sortedDates) {
        // Build price map for this date
        const openMap = new Map();
        const closeMap = new Map();

        const basket = BASKET_DEFINITIONS[currency];
        let allPairsAvailable = true;

        for (const pair of basket.pairs) {
          if (!historicalData[pair] || !historicalData[pair][date]) {
            allPairsAvailable = false;
            break;
          }
          openMap.set(pair, historicalData[pair][date].open);
          closeMap.set(pair, historicalData[pair][date].close);
        }

        if (!allPairsAvailable) continue;

        // Calculate basket log values (open and close only for accurate range)
        const openLog = calculateBasketValue(currency, openMap, digitsMap);
        const closeLog = calculateBasketValue(currency, closeMap, digitsMap);

        if (openLog === null || closeLog === null) continue;

        // Normalize to first open as baseline
        const normalizedOpen = normalizeToBaseline(openLog, openLog);
        const normalizedClose = normalizeToBaseline(closeLog, openLog);

        // Daily range = absolute change from open to close
        // Note: Using high/low from individual pairs doesn't work for baskets
        // because pairs move in opposite directions and cancel out
        const range = Math.abs(normalizedClose - normalizedOpen);

        dailyValues.push({
          date,
          open: normalizedOpen,
          close: normalizedClose,
          change: normalizedClose - normalizedOpen,
          range
        });
      }

      basketData[currency] = dailyValues;
    }

    console.log(`\n   ✅ Reconstructed all baskets`);

    // Calculate statistics
    console.log(`\n📊 Computing statistics...`);

    const result = {
      collectionPeriod: {
        start: sortedDates[0],
        end: sortedDates[sortedDates.length - 1],
        days: sortedDates.length
      },
      baskets: {}
    };

    for (const currency of Object.keys(BASKET_DEFINITIONS)) {
      const dailyValues = basketData[currency];
      const ranges = dailyValues.map(v => v.range);

      result.baskets[currency] = {
        dailyRanges: ranges,
        statistics: calculateStatistics(ranges),
        dailyValues: dailyValues
      };

      console.log(`   ${currency}: median = ${result.baskets[currency].statistics.median.toFixed(2)}%, ` +
                  `p95 = ${result.baskets[currency].statistics.p95.toFixed(2)}%`);
    }

    // Write output
    console.log(`\n💾 Writing results to ${config.output}`);

    // Ensure output directory exists
    const outputDir = path.dirname(config.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(config.output, JSON.stringify(result, null, 2));

    console.log(`   ✅ Results saved`);

    // Summary
    console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
    console.log(`║  Analysis Complete                                                ║`);
    console.log(`╚════════════════════════════════════════════════════════════════╝`);
    console.log(`\nSummary of Findings:\n`);

    for (const currency of Object.keys(BASKET_DEFINITIONS)) {
      const stats = result.baskets[currency].statistics;
      console.log(`  ${currency}:`);
      console.log(`    Typical day (median):     ${stats.median.toFixed(3)}%`);
      console.log(`    Extreme threshold (p95):  ${stats.p95.toFixed(3)}%`);
      console.log(`    Max observed:            ${stats.max.toFixed(3)}%`);
      console.log(`    Min observed:            ${stats.min.toFixed(3)}%`);
    }

    console.log(`\n✅ Historical reconstruction complete!\n`);

    return result;

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    if (connection) {
      try {
        if (typeof connection.close === 'function') {
          connection.close();
        } else if (typeof connection.disconnect === 'function') {
          connection.disconnect();
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  const config = parseArgs();
  reconstructHistoricalBaskets(config);
}

module.exports = { reconstructHistoricalBaskets, calculateStatistics };
