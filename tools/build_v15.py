"""Prepare static V1.5 pages locally. No deployment, dependencies or app writes."""
from pathlib import Path
import re, json, html

ROOT=Path(__file__).resolve().parents[1]
SITE='https://ummahtiofficial.com'
COPY=json.loads((ROOT/'i18n/v15.json').read_text(encoding='utf-8'))
COPY['en'].update({'interfaceLanguages':'Ten app interface languages.','releaseHeading':'The next chapter of Ummahti Quran','supportCurrent':'A place to begin with V1.5','policyDate':'Last updated: October 14, 2026','privacyNewHeading':'My Hifz and voice assistance','privacyState':'Your My Hifz record stays on your device. Nothing is added until you review the ayahs and save.','privacyVoice':'Microphone permission is requested only when you choose a voice step. Manual entry remains available.','privacyRecording':'Recitation recognition happens on the phone. Audio and recognised words stay in memory while the sheet is open and are then forgotten. They are not saved or sent as diagnostics.','privacyOnDevice':'Spoken references use the phone’s own on-device recogniser without a server fallback. Availability depends on the language and device.','privacyModel':'Recite to add has an optional download of about 107 MB from Ummahti’s GitHub releases. Ordinary connection metadata may be visible to GitHub; recitation and reading activity are not sent.'})
for line in (ROOT/'tools/i18n/v15-copy.tsv').read_text(encoding='utf-8').splitlines():
    if not line.strip(): continue
    key,ar,ur,id_=line.split('\t')
    for lang,value in [('ar',ar),('ur',ur),('id',id_)]: COPY.setdefault(lang,{})[key]=value
(ROOT/'i18n/v15.json').write_text(json.dumps(COPY,ensure_ascii=False,indent=2),encoding='utf-8')
THEMES=['obsidian','warm-cream','crisp-light','classic-ink','madinah','ottoman','andalusian','persian','sheikh-zayed','haramain','shiraz-dawn','jali-moon']
LANGS={'en':('English','ltr'),'ar':('العربية','rtl'),'ur':('اردو','rtl'),'id':('Bahasa Indonesia','ltr')}
TEMPLATE=(ROOT/'tools/v15-home.html').read_text(encoding='utf-8')
CONTENT=json.loads((ROOT/'media/v15/content.json').read_text(encoding='utf-8'))
RELEASE=json.loads((ROOT/'media/v15/release.json').read_text(encoding='utf-8'))
_moon=(ROOT/'media/v15/moon-data.js').read_text(encoding='utf-8')
MOON=json.loads(_moon[_moon.index('{'):_moon.rindex('}')+1])
snippets=json.loads((ROOT/'tools/v15-snippets.json').read_text(encoding='utf-8'))
sky=snippets['sky'].replace('\r\n','\n').replace('\r','\n')
HEAD=snippets['head'].replace('\r\n','\n').replace('\r','\n')
HEAD=re.sub(r'<script type="application/ld\+json">\s*\{\s*"@context": "https://schema.org",\s*"@type": "VideoObject".*?</script>','',HEAD,flags=re.S)
HEAD=re.sub(r'<link rel="stylesheet" href="/(?:hub|editorial)\.css[^>]+>','',HEAD)
HEAD=re.sub(r'/styles.css\?v=[^"\s]+','/styles.css?v=20261017v15',HEAD)
STYLES='\n<link rel="stylesheet" href="/v15.css?v=20261023r13">\n<link rel="stylesheet" href="/v15-renders.css?v=20261023r13">\n<link rel="stylesheet" href="/v15-experience.css?v=20261023r13">\n<link rel="stylesheet" href="/v15-handoff-craft.css?v=20261023r13">\n<link rel="stylesheet" href="/v15-hifz-refinement.css?v=20261023r13">\n<link rel="stylesheet" href="/v15-guide-light.css?v=20261023r13">\n<link rel="stylesheet" href="/v15-preview-controls.css?v=20261023r13">\n<link rel="stylesheet" href="/v15-hifz-preview.css?v=20261023r13">\n'
HEAD+=STYLES

def render(text,c):
    def sub(match):
        key=match.group(1)
        if key not in c: raise ValueError('Missing copy key: '+key)
        return c[key]
    return re.sub(r'\{\{([\w_-]+)\}\}',sub,text)

def link(lang,route=''):
    return ('/'+lang if lang!='en' else '')+'/'+(route+'/' if route else '')

def theme_buttons(c):
    return ''.join(f'<button type="button" class="v-theme-choice" data-v-theme="{name}" aria-pressed="false"><i data-theme="{name}" aria-hidden="true"></i><span>{html.escape(c["theme_"+name])}</span></button>' for name in THEMES)

def language_links(lang,route=''):
    return ''.join(f'<a href="{link(code,route)}" lang="{code}" hreflang="{code}"'+(' aria-current="page"' if code==lang else '')+f'>{name}</a>' for code,(name,direction) in LANGS.items())

def header(c,lang,route=''):
    home=link(lang)
    globe='<svg viewBox="0 0 24 24" data-language-globe aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/></svg>'
    palette='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none"/></svg>'
    caret='<svg class="v-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>'
    sound='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 5-5 4H3v6h3l5 4Z"/><path class="v-sound-wave" d="M15 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14"/><path class="v-sound-slash" d="m16 9 6 6m0-6-6 6"/></svg>'
    values={**c,'globeIcon':globe,'themeIcon':palette,'caretIcon':caret,'soundIcon':sound,'currentLanguage':LANGS[lang][0],'languageCode':lang.upper()}
    markup='''<a class="skip" href="#main">{{skip}}</a>
<header class="v-header"><nav class="v-nav" aria-label="{{pageSections}}">
<a class="v-brand" href="HOME" aria-label="Ummahti"><img src="/media/brand/2026-10/crescent-128.webp" width="128" height="128" alt=""><span>UMMAHTI</span></a>
<div class="v-nav-links"><a href="HOME#inside">{{navQuran}}</a><a href="HOME#purpose">{{navPurpose}}</a><a href="HOME#community">{{navCommunity}}</a></div>
<div class="v-nav-tools">
<span class="r-socials"><a href="https://www.youtube.com/@Ummahti" aria-label="YouTube @Ummahti"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.7 15.1V8.9l5.8 3.1z"/></svg></a><a href="https://www.instagram.com/ummahti_quran/" aria-label="Instagram @ummahti_quran"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4.3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.6" cy="6.4" r="1.2" fill="currentColor"/></svg></a></span>
<button class="v-utility v-site-sound" type="button" data-site-sound aria-pressed="false" aria-label="{{filmSound}}: {{rSoundOn}}" hidden>{{soundIcon}}<span class="v-utility-label">{{filmSound}}</span></button>
<details class="v-theme-menu"><summary class="v-utility" aria-label="{{readingTheme}}">{{themeIcon}}<span class="v-utility-label">{{readingTheme}}</span>{{caretIcon}}</summary><div class="v-popover">THEMES</div></details>
<details class="v-language"><summary class="v-utility" aria-label="{{language}}">{{globeIcon}}<span class="v-language-name">{{currentLanguage}}</span><span class="v-language-code" aria-hidden="true">{{languageCode}}</span>{{caretIcon}}</summary><div class="v-popover">LANGS</div></details>
<details class="v-menu"><summary class="v-utility">{{menu}}{{caretIcon}}</summary><div class="v-popover"><a href="HOME#inside">{{navQuran}}</a><a href="HOME#purpose">{{navPurpose}}</a><a href="HOME#community">{{navCommunity}}</a><a href="NEWS">{{whatsNew}}</a><a href="SUPPORT">{{support}}</a><a href="https://www.youtube.com/@Ummahti">YouTube @Ummahti</a><a href="https://www.instagram.com/ummahti_quran/">Instagram @ummahti_quran</a></div></details>
<a class="v-play-badge" href="https://play.google.com/store/apps/details?id=com.ummahti.quran"><img src="/media/brand/google-play-badge.png" width="646" height="250" alt="Get it on Google Play"></a>
</div></nav></header>'''
    return render(markup,values).replace('HOME',home).replace('THEMES',theme_buttons(c)).replace('LANGS',language_links(lang,route)).replace('NEWS',link(lang,'whats-new')).replace('SUPPORT',link(lang,'support'))

def footer(c,lang):
    text=render('''<footer class="v-footer"><div class="v-shell"><div class="v-footer-main"><div><a class="v-brand" href="HOME" aria-label="Ummahti"><img src="/media/brand/2026-10/crescent-128.webp" width="128" height="128" alt=""><span>UMMAHTI</span></a><p>{{footerPurpose}}</p></div><nav aria-label="{{footerExplore}}"><p>{{footerExplore}}</p><a href="QURAN">Ummahti Quran</a><a href="NEWS">{{whatsNew}}</a><a href="PRESS">{{press}}</a></nav><nav aria-label="{{footerChannels}}"><p>{{footerChannels}}</p><a href="https://www.youtube.com/@Ummahti">YouTube @Ummahti ↗</a><a href="https://www.instagram.com/ummahti_quran/">Instagram @ummahti_quran ↗</a><a href="https://play.google.com/store/apps/details?id=com.ummahti.quran">Google Play ↗</a></nav><nav aria-label="{{footerHelp}}"><p>{{footerHelp}}</p><a href="SUPPORT">{{support}}</a><a href="CONTACT">{{contact}}</a><a href="PRIVACY">{{privacy}}</a><a href="TERMS">{{terms}}</a></nav></div><div class="v-footer-bottom"><div><p>{{copyright}}</p><p>{{trademark}}</p></div><div class="v-language-links">LANGS</div><button type="button" class="v-quiet" data-motion-toggle aria-pressed="false">{{pauseAtmosphere}}</button></div></div></footer>''',c)
    for key,route in [('HOME',''),('QURAN','quran'),('NEWS','whats-new'),('PRESS','press'),('SUPPORT','support'),('CONTACT','contact'),('PRIVACY','privacy'),('TERMS','terms')]:
        text=text.replace(key,link(lang,route))
    return text.replace('LANGS',language_links(lang))

def reciter_wheel(lang):
    wheel=snippets['wheels'][lang].replace('\r\n','\n').replace('\r','\n')
    wheel=re.sub(r'<li[^>]*data-clip="minshawy_mujawwad".*?</li>','',wheel,flags=re.S)
    wheel=wheel.replace(' ed-verse','')
    return wheel

def head(lang,c,route=''):
    title=c['appPageTitle'] if route=='quran' else c['pageTitle']
    description=c['appDescription'] if route=='quran' else c['description']
    head=HEAD
    head=re.sub(r'<title>.*?</title>','<title>'+html.escape(title)+'</title>',head,flags=re.S)
    for key in ['description','og:description']:
        head=re.sub(r'(<meta (?:name|property)="'+key+r'" content=")[^"]*',lambda m:m[1]+html.escape(description,quote=True),head)
    head=re.sub(r'(<meta property="og:title" content=")[^"]*',lambda m:m[1]+html.escape(title,quote=True),head)
    canonical=SITE+link(lang,route)
    head=re.sub(r'(<link rel="canonical" href=")[^"]*',lambda m:m[1]+canonical,head)
    head=re.sub(r'(<meta property="og:url" content=")[^"]*',lambda m:m[1]+canonical,head)
    head=re.sub(r'<link rel="alternate"[^>]+>\s*','',head)
    head+='\n'+''.join(f'<link rel="alternate" hreflang="{code}" href="{SITE+link(code,route)}">\n' for code in LANGS)
    head+=f'<link rel="alternate" hreflang="x-default" href="{SITE+link("en",route)}">\n'
    if lang!='en': head+='<meta name="robots" content="noindex,follow">\n'
    def change_graph(m):
        data=json.loads(m[1]);graph=data.get('@graph',[])
        for entry in graph:
            if entry.get('@type')=='WebPage':
                entry.update({'url':canonical,'@id':canonical+'#page','name':title,'description':description,'inLanguage':lang})
                if route=='quran':
                    entry['mainEntity']={'@id':SITE+'/quran/#app'}
                    entry['about']={'@id':SITE+'/quran/#app'}
            if entry.get('@type')=='SoftwareApplication':
                entry['softwareVersion']='1.5.0'
                entry['description']=re.sub('<[^>]+>','',c['appDescription'])
        return '<script type="application/ld+json">'+json.dumps(data,ensure_ascii=False,separators=(',',':'))+'</script>'
    head=re.sub(r'<script type="application/ld\+json">(.*?)</script>',change_graph,head,flags=re.S)
    return head

def release_items(lang,extra_only=False):
    already={'v15_khatm_planner','v15_dua_library','v15_offline_recitation','v15_screens_adaptive'}
    return ''.join('<div><h3>'+html.escape(item['title'])+'</h3><p>'+html.escape(item['summary'])+'</p></div>' for item in RELEASE[lang]['items'] if not extra_only or item['id'] not in already)

def initial_examples(main,c):
    values={'unlock-ref':'Ad-Dhuhaa 93:1','unlock-arabic':CONTENT['verses']['93:1']['arabic'],'unlock-translation':CONTENT['verses']['93:1']['translation'],
            'guide-ref':"Ar-Ra'd 13:28",'guide-title':c['worryTitle'],'guide-arabic':CONTENT['verses']['13:28']['arabic'],'guide-translation':CONTENT['verses']['13:28']['translation'],
            'theme-verse':CONTENT['verses']['13:28']['arabic'],'theme-translation':CONTENT['verses']['13:28']['translation'],
            'hifz-arabic':CONTENT['verses']['67:1']['arabic'],'hifz-last':CONTENT['verses']['67:10']['arabic']}
    for key,value in values.items():
        main=re.sub(r'(<(?:p|h4|span)\b[^>]*\bdata-'+key+r'(?:="[^"]*")?[^>]*>).*?(</(?:p|h4|span)>)',lambda m:m[1]+html.escape(value)+m[2],main,flags=re.S)
    return main

def nights_table(c,lang):
    """The thirty juz as readable rows: the list equivalent of the drawn moon."""
    names=MOON['namesArabic'] if lang in ('ar','ur') else MOON['names']
    starts,verse=[],0
    for surah,count in enumerate(MOON['counts']):
        for ayah in range(1,count+1):
            code=ord(MOON['juz'][verse]);juz=code-64 if code<=90 else code-96+26
            if len(starts)<juz:starts.append((surah,ayah))
            verse+=1
    assert len(starts)==30
    rows=''.join(f'<tr><td>{j+1}</td><td>{MOON["juzSizes"][j]}</td><td>{html.escape(names[s])} {s+1}:{a}</td></tr>' for j,(s,a) in enumerate(starts))
    return f'<table><thead><tr><th scope="col">{c["juzHead"]}</th><th scope="col">{c["versesHead"]}</th><th scope="col">{c["beginsHead"]}</th></tr></thead><tbody>{rows}</tbody></table>'

SLIDES=[('home','media/screens/2026-10/home'),('mushaf','media/screens/2026-10/mushaf'),('stream','media/screens/2026-10/stream'),
        ('audio','media/screens/2026-10/audio'),('guide','media/screens/2026-10/guide'),('unlock','media/screens/2026-10/unlock'),
        ('hifz','media/v15/hifz-overview'),('recite','media/v15/hifz-recite'),('themes','media/screens/2026-10/themes')]

def webp_size(path):
    """Read the actual WebP canvas, keeping static page generation dependency-free."""
    with path.open('rb') as asset:
        data=asset.read(30)
    assert data[:4]==b'RIFF' and data[8:12]==b'WEBP',path
    kind=data[12:16]
    if kind==b'VP8X':
        return 1+int.from_bytes(data[24:27],'little'),1+int.from_bytes(data[27:30],'little')
    if kind==b'VP8L':
        bits=int.from_bytes(data[21:25],'little')
        return 1+(bits&0x3fff),1+((bits>>14)&0x3fff)
    assert kind==b'VP8 ' and data[23:26]==b'\x9d\x01\x2a',path
    return int.from_bytes(data[26:28],'little')&0x3fff,int.from_bytes(data[28:30],'little')&0x3fff

def slides_html(c):
    """Real app screens, one claim and one plain sentence each."""
    items=''
    for k,(id_,path) in enumerate(SLIDES,1):
        title=c['slide_'+id_+'_title'];body=c['slide_'+id_+'_body']
        width,height=webp_size(ROOT/(path+'-420.webp'))
        items+=(f'<li class="v-slide" data-slide aria-roledescription="slide" aria-label="{k} / {len(SLIDES)}"><figure>'
                f'<div class="v-phone"><img src="/{path}-420.webp" srcset="/{path}-420.webp 420w, /{path}-840.webp 840w" sizes="(max-width:680px) 62vw, 300px" '
                f'width="{width}" height="{height}" loading="lazy" decoding="async" alt="{html.escape(re.sub("<[^>]+>","",title),quote=True)}" draggable="false"></div>'
                f'<figcaption><h3>{title}</h3><p>{body}</p></figcaption></figure></li>')
    return items

CHANNEL_YT=[('yt-low-quality','https://www.youtube.com/shorts/bAO5TOpjv8k',"It's always the low quality videos",'Al-Baqarah 2:17'),
    ('yt-mercy','https://www.youtube.com/shorts/PG1MAkBVVPQ','Do not despair of the mercy of Allah','Az-Zumar 39:53'),
    ('yt-shuraim','https://www.youtube.com/shorts/p5GlcDRFVjY','Sheikh Saud Al-Shuraim','Al-Fatiha'),
    ('yt-dosari-maryam','https://www.youtube.com/shorts/V9LI220Ih_0','Surah Maryam · Yasser Al-Dosari','Maryam 19:30'),
    ('yt-musa-two-voices','https://www.youtube.com/shorts/OtrO8GSqRBA','When Makkah and Madinah voices unite','Ta-Ha · Musa'),
    ('yt-child-imam','https://www.youtube.com/shorts/98pC52vB62w','A child leading grown men in prayer','Al-Fatiha · At-Tariq')]
CHANNEL_STUDIO=[('st-kahf-309','Why not just say 309?','Al-Kahf 18:25'),('st-ar-rum','A prediction with a deadline','Ar-Rum 30:2–4'),
    ('st-umm-musa','What did Allah tell her?','Al-Qasas 28:7'),('st-spider','The frailest of homes','Al-Ankabut 29:41'),
    ('st-kursi','First and last names','Al-Baqarah 2:255'),('st-maryam-dates','Why ripe dates?','Maryam 19:25')]

def channel_tiles(c):
    """Posters and six-second loops cut from the published Ummahti Shorts masters (media/channel)."""
    def tile(id_,href,title,ref,platform):
        return (f'<li><a class="r-tile" href="{href}"><img src="/media/channel/{id_}.webp" width="360" height="640" loading="lazy" decoding="async" alt="">'
                f'<video data-src="/media/channel/{id_}.mp4" muted loop playsinline preload="none" aria-hidden="true" tabindex="-1" disablepictureinpicture></video>'
                f'<span class="r-play" aria-hidden="true">▶</span><span class="r-meta"><small>{platform} · {html.escape(ref)}</small><b>{html.escape(title)}</b></span></a></li>')
    yt=''.join(tile(i,h,ti,r,'YouTube') for i,h,ti,r in CHANNEL_YT)
    st=''.join(tile(i,'https://www.instagram.com/ummahti_quran/',ti,r,'Instagram') for i,ti,r in CHANNEL_STUDIO)
    return {'channelLaneYouTube':yt,'channelLaneStudio':st}

def guide_lead(c,lang):
    """The Guide lead carries the catalogue's own counts, read from the generated data."""
    raw=(ROOT/f'media/v15/guide-{lang}.js').read_text(encoding='utf-8')
    counts=json.loads(raw[raw.index('{'):raw.rindex('}')+1])['counts']
    return c['guideMapLead'].replace('{topics}',str(counts['topics'])).replace('{quran}',str(counts['quran'])).replace('{narrations}',str(counts['narrations']))

def library_counts(c,lang):
    """Du'a and reflection leads carry the library's own counts."""
    raw=(ROOT/f'media/v15/library-{lang}.js').read_text(encoding='utf-8')
    data=json.loads(raw[raw.index('{'):raw.rindex('}')+1])
    duas=data['duas'];refl=data['reflections']
    values={'duas':len(duas),'quranic':sum(1 for d in duas if not d['ar']),'prophetic':sum(1 for d in duas if d['ar']),'collections':len(data['collections']),
            'reflections':len(refl),'ayah':sum(1 for r in refl if 'q' in r),'narration':sum(1 for r in refl if 'h' in r)}
    out={}
    for key in ('duaLead','reflLead'):
        text=c[key]
        for k,v in values.items(): text=text.replace('{'+k+'}',str(v))
        out[key]=text
    return out

def hero_ayah(lang):
    """Ya-Seen 36:40 from the corpus, with "each, in an orbit, is swimming" brought forward."""
    ayah=MOON['heroAyah'];s,a=ayah['ref']
    arabic=ayah['arabic'];cut=arabic.index('وَكُل')
    english=ayah['translation'];phrase='each, in an orbit, is swimming'
    assert phrase in english
    name=MOON['namesArabic'][s-1] if lang in ('ar','ur') else ayah['name']
    return {'heroAyahArabic':html.escape(arabic[:cut])+'<em>'+html.escape(arabic[cut:])+'</em>',
            'heroAyahTranslation':html.escape(english).replace(phrase,'<em>'+phrase+'</em>'),
            'heroAyahRef':html.escape(name)+f' {s}:{a}'}

def scripts(lang,moon=False):
    extra=f'\n<script src="/media/v15/moon-data.js?v=20261023r13" defer></script>\n<script src="/v15-moon.js?v=20261023r13" defer></script>\n<script src="/v15-slides.js?v=20261023r13" defer></script>\n<script src="/media/v15/guide-{lang}.js?v=20261023r13" defer></script>\n<script src="/v15-guide-search.js?v=20261023r13" defer></script>\n<script src="/v15-guide.js?v=20261023r13" defer></script>\n<script src="/media/v15/library-{lang}.js?v=20261023r13" defer></script>\n<script src="/v15-library.js?v=20261023r13" defer></script>\n<script src="/v15-flow.js?v=20261023r13" defer></script>\n<script src="/media/v15/renders-data.js?v=20261023r13" defer></script>\n<script src="/v15-phone-handoff.js?v=20261023r13" defer></script>\n<script src="/v15-preview-audio.js?v=20261023r13" defer></script>\n<script src="/v15-hifz-preview.js?v=20261023r13" defer></script>\n<script src="/v15-renders.js?v=20261023r13" defer></script>' if moon else ''
    if moon:
        extra='\n<script src="/v15-field-light.js?v=20261023r13" defer></script>'+extra
    return f'<script src="/i18n/v15-{lang}.js?v=20261023r13" defer></script>\n<script src="/media/v15/content.js?v=20261017v15" defer></script>\n<script src="/sky.js?v=20261023r13" defer></script>\n<script src="/verse.js?v=20261023r13" defer></script>\n<script src="/v15.js?v=20261023r13" defer></script>{extra}'

def write_page(path,text):
    text=text.replace('\r\n','\n').replace('\r','\n')
    text='\n'.join(line.rstrip() for line in text.split('\n'))
    text=re.sub(r'\n{3,}','\n\n',text)
    path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text,encoding='utf-8',newline='\n')

def document(lang,c,route,main,document_head):
    old=document_head
    # Preserved document heads may carry another page's old share metadata.
    # Keep the document's own title/copy and its actual route authoritative.
    title=html.unescape(re.search(r'<title>(.*?)</title>',old,re.S)[1]).strip()
    old=re.sub(r'(<meta property="og:title" content=")[^"]*',lambda m:m[1]+html.escape(title,quote=True),old)
    old=re.sub(r'(<meta property="og:url" content=")[^"]*',lambda m:m[1]+SITE+link(lang,route),old)
    if route=='contact':
        description=html.unescape(re.search(r'<meta name="description" content="([^"]*)"',old)[1])
        old=re.sub(r'(<meta property="og:description" content=")[^"]*',lambda m:m[1]+html.escape(description,quote=True),old)
    if lang!='en':
        old=re.sub(r'<meta\b[^>]*name="robots"[^>]*>\s*','',old)
        old+='\n<meta name="robots" content="noindex,follow">\n'
    old=re.sub(r'/styles.css\?v=[^"\s]+','/styles.css?v=20261017v15',old)
    old=re.sub(r'<link rel="stylesheet" href="/v15[^"\s]*\.css[^>]*>','',old)
    old+=STYLES
    note='<p class="v-locale-note">'+html.escape(c['localeNote'])+'</p>' if lang!='en' else ''
    return f'<!doctype html>\n<html lang="{lang}" dir="{LANGS[lang][1]}" class="no-js v15-page"><head>{old}</head><body>{sky}{header(c,lang,route)}{note}{main}{footer(c,lang)}{scripts(lang)}</body></html>'

def build(languages=None):
  for lang in (languages or LANGS):
    c={**COPY['en'],**COPY.get(lang,{})}
    runtime={key:re.sub('<[^>]+>','',re.sub(r'<br\s*/?>',' ',value,flags=re.I)) for key,value in c.items()}
    write_page(ROOT/f'i18n/v15-{lang}.js','window.UMMAHTI_V15_I18N = '+json.dumps(runtime,ensure_ascii=False,separators=(',',':'))+';\n')
    c={**c,'themeButtons':theme_buttons(c),'reciterWheel':reciter_wheel(lang),'nightsTable':nights_table(c,lang),'slidesList':slides_html(c),**channel_tiles(c),'guideMapLead':guide_lead(c,lang),**library_counts(c,lang),**hero_ayah(lang)}
    main=initial_examples(render(TEMPLATE,c),c)
    # Stable old root bookmarks reach the corresponding new story.
    if lang!='en':
        main=main.replace('href="/quran/#catalogue"',f'href="{link(lang,"quran")}#catalogue"').replace('href="/privacy/"',f'href="{link(lang,"privacy")}"')
    note=f'<p class="v-locale-note">{html.escape(c["localeNote"])}</p>' if lang!='en' else ''
    for route in ('','quran'):
        body=main
        if route=='quran':
            catalogue=render('''<section class="v-chapter v-shell v-library" id="catalogue"><p class="v-kicker">Ummahti Quran V1.5</p><h2>{{catalogueTitle}}</h2><p class="v-lead">{{catalogueLead}}</p><div class="v-catalogue"><div><h3>{{readWay}}</h3><p>{{readWayBody}}</p><ul><li>{{readingModes}}</li><li>{{scriptCount}}</li><li>{{translationCount}}</li><li>{{transliteration}}</li></ul></div><div><h3>{{keepMeaning}}</h3><p>{{keepMeaningBody}}</p><ul><li>{{duasCount}}</li><li>{{reflectionBody}}</li><li>{{bookmarksBody}}</li><li>{{tafsirBody}}</li></ul></div><div><h3>My Khatm</h3><p>{{khatmBody}}</p><p>{{khatmHonesty}}</p></div><div><h3>My Hifz</h3><p>{{hifzBody}}</p><p>{{bulkDescription}}</p></div><div><h3>{{recitation}}</h3><p>{{audioFacts}}</p><p>{{audioLimit}}</p></div><div><h3>{{fitLife}}</h3><p>{{adaptiveBody}}</p><p>{{interfaceLanguages}}</p><p>{{journeyShort}}</p></div></div></section>''',c)
            body=body.replace('<section class="v-chapter v-listen"',catalogue+'<section class="v-chapter v-listen"',1)
            extras='<details class="v-app-details"><summary>'+html.escape(c['everydayDetails'])+'</summary><div class="v-catalogue">'+release_items(lang,True)+'</div></details>'
            body=body.replace(catalogue,catalogue.replace('</section>',extras+'</section>'),1)
        text=f'<!doctype html>\n<html lang="{lang}" dir="{LANGS[lang][1]}" class="no-js v15-page"><head>{head(lang,c,route)}</head><body>{sky}{header(c,lang,route)}{note}{body}{footer(c,lang)}{scripts(lang,True)}</body></html>'
        write_page(ROOT/link(lang,route).lstrip('/')/'index.html',text)
    for route in ('support','contact','press','privacy','terms','whats-new'):
        name=(lang+'/' if lang!='en' else '')+route+'/index.html'
        # Rebuilding chrome never discards an existing document's body.
        current=ROOT/name
        source=current.read_text(encoding='utf-8')
        main_doc=re.search(r'<main\b.*?</main>',source,re.S).group(0)
        old_head=source.split('<head>',1)[1].split('</head>',1)[0]
        if route=='press':
            descriptions=iter([c['tagline'],c['description'],c['description']+' '+c['khatmBody']+' '+c['hifzBody']+' '+c['guideBody']+' '+c['audioFacts']])
            main_doc=re.sub(r'(<p\b[^>]*\bdata-copy-text[^>]*>).*?</p>',lambda m:m[1]+html.escape(next(descriptions))+'</p>',main_doc,flags=re.S)
            gallery=''.join('<li><a href="/media/v15/'+id_+'-840.webp" download><img src="/media/v15/'+id_+'-420.webp" width="420" height="910" loading="lazy" decoding="async" alt="'+html.escape(c[alt],quote=True)+'"></a><b>'+html.escape(c[title])+'</b></li>' for id_,title,alt in [('home','appHome','homeAlt'),('hifz-overview','hifzLabel','hifzAlt'),('reader','practiceLabel','practiceAlt'),('hifz-review','recordLabel','recordAlt')])
            def fresh_captures(match):
                section=match[0]
                section=re.sub(r'(<p class="press-intro"[^>]*>).*?</p>',lambda m:m[1]+html.escape(c['pressCaptureNote'])+'</p>',section,flags=re.S)
                return re.sub(r'(<ul class="press-shots"[^>]*>).*?</ul>',lambda m:m[1]+gallery+'</ul>',section,flags=re.S)
            main_doc=re.sub(r'<section\b[^>]*aria-labelledby="shots-title".*?</section>',fresh_captures,main_doc,flags=re.S)
        if route=='whats-new':
            main_doc=re.sub(r'<section class="v-release-current".*?</section>','',main_doc,flags=re.S)
            main_doc=re.sub(r'<section class="v-local-update(?:\s[^"]*)?".*?</section>','',main_doc,flags=re.S)
            block=render('<section class="v-release-current" id="v1-5"><p class="v-kicker">{{releaseHeading}}</p><h2>1.5.0</h2><h3>My Hifz</h3><p>{{hifzBody}}</p><p>{{reciteDescription}} {{spokenDescription}} {{bulkDescription}}</p>',c)
            block+=release_items(lang)+'<h3>'+html.escape(c['refinements'])+'</h3><ul>'+''.join('<li>'+html.escape(value)+'</li>' for value in RELEASE[lang]['improvements'])+'</ul><p>'+html.escape(c['reflectionBody'])+'</p><p><a href="'+link(lang,'quran')+'#catalogue">'+html.escape(c['allFeatures'])+' ↗</a></p><hr></section>'
            main_doc=re.sub(r'(<article\b[^>]*>)',lambda m:m[1]+block,main_doc,count=1)
        if lang!='en':
            main_doc=re.sub(r'<section class="v-local-update(?:\s[^"]*)?".*?</section>','',main_doc,flags=re.S)
            block=''
            if route=='support':
                block=render('''<section class="v-local-update v-support-current"><h2>{{supportCurrent}}</h2><h3>My Hifz</h3><p>{{findPassageBody}} {{makeItYoursBody}}</p><details><summary>{{faqVoice}}</summary><p>{{spokenDescription}}</p><p>{{reciteDescription}}</p><p>{{privacyModel}}</p></details><h3>My Khatm</h3><p>{{khatmBody}}</p><p>{{khatmHonesty}}</p><h3>Ayah on Unlock</h3><p>{{unlockBody}} {{placeSafe}}</p><p>{{everyUnlock}} · {{hourly}} · {{daily}}</p><h3>{{recitation}}</h3><p>{{offlineBody}} {{audioLimit}}</p><hr></section>''',c)
            if route=='press':
                block=render('''<section class="v-local-update"><h2>Ummahti · Ummahti Quran</h2><p>{{faqIdentityAnswer}}</p><h3>V1.5</h3><p>{{khatmShort}} {{hifzShort}} {{translationCount}} {{transliteration}} {{guideScope}} {{duasCount}} {{reflectionBody}} {{adaptiveBody}} {{audioFacts}}</p><hr></section>''',c)
                main_doc=main_doc.replace('1.4.0','1.5.0')
                main_doc=main_doc.replace('/media/brand/2026-10/icon-512.png','/media/brand/2026-10-17/quran-app-512.png')
            if route=='privacy':
                block=render('''<section class="v-local-update"><h2>{{privacyNewHeading}}</h2><p>{{privacyState}}</p><p>{{privacyVoice}}</p><p>{{privacyRecording}}</p><p>{{privacyOnDevice}}</p><p>{{privacyModel}}</p><hr></section>''',c)
                main_doc=re.sub(r'<p class="lede"[^>]*>.*?</p>',lambda m:'<p class="lede">'+c['policyDate']+'</p>',main_doc,count=1,flags=re.S)
            if block:
                main_doc=re.sub(r'(<article\b[^>]*>)',lambda m:m[1]+block,main_doc,count=1)
        write_page(current,document(lang,c,route,main_doc,old_head))
  # Play's legacy GitHub Pages policy URLs need actual self-contained text:
  # that mirror does not implement Cloudflare's redirects.
  policy=(ROOT/'privacy/index.html').read_text(encoding='utf-8')
  article=re.search(r'<article\b[^>]*>(.*?)</article>',policy,re.S)[1]
  for name in ('privacy-policy.html','PRIVACY_POLICY.html'):
    path=ROOT/name
    mirror=path.read_text(encoding='utf-8')
    mirror=re.sub(r'(<article\b[^>]*>).*?(</article>)',lambda m:m[1]+article+m[2],mirror,flags=re.S)
    mirror=re.sub(r'Last updated: [^<]+','Last updated: October 14, 2026',mirror,count=1)
    write_page(path,mirror)
  routes=('','quran','support','contact','press','privacy','terms','whats-new')
  write_page(ROOT/'sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+''.join('  <url><loc>'+SITE+link('en',route)+'</loc></url>\n' for route in routes)+'</urlset>\n')
  print('Built V1.5 root, app and shared document pages for '+', '.join(languages or LANGS)+'.')

if __name__=='__main__':
    import sys
    build(sys.argv[1:] or None)
