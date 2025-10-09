<script>
  import { onMount, createEventDispatcher, setContext } from 'svelte';
  import { workspaceStore, uiStateStore, performanceStore } from '../../../stores/index.js';
  import { Button, Icon, Badge, Input, Toggle, Slider } from '../../atoms/index.js';
  import { CanvasContainer } from './CanvasContainer.svelte';
  import { Modal, Tabs } from '../../organisms/index.js';
  
  const dispatch = createEventDispatcher();
  
  // Reactive store subscriptions
  let workspace;
  let uiState;
  let performance;
  
  // Workspace state
  let selectedCanvases = new Set();
  let isMultiSelectMode = false;
  let isGridView = true;
  let showGridLines = true;
  let workspaceZoom = 1;
  let workspacePan = { x: 0, y: 0 };
  
  // Modal state
  let showCanvasModal = false;
  let showWorkspaceModal = false;
  let showImportModal = false;
  let modalMode = 'create'; // 'create', 'edit', 'duplicate'
  let activeTab = 'canvases';
  
  // Form state
  let canvasForm = {
    name: '',
    symbol: 'EURUSD',
    width: 220,
    height: 120,
    x: 0,
    y: 0
  };
  
  let workspaceForm = {
    name: '',
    description: '',
    template: 'blank'
  };
  
  // Drag state
  let dragState = {
    isDragging: false,
    draggedCanvas: null,
    dragOffset: { x: 0, y: 0 },
    originalPositions: new Map()
  };
  
  // Performance monitoring
  let workspaceMetrics = {
    totalCanvases: 0,
    activeCanvases: 0,
    totalIndicators: 0,
    memoryUsage: 0,
    renderTime: 0
  };
  
  // Templates
  const workspaceTemplates = [
    {
      id: 'blank',
      name: 'Blank Workspace',
      description: 'Start with a clean workspace',
      icon: 'file',
      canvases: []
    },
    {
      id: 'day-trading',
      name: 'Day Trading',
      description: 'Optimized for day trading workflows',
      icon: 'trending-up',
      canvases: [
        { symbol: 'EURUSD', x: 0, y: 0, width: 300, height: 200 },
        { symbol: 'GBPUSD', x: 320, y: 0, width: 300, height: 200 },
        { symbol: 'USDJPY', x: 0, y: 220, width: 300, height: 200 }
      ]
    },
    {
      id: 'multi-timeframe',
      name: 'Multi-Timeframe',
      description: 'Multiple timeframes for primary symbol',
      icon: 'layers',
      canvases: [
        { symbol: 'EURUSD', x: 0, y: 0, width: 250, height: 150 },
        { symbol: 'EURUSD', x: 270, y: 0, width: 250, height: 150 },
        { symbol: 'EURUSD', x: 540, y: 0, width: 250, height: 150 },
        { symbol: 'EURUSD', x: 0, y: 170, width: 400, height: 250 },
        { symbol: 'EURUSD', x: 420, y: 170, width: 370, height: 250 }
      ]
    },
    {
      id: 'portfolio',
      name: 'Portfolio View',
      description: 'Monitor multiple currency pairs',
      icon: 'briefcase',
      canvases: [
        { symbol: 'EURUSD', x: 0, y: 0, width: 200, height: 150 },
        { symbol: 'GBPUSD', x: 220, y: 0, width: 200, height: 150 },
        { symbol: 'USDJPY', x: 440, y: 0, width: 200, height: 150 },
        { symbol: 'AUDUSD', x: 660, y: 0, width: 200, height: 150 },
        { symbol: 'USDCAD', x: 0, y: 170, width: 200, height: 150 },
        { symbol: 'EURGBP', x: 220, y: 170, width: 200, height: 150 },
        { symbol: 'EURJPY', x: 440, y: 170, width: 200, height: 150 },
        { symbol: 'GBPJPY', x: 660, y: 170, width: 200, height: 150 }
      ]
    }
  ];
  
  const commonSymbols = [
    'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD',
    'EURGBP', 'EURJPY', 'GBPJPY', 'NZDUSD', 'USDCHF'
  ];
  
  // Store subscriptions
  onMount(() => {
    const unsubscribeWorkspace = workspaceStore.subscribe(ws => {
      workspace = ws;
      updateWorkspaceMetrics();
    });
    
    const unsubscribeUIState = uiStateStore.subscribe(state => {
      uiState = state;
    });
    
    const unsubscribePerformance = performanceStore.subscribe(perf => {
      performance = perf;
      updatePerformanceMetrics();
    });
    
    // Set up keyboard shortcuts
    const handleKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'a':
            event.preventDefault();
            selectAllCanvases();
            break;
          case 'd':
            event.preventDefault();
            duplicateSelectedCanvases();
            break;
          case 'g':
            event.preventDefault();
            toggleGridView();
            break;
        }
      } else {
        switch (event.key) {
          case 'Delete':
          case 'Backspace':
            deleteSelectedCanvases();
            break;
          case 'Escape':
            clearSelection();
            break;
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      unsubscribeWorkspace();
      unsubscribeUIState();
      unsubscribePerformance();
      document.removeEventListener('keydown', handleKeyDown);
    };
  });
  
  function updateWorkspaceMetrics() {
    if (!workspace?.layout?.canvases) return;
    
    const canvases = workspace.layout.canvases;
    workspaceMetrics.totalCanvases = canvases.length;
    workspaceMetrics.activeCanvases = canvases.filter(c => c.isVisible !== false).length;
    workspaceMetrics.totalIndicators = canvases.reduce((sum, c) => sum + (c.indicators?.length || 0), 0);
  }
  
  function updatePerformanceMetrics() {
    if (!performance) return;
    
    workspaceMetrics.memoryUsage = performance.memoryUsage || 0;
    workspaceMetrics.renderTime = performance.renderTime || 0;
  }
  
  // Canvas management
  function createCanvas(config = {}) {
    const canvas = {
      id: `canvas_${Date.now()}`,
      name: config.name || `${config.symbol || 'EURUSD'} Canvas`,
      symbol: config.symbol || 'EURUSD',
      position: { x: config.x || 0, y: config.y || 0 },
      size: { width: config.width || 220, height: config.height || 120 },
      settings: {},
      indicators: ['priceFloat', 'marketProfile'],
      isVisible: true,
      zIndex: workspace?.layout?.canvases?.length || 0,
      ...config
    };
    
    workspaceStore.addCanvas(canvas);
    dispatch('canvasCreated', { canvas });
    
    return canvas;
  }
  
  function updateCanvas(canvasId, updates) {
    workspaceStore.updateCanvas(canvasId, updates);
    dispatch('canvasUpdated', { canvasId, updates });
  }
  
  function deleteCanvas(canvasId) {
    workspaceStore.removeCanvas(canvasId);
    selectedCanvases.delete(canvasId);
    dispatch('canvasDeleted', { canvasId });
  }
  
  function duplicateCanvas(canvas) {
    const duplicate = {
      ...canvas,
      id: `canvas_${Date.now()}`,
      name: `${canvas.name} (Copy)`,
      position: {
        x: canvas.position.x + 20,
        y: canvas.position.y + 20
      },
      zIndex: (workspace?.layout?.canvases?.length || 0)
    };
    
    workspaceStore.addCanvas(duplicate);
    dispatch('canvasDuplicated', { original: canvas, duplicate });
  }
  
  // Selection management
  function selectCanvas(canvasId, event) {
    if (event?.ctrlKey || event?.metaKey) {
      // Multi-select
      if (selectedCanvases.has(canvasId)) {
        selectedCanvases.delete(canvasId);
      } else {
        selectedCanvases.add(canvasId);
      }
    } else {
      // Single select
      selectedCanvases.clear();
      selectedCanvases.add(canvasId);
    }
    
    selectedCanvases = new Set(selectedCanvases);
    dispatch('selectionChanged', { selectedCanvases: Array.from(selectedCanvases) });
  }
  
  function selectAllCanvases() {
    if (!workspace?.layout?.canvases) return;
    
    selectedCanvases.clear();
    workspace.layout.canvases.forEach(canvas => {
      selectedCanvases.add(canvas.id);
    });
    selectedCanvases = new Set(selectedCanvases);
    dispatch('selectionChanged', { selectedCanvases: Array.from(selectedCanvases) });
  }
  
  function clearSelection() {
    selectedCanvases.clear();
    selectedCanvases = new Set(selectedCanvases);
    dispatch('selectionChanged', { selectedCanvases: [] });
  }
  
  function deleteSelectedCanvases() {
    if (selectedCanvases.size === 0) return;
    
    const canvasIds = Array.from(selectedCanvases);
    canvasIds.forEach(id => deleteCanvas(id));
    dispatch('canvasesDeleted', { canvasIds });
  }
  
  function duplicateSelectedCanvases() {
    if (selectedCanvases.size === 0) return;
    
    const selectedCanvasObjects = workspace.layout.canvases.filter(c => 
      selectedCanvases.has(c.id)
    );
    
    selectedCanvasObjects.forEach(canvas => duplicateCanvas(canvas));
    dispatch('canvasesDuplicated', { canvases: selectedCanvasObjects });
  }
  
  // Drag and drop
  function handleCanvasMouseDown(canvas, event) {
    if (event.button !== 0) return; // Only left click
    
    const canvasElement = event.currentTarget;
    const rect = canvasElement.getBoundingClientRect();
    
    dragState = {
      isDragging: true,
      draggedCanvas: canvas,
      dragOffset: {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      },
      originalPositions: new Map()
    };
    
    // Store original positions for all selected canvases
    workspace.layout.canvases.forEach(c => {
      if (selectedCanvases.has(c.id)) {
        dragState.originalPositions.set(c.id, { ...c.position });
      }
    });
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    event.preventDefault();
  }
  
  function handleMouseMove(event) {
    if (!dragState.isDragging) return;
    
    const workspaceElement = document.querySelector('.workspace-area');
    if (!workspaceElement) return;
    
    const rect = workspaceElement.getBoundingClientRect();
    const newX = (event.clientX - rect.left - dragState.dragOffset.x) / workspaceZoom - workspacePan.x;
    const newY = (event.clientY - rect.top - dragState.dragOffset.y) / workspaceZoom - workspacePan.y;
    
    // Update dragged canvas position
    const updates = { position: { x: newX, y: newY } };
    updateCanvas(dragState.draggedCanvas.id, updates);
    
    // Update other selected canvases
    const deltaX = newX - dragState.originalPositions.get(dragState.draggedCanvas.id).x;
    const deltaY = newY - dragState.originalPositions.get(dragState.draggedCanvas.id).y;
    
    selectedCanvases.forEach(canvasId => {
      if (canvasId !== dragState.draggedCanvas.id) {
        const originalPos = dragState.originalPositions.get(canvasId);
        if (originalPos) {
          updateCanvas(canvasId, {
            position: {
              x: originalPos.x + deltaX,
              y: originalPos.y + deltaY
            }
          });
        }
      }
    });
  }
  
  function handleMouseUp() {
    if (dragState.isDragging) {
      dragState.isDragging = false;
      dragState.draggedCanvas = null;
      dragState.originalPositions.clear();
    }
    
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }
  
  // Workspace management
  function createWorkspaceFromTemplate(templateId) {
    const template = workspaceTemplates.find(t => t.id === templateId);
    if (!template) return;
    
    // Create new workspace
    const workspaceId = workspaceStore.createWorkspace({
      name: workspaceForm.name || template.name,
      description: workspaceForm.description || template.description
    });
    
    // Add template canvases
    template.canvases.forEach(canvasConfig => {
      createCanvas(canvasConfig);
    });
    
    showWorkspaceModal = false;
    dispatch('workspaceCreated', { template, workspaceId });
  }
  
  function saveWorkspace() {
    workspaceStore.export();
    dispatch('workspaceSaved');
  }
  
  function loadWorkspace() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            workspaceStore.import(e.target.result);
            dispatch('workspaceLoaded');
          } catch (error) {
            console.error('Failed to load workspace:', error);
            dispatch('workspaceLoadError', { error });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }
  
  function resetWorkspace() {
    if (confirm('Are you sure you want to reset the workspace? This will remove all canvases.')) {
      workspaceStore.reset();
      selectedCanvases.clear();
      selectedCanvases = new Set(selectedCanvases);
      dispatch('workspaceReset');
    }
  }
  
  // View controls
  function toggleGridView() {
    isGridView = !isGridView;
    dispatch('viewModeChanged', { isGridView });
  }
  
  function zoomIn() {
    workspaceZoom = Math.min(workspaceZoom * 1.2, 3);
    dispatch('zoomChanged', { zoom: workspaceZoom });
  }
  
  function zoomOut() {
    workspaceZoom = Math.max(workspaceZoom / 1.2, 0.3);
    dispatch('zoomChanged', { zoom: workspaceZoom });
  }
  
  function resetZoom() {
    workspaceZoom = 1;
    workspacePan = { x: 0, y: 0 };
    dispatch('viewReset');
  }
  
  function fitToScreen() {
    if (!workspace?.layout?.canvases?.length) return;
    
    const canvases = workspace.layout.canvases;
    const minX = Math.min(...canvases.map(c => c.position.x));
    const minY = Math.min(...canvases.map(c => c.position.y));
    const maxX = Math.max(...canvases.map(c => c.position.x + c.size.width));
    const maxY = Math.max(...canvases.map(c => c.position.y + c.size.height));
    
    const workspaceElement = document.querySelector('.workspace-area');
    if (!workspaceElement) return;
    
    const rect = workspaceElement.getBoundingClientRect();
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    const scaleX = rect.width / (contentWidth + 100);
    const scaleY = rect.height / (contentHeight + 100);
    workspaceZoom = Math.min(scaleX, scaleY, 1);
    
    workspacePan = {
      x: -(minX * workspaceZoom) + (rect.width - contentWidth * workspaceZoom) / 2,
      y: -(minY * workspaceZoom) + (rect.height - contentHeight * workspaceZoom) / 2
    };
    
    dispatch('fitToScreen');
  }
  
  function getTabItems() {
    return [
      {
        id: 'canvases',
        label: 'Canvases',
        badge: workspaceMetrics.totalCanvases.toString(),
        icon: 'box'
      },
      {
        id: 'performance',
        label: 'Performance',
        badge: workspaceMetrics.renderTime > 16 ? '!' : null,
        icon: 'zap'
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: 'settings'
      }
    ];
  }
  
  function getSelectedCanvasIds() {
    return Array.from(selectedCanvases);
  }
</script>

<div class="workspace-manager">
  <!-- Toolbar -->
  <div class="workspace-toolbar">
    <div class="toolbar-section">
      <div class="toolbar-group">
        <Button
          variant="primary"
          size="sm"
          on:click={() => { modalMode = 'create'; showCanvasModal = true; }}
        >
          <Icon name="plus" size="sm" />
          New Canvas
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          on:click={() => { modalMode = 'create'; showWorkspaceModal = true; }}
        >
          <Icon name="layout" size="sm" />
          New Workspace
        </Button>
      </div>
      
      <div class="toolbar-group">
        <Button
          variant="ghost"
          size="sm"
          on:click={loadWorkspace}
          title="Load workspace"
        >
          <Icon name="upload" size="sm" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          on:click={saveWorkspace}
          title="Save workspace"
        >
          <Icon name="download" size="sm" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          on:click={resetWorkspace}
          title="Reset workspace"
        >
          <Icon name="trash-2" size="sm" />
        </Button>
      </div>
    </div>
    
    <div class="toolbar-section">
      <div class="toolbar-group">
        <Button
          variant={isGridView ? "default" : "ghost"}
          size="sm"
          on:click={toggleGridView}
          title="Toggle grid view"
        >
          <Icon name="grid" size="sm" />
        </Button>
        
        <Toggle
          bind:checked={showGridLines}
          size="sm"
          on:change={() => dispatch('gridLinesToggled', { show: showGridLines })}
          title="Show grid lines"
        />
      </div>
      
      <div class="toolbar-group">
        <Button
          variant="ghost"
          size="sm"
          on:click={zoomOut}
          title="Zoom out"
        >
          <Icon name="zoom-out" size="sm" />
        </Button>
        
        <div class="zoom-display">
          {Math.round(workspaceZoom * 100)}%
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          on:click={zoomIn}
          title="Zoom in"
        >
          <Icon name="zoom-in" size="sm" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          on:click={resetZoom}
          title="Reset zoom"
        >
          <Icon name="maximize-2" size="sm" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          on:click={fitToScreen}
          title="Fit to screen"
        >
          <Icon name="maximize" size="sm" />
        </Button>
      </div>
    </div>
    
    <div class="toolbar-section">
      <div class="workspace-metrics">
        <Badge variant="outline" size="xs">
          {workspaceMetrics.totalCanvases} canvases
        </Badge>
        <Badge variant="outline" size="xs">
          {workspaceMetrics.totalIndicators} indicators
        </Badge>
        <Badge variant={workspaceMetrics.renderTime > 16 ? "warning" : "outline"} size="xs">
          {workspaceMetrics.renderTime}ms
        </Badge>
      </div>
    </div>
  </div>
  
  <!-- Workspace Area -->
  <div class="workspace-container">
    <div 
      class="workspace-area"
      class:grid-view={isGridView}
      style="transform: scale({workspaceZoom}) translate({workspacePan.x}px, {workspacePan.y}px);"
    >
      {#if showGridLines}
        <div class="grid-overlay"></div>
      {/if}
      
      {#if workspace?.layout?.canvases}
        {#each workspace.layout.canvases as canvas (canvas.id)}
          <div
            class="canvas-wrapper"
            class:selected={selectedCanvases.has(canvas.id)}
            style="left: {canvas.position.x}px; top: {canvas.position.y}px; width: {canvas.size.width}px; height: {canvas.size.height}px; z-index: {canvas.zIndex};"
            on:mousedown={(e) => handleCanvasMouseDown(canvas, e)}
            on:click={(e) => selectCanvas(canvas.id, e)}
          >
            <CanvasContainer
              {canvas}
              bind:selected={selectedCanvases}
              on:canvasUpdate={(e) => updateCanvas(canvas.id, e.detail)}
              on:canvasDelete={() => deleteCanvas(canvas.id)}
              on:canvasDuplicate={() => duplicateCanvas(canvas)}
            />
            
            {#if selectedCanvases.has(canvas.id)}
              <div class="selection-border"></div>
            {/if}
          </div>
        {/each}
      {/if}
      
      {#if !workspace?.layout?.canvases?.length}
        <div class="empty-workspace">
          <Icon name="box" size="lg" variant="muted" />
          <h3>No Canvases Yet</h3>
          <p>Create your first canvas to get started with your trading workspace.</p>
          <Button
            variant="primary"
            on:click={() => { modalMode = 'create'; showCanvasModal = true; }}
          >
            <Icon name="plus" size="sm" />
            Create Canvas
          </Button>
        </div>
      {/if}
    </div>
  </div>
  
  <!-- Side Panel -->
  <div class="workspace-sidepanel">
    <Tabs
      items={getTabItems()}
      bind:activeTab={activeTab}
      variant="sidebar"
    />
    
    <div class="sidepanel-content">
      {#if activeTab === 'canvases'}
        <div class="canvases-panel">
          <h4>Canvas Management</h4>
          
          {#if selectedCanvases.size > 0}
            <div class="selection-controls">
              <p>Selected: {selectedCanvases.size} canvas(es)</p>
              <div class="selection-actions">
                <Button
                  variant="outline"
                  size="xs"
                  on:click={duplicateSelectedCanvases}
                >
                  <Icon name="copy" size="xs" />
                  Duplicate
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  on:click={deleteSelectedCanvases}
                >
                  <Icon name="trash-2" size="xs" />
                  Delete
                </Button>
              </div>
            </div>
          {/if}
          
          <div class="canvas-list">
            {#each workspace?.layout?.canvases || [] as canvas}
              <div 
                class="canvas-list-item"
                class:selected={selectedCanvases.has(canvas.id)}
                on:click={() => selectCanvas(canvas.id)}
              >
                <div class="canvas-info">
                  <Icon name="box" size="sm" />
                  <div>
                    <div class="canvas-name">{canvas.name}</div>
                    <div class="canvas-details">{canvas.symbol} • {canvas.indicators?.length || 0} indicators</div>
                  </div>
                </div>
                <div class="canvas-actions">
                  <Button
                    variant="ghost"
                    size="xs"
                    on:click={() => duplicateCanvas(canvas)}
                    title="Duplicate canvas"
                  >
                    <Icon name="copy" size="xs" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    on:click={() => deleteCanvas(canvas.id)}
                    title="Delete canvas"
                  >
                    <Icon name="trash-2" size="xs" />
                  </Button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {:else if activeTab === 'performance'}
        <div class="performance-panel">
          <h4>Performance Metrics</h4>
          
          <div class="metric-grid">
            <div class="metric-item">
              <div class="metric-label">Total Canvases</div>
              <div class="metric-value">{workspaceMetrics.totalCanvases}</div>
            </div>
            
            <div class="metric-item">
              <div class="metric-label">Active Canvases</div>
              <div class="metric-value">{workspaceMetrics.activeCanvases}</div>
            </div>
            
            <div class="metric-item">
              <div class="metric-label">Total Indicators</div>
              <div class="metric-value">{workspaceMetrics.totalIndicators}</div>
            </div>
            
            <div class="metric-item">
              <div class="metric-label">Render Time</div>
              <div class="metric-value" class:warning={workspaceMetrics.renderTime > 16}>
                {workspaceMetrics.renderTime}ms
              </div>
            </div>
            
            <div class="metric-item">
              <div class="metric-label">Memory Usage</div>
              <div class="metric-value">{workspaceMetrics.memoryUsage}%</div>
            </div>
            
            <div class="metric-item">
              <div class="metric-label">Zoom Level</div>
              <div class="metric-value">{Math.round(workspaceZoom * 100)}%</div>
            </div>
          </div>
          
          {#if workspaceMetrics.renderTime > 16}
            <div class="performance-warning">
              <Icon name="alert-triangle" size="sm" variant="warning" />
              <span>High render time detected. Consider reducing canvas count or disabling animations.</span>
            </div>
          {/if}
        </div>
      {:else if activeTab === 'settings'}
        <div class="settings-panel">
          <h4>Workspace Settings</h4>
          
          <div class="setting-group">
            <label>Grid Display</label>
            <Toggle
              bind:checked={showGridLines}
              on:change={() => dispatch('gridLinesToggled', { show: showGridLines })}
            />
          </div>
          
          <div class="setting-group">
            <label>View Mode</label>
            <Button
              variant={isGridView ? "default" : "outline"}
              size="sm"
              on:click={toggleGridView}
            >
              <Icon name="grid" size="sm" />
              {isGridView ? 'Grid View' : 'Free View'}
            </Button>
          </div>
          
          <div class="setting-group">
            <label>Auto-save</label>
              <Toggle
                checked={workspace?.globalSettings?.autoSave || false}
                on:change={(v) => workspaceStore.updateGlobalSettings({ autoSave: v.detail })}
              />
          </div>
          
          <div class="setting-group">
            <label>Performance Mode</label>
            <Toggle
              bind:checked={workspace?.globalSettings?.enablePerformanceMode}
              on:change={(v) => workspaceStore.updateGlobalSettings({ enablePerformanceMode: v })}
            />
          </div>
        </div>
      {/if}
    </div>
  </div>
  
  <!-- Canvas Modal -->
  <Modal
    bind:open={showCanvasModal}
    title={modalMode === 'create' ? 'Create New Canvas' : 'Edit Canvas'}
    size="md"
  >
    <div class="canvas-form">
      <div class="form-group">
        <label for="canvas-name">Canvas Name</label>
        <Input
          id="canvas-name"
          bind:value={canvasForm.name}
          placeholder="Enter canvas name"
        />
      </div>
      
      <div class="form-group">
        <label for="canvas-symbol">Symbol</label>
        <select bind:value={canvasForm.symbol} class="select-input">
          {#each commonSymbols as symbol}
            <option value={symbol}>{symbol}</option>
          {/each}
        </select>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label for="canvas-width">Width (px)</label>
          <Input
            id="canvas-width"
            type="number"
            bind:value={canvasForm.width}
            min="100"
            max="800"
          />
        </div>
        
        <div class="form-group">
          <label for="canvas-height">Height (px)</label>
          <Input
            id="canvas-height"
            type="number"
            bind:value={canvasForm.height}
            min="80"
            max="600"
          />
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label for="canvas-x">X Position</label>
          <Input
            id="canvas-x"
            type="number"
            bind:value={canvasForm.x}
          />
        </div>
        
        <div class="form-group">
          <label for="canvas-y">Y Position</label>
          <Input
            id="canvas-y"
            type="number"
            bind:value={canvasForm.y}
          />
        </div>
      </div>
    </div>
    
    <div slot="footer" class="modal-footer">
      <Button variant="outline" on:click={() => showCanvasModal = false}>
        Cancel
      </Button>
      <Button 
        variant="primary" 
        on:click={() => {
          createCanvas(canvasForm);
          showCanvasModal = false;
          canvasForm = {
            name: '',
            symbol: 'EURUSD',
            width: 220,
            height: 120,
            x: 0,
            y: 0
          };
        }}
      >
        Create Canvas
      </Button>
    </div>
  </Modal>
  
  <!-- Workspace Modal -->
  <Modal
    bind:open={showWorkspaceModal}
    title="Create New Workspace"
    size="lg"
  >
    <div class="workspace-form">
      <div class="form-group">
        <label for="workspace-name">Workspace Name</label>
        <Input
          id="workspace-name"
          bind:value={workspaceForm.name}
          placeholder="Enter workspace name"
        />
      </div>
      
      <div class="form-group">
        <label for="workspace-description">Description</label>
        <Input
          id="workspace-description"
          bind:value={workspaceForm.description}
          placeholder="Enter workspace description"
        />
      </div>
      
      <div class="form-group">
        <label>Choose Template</label>
        <div class="template-grid">
          {#each workspaceTemplates as template}
            <div 
              class="template-card"
              class:selected={workspaceForm.template === template.id}
              on:click={() => workspaceForm.template = template.id}
            >
              <Icon name={template.icon} size="lg" />
              <h5>{template.name}</h5>
              <p>{template.description}</p>
              <Badge variant="outline" size="xs">
                {template.canvases.length} canvases
              </Badge>
            </div>
          {/each}
        </div>
      </div>
    </div>
    
    <div slot="footer" class="modal-footer">
      <Button variant="outline" on:click={() => showWorkspaceModal = false}>
        Cancel
      </Button>
      <Button 
        variant="primary" 
        on:click={() => createWorkspaceFromTemplate(workspaceForm.template)}
      >
        Create Workspace
      </Button>
    </div>
  </Modal>
</div>

<style>
  .workspace-manager {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--bg-primary);
  }
  
  .workspace-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-default);
    gap: var(--space-4);
  }
  
  .toolbar-section {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }
  
  .toolbar-group {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .workspace-metrics {
    display: flex;
    gap: var(--space-2);
  }
  
  .zoom-display {
    min-width: 50px;
    text-align: center;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    color: var(--text-secondary);
  }
  
  .workspace-container {
    flex: 1;
    display: flex;
    overflow: hidden;
  }
  
  .workspace-area {
    flex: 1;
    position: relative;
    overflow: auto;
    background: var(--bg-tertiary);
    transform-origin: 0 0;
    transition: transform 0.2s ease;
  }
  
  .workspace-area.grid-view {
    background-image: 
      linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    background-size: 20px 20px;
  }
  
  .grid-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: 
      linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
    background-size: 50px 50px;
    pointer-events: none;
  }
  
  .canvas-wrapper {
    position: absolute;
    cursor: move;
    user-select: none;
  }
  
  .canvas-wrapper:hover {
    z-index: 1000;
  }
  
  .canvas-wrapper.selected {
    z-index: 1001;
  }
  
  .selection-border {
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    border: 2px solid var(--color-primary);
    border-radius: var(--radius-sm);
    pointer-events: none;
  }
  
  .empty-workspace {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: var(--text-secondary);
    gap: var(--space-4);
  }
  
  .empty-workspace h3 {
    margin: 0;
    font-size: var(--font-size-lg);
    color: var(--text-primary);
  }
  
  .workspace-sidepanel {
    width: 300px;
    background: var(--bg-secondary);
    border-left: 1px solid var(--border-default);
    display: flex;
    flex-direction: column;
  }
  
  .sidepanel-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-4);
  }
  
  .canvases-panel h4,
  .performance-panel h4,
  .settings-panel h4 {
    margin: 0 0 var(--space-4) 0;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .selection-controls {
    padding: var(--space-3);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-4);
  }
  
  .selection-controls p {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
  
  .selection-actions {
    display: flex;
    gap: var(--space-2);
  }
  
  .canvas-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .canvas-list-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .canvas-list-item:hover {
    background: var(--bg-primary);
    border-color: var(--border-hover);
  }
  
  .canvas-list-item.selected {
    background: var(--color-primary-subtle);
    border-color: var(--color-primary);
  }
  
  .canvas-info {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .canvas-name {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
  }
  
  .canvas-details {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }
  
  .canvas-actions {
    display: flex;
    gap: var(--space-1);
  }
  
  .metric-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  
  .metric-item {
    padding: var(--space-3);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    text-align: center;
  }
  
  .metric-label {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    margin-bottom: var(--space-1);
  }
  
  .metric-value {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .metric-value.warning {
    color: var(--color-warning);
  }
  
  .performance-warning {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--color-warning-subtle);
    border: 1px solid var(--color-warning);
    border-radius: var(--radius-md);
    color: var(--color-warning);
    font-size: var(--font-size-sm);
  }
  
  .setting-group {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--border-subtle);
  }
  
  .setting-group:last-child {
    border-bottom: none;
  }
  
  .canvas-form,
  .workspace-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }
  
  .form-group label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
  }
  
  .select-input {
    padding: var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: var(--font-size-sm);
  }
  
  .template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-3);
  }
  
  .template-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: var(--space-4);
    background: var(--bg-tertiary);
    border: 2px solid var(--border-default);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-snappy);
    gap: var(--space-2);
  }
  
  .template-card:hover {
    background: var(--bg-primary);
    border-color: var(--border-hover);
  }
  
  .template-card.selected {
    background: var(--color-primary-subtle);
    border-color: var(--color-primary);
  }
  
  .template-card h5 {
    margin: 0;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .template-card p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
  
  /* Responsive Design */
  @media (max-width: 1024px) {
    .workspace-sidepanel {
      width: 250px;
    }
    
    .metric-grid {
      grid-template-columns: 1fr;
    }
    
    .template-grid {
      grid-template-columns: 1fr;
    }
  }
  
  @media (max-width: 768px) {
    .workspace-toolbar {
      flex-direction: column;
      gap: var(--space-3);
    }
    
    .toolbar-section {
      width: 100%;
      justify-content: space-between;
    }
    
    .workspace-sidepanel {
      display: none;
    }
    
    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>
