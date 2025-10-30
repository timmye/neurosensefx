import { get } from 'svelte/store';
import { coordinateUtils, boundsUtils } from '../../utils/canvasSizing.js';

/**
 * Helper function to convert hex color string to RGBA string.
 * @param {string} hex - Hex color string (e.g., "#RRGGBB" or "#RGB").
 * @param {number} alpha - Alpha transparency value (0 to 1).
 * @returns {string} RGBA color string (e.g., "rgba(255, 0, 0, 0.5)").
 */
function hexToRgba(hex, alpha) {
    const bigint = parseInt(hex.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r},${g},${b},${alpha})`;
}
export function drawHoverIndicator(ctx, config, state, y, hoverState) {
    // Ensure hoverState is active
    if (!hoverState) {
        console.log('drawHoverIndicator called, hoverState is null or undefined');
        return;
    }

    // 🔧 UNIFIED COORDINATE SYSTEM: Use consistent coordinate transformation
    // Create a mock canvas dimensions object for coordinate transformation
    const canvasDimensions = {
        dpr: window.devicePixelRatio || 1
    };

    ctx.save(); // Save the current canvas state (including transformation)
    
    // 🔧 UNIFIED COORDINATE SYSTEM: Use coordinate utils for consistent transformation
    const canvasPos = coordinateUtils.cssToCanvas({ x: 0, y: hoverState.y }, canvasDimensions);
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transformation to 1:1 CSS pixels

    try {
        const { visualizationsContentWidth } = config;
        const { digits } = state;

        const hoverY = hoverState.y; // Use hoverY since we are using CSS pixel coordinates
        console.log('drawHoverIndicator received hoverState:', hoverState);
        const hoverPrice = hoverState.price;

        if (hoverY === undefined || hoverPrice === undefined || isNaN(hoverY) || isNaN(hoverPrice)) {
            return;
        }

        // 🔧 UNIFIED BOUNDS CHECKING: Use unified bounds checking utilities
        // Create canvas dimensions for bounds checking
        const canvasDimensions = {
            canvasArea: {
                width: config.visualizationsContentWidth,
                height: config.meterHeight
            }
        };
        
        // Ensure hover line is within the canvas bounds
        if (!boundsUtils.isYInBounds(hoverY, config, canvasDimensions)) {
            console.log(`[HOVER_INDICATOR] Hover Y out of bounds: ${hoverY} (canvas height: ${config.meterHeight})`);
            return;
        }

        // Draw the horizontal line
        ctx.beginPath();
        ctx.strokeStyle = '#9CA3AF'; // Grey color
        ctx.lineWidth = 1;
        ctx.moveTo(0, hoverY);
        ctx.lineTo(visualizationsContentWidth, hoverY);
        ctx.stroke();

        // Draw the price label
        const safeDigits = state && state.digits ? state.digits : 5;
        const labelText = (hoverPrice !== undefined && hoverPrice !== null && !isNaN(hoverPrice)) ? hoverPrice.toFixed(safeDigits) : 'N/A';
        const labelFontSize = 10; // config.hoverLabelFontSize || 10; // Use config, fallback to 10 - TO BE ADDED TO CONFIG
        const labelPadding = 5; // Padding around the label
        const labelOffsetFromLine = 10; // Distance from the line

        ctx.font = `${labelFontSize}px Arial`;
        ctx.fillStyle = '#9CA3AF'; // Grey color
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';

        const metrics = ctx.measureText(labelText);

        // Position the label to the right of the line, near the central axis or a side
        let labelX = visualizationsContentWidth / 2 + labelOffsetFromLine; // Example positioning

        // Calculate background dimensions and position
        const textWidth = metrics.width;
        const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
        const backgroundX = (ctx.textAlign === 'right') ? labelX - textWidth - labelPadding : labelX - labelPadding;
        const backgroundY = hoverY - (textHeight / 2) - labelPadding; // Center vertically around hoverY
        const backgroundWidth = textWidth + labelPadding * 2;
        const backgroundHeight = textHeight + labelPadding * 2;

 const centralAxisX = config.centralAxisXPosition;
 if (centralAxisX + labelOffsetFromLine + metrics.width < visualizationsContentWidth) {
 labelX = centralAxisX + labelOffsetFromLine;
 } else if (centralAxisX - labelOffsetFromLine - metrics.width > 0) {
            labelX = centralAxisX - labelOffsetFromLine - metrics.width;
            ctx.textAlign = 'right';
        } else {
            // Fallback if central axis positioning is not ideal
            labelX = visualizationsContentWidth - metrics.width - labelPadding;
            ctx.textAlign = 'right';
        }

        // Draw background rectangle if enabled in config (after labelX is finalized)
       if (config.hoverLabelShowBackground) {
            const backgroundColor = hexToRgba(config.hoverLabelBackgroundColor || '#000000', config.hoverLabelBackgroundOpacity || 0.7); // Use config, fallback to defaults
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(backgroundX, backgroundY, backgroundWidth, backgroundHeight);
        }

        // Draw the text label on top of the background
        ctx.fillStyle = '#9CA3AF'; // config.hoverLabelColor || '#9CA3AF'; // Use config, fallback to grey - TO BE ADDED TO CONFIG
	ctx.fillText(labelText, labelX, hoverY);
    } finally {
        ctx.restore(); // Restore the original canvas state (including transformation)
    }
}
