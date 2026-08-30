#!/usr/bin/env python3
"""Render every Ummahti brand export from the one mark.

    pip install pillow cairosvg fonttools brotli
    python3 ops/brand/build.py

Writes into media/brand/ (and the root favicon). Everything here is derived —
the mark in media/brand/favicon.svg and the two webfonts in fonts/ are the
only inputs — so the exports can always be rebuilt rather than hand-edited.
"""
import io
import os
import sys

import cairosvg
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from icons import PALETTES, icon_svg, panel_svg          # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
BRAND = os.path.join(ROOT, 'media', 'brand')
IDENT = PALETTES['twin-wells']

TAGLINE = 'The complete Qur’an, offline.'
TAGLINE_2 = 'No ads. No account. Nothing in the way.'


# ---------------------------------------------------------------- rendering

def render(svg, w, h=None):
    """SVG string -> RGBA image."""
    png = cairosvg.svg2png(bytestring=svg.encode('utf-8'),
                           output_width=int(w),
                           output_height=int(h if h else w))
    return Image.open(io.BytesIO(png)).convert('RGBA')


def save(img, *path, jpeg=False, ico=None):
    dest = os.path.join(BRAND, *path)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if ico:
        img.save(dest, sizes=ico)
    elif jpeg:
        flat = Image.new('RGB', img.size, (8, 8, 10))
        flat.paste(img, mask=img.split()[3])
        flat.save(dest, quality=88, optimize=True, progressive=True)
    else:
        img.save(dest, optimize=True)
    print('%9d  %s' % (os.path.getsize(dest),
                       os.path.relpath(dest, ROOT)))
    return dest


def opaque(img, bg=(8, 8, 10)):
    """Flatten alpha — Play rejects an icon with a transparent channel."""
    flat = Image.new('RGB', img.size, bg)
    flat.paste(img, mask=img.split()[3])
    return flat.convert('RGBA')


# -------------------------------------------------------------------- type

def _ttf(woff2, name):
    """Brand webfonts are woff2; FreeType wants a ttf. Convert on the fly."""
    from fontTools.ttLib import TTFont
    cache = os.path.join(HERE, '.fonts')
    os.makedirs(cache, exist_ok=True)
    out = os.path.join(cache, name)
    if not os.path.exists(out):
        f = TTFont(os.path.join(ROOT, 'fonts', woff2))
        f.flavor = None
        f.save(out)
    return out


def font(family, size, weight):
    from PIL import ImageFont
    path = (_ttf('cinzel-latin.woff2', 'cinzel.ttf') if family == 'cinzel'
            else _ttf('jakarta-latin.woff2', 'jakarta.ttf'))
    f = ImageFont.truetype(path, size)
    f.set_variation_by_axes([weight])
    return f


def tracked(draw, xy, text, fnt, fill, tracking=0.0, anchor_x='left'):
    """Letterspaced text. PIL has no tracking, so step glyph by glyph."""
    widths = [draw.textlength(ch, font=fnt) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x, y = xy
    if anchor_x == 'center':
        x -= total / 2.0
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += w + tracking
    return total


def lockup(img, box, mark_d, scale=1.0, tagline_lines=2):
    """Moon + wordmark, centred inside `box` = (x, y, w, h)."""
    bx, by, bw, bh = box
    title = font('cinzel', int(78 * scale), 600)
    sub = font('jakarta', int(27 * scale), 500)
    draw = ImageDraw.Draw(img)
    track = 5 * scale

    lines = ['UMMAHTI', 'QURAN']
    lead = int(88 * scale)
    text_w = max(sum(draw.textlength(c, font=title) for c in ln)
                 + track * (len(ln) - 1) for ln in lines)
    gap = int(64 * scale)
    total_w = mark_d + gap + text_w
    x = bx + (bw - total_w) / 2.0
    cy = by + bh / 2.0

    moon = render(icon_svg(bg=False, size=1024, mark_scale=0.92), mark_d / 0.92)
    img.alpha_composite(moon, (int(x - (moon.width - mark_d) / 2),
                               int(cy - moon.height / 2)))

    tx = x + mark_d + gap
    tail = (26 + 20 + 40 * tagline_lines) * scale if tagline_lines else 0
    ty = cy - (lead * len(lines) + tail) / 2.0
    for i, ln in enumerate(lines):
        tracked(draw, (tx, ty + i * lead), ln, title, IDENT['text'], track)
    if tagline_lines:
        ry = ty + lead * len(lines) + 26 * scale
        draw.line([(tx, ry), (tx + 96 * scale, ry)],
                  fill=IDENT['text_3'], width=max(1, int(2 * scale)))
        for i, line in enumerate((TAGLINE, TAGLINE_2)[:tagline_lines]):
            draw.text((tx, ry + (20 + 40 * i) * scale), line, font=sub,
                      fill=IDENT['text_2'])
    return img


# ------------------------------------------------------------------ exports

def build_icons():
    print('\nicons')
    rounded = icon_svg()                       # transparent corners, for the web
    full = icon_svg(shape='square')            # full bleed, for anything masked

    for px in (512, 192):
        save(render(rounded, px), 'icon-%d.png' % px)
    # A maskable icon keeps the mark inside the 80% safe circle Android crops to.
    save(opaque(render(icon_svg(shape='square', mark_scale=0.48), 512)),
         'icon-maskable-512.png')
    save(opaque(render(full, 180)), 'apple-touch-icon.png')

    for px in (16, 32, 48):
        save(render(rounded, px), 'favicon-%d.png' % px)
    ico = render(rounded, 48)
    save(ico, 'favicon.ico', ico=[(16, 16), (32, 32), (48, 48)])
    ico.save(os.path.join(ROOT, 'favicon.ico'),
             sizes=[(16, 16), (32, 32), (48, 48)])
    print('%9d  favicon.ico' % os.path.getsize(os.path.join(ROOT, 'favicon.ico')))


def build_play():
    print('\nplay store')
    # 512x512, 32-bit PNG, no transparency. Play applies its own rounding.
    save(opaque(render(icon_svg(shape='square'), 512)), 'play', 'icon-512.png')

    w, h = 1024, 500
    fg = render(panel_svg(w, h, mark=(0.190, 0.50, 292),
                          emerald_at=(0.18, 0.24, 0.80),
                          gold_at=(0.90, 0.92, 0.52)), w, h)
    fg = lockup_text_only(fg, (392, 0, w - 392 - 48, h), scale=0.90)
    save(opaque(fg), 'play', 'feature-graphic-1024x500.png')


def lockup_text_only(img, box, scale=1.0):
    """Wordmark alone, left-aligned in `box` — the moon is already on the ground."""
    bx, by, bw, bh = box
    title = font('cinzel', int(84 * scale), 600)
    sub = font('jakarta', int(28 * scale), 500)
    draw = ImageDraw.Draw(img)
    track = 6 * scale
    lead = int(94 * scale)
    lines = ['UMMAHTI', 'QURAN']
    ty = by + bh / 2.0 - (lead * len(lines)) / 2.0 - 46 * scale
    for i, ln in enumerate(lines):
        tracked(draw, (bx, ty + i * lead), ln, title, IDENT['text'], track)
    ry = ty + lead * len(lines) + 30 * scale
    draw.line([(bx, ry), (bx + 104 * scale, ry)], fill=IDENT['text_3'],
              width=max(1, int(2 * scale)))
    draw.text((bx, ry + 22 * scale), TAGLINE, font=sub, fill=IDENT['text_2'])
    draw.text((bx, ry + 66 * scale), TAGLINE_2, font=sub, fill=IDENT['text_2'])
    return img


def build_android():
    print('\nandroid launcher')
    # Adaptive icons are 108dp with only the middle 72dp guaranteed visible:
    # 0.635 of the visible area is 0.423 of the whole canvas.
    inner = 0.60 * (72.0 / 108.0)
    save(render(icon_svg(bg=False, mark_scale=inner), 432),
         'android', 'adaptive-foreground-432.png')
    save(opaque(render(panel_svg(432, 432), 432)),
         'android', 'adaptive-background-432.png')
    # Themed icons: one flat silhouette, tinted by the launcher.
    save(render(icon_svg(bg=False, mark_scale=inner, solid='#ffffff'), 432),
         'android', 'adaptive-monochrome-432.png')
    save(render(icon_svg(), 512), 'android', 'ic-launcher-512.png')


def build_social():
    print('\nsocial')
    # Profile picture: full bleed, and the mark sits well inside the circle
    # every platform crops to.
    avatar = icon_svg(shape='square', mark_scale=0.56)
    save(opaque(render(avatar, 800)), 'social', 'avatar-800.png')
    save(opaque(render(avatar, 512)), 'social', 'avatar-512.png')

    # YouTube channel art: 2560x1440, with only 1235x338 in the middle safe on
    # every device, so the whole lockup lives inside that.
    w, h = 2560, 1440
    banner = render(panel_svg(w, h, emerald_at=(0.30, 0.30, 0.62),
                              gold_at=(0.86, 0.86, 0.42)), w, h)
    banner = lockup(banner, ((w - 1235) // 2, (h - 338) // 2, 1235, 338),
                    mark_d=236, scale=0.95, tagline_lines=1)
    save(opaque(banner), 'social', 'youtube-banner-2560x1440.png')

    # X / Twitter header.
    w, h = 1500, 500
    header = render(panel_svg(w, h, emerald_at=(0.26, 0.28, 0.80),
                              gold_at=(0.88, 0.88, 0.55)), w, h)
    header = lockup(header, (0, 0, w, h), mark_d=248, scale=1.02)
    save(opaque(header), 'social', 'x-header-1500x500.png')


def build_og():
    print('\nsocial card')
    w, h = 1200, 630
    card = render(panel_svg(w, h, mark=(0.215, 0.50, 330),
                            emerald_at=(0.20, 0.26, 0.78),
                            gold_at=(0.90, 0.90, 0.50)), w, h)
    card = lockup_text_only(card, (438, 0, w - 438 - 64, h), scale=1.0)
    save(card, 'og.jpg', jpeg=True)


def build_logo():
    print('\nlogo')
    # The mark alone on transparency, for anywhere that has its own ground:
    # a video end card, a letterhead, a partner's page.
    svg = icon_svg(bg=False, size=1024, mark_scale=0.92)
    with open(os.path.join(BRAND, 'logo-moon.svg'), 'w') as f:
        f.write(svg)
    print('%9d  media/brand/logo-moon.svg'
          % os.path.getsize(os.path.join(BRAND, 'logo-moon.svg')))
    for px in (1024, 512):
        save(render(svg, px), 'logo-moon-%d.png' % px)


if __name__ == '__main__':
    build_icons()
    build_logo()
    build_play()
    build_android()
    build_social()
    build_og()
    print('\ndone')
