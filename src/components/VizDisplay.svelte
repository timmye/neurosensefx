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
    
    // Use configurable central axis position
    const meterCenterX = config.centralAxisXPosition || (canvasElement.width / 2);

    drawVolatilityOrb(ctx);
    if (config.showMarketProfile) drawMarketProfile(ctx, meterCenterX);

    drawDayRangeMeter(ctx, meterCenterX);
    drawADRProximityPulse(ctx, meterCenterX);
    drawPriceFloat(ctx, meterCenterX);
    drawCurrentPrice(ctx, meterCenterX);
    
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
    
    // Fixed volatility calculation to match prototype - use normalized base volatility
    let volatilityIntensity;
    const baseVolatility = state.volatility || 0;
    
    // First normalize the base volatility to a standard scale (0-1)
    const normalizedVolatility = Math.min(baseVolatility / 2.0, 1.0); // Assuming max volatility of 2.0
    
    switch (config.frequencyMode) {
      case 'calm':
        volatilityIntensity = normalizedVolatility * 0.5; // Reduced intensity
        break;
      case 'normal':
        volatilityIntensity = normalizedVolatility * 1.0; // Base intensity
        break;
      case 'active':
        volatilityIntensity = normalizedVolatility * 1.5; // Increased intensity
        break;
      case 'volatile':
        volatilityIntensity = normalizedVolatility * 2.0; // Maximum intensity
        break;
      default:
        volatilityIntensity = normalizedVolatility * 1.0;
    }

    // Cap the final intensity
    volatilityIntensity = Math.min(volatilityIntensity, 2.0);

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
              const maxIntensity = 2.0;
              const intensityRatio = Math.min(volatilityIntensity / maxIntensity, 1.0);
              currentOrbColorR = Math.round(75 + (147 - 75) * intensityRatio);
              currentOrbColorG = Math.round(85 + (197 - 85) * intensityRatio);
              currentOrbColorB = Math.round(99 + (253 - 99) * intensityRatio);
              break;
          case 'singleHue': 
              const maxIntensityHue = 2.0;
              const hueRatio = Math.min(volatilityIntensity / maxIntensityHue, 1.0);
              currentOrbColorR = Math.round(167 - (167 - 109) * hueRatio);
              currentOrbColorG = Math.round(139 - (139 - 40) * hueRatio);
              currentOrbColorB = Math.round(250 - (250 - 217) * hueRatio);
              break;
          default: 
              const maxIntensityDefault = 2.0;
              const defaultRatio = Math.min(volatilityIntensity / maxIntensityDefault, 1.0);
              currentOrbColorR = Math.round(75 + (147 - 75) * defaultRatio);
              currentOrbColorG = Math.round(85 + (197 - 85) * defaultRatio);
              currentOrbColorB = Math.round(99 + (253 - 99) * defaultRatio);
              break;
      }
    }

    let currentOrbBaseOpacity = flashOpacity !== null 
      ? flashOpacity 
      : (config.volatilityOrbInvertBrightness 
          ? Math.min(1.0, 0.2 + (volatilityIntensity * 0.2)) 
          : (0.3 + volatilityIntensity * 0.35)); // Adjusted base opacity

    const baseRadius = (config.volatilityOrbBaseWidth || 40) / 2;
    let displayRadius = baseRadius;

    // Fixed orb size scaling - more responsive to volatility changes
    if (!config.volatilityOrbInvertBrightness) {
        const sizeMultiplier = 1 + (volatilityIntensity * 0.8); // More pronounced size changes
        displayRadius = baseRadius * Math.min(sizeMultiplier, 3.0); // Cap at 3x base size
    }

    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, displayRadius);
    const finalColorString = `${currentOrbColorR}, ${currentOrbColorG}, ${currentOrbColorB}`;

    if (config.volatilityOrbInvertBrightness) {
        const innerTransparentStop = Math.max(5, 80 - (volatilityIntensity * 20));
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
    
    const priceRange = state.adrHigh - state.adrLow;
    if (priceRange <= 0) { ctx.restore(); return; } 
    
    // Fixed: Calculate proximity threshold as percentage of ADR range in pips
    const adrRangePips = config.adrRange || 100; // Total ADR range in pips
    const thresholdPips = (config.adrProximityThreshold / 100) * adrRangePips;
    const pipValue = priceRange / adrRangePips; // Price value per pip
    const proximityThresholdPrice = thresholdPips * pipValue;

    const highProximity = Math.abs(state.adrHigh - state.currentPrice) <= proximityThresholdPrice;
    const lowProximity = Math.abs(state.adrLow - state.currentPrice) <= proximityThresholdPrice;
    const meterWidth = 40;

    if (highProximity || lowProximity) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#60a5fa';
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 3;

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
    if (!config.showMarketProfile || !marketProfileData?.levels?.length) return; 
    ctx.save();
    
    const maxVolume = Math.max(...marketProfileData.levels.map(l => l.volume));
    if (maxVolume <= 0) {
      ctx.restore();
      return;
    }

    const profileMaxWidth = (config.visualizationsContentWidth / 2) - 10; 
    const scaleFactor = maxVolume > 0 ? profileMaxWidth / maxVolume : 0;

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
      
    } else { // bars view
      const drawBars = (side, color) => {
        ctx.fillStyle = `rgba(${color}, 0.5)`;
        profilePoints.forEach(p => {
          const xPos = side === 'buy' ? meterCenterX : meterCenterX - p.sellWidth;
          const barDisplayWidth = side === 'buy' ? p.buyWidth : p.sellWidth;
          if (barDisplayWidth > 0) {
            ctx.fillRect(xPos, p.y - 0.5, barDisplayWidth, 1);
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
    
    // Vertical Axis Line - now respects meterCenterX
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(meterCenterX, 0);
    ctx.lineTo(meterCenterX, canvasElement.height);
    ctx.stroke();
    
    // ADR Boundary Lines
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
    
    // ADR Step Markers
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
    
    // Fixed: Calculate float height based on pip value and configurable pip height
    const priceRange = state.adrHigh - state.adrLow;
    const adrRangePips = config.adrRange || 100;
    const pixelsPerPip = canvasElement.height / adrRangePips;
    const floatHeightPips = config.priceFloatHeight || 1; // Default to 1 pip
    const floatHeightPx = Math.max(1, floatHeightPips * pixelsPerPip);

    const floatWidth = (config.priceFloatWidth || 100);
    const xOffset = config.priceFloatXOffset || 0;
    
    // Fixed: Use blue for up, red for down, gray for no movement
    const priceFloatColor = state.lastTickDirection === 'up' ? '#3b82f6' : // Blue
                            (state.lastTickDirection === 'down' ? '#ef4444' : '#9ca3af'); // Red/Gray
    
    ctx.shadowColor = priceFloatColor;
    ctx.shadowBlur = 10;
    ctx.fillStyle = priceFloatColor;
    ctx.fillRect(meterCenterX - floatWidth / 2 + xOffset, y - floatHeightPx / 2, floatWidth, floatHeightPx);
    ctx.restore();
  }

  function drawCurrentPrice(ctx, meterCenterX) {
    if (state.currentPrice === undefined) return;
    ctx.save();
    
    const y = priceToY(state.currentPrice);
    
    const priceString = state.currentPrice.toFixed(5);
    const [integerPart, decimalPart] = priceString.split('.');
    const bigFigure = `${integerPart}.${decimalPart.substring(0, 2)}`;
    const pips = decimalPart.substring(2, 4);
    const pipette = decimalPart.substring(4, 5);

    const baseFontSize = config.priceFontSize || 14;
    const fontWeight = config.priceFontWeight || 'normal';

    let maxSegmentHeight = 0; 

    // Measure segments to calculate total text width for right alignment
    ctx.font = `${fontWeight} ${baseFontSize * (config.bigFigureFontSizeRatio || 1)}px "Roboto Mono", monospace`;
    const bigFigureWidth = ctx.measureText(bigFigure).width;
    maxSegmentHeight = Math.max(maxSegmentHeight, baseFontSize * (config.bigFigureFontSizeRatio || 1));

    ctx.font = `${fontWeight} ${baseFontSize * (config.pipFontSizeRatio || 1)}px "Roboto Mono", monospace`;
    const pipsWidth = ctx.measureText(pips).width;
    maxSegmentHeight = Math.max(maxSegmentHeight, baseFontSize * (config.pipFontSizeRatio || 1));
    
    let pipetteWidth = 0;
    if (config.showPipetteDigit) {
        ctx.font = `${fontWeight} ${baseFontSize * (config.pipetteFontSizeRatio || 1)}px "Roboto Mono", monospace`;
        pipetteWidth = ctx.measureText(pipette).width;
        maxSegmentHeight = Math.max(maxSegmentHeight, baseFontSize * (config.pipetteFontSizeRatio || 1));
    }

    const totalTextWidth = bigFigureWidth + pipsWidth + pipetteWidth;

    // Fixed: Right align to meterCenterX + offset
    const x = meterCenterX + (config.priceHorizontalOffset || 0) - totalTextWidth; 
    
    // Draw Background / Bounding Box
    if (config.showPriceBackground || config.showPriceBoundingBox) {
        const padding = config.priceDisplayPadding || 4;
        const rectX = x - padding;
        const rectY = y - maxSegmentHeight / 2 - padding;
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

    // Draw Text with proper color handling
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    let currentX = x;
    
    // Use dynamic or static color based on configuration
    const useStaticColor = config.priceStaticColor !== undefined ? config.priceStaticColor : false;
    const textColor = useStaticColor ? '#d1d5db' : getPriceTextColor();
    ctx.fillStyle = textColor;
    
    ctx.font = `${fontWeight} ${baseFontSize * (config.bigFigureFontSizeRatio || 1)}px "Roboto Mono", monospace`;
    ctx.fillText(bigFigure, currentX, y);
    currentX += bigFigureWidth;

    ctx.font = `${fontWeight} ${baseFontSize * (config.pipFontSizeRatio || 1)}px "Roboto Mono", monospace`;
    ctx.fillText(pips, currentX, y);
    currentX += pipsWidth;

    if (config.showPipetteDigit) {
        ctx.font = `${fontWeight} ${baseFontSize * (config.pipetteFontSizeRatio || 1)}px "Roboto Mono", monospace`;
        ctx.fillText(pipette, currentX, y);
    }

    ctx.restore();
  }

  function getPriceTextColor() {
    if (state.lastTickDirection === 'up') return config.priceUpColor || '#3b82f6'; // Blue
    if (state.lastTickDirection === 'down') return config.priceDownColor || '#ef4444'; // Red
    return '#d1d5db'; // Gray for no movement
  }
</script>

<div class="visualization-container" style="width: {config.visualizationsContentWidth}px; height: {config.meterHeight}px;">
  <canvas bind:this={canvasElement}></canvas>
</div>

<style>
  .visualization-container {
    position: relative;
    border: 1px solid #333;
  }
  
  canvas {
    display: block;
    background-color: #0a0a0a;
  }
</style>