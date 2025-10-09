<script>
  import { onMount, onDestroy } from 'svelte';
  
  // Component props
  export let currentPrice = 0;
  export let adrHigh = 0;
  export let adrLow = 0;
  export let adrRange = 0;
  export let width = 100;
  export let height = 200;
  export let showPulse = true;
  export let proximityThreshold = 10; // Percentage threshold for pulse effect
  export let lineColor = 'var(--color-primary, #3b82f6)';
  export let pulseColor = 'var(--color-focus, #a78bfa)';
  export let lineWidth = 2;
  export let animated = true;
  export let showLabels = true;
  export let showBoundaries = true;
  export let boundaryStyle = 'solid'; // 'solid', 'dashed', 'dotted'
  
  // Canvas and context
  let canvas;
  let ctx;
  let animationFrame;
  let pulsePhase = 0;
  
  // Calculated values
  $: priceRange = adrHigh - adrLow || 1;
  $: pricePosition = priceRange > 0 ? ((currentPrice - adrLow) / priceRange) * 100 : 50;
  $: isNearHigh = priceRange > 0 ? ((adrHigh - currentPrice) / priceRange) * 100 <= proximityThreshold : false;
  $: isNearLow = priceRange > 0 ? ((currentPrice - adrLow) / priceRange) * 100 <= proximityThreshold : false;
  $: shouldPulse = showPulse && (isNearHigh || isNearLow);
  $: pulseIntensity = calculatePulseIntensity();
  
  function calculatePulseIntensity() {
    if (!shouldPulse) return 0;
    
    if (isNearHigh) {
      const distance = ((adrHigh - currentPrice) / priceRange) * 100;
      return Math.max(0, 1 - (distance / proximityThreshold));
    } else if (isNearLow) {
      const distance = ((currentPrice - adrLow) / priceRange) * 100;
      return Math.max(0, 1 - (distance / proximityThreshold));
    }
    
    return 0;
  }
  
  // Animation loop
  function animate(timestamp) {
    if (!ctx || !canvas) return;
    
    // Update pulse phase
    if (shouldPulse) {
      pulsePhase += 0.1;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw ADR axis
    drawAxis();
    
    // Draw boundary lines
    if (showBoundaries) {
      drawBoundaries();
    }
    
    // Draw current price line
    drawPriceLine();
    
    // Draw pulse effect if needed
    if (shouldPulse) {
      drawPulse();
    }
    
    // Draw labels if enabled
    if (showLabels) {
      drawLabels();
    }
    
    // Continue animation
    if (animated) {
      animationFrame = requestAnimationFrame(animate);
    }
  }
  
  function drawAxis() {
    const centerX = width / 2;
    
    // Draw main vertical axis
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.stroke();
    
    // Draw axis caps
    ctx.beginPath();
    ctx.moveTo(centerX - 5, 0);
    ctx.lineTo(centerX + 5, 0);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(centerX - 5, height);
    ctx.lineTo(centerX + 5, height);
    ctx.stroke();
  }
  
  function drawBoundaries() {
    const centerX = width / 2;
    
    // Set boundary line style
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    
    // Apply boundary style
    if (boundaryStyle === 'dashed') {
      ctx.setLineDash([5, 5]);
    } else if (boundaryStyle === 'dotted') {
      ctx.setLineDash([2, 3]);
    } else {
      ctx.setLineDash([]);
    }
    
    // Draw high boundary
    const highY = height * 0.1; // 10% from top
    ctx.beginPath();
    ctx.moveTo(centerX - 15, highY);
    ctx.lineTo(centerX + 15, highY);
    ctx.stroke();
    
    // Draw low boundary
    const lowY = height * 0.9; // 10% from bottom
    ctx.beginPath();
    ctx.moveTo(centerX - 15, lowY);
    ctx.lineTo(centerX + 15, lowY);
    ctx.stroke();
    
    // Reset line dash
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  
  function drawPriceLine() {
    const centerX = width / 2;
    const priceY = height * (1 - pricePosition / 100);
    
    // Draw price line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(centerX - 20, priceY);
    ctx.lineTo(centerX + 20, priceY);
    ctx.stroke();
    
    // Draw price indicator circle
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(centerX, priceY, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  
  function drawPulse() {
    const centerX = width / 2;
    const priceY = height * (1 - pricePosition / 100);
    
    // Calculate pulse size based on intensity and phase
    const basePulseSize = 8;
    const pulseSize = basePulseSize + Math.sin(pulsePhase) * 4 * pulseIntensity;
    
    // Draw pulse glow
    const gradient = ctx.createRadialGradient(centerX, priceY, 0, centerX, priceY, pulseSize);
    gradient.addColorStop(0, `${pulseColor}40`);
    gradient.addColorStop(0.5, `${pulseColor}20`);
    gradient.addColorStop(1, `${pulseColor}00`);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, priceY, pulseSize * 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw pulse ring
    ctx.strokeStyle = pulseColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = pulseIntensity;
    ctx.beginPath();
    ctx.arc(centerX, priceY, pulseSize, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  
  function drawLabels() {
    ctx.font = '10px var(--font-mono, monospace)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#9ca3af';
    
    // Draw high label
    const highY = height * 0.1;
    ctx.fillText(`H: ${adrHigh.toFixed(5)}`, width + 5, highY);
    
    // Draw low label
    const lowY = height * 0.9;
    ctx.fillText(`L: ${adrLow.toFixed(5)}`, width + 5, lowY);
    
    // Draw current price label
    const priceY = height * (1 - pricePosition / 100);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px var(--font-mono, monospace)';
    ctx.fillText(currentPrice.toFixed(5), width + 5, priceY);
    
    // Draw proximity indicator
    if (shouldPulse) {
      ctx.fillStyle = pulseColor;
      ctx.font = '9px var(--font-sans, sans-serif)';
      const indicatorText = isNearHigh ? 'NEAR HIGH' : 'NEAR LOW';
      ctx.fillText(indicatorText, width + 5, priceY + 15);
    }
  }
  
  // Initialize canvas
  onMount(() => {
    if (canvas) {
      ctx = canvas.getContext('2d');
      canvas.width = width;
      canvas.height = height;
      
      // Enable smooth rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      if (animated) {
        animate();
      } else {
        // Static render
        drawAxis();
        if (showBoundaries) {
          drawBoundaries();
        }
        drawPriceLine();
        if (shouldPulse) {
          drawPulse();
        }
        if (showLabels) {
          drawLabels();
        }
      }
    }
  });
  
  // Update canvas when size changes
  $: if (canvas) {
    canvas.width = width;
    canvas.height = height;
    if (!animated) {
      drawAxis();
      if (showBoundaries) {
        drawBoundaries();
      }
      drawPriceLine();
      if (shouldPulse) {
        drawPulse();
      }
      if (showLabels) {
        drawLabels();
      }
    }
  }
  
  // Cleanup
  onDestroy(() => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
  });
  
  // Accessibility
  $: ariaLabel = `ADR Axis: Current price ${currentPrice.toFixed(5)}, High ${adrHigh.toFixed(5)}, Low ${adrLow.toFixed(5)}${shouldPulse ? (isNearHigh ? ' (near high boundary)' : ' (near low boundary)') : ''}`;
</script>

<div class="adr-axis-container">
  <canvas 
    bind:this={canvas}
    class="adr-axis-canvas"
    width={width}
    height={height}
    role="img"
    aria-label={ariaLabel}
  />
</div>

<style>
  .adr-axis-container {
    position: relative;
    display: inline-block;
  }
  
  .adr-axis-canvas {
    display: block;
    border-radius: 2px;
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .adr-axis-canvas {
      border: 1px solid currentColor;
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .adr-axis-container {
      animation: none !important;
    }
  }
  
  /* Print styles */
  @media print {
    .adr-axis-canvas {
      filter: contrast(1.2) !important;
    }
  }
</style>
