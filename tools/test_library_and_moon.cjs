/* node tools/test_library_and_moon.cjs
   Executes the shipped library controller and moon card/loader handlers against
   real public catalogues/corpus. Checks ownership and displayed/copy consistency;
   it does not verify browser layout, native clipboard permission, or motion feel. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function dom(lang = 'en', reduce = false) {
  let doc, timerId = 0;
  const animations = [], scripts = [], timers = new Map(), clipboard = [];
  const descendants = n => n.children.flatMap(c => [c, ...descendants(c)]);
  const matches = (n, s) => s.startsWith('.') ? n.className.split(/\s+/).includes(s.slice(1)) : s.startsWith('[') ? Object.hasOwn(n.attributes, s.slice(1, -1)) : n.tagName.toLowerCase() === s;
  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.children = []; this.attributes = {}; this.listeners = {}; this.dataset = {}; this.className = ''; this._text = ''; this.hidden = false;
      this.style = { setProperty() {} };
      this.classList = {
        contains: x => this.className.split(/\s+/).includes(x),
        add: (...xs) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...xs])].join(' '); },
        remove: (...xs) => { this.className = this.className.split(/\s+/).filter(x => !xs.includes(x)).join(' '); },
        toggle: (x, on) => { on ??= !this.classList.contains(x); on ? this.classList.add(x) : this.classList.remove(x); return on; }
      };
    }
    set textContent(v) { this._text = String(v); this.children = []; }
    get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
    append(...ns) { for (let n of ns) { if (typeof n === 'string') { const text = new Element('#text'); text.textContent = n; n = text; } n.remove(); this.children.push(n); n.parentNode = this; if (this === doc.head && n.tagName === 'SCRIPT') scripts.push(n); } }
    replaceChildren(...ns) { this.children.forEach(n => n.parentNode = null); this.children = []; this._text = ''; this.append(...ns); }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(n => n !== this); this.parentNode = null; }
    set innerHTML(html) {
      this.replaceChildren();
      const stack = [this];
      for (const m of html.matchAll(/<\/?([\w-]+)([^>]*)>/g)) {
        if (m[0].startsWith('</')) { stack.pop(); continue; }
        const child = new Element(m[1]);
        for (const a of m[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) child.setAttribute(a[1], a[2] || '');
        stack.at(-1).append(child);
        if (!['img','br','input','source'].includes(m[1])) stack.push(child);
      }
    }
    setAttribute(k, v) { this.attributes[k] = String(v); if (k === 'class') this.className = String(v); if (k === 'hidden') this.hidden = true; }
    getAttribute(k) { return this.attributes[k] ?? null; }
    removeAttribute(k) { delete this.attributes[k]; }
    querySelectorAll(s) { return descendants(this).filter(n => matches(n, s)); }
    querySelector(s) { return this.querySelectorAll(s)[0] || null; }
    closest(s) { for (let n = this; n; n = n.parentNode) if (matches(n, s)) return n; return null; }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    dispatchEvent(e) { e.target ||= this; e.preventDefault ||= () => {}; for (const fn of this.listeners[e.type] || []) fn(e); }
    click() { if (!this.disabled) this.dispatchEvent({ type: 'click' }); }
    focus() { doc.activeElement = this; }
    getBoundingClientRect() { return { left: 50, top: 100, width: 360, height: 280 }; }
    animate(frames, options) { const a = { frames, options, cancelled: false, cancel() { this.cancelled = true; } }; animations.push(a); return a; }
  }
  doc = new Element('document'); doc.documentElement = new Element('html'); doc.documentElement.lang = lang; doc.documentElement.dir = ['ar','ur'].includes(lang) ? 'rtl' : 'ltr';
  doc.head = new Element('head'); doc.body = new Element('body'); doc.append(doc.head, doc.body); doc.createElement = t => new Element(t); doc.hidden = false;
  const add = (host, tag, attr, cls = '') => { const n = new Element(tag); if (attr) n.setAttribute(attr, ''); n.className = cls; host.append(n); return n; };
  const reduced = { matches: reduce, listeners: [], addEventListener(_, fn) { this.listeners.push(fn); } };
  const context = { document: doc, console, Intl, Map, Set, Float32Array, Uint16Array, Array, Math,
    matchMedia: () => reduced,
    navigator: { clipboard: { writeText: text => new Promise((resolve, reject) => clipboard.push({ text, resolve, reject })) } },
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id)
  };
  context.window = context; vm.createContext(context);
  return { doc, context, add, reduced, scripts, animations, clipboard, timers };
}
function libraryFixture(lang = 'en', reduce = false) {
  const f = dom(lang, reduce), { add, doc, context } = f;
  const dua = add(doc.body, 'section', 'data-duas');
  const rosette = add(dua, 'div', 'data-dua-rosette');
  const page = add(dua, 'article', 'data-dua-page');
  add(dua, 'div', 'data-dua-collections');
  for (const attr of ['collection','title','arabic','translit','meaning','occasion','source','pos','copy','prev','next']) add(page, ['copy','prev','next'].includes(attr) ? 'button' : 'p', 'data-dua-' + attr);
  const refl = add(doc.body, 'section', 'data-reflections');
  const mosaic = add(refl, 'div', 'data-refl-mosaic');
  const card = add(refl, 'article', 'data-refl-card');
  const people = add(refl, 'div', 'data-refl-people');
  add(refl, 'button', 'data-refl-shuffle');
  for (const attr of ['theme','title','body','ayah','ayah-ar','ayah-en','source']) add(card, 'p', 'data-refl-' + attr);
  vm.runInContext(read(`media/v15/library-${lang}.js`), context);
  vm.runInContext(read(`i18n/v15-${lang}.js`), context);
  vm.runInContext(read('v15-library.js'), context);
  const data = context.UMMAHTI_LIBRARY;
  const petalNodes = rosette.querySelectorAll('.v-petal'), tiles = mosaic.querySelectorAll('.v-tile');
  const petals = data.duas.map(d => petalNodes.find(n => n.getAttribute('aria-label') === d.t + ' · ' + data.collections[d.k]));
  // Tile DOM order is grouped by first theme, while the catalogue keeps its own order.
  const tile = i => tiles.find(n => n.getAttribute('aria-label') === data.reflections[i].t);
  const complete = (tag, payload = true) => {
    const n = Number(tag.src.match(/s(\d+)\.js/)[1]);
    if (payload) vm.runInContext(read(`media/v15/quran/s${String(n).padStart(3,'0')}.js`), context);
    tag.onload();
  };
  return { ...f, page, card, petals, tile, people, data, complete, copy: page.querySelector('[data-dua-copy]') };
}
function moonFixture() {
  const f = dom(), { context } = f;
  context.reduced = f.reduced;
  context.tip = f.doc.createElement('div');
  Object.assign(context, { D: { basmala: 'fixture-basmala' }, rtl: false, lang: 'en', N: 3, VERSION: 'fixture', selected: -1, openLight: -1, scrollY: 0, vw: 1200, vh: 800,
    surahOf: [0,1,2], ayahOf: [1,1,1], drawn: [100,150,110,160,120,170], digits: new Intl.NumberFormat('en'),
    lights: [{ kind: 'hadith', collection: 'fixture', reference: '1', grade: '', text: { en: 'fixture narration' }, url: 'https://example.test/' }], lightPos: [{ x: 120, y: 170 }],
    t: (_, fallback) => fallback, fmt: (_, fallback, vars) => fallback.replace('{n}', vars.n), ref: i => `fixture ${i}`, request() {}
  });
  const code = read('v15-moon.js'), first = code.indexOf("  const card = document.createElement('div');"), last = code.indexOf('  /* ---------------------------------------------- pointing */', first);
  assert(first >= 0 && last > first, 'Locate shipped moon card/loader block');
  vm.runInContext(code.slice(first, last), context);
  vm.runInContext('globalThis.api = { card, openCard, closeCard, openLightCard };', context);
  return { ...f, ...context.api };
}
(async () => {
  for (const lang of ['en','ar','ur','id']) {
    const f = libraryFixture(lang, true);
    for (let i = 0; i < f.data.duas.length; i++) {
      f.petals[i].click();
      for (const tag of f.scripts.filter(t => t.parentNode)) f.complete(tag);
      await flush();
      const d = f.data.duas[i];
      assert.equal(f.page.querySelector('[data-dua-title]').textContent, d.t, `${lang} selected dua title`);
      assert.equal(f.copy.disabled, false, `${lang} loaded dua is copyable`);
      assert.equal(f.page.getAttribute('aria-busy'), 'false');
      assert(f.page.querySelector('[data-dua-arabic]').textContent.length > 0);
    }
    for (let i = 0; i < f.data.reflections.length; i++) {
      f.tile(i).click();
      for (const tag of f.scripts.filter(t => t.parentNode)) f.complete(tag);
      await flush();
      assert.equal(f.card.querySelector('[data-refl-title]').textContent, f.data.reflections[i].t, `${lang} selected reflection title`);
      assert.equal(f.card.getAttribute('aria-busy'), 'false');
    }
    assert.equal(f.animations.length, 0, 'Reduced motion keeps library navigation still');
  }
  for (const outcome of ['success','failure']) {
    const f = libraryFixture(), qs = f.data.duas.map((d,i) => ({d,i})).filter(x => x.d.q);
    const a = qs[0], b = qs.find(x => x.d.q[0] !== a.d.q[0]);
    f.petals[a.i].click(); const old = f.scripts.at(-1);
    f.petals[b.i].click(); const now = f.scripts.at(-1);
    assert.equal(f.page.querySelector('[data-dua-title]').textContent, b.d.t, 'Selection fills immediately');
    assert.equal(f.page.querySelector('[data-dua-meaning]').textContent, '', 'Loading never retains a different meaning');
    f.copy.click(); assert.equal(f.clipboard.length, 0, 'Loading text cannot be copied');
    f.complete(now); await flush();
    const current = f.page.querySelector('[data-dua-arabic]').textContent;
    outcome === 'success' ? f.complete(old) : old.onerror(); await flush();
    assert.equal(f.page.querySelector('[data-dua-arabic]').textContent, current, 'Stale dua source cannot overwrite current content');
    f.copy.click(); const copied = f.clipboard.at(-1);
    assert(copied.text.includes(current), 'Clipboard uses the displayed Arabic');
    f.petals[a.i].click(); copied.resolve(); await flush();
    assert.notEqual(f.copy.textContent, f.context.UMMAHTI_V15_I18N.duaCopied, 'Old clipboard completion cannot mark a newer selection copied');
    assert(f.animations.slice(0,-1).every(a => a.cancelled), 'Selection cancels previous transitions');
  }
  for (const sourceFailure of ['network','missing-payload']) {
    const f = libraryFixture(), i = f.data.duas.findIndex(d => d.q);
    f.petals[i].click(); const old = f.scripts.at(-1);
    sourceFailure === 'network' ? old.onerror() : f.complete(old, false); await flush();
    assert.equal(f.copy.disabled, true); assert.equal(f.page.getAttribute('aria-busy'), 'false');
    f.petals[i].click(); const retry = f.scripts.at(-1);
    assert.notEqual(retry, old, 'Same selected failed dua starts a fresh source request');
    f.complete(retry); await flush(); assert.equal(f.copy.disabled, false);
  }
  {
    const f = libraryFixture(), qs = f.data.reflections.map((r,i) => ({r,i})).filter(x => x.r.q), a = qs[0], b = qs.find(x => x.r.q[0] !== a.r.q[0]);
    f.tile(a.i).click(); const old = f.scripts.at(-1);
    f.tile(b.i).click(); f.complete(f.scripts.at(-1)); await flush();
    const ar = f.card.querySelector('[data-refl-ayah-ar]').textContent;
    old.onerror(); await flush(); assert.equal(f.card.querySelector('[data-refl-ayah-ar]').textContent, ar, 'Stale reflection failure cannot erase current ayah');
    for (let k = 1; k < f.people.children.length; k++) {
      f.people.children[k].click();
      for (let i = 0; i < f.data.reflections.length; i++) assert.equal(f.tile(i).disabled, f.data.reflections[i].p !== k - 1, 'Excluded reflection controls are actually disabled');
    }
    f.doc.hidden = true; f.doc.dispatchEvent({ type: 'visibilitychange' });
    assert(f.animations.every(a => a.cancelled), 'Hidden library has no remaining transition');
  }
  {
    const f = moonFixture();
    f.openCard(0,100,150); const first = f.scripts.at(-1);
    f.closeCard(); const close = f.animations.at(-1), staleFinish = close.onfinish;
    f.openCard(1,110,160); assert(close.cancelled, 'Reopen cancels old close');
    staleFinish(); assert.equal(f.card.hidden, false, 'Even a stale close callback cannot hide the new card');
    f.context.UMMAHTI_AYAT = { 2: [['current-ar','current-en']] }; f.scripts.at(-1).onload(); await flush();
    first.onerror(); await flush();
    assert.equal(f.card.querySelector('[data-verse-arabic]').textContent, 'current-ar');
    assert.equal(f.card.getAttribute('aria-busy'), 'false');
    f.closeCard(false); assert.equal(f.card.hidden, true);
  }
  for (const sourceFailure of ['network','missing-payload']) {
    const f = moonFixture(); f.openCard(0,100,150); const old = f.scripts.at(-1);
    sourceFailure === 'network' ? old.onerror() : old.onload(); await flush();
    f.openCard(0,100,150); const retry = f.scripts.at(-1); assert.notEqual(retry, old, 'Moon source can retry after either failure');
    f.context.UMMAHTI_AYAT = { 1: [['retry-ar','retry-en']] }; retry.onload(); await flush();
    assert.equal(f.card.querySelector('[data-verse-arabic]').textContent, 'retry-ar');
    f.openCard(1,110,160); const pending = f.scripts.at(-1); f.openLightCard(0);
    pending.onerror(); await flush(); assert.equal(f.card.querySelector('[data-verse-translation]').textContent, 'fixture narration', 'Old ayah failure cannot overwrite a narration');
  }
  console.log('PASS: actual library handlers — every dua/reflection in four locales, source/copy consistency, stale success/failure, retry, filter ownership, cancellation and reduced motion; actual moon card handlers — close/reopen ownership, stale source, narration handoff, missing-payload/network retry.');
})().catch(e => { console.error(e); process.exitCode = 1; });
