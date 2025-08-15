import { get } from 'svelte/store';

export function drawHoverIndicator(ctx, config, state, y, hoverState) {
    // Ensure hoverState is active
    if (!hoverState) {
        console.log('drawHoverIndicator called, hoverState is null or undefined');
        return;
    }

    ctx.save(); // Save the current canvas state (including transformation)
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset the transformation to 1:1 CSS pixels

    try {
        const { visualizationsContentWidth } = config;
        const { digits } = state;

        const hoverY = hoverState.y; // Use hoverY since we are using CSS pixel coordinates
        console.log('drawHoverIndicator received hoverState:', hoverState);
        const hoverPrice = hoverState.price;

        if (hoverY === undefined || hoverPrice === undefined || isNaN(hoverY) || isNaN(hoverPrice)) {
            return;
        }

        // Ensure the hover line is within the canvas bounds using meterHeight (CSS pixels)
        // Note: The hoverState.y is stored as CSS pixels
        if (hoverY < 0 || hoverY > config.meterHeight) {
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
        const labelText = hoverPrice.toFixed(digits);
        const labelFontSize = 10;
        const labelPadding = 5; // Padding around the label
        const labelOffsetFromLine = 10; // Distance from the line

        ctx.font = `${labelFontSize}px Arial`;
        ctx.fillStyle = '#9CA3AF'; // Grey color
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';

        const metrics = ctx.measureText(labelText);

        // Position the label to the right of the line, near the central axis or a side
        let labelX = visualizationsContentWidth / 2 + labelOffsetFromLine; // Example positioning

        // Consider placing the label near the central axis for better visibility
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

        // Use hoverY for the vertical position of the text
        ctx.fillText(labelText, labelX, hoverY);
    } finally {
        ctx.restore(); // Restore the original canvas state (including transformation)
    }
}