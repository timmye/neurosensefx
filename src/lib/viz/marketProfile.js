import { scaleLinear } from 'd3-scale';

export function drawMarketProfile(ctx, config, state, y, marketProfile) {
  if (!config.showMarketProfile || !marketProfile || !marketProfile.levels || marketProfile.levels.length === 0) {
    return;
  }

  const { 
    centralAxisXPosition, 
    visualizationsContentWidth, 
    marketProfileWidthRatio,
    marketProfileView
  } = config;

  const availableWidth = (visualizationsContentWidth / 2) - 10;

  const maxVolume = Math.max(
    ...marketProfile.levels.map(l => {
      return marketProfileView === 'separate' ? Math.max(l.buy, l.sell) : l.total;
    }), 0
  );

  const x = scaleLinear().domain([0, maxVolume]).range([0, availableWidth * marketProfileWidthRatio]);

  marketProfile.levels.forEach(level => {
    const levelY = y(level.price);
    
    if (levelY < 0 || levelY > config.meterHeight) {
        return;
    }

    if (marketProfileView === 'separate') {
      const sellWidth = x(level.sell);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.fillRect(centralAxisXPosition - sellWidth, levelY, sellWidth, 1);

      const buyWidth = x(level.buy);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.4)';
      ctx.fillRect(centralAxisXPosition, levelY, buyWidth, 1);
    } else {
      const totalWidth = x(level.total);
      ctx.fillStyle = 'rgba(156, 163, 175, 0.4)';
      
      if (marketProfileView === 'combinedLeft') {
        ctx.fillRect(centralAxisXPosition - totalWidth, levelY, totalWidth, 1);
      } else { // 'combinedRight'
        ctx.fillRect(centralAxisXPosition, levelY, totalWidth, 1);
      }
    }
  });
}
