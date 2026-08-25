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
app.js              scroll, reveals, the search demo, the lighting model
vendor/lenis.min.js smooth scroll, self-hosted (the CSP forbids CDNs)
fonts/              Cinzel + Plus Jakarta Sans, subset to latin, with licences
media/screens/      app screenshots, WebP at 840w and 420w
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

## Two rules worth keeping

**Qur'anic text is never re-rendered in browser type.** Every ayah on the site
appears inside a real app screenshot, drawn by the app's own vetted font
pipeline. The site ships no Arabic webfont, so it cannot render scripture
wrongly on a device whose fallback font mishandles the harakat.

**The page must be complete without JavaScript.** Reveals, the pinned run and
the search demo are enhancements. With scripting off, or under
`prefers-reduced-motion: reduce`, every section renders in its final state and
the search demo falls back to the same examples as a list.

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
