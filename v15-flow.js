/* Ummahti: scroll introduces a chapter; time completes each arrival.
   The moon retains its separate reversible data story. One finite frame owner. */
(() => {
  'use strict';
  const root = document.documentElement, main = document.querySelector('main');
  if (!main) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const motionToggle = document.querySelector('[data-motion-toggle]');
  const still = () => reduced.matches || motionToggle?.getAttribute('aria-pressed') === 'true';
  const clamp = x => Math.max(0, Math.min(1, x));
  const headings = [...main.querySelectorAll('section h2')].filter(h => !h.closest('.v-hero, [data-nights], dialog, [data-no-flow]'));
  headings.forEach(h => {
    let count = 0;
    const walk = node => [...node.childNodes].forEach(child => {
      if (child.nodeType === 3) {
        const fragment = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(word => {
          if (!word) return;
          if (/^\s+$/.test(word)) { fragment.append(word); return; }
          const span = document.createElement('span');
          span.className = 'v-word'; span.style.setProperty('--i', count++);
          span.textContent = word; fragment.append(span);
        });
        child.replaceWith(fragment);
      } else if (child.nodeType === 1 && !child.matches('br')) walk(child);
    });
    walk(h); h.style.setProperty('--n', count); h.classList.add('v-flow-words');
    h.removeAttribute('data-v-reveal'); h.classList.remove('v-pending-reveal');
  });

  // Controls remain readable and usable; only editorial content joins the arrival.
  const sequenced = [...main.querySelectorAll('.v-trust-items > div, .v-channel-links > a, .v-process > li, .v-faq details, .v-library-grid > details, .v-listen-foot > p')]
    .filter(el => !el.closest('.v-hero, [data-nights], [data-no-flow]'));
  const groups = new Map();
  sequenced.forEach(el => {
    const index = groups.get(el.parentElement) || 0;
    el.classList.add('v-flow-seq'); el.style.setProperty('--s', Math.min(index, 6));
    groups.set(el.parentElement, index + 1);
  });
  const chapters = [...main.querySelectorAll(':scope > section')].filter(s => !s.matches('.v-hero, [data-nights], [data-no-flow]'));
  chapters.forEach(el => el.classList.add('v-flow-rule'));
  const forms = [...main.querySelectorAll('[data-form]')];
  const arrivals = new Map();
  const add = (el, property, duration) => {
    const item = arrivals.get(el) || { el, properties: new Set(), duration, start: null, complete: false };
    item.properties.add(property); item.duration = Math.max(duration, item.duration); arrivals.set(el, item);
  };
  headings.forEach(el => add(el, '--k', 760));
  sequenced.forEach(el => add(el, '--k', 620));
  chapters.forEach(el => add(el, '--k', 800));
  forms.forEach(el => add(el, '--f', 1050));
  const active = new Set();
  let frame = 0, observer = null;
  const paint = (item, value) => {
    for (const property of item.properties) item.el.style.setProperty(property, String(value));
    if (item.properties.has('--f')) item.el.dispatchEvent(new CustomEvent('v-form', { detail: value }));
  };
  const finish = item => { paint(item, 1); item.complete = true; active.delete(item); observer?.unobserve(item.el); };
  function draw(now) {
    frame = 0;
    for (const item of active) {
      const progress = clamp((now - item.start) / item.duration);
      if (progress === 1 || still() || document.hidden) { finish(item); continue; }
      paint(item, 1 - Math.pow(1 - progress, 3));
    }
    if (active.size) frame = requestAnimationFrame(draw);
  }
  const request = () => { if (!frame && !document.hidden && active.size) frame = requestAnimationFrame(draw); };
  const start = item => {
    if (!item || item.complete || item.start !== null) return;
    if (still() || document.hidden) { finish(item); return; }
    item.start = performance.now(); active.add(item); request();
  };
  if ('IntersectionObserver' in window) observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const item = arrivals.get(entry.target);
      if (entry.isIntersecting) start(item);
      else if (item && item.start !== null && !item.complete) finish(item);
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });
  const initialBounds = [...arrivals.values()].map(item => [item, item.el.getBoundingClientRect()]);
  for (const [item, bounds] of initialBounds) {
    if (still() || !observer || bounds.bottom < 0) finish(item);
    else { paint(item, 0); observer.observe(item.el); }
  }
  root.classList.add('v-flow');

  const thread = document.createElement('div');
  thread.className = 'v-thread'; thread.setAttribute('aria-hidden', 'true');
  thread.innerHTML = '<i class="v-thread-fill"></i><b class="v-thread-moon"></b>';
  const ticks = [...main.querySelectorAll(':scope > section')].map(section => {
    const tick = document.createElement('span'); tick.className = 'v-thread-tick';
    thread.append(tick); return { section, tick, top: 0 };
  });
  document.body.append(thread);
  let progressFrame = 0, docHeight = 1;
  function progress() {
    progressFrame = 0; thread.style.setProperty('--p', clamp(scrollY / docHeight).toFixed(4));
    ticks.forEach(item => item.tick.classList.toggle('is-past', item.top <= scrollY + innerHeight * .5));
  }
  const measure = () => {
    docHeight = Math.max(1, root.scrollHeight - innerHeight);
    const tops = ticks.map(item => item.section.getBoundingClientRect().top + scrollY);
    ticks.forEach((item, index) => {
      item.top = tops[index];
      item.tick.style.setProperty('--at', clamp(item.top / (docHeight + innerHeight * .3)).toFixed(4));
    });
    progress();
  };
  addEventListener('scroll', () => { if (!progressFrame && !document.hidden) progressFrame = requestAnimationFrame(progress); }, { passive: true });
  addEventListener('resize', measure); addEventListener('load', measure);
  document.fonts?.ready.then(measure);
  const motionChanged = () => {
    root.classList.toggle('v-flow-still', still());
    if (still()) {
      for (const item of arrivals.values()) finish(item);
      if (frame) cancelAnimationFrame(frame); frame = 0;
    }
  };
  reduced.addEventListener('change', motionChanged);
  motionToggle?.addEventListener('click', () => queueMicrotask(motionChanged));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      for (const item of active) finish(item);
      if (frame) cancelAnimationFrame(frame); frame = 0;
      if (progressFrame) cancelAnimationFrame(progressFrame); progressFrame = 0;
    } else { request(); measure(); }
  });
  measure(); motionChanged();
})();
