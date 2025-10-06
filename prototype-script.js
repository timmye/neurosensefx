// NeuroSense FX Floating Interface JavaScript
// This file contains all the interactive functionality for the floating interface

// Global state
const state = {
    canvases: [
        { id: 'canvas-1', symbol: 'EURUSD', connected: true },
        { id: 'canvas-2', symbol: 'GBPUSD', connected: true },
        { id: 'canvas-3', symbol: 'USDJPY', connected: true }
    ],
    workspace: {
        name: 'Default Workspace',
        settings: {
            theme: 'dark',
            gridDensity: 'medium',
            animationSpeed: 5
        }
    },
    connectionType: 'simulation',
    canvasCount: 3,
    floatingElements: {},
    activePanel: null,
    draggedElement: null,
    dragOffset: { x: 0, y: 0 }
};

// Initialize the prototype
document.addEventListener('DOMContentLoaded', () => {
    initializeCanvases();
    initializeFloatingElements();
    initializeEventListeners();
    initializeKeyboardShortcuts();
    initializeDragAndDrop();
    startSimulation();
    
    // Load saved positions
    loadElementPositions();
});

// Initialize canvas visualizations
function initializeCanvases() {
    state.canvases.forEach(canvas => {
        const canvasElement = document.getElementById(`viz-${canvas.id}`);
        if (canvasElement) {
            drawVisualization(canvasElement, canvas.symbol);
        }
    });
}

// Initialize floating elements
function initializeFloatingElements() {
    // Store references to all floating elements
    state.floatingElements = {
        icons: document.querySelectorAll('.floating-icon'),
        panels: document.querySelectorAll('.floating-panel'),
        indicators: document.querySelectorAll('.floating-indicator'),
        controls: document.querySelectorAll('.floating-controls')
    };
}

// Initialize event listeners
function initializeEventListeners() {
    // Connection form
    document.getElementById('connectionType').addEventListener('change', (e) => {
        state.connectionType = e.target.value;
        updateConnectionStatus();
    });
    
    // Symbol input
    document.getElementById('symbol').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            connectToSymbol();
        }
    });
}

// Draw visualization on canvas
function drawVisualization(canvas, symbol) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, width, height);
    
    // Draw ADR boundaries (vertical lines)
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    
    // Left boundary
    ctx.beginPath();
    ctx.moveTo(width * 0.2, 0);
    ctx.lineTo(width * 0.2, height);
    ctx.stroke();
    
    // Right boundary
    ctx.beginPath();
    ctx.moveTo(width * 0.8, 0);
    ctx.lineTo(width * 0.8, height);
    ctx.stroke();
    
    ctx.setLineDash([]);
    
    // Draw ADR step markers (horizontal lines)
    const steps = 4;
    for (let i = 1; i < steps; i++) {
        const y = (height / steps) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    
    // Draw volatility orb (background circle)
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = 30;
    const volatility = Math.random() * 20 + 10; // Random volatility for demo
    
    // Create gradient for orb
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius + volatility);
    gradient.addColorStop(0, 'rgba(167, 139, 250, 0.1)');
    gradient.addColorStop(0.7, 'rgba(167, 139, 250, 0.05)');
    gradient.addColorStop(1, 'rgba(167, 139, 250, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius + volatility, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw market profile (simplified)
    drawMarketProfile(ctx, width, height);
    
    // Draw price float (horizontal line)
    const pricePosition = 0.3 + Math.random() * 0.4; // Random position for demo
    const priceY = height * (1 - pricePosition);
    
    ctx.shadowColor = '#a78bfa';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#a78bfa';
    ctx.fillRect(width * 0.3, priceY - 2, width * 0.4, 4);
    ctx.shadowBlur = 0;
    
    // Draw price display
    ctx.font = '14px SF Mono, Monaco, monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    const price = generateRandomPrice(symbol);
    ctx.fillText(price, centerX, priceY - 10);
}

// Draw market profile visualization
function drawMarketProfile(ctx, width, height) {
    const profileWidth = 40;
    const centerX = width / 2;
    
    // Left side (buy activity - blue)
    const buyGradient = ctx.createLinearGradient(centerX - profileWidth, 0, centerX, 0);
    buyGradient.addColorStop(0, 'rgba(59, 130, 246, 0.7)');
    buyGradient.addColorStop(1, 'rgba(59, 130, 246, 0.1)');
    
    ctx.fillStyle = buyGradient;
    ctx.beginPath();
    ctx.moveTo(centerX - profileWidth, height * 0.2);
    
    // Create wavy profile shape
    for (let y = height * 0.2; y <= height * 0.8; y += 5) {
        const x = centerX - profileWidth + Math.sin(y * 0.05) * 10 + Math.random() * 10;
        ctx.lineTo(x, y);
    }
    
    ctx.lineTo(centerX, height * 0.8);
    ctx.lineTo(centerX, height * 0.2);
    ctx.closePath();
    ctx.fill();
    
    // Right side (sell activity - red)
    const sellGradient = ctx.createLinearGradient(centerX, 0, centerX + profileWidth, 0);
    sellGradient.addColorStop(0, 'rgba(239, 68, 68, 0.1)');
    sellGradient.addColorStop(1, 'rgba(239, 68, 68, 0.7)');
    
    ctx.fillStyle = sellGradient;
    ctx.beginPath();
    ctx.moveTo(centerX, height * 0.2);
    ctx.lineTo(centerX, height * 0.8);
    
    // Create wavy profile shape
    for (let y = height * 0.8; y >= height * 0.2; y -= 5) {
        const x = centerX + Math.sin(y * 0.05) * 10 + Math.random() * 10;
        ctx.lineTo(x, y);
    }
    
    ctx.lineTo(centerX + profileWidth, height * 0.2);
    ctx.closePath();
    ctx.fill();
}

// Generate random price based on symbol
function generateRandomPrice(symbol) {
    const basePrices = {
        'EURUSD': 1.08,
        'GBPUSD': 1.27,
        'USDJPY': 147.50
    };
    
    const basePrice = basePrices[symbol] || 1.00;
    const variation = (Math.random() - 0.5) * 0.01;
    const price = basePrice + variation;
    
    return price.toFixed(symbol === 'USDJPY' ? 2 : 5);
}

// Initialize drag and drop functionality
function initializeDragAndDrop() {
    // Make all floating elements draggable
    const draggableElements = [
        ...document.querySelectorAll('.floating-icon'),
        ...document.querySelectorAll('.floating-panel'),
        ...document.querySelectorAll('.floating-indicator'),
        ...document.querySelectorAll('.floating-controls')
    ];
    
    draggableElements.forEach(element => {
        element.addEventListener('mousedown', startDrag);
    });
    
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
}

// Start dragging an element
function startDrag(e) {
    // Don't drag if clicking on a button inside the element
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
        return;
    }
    
    state.draggedElement = e.currentTarget;
    state.draggedElement.classList.add('dragging');
    
    const rect = state.draggedElement.getBoundingClientRect();
    state.dragOffset.x = e.clientX - rect.left;
    state.dragOffset.y = e.clientY - rect.top;
    
    // Bring to front
    state.draggedElement.style.zIndex = 1000;
}

// Drag an element
function drag(e) {
    if (!state.draggedElement) return;
    
    e.preventDefault();
    
    const x = e.clientX - state.dragOffset.x;
    const y = e.clientY - state.dragOffset.y;
    
    // Constrain to viewport
    const maxX = window.innerWidth - state.draggedElement.offsetWidth;
    const maxY = window.innerHeight - state.draggedElement.offsetHeight;
    
    const constrainedX = Math.max(0, Math.min(x, maxX));
    const constrainedY = Math.max(0, Math.min(y, maxY));
    
    state.draggedElement.style.left = `${constrainedX}px`;
    state.draggedElement.style.top = `${constrainedY}px`;
    state.draggedElement.style.right = 'auto';
    state.draggedElement.style.bottom = 'auto';
}

// End dragging an element
function endDrag(e) {
    if (!state.draggedElement) return;
    
    state.draggedElement.classList.remove('dragging');
    
    // Save position
    saveElementPosition(state.draggedElement);
    
    // Reset z-index after a short delay
    setTimeout(() => {
        if (state.draggedElement) {
            state.draggedElement.style.zIndex = '';
        }
    }, 100);
    
    state.draggedElement = null;
}

// Save element position to localStorage
function saveElementPosition(element) {
    const id = element.id;
    const position = {
        left: element.style.left,
        top: element.style.top,
        right: element.style.right,
        bottom: element.style.bottom
    };
    
    let savedPositions = JSON.parse(localStorage.getItem('floatingElementPositions') || '{}');
    savedPositions[id] = position;
    localStorage.setItem('floatingElementPositions', JSON.stringify(savedPositions));
}

// Load element positions from localStorage
function loadElementPositions() {
    const savedPositions = JSON.parse(localStorage.getItem('floatingElementPositions') || '{}');
    
    Object.keys(savedPositions).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            const position = savedPositions[id];
            Object.assign(element.style, position);
        }
    });
}

// Toggle floating panel
function toggleFloatingPanel(panelType) {
    const panelId = `${panelType}Panel`;
    const panel = document.getElementById(panelId);
    
    // Close any other open panels
    if (state.activePanel && state.activePanel !== panelId) {
        document.getElementById(state.activePanel).style.display = 'none';
    }
    
    // Toggle current panel
    if (panel.style.display === 'none' || !panel.style.display) {
        panel.style.display = 'block';
        state.activePanel = panelId;
        
        // Position panel near its icon
        const icon = document.getElementById(`${panelType}Icon`);
        if (icon) {
            const iconRect = icon.getBoundingClientRect();
            panel.style.left = `${iconRect.right + 10}px`;
            panel.style.top = `${iconRect.top}px`;
        }
    } else {
        panel.style.display = 'none';
        state.activePanel = null;
    }
}

// Connect to symbol
function connectToSymbol() {
    const symbolInput = document.getElementById('symbol');
    const symbol = symbolInput.value.trim().toUpperCase();
    
    if (!symbol) return;
    
    // Check if symbol already exists
    const existingCanvas = state.canvases.find(c => c.symbol === symbol);
    if (existingCanvas) {
        showNotification(`${symbol} is already being tracked`, 'warning');
        return;
    }
    
    // Add new canvas
    addCanvasForSymbol(symbol);
    showNotification(`Connected to ${symbol}`, 'success');
}

// Add new canvas for a symbol
function addCanvasForSymbol(symbol) {
    const canvasId = `canvas-${Date.now()}`;
    const newCanvas = {
        id: canvasId,
        symbol: symbol,
        connected: true
    };
    
    state.canvases.push(newCanvas);
    state.canvasCount++;
    
    // Create canvas element
    const workspaceGrid = document.getElementById('workspaceGrid');
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'canvas-container';
    canvasContainer.dataset.canvasId = canvasId;
    
    canvasContainer.innerHTML = `
        <div class="canvas-header">
            <span class="canvas-title">${symbol}</span>
            <div class="canvas-controls">
                <button class="btn btn-icon btn-small" onclick="toggleCanvasSettings('${canvasId}')">
                    <svg class="icon" viewBox="0 0 24 24">
                        <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5a3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97c0-.33-.03-.65-.07-.97l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65A.488.488 0 0 0 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.97c0 .33.03.65.07.97l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.13-.22.07-.49-.12-.64l-2.11-1.65Z"/>
                    </svg>
                </button>
                <button class="btn btn-icon btn-small" onclick="closeCanvas('${canvasId}')">×</button>
            </div>
        </div>
        <div class="canvas-visualization">
            <canvas width="220" height="120" id="viz-${canvasId}"></canvas>
        </div>
    `;
    
    workspaceGrid.appendChild(canvasContainer);
    
    // Initialize visualization
    const canvasElement = document.getElementById(`viz-${canvasId}`);
    drawVisualization(canvasElement, symbol);
    
    // Update canvas count
    document.getElementById('canvasCount').textContent = state.canvasCount;
    
    // Clear symbol input
    document.getElementById('symbol').value = '';
}

// Close canvas
function closeCanvas(canvasId) {
    const canvasIndex = state.canvases.findIndex(c => c.id === canvasId);
    if (canvasIndex === -1) return;
    
    // Remove from state
    state.canvases.splice(canvasIndex, 1);
    state.canvasCount--;
    
    // Remove from DOM
    const canvasElement = document.querySelector(`[data-canvas-id="${canvasId}"]`);
    if (canvasElement) {
        canvasElement.remove();
    }
    
    // Update canvas count
    document.getElementById('canvasCount').textContent = state.canvasCount;
}

// Toggle canvas settings
function toggleCanvasSettings(canvasId) {
    // This would open a settings modal for the specific canvas
    alert(`Settings for canvas ${canvasId}`);
}

// Add new canvas
function addCanvas() {
    const symbol = prompt('Enter symbol to track:');
    if (symbol) {
        addCanvasForSymbol(symbol.trim().toUpperCase());
    }
}

// Toggle grid
function toggleGrid() {
    const workspaceGrid = document.getElementById('workspaceGrid');
    
    if (workspaceGrid.style.display === 'flex') {
        workspaceGrid.style.display = 'grid';
    } else {
        workspaceGrid.style.display = 'flex';
        workspaceGrid.style.flexWrap = 'wrap';
    }
}

// Save workspace
function saveWorkspace() {
    const workspaceData = {
        name: state.workspace.name,
        canvases: state.canvases,
        settings: state.workspace.settings,
        elementPositions: JSON.parse(localStorage.getItem('floatingElementPositions') || '{}'),
        timestamp: new Date().toISOString()
    };
    
    // In a real app, this would save to localStorage or a server
    localStorage.setItem('neurosense_workspace', JSON.stringify(workspaceData));
    showNotification('Workspace saved successfully!', 'success');
}

// Load workspace
function loadWorkspace() {
    const savedWorkspace = localStorage.getItem('neurosense_workspace');
    if (!savedWorkspace) {
        showNotification('No saved workspace found', 'warning');
        return;
    }
    
    try {
        const workspaceData = JSON.parse(savedWorkspace);
        
        // Clear existing canvases
        const workspaceGrid = document.getElementById('workspaceGrid');
        workspaceGrid.innerHTML = '';
        
        // Load canvases from saved data
        state.canvases = [];
        state.canvasCount = 0;
        
        workspaceData.canvases.forEach(canvas => {
            addCanvasForSymbol(canvas.symbol);
        });
        
        // Load settings
        state.workspace = workspaceData.workspace || state.workspace;
        
        // Load element positions
        if (workspaceData.elementPositions) {
            localStorage.setItem('floatingElementPositions', JSON.stringify(workspaceData.elementPositions));
            loadElementPositions();
        }
        
        showNotification('Workspace loaded successfully!', 'success');
    } catch (error) {
        showNotification('Error loading workspace', 'error');
        console.error(error);
    }
}

// Switch settings tab
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Add symbol from floating panel
function addSymbolFromFloatingPanel() {
    const symbolInput = document.getElementById('newSymbol');
    const symbol = symbolInput.value.trim().toUpperCase();
    
    if (!symbol) return;
    
    // Check if symbol already exists
    const existingCanvas = state.canvases.find(c => c.symbol === symbol);
    if (existingCanvas) {
        showNotification(`${symbol} is already being tracked`, 'warning');
        return;
    }
    
    addCanvasForSymbol(symbol);
    symbolInput.value = '';
    toggleFloatingPanel('addSymbol');
    showNotification(`Added ${symbol}`, 'success');
}

// Close workspace modal
function closeWorkspaceModal() {
    const modal = document.getElementById('workspaceModal');
    modal.classList.remove('active');
}

// Create new workspace
function createNewWorkspace() {
    const name = prompt('Enter workspace name:');
    if (!name) return;
    
    // Clear existing canvases
    const workspaceGrid = document.getElementById('workspaceGrid');
    workspaceGrid.innerHTML = '';
    
    // Reset state
    state.canvases = [];
    state.canvasCount = 0;
    state.workspace.name = name;
    
    // Update UI
    document.getElementById('canvasCount').textContent = '0';
    
    closeWorkspaceModal();
    showNotification(`Created new workspace: ${name}`, 'success');
}

// Import workspace
function importWorkspace() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const workspaceData = JSON.parse(event.target.result);
                
                // Clear existing canvases
                const workspaceGrid = document.getElementById('workspaceGrid');
                workspaceGrid.innerHTML = '';
                
                // Load canvases
                state.canvases = [];
                state.canvasCount = 0;
                
                workspaceData.canvases.forEach(canvas => {
                    addCanvasForSymbol(canvas.symbol);
                });
                
                // Load settings
                state.workspace = workspaceData.workspace || state.workspace;
                
                // Load element positions
                if (workspaceData.elementPositions) {
                    localStorage.setItem('floatingElementPositions', JSON.stringify(workspaceData.elementPositions));
                    loadElementPositions();
                }
                
                closeWorkspaceModal();
                showNotification('Workspace imported successfully!', 'success');
            } catch (error) {
                showNotification('Error importing workspace', 'error');
                console.error(error);
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// Export workspace
function exportWorkspace() {
    const workspaceData = {
        name: state.workspace.name,
        canvases: state.canvases,
        settings: state.workspace.settings,
        elementPositions: JSON.parse(localStorage.getItem('floatingElementPositions') || '{}'),
        timestamp: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(workspaceData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `neurosense_workspace_${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    closeWorkspaceModal();
    showNotification('Workspace exported successfully!', 'success');
}

// Update connection status
function updateConnectionStatus() {
    const statusIndicator = document.querySelector('.indicator-light');
    const statusText = document.querySelector('.indicator-text');
    
    if (state.connectionType === 'live') {
        statusIndicator.classList.add('connected');
        statusIndicator.classList.remove('warning');
        statusText.textContent = 'Connected';
    } else {
        statusIndicator.classList.add('connected');
        statusIndicator.classList.remove('warning');
        statusText.textContent = 'Simulation';
    }
}

// Start simulation
function startSimulation() {
    setInterval(() => {
        // Update all canvases with new data
        state.canvases.forEach(canvas => {
            const canvasElement = document.getElementById(`viz-${canvas.id}`);
            if (canvasElement) {
                drawVisualization(canvasElement, canvas.symbol);
            }
        });
        
        // Update performance stats
        updatePerformanceStats();
    }, 1000); // Update every second
}

// Update performance statistics
function updatePerformanceStats() {
    // Simulate performance metrics
    const fps = 58 + Math.floor(Math.random() * 4);
    const memory = 40 + Math.floor(Math.random() * 15);
    
    const fpsElement = document.querySelector('.stat-value');
    const memoryElement = document.querySelectorAll('.stat-value')[1];
    
    if (fpsElement) fpsElement.textContent = fps;
    if (memoryElement) memoryElement.textContent = `${memory}MB`;
}

// Initialize keyboard shortcuts
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ignore if typing in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // Ctrl/Cmd + K: Quick add symbol
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            toggleFloatingPanel('addSymbol');
        }
        
        // Ctrl/Cmd + B: Toggle connection panel
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            toggleFloatingPanel('connection');
        }
        
        // Ctrl/Cmd + Shift + B: Toggle settings panel
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'B') {
            e.preventDefault();
            toggleFloatingPanel('settings');
        }
        
        // Ctrl/Cmd + W: Toggle workspace panel
        if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
            e.preventDefault();
            toggleFloatingPanel('workspace');
        }
        
        // Ctrl/Cmd + S: Save workspace
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveWorkspace();
        }
        
        // Ctrl/Cmd + O: Load workspace
        if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
            e.preventDefault();
            loadWorkspace();
        }
        
        // G: Toggle grid
        if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            toggleGrid();
        }
        
        // A: Add canvas
        if (e.key === 'a' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            addCanvas();
        }
        
        // Escape: Close all panels
        if (e.key === 'Escape') {
            if (state.activePanel) {
                document.getElementById(state.activePanel).style.display = 'none';
                state.activePanel = null;
            }
        }
    });
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 20px',
        background: type === 'success' ? 'var(--color-success)' : 
                    type === 'warning' ? 'var(--color-warning)' : 
                    type === 'error' ? 'var(--color-error)' : 'var(--color-focus)',
        color: 'white',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: '500',
        zIndex: '2000',
        opacity: '0',
        transform: 'translateY(-10px)',
        transition: 'all 0.3s ease'
    });
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Close modals when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('workspaceModal');
    if (e.target === modal) {
        closeWorkspaceModal();
    }
    
    // Close quick add modal when clicking outside
    const quickAddModal = document.getElementById('quickAddModal');
    if (e.target === quickAddModal) {
        quickAddModal.classList.remove('visible');
    }
});