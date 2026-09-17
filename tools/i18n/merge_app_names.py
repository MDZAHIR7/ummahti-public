#!/usr/bin/env python3
"""Fold the app's own localised names into a translation table.

Reciter names are not site copy and must not be transliterated here by hand:
the app already holds all thirty-nine in Arabic and Urdu, and a reader who
sees "ماهر المعيقلي" in the app should see the same string on the site.
Indonesian keeps the Latin forms, which is what the app does too.

  python3 tools/i18n/merge_app_names.py ../UmmahtiQuran
"""
import glob, html, io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
FOLDER = {'ar': 'values-ar', 'ur': 'values-ur', 'id': 'values-in'}


def strip_style(name):
    """"Mahmoud Khalil Al-Hussary (Mujawwad)" -> the name on its own."""
    return re.sub(r'\s*\([^)]*\)\s*$', '', name).strip()


def reciters(android_root, folder):
    out = {}
    for f in glob.glob(os.path.join(android_root, 'app/src/main/res', folder, 'strings*.xml')):
        s = io.open(f, encoding='utf-8').read()
        for k, v in re.findall(r'<string name="(reciter_[^"]+)"[^>]*>(.*?)</string>', s, re.S):
            out[k] = html.unescape(v).replace("\\'", "'").strip()
    return out


def main(android_root):
    en = reciters(android_root, 'values')
    for lang, folder in FOLDER.items():
        loc = reciters(android_root, folder)
        names = {en[k]: loc[k] for k in en if k in loc and loc[k] != en[k]}

        # The site sets the name and the recitation style in two elements,
        # so it needs the bare name as well as the app's combined string.
        # Only when every variant of a name agrees on it: two readings by one
        # reciter must not disagree about how he is called.
        bare = {}
        for e, l in names.items():
            be, bl = strip_style(e), strip_style(l)
            if be != e:
                bare.setdefault(be, set()).add(bl)
        for be, options in bare.items():
            if len(options) == 1 and be not in names:
                names[be] = options.pop()

        path = os.path.join(HERE, f'{lang}.json')
        table = json.load(io.open(path, encoding='utf-8')) if os.path.exists(path) else {}
        added = sum(1 for k in names if k not in table)
        # Authored entries win: a name deliberately overridden in the table
        # stays overridden.
        table = {**names, **table}
        io.open(path, 'w', encoding='utf-8').write(
            json.dumps(table, ensure_ascii=False, indent=1, sort_keys=True) + '\n')
        print(f'{lang}.json  {len(table)} entries ({added} app names added)')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', '..', 'UmmahtiQuran'))
