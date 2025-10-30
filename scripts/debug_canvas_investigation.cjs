#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 CANVAS INVESTIGATION: Starting debug process');
console.log('=====================================');

// Check if required files exist
const requiredFiles = [
  'src/components/viz/ContainerDebug.svelte',
  'src/components/FloatingDisplay-simplified.svelte',
  'test_canvas_debug_minimal.html'
];

console.log('🔍 Checking required files...');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file} exists`);
  } else {
    console.log(`❌ ${file} missing`);
  }
});

// Start the development server
console.log('\n🔍 Starting development server...');
const devServer = spawn('npm', ['run', 'dev'], {
  stdio: 'pipe',
  shell: true
});

let serverOutput = '';
let serverError = '';

devServer.stdout.on('data', (data) => {
  const output = data.toString();
  serverOutput += output;
  process.stdout.write(output);
  
  // Look for server ready message
  if (output.includes('Local:') || output.includes('localhost:')) {
    console.log('\n🔍 Server appears to be ready');
    
    // Wait a bit more then open browser
    setTimeout(() => {
      console.log('\n🔍 Opening browser for testing...');
      const openCmd = process.platform === 'darwin' ? 'open' : 
                     process.platform === 'win32' ? 'start' : 'xdg-open';
      
      spawn(openCmd, ['http://localhost:5173']);
      
      // Also open the minimal test
      setTimeout(() => {
        spawn(openCmd, [path.resolve('test_canvas_debug_minimal.html')]);
        
        console.log('\n🔍 Investigation steps:');
        console.log('1. Check the main application at http://localhost:5173');
        console.log('2. Look for red-bordered canvas with debug info');
        console.log('3. Check console logs for 🔍 CONTAINER_DEBUG messages');
        console.log('4. Open the minimal test file to verify basic canvas works');
        console.log('5. Compare results between the two tests');
        console.log('\n🔍 Expected debug output:');
        console.log('- Canvas element: ✅');
        console.log('- Canvas context: ✅');
        console.log('- Green test rectangle should be visible');
        console.log('- Visualization function calls should be logged');
        console.log('\n🔍 If canvas is still blank:');
        console.log('- Check if debug panel shows canvas element and context as ✅');
        console.log('- Check if canvas dimensions are correct');
        console.log('- Check if canvas is visible in DOM');
        console.log('- Check if visualization functions are being called');
        console.log('- Check browser console for errors');
        
        // Give time for investigation then stop
        setTimeout(() => {
          console.log('\n🔍 Investigation complete. Stopping server...');
          devServer.kill('SIGTERM');
        }, 30000); // 30 seconds for investigation
      }, 2000);
    }, 3000);
  }
});

devServer.stderr.on('data', (data) => {
  const error = data.toString();
  serverError += error;
  process.stderr.write(error);
});

devServer.on('close', (code) => {
  console.log(`\n🔍 Server exited with code ${code}`);
  
  // Save debug output to file
  const debugReport = `
# Canvas Investigation Report

## Server Output
\`\`\`
${serverOutput}
\`\`\`

## Server Errors
\`\`\`
${serverError}
\`\`\`

## Investigation Checklist
- [ ] Main application loads at http://localhost:5173
- [ ] Debug panel shows canvas element and context as ✅
- [ ] Green test rectangle is visible on canvas
- [ ] Visualization function calls are logged in console
- [ ] Minimal test file shows colored rectangles
- [ ] Browser console shows no errors
- [ ] Canvas dimensions are correct in debug panel
- [ ] Canvas is visible in DOM (not hidden by CSS)

## Possible Issues Identified
1. Canvas element not binding properly
2. Canvas context not establishing
3. Canvas dimensions set incorrectly
4. Canvas hidden by CSS
5. Visualization functions not drawing
6. Canvas being drawn outside visible area
7. Browser-specific rendering issues

## Next Steps
Based on investigation results, implement appropriate fixes.
  `;
  
  fs.writeFileSync('canvas_investigation_report.md', debugReport);
  console.log('🔍 Investigation report saved to canvas_investigation_report.md');
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🔍 Stopping investigation...');
  devServer.kill('SIGTERM');
  process.exit(0);
});