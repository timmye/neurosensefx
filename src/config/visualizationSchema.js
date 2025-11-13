// =============================================================================
// SIMPLIFIED VISUALIZATION CONFIGURATION SCHEMA
// =============================================================================
// Essential parameters only - 63% reduction from 85+ to ~31 parameters
// Based on actual code usage analysis
//
// DESIGN PRINCIPLES:
// 1. Only parameters actually used in component code
// 2. Clear, consistent naming conventions
// 3. Standardized percentage format (decimal 0.0-1.0)
// 4. Essential functionality only

// =============================================================================
// CONFIGURATION GROUPS
// =============================================================================

export const CONFIG_GROUPS = {
  layout: {
    title: 'Layout & Sizing',
    description: 'Essential dimensions and positioning',
    order: 1,
    icon: 'layout'
  },
  priceDisplay: {
    title: 'Price Display',
    description: 'Price display text settings',
    order: 2,
    icon: 'type'
  },
  priceFloat: {
    title: 'Price Float',
    description: 'Price float line settings',
    order: 3,
    icon: 'activity'
  },
  marketProfile: {
    title: 'Market Profile',
    description: 'Market profile visualization settings',
    order: 4,
    icon: 'bar-chart'
  },
  volatility: {
    title: 'Volatility',
    description: 'Volatility orb visualization settings',
    order: 5,
    icon: 'target'
  },
  adr: {
    title: 'Day Range Meter',
    description: 'Average Daily Range (ADR) visualization settings',
    order: 6,
    icon: 'trending-up'
  },
  quickActions: {
    title: 'Quick Actions',
    description: 'Essential toggles and show/hide controls',
    order: 7,
    icon: 'zap'
  },
  hoverIndicator: {
    title: 'Hover Indicator',
    description: 'Interactive hover display settings',
    order: 8,
    icon: 'crosshair'
  },
  priceMarkers: {
    title: 'Price Markers',
    description: 'Horizontal price line markers with labels',
    order: 9,
    icon: 'minus'
  }
};

// =============================================================================
// ESSENTIAL PARAMETER DEFINITIONS (31 parameters)
// =============================================================================

export const ESSENTIAL_PARAMETERS = {
  // === CORE LAYOUT ===
  containerSize: {
    type: 'object',
    default: { width: 220, height: 120 },
    group: 'layout',
    validation: { shape: { width: 'number', height: 'number' } },
    ui: {
      control: 'dimension',
      label: 'Display Size',
      description: 'Full display size (headerless design)'
    }
  },
  visualizationsContentWidth: {
    type: 'number',
    default: 1.0,
    group: 'layout',
    validation: { min: 0.5, max: 2.0, step: 0.05 },
    ui: {
      control: 'range',
      label: 'Content Width',
      description: 'Percentage of canvas width',
      unit: '%'
    }
  },
  meterHeight: {
    type: 'number',
    default: 0.75,
    group: 'layout',
    validation: { min: 0.5, max: 2.0, step: 0.05 },
    ui: {
      control: 'range',
      label: 'Meter Height',
      description: 'Percentage of canvas height',
      unit: '%'
    }
  },
  adrAxisPosition: {
    type: 'number',
    default: 0.75,
    group: 'layout',
    validation: { min: 0.05, max: 0.95, step: 0.01 },
    ui: {
      control: 'range',
      label: 'ADR Axis Position',
      description: 'Percentage of container width',
      unit: '%'
    }
  },

  // === PRICE DISPLAY ===
  priceFontSize: {
    type: 'number',
    default: 0.5,
    group: 'priceDisplay',
    validation: { min: 0.01, max: 1, step: 0.001 },
    ui: {
      control: 'range',
      label: 'Font Size',
      description: 'Price font size as percentage of canvas height',
      unit: '%'
    }
  },
  priceFontWeight: {
    type: 'string',
    default: '400',
    group: 'priceDisplay',
    validation: { enum: ['400', '500', '600', '700', '800', '900'] },
    ui: {
      control: 'select',
      label: 'Font Weight',
      description: 'Font weight for price display',
      options: [
        { value: '400', label: 'Regular' },
        { value: '500', label: 'Medium' },
        { value: '600', label: 'Semibold' },
        { value: '700', label: 'Bold' },
        { value: '800', label: 'Extra Bold' },
        { value: '900', label: 'Black' }
      ]
    }
  },
  priceDisplayPositioning: {
    type: 'string',
    default: 'canvasRelative',
    group: 'priceDisplay',
    validation: { enum: ['canvasRelative', 'adrAxis'] },
    ui: {
      control: 'select',
      label: 'Positioning Mode',
      description: 'How price display is positioned',
      options: [
        { value: 'canvasRelative', label: 'Canvas Relative' },
        { value: 'adrAxis', label: 'ADR Axis' }
      ]
    }
  },
  priceDisplayHorizontalPosition: {
    type: 'number',
    default: 0.02,
    group: 'priceDisplay',
    validation: { min: 0, max: 0.5, step: 0.01 },
    ui: {
      control: 'range',
      label: 'Horizontal Position',
      description: 'Horizontal position from left edge',
      unit: '%'
    }
  },
  priceDisplayXOffset: {
    type: 'number',
    default: 0,
    group: 'priceDisplay',
    validation: { min: -0.25, max: 0.25, step: 0.01 },
    ui: {
      control: 'range',
      label: 'X Offset',
      description: 'Fine-tuning X offset from base position',
      unit: '%'
    }
  },
  priceDisplayPadding: {
    type: 'number',
    default: 0.02,
    group: 'priceDisplay',
    validation: { min: 0, max: 0.05, step: 0.001 },
    ui: {
      control: 'range',
      label: 'Display Padding',
      description: 'Padding around price display',
      unit: '%'
    }
  },
  showPriceBackground: {
    type: 'boolean',
    default: false,
    group: 'priceDisplay',
    ui: {
      control: 'toggle',
      label: 'Show Background',
      description: 'Display background behind price text'
    }
  },
  priceBackgroundColor: {
    type: 'string',
    default: '#111827',
    group: 'priceDisplay',
    validation: { format: 'color' },
    ui: {
      control: 'color',
      label: 'Background Color',
      description: 'Background color for price display'
    }
  },
  priceBackgroundOpacity: {
    type: 'number',
    default: 0.8,
    group: 'priceDisplay',
    validation: { min: 0, max: 1, step: 0.1 },
    ui: {
      control: 'range',
      label: 'Background Opacity',
      description: 'Transparency of price background',
      unit: '%'
    }
  },

  // === PRICE FLOAT ===
  priceFloatWidth: {
    type: 'number',
    default: 0.15,
    group: 'priceFloat',
    validation: { min: 0.001, max: 1.0, step: 0.01 },
    ui: {
      control: 'range',
      label: 'Float Width',
      description: 'Price float width as percentage of canvas',
      unit: '%'
    }
  },
  priceFloatHeight: {
    type: 'number',
    default: 0.035,
    group: 'priceFloat',
    validation: { min: 0.001, max: 0.5, step: 0.001 },
    ui: {
      control: 'range',
      label: 'Float Height',
      description: 'Price float height as percentage of canvas',
      unit: '%'
    }
  },
  priceFloatXOffset: {
    type: 'number',
    default: 0,
    group: 'priceFloat',
    validation: { min: -0.25, max: 0.25, step: 0.01 },
    ui: {
      control: 'range',
      label: 'Float X Offset',
      description: 'Horizontal offset for price float',
      unit: '%'
    }
  },
  priceFloatUseDirectionalColor: {
    type: 'boolean',
    default: false,
    group: 'priceFloat',
    ui: {
      control: 'toggle',
      label: 'Directional Color',
      description: 'Use different colors for up/down movements'
    }
  },

              
  
  
  // === VOLATILITY METRIC ===
  showVolatilityMetric: {
    type: 'boolean',
    default: true,
    group: 'volatility',
    ui: {
      control: 'toggle',
      label: 'Show Metric',
      description: 'Display volatility metric value'
    }
  },

  // === VOLATILITY ORB ===
  showVolatilityOrb: {
    type: 'boolean',
    default: true,
    group: 'volatility',
    ui: {
      control: 'toggle',
      label: 'Show Volatility Orb',
      description: 'Display background volatility orb visualization'
    }
  },
  volatilityColorMode: {
    type: 'string',
    default: 'static',
    group: 'volatility',
    validation: { enum: ['directional', 'static', 'intensity'] },
    ui: {
      control: 'select',
      label: 'Color Mode',
      description: 'How colors are applied based on market direction',
      options: [
        { value: 'directional', label: 'Directional (Blue/Purple)' },
        { value: 'static', label: 'Static (Gray)' },
        { value: 'intensity', label: 'Intensity (Color Brightness)' }
      ]
    }
  },
  volatilityOrbBaseWidth: {
    type: 'number',
    default: 0.15,
    group: 'volatility',
    validation: { min: 0.01, max: 0.8, step: 0.05 },
    ui: {
      control: 'range',
      label: 'Base Size',
      description: 'Base orb size as percentage of canvas width',
      unit: '%'
    }
  },
  volatilitySizeMultiplier: {
    type: 'number',
    default: 1.0,
    group: 'volatility',
    validation: { min: 0.5, max: 3.0, step: 0.1 },
    ui: {
      control: 'range',
      label: 'Size Multiplier',
      description: 'Scaling factor for volatility size response',
      unit: 'x'
    }
  },
  gradientSoftness: {
    type: 'number',
    default: 0.7,
    group: 'volatility',
    validation: { min: 0.0, max: 1.0, step: 0.1 },
    ui: {
      control: 'range',
      label: 'Gradient Softness',
      description: 'Edge softness for comfortable viewing',
      unit: '%'
    }
  },
  gradientSpread: {
    type: 'number',
    default: 1.2,
    group: 'volatility',
    validation: { min: 0.8, max: 2.0, step: 0.1 },
    ui: {
      control: 'range',
      label: 'Gradient Spread',
      description: 'How far the glow extends from center',
      unit: 'x'
    }
  },
  showOrbFlash: {
    type: 'boolean',
    default: false,
    group: 'volatility',
    ui: {
      control: 'toggle',
      label: 'Enable Flash',
      description: 'Flash on significant price movements'
    }
  },
  flashThreshold: {
    type: 'number',
    default: 2.0,
    group: 'volatility',
    validation: { min: 0.5, max: 5.0, step: 0.1 },
    ui: {
      control: 'range',
      label: 'Flash Threshold',
      description: 'Price movement magnitude that triggers flash',
      unit: 'pips'
    }
  },
  volatilityOrbXPosition: {
    type: 'number',
    default: 0.5,
    group: 'volatility',
    validation: { min: 0.0, max: 1.0, step: 0.05 },
    ui: {
      control: 'range',
      label: 'X Position',
      description: 'Horizontal position of orb center',
      unit: '%'
    }
  },
  volatilityOrbYPosition: {
    type: 'number',
    default: 0.5,
    group: 'volatility',
    validation: { min: 0.0, max: 1.0, step: 0.05 },
    ui: {
      control: 'range',
      label: 'Y Position',
      description: 'Vertical position of orb center',
      unit: '%'
    }
  },

  // === VOLATILITY ORB CUSTOM COLORS ===
  volatilityUpColor: {
    type: 'string',
    default: '#3b82f6',
    group: 'volatility',
    validation: { format: 'color' },
    ui: {
      control: 'color',
      label: 'Up Color',
      description: 'Color for upward volatility movements'
    }
  },
  volatilityDownColor: {
    type: 'string',
    default: '#a78bfa',
    group: 'volatility',
    validation: { format: 'color' },
    ui: {
      control: 'color',
      label: 'Down Color',
      description: 'Color for downward volatility movements'
    }
  },
  volatilityStaticColor: {
    type: 'string',
    default: '#d1d5db',
    group: 'volatility',
    validation: { format: 'color' },
    ui: {
      control: 'color',
      label: 'Static Color',
      description: 'Color for static volatility mode'
    }
  },

  // === VOLATILITY ORB TRANSPARENCY CONTROLS ===
  volatilityUpOpacity: {
    type: 'number',
    default: 0.8,
    group: 'volatility',
    validation: { min: 0.1, max: 1.0, step: 0.1 },
    ui: {
      control: 'range',
      label: 'Up Transparency',
      description: 'Transparency for upward volatility colors',
      unit: '%'
    }
  },
  volatilityDownOpacity: {
    type: 'number',
    default: 0.8,
    group: 'volatility',
    validation: { min: 0.1, max: 1.0, step: 0.1 },
    ui: {
      control: 'range',
      label: 'Down Transparency',
      description: 'Transparency for downward volatility colors',
      unit: '%'
    }
  },
  volatilityStaticOpacity: {
    type: 'number',
    default: 0.8,
    group: 'volatility',
    validation: { min: 0.1, max: 1.0, step: 0.1 },
    ui: {
      control: 'range',
      label: 'Static Transparency',
      description: 'Transparency for static volatility color',
      unit: '%'
    }
  },
  volatilityOrbOpacity: {
    type: 'number',
    default: 0.9,
    group: 'volatility',
    validation: { min: 0.1, max: 1.0, step: 0.1 },
    ui: {
      control: 'range',
      label: 'Overall Opacity',
      description: 'Overall orb opacity for ambient vs focused attention',
      unit: '%'
    }
  },

  // === MARKET PROFILE ===
  showMarketProfile: {
    type: 'boolean',
    default: true,
    group: 'quickActions',
    ui: {
      control: 'toggle',
      label: 'Market Profile',
      description: 'Show market profile visualization'
    }
  },
  analysisType: {
    type: 'string',
    default: 'volumeDistribution',
    group: 'marketProfile',
    validation: { enum: ['volumeDistribution', 'deltaPressure'] },
    ui: {
      control: 'select',
      label: 'Analysis Type',
      description: 'Type of market analysis to display',
      options: [
        { value: 'volumeDistribution', label: 'Volume Distribution' },
        { value: 'deltaPressure', label: 'Delta Pressure' }
      ]
    }
  },
  renderingStyle: {
    type: 'string',
    default: 'silhouette',
    group: 'marketProfile',
    validation: { enum: ['silhouette', 'barBased', 'hybrid'] },
    ui: {
      control: 'select',
      label: 'Rendering Style',
      description: 'Visual rendering approach for market profile',
      options: [
        { value: 'silhouette', label: 'Silhouette' },
        { value: 'barBased', label: 'Bar-Based' },
        { value: 'hybrid', label: 'Hybrid' }
      ]
    }
  },
  distributionDepthMode: {
    type: 'string',
    default: 'all',
    group: 'marketProfile',
    validation: { enum: ['all', 'percentage'] },
    ui: {
      control: 'select',
      label: 'Depth Filtering',
      description: 'How to filter market profile data',
      options: [
        { value: 'all', label: 'All Data' },
        { value: 'percentage', label: 'Top Percentage' }
      ]
    }
  },
  distributionPercentage: {
    type: 'number',
    default: 50,
    group: 'marketProfile',
    validation: { min: 1, max: 100, step: 1 },
    ui: {
      control: 'range',
      label: 'Top Percentage',
      description: 'Show top percentage of volume levels',
      unit: '%'
    }
  },
  showMaxMarker: {
    type: 'boolean',
    default: true,
    group: 'marketProfile',
    ui: {
      control: 'toggle',
      label: 'Show Max Marker',
      description: 'Show Point of Control marker'
    }
  },
  marketProfileOpacity: {
    type: 'number',
    default: 0.8,
    group: 'marketProfile',
    validation: { min: 0.1, max: 1.0, step: 0.1 },
    ui: {
      control: 'range',
      label: 'Opacity',
      description: 'Market profile display opacity',
      unit: '%'
    }
  },
  barMinWidth: {
    type: 'number',
    default: 2,
    group: 'marketProfile',
    validation: { min: 1, max: 10, step: 0.5 },
    ui: {
      control: 'range',
      label: 'Minimum Bar Width',
      description: 'Minimum bar width in pixels',
      unit: 'px'
    }
  },
  positioning: {
    type: 'string',
    default: 'right',
    group: 'marketProfile',
    validation: { enum: ['left', 'right', 'separate'] },
    ui: {
      control: 'select',
      label: 'Positioning',
      description: 'How to position market profile bars',
      options: [
        { value: 'separate', label: 'Separate (Buy Left, Sell Right)' },
        { value: 'left', label: 'Left Side Only' },
        { value: 'right', label: 'Right Side Only' }
      ]
    }
  },
  deltaThreshold: {
    type: 'number',
    default: 0,
    group: 'marketProfile',
    validation: { min: 0, max: 100, step: 1 },
    ui: {
      control: 'range',
      label: 'Delta Threshold',
      description: 'Minimum delta value to display in analysis'
    }
  },
  marketProfileUpColor: {
    type: 'string',
    default: '#10b981',
    group: 'marketProfile',
    validation: { format: 'color' },
    ui: {
      control: 'color',
      label: 'Up Color',
      description: 'Color for positive/buy volume'
    }
  },
  marketProfileDownColor: {
    type: 'string',
    default: '#ef4444',
    group: 'marketProfile',
    validation: { format: 'color' },
    ui: {
      control: 'color',
      label: 'Down Color',
      description: 'Color for negative/sell volume'
    }
  },

  // === COLOR MODE ENHANCEMENTS ===
  marketProfileColorMode: {
    type: 'string',
    default: 'custom',
    group: 'marketProfile',
    validation: { enum: ['buySell', 'leftRight', 'custom'] },
    ui: {
      control: 'select',
      label: 'Color Mode',
      description: 'How to apply colors to market profile',
      options: [
        { value: 'buySell', label: 'Buy/Sell (Traditional)' },
        { value: 'leftRight', label: 'Left/Right Positioning' },
        { value: 'custom', label: 'Custom Single Color' }
      ]
    }
  },
  marketProfileLeftColor: {
    type: 'string',
    default: '#ef4444',
    group: 'marketProfile',
    validation: { format: 'color' },
    ui: {
      control: 'color',
      label: 'Left Side Color',
      description: 'Color for left-side market profile elements'
    }
  },
  marketProfileRightColor: {
    type: 'string',
    default: '#10b981',
    group: 'marketProfile',
    validation: { format: 'color' },
    ui: {
      control: 'color',
      label: 'Right Side Color',
      description: 'Color for right-side market profile elements'
    }
  },
  marketProfileCustomColor: {
    type: 'string',
    default: '#8b5cf6',
    group: 'marketProfile',
    validation: { format: 'color' },
    ui: {
      control: 'color',
      label: 'Custom Color',
      description: 'Single color for all market profile elements (neurosense purple)'
    }
  },

  // === GLOW EFFECTS ===
  marketProfileOutlineGlow: {
    type: 'boolean',
    default: false,
    group: 'marketProfile',
    ui: {
      control: 'toggle',
      label: 'Enable Outline Glow',
      description: 'Add glow effect to market profile outlines'
    }
  },
  marketProfileGlowColor: {
    type: 'string',
    default: '#8b5cf6',
    group: 'marketProfile',
    validation: { format: 'color' },
    ui: {
      control: 'color',
      label: 'Glow Color',
      description: 'Color for the glow effect'
    }
  },
  marketProfileGlowIntensity: {
    type: 'number',
    default: 0.5,
    group: 'marketProfile',
    validation: { min: 0.1, max: 1.0, step: 0.1 },
    ui: {
      control: 'range',
      label: 'Glow Intensity',
      description: 'Strength of the glow effect',
      unit: '%'
    }
  },
  marketProfileGlowSize: {
    type: 'number',
    default: 3,
    group: 'marketProfile',
    validation: { min: 1, max: 10, step: 1 },
    ui: {
      control: 'range',
      label: 'Glow Size',
      description: 'Radius of the glow effect',
      unit: 'px'
    }
  },

  marketProfileMarkerFontSize: {
    type: 'number',
    default: 10,
    group: 'marketProfile',
    validation: { min: 8, max: 16, step: 1 },
    ui: {
      control: 'range',
      label: 'Marker Font Size',
      description: 'Font size for point of control marker',
      unit: 'px'
    }
  },
  silhouetteFill: {
    type: 'boolean',
    default: true,
    group: 'marketProfile',
    ui: {
      control: 'toggle',
      label: 'Fill Silhouette',
      description: 'Fill the market profile silhouette'
    }
  },
  silhouetteFillOpacity: {
    type: 'number',
    default: 0.6,
    group: 'marketProfile',
    validation: { min: 0.1, max: 1.0, step: 0.1 },
    ui: {
      control: 'range',
      label: 'Fill Opacity',
      description: 'Opacity for silhouette fill',
      unit: '%'
    }
  },
  silhouetteFillStyle: {
    type: 'string',
    default: 'solid',
    group: 'marketProfile',
    validation: { enum: ['solid', 'gradient', 'none'] },
    ui: {
      control: 'select',
      label: 'Fill Style',
      description: 'How to fill the silhouette',
      options: [
        { value: 'solid', label: 'Solid Color' },
        { value: 'gradient', label: 'Gradient' },
        { value: 'none', label: 'No Fill' }
      ]
    }
  },
  silhouetteGradientDirection: {
    type: 'string',
    default: 'horizontal',
    group: 'marketProfile',
    validation: { enum: ['horizontal', 'vertical', 'radial'] },
    ui: {
      control: 'select',
      label: 'Gradient Direction',
      description: 'Direction for gradient fills',
      options: [
        { value: 'horizontal', label: 'Horizontal' },
        { value: 'vertical', label: 'Vertical' },
        { value: 'radial', label: 'Radial' }
      ]
    }
  },
  silhouetteOutline: {
    type: 'boolean',
    default: true,
    group: 'marketProfile',
    ui: {
      control: 'toggle',
      label: 'Show Outline',
      description: 'Show silhouette outline'
    }
  },
  silhouetteOutlineColor: {
    type: 'string',
    default: '#6b7280',
    group: 'marketProfile',
    validation: { format: 'color' },
    ui: {
      control: 'color',
      label: 'Outline Color',
      description: 'Color for silhouette outline'
    }
  },
  silhouetteOutlineWidth: {
    type: 'number',
    default: 1,
    group: 'marketProfile',
    validation: { min: 0.5, max: 3, step: 0.5 },
    ui: {
      control: 'range',
      label: 'Outline Width',
      description: 'Width of silhouette outline',
      unit: 'px'
    }
  },
  silhouetteSmoothing: {
    type: 'boolean',
    default: true,
    group: 'marketProfile',
    ui: {
      control: 'toggle',
      label: 'Enable Smoothing',
      description: 'Smooth the silhouette edges'
    }
  },
  silhouetteSmoothingIntensity: {
    type: 'number',
    default: 0.3,
    group: 'marketProfile',
    validation: { min: 0.1, max: 1.0, step: 0.1 },
    ui: {
      control: 'range',
      label: 'Smoothing Intensity',
      description: 'How much to smooth the silhouette',
      unit: '%'
    }
  },

  // === COLORS ===
  priceUpColor: {
    type: 'string',
    default: '#3b82f6',
    group: 'priceDisplay',
    validation: { format: 'color' },
    ui: {
      control: 'color',
      label: 'Up Color',
      description: 'Color for upward price movements'
    }
  },
  priceDownColor: {
    type: 'string',
    default: '#a78bfa',
    group: 'priceDisplay',
    validation: { format: 'color' },
    ui: {
      control: 'color',
      label: 'Down Color',
      description: 'Color for downward price movements'
    }
  },
  priceStaticColor: {
    type: 'string',
    default: '#d1d5db',
    group: 'priceDisplay',
    validation: { format: 'color' },
    ui: {
      control: 'color',
      label: 'Static Color',
      description: 'Static color for price display'
    }
  },

  // === ADR (DAY RANGE METER) ===
  showAdrRangeIndicatorLines: {
    type: 'boolean',
    default: true,
    group: 'adr',
    ui: {
      control: 'toggle',
      label: 'Show ADR Markers',
      description: 'Show ADR percentage markers on day range meter'
    }
  },
  adrLabelType: {
    type: 'string',
    default: 'static',
    group: 'adr',
    validation: { enum: ['static', 'dynamic'] },
    ui: {
      control: 'select',
      label: 'ADR Label Type',
      description: 'Type of ADR labels to display',
      options: [
        { value: 'static', label: 'Static (25%, 50%, 75%, 100%)' },
        { value: 'dynamic', label: 'Dynamic (Current ADR %)' }
      ]
    }
  },
  adrLabelPosition: {
    type: 'string',
    default: 'right',
    group: 'adr',
    validation: { enum: ['left', 'right', 'both'] },
    ui: {
      control: 'select',
      label: 'ADR Label Position',
      description: 'Which side to show ADR markers',
      options: [
        { value: 'left', label: 'Left Side Only' },
        { value: 'right', label: 'Right Side Only' },
        { value: 'both', label: 'Both Sides' }
      ]
    }
  },

  // === HOVER INDICATOR ===
  showHoverIndicator: {
    type: 'boolean',
    default: false,
    group: 'hoverIndicator',
    ui: {
      control: 'toggle',
      label: 'Show Hover Indicator',
      description: 'Enable/disable the entire hover indicator display'
    }
  },
  showHoverLabel: {
    type: 'boolean',
    default: false,
    group: 'hoverIndicator',
    ui: {
      control: 'toggle',
      label: 'Show Label',
      description: 'Show/hide the price label while keeping crosshair lines'
    }
  },
  markerLineColor: {
    type: 'string',
    default: '#FFFFFF',
    group: 'hoverIndicator',
    validation: { format: 'color' },
    ui: {
      control: 'color',
      label: 'Marker Line Color',
      description: 'Color for hover indicator crosshair lines'
    }
  },
  markerLineThickness: {
    type: 'number',
    default: 2,
    group: 'hoverIndicator',
    validation: { min: 0.5, max: 5, step: 0.5 },
    ui: {
      control: 'range',
      label: 'Line Thickness',
      description: 'Thickness of hover indicator lines',
      unit: 'px'
    }
  },
  hoverLabelShowBackground: {
    type: 'boolean',
    default: true,
    group: 'hoverIndicator',
    ui: {
      control: 'toggle',
      label: 'Show Label Background',
      description: 'Display background behind hover price label'
    }
  },
  hoverLabelBackgroundColor: {
    type: 'string',
    default: '#000000',
    group: 'hoverIndicator',
    validation: { format: 'color' },
    ui: {
      control: 'color',
      label: 'Label Background Color',
      description: 'Background color for hover price label'
    }
  },
  hoverLabelBackgroundOpacity: {
    type: 'number',
    default: 0.7,
    group: 'hoverIndicator',
    validation: { min: 0.1, max: 1.0, step: 0.1 },
    ui: {
      control: 'range',
      label: 'Label Background Opacity',
      description: 'Opacity of hover label background',
      unit: '%'
    }
  },
  priceHorizontalOffset: {
    type: 'number',
    default: 0.05,
    group: 'hoverIndicator',
    validation: { min: 0, max: 0.5, step: 0.01 },
    ui: {
      control: 'range',
      label: 'Price Horizontal Offset',
      description: 'Horizontal offset for hover price label from ADR axis',
      unit: '%'
    }
  },
  priceUseStaticColor: {
    type: 'boolean',
    default: false,
    group: 'hoverIndicator',
    ui: {
      control: 'toggle',
      label: 'Use Static Price Color',
      description: 'Use static color instead of direction-based coloring'
    }
  },
  hoverTextSteadyColor: {
    type: 'string',
    default: '#FFFFFF',
    group: 'hoverIndicator',
    validation: { format: 'color' },
    ui: {
      control: 'color',
      label: 'Steady Text Color',
      description: 'Custom steady color for hover price text'
    }
  },
  hoverTextSteadyColorOpacity: {
    type: 'number',
    default: 1.0,
    group: 'hoverIndicator',
    validation: { min: 0.1, max: 1.0, step: 0.1 },
    ui: {
      control: 'range',
      label: 'Steady Color Opacity',
      description: 'Opacity for steady text color',
      unit: '%'
    }
  },

  // === PRICE MARKERS ===
  showPriceMarkers: {
    type: 'boolean',
    default: true,
    group: 'priceMarkers',
    ui: {
      control: 'toggle',
      label: 'Show Price Markers',
      description: 'Display horizontal price level markers'
    }
  },
  priceMarkerLineColor: {
    type: 'string',
    default: '#FFFFFF',
    group: 'priceMarkers',
    validation: { format: 'color' },
    ui: {
      control: 'color',
      label: 'Marker Line Color',
      description: 'Color for price marker lines'
    }
  },
  priceMarkerLineThickness: {
    type: 'number',
    default: 1,
    group: 'priceMarkers',
    validation: { min: 0.5, max: 3, step: 0.5 },
    ui: {
      control: 'range',
      label: 'Line Thickness',
      description: 'Thickness of price marker lines',
      unit: 'px'
    }
  },
  priceMarkerStyle: {
    type: 'string',
    default: 'solid',
    group: 'priceMarkers',
    validation: { enum: ['solid', 'dashed', 'dotted'] },
    ui: {
      control: 'select',
      label: 'Line Style',
      description: 'Visual style for price marker lines',
      options: [
        { value: 'solid', label: 'Solid' },
        { value: 'dashed', label: 'Dashed' },
        { value: 'dotted', label: 'Dotted' }
      ]
    }
  },
  priceMarkerLabelColor: {
    type: 'string',
    default: '#9CA3AF',
    group: 'priceMarkers',
    validation: { format: 'color' },
    ui: {
      control: 'color',
      label: 'Label Color',
      description: 'Color for price marker labels'
    }
  },
  priceMarkerLabelFontSize: {
    type: 'number',
    default: 10,
    group: 'priceMarkers',
    validation: { min: 8, max: 14, step: 1 },
    ui: {
      control: 'range',
      label: 'Label Font Size',
      description: 'Font size for price marker labels',
      unit: 'px'
    }
  },
  priceMarkerLabelMode: {
    type: 'string',
    default: 'right',
    group: 'priceMarkers',
    validation: { enum: ['right', 'left', 'both'] },
    ui: {
      control: 'select',
      label: 'Label Position',
      description: 'Where to show price marker labels',
      options: [
        { value: 'right', label: 'Right Side Only' },
        { value: 'left', label: 'Left Side Only' },
        { value: 'both', label: 'Both Sides' }
      ]
    }
  },
  priceMarkerGlowEnabled: {
    type: 'boolean',
    default: false,
    group: 'priceMarkers',
    ui: {
      control: 'toggle',
      label: 'Enable Glow Effect',
      description: 'Add glow effects to price markers'
    }
  },
  priceMarkerLabelXOffset: {
    type: 'number',
    default: 5,
    group: 'priceMarkers',
    validation: { min: 0, max: 20, step: 1 },
    ui: {
      control: 'range',
      label: 'Label X Offset',
      description: 'Horizontal offset for marker labels from edge',
      unit: 'px'
    }
  }
};

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Get all essential parameters
 */
export const getEssentialParameters = () => {
  return Object.entries(ESSENTIAL_PARAMETERS);
};

/**
 * Get parameters organized by group
 */
export const getParametersByGroup = () => {
  const groups = {};

  Object.entries(ESSENTIAL_PARAMETERS).forEach(([name, config]) => {
    const groupId = config.group;
    if (!groups[groupId]) {
      groups[groupId] = {
        ...CONFIG_GROUPS[groupId],
        parameters: []
      };
    }
    groups[groupId].parameters.push({ name, ...config });
  });

  return groups;
};

/**
 * Get default configuration object
 */
export const getEssentialDefaultConfig = () => {
  const config = {};

  Object.entries(ESSENTIAL_PARAMETERS).forEach(([name, paramConfig]) => {
    config[name] = paramConfig.default;
  });

  return config;
};

/**
 * Get parameter metadata for UI
 */
export const getEssentialParameterMetadata = (parameterName) => {
  const param = ESSENTIAL_PARAMETERS[parameterName];
  if (!param) return null;

  return {
    name: parameterName,
    group: param.group,
    groupTitle: CONFIG_GROUPS[param.group]?.title,
    type: param.type,
    default: param.default,
    validation: param.validation,
    ui: param.ui
  };
};