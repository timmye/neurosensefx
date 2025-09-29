export function drawPriceMarkers(ctx, config, state, y, markers) {
  if (!markers || markers.length === 0) {
    return;
  }

  const { visualizationsContentWidth, markerLineColor, markerLineThickness, markerLabelColor, markerLabelFontSize, markerLabelXOffset } = config;

  markers.forEach(marker => {
    const markerY = y(marker.price);

    // Style for the marker line (thinner than price float)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; // Semi-transparent white
    ctx.strokeStyle = markerLineColor; // Use config color
    ctx.lineWidth = markerLineThickness; // Use config thickness

    // Draw the line across the canvas
    ctx.moveTo(0, markerY);
    ctx.lineTo(visualizationsContentWidth, markerY);
    ctx.stroke();

    // Reset line dash for other drawing functions
    ctx.setLineDash([]);

    // Draw the price label for the marker
    const labelText = marker.price.toFixed(state.digits);
    const labelFontSize = 10;
    const labelPadding = 5;

    ctx.font = `${labelFontSize}px Arial`;
    ctx.fillStyle = '#9CA3AF'; // Grey color for the label
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, visualizationsContentWidth - ctx.measureText(labelText).width - labelPadding, markerY);
  });
}
