"""Check the static site's real links, metadata and umbrella/product identity."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import json
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SITE = 'https://ummahtiofficial.com'

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids = set()
        self.links = []
        self.metadata = {}
        self.canonical = None
        self.scripts = []
        self.title = ''
        self.in_title = False
        self.support_updates = 0
        self.feed(text)
    def handle_starttag(self, tag, attributes):
        a = dict(attributes)
        if tag == 'title':
            self.in_title = True
        if tag == 'section' and 'v-support-current' in a.get('class', '').split():
            self.support_updates += 1
        if a.get('id'):
            assert a['id'] not in self.ids, f'duplicate id: {a["id"]}'
            self.ids.add(a['id'])
        if tag == 'link' and a.get('rel') == 'canonical':
            self.canonical = a.get('href')
        if tag == 'meta':
            self.metadata[a.get('name') or a.get('property')] = a.get('content')
        for attribute in ('href', 'src', 'poster'):
            if a.get(attribute):
                self.links.append(a[attribute])
        if a.get('srcset'):
            self.links.extend(entry.strip().split()[0] for entry in a['srcset'].split(','))
        if tag == 'script' and a.get('src'):
            self.scripts.append(a['src'])

    def handle_data(self, data):
        if self.in_title:
            self.title += data

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False

pages = {}
for path in ROOT.rglob('index.html'):
    if any(part.startswith('.') for part in path.relative_to(ROOT).parts):
        continue
    text = path.read_text(encoding='utf-8')
    page = Page(text)
    pages[path] = page
    assert page.canonical and page.canonical.startswith(SITE + '/'), path
    assert page.metadata.get('og:url') == page.canonical, f'Link-preview URL differs from canonical: {path}'
    assert page.metadata.get('og:title') == page.title.strip(), f'Link-preview title differs from page: {path}'
    if path.relative_to(ROOT).parts[0] in ('ar', 'ur', 'id'):
        assert 'noindex' in page.metadata.get('robots', '').lower(), f'Draft locale is indexable: {path}'
    if path.parent.name == 'support':
        assert page.support_updates == 1, f'Generated support guidance repeated or missing: {path}'
    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', text, re.S):
        data = json.loads(block)
        assert data.get('@context') == 'https://schema.org', path

errors = []
for path, page in pages.items():
    for link in page.links:
        parsed = urlsplit(link)
        if parsed.scheme or parsed.netloc or not parsed.path.startswith('/') and not parsed.fragment:
            continue
        target = ROOT / unquote(parsed.path.lstrip('/')) if parsed.path else path
        if target.is_dir():
            target /= 'index.html'
        if not target.exists():
            errors.append(f'{path.relative_to(ROOT)}: missing {link}')
        elif parsed.fragment and target in pages and parsed.fragment not in pages[target].ids:
            errors.append(f'{path.relative_to(ROOT)}: missing fragment {link}')

home = ROOT / 'index.html'
graph = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>',home.read_text(encoding='utf-8'),re.S).group(1))['@graph']
entities = {item['@type']: item for item in graph}
assert entities['Organization']['name'] == 'Ummahti'
assert entities['WebSite']['url'] == SITE + '/'
assert entities['SoftwareApplication']['url'] == SITE + '/quran/'
assert entities['SoftwareApplication']['publisher']['@id'] == entities['Organization']['@id']
assert not any('aggregateRating' in item for item in graph)
assert pages[home].canonical == SITE + '/'
assert pages[ROOT / 'quran/index.html'].canonical == SITE + '/quran/'
assert not any('home.js' in src for src in pages[home].scripts), 'Competing motion system loaded'
assert not any('lenis' in src for src in pages[home].scripts), 'V1.5 keeps page scrolling native'
assert any('/v15.js' in src for src in pages[home].scripts)
for required in ('mushaf','search','guide','themes','inside','one-verse','film','purpose','community'):
    assert required in pages[home].ids, f'preserved feature missing: {required}'

for node in ET.parse(ROOT / 'sitemap.xml').iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc'):
    target = ROOT / urlsplit(node.text).path.lstrip('/') / 'index.html'
    assert target in pages, f'sitemap route missing: {node.text}'
    assert 'noindex' not in pages[target].metadata.get('robots', ''), f'noindex URL in sitemap: {node.text}'

assert not errors, '\n'.join(errors)
print(f'{len(pages)} pages: local assets and fragments, unique IDs, JSON-LD and canonical URLs passed.')
print('Umbrella/app distinction, preserved interactive sections, single scroll engine and indexable sitemap passed.')
