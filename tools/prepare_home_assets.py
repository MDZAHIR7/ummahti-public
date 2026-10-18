"""Make dated web derivatives of genuine Android release captures.

Usage: python tools/prepare_home_assets.py <app-repository>
No UI is reconstructed and no Qur'an text is typeset here.
"""
from pathlib import Path
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]) / 'release' / 'Play Store' / 'build' / 'captures'
destination = ROOT / 'media' / 'screens' / '2026-10'
destination.mkdir(parents=True, exist_ok=True)
captures = {
    'home': '01-home.png', 'mushaf': '02-mushaf.png',
    'stream': '03-stream.png', 'guide': '06-guide.png',
    'audio': '07-audio.png', 'themes': '05-themes.png',
    'unlock': '04-unlock.png',
}
for name, filename in captures.items():
    with Image.open(source / filename) as original:
        for width in (420, 840):
            height = round(original.height * width / original.width)
            original.resize((width, height), Image.Resampling.LANCZOS).save(
                destination / f'{name}-{width}.webp', quality=86, method=6)
    print(f'{name}: {filename}')
