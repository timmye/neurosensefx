<!--
BackgroundShader - WebGL procedural background.
Domain-warped fBm raymarcher by @YoheiNishitsuji (MIT license).
-->
<script>
  import * as THREE from 'three';
  import { onMount } from 'svelte';

  let container;
  let renderer, material, animationId;

  const VERTEX_SHADER = `
    void main() {
      gl_Position = vec4(position, 1.0);
    }
  `;

  const FRAGMENT_SHADER = `
    // SPDX-License-Identifier: MIT
    // Copyright (c) 2026 @YoheiNishitsuji
    uniform vec2 u_resolution;
    uniform float u_time;

    vec3 hsv(float h, float s, float v) {
        vec4 t = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
        vec3 p = abs(fract(vec3(h) + t.xyz) * 6.0 - vec3(t.w));
        return v * mix(vec3(t.x), clamp(p - vec3(t.x), 0.0, 1.0), s);
    }

    void main() {
        vec2 fragCoord = gl_FragCoord.xy;
        vec2 r = u_resolution;
        float t = u_time * 0.02;
        vec4 o = vec4(0.0, 0.0, 0.0, 1.0);

        float i = 0.0, e = 0.0, R = 0.0, s = 0.0;

        // RAY SETUP
        vec3 q = vec3(0.0), p,
             d = vec3((fragCoord - 0.5*r)/min(r.y, r.x)*0.5 + vec2(0, 1), 1);

        // RAY MARCH: 129 steps walking point q along d
        for (q.yz -= 1.0; i++ < 129.0; ) {
            o.rgb += hsv(-R/i, 0.4, min(R*e*s - 0.07, e)/20.0);

            s = 1.0;

            // ADAPTIVE STEP
            p = q += d*e*R*0.24;

            // DOMAIN WARP
            p = vec3(log2(R = length(p)) - t*0.5, exp(-p.z/R), atan(p.y, p.x));

            // fBm: sum sin/cos noise at octaves doubling each pass
            for (e = (p.y -= 1.0); s < 5e2; s += s)
                e += dot(sin(p.yzx*s - t), vec3(0.2) - cos(p.yxy*s))/s*0.2;
        }

        gl_FragColor = o;
    }
  `;

  onMount(() => {
    // Skip entire WebGL setup in headless/test environments
    if (navigator.webdriver) return;

    try {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      container.appendChild(renderer.domElement);

      const geometry = new THREE.PlaneGeometry(2, 2);
      material = new THREE.ShaderMaterial({
        uniforms: {
          u_time: { value: 0 },
          u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      const clock = new THREE.Clock();
      let tabVisible = !document.hidden;

      function animate() {
        if (!tabVisible) return;
        animationId = requestAnimationFrame(animate);
        material.uniforms.u_time.value = clock.getElapsedTime();
        renderer.render(scene, camera);
      }
      animate();

      function handleVisibility() {
        const wasHidden = !tabVisible;
        tabVisible = !document.hidden;
        if (wasHidden && tabVisible) animate();
      }

      const handleResize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        material.uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
      };
      window.addEventListener('resize', handleResize);
      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
        window.removeEventListener('resize', handleResize);
        document.removeEventListener('visibilitychange', handleVisibility);
        cancelAnimationFrame(animationId);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    } catch (e) {
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
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
