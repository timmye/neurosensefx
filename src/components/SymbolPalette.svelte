<script>
  import { onMount } from 'svelte';
  import { actions } from '../stores/floatingStore.js';
  import FloatingPanel from './FloatingPanel.svelte';
  import { symbolStore } from '../data/symbolStore.js';
  import { availableSymbols, subscribe } from '../data/wsClient.js';
  import { connectionManager } from '../data/ConnectionManager.js';
  
  let symbols = [];
  let availableSyms = [];
  let wsStatus = 'disconnected';
  
  const unsubscribeSymbol = symbolStore.subscribe(value => {
    symbols = Object.keys(value);
  });
  
  const unsubscribeAvailable = availableSymbols.subscribe(value => {
    availableSyms = value;
  });
  
  onMount(() => {
    return () => {
      unsubscribeSymbol();
      unsubscribeAvailable();
    };
  });
  
  async function handleSymbolClick(symbol) {
    console.log('Creating display for symbol:', symbol);
    
    // Create display first
    const displayId = actions.addDisplay(symbol, {
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 100
    });
    
    // Then subscribe to data
    try {
      await connectionManager.subscribeCanvas(displayId, symbol);
      console.log('Successfully subscribed display to data');
    } catch (error) {
      console.error('Failed to subscribe display to data:', error);
    }
  }
</script>

<FloatingPanel id="symbol-palette" type="symbol-palette" title="Symbol Palette">
  <div class="palette-content">
    <!-- Available Symbols -->
    {#if availableSyms.length > 0}
      <div class="section">
        <div class="section-title">Available Symbols</div>
        <div class="symbol-list">
          {#each availableSyms as symbol}
            <div class="symbol-item" on:click={() => handleSymbolClick(symbol)}>
              <span class="symbol-name">{symbol}</span>
              <span class="symbol-action">+</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
    
    <!-- Active Symbols -->
    {#if symbols.length > 0}
      <div class="section">
        <div class="section-title">Active Displays</div>
        <div class="symbol-list">
          {#each symbols as symbol}
            <div class="symbol-item active" on:click={() => handleSymbolClick(symbol)}>
              <span class="symbol-name">{symbol}</span>
              <span class="symbol-action">+</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
    
    <!-- No symbols message -->
    {#if availableSyms.length === 0 && symbols.length === 0}
      <div class="no-symbols">
        <div class="no-symbols-text">No symbols available</div>
        <div class="no-symbols-hint">Connecting to data source...</div>
      </div>
    {/if}
  </div>
</FloatingPanel>

<style>
  .palette-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .section-title {
    color: #9ca3af;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0 4px;
  }
  
  .symbol-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .symbol-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #374151;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  
  .symbol-item:hover {
    background: #4b5563;
  }
  
  .symbol-item.active {
    background: rgba(79, 70, 229, 0.1);
    border: 1px solid rgba(79, 70, 229, 0.3);
  }
  
  .symbol-name {
    color: #d1d5db;
    font-family: 'Courier New', monospace;
    font-size: 14px;
  }
  
  .symbol-action {
    color: #4f46e5;
    font-weight: bold;
    font-size: 16px;
  }
  
  .no-symbols {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    color: #6b7280;
    text-align: center;
  }
  
  .no-symbols-text {
    font-size: 14px;
    margin-bottom: 4px;
  }
  
  .no-symbols-hint {
    font-size: 12px;
    color: #9ca3af;
  }
</style>
