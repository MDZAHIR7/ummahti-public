/* Exact, same-origin ayah playback. Never starts from a screen animation. */
(() => {
  'use strict';
  const voices = new Set(['alafasy', 'husary']);
  const counts = { 1: 7, 93: 11, 94: 8 };
  function create({ root, button, status, progress, t, onState = () => {} }) {
    const audio = document.createElement('audio');
    audio.preload = 'none'; audio.hidden = true; audio.dataset.previewAudio = '';
    root.append(audio);
    let version = 0, reference = '', voice = 'alafasy', state = 'idle';
    function paint(next, message = '') {
      state = next;
      const active = next === 'loading' || next === 'playing';
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-busy', String(next === 'loading'));
      button.setAttribute('aria-label', t(active ? 'rAudioPause' : 'rAudioPlay', { ref: reference }));
      button.dataset.audioState = next;
      const icon = button.querySelector('[data-audio-icon]');
      if (icon) icon.textContent = active ? 'Ⅱ' : '▶';
      if (status && message) status.textContent = message;
      onState(next);
    }
    function stop({ reset = false } = {}) {
      const wasActive = state === 'loading' || state === 'playing';
      version++; audio.pause();
      if (reset) { try { audio.currentTime = 0; } catch (_) {} }
      paint('idle', wasActive ? t('rAudioPaused', { ref: reference }) : '');
      if (progress) progress.style.setProperty('--p', '0');
    }
    function set(surah, ayah, nextVoice = voice) {
      if (!counts[surah] || ayah < 1 || ayah > counts[surah] || !Number.isInteger(ayah) || !voices.has(nextVoice)) throw new Error('Unsupported preview ayah');
      const next = surah + ':' + ayah;
      if (next === reference && nextVoice === voice) return;
      stop({ reset: true }); reference = next; voice = nextVoice;
      audio.src = '/media/recitation/preview/' + voice + '/' + String(surah).padStart(3, '0') + '-' + String(ayah).padStart(3, '0') + '.mp3';
      audio.dataset.reference = reference; audio.dataset.voice = voice;
      paint('idle');
    }
    function fail() { version++; audio.pause(); paint('error', t('rAudioError')); }
    function toggle() {
      if (!reference) return;
      if (state === 'loading' || !audio.paused) { stop(); if (status) status.textContent = t('rAudioPaused', { ref: reference }); return; }
      const request = ++version;
      document.dispatchEvent(new CustomEvent('ummahti:audio-start', { detail: { audio } }));
      paint('loading', t('rAudioLoading', { ref: reference }));
      let promise;
      try { promise = audio.play(); } catch (_) { fail(); return; }
      if (promise?.catch) promise.catch(() => {
        if (request !== version) return;
        fail();
      });
    }
    audio.addEventListener('playing', () => { if (state === 'loading') paint('playing', t('rAudioPlaying', { ref: reference })); });
    audio.addEventListener('pause', () => { if (state === 'playing') paint('idle', t('rAudioPaused', { ref: reference })); });
    audio.addEventListener('ended', () => { version++; paint('idle', t('rAudioFinished', { ref: reference })); if (progress) progress.style.setProperty('--p', '0'); });
    audio.addEventListener('error', () => { if (state === 'loading' || state === 'playing') fail(); });
    audio.addEventListener('timeupdate', () => { if (progress && Number.isFinite(audio.duration) && audio.duration > 0) progress.style.setProperty('--p', String(audio.currentTime / audio.duration)); });
    button.addEventListener('click', toggle);
    document.addEventListener('ummahti:audio-start', event => { if (event.detail?.audio !== audio) stop(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    new IntersectionObserver(entries => { if (!entries[0].isIntersecting) stop(); }).observe(root);
    return { set, stop, audio };
  }
  window.UmmahtiPreviewAudio = { create };
})();
