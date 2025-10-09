<script>
  import { createEventDispatcher } from 'svelte';
  import { Badge, Icon, Button } from '../atoms/index.js';
  
  export let templates = [];
  export let selectedTemplate = null;
  export let compact = false;
  export let showPreview = false;
  
  const dispatch = createEventDispatcher();
  
  function handleTemplateSelect(template) {
    selectedTemplate = template;
    dispatch('templateSelect', { template });
  }
  
  function handleTemplatePreview(template) {
    dispatch('templatePreview', { template });
  }
  
  function handleTemplateApply(template) {
    dispatch('templateApply', { template });
  }
  
  function getTemplateIcon(type) {
    switch (type) {
      case 'day-trading': return 'trending-up';
      case 'swing-trading': return 'bar-chart-2';
      case 'position-trading': return 'trending-down';
      case 'scalping': return 'zap';
      case 'multi-timeframe': return 'layers';
      case 'custom': return 'settings';
      default: return 'grid';
    }
  }
  
  function getTemplateColor(type) {
    switch (type) {
      case 'day-trading': return 'success';
      case 'swing-trading': return 'primary';
      case 'position-trading': return 'warning';
      case 'scalping': return 'danger';
      case 'multi-timeframe': return 'info';
      case 'custom': return 'muted';
      default: return 'default';
    }
  }
</script>

<div class="workspace-templates" class:compact>
  {#each templates as template (template.id)}
    <div 
      class="template-card"
      class:selected={selectedTemplate?.id === template.id}
      class:compact
      on:click={() => handleTemplateSelect(template)}
      role="button"
      tabindex="0"
      on:keydown={(e) => e.key === 'Enter' && handleTemplateSelect(template)}
    >
      <!-- Template Header -->
      <div class="template-header">
        <div class="template-info">
          <div class="template-icon">
            <Icon 
              name={getTemplateIcon(template.type)} 
              variant={getTemplateColor(template.type)}
              size={compact ? 'sm' : 'md'}
            />
          </div>
          
          <div class="template-details">
            <h4 class="template-name">{template.name}</h4>
            <p class="template-description">{template.description}</p>
          </div>
        </div>
        
        <div class="template-meta">
          <Badge 
            variant={getTemplateColor(template.type)} 
            size="xs"
          >
            {template.type.replace('-', ' ')}
          </Badge>
          
          {#if template.isPremium}
            <Badge variant="warning" size="xs">
              <Icon name="star" size="xs" />
              Premium
            </Badge>
          {/if}
        </div>
      </div>
      
      <!-- Template Stats -->
      {#if !compact}
        <div class="template-stats">
          <div class="stat">
            <span class="stat-label">Canvases:</span>
            <span class="stat-value">{template.canvasCount || 0}</span>
          </div>
          
          <div class="stat">
            <span class="stat-label">Symbols:</span>
            <span class="stat-value">{template.symbolCount || 0}</span>
          </div>
          
          <div class="stat">
            <span class="stat-label">Layout:</span>
            <span class="stat-value">{template.layout || 'grid'}</span>
          </div>
        </div>
      {/if}
      
      <!-- Template Preview -->
      {#if showPreview && template.preview}
        <div class="template-preview">
          <img 
            src={template.preview} 
            alt={`${template.name} preview`}
            loading="lazy"
          />
        </div>
      {/if}
      
      <!-- Template Features -->
      {#if !compact && template.features}
        <div class="template-features">
          {#each template.features.slice(0, 3) as feature}
            <div class="feature">
              <Icon name="check-circle" size="xs" variant="success" />
              <span>{feature}</span>
            </div>
          {/each}
          
          {#if template.features.length > 3}
            <div class="feature more">
              <span>+{template.features.length - 3} more</span>
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- Template Actions -->
      <div class="template-actions">
        {#if showPreview}
        <div on:click|stopPropagation>
          <Button 
            variant="ghost" 
            size="sm"
            on:click={() => handleTemplatePreview(template)}
          >
            <Icon name="eye" size="sm" />
            Preview
          </Button>
        </div>
        {/if}
        
        <div on:click|stopPropagation>
          <Button 
            variant={selectedTemplate?.id === template.id ? 'primary' : 'outline'}
            size="sm"
            on:click={() => handleTemplateApply(template)}
          >
          <Icon name="download" size="sm" />
          Apply
          </Button>
        </div>
      </div>
    </div>
  {/each}
  
  {#if templates.length === 0}
    <div class="empty-state">
      <Icon name="grid" size="lg" variant="muted" />
      <h3>No Templates Available</h3>
      <p>Create custom workspaces or import templates to get started.</p>
      <Button variant="primary" size="sm" on:click={() => dispatch('createTemplate')}>
        <Icon name="plus" size="sm" />
        Create Template
      </Button>
    </div>
  {/if}
</div>

<style>
  .workspace-templates {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .workspace-templates.compact {
    gap: var(--space-2);
  }
  
  .template-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-snappy);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .template-card:hover {
    background: var(--bg-tertiary);
    border-color: var(--border-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }
  
  .template-card.selected {
    background: var(--bg-primary);
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-subtle);
  }
  
  .template-card:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
  
  .template-card.compact {
    padding: var(--space-3);
    gap: var(--space-2);
  }
  
  .template-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-3);
  }
  
  .template-info {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    flex: 1;
  }
  
  .template-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }
  
  .template-card.compact .template-icon {
    width: 32px;
    height: 32px;
  }
  
  .template-details h4 {
    margin: 0;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .template-details p {
    margin: var(--space-1) 0 0 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    line-height: 1.4;
  }
  
  .template-meta {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    align-items: flex-end;
  }
  
  .template-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-3);
    padding: var(--space-3) 0;
    border-top: 1px solid var(--border-subtle);
    border-bottom: 1px solid var(--border-subtle);
  }
  
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  
  .stat-label {
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .stat-value {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .template-preview {
    width: 100%;
    height: 120px;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--bg-tertiary);
  }
  
  .template-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .template-features {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .feature {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
  
  .feature.more {
    color: var(--text-tertiary);
    font-style: italic;
  }
  
  .template-actions {
    display: flex;
    gap: var(--space-2);
    justify-content: flex-end;
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: var(--space-8) var(--space-4);
    gap: var(--space-4);
  }
  
  .empty-state h3 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .empty-state p {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--text-secondary);
    max-width: 300px;
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .template-header {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-2);
    }
    
    .template-meta {
      flex-direction: row;
      align-items: center;
      gap: var(--space-2);
    }
    
    .template-stats {
      grid-template-columns: 1fr;
      gap: var(--space-2);
    }
    
    .stat {
      flex-direction: row;
      justify-content: space-between;
      text-align: left;
    }
    
    .template-actions {
      flex-direction: column;
    }
  }
</style>
