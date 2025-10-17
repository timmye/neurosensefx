<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import FloatingCanvas from './components/FloatingCanvas.svelte';
  import CanvasContextMenu from './components/CanvasContextMenu.svelte';
  import FloatingSymbolPalette from './components/FloatingSymbolPalette.svelte';
  import FloatingDebugPanel from './components/FloatingDebugPanel.svelte';
  import FloatingSystemPanel from './components/FloatingSystemPanel.svelte';
  import FloatingMultiSymbolADR from './components/FloatingMultiSymbolADR.svelte';
  import { symbolStore } from './data/symbolStore.js';
  import { dataSourceMode, wsStatus, subscribe } from './data/wsClient.js';
  import { workspaceState, workspaceActions, createCanvasData } from './stores/workspaceState.js';
  import { uiState, uiActions } from './stores/uiState.js';
  import { registryActions } from './stores/canvasRegistry.js';
  import { createWorkspaceEventManager } from './utils/WorkspaceEventManager.js';
  import { defaultConfig } from './stores/configStore.js';

  let symbols = {};
  let workspaceElement;
  let eventManager;
  let showContextMenu = false;
  let contextMenuCanvasId = null;
  let contextMenuPosition = { x: 0, y: 0 };
  let contextMenuConfig = defaultConfig;


  const unsubSymbolStore = symbolStore.subscribe(value => {
    symbols = value;
  });

  // Subscribe to workspace state
  const unsubWorkspaceState = workspaceState.subscribe(state => {
    // Handle workspace state changes
  });

  // Subscribe to UI state for context menu
  const unsubUIState = uiState.subscribe(state => {
    showContextMenu = state.contextMenuOpen;
    contextMenuPosition = state.menuPosition;
    contextMenuCanvasId = state.activeCanvas;
  });

  onMount(() => {
    // Initialize workspace event manager
    if (workspaceElement) {
      eventManager = createWorkspaceEventManager(workspaceElement);
    }

    return () => {
      unsubSymbolStore();
      unsubWorkspaceState();
      unsubUIState();
      if (eventManager) {
        eventManager.destroy();
      }
    };
  });

  function handleDataSourceChange(event) {
    dataSourceMode.set(event.detail.mode);
  }

  function handleCanvasContextMenu(event) {
    const { canvasId, position } = event.detail;
    contextMenuCanvasId = canvasId;
    contextMenuPosition = position;
    
    // Get canvas config
    const canvasData = $workspaceState.canvases.get(canvasId);
    if (canvasData && canvasData.config) {
      contextMenuConfig = canvasData.config;
    }
    
    uiActions.showContextMenu(position, canvasId);
  }

  function handleCanvasClose(event) {
    const { canvasId } = event.detail;
    workspaceActions.removeCanvas(canvasId);
    registryActions.unregisterCanvas(canvasId);
  }

  function handleCanvasConfigChange(event) {
    const { canvasId, ...configChanges } = event.detail;
    workspaceActions.updateCanvas(canvasId, { config: { ...contextMenuConfig, ...configChanges } });
  }

  function handleCanvasConfigReset(event) {
    const { canvasId, config } = event.detail;
    workspaceActions.updateCanvas(canvasId, { config });
  }

  function handleContextMenuClose() {
    uiActions.hideContextMenu();
  }

  function handleCanvasDragStart(event) {
    const { canvasId, offset } = event.detail;
    workspaceActions.startDrag(canvasId, offset);
  }

  function handleCanvasDragMove(event) {
    const { canvasId, position } = event.detail;
    workspaceActions.updateDragPosition(position);
  }

  function handleCanvasDragEnd(event) {
    const { canvasId, position } = event.detail;
    workspaceActions.updateCanvas(canvasId, { position });
    workspaceActions.endDrag();
  }

  function handleCanvasHover(event) {
    const { canvasId, isHovering } = event.detail;
    if (isHovering) {
      uiActions.setCanvasHovered(canvasId);
    } else {
      uiActions.clearCanvasHovered(canvasId);
    }
  }


  function addFloatingCanvas(symbol = null, position = null) {
    console.log('🔍 DEBUG: addFloatingCanvas called', { symbol, position });
    
    const selectedSymbol = symbol || Object.keys(symbols)[0] || 'EURUSD';
    const canvasPosition = position || {
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 100
    };
    
    console.log('🔍 DEBUG: Canvas data', { selectedSymbol, canvasPosition, symbolsAvailable: Object.keys(symbols) });
    
    // Create canvas data
    const canvasData = createCanvasData(selectedSymbol, canvasPosition);
    
    // Get symbol config and state from symbolStore
    const symbolStoreValue = $symbolStore;
    const symbolData = symbolStoreValue[selectedSymbol];
    
    if (symbolData) {
      canvasData.config = { ...symbolData.config };
      canvasData.state = { ...symbolData.state };
      console.log('🔍 DEBUG: Using existing symbol data', { config: canvasData.config, state: canvasData.state });
    } else {
      canvasData.config = { ...defaultConfig };
      canvasData.state = { ready: false };
      console.log('🔍 DEBUG: Using default config', { config: canvasData.config, state: canvasData.state });
      
      // If symbol doesn't exist in symbolStore, we need to subscribe to it
      if ($dataSourceMode === 'live') {
        subscribe(selectedSymbol);
      } else if ($dataSourceMode === 'simulated') {
        // For simulation, we need to ensure the symbol exists
        if (selectedSymbol !== 'SIM-EURUSD') {
          console.log('🔍 DEBUG: Non-simulation symbol selected, switching to simulation mode');
          dataSourceMode.set('simulated');
        }
      }
    }
    
    console.log('🔍 DEBUG: Created canvas data', canvasData);
    
    // Register and add canvas
    registryActions.registerCanvas(canvasData.id, {
      symbol: selectedSymbol,
      type: 'floating'
    });
    
    console.log('🔍 DEBUG: Canvas registered, adding to workspace');
    workspaceActions.addCanvas(canvasData);
    
    // Update canvas data when symbolStore updates
    const unsubSymbolStore = symbolStore.subscribe(value => {
      const updatedSymbolData = value[selectedSymbol];
      if (updatedSymbolData && updatedSymbolData.state && updatedSymbolData.config) {
        workspaceActions.updateCanvas(canvasData.id, {
          config: { ...updatedSymbolData.config },
          state: { ...updatedSymbolData.state }
        });
      }
    });
    
    // Store unsubscribe function for cleanup
    canvasData.unsubSymbolStore = unsubSymbolStore;
    
    // Verify it was added
    setTimeout(() => {
      console.log('🔍 DEBUG: Workspace state after addition', {
        canvasCount: $workspaceState.canvases.size,
        canvases: Array.from($workspaceState.canvases.keys())
      });
    }, 100);
  }


  function clearWorkspace() {
    workspaceActions.clearWorkspace();
    registryActions.clearRegistry();
  }

  // Keyboard shortcuts
  function handleKeyDown(event) {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
    
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<main>
  <div class="main-container">
    
    <!-- Floating Workspace Container -->
    <div class="viz-area">
      <div
        bind:this={workspaceElement}
        class="workspace-container"
        class:show-grid={$workspaceState.showGrid}
      >
        <!-- Floating Canvases Layer -->
        <div class="floating-canvases-layer">
          {#each Array.from($workspaceState.canvases.values()) as canvas (canvas.id)}
            <FloatingCanvas
              id={canvas.id}
              symbol={canvas.symbol}
              config={canvas.config}
              state={canvas.state}
              position={canvas.position}
              on:contextMenu={handleCanvasContextMenu}
              on:close={handleCanvasClose}
              on:configChange={handleCanvasConfigChange}
              on:configReset={handleCanvasConfigReset}
              on:dragStart={handleCanvasDragStart}
              on:dragMove={handleCanvasDragMove}
              on:dragEnd={handleCanvasDragEnd}
              on:hover={handleCanvasHover}
            />
          {/each}
        </div>
        
        <!-- Empty State for Workspace -->
        {#if $workspaceState.canvases.size === 0}
          <div class="workspace-empty-state">
            <!-- Empty state with no text or buttons -->
          </div>
        {/if}
      </div>
    </div>
  </div>
  
  <!-- Global Context Menu -->
  {#if showContextMenu && contextMenuCanvasId}
    <CanvasContextMenu
      position={contextMenuPosition}
      canvasId={contextMenuCanvasId}
      config={contextMenuConfig}
      on:configChange={handleCanvasConfigChange}
      on:configReset={handleCanvasConfigReset}
      on:close={handleContextMenuClose}
    />
  {/if}
  
  <!-- Floating Symbol Palette -->
  <FloatingSymbolPalette on:canvasCreated={addFloatingCanvas} />
  
  <!-- Floating Debug Panel -->
  <FloatingDebugPanel on:close={() => uiActions.hideFloatingDebugPanel()} />
  
  <!-- Floating System Panel -->
  <FloatingSystemPanel on:dataSourceChange={handleDataSourceChange} />
  
  <!-- Floating Multi-Symbol ADR Panel -->
  <FloatingMultiSymbolADR on:close={() => uiActions.hideFloatingADRPanel()} />
</main>

<style>
  :global(body) {
    background-color: #111827;
  }
  
  
  .main-container {
    display: flex;
    height: 100vh;
    position: relative;
  }
  
  .viz-area {
    width: 100%;
    position: relative;
    overflow: hidden;
  }
  
  /* Workspace Container for Floating Canvases */
  .workspace-container {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #111827;
    background-image:
      radial-gradient(circle at 20% 50%, rgba(79, 70, 229, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 40% 20%, rgba(239, 68, 68, 0.1) 0%, transparent 50%);
    z-index: 10;
  }
  
  .workspace-container.show-grid {
    background-image: 
      radial-gradient(circle at 20% 50%, rgba(79, 70, 229, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 40% 20%, rgba(239, 68, 68, 0.1) 0%, transparent 50%),
      linear-gradient(rgba(55, 65, 81, 0.1) 1px, transparent 1px),
      linear-gradient(90deg, rgba(55, 65, 81, 0.1) 1px, transparent 1px);
    background-size: 100% 100%, 100% 100%, 100% 100%, 20px 20px, 20px 20px;
  }
  
  .floating-canvases-layer {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  
  .workspace-empty-state {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: #6b7280;
    max-width: 300px;
    min-width: 100px;
    min-height: 50px;
  }
  
  .primary-btn {
    background: #4f46e5;
    color: white;
    padding: 10px 16px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: background-color 0.2s ease;
  }
  
  .primary-btn:hover {
    background: #6366f1;
  }
  
  
  .placeholder {
    color: #6b7280;
    text-align: center;
    height: 120px; /* Match canvas height */
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .error {
    color: #ef4444;
  }
</style>
