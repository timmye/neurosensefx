import { scaleLinear } from 'd3-scale';
import { line, curveBasis } from 'd3-shape';

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

export function drawMarketProfile(ctx, config, state, y) {
  const { marketProfile } = state;

  if (!config.showMarketProfile || !marketProfile || !marketProfile.levels || marketProfile.levels.length === 0) {
    return;
  }

  const { 
    centralAxisXPosition,
    visualizationsContentWidth, 
    meterHeight,
    marketProfileWidthRatio,
    marketProfileView,
    marketProfileOutline,
    marketProfileUpColor,
    marketProfileDownColor,
    marketProfileOpacity,
    marketProfileOutlineShowStroke,
    marketProfileOutlineStrokeWidth,
    marketProfileOutlineUpColor,
    marketProfileOutlineDownColor,
    marketProfileOutlineOpacity,
  } = config;

  const availableWidth = (visualizationsContentWidth / 2) - 10;

  const maxVolume = Math.max(
    ...marketProfile.levels.map(l => {
      return marketProfileView === 'separate' ? Math.max(l.buy, l.sell) : l.volume;
    }), 0
  );

  const x = scaleLinear().domain([0, maxVolume]).range([0, availableWidth * marketProfileWidthRatio]);
  
  const barHeight = (marketProfile.levels.length > 1)
    ? Math.abs(y(marketProfile.levels[0].price) - y(marketProfile.levels[1].price))
    : 1;

  const upColor = hexToRgba(marketProfileUpColor, marketProfileOpacity);
  const downColor = hexToRgba(marketProfileDownColor, marketProfileOpacity);
  const outlineUpColor = hexToRgba(marketProfileOutlineUpColor, marketProfileOutlineOpacity);
  const outlineDownColor = hexToRgba(marketProfileOutlineDownColor, marketProfileOutlineOpacity);

  const drawAsFilledShape = (data, fillColor, strokeColor, side) => {
    if (data.length < 2) return;

    const lineGenerator = line()
      .x(d => d.x)
      .y(d => d.y)
      .curve(curveBasis)
      .context(ctx);
    
    ctx.beginPath();
    lineGenerator(side === 'left' ? data : data.reverse());
    
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
    ctx.fillStyle = fillColor;
    ctx.fill();

    if (marketProfileOutlineShowStroke) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = marketProfileOutlineStrokeWidth;
        ctx.stroke();
    }
  };

  const drawAsBars = (yPos, width, color, position) => {
    // FIXED: Add bounds checking to prevent overflow
    if (yPos < -barHeight || yPos > meterHeight + barHeight) return;
    
    ctx.fillStyle = color;
    if (position === 'left') {
      ctx.fillRect(centralAxisXPosition - width, yPos, width, barHeight);
    } else {
      ctx.fillRect(centralAxisXPosition, yPos, width, barHeight);
    }
  };

  if (config.marketProfileOutline) {
    if (marketProfileView === 'separate') {
        const leftData = marketProfile.levels.map(level => ({
            x: centralAxisXPosition - x(level.sell),
            y: y(level.price)
        }));
        const rightData = marketProfile.levels.map(level => ({
            x: centralAxisXPosition + x(level.buy),
            y: y(level.price)
        }));
        
        drawAsFilledShape(leftData, downColor, outlineDownColor, 'left');
        drawAsFilledShape(rightData, upColor, outlineUpColor, 'right');

    } else {
        const data = marketProfile.levels.map(level => ({
            x: marketProfileView === 'combinedLeft' 
              ? centralAxisXPosition - x(level.volume)
              : centralAxisXPosition + x(level.volume),
            y: y(level.price)
        }));
        const side = marketProfileView === 'combinedLeft' ? 'left' : 'right';
        drawAsFilledShape(data, upColor, outlineUpColor, side);
    }

  } else {
    marketProfile.levels.forEach(level => {
      const levelY = y(level.price);
      if (levelY < -barHeight || levelY > meterHeight + barHeight) return;

      if (marketProfileView === 'separate') {
           drawAsBars(levelY - barHeight / 2, x(level.sell), downColor, 'left');
           drawAsBars(levelY - barHeight / 2, x(level.buy), upColor, 'right');
      } else {
           const position = marketProfileView === 'combinedLeft' ? 'left' : 'right';
           drawAsBars(levelY - barHeight / 2, x(level.volume), upColor, position);
      }
    });
  }
}
