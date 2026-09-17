#!/usr/bin/env python3
"""Report any English left standing on a built page.

The failure this exists to catch is silent: a segment that did not match is
not an error, it is a sentence that quietly stays in English on a page a
reader was told is in their language. So the built pages are read back and
compared against the table that made them.

  python3 tools/i18n/check_pages.py
"""
import io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))

sys.path.insert(0, HERE)
from extract import segments  # noqa: E402
from build import LANGS, PAGES  # noqa: E402

# Text that is correct to leave in Latin script: typeface names, the
# transliteration of the one verse, and brand names.
KEEP = {
    'Amiri Regular', 'Scheherazade New', 'Noto Naskh Arabic', 'Gulzar',
    'Cinzel', 'Plus Jakarta Sans', 'Google Play', 'YouTube', 'Instagram',
    'WhatsApp', 'Kotlin', 'Jetpack Compose', 'Android',
}


# The @type values this site actually publishes. A localised page that has
# had one translated is broken structured data, which is exactly the failure
# that reached a built page once: "FAQ" is a nav label as well as the opening
# of "FAQPage", so the segment pass rewrote the type.
VALID_TYPES = {'SoftwareApplication', 'FAQPage', 'Organization', 'WebSite', 'Question', 'Answer', 'Offer'}


def schema_problems(markup, path):
    out = []
    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', markup, re.S):
        try:
            data = json.loads(block)
        except ValueError as e:
            out.append(f'{path}: ld+json does not parse ({e})')
            continue
        if data.get('@type') not in VALID_TYPES:
            out.append(f'{path}: ld+json @type is {data.get("@type")!r}')
        if data.get('@context') != 'https://schema.org':
            out.append(f'{path}: ld+json @context is {data.get("@context")!r}')
    return out


def main():
    bad = 0
    for lang in LANGS:
        table_path = os.path.join(HERE, f'{lang}.json')
        if not os.path.exists(table_path):
            continue
        table = json.load(io.open(table_path, encoding='utf-8'))
        print(f'--- {lang} ---')
        for _, route in PAGES:
            built = os.path.join(ROOT, lang, route, 'index.html') if route \
                else os.path.join(ROOT, lang, 'index.html')
            if not os.path.exists(built):
                continue
            here = segments(io.open(built, encoding='utf-8').read())
            # Anything still matching an English key had a translation and
            # did not get it.
            markup = io.open(built, encoding='utf-8').read()
            for problem in schema_problems(markup, f'/{lang}/{route}'):
                print('  ' + problem)
                bad += 1

            leaked = [s for s in here
                      if s in table and table[s] != s and s not in KEEP]
            if leaked:
                bad += len(leaked)
                print(f'  /{lang}/{route or ""}: {len(leaked)} segment(s) still English')
                for s in leaked[:6]:
                    print(f'      {s[:88]}')
            else:
                print(f'  /{lang}/{route or "":<11} clean')
    print('\nno English left where a translation exists' if not bad
          else f'\n{bad} untranslated segment(s) on built pages')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
