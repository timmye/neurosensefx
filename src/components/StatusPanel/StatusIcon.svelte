<script>
  import { connectivityStore, systemHealth } from './ConnectivityMonitor.js';

  // Reactive bindings to connectivity store
  $: internetStatus = $connectivityStore.internet;
  $: serverStatus = $connectivityStore.server;
  $: dataFreshnessStatus = $connectivityStore.latency; // TRADER-FOCUSED: Use data delay instead of symbol count
  $: overallHealth = $systemHealth;

  // Status colors following NeuroSense branding
  const statusColors = {
    good: '#0891b2',     // Blue (OK/UP)
    warning: '#a855f7',  // Purple (down/amber)
    error: '#ef4444',    // Red (bad)
    unknown: '#6b7280'   // Gray
  };

  // Pulse animation for warning/error states
  $: shouldPulse = internetStatus.status === 'warning' || internetStatus.status === 'error' ||
                   serverStatus.status === 'warning' || serverStatus.status === 'error' ||
                   dataFreshnessStatus.status === 'warning' || dataFreshnessStatus.status === 'error';

  // Get color for status
  function getStatusColor(status) {
    return statusColors[status] || statusColors.unknown;
  }

  // Get border color for overall system health
  $: borderColor = getStatusColor(overallHealth);
</script>

<div class="status-icon" class:pulse={shouldPulse} style="border-color: {borderColor};">
  <!-- 3 Traffic Lights Side-by-Side -->
  <div class="traffic-lights">
    <!-- Internet Status -->
    <div
      class="traffic-light"
      style="background-color: {getStatusColor(internetStatus.status)};"
      title="Internet: {internetStatus.details}"
    ></div>

    <!-- Server Status -->
    <div
      class="traffic-light"
      style="background-color: {getStatusColor(serverStatus.status)};"
      title="Server: {serverStatus.details}"
    ></div>

    <!-- Data Freshness Status -->
    <div
      class="traffic-light"
      style="background-color: {getStatusColor(dataFreshnessStatus.status)};"
      title="Data Freshness: {dataFreshnessStatus.details || `${dataFreshnessStatus.value}s ago`}"
    ></div>
  </div>
</div>

<style>
  .status-icon {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    border: 2px solid #334155;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    position: relative;
  }

  .status-icon:hover {
    border-color: #0891b2;
    box-shadow: 0 4px 12px rgba(8, 145, 178, 0.3);
    transform: scale(1.05);
  }

  .traffic-lights {
    display: flex;
    align-items: center;
    gap: 1px;
    width: 36px;
    height: 36px;
    padding: 2px;
    justify-content: center;
  }

  .traffic-light {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.3);
    position: relative;
    transition: all 0.3s ease;
    flex-shrink: 0;
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

  /* Accessibility support */
  @media (prefers-reduced-motion: reduce) {
    .status-icon,
    .traffic-light {
      transition: none;
    }

    .pulse {
      animation: none;
    }
  }

  /* High contrast support */
  @media (prefers-contrast: high) {
    .status-icon {
      border-width: 3px;
      background: #000;
    }

    .traffic-light {
      border-width: 2px;
    }
  }
</style>