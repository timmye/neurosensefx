// test_trigger_frontend_1732908345003.cjs
// DEBUGGER: Test to trigger frontend WebSocket connection and see debug output
// TO BE DELETED BEFORE FINAL REPORT

const WebSocket = require('ws');

console.log('🔍 DEBUGGER: Triggering WebSocket connection to see backend debug output');
console.log('======================================================================\n');

let ws = null;

function log(message, type = 'INFO') {
    const timestamp = new Date().toLocaleTimeString();
    const emoji = type === 'SUCCESS' ? '✅' : type === 'ERROR' ? '❌' : '🔍';
    console.log(`[${timestamp}] ${emoji} ${message}`);
}

async function triggerWebSocket() {
    return new Promise((resolve, reject) => {
        log('Connecting to backend to trigger debug logs...');

        ws = new WebSocket('ws://localhost:8080');

        ws.on('open', () => {
            log('WebSocket connected, sending subscription...');

            const request = {
                type: 'subscribe',
                symbols: ['EURUSD']
            };

            ws.send(JSON.stringify(request));
        });

        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data.toString());
                log(`Received ${parsed.type} message`);
            } catch (error) {
                log(`Parse error: ${error.message}`, 'ERROR');
            }
        });

        ws.on('error', (error) => {
            log(`Error: ${error.message}`, 'ERROR');
        });

        // Close after 2 seconds
        setTimeout(() => {
            ws.close();
            resolve();
        }, 2000);
    });
}

// Run the test
triggerWebSocket().then(() => {
    console.log('\n🔍 [DEBUGGER] Trigger test complete - check backend logs for debug output');
    process.exit(0);
}).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});