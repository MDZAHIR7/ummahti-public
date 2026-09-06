# Ummahti Public

Public website and operational publishing surface for Ummahti Quran.

Framework-free static site deployed with Cloudflare Pages. The repository root
is the Pages output directory; there is no build command and no dependency
install. Editing a file and pushing is the whole deploy.

Public routes: `/`, `/whats-new`, `/privacy`, `/terms`, `/support`.

> ## Branch `v1.4-public-copy` is a hold, not a deploy
>
> That branch carries the site as it should read **once V1.4 is live for
> readers**, and it must not reach `main` before then: pushing `main` deploys,
> and the branch describes Guide, Classic Ink, Shiraz Dawn, Jali Moon, Mushaf
> al-Madinah and thirty-eight reciters as available. Until the release is out,
> nine themes and twenty-seven reciters is what is true.
>
> The two screenshots this branch had flagged as stale for 1.4 have now been
> regenerated.
> `media/screens/themes-840.webp` / `-420.webp` and `unlock-840.webp` /
> `-420.webp` are now real captures of the V1.4 app rather than recreations:
> the themes shot is the Reading Themes & Heritage studio, and the unlock shot
> is the redrawn card with its juz and page line and the paper coin in the
> header. They come from `release/Play Store/build/captures/` in the Android
> repository, resized and encoded by `build/make_web_derivatives.py` there.
>
> The other five screens under `media/screens/` (`home`, `mushaf`, `stream`,
> `audio`, `calendar`) are still the pre-V1.4 recreations. They are not wrong
> about any feature this branch claims, but they show a four-tab navigation bar
> with no Guide, and two invented progress figures. Worth regenerating from the
> same captures pipeline before this branch reaches `main`.

The `updates/`, `ops/`, `emergency/` and `youtube/` machine-readable paths
remain at their original URLs and are served `no-store`.

## Layout

```
index.html          the landing page
whats-new/          the public release history, derived from the app's own
                    ReleaseNotes
styles.css          the whole design system, one file
theme.js            restores the reader's theme, and marks the first page of
                    a visit, both before the first paint
sky.js              the room, drawn on the GPU when the device can take it
verse.js            the one-verse player: the reciter drum, its haptics, and
                    playback of the single locked ayah
app.js              scroll, reveals, the search demo, the lighting model,
                    the theme picker
vendor/lenis.min.js smooth scroll, self-hosted (the CSP forbids CDNs)
fonts/              Cinzel + Plus Jakarta Sans, subset to latin, with licences
media/screens/      app screenshots, WebP at 840w and 420w
media/scripts/      Al-Faatiha set once per Arabic script, WebP at 720w and 420w
media/brand/        crescent mark, favicons, social card
media/recitation/   the locked ayah, one clip per reciter, fetched not
                    committed by hand — see the file there
tools/              what fetches the recitation clips; nothing the site serves
```

## Where the assets come from

Nothing here is a mockup.

- **Screenshots** are rendered by the same generator that produces the Play
  Store listing, from the app's own tokens and strings. That generator now
  lives at `release/Play Store/build/` in the app repository (`screens.py`,
  `tokens.py`, `render.mjs`). **The web-specific entry points named in earlier
  revisions of this file, `make_web_screens.py` and `render_web_screens.mjs`,
  no longer exist under any name.** Rebuilding a screen for this site
  currently means adding a web target back to that generator. There is no
  documented one-command path, and pretending otherwise is how a stale image
  ships.
- **Typefaces** are the binaries the app itself draws with, taken from
  `app/src/main/res/font` and subset to latin. Both are SIL OFL 1.1; the
  licence text travels with them in `fonts/`.
- **Colours** are the Obsidian theme's own hex values, and the twelve theme
  swatches are that theme list verbatim, including the two accents deepened
  for contrast in 1.4 (`crisp-light` `#7a5e13`, `sheikh-zayed` `#6e5f2f`).
- **The crescent** is the launcher mark from `docs/design_provenance/`.
- **Search examples** are documented behaviours of the real search engine.
  Surah names use the spellings in `app/src/main/assets/quran_data.json`.
- **The four script pages** were rendered by `make_script_pages.py`, which no
  longer exists in the app repository. It did not choose its own pairings:
  which font goes with which orthography comes from `QuranScriptRegistry.kt`
  (that registry exists so a face is never paired with the wrong text) and the
  per-face leading comes from the measured policy in `ReaderSettings.kt`.
  **The registry now holds seven entries and this strip shows four**, which is
  why the section says so in as many words rather than implying the four are
  the whole set. The three not shown are Amiri Quran, Mushaf al-Madinah and
  DigitalKhatt Madina.
- **Recitation clips** are the ayah the app plays, from the per-ayah source
  the app plays it from, fetched by `tools/fetch_recitation.py`. The script
  does not carry a table of edition identifiers: it asks the API what it has
  and matches names against the drum in `index.html`, so the mapping is
  the coordinates the app plays them by — `AYAH_SOURCES` and `SURAH_SOURCES`
  in the script are `SUPPORTED_RECITERS` transcribed field for field, so no
  name is ever matched approximately. Eighteen reciters are per-ayah files
  from AlQuran Cloud and download as-is; nine are whole-surah files from
  MP3Quran, cut to that recording's own published `ayat_timing` boundaries
  for 21:92 with ffmpeg, which is what the app does at playback time. No
  boundary is interpolated: a reciter with no published timing is reported
  and skipped.
- **The twelve themes are readable, not just shown.** Each one is a block of
  tokens in `styles.css` whose background, surface, accent, secondary and text
  are the app's own values, the same five the swatches display. The rest of a
  theme (the accent's readable tint, the muted text, the button gradient) is
  derived from those five rather than picked, so a palette here cannot drift
  from the palette there. Two of the twelve carry a documented departure, each
  because the app does the same thing. Classic Ink sets `--amb-a` to nought,
  because its ambient tint is its page colour and the wash resolves to
  nothing, and draws its hairline at 28% rather than 16%, because in a theme
  with no colour and no wash the rule is what carries the structure. Jali Moon
  dims the room a little, because spending less light is the theme.
- **Guide has no screenshot and does not fake one.** The panel in `#guide`
  shows what Guide returns rather than what it looks like: a topic, and its
  sources named with their exact references. The topic, the references, the
  captions and the practical step are the app's own strings for
  `anxiety_and_worry` in `GuideCatalog.kt`. No Qur'anic Arabic appears in it,
  by the same rule that keeps every ayah on this site inside a real app
  screenshot.
- **The narration in `#name`** is the app's own reviewed wording for the
  *Why "Ummahti"?* page. Four things about it are not stylistic: the
  qualification is never trimmed, Sahih Muslim 199a and Sahih al-Bukhari 6304
  are named as two reports and never merged, nothing claims the Prophet asked
  Allah to save everyone, and Ummahti's own reflection sits outside the
  quotation.

## The one verse

The player under the reciter rail is locked to a single ayah — Al-Anbiya
21:92, *inna hadhihi ummatukum ummatan wahidah*, "this ummah of yours is one
ummah" — which is the verse the app's name comes out of. It plays that one
ayah and nothing else. Choosing a surah or a page is the app's job.

The drum holds all thirty-eight voices the rail names, in the rail's order,
and each row's `data-clip` is that reciter's own id in the app's
`SUPPORTED_RECITERS` (`AudioPlayerManager.kt`). Eleven of them carry
`data-nosite` and read "no clip". Every one of those is in the app; what they
have no source for is *this page*, because MP3Quran publishes no ayah timings
for those recordings and 21:92 cannot be cut out of them without guessing
where it starts. `tools/fetch_recitation.py` reports and skips them rather
than interpolating a boundary, and the transport says which it is rather than
failing quietly.

Three things about it are load-bearing.

**The drum is a scroll container.** `scroll-snap-type: y mandatory`, rows at
`scroll-snap-align: center`, and that is the whole mechanism. The flick, the
momentum, the rubber band and the settle are the reader's own platform, which
is why it feels like the picker they already know, and why there is no physics
in `verse.js`. The script leans the rows away from the reader, ticks the
detent as each name crosses the band, and tells the player which name is under
it. Turning the drum mid-verse swaps the voice and starts the ayah again.

**The detent is three things.** Android gets `navigator.vibrate`, which needs
sticky user activation — a touch-drag does not grant that until the finger
lifts, so the first spin of the page would otherwise be silent; `prime()`
spends the first activation-granting event on a zero-length pulse to arm it.
iOS Safari has no Vibration API at all, but since 17.4 a switch control fires
the system haptic when it toggles, so the tick there is a one-pixel
`<input type="checkbox" switch>` in the corner of the drum, clicked once per
detent — it has to stay in the layout, since `display:none` takes the haptic
with it. Everything else has no motor and gets the band lighting for a frame,
which runs on all three.

**The markup is the manifest.** The CSP has `connect-src 'none'`, so the page
cannot fetch a JSON file of reciters even if it wanted one. The list is the
`<li>`s, each carrying the slug of its clip, and `tools/fetch_recitation.py`
reads that list rather than keeping a second copy of it.

**It hides itself rather than half-work.** The section ships `hidden` with
`data-clips="pending"`, and `verse.js` returns without touching it unless that
says `"ready"` — which the fetch script sets once every voice in the drum has
a clip on disk. A deploy without the audio shows nothing at all, which is the
right outcome: the rail above has already named every reciter the app ships,
without a line of script, and a button that cannot play is worse than no
button. A single clip that goes missing later is handled at runtime instead —
its row says so and the transport disables.

The Arabic is the imlaei text with full diacritics, not the Uthmani text the
app draws. The page ships two latin faces and no Arabic one, so the line is
set in whatever Arabic face the reader's system has, and Uthmani orthography
is exactly what a borrowed face tends to drop. If a subset of the app's own
Uthmani face is ever added to `fonts/`, the line becomes the Uthmani text.

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

Adding a thirteenth theme is a token block in `styles.css`, its name in the `THEMES`
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
reveals it, and the twelve theme cards ship as `<div>`s and are replaced with real
buttons only once there is something to press.

## Checking a change

Serve the directory:

```bash
python -m http.server 4173
```

**The two checkers this section used to name, `shoot_site.mjs` and
`verify_site.mjs`, no longer exist in the app repository.** Until they are
restored, a change is checked by hand at 1440, 1024 and 375 wide, against the
same list they covered: no horizontal scroll at any width, one `h1` and no
skipped heading level, an `alt` on every image, every internal link and
same-page anchor resolving, the no-JS state (`.no-js [data-reveal]` renders
everything in its final position), the reduced-motion state, and the contrast
of every text token against its own ground in all twelve themes.
