#!/usr/bin/env node

/**
 * NEUROSENSE FX BUILD-TO-USER-FLOW PIPELINE RUNNER
 *
 * Main entry point for the complete testing pipeline that validates
 * everything from build compilation to real user trading workflows
 *
 * Usage:
 *   node tests/pipeline/pipeline-runner.js [options]
 *
 * Options:
 *   --environment [dev|prod]  Test environment (default: dev)
 *   --skip-build              Skip build validation phase
 *   --skip-deployment         Skip deployment testing phase
 *   --skip-workflows          Skip user workflow testing phase
 *   --skip-performance        Skip performance regression testing phase
 *   --skip-reports            Skip report generation
 *   --phase [name]            Run only specific phase
 *   --headed                  Run browser tests with visible UI
 *   --help                    Show this help message
 */

import { program } from 'commander'
import { PipelineOrchestrator } from './ci-cd-integration.spec.js'
import { BuildValidationPipeline } from './build-validation.spec.js'
import { DeploymentPipelineTester } from './deployment-testing.spec.js'
import { UserWorkflowTester } from './user-workflow-testing.spec.js'
import { PerformanceRegressionTester } from './performance-regression-testing.spec.js'

// Configure command line interface
program
  .name('pipeline-runner')
  .description('NeuroSense FX Build-to-User-Flow Pipeline Runner')
  .version('1.0.0')

program
  .option('--environment <env>', 'Test environment (dev|prod)', 'dev')
  .option('--skip-build', 'Skip build validation phase')
  .option('--skip-deployment', 'Skip deployment testing phase')
  .option('--skip-workflows', 'Skip user workflow testing phase')
  .option('--skip-performance', 'Skip performance regression testing phase')
  .option('--skip-reports', 'Skip report generation')
  .option('--phase <phase>', 'Run only specific phase')
  .option('--headed', 'Run browser tests with visible UI')
  .option('--parallel', 'Run phases in parallel (experimental)')
  .option('--help', 'Show help message')

program.parse()

const options = program.opts()

// Show help if requested
if (options.help) {
  program.outputHelp()
  process.exit(0)
}

/**
 * Main pipeline execution
 */
async function runPipeline() {
  console.log('🚀 NeuroSense FX Build-to-User-Flow Pipeline')
  console.log(`⚙️  Environment: ${options.environment}`)
  console.log(`🌐 Headed Mode: ${options.headed ? 'YES' : 'NO'}`)

  if (options.phase) {
    console.log(`🎯 Running single phase: ${options.phase}`)
  }

  console.log('=' .repeat(60))

  try {
    // Run single phase if specified
    if (options.phase) {
      await runSinglePhase(options.phase)
      return
    }

    // Run complete pipeline
    const orchestratorOptions = {
      environment: options.environment,
      runBuildValidation: !options.skipBuild,
      runDeploymentTesting: !options.skipDeployment,
      runUserWorkflows: !options.skipWorkflows,
      runPerformanceTesting: !options.skipPerformance,
      generateReports: !options.skipReports,
      headed: options.headed
    }

    const orchestrator = new PipelineOrchestrator(orchestratorOptions)
    const success = await orchestrator.runCompletePipeline()

    process.exit(success ? 0 : 1)

  } catch (error) {
    console.error('💥 Pipeline execution failed:', error)
    process.exit(1)
  }
}

/**
 * Run a single pipeline phase
 */
async function runSinglePhase(phaseName) {
  const phaseMap = {
    'build': async () => {
      console.log('🏗️  Running Build Validation Phase Only')
      const validator = new BuildValidationPipeline()
      return await validator.runFullPipeline()
    },
    'deployment': async () => {
      console.log('🚀 Running Deployment Testing Phase Only')
      const tester = new DeploymentPipelineTester(options.environment)
      return await tester.runDeploymentPipeline()
    },
    'workflows': async () => {
      console.log('👥 Running User Workflow Testing Phase Only')
      const tester = new UserWorkflowTester('chromium', !options.headed)
      return await tester.runUserWorkflowPipeline()
    },
    'performance': async () => {
      console.log('📊 Running Performance Regression Testing Phase Only')
      const tester = new PerformanceRegressionTester('chromium', options.environment)
      return await tester.runPerformanceRegressionPipeline()
    }
  }

  if (!phaseMap[phaseName]) {
    console.error(`❌ Unknown phase: ${phaseName}`)
    console.error('Available phases: build, deployment, workflows, performance')
    process.exit(1)
  }

  try {
    const success = await phaseMap[phaseName]()
    console.log(success ? '✅ Phase completed successfully' : '❌ Phase failed')
    process.exit(success ? 0 : 1)
  } catch (error) {
    console.error(`💥 Phase ${phaseName} failed:`, error)
    process.exit(1)
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Pipeline interrupted by user')
  process.exit(1)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Pipeline terminated')
  process.exit(1)
})

// Run the pipeline
runPipeline()