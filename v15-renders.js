/* Ummahti V1.5 renders: live devices for Ayah on Unlock and Recite to add, and the channel wall.
   No network beyond this origin. Reduced motion and the page's motion toggle are respected. */
(() => {
  'use strict';
  const VERSION = '20261019o';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const I18N = window.UMMAHTI_V15_I18N || {};
  const t = (k, vars) => { let s = I18N[k] || k; if (vars) for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(b); return s; };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => reduced.matches || document.querySelector('[data-motion-toggle]')?.getAttribute('aria-pressed') === 'true';
  const lang = document.documentElement.lang || 'en';
  const fmt = n => n.toLocaleString(lang === 'ar' ? 'ar-EG' : lang === 'ur' ? 'ur-PK' : lang === 'id' ? 'id-ID' : 'en-US');
  const sleep = ms => new Promise(r => setTimeout(r, still() ? Math.min(ms, 60) : ms));
  const MOON = window.UMMAHTI_MOON || null;

  /* Surah text, loaded on demand from the site's own corpus (the same files the moon reader uses). */
  const ayat = () => (window.UMMAHTI_AYAT = window.UMMAHTI_AYAT || {});
  const pending = {};
  function surah(n) {
    if (ayat()[n]) return Promise.resolve(ayat()[n]);
    if (!pending[n]) pending[n] = new Promise((ok, fail) => {
      const tag = document.createElement('script');
      tag.src = '/media/v15/quran/s' + String(n).padStart(3, '0') + '.js?v=' + VERSION;
      tag.onload = () => ayat()[n] ? ok(ayat()[n]) : fail(new Error('missing'));
      tag.onerror = () => { delete pending[n]; fail(new Error('load')); };
      document.head.appendChild(tag);
    });
    return pending[n];
  }
  const name = n => MOON ? (lang === 'ar' || lang === 'ur' ? MOON.namesArabic[n - 1] : MOON.names[n - 1]) : 'Surah ' + n;
  const words = (el, text, cls = 'r-word') => { el.textContent = ''; return text.split(/\s+/).filter(Boolean).map(w => { const s = document.createElement('span'); s.className = cls; s.textContent = w; el.append(s, ' '); return s; }); };
  function reveal(spans, gap = 110) { spans.forEach((s, i) => setTimeout(() => s.classList.add('is-in'), still() ? 0 : 120 + i * gap)); }

  /* Gentle pointer tilt for every live device and re-framed capture. */
  function tilt(el, max = 7) {
    if (!matchMedia('(hover: hover)').matches) return;
    const host = el.closest('[data-r-tilt-host]') || el;
    host.addEventListener('pointermove', e => {
      if (still()) return;
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      el.style.setProperty('--ry', (x * max).toFixed(2) + 'deg'); el.style.setProperty('--rx', (-y * max * .7).toFixed(2) + 'deg');
    });
    host.addEventListener('pointerleave', () => { el.style.setProperty('--ry', '0deg'); el.style.setProperty('--rx', '0deg'); });
  }

  /* ---------------- 01 Ayah on Unlock ---------------- */
  function unlockDemo(root) {
    const screen = $('.r-screen', root), lock = $('.r-lock', root), device = $('.r-device', root);
    const card = { ref: $('[data-r-ref]', root), sub: $('[data-r-sub]', root), ar: $('[data-r-arabic]', root), tr: $('[data-r-trans]', root), pct: $('[data-r-pct]', root), kept: $('.r-kept', root) };
    const status = $('[data-r-status]', root), sparks = $('.r-sparks', root);
    const ayatEl = $('[data-r-ayat]'), countEl = $('[data-r-count]'), placeTrack = $('[data-r-place]');
    tilt(device);
    let seq = 93, index = 0, done = 0, keptLater = false, busy = false, open = false;

    // Live clock, with the Hijri date where the browser knows the Umm al-Qura calendar.
    const clock = () => {
      const now = new Date();
      $('[data-r-time]', root).textContent = now.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', hour12: false });
      $('[data-r-bar-time]', root).textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      $('[data-r-date]', root).textContent = now.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });
      try { $('[data-r-hijri]', root).textContent = new Intl.DateTimeFormat(lang + '-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(now); } catch (_) {}
    };
    clock(); setInterval(clock, 30000);

    // The journey dots: one per ayah of Ad-Dhuhaa.
    const dots = [];
    if (ayatEl) for (let i = 1; i <= 11; i++) { const d = document.createElement('i'); d.textContent = i; ayatEl.append(d); dots.push(d); }
    const paintDots = () => { if (seq !== 93) return; dots.forEach((d, i) => { d.classList.toggle('is-read', i < index); d.classList.toggle('is-now', i === index); }); };

    async function show(animate = true) {
      const list = await surah(seq).catch(() => null);
      if (!list) { status.textContent = t('rLoadError'); return; }
      const [arabic, translation] = list[index];
      card.ref.textContent = t('rSurahChip', { name: name(seq), ref: seq + ':' + (index + 1) });
      card.sub.textContent = t('rJuzPage');
      const spans = words(card.ar, arabic);
      card.tr.textContent = '“' + translation + '”';
      card.pct.textContent = Math.floor(done / 6236 * 100) + '%';
      if (countEl) countEl.textContent = t('rOfAyat', { n: fmt(done) });
      paintDots();
      if (animate) reveal(spans, 130); else spans.forEach(s => s.classList.add('is-in'));
    }

    function unlock() {
      if (open || busy) return;
      open = true; screen.classList.add('is-open'); screen.classList.remove('is-leaving');
      card.kept.classList.toggle('is-on', keptLater);
      lock.setAttribute('aria-hidden', 'true'); lock.querySelector('button').tabIndex = -1;
      $$('.r-card button', root).forEach(b => b.tabIndex = 0);
      show(true);
      status.textContent = keptLater ? t('rKeptAgain') : t('rUnlocked');
      setTimeout(() => $('[data-r-tamam]', root).focus({ preventScroll: true }), still() ? 0 : 900);
    }
    async function relock(message) {
      busy = true; screen.classList.add('is-leaving');
      await sleep(550);
      screen.classList.remove('is-open', 'is-leaving'); open = false;
      lock.removeAttribute('aria-hidden'); const b = lock.querySelector('button'); b.tabIndex = 0;
      $$('.r-card button', root).forEach(x => x.tabIndex = -1);
      status.textContent = message; busy = false;
      setTimeout(() => b.focus({ preventScroll: true }), 50);
    }

    // Swipe up (or tap, or press the hint) to unlock.
    let start = null;
    lock.addEventListener('pointerdown', e => { start = { y: e.clientY, h: lock.offsetHeight }; lock.setPointerCapture(e.pointerId); screen.classList.add('is-dragging'); });
    lock.addEventListener('pointermove', e => { if (!start) return; const dy = Math.min(0, e.clientY - start.y); lock.style.translate = '0 ' + dy + 'px'; lock.style.opacity = String(1 + dy / start.h * 1.4); });
    const end = e => {
      if (!start) return; const dy = e.clientY - start.y, h = start.h; start = null;
      screen.classList.remove('is-dragging'); lock.style.translate = ''; lock.style.opacity = '';
      if (dy < -h * .18 || Math.abs(dy) < 6) unlock();
    };
    lock.addEventListener('pointerup', end); lock.addEventListener('pointercancel', end);
    lock.querySelector('button').addEventListener('click', e => { e.stopPropagation(); unlock(); });
    lock.querySelector('button').addEventListener('pointerdown', e => e.stopPropagation());

    $('[data-r-tamam]', root).addEventListener('click', async e => {
      if (!open || busy) return;
      const star = e.currentTarget; star.classList.remove('is-burst'); void star.offsetWidth; star.classList.add('is-burst');
      burst(star); done++; keptLater = false; card.kept.classList.remove('is-on');
      if (placeTrack) { placeTrack.classList.remove('is-pulse'); void placeTrack.offsetWidth; placeTrack.classList.add('is-pulse'); }
      const len = (ayat()[seq] || []).length;
      if (index < len - 1) index++;
      else if (seq === 93) { seq = 94; index = 0; dots.forEach(d => d.classList.add('is-read')); }
      else { status.textContent = t('exampleComplete'); seq = 93; index = 0; dots.forEach(d => d.classList.remove('is-read')); await sleep(320); show(true); return; }
      status.textContent = t('advancedResult');
      await sleep(320); show(true);
    });
    $('[data-r-later]', root).addEventListener('click', () => { if (!open || busy) return; keptLater = true; relock(t('laterResult')); });
    $('[data-r-recite]', root).addEventListener('click', () => { if (open) status.textContent = t('rRecitePreview'); });
    $('[data-r-reset]', root).addEventListener('click', () => { seq = 93; index = 0; done = 0; keptLater = false; dots.forEach(d => d.classList.remove('is-read')); relock(t('resetResult')); show(false); });

    function burst(from) {
      if (still()) return;
      const a = from.getBoundingClientRect(), b = screen.getBoundingClientRect(), cx = a.left - b.left + a.width / 2, cy = a.top - b.top + a.height / 3;
      for (let i = 0; i < 14; i++) {
        const s = document.createElement('i'), ang = Math.PI * 2 * i / 14, r = 30 + Math.random() * 40;
        s.style.left = cx + 'px'; s.style.top = cy + 'px';
        s.style.setProperty('--dx', Math.cos(ang) * r + 'px'); s.style.setProperty('--dy', Math.sin(ang) * r + 'px');
        sparks.append(s); setTimeout(() => s.remove(), 950);
      }
    }

    // One example day: when does an unlock bring an ayah, for each frequency?
    const svg = $('.r-day', root), note = $('[data-r-day-note]', root);
    const unlocks = []; let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    while (unlocks.length < 64) { const h = 6.5 + rnd() * 17, burst = rnd() < .35 ? 3 : 1; for (let k = 0; k < burst && unlocks.length < 64; k++) unlocks.push(Math.min(23.9, h + k * .05)); }
    unlocks.sort((a, b) => a - b);
    if (svg) {
      const NS = 'http://www.w3.org/2000/svg', C = 300, R1 = 268, R2 = 286;
      unlocks.forEach(h => {
        const a = h / 24 * Math.PI * 2 - Math.PI / 2, l = document.createElementNS(NS, 'line');
        l.setAttribute('x1', (C + Math.cos(a) * R1).toFixed(1)); l.setAttribute('y1', (C + Math.sin(a) * R1).toFixed(1));
        l.setAttribute('x2', (C + Math.cos(a) * R2).toFixed(1)); l.setAttribute('y2', (C + Math.sin(a) * R2).toFixed(1));
        svg.append(l);
      });
    }
    const lines = svg ? $$('line', svg) : [];
    function cadence(kind) {
      let last = -99, shown = 0;
      unlocks.forEach((h, i) => {
        const on = kind === 'every' || (kind === 'hourly' && h - last >= 1) || (kind === 'daily' && last < 0);
        if (on) { last = h; shown++; }
        const line = lines[i]; if (line) setTimeout(() => line.classList.toggle('is-on', on), still() ? 0 : i * 18);
      });
      if (note) note.innerHTML = t('rDayNote', { shown: '<b>' + fmt(shown) + '</b>', unlocks: fmt(unlocks.length) });
    }
    $$('[data-r-cadence]', root).forEach(b => b.addEventListener('click', () => {
      $$('[data-r-cadence]', root).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      cadence(b.dataset.rCadence); status.textContent = t('cadenceResult', { cadence: b.textContent.trim() });
    }));
    cadence('every');
    show(false);
  }

  /* ---------------- My Hifz: Recite to add ---------------- */
  function hifzDemo(root) {
    const D = window.UMMAHTI_RENDERS; if (!D || !MOON) return;
    const screen = $('.r-screen', root), device = $('.r-device', root), canvas = $('.r-ring', root);
    const meterN = $('[data-r-meter]', root), meterNote = $('[data-r-meter-note]', root), status = $('[data-r-hz-status]', root);
    tilt(device, 5);
    const counts = MOON.counts, starts = []; let g = 0; counts.forEach(c => { starts.push(g); g += c; });
    const TOTAL = 6236;
    // A record that is "a few ayahs here, a surah there".
    const record = [
      { s: 1, a: 1, b: 7, st: 'mem' }, { s: 2, a: 255, b: 255, st: 'mem' }, { s: 18, a: 1, b: 10, st: 'learn' },
      { s: 36, a: 1, b: 12, st: 'rev' }, { s: 67, a: 1, b: 30, st: 'learn' }, { s: 112, a: 1, b: 4, st: 'mem' },
      { s: 113, a: 1, b: 5, st: 'mem' }, { s: 114, a: 1, b: 6, st: 'mem' }
    ];
    let candidates = null, flare = null, mode = 'recite', voice = 'alafasy', chosenState = 'learn', found = null, running = 0;

    // ---- The ring: every ayah one dot, in order, a small gap between surahs.
    const ctx = canvas.getContext('2d'); let W = 0, H = 0, dpr = 1, pts = null, cx = 0, cy = 0, R = 0, rot = 0;
    const ROWS = 8;
    function layout() {
      const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1);
      W = r.width; H = r.height; canvas.width = W * dpr; canvas.height = H * dpr;
      const dev = device.getBoundingClientRect(); cx = dev.left + dev.width / 2 - r.left; cy = dev.top + dev.height / 2 - r.top;
      R = Math.min(Math.max(dev.height * .62, 200), Math.min(W, H) * .49);
      const cols = Math.ceil(TOTAL / ROWS), gap = 1.4, span = cols + 114 * gap;
      pts = new Float32Array(TOTAL * 2); let col = 0, k = 0;
      counts.forEach(c => { for (let i = 0; i < c; i++, k++) { const cc = col + Math.floor(i / ROWS), ring = i % ROWS, ang = (cc / span) * Math.PI * 2 - Math.PI / 2, rr = R - ring * Math.max(3, R * .016); pts[k * 2] = ang; pts[k * 2 + 1] = rr; } col += Math.ceil(c / ROWS) + gap; });
    }
    const css = getComputedStyle(document.documentElement);
    const gold = () => (css.getPropertyValue('--gold-rgb') || '212,175,55').trim();
    function stateOf(k) { for (let i = record.length - 1; i >= 0; i--) { const p = record[i], a = starts[p.s - 1] + p.a - 1, b = starts[p.s - 1] + p.b - 1; if (k >= a && k <= b) return p.st; } return null; }
    let stateMap = new Uint8Array(TOTAL);
    const rebuildStates = () => { stateMap = new Uint8Array(TOTAL); for (let k = 0; k < TOTAL; k++) { const s = stateOf(k); stateMap[k] = s === 'mem' ? 1 : s === 'learn' ? 2 : s === 'rev' ? 3 : 0; } };
    rebuildStates();
    let candSet = null, last = 0, visible = false;
    function draw(now) {
      if (!pts) layout();
      const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
      if (!still()) rot += dt * .012;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const G = gold(), size = Math.max(1.3, R * .0055);
      for (let k = 0; k < TOTAL; k++) {
        const a = pts[k * 2] + rot, r = pts[k * 2 + 1], x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, st = stateMap[k];
        let alpha = .34, color = G, s = size;
        if (candSet) { if (candSet.has(k)) { alpha = .95; s = size * 1.7; color = '245,230,179'; } else alpha = .05; }
        if (st && !candSet) { s = size * 1.5; alpha = .95; color = st === 1 ? G : st === 2 ? '98,194,154' : '224,149,106'; }
        if (flare && k >= flare.a && k <= flare.b) { const f = Math.max(0, 1 - (now - flare.t) / 1600); s += f * size * 4; alpha = Math.min(1, alpha + f); }
        ctx.fillStyle = 'rgba(' + color + ',' + alpha + ')';
        if (st === 3 && !candSet) { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = .8; ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.stroke(); }
        else ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
      // Threads from the last few candidates to the phone: the search closing in.
      if (candSet && candSet.size <= 4) {
        candSet.forEach(k => {
          const a = pts[k * 2] + rot, r = pts[k * 2 + 1], x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          const grad = ctx.createLinearGradient(x, y, cx, cy); grad.addColorStop(0, 'rgba(245,230,179,.9)'); grad.addColorStop(1, 'rgba(' + G + ',0)');
          ctx.strokeStyle = grad; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo((x + cx) / 2 + (y - cy) * .15, (y + cy) / 2 - (x - cx) * .15, cx, cy); ctx.stroke();
          ctx.fillStyle = 'rgba(245,230,179,1)'; ctx.beginPath(); ctx.arc(x, y, size * 3.2, 0, 7); ctx.fill();
        });
      }
      if (flare) { const f = (now - flare.t) / 1100; if (f < 1) { const k = Math.round((flare.a + flare.b) / 2), a = pts[k * 2] + rot, r = pts[k * 2 + 1], tx = cx + Math.cos(a) * r, ty = cy + Math.sin(a) * r, e = 1 - Math.pow(1 - f, 3);
        const x = cx + (tx - cx) * e, y = cy + (ty - cy) * e - Math.sin(f * Math.PI) * 60; ctx.fillStyle = 'rgba(245,230,179,' + (1 - f * .5) + ')'; ctx.shadowColor = 'rgba(' + G + ',1)'; ctx.shadowBlur = 18; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); ctx.shadowBlur = 0; } }
      if (visible && !still()) requestAnimationFrame(draw);
    }
    const kick = () => { if (visible && !still()) requestAnimationFrame(draw); else requestAnimationFrame(t0 => { draw(t0); }); };
    new IntersectionObserver(es => { const was = visible; visible = es[0].isIntersecting; if (visible && !was) { last = performance.now(); kick(); } }).observe(root);
    new ResizeObserver(() => { pts = null; kick(); }).observe(root);

    // ---- The record box.
    function paintRecord() {
      const by = { mem: 0, learn: 0, rev: 0 }, surahs = new Set(); let n = 0;
      record.forEach(p => { by[p.st]++; surahs.add(p.s); n += p.b - p.a + 1; });
      $('[data-r-rec-mem]', root).textContent = fmt(by.mem); $('[data-r-rec-learn]', root).textContent = fmt(by.learn); $('[data-r-rec-rev]', root).textContent = fmt(by.rev);
      $('[data-r-rec-sum]', root).textContent = t('rRecordSum', { ayahs: fmt(n), surahs: fmt(surahs.size) });
    }
    paintRecord();
    const meter = (n, note) => { meterN.textContent = fmt(n); meterNote.textContent = note || ''; };
    meter(TOTAL, t('rMeterIdle'));

    // ---- Panes.
    const panes = { idle: $('[data-pane=idle]', root), listen: $('[data-pane=listen]', root), say: $('[data-pane=say]', root), found: $('[data-pane=found]', root), choose: $('[data-pane=choose]', root) };
    function pane(id) { Object.entries(panes).forEach(([k, el]) => el.classList.toggle('is-on', k === id)); screen.dataset.step = id; }
    function setMode(m) {
      mode = m; running++; stopAudio(); candSet = null; kick();
      $$('[data-r-mode]', root).forEach(b => { const on = b.dataset.rMode === m; b.setAttribute('aria-pressed', String(on)); });
      screen.dataset.mode = m;
      $('[data-r-sheet-title]', root).textContent = t(m === 'recite' ? 'rSheetRecite' : m === 'say' ? 'rSheetSay' : 'rSheetChoose');
      $('[data-r-sheet-body]', root).textContent = t(m === 'recite' ? 'rSheetReciteBody' : 'rSheetSayBody');
      $('.r-voices', root).hidden = m !== 'recite';
      $('.r-mic', root).lastChild.textContent = t(m === 'say' ? 'rMicSay' : 'rMic');
      meter(TOTAL, t('rMeterIdle'));
      if (m === 'choose') { pane('choose'); preview(); } else pane('idle');
    }
    $$('[data-r-mode]', root).forEach(b => b.addEventListener('click', () => setMode(b.dataset.rMode)));
    $$('[data-r-voice]', root).forEach(b => b.addEventListener('click', () => { voice = b.dataset.rVoice; $$('[data-r-voice]', root).forEach(x => x.setAttribute('aria-pressed', String(x === b))); }));

    // ---- Audio: a reciter stands in for the visitor's voice. Same-origin clip; the waveform is drawn from it.
    const VOICES = { alafasy: [.25, 13.3], husary: [.64, 17.2], minshawy_murattal: [1.23, 14.6] };
    let audio = null, actx = null, analyser = null, waveRaf = 0;
    function stopAudio() { if (audio) { audio.pause(); audio = null; } cancelAnimationFrame(waveRaf); $('.r-mic', root).classList.remove('is-live'); }
    function wave(el) {
      const c = el.getContext('2d'), w = el.width = el.offsetWidth * dpr, h = el.height = el.offsetHeight * dpr, buf = analyser ? new Uint8Array(analyser.fftSize) : null;
      const loop = () => {
        c.clearRect(0, 0, w, h); const bars = 42, bw = w / bars;
        if (buf) analyser.getByteTimeDomainData(buf);
        for (let i = 0; i < bars; i++) {
          let v = .08; if (buf) { let m = 0; const step = Math.floor(buf.length / bars); for (let j = 0; j < step; j++) m = Math.max(m, Math.abs(buf[i * step + j] - 128)); v = Math.max(.06, m / 128); } else v = .1 + Math.abs(Math.sin(performance.now() / 180 + i * .6)) * .5;
          const bh = v * h * .95; c.fillStyle = 'rgba(241,217,138,' + (.35 + v * .65) + ')'; c.beginPath(); c.roundRect ? c.roundRect(i * bw + bw * .25, (h - bh) / 2, bw * .5, bh, bw * .25) : c.rect(i * bw + bw * .25, (h - bh) / 2, bw * .5, bh); c.fill();
        }
        waveRaf = requestAnimationFrame(loop);
      }; loop();
    }
    async function recite() {
      const run = ++running; pane('listen'); found = null;
      const mic = $('.r-mic', root); mic.classList.add('is-live');
      status.textContent = t('rListening');
      const heard = words($('[data-r-heard]', root), D.ayah.arabic);
      const [lead, endAt] = VOICES[voice];
      audio = new Audio('/media/recitation/anbiya-92/' + voice + '.mp3'); audio.preload = 'auto';
      try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        if (actx.state === 'suspended') await actx.resume();
        const src = actx.createMediaElementSource(audio); analyser = actx.createAnalyser(); analyser.fftSize = 1024; src.connect(analyser); analyser.connect(actx.destination);
      } catch (_) { analyser = null; }
      wave($('.r-wave', root));
      let started = performance.now(); const clock = () => audio && !audio.paused && audio.currentTime > 0 ? audio.currentTime : (performance.now() - started) / 1000;
      try { await audio.play(); } catch (_) { started = performance.now(); }
      // Word k is "heard" at the end of its share of the recitation (shares weighted by letters).
      const lens = D.ayah.words.map(w => w.replace(/[ً-ٰٟۖ-ۭ]/g, '').length), total = lens.reduce((a, b) => a + b, 0);
      let acc = 0; const at = lens.map(l => lead + ((acc += l) / total) * (endAt - lead));
      for (let k = 0; k < at.length; k++) {
        while (clock() < at[k]) { if (run !== running) return; await new Promise(r => setTimeout(r, 40)); }
        heard[k].classList.add('is-in');
        candSet = new Set(D.narrow[k]); kick();
        const n = D.narrow[k].length;
        meter(n, n === 2 ? t('rMeterTwin') : n === 1 ? t('rMeterOne') : t('rMeterNarrow', { k: fmt(k + 1) }));
      }
      if (run !== running) return;
      await sleep(700); if (run !== running) return;
      stopAudio();
      showFound(D.ayah.surah, D.ayah.n, D.ayah.n, D.ayah.arabic, null);
    }
    async function say() {
      const run = ++running; pane('say'); const said = $('[data-r-said]', root); said.textContent = '';
      status.textContent = t('rListening');
      const text = t('rSayHeard');
      for (const ch of text) { if (run !== running) return; said.textContent += ch; await sleep(55); }
      await sleep(500); if (run !== running) return;
      const S = D.say; candSet = new Set(Array.from({ length: S.to - S.from + 1 }, (_, i) => starts[S.surah - 1] + S.from - 1 + i)); kick();
      meter(S.to - S.from + 1, t('rMeterSay'));
      await sleep(900); if (run !== running) return;
      showFound(S.surah, S.from, S.to, S.first, S.last);
    }
    function showFound(s, a, b, first, lastText) {
      found = { s, a, b }; pane('found');
      $('[data-r-found-ref]', root).textContent = name(s) + ' ' + s + ':' + (a === b ? a : a + '–' + b);
      $('[data-r-first-n]', root).textContent = fmt(a); $('[data-r-first]', root).textContent = first;
      const lastRow = $('[data-r-last-row]', root); lastRow.hidden = a === b; $('.r-dots-v', root).hidden = a === b;
      if (lastText) { $('[data-r-last-n]', root).textContent = fmt(b); $('[data-r-last]', root).textContent = lastText; }
      status.textContent = t('rFoundStatus', { ref: name(s) + ' ' + s + ':' + (a === b ? a : a + '–' + b) });
      setTimeout(() => $('[data-r-state][aria-pressed=true]', root)?.focus({ preventScroll: true }), still() ? 0 : 500);
    }
    $$('[data-r-state]', root).forEach(b => b.addEventListener('click', () => { chosenState = b.dataset.rState; $$('[data-r-state]', root).forEach(x => x.setAttribute('aria-pressed', String(x === b))); }));
    $('[data-r-save]', root).addEventListener('click', async () => {
      if (!found) return;
      record.push({ s: found.s, a: found.a, b: found.b, st: chosenState }); rebuildStates(); paintRecord();
      candSet = null; flare = { a: starts[found.s - 1] + found.a - 1, b: starts[found.s - 1] + found.b - 1, t: performance.now() }; kick();
      const toast = $('.r-toast', root); toast.classList.add('is-on'); setTimeout(() => toast.classList.remove('is-on'), 2200);
      status.textContent = t('rSaved');
      meter(TOTAL, t('rMeterSaved'));
      await sleep(1300);
      if (mode === 'choose') pane('choose'); else pane('idle');
      setTimeout(() => { flare = null; }, 1800);
    });
    $('.r-mic', root).addEventListener('click', () => { if (mode === 'recite') recite(); else if (mode === 'say') say(); });
    $$('[data-r-again]', root).forEach(b => b.addEventListener('click', () => setMode(mode)));

    // ---- Choose it yourself.
    const sel = $('[data-r-surah]', root), fromO = $('[data-r-from]', root), toO = $('[data-r-to]', root);
    MOON.names.forEach((n, i) => { const o = document.createElement('option'); o.value = i + 1; o.textContent = (i + 1) + '. ' + name(i + 1); sel.append(o); });
    sel.value = '55'; let from = 1, to = 13;
    function clamp() { const max = counts[sel.value - 1]; from = Math.max(1, Math.min(from, max)); to = Math.max(from, Math.min(to, max)); fromO.textContent = fmt(from); toO.textContent = fmt(to); }
    async function preview() {
      clamp(); const s = +sel.value; candSet = new Set(Array.from({ length: to - from + 1 }, (_, i) => starts[s - 1] + from - 1 + i)); kick();
      meter(to - from + 1, t('rMeterChoose'));
      const list = await surah(s).catch(() => null); if (!list || +sel.value !== s) return;
      $('[data-r-pick-first]', root).textContent = list[from - 1][0];
    }
    sel.addEventListener('change', () => { from = 1; to = Math.min(counts[sel.value - 1], 10); preview(); });
    $$('[data-r-step]', root).forEach(b => b.addEventListener('click', () => { const [which, d] = b.dataset.rStep.split(':'); if (which === 'from') from += +d; else to += +d; preview(); }));
    $('[data-r-pick-next]', root).addEventListener('click', async () => {
      const s = +sel.value, list = await surah(s).catch(() => null); if (!list) { status.textContent = t('rLoadError'); return; }
      showFound(s, from, to, list[from - 1][0], list[to - 1][0]);
    });
    setMode('recite');
  }

  /* ---------------- The channel wall ---------------- */
  function wall(root) {
    // The video field: one dot per video on the channel, the ones on this wall lit.
    const field = $('[data-r-dotfield]');
    if (field) { const n = +field.dataset.count, lit = +field.dataset.lit; for (let i = 0; i < n; i++) { const d = document.createElement('i'); if (i < lit) d.className = 'is-shown'; field.append(d); } }
    const lanes = $$('.r-lane ul', root);
    if (still()) { root.classList.add('is-static'); return; }
    // Two copies of each lane so it loops without a seam; the copies are hidden from assistive tech.
    lanes.forEach(ul => { [...ul.children].forEach(li => { const c = li.cloneNode(true); c.setAttribute('aria-hidden', 'true'); $$('a', c).forEach(a => a.tabIndex = -1); ul.append(c); }); });
    const state = lanes.map((ul, i) => ({ ul, x: i % 2 ? -ul.scrollWidth / 4 : 0, dir: i % 2 ? 1 : -1, hover: false }));
    state.forEach(s => { s.ul.addEventListener('pointerenter', () => s.hover = true); s.ul.addEventListener('pointerleave', () => s.hover = false); s.ul.addEventListener('focusin', () => s.hover = true); s.ul.addEventListener('focusout', () => s.hover = false); });
    let on = false, last = 0, lastY = scrollY, boost = 0;
    function frame(now) {
      const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
      const dy = scrollY - lastY; lastY = scrollY; boost = boost * .9 + Math.abs(dy) * .6;
      state.forEach(s => {
        const half = s.ul.scrollWidth / 2, speed = s.hover ? 0 : (22 + boost) * (document.dir === 'rtl' ? -1 : 1);
        s.x += s.dir * speed * dt; if (s.x <= -half) s.x += half; if (s.x > 0) s.x -= half;
        s.ul.style.transform = 'translate3d(' + s.x.toFixed(1) + 'px,0,0)';
      });
      if (on && !still()) requestAnimationFrame(frame);
    }
    new IntersectionObserver(es => { const was = on; on = es[0].isIntersecting; if (on && !was) { last = performance.now(); requestAnimationFrame(frame); } }).observe(root);
    // Hover plays a tile's six-second loop; on touch, a spotlight walks along the wall.
    const play = tile => { const v = $('video', tile); if (!v) return; if (!v.src) v.src = v.dataset.src; v.play().then(() => tile.classList.add('is-playing')).catch(() => {}); };
    const stop = tile => { const v = $('video', tile); tile.classList.remove('is-playing'); if (v) v.pause(); };
    $$('.r-tile', root).forEach(tile => { tile.addEventListener('pointerenter', () => play(tile)); tile.addEventListener('pointerleave', () => stop(tile)); tile.addEventListener('focus', () => play(tile)); tile.addEventListener('blur', () => stop(tile)); });
    if (!matchMedia('(hover: hover)').matches) {
      let current = null;
      setInterval(() => {
        if (!on || still()) return;
        const mid = innerWidth / 2, tiles = $$('.r-tile', root).filter(x => { const r = x.getBoundingClientRect(); return r.left > 0 && r.right < innerWidth; });
        if (!tiles.length) return; tiles.sort((a, b) => Math.abs(a.getBoundingClientRect().left - mid) - Math.abs(b.getBoundingClientRect().left - mid));
        const next = tiles[Math.floor(Math.random() * Math.min(3, tiles.length))];
        if (current && current !== next) stop(current); current = next; play(next);
      }, 3200);
    }
  }


  /* ---------------- Hero: a different ayah with each visit ---------------- */
  function heroAyah() {
    const D = window.UMMAHTI_RENDERS, fig = $('.v-hero-ayah'); if (!D || !D.hero || !fig) return;
    let last = -1; try { last = +localStorage.getItem('ummahti-hero-ayah'); } catch (_) {}
    let i = Math.floor(Math.random() * D.hero.length); if (i === last) i = (i + 1) % D.hero.length;
    try { localStorage.setItem('ummahti-hero-ayah', String(i)); } catch (_) {}
    const h = D.hero[i], ar = $('.v-arabic', fig), en = $('figcaption span', fig), cite = $('figcaption cite', fig);
    const fill = (el, [a, b, c], gap) => {
      el.textContent = '';
      if (a) el.append(a + gap);
      const em = document.createElement('em'); em.textContent = b; el.append(em);
      if (c) el.append(gap + c);
    };
    fill(ar, h.ar, ' ');
    // Saheeh sometimes closes a quotation opened in the previous ayah; alone, that mark reads as a typo.
    const parts = h.en.slice(), quotes = (parts.join('').match(/"/g) || []).length;
    if (quotes % 2) parts[2] = parts[2].replace(/"\s*$/, '');
    fill(en, parts, '');
    en.prepend('“'); en.append('”');
    cite.textContent = name(h.s) + ' ' + h.s + ':' + h.a;
    fig.classList.add('r-set');
  }

  /* ---------------- Hero: the Guide, live. A question is typed, sources are searched, an answer appears ---------------- */
  function guideHero(root) {
    const G = window.UMMAHTI_GUIDE; if (!G) return;
    const byId = Object.fromEntries(G.topics.map(x => [x.id, x]));
    const scenes = [['rGhQ1', 'anxiety_and_worry'], ['rGhQ2', 'forgiveness_and_repentance'], ['rGhQ3', 'waking_for_fajr'], ['rGhQ4', 'feeling_behind_in_life']]
      .filter(([, id]) => byId[id]);
    if (!scenes.length) return;
    const screen = $('.r-gh-screen', root), typed = $('[data-r-gh-typed]', root), ph = $('[data-r-gh-placeholder]', root), status = $('[data-r-gh-status]', root);
    const card = $('[data-r-gh-card]', root), flyers = $('.r-gh-flyers', root), canvas = $('.r-gh-globe', root);
    const pauseBtn = $('[data-r-gh-pause]', root);
    let scene = -1, run = 0, paused = false, visible = false, speed = .25;
    const flash = new Float32Array(260);
    // The globe: sources as points on a turning sphere.
    const N = 260, P = [];
    for (let i = 0; i < N; i++) { const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963; P.push([Math.cos(th) * r, y, Math.sin(th) * r]); }
    const ctx = canvas.getContext('2d'); let rot = 0, lastT = 0;
    function globe(now) {
      const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
      if (!w || !h) { if (visible) requestAnimationFrame(globe); return; }
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      const dt = Math.min(.05, (now - lastT) / 1000 || 0); lastT = now; if (!still()) rot += dt * speed;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const R = Math.min(w, h) * .42, cx = w / 2, cy = h / 2, c = Math.cos(rot), sn = Math.sin(rot), tilt = .35, ct = Math.cos(tilt), st = Math.sin(tilt);
      const g = ctx.createRadialGradient(cx - R * .3, cy - R * .3, R * .1, cx, cy, R * 1.2); g.addColorStop(0, 'rgba(212,175,55,.12)'); g.addColorStop(1, 'rgba(212,175,55,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.15, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(212,175,55,.18)'; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.ellipse(cx, cy, R, R * .32, 0, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
      for (let i = 0; i < N; i++) {
        const [x, y, z] = P[i], x1 = x * c + z * sn, z1 = -x * sn + z * c, y1 = y * ct - z1 * st, z2 = y * st + z1 * ct;
        const depth = (z2 + 1) / 2, f = flash[i]; if (f) flash[i] = Math.max(0, f - dt * 1.3);
        ctx.fillStyle = f ? 'rgba(245,230,179,' + (.5 + f * .5) + ')' : 'rgba(212,175,55,' + (.12 + depth * .55) + ')';
        const sz = (.6 + depth * 1.1) + f * 2.4; ctx.fillRect(cx + x1 * R - sz / 2, cy + y1 * R - sz / 2, sz, sz);
      }
      if (visible && !still()) requestAnimationFrame(globe);
    }
    const kickGlobe = () => requestAnimationFrame(globe);
    const wait = (ms, r) => new Promise(ok => setTimeout(ok, still() ? Math.min(ms, 40) : ms)).then(() => { if (r !== run) throw new Error('stop'); });
    async function playGuide(r) {
      scene = (scene + 1) % scenes.length; const [qKey, id] = scenes[scene], tp = byId[id];
      card.classList.remove('is-on'); screen.classList.remove('is-searching', 'is-found');
      typed.textContent = ''; ph.hidden = false; status.textContent = ''; flyers.textContent = '';
      await wait(900, r);
      ph.hidden = true; const q = t(qKey);
      for (const ch of q) { typed.textContent += ch; await wait(45 + Math.random() * 70, r); }
      await wait(450, r);
      // Search: the globe quickens, sources light up and fly to the centre.
      screen.classList.add('is-searching'); speed = 2.4; status.textContent = t('rGuideSearching');
      const refs = tp.q.slice(0, 3).map(([s, a, e]) => name(s) + ' ' + s + ':' + a + (e > a ? '–' + e : ''))
        .concat(tp.h.slice(0, 2).map(j => G.cites[j] ? G.cites[j].c + ' ' + G.cites[j].r : '').filter(Boolean));
      for (let k = 0; k < refs.length; k++) {
        for (let n = 0; n < 16; n++) flash[Math.floor(Math.random() * N)] = 1;
        const f = document.createElement('span'); f.textContent = refs[k];
        const ang = (k / refs.length) * Math.PI * 2 + .6; f.style.setProperty('--fx', (Math.cos(ang) * 120).toFixed(0) + '%'); f.style.setProperty('--fy', (Math.sin(ang) * 260).toFixed(0) + '%');
        flyers.append(f); await wait(430, r);
      }
      const list = await surah(tp.q[0][0]).catch(() => null); if (r !== run) return;
      await wait(500, r);
      speed = .25; screen.classList.remove('is-searching'); screen.classList.add('is-found');
      status.textContent = t('rGuideFound', { n: fmt(tp.q.length + tp.h.length) });
      $('[data-r-gh-topic]', root).textContent = tp.t; $('[data-r-gh-question]', root).textContent = tp.s;
      const [s, a] = tp.q[0], v = list ? list[a - 1] : null;
      $('[data-r-gh-ar]', root).textContent = v ? v[0] : ''; $('[data-r-gh-en]', root).textContent = v ? '“' + v[1] + '”' : '';
      $('[data-r-gh-ref]', root).textContent = name(s) + ' ' + s + ':' + a;
      const chips = $('[data-r-gh-chips]', root); chips.textContent = '';
      const chip = text => { const c = document.createElement('span'); c.textContent = text; chips.append(c); };
      if (tp.q.length > 1) chip(t('rGuideMoreAyat', { n: fmt(tp.q.length - 1) }));
      tp.h.slice(0, 1).forEach(j => { if (G.cites[j]) chip(G.cites[j].c + ' ' + G.cites[j].r); });
      if (tp.d && tp.d.length) chip(t('rGuideDua'));
      card.classList.add('is-on');
      await wait(6400, r);
    }
    // ---- More than the Guide: the phone moves between the app's main moments.
    const sceneEls = Object.fromEntries($$('[data-scene]', root).map(el => [el.dataset.scene, el]));
    const nameEl = $('[data-r-sc-name]', root), capEl = $('[data-r-sc-cap]', root);
    const SCENE_TEXT = { guide: ['Ummahti Guide', 'rGuideCaption'], unlock: ['Ayah on Unlock', 'rSceneUnlockCap'], recite: ['My Hifz · ' + t('rSheetRecite'), 'rSceneReciteCap'], read: [t('rSceneRead'), 'rSceneReadCap'] };
    function showScene(id) {
      Object.entries(sceneEls).forEach(([k, el]) => { const on = k === id; el.classList.toggle('is-on', on); if (on) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', 'true'); });
      if (nameEl && nameEl.firstChild) nameEl.firstChild.textContent = SCENE_TEXT[id][0];
      if (capEl) capEl.textContent = t(SCENE_TEXT[id][1]);
    }
    let unlockAt = 0, unlockDone = 0;
    async function playUnlock(r) {
      const el = sceneEls.unlock; showScene('unlock'); el.classList.remove('is-open');
      const now = new Date();
      $('[data-r-sc-time]', el).textContent = now.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', hour12: false });
      $('[data-r-sc-date]', el).textContent = now.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });
      const list = await surah(93).catch(() => null); if (!list || r !== run) return;
      const fill = () => { const [ar, en] = list[unlockAt % 11]; $('[data-r-sc-ref]', el).textContent = t('rSurahChip', { name: name(93), ref: '93:' + (unlockAt % 11 + 1) }); $('[data-r-sc-ar]', el).textContent = ar; $('[data-r-sc-en]', el).textContent = '“' + en + '”'; $('[data-r-sc-pct]', el).textContent = Math.floor(unlockDone / 6236 * 100) + '%'; };
      fill(); await wait(1500, r);
      el.classList.add('is-open'); await wait(3000, r);
      const star = $('[data-r-sc-tamam]', el); star.classList.add('is-press'); await wait(450, r); star.classList.remove('is-press');
      unlockAt++; unlockDone++; el.classList.add('is-turn'); await wait(380, r); fill(); el.classList.remove('is-turn');
      await wait(3200, r);
    }
    async function playRecite(r) {
      const el = sceneEls.recite, D = window.UMMAHTI_RENDERS; showScene('recite'); if (!D) return;
      const count = $('[data-r-sc-count]', el), found = $('[data-r-sc-found]', el);
      el.classList.remove('is-found'); el.classList.add('is-live'); count.textContent = fmt(6236); found.textContent = '';
      const heard = words($('[data-r-sc-heard]', el), D.ayah.arabic);
      await wait(900, r);
      for (let k = 0; k < heard.length; k++) { heard[k].classList.add('is-in'); count.textContent = fmt(D.narrow[k].length); await wait(520, r); }
      el.classList.remove('is-live'); el.classList.add('is-found');
      found.textContent = '✓ ' + name(21) + ' 21:92 · ' + t('rSaved');
      await wait(3400, r);
    }
    async function playRead(r) {
      const el = sceneEls.read; showScene('read');
      const list = await surah(1).catch(() => null); if (!list || r !== run) return;
      const lines = $('[data-r-sc-lines]', el), tr = $('[data-r-sc-tr]', el), prog = $('[data-r-sc-prog]', el);
      lines.textContent = '';
      const spans = list.map(([ar], i) => { const s = document.createElement('span'); s.textContent = ar + ' ﴿' + (i + 1).toLocaleString('ar-EG') + '﴾ '; lines.append(s); return s; });
      for (let i = 0; i < spans.length; i++) {
        spans.forEach((s, j) => s.classList.toggle('is-now', j === i));
        tr.textContent = list[i][1]; prog.style.setProperty('--p', ((i + 1) / spans.length).toFixed(3));
        await wait(1700, r);
      }
      await wait(600, r);
    }
    const ORDER = ['guide', 'unlock', 'guide', 'recite', 'guide', 'read'];
    let step = -1;
    async function playNext(r) {
      step = (step + 1) % ORDER.length; const id = ORDER[step];
      if (id === 'guide') { showScene('guide'); await playGuide(r); }
      else if (id === 'unlock') await playUnlock(r);
      else if (id === 'recite') await playRecite(r);
      else await playRead(r);
    }
    async function loop(r) { try { while (r === run && !paused && visible) await playNext(r); } catch (_) {} }
    const restart = () => { const r = ++run; if (visible && !paused) loop(r); };
    pauseBtn.addEventListener('click', () => {
      paused = !paused; pauseBtn.textContent = paused ? '▶' : 'Ⅱ';
      pauseBtn.setAttribute('aria-label', t(paused ? 'resumeScreens' : 'pauseScreens'));
      if (paused) run++; else restart();
    });
    $('[data-r-gh-next]', root).addEventListener('click', () => { if (paused) { const r = ++run; playNext(r).catch(() => {}); } else restart(); });
    new IntersectionObserver(es => {
      const was = visible; visible = es[0].isIntersecting;
      if (visible && !was) { lastT = performance.now(); kickGlobe(); if (!paused) restart(); }
      if (!visible) run++;
    }, { threshold: .15 }).observe(root);
    document.addEventListener('visibilitychange', () => { if (document.hidden) run++; else if (visible && !paused) { kickGlobe(); restart(); } });
  }

  /* On dark themes the films blend by light alone (screen), so their dark ground disappears into the page. */
  function themeTone() {
    const set = () => {
      const m = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g);
      if (!m) return; const [r, g, b] = m.map(Number), lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      document.documentElement.classList.toggle('r-dark', lum < 0.35);
    };
    set(); new MutationObserver(() => requestAnimationFrame(set)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
  }

  function init() {
    themeTone();
    heroAyah();
    const gh = $('[data-r-guide-hero]'); if (gh) guideHero(gh);
    const u = $('[data-r-unlock]'); if (u) unlockDemo(u);
    const h = $('[data-r-hifz]'); if (h) hifzDemo(h);
    const w = $('[data-r-wall]'); if (w) wall(w);
    $$('.v-phone, .v-product-front').forEach(el => { el.classList.add('r-tiltable'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
