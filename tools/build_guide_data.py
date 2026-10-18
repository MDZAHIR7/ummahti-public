"""Build the website's Guide map from the app's own Guide catalogue. Reads the app tree only.

Source: UmmahtiQuran2 feature/guide/GuideCatalog.kt and GuideCitations.kt, with the app's own
string resources in English, Arabic, Urdu and Indonesian. Only REVIEWED topics and narrations are
published on the website; anything marked NEEDS_OWNER_REVIEW stays in the app. Narrations are shown
as the app shows them: Ummahti's own summary, with collection, reference, grade and link.

Writes media/v15/guide-{en,ar,ur,id}.js (one file per language, loaded only by that page).
"""
from pathlib import Path
import html, json, re, sys

ROOT = Path(__file__).resolve().parents[1]
APP = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r'C:\Users\1zahi\AndroidStudioProjects\UmmahtiQuran2')
GUIDE = APP / 'app/src/main/java/com/ummahti/quran/feature/guide'
RES = APP / 'app/src/main/res'
LANGS = {'en': 'values', 'ar': 'values-ar', 'ur': 'values-ur', 'id': 'values-in'}
CATEGORIES = ['WORSHIP_AND_PRAYER', 'THE_QURAN', 'HEART_AND_EMOTIONS', 'TRIALS_AND_PATIENCE', 'FAITH_AND_REPENTANCE',
              'FAMILY_AND_RELATIONSHIPS', 'WORK_STUDY_AND_PROVISION', 'LIFE_AND_DECISIONS', 'DREAMS_AND_SIGNS', 'DAILY_LIFE_AND_REMEMBRANCE']


def strings(folder):
    found = {}
    for xml in sorted((RES / folder).glob('*.xml')):
        for name, value in re.findall(r'<string name="([\w.]+)"[^>]*>(.*?)</string>', xml.read_text(encoding='utf-8'), re.S):
            value = re.sub(r'<[^>]+>', '', value)
            found[name] = html.unescape(value).replace("\\'", "'").replace('\\"', '"').replace('\\n', '\n').strip()
    return found


def blocks(source, opener):
    """Each balanced `opener(...)` call, with the text before it on the same declaration."""
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
    if rest.startswith('listOf('):
        depth = 0
        for k, ch in enumerate(rest):
            depth += ch == '('
            depth -= ch == ')'
            if ch == ')' and depth == 0:
                return rest[:k + 1]
    return re.match(r'[^,\n)]+', rest).group(0).strip()


# Narration records, by their Kotlin property name.
citations_src = (GUIDE / 'GuideCitations.kt').read_text(encoding='utf-8')
cites = {}
for start, block in blocks(citations_src, 'GuideSunnahRef'):
    decl = re.search(r'val\s+(\w+)\s*=\s*$', citations_src[max(0, start - 120):start])
    if not decl:
        continue
    cites[decl.group(1)] = {
        'id': field(block, 'id'), 'collection': field(block, 'collection'), 'reference': field(block, 'reference'),
        'url': field(block, 'referenceUrl'), 'grade': None if field(block, 'grade') in (None, 'null') else field(block, 'grade'),
        'narrator': None if field(block, 'narrator') in (None, 'null') else field(block, 'narrator'),
        'summary': field(block, 'summaryRes').split('.')[-1],
        'reviewed': 'NEEDS_OWNER_REVIEW' not in block,
    }

catalog_src = (GUIDE / 'GuideCatalog.kt').read_text(encoding='utf-8')
topics = []
for _, block in blocks(catalog_src, 'GuideTopic'):
    if 'id =' not in block:
        continue
    quran = [(int(s), int(a), int(e) if e else int(a)) for s, a, e in
             re.findall(r'GuideQuranRef\(\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(?:endAyahNumber\s*=\s*)?(\d+))?', field(block, 'quranRefs') or '')]
    sunnah = re.findall(r'GuideCitations\.(\w+)', field(block, 'sunnahRefs') or '')
    topics.append({
        'id': field(block, 'id'), 'category': field(block, 'category').split('.')[-1],
        'title': field(block, 'titleRes').split('.')[-1], 'summary': field(block, 'shortSummaryRes').split('.')[-1],
        'editorial': field(block, 'editorialRes').split('.')[-1],
        'actions': re.findall(r'R\.string\.(\w+)', field(block, 'practicalActionRes') or ''),
        'followUp': re.findall(r'"(\w+)"', field(block, 'followUpTopicIds') or ''),
        'duas': re.findall(r'"(\w+)"', field(block, 'duaIds') or ''),
        'quran': quran, 'sunnah': sunnah, 'reviewed': 'NEEDS_OWNER_REVIEW' not in block,
        'medical': 'medicalCareReminder = true' in block,
        'aliases': re.findall(r'"((?:[^"\\]|\\.)*)"', field(block, 'aliases') or ''),
    })

# The du'a library: Quranic du'as point at their ayat; Prophetic du'as carry the Arabic as the app
# prints it and a cited narration. Published as the app publishes them: reviewed entries only.
DUAS = APP / 'app/src/main/java/com/ummahti/quran/feature/duas'
dua_cites_src = (DUAS / 'DuaCitations.kt').read_text(encoding='utf-8')
for start, block in blocks(dua_cites_src, 'ref'):
    decl = re.search(r'val\s+(\w+)\s*=\s*$', dua_cites_src[max(0, start - 120):start])
    if not decl or 'slug' not in block:
        continue
    cites['Dua.' + decl.group(1)] = {
        'id': field(block, 'id'), 'collection': field(block, 'collection'), 'reference': field(block, 'reference'),
        'url': 'https://sunnah.com/' + field(block, 'slug'), 'grade': field(block, 'grade'), 'narrator': field(block, 'narrator'),
        'summary': field(block, 'summaryRes').split('.')[-1], 'reviewed': 'NEEDS_OWNER_REVIEW' not in block,
    }
literals = lambda text: ''.join(re.findall(r'"((?:[^"\\]|\\.)*)"', text or '')).replace('\\"', '"') or None
library_src = (DUAS / 'DuaLibrary.kt').read_text(encoding='utf-8')
duas = {}
for _, block in blocks(library_src, 'Dua'):
    dua_id = field(block, 'id')
    if not dua_id or not dua_id.startswith('dua_'):
        continue
    quran = re.search(r'Quranic\(\s*GuideQuranRef\(\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(?:endAyahNumber\s*=\s*)?(\d+))?', block)
    cite = re.search(r'citation\s*=\s*(?:[\w.]*?)(GuideCitations|DuaCitations)\.(\w+)', block)
    arabic = re.search(r'arabic\s*=\s*((?:"(?:[^"\\]|\\.)*"\s*\+?\s*)+)', block)
    translit = re.search(r'transliteration\s*=\s*((?:"(?:[^"\\]|\\.)*"\s*\+?\s*)+)', block)
    cite_key = None
    if cite:
        cite_key = ('Dua.' if cite.group(1) == 'DuaCitations' else '') + cite.group(2)
        assert cite_key in cites, (dua_id, cite_key)
    duas[dua_id] = {
        'title': field(block, 'titleRes').split('.')[-1],
        'meaning': (field(block, 'meaningRes') or '').split('.')[-1] or None,
        'occasion': (field(block, 'occasionRes') or '').split('.')[-1] or None,
        'quran': (int(quran.group(1)), int(quran.group(2)), int(quran.group(3) or quran.group(2))) if quran else None,
        'cite': cite_key, 'arabic': literals(arabic.group(1)) if arabic else None,
        'translit': literals(translit.group(1)) if translit else None,
        'reviewed': 'NEEDS_OWNER_REVIEW' not in block and (cite_key is None or cites[cite_key]['reviewed']),
    }
assert len(duas) >= 50, len(duas)
for t in topics:
    pass

assert len(topics) == 86, len(topics)
assert all(t['category'] in CATEGORIES for t in topics)
missing = {name for t in topics for name in t['sunnah'] if name not in cites}
assert not missing, missing

# Quran references must exist in the app corpus.
corpus = json.loads((APP / 'app/src/main/assets/quran_data.json').read_text(encoding='utf-8-sig'))
counts = [len(s['ayahs']) for s in corpus]
for t in topics:
    for s, a, e in t['quran']:
        assert 1 <= s <= 114 and 1 <= a <= e <= counts[s - 1], (t['id'], s, a, e)

published = [t for t in topics if t['reviewed']]
ids = {t['id'] for t in published}
used = []
for lang, folder in LANGS.items():
    S = strings(folder)
    E = strings('values') if lang != 'en' else S
    pick = lambda key: S.get(key) or E.get(key)
    cite_index, cite_list = {}, []
    dua_index, dua_list = {}, []
    def dua_ref(dua_id):
        d = duas.get(dua_id)
        if not d or not d['reviewed'] or not pick(d['title']):
            return None
        if dua_id not in dua_index:
            src = None
            if d['cite']:
                c = cites[d['cite']]
                src = {'c': c['collection'], 'r': c['reference'], 'u': c['url'], 'g': c['grade']}
            dua_index[dua_id] = len(dua_list)
            dua_list.append({'t': pick(d['title']), 'm': pick(d['meaning']) if d['meaning'] else None, 'o': pick(d['occasion']) if d['occasion'] else None,
                             'q': d['quran'], 'ar': d['arabic'], 'tr': d['translit'], 'src': src})
        return dua_index[dua_id]
    out_topics = []
    for t in published:
        refs = []
        for name in t['sunnah']:
            c = cites[name]
            if not c['reviewed']:
                continue
            if name not in cite_index:
                cite_index[name] = len(cite_list)
                cite_list.append({'c': c['collection'], 'r': c['reference'], 'u': c['url'], 'g': c['grade'], 'n': c['narrator'],
                                  's': pick(c['summary']), 'l': lang if S.get(c['summary']) else 'en'})
            if cite_index[name] not in refs:  # the app's catalogue lists some narrations twice in one topic
                refs.append(cite_index[name])
        out_topics.append({'id': t['id'], 'k': CATEGORIES.index(t['category']), 't': pick(t['title']), 's': pick(t['summary']),
                           'e': pick(t['editorial']), 'a': [pick(a) for a in t['actions'] if pick(a)],
                           'q': t['quran'], 'h': refs, 'f': [f for f in t['followUp'] if f in ids], 'm': t['medical'], 'w': t['aliases'], 'd': [k for k in (dua_ref(x) for x in t['duas']) if k is not None],
                           'l': lang if S.get(t['title']) else 'en'})
        assert out_topics[-1]['t'] and out_topics[-1]['s'], (lang, t['id'])
    labels = [pick('guide_category_' + c.lower()) for c in CATEGORIES]
    assert all(labels), (lang, labels)
    data = {'source': 'Ummahti Quran app: feature/guide GuideCatalog.kt and GuideCitations.kt (reviewed entries only)',
            'categories': labels, 'topics': out_topics, 'cites': cite_list, 'duas': dua_list, 'medical': pick('guide_medical_care_reminder'),
            'counts': {'topics': len(out_topics), 'quran': sum(len(t['q']) for t in out_topics), 'narrations': len(cite_list)}}
    (ROOT / f'media/v15/guide-{lang}.js').write_text('window.UMMAHTI_GUIDE=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    used.append(f'{lang}: {len(out_topics)} topics, {len(cite_list)} narrations, {len(dua_list)} duas')
print('Guide map from the app:', '; '.join(used))
print('Held back (needs owner review):', len(topics) - len(published), 'topics,', sum(1 for c in cites.values() if not c['reviewed']), 'narration records')
