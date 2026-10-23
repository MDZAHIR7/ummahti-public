/* Exercise the shipped broad-answer engine against the actual 6,236-ayah index. */
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const context={window:{}};vm.createContext(context);
for(const p of ['media/v15/guide-en.js','media/v15/moon-data.js','v15-guide-search.js','v15-guide-answer.js','media/v15/guide-index.js'])vm.runInContext(read(p),context);
const w=context.window,index=w.UMMAHTI_GUIDE_INDEX,moon=w.UMMAHTI_MOON,G=w.UMMAHTI_GUIDE;
let loads=0;const engine=w.UmmahtiGuideAnswer.create(G,moon,k=>JSON.parse(read('i18n/v15.json')).en[k],async()=>{loads++;return index;});
(async()=>{
  assert.equal(index.rows.length,6236);let count=0;
  for(let s=1;s<=114;s++){
    const file=`media/v15/quran/s${String(s).padStart(3,'0')}.js`,scope={window:{}};
    vm.runInNewContext(read(file),scope);
    const verses=scope.window.UMMAHTI_AYAT[s];
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),index.corpusSha256[s]);
    for(let a=1;a<=verses.length;a++,count++)assert.deepEqual(Array.from(index.rows[count]),[s,a,verses[a-1][1]]);
  }
  assert.equal(count,6236);
  for(const query of ['Happy','I am happy','How can I be happy?','happyness','hapy','خوشی','سعادة','bahagia']){
    const answer=await engine.resolve(query);assert.equal(answer.kind,'theme',query);assert.equal(answer.q[0].join(':'),'10:58:58');assert(!answer.title.includes('marriage'));
  }
  assert.equal(loads,0,'prepared themes need no 2 MB corpus index');
  for(const query of ['not happy',"I don’t feel happy",'without happiness','unhappy','I am sad'])assert.equal((await engine.resolve(query)).topicId,'sadness_and_grief',query);
  for(const query of ['not unhappy','not sad'])assert.notEqual((await engine.resolve(query)).topicId,'sadness_and_grief',query+' must preserve negation');
  assert.equal((await engine.resolve('unhappy marriage')).topicId,'marriage_difficulty');
  for(const query of ['What does the Quran say about gratitude?','Tell me about parents','how can I ask Allah','fear'])assert.equal((await engine.resolve(query)).mode,'topic',query);
  const queries=['What does the Quran say about honey?','bees','ocean','stars','Moses and Pharaoh','موسي','النحل','hony','What does the Quran say about iron?'];
  for(const query of queries){const answer=await engine.resolve(query);assert.equal(answer.kind,'search',query);assert(answer.q.length>0);for(const[s,a,b]of answer.q)assert(s>=1&&s<=114&&a>=1&&b<=moon.counts[s-1]);}
  assert((await engine.resolve('honey')).q.some(q=>q[0]===16&&q[1]===68&&q[2]===69),'Honey includes the bee and its drink in context, An-Nahl 16:68–69');
  assert((await engine.resolve('iron')).q.some(q=>q[0]===57&&q[1]<=25&&q[2]>=25),'Iron reaches Al-Hadid 57:25 with neighbouring context');
  for(const query of ['2:255','٢:٢٥٥','۲:۲۵۵'])assert.equal((await engine.resolve(query)).q[0].join(':'),'2:255:255');
  assert.equal((await engine.resolve('67:1–30')).q[0].join(':'),'67:1:10');
  for(const query of ['67:99','115:1','0:1','1:7-1'])assert.equal((await engine.resolve(query)).kind,'explore');
  for(const query of ['qzxvnonword','!!!','weather in Paris','<img src=x onerror=alert(1)>']){const a=await engine.resolve(query);assert(a.q.length>0,'No blank dead end');assert.equal(a.mode,'passages');}
  for(const query of ['weather in Paris','football score','qzxvnonword'])assert.equal((await engine.resolve(query)).kind,'explore',query+' cannot become an unrelated typo answer');
  let fail=true;const recover=w.UmmahtiGuideAnswer.create(G,moon,k=>k,async()=>{if(fail)throw new Error('temporary');return index;});
  await assert.rejects(()=>recover.resolve('iron'));fail=false;assert.equal((await recover.resolve('iron')).kind,'search');
  const source=read('v15-guide-answer.js');assert(!/\b(?:fetch|sendBeacon|WebSocket|XMLHttpRequest|localStorage|sessionStorage)\b/.test(source),'No query transport or storage');
  console.log('PASS: actual complete Quran index, all source digests/translations; Happy/negative polarity; conversational prepared topics; Arabic/English/synonym/typo retrieval; cited refs/ranges; nonempty exploration; failure/retry; no transport/storage.');
})().catch(e=>{console.error(e);process.exitCode=1;});
