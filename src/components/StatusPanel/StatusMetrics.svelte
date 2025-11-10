<script>
  import { onMount, onDestroy } from 'svelte';

  // Props
  export let type = 'status'; // 'status' for traffic light, 'latency' for numeric display
  export let status = 'unknown'; // 'good', 'warning', 'error', 'unknown'
  export let value = null; // for latency value
  export let label = '';
  export let details = '';
  export let lastUpdate = Date.now();
  export let showDetails = false;
  export let size = 'small'; // 'small', 'medium', 'large'

  // Color scheme following NeuroSense FX branding
  const statusColors = {
    good: '#0891b2',     // Blue (OK/UP)
    warning: '#a855f7',  // Purple (down/amber)
    error: '#ef4444',    // Red (bad)
    unknown: '#6b7280'   // Gray
  };

  const statusGlowColors = {
    good: 'rgba(8, 145, 178, 0.2)',
    warning: 'rgba(168, 85, 247, 0.2)',
    error: 'rgba(239, 68, 68, 0.2)',
    unknown: 'rgba(107, 114, 128, 0.2)'
  };

  // Size configurations
  const sizes = {
    small: {
      indicator: 12,
      fontSize: 10,
      spacing: 4
    },
    medium: {
      indicator: 16,
      fontSize: 12,
      spacing: 6
    },
    large: {
      indicator: 20,
      fontSize: 14,
      spacing: 8
    }
  };

  $: currentSize = sizes[size] || sizes.small;
  $: currentColor = statusColors[status] || statusColors.unknown;
  $: currentGlowColor = statusGlowColors[status] || statusGlowColors.unknown;

  // Format last update time
  $: lastUpdateText = formatLastUpdate(lastUpdate);

  function formatLastUpdate(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 1000) return 'just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  }

  // Pulse animation for warning/error states
  $: shouldPulse = status === 'warning' || status === 'error';
</script>

<!-- Traffic Light Status Indicator -->
{#if type === 'status'}
  <div class="status-indicator" class:pulse={shouldPulse} class:show-details={showDetails}>
    <div
      class="traffic-light"
      style="width: {currentSize.indicator}px; height: {currentSize.indicator}px; background-color: {currentColor}; box-shadow: 0 0 {currentSize.indicator}px {currentGlowColor};"
    ></div>

    {#if label}
      <div class="status-label" style="font-size: {currentSize.fontSize}px;">
        {label}
      </div>
    {/if}

    {#if showDetails && details}
      <div class="status-details" style="font-size: {currentSize.fontSize - 2}px;">
        {details}
      </div>
    {/if}

    {#if showDetails}
      <div class="status-timestamp" style="font-size: {currentSize.fontSize - 2}px;">
        {lastUpdateText}
      </div>
    {/if}
  </div>

<!-- Data Delay Display -->
{:else if type === 'latency'}
  <div class="latency-display" class:show-details={showDetails}>
    <div class="latency-value" style="color: {currentColor};">
      {value || 0}
      <span class="latency-unit">ms</span>
    </div>

    {#if label}
      <div class="latency-label" style="font-size: {currentSize.fontSize}px;">
        {label}
      </div>
    {/if}

    {#if showDetails}
      <div class="latency-timestamp" style="font-size: {currentSize.fontSize - 2}px;">
        {lastUpdateText}
      </div>
    {/if}
  </div>
{/if}

<style>
  .status-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .status-indicator.show-details {
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(51, 65, 85, 0.5);
    min-width: 100px;
    padding: 8px;
  }

  .traffic-light {
    border-radius: 50%;
    transition: all 0.3s ease;
    border: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
  }

  .traffic-light::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 40%;
    height: 40%;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 50%;
  }

  .pulse {
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.1);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  .status-label {
    color: #d1d5db;
    font-weight: 500;
    text-transform: capitalize;
    white-space: nowrap;
  }

  .status-details {
    color: #9ca3af;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 150px;
  }

  .status-timestamp {
    color: #6b7280;
    font-style: italic;
  }

  /* Latency Display Styles */
  .latency-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 4px;
    min-width: 60px;
  }

  .latency-display.show-details {
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(51, 65, 85, 0.5);
    min-width: 100px;
    padding: 8px;
    border-radius: 4px;
  }

  .latency-value {
    font-family: 'Courier New', monospace;
    font-weight: bold;
    font-size: 16px;
    display: flex;
    align-items: baseline;
    gap: 2px;
  }

  .latency-unit {
    font-size: 10px;
    color: #9ca3af;
    font-weight: normal;
  }

  .latency-label {
    color: #d1d5db;
    font-weight: 500;
    text-align: center;
  }

  .latency-timestamp {
    color: #6b7280;
    font-style: italic;
    text-align: center;
  }

  /* Accessibility support */
  @media (prefers-reduced-motion: reduce) {
    .traffic-light,
    .status-indicator {
      transition: none;
    }

    .pulse {
      animation: none;
    }
  }

  /* High contrast support */
  @media (prefers-contrast: high) {
    .traffic-light {
      border-width: 2px;
    }

    .status-indicator.show-details,
    .latency-display.show-details {
      border-width: 2px;
      background: #000;
    }
  }
</style>