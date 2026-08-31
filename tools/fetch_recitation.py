#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fill /media/recitation/anbiya-92 with the clips the one-verse player needs.

The player on the landing page is locked to a single ayah — Al-Anbiya 21:92,
"this ummah of yours is one ummah" — and plays it in each reciter the app
ships.  The site's Content-Security-Policy has connect-src 'none' and no
media-src, so media falls back to default-src 'self': a clip that is not on
this origin cannot be played from anywhere else, and no reader's IP reaches a
third party to hear a verse.  Hence this script.  It is the only thing on the
site that talks to another host, and it runs on your machine, never in a
browser.

    python3 tools/fetch_recitation.py                  # download what is missing
    python3 tools/fetch_recitation.py --check          # report, download nothing
    python3 tools/fetch_recitation.py --force          # re-download everything
    python3 tools/fetch_recitation.py --list-editions  # what the API offers
    python3 tools/fetch_recitation.py --prune          # drop rows with no clip

A voice AlQuran Cloud does not serve per-ayah cannot be played from this
origin at all.  Either pin a per-ayah URL for it in MANUAL, or run --prune to
take its row out of the drum; the rail higher up the page goes on naming every
reciter the app ships either way.

Where the audio comes from
--------------------------
AlQuran Cloud serves per-ayah MP3s at

    https://cdn.islamic.network/quran/audio/128/<edition>/<n>.mp3

where <n> is the ayah's number in the whole Book, 1..6236, not its number in
its surah.  That is the same per-ayah source the app itself uses for its first
group of reciters, which is why a clip fetched here is the clip the app plays.

This script does not carry a hand-written table of edition identifiers.  It
asks the API for every audio edition and matches them against the names in
index.html, so the mapping is derived at fetch time rather than guessed once
and left to rot.  Names that no edition matches are reported, not silently
skipped, and can be pinned in MANUAL below.

The markup is the source of truth
---------------------------------
The list of voices lives in index.html, in the drum, one <li> per reciter
carrying data-clip="<slug>".  This script reads that list; it never invents
one.  Add a reciter to the page and the next run fetches their clip.

When every clip named in the markup is on disk, the script flips the section's
data-clips="pending" to "ready", which is what makes the player appear at all.
Until then the section stays hidden and the page is exactly as it was.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys
import unicodedata
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
OUT = ROOT / "media" / "recitation" / "anbiya-92"

SURAH, AYAH = 21, 92

# Ayah counts for surahs 1..20, so the running total below is arithmetic
# rather than a magic number.  The API is asked to confirm it before a single
# byte is downloaded.
AYAH_COUNTS = [7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
               123, 111, 43, 52, 99, 128, 111, 110, 98, 135]
GLOBAL_AYAH = sum(AYAH_COUNTS) + AYAH          # 2483 + 92 = 2575

API = "https://api.alquran.cloud/v1"
CDN = "https://cdn.islamic.network/quran/audio/128"
BITRATE = 128
UA = "ummahti-public/fetch_recitation (+https://ummahtiofficial.com/)"

# Pin a slug to an edition identifier, or to a whole URL, when the name match
# cannot find it.  A --check run tells you which slugs need an entry here.
MANUAL: dict[str, str] = {}


# --------------------------------------------------------------------- utils

def get(url: str, binary: bool = False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    return data if binary else json.loads(data.decode("utf-8"))


STYLES = ("mujawwad", "murattal")

# Dropped before two names are compared: the article and its spellings, the
# words that mean "son of" or "servant of", and the honorifics.  What is left
# is the part of a name that identifies the man.
NOISE = re.compile(
    r"\b(al|el|ar|as|ash|ad|at|az|bin|ben|ibn|abu|abo|abd|abdu|abdul|abdel|abdur|"
    r"abdal|sheikh|shaikh|shaykh|the|mujawwad|murattal|muallim|warsh|qaloon)\b"
)


def fold(name: str) -> list[str]:
    """A name reduced to what two spellings of it have in common.

    Reciters' names reach the latin alphabet by several routes — al-/Al /
    nothing, Abdul/Abdel/Abdur, -i/-y, doubled letters, and vowels chosen by
    ear — so comparing the exact strings matches almost nothing.  Folding
    drops accents, case, punctuation, the article and the honorifics, then
    the vowels the routes disagree about, then doubled letters, then the
    trailing -y that is the other half of the -i/-y ending.  What survives is
    a consonant skeleton: Hussary and Husary both become hsr, Shatri and
    Shaatree both shtr, Ajmi and Ajamy both jm, Shuraim and Shuraym shrm.

    Order is kept, because the last token is the one that does the work —
    see match().  The reading, Mujawwad or Murattal, is not part of a name
    and is compared separately.
    """
    s = unicodedata.normalize("NFKD", name)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"[^a-z ]+", " ", s)
    s = NOISE.sub(" ", s)

    out = []
    for tok in s.split():
        tok = re.sub(r"[aeiou]", "", tok)
        tok = re.sub(r"(.)\1+", r"\1", tok)
        tok = re.sub(r"y$", "", tok)
        # y is a vowel in Shuraym and a consonant in Ayyoub, so it goes only
        # when what is left is still a skeleton: shrym -> shrm, but yb stays.
        thin = tok.replace("y", "")
        if len(thin) > 1:
            tok = thin
        if len(tok) > 1 and tok not in out:
            out.append(tok)
    return out


def style_of(*parts: str) -> str:
    low = " ".join(parts).lower()
    for s in STYLES:
        if s in low:
            return s
    return ""


# ------------------------------------------------------------------ the page

def read_page() -> list[tuple[str, str]]:
    """(slug, display name) for every voice in the drum, in page order."""
    html = INDEX.read_text(encoding="utf-8")
    block = re.search(r'<ul class="wheel-list".*?</ul>', html, re.S)
    if not block:
        sys.exit("index.html: no wheel-list found — has the player been removed?")

    voices = []
    for li in re.finditer(r'<li\b[^>]*data-clip="([^"]+)"[^>]*>(.*?)</li>', block.group(0), re.S):
        slug = li.group(1)
        name = re.sub(r"<[^>]+>", " ", li.group(2))
        name = re.sub(r"\s+", " ", name).replace(" )", ")").replace("( ", "(").strip()
        voices.append((slug, name))
    if not voices:
        sys.exit("index.html: the drum is empty")
    return voices


def set_ready(ready: bool) -> None:
    html = INDEX.read_text(encoding="utf-8")
    want = "ready" if ready else "pending"
    new = re.sub(r'data-clips="(ready|pending)"', f'data-clips="{want}"', html, count=1)
    if new != html:
        INDEX.write_text(new, encoding="utf-8")
        print(f'index.html: data-clips="{want}"')


def prune(keep: list[str]) -> None:
    """Drop the drum rows we could not get a clip for, and fix up the head.

    A voice AlQuran Cloud does not carry per-ayah cannot be played from this
    origin, and a row that cannot play is not worth a row.  The rail higher
    up the page still names every reciter the app ships, which is the claim
    that matters; the drum only claims to be a thing you can turn.
    """
    html = INDEX.read_text(encoding="utf-8")
    block = re.search(r'(<ul class="wheel-list".*?>)(.*?)(</ul>)', html, re.S)
    if not block:
        return

    rows = re.findall(r'[ \t]*<li\b[^>]*data-clip="[^"]+"[^>]*>.*?</li>\n?', block.group(2), re.S)
    kept = [r for r in rows if re.search(r'data-clip="([^"]+)"', r).group(1) in keep]
    if len(kept) == len(rows):
        return

    # The first surviving row is the one the drum opens on.
    kept = [re.sub(r'\s+aria-selected="true"', "", r) for r in kept]
    first = re.search(r'data-clip="([^"]+)"', kept[0]).group(1)
    kept[0] = kept[0].replace(f'data-clip="{first}"', f'data-clip="{first}" aria-selected="true"')
    name = re.sub(r"<[^>]+>", " ", re.search(r"<li\b[^>]*>(.*?)</li>", kept[0], re.S).group(1))
    name = re.sub(r"\s+", " ", name).replace(" )", ")").replace("( ", "(").strip()

    html = html.replace(block.group(0), block.group(1) + "".join(kept) + block.group(3))
    html = re.sub(r'aria-activedescendant="[^"]*"', f'aria-activedescendant="voice-{first}"', html, count=1)
    html = re.sub(r'(<p class="lock-now" data-now>)[^<]*(</p>)', lambda mm: mm.group(1) + name + mm.group(2), html, count=1)
    INDEX.write_text(html, encoding="utf-8")
    print(f"index.html: dropped {len(rows) - len(kept)} row(s) with no clip; the drum opens on {name}")


# --------------------------------------------------------------------- match

def editions() -> list[dict]:
    data = get(f"{API}/edition/format/audio")["data"]
    return [e for e in data if e.get("language") == "ar" and e.get("type") == "versebyverse"] or data


def match(name: str, pool: list[dict]) -> str | None:
    """The one edition that is this reciter, or None if that is not obvious.

    The gate is the family name — the last token of the fold — and only the
    family name.  Given names do not identify anyone here: Muhammad, Mahmoud
    and Mohamed all fold to mhmd, and three quarters of this list carries
    one of them, so a matcher that scores shared tokens will happily hand
    Muhammad Ayyoub's edition to Mahmoud Al-Hussary.  Al-Hussary is the man.
    Everything else in the score only breaks ties between editions that
    already agree on it.

    Deliberately unwilling to guess: if two editions score the same this
    returns None and the run reports the slug for MANUAL.  Attributing one
    man's recitation to another is a worse outcome than a missing clip.
    """
    want = fold(name)
    if not want:
        return None
    surname, wset, style = want[-1], set(want), style_of(name)
    scored = []

    for e in pool:
        ident = e.get("identifier", "")
        est = style_of(e.get("englishName", ""), ident)

        # Mujawwad is never the default reading, so it only ever answers a
        # name that asks for it, and never one that does not.  Murattal is
        # the default, so a plain edition answers for it.
        if (est == "mujawwad") != (style == "mujawwad"):
            continue

        best = 0
        for label in (e.get("englishName", ""), e.get("name", ""), ident.split(".")[-1]):
            have = fold(label)
            if not have or have[-1] != surname:
                continue
            hset = set(have)
            best = max(best, 3 + len(hset & wset) + (1 if hset <= wset or wset <= hset else 0))
        if best:
            scored.append((best, ident))

    if not scored:
        return None
    scored.sort(reverse=True)
    if len(scored) > 1 and scored[0][0] == scored[1][0]:
        return None                       # ambiguous: say so rather than pick
    return scored[0][1]


# ---------------------------------------------------------------------- main

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true", help="report only, download nothing")
    ap.add_argument("--force", action="store_true", help="re-download clips already on disk")
    ap.add_argument("--prune", action="store_true",
                    help="remove drum rows whose clip could not be fetched")
    ap.add_argument("--list-editions", action="store_true",
                    help="print every audio edition the API offers, for MANUAL")
    args = ap.parse_args()

    if args.list_editions:
        for e in sorted(editions(), key=lambda x: x.get("identifier", "")):
            print(f'  {e.get("identifier",""):32} {e.get("englishName","")}')
        return 0

    voices = read_page()
    print(f"{len(voices)} voices in index.html\n")

    # Confirm the arithmetic before trusting it with 27 downloads.
    try:
        ref = get(f"{API}/ayah/{GLOBAL_AYAH}")["data"]
    except urllib.error.URLError as e:
        return fail(f"cannot reach {API}: {e}")

    got = (ref["surah"]["number"], ref["numberInSurah"])
    if got != (SURAH, AYAH):
        return fail(f"ayah {GLOBAL_AYAH} is {got[0]}:{got[1]}, not {SURAH}:{AYAH} — AYAH_COUNTS is wrong")
    print(f"ayah {GLOBAL_AYAH} confirmed as {SURAH}:{AYAH}")
    print(f"  {ref['text']}\n")

    pool = editions()
    print(f"{len(pool)} audio editions offered\n")

    OUT.mkdir(parents=True, exist_ok=True)
    have, fetched, unmatched, failed = [], [], [], []

    for slug, name in voices:
        dest = OUT / f"{slug}.mp3"
        if dest.exists() and dest.stat().st_size > 0 and not args.force:
            have.append(slug)
            print(f"  have      {slug:22} {name}")
            continue

        pin = MANUAL.get(slug)
        url = pin if (pin or "").startswith("http") else None
        edition = None if url else (pin or match(name, pool))

        if not url and not edition:
            unmatched.append((slug, name))
            print(f"  NO MATCH  {slug:22} {name}")
            continue

        url = url or f"{CDN}/{edition}/{GLOBAL_AYAH}.mp3"
        if args.check:
            print(f"  would get {slug:22} {edition or url}")
            continue

        try:
            blob = get(url, binary=True)
        except urllib.error.HTTPError as e:
            failed.append((slug, f"HTTP {e.code}"))
            print(f"  FAILED    {slug:22} HTTP {e.code}  {url}")
            continue
        except urllib.error.URLError as e:
            failed.append((slug, str(e)))
            print(f"  FAILED    {slug:22} {e}")
            continue

        if len(blob) < 2048:
            failed.append((slug, f"{len(blob)} bytes"))
            print(f"  FAILED    {slug:22} {len(blob)} bytes — not audio")
            continue

        dest.write_bytes(blob)
        fetched.append((slug, edition or url, len(blob)))
        print(f"  fetched   {slug:22} {len(blob) // 1024} KB  {edition or url}")

    if fetched or (have and not args.check):
        write_credits(voices, fetched)

    print()
    print(f"on disk {len(have) + len(fetched)}/{len(voices)}"
          f"  fetched {len(fetched)}  unmatched {len(unmatched)}  failed {len(failed)}")

    if unmatched:
        print("\nNo edition matched these. Pin them in MANUAL at the top of this file —")
        print("an identifier from the editions list, or a whole URL:\n")
        for slug, name in unmatched:
            print(f'    "{slug}": "ar.…",   # {name}')

    complete = len(have) + len(fetched) == len(voices)
    if args.prune and not args.check and not complete:
        prune(have + [f[0] for f in fetched])
        complete = bool(have or fetched)
    if not args.check:
        set_ready(complete)
    if complete:
        print("\nEvery clip is present. The player is live on the next deploy.")
    else:
        print("\nClips are missing, so the section stays hidden. Nothing else on the page changes.")
    return 0 if complete else 1


def write_credits(voices, fetched) -> None:
    """What is in this directory, where each file came from, and under what.

    The site documents the provenance of everything it ships; recorded
    recitation is not the one asset that gets to arrive unattributed.
    """
    lines = [
        "Recitation clips — Surah Al-Anbiya 21:92",
        "",
        f"One ayah, ayah {GLOBAL_AYAH} of the Book, in each reciter the app ships.",
        "Fetched by tools/fetch_recitation.py from AlQuran Cloud's per-ayah audio",
        f"({CDN}/<edition>/{GLOBAL_AYAH}.mp3, {BITRATE}kbps), which is the same",
        "per-ayah source the app itself plays from.",
        "",
        "The recitations are the reciters' own. They are reproduced here for the",
        "same reason the app plays them: so that the Qur'an can be heard. If a",
        "reciter or a rights holder asks for a clip to be removed, remove the file",
        "and the <li> in index.html that names it, and re-run the script.",
        "",
        "slug                    source",
    ]
    for slug, src, _ in fetched:
        lines.append(f"{slug:22}  {src}")
    (OUT / "CREDITS.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


def fail(msg: str) -> int:
    print(f"error: {msg}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
