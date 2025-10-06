<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  
  export let currentPrice = 0;
  export let adrHigh = 0;
  export let adrLow = 0;
  export let pulseThreshold = 0.1; // 10% from ADR boundary
  export let pulseEnabled = true;
  export let pulseColor = '#3b82f6';
  export let pulseDuration = 1000; // ms
  
  const dispatch = createEventDispatcher();
  
  // Pulse state
  let isPulsing = false;
  let pulseIntensity = 0;
  let pulseDirection = 'none'; // 'upper', 'lower', 'none'
  let animationFrame = null;
  
  // Calculate proximity to ADR boundaries
  $: proximityToBoundary = (() => {
    if (!adrHigh || !adrLow || !currentPrice) return 1;
    
    const adrRange = adrHigh - adrLow;
    const upperThreshold = adrHigh - (adrRange * pulseThreshold);
    const lowerThreshold = adrLow + (adrRange * pulseThreshold);
    
    if (currentPrice >= upperThreshold) {
      const proximity = (currentPrice - upperThreshold) / (adrRange * pulseThreshold);
      return Math.min(proximity, 1);
    } else if (currentPrice <= lowerThreshold) {
      const proximity = (lowerThreshold - currentPrice) / (adrRange * pulseThreshold);
      return Math.min(proximity, 1);
    }
    
    return 0;
  })();
  
  // Determine pulse direction
  $: pulseDirection = (() => {
    if (!adrHigh || !adrLow || !currentPrice) return 'none';
    
    const adrRange = adrHigh - adrLow;
    const upperThreshold = adrHigh - (adrRange * pulseThreshold);
    const lowerThreshold = adrLow + (adrRange * pulseThreshold);
    
    if (currentPrice >= upperThreshold) return 'upper';
    if (currentPrice <= lowerThreshold) return 'lower';
    return 'none';
  })();
  
  // Pulse animation
  function startPulse() {
    if (!pulseEnabled || isPulsing) return;
    
    isPulsing = true;
    pulseIntensity = 0;
    
    const startTime = Date.now();
    
    function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / pulseDuration, 1);
      
      // Easing function for smooth pulse
      const easeOutQuad = 1 - Math.pow(1 - progress, 2);
      pulseIntensity = easeOutQuad;
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        isPulsing = false;
        pulseIntensity = 0;
        dispatch('pulseComplete', { direction: pulseDirection });
      }
    }
    
    animate();
  }
  
  // Watch for proximity changes
  $: if (proximityToBoundary > 0 && pulseEnabled && !isPulsing) {
    startPulse();
  }
  
  // Handle pulse settings changes
  function handlePulseSettingsChange(settings) {
    if (settings.pulseEnabled !== undefined) pulseEnabled = settings.pulseEnabled;
    if (settings.pulseThreshold !== undefined) pulseThreshold = settings.pulseThreshold;
    if (settings.pulseColor !== undefined) pulseColor = settings.pulseColor;
    if (settings.pulseDuration !== undefined) pulseDuration = settings.pulseDuration;
  }
  
  // Expose methods
  export { handlePulseSettingsChange, startPulse };
  
  // Cleanup
  onDestroy(() => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
  });
</script>

{#if pulseEnabled && proximityToBoundary > 0}
  <div class="adr-pulse-indicator" class:pulsing={isPulsing} class:direction-{pulseDirection}>
    <!-- Upper boundary pulse -->
    {#if pulseDirection === 'upper'}
      <div 
        class="pulse-line upper-boundary"
        style="
          opacity: {pulseIntensity * proximityToBoundary};
          background: {pulseColor};
          box-shadow: 0 0 {pulseIntensity * 20}px {pulseColor};
        "
      ></div>
    {/if}
    
    <!-- Lower boundary pulse -->
    {#if pulseDirection === 'lower'}
      <div 
        class="pulse-line lower-boundary"
        style="
          opacity: {pulseIntensity * proximityToBoundary};
          background: {pulseColor};
          box-shadow: 0 0 {pulseIntensity * 20}px {pulseColor};
        "
      ></div>
    {/if}
    
    <!-- Pulse glow effect -->
    {#if isPulsing}
      <div 
        class="pulse-glow"
        class:upper={pulseDirection === 'upper'}
        class:lower={pulseDirection === 'lower'}
        style="
          opacity: {pulseIntensity * 0.3};
          background: radial-gradient(circle, {pulseColor}40 0%, transparent 70%);
        "
      ></div>
    {/if}
    
    <!-- Proximity indicator -->
    {#if proximityToBoundary > 0.5}
      <div 
        class="proximity-warning"
        style="
          opacity: {proximityToBoundary};
          color: {pulseColor};
        "
      >
        <div class="warning-icon">⚠️</div>
        <div class="warning-text">
          {pulseDirection === 'upper' ? 'Near ADR High' : 'Near ADR Low'}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .adr-pulse-indicator {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 5;
  }
  
  .pulse-line {
    position: absolute;
    width: 100%;
    height: 2px;
    transition: opacity var(--motion-fast) var(--ease-snappy);
  }
  
  .pulse-line.upper-boundary {
    top: 0;
  }
  
  .pulse-line.lower-boundary {
    bottom: 0;
  }
  
  .pulse-glow {
    position: absolute;
    width: 100%;
    height: 100%;
    transition: opacity var(--motion-fast) var(--ease-snappy);
  }
  
  .pulse-glow.upper {
    background: radial-gradient(circle at center top, var(--color-focus)40 0%, transparent 50%);
  }
  
  .pulse-glow.lower {
    background: radial-gradient(circle at center bottom, var(--color-focus)40 0%, transparent 50%);
  }
  
  .proximity-warning {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    animation: warning-pulse 1s ease-in-out infinite;
  }
  
  .warning-icon {
    font-size: var(--font-size-lg);
  }
  
  .warning-text {
    white-space: nowrap;
  }
  
  @keyframes warning-pulse {
    0%, 100% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 0.8;
    }
    50% {
      transform: translate(-50%, -50%) scale(1.05);
      opacity: 1;
    }
  }
  
  /* Direction-specific styles */
  .adr-pulse-indicator.direction-upper {
    border-top: 2px solid var(--color-focus);
  }
  
  .adr-pulse-indicator.direction-lower {
    border-bottom: 2px solid var(--color-focus);
  }
  
  /* Pulsing animation */
  .adr-pulse-indicator.pulsing {
    animation: container-pulse 1s ease-in-out;
  }
  
  @keyframes container-pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.01);
    }
  }
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    .pulse-line {
      height: 4px;
    }
    
    .proximity-warning {
      border-width: 2px;
    }
  }
  
  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .pulse-line {
      transition: none;
    }
    
    .pulse-glow {
      transition: none;
    }
    
    .proximity-warning {
      animation: none;
    }
    
    .adr-pulse-indicator.pulsing {
      animation: none;
    }
  }
  
  /* Mobile optimizations */
  @media (max-width: 768px) {
    .proximity-warning {
      padding: var(--space-1) var(--space-2);
      font-size: 10px;
    }
    
    .warning-icon {
      font-size: var(--font-size-md);
    }
  }
</style>
