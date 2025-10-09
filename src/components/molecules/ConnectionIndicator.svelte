<script>
  import { createEventDispatcher } from 'svelte';
  import { Badge } from '../atoms/index.js';
  import { Wifi, WifiOff, Loader2, AlertCircle, XCircle, CheckCircle } from 'lucide-svelte';
  
  // Component props
  export let status = 'disconnected'; // 'connected', 'connecting', 'disconnected', 'error'
  export let label = '';
  export let showLabel = true;
  export let size = 'md'; // 'sm', 'md', 'lg'
  export let animated = true;
  export let clickable = false;
  export let connectionQuality = null; // 'excellent', 'good', 'fair', 'poor'
  export let latency = null;
  export let lastConnected = null;
  
  const dispatch = createEventDispatcher();
  
  // Status configurations
  const statusConfig = {
    connected: {
      color: 'success',
      icon: Wifi,
      label: 'Connected',
      description: 'Successfully connected to the data service'
    },
    connecting: {
      color: 'info',
      icon: Loader2,
      label: 'Connecting',
      description: 'Establishing connection to the data service'
    },
    disconnected: {
      color: 'neutral',
      icon: WifiOff,
      label: 'Disconnected',
      description: 'Not connected to the data service'
    },
    error: {
      color: 'danger',
      icon: XCircle,
      label: 'Error',
      description: 'Connection error occurred'
    }
  };
  
  // Connection quality configurations
  const qualityConfig = {
    excellent: { color: 'success', label: 'Excellent', threshold: 50 },
    good: { color: 'info', label: 'Good', threshold: 100 },
    fair: { color: 'warning', label: 'Fair', threshold: 200 },
    poor: { color: 'danger', label: 'Poor', threshold: Infinity }
  };
  
  // Reactive calculations
  $: currentConfig = statusConfig[status] || statusConfig.disconnected;
  $: currentQuality = connectionQuality ? qualityConfig[connectionQuality] : null;
  $: displayLabel = label || currentConfig.label;
  $: ariaLabel = `${displayLabel}: ${currentConfig.description}${latency ? `, Latency: ${latency}ms` : ''}${currentQuality ? `, Quality: ${currentQuality.label}` : ''}`;
  
  // Animation timing
  let animationPhase = 0;
  
  // Handle click events
  function handleClick() {
    if (clickable) {
      dispatch('click', { status, connectionQuality, latency, lastConnected });
    }
  }
  
  // Handle keyboard events
  function handleKeydown(event) {
    if (clickable && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      handleClick();
    }
  }
  
  // Animation loop for connecting state
  function animate() {
    if (animated && status === 'connecting') {
      animationPhase += 0.1;
      requestAnimationFrame(animate);
    }
  }
  
  // Start/stop animation based on status
  $: if (animated && status === 'connecting') {
    animate();
  }
  
  // Get icon size based on component size
  $: iconSize = {
    sm: 14,
    md: 16,
    lg: 20
  }[size] || 16;

  // Calculate visual properties
  $: indicatorStyle = `
    ${animated && status === 'connecting' ? `
      animation: pulse 1.5s ease-in-out infinite;
    ` : ''}
  `;
  
  $: containerClasses = [
    'connection-indicator',
    `connection-indicator--${status}`,
    `connection-indicator--${size}`,
    clickable && 'connection-indicator--clickable',
    animated && status === 'connecting' && 'connection-indicator--animating'
  ].filter(Boolean).join(' ');
</script>

<div 
  class={containerClasses}
  class:clickable
  role={clickable ? 'button' : 'status'}
  aria-label={ariaLabel}
  tabindex={clickable ? 0 : undefined}
  on:click={handleClick}
  on:keydown={handleKeydown}
>
  <!-- Status indicator -->
  <div class="connection-indicator__status" style={indicatorStyle}>
    <div class="connection-indicator__icon">
      <svelte:component this={currentConfig.icon} size={iconSize} />
    </div>
  </div>
  
  <!-- Label and additional info -->
  {#if showLabel}
    <div class="connection-indicator__info">
      <div class="connection-indicator__label">
        {displayLabel}
      </div>
      
      <!-- Connection quality badge -->
      {#if currentQuality}
        <Badge 
          variant={currentQuality.color} 
          size="sm"
          class="connection-indicator__quality"
        >
          {currentQuality.label}
        </Badge>
      {/if}
      
      <!-- Latency display -->
      {#if latency !== null}
        <div class="connection-indicator__latency">
          {latency}ms
        </div>
      {/if}
      
      <!-- Last connected time -->
      {#if lastConnected && status !== 'connected'}
        <div class="connection-indicator__last-connected">
          Last: {new Date(lastConnected).toLocaleTimeString()}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .connection-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    border-radius: var(--radius-md);
    transition: all var(--motion-fast) var(--ease-snappy);
    font-family: var(--font-sans);
  }
  
  .connection-indicator--clickable {
    cursor: pointer;
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
  }
  
  .connection-indicator--clickable:hover {
    background: var(--bg-elevated);
    border-color: var(--color-focus);
    box-shadow: 0 0 0 1px var(--color-focus);
  }
  
  .connection-indicator--clickable:focus {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
  
  /* Size variants */
  .connection-indicator--sm {
    gap: var(--space-1);
    padding: var(--space-1);
  }
  
  .connection-indicator--sm .connection-indicator__icon {
    font-size: var(--text-sm);
  }
  
  .connection-indicator--sm .connection-indicator__label {
    font-size: var(--text-xs);
  }
  
  .connection-indicator--lg {
    gap: var(--space-3);
    padding: var(--space-3);
  }
  
  .connection-indicator--lg .connection-indicator__icon {
    font-size: var(--text-lg);
  }
  
  .connection-indicator--lg .connection-indicator__label {
    font-size: var(--text-base);
  }
  
  .connection-indicator__status {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    font-weight: var(--font-bold);
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .connection-indicator--connected .connection-indicator__status {
    background: var(--color-success);
    color: white;
    box-shadow: 0 0 8px var(--color-success);
  }
  
  .connection-indicator--connecting .connection-indicator__status {
    background: var(--color-info);
    color: white;
    box-shadow: 0 0 8px var(--color-info);
  }
  
  .connection-indicator--disconnected .connection-indicator__status {
    background: var(--color-neutral);
    color: var(--text-inverse);
  }
  
  .connection-indicator--error .connection-indicator__status {
    background: var(--color-danger);
    color: white;
    box-shadow: 0 0 8px var(--color-danger);
  }
  
  .connection-indicator__icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .connection-indicator__icon :deep(svg) {
    width: auto;
    height: auto;
  }
  
  .connection-indicator--connecting .connection-indicator__icon :deep(svg) {
    animation: spin 1s linear infinite;
  }
  
  .connection-indicator__info {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }
  
  .connection-indicator__label {
    font-weight: var(--font-medium);
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .connection-indicator__quality {
    align-self: flex-start;
  }
  
  .connection-indicator__latency {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    font-family: var(--font-mono);
  }
  
  .connection-indicator__last-connected {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }
  
  /* Animations */
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(0.95);
    }
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .connection-indicator--animating .connection-indicator__status {
    animation: pulse 1.5s ease-in-out infinite;
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .connection-indicator--clickable {
      border-width: 2px;
    }
    
    .connection-indicator__status {
      border: 1px solid currentColor;
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .connection-indicator,
    .connection-indicator__status,
    .connection-indicator--animating .connection-indicator__status {
      animation: none !important;
      transition: none !important;
    }
  }
  
  /* Print styles */
  @media print {
    .connection-indicator {
      background: white !important;
      border: 1px solid black !important;
      color: black !important;
    }
    
    .connection-indicator__status {
      background: black !important;
      color: white !important;
      box-shadow: none !important;
    }
  }
</style>
