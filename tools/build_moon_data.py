"""Build the Moon of 6,236 data from the app's own files. Reads the app tree only.

Writes:
  media/v15/moon-data.js   surahs, verse counts, juz of every verse, 6,236 point positions
  media/v15/moon-1600.webp the approved transparent moon master, sized for the web
  media/v15/moon-800.webp

Every point is one verse, in mushaf order. Each point sits on the gold filigree of the
approved crescent master, ordered from the upper tip, around the back, to the lower tip.
"""
from pathlib import Path
import json, math, random, sys
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
APP = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r'C:\Users\1zahi\AndroidStudioProjects\UmmahtiQuran2')
QURAN = APP / 'app/src/main/assets/quran_data.json'
MOON = APP / 'release/new-logo/6 DO NOT UPLOAD - extras/source/moon_master_2560.png'
OUT = ROOT / 'media/v15'

surahs = json.loads(QURAN.read_text(encoding='utf-8-sig'))
assert len(surahs) == 114, len(surahs)
names, arabic, counts, juz, medinan, texts = [], [], [], [], [], []
for index, surah in enumerate(surahs, 1):
    assert int(surah['number']) == index
    ayahs = surah['ayahs']
    for n, ayah in enumerate(ayahs, 1):
        assert int(ayah['ayahNumber']) == n
        juz.append(int(ayah['juzNumber']))
    names.append(surah['nameTransliteration'])
    arabic.append(surah['nameArabic'].replace('﻿', '').strip())
    counts.append(len(ayahs))
    medinan.append('1' if surah['revelationType'].strip().lower() == 'medinan' else '0')
    texts.append([[a['textUthmani'].replace('﻿', '').strip(), a['translation'].replace('﻿', '').strip()] for a in ayahs])
total = sum(counts)
assert total == 6236, total
assert juz[0] == 1 and juz[-1] == 30 and all(b - a in (0, 1) for a, b in zip(juz, juz[1:])), 'juz must run 1..30 in order'
juz_sizes = [juz.count(j) for j in range(1, 31)]

# The approved moon master: gold filigree on transparency.
master = Image.open(MOON).convert('RGBA')
assert master.size == (2560, 2560)
small = np.asarray(master.resize((1024, 1024), Image.LANCZOS)).astype(float)
alpha = small[..., 3]
ys, xs = np.nonzero(alpha > 150)
weights = alpha[ys, xs]
rng = random.Random(6236)
candidates = list(zip(xs.tolist(), ys.tolist(), weights.tolist()))
rng.shuffle(candidates)
# Spread the points along the lines: keep a candidate only if it is not on top of another.
grid, chosen, spacing = {}, [], 3.2
for limit in (spacing, 2.4, 1.7, 1.2, 0.0):
    for x, y, w in candidates:
        if len(chosen) == total: break
        cell = (int(x // 4), int(y // 4))
        near = [p for dx in (-1, 0, 1) for dy in (-1, 0, 1) for p in grid.get((cell[0] + dx, cell[1] + dy), [])]
        if any((px - x) ** 2 + (py - y) ** 2 < limit * limit for px, py in near): continue
        grid.setdefault(cell, []).append((x, y)); chosen.append((x, y))
    if len(chosen) == total: break
assert len(chosen) == total, len(chosen)

# Verse order flows along the crescent: angle around the moon's disc centre, from the upper tip
# anticlockwise through the back of the crescent to the lower tip.
cx, cy = float(xs.mean()), float(ys.mean())
cx = (xs.min() + xs.max()) / 2 + 40  # the crescent's disc centre sits right of its ink
def order(point):
    angle = math.atan2(point[1] - cy, point[0] - cx)  # screen space, y down
    return (-angle - math.radians(40)) % (2 * math.pi)  # start just past the upper tip
chosen.sort(key=order)
points = [round(v / 1024 * 4095) for x, y in chosen for v in (x, y)]

# The corpus prefixes the Bismillah to ayah 1 of every surah after Al-Fatiha. It is not part of those
# ayat: show it as the surah's opening line instead (At-Tawbah has none). Al-Fatiha 1:1 is the Bismillah.
BASMALA = texts[0][0][0]
opened = []
for number, ayat in enumerate(texts, 1):
    # 95 and 97 carry a shadda on the first letter (بِّسْمِ) in this corpus; same Bismillah.
    text = ayat[0][0]
    if text[:4].count('ّ'):
        text = text[:4].replace('ّ', '', 1) + text[4:]
    if number > 1 and text.startswith(BASMALA):
        ayat[0][0] = text[len(BASMALA):].strip()
        opened.append(number)
assert len(opened) == 112 and 1 not in opened and 9 not in opened and all(texts[n - 1][0][0] for n in opened)
print('Bismillah separated from ayah 1 in', len(opened), 'surahs')
# Lights in orbit: the Quran on the moon, and the narrations behind the name Ummahti.
# Ayat come from the corpus above; narrations are the app's own sourced records and wording
# (feature/guide/GuideCitations.kt, feature/about/UmmahtiNameStory.kt, feature/notify/ReligiousSources.kt).
import re, html as _html
def app_string(name, lang):
    folder = {'en': 'values', 'ar': 'values-ar', 'ur': 'values-ur', 'id': 'values-in'}[lang]
    for xml in sorted((APP / 'app/src/main/res' / folder).glob('*.xml')):
        m = re.search(r'<string name="' + name + r'"[^>]*>(.*?)</string>', xml.read_text(encoding='utf-8'), re.S)
        if m:
            return _html.unescape(m.group(1)).replace("\\'", "'").replace('\\"', '"').strip()
    return None
def index_of(s, a):
    return sum(counts[:s - 1]) + a - 1
MOON_AYAT = [(36, 40), (36, 39), (10, 5), (2, 189), (54, 1), (71, 16), (25, 61), (91, 2), (84, 18), (6, 77), (12, 4)]
lights = [{'kind': 'ayah', 'i': index_of(s, a)} for s, a in MOON_AYAT]
for id_, coll, ref, url, res in [
        ('ummah_supplication', 'Sahih Muslim', '202', 'https://sunnah.com/muslim:202', 'guide_sunnah_ummah_supplication_summary'),
        ('reserved_supplication', 'Sahih Muslim', '199a', 'https://sunnah.com/muslim:199a', 'why_ummahti_muslim_meaning'),
        ('corroboration', 'Sahih al-Bukhari', '6304', 'https://sunnah.com/bukhari:6304', 'why_ummahti_bukhari_meaning')]:
    text = {lang: app_string(res, lang) for lang in ('en', 'ar', 'ur', 'id')}
    assert text['en'], res
    lights.append({'kind': 'hadith', 'id': id_, 'collection': coll, 'reference': ref, 'url': url, 'grade': 'Sahih', 'text': {k: v for k, v in text.items() if v}})
sources = (APP / 'app/src/main/java/com/ummahti/quran/feature/notify/ReligiousSources.kt').read_text(encoding='utf-8')
for key, url in [('ramadan_sighting', 'https://sunnah.com/muslim:1081b'), ('local_sighting_difference', 'https://sunnah.com/muslim:1087')]:
    block = re.search(r'"' + key + r'" to HadithSource\((.*?)\n    \)', sources, re.S).group(1)
    field = lambda f: re.search(f + r' = (.*?)(?:,\n|$)', block, re.S).group(1)
    rule = ''.join(re.findall(r'"((?:[^"\\]|\\.)*)"', field('derivedRule')))
    # The website shows the narration's substance only; the app's own setting notes stay in the app.
    rule = rule.split(', which')[0].rstrip('.') + '.'
    lights.append({'kind': 'hadith', 'id': key, 'collection': re.search(r'"(.*?)"', field('collection')).group(1),
                   'reference': re.search(r'"(.*?)"', field('reference')).group(1), 'url': url,
                   'grade': re.search(r'"(.*?)"', field('grading')).group(1), 'text': {'en': rule}, 'summary': True})
hero = {'ref': [36, 40], 'arabic': texts[35][39][0], 'translation': texts[35][39][1], 'name': names[35]}
data = {'source': 'Ummahti Quran app assets: quran_data.json (Hafs, Kufan count) and the approved moon master',
        'total': total, 'names': names, 'namesArabic': arabic, 'counts': counts, 'medinan': ''.join(medinan), 'basmala': BASMALA, 'lights': lights, 'heroAyah': hero, 'juzSizes': juz_sizes,
        'juz': ''.join(chr(64 + j) if j <= 26 else chr(96 + j - 26) for j in juz),
        'points': points}
(OUT / 'moon-data.js').write_text('window.UMMAHTI_MOON=' + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + ';\n', encoding='utf-8')
# Each surah's ayat, loaded only when a reader opens one of its verses (Uthmani text, Saheeh International).
verses_dir = OUT / 'quran'
verses_dir.mkdir(exist_ok=True)
for number, ayat in enumerate(texts, 1):
    (verses_dir / f's{number:03}.js').write_text('(window.UMMAHTI_AYAT=window.UMMAHTI_AYAT||{})[' + str(number) + ']=' + json.dumps(ayat, separators=(',', ':'), ensure_ascii=False) + ';\n', encoding='utf-8')
assert sum(len(a) for a in texts) == 6236
for size in (1600, 800):
    master.resize((size, size), Image.LANCZOS).save(OUT / f'moon-{size}.webp', 'WEBP', quality=90, method=6)
print(f'{total} verses · 114 surahs · juz sizes {min(juz_sizes)}–{max(juz_sizes)} · wrote moon-data.js and moon webp')
print('juz sizes', juz_sizes)
