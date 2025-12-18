# Price Formatting Compliance Guide

## Quick Reference for Developers

### ✅ COMPLIANT Patterns (Use These)

#### 1. Import and Use Centralized Functions
```javascript
// ✅ CORRECT
import { formatPriceWithPipPosition } from './priceFormat.js';

const formattedPrice = formatPriceWithPipPosition(
  price,
  symbolData.pipPosition,
  symbolData.pipSize,
  symbolData.pipetteSize
);
ctx.fillText(formattedPrice, x, y);
```

#### 2. Different Formatting Needs
```javascript
// ✅ CORRECT - Pip-level precision (no pipettes)
import { formatPriceToPipLevel } from './priceFormat.js';
const pipPrice = formatPriceToPipLevel(price, pipPosition, pipSize);

// ✅ CORRECT - Compact display for limited space
import { formatPriceCompact } from './priceFormat.js';
const compactPrice = formatPriceCompact(price, 5, pipPosition);

// ✅ CORRECT - Pip movement with sign
import { formatPipMovement } from './priceFormat.js';
const pipMove = formatPipMovement(priceChange, pipPosition);
```

#### 3. Percentages (Special Case)
```javascript
// ✅ CORRECT - For percentage displays
const percentage = ((value / total) * 100).toFixed(1) + '%';

// Or create centralized function:
export function formatPercentage(value, total, digits = 1) {
  return ((value / total) * 100).toFixed(digits) + '%';
}
```

### ❌ NON-COMPLIANT Patterns (Avoid These)

#### 1. Direct toFixed() for Display
```javascript
// ❌ WRONG - Direct formatting
ctx.fillText(price.toFixed(5), x, y);

// ❌ WRONG - Even with trailing zero removal
ctx.fillText(price.toFixed(5).replace(/\.?0+$/, ''), x, y);

// ❌ WRONG - Hardcoded precision
const formatted = price.toFixed(4); // Ignores pipPosition
```

#### 2. Custom Formatting Logic
```javascript
// ❌ WRONG - Custom implementation
function formatMyPrice(price, digits) {
  const formatted = price.toFixed(digits);
  if (formatted.includes('.')) {
    return formatted.replace(/0+$/, '').replace(/\.$/, '');
  }
  return formatted;
}

// ❌ WRONG - Duplication of centralized logic
const pipFormatted = (Math.round(price / pipSize) * pipSize).toFixed(pipPosition);
```

#### 3. Mixed Approaches
```javascript
// ❌ WRONG - Import but don't use
import { formatPriceWithPipPosition } from './priceFormat.js';
// ... then later:
const formatted = price.toFixed(5); // Why import if not using?
```

## Decision Tree for Price Formatting

```
Need to format a price?
    │
    ├─ Is it for DISPLAY (UI, Canvas, Labels)?
    │  └─ YES → Use formatPriceWithPipPosition()
    │
    ├─ Is it a PERCENTAGE?
    │  └─ YES → Use toFixed() directly (acceptable exception)
    │
    ├─ Is it for INTERNAL CALCULATION?
    │  └─ YES → Use toFixed() directly (acceptable)
    │
    └─ Is it for TESTING?
       └─ YES → Use toFixed() for comparisons (acceptable)
```

## Migration Examples

### Example 1: Market Profile Renderer
```javascript
// BEFORE (non-compliant):
levels.push(parseFloat(currentPrice.toFixed(5)));

// AFTER (compliant):
import { formatPriceWithPipPosition } from './priceFormat.js';
const formatted = formatPriceWithPipPosition(
  currentPrice,
  symbolData.pipPosition,
  symbolData.pipSize,
  symbolData.pipetteSize
);
levels.push(parseFloat(formatted));
```

### Example 2: Day Range Calculations
```javascript
// BEFORE (questionable):
return adrValue > 0 ? ((dayRange / adrValue) * 100).toFixed(1) : null;

// AFTER (compliant with centralized percentage function):
import { formatPercentage } from './priceFormat.js';
return adrValue > 0 ? formatPercentage(dayRange, adrValue, 1) : null;
```

### Example 3: Price Delta Display
```javascript
// BEFORE (mixed):
const deltaPercent = ((delta / startPrice) * 100).toFixed(2);
const formattedStart = formatPriceWithPipPosition(start, pipPosition);

// AFTER (fully compliant):
import { formatPriceWithPipPosition, formatPercentage } from './priceFormat.js';
const deltaPercent = formatPercentage(delta, startPrice, 2);
const formattedStart = formatPriceWithPipPosition(start, pipPosition, pipSize);
```

## Common Scenarios

### Scenario 1: Displaying Current Price
```javascript
// ✅ CORRECT
import { formatPriceWithPipPosition } from './priceFormat.js';

function renderCurrentPrice(ctx, price, symbolData, x, y) {
  const formatted = formatPriceWithPipPosition(
    price,
    symbolData.pipPosition,
    symbolData.pipSize,
    symbolData.pipetteSize
  );
  ctx.fillStyle = '#0f0';
  ctx.fillText(formatted, x, y);
}
```

### Scenario 2: Price Marker Labels
```javascript
// ✅ CORRECT
import { formatPriceForDisplay } from './priceMarkerBase.js';

function drawPriceLabel(ctx, price, symbolData) {
  const label = formatPriceForDisplay(price, symbolData);
  ctx.fillText(label, x, y);
}
```

### Scenario 3: Historical Price List
```javascript
// ✅ CORRECT
import { formatPriceCompact } from './priceFormat.js';

function renderPriceList(ctx, prices, symbolData) {
  prices.forEach((price, i) => {
    const formatted = formatPriceCompact(
      price,
      symbolData.pipPosition,
      symbolData.pipPosition
    );
    ctx.fillText(formatted, x, y + i * 15);
  });
}
```

## Code Review Checklist

When reviewing code, check for:

### ❌ Red Flags
- [ ] Direct `.toFixed()` calls in rendering code
- [ ] Hardcoded precision values (e.g., `.toFixed(5)`)
- [ ] Custom regex for trailing zero removal
- [ ] Formatting logic duplicated across files
- [ ] Missing `pipPosition` usage for FX pairs

### ✅ Green Flags
- [ ] Import from `priceFormat.js`
- [ ] `formatPriceWithPipPosition()` for display
- [ ] Proper pipPosition/pipSize parameters
- [ ] Single source of truth for formatting
- [ ] Consistent display across components

## Performance Considerations

### Centralized Formatting is Fast
- Function calls are negligible overhead
- Benefits outweigh micro-optimizations
- Consistency is more valuable than nanoseconds

### When to Optimize
- Only if profiling shows formatting as bottleneck
- Consider memoization for repeated formatting of same values
- Cache formatted strings in loops if needed

## Testing Guidelines

### Unit Tests
```javascript
// ✅ CORRECT - Test centralized function
import { formatPriceWithPipPosition } from './priceFormat.js';

test('formats EUR/USD correctly', () => {
  expect(formatPriceWithPipPosition(1.23456, 5, 0.00001, 0.000001))
    .toBe('1.23456');
});
```

### Integration Tests
```javascript
// ✅ CORRECT - Test renderer uses centralized function
test('renderer uses centralized formatting', () => {
  const spy = jest.spyOn(priceFormat, 'formatPriceWithPipPosition');
  renderPriceMarker(ctx, price, symbolData);
  expect(spy).toHaveBeenCalledWith(price, 5, 0.00001, 0.000001);
});
```

## Emergency Fixes

If you find legacy code that can't be immediately refactored:

```javascript
// Temporary fix - mark for future refactoring
// TODO: MIGRATE TO CENTRALIZED FORMATTING
// DEPRECATED: Use formatPriceWithPipPosition instead
function legacyFormat(price, digits) {
  console.warn('Using deprecated formatPrice - migrate to priceFormat.js');
  return price.toFixed(digits).replace(/\.?0+$/, '');
}
```

This guide provides clear patterns for maintaining price formatting compliance while allowing for acceptable exceptions in specific cases.