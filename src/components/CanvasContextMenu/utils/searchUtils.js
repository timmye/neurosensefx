import { parameterGroups, getAllParameters, getParameterMetadata } from './parameterGroups.js';
import { fuzzyMatch as fuzzyMatchCore, fuzzySearch, highlightMatch } from '../../../utils/fuzzySearch.js';

// Re-export highlightMatch for use in other modules
export { highlightMatch };

/**
 * Search utilities for finding and filtering parameters in the CanvasContextMenu
 */

/**
 * Fuzzy matching implementation for parameter search
 * Uses the unified fuzzy search utility with parameter-specific options
 * @param {string} query - Search query
 * @param {string} target - Target string to match against
 * @returns {number} - Match score (0 = no match, higher = better match)
 */
export const fuzzyMatch = (query, target) => {
  return fuzzyMatchCore(query, target, {
    exactMatchScore: 100,
    prefixMatchScore: 80,
    containsMatchScore: 60,
    consecutiveMatchBonus: 2,
    lengthDiffPenalty: 2,
    fullMatchBonus: 20
  });
};

/**
 * Search parameters by query string
 * @param {string} query - Search query
 * @param {number} minScore - Minimum score to include in results (default: 30)
 * @param {number} maxResults - Maximum number of results to return (default: 20)
 * @returns {Array} - Array of search results with metadata
 */
export const searchParameters = (query, minScore = 30, maxResults = 20) => {
  if (!query || query.trim() === '') {
    return [];
  }
  
  const results = [];
  const queryTrimmed = query.trim();
  
  // Search through all parameter groups
  parameterGroups.forEach(group => {
    group.parameters.forEach(param => {
      const metadata = getParameterMetadata(param);
      if (!metadata) return;
      
      // Calculate match scores for different fields
      const nameScore = fuzzyMatch(queryTrimmed, param);
      const labelScore = fuzzyMatch(queryTrimmed, metadata.label);
      const groupScore = fuzzyMatch(queryTrimmed, group.title);
      const descriptionScore = fuzzyMatch(queryTrimmed, group.description);
      
      // Use the highest score
      const bestScore = Math.max(nameScore, labelScore, groupScore, descriptionScore);
      
      if (bestScore >= minScore) {
        results.push({
          parameter: param,
          group: group.id,
          groupTitle: group.title,
          label: metadata.label,
          type: metadata.type,
          score: bestScore,
          matchType: nameScore === bestScore ? 'name' : 
                     labelScore === bestScore ? 'label' : 
                     groupScore === bestScore ? 'group' : 'description',
          metadata
        });
      }
    });
  });
  
  // Sort by score (descending) and limit results
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
};

/**
 * Filter parameters by group
 * @param {string} groupId - Group ID to filter by
 * @returns {Array} - Array of parameters in the specified group
 */
export const filterByGroup = (groupId) => {
  const group = parameterGroups.find(g => g.id === groupId);
  if (!group) return [];
  
  return group.parameters.map(param => {
    const metadata = getParameterMetadata(param);
    return {
      parameter: param,
      label: metadata.label,
      type: metadata.type,
      group: groupId,
      metadata
    };
  });
};

/**
 * Filter parameters by control type
 * @param {string} controlType - Control type to filter by
 * @returns {Array} - Array of parameters with the specified control type
 */
export const filterByControlType = (controlType) => {
  const results = [];
  
  parameterGroups.forEach(group => {
    group.parameters.forEach(param => {
      const metadata = getParameterMetadata(param);
      if (metadata && metadata.type === controlType) {
        results.push({
          parameter: param,
          label: metadata.label,
          group: group.id,
          groupTitle: group.title,
          metadata
        });
      }
    });
  });
  
  return results;
};

/**
 * Get parameter suggestions based on partial input
 * @param {string} partial - Partial input string
 * @param {number} maxSuggestions - Maximum number of suggestions (default: 5)
 * @returns {Array} - Array of parameter suggestions
 */
export const getParameterSuggestions = (partial, maxSuggestions = 5) => {
  if (!partial || partial.trim() === '') {
    return [];
  }
  
  const searchResults = searchParameters(partial, 20, maxSuggestions * 2);
  
  // Group by parameter to avoid duplicates
  const uniqueParams = {};
  searchResults.forEach(result => {
    if (!uniqueParams[result.parameter]) {
      uniqueParams[result.parameter] = result;
    }
  });
  
  return Object.values(uniqueParams)
    .slice(0, maxSuggestions)
    .map(result => ({
      value: result.parameter,
      label: result.label,
      group: result.groupTitle,
      type: result.type
    }));
};

// highlightMatch is now imported from the unified fuzzy search utility

/**
 * Get search statistics for debugging
 * @param {string} query - Search query
 * @returns {Object} - Search statistics
 */
export const getSearchStats = (query) => {
  const allParams = getAllParameters();
  const results = searchParameters(query, 0); // Get all matches regardless of score
  
  const groupCounts = {};
  const typeCounts = {};
  
  results.forEach(result => {
    groupCounts[result.group] = (groupCounts[result.group] || 0) + 1;
    typeCounts[result.type] = (typeCounts[result.type] || 0) + 1;
  });
  
  return {
    query,
    totalParameters: allParams.length,
    totalMatches: results.length,
    matchPercentage: ((results.length / allParams.length) * 100).toFixed(1),
    averageScore: results.length > 0 
      ? (results.reduce((sum, r) => sum + r.score, 0) / results.length).toFixed(1)
      : 0,
    groupCounts,
    typeCounts
  };
};

/**
 * Advanced search with multiple filters
 * @param {Object} options - Search options
 * @param {string} options.query - Search query
 * @param {string} options.group - Filter by group ID
 * @param {string} options.type - Filter by control type
 * @param {number} options.minScore - Minimum score (default: 30)
 * @param {number} options.maxResults - Maximum results (default: 20)
 * @returns {Array} - Filtered search results
 */
export const advancedSearch = ({
  query,
  group,
  type,
  minScore = 30,
  maxResults = 20
} = {}) => {
  let results = [];
  
  // If query is provided, start with search results
  if (query && query.trim() !== '') {
    results = searchParameters(query, minScore, maxResults * 2);
  } else {
    // Otherwise, get all parameters
    parameterGroups.forEach(g => {
      g.parameters.forEach(param => {
        const metadata = getParameterMetadata(param);
        results.push({
          parameter: param,
          group: g.id,
          groupTitle: g.title,
          label: metadata.label,
          type: metadata.type,
          score: 100,
          matchType: 'all',
          metadata
        });
      });
    });
  }
  
  // Apply filters
  if (group) {
    results = results.filter(r => r.group === group);
  }
  
  if (type) {
    results = results.filter(r => r.type === type);
  }
  
  // Sort and limit
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
};

/**
 * Create a search index for faster lookups (called once on initialization)
 * @returns {Object} - Search index with parameter mappings
 */
export const createSearchIndex = () => {
  const index = {
    byName: {},
    byLabel: {},
    byGroup: {},
    byType: {},
    allParams: []
  };
  
  parameterGroups.forEach(group => {
    index.byGroup[group.id] = [];
    
    group.parameters.forEach(param => {
      const metadata = getParameterMetadata(param);
      const paramInfo = {
        name: param,
        label: metadata.label,
        group: group.id,
        groupTitle: group.title,
        type: metadata.type,
        metadata
      };
      
      // Add to indexes
      index.byName[param] = paramInfo;
      index.byLabel[metadata.label] = paramInfo;
      index.byGroup[group.id].push(paramInfo);
      
      if (!index.byType[metadata.type]) {
        index.byType[metadata.type] = [];
      }
      index.byType[metadata.type].push(paramInfo);
      
      index.allParams.push(paramInfo);
    });
  });
  
  return index;
};

// Create and export the search index
export const searchIndex = createSearchIndex();