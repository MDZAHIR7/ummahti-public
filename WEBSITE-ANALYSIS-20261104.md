# Ummahti website: deep analysis — 4 November 2026

Scope: the live site at ummahtiofficial.com and this repository at commit
`85c5c19`. Methods: source review of every root script and stylesheet, the
generator and the deploy workflow; live header and route probes; Playwright
runs at 1440×900, 820×1180 and iPhone 13 width on `/`, `/quran/`, `/ar/`,
`/ur/`, `/support/`, `/contact/` and a missing URL; Lighthouse 12 (mobile and
desktop) on `/` and `/quran/`; and the same Playwright capture of apple.com,
apple.com/iphone, samsung.com/us and quran.com for comparison.

Nothing in this document changes the site. It is an assessment with a
prioritised plan at the end.

## 1. Verdict in one page

The site is far above the typical app landing page. Its visual identity is
distinctive and coherent: one crescent drawn from all 6,236 ayat, thirty moons
for a Hijri month, a star map of the 86 Guide topics, tonight's moon computed
in the browser, twelve reading themes, four locales with proper RTL, and three
interactive phone previews running on the real Quran corpus and real
recitation. The security posture is stronger than Apple's or Samsung's: no
third-party scripts, no cookies, no trackers, a strict Content Security
Policy, and nothing leaves the browser.

Three things hold it back from the professional tier the owner is aiming at.

1. **Mobile performance.** Lighthouse mobile scores 36/100 on the home page.
   Largest Contentful Paint is 7.3 s, Total Blocking Time is 3.0 s, Time to
   Interactive is 9.3 s. Apple and Samsung pages of similar weight render
   their first screen in about a second. The cause is not the media; it is
   32 unbundled scripts, 12 stylesheets, a 3,375-element DOM, and four canvas
   or WebGL systems that initialise on load.
2. **The home page tries to be the whole app.** It is 25,922 px tall on
   desktop (29 screens) and 31,234 px on a phone (37 screens), with 20
   sections, 23 H2 headings, 3,784 words and 654 buttons. Apple's home page
   is 5,885 px. Guide is demonstrated four times on one page; Unlock and Hifz
   twice each. `/quran/` is a byte-for-byte copy of the home page body.
3. **Loose ends from the earlier design.** The 404 page still uses the
   pre-V1.5 design and navigation, with Terms-of-Use sharing metadata. The
   legacy 144 KB stylesheet is still loaded on every page though only 31 of
   its classes are used. Cloudflare's analytics beacon is injected and then
   blocked by the site's own CSP on every page view. Internal documentation,
   Python tooling and the GitHub workflow are served publicly from the web
   root.

Scores measured on 4 November 2026 (Lighthouse 12, simulated throttling):

| Page / device | Performance | Accessibility | Best practices | SEO | LCP | TBT | TTI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` mobile | 36 | 100 | 93 | 92 | 7.3 s | 3,000 ms | 9.3 s |
| `/` desktop | 68 | 97 | 93 | 92 | 1.2 s | 590 ms | 2.3 s |
| `/quran/` mobile | 39 | 100 | 93 | 92 | 7.3 s | 1,820 ms | 7.8 s |

Accessibility and SEO are already professional. Performance is the gap.

## 2. How the interactive phone frames work

The owner asked how the "frames of the Quran" with a working app inside were
built. There is no emulator, no embedded app, no iframe, no video and no
server. It is a hand-built web re-creation of four app moments, written in
plain HTML, CSS and JavaScript, fed by the same Quran text and audio the app
ships. The pieces:

**The frame itself.** `.r-device` and `.r-gh-screen` in `v15-renders.css`
are ordinary `div`s. The bezel is padding, the corner radius is a fraction of
the width, the glass reflection is a `::after` gradient, and the side button
is a `::before`. The screen is a 9:19.5 box with `overflow: hidden`. Every
font size inside the phone is set in `cqw` (container query width units), so
the "app UI" scales with the frame instead of being a bitmap. The phone
behind it is a static WebP screenshot.

**The scenes.** Inside one screen are four `.r-scene` blocks: Guide, Read,
Unlock and Hifz. `v15-renders.js` toggles `is-on` between them, auto-cycles
with a pause/next control, and hands control to the visitor when they choose
a scene. The bottom navigation bar is a copy of the Android app's real
five-slot rail; its geometry was exported from the Kotlin source by
`tools/prepare_preview_nav.py`.

**Real content without a backend.** The CSP forbids `fetch`, so data is loaded
as scripts: `/media/v15/quran/s001.js` … `s114.js` hold the Arabic and the
Saheeh International translation, loaded one surah at a time on demand. The
86 reviewed Guide topics are in `media/v15/guide-en.js` (57 KB). Broad
questions load a 2.17 MB inverted index of every ayah
(`media/v15/guide-index.js`) once and search it locally; the field light and
results never wait on a network. The "Read" and "Unlock" scenes play clips
from `/media/recitation/preview/` by two reciters.

**The micro-interactions.** Pointer tilt sets `--rx`/`--ry` custom properties
on the device and CSS applies a small 3D rotation. Arabic text is split into
word spans and revealed with a staggered delay. The search field's flowing
rim is a conic gradient on a pseudo-element, masked to a 2 px ring, with a
second blurred copy as a bloom; a registered `@property --u-light-angle` is
animated with the Web Animations API so the rotation runs on the compositor.
Detail sheets are a native `<dialog>` with a drag handle and a damped spring
release written by hand in `v15.js`.

**The phone that travels.** This is the most unusual piece. There is one
phone DOM node. `v15-phone-handoff.js` watches scroll position; when the
"Take control" section comes into view it moves that node from the hero
slot into the dock slot, measures the old and new rectangles, and animates
the inverse transform from the old position to the new one (the FLIP
technique). It samples 33 affine matrices along a bowed, slightly banked
path with a critically damped settle, over 680–850 ms, and plays them with
`element.animate`, so the browser's compositor does the work and no
JavaScript runs during the flight. Scrolling back reverses it, preserving
whatever pose it was in. Focus and typed text survive the move.

**Why it feels like the real app.** Because it runs on real data and real
audio and reacts within a frame, not because it is the app. The honest
statement on the page ("A small experience to try here") is correct. Apple
achieves a similar feeling differently: product pages use pre-rendered image
sequences or video scrubbed by scroll, which cost almost no main-thread time.
Ummahti's approach is more alive and more honest; the price is the CPU cost
measured in section 4.

## 3. Security

### 3.1 What is right

- Headers on every route: HSTS (1 year, includeSubDomains), nosniff,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
  denying camera, microphone, geolocation, payment and USB.
- CSP: `default-src 'self'; script-src 'self'; connect-src 'none';
  object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors
  'none'; upgrade-insecure-requests`. No inline scripts, no event-handler
  attributes, no `eval`. Every `innerHTML` call in the shipped scripts takes
  either static markup or text passed through an escape function.
- No forms submit anywhere. No cookies. `localStorage` holds only a theme id
  that `theme.js` validates against a whitelist before applying it, a hero
  ayah index and a dismissed-bar flag.
- External links that open a new tab carry `rel="noopener"`.
- The generator HTML-escapes every piece of feed data (video titles,
  labels) before it reaches a page, and re-encodes downloaded thumbnails
  through Pillow rather than serving the original bytes.
- No credentials in the 66-commit history. The repository name and contents
  are separated from the Android source.
- Directory listings and `.git` are not exposed.

### 3.2 Findings

**S1. Internal documentation and tooling are served publicly.** Medium.
The repository root is the Cloudflare Pages output directory, so these are
live: `/README.md`, `/WEBSITE-EXPERIENCE-20261021.md`,
`/INTERACTION-AUDIT-20261023.md`, `/tools/build_v15.py`,
`/tools/refresh_channels.py`, `/.github/workflows/channels.yml`,
`/.gitignore`, `/i18n/v15.json` (184 KB of source copy),
`/media/v15/SOURCES.md`. They describe internal process, local file paths,
the ops tooling (`UmmahtiOps.java`), which secrets the workflow expects and
the owner's review history. None of it is a credential, but it hands anyone
a complete map of the build. Fix: set the Pages project's build output
directory to a subfolder (for example `site/`) and keep docs and tools
outside it. Cloudflare Pages `_redirects` cannot return 404, so this is the
clean route. This document, if merged as-is, will be served too.

**S2. The app's remote-control channel is four static text files.** Medium,
unverifiable here. `/ops/state.txt`, `/updates/latest.txt`,
`/emergency/state.txt` and `/youtube/state.txt` are read by the Android app;
their comments say commands and update manifests are "minted" and "signed"
by `UmmahtiOps.java`. If the app verifies a signature against a pinned public
key, checks a timestamp or nonce against replay, and ignores unsigned
content, this design is sound. If any of those is missing, anyone who can
push to this repository or log in to the Cloudflare account can push a
command or an update manifest to every installed app. The app code is not
in this repository, so this could not be checked. Confirm all three
properties in the app, and keep the signing key off the machines that can
push to `main`.

**S3. A daily bot commits straight to production without review.** Medium.
`.github/workflows/channels.yml` has `contents: write`, scrapes YouTube
pages with regular expressions, downloads thumbnails, rebuilds every page,
runs the checkers and pushes to `main`, which Cloudflare deploys. Inputs are
escaped and images are re-encoded, which is good. The remaining exposure is
the pipeline: `actions/checkout@v4` and `actions/setup-python@v5` are pinned
to moving tags, not commit SHAs; Pillow parses untrusted image bytes; and a
compromised action, dependency or scrape would reach production within one
run. Fix: pin actions to SHAs, enable branch protection on `main`, have the
bot push to a `channels` branch and open a pull request with auto-merge after
checks, and scope the token to that branch.

**S4. Cloudflare Web Analytics is enabled but blocked by the CSP.** Low, but
noisy. Cloudflare injects `static.cloudflareinsights.com/beacon.min.js`
into every HTML response; `script-src 'self'` blocks it, so every page view
logs a console error and no analytics are collected. Decide one way: turn
Web Analytics off in the Cloudflare dashboard, or allow
`https://static.cloudflareinsights.com` in `script-src` and
`https://cloudflareinsights.com` in `connect-src` and update the privacy
policy, which currently promises nothing leaves the browser.

**S5. `style-src 'unsafe-inline'`.** Low. Needed only for a handful of inline
`style="background-image: …"` and `style="--nav-active: …"` attributes. With
`script-src` this strict the practical risk is small; moving those values to
data attributes and CSS would let the directive be dropped.

**S6. `Access-Control-Allow-Origin: *` on HTML.** Low. Harmless on a static
site, unnecessary, and it suggests a broad Cloudflare rule. Remove it.

**S7. The 404 page runs the legacy stack.** Low. It loads `vendor/lenis.min.js`,
`app.js` and `theme.js` twice. Keeping a third-party scroll library alive on
one page for no reason widens the surface and the maintenance burden. Rebuild
the page on the V1.5 template (see 5.8) and delete the vendor folder.

**S8. No `/.well-known/security.txt`.** Low. Add one naming
`contact@ummahtiofficial.com`, a policy line and an expiry, so researchers
have a route other than public issues.

**S9. Cache headers do not match `_headers`.** Low, operational. The file
asks for `max-age=600` on scripts and styles; the live responses carry
Cloudflare's default `max-age=14400`. Because every asset already carries a
version query (`?v=20261025r1`), the right setting is
`max-age=31536000, immutable` on versioned assets and short on HTML. Reconcile
the file with what Cloudflare serves so nobody relies on a rule that is not
in effect.

## 4. Performance

Numbers are from Lighthouse 12 and the Playwright runs; the simulated mobile
is a mid-range Android on slow 4G, which is the device most of the Ummah
reads on.

| Measure | `/` mobile | `/` desktop | Apple home | Apple iPhone page | Samsung US home |
| --- | --- | --- | --- | --- | --- |
| Requests to load | 84 | 92 | 48 | 51 | 95 |
| Transfer | 1.6 MB | 2.1 MB | 1.7 MB | 1.9 MB | 2.3 MB |
| DOM elements | 3,372 | 3,375 | 1,965 | 2,978 | 3,922 |
| Page height | 31,234 px | 25,922 px | 7,043 px | 15,735 px | 7,273 px |
| Script files | 32 | 32 | — | — | — |
| Stylesheets | 12 | 12 | — | — | — |
| Main-thread work | 13.5 s | 4.2 s | — | — | — |
| Long tasks | 20 | 12 | — | — | — |

The weight is comparable to Apple and Samsung; the work is not. Where the
time goes on mobile, by script, from Lighthouse's bootup breakdown:

| Script | Main-thread total | Of which scripting |
| --- | --- | --- |
| `v15.js` | 5,032 ms | 73 ms |
| `v15-moon.js` | 2,603 ms | 1,202 ms |
| `sky.js` (WebGL room) | 1,176 ms | 309 ms |
| `v15-flow.js` | 1,003 ms | 165 ms |
| `v15-renders.js` | 711 ms | 545 ms |

`v15.js` spends almost all of its 5 s not in its own code but in style and
layout it triggers: it reads and writes the whole page (3,375 elements, 12
stylesheets) on start. The mobile LCP element is the hero Arabic ayah; it
waits for three render-blocking stylesheets, then for the 146 KB Amiri font.
On desktop LCP is the hero screenshot at 1.2 s, which is fine.

Other concrete waste Lighthouse itemised:

- `styles.css` (144 KB raw, 39 KB compressed) is the pre-V1.5 stylesheet.
  Of its 361 classes referenced from the home page, only 31 come from this
  file; the rest of it is dead. It is render-blocking on every page.
- Unminified JS and CSS: about 35 KB of avoidable transfer, and a larger
  parse cost.
- Responsive images: the channel tiles ship 360×640 WebPs into 145–180 px
  slots (251 KB avoidable on mobile, 416 KB on desktop). `moon-1600.webp`
  (420 KB) loads on desktop even though the moon is drawn on a canvas.
- No long-lived cache on any versioned asset (see S9), so a returning
  visitor re-validates 44 files.
- Four independent drawing systems can run at once in the first screens:
  the WebGL sky, the Guide globe canvas in the phone, the 6,236-point moon
  canvas and the arrival animations in `v15-flow.js`. Each is well behaved
  on its own (they stop offscreen and when hidden); together they contend
  for one main thread.

What to do, in order of payoff:

1. **Split the home page** (section 5.1). Fewer sections means fewer DOM
   nodes, fewer scripts and only one or two live canvases per route. This
   is the single largest win and also the right product decision.
2. **Bundle and minify.** One stylesheet and one or two scripts per route,
   built by the existing Python generator. Drop `styles.css` in favour of a
   tokens-only file extracted from its theme blocks. Target under 10
   script requests on the home page.
3. **Defer the heavy visualisations.** Load `v15-moon.js` and its data, the
   star map and `v15-renders.js` only when their section is within one
   screen, with `IntersectionObserver` and dynamic `<script>` insertion
   (the pattern the surah loader already uses). Add
   `content-visibility: auto` with `contain-intrinsic-size` on every
   below-the-fold section; it is not used anywhere today and would remove
   most of the 2.2 s of style and layout on mobile.
4. **Fix the LCP path.** Inline the critical CSS for the hero, preload the
   hero screenshot, and subset Amiri to the glyphs the hero ayat use for a
   small first font (full Amiri can follow). Set a `size-adjust`
   fallback so the ayah does not reflow when the font lands.
5. **Images.** `srcset` on the channel tiles and screenshots; drop
   `moon-1600.webp` where the canvas replaces it.
6. **Caching.** Immutable one-year headers on versioned assets.
7. **Measure on a real phone.** The existing docs say physical-device
   validation is pending. A Pixel 6a or Galaxy A-series run of the home
   page, with the Chrome performance panel, should be the acceptance test
   for every release.

Target after steps 1–4: mobile performance above 85, LCP under 2.5 s, TBT
under 300 ms. That is achievable without touching the visual design.

## 5. Design, UI and UX against the best sites

### 5.1 Structure: a landing page, not a brochure of everything

Apple's home page is a stack of six to eight tiles. Each is one headline,
one line, two links and a picture; depth lives on the product page. The
iPhone product page is long, but it is one product told once, with a
sticky in-page navigation ("Overview · Tech Specs · Compare · Buy").
Samsung's home page is a carousel of offers and three rows of product
categories. Neither repeats a feature.

The Ummahti home page tells the same stories several times:

| Feature | Appears on `/` as |
| --- | --- |
| Guide | Hero phone · Star map · Workbench tab · FAQ |
| Ayah on Unlock | Hero phone · "Take control" dock · "Every unlock, an ayah" with its own phone |
| My Hifz | Hero phone · "Take control" dock · "A few ayahs here" with its own phone |
| Read / recite | Hero phone · reciter wheel · "Hear the ayah of One Ummah" |
| Moon / Khatm | Crescent · Thirty parts · Month of nights · My Khatm · Tonight's moon |

And `/quran/` repeats the whole thing again with a different title. The
site's own header link "Explore Quran" points to `/#inside`, not to
`/quran/`. Search engines are shown two canonical URLs with identical
bodies, which they will fold or penalise.

Recommendation:

- `/` becomes a short cinematic landing: hero with the interactive phone,
  then five tiles (Guide, Read and listen, Ayah on Unlock, My Hifz, Watch
  and listen), then tonight's moon, then the close. Under eight screens on
  desktop.
- `/quran/` becomes the deep product page: the four full demonstrations,
  one each, the gallery of captures, the theme picker, the FAQ, with a
  sticky in-page nav like Apple's.
- The moon story (crescent, thirty parts, month of nights, Khatm pace)
  becomes its own page, `/moon/` or `/khatm/`. It is the most original
  thing on the site and deserves a URL people can share.
- Each demonstration exists once. The "Take control" dock either replaces
  the hero chooser or is removed; keeping both within two screens is the
  main source of the "it keeps repeating" feeling.

### 5.2 First screen on a phone

On a 390×844 phone the hero is text only. The interactive phone starts at
849 px, below the fold, and when it arrives it is partly covered by the
cropped back phone at the left edge. On apple.com the product is always in
the first screen on mobile, usually above the headline. Put a smaller phone
or the top half of it in the first viewport on narrow screens, or lead with
the app film's poster. The "Step inside the moon" link is a good scroll
invitation; keep it.

### 5.3 Typography

The site mixes four faces: Cinzel for the wordmark, Georgia for display
headings, Plus Jakarta Sans for body and Amiri for Arabic. Apple uses one
family at several weights; Samsung uses two of its own. Georgia at 70 px
looks acceptable but reads as a system default and does not match Cinzel's
Roman capitals. Choose one editorial serif for headings that pairs with
Amiri (Fraunces, Newsreader or a licensed Caslon would all work) and keep
Cinzel only for the wordmark.

The type floor is too low. 280 text nodes on the desktop home page are set
under 12 px: 10 px kickers, 11 px captions, 10–11 px controls inside the
demos. Apple's smallest text is 12 px and that is reserved for footnotes;
body copy is 17–21 px. Raise the floor to 12 px, cut the number of captions,
and move the explanatory small print into the detail sheets that already
exist.

### 5.4 Motion and micro-interactions

This is where the site already competes. The phone flight, the rim light,
the word-by-word Arabic reveal, the dragged sheet with a spring release, the
view-transition theme crossfade and the pointer tilt are the kind of details
Apple is known for, and most are implemented the right way (compositor-only
transforms, reduced-motion handling, cancellation when hidden).

Two adjustments would make them feel more expensive, not less:

- **One moment per section.** Apple runs one scroll-driven animation per
  chapter and nothing else moves. Here the sky, the globe and the moon can
  all be alive together. Give each section one live element and let the sky
  pause whenever another canvas is in view.
- **Scroll-driven, not time-driven, where it tells a story.** The thirty
  parts and Khatm formations already follow scroll; the arrival fades
  (`v15-flow.js`) finish by timer. Modern CSS `animation-timeline: scroll()`
  and `view()` would run these on the compositor with no JavaScript and no
  long tasks, with a JS fallback for older browsers.

### 5.5 Continuity

The travelling phone is a true continuity device, the same idea as Apple's
product persisting across sections or Samsung's sticky hero video. It works
on desktop. It is undercut by the dock showing the same four scene buttons
again and by two further phones for Unlock and Hifz lower down. If the
phone is the protagonist, let it be the only phone: it flies from the hero
to each feature chapter in turn, and the chapters change what is on its
screen. That is one node and one controller, which the current code already
supports.

### 5.6 Navigation and header

Desktop header: three in-page anchors, two social icons, a "Film sound"
toggle, a twelve-item reading-theme menu, a language menu and the Play
badge. The film-sound control is page state in the global header; move it
onto the film. The twelve reading themes are an app setting, not a website
control; Apple and Samsung offer only light and dark. Keep Light/Dark (and
"match the app") in the header, and keep the full twelve inside the "Twelve
lights to read by" demonstration where they are the content. The mobile menu
is clean. The `/` keyboard shortcut to the Guide is a nice touch; mention it
in the Guide hint.

### 5.7 Empty space that reads as broken

Two places render as large blank areas while something loads: the film
section before `app-film.mp4` (preload none) and the crescent section on
mobile where the canvas sits above the headline. Give the film its poster
(`app-film.webp` exists) at the right aspect ratio and let the canvas section
reserve its height. A blank screen on a slow connection looks like a bug,
not like calm.

### 5.8 The 404 page and other consistency gaps

- The 404 page is the pre-V1.5 design: Cinzel capitals, a different header
  with "The Mushaf" and "Search" links that point to anchors the V1.5 home
  no longer has, the old theme picker and a "Get Ummahti" button. Its Open
  Graph tags advertise "Terms of Use". Rebuild it from the V1.5 template.
- Support page: "Ummahti on YouTube" breaks across three lines at 1440 px
  while its siblings take two. Shorten to "On YouTube".
- The scene chooser says "Ummahti Guide" and "My Hifz" in English on the
  Arabic and Urdu pages while the other two labels are translated.
- The screenshots inside the phones are English on every locale.
- Urdu renders in a Naskh fallback. The stylesheet names "Noto Nastaliq
  Urdu" but the font is not shipped, so Urdu readers see the wrong script
  style. Ship a subset of Noto Nastaliq Urdu or Gulzar on `/ur/` only.
- The Google Play badge is the one element that ignores the reading theme
  (a black box on Warm Cream). Google provides a light-background badge.

### 5.9 Accessibility

Strong. Lighthouse 100 on mobile and 97 on desktop; every image has alt
text; buttons have names; the dialog traps focus; focus rings are visible;
reduced motion and forced colours are handled; Arabic and Urdu set `lang`
and `dir`. Remaining items: Lighthouse flags the kicker, lead and caption
text in the "Thirty parts" chapter for contrast on desktop, where copy sits
over the moon canvas; verify with a real contrast check and add a subtle
backing if needed. The language button's visible text ("English EN") does
not begin with its `aria-label` ("Language: English (EN)"); harmless, but
easy to align.

### 5.10 SEO and sharing

Good: canonical on every page, hreflang in four languages with x-default,
an eight-URL sitemap, Organization, WebSite, SoftwareApplication and FAQPage
structured data, Open Graph with a 1200×630 image, draft locales kept
noindex. The FAQ entry on the "Ummati" misspelling is smart. Issues: the
duplicate `/quran/` body (5.1); the 404 page's wrong Open Graph tags (5.8);
`lastmod` is the same date for all eight URLs, so it carries no signal.

### 5.11 Where Ummahti already beats Apple and Samsung

- No cookie banner. Samsung opens with a full-screen consent modal.
- No third-party code at all, and a privacy policy that can promise it.
- Real content: actual Quran text, actual recitation, actual app data,
  rather than marketing renders.
- Four languages with correct right-to-left layout.
- A visual idea (the moon of 6,236) that no competitor has.

## 6. Prioritised plan

**Now (days)**

1. Decide on analytics: disable Cloudflare Web Analytics or allow it in the
   CSP and update the privacy policy (S4).
2. Rebuild the 404 page on the V1.5 template; fix its Open Graph tags;
   delete `vendor/lenis.min.js` and the legacy scripts it needed (S7, 5.8).
3. Resolve `/quran/`: either make it the distinct deep page (preferred) or
   canonicalise it to `/` until it is (5.1, 5.10).
4. Move docs and tools out of the published directory by setting a build
   output subfolder in the Pages project (S1).
5. Pin the workflow actions to SHAs and route the bot through a pull request
   (S3). Add `security.txt` (S8).

**This month**

6. Bundle and minify per route; retire `styles.css`; set immutable cache
   headers; responsive images; `content-visibility` on below-fold sections;
   lazy-load the moon, star map and renders scripts (section 4).
7. Fix the mobile LCP path: critical CSS, hero image preload, subset Amiri
   for the hero (section 4).
8. Test on a real mid-range Android and make that the release gate.

**Next**

9. Split the home page into landing, `/quran/` product page and a moon page;
   one demonstration per feature; one travelling phone (5.1, 5.5).
10. Type: one display serif, 12 px floor, fewer captions (5.3).
11. Mobile hero with the phone in the first screen (5.2).
12. Header: Light/Dark in the header, twelve themes inside the demo, film
    sound on the film (5.6).
13. Locales: Nastaliq for Urdu, translated scene labels, localised
    screenshots, then native review and removal of noindex (5.8).
14. Confirm the signed-command properties of the ops channel in the app
    (S2).

## 7. Evidence

- Lighthouse reports, Playwright captures of every page and viewport, the
  interaction run (hero search, scene switch, handoff, full Guide, theme
  change, mobile menu, Arabic, Urdu, 404) and the Apple, Samsung and
  Quran.com captures were produced during this analysis on 4 November 2026
  and are summarised in the published report that accompanies this file.
- Live header and route probes were made with curl against
  ummahtiofficial.com on the same date.
- No file on the site, in the app, in Cloudflare or in the workflow was
  changed.
