<script>
  import { onMount, afterUpdate } from 'svelte';
  import * as d3 from 'd3';

  export let config = {};
  export let state = {};
  export let marketProfileData = {};
  export let flashEffect = null;

  let canvasElement;
  let ctx;
  let lastFlashId = null;
  let isOrbFlashing = false;

  $: if (ctx && state && state.currentPrice !== undefined) {
    drawVisualization();
  }
  
  afterUpdate(() => {
    if (flashEffect && flashEffect.id !== lastFlashId) {
      if (config.showFlash) drawFlash(flashEffect.direction);
      lastFlashId = flashEffect.id;

      if (config.showOrbFlash && flashEffect.magnitude >= config.orbFlashThreshold) {
        flashVolatilityOrb(flashEffect.direction);
      }
    }
  });

  onMount(() => {
    if (canvasElement) {
      ctx = canvasElement.getContext('2d');
      canvasElement.width = config.visualizationsContentWidth;
      canvasElement.height = config.meterHeight;
      drawVisualization(); 
    }
  });

  function priceToY(price) {
    const height = canvasElement?.height || config.meterHeight || 120;
    const scale = d3.scaleLinear()
      .domain([state.adrLow, state.adrHigh])
      .range([height, 0]);
    return scale(price);
  }

  function drawVisualization() {
    if (!ctx || !canvasElement || !state || state.adrLow === undefined || state.adrHigh === undefined || state.currentPrice === undefined) return;

    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    
    const meterCenterX = config.centralAxisXPosition || (canvasElement.width / 2);

    drawVolatilityOrb(ctx);
    if (config.showMarketProfile) drawMarketProfile(ctx, meterCenterX);

    drawDayRangeMeter(ctx, meterCenterX);
    drawADRProximityPulse(ctx, meterCenterX);
    drawPriceFloat(ctx, meterCenterX);
    drawCurrentPrice(ctx);
    
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, canvasElement.width, canvasElement.height);
    
    ctx.fillStyle = '#ccc';
    ctx.font = '8px monospace';
    ctx.fillText(`${canvasElement.width}x${canvasElement.height}`, 5, 10);
  }

  function drawFlash(direction) {
    if (!ctx || !canvasElement) return;
    let opacity = config.flashIntensity || 0.3;
    const animate = () => {
      drawVisualization();
      const gradient = ctx.createRadialGradient(canvasElement.width / 2, canvasElement.height / 2, 0, canvasElement.width / 2, canvasElement.height / 2, canvasElement.width * 0.7);
      const flashColor = direction === 'up' ? `rgba(96, 165, 250, ${opacity})` : `rgba(248, 113, 113, ${opacity})`;
      gradient.addColorStop(0, flashColor);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
      opacity -= 0.05;
      if (opacity > 0) requestAnimationFrame(animate);
      else drawVisualization();
    };
    requestAnimationFrame(animate);
  }

  function drawVolatilityOrb(ctx, flashColor = null, flashOpacity = null) {
    if (!config.showVolatilityOrb) return;

    ctx.save();
    const centerX = canvasElement.width / 2;
    const centerY = canvasElement.height / 2;
    
    const volatilityIntensity = config.volatilityOrbInvertBrightness ? Math.min(state.volatility, 4) : Math.min(state.volatility, 2);

    let currentOrbColorR, currentOrbColorG, currentOrbColorB;

    if (flashColor) {
      [currentOrbColorR, currentOrbColorG, currentOrbColorB] = flashColor.split(',').map(Number);
    } else {
      switch (config.volatilityColorMode) {
          case 'directional':
              currentOrbColorR = 150; currentOrbColorG = 150; currentOrbColorB = 150; 
              if (state.lastTickDirection === 'up') { currentOrbColorR = 96; currentOrbColorG = 165; currentOrbColorB = 250; }
              else if (state.lastTickDirection === 'down') { currentOrbColorR = 239; currentOrbColorG = 68; currentOrbColorB = 68; }
              break;
          case 'intensity':
              currentOrbColorR = Math.round(75 + (147 - 75) * (volatilityIntensity / (config.volatilityOrbInvertBrightness ? 4 : 2)));
              currentOrbColorG = Math.round(85 + (197 - 85) * (volatilityIntensity / (config.volatilityOrbInvertBrightness ? 4 : 2)));
              currentOrbColorB = Math.round(99 + (253 - 99) * (volatilityIntensity / (config.volatilityOrbInvertBrightness ? 4 : 2)));
              break;
          case 'singleHue': 
              currentOrbColorR = Math.round(167 - (167 - 109) * (volatilityIntensity / (config.volatilityOrbInvertBrightness ? 4 : 2)));
              currentOrbColorG = Math.round(139 - (139 - 40) * (volatilityIntensity / (config.volatilityOrbInvertBrightness ? 4 : 2)));
              currentOrbColorB = Math.round(250 - (250 - 217) * (volatilityIntensity / (config.volatilityOrbInvertBrightness ? 4 : 2)));
              break;
          default: 
              currentOrbColorR = Math.round(75 + (147 - 75) * (volatilityIntensity / (config.volatilityOrbInvertBrightness ? 4 : 2)));
              currentOrbColorG = Math.round(85 + (197 - 85) * (volatilityIntensity / (config.volatilityOrbInvertBrightness ? 4 : 2)));
              currentOrbColorB = Math.round(99 + (253 - 99) * (volatilityIntensity / (config.volatilityOrbInvertBrightness ? 4 : 2)));
              break;
      }
    }

    let currentOrbBaseOpacity = flashOpacity !== null 
      ? flashOpacity 
      : (config.volatilityOrbInvertBrightness ? Math.min(1.0, 0.2 + (volatilityIntensity * 0.2)) : (0.5 + volatilityIntensity * 0.25));

    const baseRadius = (config.volatilityOrbBaseWidth || 40) / 2;
    let displayRadius = baseRadius;

    if (!config.volatilityOrbInvertBrightness) {
        displayRadius = baseRadius * (1 + Math.min(state.volatility * 0.5, 2));
    }

    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, displayRadius);
    const finalColorString = `${currentOrbColorR}, ${currentOrbColorG}, ${currentOrbColorB}`;

    if (config.volatilityOrbInvertBrightness) {
        const innerTransparentStop = Math.max(5, 80 - (volatilityIntensity * 18.75));
        gradient.addColorStop(0, `rgba(${finalColorString}, 0)`);
        gradient.addColorStop(innerTransparentStop / 100, `rgba(${finalColorString}, ${currentOrbBaseOpacity})`);
        gradient.addColorStop(1, `rgba(${finalColorString}, ${currentOrbBaseOpacity})`);
    } else {
        gradient.addColorStop(0, `rgba(${finalColorString}, ${currentOrbBaseOpacity * 0.1})`);
        gradient.addColorStop(0.4, `rgba(${finalColorString}, ${currentOrbBaseOpacity * 0.3})`);
        gradient.addColorStop(0.6, `rgba(${finalColorString}, ${currentOrbBaseOpacity * 0.6})`);
        gradient.addColorStop(0.8, `rgba(${finalColorString}, ${currentOrbBaseOpacity * 1.0})`);
        gradient.addColorStop(1, `rgba(${finalColorString}, 0)`);
    }

    ctx.globalAlpha = 1.0;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, displayRadius, 0, 2 * Math.PI, false);
    ctx.fill();
    ctx.restore();
  }

  function flashVolatilityOrb(direction) {
    if (!config.showOrbFlash || !ctx || !canvasElement) return;
    isOrbFlashing = true;
    const flashColor = direction === 'up' ? '96,165,250' : '248,113,113';
    const flashOpacity = config.orbFlashIntensity;
    drawVolatilityOrb(ctx, flashColor, flashOpacity);
    setTimeout(() => {
      isOrbFlashing = false;
      drawVisualization();
    }, 150);
  }
  
  function drawADRProximityPulse(ctx, meterCenterX) {
    if (!config.adrProximityThreshold) return;
    ctx.save();
    const proximityThresholdPips = config.adrProximityThreshold;
    const priceRange = state.adrHigh - state.adrLow;
    if (priceRange <= 0) { ctx.restore(); return; }
    
    const pipsToPrice = priceRange / config.adrRange;
    const proximityThresholdPrice = proximityThresholdPips * pipsToPrice;

    const highProximity = Math.abs(state.adrHigh - state.currentPrice) < proximityThresholdPrice;
    const lowProximity = Math.abs(state.adrLow - state.currentPrice) < proximityThresholdPrice;
    const meterWidth = 40;

    if (highProximity || lowProximity) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#60a5fa';
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;

        if (highProximity) {
            const highY = priceToY(state.adrHigh);
            ctx.beginPath();
            ctx.moveTo(meterCenterX - meterWidth / 2, highY);
            ctx.lineTo(meterCenterX + meterWidth / 2, highY);
            ctx.stroke();
        }

        if (lowProximity) {
            const lowY = priceToY(state.adrLow);
            ctx.beginPath();
            ctx.moveTo(meterCenterX - meterWidth / 2, lowY);
            ctx.lineTo(meterCenterX + meterWidth / 2, lowY);
            ctx.stroke();
        }
    }
    ctx.restore();
  }

  function drawMarketProfile(ctx, meterCenterX) {
    if (!marketProfileData?.levels?.length) return;
    ctx.save();
    
    const maxVolume = Math.max(...marketProfileData.levels.map(l => l.volume));
    if (maxVolume <= 0) {
      ctx.restore();
      return;
    }

    const profileMaxWidth = (config.visualizationsContentWidth / 2) - 10; 
    const scaleFactor = profileMaxWidth / maxVolume;

    const profilePoints = marketProfileData.levels.map(level => ({
      price: level.price,
      y: priceToY(level.price),
      buyWidth: (level.buy || 0) * scaleFactor,
      sellWidth: (level.sell || 0) * scaleFactor,
      totalWidth: level.volume * scaleFactor
    }));

    if (config.marketProfileView === 'outline') {
      const drawOutline = (side, color) => {
        const areaGenerator = d3.area()
          .y(d => d.y)
          .x0(meterCenterX)
          .x1(d => side === 'buy' ? meterCenterX + d.buyWidth : meterCenterX - d.sellWidth)
          .curve(d3.curveBasis)
          .context(ctx);

        ctx.beginPath();
        areaGenerator(profilePoints);
        ctx.fillStyle = `rgba(${color}, 0.2)`;
        ctx.fill();
        ctx.strokeStyle = `rgb(${color})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      };
      
      if (config.showSingleSidedProfile) {
        if(config.singleSidedProfileSide === 'right') drawOutline('buy', '59, 130, 246');
        else drawOutline('sell', '239, 68, 68');
      } else {
        drawOutline('buy', '59, 130, 246');
        drawOutline('sell', '239, 68, 68');
      }
      
    } else {
      const drawBars = (side, color) => {
        ctx.fillStyle = `rgba(${color}, 0.5)`;
        profilePoints.forEach(p => {
          if (side === 'buy' && p.buyWidth > 0) {
            ctx.fillRect(meterCenterX, p.y - 0.5, p.buyWidth, 1);
          } else if (side === 'sell' && p.sellWidth > 0) {
            ctx.fillRect(meterCenterX - p.sellWidth, p.y - 0.5, p.sellWidth, 1);
          }
        });
      };

      if (config.showSingleSidedProfile) {
         if(config.singleSidedProfileSide === 'right') drawBars('buy', '59, 130, 246');
         else drawBars('sell', '239, 68, 68');
      } else {
        drawBars('buy', '59, 130, 246');
        drawBars('sell', '239, 68, 68');
      }
    }
    ctx.restore();
  }

  function drawDayRangeMeter(ctx, meterCenterX) {
    ctx.save();
    const meterWidth = 40;
    const lowY = priceToY(state.adrLow);
    const highY = priceToY(state.adrHigh);
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(meterCenterX, 0);
    ctx.lineTo(meterCenterX, canvasElement.height);
    ctx.stroke();
    
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(meterCenterX - meterWidth / 2, lowY);
    ctx.lineTo(meterCenterX + meterWidth / 2, lowY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(meterCenterX - meterWidth / 2, highY);
    ctx.lineTo(meterCenterX + meterWidth / 2, highY);
    ctx.stroke();
    
    const adrRange = state.adrHigh - state.adrLow;
    if (adrRange > 0) {
      const steps = [0.25, 0.50, 0.75];
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      steps.forEach(step => {
        const price = state.adrLow + adrRange * step;
        const y = priceToY(price);
        ctx.beginPath();
        ctx.moveTo(meterCenterX - meterWidth / 4, y);
        ctx.lineTo(meterCenterX + meterWidth / 4, y);
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  function drawPriceFloat(ctx, meterCenterX) {
    ctx.save();
    const y = priceToY(state.currentPrice);
    const floatWidth = (config.priceFloatWidth || 100);
    const floatHeight = 4;
    const xOffset = config.priceFloatXOffset || 0;
    const priceFloatColor = '#a78bfa';
    
    ctx.shadowColor = priceFloatColor;
    ctx.shadowBlur = 10;
    ctx.fillStyle = priceFloatColor;
    ctx.fillRect(meterCenterX - floatWidth / 2 + xOffset, y - floatHeight / 2, floatWidth, floatHeight);
    ctx.restore();
  }

  function drawCurrentPrice(ctx) {
    if (state.currentPrice === undefined) return;
    ctx.save();
    
    const y = priceToY(state.currentPrice);
    const meterCenterX = canvasElement.width / 2 + (state.meterHorizontalOffset || 0);
    const x = meterCenterX + (config.priceHorizontalOffset || 30);
    
    const priceString = state.currentPrice.toFixed(5);
    const [integerPart, decimalPart] = priceString.split('.');
    const bigFigure = `${integerPart}.${decimalPart.substring(0, 2)}`;
    const pips = decimalPart.substring(2, 4);
    const pipette = decimalPart.substring(4, 5);

    const baseFontSize = config.priceFontSize || 14;
    const fontWeight = config.priceFontWeight || 'normal';

    let totalWidth = 0;
    const bigFigureFont = `${fontWeight} ${baseFontSize * (config.bigFigureFontSizeRatio || 1)}px "Roboto Mono", monospace`;
    ctx.font = bigFigureFont;
    totalWidth += ctx.measureText(bigFigure).width;

    const pipsFont = `${fontWeight} ${baseFontSize * (config.pipFontSizeRatio || 1)}px "Roboto Mono", monospace`;
    ctx.font = pipsFont;
    totalWidth += ctx.measureText(pips).width;
    
    let pipetteWidth = 0;
    if (config.showPipetteDigit) {
        const pipetteFont = `${fontWeight} ${baseFontSize * (config.pipetteFontSizeRatio || 1)}px "Roboto Mono", monospace`;
        ctx.font = pipetteFont;
        pipetteWidth = ctx.measureText(pipette).width;
        totalWidth += pipetteWidth;
    }
    const textHeight = baseFontSize * (config.bigFigureFontSizeRatio || 1);

    if (config.showPriceBackground || config.showPriceBoundingBox) {
        const padding = config.priceDisplayPadding || 4;
        const rectX = x - padding;
        const rectY = y - textHeight / 2 - padding;
        const rectWidth = totalWidth + (padding * 2);
        const rectHeight = textHeight + (padding * 2);

        if (config.showPriceBackground) {
            ctx.fillStyle = 'rgba(10, 10, 10, 0.75)';
            ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
        }
        if (config.showPriceBoundingBox) {
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 1;
            ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
        }
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = getPriceTextColor();
    
    let currentX = x;
    
    ctx.font = bigFigureFont;
    ctx.fillText(bigFigure, currentX, y);
    currentX += ctx.measureText(bigFigure).width;

    ctx.font = pipsFont;
    ctx.fillText(pips, currentX, y);
    currentX += ctx.measureText(pips).width;

    if (config.showPipetteDigit) {
        ctx.font = `${fontWeight} ${baseFontSize * (config.pipetteFontSizeRatio || 1)}px "Roboto Mono", monospace`;
        ctx.fillText(pipette, currentX, y);
    }

    ctx.restore();
  }

  function getPriceTextColor() {
    if (state.lastTickDirection === 'up') return config.priceUpColor || '#22c55e';
    if (state.lastTickDirection === 'down') return config.priceDownColor || '#ef4444';
    return '#d1d5db';
  }
</script>

<div class="visualization-container" style="width: {config.visualizationsContentWidth}px; height: {config.meterHeight}px;">
  <canvas bind:this={canvasElement}></canvas>
</div>

<style>
  /* ... existing styles ... */
</style>
