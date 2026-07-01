// Day Range Meter Configuration - Crystal Clarity Compliant
// Framework-first: Centralized configuration system

import { getCanvasColors } from '../canvasTheme.js';

// Colors are intentionally NOT defined here. They are injected by getConfig()
// from the centralized shell-canvas theme resolver (canvasTheme.js) so every
// shell canvas reads the current workspace theme at paint time. Renderers and
// compute functions keep reading config.colors.* — they never need to change.
const baseConfig = {
  // Typography - matching mini market profile (ticker) fonts
  fonts: {
    currentPrice: '900 36px "Georgia Pro", Georgia, serif',
    priceLabels: '600 16px "Georgia Pro", Georgia, serif',
    percentageLabels: '400 11px "Georgia Pro", Georgia, serif',
    statusMessages: '400 12px "Georgia Pro", Georgia, serif',
    uiElements: '400 11px "Georgia Pro", Georgia, serif',
    uiSymbol: '600 16px "Georgia Pro", Georgia, serif',
    uiVizIndicator: '600 11px "Georgia Pro", Georgia, serif',
    uiButtons: '600 14px "Georgia Pro", Georgia, serif'
  },

  // Text Emphasis
  emphasis: {
    ratio: 1 // Emphasized text is 1.5x larger than base text
  },

  // Positioning
  positioning: {
    adrAxisX: 0.75 , // 90% from left (10% from right). Use null for width/3 default
    padding: 0, // Reduced from 50 to minimize black borders
    labelOffset: 12
  },

  // Features
  features: {
    percentageMarkers: {
      static: true, // Show ADR percentage markers (50%, 75%, etc.)
      dynamic: true, // Show day range percentage
      adaptiveScaling: true // Enable auto scaling for ADR 50%+ visibility
    },
    boundaryLines: false,
    dprAwareRendering: true,
    professionalTypography: true,
    twapMarker: true // Enable/disable TWAP display
  },

  // Progressive disclosure parameters
  scaling: {
    minBufferPercent: 0.1, // 10% minimum buffer
    defaultMaxAdrPercentage: 0.5 // Default 50% ADR if no data
  }
};

// Kept as a named export for the few consumers that import defaultConfig for
// its fonts/emphasis (e.g. priceMarkerBase.js). It deliberately carries NO
// colors — color-bearing paths must go through getConfig() below.
export const defaultConfig = baseConfig;

// Build a render config: base config + resolver-provided colors (themed) + any
// caller overrides. A passed `colors` is injected into the colors slot (merged
// over the resolver defaults) and stripped from the top-level spread so it
// isn't double-merged.
export function getConfig(overrides = {}) {
  const { colors: _colorOverrides, ...rest } = overrides;
  return {
    ...baseConfig,
    colors: { ...getCanvasColors().dayRange, ...(_colorOverrides || {}) },
    ...rest
  };
}