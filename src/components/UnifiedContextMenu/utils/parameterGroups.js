import {
  getOrderedParameterGroups,
  getParameterMetadata as getParamMetadata,
  getAllParameterNames,
  generateDefaultConfig,
  validateParameter as validateParam,
  isPercentageParameter as isPercentageParam,
  getPercentageParameterMetadata as getPercentageMeta,
  toCanvasPixels as toPixels,
  toCanvasPercentage as toPercentage,
  migrateConfigToPercentages as migrateToPercentages
} from '../../../config/configGenerator.js';

/**
 * Parameter groups for Unified Context Menu
 * Auto-generated from unified configuration schema
 * Replaces manual parameter group definitions
 */

// Get the generated configuration and default values
const defaultConfig = generateDefaultConfig();

// Generate all parameter groups from unified schema
const generatedGroups = getOrderedParameterGroups();

// Export the parameter groups
export const parameterGroups = generatedGroups;

// Export individual group accessors for compatibility
export const quickActionsGroup = generatedGroups.find(g => g.id === 'quickActions');
export const priceDisplayGroup = generatedGroups.find(g => g.id === 'priceDisplay');
export const priceFloatGroup = generatedGroups.find(g => g.id === 'priceFloat');
export const marketProfileGroup = generatedGroups.find(g => g.id === 'marketProfile');
export const volatilityGroup = generatedGroups.find(g => g.id === 'volatility');
export const layoutSizingGroup = generatedGroups.find(g => g.id === 'layoutSizing');
export const advancedGroup = generatedGroups.find(g => g.id === 'advanced');

// =============================================================================
// BACKWARD COMPATIBILITY FUNCTIONS
// =============================================================================

/**
 * Get all parameters from all groups (legacy compatibility)
 */
export const getAllParameters = () => {
  return getAllParameterNames();
};

/**
 * Get parameter group by parameter name (legacy compatibility)
 */
export const getParameterGroup = (parameterName) => {
  const metadata = getParamMetadata(parameterName);
  if (!metadata) return null;

  return generatedGroups.find(group => group.id === metadata.group);
};

/**
 * Get parameter metadata (type, label, options, etc.) - enhanced version
 */
export const getParameterMetadata = (parameterName) => {
  const metadata = getParamMetadata(parameterName);
  if (!metadata) return null;

  // Transform options to legacy format (simple array of strings for dropdown values)
  let transformedOptions = metadata.options;
  if (Array.isArray(metadata.options) && metadata.options.length > 0 &&
      typeof metadata.options[0] === 'object' && metadata.options[0].value) {
    // Convert from [{value: 'x', label: 'X'}] to ['x']
    transformedOptions = metadata.options.map(opt => opt.value);
  }

  // Transform to legacy format for compatibility
  return {
    name: parameterName,
    group: metadata.group,
    groupTitle: metadata.groupTitle,
    type: metadata.control, // Legacy expects control type, not data type
    label: metadata.label,
    options: transformedOptions,
    range: metadata.range,
    defaultValue: metadata.defaultValue,
    description: metadata.description,
    isPercentage: metadata.isPercentage,
    percentageBasis: metadata.percentageBasis,
    absoluteFallback: metadata.absoluteFallback,
    unit: metadata.unit
  };
};

/**
 * Get parameters by control type (legacy compatibility)
 */
export const getParametersByType = (controlType) => {
  const result = [];

  generatedGroups.forEach(group => {
    group.parameters.forEach(parameterName => {
      const metadata = getParamMetadata(parameterName);
      if (metadata && metadata.type === controlType) {
        result.push({
          name: parameterName,
          label: metadata.label,
          group: metadata.group,
          defaultValue: metadata.defaultValue,
          description: metadata.description
        });
      }
    });
  });

  return result;
};

/**
 * Get parameter count by group (legacy compatibility)
 */
export const getParameterCountByGroup = () => {
  const counts = {};

  generatedGroups.forEach(group => {
    counts[group.id] = group.parameters.length;
  });

  return counts;
};

/**
 * Validate that all config parameters are included in groups (enhanced version)
 */
export const validateParameterCoverage = () => {
  const configParams = getAllParameterNames();
  const groupedParams = getAllParameters();

  const missingParams = configParams.filter(param => !groupedParams.includes(param));
  const extraParams = groupedParams.filter(param => !configParams.includes(param));

  return {
    totalConfigParams: configParams.length,
    totalGroupedParams: groupedParams.length,
    missingParams,
    extraParams,
    isValid: missingParams.length === 0 && extraParams.length === 0,
    driftDetected: missingParams.length > 0 || extraParams.length > 0
  };
};

// =============================================================================
// ENHANCED PERCENTAGE UTILITIES (LEGACY COMPATIBILITY + ENHANCEMENTS)
// =============================================================================

/**
 * Convert percentage values to canvas pixels (legacy compatibility)
 */
export const toCanvasPixels = (value, basis, canvasWidth, canvasHeight) => {
  return toPixels(value, basis, canvasWidth, canvasHeight);
};

/**
 * Convert absolute values to canvas percentages (legacy compatibility)
 */
export const toCanvasPercentage = (absoluteValue, basis, originalCanvasWidth, originalCanvasHeight) => {
  return toPercentage(absoluteValue, basis, originalCanvasWidth, originalCanvasHeight);
};

/**
 * Get percentage parameter metadata (enhanced version)
 */
export const getPercentageParameterMetadata = (parameterName) => {
  return getPercentageMeta(parameterName);
};

/**
 * Check if parameter is percentage-based (legacy compatibility)
 */
export const isPercentageParameter = (parameterName) => {
  return isPercentageParam(parameterName);
};

/**
 * Convert config values from absolute to percentages (migration utility)
 */
export const migrateConfigToPercentages = (oldConfig, originalCanvasWidth = 220, originalCanvasHeight = 120) => {
  return migrateToPercentages(oldConfig, originalCanvasWidth, originalCanvasHeight);
};

/**
 * Enhanced getParameterMetadata with percentage info (legacy compatibility)
 */
export const getParameterMetadataWithPercentage = (parameterName) => {
  const metadata = getParamMetadata(parameterName);
  if (!metadata) return null;

  const percentageMeta = getPercentageMeta(parameterName);

  return {
    ...metadata,
    isPercentage: !!percentageMeta,
    percentageBasis: percentageMeta?.basis,
    absoluteFallback: percentageMeta?.absoluteFallback
  };
};

// =============================================================================
// VALIDATION AND ERROR HANDLING
// =============================================================================

/**
 * Validate parameter value with enhanced error reporting
 */
export const validateParameter = (parameterName, value) => {
  const validation = validateParam(parameterName, value);
  if (!validation.isValid) {
    console.error(`[PARAMETER_VALIDATION] ${parameterName}: ${validation.error}`);
    return validation;
  }

  // Additional validation for percentage parameters
  if (isPercentageParameter(parameterName)) {
    const percentageMeta = getPercentageParameterMetadata(parameterName);
    if (percentageMeta && (value < 0 || value > 100)) {
      return {
        isValid: false,
        error: `Percentage value must be between 0 and 100, got ${value}`
      };
    }
  }

  return validation;
};

/**
 * Batch validate multiple parameters
 */
export const validateParameterBatch = (parameters) => {
  const results = {};
  let allValid = true;

  Object.entries(parameters).forEach(([name, value]) => {
    const validation = validateParameter(name, value);
    results[name] = validation;
    if (!validation.isValid) {
      allValid = false;
    }
  });

  return {
    allValid,
    results
  };
};

// =============================================================================
// GROUP SPECIFIC UTILITIES
// =============================================================================

/**
 * Get parameters by group with enhanced metadata
 */
export const getParametersByGroup = (groupId) => {
  const group = generatedGroups.find(g => g.id === groupId);
  if (!group) return [];

  return group.parameters.map(parameterName => {
    const metadata = getParamMetadata(parameterName);
    const percentageMeta = getPercentageMeta(parameterName);
    return {
      name: parameterName,
      ...metadata,
      isPercentage: !!percentageMeta,
      percentageBasis: percentageMeta?.basis,
      absoluteFallback: percentageMeta?.absoluteFallback
    };
  });
};

/**
 * Get available control types across all parameters
 */
export const getAvailableControlTypes = () => {
  const controlTypes = new Set();

  generatedGroups.forEach(group => {
    Object.values(group.controlTypes).forEach(controlType => {
      controlTypes.add(controlType);
    });
  });

  return Array.from(controlTypes);
};

/**
 * Search parameters by name or label
 */
export const searchParameters = (query) => {
  const queryLower = query.toLowerCase();
  const results = [];

  generatedGroups.forEach(group => {
    group.parameters.forEach(parameterName => {
      const metadata = getParamMetadata(parameterName);
      if (metadata) {
        const matchesName = parameterName.toLowerCase().includes(queryLower);
        const matchesLabel = metadata.label?.toLowerCase().includes(queryLower);
        const matchesDescription = metadata.description?.toLowerCase().includes(queryLower);

        if (matchesName || matchesLabel || matchesDescription) {
          results.push({
            name: parameterName,
            group: group.id,
            groupTitle: group.title,
            ...metadata
          });
        }
      }
    });
  });

  return results;
};

// =============================================================================
// EXPORTS SUMMARY
// =============================================================================

/**
 * Get parameter system statistics
 */
export const getParameterStats = () => {
  return {
    totalParameters: getAllParameterNames().length,
    totalGroups: generatedGroups.length,
    groups: generatedGroups.map(group => ({
      id: group.id,
      title: group.title,
      parameterCount: group.parameters.length
    })),
    controlTypes: getAvailableControlTypes(),
    coverage: validateParameterCoverage()
  };
};

// Default export for easy access
export default {
  parameterGroups,
  quickActionsGroup,
  priceDisplayGroup,
  priceFloatGroup,
  marketProfileGroup,
  volatilityGroup,
  layoutSizingGroup,
  advancedGroup,
  getAllParameters,
  getParameterGroup,
  getParameterMetadata,
  getParametersByType,
  getParameterCountByGroup,
  validateParameterCoverage,
  toCanvasPixels,
  toCanvasPercentage,
  getPercentageParameterMetadata,
  isPercentageParameter,
  migrateConfigToPercentages,
  getParameterMetadataWithPercentage,
  validateParameter,
  validateParameterBatch,
  getParametersByGroup,
  getAvailableControlTypes,
  searchParameters,
  getParameterStats
};