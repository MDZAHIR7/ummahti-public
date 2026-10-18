"""Read the current Android trees; prepare web evidence without changing them."""
from pathlib import Path
import json, re, shutil, zipfile
import xml.etree.ElementTree as ET
from PIL import Image, ImageOps, ImageDraw
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
APP = Path(r'C:\Users\1zahi\AndroidStudioProjects\UmmahtiQuran2')
WORK = Path(r'C:\Users\1zahi\.codex\worktrees\v1-5-nav-drag\UmmahtiQuran2')
JAVA = APP / 'app/src/main/java/com/ummahti/quran'
OUT = ROOT / 'media/v15'
OUT.mkdir(exist_ok=True)
font=TTFont(APP/'app/src/main/res/font/amiri_regular.ttf')
font.flavor='woff2';font.save(OUT/'amiri.woff2')
shutil.copyfile(APP/'app/src/main/assets/licenses/amiri_ofl.txt',OUT/'amiri-OFL.txt')
backup = ROOT / '.claude/before-v15-20261017.zip'
if not backup.exists():
    with zipfile.ZipFile(backup, 'w', zipfile.ZIP_DEFLATED) as archive:
        for file in ROOT.rglob('*'):
            rel = file.relative_to(ROOT)
            if file.is_file() and not any(p.startswith('.') for p in rel.parts) and rel.parts[0] not in ('ops','updates','emergency','youtube') and file.suffix in ('.html','.js','.css','.py','.json','.md','.xml'):
                archive.write(file, rel)

corpus = json.loads((APP / 'app/src/main/assets/quran_data.json').read_text(encoding='utf-8-sig'))
def verse(s, a):
    surah = next(x for x in corpus if x['number'] == s)
    ayah = next(x for x in surah['ayahs'] if x['ayahNumber'] == a)
    return {'reference':f'{s}:{a}', 'surah':surah['nameTransliteration'],
            'arabic':ayah['textUthmani'].lstrip('\ufeff'), 'translation':ayah['translation']}

guide = (JAVA / 'feature/guide/GuideCatalog.kt').read_text(encoding='utf-8')
audio = (JAVA / 'data/audio/AudioPlayerManager.kt').read_text(encoding='utf-8')
reciters = audio.split('val SUPPORTED_RECITERS = listOf(')[1].split('\n)')[0]
reciters = re.sub(r'//[^\n]*','',reciters)
themes = (JAVA / 'ui/theme/Theme.kt').read_text(encoding='utf-8').split('enum class AppThemeMode(')[1].split('\n}\n')[0]
theme_names = re.findall(r'^    ([A-Z_]+)\(',themes,re.M)
duas = (JAVA / 'feature/duas/DuaLibrary.kt').read_text(encoding='utf-8')
topics = (JAVA / 'data/topics/CuratedTopics.kt').read_text(encoding='utf-8')
editions = (JAVA / 'data/repository/repository.kt').read_text(encoding='utf-8').split('val editions = listOf(')[1].split('\n    )')[0]
language_keys = re.findall(r'TranslationEdition\(\s*"([^"]+)"\s*,\s*"([^"]+)"',editions)
language_keys = [(k,l) for k,l in language_keys if l != 'ar']
facts = {'guideTopics':len(re.findall(r'\bGuideTopic\(',guide)),
         'recitations':len(re.findall(r'\bReciterInfo\(',reciters)),
         'themes':theme_names,'translations':len(language_keys),
         'translationLanguages':len(set(l for k,l in language_keys)),
         'duaEntries':len(re.findall(r'\bDua\(',duas)),
         'surahs':len(corpus),'ayahs':sum(len(s['ayahs']) for s in corpus)}
reflection_files=list((JAVA/'data/reflectionlibrary').glob('ReflectionLibrary*.kt'))
reflection_text='\n'.join(p.read_text(encoding='utf-8') for p in reflection_files)
facts['reflections']=len(re.findall(r'\bSourceLockedReflection\(',reflection_text))-len(re.findall(r'reviewStatus\s*=\s*ReflectionReviewStatus\.(?:HELD|DRAFT)',reflection_text))
data = {'facts':facts,'verses':{f'{s}:{a}':verse(s,a) for s,a in [(93,1),(93,2),(93,3),(13,28),(39,53),(94,5),(94,6),(2,286),(4,110),(66,8),(2,153),(2,255),(67,1),(67,10),(12,1),(12,10),(21,92)]},
        'hifzExamples':[{'id':'mulk','label':'Al-Mulk 1–10','count':10,'first':'67:1','last':'67:10'},
                        {'id':'kursi','label':'Ayat al-Kursi','count':1,'first':'2:255','last':'2:255'},
                        {'id':'yusuf','label':'Yusuf 1–10','count':10,'first':'12:1','last':'12:10'}]}
assert all(ord(char) in font.getBestCmap() or char.isspace() for v in data['verses'].values() for char in v['arabic']), 'A corpus glyph is missing from the paired font'
(OUT / 'content.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
# A script file keeps the existing restrictive connect-src policy intact.
(OUT / 'content.js').write_text('window.UMMAHTI_CONTENT = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')

# Current public release wording, including the app's own translations.
release=(JAVA/'data/release/ReleaseNotes.kt').read_text(encoding='utf-8').split('versionName = "1.5.0"',1)[1]
items=re.findall(r'id = "(v15_[^"]+)".*?titleRes = R.string.(\w+).*?summaryRes = R.string.(\w+)',release,re.S)
improvements=re.findall(r'ReleaseImprovement\(\s*"v15_[^"]+",\s*R.string.(\w+)',release)
release_copy={}
for lang in ('en','ar','ur','id'):
    strings={}
    qualifier='in' if lang=='id' else lang
    for file in (APP/'app/src/main/res'/('values' if lang=='en' else 'values-'+qualifier)).glob('*.xml'):
        for node in ET.parse(file).getroot().findall('string'):
            strings[node.attrib['name']]=''.join(node.itertext()).replace("\\'", "'").replace('\\"','"').replace('\\n',' ')
    release_copy[lang]={'items':[{'id':id_,'title':strings[title],'summary':strings[summary]} for id_,title,summary in items], 'improvements':[strings[key] for key in improvements]}
(OUT/'release.json').write_text(json.dumps(release_copy,ensure_ascii=False,indent=2),encoding='utf-8')

captures = {
    'home':'00_launch.png','hifz':'22_sparse_collection.png','hifz-group':'26_stack_open.png',
    'hifz-add':'03_add_sheet.png','hifz-review':'07_passage_state.png',
    'hifz-bulk':'42_bulk_confirm.png','hifz-recite':'51_recite_ready.png',
    'hifz-reference':'20_say_arrahman.png','reader':'01_read.png',
    'hifz-overview':'24_sparse_collection.png',
}
source = WORK / 'build/my-hifz/topic1/walkthrough'
for name, filename in captures.items():
    with Image.open(source / filename) as original:
        for width in (420,840):
            original.resize((width,round(original.height*width/original.width)),Image.Resampling.LANCZOS).save(OUT/f'{name}-{width}.webp',quality=88,method=6)

sheet = Image.new('RGB',(5*210,2*480),'#0b1210')
draw = ImageDraw.Draw(sheet)
for i,(name,filename) in enumerate(captures.items()):
    with Image.open(source/filename) as original:
        small = ImageOps.contain(original.convert('RGB'),(200,440))
        x,y=(i%5)*210,(i//5)*480
        sheet.paste(small,(x,y+25));draw.text((x+6,y+5),name,fill='white')
sheet.save(ROOT/'.claude/v15-captures.jpg')
(OUT/'SOURCES.md').write_text('''# V1.5 evidence

Images are untouched compositions from the isolated v1.5-nav-drag worktree,
build/my-hifz/topic1/walkthrough (16 October 2026). Only size and encoding change.
Development badges, fixture content and Android chrome are retained.
content.json and content.js contain selected verses from the authoritative app
corpus, its bundled Saheeh International translation, and source-derived counts.
No scripture is composed or generated. prepare_v15.py reproduces these files.
release.json preserves the current app's release titles and summaries in its
English, Arabic, Urdu and Indonesian resources. My Hifz is added separately
from the newer isolated contract. The reflection count excludes held entries.
amiri.woff2 is the full approved Amiri Regular 1.002 from the app, re-encoded
without subsetting. QuranScriptRegistry pairs this face with textUthmani.
Every selected Quran codepoint is checked against its cmap; the SIL OFL
licence travels alongside the font. Browser shaping still needs device review.

app-film.mp4 reuses the owner's October new-logo short, 75.57 seconds,
UmmahtiAds/Videos/ummahti-short-v3-new-logo-1440x2560.mp4. The composition and
soundtrack are unchanged; encoding is H.264 at 720x1280, 30 fps, CRF 24,
AAC 128k, yuv420p and faststart. The poster is its genuine frame at 18 seconds.
The film is loaded only on view or explicit play, starts muted and is paused
offscreen. Native controls provide sound, seeking and keyboard access.
''',encoding='utf-8')
print(json.dumps(facts,indent=2))
print('Preserved previous website sources; prepared 10 genuine V1.5 capture pairs.')
