/* Exercise the shipped manual hero Hifz controller and real Quran corpus. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const source = read('v15-hifz-preview.js');
const data = { window: {} };
vm.runInNewContext(read('media/v15/moon-data.js'), data);
const moon = data.window.UMMAHTI_MOON;
const copy = JSON.parse(read('i18n/v15.json')).en;
const corpus = new Map();
function verses(s) {
  if (!corpus.has(s)) {
    const context = { window: {} };
    vm.runInNewContext(read('media/v15/quran/s' + String(s).padStart(3, '0') + '.js'), context);
    corpus.set(s, context.window.UMMAHTI_AYAT[s]);
  }
  return corpus.get(s);
}
function fixture() {
  const nodes = new Map(), focused = [], announcements = [], requests = [], pending = [];
  const events = new Map(); let interactions = 0, forbiddenAttempts = 0, delayed = false;
  class Element {
    constructor(dataset = {}) { this.dataset = dataset; this.attrs = {}; this.listeners = {}; this.hidden = false; this.disabled = false; this.textContent = ''; this.value = ''; }
    querySelector(selector) { return get(selector); }
    querySelectorAll(selector) { return selector === '[data-hh-state]' ? states : []; }
    addEventListener(type, listener) { this.listeners[type] = listener; }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    removeAttribute(key) { delete this.attrs[key]; }
    focus() { focused.push(this); }
  }
  const get = selector => { if (!nodes.has(selector)) nodes.set(selector, new Element()); return nodes.get(selector); };
  const states = ['learn', 'mem', 'rev'].map(hhState => new Element({ hhState }));
  const doc = { hidden: false, addEventListener: (type, listener) => events.set(type, listener) };
  const forbidden = () => { forbiddenAttempts++; throw new Error('No audio, speech capture, navigation or timed fake result.'); };
  const scope = {
    window: {}, document: doc, Audio: forbidden, AudioContext: forbidden,
    SpeechRecognition: forbidden, navigator: { mediaDevices: { getUserMedia: forbidden } },
    setTimeout: forbidden, requestAnimationFrame: forbidden,
    history: { pushState: forbidden }, location: { assign: forbidden }
  };
  vm.runInNewContext(source, scope);
  const controller = scope.window.UmmahtiHifzPreview.createHero(new Element(), {
    moon, loadSurah: async s => { requests.push(s); if (delayed) await new Promise(resolve => pending.push(resolve)); return verses(s); },
    name: s => moon.names[s - 1], format: String,
    t: (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.split('{' + name + '}').join(value), copy[key] || key),
    onInteract: () => { interactions++; }, announce: text => announcements.push(text)
  });
  const emit = async (element, type) => element.listeners[type]?.({ preventDefault() {}, target: element, currentTarget: element });
  const click = async selector => { await emit(get(selector), 'click'); await Promise.resolve(); await Promise.resolve(); };
  const input = async value => { get('[data-hh-reference]').value = value; await emit(get('[data-hh-reference]'), 'input'); };
  const submit = () => emit(get('[data-hh-form]'), 'submit');
  controller.setActive(true);
  return { get, states, controller, click, input, submit, emit, doc, events, focused, requests, announcements,
    setDelayed(value) { delayed = value; }, resolve() { pending.shift()?.(); },
    interactions: () => interactions, forbidden: () => forbiddenAttempts };
}
async function main() {
  const f = fixture(), pane = () => f.get('[data-hh-root]').dataset.hifzStep;
  assert.equal(pane(), 'entry'); assert.equal(f.requests.length, 0);
  assert.equal(f.get('[data-hh-review]').hidden, true);
  await f.input('something'); await f.submit();
  assert.equal(f.requests.length, 0, 'Unknown words never create a recognition result.');
  assert.equal(f.get('[data-hh-reference]').attrs['aria-invalid'], 'true');

  await f.click('[data-hh-example]');
  assert.equal(pane(), 'review'); assert.equal(f.get('[data-hh-ref]').textContent, moon.names[20] + ' 21:92');
  assert.equal(f.get('[data-hh-first]').textContent, verses(21)[91][0]);
  assert.equal(f.get('[data-hh-last-row]').hidden, true);
  assert.equal(f.get('[data-hh-save]').disabled, true);
  assert(f.states.every(button => button.attrs['aria-pressed'] === 'false'));
  await f.click('[data-hh-save]'); assert.equal(pane(), 'review', 'No state means no save.');
  await f.emit(f.states[1], 'click'); await f.click('[data-hh-save]');
  assert.equal(pane(), 'saved'); assert(f.get('[data-hh-count]').textContent.includes('1'));
  assert(f.get('[data-hh-saved-detail]').textContent.includes('21:92'));
  f.doc.hidden = true; f.events.get('visibilitychange')();
  assert.equal(pane(), 'saved', 'A saved result stays visible rather than timing out.'); f.doc.hidden = false;

  await f.click('[data-hh-another]'); assert.equal(pane(), 'entry');
  assert.equal(f.get('[data-hh-reference]').value, '');
  await f.input('۶۷:۱–۱۰'); assert.equal(f.requests.length, 1, 'Typing alone does not review.');
  await f.submit();
  assert.equal(f.get('[data-hh-first]').textContent, verses(67)[0][0]);
  assert.equal(f.get('[data-hh-last]').textContent, verses(67)[9][0]);
  assert.equal(f.get('[data-hh-last-row]').hidden, false);
  assert.equal(f.get('[data-hh-save]').disabled, true);
  await f.emit(f.states[0], 'click'); await f.click('[data-hh-save]');
  assert(f.get('[data-hh-count]').textContent.includes('11'));

  await f.click('[data-hh-another]'); await f.input('67:4-6'); await f.submit();
  await f.emit(f.states[2], 'click'); await f.click('[data-hh-save]');
  assert(f.get('[data-hh-count]').textContent.includes('11'), 'Overlapping states retain unique ayah coverage.');
  await f.click('[data-hh-another]'); await f.input('67:1-99');
  const beforeInvalid = f.requests.length; await f.submit();
  assert.equal(f.requests.length, beforeInvalid); assert.equal(pane(), 'entry');
  assert(f.get('[data-hh-status]').textContent.includes('30'));

  f.setDelayed(true); await f.input('67:1-10'); const old = f.submit();
  assert.equal(f.get('[type=submit]').disabled, true);
  await f.input('67:2-4'); assert.equal(f.get('[type=submit]').disabled, false);
  f.setDelayed(false); f.resolve(); await old;
  assert.equal(pane(), 'entry', 'Editing cancels the older corpus request.');
  await f.submit(); assert.equal(f.get('[data-hh-first]').textContent, verses(67)[1][0]);
  await f.click('[data-hh-change]'); assert.equal(pane(), 'entry');

  f.setDelayed(true); await f.input('67:1-10'); const oldInvalid = f.submit();
  f.get('[data-hh-reference]').value = '67:1-99'; await f.submit();
  f.setDelayed(false); f.resolve(); await oldInvalid;
  assert.equal(pane(), 'entry'); assert.equal(f.get('[data-hh-reference]').attrs['aria-invalid'], 'true');

  f.setDelayed(true); await f.input('2:255'); const leaving = f.submit();
  f.controller.setActive(false); f.setDelayed(false); f.resolve(); await leaving;
  assert.equal(pane(), 'entry', 'Leaving Hifz cancels its pending result.');
  const countBeforeReturn = f.requests.length; f.controller.setActive(true);
  assert.equal(f.requests.length, countBeforeReturn, 'Returning does not manufacture a new result.');
  await f.submit(); assert.equal(f.get('[data-hh-first]').textContent, verses(2)[254][0]);
  await f.click('[data-hh-reset]'); assert.equal(pane(), 'entry');
  assert.equal(f.get('[data-hh-reference]').value, '');
  assert.equal(f.get('[data-hh-save]').disabled, true);
  assert(f.get('[data-hh-status]').textContent.length > 0);

  f.setDelayed(true); await f.input('67:1-10'); const resetting = f.submit();
  await f.click('[data-hh-reset]'); f.setDelayed(false); f.resolve(); await resetting;
  assert.equal(pane(), 'entry', 'Reset cancels an unresolved request.');
  await f.click('[data-hh-example]'); await f.emit(f.states[0], 'click'); await f.click('[data-hh-save]');
  assert(!f.get('[data-hh-count]').textContent.includes('11'), 'Reset removed the earlier example record.');
  assert(f.get('[data-hh-count]').textContent.includes('1'));
  assert(f.interactions() > 0, 'Every action takes over from autoplay.');
  assert.equal(f.forbidden(), 0);
  console.log('PASS: shipped hero Hifz — no automatic recognition, canonical single/range review, explicit state/save, overlap totals, stable saved/Add another/reset, invalid references, edit/feature/reset cancellation, focus, no audio/microphone/navigation/timed result.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
