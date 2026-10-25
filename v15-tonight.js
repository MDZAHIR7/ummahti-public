/* Ummahti: tonight's moon, drawn as it is right now.

   The Hijri date comes from the browser's own Umm al-Qura calendar (Intl), the moon's age and
   light from the mean synodic month, and tonight's juz from the same thirty-part division the
   crescent uses. Everything is calculated on the visitor's device; nothing is requested, sent
   or stored. Without JavaScript the section simply stays out of the page. */
(() => {
  'use strict';
  const root = document.documentElement;
  const host = document.querySelector('[data-tonight]');
  const line = document.querySelector('[data-tonight-line]');
  if (!host && !line) return;
  const T = window.UMMAHTI_V15_I18N || {};
  const t = (key, values = {}) => Object.entries(values).reduce((text, [k, v]) => text.replaceAll('{' + k + '}', String(v)), T[key] || key);
  const locale = root.lang || 'en';
  const lang = locale.slice(0, 2);
  const digits = new Intl.NumberFormat(locale);
  const DAY = 86400000, SYNODIC = 29.530588853;
  const EPOCH = Date.UTC(2000, 0, 6, 18, 14); /* a reference new moon */
  const MONTHS = ['Muharram', 'Safar', 'Rabiʻ I', 'Rabiʻ II', 'Jumada I', 'Jumada II', 'Rajab', 'Shaʻban', 'Ramadan', 'Shawwal', 'Dhuʻl-Qiʻdah', 'Dhuʻl-Hijjah'];

  /* ----------------------------------------------------------- the moon */
  function moon(date) {
    /* Mean elongation with the principal periodic terms (Meeus), so the lit fraction follows
       the Moon's real, slightly elliptical month rather than a flat average: full and new fall
       within a few hours of the almanac. The mean-month age is kept only as a fallback. */
    const T = (date / DAY + 2440587.5 - 2451545) / 36525, rad = Math.PI / 180;
    const D = 297.8501921 + 445267.1114034 * T, M = 357.5291092 + 35999.0502909 * T, Mp = 134.9633964 + 477198.8675055 * T;
    const i = 180 - D - 6.289 * Math.sin(Mp * rad) + 2.1 * Math.sin(M * rad) - 1.274 * Math.sin((2 * D - Mp) * rad) - 0.658 * Math.sin(2 * D * rad) - 0.214 * Math.sin(2 * Mp * rad) - 0.11 * Math.sin(D * rad);
    const elongation = ((D % 360) + 360) % 360;
    let fraction = (1 + Math.cos(i * rad)) / 2, age = (elongation / 360) * SYNODIC;
    if (!Number.isFinite(fraction) || !Number.isFinite(age)) {
      age = ((date - EPOCH) / DAY) % SYNODIC; if (age < 0) age += SYNODIC;
      fraction = (1 - Math.cos((Math.PI * 2 * age) / SYNODIC)) / 2;
    }
    fraction = Math.min(1, Math.max(0, fraction));
    return { age, theta: Math.acos(1 - 2 * fraction), fraction, waxing: elongation < 180 };
  }
  function phaseKey(age) {
    if (age < 1 || age >= SYNODIC - 1) return 'phaseNew';
    if (age < 6.4) return 'phaseWaxingCrescent';
    if (age < 8.4) return 'phaseFirstQuarter';
    if (age < 13.8) return 'phaseWaxingGibbous';
    if (age < 15.8) return 'phaseFull';
    if (age < 21.1) return 'phaseWaningGibbous';
    if (age < 23.1) return 'phaseLastQuarter';
    return 'phaseWaningCrescent';
  }
  /* The lit part of a disc of radius R: the outer semicircle on the lit side, closed by the
     terminator, a half-ellipse whose width follows the phase. */
  function litPath(theta, R) {
    const c = Math.cos(theta), rx = Math.abs(R * c).toFixed(2), sweep = c > 0 ? 0 : 1;
    return `M0,${-R} A${R},${R} 0 0 1 0,${R} A${rx},${R} 0 0 ${sweep} 0,${-R}Z`;
  }

  /* ---------------------------------------------------- the Hijri night */
  function tabular(date) {
    /* The arithmetic (civil) calendar, only where the browser has no Islamic calendar at all. */
    let y = date.getFullYear(), m = date.getMonth() + 1;
    const d = date.getDate();
    if (m < 3) { y -= 1; m += 12; }
    const a = Math.floor(y / 100), b = 2 - a + Math.floor(a / 4);
    const jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524;
    let l = jd - 1948440 + 10632;
    const n = Math.floor((l - 1) / 10631);
    l = l - 10631 * n + 354;
    const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
    l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
    const month = Math.floor((24 * l) / 709), day = l - Math.floor((709 * month) / 24), year = 30 * n + j - 30;
    return { day, month, year, dayText: digits.format(day), monthText: MONTHS[month - 1] + ' ' + digits.format(year) + ' AH', text: digits.format(day) + ' ' + MONTHS[month - 1] + ' ' + digits.format(year) + ' AH' };
  }
  function hijri(date) {
    for (const calendar of ['islamic-umalqura', 'islamic-civil', 'islamic']) {
      try {
        const numeric = new Intl.DateTimeFormat('en-u-ca-' + calendar + '-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(date);
        const part = type => numeric.find(p => p.type === type)?.value;
        const day = Number(part('day')), month = Number(part('month')), year = Number(part('year'));
        if (!(day >= 1 && day <= 30 && month >= 1 && month <= 12)) continue;
        const shown = new Intl.DateTimeFormat(locale + '-u-ca-' + calendar, { day: 'numeric', month: 'long', year: 'numeric' });
        const parts = shown.formatToParts(date);
        const dayText = parts.find(p => p.type === 'day')?.value || digits.format(day);
        const monthText = parts.filter(p => p.type !== 'day').map(p => p.value).join('').replace(/\s+([,،])/g, '$1').replace(/\s{2,}/g, ' ').replace(/^[\s,،.‏]+|[\s,،.‏]+$/g, '');
        return { day, month, year, dayText, monthText, text: shown.format(date) };
      } catch { /* try the next calendar */ }
    }
    return tabular(date);
  }

  /* ------------------------------------------------------- tonight's juz */
  function juzStarts() {
    const D = window.UMMAHTI_MOON;
    if (!D || !D.juz || !D.counts) return null;
    const starts = [];
    let v = 0;
    D.counts.forEach((count, s) => {
      for (let a = 1; a <= count; a++, v++) {
        const code = D.juz.charCodeAt(v), j = code <= 90 ? code - 64 : code - 96 + 26;
        if (!starts[j - 1]) starts[j - 1] = { s, a };
      }
    });
    return starts.length === 30 ? { starts, names: (lang === 'ar' || lang === 'ur') && D.namesArabic ? D.namesArabic : D.names, sizes: D.juzSizes } : null;
  }

  /* -------------------------------------------------------------- render */
  const $ = (selector, scope = host || document) => scope.querySelector(selector);
  let juz = null;
  function render() {
    const now = new Date();
    /* The Hijri day begins at Maghrib. Before dawn the night under way is the current date;
       from the morning on, "tonight" is the night that begins this evening. */
    const night = new Date(now);
    if (now.getHours() >= 5) { night.setDate(night.getDate() + 1); night.setHours(21, 0, 0, 0); }
    const date = hijri(night), phase = moon(now.getHours() >= 5 ? night : now);
    const number = Math.min(30, Math.max(1, date.day));
    juz = juz || juzStarts();
    const start = juz && juz.starts[number - 1];
    const values = {
      night: digits.format(number), juz: digits.format(number),
      name: start ? juz.names[start.s] : '', ref: start ? digits.format(start.s + 1) + ':' + digits.format(start.a) : '',
      ayat: juz ? digits.format(juz.sizes[number - 1]) : '',
      phase: t(phaseKey(phase.age)), age: digits.format(Math.round(phase.age * 10) / 10), percent: digits.format(Math.round(phase.fraction * 100))
    };
    window.UMMAHTI_TONIGHT = { night: number, juz: number, age: phase.age, fraction: phase.fraction, waxing: phase.waxing, date: date.text };
    if (host) {
      $('[data-tonight-date]').textContent = date.text;
      $('[data-tonight-phase]').textContent = t('tonightPhase', values);
      const juzLine = $('[data-tonight-juz]');
      if (start) { juzLine.textContent = t('tonightJuz', values); juzLine.hidden = false; } else juzLine.hidden = true;
      const lit = $('[data-tonight-lit]');
      lit.setAttribute('d', litPath(phase.theta, 50));
      lit.setAttribute('transform', phase.waxing ? 'scale(1 1)' : 'scale(-1 1)');
      $('[data-tonight-day]').textContent = date.dayText;
      $('[data-tonight-month]').textContent = date.monthText;
      host.style.setProperty('--lit', phase.fraction.toFixed(3));
      host.hidden = false;
    }
    if (line && start) { line.textContent = t('tonightLine', values); line.hidden = false; }
    document.dispatchEvent(new CustomEvent('ummahti:tonight', { detail: window.UMMAHTI_TONIGHT }));
  }
  try { render(); } catch { if (host) host.hidden = true; return; }
  /* The night changes while a tab is left open; refresh quietly, never while hidden. */
  let timer = 0;
  const schedule = () => { clearInterval(timer); timer = 0; if (!document.hidden) timer = setInterval(() => { try { render(); } catch { /* keep the last good state */ } }, 15 * 60 * 1000); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { try { render(); } catch { /* keep the last good state */ } } schedule(); });
  schedule();
})();
