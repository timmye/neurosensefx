import { scaleLinear } from 'd3-scale';

export function drawMarketProfile(ctx, config, state, y, marketProfile) {
  if (!config.showMarketProfile || !marketProfile || !marketProfile.levels || marketProfile.levels.length === 0) {
    return;
  }

  const { centralAxisXPosition, visualizationsContentWidth, marketProfileWidthRatio } = config;

  // Determine the available width for one side of the profile
  const availableWidth = (visualizationsContentWidth / 2) - 10;

  // Find the maximum volume in the profile to set the scale domain
  const maxVolume = Math.max(...marketProfile.levels.map(l => l.volume), 0);

  // Create a linear scale for the x-axis (volume).
  // The 'range' is multiplied by the user-configurable width ratio.
  const x = scaleLinear().domain([0, maxVolume]).range([0, availableWidth * marketProfileWidthRatio]);

  marketProfile.levels.forEach(level => {
    const levelY = y(level.price);
    
    // Skip drawing if the level is outside the visible canvas area
    if (levelY < 0 || levelY > config.meterHeight) {
        return;
    }

    // Draw sell side (left of axis)
    if (!config.showSingleSidedProfile || config.singleSidedProfileSide === 'left') {
        const sellWidth = x(level.sell);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)'; // Red with opacity
        ctx.fillRect(centralAxisXPosition - sellWidth, levelY, sellWidth, 1);
    }

    // Draw buy side (right of axis)
    if (!config.showSingleSidedProfile || config.singleSidedProfileSide === 'right') {
        const buyWidth = x(level.buy);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.4)'; // Blue with opacity
        ctx.fillRect(centralAxisXPosition, levelY, buyWidth, 1);
    }
  });
}
