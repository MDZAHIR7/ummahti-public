/* ==========================================================================
   Ummahti Quran — ummahtiofficial.com

   The room, drawn for real.

   The stylesheet builds the room out of three stacked radial gradients. That
   is honest and it is cheap, but a gradient is flat: the light has no body,
   nothing hangs in it, and it cannot answer the reader. This draws the same
   room on a GPU instead — one fullscreen triangle, one fragment shader, no
   library. About 6 KB, against the 170 KB a 3D library would have cost for
   the same picture.

   Three rules it keeps:

   1. It is decoration and nothing else. The canvas lives inside .sky, which
      is already aria-hidden, and it never touches a pixel of content. With
      no JavaScript, no WebGL, or a lost context, the CSS gradients are still
      there and the page is the page.

   2. It asks the device first. A phone on 2G, a machine with few cores, a
      reader who has asked for less motion — none of them get this, and none
      of them get a worse page for it. They get the site as it already was.

   3. Its colours are the theme's colours, read back from the document rather
      than written here, so the room changes light with everything else.
   ========================================================================== */

(() => {
  'use strict';

  const sky = document.querySelector('.sky');
  if (!sky) return;

  /* ---------------------------------------------------------- can we? */

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  function capable() {
    if (reduced.matches) return false;
    if (conn) {
      if (conn.saveData) return false;
      if (/^(slow-2g|2g|3g)$/.test(conn.effectiveType || '')) return false;
    }
    if ((navigator.hardwareConcurrency || 4) < 4) return false;
    if (navigator.deviceMemory && navigator.deviceMemory < 2) return false;
    return true;
  }

  if (!capable()) return;

  /* --------------------------------------------------------- the shader */

  /* The room has one warm light in the top right and one cool bounce off the
     floor. The light is given body by sampling noise along the way out from
     it, so it reads as a glow through air rather than as a circle, and the
     dust that hangs in it is brightest where the light is strongest. */
  const VERT = `
    attribute vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;

  const FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif

    uniform vec2  u_res;
    uniform float u_time;
    uniform vec2  u_light;     // where the crescent hangs, in screen space
    uniform vec2  u_point;     // the pointer, smoothed
    uniform vec3  u_ink;       // the theme's background
    uniform vec3  u_gold;      // the theme's accent — the light itself
    uniform vec3  u_amb;       // the theme's secondary — the bounce
    uniform float u_lit;       // how far down the page we are, 0..1
    uniform float u_dark;      // 1 on a dark theme, 0 on a pale one

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    vec2 hash2(vec2 p) {
      return fract(sin(vec2(dot(p, vec2(127.1, 311.7)),
                            dot(p, vec2(269.5, 183.3)))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }

    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p *= 2.02;
        a *= 0.5;
      }
      return v;
    }

    /* Motes hanging in the beam. One cell lookup, nine taps, and they are
       only ever drawn where there is light to catch them. */
    float motes(vec2 p, float scale, float drift) {
      vec2 q = p * scale + vec2(u_time * 0.012 * drift, -u_time * 0.008 * drift);
      vec2 i = floor(q), f = fract(q);
      float m = 0.0;
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 g = vec2(float(x), float(y));
          vec2 o = hash2(i + g);
          float tw = 0.6 + 0.4 * sin(u_time * 0.6 + o.x * 24.0);
          vec2 r = g + o - f;
          m += smoothstep(0.0022, 0.0, dot(r, r)) * tw * step(0.70, o.y);
        }
      }
      return m;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_res;
      float aspect = u_res.x / u_res.y;
      vec2 p = vec2(uv.x * aspect, uv.y);
      vec2 light = vec2(u_light.x * aspect, u_light.y);

      // the pointer nudges the light a little, so the room answers the hand
      light += (u_point - vec2(0.5 * aspect, 0.5)) * 0.05;

      float d = distance(p, light);

      /* Body. Sampling noise along the ray out from the light makes the glow
         breathe unevenly, the way light through air does. */
      vec2 dir = normalize(p - light + 1e-4);
      float body = fbm(light + dir * d * 2.6 + vec2(u_time * 0.02, u_time * 0.014));
      float glow = exp(-d * 2.15) * (0.62 + 0.68 * body);
      glow += exp(-d * 6.0) * 0.5;                    // the hot core

      // the cool bounce off the floor, opposite corner
      float b = distance(p, vec2(0.14 * aspect, 0.88));
      float bounce = exp(-b * 2.5) * (0.55 + 0.5 * fbm(p * 1.6 - u_time * 0.01));

      float depth = 0.20 + 0.16 * u_lit;

      vec3 col = u_ink;
      col += u_gold * glow * depth;
      col += u_amb * bounce * (0.30 + 0.10 * u_lit);

      // dust, only in the beam
      float dust = motes(p, 11.0, 1.0) * 0.55 + motes(p, 26.0, 1.8) * 0.35;
      col += u_gold * dust * glow * 2.1;

      // a pale room takes all of this at a whisper, or it turns to mud
      col = mix(u_ink + (col - u_ink) * 0.34, col, u_dark);

      // grain, so a wide dark field does not band on a cheap panel
      col += (hash(gl_FragCoord.xy + fract(u_time)) - 0.5) * 0.016;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  /* ------------------------------------------------------------- set up */

  const canvas = document.createElement('canvas');
  canvas.className = 'sky-gl';
  canvas.setAttribute('aria-hidden', 'true');

  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
    failIfMajorPerformanceCaveat: true,     // a software renderer is not worth it
  });

  if (!gl) return;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  // one triangle that covers the viewport — cheaper than two, no seam
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  for (const name of ['u_res', 'u_time', 'u_light', 'u_point', 'u_ink', 'u_gold', 'u_amb', 'u_lit', 'u_dark']) {
    U[name] = gl.getUniformLocation(prog, name);
  }

  sky.prepend(canvas);
  sky.classList.add('is-live');

  /* ------------------------------------------------------------ colours */

  /* Read back off the document rather than tabulated here, so the room is
     lit by whichever of the nine themes is on and cannot disagree with it. */
  const probe = document.createElement('span');
  probe.style.display = 'none';
  document.body.append(probe);

  function rgb(value) {
    probe.style.color = '#000';
    probe.style.color = value;
    const m = getComputedStyle(probe).color.match(/[\d.]+/g);
    if (!m) return [0, 0, 0];
    return [m[0] / 255, m[1] / 255, m[2] / 255];
  }

  let ink = [0, 0, 0], gold = [1, 1, 1], amb = [0, 0, 0], dark = 1;

  function readTheme() {
    const s = getComputedStyle(document.documentElement);
    ink = rgb(s.getPropertyValue('--ink').trim() || '#08080a');
    gold = rgb(s.getPropertyValue('--gold').trim() || '#d4af37');
    amb = rgb(`rgb(${s.getPropertyValue('--amb-rgb').trim() || '19,42,34'})`);
    dark = s.getPropertyValue('color-scheme').trim() === 'light' ? 0 : 1;
  }

  readTheme();
  new MutationObserver(readTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  /* ------------------------------------------------------------- input */

  let px = 0.82, py = 0.16;        // the pointer, smoothed towards the light
  let tx = 0.82, ty = 0.16;

  if (!window.matchMedia('(hover: none)').matches) {
    window.addEventListener('pointermove', (e) => {
      tx = e.clientX / window.innerWidth;
      ty = 1 - e.clientY / window.innerHeight;
    }, { passive: true });
  }

  /* -------------------------------------------------------------- draw */

  let w = 0, h = 0, dpr = 1;
  let lightX = 0.82, lightY = 0.84;

  function measure() {
    // the light sits exactly where the crescent hangs, whatever the layout
    const moon = document.querySelector('.sky-moon');
    if (moon) {
      const r = moon.getBoundingClientRect();
      if (r.width) {
        lightX = (r.left + r.width / 2) / window.innerWidth;
        lightY = 1 - (r.top + r.height / 2) / window.innerHeight;
      }
    }
    // half resolution on dense screens: this is a soft field, nobody can tell
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const nw = Math.round(window.innerWidth * dpr);
    const nh = Math.round(window.innerHeight * dpr);
    if (nw !== w || nh !== h) {
      w = canvas.width = nw;
      h = canvas.height = nh;
      gl.viewport(0, 0, w, h);
    }
  }

  measure();
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measure, 140);
  }, { passive: true });

  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    sky.classList.remove('is-live');     // the gradients come back
    canvas.remove();
  });

  const start = performance.now();

  /* app.js owns the only rAF on the page, so this hands it a frame to call
     rather than starting a second loop. If app.js never arrives, nothing
     here runs and the CSS room is still correct. */
  window.UmmahtiSky = {
    frame(now, lit) {
      if (lost) return;

      px += (tx - px) * 0.045;
      py += (ty - py) * 0.045;

      gl.uniform2f(U.u_res, w, h);
      gl.uniform1f(U.u_time, (now - start) / 1000);
      gl.uniform2f(U.u_light, lightX, lightY);
      gl.uniform2f(U.u_point, px * (w / h), py);
      gl.uniform3fv(U.u_ink, ink);
      gl.uniform3fv(U.u_gold, gold);
      gl.uniform3fv(U.u_amb, amb);
      gl.uniform1f(U.u_lit, lit || 0);
      gl.uniform1f(U.u_dark, dark);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    remeasure: measure,
  };
})();
