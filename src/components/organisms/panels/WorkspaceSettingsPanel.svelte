<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { workspaceStore } from '../../../stores/workspaceStore.js';
  import { createValidator, COMMON_SCHEMAS } from '../../../utils/formValidator.js';
  import { Tabs, Button, Input, Badge, Icon } from '../../index.js';
  import { WorkspaceTemplate, WorkspaceImport } from '../../molecules/index.js';
  
  const dispatch = createEventDispatcher();
  
  // Reactive store subscriptions
  let workspace;
  let canvases;
  let globalSettings;
  
  // Form state
  let formData = {
    name: '',
    description: '',
    autoSave: true,
    autoSaveInterval: 30000,
    theme: 'dark',
    density: 'high',
    gridColumns: 4,
    gridRows: 3,
    gridGap: 10,
    gridPadding: 20
  };
  
  let formErrors = {};
  let isDirty = false;
  let isSaving = false;
  let activeTab = 'general';
  
  // Template state
  let templates = [];
  let selectedTemplate = null;
  let showTemplatePreview = false;
  let isLoadingTemplates = false;
  
  // Import state
  let importHistory = [];
  let isImporting = false;
  
  // Form validator
  const validator = createValidator({
    name: ['required', 'maxLength:100'],
    description: ['maxLength:500'],
    autoSaveInterval: ['required', 'positive', 'integer'],
    gridColumns: ['required', 'positive', 'integer', 'max:10'],
    gridRows: ['required', 'positive', 'integer', 'max:10'],
    gridGap: ['required', 'positive', 'integer'],
    gridPadding: ['required', 'positive', 'integer']
  });
  
  // Store subscriptions
  onMount(() => {
    const unsubscribeWorkspace = workspaceStore.subscribe(ws => {
      workspace = ws;
      updateFormData(ws);
    });
    
    const unsubscribeCanvases = workspaceStore.canvases.subscribe(c => {
      canvases = c;
    });
    
    const unsubscribeGlobalSettings = workspaceStore.globalSettings.subscribe(gs => {
      globalSettings = gs;
    });
    
    loadTemplates();
    loadImportHistory();
    
    return () => {
      unsubscribeWorkspace();
      unsubscribeCanvases();
      unsubscribeGlobalSettings();
    };
  });
  
  function updateFormData(ws) {
    formData = {
      name: ws.name || '',
      description: ws.description || '',
      autoSave: ws.globalSettings?.autoSave ?? true,
      autoSaveInterval: ws.globalSettings?.autoSaveInterval ?? 30000,
      theme: ws.globalSettings?.theme || 'dark',
      density: ws.globalSettings?.density || 'high',
      gridColumns: ws.layout?.gridSettings?.columns || 4,
      gridRows: ws.layout?.gridSettings?.rows || 3,
      gridGap: ws.layout?.gridSettings?.gap || 10,
      gridPadding: ws.layout?.gridSettings?.padding || 20
    };
    isDirty = false;
  }
  
  async function loadTemplates() {
    isLoadingTemplates = true;
    try {
      // Simulate API call - in real app, this would fetch from backend
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      templates = [
        {
          id: 'day-trading',
          name: 'Day Trading Setup',
          description: 'Optimized for intraday trading with multiple timeframes',
          type: 'day-trading',
          canvasCount: 6,
          symbolCount: 3,
          layout: 'grid',
          features: ['Real-time charts', 'Volume indicators', 'News feed'],
          isPremium: false,
          preview: '/templates/day-trading-preview.png'
        },
        {
          id: 'swing-trading',
          name: 'Swing Trading Workspace',
          description: 'Perfect for swing traders with weekly and daily charts',
          type: 'swing-trading',
          canvasCount: 4,
          symbolCount: 5,
          layout: 'grid',
          features: ['Multi-timeframe', 'Pattern recognition', 'Risk management'],
          isPremium: false,
          preview: '/templates/swing-trading-preview.png'
        },
        {
          id: 'scalping',
          name: 'Scalping Dashboard',
          description: 'High-frequency trading setup with minimal latency',
          type: 'scalping',
          canvasCount: 8,
          symbolCount: 2,
          layout: 'compact',
          features: ['Tick charts', 'Level 2 data', 'Quick execution'],
          isPremium: true,
          preview: '/templates/scalping-preview.png'
        }
      ];
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      isLoadingTemplates = false;
    }
  }
  
  function loadImportHistory() {
    // Simulate loading import history from localStorage
    const saved = localStorage.getItem('neurosense_import_history');
    if (saved) {
      try {
        importHistory = JSON.parse(saved);
      } catch (error) {
        importHistory = [];
      }
    }
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
    // Validate entire form
    const { isValid, errors } = validator.validate(formData);
    if (!isValid) {
      formErrors = errors;
      return;
    }
    
    isSaving = true;
    try {
      // Update workspace
      workspaceStore.updateGlobalSettings({
        autoSave: formData.autoSave,
        autoSaveInterval: formData.autoSaveInterval,
        theme: formData.theme,
        density: formData.density
      });
      
      workspaceStore.update({
        name: formData.name,
        description: formData.description,
        layout: {
          ...workspace.layout,
          gridSettings: {
            columns: formData.gridColumns,
            rows: formData.gridRows,
            gap: formData.gridGap,
            padding: formData.gridPadding
          }
        }
      });
      
      isDirty = false;
      dispatch('save', { workspace: formData });
    } catch (error) {
      console.error('Failed to save workspace:', error);
      dispatch('error', { message: 'Failed to save workspace settings' });
    } finally {
      isSaving = false;
    }
  }
  
  function handleReset() {
    if (confirm('Are you sure you want to reset to default settings?')) {
      workspaceStore.reset();
      updateFormData(workspaceStore.get());
      dispatch('reset');
    }
  }
  
  function handleExport() {
    const exportData = workspaceStore.export();
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workspace-${formData.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    dispatch('export', { data: exportData });
  }
  
  function handleTemplateSelect(event) {
    selectedTemplate = event.detail.template;
  }
  
  function handleTemplateApply(event) {
    const template = event.detail.template;
    if (confirm(`Apply "${template.name}" template? This will replace your current workspace.`)) {
      // Apply template logic
      formData.name = template.name + ' (Customized)';
      formData.description = template.description;
      
      // Update grid settings based on template
      if (template.layout === 'compact') {
        formData.gridColumns = 6;
        formData.gridRows = 4;
        formData.density = 'high';
      }
      
      isDirty = true;
      dispatch('templateApplied', { template });
    }
  }
  
  function handleTemplatePreview(event) {
    const template = event.detail.template;
    showTemplatePreview = true;
    dispatch('templatePreview', { template });
  }
  
  function handleImport(event) {
    const { data, onSuccess, onError } = event.detail;
    isImporting = true;
    
    try {
      // Validate and apply imported workspace data
      if (data.name || data.title) {
        formData.name = data.name || data.title;
        formData.description = data.description || '';
        
        if (data.globalSettings) {
          Object.assign(formData, data.globalSettings);
        }
        
        if (data.layout?.gridSettings) {
          Object.assign(formData, data.layout.gridSettings);
        }
        
        isDirty = true;
        
        // Add to import history
        importHistory.unshift({
          name: formData.name,
          type: 'workspace',
          date: new Date().toISOString()
        });
        
        // Keep only last 10 imports
        importHistory = importHistory.slice(0, 10);
        localStorage.setItem('neurosense_import_history', JSON.stringify(importHistory));
        
        onSuccess();
        dispatch('importSuccess', { data });
      } else {
        onError(new Error('Invalid workspace file format'));
      }
    } catch (error) {
      onError(error);
    } finally {
      isImporting = false;
    }
  }
  
  function handleHistoryImport(event) {
    const item = event.detail.item;
    // Load from history logic
    dispatch('historyImport', { item });
  }
  
  function getTabItems() {
    return [
      {
        id: 'general',
        label: 'General',
        icon: 'settings'
      },
      {
        id: 'layout',
        label: 'Layout',
        icon: 'grid'
      },
      {
        id: 'templates',
        label: 'Templates',
        icon: 'layers'
      },
      {
        id: 'import',
        label: 'Import/Export',
        icon: 'upload-cloud'
      }
    ];
  }
</script>

<div class="workspace-settings-panel">
  <!-- Panel Header -->
  <div class="panel-header">
    <div class="header-content">
      <div class="header-info">
        <h2 class="panel-title">Workspace Settings</h2>
        <p class="panel-description">Configure your trading workspace layout and preferences</p>
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
          variant="outline" 
          size="sm" 
          on:click={handleExport}
        >
          <Icon name="download" size="sm" />
          Export
        </Button>
        
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
    {#if activeTab === 'general'}
      <div class="tab-section">
        <h3>General Settings</h3>
        
        <div class="form-grid">
          <div class="form-group">
            <label for="workspace-name">Workspace Name</label>
            <Input
              id="workspace-name"
              bind:value={formData.name}
              placeholder="Enter workspace name"
              error={formErrors.name}
              on:change={() => handleInputChange('name', formData.name)}
            />
          </div>
          
          <div class="form-group full-width">
            <label for="workspace-description">Description</label>
            <Input
              id="workspace-description"
              bind:value={formData.description}
              placeholder="Describe your workspace setup"
              error={formErrors.description}
              on:change={() => handleInputChange('description', formData.description)}
            />
          </div>
          
          <div class="form-group">
            <label for="theme">Theme</label>
            <select 
              id="theme"
              bind:value={formData.theme}
              on:change={() => handleInputChange('theme', formData.theme)}
              class="form-select"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="auto">Auto</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="density">UI Density</label>
            <select 
              id="density"
              bind:value={formData.density}
              on:change={() => handleInputChange('density', formData.density)}
              class="form-select"
            >
              <option value="compact">Compact</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
        
        <h3>Auto-Save</h3>
        <div class="form-grid">
          <div class="form-group">
            <label class="checkbox-label">
              <input 
                type="checkbox"
                bind:checked={formData.autoSave}
                on:change={() => handleInputChange('autoSave', formData.autoSave)}
              />
              Enable auto-save
            </label>
          </div>
          
          <div class="form-group">
            <label for="auto-save-interval">Auto-save interval (seconds)</label>
            <Input
              id="auto-save-interval"
              type="number"
              bind:value={formData.autoSaveInterval}
              min="10"
              max="300"
              error={formErrors.autoSaveInterval}
              on:change={() => handleInputChange('autoSaveInterval', formData.autoSaveInterval)}
            />
          </div>
        </div>
      </div>
    {:else if activeTab === 'layout'}
      <div class="tab-section">
        <h3>Grid Layout Settings</h3>
        
        <div class="form-grid">
          <div class="form-group">
            <label for="grid-columns">Columns</label>
            <Input
              id="grid-columns"
              type="number"
              bind:value={formData.gridColumns}
              min="1"
              max="10"
              error={formErrors.gridColumns}
              on:change={() => handleInputChange('gridColumns', formData.gridColumns)}
            />
          </div>
          
          <div class="form-group">
            <label for="grid-rows">Rows</label>
            <Input
              id="grid-rows"
              type="number"
              bind:value={formData.gridRows}
              min="1"
              max="10"
              error={formErrors.gridRows}
              on:change={() => handleInputChange('gridRows', formData.gridRows)}
            />
          </div>
          
          <div class="form-group">
            <label for="grid-gap">Grid Gap (px)</label>
            <Input
              id="grid-gap"
              type="number"
              bind:value={formData.gridGap}
              min="0"
              max="50"
              error={formErrors.gridGap}
              on:change={() => handleInputChange('gridGap', formData.gridGap)}
            />
          </div>
          
          <div class="form-group">
            <label for="grid-padding">Grid Padding (px)</label>
            <Input
              id="grid-padding"
              type="number"
              bind:value={formData.gridPadding}
              min="0"
              max="100"
              error={formErrors.gridPadding}
              on:change={() => handleInputChange('gridPadding', formData.gridPadding)}
            />
          </div>
        </div>
        
        <div class="layout-preview">
          <h4>Layout Preview</h4>
          <div class="preview-grid" style="--columns: {formData.gridColumns}; --rows: {formData.gridRows}; --gap: {formData.gridGap}px; --padding: {formData.gridPadding}px;">
            {#each Array(formData.gridColumns * formData.gridRows) as _, i}
              <div class="preview-cell">{i + 1}</div>
            {/each}
          </div>
        </div>
      </div>
    {:else if activeTab === 'templates'}
      <div class="tab-section">
        <h3>Workspace Templates</h3>
        
        <WorkspaceTemplate
          {templates}
          bind:selectedTemplate
          showPreview={showTemplatePreview}
          on:templateSelect={handleTemplateSelect}
          on:templatePreview={handleTemplatePreview}
          on:templateApply={handleTemplateApply}
          on:createTemplate={() => dispatch('createTemplate')}
        />
      </div>
    {:else if activeTab === 'import'}
      <div class="tab-section">
        <h3>Import Workspace</h3>
        
        <WorkspaceImport
          bind:isLoading={isImporting}
          {importHistory}
          on:import={handleImport}
          on:historyImport={handleHistoryImport}
          on:fileSelect={(e) => dispatch('fileSelected', e.detail)}
        />
      </div>
    {/if}
  </div>
</div>

<style>
  .workspace-settings-panel {
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
  
  .form-group.full-width {
    grid-column: 1 / -1;
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
  }
  
  .checkbox-label input[type="checkbox"] {
    margin: 0;
  }
  
  .form-select {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: var(--font-size-sm);
  }
  
  .form-select:focus {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
  
  .layout-preview {
    margin-top: var(--space-6);
  }
  
  .layout-preview h4 {
    margin: 0 0 var(--space-3) 0;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
  }
  
  .preview-grid {
    display: grid;
    grid-template-columns: repeat(var(--columns), 1fr);
    grid-template-rows: repeat(var(--rows), 60px);
    gap: var(--gap);
    padding: var(--padding);
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  
  .preview-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    font-weight: var(--font-weight-medium);
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
    
    .tab-content {
      padding: var(--space-4);
    }
    
    .form-grid {
      grid-template-columns: 1fr;
      gap: var(--space-3);
    }
    
    .preview-grid {
      grid-template-rows: repeat(var(--rows), 40px);
    }
  }
</style>
