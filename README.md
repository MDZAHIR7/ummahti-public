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
Run `python tools/check_experience.py` for the eight home/app pages' capture
dimensions, preview hooks, localized search controls and local-query guards
(this independent image check needs Pillow). The focused regression fixtures
execute the shipped controllers and local content:

- `node tools/test_guide_search.cjs`: reviewed Guide search and explicit selection.
- `node tools/test_guide_matching.cjs`: 812 actual-catalogue retrieval cases,
  including multilingual aliases, negation and identical hero/full ranking.
- `node tools/test_guide_answers.cjs`: complete 6,236-ayah index and corpus
  provenance, natural questions, Happy/negation, Arabic, synonyms/typos,
  references, context ranges, exploration and load recovery.
- `node tools/test_phone_handoff.cjs`: the single phone owner, scroll restoration,
  interruption, reversal, focus and resize behavior.
- `node tools/test_hifz_preview.cjs`: explicit example review, typed references,
  actual Quran boundaries, cancellation and audio/microphone traps.
- `node tools/test_hifz_hero.cjs`: the hero's canonical review/save/reset flows,
  explicit state choice, interruption and privacy boundaries.
- `node tools/test_preview_interactions.cjs`: both Guide catalogues, exact local
  ayah playback, source recovery, hero Hifz saves/reset, isolated workbench
  results, reciter request ownership/keyboard input and film/wall lifecycle.
- `node tools/test_library_and_moon.cjs`: every public dua/reflection in four
  locales, source/copy consistency, stale requests and moon-card recovery.
- `python tools/fetch_preview_recitation.py --check`: the 52 preview clips'
  source coordinates, sizes and SHA-256 digests; no requests or file changes.

Check changed interaction scripts with `node --check`, including
`node --check v15-phone-handoff.js` and `node --check v15-field-light.js`
when the phone or shared light helper changes.

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
- `v15-renders.js`, `v15-renders.css`: sized phone walkthroughs, named app
  moments and bounded preview interactions.
- `v15-phone-handoff.js`: the single owner of the retained hero-to-demo phone.
  Home/dock controls stay in their layout positions; the actual phone reparents
  first, then follows a bowed, gently banked, damped inverse-transform path
  over 680–850 ms. Reversal retains its current affine pose. A visible source
  waits until at least 64 px of the receiving slot is in view. Scroll
  hysteresis, restored anchors, top returns and resize use the same controller.
- `v15-handoff-craft.css`: the finite placement glint, receiving light cradle
  and source-backdrop recession, coordinated with that controller. Reduced
  motion and forced colors suppress the decorative flight light.
- `v15-hifz-refinement.css`: compact Hifz sheets and the explicit website
  walkthrough. It neither plays a reciter recording nor listens. Visitors
  review a known Quran passage or type a validated reference before saving in
  this page's example.
- `v15-guide.js`: reviewed topics and full-Quran answers in the source reader.
- `v15-guide-search.js`: one token/phrase matcher for the hero and full Guide.
  It searches reviewed titles, scenarios and keyword phrases, preserves
  negation, and cannot mistake `happy` for a substring in `unhappy marriage`.
- `v15-guide-answer.js`: the shared broader answer layer. Everyday questions
  resolve to reviewed guidance or cited Quran passages; Happy opens joy,
  gratitude and tranquillity, while not happy opens grief guidance. Local
  Arabic/English full-corpus retrieval includes synonyms, modest typo tolerance
  and neighbouring ayahs for context. Unclear wording offers sourced starting
  points and refinement rather than a blank answer. It generates no rulings.
- `tools/build_guide_index.py`: reproducible English/Arabic inverted index from
  the unchanged 114 corpus files, with 6,236 coordinates and source digests.
  The 2.17 MB script is loaded once on demand, never during ordinary startup.
  Search text is neither transmitted nor stored. There is no AI service.
- `v15-app-preview-nav.css`: the app's actual five labelled slots, own Guide
  vector and moving gold ring in all three interactive phone shells. Labels,
  selection, grabber and elevated pill follow HomeScreen/UmmahtiNavRail;
  `tools/prepare_preview_nav.py` exports the app geometry read-only. Navigation
  is decorative preview chrome; the named feature controls own the demo.
- `v15-preview-audio.js`: user-initiated playback of the exact selected/displayed
  ayah, with pause, progress, retry and one audible player at a time. Read and
  Unlock stay in their phone; scene changes and visibility stop playback.
  The hero preserves its chosen sample reciter across Read and Unlock.
- `v15-hifz-preview.js`, `v15-hifz-preview.css`: manual passage review in the
  retained hero phone, shared reference validation/overlap semantics, explicit
  state choice, stable saved result and local reset. Autoplay never saves or
  simulates speech recognition. The larger Hifz walkthrough starts empty.
- `v15-preview-controls.css`: local playback, feedback and recovery controls.
- `v15-field-light.js`, `v15-guide-light.css`: shared hero/full-Guide feedback
  following the inspected Frames mechanism: a masked full conic-gradient rim
  and matching blurred bloom. The current treatment uses a 2 px rim, 18 px
  bloom blur and 3.2 s rotation in theme-derived gold, warm white and emerald.
  Focus/typing keep it flowing; submit surges for 1,100 ms before a static
  settled rim. Blur, no match, offscreen/hidden state and reduced motion have
  explicit lifecycle handling. Local results never wait for the decoration;
  no AI backend is implied. This supersedes the earlier SVG dash passes.
- `v15-flow.js`, `v15-experience.css`: viewport-triggered arrivals that finish
  by time, responsive composition, header utilities and theme-aware light.
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
`WEBSITE-EXPERIENCE-20261021.md` records the current implementation, checks,
preserved boundaries and remaining release verification.
The owner rejected the earlier interaction finish on 22 October. The current
local iteration replaces the rejected travelling dash with a flowing full
colour rim and develops the phone placement beyond a straight transform.
Browser comparison and movement samples are recorded in the shared brain.
On 23 October the owner authorised release after a bug and breakage check.
That audit also added recovery for failed Guide sources, preserved focused
search ownership through phone placement, and corrected stale Hifz reference
results and overlapping passage counts. Preserved document heads now retain
their own sharing title/URL, and every draft locale page remains noindex.
Physical-device performance is a
separate validation surface from browser samples and fixtures.

The repository root is Cloudflare Pages' output directory. There is no build
command. Pushing main deploys; push only when the owner asks for a release.
Edit `tools/v15-home.html`, `i18n/v15.json` and `tools/i18n/v15-copy.tsv`, then
run `python tools/build_v15.py`, `python tools/check_v15.py` and
`python tools/check_site.py` before committing.
`updates/`, `ops/`, `emergency/` and `youtube/` are operational surfaces at
their existing URLs and remain untouched and `no-store`. Do not alter account,
email studio, Firebase, DNS or Play infrastructure for a website design change.
