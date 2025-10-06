<script>
  import { onMount, onDestroy } from 'svelte';
  
  // Component props
  export let price = 0;
  export let position = 50; // Percentage position in canvas (0-100)
  export let width = 100;
  export let height = 4;
  export let color = 'var(--color-price-float, #a78bfa)';
  export let glow = true;
  export let directional = false;
  export let previousPrice = 0;
  export let animated = true;
  export let showLabel = false;
  export let labelPosition = 'right'; // 'left', 'right', 'top', 'bottom'
  
  // Internal state
  let currentPosition = position;
  let currentColor = color;
  let element;
  let animationFrame;
  
  // Reactive calculations
  $: priceChange = price - previousPrice;
  $: isUp = priceChange > 0;
  $: isDown = priceChange < 0;
  $: priceDisplay = price.toFixed(5);
  
  // Calculate directional color
  $: directionalColor = directional 
    ? (isUp ? 'var(--color-bullish, #10b981)' : isDown ? 'var(--color-bearish, #ef4444)' : color)
    : color;
  
  // Smooth transitions for position changes
  $: if (animated && element) {
    animateToPosition(position);
  } else {
    currentPosition = position;
  }
  
  // Update color based on direction
  $: if (directional) {
    currentColor = directionalColor;
  } else {
    currentColor = color;
  }
  
  function animateToPosition(targetPosition) {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    
    const startPosition = currentPosition;
    const distance = targetPosition - startPosition;
    const duration = 300; // ms
    const startTime = performance.now();
    
    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out-cubic)
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      currentPosition = startPosition + (distance * easeProgress);
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        currentPosition = targetPosition;
      }
    }
    
    animationFrame = requestAnimationFrame(animate);
  }
  
  // Generate CSS styles
  $: elementStyle = `
    left: 50%;
    top: ${currentPosition}%;
    width: ${width}px;
    height: ${height}px;
    background-color: ${currentColor};
    transform: translateX(-50%);
    ${glow ? `box-shadow: 0 0 12px ${currentColor}40;` : ''}
    ${animated ? 'transition: background-color 0.2s ease;' : ''}
  `;
  
  $: labelStyle = `
    ${labelPosition === 'left' ? `right: ${width + 8}px;` : ''}
    ${labelPosition === 'right' ? `left: ${width + 8}px;` : ''}
    ${labelPosition === 'top' ? `bottom: ${height + 4}px;` : ''}
    ${labelPosition === 'bottom' ? `top: ${height + 4}px;` : ''}
    color: ${currentColor};
  `;
  
  // Cleanup animations
  onDestroy(() => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
  });
  
  // Accessibility
  $: ariaLabel = `Price: ${priceDisplay}${directional ? (isUp ? ' (up)' : isDown ? ' (down)' : '') : ''}`;
</script>

<div 
  class="price-float"
  style={elementStyle}
  bind:this={element}
  role="img"
  aria-label={ariaLabel}
  class:glow
  class:directional
  class:up={directional && isUp}
  class:down={directional && isDown}
>
  {#if showLabel}
    <div class="price-label" style={labelStyle}>
      {priceDisplay}
      {#if directional}
        <span class="direction-indicator" class:up={isUp} class:down={isDown}>
          {isUp ? '▲' : isDown ? '▼' : '●'}
        </span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .price-float {
    position: absolute;
    z-index: 3;
    border-radius: 2px;
    will-change: transform, background-color;
  }
  
  .price-float.glow {
    filter: brightness(1.1);
  }
  
  .price-float.directional.up {
    background-color: var(--color-bullish, #10b981);
    box-shadow: 0 0 12px var(--color-bullish, #10b981)40;
  }
  
  .price-float.directional.down {
    background-color: var(--color-bearish, #ef4444);
    box-shadow: 0 0 12px var(--color-bearish, #ef4444)40;
  }
  
  .price-label {
    position: absolute;
    font-family: var(--font-mono, 'Roboto Mono', monospace);
    font-size: var(--text-xs, 0.75rem);
    font-weight: var(--font-medium, 500);
    white-space: nowrap;
    pointer-events: none;
    display: flex;
    align-items: center;
    gap: 2px;
  }
  
  .direction-indicator {
    font-size: 0.6em;
    opacity: 0.8;
  }
  
  .direction-indicator.up {
    color: var(--color-bullish, #10b981);
  }
  
  .direction-indicator.down {
    color: var(--color-bearish, #ef4444);
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .price-float {
      border: 1px solid currentColor;
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .price-float {
      transition: none !important;
    }
  }
  
  /* Print styles */
  @media print {
    .price-float {
      background-color: black !important;
      box-shadow: none !important;
    }
    
    .price-label {
      color: black !important;
    }
  }
</style>
