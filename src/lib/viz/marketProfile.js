import { scaleLinear } from 'd3-scale';

export function drawMarketProfile(ctx, config, state, y, marketProfile) {
  if (!config.showMarketProfile || !marketProfile || !marketProfile.levels) return;

  const { centralAxisXPosition, visualizationsContentWidth } = config;

  const maxVolume = Math.max(...marketProfile.levels.map(l => l.volume), 0);
  const x = scaleLinear().domain([0, maxVolume]).range([0, (visualizationsContentWidth / 2) - 10]);

  marketProfile.levels.forEach(level => {
    const levelY = y(level.price);
    
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
