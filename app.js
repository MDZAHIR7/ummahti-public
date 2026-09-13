/* ==========================================================================
   Ummahti Quran — ummahtiofficial.com

   One rAF loop drives everything that depends on scroll. It reads layout
   first and writes styles second, never interleaved, so a frame costs one
   reflow rather than one per element.

   The page has a light source: the crescent fixed in the top-right of the
   viewport. Every raised surface asks how close it is to that light and
   sets --lit accordingly, which is what gives the surfaces their rim.
   Nothing here is required for the page to be readable — with the script
   removed, every section renders in its final state.
   ========================================================================== */

(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.remove('no-js');

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(hover: none)');
  const narrow = window.matchMedia('(max-width: 760px)');

  /* ---------------------------------------------------------------- scroll */

  let lenis = null;

  function startLenis() {
    if (lenis || reduced.matches || typeof window.Lenis !== 'function') return;
    lenis = new window.Lenis({
      duration: .9,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,          // let phones keep their native momentum
      touchMultiplier: 1.6,
      autoRaf: false,            // the loop below is the only rAF on the page
    });
  }

  function stopLenis() {
    if (!lenis) return;
    lenis.destroy();
    lenis = null;
  }

  startLenis();
  reduced.addEventListener('change', () => (reduced.matches ? stopLenis() : startLenis()));

  // Anchor links have to go through whichever engine currently owns scroll.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: -70 });
    else target.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

  /* --------------------------------------------------------------- reveals */

  const revealables = document.querySelectorAll('[data-reveal]');

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    /* The -12% bottom margin holds an element back until it is properly in
       view, which is right while scrolling and wrong on first paint: it can
       leave the hero's call to action invisible until the reader scrolls.
       Anything already on screen at load is revealed outright. */
    revealables.forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-in');
      else io.observe(el);
    });
  } else {
    revealables.forEach((el) => el.classList.add('is-in'));
  }

  /* Headline word stagger. The words carry the visible text and the heading
     carries the accessible name, so nothing is duplicated — a hidden second
     copy would be read once but selected and crawled twice. */
  document.querySelectorAll('[data-split]').forEach((el) => {
    const text = el.textContent.trim();
    if (!text) return;

    el.setAttribute('aria-label', text);

    const frag = document.createDocumentFragment();
    text.split(/\s+/).forEach((word, i) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.setAttribute('aria-hidden', 'true');
      /* The stagger is capped rather than run to the end of the line: on a
         nine-word headline a flat 55ms each put the last word half a second
         behind the first, which reads as a headline being typed out. */
      span.style.setProperty('--delay', `${Math.min(i * 38, 300)}ms`);
      span.textContent = word;
      frag.append(span, document.createTextNode(' '));
    });

    el.textContent = '';
    el.append(frag);
  });

  /* ----------------------------------------------------------------- tilt */

  if (!coarse.matches && !reduced.matches) {
    document.querySelectorAll('[data-tilt]').forEach((device) => {
      const stage = device.closest('.stage') || device.parentElement;

      stage.addEventListener('pointermove', (e) => {
        const r = stage.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        device.style.setProperty('--ry', `${x * 9}deg`);
        device.style.setProperty('--rx', `${y * -7}deg`);
      });

      const rest = () => {
        device.style.setProperty('--ry', '0deg');
        device.style.setProperty('--rx', '0deg');
      };
      stage.addEventListener('pointerleave', rest);
      window.addEventListener('blur', rest);
    });
  }

  /* ------------------------------------------------------------- magnets */

  /* The call to action leans towards the pointer. It uses `translate` rather
     than `transform`, which the hover lift already owns, so the two compose
     instead of one cancelling the other. Pointer devices only: on a phone
     there is nothing to lean towards, and a stuck offset from a stray tap
     would just be a crooked button. */
  if (!coarse.matches && !reduced.matches) {
    document.querySelectorAll('.btn, .badge-play, .theme-pick-btn').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.translate = `${(x * 9).toFixed(2)}px ${(y * 5).toFixed(2)}px`;
      });

      const rest = () => { el.style.translate = ''; };
      el.addEventListener('pointerleave', rest);
      el.addEventListener('blur', rest);
      window.addEventListener('blur', rest);
    });
  }

  /* ------------------------------------------------------- the four scripts */

  /* One page set four ways. It cycles while on screen so the difference is
     visible without asking for a click, and stops the moment the reader
     takes over — an autoplay that fights the person using it is worse than
     no autoplay. Without JS the markup stays a swipeable comparison strip. */
  const scripts = document.querySelector('[data-scripts]');

  if (scripts) {
    const pages = [...scripts.querySelectorAll('.script-page')];
    const tabs = [...scripts.querySelectorAll('[data-tab]')];
    const tablist = scripts.querySelector('.script-tabs');

    if (pages.length && tabs.length) {
      scripts.classList.add('is-live');
      tablist.hidden = false;

      let index = -1;             // nothing shown yet, so show(0) is a real change
      let taken = false;          // the reader has chosen; stop cycling
      let visible = false;
      let timer = null;

      let leaving = null;

      function show(next) {
        const from = index;
        index = (next + pages.length) % pages.length;
        if (from === index) return;

        /* The page being left keeps its place in the stack and turns off it;
           the arriving one is simply already underneath. Marking the leaver
           is all the CSS needs to know. */
        if (leaving) leaving.el.classList.remove('is-out');
        clearTimeout(leaving && leaving.timer);

        const out = pages[from];
        if (out && !reduced.matches) {
          out.classList.add('is-out');
          leaving = {
            el: out,
            timer: setTimeout(() => { out.classList.remove('is-out'); leaving = null; }, 780),
          };
        }

        pages.forEach((p, i) => p.classList.toggle('is-on', i === index));
        tabs.forEach((t, i) => t.setAttribute('aria-pressed', String(i === index)));
      }

      function tick() {
        clearTimeout(timer);
        if (taken || !visible || reduced.matches) return;
        timer = setTimeout(() => { show(index + 1); tick(); }, 2800);
      }

      tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => { taken = true; clearTimeout(timer); show(i); });
        tab.addEventListener('keydown', (e) => {
          const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (!step) return;
          e.preventDefault();
          taken = true;
          clearTimeout(timer);
          show(index + step);
          tabs[index].focus();
        });
      });

      if ('IntersectionObserver' in window) {
        new IntersectionObserver((entries) => {
          for (const entry of entries) {
            visible = entry.isIntersecting;
            if (visible) tick(); else clearTimeout(timer);
          }
        }, { threshold: 0.3 }).observe(scripts);
      } else {
        visible = true;
        tick();
      }

      show(0);
    }
  }

  /* --------------------------------------------------------- search demo */

  /* Every case here is a documented capability of the search engine, and
     every name is the app's own spelling from quran_data.json. */
  const CASES = [
    { q: 'mal qariah', hit: 'Al-Qaari’a · Surah 101', sub: 'The Calamity',
      why: 'Latin letters, spelled by ear. No Arabic keyboard needed.' },
    { q: 'merfy', hit: 'The mercy verses', sub: 'In whichever translation you have',
      why: 'One letter wrong, and it still retrieves.' },
    { q: 'yaseen', hit: 'Yaseen · Surah 36', sub: 'Ya-Sin, Yasin, Yaseen',
      why: 'Spellings of one Arabic sound collapse together.' },
    { q: '2:255', hit: 'Al-Baqara 255', sub: 'The Cow',
      why: 'A plain verse reference.' },
    { q: 'ayat al kursi', hit: 'Al-Baqara 255', sub: 'The Throne Verse',
      why: 'The name people use, not the number.' },
    { q: 'sadaqah', hit: 'Charity', sub: 'Verses on spending in the way of Allah',
      why: 'A topic, under any of its names: zakat, giving, صدقة.' },
    { q: 'الرحمن', ar: true, hit: 'Ar-Rahmaan · Surah 55', sub: 'The Beneficent',
      why: 'Arabic, with or without the harakat.' },
  ];

  const demo = document.querySelector('[data-search-demo]');
  const cases = document.querySelector('[data-search-cases]');

  if (demo && cases && !reduced.matches) {
    demo.hidden = false;
    cases.hidden = true;

    const qEl = demo.querySelector('[data-q]');
    const row = demo.querySelector('[data-hit-row]');
    const hitEl = demo.querySelector('[data-hit]');
    const subEl = demo.querySelector('[data-hitsub]');
    const whyEl = demo.querySelector('[data-why]');

    let i = 0;
    let timer = null;
    let onScreen = false;

    const wait = (ms) => new Promise((res) => { timer = setTimeout(res, ms); });

    async function play() {
      while (onScreen) {
        const c = CASES[i % CASES.length];

        qEl.textContent = '';
        if (c.ar) { qEl.lang = 'ar'; qEl.dir = 'rtl'; }
        else { qEl.removeAttribute('lang'); qEl.removeAttribute('dir'); }
        row.classList.remove('is-shown');
        whyEl.classList.remove('is-shown');
        await wait(320);
        if (!onScreen) return;

        for (const ch of [...c.q]) {
          qEl.textContent += ch;
          await wait(58 + Math.random() * 45);
          if (!onScreen) return;
        }

        await wait(340);
        hitEl.textContent = c.hit;
        subEl.textContent = c.sub;
        row.classList.add('is-shown');
        await wait(260);
        whyEl.textContent = c.why;
        whyEl.classList.add('is-shown');

        await wait(2600);
        if (!onScreen) return;
        i++;
      }
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const was = onScreen;
          onScreen = entry.isIntersecting;
          if (onScreen && !was) play();
          if (!onScreen) clearTimeout(timer);
        }
      }, { threshold: 0.25 }).observe(demo);
    } else {
      onScreen = true;
      play();
    }
  }

  /* ----------------------------------------------------------------- guide */

  /* Guide's whole claim is that a situation described in ordinary words comes
     back as sourced, checkable references. A paragraph can assert that; only
     watching it happen five times over is convincing. So this runs five real
     topics out of `GuideCatalog.kt` — the query is one of that topic's own
     `aliases`, the title, the category, the references, the captions and the
     practical step are the app's own strings, and the caption under a
     narration is the site's own short form of the app's summary, in the same
     voice the static panel below already used.

     Two of the five queries are not English, because two of the ten locales
     the catalogue is matched in do more to show the reach than a third
     English phrasing would.

     No scripture is quoted, here or anywhere on this site. A reference, and
     what it says, is as far as the browser goes. */

  const GUIDE = [
    {
      q: 'I can’t stop worrying',
      title: 'Anxiety and Worry',
      cat: 'Heart & Emotions',
      why: 'Plain English. No Islamic search term to know first, and no topic index to have memorised.',
      sources: [
        { ref: 'Qur’an 13:28', tag: 'Start here',
          note: 'States that hearts find rest in the remembrance of Allah.' },
        { ref: 'Qur’an 94:5-6' },
        { ref: 'Qur’an 2:286' },
        { ref: 'Sahih al-Bukhari 6363', tag: 'Sahih',
          note: 'Seeking refuge from worry and grief by name.' },
        { ref: 'Sunan Abi Dawud 1319', tag: 'Hasan, per al-Albani' },
      ],
      step: 'Return to short, simple dhikr when your mind is racing: even a few words, repeated.',
    },
    {
      q: 'i did it again',
      title: 'Falling Back into the Same Sin',
      cat: 'Faith & Repentance',
      why: 'Four words, no keyword in them. The catalogue carries the phrasings people actually type.',
      sources: [
        { ref: 'Qur’an 3:135', tag: 'Start here',
          note: 'Praises those who, having wronged themselves, remember Allah and do not persist knowingly.' },
        { ref: 'Qur’an 39:53' },
        { ref: 'Qur’an 4:110' },
        { ref: 'Sahih al-Bukhari 7507', tag: 'Sahih',
          note: 'A servant sins and asks forgiveness, sins and asks again, and is forgiven each time he returns.' },
      ],
      step: 'Repent again, without treating the last tawbah as wasted. It was not.',
    },
    {
      q: 'gagal ujian',
      title: 'Failing an Exam',
      cat: 'Work, Study & Rizq',
      why: 'Indonesian, typed the way it is said. The catalogue is matched in ten languages, not translated after the fact.',
      sources: [
        { ref: 'Qur’an 2:216', tag: 'Start here',
          note: 'States that you may dislike a thing that is good for you, and Allah knows while you do not.' },
        { ref: 'Qur’an 3:139' },
        { ref: 'Qur’an 94:5-6' },
        { ref: 'Sahih Muslim 2664', tag: 'Sahih',
          note: 'Be keen on what benefits you and seek Allah’s help; and when something goes against you, do not say “if only”.' },
      ],
      step: 'Find out exactly what went wrong, and treat that as information rather than as identity.',
    },
    {
      q: 'قرض',
      rtl: true,
      title: 'Debt',
      cat: 'Work, Study & Rizq',
      why: 'Urdu, in Urdu script. It is matched on the phone, and what you typed never leaves it.',
      sources: [
        { ref: 'Qur’an 2:280', tag: 'Start here',
          note: 'Instructs granting time to a debtor in hardship, and that remitting it is better.' },
        { ref: 'Qur’an 65:7',
          note: 'States that Allah will bring about ease after hardship.' },
        { ref: 'Qur’an 2:275' },
        { ref: 'Sahih al-Bukhari 6363', tag: 'Sahih',
          note: 'Seeking refuge from worry and grief, and from the burden of debt.' },
      ],
      step: 'Write the full amount down and make a repayment plan, however slow. A named number is smaller than a feared one.',
    },
    {
      q: 'i don’t know what to choose',
      title: 'A Difficult Decision (Istikharah)',
      cat: 'Life & Decisions',
      why: 'A situation rather than a term — answered with what can be sourced, and never with a ruling.',
      sources: [
        { ref: 'Qur’an 3:159', tag: 'Start here',
          note: 'Commands relying on Allah once a decision has been made.' },
        { ref: 'Qur’an 2:216',
          note: 'States that you may dislike a thing that is good for you, and Allah knows while you do not.' },
        { ref: 'Qur’an 65:3' },
        { ref: 'Sahih al-Bukhari 1166', tag: 'Sahih',
          note: 'The prayer and the supplication the Prophet ﷺ taught for seeking guidance before a decision.' },
      ],
      step: 'Pray voluntary units as you are able, then make the istikharah supplication in your own understanding of it.',
    },
  ];

  const gDemo = document.querySelector('[data-guide-demo]');
  const gStatic = document.querySelector('[data-guide-static]');

  if (gDemo && gStatic && !reduced.matches) {
    gDemo.hidden = false;
    gStatic.hidden = true;

    const gq = gDemo.querySelector('[data-guide-q]');
    const gLine = gq.parentElement;
    const gAnswer = gDemo.querySelector('[data-guide-answer]');
    const gTitle = gDemo.querySelector('[data-guide-title]');
    const gCat = gDemo.querySelector('[data-guide-cat]');
    const gList = gDemo.querySelector('[data-guide-sources]');
    const gStep = gDemo.querySelector('[data-guide-step]');
    const gWhy = gDemo.querySelector('[data-guide-why]');

    let gi = 0;
    let gTimer = null;
    let gOn = false;

    const gWait = (ms) => new Promise((res) => { gTimer = setTimeout(res, ms); });

    /* Lay every answer out once and keep the tallest, so the panel stops
       resizing between cases. It is all one synchronous pass with the block
       already at opacity 0, so nothing of it is ever painted. Re-run on a
       resize, because the column this sits in is fluid and the tallest case
       at one width is not the tallest at another. */
    function gFloor() {
      const cls = gAnswer.className;
      gAnswer.classList.remove('is-shown');
      gDemo.style.setProperty('--guide-floor', '0px');

      let tallest = 0;
      for (const c of GUIDE) {
        gTitle.textContent = c.title;
        gCat.textContent = c.cat;
        gStep.textContent = c.step;
        gList.textContent = '';
        for (const src of c.sources) gList.append(sourceRow(src));
        tallest = Math.max(tallest, gAnswer.getBoundingClientRect().height);
      }

      gTitle.textContent = '';
      gCat.textContent = '';
      gStep.textContent = '';
      gList.textContent = '';
      gAnswer.className = cls;
      gDemo.style.setProperty('--guide-floor', Math.ceil(tallest) + 'px');
    }

    /* A source row is the same three parts the static panel uses: the
       reference, an optional word of weight, and what it says. */
    function sourceRow(src) {
      const li = document.createElement('li');
      const b = document.createElement('b');
      b.textContent = src.ref;
      li.append(b);
      if (src.tag) {
        const em = document.createElement('em');
        em.textContent = src.tag;
        li.append(em);
      }
      if (src.note) {
        const span = document.createElement('span');
        span.textContent = src.note;
        li.append(span);
      }
      return li;
    }

    async function gPlay() {
      while (gOn) {
        const c = GUIDE[gi % GUIDE.length];

        gq.textContent = '';
        /* The direction goes on the line rather than on the span, so the flex
           row reverses with it and the caret sits at the end of the word —
           the left of it — the way it would in the app's own field. */
        if (c.rtl) { gLine.lang = 'ur'; gLine.dir = 'rtl'; }
        else { gLine.removeAttribute('lang'); gLine.removeAttribute('dir'); }
        gAnswer.classList.remove('is-shown');
        gWhy.classList.remove('is-shown');
        await gWait(420);
        if (!gOn) return;

        for (const ch of [...c.q]) {
          gq.textContent += ch;
          await gWait(52 + Math.random() * 48);
          if (!gOn) return;
        }

        /* The beat before the answer is the matching. It is honest about the
           app: the search is deterministic and quick, not a request going
           somewhere and coming back. */
        await gWait(380);
        if (!gOn) return;

        gTitle.textContent = c.title;
        gCat.textContent = c.cat;
        gStep.textContent = c.step;

        gList.textContent = '';
        c.sources.forEach((src, n) => {
          const li = sourceRow(src);
          li.style.setProperty('--n', String(n));
          gList.append(li);
        });

        gAnswer.classList.add('is-shown');
        await gWait(320 + c.sources.length * 90);
        if (!gOn) return;

        gWhy.textContent = c.why;
        gWhy.classList.add('is-shown');

        await gWait(3400);
        if (!gOn) return;
        gi++;
      }
    }

    gFloor();
    /* Cinzel and Jakarta land after first paint on a cold visit, and both
       change the measurement. */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(gFloor);

    let gResize = null;
    let gWidth = gDemo.getBoundingClientRect().width;
    window.addEventListener('resize', () => {
      const w = gDemo.getBoundingClientRect().width;
      if (Math.abs(w - gWidth) < 1) return;
      gWidth = w;
      clearTimeout(gResize);
      gResize = setTimeout(gFloor, 180);
    }, { passive: true });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const was = gOn;
          gOn = entry.isIntersecting;
          if (gOn && !was) gPlay();
          if (!gOn) clearTimeout(gTimer);
        }
      }, { threshold: 0.25 }).observe(gDemo);
    } else {
      gOn = true;
      gPlay();
    }
  }

  /* ---------------------------------------------------------------- themes */

  /* The app ships twelve reading themes and the site wears the same twelve.
     A theme is a block of tokens in the stylesheet, so everything here is
     names: which one is on, where it is remembered, and what to light up.
     No colour is written in this file. The picker's chips are themed
     subtrees, and the address bar's colour is read back off the document, so
     a palette can never drift from the stylesheet that defines it.

     Four core reading themes first, then the eight drawn from a tradition or
     a place, which is the order the app's own picker groups them in. The
     twelve names below are the only duplication of the app's theme list
     outside the stylesheet, and they exist because the picker is on every
     page while the swatch cards are only on the landing page. */
  const THEMES = [
    { id: 'obsidian', name: 'Obsidian Dark' },
    { id: 'warm-cream', name: 'Warm Cream' },
    { id: 'crisp-light', name: 'Crisp Light' },
    { id: 'classic-ink', name: 'Classic Ink' },
    { id: 'madinah', name: 'Madinah Mushaf' },
    { id: 'ottoman', name: 'Ottoman Manuscript' },
    { id: 'andalusian', name: 'Andalusian' },
    { id: 'persian', name: 'Persian Illumination' },
    { id: 'sheikh-zayed', name: 'Sheikh Zayed' },
    { id: 'haramain', name: 'Haramain' },
    { id: 'shiraz-dawn', name: 'Shiraz Dawn' },
    { id: 'jali-moon', name: 'Jali Moon' },
  ];

  const STORE = 'ummahti:theme';
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const sweep = document.querySelector('[data-theme-sweep]');
  const panel = document.querySelector('.themes-panel');

  let current = root.getAttribute('data-theme') || 'obsidian';
  let themingTimer = null;

  function dots(themeId) {
    const dot = document.createElement('span');
    dot.className = 'theme-dot';
    dot.setAttribute('data-theme', themeId);
    dot.setAttribute('aria-hidden', 'true');
    dot.innerHTML = '<i></i><i></i><i></i>';
    return dot;
  }

  /* The one place a theme is actually put on. Everything else calls this.
     `chosen` separates the reader picking a theme from the page catching up
     with one already restored: only a choice is announced, and only a choice
     is written down. */
  function applyTheme(id, origin, chosen) {
    const theme = THEMES.find((t) => t.id === id);
    if (!theme) return;
    current = id;

    if (chosen && !reduced.matches) {
      root.classList.add('is-theming');
      clearTimeout(themingTimer);
      themingTimer = setTimeout(() => root.classList.remove('is-theming'), 520);

      if (sweep && origin) {
        const r = origin.getBoundingClientRect();
        sweep.style.setProperty('--sx', `${((r.left + r.width / 2) / window.innerWidth) * 100}%`);
        sweep.style.setProperty('--sy', `${((r.top + r.height / 2) / window.innerHeight) * 100}%`);
        sweep.classList.remove('is-running');
        void sweep.offsetWidth;                 // restart the animation
        sweep.classList.add('is-running');
      }
    }

    root.setAttribute('data-theme', id);

    if (chosen) {
      try { window.localStorage.setItem(STORE, id); } catch (e) { /* storage denied */ }
    }

    const styles = getComputedStyle(root);

    // The address bar follows the page, read back rather than tabulated here.
    if (themeMeta) {
      const ink = styles.getPropertyValue('--ink').trim();
      if (ink) themeMeta.setAttribute('content', ink);
    }

    /* The themes section is the page's argument that you can read in another
       light, so it is never dressed in the light the page is already in.
       Polarity comes from the stylesheet's own color-scheme, so this rule
       cannot fall out of step with the palettes. */
    if (panel) {
      const dark = styles.getPropertyValue('color-scheme').trim() !== 'light';
      panel.setAttribute('data-theme', dark ? 'warm-cream' : 'obsidian');
    }

    document.querySelectorAll('[data-theme-id]').forEach((card) => {
      card.setAttribute('aria-pressed', String(card.dataset.themeId === id));
    });

    document.querySelectorAll('[data-theme-opt]').forEach((opt) => {
      opt.setAttribute('aria-checked', String(opt.dataset.themeOpt === id));
    });

    const label = document.querySelector('[data-theme-label]');
    if (label) label.textContent = theme.name;

    /* On a narrow screen the name is hidden and the chips stand alone, so the
       button carries its name here. The visible text stays a substring of it,
       which is what keeps voice control able to say what it sees. */
    const toggleBtn = document.querySelector('[data-theme-toggle]');
    if (toggleBtn) toggleBtn.setAttribute('aria-label', `Reading theme: ${theme.name}`);

    const btnDot = document.querySelector('.theme-pick-btn .theme-dot');
    if (btnDot) btnDot.setAttribute('data-theme', id);
  }

  /* --- the picker in the header ------------------------------------------ */

  const pick = document.querySelector('[data-theme-pick]');

  if (pick) {
    const toggle = pick.querySelector('[data-theme-toggle]');
    const menu = pick.querySelector('.theme-menu');

    const head = document.createElement('p');
    head.className = 'theme-menu-head';
    head.textContent = 'Reading theme';
    menu.append(head);

    THEMES.forEach((theme) => {
      const opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'theme-opt';
      opt.setAttribute('role', 'menuitemradio');
      opt.setAttribute('aria-checked', String(theme.id === current));
      opt.dataset.themeOpt = theme.id;
      opt.append(dots(theme.id), document.createTextNode(theme.name));
      opt.addEventListener('click', () => {
        applyTheme(theme.id, opt, true);
        close(true);
      });
      menu.append(opt);
    });

    const options = [...menu.querySelectorAll('[data-theme-opt]')];

    function open() {
      menu.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      (options.find((o) => o.getAttribute('aria-checked') === 'true') || options[0]).focus();
    }

    function close(refocus) {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      if (refocus) toggle.focus();
    }

    toggle.addEventListener('click', () => {
      if (menu.classList.contains('is-open')) close(true); else open();
    });

    menu.addEventListener('keydown', (e) => {
      const i = options.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
      if (i < 0) return;
      const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
      if (step) {
        e.preventDefault();
        options[(i + step + options.length) % options.length].focus();
      } else if (e.key === 'Home') { e.preventDefault(); options[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); options[options.length - 1].focus(); }
    });

    document.addEventListener('pointerdown', (e) => {
      if (menu.classList.contains('is-open') && !pick.contains(e.target)) close(false);
    });

    // A menu that survives the reader tabbing out of it is a menu in the way.
    pick.addEventListener('focusout', () => {
      requestAnimationFrame(() => {
        if (!pick.contains(document.activeElement)) close(false);
      });
    });

    pick.hidden = false;
  }

  /* --- the nine cards, which are the picker written large ---------------- */

  /* They ship as <div>s: without this script they are nine specimens, and a
     specimen must not look pressable. With it they become real buttons. */
  document.querySelectorAll('[data-theme-id]').forEach((card) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = card.className;
    button.dataset.themeId = card.dataset.themeId;
    button.setAttribute('style', card.getAttribute('style') || '');
    button.setAttribute('aria-pressed', String(card.dataset.themeId === current));
    button.innerHTML = card.innerHTML;

    const name = card.querySelector('.theme-name');
    if (name) button.setAttribute('aria-label', `Read this page in ${name.textContent.trim()}`);

    button.addEventListener('click', () => applyTheme(button.dataset.themeId, button, true));
    card.replaceWith(button);
  });

  const themesHint = document.querySelector('[data-themes-hint]');
  if (themesHint && document.querySelector('button[data-theme-id]')) themesHint.hidden = false;

  // Whatever theme.js restored, everything above now agrees with it.
  applyTheme(current, null, false);

  /* ------------------------------------------------------------- the count */

  /* The five figures count up to the numbers already in the markup — the
     markup is the source, so with no script, or under reduced motion, the
     band is simply the finished number. */
  const factGrid = document.querySelector('.facts-grid');

  if (factGrid && !reduced.matches && 'IntersectionObserver' in window) {
    const figures = [...factGrid.querySelectorAll('dt')].map((el) => ({
      el,
      to: Number(el.textContent.replace(/[^0-9]/g, '')),
      final: el.textContent,
    }));

    const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    let counted = false;
    new IntersectionObserver((entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || counted) continue;
        counted = true;
        obs.disconnect();

        const started = performance.now();
        const run = (now) => {
          const t = Math.min(1, (now - started) / 1300);
          const eased = 1 - Math.pow(1 - t, 3);
          for (const f of figures) {
            f.el.textContent = t < 1 ? group(Math.round(f.to * eased)) : f.final;
          }
          if (t < 1) requestAnimationFrame(run);
        };
        requestAnimationFrame(run);
      }
    }, { threshold: 0.4 }).observe(factGrid);
  }

  /* ------------------------------------------------------- the scroll loop */

  const header = document.querySelector('.site-header');
  const ambient = document.querySelector('.sky-ambient');
  const moon = document.querySelector('.sky-moon');
  const halo = document.querySelector('.sky-halo');
  const track = document.querySelector('.modes-track');
  const rail = document.querySelector('.modes-rail');
  const bar = document.querySelector('.modes-progress i');

  /* The devices beside the copy drift against the scroll. They are already
     measured for the lighting pass, so the parallax costs one lookup and no
     extra layout read. */
  const drifters = new WeakSet();
  document.querySelectorAll('.split .device').forEach((el) => drifters.add(el));

  // Only surfaces currently on screen pay for the lighting calculation.
  const lit = new Set();
  if ('IntersectionObserver' in window) {
    const litIO = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) lit.add(entry.target);
        else { lit.delete(entry.target); entry.target.style.removeProperty('--lit'); }
      }
    }, { rootMargin: '15% 0px 15% 0px' });
    document.querySelectorAll('.panel, .device, .close-panel').forEach((el) => litIO.observe(el));
  }

  let vw = 0, vh = 0, diag = 1, railOverflow = 0, trackTop = 0, trackRange = 1;
  let pinned = false;

  function measure() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    diag = Math.hypot(vw, vh);

    pinned = !narrow.matches && !reduced.matches;

    if (window.UmmahtiSky) window.UmmahtiSky.remeasure();

    if (track && rail) {
      railOverflow = Math.max(0, rail.scrollWidth - vw);
      // Pinning the viewport to move the rail 40px is worse than not pinning
      // at all, so on very wide screens the run simply lays itself out.
      if (railOverflow < 120) pinned = false;

      if (pinned) {
        track.style.height = `${vh + railOverflow}px`;
        const r = track.getBoundingClientRect();
        trackTop = r.top + window.scrollY;
        trackRange = Math.max(1, track.offsetHeight - vh);
      } else {
        track.style.height = '';
        rail.style.removeProperty('--rail-x');
        railOverflow = 0;
      }
      track.classList.toggle('is-unpinned', !pinned);
    }
  }

  const prev = new WeakMap();

  function frame(time) {
    if (lenis) lenis.raf(time);

    const y = window.scrollY || window.pageYOffset;

    /* ---- read ---- */
    const boxes = [];
    for (const el of lit) boxes.push([el, el.getBoundingClientRect()]);

    const docRange = Math.max(1, document.body.scrollHeight - vh);
    const progress = Math.min(1, Math.max(0, y / docRange));

    let railP = 0;
    if (pinned && track) {
      railP = Math.min(1, Math.max(0, (y - trackTop) / trackRange));
    }

    /* ---- write ---- */
    if (header) header.classList.toggle('is-stuck', y > 12);

    root.style.setProperty('--lit', progress.toFixed(3));
    root.style.setProperty('--read', progress.toFixed(4));

    // The GPU room, if the device took it. It draws from this loop rather
    // than starting a second one.
    if (window.UmmahtiSky) window.UmmahtiSky.frame(time, progress);

    if (ambient) ambient.style.setProperty('--sky-y', `${y * -0.05}px`);
    const drift = `${y * -0.11}px`;
    if (moon) moon.style.setProperty('--sky-drift', drift);
    if (halo) halo.style.setProperty('--sky-drift', drift);

    if (pinned && rail) {
      rail.style.setProperty('--rail-x', `${(railP * railOverflow).toFixed(1)}px`);
      if (bar) bar.style.setProperty('--rail-p', railP.toFixed(3));
    }

    // The light sits where .sky-moon sits: high and to the right.
    const lx = vw * 0.82;
    const ly = vh * 0.16;

    for (const [el, r] of boxes) {
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = Math.hypot(cx - lx, cy - ly) / diag;
      const v = Math.pow(Math.min(1, Math.max(0, 1 - d / 0.92)), 1.35);
      // Skip the write unless it would actually change a pixel.
      if (Math.abs((prev.get(el) || 0) - v) > 0.015) {
        el.style.setProperty('--lit', v.toFixed(3));
        prev.set(el, v);
      }

      if (drifters.has(el)) {
        // -1 above the fold to 1 below it, taken to a few pixels of lag.
        const off = ((cy - vh / 2) / vh) * -22;
        el.style.setProperty('--par', `${off.toFixed(1)}px`);
      }
    }

    requestAnimationFrame(frame);
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measure, 140);
  }, { passive: true });

  narrow.addEventListener('change', measure);
  window.addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  measure();
  requestAnimationFrame(frame);
})();
