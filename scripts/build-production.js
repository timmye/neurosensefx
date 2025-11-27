#!/usr/bin/env node

/**
 * Production Build Script with Validation
 *
 * Builds the production application with comprehensive validation
 * of bundle sizes, performance standards, and deployment readiness.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Production build validation thresholds
const VALIDATION_THRESHOLDS = {
  MAX_MAIN_BUNDLE_SIZE_KB: 400, // Reduced from 563KB target
  MAX_TOTAL_BUNDLE_SIZE_MB: 30, // Well under 50MB target
  MAX_CHUNK_COUNT: 15, // Reasonable number of chunks
  MIN_TREE_SHAKING_RATIO: 0.3, // At least 30% of code should be tree-shaken
  MAX_LOAD_TIME_MS: 3000, // 3 seconds initial load
  MAX_CHUNK_LOAD_TIME_MS: 1000 // 1 second per chunk
};

/**
 * Colors for console output
 */
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Parse Vite build output from dist folder
 */
function parseBuildOutput() {
  const manifestPath = join(projectRoot, 'dist', '.vite', 'manifest.json');
  const distPath = join(projectRoot, 'dist');

  if (!existsSync(distPath)) {
    throw new Error('Build output not found. Run the build first.');
  }

  try {
    // Read package.json for dependencies size estimation
    const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
    const dependencies = Object.keys(packageJson.dependencies || {});

    // Get all files in dist
    const files = [];
    function scanDir(dir, relative = '') {
      const items = require('fs').readdirSync(dir);
      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = require('fs').statSync(fullPath);
        const relativePath = join(relative, item);

        if (stat.isDirectory()) {
          scanDir(fullPath, relativePath);
        } else {
          const size = stat.size;
          const sizeKB = (size / 1024).toFixed(2);

          files.push({
            name: item,
            path: relativePath,
            size,
            sizeKB: parseFloat(sizeKB),
            type: item.endsWith('.js') ? 'js' :
                  item.endsWith('.css') ? 'css' :
                  item.endsWith('.html') ? 'html' : 'other'
          });
        }
      }
    }

    scanDir(distPath);

    // Analyze chunks
    const jsChunks = files.filter(f => f.type === 'js');
    const cssChunks = files.filter(f => f.type === 'css');
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

    return {
      files,
      jsChunks,
      cssChunks,
      totalSize,
      totalSizeMB: parseFloat(totalSizeMB),
      totalSizeKB: totalSize / 1024,
      chunkCount: jsChunks.length + cssChunks.length,
      largestChunk: jsChunks.reduce((max, chunk) => chunk.size > max.size ? chunk : max, jsChunks[0])
    };
  } catch (error) {
    throw new Error(`Failed to parse build output: ${error.message}`);
  }
}

/**
 * Validate bundle sizes against thresholds
 */
function validateBundleSizes(buildStats) {
  log('\n📊 Bundle Size Validation:', 'cyan');

  let allPassed = true;

  // Check main bundle size
  const mainChunk = buildStats.jsChunks.find(chunk => chunk.name.includes('index'));
  if (mainChunk) {
    const mainSizeKB = mainChunk.sizeKB;
    if (mainSizeKB <= VALIDATION_THRESHOLDS.MAX_MAIN_BUNDLE_SIZE_KB) {
      log(`  ✅ Main bundle: ${mainSizeKB.toFixed(2)} KB (≤ ${VALIDATION_THRESHOLDS.MAX_MAIN_BUNDLE_SIZE_KB} KB)`, 'green');
    } else {
      log(`  ❌ Main bundle: ${mainSizeKB.toFixed(2)} KB (> ${VALIDATION_THRESHOLDS.MAX_MAIN_BUNDLE_SIZE_KB} KB)`, 'red');
      allPassed = false;
    }
  }

  // Check total bundle size
  const totalSizeMB = buildStats.totalSizeMB;
  if (totalSizeMB <= VALIDATION_THRESHOLDS.MAX_TOTAL_BUNDLE_SIZE_MB) {
    log(`  ✅ Total bundle: ${totalSizeMB.toFixed(2)} MB (≤ ${VALIDATION_THRESHOLDS.MAX_TOTAL_BUNDLE_SIZE_MB} MB)`, 'green');
  } else {
    log(`  ❌ Total bundle: ${totalSizeMB.toFixed(2)} MB (> ${VALIDATION_THRESHOLDS.MAX_TOTAL_BUNDLE_SIZE_MB} MB)`, 'red');
    allPassed = false;
  }

  // Check chunk count
  const chunkCount = buildStats.chunkCount;
  if (chunkCount <= VALIDATION_THRESHOLDS.MAX_CHUNK_COUNT) {
    log(`  ✅ Chunk count: ${chunkCount} (≤ ${VALIDATION_THRESHOLDS.MAX_CHUNK_COUNT})`, 'green');
  } else {
    log(`  ⚠️  Chunk count: ${chunkCount} (> ${VALIDATION_THRESHOLDS.MAX_CHUNK_COUNT}) - consider optimization`, 'yellow');
  }

  // Show largest chunks
  const largestChunks = buildStats.jsChunks
    .sort((a, b) => b.size - a.size)
    .slice(0, 5);

  log('\n  📈 Largest chunks:', 'blue');
  largestChunks.forEach((chunk, index) => {
    log(`    ${index + 1}. ${chunk.name}: ${chunk.sizeKB.toFixed(2)} KB`, 'blue');
  });

  return allPassed;
}

/**
 * Validate code splitting effectiveness
 */
function validateCodeSplitting(buildStats) {
  log('\n🔄 Code Splitting Validation:', 'cyan');

  const jsChunks = buildStats.jsChunks;
  const vendorChunks = jsChunks.filter(chunk => chunk.name.includes('vendor'));
  const vizChunks = jsChunks.filter(chunk => chunk.name.includes('viz'));
  const perfChunks = jsChunks.filter(chunk => chunk.name.includes('perf'));

  let score = 0;
  const maxScore = 4;

  // Check for vendor separation
  if (vendorChunks.length > 0) {
    log(`  ✅ Vendor libraries separated: ${vendorChunks.length} vendor chunks`, 'green');
    score++;
  } else {
    log(`  ❌ No vendor separation found`, 'red');
  }

  // Check for visualization separation
  if (vizChunks.length > 0) {
    log(`  ✅ Visualization modules separated: ${vizChunks.length} viz chunks`, 'green');
    score++;
  } else {
    log(`  ❌ No visualization separation found`, 'red');
  }

  // Check for performance tools separation
  if (perfChunks.length > 0) {
    log(`  ✅ Performance tools separated: ${perfChunks.length} perf chunks`, 'green');
    score++;
  } else {
    log(`  ❌ No performance tools separation found`, 'red');
  }

  // Check overall chunk distribution
  const avgChunkSize = jsChunks.reduce((sum, chunk) => sum + chunk.size, 0) / jsChunks.length;
  if (avgChunkSize < 100 * 1024) { // 100KB average
    log(`  ✅ Good chunk distribution: avg ${(avgChunkSize / 1024).toFixed(2)} KB`, 'green');
    score++;
  } else {
    log(`  ⚠️  Large chunk average: ${(avgChunkSize / 1024).toFixed(2)} KB`, 'yellow');
  }

  const codeSplittingScore = (score / maxScore) * 100;
  log(`  📊 Code Splitting Score: ${codeSplittingScore.toFixed(0)}%`, score === maxScore ? 'green' : 'yellow');

  return codeSplittingScore >= 75; // 75% or higher is good
}

/**
 * Run production build
 */
function runProductionBuild() {
  log('🏗️  Starting production build...', 'blue');

  try {
    // Clean previous build
    execSync('rm -rf dist', { cwd: projectRoot, stdio: 'inherit' });

    // Run production build
    execSync('npm run build:prod', { cwd: projectRoot, stdio: 'inherit' });

    log('✅ Production build completed', 'green');
    return true;
  } catch (error) {
    log(`❌ Build failed: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Generate build report
 */
function generateBuildReport(buildStats, validations) {
  const report = {
    timestamp: new Date().toISOString(),
    build: buildStats,
    validation: validations,
    thresholds: VALIDATION_THRESHOLDS
  };

  const reportPath = join(projectRoot, 'dist', 'build-report.json');
  require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2));

  log(`📄 Build report saved to: ${reportPath}`, 'blue');
}

/**
 * Main build and validation process
 */
async function main() {
  log('🚀 NeuroSense FX Production Build & Validation', 'cyan');
  log('=' .repeat(50), 'cyan');

  try {
    // Run build
    const buildSuccess = runProductionBuild();
    if (!buildSuccess) {
      process.exit(1);
    }

    // Parse build output
    const buildStats = parseBuildOutput();

    // Run validations
    const bundleValidation = validateBundleSizes(buildStats);
    const codeSplittingValidation = validateCodeSplitting(buildStats);

    const validations = {
      bundleSizes: bundleValidation,
      codeSplitting: codeSplittingValidation,
      overall: bundleValidation && codeSplittingValidation
    };

    // Generate report
    generateBuildReport(buildStats, validations);

    // Final result
    log('\n' + '=' .repeat(50), 'cyan');
    if (validations.overall) {
      log('🎉 Production build validation PASSED!', 'green');
      log('   Application is ready for deployment', 'green');
    } else {
      log('⚠️  Production build validation FAILED!', 'red');
      log('   Address issues before deployment', 'red');
      process.exit(1);
    }

  } catch (error) {
    log(`💥 Fatal error: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run the script
main();