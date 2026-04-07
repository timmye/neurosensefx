<!--
BackgroundShader - WebGL procedural background with raymarched cos/sin fractal field.

Glowing neon line pattern created via raymarching with customizable:
- Animation speed, spatial scale, color intensity
- Iteration depth (detail vs performance tradeoff)
- Corner roundness (smooth vs sharp fractal edges)
- Three-color blending weighted by spatial position

Volatility-driven uniforms available but disabled by default.
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
    uniform vec3 iResolution;
    uniform float iTime;
    uniform float uSpeed;
    uniform float uScaleX;
    uniform float uScaleY;
    uniform float uColorOffset;
    uniform float uIterLimit;
    uniform float uRoundness;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    uniform float uOpacity;
    varying vec2 vUv;

    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    void mainImage(out vec4 O, vec2 I) {
        float i = 0.0, z = 0.0, d = 0.0;
        O = vec4(0.0);

        for(O *= i; i++ < uIterLimit;) {
            vec3 p = z * normalize(vec3(I + I, 0.0) - iResolution.xyy);
            vec3 v;

            p.x += sin(p.x + iTime * uSpeed * 0.5) + cos(p.y + iTime * uSpeed * 0.3);
            p.y += cos(p.x - iTime * uSpeed * 0.4) + sin(p.y + iTime * uSpeed * 0.6);
            p.z += sin(iTime * uSpeed * 0.2) * 1.5;

            p.x *= uScaleX;
            p.y *= uScaleY;

            v = cos(p) - sin(p).yzx;

            vec3 shape = mix(max(v, v.yzx * 0.2), v, uRoundness);

            z += d = 1e-4 + 0.5 * length(shape);

            vec3 weights = abs(cos(p));
            weights /= dot(weights, vec3(1.0));

            vec3 customColor = uColor1 * weights.x + uColor2 * weights.y + uColor3 * weights.z;

            O.rgb += (customColor * uColorOffset) / d;
        }

        O /= O + 300.0;

        float luminance = dot(O.rgb, vec3(0.299, 0.587, 0.114));
        O.rgb = mix(vec3(luminance), O.rgb, 1.6);

        O.rgb += (random(I) - 0.5) / 128.0;

        O.a = uOpacity;
    }

    void main() {
        mainImage(gl_FragColor, gl_FragCoord.xy);
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
          iTime: { value: 0 },
          iResolution: { value: new THREE.Vector3(window.innerWidth, window.innerHeight, 1.0) },
          uSpeed: { value: 0.1 },
          uScaleX: { value: 2.0 },
          uScaleY: { value: 2.0 },
          uColorOffset: { value: 3.0 },
          uIterLimit: { value: 10.0 },
          uRoundness: { value: 1.0 },
          uColor1: { value: new THREE.Color('#004cff') },
          uColor2: { value: new THREE.Color('#03123f') },
          uColor3: { value: new THREE.Color('#2e89ff') },
          uOpacity: { value: 1.0 }
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
        material.uniforms.iTime.value = clock.getElapsedTime();

        // ── Volatility-driven uniform adjustments ──
        if (volatility.ready && volatilityEffectsEnabled) {
          const v = volatility;
          // Velocity → animation speed (0.2 calm → 1.5 extreme)
          material.uniforms.uSpeed.value = lerp(0.2, 1.5, v.smoothedVelocity / 100);
          // Sigma → fractal scale distortion (1.5 calm → 3.0 extreme)
          material.uniforms.uScaleX.value = lerp(1.5, 3.0, v.smoothedSigma / 100);
          material.uniforms.uScaleY.value = lerp(1.5, 3.0, v.smoothedSigma / 100);
          // Range → color intensity/brightness (2.0 calm → 5.0 extreme)
          material.uniforms.uColorOffset.value = lerp(2.0, 5.0, v.smoothedRange / 100);
          // Max zone → color 1 (primary fractal color)
          const c = colorForZone(v.smoothedMaxZone);
          material.uniforms.uColor1.value.setRGB(c.r, c.g, c.b);
          // Accent color → color 3
          const ac = accentForZone(v.smoothedMaxZone);
          material.uniforms.uColor3.value.setRGB(ac.r, ac.g, ac.b);
        }

        renderer.render(scene, camera);
      }
      animate();

      const handleResize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        material.uniforms.iResolution.value.set(window.innerWidth, window.innerHeight, 1.0);
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
