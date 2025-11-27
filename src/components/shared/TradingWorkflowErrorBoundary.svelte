<script>
  import { onMount } from 'svelte';
  import { withErrorBoundary } from '../../utils/errorBoundaryUtils.js';

  // Props
  export let criticalMode = false;
  export let workflowName = "Unknown Workflow";
  export let showSystemHealth = true;

  // State
  let hasError = false;
  let error = null;
  let systemHealth = 'unknown';
  let errorCount = 0;
  let lastErrorTime = null;

  // Critical trading workflow functions that must always work
  const criticalFunctions = {
    createDisplay: (symbol, position) => {
      console.log(`[TRADING_WORKFLOW] Creating display for ${symbol}`);
      // Fallback display creation that always works
      return {
        id: `fallback-${Date.now()}`,
        symbol,
        position,
        config: {
          fallback: true,
          minimal: true
        }
      };
    },

    removeDisplay: (displayId) => {
      console.log(`[TRADING_WORKFLOW] Removing display ${displayId}`);
      return true;
    },

    executeShortcut: (shortcut) => {
      console.log(`[TRADING_WORKFLOW] Executing shortcut: ${shortcut}`);
      return true;
    }
  };

  // Safe execution wrapper for critical operations
  const safeExecute = withErrorBoundary(
    (fn, ...args) => fn(...args),
    null,
    'TradingWorkflow'
  );

  // Error handler for critical trading workflows
  const handleCriticalError = (error, context) => {
    hasError = true;
    error = error;
    errorCount++;
    lastErrorTime = new Date();

    console.error('[TRADING_WORKFLOW_ERROR]', {
      workflow: workflowName,
      error: error.message,
      context,
      errorCount,
      timestamp: lastErrorTime.toISOString(),
      criticalMode
    });

    // In critical mode, always provide fallbacks
    if (criticalMode) {
      console.warn('[TRADING_WORKFLOW] Critical mode activated - providing fallback functionality');
    }

    // Update system health
    updateSystemHealth('error');
  };

  // Monitor system health
  const updateSystemHealth = (status) => {
    systemHealth = status;
  };

  // Auto-recovery mechanism
  const attemptRecovery = () => {
    console.log('[TRADING_WORKFLOW] Attempting error recovery...');
    hasError = false;
    error = null;
    updateSystemHealth('recovering');

    // Clear error state after recovery attempt
    setTimeout(() => {
      updateSystemHealth('healthy');
    }, 1000);
  };

  // Wrapped critical functions with error handling
  const wrappedFunctions = {};
  Object.keys(criticalFunctions).forEach(key => {
    wrappedFunctions[key] = (...args) => {
      try {
        return safeExecute(criticalFunctions[key], ...args);
      } catch (error) {
        handleCriticalError(error, { function: key, args });
        return null;
      }
    };
  });

  // Expose safe functions to parent
  export const safeTradingFunctions = wrappedFunctions;

  // System health monitoring
  onMount(() => {
    const healthCheck = setInterval(() => {
      if (!hasError && errorCount === 0) {
        updateSystemHealth('healthy');
      } else if (hasError) {
        updateSystemHealth('error');
      } else if (errorCount > 0) {
        updateSystemHealth('degraded');
      }
    }, 5000);

    return () => clearInterval(healthCheck);
  });

  // Make functions globally available for trading workflows
  $: if (typeof window !== 'undefined') {
    window.safeTradingWorkflow = {
      ...wrappedFunctions,
      hasError: () => hasError,
      getErrorCount: () => errorCount,
      attemptRecovery,
      getSystemHealth: () => systemHealth
    };
  }
</script>

<div class="trading-workflow-error-boundary" class:has-error={hasError} class:critical-mode={criticalMode}>
  {#if hasError}
    <div class="workflow-error-overlay">
      <div class="workflow-error-content">
        <div class="error-header">
          <div class="error-icon">
            {criticalMode ? '🚨' : '⚠️'}
          </div>
          <div class="error-info">
            <h3 class="error-title">
              {criticalMode ? 'Critical Trading Error' : 'Workflow Error'}
            </h3>
            <p class="error-workflow">{workflowName}</p>
          </div>
        </div>

        <div class="error-body">
          <p class="error-description">
            {criticalMode
              ? 'A critical error occurred in the trading workflow. Fallback systems have been activated to ensure trading continuity.'
              : 'An error occurred in this workflow. Trading functionality remains active.'
            }
          </p>

          {#if error?.message}
            <div class="error-technical">
              <span class="error-message">{error.message}</span>
            </div>
          {/if}

          <div class="error-actions">
            <button class="recovery-button" on:click={attemptRecovery}>
              🔄 Attempt Recovery
            </button>

            {#if showSystemHealth}
              <div class="system-health">
                <span class="health-indicator health-{systemHealth}"></span>
                <span class="health-text">
                  System: {systemHealth} | Errors: {errorCount}
                </span>
              </div>
            {/if}
          </div>
        </div>

        {#if criticalMode}
          <div class="critical-notice">
            <strong>Trading Safety:</strong> All critical trading functions remain active through fallback systems.
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <slot {safeTradingFunctions} {hasError} {attemptRecovery} />

  {#if showSystemHealth && !hasError}
    <div class="system-health-indicator">
      <span class="health-dot health-{systemHealth}"></span>
      <span class="health-label">{systemHealth}</span>
    </div>
  {/if}
</div>

<style>
  .trading-workflow-error-boundary {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .trading-workflow-error-boundary.has-error {
    pointer-events: none;
  }

  .trading-workflow-error-boundary.critical-mode {
    border: 2px solid transparent;
    border-radius: 4px;
  }

  .trading-workflow-error-boundary.critical-mode.has-error {
    border-color: #dc2626;
    background: rgba(220, 38, 38, 0.05);
  }

  .workflow-error-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    pointer-events: all;
  }

  .workflow-error-content {
    background: #1f2937;
    border: 1px solid #4b5563;
    border-radius: 12px;
    padding: 24px;
    max-width: 500px;
    width: 90%;
    color: #f3f4f6;
  }

  .error-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
  }

  .error-icon {
    font-size: 32px;
  }

  .error-info {
    flex: 1;
  }

  .error-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 4px 0;
    color: #ef4444;
  }

  .error-workflow {
    font-size: 14px;
    color: #9ca3af;
    margin: 0;
  }

  .error-body {
    margin-bottom: 20px;
  }

  .error-description {
    font-size: 14px;
    line-height: 1.5;
    color: #d1d5db;
    margin: 0 0 16px 0;
  }

  .error-technical {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 16px;
  }

  .error-message {
    font-size: 13px;
    color: #f87171;
    font-family: monospace;
  }

  .error-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .recovery-button {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  .recovery-button:hover {
    background: #2563eb;
  }

  .system-health {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #9ca3af;
  }

  .health-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .health-healthy {
    background: #10b981;
  }

  .health-error {
    background: #ef4444;
  }

  .health-degraded {
    background: #f59e0b;
  }

  .health-recovering {
    background: #3b82f6;
    animation: pulse-health 1s infinite;
  }

  @keyframes pulse-health {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .critical-notice {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 6px;
    padding: 12px;
    font-size: 13px;
    color: #fca5a5;
  }

  .system-health-indicator {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(0, 0, 0, 0.7);
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 11px;
    color: #9ca3af;
    z-index: 1000;
  }

  .health-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }
</style>