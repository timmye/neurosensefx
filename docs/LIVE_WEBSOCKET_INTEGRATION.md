# Live WebSocket Integration for Real cTrader Market Data

This document describes the complete implementation of live cTrader WebSocket integration that eliminates all simulated market data and provides 100% visibility into actual data flow performance.

## Overview

The NeuroSense FX platform now uses **exclusively live cTrader WebSocket connections** for all market data. No simulated, mocked, or artificial data is used in any testing or production scenarios.

## Architecture

### Three-Layer Integration

1. **cTrader API Layer** (`services/tick-backend/CTraderSession.js`)
   - Direct connection to cTrader Open API
   - Real-time market data subscription and processing
   - Professional-grade price calculation with proper precision

2. **WebSocket Server Layer** (`services/tick-backend/WebSocketServer.js`)
   - Broadcasts live market data to frontend clients
   - Manages client subscriptions and connection lifecycle
   - Provides status updates and error handling

3. **Frontend Client Layer** (`src/data/wsClient.js`)
   - Establishes and maintains WebSocket connections
   - Handles symbol subscriptions and data processing
   - Provides real-time updates to visualization components

## Key Components

### 1. WebSocket Test Utilities (`tests/utils/websocket-test-utils.js`)

Comprehensive testing framework for live WebSocket connections:

```javascript
import { WebSocketTestUtils } from '../tests/utils/websocket-test-utils.js';

const wsUtils = new WebSocketTestUtils();
const connection = await wsUtils.connectToLiveBackend('test-name');
const subscription = await connection.subscribe('EUR/USD');
const realTimeData = await wsUtils.monitorRealTimeData(connection, 'EUR/USD', 30000);
```

**Features:**
- Real connection validation with performance metrics
- Live market data monitoring with latency tracking
- Connection reliability testing under various conditions
- High-load performance validation
- Comprehensive error scenario testing

### 2. Market Data Validator (`tests/utils/market-data-validator.js`)

Real-time market data validation system:

```javascript
import { MarketDataValidator } from '../tests/utils/market-data-validator.js';

const validator = new MarketDataValidator();
const validation = validator.validateRealTimeTick(tickData);
const packageValidation = validator.validateDataPackage(dataPackage);
```

**Validation Criteria:**
- Data freshness (within 10 seconds for real-time)
- Price integrity (positive numbers, valid spreads)
- Market condition detection (volatility, liquidity issues)
- Timestamp accuracy and consistency
- Professional trading standards compliance

### 3. Live Trader Test Runner (`tests/utils/live-trader-test-runner.js`)

Orchestrates complete live trading validation:

```javascript
import LiveTraderTestRunner from '../tests/utils/live-trader-test-runner.js';

const runner = new LiveTraderTestRunner();
const results = await runner.runCompleteTestSuite();
runner.printResults();
```

**Test Categories:**
- WebSocket connectivity validation
- Real market data validation
- Performance benchmarking
- Connection reliability testing

## Enhanced E2E Tests

### Complete Trader Workflow (`e2e/complete-trader-workflow.spec.js`)

Updated to use live EUR/USD data instead of simulated ETH/USD:

**Test Flow:**
1. Verify WebSocket connection establishment
2. Test keyboard shortcut responsiveness (Ctrl+K)
3. Search and subscribe to real FX symbols (EUR/USD, GBP/USD, USD/JPY)
4. Validate canvas display creation with live data
5. Monitor real-time market data delivery for 30 seconds
6. Validate data quality, latency, and freshness
7. Test professional trading requirements compliance

**Live Data Validation:**
- Monitors actual WebSocket messages for tick data
- Validates bid/ask spreads and price movements
- Measures data-to-visual latency
- Checks data freshness and accuracy
- Verifies professional trading performance standards

## Usage

### Development Environment

1. **Start Backend Services:**
   ```bash
   ./run.sh start  # Starts both frontend and backend with live cTrader
   ```

2. **Run Live Trading Validation:**
   ```bash
   npm run test:live-trading  # Complete integration test
   npm run test:live:e2e      # Browser E2E tests with live data
   npm run test:complete-workflow  # Both tests combined
   ```

3. **Manual Testing:**
   - Open browser to `http://localhost:5174`
   - Press `Ctrl+K` to open symbol palette
   - Search for real FX symbols (EUR/USD, GBP/USD, etc.)
   - Observe live market data updates in real-time

### Production Environment

1. **Deploy with Live Data:**
   ```bash
   npm run build:prod
   ./run.sh start --production
   ```

2. **Validate Production Setup:**
   ```bash
   npm run test:live-trading  # Validates production cTrader connection
   ```

## Performance Requirements

### Professional Trading Standards

The system validates against these professional trading requirements:

- **Keyboard Latency:** Under 310ms response time
- **Data-to-Visual Latency:** Under 100ms from market data to visual display
- **Rendering Performance:** 60fps sustained during volatile markets
- **Data Freshness:** Real-time data under 10 seconds old
- **Connection Reliability:** 99%+ uptime during trading hours
- **Data Quality:** 90%+ valid data points with proper bid/ask spreads

### Validation Metrics

The testing framework measures:

- **Connection Time:** Time to establish WebSocket connection
- **Subscription Latency:** Time from symbol request to first data
- **Tick Latency:** Time from market data generation to receipt
- **Data Rate:** Number of data points per second
- **Error Rate:** Percentage of invalid or failed data points
- **Connection Stability:** Uptime percentage and reconnection success

## Troubleshooting

### Common Issues

1. **No Live Data Received:**
   - Check if cTrader backend is running: `./run.sh status`
   - Verify cTrader API credentials in `.env` file
   - Confirm market is open (not weekend/holiday)
   - Check network connectivity to cTrader servers

2. **High Latency:**
   - Monitor network connection quality
   - Check server load and performance
   - Verify WebSocket connection stability
   - Review cTrader API rate limits

3. **Connection Drops:**
   - Validate internet connection stability
   - Check WebSocket server health
   - Review reconnection logic in wsClient.js
   - Monitor cTrader API service status

### Debug Commands

```bash
# Check service status
./run.sh status

# View backend logs
./run.sh logs

# Test WebSocket connection manually
wscat -c ws://localhost:8080

# Run comprehensive validation
npm run test:live-trading

# Run specific E2E test
npm run test:live:e2e
```

## Configuration

### Environment Variables

```bash
# cTrader API Configuration
HOST=live.ctraderapi.com
PORT=5035
CTRADER_CLIENT_ID=your_client_id
CTRADER_CLIENT_SECRET=your_client_secret
CTRADER_ACCOUNT_ID=your_account_id
CTRADER_ACCESS_TOKEN=your_access_token

# WebSocket Configuration
VITE_BACKEND_URL=ws://localhost:8080  # Development
VITE_BACKEND_URL=ws://localhost:8081  # Production
```

### Real-World Symbols

The system supports these real FX symbols from cTrader:

**Major Pairs:**
- EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CHF

**Cross Pairs:**
- EUR/GBP, EUR/JPY, GBP/JPY, USD/CAD, NZD/USD

**Additional Pairs:**
- EUR/CHF, EUR/AUD, GBP/CHF, AUD/JPY, CAD/JPY

## Future Enhancements

### Planned Features

1. **Additional Asset Classes:**
   - Commodities (Gold, Silver, Oil)
   - Cryptocurrencies (BTC/USD, ETH/USD)
   - Stock Indices (S&P 500, FTSE 100)

2. **Advanced Analytics:**
   - Real-time spread analysis
   - Volume profile integration
   - Market sentiment indicators

3. **Enhanced Performance:**
   - WebSocket compression
   - Data deduplication
   - Predictive caching

### Testing Improvements

1. **Market Condition Simulation:**
   - High volatility period testing
   - Low liquidity scenario validation
   - Market open/close transition testing

2. **Stress Testing:**
   - Extended session validation (24+ hours)
   - Maximum concurrent connection testing
   - Network interruption recovery

## Conclusion

The live WebSocket integration provides a robust, production-ready foundation for real-time forex market data visualization. All components are designed to meet professional trading standards with comprehensive validation and monitoring capabilities.

The system eliminates all simulated data, ensuring complete visibility into actual market data flow performance and reliability. This provides confidence for production deployment and professional trading applications.