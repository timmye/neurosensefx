# NeuroSense FX E2E Testing with Playwright

This directory contains end-to-end tests for the NeuroSense FX financial trading visualization platform, configured for VSCode container environments with specialized browser agents for financial application testing.

## Test Structure

```
tests/
├── e2e/                          # E2E test specifications
│   ├── basic-load.spec.js        # Basic application loading tests
│   ├── canvas-rendering.spec.js  # Canvas rendering performance tests
│   ├── user-interactions.spec.js # User interaction tests
│   └── performance.spec.js       # Performance benchmarking tests
├── helpers/                      # Test utilities and fixtures
│   ├── browser-agents.js         # Container-aware browser agents
│   ├── fixtures.js              # Test data and configurations
│   └── logger.js                # Enhanced logging system
├── fixtures/                     # Static test fixtures (if needed)
├── global-setup.js              # Global test setup
├── global-teardown.js           # Global test cleanup
└── README.md                    # This file
```

## Available Test Scripts

### Basic Test Execution
```bash
npm run test:e2e                 # Run all E2E tests
npm run test:e2e:basic          # Run basic loading tests only
npm run test:e2e:canvas         # Run canvas rendering tests only
npm run test:e2e:interactions   # Run user interaction tests only
npm run test:e2e:performance    # Run performance tests only
```

### Browser-Specific Testing
```bash
npm run test:e2e:chrome         # Run tests on Chrome/Chromium
npm run test:e2e:firefox        # Run tests on Firefox
npm run test:e2e:safari         # Run tests on Safari/WebKit
npm run test:e2e:mobile         # Run tests on mobile viewport
```

### Development and Debugging
```bash
npm run test:e2e:headed         # Run tests with visible browser
npm run test:e2e:debug          # Run tests in debug mode
npm run test:e2e:ui             # Run tests with Playwright UI
npm run test:e2e:codegen        # Generate test code with recorder
```

### Reporting and Results
```bash
npm run test:e2e:report         # View HTML test report
npm run test:e2e:install        # Install browser dependencies
```

## Container-Aware Features

The test suite is specifically configured for VSCode container environments:

### Browser Agent Management
- **Chrome/Chromium**: Optimized for container environments with sandbox disabled
- **Firefox**: Configured for reliable operation in headless mode
- **Safari/WebKit**: Cross-platform testing capabilities
- **Mobile**: Responsive design testing with touch simulation

### Performance Monitoring
- **FPS Tracking**: Real-time frame rate monitoring
- **Memory Usage**: JavaScript heap size tracking
- **Network Latency**: WebSocket and HTTP request timing
- **Render Performance**: Canvas drawing performance metrics

### Financial Application Testing
- **Market Data Simulation**: Mock data generators for testing
- **WebSocket Monitoring**: Connection and message tracking
- **Canvas Rendering**: DPR-aware text rendering verification
- **User Interactions**: Mouse, keyboard, and touch event testing

## Test Categories

### 1. Basic Load Tests (`basic-load.spec.js`)
- Application loads without errors
- Canvas elements initialize correctly
- WebSocket connections establish
- Responsive design works across viewports

### 2. Canvas Rendering Tests (`canvas-rendering.spec.js`)
- Market profile rendering verification
- Performance benchmarking
- DPR-aware text rendering quality
- Responsive canvas resizing
- Color gradient rendering

### 3. User Interaction Tests (`user-interactions.spec.js`)
- Mouse event handling
- Context menu functionality
- Keyboard navigation
- Drag and drop operations
- Touch interactions
- Form input handling

### 4. Performance Tests (`performance.spec.js`)
- Memory usage monitoring
- Page load time analysis
- Rendering stress testing
- WebSocket latency measurement
- Resource loading optimization

## Configuration

### Playwright Config (`playwright.config.js`)
- Container-aware browser launch options
- Multiple browser project configurations
- Test reporting setup (HTML, JSON, JUnit)
- Global timeout and retry configurations
- Screenshot and video capture on failure

### Environment Variables
- `BASE_URL`: Application base URL (default: http://localhost:5174)
- `TEST_TIMEOUT`: Test execution timeout (default: 30000ms)
- `TEST_CONTAINER_MODE`: Container environment flag

## Browser Agents

The `browser-agents.js` file provides specialized browser configurations:

### Chrome Agent
```javascript
const { browser, context } = await browserAgentManager.createChromeAgent({
  viewport: { width: 1920, height: 1080 },
  contextOptions: { /* additional options */ }
});
```

### Mobile Agent
```javascript
const { browser, context, device } = await browserAgentManager.createMobileAgent('iPhone 12');
```

### Performance Monitoring
```javascript
const wsMessages = await browserAgentManager.setupWebSocketMonitoring(page);
const consoleMessages = await browserAgentManager.setupConsoleMonitoring(page);
const { performanceMetrics, collectMetrics } = await browserAgentManager.setupPerformanceMonitoring(page);
```

## Test Fixtures

The `fixtures.js` file provides:

- **Test Data**: Mock market data and symbols
- **Viewports**: Standard screen sizes for testing
- **Selectors**: CSS selectors for UI elements
- **Benchmarks**: Performance threshold values
- **Error Scenarios**: Common error conditions

## Logging and Monitoring

Enhanced logging system provides:

- **Structured Logging**: JSON-formatted logs with timestamps
- **Performance Metrics**: FPS, memory, and network timing
- **Error Tracking**: Console errors and page failures
- **Test Summaries**: Detailed execution reports

### Logger Usage
```javascript
import { setupTestLogging } from '../helpers/logger.js';

const logger = setupTestLogging(page, 'my-test-name');
logger.info('Test started');
logger.error('Something went wrong', { details: '...' });
```

## Running Tests in Development

1. **Start the application**:
   ```bash
   npm run dev  # Development mode on port 5174
   ```

2. **Run tests**:
   ```bash
   npm run test:e2e:debug  # With debugging
   ```

3. **View results**:
   ```bash
   npm run test:e2e:report
   ```

## CI/CD Integration

The test suite is designed for CI/CD environments:

- **Headless Execution**: Tests run without UI
- **Parallel Execution**: Multiple browsers test simultaneously
- **Artifact Collection**: Screenshots, videos, and traces saved
- **Report Generation**: Multiple report formats (HTML, JSON, JUnit)

## Troubleshooting

### Common Issues

1. **Browser Launch Failures**:
   - Ensure system dependencies are installed: `sudo npx playwright install-deps`
   - Check container has sufficient resources

2. **WebSocket Connection Issues**:
   - Verify application is running on expected port
   - Check network policies in container environment

3. **Performance Test Flakiness**:
   - Adjust timeouts for container environment
   - Consider resource constraints

4. **Canvas Rendering Issues**:
   - Verify GPU drivers are available
   - Check display settings in container

### Debug Mode

Run tests with full debugging:
```bash
npm run test:e2e:debug
```

This will pause execution and open developer tools for inspection.

## Test Data Generation

Use the market data generator for realistic testing:
```javascript
import { marketDataGenerator } from '../helpers/fixtures.js';

const tickData = marketDataGenerator.generateTick('EUR/USD');
const dataStream = marketDataGenerator.generateDataStream(['EUR/USD', 'GBP/USD'], 100);
```

## Best Practices

1. **Use Descriptive Test Names**: Make test names meaningful
2. **Include Assertions**: Verify expected behavior
3. **Cleanup Resources**: Close browsers and contexts
4. **Handle Race Conditions**: Use proper waiting strategies
5. **Monitor Performance**: Track key metrics during tests
6. **Document Scenarios**: Explain complex test logic
7. **Parallel Testing**: Structure tests to run independently
8. **Error Recovery**: Include fallback assertions

## Future Enhancements

- **Visual Regression Testing**: Image comparison capabilities
- **Accessibility Testing**: ARIA and screen reader support
- **API Testing**: Backend integration testing
- **Load Testing**: High-volume user simulation
- **Cross-Browser Matrix**: Extended browser coverage
- **Performance Budgets**: Automated performance regression detection