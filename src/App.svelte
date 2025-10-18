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
  import { connectionManager } from './data/ConnectionManager.js';
  
  // Import test runner for development
  import './utils/testRunner.js';

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
    
    // Unsubscribe from ConnectionManager
    connectionManager.unsubscribeCanvas(canvasId);
    
    // Remove from workspace
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


  async function addFloatingCanvas(symbol = null, position = null) {
    // Validate input parameters
    if (symbol && typeof symbol !== 'string') {
      throw new Error(`Symbol must be a string, received ${typeof symbol}: ${JSON.stringify(symbol)}`);
    }
    
    // Use provided symbol or default to first available symbol
    const selectedSymbol = symbol || Object.keys(symbols)[0] || 'SIM-EURUSD';
    const canvasPosition = position || {
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 100
    };
    
    try {
      // Create canvas data with safe defaults
      const canvasData = createCanvasData(selectedSymbol, canvasPosition);
      
      // Subscribe canvas to symbol through ConnectionManager
      const symbolData = await connectionManager.subscribeCanvas(canvasData.id, selectedSymbol);
      
      if (symbolData && symbolData.config && symbolData.state) {
        canvasData.config = { ...symbolData.config };
        canvasData.state = { ...symbolData.state };
      } else {
        // Use safe defaults
        canvasData.config = { ...defaultConfig };
        canvasData.state = {
          ready: false,
          currentPrice: 0,
          projectedAdrHigh: 0,
          projectedAdrLow: 0,
          visualHigh: 0,
          visualLow: 0,
          volatility: 0
        };
      }
      
      // Register and add canvas
      registryActions.registerCanvas(canvasData.id, {
        symbol: selectedSymbol,
        type: 'floating'
      });
      
      workspaceActions.addCanvas(canvasData);
      
      // Set up cleanup for canvas destruction
      canvasData.unsubSymbolStore = () => {
        connectionManager.unsubscribeCanvas(canvasData.id);
      };
      
      return canvasData;
    } catch (error) {
      console.error('Failed to create canvas', { symbol: selectedSymbol, error });
      throw error;
    }
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
  <!-- Background Layer -->
  <div class="main-container">
    <div class="viz-area">
      <div
        bind:this={workspaceElement}
        class="workspace-container"
        class:show-grid={$workspaceState.showGrid}
      >
        <!-- Empty State for Workspace -->
        {#if $workspaceState.canvases.size === 0}
          <div class="workspace-empty-state">
            <!-- Empty state with no text or buttons -->
          </div>
        {/if}
      </div>
    </div>
  </div>
  
  <!-- Floating Panels Layer -->
  <div class="floating-panels-layer">
    <!-- Floating Canvases -->
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
    
    <!-- Floating Symbol Palette -->
    <FloatingSymbolPalette
      on:canvasCreated={async (event) => {
        // Always use the ConnectionManager to create the canvas
        try {
          await addFloatingCanvas(event.detail.symbol, event.detail.position);
        } catch (error) {
          console.error('Failed to create canvas from palette', error);
        }
      }}
    />
    
    <!-- Floating Debug Panel -->
    <FloatingDebugPanel
      on:close={() => uiActions.hideFloatingDebugPanel()}
    />
    
    <!-- Floating System Panel -->
    <FloatingSystemPanel
      on:dataSourceChange={handleDataSourceChange}
    />
    
    <!-- Floating Multi Symbol ADR -->
    <FloatingMultiSymbolADR
      on:close={() => uiActions.hideFloatingADRPanel()}
    />
    
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
  </div>
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
  
  /* Workspace Container for Background */
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
    z-index: 1; /* Reduced from 10 to ensure it's in the background */
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
  
  /* Floating Panels Layer - Contains all floating elements */
  .floating-panels-layer {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1000;
  }
  
  /* Allow pointer events for floating elements */
  .floating-panels-layer > * {
    pointer-events: auto;
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
