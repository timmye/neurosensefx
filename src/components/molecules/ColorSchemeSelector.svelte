<script>
  import { createEventDispatcher } from 'svelte';
  import { Button, Badge, Icon } from '../atoms/index.js';
  
  export let schemes = [];
  export let selectedScheme = 'default';
  export let customColors = {};
  export let showCustomEditor = false;
  export let compact = false;
  
  const dispatch = createEventDispatcher();
  
  // Predefined color schemes
  const predefinedSchemes = [
    {
      id: 'default',
      name: 'Default Dark',
      description: 'Professional dark theme optimized for trading',
      colors: {
        primary: '#6366f1',
        secondary: '#8b5cf6',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
        background: '#0f172a',
        surface: '#1e293b',
        text: '#f1f5f9',
        textSecondary: '#94a3b8'
      },
      preview: {
        primary: 'bg-indigo-500',
        secondary: 'bg-purple-500',
        success: 'bg-emerald-500',
        warning: 'bg-amber-500',
        danger: 'bg-red-500'
      }
    },
    {
      id: 'light',
      name: 'Professional Light',
      description: 'Clean light theme for daytime trading',
      colors: {
        primary: '#4f46e5',
        secondary: '#7c3aed',
        success: '#059669',
        warning: '#d97706',
        danger: '#dc2626',
        info: '#2563eb',
        background: '#ffffff',
        surface: '#f8fafc',
        text: '#1e293b',
        textSecondary: '#64748b'
      },
      preview: {
        primary: 'bg-indigo-600',
        secondary: 'bg-purple-600',
        success: 'bg-emerald-600',
        warning: 'bg-amber-600',
        danger: 'bg-red-600'
      }
    },
    {
      id: 'highContrast',
      name: 'High Contrast',
      description: 'Maximum contrast for accessibility',
      colors: {
        primary: '#0066cc',
        secondary: '#004499',
        success: '#008800',
        warning: '#ff8800',
        danger: '#cc0000',
        info: '#0088cc',
        background: '#000000',
        surface: '#1a1a1a',
        text: '#ffffff',
        textSecondary: '#cccccc'
      },
      preview: {
        primary: 'bg-blue-600',
        secondary: 'bg-blue-800',
        success: 'bg-green-600',
        warning: 'bg-orange-500',
        danger: 'bg-red-600'
      }
    },
    {
      id: 'ocean',
      name: 'Ocean Blue',
      description: 'Calming blue theme for extended sessions',
      colors: {
        primary: '#0ea5e9',
        secondary: '#06b6d4',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6',
        background: '#0c4a6e',
        surface: '#075985',
        text: '#f0f9ff',
        textSecondary: '#bae6fd'
      },
      preview: {
        primary: 'bg-sky-500',
        secondary: 'bg-cyan-500',
        success: 'bg-emerald-500',
        warning: 'bg-amber-500',
        danger: 'bg-red-500'
      }
    },
    {
      id: 'forest',
      name: 'Forest Green',
      description: 'Nature-inspired green theme',
      colors: {
        primary: '#059669',
        secondary: '#047857',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#06b6d4',
        background: '#052e16',
        surface: '#064e3b',
        text: '#ecfdf5',
        textSecondary: '#a7f3d0'
      },
      preview: {
        primary: 'bg-emerald-600',
        secondary: 'bg-emerald-700',
        success: 'bg-emerald-500',
        warning: 'bg-amber-500',
        danger: 'bg-red-500'
      }
    },
    {
      id: 'sunset',
      name: 'Sunset',
      description: 'Warm sunset colors for comfort',
      colors: {
        primary: '#f97316',
        secondary: '#ea580c',
        success: '#84cc16',
        warning: '#eab308',
        danger: '#ef4444',
        info: '#0ea5e9',
        background: '#431407',
        surface: '#7c2d12',
        text: '#fef3c7',
        textSecondary: '#fed7aa'
      },
      preview: {
        primary: 'bg-orange-500',
        secondary: 'bg-orange-600',
        success: 'bg-lime-500',
        warning: 'bg-yellow-500',
        danger: 'bg-red-500'
      }
    }
  ];
  
  $: availableSchemes = schemes.length > 0 ? schemes : predefinedSchemes;
  $: currentScheme = availableSchemes.find(scheme => scheme.id === selectedScheme) || availableSchemes[0];
  $: isCustom = selectedScheme === 'custom';
  
  function selectScheme(schemeId) {
    selectedScheme = schemeId;
    const scheme = availableSchemes.find(s => s.id === schemeId);
    
    if (scheme && schemeId !== 'custom') {
      dispatch('schemeChange', { schemeId, scheme });
      dispatch('colorsChange', { colors: scheme.colors });
    }
  }
  
  function handleColorChange(colorType, color) {
    if (!customColors[colorType]) {
      customColors[colorType] = currentScheme?.colors[colorType] || '#000000';
    }
    
    customColors[colorType] = color;
    customColors = { ...customColors }; // Trigger reactivity
    
    dispatch('customColorChange', { colorType, color });
    dispatch('colorsChange', { colors: { ...currentScheme.colors, ...customColors } });
  }
  
  function toggleCustomEditor() {
    showCustomEditor = !showCustomEditor;
    dispatch('customEditorToggle', { show: showCustomEditor });
  }
  
  function saveCustomScheme() {
    const customScheme = {
      id: 'custom',
      name: 'Custom Theme',
      description: 'User-defined color scheme',
      colors: { ...currentScheme.colors, ...customColors },
      preview: {
        primary: 'style="background-color: ' + (customColors.primary || currentScheme.colors.primary) + '"',
        secondary: 'style="background-color: ' + (customColors.secondary || currentScheme.colors.secondary) + '"',
        success: 'style="background-color: ' + (customColors.success || currentScheme.colors.success) + '"',
        warning: 'style="background-color: ' + (customColors.warning || currentScheme.colors.warning) + '"',
        danger: 'style="background-color: ' + (customColors.danger || currentScheme.colors.danger) + '"'
      }
    };
    
    dispatch('customSchemeSave', { scheme: customScheme });
    selectScheme('custom');
  }
  
  function resetCustomColors() {
    customColors = {};
    dispatch('customColorsReset');
  }
  
  function exportScheme() {
    const schemeToExport = isCustom ? {
      ...currentScheme,
      colors: { ...currentScheme.colors, ...customColors }
    } : currentScheme;
    
    const dataStr = JSON.stringify(schemeToExport, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${schemeToExport.name.replace(/\s+/g, '-').toLowerCase()}-theme.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    dispatch('schemeExport', { scheme: schemeToExport });
  }
  
  function importScheme(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedScheme = JSON.parse(e.target.result);
        
        // Validate imported scheme
        if (!importedScheme.colors || !importedScheme.name) {
          throw new Error('Invalid color scheme format');
        }
        
        dispatch('schemeImport', { scheme: importedScheme });
        
        // Add to available schemes if not already present
        if (!availableSchemes.find(s => s.id === importedScheme.id)) {
          availableSchemes = [...availableSchemes, importedScheme];
        }
        
        selectScheme(importedScheme.id);
      } catch (error) {
        console.error('Failed to import color scheme:', error);
        dispatch('importError', { error: error.message });
      }
    };
    
    reader.readAsText(file);
  }
</script>

<div class="color-scheme-selector" class:compact>
  <!-- Scheme Selection -->
  <div class="scheme-selection">
    <div class="selection-header">
      <h3 class="selection-title">
        <Icon name="palette" size="sm" />
        Color Scheme
      </h3>
      
      <div class="selection-actions">
        <Button
          variant="ghost"
          size="sm"
          on:click={exportScheme}
          title="Export current scheme"
        >
          <Icon name="download" size="xs" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          on:click={() => document.getElementById('scheme-import').click()}
          title="Import scheme"
        >
          <Icon name="upload" size="xs" />
        </Button>
        
        <input
          id="scheme-import"
          type="file"
          accept=".json"
          style="display: none"
          on:change={importScheme}
        />
      </div>
    </div>
    
    <div class="schemes-grid">
      {#each availableSchemes as scheme}
        <div
          class="scheme-card"
          class:selected={selectedScheme === scheme.id}
          on:click={() => selectScheme(scheme.id)}
          role="button"
          tabindex="0"
          on:keydown={(e) => e.key === 'Enter' && selectScheme(scheme.id)}
        >
          <!-- Color Preview -->
          <div class="scheme-preview">
            {#each ['primary', 'secondary', 'success', 'warning', 'danger'] as colorType}
              <div
                class="preview-color"
                class:preview-{colorType}
                style="background-color: {scheme.colors[colorType]}"
                title="{colorType}: {scheme.colors[colorType]}"
              ></div>
            {/each}
          </div>
          
          <!-- Scheme Info -->
          <div class="scheme-info">
            <div class="scheme-name">{scheme.name}</div>
            {!compact && (
              <div class="scheme-description">{scheme.description}</div>
            )}
            
            {scheme.id === 'custom' && (
              <Badge variant="outline" size="xs">Custom</Badge>
            )}
          </div>
        </div>
      {/each}
    </div>
  </div>
  
  <!-- Custom Color Editor -->
  {#if showCustomEditor || isCustom}
    <div class="custom-editor">
      <div class="editor-header">
        <h4 class="editor-title">
          <Icon name="sliders" size="sm" />
          Custom Colors
        </h4>
        
        <div class="editor-actions">
          {#if Object.keys(customColors).length > 0}
            <Button
              variant="outline"
              size="sm"
              on:click={resetCustomColors}
            >
              <Icon name="refresh-cw" size="xs" />
              Reset
            </Button>
          {/if}
          
          <Button
            variant="primary"
            size="sm"
            on:click={saveCustomScheme}
            disabled={Object.keys(customColors).length === 0}
          >
            <Icon name="save" size="xs" />
            Save Custom
          </Button>
        </div>
      </div>
      
      <div class="color-controls">
        {#each [
          { key: 'primary', label: 'Primary', description: 'Main interactive elements' },
          { key: 'secondary', label: 'Secondary', description: 'Secondary interactive elements' },
          { key: 'success', label: 'Success', description: 'Success states and confirmations' },
          { key: 'warning', label: 'Warning', description: 'Warning states and alerts' },
          { key: 'danger', label: 'Danger', description: 'Error states and destructive actions' },
          { key: 'info', label: 'Info', description: 'Information and help text' },
          { key: 'background', label: 'Background', description: 'Main background color' },
          { key: 'surface', label: 'Surface', description: 'Card and panel backgrounds' },
          { key: 'text', label: 'Text', description: 'Primary text color' },
          { key: 'textSecondary', label: 'Text Secondary', description: 'Secondary text color' }
        ] as colorConfig}
          <div class="color-control">
            <div class="color-info">
              <label class="color-label" for="color-{colorConfig.key}">
                {colorConfig.label}
              </label>
              <div class="color-description">{colorConfig.description}</div>
            </div>
            
            <div class="color-input-group">
              <input
                id="color-{colorConfig.key}"
                type="color"
                class="color-input"
                value={customColors[colorConfig.key] || currentScheme?.colors[colorConfig.key] || '#000000'}
                on:change={(e) => handleColorChange(colorConfig.key, e.target.value)}
              />
              
              <input
                type="text"
                class="color-text"
                value={customColors[colorConfig.key] || currentScheme?.colors[colorConfig.key] || '#000000'}
                on:change={(e) => handleColorChange(colorConfig.key, e.target.value)}
                placeholder="#000000"
              />
              
              {customColors[colorConfig.key] && (
                <Button
                  variant="ghost"
                  size="xs"
                  on:click={() => {
                    delete customColors[colorConfig.key];
                    customColors = { ...customColors };
                  }}
                  title="Reset to default"
                >
                  <Icon name="x" size="xs" />
                </Button>
              )}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
  
  <!-- Toggle Custom Editor -->
  {#if !isCustom}
    <div class="editor-toggle">
      <Button
        variant="outline"
        size="sm"
        on:click={toggleCustomEditor}
        class:w-full={compact}
      >
        <Icon name="sliders" size="sm" />
        {showCustomEditor ? 'Hide' : 'Show'} Custom Editor
      </Button>
    </div>
  {/if}
</div>

<style>
  .color-scheme-selector {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  
  .compact {
    gap: var(--space-3);
  }
  
  .selection-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-3);
  }
  
  .selection-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .selection-actions {
    display: flex;
    gap: var(--space-1);
  }
  
  .schemes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--space-3);
  }
  
  .compact .schemes-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-2);
  }
  
  .scheme-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--bg-secondary);
    border: 2px solid var(--border-default);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .scheme-card:hover {
    border-color: var(--border-hover);
    background: var(--bg-tertiary);
  }
  
  .scheme-card.selected {
    border-color: var(--color-primary);
    background: var(--color-primary-subtle);
  }
  
  .scheme-card:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
  
  .scheme-preview {
    display: flex;
    gap: var(--space-1);
    height: 24px;
  }
  
  .compact .scheme-preview {
    height: 20px;
  }
  
  .preview-color {
    flex: 1;
    border-radius: var(--radius-sm);
    transition: transform var(--motion-fast) var(--ease-snappy);
  }
  
  .scheme-card:hover .preview-color {
    transform: scaleY(1.2);
  }
  
  .scheme-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  
  .scheme-name {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
  }
  
  .scheme-description {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    line-height: 1.4;
  }
  
  .custom-editor {
    padding: var(--space-4);
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
  }
  
  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-4);
  }
  
  .editor-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .editor-actions {
    display: flex;
    gap: var(--space-2);
  }
  
  .color-controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .color-control {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-3);
  }
  
  .color-info {
    flex: 1;
  }
  
  .color-label {
    display: block;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
    margin-bottom: var(--space-1);
  }
  
  .color-description {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    line-height: 1.4;
  }
  
  .color-input-group {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .color-input {
    width: 40px;
    height: 32px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    cursor: pointer;
    background: transparent;
  }
  
  .color-text {
    width: 80px;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: var(--font-size-xs);
    font-family: var(--font-mono);
  }
  
  .color-text:focus {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
  
  .editor-toggle {
    margin-top: var(--space-2);
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .schemes-grid {
      grid-template-columns: 1fr;
    }
    
    .color-control {
      flex-direction: column;
      gap: var(--space-2);
    }
    
    .color-input-group {
      width: 100%;
    }
    
    .color-text {
      flex: 1;
    }
  }
</style>
