// =============================================================================
// SIMPLIFIED PARAMETER GROUPS FOR CONTEXT MENU
// =============================================================================
// Auto-generated from simplified configuration schema
// 36 essential parameters organized into logical groups

import {
  getParametersByGroup,
  getEssentialParameterMetadata as getParamMetadata,
  getEssentialParameters,
  getEssentialDefaultConfig,
  CONFIG_GROUPS
} from '../../../config/visualizationSchema.js';

// Get the generated configuration and default values
const defaultConfig = getEssentialDefaultConfig();

// Generate all parameter groups from simplified schema
const groupsByCategory = getParametersByGroup();

// Convert to array format for context menu
const generatedGroups = Object.values(groupsByCategory).map(group => ({
  id: Object.keys(CONFIG_GROUPS).find(key => CONFIG_GROUPS[key].title === group.title) || group.title.toLowerCase().replace(/\s+/g, ''),
  title: group.title,
  description: group.description,
  order: group.order,
  icon: group.icon,
  parameters: group.parameters.map(p => p.name),
  controlTypes: group.parameters.reduce((types, param) => {
    types[param.name] = param.type;
    return types;
  }, {})
}));

// Export the parameter groups
export const parameterGroups = generatedGroups;

// Export individual group accessors for compatibility
export const layoutGroup = generatedGroups.find(g => g.id === 'layout');
export const priceDisplayGroup = generatedGroups.find(g => g.id === 'priceDisplay');
export const priceFloatGroup = generatedGroups.find(g => g.id === 'priceFloat');
export const marketProfileGroup = generatedGroups.find(g => g.id === 'marketProfile');
export const volatilityGroup = generatedGroups.find(g => g.id === 'volatility');
export const quickActionsGroup = generatedGroups.find(g => g.id === 'quickActions');

// =============================================================================
// BACKWARD COMPATIBILITY FUNCTIONS
// =============================================================================

/**
 * Get all parameters from all groups (legacy compatibility)
 */
export const getAllParameters = () => {
  const allParams = [];
  generatedGroups.forEach(group => {
    allParams.push(...group.parameters);
  });
  return allParams;
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

  // Convert schema types to UI control types
  let uiControlType = metadata.type;
  if (metadata.type === 'boolean') {
    uiControlType = 'toggle';
  } else if (metadata.type === 'number' && metadata.validation) {
    if (metadata.validation.min !== undefined && metadata.validation.max !== undefined) {
      uiControlType = 'range';
    } else {
      uiControlType = 'number';
    }
  } else if (metadata.type === 'string') {
    if (metadata.validation?.format === 'color') {
      uiControlType = 'color';
    } else if (metadata.validation?.enum) {
      uiControlType = 'select';
    } else {
      uiControlType = 'text';
    }
  }

  // Transform to legacy format for compatibility
  return {
    name: parameterName,
    group: metadata.group,
    groupTitle: metadata.groupTitle,
    type: uiControlType,
    label: metadata.ui?.label || parameterName,
    options: metadata.ui?.options || [],
    range: metadata.validation,
    defaultValue: metadata.default,
    description: metadata.ui?.description,
    isPercentage: metadata.validation?.min >= 0 && metadata.validation?.max <= 1,
    percentageBasis: metadata.validation?.min >= 0 && metadata.validation?.max <= 1 ? 'canvas' : null,
    absoluteFallback: metadata.default,
    unit: metadata.ui?.unit
  };
};

/**
 * Get parameter metadata with percentage formatting for UI controls
 * Used by range inputs to display percentage values correctly
 */
export const getParameterMetadataWithPercentage = (parameterName) => {
  const metadata = getParameterMetadata(parameterName);
  if (!metadata) return null;

  // For percentage parameters, scale the range for UI display (0-100 instead of 0-1)
  if (metadata.isPercentage) {
    return {
      ...metadata,
      range: {
        min: (metadata.validation?.min || 0) * 100,
        max: (metadata.validation?.max || 1) * 100,
        step: (metadata.validation?.step || 0.01) * 100
      },
      displayScale: 100, // Scale factor for UI display
      displayUnit: '%'
    };
  }

  return metadata;
};

/**
 * Check if a parameter uses percentage-based values
 * Simple boolean utility for conditional UI logic
 */
export const isPercentageParameter = (parameterName) => {
  const metadata = getParamMetadata(parameterName);
  if (!metadata) return false;

  // Parameter is percentage-based if validation range is 0-1
  return metadata.validation?.min >= 0 && metadata.validation?.max <= 1;
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
          label: metadata.ui?.label || parameterName,
          group: metadata.group,
          defaultValue: metadata.default,
          description: metadata.ui?.description
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
  const configParams = getAllParameters();
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
// SEARCH AND NAVIGATION UTILITIES
// =============================================================================

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
        const matchesLabel = metadata.ui?.label?.toLowerCase().includes(queryLower);
        const matchesDescription = metadata.ui?.description?.toLowerCase().includes(queryLower);

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

/**
 * Get parameters by group with enhanced metadata
 */
export const getParametersByGroupEnhanced = (groupId) => {
  const group = generatedGroups.find(g => g.id === groupId);
  if (!group) return [];

  return group.parameters.map(parameterName => {
    const metadata = getParamMetadata(parameterName);
    return {
      name: parameterName,
      ...metadata
    };
  });
};

/**
 * Get parameter system statistics
 */
export const getParameterStats = () => {
  return {
    totalParameters: getAllParameters().length,
    totalGroups: generatedGroups.length,
    groups: generatedGroups.map(group => ({
      id: group.id,
      title: group.title,
      parameterCount: group.parameters.length
    })),
    coverage: validateParameterCoverage()
  };
};

// Default export for easy access
export default {
  parameterGroups,
  layoutGroup,
  priceDisplayGroup,
  priceFloatGroup,
  marketProfileGroup,
  volatilityGroup,
  quickActionsGroup,
  getAllParameters,
  getParameterGroup,
  getParameterMetadata,
  getParameterMetadataWithPercentage,
  isPercentageParameter,
  getParametersByType,
  getParameterCountByGroup,
  validateParameterCoverage,
  searchParameters,
  getParametersByGroupEnhanced,
  getParameterStats
};