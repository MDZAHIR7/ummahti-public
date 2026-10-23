/* Local catalogue retrieval shared by the hero and full Guide.
   Titles, questions and reviewed search phrases define a topic's meaning.
   Editorial paragraphs and partial words must never manufacture an answer. */
(() => {
  'use strict';
  const normalize = value => String(value || '').toLowerCase().normalize('NFKD')
    .replace(/\p{M}/gu, '').replace(/[ٱأإآ]/g, 'ا').replace(/[ىی]/g, 'ي').replace(/ک/g, 'ك')
    .replace(/['’ʼ]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/)
    .map(word => /^ال[\u0621-\u06ff]{3,}$/u.test(word) ? word.slice(2) : word).join(' ');
  // Grammatical framing only. Negation stays meaningful: "not happy" must not
  // become "happy", and an unknown content word cannot silently be discarded.
  const stopWords = new Set(normalize('i my me the a an to for is am are was were what how do does can with and in of on at it this that have has feel feeling please انا انني اشعر لدي عندي من في عن الى علي ان او و يا مجھے میرا میری میرے ہم آپ کو کا کی کے سے اور ہے ہوں ہیں saya aku merasa sedang yang dan di ke dari untuk dengan ini itu adalah').split(' '));
  const words = value => [...new Set(normalize(value).split(' ').filter(word => word && !stopWords.has(word)))];
  const covers = (source, query) => query.every(word => source.has(word));
  function create(topics) {
    const rows = topics.map((topic, index) => ({ index, fields: [
      { value: topic.t, kind: 'title' }, { value: topic.s, kind: 'question' },
      ...(topic.w || []).map(value => ({ value, kind: 'phrase' }))
    ].map(field => ({ kind: field.kind, text: normalize(field.value), words: new Set(words(field.value)) })) }));
    function search(value) {
      const text = normalize(value), query = words(value);
      if (!text || !query.length) return [];
      return rows.map(row => {
        let score = 0;
        for (const field of row.fields) {
          if (field.text === text) {
            score = Math.max(score, (field.kind === 'title' ? 1200 : field.kind === 'question' ? 1100 : 1000) + query.length);
          } else if (covers(field.words, query)) {
            // A multiword alias is a whole intent, not a bag of independent
            // keywords: bare "unhappy" cannot imply "unhappy marriage".
            if (field.kind === 'phrase' && !covers(new Set(query), [...field.words])) continue;
            const base = field.kind === 'title' ? 650 : field.kind === 'question' ? 500 : 800;
            score = Math.max(score, base + query.length * 10 + query.length / field.words.size);
          }
        }
        return { index: row.index, score };
      }).filter(row => row.score > 0).sort((a, b) => b.score - a.score || a.index - b.index).map(row => row.index);
    }
    return { search, normalize };
  }
  window.UmmahtiGuideSearch = { create, normalize };
})();
