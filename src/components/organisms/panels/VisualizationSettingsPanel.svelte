<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { workspaceStore, performanceStore } from '../../../stores/index.js';
  import { createValidator } from '../../../utils/formValidator.js';
  import { Tabs, Button, Badge, Icon, Toggle, Slider, Select, Label } from '../../atoms/index.js';
  import { ColorSchemeSelector, IndicatorSettings } from '../../molecules/index.js';
  import { Accordion, FormField } from '../index.js';
  
  const dispatch = createEventDispatcher();
  
  // Reactive store subscriptions
  let workspace;
  let performance;
  let selectedIndicator = null;
  let indicatorSettings = {};
  
  // Form state
  let formData = {
    animationSpeed: 'medium',
    enableAnimations: true,
    enableTransitions: true,
    refreshRate: 60,
    maxIndicatorsPerCanvas: 10,
    enablePerformanceMode: false,
    enableLazyLoading: true,
    cacheSize: 100,
    enableDebugMode: false,
    showPerformanceMetrics: false
  };
  
  let formErrors = {};
  let isDirty = false;
  let isSaving = false;
  let activeTab = 'global';
  let showAdvancedSettings = false;
  
  // Color scheme state
  let selectedColorScheme = 'default';
  let customColors = {};
  let showColorEditor = false;
  
  // Performance monitoring
  let performanceMetrics = {
    fps: 60,
    renderTime: 16,
    memoryUsage: 45,
    activeCanvases: 0,
    activeIndicators: 0
  };
  
  // Form validator
  const validator = createValidator({
    refreshRate: ['required', 'positive', 'integer', 'min:30', 'max:144'],
    maxIndicatorsPerCanvas: ['required', 'positive', 'integer', 'min:1', 'max:50'],
    cacheSize: ['required', 'positive', 'integer', 'min:10', 'max:1000']
  });
  
  // Store subscriptions
  onMount(() => {
    const unsubscribeWorkspace = workspaceStore.subscribe(ws => {
      workspace = ws;
      updateFormData();
    });
    
    const unsubscribePerformance = performanceStore.subscribe(perf => {
      performance = perf;
      updatePerformanceMetrics();
    });
    
    return () => {
      unsubscribeWorkspace();
      unsubscribePerformance();
    };
  });
  
  function updateFormData() {
    if (!workspace) return;
    
    formData = {
      animationSpeed: workspace.globalSettings?.animationSpeed || 'medium',
      enableAnimations: workspace.globalSettings?.enableAnimations !== false,
      enableTransitions: workspace.globalSettings?.enableTransitions !== false,
      refreshRate: workspace.globalSettings?.refreshRate || 60,
      maxIndicatorsPerCanvas: workspace.globalSettings?.maxIndicatorsPerCanvas || 10,
      enablePerformanceMode: workspace.globalSettings?.enablePerformanceMode || false,
      enableLazyLoading: workspace.globalSettings?.enableLazyLoading !== false,
      cacheSize: workspace.globalSettings?.cacheSize || 100,
      enableDebugMode: workspace.globalSettings?.enableDebugMode || false,
      showPerformanceMetrics: workspace.globalSettings?.showPerformanceMetrics || false
    };
    
    selectedColorScheme = workspace.globalSettings?.colorScheme || 'default';
    customColors = workspace.globalSettings?.customColors || {};
  }
  
  function updatePerformanceMetrics() {
    if (!performance) return;
    
    performanceMetrics = {
      fps: performance.fps || 60,
      renderTime: performance.renderTime || 16,
      memoryUsage: performance.memoryUsage || 45,
      activeCanvases: performance.activeCanvases || 0,
      activeIndicators: performance.activeIndicators || 0
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
    
    // Handle performance mode changes
    if (field === 'enablePerformanceMode') {
      handlePerformanceModeChange(value);
    }
  }
  
  function handlePerformanceModeChange(enablePerformance) {
    if (enablePerformance) {
      // Optimize settings for performance
      formData.animationSpeed = 'fast';
      formData.enableAnimations = false;
      formData.enableTransitions = false;
      formData.refreshRate = 30;
      formData.maxIndicatorsPerCanvas = 5;
      formData.enableLazyLoading = true;
      formData.cacheSize = 50;
    } else {
      // Restore default settings
      formData.animationSpeed = 'medium';
      formData.enableAnimations = true;
      formData.enableTransitions = true;
      formData.refreshRate = 60;
      formData.maxIndicatorsPerCanvas = 10;
      formData.enableLazyLoading = true;
      formData.cacheSize = 100;
    }
    
    isDirty = true;
  }
  
  async function handleSave() {
    // Validate entire form
    const { isValid, errors } = validator.validate(formData);
    if (!isValid) {
      formErrors = errors;
      return;
    }
    
    isSaving = true;
    try {
      // Update workspace global settings
      const globalSettings = {
        ...formData,
        colorScheme: selectedColorScheme,
        customColors
      };
      
      workspaceStore.updateGlobalSettings(globalSettings);
      
      isDirty = false;
      dispatch('save', { settings: globalSettings });
    } catch (error) {
      console.error('Failed to save visualization settings:', error);
      dispatch('error', { message: 'Failed to save visualization settings' });
    } finally {
      isSaving = false;
    }
  }
  
  function handleReset() {
    updateFormData();
    isDirty = false;
  }
  
  function handleColorSchemeChange(event) {
    const { schemeId, colors } = event.detail;
    selectedColorScheme = schemeId;
    
    if (colors) {
      dispatch('colorSchemeChange', { schemeId, colors });
      isDirty = true;
    }
  }
  
  function handleCustomColorChange(event) {
    const { colorType, color } = event.detail;
    customColors[colorType] = color;
    customColors = { ...customColors };
    
    dispatch('customColorChange', { colorType, color });
    isDirty = true;
  }
  
  function handleIndicatorSelect(indicator) {
    selectedIndicator = indicator;
    indicatorSettings = indicator.settings || {};
  }
  
  function handleIndicatorSettingsChange(event) {
    const { indicatorId, settings } = event.detail;
    indicatorSettings = settings;
    
    dispatch('indicatorSettingsChange', { indicatorId, settings });
    isDirty = true;
  }
  
  function exportVisualizationSettings() {
    const exportData = {
      globalSettings: formData,
      colorScheme: selectedColorScheme,
      customColors,
      indicatorSettings,
      timestamp: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `visualization-settings-${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    dispatch('settingsExported', { settings: exportData });
  }
  
  function importVisualizationSettings(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target.result);
        
        // Validate import data
        if (!importData.globalSettings) {
          throw new Error('Invalid visualization settings format');
        }
        
        // Apply imported settings
        formData = { ...formData, ...importData.globalSettings };
        selectedColorScheme = importData.colorScheme || 'default';
        customColors = importData.customColors || {};
        
        if (importData.indicatorSettings) {
          indicatorSettings = importData.indicatorSettings;
        }
        
        isDirty = true;
        dispatch('settingsImported', { settings: importData });
      } catch (error) {
        console.error('Failed to import visualization settings:', error);
        dispatch('importError', { error: error.message });
      }
    };
    
    reader.readAsText(file);
  }
  
  function getTabItems() {
    return [
      {
        id: 'global',
        label: 'Global Settings',
        icon: 'globe',
        badge: isDirty ? '•' : null
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
        id: 'performance',
        label: 'Performance',
        icon: 'zap',
        badge: formData.enablePerformanceMode ? '●' : null
      }
    ];
  }
  
  function getAvailableIndicators() {
    // Mock indicator list - in real app, this would come from indicator registry
    return [
      {
        id: 'priceFloat',
        type: 'priceFloat',
        name: 'Price Float',
        description: 'Horizontal price line',
        category: 'price',
        settings: indicatorSettings['priceFloat'] || {}
      },
      {
        id: 'marketProfile',
        type: 'marketProfile',
        name: 'Market Profile',
        description: 'Price distribution',
        category: 'volume',
        settings: indicatorSettings['marketProfile'] || {}
      },
      {
        id: 'volatilityOrb',
        type: 'volatilityOrb',
        name: 'Volatility Orb',
        description: 'Circular volatility',
        category: 'volatility',
        settings: indicatorSettings['volatilityOrb'] || {}
      },
      {
        id: 'adrMeter',
        type: 'adrMeter',
        name: 'ADR Meter',
        description: 'Daily range indicator',
        category: 'range',
        settings: indicatorSettings['adrMeter'] || {}
      },
      {
        id: 'priceDisplay',
        type: 'priceDisplay',
        name: 'Price Display',
        description: 'Numeric price display',
        category: 'price',
        settings: indicatorSettings['priceDisplay'] || {}
      }
    ];
  }
</script>

<div class="visualization-settings-panel">
  <!-- Panel Header -->
  <div class="panel-header">
    <div class="header-content">
      <div class="header-info">
        <h2 class="panel-title">Visualization Settings</h2>
        <p class="panel-description">Configure global visualization defaults and indicator settings</p>
      </div>
      
      <div class="header-actions">
        <Button 
          variant="outline" 
          size="sm" 
          on:click={handleReset}
          disabled={isSaving}
        >
          <Icon name="refresh-cw" size="sm" />
          Reset
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm" 
          on:click={exportVisualizationSettings}
          title="Export settings"
        >
          <Icon name="download" size="sm" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm" 
          on:click={() => document.getElementById('viz-import').click()}
          title="Import settings"
        >
          <Icon name="upload" size="sm" />
        </Button>
        
        <input
          id="viz-import"
          type="file"
          accept=".json"
          style="display: none"
          on:change={importVisualizationSettings}
        />
        
        <Button 
          variant="primary" 
          size="sm" 
          on:click={handleSave}
          disabled={!isDirty || isSaving}
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
  
  <!-- Tabs -->
  <Tabs 
    items={getTabItems()}
    bind:activeTab={activeTab}
    variant="underline"
  />
  
  <!-- Tab Content -->
  <div class="tab-content">
    {#if activeTab === 'global'}
      <div class="tab-section">
        <h3>Global Visualization Settings</h3>
        
        <Accordion
          items={[
            {
              id: 'basic',
              title: 'Basic Settings',
              icon: 'settings',
              defaultOpen: true
            },
            {
              id: 'advanced',
              title: 'Advanced Settings',
              icon: 'sliders',
              defaultOpen: false
            }
          ]}
        >
          <div slot="basic" class="settings-group">
            <FormField>
              <Toggle
                bind:checked={formData.enableAnimations}
                on:change={(v) => handleInputChange('enableAnimations', v)}
              />
              <Label>Enable Animations</Label>
            </FormField>
            
            <FormField>
              <Label for="animation-speed">Animation Speed</Label>
              <Select
                id="animation-speed"
                bind:value={formData.animationSpeed}
                options={[
                  { value: 'slow', label: 'Slow' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'fast', label: 'Fast' },
                  { value: 'instant', label: 'Instant' }
                ]}
                on:change={(v) => handleInputChange('animationSpeed', v)}
              />
            </FormField>
            
            <FormField>
              <Toggle
                bind:checked={formData.enableTransitions}
                on:change={(v) => handleInputChange('enableTransitions', v)}
              />
              <Label>Enable Transitions</Label>
            </FormField>
            
            <FormField>
              <Label for="refresh-rate">Refresh Rate (FPS)</Label>
              <div class="slider-group">
                <Slider
                  id="refresh-rate"
                  bind:value={formData.refreshRate}
                  min={30}
                  max={144}
                  step={1}
                  on:change={(v) => handleInputChange('refreshRate', v)}
                />
                <span class="setting-unit">{formData.refreshRate} FPS</span>
              </div>
            </FormField>
            
            <FormField>
              <Label for="max-indicators">Max Indicators per Canvas</Label>
              <div class="slider-group">
                <Slider
                  id="max-indicators"
                  bind:value={formData.maxIndicatorsPerCanvas}
                  min={1}
                  max={50}
                  step={1}
                  on:change={(v) => handleInputChange('maxIndicatorsPerCanvas', v)}
                />
                <span class="setting-unit">{formData.maxIndicatorsPerCanvas}</span>
              </div>
            </FormField>
          </div>
          
          <div slot="advanced" class="settings-group">
            <FormField>
              <Toggle
                bind:checked={formData.enablePerformanceMode}
                on:change={(v) => handleInputChange('enablePerformanceMode', v)}
              />
              <Label>Performance Mode</Label>
              <div class="setting-description">
                Optimizes settings for better performance at the cost of visual quality
              </div>
            </FormField>
            
            <FormField>
              <Toggle
                bind:checked={formData.enableLazyLoading}
                on:change={(v) => handleInputChange('enableLazyLoading', v)}
              />
              <Label>Enable Lazy Loading</Label>
            </FormField>
            
            <FormField>
              <Label for="cache-size">Cache Size</Label>
              <div class="slider-group">
                <Slider
                  id="cache-size"
                  bind:value={formData.cacheSize}
                  min={10}
                  max={1000}
                  step={10}
                  on:change={(v) => handleInputChange('cacheSize', v)}
                />
                <span class="setting-unit">{formData.cacheSize} items</span>
              </div>
            </FormField>
            
            <FormField>
              <Toggle
                bind:checked={formData.enableDebugMode}
                on:change={(v) => handleInputChange('enableDebugMode', v)}
              />
              <Label>Enable Debug Mode</Label>
              <div class="setting-description">
                Shows debug information and performance metrics
              </div>
            </FormField>
            
            <FormField>
              <Toggle
                bind:checked={formData.showPerformanceMetrics}
                on:change={(v) => handleInputChange('showPerformanceMetrics', v)}
              />
              <Label>Show Performance Metrics</Label>
            </FormField>
          </div>
        </Accordion>
      </div>
    {:else if activeTab === 'appearance'}
      <div class="tab-section">
        <h3>Appearance Settings</h3>
        
        <ColorSchemeSelector
          bind:selectedScheme={selectedColorScheme}
          bind:customColors={customColors}
          bind:showCustomEditor={showColorEditor}
          on:schemeChange={handleColorSchemeChange}
          on:colorsChange={handleColorSchemeChange}
          on:customColorChange={handleCustomColorChange}
          on:customEditorToggle={(e) => showColorEditor = e.detail.show}
        />
      </div>
    {:else if activeTab === 'indicators'}
      <div class="tab-section">
        <h3>Indicator Configuration</h3>
        
        <div class="indicator-section">
          <div class="indicator-list">
            <h4>Select Indicator</h4>
            <div class="indicator-grid">
              {#each getAvailableIndicators() as indicator}
                <div 
                  class="indicator-item"
                  class:selected={selectedIndicator?.id === indicator.id}
                  on:click={() => handleIndicatorSelect(indicator)}
                >
                  <Icon name={indicator.category === 'price' ? 'trending-up' : indicator.category === 'volume' ? 'bar-chart' : 'activity'} size="sm" />
                  <div class="indicator-info">
                    <div class="indicator-name">{indicator.name}</div>
                    <div class="indicator-description">{indicator.description}</div>
                  </div>
                  <Badge variant="outline" size="xs">{indicator.category}</Badge>
                </div>
              {/each}
            </div>
          </div>
          
          <div class="indicator-settings">
            <IndicatorSettings
              bind:indicator={selectedIndicator}
              bind:settings={indicatorSettings}
              showAdvanced={showAdvancedSettings}
              on:settingsChange={handleIndicatorSettingsChange}
            />
          </div>
        </div>
      </div>
    {:else if activeTab === 'performance'}
      <div class="tab-section">
        <h3>Performance Monitoring</h3>
        
        <div class="performance-dashboard">
          <div class="performance-metrics">
            <div class="metric-card">
              <div class="metric-header">
                <Icon name="zap" size="sm" />
                <span>FPS</span>
              </div>
              <div class="metric-value" class:good={performanceMetrics.fps >= 55} class:warning={performanceMetrics.fps >= 30 && performanceMetrics.fps < 55} class:poor={performanceMetrics.fps < 30}>
                {performanceMetrics.fps}
              </div>
              <div class="metric-label">Frames per second</div>
            </div>
            
            <div class="metric-card">
              <div class="metric-header">
                <Icon name="clock" size="sm" />
                <span>Render Time</span>
              </div>
              <div class="metric-value" class:good={performanceMetrics.renderTime <= 16} class:warning={performanceMetrics.renderTime <= 33 && performanceMetrics.renderTime > 16} class:poor={performanceMetrics.renderTime > 33}>
                {performanceMetrics.renderTime}ms
              </div>
              <div class="metric-label">Average render time</div>
            </div>
            
            <div class="metric-card">
              <div class="metric-header">
                <Icon name="hard-drive" size="sm" />
                <span>Memory</span>
              </div>
              <div class="metric-value" class:good={performanceMetrics.memoryUsage <= 50} class:warning={performanceMetrics.memoryUsage <= 75 && performanceMetrics.memoryUsage > 50} class:poor={performanceMetrics.memoryUsage > 75}>
                {performanceMetrics.memoryUsage}%
              </div>
              <div class="metric-label">Memory usage</div>
            </div>
            
            <div class="metric-card">
              <div class="metric-header">
                <Icon name="box" size="sm" />
                <span>Canvases</span>
              </div>
              <div class="metric-value">
                {performanceMetrics.activeCanvases}
              </div>
              <div class="metric-label">Active canvases</div>
            </div>
            
            <div class="metric-card">
              <div class="metric-header">
                <Icon name="layers" size="sm" />
                <span>Indicators</span>
              </div>
              <div class="metric-value">
                {performanceMetrics.activeIndicators}
              </div>
              <div class="metric-label">Active indicators</div>
            </div>
          </div>
          
          <div class="performance-recommendations">
            <h4>Performance Recommendations</h4>
            <div class="recommendations-list">
              {#if performanceMetrics.fps < 30}
                <div class="recommendation warning">
                  <Icon name="alert-triangle" size="sm" />
                  <span>Low FPS detected. Consider enabling Performance Mode.</span>
                </div>
              {/if}
              
              {#if performanceMetrics.memoryUsage > 75}
                <div class="recommendation warning">
                  <Icon name="alert-triangle" size="sm" />
                  <span>High memory usage. Try reducing cache size or indicator count.</span>
                </div>
              {/if}
              
              {#if performanceMetrics.activeIndicators > formData.maxIndicatorsPerCanvas}
                <div class="recommendation info">
                  <Icon name="info" size="sm" />
                  <span>Consider increasing max indicators per canvas for better performance.</span>
                </div>
              {/if}
              
              {#if performanceMetrics.fps >= 55 && performanceMetrics.memoryUsage <= 50}
                <div class="recommendation success">
                  <Icon name="check-circle" size="sm" />
                  <span>Performance is optimal. Current settings are well balanced.</span>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .visualization-settings-panel {
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
  
  .tab-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-6);
  }
  
  .tab-section {
    max-width: 1000px;
  }
  
  .tab-section h3 {
    margin: 0 0 var(--space-4) 0;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .settings-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
  }
  
  .slider-group {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .setting-unit {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    min-width: 60px;
    text-align: right;
  }
  
  .setting-description {
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    margin-top: var(--space-1);
  }
  
  .indicator-section {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: var(--space-6);
  }
  
  .indicator-list h4 {
    margin: 0 0 var(--space-3) 0;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .indicator-grid {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .indicator-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .indicator-item:hover {
    background: var(--bg-tertiary);
    border-color: var(--border-hover);
  }
  
  .indicator-item.selected {
    background: var(--color-primary-subtle);
    border-color: var(--color-primary);
  }
  
  .indicator-info {
    flex: 1;
  }
  
  .indicator-name {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
  }
  
  .indicator-description {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }
  
  .performance-dashboard {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }
  
  .performance-metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-4);
  }
  
  .metric-card {
    padding: var(--space-4);
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    text-align: center;
  }
  
  .metric-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-secondary);
  }
  
  .metric-value {
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    margin-bottom: var(--space-1);
  }
  
  .metric-value.good {
    color: var(--color-success);
  }
  
  .metric-value.warning {
    color: var(--color-warning);
  }
  
  .metric-value.poor {
    color: var(--color-danger);
  }
  
  .metric-label {
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
  }
  
  .performance-recommendations h4 {
    margin: 0 0 var(--space-3) 0;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .recommendations-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .recommendation {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
  }
  
  .recommendation.warning {
    background: var(--color-warning-subtle);
    color: var(--color-warning);
  }
  
  .recommendation.info {
    background: var(--color-info-subtle);
    color: var(--color-info);
  }
  
  .recommendation.success {
    background: var(--color-success-subtle);
    color: var(--color-success);
  }
  
  /* Responsive Design */
  @media (max-width: 1024px) {
    .indicator-section {
      grid-template-columns: 1fr;
      gap: var(--space-4);
    }
    
    .performance-metrics {
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    }
  }
  
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
    
    .tab-content {
      padding: var(--space-4);
    }
    
    .performance-metrics {
      grid-template-columns: 1fr;
    }
  }
</style>
