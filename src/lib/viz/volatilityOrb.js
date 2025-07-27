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

    const centerX = centralAxisXPosition;
    const centerY = height / 2;
    const radius = volatilityOrbBaseWidth * volatilitySizeMultiplier * volatilityIntensity;

    if (radius <= 0) return;

    // Determine color based on mode and intensity
    let baseColor;
    if (volatilityColorMode === 'directional') {
        baseColor = lastTickDirection === 'up' ? '59, 130, 246' : '239, 68, 68'; // Blue or Red
    } else if (volatilityColorMode === 'intensity') {
        const intensityFactor = Math.min(1, volatilityIntensity * 1.5);
        const red = 79 + (239 - 79) * intensityFactor;
        const green = 70 - (70 - 68) * intensityFactor;
        const blue = 229 - (229 - 68) * intensityFactor;
        baseColor = `${red.toFixed(0)}, ${green.toFixed(0)}, ${blue.toFixed(0)}`;
    } else { // 'single'
        baseColor = '79, 70, 229'; // Default Purple
    }

    const maxOpacity = 0.5;
    const opacity = volatilityOrbInvertBrightness ? 
        (1 - volatilityIntensity) * maxOpacity : 
        volatilityIntensity * maxOpacity;

    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    
    gradient.addColorStop(0, `rgba(${baseColor}, ${opacity})`);
    gradient.addColorStop(0.5, `rgba(${baseColor}, ${opacity * 0.5})`);
    gradient.addColorStop(1, `rgba(${baseColor}, 0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
}
