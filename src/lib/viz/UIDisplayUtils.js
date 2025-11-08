/**
 * UI Display Utilities for NeuroSense FX
 *
 * Handles conversion between internal decimal format (0.0 to 1.0)
 * and user-friendly percentage display format.
 *
 * This maintains the "simple" philosophy by keeping internal math simple
 * while providing intuitive percentage display for users.
 */

/**
 * Convert decimal value to percentage string for UI display
 * @param {number} decimal - Decimal value (0.0 to 1.0)
 * @param {number} decimals - Number of decimal places to show
 * @returns {string} Percentage string (e.g., "15%")
 */
export function decimalToPercentage(decimal, decimals = 0) {
  if (typeof decimal !== 'number' || isNaN(decimal)) {
    return '0%';
  }

  const percentage = decimal * 100;
  return `${percentage.toFixed(decimals)}%`;
}

/**
 * Convert percentage string back to decimal for internal use
 * @param {string|number} percentage - Percentage value (e.g., "15%" or 15)
 * @returns {number} Decimal value (0.0 to 1.0)
 */
export function percentageToDecimal(percentage) {
  if (typeof percentage === 'number') {
    return percentage / 100;
  }

  if (typeof percentage === 'string') {
    const cleanValue = percentage.replace('%', '').trim();
    const numValue = parseFloat(cleanValue);
    return isNaN(numValue) ? 0 : numValue / 100;
  }

  return 0;
}

/**
 * Format a configuration value for UI display
 * Automatically detects percentage fields and formats appropriately
 * @param {*} value - The configuration value
 * @param {Object} fieldSchema - Schema definition for the field
 * @returns {string} Formatted display value
 */
export function formatConfigValue(value, fieldSchema) {
  const { type, isPercentage } = fieldSchema;

  if (type === 'number') {
    if (isPercentage) {
      return decimalToPercentage(value, 0);
    }
    return value.toString();
  }

  if (type === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (type === 'object') {
    if (value && typeof value === 'object') {
      // Handle dimension objects (width x height)
      if (value.width !== undefined && value.height !== undefined) {
        return `${value.width} × ${value.height}`;
      }
      // Handle other objects by converting to JSON string
      return JSON.stringify(value);
    }
    return '{}';
  }

  // Default: return as string
  return String(value);
}

/**
 * Parse user input back to configuration value
 * Handles percentage conversion automatically
 * @param {string|number} input - User input value
 * @param {Object} fieldSchema - Schema definition for the field
 * @returns {*} Parsed configuration value
 */
export function parseConfigInput(input, fieldSchema) {
  const { type, isPercentage } = fieldSchema;

  if (type === 'number') {
    if (isPercentage) {
      return percentageToDecimal(input);
    }
    return typeof input === 'number' ? input : parseFloat(input) || 0;
  }

  if (type === 'boolean') {
    if (typeof input === 'boolean') return input;
    const str = String(input).toLowerCase();
    return str === 'true' || str === 'yes' || str === '1';
  }

  return input;
}

/**
 * Create a percentage slider configuration
 * Generates appropriate props for UI slider components
 * @param {Object} fieldSchema - Schema definition
 * @returns {Object} Slider configuration
 */
export function createPercentageSliderConfig(fieldSchema) {
  const { min, max, default: defaultValue } = fieldSchema;

  return {
    min: (min || 0) * 100,
    max: (max || 1) * 100,
    step: 1,
    value: (defaultValue || 0) * 100,
    format: (value) => `${Math.round(value)}%`,
    parse: (value) => value / 100
  };
}

/**
 * Create a number input configuration
 * Generates appropriate props for UI number inputs
 * @param {Object} fieldSchema - Schema definition
 * @returns {Object} Number input configuration
 */
export function createNumberInputConfig(fieldSchema) {
  const { min, max, default: defaultValue, isPercentage } = fieldSchema;

  const config = {
    min: min || 0,
    max: max || 1,
    step: 0.01,
    value: defaultValue || 0
  };

  if (isPercentage) {
    config.displayFormatter = (value) => decimalToPercentage(value, 0);
    config.displayParser = (value) => percentageToDecimal(value);
  }

  return config;
}

/**
 * Common display formatters for different parameter types
 */
export const DISPLAY_FORMATTERS = {
  percentage: (value) => decimalToPercentage(value, 0),
  percentageWithDecimal: (value) => decimalToPercentage(value, 1),
  opacity: (value) => decimalToPercentage(value, 0),
  ratio: (value) => decimalToPercentage(value, 0),
  offset: (value) => decimalToPercentage(value, 0),
  plainNumber: (value) => value.toString(),
  boolean: (value) => value ? 'Yes' : 'No',
  dimension: (value) => {
    if (value && typeof value === 'object' && value.width !== undefined && value.height !== undefined) {
      return `${value.width} × ${value.height}`;
    }
    return value ? JSON.stringify(value) : '{}';
  }
};

/**
 * Common parsers for user input
 */
export const INPUT_PARSERS = {
  percentage: (value) => percentageToDecimal(value),
  number: (value) => typeof value === 'number' ? value : parseFloat(value) || 0,
  boolean: (value) => {
    if (typeof value === 'boolean') return value;
    const str = String(value).toLowerCase();
    return str === 'true' || str === 'yes' || str === '1';
  }
};

/**
 * Get display formatter for a specific configuration field
 * @param {string} fieldName - Configuration field name
 * @param {Object} fieldSchema - Schema definition
 * @returns {Function} Formatter function
 */
export function getDisplayFormatter(fieldName, fieldSchema) {
  const { isPercentage, type } = fieldSchema;

  // Use custom formatters based on field name patterns
  if (fieldName.includes('Opacity') || fieldName.includes('opacity')) {
    return DISPLAY_FORMATTERS.opacity;
  }

  if (fieldName.includes('Ratio') || fieldName.includes('ratio')) {
    return DISPLAY_FORMATTERS.ratio;
  }

  if (fieldName.includes('Offset') || fieldName.includes('offset')) {
    return DISPLAY_FORMATTERS.offset;
  }

  if (fieldName.includes('Size') && type === 'object') {
    return DISPLAY_FORMATTERS.dimension;
  }

  if (isPercentage) {
    return DISPLAY_FORMATTERS.percentage;
  }

  if (type === 'boolean') {
    return DISPLAY_FORMATTERS.boolean;
  }

  return DISPLAY_FORMATTERS.plainNumber;
}

/**
 * Get input parser for a specific configuration field
 * @param {string} fieldName - Configuration field name
 * @param {Object} fieldSchema - Schema definition
 * @returns {Function} Parser function
 */
export function getInputParser(fieldName, fieldSchema) {
  const { isPercentage, type } = fieldSchema;

  if (isPercentage) {
    return INPUT_PARSERS.percentage;
  }

  if (type === 'boolean') {
    return INPUT_PARSERS.boolean;
  }

  return INPUT_PARSERS.number;
}