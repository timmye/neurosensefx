function hexToRgba(hex, opacity) {
    if (!hex) return 'rgba(0,0,0,0)';
    
    const finalOpacity = (opacity === undefined || opacity === null) ? 1 : opacity;

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
    
    return `rgba(${r},${g},${b},${finalOpacity})`;
}

export function drawHoverIndicator(ctx, renderingContext, config, state, y, hoverState) {
    if (!renderingContext || !state) return;

    // 🔧 CLEAN FOUNDATION: Use rendering context instead of legacy config
    const { contentArea, adrAxisX } = renderingContext;
    
    // Extract configuration parameters (now content-relative)
    const {
        markerLineColor,
        markerLineThickness,
        hoverLabelShowBackground,
        hoverLabelBackgroundColor,
        hoverLabelBackgroundOpacity,
        priceFontSize,
        priceUseStaticColor,
        priceStaticColor,
        priceUpColor,
        priceDownColor,
        priceHorizontalOffset,
        priceDisplayPadding,
    } = config;

    const { currentPrice, lastTickDirection } = state; 

    if (!hoverState || currentPrice === null || currentPrice === undefined) return;

    // 🔧 CLEAN FOUNDATION: Use ADR axis position from rendering context
    const axisX = adrAxisX;
    const priceY = y(currentPrice);
    const { x: mouseX, y: mouseY } = hoverState;

    // Check if mouse is near the price line (within 10px tolerance)
    const isNearPriceLine = Math.abs(mouseY - priceY) < 10;

    if (!isNearPriceLine) return;

    // Draw vertical marker line
    ctx.strokeStyle = hexToRgba(markerLineColor, 0.3);
    ctx.lineWidth = markerLineThickness;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(axisX, 0);
    ctx.lineTo(axisX, contentArea.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // 🔧 CLEAN FOUNDATION: Use content area dimensions
    // Draw horizontal marker line at price level
    ctx.strokeStyle = hexToRgba(markerLineColor, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, priceY);
    ctx.lineTo(contentArea.width, priceY);
    ctx.stroke();

    // Format price display
    const formatPrice = (price) => {
        try {
            return (price !== undefined && price !== null && !isNaN(price)) 
                ? price.toFixed(state.digits || 5) 
                : 'N/A';
        } catch (error) {
            console.error('Error formatting price:', { price, error });
            return 'N/A';
        }
    };

    const priceText = formatPrice(currentPrice);
    
    // 🔧 CLEAN FOUNDATION: Use content-relative positioning
    const fontSize = contentArea.height * priceFontSize;
    const horizontalOffset = contentArea.width * priceHorizontalOffset;
    
    ctx.font = `${fontSize}px Arial`;
    const textMetrics = ctx.measureText(priceText);
    const textWidth = textMetrics.width;
    const textHeight = fontSize;

    // Calculate label position with smart positioning
    const padding = priceDisplayPadding;
    const labelWidth = textWidth + (padding * 2);
    const labelHeight = textHeight + (padding * 2);

    // Smart positioning: avoid edges and mouse cursor
    let labelX = axisX + horizontalOffset;
    let labelY = priceY - labelHeight / 2;

    // Adjust X position if it would go off-screen
    if (labelX + labelWidth > contentArea.width) {
        labelX = axisX - horizontalOffset - labelWidth;
    }

    // Adjust Y position if it would go off-screen
    if (labelY < 0) {
        labelY = priceY + 10; // Position below price line
    } else if (labelY + labelHeight > contentArea.height) {
        labelY = priceY - labelHeight - 10; // Position above price line
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
    if (hoverLabelShowBackground) {
        ctx.fillStyle = hexToRgba(hoverLabelBackgroundColor, hoverLabelBackgroundOpacity);
        ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
    }

    // Draw label text
    const textColor = priceUseStaticColor 
        ? priceStaticColor 
        : (lastTickDirection === 'up' ? priceUpColor : priceDownColor);
    
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(priceText, labelX + padding, labelY + labelHeight / 2);

    // Draw small indicator dot at intersection
    ctx.fillStyle = markerLineColor;
    ctx.beginPath();
    ctx.arc(axisX, priceY, 3, 0, 2 * Math.PI);
    ctx.fill();
}

export function hideHoverIndicator(ctx, config) {
    // This function would be called to clear hover indicators
    // In practice, the canvas is typically cleared and redrawn each frame
    // so this might not be needed, but included for completeness
}
