<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { Button } from '../atoms/index.js';
  import { Icon } from '../atoms/index.js';
  import { Slider } from '../atoms/index.js';
  import { Select } from '../atoms/index.js';
  
  export let simulationEnabled = false;
  export let simulationSpeed = 1; // 1x, 2x, 5x, 10x
  export let volatilityLevel = 0.5; // 0-1 scale
  export let trendDirection = 'neutral'; // 'bullish', 'bearish', 'neutral'
  export let marketActivity = 'normal'; // 'slow', 'normal', 'active', 'volatile'
  
  const dispatch = createEventDispatcher();
  
  // Simulation state
  let isRunning = false;
  let simulationInterval = null;
  let tickCount = 0;
  let lastTickTime = 0;
  
  // Simulation presets
  const simulationPresets = [
    { id: 'slow', name: 'Slow Market', speed: 0.5, volatility: 0.2, trend: 'neutral' },
    { id: 'normal', name: 'Normal Market', speed: 1, volatility: 0.5, trend: 'neutral' },
    { id: 'active', name: 'Active Market', speed: 2, volatility: 0.7, trend: 'neutral' },
    { id: 'volatile', name: 'Volatile Market', speed: 3, volatility: 0.9, trend: 'neutral' },
    { id: 'bull-run', name: 'Bull Run', speed: 2, volatility: 0.6, trend: 'bullish' },
    { id: 'bear-crash', name: 'Bear Crash', speed: 2, volatility: 0.8, trend: 'bearish' }
  ];
  
  // Speed options
  const speedOptions = [
    { value: 0.5, label: '0.5x' },
    { value: 1, label: '1x' },
    { value: 2, label: '2x' },
    { value: 5, label: '5x' },
    { value: 10, label: '10x' }
  ];
  
  // Market activity options
  const activityOptions = [
    { value: 'slow', label: 'Slow' },
    { value: 'normal', label: 'Normal' },
    { value: 'active', label: 'Active' },
    { value: 'volatile', label: 'Volatile' }
  ];
  
  // Trend direction options
  const trendOptions = [
    { value: 'bearish', label: 'Bearish ↓' },
    { value: 'neutral', label: 'Neutral ↔' },
    { value: 'bullish', label: 'Bullish ↑' }
  ];
  
  // Start/stop simulation
  function toggleSimulation() {
    if (isRunning) {
      stopSimulation();
    } else {
      startSimulation();
    }
  }
  
  function startSimulation() {
    if (!simulationEnabled || isRunning) return;
    
    isRunning = true;
    lastTickTime = Date.now();
    
    const interval = 1000 / simulationSpeed; // Base interval adjusted by speed
    
    simulationInterval = setInterval(() => {
      generateTick();
    }, interval);
    
    dispatch('simulationStarted', {
      speed: simulationSpeed,
      volatility: volatilityLevel,
      trend: trendDirection,
      activity: marketActivity
    });
  }
  
  function stopSimulation() {
    if (!isRunning) return;
    
    isRunning = false;
    
    if (simulationInterval) {
      clearInterval(simulationInterval);
      simulationInterval = null;
    }
    
    dispatch('simulationStopped', {
      totalTicks: tickCount,
      duration: Date.now() - lastTickTime
    });
  }
  
  // Generate simulated tick data
  function generateTick() {
    tickCount++;
    const now = Date.now();
    
    // Calculate price movement based on settings
    const baseMovement = (Math.random() - 0.5) * volatilityLevel * 0.001;
    const trendInfluence = getTrendInfluence();
    const priceMovement = baseMovement + trendInfluence;
    
    // Generate tick data
    const tickData = {
      timestamp: now,
      tickCount,
      priceMovement,
      volume: Math.floor(Math.random() * 1000000) + 100000,
      spread: Math.random() * 0.0001 + 0.00001,
      volatility: volatilityLevel,
      trend: trendDirection,
      activity: marketActivity
    };
    
    dispatch('tickGenerated', tickData);
  }
  
  // Get trend influence on price movement
  function getTrendInfluence() {
    switch (trendDirection) {
      case 'bullish':
        return Math.random() * 0.0005 * volatilityLevel;
      case 'bearish':
        return -Math.random() * 0.0005 * volatilityLevel;
      default:
        return 0;
    }
  }
  
  // Apply preset
  function applyPreset(presetId) {
    const preset = simulationPresets.find(p => p.id === presetId);
    if (!preset) return;
    
    simulationSpeed = preset.speed;
    volatilityLevel = preset.volatility;
    trendDirection = preset.trend;
    marketActivity = preset.id;
    
    // Restart simulation if running
    if (isRunning) {
      stopSimulation();
      setTimeout(() => startSimulation(), 100);
    }
    
    dispatch('presetApplied', preset);
  }
  
  // Handle settings changes
  function handleSpeedChange(value) {
    simulationSpeed = parseFloat(value);
    
    if (isRunning) {
      stopSimulation();
      setTimeout(() => startSimulation(), 100);
    }
  }
  
  function handleVolatilityChange(value) {
    volatilityLevel = parseFloat(value);
  }
  
  function handleTrendChange(value) {
    trendDirection = value;
  }
  
  function handleActivityChange(value) {
    marketActivity = value;
  }
  
  // Reset simulation
  function resetSimulation() {
    stopSimulation();
    tickCount = 0;
    lastTickTime = 0;
    
    dispatch('simulationReset');
  }
  
  // Generate single tick (manual)
  function generateSingleTick() {
    if (!simulationEnabled) return;
    generateTick();
  }
  
  // Cleanup
  onDestroy(() => {
    if (simulationInterval) {
      clearInterval(simulationInterval);
    }
  });
</script>

<div class="market-simulation-controls">
  <div class="controls-header">
    <h3 class="controls-title">
      <Icon name="activity" size="sm" />
      Market Simulation
    </h3>
    <div class="controls-status">
      <div class="status-indicator" class:running={isRunning} class:stopped={!isRunning}>
        <div class="status-dot"></div>
        <span class="status-text">{isRunning ? 'Running' : 'Stopped'}</span>
      </div>
      {#if isRunning}
        <div class="tick-counter">
          <Icon name="trending-up" size="xs" />
          {tickCount} ticks
        </div>
      {/if}
    </div>
  </div>
  
  <!-- Main Controls -->
  <div class="main-controls">
    <Button
      variant={isRunning ? 'danger' : 'primary'}
      size="md"
      onClick={toggleSimulation}
      disabled={!simulationEnabled}
    >
      <Icon name={isRunning ? 'square' : 'play'} size="sm" />
      {isRunning ? 'Stop' : 'Start'} Simulation
    </Button>
    
    <Button
      variant="ghost"
      size="md"
      onClick={generateSingleTick}
      disabled={!simulationEnabled || isRunning}
    >
      <Icon name="zap" size="sm" />
      Single Tick
    </Button>
    
    <Button
      variant="ghost"
      size="md"
      onClick={resetSimulation}
    >
      <Icon name="refresh-cw" size="sm" />
      Reset
    </Button>
  </div>
  
  <!-- Simulation Settings -->
  <div class="simulation-settings">
    <div class="setting-group">
      <label class="setting-label">
        <Icon name="gauge" size="xs" />
        Speed
      </label>
      <Select
        options={speedOptions}
        value={simulationSpeed}
        onChange={handleSpeedChange}
        disabled={isRunning}
      />
    </div>
    
    <div class="setting-group">
      <label class="setting-label">
        <Icon name="bar-chart-2" size="xs" />
        Volatility
      </label>
      <div class="slider-container">
        <Slider
          min={0}
          max={1}
          step={0.1}
          value={volatilityLevel}
          onChange={handleVolatilityChange}
        />
        <span class="slider-value">{(volatilityLevel * 100).toFixed(0)}%</span>
      </div>
    </div>
    
    <div class="setting-group">
      <label class="setting-label">
        <Icon name="trending-up" size="xs" />
        Trend
      </label>
      <Select
        options={trendOptions}
        value={trendDirection}
        onChange={handleTrendChange}
      />
    </div>
    
    <div class="setting-group">
      <label class="setting-label">
        <Icon name="pulse" size="xs" />
        Activity
      </label>
      <Select
        options={activityOptions}
        value={marketActivity}
        onChange={handleActivityChange}
      />
    </div>
  </div>
  
  <!-- Presets -->
  <div class="presets-section">
    <h4 class="presets-title">Quick Presets</h4>
    <div class="presets-grid">
      {#each simulationPresets as preset}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => applyPreset(preset.id)}
          className={marketActivity === preset.id ? 'preset-active' : ''}
        >
          {preset.name}
        </Button>
      {/each}
    </div>
  </div>
  
  <!-- Advanced Settings -->
  <div class="advanced-settings">
    <details class="settings-details">
      <summary class="settings-summary">
        <Icon name="settings" size="xs" />
        Advanced Settings
      </summary>
      <div class="settings-content">
        <div class="setting-row">
          <label class="setting-label">
            <input
              type="checkbox"
              bind:checked={simulationEnabled}
            />
            Enable Simulation
          </label>
        </div>
        
        <div class="setting-row">
          <label class="setting-label">
            <input
              type="checkbox"
              checked={true}
            />
            Realistic Price Movements
          </label>
        </div>
        
        <div class="setting-row">
          <label class="setting-label">
            <input
              type="checkbox"
              checked={true}
            />
            Volume Simulation
          </label>
        </div>
        
        <div class="setting-row">
          <label class="setting-label">
            <input
              type="checkbox"
              checked={false}
            />
            News Events Simulation
          </label>
        </div>
      </div>
    </details>
  </div>
</div>

<style>
  .market-simulation-controls {
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    box-shadow: var(--shadow-md);
    max-width: 400px;
  }
  
  .controls-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-4);
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--border-subtle);
  }
  
  .controls-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }
  
  .controls-status {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-1);
  }
  
  .status-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--font-size-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .status-indicator.running {
    color: var(--color-success);
  }
  
  .status-indicator.stopped {
    color: var(--text-secondary);
  }
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
    animation: status-pulse 2s ease-in-out infinite;
  }
  
  .status-indicator.stopped .status-dot {
    animation: none;
  }
  
  .tick-counter {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }
  
  .main-controls {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }
  
  .simulation-settings {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  
  .setting-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  
  .setting-label {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--text-secondary);
  }
  
  .slider-container {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .slider-value {
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--text-primary);
    min-width: 40px;
    text-align: right;
  }
  
  .presets-section {
    margin-bottom: var(--space-4);
  }
  
  .presets-title {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 var(--space-2) 0;
  }
  
  .presets-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-2);
  }
  
  .preset-active {
    background: var(--color-focus);
    color: white;
  }
  
  .advanced-settings {
    border-top: 1px solid var(--border-subtle);
    padding-top: var(--space-3);
  }
  
  .settings-details {
    cursor: pointer;
  }
  
  .settings-summary {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--text-secondary);
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .settings-summary::-webkit-details-marker {
    display: none;
  }
  
  .settings-content {
    margin-top: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .setting-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .setting-row label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--text-primary);
    cursor: pointer;
  }
  
  .setting-row input[type="checkbox"] {
    margin: 0;
  }
  
  @keyframes status-pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  
  /* Responsive design */
  @media (max-width: 768px) {
    .market-simulation-controls {
      padding: var(--space-3);
      max-width: 100%;
    }
    
    .controls-header {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-2);
    }
    
    .main-controls {
      flex-direction: column;
    }
    
    .simulation-settings {
      grid-template-columns: 1fr;
    }
    
    .presets-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
