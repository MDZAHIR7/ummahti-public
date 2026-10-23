"""Export the app's own Guide mark and selection-ring geometry, read-only.

HomeScreen.rememberNavItems: Home / MenuBook / own crescent / Bookmark / Settings.
UmmahtiNavRail: floating elevated pill, grabber, labelled slots, one gold ring.
The browser rendering adds restrained glass depth; it does not alter app source.
"""
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
APP = Path('C:/Users/1zahi/AndroidStudioProjects/UmmahtiQuran2')
ANDROID = '{http://schemas.android.com/apk/res/android}'


def build():
    vector = ET.parse(APP / 'app/src/main/res/drawable/ummahti_moon_logo_simplified.xml').getroot()
    paths = ''.join('<path d="' + path.attrib[ANDROID + 'pathData'] + '" fill="#f1d98a"/>' for path in vector)
    (ROOT / 'media/v15/nav-guide.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + vector.attrib[ANDROID+'viewportWidth'] + ' ' + vector.attrib[ANDROID+'viewportHeight'] + '">' + paths + '</svg>\n', encoding='utf-8')
    geometry = (APP / 'app/src/main/java/com/ummahti/quran/ui/onboarding/motion/UmmahtiMotionGeometry.kt').read_text(encoding='utf-8')
    ring = re.search(r'OUTER_RING = listOf\(\s*"([^"]+)"', geometry)[1]
    spine_block = geometry.split('private val CRESCENT_SPINE = listOf(', 1)[1].split('\n    )', 1)[0]
    spine = re.findall(r'"([^"]+)"', spine_block)
    content = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500"><g fill="none" stroke="#f1d98a"><path stroke-width="16" stroke-linecap="round" d="' + ring + '"/>'
    content += ''.join('<path opacity=".24" stroke-width="4" d="' + p + '"/>' for p in spine) + '</g></svg>\n'
    (ROOT / 'media/v15/nav-indicator.svg').write_text(content, encoding='utf-8')
    print('Exported unchanged app Guide vector and selection geometry; Android read only.')


if __name__ == '__main__':
    build()
