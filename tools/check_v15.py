"""Focused source/translation/identity checks for the static V1.5 website."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib,json,re
ROOT=Path(__file__).resolve().parents[1]
copy=json.loads((ROOT/'i18n/v15.json').read_text(encoding='utf-8'))
facts=json.loads((ROOT/'media/v15/content.json').read_text(encoding='utf-8'))['facts']
assert facts['recitations']==37 and facts['guideTopics']==86 and facts['duaEntries']==55
assert facts['translations']==18 and facts['translationLanguages']==9 and len(facts['themes'])==12
assert facts['surahs']==114 and facts['ayahs']==6236
assert facts['reflections']==338
release=json.loads((ROOT/'media/v15/release.json').read_text(encoding='utf-8'))
for name in ('privacy-policy.html','PRIVACY_POLICY.html'):
    mirror=(ROOT/name).read_text(encoding='utf-8')
    assert 'October 14, 2026' in mirror and '107' in mirror and 'My Hifz' in mirror
for lang in ('ar','ur','id'):
    missing=set(copy['en'])-set(copy[lang])
    assert not missing,(lang,missing)
    assert all(copy[lang][key].strip() for key in copy['en'])
    text=(ROOT/lang/'index.html').read_text(encoding='utf-8')
    assert f'lang="{lang}"' in text
    direction=re.search(r'<html\b[^>]*\bdir="([^"]+)"',text).group(1)
    assert (direction=='rtl')==(lang in ('ar','ur'))
    assert 'noindex,follow' in text,'Native review is still pending'
    assert copy[lang]['heroTitle'] in text
    assert '{{' not in text
    assert copy[lang]['privacyVoice'] in (ROOT/lang/'privacy/index.html').read_text(encoding='utf-8')
    from html import escape
    news=(ROOT/lang/'whats-new/index.html').read_text(encoding='utf-8')
    assert all(escape(item['title']) in news for item in release[lang]['items'])

class Structure(HTMLParser):
    def __init__(self,text):
        super().__init__();self.tabs={};self.panels={};self.ids=set();self.scripts=[];self.feed(text)
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if a.get('id'): assert a['id'] not in self.ids,a['id'];self.ids.add(a['id'])
        if a.get('role')=='tab': self.tabs[a['id']]=a['aria-controls']
        if a.get('role')=='tabpanel':self.panels[a['id']]=a['aria-labelledby']
        if tag=='script' and a.get('src'): self.scripts.append(a['src'])
for lang in ('en','ar','ur','id'):
    prefix=ROOT if lang=='en' else ROOT/lang
    press=(prefix/'press/index.html').read_text(encoding='utf-8')
    gallery=re.search(r'<ul class="press-shots"[^>]*>(.*?)</ul>',press,re.S)[1]
    assert '/media/screens/' not in gallery and gallery.count('/media/v15/')==8
    for route in ('','quran'):
        path=prefix/route/'index.html';text=path.read_text(encoding='utf-8');p=Structure(text)
        assert len(p.tabs)==4 and len(p.panels)==4
        assert all(p.panels[panel]==tab for tab,panel in p.tabs.items())
        assert not any('lenis' in script or 'app.js' in script for script in p.scripts)
        assert '/v15.js' in ' '.join(p.scripts)
        assert '/media/brand/2026-10-17/quran-app-512.png' in text
        assert 'data-clip="minshawy_mujawwad"' not in text
        assert 'id=com.ummahti.quran' in text
        assert '{{' not in text
        assert 'data-hifz-last>' in text and facts['reflections']==338
        if route=='quran': assert 'Pass On the Light' in text or lang!='en'
for path in ROOT.rglob('index.html'):
    if any(part.startswith('.') for part in path.relative_to(ROOT).parts):continue
    text=path.read_text(encoding='utf-8')
    if path.parts[-2] not in ('ops','updates','emergency','youtube'):
        assert 'v15-page' in text,path

expected=ROOT/'media/brand/2026-10-17/quran-app-512.png'
assert hashlib.sha256(expected.read_bytes()).hexdigest()=='647265c16c0c4bf8b6bac026796354a6113747b040fd74dc278a5a5c78a496db'
js=(ROOT/'v15.js').read_text(encoding='utf-8')
keys=set(re.findall(r"\bt\('([\w-]+)'",js))
assert keys<=set(copy['en']),keys-set(copy['en'])
assert 'navigator.mediaDevices' not in js and 'fetch(' not in js
assert 'localStorage.setItem' in js and 'ummahti:theme' in js
print('V1.5 source counts, locked icon, four reciprocal tabs, native scrolling and exact app links passed.')
print('All copy keys present in Arabic, Urdu and Indonesian; RTL, draft status and new support/release/privacy copy passed.')
