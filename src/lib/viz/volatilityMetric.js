import { CoordinateValidator } from '../../utils/coordinateValidator.js';

export function drawVolatilityMetric(ctx, renderingContext, config, state) {
  if (!renderingContext || !state) return;

  // 🔧 CLEAN FOUNDATION: Use rendering context instead of legacy config
  const { contentArea } = renderingContext;

  // 🔧 PHASE 2: Enhanced Rendering Context Validation for Trading-Critical Accuracy
  const displayId = renderingContext?.displayId || 'unknown';

  // Validate rendering context for VolatilityMetric (non-coordinate component)
  // Use quickValidate for performance-critical rendering since VolatilityMetric doesn't use coordinate system
  const contextValidation = renderingContext && renderingContext.contentArea
    ? CoordinateValidator.quickValidate(renderingContext.yScale, renderingContext.contentArea)
    : { isValid: false, error: 'Missing rendering context or content area' };

  if (!contextValidation.isValid) {
    console.warn(`[${displayId}] VolatilityMetric context validation failed:`,
      contextValidation.error || contextValidation);
    // Continue rendering for resilience - VolatilityMetric is non-critical for coordinate accuracy
  }

  // Extract configuration parameters
  const { showVolatilityMetric } = config;

  if (!showVolatilityMetric) {
    return;
  }

  const { volatility } = state;

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';

  // 🎯 RESPONSIVE FIX: Scale font size based on container dimensions for better visual consistency
  const baseFontSize = Math.max(10, Math.min(12, contentArea.width * 0.025));
  ctx.font = `${baseFontSize}px Arial`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const safeVolatility = volatility || 0;
  const sigmaText = `σ ${safeVolatility.toFixed(2)}`;

  // 🎯 RESPONSIVE FIX: Replace hardcoded pixel coordinates with percentage-based positioning
  const marginPercent = 0.02; // 2% margin from left edge
  const bottomMarginPercent = 0.05; // 5% margin from bottom edge
  const xPosition = contentArea.width * marginPercent;
  const yPosition = contentArea.height * (1 - bottomMarginPercent);

  // Position sigma metric in bottom-left corner with responsive coordinates
  ctx.fillText(sigmaText, xPosition, yPosition);
  ctx.restore();
}
