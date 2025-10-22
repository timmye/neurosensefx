import { parameterGroups, getParameterMetadata } from './parameterGroups.js';

/**
 * Search functionality for the unified context menu
 */

// Search parameters across all groups
export function searchParameters(query, maxResults = 30, maxPerGroup = 10) {
  if (!query || query.trim() === '') {
    return [];
  }
  
  const searchTerm = query.toLowerCase().trim();
  const results = [];
  
  parameterGroups.forEach(group => {
    const groupResults = [];
    
    group.parameters.forEach(parameter => {
      const metadata = getParameterMetadata(parameter);
      if (!metadata) return;
      
      const label = metadata.label.toLowerCase();
      const groupTitle = group.title.toLowerCase();
      
      // Calculate relevance score
      let score = 0;
      
      // Exact label match
      if (label === searchTerm) {
        score = 100;
      }
      // Label starts with search term
      else if (label.startsWith(searchTerm)) {
        score = 80;
      }
      // Label contains search term
      else if (label.includes(searchTerm)) {
        score = 60;
      }
      // Group title contains search term
      else if (groupTitle.includes(searchTerm)) {
        score = 40;
      }
      // Partial matches
      else {
        const words = searchTerm.split(' ');
        words.forEach(word => {
          if (word && label.includes(word)) {
            score += 20;
          }
        });
      }
      
      if (score > 0) {
        groupResults.push({
          parameter,
          label: metadata.label,
          group: group.id,
          groupTitle: group.title,
          score,
          type: metadata.type,
          defaultValue: metadata.defaultValue
        });
      }
    });
    
    // Sort by score and limit per group
    groupResults.sort((a, b) => b.score - a.score);
    results.push(...groupResults.slice(0, maxPerGroup));
  });
  
  // Sort all results by score and limit total
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}

// Get parameter suggestions for autocomplete
export function getParameterSuggestions(partialQuery, maxSuggestions = 10) {
  return searchParameters(partialQuery, maxSuggestions);
}

// Filter parameters by type
export function getParametersByType(controlType) {
  const results = [];
  
  parameterGroups.forEach(group => {
    group.parameters.forEach(parameter => {
      const metadata = getParameterMetadata(parameter);
      if (metadata && metadata.type === controlType) {
        results.push({
          parameter,
          label: metadata.label,
          group: group.id,
          groupTitle: group.title,
          defaultValue: metadata.defaultValue
        });
      }
    });
  });
  
  return results;
}

// Get recently used parameters (placeholder for future implementation)
export function getRecentParameters(maxRecent = 5) {
  // This could be implemented with localStorage or store
  // For now, return empty array
  return [];
}

// Get popular parameters (placeholder for future implementation)
export function getPopularParameters(maxPopular = 10) {
  // This could be based on usage statistics
  // For now, return some commonly used parameters
  const popularParams = [
    'showMarketProfile',
    'showVolatilityOrb',
    'priceFloatWidth',
    'marketProfileOpacity',
    'volatilityColorMode',
    'showFlash',
    'priceFontSize',
    'visualizationsContentWidth',
    'meterHeight',
    'showAdrRangeIndicatorLines'
  ];
  
  return popularParams.slice(0, maxPopular).map(param => {
    const metadata = getParameterMetadata(param);
    if (!metadata) return null;
    
    return {
      parameter: param,
      label: metadata.label,
      group: getParameterGroup(param)?.id,
      groupTitle: getParameterGroup(param)?.title,
      defaultValue: metadata.defaultValue
    };
  }).filter(Boolean);
}

// Get parameter group by parameter name
function getParameterGroup(parameterName) {
  return parameterGroups.find(group => 
    group.parameters.includes(parameterName)
  );
}
