"""Ummahti brand compositions — icon, store art, channel art, social card.

The ground is the app's own splash. SplashBackground.kt draws VERSION_2,
"Twin Wells": obsidian, an emerald well upper-left, a gold well lower-right,
both anchored where the splash anchors them. Same structure, same hues, same
corners here — the icon is the splash seen small.

What changes is level. A splash owns a whole lit screen; an icon is 48px on
someone else's wallpaper, and at the splash's own alphas the wells vanish and
all that is left is a black square with something faint inside it — which is
exactly the complaint. So the two wells are re-lit (hue held, level raised)
until they carry the tile, while the corners stay obsidian.

The moon is the app's mark filled solid (mark.SPINE) with its filigree laid
over as an engraving, so it reads at 48px and stays ornate at 512.
"""
import colorsys
import math

from mark import FILIGREE, SPINE, place

S = 1024.0                 # design canvas; every size is a fraction of it


# --- the app's own colours ------------------------------------------------
# Color.kt via release/play-listing/build/tokens.py in the app repo.
OBSIDIAN = '#08080A'
SURFACE = '#14171F'
EMERALD = '#132A22'
GOLD = '#D4AF37'
GOLD_LIGHT = '#F5E6B3'
GOLD_DARK = '#8B6E2A'
TEXT = '#F0F0F5'
TEXT_2 = '#9CA3AF'


def _relight(hex_colour, lightness, saturation=None):
    """Re-light one of the app's colours: same hue, new level.

    The splash's emerald and gold are drawn to sit under a wordmark on a lit
    screen. Used unchanged in a 48px tile they read as black. Lifting toward
    white would grey them out, so the hue is held and only lightness (and
    saturation, where the colour needs to hold up small) is moved.
    """
    r, g, b = (int(hex_colour[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, _, s = colorsys.rgb_to_hls(r, g, b)
    r, g, b = colorsys.hls_to_rgb(h, lightness, s if saturation is None else saturation)
    return '#%02x%02x%02x' % (round(r * 255), round(g * 255), round(b * 255))


# Color.kt's MetallicGoldBrush, which is also the gradient in the logo SVG:
# dark at both ends, light across the middle, so the moon reads as struck
# metal rather than as flat yellow.
METALLIC_GOLD = [('0%', GOLD_DARK), ('24%', GOLD), ('52%', GOLD_LIGHT),
                 ('78%', GOLD), ('100%', GOLD_DARK)]


PALETTES = {
    # The shipping ground: the splash's twin wells, re-lit and re-weighted.
    # The emerald is opened out from the corner so it carries the tile; the
    # gold is tucked further into its corner so it lights the moon's underside
    # without swallowing it. Both stay where the splash puts them.
    'twin-wells': dict(
        base=[('0%', _relight(SURFACE, 0.11)), ('62%', _relight(OBSIDIAN, 0.05)),
              ('100%', OBSIDIAN)],
        # (colour, centre x, centre y, radius, alpha)
        emerald=(_relight(EMERALD, 0.30, 0.56), 0.30, 0.29, 0.93, 1.00),
        gold=(_relight(GOLD_DARK, 0.46, 0.64), 0.92, 0.90, 0.46, 0.95),
        gold_core=(GOLD, 0.92, 0.90, 0.24, 0.26),
        gold_stops=METALLIC_GOLD,
        # The filigree is engraved in a deep gold rather than in green, so the
        # moon stays gold all the way through at every size.
        ink=_relight(GOLD_DARK, 0.25, 0.62), ink_a=0.30,
        rim=GOLD_LIGHT, rim_a=0.55, halo=GOLD_LIGHT, halo_a=0.16,
        text=TEXT, text_2=TEXT_2, text_3=GOLD),
}


def squircle(size, n=5.0, steps=480):
    """Smooth-corner square (superellipse) filling `size`, as a closed path.

    A superellipse rather than a rounded rectangle: the curvature runs into
    the straight edges continuously, which is what makes a modern app icon
    look rounded rather than look like a square with its corners cut off.
    """
    a = size / 2.0
    pts = []
    for i in range(steps):
        t = math.tau * i / steps
        ct, st = math.cos(t), math.sin(t)
        x = a * math.copysign(abs(ct) ** (2.0 / n), ct)
        y = a * math.copysign(abs(st) ** (2.0 / n), st)
        pts.append('%.2f,%.2f' % (a + x, a + y))
    return 'M ' + ' L '.join(pts) + ' Z'


def _stops(stops):
    return ''.join('<stop offset="%s" stop-color="%s"/>' % s for s in stops)


def _well(name, spec, w, h):
    colour, cx, cy, r, alpha = spec
    return ('<radialGradient id="%s" cx="%.1f" cy="%.1f" r="%.1f" '
            'gradientUnits="userSpaceOnUse">'
            '<stop offset="0%%" stop-color="%s" stop-opacity="%.2f"/>'
            '<stop offset="52%%" stop-color="%s" stop-opacity="%.2f"/>'
            '<stop offset="100%%" stop-color="%s" stop-opacity="0"/>'
            '</radialGradient>'
            % (name, w * cx, h * cy, max(w, h) * r,
               colour, alpha, colour, alpha * 0.42, colour))


def _ground(w, h, p, wells=True):
    """The splash ground at any aspect: base wash, then the two wells."""
    defs = ['<linearGradient id="base" x1="%.0f" y1="0" x2="%.0f" y2="%.0f" '
            'gradientUnits="userSpaceOnUse">%s</linearGradient>'
            % (w * .15, w * .40, h, _stops(p['base']))]
    body = ['<rect width="%.0f" height="%.0f" fill="url(#base)"/>' % (w, h)]
    if wells:
        for name in ('gold', 'gold_core', 'emerald'):
            defs.append(_well(name, p[name], w, h))
            body.append('<rect width="%.0f" height="%.0f" fill="url(#%s)"/>'
                        % (w, h, name))
    return defs, body


def _mark(p, cx, cy, size, filigree=True, halo=True, solid=None):
    """The moon: solid spine, filigree engraved over it, a soft rim of light."""
    defs, body = [], []
    if halo:
        defs.append('<radialGradient id="halo" cx="%.1f" cy="%.1f" r="%.1f" '
                    'gradientUnits="userSpaceOnUse">'
                    '<stop offset="0%%" stop-color="%s" stop-opacity="%.2f"/>'
                    '<stop offset="58%%" stop-color="%s" stop-opacity="%.2f"/>'
                    '<stop offset="100%%" stop-color="%s" stop-opacity="0"/>'
                    '</radialGradient>'
                    % (cx, cy, size * .78, p['halo'], p['halo_a'],
                       p['halo'], p['halo_a'] * .35, p['halo']))
        body.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="url(#halo)"/>'
                    % (cx, cy, size * .78))
    body.append('<g transform="%s">' % place(cx, cy, size))
    if solid:
        body.append('<path d="%s" fill="%s"/>' % (SPINE, solid))
    else:
        defs.append('<linearGradient id="gold-fill" x1="80" y1="60" x2="820" '
                    'y2="880" gradientUnits="userSpaceOnUse">%s</linearGradient>'
                    % _stops(p['gold_stops']))
        # Stroking the spine with the rim colour puts half the width outside
        # the silhouette: a lit edge, without needing a second offset path.
        body.append('<path d="%s" fill="none" stroke="%s" stroke-opacity="%.2f" '
                    'stroke-width="26" stroke-linejoin="round"/>'
                    % (SPINE, p['rim'], p['rim_a']))
        body.append('<path d="%s" fill="url(#gold-fill)"/>' % SPINE)
        if filigree:
            defs.append('<clipPath id="spine"><path d="%s"/></clipPath>' % SPINE)
            body.append('<g clip-path="url(#spine)">'
                        '<path d="%s" fill="%s" fill-opacity="%.2f"/></g>'
                        % (FILIGREE, p['ink'], p['ink_a']))
    body.append('</g>')
    return defs, body


def _svg(w, h, defs, body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="%.0f" height="%.0f" '
            'viewBox="0 0 %.0f %.0f"><defs>%s</defs>%s</svg>'
            % (w, h, w, h, ''.join(defs), ''.join(body)))


def icon_svg(variant='twin-wells', size=S, shape='squircle', bg=True,
             mark_scale=0.60, filigree=True, halo=True, solid=None):
    """A square icon.

    shape='squircle' leaves the corners transparent, for anywhere the icon is
    shown as-is (the web, the manifest). shape='square' is full bleed, for
    everywhere that applies its own mask — Play, iOS, Android adaptive.
    """
    p = PALETTES[variant]
    d = size * mark_scale
    cx = cy = size * .5
    shape_d = (squircle(size) if shape == 'squircle'
               else 'M 0,0 H %.0f V %.0f H 0 Z' % (size, size))
    defs, body = [], []
    if bg:
        gdefs, gbody = _ground(size, size, p)
        defs += gdefs
        defs.append('<clipPath id="mask"><path d="%s"/></clipPath>' % shape_d)
        body.append('<g clip-path="url(#mask)">')
        body += gbody
    mdefs, mbody = _mark(p, cx, cy, d, filigree=filigree, halo=halo and bg,
                         solid=solid)
    defs += mdefs
    body += mbody
    if bg:
        body.append('</g>')
    return _svg(size, size, defs, body)


def panel_svg(w, h, variant='twin-wells', mark=None, filigree=True,
              emerald_at=None, gold_at=None):
    """A rectangle of ground — store graphics, channel art, social cards.

    `mark` is (cx_fraction, cy_fraction, size_px); pass None for ground only.
    The wells can be re-anchored per format, since a 1024x500 banner wants
    them somewhere other than a square does.
    """
    p = dict(PALETTES[variant])
    if emerald_at:
        p['emerald'] = p['emerald'][:1] + emerald_at + p['emerald'][4:]
    if gold_at:
        p['gold'] = p['gold'][:1] + gold_at + p['gold'][4:]
        p['gold_core'] = (p['gold_core'][0], gold_at[0], gold_at[1],
                          p['gold_core'][3], p['gold_core'][4])
    defs, body = _ground(w, h, p)
    if mark:
        mdefs, mbody = _mark(p, mark[0] * w, mark[1] * h, mark[2],
                             filigree=filigree)
        defs += mdefs
        body += mbody
    return _svg(w, h, defs, body)
