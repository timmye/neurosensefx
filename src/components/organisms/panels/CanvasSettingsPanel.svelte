<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { workspaceStore } from '../../../stores/workspaceStore.js';
  import { createValidator } from '../../../utils/formValidator.js';
  import { Tabs, Button, Input, Badge, Icon, Select } from '../../index.js';
  import { IndicatorToggle, CanvasPreview } from '../../molecules/index.js';
  
  const dispatch = createEventDispatcher();
  
  // Reactive store subscriptions
  let workspace;
  let selectedCanvas = null;
  let availableSymbols = [];
  
  // Form state
  let formData = {
    name: '',
    symbol: '',
    width: 220,
    height: 120,
    x: 0,
    y: 0,
    zIndex: 0,
    isVisible: true,
    opacity: 1,
    backgroundColor: '#1a1a1a',
    borderColor: '#333333',
    borderWidth: 1,
    borderRadius: 4
  };
  
  let formErrors = {};
  let isDirty = false;
  let isSaving = false;
  let activeTab = 'general';
  
  // Indicator state
  let availableIndicators = [];
  let activeIndicators = [];
  let indicatorSettings = {};
  let showIndicatorSettings = false;
  let selectedIndicator = null;
  
  // Form validator
  const validator = createValidator({
    name: ['required', 'maxLength:50'],
    symbol: ['required'],
    width: ['required', 'positive', 'integer', 'min:100', 'max:800'],
    height: ['required', 'positive', 'integer', 'min:80', 'max:600'],
    x: ['integer'],
    y: ['integer'],
    zIndex: ['integer'],
    opacity: ['min:0', 'max:1'],
    borderWidth: ['min:0', 'max:10'],
    borderRadius: ['min:0', 'max:20']
  });
  
  // Store subscriptions
  onMount(() => {
    const unsubscribeWorkspace = workspaceStore.subscribe(ws => {
      workspace = ws;
      updateAvailableSymbols();
      updateAvailableIndicators();
    });
    
    return () => {
      unsubscribeWorkspace();
    };
  });
  
  function updateAvailableSymbols() {
    // Mock available symbols - in real app, this would come from symbol store
    availableSymbols = [
      'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD',
      'EURGBP', 'EURJPY', 'GBPJPY', 'NZDUSD', 'USDCHF'
    ];
  }
  
  function updateAvailableIndicators() {
    // Define available indicators with metadata
    availableIndicators = [
      {
        id: 'priceFloat',
        name: 'Price Float',
        description: 'Horizontal line showing current price',
        type: 'priceFloat',
        category: 'price',
        hasSettings: true,
        performance: { cost: 1 },
        defaultSettings: {
          width: 100,
          height: 4,
          color: '#a78bfa',
          glow: true
        }
      },
      {
        id: 'marketProfile',
        name: 'Market Profile',
        description: 'Price distribution over time',
        type: 'marketProfile',
        category: 'volume',
        hasSettings: true,
        performance: { cost: 3 },
        defaultSettings: {
          width: 1.0,
          opacity: 0.7,
          showOutline: true
        }
      },
      {
        id: 'volatilityOrb',
        name: 'Volatility Orb',
        description: 'Circular volatility visualization',
        type: 'volatilityOrb',
        category: 'volatility',
        hasSettings: true,
        performance: { cost: 2 },
        defaultSettings: {
          baseWidth: 200,
          colorMode: 'directional',
          showMetric: true
        }
      },
      {
        id: 'adrMeter',
        name: 'ADR Meter',
        description: 'Average daily range indicator',
        type: 'adrMeter',
        category: 'range',
        hasSettings: true,
        performance: { cost: 1 },
        defaultSettings: {
          showPulse: true,
          threshold: 10,
          color: '#3b82f6'
        }
      },
      {
        id: 'priceDisplay',
        name: 'Price Display',
        description: 'Numeric price display',
        type: 'priceDisplay',
        category: 'price',
        hasSettings: true,
        performance: { cost: 1 },
        defaultSettings: {
          fontSize: 16,
          showPipettes: true,
          fontFamily: 'mono'
        }
      }
    ];
  }
  
  function selectCanvas(canvas) {
    selectedCanvas = canvas;
    updateFormData(canvas);
    activeIndicators = canvas.indicators || [];
    indicatorSettings = canvas.settings || {};
    isDirty = false;
  }
  
  function updateFormData(canvas) {
    if (!canvas) return;
    
    formData = {
      name: canvas.name || '',
      symbol: canvas.symbol || '',
      width: canvas.size?.width || 220,
      height: canvas.size?.height || 120,
      x: canvas.position?.x || 0,
      y: canvas.position?.y || 0,
      zIndex: canvas.zIndex || 0,
      isVisible: canvas.isVisible !== false,
      opacity: canvas.opacity || 1,
      backgroundColor: canvas.backgroundColor || '#1a1a1a',
      borderColor: canvas.borderColor || '#333333',
      borderWidth: canvas.borderWidth || 1,
      borderRadius: canvas.borderRadius || 4
    };
  }
  
  function handleInputChange(field, value) {
    formData[field] = value;
    isDirty = true;
    
    // Validate field
    const { error } = validator.validateAndUpdate(field, value, formData);
    if (error) {
      formErrors[field] = error;
    } else {
      delete formErrors[field];
    }
  }
  
  async function handleSave() {
    if (!selectedCanvas) return;
    
    // Validate entire form
    const { isValid, errors } = validator.validate(formData);
    if (!isValid) {
      formErrors = errors;
      return;
    }
    
    isSaving = true;
    try {
      // Update canvas in workspace
      const canvasUpdate = {
        name: formData.name,
        symbol: formData.symbol,
        size: {
          width: formData.width,
          height: formData.height
        },
        position: {
          x: formData.x,
          y: formData.y
        },
        zIndex: formData.zIndex,
        isVisible: formData.isVisible,
        opacity: formData.opacity,
        backgroundColor: formData.backgroundColor,
        borderColor: formData.borderColor,
        borderWidth: formData.borderWidth,
        borderRadius: formData.borderRadius,
        indicators: activeIndicators,
        settings: indicatorSettings
      };
      
      workspaceStore.updateCanvas(selectedCanvas.id, canvasUpdate);
      
      isDirty = false;
      dispatch('save', { canvas: selectedCanvas, settings: canvasUpdate });
    } catch (error) {
      console.error('Failed to save canvas settings:', error);
      dispatch('error', { message: 'Failed to save canvas settings' });
    } finally {
      isSaving = false;
    }
  }
  
  function handleReset() {
    if (selectedCanvas) {
      updateFormData(selectedCanvas);
      activeIndicators = selectedCanvas.indicators || [];
      indicatorSettings = selectedCanvas.settings || {};
      isDirty = false;
    }
  }
  
  function handleIndicatorsChange(event) {
    const { indicatorId, isActive, activeIndicators: newActiveIndicators } = event.detail;
    activeIndicators = newActiveIndicators;
    isDirty = true;
    
    // Initialize settings for newly activated indicator
    if (isActive && !indicatorSettings[indicatorId]) {
      const indicator = availableIndicators.find(ind => ind.id === indicatorId);
      if (indicator) {
        indicatorSettings[indicatorId] = { ...indicator.defaultSettings };
      }
    }
  }
  
  function handleIndicatorSettings(event) {
    selectedIndicator = event.detail.indicator;
    showIndicatorSettings = true;
  }
  
  function handleIndicatorReorder(event) {
    const { direction, indicatorId } = event.detail;
    const index = activeIndicators.indexOf(indicatorId);
    
    if (direction === 'up' && index > 0) {
      activeIndicators.splice(index, 1);
      activeIndicators.splice(index - 1, 0, indicatorId);
    } else if (direction === 'down' && index < activeIndicators.length - 1) {
      activeIndicators.splice(index, 1);
      activeIndicators.splice(index + 1, 0, indicatorId);
    }
    
    isDirty = true;
  }
  
  function handleIndicatorSettingsSave() {
    if (selectedIndicator) {
      isDirty = true;
    }
    showIndicatorSettings = false;
    selectedIndicator = null;
  }
  
  function handleCanvasDuplicate() {
    if (selectedCanvas) {
      dispatch('canvasDuplicate', { canvas: selectedCanvas });
    }
  }
  
  function handleCanvasDelete() {
    if (selectedCanvas && confirm('Are you sure you want to delete this canvas?')) {
      workspaceStore.removeCanvas(selectedCanvas.id);
      selectedCanvas = null;
      dispatch('canvasDelete', { canvas: selectedCanvas });
    }
  }
  
  function getTabItems() {
    return [
      {
        id: 'general',
        label: 'General',
        icon: 'settings'
      },
      {
        id: 'appearance',
        label: 'Appearance',
        icon: 'palette'
      },
      {
        id: 'indicators',
        label: 'Indicators',
        icon: 'layers'
      },
      {
        id: 'preview',
        label: 'Preview',
        icon: 'eye'
      }
    ];
  }
  
  function getSelectedCanvasForPreview() {
    if (!selectedCanvas) return null;
    
    return {
      ...selectedCanvas,
      indicators: activeIndicators,
      settings: indicatorSettings
    };
  }
</script>

<div class="canvas-settings-panel">
  <!-- Panel Header -->
  <div class="panel-header">
    <div class="header-content">
      <div class="header-info">
        <h2 class="panel-title">Canvas Settings</h2>
        <p class="panel-description">Configure individual canvas behavior and appearance</p>
      </div>
      
      <div class="header-actions">
        <Button 
          variant="outline" 
          size="sm" 
          on:click={handleReset}
          disabled={!selectedCanvas || isSaving}
        >
          <Icon name="refresh-cw" size="sm" />
          Reset
        </Button>
        
        <Button 
          variant="primary" 
          size="sm" 
          on:click={handleSave}
          disabled={!selectedCanvas || !isDirty || isSaving}
        >
          <Icon name="save" size="sm" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
    
    {#if isDirty}
      <div class="unsaved-indicator">
        <Icon name="alert-circle" size="sm" variant="warning" />
        <span>You have unsaved changes</span>
      </div>
    {/if}
  </div>
  
  <!-- Canvas Selection -->
  <div class="canvas-selection">
    <h3>Select Canvas</h3>
    <div class="canvas-list">
      {#if workspace?.layout?.canvases}
        {#each workspace.layout.canvases as canvas}
          <div 
            class="canvas-item"
            class:selected={selectedCanvas?.id === canvas.id}
            on:click={() => selectCanvas(canvas)}
          >
            <div class="canvas-info">
              <Icon name="box" size="sm" />
              <span class="canvas-name">{canvas.name || 'Unnamed Canvas'}</span>
              <Badge variant="outline" size="xs">{canvas.symbol}</Badge>
            </div>
            <div class="canvas-meta">
              <span class="canvas-size">{canvas.size?.width}×{canvas.size?.height}</span>
            </div>
          </div>
        {/each}
      {/if}
    </div>
    
    {#if !selectedCanvas}
      <div class="no-selection">
        <Icon name="mouse-pointer" size="lg" variant="muted" />
        <h4>No Canvas Selected</h4>
        <p>Select a canvas to configure its settings and indicators.</p>
      </div>
    {/if}
  </div>
  
  <!-- Settings Content -->
  {#if selectedCanvas}
    <!-- Tabs -->
    <Tabs 
      items={getTabItems()}
      bind:activeTab={activeTab}
      variant="underline"
    />
    
    <!-- Tab Content -->
    <div class="tab-content">
      {#if activeTab === 'general'}
        <div class="tab-section">
          <h3>General Settings</h3>
          
          <div class="form-grid">
            <div class="form-group">
              <label for="canvas-name">Canvas Name</label>
              <Input
                id="canvas-name"
                bind:value={formData.name}
                placeholder="Enter canvas name"
                error={formErrors.name}
                on:change={() => handleInputChange('name', formData.name)}
              />
            </div>
            
            <div class="form-group">
              <label for="canvas-symbol">Symbol</label>
              <Select
                id="canvas-symbol"
                bind:value={formData.symbol}
                options={availableSymbols}
                placeholder="Select symbol"
                error={formErrors.symbol}
                on:change={() => handleInputChange('symbol', formData.symbol)}
              />
            </div>
            
            <div class="form-group">
              <label for="canvas-width">Width (px)</label>
              <Input
                id="canvas-width"
                type="number"
                bind:value={formData.width}
                min="100"
                max="800"
                error={formErrors.width}
                on:change={() => handleInputChange('width', formData.width)}
              />
            </div>
            
            <div class="form-group">
              <label for="canvas-height">Height (px)</label>
              <Input
                id="canvas-height"
                type="number"
                bind:value={formData.height}
                min="80"
                max="600"
                error={formErrors.height}
                on:change={() => handleInputChange('height', formData.height)}
              />
            </div>
            
            <div class="form-group">
              <label for="canvas-x">X Position</label>
              <Input
                id="canvas-x"
                type="number"
                bind:value={formData.x}
                error={formErrors.x}
                on:change={() => handleInputChange('x', formData.x)}
              />
            </div>
            
            <div class="form-group">
              <label for="canvas-y">Y Position</label>
              <Input
                id="canvas-y"
                type="number"
                bind:value={formData.y}
                error={formErrors.y}
                on:change={() => handleInputChange('y', formData.y)}
              />
            </div>
            
            <div class="form-group">
              <label for="canvas-zindex">Z-Index</label>
              <Input
                id="canvas-zindex"
                type="number"
                bind:value={formData.zIndex}
                error={formErrors.zIndex}
                on:change={() => handleInputChange('zIndex', formData.zIndex)}
              />
            </div>
            
            <div class="form-group">
              <label class="checkbox-label">
                <input 
                  type="checkbox"
                  bind:checked={formData.isVisible}
                  on:change={() => handleInputChange('isVisible', formData.isVisible)}
                />
                Visible
              </label>
            </div>
          </div>
        </div>
      {:else if activeTab === 'appearance'}
        <div class="tab-section">
          <h3>Appearance Settings</h3>
          
          <div class="form-grid">
            <div class="form-group">
              <label for="canvas-opacity">Opacity</label>
              <Input
                id="canvas-opacity"
                type="range"
                bind:value={formData.opacity}
                min="0"
                max="1"
                step="0.1"
                error={formErrors.opacity}
                on:change={() => handleInputChange('opacity', formData.opacity)}
              />
              <span class="range-value">{formData.opacity}</span>
            </div>
            
            <div class="form-group">
              <label for="canvas-bg-color">Background Color</label>
              <Input
                id="canvas-bg-color"
                type="color"
                bind:value={formData.backgroundColor}
                on:change={() => handleInputChange('backgroundColor', formData.backgroundColor)}
              />
            </div>
            
            <div class="form-group">
              <label for="canvas-border-color">Border Color</label>
              <Input
                id="canvas-border-color"
                type="color"
                bind:value={formData.borderColor}
                on:change={() => handleInputChange('borderColor', formData.borderColor)}
              />
            </div>
            
            <div class="form-group">
              <label for="canvas-border-width">Border Width (px)</label>
              <Input
                id="canvas-border-width"
                type="number"
                bind:value={formData.borderWidth}
                min="0"
                max="10"
                error={formErrors.borderWidth}
                on:change={() => handleInputChange('borderWidth', formData.borderWidth)}
              />
            </div>
            
            <div class="form-group">
              <label for="canvas-border-radius">Border Radius (px)</label>
              <Input
                id="canvas-border-radius"
                type="number"
                bind:value={formData.borderRadius}
                min="0"
                max="20"
                error={formErrors.borderRadius}
                on:change={() => handleInputChange('borderRadius', formData.borderRadius)}
              />
            </div>
          </div>
        </div>
      {:else if activeTab === 'indicators'}
        <div class="tab-section">
          <h3>Indicator Configuration</h3>
          
          <IndicatorToggle
            indicators={availableIndicators}
            bind:activeIndicators
            on:indicatorsChange={handleIndicatorsChange}
            on:indicatorSettings={handleIndicatorSettings}
            on:indicatorReorder={handleIndicatorReorder}
          />
          
          <!-- Indicator Settings Modal -->
          {#if showIndicatorSettings && selectedIndicator}
            <div class="indicator-settings-modal">
              <div class="modal-content">
                <div class="modal-header">
                  <h4>{selectedIndicator.name} Settings</h4>
                  <Button variant="ghost" size="sm" on:click={() => showIndicatorSettings = false}>
                    <Icon name="x" size="sm" />
                  </Button>
                </div>
                
                <div class="modal-body">
                  <!-- Indicator-specific settings would go here -->
                  <p>Indicator settings configuration will be implemented based on the specific indicator type.</p>
                </div>
                
                <div class="modal-footer">
                  <Button variant="outline" size="sm" on:click={() => showIndicatorSettings = false}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" on:click={handleIndicatorSettingsSave}>
                    Save Settings
                  </Button>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {:else if activeTab === 'preview'}
        <div class="tab-section">
          <h3>Canvas Preview</h3>
          
          <div class="preview-container">
            <CanvasPreview
              canvas={getSelectedCanvasForPreview()}
              width={Math.min(400, formData.width * 1.5)}
              height={Math.min(300, formData.height * 1.5)}
              interactive={true}
              on:canvasSettings={handleCanvasDuplicate}
              on:canvasDuplicate={handleCanvasDuplicate}
              on:canvasDelete={handleCanvasDelete}
            />
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .canvas-settings-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary);
  }
  
  .panel-header {
    padding: var(--space-6);
    border-bottom: 1px solid var(--border-default);
  }
  
  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--space-4);
  }
  
  .header-info h2 {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .header-info p {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--text-secondary);
  }
  
  .header-actions {
    display: flex;
    gap: var(--space-2);
  }
  
  .unsaved-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--color-warning-subtle);
    border: 1px solid var(--color-warning);
    border-radius: var(--radius-md);
    color: var(--color-warning);
    font-size: var(--font-size-sm);
  }
  
  .canvas-selection {
    padding: var(--space-4) var(--space-6);
    border-bottom: 1px solid var(--border-subtle);
  }
  
  .canvas-selection h3 {
    margin: 0 0 var(--space-3) 0;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .canvas-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-height: 200px;
    overflow-y: auto;
  }
  
  .canvas-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3);
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .canvas-item:hover {
    background: var(--bg-tertiary);
    border-color: var(--border-hover);
  }
  
  .canvas-item.selected {
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
  
  .canvas-meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .canvas-size {
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
  }
  
  .no-selection {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: var(--space-8) var(--space-4);
    gap: var(--space-4);
  }
  
  .no-selection h4 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .no-selection p {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--text-secondary);
    max-width: 300px;
  }
  
  .tab-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-6);
  }
  
  .tab-section {
    max-width: 800px;
  }
  
  .tab-section h3 {
    margin: 0 0 var(--space-4) 0;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .form-group label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    align-self: flex-start;
  }
  
  .checkbox-label input[type="checkbox"] {
    margin: 0;
  }
  
  .range-value {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }
  
  .preview-container {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: var(--space-4);
  }
  
  .indicator-settings-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .modal-content {
    background: var(--bg-primary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-4);
  }
  
  .modal-header h4 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .modal-body {
    margin-bottom: var(--space-6);
  }
  
  .modal-footer {
    display: flex;
    gap: var(--space-2);
    justify-content: flex-end;
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .panel-header {
      padding: var(--space-4);
    }
    
    .header-content {
      flex-direction: column;
      gap: var(--space-4);
    }
    
    .header-actions {
      width: 100%;
      justify-content: flex-end;
    }
    
    .canvas-selection {
      padding: var(--space-3) var(--space-4);
    }
    
    .tab-content {
      padding: var(--space-4);
    }
    
    .form-grid {
      grid-template-columns: 1fr;
      gap: var(--space-3);
    }
    
    .canvas-item {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-2);
    }
  }
</style>
