#!/usr/bin/env python3
"""Assert every query the Guide demo types is a real alias of the topic it opens.

The panel's whole claim is that these are answers the app would actually
give. A query that is merely plausible rather than present in
GuideCatalog.kt would quietly make that false, so it is checked rather than
trusted.

  python3 tools/i18n/check_queries.py ../UmmahtiQuran
"""
import io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))

sys.path.insert(0, HERE)
from make_demo_strings import TOPICS  # noqa: E402


def resolves(query, alias_list):
    """Would the app open this topic for this query?

    An exact alias, or a query that contains one as a phrase. The second is
    how the matcher itself behaves — GuideCatalog's own note on why the bare
    alias "should i" had to be removed describes exactly this: it phrase-
    contained any question carrying those two words. So a query that merely
    wraps an alias in a natural sentence is a true demonstration, and only a
    query sharing no alias at all is a false one.
    """
    q = query.casefold()
    return any(a.casefold() in q for a in alias_list)


def aliases(catalog, topic_id):
    m = re.search(r'id = "%s".*?aliases = listOf\((.*?)\n\s*\)' % topic_id, catalog, re.S)
    if not m:
        return None
    return re.findall(r'"([^"]+)"', re.sub(r'//[^\n]*', '', m.group(1)))


def main(android_root):
    catalog = io.open(os.path.join(
        android_root, 'app/src/main/java/com/ummahti/quran/feature/guide/GuideCatalog.kt'),
        encoding='utf-8').read()
    site = json.load(io.open(os.path.join(HERE, 'demo-site-copy.json'), encoding='utf-8'))

    bad = 0
    for lang in ('ar', 'ur', 'id'):
        for i, (topic_id, _, _) in enumerate(TOPICS):
            q = site[lang]['queries'][i]
            al = aliases(catalog, topic_id)
            if al is None:
                print(f'  {lang}  {topic_id}: TOPIC NOT FOUND')
                bad += 1
            elif not resolves(q, al):
                near = [a for a in al if a[:4] == q[:4]]
                print(f'  {lang}  {q!r} is not an alias of {topic_id}'
                      + (f' — did you mean {near[0]!r}?' if near else ''))
                bad += 1
    # And the English set, which lives in app.js.
    app = io.open(os.path.join(ROOT, 'app.js'), encoding='utf-8').read()
    block = app[app.index('const GUIDE = ['):app.index('const gDemo')]
    for i, (topic_id, _, _) in enumerate(TOPICS):
        q = re.findall(r"q: '([^']*)'", block)[i].replace('’', "'")
        al = aliases(catalog, topic_id)
        if not resolves(q, al):
            print(f'  en  {q!r} is not an alias of {topic_id}')
            bad += 1

    print('every demo query is a real catalogue alias' if not bad else f'{bad} problem(s)')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'UmmahtiQuran')))
