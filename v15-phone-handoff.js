/* One owner for the retained preview phone. Layout is stable; only the phone moves.
   Reparent first, then animate the inverse rectangle in destination coordinates.
   Native page scroll therefore moves both ends together, including in RTL. */
(() => {
  'use strict';
  function create({ phone, homeSlot, homeHost, dockSlot, hero, still, onHostChange }) {
    let host = phone.parentElement === dockSlot ? 'dock' : 'home';
    let animation = null, frame = 0, intent = null, destroyed = false, receiving = null, restoringFocus = false;
    const listeners = [];
    const listen = (type, handler, options) => {
      window.addEventListener(type, handler, options);
      listeners.push([type, handler, options]);
    };
    const bounds = element => element.getBoundingClientRect();
    const inView = rect => rect.bottom > 0 && rect.top < window.innerHeight;
    const anchor = () => Math.min(260, window.innerHeight * .35);
    const progress = () => {
      const rect = bounds(homeSlot);
      return rect.top + rect.height * .5 - anchor();
    };
    function wanted() {
      const distance = progress();
      if (intent === 'home' && distance >= 32 || intent === 'dock' && distance <= -32) intent = null;
      if (intent) return intent;
      if (host === 'home') return distance < -32 ? 'dock' : 'home';
      return distance > 32 ? 'home' : 'dock';
    }
    const focusState = () => {
      const active = document.activeElement;
      if (!active || !phone.contains(active)) return null;
      return { active, start: active.selectionStart, end: active.selectionEnd };
    };
    const restoreFocus = state => {
      if (!state) return;
      restoringFocus = true;
      try {
        state.active.focus({ preventScroll: true });
        if (typeof state.start === 'number' && state.active.setSelectionRange) {
          state.active.setSelectionRange(state.start, state.end);
        }
      } finally { restoringFocus = false; }
    };
    // The presentation may already be banked when a user reverses. Preserve its
    // affine pose, not just the bounding rectangle, before changing its parent.
    function presentation() {
      const rect = bounds(phone);
      const transform = getComputedStyle(phone).transform;
      const match = /^matrix\(([^)]+)\)$/.exec(transform);
      const matrix = match ? match[1].split(',').map(Number) : [1, 0, 0, 1, 0, 0];
      const width = phone.offsetWidth || rect.width, height = phone.offsetHeight || rect.height;
      const [a, b, c, d, e, f] = matrix;
      const minX = Math.min(0, a * width, c * height, a * width + c * height) + e;
      const minY = Math.min(0, b * width, d * height, b * width + d * height) + f;
      return { rect, matrix, width, height, left: rect.left - minX, top: rect.top - minY };
    }
    function clearCraft() {
      phone.classList.remove('r-phone-travelling');
      phone.style.removeProperty('--r-handoff-ms');
      if (receiving) {
        receiving.classList.remove('r-handoff-receiving');
        for (const key of ['--r-landing-x', '--r-landing-y', '--r-landing-width', '--r-handoff-ms']) receiving.style.removeProperty(key);
        receiving = null;
      }
    }
    function cancelAnimation() {
      const previous = animation; animation = null;
      if (previous) { previous.onfinish = null; previous.cancel(); }
      clearCraft();
    }
    function transferFrames(from, to, next) {
      const width = phone.offsetWidth || to.width, height = phone.offsetHeight || to.height;
      const m = from.matrix;
      const first = [m[0] * from.width / width, m[1] * from.width / width,
        m[2] * from.height / height, m[3] * from.height / height,
        from.left - to.left + m[4], from.top - to.top + m[5]];
      const startX = first[0] * width / 2 + first[2] * height / 2 + first[4];
      const startY = first[1] * width / 2 + first[3] * height / 2 + first[5];
      const dx = width / 2 - startX, dy = height / 2 - startY;
      const distance = Math.hypot(dx, dy), compact = window.innerWidth < 700;
      const direction = (next === 'dock' ? 1 : -1) * (document.documentElement.dir === 'rtl' ? -1 : 1);
      const bend = Math.min(compact ? 12 : 27, distance * .075) * direction;
      const lift = Math.min(compact ? 11 : 20, distance * .045);
      const bank = (compact ? .018 : .032) * (dx < 0 ? -1 : 1);
      const response = 7.5, normalizer = 1 - (1 + response) * Math.exp(-response);
      const frames = [];
      // Sample a critically damped placement once. The compositor owns playback;
      // there is no layout read or JavaScript loop on animation frames.
      for (let i = 0; i <= 32; i++) {
        const time = i / 32;
        const q = i === 32 ? 1 : (1 - (1 + response * time) * Math.exp(-response * time)) / normalizer;
        const arch = Math.sin(Math.PI * q), angle = bank * arch * (1 - q);
        const depth = 1 - (compact ? .018 : .03) * arch;
        const cosine = Math.cos(angle) * depth, sine = Math.sin(angle) * depth;
        const a0 = first[0] + (1 - first[0]) * q, b0 = first[1] * (1 - q);
        const c0 = first[2] * (1 - q), d0 = first[3] + (1 - first[3]) * q;
        const a = cosine * a0 - sine * b0, b = sine * a0 + cosine * b0;
        const c = cosine * c0 - sine * d0, d = sine * c0 + cosine * d0;
        const x = startX + dx * q + (distance ? -dy / distance * bend * arch : 0);
        const y = startY + dy * q + (distance ? dx / distance * bend * arch : 0) - lift * arch;
        const e = x - a * width / 2 - c * height / 2;
        const f = y - b * width / 2 - d * height / 2;
        frames.push({ offset: time, transform: 'matrix(' + [a, b, c, d, e, f].join(',') + ')' });
      }
      frames[0].transform = 'matrix(' + first.join(',') + ')';
      frames[32].transform = 'matrix(1,0,0,1,0,0)';
      return { frames, duration: Math.min(850, Math.max(680, 650 + distance * .24)) };
    }
    function receive(next, to, duration) {
      receiving = next === 'dock' ? dockSlot : homeHost;
      const local = bounds(receiving);
      receiving.style.setProperty('--r-landing-x', (to.left - local.left + to.width / 2) + 'px');
      receiving.style.setProperty('--r-landing-y', (to.bottom - local.top - 8) + 'px');
      receiving.style.setProperty('--r-landing-width', (to.width * 1.18) + 'px');
      receiving.style.setProperty('--r-handoff-ms', duration + 'ms');
      receiving.classList.add('r-handoff-receiving');
    }
    function move(next, { animate = true, holdHome = false, holdDock = false } = {}) {
      if (destroyed) return;
      if (holdHome) intent = 'home';
      else if (holdDock) intent = 'dock';
      if (host === next) {
        if ((!animate || still() || document.hidden) && animation) cancelAnimation();
        return;
      }
      // Keep a visible phone in its current surface until the receiving phone
      // slot has enough room to communicate the placement. Native scrolling
      // retries through reconcile(); restoration and still states settle now.
      // A deferred reversal also retains the current animation presentation.
      if (animate && !still() && !document.hidden) {
        const source = bounds(phone), receiver = bounds(next === 'dock' ? dockSlot : homeSlot);
        const overlap = Math.max(0, Math.min(receiver.bottom, window.innerHeight) - Math.max(receiver.top, 0));
        if (inView(source) && overlap < 64) return;
      }
      // Read the current presentation BEFORE cancelling an interrupted flight.
      const from = presentation(), focus = focusState();
      cancelAnimation();
      host = next;
      phone.classList.toggle('is-docked-phone', next === 'dock');
      (next === 'dock' ? dockSlot : homeHost).append(phone);
      onHostChange?.(host);
      const to = bounds(phone);
      restoreFocus(focus);
      // No travelling object across unrelated offscreen chapters or on restoration.
      if (!animate || still() || document.hidden || !phone.animate || !from.rect.width || !to.width || !inView(from.rect) || !inView(to)) return;
      const x = from.rect.left - to.left, y = from.rect.top - to.top;
      const sx = from.rect.width / to.width, sy = from.rect.height / to.height;
      if (Math.abs(x) < .5 && Math.abs(y) < .5 && Math.abs(sx - 1) < .002 && Math.abs(sy - 1) < .002) return;
      phone.classList.add('r-phone-travelling');
      const transfer = transferFrames(from, to, next);
      phone.style.setProperty('--r-handoff-ms', transfer.duration + 'ms');
      receive(next, to, transfer.duration);
      const active = phone.animate(transfer.frames, { duration: transfer.duration, easing: 'linear', fill: 'both' });
      animation = active;
      active.onfinish = () => {
        if (animation !== active || destroyed) return;
        cancelAnimation();
        // A scroll reversal during this flight must not be dropped.
        schedule();
      };
    }
    function reconcile({ animate = true } = {}) {
      if (destroyed) return;
      if (animation && (!animate || still() || document.hidden)) cancelAnimation();
      move(wanted(), { animate });
    }
    function schedule() {
      if (destroyed || frame) return;
      frame = requestAnimationFrame(() => { frame = 0; reconcile(); });
    }
    function restore() {
      intent = null;
      reconcile({ animate: false });
      schedule();
    }
    const releaseIntent = () => { intent = null; schedule(); };
    listen('scroll', schedule, { passive: true });
    listen('resize', restore);
    listen('pageshow', restore);
    listen('load', restore);
    listen('hashchange', schedule);
    listen('scrollend', releaseIntent);
    listen('wheel', releaseIntent, { passive: true });
    listen('touchstart', releaseIntent, { passive: true });
    listen('keydown', event => {
      if (['Home', 'End', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown'].includes(event.key)) releaseIntent();
    });
    const visibility = () => { if (document.hidden) cancelAnimation(); else restore(); };
    document.addEventListener('visibilitychange', visibility);
    const resized = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
      if (animation) cancelAnimation();
      schedule();
    }) : null;
    resized?.observe(homeSlot); resized?.observe(dockSlot);
    onHostChange?.(host);
    restore();
    return {
      move,
      reconcile,
      isMoving: () => !!animation,
      isRestoringFocus: () => restoringFocus,
      getHost: () => host,
      destroy() {
        destroyed = true; cancelAnimation();
        if (frame) cancelAnimationFrame(frame); frame = 0;
        listeners.forEach(([type, handler, options]) => window.removeEventListener(type, handler, options));
        document.removeEventListener('visibilitychange', visibility); resized?.disconnect();
      }
    };
  }
  window.UmmahtiPhoneHandoff = { create };
})();
