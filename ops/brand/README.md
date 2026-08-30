# Brand exports

Everything under `media/brand/` is generated. Two inputs, nothing else:

- `media/brand/favicon.svg` — the moon, one path, 891×941.
- `fonts/*.woff2` — Cinzel and Plus Jakarta Sans, the app's own faces.

```
pip install pillow cairosvg fonttools brotli
python3 ops/brand/build.py
```

Edit `icons.py` and rebuild. Do not retouch the PNGs by hand — the next build
overwrites them.

## What the icon is

The old icon was the hairline moon on near-black. Correct on a dark page;
on a launcher grid or a store listing it was a dark square with something
faint inside it, which is what people were reacting to.

Two things changed, both of them levels rather than shapes:

**The moon is filled.** `favicon.svg` is a solid crescent (the spine)
followed by twenty filigree fragments that carve voids out of it under
`evenodd`. `mark.py` separates the two, fills the spine, and lays the
filigree over it as an engraving instead of as holes. Same drawing, same
tips — it just survives 48px now.

**The ground is the splash, turned up.** The app's `SplashBackground.kt`
draws `VERSION_2`, "Twin Wells": obsidian, an emerald well upper-left, a gold
well lower-right. The icon keeps that structure, those hues and those
corners, and re-lights the two wells — hue held, level raised — because the
alphas that model a full screen disappear in a 48px tile. Colours come from
`Color.kt`; the moon's gradient is `MetallicGoldBrush` unchanged.

## Where each file goes

| File | Goes to |
| --- | --- |
| `play/icon-512.png` | Play Console → Store listing → App icon |
| `play/feature-graphic-1024x500.png` | Play Console → Store listing → Feature graphic |
| `social/avatar-800.png` | YouTube, Instagram, X, Facebook profile picture |
| `social/youtube-banner-2560x1440.png` | YouTube → Customise channel → Banner |
| `social/x-header-1500x500.png` | X profile header |
| `android/adaptive-*-432.png` | The app's `ic_launcher` foreground / background / monochrome |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | `site.webmanifest` |
| `apple-touch-icon.png`, `favicon.*` | The site |
| `og.jpg` | `og:image` on every page |
| `logo-moon-*.png`, `logo-moon.svg` | The mark alone, for anything with its own ground |

Play, iOS and Android launchers all apply their own mask, so those exports
are full-bleed squares. The web ones carry their own rounded corners, since
nothing rounds them for us.

Safe areas are already respected: the YouTube lockup sits inside the
1235×338 that every device shows, and the Android foreground inside the
72dp of 108dp that no mask crops.
