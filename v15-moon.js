/* Ummahti: the Moon of 6,236.

   Our crescent, drawn with the Quran itself: every point is an ayah, in mushaf order, placed
   on the gold filigree of the approved moon master (tools/build_moon_data.py reads both from
   the app's own files).

   At rest it hangs in an astral night: emerald depth, far and near stars, and three orbits
   turning around the moon's disc ("each, in an orbit, is swimming", 36:40). Sixteen brighter
   lights travel those orbits: ayat about the moon, and the narrations behind the name Ummahti.
   Point at the moon and the ayat part around the pointer while the surah you are over lights
   up; tap any ayah and it opens, tethered to its point.

   Scrolling through "Thirty nights", the same points: open the crescent into its thirty juz
   (an exploded view, along the moon's own lines), settle as thirty moons across one Hijri
   month, then regroup into the reader's own My Khatm pace (30, 60 or 90 days) and return.
   Scroll drives every change, so it pauses, reverses and resumes where the reader is. Ambient
   life runs only while the moon is in view, the tab is visible and motion is wanted. */
(() => {
  'use strict';
  const D = window.UMMAHTI_MOON;
  if (!D || !window.HTMLCanvasElement) return;
  const root = document.documentElement;
  const rtl = root.dir === 'rtl';
  const lang = (root.lang || 'en').slice(0, 2);
  const T = window.UMMAHTI_V15_I18N || {};
  const t = (key, fallback) => T[key] || fallback;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const N = D.total;
  const arabicNames = rtl && D.namesArabic;
  const VERSION = '20261019f';

  /* ------------------------------------------------ who each point is */
  const surahOf = new Uint8Array(N), ayahOf = new Uint16Array(N), juzOf = new Uint8Array(N), inJuz = new Uint16Array(N);
  let v = 0;
  D.counts.forEach((count, s) => { for (let a = 1; a <= count; a++, v++) { surahOf[v] = s; ayahOf[v] = a; } });
  const juzFirst = [];
  for (let i = 0, last = 0, seen = 0; i < N; i++) {
    const c = D.juz.charCodeAt(i);
    const j = (c <= 90 ? c - 64 : c - 96 + 26) - 1;
    juzOf[i] = j;
    if (j !== last || i === 0) { juzFirst[j] = i; seen = 0; last = j; }
    inJuz[i] = seen++;
  }
  const sizes = D.juzSizes, maxJuz = Math.max(...sizes);
  const digits = new Intl.NumberFormat(root.lang || 'en');
  const surahName = s => (arabicNames ? D.namesArabic[s] : D.names[s]);
  const ref = i => surahName(surahOf[i]) + ' ' + digits.format(surahOf[i] + 1) + ':' + digits.format(ayahOf[i]);
  const fmt = (key, fallback, values) => t(key, fallback).replace(/\{(\w+)\}/g, (_, k) => values[k]);

  /* Small, stable per-point randomness for depth, stagger and flight. */
  const seedA = new Float32Array(N), seedB = new Float32Array(N);
  for (let i = 0, s = 6236; i < N; i++) {
    s = (s * 16807) % 2147483647; seedA[i] = s / 2147483647;
    s = (s * 16807) % 2147483647; seedB[i] = s / 2147483647;
  }
  const rand = (() => { let s = 114; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

  /* ------------------------------------------------------ the surface */
  const canvas = document.createElement('canvas');
  canvas.className = 'v-moon-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const sky = document.querySelector('.sky');
  (sky ? sky.after(canvas) : document.body.prepend(canvas));
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;
  const tip = document.createElement('div');
  tip.className = 'v-moon-tip';
  tip.setAttribute('aria-hidden', 'true');
  tip.hidden = true;
  document.body.append(tip);

  const art = new Image();
  art.decoding = 'async';
  art.src = (innerWidth < 700 ? '/media/v15/moon-800.webp' : '/media/v15/moon-1600.webp') + '?v=' + VERSION;
  art.addEventListener('load', () => request());

  const nights = document.querySelector('[data-nights]');
  const steps = nights ? [...nights.querySelectorAll('[data-night-step]')] : [];
  /* The first words stay put while the moon swirls into place, and leave only after it has. */
  if (steps[0]) { const pin = document.createElement('div'); pin.className = 'v-night-pin'; pin.append(...steps[0].childNodes); steps[0].append(pin); }
  const hero = document.querySelector('.v-hero');
  const closing = document.querySelector('.v-close');
  if (nights) nights.classList.add('is-live');

  /* Arrangements: resting moon, centred moon, exploded moon, the month, the reader's plan. */
  const K = { M: new Float32Array(N * 2), Mc: new Float32Array(N * 2), X: new Float32Array(N * 2), G: new Float32Array(N * 2), P: new Float32Array(N * 2), F: new Float32Array(N * 2) };
  const Pfrom = new Float32Array(N * 2);
  const lit = new Uint8Array(N), portionOf = new Uint16Array(N);
  const drawn = new Float32Array(N * 2), rest = new Float32Array(N * 2);
  const boxes = { M: null, Mc: null, F: null };
  let vw = 0, vh = 0, dpr = 1, dot = 1.2, area = null, labels = { X: [], G: [], P: [] };
  let discs = { G: [], P: [] }, portions = [], pace = 30, paceTween = 1, paceStart = 0;

  function place(target, box) {
    for (let i = 0; i < N; i++) {
      target[i * 2] = box.x + D.points[i * 2] / 4095 * box.s;
      target[i * 2 + 1] = box.y + D.points[i * 2 + 1] / 4095 * box.s;
    }
  }

  /* The crescent's full disc, in the master's own 0..1 frame: orbits turn around it, and the
     exploded view opens away from it. The hollow is where the app rests in the hero. */
  const DISC = { x: 0.525, y: 0.465, r: 0.385 };
  const HOLLOW = { x: 0.6, y: 0.41 };

  /* Astral layers, generated once. Atmosphere, not ayat: smaller, cooler, on their own paths. */
  /* The night keeps deepening down the page: the hero shows the first 240 stars and 300 motes;
     the rest come out as the reader goes on, so the sky is fullest at the close. */
  const STARS = 240, MOTES = 300;
  const stars = Array.from({ length: STARS + 220 }, () => ({ x: rand(), y: rand(), z: rand() < 0.7 ? 0 : 1, r: 0.35 + rand() * 0.9, a: 0.18 + rand() * 0.5, w: 0.4 + rand() * 1.4, p: rand() * 6.3 }));
  const ORBITS = [{ a: 0.6, b: 0.2 }, { a: 0.74, b: 0.25 }, { a: 0.9, b: 0.3 }];
  const TILT = -0.42;
  const motes = Array.from({ length: MOTES + 240 }, (_, k) => ({ o: k % 3, th: rand() * 6.283, w: (0.07 + rand() * 0.08) * (k % 3 === 1 ? -0.8 : 1), r: 0.5 + rand() * 0.9, a: 0.25 + rand() * 0.6 }));
  /* Falling stars: none in the hero, more often the deeper the reader goes. Atmosphere only. */
  const meteors = [];
  /* The sixteen lights: ayat about the moon and the narrations behind our name, spaced around
     the three orbits and turning more slowly than the motes. */
  const lights = (D.lights || []).map((l, k) => ({ ...l, o: k % 3, th: (k / (D.lights.length || 1)) * Math.PI * 2 * 2.3, w: 0.035 * (k % 3 === 1 ? -1 : 1) }));
  const lightPos = lights.map(() => ({ x: -999, y: -999, front: true }));

  let heroBox = null, cornerBox = null, copyRect = null, heroEnd = 0, placed = '';
  let finBox = null, closeRect = null, storyEndY = 0, finaleY = 1, placedF = '', depth = 0;
  const page = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height }; };
  const union = list => (list.length ? list.reduce((a, r) => {
    const x = Math.min(a.x, r.x), y = Math.min(a.y, r.y);
    return { x, y, w: Math.max(a.x + a.w, r.x + r.w) - x, h: Math.max(a.y + a.h, r.y + r.h) - y };
  }) : null);
  const lerpBox = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, s: a.s + (b.s - a.s) * k });

  function sunflower(target, i, n, total, cx, cy, r) {
    const f = Math.sqrt((n + 0.5) / total), a = n * 2.399963;
    target[i * 2] = cx + Math.cos(a) * r * f;
    target[i * 2 + 1] = cy + Math.sin(a) * r * f;
    return { u: Math.cos(a) * f, w: Math.sin(a) * f };
  }
  function grid(count) {
    const cols = count === 30 ? 6 : count === 60 ? 10 : 15, rows = Math.ceil(count / cols);
    const cell = Math.min(area.w / cols, (area.h * 0.92) / rows);
    const x0 = area.x + (area.w - cell * cols) / 2, y0 = area.y + (area.h - cell * rows) / 2;
    return k => {
      const r = Math.floor(k / cols), c = k % cols, col = rtl ? cols - 1 - c : c;
      return { x: x0 + (col + 0.5) * cell, y: y0 + (r + 0.5) * cell, cell };
    };
  }

  function planPace(days, animate) {
    if (animate) { Pfrom.set(K.P); paceTween = 0; paceStart = performance.now(); }
    pace = days;
    const k = days / 30;
    portions = [];
    for (let i = 0; i < N; i++) {
      const p = juzOf[i] * k + Math.min(k - 1, Math.floor(inJuz[i] * k / sizes[juzOf[i]]));
      portionOf[i] = p;
      if (!portions[p]) portions[p] = { first: i, n: 0 };
      portions[p].n++;
    }
    const at = grid(days), maxN = Math.max(...portions.map(p => p.n));
    discs.P = portions.map((p, k2) => { const c = at(k2); return { x: c.x, y: c.y, r: c.cell * 0.36 * Math.sqrt(p.n / maxN), cell: c.cell }; });
    const seen = new Uint16Array(days);
    for (let i = 0; i < N; i++) { const p = portionOf[i], d = discs.P[p]; sunflower(K.P, i, seen[p]++, portions[p].n, d.x, d.y, d.r); }
    const every = days === 30 ? 1 : 5;
    labels.P = discs.P.map((d, k2) => ({ x: d.x, y: d.y + d.cell * 0.44, text: digits.format(k2 + 1), j: k2, show: (k2 + 1) % every === 0 || k2 === 0 }));
    document.querySelectorAll('[data-khatm-days]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.khatmDays) === days)));
    const readout = document.querySelector('[data-khatm-readout]');
    if (readout) readout.textContent = fmt('khatmReadout', 'About {ayat} ayat a day, around {pages} pages', { ayat: digits.format(Math.round(N / days)), pages: digits.format(Math.round(604 / days)) });
    if (reduced.matches || !animate) paceTween = 1;
    request();
  }

  function layout() {
    vw = innerWidth; vh = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    const wide = vw >= 900;
    const captures = document.querySelector('.v-product-captures');
    /* The words themselves (on phones their wrapper has no box of its own). */
    copyRect = union([...document.querySelectorAll('.v-hero h1, .v-hero-lead, .v-hero-ayah')].map(page).filter(r => r.w && r.h));
    heroEnd = hero ? page(hero).y + page(hero).h : vh;
    /* The close: the whole moon comes back, centred on the last words, larger than it began. */
    /* Measure the words themselves, not their full-width blocks. */
    const inked = el => { const range = document.createRange(); range.selectNodeContents(el); const r = range.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height }; };
    closeRect = closing ? union([...closing.querySelectorAll('h2, .v-kicker, .v-play-badge, :scope > img')].map(inked).filter(r => r.w && r.h)) : null;
    if (closeRect) {
      const fs = wide ? Math.min(vh * 1.12, vw * 0.8, 1180) : Math.min(vw * 1.5, vh * 0.98);
      finBox = { x: closeRect.x + closeRect.w / 2 - DISC.x * fs, y: closeRect.y + closeRect.h / 2 - DISC.y * fs, s: fs };
    }
    storyEndY = nights ? page(nights).y + page(nights).h - vh * 0.5 : heroEnd;
    finaleY = closeRect ? closeRect.y - vh : document.documentElement.scrollHeight - vh;
    placedF = '';
    segments();
    let s;
    if (captures) {
      const c = page(captures);
      s = wide ? Math.min(vh * 1.12, 1100, c.h * 1.74) : Math.min(c.h * 1.75, vw * 1.35);
      /* Keep the crescent's back clear of the words beside it (in RTL its back faces away). */
      const beside = copyRect && (copyRect.y + copyRect.h > c.y + 40) && copyRect.x + copyRect.w <= c.x + 8;
      let x = c.x + c.w / 2 - HOLLOW.x * s + (rtl ? -0.04 : 0.04) * s;
      if (beside && !rtl) x = Math.max(x, copyRect.x + copyRect.w - (wide ? 0.12 : 0.26) * s);
      heroBox = { x, y: c.y + c.h / 2 - HOLLOW.y * s, s };
    } else {
      s = wide ? Math.min(vh * 1.1, 1100) : vw * 1.1;
      heroBox = { x: rtl ? -s * 0.08 : vw - s * 0.92, y: 40, s };
    }
    /* Past the hero it settles into the top corner and stays: a large background moon,
       never mirrored, on the product's side of the page. */
    cornerBox = { x: rtl ? -s * 0.3 : vw - s * 0.66, y: -s * 0.3, s };
    boxes.M = { ...heroBox };
    placed = '';
    dot = Math.max(0.95, Math.min(1.5, s / 640));

    /* The story's visual area: beside the text on wide screens, above it on phones. */
    area = { x: 14, y: 72, w: vw - 28, h: vh * 0.44 };
    if (wide) {
      const text = steps[0] ? steps[0].getBoundingClientRect() : { left: vw * 0.6, right: vw * 0.4 };
      const gap = Math.max(36, vw * 0.035), edge = Math.max(24, vw * 0.03);
      const x = rtl ? edge : Math.max(vw * 0.4, text.right + gap);
      const w = rtl ? Math.min(vw * 0.6, text.left - gap) - edge : vw - x - edge;
      area = { x, y: 96, w, h: vh - 150 };
    }
    const cs = Math.min(area.w, area.h) * 0.92;
    boxes.Mc = { x: area.x + (area.w - cs) / 2 + cs * 0.03, y: area.y + (area.h - cs) / 2, s: cs };
    place(K.Mc, boxes.Mc);

    /* The exploded moon: each juz is already a run of the crescent (ayat lie in reading order
       along it), so each slides a little away from the disc's centre along its own direction. */
    const ccx = boxes.Mc.x + DISC.x * cs, ccy = boxes.Mc.y + DISC.y * cs;
    const dirs = Array.from({ length: 30 }, () => ({ x: 0, y: 0 }));
    for (let i = 0; i < N; i++) { dirs[juzOf[i]].x += K.Mc[i * 2] - ccx; dirs[juzOf[i]].y += K.Mc[i * 2 + 1] - ccy; }
    const gap = cs * 0.075;
    labels.X = dirs.map((d, j) => {
      const len = Math.hypot(d.x, d.y) || 1; d.x /= len; d.y /= len;
      return { x: ccx + d.x * (DISC.r * cs + gap + 20), y: ccy + d.y * (DISC.r * cs + gap + 20), text: digits.format(j + 1), j, show: true };
    });
    for (let i = 0; i < N; i++) {
      const d = dirs[juzOf[i]], push = gap * (0.75 + 0.25 * ((juzOf[i] % 2)));
      K.X[i * 2] = K.Mc[i * 2] + d.x * push; K.X[i * 2 + 1] = K.Mc[i * 2 + 1] + d.y * push;
    }

    /* One Hijri month: thirty nights, each a moon made of that night's juz, lit for its night. */
    const at = grid(30);
    discs.G = sizes.map((n, j) => { const c = at(j); return { x: c.x, y: c.y, r: c.cell * 0.36 * Math.sqrt(n / maxJuz), cell: c.cell }; });
    labels.G = discs.G.map((d, j) => ({ x: d.x, y: d.y + d.cell * 0.44, text: digits.format(j + 1), j, show: true }));
    for (let i = 0; i < N; i++) {
      const j = juzOf[i], d = discs.G[j];
      const { u, w } = sunflower(K.G, i, inJuz[i], sizes[j], d.x, d.y, d.r);
      const p = (Math.PI * 2 * (j + 1)) / 30, edge = Math.sqrt(Math.max(0, 1 - w * w));
      lit[i] = (p <= Math.PI ? u > edge * Math.cos(p) : u < -edge * Math.cos(p)) ? 1 : 0;
    }
    planPace(pace, false);
    colours();
    if (selected >= 0) placeCard();
  }

  /* ------------------------------------------------- colour from theme */
  let gold = '#d4af37', goldLight = '#f5e6b3', muted = 'rgba(200,190,160,.6)', light = false;
  let goldRGB = [212, 175, 55], emeraldRGB = [30, 66, 53];
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const toRGB = colour => { if (!probe) return [0, 0, 0]; probe.clearRect(0, 0, 1, 1); probe.fillStyle = colour; probe.fillRect(0, 0, 1, 1); return [...probe.getImageData(0, 0, 1, 1).data].slice(0, 3); };
  function colours() {
    const style = getComputedStyle(root);
    const pick = name => style.getPropertyValue(name).trim();
    const bg = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g) || [0, 0, 0];
    light = (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) > 150;
    /* Restraint: the field is drawn in the theme's deep gold; only highlights take the pale gold. */
    gold = (light ? pick('--gold-dark') : pick('--gold')) || gold;
    goldLight = (light ? pick('--gold') : pick('--gold-light')) || goldLight;
    goldRGB = toRGB(gold);
    const e = toRGB(pick('--emerald') || '#132a22');
    emeraldRGB = e.map(c => Math.min(255, Math.round(c * 1.75 + 6)));
    muted = pick('--muted') || muted;
  }
  const rgba = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
  const motionToggle = document.querySelector('[data-motion-toggle]');
  function living() {
    return !reduced.matches && !document.hidden && motionToggle?.getAttribute('aria-pressed') !== 'true' && !navigator.connection?.saveData;
  }
  new MutationObserver(() => { colours(); request(); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------------------------------------------------- the timeline */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const ease = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  /* Four steps share the section equally; each change completes as its words arrive. */
  /* Each change belongs to its step (fractions of that step's own scroll). The swirl out of
     the hero has the tallest step and three quarters of it: it should be watched, not missed. */
  const STEP_SEGMENTS = [[[0, 0.6, 'M', 'Mc'], [0.6, 1, 'Mc', 'Mc']],
                         [[0, 0.48, 'Mc', 'X'], [0.48, 1, 'X', 'X']],
                         [[0, 0.48, 'X', 'G'], [0.48, 1, 'G', 'G']],
                         [[0, 0.2, 'G', 'P'], [0.2, 0.7, 'P', 'P'], [0.7, 1, 'P', 'M']]];
  let bounds = [0, 0.25, 0.5, 0.75, 1];
  let SEGMENTS = [];
  function segments() {
    if (nights && steps.length === 4) {
      const top = page(nights).y, h = page(nights).h || 1;
      bounds = steps.map(st => clamp((page(st).y - top) / h)).concat(1);
      bounds[0] = 0;
    }
    SEGMENTS = STEP_SEGMENTS.flatMap((list, k) => list.map(([a, b, from, to]) => [bounds[k] + (bounds[k + 1] - bounds[k]) * a, bounds[k] + (bounds[k + 1] - bounds[k]) * b, from, to]));
  }
  function rawStory() {
    if (!nights) return -1;
    const r = nights.getBoundingClientRect();
    return Math.min(1.08, Math.max(-0.08, (vh * 0.5 - r.top) / r.height));
  }
  /* Scroll sets where the story should be; the moon glides there (a time constant, not a
     jump), so a fast wheel or flick still reads as one smooth movement. Big jumps from links
     land at once. Reduced motion follows scroll directly. */
  const glide = { p: null, f: null, t: 0 };
  const follow = (key, target, now) => {
    const dt = glide.t ? Math.min(0.1, (now - glide.t) / 1000) : 0;
    if (glide[key] === null || reduced.matches || Math.abs(target - glide[key]) > 0.3) glide[key] = target;
    else glide[key] += (target - glide[key]) * (1 - Math.exp(-dt / 0.4));
    if (Math.abs(target - glide[key]) < 0.0004) glide[key] = target;
    return glide[key];
  };
  let gliding = false;
  function story() {
    const now = performance.now(), raw = rawStory();
    const p = follow('p', raw, now);
    gliding = Math.abs(raw - p) > 0.0004;
    const v = p < -0.002 ? -1 : p > 1.002 ? 2 : clamp(p);
    return v;
  }
  let heroF = 0;
  function state() {
    const p = story();
    const f = ease(clamp(scrollY / Math.max(heroEnd * 0.75, 1)));
    const from = { x: heroBox.x, y: heroBox.y - scrollY, s: heroBox.s };
    const box = { x: from.x + (cornerBox.x - from.x) * f, y: from.y + (cornerBox.y - from.y) * f, s: from.s + (cornerBox.s - from.s) * f };
    const key = box.x.toFixed(1) + box.y.toFixed(1) + box.s.toFixed(1);
    if (key !== placed) { boxes.M = box; place(K.M, box); placed = key; }
    heroF = f;
    /* Depth: how far past the story the reader has come, 0 there and 1 at the close. */
    depth = p > 1 ? clamp((scrollY - storyEndY) / Math.max(1, finaleY - storyEndY)) : 0;
    const faded = 0.3 + 0.14 * depth, fromHero = 1 - (1 - 0.3) * f;
    if (p > 1 && finBox) {
      const fbox = { x: finBox.x, y: finBox.y - scrollY, s: finBox.s };
      const fkey = fbox.x.toFixed(1) + fbox.y.toFixed(1) + fbox.s.toFixed(1);
      if (fkey !== placedF) { boxes.F = fbox; place(K.F, fbox); placedF = fkey; }
      /* Forms from when the closing words enter until they sit high on the screen, or until the
         page can scroll no further: tall screens (a phone in desktop mode) still see it complete. */
      const maxY = document.documentElement.scrollHeight - vh;
      const fEnd = Math.min(closeRect.y - vh * 0.22, maxY - 2), fStart = Math.min(closeRect.y - vh, fEnd - vh * 0.25);
      const fr = clamp((scrollY - fStart) / (fEnd - fStart));
      let u = follow('f', fr, performance.now());
      if (Math.abs(fr - u) > 0.0004) gliding = true;
      if (reduced.matches) u = u < 0.5 ? 0 : 1;
      if (u >= 1) return { a: 'F', b: 'F', u: 0, alpha: 1, p };
      if (u > 0) return { a: 'M', b: 'F', u, alpha: faded + (1 - faded) * ease(u), p };
    }
    if (p < 0 || p > 1) return { a: 'M', b: 'M', u: 0, alpha: p < 0 ? fromHero : faded, p };
    for (const [s0, s1, a, b] of SEGMENTS) {
      if (p <= s1) {
        let u = clamp((p - s0) / (s1 - s0));
        if (reduced.matches) u = u < 0.5 ? 0 : 1;
        const alpha = a === 'M' ? faded + (1 - faded) * ease(u) : b === 'M' ? 1 - (1 - faded) * ease(u) : 1;
        return { a, b, u, alpha, p };
      }
    }
    return { a: 'M', b: 'M', u: 0, alpha: faded, p };
  }
  const weightOf = (s, key) => (s.a === key ? 1 - s.u : 0) + (s.b === key ? s.u : 0);

  /* ------------------------------------------------------- sky layers */
  function drawSky(s, now, live) {
    const mW = weightOf(s, 'M'), mcW = weightOf(s, 'Mc'), xW = weightOf(s, 'X'), fW = weightOf(s, 'F');
    /* Between the corner and the close the moon's own light travels with it. */
    const box = fW > 0 && mW > 0 ? lerpBox(boxes.M, boxes.F, ease(fW)) : fW > 0 ? boxes.F : mcW + xW > mW ? boxes.Mc : boxes.M;
    const presence = Math.max(mW * s.alpha, mcW + xW * 0.6, fW * s.alpha);
    /* Past the hero the night itself keeps deepening, whatever the moon is doing. */
    const night = s.p > 1 ? 0.45 + 0.55 * Math.max(depth, fW) : 0;
    const skyP = Math.max(presence, night);
    if (skyP < 0.02) return null;
    const cx = box.x + box.s * DISC.x, cy = box.y + box.s * DISC.y;
    if (!light) {
      /* Emerald depth: the brand's glass, lifting the night from flat black. */
      const r = box.s * 1.15;
      const g = ctx.createRadialGradient(cx, cy, box.s * 0.05, cx, cy, r);
      g.addColorStop(0, rgba(emeraldRGB, 0.5)); g.addColorStop(0.45, rgba(emeraldRGB, 0.2)); g.addColorStop(1, rgba(emeraldRGB, 0));
      ctx.globalAlpha = Math.max(presence, night * 0.8); ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      const deep = ctx.createRadialGradient(vw * (rtl ? 0.9 : 0.08), vh * 1.05, 0, vw * (rtl ? 0.9 : 0.08), vh * 1.05, vw * 0.7);
      deep.addColorStop(0, 'rgba(22,34,58,.38)'); deep.addColorStop(1, 'rgba(22,34,58,0)');
      ctx.globalAlpha = skyP * 0.9; ctx.fillStyle = deep; ctx.fillRect(0, 0, vw, vh);
      ctx.fillStyle = '#f4ecd6';
      const count = STARS + Math.round((stars.length - STARS) * Math.max(depth, fW));
      const sparkle = 0.35 + 0.2 * depth;
      for (let k = 0; k < count; k++) {
        const st = stars[k];
        const y = ((st.y * vh * 1.6 - scrollY * (st.z ? 0.16 : 0.05)) % (vh * 1.6) + vh * 1.6) % (vh * 1.6) - vh * 0.3;
        const tw = live ? 1 - sparkle + sparkle * Math.sin(now / 1000 * st.w + st.p) : 0.85;
        ctx.globalAlpha = st.a * tw * skyP * (st.z ? 1 : 0.6) * (k < STARS ? 1 : clamp((count - k) / 24));
        ctx.fillRect(st.x * vw, y, st.r * (st.z ? 1.3 : 1), st.r * (st.z ? 1.3 : 1));
      }
      drawMeteors(now, live, Math.max(depth, fW) * (s.p > 1 ? 1 : 0));
    }
    /* Halo: restrained bloom, so the moon glows rather than glares. */
    const hr = box.s * 0.6;
    const halo = ctx.createRadialGradient(cx - box.s * 0.05, cy, 0, cx - box.s * 0.05, cy, hr);
    halo.addColorStop(0, rgba(goldRGB, light ? 0.07 : 0.085 + 0.04 * fW)); halo.addColorStop(0.5, rgba(goldRGB, 0.03)); halo.addColorStop(1, rgba(goldRGB, 0));
    ctx.globalAlpha = presence * ease(clamp(intro * 1.4 - 0.2)); ctx.fillStyle = halo; ctx.fillRect(cx - hr, cy - hr, hr * 2, hr * 2);
    return { cx, cy, box, presence: Math.max(presence * (1 - xW * 0.5), night * 0.55), more: Math.max(depth, fW) };
  }
  /* A falling star: a short streak toward the reading side, quick and rare, then gone. */
  let meteorClock = 0;
  function drawMeteors(now, live, deepness) {
    if (live && deepness > 0.12) {
      const dt = meteorClock ? Math.min(0.1, (now - meteorClock) / 1000) : 0;
      if (Math.random() < dt * (0.04 + 0.3 * deepness * deepness) && meteors.length < 3) {
        const dir = rtl ? 1 : -1, ang = 0.42 + Math.random() * 0.3;
        meteors.push({ x: vw * (0.15 + Math.random() * 0.8), y: vh * Math.random() * 0.45, dx: dir * Math.cos(ang), dy: Math.sin(ang),
          len: 70 + Math.random() * 110, speed: 380 + Math.random() * 320, born: now, life: 800 + Math.random() * 600 });
      }
    }
    meteorClock = now;
    ctx.lineCap = 'round';
    for (let k = meteors.length - 1; k >= 0; k--) {
      const m = meteors[k], age = (now - m.born) / m.life;
      if (age >= 1 || !live) { meteors.splice(k, 1); continue; }
      const travel = (now - m.born) / 1000 * m.speed;
      const hx = m.x + m.dx * travel, hy = m.y + m.dy * travel;
      const tail = m.len * Math.min(1, age * 3);
      const g = ctx.createLinearGradient(hx, hy, hx - m.dx * tail, hy - m.dy * tail);
      g.addColorStop(0, 'rgba(255,246,220,.9)'); g.addColorStop(1, 'rgba(255,246,220,0)');
      ctx.globalAlpha = Math.sin(Math.PI * age) * 0.8; ctx.strokeStyle = g; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - m.dx * tail, hy - m.dy * tail); ctx.stroke();
    }
  }
  /* Orbits around the moon's disc; the half behind the moon is drawn before it. */
  const orbitPoint = (sky, o, th) => {
    const c = Math.cos(TILT), si = Math.sin(TILT), k = sky.box.s;
    const ex = Math.cos(th) * ORBITS[o].a * k, ey = Math.sin(th) * ORBITS[o].b * k;
    return { x: sky.cx + ex * c - ey * si, y: sky.cy + ex * si + ey * c, front: Math.sin(th) > 0, depth: Math.sin(th) };
  };
  function drawOrbits(sky, time, front) {
    if (!sky) return;
    const { cx, cy, box, presence } = sky;
    const show = ease(clamp(intro * 1.3 - 0.3));
    if (!front) {
      ctx.lineWidth = 0.8; ctx.strokeStyle = rgba(goldRGB, 1);
      ORBITS.forEach((o, n) => {
        ctx.globalAlpha = presence * (0.13 - n * 0.025) * show;
        ctx.beginPath(); ctx.ellipse(cx, cy, o.a * box.s, o.b * box.s, TILT, 0, Math.PI * 2); ctx.stroke();
      });
    }
    ctx.fillStyle = light ? gold : '#efe3bf';
    const moteCount = MOTES + Math.round((motes.length - MOTES) * (sky.more || 0));
    for (let k = 0; k < moteCount; k++) {
      const m = motes[k];
      const p = orbitPoint(sky, m.o, m.th + time * m.w);
      if (p.front !== front) continue;
      const depth = front ? 0.55 + p.depth * 0.45 : 0.25 + (1 + p.depth) * 0.2;
      ctx.globalAlpha = presence * m.a * depth * show;
      const r = m.r * (front ? 1 + p.depth * 0.5 : 0.8);
      ctx.fillRect(p.x - r / 2, p.y - r / 2, r, r);
    }
    /* The lights: larger, glowing, each carrying an ayah or a narration. */
    lights.forEach((l, k) => {
      const p = orbitPoint(sky, l.o, l.th + time * l.w);
      if (p.front !== front) return;
      lightPos[k] = { x: p.x, y: p.y, front: p.front };
      const on = hoverLight === k || openLight === k;
      const size = (front ? 2.4 + p.depth : 1.7) * (on ? 1.6 : 1);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 5);
      g.addColorStop(0, rgba(goldRGB, 0.5)); g.addColorStop(1, rgba(goldRGB, 0));
      ctx.globalAlpha = presence * show * (front ? 1 : 0.5); ctx.fillStyle = g; ctx.fillRect(p.x - size * 5, p.y - size * 5, size * 10, size * 10);
      ctx.fillStyle = l.kind === 'hadith' ? '#fff6dc' : goldLight;
      ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
      if (on) { ctx.strokeStyle = goldLight; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, size + 5, 0, Math.PI * 2); ctx.stroke(); }
    });
  }

  /* --------------------------------------------------------- drawing */
  let intro = reduced.matches ? 1 : 0, introStart = 0, hoverIndex = -1, hoverGroup = -1, hoverLight = -1, openLight = -1, current = null;
  let selected = -1, orbitTime = 0, lastNow = 0, wavePhase = 0;
  const mag = { x: -999, y: -999, tx: -999, ty: -999, s: 0, ts: 0 };
  function draw(now) {
    frame = 0;
    if (intro < 1) { if (!introStart) introStart = now; intro = clamp((now - introStart) / 2600); }
    const s = state();
    current = s;
    const live = living();
    /* Orbit time only advances while alive, so the sky never jumps when motion resumes. */
    const dt = live && lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0;
    orbitTime += dt * (1 + 0.6 * depth);
    wavePhase = (wavePhase + dt / (26 - 9 * depth)) % 1.12;
    lastNow = now;
    if (paceTween < 1) paceTween = reduced.matches ? 1 : clamp((now - paceStart) / 900);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    const A = s.a === 'P' && paceTween < 1 ? null : K[s.a], B = K[s.b];
    const moving = s.a !== s.b;
    const mW = weightOf(s, 'M'), xW = weightOf(s, 'X'), gW = weightOf(s, 'G'), pW = weightOf(s, 'P'), fW = weightOf(s, 'F');
    const settledMoon = !moving && (s.a === 'M' || s.a === 'Mc' || s.a === 'F') && intro >= 1;

    const skyLayer = drawSky(s, now, live);
    drawOrbits(skyLayer, orbitTime, false);

    const words = copyRect && heroF < 0.6 && mW > 0.5 ? { r: copyRect, y: scrollY } : closeRect && fW > 0.5 ? { r: closeRect, y: scrollY } : null;
    if (art.complete && art.naturalWidth && mW + fW > 0.01) {
      const box = fW > 0 && mW > 0 ? lerpBox(boxes.M, boxes.F, ease(fW)) : fW > 0 ? boxes.F : boxes.M;
      ctx.save();
      if (words) {
        /* The artwork steps back behind the words; the sky around them stays whole. */
        ctx.beginPath(); ctx.rect(0, 0, vw, vh);
        ctx.rect(words.r.x - 24, words.r.y - words.y - 24, words.r.w + 48, words.r.h + 48);
        ctx.clip('evenodd');
      }
      ctx.globalAlpha = (light ? 0.34 : 0.24) * (mW + fW) * s.alpha * ease(clamp((intro - 0.45) / 0.55)) * (moving ? 1 - Math.sin(Math.PI * s.u) : 1);
      ctx.drawImage(art, box.x, box.y, box.s, box.s);
      ctx.restore();
    }

    const veil = words ? { l: words.r.x - 24, r: words.r.x + words.r.w + 24, t: words.r.y - words.y - 24, b: words.r.y - words.y + words.r.h + 24 } : null;
    const tiers = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    const dim = new Path2D(), focus = new Path2D(), glow = new Path2D(), bloom = new Path2D();
    const wave = live && settledMoon ? wavePhase - 0.06 : -1;
    const planning = s.a === 'P' || s.b === 'P';
    const groupOf = i => (planning ? portionOf[i] : juzOf[i]);
    const grouped = moving && s.a !== 'M' && s.a !== 'Mc';
    const hoverSurah = hoverIndex >= 0 && (settledMoon || (!moving && s.a === 'X')) ? surahOf[hoverIndex] : -1;
    const selSurah = selected >= 0 && settledMoon ? surahOf[selected] : -1;
    const groupFocus = hoverGroup >= 0 && !moving && (s.a === 'G' || s.a === 'P' || s.a === 'X');
    const magOn = settledMoon && mag.s > 0.01;
    const R = Math.max(70, (boxes.M ? boxes.M.s : 600) * 0.09);
    const half = dot / 2;
    const pe = ease(paceTween);
    const swirl = moving && ['M', 'Mc', 'F'].includes(s.a) && ['M', 'Mc', 'F'].includes(s.b);
    const trails = new Path2D();
    for (let i = 0; i < N; i++) {
      let x, y;
      const ax = A ? A[i * 2] : Pfrom[i * 2] + (K.P[i * 2] - Pfrom[i * 2]) * pe;
      const ay = A ? A[i * 2 + 1] : Pfrom[i * 2 + 1] + (K.P[i * 2 + 1] - Pfrom[i * 2 + 1]) * pe;
      if (swirl) {
        /* The moon swims between its places: it loosens into a slow spiral around its own
           disc, outer filigree swinging wider than inner, and gathers again where it lands. */
        const u = ease(clamp((s.u * 1.45) - (i / N) * 0.45));
        const bA = boxes[s.a], bB = boxes[s.b];
        const ca = { x: bA.x + DISC.x * bA.s, y: bA.y + DISC.y * bA.s }, cb = { x: bB.x + DISC.x * bB.s, y: bB.y + DISC.y * bB.s };
        const ox = A[i * 2] - ca.x, oy = A[i * 2 + 1] - ca.y, tx = B[i * 2] - cb.x, ty = B[i * 2 + 1] - cb.y;
        const at = k => {
          const w = Math.sin(Math.PI * k);
          const rn = Math.min(1.2, Math.hypot(ox, oy) / (DISC.r * bA.s));
          const th = (s.a === 'M' ? 1 : -1) * 1.9 * w * (0.45 + rn * 0.75);
          const bloom = 1 + w * (0.28 + seedA[i] * 0.3);
          const px = (ox + (tx - ox) * k) * bloom, py = (oy + (ty - oy) * k) * bloom;
          const c = Math.cos(th), sn = Math.sin(th);
          return [ca.x + (cb.x - ca.x) * k + px * c - py * sn, ca.y + (cb.y - ca.y) * k + px * sn + py * c];
        };
        [x, y] = at(u);
        /* A short trail of light behind each moving ayah. */
        if (u > 0.02 && u < 0.98 && (i & 1) === 0) { const [qx, qy] = at(Math.max(0, u - 0.06)); trails.moveTo(qx, qy); trails.lineTo(x, y); }
      } else if (moving) {
        /* Curved, choreographed flight: ayat unwind in reading order; between the later
           arrangements each group (juz or day) arcs together on its own side. */
        const order = grouped ? (groupOf(i) / (planning ? pace : 30)) * 0.9 + seedB[i] * 0.1 : i / N;
        const u = ease(clamp((s.u * 1.6) - order * 0.6));
        let bx = B[i * 2], by = B[i * 2 + 1];
        if (s.b === 'P' && paceTween < 1) { bx = Pfrom[i * 2] + (K.P[i * 2] - Pfrom[i * 2]) * pe; by = Pfrom[i * 2 + 1] + (K.P[i * 2 + 1] - Pfrom[i * 2 + 1]) * pe; }
        const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
        const bend = (grouped ? ((groupOf(i) * 0.618) % 1) - 0.5 : seedA[i] - 0.5) * Math.min(len * 0.45, vh * 0.35);
        const mx = (ax + bx) / 2 - (dy / len) * bend, my = (ay + by) / 2 + (dx / len) * bend;
        const iu = 1 - u;
        x = iu * iu * ax + 2 * iu * u * mx + u * u * bx;
        y = iu * iu * ay + 2 * iu * u * my + u * u * by;
      } else if (s.a === 'P' && paceTween < 1) {
        /* A new pace: each ayah glides to its new day along a gentle arc, in reading order. */
        const u = ease(clamp(paceTween * 1.5 - (i / N) * 0.5));
        const fx = Pfrom[i * 2], fy = Pfrom[i * 2 + 1], tx = K.P[i * 2], ty = K.P[i * 2 + 1];
        x = fx + (tx - fx) * u; y = fy + (ty - fy) * u - Math.sin(Math.PI * u) * 18;
      } else { x = ax; y = ay; }
      if (intro < 1) {
        const k = ease(clamp(intro * 1.5 - seedB[i] * 0.5));
        const sx = boxes.M.x + boxes.M.s * (0.5 + (seedA[i] - 0.5) * 1.7), sy = boxes.M.y + boxes.M.s * (0.5 + (seedB[i] - 0.5) * 1.7);
        x = sx + (x - sx) * k; y = sy + (y - sy) * k;
      }
      rest[i * 2] = x; rest[i * 2 + 1] = y;
      let pushed = 0;
      if (magOn && i !== hoverIndex && i !== selected) {
        const dx = x - mag.x, dy = y - mag.y, d = Math.hypot(dx, dy);
        if (d < R && d > 0.01) { pushed = (1 - d / R) * (1 - d / R) * mag.s; x += (dx / d) * pushed * 18; y += (dy / d) * pushed * 18; }
      }
      drawn[i * 2] = x; drawn[i * 2 + 1] = y;
      const inVeil = veil && x > veil.l && x < veil.r && y > veil.t && y < veil.b;
      if ((groupFocus && groupOf(i) === hoverGroup) || (!inVeil && (surahOf[i] === hoverSurah || surahOf[i] === selSurah))) {
        const d = dot * 1.25; focus.rect(x - d / 2, y - d / 2, d, d); continue;
      }
      if ((gW > 0.5 && !lit[i]) || inVeil) { dim.rect(x - half, y - half, dot, dot); continue; }
      const near = wave >= 0 ? Math.abs(i / N - wave) : 1;
      if (near < 0.016 || pushed > 0.2) {
        const g = dot * (1.2 + Math.max(0.016 - near, 0) * 34 + pushed * 0.8);
        glow.rect(x - g / 2, y - g / 2, g, g); bloom.rect(x - g * 1.5, y - g * 1.5, g * 3, g * 3);
        continue;
      }
      const tier = seedA[i] < 0.4 ? 0 : seedA[i] < 0.75 ? 1 : seedA[i] < 0.95 ? 2 : 3;
      const d = tier === 3 ? dot * 1.35 : dot;
      tiers[tier].rect(x - d / 2, y - d / 2, d, d);
    }
    const fade = groupFocus || hoverSurah >= 0 || selSurah >= 0 ? 0.55 : 1;
    if (swirl) {
      ctx.strokeStyle = gold; ctx.lineWidth = Math.max(0.6, dot * 0.6); ctx.lineCap = 'round';
      if (!light) ctx.globalCompositeOperation = 'lighter';
      if (s.b !== 'F') { ctx.globalAlpha = s.alpha * 0.22 * Math.sin(Math.PI * s.u); ctx.stroke(trails); }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = gold;
    ctx.globalAlpha = s.alpha * 0.2 * fade; ctx.fill(dim);
    [0.34, 0.52, 0.72].forEach((a, n) => { ctx.globalAlpha = s.alpha * a * fade; ctx.fill(tiers[n]); });
    ctx.fillStyle = goldLight;
    ctx.globalAlpha = s.alpha * 0.85 * fade; ctx.fill(tiers[3]);
    if (!light) ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = s.alpha * 0.12; ctx.fill(bloom);
    ctx.globalAlpha = s.alpha * 0.95; ctx.fill(glow);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = Math.min(1, s.alpha * 1.1); ctx.fill(focus);
    drawOrbits(skyLayer, orbitTime, true);

    /* Each night's moon carries its own faint light, in proportion to how lit it is. */
    if (gW > 0.05) {
      discs.G.forEach((d, j) => {
        const lightness = (1 - Math.cos((Math.PI * 2 * (j + 1)) / 30)) / 2;
        const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 2.4);
        g.addColorStop(0, rgba(goldRGB, 0.2 * lightness)); g.addColorStop(1, rgba(goldRGB, 0));
        ctx.globalAlpha = gW * s.alpha; ctx.fillStyle = g;
        ctx.fillRect(d.x - d.r * 2.4, d.y - d.r * 2.4, d.r * 4.8, d.r * 4.8);
      });
    }
    /* The pointed ayah, and the open one tethered to its card. */
    ctx.strokeStyle = goldLight; ctx.lineWidth = 1;
    if (hoverIndex >= 0 && !moving && hoverIndex !== selected && (s.a === 'M' || s.a === 'Mc' || s.a === 'X')) {
      ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(drawn[hoverIndex * 2], drawn[hoverIndex * 2 + 1], dot * 3.4, 0, Math.PI * 2); ctx.stroke();
    }
    if (!card.hidden && (selected >= 0 || openLight >= 0)) {
      const from = selected >= 0 ? { x: drawn[selected * 2], y: drawn[selected * 2 + 1] } : lightPos[openLight];
      if (selected >= 0) {
        ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(from.x, from.y, dot * 4.2, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(from.x, from.y, dot * 8, 0, Math.PI * 2); ctx.stroke();
      }
      const r = card.getBoundingClientRect();
      const ex = Math.min(Math.max(from.x, r.left), r.right), ey = Math.min(Math.max(from.y, r.top), r.bottom);
      if (ex !== from.x || ey !== from.y) {
        ctx.globalAlpha = 0.5; ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
      }
    }

    /* Juz, night and day numbers, only while their arrangement is settled. */
    ctx.font = '600 10px Jakarta, Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = muted;
    const thin = vw < 700;
    for (const [list, weight] of [[labels.X, xW], [labels.G, gW], [labels.P, pW]]) {
      if (weight < 0.05) continue;
      for (const l of list) {
        if (!l.show || (thin && list !== labels.P && (l.j + 1) % 5 && l.j !== 0)) continue;
        ctx.globalAlpha = weight * (hoverGroup === l.j ? 1 : 0.7);
        ctx.fillText(l.text, l.x, l.y);
      }
    }
    ctx.globalAlpha = 1;

    if (steps.length) {
      const active = s.p < 0 || s.p > 1 ? -1 : s.p < bounds[1] ? 0 : s.p < bounds[2] ? 1 : s.p < bounds[3] ? 2 : 3;
      steps.forEach((step, i) => step.classList.toggle('is-active', i === active));
    }
    mag.s += (mag.ts - mag.s) * 0.16;
    mag.x += (mag.tx - mag.x) * 0.4; mag.y += (mag.ty - mag.y) * 0.4;
    const settling = Math.abs(mag.ts - mag.s) > 0.01 || paceTween < 1 || gliding;
    glide.t = now;
    /* The sky never stops: it keeps turning to the last section (only motion settings, a
       hidden tab or Save-Data rest it). */
    const ambient = live && skyLayer;
    if (intro < 1 || settling || meteors.length) request();
    else if (ambient || wave >= 0) { clearTimeout(lightTimer); lightTimer = setTimeout(request, vw < 700 ? 42 : 33); }
    if (!card.hidden && selected >= 0 && moving) closeCard(false);
  }
  let lightTimer = 0, frame = 0;
  function request() { if (!frame) frame = requestAnimationFrame(draw); }

  /* ---------------------------------------------- reading an ayah or a narration */
  const card = document.createElement('div');
  card.className = 'v-verse-card';
  card.setAttribute('role', 'dialog');
  card.hidden = true;
  card.innerHTML = '<div class="v-verse-top"><p class="v-tiny" data-verse-ref></p><button type="button" class="v-verse-close" data-verse-close></button></div>' +
    '<p class="v-verse-basmala" lang="ar" dir="rtl" data-verse-basmala hidden></p>' +
    '<p class="v-arabic" lang="ar" dir="rtl" data-verse-arabic></p>' +
    '<p class="v-translation" data-verse-translation></p>' +
    '<p class="v-translation-source" data-verse-source></p>' +
    '<div class="v-verse-nav" data-verse-nav><button type="button" data-verse-prev></button><span class="v-caption" data-verse-pos></span><button type="button" data-verse-next></button></div>' +
    '<a class="v-link" data-verse-link></a>';
  document.body.append(card);
  const $c = sel => card.querySelector(sel);
  const PLAY = 'https://play.google.com/store/apps/details?id=com.ummahti.quran';
  $c('[data-verse-close]').setAttribute('aria-label', t('verseClose', 'Close'));
  $c('[data-verse-close]').textContent = '×';
  $c('[data-verse-prev]').setAttribute('aria-label', t('versePrev', 'Previous verse'));
  $c('[data-verse-next]').setAttribute('aria-label', t('verseNext', 'Next verse'));
  $c('[data-verse-prev]').textContent = rtl ? '→' : '←';
  $c('[data-verse-next]').textContent = rtl ? '←' : '→';
  const loading = {};
  function surahText(s) {
    const n = s + 1;
    if (window.UMMAHTI_AYAT && window.UMMAHTI_AYAT[n]) return Promise.resolve(window.UMMAHTI_AYAT[n]);
    if (!loading[n]) loading[n] = new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = '/media/v15/quran/s' + String(n).padStart(3, '0') + '.js?v=' + VERSION;
      tag.onload = () => (window.UMMAHTI_AYAT && window.UMMAHTI_AYAT[n] ? resolve(window.UMMAHTI_AYAT[n]) : reject());
      tag.onerror = () => { delete loading[n]; reject(); };
      document.head.append(tag);
    });
    return loading[n];
  }
  let anchor = null, origin = null;
  function placeCard() {
    if (card.hidden) return;
    const from = selected >= 0 ? { x: drawn[selected * 2], y: drawn[selected * 2 + 1] } : origin || { x: vw / 2, y: vh / 2 };
    if (vw < 700) { card.classList.add('is-sheet'); card.style.transform = ''; return; }
    card.classList.remove('is-sheet');
    const w = card.offsetWidth || 360, h = card.offsetHeight || 280;
    let cx = from.x < vw * 0.55 ? from.x + 46 : from.x - 46 - w;
    cx = Math.min(Math.max(cx, 16), vw - w - 16);
    const cy = Math.min(Math.max(from.y - h * 0.35, 90), vh - h - 16);
    card.style.transform = `translate(${cx}px, ${cy}px)`;
  }
  function fillAyah(index) {
    const s = surahOf[index], a = ayahOf[index];
    card.classList.remove('is-narration');
    $c('[data-verse-ref]').textContent = ref(index);
    $c('[data-verse-pos]').textContent = fmt('moonVerseOf', 'Ayah {n} of 6,236', { n: digits.format(index + 1) });
    $c('[data-verse-nav]').hidden = false;
    card.setAttribute('aria-label', ref(index));
    const basmala = $c('[data-verse-basmala]');
    basmala.hidden = !(a === 1 && s !== 0 && s !== 8);
    basmala.textContent = basmala.hidden ? '' : D.basmala;
    const arabic = $c('[data-verse-arabic]'), english = $c('[data-verse-translation]');
    arabic.hidden = false;
    english.lang = 'en'; english.dir = 'ltr';
    $c('[data-verse-source]').textContent = 'Saheeh International';
    const link = $c('[data-verse-link]');
    link.href = PLAY; link.textContent = t('verseReadOn', 'Read on in Ummahti Quran') + ' ↗';
    card.classList.add('is-loading');
    surahText(s).then(ayat => {
      if (selected !== index) return;
      arabic.textContent = ayat[a - 1][0];
      english.textContent = ayat[a - 1][1];
      card.classList.remove('is-loading', 'is-failed');
      placeCard(); request();
    }, () => {
      if (selected !== index) return;
      arabic.textContent = '';
      english.textContent = t('verseFailed', 'This verse could not load. Check your connection and try again.');
      card.classList.remove('is-loading'); card.classList.add('is-failed');
    });
  }
  function fillNarration(l) {
    card.classList.add('is-narration'); card.classList.remove('is-loading', 'is-failed');
    $c('[data-verse-ref]').textContent = l.collection + ' ' + l.reference + ' · ' + l.grade;
    $c('[data-verse-nav]').hidden = true;
    $c('[data-verse-basmala]').hidden = true;
    $c('[data-verse-arabic]').hidden = true;
    const text = l.text[lang] || l.text.en, english = $c('[data-verse-translation]');
    english.textContent = text;
    english.lang = l.text[lang] ? lang : 'en';
    english.dir = (l.text[lang] && (lang === 'ar' || lang === 'ur')) ? 'rtl' : 'ltr';
    $c('[data-verse-source]').textContent = l.summary ? t('narrationSummary', "Ummahti's summary of the narration's ruling, checked against the collection.") : t('narrationMeaning', "The meaning in Ummahti's words, checked against the collection.");
    const link = $c('[data-verse-link]');
    link.href = l.url; link.textContent = t('narrationRead', 'Read the narration on sunnah.com') + ' ↗';
    card.setAttribute('aria-label', l.collection + ' ' + l.reference);
  }
  function reveal(fromX, fromY, wasOpen) {
    placeCard();
    if (!wasOpen) {
      if (!reduced.matches && card.animate) {
        const r = card.getBoundingClientRect();
        card.style.transformOrigin = `${fromX - r.left}px ${fromY - r.top}px`;
        card.animate([{ opacity: 0, scale: 0.86, filter: 'blur(4px)' }, { opacity: 1, scale: 1, filter: 'blur(0)' }], { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' });
      }
      $c('[data-verse-close]').focus({ preventScroll: true });
    }
    request();
  }
  function openCard(index, fromX, fromY) {
    const wasOpen = !card.hidden;
    selected = index; openLight = -1; anchor = scrollY; tip.hidden = true;
    card.hidden = false;
    fillAyah(index);
    reveal(fromX, fromY, wasOpen);
  }
  function openLightCard(k) {
    const l = lights[k];
    if (l.kind === 'ayah') { openCard(l.i, lightPos[k].x, lightPos[k].y); openLight = k; return; }
    const wasOpen = !card.hidden;
    selected = -1; openLight = k; anchor = scrollY; tip.hidden = true; origin = { ...lightPos[k] };
    card.hidden = false;
    fillNarration(l);
    reveal(lightPos[k].x, lightPos[k].y, wasOpen);
  }
  function closeCard(restore = true) {
    if (card.hidden) return;
    const done = () => { card.hidden = true; selected = -1; openLight = -1; request(); };
    if (!reduced.matches && card.animate && restore) card.animate([{ opacity: 1 }, { opacity: 0, scale: 0.94 }], { duration: 160, easing: 'ease-in' }).onfinish = done;
    else done();
  }
  const step = by => { if (selected < 0) return; const x = drawn[selected * 2], y = drawn[selected * 2 + 1]; openCard((selected + by + N) % N, x, y); };
  $c('[data-verse-close]').addEventListener('click', () => closeCard());
  $c('[data-verse-prev]').addEventListener('click', () => step(-1));
  $c('[data-verse-next]').addEventListener('click', () => step(1));
  card.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); closeCard(); }
    if (event.key === 'ArrowRight' && !event.target.closest('a')) { event.preventDefault(); step(rtl ? -1 : 1); }
    if (event.key === 'ArrowLeft' && !event.target.closest('a')) { event.preventDefault(); step(rtl ? 1 : -1); }
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !card.hidden) closeCard(); });

  /* ---------------------------------------------- pointing */
  /* Only real controls, the phone screenshots (which hide the moon behind them), the headline
     and the open card stop the moon from answering the pointer. */
  const ignore = 'a,button,input,select,textarea,summary,label,dialog,.v-popover,.v-verse-card,.v-header,.v-product-front,.v-product-back,.v-hero h1,.v-hero-lead,.v-hero-ayah,.v-night-step p,.v-night-step h2,.v-close h2,.v-close .v-kicker';
  function nearest(x, y, radius) {
    let best = radius * radius, index = -1;
    for (let i = 0; i < N; i++) {
      const dx = rest[i * 2] - x, dy = rest[i * 2 + 1] - y, d = dx * dx + dy * dy;
      if (d < best) { best = d; index = i; }
    }
    return index;
  }
  function target(event, radius) {
    const s = current, none = { index: -1, group: -1, light: -1 };
    const over = document.elementFromPoint(event.clientX, event.clientY);
    if (!s || s.alpha < 0.5 || (over && over.closest(ignore)) || s.a !== s.b) return none;
    if (s.a === 'M' || s.a === 'Mc' || s.a === 'F') {
      let light = -1, best = (radius + 6) ** 2;
      lightPos.forEach((p, k) => { const d = (p.x - event.clientX) ** 2 + (p.y - event.clientY) ** 2; if (d < best) { best = d; light = k; } });
      if (light >= 0) return { ...none, light };
    }
    if (s.a === 'G' || s.a === 'P') {
      let group = -1;
      discs[s.a].forEach((d, j) => { if (Math.hypot(event.clientX - d.x, event.clientY - d.y) < Math.max(d.r + 6, 14)) group = j; });
      return { ...none, group };
    }
    const index = nearest(event.clientX, event.clientY, radius);
    return { ...none, index, group: s.a === 'X' && index >= 0 ? juzOf[index] : -1 };
  }
  function point(event) {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    const s = current;
    const { index, group, light } = target(event, 12);
    const box = s && (s.a === 'Mc' ? boxes.Mc : s.a === 'F' ? boxes.F : boxes.M);
    const overMoon = box && event.clientX > box.x && event.clientX < box.x + box.s && event.clientY > box.y && event.clientY < box.y + box.s;
    mag.tx = event.clientX; mag.ty = event.clientY;
    if (mag.s < 0.02) { mag.x = mag.tx; mag.y = mag.ty; }
    mag.ts = overMoon && s && s.alpha > 0.5 && light < 0 && !document.elementFromPoint(event.clientX, event.clientY)?.closest(ignore) ? 1 : 0;
    hoverIndex = index; hoverGroup = group; hoverLight = light;
    request();
    let title = '', detail = '';
    if (light >= 0) {
      const l = lights[light];
      if (l.kind === 'ayah') { title = ref(l.i); detail = t('lightAyah', 'The moon in the Quran') + ' · ' + t('moonTapToRead', 'tap to read'); }
      else { title = l.collection + ' ' + l.reference; detail = t('lightHadith', 'A narration behind our name') + ' · ' + t('moonTapToRead', 'tap to read'); }
      if (l.id && /sighting/.test(l.id)) detail = t('lightSighting', 'On sighting the crescent') + ' · ' + t('moonTapToRead', 'tap to read');
    } else if (index >= 0 && s.a === 'X') {
      title = t('moonJuz', 'Juz') + ' ' + digits.format(juzOf[index] + 1) + ' · ' + ref(index);
      detail = digits.format(sizes[juzOf[index]]) + ' ' + t('moonVerses', 'ayat') + ' · ' + t('moonTapToRead', 'tap to read');
    } else if (index >= 0) {
      const sIdx = surahOf[index];
      title = ref(index);
      detail = t('moonSurah', 'Surah') + ' ' + digits.format(sIdx + 1) + ' · ' + digits.format(D.counts[sIdx]) + ' ' + t('moonVerses', 'ayat') + ' · ' + (D.medinan[sIdx] === '1' ? t('moonMedinan', 'Medinan') : t('moonMeccan', 'Meccan')) + ' · ' + t('moonTapToRead', 'tap to read');
    } else if (group >= 0 && s.a === 'G') {
      title = t('moonNight', 'Night') + ' ' + digits.format(group + 1) + ' · ' + t('moonJuz', 'Juz') + ' ' + digits.format(group + 1);
      detail = digits.format(sizes[group]) + ' ' + t('moonVerses', 'ayat') + ' · ' + t('moonBegins', 'begins') + ' ' + ref(juzFirst[group]);
    } else if (group >= 0 && s.a === 'P') {
      title = t('khatmDay', 'Day') + ' ' + digits.format(group + 1) + ' / ' + digits.format(pace);
      detail = digits.format(portions[group].n) + ' ' + t('moonVerses', 'ayat') + ' · ' + t('moonBegins', 'begins') + ' ' + ref(portions[group].first);
    }
    if (title && !(!card.hidden && index >= 0 && index === selected)) show(event, title, detail);
    else tip.hidden = true;
    document.body.style.cursor = title ? 'pointer' : '';
  }
  function show(event, title, detail) {
    tip.replaceChildren(Object.assign(document.createElement('b'), { textContent: title }), Object.assign(document.createElement('span'), { textContent: detail }));
    tip.hidden = false;
    const x = Math.min(event.clientX + 16, vw - tip.offsetWidth - 12), y = Math.max(event.clientY - tip.offsetHeight - 14, 8);
    tip.style.transform = `translate(${x}px, ${y}px)`;
  }
  let down = null;
  addEventListener('pointerdown', event => { down = { x: event.clientX, y: event.clientY }; }, { passive: true });
  addEventListener('pointerup', event => {
    if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 8) return;
    if (event.target.closest && event.target.closest('.v-verse-card')) return;
    const { index, group, light } = target(event, event.pointerType === 'mouse' ? 12 : 22);
    const s = current;
    if (light >= 0) openLightCard(light);
    else if (index >= 0) openCard(index, event.clientX, event.clientY);
    else if (group >= 0 && s.a === 'G') openCard(juzFirst[group], event.clientX, event.clientY);
    else if (group >= 0 && s.a === 'P') openCard(portions[group].first, event.clientX, event.clientY);
    else if (!card.hidden && !(event.target.closest && event.target.closest(ignore))) closeCard();
  }, { passive: true });
  addEventListener('pointermove', point, { passive: true });
  document.addEventListener('pointerleave', () => { tip.hidden = true; hoverIndex = hoverGroup = hoverLight = -1; mag.ts = 0; request(); });

  /* The reader's pace, from the My Khatm step. */
  document.querySelectorAll('[data-khatm-days]').forEach(button => button.addEventListener('click', () => planPace(Number(button.dataset.khatmDays), true)));

  /* ---------------------------------------------------------- wiring */
  addEventListener('scroll', () => {
    tip.hidden = true; mag.ts = 0;
    if (intro < 1 && scrollY > 40) intro = 1;
    if (!card.hidden && Math.abs(scrollY - anchor) > 160) closeCard();
    request();
    if (!card.hidden) placeCard();
  }, { passive: true });
  let resizeTimer = 0;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { layout(); request(); }, 80); });
  reduced.addEventListener('change', () => { if (reduced.matches) intro = 1; request(); });
  document.addEventListener('visibilitychange', () => { lastNow = 0; if (!document.hidden) request(); });
  motionToggle?.addEventListener('click', () => setTimeout(request, 0));
  addEventListener('load', () => { layout(); request(); });
  if (scrollY > innerHeight * 0.5) intro = 1;
  layout();
  request();
})();
