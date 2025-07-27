<script>
  import { onMount, afterUpdate } from 'svelte';
  import * as d3 from 'd3';
  import {
    VisualizationConfigSchema,
    VisualizationStateSchema,
    MarketProfileSchema,
    FlashEffectSchema,
  } from '../data/schema.js';

  export let symbol;
  export let config;
  export let state;
  export let marketProfile;
  export let flashEffect;

  let canvasElement;
  let ctx;
  let lastFlashId = null;

  let validatedConfig = VisualizationConfigSchema.parse(config);
  let validatedState = VisualizationStateSchema.parse(state);
  let validatedMarketProfile = MarketProfileSchema.parse(marketProfile);
  let validatedFlashEffect = flashEffect ? FlashEffectSchema.parse(flashEffect) : null;

  $: {
    const configResult = VisualizationConfigSchema.safeParse(config);
    if (configResult.success) {
      validatedConfig = configResult.data;
    } else {
      console.error('Invalid config:', configResult.error);
    }

    const stateResult = VisualizationStateSchema.safeParse(state);
    if (stateResult.success) {
      validatedState = stateResult.data;
    } else {
      console.error('Invalid state:', stateResult.error);
    }

    const marketProfileResult = MarketProfileSchema.safeParse(marketProfile);
    if (marketProfileResult.success) {
      validatedMarketProfile = marketProfileResult.data;
    } else {
      console.error('Invalid market profile:', marketProfileResult.error);
    }

    const flashEffectResult = flashEffect ? FlashEffectSchema.safeParse(flashEffect) : { success: true, data: null };
    if (flashEffectResult.success) {
      validatedFlashEffect = flashEffectResult.data;
    } else {
      console.error('Invalid flash effect:', flashEffectResult.error);
    }
  }

  $: if (ctx && validatedState) {
    drawVisualization();
  }
  
  afterUpdate(() => {
    if (validatedFlashEffect && validatedFlashEffect.id !== lastFlashId) {
      lastFlashId = validatedFlashEffect.id;
      
      if (validatedConfig.showFlash && validatedFlashEffect.magnitude >= validatedConfig.flashThreshold) {
        drawFlash(validatedFlashEffect.direction);
      }
      
      if (validatedConfig.showOrbFlash && validatedFlashEffect.magnitude >= validatedConfig.orbFlashThreshold) {
        flashVolatilityOrb(validatedFlashEffect.direction);
      }
    }
  });

  onMount(() => {
    if (canvasElement) {
      ctx = canvasElement.getContext('2d');
      canvasElement.width = validatedConfig?.visualizationsContentWidth || 220;
      canvasElement.height = validatedConfig?.meterHeight || 120;
      drawVisualization();
    }
  });

  function drawVisualization() {
    if (!ctx || !canvasElement || !validatedState || !validatedConfig) return;

    if(canvasElement.width !== validatedConfig.visualizationsContentWidth) canvasElement.width = validatedConfig.visualizationsContentWidth;
    if(canvasElement.height !== validatedConfig.meterHeight) canvasElement.height = validatedConfig.meterHeight;

    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    
    if (!validatedState.currentPrice || validatedState.currentPrice === 0) {
        ctx.fillStyle = '#6b7280';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '14px "Roboto Mono", monospace';
        ctx.fillText('Waiting for live price...', canvasElement.width / 2, canvasElement.height / 2);
        return; 
    }

    const priceRange = Math.abs(validatedState.projectedHigh - validatedState.projectedLow);
    const buffer = priceRange * 0.1;
    const minPrice = Math.min(validatedState.projectedLow, validatedState.currentPrice) - buffer;
    const maxPrice = Math.max(validatedState.projectedHigh, validatedState.currentPrice) + buffer;
    
    const y = d3.scaleLinear()
      .domain([minPrice, maxPrice])
      .range([canvasElement.height, 0]);

    const meterCenterX = validatedConfig.centralAxisXPosition;

    if (validatedConfig.showVolatilityOrb) drawVolatilityOrb(ctx);
    if (validatedConfig.showMarketProfile) drawMarketProfile(ctx, meterCenterX, y);

    drawDayRangeMeter(ctx, meterCenterX, y);
    drawADRProximityPulse(ctx, y);
    drawPriceFloat(ctx, meterCenterX, y);
    drawCurrentPrice(ctx, meterCenterX, y);
    
    if (validatedConfig.showMaxMarker) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, canvasElement.width, canvasElement.height);
    }
  }

  function drawFlash(direction) {
    let opacity = Math.min(validatedConfig.flashIntensity, 1.0);
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
    
    const volatility = validatedState.volatility || 0;
    const volatilityIntensity = validatedConfig.volatilityOrbInvertBrightness ? Math.min(volatility, 4) : Math.min(volatility, 2);

    let r, g, b, opacity;

    if (flashInfo) {
      [r, g, b] = flashInfo.color.split(',').map(Number);
      opacity = flashInfo.opacity;
    } else {
      switch (validatedConfig.volatilityColorMode) {
          case 'directional':
              [r,g,b] = validatedState.lastTickDirection === 'up' ? [96, 165, 250] : [239, 68, 68];
              break;
          case 'singleHue': 
              [r,g,b] = [167, 139, 250];
              break;
          default:
              r = 75 + (147 - 75) * (volatilityIntensity / 2);
              g = 85 + (197 - 85) * (volatilityIntensity / 2);
              b = 99 + (253 - 99) * (volatilityIntensity / 2);
              break;
      }
      opacity = validatedConfig.volatilityOrbInvertBrightness ? Math.min(1.0, 0.2 + (volatilityIntensity * 0.2)) : (0.5 + volatilityIntensity * 0.25);
    }

    const baseRadius = validatedConfig.volatilityOrbBaseWidth / 2;
    const sizeMultiplier = validatedConfig.volatilitySizeMultiplier || 0.5;
    let displayRadius = baseRadius * (1 + Math.min(volatility * sizeMultiplier, 2));
    if (validatedConfig.volatilityOrbInvertBrightness) {
        displayRadius = baseRadius;
    }

    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, displayRadius);
    const colorStr = `${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}`;

    if (validatedConfig.volatilityOrbInvertBrightness) {
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
    let opacity = validatedConfig.orbFlashIntensity;
    const flashColor = direction === 'up' ? '96,165,250' : '248,113,113';
    
    const animate = () => {
      drawVisualization(); 
      drawVolatilityOrb(ctx, { color: flashColor, opacity: opacity });
      opacity -= 0.05;
      if (opacity > 0) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }
  
  function drawADRProximityPulse(ctx, y) {
    if (!validatedState.projectedHigh || !validatedState.projectedLow) return;
    const priceRange = validatedState.projectedHigh - validatedState.projectedLow;
    if (priceRange <= 0 || !validatedConfig.adrProximityThreshold) return;
    
    const proximityPrice = (validatedConfig.adrProximityThreshold / 100) * priceRange;
    const highProximity = Math.abs(validatedState.projectedHigh - validatedState.currentPrice) < proximityPrice;
    const lowProximity = Math.abs(validatedState.projectedLow - validatedState.currentPrice) < proximityPrice;

    if (highProximity || lowProximity) {
        const yPos = highProximity ? y(validatedState.projectedHigh) : y(validatedState.projectedLow);
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

  function drawMarketProfile(ctx, meterCenterX, y) {
    if (!validatedMarketProfile?.levels?.length) return; 
    
    const maxVolume = Math.max(...validatedMarketProfile.levels.map(l => l.volume));
    if (maxVolume <= 0) return;

    const profileMaxWidth = (canvasElement.width / 2) - 10;
    const scaleFactor = profileMaxWidth / maxVolume;

    const profilePoints = validatedMarketProfile.levels
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
        if (validatedConfig.marketProfileView === 'outline') {
            ctx.fillStyle = `rgba(${color}, 0.2)`;
            ctx.fill();
            ctx.strokeStyle = `rgb(${color})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        } else {
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
      
    if (validatedConfig.showSingleSidedProfile) {
        if(validatedConfig.singleSidedProfileSide === 'right') drawSide('buy');
        else drawSide('sell');
    } else {
        drawSide('buy');
        drawSide('sell');
    }
  }

  function drawDayRangeMeter(ctx, meterCenterX, y) {
    if (!validatedState.projectedHigh || !validatedState.projectedLow) return;
    const lowY = y(validatedState.projectedLow);
    const highY = y(validatedState.projectedHigh);
    
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

  function drawPriceFloat(ctx, meterCenterX, y) {
    const yPos = y(validatedState.currentPrice);
    const floatHeightPx = validatedConfig.priceFloatHeight;
    const floatWidth = validatedConfig.priceFloatWidth;
    const xOffset = validatedConfig.priceFloatXOffset;
    
    const color = getPriceTextColor();
    
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.fillRect(meterCenterX - floatWidth / 2 + xOffset, yPos - floatHeightPx / 2, floatWidth, floatHeightPx);
    ctx.shadowBlur = 0;
  }

  function drawCurrentPrice(ctx, meterCenterX, y) {
    if (typeof validatedState.currentPrice !== 'number' || isNaN(validatedState.currentPrice) || validatedState.currentPrice === 0) {
        return;
    }
    const yPos = y(validatedState.currentPrice);
    
    const priceString = validatedState.currentPrice.toFixed(5);
    const [integerPart, decimalPart] = priceString.split('.');
    
    if (!decimalPart) return;

    const bigFigure = `${integerPart}.${decimalPart.substring(0, 2)}`;
    const pips = decimalPart.substring(2, 4);
    const pipette = decimalPart.substring(4, 5);

    const baseFontSize = validatedConfig.priceFontSize;
    const fontWeight = validatedConfig.priceFontWeight;

    ctx.font = `${fontWeight} ${baseFontSize * validatedConfig.bigFigureFontSizeRatio}px "Roboto Mono", monospace`;
    const bigFigureWidth = ctx.measureText(bigFigure).width;
    let maxSegmentHeight = baseFontSize * validatedConfig.bigFigureFontSizeRatio;

    ctx.font = `${fontWeight} ${baseFontSize * validatedConfig.pipFontSizeRatio}px "Roboto Mono", monospace`;
    const pipsWidth = ctx.measureText(pips).width;
    maxSegmentHeight = Math.max(maxSegmentHeight, baseFontSize * validatedConfig.pipFontSizeRatio);
    
    let pipetteWidth = 0;
    if (validatedConfig.showPipetteDigit) {
        ctx.font = `${fontWeight} ${baseFontSize * validatedConfig.pipetteFontSizeRatio}px "Roboto Mono", monospace`;
        pipetteWidth = ctx.measureText(pipette).width;
        maxSegmentHeight = Math.max(maxSegmentHeight, baseFontSize * validatedConfig.pipetteFontSizeRatio);
    }
    
    const totalTextWidth = bigFigureWidth + pipsWidth + pipetteWidth;
    const x = meterCenterX + validatedConfig.priceHorizontalOffset - totalTextWidth; 

    if (validatedConfig.showPriceBackground || validatedConfig.showPriceBoundingBox) {
        const padding = validatedConfig.priceDisplayPadding;
        const rectX = x - padding;
        const rectY = yPos - maxSegmentHeight / 2 - padding;
        const rectWidth = totalTextWidth + (padding * 2);
        const rectHeight = maxSegmentHeight + (padding * 2);

        if (validatedConfig.showPriceBackground) {
            ctx.fillStyle = 'rgba(10, 10, 10, 0.75)';
            ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
        }
        if (validatedConfig.showPriceBoundingBox) {
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 1;
            ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
        }
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = getPriceTextColor();
    
    let currentX = x;
    
    ctx.font = `${fontWeight} ${baseFontSize * validatedConfig.bigFigureFontSizeRatio}px "Roboto Mono", monospace`;
    ctx.fillText(bigFigure, currentX, yPos);
    currentX += bigFigureWidth;

    ctx.font = `${fontWeight} ${baseFontSize * validatedConfig.pipFontSizeRatio}px "Roboto Mono", monospace`;
    ctx.fillText(pips, currentX, yPos);
    currentX += pipsWidth;

    if (validatedConfig.showPipetteDigit) {
        ctx.font = `${fontWeight} ${baseFontSize * validatedConfig.pipetteFontSizeRatio}px "Roboto Mono", monospace`;
        ctx.fillText(pipette, currentX, yPos);
    }
  }

  function getPriceTextColor() {
    if (validatedConfig.priceUseStaticColor) return validatedConfig.priceStaticColor;
    if (validatedState.currentPrice > validatedState.projectedHigh) return '#fbbf24'; 
    if (validatedState.currentPrice < validatedState.projectedLow) return '#fbbf24';
    if (validatedState.lastTickDirection === 'up') return validatedConfig.priceUpColor;
    if (validatedState.lastTickDirection === 'down') return validatedConfig.priceDownColor;
    return '#d1d5db'; 
  }
</script>

<div class="visualization-container" style="width: {validatedConfig.visualizationsContentWidth}px; height: {validatedConfig.meterHeight}px;">
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
