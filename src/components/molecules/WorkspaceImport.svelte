<script>
  import { createEventDispatcher } from 'svelte';
  import { Button, Input, Badge, Icon } from '../atoms/index.js';
  
  export let isLoading = false;
  export let importHistory = [];
  export let supportedFormats = ['json', 'nsfx', 'csv'];
  
  const dispatch = createEventDispatcher();
  
  let fileInput;
  let dragActive = false;
  let selectedFile = null;
  let previewData = null;
  let importError = null;
  
  function handleFileSelect(event) {
    const files = event.target.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }
  
  function handleFileDrop(event) {
    event.preventDefault();
    dragActive = false;
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }
  
  function handleDragOver(event) {
    event.preventDefault();
    dragActive = true;
  }
  
  function handleDragLeave(event) {
    event.preventDefault();
    dragActive = false;
  }
  
  async function handleFile(file) {
    importError = null;
    selectedFile = file;
    
    // Validate file format
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!supportedFormats.includes(fileExtension)) {
      importError = `Unsupported file format: ${fileExtension}. Supported formats: ${supportedFormats.join(', ')}`;
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      importError = 'File size exceeds 10MB limit';
      return;
    }
    
    try {
      const content = await readFileContent(file);
      previewData = await parseFileContent(content, fileExtension);
      dispatch('fileSelect', { file, content, preview: previewData });
    } catch (error) {
      importError = `Error reading file: ${error.message}`;
      previewData = null;
    }
  }
  
  function readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
  
  async function parseFileContent(content, format) {
    try {
      switch (format) {
        case 'json':
        case 'nsfx':
          return JSON.parse(content);
        case 'csv':
          return parseCSV(content);
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      throw new Error(`Invalid ${format.toUpperCase()} file: ${error.message}`);
    }
  }
  
  function parseCSV(content) {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header and one data row');
    }
    
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        data.push(row);
      }
    }
    
    return { type: 'csv', headers, data };
  }
  
  function handleImport() {
    if (!selectedFile || !previewData) return;
    
    isLoading = true;
    dispatch('import', { 
      file: selectedFile, 
      data: previewData,
      onSuccess: () => {
        isLoading = false;
        selectedFile = null;
        previewData = null;
        importError = null;
        if (fileInput) fileInput.value = '';
      },
      onError: (error) => {
        isLoading = false;
        importError = error.message || 'Import failed';
      }
    });
  }
  
  function handleCancel() {
    selectedFile = null;
    previewData = null;
    importError = null;
    if (fileInput) fileInput.value = '';
  }
  
  function handleHistoryImport(historyItem) {
    dispatch('historyImport', { item: historyItem });
  }
  
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  function formatDate(date) {
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString();
  }
</script>

<div class="workspace-import">
  <!-- File Upload Area -->
  <div 
    class="upload-area"
    class:drag-active
    on:drop={handleFileDrop}
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
  >
    <div class="upload-content">
      <Icon name="upload-cloud" size="lg" variant="muted" />
      
      <div class="upload-text">
        <h3>Import Workspace</h3>
        <p>Drag and drop a file here, or click to browse</p>
      </div>
      
      <div class="upload-formats">
        {#each supportedFormats as format}
          <Badge variant="outline" size="sm">{format.toUpperCase()}</Badge>
        {/each}
      </div>
      
      <input
        bind:this={fileInput}
        type="file"
        accept={supportedFormats.map(f => `.${f}`).join(',')}
        on:change={handleFileSelect}
        class="file-input"
      />
      
      <Button variant="outline" size="sm" on:click={() => fileInput?.click()}>
        <Icon name="folder-open" size="sm" />
        Browse Files
      </Button>
    </div>
  </div>
  
  <!-- File Preview -->
  {#if selectedFile && previewData}
    <div class="file-preview">
      <div class="preview-header">
        <div class="file-info">
          <Icon name="file-text" size="md" />
          <div class="file-details">
            <h4>{selectedFile.name}</h4>
            <p>{formatFileSize(selectedFile.size)} • {selectedFile.type || 'Unknown type'}</p>
          </div>
        </div>
        
        <div class="preview-actions">
          <Button variant="ghost" size="sm" on:click={handleCancel}>
            <Icon name="x" size="sm" />
            Cancel
          </Button>
          
          <Button 
            variant="primary" 
            size="sm" 
            on:click={handleImport}
            disabled={isLoading}
          >
            <Icon name="download" size="sm" />
            {isLoading ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </div>
      
      <!-- Preview Content -->
      <div class="preview-content">
        {#if previewData.type === 'csv'}
          <div class="csv-preview">
            <h5>CSV Data Preview ({previewData.data.length} rows)</h5>
            <div class="csv-table">
              <div class="csv-header">
                {#each previewData.headers as header}
                  <div class="csv-cell header">{header}</div>
                {/each}
              </div>
              {#each previewData.data.slice(0, 5) as row}
                <div class="csv-row">
                  {#each previewData.headers as header}
                    <div class="csv-cell">{row[header]}</div>
                  {/each}
                </div>
              {/each}
            </div>
            {#if previewData.data.length > 5}
              <p class="more-rows">... and {previewData.data.length - 5} more rows</p>
            {/if}
          </div>
        {:else if previewData.name || previewData.title}
          <div class="workspace-preview">
            <h5>Workspace Configuration</h5>
            <div class="workspace-info">
              <div class="info-item">
                <span class="label">Name:</span>
                <span class="value">{previewData.name || previewData.title}</span>
              </div>
              {#if previewData.description}
                <div class="info-item">
                  <span class="label">Description:</span>
                  <span class="value">{previewData.description}</span>
                </div>
              {/if}
              {#if previewData.layout?.canvases}
                <div class="info-item">
                  <span class="label">Canvases:</span>
                  <span class="value">{previewData.layout.canvases.length}</span>
                </div>
              {/if}
              {#if previewData.symbolSubscriptions}
                <div class="info-item">
                  <span class="label">Symbols:</span>
                  <span class="value">{previewData.symbolSubscriptions.join(', ')}</span>
                </div>
              {/if}
            </div>
          </div>
        {:else}
          <div class="json-preview">
            <h5>JSON Data Preview</h5>
            <pre class="json-content">{JSON.stringify(previewData, null, 2)}</pre>
          </div>
        {/if}
      </div>
    </div>
  {/if}
  
  <!-- Error Display -->
  {#if importError}
    <div class="error-message">
      <Icon name="alert-circle" size="sm" variant="danger" />
      <span>{importError}</span>
    </div>
  {/if}
  
  <!-- Import History -->
  {#if importHistory.length > 0}
    <div class="import-history">
      <h4>Recent Imports</h4>
      <div class="history-list">
        {#each importHistory.slice(0, 5) as item}
          <div class="history-item" on:click={() => handleHistoryImport(item)}>
            <div class="history-info">
              <Icon name="file-text" size="sm" />
              <div class="history-details">
                <span class="history-name">{item.name}</span>
                <span class="history-date">{formatDate(item.date)}</span>
              </div>
            </div>
            <div class="history-meta">
              <Badge variant="outline" size="xs">{item.type}</Badge>
              <Icon name="chevron-right" size="sm" variant="muted" />
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .workspace-import {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  
  .upload-area {
    border: 2px dashed var(--border-default);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    text-align: center;
    transition: all var(--motion-fast) var(--ease-snappy);
    background: var(--bg-secondary);
  }
  
  .upload-area:hover {
    border-color: var(--border-hover);
    background: var(--bg-tertiary);
  }
  
  .upload-area.drag-active {
    border-color: var(--color-primary);
    background: var(--color-primary-subtle);
  }
  
  .upload-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
  }
  
  .upload-text h3 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .upload-text p {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--text-secondary);
  }
  
  .upload-formats {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .file-input {
    display: none;
  }
  
  .file-preview {
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  
  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4);
    border-bottom: 1px solid var(--border-subtle);
    background: var(--bg-tertiary);
  }
  
  .file-info {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  
  .file-details h4 {
    margin: 0;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .file-details p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
  
  .preview-actions {
    display: flex;
    gap: var(--space-2);
  }
  
  .preview-content {
    padding: var(--space-4);
  }
  
  .csv-preview h5,
  .workspace-preview h5,
  .json-preview h5 {
    margin: 0 0 var(--space-3) 0;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .csv-table {
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  
  .csv-header {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-subtle);
  }
  
  .csv-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    border-bottom: 1px solid var(--border-subtle);
  }
  
  .csv-row:last-child {
    border-bottom: none;
  }
  
  .csv-cell {
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-sm);
    border-right: 1px solid var(--border-subtle);
  }
  
  .csv-cell:last-child {
    border-right: none;
  }
  
  .csv-cell.header {
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .more-rows {
    margin: var(--space-2) 0 0 0;
    font-size: var(--font-size-sm);
    color: var(--text-tertiary);
    font-style: italic;
  }
  
  .workspace-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .info-item {
    display: flex;
    gap: var(--space-2);
  }
  
  .info-item .label {
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    min-width: 80px;
  }
  
  .info-item .value {
    color: var(--text-secondary);
  }
  
  .json-content {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    overflow-x: auto;
    max-height: 200px;
    overflow-y: auto;
  }
  
  .error-message {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--color-danger-subtle);
    border: 1px solid var(--color-danger);
    border-radius: var(--radius-md);
    color: var(--color-danger);
    font-size: var(--font-size-sm);
  }
  
  .import-history h4 {
    margin: 0 0 var(--space-3) 0;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .history-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .history-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3);
    background: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .history-item:hover {
    background: var(--bg-tertiary);
    border-color: var(--border-hover);
  }
  
  .history-info {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .history-details {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  
  .history-name {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
  }
  
  .history-date {
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
  }
  
  .history-meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .upload-area {
      padding: var(--space-4);
    }
    
    .preview-header {
      flex-direction: column;
      gap: var(--space-3);
      align-items: flex-start;
    }
    
    .csv-header,
    .csv-row {
      grid-template-columns: 1fr;
    }
    
    .history-item {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-2);
    }
  }
</style>
