# Ummahti Public

Public website and operational publishing surface for Ummahti Quran.

Framework-free static site deployed with Cloudflare Pages. The repository root
is the Pages output directory; there is no build command and no dependency
install. Editing a file and pushing is the whole deploy.

Public routes: `/`, `/privacy`, `/terms`, `/support`.

The `updates/`, `ops/`, `emergency/` and `youtube/` machine-readable paths
remain at their original URLs and are served `no-store`.

## Layout

```
index.html          the landing page
styles.css          the whole design system, one file
theme.js            restores the reader's theme, and marks the first page of
                    a visit, both before the first paint
sky.js              the room, drawn on the GPU when the device can take it
app.js              scroll, reveals, the search demo, the lighting model,
                    the theme picker
vendor/lenis.min.js smooth scroll, self-hosted (the CSP forbids CDNs)
fonts/              Cinzel + Plus Jakarta Sans, subset to latin, with licences
media/screens/      app screenshots, WebP at 840w and 420w
media/scripts/      Al-Faatiha set once per Arabic script, WebP at 720w and 420w
media/brand/        crescent mark, favicons, social card
```

## Where the assets come from

Nothing here is a mockup.

- **Screenshots** are rendered by `release/play-listing/build/` in the app
  repository — the same generator that produces the Play Store listing, from
  the app's own tokens and strings. Rebuild with `make_web_screens.py` then
  `render_web_screens.mjs`, and convert to WebP at 840w and 420w.
- **Typefaces** are the binaries the app itself draws with, taken from
  `app/src/main/res/font` and subset to latin. Both are SIL OFL 1.1; the
  licence text travels with them in `fonts/`.
- **Colours** are the Obsidian theme's own hex values, and the nine theme
  swatches are that theme list verbatim.
- **The crescent** is the launcher mark from `docs/design_provenance/`.
- **Search examples** are documented behaviours of the real search engine.
  Surah names use the spellings in `app/src/main/assets/quran_data.json`.
- **The four script pages** are rendered by `make_script_pages.py`. It does not
  choose its own pairings: which font goes with which orthography comes from
  `QuranScriptRegistry.kt` (that registry exists so a face is never paired with
  the wrong text) and the per-face leading comes from the measured policy in
  `ReaderSettings.kt`.
- **The nine themes are readable, not just shown.** Each one is a block of
  tokens in `styles.css` whose background, surface, accent, secondary and text
  are the app's own values — the same five the swatches display. The rest of a
  theme (the accent's readable tint, the muted text, the button gradient) is
  derived from those five rather than picked, so a palette here cannot drift
  from the palette there.

## The themes

`[data-theme]` is a block of tokens and nothing else, which means it works on
the document and equally on one subtree. Both are used:

- The header picker puts a theme on `<html>`, so the whole site is read in it.
  The choice is kept in `localStorage` under `ummahti:theme` and restored by
  `theme.js`, which is the only render-blocking script on the page — the CSP
  allows no inline script, and a deferred restore is a flash of the wrong
  theme. It validates the stored name against the shipped list rather than
  trusting it.
- The themes section carries `data-theme` on the panel itself, so it *is* a
  theme rather than a hand-painted light section. Which one is decided by
  contrast: a pale theme while the page is dark, a dark one while the page is
  pale. The argument the section makes therefore survives the reader having
  already chosen a theme of their own.

Polarity is five scalars, not a second stylesheet. A light theme wants a white
specular rather than a gold one (`--glow-rgb`), wants it stronger (`--spec-k`)
because white on cream is invisible at the alphas that model a dark surface,
and wants far less black in its shadows (`--shadow-k`); `--amb-a`, `--grain-a`
and `--moon-a` dim the room's own layers. They are restated per theme rather
than inherited, so a dark theme shown inside a light page is still modelled
with a dark page's light.

Adding a tenth theme is a token block in `styles.css`, its name in the `THEMES`
list in `app.js` and `theme.js`, and a card in `index.html`.

## The room

`styles.css` builds the room behind the page out of three radial gradients.
When the device can take it, `sky.js` draws the same room in a fragment
shader instead — one fullscreen triangle, written by hand, no library, about
5 KB gzipped against the 170 KB a 3D library would have cost for the same
picture. The light has volume because the glow is sampled through noise on
the way out from its source rather than being a clean radial; dust hangs in
the beam and is only drawn where there is light to catch it. Its colours are
read back off the document, so the room changes light with the theme.

It draws from `app.js`'s loop rather than starting a second one, so the page
still has exactly one rAF.

It declines to run, and the gradients simply stay, when: the reader asked for
less motion, the connection is metered or slow, the device reports few cores
or little memory, WebGL is missing, the context is lost, or — the case none
of those catch — the page cannot hold about thirty frames a second with it
running. That last verdict is reached on a stopwatch rather than a frame
count, so a slow device is not made to struggle for twenty seconds before
being let off.

The canvas lives inside `.sky`, which is already `aria-hidden`, and touches
no content, so there is never anything for a fallback to restore but the
gradients.

## Two rules worth keeping

**Qur'anic text is never re-rendered in browser type.** Every ayah on the site
appears inside a real app screenshot, drawn by the app's own vetted font
pipeline. The site ships no Arabic webfont, so it cannot render scripture
wrongly on a device whose fallback font mishandles the harakat.

**Motion is never load-bearing.** The page turn in the mushaf section, the
opening, the counted figures, the lean on the buttons and the whole GPU room
are all things the page does *as well as* saying what it says. Every one of
them is off under `prefers-reduced-motion: reduce`, and the section still
reads. The opening in particular never holds the content back: the words and
the install button are painted at their final position on the first frame,
and it is the room that arrives.

**The page must be complete without JavaScript.** Reveals, the pinned run, the
search demo, the counted figures and the theme picker are enhancements. With
scripting off, or under `prefers-reduced-motion: reduce`, every section renders
in its final state, the search demo falls back to the same examples as a list,
and the figures are simply the numbers in the markup. Controls that cannot work
are not shown rather than shown dead: the picker is `hidden` until `app.js`
reveals it, and the nine theme cards ship as `<div>`s and are replaced with real
buttons only once there is something to press.

## Checking a change

Serve the directory and run the two scripts in the app repository's
`release/play-listing/build/`:

```bash
python -m http.server 4173
```

`shoot_site.mjs` captures desktop, laptop and phone widths and reports console
errors and failed requests. `verify_site.mjs` checks the no-JS and
reduced-motion states, keyboard focus, alt text, heading structure and first
load weight.
