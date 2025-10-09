<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { workspaceStore } from '../../stores/workspaceStore.js';
  import { Button } from '../atoms/Button.svelte';
  import { Modal } from '../organisms/Modal.svelte';
  import { DataTable } from '../organisms/DataTable.svelte';
  import { FormField } from '../molecules/FormField.svelte';
  import { Input } from '../atoms/Input.svelte';
  import { Select } from '../atoms/Select.svelte';
  import { Badge } from '../atoms/Badge.svelte';
  import { Icon } from '../atoms/Icon.svelte';
  
  const dispatch = createEventDispatcher();
  
  let templates = [];
  let showCreateModal = false;
  let showEditModal = false;
  let showPreviewModal = false;
  let selectedTemplate = null;
  let previewTemplate = null;
  let searchTerm = '';
  let categoryFilter = 'all';
  
  // Form data for create/edit
  let formData = {
    name: '',
    description: '',
    category: 'custom',
    layout: {},
    canvases: [],
    globalSettings: {},
    indicatorPresets: {},
    tags: []
  };
  
  // Predefined template categories
  const categories = [
    { value: 'all', label: 'All Templates' },
    { value: 'day-trading', label: 'Day Trading' },
    { value: 'swing-trading', label: 'Swing Trading' },
    { value: 'scalping', label: 'Scalping' },
    { value: 'position-trading', label: 'Position Trading' },
    { value: 'multi-timeframe', label: 'Multi-Timeframe' },
    { value: 'custom', label: 'Custom' }
  ];
  
  // Built-in templates
  const builtinTemplates = [
    {
      id: 'day-trading-default',
      name: 'Day Trading Default',
      description: 'Optimized for day trading with multiple timeframes',
      category: 'day-trading',
      isBuiltin: true,
      layout: {
        gridSettings: { columns: 3, rows: 2, gap: 10 },
        viewSettings: { zoom: 1, panX: 0, panY: 0 }
      },
      canvases: [
        { symbol: 'EURUSD', position: { x: 0, y: 0 }, size: { width: 300, height: 200 }, indicators: ['priceFloat', 'marketProfile'] },
        { symbol: 'GBPUSD', position: { x: 310, y: 0 }, size: { width: 300, height: 200 }, indicators: ['priceFloat', 'volatilityOrb'] },
        { symbol: 'USDJPY', position: { x: 620, y: 0 }, size: { width: 300, height: 200 }, indicators: ['adrMeter', 'priceDisplay'] }
      ],
      globalSettings: {
        density: 'high',
        theme: 'dark',
        autoSave: true
      },
      tags: ['day-trading', 'forex', 'multi-pair']
    },
    {
      id: 'scalping-quick',
      name: 'Scalping Quick',
      description: 'Minimal layout for rapid scalping decisions',
      category: 'scalping',
      isBuiltin: true,
      layout: {
        gridSettings: { columns: 2, rows: 1, gap: 5 },
        viewSettings: { zoom: 1.2, panX: 0, panY: 0 }
      },
      canvases: [
        { symbol: 'EURUSD', position: { x: 0, y: 0 }, size: { width: 400, height: 250 }, indicators: ['priceFloat', 'volatilityOrb', 'adrMeter'] }
      ],
      globalSettings: {
        density: 'maximum',
        theme: 'dark',
        autoSave: false
      },
      tags: ['scalping', 'fast', 'minimal']
    }
  ];
  
  onMount(() => {
    loadTemplates();
  });
  
  function loadTemplates() {
    // Load built-in templates
    templates = [...builtinTemplates];
    
    // Load custom templates from localStorage
    const customTemplates = localStorage.getItem('neurosense_workspace_templates');
    if (customTemplates) {
      try {
        const parsed = JSON.parse(customTemplates);
        templates.push(...parsed);
      } catch (error) {
        console.error('Failed to load custom templates:', error);
      }
    }
  }
  
  function saveTemplates() {
    const customTemplates = templates.filter(t => !t.isBuiltin);
    localStorage.setItem('neurosense_workspace_templates', JSON.stringify(customTemplates));
  }
  
  function filteredTemplates() {
    return templates.filter(template => {
      const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }
  
  function openCreateModal() {
    formData = {
      name: '',
      description: '',
      category: 'custom',
      layout: {},
      canvases: [],
      globalSettings: {},
      indicatorPresets: {},
      tags: []
    };
    showCreateModal = true;
  }
  
  function openEditModal(template) {
    selectedTemplate = template;
    formData = { ...template };
    showEditModal = true;
  }
  
  function openPreviewModal(template) {
    previewTemplate = template;
    showPreviewModal = true;
  }
  
  function createTemplate() {
    if (!formData.name.trim()) return;
    
    const newTemplate = {
      id: `template_${Date.now()}`,
      ...formData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    templates.push(newTemplate);
    saveTemplates();
    showCreateModal = false;
    dispatch('templateCreated', newTemplate);
  }
  
  function updateTemplate() {
    if (!selectedTemplate || !formData.name.trim()) return;
    
    const index = templates.findIndex(t => t.id === selectedTemplate.id);
    if (index !== -1) {
      templates[index] = {
        ...templates[index],
        ...formData,
        updatedAt: new Date()
      };
      saveTemplates();
      showEditModal = false;
      dispatch('templateUpdated', templates[index]);
    }
  }
  
  function deleteTemplate(templateId) {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    templates = templates.filter(t => t.id !== templateId);
    saveTemplates();
    dispatch('templateDeleted', templateId);
  }
  
  function applyTemplate(template) {
    if (!confirm(`Apply template "${template.name}" to current workspace?`)) return;
    
    // Create new workspace from template
    const workspaceId = workspaceStore.createWorkspace({
      name: `${template.name} Workspace`,
      description: template.description,
      layout: template.layout,
      globalSettings: template.globalSettings
    });
    
    // Add canvases from template
    template.canvases.forEach(canvasConfig => {
      workspaceStore.addCanvas(canvasConfig);
    });
    
    dispatch('templateApplied', { template, workspaceId });
  }
  
  function exportTemplate(template) {
    const dataStr = JSON.stringify(template, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${template.name.replace(/\s+/g, '_')}_template.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  
  function importTemplate(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const template = JSON.parse(e.target.result);
        template.id = `template_${Date.now()}`;
        template.importedAt = new Date();
        templates.push(template);
        saveTemplates();
        dispatch('templateImported', template);
      } catch (error) {
        alert('Invalid template file');
      }
    };
    reader.readAsText(file);
  }
  
  // Table columns for template list
  const tableColumns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    { key: 'description', label: 'Description' },
    { key: 'canvases', label: 'Canvases', sortable: true },
    { key: 'actions', label: 'Actions' }
  ];
  
  // Table data
  function tableData() {
    return filteredTemplates().map(template => ({
      name: template.name,
      category: template.category,
      description: template.description,
      canvases: template.canvases?.length || 0,
      isBuiltin: template.isBuiltin,
      template: template
    }));
  }
</script>

<div class="workspace-template-manager">
  <div class="template-header">
    <h2>Workspace Templates</h2>
    <div class="template-controls">
      <div class="search-filters">
        <Input
          placeholder="Search templates..."
          bind:value={searchTerm}
          class="search-input"
        />
        <Select
          options={categories}
          bind:value={categoryFilter}
          class="category-filter"
        />
      </div>
      <div class="template-actions">
        <Button onClick={openCreateModal}>
          <Icon name="plus" />
          Create Template
        </Button>
        <label for="template-import" class="import-button">
          <Button variant="outline">
            <Icon name="upload" />
            Import
          </Button>
          <input
            id="template-import"
            type="file"
            accept=".json"
            on:change={(e) => importTemplate(e.target.files[0])}
            style="display: none;"
          />
        </label>
      </div>
    </div>
  </div>
  
  <div class="template-content">
    <div class="template-list">
      {#each filteredTemplates() as template}
        <div class="template-item">
          <div class="template-info">
            <div class="template-name">
              <strong>{template.name}</strong>
              {template.isBuiltin && <Badge variant="secondary" size="sm">Built-in</Badge>}
            </div>
            <div class="template-meta">
              <Badge variant="outline">{template.category}</Badge>
              <span class="canvas-count">{template.canvases?.length || 0} canvases</span>
            </div>
            <p class="template-description">{template.description}</p>
          </div>
          <div class="template-actions">
            <Button size="sm" variant="ghost" onClick={() => openPreviewModal(template)}>
              <Icon name="eye" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => applyTemplate(template)}>
              <Icon name="download" />
            </Button>
            {!template.isBuiltin && (
              <>
                <Button size="sm" variant="ghost" onClick={() => openEditModal(template)}>
                  <Icon name="edit" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteTemplate(template.id)}>
                  <Icon name="trash" />
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={() => exportTemplate(template)}>
              <Icon name="share" />
            </Button>
          </div>
        </div>
      {/each}
    </div>
  </div>
  
  <!-- Create Template Modal -->
  <Modal bind:open={showCreateModal} title="Create Workspace Template">
    <div class="template-form">
      <FormField label="Template Name" required>
        <Input bind:value={formData.name} placeholder="Enter template name" />
      </FormField>
      
      <FormField label="Description">
        <Input bind:value={formData.description} placeholder="Describe this template" />
      </FormField>
      
      <FormField label="Category">
        <Select
          options={categories.filter(c => c.value !== 'all')}
          bind:value={formData.category}
        />
      </FormField>
      
      <FormField label="Tags (comma-separated)">
        <Input bind:value={formData.tags} placeholder="day-trading, forex, scalping" />
      </FormField>
      
      <div class="form-actions">
        <Button variant="outline" onClick={() => showCreateModal = false}>
          Cancel
        </Button>
        <Button onClick={createTemplate} disabled={!formData.name.trim()}>
          Create Template
        </Button>
      </div>
    </div>
  </Modal>
  
  <!-- Edit Template Modal -->
  <Modal bind:open={showEditModal} title="Edit Workspace Template">
    <div class="template-form">
      <FormField label="Template Name" required>
        <Input bind:value={formData.name} placeholder="Enter template name" />
      </FormField>
      
      <FormField label="Description">
        <Input bind:value={formData.description} placeholder="Describe this template" />
      </FormField>
      
      <FormField label="Category">
        <Select
          options={categories.filter(c => c.value !== 'all')}
          bind:value={formData.category}
        />
      </FormField>
      
      <FormField label="Tags (comma-separated)">
        <Input bind:value={formData.tags} placeholder="day-trading, forex, scalping" />
      </FormField>
      
      <div class="form-actions">
        <Button variant="outline" onClick={() => showEditModal = false}>
          Cancel
        </Button>
        <Button onClick={updateTemplate} disabled={!formData.name.trim()}>
          Update Template
        </Button>
      </div>
    </div>
  </Modal>
  
  <!-- Preview Template Modal -->
  <Modal bind:open={showPreviewModal} title="Template Preview" size="lg">
    {#if previewTemplate}
      <div class="template-preview">
        <div class="preview-header">
          <h3>{previewTemplate.name}</h3>
          <Badge variant="outline">{previewTemplate.category}</Badge>
        </div>
        
        <p class="preview-description">{previewTemplate.description}</p>
        
        <div class="preview-details">
          <div class="detail-section">
            <h4>Layout Configuration</h4>
            <pre>{JSON.stringify(previewTemplate.layout, null, 2)}</pre>
          </div>
          
          <div class="detail-section">
            <h4>Canvases ({previewTemplate.canvases?.length || 0})</h4>
            <ul>
              {#each previewTemplate.canvases || [] as canvas}
                <li>{canvas.symbol} - {canvas.indicators?.join(', ') || 'No indicators'}</li>
              {/each}
            </ul>
          </div>
          
          <div class="detail-section">
            <h4>Global Settings</h4>
            <pre>{JSON.stringify(previewTemplate.globalSettings, null, 2)}</pre>
          </div>
          
          {previewTemplate.tags && previewTemplate.tags.length > 0 && (
            <div class="detail-section">
              <h4>Tags</h4>
              <div class="tags">
                {#each previewTemplate.tags as tag}
                  <Badge variant="secondary" size="sm">{tag}</Badge>
                {/each}
              </div>
            </div>
          )}
        </div>
        
        <div class="preview-actions">
          <Button variant="outline" onClick={() => showPreviewModal = false}>
            Close
          </Button>
          <Button onClick={() => {
            applyTemplate(previewTemplate);
            showPreviewModal = false;
          }}>
            Apply Template
          </Button>
        </div>
      </div>
    {/if}
  </Modal>
</div>

<style>
  .workspace-template-manager {
    padding: var(--space-6);
  }
  
  .template-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-6);
  }
  
  .template-header h2 {
    margin: 0;
    color: var(--text-primary);
  }
  
  .template-controls {
    display: flex;
    gap: var(--space-4);
    align-items: center;
  }
  
  .search-filters {
    display: flex;
    gap: var(--space-3);
  }
  
  .search-input {
    width: 250px;
  }
  
  .category-filter {
    width: 150px;
  }
  
  .template-actions {
    display: flex;
    gap: var(--space-2);
  }
  
  .import-button {
    cursor: pointer;
  }
  
  .template-content {
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
  }
  
  .template-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .template-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4);
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .template-item:hover {
    border-color: var(--border-default);
    box-shadow: var(--shadow-sm);
  }
  
  .template-info {
    flex: 1;
  }
  
  .template-name {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }
  
  .template-meta {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-2);
  }
  
  .canvas-count {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
  
  .template-description {
    margin: 0;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }
  
  .template-item .template-actions {
    display: flex;
    gap: var(--space-1);
  }
  
  .template-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 400px;
  }
  
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
    padding-top: var(--space-4);
    border-top: 1px solid var(--border-default);
  }
  
  .template-preview {
    max-width: 600px;
  }
  
  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-4);
  }
  
  .preview-header h3 {
    margin: 0;
    color: var(--text-primary);
  }
  
  .preview-description {
    color: var(--text-secondary);
    margin-bottom: var(--space-6);
  }
  
  .preview-details {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }
  
  .detail-section h4 {
    margin: 0 0 var(--space-2) 0;
    color: var(--text-primary);
    font-weight: 600;
  }
  
  .detail-section pre {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    font-size: var(--font-size-xs);
    overflow-x: auto;
  }
  
  .detail-section ul {
    margin: 0;
    padding-left: var(--space-4);
  }
  
  .detail-section li {
    margin-bottom: var(--space-1);
    color: var(--text-secondary);
  }
  
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  
  .preview-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
    padding-top: var(--space-4);
    border-top: 1px solid var(--border-default);
  }
  
  @media (max-width: 768px) {
    .template-header {
      flex-direction: column;
      gap: var(--space-4);
      align-items: stretch;
    }
    
    .template-controls {
      flex-direction: column;
      gap: var(--space-3);
    }
    
    .search-filters {
      flex-direction: column;
    }
    
    .search-input,
    .category-filter {
      width: 100%;
    }
    
    .template-form {
      min-width: auto;
    }
  }
</style>
