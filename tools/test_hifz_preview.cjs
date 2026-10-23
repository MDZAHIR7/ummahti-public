/* Run the shipped Hifz controller against its real corpus, without a browser.
   This verifies behavior/data boundaries; rendered geometry is checked separately. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const source = read('v15-renders.js');
const start = source.indexOf('  function hifzDemo(root) {');
const end = source.indexOf('  /* ---------------- The channel wall', start);
assert(start >= 0 && end > start, 'Locate the actual shipped Hifz controller.');
const body = source.slice(start, end);
assert(!/new\s+Audio|AudioContext|getUserMedia|SpeechRecognition|rListening|data-r-voice/.test(body), 'Hifz must contain no audio, speech capture or simulated-hearing path.');

const assets = { window: {} };
for (const file of ['moon-data.js', 'renders-data.js']) {
  vm.runInNewContext(read('media/v15/' + file), assets);
}
vm.runInNewContext(read('v15-hifz-preview.js'), assets);
const MOON = assets.window.UMMAHTI_MOON;
const D = assets.window.UMMAHTI_RENDERS;
const parserStart = body.indexOf('    function parseReference(value) {');
const parserEnd = body.indexOf('    async function submitReference', parserStart);
assert(parserStart >= 0 && parserEnd > parserStart, 'Locate the actual reference parser.');
const parse = vm.runInNewContext('(' + body.slice(parserStart, parserEnd).trim() + ')', { MOON, window: assets.window });
const validReferences = [
  ['67:1-10', 67, 1, 10], ['Al-Mulk 1–10', 67, 1, 10],
  ['Surah Al-Mulk 1', 67, 1, 1], ['المُلۡكِ ١-١٠', 67, 1, 10],
  ['سورة الملك ١-١٠', 67, 1, 10], ['۶۷:۱–۱۰', 67, 1, 10],
  ['الملک ۱-۱۰', 67, 1, 10], ['55/1-13', 55, 1, 13],
  ['2:255', 2, 255, 255], ['الفاتحة 1-7', 1, 1, 7]
];
for (const [value, s, a, b] of validReferences) {
  assert.equal(JSON.stringify(parse(value)), JSON.stringify({ s, a, b }), value);
}
const invalidReferences = ['', 'hello', '999:1', '0:1', '67:0', '67:10-1', '67:1-31', '2:287'];
for (const value of invalidReferences) assert(parse(value).error, value);

// A new visit has no saved visitor data. Exercise real canonical ranges explicitly.
const seededRecord = /const record = (\[\]);/.exec(body);
assert(seededRecord, 'The example record starts empty.');
const record = vm.runInNewContext(seededRecord[1]);
const upsertStart = body.indexOf('    function upsertPassage(passage) {');
const upsertEnd = body.indexOf('    function paintRecord()', upsertStart);
assert(upsertStart >= 0 && upsertEnd > upsertStart, 'Locate the shipped passage update.');
const upsert = vm.runInNewContext('(' + body.slice(upsertStart, upsertEnd).trim() + ')', { record, window: assets.window });
const ranges = s => JSON.stringify(record.filter(p => p.s === s).map(p => [p.a, p.b, p.st]));
function coverage() {
  const seen = new Set();
  for (const p of record) for (let a = p.a; a <= p.b; a++) {
    const key = p.s + ':' + a;
    assert(!seen.has(key), 'Each ayah has one current state: ' + key);
    seen.add(key);
  }
  return seen.size;
}
assert.equal(coverage(), 0);
upsert({ s: 67, a: 1, b: 30, st: 'learn' });
upsert({ s: 67, a: 1, b: 10, st: 'learn' });
assert.equal(ranges(67), '[[1,30,"learn"]]', 'Saving a seeded subrange in the same state does not duplicate it.');
upsert({ s: 67, a: 1, b: 10, st: 'mem' });
assert.equal(ranges(67), '[[1,10,"mem"],[11,30,"learn"]]');
upsert({ s: 67, a: 4, b: 6, st: 'rev' });
assert.equal(ranges(67), '[[1,3,"mem"],[4,6,"rev"],[7,10,"mem"],[11,30,"learn"]]', 'Partial replacement retains both outside boundaries.');
assert.equal(coverage(), 30);
upsert({ s: 67, a: 1, b: 30, st: 'mem' });
assert.equal(ranges(67), '[[1,30,"mem"]]', 'A complete replacement joins the passage again.');
upsert({ s: 2, a: 255, b: 255, st: 'learn' });
assert.equal(ranges(2), '[[255,255,"learn"]]');
assert.equal(ranges(67), '[[1,30,"mem"]]', 'Updating another surah preserves its neighbours.');
assert.equal(coverage(), 31);

class Element {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.attrs = {};
    this.listeners = {};
    this.textContent = '';
    this.value = '';
    this.disabled = false;
    this.hidden = false;
    this.children = [];
    const classes = new Set();
    this.classList = {
      add: value => classes.add(value), remove: value => classes.delete(value),
      toggle: (value, on) => on ? classes.add(value) : classes.delete(value),
      contains: value => classes.has(value)
    };
  }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  removeAttribute(key) { delete this.attrs[key]; }
  toggleAttribute(key, on) { if (on) this.attrs[key] = ''; else delete this.attrs[key]; }
  addEventListener(event, handler) { this.listeners[event] = handler; }
  append(element) { this.children.push(element); }
  focus() { this.focused = true; }
  getContext() { return {}; }
  getBoundingClientRect() { return { width: 300, height: 600, left: 0, top: 0 }; }
}
const nodes = new Map();
const modes = ['recite', 'say', 'choose'].map(rMode => new Element({ rMode }));
const states = ['learn', 'mem', 'rev'].map(rState => new Element({ rState }));
const steps = ['from:-1', 'from:1', 'to:-1', 'to:1'].map(rStep => new Element({ rStep }));
function one(selector) {
  if (selector === '[data-r-state][aria-pressed=true]') return states.find(element => element.attrs['aria-pressed'] === 'true');
  if (!nodes.has(selector)) nodes.set(selector, new Element());
  return nodes.get(selector);
}
function all(selector) {
  if (selector === '[data-r-mode]') return modes;
  if (selector === '[data-r-state]') return states;
  if (selector === '[data-r-step]') return steps;
  if (selector === '[data-r-save], [data-r-reference-submit], [data-r-pick-next]') return ['[data-r-save]', '[data-r-reference-submit]', '[data-r-pick-next]'].map(one);
  return [];
}
const copy = JSON.parse(read('i18n/v15.json')).en;
const timers = new Map(), frames = new Map(), documentEvents = new Map();
let nextTimer = 0, nextFrame = 0, audioAttempts = 0, microphoneAttempts = 0;
const requests = [], corpusCache = new Map();
function corpus(surah) {
  if (!corpusCache.has(surah)) {
    const scope = { window: {} };
    vm.runInNewContext(read('media/v15/quran/s' + String(surah).padStart(3, '0') + '.js'), scope);
    corpusCache.set(surah, scope.window.UMMAHTI_AYAT[surah]);
  }
  return corpusCache.get(surah);
}
function forbiddenAudio() { audioAttempts++; throw new Error('Hifz must not construct an audio player or audio context.'); }
function forbiddenMicrophone() { microphoneAttempts++; throw new Error('Hifz must not request speech or microphone access.'); }
let delayRequest = false, resolveDelayed;
const document = {
  hidden: false, createElement: () => new Element(),
  addEventListener: (event, handler) => documentEvents.set(event, handler)
};
const scope = {
  root: new Element(), MOON, $: one, $$: all, tilt() {}, fmt: String,
  window: { ...assets.window, UMMAHTI_RENDERS: D, Audio: forbiddenAudio, AudioContext: forbiddenAudio, webkitAudioContext: forbiddenAudio, SpeechRecognition: forbiddenMicrophone },
  Audio: forbiddenAudio, AudioContext: forbiddenAudio,
  navigator: { mediaDevices: { getUserMedia: forbiddenMicrophone } },
  t: (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.split('{' + name + '}').join(value), copy[key] || key),
  name: n => MOON.names[n - 1],
  surah: async n => {
    requests.push(n);
    if (delayRequest) await new Promise(resolve => { resolveDelayed = resolve; });
    return corpus(n);
  },
  still: () => true, document,
  getComputedStyle: () => ({ getPropertyValue: () => '212,175,55' }),
  IntersectionObserver: class { observe() {} }, ResizeObserver: class { observe() {} },
  requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; },
  cancelAnimationFrame: id => frames.delete(id),
  setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; },
  clearTimeout: id => timers.delete(id), performance: { now: () => 0 }
};
vm.runInNewContext(body + ';hifzDemo(root);', scope);
const emit = async (element, event) => element.listeners[event]?.({ preventDefault() {}, currentTarget: element, target: element });
const tick = () => new Promise(resolve => setImmediate(resolve));

async function main() {
  // Reading aloud is a visitor instruction, not a trigger for a hidden recognizer.
  assert.equal(one('.r-screen').dataset.step, 'idle');
  assert.equal(one('[data-r-hifz-prompt]').textContent, D.ayah.arabic);
  assert.equal(one('[data-r-found-ref]').textContent, '');
  assert.equal(requests.length, 0, 'Initialization must not produce an automatic recognition result.');
  assert.equal(timers.size, 0, 'Initialization must not schedule a fake recognition result.');
  assert.equal(one('[data-r-rec-sum]').textContent, '0 ayahs in 0 surahs');
  await emit(one('[data-r-review-example]'), 'click');
  assert.equal(one('.r-screen').dataset.step, 'found');
  assert.equal(one('[data-r-first]').textContent, D.ayah.arabic);
  assert(one('[data-r-hz-status]').textContent.includes('Review'));
  assert.equal(one('[data-r-save]').disabled, true, 'State is never preselected.');
  await emit(one('[data-r-save]'), 'click');
  assert.equal(one('.r-screen').dataset.step, 'found', 'Save without a state cannot write the record.');
  await emit(states[0], 'click'); await emit(one('[data-r-save]'), 'click');
  assert.equal(one('.r-screen').dataset.step, 'saved');
  assert.equal(one('[data-r-rec-sum]').textContent, '1 ayahs in 1 surahs');
  assert.equal(timers.size, 0, 'A saved confirmation has no automatic dismissal.');
  await emit(one('[data-r-add-another]'), 'click');
  assert.equal(one('.r-screen').dataset.step, 'idle');
  assert(states.every(button => button.attrs['aria-pressed'] === 'false'), 'Add another carries no selected state.');

  await emit(modes[1], 'click');
  assert.equal(one('.r-screen').dataset.step, 'say');
  assert.equal(one('[data-r-reference]').value, '', 'No automatically typed spoken reference.');
  one('[data-r-reference]').value = '67:1–10';
  const beforeTyping = requests.length;
  await emit(one('[data-r-reference]'), 'input');
  assert.equal(requests.length, beforeTyping, 'Typing does not navigate or produce a match.');
  await emit(one('[data-r-reference-form]'), 'submit');
  assert.equal(one('[data-r-first]').textContent, corpus(67)[0][0]);
  assert.equal(one('[data-r-last]').textContent, corpus(67)[9][0]);
  assert.equal(one('[data-r-save]').disabled, true);
  await emit(states[0], 'click');
  await emit(one('[data-r-save]'), 'click');
  assert.equal(one('[data-r-rec-sum]').textContent, '11 ayahs in 2 surahs');
  await emit(one('[data-r-add-another]'), 'click');
  assert.equal(one('[data-r-reference]').value, '', 'Add another carries no old reference.');
  one('[data-r-reference]').value = '67:1–10';
  await emit(one('[data-r-reference-form]'), 'submit');
  await emit(states[0], 'click'); await emit(one('[data-r-save]'), 'click');
  assert.equal(one('[data-r-rec-sum]').textContent, '11 ayahs in 2 surahs', 'An overlapping save never inflates unique coverage.');
  assert.equal(one('[data-r-rec-learn]').textContent, '2');
  await emit(modes[1], 'click'); one('[data-r-reference]').value = '67:4–6';
  await emit(one('[data-r-reference-form]'), 'submit'); await emit(states[1], 'click');
  await emit(one('[data-r-save]'), 'click');
  assert.equal(one('[data-r-rec-sum]').textContent, '11 ayahs in 2 surahs');
  assert.equal(one('[data-r-rec-mem]').textContent, '1');
  assert.equal(one('[data-r-rec-learn]').textContent, '3', 'The two outside Al-Mulk ranges retain learning state.');

  for (const invalid of ['999:1', '67:1-31', '67:10-1']) {
    await emit(modes[1], 'click'); one('[data-r-reference]').value = invalid;
    const beforeInvalid = requests.length;
    await emit(one('[data-r-reference-form]'), 'submit');
    assert.equal(one('[data-r-reference]').attrs['aria-invalid'], 'true');
    assert(one('[data-r-reference-error]').textContent.length > 0);
    assert.equal(requests.length, beforeInvalid, 'Invalid references cannot request corpus data.');
  }

  await emit(modes[1], 'click'); one('[data-r-reference]').value = '67:1–10'; delayRequest = true;
  const pendingEdit = emit(one('[data-r-reference-form]'), 'submit');
  one('[data-r-reference]').value = '67:2–4'; await emit(one('[data-r-reference]'), 'input');
  assert.equal(one('[data-r-reference-submit]').disabled, false, 'Editing releases the obsolete loading state.');
  delayRequest = false; resolveDelayed(); await pendingEdit;
  assert.equal(one('.r-screen').dataset.step, 'say', 'An old response cannot open after a reference edit.');
  await emit(one('[data-r-reference-form]'), 'submit');
  assert.equal(one('[data-r-first]').textContent, corpus(67)[1][0]);
  assert.equal(one('[data-r-last]').textContent, corpus(67)[3][0]);

  await emit(modes[1], 'click'); one('[data-r-reference]').value = '67:1–10'; delayRequest = true;
  const pendingInvalid = emit(one('[data-r-reference-form]'), 'submit');
  one('[data-r-reference]').value = '67:1–99';
  await emit(one('[data-r-reference-form]'), 'submit');
  assert.equal(one('[data-r-reference-submit]').disabled, false, 'An invalid submission releases the obsolete loading state.');
  delayRequest = false; resolveDelayed(); await pendingInvalid;
  assert.equal(one('.r-screen').dataset.step, 'say', 'An invalid replacement submission also cancels an old response.');
  assert.equal(one('[data-r-reference]').attrs['aria-invalid'], 'true');
  assert(one('[data-r-reference-error]').textContent.includes('30'));

  await emit(modes[2], 'click'); await tick();
  assert.equal(one('[data-r-pick-first]').textContent, corpus(55)[0][0]);
  await emit(steps[1], 'click'); await tick();
  await emit(one('[data-r-pick-next]'), 'click');
  assert.equal(one('[data-r-first]').textContent, corpus(55)[1][0]);
  assert.equal(one('[data-r-last]').textContent, corpus(55)[12][0]);
  await emit(states[2], 'click');
  await emit(one('[data-r-save]'), 'click');
  assert.equal(one('[data-r-save]').disabled, true);
  assert.equal(one('[data-r-rec-sum]').textContent, '23 ayahs in 3 surahs');
  assert.equal(one('.r-screen').dataset.step, 'saved');
  assert.equal(timers.size, 0);
  await emit(modes[1], 'click');
  assert.equal(one('.r-screen').dataset.mode, 'say');
  assert.equal(one('.r-screen').dataset.step, 'say', 'An old save callback cannot replace a newer pane.');

  one('[data-r-reference]').value = '67:1–10'; delayRequest = true;
  const pending = emit(one('[data-r-reference-form]'), 'submit');
  await emit(modes[0], 'click'); delayRequest = false; resolveDelayed(); await pending;
  assert.equal(one('.r-screen').dataset.step, 'idle', 'A stale corpus response cannot overwrite the chosen mode.');
  assert.equal(one('[data-r-reference-submit]').disabled, false);

  await emit(one('[data-r-review-example]'), 'click');
  await emit(states[0], 'click');
  await emit(one('[data-r-save]'), 'click');
  document.hidden = true; documentEvents.get('visibilitychange')();
  assert.equal(one('.r-screen').dataset.step, 'saved', 'The explicit saved result survives visibility changes.');
  assert.equal(timers.size, 0);
  document.hidden = false;
  await emit(one('[data-r-reset]'), 'click');
  assert.equal(one('[data-r-rec-sum]').textContent, '0 ayahs in 0 surahs');
  assert.equal(one('.r-screen').dataset.step, 'idle');
  assert.equal(one('[data-r-save]').disabled, true);
  assert(states.every(button => button.attrs['aria-pressed'] === 'false'));
  await emit(modes[1], 'click'); one('[data-r-reference]').value = '67:1–10'; delayRequest = true;
  const beforeReset = emit(one('[data-r-reference-form]'), 'submit');
  await emit(one('[data-r-reset]'), 'click'); delayRequest = false; resolveDelayed(); await beforeReset;
  assert.equal(one('.r-screen').dataset.step, 'idle', 'Reset cancels an unresolved corpus request.');
  assert.equal(one('[data-r-rec-sum]').textContent, '0 ayahs in 0 surahs');
  assert.equal(audioAttempts, 0); assert.equal(microphoneAttempts, 0);
  console.log(JSON.stringify({ passed: true, parserCases: validReferences.length + invalidReferences.length, checks: ['empty record and explicit known-example reveal', 'no automatic result/audio/microphone', 'explicit state required on every review', 'typed-reference corpus boundaries', 'invalid reference bounds', 'edit/invalid-submit stale-response cancellation', 'unique ayah totals and state replacement', 'partial-overlap boundaries and same-state merge', 'manual-range corpus boundaries', 'stable saved result and Add another', 'reset and stale corpus cancellation', 'hidden-state cleanup'], corpusRequests: requests }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
