<script>
  import { onMount, afterUpdate } from 'svelte';
  import * as d3 from 'd3';
  import { marketDataStore } from '../data/wsClient.js'; 

  export let symbol;
  export let config = {};
  export let state = {};
  export let marketProfile = {};
  export let flashEffect = null;

  let canvasElement;
  let ctx;
  let lastFlashId = null;

  // Reactively get market data for the specific symbol
  $: symbolMarketData = $marketDataStore[symbol];

  // Reactive scale
  let y = d3.scaleLinear();

  $: if (ctx && state && typeof state.currentPrice === 'number' && config && symbolMarketData) {
    // Update the scale's domain whenever data changes
    const minPrice = Math.min(symbolMarketData.prevDayLow, state.currentPrice);
    const maxPrice = Math.max(symbolMarketData.prevDayHigh, state.currentPrice);
    y.domain([minPrice, maxPrice]).range([canvasElement.height, 0]);
    
    drawVisualization();
  }
  
  afterUpdate(() => {
    if (flashEffect && flashEffect.id !== lastFlashId) {
      lastFlashId = flashEffect.id;
      
      if (config.showFlash && flashEffect.magnitude >= config.flashThreshold) {
        drawFlash(flashEffect.direction);
      }
      
      if (config.showOrbFlash && flashEffect.magnitude >= config.orbFlashThreshold) {
        flashVolatilityOrb(flashEffect.direction);
      }
    }
  });

  onMount(() => {
    if (canvasElement) {
      ctx = canvasElement.getContext('2d');
      canvasElement.width = config?.visualizationsContentWidth || 220;
      canvasElement.height = config?.meterHeight || 120;
      // Initial draw might be empty if data isn't ready, which is fine.
    }
  });

  function drawVisualization() {
    if (!ctx || !canvasElement || !state || !config || !symbolMarketData) return;

    if(canvasElement.width !== config.visualizationsContentWidth) canvasElement.width = config.visualizationsContentWidth;
    if(canvasElement.height !== config.meterHeight) canvasElement.height = config.meterHeight;

    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    
    const meterCenterX = config.centralAxisXPosition;

    if (config.showVolatilityOrb) drawVolatilityOrb(ctx);
    if (config.showMarketProfile) drawMarketProfile(ctx, meterCenterX);

    drawDayRangeMeter(ctx, meterCenterX);
    drawADRProximityPulse(ctx);
    drawPriceFloat(ctx, meterCenterX);
    drawCurrentPrice(ctx, meterCenterX);
    
    if (config.showMaxMarker) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, canvasElement.width, canvasElement.height);
    }
  }

  function drawFlash(direction) {
    let opacity = Math.min(config.flashIntensity, 1.0);
    const animate = () => {
      drawVisualization();
      
      const gradient = ctx.createRadialGradient(canvasElement.width / 2, canvasElement.height / 2, 0, canvasElement.width / 2, canvasElement.height / 2, canvasElement.width);
      const color = direction === 'up' ? '59, 130, 246' : '239, 68, 68';
      
      gradient.addColorStop(0, `rgba(${color}, ${opacity * 0.5})`);
      gradient.addColorStop(1, `rgba(${color}, 0)`);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
      
      opacity -= 0.04;
      if (opacity > 0) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }

  function drawVolatilityOrb(ctx, flashInfo = null) {
    const centerX = canvasElement.width / 2;
    const centerY = canvasElement.height / 2;
    
    const volatility = state.volatility || 0;
    const volatilityIntensity = config.volatilityOrbInvertBrightness ? Math.min(volatility, 4) : Math.min(volatility, 2);

    let r, g, b, opacity;

    if (flashInfo) {
      [r, g, b] = flashInfo.color.split(',').map(Number);
      opacity = flashInfo.opacity;
    } else {
      switch (config.volatilityColorMode) {
          case 'directional':
              [r,g,b] = state.lastTickDirection === 'up' ? [96, 165, 250] : [239, 68, 68];
              break;
          case 'singleHue': 
              [r,g,b] = [167, 139, 250];
              break;
          default: // intensity
              r = 75 + (147 - 75) * (volatilityIntensity / 2);
              g = 85 + (197 - 85) * (volatilityIntensity / 2);
              b = 99 + (253 - 99) * (volatilityIntensity / 2);
              break;
      }
      opacity = config.volatilityOrbInvertBrightness ? Math.min(1.0, 0.2 + (volatilityIntensity * 0.2)) : (0.5 + volatilityIntensity * 0.25);
    }

    const baseRadius = config.volatilityOrbBaseWidth / 2;
    const sizeMultiplier = config.volatilitySizeMultiplier || 0.5;
    let displayRadius = baseRadius * (1 + Math.min(volatility * sizeMultiplier, 2));
    if (config.volatilityOrbInvertBrightness) {
        displayRadius = baseRadius;
    }

    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, displayRadius);
    const colorStr = `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`;

    if (config.volatilityOrbInvertBrightness) {
        const stop = Math.max(0.05, 0.8 - (volatilityIntensity * 0.1875));
        gradient.addColorStop(0, `rgba(${colorStr}, 0)`);
        gradient.addColorStop(stop, `rgba(${colorStr}, 0)`);
        gradient.addColorStop(1, `rgba(${colorStr}, ${opacity})`);
    } else {
        gradient.addColorStop(0, `rgba(${colorStr}, ${opacity * 0.3})`);
        gradient.addColorStop(0.8, `rgba(${colorStr}, ${opacity * 1.0})`);
        gradient.addColorStop(1, `rgba(${colorStr}, 0)`);
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, displayRadius, 0, 2 * Math.PI);
    ctx.fill();
  }

  function flashVolatilityOrb(direction) {
    let opacity = config.orbFlashIntensity;
    const flashColor = direction === 'up' ? '96,165,250' : '248,113,113';
    
    const animate = () => {
      drawVisualization(); // Redraw base
      drawVolatilityOrb(ctx, { color: flashColor, opacity: opacity });
      opacity -= 0.05;
      if (opacity > 0) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }
  
  function drawADRProximityPulse(ctx) {
    const priceRange = symbolMarketData.prevDayHigh - symbolMarketData.prevDayLow;
    if (priceRange <= 0 || !config.adrProximityThreshold) return;
    
    const proximityPrice = (config.adrProximityThreshold / 100) * priceRange;
    const highProximity = Math.abs(symbolMarketData.prevDayHigh - state.currentPrice) < proximityPrice;
    const lowProximity = Math.abs(symbolMarketData.prevDayLow - state.currentPrice) < proximityPrice;

    if (highProximity || lowProximity) {
        const yPos = highProximity ? y(symbolMarketData.prevDayHigh) : y(symbolMarketData.prevDayLow);
        const gradient = ctx.createLinearGradient(0, yPos, canvasElement.width, yPos);
        gradient.addColorStop(0, 'rgba(96, 165, 250, 0)');
        gradient.addColorStop(0.5, 'rgba(96, 165, 250, 0.7)');
        gradient.addColorStop(1, 'rgba(96, 165, 250, 0)');
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.shadowColor = '#60a5fa';
        ctx.shadowBlur = 10;
        
        ctx.beginPath();
        ctx.moveTo(0, yPos);
        ctx.lineTo(canvasElement.width, yPos);
        ctx.stroke();
        
        ctx.shadowBlur = 0;
    }
  }

  function drawMarketProfile(ctx, meterCenterX) {
    if (!marketProfile?.levels?.length) return; 
    
    const maxVolume = Math.max(...marketProfile.levels.map(l => l.volume));
    if (maxVolume <= 0) return;

    const profileMaxWidth = (canvasElement.width / 2) - 10;
    const scaleFactor = profileMaxWidth / maxVolume;

    const profilePoints = marketProfile.levels
      .map(level => ({
        y: y(level.price),
        buyWidth: (level.buy || 0) * scaleFactor,
        sellWidth: (level.sell || 0) * scaleFactor,
      }));

    const drawSide = (side) => {
        const areaGenerator = d3.area()
            .y(d => d.y)
            .x0(meterCenterX)
            .x1(d => side === 'buy' ? meterCenterX + d.buyWidth : meterCenterX - d.sellWidth)
            .curve(d3.curveBasis)
            .context(ctx);

        ctx.beginPath();
        areaGenerator(profilePoints);
        
        const color = side === 'buy' ? '59, 130, 246' : '239, 68, 68';
        if (config.marketProfileView === 'outline') {
            ctx.fillStyle = `rgba(${color}, 0.2)`;
            ctx.fill();
            ctx.strokeStyle = `rgb(${color})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        } else { // bars
            ctx.fillStyle = `rgba(${color}, 0.5)`;
            profilePoints.forEach(p => {
                const width = side === 'buy' ? p.buyWidth : p.sellWidth;
                if (width > 0) {
                    const x = side === 'buy' ? meterCenterX : meterCenterX - width;
                    ctx.fillRect(x, p.y - 0.5, width, 1);
                }
            });
        }
    };
      
    if (config.showSingleSidedProfile) {
        if(config.singleSidedProfileSide === 'right') drawSide('buy');
        else drawSide('sell');
    } else {
        drawSide('buy');
        drawSide('sell');
    }
  }

  function drawDayRangeMeter(ctx, meterCenterX) {
    const lowY = y(symbolMarketData.prevDayLow);
    const highY = y(symbolMarketData.prevDayHigh);
    
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(meterCenterX, 0);
    ctx.lineTo(meterCenterX, canvasElement.height);
    ctx.stroke();
    
    ctx.strokeStyle = '#3b82f6';
    ctx.beginPath();
    ctx.moveTo(meterCenterX - 10, lowY);
    ctx.lineTo(meterCenterX + 10, lowY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(meterCenterX - 10, highY);
    ctx.lineTo(meterCenterX + 10, highY);
    ctx.stroke();
  }

  function drawPriceFloat(ctx, meterCenterX) {
    const yPos = y(state.currentPrice);
    const floatHeightPx = config.priceFloatHeight;
    const floatWidth = config.priceFloatWidth;
    const xOffset = config.priceFloatXOffset;
    
    const color = getPriceTextColor();
    
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.fillRect(meterCenterX - floatWidth / 2 + xOffset, yPos - floatHeightPx / 2, floatWidth, floatHeightPx);
    ctx.shadowBlur = 0;
  }

  function drawCurrentPrice(ctx, meterCenterX) {
    if (typeof state.currentPrice !== 'number' || isNaN(state.currentPrice) || state.currentPrice === 0) {
        return;
    }
    const yPos = y(state.currentPrice);
    
    const priceString = state.currentPrice.toFixed(5);
    const [integerPart, decimalPart] = priceString.split('.');
    
    if (!decimalPart) return;

    const bigFigure = `${integerPart}.${decimalPart.substring(0, 2)}`;
    const pips = decimalPart.substring(2, 4);
    const pipette = decimalPart.substring(4, 5);

    const baseFontSize = config.priceFontSize;
    const fontWeight = config.priceFontWeight;

    // --- Calculate text widths ---
    ctx.font = `${fontWeight} ${baseFontSize * config.bigFigureFontSizeRatio}px "Roboto Mono", monospace`;
    const bigFigureWidth = ctx.measureText(bigFigure).width;
    let maxSegmentHeight = baseFontSize * config.bigFigureFontSizeRatio;

    ctx.font = `${fontWeight} ${baseFontSize * config.pipFontSizeRatio}px "Roboto Mono", monospace`;
    const pipsWidth = ctx.measureText(pips).width;
    maxSegmentHeight = Math.max(maxSegmentHeight, baseFontSize * config.pipFontSizeRatio);
    
    let pipetteWidth = 0;
    if (config.showPipetteDigit) {
        ctx.font = `${fontWeight} ${baseFontSize * config.pipetteFontSizeRatio}px "Roboto Mono", monospace`;
        pipetteWidth = ctx.measureText(pipette).width;
        maxSegmentHeight = Math.max(maxSegmentHeight, baseFontSize * config.pipetteFontSizeRatio);
    }
    
    const totalTextWidth = bigFigureWidth + pipsWidth + pipetteWidth;
    const x = meterCenterX + config.priceHorizontalOffset - totalTextWidth; 

    // --- CRITICAL FIX: Restore the drawing logic for B-Box and BG ---
    if (config.showPriceBackground || config.showPriceBoundingBox) {
        const padding = config.priceDisplayPadding;
        const rectX = x - padding;
        const rectY = yPos - maxSegmentHeight / 2 - padding;
        const rectWidth = totalTextWidth + (padding * 2);
        const rectHeight = maxSegmentHeight + (padding * 2);

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

    // --- Draw the text ---
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = getPriceTextColor();
    
    let currentX = x;
    
    ctx.font = `${fontWeight} ${baseFontSize * config.bigFigureFontSizeRatio}px "Roboto Mono", monospace`;
    ctx.fillText(bigFigure, currentX, yPos);
    currentX += bigFigureWidth;

    ctx.font = `${fontWeight} ${baseFontSize * config.pipFontSizeRatio}px "Roboto Mono", monospace`;
    ctx.fillText(pips, currentX, yPos);
    currentX += pipsWidth;

    if (config.showPipetteDigit) {
        ctx.font = `${fontWeight} ${baseFontSize * config.pipetteFontSizeRatio}px "Roboto Mono", monospace`;
        ctx.fillText(pipette, currentX, yPos);
    }
  }

  function getPriceTextColor() {
    if (config.priceUseStaticColor) return config.priceStaticColor;
    if (state.lastTickDirection === 'up') return config.priceUpColor;
    if (state.lastTickDirection === 'down') return config.priceDownColor;
    return '#d1d5db'; // Default neutral
  }
</script>

<div class="visualization-container" style="width: {config.visualizationsContentWidth}px; height: {config.meterHeight}px;">
  <canvas bind:this={canvasElement}></canvas>
</div>

<style>
  .visualization-container {
    border: 1px solid #374151;
    border-radius: 8px;
    overflow: hidden;
    background-color: #0a0a0a;
  }
</style>
