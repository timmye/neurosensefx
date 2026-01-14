# FX Basket Test Results

## Test File: `test-fxBasket.js`

### Summary
- **Total Tests**: 15
- **Passed**: 15 (100%)
- **Failed**: 0
- **File Size**: 68 lines (Crystal Clarity compliant: <100 lines)

## Test Coverage

### 1. Calculation Correctness (2 tests)
✓ USD basket value calculated with all 7 pairs  
✓ Ln-weighted sum matches manual calculation (Σ(weight[i] × ln(adjustedPrice[i])))

**Verification**:
- EURUSD: 1.0850 → adjusted 0.9217 (inverted)
- USDJPY: 149.50 → adjusted 149.50 (direct)
- GBPUSD: 1.2650 → adjusted 0.7905 (inverted)
- AUDUSD: 0.6650 → adjusted 1.5038 (inverted)
- USDCAD: 1.3550 → adjusted 1.3550 (direct)
- USDCHF: 0.8750 → adjusted 0.8750 (direct)
- NZDUSD: 0.6250 → adjusted 1.6000 (inverted)

### 2. Baseline Normalization (3 tests)
✓ normalizeToBaseline(baseline, baseline) = 100wt  
✓ +1% change: baseline + 0.01 → ~101wt  
✓ -1% change: baseline - 0.01 → ~99wt  

**Formula**: (exp(currentLog) / exp(baselineLog)) × 100

### 3. Pair Price Handling (2 tests)
✓ Direct pairs retrieved correctly (EURUSD = 1.0850)  
✓ Inverse pairs calculated correctly (USDGBP = 1/GBPUSD = 0.7905)

**cTrader Compatibility**: Handles missing inverses (USDGBP, AUDGBP, CADGBP, CHFGBP, NZDGBP)

### 4. Basket Initialization (3 tests)
✓ All 8 currency baskets created (USD, EUR, JPY, GBP, AUD, CAD, CHF, NZD)  
✓ All baskets start at normalized=100, changePercent=0  
✓ Basket objects contain all required properties (currency, baselineLog, currentLog, normalized, changePercent)

### 5. Coordinate Mapping (4 tests)
✓ Y(100wt) = center (200px in 400px height)  
✓ Y(102wt) = top (0px)  
✓ Y(98wt) = bottom (400px)  
✓ Y coordinates inverted: higher values → lower Y

**Formula**: Y = height - ((normalizedValue - minVal) / (maxVal - minVal)) × height

### 6. Currency Coverage (1 test)
✓ All 8 expected currencies exist in initialized baskets

## Test Data

Uses realistic FX rates for 28 currency pairs:
- Major pairs: EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, USDCHF, NZDUSD
- Cross pairs: EURJPY, EURGBP, EURAUD, EURCHF, EURCAD, EURNZD, GBPJPY, GBPAUD, GBPCAD, GBPCHF, GBPNZD
- Minor crosses: AUDJPY, CADJPY, CHFJPY, NZDJPY, AUDCAD, AUDCHF, AUDNZD, NZDCAD, NZDCHF, CADCHF

## Execution

```bash
node src/lib/fxBasket/test-fxBasket.js
```

## Conclusion

All FX Basket functionality verified:
- Ln-weighted calculations mathematically correct
- Baseline normalization working (100wt reference)
- Direct and inverse pair handling functional
- Basket initialization complete
- Coordinate mapping properly inverted for canvas rendering
- All 8 currency baskets operational
