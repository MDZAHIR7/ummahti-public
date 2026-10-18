/* Ummahti: the app, in its own screens.

   Real captures stand in perspective around the one in focus. Drag or swipe and the phones
   follow the finger; release and they settle on the nearest screen, carried a little further
   by a quick flick. Arrows, the keyboard and a tap on any side phone do the same. Each screen
   carries one claim and one plain sentence. Without script it is a plain scrolling row. */
(() => {
  'use strict';
  const root = document.documentElement;
  const stage = document.querySelector('[data-slides]');
  if (!stage) return;
  const track = stage.querySelector('[data-slides-track]');
  const slides = [...stage.querySelectorAll('[data-slide]')];
  const prev = stage.querySelector('[data-slides-prev]'), next = stage.querySelector('[data-slides-next]');
  const count = stage.querySelector('[data-slides-count]');
  const bar = stage.querySelector('[data-slides-bar]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const rtl = root.dir === 'rtl';
  const n = slides.length;
  const pad = k => String(k).padStart(2, '0');
  let active = 0, pos = 0, drag = null, spacing = 300;
  stage.classList.add('is-live');

  function render(animate) {
    track.classList.toggle('is-dragging', !animate);
    spacing = Math.min(340, Math.max(170, track.clientWidth * 0.27));
    slides.forEach((slide, i) => {
      const d = i - pos, a = Math.abs(d);
      const x = d * spacing * (rtl ? -1 : 1);
      const turn = Math.max(-1, Math.min(1, d)) * 24 * (rtl ? 1 : -1);
      const scale = 1 - Math.min(a, 2) * 0.13;
      slide.style.transform = `translate3d(calc(-50% + ${x}px), 0, ${-Math.min(a, 3) * 140}px) rotateY(${turn}deg) scale(${scale})`;
      slide.style.opacity = a > 2.6 ? 0 : String(1 - Math.min(a, 2.6) * 0.3);
      slide.style.zIndex = String(100 - Math.round(a * 10));
      slide.style.pointerEvents = a > 2.6 ? 'none' : '';
      const on = Math.round(pos) === i;
      slide.classList.toggle('is-active', on);
      slide.setAttribute('aria-hidden', String(!on));
      slide.querySelectorAll('a,button').forEach(el => { el.tabIndex = on ? 0 : -1; });
    });
    const k = ((Math.round(pos) % n) + n) % n;
    if (count) count.textContent = pad(k + 1) + ' / ' + pad(n);
    if (bar) bar.style.transform = `scaleX(${(k + 1) / n})`;
    if (prev) prev.disabled = k === 0;
    if (next) next.disabled = k === n - 1;
  }
  function go(i) {
    active = Math.max(0, Math.min(n - 1, i));
    pos = active;
    render(!reduced.matches);
  }
  prev?.addEventListener('click', () => go(active - 1));
  next?.addEventListener('click', () => go(active + 1));
  slides.forEach((slide, i) => slide.addEventListener('click', event => {
    if (moved || i === active) return;
    event.preventDefault();
    go(i);
  }));
  track.addEventListener('keydown', event => {
    const back = rtl ? 'ArrowRight' : 'ArrowLeft', fwd = rtl ? 'ArrowLeft' : 'ArrowRight';
    if (event.key === back) { event.preventDefault(); go(active - 1); }
    if (event.key === fwd) { event.preventDefault(); go(active + 1); }
    if (event.key === 'Home') { event.preventDefault(); go(0); }
    if (event.key === 'End') { event.preventDefault(); go(n - 1); }
  });

  /* Direct manipulation: the row follows the pointer, then settles with the flick's momentum. */
  let moved = false;
  track.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    drag = { x: event.clientX, y: event.clientY, start: pos, t: performance.now(), vx: 0, lastX: event.clientX, lastT: performance.now(), locked: null };
    moved = false;
  });
  addEventListener('pointermove', event => {
    if (!drag) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (drag.locked === null && Math.hypot(dx, dy) > 6) drag.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (drag.locked !== 'x') return;
    moved = true;
    const now = performance.now();
    drag.vx = (event.clientX - drag.lastX) / Math.max(1, now - drag.lastT);
    drag.lastX = event.clientX; drag.lastT = now;
    let p = drag.start - (dx / spacing) * (rtl ? -1 : 1);
    if (p < 0) p *= 0.35; if (p > n - 1) p = n - 1 + (p - n + 1) * 0.35;
    pos = p;
    render(false);
  }, { passive: true });
  const release = () => {
    if (!drag) return;
    if (drag.locked === 'x') {
      const fling = -drag.vx * 260 / spacing * (rtl ? -1 : 1);
      go(Math.round(pos + Math.max(-1.5, Math.min(1.5, fling))));
    }
    drag = null;
    setTimeout(() => { moved = false; }, 0);
  };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
  track.addEventListener('dragstart', event => event.preventDefault());

  let resizeTimer = 0;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => render(false), 80); });
  go(0);
})();
