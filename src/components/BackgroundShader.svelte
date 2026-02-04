<!--
BackgroundShader - WebGL procedural background with simplex noise patterns (Fluid, Fabric, Glass).

WHY: Provides richer visual patterns with simplex noise gradients.
Single-file component keeps logic centralized; hardcoded params match selected aesthetic defaults.

Pattern types:
- 0: Fluid (default) - smooth noise flow
- 1: Fabric - absolute noise creates woven appearance
- 2: Glass - dual noise layer creates refraction effect
-->
<script>
  import * as THREE from 'three';
  import { onMount } from 'svelte';

  let container;
  let renderer, material, animationId;

  // Vertex shader: pass-through for full-screen quad (no transformation needed)
  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;

  // Fragment shader: simplex noise procedural patterns
  const fragmentShader = `
    uniform float uTime;
    uniform vec2 uResolution;
    uniform int uType;
    uniform float uScaleX;
    uniform float uSpeed;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uAccent;
    varying vec2 vUv;

    // Simplex noise (Perlin variant) - standard GLSL algorithm
    // Provides smooth, organic gradients via procedural simplex noise. Single-octave noise performs well at 60fps.
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

    void main() {
      vec2 uv = vUv;
      uv.x *= uResolution.x / uResolution.y; // Aspect ratio correction
      float t = uTime * uSpeed;
      float scale = uScaleX;
      float noiseVal = snoise(uv * scale + vec2(t));
      float pattern = noiseVal;
      // Pattern type switching via uniform integer - single shader handles all three types
      if (uType == 1) {
        pattern = abs(snoise(uv * scale * 2.0 + t)); // Fabric: absolute creates sharp edges
      } else if (uType == 2) {
        float n1 = snoise(uv * scale + t);
        float n2 = snoise(uv * scale * 1.5 - t * 0.5); // Glass: counter-rotating layers
        pattern = (n1 + n2) * 0.5;
      }
      vec3 col = mix(uColor1, uColor2, pattern * 0.5 + 0.5);
      col = mix(col, uAccent, smoothstep(0.4, 0.6, pattern) * 0.3);
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  onMount(() => {
    try {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); // 2D full-screen quad
      renderer = new THREE.WebGLRenderer({ antialias: false }); // Antialias unnecessary for shader background
      renderer.setSize(window.innerWidth, window.innerHeight);
      container.appendChild(renderer.domElement);

      material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
          uType: { value: 0 }, // Fluid pattern (type 0)
          uScaleX: { value: 2.04 }, // Noise texture stretching (X-axis scale)
          uSpeed: { value: 0.03 }, // Animation rate multiplier
          uColor1: { value: new THREE.Color('#020712') }, // Dark shadow tone
          uColor2: { value: new THREE.Color('#578fff') }, // Light highlight tone
          uAccent: { value: new THREE.Color('#004280') } // Midtone accent
        },
        vertexShader,
        fragmentShader
      });

      const geometry = new THREE.PlaneGeometry(2, 2); // Full-screen quad (-1 to 1)
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      const clock = new THREE.Clock();

      function animate() {
        animationId = requestAnimationFrame(animate);
        material.uniforms.uTime.value = clock.getElapsedTime();
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
        geometry.dispose(); // Prevent GPU memory leaks
        material.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    } catch (e) {
      console.warn('WebGL not supported:', e);
    }
  });
</script>

<div class="background-shader" bind:this={container} aria-hidden="true"></div>

<style>
  .background-shader {
    position: fixed;
    inset: 0;
    z-index: -1; /* Behind all workspace content */
    pointer-events: none; /* Pass through clicks to workspace */
  }
</style>
