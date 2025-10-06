<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { Button, Badge, Icon, Checkbox } from '../atoms/index.js';
  
  // Component props
  export let data = [];
  export let columns = [];
  export let loading = false;
  export let empty = false;
  export let error = null;
  export let selectable = false;
  export let multiSelect = false;
  export let sortable = true;
  export let filterable = false;
  export let searchable = false;
  export let paginated = false;
  export let pageSize = 10;
  export let currentPage = 1;
  export let totalPages = 1;
  export let totalItems = 0;
  export let sortColumn = null;
  export let sortDirection = 'asc'; // 'asc', 'desc'
  export let filters = {};
  export let searchQuery = '';
  export let selectedRows = [];
  export let expandable = false;
  export let striped = true;
  export let bordered = false;
  export let hoverable = true;
  export let compact = false;
  export let size = 'md'; // 'sm', 'md', 'lg'
  export let variant = 'default'; // 'default', 'bordered', 'elevated'
  export let stickyHeader = false;
  export let stickyColumns = [];
  export let virtualScrolling = false;
  export let rowHeight = 48;
  export let maxHeight = 400;
  export let showActions = true;
  export let actionColumnWidth = '120px';
  export let emptyMessage = 'No data available';
  export let errorMessage = 'Failed to load data';
  export let loadingMessage = 'Loading...';
  
  const dispatch = createEventDispatcher();
  
  // Table state
  let tableElement;
  let headerElement;
  let bodyElement;
  let scrollElement;
  let resizeObserver = null;
  let intersectionObserver = null;
  
  // Generate unique table ID
  $: tableId = `table-${Math.random().toString(36).substr(2, 9)}`;
  
  // Calculate CSS classes
  $: tableClasses = [
    'data-table',
    `data-table--${size}`,
    `data-table--${variant}`,
    striped && 'data-table--striped',
    bordered && 'data-table--bordered',
    hoverable && 'data-table--hoverable',
    compact && 'data-table--compact',
    selectable && 'data-table--selectable',
    expandable && 'data-table--expandable',
    stickyHeader && 'data-table--sticky-header',
    loading && 'data-table--loading',
    error && 'data-table--error'
  ].filter(Boolean).join(' ');
  
  // Processed data with sorting, filtering, and pagination
  $: processedData = processTableData(data, columns, sortColumn, sortDirection, filters, searchQuery);
  
  // Paginated data
  $: paginatedData = paginated ? getPaginatedData(processedData, currentPage, pageSize) : processedData;
  
  // Table dimensions for virtual scrolling
  $: tableHeight = virtualScrolling ? Math.min(processedData.length * rowHeight, maxHeight) : 'auto';
  $: visibleRows = virtualScrolling ? Math.ceil(maxHeight / rowHeight) + 2 : processedData.length;
  
  // Selection state
  $: allSelected = selectedRows.length === processedData.length && processedData.length > 0;
  $: someSelected = selectedRows.length > 0 && selectedRows.length < processedData.length;
  $: hasSelection = selectedRows.length > 0;
  
  // Initialize table
  onMount(() => {
    initializeTable();
  });
  
  onDestroy(() => {
    cleanupObservers();
  });
  
  function initializeTable() {
    // Set up resize observer for responsive behavior
    if (window.ResizeObserver && tableElement) {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(tableElement);
    }
    
    // Set up intersection observer for lazy loading
    if (window.IntersectionObserver && virtualScrolling) {
      intersectionObserver = new IntersectionObserver(handleIntersection, {
        root: scrollElement,
        rootMargin: '100px'
      });
    }
  }
  
  function cleanupObservers() {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    if (intersectionObserver) {
      intersectionObserver.disconnect();
    }
  }
  
  function handleResize(entries) {
    // Handle responsive table behavior
    dispatch('resize', { entries });
  }
  
  function handleIntersection(entries) {
    // Handle lazy loading for virtual scrolling
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        dispatch('loadMore', { visibleRows });
      }
    });
  }
  
  // Process table data with sorting, filtering, and searching
  function processTableData(data, columns, sortColumn, sortDirection, filters, searchQuery) {
    let processed = [...data];
    
    // Apply filters
    if (Object.keys(filters).length > 0) {
      processed = processed.filter(row => {
        return Object.entries(filters).every(([key, value]) => {
          if (value === null || value === undefined || value === '') return true;
          const cellValue = getCellValue(row, key);
          return String(cellValue).toLowerCase().includes(String(value).toLowerCase());
        });
      });
    }
    
    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      processed = processed.filter(row => {
        return columns.some(column => {
          const cellValue = getCellValue(row, column.key);
          return String(cellValue).toLowerCase().includes(query);
        });
      });
    }
    
    // Apply sorting
    if (sortColumn && sortable) {
      const column = columns.find(col => col.key === sortColumn);
      if (column && column.sortable !== false) {
        processed.sort((a, b) => {
          const aValue = getCellValue(a, sortColumn);
          const bValue = getCellValue(b, sortColumn);
          
          let comparison = 0;
          
          if (column.sortFunction) {
            comparison = column.sortFunction(aValue, bValue);
          } else if (typeof aValue === 'number' && typeof bValue === 'number') {
            comparison = aValue - bValue;
          } else {
            comparison = String(aValue).localeCompare(String(bValue));
          }
          
          return sortDirection === 'desc' ? -comparison : comparison;
        });
      }
    }
    
    return processed;
  }
  
  // Get paginated data
  function getPaginatedData(data, page, size) {
    const startIndex = (page - 1) * size;
    const endIndex = startIndex + size;
    return data.slice(startIndex, endIndex);
  }
  
  // Get cell value by key (supports nested properties)
  function getCellValue(row, key) {
    if (!key) return '';
    
    const keys = key.split('.');
    let value = row;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return '';
      }
    }
    
    return value;
  }
  
  // Handle column sorting
  function handleSort(column) {
    if (!sortable || column.sortable === false) return;
    
    if (sortColumn === column.key) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column.key;
      sortDirection = 'asc';
    }
    
    dispatch('sort', { column: column.key, direction: sortDirection });
  }
  
  // Handle row selection
  function handleRowSelect(row, event) {
    if (!selectable) return;
    
    const rowId = getRowId(row);
    
    if (multiSelect) {
      if (event.target.checked) {
        if (!selectedRows.includes(rowId)) {
          selectedRows = [...selectedRows, rowId];
        }
      } else {
        selectedRows = selectedRows.filter(id => id !== rowId);
      }
    } else {
      selectedRows = [rowId];
    }
    
    dispatch('rowSelect', { row, selected: true, selectedRows });
  }
  
  // Handle row click
  function handleRowClick(row, event) {
    // Don't trigger if clicking on checkbox or actions
    if (event.target.closest('.data-table__checkbox, .data-table__actions')) return;
    
    const rowId = getRowId(row);
    
    if (selectable && !multiSelect) {
      selectedRows = [rowId];
      dispatch('rowSelect', { row, selected: true, selectedRows });
    }
    
    dispatch('rowClick', { row, event });
  }
  
  // Handle select all
  function handleSelectAll(event) {
    if (!multiSelect) return;
    
    if (event.target.checked) {
      selectedRows = processedData.map(row => getRowId(row));
    } else {
      selectedRows = [];
    }
    
    dispatch('selectAll', { selectedRows, allSelected: event.target.checked });
  }
  
  // Handle row expansion
  function handleRowExpand(row) {
    if (!expandable) return;
    
    const rowId = getRowId(row);
    const expandedRows = (row.expanded || []).includes(rowId) 
      ? row.expanded.filter(id => id !== rowId)
      : [...(row.expanded || []), rowId];
    
    row.expanded = expandedRows;
    dispatch('rowExpand', { row, expanded: expandedRows.includes(rowId) });
  }
  
  // Handle cell action
  function handleCellAction(action, row, event) {
    if (action.handler) {
      action.handler(row, event);
    }
    dispatch('cellAction', { action, row, event });
  }
  
  // Handle pagination
  function handlePageChange(page) {
    currentPage = page;
    dispatch('pageChange', { page, pageSize });
  }
  
  function handlePageSizeChange(size) {
    pageSize = size;
    currentPage = 1;
    totalPages = Math.ceil(processedData.length / pageSize);
    dispatch('pageSizeChange', { pageSize, page: currentPage });
  }
  
  // Get unique row identifier
  function getRowId(row) {
    return row.id || row.key || JSON.stringify(row);
  }
  
  // Get sort icon
  function getSortIcon(column) {
    if (sortColumn !== column.key) return 'chevron-up';
    return sortDirection === 'asc' ? 'chevron-up' : 'chevron-down';
  }
  
  // Render cell content
  function renderCellContent(row, column) {
    const value = getCellValue(row, column.key);
    
    if (column.render) {
      return column.render(value, row);
    }
    
    if (column.type === 'badge') {
      return { type: 'badge', value, variant: column.variant || 'default' };
    }
    
    if (column.type === 'icon') {
      return { type: 'icon', value, size: column.iconSize || 'sm', variant: column.iconVariant || 'default' };
    }
    
    if (column.type === 'boolean') {
      return { type: 'boolean', value };
    }
    
    return value;
  }
</script>

<div class="data-table-wrapper" style="--table-height: {tableHeight}px; --row-height: {rowHeight}px;">
  <!-- Table header with controls -->
  {#if searchable || filterable || showActions}
    <div class="data-table__header">
      <div class="data-table__controls">
        {#if searchable}
          <div class="data-table__search">
            <input
              type="text"
              placeholder="Search..."
              bind:value={searchQuery}
              class="data-table__search-input"
            />
            <Icon name="search" size="sm" variant="muted" />
          </div>
        {/if}
        
        {#if filterable}
          <div class="data-table__filters">
            <Button variant="ghost" size="sm" onClick={() => dispatch('filterClick')}>
              <Icon name="filter" size="sm" />
              Filters
            </Button>
          </div>
        {/if}
      </div>
      
      {#if showActions && hasSelection}
        <div class="data-table__bulk-actions">
          <Badge variant="info" size="sm">{selectedRows.length} selected</Badge>
          <Button variant="ghost" size="sm" onClick={() => dispatch('bulkAction', { action: 'delete' })}>
            Delete
          </Button>
        </div>
      {/if}
    </div>
  {/if}
  
  <!-- Table container -->
  <div class="data-table__container" class:loading={loading} style="max-height: {maxHeight}px;">
    <table 
      id={tableId}
      class={tableClasses}
      bind:this={tableElement}
    >
      <!-- Table header -->
      <thead class="data-table__header-row" class:sticky={stickyHeader}>
        <tr class="data-table__header-tr">
          <!-- Select all checkbox -->
          {#if selectable && multiSelect}
            <th class="data-table__header-cell data-table__header-cell--checkbox">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={handleSelectAll}
                aria-label="Select all rows"
              />
            </th>
          {/if}
          
          <!-- Column headers -->
          {#each columns as column (column.key)}
            <th 
              class="data-table__header-cell"
              class:sortable={sortable && column.sortable !== false}
              class:sorted={sortColumn === column.key}
              class:sticky={stickyColumns.includes(column.key)}
              style={column.width ? `width: ${column.width};` : ''}
              onclick={() => handleSort(column)}
            >
              <div class="data-table__header-content">
                <span class="data-table__header-text">{column.title || column.key}</span>
                
                {#if sortable && column.sortable !== false}
                  <Icon 
                    name={getSortIcon(column)} 
                    size="xs" 
                    variant={sortColumn === column.key ? 'primary' : 'muted'}
                    class="data-table__sort-icon"
                  />
                {/if}
              </div>
            </th>
          {/each}
          
          <!-- Actions column -->
          {#if columns.some(col => col.actions)}
            <th class="data-table__header-cell data-table__header-cell--actions" style="width: {actionColumnWidth};">
              Actions
            </th>
          {/if}
        </tr>
      </thead>
      
      <!-- Table body -->
      <tbody class="data-table__body">
        {#if loading}
          <tr class="data-table__loading-row">
            <td colspan={columns.length + (selectable ? 1 : 0) + 1} class="data-table__loading-cell">
              <div class="data-table__loading-content">
                <Icon name="loader" class="data-table__loading-icon" />
                <span>{loadingMessage}</span>
              </div>
            </td>
          </tr>
        {:else if error}
          <tr class="data-table__error-row">
            <td colspan={columns.length + (selectable ? 1 : 0) + 1} class="data-table__error-cell">
              <div class="data-table__error-content">
                <Icon name="alert-circle" variant="danger" />
                <span>{errorMessage}</span>
                <Button variant="ghost" size="sm" onClick={() => dispatch('retry')}>
                  Retry
                </Button>
              </div>
            </td>
          </tr>
        {:else if processedData.length === 0}
          <tr class="data-table__empty-row">
            <td colspan={columns.length + (selectable ? 1 : 0) + 1} class="data-table__empty-cell">
              <div class="data-table__empty-content">
                <Icon name="inbox" variant="muted" size="lg" />
                <span>{emptyMessage}</span>
              </div>
            </td>
          </tr>
        {:else}
          {#each paginatedData as row, index (getRowId(row))}
            <tr 
              class="data-table__row"
              class:selected={selectedRows.includes(getRowId(row))}
              class:expanded={row.expanded?.includes(getRowId(row))}
              onclick={(e) => handleRowClick(row, e)}
            >
              <!-- Selection checkbox -->
              {#if selectable}
                <td class="data-table__cell data-table__cell--checkbox">
                  <Checkbox
                    checked={selectedRows.includes(getRowId(row))}
                    onChange={(e) => handleRowSelect(row, e)}
                    aria-label="Select row"
                  />
                </td>
              {/if}
              
              <!-- Data cells -->
              {#each columns as column (column.key)}
                <td 
                  class="data-table__cell"
                  class:sticky={stickyColumns.includes(column.key)}
                  class:data-table__cell--badge={column.type === 'badge'}
                  class:data-table__cell--icon={column.type === 'icon'}
                  class:data-table__cell--boolean={column.type === 'boolean'}
                  style={column.width ? `width: ${column.width};` : ''}
                >
                  <div class="data-table__cell-content">
                    {renderCellContent(row, column)}
                  </div>
                </td>
              {/each}
              
              <!-- Actions cell -->
              {#if columns.some(col => col.actions)}
                <td class="data-table__cell data-table__cell--actions">
                  <div class="data-table__cell-actions">
                    {#each columns.find(col => col.actions)?.actions || [] as action}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleCellAction(action, row, e)}
                        title={action.title}
                      >
                        <Icon name={action.icon} size="sm" />
                      </Button>
                    {/each}
                  </div>
                </td>
              {/if}
            </tr>
            
            <!-- Expanded row content -->
            {#if expandable && row.expanded?.includes(getRowId(row))}
              <tr class="data-table__expanded-row">
                <td colspan={columns.length + (selectable ? 1 : 0) + 1} class="data-table__expanded-cell">
                  <div class="data-table__expanded-content">
                    {#if row.expandedContent}
                      {row.expandedContent(row)}
                    {:else}
                      <p>Expanded content for {getRowId(row)}</p>
                    {/if}
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
  
  <!-- Table footer with pagination -->
  {#if paginated && processedData.length > 0}
    <div class="data-table__footer">
      <div class="data-table__pagination-info">
        Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, processedData.length)} of {processedData.length} entries
      </div>
      
      <div class="data-table__pagination-controls">
        <div class="data-table__page-size">
          <select 
            value={pageSize} 
            onchange={(e) => handlePageSizeChange(Number(e.target.value))}
            class="data-table__page-size-select"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        
        <div class="data-table__pagination">
          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => handlePageChange(currentPage - 1)}
          >
            <Icon name="chevron-left" />
          </Button>
          
          <div class="data-table__page-numbers">
            {#each Array(Math.min(5, totalPages)) as _, i}
              {@const pageNum = i + 1}
              <Button
                variant={currentPage === pageNum ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => handlePageChange(pageNum)}
              >
                {pageNum}
              </Button>
            {/each}
            
            {#if totalPages > 5}
              <span class="data-table__pagination-ellipsis">...</span>
              <Button
                variant={currentPage === totalPages ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => handlePageChange(totalPages)}
              >
                {totalPages}
              </Button>
            {/if}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
          >
            <Icon name="chevron-right" />
          </Button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .data-table-wrapper {
    display: flex;
    flex-direction: column;
    font-family: var(--font-sans);
    width: 100%;
    background: var(--bg-primary);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  
  /* Table header controls */
  .data-table__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-default);
  }
  
  .data-table__controls {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  
  .data-table__search {
    position: relative;
    display: flex;
    align-items: center;
  }
  
  .data-table__search-input {
    padding: var(--space-2) var(--space-8) var(--space-2) var(--space-3);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: var(--text-sm);
    width: 250px;
    transition: border-color var(--motion-fast) var(--ease-snappy);
  }
  
  .data-table__search-input:focus {
    outline: none;
    border-color: var(--color-focus);
    box-shadow: 0 0 0 2px var(--color-focus-subtle);
  }
  
  .data-table__search .icon {
    position: absolute;
    right: var(--space-3);
    pointer-events: none;
  }
  
  .data-table__bulk-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  /* Table container */
  .data-table__container {
    position: relative;
    overflow: auto;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
  }
  
  .data-table__container.loading {
    opacity: 0.6;
  }
  
  /* Table styles */
  .data-table {
    width: 100%;
    border-collapse: collapse;
    background: var(--bg-primary);
  }
  
  /* Size variants */
  .data-table--sm {
    font-size: var(--text-sm);
  }
  
  .data-table--md {
    font-size: var(--text-base);
  }
  
  .data-table--lg {
    font-size: var(--text-lg);
  }
  
  /* Style variants */
  .data-table--striped .data-table__row:nth-child(even) {
    background: var(--bg-tertiary);
  }
  
  .data-table--bordered {
    border: 1px solid var(--border-default);
  }
  
  .data-table--bordered .data-table__row {
    border-bottom: 1px solid var(--border-default);
  }
  
  .data-table--elevated {
    box-shadow: var(--shadow-sm);
  }
  
  .data-table--hoverable .data-table__row:hover {
    background: var(--bg-secondary);
  }
  
  .data-table--compact {
    --row-height: 32px;
  }
  
  .data-table--compact .data-table__cell {
    padding: var(--space-1) var(--space-2);
  }
  
  /* Header styles */
  .data-table__header-row {
    background: var(--bg-secondary);
    border-bottom: 2px solid var(--border-default);
  }
  
  .data-table__header-row.sticky {
    position: sticky;
    top: 0;
    z-index: 10;
  }
  
  .data-table__header-cell {
    padding: var(--space-3) var(--space-4);
    text-align: left;
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    border-bottom: 1px solid var(--border-default);
    user-select: none;
  }
  
  .data-table__header-cell.checkbox,
  .data-table__header-cell--checkbox {
    width: 40px;
    text-align: center;
  }
  
  .data-table__header-cell.actions,
  .data-table__header-cell--actions {
    width: var(--action-column-width, 120px);
    text-align: center;
  }
  
  .data-table__header-cell.sortable {
    cursor: pointer;
    transition: background-color var(--motion-fast) var(--ease-snappy);
  }
  
  .data-table__header-cell.sortable:hover {
    background: var(--bg-tertiary);
  }
  
  .data-table__header-cell.sticky {
    position: sticky;
    left: 0;
    z-index: 5;
    background: var(--bg-secondary);
  }
  
  .data-table__header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  
  .data-table__sort-icon {
    opacity: 0.5;
    transition: opacity var(--motion-fast) var(--ease-snappy);
  }
  
  .data-table__header-cell.sorted .data-table__sort-icon {
    opacity: 1;
  }
  
  /* Row styles */
  .data-table__row {
    transition: background-color var(--motion-fast) var(--ease-snappy);
  }
  
  .data-table__row.selected {
    background: var(--color-focus-subtle);
  }
  
  .data-table__row.expanded {
    background: var(--bg-secondary);
  }
  
  /* Cell styles */
  .data-table__cell {
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border-subtle);
    color: var(--text-primary);
    vertical-align: middle;
  }
  
  .data-table__cell.checkbox,
  .data-table__cell--checkbox {
    width: 40px;
    text-align: center;
  }
  
  .data-table__cell.actions,
  .data-table__cell--actions {
    width: var(--action-column-width, 120px);
    text-align: center;
  }
  
  .data-table__cell.sticky {
    position: sticky;
    left: 0;
    z-index: 5;
    background: var(--bg-primary);
  }
  
  .data-table__cell-content {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .data-table__cell-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
  }
  
  /* Special cell types */
  .data-table__cell--boolean {
    text-align: center;
  }
  
  /* Loading, error, and empty states */
  .data-table__loading-row,
  .data-table__error-row,
  .data-table__empty-row {
    height: 200px;
  }
  
  .data-table__loading-cell,
  .data-table__error-cell,
  .data-table__empty-cell {
    text-align: center;
    vertical-align: middle;
    padding: var(--space-8);
  }
  
  .data-table__loading-content,
  .data-table__error-content,
  .data-table__empty-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    color: var(--text-secondary);
  }
  
  .data-table__loading-icon {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  /* Expanded row */
  .data-table__expanded-row {
    background: var(--bg-secondary);
  }
  
  .data-table__expanded-cell {
    padding: 0;
  }
  
  .data-table__expanded-content {
    padding: var(--space-4);
    border-top: 1px solid var(--border-default);
  }
  
  /* Pagination */
  .data-table__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4);
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-default);
  }
  
  .data-table__pagination-info {
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }
  
  .data-table__pagination-controls {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }
  
  .data-table__page-size {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }
  
  .data-table__page-size-select {
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: var(--text-sm);
  }
  
  .data-table__pagination {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  
  .data-table__page-numbers {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  
  .data-table__pagination-ellipsis {
    padding: 0 var(--space-2);
    color: var(--text-tertiary);
  }
  
  /* Responsive design */
  @media (max-width: 768px) {
    .data-table__header {
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-3);
    }
    
    .data-table__controls {
      flex-direction: column;
      align-items: stretch;
    }
    
    .data-table__search-input {
      width: 100%;
    }
    
    .data-table__bulk-actions {
      justify-content: center;
    }
    
    .data-table__footer {
      flex-direction: column;
      gap: var(--space-3);
    }
    
    .data-table__pagination-controls {
      flex-direction: column;
      align-items: center;
    }
    
    .data-table__cell-content {
      flex-direction: column;
      align-items: flex-start;
    }
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .data-table__container {
      border-width: 2px;
    }
    
    .data-table__header-row {
      border-bottom-width: 2px;
    }
    
    .data-table__header-cell,
    .data-table__cell {
      border-bottom-width: 2px;
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .data-table__row,
    .data-table__header-cell.sortable,
    .data-table__sort-icon {
      transition: none !important;
    }
    
    .data-table__loading-icon {
      animation: none;
    }
  }
  
  /* Print styles */
  @media print {
    .data-table__header,
    .data-table__footer {
      display: none;
    }
    
    .data-table__container {
      overflow: visible;
      border: none;
    }
    
    .data-table__row {
      break-inside: avoid;
    }
  }
</style>
