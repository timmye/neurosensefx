#!/usr/bin/env node

/**
 * Simple Browser Console Log Monitor
 *
 * Monitors console logs from your NeuroSense FX application running at http://localhost:5174
 *
 * Usage: node browser-log-monitor.js
 */

const http = require('http');
const WebSocket = require('ws');

// Create a simple script injection that will capture console logs
const logCaptureScript = `
<script>
(function() {
    let logBuffer = [];
    let wsConnection;

    // Function to establish WebSocket connection
    function connectWebSocket() {
        try {
            wsConnection = new WebSocket('ws://localhost:8085');

            wsConnection.onopen = function() {
                console.log('🔗 Connected to browser log monitor');
            };

            wsConnection.onerror = function(error) {
                console.error('WebSocket connection error:', error);
            };

            wsConnection.onclose = function() {
                console.log('🔌 WebSocket connection closed, attempting reconnect...');
                setTimeout(connectWebSocket, 2000);
            };
        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
            setTimeout(connectWebSocket, 5000);
        }
    }

    // Enhanced console methods to capture all logs
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;
    const originalDebug = console.debug;

    function sendLog(type, args) {
        const logEntry = {
            type: type,
            timestamp: new Date().toISOString(),
            args: Array.from(args).map(arg => {
                if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg);
                    } catch (e) {
                        return String(arg);
                    }
                }
                return String(arg);
            })
        };

        logBuffer.push(logEntry);

        // Keep only last 1000 entries
        if (logBuffer.length > 1000) {
            logBuffer = logBuffer.slice(-1000);
        }

        // Send via WebSocket if connected
        if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
            wsConnection.send(JSON.stringify(logEntry));
        }
    }

    console.log = function(...args) {
        originalLog.apply(console, args);
        sendLog('log', args);
    };

    console.error = function(...args) {
        originalError.apply(console, args);
        sendLog('error', args);
    };

    console.warn = function(...args) {
        originalWarn.apply(console, args);
        sendLog('warn', args);
    };

    console.info = function(...args) {
        originalInfo.apply(console, args);
        sendLog('info', args);
    };

    console.debug = function(...args) {
        originalDebug.apply(console, args);
        sendLog('debug', args);
    };

    // Capture unhandled errors
    window.addEventListener('error', function(event) {
        sendLog('unhandled_error', [event.message, event.filename, event.lineno]);
    });

    window.addEventListener('unhandledrejection', function(event) {
        sendLog('unhandled_rejection', [event.reason]);
    });

    // Start WebSocket connection
    connectWebSocket();

    // Make log buffer available globally
    window.capturedLogs = logBuffer;

    console.log('🚀 Browser log monitor initialized');
})();
</script>
`;

console.log('🚀 Starting Browser Console Log Monitor...');
console.log('📍 Your app should be running at http://localhost:5174');
console.log('📡 WebSocket server will start on ws://localhost:8085');
console.log('');

// Create WebSocket server for receiving logs
const wss = new WebSocket.Server({ port: 8085 });

wss.on('connection', function connection(ws) {
    console.log('✅ Browser connected to log monitor');

    ws.on('message', function incoming(message) {
        try {
            const logEntry = JSON.parse(message);
            const timestamp = new Date(logEntry.timestamp).toLocaleTimeString();
            const args = logEntry.args.join(' ');

            switch (logEntry.type) {
                case 'error':
                case 'unhandled_error':
                case 'unhandled_rejection':
                    console.error(`🔴 [${timestamp}] ${logEntry.type.toUpperCase()}: ${args}`);
                    break;
                case 'warn':
                    console.warn(`🟡 [${timestamp}] WARN: ${args}`);
                    break;
                case 'info':
                    console.info(`🔵 [${timestamp}] INFO: ${args}`);
                    break;
                case 'debug':
                    console.log(`⚪ [${timestamp}] DEBUG: ${args}`);
                    break;
                default:
                    console.log(`📝 [${timestamp}] LOG: ${args}`);
            }
        } catch (error) {
            console.error('Failed to parse log message:', error);
        }
    });

    ws.on('close', function close() {
        console.log('❌ Browser disconnected from log monitor');
    });

    ws.on('error', function error(err) {
        console.error('WebSocket error:', err.message);
    });
});

console.log('✅ WebSocket server started on port 8085');
console.log('');
console.log('📋 INSTRUCTIONS:');
console.log('1. Open your browser and go to http://localhost:5174');
console.log('2. Open browser developer console (F12)');
console.log('3. Copy and paste this script to inject log monitoring:');
console.log('');
console.log('='.repeat(60));
console.log(logCaptureScript);
console.log('='.repeat(60));
console.log('');
console.log('🎯 Browser logs will appear here once the script is injected...');
console.log('💡 You can also inject this script via browser DevTools > Console');
console.log('🛑 Press Ctrl+C to stop monitoring');

// Keep the process running
process.on('SIGINT', function() {
    console.log('\\n🛑 Shutting down browser log monitor...');
    process.exit(0);
});