<!--
BackgroundShader - WebGL procedural background with 3-layer simplex noise patterns.

Full visual effects with coordinate transforms (skew, rotate, spiral, kaleidoscope, pulse),
UV warping (wave, turbulence), 3-layer pattern blending, and dithering.

Pattern types:
- 0: Fluid (default) - smooth noise flow
- 1: Fabric - sine interference woven appearance
- 2: Glass - caustics with additive blending

All parameters hardcoded to user's original aesthetic values.
-->
<script>
  import * as THREE from 'three';
  import { onMount } from 'svelte';
  import { volatilityStore } from '../stores/volatilityStore.js';

  let container;
  let renderer, material, animationId;

  let volatility = { smoothedSigma: 0, smoothedMaxZone: 0, smoothedVelocity: 0, smoothedRange: 0, ready: false };

  // Set to false to disable volatility-driven background effects
  let volatilityEffectsEnabled = false;

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  const ZONE_COLORS = [
    [0x57/255, 0x8f/255, 0xff/255],
    [0x00/255, 0xd4/255, 0xaa/255],
    [0xe0/255, 0x40/255, 0xfb/255],
    [0xff/255, 0x6b/255, 0x35/255],
    [0xef/255, 0x44/255, 0x44/255],
  ];

  const ACCENT_COLORS = [
    [0x00/255, 0x42/255, 0x80/255],
    [0x6b/255, 0x21/255, 0xa8/255],
    [0xff/255, 0x6b/255, 0x35/255],
  ];

  function colorForZone(score) {
    const colors = ZONE_COLORS;
    const t = Math.min(Math.max(score, 0), 100) / 25;
    const i = Math.min(Math.floor(t), 3);
    const f = t - i;
    const c1 = colors[i];
    const c2 = colors[i + 1];
    return { r: lerp(c1[0], c2[0], f), g: lerp(c1[1], c2[1], f), b: lerp(c1[2], c2[2], f) };
  }

  function accentForZone(score) {
    const colors = ACCENT_COLORS;
    const t = Math.min(Math.max(score, 0), 100) / 50;
    const i = Math.min(Math.floor(t), 1);
    const f = t - i;
    const c1 = colors[i];
    const c2 = colors[i + 1];
    return { r: lerp(c1[0], c2[0], f), g: lerp(c1[1], c2[1], f), b: lerp(c1[2], c2[2], f) };
  }

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    uniform vec2 uResolution;
    uniform int uType;
    uniform float uScaleX;
    uniform float uScaleY;
    uniform float uSpeed;
    uniform float uWaveAmount;
    uniform float uRotate;
    uniform float uSpiral;
    uniform float uTurbulence;
    uniform float uDitherStrength;
    uniform float uSkew;
    uniform float uKaleidoscope;
    uniform float uPulse;
    uniform float uBlur1;
    uniform float uBlur2;
    uniform float uBlurAccent;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uAccent;
    uniform vec3 uBgColor;
    uniform float uOpacity;
    varying vec2 vUv;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m; m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    vec2 rotate2D(vec2 uv, float a) {
      float s = sin(a);
      float c = cos(a);
      return mat2(c, -s, s, c) * uv;
    }

    float random(vec2 uv) {
      return fract(sin(dot(uv.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    float patternFluid(vec2 uv, float t) {
      return snoise(uv + t) * 0.5 + 0.5;
    }

    float patternFabric(vec2 uv, float t) {
      float v = sin(uv.x * 3.0 + t + sin(uv.y * 4.0 + t * 0.5));
      return v * 0.5 + 0.5;
    }

    float patternGlass(vec2 uv, float t) {
      float v = abs(snoise(uv + t));
      return 1.0 - v;
    }

    float getPattern(vec2 uv, float t) {
      if (uType == 1) return patternFabric(uv, t);
      if (uType == 2) return patternGlass(uv, t);
      return patternFluid(uv, t);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uResolution.xy;
      float ratio = uResolution.x / uResolution.y;
      vec2 p = uv - 0.5;
      p.x *= ratio;

      p.x += p.y * uSkew;
      p = rotate2D(p, uRotate);

      float len = length(p);
      float angle = atan(p.y, p.x);
      angle += uSpiral * (1.0 - smoothstep(0.0, 1.5, len));
      p = vec2(cos(angle), sin(angle)) * len;

      p = mix(p, abs(p), uKaleidoscope);
      p.x *= uScaleX;
      p.y *= uScaleY;

      float pulse = 1.0 + sin(uTime * uSpeed * 3.0) * uPulse * 0.2;
      p *= pulse;

      float t = uTime * uSpeed;
      vec2 noiseUV = p;
      noiseUV.x += sin(noiseUV.y * 2.0 + t) * uWaveAmount * 0.1;
      noiseUV.y += cos(noiseUV.x * 2.0 - t) * uWaveAmount * 0.1;

      if (uTurbulence > 0.01) {
        float turb = snoise(noiseUV * 3.0 + t);
        noiseUV += turb * uTurbulence * 0.2;
      }

      vec3 color = uBgColor;
      float n1 = getPattern(noiseUV + vec2(t * 0.5, 0.0), t * 0.1);
      float n2 = getPattern(noiseUV * 1.5 - vec2(0.0, t * 0.3), t * 0.15);
      float n3 = getPattern(noiseUV * 2.5 + vec2(t * 0.2, t * 0.2), t * 0.2);

      float b1 = max(0.001, uBlur1);
      float mask1 = smoothstep(0.5 - b1 * 0.5, 0.5 + b1 * 0.5, n1);
      color = mix(color, uColor1, mask1);

      float b2 = max(0.001, uBlur2);
      float mask2 = smoothstep(0.5 - b2 * 0.5, 0.5 + b2 * 0.5, n2);
      color = mix(color, uColor2, mask2);

      float b3 = max(0.001, uBlurAccent);
      float mask3 = smoothstep(0.5 - b3 * 0.5, 0.5 + b3 * 0.5, n3);
      float intensity = clamp(uWaveAmount * 0.6 + 0.2, 0.0, 1.0);

      if (uType == 2) {
        color += uAccent * mask3 * intensity;
      } else {
        color = mix(color, uAccent, mask3 * intensity);
      }

      float dither = (random(uv + t) - 0.5) * uDitherStrength;
      color += dither;

      gl_FragColor = vec4(color, uOpacity);
    }
  `;

  onMount(() => {
    // Skip entire WebGL setup in headless/test environments
    if (navigator.webdriver) return;

    const unsubVolatility = volatilityStore.subscribe(v => { volatility = v; });

    try {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      container.appendChild(renderer.domElement);

      material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
          uType: { value: 0 },
          uScaleX: { value: 2.04 },
          uScaleY: { value: 0.254 },
          uSpeed: { value: 0.03 },
          uWaveAmount: { value: 3.5 },
          uRotate: { value: 1.21204 },
          uSpiral: { value: 0.0 },
          uTurbulence: { value: 1.6 },
          uDitherStrength: { value: 0.0287 },
          uSkew: { value: 0.0 },
          uKaleidoscope: { value: 0.0 },
          uPulse: { value: 0.0 },
          uBlur1: { value: 0.9465 },
          uBlur2: { value: 1.5 },
          uBlurAccent: { value: 2.0 },
          uColor1: { value: new THREE.Color('#020712') },
          uColor2: { value: new THREE.Color('#578fff') },
          uAccent: { value: new THREE.Color('#004280') },
          uBgColor: { value: new THREE.Color('#1b1d50') },
          uOpacity: { value: 0.1 }
        },
        vertexShader,
        fragmentShader
      });

      const geometry = new THREE.PlaneGeometry(2, 2);
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      const clock = new THREE.Clock();

      // Skip animation loop in headless/test environments (no GPU)
      function animate() {
        animationId = requestAnimationFrame(animate);
        material.uniforms.uTime.value = clock.getElapsedTime();

        // ── Volatility-driven uniform adjustments ──
        // Each metric drives its own shader uniform independently (no averaging).
        // Adjust the lerp() second arg (max value) to control intensity.
        //
        // uSpeed:     How fast the background pattern moves.
        //             Driven by EWMA velocity (rate of price change).
        //             Range: 0.02 (calm) → 0.06 (extreme).
        //             Higher max = faster, more distracting movement.
        //
        // uTurbulence: How chaotic/fragmented the noise pattern becomes.
        //              Driven by dispersion sigma (cross-currency divergence).
        //              Range: 0.8 (calm) → 3.5 (extreme).
        //              Higher max = more visual chaos when currencies diverge.
        //
        // uPulse:     Amplitude of the pulsing/breathing effect.
        //             Driven by range (spread between strongest & weakest currency).
        //             Range: 0.0 (calm) → 0.4 (extreme).
        //             Higher max = more visible pulsing.
        //
        // uColor2:    Primary pattern color.
        //             Driven by max zone score (single-currency extreme).
        //             Gradient: blue → teal → magenta → orange → red.
        //             Adjust ZONE_COLORS array to change the color stops.
        //
        // uAccent:    Accent/highlight color.
        //             Also driven by max zone score.
        //             Gradient: dark blue → purple → orange.
        //             Adjust ACCENT_COLORS array to change the color stops.
        //
        // uOpacity:   Overall transparency of the entire background effect.
        //             Range: 0.0 (invisible) → 1.0 (full opaque).
        //             Set below 1.0 to let the CSS gradient behind show through.
        //             Useful to dial down the effect without changing individual params.
        if (volatility.ready && volatilityEffectsEnabled) {
          const v = volatility;
          material.uniforms.uSpeed.value = lerp(0.02, 0.06, v.smoothedVelocity / 100);
          material.uniforms.uTurbulence.value = lerp(0.8, 3.5, v.smoothedSigma / 100);
          material.uniforms.uPulse.value = lerp(0.0, 0.4, v.smoothedRange / 100);
          const c2 = colorForZone(v.smoothedMaxZone);
          material.uniforms.uColor2.value.setRGB(c2.r, c2.g, c2.b);
          const ac = accentForZone(v.smoothedMaxZone);
          material.uniforms.uAccent.value.setRGB(ac.r, ac.g, ac.b);
        }

        renderer.render(scene, camera);
      }
      animate();

      const handleResize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animationId);
        unsubVolatility();
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    } catch (e) {
      unsubVolatility();
      console.warn('WebGL not supported:', e);
    }
  });
</script>

<div class="background-shader" bind:this={container} aria-hidden="true"></div>

<style>
  .background-shader {
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
  }
</style>
