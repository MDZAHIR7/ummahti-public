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
import html
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
    ('contact/index.html', 'contact'),
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

# Routes whose translated copy must say which version governs. A privacy
# policy and a terms page make commitments, and two language versions of a
# commitment can disagree; saying plainly that the English one is the
# operative text is how that disagreement is settled in advance. Unlike the
# draft banner this does not go away when the language is marked reviewed —
# a reviewed translation of a legal document is still a translation.
GOVERNING = {
    'ar': 'هذه ترجمة للتيسير. والنسخة الإنجليزية هي النصّ المعتمد.',
    'ur': 'یہ سہولت کے لیے ترجمہ ہے۔ معتبر متن انگریزی نسخہ ہی ہے۔',
    'id': 'Ini terjemahan untuk kemudahan. Versi bahasa Inggris adalah teks yang berlaku.',
}
LEGAL = ('privacy', 'terms')

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
    """Every language's copy of this page, plus the default.

    With the trailing slash. Cloudflare Pages serves /support/ and answers
    /support with a 308 to it, so a canonical, an alternate or a sitemap entry
    written without the slash names a URL that redirects — which is the one
    thing a self-referential canonical must not do.
    """
    tail = f'/{route}/' if route else '/'
    rows = [f'<link rel="alternate" hreflang="en" href="{SITE}{tail}">']
    for code in LANGS:
        rows.append(f'<link rel="alternate" hreflang="{code}" '
                    f'href="{SITE}/{code}/{route + "/" if route else ""}">')
    rows.append(f'<link rel="alternate" hreflang="x-default" href="{SITE}{tail}">')
    return '\n'.join(rows)


def switcher(lang, route, label='Language'):
    """A plain list of links. It needs no script, and a crawler follows it.

    Used for the translated pages by build_page and for the English ones by
    wire_english, so every page in every language carries the same row.

    The row is built after the translation pass has run, so its own label has
    to be handed in already translated; left to the pass it would stay in
    English on every page. The language names themselves are deliberately not
    translated — each names itself in its own language, which is the one form
    a reader who wants it can recognise on a page they cannot read.
    """
    tail = f'/{route}/' if route else '/'
    out = ['<div class="lang-pick">',
           f'  <span class="lang-pick-label">{label}</span>']
    entries = [('en', 'English', tail)]
    entries += [(c, LANGS[c]['name'], f'/{c}/{route + "/" if route else ""}') for c in LANGS]
    for code, name, href in entries:
        cur = ' aria-current="true"' if code == lang else ''
        out.append(f'  <a hreflang="{code}" lang="{code}" href="{href}"{cur}>{name}</a>')
    out.append('</div>')
    return '\n'.join(out)


def mask_scripts(markup):
    """Take <script> contents out of the segment pass, and give them back.

    A segment is matched as plain text anywhere in the file, and script
    bodies are not prose: "FAQ" is a navigation label and also the first
    three characters of the value "FAQPage", so translating in place turned
    a valid @type into "أسئلة شائعةPage" and silently broke the page's
    structured data. Scripts are localised deliberately, by
    relocalise_schema, from the translated markup — never by text
    substitution.
    """
    held = []

    def take(m):
        held.append(m.group(0))
        return f'\x00SCRIPT{len(held) - 1}\x00'

    return re.sub(r'(?s)<script\b.*?</script>', take, markup), held


def mask_urls(markup):
    """Take URLs out of the segment pass, the way script bodies already are.

    A URL is not prose and must never be translated, but the segment pass is a
    plain text substitution over the whole file, so any brand name that is also
    a translation key rewrites the addresses it appears in. That is not
    theoretical: the table carries "Ummahti" -> "أُمّتي", and every Arabic page
    shipped with

        href="https://www.youtube.com/@أُمّتي"

    which is a real channel belonging to somebody else, and the Urdu equivalent
    which is a 404. Indonesian was untouched only because its table happens to
    have no bare brand key.

    href/src/srcset are always held. Any other attribute is held only when its
    value actually looks like a URL, so prose in content="..." still translates.
    """
    held = []

    def take(m):
        attr, value = m.group(1).lower(), m.group(2)
        is_url = attr in ('href', 'src', 'srcset', 'poster', 'action', 'cite') or \
            re.match(r'(?:https?:|mailto:|tel:)|^//|^/|^\.\./', value)
        if not is_url:
            return m.group(0)
        held.append(m.group(0))
        return f'\x00URL{len(held) - 1}\x00'

    return re.sub(r'\b([A-Za-z_][\w:-]*)="([^"]*)"', take, markup), held


def mask_notranslate(markup):
    """Take elements marked translate="no" out of the segment pass.

    The footer's copyright and trademark notice is a legal statement about
    Latin-script marks, and is meant to read identically on every language's
    pages. Left in the pass, the bare "Ummahti" key would rewrite
    "Ummahti Quran\u2122" into a mark nobody uses.
    """
    held = []

    def take(m):
        held.append(m.group(0))
        return f'\x00NOTR{len(held) - 1}\x00'

    return re.sub(r'(?s)<(\w+)\b[^>]*\btranslate="no"[^>]*>.*?</\1>', take, markup), held


def unmask_notranslate(markup, held):
    for i, original in enumerate(held):
        markup = markup.replace(f'\x00NOTR{i}\x00', original, 1)
    return markup


def unmask_urls(markup, held):
    for i, original in enumerate(held):
        markup = markup.replace(f'\x00URL{i}\x00', original, 1)
    return markup


def unmask_scripts(markup, held):
    for i, original in enumerate(held):
        markup = markup.replace(f'\x00SCRIPT{i}\x00', original, 1)
    return markup


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


def relocalise_schema(markup, lang, here):
    """Make the structured data agree with the page it sits on.

    Two blocks would otherwise still describe the English page: the FAQ
    answers, which are inside a <script> and so are never touched by the
    segment pass, and SoftwareApplication's url and description. Structured
    data that disagrees with the page is worse than none — it is what a
    search engine quotes.

    The FAQ is rebuilt from this page's own translated markup rather than
    from a second table, so it cannot drift from what a reader sees.
    """
    if '"@type": "FAQPage"' in markup:
        pairs = re.findall(r'<h3>(.*?)</h3>\s*<p>(.*?)</p>', markup, re.S)
        if pairs:
            def clean(t):
                t = html.unescape(t).strip()
                t = re.sub(r'href="(/[^"]*)"', r'href="' + SITE + r'\1"', t)
                return re.sub(r'\s+', ' ', t)
            faq = {
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                'inLanguage': lang,
                'mainEntity': [{
                    '@type': 'Question',
                    'name': re.sub(r'<[^>]+>', '', clean(q)),
                    'acceptedAnswer': {'@type': 'Answer', 'text': clean(a)},
                } for q, a in pairs],
            }
            markup = re.sub(
                r'<script type="application/ld\+json">\s*\{\s*"@context".*?"@type": "FAQPage".*?</script>',
                '<script type="application/ld+json">\n'
                + json.dumps(faq, ensure_ascii=False, indent=2) + '\n</script>',
                markup, count=1, flags=re.S)

    if '"@type": "SoftwareApplication"' in markup:
        m = re.search(r'<meta name="description" content="([^"]*)"', markup)
        markup = markup.replace(f'"url": "{SITE}/"', f'"url": "{here}"', 1)
        if m:
            desc = html.unescape(m.group(1))
            markup = re.sub(r'("description": )"(?:[^"\\]|\\.)*"',
                            lambda _: '"description": ' + json.dumps(desc, ensure_ascii=False),
                            markup, count=1)
    return markup


def build_page(src_rel, route, lang):
    src = io.open(os.path.join(ROOT, src_rel), encoding='utf-8').read()
    table_path = os.path.join(HERE, f'{lang}.json')
    table = json.load(io.open(table_path, encoding='utf-8')) if os.path.exists(table_path) else {}

    report = {'applied': 0, 'untranslated': 0, 'missing': []}
    out, scripts = mask_scripts(src)
    out, notr = mask_notranslate(out)
    out, urls = mask_urls(out)
    out = apply_translations(out, table, report)
    out = unmask_urls(out, urls)
    out = unmask_notranslate(out, notr)
    out = unmask_scripts(out, scripts)
    out = localise_links(out, lang)

    meta = LANGS[lang]
    out = out.replace('<html lang="en" class="no-js">',
                      f'<html lang="{lang}" dir="{meta["dir"]}" class="no-js">', 1)

    # Canonical and og:url point at this copy, and the alternates go beside
    # them. The English page carries its own alternates block, written by
    # wire_english.py; it is dropped here and rewritten rather than left to
    # sit alongside this one, which would list every language twice.
    tail = f'/{route}/' if route else '/'
    here = f'{SITE}/{lang}/{route + "/" if route else ""}'
    out = re.sub(r'<!-- hreflang: written by tools/i18n/wire_english\.py -->.*?<!-- /hreflang -->\n?',
                 '', out, flags=re.S)
    # Same for the switcher wire_english puts on the English page: this
    # build writes its own, marking this language as the current one.
    out = re.sub(r'<!-- language switcher: written by tools/i18n/wire_english\.py -->.*?<!-- /language switcher -->\n?',
                 '', out, flags=re.S)
    out = re.sub(r'<link rel="canonical" href="[^"]*">',
                 f'<link rel="canonical" href="{here}">\n' + hreflang_block(route), out, count=1)
    out = re.sub(r'<meta property="og:url" content="[^"]*">',
                 f'<meta property="og:url" content="{here}">', out, count=1)
    out = re.sub(r'<meta property="og:locale" content="[^"]*">',
                 f'<meta property="og:locale" content="{lang}">', out, count=1)

    if route in LEGAL:
        note = (f'<p class="governing-note">{GOVERNING[lang]} '
                f'<a href="{tail}" lang="en" dir="ltr">English version</a></p>')
        out = out.replace('<div class="doc shell">', note + '\n  <div class="doc shell">', 1)

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
                      '</nav>\n' + switcher(lang, route, table.get('Language', 'Language'))
                      + '\n  </div>\n  <div class="footer-base shell">', 1)

    out = relocalise_schema(out, lang, here)

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
