/**
 * Foundation-First Volatility Orb Implementation
 * 
 * Built on proven foundation patterns from marketProfile.js and priceDisplay.js
 * Delivers cognitive-aware volatility visualization with:
 * - DPR-aware crisp rendering
 * - Background element positioning with configurable positioning
 * - Multi-mode visualization (directional, static, intensity)
 * - Performance optimization for 60fps with 20+ displays
 * - Comprehensive error handling with graceful fallbacks
 * - Alert system integration with flash mechanisms
 */

import { boundsUtils } from '../../utils/canvasSizing.js';

export function drawVolatilityOrb(ctx, renderingContext, config, state, y) {
  // Guard clauses for safety (FOUNDATION PATTERN)
  if (!ctx || !renderingContext || !config || !state || !y) {
    console.warn('[VolatilityOrb] Missing required parameters, skipping render');
    return;
  }

  // Early exit for performance (COGNITIVE PATTERN)
  if (!config.showVolatilityOrb) {
    return;
  }

  // Extract rendering context from the unified infrastructure
  const { contentArea, adrAxisX } = renderingContext;
  
  // Extract essential data - use existing worker structure
  const { 
    volatility,
    currentPrice,
    lastTickDirection
  } = state;

  // Guard for essential data
  if (currentPrice === undefined || currentPrice === null || volatility === undefined || volatility === null) {
    console.warn('[VolatilityOrb] Missing required data fields, skipping render');
    console.warn('[VolatilityOrb] - currentPrice:', currentPrice);
    console.warn('[VolatilityOrb] - volatility:', volatility);
    return;
  }

  // === FOUNDATION LAYER IMPLEMENTATION ===
  // 1. Calculate render data with bounds checking and percentage conversion
  const renderData = validateRenderData(contentArea, adrAxisX, config);

  // Handle validation errors gracefully (no ctx.restore() here - handled in main function)
  if (!renderData.shouldRender) {
    console.error('[VolatilityOrb] RENDERING CHAIN - Validation failed:', renderData.error);
    return;
  }

  // 2. Configure render context for crisp rendering
  configureRenderContext(ctx);

  // 3. Process volatility data with validation
  const orbData = processVolatilityData(volatility, currentPrice, lastTickDirection, y);

  // Early exit for invalid data
  if (!orbData.isValid) {
    console.warn('[VolatilityOrb] Invalid volatility data, skipping render');
    ctx.restore();
    return;
  }

  // 4. Draw core orb (COGNITIVE PATTERN - background element)
  drawVolatilityOrbCore(ctx, renderData, orbData, config);

  // 5. Add enhancements with bounds checking (foundation pattern)
  addEnhancements(ctx, renderData, orbData, config, state, contentArea);

  // 6. Restore context state (FOUNDATION PATTERN)
  ctx.restore();
}

/**
 * Validate render data and apply max-dimension responsive sizing
 * 🎯 NEW: Implements configurable positioning modes (canvasCenter/adrAxis)
 */
function validateRenderData(contentArea, adrAxisX, config) {
  // 🔧 FIXED: Convert percentage to decimal to match standard pattern
  // Follow priceFloat and marketProfile pattern for consistency
  const baseWidthPercentage = parseFloat(config.volatilityOrbBaseWidth) || 91; // Store as percentage (91%)
  const baseWidthRatio = baseWidthPercentage / 100; // Convert percentage to decimal
  const sizeMultiplierRaw = parseFloat(config.volatilitySizeMultiplier) || 1.5;
  
  // 🎯 RESPONSIVE ARCHITECTURE: Use max canvas dimension for scaling
  const maxDimension = Math.max(contentArea.width, contentArea.height);
  const orbBaseWidth = maxDimension * baseWidthRatio;
  
  // 🎯 NEW: Calculate orb position based on positioning mode
  let orbX;
  switch (config.volatilityOrbPositionMode) {
    case 'canvasCenter':
      orbX = contentArea.width / 2; // 50% from left (canvas center)
      break;
    case 'adrAxis':
    default:
      orbX = adrAxisX; // ADR axis position (fallback)
      break;
  }
  
  // 🎯 NEW: Apply X offset if configured
  if (config.volatilityOrbXOffset) {
    const xOffsetPixels = (contentArea.width * config.volatilityOrbXOffset) / 100;
    orbX += xOffsetPixels;
  }
  
  // Robust validation with fallbacks (FOUNDATION PATTERN)
  if (isNaN(baseWidthRatio) || isNaN(sizeMultiplierRaw) || isNaN(maxDimension)) {
    console.error('[VolatilityOrb] FORENSIC - Invalid calculated values:', { 
      baseWidthRatio, 
      sizeMultiplierRaw, 
      maxDimension,
      contentAreaWidth: contentArea.width,
      contentAreaHeight: contentArea.height
    });
    return { shouldRender: false, error: 'Invalid calculations' };
  }

  // Validate final calculations
  if (isNaN(orbBaseWidth) || isNaN(orbX)) {
    console.error('[VolatilityOrb] FORENSIC - Invalid final calculations:', { 
      orbBaseWidth, 
      orbX, 
      maxDimension,
      baseWidthRatio 
    });
    return { shouldRender: false, error: 'Invalid final calculations' };
  }

  return {
    shouldRender: true,
    orbBaseWidth,
    orbX,
    maxDimension,
    sizeMultiplier: sizeMultiplierRaw,
    ...validateVolatilityConfig(config)
  };
}

/**
 * Configure canvas context for crisp rendering
 * Uses proven DPR-aware patterns from dayRangeMeter.js and marketProfile.js
 */
function configureRenderContext(ctx) {
  ctx.save();
  
  // Sub-pixel alignment for crisp 1px lines
  ctx.translate(0.5, 0.5);
  
  // Disable anti-aliasing for sharp rendering
  ctx.imageSmoothingEnabled = false;
}

/**
 * Process volatility data from worker with validation
 * Foundation pattern: leverage existing data processing
 */
function processVolatilityData(volatility, currentPrice, lastTickDirection, y) {
  // Validate worker data with safe defaults
  const safeVolatility = volatility || 0;
  const safePrice = currentPrice || 0;
  const safeDirection = lastTickDirection || 'up';
  
  // Pre-calculate Y position for performance (FOUNDATION PATTERN)
  const priceY = y(safePrice);
  
  // Validate data integrity
  const isValid = safeVolatility >= 0 && safePrice > 0 && !isNaN(priceY);
  
  return {
    volatility: safeVolatility,
    priceY,
    direction: safeDirection,
    isValid
  };
}

/**
 * Draw core volatility orb with cognitive-aware background positioning
 * 🎯 Z-INDEX FIX: Uses higher transparency for background rendering
 */
function drawVolatilityOrbCore(ctx, renderData, orbData, config) {
  const { orbX, sizeMultiplier } = renderData;
  const { volatility, priceY } = orbData;

  // Calculate orb dimensions based on volatility
  const { orbRadius } = calculateOrbDimensions(renderData.orbBaseWidth, volatility, sizeMultiplier);

  // Determine color based on mode (COGNITIVE PATTERN)
  const orbColor = calculateVolatilityColor(orbData, config);

  // 🎯 Z-INDEX FIX: Create gradient with higher transparency for background rendering
  // Background elements should have lower visual priority than foreground elements
  const gradient = ctx.createRadialGradient(orbX, priceY, 0, orbX, priceY, orbRadius);
  gradient.addColorStop(0, orbColor + '40'); // More transparent at center (40% opacity)
  gradient.addColorStop(0.5, orbColor + '20'); // Even more transparent (20% opacity)
  gradient.addColorStop(1, orbColor + '00'); // Fully transparent at edges

  // Draw background orb with reduced opacity for proper layering
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(orbX, priceY, orbRadius, 0, 2 * Math.PI);
  ctx.fill();

  // 🎯 Z-INDEX FIX: Remove glow effect for background positioning
  // Glow effects make elements appear more prominent, interfering with layering
  // Only apply glow if explicitly configured for foreground emphasis
  if (!config.volatilityOrbBackgroundMode) {
    applyGlowEffect(ctx, orbX, priceY, orbRadius, orbColor, config);
  }
}

/**
 * Calculate orb dimensions with content-relative sizing
 */
function calculateOrbDimensions(orbBaseWidth, volatility, sizeMultiplier) {
  // Calculate radius based on volatility intensity
  const orbRadius = (orbBaseWidth / 2) * (volatility / 100) * sizeMultiplier;
  
  return {
    orbRadius: Math.max(2, orbRadius) // Minimum 2px for visibility
  };
}

/**
 * Calculate volatility color based on visualization mode
 * Cognitive flexibility: runtime selection between different approaches
 */
function calculateVolatilityColor(orbData, config) {
  const { volatility, direction } = orbData;
  const { volatilityColorMode } = config;

  switch (volatilityColorMode) {
    case 'directional':
      // Direction-aware color coding - supports trend recognition
      return direction === 'up' 
        ? (config.priceUpColor || '#3b82f6') 
        : (config.priceDownColor || '#ef4444');
      
    case 'static':
      // Consistent color - reduces cognitive load during extended sessions
      return config.priceStaticColor || '#d1d5db';
      
    case 'intensity':
      // Volatility-based color intensity - perceptual scaling
      const intensity = Math.min(1.0, volatility / 100);
      return interpolateColor('#10b981', '#ef4444', intensity);
      
    default:
      return config.priceStaticColor || '#d1d5db';
  }
}

/**
 * Apply glow effect with environmental adaptation
 * 🎯 Z-INDEX FIX: Only apply for foreground mode, not background
 * 🔧 FIX: Eliminated stroke that causes line artifact around perimeter
 * 🔧 CLEANUP: Removed price float glow parameters - uses orb color directly
 */
function applyGlowEffect(ctx, orbX, orbY, orbRadius, orbColor, config) {
  // Skip glow effect for background mode to maintain proper layering
  if (config.volatilityOrbBackgroundMode === 'background') {
    return;
  }

  // 🔧 CLEANUP: Use orb color directly instead of price float glow parameters
  const glowStrength = 8; // Fixed reasonable default

  // Apply brightness inversion if configured (environmental adaptation)
  let finalGlowColor = orbColor;
  if (config.volatilityOrbInvertBrightness) {
    finalGlowColor = invertColorBrightness(orbColor);
  }

  // 🔧 FIXED: Apply glow effect without stroke to eliminate perimeter line
  ctx.shadowColor = finalGlowColor;
  ctx.shadowBlur = glowStrength;
  ctx.fillStyle = orbColor + '20'; // Semi-transparent fill instead of stroke
  ctx.beginPath();
  ctx.arc(orbX, orbY, orbRadius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.shadowBlur = 0;
}

/**
 * Add enhancements with bounds checking (foundation pattern)
 * 
 * ✅ FOUNDATION PATTERN: Core elements always render, enhancements only get bounds checked
 * - Volatility metric: CORE element - always renders with fixed positioning
 * - Flash effects: ENHANCEMENT - gets bounds checking for performance
 */
function addEnhancements(ctx, renderData, orbData, config, state, contentArea) {
  // Core orb always renders (trader requirement)
  
  // ✅ FIXED: Volatility metric is CORE information - always visible to traders
  // Moved to fixed positioning to avoid bounds issues (following priceDisplay.js pattern)
  if (config.showVolatilityMetric) {
    drawVolatilityMetric(ctx, renderData, orbData, config, contentArea);
  }
  
  // ✅ ENHANCEMENT PATTERN: Apply bounds checking ONLY to true enhancements
  // Flash effects are visual enhancements - safe to optimize with bounds checking
  if (config.showOrbFlash && shouldFlash(state, config)) {
    // Only render flash if within reasonable bounds (performance optimization)
    if (boundsUtils.isYInBounds(orbData.priceY, config, { canvasArea: contentArea })) {
      applyVolatilityFlash(ctx, renderData, config);
    }
  }
}

/**
 * Draw volatility metric with fixed positioning (foundation pattern)
 * 🔧 FIXED: Fixed positioning to bottom left of canvas instead of tracking price
 * Following dayRangeMeter.js pattern for consistent text styling
 */
function drawVolatilityMetric(ctx, renderData, orbData, config, contentArea) {
  const { orbX } = renderData;
  const { priceY, volatility } = orbData;

  ctx.save();
  
  // 🔧 FIXED: Use consistent font sizing matching dayRangeMeter (10px sans-serif)
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  
  // 🔧 FIXED: Remove non-sensical % symbol - volatility is already a percentage
  // Display as "σ: 25.5" instead of "σ: 25.5%"
  const volatilityText = `σ: ${volatility.toFixed(1)}`;
  const textMetrics = ctx.measureText(volatilityText);
  
  // 🔧 FIXED: Fixed positioning to bottom left of canvas for consistency
  // Following priceDisplay.js pattern - no bounds checking needed for fixed position
  const fixedTextX = 20; // Fixed distance from left edge
  const fixedTextY = contentArea.height - 15; // Fixed distance from bottom (15px margin)
  
  const textX = fixedTextX;
  const textY = fixedTextY;
  
  // Draw text background if configured
  if (config.priceDisplayPadding > 0) {
    const padding = config.priceDisplayPadding;
    const bgX = textX - padding;
    const bgY = textY - 5 - padding; // Fixed 5px (half of 10px font)
    const bgWidth = textMetrics.width + (padding * 2);
    const bgHeight = 10 + (padding * 2); // Fixed 10px font height
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
  }
  
  // 🔧 FIXED: Use consistent grey color matching dayRangeMeter percentage markers
  // Replaces directional coloring with neutral grey for better visual consistency
  const textColor = '#9CA3AF'; // Same grey as dayRangeMeter percentage markers
  ctx.fillStyle = textColor;
  ctx.fillText(volatilityText, textX, textY);
  
  ctx.restore();
}

/**
 * Check if flash should be triggered (alert system integration)
 */
function shouldFlash(state, config) {
  if (!config.showOrbFlash) return false;
  
  const priceChange = Math.abs(state.tickDelta || 0);
  const threshold = config.orbFlashThreshold || 2.0;
  
  return priceChange >= threshold;
}

/**
 * Apply volatility flash for significant market events
 */
function applyVolatilityFlash(ctx, renderData, config) {
  const intensity = config.orbFlashIntensity || 0.8;
  
  ctx.save();
  
  // Apply flash overlay without disrupting base rendering
  ctx.globalAlpha = intensity;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, renderData.orbBaseWidth * 2, renderData.orbBaseWidth * 2);
  
  ctx.restore();
}

/**
 * Validate volatility configuration with type safety
 * 🔧 CLEANUP: Removed inappropriate price float glow parameters
 */
function validateVolatilityConfig(config) {
  const validatedConfig = {
    showVolatilityOrb: Boolean(config.showVolatilityOrb),
    volatilityColorMode: ['directional', 'static', 'intensity'].includes(config.volatilityColorMode) 
      ? config.volatilityColorMode 
      : 'directional',
    // 🔧 FIXED: Use percentage values (10-200 range) with validation
    // 10 = 10%, 200 = 200%, default 91 = 91%
    volatilityOrbBaseWidth: Math.max(10, Math.min(200, parseFloat(config.volatilityOrbBaseWidth) || 91)),
    volatilityOrbPositionMode: ['canvasCenter', 'adrAxis'].includes(config.volatilityOrbPositionMode)
      ? config.volatilityOrbPositionMode
      : 'canvasCenter',
    volatilityOrbXOffset: Math.max(-25, Math.min(25, parseFloat(config.volatilityOrbXOffset) || 0)),
    volatilityOrbInvertBrightness: Boolean(config.volatilityOrbInvertBrightness),
    volatilitySizeMultiplier: Math.max(0.1, Math.min(5.0, parseFloat(config.volatilitySizeMultiplier) || 1.5)),
    showVolatilityMetric: Boolean(config.showVolatilityMetric),
    showOrbFlash: Boolean(config.showOrbFlash),
    orbFlashThreshold: parseFloat(config.orbFlashThreshold) || 2.0,
    orbFlashIntensity: Math.max(0.1, Math.min(1.0, parseFloat(config.orbFlashIntensity) || 0.8)),
    priceUseStaticColor: Boolean(config.priceUseStaticColor),
    priceStaticColor: config.priceStaticColor || '#d1d5db',
    priceUpColor: config.priceUpColor || '#3b82f6',
    priceDownColor: config.priceDownColor || '#ef4444',
    // 🔧 CLEANUP: Remove price float glow parameters - use orb color directly
    priceFontSize: parseFloat(config.priceFontSize) || 10,
    priceDisplayPadding: parseFloat(config.priceDisplayPadding) || 4
  };
  
  return validatedConfig;
}

/**
 * Interpolate between two colors for intensity visualization
 */
function interpolateColor(color1, color2, intensity) {
  // Simple interpolation - could be enhanced with proper color space conversion
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) return color1;
  
  const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * intensity);
  const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * intensity);
  const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * intensity);
  
  return `rgb(${r},${g},${b})`;
}

/**
 * Invert color brightness for environmental adaptation
 */
function invertColorBrightness(color) {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  
  const brightness = (rgb.r + rgb.g + rgb.b) / 3;
  const factor = brightness > 128 ? 0.5 : 2;
  
  const r = Math.min(255, rgb.r * factor);
  const g = Math.min(255, rgb.g * factor);
  const b = Math.min(255, rgb.b * factor);
  
  return `rgb(${r},${g},${b})`;
}

/**
 * Helper function to convert hex to RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}
