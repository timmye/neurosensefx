import { scaleLinear } from 'd3-scale';

export function drawMarketProfile(ctx, config, state, y, marketProfile) {
  console.log('[MP_DEBUG | Viz] drawMarketProfile called.');
  console.log('[MP_DEBUG | Viz] Config:', config);
  console.log('[MP_DEBUG | Viz] State:', state);
  console.log('[MP_DEBUG | Viz] marketProfile data:', marketProfile);

  if (!config.showMarketProfile) {
    console.log('[MP_DEBUG | Viz] Market profile not shown based on config.');
    return;
  }

  if (!marketProfile || !marketProfile.levels || marketProfile.levels.length === 0) {
    console.log('[MP_DEBUG | Viz] No market profile data or empty levels.');
    return;
  }

  const { centralAxisXPosition, visualizationsContentWidth } = config;

  const maxVolume = Math.max(...marketProfile.levels.map(l => l.volume), 0);
  console.log('[MP_DEBUG | Viz] Max volume:', maxVolume);
  const x = scaleLinear().domain([0, maxVolume]).range([0, (visualizationsContentWidth / 2) - 10]);
  console.log('[MP_DEBUG | Viz] X scale domain and range:', x.domain(), x.range());

  marketProfile.levels.forEach(level => {
    const levelY = y(level.price);
    
    console.log(`[MP_DEBUG | Viz] Drawing level for price: ${level.price}, Y coordinate: ${levelY}`);
    console.log(`[MP_DEBUG | Viz] Buy volume: ${level.buy}, Sell volume: ${level.sell}`);

    // Draw sell side (left of axis)
    if (!config.showSingleSidedProfile || config.singleSidedProfileSide === 'left') {
        const sellWidth = x(level.sell);
        console.log(`[MP_DEBUG | Viz] Sell side width: ${sellWidth}. Drawing at X: ${centralAxisXPosition - sellWidth}, Y: ${levelY}`);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)'; // Red with opacity
        ctx.fillRect(centralAxisXPosition - sellWidth, levelY, sellWidth, 1);
    }

    // Draw buy side (right of axis)
    if (!config.showSingleSidedProfile || config.singleSidedProfileSide === 'right') {
        const buyWidth = x(level.buy);
         console.log(`[MP_DEBUG | Viz] Buy side width: ${buyWidth}. Drawing at X: ${centralAxisXPosition}, Y: ${levelY}`);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.4)'; // Blue with opacity
        ctx.fillRect(centralAxisXPosition, levelY, buyWidth, 1);
    }
  });
   console.log('[MP_DEBUG | Viz] Finished drawing market profile levels.');
}
