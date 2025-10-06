<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  
  export let flashEnabled = true;
  export let flashThreshold = 0.5; // Price change threshold for flash
  export let flashIntensity = 0.8; // Flash intensity (0-1)
  export let flashDuration = 500; // Flash duration in ms
  export let flashColor = '#fbbf24'; // Flash color
  export let flashType = 'screen'; // 'screen', 'border', 'glow'
  
  const dispatch = createEventDispatcher();
  
  // Flash state
  let isFlashing = false;
  let flashProgress = 0;
  let lastPrice = 0;
  let animationFrame = null;
  let flashTimeout = null;
  
  // Price change detection
  export let currentPrice = 0;
  export let previousPrice = 0;
  
  // Calculate price change percentage
  $: priceChangePercent = (() => {
    if (!previousPrice || previousPrice === 0) return 0;
    return Math.abs((currentPrice - previousPrice) / previousPrice);
  })();
  
  // Determine if flash should trigger
  $: shouldFlash = (() => {
    return flashEnabled && 
           priceChangePercent >= flashThreshold && 
           !isFlashing &&
           currentPrice !== previousPrice;
  })();
  
  // Flash animation
  function startFlash() {
    if (!flashEnabled || isFlashing) return;
    
    isFlashing = true;
    flashProgress = 0;
    
    const startTime = Date.now();
    
    function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / flashDuration, 1);
      
      // Ease out quad for smooth fade
      const easeOutQuad = 1 - Math.pow(1 - progress, 2);
      flashProgress = easeOutQuad;
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        isFlashing = false;
        flashProgress = 0;
        dispatch('flashComplete', { 
          priceChange: priceChangePercent,
          flashType 
        });
      }
    }
    
    animate();
    
    // Auto-cleanup
    flashTimeout = setTimeout(() => {
      if (isFlashing) {
        isFlashing = false;
        flashProgress = 0;
      }
    }, flashDuration + 100);
  }
  
  // Watch for price changes
  $: if (shouldFlash) {
    startFlash();
  }
  
  // Update last price when current price changes
  $: if (currentPrice !== lastPrice) {
    previousPrice = lastPrice;
    lastPrice = currentPrice;
  }
  
  // Handle flash settings changes
  function handleFlashSettingsChange(settings) {
    if (settings.flashEnabled !== undefined) flashEnabled = settings.flashEnabled;
    if (settings.flashThreshold !== undefined) flashThreshold = settings.flashThreshold;
    if (settings.flashIntensity !== undefined) flashIntensity = settings.flashIntensity;
    if (settings.flashDuration !== undefined) flashDuration = settings.flashDuration;
    if (settings.flashColor !== undefined) flashColor = settings.flashColor;
    if (settings.flashType !== undefined) flashType = settings.flashType;
  }
  
  // Manual flash trigger
  function triggerFlash(options = {}) {
    const {
      intensity = flashIntensity,
      duration = flashDuration,
      color = flashColor,
      type = flashType
    } = options;
    
    flashIntensity = intensity;
    flashDuration = duration;
    flashColor = color;
    flashType = type;
    
    startFlash();
  }
  
  // Expose methods
  export { handleFlashSettingsChange, triggerFlash };
  
  // Cleanup
  onDestroy(() => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    if (flashTimeout) {
      clearTimeout(flashTimeout);
    }
  });
</script>

{#if isFlashing}
  <div class="market-flash-indicator" class:flashing={isFlashing} class:type-{flashType}>
    {#if flashType === 'screen'}
      <!-- Screen flash overlay -->
      <div 
        class="flash-overlay"
        style="
          opacity: {flashProgress * flashIntensity};
          background: {flashColor};
        "
      ></div>
    {/if}
    
    {#if flashType === 'border'}
      <!-- Border flash -->
      <div 
        class="flash-border"
        style="
          opacity: {flashProgress * flashIntensity};
          border-color: {flashColor};
          box-shadow: 0 0 {flashProgress * 30}px {flashColor};
        "
      ></div>
    {/if}
    
    {#if flashType === 'glow'}
      <!-- Glow flash -->
      <div 
        class="flash-glow"
        style="
          opacity: {flashProgress * flashIntensity};
          background: radial-gradient(circle, {flashColor}60 0%, transparent 70%);
        "
      ></div>
    {/if}
    
    <!-- Flash indicator -->
    {#if flashProgress > 0.3}
      <div 
        class="flash-indicator"
        style="
          opacity: {flashProgress};
          color: {flashColor};
        "
      >
        <div class="flash-icon">⚡</div>
        <div class="flash-text">
          Significant Move: {(priceChangePercent * 100).toFixed(2)}%
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .market-flash-indicator {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 20;
  }
  
  .flash-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    transition: opacity var(--motion-fast) var(--ease-snappy);
  }
  
  .flash-border {
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    border: 3px solid transparent;
    border-radius: var(--radius-md);
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .flash-glow {
    position: absolute;
    top: -20px;
    left: -20px;
    right: -20px;
    bottom: -20px;
    transition: opacity var(--motion-fast) var(--ease-snappy);
  }
  
  .flash-indicator {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-3) var(--space-4);
    background: var(--bg-elevated);
    border: 2px solid;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    font-size: var(--font-size-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    animation: flash-bounce 0.5s ease-out;
  }
  
  .flash-icon {
    font-size: var(--font-size-xl);
    animation: flash-icon-spin 0.5s ease-out;
  }
  
  .flash-text {
    white-space: nowrap;
    text-align: center;
  }
  
  @keyframes flash-bounce {
    0% {
      transform: translate(-50%, -50%) scale(0.8);
      opacity: 0;
    }
    50% {
      transform: translate(-50%, -50%) scale(1.1);
    }
    100% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
  }
  
  @keyframes flash-icon-spin {
    0% {
      transform: rotate(0deg) scale(0.5);
    }
    50% {
      transform: rotate(180deg) scale(1.2);
    }
    100% {
      transform: rotate(360deg) scale(1);
    }
  }
  
  /* Type-specific styles */
  .market-flash-indicator.type-screen {
    background: transparent;
  }
  
  .market-flash-indicator.type-border {
    background: transparent;
  }
  
  .market-flash-indicator.type-glow {
    background: transparent;
  }
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    .flash-border {
      border-width: 5px;
    }
    
    .flash-indicator {
      border-width: 3px;
    }
  }
  
  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .flash-overlay {
      transition: none;
    }
    
    .flash-border {
      transition: none;
    }
    
    .flash-glow {
      transition: none;
    }
    
    .flash-indicator {
      animation: none;
    }
    
    .flash-icon {
      animation: none;
    }
  }
  
  /* Mobile optimizations */
  @media (max-width: 768px) {
    .flash-indicator {
      padding: var(--space-2) var(--space-3);
      font-size: var(--font-size-xs);
    }
    
    .flash-icon {
      font-size: var(--font-size-lg);
    }
    
    .flash-glow {
      top: -10px;
      left: -10px;
      right: -10px;
      bottom: -10px;
    }
  }
</style>
