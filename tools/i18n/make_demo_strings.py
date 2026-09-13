#!/usr/bin/env python3
"""Write /i18n/<lang>.js: the strings the two demos on the landing page use.

Guide's own words — topic titles, categories, the caption under a reference,
the practical step, the summary under a narration — are NOT translated here.
They are lifted from the Android app's own localised resources, which are
reviewed content, so the panel shows a reader exactly what their phone would
show them. Only the site's own framing (the query typed, and the line
explaining what just happened) is authored here.

  python3 tools/i18n/make_demo_strings.py ../UmmahtiQuran

The output is committed; the site does not build.
"""
import glob
import html
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

LOCALE_DIR = {'ar': 'values-ar', 'ur': 'values-ur', 'id': 'values-in'}

# Each topic: the app string ids its panel is built from, and the four
# references shown. The references are coordinates, identical in every
# language; the grade is the one word beside them that is not.
TOPICS = [
    ('anxiety_and_worry', 'heart_and_emotions',
     ['Qur’an 13:28|caption1|start', 'Qur’an 94:5-6', 'Qur’an 2:286',
      'Sahih al-Bukhari 6363|worry_and_debt_dua|sahih']),
    ('returning_to_the_same_sin', 'faith_and_repentance',
     ['Qur’an 3:135|caption1|start', 'Qur’an 39:53', 'Qur’an 4:110',
      'Sahih al-Bukhari 7507|repeated_return_forgiven|sahih']),
    ('failing_an_exam', 'work_study_and_provision',
     ['Qur’an 2:216|caption1|start', 'Qur’an 3:139', 'Qur’an 94:5-6',
      'Sahih Muslim 2664|striving_and_reliance|sahih']),
    ('debt', 'work_study_and_provision',
     ['Qur’an 2:280|caption1|start', 'Qur’an 65:7|caption2', 'Qur’an 2:275',
      'Sahih al-Bukhari 6363|worry_and_debt_dua|sahih']),
    ('decision_making_istikhara', 'life_and_decisions',
     ['Qur’an 3:159|caption1|start', 'Qur’an 2:216|caption2', 'Qur’an 65:3',
      'Sahih al-Bukhari 1166|istikhara_prayer|sahih']),
]

# "Qur'an" and the two weight words, which the app does not hold as separate
# strings because it never draws a reference this way.
WORDS = {
    'ar': {'quran': 'القرآن', 'start': 'ابدأ هنا', 'sahih': 'صحيح',
           'bukhari': 'صحيح البخاري', 'muslim': 'صحيح مسلم'},
    'ur': {'quran': 'قرآن', 'start': 'یہاں سے شروع کریں', 'sahih': 'صحیح',
           'bukhari': 'صحیح بخاری', 'muslim': 'صحیح مسلم'},
    'id': {'quran': 'Al-Qur’an', 'start': 'Mulai di sini', 'sahih': 'Sahih',
           'bukhari': 'Sahih al-Bukhari', 'muslim': 'Sahih Muslim'},
}


def load_strings(android_root, folder):
    out = {}
    for f in glob.glob(os.path.join(android_root, 'app/src/main/res', folder, 'strings*.xml')):
        s = io.open(f, encoding='utf-8').read()
        for k, v in re.findall(r'<string name="([^"]+)"[^>]*>(.*?)</string>', s, re.S):
            out[k] = html.unescape(v).replace("\\'", "'").strip()
    return out


# A reference is a book name in the page's language followed by numbers that
# read left to right whatever the page does. Set loose in an RTL line the
# numbers are reordered by the bidi algorithm — "94:5-6" comes out "6-94:5",
# which is a different verse range — so the numeric tail is wrapped in an
# isolate. Both characters are invisible.
LRI, PDI = '\u2066', '\u2069'


def reference(spec, lang, strings):
    """Draw one source row in this language."""
    parts = spec.split('|')
    ref, w = parts[0], WORDS[lang]
    ref = ref.replace('Qur’an', w['quran'])
    ref = ref.replace('Sahih al-Bukhari', w['bukhari']).replace('Sahih Muslim', w['muslim'])
    if lang in ('ar', 'ur'):
        ref = re.sub(r'(\S*\d\S*)$', LRI + r'\1' + PDI, ref)
    row = {'ref': ref}
    if len(parts) > 1 and parts[1].startswith('caption'):
        row['_caption'] = parts[1]
    elif len(parts) > 1:
        row['note'] = strings.get(f'guide_sunnah_{parts[1]}_summary', '')
    if 'start' in parts:
        row['tag'] = w['start']
    elif 'sahih' in parts:
        row['tag'] = w['sahih']
    return row


def build(lang, android_root, site):
    strings = load_strings(android_root, LOCALE_DIR[lang])
    cases = []
    for i, (tid, cat, refs) in enumerate(TOPICS):
        rows = []
        for spec in refs:
            row = reference(spec, lang, strings)
            cap = row.pop('_caption', None)
            if cap:
                key = f'guide_{tid}_quran_{cap.replace("caption", "caption_")}'
                if strings.get(key):
                    row['note'] = strings[key]
            rows.append(row)
        cases.append({
            'q': site['queries'][i],
            'rtl': lang in ('ar', 'ur'),
            'title': strings[f'guide_{tid}_title'],
            'cat': strings[f'guide_category_{cat}'],
            'why': site['why'][i],
            'sources': rows,
            'step': strings[f'guide_{tid}_action_1'],
        })
    return cases


# The twelve reading themes, by the English name the page uses for each.
THEME_NAMES = {
    'obsidian': 'Obsidian Dark', 'warm-cream': 'Warm Cream',
    'crisp-light': 'Crisp Light', 'classic-ink': 'Classic Ink',
    'madinah': 'Madinah Mushaf', 'ottoman': 'Ottoman Manuscript',
    'andalusian': 'Andalusian', 'persian': 'Persian Illumination',
    'sheikh-zayed': 'Sheikh Zayed', 'haramain': 'Haramain',
    'shiraz-dawn': 'Shiraz Dawn', 'jali-moon': 'Jali Moon',
}


def themes(lang):
    """Take the theme names from the page table, so they are written once."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), f'{lang}.json')
    if not os.path.exists(path):
        return {}
    table = json.load(io.open(path, encoding='utf-8'))
    return {tid: table[en] for tid, en in THEME_NAMES.items()
            if table.get(en) and table[en] != en}


if __name__ == '__main__':
    android = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'UmmahtiQuran')
    site = json.load(io.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'demo-site-copy.json'),
                             encoding='utf-8'))
    os.makedirs(os.path.join(ROOT, 'i18n'), exist_ok=True)
    for lang in LOCALE_DIR:
        payload = {'guide': build(lang, android, site[lang]),
                   'search': site[lang]['search'],
                   'themes': themes(lang),
                   'copy': site[lang]['copy']}
        body = ('/* Generated by tools/i18n/make_demo_strings.py — do not edit by hand.\n'
                '   Guide\'s own words here are the Android app\'s localised strings,\n'
                '   not a second translation of them. */\n'
                'window.UMMAHTI_I18N = ' + json.dumps(payload, ensure_ascii=False, indent=1) + ';\n')
        io.open(os.path.join(ROOT, 'i18n', f'{lang}.js'), 'w', encoding='utf-8').write(body)
        print(f'i18n/{lang}.js  {len(payload["guide"])} guide cases, {len(payload["search"])} search cases')
