import { UnifiedVisualization } from './UnifiedVisualization.js';
import { boundsUtils } from '../../utils/canvasSizing.js';
import { formatPriceSimple } from './priceDisplay.js';

// Object pooling for hover state to eliminate memory allocations
class HoverStatePool {
    constructor() {
        this.pool = [];
        this.inUse = new Set();
    }

    acquire(x, y, price) {
        let obj = this.pool.pop() || { x: 0, y: 0, price: 0 };
        obj.x = x;
        obj.y = y;
        obj.price = price;
        this.inUse.add(obj);
        return obj;
    }

    release(obj) {
        if (this.inUse.has(obj)) {
            this.inUse.delete(obj);
            this.pool.push(obj);
        }
    }

    clear() {
        this.pool.length = 0;
        this.inUse.clear();
    }
}

// Global hover state pool instance
const hoverStatePool = new HoverStatePool();

// Caching for expensive calculations to eliminate redundant operations
const colorCache = new Map();
const textMetricsCache = new Map();
const formattedPriceCache = new Map();

function hexToRgba(hex, opacity) {
    if (!hex) return 'rgba(0,0,0,0)';

    const finalOpacity = (opacity === undefined || opacity === null) ? 1 : opacity;

    // Create cache key for this color combination
    const cacheKey = `${hex}-${finalOpacity}`;

    // Return cached value if available
    if (colorCache.has(cacheKey)) {
        return colorCache.get(cacheKey);
    }

    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }

    const rgba = `rgba(${r},${g},${b},${finalOpacity})`;

    // Cache the result
    colorCache.set(cacheKey, rgba);

    // Limit cache size to prevent memory leaks
    if (colorCache.size > 100) {
        const firstKey = colorCache.keys().next().value;
        colorCache.delete(firstKey);
    }

    return rgba;
}

// Cached function for formatted prices to avoid string allocations
function getCachedFormattedPrice(price, digits) {
    const cacheKey = `${price}-${digits}`;

    if (formattedPriceCache.has(cacheKey)) {
        return formattedPriceCache.get(cacheKey);
    }

    const formattedPrice = formatPriceSimple(price, digits);
    formattedPriceCache.set(cacheKey, formattedPrice);

    // Limit cache size
    if (formattedPriceCache.size > 200) {
        const firstKey = formattedPriceCache.keys().next().value;
        formattedPriceCache.delete(firstKey);
    }

    return formattedPrice;
}

// Cached function for text metrics to avoid expensive measureText calls
function getCachedTextMetrics(ctx, text, font) {
    const cacheKey = `${text}-${font}`;

    if (textMetricsCache.has(cacheKey)) {
        return textMetricsCache.get(cacheKey);
    }

    // Temporarily set font if different
    const originalFont = ctx.font;
    if (font !== originalFont) {
        ctx.font = font;
    }

    const metrics = ctx.measureText(text);

    // Restore original font
    if (font !== originalFont) {
        ctx.font = originalFont;
    }

    textMetricsCache.set(cacheKey, metrics);

    // Limit cache size
    if (textMetricsCache.size > 100) {
        const firstKey = textMetricsCache.keys().next().value;
        textMetricsCache.delete(firstKey);
    }

    return metrics;
}

// Clear all caches (useful for testing or memory management)
export function clearHoverIndicatorCache() {
    colorCache.clear();
    textMetricsCache.clear();
    formattedPriceCache.clear();
    hoverStatePool.clear();
}

// Create unified visualization instance for shared utilities
const hoverViz = new UnifiedVisualization('HoverIndicator');

export function drawHoverIndicator(ctx, renderingContext, config, state, yScale, hoverState) {
    // Guard clauses for safety (same pattern as dayRangeMeter)
    if (!ctx || !renderingContext || !config || !state || !yScale) {
        console.warn('[HoverIndicator] Missing required parameters, skipping render');
        return false;
    }

    // hoverState can be null (when mouse is not hovering) - this is normal
    if (!hoverState || state.currentPrice === null || state.currentPrice === undefined) {
        return false;
    }

    // Check if hover indicator is enabled
    if (!config.showHoverIndicator) {
        return false;
    }

    // 1. Foundation: Calculate render data and check bounds
    const renderData = calculateRenderData(renderingContext, config, state, yScale, hoverState);
    if (!renderData.shouldRender) {
        return true; // Bounds check passed but nothing to render
    }

    // 2. Foundation: Configure render context for crisp rendering
    configureRenderContext(ctx, renderData);

    // 3. Core: Draw essential hover elements
    drawCoreHoverElements(ctx, renderData);

    // 4. Enhancements: Add optional decorative elements
    addHoverEnhancements(ctx, renderData);

    // 5. Foundation: Restore context state
    ctx.restore();
    return true;
}

/**
 * Calculate render data and check bounds (foundation pattern)
 */
function calculateRenderData(renderingContext, config, state, yScale, hoverState) {
    // Extract rendering context from the unified infrastructure
    const { contentArea, adrAxisX } = renderingContext;

    // 🔧 CLEAN FOUNDATION: Use ADR axis position from rendering context
    const axisX = adrAxisX;
    const priceY = yScale(state.currentPrice);
    const { x: mouseX, y: mouseY } = hoverState;

    // Enhanced bounds checking for early returns to skip unnecessary renders
    const mouseInBounds = boundsUtils.isPointInBounds(mouseX, mouseY, { canvasArea: contentArea });
    const priceInBounds = boundsUtils.isYInBounds(priceY, {}, { canvasArea: contentArea });

    // Early return if both mouse and price are out of bounds
    if (!mouseInBounds && !priceInBounds) {
        return { shouldRender: false };
    }

    // Calculate price at mouse Y position using inverse of the scale with error handling
    let priceAtMouse = state.currentPrice; // Fallback to current price
    try {
        if (yScale && typeof yScale.invert === 'function' && mouseY !== undefined) {
            priceAtMouse = yScale.invert(mouseY);
        }
    } catch (error) {
        console.warn('[HoverIndicator] Error calculating price at mouse position:', error);
        priceAtMouse = state.currentPrice; // Safe fallback
    }

    // Determine price direction for color coding
    const priceDirection = priceAtMouse > state.currentPrice ? 'up' :
                           priceAtMouse < state.currentPrice ? 'down' :
                           state.lastTickDirection;

    return {
        shouldRender: true,
        contentArea,
        axisX,
        priceY,
        mouseX,
        mouseY,
        priceAtMouse,
        priceDirection,
        renderFullHover: mouseInBounds,
        currentPrice: state.currentPrice,
        digits: state.digits || 5
    };
}

/**
 * Configure render context (foundation pattern)
 */
function configureRenderContext(ctx, renderData) {
    ctx.save();
    ctx.translate(0.5, 0.5); // Crisp line rendering
}

/**
 * Draw core hover elements (foundation pattern)
 */
function drawCoreHoverElements(ctx, renderData) {
    const { contentArea, axisX, renderFullHover } = renderData;

    // Draw vertical marker line (ADR axis)
    ctx.strokeStyle = hexToRgba('#FFFFFF', 0.3);
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(axisX, 0);
    ctx.lineTo(axisX, contentArea.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw horizontal marker line only if mouse is in bounds
    if (renderFullHover) {
        ctx.strokeStyle = hexToRgba('#FFFFFF', 0.5);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, renderData.mouseY);
        ctx.lineTo(contentArea.width, renderData.mouseY);
        ctx.stroke();
    }
}

/**
 * Add hover enhancements (foundation pattern)
 */
function addHoverEnhancements(ctx, renderData) {
    const { contentArea, axisX, renderFullHover, currentPrice, digits } = renderData;

    // Draw price label if enabled
    if (renderData.config?.showHoverLabel !== false) {
        drawPriceLabel(ctx, renderData);
    }

    // Draw indicator dot only if mouse is in bounds
    if (renderFullHover) {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(axisX, renderData.mouseY, 3, 0, 2 * Math.PI);
        ctx.fill();
    }
}

/**
 * Draw price label with performance optimizations
 */
function drawPriceLabel(ctx, renderData) {
    const { contentArea, axisX, mouseX, mouseY, currentPrice, digits } = renderData;

    // Use cached formatted price to avoid string allocations
    const priceText = getCachedFormattedPrice(currentPrice, digits);

    // 🔧 CLEAN FOUNDATION: Use content-relative positioning with validation
    const fontSize = Math.max(contentArea.height * 0.5, 8);
    const horizontalOffset = contentArea.width * 0.05;

    // Defensive: ensure we have valid values to prevent rendering failures
    if (isNaN(fontSize) || isNaN(horizontalOffset) || !contentArea || !contentArea.width || !contentArea.height) {
        console.warn('[hoverIndicator] Invalid positioning data, skipping render');
        return;
    }

    const fontString = `${fontSize}px Arial`;
    ctx.font = fontString;

    // Use cached text metrics to avoid expensive measureText calls
    const textMetrics = getCachedTextMetrics(ctx, priceText, fontString);
    const textWidth = textMetrics.width;
    const textHeight = fontSize;

    // Calculate label position with smart positioning
    const padding = 0.02;
    const labelWidth = textWidth + (padding * 2);
    const labelHeight = textHeight + (padding * 2);

    // Smart positioning: avoid edges and mouse cursor
    let labelX = axisX + horizontalOffset;
    let labelY = mouseY - labelHeight / 2;

    // Adjust X position if it would go off-screen
    if (labelX + labelWidth > contentArea.width) {
        labelX = axisX - horizontalOffset - labelWidth;
    }

    // Adjust Y position if it would go off-screen
    if (labelY < 0) {
        labelY = mouseY + 10; // Position below mouse line
    } else if (labelY + labelHeight > contentArea.height) {
        labelY = mouseY - labelHeight - 10; // Position above mouse line
    }

    // Further adjust if label would interfere with mouse cursor
    const mouseBuffer = 20;
    if (Math.abs(mouseX - labelX) < mouseBuffer &&
        Math.abs(mouseY - labelY) < mouseBuffer) {
        // Move label to opposite side of cursor
        if (mouseX < axisX) {
            labelX = axisX + horizontalOffset;
        } else {
            labelX = axisX - horizontalOffset - labelWidth;
        }
    }

    // Draw label background
    if (true) { // hoverLabelShowBackground default
        ctx.fillStyle = hexToRgba('#000000', 0.7);
        ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
    }

    // Draw label text with steady color and transparency
    const textColor = hexToRgba('#FFFFFF', 1.0);
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(priceText, labelX + padding, labelY + labelHeight / 2);
}

export function hideHoverIndicator(ctx, config) {
    // This function would be called to clear hover indicators
    // In practice, the canvas is typically cleared and redrawn each frame
    // so this might not be needed, but included for completeness
}
