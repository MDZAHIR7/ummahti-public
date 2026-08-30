"""The Ummahti moon, taken apart into the two layers an icon needs.

media/brand/favicon.svg is one path in a 891x941 box, filled evenodd: a solid
crescent (the spine) followed by twenty filigree fragments that carve voids out
of it. Filled that way it draws the hairline moon the app has always used —
beautiful at full size, and gone by 48px.

So the two layers are separated here. SPINE is the solid crescent on its own,
including the hand-drawn taper at both tips; FILIGREE is the twenty fragments.
An icon fills the spine and lays the filigree over it as a soft engraving
rather than as holes, which keeps the mark solid at a launcher's size and
ornate at a store listing's.
"""
import os
import re

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   '..', '..', 'media', 'brand', 'favicon.svg')

_d = re.search(r' d="(.*?)" fill', open(SRC).read(), re.S).group(1)
SUBS = [s.strip() + ' Z' for s in _d.split('Z') if s.strip()]

SPINE = SUBS[0]
FILIGREE = ' '.join(SUBS[1:])
VIEWBOX = (891.0, 941.0)


def _bbox(d):
    pts = [(float(x), float(y)) for x, y in re.findall(r'(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)', d)]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


BBOX = _bbox(SPINE)


def place(cx, cy, size, optical=0.02):
    """Transform putting the moon's bounding box, `size` tall, at (cx, cy).

    The crescent's mass sits left of its own centre, so it is nudged right by
    a fraction of its size — optical centring, not geometric.
    """
    x0, y0, x1, y1 = BBOX
    s = size / max(x1 - x0, y1 - y0)
    return ('translate(%.3f,%.3f) scale(%.6f)'
            % (cx - s * (x0 + x1) / 2 + size * optical,
               cy - s * (y0 + y1) / 2, s))
