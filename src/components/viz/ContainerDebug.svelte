<script>
  import { onMount } from 'svelte';
  import { scaleLinear } from 'd3-scale';
  import { drawDayRangeMeter } from '../../lib/viz/dayRangeMeter.js';
  import { drawPriceFloat } from '../../lib/viz/priceFloat.js';
  import { drawPriceDisplay } from '../../lib/viz/priceDisplay.js';
  import { drawMarketProfile } from '../../lib/viz/marketProfile.js';
  import { drawVolatilityMetric } from '../../lib/viz/volatilityMetric.js';
    import { drawPriceMarkers } from '../../lib/viz/priceMarkers.js';
  import { markerStore } from '../../stores/markerStore.js';
  import { writable } from 'svelte/store';

    export let config;
  export let state;

  let canvas;
  let ctx;
  let dpr = 1;
  let y; // Y scale

  let markers = [];
  let flashOpacity = 0;
  let flashDuration = 300;
  let flashStartTime = 0;

  // Debug state tracking
  let debugInfo = {
    canvasElement: false,
    canvasContext: false,
    canvasDimensions: { width: 0, height: 0 },
    canvasStyle: { width: 0, height: 0, display: '', visibility: '', position: '', zIndex: '' },
    domPosition: { x: 0, y: 0, visible: false },
    renderCount: 0,
    lastRenderTime: 0,
    visualizationCalls: {
      marketProfile: false,
      dayRangeMeter: false,
      priceFloat: false,
      priceDisplay: false,
      volatilityMetric: false,
      priceMarkers: false
    }
  };

  onMount(() => {
    console.log('🔍 CONTAINER_DEBUG: onMount called');
    
    if (canvas) {
      console.log('🔍 CONTAINER_DEBUG: Canvas element found', canvas);
      debugInfo.canvasElement = true;
      
      ctx = canvas.getContext('2d');
      if (ctx) {
        console.log('🔍 CONTAINER_DEBUG: Canvas context established', ctx);
        debugInfo.canvasContext = true;
      } else {
        console.error('🔍 CONTAINER_DEBUG: Failed to get canvas context');
      }
      
      dpr = window.devicePixelRatio || 1;
      console.log('🔍 CONTAINER_DEBUG: Device pixel ratio', dpr);
      
      // Check canvas dimensions
      debugInfo.canvasDimensions = {
        width: canvas.width,
        height: canvas.height
      };
      
      // Check canvas style
      const computedStyle = window.getComputedStyle(canvas);
      debugInfo.canvasStyle = {
        width: computedStyle.width,
        height: computedStyle.height,
        display: computedStyle.display,
        visibility: computedStyle.visibility,
        position: computedStyle.position,
        zIndex: computedStyle.zIndex
      };
      
      // Check DOM position
      const rect = canvas.getBoundingClientRect();
      debugInfo.domPosition = {
        x: rect.left,
        y: rect.top,
        visible: rect.width > 0 && rect.height > 0
      };
      
      console.log('🔍 CONTAINER_DEBUG: Initial debug info', debugInfo);
      
      // Draw a test rectangle to verify canvas works
      drawTestRectangle();
    } else {
      console.error('🔍 CONTAINER_DEBUG: Canvas element not found');
    }
  });

  // This reactive block handles resizing the canvas when config changes
  $: if (canvas && config) {
    console.log('🔍 CONTAINER_DEBUG: Config changed, resizing canvas', config);
    const { visualizationsContentWidth, meterHeight } = config;
    canvas.style.height = `${meterHeight}px`;
    canvas.width = Math.floor(visualizationsContentWidth * dpr);
    canvas.height = Math.floor(meterHeight * dpr);
    ctx?.scale(dpr, dpr);
    
    // Update debug info
    debugInfo.canvasDimensions = {
      width: canvas.width,
      height: canvas.height
    };
    
    console.log('🔍 CONTAINER_DEBUG: Canvas resized', debugInfo.canvasDimensions);
  }

  // This reactive block triggers a redraw whenever the core data changes
  $: if (ctx && state && config && $markerStore !== undefined) {
    console.log('🔍 CONTAINER_DEBUG: Triggering redraw', {
      hasCtx: !!ctx,
      hasState: !!state,
      hasConfig: !!config,
      stateReady: state?.ready,
      markerStore: $markerStore
    });

    markers = $markerStore;
    draw(state, config, markers);
  }

  function drawTestRectangle() {
    if (!ctx || !canvas) {
      console.error('🔍 CONTAINER_DEBUG: Cannot draw test rectangle - no ctx or canvas');
      return;
    }
    
    console.log('🔍 CONTAINER_DEBUG: Drawing test rectangle');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw bright red rectangle that should be visible
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(10, 10, 50, 50);
    
    // Draw text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '12px Arial';
    ctx.fillText('TEST', 15, 35);
    
    console.log('🔍 CONTAINER_DEBUG: Test rectangle drawn');
  }

  function handleMouseMove(event) {
    if (!y) return;

    console.log('🔍 CONTAINER_DEBUG: handleMouseMove called');
    const rect = canvas.getBoundingClientRect();
    const cssY = event.clientY - rect.top;
    const calculatedPrice = y.invert(cssY);
  }

  function handleMouseLeave() {
    console.log('🔍 CONTAINER_DEBUG: handleMouseLeave called');
  }

  function handleClick(event) {
    console.log('🔍 CONTAINER_DEBUG: handleClick called');
    if (!y) return;

    const rect = canvas.getBoundingClientRect();
    const cssY = event.clientY - rect.top;
    const hitThreshold = 5;

    const clickedMarker = $markerStore.find(marker => {
      const markerY = y(marker.price);
      console.log('Hit detection: markerY =', markerY, ', cssY =', cssY, ', difference =', Math.abs(cssY - markerY));
      return Math.abs(cssY - markerY) < hitThreshold;
    });

    console.log('Clicked marker result:', clickedMarker);

    if (clickedMarker) {
      console.log('Removing marker:', clickedMarker.id);
      markerStore.remove(clickedMarker.id);
    } else {
      const clickedPrice = y.invert(cssY);
      console.log('Adding marker:', clickedPrice);
      markerStore.add(clickedPrice);      
    }
  }

  function draw(currentState, currentConfig, currentMarkers) {
    if (!ctx || !currentState || !currentConfig) {
      console.error('🔍 CONTAINER_DEBUG: Draw called with missing parameters', {
        hasCtx: !!ctx,
        hasState: !!currentState,
        hasConfig: !!currentConfig
      });
      return;
    }

    console.log('🔍 CONTAINER_DEBUG: Starting draw function');
    debugInfo.renderCount++;
    debugInfo.lastRenderTime = Date.now();
    
    // Reset visualization call tracking
    Object.keys(debugInfo.visualizationCalls).forEach(key => {
      debugInfo.visualizationCalls[key] = false;
    });

    const { visualizationsContentWidth, meterHeight } = currentConfig;
    
    // Initialize/update the y-scale for the current render frame
    y = scaleLinear().domain([currentState.visualLow, currentState.visualHigh]).range([meterHeight, 0]);
    
    console.log('🔍 CONTAINER_DEBUG: Y-scale created', {
      domain: [currentState.visualLow, currentState.visualHigh],
      range: [meterHeight, 0]
    });
    
    // Clear canvas
    ctx.clearRect(0, 0, visualizationsContentWidth, meterHeight);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, visualizationsContentWidth, meterHeight);

    // Draw a test rectangle first to verify canvas is working
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(5, 5, 20, 20);
    console.log('🔍 CONTAINER_DEBUG: Green test rectangle drawn');

    try {
      // Draw Core Visualizations with error tracking
      console.log('🔍 CONTAINER_DEBUG: Drawing market profile');
      drawMarketProfile(ctx, currentConfig, currentState, y);
      debugInfo.visualizationCalls.marketProfile = true;
      
      console.log('🔍 CONTAINER_DEBUG: Drawing day range meter');
      drawDayRangeMeter(ctx, currentConfig, currentState, y);
      debugInfo.visualizationCalls.dayRangeMeter = true;
      
      console.log('🔍 CONTAINER_DEBUG: Drawing price float');
      drawPriceFloat(ctx, currentConfig, currentState, y);
      debugInfo.visualizationCalls.priceFloat = true;
      
      console.log('🔍 CONTAINER_DEBUG: Drawing price display');
      drawPriceDisplay(ctx, currentConfig, currentState, y, visualizationsContentWidth);
      debugInfo.visualizationCalls.priceDisplay = true;
      
      console.log('🔍 CONTAINER_DEBUG: Drawing volatility metric');
      drawVolatilityMetric(ctx, currentConfig, currentState, visualizationsContentWidth, meterHeight);
      debugInfo.visualizationCalls.volatilityMetric = true;

      // Draw Price Markers
      console.log('🔍 CONTAINER_DEBUG: Drawing price markers');
      drawPriceMarkers(ctx, currentConfig, currentState, y, currentMarkers);
      debugInfo.visualizationCalls.priceMarkers = true;
      
      
      console.log('🔍 CONTAINER_DEBUG: All visualizations drawn successfully', debugInfo.visualizationCalls);
    } catch (error) {
      console.error('🔍 CONTAINER_DEBUG: Error during visualization drawing', error);
    }

    // Draw Flash Overlay
    if (flashOpacity > 0) {
      const elapsedTime = performance.now() - flashStartTime;
      const newOpacity = currentConfig.flashIntensity * (1 - (elapsedTime / flashDuration));
      
      flashOpacity = Math.max(0, newOpacity);
      
      if (flashOpacity > 0) {
        ctx.fillStyle = `rgba(200, 200, 220, ${flashOpacity})`;
        ctx.fillRect(0, 0, visualizationsContentWidth, meterHeight);
      }
    }

    console.log('🔍 CONTAINER_DEBUG: Draw function completed', {
      renderCount: debugInfo.renderCount,
      canvasDimensions: debugInfo.canvasDimensions,
      visualizationCalls: debugInfo.visualizationCalls
    });
  }
</script>

<div class="viz-container" style="width: {config.visualizationsContentWidth}px;">
  <!-- Debug Panel -->
  <div class="debug-panel" style="position: absolute; top: 5px; left: 5px; background: rgba(0,0,0,0.8); color: white; padding: 5px; border-radius: 3px; font-size: 10px; z-index: 1000;">
    <div>Canvas: {debugInfo.canvasElement ? '✅' : '❌'}</div>
    <div>Context: {debugInfo.canvasContext ? '✅' : '❌'}</div>
    <div>Dimensions: {debugInfo.canvasDimensions.width}x{debugInfo.canvasDimensions.height}</div>
    <div>Style: {debugInfo.canvasStyle.width} x {debugInfo.canvasStyle.height}</div>
    <div>Display: {debugInfo.canvasStyle.display}</div>
    <div>Visible: {debugInfo.domPosition.visible ? '✅' : '❌'}</div>
    <div>Renders: {debugInfo.renderCount}</div>
    <div>State Ready: {state?.ready ? '✅' : '❌'}</div>
  </div>
  
  <canvas bind:this={canvas} on:mousemove={handleMouseMove} on:mouseleave={handleMouseLeave} on:click={handleClick}></canvas>
</div>

<style>
  .viz-container {
    position: relative;
    height: 100%;
    line-height: 0;
  }
  canvas {
    display: block;
    background-color: #111827;
    width: 100%;
    border: 2px solid #FF0000; /* Red border to make canvas visible */
  }
  .debug-panel {
    pointer-events: none; /* Allow mouse events to pass through to canvas */
  }
</style>