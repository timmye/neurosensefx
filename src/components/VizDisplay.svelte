<script>
  import { onMount, tick } from 'svelte';
  import * as d3 from 'd3'; // Import D3 for utility functions if needed

  export let id;
  export let data = {}; // Placeholder for data prop

  let canvasElement; // Bind to the canvas
  let ctx; // Canvas 2D context
  let priceDisplayElement; // Bind to the price display DOM element

  // --- CONFIGURATION & STATE (Adapted from trimmed.html) ---
  // Using Svelte's reactive declarations for config and state
  let config = {
      adrRange: 100,
      pulseThreshold: 0.5,
      pulseScale: 5,
      maxMarkerDecay: 10,
      flashThreshold: 2,
      adrProximityThreshold: 10,
      frequencyMode: 'normal',
      priceBucketSize: 0.5,
      showMaxMarker: true, // Set to true to see the marker
      showVolatilityOrb: false,
      volatilityColorMode: 'intensity',
      volatilityOrbBaseWidth: 70,
      volatilityOrbInvertBrightness: false,
      showMarketProfile: false,
      showFlash: false,
      flashIntensity: 0.3,
      showOrbFlash: false,
      orbFlashThreshold: 2,
      orbFlashIntensity: 0.8,
      distributionDepthMode: 'all',
      distributionPercentage: 50,
      marketProfileView: 'outline',
      priceFontSize: 50,
      priceFontWeight: '600',
      priceHorizontalOffset: 14,
      priceFloatWidth: 50,
      priceFloatXOffset: 20,
      bigFigureFontSizeRatio: 1.2,
      pipFontSizeRatio: 1.1,
      pipetteFontSizeRatio: 0.8,
      showPriceBoundingBox: false,
      showPriceBackground: false,
      priceDisplayPadding: 4,
      visualizationsContentWidth: 220,
      centralAxisXPosition: 170,
      meterHeight: 120,
      centralMeterFixedThickness: 8,
      showPipetteDigit: false,
      showSingleSidedProfile: false,
      singleSidedProfileSide: 'right',
  };

  let frequencySettings = {
      calm: {
          baseInterval: 2000,
          randomness: 1500,
          magnitudeMultiplier: 0.5,
          momentumStrength: 0.05,
          meanReversionPoint: 0.7
      },
      normal: {
          baseInterval: 800,
          randomness: 1000,
          magnitudeMultiplier: 1,
          momentumStrength: 0.1,
          meanReversionPoint: 0.7
      },
      active: {
          baseInterval: 300,
          randomness: 400,
          magnitudeMultiplier: 1.5,
          momentumStrength: 0.15,
          meanReversionPoint: 0.6
      },
      volatile: {
          baseInterval: 100,
          randomness: 200,
          magnitudeMultiplier: 2,
          momentumStrength: 0.2,
          meanReversionPoint: 0.5
      },
  };

  let state = {
      currentPrice: 1.25500,
      midPrice: 1.25500,
      lastTickTime: 0,
      ticks: [],
      allTicks: [],
      maxDeflection: { up: 0, down: 0, lastUpdateTime: 0 },
      minObservedPrice: Infinity,
      maxObservedPrice: -Infinity,
      pressure: { up: 0, down: 0 },
      volatility: 0,
      lastTickDirection: 0,
      momentum: 0,
      isOrbFlashing: false,
  };

  // Svelte reactivity for canvas dimensions and redrawing
  $: if (canvasElement && ctx) {
    canvasElement.width = config.visualizationsContentWidth;
    canvasElement.height = config.meterHeight;
    drawVisualization();
  }

  onMount(() => {
    if (canvasElement) {
      ctx = canvasElement.getContext('2d');
      // Initial draw, subsequent draws handled by reactivity
      drawVisualization();

      // Start the simulation loop
      requestAnimationFrame(gameLoop);
    } else {
        console.error("Canvas element not found in VizDisplay.svelte");
    }
  });

  // --- Helper to convert price to Y-coordinate on canvas ---
  function priceToY(price) {
    const effectiveADRInPrice = Math.max(config.adrRange / 10000, state.maxObservedPrice - state.minObservedPrice);
    const lowPrice = state.midPrice - (effectiveADRInPrice / 2);
    let percentage = (price - lowPrice) / effectiveADRInPrice;
    percentage = Math.max(0, Math.min(1, percentage));
    return (1 - percentage) * config.meterHeight; // Invert Y-axis for display (0 is top of meter)
  }

  // --- Main drawing function on Canvas ---
  function drawVisualization() {
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Draw background
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);

    // Draw central meter (dayRangeMeter)
    const meterWidth = config.centralMeterFixedThickness;
    const meterHeight = config.meterHeight;
    const meterX = config.centralAxisXPosition;
    const meterY = (canvasElement.height / 2) - (meterHeight / 2); // Center vertically on canvas

    ctx.fillStyle = '#374151';
    ctx.fillRect(meterX, meterY, meterWidth, meterHeight);

    // Draw ADR step markers
    [0.25, 0.5, 0.75].forEach(step => {
      const markerWidth = 16;
      const markerHeight = 2;
      const markerX = meterX + (meterWidth / 2) - (markerWidth / 2);
      const markerY = meterY + (1 - step) * meterHeight - (markerHeight / 2);
      ctx.fillStyle = '#a78bfa'; // Prev color from CSS
      ctx.fillRect(markerX, markerY, markerWidth, markerHeight);
    });

    // Draw ADR boundary lines
    const topADRY = meterY;
    const bottomADRY = meterY + meterHeight;

    ctx.strokeStyle = '#6b7280'; // Gray-500 from CSS
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, topADRY);
    ctx.lineTo(canvasElement.width, topADRY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, bottomADRY);
    ctx.lineTo(canvasElement.width, bottomADRY);
    ctx.stroke();

    // Draw priceFloat
    const priceFloatY = meterY + priceToY(state.currentPrice) - (config.meterHeight / 2); // Adjust Y based on meter's top offset
    const priceFloatX = meterX + (meterWidth / 2) - (config.priceFloatWidth / 2) + config.priceFloatXOffset;
    const priceColor = state.lastTickDirection > 0 ? '#22c55e' : (state.lastTickDirection < 0 ? '#ef4444' : '#a78bfa');

    ctx.fillStyle = priceColor;
    ctx.fillRect(priceFloatX, priceFloatY, config.priceFloatWidth, 2); // 2px height

    // Draw Max Deflection Marker
    drawMaxDeflection(priceFloatY, meterX, meterWidth);

    // Update price display DOM element
    if (priceDisplayElement) {
        // Calculate top position relative to visualizationContainer
        const containerRect = canvasElement.getBoundingClientRect();
        const floatAbsoluteY = containerRect.top + priceFloatY; // Y position on canvas + canvas absolute top

        priceDisplayElement.style.top = `${priceFloatY}px`;
        // Calculate left position for priceDisplayElement
        const priceFloatActualLeft = meterX + meterWidth / 2 - config.priceFloatWidth / 2 + config.priceFloatXOffset;
        // Ensure priceDisplayElement's width is known before setting left
        // This might require a small delay or using `await tick()` if its content changes reactively.
        priceDisplayElement.style.left = `${priceFloatActualLeft - config.priceHorizontalOffset - priceDisplayElement.offsetWidth}px`;

        const priceString = state.currentPrice.toFixed(5);
        const decimalIndex = priceString.indexOf('.');
        let formattedPrice = '';
        if (decimalIndex !== -1 && priceString.length >= decimalIndex + 5) {
            const bigFigure = priceString.substring(0, decimalIndex + 3);
            const pip = priceString.substring(decimalIndex + 3, decimalIndex + 5);
            const pipette = priceString.substring(decimalIndex + 5);

            formattedPrice = `
                <span class="big-figure">${bigFigure}</span><span class="pip">${pip}${config.showPipetteDigit ? `<span class="pipette-inner">${pipette}</span>` : ''}</span>
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

        if (config.showPriceBoundingBox || config.showPriceBackground) {
            priceDisplayElement.style.padding = `${config.priceDisplayPadding}px`;
        }

        if (config.showPriceBoundingBox) {
            priceDisplayElement.style.border = '1px solid #4b5563';
            priceDisplayElement.style.borderRadius = '4px';
        }

        if (config.showPriceBackground) {
            priceDisplayElement.style.backgroundColor = 'rgba(17, 24, 39, 0.7)';
        }

        // Update CSS custom properties for digit font sizes
        priceDisplayElement.style.setProperty('--big-figure-font-size-ratio', config.bigFigureFontSizeRatio);
        priceDisplayElement.style.setProperty('--pip-font-size-ratio', config.pipFontSizeRatio);
        priceDisplayElement.style.setProperty('--pipette-font-size-ratio', config.pipetteFontSizeRatio);
    }
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

  // --- TICK SIMULATOR (Adapted) ---
  function generateTick() {
    const now = performance.now();
    const settings = frequencySettings[config.frequencyMode];

    if (now - state.lastTickTime < (settings.baseInterval + (Math.random() * settings.randomness))) return;

    state.momentum = (state.momentum || 0) * 0.85;
    let bias = state.momentum * settings.momentumStrength;
    if (Math.abs(state.momentum) > settings.meanReversionPoint) {
        bias *= -0.5;
    }
    
    const direction = Math.random() < (0.5 + bias) ? 1 : -1;
    state.momentum = Math.max(-1, Math.min(1, state.momentum + direction * 0.25));

    const rand = Math.random();
    let magnitude = (rand < 0.8) ? Math.random() * 0.8 : (rand < 0.98) ? 0.8 + Math.random() * 2 : 3 + Math.random() * 5;
    magnitude *= settings.magnitudeMultiplier;

    const newPrice = state.currentPrice + (direction * magnitude / 10000);
    
    // Update state reactively. Svelte will re-render if `state` object reference changes,
    // or if properties on it are directly assigned.
    state = { ...state,
      currentPrice: newPrice,
      lastTickTime: now,
      lastTickDirection: direction,
      ticks: [...state.ticks, { magnitude, direction, price: newPrice, time: now }],
      allTicks: [...state.allTicks, { magnitude, direction, price: newPrice, time: now }],
      minObservedPrice: Math.min(state.minObservedPrice, newPrice),
      maxObservedPrice: Math.max(state.maxObservedPrice, newPrice),
    };

    processTick({ magnitude, direction, price: newPrice }); // Pass the current tick to processTick
  }

  // --- TICK PROCESSING & UI UPDATES (Adapted) ---
  function processTick(tick) {
    // Filter old ticks
    const now = performance.now();
    state.ticks = state.ticks.filter(t => now - t.time < 5000);

    // Update midPrice based on current price for dynamic ADR centering
    const effectiveADRInPrice = Math.max(config.adrRange / 10000, state.maxObservedPrice - state.minObservedPrice);
    const currentPriceOffsetFromMid = state.currentPrice - state.midPrice;
    const halfEffectiveADR = effectiveADRInPrice / 2;

    if (currentPriceOffsetFromMid > halfEffectiveADR) {
        state.midPrice = state.currentPrice - halfEffectiveADR;
    } else if (currentPriceOffsetFromMid < -halfEffectiveADR) {
        state.midPrice = state.currentPrice + halfEffectiveADR;
    }

    // Call updateMaxDeflection here
    updateMaxDeflection(tick);

    // For elements drawn on canvas, just updating state is enough for reactive redraw
    // For priceDisplayElement, update its content and styles after `state.currentPrice` is set.
  }

  /**
     * Updates the maximum deflection (highest/lowest price reached by a significant tick).
     */
    function updateMaxDeflection(tick) {
        const now = performance.now();

        // Reset if decay time exceeded for current max deflection
        if (now - state.maxDeflection.lastUpdateTime > (config.maxMarkerDecay * 1000)) { // Convert to milliseconds
            state.maxDeflection.up = 0;
            state.maxDeflection.down = 0;
        }

        let updated = false;
        if (tick.direction > 0 && tick.magnitude > state.maxDeflection.up) {
          state.maxDeflection.up = tick.magnitude;
          updated = true;
        }
        if (tick.direction < 0 && tick.magnitude > state.maxDeflection.down) {
          state.maxDeflection.down = tick.magnitude;
          updated = true;
        }

        if (updated) {
          // Create a new object to ensure reactivity
          state = { ...state, maxDeflection: { ...state.maxDeflection, lastUpdateTime: now } };
        }
    }

  // --- MAIN ANIMATION LOOP (Adapted) ---
  function gameLoop() {
      generateTick();
      updateVolatility(); // Calculates volatility and updates state.volatility
      drawVisualization(); // Redraws everything on canvas based on latest state

      // Request next frame
      requestAnimationFrame(gameLoop);
  }

    /**
     * Updates the calculated volatility based on recent tick magnitudes and frequency.
     */
    function updateVolatility() {
        const lookback = 5000;
        const now = performance.now();
        // Filter state.ticks in place or create new array to update reactively
        const filteredTicks = state.ticks.filter(t => now - t.time < lookback);
        // Ensure reactivity by creating new array reference if ticks changed
        if (filteredTicks.length !== state.ticks.length) {
            state = { ...state, ticks: filteredTicks };
        }

        if (state.ticks.length < 5) { state.volatility *= 0.99; return; }
        
        const magnitudes = state.ticks.map(t => t.magnitude);
        const avgMagnitude = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
        const frequency = state.ticks.length / (lookback / 1000);
        
        const volScore = (avgMagnitude * 0.5) + (frequency * 0.5);
        state = { ...state, volatility: state.volatility * 0.95 + volScore * 0.05 }; // Update state.volatility reactively
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
