/* Ummahti Guide, as a sky of questions.

   Each of Guide's topics (from the app's own catalogue, reviewed entries only) is a star, set in
   its subject's arc of the sky. A star's size is how many sources it carries; the fine threads
   are where the app leads you next. Choose a star and the reader opens with the question people
   bring, Ummahti's words, the ayat themselves, the narrations with their references, a step to
   take, and where it leads. Search matches the topic names and the phrases the app listens for.
   Every star is a real button: Tab reaches the chosen one, arrow keys move through the sky. */
(() => {
  'use strict';
  const G = window.UMMAHTI_GUIDE;
  const section = document.querySelector('[data-guide-map]');
  if (!G || !section) return;
  const root = document.documentElement;
  const rtl = root.dir === 'rtl';
  const T = window.UMMAHTI_V15_I18N || {};
  const t = (k, f) => T[k] || f;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const M = window.UMMAHTI_MOON;
  const digits = new Intl.NumberFormat(root.lang || 'en');
  const sky = section.querySelector('[data-guide-sky]');
  const svg = section.querySelector('[data-guide-threads]');
  const reader = section.querySelector('[data-guide-reader]');
  const search = section.querySelector('[data-guide-search]');
  const status = section.querySelector('[data-guide-status]');
  const chips = section.querySelector('[data-guide-subjects]');
  const topics = G.topics, byId = new Map(topics.map((tp, i) => [tp.id, i]));
  const sources = tp => tp.q.length + tp.h.length;
  section.classList.add('is-live');

  /* ---------------------------------------------------------- the sky */
  /* Subjects take arcs in proportion to their topics; topics spread across two or three rings. */
  const groups = G.categories.map(() => []);
  topics.forEach((tp, i) => groups[tp.k].push(i));
  const pos = new Array(topics.length);
  const labels = [];
  /* Formation order: subject by subject around the sky, so it forms as the reader arrives. */
  const order = new Float32Array(topics.length);
  let seq = 0;
  let angle = -Math.PI / 2;
  const total = topics.length, gap = 0.05;
  groups.forEach((members, k) => {
    const span = (Math.PI * 2 - gap * groups.length) * members.length / total;
    const mid = angle + span / 2;
    labels.push({ k, a: mid, o: (seq / topics.length) * 0.82 });
    members.forEach((i, n) => {
      order[i] = (seq++ / topics.length) * 0.82;
      const ring = n % 3, along = members.length === 1 ? 0.5 : n / (members.length - 1);
      const a = angle + span * (0.08 + along * 0.84);
      const r = [0.22, 0.29, 0.36][ring] + ((i * 0.618) % 1) * 0.025;
      pos[i] = { x: 0.5 + Math.cos(a) * r * (rtl ? -1 : 1), y: 0.5 + Math.sin(a) * r };
    });
    angle += span + gap;
  });

  const stars = topics.map((tp, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'v-star';
    b.style.setProperty('--x', pos[i].x.toFixed(4));
    b.style.setProperty('--y', pos[i].y.toFixed(4));
    b.style.setProperty('--o', order[i].toFixed(4));
    const size = Math.min(18, 5 + sources(tp) * 1.4);
    b.style.setProperty('--s', size + 'px');
    b.setAttribute('aria-label', tp.t + ' · ' + G.categories[tp.k]);
    b.tabIndex = -1;
    b.dataset.k = tp.k;
    b.innerHTML = '<i aria-hidden="true"></i>';
    b.addEventListener('click', () => select(i, true));
    b.addEventListener('pointerenter', () => preview(i));
    b.addEventListener('pointerleave', () => preview(-1));
    b.addEventListener('focus', () => preview(i));
    b.addEventListener('blur', () => preview(-1));
    sky.append(b);
    return b;
  });
  labels.forEach(({ k, a, o }) => {
    const l = document.createElement('span');
    l.className = 'v-sky-label';
    l.textContent = G.categories[k];
    const r = 0.445;
    l.style.left = ((0.5 + Math.cos(a) * r * (rtl ? -1 : 1)) * 100) + '%';
    l.style.top = ((0.5 + Math.sin(a) * r) * 100) + '%';
    l.dataset.k = k;
    l.style.setProperty('--o', o.toFixed(4));
    l.setAttribute('aria-hidden', 'true');
    sky.append(l);
  });
  const centre = document.createElement('div');
  centre.className = 'v-sky-centre';
  centre.setAttribute('aria-hidden', 'true');
  centre.innerHTML = '<img src="/media/brand/2026-10/crescent-128.webp" alt="" width="128" height="128"><b></b><span></span>';
  centre.querySelector('b').textContent = digits.format(topics.length);
  centre.querySelector('span').textContent = t('guideTopicsWord', 'topics');
  sky.append(centre);
  /* The count rises with the stars as the sky forms around the crescent. */
  const body = section.querySelector('.v-guide-body') || sky;
  body.dataset.form = '0.62'; body.dataset.formPhone = '0.9';
  const count = centre.querySelector('b');
  body.addEventListener('v-form', event => {
    const shown = topics.reduce((n, _, i) => n + (event.detail > order[i] + 0.05 ? 1 : 0), 0);
    count.textContent = digits.format(event.detail >= 0.999 ? topics.length : shown);
  });
  const tip = document.createElement('div');
  tip.className = 'v-sky-tip';
  tip.hidden = true;
  tip.setAttribute('aria-hidden', 'true');
  sky.append(tip);

  /* Threads: every link the app makes from one topic to the next, drawn as gentle arcs. */
  const NS = 'http://www.w3.org/2000/svg';
  svg.setAttribute('viewBox', '0 0 1000 1000');
  const edges = [];
  topics.forEach((tp, i) => tp.f.forEach(id => {
    const j = byId.get(id);
    if (j === undefined) return;
    const a = pos[i], b = pos[j];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const cx = 0.5 + (mx - 0.5) * 0.45, cy = 0.5 + (my - 0.5) * 0.45;
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', `M${a.x * 1000} ${a.y * 1000} Q${cx * 1000} ${cy * 1000} ${b.x * 1000} ${b.y * 1000}`);
    p.dataset.from = i; p.dataset.to = j;
    p.setAttribute('pathLength', '1');
    p.style.setProperty('--o', (Math.max(order[i], order[j]) + 0.05).toFixed(4));
    svg.append(p);
    edges.push({ p, i, j });
  }));

  /* ------------------------------------------------------- the reader */
  const $r = sel => reader.querySelector(sel);
  const loading = {};
  function surah(n) {
    if (window.UMMAHTI_AYAT && window.UMMAHTI_AYAT[n]) return Promise.resolve(window.UMMAHTI_AYAT[n]);
    if (!loading[n]) loading[n] = new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = '/media/v15/quran/s' + String(n).padStart(3, '0') + '.js?v=20261019f';
      tag.onload = () => (window.UMMAHTI_AYAT && window.UMMAHTI_AYAT[n] ? resolve(window.UMMAHTI_AYAT[n]) : reject());
      tag.onerror = () => { delete loading[n]; reject(); };
      document.head.append(tag);
    });
    return loading[n];
  }
  const surahName = s => (M ? ((rtl && M.namesArabic) ? M.namesArabic[s - 1] : M.names[s - 1]) : '') ;
  const refText = ([s, a, e]) => surahName(s) + ' ' + digits.format(s) + ':' + digits.format(a) + (e > a ? '–' + digits.format(e) : '');
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

  let current = -1, passage = 0;
  function showPassage(tp, k) {
    passage = k;
    const box = $r('[data-guide-ayah]');
    const ref = tp.q[k];
    $r('[data-guide-refs]').querySelectorAll('button').forEach((b, n) => b.setAttribute('aria-pressed', String(n === k)));
    if (!ref) { box.hidden = true; return; }
    box.hidden = false;
    box.classList.add('is-loading');
    $r('[data-guide-ayah-ref]').textContent = refText(ref);
    surah(ref[0]).then(ayat => {
      if (current < 0 || topics[current] !== tp || passage !== k) return;
      const [s, a, e] = ref, slice = ayat.slice(a - 1, e);
      const ar = $r('[data-guide-ayah-ar]'), en = $r('[data-guide-ayah-en]');
      ar.textContent = slice.map((v, n) => v[0] + ' ﴿' + digits.format(a + n) + '﴾').join(' ');
      en.textContent = slice.map(v => v[1]).join(' ');
      box.classList.remove('is-loading');
    }, () => {
      $r('[data-guide-ayah-en]').textContent = t('verseFailed', 'This verse could not load. Check your connection and try again.');
      box.classList.remove('is-loading');
    });
  }
  function fill(i) {
    const tp = topics[i];
    $r('[data-guide-subject]').textContent = G.categories[tp.k];
    const title = $r('[data-guide-title]');
    title.textContent = tp.t;
    title.lang = tp.l;
    $r('[data-guide-question]').textContent = '“' + tp.s + '”';
    $r('[data-guide-editorial]').textContent = tp.e;
    const refs = $r('[data-guide-refs]');
    refs.replaceChildren(...tp.q.map((q, k) => { const b = el('button', '', refText(q)); b.type = 'button'; b.addEventListener('click', () => showPassage(tp, k)); return b; }));
    $r('[data-guide-quran]').hidden = !tp.q.length;
    showPassage(tp, 0);
    const list = $r('[data-guide-sunnah]');
    list.replaceChildren(...tp.h.map(h => {
      const c = G.cites[h], li = el('li');
      const p = el('p', '', c.s); p.lang = c.l; li.append(p);
      const a = el('a', 'v-link', [c.c, c.r, c.g].filter(Boolean).join(' · ') + ' ↗');
      a.href = c.u; a.rel = 'noopener'; a.target = '_blank';
      li.append(a);
      return li;
    }));
    $r('[data-guide-sunnah-wrap]').hidden = !tp.h.length;
    /* Du'as from the app's library: the Arabic as printed, or the ayah itself for a Quranic du'a. */
    const duaList = $r('[data-guide-duas]');
    duaList.replaceChildren(...tp.d.slice(0, 2).map(k => {
      const d = G.duas[k], li = el('li');
      li.append(el('b', '', d.t));
      const ar = el('p', 'v-arabic'); ar.lang = 'ar'; ar.dir = 'rtl'; li.append(ar);
      if (d.tr) { const tr = el('p', 'v-guide-translit', d.tr); tr.lang = 'ar-Latn'; li.append(tr); }
      const mean = el('p', 'v-translation'); li.append(mean);
      if (d.ar) { ar.textContent = d.ar; if (d.m) mean.textContent = d.m; else mean.remove(); }
      else if (d.q) {
        const [s, a, e] = d.q;
        mean.lang = 'en'; mean.dir = 'ltr';
        surah(s).then(ayat => { const part = ayat.slice(a - 1, e); ar.textContent = part.map(v => v[0]).join(' '); mean.textContent = d.m || part.map(v => v[1]).join(' '); }, () => {});
      }
      if (d.o) li.append(el('p', 'v-caption', d.o));
      const link = d.src ? el('a', 'v-link', [d.src.c, d.src.r, d.src.g].filter(Boolean).join(' · ') + ' ↗') : el('span', 'v-caption', refText(d.q));
      if (d.src) { link.href = d.src.u; link.rel = 'noopener'; link.target = '_blank'; }
      li.append(link);
      return li;
    }));
    $r('[data-guide-duas-wrap]').hidden = !tp.d.length;
    const steps = $r('[data-guide-steps]');
    steps.replaceChildren(...tp.a.map(a => el('li', '', a)));
    $r('[data-guide-steps-wrap]').hidden = !tp.a.length;
    $r('[data-guide-medical]').hidden = !tp.m;
    $r('[data-guide-medical]').textContent = G.medical || '';
    const next = $r('[data-guide-next]');
    next.replaceChildren(...tp.f.map(id => {
      const j = byId.get(id), b = el('button', '', topics[j].t);
      b.type = 'button';
      b.addEventListener('click', () => select(j, true, true));
      return b;
    }));
    $r('[data-guide-next-wrap]').hidden = !tp.f.length;
    $r('[data-guide-count]').textContent = t('guideSourcesCount', '{n} sources').replace('{n}', digits.format(sources(tp)));
  }
  function select(i, user, follow) {
    if (i === current) return;
    const was = current;
    current = i;
    stars.forEach((s, k) => { s.classList.toggle('is-on', k === i); s.tabIndex = k === i ? 0 : -1; s.setAttribute('aria-pressed', String(k === i)); });
    edges.forEach(e => e.p.classList.toggle('is-on', e.i === i || e.j === i));
    const swap = () => fill(i);
    if (user && !reduced.matches && reader.animate && was >= 0) {
      reader.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(6px)' }], { duration: 140, easing: 'ease-in' }).onfinish = () => {
        swap();
        reader.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' });
      };
    } else swap();
    if (follow) stars[i].focus({ preventScroll: true });
    if (user && innerWidth < 900) reader.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
  }

  /* --------------------------------------------------- preview, focus */
  function preview(i) {
    sky.classList.toggle('is-previewing', i >= 0);
    stars.forEach((s, k) => s.classList.toggle('is-near', i >= 0 && (k === i || topics[i].f.includes(topics[k].id))));
    edges.forEach(e => e.p.classList.toggle('is-near', i >= 0 && e.i === i));
    if (i < 0) { tip.hidden = true; return; }
    tip.replaceChildren(el('b', '', topics[i].t), el('span', '', topics[i].s));
    tip.hidden = false;
    const x = pos[i].x, y = pos[i].y;
    tip.style.left = (x * 100) + '%';
    tip.style.top = (y * 100) + '%';
    tip.classList.toggle('is-left', x > 0.6);
    tip.classList.toggle('is-up', y > 0.7);
  }
  sky.addEventListener('keydown', event => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const order = groups.flat(), at = order.indexOf(current);
    const step = keys[event.key] * (rtl && (event.key === 'ArrowRight' || event.key === 'ArrowLeft') ? -1 : 1);
    select(order[(at + step + order.length) % order.length], true, true);
  });

  /* ------------------------------------------------- subjects, search */
  let subject = -1;
  const all = el('button', '', t('guideAllSubjects', 'All subjects'));
  all.type = 'button'; all.setAttribute('aria-pressed', 'true');
  const chipButtons = [all, ...G.categories.map((c, k) => { const b = el('button', '', c); b.type = 'button'; b.setAttribute('aria-pressed', 'false'); b.dataset.k = k; return b; })];
  chipButtons.forEach((b, n) => b.addEventListener('click', () => filterSubject(n - 1)));
  chips.replaceChildren(...chipButtons);
  function filterSubject(k) {
    subject = k;
    chipButtons.forEach((b, n) => b.setAttribute('aria-pressed', String(n - 1 === k)));
    apply();
    if (k >= 0 && (current < 0 || topics[current].k !== k)) select(groups[k][0], true);
  }
  const fold = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ًͯ-ٰٟ]/g, '');
  const haystack = topics.map(tp => fold([tp.t, tp.s, tp.e, ...tp.w].join(' ')));
  function apply() {
    const q = fold(search ? search.value.trim() : '');
    const words = q.split(/\s+/).filter(w => w.length > 1);
    let shown = 0, first = -1;
    stars.forEach((s, i) => {
      const inSubject = subject < 0 || topics[i].k === subject;
      const match = !words.length || words.every(w => haystack[i].includes(w));
      const on = inSubject && match;
      s.classList.toggle('is-dim', !on);
      if (on) { shown++; if (first < 0) first = i; }
    });
    sky.querySelectorAll('.v-sky-label').forEach(l => l.classList.toggle('is-dim', subject >= 0 && Number(l.dataset.k) !== subject));
    if (status) status.textContent = words.length ? (shown ? (shown === 1 ? t('guideMatchOne', '1 topic matches') : t('guideMatches', '{n} topics match').replace('{n}', digits.format(shown))) : t('guideNoMatch', 'Nothing matched. Try other words, or choose a subject.')) : '';
    return first;
  }
  let typing = 0;
  search?.addEventListener('input', () => {
    clearTimeout(typing);
    typing = setTimeout(() => { const first = apply(); if (first >= 0 && search.value.trim().length > 2) select(first, true); }, 160);
  });
  search?.closest('form')?.addEventListener('submit', event => { event.preventDefault(); const first = apply(); if (first >= 0) select(first, true, true); });

  /* Start with a question almost everyone brings. */
  const start = ['anxiety_and_worry', 'delayed_dua', 'feeling_far_from_allah'].map(id => byId.get(id)).find(i => i !== undefined);
  select(start !== undefined ? start : 0, false);
})();
