<script>
  import { onMount } from 'svelte';
  // Props will be used instead of stores
  import * as d3 from 'd3'; // Import D3 for utility functions if needed

  export let config = null;
  export let state = null;
  export let marketProfileData = null;

  let canvasElement; // Bind to the canvas
  let ctx; // Canvas 2D context
  let priceDisplayElement; // Bind to the price display DOM element

  // Using props directly instead of stores
  // All config values will now be accessed via config.propertyName
  // All state values will now be accessed via state.propertyName

  // Svelte reactivity for canvas dimensions and redrawing
  // This now reacts to changes in the config prop
  $: if (canvasElement && ctx && config) {
    canvasElement.width = config.visualizationsContentWidth;
    canvasElement.height = config.meterHeight;
    drawVisualization();
  }

  onMount(() => {
    if (canvasElement) {
      ctx = canvasElement.getContext('2d');
      // Initial draw, subsequent draws handled by reactivity to state and config
      drawVisualization();

      // The gameLoop (simulation) will now be handled by the Web Worker.
      // This component will simply react to changes in state.
    } else {
        console.error("Canvas element not found in VizDisplay.svelte");
    }
  });

  // --- Helper to convert price to Y-coordinate on canvas ---
  // This function now returns Y relative to the TOP of the meter.
  function priceToY(price) {
    const priceRange = state.maxObservedPrice - state.minObservedPrice;
    const effectiveADRInPrice = Math.max(config.adrRange / 10000, priceRange, 0.0001); // Ensure minimum range
    const lowPrice = state.midPrice - (effectiveADRInPrice / 2);
    let percentage = (price - lowPrice) / effectiveADRInPrice;
    percentage = Math.max(0, Math.min(1, percentage));
    return (1 - percentage) * config.meterHeight; // Invert Y-axis: 0% at bottom, 100% at top of meter.
  }

  // --- Main drawing function on Canvas ---
  function drawVisualization() {
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Draw background
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);

    // Calculate meter's position centered vertically on canvas
    const meterWidth = config.centralMeterFixedThickness;
    const meterHeight = config.meterHeight;
    const meterX = config.centralAxisXPosition;
    const meterY = (canvasElement.height / 2) - (meterHeight / 2); // Top-left Y of the meter

    // Draw central meter (dayRangeMeter)
    ctx.fillStyle = '#374151';
    ctx.fillRect(meterX, meterY, meterWidth, meterHeight);

    // Draw ADR step markers
    [0.25, 0.5, 0.75].forEach(step => {
      const markerWidth = 16;
      const markerHeight = 2;
      const markerX = meterX + (meterWidth / 2) - (markerWidth / 2);
      const markerYCanvas = meterY + (1 - step) * meterHeight - (markerHeight / 2); // Relative to canvas top
      ctx.fillStyle = '#a78bfa'; // Prev color from CSS
      ctx.fillRect(markerX, markerYCanvas, markerWidth, markerHeight);
    });

    // Draw ADR boundary lines
    const topADRYCanvas = meterY;
    const bottomADRYCanvas = meterY + meterHeight;

    ctx.strokeStyle = '#6b7280'; // Gray-500 from CSS
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, topADRYCanvas);
    ctx.lineTo(canvasElement.width, topADRYCanvas);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, bottomADRYCanvas);
    ctx.lineTo(canvasElement.width, bottomADRYCanvas);
    ctx.stroke();

    // Draw priceFloat
    const priceFloatDrawY = meterY + priceToY(state.currentPrice) - (2 / 2); // priceToY is relative to meter top, 2 is float height
    const priceFloatX = meterX + (meterWidth / 2) - (config.priceFloatWidth / 2) + config.priceFloatXOffset;
    const priceColor = state.lastTickDirection > 0 ? '#22c55e' : (state.lastTickDirection < 0 ? '#ef4444' : '#a78bfa');

    ctx.fillStyle = priceColor;
    ctx.fillRect(priceFloatX, priceFloatDrawY, config.priceFloatWidth, 2); // 2px height

    // Draw Max Deflection Marker
    drawMaxDeflection(priceFloatDrawY, meterX, meterWidth);

    // Draw Market Profile
    drawMarketProfile(meterX, meterWidth, meterY, meterHeight);

    // Draw Volatility Orb
    drawVolatilityOrb(meterX, meterWidth, meterY, meterHeight);

    // Draw Canvas-native price display
    drawPriceDisplay(meterX, meterWidth, meterY, meterHeight, priceFloatDrawY);
  }

  /**
   * Draws the Volatility Orb on the canvas.
   * @param {number} meterX - The X position of the central meter.
   * @param {number} meterWidth - The width of the central meter.
   * @param {number} meterY - The Y position of the central meter.
   * @param {number} meterHeight - The height of the central meter.
   */
  function drawVolatilityOrb(meterX, meterWidth, meterY, meterHeight) {
    if (!config.showVolatilityOrb || !state.volatility) return;

    const orbSize = 20;
    const orbX = meterX + meterWidth + 40;
    const orbY = meterY + meterHeight / 2;

    // Calculate color based on volatility level
    const volatility = state.volatility;
    let orbColor;
    if (volatility < 0.3) {
      orbColor = '#22c55e'; // Green for low volatility
    } else if (volatility < 0.7) {
      orbColor = '#f59e0b'; // Yellow for medium volatility
    } else {
      orbColor = '#ef4444'; // Red for high volatility
    }

    // Draw orb background
    ctx.fillStyle = orbColor;
    ctx.beginPath();
    ctx.arc(orbX, orbY, orbSize / 2, 0, 2 * Math.PI);
    ctx.fill();

    // Draw orb border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw volatility value
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((volatility * 100).toFixed(0) + '%', orbX, orbY);
  }

  /**
   * Draws the Max Deflection Marker on the canvas.
   * @param {number} priceFloatY - The current Y position of the price float on the canvas.
   * @param {number} meterX - The X position of the central meter.
   * @param {number} meterWidth - The width of the central meter.
   */
  function drawMaxDeflection(priceFloatY, meterX, meterWidth) {
      if (!config.showMaxMarker) return;

      const now = performance.now();
      const timeSinceUpdate = now - state.maxDeflection.lastUpdateTime;
      const decayProgress = Math.min(timeSinceUpdate / (config.maxMarkerDecay * 1000), 1); // Convert decay to milliseconds
      
      if (decayProgress >= 1) {
          // Marker has fully decayed, no need to draw
          return;
      }

      // Calculate opacity for fading out
      ctx.save(); // Save the current canvas state (e.g., globalAlpha)
      ctx.globalAlpha = 0.7 * (1 - decayProgress);

      const markerWidth = 2;
      const markerHeight = 9;

      const upPositionOffset = state.maxDeflection.up * config.pulseScale;
      const downPositionOffset = state.maxDeflection.down * config.pulseScale;

      let markerX, markerColor;

      if (state.maxDeflection.up > state.maxDeflection.down) {
          // Max deflection is upwards (right side of meter)
          markerX = meterX + meterWidth + upPositionOffset;
          markerColor = '#60a5fa'; // Blue
      } else {
          // Max deflection is downwards (left side of meter)
          markerX = meterX - downPositionOffset - markerWidth;
          markerColor = '#f87171'; // Red
      }

      ctx.fillStyle = markerColor;
      ctx.fillRect(markerX, priceFloatY - (markerHeight / 2), markerWidth, markerHeight);

      ctx.restore(); // Restore the canvas state
  }

  /**
   * Draws Canvas-native price display with formatting.
   * @param {number} meterX - The X position of the central meter.
   * @param {number} meterWidth - The width of the central meter.
   * @param {number} meterY - The Y position of the central meter.
   * @param {number} meterHeight - The height of the central meter.
   * @param {number} priceY - The Y position for the price display.
   */
  function drawPriceDisplay(meterX, meterWidth, meterY, meterHeight, priceY) {
    if (!config.showPriceDisplay) return;

    const priceString = state.currentPrice.toFixed(5);
    const decimalIndex = priceString.indexOf('.');
    
    if (decimalIndex === -1 || priceString.length < decimalIndex + 5) return;

    const bigFigure = priceString.substring(0, decimalIndex + 3);
    const pip = priceString.substring(decimalIndex + 3, decimalIndex + 5);
    const pipette = priceString.substring(decimalIndex + 5);

    // Calculate positions
    const priceFloatActualLeft = meterX + meterWidth / 2 - config.priceFloatWidth / 2 + config.priceFloatXOffset;
    const textX = priceFloatActualLeft - config.priceHorizontalOffset;
    const textY = priceY;

    // Background and bounding box
    if (config.showPriceBackground || config.showPriceBoundingBox) {
      ctx.save();
      
      // Measure text for background sizing
      ctx.font = `${config.bigFigureFontSizeRatio * 12}px monospace`;
      const bigFigureWidth = ctx.measureText(bigFigure).width;
      ctx.font = `${config.pipFontSizeRatio * 12}px monospace`;
      const pipWidth = ctx.measureText(pip).width;
      const pipetteWidth = config.showPipetteDigit ? ctx.measureText(pipette).width : 0;
      
      const totalWidth = bigFigureWidth + pipWidth + pipetteWidth + (config.priceDisplayPadding * 2);
      const totalHeight = 16 + (config.priceDisplayPadding * 2);
      
      const bgX = textX - totalWidth;
      const bgY = textY - totalHeight / 2;

      if (config.showPriceBackground) {
        ctx.fillStyle = 'rgba(17, 24, 39, 0.7)';
        ctx.fillRect(bgX, bgY, totalWidth, totalHeight);
      }

      if (config.showPriceBoundingBox) {
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 1;
        ctx.strokeRect(bgX, bgY, totalWidth, totalHeight);
      }
      
      ctx.restore();
    }

    // Draw text
    let currentX = textX - config.priceDisplayPadding;

    // Big figure
    ctx.save();
    ctx.font = `${config.bigFigureFontSizeRatio * 12}px monospace`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(bigFigure, currentX, textY);
    currentX -= ctx.measureText(bigFigure).width;

    // Pip
    ctx.font = `${config.pipFontSizeRatio * 12}px monospace`;
    ctx.fillStyle = '#a78bfa';
    ctx.fillText(pip, currentX, textY);
    currentX -= ctx.measureText(pip).width;

    // Pipette
    if (config.showPipetteDigit) {
      ctx.font = `${config.pipetteFontSizeRatio * 12}px monospace`;
      ctx.fillStyle = '#6b7280';
      ctx.fillText(pipette, currentX, textY);
    }
    ctx.restore();
  }

  /**
   * Draws the Market Profile (bar view) on the canvas.
   * @param {number} meterX - The X position of the central meter.
   * @param {number} meterWidth - The width of the central meter.
   * @param {number} meterY - The Y position of the central meter. (New parameter)
   * @param {number} meterHeight - The height of the central meter. (New parameter)
   */
  function drawMarketProfile(meterX, meterWidth, meterY, meterHeight) {
    if (!config.showMarketProfile || !marketProfileData) return;

    // Handle both Map and Object formats from the worker
    const profileEntries = marketProfileData instanceof Map
      ? Array.from(marketProfileData.entries())
      : Object.entries(marketProfileData);

    if (profileEntries.length === 0) return;

    // Convert Map/Object entries to the format expected by the drawing function
    const marketProfileArray = profileEntries.map(([priceBucket, data]) => {
      const price = parseFloat(priceBucket) / 10000; // Convert bucket to actual price
      return {
        price: price,
        buy: data.buy || 0,
        sell: data.sell || 0,
        total: data.total || 0,
        barHeight: 2 // Fixed height for now
      };
    });

    let maxDeviation = 0;
    marketProfileArray.forEach(data => {
        if (config.showSingleSidedProfile) {
            maxDeviation = Math.max(maxDeviation, data.total);
        } else {
            maxDeviation = Math.max(maxDeviation, data.buy, data.sell);
        }
    });

    const centralMeterLeftEdge = meterX;
    const centralMeterRightEdge = meterX + meterWidth;

    const availableWidthLeft = centralMeterLeftEdge;
    const availableWidthRight = canvasElement.width - centralMeterRightEdge;

    const scaleFactor = maxDeviation > 0 ? (
        config.showSingleSidedProfile ?
            (config.singleSidedProfileSide === 'left' ? availableWidthLeft : availableWidthRight) / maxDeviation :
            Math.min(availableWidthLeft, availableWidthRight) / maxDeviation
    ) : 0;

    // Render bars
    if (config.marketProfileView === 'bars') {
        marketProfileArray.forEach(dataPoint => {
            const price = dataPoint.price;
            const yCanvas = meterY + priceToY(price) - (dataPoint.barHeight / 2);
            const barHeight = dataPoint.barHeight;

            // Render single-sided bars
            if (config.showSingleSidedProfile) {
                const barWidth = dataPoint.total * scaleFactor;
                let barX;
                let barColor = 'rgba(191, 147, 255, 0.7)'; // Brighter purple

                if (config.singleSidedProfileSide === 'left') {
                    barX = centralMeterLeftEdge - barWidth;
                } else { // right
                    barX = centralMeterRightEdge;
                }
                ctx.fillStyle = barColor;
                ctx.fillRect(barX, yCanvas, barWidth, barHeight);
            } else {
                // Existing dual-sided bars
                if (dataPoint.buy > 0) {
                    const buyBarWidth = dataPoint.buy * scaleFactor;
                    const buyBarX = centralMeterRightEdge;
                    ctx.fillStyle = 'rgba(96, 165, 250, 0.5)'; // Blueish for buy
                    ctx.fillRect(buyBarX, yCanvas, buyBarWidth, barHeight);
                }
                if (dataPoint.sell > 0) {
                    const sellBarWidth = dataPoint.sell * scaleFactor;
                    const sellBarX = centralMeterLeftEdge - sellBarWidth;
                    ctx.fillStyle = 'rgba(239, 68, 68, 0.5)'; // Reddish for sell
                    ctx.fillRect(sellBarX, yCanvas, sellBarWidth, barHeight);
                }
            }
        });
    } else if (config.marketProfileView === 'outline') {
        // Outline view will be implemented in a later step using D3 paths
        // For now, it will just draw nothing if set to outline
    }
  }

  // Remove all tick generation and processing from here
  // These functions will be moved to the Web Worker
  // function generateTick() { ... }
  // function processTick(tick) { ... }
  // function updateMaxDeflection(tick) { ... }
  // function updateVolatility() { ... }
  // function gameLoop() { ... }

  // Reactive statement to trigger drawVisualization when state changes
  $: if (ctx && state) { // Use the prop here
    drawVisualization();
  }
</script>

<!-- HTML structure - minimal for Svelte to mount canvas and overlay price text -->
<main class="viz-wrapper">
    <div class="visualization-container">
        <canvas bind:this={canvasElement}></canvas>
        <!-- The price display is a separate DOM element overlaid on the canvas -->
        <div id="priceDisplay" class="absolute text-sm font-semibold text-gray-200" bind:this={priceDisplayElement}></div>
    </div>
</main>

<style>
    /* CSS copied and adapted from NeuroSense FX_trimmed.html */

    /* Adjusted main-container-wrapper to viz-wrapper for the Svelte component */
    .viz-wrapper {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%; /* Take full height of parent */
        width: 100%; /* Take full width of parent */
        overflow: hidden;
        flex-direction: column; /* Default for mobile: stack vertically */
        /* Ensure that viz-wrapper doesn't create scrollbars */
        position: relative;
    }

    @media (min-width: 768px) { /* md breakpoint */
        .viz-wrapper {
            flex-direction: row; /* For desktop: arrange horizontally */
        }
    }

    .visualization-container {
        position: relative;
        /* These widths/heights will be managed by the canvas element itself now */
        /* width: 100%; */
        /* height: 100%; */
        overflow: hidden;
        /* flex-shrink: 0; */ /* Only if we want it to not shrink below a certain size */
        border: 1px solid #374151; /* Keep the border from viz-wrapper/container */
    }

    canvas {
        display: block;
        /* Canvas will take dynamic width/height from Svelte script via `canvasElement.width = config.visualizationsContentWidth;` */
    }

    /* Price Display Styles */
    #priceDisplay {
        position: absolute;
        transform: translateY(-50%); /* Vertically center the text itself */
        transform-origin: center center; /* Ensure scaling is centered */
        z-index: 11; /* Ensure it's above other elements but below priceFloat (conceptually) */
        text-align: right; /* Align text to the right so it hugs the float */
        width: auto; /* Allow width to adjust to content */
        white-space: nowrap; /* Prevent price from wrapping */
        color: #d1d5db; /* Explicitly set to original text-gray-300 color */
        /* Custom properties for digit font sizes */
        --big-figure-font-size-ratio: 1.2;
        --pip-font-size-ratio: 1.1;
        --pipette-font-size-ratio: 0.8;

        /* NEW: Monospaced font for price display */
        font-family: 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace';
        box-sizing: border-box; /* Ensure padding is included in width/height */
    }

    /* Styles for price formatting - now controlled by JS with new config values */
    /* These classes are no longer used as price display is rendered on canvas */

    /* Define ADR Boundary Line colors for pulsing if needed for canvas */
    /* This CSS might not be directly used if drawn on canvas, but good for reference */
</style>