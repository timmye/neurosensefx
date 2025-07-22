<script>
  import { onMount } from 'svelte';
  import { config, appState } from '../stores.js'; // Import Svelte stores
  import * as d3 from 'd3'; // Import D3 for utility functions if needed

  export let id;
  export let data = {}; // Placeholder for data prop

  let canvasElement; // Bind to the canvas
  let ctx; // Canvas 2D context
  let priceDisplayElement; // Bind to the price display DOM element

  // Using Svelte's auto-subscriptions for store values
  // All config values will now be accessed via $config.propertyName
  // All state values will now be accessed via $appState.propertyName

  // Svelte reactivity for canvas dimensions and redrawing
  // This now reacts to changes in the $config store
  $: if (canvasElement && ctx && $config) {
    canvasElement.width = $config.visualizationsContentWidth;
    canvasElement.height = $config.meterHeight;
    drawVisualization();
  }

  onMount(() => {
    if (canvasElement) {
      ctx = canvasElement.getContext('2d');
      // Initial draw, subsequent draws handled by reactivity to $appState and $config
      drawVisualization();

      // The gameLoop (simulation) will now be handled by the Web Worker.
      // This component will simply react to changes in $appState.
    } else {
        console.error("Canvas element not found in VizDisplay.svelte");
    }
  });

  // --- Helper to convert price to Y-coordinate on canvas ---
  // This function now returns Y relative to the TOP of the meter.
  function priceToY(price) {
    const effectiveADRInPrice = Math.max($config.adrRange / 10000, $appState.maxObservedPrice - $appState.minObservedPrice);
    const lowPrice = $appState.midPrice - (effectiveADRInPrice / 2);
    let percentage = (price - lowPrice) / effectiveADRInPrice;
    percentage = Math.max(0, Math.min(1, percentage));
    return (1 - percentage) * $config.meterHeight; // Invert Y-axis: 0% at bottom, 100% at top of meter.
  }

  // --- Main drawing function on Canvas ---
  function drawVisualization() {
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Draw background
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);

    // Calculate meter's position centered vertically on canvas
    const meterWidth = $config.centralMeterFixedThickness;
    const meterHeight = $config.meterHeight;
    const meterX = $config.centralAxisXPosition;
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
    const priceFloatDrawY = meterY + priceToY($appState.currentPrice) - (2 / 2); // priceToY is relative to meter top, 2 is float height
    const priceFloatX = meterX + (meterWidth / 2) - ($config.priceFloatWidth / 2) + $config.priceFloatXOffset;
    const priceColor = $appState.lastTickDirection > 0 ? '#22c55e' : ($appState.lastTickDirection < 0 ? '#ef4444' : '#a78bfa');

    ctx.fillStyle = priceColor;
    ctx.fillRect(priceFloatX, priceFloatDrawY, $config.priceFloatWidth, 2); // 2px height

    // Draw Max Deflection Marker
    drawMaxDeflection(priceFloatDrawY, meterX, meterWidth);

    // Draw Market Profile
    drawMarketProfile(meterX, meterWidth, meterY, meterHeight);

    // Update price display DOM element
    if (priceDisplayElement) {
        priceDisplayElement.style.top = `${priceFloatDrawY}px`; // Uses the same Y as the price float
        
        // Calculate left position for priceDisplayElement
        const priceFloatActualLeft = meterX + meterWidth / 2 - $config.priceFloatWidth / 2 + $config.priceFloatXOffset;
        priceDisplayElement.style.left = `${priceFloatActualLeft - $config.priceHorizontalOffset - priceDisplayElement.offsetWidth}px`;

        const priceString = $appState.currentPrice.toFixed(5);
        const decimalIndex = priceString.indexOf('.');
        let formattedPrice = '';
        if (decimalIndex !== -1 && priceString.length >= decimalIndex + 5) {
            const bigFigure = priceString.substring(0, decimalIndex + 3);
            const pip = priceString.substring(decimalIndex + 3, decimalIndex + 5);
            const pipette = priceString.substring(decimalIndex + 5);

            formattedPrice = `
                <span class="big-figure">${bigFigure}</span><span class="pip">${pip}${$config.showPipetteDigit ? `<span class="pipette-inner">${pipette}</span>` : ''}</span>
            `;
        } else {
            formattedPrice = priceString;
        }
        priceDisplayElement.innerHTML = formattedPrice;

        // Apply bounding box and background styles to the priceDisplayElement
        priceDisplayElement.style.border = 'none';
        priceDisplayElement.style.borderRadius = '0';
        priceDisplayElement.style.backgroundColor = 'transparent';
        priceDisplayElement.style.padding = '0';

        if ($config.showPriceBoundingBox || $config.showPriceBackground) {
            priceDisplayElement.style.padding = `${$config.priceDisplayPadding}px`;
        }

        if ($config.showPriceBoundingBox) {
            priceDisplayElement.style.border = '1px solid #4b5563';
            priceDisplayElement.style.borderRadius = '4px';
        }

        if ($config.showPriceBackground) {
            priceDisplayElement.style.backgroundColor = 'rgba(17, 24, 39, 0.7)';
        }

        // Update CSS custom properties for digit font sizes
        priceDisplayElement.style.setProperty('--big-figure-font-size-ratio', $config.bigFigureFontSizeRatio);
        priceDisplayElement.style.setProperty('--pip-font-size-ratio', $config.pipFontSizeRatio);
        priceDisplayElement.style.setProperty('--pipette-font-size-ratio', $config.pipetteFontSizeRatio);
    }
  }

  /**
   * Draws the Max Deflection Marker on the canvas.
   * @param {number} priceFloatY - The current Y position of the price float on the canvas.
   * @param {number} meterX - The X position of the central meter.
   * @param {number} meterWidth - The width of the central meter.
   */
  function drawMaxDeflection(priceFloatY, meterX, meterWidth) {
      if (!$config.showMaxMarker) return;

      const now = performance.now();
      const timeSinceUpdate = now - $appState.maxDeflection.lastUpdateTime;
      const decayProgress = Math.min(timeSinceUpdate / ($config.maxMarkerDecay * 1000), 1); // Convert decay to milliseconds
      
      if (decayProgress >= 1) {
          // Marker has fully decayed, no need to draw
          return;
      }

      // Calculate opacity for fading out
      ctx.save(); // Save the current canvas state (e.g., globalAlpha)
      ctx.globalAlpha = 0.7 * (1 - decayProgress);

      const markerWidth = 2;
      const markerHeight = 9;

      const upPositionOffset = $appState.maxDeflection.up * $config.pulseScale;
      const downPositionOffset = $appState.maxDeflection.down * $config.pulseScale;

      let markerX, markerColor;

      if ($appState.maxDeflection.up > $appState.maxDeflection.down) {
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
   * Draws the Market Profile (bar view) on the canvas.
   * @param {number} meterX - The X position of the central meter.
   * @param {number} meterWidth - The width of the central meter.
   * @param {number} meterY - The Y position of the central meter. (New parameter)
   * @param {number} meterHeight - The height of the central meter. (New parameter)
   */
  function drawMarketProfile(meterX, meterWidth, meterY, meterHeight) {
    if (!$config.showMarketProfile || !$appState.marketProfileData) return;

    let maxDeviation = 0;
    $appState.marketProfileData.forEach(data => {
        if ($config.showSingleSidedProfile) {
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
        $config.showSingleSidedProfile ?
            ($config.singleSidedProfileSide === 'left' ? availableWidthLeft : availableWidthRight) / maxDeviation :
            Math.min(availableWidthLeft, availableWidthRight) / maxDeviation
    ) : 0;

    // Render bars
    if ($config.marketProfileView === 'bars') {
        $appState.marketProfileData.forEach(dataPoint => {
            const price = dataPoint.price; // Use the price from the pre-processed data point
            const yCanvas = meterY + priceToY(price) - (dataPoint.barHeight / 2); 
            const barHeight = dataPoint.barHeight;

            // Render single-sided bars
            if ($config.showSingleSidedProfile) {
                const barWidth = dataPoint.total * scaleFactor;
                let barX;
                let barColor = 'rgba(191, 147, 255, 0.7)'; // Brighter purple

                if ($config.singleSidedProfileSide === 'left') {
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
    } else if ($config.marketProfileView === 'outline') {
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

  // Reactive statement to trigger drawVisualization when appState changes
  // This will be the new gameLoop for the UI, responding to worker messages.
  $: if (ctx && $appState) {
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
        /* Canvas will take dynamic width/height from Svelte script via `canvasElement.width = $config.visualizationsContentWidth;` */
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
    #priceDisplay .big-figure {
        font-size: var(--big-figure-font-size-ratio)em;
        font-weight: 700; /* Default bold */
    }
    #priceDisplay .pip {
        font-size: var(--pip-font-size-ratio)em;
        font-weight: 600; /* Default semibold */
    }
    /* New style for the inner pipette digit */
    #priceDisplay .pipette-inner {
        font-size: var(--pipette-font-size-ratio)em;
    }

    /* Define ADR Boundary Line colors for pulsing if needed for canvas */
    /* This CSS might not be directly used if drawn on canvas, but good for reference */
    .adr-boundary-line.pulse {
        /* background-color: #60a5fa; */
        /* box-shadow: 0 0 10px #60a5fa, 0 0 20px #60a5fa; */
    }
</style>
