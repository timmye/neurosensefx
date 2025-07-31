import { scaleLinear } from 'd3-scale';
import { line, curveBasis } from 'd3-shape';

export function drawMarketProfile(ctx, config, state, y) {
  const { marketProfile } = state;

  if (!config.showMarketProfile || !marketProfile || !marketProfile.levels || marketProfile.levels.length === 0) {
    return;
  }

  const { 
    centralAxisXPosition,
    visualizationsContentWidth, 
    marketProfileWidthRatio,
    marketProfileView,
    marketProfileOutline,
  } = config;

  const availableWidth = (visualizationsContentWidth / 2) - 10;

  const maxVolume = Math.max(
    ...marketProfile.levels.map(l => {
      return marketProfileView === 'separate' ? Math.max(l.buy, l.sell) : l.volume;
    }), 0
  );

  const x = scaleLinear().domain([0, maxVolume]).range([0, availableWidth * marketProfileWidthRatio]);
  
  // Calculate bar height based on the scale, ensuring a minimum height
  const barHeight = (marketProfile.levels.length > 1)
    ? Math.abs(y(marketProfile.levels[0].price) - y(marketProfile.levels[1].price))
    : 1; // Default to 1 if only one level

  const drawAsFilledShape = (data, color, side) => {
    if (data.length < 2) return; // Need at least 2 points for a path

    const lineGenerator = line()
      .x(d => d.x)
      .y(d => d.y)
      .curve(curveBasis)
      .context(ctx);
    
    ctx.beginPath();
    lineGenerator(side === 'left' ? data : data.reverse());
    
    // Close the path back to the central axis for filling
    const firstPoint = data[0];
    const lastPoint = data[data.length - 1];

    if (side === 'left') {
        ctx.lineTo(centralAxisXPosition, lastPoint.y);
        ctx.lineTo(centralAxisXPosition, firstPoint.y);
    } else {
        ctx.lineTo(centralAxisXPosition, lastPoint.y);
        ctx.lineTo(centralAxisXPosition, firstPoint.y);
    }

    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };

  const drawAsBars = (yPos, width, color, position) => {
    ctx.fillStyle = color;
    if (position === 'left') {
      ctx.fillRect(centralAxisXPosition - width, yPos, width, barHeight);
    } else {
      ctx.fillRect(centralAxisXPosition, yPos, width, barHeight);
    }
  };

  // --- Drawing Logic based on Config ---
  if (config.marketProfileOutline) { // Outline view (filled)
    let data;
    let color;
    let side;

    // Use a lighter purple for the filled outline
    const filledOutlineColor = 'rgba(191, 147, 255, 0.3)'; // A lighter, semi-transparent purple

    if (marketProfileView === 'separate') {
        const leftData = marketProfile.levels.map(level => ({
            x: centralAxisXPosition - x(level.sell),
            y: y(level.price)
        }));
        const rightData = marketProfile.levels.map(level => ({
            x: centralAxisXPosition + x(level.buy),
            y: y(level.price)
        }));
        
        // Use the new filledOutlineColor for both sides in separate view outline
        drawAsFilledShape(leftData, filledOutlineColor, 'left');
        drawAsFilledShape(rightData, filledOutlineColor, 'right');

    } else { // combinedLeft or combinedRight
        data = marketProfile.levels.map(level => ({
            x: marketProfileView === 'combinedLeft' 
              ? centralAxisXPosition - x(level.volume)
              : centralAxisXPosition + x(level.volume),
            y: y(level.price)
        }));
        side = marketProfileView === 'combinedLeft' ? 'left' : 'right';
        // Use the new filledOutlineColor for combined view outline
        drawAsFilledShape(data, filledOutlineColor, side);
    }

  } else { // Bars view
    // Keep existing bar colors (red/blue for separate, gray for combined)
    const combinedBarColor = 'rgba(156, 163, 175, 0.4)'; // Original gray for combined bars
    const buyBarColor = 'rgba(59, 130, 246, 0.4)'; // Original blue for buy bars
    const sellBarColor = 'rgba(239, 68, 68, 0.4)'; // Original red for sell bars

    marketProfile.levels.forEach(level => {
      const levelY = y(level.price);
      // Only draw if within canvas bounds (with a small buffer)
      if (levelY < -barHeight || levelY > meterHeight + barHeight) return;

      if (marketProfileView === 'separate') {
           drawAsBars(levelY - barHeight / 2, x(level.sell), sellBarColor, 'left');
           drawAsBars(levelY - barHeight / 2, x(level.buy), buyBarColor, 'right');
      } else { // combinedLeft or combinedRight
           const position = marketProfileView === 'combinedLeft' ? 'left' : 'right';
           drawAsBars(levelY - barHeight / 2, x(level.volume), combinedBarColor, position);
      }
    });
  }
}
