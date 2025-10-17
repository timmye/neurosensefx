# ConfigPanel Refactoring Plan

## Overview

This document outlines the plan to refactor the ConfigPanel component to eliminate duplicate controls and create floating components for the remaining system-level controls. This refactoring is essential to resolve the current frontend issues and complete the floating workspace transformation.

## Current Issues

1. **Duplicate Controls**: Visual settings exist in both ConfigPanel and CanvasContextMenu
2. **Event Handling Conflicts**: Both components trying to handle the same configuration changes
3. **State Synchronization Issues**: Inconsistent state updates between components
4. **User Experience Confusion**: Users see the same controls in two different places

## Refactoring Strategy

### Phase 1: Remove Duplicate Visual Controls from ConfigPanel

Remove all visual settings that are now handled by the CanvasContextMenu:

1. **Layout & Meter Controls** (lines 199-303)
   - visualizationsContentWidth
   - meterHeight
   - centralAxisXPosition
   - adrProximityThreshold
   - adrPulse controls
   - pHighLowLabelSide, ohlLabelSide
   - pHighLow label background and outline
   - ohl label background and outline

2. **ADR Range Indicator** (lines 307-355)
   - showAdrRangeIndicatorLines
   - adrRangeIndicatorLinesColor
   - adrRangeIndicatorLinesThickness
   - showAdrRangeIndicatorLabel
   - adrLabelType
   - adrRangeIndicatorLabelColor
   - adrRangeIndicatorLabel background and outline

3. **Price Markers** (lines 357-372)
   - markerLineColor
   - markerLineThickness
   - markerLabelColor

4. **Event Highlighting** (lines 377-405)
   - showFlash
   - flashThreshold
   - flashIntensity
   - showOrbFlash
   - orbFlashThreshold
   - orbFlashIntensity

5. **Price Elements** (lines 407-492)
   - priceFloatWidth, priceFloatHeight
   - priceFloatUseDirectionalColor
   - priceFloat colors
   - priceFontSize
   - showPipetteDigit
   - priceUseStaticColor
   - price colors
   - showPriceBackground
   - priceBackgroundColor, priceBackgroundOpacity
   - showPriceBoundingBox
   - priceBoxOutlineColor, priceBoxOutlineOpacity

6. **Hover Label** (lines 495-511)
   - hoverLabelShowBackground
   - hoverLabelBackgroundColor
   - hoverLabelBackgroundOpacity

7. **Volatility Orb** (lines 512-535)
   - showVolatilityOrb
   - showVolatilityMetric
   - volatilityOrbBaseWidth
   - volatilityColorMode

8. **Market Profile** (lines 537-598)
   - showMarketProfile
   - marketProfileView
   - marketProfileOutline
   - marketProfile outline controls
   - priceBucketMultiplier
   - marketProfileWidthRatio
   - marketProfile colors
   - marketProfileOpacity

### Phase 2: Create Floating Components

Create new floating components for the remaining system-level controls:

#### 1. FloatingDebugPanel Component

**Purpose**: Display live debug information in a floating panel

**Controls**:
- Profile Levels
- Profile Ticks
- ADR High/Low
- Visual High/Low
- Current Price
- Digits
- Tick Direction
- Volatility

**Implementation**:
```javascript
// src/components/FloatingDebugPanel.svelte
<script>
  import { createEventDispatcher } from 'svelte';
  
  export let position = { x: 100, y: 100 };
  export let state = null;
  export let isVisible = true;
  
  const dispatch = createEventDispatcher();
  
  function handleClose() {
    dispatch('close');
  }
  
  function handleDragStart(event) {
    // Implement drag functionality
  }
</script>

{#if isVisible && state}
<div class="floating-debug-panel" style="left: {position.x}px; top: {position.y}px;">
  <div class="panel-header" on:mousedown={handleDragStart}>
    <h3>Debug Info</h3>
    <button class="close-btn" on:click={handleClose}>×</button>
  </div>
  <div class="panel-content">
    <div class="info-grid">
      <span>Profile Levels:</span><span>{state.marketProfile?.levels?.length || 0}</span>
      <span>Profile Ticks:</span><span>{state.marketProfile?.tickCount || 0}</span>
      <!-- ... other debug info -->
    </div>
  </div>
</div>
{/if}

<style>
  .floating-debug-panel {
    position: fixed;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    padding: 0;
    min-width: 250px;
    max-width: 350px;
    z-index: 9999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #374151;
    border-radius: 8px 8px 0 0;
    cursor: move;
  }
  
  .panel-content {
    padding: 12px;
  }
  
  .info-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 8px;
    font-family: monospace;
    font-size: 0.8em;
  }
  
  .info-grid span:nth-child(odd) {
    font-weight: bold;
    color: #9ca3af;
  }
</style>
```

#### 2. FloatingSystemPanel Component

**Purpose**: Provide system-level controls in a floating panel

**Controls**:
- Data Source selector
- Connection status
- Simulation settings (frequencyMode)

**Implementation**:
```javascript
// src/components/FloatingSystemPanel.svelte
<script>
  import { createEventDispatcher } from 'svelte';
  import { dataSourceMode, wsStatus } from '../data/wsClient.js';
  
  export let position = { x: 100, y: 200 };
  export let config = null;
  export let isVisible = true;
  
  const dispatch = createEventDispatcher();
  
  function handleClose() {
    dispatch('close');
  }
  
  function handleDragStart(event) {
    // Implement drag functionality
  }
  
  function handleDataSourceChange(event) {
    dispatch('dataSourceChange', { mode: event.target.value });
  }
  
  function handleConfigChange(parameter, value) {
    config[parameter] = value;
    dispatch('configChange', { [parameter]: value });
  }
</script>

{#if isVisible}
<div class="floating-system-panel" style="left: {position.x}px; top: {position.y}px;">
  <div class="panel-header" on:mousedown={handleDragStart}>
    <h3>System Controls</h3>
    <button class="close-btn" on:click={handleClose}>×</button>
  </div>
  <div class="panel-content">
    <!-- Data Source -->
    <div class="control-group">
      <label for="dataSource">Data Source</label>
      <select id="dataSource" bind:value={$dataSourceMode} on:change={handleDataSourceChange}>
        <option value="simulated">Simulated Data</option>
        <option value="live">Live Data (cTrader)</option>
      </select>
    </div>
    
    <!-- Connection Status -->
    <div class="control-group">
      <div class="status-box">
        <span class="status-indicator status-{$wsStatus}"></span>
        <span class="status-text">{$wsStatus}</span>
      </div>
    </div>
    
    <!-- Simulation Controls -->
    {#if $dataSourceMode === 'simulated' && config}
      <div class="control-group">
        <label for="frequencyMode">Market Activity</label>
        <select id="frequencyMode" bind:value={config.frequencyMode} on:change={() => handleConfigChange('frequencyMode', config.frequencyMode)}>
          <option value="calm">Calm</option>
          <option value="normal">Normal</option>
          <option value="active">Active</option>
          <option value="volatile">Volatile</option>
        </select>
      </div>
    {/if}
  </div>
</div>
{/if}

<style>
  .floating-system-panel {
    position: fixed;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    padding: 0;
    min-width: 250px;
    max-width: 300px;
    z-index: 9999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #374151;
    border-radius: 8px 8px 0 0;
    cursor: move;
  }
  
  .panel-content {
    padding: 12px;
  }
  
  .control-group {
    margin-bottom: 12px;
  }
  
  .control-group:last-child {
    margin-bottom: 0;
  }
  
  label {
    display: block;
    margin-bottom: 4px;
    font-weight: 500;
    color: #9ca3af;
    font-size: 0.9em;
  }
  
  select, input {
    width: 100%;
    padding: 6px;
    border-radius: 4px;
    border: 1px solid #4b5563;
    background-color: #1f2937;
    color: #e5e7eb;
  }
  
  .status-box {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px;
    background-color: #111827;
    border-radius: 4px;
  }
  
  .status-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  
  .status-disconnected { background-color: #ef4444; }
  .status-connected { background-color: #22c55e; }
  .status-error { background-color: #ef4444; }
</style>
```

#### 3. FloatingSubscriptionPanel Component

**Purpose**: Manage symbol subscriptions in a floating panel

**Controls**:
- Symbol selector
- Subscribe button
- Active subscriptions list
- Unsubscribe buttons

**Implementation**:
```javascript
// src/components/FloatingSubscriptionPanel.svelte
<script>
  import { createEventDispatcher } from 'svelte';
  import { wsStatus, availableSymbols, subscribe, unsubscribe } from '../data/wsClient.js';
  import { symbolStore } from '../data/symbolStore.js';
  import FXSymbolSelector from './FXSymbolSelector.svelte';
  
  export let position = { x: 100, y: 300 };
  export let isVisible = true;
  
  const dispatch = createEventDispatcher();
  
  let selectedSymbolForSubscription = null;
  let subscribedSymbols = [];
  
  const unsub = symbolStore.subscribe(value => {
    subscribedSymbols = Object.keys(value);
  });
  
  function handleClose() {
    dispatch('close');
  }
  
  function handleDragStart(event) {
    // Implement drag functionality
  }
  
  function handleSymbolSelect(event) {
    selectedSymbolForSubscription = event.detail.symbol;
    
    // Subscribe if shouldSubscribe is true (Enter key pressed)
    if (event.detail.shouldSubscribe) {
      handleSubscribe();
    }
  }
  
  function handleSubscribe() {
    if (selectedSymbolForSubscription) {
      subscribe(selectedSymbolForSubscription);
      dispatch('createCanvas', { symbol: selectedSymbolForSubscription });
    }
  }
  
  function handleUnsubscribe(symbol) {
    unsubscribe(symbol);
  }
</script>

{#if $wsStatus === 'connected' && isVisible}
<div class="floating-subscription-panel" style="left: {position.x}px; top: {position.y}px;">
  <div class="panel-header" on:mousedown={handleDragStart}>
    <h3>Symbol Subscriptions</h3>
    <button class="close-btn" on:click={handleClose}>×</button>
  </div>
  <div class="panel-content">
    <div class="subscription-controls">
      <FXSymbolSelector
        bind:selectedSymbol={selectedSymbolForSubscription}
        availableSymbols={$availableSymbols}
        subscribedSymbols={subscribedSymbols}
        placeholder="Select a symbol..."
        on:select={handleSymbolSelect}
      />
      <button class="subscribe-btn" disabled={!selectedSymbolForSubscription} on:click={handleSubscribe}>
        Subscribe
      </button>
    </div>
    
    {#if subscribedSymbols.length > 0}
      <div class="subscribed-list">
        <h4>Active Subscriptions:</h4>
        <ul>
          {#each subscribedSymbols as symbol}
            <li>
              <span>{symbol}</span>
              <button class="unsubscribe-btn" on:click={() => handleUnsubscribe(symbol)}>×</button>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
</div>
{/if}

<style>
  .floating-subscription-panel {
    position: fixed;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    padding: 0;
    min-width: 280px;
    max-width: 350px;
    z-index: 9999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #374151;
    border-radius: 8px 8px 0 0;
    cursor: move;
  }
  
  .panel-content {
    padding: 12px;
  }
  
  .subscription-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }
  
  .subscribe-btn {
    padding: 6px 12px;
    background-color: #4f46e5;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .subscribe-btn:disabled {
    background-color: #4b5563;
    cursor: not-allowed;
  }
  
  .subscribed-list h4 {
    margin: 0 0 8px 0;
    font-size: 0.9em;
    color: #9ca3af;
  }
  
  .subscribed-list ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .subscribed-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 8px;
    background-color: #111827;
    border-radius: 4px;
    margin-bottom: 4px;
  }
  
  .unsubscribe-btn {
    background: none;
    border: none;
    color: #ef4444;
    cursor: pointer;
    font-weight: bold;
    padding: 0;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
```

### Phase 3: Integrate Floating Components in App.svelte

Update App.svelte to include the new floating components:

```javascript
// In App.svelte script section
import FloatingDebugPanel from './components/FloatingDebugPanel.svelte';
import FloatingSystemPanel from './components/FloatingSystemPanel.svelte';
import FloatingSubscriptionPanel from './components/FloatingSubscriptionPanel.svelte';

// Add state for floating panels
let showDebugPanel = false;
let showSystemPanel = false;
let showSubscriptionPanel = false;

let debugPanelPosition = { x: 100, y: 100 };
let systemPanelPosition = { x: 100, y: 200 };
let subscriptionPanelPosition = { x: 100, y: 300 };

// Add handlers for floating panels
function toggleDebugPanel() {
  showDebugPanel = !showDebugPanel;
}

function toggleSystemPanel() {
  showSystemPanel = !showSystemPanel;
}

function toggleSubscriptionPanel() {
  showSubscriptionPanel = !showSubscriptionPanel;
}
```

```html
<!-- In App.svelte template section -->
<!-- Floating Components -->
<FloatingDebugPanel 
  bind:position={debugPanelPosition}
  bind:isVisible={showDebugPanel}
  state={$selectedSymbolState}
  on:close={() => showDebugPanel = false}
/>

<FloatingSystemPanel 
  bind:position={systemPanelPosition}
  bind:isVisible={showSystemPanel}
  config={$selectedSymbolConfig}
  on:close={() => showSystemPanel = false}
  on:dataSourceChange={handleDataSourceChange}
  on:configChange={handleConfigChange}
/>

<FloatingSubscriptionPanel 
  bind:position={subscriptionPanelPosition}
  bind:isVisible={showSubscriptionPanel}
  on:close={() => showSubscriptionPanel = false}
  on:createCanvas={handleCreateCanvas}
/>
```

### Phase 4: Add Toggle Buttons to Workspace

Add buttons to toggle the floating panels:

```javascript
// In App.svelte, add to workspace controls
<div class="workspace-controls">
  <button class="control-btn" on:click={toggleSystemPanel} title="System Controls">
    ⚙️ System
  </button>
  <button class="control-btn" on:click={toggleSubscriptionPanel} title="Symbol Subscriptions">
    📊 Subscriptions
  </button>
  <button class="control-btn" on:click={toggleDebugPanel} title="Debug Information">
    🐛 Debug
  </button>
</div>
```

## Implementation Order

1. **Remove duplicate visual controls from ConfigPanel** (Priority: High)
2. **Create FloatingDebugPanel component** (Priority: Medium)
3. **Create FloatingSystemPanel component** (Priority: High)
4. **Create FloatingSubscriptionPanel component** (Priority: High)
5. **Integrate floating components in App.svelte** (Priority: High)
6. **Add toggle buttons to workspace** (Priority: Medium)
7. **Test integration and fix any issues** (Priority: High)

## Expected Benefits

1. **Eliminated Duplicate Controls**: Visual settings only exist in CanvasContextMenu
2. **Resolved Event Conflicts**: Each component handles its own controls
3. **Improved User Experience**: Clear separation of concerns between controls
4. **Enhanced Workspace**: All controls accessible via floating elements
5. **Reduced ConfigPanel Size**: ConfigPanel only contains essential system controls

## Testing Strategy

1. **Unit Tests**: Test each floating component in isolation
2. **Integration Tests**: Test floating components with the main application
3. **E2E Tests**: Test complete user workflows with floating components
4. **Visual Regression Tests**: Ensure UI consistency after refactoring

## Rollback Plan

If issues arise during implementation:

1. Keep original ConfigPanel in a separate branch
2. Implement changes incrementally with feature flags
3. Test thoroughly before merging
4. Have a quick revert strategy if critical issues are found

This refactoring plan will resolve the current frontend issues and complete the floating workspace transformation, providing a clean and intuitive interface for users.