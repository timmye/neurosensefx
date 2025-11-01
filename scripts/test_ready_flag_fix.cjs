const puppeteer = require('puppeteer');

async function testReadyFlagFix() {
    console.log('Testing ready flag fix...');
    
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    // Listen for console messages
    const consoleMessages = [];
    page.on('console', msg => {
        consoleMessages.push(msg.text());
        console.log('Browser Console:', msg.text());
    });
    
    try {
        await page.goto('http://localhost:5173');
        await page.waitForSelector('[data-testid="floating-icon"]', { timeout: 10000 });
        
        console.log('Page loaded, waiting for connection...');
        await page.waitForTimeout(2000);
        
        // Click the symbol palette icon
        await page.click('[data-testid="floating-icon"]');
        await page.waitForTimeout(1000);
        
        // Wait for symbol palette to appear
        await page.waitForSelector('[data-testid="symbol-palette"]', { timeout: 5000 });
        
        console.log('Symbol palette opened, creating BTCUSD display...');
        
        // Type BTCUSD and create display
        await page.type('[data-testid="symbol-input"]', 'BTCUSD');
        await page.click('[data-testid="create-display-btn"]');
        await page.waitForTimeout(2000);
        
        // Check for "initializing..." text in display
        const initializingText = await page.$eval('[data-testid="floating-display"]', el => {
            return el.textContent.includes('initializing');
        }).catch(() => false);
        
        // Check for ready flag in debug logs
        const readyFlagLogs = consoleMessages.filter(msg => 
            msg.includes('ready: true') && msg.includes('State updated')
        );
        
        console.log('\n=== TEST RESULTS ===');
        console.log('Initializing text present:', initializingText);
        console.log('Ready flag logs found:', readyFlagLogs.length);
        
        if (readyFlagLogs.length > 0) {
            console.log('✅ SUCCESS: Ready flag is now being set to true!');
            console.log('Sample log:', readyFlagLogs[0]);
        } else {
            console.log('❌ FAILURE: Ready flag still not being set properly');
        }
        
        if (!initializingText && readyFlagLogs.length > 0) {
            console.log('🎉 COMPLETE SUCCESS: Display is rendering properly!');
        } else {
            console.log('⚠️  PARTIAL SUCCESS: Some issues remain');
        }
        
    } catch (error) {
        console.error('Test failed:', error.message);
    } finally {
        await browser.close();
    }
}

testReadyFlagFix();
