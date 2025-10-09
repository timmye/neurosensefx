<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { workspaceStore } from '../../../stores/index.js';
  import { Button, Icon, Toggle, Slider, Badge } from '../../atoms/index.js';
  
  const dispatch = createEventDispatcher();
  
  // Reactive store subscriptions
  let workspace;
  
  // Grid state
  let gridSize = 20;
  let showGrid = true;
  let snapToGrid = true;
  let showGridNumbers = false;
  let showRulers = true;
  let gridColor = 'rgba(255, 255, 255, 0.1)';
  let gridStyle = 'lines'; // 'lines', 'dots', 'crosses'
  
  // Ruler state
  let rulerSize = 20;
  let rulerUnit = 'px'; // 'px', 'percent'
  let rulerScale = 1;
  
  // Snap state
  let snapThreshold = 10; // pixels from grid line to snap
  let showSnapIndicators = true;
  let snapToOtherCanvases = true;
  let snapToCanvasEdges = true;
  let snapToCanvasCenter = true;
  
  // Layout presets
  const layoutPresets = [
    {
      id: 'free',
      name: 'Free Layout',
      description: 'No grid constraints',
      icon: 'move',
      gridSize: 1,
      snapToGrid: false,
      showGrid: false
    },
    {
      id: 'fine',
      name: 'Fine Grid',
      description: '10px grid for precise positioning',
      icon: 'grid-3x3',
      gridSize: 10,
      snapToGrid: true,
      showGrid: true
    },
    {
      id: 'standard',
      name: 'Standard Grid',
      description: '20px grid for general use',
      icon: 'grid',
      gridSize: 20,
      snapToGrid: true,
      showGrid: true
    },
    {
      id: 'coarse',
      name: 'Coarse Grid',
      description: '50px grid for quick layout',
      icon: 'grid-2x2',
      gridSize: 50,
      snapToGrid: true,
      showGrid: true
    },
    {
      id: 'trading',
      name: 'Trading Layout',
      description: 'Optimized for trading workspaces',
      icon: 'layout',
      gridSize: 40,
      snapToGrid: true,
      showGrid: true
    }
  ];
  
  // Grid calculation functions
  function snapToGridPoint(value, size = gridSize) {
    if (!snapToGrid) return value;
    return Math.round(value / size) * size;
  }
  
  function getNearestGridPoint(x, y) {
    return {
      x: snapToGridPoint(x, gridSize),
      y: snapToGridPoint(y, gridSize)
    };
  }
  
  function getGridLines(bounds) {
    const lines = {
      vertical: [],
      horizontal: []
    };
    
    if (!showGrid) return lines;
    
    const { width, height } = bounds;
    const startX = Math.floor(-bounds.x / gridSize) * gridSize;
    const startY = Math.floor(-bounds.y / gridSize) * gridSize;
    const endX = startX + width + gridSize * 2;
    const endY = startY + height + gridSize * 2;
    
    for (let x = startX; x <= endX; x += gridSize) {
      lines.vertical.push(x);
    }
    
    for (let y = startY; y <= endY; y += gridSize) {
      lines.horizontal.push(y);
    }
    
    return lines;
  }
  
  // Canvas snapping functions
  function getCanvasSnapPoints(canvas) {
    if (!workspace?.layout?.canvases) return [];
    
    const otherCanvases = workspace.layout.canvases.filter(c => c.id !== canvas.id);
    const snapPoints = [];
    
    otherCanvases.forEach(otherCanvas => {
      const left = otherCanvas.position.x;
      const right = otherCanvas.position.x + otherCanvas.size.width;
      const top = otherCanvas.position.y;
      const bottom = otherCanvas.position.y + otherCanvas.size.height;
      const centerX = left + otherCanvas.size.width / 2;
      const centerY = top + otherCanvas.size.height / 2;
      
      // Edge snap points
      if (snapToCanvasEdges) {
        snapPoints.push({ type: 'edge', x: left, y: top, orientation: 'top-left' });
        snapPoints.push({ type: 'edge', x: right, y: top, orientation: 'top-right' });
        snapPoints.push({ type: 'edge', x: left, y: bottom, orientation: 'bottom-left' });
        snapPoints.push({ type: 'edge', x: right, y: bottom, orientation: 'bottom-right' });
        snapPoints.push({ type: 'edge', x: left, y: centerY, orientation: 'left-center' });
        snapPoints.push({ type: 'edge', x: right, y: centerY, orientation: 'right-center' });
        snapPoints.push({ type: 'edge', x: centerX, y: top, orientation: 'top-center' });
        snapPoints.push({ type: 'edge', x: centerX, y: bottom, orientation: 'bottom-center' });
      }
      
      // Center snap points
      if (snapToCanvasCenter) {
        snapPoints.push({ type: 'center', x: centerX, y: centerY, orientation: 'center' });
      }
    });
    
    return snapPoints;
  }
  
  function findNearestSnapPoint(x, y, canvas) {
    if (!snapToOtherCanvases) return null;
    
    const snapPoints = getCanvasSnapPoints(canvas);
    let nearestPoint = null;
    let minDistance = snapThreshold;
    
    snapPoints.forEach(point => {
      const distance = Math.sqrt(
        Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = point;
      }
    });
    
    return nearestPoint;
  }
  
  function calculateSnapPosition(canvas, newX, newY) {
    let snappedX = newX;
    let snappedY = newY;
    const snapInfo = {
      snapped: false,
      gridSnap: false,
      canvasSnap: false,
      snapPoint: null
    };
    
    // Grid snapping
    if (snapToGrid) {
      const gridPoint = getNearestGridPoint(newX, newY);
      const gridDistance = Math.sqrt(
        Math.pow(newX - gridPoint.x, 2) + Math.pow(newY - gridPoint.y, 2)
      );
      
      if (gridDistance <= snapThreshold) {
        snappedX = gridPoint.x;
        snappedY = gridPoint.y;
        snapInfo.snapped = true;
        snapInfo.gridSnap = true;
      }
    }
    
    // Canvas snapping
    const canvasSnapPoint = findNearestSnapPoint(newX, newY, canvas);
    if (canvasSnapPoint) {
      snappedX = canvasSnapPoint.x;
      snappedY = canvasSnapPoint.y;
      snapInfo.snapped = true;
      snapInfo.canvasSnap = true;
      snapInfo.snapPoint = canvasSnapPoint;
    }
    
    return { x: snappedX, y: snappedY, snapInfo };
  }
  
  // Layout functions
  function applyLayoutPreset(presetId) {
    const preset = layoutPresets.find(p => p.id === presetId);
    if (!preset) return;
    
    gridSize = preset.gridSize;
    snapToGrid = preset.snapToGrid;
    showGrid = preset.showGrid;
    
    dispatch('layoutPresetApplied', { preset });
  }
  
  function autoLayoutCanvases(layout = 'grid') {
    if (!workspace?.layout?.canvases || workspace.layout.canvases.length === 0) return;
    
    const canvases = [...workspace.layout.canvases];
    const padding = gridSize * 2;
    
    switch (layout) {
      case 'grid':
        layoutInGrid(canvases, padding);
        break;
      case 'horizontal':
        layoutHorizontal(canvases, padding);
        break;
      case 'vertical':
        layoutVertical(canvases, padding);
        break;
      case 'cascade':
        layoutCascade(canvases, padding);
        break;
    }
    
    dispatch('autoLayoutApplied', { layout });
  }
  
  function layoutInGrid(canvases, padding) {
    const cols = Math.ceil(Math.sqrt(canvases.length));
    const rows = Math.ceil(canvases.length / cols);
    
    const maxWidth = Math.max(...canvases.map(c => c.size.width));
    const maxHeight = Math.max(...canvases.map(c => c.size.height));
    
    canvases.forEach((canvas, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      const x = padding + col * (maxWidth + padding);
      const y = padding + row * (maxHeight + padding);
      
      workspaceStore.updateCanvas(canvas.id, {
        position: snapToGrid ? getNearestGridPoint(x, y) : { x, y }
      });
    });
  }
  
  function layoutHorizontal(canvases, padding) {
    let currentX = padding;
    
    canvases.forEach(canvas => {
      workspaceStore.updateCanvas(canvas.id, {
        position: snapToGrid ? getNearestGridPoint(currentX, padding) : { x: currentX, y: padding }
      });
      
      currentX += canvas.size.width + padding;
    });
  }
  
  function layoutVertical(canvases, padding) {
    let currentY = padding;
    
    canvases.forEach(canvas => {
      workspaceStore.updateCanvas(canvas.id, {
        position: snapToGrid ? getNearestGridPoint(padding, currentY) : { x: padding, y: currentY }
      });
      
      currentY += canvas.size.height + padding;
    });
  }
  
  function layoutCascade(canvases, padding) {
    const offsetX = gridSize * 2;
    const offsetY = gridSize * 2;
    
    canvases.forEach((canvas, index) => {
      const x = padding + (index * offsetX);
      const y = padding + (index * offsetY);
      
      workspaceStore.updateCanvas(canvas.id, {
        position: snapToGrid ? getNearestGridPoint(x, y) : { x, y },
        zIndex: index
      });
    });
  }
  
  function distributeCanvases(direction = 'horizontal') {
    if (!workspace?.layout?.canvases || workspace.layout.canvases.length < 3) return;
    
    const canvases = [...workspace.layout.canvases];
    
    if (direction === 'horizontal') {
      canvases.sort((a, b) => a.position.x - b.position.x);
      
      const firstX = canvases[0].position.x;
      const lastX = canvases[canvases.length - 1].position.x + canvases[canvases.length - 1].size.width;
      const totalWidth = lastX - firstX;
      const spacing = totalWidth / (canvases.length - 1);
      
      canvases.forEach((canvas, index) => {
        const x = firstX + (index * spacing) - (canvas.size.width / 2);
        workspaceStore.updateCanvas(canvas.id, {
          position: { x, y: canvas.position.y }
        });
      });
    } else {
      canvases.sort((a, b) => a.position.y - b.position.y);
      
      const firstY = canvases[0].position.y;
      const lastY = canvases[canvases.length - 1].position.y + canvases[canvases.length - 1].size.height;
      const totalHeight = lastY - firstY;
      const spacing = totalHeight / (canvases.length - 1);
      
      canvases.forEach((canvas, index) => {
        const y = firstY + (index * spacing) - (canvas.size.height / 2);
        workspaceStore.updateCanvas(canvas.id, {
          position: { x: canvas.position.x, y }
        });
      });
    }
    
    dispatch('canvasesDistributed', { direction });
  }
  
  function alignCanvases(alignment = 'left') {
    if (!workspace?.layout?.canvases || workspace.layout.canvases.length < 2) return;
    
    const canvases = [...workspace.layout.canvases];
    let referenceValue;
    
    switch (alignment) {
      case 'left':
        referenceValue = Math.min(...canvases.map(c => c.position.x));
        canvases.forEach(canvas => {
          workspaceStore.updateCanvas(canvas.id, {
            position: { x: referenceValue, y: canvas.position.y }
          });
        });
        break;
      case 'right':
        referenceValue = Math.max(...canvases.map(c => c.position.x + c.size.width));
        canvases.forEach(canvas => {
          workspaceStore.updateCanvas(canvas.id, {
            position: { x: referenceValue - canvas.size.width, y: canvas.position.y }
          });
        });
        break;
      case 'top':
        referenceValue = Math.min(...canvases.map(c => c.position.y));
        canvases.forEach(canvas => {
          workspaceStore.updateCanvas(canvas.id, {
            position: { x: canvas.position.x, y: referenceValue }
          });
        });
        break;
      case 'bottom':
        referenceValue = Math.max(...canvases.map(c => c.position.y + c.size.height));
        canvases.forEach(canvas => {
          workspaceStore.updateCanvas(canvas.id, {
            position: { x: canvas.position.x, y: referenceValue - canvas.size.height }
          });
        });
        break;
      case 'center-horizontal':
        const avgX = canvases.reduce((sum, c) => sum + c.position.x + c.size.width / 2, 0) / canvases.length;
        canvases.forEach(canvas => {
          workspaceStore.updateCanvas(canvas.id, {
            position: { x: avgX - canvas.size.width / 2, y: canvas.position.y }
          });
        });
        break;
      case 'center-vertical':
        const avgY = canvases.reduce((sum, c) => sum + c.position.y + c.size.height / 2, 0) / canvases.length;
        canvases.forEach(canvas => {
          workspaceStore.updateCanvas(canvas.id, {
            position: { x: canvas.position.x, y: avgY - canvas.size.height / 2 }
          });
        });
        break;
    }
    
    dispatch('canvasesAligned', { alignment });
  }
  
  // Store subscriptions
  onMount(() => {
    const unsubscribeWorkspace = workspaceStore.subscribe(ws => {
      workspace = ws;
    });
    
    return () => {
      unsubscribeWorkspace();
    };
  });
  
  // Export functions for parent components
  export function snapPosition(canvas, x, y) {
    return calculateSnapPosition(canvas, x, y);
  }
  
  export function getGridConfig() {
    return {
      gridSize,
      showGrid,
      snapToGrid,
      snapThreshold,
      showSnapIndicators,
      gridColor,
      gridStyle
    };
  }
</script>

<div class="workspace-grid">
  <!-- Grid Controls -->
  <div class="grid-controls">
    <div class="control-section">
      <h4>Grid Settings</h4>
      
      <div class="control-group">
        <label>Layout Preset</label>
        <div class="preset-buttons">
          {#each layoutPresets as preset}
            <Button
              variant={gridSize === preset.gridSize && snapToGrid === preset.snapToGrid ? "default" : "outline"}
              size="xs"
              on:click={() => applyLayoutPreset(preset.id)}
              title={preset.description}
            >
              <Icon name={preset.icon} size="xs" />
              {preset.name}
            </Button>
          {/each}
        </div>
      </div>
      
      <div class="control-group">
        <label for="grid-size">Grid Size: {gridSize}px</label>
        <Slider
          id="grid-size"
          bind:value={gridSize}
          min={5}
          max={100}
          step={5}
          on:change={() => dispatch('gridSizeChanged', { gridSize })}
        />
      </div>
      
      <div class="control-group">
        <label>Display Options</label>
        <div class="toggle-group">
          <Toggle
            bind:checked={showGrid}
            size="sm"
            on:change={() => dispatch('gridDisplayChanged', { showGrid })}
          >
            Show Grid
          </Toggle>
          
          <Toggle
            bind:checked={snapToGrid}
            size="sm"
            on:change={() => dispatch('gridSnapChanged', { snapToGrid })}
          >
            Snap to Grid
          </Toggle>
          
          <Toggle
            bind:checked={showGridNumbers}
            size="sm"
            on:change={() => dispatch('gridNumbersChanged', { showGridNumbers })}
          >
            Show Numbers
          </Toggle>
          
          <Toggle
            bind:checked={showRulers}
            size="sm"
            on:change={() => dispatch('rulersChanged', { showRulers })}
          >
            Show Rulers
          </Toggle>
        </div>
      </div>
      
      <div class="control-group">
        <label for="grid-style">Grid Style</label>
        <select bind:value={gridStyle} class="select-input" on:change={() => dispatch('gridStyleChanged', { gridStyle })}>
          <option value="lines">Lines</option>
          <option value="dots">Dots</option>
          <option value="crosses">Crosses</option>
        </select>
      </div>
    </div>
    
    <div class="control-section">
      <h4>Snapping</h4>
      
      <div class="control-group">
        <label for="snap-threshold">Snap Threshold: {snapThreshold}px</label>
        <Slider
          id="snap-threshold"
          bind:value={snapThreshold}
          min={5}
          max={50}
          step={5}
          on:change={() => dispatch('snapThresholdChanged', { snapThreshold })}
        />
      </div>
      
      <div class="control-group">
        <label>Snap Options</label>
        <div class="toggle-group">
          <Toggle
            bind:checked={showSnapIndicators}
            size="sm"
            on:change={() => dispatch('snapIndicatorsChanged', { showSnapIndicators })}
          >
            Show Indicators
          </Toggle>
          
          <Toggle
            bind:checked={snapToOtherCanvases}
            size="sm"
            on:change={() => dispatch('canvasSnapChanged', { snapToOtherCanvases })}
          >
            Snap to Canvases
          </Toggle>
          
          <Toggle
            bind:checked={snapToCanvasEdges}
            size="sm"
            on:change={() => dispatch('edgeSnapChanged', { snapToCanvasEdges })}
          >
            Edge Snap
          </Toggle>
          
          <Toggle
            bind:checked={snapToCanvasCenter}
            size="sm"
            on:change={() => dispatch('centerSnapChanged', { snapToCanvasCenter })}
          >
            Center Snap
          </Toggle>
        </div>
      </div>
    </div>
    
    <div class="control-section">
      <h4>Auto Layout</h4>
      
      <div class="control-group">
        <label>Layout Options</label>
        <div class="layout-buttons">
          <Button
            variant="outline"
            size="xs"
            on:click={() => autoLayoutCanvases('grid')}
          >
            <Icon name="grid" size="xs" />
            Grid
          </Button>
          
          <Button
            variant="outline"
            size="xs"
            on:click={() => autoLayoutCanvases('horizontal')}
          >
            <Icon name="align-horizontal-distribute-center" size="xs" />
            Horizontal
          </Button>
          
          <Button
            variant="outline"
            size="xs"
            on:click={() => autoLayoutCanvases('vertical')}
          >
            <Icon name="align-vertical-distribute-center" size="xs" />
            Vertical
          </Button>
          
          <Button
            variant="outline"
            size="xs"
            on:click={() => autoLayoutCanvases('cascade')}
          >
            <Icon name="layers" size="xs" />
            Cascade
          </Button>
        </div>
      </div>
      
      <div class="control-group">
        <label>Align & Distribute</label>
        <div class="align-buttons">
          <div class="align-row">
            <Button
              variant="outline"
              size="xs"
              on:click={() => alignCanvases('left')}
              title="Align left"
            >
              <Icon name="align-left" size="xs" />
            </Button>
            
            <Button
              variant="outline"
              size="xs"
              on:click={() => alignCanvases('center-horizontal')}
              title="Align center horizontal"
            >
              <Icon name="align-center-horizontal" size="xs" />
            </Button>
            
            <Button
              variant="outline"
              size="xs"
              on:click={() => alignCanvases('right')}
              title="Align right"
            >
              <Icon name="align-right" size="xs" />
            </Button>
          </div>
          
          <div class="align-row">
            <Button
              variant="outline"
              size="xs"
              on:click={() => alignCanvases('top')}
              title="Align top"
            >
              <Icon name="align-top" size="xs" />
            </Button>
            
            <Button
              variant="outline"
              size="xs"
              on:click={() => alignCanvases('center-vertical')}
              title="Align center vertical"
            >
              <Icon name="align-center-vertical" size="xs" />
            </Button>
            
            <Button
              variant="outline"
              size="xs"
              on:click={() => alignCanvases('bottom')}
              title="Align bottom"
            >
              <Icon name="align-bottom" size="xs" />
            </Button>
          </div>
          
          <div class="align-row">
            <Button
              variant="outline"
              size="xs"
              on:click={() => distributeCanvases('horizontal')}
              title="Distribute horizontally"
            >
              <Icon name="align-horizontal-distribute-center" size="xs" />
            </Button>
            
            <Button
              variant="outline"
              size="xs"
              on:click={() => distributeCanvases('vertical')}
              title="Distribute vertically"
            >
              <Icon name="align-vertical-distribute-center" size="xs" />
            </Button>
          </div>
        </div>
      </div>
    </div>
    
    <div class="control-section">
      <h4>Info</h4>
      
      <div class="info-display">
        <div class="info-item">
          <span class="info-label">Active Canvases:</span>
          <Badge variant="outline" size="xs">
            {workspace?.layout?.canvases?.length || 0}
          </Badge>
        </div>
        
        <div class="info-item">
          <span class="info-label">Grid Size:</span>
          <Badge variant="outline" size="xs">
            {gridSize}px
          </Badge>
        </div>
        
        <div class="info-item">
          <span class="info-label">Snap Status:</span>
          <Badge variant={snapToGrid ? "success" : "outline"} size="xs">
            {snapToGrid ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .workspace-grid {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary);
  }
  
  .grid-controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    padding: var(--space-4);
    overflow-y: auto;
  }
  
  .control-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-bottom: var(--space-4);
    border-bottom: 1px solid var(--border-subtle);
  }
  
  .control-section:last-child {
    border-bottom: none;
  }
  
  .control-section h4 {
    margin: 0;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .control-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .control-group label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
  }
  
  .preset-buttons {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: var(--space-2);
  }
  
  .toggle-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .select-input {
    padding: var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: var(--font-size-sm);
  }
  
  .layout-buttons {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-2);
  }
  
  .align-buttons {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .align-row {
    display: flex;
    gap: var(--space-2);
    justify-content: center;
  }
  
  .info-display {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
  }
  
  .info-label {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .grid-controls {
      padding: var(--space-3);
    }
    
    .preset-buttons {
      grid-template-columns: 1fr;
    }
    
    .layout-buttons {
      grid-template-columns: 1fr;
    }
    
    .align-row {
      flex-wrap: wrap;
    }
  }
</style>
