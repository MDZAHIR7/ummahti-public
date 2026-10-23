/* Run from any directory: node tools/test_guide_search.cjs
   Executes the shipped Guide script and real four-locale catalogues in a small DOM fixture.
   This verifies event/state contracts, not CSS, browser layout, accessibility-tree output,
   animation appearance or physical-device performance; those require the browser pass. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert/strict');
const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const guideCode = read('v15-guide.js');
class Classes {
  constructor(el) { this.el = el; }
  values() { return this.el.className.split(/\s+/).filter(Boolean); }
  add(...v) { this.el.className = [...new Set([...this.values(), ...v])].join(' '); }
  remove(...v) { this.el.className = this.values().filter(k => !v.includes(k)).join(' '); }
  toggle(v, on = !this.contains(v)) { on ? this.add(v) : this.remove(v); return on; }
  contains(v) { return this.values().includes(v); }
}
function fixture(lang = 'en', reduce = false, loaded = true) {
  let doc;
  const timers = new Map();
  let nextTimer = 0;
  const animations = [], scrolls = [], focused = [], externalScripts = [];
  const descendants = el => el.children.flatMap(c => [c, ...descendants(c)]);
  const matches = (el, selector) => {
    if (selector.startsWith('.')) return el.classList.contains(selector.slice(1));
    if (selector.startsWith('[')) { const key = selector.slice(1, -1).split('=')[0]; return Object.hasOwn(el.attributes, key); }
    return el.tagName.toLowerCase() === selector;
  };
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attributes = {}; this.dataset = {}; this.style = { values: {}, setProperty(k, v) { this.values[k] = v; }, getPropertyValue(k) { return this.values[k] || ''; } }; this.className = ''; this.classList = new Classes(this); this.listeners = {}; this.clientWidth = 600; this.clientHeight = 58; this.textContent = ''; }
    append(...nodes) { for (const n of nodes) { if (n.parentNode) n.parentNode.children = n.parentNode.children.filter(x => x !== n); n.parentNode = this; this.children.push(n); if (this === doc.head && n.tagName === 'SCRIPT') externalScripts.push(n); } }
    appendChild(n) { this.append(n); return n; }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(node => node !== this); this.parentNode = null; }
    insertBefore(n, before) { this.append(n); if (before) { this.children.pop(); this.children.splice(this.children.indexOf(before), 0, n); } }
    replaceChildren(...nodes) { this.children.forEach(n => n.parentNode = null); this.children = []; this.append(...nodes); }
    set innerHTML(value) { this.replaceChildren(); for (const m of value.matchAll(/<(img|b|span|i|svg)(?:\s[^>]*)?>/g)) this.append(new Element(m[1])); }
    setAttribute(k, v) { this.attributes[k] = String(v); if (k === 'id') this.id = String(v); }
    getAttribute(k) { return this.attributes[k] ?? null; }
    getBoundingClientRect() { return { top: this.fixtureVisible === false ? 2000 : 100, bottom: this.fixtureVisible === false ? 2058 : 158, width: this.clientWidth, height: this.clientHeight }; }
    querySelector(s) { return this.querySelectorAll(s)[0] || null; }
    querySelectorAll(s) { if (s.startsWith(':scope > ')) return this.children.filter(e => matches(e, s.slice(9).split('[')[0]) && e.getAttribute('aria-hidden') !== null); return descendants(this).filter(e => matches(e, s)); }
    closest(s) { let p = this; while (p) { if (matches(p, s)) return p; p = p.parentNode; } return null; }
    contains(other) { for (let n = other; n; n = n.parentNode) if (n === this) return true; return false; }
    addEventListener(k, f) { (this.listeners[k] ||= []).push(f); }
    dispatchEvent(e) { e.target ||= this; e.preventDefault ||= () => { e.defaultPrevented = true; }; for (const f of this.listeners[e.type] || []) f(e); }
    focus() {
      const previous = doc.activeElement;
      if (previous === this) return;
      previous?.dispatchEvent({ type: 'blur', relatedTarget: this });
      doc.activeElement = this; focused.push(this);
      this.dispatchEvent({ type: 'focus', relatedTarget: previous });
    }
    scrollIntoView() { scrolls.push(this); }
    animate(frames, opts) { const a = { el: this, frames, opts, cancelled: false, cancel() { this.cancelled = true; } }; animations.push(a); return a; }
  }
  doc = new Element('document'); doc.documentElement = new Element('html'); doc.documentElement.lang = lang; doc.documentElement.dir = ['ar', 'ur'].includes(lang) ? 'rtl' : 'ltr'; doc.head = new Element('head'); doc.body = new Element('body'); doc.append(doc.head, doc.body); doc.createElement = t => new Element(t); doc.createElementNS = (_, t) => new Element(t); doc.hidden = false;
  const add = (parent, tag, attr, cls = '') => { const el = new Element(tag); if (attr) el.setAttribute(attr, ''); el.className = cls; parent.append(el); return el; };
  const section = add(doc.body, 'section', 'data-guide-map');
  const form = add(section, 'form', null, 'v-guide-search');
  const icon = add(form, 'span', 'aria-hidden');
  const search = add(form, 'input', 'data-guide-search'); search.value = '';
  const status = add(form, 'p', 'data-guide-status');
  const chips = add(section, 'div', 'data-guide-subjects');
  const body = add(section, 'div', null, 'v-guide-body');
  const sky = add(body, 'div', 'data-guide-sky');
  const svg = add(sky, 'svg', 'data-guide-threads');
  const reader = add(body, 'article', 'data-guide-reader');
  const readerAttrs = ['subject','title','question','editorial','refs','quran','ayah','ayah-ref','ayah-ar','ayah-en','sunnah','sunnah-wrap','duas','duas-wrap','steps','steps-wrap','medical','next','next-wrap','count'];
  for (const a of readerAttrs) add(reader, a === 'title' ? 'h3' : 'div', 'data-guide-' + a);
  const reduced = { matches: reduce, listeners: [], addEventListener(_, f) { this.listeners.push(f); } };
  const io = [];
  const context = { window: {}, document: doc, Intl, Map, Set, Float32Array, console, innerWidth: 390, innerHeight: 844,
    getComputedStyle: e => ({ getPropertyValue: k => e.style.getPropertyValue(k) }),
    matchMedia: () => reduced, addEventListener() {},
    setTimeout: fn => { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout: id => timers.delete(id),
    ResizeObserver: class { constructor(f) { this.f = f; } observe() { this.f(); } },
    IntersectionObserver: class { constructor(f) { this.f = entries => { if(this.target) this.target.fixtureVisible=entries[0].isIntersecting; f(entries); }; io.push(this); } observe(target) { this.target=target; } }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read(`media/v15/guide-${lang}.js`), context);
  vm.runInContext(read(`i18n/v15-${lang}.js`), context);
  // Already loaded Quran data isolates network timing without changing the Guide under test.
  context.UMMAHTI_AYAT = loaded ? Object.fromEntries(Array.from({ length: 114 }, (_, i) => [i + 1, Array.from({ length: 300 }, () => ['source-ar', 'source-en'])])) : {};
  vm.runInContext(read('v15-field-light.js'), context);
  vm.runInContext(read('v15-guide-search.js'), context);
  vm.runInContext(read('v15-guide-answer.js'), context);
  vm.runInContext(read('media/v15/guide-index.js'), context);
  vm.runInContext(read('media/v15/moon-data.js'), context);
  vm.runInContext(guideCode, context);
  const flushTimers = () => { const queued = [...timers.values()]; timers.clear(); queued.forEach(fn => fn()); };
  const input = value => { search.value = value; search.dispatchEvent({ type: 'input' }); flushTimers(); };
  const submit = () => form.dispatchEvent({ type: 'submit' });
  const title = reader.querySelector('[data-guide-title]');
  return { context, doc, section, form, search, status, reader, title, input, submit, scrolls, focused, animations, externalScripts, reduced, io, flushTimers, timers };
}

// The hero is a different controller. Execute its shipped acceptance boundary
// and actual event handlers, supplying deferred passage work rather than
// duplicating its cancellation/status decisions in this fixture.
const heroCode = read('v15-renders.js').replace(/\r\n/g, '\n');
function heroSlice(start, end) {
  const first = heroCode.indexOf(start), last = heroCode.indexOf(end, first);
  assert(first >= 0 && last > first, 'Locate the shipped hero search contract.');
  return heroCode.slice(first, last);
}
function heroAcceptanceFixture() {
  const f = fixture(), pending = [], working = [], announcements = [], jobs = [];
  const context = f.context;
  context.run = 0;
  context.matches = [{ t: 'older topic' }];
  context.guideComposing = false; context.userQuery = false;
  context.form = f.doc.createElement('form');
  context.input = f.doc.createElement('input'); context.input.value = 'question';
  context.matchesBox = f.doc.createElement('div');
  context.status = f.status;
  context.clearGuideAnswer = () => {};
  context.stopSearchLight = () => {};
  context.takeControl = () => { context.run++; };
  context.working = value => working.push(value);
  context.say = text => announcements.push(text);
  context.t = key => key;
  context.fmt = String;
  context.findTopics = () => context.matches;
  context.fillGuide = (topic, request) => new Promise((resolve, reject) => pending.push({ topic, request, resolve, reject }));
  vm.runInContext(heroSlice('    async function acceptGuide(tp) {', '    input.addEventListener(\'focus\''), context);
  const accept = context.acceptGuide;
  context.acceptGuide = topic => { const job = accept(topic); jobs.push(job); return job; };
  vm.runInContext(heroSlice("    form.addEventListener('submit'", '    function openGuide()'), context);
  const choose = method => {
    if (method === 'submit') context.form.dispatchEvent({ type: 'submit' });
    else { context.showMatches(); context.matchesBox.children[0].dispatchEvent({ type: 'click' }); }
  };
  return { context, pending, working, announcements, jobs, choose };
}
function installHeroHostChange(context) {
  const calls = { control: 0, settled: [], globe: 0 };
  context.root = context.document.createElement('div');
  context.dockSection = context.document.createElement('section');
  context.docked = false;
  const takeControl = context.takeControl;
  context.takeControl = () => { calls.control++; takeControl(); context.manual = true; };
  context.settled = request => { calls.settled.push(request); return Promise.resolve(); };
  context.syncGlobe = () => { calls.globe++; };
  const method = heroSlice('      onHostChange(nextHost) {', '\n    });\n    function movePhone');
  vm.runInContext('globalThis.applyHostChange = ({' + method + '}).onHostChange;', context);
  return calls;
}

(async () => {
  const f = fixture();
  const initialTitle = f.title.textContent;
  f.search.focus();
  for (const query of ['worry', 'f', 'fa', 'faj', 'fajr']) f.input(query);
  assert.equal(f.title.textContent, initialTitle, 'typing must not replace the reader');
  assert.equal(f.doc.activeElement, f.search, 'typing must retain input focus');
  assert.equal(f.scrolls.length, 0, 'typing must not scroll');
  const results = () => f.form.querySelectorAll('button').filter(b => b.dataset.guideResult);
  assert.equal(results()[0].dataset.guideResult, 'waking_for_fajr', 'Fajr title should rank above incidental editorial mention');
  f.submit();
  assert.equal(f.title.textContent, 'Waking for Fajr', 'explicit submit opens the top actual topic');
  assert.equal(f.scrolls.length, 1, 'explicit submit may navigate once');
  assert.equal(f.scrolls[0], f.form, 'explicit search keeps the illuminated query in view with its sources');
  assert(f.section.classList.contains('is-search-answer'), 'accepted search uses the centered source view');
  assert.equal(f.form.querySelector('.v-guide-results').hidden, true, 'accepted source is not separated from the query by duplicate matches');
  assert.equal(f.doc.activeElement, f.title, 'explicit source action focuses its heading');
  assert.equal(f.form.querySelector('.v-guide-field').dataset.state, 'matched');
  const olderAnimations = [...f.animations];
  f.input('forgiveness'); f.submit();
  assert.equal(f.title.textContent, 'Forgiveness and Repentance');
  assert(olderAnimations.every(a => a.cancelled), 'rapid new query cancels every older visual job');
  f.input('zyzzyvanotatopic');
  assert(!f.section.classList.contains('is-search-answer'), 'editing returns to discovery without remounting the field');
  assert.equal(results().length, 0);
  assert.equal(f.form.querySelector('.v-guide-submit').disabled, false, 'broader questions remain searchable');
  assert.match(f.status.textContent, /Search to explore/);
  const beforeEmpty = f.scrolls.length;
  f.submit();
  assert.equal(f.scrolls.length, beforeEmpty, 'no-match submit must not navigate to stale result');
  f.search.dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert.equal(f.search.value, '');
  assert.equal(f.doc.activeElement, f.search);
  assert.equal(f.form.querySelector('.v-guide-queries').hidden, false);
  f.input('worry');
  f.search.dispatchEvent({ type: 'keydown', key: 'ArrowDown' });
  assert.equal(f.doc.activeElement.dataset.guideResult, 'anxiety_and_worry');
  f.doc.dispatchEvent({ type: 'ummahti:guide-open', detail: { topicId: 'delayed_dua', query: 'unanswered dua' } });
  assert.equal(f.title.textContent, f.context.UMMAHTI_GUIDE.topics.find(tp => tp.id === 'delayed_dua').t);
  f.doc.hidden = true; f.doc.dispatchEvent({ type: 'visibilitychange' });
  assert(f.animations.every(a => a.cancelled), 'hidden tab cancels finite visual jobs');
  assert.equal(f.externalScripts.length, 0, 'cached passages do not create needless requests');
  const arriving = fixture();
  const arrivingField = arriving.io.at(-1);
  arrivingField.f([{ isIntersecting: false }]);
  arriving.doc.dispatchEvent({ type: 'ummahti:guide-open', detail: { topicId: 'waking_for_fajr', query: 'Fajr' } });
  assert.equal(arriving.title.textContent, 'Waking for Fajr', 'offscreen source selection is immediate');
  assert.equal(arriving.form.querySelector('.v-guide-field').dataset.light, 'settled');
  arrivingField.f([{ isIntersecting: true }]);
  assert.equal(arriving.form.querySelector('.v-guide-field').dataset.light, 'matched', 'hero-to-Guide navigation acknowledges when the actual input arrives');
  for (const lang of ['en', 'ar', 'ur', 'id']) {
    const local = fixture(lang, true);
    const topic = local.context.UMMAHTI_GUIDE.topics.find(tp => tp.id === 'anxiety_and_worry');
    local.input(topic.s); local.submit();
    assert.equal(local.title.textContent, topic.t, `${lang} exact reviewed scenario must select its topic`);
    assert.equal(local.animations.length, 0, `${lang} reduced motion has no animation jobs`);
  }
  const actualCorpus = { window: { UMMAHTI_AYAT: {} } };
  for (let n = 1; n <= 114; n++) vm.runInNewContext(read('media/v15/quran/s' + String(n).padStart(3, '0') + '.js'), actualCorpus);
  for (const lang of ['en', 'ar', 'ur', 'id']) {
    const all = fixture(lang, true); all.context.UMMAHTI_AYAT = actualCorpus.window.UMMAHTI_AYAT;
    for (const tp of all.context.UMMAHTI_GUIDE.topics) {
      all.doc.dispatchEvent({ type: 'ummahti:guide-open', detail: { topicId: tp.id, query: tp.t } });
      await Promise.resolve(); await Promise.resolve();
      assert.equal(all.title.textContent, tp.t, `${lang} displayed topic ${tp.id}`);
      for (let k = 0; k < tp.q.length; k++) {
        all.reader.querySelector('[data-guide-refs]').querySelectorAll('button')[k].dispatchEvent({ type: 'click' });
        await Promise.resolve(); await Promise.resolve();
        const [s, a, b] = tp.q[k], values = actualCorpus.window.UMMAHTI_AYAT[s].slice(a - 1, b);
        const arabic = all.reader.querySelector('[data-guide-ayah-ar]').textContent;
        assert(arabic.includes(values[0][0]) && arabic.includes(values.at(-1)[0]), `${lang} actual Arabic range ${tp.id} ${s}:${a}-${b}`);
        assert.equal(all.reader.querySelector('[data-guide-ayah-en]').textContent, values.map(v => v[1]).join(' '), `${lang} actual meaning matches selected reference ${tp.id}`);
      }
    }
    all.input('Happy'); all.submit();
    assert.equal(all.reader.hidden, true, `${lang} a new question hides the old answer while it resolves`);
    for (let n = 0; n < 4; n++) await Promise.resolve();
    assert.equal(all.reader.hidden, false, `${lang} Happy now opens a real sourced answer`);
    assert.equal(all.title.textContent, all.context.UMMAHTI_V15_I18N.guideJoyTitle);
    assert.match(all.reader.querySelector('[data-guide-ayah-ref]').textContent, /10[:：]58|١٠:٥٨|۱۰:۵۸/);
    assert.equal(all.form.querySelectorAll('button').filter(b => b.dataset.guideResult).length, 0);
  }
  const pending = fixture('en', false, false);
  const oldTag = pending.externalScripts[0];
  pending.input('fajr'); pending.submit();
  const newTopic = pending.context.UMMAHTI_GUIDE.topics.find(tp => tp.id === 'waking_for_fajr');
  const newSurah = newTopic.q[0][0];
  const newTag = pending.externalScripts.find(tag => tag.src.includes('/s' + String(newSurah).padStart(3, '0') + '.js'));
  assert.notEqual(oldTag, newTag, 'fixture exercises different outstanding sources');
  oldTag.onerror();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(pending.reader.querySelector('[data-guide-ayah-en]').textContent, '', 'stale failed source must not replace active loading passage');
  assert.equal(pending.reader.querySelector('[data-guide-ayah]').getAttribute('aria-busy'), 'true');
  pending.context.UMMAHTI_AYAT[newSurah] = Array.from({length: 300}, () => ['new-ar', 'new-en']);
  newTag.onload();
  await Promise.resolve(); await Promise.resolve();
  assert.match(pending.reader.querySelector('[data-guide-ayah-ar]').textContent, /new-ar/);
  assert.equal(pending.reader.querySelector('[data-guide-ayah]').getAttribute('aria-busy'), 'false');

  const late = fixture('en', false, false);
  const lateOldTag = late.externalScripts[0];
  late.input('fajr'); late.submit();
  const lateNewTag = late.externalScripts.find(tag => tag.src.includes('/s' + String(newSurah).padStart(3, '0') + '.js'));
  late.context.UMMAHTI_AYAT[newSurah] = Array.from({length: 300}, () => ['current-ar', 'current-en']);
  lateNewTag.onload();
  await Promise.resolve(); await Promise.resolve();
  const oldSurah = Number(lateOldTag.src.match(/\/s(\d+)\.js/)[1]);
  late.context.UMMAHTI_AYAT[oldSurah] = Array.from({length: 300}, () => ['obsolete-ar', 'obsolete-en']);
  lateOldTag.onload();
  await Promise.resolve(); await Promise.resolve();
  assert.match(late.reader.querySelector('[data-guide-ayah-ar]').textContent, /current-ar/, 'late old source success must not replace current passage');
  assert(!late.reader.querySelector('[data-guide-ayah-ar]').textContent.includes('obsolete-ar'));

  for (const failure of ['network', 'missing']) {
    const retry = fixture('en', false, false), firstTag = retry.externalScripts[0];
    if (failure === 'network') firstTag.onerror(); else firstTag.onload();
    await Promise.resolve(); await Promise.resolve();
    assert.match(retry.reader.querySelector('[data-guide-ayah-en]').textContent, /could not load/);
    const count = retry.externalScripts.length;
    retry.input('worry'); retry.submit();
    assert.equal(retry.externalScripts.length, count + 1, `${failure}: explicit same-topic selection retries the failed passage`);
    const tag = retry.externalScripts.at(-1), surah = Number(tag.src.match(/\/s(\d+)\.js/)[1]);
    assert.equal(tag.src, firstTag.src, 'retry requests the same actual passage');
    retry.submit();
    assert.equal(retry.externalScripts.length, count + 1, 'repeated submit while retry is busy never duplicates its request');
    retry.context.UMMAHTI_AYAT[surah] = Array.from({ length: 300 }, () => ['recovered-ar', 'recovered-en']);
    tag.onload(); await Promise.resolve(); await Promise.resolve();
    assert.match(retry.reader.querySelector('[data-guide-ayah-ar]').textContent, /recovered-ar/);
    assert.equal(retry.reader.querySelector('[data-guide-ayah]').getAttribute('aria-busy'), 'false');
    retry.submit();
    assert.equal(retry.externalScripts.length, count + 1, 'a successful same-topic selection reuses its source');
  }
  for (const failure of ['network', 'missing']) {
    const scripts = [], context = { window: {}, VERSION: 'fixture', document: {
      createElement: () => ({}), head: { appendChild: tag => scripts.push(tag) }
    } };
    vm.createContext(context);
    vm.runInContext(heroSlice('  const ayat =', '  const name ='), context);
    const first = context.surah(2);
    assert.equal(context.surah(2), first, 'hero passage requests share their actual in-flight promise');
    assert.equal(scripts.length, 1);
    const rejected = assert.rejects(first, new RegExp(failure === 'network' ? 'load' : 'missing'));
    if (failure === 'network') scripts[0].onerror(); else scripts[0].onload();
    await rejected;
    const retry = context.surah(2);
    assert.equal(scripts.length, 2, `${failure}: a failed hero source promise must leave the retry cache`);
    const ayat = [['real-ar', 'real-en']]; context.window.UMMAHTI_AYAT[2] = ayat;
    scripts[1].onload(); assert.equal(await retry, ayat);
    assert.equal(await context.surah(2), ayat); assert.equal(scripts.length, 2, 'loaded hero data stays cached');
  }

  const ime = fixture();
  ime.search.focus();
  const beforeComposition = ime.title.textContent;
  ime.search.dispatchEvent({type: 'compositionstart'});
  ime.input('fajr'); ime.submit();
  assert.equal(ime.title.textContent, beforeComposition, 'IME confirmation must not accidentally submit an unfinished query');
  assert.equal(ime.scrolls.length, 0);
  ime.search.dispatchEvent({type: 'compositionend'});
  ime.submit();
  assert.equal(ime.title.textContent, 'Waking for Fajr');

  const light = fixture();
  light.search.focus();
  const focusJobs = [...light.animations];
  assert(focusJobs.length > 0, 'focus must visibly activate the input instead of waiting for submit');
  assert.equal(focusJobs.length, 1, 'one angle owner drives the whole rim and matching bloom');
  assert.equal(focusJobs[0].opts.duration, 3200, 'flow follows the inspected reference cycle');
  assert.equal(focusJobs[0].opts.iterations, Infinity, 'the rim flows while the actual field is active');
  assert.equal(light.scrolls.length, 0, 'focus feedback does not navigate');
  light.input('worry');
  assert(focusJobs.every(job => job.cancelled), 'typing supersedes focus feedback');
  const typingJobs = light.animations.filter(job => !job.cancelled);
  const started = light.animations.length;
  light.input('worry'); light.input('worried');
  assert.equal(light.animations.length, started, 'successive letters keep the same travelling light instead of restarting it');
  assert(typingJobs.every(job => !job.cancelled));
  assert.equal(light.doc.activeElement, light.search);
  assert.equal(light.scrolls.length, 0);
  light.form.querySelector('.v-guide-submit').focus();
  assert(typingJobs.every(job => !job.cancelled), 'moving focus inside the search control preserves its feedback');
  light.submit();
  assert(typingJobs.every(job => job.cancelled), 'explicit search supersedes typing feedback');
  assert.equal(light.title.textContent, 'Anxiety and Worry', 'reviewed results are available before light completes');
  const matchedJobs = light.animations.filter(job => !job.cancelled && job.el !== light.reader);
  assert.equal(matchedJobs.length, 1, 'submitted light has one angle owner');
  light.flushTimers();
  assert(matchedJobs.every(job => job.cancelled), 'completed feedback releases its visual jobs');
  assert.equal(light.form.querySelector('.v-guide-field').dataset.light, 'settled');
  light.input('worry'); light.submit();
  const staleSettle = [...light.timers.values()][0];
  light.input('fajr');
  staleSettle();
  assert.equal(light.form.querySelector('.v-guide-field').dataset.light, 'typing', 'an obsolete surge cannot settle a new query');
  light.search.focus(); light.input('notareviewedtopiczyzzyva');
  assert.equal(light.form.querySelector('.v-guide-field').dataset.light, 'typing', 'a broader question still receives typing feedback');
  light.input('fajr');
  const fieldObserver = light.io.at(-1);
  fieldObserver.f([{ isIntersecting: false }]);
  assert(light.animations.filter(job => job.el !== light.reader).every(job => job.cancelled), 'leaving the actual field stops its light even while the section remains visible');
  const offscreenCount = light.animations.length;
  light.input('worry');
  assert.equal(light.animations.length, offscreenCount, 'offscreen input never starts invisible light');
  light.title.focus();
  fieldObserver.f([{ isIntersecting: true }]);
  assert.equal(light.animations.length, offscreenCount, 'returning into view with focus elsewhere does not restart feedback');
  fieldObserver.f([{ isIntersecting: false }]);
  light.search.focus(); light.input('fajr');
  const focusedOffscreenCount = light.animations.length;
  fieldObserver.f([{ isIntersecting: true }]);
  assert.equal(light.animations.length, focusedOffscreenCount + 1, 'a still-focused query resumes its light on actual field arrival');
  light.submit(); light.flushTimers();
  const settledCount = light.animations.length;
  light.doc.activeElement = light.search;
  fieldObserver.f([{ isIntersecting: false }]); fieldObserver.f([{ isIntersecting: true }]);
  assert.equal(light.animations.length, settledCount, 'a settled answer never restarts its light merely because its focused field returns');
  light.title.focus(); light.search.focus(); light.title.focus();
  assert(light.animations.filter(job => job.el !== light.reader).every(job => job.cancelled), 'leaving the field cancels focus feedback');
  light.search.focus(); light.input('fajr');
  light.reduced.matches = true;
  light.reduced.listeners.forEach(listener => listener());
  assert(light.animations.every(job => job.cancelled), 'turning on reduced motion cancels current feedback immediately');

  for (const method of ['submit', 'chip']) {
    for (const outcome of ['resolve', 'reject']) {
      const hero = heroAcceptanceFixture();
      hero.choose(method);
      const old = hero.pending[0];
      hero.context.run++; // Editing, changing scene or hiding cancels the old run.
      hero.context.matches = [{ t: 'current topic' }]; hero.choose(method);
      hero.pending[1].resolve(hero.pending[1].topic);
      await hero.jobs[1];
      assert.equal(hero.announcements.at(-1), 'current topic');
      const workCount = hero.working.length, announcementCount = hero.announcements.length;
      if (outcome === 'resolve') old.resolve(old.topic); else old.reject(new Error('cancelled'));
      await hero.jobs[0];
      assert.equal(hero.working.length, workCount, `stale ${method} ${outcome} cannot change current working state`);
      assert.equal(hero.announcements.length, announcementCount, `stale ${method} ${outcome} cannot replace current status`);
    }
  }
  {
    const hero = heroAcceptanceFixture(); hero.choose('submit');
    hero.pending[0].reject(new Error('load'));
    await hero.jobs[0];
    assert.equal(hero.working.at(-1), false, 'a current genuine failure releases working state');
    assert.equal(hero.announcements.at(-1), 'rLoadError', 'a current genuine failure remains discoverable');
  }
  {
    const hero = fixture(), context = hero.context;
    const form = hero.doc.createElement('form'), input = hero.doc.createElement('input'), screen = hero.doc.createElement('div');
    form.className = 'r-gh-search'; input.value = 'worry'; form.append(input); hero.doc.body.append(form);
    context.form = form; context.input = input; context.screen = screen; context.current = 'guide';
    const fieldLight = context.UmmahtiFieldLight.create(form, { still: () => hero.reduced.matches,
      visible: () => context.current === 'guide' && context.UmmahtiFieldLight.inViewport(form) });
    context.stopSearchLight = retain => fieldLight.stop({ retain });
    context.acknowledgeSearch = kind => fieldLight.activate(kind);
    context.findTopics = () => input.value === 'unmatched' ? [] : [{}];
    const observerCode = heroSlice('    const fieldVisibility = new IntersectionObserver', '    document.addEventListener(\'visibilitychange\', () => { stop();');
    vm.runInContext(observerCode, context);
    const fieldObserver = hero.io.at(-1);
    assert.equal(fieldObserver.target, form, 'hero light observes the actual field, not the whole phone');
    input.focus(); fieldLight.activate('typing');
    const rim = form.querySelector('.u-field-light');
    const activeRim = () => hero.animations.filter(job => job.el === rim && !job.cancelled);
    assert.equal(activeRim().length, 1);
    fieldObserver.f([{ isIntersecting: false }]);
    assert.equal(activeRim().length, 0, 'hero field leaving the viewport stops its flowing light');
    fieldObserver.f([{ isIntersecting: true }]);
    assert.equal(activeRim().length, 1, 'focused hero typing can resume on actual field arrival');
    fieldLight.activate('matched'); fieldObserver.f([{ isIntersecting: false }]);
    assert.equal(activeRim().length, 0); assert.equal(form.dataset.light, 'settled');
    fieldObserver.f([{ isIntersecting: true }]);
    assert.equal(activeRim().length, 0, 'accepted hero answer retains a still rim on reentry');
    fieldLight.stop(); context.current = 'read';
    fieldObserver.f([{ isIntersecting: false }]); fieldObserver.f([{ isIntersecting: true }]);
    assert.equal(activeRim().length, 0, 'another scene cannot reactivate the hidden Guide control');
    context.current = 'guide'; hero.title.focus();
    fieldObserver.f([{ isIntersecting: true }]);
    assert.equal(activeRim().length, 0, 'unfocused hero arrival never starts motion');
    input.value = 'unmatched'; input.focus(); fieldObserver.f([{ isIntersecting: true }]);
    assert.equal(activeRim().length, 1, 'a broader query resumes typing light before its Quran search');
  }
  {
    const sizeLine = heroCode.split('\n').find(line => line.includes('const sizeSlot ='));
    assert(sizeLine, 'Locate the shipped slot sizing boundary.');
    const sizeSlot = vm.runInNewContext(sizeLine + '\nsizeSlot;');
    for (const width of [257.59375, 321.375]) {
      const slot = { clientWidth: Math.round(width), style: {}, getBoundingClientRect: () => ({ width }) };
      sizeSlot(slot);
      const screenRatio = (parseFloat(slot.style.height) - 14) / (width - 14);
      assert(Math.abs(screenRatio - 910 / 420) < 1e-10, 'fractional slot width preserves source-screen geometry beyond the fixed bezel');
    }
  }
  {
    const hero = heroAcceptanceFixture(); hero.choose('submit');
    const context = hero.context; context.manual = true;
    const light = context.UmmahtiFieldLight.create(context.form, { still: () => false });
    light.activate('typing');
    const calls = installHeroHostChange(context), request = context.run;
    const query = context.input.value, workCount = hero.working.length;
    context.applyHostChange('dock');
    assert.equal(context.run, request, 'manual docking preserves the pending search generation');
    assert.equal(calls.control, 0, 'manual docking never calls cancellation through takeControl');
    assert.equal(calls.settled.length, 0, 'manual docking never replaces a user query with the automatic settled preview');
    assert.equal(context.input.value, query); assert.equal(hero.working.length, workCount);
    assert.equal(light.isActive(), true, 'moving the manual phone does not stop its current field light');
    hero.pending[0].resolve(hero.pending[0].topic); await hero.jobs[0];
    assert.equal(hero.announcements.at(-1), 'older topic', 'a pending manual result still completes after docking');
    assert(context.root.classList.contains('is-docked')); assert(context.dockSection.classList.contains('has-phone'));
    context.applyHostChange('home');
    assert.equal(calls.control, 0); assert.equal(context.run, request);
    light.stop();
  }
  {
    const hero = heroAcceptanceFixture(), context = hero.context; context.manual = false;
    const calls = installHeroHostChange(context);
    context.applyHostChange('dock');
    assert.equal(calls.control, 1, 'automatic docking still takes control of the timed preview');
    assert.deepEqual(calls.settled, [context.run], 'automatic docking settles once using the new current run');
    context.applyHostChange('dock');
    assert.equal(calls.control, 1); assert.equal(calls.settled.length, 1, 'same-host reconciliation cannot restart settling');
  }
  {
    const calls = [], location = { hash: '' };
    let reduced = false;
    const destination = {
      setAttribute: (key, value) => calls.push(['attribute', key, value]),
      focus: options => calls.push(['focus', options]),
      scrollIntoView: options => calls.push(['scroll', options])
    };
    const context = vm.createContext({
      document: { querySelector: selector => selector === '#reciters' ? destination : null },
      location, history: { pushState: (state, title, hash) => { location.hash = hash; calls.push(['history', hash]); } },
      takeControl: () => calls.push(['control']), still: () => reduced, phone: {},
      $$: () => [{ addEventListener: (event, callback) => handlers.push(callback) }]
    });
    vm.runInContext(heroSlice('    function openSection(selector) {', "    $('[data-r-read-play]'"), context);
    context.openSection('#reciters');
    assert.equal(location.hash, '#reciters', 'the reciter destination remains refreshable');
    assert.deepEqual(calls.map(call => call[0]), ['control', 'history', 'attribute', 'focus', 'scroll']);
    assert.equal(calls.at(-2)[1].preventScroll, true, 'destination focus precedes scrolling without moving the page');
    assert.equal(calls.at(-1)[1].behavior, 'smooth');
    reduced = true; context.openSection('#reciters');
    assert.equal(calls.at(-1)[1].behavior, 'auto', 'reduced motion bypasses smooth navigation');
    assert.equal(calls.filter(call => call[0] === 'history').length, 1, 'repeat navigation does not duplicate the same fragment entry');
    const beforeMissing = calls.length; context.openSection('#missing');
    assert.equal(calls.length, beforeMissing, 'a missing destination cannot cancel the current preview or change its URL');
  }
  {
    const broad = fixture();
    broad.input('Happy'); broad.submit();
    for (let n=0;n<6;n++) await Promise.resolve();
    assert.equal(broad.title.textContent,'Joy, gratitude and a peaceful heart');
    broad.reader.querySelector('[data-guide-refs]').children[1].dispatchEvent({type:'click'});
    await Promise.resolve();
    assert.match(broad.reader.querySelector('[data-guide-ayah-ref]').textContent,/13:28/);
    broad.input('2:255'); broad.submit();
    for (let n=0;n<6;n++) await Promise.resolve();
    assert.match(broad.reader.querySelector('[data-guide-ayah-ref]').textContent,/2:255/);
    // A lazy index response arriving after another question cannot replace it.
    const cached=broad.context.UMMAHTI_GUIDE_INDEX;
    broad.context.UMMAHTI_GUIDE_INDEX = null;
    broad.input('iron'); broad.submit();
    const tag=broad.externalScripts.at(-1);
    assert.match(tag.src,/guide-index/);
    assert.equal(broad.form.getAttribute('aria-busy'),'true');
    broad.input('Fajr'); broad.submit();
    broad.context.UMMAHTI_GUIDE_INDEX=cached; tag.onload();
    for(let n=0;n<8;n++) await Promise.resolve();
    assert.equal(broad.title.textContent,'Waking for Fajr');
    assert.equal(broad.form.getAttribute('aria-busy'),'false');
    const failed=fixture();
    failed.context.UMMAHTI_GUIDE_INDEX = null;
    failed.input('iron'); failed.submit(); failed.externalScripts.at(-1).onerror();
    for(let n=0;n<8;n++) await Promise.resolve();
    assert.match(failed.status.textContent,/could not load/);
    assert.equal(failed.form.querySelector('.v-guide-submit').disabled,false);
    failed.context.UMMAHTI_GUIDE_INDEX=cached; failed.submit();
    for(let n=0;n<8;n++) await Promise.resolve();
    assert.equal(failed.title.textContent,'Quran passages to explore');
    assert.equal(failed.reader.hidden,false);
  }
  {
    let replaced=0;
    const card={dataset:{guideQuery:'Happy'},classList:{contains:()=>true}};
    const context=vm.createContext({current:'guide',userQuery:true,card,input:{value:'Happy'},topic:{id:'quran-search'},findTopics:()=>[],showMatches:()=>replaced++});
    vm.runInContext(heroSlice('    async function settled(id) {','    async function loop(id) {'),context);
    await context.settled(1);assert.equal(replaced,0,'accepted broad answer survives scene reselection and phone docking');
    context.input.value='another question';await context.settled(1);assert.equal(replaced,1,'a different query cannot reuse the previous broad answer');
  }
  console.log('PASS: actual Guide script — typing stability, prepared and full-Quran answers, direct references, lazy failure/retry, stale-index cancellation, retained broad answer through docking, focus/IME, keyboard access, four locales, reduced motion.');
  console.log('PASS: all 86 topics and every selected Quran reference display their exact corpus range and meaning in all four locales; Happy replaces old answers with cited joy passages.');
  console.log('PASS: superseded asynchronous passage success/failure cannot overwrite the current source; active source settles busy state; IME confirmation stays separate from submit.');
  console.log('PASS: same-topic Guide failures retry, busy retries deduplicate, and both source loaders recover after network or missing-payload rejection.');
  console.log('PASS: full-rim flow has one phase owner, continuous active typing, immediate results, bounded submit surge and static settlement; no-match/blur/offscreen/reduced cancellation and stale-timer safety.');
  console.log('PASS: actual hero submit/chip handlers ignore stale success/cancellation; current failures report; actual-field visibility cancels flow, focused queries resume, and accepted/unfocused/inactive states stay still.');
  console.log('PASS: actual hero slot sizing preserves the source-screen ratio at fractional layout widths.');
  console.log('PASS: actual dock callback preserves pending manual query/result/run/light and settles an automatic preview once.');
  console.log('PASS: explicit section navigation focuses before scrolling, preserves fragments and honors reduced motion; playback controls are local buttons.');
})().catch(e => { console.error(e); process.exitCode = 1; });
