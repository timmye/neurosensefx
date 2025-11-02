export function drawPriceMarkers(ctx, renderingContext, config, state, y, markers) {
  if (!renderingContext || !state || !markers || markers.length === 0) {
    return;
  }

  // 🔧 CLEAN FOUNDATION: Use rendering context instead of legacy config
  const { contentArea } = renderingContext;
  
  // Extract configuration parameters (now content-relative)
  const { markerLineColor, markerLineThickness, markerLabelColor, markerLabelFontSize, markerLabelXOffset } = config;

  markers.forEach(marker => {
    const markerY = y(marker.price);

    // Style for the marker line (thinner than price float)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; // Semi-transparent white
    ctx.strokeStyle = markerLineColor; // Use config color
    ctx.lineWidth = markerLineThickness; // Use config thickness

    // 🔧 CLEAN FOUNDATION: Use content area dimensions
    // Draw the line across the canvas
    ctx.moveTo(0, markerY);
    ctx.lineTo(contentArea.width, markerY);
    ctx.stroke();

    // Reset line dash for other drawing functions
    ctx.setLineDash([]);

    // Draw the price label for the marker
    const safeDigits = state && state.digits ? state.digits : 5;
    const labelText = (marker.price !== undefined && marker.price !== null && !isNaN(marker.price)) ? marker.price.toFixed(safeDigits) : 'N/A';
    const labelFontSize = 10;
    const labelPadding = 5;

    ctx.font = `${labelFontSize}px Arial`;
    ctx.fillStyle = '#9CA3AF'; // Grey color for the label
    ctx.textBaseline = 'middle';
    
    // 🔧 CLEAN FOUNDATION: Use content area dimensions for positioning
    ctx.fillText(labelText, contentArea.width - ctx.measureText(labelText).width - labelPadding, markerY);
  });
}
