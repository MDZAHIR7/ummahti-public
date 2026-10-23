/* Local, source-first answers shared by both Guide surfaces.
   Prepared guidance remains the app's reviewed catalogue. Broader questions
   retrieve original Quran passages; no model, invented ruling or query log. */
(() => {
  'use strict';
  const normalize = window.UmmahtiGuideSearch.normalize;
  const split = text => normalize(text).split(' ').filter(Boolean);
  const framing = new Set(split('i me my we our you your a an the is am are was were be been being do does did can could should would will shall have has had how what why when where who which whose about according say says said tell tells teaching teaches teach quran quranic qur an koran surah verse verses ayah ayat islam islamic allah god please find show give explain want need know looking help with without for from of to at by as it its in on and or but that this these those there here something anything much get feel feeling feels im ive dont انا انني اشعر ما ماذا كيف هل عن في من الى علي و ان او لي عندي لدي مجھے میرا میری میرے کیا کیسے میں سے کو کا کی کے ہے ہوں ہیں saya aku merasa apa bagaimana tentang dalam untuk di ke dari dan yang ingin bisa tolong'));
  const negatives = new Set(split('not never no cannot cant dont without unhappy sadness sad depressed miserable لا ليس لست حزين غمگین اداس نہیں sedih tidak bukan'));
  const stem = word => /^[a-z]+$/.test(word) ? word.replace(/ies$/, 'y').replace(/(sses|xes)$/, m => m.slice(0, -2)).replace(/s$/, m => word.endsWith('ss') ? m : '') : word;
  const synonyms = [
    'sea ocean oceans seas', 'bee bees honey', 'ask asking supplication supplications dua duaa دعاء دعا doa', 'money wealth rich riches provision sustenance rizq رزق مال rezeki',
    'poor poverty needy destitute', 'work labour labor effort strive striving', 'parent parents mother father والدين والدین ibu ayah',
    'child children offspring اولاد بچے anak', 'moses musa moosa موسي موسی', 'jesus isa عيسي عیسی', 'mary maryam مريم مریم',
    'abraham ibrahim ابراهيم ابراہیم', 'joseph yusuf يوسف یوسف', 'noah nuh نوح', 'mercy merciful compassion رحمة رحمت rahmat',
    'forgive forgiveness repentance repent توبة توبہ معافی ampun', 'prayer prayers salah salat صلوة صلاة نماز shalat salat',
    'fasting fast ramadan رمضان puasa', 'gratitude grateful thankful thanks شكر شکر syukur bersyukur',
    'patient patience steadfast steadfastness صبر sabar', 'knowledge learn learning علم pendidikan',
    'peace tranquillity tranquility calm rest اطمينان سکون tenang', 'justice just fairness انصاف عدل keadilan',
    'heaven paradise garden gardens jannah جنة جنت surga', 'death die dying موت وفات kematian',
    'universe creation heavens earth stars sky', 'animal animals creatures beast beasts', 'marriage married spouse spouses زوج نکاح شادی pernikahan',
    'purpose worship serve عبادة عبادت ibadah', 'lie lies lying truthful truth صدق كذب جھوٹ jujur',
    'charity sadaqah zakat giving صدقة زكاة زکات صدقہ sedekah', 'fear afraid scared خوف takut',
    'sad sadness sorrow grief grieving حزن اداس sedih', 'happy happiness joy joyful rejoice glad خوش سعيد senang bahagia'
  ].map(split);
  const aliases = new Map();
  synonyms.forEach(group => group.forEach(word => aliases.set(word, group)));
  let pending;
  const caches = new WeakMap();
  function loadIndex() {
    if (window.UMMAHTI_GUIDE_INDEX?.rows?.length === 6236) return Promise.resolve(window.UMMAHTI_GUIDE_INDEX);
    if (!pending) pending = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/media/v15/guide-index.js?v=20261023g1';
      const failed = () => { pending = null; script.remove(); reject(new Error('index')); };
      script.onerror = failed;
      script.onload = () => window.UMMAHTI_GUIDE_INDEX?.rows?.length === 6236 ? resolve(window.UMMAHTI_GUIDE_INDEX) : failed();
      document.head.append(script);
    });
    return pending;
  }
  function near(a, b) {
    if (Math.abs(a.length - b.length) > 1 || a[0] !== b[0]) return false;
    if (a.length === b.length) {
      const mismatch = [];
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) mismatch.push(i);
      return mismatch.length <= 1 || (mismatch.length === 2 && mismatch[1] === mismatch[0] + 1 && a[mismatch[0]] === b[mismatch[1]] && a[mismatch[1]] === b[mismatch[0]]);
    }
    const short = a.length < b.length ? a : b, long = a.length < b.length ? b : a;
    let i = 0, j = 0;
    while (i < short.length && j < long.length) { if (short[i] === long[j]) { i++; j++; } else { j++; if (j - i > 1) return false; } }
    return true;
  }
  function create(G, moon, t = key => key, indexLoader = loadIndex) {
    const matcher = window.UmmahtiGuideSearch.create(G.topics);
    const byId = new Map(G.topics.map((topic, i) => [topic.id, i]));
    const common = ['gratitude', 'hope_in_allah', 'seeking_knowledge'].filter(id => byId.has(id));
    const text = (key, fallback) => { const value = t(key); return value && value !== key ? value : fallback; };
    const theme = (query, q, title, intro, suggestions = common, kind = 'theme') => ({ mode: 'passages', query, q, title, intro, suggestions, kind });
    function reference(value) {
      const raw = value.replace(/[٠-٩۰-۹]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.includes(digit) ? '٠١٢٣٤٥٦٧٨٩'.indexOf(digit) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
      const m = raw.match(/^\s*(?:surah\s+)?(\d{1,3})\s*[:：]\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?\s*$/i);
      if (!m) return null;
      const s = +m[1], a = +m[2], b = +(m[3] || a);
      if (!moon?.counts?.[s - 1] || a < 1 || b < a || b > moon.counts[s - 1]) return { invalid: true };
      return { q: [[s, a, Math.min(b, a + 9)]], truncated: b > a + 9 };
    }
    function prepared(value) {
      const exact = matcher.search(value);
      if (exact.length) return exact;
      // Remove conversational framing, never negation or unknown content.
      const words = split(value).filter(word => !framing.has(word));
      return words.length ? matcher.search(words.join(' ')) : [];
    }
    async function resolve(raw) {
      const query = String(raw || '').trim().slice(0, 280);
      const ref = reference(query);
      if (ref?.q) return theme(query, ref.q, text('guidePassageTitle', 'A passage from the Quran'), ref.truncated ? text('guideRangeLimit', 'Showing the first ten ayahs of this range. Search the next reference to continue.') : text('guideReferenceIntro', 'Read the passage in Arabic alongside its named translation.'), [], 'reference');
      if (ref?.invalid) return theme(query, [[1, 1, 7]], text('guideCheckReference', 'Check the surah and ayah numbers'), text('guideReferenceHelp', 'That reference is outside the Quran. You can use a reference such as 2:255, or search a person, feeling or subject.'), common, 'explore');
      const topics = prepared(query);
      if (topics.length) return { mode: 'topic', topicId: G.topics[topics[0]].id, query };
      const words = split(query), negative = words.some(word => negatives.has(word));
      const happy = words.some(word => ['happy','happiness','happyness','happines','hapy','joy','joyful','cheerful','glad','rejoice','delighted','سعيد','سعادة','فرح','خوش','خوشي','خوشی','bahagia','senang','gembira'].includes(word));
      const negatedSad = /\b(?:not|never|dont|without) (?:\w+ ){0,2}(?:unhappy|sad|depressed|miserable)\b/.test(normalize(query));
      const sad = !negatedSad && words.some(word => ['unhappy','sad','sadness','miserable','depressed','حزين','حزن','اداس','غمگين','sedih'].includes(word));
      if (sad || happy && negative) {
        const marriage = words.some(word => (aliases.get('marriage') || []).includes(word));
        return { mode: 'topic', topicId: marriage ? 'marriage_difficulty' : 'sadness_and_grief', query };
      }
      if (happy) return theme(query, [[10,58,58],[13,28,28],[16,97,97]], text('guideJoyTitle', 'Joy, gratitude and a peaceful heart'), text('guideJoyIntro', 'These passages speak of rejoicing in Allah’s bounty and mercy, hearts finding rest in His remembrance, and a good life joined to faith and good deeds.'), ['gratitude','hope_in_allah','reflecting_on_the_quran']);
      // A natural question can resolve to an existing reviewed intent without
      // pretending an unknown content word was understood.
      const content = words.filter(word => !framing.has(word)).slice(0, 20);
      if (!negative && content.some(word => ['honey','bee','bees'].includes(word))) {
        return theme(query, [[16,68,69],[47,15,15]], text('guideQuranResults', 'Quran passages to explore'), text('guideQuranIntro', 'Read these passages in their context. Search finds words and related themes in the Quran; the passages are sources to reflect on, not a new ruling or a personal verdict.'), common, 'search');
      }
      for (const word of content) {
        if (negative || content.length > 3) break;
        const group = aliases.get(word);
        if (!group || content.some(other => other !== word && !group.includes(other))) continue;
        for (const alias of group) { const found = matcher.search(alias); if (found.length) return { mode:'topic', topicId:G.topics[found[0]].id, query }; }
      }
      const index = await indexLoader();
      if (!caches.has(index)) {
        const dictionary = Object.keys(index.terms), stemKeys = new Map();
        dictionary.forEach(word => { const base = stem(word); if (base !== word) { const list = stemKeys.get(base) || []; list.push(word); stemKeys.set(base, list); } });
        caches.set(index, { dictionary, stemKeys });
      }
      const { dictionary, stemKeys } = caches.get(index);
      const groups = content.filter(word => !negatives.has(word)).map(word => {
        let options = [...new Set([word, stem(word), ...(aliases.get(word) || [])])];
        options = [...new Set(options.flatMap(term => [term, ...(stemKeys.get(stem(term)) || [])]))].filter(term => Object.hasOwn(index.terms, term));
        let corrected = false;
        if (!options.length && /^[a-z]{4,}$/.test(word)) { options = dictionary.filter(term => /^[a-z]+$/.test(term) && near(word, term)).slice(0, 3); corrected = options.length > 0; }
        return { word, options, corrected };
      });
      // A single typo can be useful; two unknown nouns are not evidence that
      // a place name meant an unrelated Quran word (e.g. Paris -> pairs).
      if (groups.length > 1 && !groups.some(group => group.options.length && !group.corrected)) {
        groups.forEach(group => { if (group.corrected) group.options = []; });
      }
      const scores = new Map();
      groups.forEach((group, groupIndex) => {
        group.options.forEach((word, n) => {
          const postings = index.terms[word];
          const weight = Math.log(1 + 6236 / postings.length) * (word === group.word ? 1.5 : n === 0 ? 1.1 : .8);
          postings.forEach(row => {
            let score = scores.get(row); if (!score) { score = { row, hits: new Map() }; scores.set(row, score); }
            score.hits.set(groupIndex, Math.max(score.hits.get(groupIndex) || 0, weight));
          });
        });
      });
      const ranked = [...scores.values()].map(hit => ({ row: hit.row, coverage: hit.hits.size, score: [...hit.hits.values()].reduce((a,b)=>a+b,0) + hit.hits.size * 8 }))
        .filter(hit => hit.coverage >= Math.max(1, Math.ceil(groups.length * .5)))
        .sort((a,b)=>b.coverage-a.coverage || b.score-a.score || a.row-b.row);
      const chosen = [];
      for (const hit of ranked) {
        const [s,a] = index.rows[hit.row];
        if (!chosen.some(q => q[0] === s && Math.abs(q[1] - a) < 2)) chosen.push([s,a,a]);
        if (chosen.length === 6) break;
      }
      if (chosen.length) return theme(query, chosen.map(([s,a]) => [s,Math.max(1,a-1),Math.min(moon.counts[s-1],a+1)]), text('guideQuranResults', 'Quran passages to explore'), text('guideQuranIntro', 'Read these passages in their context. Search finds words and related themes in the Quran; the passages are sources to reflect on, not a new ruling or a personal verdict.'), common, 'search');
      return theme(query, [[13,28,28],[94,5,6],[20,114,114]], text('guideExploreTitle', 'A place to begin'), text('guideExploreIntro', 'Let’s find a way into your question. Choose a feeling, person or subject, or enter an ayah reference. Meanwhile, explore these passages on remembrance, ease through hardship and seeking knowledge.'), common, 'explore');
    }
    return { resolve, prepared, reference };
  }
  window.UmmahtiGuideAnswer = { create, loadIndex };
})();
