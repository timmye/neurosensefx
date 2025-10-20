import { defaultConfig } from '../../../data/symbolStore.js';
import { validateParameterCoverage } from './parameterGroups.js';

/**
 * Utility to validate that all config parameters are properly categorized
 * This function can be used during development to ensure complete coverage
 */

export const validateParameterGroups = () => {
  const validation = validateParameterCoverage();
  
  console.log('=== Parameter Groups Validation ===');
  console.log(`Total config parameters: ${validation.totalConfigParams}`);
  console.log(`Total grouped parameters: ${validation.totalGroupedParams}`);
  console.log(`Validation result: ${validation.isValid ? 'VALID' : 'INVALID'}`);
  
  if (validation.missingParams.length > 0) {
    console.log('\nMissing parameters (not in any group):');
    validation.missingParams.forEach(param => {
      console.log(`  - ${param}: ${defaultConfig[param]}`);
    });
  }
  
  if (validation.extraParams.length > 0) {
    console.log('\nExtra parameters (in groups but not in config):');
    validation.extraParams.forEach(param => {
      console.log(`  - ${param}`);
    });
  }
  
  // Group parameters by type for analysis
  const typeAnalysis = {};
  Object.entries(defaultConfig).forEach(([key, value]) => {
    const type = typeof value;
    if (!typeAnalysis[type]) {
      typeAnalysis[type] = [];
    }
    typeAnalysis[type].push(key);
  });
  
  console.log('\nParameter types:');
  Object.entries(typeAnalysis).forEach(([type, params]) => {
    console.log(`  ${type}: ${params.length} parameters`);
  });
  
  return validation;
};

// Run validation if this file is imported directly
if (typeof window !== 'undefined') {
  // Browser environment - expose to global for debugging
  window.validateParameterGroups = validateParameterGroups;
}
