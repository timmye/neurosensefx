/**
 * Professional Trading Simulator
 *
 * Simulates realistic professional trading workflows and market conditions
 * for extended session testing. This includes:
 * - Real market data simulation
 * - Professional user interaction patterns
 * - Multi-display management workflows
 * - Trading session lifecycle events
 */

export class ProfessionalTradingSimulator {
  constructor() {
    this.isRunning = false;
    this.sessionId = null;
    this.simulationStartTime = null;
    this.activeDisplays = new Map();
    this.marketDataSimulator = null;
    this.userInteractionSimulator = null;
    this.displayLifecycleManager = null;
    this.operationHistory = [];
    this.symbols = [
      'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD',
      'NZD/USD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'EUR/CHF',
      'USD/CHF', 'EUR/AUD', 'GBP/AUD', 'AUD/JPY', 'CAD/JPY'
    ];
    this.currentMarketData = new Map();
    this.volatilityPatterns = new Map();
  }

  async initialize(options = {}) {
    this.sessionId = options.sessionId;
    this.simulationStartTime = Date.now();

    // Initialize market data simulator
    this.marketDataSimulator = new MarketDataSimulator(this.symbols);

    // Initialize user interaction simulator
    this.userInteractionSimulator = new UserInteractionSimulator();

    // Initialize display lifecycle manager
    this.displayLifecycleManager = new DisplayLifecycleManager();

    console.log('📊 Professional Trading Simulator initialized');
  }

  async start() {
    if (this.isRunning) {
      console.warn('Trading simulator already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting Professional Trading Simulation...');

    // Start market data simulation
    await this.marketDataSimulator.start();

    // Start user interaction simulation
    await this.userInteractionSimulator.start();

    // Start display lifecycle management
    await this.displayLifecycleManager.start();

    console.log('✅ Professional Trading Simulation started');
  }

  async stop() {
    if (!this.isRunning) {
      console.warn('Trading simulator not running');
      return;
    }

    this.isRunning = false;
    console.log('🛑 Stopping Professional Trading Simulation...');

    // Stop all components
    await this.marketDataSimulator.stop();
    await this.userInteractionSimulator.stop();
    await this.displayLifecycleManager.stop();

    // Clean up displays
    await this.cleanupAllDisplays();

    console.log('✅ Professional Trading Simulation stopped');
  }

  /**
   * Get recent trading operations
   */
  getRecentOperations(limit = 10) {
    return this.operationHistory.slice(-limit);
  }

  /**
   * Cleanup all displays
   */
  async cleanupAllDisplays() {
    const operations = [];

    for (const [displayId, display] of this.activeDisplays) {
      const operation = {
        type: 'display_cleanup',
        timestamp: Date.now(),
        displayId,
        details: { reason: 'session_end' }
      };

      // Trigger display removal
      this.removeDisplay(displayId);
      operations.push(operation);
    }

    this.operationHistory.push(...operations);
    this.activeDisplays.clear();
  }

  /**
   * Remove a display
   */
  removeDisplay(displayId) {
    const removeEvent = new CustomEvent('removeDisplay', {
      detail: { displayId },
      bubbles: true
    });
    document.dispatchEvent(removeEvent);
    this.activeDisplays.delete(displayId);
  }
}

/**
 * Market Data Simulator
 */
class MarketDataSimulator {
  constructor(symbols) {
    this.symbols = symbols;
    this.isRunning = false;
    this.updateInterval = null;
    this.currentPrices = new Map();
    this.priceHistory = new Map();
    this.volatilityFactors = new Map();
    this.marketConditions = 'normal'; // normal, volatile, quiet
    this.updateFrequency = 100; // 10 updates per second (real-time)
  }

  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.initializePrices();
    this.startPriceUpdates();
    console.log('📈 Market Data Simulator started');
  }

  async stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    console.log('📉 Market Data Simulator stopped');
  }

  initializePrices() {
    this.symbols.forEach(symbol => {
      // Initialize with realistic forex prices
      let basePrice;
      if (symbol.includes('USD')) {
        if (symbol.startsWith('USD') || symbol.endsWith('/USD')) {
          basePrice = 0.9 + Math.random() * 0.3; // 0.9-1.2 range
        } else {
          basePrice = 1.0 + Math.random() * 0.5; // 1.0-1.5 range
        }
      } else {
        basePrice = 0.8 + Math.random() * 0.8; // 0.8-1.6 range
      }

      this.currentPrices.set(symbol, basePrice);
      this.volatilityFactors.set(symbol, 0.0001 + Math.random() * 0.0003); // 10-30 pips volatility

      // Initialize price history
      this.priceHistory.set(symbol, [{
        price: basePrice,
        timestamp: Date.now(),
        volume: 1000 + Math.random() * 9000
      }]);
    });
  }

  startPriceUpdates() {
    this.updateInterval = setInterval(() => {
      this.updatePrices();
    }, this.updateFrequency);
  }

  updatePrices() {
    const currentTime = Date.now();
    const timeOfDay = new Date().getUTCHours();

    // Adjust market conditions based on time of day
    this.adjustMarketConditions(timeOfDay);

    this.symbols.forEach(symbol => {
      const currentPrice = this.currentPrices.get(symbol);
      const volatility = this.volatilityFactors.get(symbol);

      // Apply market condition multiplier
      const conditionMultiplier = this.getConditionMultiplier();
      const adjustedVolatility = volatility * conditionMultiplier;

      // Calculate price movement
      const priceChange = this.calculatePriceChange(currentPrice, adjustedVolatility);
      const newPrice = currentPrice + priceChange;

      // Update current price
      this.currentPrices.set(symbol, newPrice);

      // Add to price history
      const history = this.priceHistory.get(symbol);
      history.push({
        price: newPrice,
        timestamp: currentTime,
        volume: this.calculateVolume(),
        spread: this.calculateSpread(symbol)
      });

      // Keep history manageable (last 1000 points)
      if (history.length > 1000) {
        history.shift();
      }

      // Trigger market data update event
      this.triggerMarketDataUpdate(symbol, newPrice, history[history.length - 1]);
    });

    // Update window variables for external monitoring
    if (window) {
      window.marketDataBuffer = window.marketDataBuffer || [];
      window.marketDataTimestamps = window.marketDataTimestamps || [];
      window.lastMarketDataUpdate = currentTime;

      this.symbols.forEach(symbol => {
        const data = this.priceHistory.get(symbol);
        if (data && data.length > 0) {
          window.marketDataBuffer.push({
            symbol,
            ...data[data.length - 1]
          });
        }
      });

      window.marketDataTimestamps.push(currentTime);

      // Keep buffers manageable
      if (window.marketDataBuffer.length > 100) {
        window.marketDataBuffer.shift();
      }
      if (window.marketDataTimestamps.length > 100) {
        window.marketDataTimestamps.shift();
      }
    }
  }

  adjustMarketConditions(timeOfDay) {
    // Simulate different market conditions based on trading sessions
    if ((timeOfDay >= 8 && timeOfDay <= 16) || (timeOfDay >= 13 && timeOfDay <= 21)) {
      // Major session overlap (London/New York or Tokyo/London)
      this.marketConditions = 'volatile';
    } else if ((timeOfDay >= 0 && timeOfDay <= 5) || (timeOfDay >= 22 && timeOfDay <= 23)) {
      // Quiet periods
      this.marketConditions = 'quiet';
    } else {
      this.marketConditions = 'normal';
    }
  }

  getConditionMultiplier() {
    switch (this.marketConditions) {
      case 'volatile': return 2.5;
      case 'quiet': return 0.3;
      default: return 1.0;
    }
  }

  calculatePriceChange(currentPrice, volatility) {
    // Use a more sophisticated price movement model
    const trend = Math.sin(Date.now() / 100000) * 0.2; // Slow trend component
    const randomWalk = (Math.random() - 0.5) * volatility; // Random component
    const momentum = this.calculateMomentum() * volatility * 0.1; // Momentum component

    return trend + randomWalk + momentum;
  }

  calculateMomentum() {
    // Simple momentum based on recent price movements
    return (Math.random() - 0.5) * 2;
  }

  calculateVolume() {
    // Realistic volume patterns
    const baseVolume = 1000;
    const volatility = Math.random() * 5000;
    const sessionMultiplier = this.marketConditions === 'volatile' ? 2 : 1;

    return Math.round(baseVolume + volatility * sessionMultiplier);
  }

  calculateSpread(symbol) {
    // Realistic spread based on symbol
    const baseSpread = symbol.includes('JPY') ? 0.01 : 0.0001;
    const volatilitySpread = this.marketConditions === 'volatile' ? baseSpread * 2 : baseSpread;
    return volatilitySpread + (Math.random() - 0.5) * 0.00005;
  }

  triggerMarketDataUpdate(symbol, price, data) {
    const updateEvent = new CustomEvent('marketDataUpdate', {
      detail: {
        symbol,
        price,
        timestamp: data.timestamp,
        volume: data.volume,
        spread: data.spread,
        high: this.getHigh(symbol, 50),
        low: this.getLow(symbol, 50),
        change: this.getChange(symbol)
      },
      bubbles: true
    });
    document.dispatchEvent(updateEvent);
  }

  getHigh(symbol, periods) {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length < periods) return null;

    return Math.max(...history.slice(-periods).map(h => h.price));
  }

  getLow(symbol, periods) {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length < periods) return null;

    return Math.min(...history.slice(-periods).map(h => h.price));
  }

  getChange(symbol) {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length < 2) return 0;

    const current = history[history.length - 1].price;
    const previous = history[history.length - 2].price;
    return current - previous;
  }
}

/**
 * User Interaction Simulator
 */
class UserInteractionSimulator {
  constructor() {
    this.isRunning = false;
    this.interactionInterval = null;
    this.interactionPatterns = [
      'create_display', 'move_display', 'resize_display', 'configure_display',
      'keyboard_shortcut', 'hover_display', 'context_menu', 'remove_display'
    ];
    this.interactionFrequency = 2000; // Average interaction every 2 seconds
  }

  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startInteractions();
    console.log('🖱️ User Interaction Simulator started');
  }

  async stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.interactionInterval) {
      clearInterval(this.interactionInterval);
      this.interactionInterval = null;
    }
    console.log('🚫 User Interaction Simulator stopped');
  }

  startInteractions() {
    // Start with some initial delay
    setTimeout(() => {
      this.performInteraction();
    }, 1000);

    this.interactionInterval = setInterval(() => {
      this.performInteraction();
    }, this.interactionFrequency + (Math.random() - 0.5) * 2000); // Variable frequency
  }

  async performInteraction() {
    const displays = document.querySelectorAll('.enhanced-floating');
    if (displays.length === 0) return;

    const pattern = this.selectInteractionPattern();
    const display = displays[Math.floor(Math.random() * displays.length)];

    try {
      await this.executeInteraction(pattern, display);
    } catch (error) {
      console.warn('Interaction simulation error:', error);
    }
  }

  selectInteractionPattern() {
    // Weighted selection based on typical user behavior
    const weights = {
      'hover_display': 30,
      'keyboard_shortcut': 25,
      'configure_display': 20,
      'move_display': 15,
      'create_display': 5,
      'remove_display': 3,
      'resize_display': 2,
      'context_menu': 0
    };

    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (const [pattern, weight] of Object.entries(weights)) {
      random -= weight;
      if (random <= 0) {
        return pattern;
      }
    }

    return 'hover_display';
  }

  async executeInteraction(pattern, display) {
    const rect = display.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const operation = {
      type: pattern,
      timestamp: Date.now(),
      displayId: display.dataset.displayId,
      details: {}
    };

    switch (pattern) {
      case 'hover_display':
        this.simulateHover(centerX, centerY);
        operation.details.position = { x: centerX, y: centerY };
        break;

      case 'keyboard_shortcut':
        this.simulateKeyboardShortcut();
        operation.details.shortcut = this.selectRandomShortcut();
        break;

      case 'configure_display':
        this.simulateConfiguration(display);
        operation.details.configType = 'random_adjustment';
        break;

      case 'move_display':
        this.simulateMove(display);
        operation.details.movement = 'drag_simulation';
        break;

      case 'create_display':
        this.simulateCreateDisplay();
        operation.details.position = this.getRandomPosition();
        break;

      case 'remove_display':
        this.simulateRemoveDisplay(display);
        break;

      case 'resize_display':
        this.simulateResize(display);
        operation.details.sizeChange = 'corner_drag';
        break;

      case 'context_menu':
        this.simulateContextMenu(centerX, centerY);
        operation.details.position = { x: centerX, y: centerY };
        break;
    }

    // Record operation
    if (window.tradingSimulator) {
      window.tradingSimulator.operationHistory.push(operation);
    }
  }

  simulateHover(x, y) {
    display.dispatchEvent(new MouseEvent('mouseenter', {
      bubbles: true,
      clientX: x,
      clientY: y
    }));

    setTimeout(() => {
      display.dispatchEvent(new MouseEvent('mouseleave', {
        bubbles: true,
        clientX: x + 10,
        clientY: y + 10
      }));
    }, 500);
  }

  simulateKeyboardShortcut() {
    const shortcuts = ['Space', 'Escape', 'd', 'c', 'Delete', 'Enter'];
    const shortcut = shortcuts[Math.floor(Math.random() * shortcuts.length)];

    const keydownEvent = new KeyboardEvent('keydown', {
      key: shortcut,
      code: shortcut,
      bubbles: true
    });
    document.dispatchEvent(keydownEvent);

    setTimeout(() => {
      const keyupEvent = new KeyboardEvent('keyup', {
        key: shortcut,
        code: shortcut,
        bubbles: true
      });
      document.dispatchEvent(keyupEvent);
    }, 100);
  }

  selectRandomShortcut() {
    const shortcuts = [
      { key: 'Space', description: 'Play/Pause animation' },
      { key: 'd', description: 'Create new display' },
      { key: 'c', description: 'Center displays' },
      { key: 'Delete', description: 'Remove selected display' }
    ];
    return shortcuts[Math.floor(Math.random() * shortcuts.length)];
  }

  simulateConfiguration(display) {
    // Simulate configuration change
    const configEvent = new CustomEvent('configurationChange', {
      detail: {
        field: 'adrAxisPosition',
        value: 50 + Math.random() * 30,
        type: 'slider'
      },
      bubbles: true
    });
    display.dispatchEvent(configEvent);
  }

  simulateMove(display) {
    const rect = display.getBoundingClientRect();
    const newX = rect.left + (Math.random() - 0.5) * 50;
    const newY = rect.top + (Math.random() - 0.5) * 50;

    // Simulate drag start
    const mousedownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + 10
    });
    display.dispatchEvent(mousedownEvent);

    // Simulate drag move
    setTimeout(() => {
      const mousemoveEvent = new MouseEvent('mousemove', {
        bubbles: true,
        clientX: newX + rect.width / 2,
        clientY: newY + 10
      });
      document.dispatchEvent(mousemoveEvent);

      // Simulate drag end
      setTimeout(() => {
        const mouseupEvent = new MouseEvent('mouseup', {
          bubbles: true,
          clientX: newX + rect.width / 2,
          clientY: newY + 10
        });
        document.dispatchEvent(mouseupEvent);
      }, 100);
    }, 50);
  }

  simulateCreateDisplay() {
    const position = this.getRandomPosition();
    const symbols = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD'];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];

    const createEvent = new CustomEvent('createDisplay', {
      detail: {
        id: `sim-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        symbol,
        position,
        size: { width: 220, height: 120 }
      },
      bubbles: true
    });
    document.dispatchEvent(createEvent);
  }

  simulateRemoveDisplay(display) {
    const removeEvent = new CustomEvent('removeDisplay', {
      detail: { displayId: display.dataset.displayId },
      bubbles: true
    });
    document.dispatchEvent(removeEvent);
  }

  simulateResize(display) {
    const rect = display.getBoundingClientRect();
    const cornerX = rect.right - 10;
    const cornerY = rect.bottom - 10;

    // Simulate resize handle drag
    const mousedownEvent = new MouseEvent('mousedown', {
      bubbles: true,
      clientX: cornerX,
      clientY: cornerY
    });
    display.dispatchEvent(mousedownEvent);

    setTimeout(() => {
      const newX = cornerX + (Math.random() - 0.5) * 30;
      const newY = cornerY + (Math.random() - 0.5) * 30;

      const mousemoveEvent = new MouseEvent('mousemove', {
        bubbles: true,
        clientX: newX,
        clientY: newY
      });
      document.dispatchEvent(mousemoveEvent);

      setTimeout(() => {
        const mouseupEvent = new MouseEvent('mouseup', {
          bubbles: true,
          clientX: newX,
          clientY: newY
        });
        document.dispatchEvent(mouseupEvent);
      }, 100);
    }, 50);
  }

  simulateContextMenu(x, y) {
    const contextEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      clientX: x,
      clientY: y,
      button: 2
    });
    document.elementFromPoint(x, y)?.dispatchEvent(contextEvent);

    // Simulate clicking elsewhere to close menu
    setTimeout(() => {
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        clientX: x + 100,
        clientY: y + 100
      });
      document.dispatchEvent(clickEvent);
    }, 300);
  }

  getRandomPosition() {
    const margin = 50;
    const maxX = window.innerWidth - 300 - margin;
    const maxY = window.innerHeight - 200 - margin;

    return {
      x: margin + Math.random() * maxX,
      y: margin + Math.random() * maxY
    };
  }
}

/**
 * Display Lifecycle Manager
 */
class DisplayLifecycleManager {
  constructor() {
    this.isRunning = false;
    this.managementInterval = null;
    this.managementCycle = 0;
  }

  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startManagementCycles();
    console.log('🔄 Display Lifecycle Manager started');
  }

  async stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.managementInterval) {
      clearInterval(this.managementInterval);
      this.managementInterval = null;
    }
    console.log('⏹️ Display Lifecycle Manager stopped');
  }

  startManagementCycles() {
    this.managementInterval = setInterval(() => {
      this.performManagementCycle();
    }, 30000); // Management cycle every 30 seconds
  }

  performManagementCycle() {
    this.managementCycle++;
    const displays = document.querySelectorAll('.enhanced-floating');

    if (displays.length === 0) return;

    const operation = {
      type: 'lifecycle_management',
      timestamp: Date.now(),
      cycle: this.managementCycle,
      details: {
        activeDisplays: displays.length,
        action: this.selectManagementAction()
      }
    };

    this.executeManagementAction(operation.details.action);

    if (window.tradingSimulator) {
      window.tradingSimulator.operationHistory.push(operation);
    }
  }

  selectManagementAction() {
    const displayCount = document.querySelectorAll('.enhanced-floating').length;

    if (displayCount > 15) return 'reduce_displays';
    if (displayCount < 5 && this.managementCycle % 3 === 0) return 'add_display';
    if (this.managementCycle % 4 === 0) return 'optimize_layout';

    return 'monitor_health';
  }

  executeManagementAction(action) {
    switch (action) {
      case 'reduce_displays':
        this.reduceDisplayCount();
        break;
      case 'add_display':
        this.addNewDisplay();
        break;
      case 'optimize_layout':
        this.optimizeLayout();
        break;
      case 'monitor_health':
        this.monitorDisplayHealth();
        break;
    }
  }

  reduceDisplayCount() {
    const displays = document.querySelectorAll('.enhanced-floating');
    if (displays.length > 15) {
      const targetDisplay = displays[displays.length - 1];
      const removeEvent = new CustomEvent('removeDisplay', {
        detail: { displayId: targetDisplay.dataset.displayId },
        bubbles: true
      });
      document.dispatchEvent(removeEvent);
    }
  }

  addNewDisplay() {
    const symbols = ['EUR/USD', 'GBP/USD', 'USD/JPY'];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];

    const createEvent = new CustomEvent('createDisplay', {
      detail: {
        id: `lifecycle-${Date.now()}`,
        symbol,
        position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
        size: { width: 220, height: 120 }
      },
      bubbles: true
    });
    document.dispatchEvent(createEvent);
  }

  optimizeLayout() {
    // Trigger layout optimization event
    const optimizeEvent = new CustomEvent('optimizeLayout', {
      detail: { reason: 'lifecycle_management' },
      bubbles: true
    });
    document.dispatchEvent(optimizeEvent);
  }

  monitorDisplayHealth() {
    const displays = document.querySelectorAll('.enhanced-floating');
    displays.forEach(display => {
      const rect = display.getBoundingClientRect();

      // Check if display is in valid state
      if (rect.width <= 0 || rect.height <= 0) {
        console.warn('Invalid display detected:', display.dataset.displayId);
      }
    });
  }
}

export default ProfessionalTradingSimulator;