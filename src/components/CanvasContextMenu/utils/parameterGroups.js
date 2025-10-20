import { defaultConfig } from '../../../data/symbolStore.js';

/**
 * Parameter groups for the CanvasContextMenu component
 * Organizes all 85+ visualization parameters into 6 logical tabs
 */

// Quick Actions (12 parameters): Essential toggles and show/hide controls
export const quickActionsGroup = {
  id: 'quickActions',
  title: 'Quick Actions',
  description: 'Essential toggles and show/hide controls',
  parameters: [
    'showMarketProfile',
    'showVolatilityOrb',
    'showFlash',
    'showVolatilityMetric',
    'showAdrRangeIndicatorLines',
    'showAdrRangeIndicatorLabel',
    'showPriceFloatPulse',
    'showOrbFlash',
    'showPipetteDigit',
    'showPriceBackground',
    'showPriceBoundingBox',
    'showMaxMarker'
  ],
  controlTypes: {
    showMarketProfile: 'toggle',
    showVolatilityOrb: 'toggle',
    showFlash: 'toggle',
    showVolatilityMetric: 'toggle',
    showAdrRangeIndicatorLines: 'toggle',
    showAdrRangeIndicatorLabel: 'toggle',
    showPriceFloatPulse: 'toggle',
    showOrbFlash: 'toggle',
    showPipetteDigit: 'toggle',
    showPriceBackground: 'toggle',
    showPriceBoundingBox: 'toggle',
    showMaxMarker: 'toggle'
  },
  labels: {
    showMarketProfile: 'Market Profile',
    showVolatilityOrb: 'Volatility Orb',
    showFlash: 'Flash Alerts',
    showVolatilityMetric: 'Volatility Metric',
    showAdrRangeIndicatorLines: 'ADR Range Lines',
    showAdrRangeIndicatorLabel: 'ADR Range Label',
    showPriceFloatPulse: 'Price Pulse',
    showOrbFlash: 'Orb Flash',
    showPipetteDigit: 'Show Pipette',
    showPriceBackground: 'Price Background',
    showPriceBoundingBox: 'Price Box Outline',
    showMaxMarker: 'Max Marker'
  }
};

// Price Display (18 parameters): Price float and display settings
export const priceDisplayGroup = {
  id: 'priceDisplay',
  title: 'Price Display',
  description: 'Price float and display settings',
  parameters: [
    'priceFloatWidth',
    'priceFloatHeight',
    'priceFloatXOffset',
    'priceFloatUseDirectionalColor',
    'priceFloatColor',
    'priceFloatUpColor',
    'priceFloatDownColor',
    'priceFloatPulseThreshold',
    'priceFloatPulseColor',
    'priceFloatPulseScale',
    'priceFontSize',
    'priceFontWeight',
    'priceHorizontalOffset',
    'priceDisplayPadding',
    'bigFigureFontSizeRatio',
    'pipFontSizeRatio',
    'pipetteFontSizeRatio',
    'priceUseStaticColor',
    'priceBackgroundColor',
    'priceBackgroundOpacity'
  ],
  controlTypes: {
    priceFloatWidth: 'range',
    priceFloatHeight: 'range',
    priceFloatXOffset: 'range',
    priceFloatUseDirectionalColor: 'toggle',
    priceFloatColor: 'color',
    priceFloatUpColor: 'color',
    priceFloatDownColor: 'color',
    priceFloatPulseThreshold: 'range',
    priceFloatPulseColor: 'color',
    priceFloatPulseScale: 'range',
    priceFontSize: 'range',
    priceFontWeight: 'select',
    priceHorizontalOffset: 'range',
    priceDisplayPadding: 'range',
    bigFigureFontSizeRatio: 'range',
    pipFontSizeRatio: 'range',
    pipetteFontSizeRatio: 'range',
    priceUseStaticColor: 'toggle',
    priceBackgroundColor: 'color',
    priceBackgroundOpacity: 'range'
  },
  labels: {
    priceFloatWidth: 'Float Width',
    priceFloatHeight: 'Float Height',
    priceFloatXOffset: 'Float X Offset',
    priceFloatUseDirectionalColor: 'Directional Color',
    priceFloatColor: 'Float Color',
    priceFloatUpColor: 'Float Up Color',
    priceFloatDownColor: 'Float Down Color',
    priceFloatPulseThreshold: 'Pulse Threshold',
    priceFloatPulseColor: 'Pulse Color',
    priceFloatPulseScale: 'Pulse Scale',
    priceFontSize: 'Font Size',
    priceFontWeight: 'Font Weight',
    priceHorizontalOffset: 'Horizontal Offset',
    priceDisplayPadding: 'Display Padding',
    bigFigureFontSizeRatio: 'Big Figure Ratio',
    pipFontSizeRatio: 'Pip Size Ratio',
    pipetteFontSizeRatio: 'Pipette Size Ratio',
    priceUseStaticColor: 'Use Static Color',
    priceBackgroundColor: 'Price Background Color',
    priceBackgroundOpacity: 'Price Background Opacity'
  },
  controlOptions: {
    priceFontWeight: ['400', '500', '600', '700', '800', '900']
  },
  ranges: {
    priceFloatWidth: { min: 50, max: 200, step: 10 },
    priceFloatHeight: { min: 1, max: 10, step: 1 },
    priceFloatXOffset: { min: -50, max: 50, step: 5 },
    priceFloatPulseThreshold: { min: 0.1, max: 2.0, step: 0.1 },
    priceFloatPulseScale: { min: 1.0, max: 3.0, step: 0.1 },
    priceFontSize: { min: 40, max: 80, step: 5 },
    priceHorizontalOffset: { min: -20, max: 20, step: 2 },
    priceDisplayPadding: { min: 0, max: 20, step: 2 },
    bigFigureFontSizeRatio: { min: 0.5, max: 1.0, step: 0.05 },
    pipFontSizeRatio: { min: 0.5, max: 1.5, step: 0.1 },
    pipetteFontSizeRatio: { min: 0.2, max: 0.8, step: 0.05 },
    priceBackgroundOpacity: { min: 0.1, max: 1.0, step: 0.1 }
  }
};

// Market Profile (20 parameters): Market profile visualization settings
export const marketProfileGroup = {
  id: 'marketProfile',
  title: 'Market Profile',
  description: 'Market profile visualization settings',
  parameters: [
    'marketProfileView',
    'marketProfileUpColor',
    'marketProfileDownColor',
    'marketProfileOpacity',
    'marketProfileOutline',
    'marketProfileOutlineShowStroke',
    'marketProfileOutlineStrokeWidth',
    'marketProfileOutlineUpColor',
    'marketProfileOutlineDownColor',
    'marketProfileOutlineOpacity',
    'distributionDepthMode',
    'distributionPercentage',
    'priceBucketMultiplier',
    'marketProfileWidthRatio',
    'pHighLowLabelSide',
    'ohlLabelSide',
    'pHighLowLabelShowBackground',
    'pHighLowLabelBackgroundColor',
    'pHighLowLabelBackgroundOpacity',
    'pHighLowLabelShowBoxOutline'
  ],
  controlTypes: {
    marketProfileView: 'select',
    marketProfileUpColor: 'color',
    marketProfileDownColor: 'color',
    marketProfileOpacity: 'range',
    marketProfileOutline: 'toggle',
    marketProfileOutlineShowStroke: 'toggle',
    marketProfileOutlineStrokeWidth: 'range',
    marketProfileOutlineUpColor: 'color',
    marketProfileOutlineDownColor: 'color',
    marketProfileOutlineOpacity: 'range',
    distributionDepthMode: 'select',
    distributionPercentage: 'range',
    priceBucketMultiplier: 'range',
    marketProfileWidthRatio: 'range',
    pHighLowLabelSide: 'select',
    ohlLabelSide: 'select',
    pHighLowLabelShowBackground: 'toggle',
    pHighLowLabelBackgroundColor: 'color',
    pHighLowLabelBackgroundOpacity: 'range',
    pHighLowLabelShowBoxOutline: 'toggle'
  },
  labels: {
    marketProfileView: 'View Mode',
    marketProfileUpColor: 'Up Color',
    marketProfileDownColor: 'Down Color',
    marketProfileOpacity: 'Opacity',
    marketProfileOutline: 'Show Outline',
    marketProfileOutlineShowStroke: 'Outline Stroke',
    marketProfileOutlineStrokeWidth: 'Stroke Width',
    marketProfileOutlineUpColor: 'Outline Up Color',
    marketProfileOutlineDownColor: 'Outline Down Color',
    marketProfileOutlineOpacity: 'Outline Opacity',
    distributionDepthMode: 'Depth Mode',
    distributionPercentage: 'Distribution %',
    priceBucketMultiplier: 'Bucket Multiplier',
    marketProfileWidthRatio: 'Width Ratio',
    pHighLowLabelSide: 'PH/PL Label Side',
    ohlLabelSide: 'OHL Label Side',
    pHighLowLabelShowBackground: 'PH/PL Background',
    pHighLowLabelBackgroundColor: 'PH/PL BG Color',
    pHighLowLabelBackgroundOpacity: 'PH/PL BG Opacity',
    pHighLowLabelShowBoxOutline: 'PH/PL Box Outline'
  },
  controlOptions: {
    marketProfileView: ['separate', 'combinedLeft', 'combinedRight'],
    distributionDepthMode: ['all', 'percentage', 'custom'],
    pHighLowLabelSide: ['left', 'right'],
    ohlLabelSide: ['left', 'right']
  },
  ranges: {
    marketProfileOpacity: { min: 0.1, max: 1.0, step: 0.1 },
    marketProfileOutlineStrokeWidth: { min: 1, max: 5, step: 0.5 },
    marketProfileOutlineOpacity: { min: 0.1, max: 1.0, step: 0.1 },
    distributionPercentage: { min: 10, max: 90, step: 5 },
    priceBucketMultiplier: { min: 0.5, max: 2.0, step: 0.1 },
    marketProfileWidthRatio: { min: 0.5, max: 2.0, step: 0.1 },
    pHighLowLabelBackgroundOpacity: { min: 0.1, max: 1.0, step: 0.1 }
  }
};

// Volatility (16 parameters): Volatility orb and flash settings
export const volatilityGroup = {
  id: 'volatility',
  title: 'Volatility',
  description: 'Volatility orb and flash settings',
  parameters: [
    'volatilityColorMode',
    'volatilityOrbBaseWidth',
    'volatilityOrbInvertBrightness',
    'volatilitySizeMultiplier',
    'flashThreshold',
    'flashIntensity',
    'orbFlashThreshold',
    'orbFlashIntensity',
    'adrRange',
    'adrLookbackDays',
    'adrProximityThreshold',
    'adrPulseColor',
    'adrPulseWidthRatio',
    'adrPulseHeight',
    'adrRangeIndicatorLinesColor',
    'adrRangeIndicatorLinesThickness'
  ],
  controlTypes: {
    volatilityColorMode: 'select',
    volatilityOrbBaseWidth: 'range',
    volatilityOrbInvertBrightness: 'toggle',
    volatilitySizeMultiplier: 'range',
    flashThreshold: 'range',
    flashIntensity: 'range',
    orbFlashThreshold: 'range',
    orbFlashIntensity: 'range',
    adrRange: 'range',
    adrLookbackDays: 'range',
    adrProximityThreshold: 'range',
    adrPulseColor: 'color',
    adrPulseWidthRatio: 'range',
    adrPulseHeight: 'range',
    adrRangeIndicatorLinesColor: 'color',
    adrRangeIndicatorLinesThickness: 'range'
  },
  labels: {
    volatilityColorMode: 'Color Mode',
    volatilityOrbBaseWidth: 'Base Width',
    volatilityOrbInvertBrightness: 'Invert Brightness',
    volatilitySizeMultiplier: 'Size Multiplier',
    flashThreshold: 'Flash Threshold',
    flashIntensity: 'Flash Intensity',
    orbFlashThreshold: 'Orb Flash Threshold',
    orbFlashIntensity: 'Orb Flash Intensity',
    adrRange: 'ADR Range',
    adrLookbackDays: 'ADR Lookback Days',
    adrProximityThreshold: 'ADR Proximity',
    adrPulseColor: 'ADR Pulse Color',
    adrPulseWidthRatio: 'ADR Pulse Width',
    adrPulseHeight: 'ADR Pulse Height',
    adrRangeIndicatorLinesColor: 'ADR Line Color',
    adrRangeIndicatorLinesThickness: 'ADR Line Thickness'
  },
  controlOptions: {
    volatilityColorMode: ['single', 'intensity', 'directional']
  },
  ranges: {
    volatilityOrbBaseWidth: { min: 100, max: 300, step: 10 },
    volatilitySizeMultiplier: { min: 0.5, max: 3.0, step: 0.1 },
    flashThreshold: { min: 0.5, max: 5.0, step: 0.5 },
    flashIntensity: { min: 0.1, max: 1.0, step: 0.1 },
    orbFlashThreshold: { min: 0.5, max: 5.0, step: 0.5 },
    orbFlashIntensity: { min: 0.1, max: 1.0, step: 0.1 },
    adrRange: { min: 50, max: 200, step: 10 },
    adrLookbackDays: { min: 5, max: 30, step: 1 },
    adrProximityThreshold: { min: 5, max: 50, step: 5 },
    adrPulseWidthRatio: { min: 0.5, max: 2.0, step: 0.1 },
    adrPulseHeight: { min: 1, max: 10, step: 1 },
    adrRangeIndicatorLinesThickness: { min: 1, max: 5, step: 0.5 }
  }
};

// Layout & Sizing (12 parameters): Dimensions and positioning
export const layoutSizingGroup = {
  id: 'layoutSizing',
  title: 'Layout & Sizing',
  description: 'Dimensions and positioning',
  parameters: [
    'visualizationsContentWidth',
    'meterHeight',
    'centralAxisXPosition',
    'adrRangeIndicatorLabelColor',
    'adrRangeIndicatorLabelShowBackground',
    'adrRangeIndicatorLabelBackgroundColor',
    'adrRangeIndicatorLabelBackgroundOpacity',
    'adrRangeIndicatorLabelShowBoxOutline',
    'adrRangeIndicatorLabelBoxOutlineColor',
    'adrRangeIndicatorLabelBoxOutlineOpacity',
    'adrLabelType',
    'priceStaticColor'
  ],
  controlTypes: {
    visualizationsContentWidth: 'range',
    meterHeight: 'range',
    centralAxisXPosition: 'range',
    adrRangeIndicatorLabelColor: 'color',
    adrRangeIndicatorLabelShowBackground: 'toggle',
    adrRangeIndicatorLabelBackgroundColor: 'color',
    adrRangeIndicatorLabelBackgroundOpacity: 'range',
    adrRangeIndicatorLabelShowBoxOutline: 'toggle',
    adrRangeIndicatorLabelBoxOutlineColor: 'color',
    adrRangeIndicatorLabelBoxOutlineOpacity: 'range',
    adrLabelType: 'select',
    priceStaticColor: 'color'
  },
  labels: {
    visualizationsContentWidth: 'Content Width',
    meterHeight: 'Meter Height',
    centralAxisXPosition: 'Central Axis X',
    adrRangeIndicatorLabelColor: 'ADR Label Color',
    adrRangeIndicatorLabelShowBackground: 'ADR Label BG',
    adrRangeIndicatorLabelBackgroundColor: 'ADR Label BG Color',
    adrRangeIndicatorLabelBackgroundOpacity: 'ADR Label BG Opacity',
    adrRangeIndicatorLabelShowBoxOutline: 'ADR Label Box',
    adrRangeIndicatorLabelBoxOutlineColor: 'ADR Label Box Color',
    adrRangeIndicatorLabelBoxOutlineOpacity: 'ADR Label Box Opacity',
    adrLabelType: 'ADR Label Type',
    priceStaticColor: 'Price Static Color'
  },
  controlOptions: {
    adrLabelType: ['dynamicPercentage', 'fixedPips', 'absolutePrice']
  },
  ranges: {
    visualizationsContentWidth: { min: 200, max: 400, step: 10 },
    meterHeight: { min: 100, max: 200, step: 10 },
    centralAxisXPosition: { min: 150, max: 300, step: 10 },
    adrRangeIndicatorLabelBackgroundOpacity: { min: 0.1, max: 1.0, step: 0.1 },
    adrRangeIndicatorLabelBoxOutlineOpacity: { min: 0.1, max: 1.0, step: 0.1 }
  }
};

// Advanced (17 parameters): Power user and experimental features
export const advancedGroup = {
  id: 'advanced',
  title: 'Advanced',
  description: 'Power user and experimental features',
  parameters: [
    'frequencyMode',
    'markerLineColor',
    'markerLineThickness',
    'hoverLabelShowBackground',
    'hoverLabelBackgroundColor',
    'hoverLabelBackgroundOpacity',
    'pHighLowLabelBoxOutlineColor',
    'pHighLowLabelBoxOutlineOpacity',
    'ohlLabelShowBackground',
    'ohlLabelBackgroundColor',
    'ohlLabelBackgroundOpacity',
    'ohlLabelShowBoxOutline',
    'ohlLabelBoxOutlineColor',
    'ohlLabelBoxOutlineOpacity',
    'priceUpColor',
    'priceDownColor',
    'priceBoxOutlineColor',
    'priceBoxOutlineOpacity'
  ],
  controlTypes: {
    frequencyMode: 'select',
    markerLineColor: 'color',
    markerLineThickness: 'range',
    hoverLabelShowBackground: 'toggle',
    hoverLabelBackgroundColor: 'color',
    hoverLabelBackgroundOpacity: 'range',
    pHighLowLabelBoxOutlineColor: 'color',
    pHighLowLabelBoxOutlineOpacity: 'range',
    ohlLabelShowBackground: 'toggle',
    ohlLabelBackgroundColor: 'color',
    ohlLabelBackgroundOpacity: 'range',
    ohlLabelShowBoxOutline: 'toggle',
    ohlLabelBoxOutlineColor: 'color',
    ohlLabelBoxOutlineOpacity: 'range',
    priceUpColor: 'color',
    priceDownColor: 'color',
    priceBoxOutlineColor: 'color',
    priceBoxOutlineOpacity: 'range'
  },
  labels: {
    frequencyMode: 'Frequency Mode',
    markerLineColor: 'Marker Line Color',
    markerLineThickness: 'Marker Line Thickness',
    hoverLabelShowBackground: 'Hover Label BG',
    hoverLabelBackgroundColor: 'Hover Label BG Color',
    hoverLabelBackgroundOpacity: 'Hover Label BG Opacity',
    pHighLowLabelBoxOutlineColor: 'PH/PL Box Color',
    pHighLowLabelBoxOutlineOpacity: 'PH/PL Box Opacity',
    ohlLabelShowBackground: 'OHL Label BG',
    ohlLabelBackgroundColor: 'OHL Label BG Color',
    ohlLabelBackgroundOpacity: 'OHL Label BG Opacity',
    ohlLabelShowBoxOutline: 'OHL Label Box',
    ohlLabelBoxOutlineColor: 'OHL Label Box Color',
    ohlLabelBoxOutlineOpacity: 'OHL Label Box Opacity',
    priceUpColor: 'Price Up Color',
    priceDownColor: 'Price Down Color',
    priceBoxOutlineColor: 'Price Box Color',
    priceBoxOutlineOpacity: 'Price Box Opacity'
  },
  controlOptions: {
    frequencyMode: ['slow', 'normal', 'fast', 'ultraFast']
  },
  ranges: {
    markerLineThickness: { min: 1, max: 5, step: 0.5 },
    hoverLabelBackgroundOpacity: { min: 0.1, max: 1.0, step: 0.1 },
    pHighLowLabelBoxOutlineOpacity: { min: 0.1, max: 1.0, step: 0.1 },
    ohlLabelBackgroundOpacity: { min: 0.1, max: 1.0, step: 0.1 },
    ohlLabelBoxOutlineOpacity: { min: 0.1, max: 1.0, step: 0.1 },
    priceBoxOutlineOpacity: { min: 0.1, max: 1.0, step: 0.1 }
  }
};

// All parameter groups in order
export const parameterGroups = [
  quickActionsGroup,
  priceDisplayGroup,
  marketProfileGroup,
  volatilityGroup,
  layoutSizingGroup,
  advancedGroup
];

// Get all parameters from all groups
export const getAllParameters = () => {
  return parameterGroups.reduce((allParams, group) => {
    return [...allParams, ...group.parameters];
  }, []);
};

// Get parameter group by parameter name
export const getParameterGroup = (parameterName) => {
  return parameterGroups.find(group => 
    group.parameters.includes(parameterName)
  );
};

// Get parameter metadata (type, label, options, etc.)
export const getParameterMetadata = (parameterName) => {
  const group = getParameterGroup(parameterName);
  if (!group) return null;
  
  return {
    group: group.id,
    type: group.controlTypes[parameterName],
    label: group.labels[parameterName],
    options: group.controlOptions?.[parameterName],
    range: group.ranges?.[parameterName],
    defaultValue: defaultConfig[parameterName]
  };
};

// Get parameters by control type
export const getParametersByType = (controlType) => {
  const result = [];
  
  parameterGroups.forEach(group => {
    group.parameters.forEach(param => {
      if (group.controlTypes[param] === controlType) {
        result.push({
          name: param,
          label: group.labels[param],
          group: group.id,
          defaultValue: defaultConfig[param]
        });
      }
    });
  });
  
  return result;
};

// Get parameter count by group
export const getParameterCountByGroup = () => {
  const counts = {};
  
  parameterGroups.forEach(group => {
    counts[group.id] = group.parameters.length;
  });
  
  return counts;
};

// Validate that all config parameters are included in groups
export const validateParameterCoverage = () => {
  const configParams = Object.keys(defaultConfig);
  const groupedParams = getAllParameters();
  
  const missingParams = configParams.filter(param => !groupedParams.includes(param));
  const extraParams = groupedParams.filter(param => !configParams.includes(param));
  
  return {
    totalConfigParams: configParams.length,
    totalGroupedParams: groupedParams.length,
    missingParams,
    extraParams,
    isValid: missingParams.length === 0 && extraParams.length === 0
  };
};
