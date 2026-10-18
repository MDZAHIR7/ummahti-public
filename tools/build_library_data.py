"""Build the website's du'a library and reflection library from the app. Reads the app tree only.

Du'as: feature/duas DuaLibrary.kt + DuaCitations.kt (and Guide citations they share), published as the
app publishes them (reviewed du'a, reviewed citation). Quranic du'as point at their ayat; Prophetic
du'as carry the Arabic exactly as the app prints it, with collection, number, grade and link.

Reflections: data/reflectionlibrary/*.kt, published exactly as ReflectionLibrary.published
(reviewStatus REVIEWED). Each keeps its source: an ayah, or a narration with collection, number,
grade and grader. Text comes from the app's own string resources in all four languages.

Writes media/v15/library-{en,ar,ur,id}.js.
"""
from pathlib import Path
import html, json, re, sys

ROOT = Path(__file__).resolve().parents[1]
APP = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r'C:\Users\1zahi\AndroidStudioProjects\UmmahtiQuran2')
SRC = APP / 'app/src/main/java/com/ummahti/quran'
RES = APP / 'app/src/main/res'
LANGS = {'en': 'values', 'ar': 'values-ar', 'ur': 'values-ur', 'id': 'values-in'}
COLLECTIONS = ['DISTRESS', 'ANXIETY_AND_SORROW', 'ILLNESS_AND_HEALING', 'FORGIVENESS', 'PROTECTION', 'FAMILY',
               'PROVISION_AND_DEBT', 'TRAVEL', 'SLEEP_AND_WAKING', 'DAILY_REMEMBRANCE', 'GUIDANCE_AND_KNOWLEDGE']
COLLECTION_LABELS = ['distress', 'anxiety', 'illness', 'forgiveness', 'protection', 'family', 'provision', 'travel', 'sleep', 'remembrance', 'guidance']
THEMES = ['PROPHETS', 'MERCY', 'PATIENCE', 'WORSHIP', 'DUA', 'CHARACTER', 'HEREAFTER', 'GRATITUDE']
LIBRARY_ORDER = ['Prophets', 'Mercy', 'Patience', 'Worship', 'Dua', 'Character', 'Hereafter', 'Gratitude']
HADITH = {'BUKHARI': ('bukhari', 'hadith_collection_bukhari'), 'MUSLIM': ('muslim', 'hadith_collection_muslim'), 'TIRMIDHI': ('tirmidhi', 'hadith_collection_tirmidhi')}


def strings(folder):
    found = {}
    for xml in sorted((RES / folder).glob('*.xml')):
        for name, value in re.findall(r'<string name="([\w.]+)"[^>]*>(.*?)</string>', xml.read_text(encoding='utf-8'), re.S):
            value = re.sub(r'<[^>]+>', '', value)
            found[name] = html.unescape(value).replace("\\'", "'").replace('\\"', '"').replace('\\n', '\n').strip()
    return found


def blocks(source, opener):
    out, i = [], 0
    while True:
        start = source.find(opener + '(', i)
        if start < 0:
            return out
        depth, j = 0, start + len(opener)
        while True:
            ch = source[j]
            if ch == '"':
                j = source.index('"', j + 1)
                while source[j - 1] == '\\':
                    j = source.index('"', j + 1)
            elif ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
                if depth == 0:
                    break
            j += 1
        out.append((start, source[start:j + 1]))
        i = j + 1


def field(block, name):
    m = re.search(r'\b' + name + r'\s*=\s*', block)
    if not m:
        return None
    rest = block[m.end():]
    if rest.startswith('"'):
        return re.match(r'"((?:[^"\\]|\\.)*)"', rest).group(1)
    return re.match(r'[^,\n)]+', rest).group(0).strip()


literals = lambda text: ''.join(re.findall(r'"((?:[^"\\]|\\.)*)"', text or '')).replace('\\"', '"') or None

# ---------------------------------------------------------------- citations
cites = {}
guide_src = (SRC / 'feature/guide/GuideCitations.kt').read_text(encoding='utf-8')
for start, block in blocks(guide_src, 'GuideSunnahRef'):
    decl = re.search(r'val\s+(\w+)\s*=\s*$', guide_src[max(0, start - 120):start])
    if decl:
        cites[decl.group(1)] = {'c': field(block, 'collection'), 'r': field(block, 'reference'), 'u': field(block, 'referenceUrl'),
                                'g': None if field(block, 'grade') in (None, 'null') else field(block, 'grade'),
                                'ok': 'NEEDS_OWNER_REVIEW' not in block}
dua_cite_src = (SRC / 'feature/duas/DuaCitations.kt').read_text(encoding='utf-8')
for start, block in blocks(dua_cite_src, 'ref'):
    decl = re.search(r'val\s+(\w+)\s*=\s*$', dua_cite_src[max(0, start - 120):start])
    if decl and 'slug' in block:
        cites['Dua.' + decl.group(1)] = {'c': field(block, 'collection'), 'r': field(block, 'reference'),
                                         'u': 'https://sunnah.com/' + field(block, 'slug'), 'g': field(block, 'grade'),
                                         'ok': 'NEEDS_OWNER_REVIEW' not in block}

# ---------------------------------------------------------------- du'as
library_src = (SRC / 'feature/duas/DuaLibrary.kt').read_text(encoding='utf-8')
duas = []
for _, block in blocks(library_src, 'Dua'):
    dua_id = field(block, 'id')
    if not dua_id or not dua_id.startswith('dua_'):
        continue
    quran = re.search(r'Quranic\(\s*GuideQuranRef\(\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(?:endAyahNumber\s*=\s*)?(\d+))?', block)
    cite = re.search(r'citation\s*=\s*(?:[\w.]*?)(GuideCitations|DuaCitations)\.(\w+)', block)
    arabic = re.search(r'arabic\s*=\s*((?:"(?:[^"\\]|\\.)*"\s*\+?\s*)+)', block)
    translit = re.search(r'transliteration\s*=\s*((?:"(?:[^"\\]|\\.)*"\s*\+?\s*)+)', block)
    key = (('Dua.' if cite.group(1) == 'DuaCitations' else '') + cite.group(2)) if cite else None
    assert key is None or key in cites, (dua_id, key)
    if 'NEEDS_OWNER_REVIEW' in block or (key and not cites[key]['ok']):
        continue
    duas.append({'id': dua_id, 'k': COLLECTIONS.index(field(block, 'collection').split('.')[-1]),
                 'title': field(block, 'titleRes').split('.')[-1],
                 'meaning': (field(block, 'meaningRes') or '').split('.')[-1] or None,
                 'occasion': (field(block, 'occasionRes') or '').split('.')[-1] or None,
                 'q': [int(quran.group(1)), int(quran.group(2)), int(quran.group(3) or quran.group(2))] if quran else None,
                 'cite': key, 'ar': literals(arabic.group(1)) if arabic else None, 'tr': literals(translit.group(1)) if translit else None})
assert len(duas) == 55, len(duas)
assert all(d['q'] or (d['ar'] and d['cite']) for d in duas), 'every du\'a needs an ayah or Arabic with a source'

# ---------------------------------------------------------------- reflections
reflections = []
for name in LIBRARY_ORDER:
    src = (SRC / f'data/reflectionlibrary/ReflectionLibrary{name}.kt').read_text(encoding='utf-8')
    for _, block in blocks(src, 'SourceLockedReflection'):
        rid = field(block, 'id')
        if not rid:
            continue
        status = field(block, 'reviewStatus')
        if status and not status.endswith('REVIEWED'):
            continue
        quran = re.search(r'ReflectionSource\.Quran\(\s*(\d+)\s*,\s*(\d+)\s*\)', block)
        hadith = re.search(r'HadithCollection\.(\w+)', block)
        entry = {'id': rid, 'title': field(block, 'titleRes').split('.')[-1], 'body': field(block, 'bodyRes').split('.')[-1],
                 'themes': [THEMES.index(t) for t in re.findall(r'ReflectionTheme\.(\w+)', block)],
                 'prophet': (field(block, 'prophet') or '').split('.')[-1] or None}
        if quran:
            entry['q'] = [int(quran.group(1)), int(quran.group(2))]
        else:
            assert hadith, rid
            number = (re.search(r'number\s*=\s*"([^"]+)"', block) or re.search(r'HadithCollection\.\w+\s*,\s*"([^"]+)"', block)).group(1)
            entry['h'] = {'c': hadith.group(1), 'n': number, 'g': re.search(r'HadithGrade\.(\w+)', block).group(1),
                          'by': (re.search(r'HadithGrader\.(\w+)', block) or [None, None])[1]}
        reflections.append(entry)

corpus = json.loads((APP / 'app/src/main/assets/quran_data.json').read_text(encoding='utf-8-sig'))
counts = [len(s['ayahs']) for s in corpus]
for d in duas:
    if d['q']:
        s, a, e = d['q']
        assert 1 <= a <= e <= counts[s - 1], d['id']
for r in reflections:
    if 'q' in r:
        assert 1 <= r['q'][1] <= counts[r['q'][0] - 1], r['id']
assert 300 <= len(reflections) <= 339, len(reflections)

PROPHETS = sorted({r['prophet'] for r in reflections if r['prophet']}, key=lambda p: [x['prophet'] for x in reflections].index(p))
report = []
for lang, folder in LANGS.items():
    S = strings(folder)
    E = strings('values') if lang != 'en' else S
    pick = lambda key: S.get(key) or E.get(key)
    out_duas = []
    for d in duas:
        c = cites[d['cite']] if d['cite'] else None
        out_duas.append({'id': d['id'], 'k': d['k'], 't': pick(d['title']), 'm': pick(d['meaning']) if d['meaning'] else None,
                         'o': pick(d['occasion']) if d['occasion'] else None, 'q': d['q'], 'ar': d['ar'], 'tr': d['tr'],
                         'src': {'c': c['c'], 'r': c['r'], 'u': c['u'], 'g': c['g']} if c else None})
        assert out_duas[-1]['t'], (lang, d['id'])
    out_refl = []
    for r in reflections:
        item = {'id': r['id'], 't': pick(r['title']), 'b': pick(r['body']), 'th': r['themes'],
                'p': PROPHETS.index(r['prophet']) if r['prophet'] else None}
        assert item['t'] and item['b'], (lang, r['id'])
        if 'q' in r:
            item['q'] = r['q']
        else:
            slug, label = HADITH[r['h']['c']]
            item['h'] = {'c': pick(label) or r['h']['c'].title(), 'n': r['h']['n'], 'u': f"https://sunnah.com/{slug}:{r['h']['n']}",
                         'g': pick('hadith_grade_' + r['h']['g'].lower()) or r['h']['g'].title(),
                         'by': pick('hadith_grader_' + r['h']['by'].lower()) if r['h']['by'] else None}
        out_refl.append(item)
    data = {'source': 'Ummahti Quran app: feature/duas and data/reflectionlibrary (published entries only)',
            'collections': [pick('dua_collection_' + c) for c in COLLECTION_LABELS], 'duas': out_duas,
            'prophets': PROPHETS, 'reflections': out_refl}
    assert all(data['collections']), lang
    (ROOT / f'media/v15/library-{lang}.js').write_text('window.UMMAHTI_LIBRARY=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    report.append(lang)
quranic = sum(1 for d in duas if d['q'] and not d['ar'])
print(f"Library from the app ({', '.join(report)}): {len(duas)} du'as ({quranic} Quranic, {len(duas) - quranic} Prophetic), "
      f"{len(reflections)} reflections ({sum('q' in r for r in reflections)} on an ayah, {sum('h' in r for r in reflections)} on a narration), "
      f"{len(PROPHETS)} prophets named")
