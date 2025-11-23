#!/usr/bin/env node

/**
 * [DEBUGGER] Geometry Analysis Test Runner
 *
 * TEMPORARY DEBUG FILE - TO BE REMOVED BEFORE FINAL REPORT
 *
 * This script runs comprehensive geometry and coordinate system tests
 * to identify the root causes of positioning and alignment issues.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 [DEBUGGER] Starting Geometry and Coordinate System Analysis');
console.log('=' .repeat(60));

function runCommand(command, args, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n📋 ${description}`);
    console.log(`   Command: ${command} ${args.join(' ')}`);

    const process = spawn(command, args, {
      stdio: 'inherit',
      cwd: __dirname
    });

    process.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${description} - SUCCESS`);
        resolve();
      } else {
        console.log(`❌ ${description} - FAILED (exit code: ${code})`);
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    process.on('error', (error) => {
      console.log(`❌ ${description} - ERROR: ${error.message}`);
      reject(error);
    });
  });
}

function analyzeGeometryIssues() {
  console.log('\n🎯 [DEBUGGER] Geometry Issue Analysis Plan');
  console.log('=' .repeat(60));

  console.log('\n📍 ISSUE 1: Canvas positioned below container top');
  console.log('   - Check for margin/padding in CSS');
  console.log('   - Verify canvas element positioning within container');
  console.log('   - Look for coordinate origin misalignment');

  console.log('\n📍 ISSUE 2: ADR 0 and canvas 50% alignment problems');
  console.log('   - Analyze dayRangeMeter.js coordinate calculations');
  console.log('   - Check yScale transformations from market data to pixels');
  console.log('   - Verify center line positioning in ADR axis');

  console.log('\n📍 ISSUE 3: Mouse interaction loss after dragging');
  console.log('   - Check for z-index conflicts after drag operations');
  console.log('   - Analyze event propagation and capture issues');
  console.log('   - Look for overlay elements blocking interaction');

  console.log('\n📍 ISSUE 4: Initial positioning and alignment problems');
  console.log('   - Examine interact.js vs CSS coordinate systems');
  console.log('   - Check for conflicting positioning styles');
  console.log('   - Verify transform effects on positioning');
}

function createDebugReport() {
  console.log('\n📝 [DEBUGGER] Creating Debug Analysis Report');
  console.log('=' .repeat(60));

  const report = {
    timestamp: new Date().toISOString(),
    analysisType: 'Geometry and Coordinate System Issues',
    issuesInvestigated: [
      'Canvas positioned below container top',
      'ADR 0 and canvas 50% alignment problems',
      'Mouse interaction loss after dragging',
      'Initial positioning and alignment problems'
    ],
    toolsDeployed: [
      'coordinateSystemDebugger.js - Real-time coordinate monitoring',
      'FloatingDisplay debugging integration - Element-specific analysis',
      'HTML geometry debugger - DOM structure analysis',
      'Day Range Meter coordinate analysis - ADR alignment checking'
    ],
    investigationSteps: [
      'DOM structure analysis of FloatingDisplay vs Canvas positioning',
      'Interact.js coordinate system transformation tracking',
      'DPR scaling verification and coordinate mapping',
      'Mouse event propagation and interaction testing',
      'ADR vs canvas coordinate system alignment verification'
    ],
    expectedFindings: [
      'Coordinate system offsets between container and canvas',
      'CSS vs JavaScript positioning inconsistencies',
      'Event handling conflicts after drag operations',
      'Transform or scaling issues affecting alignment'
    ]
  };

  const reportPath = path.join(__dirname, 'GEOMETRY_INVESTIGATION_REPORT.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`📊 Debug report created: ${reportPath}`);
  console.log('\n🔍 Key Investigation Areas:');
  report.investigationSteps.forEach((step, index) => {
    console.log(`   ${index + 1}. ${step}`);
  });
}

async function main() {
  try {
    // Step 1: Analyze the issues
    analyzeGeometryIssues();

    // Step 2: Create debug report
    createDebugReport();

    // Step 3: Check if development server is running
    console.log('\n🚀 [DEBUGGER] Preparing to test with development server');
    console.log('   Make sure the NeuroSense FX development server is running');
    console.log('   Then use the debugging tools to analyze real-time issues');

    console.log('\n🛠️  [DEBUGGER] Available Debug Tools:');
    console.log('   1. Open: test_debug_geometry_coordinates.html');
    console.log('   2. Start NeuroSense FX development server');
    console.log('   3. Create floating displays to see coordinate analysis');
    console.log('   4. Use ADR and 🖱️ debug buttons in floating display headers');
    console.log('   5. Watch coordinate debugger panel for real-time analysis');

    console.log('\n📋 [DEBUGGER] Manual Testing Checklist:');
    console.log('   □ Create a floating display');
    console.log('   □ Check if canvas is offset below container top');
    console.log('   □ Verify ADR 0 aligns with canvas 50% center line');
    console.log('   □ Drag the display and watch coordinate changes');
    console.log('   □ Test mouse interaction before and after dragging');
    console.log('   □ Check for position drift or coordinate system conflicts');

    console.log('\n🎯 [DEBUGGER] Key Areas to Monitor:');
    console.log('   • Canvas.getBoundingClientRect() vs element.getBoundingClientRect()');
    console.log('   • CSS left/top vs actual DOM positioning');
    console.log('   • Interact.js event.rect vs computed styles');
    console.log('   • DPR scaling effects on canvas coordinates');
    console.log('   • Mouse event coordinates vs element boundaries');

    console.log('\n✅ [DEBUGGER] Geometry analysis setup complete');
    console.log('\n🚨 IMPORTANT: Remove all DEBUGGER code before final report!');

  } catch (error) {
    console.error('❌ [DEBUGGER] Analysis failed:', error.message);
    process.exit(1);
  }
}

// Run the analysis
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { analyzeGeometryIssues, createDebugReport };