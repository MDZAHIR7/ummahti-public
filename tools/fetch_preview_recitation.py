"""Cache the exact displayed preview ayahs from the app's named editions.

Run locally, never in a visitor's browser. --check verifies the manifest and
every SHA-256 without making requests. No Quran text or recordings are edited.
Provider permission: https://alquran.cloud/terms-and-conditions (checked
2026-10-23), section IV, free non-commercial educational redistribution.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import argparse
import hashlib
import json
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'media/recitation/preview'
EDITIONS = {'alafasy': 'ar.alafasy', 'husary': 'ar.husary'}
SURAH_COUNTS = {1: 7, 93: 11, 94: 8}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    moon_source = (ROOT / 'media/v15/moon-data.js').read_text(encoding='utf-8')
    counts = json.loads(moon_source[moon_source.index('{'):moon_source.rindex('}') + 1])['counts']
    expected = []
    for voice, edition in EDITIONS.items():
        for surah, count in SURAH_COUNTS.items():
            assert counts[surah - 1] == count
            for ayah in range(1, count + 1):
                number = sum(counts[:surah - 1]) + ayah
                expected.append({'voice': voice, 'edition': edition, 'surah': surah,
                                 'ayah': ayah, 'globalAyah': number,
                                 'path': f'{voice}/{surah:03d}-{ayah:03d}.mp3',
                                 'source': f'https://cdn.islamic.network/quran/audio/128/{edition}/{number}.mp3'})
    manifest_path = OUT / 'manifest.json'
    if args.check:
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        assert len(manifest['clips']) == len(expected)
        for clip, wanted in zip(manifest['clips'], expected):
            assert all(clip[key] == value for key, value in wanted.items()), wanted
            data = (OUT / clip['path']).read_bytes()
            assert len(data) == clip['bytes'] and hashlib.sha256(data).hexdigest() == clip['sha256'], clip['path']
        print(f'PASS: {len(expected)} displayed-ayah clips, coordinates and digests')
        return

    def fetch(item):
        path = OUT / item['path']
        if path.exists():
            data = path.read_bytes()
        else:
            request = urllib.request.Request(item['source'], headers={'User-Agent': 'Ummahti-preview/1.0 (+https://ummahtiofficial.com/)'})
            with urllib.request.urlopen(request, timeout=40) as response:
                assert response.headers.get_content_type() in ('audio/mpeg', 'application/octet-stream')
                data = response.read()
            assert len(data) > 1000 and (data[:3] == b'ID3' or data[0] == 255), item
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        return {**item, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

    with ThreadPoolExecutor(max_workers=4) as pool:
        clips = list(pool.map(fetch, expected))
    manifest_path.write_text(json.dumps({'provider': 'AlQuran Cloud / Islamic Network',
        'rights': 'Free non-commercial educational use; copyrights remain with the reciters.',
        'terms': 'https://alquran.cloud/terms-and-conditions', 'verified': '2026-10-23',
        'clips': clips}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Cached {len(clips)} unmodified clips ({sum(c["bytes"] for c in clips):,} bytes).')


if __name__ == '__main__':
    main()
