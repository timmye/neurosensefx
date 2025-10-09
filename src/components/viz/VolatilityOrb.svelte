<script>
  import { onMount, onDestroy } from 'svelte';
  
  // Component props
  export let volatility = 0; // Volatility value (0-1 or higher)
  export let baseWidth = 200;
  export let colorMode = 'intensity'; // 'intensity', 'directional', 'single'
  export let showMetric = true;
  export let metricPosition = 'center'; // 'center', 'top', 'bottom'
  export let animated = true;
  export let pulseAnimation = true;
  export let direction = 'neutral'; // 'up', 'down', 'neutral'
  export let singleColor = 'var(--color-price-float, #a78bfa)';
  export let maxVolatility = 1.0;
  export let minSize = 20;
  export let sensitivity = 1.0;
  
  // Canvas and context
  let canvas;
  let ctx;
  let animationFrame;
  let currentSize = minSize;
  let targetSize = minSize;
  let pulsePhase = 0;
  
  // Calculated values
  $: normalizedVolatility = Math.min(Math.max(volatility / maxVolatility, 0), 1);
  $: orbSize = minSize + (baseWidth - minSize) * normalizedVolatility * sensitivity;
  $: displayMetric = (volatility * 100).toFixed(1);
  
  // Color calculation based on mode
  $: orbColor = calculateColor();
  
  function calculateColor() {
    switch (colorMode) {
      case 'intensity':
        // Color gradient from blue (low) to red (high)
        const intensity = normalizedVolatility;
        const r = Math.floor(255 * intensity);
        const g = Math.floor(100 * (1 - intensity));
        const b = Math.floor(255 * (1 - intensity));
        return `rgb(${r}, ${g}, ${b})`;
      
      case 'directional':
        if (direction === 'up') {
          return 'var(--color-bullish, #10b981)';
        } else if (direction === 'down') {
          return 'var(--color-bearish, #ef4444)';
        } else {
          return 'var(--color-neutral, #6b7280)';
        }
      
      case 'single':
      default:
        return singleColor;
    }
  }
  
  // Animation loop
  function animate(timestamp) {
    if (!ctx || !canvas) return;
    
    // Smooth size transitions
    const sizeDiff = targetSize - currentSize;
    currentSize += sizeDiff * 0.1; // Smooth easing
    
    // Pulse animation
    if (pulseAnimation) {
      pulsePhase += 0.05;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw orb
    drawOrb(timestamp);
    
    // Draw metric if enabled
    if (showMetric) {
      drawMetric();
    }
    
    // Continue animation
    if (animated) {
      animationFrame = requestAnimationFrame(animate);
    }
  }
  
  function drawOrb(timestamp) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Calculate pulse effect
    const pulseAmount = pulseAnimation ? Math.sin(pulsePhase) * 2 : 0;
    const actualSize = currentSize + pulseAmount;
    
    // Draw outer glow
    if (normalizedVolatility > 0.1) {
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, actualSize);
      const baseColor = orbColor;
      
      // Parse RGB values for gradient
      const rgbMatch = baseColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgbMatch) {
        const [, r, g, b] = rgbMatch;
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.3)`);
        gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.1)`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      } else {
        // Fallback for CSS variables
        gradient.addColorStop(0, `${orbColor}40`);
        gradient.addColorStop(0.7, `${orbColor}20`);
        gradient.addColorStop(1, `${orbColor}00`);
      }
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, actualSize * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw main orb
    const mainGradient = ctx.createRadialGradient(
      centerX - actualSize * 0.3, 
      centerY - actualSize * 0.3, 
      0,
      centerX, 
      centerY, 
      actualSize
    );
    
    mainGradient.addColorStop(0, `${orbColor}ff`);
    mainGradient.addColorStop(0.7, `${orbColor}cc`);
    mainGradient.addColorStop(1, `${orbColor}88`);
    
    ctx.fillStyle = mainGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, actualSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw inner highlight
    const highlightGradient = ctx.createRadialGradient(
      centerX - actualSize * 0.3,
      centerY - actualSize * 0.3,
      0,
      centerX - actualSize * 0.3,
      centerY - actualSize * 0.3,
      actualSize * 0.5
    );
    
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = highlightGradient;
    ctx.beginPath();
    ctx.arc(centerX - actualSize * 0.3, centerY - actualSize * 0.3, actualSize * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  
  function drawMetric() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Set text properties
    ctx.font = 'bold 14px var(--font-sans, system-ui, sans-serif)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    // Calculate text position
    let textY = centerY;
    if (metricPosition === 'top') {
      textY = centerY - currentSize * 0.5;
    } else if (metricPosition === 'bottom') {
      textY = centerY + currentSize * 0.5;
    }
    
    // Draw text
    ctx.fillText(`${displayMetric}%`, centerX, textY);
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  
  // Update target size when volatility changes
  $: targetSize = orbSize;
  
  // Initialize canvas
  onMount(() => {
    if (canvas) {
      ctx = canvas.getContext('2d');
      canvas.width = baseWidth;
      canvas.height = baseWidth;
      
      // Enable smooth rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      if (animated) {
        animate();
      } else {
        // Static render
        currentSize = targetSize;
        drawOrb();
        if (showMetric) {
          drawMetric();
        }
      }
    }
  });
  
  // Update canvas when size changes
  $: if (canvas) {
    canvas.width = baseWidth;
    canvas.height = baseWidth;
    if (!animated) {
      currentSize = targetSize;
      drawOrb();
      if (showMetric) {
        drawMetric();
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
  $: ariaLabel = `Volatility: ${displayMetric}%, ${colorMode === 'directional' ? `direction: ${direction}` : `intensity: ${(normalizedVolatility * 100).toFixed(0)}%`}`;
</script>

<div class="volatility-orb-container">
  <canvas 
    bind:this={canvas}
    class="volatility-orb-canvas"
    width={baseWidth}
    height={baseWidth}
    role="img"
    aria-label={ariaLabel}
  />
</div>

<style>
  .volatility-orb-container {
    position: relative;
    display: inline-block;
  }
  
  .volatility-orb-canvas {
    display: block;
    border-radius: 50%;
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .volatility-orb-canvas {
      border: 2px solid currentColor;
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .volatility-orb-container {
      animation: none !important;
    }
  }
  
  /* Print styles */
  @media print {
    .volatility-orb-canvas {
      filter: contrast(1.2) !important;
    }
  }
</style>
