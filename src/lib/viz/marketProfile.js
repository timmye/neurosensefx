import { scaleLinear } from 'd3-scale';
import { line, curveBasis } from 'd3-shape';

export function drawMarketProfile(ctx, config, state, y, marketProfile) {
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
      return marketProfileView === 'separate' ? Math.max(l.buy, l.sell) : l.total;
    }), 0
  );

  const x = scaleLinear().domain([0, maxVolume]).range([0, availableWidth * marketProfileWidthRatio]);

  const drawAsOutline = (data, color, side) => {
    const lineGenerator = line()
      .x(d => d.x)
      .y(d => d.y)
      .curve(curveBasis);
    
    ctx.beginPath();
    lineGenerator.context(ctx)(side === 'left' ? data : data.reverse());
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };

  const drawAsBars = (yPos, width, color, position) => {
    ctx.fillStyle = color;
    if (position === 'left') {
      ctx.fillRect(centralAxisXPosition - width, yPos, width, 1);
    } else {
      ctx.fillRect(centralAxisXPosition, yPos, width, 1);
    }
  };

  if (marketProfileView === 'separate') {
    if (marketProfileOutline) {
      const leftData = marketProfile.levels.map(level => ({
        x: centralAxisXPosition - x(level.sell),
        y: y(level.price)
      }));
      const rightData = marketProfile.levels.map(level => ({
        x: centralAxisXPosition + x(level.buy),
        y: y(level.price)
      }));
      drawAsOutline(leftData, 'rgba(239, 68, 68, 0.8)', 'left');
      drawAsOutline(rightData, 'rgba(59, 130, 246, 0.8)', 'right');
    } else {
      marketProfile.levels.forEach(level => {
        const levelY = y(level.price);
        if (levelY < 0 || levelY > config.meterHeight) return;
        drawAsBars(levelY, x(level.sell), 'rgba(239, 68, 68, 0.4)', 'left');
        drawAsBars(levelY, x(level.buy), 'rgba(59, 130, 246, 0.4)', 'right');
      });
    }
  } else { // combinedLeft or combinedRight
    if (marketProfileOutline) {
      const data = marketProfile.levels.map(level => ({
        x: marketProfileView === 'combinedLeft' 
          ? centralAxisXPosition - x(level.total)
          : centralAxisXPosition + x(level.total),
        y: y(level.price)
      }));
      drawAsOutline(data, 'rgba(156, 163, 175, 0.8)', marketProfileView === 'combinedLeft' ? 'left' : 'right');
    } else {
      marketProfile.levels.forEach(level => {
        const levelY = y(level.price);
        if (levelY < 0 || levelY > config.meterHeight) return;
        const position = marketProfileView === 'combinedLeft' ? 'left' : 'right';
        drawAsBars(levelY, x(level.total), 'rgba(156, 163, 175, 0.4)', position);
      });
    }
  }
}
