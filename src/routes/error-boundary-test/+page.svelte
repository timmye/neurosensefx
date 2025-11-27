<script>
  import ErrorBoundary from '../../components/shared/ErrorBoundary.svelte';
  import TradingWorkflowErrorBoundary from '../../components/shared/TradingWorkflowErrorBoundary.svelte';
  import UserErrorExperience from '../../components/shared/UserErrorExperience.svelte';
  import ContainerFixed from '../../components/viz/ContainerFixed.svelte';
  import VisualizationErrorFallback from '../../components/shared/VisualizationErrorFallback.svelte';

  let testErrors = [];
  let errorCount = 0;

  function triggerComponentError() {
    throw new Error('Test component error triggered manually');
  }

  function triggerAsyncError() {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error('Test async error after delay'));
      }, 100);
    });
  }

  function triggerNetworkError() {
    // Simulate network error
    const error = new Error('Simulated network connection failed');
    error.category = 'Network';
    if (window.userErrorExperience) {
      window.userErrorExperience.addError(error);
    }
  }

  function triggerDataError() {
    // Simulate data error
    const error = new Error('Invalid data received from market feed');
    error.category = 'Data';
    if (window.userErrorExperience) {
      window.userErrorExperience.addError(error);
    }
  }

  function triggerCriticalError() {
    // Simulate critical system error
    const error = new Error('Critical trading system failure - safety measures activated');
    error.category = 'Critical';
    if (window.userErrorExperience) {
      window.userErrorExperience.addError(error);
    }
  }

  function incrementErrorCount() {
    errorCount++;
    testErrors = [...testErrors, {
      id: errorCount,
      message: `Test error ${errorCount}`,
      timestamp: new Date().toISOString()
    }];
  }

  // Trigger some test errors on mount
  import { onMount } from 'svelte';
  onMount(() => {
    console.log('[ERROR_BOUNDARY_TEST] Page mounted - testing error boundaries');

    // Test global error handling
    setTimeout(() => {
      if (Math.random() < 0.3) { // 30% chance
        triggerNetworkError();
      }
    }, 2000);

    setTimeout(() => {
      if (Math.random() < 0.3) { // 30% chance
        triggerDataError();
      }
    }, 3000);
  });
</script>

<svelte:head>
  <title>Error Boundary Test - NeuroSense FX</title>
</svelte:head>

<TradingWorkflowErrorBoundary criticalMode={false} workflowName="Error Boundary Test Page">
  <div class="test-page">
    <header class="test-header">
      <h1>Error Boundary & Fallback Test</h1>
      <p>Testing comprehensive error handling for the NeuroSense FX trading platform</p>
    </header>

    <main class="test-main">
      <!-- Test Section 1: Component Error Boundaries -->
      <section class="test-section">
        <h2>1. Component Error Boundaries</h2>

        <div class="test-grid">
          <!-- Normal Component -->
          <div class="test-item">
            <h3>Normal Component</h3>
            <ErrorBoundary errorMessage="Test component failed" showRetry={true}>
              <div class="test-component normal">
                <p>✅ This component should work normally</p>
                <button on:click={incrementErrorCount}>Add Error Log</button>
              </div>
            </ErrorBoundary>
          </div>

          <!-- Component with Manual Error -->
          <div class="test-item">
            <h3>Component with Manual Error</h3>
            <ErrorBoundary
              errorMessage="This component has encountered an error"
              showRetry={true}
              fallbackComponent={VisualizationErrorFallback}
            >
              <div class="test-component error-prone">
                <p>⚠️ This component will throw an error</p>
                <button on:click={triggerComponentError}>Trigger Error</button>
              </div>
            </ErrorBoundary>
          </div>

          <!-- Container Component -->
          <div class="test-item">
            <h3>Canvas Container with Error Handling</h3>
            <ErrorBoundary
              errorMessage="Visualization container failed"
              fallbackComponent={VisualizationErrorFallback}
            >
              <ContainerFixed symbol="EURUSD" />
            </ErrorBoundary>
          </div>
        </div>
      </section>

      <!-- Test Section 2: User Experience Error Handling -->
      <section class="test-section">
        <h2>2. User Experience Error Handling</h2>

        <div class="error-triggers">
          <h3>Trigger Different Error Types</h3>
          <div class="button-grid">
            <button class="error-btn network" on:click={triggerNetworkError}>
              🌐 Network Error
            </button>
            <button class="error-btn data" on:click={triggerDataError}>
              📊 Data Error
            </button>
            <button class="error-btn critical" on:click={triggerCriticalError}>
              🚨 Critical Error
            </button>
            <button class="error-btn async" on:click={() => triggerAsyncError().catch(() => {})}>
              ⏱️ Async Error
            </button>
          </div>
        </div>
      </section>

      <!-- Test Section 3: Error History -->
      <section class="test-section">
        <h2>3. Error History & Metrics</h2>

        <div class="error-stats">
          <div class="stat-item">
            <h4>Total Test Errors</h4>
            <span class="stat-value">{errorCount}</span>
          </div>

          {#if window?.userErrorExperience}
            <div class="stat-item">
              <h4>Active System Errors</h4>
              <span class="stat-value">{window.userErrorExperience.getActiveErrors().length}</span>
            </div>
          {/if}
        </div>

        {#if testErrors.length > 0}
          <div class="error-history">
            <h4>Test Error Log</h4>
            <ul>
              {#each testErrors.slice(-5).reverse() as error}
                <li>
                  <span class="error-time">{new Date(error.timestamp).toLocaleTimeString()}</span>
                  <span class="error-message">{error.message}</span>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </section>
    </main>
  </div>
</TradingWorkflowErrorBoundary>

<!-- Global Error Experience Component -->
<UserErrorExperience />

<style>
  .test-page {
    min-height: 100vh;
    background: #111827;
    color: #f3f4f6;
    padding: 20px;
  }

  .test-header {
    text-align: center;
    margin-bottom: 40px;
    padding: 20px;
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    border-radius: 12px;
    border: 1px solid #4b5563;
  }

  .test-header h1 {
    margin: 0 0 8px 0;
    color: #60a5fa;
    font-size: 2.5rem;
  }

  .test-header p {
    margin: 0;
    color: #9ca3af;
    font-size: 1.1rem;
  }

  .test-main {
    max-width: 1200px;
    margin: 0 auto;
  }

  .test-section {
    margin-bottom: 40px;
    padding: 24px;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 12px;
  }

  .test-section h2 {
    margin: 0 0 20px 0;
    color: #f3f4f6;
    font-size: 1.5rem;
    border-bottom: 2px solid #374151;
    padding-bottom: 8px;
  }

  .test-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
  }

  .test-item {
    background: #374151;
    border: 1px solid #4b5563;
    border-radius: 8px;
    padding: 16px;
  }

  .test-item h3 {
    margin: 0 0 12px 0;
    color: #d1d5db;
    font-size: 1.1rem;
  }

  .test-component {
    padding: 16px;
    border-radius: 6px;
    text-align: center;
  }

  .test-component.normal {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .test-component.error-prone {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .error-triggers {
    text-align: center;
  }

  .error-triggers h3 {
    margin-bottom: 20px;
    color: #d1d5db;
  }

  .button-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    max-width: 800px;
    margin: 0 auto;
  }

  .error-btn {
    padding: 12px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    color: white;
  }

  .error-btn.network {
    background: #3b82f6;
  }

  .error-btn.network:hover {
    background: #2563eb;
  }

  .error-btn.data {
    background: #f59e0b;
  }

  .error-btn.data:hover {
    background: #d97706;
  }

  .error-btn.critical {
    background: #ef4444;
  }

  .error-btn.critical:hover {
    background: #dc2626;
  }

  .error-btn.async {
    background: #8b5cf6;
  }

  .error-btn.async:hover {
    background: #7c3aed;
  }

  .error-stats {
    display: flex;
    gap: 24px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .stat-item {
    background: #374151;
    border: 1px solid #4b5563;
    border-radius: 8px;
    padding: 16px;
    text-align: center;
    min-width: 150px;
  }

  .stat-item h4 {
    margin: 0 0 8px 0;
    color: #9ca3af;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .stat-value {
    display: block;
    font-size: 2rem;
    font-weight: bold;
    color: #60a5fa;
  }

  .error-history {
    background: #374151;
    border: 1px solid #4b5563;
    border-radius: 8px;
    padding: 16px;
  }

  .error-history h4 {
    margin: 0 0 12px 0;
    color: #d1d5db;
  }

  .error-history ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .error-history li {
    padding: 8px 0;
    border-bottom: 1px solid #4b5563;
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .error-history li:last-child {
    border-bottom: none;
  }

  .error-time {
    font-size: 0.85rem;
    color: #6b7280;
    font-family: monospace;
  }

  .error-message {
    color: #d1d5db;
  }

  button {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
  }

  button:hover {
    background: #2563eb;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .test-page {
      padding: 12px;
    }

    .test-header h1 {
      font-size: 2rem;
    }

    .test-section {
      padding: 16px;
    }

    .button-grid {
      grid-template-columns: 1fr;
    }

    .error-stats {
      flex-direction: column;
      gap: 12px;
    }
  }
</style>