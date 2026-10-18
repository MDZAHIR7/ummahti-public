/* Ummahti's libraries, from the app's own published entries.

   Du'as as a rosette: every du'a a petal, grouped by the moment it is for. Gold petals come from
   the Quran, pearl petals from the Sunnah. Choose one and it opens as a page: the Arabic (as the
   app prints it, or the ayah itself), transliteration, meaning, when it is said, and its source.

   Reflections as a mosaic: every reflection a tile, in rows by theme. A gold square rests on an
   ayah, a pearl circle on a narration, so the shape says it as well as the colour. Filter by the
   people of the stories, or let it deal one, as Home does through the day. */
(() => {
  'use strict';
  const L = window.UMMAHTI_LIBRARY;
  if (!L) return;
  const root = document.documentElement;
  const rtl = root.dir === 'rtl';
  const T = window.UMMAHTI_V15_I18N || {};
  const t = (k, f) => T[k] || f;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const M = window.UMMAHTI_MOON;
  const digits = new Intl.NumberFormat(root.lang || 'en');
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = text; return n; };
  const surahName = s => (M ? ((rtl && M.namesArabic) ? M.namesArabic[s - 1] : M.names[s - 1]) : '');
  const refText = (s, a, e) => surahName(s) + ' ' + digits.format(s) + ':' + digits.format(a) + (e && e > a ? '–' + digits.format(e) : '');
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
  function swap(node, fill) {
    if (reduced.matches || !node.animate) { fill(); return; }
    node.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(5px)' }], { duration: 130, easing: 'ease-in' }).onfinish = () => {
      fill();
      node.animate([{ opacity: 0, transform: 'translateY(-5px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' });
    };
  }

  /* =============================================================== du'as */
  const duaSection = document.querySelector('[data-duas]');
  if (duaSection) {
    const rosette = duaSection.querySelector('[data-dua-rosette]');
    const page = duaSection.querySelector('[data-dua-page]');
    const chips = duaSection.querySelector('[data-dua-collections]');
    const $p = s => page.querySelector(s);
    const duas = L.duas;
    duaSection.classList.add('is-live');
    const groups = L.collections.map(() => []);
    duas.forEach((d, i) => groups[d.k].push(i));
    const order = groups.flat();
    const gap = 0.06, n = duas.length;
    let angle = -Math.PI / 2;
    const petals = new Array(n), petalOrder = new Float32Array(n);
    let seq = 0;
    groups.forEach((members, k) => {
      const span = (Math.PI * 2 - gap * groups.length) * members.length / n;
      const mid = angle + span / 2;
      const label = el('span', 'v-rosette-label', L.collections[k]);
      label.style.left = (50 + Math.cos(mid) * 46 * (rtl ? -1 : 1)) + '%';
      label.style.top = (50 + Math.sin(mid) * 46) + '%';
      label.dataset.k = k;
      label.style.setProperty('--o', ((seq / n) * 0.8).toFixed(4));
      label.setAttribute('aria-hidden', 'true');
      rosette.append(label);
      members.forEach((i, m) => {
        const a = angle + span * ((m + 0.5) / members.length);
        const d = duas[i];
        const b = el('button', 'v-petal' + (d.ar ? ' is-sunnah' : ' is-quran'));
        b.type = 'button';
        b.style.setProperty('--a', ((a * 180 / Math.PI) * (rtl ? -1 : 1) + (rtl ? 180 : 0) + 90) + 'deg');
        petalOrder[i] = (seq++ / n) * 0.8;
        b.style.setProperty('--o', petalOrder[i].toFixed(4));
        b.setAttribute('aria-label', d.t + ' · ' + L.collections[k]);
        b.tabIndex = -1;
        b.addEventListener('click', () => select(i, true));
        b.addEventListener('pointerenter', () => hint(i));
        b.addEventListener('pointerleave', () => hint(-1));
        rosette.append(b);
        petals[i] = b;
      });
      angle += span + gap;
    });
    const centre = el('div', 'v-rosette-centre');
    centre.setAttribute('aria-hidden', 'true');
    const quranic = duas.filter(d => !d.ar).length;
    centre.append(el('b', '', digits.format(n)), el('span', '', t('duaCountWord', 'du‘as')),
      el('i', 'is-quran', digits.format(quranic) + ' ' + t('duaQuranic', 'from the Quran')),
      el('i', 'is-sunnah', digits.format(n - quranic) + ' ' + t('duaProphetic', 'from the Sunnah')));
    rosette.append(centre);
    /* The rosette opens petal by petal as the reader arrives; its count opens with it. */
    const formHost = rosette.closest('.v-duas-body') || rosette;
    formHost.dataset.form = '0.6'; formHost.dataset.formPhone = '0.7';
    const duaCount = centre.querySelector('b');
    formHost.addEventListener('v-form', event => {
      const f = event.detail;
      duaCount.textContent = digits.format(f >= 0.999 ? n : petalOrder.reduce((c, o) => c + (f > o + 0.06 ? 1 : 0), 0));
    });
    const tip = el('div', 'v-rosette-tip'); tip.hidden = true; tip.setAttribute('aria-hidden', 'true'); rosette.append(tip);
    function hint(i) {
      if (i < 0) { tip.hidden = true; return; }
      tip.textContent = duas[i].t;
      tip.hidden = false;
    }
    let current = -1;
    function fill(i) {
      const d = duas[i];
      $p('[data-dua-collection]').textContent = L.collections[d.k] + ' · ' + (d.ar ? t('duaProphetic', 'from the Sunnah') : t('duaQuranic', 'from the Quran'));
      $p('[data-dua-title]').textContent = d.t;
      const ar = $p('[data-dua-arabic]'), tr = $p('[data-dua-translit]'), mean = $p('[data-dua-meaning]');
      tr.textContent = d.tr || ''; tr.hidden = !d.tr;
      $p('[data-dua-occasion]').textContent = d.o || ''; $p('[data-dua-occasion]').hidden = !d.o;
      const src = $p('[data-dua-source]');
      if (d.src) { src.textContent = [d.src.c, d.src.r, d.src.g].filter(Boolean).join(' · ') + ' ↗'; src.href = d.src.u; }
      else { src.textContent = refText(d.q[0], d.q[1], d.q[2]); src.removeAttribute('href'); }
      if (d.ar) { ar.textContent = d.ar; mean.textContent = d.m || ''; mean.hidden = !d.m; mean.lang = root.lang; mean.dir = root.dir; }
      else {
        ar.textContent = '…'; mean.hidden = false;
        surah(d.q[0]).then(ayat => {
          if (current !== i) return;
          const part = ayat.slice(d.q[1] - 1, d.q[2]);
          ar.textContent = part.map(v => v[0]).join(' ');
          mean.textContent = d.m || part.map(v => v[1]).join(' ');
          if (!d.m) { mean.lang = 'en'; mean.dir = 'ltr'; }
        }, () => { ar.textContent = ''; mean.textContent = t('verseFailed', 'This verse could not load.'); });
      }
      const k = order.indexOf(i);
      $p('[data-dua-pos]').textContent = digits.format(k + 1) + ' / ' + digits.format(n);
      $p('[data-dua-copy]').textContent = t('duaCopy', 'Copy');
    }
    function select(i, user) {
      if (i === current) return;
      current = i;
      petals.forEach((p, k) => { p.classList.toggle('is-on', k === i); p.tabIndex = k === i ? 0 : -1; p.setAttribute('aria-pressed', String(k === i)); });
      [...chips.children].forEach(c => c.setAttribute('aria-pressed', String(Number(c.dataset.k) === duas[i].k)));
      rosette.querySelectorAll('.v-rosette-label').forEach(l => l.classList.toggle('is-on', Number(l.dataset.k) === duas[i].k));
      user ? swap(page, () => fill(i)) : fill(i);
    }
    const step = by => select(order[(order.indexOf(current) + by + n) % n], true);
    $p('[data-dua-prev]').addEventListener('click', () => step(-1));
    $p('[data-dua-next]').addEventListener('click', () => step(1));
    rosette.addEventListener('keydown', event => {
      const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (!(event.key in keys)) return;
      event.preventDefault();
      step(keys[event.key] * (rtl && event.key.startsWith('Arrow') && (event.key === 'ArrowLeft' || event.key === 'ArrowRight') ? -1 : 1));
      petals[current].focus({ preventScroll: true });
    });
    chips.replaceChildren(...L.collections.map((c, k) => {
      const b = el('button', '', c);
      b.type = 'button'; b.dataset.k = k;
      b.append(el('small', '', digits.format(groups[k].length)));
      b.addEventListener('click', () => select(groups[k][0], true));
      return b;
    }));
    /* Copy: the Arabic and its meaning, with the source, exactly as shown. */
    $p('[data-dua-copy]').addEventListener('click', async () => {
      const d = duas[current];
      const text = [$p('[data-dua-arabic]').textContent, d.tr, $p('[data-dua-meaning]').textContent, $p('[data-dua-source]').textContent.replace(' ↗', '')].filter(Boolean).join('\n\n');
      const button = $p('[data-dua-copy]');
      try { await navigator.clipboard.writeText(text); button.textContent = t('duaCopied', 'Copied'); }
      catch { button.textContent = t('duaCopyFailed', 'Select the text to copy'); }
      button.classList.add('is-done');
      setTimeout(() => { button.textContent = t('duaCopy', 'Copy'); button.classList.remove('is-done'); }, 1800);
    });
    const start = duas.findIndex(d => d.id === 'dua_worry_and_debt');
    select(start >= 0 ? start : order[0], false);
  }

  /* ========================================================= reflections */
  const reflSection = document.querySelector('[data-reflections]');
  if (reflSection) {
    const mosaic = reflSection.querySelector('[data-refl-mosaic]');
    const card = reflSection.querySelector('[data-refl-card]');
    const people = reflSection.querySelector('[data-refl-people]');
    const $c = s => card.querySelector(s);
    const R = L.reflections;
    const themeNames = t('reflThemes', 'Stories of the prophets|Mercy|Patience|Worship|Du‘a|Character|The Hereafter|Gratitude').split('|');
    const peopleNames = t('reflPeopleNames', '').split('|');
    reflSection.classList.add('is-live');
    const rows = themeNames.map(() => []);
    R.forEach((r, i) => rows[r.th[0]].push(i));
    const tiles = new Array(R.length);
    let laid = 0;
    rows.forEach((members, k) => {
      const row = el('div', 'v-mosaic-row');
      const head = el('p', 'v-mosaic-label');
      head.append(el('b', '', themeNames[k]), el('span', '', digits.format(members.length)));
      head.style.setProperty('--o', ((laid / R.length) * 0.82).toFixed(4));
      const list = el('div', 'v-mosaic-tiles');
      members.forEach((i, m) => {
        const r = R[i];
        const b = el('button', 'v-tile' + (r.q ? ' is-ayah' : ' is-hadith'));
        b.type = 'button';
        b.style.setProperty('--o', ((laid++ / R.length) * 0.82).toFixed(4));
        b.setAttribute('aria-label', r.t);
        b.tabIndex = -1;
        b.addEventListener('click', () => select(i, true));
        list.append(b);
        tiles[i] = b;
      });
      row.append(head, list);
      mosaic.append(row);
    });
    /* The mosaic lays itself down theme by theme as the reader scrolls into it. */
    mosaic.dataset.form = '0.7'; mosaic.dataset.formPhone = '1.1';
    let current = -1, person = -1;
    function fill(i) {
      const r = R[i];
      $c('[data-refl-theme]').textContent = r.th.map(k => themeNames[k]).join(' · ') + (r.p !== null && r.p !== undefined && peopleNames[r.p] ? ' · ' + peopleNames[r.p] : '');
      $c('[data-refl-title]').textContent = r.t;
      $c('[data-refl-body]').textContent = r.b;
      const ayah = $c('[data-refl-ayah]'), src = $c('[data-refl-source]');
      if (r.q) {
        ayah.hidden = false;
        const ar = $c('[data-refl-ayah-ar]'), en = $c('[data-refl-ayah-en]');
        ar.textContent = '…'; en.textContent = '';
        src.textContent = refText(r.q[0], r.q[1]) + ' · Saheeh International'; src.removeAttribute('href');
        surah(r.q[0]).then(ayat => { if (current !== i) return; ar.textContent = ayat[r.q[1] - 1][0]; en.textContent = ayat[r.q[1] - 1][1]; }, () => { ar.textContent = ''; });
      } else {
        ayah.hidden = true;
        src.textContent = [r.h.c, r.h.n, r.h.g, r.h.by].filter(Boolean).join(' · ') + ' ↗';
        src.href = r.h.u;
      }
    }
    function select(i, user) {
      if (i === current) return;
      current = i;
      tiles.forEach((tl, k) => { tl.classList.toggle('is-on', k === i); tl.tabIndex = k === i ? 0 : -1; tl.setAttribute('aria-pressed', String(k === i)); });
      user ? swap(card, () => fill(i)) : fill(i);
    }
    const visible = () => R.map((r, i) => i).filter(i => person < 0 || R[i].p === person);
    mosaic.addEventListener('keydown', event => {
      const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (!(event.key in keys)) return;
      event.preventDefault();
      const list = rows.flat().filter(i => person < 0 || R[i].p === person), at = list.indexOf(current);
      let by = keys[event.key];
      if (rtl && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) by = -by;
      select(list[(at + by + list.length) % list.length], true);
      tiles[current].focus({ preventScroll: true });
    });
    /* Deal one: a shuffle bag, so nothing repeats until every reflection in view has come up. */
    let bag = [];
    reflSection.querySelector('[data-refl-shuffle]').addEventListener('click', () => {
      const pool = visible();
      if (!bag.length || bag.some(i => !pool.includes(i))) bag = pool.slice().sort(() => Math.random() - 0.5);
      let next = bag.pop();
      if (next === current && bag.length) next = bag.pop();
      select(next, true);
      if (!reduced.matches && tiles[next].animate) tiles[next].animate([{ transform: 'scale(2.2)' }, { transform: 'scale(1)' }], { duration: 500, easing: 'cubic-bezier(.22,1,.36,1)' });
    });
    const all = el('button', '', t('reflAll', 'All'));
    all.type = 'button'; all.setAttribute('aria-pressed', 'true');
    const chipList = [all, ...L.prophets.map((p, k) => {
      const count = R.filter(r => r.p === k).length;
      const b = el('button', '', peopleNames[k] || p);
      b.type = 'button'; b.setAttribute('aria-pressed', 'false');
      b.append(el('small', '', digits.format(count)));
      return b;
    })];
    chipList.forEach((b, n) => b.addEventListener('click', () => {
      person = n - 1;
      chipList.forEach((c, m) => c.setAttribute('aria-pressed', String(m === n)));
      tiles.forEach((tl, i) => tl.classList.toggle('is-dim', person >= 0 && R[i].p !== person));
      if (person >= 0 && R[current].p !== person) select(visible()[0], true);
      bag = [];
    }));
    people.replaceChildren(...chipList);
    const start = R.findIndex(r => r.id === 'mercy_hundred_parts');
    select(start >= 0 ? start : 0, false);
  }
})();
