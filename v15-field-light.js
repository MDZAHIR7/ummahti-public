/* Field-attached flowing light: one masked colour rim and a matching bloom.
   Decoration follows input state; reviewed results never wait for the light. */
(() => {
  'use strict';
  function inViewport(field) {
    const rect = field.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
  }
  function create(field, { still, visible = () => inViewport(field) } = {}) {
    const light = document.createElement('span');
    light.className = 'u-field-light'; light.setAttribute('aria-hidden', 'true');
    const surface = document.createElement('i'); surface.className = 'u-field-light-surface';
    light.append(surface); field.append(light);
    let kind = '', timer = 0, epoch = 0, animation = null;
    const moving = () => !!animation;
    function freeze() {
      if (!moving()) return;
      const phase = getComputedStyle(light).getPropertyValue('--u-light-angle').trim() || '0deg';
      light.style.setProperty('--u-light-angle', phase);
      animation.cancel(); animation = null;
    }
    function clear() { epoch++; clearTimeout(timer); timer = 0; }
    function stop({ retain = false } = {}) {
      clear(); freeze(); kind = '';
      field.classList.remove('is-illuminated');
      field.dataset.light = retain ? 'settled' : 'quiet';
    }
    function activate(next = 'matched') {
      if (!visible() || document.hidden) { stop({ retain: next === 'matched' }); return; }
      if (next === kind && moving() && next !== 'matched') return;
      clear(); freeze(); kind = next;
      field.dataset.light = next; field.classList.add('is-illuminated');
      if (still?.() || !light.animate) return;
      const start = getComputedStyle(light).getPropertyValue('--u-light-angle').trim() || '0deg';
      const direction = document.documentElement.dir === 'rtl' ? '-1turn' : '1turn';
      animation = light.animate([
        { '--u-light-angle': start },
        { '--u-light-angle': `calc(${start} + ${direction})` }
      ], { duration: 3200, iterations: Infinity, easing: 'linear' });
      if (next === 'matched') {
        const own = epoch;
        timer = setTimeout(() => {
          if (epoch !== own) return;
          timer = 0; freeze(); kind = '';
          field.classList.remove('is-illuminated'); field.dataset.light = 'settled';
        }, 1100);
      }
    }
    stop();
    return { activate, stop, isActive: moving, destroy() { stop(); light.remove(); } };
  }
  window.UmmahtiFieldLight = { create, inViewport };
})();
