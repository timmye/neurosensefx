# Enhanced CanvasContextMenu Component

This directory contains the enhanced CanvasContextMenu component with modular architecture for managing the 98 visualization parameters in NeuroSense FX.

## Directory Structure

```
CanvasContextMenu/
├── utils/                      # Utility functions and data
│   ├── parameterGroups.js      # Parameter categorization into 6 tabs
│   ├── searchUtils.js          # Search and filtering functionality
│   ├── keyboardShortcuts.js    # Keyboard navigation shortcuts
│   └── parameterValidation.js  # Validation utilities
├── tabs/                       # Tab components (one per parameter group)
│   ├── QuickActionsTab.svelte
│   ├── PriceDisplayTab.svelte
│   ├── MarketProfileTab.svelte
│   ├── VolatilityTab.svelte
│   ├── LayoutSizingTab.svelte
│   └── AdvancedTab.svelte
├── controls/                   # Reusable control components
│   ├── ToggleControl.svelte    # Checkbox/toggle controls
│   ├── RangeControl.svelte     # Range slider controls
│   ├── ColorControl.svelte     # Color picker controls
│   └── SelectControl.svelte    # Dropdown select controls
├── index.js                    # Module exports and helper functions
└── README.md                   # This documentation
```

## Parameter Groups

The 98 visualization parameters are organized into 6 logical groups:

### 1. Quick Actions (12 parameters)
Essential toggles and show/hide controls for frequently used features.
- showMarketProfile, showVolatilityOrb, showFlash, showVolatilityMetric
- showAdrRangeIndicatorLines, showAdrRangeIndicatorLabel
- showPriceFloatPulse, showOrbFlash, showPipetteDigit
- showPriceBackground, showPriceBoundingBox, showMaxMarker

### 2. Price Display (20 parameters)
Price float and display settings for price visualization.
- priceFloatWidth, priceFloatHeight, priceFloatXOffset
- priceFloatColors (up, down, base)
- priceFloatPulse settings
- priceFont settings (size, weight, offsets)
- price background and opacity settings

### 3. Market Profile (20 parameters)
Market profile visualization settings.
- marketProfileView, colors, opacity
- marketProfileOutline settings
- distributionDepthMode, distributionPercentage
- priceBucketMultiplier, marketProfileWidthRatio
- PH/PL and OHL label settings

### 4. Volatility (16 parameters)
Volatility orb and flash settings.
- volatilityColorMode, volatilityOrbBaseWidth
- volatilityOrbInvertBrightness, volatilitySizeMultiplier
- flashThreshold, flashIntensity
- orbFlashThreshold, orbFlashIntensity
- ADR range settings and colors

### 5. Layout & Sizing (12 parameters)
Dimensions and positioning settings.
- visualizationsContentWidth, meterHeight
- centralAxisXPosition
- ADR range indicator label settings
- adrLabelType, priceStaticColor

### 6. Advanced (17 parameters)
Power user and experimental features.
- frequencyMode, markerLineColor, markerLineThickness
- hoverLabel settings
- label box outline settings
- price up/down colors
- price box outline settings

## Control Types

Each parameter has a designated control type:

- **toggle**: Checkbox for boolean values
- **range**: Slider for numeric values with min/max/step
- **color**: Color picker for color values
- **select**: Dropdown for choice values

## Search Functionality

The searchUtils.js provides comprehensive search capabilities:

- Fuzzy matching on parameter names and labels
- Priority scoring for exact matches
- Parameter categorization in search results
- Advanced filtering by group and control type

## Keyboard Shortcuts

Comprehensive keyboard navigation:

- **Tab Navigation**: Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+1-6
- **Search**: Ctrl+F or / to focus search
- **Controls**: Space to toggle, Arrow keys to adjust values
- **Menu**: Escape to close, Ctrl+R to reset, Ctrl+S to save

## Usage

```javascript
// Import all utilities
import {
  parameterGroups,
  searchParameters,
  createShortcutHandler,
  QuickActionsTab,
  ToggleControl
} from './index.js';

// Get parameter metadata
const metadata = getParameterMetadata('showMarketProfile');

// Search for parameters
const results = searchParameters('price');

// Setup keyboard shortcuts
const cleanup = createShortcutHandler({
  onAction: (action) => console.log(action)
});
```

## Validation

The parameterValidation.js provides validation utilities:

```javascript
// Validate all parameters are categorized
import { validateParameterGroups } from './utils/parameterValidation.js';
const validation = validateParameterGroups();
console.log(validation.isValid); // true if all parameters are categorized
```

## Development Notes

1. All 98 parameters from configStore.js are properly categorized
2. Each parameter has metadata (type, label, options, ranges)
3. Components are designed to be modular and reusable
4. Search functionality supports fuzzy matching and prioritization
5. Keyboard shortcuts are comprehensive and customizable
6. Validation ensures no parameters are missed during development

## Next Steps

The foundation is now complete for implementing the enhanced CanvasContextMenu component. The next phase will involve:

1. Implementing the actual tab components with their controls
2. Creating the main CanvasContextMenu component that uses tabs
3. Integrating search functionality with the UI
4. Adding keyboard navigation to the interface
5. Testing and polishing the user experience