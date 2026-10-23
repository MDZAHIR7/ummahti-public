/* Ummahti V1.5 renders: live devices for Ayah on Unlock and Recite to add, and the channel wall.
   No network beyond this origin. Reduced motion and the page's motion toggle are respected. */
(() => {
  'use strict';
  const VERSION = '20261019r';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const I18N = window.UMMAHTI_V15_I18N || {};
  const t = (k, vars) => { let s = I18N[k] || k; if (vars) for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(b); return s; };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => reduced.matches || document.querySelector('[data-motion-toggle]')?.getAttribute('aria-pressed') === 'true';
  const touch = matchMedia('(hover: none) and (pointer: coarse)');
  const canvasDpr = () => Math.min(devicePixelRatio || 1, touch.matches ? 1.5 : 2);
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
      tag.onload = () => { if (ayat()[n]) ok(ayat()[n]); else { delete pending[n]; fail(new Error('missing')); } };
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
    let clockVisible = false, clockTimer = 0;
    const syncClock = () => { clearTimeout(clockTimer); clockTimer = 0; if (clockVisible && !document.hidden) { clock(); clockTimer = setTimeout(syncClock, 30000); } };
    new IntersectionObserver(entries => { clockVisible = entries[0].isIntersecting; syncClock(); }).observe(root);
    document.addEventListener('visibilitychange', syncClock);

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
    let flare = null, mode = 'recite', chosenState = 'learn', found = null, running = 0;
    let feedbackTimer = 0, focusFrame = 0;
    function cancelPending() {
      running++; clearTimeout(feedbackTimer); feedbackTimer = 0; cancelAnimationFrame(focusFrame); focusFrame = 0;
      $('.r-toast', root).classList.remove('is-on');
      $$('[data-r-save], [data-r-reference-submit], [data-r-pick-next]', root).forEach(button => button.disabled = false);
    }

    // ---- The ring: every ayah one dot, in order, a small gap between surahs.
    const ctx = canvas.getContext('2d'); let W = 0, H = 0, dpr = 1, pts = null, cx = 0, cy = 0, R = 0, rot = 0;
    const ROWS = 8;
    function layout() {
      const r = canvas.getBoundingClientRect(); dpr = canvasDpr();
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
    let candSet = null, last = 0, visible = false, ringFrame = 0;
    function draw(now) {
      ringFrame = 0; if (!visible || document.hidden) return;
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
      if (visible && !still() && !document.hidden) ringFrame = requestAnimationFrame(draw);
    }
    const kick = () => { if (!ringFrame && visible && !document.hidden) ringFrame = requestAnimationFrame(draw); };
    new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) { last = performance.now(); kick(); } else { cancelAnimationFrame(ringFrame); ringFrame = 0; } }).observe(root);
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(ringFrame); ringFrame = 0;
      if (document.hidden) { const savedFeedback = !!feedbackTimer; cancelPending(); if (savedFeedback) pane(mode === 'recite' ? 'idle' : mode); }
      else { kick(); if (mode === 'choose' && screen.dataset.step === 'choose') preview(); }
    });
    new ResizeObserver(() => { pts = null; kick(); }).observe(root);

    // ---- The record box.
    function upsertPassage(passage) {
      const kept = [];
      for (const item of record) {
        if (item.s !== passage.s || item.b < passage.a || item.a > passage.b) { kept.push(item); continue; }
        if (item.a < passage.a) kept.push({ ...item, b: passage.a - 1 });
        if (item.b > passage.b) kept.push({ ...item, a: passage.b + 1 });
      }
      kept.push(passage);
      kept.sort((a, b) => a.s - b.s || a.a - b.a);
      const merged = [];
      for (const item of kept) {
        const previous = merged[merged.length - 1];
        if (previous && previous.s === item.s && previous.st === item.st && previous.b + 1 >= item.a) previous.b = Math.max(previous.b, item.b);
        else merged.push({ ...item });
      }
      record.splice(0, record.length, ...merged);
    }
    function paintRecord() {
      const by = { mem: 0, learn: 0, rev: 0 }, surahs = new Set(); let n = 0;
      record.forEach(p => { by[p.st]++; surahs.add(p.s); n += p.b - p.a + 1; });
      $('[data-r-rec-mem]', root).textContent = fmt(by.mem); $('[data-r-rec-learn]', root).textContent = fmt(by.learn); $('[data-r-rec-rev]', root).textContent = fmt(by.rev);
      $('[data-r-rec-sum]', root).textContent = t('rRecordSum', { ayahs: fmt(n), surahs: fmt(surahs.size) });
    }
    paintRecord();
    const meter = (n, note) => { meterN.textContent = fmt(n); meterNote.textContent = note || ''; };
    meter(1, name(D.ayah.surah) + ' ' + D.ayah.ref);

    // ---- Panes.
    const panes = { idle: $('[data-pane=idle]', root), say: $('[data-pane=say]', root), found: $('[data-pane=found]', root), choose: $('[data-pane=choose]', root) };
    function pane(id) { Object.entries(panes).forEach(([key, el]) => { el.classList.toggle('is-on', key === id); el.hidden = key !== id; el.toggleAttribute('inert', key !== id); }); screen.dataset.step = id; }
    function setMode(m) {
      if (!['recite', 'say', 'choose'].includes(m)) return;
      cancelPending(); mode = m; found = null; candSet = null; status.textContent = ''; kick();
      $$('[data-r-mode]', root).forEach(b => { const on = b.dataset.rMode === m; b.setAttribute('aria-pressed', String(on)); });
      screen.dataset.mode = m;
      $('[data-r-sheet-title]', root).textContent = t(m === 'recite' ? 'rSheetRecite' : m === 'say' ? 'rSheetSay' : 'rSheetChoose');
      if (m === 'choose') { pane('choose'); preview(); }
      else if (m === 'say') { pane('say'); candSet = new Set(); meter(0, t('rHifzReferenceInfo')); kick(); }
      else {
        pane('idle'); candSet = new Set([starts[D.ayah.surah - 1] + D.ayah.n - 1]);
        $('[data-r-hifz-prompt]', root).textContent = D.ayah.arabic;
        $('[data-r-hifz-prompt-ref]', root).textContent = name(D.ayah.surah) + ' ' + D.ayah.ref;
        meter(1, t('rHifzPreviewKnown')); kick();
      }
    }
    $$('[data-r-mode]', root).forEach(b => b.addEventListener('click', () => setMode(b.dataset.rMode)));

    // This website walkthrough does not capture speech or play a stand-in recording.
    // The visitor explicitly reveals a known, corpus-derived example after reading it.
    function recite() {
      cancelPending(); candSet = new Set([starts[D.ayah.surah - 1] + D.ayah.n - 1]); kick();
      showFound(D.ayah.surah, D.ayah.n, D.ayah.n, D.ayah.arabic, null);
    }

    function parseReference(value) {
      const ascii = value.trim().replace(/[٠-٩۰-۹]/g, ch => String(ch.charCodeAt(0) - (ch <= '٩' ? 0x660 : 0x6f0)));
      const clean = ascii.replace(/^(?:surah|sura|سورة|سورۃ)\s+/i, '');
      const match = clean.match(/^(.+?)[\s:/]+(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?$/);
      if (!match) return { error: 'format' };
      const foldName = text => text.toLowerCase().normalize('NFKD').replace(/[̀-ًͯ-ٰٟۖ-ۭـ'’\s_-]/g, '').replace(/[ٱأإآ]/g, 'ا').replace(/ک/g, 'ك').replace(/ی/g, 'ي').replace(/^(?:surah|sura|سورة|سورۃ)/, '');
      const key = foldName(match[1]); let s = /^\d+$/.test(key) ? Number(key) : 0;
      if (!s) s = MOON.names.findIndex((label, i) => [label, MOON.namesArabic[i]].some(candidate => { const folded = foldName(candidate); return folded === key || folded.replace(/^(?:al|ال)/, '') === key; })) + 1;
      if (s < 1 || s > counts.length) return { error: 'format' };
      const a = Number(match[2]), b = Number(match[3] || match[2]);
      if (a < 1 || b < a || b > counts[s - 1]) return { error: 'range', max: counts[s - 1] };
      return { s, a, b };
    }
    async function submitReference(event) {
      event?.preventDefault();
      const input = $('[data-r-reference]', root), error = $('[data-r-reference-error]', root), button = $('[data-r-reference-submit]', root);
      cancelPending();
      const ref = parseReference(input.value); error.textContent = ''; input.removeAttribute('aria-invalid');
      if (ref.error) { error.textContent = t(ref.error === 'range' ? 'rHifzReferenceBounds' : 'rHifzReferenceHelp', { max: ref.max ? fmt(ref.max) : '' }); input.setAttribute('aria-invalid', 'true'); input.focus({ preventScroll: true }); return; }
      const request = running; button.disabled = true;
      const list = await surah(ref.s).catch(() => null); if (request !== running || mode !== 'say') return;
      button.disabled = false;
      if (!list) { error.textContent = t('rLoadError'); return; }
      candSet = new Set(Array.from({ length: ref.b - ref.a + 1 }, (_, i) => starts[ref.s - 1] + ref.a - 1 + i)); kick();
      meter(ref.b - ref.a + 1, t('rHifzPreviewSelected'));
      showFound(ref.s, ref.a, ref.b, list[ref.a - 1][0], list[ref.b - 1][0]);
    }
    $('[data-r-reference-form]', root).addEventListener('submit', submitReference);
    $('[data-r-reference]', root).addEventListener('input', event => { cancelPending(); event.target.removeAttribute('aria-invalid'); $('[data-r-reference-error]', root).textContent = ''; });
    $('[data-r-reference-example]', root).addEventListener('click', () => { $('[data-r-reference]', root).value = '67:1–10'; submitReference(); });
    function showFound(s, a, b, first, lastText) {
      found = { s, a, b }; pane('found');
      $('[data-r-sheet-title]', root).textContent = t('rHifzReferenceReview');
      $('[data-r-found-ref]', root).textContent = name(s) + ' ' + s + ':' + (a === b ? a : a + '–' + b);
      $('[data-r-first-n]', root).textContent = fmt(a); $('[data-r-first]', root).textContent = first;
      const lastRow = $('[data-r-last-row]', root); lastRow.hidden = a === b; $('.r-dots-v', root).hidden = a === b;
      if (lastText) { $('[data-r-last-n]', root).textContent = fmt(b); $('[data-r-last]', root).textContent = lastText; }
      status.textContent = t('rHifzPreviewReviewStatus', { ref: name(s) + ' ' + s + ':' + (a === b ? a : a + '–' + b) });
      const request = running; cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() => { focusFrame = 0; if (request === running) $('[data-r-state][aria-pressed=true]', root)?.focus({ preventScroll: true }); });
    }
    $$('[data-r-state]', root).forEach(b => b.addEventListener('click', () => { chosenState = b.dataset.rState; $$('[data-r-state]', root).forEach(x => x.setAttribute('aria-pressed', String(x === b))); }));
    $('[data-r-save]', root).addEventListener('click', event => {
      if (!found) return;
      const request = ++running, savedCount = found.b - found.a + 1; event.currentTarget.disabled = true;
      upsertPassage({ s: found.s, a: found.a, b: found.b, st: chosenState }); rebuildStates(); paintRecord();
      candSet = null; flare = { a: starts[found.s - 1] + found.a - 1, b: starts[found.s - 1] + found.b - 1, t: performance.now() }; kick();
      found = null; $('.r-toast', root).classList.add('is-on'); status.textContent = t('rHifzPreviewSaved');
      meter(savedCount, t('rHifzPreviewSaved'));
      feedbackTimer = setTimeout(() => { feedbackTimer = 0; if (request === running) { flare = null; setMode(mode); } }, 1300);
    });
    $('[data-r-review-example]', root).addEventListener('click', recite);
    $('[data-r-hifz-back]', root).addEventListener('click', () => setMode(mode));
    $$('[data-r-again]', root).forEach(b => b.addEventListener('click', () => setMode(mode)));

    // ---- Choose it yourself.
    const sel = $('[data-r-surah]', root), fromO = $('[data-r-from]', root), toO = $('[data-r-to]', root);
    MOON.names.forEach((n, i) => { const o = document.createElement('option'); o.value = i + 1; o.textContent = (i + 1) + '. ' + name(i + 1); sel.append(o); });
    sel.value = '55'; let from = 1, to = 13;
    function clamp() { const max = counts[sel.value - 1]; from = Math.max(1, Math.min(from, max)); to = Math.max(from, Math.min(to, max)); fromO.textContent = fmt(from); toO.textContent = fmt(to); }
    async function preview() {
      clamp(); const s = +sel.value; candSet = new Set(Array.from({ length: to - from + 1 }, (_, i) => starts[s - 1] + from - 1 + i)); kick();
      meter(to - from + 1, t('rMeterChoose'));
      const request = ++running, first = from;
      const list = await surah(s).catch(() => null); if (request !== running || mode !== 'choose') return;
      if (!list) { status.textContent = t('rLoadError'); return; }
      $('[data-r-pick-first]', root).textContent = list[first - 1][0];
    }
    sel.addEventListener('change', () => { from = 1; to = Math.min(counts[sel.value - 1], 10); preview(); });
    $$('[data-r-step]', root).forEach(b => b.addEventListener('click', () => { const [which, d] = b.dataset.rStep.split(':'); if (which === 'from') from += +d; else to += +d; preview(); }));
    $('[data-r-pick-next]', root).addEventListener('click', async () => {
      const request = ++running, s = +sel.value, first = from, last = to, button = $('[data-r-pick-next]', root); button.disabled = true;
      const list = await surah(s).catch(() => null); if (request !== running || mode !== 'choose') return;
      button.disabled = false; if (!list) { status.textContent = t('rLoadError'); return; }
      showFound(s, first, last, list[first - 1][0], list[last - 1][0]);
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
    let on = false, last = 0, lastY = scrollY, boost = 0, laneFrame = 0;
    function frame(now) {
      laneFrame = 0;
      const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
      const dy = scrollY - lastY; lastY = scrollY; boost = boost * .9 + Math.abs(dy) * .6;
      state.forEach(s => {
        const half = s.ul.scrollWidth / 2, speed = s.hover ? 0 : (22 + boost) * (document.dir === 'rtl' ? -1 : 1);
        s.x += s.dir * speed * dt; if (s.x <= -half) s.x += half; if (s.x > 0) s.x -= half;
        s.ul.style.transform = 'translate3d(' + s.x.toFixed(1) + 'px,0,0)';
      });
      if (on && !still()) laneFrame = requestAnimationFrame(frame);
    }
    new IntersectionObserver(es => { const was = on; on = es[0].isIntersecting; if (on && !was && !laneFrame) { last = performance.now(); laneFrame = requestAnimationFrame(frame); } }).observe(root);
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

  /* One real phone: a short preview, direct feature choices, then local interaction.
     The shell moves between slots; the screen and its state are never cloned. */
  function guideHero(root) {
    const G = window.UMMAHTI_GUIDE; if (!G) return;
    const phone = $('.v-product-front', root), home = phone.parentElement;
    const controls = $('[data-r-preview-controls]', root);
    const dock = $('[data-r-phone-dock]'), dockSection = $('[data-r-proof-dock]');
    const dockControls = $('[data-r-dock-controls]');
    const screen = $('.r-gh-screen', phone), input = $('[data-r-gh-typed]', phone), form = $('[data-r-gh-form]', phone);
    const card = $('[data-r-gh-card]', phone), flyers = $('.r-gh-flyers', phone), canvas = $('.r-gh-globe', phone);
    const status = $('[data-r-gh-status]', phone), announcement = $('[data-r-preview-status]', controls);
    const matchesBox = $('[data-r-gh-matches]', phone), pauseButtons = $$('[data-r-gh-pause]');
    const choiceButtons = $$('[data-r-scene]'), scenes = Object.fromEntries($$('[data-scene]', phone).map(el => [el.dataset.scene, el]));
    const byId = Object.fromEntries(G.topics.map(x => [x.id, x]));
    const questions = [['rGhQ1', 'anxiety_and_worry'], ['rGhQ2', 'forgiveness_and_repentance'], ['rGhQ3', 'waking_for_fajr'], ['rGhQ4', 'feeling_behind_in_life']].filter(([, id]) => byId[id]);
    const captions = { guide: ['Ummahti Guide', 'rGuideCaption'], read: [t('rSceneRead'), 'rSceneReadCap'], unlock: ['Ayah on Unlock', 'rSceneUnlockCap'], recite: ['My Hifz', 'rSceneReciteCap'] };
    const order = ['guide', 'read', 'unlock', 'recite'];
    const fold = value => value.toLowerCase().normalize('NFKD').replace(/[̀-ًͯ-ٰٟ]/g, '');
    const haystack = G.topics.map(tp => fold([tp.t, tp.s, tp.e, ...tp.w].join(' ')));
    let run = 0, questionAt = -1, current = 'guide', topic = byId[questions[0]?.[1]] || G.topics[0];
    let paused = false, manual = false, visible = false, docked = false, timer = 0, rejectWait = null, userQuery = false;
    let globeFrame = 0, lastFrame = 0, rotation = 0, speed = .2, handoff = null;
    const searchLight = window.UmmahtiFieldLight.create(form, { still, visible: () => current === 'guide' && window.UmmahtiFieldLight.inViewport(form) });
    let unlockAt = 0, unlockDone = 0, readAt = 0, readList = [];
    const canAuto = () => visible && !document.hidden && !manual && !paused && !still() && !navigator.connection?.saveData;
    function stopSearchLight(retain = false) {
      searchLight.stop({ retain });
    }
    const stop = (preserveLight = false) => {
      run++; clearTimeout(timer); timer = 0; if (!preserveLight) stopSearchLight();
      if (rejectWait) { const reject = rejectWait; rejectWait = null; reject(new Error('cancelled')); }
      speed = .2; screen.classList.remove('is-searching'); form.classList.remove('is-working'); scenes.recite.classList.remove('is-live');
    };
    const wait = (ms, id) => new Promise((resolve, reject) => {
      rejectWait = reject;
      timer = setTimeout(() => { timer = 0; rejectWait = null; id === run ? resolve() : reject(new Error('cancelled')); }, ms);
    });
    const check = id => { if (id !== run) throw new Error('cancelled'); };
    const say = text => { announcement.textContent = text; };
    function updatePause() {
      pauseButtons.forEach(button => {
        button.hidden = still(); button.textContent = paused || manual ? '▶' : 'Ⅱ';
        button.setAttribute('aria-label', t(paused || manual ? 'resumeScreens' : 'pauseScreens'));
        button.setAttribute('aria-pressed', String(paused || manual));
      });
    }
    function takeControl(preserveLight = false) { stop(preserveLight); manual = true; paused = true; updatePause(); syncGlobe(); }
    function showScene(id) {
      current = id;
      Object.entries(scenes).forEach(([key, el]) => { el.classList.toggle('is-on', key === id); if (key !== id) el.classList.remove('is-live'); el.toggleAttribute('inert', key !== id); el.setAttribute('aria-hidden', String(key !== id)); });
      choiceButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.rScene === id)));
      const label = $('[data-r-sc-name]', controls); label.firstChild.textContent = captions[id][0];
      $('[data-r-sc-cap]', controls).textContent = t(captions[id][1]);
      const copy = { guide: ['guideTitle', 'guideBody', 'guideScope', 'rHeroTryGuide'], read: ['rSceneRead', 'readWayBody', 'translationCount', 'recitation'], unlock: ['unlockTitle', 'unlockBody', 'placeSafe', 'moments'], recite: ['hifzTitle', 'hifzBody', 'speechLimit', 'rSheetRecite'] }[id];
      // Preserve the generator's reviewed emphasis and line breaks. Runtime
      // translations are plain text; queries never become heading markup.
      const heading = $('[data-r-dock-heading="' + id + '"]');
      $('[data-r-dock-title]').replaceChildren(heading.content.cloneNode(true));
      $('[data-r-dock-body]').textContent = t(copy[1]); $('[data-r-dock-scope]').textContent = t(copy[2]); $('[data-r-full-guide]').textContent = t(copy[3]) + ' ↗';
      syncGlobe();
    }
    // A single guarded drawing loop; only the visible, active source-finding state runs it.
    const points = Array.from({ length: 140 }, (_, i) => { const y = 1 - i / 139 * 2, r = Math.sqrt(1 - y * y), theta = i * 2.399963; return [Math.cos(theta) * r, y, Math.sin(theta) * r]; });
    const ctx = canvas.getContext('2d');
    function drawGlobe(now) {
      globeFrame = 0; if (!ctx) return;
      const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
      const dpr = canvasDpr(), pw = Math.round(w * dpr), ph = Math.round(h * dpr);
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      const dt = lastFrame ? Math.min(.05, (now - lastFrame) / 1000) : 0; lastFrame = now;
      if (!still() && !paused) rotation += dt * speed;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const radius = Math.min(w, h) * .4, cx = w / 2, cy = h / 2, c = Math.cos(rotation), sn = Math.sin(rotation);
      ctx.strokeStyle = 'rgba(212,175,55,.22)'; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.ellipse(cx, cy, radius, radius * .32, -.2, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, 7); ctx.stroke();
      for (const [x, y, z] of points) { const px = x * c + z * sn, depth = (-x * sn + z * c + 1) / 2; ctx.fillStyle = 'rgba(212,175,55,' + (.16 + depth * .65) + ')'; ctx.beginPath(); ctx.arc(cx + px * radius, cy + y * radius, .5 + depth, 0, 7); ctx.fill(); }
      if (visible && !document.hidden && current === 'guide' && !screen.classList.contains('is-found') && !still() && !paused) globeFrame = requestAnimationFrame(drawGlobe);
    }
    function syncGlobe() { cancelAnimationFrame(globeFrame); globeFrame = 0; lastFrame = 0; if (visible && !document.hidden && current === 'guide') globeFrame = requestAnimationFrame(drawGlobe); }
    function acknowledgeSearch(kind = 'matched') {
      searchLight.activate(kind);
    }
    function working(on) { screen.classList.toggle('is-searching', on); form.classList.toggle('is-working', on); speed = on ? 1.8 : .2; if (on) acknowledgeSearch(); }
    async function fillGuide(tp, id = run) {
      const list = await surah(tp.q[0][0]).catch(() => null); check(id); topic = tp;
      const [s, a] = tp.q[0], verse = list?.[a - 1];
      $('[data-r-gh-topic]', phone).textContent = tp.t; $('[data-r-gh-question]', phone).textContent = tp.s;
      $('[data-r-gh-ar]', phone).textContent = verse ? verse[0] : '';
      $('[data-r-gh-en]', phone).textContent = verse ? verse[1] : t('rLoadError');
      $('[data-r-gh-ref]', phone).textContent = name(s) + ' ' + s + ':' + a;
      const chips = $('[data-r-gh-chips]', phone); chips.replaceChildren();
      const chip = text => { const el = document.createElement('span'); el.textContent = text; chips.append(el); };
      if (tp.q.length > 1) chip(t('rGuideMoreAyat', { n: fmt(tp.q.length - 1) }));
      tp.h.slice(0, 1).forEach(i => { if (G.cites[i]) chip(G.cites[i].c + ' ' + G.cites[i].r); });
      if (tp.d?.length) chip(t('rGuideDua'));
      card.scrollTop = 0; card.classList.add('is-on'); screen.classList.add('is-found'); working(false); syncGlobe();
      status.textContent = t('rGuideFound', { n: fmt(tp.q.length + tp.h.length) });
      return tp;
    }
    async function previewGuide(id) {
      userQuery = false;
      showScene('guide'); questionAt = (questionAt + 1) % questions.length;
      const [key, tpId] = questions[questionAt]; topic = byId[tpId];
      card.classList.remove('is-on'); screen.classList.remove('is-found'); flyers.replaceChildren(); matchesBox.hidden = true; input.value = ''; status.textContent = '';
      syncGlobe(); await wait(220, id);
      acknowledgeSearch('typing');
      for (const ch of t(key)) { input.value += ch; await wait(24, id); }
      working(true); status.textContent = t('rGuideSearching');
      for (const [s, a] of topic.q.slice(0, 3)) { const el = document.createElement('span'); el.textContent = name(s) + ' ' + s + ':' + a; el.style.setProperty('--fx', '90%'); el.style.setProperty('--fy', '-140%'); flyers.append(el); await wait(200, id); }
      await fillGuide(topic, id); await wait(3600, id);
    }
    async function fillUnlock(id = run) {
      const el = scenes.unlock, now = new Date(), list = await surah(93).catch(() => null); check(id); if (!list) return;
      $('[data-r-sc-time]', el).textContent = now.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', hour12: false });
      $('[data-r-sc-date]', el).textContent = now.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });
      const [ar, en] = list[unlockAt % list.length];
      $('[data-r-sc-ref]', el).textContent = t('rSurahChip', { name: name(93), ref: '93:' + (unlockAt % list.length + 1) });
      $('[data-r-sc-ar]', el).textContent = ar; $('[data-r-sc-en]', el).textContent = '“' + en + '”';
      $('[data-r-sc-pct]', el).textContent = Math.floor(unlockDone / 6236 * 100) + '%';
    }
    async function previewUnlock(id) {
      showScene('unlock'); scenes.unlock.classList.remove('is-open'); await fillUnlock(id); await wait(650, id);
      scenes.unlock.classList.add('is-open'); await wait(2200, id);
      const done = $('[data-r-sc-tamam]', phone); done.classList.add('is-press'); await wait(260, id); done.classList.remove('is-press');
      unlockAt++; unlockDone++; await fillUnlock(id); await wait(2200, id);
    }
    async function previewRecite(id, settled = false) {
      showScene('recite'); const D = window.UMMAHTI_RENDERS; if (!D) return;
      const el = scenes.recite, count = $('[data-r-sc-count]', el), found = $('[data-r-sc-found]', el);
      const heard = words($('[data-r-sc-heard]', el), D.ayah.arabic); found.textContent = ''; count.textContent = fmt(6236);
      el.classList.toggle('is-live', !settled); el.classList.remove('is-found');
      for (let i = 0; i < heard.length; i++) { if (!settled) await wait(270, id); heard[i].classList.add('is-in'); count.textContent = fmt(D.narrow[i].length); }
      el.classList.remove('is-live'); el.classList.add('is-found'); found.textContent = '✓ ' + name(21) + ' 21:92 · ' + t('rSaved');
      if (!settled) await wait(3000, id);
    }
    function selectRead(index) {
      readAt = index; const spans = $$('[data-read-ayah]', phone);
      spans.forEach((el, i) => { el.classList.toggle('is-now', i === index); el.setAttribute('aria-pressed', String(i === index)); });
      $('[data-r-sc-tr]', phone).textContent = readList[index]?.[1] || '';
      $('[data-r-sc-prog]', phone).style.setProperty('--p', ((index + 1) / readList.length).toFixed(3));
    }
    async function fillRead(id = run) {
      const list = await surah(1).catch(() => null); check(id); if (!list) return; readList = list;
      const lines = $('[data-r-sc-lines]', phone); lines.replaceChildren();
      list.forEach(([ar], i) => { const button = document.createElement('button'); button.type = 'button'; button.dataset.readAyah = i; button.textContent = ar + ' ﴿' + (i + 1).toLocaleString('ar-EG') + '﴾ '; button.addEventListener('click', () => { takeControl(); selectRead(i); }); lines.append(button); });
      selectRead(readAt % list.length);
    }
    async function previewRead(id) { showScene('read'); await fillRead(id); for (let i = 0; i < 3; i++) { selectRead(i); await wait(1900, id); } }
    async function settled(id) {
      if (current === 'guide') { if (!userQuery) input.value = topic.s; await fillGuide(topic, id); }
      else if (current === 'unlock') { await fillUnlock(id); scenes.unlock.classList.add('is-open'); }
      else if (current === 'recite') await previewRecite(id, true);
      else await fillRead(id);
    }
    async function loop(id) {
      try { while (id === run && canAuto()) { const index = order.indexOf(current); if (current === 'guide') await previewGuide(id); else if (current === 'unlock') await previewUnlock(id); else if (current === 'recite') await previewRecite(id); else await previewRead(id); check(id); showScene(order[(index + 1) % order.length]); } } catch (_) {}
    }
    function start() { stop(); updatePause(); if (canAuto()) loop(run); else if (!manual && !paused) settled(run).catch(() => {}); }
    choiceButtons.forEach(button => button.addEventListener('click', () => {
      takeControl(); movePhone(!!button.closest('[data-r-proof-dock]'), true, true);
      showScene(button.dataset.rScene); settled(run).catch(() => {}); say(captions[current][0]);
    }));
    $$('[data-r-gh-next]').forEach(button => button.addEventListener('click', () => { takeControl(); showScene(order[(order.indexOf(current) + 1) % order.length]); settled(run).catch(() => {}); say(captions[current][0]); }));
    pauseButtons.forEach(button => button.addEventListener('click', () => { if (paused || manual) { manual = false; paused = false; start(); } else { takeControl(); settled(run).catch(() => {}); } }));
    function findTopics() {
      const query = fold(input.value.trim()), terms = query.split(/\s+/).filter(x => x.length > 1);
      if (!terms.length) return [];
      return G.topics.map((tp, i) => ({ tp, score: terms.every(word => haystack[i].includes(word)) ? terms.reduce((sum, word) => sum + (fold(tp.t).includes(word) ? 8 : 1), 0) : 0 })).filter(x => x.score).sort((a, b) => b.score - a.score).map(x => x.tp);
    }
    async function acceptGuide(tp) {
      const request = run;
      working(true);
      try {
        const accepted = await fillGuide(tp, request);
        if (request === run) say(accepted.t);
      } catch (error) {
        if (request !== run || error?.message === 'cancelled') return;
        working(false); say(t('rLoadError'));
      }
    }
    function showMatches() {
      const matches = findTopics(); matchesBox.replaceChildren();
      matches.slice(0, 3).forEach(tp => { const button = document.createElement('button'); button.type = 'button'; button.textContent = tp.t; button.addEventListener('click', () => { takeControl(); matchesBox.hidden = true; acceptGuide(tp); }); matchesBox.append(button); });
      matchesBox.hidden = !matches.length;
      const message = !input.value.trim() ? '' : matches.length ? t('guideMatches', { n: fmt(matches.length) }) : t('guideNoMatch');
      say(message); return matches;
    }
    input.addEventListener('focus', () => { if (handoff?.isRestoringFocus()) return; takeControl(); acknowledgeSearch('focus'); });
    input.addEventListener('input', () => { userQuery = true; takeControl(true); card.classList.remove('is-on'); screen.classList.remove('is-found'); const matches = showMatches(); if (input.value.trim() && matches.length) acknowledgeSearch('typing'); else stopSearchLight(); });
    input.addEventListener('blur', event => { if (!form.contains(event.relatedTarget)) stopSearchLight(['matched', 'settled'].includes(form.dataset.light)); });
    form.addEventListener('submit', event => { event.preventDefault(); takeControl(); const matches = findTopics(); matchesBox.hidden = true; if (!matches.length) { showMatches(); return; } acceptGuide(matches[0]); });
    function openGuide() { takeControl(); document.dispatchEvent(new CustomEvent('ummahti:guide-open', { detail: { topicId: topic.id, query: input.value } })); }
    function openSection(selector) {
      const destination = document.querySelector(selector); if (!destination) return;
      takeControl();
      if (location.hash !== selector) history.pushState(null, '', selector);
      destination.setAttribute('tabindex', '-1'); destination.focus({ preventScroll: true });
      destination.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'start' });
    }
    // Resolve these destinations before native fragment focus can interrupt the
    // long scroll while the retained phone moves between its two hosts.
    $$('a[href="#reciters"]', phone).forEach(link => link.addEventListener('click', event => {
      if (event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); openSection('#reciters');
    }));
    $('[data-r-gh-open]', phone).addEventListener('click', openGuide);
    $('[data-r-full-guide]')?.addEventListener('click', () => { if (current === 'guide') openGuide(); else openSection({ read: '#reciters', unlock: '#unlock', recite: '#my-hifz' }[current]); });
    $('[data-r-sc-unlock]', phone).addEventListener('click', () => { takeControl(); scenes.unlock.classList.add('is-open'); say(t('rUnlocked')); });
    $('[data-r-sc-tamam]', phone).addEventListener('click', () => { takeControl(); unlockAt++; unlockDone++; fillUnlock(run).then(() => say(t('advancedResult'))).catch(() => {}); });
    $('[data-r-sc-later]', phone).addEventListener('click', () => { takeControl(); scenes.unlock.classList.remove('is-open'); say(t('laterResult')); });
    $('[data-r-sc-replay]', phone).addEventListener('click', () => { takeControl(); if (still()) settled(run).catch(() => {}); else previewRecite(run).catch(() => {}); });
    // Both control groups stay in their layout. One controller owns the phone.
    const marker = document.createElement('div'); marker.className = 'v-product-front r-home-marker'; marker.setAttribute('aria-hidden', 'true'); home.append(marker);
    const sizeSlot = el => { const width = el.getBoundingClientRect().width; if (width) el.style.height = ((width - 14) * 910 / 420 + 14) + 'px'; };
    const slots = new ResizeObserver(entries => entries.forEach(entry => sizeSlot(entry.target)));
    slots.observe(marker); slots.observe(dock); sizeSlot(marker); sizeSlot(dock);
    handoff = window.UmmahtiPhoneHandoff.create({
      phone, homeSlot: marker, homeHost: home, dockSlot: dock, hero: root, still,
      onHostChange(nextHost) {
        const wasDocked = docked; docked = nextHost === 'dock';
        root.classList.toggle('is-docked', docked); dockSection.classList.toggle('has-phone', docked);
        if (docked && !wasDocked && !manual) {
          takeControl(); settled(run).catch(() => {});
        }
        syncGlobe();
      }
    });
    function movePhone(toDock, animate = true, hold = false) {
      handoff?.move(toDock ? 'dock' : 'home', { animate, holdHome: hold && !toDock, holdDock: hold && toDock });
    }
    $('[data-r-take-control]', controls).addEventListener('click', () => {
      takeControl(); settled(run).catch(() => {}); movePhone(true, true, true);
      dock.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'start' });
    });
    $('[data-r-return-preview]')?.addEventListener('click', () => {
      manual = false; paused = false; movePhone(false, true, true);
      root.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'start' }); start();
    });
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting; phone.classList.toggle('r-is-visible', visible);
      if (!visible) { if (!handoff.isMoving()) stop(); cancelAnimationFrame(globeFrame); globeFrame = 0; }
      else { syncGlobe(); if (canAuto()) start(); }
    }, { threshold: .15 }).observe(phone);
    // The lower screen can remain visible after its search field has left the
    // viewport. Its flowing rim belongs to the control's actual visibility.
    const fieldVisibility = new IntersectionObserver(entries => {
      const accepted = ['matched', 'settled'].includes(form.dataset.light);
      if (!entries[0].isIntersecting) stopSearchLight(accepted);
      else if (current === 'guide' && form.contains(document.activeElement) && !accepted) {
        if (screen.classList.contains('is-found')) stopSearchLight(true);
        else if (!input.value.trim()) acknowledgeSearch('focus');
        else if (findTopics().length) acknowledgeSearch('typing');
      }
    });
    fieldVisibility.observe(form);
    document.addEventListener('visibilitychange', () => { stop(); syncGlobe(); if (!document.hidden) start(); });
    const changeMotion = () => {
      stop(); if (still()) { manual = true; paused = true; }
      handoff.reconcile({ animate: false }); updatePause(); settled(run).catch(() => {}); syncGlobe();
    };
    reduced.addEventListener('change', changeMotion);
    document.querySelector('[data-motion-toggle]')?.addEventListener('click', () => queueMicrotask(changeMotion));
    if (still()) { manual = true; paused = true; }
    showScene('guide'); updatePause(); settled(run).catch(() => {});
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


  /* ---------------- Films without a box: their dark ground is keyed out on the GPU ----------------
     The films were made on near-black. On a dark theme each frame is drawn to a WebGL canvas whose
     alpha follows brightness, so the crescent and the app float on the page's own sky. (CSS blending
     cannot reach the fixed sky behind the page.) Light themes and missing WebGL keep the plain film. */
  function keyFilms() {
    const VS = 'attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
    const FS = 'precision mediump float;varying vec2 v;uniform sampler2D t;uniform vec2 k;void main(){vec4 c=texture2D(t,v);float l=max(c.r,max(c.g,c.b));float a=smoothstep(k.x,k.y,l);gl_FragColor=vec4(c.rgb*a,a);}';
    $$('[data-logo-film]').forEach(film => {
      const video = $('video', film), poster = $('img', film), box = video && video.parentElement;
      if (!video || !box) return;
      const canvas = document.createElement('canvas'); canvas.className = 'r-keyed'; canvas.setAttribute('aria-hidden', 'true');
      const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
      if (!gl) return;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
      const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
      gl.useProgram(prog);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(p => gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform2f(gl.getUniformLocation(prog, 'k'), .045, .16);
      gl.clearColor(0, 0, 0, 0);
      box.append(canvas); film.classList.add('r-keyable');
      let raf = 0;
      const draw = src => {
        const w = src.videoWidth || src.naturalWidth, h = src.videoHeight || src.naturalHeight; if (!w || !h) return;
        if (canvas.width !== w) { canvas.width = w; canvas.height = h; }
        gl.viewport(0, 0, w, h); gl.clear(gl.COLOR_BUFFER_BIT);
        try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); } catch (_) { film.classList.remove('r-keyable'); return; }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      };
      const loop = () => { if (video.paused || video.ended) { raf = 0; return; } draw(video); raf = requestAnimationFrame(loop); };
      video.addEventListener('playing', () => { if (!raf) raf = requestAnimationFrame(loop); });
      video.addEventListener('seeked', () => draw(video));
      video.addEventListener('pause', () => draw(video));
      const showPoster = () => { if (poster && poster.complete && (video.paused && !video.currentTime)) draw(poster); };
      if (poster) { if (poster.complete) showPoster(); else poster.addEventListener('load', showPoster, { once: true }); }
      // Sound: the film's own controls are hidden with the video, so the page offers the choice.
      if (film.classList.contains('v-story-film')) {
        video.removeAttribute('controls');
        const cap = $('figcaption', film), b = document.createElement('button');
        b.type = 'button'; b.className = 'v-quiet r-sound'; b.setAttribute('aria-pressed', 'false');
        const label = () => { b.textContent = video.muted ? t('rSoundOn') : t('rSoundOff'); b.setAttribute('aria-pressed', String(!video.muted)); };
        b.addEventListener('click', () => { video.muted = !video.muted; if (!video.muted && video.paused) video.play().catch(() => {}); label(); });
        label(); if (cap) cap.append(b);
      }
    });
  }

  function init() {
    themeTone();
    keyFilms();
    heroAyah();
    const gh = $('[data-r-guide-hero]'); if (gh) guideHero(gh);
    const u = $('[data-r-unlock]'); if (u) unlockDemo(u);
    const h = $('[data-r-hifz]'); if (h) hifzDemo(h);
    const w = $('[data-r-wall]'); if (w) wall(w);
    $$('.v-phone, .v-product-front').forEach(el => { el.classList.add('r-tiltable'); });
    const deviceVisibility = new IntersectionObserver(entries => entries.forEach(entry => entry.target.classList.toggle('r-is-visible', entry.isIntersecting)));
    $$('.r-device').forEach(el => deviceVisibility.observe(el));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
