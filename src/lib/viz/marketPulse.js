// src/lib/viz/marketPulse.js
import * as d3 from 'd3';

export function createMarketPulse(canvas, config) {
    const context = canvas.getContext('2d');
    const { width, height } = canvas;

    let dots = [];
    // Initialize time tracking variables
    let now = performance.now();
    let lastTime = now;

    const timeWindow = (config.marketPulseTimeWindowMinutes || 5) * 60 * 1000; // Time window in milliseconds
    const yRangePips = config.yRangePips || 10; // Configurable max price delta range for Y axis (in pips)

    // Scaling factor to convert pips to pixels
    // The baseline is at the bottom (y = height - 1).
    // A positive delta moves the dot up (y decreases), negative moves it down (y increases).
    const pipsToPixelsScale = (height - 1) / (yRangePips * 2);

    function render() {
        // Update current time for this frame
        now = performance.now();


        // Draw baseline at the bottom
        context.strokeStyle = '#444';
        context.beginPath();
        context.moveTo(0, height - 1);
        context.lineTo(width, height - 1);
        context.stroke();

        // Filter out old dots first for efficiency
//        dots = dots.filter(dot => (now - dot.timestamp) <= timeWindow);

        // Update and draw remaining dots
        dots.forEach(dot => {
            const age = now - dot.timestamp;

            context.beginPath();
            // Use directional color based on the stored priceDelta
            const color = dot.priceDelta > 0 ? 'rgba(59, 130, 246,' : 'rgba(239, 68, 68,'; // Blue for Up, Red for Down
            context.fillStyle = `${color} ${opacity})`;
            context.arc(x, dot.y, dot.radius, 0, 2 * Math.PI);
            context.fill();
        });

        lastTime = now;
    }

    function update(symbol, priceDelta) {
        if (priceDelta === 0) return;
 console.log('Received update for symbol:', symbol, 'with priceDelta:', priceDelta, 'pipsToPixelsScale:', pipsToPixelsScale);
        const timestamp = performance.now();

        const newDot = {
            timestamp: timestamp,
            priceDelta: priceDelta, // Store for coloring
            // Y position is relative to the bottom baseline.
            // A positive delta should decrease y (move up), negative should increase y (move down).
            y: (height - 1) - (priceDelta / 0.00001) * pipsToPixelsScale,
            radius: 1.5,
            initialOpacity: config.marketPulseDotOpacity || 0.7,
        };
        dots.push(newDot);

        // Optional safeguard against extreme dot buildup
        if (dots.length > 3000) {
            dots.shift();
        }
    }

    // Start the animation loop
    const animationFrame = () => {
        render();
        requestAnimationFrame(animationFrame);
    }
    requestAnimationFrame(animationFrame);

    return {
        update
    };
}
