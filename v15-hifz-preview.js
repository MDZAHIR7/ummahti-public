/* The website's manual Hifz example. No speech capture or simulated recognition. */
(() => {
  'use strict';
  function parseReference(value, moon) {
    const ascii = value.trim().replace(/[٠-٩۰-۹]/g, ch => String(ch.charCodeAt(0) - (ch <= '٩' ? 0x660 : 0x6f0)));
    const clean = ascii.replace(/^(?:surah|sura|سورة|سورۃ)\s+/i, '');
    const match = clean.match(/^(.+?)[\s:/]+(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?$/);
    if (!match) return { error: 'format' };
    const fold = text => text.toLowerCase().normalize('NFKD').replace(/[̀-ًͯ-ٰٟۖ-ۭـ'’\s_-]/g, '').replace(/[ٱأإآ]/g, 'ا').replace(/ک/g, 'ك').replace(/ی/g, 'ي').replace(/^(?:surah|sura|سورة|سورۃ)/, '');
    const key = fold(match[1]); let s = /^\d+$/.test(key) ? Number(key) : 0;
    if (!s) s = moon.names.findIndex((label, i) => [label, moon.namesArabic[i]].some(candidate => { const name = fold(candidate); return name === key || name.replace(/^(?:al|ال)/, '') === key; })) + 1;
    if (s < 1 || s > moon.counts.length) return { error: 'format' };
    const a = Number(match[2]), b = Number(match[3] || match[2]);
    if (a < 1 || b < a || b > moon.counts[s - 1]) return { error: 'range', max: moon.counts[s - 1] };
    return { s, a, b };
  }
  function upsert(record, passage) {
    const kept = [];
    for (const item of record) {
      if (item.s !== passage.s || item.b < passage.a || item.a > passage.b) { kept.push(item); continue; }
      if (item.a < passage.a) kept.push({ ...item, b: passage.a - 1 });
      if (item.b > passage.b) kept.push({ ...item, a: passage.b + 1 });
    }
    kept.push(passage); kept.sort((a, b) => a.s - b.s || a.a - b.a);
    const merged = [];
    for (const item of kept) {
      const previous = merged[merged.length - 1];
      if (previous && previous.s === item.s && previous.st === item.st && previous.b + 1 >= item.a) previous.b = Math.max(previous.b, item.b);
      else merged.push({ ...item });
    }
    record.splice(0, record.length, ...merged);
  }
  function createHero(host, { moon, loadSurah, name, format, t, onInteract, announce }) {
    const root = host.querySelector('[data-hh-root]');
    if (!root) return { setActive() {}, stop() {} };
    const $ = selector => root.querySelector(selector);
    const form = $('[data-hh-form]'), input = $('[data-hh-reference]'), status = $('[data-hh-status]');
    const review = $('[data-hh-review]'), saved = $('[data-hh-saved]'), save = $('[data-hh-save]');
    const submit = form.querySelector('[type=submit]'), states = [...root.querySelectorAll('[data-hh-state]')];
    const record = [];
    let request = 0, active = false, found = null, chosen = null;
    const refText = ref => name(ref.s) + ' ' + ref.s + ':' + ref.a + (ref.a === ref.b ? '' : '–' + ref.b);
    const say = text => { status.textContent = text; announce?.(text); };
    function stop() {
      request++; submit.disabled = false; form.removeAttribute('aria-busy');
    }
    function pane(id) {
      form.hidden = id !== 'entry'; review.hidden = id !== 'review'; saved.hidden = id !== 'saved';
      root.dataset.hifzStep = id;
    }
    function entry({ focus = false } = {}) {
      stop(); found = null; chosen = null; save.disabled = true;
      states.forEach(button => button.setAttribute('aria-pressed', 'false'));
      input.removeAttribute('aria-invalid'); status.textContent = ''; pane('entry');
      if (focus) input.focus({ preventScroll: true });
    }
    async function submitReference(event) {
      event?.preventDefault(); onInteract(); stop();
      const ref = parseReference(input.value, moon);
      if (ref.error) {
        input.setAttribute('aria-invalid', 'true');
        say(t(ref.error === 'range' ? 'rHifzReferenceBounds' : 'rHifzReferenceHelp', { max: format(ref.max || 0) }));
        input.focus({ preventScroll: true }); return;
      }
      input.removeAttribute('aria-invalid'); status.textContent = '';
      const own = request; submit.disabled = true; form.setAttribute('aria-busy', 'true');
      const list = await loadSurah(ref.s).catch(() => null);
      if (own !== request || !active || document.hidden) return;
      submit.disabled = false; form.removeAttribute('aria-busy');
      if (!list?.[ref.a - 1]?.[0] || !list?.[ref.b - 1]?.[0]) { say(t('rLoadError')); return; }
      found = ref; chosen = null; save.disabled = true;
      states.forEach(button => button.setAttribute('aria-pressed', 'false'));
      $('[data-hh-ref]').textContent = refText(ref);
      $('[data-hh-first]').textContent = list[ref.a - 1][0];
      $('[data-hh-last]').textContent = ref.a === ref.b ? '' : list[ref.b - 1][0];
      $('[data-hh-last-row]').hidden = ref.a === ref.b;
      pane('review'); say(t('rHifzPreviewReviewStatus', { ref: refText(ref) }));
      states[0]?.focus({ preventScroll: true });
    }
    form.addEventListener('submit', submitReference);
    input.addEventListener('focus', onInteract);
    input.addEventListener('input', () => { onInteract(); stop(); input.removeAttribute('aria-invalid'); status.textContent = ''; });
    $('[data-hh-example]').addEventListener('click', () => { input.value = '21:92'; submitReference(); });
    states.forEach(button => button.addEventListener('click', () => {
      onInteract(); chosen = button.dataset.hhState;
      states.forEach(item => item.setAttribute('aria-pressed', String(item === button))); save.disabled = false;
    }));
    save.addEventListener('click', () => {
      onInteract();
      if (!found || !chosen) { say(t('rHifzChooseState')); return; }
      const detail = t('rHifzPreviewSavedDetail', { ref: refText(found), state: t({ learn: 'rLearning', mem: 'rMemorised', rev: 'rRevision' }[chosen]) });
      upsert(record, { ...found, st: chosen });
      $('[data-hh-saved-detail]').textContent = detail;
      $('[data-hh-count]').textContent = t('rHifzPreviewSavedCount', { ayahs: format(record.reduce((sum, p) => sum + p.b - p.a + 1, 0)) });
      found = null; chosen = null; save.disabled = true; pane('saved'); say(detail);
      $('[data-hh-another]').focus({ preventScroll: true });
    });
    $('[data-hh-change]').addEventListener('click', () => { onInteract(); entry({ focus: true }); });
    $('[data-hh-another]').addEventListener('click', () => { onInteract(); input.value = ''; entry({ focus: true }); });
    $('[data-hh-reset]').addEventListener('click', () => {
      onInteract(); record.length = 0; input.value = ''; entry({ focus: true }); say(t('rHifzPreviewResetDone'));
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    entry();
    return { stop, setActive(value) { active = value; if (!active) stop(); } };
  }
  window.UmmahtiHifzPreview = { parseReference, upsert, createHero };
})();
