# Live Data Testing Policy

## 🚨 **CRITICAL REQUIREMENT**

**ALL tests must use LIVE market data and REAL browser environments.**
NO synthetic, mock, or fake data is permitted under any circumstances.

## **Allowed Testing Patterns**

### ✅ **Pure Utility Functions** (No Market Data)
- Keyboard shortcut utilities (`keyboardCore.test.js`)
- Pure mathematical calculations (coordinate transforms)
- Configuration persistence with localStorage
- Browser API interactions

### ✅ **Real Browser E2E Tests**
- Playwright tests with live WebSocket connections
- Real cTrader API data integration
- Actual DOM manipulation with live data
- Performance testing with real market conditions

### ✅ **Integration Testing**
- Live WebSocket message processing
- Real-time price update handling
- Actual browser rendering with market data
- Professional trading workflow validation

## **FORBIDDEN Patterns** ❌

### ❌ **Mock Market Data**
```javascript
// FORBIDDEN - Never use fake market data
const mockState = {
  midPrice: 1.0550,        // FAKE PRICE
  currentPrice: 1.0585,    // FAKE PRICE
  todaysHigh: 1.0620,      // FAKE PRICE
  // ... any fake market data
};

formatPrice(1.08567, 5)     // FAKE EUR/USD
formatPrice(149.82, 3)      // FAKE USD/JPY
const goldPrice = 1985.45;  // FAKE GOLD PRICE
```

### ❌ **Synthetic Test Data**
- No sample price generation
- No fake trading symbols
- No mock WebSocket responses
- No simulated market conditions

### ❌ **Test Data Factories**
- No factory functions for market data
- No fixture generation for prices
- No synthetic symbol creation

## **Testing Philosophy**

### **Real-World or Nothing**
- **Live cTrader API connection** required for all market data tests
- **Real WebSocket streams** for price updates
- **Actual browser environments** for DOM interactions
- **Professional trading conditions** for performance validation

### **Professional Trading Standards**
- **60fps rendering** with live market data
- **Sub-100ms latency** with real WebSocket connections
- **20+ concurrent displays** with live market feeds
- **Extended session stability** with actual trading workflows

## **Code Review Checklist**

Before committing any test code, verify:

- [ ] No hardcoded price data (`1.08567`, `149.82`, etc.)
- [ ] No mock market state objects
- [ ] No synthetic trading symbols
- [ ] Tests connect to live WebSocket backend
- [ ] All market data comes from cTrader API
- [ ] Performance metrics use real browser timing
- [ ] DOM tests use actual rendered elements

## **Violations = Immediate Removal**

Any test containing fake/mock/synthetic market data will be:
1. **Immediately deleted** without discussion
2. **Developer notified** of policy violation
3. **PR rejected** for policy non-compliance

## **Professional Standards**

This policy ensures:
- **Real-world validation** of trading functionality
- **Professional-grade performance** under actual market conditions
- **Accurate behavior** with live data streams
- **Reliable trading decisions** based on tested scenarios

---

**Remember: If it's not real market data in a real browser, it's not a valid test for NeuroSense FX.**