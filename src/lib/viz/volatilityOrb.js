/**
 * Volatility Orb Visualization - Simple Implementation
 *
 * Background visualization element that provides real-time market volatility assessment
 * through multi-mode rendering while maintaining cognitive-aware design principles.
 *
 * Design Foundation: "Simple, Performant, Maintainable"
 * - Background element that supports rather than competes with foreground analysis
 * - Pre-attentive visual attributes for instant volatility recognition
 * - Extended session comfort through reduced cognitive load
 */

import { boundsUtils, configureTextForDPR } from '../../utils/canvasSizing.js';

export function drawVolatilityOrb(ctx, renderingContext, config, state, y) {
  // Guard clauses for safety
  if (!ctx || !renderingContext || !config || !state || !y) {
    console.warn('[VolatilityOrb] Missing required parameters, skipping render');
    return;
  }

  // Early exit if disabled
  if (!config.showVolatilityOrb) {
    return;
  }

  // Extract rendering context from the unified infrastructure
  const { contentArea } = renderingContext;

  // Extract essential data
  const {
    volatility,        // Current volatility value
    currentPrice,      // Current tick price
    lastTickDirection, // 'up', 'down', or undefined
    direction,         // Overall direction
    ticks = []         // Tick data array
  } = state;

  // Guard for essential data
  if (currentPrice === undefined || currentPrice === null ||
      volatility === undefined || volatility === null) {
    console.warn('[VolatilityOrb] Missing essential data (currentPrice, volatility), skipping render');
    return;
  }

  // === FOUNDATION LAYER IMPLEMENTATION ===
  // 1. Calculate render data (always calculate for core element)
  const renderData = calculateRenderData(contentArea, config, state);

  // 2. Configure render context for crisp rendering
  configureRenderContext(ctx);

  // 3. ALWAYS draw core orb (trader requirement)
  drawCoreOrb(ctx, renderData, config, state);

  // 4. Apply enhancements only if enabled
  if (config.showOrbFlash) {
    addFlashEnhancement(ctx, renderData, config, state);
  }
}

/**
 * Calculate render data using contentArea coordinates
 */
function calculateRenderData(contentArea, config, state) {
  // Calculate orb center using new positioning parameters (decimal percentages)
  const centerX = contentArea.width * (config.volatilityOrbXPosition || 0.5);
  const centerY = contentArea.height * (config.volatilityOrbYPosition || 0.5);

  // Calculate base radius using smaller dimension for better fit
  const baseSize = Math.min(contentArea.width, contentArea.height);
  const baseRadius = baseSize * (config.volatilityOrbBaseWidth || 0.4) / 2;

  // Calculate size based on volatility with logarithmic scaling
  const volatilityScale = Math.min(2.0, Math.max(0.5, (state.volatility || 0) * 0.8));
  const radius = baseRadius * volatilityScale * (config.volatilitySizeMultiplier || 1.0);

  return {
    centerX,
    centerY,
    radius,
    baseRadius,
    contentArea,
    volatility: state.volatility || 0,
    direction: state.lastTickDirection || state.direction || 'neutral',
    latestTick: state.ticks?.[state.ticks.length - 1] || null,
    state
  };
}

/**
 * Configure canvas context for crisp rendering
 */
function configureRenderContext(ctx) {
  ctx.save();
  ctx.translate(0.5, 0.5); // Sub-pixel alignment for crisp rendering
}

/**
 * Draw core orb element - always rendered (foundation pattern)
 */
function drawCoreOrb(ctx, renderData, config, state) {
  const { centerX, centerY, radius, contentArea } = renderData;

  // Create radial gradient for soft glow effect
  const gradient = ctx.createRadialGradient(
    centerX, centerY, 0,
    centerX, centerY, radius * (config.gradientSpread || 1.2)
  );

  // Apply gradient colors based on color mode
  const centerColor = getOrbColor(config, renderData, 1.0);
  const midColor = getOrbColor(config, renderData, 0.3);

  gradient.addColorStop(0, centerColor);
  gradient.addColorStop(config.gradientSoftness || 0.7, midColor);
  gradient.addColorStop(1, 'transparent');

  // Draw orb as background fill covering content area
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, contentArea.width, contentArea.height);

  ctx.restore();
}

/**
 * Get orb color based on color mode configuration
 */
function getOrbColor(config, renderData, intensity = 1.0) {
  const { volatilityColorMode, priceUpColor, priceDownColor, priceStaticColor } = config;
  const { direction, volatility } = renderData;

  switch (volatilityColorMode) {
    case 'directional':
      // Use existing lastTickDirection for consistent direction detection
      const actualDirection = direction;

      // Direction-aware color coding for trend recognition
      return actualDirection === 'up'
        ? hexToRgba(priceUpColor || '#3b82f6', intensity)
        : actualDirection === 'down'
        ? hexToRgba(priceDownColor || '#a78bfa', intensity)
        : hexToRgba(priceStaticColor || '#d1d5db', intensity);

    case 'static':
      // Single color for reduced cognitive load
      return hexToRgba(priceStaticColor || '#d1d5db', intensity);

    case 'intensity':
      // Logarithmic intensity scaling for perceptual volatility mapping
      const rawIntensity = volatility > 0
        ? Math.log(Math.max(0.1, volatility + 0.1)) / Math.log(10)
        : 0;
      const intensityValue = Math.min(1.0, rawIntensity);
      // Use configuration-driven color instead of hardcoded blue
      const baseColor = priceStaticColor || priceUpColor || '#d1d5db';
      return hexToRgba(baseColor, intensityValue * intensity);

    default:
      return hexToRgba(priceUpColor || '#3b82f6', intensity);
  }
}

/**
 * Add flash enhancement for significant market events
 */
function addFlashEnhancement(ctx, renderData, config, state) {
  if (shouldFlash(renderData, config)) {
    applyOrbFlash(ctx, renderData);
  }
}

/**
 * Determine if flash should be triggered based on tick magnitude AND direction consistency
 */
function shouldFlash(renderData, config) {
  const latestTick = renderData.latestTick;
  const state = renderData.state;

  if (!latestTick || !state?.ticks || state.ticks.length < 2) {
    return false;
  }

  // Get the two most recent ticks for direction comparison
  const currentTick = state.ticks[state.ticks.length - 1];
  const previousTick = state.ticks[state.ticks.length - 2];

  if (!currentTick || !previousTick) {
    return false;
  }

  // Check if ticks are moving in the same direction (consecutive up or down)
  const currentDirection = currentTick.direction > 0 ? 'up' : currentTick.direction < 0 ? 'down' : 'neutral';
  const previousDirection = previousTick.direction > 0 ? 'up' : previousTick.direction < 0 ? 'down' : 'neutral';

  // Only flash on consecutive directional ticks, not neutral or direction changes
  if (currentDirection === 'neutral' || currentDirection !== previousDirection) {
    return false;
  }

  // Check if the tick magnitude exceeds threshold
  const magnitude = currentTick.magnitude || 0;
  const thresholdMagnitude = config.flashThreshold * 0.0001; // Convert pips to magnitude units

  return magnitude >= thresholdMagnitude;
}

/**
 * Apply simple flash effect to orb area
 */
function applyOrbFlash(ctx, renderData) {
  const { centerX, centerY, baseRadius } = renderData;

  ctx.save();
  ctx.globalAlpha = 0.6; // Fixed intensity for simplicity
  ctx.fillStyle = '#FFFFFF';

  // Apply flash only to orb area
  ctx.beginPath();
  ctx.arc(centerX, centerY, baseRadius * 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}


/**
 * Convert hex color to rgba with intensity
 */
function hexToRgba(hex, intensity = 1.0) {
  // Remove # if present
  const cleanHex = hex.replace('#', '');

  // Parse hex components
  const r = parseInt(cleanHex.substr(0, 2), 16);
  const g = parseInt(cleanHex.substr(2, 2), 16);
  const b = parseInt(cleanHex.substr(4, 2), 16);

  return `rgba(${r}, ${g}, ${b}, ${intensity})`;
}