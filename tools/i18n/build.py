#!/usr/bin/env python3
"""Write the localised pages from the English ones plus a translation file.

The site has no build step and should not grow one: what this produces is
committed static HTML, exactly like everything else in the repository, and
deploying stays "push the files". This exists so that a correction to a
translation is made once, in tools/i18n/<lang>.json, and can be put back
through every page that carries that sentence — rather than being hunted
through six hand-maintained copies per language.

  python3 tools/i18n/build.py            # every language, every page
  python3 tools/i18n/build.py ar         # one language
"""
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.join(ROOT, 'tools', 'i18n')

# The pages, as (source file, route).
PAGES = [
    ('index.html', ''),
    ('privacy/index.html', 'privacy'),
    ('terms/index.html', 'terms'),
    ('support/index.html', 'support'),
    ('whats-new/index.html', 'whats-new'),
    ('press/index.html', 'press'),
]

# `reviewed` is the gate on a translation being treated as finished. Until a
# speaker of the language has read the page, it is a draft: it is served with
# noindex so no search engine carries an unchecked sentence about the
# Qur'an, and it says so at the top of itself so a reader is not misled
# either. Flip the flag and rebuild; nothing else changes.
LANGS = {
    'ar': {'name': 'العربية', 'dir': 'rtl', 'english': 'Arabic', 'reviewed': False,
           'draft': 'ترجمة مسوّدة، لم تُراجَع بعد. النسخة الإنجليزية هي المرجع.'},
    'ur': {'name': 'اردو', 'dir': 'rtl', 'english': 'Urdu', 'reviewed': False,
           'draft': 'مسودہ ترجمہ، ابھی نظرثانی نہیں ہوئی۔ انگریزی نسخہ ہی معتبر ہے۔'},
    'id': {'name': 'Bahasa Indonesia', 'dir': 'ltr', 'english': 'Indonesian', 'reviewed': False,
           'draft': 'Terjemahan draf, belum ditinjau. Versi bahasa Inggris adalah acuannya.'},
}

SITE = 'https://ummahtiofficial.com'

# Paths that are files rather than routes, and so are never language-prefixed.
ASSET = re.compile(r'^/(media|fonts|vendor|i18n|styles\.css|app\.js|theme\.js|sky\.js|verse\.js|site\.webmanifest|robots\.txt|sitemap\.xml)')


def localise_links(markup, lang):
    """Point in-site routes at this language's copy of them."""
    def fix(m):
        attr, path = m.group(1), m.group(2)
        if ASSET.match(path):
            return m.group(0)
        if path == '/':
            return f'{attr}="/{lang}/"'
        return f'{attr}="/{lang}{path}"'
    return re.sub(r'\b(href|src)="(/[^"]*)"', fix, markup)


def hreflang_block(route):
    """Every language's copy of this page, plus the default."""
    tail = f'/{route}' if route else '/'
    rows = [f'<link rel="alternate" hreflang="en" href="{SITE}{tail}">']
    for code in LANGS:
        rows.append(f'<link rel="alternate" hreflang="{code}" '
                    f'href="{SITE}/{code}{"/" + route if route else "/"}">')
    rows.append(f'<link rel="alternate" hreflang="x-default" href="{SITE}{tail}">')
    return '\n'.join(rows)


def switcher(lang, route):
    """A plain list of links. It needs no script, and a crawler follows it."""
    tail = f'/{route}' if route else '/'
    out = ['<div class="lang-pick">',
           '  <span class="lang-pick-label">Language</span>']
    entries = [('en', 'English', tail)]
    entries += [(c, LANGS[c]['name'], f'/{c}{"/" + route if route else "/"}') for c in LANGS]
    for code, name, href in entries:
        cur = ' aria-current="true"' if code == lang else ''
        out.append(f'  <a hreflang="{code}" lang="{code}" href="{href}"{cur}>{name}</a>')
    out.append('</div>')
    return '\n'.join(out)


def apply_translations(markup, table, report):
    """Put each translated segment back where its English original sits.

    Longest first, always. A short segment is very often a substring of a
    long one — "Guide" sits inside "Ummahti Guide" and inside the paragraph
    that opens "Guide is a destination of its own in the app" — and replacing
    the short one first destroys the long one's text before it can match,
    leaving a half-translated sentence behind. Sorting by length means the
    longest claim on any run of text is always settled first.

    A segment is skipped rather than guessed at when it is absent; that is
    counted, so a page is never silently half done.
    """
    for english, translated in sorted(table.items(), key=lambda kv: -len(kv[0])):
        if not translated or translated == english:
            report['untranslated'] += 1
            continue
        # Match the English as it sits in the source, where a line break in
        # the markup is just whitespace to a reader.
        pattern = re.escape(english).replace(r'\ ', r'\s+')
        hits = list(re.finditer(pattern, markup))
        if not hits:
            report['missing'].append(english)
            continue
        markup = re.sub(pattern, lambda m: translated.replace('\\', '\\\\'), markup)
        report['applied'] += 1
    return markup


def build_page(src_rel, route, lang):
    src = io.open(os.path.join(ROOT, src_rel), encoding='utf-8').read()
    table_path = os.path.join(HERE, f'{lang}.json')
    table = json.load(io.open(table_path, encoding='utf-8')) if os.path.exists(table_path) else {}

    report = {'applied': 0, 'untranslated': 0, 'missing': []}
    out = apply_translations(src, table, report)
    out = localise_links(out, lang)

    meta = LANGS[lang]
    out = out.replace('<html lang="en" class="no-js">',
                      f'<html lang="{lang}" dir="{meta["dir"]}" class="no-js">', 1)

    # Canonical and og:url point at this copy, and the alternates go beside
    # them. The English page carries its own alternates block, written by
    # wire_english.py; it is dropped here and rewritten rather than left to
    # sit alongside this one, which would list every language twice.
    tail = f'/{route}' if route else '/'
    here = f'{SITE}/{lang}{"/" + route if route else "/"}'
    out = re.sub(r'<!-- hreflang: written by tools/i18n/wire_english\.py -->.*?<!-- /hreflang -->\n?',
                 '', out, flags=re.S)
    out = re.sub(r'<link rel="canonical" href="[^"]*">',
                 f'<link rel="canonical" href="{here}">\n' + hreflang_block(route), out, count=1)
    out = re.sub(r'<meta property="og:url" content="[^"]*">',
                 f'<meta property="og:url" content="{here}">', out, count=1)
    out = re.sub(r'<meta property="og:locale" content="[^"]*">',
                 f'<meta property="og:locale" content="{lang}">', out, count=1)

    if not meta.get('reviewed'):
        out = out.replace('<meta name="theme-color"',
                          '<meta name="robots" content="noindex,follow">\n<meta name="theme-color"', 1)
        banner = (f'<p class="draft-note" lang="{lang}" dir="{meta["dir"]}">{meta["draft"]} '
                  f'<a href="{tail}" lang="en" dir="ltr">Read the English version</a></p>')
        out = out.replace('<main id="main">', banner + '\n<main id="main">', 1)

    # The demo strings app.js reads, ahead of app.js itself.
    out = out.replace('<script src="/app.js',
                      f'<script src="/i18n/{lang}.js" defer></script>\n<script src="/app.js', 1)

    # The switcher, at the end of the footer's own nav.
    out = out.replace('</nav>\n  </div>\n  <div class="footer-base shell">',
                      '</nav>\n' + switcher(lang, route) + '\n  </div>\n  <div class="footer-base shell">', 1)

    dest_dir = os.path.join(ROOT, lang, route) if route else os.path.join(ROOT, lang)
    os.makedirs(dest_dir, exist_ok=True)
    io.open(os.path.join(dest_dir, 'index.html'), 'w', encoding='utf-8').write(out)
    return report


if __name__ == '__main__':
    wanted = sys.argv[1:] or list(LANGS)
    for lang in wanted:
        if lang not in LANGS:
            sys.exit(f'unknown language: {lang}')
        print(f'--- {lang} ({LANGS[lang]["english"]}) ---')
        for src_rel, route in PAGES:
            r = build_page(src_rel, route, lang)
            note = f'{r["applied"]} applied, {r["untranslated"]} still English'
            if r['missing']:
                note += f', {len(r["missing"])} NOT FOUND IN SOURCE'
            print(f'  /{lang}/{route:<11} {note}')
