#!/usr/bin/env python3
"""Point the English pages at their translations, and list everything in the
sitemap.

hreflang has to be reciprocal or it is ignored: the English page must name
the translations exactly as the translations name it. build.py writes one
half of that; this writes the other, and regenerates the sitemap so every
language of every route is listed once.

  python3 tools/i18n/wire_english.py
"""
import io, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from build import LANGS, PAGES, SITE, hreflang_block  # noqa: E402

BEGIN = '<!-- hreflang: written by tools/i18n/wire_english.py -->'
END = '<!-- /hreflang -->'


def main():
    for src_rel, route in PAGES:
        p = os.path.join(ROOT, src_rel)
        s = io.open(p, encoding='utf-8').read()
        block = f'{BEGIN}\n{hreflang_block(route)}\n{END}'

        if BEGIN in s:
            s = re.sub(re.escape(BEGIN) + r'.*?' + re.escape(END), block, s, flags=re.S)
        else:
            m = re.search(r'<link rel="canonical" href="[^"]*">', s)
            assert m, f'{src_rel}: no canonical to anchor to'
            s = s[:m.end()] + '\n' + block + s[m.end():]

        io.open(p, 'w', encoding='utf-8').write(s)
        print(f'{src_rel:<22} alternates written')

    rows = []
    for _, route in PAGES:
        tail = f'/{route}' if route else '/'
        rows.append(f'  <url><loc>{SITE}{tail}</loc></url>')
        for code in LANGS:
            rows.append(f'  <url><loc>{SITE}/{code}{"/" + route if route else "/"}</loc></url>')

    io.open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8').write(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + '\n'.join(rows) + '\n</urlset>\n')
    print(f'sitemap.xml            {len(rows)} URLs')


if __name__ == '__main__':
    main()
