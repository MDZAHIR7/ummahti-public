/* ==========================================================================
   Ummahti Quran — the one-verse player

   A drum of reciters over a single ayah: Al-Anbiya 21:92, the verse the app
   is named out of. Turn the drum, and that voice reads it.

   Three things this file deliberately does not do.

   It does not animate the scroll. The drum is a real scroll container with
   scroll-snap-type: y mandatory, so the flick, the momentum, the rubber band
   and the settle are the reader's own platform. That is why it feels like
   the picker they already know, and it is why there is no physics here.

   It does not fetch anything. The page's Content-Security-Policy sets
   connect-src 'none', so there is no manifest to load: the list of voices is
   the markup, and each row carries the slug of its clip. Audio is a media
   load from this origin, which is all the policy allows and all this needs.

   It does not show itself unless the clips are on disk. The section ships
   hidden with data-clips="pending"; tools/fetch_recitation.py flips that to
   "ready" once every clip named in the markup has been downloaded. A button
   that cannot play is worse than no button, and the rail above has already
   named every reciter without a line of script.
   ========================================================================== */

(() => {
  'use strict';

  const root = document.querySelector('[data-verse]');
  if (!root || root.dataset.clips !== 'ready') return;

  const list = root.querySelector('[data-wheel-list]');
  const wheel = root.querySelector('[data-wheel]');
  const audio = root.querySelector('[data-audio]');
  const playBtn = root.querySelector('[data-play]');
  const nowEl = root.querySelector('[data-now]');
  const barEl = root.querySelector('[data-bar]');
  const hintEl = root.querySelector('[data-hint]');
  const rows = [...list.querySelectorAll('[data-clip]')];
  if (!rows.length) return;

  const CLIPS = '/media/recitation/anbiya-92/';
  const GONE = 'That recitation is not on the site yet.';
  const SOON = 'In the next update of the app.';
  const SPIN = 'Spin the drum to change the voice.';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  root.hidden = false;
  nowEl.setAttribute('aria-live', 'polite');

  /* The name without the (Murattal) / (Mujawwad) qualifier's brackets, for
     the line under the button and for the lock screen. */
  const nameOf = (li) => li.textContent.replace(/\s+/g, ' ').trim();

  /* ------------------------------------------------------------ the drum */

  let itemH = rows[0].offsetHeight || 42;
  let index = 0;          // the name currently under the band
  let detent = 0;         // the last row to cross it, ticked or not
  let gestured = false;   // has the reader touched the drum yet
  const missing = new Set();
  const painted = new Array(rows.length).fill(NaN);

  function measure() {
    itemH = rows[0].offsetHeight || itemH;
  }

  /* Every row's lean comes from one number: how far it sits from the band,
     -1 a screenful above to 1 a screenful below. Rows outside the window are
     pinned at the limit and then left alone. */
  function paint() {
    const top = list.scrollTop;
    const near = Math.round(top / itemH);
    const span = itemH * 2;

    for (let i = 0; i < rows.length; i++) {
      let t;
      if (Math.abs(i - near) > 3) t = i < near ? -1 : 1;
      else t = Math.max(-1, Math.min(1, (i * itemH - top) / span));

      // Skip the write unless it would actually change a pixel.
      if (Math.abs(painted[i] - t) < 0.008) continue;
      painted[i] = t;
      rows[i].style.setProperty('--t', t.toFixed(3));
      rows[i].style.setProperty('--a', Math.abs(t).toFixed(3));
    }

    const at = Math.max(0, Math.min(rows.length - 1, near));
    if (at !== detent) {
      detent = at;
      tick();
    }
  }

  /* The detent, which is three different things on three platforms.

     Android has the Vibration API. It also requires sticky user activation,
     and a touch-drag does not grant that until the finger lifts — so without
     priming, the very first spin of the page is silent and the reader
     reasonably concludes it does not buzz. prime() below spends the first
     activation-granting event it sees on a zero-length pulse, which arms the
     motor for every tick after it.

     iOS Safari has no Vibration API and never has had one. What it has had
     since 17.4 is a switch control that fires the system haptic when it
     toggles, so that is the tick there: a real checkbox with the switch
     attribute, parked in the corner of the drum at one pixel and clicked once
     per detent. It has to stay in the layout — display:none takes the haptic
     with it — which is why it is positioned out of the way rather than
     hidden. It is a hack, and it is the only haptic a web page can ask that
     platform for.

     Everything else has no motor, so the band lights for a frame. That runs
     on all three: a detent you can see is worth having even where you can
     also feel it. */

  const canVibrate = typeof navigator.vibrate === 'function';

  let haptic = null;
  if (!canVibrate && 'switch' in document.createElement('input')) {
    haptic = document.createElement('input');
    haptic.type = 'checkbox';
    haptic.setAttribute('switch', '');
    haptic.className = 'wheel-haptic';
    haptic.tabIndex = -1;
    haptic.setAttribute('aria-hidden', 'true');
    wheel.append(haptic);
  }

  let primed = false;
  function prime() {
    gestured = true;
    if (primed || !canVibrate) return;
    primed = true;
    try { navigator.vibrate(0); } catch (e) { /* denied, or no motor */ }
  }

  function pulse() {
    if (canVibrate) {
      try { navigator.vibrate(8); } catch (e) { /* denied mid-gesture */ }
      return;
    }
    if (haptic) {
      try { haptic.click(); } catch (e) { /* no system haptic */ }
    }
  }

  let tickTimer = 0;
  function tick() {
    // Nothing fires until the reader has touched the drum, or the page would
    // tick itself while laying out.
    if (!gestured) return;
    pulse();
    wheel.classList.add('is-tick');
    clearTimeout(tickTimer);
    tickTimer = setTimeout(() => wheel.classList.remove('is-tick'), 90);
  }

  let frame = 0;
  let settle = 0;

  list.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; paint(); });

    /* The choice is made when the drum stops, not while it is passing. Any
       other rule loads twenty-seven clips on one flick. scrollend would say
       this exactly, and says it on the platforms that have it; the timer is
       for the ones that do not. */
    clearTimeout(settle);
    settle = setTimeout(land, 130);
  }, { passive: true });

  if ('onscrollend' in list) {
    list.addEventListener('scrollend', () => { clearTimeout(settle); land(); });
  }

  function land() {
    const at = Math.max(0, Math.min(rows.length - 1, Math.round(list.scrollTop / itemH)));
    if (at !== index) select(at);
  }

  function goTo(i, smooth) {
    const at = Math.max(0, Math.min(rows.length - 1, i));
    list.scrollTo({
      top: at * itemH,
      behavior: smooth && !reduced.matches ? 'smooth' : 'auto',
    });
  }

  /* ----------------------------------------------------------- the voice */

  function select(i) {
    index = i;
    const li = rows[i];

    rows.forEach((r, n) => r.setAttribute('aria-selected', String(n === i)));
    list.setAttribute('aria-activedescendant', li.id);
    nowEl.textContent = nameOf(li);

    const wasPlaying = !audio.paused && !audio.ended;

    /* On the rail above, in the next update, and so not on this page's audio
       either. The row stays in the drum — it is a voice that is coming, and
       the drum is the list of voices — and it says which it is. */
    if ('soon' in li.dataset) {
      audio.pause();
      audio.removeAttribute('src');
      fail(SOON);
      return;
    }

    audio.src = CLIPS + li.dataset.clip + '.mp3';

    if (missing.has(li.dataset.clip)) {
      fail(GONE);
      return;
    }

    playBtn.disabled = false;
    hintEl.textContent = wasPlaying ? 'Playing.' : SPIN;

    setMediaSession();

    // Turning the drum while it is reading swaps the voice mid-verse and
    // starts the ayah again, which is the point of the thing.
    if (wasPlaying) start();
  }

  function fail(message) {
    playBtn.disabled = true;
    playBtn.setAttribute('aria-pressed', 'false');
    hintEl.textContent = message;
    barEl.style.setProperty('--p', '0');
  }

  /* Which clip failed is read back off the element, not taken to be the one
     under the band: the drum may have moved on while the load was failing,
     and marking the wrong reciter unplayable is its own small lie. */
  audio.addEventListener('error', () => {
    const src = audio.getAttribute('src');
    if (!src) return;
    const slug = src.slice(src.lastIndexOf('/') + 1).replace(/\.mp3$/, '');
    const li = rows.find((r) => r.dataset.clip === slug);
    if (!li) return;

    missing.add(slug);
    li.classList.add('is-missing');
    if (rows[index] === li) fail(GONE);
  });

  /* -------------------------------------------------------- the transport */

  function start() {
    const p = audio.play();
    if (!p || !p.catch) return;
    p.catch(() => {
      /* A play() on a clip that 404s rejects and fires error, in that order,
         so the generic message would land on top of the true one. The clip
         being absent is the better answer whenever it is the right one. */
      fail(missing.has(rows[index].dataset.clip) ? GONE : 'This browser would not start the audio.');
    });
  }

  playBtn.addEventListener('click', () => {
    if (audio.paused || audio.ended) start();
    else audio.pause();
  });

  audio.addEventListener('play', () => {
    playBtn.setAttribute('aria-pressed', 'true');
    playBtn.setAttribute('aria-label', 'Pause');
    hintEl.textContent = 'Playing.';
  });

  audio.addEventListener('pause', () => {
    playBtn.setAttribute('aria-pressed', 'false');
    playBtn.setAttribute('aria-label', 'Play this verse');
  });

  audio.addEventListener('ended', () => {
    barEl.style.setProperty('--p', '0');
    hintEl.textContent = SPIN;
  });

  audio.addEventListener('timeupdate', () => {
    const d = audio.duration;
    if (!d || !isFinite(d)) return;
    barEl.style.setProperty('--p', (audio.currentTime / d).toFixed(4));
  });

  /* The verse is what is playing, so that is what the lock screen says —
     with the reciter as the artist, which is what the reciter is. */
  function setMediaSession() {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: 'Sūrah Al-Anbiyā’ 21:92',
        artist: nameOf(rows[index]),
        album: 'Ummahti Qur’an',
      });
    } catch (e) { /* no MediaMetadata */ }
  }

  /* ------------------------------------------------------------- the input */

  /* pointerdown and touchend are the two the platforms actually grant
     activation on, and a wheel event is a trackpad that never will — it only
     needs to arm the visual tick. */
  wheel.addEventListener('pointerdown', prime, { passive: true });
  wheel.addEventListener('touchend', prime, { passive: true });
  wheel.addEventListener('keydown', prime);
  wheel.addEventListener('wheel', () => { gestured = true; }, { passive: true });

  // A row you can see is a row you can point at.
  rows.forEach((li, i) => {
    li.addEventListener('click', () => { prime(); goTo(i, true); });
  });

  list.addEventListener('keydown', (e) => {
    const step =
      e.key === 'ArrowDown' ? 1 :
      e.key === 'ArrowUp' ? -1 :
      e.key === 'PageDown' ? 4 :
      e.key === 'PageUp' ? -4 : 0;

    if (step) { e.preventDefault(); goTo(index + step, true); return; }
    if (e.key === 'Home') { e.preventDefault(); goTo(0, true); return; }
    if (e.key === 'End') { e.preventDefault(); goTo(rows.length - 1, true); return; }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      playBtn.click();
    }
  });

  /* A drum inside a page that scrolls: once the reader is at either end of
     the list, let the page have the wheel back. overscroll-behavior does
     this for touch; this does it for a trackpad. */
  list.addEventListener('wheel', (e) => {
    const atTop = list.scrollTop <= 0 && e.deltaY < 0;
    const atEnd = list.scrollTop >= list.scrollHeight - list.clientHeight - 1 && e.deltaY > 0;
    if (!atTop && !atEnd) e.stopPropagation();
  }, { passive: true });

  /* --------------------------------------------------------------- start */

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { measure(); painted.fill(NaN); paint(); }, 140);
  }, { passive: true });

  measure();
  paint();
  select(0);              // arms the first clip; preload="none" means nothing loads yet
})();
