/* ==========================================================================
   Ummahti Quran — ummahtiofficial.com

   One rAF loop drives everything that depends on scroll. It reads layout
   first and writes styles second, never interleaved, so a frame costs one
   reflow rather than one per element.

   The page has a light source: the crescent fixed in the top-right of the
   viewport. Every raised surface asks how close it is to that light and
   sets --lit accordingly, which is what gives the surfaces their rim.
   Nothing here is required for the page to be readable — with the script
   removed, every section renders in its final state.
   ========================================================================== */

(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.remove('no-js');

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(hover: none)');
  const narrow = window.matchMedia('(max-width: 760px)');

  /* ---------------------------------------------------------------- scroll */

  let lenis = null;

  function startLenis() {
    if (lenis || reduced.matches || typeof window.Lenis !== 'function') return;
    lenis = new window.Lenis({
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,          // let phones keep their native momentum
      touchMultiplier: 1.6,
      autoRaf: false,            // the loop below is the only rAF on the page
    });
  }

  function stopLenis() {
    if (!lenis) return;
    lenis.destroy();
    lenis = null;
  }

  startLenis();
  reduced.addEventListener('change', () => (reduced.matches ? stopLenis() : startLenis()));

  // Anchor links have to go through whichever engine currently owns scroll.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: -70 });
    else target.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

  /* --------------------------------------------------------------- reveals */

  const revealables = document.querySelectorAll('[data-reveal]');

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add('is-in'));
  }

  /* Headline word stagger. The words carry the visible text and the heading
     carries the accessible name, so nothing is duplicated — a hidden second
     copy would be read once but selected and crawled twice. */
  document.querySelectorAll('[data-split]').forEach((el) => {
    const text = el.textContent.trim();
    if (!text) return;

    el.setAttribute('aria-label', text);

    const frag = document.createDocumentFragment();
    text.split(/\s+/).forEach((word, i) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.setAttribute('aria-hidden', 'true');
      span.style.setProperty('--delay', `${i * 55}ms`);
      span.textContent = word;
      frag.append(span, document.createTextNode(' '));
    });

    el.textContent = '';
    el.append(frag);
  });

  /* ----------------------------------------------------------------- tilt */

  if (!coarse.matches && !reduced.matches) {
    document.querySelectorAll('[data-tilt]').forEach((device) => {
      const stage = device.closest('.stage') || device.parentElement;

      stage.addEventListener('pointermove', (e) => {
        const r = stage.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        device.style.setProperty('--ry', `${x * 9}deg`);
        device.style.setProperty('--rx', `${y * -7}deg`);
      });

      const rest = () => {
        device.style.setProperty('--ry', '0deg');
        device.style.setProperty('--rx', '0deg');
      };
      stage.addEventListener('pointerleave', rest);
      window.addEventListener('blur', rest);
    });
  }

  /* --------------------------------------------------------- search demo */

  /* Every case here is a documented capability of the search engine, and
     every name is the app's own spelling from quran_data.json. */
  const CASES = [
    { q: 'mal qariah', hit: 'Al-Qaari’a · Surah 101', sub: 'The Calamity',
      why: 'Latin letters, spelled by ear. No Arabic keyboard needed.' },
    { q: 'merfy', hit: 'The mercy verses', sub: 'In whichever translation you have',
      why: 'One letter wrong, and it still retrieves.' },
    { q: 'yaseen', hit: 'Yaseen · Surah 36', sub: 'Ya-Sin, Yasin, Yaseen',
      why: 'Spellings of one Arabic sound collapse together.' },
    { q: '2:255', hit: 'Al-Baqara 255', sub: 'The Cow',
      why: 'A plain verse reference.' },
    { q: 'ayat al kursi', hit: 'Al-Baqara 255', sub: 'The Throne Verse',
      why: 'The name people use, not the number.' },
    { q: 'sadaqah', hit: 'Charity', sub: 'Verses on spending in the way of Allah',
      why: 'A topic, under any of its names — zakat, giving, صدقة.' },
    { q: 'الرحمن', ar: true, hit: 'Ar-Rahmaan · Surah 55', sub: 'The Beneficent',
      why: 'Arabic, with or without the harakat.' },
  ];

  const demo = document.querySelector('[data-search-demo]');
  const cases = document.querySelector('[data-search-cases]');

  if (demo && cases && !reduced.matches) {
    demo.hidden = false;
    cases.hidden = true;

    const qEl = demo.querySelector('[data-q]');
    const row = demo.querySelector('[data-hit-row]');
    const hitEl = demo.querySelector('[data-hit]');
    const subEl = demo.querySelector('[data-hitsub]');
    const whyEl = demo.querySelector('[data-why]');

    let i = 0;
    let timer = null;
    let onScreen = false;

    const wait = (ms) => new Promise((res) => { timer = setTimeout(res, ms); });

    async function play() {
      while (onScreen) {
        const c = CASES[i % CASES.length];

        qEl.textContent = '';
        if (c.ar) { qEl.lang = 'ar'; qEl.dir = 'rtl'; }
        else { qEl.removeAttribute('lang'); qEl.removeAttribute('dir'); }
        row.classList.remove('is-shown');
        whyEl.classList.remove('is-shown');
        await wait(320);
        if (!onScreen) return;

        for (const ch of [...c.q]) {
          qEl.textContent += ch;
          await wait(58 + Math.random() * 45);
          if (!onScreen) return;
        }

        await wait(340);
        hitEl.textContent = c.hit;
        subEl.textContent = c.sub;
        row.classList.add('is-shown');
        await wait(260);
        whyEl.textContent = c.why;
        whyEl.classList.add('is-shown');

        await wait(2600);
        if (!onScreen) return;
        i++;
      }
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const was = onScreen;
          onScreen = entry.isIntersecting;
          if (onScreen && !was) play();
          if (!onScreen) clearTimeout(timer);
        }
      }, { threshold: 0.25 }).observe(demo);
    } else {
      onScreen = true;
      play();
    }
  }

  /* ------------------------------------------------------- the scroll loop */

  const header = document.querySelector('.site-header');
  const ambient = document.querySelector('.sky-ambient');
  const moon = document.querySelector('.sky-moon');
  const halo = document.querySelector('.sky-halo');
  const track = document.querySelector('.modes-track');
  const rail = document.querySelector('.modes-rail');
  const bar = document.querySelector('.modes-progress i');

  // Only surfaces currently on screen pay for the lighting calculation.
  const lit = new Set();
  if ('IntersectionObserver' in window) {
    const litIO = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) lit.add(entry.target);
        else { lit.delete(entry.target); entry.target.style.removeProperty('--lit'); }
      }
    }, { rootMargin: '15% 0px 15% 0px' });
    document.querySelectorAll('.panel, .device, .close-panel').forEach((el) => litIO.observe(el));
  }

  let vw = 0, vh = 0, diag = 1, railOverflow = 0, trackTop = 0, trackRange = 1;
  let pinned = false;

  function measure() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    diag = Math.hypot(vw, vh);

    pinned = !narrow.matches && !reduced.matches;

    if (track && rail) {
      railOverflow = Math.max(0, rail.scrollWidth - vw);
      // Pinning the viewport to move the rail 40px is worse than not pinning
      // at all, so on very wide screens the run simply lays itself out.
      if (railOverflow < 120) pinned = false;

      if (pinned) {
        track.style.height = `${vh + railOverflow}px`;
        const r = track.getBoundingClientRect();
        trackTop = r.top + window.scrollY;
        trackRange = Math.max(1, track.offsetHeight - vh);
      } else {
        track.style.height = '';
        rail.style.removeProperty('--rail-x');
        railOverflow = 0;
      }
      track.classList.toggle('is-unpinned', !pinned);
    }
  }

  const prev = new WeakMap();

  function frame(time) {
    if (lenis) lenis.raf(time);

    const y = window.scrollY || window.pageYOffset;

    /* ---- read ---- */
    const boxes = [];
    for (const el of lit) boxes.push([el, el.getBoundingClientRect()]);

    const docRange = Math.max(1, document.body.scrollHeight - vh);
    const progress = Math.min(1, Math.max(0, y / docRange));

    let railP = 0;
    if (pinned && track) {
      railP = Math.min(1, Math.max(0, (y - trackTop) / trackRange));
    }

    /* ---- write ---- */
    if (header) header.classList.toggle('is-stuck', y > 12);

    root.style.setProperty('--lit', progress.toFixed(3));

    if (ambient) ambient.style.setProperty('--sky-y', `${y * -0.05}px`);
    const drift = `${y * -0.11}px`;
    if (moon) moon.style.setProperty('--sky-drift', drift);
    if (halo) halo.style.setProperty('--sky-drift', drift);

    if (pinned && rail) {
      rail.style.setProperty('--rail-x', `${(railP * railOverflow).toFixed(1)}px`);
      if (bar) bar.style.setProperty('--rail-p', railP.toFixed(3));
    }

    // The light sits where .sky-moon sits: high and to the right.
    const lx = vw * 0.82;
    const ly = vh * 0.16;

    for (const [el, r] of boxes) {
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = Math.hypot(cx - lx, cy - ly) / diag;
      const v = Math.pow(Math.min(1, Math.max(0, 1 - d / 0.92)), 1.35);
      // Skip the write unless it would actually change a pixel.
      if (Math.abs((prev.get(el) || 0) - v) > 0.015) {
        el.style.setProperty('--lit', v.toFixed(3));
        prev.set(el, v);
      }
    }

    requestAnimationFrame(frame);
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measure, 140);
  }, { passive: true });

  narrow.addEventListener('change', measure);
  window.addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  measure();
  requestAnimationFrame(frame);
})();
