/* Real reviewed catalogues, shared matcher and shipped hero matching boundary.
   No network, generated advice or browser substitute. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const renders = read('v15-renders.js');
const start = renders.indexOf('    function findTopics() {');
const end = renders.indexOf('    async function acceptGuide', start);
assert(start >= 0 && end > start, 'Locate the actual hero matcher.');
let cases = 0;
for (const lang of ['en', 'ar', 'ur', 'id']) {
  const context = { window: {} }; vm.createContext(context);
  vm.runInContext(read(`media/v15/guide-${lang}.js`), context);
  vm.runInContext(read('v15-guide-search.js'), context);
  const G = context.window.UMMAHTI_GUIDE;
  assert.equal(G.topics.length, 86);
  const matcher = context.window.UmmahtiGuideSearch.create(G.topics);
  Object.assign(context, { G, matcher, input: { value: '' } });
  vm.runInContext(renders.slice(start, end), context);
  const search = query => {
    cases++;
    const shared = Array.from(matcher.search(query), i => G.topics[i].id);
    context.input.value = query;
    assert.deepEqual(Array.from(context.findTopics(), topic => topic.id), shared, `${lang}: hero and shared ranking agree for ${query}`);
    return shared;
  };
  for (const query of ['Happy', 'HAPPY', 'happiness', 'happily', 'unhappy', 'not unhappy', 'marriage-free', 'Fajristan', 'fajrest', 'fear microwave', 'zyzzyvanotareviewedtopic', '!!!']) {
    assert.deepEqual(search(query), [], `${lang}: ${query} must not manufacture an unrelated answer`);
  }
  const positives = [
    ['fear', 'fear_of_the_future'], ['I fear', 'fear_of_the_future'], ['scared of the future', 'fear_of_the_future'],
    ['marriage', 'marriage_finding_spouse'], ['unhappy marriage', 'marriage_difficulty'], ['marriage problems', 'marriage_difficulty'],
    ['مشاكل زوجية', 'marriage_difficulty'], ['ازدواجی مسائل', 'marriage_difficulty'], ['masalah rumah tangga', 'marriage_difficulty'],
    ['Fajr', 'waking_for_fajr'], ['فجر', 'waking_for_fajr'], ['bangun subuh', 'waking_for_fajr'],
    ['gratitude', 'gratitude'], ['I am thankful', 'gratitude'], ['شَكْر', 'gratitude'], ['شکر', 'gratitude'], ['bersyukur', 'gratitude'],
    ['saya merasa cemas', 'anxiety_and_worry'], ['مجھے پریشانی ہے', 'anxiety_and_worry']
  ];
  for (const [query, expected] of positives) assert.equal(search(query)[0], expected, `${lang}: ${query}`);
  for (const topic of G.topics) {
    assert(search(topic.t).includes(topic.id), `${lang}: a real title remains discoverable: ${topic.id}`);
    assert(search(topic.s).includes(topic.id), `${lang}: a real question remains discoverable: ${topic.id}`);
  }
  const annotated = G.topics.map((topic, i) => i ? topic : { ...topic, e: topic.e + ' incidentalparagraphtestword' });
  assert.deepEqual(Array.from(context.window.UmmahtiGuideSearch.create(annotated).search('incidentalparagraphtestword')), [], 'editorial text cannot create retrieval relevance');
}
console.log(`PASS: ${cases} actual-catalogue searches across en/ar/ur/id; word/phrase boundaries, honest Happy/unhappy no-match, intentional aliases, multi-term coverage, all 86 titles/questions, paragraph exclusion and shared hero ranking.`);
