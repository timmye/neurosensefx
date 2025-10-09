/**
 * Comprehensive data validation utilities for NeuroSense FX
 * Provides validation for market data, workspace data, and user inputs
 */

/**
 * Validate price data
 * @param {*} price - Price value to validate
 * @returns {Object} Validation result
 */
export function validatePrice(price) {
  const result = {
    isValid: false,
    errors: [],
    normalizedValue: null
  };

  // Check if price exists
  if (price === null || price === undefined) {
    result.errors.push('Price is required');
    return result;
  }

  // Convert to number if string
  const numericPrice = typeof price === 'string' ? parseFloat(price) : price;

  // Check if it's a valid number
  if (isNaN(numericPrice)) {
    result.errors.push('Price must be a valid number');
    return result;
  }

  // Check for positive price
  if (numericPrice <= 0) {
    result.errors.push('Price must be positive');
    return result;
  }

  // Check for reasonable price range (0.0001 to 1,000,000)
  if (numericPrice < 0.0001 || numericPrice > 1000000) {
    result.errors.push('Price is outside reasonable range');
    return result;
  }

  // Check for reasonable precision (max 8 decimal places for forex)
  const decimalPlaces = (numericPrice.toString().split('.')[1] || '').length;
  if (decimalPlaces > 8) {
    result.errors.push('Price has too many decimal places');
    return result;
  }

  result.isValid = true;
  result.normalizedValue = numericPrice;
  return result;
}

/**
 * Validate symbol data
 * @param {*} symbol - Symbol object to validate
 * @returns {Object} Validation result
 */
export function validateSymbol(symbol) {
  const result = {
    isValid: false,
    errors: [],
    normalizedValue: null
  };

  // Check if symbol exists
  if (!symbol) {
    result.errors.push('Symbol data is required');
    return result;
  }

  // Check if it's an object
  if (typeof symbol !== 'object') {
    result.errors.push('Symbol must be an object');
    return result;
  }

  const normalizedSymbol = { ...symbol };

  // Validate symbol name
  if (!symbol.symbol || typeof symbol.symbol !== 'string') {
    result.errors.push('Symbol name is required and must be a string');
  } else {
    // Validate symbol format (e.g., EURUSD, GBP/JPY)
    const symbolPattern = /^[A-Z]{3}[\/]?[A-Z]{3}$/;
    if (!symbolPattern.test(symbol.symbol.replace('/', ''))) {
      result.errors.push('Symbol format is invalid (expected format: EURUSD or EUR/USD)');
    }
  }

  // Validate description
  if (symbol.description && typeof symbol.description !== 'string') {
    result.errors.push('Symbol description must be a string');
  }

  // Validate digits
  if (symbol.digits !== undefined) {
    if (typeof symbol.digits !== 'number' || symbol.digits < 0 || symbol.digits > 8) {
      result.errors.push('Symbol digits must be a number between 0 and 8');
    }
  }

  // Validate pip size
  if (symbol.pipSize !== undefined) {
    if (typeof symbol.pipSize !== 'number' || symbol.pipSize <= 0) {
      result.errors.push('Symbol pip size must be a positive number');
    }
  }

  // Validate lot size
  if (symbol.lotSize !== undefined) {
    if (typeof symbol.lotSize !== 'number' || symbol.lotSize <= 0) {
      result.errors.push('Symbol lot size must be a positive number');
    }
  }

  // Validate min lot size
  if (symbol.minLotSize !== undefined) {
    if (typeof symbol.minLotSize !== 'number' || symbol.minLotSize <= 0) {
      result.errors.push('Symbol min lot size must be a positive number');
    }
  }

  // Validate max lot size
  if (symbol.maxLotSize !== undefined) {
    if (typeof symbol.maxLotSize !== 'number' || symbol.maxLotSize <= 0) {
      result.errors.push('Symbol max lot size must be a positive number');
    }
  }

  // Validate lot size consistency
  if (symbol.minLotSize && symbol.maxLotSize && symbol.minLotSize > symbol.maxLotSize) {
    result.errors.push('Min lot size cannot be greater than max lot size');
  }

  result.isValid = result.errors.length === 0;
  result.normalizedValue = normalizedSymbol;
  return result;
}

/**
 * Validate tick data
 * @param {*} tick - Tick object to validate
 * @returns {Object} Validation result
 */
export function validateTick(tick) {
  const result = {
    isValid: false,
    errors: [],
    normalizedValue: null
  };

  // Check if tick exists
  if (!tick) {
    result.errors.push('Tick data is required');
    return result;
  }

  // Check if it's an object
  if (typeof tick !== 'object') {
    result.errors.push('Tick must be an object');
    return result;
  }

  const normalizedTick = { ...tick };

  // Validate symbol
  if (!tick.symbol || typeof tick.symbol !== 'string') {
    result.errors.push('Tick symbol is required and must be a string');
  }

  // Validate bid price
  const bidValidation = validatePrice(tick.bid);
  if (!bidValidation.isValid) {
    result.errors.push(`Invalid bid price: ${bidValidation.errors.join(', ')}`);
  } else {
    normalizedTick.bid = bidValidation.normalizedValue;
  }

  // Validate ask price
  const askValidation = validatePrice(tick.ask);
  if (!askValidation.isValid) {
    result.errors.push(`Invalid ask price: ${askValidation.errors.join(', ')}`);
  } else {
    normalizedTick.ask = askValidation.normalizedValue;
  }

  // Validate spread (ask must be greater than bid)
  if (bidValidation.isValid && askValidation.isValid) {
    if (normalizedTick.ask <= normalizedTick.bid) {
      result.errors.push('Ask price must be greater than bid price');
    }
  }

  // Validate timestamp
  if (tick.timestamp !== undefined) {
    if (typeof tick.timestamp !== 'number' && typeof tick.timestamp !== 'string') {
      result.errors.push('Tick timestamp must be a number or string');
    } else {
      const timestamp = new Date(tick.timestamp);
      if (isNaN(timestamp.getTime())) {
        result.errors.push('Tick timestamp is invalid');
      } else {
        normalizedTick.timestamp = timestamp.getTime();
      }
    }
  } else {
    // Use current time if not provided
    normalizedTick.timestamp = Date.now();
  }

  // Validate volume
  if (tick.volume !== undefined) {
    if (typeof tick.volume !== 'number' || tick.volume < 0) {
      result.errors.push('Tick volume must be a non-negative number');
    }
  }

  // Validate spread points
  if (tick.spreadPoints !== undefined) {
    if (typeof tick.spreadPoints !== 'number' || tick.spreadPoints < 0) {
      result.errors.push('Tick spread points must be a non-negative number');
    }
  }

  result.isValid = result.errors.length === 0;
  result.normalizedValue = normalizedTick;
  return result;
}

/**
 * Validate workspace data
 * @param {*} workspace - Workspace object to validate
 * @returns {Object} Validation result
 */
export function validateWorkspace(workspace) {
  const result = {
    isValid: false,
    errors: [],
    normalizedValue: null
  };

  // Check if workspace exists
  if (!workspace) {
    result.errors.push('Workspace data is required');
    return result;
  }

  // Check if it's an object
  if (typeof workspace !== 'object') {
    result.errors.push('Workspace must be an object');
    return result;
  }

  const normalizedWorkspace = { ...workspace };

  // Validate workspace ID
  if (!workspace.id || typeof workspace.id !== 'string') {
    result.errors.push('Workspace ID is required and must be a string');
  }

  // Validate workspace name
  if (!workspace.name || typeof workspace.name !== 'string') {
    result.errors.push('Workspace name is required and must be a string');
  } else if (workspace.name.length < 1 || workspace.name.length > 100) {
    result.errors.push('Workspace name must be between 1 and 100 characters');
  }

  // Validate description
  if (workspace.description && typeof workspace.description !== 'string') {
    result.errors.push('Workspace description must be a string');
  } else if (workspace.description && workspace.description.length > 500) {
    result.errors.push('Workspace description must be less than 500 characters');
  }

  // Validate created date
  if (workspace.createdAt !== undefined) {
    const createdDate = new Date(workspace.createdAt);
    if (isNaN(createdDate.getTime())) {
      result.errors.push('Workspace created date is invalid');
    } else {
      normalizedWorkspace.createdAt = createdDate.getTime();
    }
  } else {
    normalizedWorkspace.createdAt = Date.now();
  }

  // Validate updated date
  if (workspace.updatedAt !== undefined) {
    const updatedDate = new Date(workspace.updatedAt);
    if (isNaN(updatedDate.getTime())) {
      result.errors.push('Workspace updated date is invalid');
    } else {
      normalizedWorkspace.updatedAt = updatedDate.getTime();
    }
  } else {
    normalizedWorkspace.updatedAt = Date.now();
  }

  // Validate layout
  if (workspace.layout) {
    const layoutValidation = validateWorkspaceLayout(workspace.layout);
    if (!layoutValidation.isValid) {
      result.errors.push(`Invalid layout: ${layoutValidation.errors.join(', ')}`);
    } else {
      normalizedWorkspace.layout = layoutValidation.normalizedValue;
    }
  } else {
    // Provide default layout
    normalizedWorkspace.layout = createDefaultLayout();
  }

  // Validate global settings
  if (workspace.globalSettings) {
    const settingsValidation = validateGlobalSettings(workspace.globalSettings);
    if (!settingsValidation.isValid) {
      result.errors.push(`Invalid global settings: ${settingsValidation.errors.join(', ')}`);
    } else {
      normalizedWorkspace.globalSettings = settingsValidation.normalizedValue;
    }
  } else {
    normalizedWorkspace.globalSettings = createDefaultGlobalSettings();
  }

  // Validate symbol subscriptions
  if (workspace.symbolSubscriptions) {
    if (!Array.isArray(workspace.symbolSubscriptions)) {
      result.errors.push('Symbol subscriptions must be an array');
    } else {
      // Validate each symbol in subscriptions
      for (const symbol of workspace.symbolSubscriptions) {
        if (typeof symbol !== 'string') {
          result.errors.push('Each symbol subscription must be a string');
          break;
        }
      }
    }
  } else {
    normalizedWorkspace.symbolSubscriptions = [];
  }

  result.isValid = result.errors.length === 0;
  result.normalizedValue = normalizedWorkspace;
  return result;
}

/**
 * Validate workspace layout
 * @param {*} layout - Layout object to validate
 * @returns {Object} Validation result
 */
export function validateWorkspaceLayout(layout) {
  const result = {
    isValid: false,
    errors: [],
    normalizedValue: null
  };

  if (typeof layout !== 'object') {
    result.errors.push('Layout must be an object');
    return result;
  }

  const normalizedLayout = { ...layout };

  // Validate canvases
  if (layout.canvases) {
    if (!Array.isArray(layout.canvases)) {
      result.errors.push('Layout canvases must be an array');
    } else {
      // Validate each canvas
      const validatedCanvases = [];
      for (const canvas of layout.canvases) {
        const canvasValidation = validateCanvas(canvas);
        if (!canvasValidation.isValid) {
          result.errors.push(`Invalid canvas: ${canvasValidation.errors.join(', ')}`);
        } else {
          validatedCanvases.push(canvasValidation.normalizedValue);
        }
      }
      normalizedLayout.canvases = validatedCanvases;
    }
  } else {
    normalizedLayout.canvases = [];
  }

  // Validate grid settings
  if (layout.gridSettings) {
    const gridValidation = validateGridSettings(layout.gridSettings);
    if (!gridValidation.isValid) {
      result.errors.push(`Invalid grid settings: ${gridValidation.errors.join(', ')}`);
    } else {
      normalizedLayout.gridSettings = gridValidation.normalizedValue;
    }
  } else {
    normalizedLayout.gridSettings = createDefaultGridSettings();
  }

  // Validate view settings
  if (layout.viewSettings) {
    const viewValidation = validateViewSettings(layout.viewSettings);
    if (!viewValidation.isValid) {
      result.errors.push(`Invalid view settings: ${viewValidation.errors.join(', ')}`);
    } else {
      normalizedLayout.viewSettings = viewValidation.normalizedValue;
    }
  } else {
    normalizedLayout.viewSettings = createDefaultViewSettings();
  }

  result.isValid = result.errors.length === 0;
  result.normalizedValue = normalizedLayout;
  return result;
}

/**
 * Validate canvas configuration
 * @param {*} canvas - Canvas object to validate
 * @returns {Object} Validation result
 */
export function validateCanvas(canvas) {
  const result = {
    isValid: false,
    errors: [],
    normalizedValue: null
  };

  if (typeof canvas !== 'object') {
    result.errors.push('Canvas must be an object');
    return result;
  }

  const normalizedCanvas = { ...canvas };

  // Validate canvas ID
  if (!canvas.id || typeof canvas.id !== 'string') {
    result.errors.push('Canvas ID is required and must be a string');
  }

  // Validate symbol
  if (!canvas.symbol || typeof canvas.symbol !== 'string') {
    result.errors.push('Canvas symbol is required and must be a string');
  }

  // Validate position
  if (canvas.position) {
    const positionValidation = validatePosition(canvas.position);
    if (!positionValidation.isValid) {
      result.errors.push(`Invalid canvas position: ${positionValidation.errors.join(', ')}`);
    } else {
      normalizedCanvas.position = positionValidation.normalizedValue;
    }
  } else {
    normalizedCanvas.position = { x: 0, y: 0 };
  }

  // Validate size
  if (canvas.size) {
    const sizeValidation = validateSize(canvas.size);
    if (!sizeValidation.isValid) {
      result.errors.push(`Invalid canvas size: ${sizeValidation.errors.join(', ')}`);
    } else {
      normalizedCanvas.size = sizeValidation.normalizedValue;
    }
  } else {
    normalizedCanvas.size = { width: 220, height: 120 };
  }

  // Validate settings
  if (canvas.settings && typeof canvas.settings !== 'object') {
    result.errors.push('Canvas settings must be an object');
  } else {
    normalizedCanvas.settings = canvas.settings || {};
  }

  // Validate indicators
  if (canvas.indicators) {
    if (!Array.isArray(canvas.indicators)) {
      result.errors.push('Canvas indicators must be an array');
    } else {
      // Validate each indicator
      for (const indicator of canvas.indicators) {
        if (typeof indicator !== 'string') {
          result.errors.push('Each canvas indicator must be a string');
          break;
        }
      }
    }
  } else {
    normalizedCanvas.indicators = [];
  }

  // Validate visibility
  if (canvas.isVisible !== undefined && typeof canvas.isVisible !== 'boolean') {
    result.errors.push('Canvas visibility must be a boolean');
  } else {
    normalizedCanvas.isVisible = canvas.isVisible !== false;
  }

  // Validate z-index
  if (canvas.zIndex !== undefined) {
    if (typeof canvas.zIndex !== 'number' || canvas.zIndex < 0) {
      result.errors.push('Canvas z-index must be a non-negative number');
    }
  } else {
    normalizedCanvas.zIndex = 0;
  }

  result.isValid = result.errors.length === 0;
  result.normalizedValue = normalizedCanvas;
  return result;
}

/**
 * Validate position object
 * @param {*} position - Position object to validate
 * @returns {Object} Validation result
 */
export function validatePosition(position) {
  const result = {
    isValid: false,
    errors: [],
    normalizedValue: null
  };

  if (typeof position !== 'object') {
    result.errors.push('Position must be an object');
    return result;
  }

  const normalizedPosition = {};

  // Validate x coordinate
  if (position.x !== undefined) {
    if (typeof position.x !== 'number' || !isFinite(position.x)) {
      result.errors.push('Position x must be a finite number');
    } else {
      normalizedPosition.x = position.x;
    }
  } else {
    normalizedPosition.x = 0;
  }

  // Validate y coordinate
  if (position.y !== undefined) {
    if (typeof position.y !== 'number' || !isFinite(position.y)) {
      result.errors.push('Position y must be a finite number');
    } else {
      normalizedPosition.y = position.y;
    }
  } else {
    normalizedPosition.y = 0;
  }

  result.isValid = result.errors.length === 0;
  result.normalizedValue = normalizedPosition;
  return result;
}

/**
 * Validate size object
 * @param {*} size - Size object to validate
 * @returns {Object} Validation result
 */
export function validateSize(size) {
  const result = {
    isValid: false,
    errors: [],
    normalizedValue: null
  };

  if (typeof size !== 'object') {
    result.errors.push('Size must be an object');
    return result;
  }

  const normalizedSize = {};

  // Validate width
  if (size.width !== undefined) {
    if (typeof size.width !== 'number' || size.width <= 0) {
      result.errors.push('Size width must be a positive number');
    } else {
      normalizedSize.width = Math.max(50, Math.min(2000, size.width)); // Clamp to reasonable range
    }
  } else {
    normalizedSize.width = 220;
  }

  // Validate height
  if (size.height !== undefined) {
    if (typeof size.height !== 'number' || size.height <= 0) {
      result.errors.push('Size height must be a positive number');
    } else {
      normalizedSize.height = Math.max(30, Math.min(1000, size.height)); // Clamp to reasonable range
    }
  } else {
    normalizedSize.height = 120;
  }

  result.isValid = result.errors.length === 0;
  result.normalizedValue = normalizedSize;
  return result;
}

/**
 * Validate grid settings
 * @param {*} gridSettings - Grid settings object to validate
 * @returns {Object} Validation result
 */
export function validateGridSettings(gridSettings) {
  const result = {
    isValid: false,
    errors: [],
    normalizedValue: null
  };

  if (typeof gridSettings !== 'object') {
    result.errors.push('Grid settings must be an object');
    return result;
  }

  const normalizedGridSettings = { ...gridSettings };

  // Validate columns
  if (gridSettings.columns !== undefined) {
    if (typeof gridSettings.columns !== 'number' || gridSettings.columns < 1 || gridSettings.columns > 20) {
      result.errors.push('Grid columns must be a number between 1 and 20');
    } else {
      normalizedGridSettings.columns = Math.floor(gridSettings.columns);
    }
  } else {
    normalizedGridSettings.columns = 4;
  }

  // Validate rows
  if (gridSettings.rows !== undefined) {
    if (typeof gridSettings.rows !== 'number' || gridSettings.rows < 1 || gridSettings.rows > 20) {
      result.errors.push('Grid rows must be a number between 1 and 20');
    } else {
      normalizedGridSettings.rows = Math.floor(gridSettings.rows);
    }
  } else {
    normalizedGridSettings.rows = 3;
  }

  // Validate gap
  if (gridSettings.gap !== undefined) {
    if (typeof gridSettings.gap !== 'number' || gridSettings.gap < 0) {
      result.errors.push('Grid gap must be a non-negative number');
    } else {
      normalizedGridSettings.gap = Math.max(0, Math.min(100, gridSettings.gap));
    }
  } else {
    normalizedGridSettings.gap = 10;
  }

  // Validate padding
  if (gridSettings.padding !== undefined) {
    if (typeof gridSettings.padding !== 'number' || gridSettings.padding < 0) {
      result.errors.push('Grid padding must be a non-negative number');
    } else {
      normalizedGridSettings.padding = Math.max(0, Math.min(100, gridSettings.padding));
    }
  } else {
    normalizedGridSettings.padding = 20;
  }

  result.isValid = result.errors.length === 0;
  result.normalizedValue = normalizedGridSettings;
  return result;
}

/**
 * Validate view settings
 * @param {*} viewSettings - View settings object to validate
 * @returns {Object} Validation result
 */
export function validateViewSettings(viewSettings) {
  const result = {
    isValid: false,
    errors: [],
    normalizedValue: null
  };

  if (typeof viewSettings !== 'object') {
    result.errors.push('View settings must be an object');
    return result;
  }

  const normalizedViewSettings = { ...viewSettings };

  // Validate zoom
  if (viewSettings.zoom !== undefined) {
    if (typeof viewSettings.zoom !== 'number' || viewSettings.zoom < 0.1 || viewSettings.zoom > 5) {
      result.errors.push('View zoom must be a number between 0.1 and 5');
    } else {
      normalizedViewSettings.zoom = Math.max(0.1, Math.min(5, viewSettings.zoom));
    }
  } else {
    normalizedViewSettings.zoom = 1;
  }

  // Validate pan X
  if (viewSettings.panX !== undefined) {
    if (typeof viewSettings.panX !== 'number' || !isFinite(viewSettings.panX)) {
      result.errors.push('View pan X must be a finite number');
    } else {
      normalizedViewSettings.panX = viewSettings.panX;
    }
  } else {
    normalizedViewSettings.panX = 0;
  }

  // Validate pan Y
  if (viewSettings.panY !== undefined) {
    if (typeof viewSettings.panY !== 'number' || !isFinite(viewSettings.panY)) {
      result.errors.push('View pan Y must be a finite number');
    } else {
      normalizedViewSettings.panY = viewSettings.panY;
    }
  } else {
    normalizedViewSettings.panY = 0;
  }

  result.isValid = result.errors.length === 0;
  result.normalizedValue = normalizedViewSettings;
  return result;
}

/**
 * Validate global settings
 * @param {*} globalSettings - Global settings object to validate
 * @returns {Object} Validation result
 */
export function validateGlobalSettings(globalSettings) {
  const result = {
    isValid: false,
    errors: [],
    normalizedValue: null
  };

  if (typeof globalSettings !== 'object') {
    result.errors.push('Global settings must be an object');
    return result;
  }

  const normalizedGlobalSettings = { ...globalSettings };

  // Validate density
  if (globalSettings.density !== undefined) {
    const validDensities = ['low', 'medium', 'high'];
    if (!validDensities.includes(globalSettings.density)) {
      result.errors.push('Global settings density must be one of: low, medium, high');
    } else {
      normalizedGlobalSettings.density = globalSettings.density;
    }
  } else {
    normalizedGlobalSettings.density = 'high';
  }

  // Validate theme
  if (globalSettings.theme !== undefined) {
    const validThemes = ['light', 'dark', 'auto'];
    if (!validThemes.includes(globalSettings.theme)) {
      result.errors.push('Global settings theme must be one of: light, dark, auto');
    } else {
      normalizedGlobalSettings.theme = globalSettings.theme;
    }
  } else {
    normalizedGlobalSettings.theme = 'dark';
  }

  // Validate auto save
  if (globalSettings.autoSave !== undefined && typeof globalSettings.autoSave !== 'boolean') {
    result.errors.push('Global settings auto save must be a boolean');
  } else {
    normalizedGlobalSettings.autoSave = globalSettings.autoSave !== false;
  }

  // Validate auto save interval
  if (globalSettings.autoSaveInterval !== undefined) {
    if (typeof globalSettings.autoSaveInterval !== 'number' || globalSettings.autoSaveInterval < 1000) {
      result.errors.push('Global settings auto save interval must be a number greater than or equal to 1000ms');
    } else {
      normalizedGlobalSettings.autoSaveInterval = Math.max(1000, globalSettings.autoSaveInterval);
    }
  } else {
    normalizedGlobalSettings.autoSaveInterval = 30000; // 30 seconds
  }

  result.isValid = result.errors.length === 0;
  result.normalizedValue = normalizedGlobalSettings;
  return result;
}

// Helper functions to create default values

function createDefaultLayout() {
  return {
    canvases: [],
    gridSettings: createDefaultGridSettings(),
    viewSettings: createDefaultViewSettings()
  };
}

function createDefaultGridSettings() {
  return {
    columns: 4,
    rows: 3,
    gap: 10,
    padding: 20
  };
}

function createDefaultViewSettings() {
  return {
    zoom: 1,
    panX: 0,
    panY: 0
  };
}

function createDefaultGlobalSettings() {
  return {
    density: 'high',
    theme: 'dark',
    autoSave: true,
    autoSaveInterval: 30000
  };
}

/**
 * Validate and sanitize user input
 * @param {*} input - Input to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export function validateUserInput(input, options = {}) {
  const {
    type = 'string',
    required = true,
    minLength = 0,
    maxLength = 1000,
    pattern = null,
    allowEmpty = false
  } = options;

  const result = {
    isValid: false,
    errors: [],
    normalizedValue: null
  };

  // Check if required
  if (required && (input === null || input === undefined)) {
    result.errors.push('This field is required');
    return result;
  }

  // Allow empty if not required
  if (!required && (input === null || input === undefined || input === '')) {
    result.isValid = true;
    result.normalizedValue = '';
    return result;
  }

  // Type conversion and validation
  let normalizedValue = input;

  switch (type) {
    case 'string':
      normalizedValue = String(input);
      break;
    case 'number':
      normalizedValue = Number(input);
      if (isNaN(normalizedValue)) {
        result.errors.push('Must be a valid number');
        return result;
      }
      break;
    case 'boolean':
      if (typeof input === 'string') {
        normalizedValue = input.toLowerCase() === 'true';
      } else {
        normalizedValue = Boolean(input);
      }
      break;
    default:
      normalizedValue = input;
  }

  // Length validation for strings
  if (type === 'string') {
    if (normalizedValue.length < minLength) {
      result.errors.push(`Must be at least ${minLength} characters long`);
    }
    if (normalizedValue.length > maxLength) {
      result.errors.push(`Must be no more than ${maxLength} characters long`);
    }
    if (!allowEmpty && normalizedValue.trim() === '') {
      result.errors.push('Cannot be empty');
    }
  }

  // Pattern validation
  if (type === 'string' && pattern) {
    const regex = new RegExp(pattern);
    if (!regex.test(normalizedValue)) {
      result.errors.push('Invalid format');
    }
  }

  result.isValid = result.errors.length === 0;
  result.normalizedValue = normalizedValue;
  return result;
}

/**
 * Batch validate multiple items
 * @param {Array} items - Array of items to validate
 * @param {Function} validator - Validator function
 * @returns {Object} Batch validation result
 */
export function validateBatch(items, validator) {
  const result = {
    isValid: true,
    errors: [],
    normalizedValues: [],
    itemResults: []
  };

  if (!Array.isArray(items)) {
    result.isValid = false;
    result.errors.push('Items must be an array');
    return result;
  }

  for (const item of items) {
    const itemResult = validator(item);
    result.itemResults.push(itemResult);

    if (!itemResult.isValid) {
      result.isValid = false;
      result.errors.push(...itemResult.errors);
    }

    if (itemResult.normalizedValue !== null) {
      result.normalizedValues.push(itemResult.normalizedValue);
    }
  }

  return result;
}

/**
 * Create a validation schema
 * @param {Object} schema - Validation schema
 * @returns {Function} Validator function
 */
export function createValidator(schema) {
  return function validate(data) {
    const result = {
      isValid: true,
      errors: [],
      normalizedValue: {}
    };

    if (typeof data !== 'object') {
      result.isValid = false;
      result.errors.push('Data must be an object');
      return result;
    }

    const normalizedData = {};

    for (const [key, rules] of Object.entries(schema)) {
      const value = data[key];
      const fieldResult = validateUserInput(value, rules);

      if (!fieldResult.isValid) {
        result.isValid = false;
        result.errors.push(...fieldResult.errors.map(error => `${key}: ${error}`));
      }

      if (fieldResult.normalizedValue !== null) {
        normalizedData[key] = fieldResult.normalizedValue;
      }
    }

    result.normalizedValue = normalizedData;
    return result;
  };
}
