/* Ummahti: the page keeps moving to its last line.

   Below the moon's story, every chapter answers the scroll instead of fading in once:
   - headlines light word by word as they rise into reading position (and dim again if the
     reader scrolls back), never splitting a word, so Arabic shaping stays whole;
   - lists, cards and rules arrive in sequence, scrubbed by their own position;
   - pictures sit at a slightly different depth from the words (gentle parallax);
   - a thread of light along the reading edge fills as the night goes on, its moon waxing
     from a first crescent to full at the close.
   One passive scroll listener, one frame per change. Reduced motion shows everything still
   and complete. */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const motionToggle = document.querySelector('[data-motion-toggle]');
  const still = () => reduced.matches || motionToggle?.getAttribute('aria-pressed') === 'true';
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const main = document.querySelector('main');
  if (!main) return;

  /* ------------------------------------------------ kinetic headlines */
  const headings = [...main.querySelectorAll('section h2')].filter(h => !h.closest('.v-hero, [data-nights], dialog, [data-no-flow]'));
  headings.forEach(h => {
    let n = 0;
    const walk = node => {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(part); return; }
            const span = document.createElement('span');
            span.className = 'v-word';
            span.style.setProperty('--i', n++);
            span.textContent = part;
            frag.append(span);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && !child.matches('br')) walk(child);
      });
    };
    walk(h);
    h.style.setProperty('--n', n);
    h.classList.add('v-flow-words');
    h.removeAttribute('data-v-reveal');
    h.classList.remove('v-pending-reveal');
  });

  /* ------------------------------------- sequences, rules and depth */
  const sequenceSets = ['.v-trust-items > div', '.v-channel-links > a', '.v-process > li', '.v-faq details', '.v-library-grid > details',
    '.v-tabs > button', '.v-example-options > button', '.v-listen-foot > p', '.v-lib-chips > button', '.v-guide-subjects > button'];
  const sequenced = [];
  sequenceSets.forEach(sel => {
    const groups = new Map();
    main.querySelectorAll(sel).forEach(el => {
      if (el.closest('.v-hero, [data-nights], [data-no-flow]')) return;
      const list = groups.get(el.parentElement) || [];
      list.push(el); groups.set(el.parentElement, list);
    });
    groups.forEach(list => list.forEach((el, k) => { el.classList.add('v-flow-seq'); el.style.setProperty('--s', Math.min(k, 12)); sequenced.push(el); }));
  });
  const chapters = [...main.querySelectorAll(':scope > section')].filter(s => !s.matches('.v-hero, [data-nights], [data-no-flow]'));
  chapters.forEach(s => s.classList.add('v-flow-rule'));
  const depthItems = [...main.querySelectorAll('.v-hifz-photo > img, .v-logo-film > div, .v-unlock-stage, .v-close > img, .v-reading-place, .v-trust-head')]
    .filter(el => !el.closest('.v-hero, [data-nights], [data-no-flow]'));
  depthItems.forEach(el => el.classList.add('v-flow-depth'));

  /* ----------------------------------------------- the thread of light */
  const thread = document.createElement('div');
  thread.className = 'v-thread';
  thread.setAttribute('aria-hidden', 'true');
  thread.innerHTML = '<i class="v-thread-fill"></i><b class="v-thread-moon"></b>';
  const ticks = chapters.concat([...main.querySelectorAll('[data-nights]')]).map(section => {
    const tick = document.createElement('span');
    tick.className = 'v-thread-tick';
    thread.append(tick);
    return { section, tick };
  });
  document.body.append(thread);

  /* ------------------------------------- visuals that form as you arrive */
  /* Any [data-form] visual (the Guide sky, the du'a rosette, the reflection mosaic) gets --f
     from 0 to 1 over its own stretch of scroll (data-form = how many screens it takes), and
     hears a 'v-form' event so it can count up. */
  let forms = [];

  /* ------------------------------------------------------- one frame */
  /* Scroll sets targets; every value glides toward its target with a time constant, so a
     sharp wheel step or flick still unfolds as a slow, even movement. */
  const TAU = 0.45;
  let frame = 0, vh = innerHeight, docH = 1, last = 0;
  const measure = () => { vh = innerHeight; docH = Math.max(1, root.scrollHeight - vh); forms = [...main.querySelectorAll('[data-form]')]; };
  const glide = (el, key, target, k, calm) => {
    const g = el._flow || (el._flow = {});
    const cur = g[key] === undefined || calm ? target : g[key] + (target - g[key]) * k;
    g[key] = Math.abs(target - cur) < 0.0015 ? target : cur;
    return g[key];
  };
  function update(now) {
    frame = 0;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016;
    last = now;
    const k = 1 - Math.exp(-dt / TAU);
    const calm = still();
    let moving = false;
    /* Every position is read before anything is written. Reading a box after a style write
       forces a fresh layout, and interleaving the two over a few hundred elements meant a
       few hundred layouts a frame on a phone. A value that would print the same is not
       written at all, so an element at rest costs no style work. */
    const put = (el, prop, text) => {
      const out = el._flowOut || (el._flowOut = {});
      if (out[prop] !== text) { out[prop] = text; el.style.setProperty(prop, text); }
    };
    /* Off screen nothing is seen to glide, so it arrives at once: a jump down the page (a
       menu link, a flick) settles in one frame instead of easing hundreds of hidden things. */
    const unseen = r => r.bottom < -vh * 0.25 || r.top > vh * 1.25;
    const set = (el, prop, key, target, digits = 3, r) => {
      const v = glide(el, key, target, k, calm || (r && unseen(r)));
      if (v !== target) moving = true;
      put(el, prop, v.toFixed(digits));
      return v;
    };
    const rects = list => list.map(el => el.getBoundingClientRect());
    const hR = rects(headings), sR = rects(sequenced), cR = rects(chapters), dR = rects(depthItems), fR = rects(forms);
    const tTop = ticks.map(({ section }) => section.getBoundingClientRect().top + scrollY);
    root.classList.toggle('v-flow-still', calm);
    headings.forEach((h, i) => {
      const r = hR[i];
      const target = r.top > vh + 40 ? 0 : r.bottom < -40 ? 1 : clamp((vh * 0.94 - r.top) / (vh * 0.5));
      set(h, '--k', 'k', calm ? 1 : target, 3, r);
    });
    sequenced.forEach((el, i) => set(el, '--k', 'k', calm ? 1 : clamp((vh * 1.02 - sR[i].top) / (vh * 0.38)), 3, sR[i]));
    chapters.forEach((s, i) => set(s, '--k', 'k', calm ? 1 : clamp((vh * 0.98 - cR[i].top) / (vh * 0.8)), 3, cR[i]));
    depthItems.forEach((el, i) => {
      const r = dR[i];
      if (r.bottom < -200 || r.top > vh + 200) return;
      const off = (r.top + r.height / 2 - vh / 2) / vh;
      const v = glide(el, 'py', calm ? 0 : off * -46, k, calm);
      if (Math.abs(v - (calm ? 0 : off * -46)) > 0.2) moving = true;
      put(el, '--py', v.toFixed(1) + 'px');
    });
    forms.forEach((el, i) => {
      const span = Number((innerWidth < 900 && el.dataset.formPhone) || el.dataset.form) || 1;
      const before = el._flow && el._flow.f;
      const f = set(el, '--f', 'f', calm ? 1 : clamp((vh * 0.9 - fR[i].top) / (vh * span)), 4, fR[i]);
      if (f !== before) el.dispatchEvent(new CustomEvent('v-form', { detail: f }));
    });
    const progress = set(thread, '--p', 'p', clamp(scrollY / docH), 4);
    ticks.forEach(({ tick }, i) => {
      put(tick, '--at', clamp(tTop[i] / (docH + vh * 0.3)).toFixed(4));
      const past = tTop[i] - vh * 0.5 <= progress * docH;
      if (tick.classList.contains('is-past') !== past) tick.classList.toggle('is-past', past);
    });
    if (moving) frame = requestAnimationFrame(update);
    else last = 0;
  }
  const request = () => { if (!frame) frame = requestAnimationFrame(update); };
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', () => { measure(); request(); });
  addEventListener('load', () => { measure(); request(); });
  reduced.addEventListener('change', request);
  motionToggle?.addEventListener('click', () => setTimeout(request, 0));
  measure();
  root.classList.add('v-flow');
  update(performance.now());
})();
