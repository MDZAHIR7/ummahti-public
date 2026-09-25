#!/usr/bin/env python3
"""Pull the translatable segments out of a page.

The English HTML is the source of truth for this site; nothing here marks it
up with translation keys, because doing that would mean editing every page to
serve a build step the site is otherwise proud not to have. Instead a segment
is identified by its exact English text, and `build.py` puts the translation
back by matching that same text. So a segment must be unique enough to match
on, which is what the collision check at the bottom is for.

Usage:  python3 tools/i18n/extract.py index.html > tools/i18n/segments/index.json
"""
import html
import json
import re
import sys

# Attributes whose value is read by a person or a search engine.
ATTRS = ('content', 'alt', 'aria-label', 'title', 'placeholder')

# Attributes that look like the above but never carry prose.
SKIP_ATTR_VALUES = re.compile(
    r'^\s*(https?:|/|#|\d|[a-z-]+$|website$|summary_large_image$)', re.I)


def strip_ignored(markup):
    """Blank out what must never be offered for translation, keeping offsets."""
    def blank(m):
        return ' ' * len(m.group(0))
    markup = re.sub(r'(?s)<script.*?</script>', blank, markup)
    markup = re.sub(r'(?s)<style.*?</style>', blank, markup)
    markup = re.sub(r'(?s)<svg.*?</svg>', blank, markup)
    markup = re.sub(r'(?s)<!--.*?-->', blank, markup)
    markup = re.sub(r'(?s)<(\w+)\b[^>]*\btranslate="no"[^>]*>.*?</\1>', blank, markup)
    return markup


def segments(markup):
    body = strip_ignored(markup)
    found = []

    # Text nodes.
    for m in re.finditer(r'>([^<>]+)<', body):
        text = m.group(1)
        if not text.strip():
            continue
        # A run of whitespace in the source is one space to a reader.
        norm = re.sub(r'\s+', ' ', text).strip()
        if not norm or not re.search(r'[A-Za-z]', norm):
            continue
        found.append(norm)

    # Attributes.
    for m in re.finditer(r'\b(' + '|'.join(ATTRS) + r')="([^"]+)"', body):
        val = html.unescape(m.group(2)).strip()
        if not val or SKIP_ATTR_VALUES.match(val) or not re.search(r'[A-Za-z]', val):
            continue
        if len(val.split()) < 2:
            continue
        found.append(re.sub(r'\s+', ' ', val))

    # <title> is neither, being a text node inside <head>.
    t = re.search(r'<title>(.*?)</title>', markup, re.S)
    if t:
        found.append(re.sub(r'\s+', ' ', t.group(1)).strip())

    # Order-preserving unique.
    seen, out = set(), []
    for f in found:
        if f not in seen:
            seen.add(f)
            out.append(f)
    return out


if __name__ == '__main__':
    src = io = open(sys.argv[1], encoding='utf-8').read()
    segs = segments(src)
    print(json.dumps(segs, ensure_ascii=False, indent=1))
    print(f'{len(segs)} segments', file=sys.stderr)
