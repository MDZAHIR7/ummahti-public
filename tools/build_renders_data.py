"""Counted data for the Recite to add illustration. No dependencies, no network.

Reads the site's own per-surah corpus (media/v15/quran/s001-s114.js, Hafs, Kufan
count, the same text the moon reader shows) and writes media/v15/renders-data.js:

* narrow: for Al-Anbiya 21:92, after hearing its first k words, which ayahs of
  the 6,236 still contain those k words in that order. Words are compared
  without vowel marks, with the alif forms and ta marbuta folded, and with a
  leading wa/fa conjunction ignored, so 23:52 (wa-inna hadhihi ...) is the
  near twin it really is. This is the website's illustration of why hearing
  more words narrows the search; it is not the app's recogniser.
"""
from pathlib import Path
import json, re

ROOT = Path(__file__).resolve().parents[1]
AYAT = {}
for f in sorted((ROOT / 'media/v15/quran').glob('s*.js')):
    text = f.read_text(encoding='utf-8')
    n = int(re.search(r'\[(\d+)\]=', text)[1])
    AYAT[n] = json.loads(text[text.index(']=') + 2:].rstrip().rstrip(';'))
assert len(AYAT) == 114 and sum(len(v) for v in AYAT.values()) == 6236

MARKS = '[ؐ-ًؚ-ٰٟۖ-ۭـ]'
def words(ayah):
    s = re.sub(MARKS, '', ayah)
    for a, b in [('ٱ', 'ا'), ('أ', 'ا'), ('إ', 'ا'), ('آ', 'ا'), ('ى', 'ي'), ('ة', 'ه')]:
        s = s.replace(a, b)
    return re.sub(r'[^ء-ي ]', '', s).split()

def same(a, b):
    return a == b or (a[:1] in 'وف' and a[1:] == b) or (b[:1] in 'وف' and b[1:] == a)

order = [(s, i) for s in range(1, 115) for i in range(len(AYAT[s]))]
target_text = AYAT[21][91][0]
target = words(target_text)
display = target_text.split()
assert len(display) == len(target) == 8

steps = []
for k in range(1, len(target) + 1):
    hits = []
    for g, (s, i) in enumerate(order):
        w = words(AYAT[s][i][0])
        if any(all(same(w[j + m], target[m]) for m in range(k)) for j in range(len(w) - k + 1)):
            hits.append(g)
    steps.append(hits)
counts = [len(h) for h in steps]
assert counts[-1] == 1 and order[steps[-1][0]] == (21, 91), counts
twin = order.index((23, 51))
assert twin in steps[-2] and twin not in steps[-1]

data = {
    'source': 'media/v15/quran (Hafs, Kufan count); counted by tools/build_renders_data.py',
    'ayah': {'ref': '21:92', 'surah': 21, 'n': 92, 'arabic': target_text, 'words': display,
             'translation': AYAT[21][91][1]},
    'twin': {'ref': '23:52', 'surah': 23, 'n': 52, 'arabic': AYAT[23][51][0], 'translation': AYAT[23][51][1]},
    'narrow': steps,
    'say': {'surah': 67, 'from': 1, 'to': 10, 'first': AYAT[67][0][0], 'last': AYAT[67][9][0]},
}
# The hero ayah changes with each visit: short, whole ayat about the Ummah, nearness and
# hope. Each keeps its exact corpus text; only the emphasis is chosen here.
HERO = [  # (surah, ayah, Arabic words to emphasise [start, end), English phrase)
    (21, 92, (2, 5), 'your religion, is one religion'),
    (49, 10, (0, 3), 'The believers are but brothers'),
    (3, 139, (4, 6), 'you will be superior'),
    (2, 186, (4, 6), 'indeed I am near'),
    (13, 28, (-5, None), 'by the remembrance of Allah hearts are assured'),
    (17, 9, (0, 7), "this Qur'an guides to that which is most suitable"),
    (39, 53, (7, 12), 'do not despair of the mercy of Allah'),
    (36, 40, (-4, None), 'each, in an orbit, is swimming'),
]
hero = []
for s, a, (w0, w1), en_mark in HERO:
    ar, en = AYAT[s][a - 1]
    w = ar.split(' ')
    i0 = w0 % len(w); i1 = len(w) if w1 is None else w1
    assert en_mark in en, (s, a)
    j = en.index(en_mark)
    hero.append({'s': s, 'a': a, 'ar': [' '.join(w[:i0]), ' '.join(w[i0:i1]), ' '.join(w[i1:])],
                 'en': [en[:j], en_mark, en[j + len(en_mark):]]})
data['hero'] = hero

out = ROOT / 'media/v15/renders-data.js'
out.write_text('window.UMMAHTI_RENDERS=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8', newline='\n')
print('narrowing', counts, '->', out.relative_to(ROOT))
