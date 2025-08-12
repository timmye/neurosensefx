// Animation state for the orb
let pulseAngle = 0;

export function drawVolatilityOrb(ctx, config, state, width, height) {
    if (!config.showVolatilityOrb || !state.volatilityIntensity) return;

    const {
        volatilityOrbBaseWidth,
        centralAxisXPosition,
        volatilityColorMode,
        volatilityOrbInvertBrightness,
        volatilitySizeMultiplier,
    } = config;
    
    const { volatilityIntensity, lastTickDirection } = state;

    // --- Performant Pulse Animation ---
    // The pulse "advances" with each data tick, tying the animation directly
    // to market activity. The speed is proportional to volatility.
    const pulseSpeed = 0.5 + (volatilityIntensity * 1.5); 
    pulseAngle += pulseSpeed;
    if (pulseAngle > Math.PI * 2) {
        pulseAngle -= Math.PI * 2;
    }

    const pulseMagnitude = 1 + (Math.sin(pulseAngle) * 0.08); // 8% size variance

    const centerX = centralAxisXPosition;
    const centerY = height / 2;
    
    const baseRadius = volatilityOrbBaseWidth * volatilitySizeMultiplier * volatilityIntensity;
    const radius = baseRadius * pulseMagnitude;

    if (radius <= 0) return;

    let baseColor;
    if (volatilityColorMode === 'directional') {
        baseColor = lastTickDirection === 'up' ? '59, 130, 246' : '239, 68, 68'; // Blue or Red
    } else if (volatilityColorMode === 'directional') {
        const intensityFactor = Math.min(1, volatilityIntensity * 1.5);
        const red = 79 + (239 - 79) * intensityFactor;
        const green = 70 - (70 - 68) * intensityFactor;
        const blue = 229 - (229 - 68) * intensityFactor;
        baseColor = `${red.toFixed(0)}, ${green.toFixed(0)}, ${blue.toFixed(0)}`;
    } else { // 'single'
        baseColor = '79, 70, 229'; // Default Purple
    }

    const maxOpacity = 0.4; // Slightly reduced for a subtler effect
    const opacity = (volatilityOrbInvertBrightness ? 
        (1 - volatilityIntensity) : 
        volatilityIntensity) * maxOpacity;

    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    
    gradient.addColorStop(0, `rgba(${baseColor}, ${opacity})`);
    gradient.addColorStop(0.6, `rgba(${baseColor}, ${opacity * 0.4})`); // Adjusted stop for a softer edge
    gradient.addColorStop(1, `rgba(${baseColor}, 0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
}
