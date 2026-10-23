# Website experience refinement — 21–22 October 2026

The owner authorized implementation after the 20 October Frames comparison
and clarified that small phone/screen alignment errors must be corrected as
part of the larger design work. This is a local website change on
`codex/website-experience-20261021`; it has not been published.

## Review status

On 22 October the owner rejected the previous interaction finish. Its phone
handoff, search illumination and Hifz demonstration were not accepted. Earlier
geometry screenshots and sampled opacity/stroke offsets remain historical
diagnostics; changing animation values did not prove that the SVG filled the
search field or that its travelling light was visibly successful. The repair
below supersedes those implementation claims. Focused browser repair checks
are recorded below; neither owner acceptance nor physical-device performance
is claimed.

The owner subsequently found the repaired light and phone presentation still
insufficient. The current iteration follows the confirmed whole-rim light
meaning and develops the placement choreography. The older four-path SVG
timings and straight phone transform are superseded. Matching the inspected
Frames mechanism is not a claim of pixel parity or owner acceptance.

## Current repair

- The screen owns the 420 × 910 walkthrough ratio. Its shell adds two 7 px
  bezels; mobile positioning no longer stretches the shell to the capture
  container. The real gallery images retain their own dimensions, including
  the older 420 × 933 captures. The generator reads WebP dimensions rather
  than assigning one height to all images.
- Four named choices expose Guide, reading, Unlock and My Hifz immediately.
  The shorter automatic sequence visits each once. A user choice takes
  control, and Resume returns to the preview.
- Home and dock controls now stay in stable layout positions. Only the actual
  front phone moves to the bounded `#preview` section, preserving its screen
  node, query, focus and selection. A single `v15-phone-handoff.js` controller
  reads its current presentation, reparents it into the destination layout,
  measures that layout and animates the inverse transform along a bowed,
  gently banked path with a damped settle over 680–850 ms. Its sampled affine
  keyframes are prepared once; there is no JavaScript layout loop during the
  flight. It does not fly a
  body-level fixed phone through changing `left`/inset coordinates. Interrupted
  movement retains the current affine pose, including an unfinished bank,
  rather than restarting from an old endpoint or a bounding box alone.
- The same controller reconciles native scrolling, a ±32 px boundary (64 px hysteresis),
  explicit home/dock intent, restored anchors, `pageshow`/load, resize and
  hidden state. Returning to the top releases stale intent and restores the
  phone without requiring a logo click. Reduced motion and unrelated
  offscreen/restoration changes settle directly. The dock still accounts for
  global scroll padding and derives size from the viewport, screen and bezel.
- A visible source stays in place until at least 64 px of its receiving slot
  is visible; native scroll reconciliation retries the placement. During an
  actual flight, `v15-handoff-craft.css` coordinates a short shell glint and a
  light cradle positioned at the receiving phone's base, while the source
  backdrop recedes. The controller removes the placement classes and custom
  properties on completion or cancellation. Reduced motion and forced colors
  suppress the decorative flight light. This remains one retained phone and
  one placement owner.
- The dock explains the selected feature. Guide uses the existing local
  reviewed catalogue; reading offers selectable ayahs, Unlock offers Later
  and Tamām. The dedicated Hifz area now asks the visitor to read the known
  21:92 passage aloud, then explicitly review that example. It plays no audio,
  never listens and does not pretend to recognize speech. Its reference mode
  accepts typed names/numbers and Arabic/Persian digits, validates ayah bounds
  and loads the actual first/last Quran ayahs. Compact Say/Choose sheets use
  content-sized layouts, quiet geometric material and 44 px controls. Saving
  is explicitly limited to the website example and resets on reload; no
  visitor's real app data changes. The hero's Hifz illustration remains a
  bounded preview, separate from actual Android recognition.
- The full Guide searches reviewed topics as the user types, preserving the
  current reader and focused input. Submission or choosing a result opens an
  answer. Fajr ranks the specific Fajr topic first. Clear, no-match recovery,
  keyboard selection, IME and stale asynchronous responses are handled.
- The shared `v15-field-light.js` and `v15-guide-light.css` replace the
  four-path SVG dash treatment. The inspected Frames mechanism is a full
  masked conic-gradient rim with a matching blurred bloom; its observed
  rotation is about 3.2 s. Ummahti's current treatment uses a 2 px masked rim,
  18 px bloom blur and 3.2 s rotation in theme-derived gold, warm white and
  emerald. Focus/typing keep the whole rim flowing while active; repeated
  typing preserves the current phase instead of restarting on every letter.
  Submit increases the rim/bloom intensity for 1,100 ms, then freezes its
  phase as a quieter static settled rim. The helper owns one angle animation
  and one guarded settlement timer; blur, no match, offscreen/hidden state and
  reduced motion stop or retain static feedback as appropriate. Hero and full
  Guide share this helper. Results remain immediate local catalogue results;
  there is no artificial loading wait or implied AI backend. Explicit search
  keeps the query
  above a centered source panel, rather than scrolling its own feedback away.
  Editing/clearing restores topic discovery. Hero-to-Guide navigation lights
  the actual field when it arrives in view. The field shell carries persistent
  focus, including a forced-colors outline fallback.
- Header theme/language utilities use consistent SVG icons, a globe, aligned
  44 px controls and orderly menus. Film sound is explicitly scoped to the
  app film and defaults muted. Small screens retain film audio controls at
  the film. Mobile navigation retains the official social links.
- Mobile hero copy and the product preview now have full-width space and
  readable controls. Short desktop layouts use a tighter type/spacing scale.
  Stacked dock spacing uses a fixed row gap so its controls cannot overlap the
  following navigation through percentage-grid intrinsic sizing.
- Explanatory headings, rules, libraries and data formations complete after
  entering view; stopping the scroll cannot leave them partly revealed.
  Interactive controls are excluded from decorative fading. The meaningful
  reversible crescent/juz story retains its existing scroll relationship.
- Theme light uses existing palette roles. The light-theme visualizations
  use appropriate darker marks; settled text stays opaque. The narrow
  Jali Moon pressed-result contrast risk uses primary text. Preview secondary
  text has a larger margin against its fixed dark wash/glare.
- Preview waits, light effects, globe drawing and Hifz drawing have explicit
  cancellation/visibility ownership. The dedicated Hifz preview has no audio
  player, audio context, waveform or speech-permission path. Its save callbacks
  and corpus responses cannot overwrite a newer mode. Reduced motion presents
  settled, manually selectable content; pause settles arrivals.

## Preserved scope

The approved crescent, atmosphere, umbrella identity, app branding, actual
captures, licensed Arabic font, Quran corpus and reviewed 86-topic website
catalogue remain authoritative. No framework, CDN, AI backend, microphone,
query transmission or query persistence was introduced. Existing CSP and
permission restrictions remain. No Android source, operational surface, account,
Firebase, DNS or publishing pipeline was changed. Draft locales remain drafts.
Future app wishes and unshipped features are not advertised as delivered.

## Verification record

The preceding r2 repair's automated checks passed on 22 October: all three Python
checkers and all three Node regression fixtures. Changed-script syntax checks
include the new phone handoff helper; diff checks passed with repository
LF/CRLF normalization notices only. No app, media, security-header, redirect or
operational-surface change is part of this repair.

For the subsequent flowing-rim and bowed-placement iteration, the Guide and
phone regression fixtures and both shared-helper syntax checks passed again
on 22 October. These focused checks establish the tested state transitions,
not the perceived light, composition or physical-device frame delivery.

The r2 repair's browser observations confirmed at 390 × 844 and 1280 × 720: the reciter link
navigates to `#reciters`; reloading a restored anchor and then pressing
Ctrl+Home returns the same single phone to its home slot without a logo click.
The explicit Hifz recitation prompt and a typed `67:1–10` reference rendered
their real corpus passages; `67:1–99` recovered with an announced 1–30 bound.
Arabic reciter/top return also restored its mirrored home. Guide was inspected
at 1440 × 900 and 390 × 844, including Arabic Warm Cream: query and source
remain together, input is 16 px on mobile and no horizontal overflow occurred.
These observations are not a complete release or performance verdict. Final
asset version for those observations was `20261022r2`; evidence is in the
shared brain's 22 October repair report and handoff. The generator now uses
`20261023r5` for the flowing-rim and bowed-placement iteration. Its current
browser comparison is recorded in the shared brain's
`website/reports/2026-10-22-flowing-rim/index.html`. It includes actual forward
and return samples, full Guide active/settled states and mobile theme/RTL
captures. At 1280 × 720, the final fractional home slot and phone rectangles
matched exactly. The corrected phone reciter route reached its destination,
survived refresh and restored the phone on keyboard top return. The r2
observations do not establish this iteration's visual finish.

The prior pass covered 1440 × 900, 1280 × 720, 768 × 1024, 390 × 844 and
360 × 640, four locale hero/header layouts and Guide search in twelve themes.
Its browser log was empty in the inspected session. Those earlier captures
are useful baselines, but the owner's rejection means they do not establish
acceptance of this repair. In particular, the earlier opacity samples
0.13 → 0.82 → 0.98 proved changing animation values, not a correctly sized or
sufficiently visible contour.

See the shared brain handoff
`memory/handoffs/2026-10-22-flowing-rim-and-phone-craft.md` for current evidence
and limits. Final local checks passed across 22–23 October. No standards change
required. Existing source boundaries, native scrolling and approved assets
remain in use.
The relevant automated commands are:

```text
python tools/build_v15.py
python tools/check_v15.py
python tools/check_site.py
python tools/check_experience.py
node tools/test_guide_search.cjs
node tools/test_phone_handoff.cjs
node tools/test_hifz_preview.cjs
node --check v15.js
node --check v15-renders.js
node --check v15-guide.js
node --check v15-flow.js
node --check v15-phone-handoff.js
node --check v15-field-light.js
git diff --check
```

The Guide fixture executes the shipped script against the real four-locale
catalogue and shared field-light helper: one flowing phase owner, continuous
active typing, immediate local results, bounded submit surge, static settlement
and blur/offscreen/reduced-motion cancellation. Extracted hero contracts also
exercise pending manual-search preservation during docking, stale submit/chip
callbacks, fractional sizing and focus-before-scroll section navigation. The phone fixture executes the
single handoff controller, including restoration, top returns, hysteresis,
receiver preflight, curved placement, affine-pose reversal, finite landing
cleanup, native scrolling, query/focus identity, resize and cancellation.
The Hifz fixture executes the shipped
controller/parser against actual Quran data: 18 parser cases, explicit review,
typed/manual range boundaries, stale response/save cancellation, hidden-state
cleanup and traps proving that those tested flows construct no audio player
or microphone recognizer. These fixtures do not substitute for rendered
browser checks. The image checker independently uses Pillow and checks 80
declarations/derivatives in eight home/app pages. Historical theme screenshots
and exact geometry remain with the brain's implementation evidence.

Physical Android/iOS browser smoothness and native system reduced-motion
preferences remain device-check limitations. A local Python server does not
apply Cloudflare `_headers`; release verification reads actual hosting headers.
The owner authorised publication on 23 October after a thorough bug check.
New and existing
Arabic, Urdu and Indonesian interface copy still require native review and
retain their draft/noindex status.

The 23 October release audit repaired same-topic Guide retry after a failed
source, a missing-payload loader cache, focused-search cancellation during
phone restoration, stale Hifz responses after reference edits, and duplicate
counts from overlapping Hifz saves. The regression fixtures execute these
actual controller paths. Incoming mobile performance work from `936d3f2`
is preserved when integrating the release; generated pages are rebuilt after
integration and the combined candidate is verified before the production push.
The live audit also found Contact sharing metadata inherited from Terms and
three missing draft robots tags. The document generator now keeps share titles
and URLs aligned with their own page and enforces noindex for every localized
document. The 32-page checker verifies those contracts on all routes.
Repeated builds also exposed duplicate translated Support guidance because
the old cleanup matched only an exact single-class attribute. Cleanup now
handles the generated extra class; all four Support pages contain one update
section, and two consecutive builds produce identical pages.

No standards change required. This refines the existing website architecture;
it does not amend Android engineering or release standards.
