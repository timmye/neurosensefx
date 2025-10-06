<script>
  import { onMount } from 'svelte';
  import { workspaceStore, connectionStore, uiStateStore } from './stores/index.js';
  import { WorkspaceManager } from './components/organisms/workspace/WorkspaceManager.svelte';
  import { ConnectionStatusPanel } from './components/organisms/panels/ConnectionStatusPanel.svelte';
  import { ServiceStatusPanel } from './components/organisms/panels/ServiceStatusPanel.svelte';
  import { WorkspaceSettingsPanel } from './components/organisms/panels/WorkspaceSettingsPanel.svelte';
  import { CanvasSettingsPanel } from './components/organisms/panels/CanvasSettingsPanel.svelte';
  import { VisualizationSettingsPanel } from './components/organisms/panels/VisualizationSettingsPanel.svelte';
  import { SymbolSelector } from './components/organisms/SymbolSelector.svelte';
  import { Tabs, Modal, Button, Icon } from './components/organisms/index.js';
  
  // State management
  let workspace;
  let connection;
  let uiState;
  let activePanel = 'workspace';
  let showWelcome = false;
  
  // Panel visibility
  let showConnectionPanel = false;
  let showServicePanel = false;
  let showWorkspacePanel = false;
  let showCanvasPanel = false;
  let showVisualizationPanel = false;
  let showSymbolSelector = false;
  
  // Welcome modal state
  let welcomeStep = 0;
  
  // Store subscriptions
  onMount(() => {
    const unsubscribeWorkspace = workspaceStore.subscribe(ws => {
      workspace = ws;
      
      // Show welcome for first-time users
      if (!ws.layout.canvases || ws.layout.canvases.length === 0) {
        showWelcome = true;
        welcomeStep = 0;
      }
    });
    
    const unsubscribeConnection = connectionStore.subscribe(conn => {
      connection = conn;
    });
    
    const unsubscribeUIState = uiStateStore.subscribe(state => {
      uiState = state;
      activePanel = state.activePanel || 'workspace';
    });
    
    // Initialize default workspace if needed
    initializeWorkspace();
    
    return () => {
      unsubscribeWorkspace();
      unsubscribeConnection();
      unsubscribeUIState();
    };
  });
  
  function initializeWorkspace() {
    let currentWorkspace;
    workspaceStore.subscribe(ws => currentWorkspace = ws)();
    
    // Create default workspace if empty
    if (!currentWorkspace.layout.canvases || currentWorkspace.layout.canvases.length === 0) {
      // Add a default canvas
      workspaceStore.addCanvas({
        name: 'EURUSD Canvas',
        symbol: 'EURUSD',
        position: { x: 50, y: 50 },
        size: { width: 300, height: 200 },
        indicators: ['priceFloat', 'marketProfile', 'volatilityOrb']
      });
    }
  }
  
  // Panel management
  function togglePanel(panelName) {
    switch (panelName) {
      case 'connection':
        showConnectionPanel = !showConnectionPanel;
        break;
      case 'service':
        showServicePanel = !showServicePanel;
        break;
      case 'workspace':
        showWorkspacePanel = !showWorkspacePanel;
        break;
      case 'canvas':
        showCanvasPanel = !showCanvasPanel;
        break;
      case 'visualization':
        showVisualizationPanel = !showVisualizationPanel;
        break;
      case 'symbol':
        showSymbolSelector = !showSymbolSelector;
        break;
    }
  }
  
  function closeAllPanels() {
    showConnectionPanel = false;
    showServicePanel = false;
    showWorkspacePanel = false;
    showCanvasPanel = false;
    showVisualizationPanel = false;
    showSymbolSelector = false;
  }
  
  // Welcome flow
  function nextWelcomeStep() {
    if (welcomeStep < 2) {
      welcomeStep++;
    } else {
      showWelcome = false;
      // Create first canvas
      workspaceStore.addCanvas({
        name: 'My First Canvas',
        symbol: 'EURUSD',
        position: { x: 100, y: 100 },
        size: { width: 300, height: 200 },
        indicators: ['priceFloat']
      });
    }
  }
  
  function skipWelcome() {
    showWelcome = false;
  }
  
  // Keyboard shortcuts
  function handleKeydown(event) {
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case '1':
          event.preventDefault();
          togglePanel('connection');
          break;
        case '2':
          event.preventDefault();
          togglePanel('service');
          break;
        case '3':
          event.preventDefault();
          togglePanel('workspace');
          break;
        case '4':
          event.preventDefault();
          togglePanel('canvas');
          break;
        case '5':
          event.preventDefault();
          togglePanel('visualization');
          break;
        case 's':
          event.preventDefault();
          togglePanel('symbol');
          break;
        case 'w':
          event.preventDefault();
          closeAllPanels();
          break;
      }
    } else {
      switch (event.key) {
        case 'Escape':
          closeAllPanels();
          break;
        case 'F1':
          event.preventDefault();
          showWelcome = true;
          welcomeStep = 0;
          break;
      }
    }
  }
  
  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  });
  
  function getPanelTabs() {
    return [
      {
        id: 'workspace',
        label: 'Workspace',
        icon: 'layout',
        badge: workspace?.layout?.canvases?.length?.toString() || '0'
      },
      {
        id: 'connection',
        label: 'Connection',
        icon: 'wifi',
        badge: connection?.isConnected ? '✓' : '!'
      },
      {
        id: 'performance',
        label: 'Performance',
        icon: 'zap',
        badge: null
      }
    ];
  }
  
  function getWorkspaceStats() {
    const canvases = workspace?.layout?.canvases || [];
    const totalIndicators = canvases.reduce((sum, c) => sum + (c.indicators?.length || 0), 0);
    const visibleCanvases = canvases.filter(c => c.isVisible !== false).length;
    
    return {
      totalCanvases: canvases.length,
      visibleCanvases,
      totalIndicators,
      isConnected: connection?.isConnected || false,
      lastUpdate: connection?.lastUpdate || null
    };
  }
  
  $: stats = getWorkspaceStats();
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="app-container">
  <!-- Main Workspace Area -->
  <div class="main-content">
    <WorkspaceManager />
  </div>
  
  <!-- Left Sidebar - Quick Access -->
  <div class="left-sidebar">
    <div class="sidebar-header">
      <h3>NeuroSense FX</h3>
      <div class="connection-status" class:connected={stats.isConnected}>
        <Icon name="wifi" size="sm" />
      </div>
    </div>
    
    <div class="workspace-stats">
      <div class="stat-item">
        <div class="stat-value">{stats.totalCanvases}</div>
        <div class="stat-label">Canvases</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{stats.totalIndicators}</div>
        <div class="stat-label">Indicators</div>
      </div>
    </div>
    
    <div class="quick-actions">
      <Button
        variant="outline"
        size="sm"
        on:click={() => togglePanel('symbol')}
        className={showSymbolSelector ? 'active' : ''}
      >
        <Icon name="search" size="sm" />
        Symbols
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        on:click={() => togglePanel('connection')}
        className={showConnectionPanel ? 'active' : ''}
      >
        <Icon name="wifi" size="sm" />
        Connection
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        on:click={() => togglePanel('service')}
        className={showServicePanel ? 'active' : ''}
      >
        <Icon name="activity" size="sm" />
        Services
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        on:click={() => togglePanel('workspace')}
        className={showWorkspacePanel ? 'active' : ''}
      >
        <Icon name="settings" size="sm" />
        Workspace
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        on:click={() => togglePanel('canvas')}
        className={showCanvasPanel ? 'active' : ''}
      >
        <Icon name="box" size="sm" />
        Canvas
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        on:click={() => togglePanel('visualization')}
        className={showVisualizationPanel ? 'active' : ''}
      >
        <Icon name="bar-chart" size="sm" />
        Viz Settings
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        on:click={closeAllPanels}
        title="Close all panels (Ctrl+W)"
      >
        <Icon name="x" size="sm" />
        Close All
      </Button>
    </div>
    
    <div class="help-section">
      <Button
        variant="ghost"
        size="xs"
        on:click={() => { showWelcome = true; welcomeStep = 0; }}
        title="Show welcome guide (F1)"
      >
        <Icon name="help-circle" size="xs" />
        Help (F1)
      </Button>
    </div>
  </div>
  
  <!-- Floating Panels -->
  {#if showSymbolSelector}
    <div class="floating-panel symbol-selector">
      <div class="panel-header">
        <h4>Symbol Selector</h4>
        <Button variant="ghost" size="xs" on:click={() => showSymbolSelector = false}>
          <Icon name="x" size="xs" />
        </Button>
      </div>
      <div class="panel-content">
        <SymbolSelector />
      </div>
    </div>
  {/if}
  
  {#if showConnectionPanel}
    <div class="floating-panel connection-panel">
      <div class="panel-header">
        <h4>Connection Status</h4>
        <Button variant="ghost" size="xs" on:click={() => showConnectionPanel = false}>
          <Icon name="x" size="xs" />
        </Button>
      </div>
      <div class="panel-content">
        <ConnectionStatusPanel />
      </div>
    </div>
  {/if}
  
  {#if showServicePanel}
    <div class="floating-panel service-panel">
      <div class="panel-header">
        <h4>Service Status</h4>
        <Button variant="ghost" size="xs" on:click={() => showServicePanel = false}>
          <Icon name="x" size="xs" />
        </Button>
      </div>
      <div class="panel-content">
        <ServiceStatusPanel />
      </div>
    </div>
  {/if}
  
  {#if showWorkspacePanel}
    <div class="floating-panel workspace-panel">
      <div class="panel-header">
        <h4>Workspace Settings</h4>
        <Button variant="ghost" size="xs" on:click={() => showWorkspacePanel = false}>
          <Icon name="x" size="xs" />
        </Button>
      </div>
      <div class="panel-content">
        <WorkspaceSettingsPanel />
      </div>
    </div>
  {/if}
  
  {#if showCanvasPanel}
    <div class="floating-panel canvas-panel">
      <div class="panel-header">
        <h4>Canvas Settings</h4>
        <Button variant="ghost" size="xs" on:click={() => showCanvasPanel = false}>
          <Icon name="x" size="xs" />
        </Button>
      </div>
      <div class="panel-content">
        <CanvasSettingsPanel />
      </div>
    </div>
  {/if}
  
  {#if showVisualizationPanel}
    <div class="floating-panel visualization-panel">
      <div class="panel-header">
        <h4>Visualization Settings</h4>
        <Button variant="ghost" size="xs" on:click={() => showVisualizationPanel = false}>
          <Icon name="x" size="xs" />
        </Button>
      </div>
      <div class="panel-content">
        <VisualizationSettingsPanel />
      </div>
    </div>
  {/if}
</div>

<!-- Welcome Modal -->
<Modal bind:open={showWelcome} title="Welcome to NeuroSense FX" size="md">
  <div class="welcome-content">
    {#if welcomeStep === 0}
      <div class="welcome-step">
        <Icon name="layout" size="lg" />
        <h3>Welcome to Your Trading Workspace</h3>
        <p>NeuroSense FX provides a professional trading interface with real-time market data visualization and advanced workspace management.</p>
        
        <div class="features-list">
          <div class="feature-item">
            <Icon name="box" size="sm" />
            <span>Drag & drop canvas management</span>
          </div>
          <div class="feature-item">
            <Icon name="bar-chart" size="sm" />
            <span>Real-time price visualizations</span>
          </div>
          <div class="feature-item">
            <Icon name="layers" size="sm" />
            <span>Multiple indicator overlays</span>
          </div>
          <div class="feature-item">
            <Icon name="wifi" size="sm" />
            <span>Live market data streaming</span>
          </div>
        </div>
      </div>
    {:else if welcomeStep === 1}
      <div class="welcome-step">
        <Icon name="mouse-pointer" size="lg" />
        <h3>Getting Started</h3>
        <p>Here's how to use your workspace:</p>
        
        <div class="instructions">
          <div class="instruction-item">
            <strong>Create Canvases:</strong> Click "New Canvas" in the toolbar
          </div>
          <div class="instruction-item">
            <strong>Arrange Layout:</strong> Drag canvases to position them
          </div>
          <div class="instruction-item">
            <strong>Add Symbols:</strong> Use the Symbol Selector to add trading pairs
          </div>
          <div class="instruction-item">
            <strong>Customize Indicators:</strong> Toggle indicators on each canvas
          </div>
        </div>
      </div>
    {:else if welcomeStep === 2}
      <div class="welcome-step">
        <Icon name="keyboard" size="lg" />
        <h3>Keyboard Shortcuts</h3>
        <p>Work faster with these shortcuts:</p>
        
        <div class="shortcuts">
          <div class="shortcut-item">
            <kbd>Ctrl+1</kbd> - Connection Panel
          </div>
          <div class="shortcut-item">
            <kbd>Ctrl+2</kbd> - Service Status
          </div>
          <div class="shortcut-item">
            <kbd>Ctrl+3</kbd> - Workspace Settings
          </div>
          <div class="shortcut-item">
            <kbd>Ctrl+S</kbd> - Symbol Selector
          </div>
          <div class="shortcut-item">
            <kbd>Ctrl+W</kbd> - Close All Panels
          </div>
          <div class="shortcut-item">
            <kbd>F1</kbd> - Show Help
          </div>
        </div>
      </div>
    {/if}
  </div>
  
  <div slot="footer" class="welcome-footer">
    <Button variant="outline" on:click={skipWelcome}>
      Skip Tour
    </Button>
    <Button variant="primary" on:click={nextWelcomeStep}>
      {welcomeStep < 2 ? 'Next' : 'Start Trading'}
    </Button>
  </div>
</Modal>

<style>
  .app-container {
    display: flex;
    height: 100vh;
    background: var(--bg-primary);
    position: relative;
    overflow: hidden;
  }
  
  .main-content {
    flex: 1;
    position: relative;
  }
  
  .left-sidebar {
    width: 200px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-default);
    display: flex;
    flex-direction: column;
    padding: var(--space-4);
    gap: var(--space-4);
  }
  
  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--border-default);
  }
  
  .sidebar-header h3 {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .connection-status {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-full);
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .connection-status.connected {
    background: var(--color-success-subtle);
    color: var(--color-success);
  }
  
  .workspace-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }
  
  .stat-item {
    text-align: center;
    padding: var(--space-2);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }
  
  .stat-value {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    color: var(--text-primary);
  }
  
  .stat-label {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    margin-top: var(--space-1);
  }
  
  .quick-actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    flex: 1;
  }
  
  .quick-actions .button.active {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }
  
  .help-section {
    padding-top: var(--space-3);
    border-top: 1px solid var(--border-default);
  }
  
  .floating-panel {
    position: absolute;
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    min-width: 300px;
    max-width: 400px;
  }
  
  .symbol-selector {
    top: 20px;
    right: 20px;
    width: 350px;
  }
  
  .connection-panel {
    top: 20px;
    right: 380px;
    width: 350px;
  }
  
  .service-panel {
    top: 20px;
    right: 740px;
    width: 400px;
  }
  
  .workspace-panel {
    bottom: 20px;
    right: 20px;
    width: 400px;
    max-height: 500px;
  }
  
  .canvas-panel {
    bottom: 20px;
    right: 430px;
    width: 350px;
    max-height: 400px;
  }
  
  .visualization-panel {
    bottom: 20px;
    right: 790px;
    width: 350px;
    max-height: 400px;
  }
  
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border-default);
  }
  
  .panel-header h4 {
    margin: 0;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .panel-content {
    padding: var(--space-4);
    max-height: 400px;
    overflow-y: auto;
  }
  
  .welcome-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-4);
  }
  
  .welcome-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
  }
  
  .welcome-step h3 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .welcome-step p {
    margin: 0;
    color: var(--text-secondary);
    line-height: var(--line-height-relaxed);
  }
  
  .features-list,
  .instructions,
  .shortcuts {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 100%;
    text-align: left;
  }
  
  .feature-item,
  .instruction-item,
  .shortcut-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }
  
  .shortcut-item {
    justify-content: space-between;
  }
  
  kbd {
    background: var(--bg-primary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-2);
    font-family: var(--font-family-mono);
    font-size: var(--font-size-xs);
    color: var(--text-primary);
  }
  
  .welcome-footer {
    display: flex;
    justify-content: space-between;
    width: 100%;
  }
  
  /* Responsive Design */
  @media (max-width: 1200px) {
    .floating-panel {
      position: fixed;
      top: 50% !important;
      left: 50% !important;
      right: auto !important;
      bottom: auto !important;
      transform: translate(-50%, -50%);
      max-width: 90vw;
      max-height: 80vh;
    }
  }
  
  @media (max-width: 768px) {
    .left-sidebar {
      width: 60px;
      padding: var(--space-2);
    }
    
    .sidebar-header h3,
    .workspace-stats,
    .quick-actions .button span,
    .help-section {
      display: none;
    }
    
    .quick-actions {
      gap: var(--space-1);
    }
    
    .quick-actions .button {
      width: 44px;
      height: 44px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
</style>
