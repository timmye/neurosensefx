<script>
    import { onMount } from 'svelte';
    import MinimalCanvasTest from '../../components/MinimalCanvasTest.svelte';
    
    let testResults = [];
    let canvasTestResults = {};
    
    onMount(() => {
        console.log('Canvas test page mounted');
        runComprehensiveTests();
    });
    
    function runComprehensiveTests() {
        console.log('Running comprehensive canvas tests...');
        
        // Test 1: Basic canvas creation
        testBasicCanvasCreation();
        
        // Test 2: Canvas sizing
        testCanvasSizing();
        
        // Test 3: Canvas context options
        testContextOptions();
        
        // Test 4: Canvas rendering pipeline
        testRenderingPipeline();
        
        // Test 5: Canvas visibility
        testCanvasVisibility();
    }
    
    function testBasicCanvasCreation() {
        const result = { name: 'Basic Canvas Creation', passed: false, details: [] };
        
        try {
            // Test with document.createElement
            const canvas1 = document.createElement('canvas');
            const ctx1 = canvas1.getContext('2d');
            result.details.push(`createElement canvas: ${!!canvas1}, context: ${!!ctx1}`);
            
            // Test with existing canvas
            const canvas2 = document.getElementById('test-canvas');
            const ctx2 = canvas2 ? canvas2.getContext('2d') : null;
            result.details.push(`existing canvas: ${!!canvas2}, context: ${!!ctx2}`);
            
            result.passed = !!(canvas1 && ctx1 && canvas2 && ctx2);
        } catch (error) {
            result.details.push(`Error: ${error.message}`);
        }
        
        testResults.push(result);
    }
    
    function testCanvasSizing() {
        const result = { name: 'Canvas Sizing', passed: false, details: [] };
        
        try {
            const canvas = document.getElementById('test-canvas');
            if (canvas) {
                result.details.push(`width: ${canvas.width}, height: ${canvas.height}`);
                result.details.push(`offsetWidth: ${canvas.offsetWidth}, offsetHeight: ${canvas.offsetHeight}`);
                result.details.push(`clientWidth: ${canvas.clientWidth}, clientHeight: ${canvas.clientHeight}`);
                result.details.push(`naturalWidth: ${canvas.naturalWidth}, naturalHeight: ${canvas.naturalHeight}`);
                
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    const imageData = ctx.getImageData(0, 0, 1, 1);
                    result.details.push(`imageData width: ${imageData.width}, height: ${imageData.height}`);
                }
                
                result.passed = canvas.width > 0 && canvas.height > 0;
            } else {
                result.details.push('Test canvas not found');
            }
        } catch (error) {
            result.details.push(`Error: ${error.message}`);
        }
        
        testResults.push(result);
    }
    
    function testContextOptions() {
        const result = { name: 'Context Options', passed: false, details: [] };
        
        try {
            const canvas = document.getElementById('test-canvas');
            if (canvas) {
                // Standard context
                const ctx1 = canvas.getContext('2d');
                result.details.push(`Standard 2D context: ${!!ctx1}`);
                
                // Context with alpha disabled
                const ctx2 = canvas.getContext('2d', { alpha: false });
                result.details.push(`Alpha disabled context: ${!!ctx2}`);
                
                // Context with willReadFrequently
                const ctx3 = canvas.getContext('2d', { willReadFrequently: true });
                result.details.push(`Will read frequently context: ${!!ctx3}`);
                
                // WebGL context
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                result.details.push(`WebGL context: ${!!gl}`);
                
                result.passed = !!(ctx1 && ctx2 && ctx3);
            } else {
                result.details.push('Test canvas not found');
            }
        } catch (error) {
            result.details.push(`Error: ${error.message}`);
        }
        
        testResults.push(result);
    }
    
    function testRenderingPipeline() {
        const result = { name: 'Rendering Pipeline', passed: false, details: [] };
        
        try {
            const canvas = document.getElementById('test-canvas');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    // Test basic drawing
                    ctx.fillStyle = 'red';
                    ctx.fillRect(10, 10, 50, 50);
                    result.details.push('Red rectangle drawn');
                    
                    // Test image data
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;
                    
                    let hasRed = false;
                    for (let i = 0; i < data.length; i += 4) {
                        if (data[i] > 200 && data[i + 1] < 100 && data[i + 2] < 100) {
                            hasRed = true;
                            break;
                        }
                    }
                    
                    result.details.push(`Red pixels detected: ${hasRed}`);
                    
                    // Test clearing
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    const clearedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const clearedData = clearedImageData.data;
                    
                    let hasNonZero = false;
                    for (let i = 0; i < clearedData.length; i += 4) {
                        if (clearedData[i] !== 0 || clearedData[i + 1] !== 0 || 
                            clearedData[i + 2] !== 0 || clearedData[i + 3] !== 0) {
                            hasNonZero = true;
                            break;
                        }
                    }
                    
                    result.details.push(`Canvas fully cleared: ${!hasNonZero}`);
                    
                    result.passed = hasRed && !hasNonZero;
                } else {
                    result.details.push('Could not get canvas context');
                }
            } else {
                result.details.push('Test canvas not found');
            }
        } catch (error) {
            result.details.push(`Error: ${error.message}`);
        }
        
        testResults.push(result);
    }
    
    function testCanvasVisibility() {
        const result = { name: 'Canvas Visibility', passed: false, details: [] };
        
        try {
            const canvas = document.getElementById('test-canvas');
            if (canvas) {
                const styles = window.getComputedStyle(canvas);
                result.details.push(`display: ${styles.display}`);
                result.details.push(`visibility: ${styles.visibility}`);
                result.details.push(`opacity: ${styles.opacity}`);
                result.details.push(`z-index: ${styles.zIndex}`);
                result.details.push(`position: ${styles.position}`);
                
                const rect = canvas.getBoundingClientRect();
                result.details.push(`bounding rect: ${rect.width}x${rect.height} at (${rect.left}, ${rect.top})`);
                
                result.details.push(`offset parent: ${canvas.offsetParent ? canvas.offsetParent.tagName : 'none'}`);
                result.details.push(`is visible: ${rect.width > 0 && rect.height > 0}`);
                
                result.passed = rect.width > 0 && rect.height > 0 && styles.display !== 'none' && styles.visibility !== 'hidden';
            } else {
                result.details.push('Test canvas not found');
            }
        } catch (error) {
            result.details.push(`Error: ${error.message}`);
        }
        
        testResults.push(result);
    }
    
    function runAllTestsAgain() {
        testResults = [];
        runComprehensiveTests();
    }
    
    function drawTestPattern() {
        const canvas = document.getElementById('test-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw test pattern
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(10, 10, 50, 30);
            
            ctx.fillStyle = '#00ff00';
            ctx.beginPath();
            ctx.arc(100, 25, 20, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.fillStyle = '#0000ff';
            ctx.fillRect(150, 10, 30, 30);
            
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(10, 50);
            ctx.lineTo(180, 50);
            ctx.stroke();
            
            canvasTestResults.lastDrawTime = new Date().toISOString();
        }
    }
</script>

<div class="test-page">
    <h1>Comprehensive Canvas Rendering Tests</h1>
    
    <div class="test-section">
        <h2>Direct Canvas Test</h2>
        <canvas id="test-canvas" width="200" height="60" style="border: 2px solid #007bff; background-color: #f8f9fa;"></canvas>
        <button on:click={drawTestPattern}>Draw Test Pattern</button>
    </div>
    
    <div class="test-section">
        <h2>Svelte Component Test</h2>
        <MinimalCanvasTest />
    </div>
    
    <div class="test-section">
        <h2>Test Results</h2>
        <button on:click={runAllTestsAgain}>Run All Tests Again</button>
        
        {#each testResults as result}
            <div class="test-result" class:passed={result.passed} class:failed={!result.passed}>
                <h3>{result.name}: {result.passed ? '✅ PASSED' : '❌ FAILED'}</h3>
                <ul>
                    {#each result.details as detail}
                        <li>{detail}</li>
                    {/each}
                </ul>
            </div>
        {/each}
    </div>
    
    <div class="test-section">
        <h2>Canvas Test Results</h2>
        <pre>{JSON.stringify(canvasTestResults, null, 2)}</pre>
    </div>
    
    <div class="test-section">
        <h2>Environment Information</h2>
        <ul>
            <li>User Agent: {navigator.userAgent}</li>
            <li>Canvas Support: {!!document.createElement('canvas').getContext}</li>
            <li>WebGL Support: {!!(document.createElement('canvas').getContext('webgl') || document.createElement('canvas').getContext('experimental-webgl'))}</li>
            <li>Device Pixel Ratio: {window.devicePixelRatio}</li>
            <li>Screen Resolution: {screen.width}x{screen.height}</li>
            <li>Viewport Size: {window.innerWidth}x{window.innerHeight}</li>
        </ul>
    </div>
</div>

<style>
    .test-page {
        padding: 20px;
        font-family: Arial, sans-serif;
        max-width: 1200px;
        margin: 0 auto;
    }
    
    .test-section {
        margin: 20px 0;
        padding: 20px;
        border: 1px solid #ddd;
        border-radius: 8px;
        background-color: #f8f9fa;
    }
    
    .test-result {
        margin: 10px 0;
        padding: 10px;
        border-radius: 4px;
    }
    
    .test-result.passed {
        background-color: #d4edda;
        border: 1px solid #c3e6cb;
    }
    
    .test-result.failed {
        background-color: #f8d7da;
        border: 1px solid #f5c6cb;
    }
    
    canvas {
        margin: 10px 0;
        display: block;
    }
    
    button {
        margin: 5px;
        padding: 8px 16px;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
    
    button:hover {
        background-color: #0056b3;
    }
    
    pre {
        background-color: #f1f3f4;
        padding: 10px;
        border-radius: 4px;
        overflow-x: auto;
    }
    
    ul {
        margin: 10px 0;
        padding-left: 20px;
    }
    
    li {
        margin: 5px 0;
    }
</style>