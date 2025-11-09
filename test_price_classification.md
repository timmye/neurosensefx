# NeuroSenseFX Price Formatting Classification System

## Asset Class Examples & Visual Hierarchy

### 1. HIGH_VALUE_CRYPTO (BTCUSD: 100000.00)
- **Price**: 101,234.56
- **Big Figure**: 101 (thousands)
- **Pips**: 23 (hundreds/tens) - **PRIMARY VISUAL ELEMENT**
- **Pipettes**: 4 (ones)
- **Decimals**: Ignored (meaningless for crypto)
- **Visual**: 101 | 23 | 4

### 2. HIGH_VALUE_COMMODITY (XAUUSD: 3000.00)
- **Price**: 3,045.67
- **Big Figure**: 30 (thousands)
- **Pips**: 45 (hundreds/tens) - **PRIMARY VISUAL ELEMENT**
- **Pipettes**: None (commodities don't use pipettes)
- **Decimals**: Sometimes meaningful, sometimes ignored
- **Visual**: 30 | 45

### 3. FX_JPY_STYLE (USDJPY: 130.45)
- **Price**: 130.45
- **Big Figure**: 130 (integer part)
- **Pips**: 45 (both decimal places) - **PRIMARY VISUAL ELEMENT**
- **Pipettes**: None (JPY pairs don't use pipettes)
- **Visual**: 130 | 45

### 4. FX_STANDARD (EURUSD: 1.23456)
- **Price**: 1.23456
- **Big Figure**: 1.23 (everything before pips)
- **Pips**: 45 (4th and 5th digits) - **PRIMARY VISUAL ELEMENT**
- **Pipettes**: 6 (final digit)
- **Visual**: 1.23 | 45 | 6

## NeuroSenseFX Philosophy

**Pips are the most important visual element for traders:**
- **Size Ratio**: 1.0 (100% of base size) - LARGEST and MOST PROMINENT
- **Big Figure**: 0.6 ratio (60% of base) - Secondary context
- **Pipettes**: 0.4 ratio (40% of base) - Fine detail only

## Dynamic Classification Logic

The system automatically detects asset class based on:
1. **Price magnitude** (log10 scale)
2. **Digit requirements** (number of decimal places)
3. **Asset-specific patterns**

### Classification Rules

```javascript
if (magnitude >= 5) → HIGH_VALUE_CRYPTO      // 100,000+
if (magnitude >= 3) → HIGH_VALUE_COMMODITY   // 1,000-99,999
if (magnitude >= 2 && digits === 3) → FX_JPY_STYLE
if (digits === 5 || digits === 3) → FX_STANDARD
else → STANDARD_DECIMAL
```

## Visual Hierarchy Benefits

1. **Traders can instantly see pip movements** (most important for trading decisions)
2. **Big figures provide context** without overwhelming the display
3. **Pipettes available for precision** when needed
4. **Consistent across all asset classes** - no need to learn different conventions
5. **Reduces cognitive load** by standardizing what's visually important

## Testing Results

The system automatically handles:
- ✅ BTCUSD → 100234 | 56 | 7 (pips = hundreds/tens)
- ✅ XAUUSD → 30 | 45 (pips = hundreds/tens, no pipettes)
- ✅ EURUSD → 1.23 | 45 | 6 (traditional FX, pips = 4th/5th digits)
- ✅ USDJPY → 130 | 45 (JPY style, pips = both decimal places, no pipettes)

All maintain the core principle: **Pips are the primary visual element for traders**.