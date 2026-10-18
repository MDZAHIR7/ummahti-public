# Ummahti Public

The static public website for Ummahti, its Quran app and official channels.
The published implementation is V1.5 (first deployed 19 October 2026 at the
owner's request). The earlier working website is preserved locally in
`.claude/before-v15-20261017.zip`.

## Open and check

Serve the repository root with `python -m http.server 4173 --bind 127.0.0.1`
and open http://127.0.0.1:4173/. No package installation or build is needed.

Run `python tools/build_v15.py` after changing the shared template or copy.
Run `python tools/check_v15.py` and `python tools/check_site.py` for source,
identity, locale, asset, fragment, structured-data and canonical checks.
`node --check v15.js` checks the interaction script syntax.

The existing localization entry points delegate to the V1.5 generator, so an
older translation command cannot put the previous page back over this design.
The generator preserves document bodies and refreshes their shared chrome.

## Public pages

`/` introduces Ummahti, the umbrella, with the Quran at its heart.
`/quran/` presents Ummahti Quran and the complete feature catalogue.
`/whats-new/`, `/support/`, `/contact/`, `/press/`, `/privacy/` and `/terms/`
share the same visual system. Existing meaningful root fragments still work.

Arabic, Urdu and Indonesian mirror these eight routes. Their roots are now
translated umbrella pages, with separate `/ar/quran/`, `/ur/quran/` and
`/id/quran/` app pages. They remain labelled drafts and `noindex,follow` until
native review. They are deliberately excluded from the eight-URL English
sitemap. The English legal wording remains operative.

The legacy `privacy-policy.html` and `PRIVACY_POLICY.html` URLs keep complete,
self-contained copies of the current policy for the GitHub Pages mirror used
by an older Play listing. Cloudflare redirects those URLs to `/privacy/`.
Do not replace them with refresh stubs: the mirror does not read `_redirects`.

## Current implementation

- `tools/v15-home.html`: the shared home/app story and demonstrations.
- `v15.css`: editorial composition, responsive layout, controls and sheets.
- `v15.js`: examples, native-scroll navigation, themes, gallery, media lifecycle
  and interruptible detail sheets. No new framework or animation dependency.
- `styles.css`: the existing twelve app palettes and original reciter system.
- `theme.js`: restores the validated theme before paint using `ummahti:theme`.
- `sky.js`: the approved ambient room, called by V1.5's single lifecycle loop.
- `verse.js`: the original native snapping wheel, local sample playback and
  supported haptics. Withdrawn duplicate Minshawi Mujawwad is not listed.
- `i18n/v15.json`, `tools/i18n/v15-copy.tsv`: shared website copy.
- `media/v15/`: current app captures, authoritative verse examples, release
  wording, licensed Amiri font and the owner's newest full app film.
- `media/brand/2026-10-17/`: the exact complete app logo and original formation.

V1.5 does not load `app.js`, Lenis, `hub.js`, `hub.css` or `editorial.css`.
Those earlier files remain preserved. Page scrolling is native. Autoplay is
muted and controllable, and stops offscreen/hidden; reduced motion and data
saving default to still content. Deliberate audio playback has its own control.

The approved full Amiri Regular 1.002 is paired with `textUthmani`, as in the
app's verified QuranScriptRegistry. Selected Quran text comes verbatim from
the corpus, not authored promotional copy. The derivative tool checks glyph
coverage and retains the font licence. English example translations are named
Saheeh International and marked `lang=en`/`dir=ltr` on translated pages.

## Evidence and maintenance

`tools/prepare_v15.py` reads the latest local Android trees without changing
them. It exports source counts, selected verses, localized release text and
genuine capture derivatives; it also converts the approved full font to WOFF2.
It needs Pillow, fontTools and Brotli, already available locally. It is an
asset-preparation tool, not a deployment build. Paths are recorded in the file.
Owned film derivatives are prepared separately; provenance is in
`media/v15/SOURCES.md` and `media/brand/2026-10-17/SOURCES.md`.

`V15-DESIGN.md` records the story, preservation decisions and applied skills.
`V15-REVIEW.md` records actual verification and remaining limits.
`brand-spec.md` describes the current identity and visual rules.
`SEARCH-AND-IDENTITY.md` records the entity corrections and free rollout work.

The repository root is Cloudflare Pages' output directory. There is no build
command. Pushing main deploys; push only when the owner asks for a release.
Edit `tools/v15-home.html`, `i18n/v15.json` and `tools/i18n/v15-copy.tsv`, then
run `python tools/build_v15.py`, `python tools/check_v15.py` and
`python tools/check_site.py` before committing.
`updates/`, `ops/`, `emergency/` and `youtube/` are operational surfaces at
their existing URLs and remain untouched and `no-store`. Do not alter account,
email studio, Firebase, DNS or Play infrastructure for a website design change.
