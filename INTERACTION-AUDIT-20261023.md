# Corrective interaction audit — 23 October 2026

The owner rejected the behavior of the published phone previews. Earlier
checks covered layout, recovery, metadata and delivery, but missed whether
each control fulfilled its label. This correction treats behavior and visible
feedback as separate verification requirements.

## Repairs

- Both Guide surfaces use the same reviewed-token/phrase matcher. Happy no
  longer matches *unhappy marriage*. Unsupported queries show no match and
  remove the previous answer and decorative references. Queries remain local.
- Read plays the selected Al-Fatiha ayah in the phone. The sample reciter is
  selectable, playback/progress are real, and source/audio failures can retry.
- Both Unlock previews play their displayed ayah. Tamām acknowledges the exact
  completed reference, advances through Ad-Dhuha and Ash-Sharh, and visibly
  counts confirmations. The 19-ayah example has a completed state. Later keeps
  the ayah. Reset changes the local example. Busy actions cannot silently lose
  a second tap while the next source loads. The ordinary reading place stays
  independent.
- Hero Hifz reviews an actual entered reference or the named known example,
  requires an explicit state and confirms a local save. The larger walkthrough
  supports its known passage, typed reference and manual range, with stable
  saved results, exact boundaries, overlap replacement, Add another and Reset.
  The website does not listen or record; recognition belongs to the app.
- Workbench Guide examples update their own heading/content, without changing
  the separate Guide reader. Its source dialog agrees with the chosen example.
- Dua, reflection and moon cards reject stale source success/failure, clear old
  content during loading and recover from missing-payload/network failure.
  Dua copy uses one snapshot of the displayed content and current feedback.
  A cancelled moon-card close cannot hide a newly opened card.
  Visible ayahs remain tappable when scrolling stops during a formation change;
  settled night/day groups keep their existing portion behavior.
  Drawing uses the canvas's CSS bounds, preventing scrollbar-width drift in
  point hit testing. Platform clicks activate once; drags/cancelled touches do not.
  A subsequent drawing frame no longer immediately dismisses a card opened
  during an intermediate formation; actual scrolling still releases the card.
- The reciter wheel rejects stale play failures, permits retry after browser
  playback failure, and accumulates repeated keyboard input during native
  smooth scrolling. Sound players coordinate with each other. Films remain
  retryable; wall/video work stops when hidden, offscreen or motion-disabled.

## Verification coverage

The seven Node fixtures execute shipped controllers, not alternative UI logic.
Coverage includes every Guide title/scenario and selected Quran reference in
four locales; every public dua/reflection; exact corpus ranges; stale async
completion; playback/ref/voice agreement; save/reset/overlap semantics; and
the retained phone's focus, geometry and lifecycle contracts.

Rendered interaction checks cover the hero scenes and home/dock return,
Read selection/voice/play/pause, Unlock progress/Later/completion/reset,
all lower Hifz modes, all four workbench tabs, source/capture/record dialogs,
gallery boundaries, Khatm pacing, Guide search/filter/source recovery,
Dua copy/navigation, reflection selection, twelve themes, reciter controls,
film/sound controls, header disclosures, FAQ and narrow/RTL layouts. The
delivery handoff records which browser checks actually ran on the candidate
and on production; this file is not a claim that every browser/device was tested.

`python tools/check_v15.py`, `python tools/check_site.py` and
`python tools/check_experience.py` check the generated routes and shared helper
inclusion/order. Recitation provenance is in
`media/recitation/preview/CREDITS.md` and its per-file manifest. These are the
app's named AlQuran Cloud editions; recordings and Quran corpus are unmodified.

No standards change required. Website behavior is repaired within the existing
static architecture. No Android source, permissions policy, CSP, infrastructure,
approved logo/captures, or existing Quran text/translation assets are changed.
Physical-device validation and native review of draft translations remain
separate limits. Local Hifz examples reset with the page and do not save to the
installed app.
