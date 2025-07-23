<script>
  import { onMount, onDestroy } from 'svelte';
  import VizDisplay from './components/VizDisplay.svelte';
  import ConfigPanel from './components/ConfigPanel.svelte';
  import { vizConfig, vizState } from './stores.js';
  import { tickData, dataSourceMode, setDataSource, subscribe, unsubscribe } from './data/wsClient.js';

  let currentVizConfig = $vizConfig;
  let marketProfileData = { levels: [] };
  let flashEffect = null;
  
  console.log('App.svelte: Initial $vizState:', $vizState);

  // --- Lifecycle ---
  onMount(() => {
    const dataWorker = new Worker(new URL('./workers/dataProcessor.js', import.meta.url), { type: 'module' });
    
    dataWorker.postMessage({ 
        type: 'init', 
        payload: { config: currentVizConfig, midPrice: 1.25500 } 
    });

    dataWorker.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === 'stateUpdate') {
        vizState.set(payload.newState); // This updates the store, and thus $vizState
        marketProfileData = payload.marketProfile || { levels: [] };
        
        console.log('App.svelte: Received stateUpdate from worker, new $vizState:', $vizState);

        if (payload.significantTick) {
          flashEffect = {
            direction: payload.newState.lastTickDirection,
            id: Date.now(),
            magnitude: payload.tickMagnitude
          };
        }
      }
    };

    const unsubscribeConfig = vizConfig.subscribe(newConfig => {
      currentVizConfig = newConfig;
      if (dataWorker) {
        dataWorker.postMessage({ type: 'updateConfig', payload: newConfig });
      }
    });

    const unsubscribeTicks = tickData.subscribe(ticks => {
      if (dataWorker && ticks) {
        const firstSymbol = Object.keys(ticks)[0];
        if(firstSymbol) {
             console.log('App.svelte: Forwarding tick to worker:', ticks[firstSymbol]);
             dataWorker.postMessage({ type: 'tick', payload: ticks[firstSymbol] });
        }
      }
    });

    return () => {
      unsubscribeConfig();
      unsubscribeTicks();
      dataWorker.terminate();
    };
  });

  // --- Event Handlers ---
  function handleSubscriptionChange(event) {
      const { symbols, subscribe: shouldSubscribe } = event.detail;
      if (shouldSubscribe) {
          subscribe(symbols);
      } else {
          unsubscribe(symbols);
      }
  }

  function handleDataSourceChange(event) {
      setDataSource(event.detail.mode);
  }

</script>

<main>
  <div class="main-container">
    <div class="viz-container">
      <h1>NeuroSense FX</h1>
      {#if $vizState && $vizState.adrHigh !== undefined && $vizState.adrLow !== undefined}
        <VizDisplay 
          config={currentVizConfig} 
          state={$vizState} 
          {marketProfileData}
          {flashEffect}
        />
      {/if}
    </div>
    <div class="config-panel-container">
      <ConfigPanel 
        bind:config={currentVizConfig}
        on:subscriptionChange={handleSubscriptionChange}
        on:dataSourceChange={handleDataSourceChange}
      />
    </div>
  </div>
</main>

<style>
  main {
    background-color: #111827;
    color: #d1d5db;
    min-height: 100vh;
  }
  .main-container {
    display: flex;
    flex-direction: row;
    padding: 20px;
  }
  .viz-container {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .config-panel-container {
    width: 350px;
    margin-left: 20px;
  }
  h1 {
    color: #60a5fa;
    margin-bottom: 20px;
  }
</style>
