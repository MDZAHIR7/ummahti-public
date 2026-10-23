/* Current-app demonstrations. All choices stay in this page; no microphone or service. */
(() => {
 'use strict';
 const root=document.documentElement;
 root.classList.remove('no-js','is-first');
 const $=(s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];
 const words=window.UMMAHTI_V15_I18N||{};
 const t=(key,values={})=>Object.entries(values).reduce((text,[k,v])=>text.replaceAll('{'+k+'}',String(v)),words[key]||key);
 const content=window.UMMAHTI_CONTENT;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const connection=navigator.connection;
 const automatically=()=>!reduced.matches&&!connection?.saveData&&!document.hidden;
 const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const verse=(ref)=>content?.verses[ref];
 function refresh(el,draw){
   const opacity=getComputedStyle(el).opacity;
   el.getAnimations().forEach(a=>a.cancel());
   draw();
   if(!reduced.matches) el.animate([{opacity:Math.min(Number(opacity),.65),translate:'0 5px'},{opacity:1,translate:'0 0'}],{duration:330,easing:'cubic-bezier(.22,1,.36,1)'});
 }

 // Native details remain usable without JS. Only one header layer opens at once.
 const menus=$$('.v-nav details');
 menus.forEach(menu=>menu.addEventListener('toggle',()=>{
   if(!menu.open)return;
   menus.filter(item=>item!==menu).forEach(item=>item.open=false);
   const panel=$('.v-popover',menu);
   if(panel&&!reduced.matches) panel.animate([{opacity:0,translate:'0 -5px',scale:.98},{opacity:1,translate:'0 0',scale:1}],{duration:180,easing:'cubic-bezier(.22,1,.36,1)'});
 }));
 document.addEventListener('click',event=>{
   menus.forEach(menu=>{if(!menu.contains(event.target))menu.open=false;});
   if(event.target.closest('.v-menu a'))$('.v-menu').open=false;
 });
 document.addEventListener('keydown',event=>{
   if(event.key!=='Escape')return;
   const open=menus.find(item=>item.open);
   if(open){open.open=false;$('summary',open).focus({preventScroll:true});}
 });

 const themeButtons=$$('[data-v-theme]');
 function setTheme(id,persist=false){
   if(!themeButtons.some(b=>b.dataset.vTheme===id))return;
   root.dataset.theme=id;
   if(persist)try{localStorage.setItem('ummahti:theme',id);}catch{}
   themeButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.vTheme===id)));
   const active=themeButtons.find(b=>b.dataset.vTheme===id);
   const summary=$('.v-theme-menu>summary');
   if(summary)summary.setAttribute('aria-label',t('readingTheme')+': '+active.textContent.trim());
   // Light surfaces need darker edge light; do not infer this from a theme name.
   const rgb=getComputedStyle(root).getPropertyValue('--ink').trim().replace('#','');
   if(/^[0-9a-f]{6}$/i.test(rgb)){
     const channels=[0,2,4].map(i=>parseInt(rgb.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
     root.classList.toggle('v-light',channels[0]*.2126+channels[1]*.7152+channels[2]*.0722>.4);
   }
   const meta=$('meta[name="theme-color"]');
   if(meta)meta.content=getComputedStyle(root).getPropertyValue('--ink').trim();
 }
 themeButtons.forEach(button=>button.addEventListener('click',()=>{
   setTheme(button.dataset.vTheme,true);
   const menu=button.closest('.v-theme-menu');
   if(menu){menu.open=false;$('summary',menu)?.focus({preventScroll:true});}
 }));
 setTheme(root.dataset.theme||'obsidian');

 // This control owns only the long app film's audio, never recitation or background sound.
 const siteSound=$('[data-site-sound]'),soundFilm=$('.v-story-film [data-logo-video]');
 if(siteSound&&soundFilm){
   siteSound.hidden=false;
   const syncSound=()=>{
     siteSound.setAttribute('aria-pressed',String(!soundFilm.muted));
     siteSound.setAttribute('aria-label',t('filmSound')+': '+t(soundFilm.muted?'rSoundOn':'rSoundOff'));
   };
   siteSound.addEventListener('click',()=>{soundFilm.muted=!soundFilm.muted;syncSound();});
   soundFilm.addEventListener('volumechange',syncSound);syncSound();
 }

 // Restore the useful copy controls on the contact and creator pages.
 if(navigator.clipboard&&window.isSecureContext)$$('[data-copy-block]').forEach(block=>{
   const text=$('[data-copy-text]',block),header=$('header',block);if(!text||!header)return;
   const button=document.createElement('button');button.type='button';button.className='press-copy-btn';button.textContent=t('copy');button.setAttribute('aria-live','polite');
   let reset=0;
   button.addEventListener('click',async()=>{
     clearTimeout(reset);
     try{await navigator.clipboard.writeText(text.textContent.trim());button.textContent=t('copied');}
     catch{button.textContent=t('copyManual');const range=document.createRange();range.selectNodeContents(text);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);}
     reset=setTimeout(()=>{button.textContent=t('copy');},2500);
   });header.append(button);
 });

 const revealTargets=$$('[data-v-reveal],[data-reveal]');
 if(!reduced.matches&&'IntersectionObserver'in window){
   const reveal=new IntersectionObserver(entries=>entries.forEach(entry=>{
     if(!entry.isIntersecting)return;
     entry.target.classList.remove('v-pending-reveal');entry.target.classList.add('v-revealed','is-in');reveal.unobserve(entry.target);
   }),{threshold:.1,rootMargin:'0px 0px -20px 0px'});
   revealTargets.forEach(el=>{el.classList.add('v-pending-reveal');reveal.observe(el);});
   reduced.addEventListener('change',()=>{if(reduced.matches){reveal.disconnect();revealTargets.forEach(el=>{el.classList.remove('v-pending-reveal');el.classList.add('is-in');});}});
 }else revealTargets.forEach(el=>el.classList.add('is-in'));

 // The approved room runs through one lifecycle-owned animation loop.
 let skyFrame=0,motionPaused=false;
 const motionButton=$('[data-motion-toggle]');
 function sky(now){skyFrame=0;if(document.hidden||reduced.matches||motionPaused||!window.UmmahtiSky)return;window.UmmahtiSky?.frame(now,.18);skyFrame=requestAnimationFrame(sky);}
 function syncSky(){if(motionButton)motionButton.hidden=reduced.matches;if(skyFrame)cancelAnimationFrame(skyFrame);skyFrame=0;if(!document.hidden&&!reduced.matches&&!motionPaused&&window.UmmahtiSky)skyFrame=requestAnimationFrame(sky);}
 motionButton?.addEventListener('click',()=>{motionPaused=!motionPaused;motionButton.textContent=t(motionPaused?'resumeAtmosphere':'pauseAtmosphere');motionButton.setAttribute('aria-pressed',String(motionPaused));syncSky();});
 document.addEventListener('visibilitychange',syncSky);reduced.addEventListener('change',syncSky);syncSky();

 // Genuine current screenshots, with an explicit stop and no hidden timer.
 const gallery=$('[data-hero-gallery]');
 if(gallery){
   const image=$('[data-hero-image]',gallery),caption=$('[data-hero-caption]',gallery),pause=$('[data-hero-pause]',gallery);
   const screens=[['hifz-overview','hifzLabel','hifzAlt'],['reader','practiceLabel','practiceAlt'],['hifz-review','recordLabel','recordAlt']];
   let index=0,serial=0,timer=0,visible=false,paused=false;
   function schedule(){pause.hidden=reduced.matches;clearTimeout(timer);timer=0;if(visible&&automatically()&&!paused)timer=setTimeout(()=>{show((index+1)%screens.length);},6500);}
   async function show(next){
     const request=++serial,item=screens[next],nextImage=new Image();nextImage.src=`/media/v15/${item[0]}-840.webp`;
     try{await nextImage.decode();}catch{schedule();return;}
     if(request!==serial)return;index=next;
     refresh(image,()=>{image.srcset=`/media/v15/${item[0]}-420.webp 420w, /media/v15/${item[0]}-840.webp 840w`;image.src=nextImage.src;image.alt=t(item[2]);caption.textContent=t(item[1]);});schedule();
   }
   const updatePause=()=>{pause.textContent=paused?'▶':'Ⅱ';pause.setAttribute('aria-label',t(paused?'resumeScreens':'pauseScreens'));schedule();};
   $('[data-hero-next]',gallery).addEventListener('click',()=>{paused=true;updatePause();show((index+1)%screens.length);});
   pause.addEventListener('click',()=>{paused=!paused;updatePause();});
   if('IntersectionObserver'in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;schedule();},{threshold:.2}).observe(gallery);
   document.addEventListener('visibilitychange',schedule);reduced.addEventListener('change',schedule);connection?.addEventListener('change',schedule);
   image.addEventListener('error',()=>{caption.textContent=t('imageUnavailable');});
 }

 // One native dialog handles sources, genuine app captures and recorded passages.
 const dialog=$('#v-detail');
 let trigger=null,dialogAnimation=null,closing=false,settleFrame=0;
 function stopSheetMotion(){if(dialogAnimation){dialogAnimation.cancel();dialogAnimation=null;}if(settleFrame)cancelAnimationFrame(settleFrame);settleFrame=0;}
 function closeSheet(){
   if(!dialog?.open||closing)return;
   closing=true;
   const current=getComputedStyle(dialog).transform;stopSheetMotion();
   const finish=()=>{dialog.close();dialog.style.transform='';closing=false;const destination=trigger?.isConnected?trigger:(trigger?.dataset.recordId?$(`[data-record-id="${trigger.dataset.recordId}"]`):null);destination?.focus({preventScroll:true});};
   if(reduced.matches){finish();return;}
   dialogAnimation=dialog.animate([{transform:current==='none'?'translateY(0)':current,opacity:1},{transform:'translateY(35px) scale(.985)',opacity:0}],{duration:200,easing:'cubic-bezier(.4,0,1,1)'});
   dialogAnimation.finished.then(finish).catch(()=>{});
 }
 function openSheet(title,markup,source){
   if(!dialog)return;
   const wasOpen=dialog.open,current=wasOpen?getComputedStyle(dialog).transform:null;
   stopSheetMotion();closing=false;trigger=source||document.activeElement;
   $('#v-detail-title').textContent=title;$('[data-sheet-content]').innerHTML=markup;
   if(!wasOpen)dialog.showModal();dialog.scrollTop=0;
   $('[data-sheet-close]').focus({preventScroll:true});
   if(!reduced.matches){
     const origin=source?.getBoundingClientRect(),box=dialog.getBoundingClientRect();
     const x=origin?Math.max(-60,Math.min(60,(origin.left+origin.width/2)-(box.left+box.width/2))):0;
     dialogAnimation=dialog.animate([{transform:current||`translate(${x}px,25px) scale(.97)`,opacity:wasOpen?1:.4},{transform:'translate(0,0) scale(1)',opacity:1}],{duration:320,easing:'cubic-bezier(.22,1,.36,1)'});
   }
 }
 if(dialog){
   $('[data-sheet-close]').addEventListener('click',closeSheet);
   dialog.addEventListener('cancel',event=>{event.preventDefault();closeSheet();});
   dialog.addEventListener('click',event=>{if(event.target===dialog){const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)closeSheet();}});
   const handle=$('[data-sheet-handle]');let drag=null;
   handle.addEventListener('pointerdown',event=>{if(event.button!==0)return;stopSheetMotion();closing=false;handle.setPointerCapture(event.pointerId);drag={y:event.clientY,last:event.clientY,time:event.timeStamp,velocity:0};});
   handle.addEventListener('pointermove',event=>{if(!drag)return;const dy=Math.max(0,event.clientY-drag.y);drag.velocity=(event.clientY-drag.last)/Math.max(1,event.timeStamp-drag.time);drag.last=event.clientY;drag.time=event.timeStamp;dialog.style.transform=`translateY(${dy}px)`;});
   function release(event){
     if(!drag)return;const y=Math.max(0,(event?.clientY??drag.last)-drag.y),velocity=drag.velocity;drag=null;
     if(y>100||(y>35&&velocity>.55)){closeSheet();return;}
     if(reduced.matches||document.hidden){dialog.style.transform='';return;}
     const start=performance.now(),v=velocity*1000,omega=20;
     const frame=now=>{const time=(now-start)/1000,value=(y+(v+omega*y)*time)*Math.exp(-omega*time);dialog.style.transform=`translateY(${Math.max(0,value)}px)`;if(time<.7&&value>.1&&!document.hidden)settleFrame=requestAnimationFrame(frame);else{dialog.style.transform='';settleFrame=0;}};
     settleFrame=requestAnimationFrame(frame);
   }
   handle.addEventListener('pointerup',release);handle.addEventListener('pointercancel',release);
   dialog.addEventListener('close',()=>{stopSheetMotion();dialog.style.transform='';});
   document.addEventListener('visibilitychange',()=>{if(document.hidden){stopSheetMotion();dialog.style.transform='';if(closing){dialog.close();closing=false;}}});
 }
 $$('[data-open-capture]').forEach(button=>button.addEventListener('click',()=>{
   const id=button.dataset.openCapture;
   const meta={ 'hifz-recite':['reciteEntry','reciteDescription'],'hifz-reference':['spokenEntry','spokenDescription'],'hifz-bulk':['bulkEntry','bulkDescription'],'hifz-add':['findPassage','findPassageBody']}[id];
   if(!meta)return;
   openSheet(t(meta[0]),`<p>${escape(t(meta[1]))}</p><img src="/media/v15/${id}-840.webp" width="840" height="1820" alt="${escape(t(meta[0]))}"><p class="v-caption">${escape(t('captureNote'))}</p>`,button);
 }));

 if(!content)return;
 const unlock=$('[data-unlock-demo]');
 if(unlock){
   const refs=['93:1','93:2','93:3'];let index=0;
   function render(){const v=verse(refs[index]);refresh($('[data-unlock-page]'),()=>{$('[data-unlock-ref]').textContent=v.surah+' '+v.reference;$('[data-unlock-arabic]').textContent=v.arabic;$('[data-unlock-translation]').textContent=v.translation;});}
   $('[data-unlock-later]').addEventListener('click',()=>{$('[data-unlock-status]').textContent=t('laterResult');});
   $('[data-unlock-done]').addEventListener('click',()=>{if(index<refs.length-1){index++;render();$('[data-unlock-status]').textContent=t('advancedResult');}else{$('[data-unlock-status]').textContent=t('exampleComplete');}});
   $('[data-unlock-reset]').addEventListener('click',()=>{index=0;render();$('[data-unlock-status]').textContent=t('resetResult');});
   $('[data-unlock-settings]').addEventListener('click',event=>{const panel=$('#unlock-settings'),open=panel.hidden;panel.hidden=!open;event.currentTarget.setAttribute('aria-expanded',String(open));if(open)$('#unlock-cadence').focus();});
   $('#unlock-cadence').addEventListener('change',event=>{$('[data-unlock-status]').textContent=t('cadenceResult',{cadence:event.target.value});});render();
 }

 const tabs=$$('[data-demo-tab]');
 function selectTab(id,focus=false){
   const target=tabs.find(tab=>tab.dataset.demoTab===id);if(!target)return;
   tabs.forEach(tab=>{const active=tab===target;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;$('#'+tab.getAttribute('aria-controls')).hidden=!active;});
   const panel=$('#'+target.getAttribute('aria-controls'));refresh(panel,()=>{});if(focus)target.focus();
 }
 tabs.forEach(tab=>{
   tab.addEventListener('click',()=>selectTab(tab.dataset.demoTab));
   tab.addEventListener('keydown',event=>{let step=0;if(event.key==='ArrowRight')step=root.dir==='rtl'?-1:1;if(event.key==='ArrowLeft')step=root.dir==='rtl'?1:-1;if(step){event.preventDefault();selectTab(tabs[(tabs.indexOf(tab)+step+tabs.length)%tabs.length].dataset.demoTab,true);}else if(event.key==='Home'||event.key==='End'){event.preventDefault();selectTab(tabs[event.key==='Home'?0:tabs.length-1].dataset.demoTab,true);}});
 });
 const followHash=()=>{const id=location.hash.replace('#tab-','');if(tabs.some(tab=>tab.dataset.demoTab===id))selectTab(id);};
 window.addEventListener('hashchange',followHash);followHash();
 $$('[data-go-demo]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();selectTab(link.dataset.goDemo);$('#inside').scrollIntoView({behavior:reduced.matches?'auto':'smooth'});tabs.find(t=>t.dataset.demoTab===link.dataset.goDemo).focus({preventScroll:true});}));

 const guideExamples={worry:{title:'worryTitle',ref:'13:28',sources:['13:28','2:286','94:5'],topic:'anxiety_and_worry'},return:{title:'returnTitle',ref:'39:53',sources:['39:53','4:110','66:8'],topic:'forgiveness_and_repentance'},patience:{title:'patienceTitle',ref:'94:5',sources:['94:5','94:6','2:153'],topic:'hardship_and_patience'}};
 let selectedGuide='worry';
 function guideResult(id){selectedGuide=id;const example=guideExamples[id],v=verse(example.ref);$$('[data-guide-example]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.guideExample===id)));refresh($('[data-guide-result]'),()=>{$('[data-guide-ref]').textContent=v.surah+' '+v.reference;$('[data-guide-title]').textContent=t(example.title);$('[data-guide-arabic]').textContent=v.arabic;$('[data-guide-translation]').textContent=v.translation;});}
 if($('[data-guide-result]')){
   $$('[data-guide-example]').forEach(button=>button.addEventListener('click',()=>guideResult(button.dataset.guideExample)));
   $('[data-guide-sources]').addEventListener('click',event=>{const example=guideExamples[selectedGuide];const cards=example.sources.map(ref=>{const v=verse(ref);return v?`<article class="v-source-page"><p class="v-source-label">${escape(v.surah)} ${escape(ref)}</p><p class="v-arabic" lang="ar" dir="rtl">${escape(v.arabic)}</p><p class="v-translation" lang="en" dir="ltr">${escape(v.translation)}</p><p class="v-translation-source">Saheeh International</p></article>`:`<p><a href="https://quran.com/${ref.replace(':','/')}" target="_blank" rel="noopener">${escape(t('quranSource'))} ${escape(ref)} ↗</a></p>`;}).join('');openSheet(t(example.title),`<p>${escape(t('sourceExplanation'))}</p>${cards}<p class="v-caption">${escape(t('guideDemoNote'))}</p>`,event.currentTarget);});guideResult('worry');
 }
 $$('[data-days]').forEach(button=>button.addEventListener('click',()=>{const days=Number(button.dataset.days),pages=Math.ceil(604/days);$$('[data-days]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));refresh($('.v-pace-number'),()=>{$('[data-pace-pages]').textContent=pages;});$('[data-pace-days]').textContent=days+' '+t('days');$('.v-pace-arc').style.setProperty('--pace-turn',`${(days-30)*1.4}deg`);$('[data-pace-status]').textContent=t('paceStatus',{pages,days});}));

 const hifz=$('[data-hifz-save]');
 if(hifz){
   let example=content.hifzExamples[0],records=new Map(),undo=null;
   function drawRecord(){
     const host=$('[data-hifz-record]');host.replaceChildren();
     if(!records.size){const p=document.createElement('p');p.textContent=t('emptyRecord');host.append(p);}
     records.forEach((state,id)=>{const item=content.hifzExamples.find(x=>x.id===id),row=document.createElement('button');row.type='button';row.className='v-record-row';row.dataset.recordId=id;row.innerHTML=`<span>${escape(item.label)}<small>${escape(t(state))}</small></span><span aria-hidden="true">↗</span>`;row.addEventListener('click',()=>openRecord(id,row));host.append(row);});
     $('[data-hifz-undo]').hidden=!undo;
   }
   function openRecord(id,button){const item=content.hifzExamples.find(x=>x.id===id),v=verse(item.first);openSheet(item.label,`<p>${escape(t('recordedCount',{count:item.count}))}</p><p class="v-arabic" lang="ar" dir="rtl">${escape(v.arabic)}</p><p class="v-translation" lang="en" dir="ltr">${escape(v.translation)}</p><div class="v-state-options">${['learning','memorised','revision'].map(state=>`<button type="button" data-record-state="${state}" data-record="${id}" aria-pressed="${records.get(id)===state}">${escape(t(state))}</button>`).join('')}</div><p class="v-caption">${escape(t('recordStateNote'))}</p>`,button);}
   function choose(id){example=content.hifzExamples.find(x=>x.id===id);$$('[data-hifz-example]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.hifzExample===id)));refresh($('.v-hifz-preview'),()=>{$('[data-hifz-reference]').textContent=example.label;$('[data-hifz-count]').textContent=example.count+' '+t('ayahs');$('[data-hifz-arabic]').textContent=verse(example.first).arabic;$('[data-hifz-last]').textContent=verse(example.last).arabic;$('[data-hifz-last]').previousElementSibling.hidden=example.count===1;$('[data-hifz-last]').hidden=example.count===1;$('#hifz-state').value='';$('[data-hifz-status]').textContent='';$('#hifz-state').removeAttribute('aria-invalid');});}
   $$('[data-hifz-example]').forEach(button=>button.addEventListener('click',()=>choose(button.dataset.hifzExample)));
   hifz.addEventListener('click',()=>{const state=$('#hifz-state').value;if(!state){$('[data-hifz-status]').textContent=t('stateNeeded');$('#hifz-state').setAttribute('aria-invalid','true');$('#hifz-state').setAttribute('aria-describedby',$('[data-hifz-status]').id='hifz-error');$('#hifz-state').focus();return;}undo=new Map(records);records.set(example.id,state);drawRecord();$('[data-hifz-status]').textContent=t('recordSaved',{passage:example.label});$('#hifz-state').removeAttribute('aria-invalid');});
   $('[data-hifz-undo]').addEventListener('click',()=>{if(!undo)return;records=undo;undo=null;drawRecord();$('[data-hifz-status]').textContent=t('recordUndone');hifz.focus();});
   dialog?.addEventListener('click',event=>{const button=event.target.closest('[data-record-state]');if(!button)return;undo=new Map(records);records.set(button.dataset.record,button.dataset.recordState);drawRecord();$$('[data-record-state]',dialog).forEach(b=>b.setAttribute('aria-pressed',String(b===button)));});
   choose('mulk');
 }
 if($('[data-theme-verse]')){$('[data-theme-verse]').textContent=verse('13:28').arabic;$('[data-theme-translation]').textContent=verse('13:28').translation;}

 $$('[data-logo-film]').forEach(film=>{
   const video=$('[data-logo-video]',film),control=$('[data-logo-toggle]',film);let visible=false,paused=false,finished=false,programmaticPause=false;
   const initialLabel=film.classList.contains('v-story-film')?'watchFilm':'watchFormation';
   const label=key=>control.textContent=t(key);
   function play(){if(!video.src)video.src=video.dataset.src;video.play().catch(()=>{paused=true;label(initialLabel);});}
   function stopForVisibility(){if(!video.paused){programmaticPause=true;video.pause();}}
   function sync(){if(!visible||document.hidden){stopForVisibility();return;}if(automatically()&&!paused&&!finished)play();}
   control.hidden=false;
   control.addEventListener('click',()=>{if(!video.paused){paused=true;video.pause();return;}if(finished){video.currentTime=0;finished=false;}paused=false;play();});
   video.addEventListener('playing',()=>{paused=false;finished=false;film.classList.add('is-playing');label('pauseAnimation');});
   video.addEventListener('pause',()=>{if(!programmaticPause&&!video.ended)paused=true;programmaticPause=false;label(finished||video.ended?'replayAnimation':'continueAnimation');});
   video.addEventListener('ended',()=>{finished=true;label('replayAnimation');});
   video.addEventListener('error',()=>{film.classList.remove('is-playing');control.hidden=true;});
   // Coming back to a film that has finished plays it again from the start; nobody should need a replay button.
   if('IntersectionObserver'in window)new IntersectionObserver(entries=>{const was=visible;visible=entries[0].isIntersecting;if(visible&&!was&&finished&&!paused){video.currentTime=0;finished=false;}sync();},{threshold:.35}).observe(film);
   document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',()=>{if(reduced.matches){stopForVisibility();film.classList.remove('is-playing');label(initialLabel);}else sync();});connection?.addEventListener('change',()=>{if(connection.saveData)stopForVisibility();else sync();});
 });
})();
