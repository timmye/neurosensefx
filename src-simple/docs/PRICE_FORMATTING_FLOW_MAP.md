# Price Formatting Flow Map

## Data Flow Visualization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND DATA SOURCE                               │
│                     cTrader API via WebSocket                               │
│                                                                             │
│  Raw Tick Data:                                                             │
│  { symbol: 'EURUSD', bid: 1.23456, ask: 1.23457,                          │
│    pipPosition: 5, pipSize: 0.00001, pipetteSize: 0.000001 }              │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ JSON over WebSocket
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        connectionManager.js                                 │
│                     WebSocket Connection Layer                              │
│                                                                             │
│  Role:                                                                     │
│  • Establishes WebSocket connection                                        │
│  • Manages subscriptions                                                   │
│  • Handles reconnection                                                    │
│  • Routes messages to callbacks                                            │
│                                                                             │
│  Price Formatting: NONE (pass-through)                                     │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ Raw message object
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      displayDataProcessor.js                               │
│                        Data Processing Layer                               │
│                                                                             │
│  Role:                                                                     │
│  • Processes raw WebSocket data                                            │
│  • Extracts and preserves pipPosition/pipSize                              │
│  • Formats data structure for components                                   │
│                                                                             │
│  Price Formatting: NONE (data structure only)                              │
│  Output: { high, low, current, open, pipPosition, pipSize, ... }           │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ Processed data object
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        workspace.js (Svelte Store)                         │
│                        Centralized State Layer                             │
│                                                                             │
│  Role:                                                                     │
│  • Single source of truth for all display data                            │
│  • Reactive updates to components                                          │
│  • Persists display configurations                                         │
│                                                                             │
│  Price Formatting: NONE (state management only)                           │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ Reactive data flow
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FloatingDisplay.svelte                                  │
│                       Display Component                                   │
│                                                                             │
│  Role:                                                                     │
│  • Receives data via $workspace reactive store                             │
│  • Passes data to visualization registry                                  │
│  • Manages canvas lifecycle                                                │
│                                                                             │
│  Price Formatting: NONE (routing only)                                     │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ Data + config
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   visualizationRegistry.js                                 │
│                        Visualization Router                                │
│                                                                             │
│  Role:                                                                     │
│  • Maps display type to renderer function                                  │
│  • Provides standardized interface                                        │
│                                                                             │
│  Price Formatting: NONE (dispatch only)                                    │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ Calls specific renderer
                                      ▼
┌─────────────────────────────┬──────────────────────────────────────────────┐
│     INDIVIDUAL RENDERERS    │                COMPLIANCE STATUS             │
├─────────────────────────────┼──────────────────────────────────────────────┤
│                             │                                              │
│  ┌───────────────────────┐  │                                              │
│  │    dayRange.js        │  │  ⚠️  QUESTIONABLE (70% compliant)           │
│  │                       │  │  - Imports: formatPriceWithPipPosition        │
│  │  Compliance Issues:   │  │  - Fallback: Direct .toFixed(5)              │
│  │  - Custom formatPrice()│  │  - Legacy: Mixed approach                   │
│  │  - Hardcoded fallback  │  │                                              │
│  └───────────┬───────────┘  │                                              │
│              │              │                                              │
│  ┌───────────────────────┐  │                                              │
│  │ marketProfileRenderer │  │  ❌  NON-COMPLIANT (0% compliant)           │
│  │        .js            │  │  - Imports: priceFormat (BUT)               │
│  │                       │  │  - Usage: Direct .toFixed(5)                │
│  │  Compliance Issues:   │  │  - Legacy: Completely bypasses central      │
│  │  - Direct .toFixed(5) │  │                                              │
│  │  - Ignores pipPosition │  │                                              │
│  └───────────┬───────────┘  │                                              │
│              │              │                                              │
│  ┌───────────────────────┐  │                                              │
│  │   priceMarkerBase.js  │  │  ✅  COMPLIANT (100% compliant)            │
│  │                       │  │  - Imports: formatPriceWithPipPosition        │
│  │  Compliance:          │  │  - Usage: Proper centralized call            │
│  │  - Centralized format  │  │  - Pattern: Perfect example                 │
│  └───────────┬───────────┘  │                                              │
│              │              │                                              │
│  ┌───────────────────────┐  │                                              │
│  │displayCanvasRenderer  │  │  ⚠️  QUESTIONABLE (50% compliant)           │
│  │        .js            │  │  - Imports: Multiple format functions         │
│  │                       │  │  - Usage: Mixed approach                     │
│  │  Compliance Issues:   │  │  - Pattern: Centralized + Custom           │
│  │  - Mixed usage        │  │                                              │
│  └───────────┬───────────┘  │                                              │
└─────────────┬─────────────┘  └──────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           priceFormat.js                                   │
│                        CENTRALIZED MODULE                                  │
│                                                                             │
│  Available Functions:                                                       │
│  • formatPrice() - Basic toFixed() wrapper                                  │
│  • formatPriceWithPipPosition() - Smart pip-aware formatting                │
│  • formatPriceToPipLevel() - Round to nearest pip                          │
│  • formatPriceCompact() - Space-saving format                              │
│  • formatPipMovement() - Delta formatting with sign                        │
│                                                                             │
│  Features:                                                                  │
│  ✅ PipPosition integration                                                │
│  ✅ Trailing zero removal (.replace(/\.?0+$/, ''))                         │
│  ✅ Trader-friendly outputs                                                │
│  ✅ Multiple formatting strategies                                         │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ Formatted string
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Canvas 2D Context                                   │
│                          Final Rendering                                   │
│                                                                             │
│  Method: ctx.fillText(formattedText, x, y)                                 │
│                                                                             │
│  Result:                                                                    │
│  • Compliant: "1.2345" (pip-level, no trailing zeros)                     │
│  • Non-compliant: "1.23450" (fixed precision with zeros)                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Format Transformation Details

### Compliant Flow (Example: priceMarkerBase.js)
```
1. Raw: 1.234560
2. pipPosition: 5
3. formatPriceWithPipPosition() → "1.23456"
4. .replace(/\.?0+$/, '') → "1.23456" (no change)
5. Canvas: "1.23456"
```

### Non-Compliant Flow (Example: marketProfileProcessor.js)
```
1. Raw: 1.234560
2. pipPosition: 5 (ignored)
3. Direct .toFixed(5) → "1.23456"
4. Canvas: "1.23456" (works by coincidence)
```

### Legacy Flow (Example: dayRange.js fallback)
```
1. Raw: 1.234560
2. pipPosition: undefined (missing data)
3. Direct .toFixed(5) → "1.23456"
4. Canvas: "1.23456" (brittle, depends on luck)
```

## Critical Decision Points

### Decision Point 1: displayDataProcessor.js
```
✅ PRESERVES pipPosition data
⚠️ No formatting applied (correct behavior)
```

### Decision Point 2: Individual Renderers
```
✅ COMPLIANT: Import and use priceFormat.js
❌ NON-COMPLIANT: Direct .toFixed() calls
⚠️ QUESTIONABLE: Mix of both approaches
```

### Decision Point 3: priceFormat.js Functions
```
formatPriceWithPipPosition() → Smart, pip-aware, removes zeros ✅
formatPrice() → Simple toFixed() wrapper ⚠️
Direct .toFixed() → Bypasses centralization ❌
```

## Impact Analysis

### When Components Use Custom Formatting:
1. **Inconsistent Display**: Same price shows differently across visualizations
2. **Maintenance Burden**: Changes require updates in multiple files
3. **Trader Confusion**: Unexpected trailing zeros or missing precision
4. **Code Duplication**: Same logic implemented multiple times

### When Components Use Centralized Formatting:
1. **Consistency**: All prices display uniformly
2. **Maintainability**: Single point of change for formatting rules
3. **Trader Experience**: Predictable, professional appearance
4. **Code Quality**: DRY principle, single responsibility

## Path to Full Compliance

### Step 1: Inventory
```
Search pattern: .toFixed(
Files to update:
- marketProfileProcessor.js (lines 60, 154, 155, 178, 189, 199)
- dayRangeCalculations.js (line 10)
- displayCanvasRenderer.js (line 129)
- percentageMarkerRenderer.js (lines 68, 69)
- dayRange.js (line 103) - fallback
- tests/ (acceptable for test assertions)
```

### Step 2: Categorize
```
Price displays → Must use centralized formatting
Percentages → Can use dedicated percentage formatter
Internal calculations → Direct toFixed() acceptable
Tests → Direct comparison acceptable
```

### Step 3: Refactor
```javascript
// Before (non-compliant):
levels.push(parseFloat(currentPrice.toFixed(5)));

// After (compliant):
import { formatPriceWithPipPosition } from './priceFormat.js';
levels.push(parseFloat(formatPriceWithPipPosition(currentPrice, symbolData.pipPosition)));
```

This flow map clearly shows where compliance breaks down and provides a roadmap for achieving 100% centralized price formatting.