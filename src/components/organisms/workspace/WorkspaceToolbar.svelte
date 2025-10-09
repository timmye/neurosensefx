<script>
  import { createEventDispatcher } from 'svelte';
  import { workspaceStore, uiStateStore } from '../../../stores/index.js';
  import { Button } from '../../atoms/index.js';
  import { Icon } from '../../atoms/index.js';
  
  const dispatch = createEventDispatcher();
  
  // Toolbar state
  let isCompact = false;
  let activeTool = 'select';
  let showGrid = true;
  let snapToGrid = true;
  
  // Available tools
  const tools = [
    { id: 'select', name: 'Select', icon: 'mouse-pointer' },
    { id: 'pan', name: 'Pan', icon: 'hand' },
    { id: 'add-canvas', name: 'Add Canvas', icon: 'plus' },
    { id: 'delete', name: 'Delete', icon: 'trash-2' },
    { id: 'duplicate', name: 'Duplicate', icon: 'copy' }
  ];
  
  // Layout presets
  const layoutPresets = [
    { id: 'day-trading', name: 'Day Trading', icon: 'layout-grid' },
    { id: 'swing-trading', name: 'Swing Trading', icon: 'layout-dashboard' },
    { id: 'scalping', name: 'Scalping', icon: 'layout-list' },
    { id: 'custom', name: 'Custom', icon: 'settings' }
  ];
  
  // View options
  const viewOptions = [
    { id: 'zoom-in', name: 'Zoom In', icon: 'zoom-in' },
    { id: 'zoom-out', name: 'Zoom Out', icon: 'zoom-out' },
    { id: 'zoom-fit', name: 'Fit to Screen', icon: 'maximize-2' },
    { id: 'zoom-actual', name: 'Actual Size', icon: 'maximize' }
  ];
  
  // Handle tool selection
  function handleToolSelect(toolId) {
    activeTool = toolId;
    
    switch (toolId) {
      case 'add-canvas':
        addNewCanvas();
        break;
      case 'delete':
        deleteSelectedCanvases();
        break;
      case 'duplicate':
        duplicateSelectedCanvases();
        break;
      default:
        dispatch('toolChanged', { tool: toolId });
    }
  }
  
  // Add new canvas
  function addNewCanvas() {
    const workspace = workspaceStore.get();
    const newCanvas = {
      id: `canvas_${Date.now()}`,
      symbol: 'EURUSD',
      position: { x: 50, y: 50 },
      size: { width: 220, height: 120 },
      settings: {},
      indicators: ['priceFloat', 'marketProfile', 'volatilityOrb'],
      isVisible: true,
      zIndex: workspace.layout.canvases.length
    };
    
    workspaceStore.addCanvas(newCanvas);
    dispatch('canvasAdded', { canvas: newCanvas });
  }
  
  // Delete selected canvases
  function deleteSelectedCanvases() {
    const selectedCanvases = workspaceStore.getSelectedCanvases();
    selectedCanvases.forEach(canvas => {
      workspaceStore.removeCanvas(canvas.id);
    });
    dispatch('canvasesDeleted', { canvases: selectedCanvases });
  }
  
  // Duplicate selected canvases
  function duplicateSelectedCanvases() {
    const selectedCanvases = workspaceStore.getSelectedCanvases();
    const duplicatedCanvases = [];
    
    selectedCanvases.forEach(canvas => {
      const newCanvas = {
        ...canvas,
        id: `canvas_${Date.now()}_${Math.random()}`,
        position: {
          x: canvas.position.x + 20,
          y: canvas.position.y + 20
        }
      };
      workspaceStore.addCanvas(newCanvas);
      duplicatedCanvases.push(newCanvas);
    });
    
    dispatch('canvasesDuplicated', { 
      original: selectedCanvases, 
      duplicated: duplicatedCanvases 
    });
  }
  
  // Handle layout preset selection
  function handleLayoutPreset(presetId) {
    dispatch('layoutPresetChanged', { preset: presetId });
    
    // Apply preset logic would go here
    // For now, just dispatch the event
  }
  
  // Handle view option selection
  function handleViewOption(optionId) {
    switch (optionId) {
      case 'zoom-in':
        dispatch('zoomChanged', { delta: 0.1 });
        break;
      case 'zoom-out':
        dispatch('zoomChanged', { delta: -0.1 });
        break;
      case 'zoom-fit':
        dispatch('zoomFit');
        break;
      case 'zoom-actual':
        dispatch('zoomActual');
        break;
    }
  }
  
  // Toggle grid
  function toggleGrid() {
    showGrid = !showGrid;
    dispatch('gridToggled', { visible: showGrid });
  }
  
  // Toggle snap to grid
  function toggleSnapToGrid() {
    snapToGrid = !snapToGrid;
    dispatch('snapToGridToggled', { enabled: snapToGrid });
  }
  
  // Toggle compact mode
  function toggleCompact() {
    isCompact = !isCompact;
    dispatch('compactModeToggled', { compact: isCompact });
  }
  
  // Export workspace
  function exportWorkspace() {
    const workspaceData = workspaceStore.export();
    const blob = new Blob([workspaceData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workspace_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    dispatch('workspaceExported');
  }
  
  // Import workspace
  function importWorkspace() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            workspaceStore.import(e.target.result);
            dispatch('workspaceImported');
          } catch (error) {
            dispatch('workspaceImportError', { error });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }
</script>

<div class="workspace-toolbar" class:compact={isCompact}>
  <!-- Tools Section -->
  <div class="toolbar-section">
    <div class="section-title">
      <Icon name="tool" size="sm" />
      <span class:hide-in-compact={!isCompact}>Tools</span>
    </div>
    <div class="toolbar-group">
      {#each tools as tool}
        <Button
          variant={activeTool === tool.id ? 'primary' : 'ghost'}
          size={isCompact ? 'sm' : 'md'}
          onClick={() => handleToolSelect(tool.id)}
          title={tool.name}
        >
          <Icon name={tool.icon} size={isCompact ? 'xs' : 'sm'} />
          {#if !isCompact}
            <span>{tool.name}</span>
          {/if}
        </Button>
      {/each}
    </div>
  </div>
  
  <!-- Layout Section -->
  <div class="toolbar-section">
    <div class="section-title">
      <Icon name="layout" size="sm" />
      <span class:hide-in-compact={!isCompact}>Layout</span>
    </div>
    <div class="toolbar-group">
      {#each layoutPresets as preset}
        <Button
          variant="ghost"
          size={isCompact ? 'sm' : 'md'}
          onClick={() => handleLayoutPreset(preset.id)}
          title={preset.name}
        >
          <Icon name={preset.icon} size={isCompact ? 'xs' : 'sm'} />
          {#if !isCompact}
            <span>{preset.name}</span>
          {/if}
        </Button>
      {/each}
    </div>
  </div>
  
  <!-- View Section -->
  <div class="toolbar-section">
    <div class="section-title">
      <Icon name="eye" size="sm" />
      <span class:hide-in-compact={!isCompact}>View</span>
    </div>
    <div class="toolbar-group">
      {#each viewOptions as option}
        <Button
          variant="ghost"
          size={isCompact ? 'sm' : 'md'}
          onClick={() => handleViewOption(option.id)}
          title={option.name}
        >
          <Icon name={option.icon} size={isCompact ? 'xs' : 'sm'} />
          {#if !isCompact}
            <span>{option.name}</span>
          {/if}
        </Button>
      {/each}
    </div>
  </div>
  
  <!-- Grid Controls -->
  <div class="toolbar-section">
    <div class="section-title">
      <Icon name="grid" size="sm" />
      <span class:hide-in-compact={!isCompact}>Grid</span>
    </div>
    <div class="toolbar-group">
      <Button
        variant={showGrid ? 'primary' : 'ghost'}
        size={isCompact ? 'sm' : 'md'}
        onClick={toggleGrid}
        title="Toggle Grid"
      >
        <Icon name="grid" size={isCompact ? 'xs' : 'sm'} />
        {#if !isCompact}
          <span>Grid</span>
        {/if}
      </Button>
      <Button
        variant={snapToGrid ? 'primary' : 'ghost'}
        size={isCompact ? 'sm' : 'md'}
        onClick={toggleSnapToGrid}
        title="Toggle Snap to Grid"
      >
        <Icon name="magnet" size={isCompact ? 'xs' : 'sm'} />
        {#if !isCompact}
          <span>Snap</span>
        {/if}
      </Button>
    </div>
  </div>
  
  <!-- Workspace Actions -->
  <div class="toolbar-section">
    <div class="section-title">
      <Icon name="folder" size="sm" />
      <span class:hide-in-compact={!isCompact}>Workspace</span>
    </div>
    <div class="toolbar-group">
      <Button
        variant="ghost"
        size={isCompact ? 'sm' : 'md'}
        onClick={importWorkspace}
        title="Import Workspace"
      >
        <Icon name="upload" size={isCompact ? 'xs' : 'sm'} />
        {#if !isCompact}
          <span>Import</span>
        {/if}
      </Button>
      <Button
        variant="ghost"
        size={isCompact ? 'sm' : 'md'}
        onClick={exportWorkspace}
        title="Export Workspace"
      >
        <Icon name="download" size={isCompact ? 'xs' : 'sm'} />
        {#if !isCompact}
          <span>Export</span>
        {/if}
      </Button>
    </div>
  </div>
  
  <!-- Toolbar Actions -->
  <div class="toolbar-section toolbar-actions">
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleCompact}
      title="Toggle Compact Mode"
    >
      <Icon name="minimize-2" size="xs" />
    </Button>
  </div>
</div>

<style>
  .workspace-toolbar {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-3);
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    flex-wrap: wrap;
    min-height: 48px;
  }
  
  .workspace-toolbar.compact {
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    min-height: 40px;
  }
  
  .toolbar-section {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .toolbar-section:not(:last-child) {
    border-right: 1px solid var(--border-subtle);
    padding-right: var(--space-3);
  }
  
  .toolbar-section.toolbar-actions {
    margin-left: auto;
    border-right: none;
    padding-right: 0;
  }
  
  .section-title {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }
  
  .toolbar-group {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  
  .hide-in-compact {
    display: block;
  }
  
  .workspace-toolbar.compact .hide-in-compact {
    display: none;
  }
  
  /* Responsive design */
  @media (max-width: 768px) {
    .workspace-toolbar {
      gap: var(--space-2);
      padding: var(--space-1) var(--space-2);
    }
    
    .toolbar-section:not(:last-child) {
      padding-right: var(--space-2);
    }
    
    .hide-in-compact {
      display: none;
    }
    
    .section-title {
      display: none;
    }
  }
  
  @media (max-width: 480px) {
    .workspace-toolbar {
      flex-wrap: nowrap;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    
    .toolbar-section {
      flex-shrink: 0;
    }
  }
</style>
