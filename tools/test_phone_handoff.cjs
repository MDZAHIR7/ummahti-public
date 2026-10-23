/* Execute the shipped handoff owner in a deterministic Node DOM/WAAPI fixture.
   This checks host decisions, restoration and animation continuity. The fixture
   supplies geometry; it does not establish CSS layout, browser feel or frame rate.
   Run: node tools/test_phone_handoff.cjs */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const source = fs.readFileSync(path.join(__dirname, '..', 'v15-phone-handoff.js'), 'utf8');
const renders = fs.readFileSync(path.join(__dirname, '..', 'v15-renders.js'), 'utf8');
const heroFocus = renders.slice(renders.indexOf('  function guideHero(root) {')).split('\n').find(line => line.includes("input.addEventListener('focus'"));
assert(heroFocus, 'Locate the actual hero focus handler.');

class Events {
  constructor() { this.events = new Map(); }
  addEventListener(type, callback) {
    if (!this.events.has(type)) this.events.set(type, new Set());
    this.events.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.events.get(type)?.delete(callback); }
  dispatch(type, detail = {}) { for (const callback of [...(this.events.get(type) || [])]) callback({ type, ...detail }); }
  listenerCount() { return [...this.events.values()].reduce((sum, callbacks) => sum + callbacks.size, 0); }
}
const close = (actual, expected, note) => assert(Math.abs(actual - expected) < 1, `${note}: ${actual} vs ${expected}`);
const sameRect = (actual, expected, note) => {
  for (const key of ['left', 'top', 'width', 'height']) close(actual[key], expected[key], `${note} ${key}`);
};
const identity = [1, 0, 0, 1, 0, 0];
const matrix = value => {
  const match = /^matrix\(([^)]+)\)$/.exec(value);
  assert(match, 'the fixture accepts an explicit affine presentation');
  const result = match[1].split(',').map(Number);
  assert.equal(result.length, 6); assert(result.every(Number.isFinite));
  return result;
};
const sameCorners = (actual, expected, note) => {
  for (let i = 0; i < 4; i++) {
    close(actual[i].x, expected[i].x, `${note} corner ${i} x`);
    close(actual[i].y, expected[i].y, `${note} corner ${i} y`);
  }
};

function fixture({ restoredY = 0, reduced = false, rtl = false, adjacent = false, viewportWidth = 390 } = {}) {
  const window = new Events(), document = new Events();
  window.innerHeight = 844; window.innerWidth = viewportWidth; window.scrollY = restoredY;
  document.hidden = false; document.documentElement = { dir: rtl ? 'rtl' : 'ltr' };
  let nextFrame = 0, now = 0;
  const frames = new Map(), animations = [], resizeObservers = [], hostChanges = [], focusActions = [];
  const makeRect = ({ left, top, width, height }) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });
  const rectangle = (left, top, width, height) => ({ left, top, width, height });
  class Node extends Events {
    constructor(label, box) {
      super(); this.label = label; this.box = box; this.parentElement = null; this.children = [];
      this.classes = new Set(); this.value = ''; this.scrollTop = 0;
      this.classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name), toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name) };
      this.properties = new Map();
      this.style = { setProperty: (key, value) => this.properties.set(key, value), removeProperty: key => this.properties.delete(key) };
    }
    append(child) {
      // Ordinary DOM reparenting can blur a focused descendant. The real helper
      // restores it, so its actual hero listener must distinguish restoration.
      const active = document.activeElement;
      if (child.parentElement && active && child.contains(active)) {
        document.activeElement = null; active.dispatch('blur', { relatedTarget: null });
      }
      if (child.parentElement) child.parentElement.children = child.parentElement.children.filter(node => node !== child);
      this.children.push(child); child.parentElement = this;
    }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    focus(options) {
      this.lastFocusOptions = options;
      const previous = document.activeElement; if (previous === this) return;
      previous?.dispatch('blur', { relatedTarget: this });
      document.activeElement = this; this.dispatch('focus', { relatedTarget: previous });
    }
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
    layoutBox() { return this === phone ? this.parentElement === dockSlot ? dockSlot.box : homeSlot.box : this.box; }
    get offsetWidth() { return this.layoutBox().width; }
    get offsetHeight() { return this.layoutBox().height; }
    presentationMatrix() {
      if (this !== phone) return identity;
      const active = [...animations].reverse().find(animation => !animation.cancelled && animation.currentTime < animation.duration);
      if (!active) return identity;
      const progress = active.currentTime / active.duration;
      const right = active.frames.findIndex(frame => frame.offset >= progress);
      if (right <= 0) return matrix(active.frames[0].transform);
      const before = active.frames[right - 1], after = active.frames[right];
      const t = (progress - before.offset) / (after.offset - before.offset);
      const a = matrix(before.transform), b = matrix(after.transform);
      // Between recorded samples this fixture uses affine interpolation. Real
      // browser matrix decomposition, layout and frame delivery need CUA review.
      return a.map((value, i) => value + (b[i] - value) * t);
    }
    corners() {
      const box = this.layoutBox(), [a, b, c, d, e, f] = this.presentationMatrix();
      return [[0, 0], [box.width, 0], [box.width, box.height], [0, box.height]].map(([x, y]) => ({
        x: box.left + a * x + c * y + e, y: box.top - window.scrollY + b * x + d * y + f
      }));
    }
    getBoundingClientRect() {
      const corners = this.corners();
      const left = Math.min(...corners.map(point => point.x)), top = Math.min(...corners.map(point => point.y));
      return makeRect({ left, top, width: Math.max(...corners.map(point => point.x)) - left,
        height: Math.max(...corners.map(point => point.y)) - top });
    }
    animate(keyframes, options) {
      const animation = { frames: keyframes, duration: options.duration, currentTime: 0, cancelled: false, onfinish: null,
        cancel() { this.cancelled = true; },
        finish() { this.currentTime = this.duration; this.onfinish?.(); } };
      animations.push(animation); return animation;
    }
  }
  const homeSlot = new Node('home-slot', rectangle(rtl ? 20 : 100, adjacent ? 100 : 900, 245, 514.5));
  const dockSlot = new Node('dock-slot', rectangle(rtl ? 65 : 25, adjacent ? 450 : 2600, 300, 633.67));
  const homeHost = new Node('home-host', homeSlot.box);
  // Deliberately taller than the viewport: host decisions cannot rely on an IO ratio.
  const hero = new Node('hero', rectangle(20, 600, 350, 1800));
  const phone = new Node('phone', null), input = new Node('input', rectangle(0, 0, 100, 44));
  homeHost.append(phone); phone.append(input);
  input.value = 'my question stays local'; input.scrollTop = 17; input.setSelectionRange(3, 11); input.focus({ preventScroll: true });
  const context = { window, document, console, getComputedStyle: node => ({ transform: 'matrix(' + node.presentationMatrix().join(',') + ')' }), ResizeObserver: class {
    constructor(callback) { this.callback = callback; this.targets = new Set(); this.disconnected = false; resizeObservers.push(this); }
    observe(node) { this.targets.add(node); }
    disconnect() { this.disconnected = true; this.targets.clear(); }
  }, requestAnimationFrame: callback => { const id = ++nextFrame; frames.set(id, callback); return id; }, cancelAnimationFrame: id => frames.delete(id) };
  vm.createContext(context); vm.runInContext(source, context, { filename: 'v15-phone-handoff.js' });
  const state = { reduced };
  const owner = window.UmmahtiPhoneHandoff.create({ phone, homeSlot, homeHost, dockSlot, hero,
    still: () => state.reduced, onHostChange: host => hostChanges.push(host) });
  Object.assign(context, { input, handoff: owner,
    takeControl: () => focusActions.push('cancel-run'), acknowledgeSearch: kind => focusActions.push(kind) });
  vm.runInContext(heroFocus, context, { filename: 'actual-hero-focus-handler.js' });
  function flush() {
    for (let turn = 0; frames.size && turn < 12; turn++) {
      const batch = [...frames.values()]; frames.clear(); now += 16;
      batch.forEach(callback => callback(now));
    }
    assert.equal(frames.size, 0, 'no continuous reconciliation frame loop');
  }
  function scroll(y) { window.scrollY = y; window.dispatch('scroll'); flush(); }
  const active = () => animations.filter(animation => !animation.cancelled && animation.currentTime < animation.duration);
  const finish = () => { active().forEach(animation => animation.finish()); flush(); };
  flush();
  return { window, document, owner, phone, input, homeSlot, dockSlot, homeHost, state, animations, resizeObservers,
    hostChanges, focusActions, frames, flush, scroll, active, finish };
}

// Focus restored by the retained-phone owner is not a new user action. Actual
// user focus still cancels the timed preview and gives its normal feedback.
for (const reduced of [false, true]) {
  const f = fixture({ adjacent: true, reduced });
  f.owner.move('dock', { holdDock: true });
  assert.equal(f.document.activeElement, f.input);
  assert.equal(f.input.lastFocusOptions.preventScroll, true);
  assert.equal(f.focusActions.length, 0, 'restoring focused input cannot cancel a pending manual run');
  assert.equal(f.owner.isRestoringFocus(), false, 'restoration ownership ends synchronously');
  f.owner.move('home', { holdHome: true });
  assert.equal(f.focusActions.length, 0, 'reverse restoration also preserves the search run');
  f.homeHost.focus(); f.input.focus();
  assert.deepEqual(f.focusActions, ['cancel-run', 'focus'], 'a real subsequent user focus is never suppressed');
}

// Fast native-anchor jumps, a tall mobile hero and returning naturally to page top.
for (const reduced of [false, true]) {
  const f = fixture({ reduced });
  assert.equal(f.owner.getHost(), 'home');
  f.scroll(2100); assert.equal(f.owner.getHost(), 'dock');
  f.scroll(6000); assert.equal(f.owner.getHost(), 'dock');
  f.scroll(0); assert.equal(f.owner.getHost(), 'home', 'top must restore the real phone without a special return button');
  assert.equal(f.phone.parentElement, f.homeHost);
  assert.equal(f.animations.length, 0, 'unrelated offscreen chapters never get a travelling phone');
  assert.equal(f.input.value, 'my question stays local');
  assert.equal(f.input.selectionStart, 3); assert.equal(f.input.selectionEnd, 11);
  assert.equal(f.input.scrollTop, 17); assert.equal(f.document.activeElement, f.input);
}

// Browser restoration may happen without a scroll event (including BFCache).
for (const event of ['pageshow', 'load', 'resize']) {
  const f = fixture({ restoredY: 6000 });
  assert.equal(f.owner.getHost(), 'dock', 'restored anchor starts in the appropriate host');
  f.window.scrollY = 0; f.window.dispatch(event, { persisted: true }); f.flush();
  assert.equal(f.owner.getHost(), 'home', `${event} reconciles restored top`);
  assert.equal(f.animations.length, 0, `${event} restores immediately without offscreen flight`);
}
{
  const f = fixture();
  f.window.scrollY = 6000; f.window.dispatch('hashchange'); f.flush();
  assert.equal(f.owner.getHost(), 'dock', 'native anchor changes reconcile without depending on IO callbacks');
  f.document.hidden = true; f.document.dispatch('visibilitychange');
  f.window.scrollY = 0; f.document.hidden = false; f.document.dispatch('visibilitychange'); f.flush();
  assert.equal(f.owner.getHost(), 'home', 'returning to a visible tab reconciles current position');
}

// Find the actual source's switch point, then test its hysteresis rather than duplicating its formula.
{
  const f = fixture({ reduced: true }); let crossed = 0;
  for (let y = 0; y < 1800; y += 8) { f.scroll(y); if (f.owner.getHost() === 'dock') { crossed = y; break; } }
  assert(crossed, 'scrolling crosses the host boundary');
  const changes = f.hostChanges.length;
  for (const delta of [-24, 0, -16, 8, -8]) f.scroll(crossed + delta);
  assert.equal(f.hostChanges.length, changes, 'small boundary jitter does not alternate hosts');
  f.scroll(crossed - 112); assert.equal(f.owner.getHost(), 'home');
}

// Animation first frames preserve the current presentation, including interrupted reversals and RTL.
for (const rtl of [false, true]) {
  for (const progress of [.25, .5, .9]) {
    const f = fixture({ adjacent: true, rtl });
    const original = f.phone.getBoundingClientRect();
    f.owner.move('dock', { holdDock: true });
    assert.equal(f.phone.parentElement, f.dockSlot, 'destination owns layout before animation');
    sameRect(f.phone.getBoundingClientRect(), original, 'first inverse frame');
    assert.equal(f.active().length, 1);
    f.active()[0].currentTime = f.active()[0].duration * progress;
    const interrupted = f.phone.getBoundingClientRect();
    const interruptedCorners = f.phone.corners();
    f.owner.move('home', { holdHome: true });
    sameRect(f.phone.getBoundingClientRect(), interrupted, 'reversal has no positional/scale jump');
    sameCorners(f.phone.corners(), interruptedCorners, 'reversal preserves the visible bank as well as its bounds');
    assert.equal(f.active().length, 1, 'a reversal cancels its superseded visual job');
    f.finish(); assert.equal(f.phone.parentElement, f.homeHost);
    sameRect(f.phone.getBoundingClientRect(), f.homeSlot.getBoundingClientRect(), 'settled home');
  }
}
// A placement has depth and a curved center path, then aligns exactly. Keep the
// assertion geometric: a future easing adjustment must not require test edits.
for (const viewportWidth of [390, 1440]) {
  const f = fixture({ adjacent: true, viewportWidth });
  f.owner.move('dock', { holdDock: true });
  const flight = f.active()[0], width = f.phone.offsetWidth, height = f.phone.offsetHeight;
  assert(flight.duration <= 900, 'the handoff has a finite, prompt completion');
  assert(flight.frames.length > 2, 'the transfer is authored beyond a straight two-frame interpolation');
  const center = frame => { const [a, b, c, d, e, g] = matrix(frame.transform); return { x: a * width / 2 + c * height / 2 + e, y: b * width / 2 + d * height / 2 + g }; };
  const start = center(flight.frames[0]), end = center(flight.frames.at(-1));
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const deviations = flight.frames.map(frame => { const point = center(frame); return Math.abs((end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x)) / distance; });
  assert(Math.max(...deviations) > 3, 'the visible center follows a shaped departure and approach');
  assert(flight.frames.some(frame => Math.abs(matrix(frame.transform)[1]) > .001), 'the object banks during transfer');
  assert.deepEqual(matrix(flight.frames.at(-1).transform), identity, 'landing ends at the exact destination pose');
  assert(f.phone.classes.has('r-phone-travelling'));
  assert(f.dockSlot.classes.has('r-handoff-receiving'), 'only the receiving surface gets the finite landing light');
  assert.equal(f.homeHost.classes.has('r-handoff-receiving'), false);
  f.finish();
  assert.equal(f.phone.classes.has('r-phone-travelling'), false);
  assert.equal(f.dockSlot.classes.has('r-handoff-receiving'), false);
  assert.equal(f.phone.properties.size + f.dockSlot.properties.size + f.homeHost.properties.size, 0, 'completion leaves no live craft state');
}
// A visible source must not disappear into a receiver below the viewport. The
// normal scroll owner retries both automatic transfers and explicit intent.
{
  const f = fixture({ adjacent: true });
  f.dockSlot.box.top = 900;
  const original = f.phone.getBoundingClientRect(), changes = f.hostChanges.length;
  f.owner.move('dock', { holdDock: true });
  assert.equal(f.owner.getHost(), 'home', 'explicit dock intent waits while its receiver is below the viewport');
  assert.equal(f.hostChanges.length, changes, 'deferral cannot publish a host change');
  sameRect(f.phone.getBoundingClientRect(), original, 'deferral retains the visible source');
  assert.equal(f.animations.length, 0);
  f.scroll(80);
  assert.equal(f.owner.getHost(), 'home', 'a small receiver sliver is insufficient for placement');
  f.scroll(120);
  assert.equal(f.owner.getHost(), 'dock', 'the existing scroll owner retries held explicit intent');
  assert.equal(f.active().length, 1);
  assert.equal(f.hostChanges.length, changes + 1);
  assert.equal(f.document.activeElement, f.input); assert.equal(f.input.value, 'my question stays local');
  f.finish();
}
{
  const f = fixture({ adjacent: true });
  f.dockSlot.box.top = 1200;
  f.scroll(260);
  assert.equal(f.owner.getHost(), 'home', 'an automatic request also keeps its visible source until the receiver arrives');
  assert.equal(f.animations.length, 0);
  f.scroll(420);
  assert.equal(f.owner.getHost(), 'dock'); assert.equal(f.active().length, 1);
  f.finish();
}
{
  const f = fixture({ adjacent: true });
  f.dockSlot.box.top = 900;
  f.owner.move('dock', { holdDock: true }); f.scroll(80);
  const changes = f.hostChanges.length;
  f.owner.move('home', { holdHome: true }); f.scroll(120);
  assert.equal(f.owner.getHost(), 'home', 'reversing deferred intent keeps the original phone in place');
  assert.equal(f.hostChanges.length, changes); assert.equal(f.animations.length, 0);
}
{
  const f = fixture({ adjacent: true });
  f.dockSlot.box.top = 2000;
  f.owner.move('dock', { holdDock: true });
  f.scroll(700);
  assert.equal(f.owner.getHost(), 'dock', 'if the source exits first, the controller can settle between offscreen slots');
  assert.equal(f.animations.length, 0, 'a gap between visible slots does not create a cross-page flight');
  f.scroll(1200); assert.equal(f.phone.parentElement, f.dockSlot);
  f.scroll(0); assert.equal(f.phone.parentElement, f.homeHost, 'natural top restoration survives a deferred transfer');
}
{
  const f = fixture({ adjacent: true });
  f.dockSlot.box.top = 750; f.scroll(600); f.finish();
  assert.equal(f.owner.getHost(), 'dock');
  const changes = f.hostChanges.length;
  f.owner.move('home', { holdHome: true });
  assert.equal(f.owner.getHost(), 'dock', 'Resume intent also waits for a receiving home slot with room');
  assert.equal(f.hostChanges.length, changes);
  f.scroll(500);
  assert.equal(f.owner.getHost(), 'home'); assert.equal(f.active().length, 1); f.finish();
}
{
  const f = fixture({ adjacent: true });
  f.owner.move('dock', { holdDock: true });
  const oldFlight = f.active()[0]; oldFlight.currentTime = oldFlight.duration * .25;
  f.window.scrollY = 650;
  const presented = f.phone.corners(), changes = f.hostChanges.length;
  f.owner.move('home', { holdHome: true });
  assert.equal(f.active()[0], oldFlight, 'a deferred reversal never cancels the visible in-flight presentation');
  assert.equal(f.hostChanges.length, changes); sameCorners(f.phone.corners(), presented, 'deferred flight stays continuous');
  f.window.scrollY = 500;
  const beforeRetry = f.phone.corners(); f.window.dispatch('scroll'); f.flush();
  assert.equal(f.owner.getHost(), 'home'); assert.notEqual(f.active()[0], oldFlight);
  sameCorners(f.phone.corners(), beforeRetry, 'a safe deferred reversal captures its current pose');
  assert.equal(f.active().length, 1); f.finish();
}
for (const bypass of ['immediate', 'reduced', 'hidden', 'restoration']) {
  const f = fixture({ adjacent: true });
  f.dockSlot.box.top = 1200;
  if (bypass === 'restoration') {
    f.scroll(260); assert.equal(f.owner.getHost(), 'home');
    f.window.dispatch('pageshow', { persisted: true }); f.flush();
  } else {
    if (bypass === 'reduced') f.state.reduced = true;
    if (bypass === 'hidden') f.document.hidden = true;
    f.owner.move('dock', { animate: bypass !== 'immediate', holdDock: true });
  }
  assert.equal(f.owner.getHost(), 'dock', `${bypass} bypasses visibility deferral`);
  assert.equal(f.animations.length, 0, `${bypass} settles without a flight`);
}
{
  const f = fixture({ adjacent: true, reduced: true });
  f.owner.move('dock', { holdDock: true });
  assert.equal(f.animations.length, 0, 'reduced motion never creates a flight even with both slots visible');
  assert.equal(f.dockSlot.classes.has('r-handoff-receiving'), false, 'reduced motion never starts a landing light');
}
{
  const f = fixture({ adjacent: true });
  f.owner.move('dock', { holdDock: true });
  const count = f.animations.length;
  f.owner.move('dock', { holdDock: true }); f.owner.reconcile();
  assert.equal(f.animations.length, count, 'same-host requests never stack animation jobs');
  f.window.dispatch('wheel'); f.flush();
  assert.equal(f.owner.getHost(), 'home', 'new user scroll intent releases an explicit dock hold');
}
{
  const f = fixture({ adjacent: true });
  f.owner.move('dock');
  assert.equal(f.owner.getHost(), 'dock');
  f.finish();
  assert.equal(f.owner.getHost(), 'home', 'finishing a flight reconciles the latest natural host');
  f.finish();
  assert.equal(f.active().length, 0, 'completion reconciliation reaches a stable terminal state');
}

// Native scroll moves destination-relative presentation without rewriting a fixed-coordinate path.
{
  const f = fixture({ adjacent: true });
  f.owner.move('dock', { holdDock: true }); f.active()[0].currentTime = 200;
  const before = f.phone.getBoundingClientRect(); f.scroll(20);
  const after = f.phone.getBoundingClientRect();
  close(after.left, before.left, 'scroll cannot create sideways drift');
  close(after.top, before.top - 20, 'presentation follows native page scroll');
  assert.equal(f.active().length, 1);
  f.finish();
}

// Reduced motion, slot resize, tab visibility and destruction must not leave orphaned jobs.
{
  const f = fixture({ adjacent: true });
  f.owner.move('dock', { holdDock: true });
  f.state.reduced = true; f.owner.reconcile();
  assert.equal(f.active().length, 0); assert.equal(f.owner.isMoving(), false);
  assert.equal(f.phone.properties.size + f.dockSlot.properties.size + f.homeHost.properties.size, 0, 'cancellation clears finite light state');
  f.state.reduced = false; f.owner.move('home', { holdHome: true });
  for (const observer of f.resizeObservers) observer.callback([{ target: f.homeSlot }]);
  f.flush(); assert.equal(f.active().length, 0, 'actual slot resize cancels stale geometry');
  f.owner.move('dock', { holdDock: true });
  f.document.hidden = true; f.document.dispatch('visibilitychange');
  assert.equal(f.active().length, 0);
  f.owner.destroy();
  assert.equal(f.window.listenerCount(), 0); assert.equal(f.document.listenerCount(), 0);
  assert.equal(f.frames.size, 0); assert(f.resizeObservers.every(observer => observer.disconnected));
  const parent = f.phone.parentElement; f.window.scrollY = 6000;
  f.window.dispatch('scroll'); f.window.dispatch('pageshow'); f.flush();
  assert.equal(f.phone.parentElement, parent, 'destroyed owners cannot mutate the phone');
}
console.log('PASS: shipped phone handoff — anchor/top/restoration, tall hero, hysteresis, LTR/RTL affine-pose reversal continuity, curved placement and exact landing, finite landing-state cleanup, native scroll, query/focus identity, explicit-intent release, single jobs, completion reconciliation, reduced motion, resize/hidden cancellation and destroy lifecycle.');
console.log('Fixture limits: CSS geometry, real browser anchoring, animation perception and device frame delivery still require the browser pass.');
