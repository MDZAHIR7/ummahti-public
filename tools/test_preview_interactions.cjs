'use strict';
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), path = require('node:path');
const rootPath = path.resolve(__dirname, '..'), read = name => fs.readFileSync(path.join(rootPath, name), 'utf8');
class Element {
  constructor(tag = 'div') { this.tagName = tag; this.events = {}; this.attrs = {}; this.dataset = {}; this.hidden = false; this.disabled = false; this.value = ''; this.textContent = ''; this.children = []; this.style = { setProperty(k, v) { this[k] = v; } }; const classes = new Set(); this.classList = { add: (...items) => items.forEach(x => classes.add(x)), remove: (...items) => items.forEach(x => classes.delete(x)), contains: key => classes.has(key), toggle(key, on = !classes.has(key)) { on ? classes.add(key) : classes.delete(key); } }; }
  addEventListener(key, fn) { (this.events[key] ||= []).push(fn); }
  async emit(type, extra = {}) { const event = { type, target: this, currentTarget: this, preventDefault() {}, ...extra }; for (const fn of this.events[type] || []) await fn(event); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k === 'src' ? this.src || null : this.attrs[k] ?? null; }
  removeAttribute(k) { delete this.attrs[k]; }
  append(node) { this.children.push(node); }
  replaceChildren(...nodes) { this.children = nodes; }
  querySelector(s) { return this.nodes?.[s] || null; }
  querySelectorAll(s) { return this.groups?.[s] || []; }
  focus() { this.focused = true; }
}
class Audio extends Element {
  constructor() { super('audio'); this.paused = true; this.currentTime = 0; this.duration = 10; this.jobs = []; }
  play() { this.paused = false; return new Promise((resolve, reject) => this.jobs.push({ resolve, reject })); }
  pause() { this.paused = true; this.emit('pause'); }
}
function environment() {
  const document = new Element('document'); document.hidden = false;
  document.createElement = tag => tag === 'audio' ? new Audio() : new Element(tag);
  document.dispatchEvent = event => document.emit(event.type, event);
  const observers = [];
  const context = vm.createContext({ window: {}, document,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    IntersectionObserver: class { constructor(fn) { this.callback = fn; observers.push(this); } observe() {} }
  });
  const copy = JSON.parse(read('i18n/v15.json')).en;
  const t = (key, vars = {}) => Object.entries(vars).reduce((s, [k, v]) => s.replaceAll('{' + k + '}', String(v)), copy[key] || key);
  return { document, context, observers, t };
}
async function testAudio() {
  const e = environment(); vm.runInContext(read('v15-preview-audio.js'), e.context);
  function make() { const host = new Element(), button = new Element('button'), status = new Element(), progress = new Element(), icon = new Element(); button.nodes = { '[data-audio-icon]': icon }; const player = e.context.window.UmmahtiPreviewAudio.create({ root: host, button, status, progress, t: e.t }); return { ...player, button, status, progress, icon }; }
  const player = make(), other = make();
  const manifest = JSON.parse(read('media/recitation/preview/manifest.json'));
  for (const clip of manifest.clips) {
    player.set(clip.surah, clip.ayah, clip.voice);
    assert.equal(player.audio.dataset.reference, clip.surah + ':' + clip.ayah);
    assert.equal(player.audio.src, '/media/recitation/preview/' + clip.path);
    assert(player.audio.paused, 'choosing an ayah/voice never autoplays');
  }
  assert.throws(() => player.set(93, 12), /Unsupported/);
  assert.throws(() => player.set(2, 1), /Unsupported/);
  assert.throws(() => player.set(1, 1, 'unknown'), /Unsupported/);
  player.set(1, 2, 'alafasy'); await player.button.emit('click'); const old = player.audio.jobs.at(-1);
  assert.equal(player.button.attrs['aria-busy'], 'true');
  assert.match(player.status.textContent, /1:2/);
  player.set(1, 7, 'husary'); old.reject(new Error('old load aborted')); await Promise.resolve();
  assert.notEqual(player.button.dataset.audioState, 'error', 'old play rejection cannot break the new verse');
  await player.button.emit('click'); await player.audio.emit('playing');
  assert.equal(player.button.attrs['aria-pressed'], 'true'); assert.equal(player.icon.textContent, 'Ⅱ'); assert.match(player.status.textContent, /Playing 1:7/);
  player.audio.currentTime = 5; await player.audio.emit('timeupdate'); assert.equal(player.progress.style['--p'], '0.5');
  other.set(93, 1); await other.button.emit('click'); assert(player.audio.paused, 'starting another player pauses this one');
  await other.audio.emit('error'); assert.equal(other.button.dataset.audioState, 'error'); assert.equal(other.button.disabled, false, 'failure remains retryable');
  await other.button.emit('click'); assert.equal(other.button.dataset.audioState, 'loading'); await other.audio.emit('playing');
  await other.button.emit('click'); assert(other.audio.paused); assert.equal(other.button.attrs['aria-pressed'], 'false');
  await player.button.emit('click'); e.document.hidden = true; await e.document.emit('visibilitychange'); assert(player.audio.paused);
  e.document.hidden = false; await player.button.emit('click'); e.observers[0].callback([{ isIntersecting: false }]); assert(player.audio.paused);
  await player.button.emit('click'); await player.audio.emit('playing'); await player.audio.emit('ended'); assert.match(player.status.textContent, /finished/); assert.equal(player.progress.style['--p'], '0');
}
async function testHeroHifz() {
  const e = environment(); vm.runInContext(read('media/v15/moon-data.js'), e.context); vm.runInContext(read('v15-hifz-preview.js'), e.context);
  const moon = e.context.window.UMMAHTI_MOON;
  const host = new Element(), nodes = {};
  for (const selector of ['[data-hh-root]', '[data-hh-form]', '[data-hh-reference]', '[data-hh-status]', '[data-hh-review]', '[data-hh-saved]', '[data-hh-save]', '[type=submit]', '[data-hh-ref]', '[data-hh-first]', '[data-hh-last]', '[data-hh-last-row]', '[data-hh-example]', '[data-hh-saved-detail]', '[data-hh-count]', '[data-hh-change]', '[data-hh-another]', '[data-hh-reset]']) nodes[selector] = new Element();
  const states = ['learn', 'mem', 'rev'].map(state => { const button = new Element(); button.dataset.hhState = state; return button; });
  host.nodes = nodes; nodes['[data-hh-root]'].nodes = nodes; nodes['[data-hh-root]'].groups = { '[data-hh-state]': states }; nodes['[data-hh-form]'].nodes = nodes;
  let deferred, calls = 0;
  const corpus = n => { const scope = { window: { UMMAHTI_AYAT: {} } }; vm.runInNewContext(read('media/v15/quran/s' + String(n).padStart(3, '0') + '.js'), scope); return scope.window.UMMAHTI_AYAT[n]; };
  const preview = e.context.window.UmmahtiHifzPreview.createHero(host, { moon, loadSurah: n => deferred ? new Promise(resolve => { deferred = () => resolve(corpus(n)); }) : Promise.resolve(corpus(n)), name: n => moon.names[n - 1], format: String, t: e.t, onInteract: () => calls++ });
  preview.setActive(true);
  assert.equal(nodes['[data-hh-root]'].dataset.hifzStep, 'entry'); assert.equal(nodes['[data-hh-save]'].disabled, true);
  nodes['[data-hh-reference]'].value = '67:1-10'; await nodes['[data-hh-form]'].emit('submit');
  assert.equal(nodes['[data-hh-root]'].dataset.hifzStep, 'review'); assert.equal(nodes['[data-hh-first]'].textContent, corpus(67)[0][0]); assert.equal(nodes['[data-hh-last]'].textContent, corpus(67)[9][0]);
  assert.equal(nodes['[data-hh-save]'].disabled, true);
  await states[1].emit('click'); await nodes['[data-hh-save]'].emit('click');
  assert.equal(nodes['[data-hh-root]'].dataset.hifzStep, 'saved'); assert.match(nodes['[data-hh-count]'].textContent, /10 ayahs/);
  await nodes['[data-hh-another]'].emit('click'); nodes['[data-hh-reference]'].value = '67:5-12'; await nodes['[data-hh-form]'].emit('submit'); await states[2].emit('click'); await nodes['[data-hh-save]'].emit('click'); assert.match(nodes['[data-hh-count]'].textContent, /12 ayahs/, 'overlap never duplicates ayahs');
  await nodes['[data-hh-reset]'].emit('click'); assert.match(nodes['[data-hh-status]'].textContent, /No passages saved/);
  nodes['[data-hh-reference]'].value = '67:1-99'; await nodes['[data-hh-form]'].emit('submit'); assert.equal(nodes['[data-hh-reference]'].attrs['aria-invalid'], 'true'); assert.equal(nodes['[data-hh-root]'].dataset.hifzStep, 'entry');
  nodes['[data-hh-reference]'].value = '55:1-13'; deferred = true; const pending = nodes['[data-hh-form]'].emit('submit'); await nodes['[data-hh-reset]'].emit('click'); deferred(); await pending; assert.equal(nodes['[data-hh-root]'].dataset.hifzStep, 'entry', 'reset cancels stale passage results'); assert(calls > 0);
}
async function testReadSourceRecovery() {
  const e = environment(), source = read('v15-renders.js'), phone = new Element(), nodes = {};
  for (const key of ['play', 'retry', 'status']) nodes['[data-r-read-' + key + ']'] = new Element();
  nodes['[data-r-sc-lines]'] = new Element(); phone.nodes = nodes;
  let missing = true, deferred = false, resolveOld; const selected = [], corpus = Array.from({ length: 7 }, (_, i) => ['ayah' + (i + 1), 'meaning' + (i + 1)]);
  Object.assign(e.context, { phone, $: (selector, host) => host.querySelector(selector), run: 0, readAt: 0, readList: [], t: e.t,
    surah: () => deferred ? new Promise(resolve => resolveOld = () => resolve(corpus)) : Promise.resolve(missing ? null : corpus),
    check: id => { if (id !== e.context.run) throw new Error('cancelled'); }, selectRead: i => selected.push(i), takeControl() {} });
  const start = source.indexOf('    async function fillRead('), end = source.indexOf('    async function previewRead(', start);
  vm.runInContext(source.slice(start, end), e.context);
  assert.equal(await e.context.fillRead(), false); assert(nodes['[data-r-read-play]'].disabled); assert(!nodes['[data-r-read-retry]'].hidden); assert.match(nodes['[data-r-read-status]'].textContent, /could not load/);
  missing = false; assert.equal(await e.context.fillRead(), true); assert(!nodes['[data-r-read-play]'].disabled); assert(nodes['[data-r-read-retry]'].hidden); assert.equal(nodes['[data-r-sc-lines]'].children.length, 7);
  deferred = true; const old = e.context.fillRead(); e.context.run++; deferred = false; await e.context.fillRead(); const count = selected.length; resolveOld(); await assert.rejects(old, /cancelled/); assert.equal(selected.length, count);
}
function testCatalogue() {
  for (const locale of ['en', 'ar', 'ur', 'id']) {
    const scope = { window: {} }; vm.runInNewContext(read('media/v15/guide-' + locale + '.js'), scope); vm.runInNewContext(read('v15-guide-search.js'), scope);
    const topics = scope.window.UMMAHTI_GUIDE.topics, matcher = scope.window.UmmahtiGuideSearch.create(topics);
    for (let i = 0; i < topics.length; i++) {
      assert.equal(matcher.search(topics[i].t)[0], i, locale + ' exact title ' + topics[i].id);
      assert(matcher.search(topics[i].s).includes(i), locale + ' exact scenario ' + topics[i].id);
    }
    for (const input of ['Happy', 'happy', 'I am happy', 'joy', 'happy marriage', 'not happy', 'unhappy', 'zyzzyvanotatopic', 'worry marriage', '']) assert.equal(matcher.search(input).length, 0, input + ' must not create an unsupported answer');
    for (const [query, expected] of [['unhappy marriage', 'marriage_difficulty'], ['fajr', 'waking_for_fajr'], ['fear', 'fear_of_the_future'], ['grateful', 'gratitude'], ['unanswered dua', 'delayed_dua']]) assert.equal(topics[matcher.search(query)[0]]?.id, expected, locale + ' ' + query);
  }
  const template = read('tools/v15-home.html');
  const hero = template.slice(template.indexOf('data-r-guide-hero'), template.indexOf('data-r-preview-controls'));
  assert(!/href="#reciters"/.test(hero), 'no preview play/reset control navigates to another section');
}
function testWorkbenchScope() {
  const source = read('v15.js'), scope = { window: {} }; vm.runInNewContext(read('media/v15/content.js'), scope);
  const result = new Element(), externalTitle = new Element(); externalTitle.textContent = 'External Guide remains selected';
  result.nodes = Object.fromEntries(['ref', 'title', 'arabic', 'translation'].map(key => ['[data-guide-' + key + ']', new Element()]));
  const context = vm.createContext({ $: (selector, parent) => parent ? parent.querySelector(selector) : selector === '[data-guide-result]' ? result : externalTitle,
    $$: () => [], verse: ref => scope.window.UMMAHTI_CONTENT.verses[ref], refresh: (el, draw) => draw(), t: key => key });
  const start = source.indexOf(' const guideExamples='), end = source.indexOf(" if($('[data-guide-result]'))", start);
  vm.runInContext(source.slice(start, end), context);
  for (const [choice, ref, title] of [['worry', '13:28', 'worryTitle'], ['return', '39:53', 'returnTitle'], ['patience', '94:5', 'patienceTitle']]) {
    context.guideResult(choice); assert.equal(result.nodes['[data-guide-title]'].textContent, title); assert.equal(result.nodes['[data-guide-arabic]'].textContent, scope.window.UMMAHTI_CONTENT.verses[ref].arabic); assert.equal(externalTitle.textContent, 'External Guide remains selected');
  }
}
async function testReciterOwnership() {
  const source = read('verse.js'), e = environment(), audio = new Audio(), button = new Element(), hint = new Element(), bar = new Element();
  const rows = [{ dataset: { clip: 'alafasy' } }, { dataset: { clip: 'husary' } }];
  Object.assign(e.context, { audio, playBtn: button, hintEl: hint, barEl: bar, rows, index: 0, transport: 0, missing: new Set(), GONE: 'gone', BLOCKED: 'blocked', PLAY: 'play' });
  const fail = source.slice(source.indexOf('  function fail(message)'), source.indexOf('  /* Which clip failed'));
  const start = source.slice(source.indexOf('  function start()'), source.indexOf("  playBtn.addEventListener('click'"));
  vm.runInContext(fail + start, e.context); audio.src = 'alafasy.mp3'; e.context.start(); const old = audio.jobs.at(-1);
  e.context.index = 1; e.context.transport++; audio.src = 'husary.mp3'; e.context.start(); old.reject(new Error('old source')); await Promise.resolve(); assert.equal(hint.textContent, '', 'late old play failure must not disable the newly selected reciter');
  audio.jobs.at(-1).reject(new Error('current blocked')); await Promise.resolve(); assert.equal(hint.textContent, 'blocked'); assert.equal(button.disabled, false, 'permission/network failure leaves a retry path');
}
async function testWheelKeys() {
  const source = read('verse.js'), list = new Element(), positions = [], context = vm.createContext({ list, rows: Array.from({ length: 12 }, () => ({})), itemH: 42, index: 0, intended: null, reduced: { matches: false }, playBtn: new Element() });
  list.scrollTop = 0; list.scrollTo = value => positions.push(value.top);
  context.select = i => context.index = i;
  const movement = source.slice(source.indexOf('  function land()'), source.indexOf('  /* ----------------------------------------------------------- the voice'));
  const keys = source.slice(source.indexOf("  list.addEventListener('keydown'"), source.indexOf('  /* A drum inside'));
  vm.runInContext(movement + keys, context);
  for (let i = 0; i < 3; i++) await list.emit('keydown', { key: 'ArrowDown' });
  assert.deepEqual(positions, [42, 84, 126], 'repeated keys advance while native motion is still in flight');
  list.scrollTop = 126; context.land(); assert.equal(context.index, 3); assert.equal(context.intended, null);
  await list.emit('keydown', { key: 'End' }); assert.equal(positions.at(-1), 11 * 42);
  await list.emit('keydown', { key: 'ArrowDown' }); assert.equal(positions.at(-1), 11 * 42, 'clamp at final reciter');
  await list.emit('keydown', { key: 'Home' }); assert.equal(positions.at(-1), 0);
}
async function testWallLifecycle() {
  const source = read('v15-renders.js'), e = environment(), root = new Element(), tile = new Element(), video = new Audio(), reduced = new Element(), motion = new Element();
  tile.nodes = { video }; let still = false, id = 0; const frames = new Map();
  e.document.querySelector = () => motion;
  Object.assign(e.context, { $: (selector, parent) => parent ? parent.querySelector(selector) : null, $$: selector => selector === '.r-tile' ? [tile] : [], root,
    still: () => still, reduced, matchMedia: () => ({ matches: true }), navigator: { connection: new Element() }, scrollY: 0, innerWidth: 1280, performance: { now: () => 0 }, queueMicrotask,
    requestAnimationFrame: fn => { frames.set(++id, fn); return id; }, cancelAnimationFrame: key => frames.delete(key), setTimeout, clearTimeout,
    ResizeObserver: class { observe() {} } });
  const start = source.indexOf('  function wall(root)'), end = source.indexOf('  /* ---------------- Hero:', start);
  vm.runInContext(source.slice(start, end) + '\nwall(root);', e.context);
  const observer = e.observers[0]; observer.callback([{ isIntersecting: true }]); assert.equal(frames.size, 1);
  await tile.emit('pointerenter'); const old = video.jobs.at(-1); await tile.emit('pointerleave'); old.resolve(); await Promise.resolve(); assert(!tile.classList.contains('is-playing'));
  await tile.emit('pointerenter'); video.jobs.at(-1).resolve(); await Promise.resolve(); assert(tile.classList.contains('is-playing'));
  observer.callback([{ isIntersecting: false }]); assert(video.paused); assert.equal(frames.size, 0); assert(!tile.classList.contains('is-playing'));
  observer.callback([{ isIntersecting: true }]); assert.equal(frames.size, 1); still = true; await reduced.emit('change'); assert.equal(frames.size, 0); assert(root.classList.contains('is-static'));
  still = false; await reduced.emit('change'); assert.equal(frames.size, 1); e.document.hidden = true; await e.document.emit('visibilitychange'); assert.equal(frames.size, 0); assert(video.paused);
}
async function testFilmLifecycle() {
  const e = environment(), source = read('v15.js'), film = new Element(), video = new Audio(), control = new Element(), reduced = new Element();
  film.classList.add('v-story-film'); video.muted = true; video.dataset.src = 'local-film.mp4'; video.load = () => video.error = null;
  film.nodes = { '[data-logo-video]': video, '[data-logo-toggle]': control };
  e.context.window.IntersectionObserver = e.context.IntersectionObserver;
  Object.assign(e.context, { $: (selector, parent) => parent.querySelector(selector), $$: () => [film], reduced, connection: new Element(), t: e.t, automatically: () => !e.document.hidden });
  const start = source.indexOf(" $$('[data-logo-film]').forEach(film=>{"), end = source.indexOf('\n });', start) + '\n });'.length;
  vm.runInContext(source.slice(start, end), e.context);
  const observer = e.observers[0]; observer.callback([{ isIntersecting: true }]); const old = video.jobs.at(-1);
  observer.callback([{ isIntersecting: false }]); old.reject(new Error('old cancelled playback')); await Promise.resolve(); assert(film.children[0].hidden, 'old play rejection cannot show a film error after stopping');
  observer.callback([{ isIntersecting: true }]); await video.emit('playing'); assert(film.classList.contains('is-playing'));
  await control.emit('click'); assert(video.paused); assert(!film.classList.contains('is-playing'));
  await control.emit('click'); video.jobs.at(-1).reject(new Error('current failure')); await Promise.resolve(); assert(!film.children[0].hidden); assert(!control.hidden); assert(video.paused, 'failed film can retry on the next click');
  await control.emit('click'); assert(!video.paused); await video.emit('playing'); assert(film.children[0].hidden);
  video.muted = false; await e.document.emit('ummahti:audio-start', { detail: { audio: {} } }); assert(video.paused, 'another audible player stops the film');
  await control.emit('click'); e.document.hidden = true; await e.document.emit('visibilitychange'); assert(video.paused);
}
function testMoonTransitionHit() {
  const source = read('v15-moon.js'), context = vm.createContext({ current: { a: 'P', b: 'M', alpha: 1 }, N: 3, rest: [10, 10, 50, 50, 90, 90], document: { elementFromPoint: () => ({ closest: () => false }) }, ignore: 'button', discs: { P: [{ x: 25, y: 25, r: 8 }] }, lightPos: [], juzOf: [0, 0, 1] });
  const start = source.indexOf('  function nearest('), end = source.indexOf('  function point(', start);
  vm.runInContext(source.slice(start, end), context);
  assert.equal(context.target({ clientX: 51, clientY: 51 }, 12).index, 1, 'a visible ayah remains tappable when scrolling stops mid-transformation');
  context.current.alpha = .3; assert.equal(context.target({ clientX: 51, clientY: 51 }, 12).index, 1, 'fading story points remain tappable before settling into the decorative background');
  context.current.alpha = 1;
  context.current.b = 'P'; assert.equal(context.target({ clientX: 25, clientY: 25 }, 12).group, 0, 'settled daily portions keep their group behavior');
  context.current.alpha = .3; assert.equal(context.target({ clientX: 25, clientY: 25 }, 12).group, -1, 'faint background remains non-interactive');
  context.current.alpha = 1; context.document.elementFromPoint = () => ({ closest: () => true }); assert.equal(context.target({ clientX: 25, clientY: 25 }, 12).group, -1, 'real controls keep priority');
}
function testMoonClickInput() {
  const source = read('v15-moon.js'), handlers = {}, opens = [], context = vm.createContext({ addEventListener: (type, handler) => handlers[type] = handler,
    target: () => ({ index: 9, group: -1, light: -1 }), current: { a: 'P' }, openCard: i => opens.push(i), openLightCard() {}, card: { hidden: true }, juzFirst: [], portions: [] });
  const start = source.indexOf('  let down = null'), end = source.indexOf("  addEventListener('pointermove'", start);
  vm.runInContext(source.slice(start, end), context);
  const event = (x = 200) => ({ clientX: x, clientY: 200, target: { closest: () => null } });
  handlers.click(event()); assert.equal(opens.length, 1, 'click-only browser/assistive input activates the visible verse');
  handlers.pointerdown(event()); handlers.pointerup(event()); handlers.click(event()); assert.equal(opens.length, 2, 'a normal pointer sequence activates only once');
  handlers.pointerdown(event()); handlers.pointerup(event(250)); handlers.click(event(250)); assert.equal(opens.length, 2, 'a drag is not a verse tap');
  handlers.pointerdown(event()); handlers.pointercancel(); handlers.click(event()); assert.equal(opens.length, 2, 'cancelled touch does not activate');
}
function testMoonCanvasGeometry() {
  const source = read('v15-moon.js'), canvas = { getBoundingClientRect: () => ({ width: 1264.666748, height: 720 }) };
  const context = vm.createContext({ canvas, root: { clientWidth: 1265 }, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1.5, touch: { matches: false }, vw: 0, vh: 0, dpr: 1 });
  const start = source.indexOf('  function layout()'), end = source.indexOf('    const wide =', start);
  vm.runInContext(source.slice(start, end) + '\n}\nlayout();', context);
  assert.equal(context.vw, 1264.666748); assert.equal(canvas.width, Math.round(1264.666748 * 1.5)); assert.equal(canvas.height, 1080);
  canvas.getBoundingClientRect = () => ({ width: 305, height: 740 }); context.touch.matches = true; context.devicePixelRatio = 3;
  context.layout(); assert.equal(canvas.width, Math.round(305 * 1.5), 'coarse-pointer DPR cap and narrow CSS geometry stay aligned');
}
function testMoonReadingSurvivesDraw() {
  const source = read('v15-moon.js'), start = source.indexOf('    if (steps.length) {', source.indexOf('  function draw(')), end = source.indexOf('  let lightTimer =', start);
  const tail = source.slice(start, end).trim(); assert(tail.endsWith('}'));
  let dismissals = 0;
  const context = { steps: [], mag: { s: 0, ts: 0, x: 0, y: 0, tx: 0, ty: 0 }, paceTween: 1, gliding: false, glide: {}, now: 0, live: false, skyLayer: null,
    intro: 1, meteors: [], wave: -1, card: { hidden: false }, selected: 4, moving: true, closeCard: () => dismissals++, request() {}, clearTimeout, setTimeout, touch: { matches: false } };
  vm.runInNewContext('(function(){\n' + tail.slice(0, -1) + '\n})', context)();
  assert.equal(dismissals, 0, 'a rendering frame must not dismiss a verse opened during an intermediate formation');
  assert.equal(context.card.hidden, false);
}
(async () => { testCatalogue(); testWorkbenchScope(); testMoonTransitionHit(); testMoonClickInput(); testMoonCanvasGeometry(); testMoonReadingSurvivesDraw(); await testAudio(); await testHeroHifz(); await testReadSourceRecovery(); await testReciterOwnership(); await testWheelKeys(); await testWallLifecycle(); await testFilmLifecycle(); console.log('PASS: all 344 Guide titles/scenarios, unsupported/ambiguous queries, 3 workbench result scopes, 52 exact ayah/voice audio coordinates, playback/pause/retry/interruption/exclusivity, hero Hifz real range/save/overlap/reset/error, Read source recovery, reciter ownership/repeated keys, moon CSS geometry/click/drag/cancel/read-during-draw, wall/film lifecycle.'); })().catch(error => { console.error(error); process.exitCode = 1; });
