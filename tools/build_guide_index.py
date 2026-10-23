"""Build an on-demand local Guide index from the unchanged website Quran corpus.

Schema: rows[global zero-based ayah] = [surah, ayah, Saheeh International];
terms[normalised English/Arabic token] = sorted zero-based row ids. Arabic is
not duplicated: the source controller loads the original per-surah script.
No requests, Android writes, new translations or query logging.
"""
from collections import defaultdict
from pathlib import Path
import hashlib
import json
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[1]


def normalize(value):
    text = ''.join(c for c in unicodedata.normalize('NFKD', value.lower())
                   if not unicodedata.category(c).startswith('M'))
    text = text.translate(str.maketrans('ٱأإآىیک', 'ااااييك')).replace("'", '').replace('’', '')
    tokens = re.findall(r'[^\W_]+', text, re.UNICODE)
    return [w[2:] if re.fullmatch(r'ال[\u0621-\u06ff]{3,}', w) else w for w in tokens]


def build():
    rows, terms, digests = [], defaultdict(list), {}
    for s in range(1, 115):
        path = ROOT / f'media/v15/quran/s{s:03}.js'
        source = path.read_text(encoding='utf-8')
        ayat = json.loads(source[source.index(']=') + 2:].rstrip().rstrip(';'))
        digests[str(s)] = hashlib.sha256(path.read_bytes()).hexdigest()
        for a, (arabic, english) in enumerate(ayat, 1):
            row = len(rows)
            rows.append([s, a, english])
            for word in set(normalize(arabic) + normalize(english)):
                terms[word].append(row)
    assert len(rows) == 6236
    data = {'version': 1, 'translation': 'Saheeh International', 'rows': rows,
            'terms': dict(sorted(terms.items())), 'corpusSha256': digests}
    target = ROOT / 'media/v15/guide-index.js'
    content = 'window.UMMAHTI_GUIDE_INDEX=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
    target.write_text(content, encoding='utf-8', newline='\n')
    print(f'Guide index: {len(rows)} ayahs, {len(terms)} terms, {len(content.encode("utf-8")):,} bytes; loaded only when a broad search needs it.')


if __name__ == '__main__':
    build()
