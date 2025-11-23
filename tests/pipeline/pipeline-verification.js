#!/usr/bin/env node

/**
 * PIPELINE VERIFICATION TEST
 *
 * Quick verification that all pipeline components can be imported
 * and basic functionality is working before running the full pipeline.
 */

import { existsSync } from 'fs'
import { resolve } from 'path'

async function verifyPipeline() {
  console.log('🔍 NeuroSense FX Pipeline Verification')
  console.log('=' .repeat(50))

  try {
    // Check all pipeline files exist
    const requiredFiles = [
      'build-validation.spec.js',
      'deployment-testing.spec.js',
      'user-workflow-testing.spec.js',
      'performance-regression-testing.spec.js',
      'ci-cd-integration.spec.js',
      'pipeline-runner.js',
      'README.md'
    ]

    console.log('📁 Checking pipeline files...')
    let allFilesExist = true

    for (const file of requiredFiles) {
      const filePath = resolve(process.cwd(), 'tests/pipeline', file)
      const exists = existsSync(filePath)
      console.log(`  ${exists ? '✅' : '❌'} ${file}`)
      if (!exists) allFilesExist = false
    }

    if (!allFilesExist) {
      throw new Error('Missing pipeline files')
    }

    // Test imports
    console.log('\n📦 Testing pipeline imports...')

    const modules = [
      { name: 'Build Validation', path: './build-validation.spec.js' },
      { name: 'Deployment Testing', path: './deployment-testing.spec.js' },
      { name: 'User Workflow Testing', path: './user-workflow-testing.spec.js' },
      { name: 'Performance Regression Testing', path: './performance-regression-testing.spec.js' },
      { name: 'CI/CD Integration', path: './ci-cd-integration.spec.js' }
    ]

    for (const module of modules) {
      try {
        const moduleImport = await import(module.path)
        console.log(`  ✅ ${module.name}`)
      } catch (importError) {
        console.log(`  ❌ ${module.name}: ${importError.message}`)
        throw new Error(`Failed to import ${module.name}`)
      }
    }

    // Check package.json scripts
    console.log('\n⚙️  Checking package.json scripts...')
    const packageJson = JSON.parse(await import('fs').then(fs =>
      fs.promises.readFile(resolve(process.cwd(), 'package.json'), 'utf8')
    ))

    const requiredScripts = [
      'pipeline',
      'pipeline:dev',
      'pipeline:prod',
      'pipeline:phase:build',
      'pipeline:phase:deployment',
      'pipeline:phase:workflows',
      'pipeline:phase:performance'
    ]

    for (const script of requiredScripts) {
      const exists = packageJson.scripts && packageJson.scripts[script]
      console.log(`  ${exists ? '✅' : '❌'} ${script}`)
    }

    console.log('\n✅ Pipeline verification completed successfully!')
    console.log('\n🚀 You can now run the complete pipeline with:')
    console.log('  npm run pipeline                    # Development environment')
    console.log('  npm run pipeline:prod               # Production environment')
    console.log('  npm run pipeline:headed             # With visible browser')
    console.log('  npm run pipeline:quick              # Skip performance & deployment')

    return true

  } catch (error) {
    console.error('\n❌ Pipeline verification failed:')
    console.error(error.message)
    return false
  }
}

// Run verification
verifyPipeline()
  .then(success => {
    process.exit(success ? 0 : 1)
  })
  .catch(error => {
    console.error('Verification error:', error)
    process.exit(1)
  })