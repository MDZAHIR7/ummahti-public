#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fill /media/recitation/anbiya-92 with the clips the one-verse player needs.

The player on the landing page is locked to a single ayah — Al-Anbiya 21:92,
"this ummah of yours is one ummah" — and plays it in each reciter the app
ships.  The site's Content-Security-Policy has connect-src 'none' and no
media-src, so media falls back to default-src 'self': a clip that is not on
this origin cannot be played from anywhere else, and no reader's IP reaches a
third party in order to hear a verse.  Hence this script.  It is the only
thing in this repository that talks to another host, and it runs on your
machine, never in a browser.

    python3 tools/fetch_recitation.py            # download what is missing
    python3 tools/fetch_recitation.py --check    # report, download nothing
    python3 tools/fetch_recitation.py --force    # re-download everything
    python3 tools/fetch_recitation.py --prune    # drop rows it cannot fill
    python3 tools/fetch_recitation.py --selftest # check the parsing offline

Needs ffmpeg on PATH for the nine whole-surah reciters; the eighteen per-ayah
ones need nothing but this file.

Where the audio comes from
--------------------------
RECITERS below is SUPPORTED_RECITERS from the app's AudioPlayerManager.kt,
transcribed field for field: the same ids, the same edition identifiers, the
same bitrates, the same MP3Quran folders and the same `ayat_timing` read ids.
It is not a mapping invented for this site and it is not matched by name — a
clip fetched here is byte-for-byte the audio the app plays, from the source
the app plays it from, because it is fetched by the same coordinates.

That matters more than convenience.  These are named men's recitations, and a
name matched approximately is a name attributed wrongly.

Two granularities, exactly as in the app:

  AYAH   eighteen reciters, one file per verse from AlQuran Cloud —
         cdn.islamic.network/quran/audio/<bitrate>/<edition>/<n>.mp3, where
         <n> is the ayah's number in the whole Book.  Downloaded as-is.

  SURAH  nine reciters, one file per surah from MP3Quran, made ayah-
         addressable by MP3Quran's own published `ayat_timing` boundaries —
         which is precisely how the app plays them.  This fetches surah 21,
         asks the timing endpoint where ayah 92 starts and ends, and cuts
         exactly that span with ffmpeg.  Nothing here interpolates a
         boundary; if the endpoint does not publish one for 21:92, the
         reciter is reported and skipped.

The eleven reciters marked "soon" in the drum are in neither list, because
they are not in the app yet.  They are skipped by name, not by accident.

The markup is the source of truth
---------------------------------
The drum in index.html is the list, one <li> per reciter carrying
data-clip="<id>" — the app's own reciter id.  This script reads that list and
never invents one.  When every clip a row can have is on disk, it flips the
section's data-clips="pending" to "ready", which is what makes the player
appear at all.  Until then the section stays hidden and the page is exactly
as it was.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
OUT = ROOT / "media" / "recitation" / "anbiya-92"

SURAH, AYAH = 21, 92

# Ayah counts for surahs 1..20, so the running total is arithmetic rather than
# a magic number.  Confirmed against the API before anything is downloaded.
AYAH_COUNTS = [7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
               123, 111, 43, 52, 99, 128, 111, 110, 98, 135]
GLOBAL_AYAH = sum(AYAH_COUNTS) + AYAH          # 2483 + 92 = 2575

API = "https://api.alquran.cloud/v1"
CDN = "https://cdn.islamic.network/quran/audio"
TIMINGS = "https://mp3quran.net/api/v3/ayat_timing"
UA = "ummahti-public/fetch_recitation (+https://ummahtiofficial.com/)"

# --- SUPPORTED_RECITERS, from the app -------------------------------------
# id: (edition, bitrate) for per-ayah, or (folder, read_id) for whole-surah.
AYAH_SOURCES = {
    "alafasy":           ("ar.alafasy", 128),
    "abdulbaset":        ("ar.abdulbasitmurattal", 192),
    "abdullah_basfar":   ("ar.abdullahbasfar", 192),
    "sudais":            ("ar.abdurrahmaansudais", 192),
    "shuraym":           ("ar.saoodshuraym", 64),
    "shatri":            ("ar.shaatree", 128),
    "ajamy":             ("ar.ahmedajamy", 128),
    "hani_rifai":        ("ar.hanirifai", 192),
    "husary":            ("ar.husary", 128),
    "husary_mujawwad":   ("ar.husarymujawwad", 128),
    "hudhaify":          ("ar.hudhaify", 128),
    "akhdar":            ("ar.ibrahimakhbar", 32),
    "maher_muaiqly":     ("ar.mahermuaiqly", 128),
    "minshawy_murattal": ("ar.minshawi", 128),
    "minshawy_mujawwad": ("ar.minshawimujawwad", 64),
    "muhammad_ayyoub":   ("ar.muhammadayyoub", 128),
    "jibreel":           ("ar.muhammadjibreel", 128),
    "sowaid":            ("ar.aymanswoaid", 64),
}

SURAH_SOURCES = {
    "raad_kurdi":     ("https://server6.mp3quran.net/kurdi/", 221),
    "yasser_dosari":  ("https://server11.mp3quran.net/yasser/", 92),
    "nasser_qatami":  ("https://server6.mp3quran.net/qtm/", 86),
    "khalid_jalil":   ("https://server10.mp3quran.net/jleel/", 20),
    "idris_abkar":    ("https://server6.mp3quran.net/abkr/", 12),
    "fares_abbad":    ("https://server8.mp3quran.net/frs_a/", 81),
    "saad_ghamdi":    ("https://server7.mp3quran.net/s_gmd/", 30),
    "bandar_balila":  ("https://server6.mp3quran.net/balilah/", 217),
    "mustafa_ismail": ("https://server8.mp3quran.net/mustafa/Almusshaf-Al-Mojawwad/", 288),
}


# --------------------------------------------------------------------- fetch

def get(url: str, binary: bool = False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    return data if binary else json.loads(data.decode("utf-8"))


# ------------------------------------------------------------------ the page

def read_page() -> list[tuple[str, str, bool]]:
    """(id, display name, soon) for every voice in the drum, in page order."""
    html = INDEX.read_text(encoding="utf-8")
    block = re.search(r'<ul class="wheel-list".*?</ul>', html, re.S)
    if not block:
        sys.exit("index.html: no wheel-list found — has the player been removed?")

    voices = []
    for li in re.finditer(r"<li\b([^>]*)>(.*?)</li>", block.group(0), re.S):
        attrs, inner = li.group(1), li.group(2)
        m = re.search(r'data-clip="([^"]+)"', attrs)
        if not m:
            continue
        name = re.sub(r"<[^>]+>", " ", inner)
        name = re.sub(r"\s+", " ", name).replace(" )", ")").replace("( ", "(").strip()
        voices.append((m.group(1), name, "data-soon" in attrs))
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


def prune(drop: set[str]) -> None:
    """Take out rows this script could not fill and does not expect to.

    Only ever called for a reciter whose audio genuinely could not be had —
    never for one marked soon, which is meant to sit in the drum unplayable.
    """
    html = INDEX.read_text(encoding="utf-8")
    block = re.search(r'(<ul class="wheel-list".*?>)(.*?)(</ul>)', html, re.S)
    if not block or not drop:
        return

    rows = re.findall(r"[ \t]*<li\b[^>]*data-clip=\"[^\"]+\"[^>]*>.*?</li>\n?", block.group(2), re.S)
    kept = [r for r in rows if re.search(r'data-clip="([^"]+)"', r).group(1) not in drop]
    if len(kept) == len(rows) or not kept:
        return

    kept = [re.sub(r'\s+aria-selected="true"', "", r) for r in kept]
    first = re.search(r'data-clip="([^"]+)"', kept[0]).group(1)
    kept[0] = kept[0].replace(f'data-clip="{first}"', f'data-clip="{first}" aria-selected="true"')
    name = re.sub(r"<[^>]+>", " ", re.search(r"<li\b[^>]*>(.*?)</li>", kept[0], re.S).group(1))
    name = re.sub(r"\s+", " ", name).replace(" )", ")").replace("( ", "(").strip()

    html = html.replace(block.group(0), block.group(1) + "".join(kept) + block.group(3))
    html = re.sub(r'aria-activedescendant="[^"]*"', f'aria-activedescendant="voice-{first}"', html, count=1)
    html = re.sub(r'(<p class="lock-now" data-now>)[^<]*(</p>)',
                  lambda mm: mm.group(1) + name + mm.group(2), html, count=1)
    INDEX.write_text(html, encoding="utf-8")
    print(f"index.html: dropped {len(rows) - len(kept)} row(s); the drum opens on {name}")


# ------------------------------------------------------------ the two sources

def fetch_ayah(rid: str) -> bytes:
    edition, bitrate = AYAH_SOURCES[rid]
    return get(f"{CDN}/{bitrate}/{edition}/{GLOBAL_AYAH}.mp3", binary=True)


# MPEG-1/2/2.5 Layer III frame tables, enough to walk a file and add up its
# frames.  ffprobe would do this, but ffprobe is not guaranteed to be beside
# ffmpeg on every machine, and the check below is not worth a second
# dependency.
_BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
_BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0]
_RATES = {0: [44100, 48000, 32000], 2: [22050, 24000, 16000], 3: [11025, 12000, 8000]}


def mp3_duration_ms(data: bytes) -> int:
    """Length of an MPEG audio stream, by walking its frame headers.

    Returns 0 when nothing parses, which the caller treats as "cannot tell"
    rather than as "zero length".
    """
    i, total = 0, 0.0
    n = len(data)
    # Skip an ID3v2 tag if one is present.
    if data[:3] == b"ID3" and n > 10:
        i = 10 + ((data[6] & 0x7F) << 21 | (data[7] & 0x7F) << 14 |
                  (data[8] & 0x7F) << 7 | (data[9] & 0x7F))

    while i + 4 <= n:
        if data[i] != 0xFF or (data[i + 1] & 0xE0) != 0xE0:
            i += 1
            continue
        ver = (data[i + 1] >> 3) & 0x03          # 3 = MPEG1, 2 = MPEG2, 0 = 2.5
        layer = (data[i + 1] >> 1) & 0x03        # 1 = Layer III
        bi = (data[i + 2] >> 4) & 0x0F
        si = (data[i + 2] >> 2) & 0x03
        pad = (data[i + 2] >> 1) & 0x01
        if layer != 1 or ver == 1 or bi in (0, 15) or si == 3:
            i += 1
            continue
        rate = _RATES[0 if ver == 3 else (2 if ver == 2 else 3)][si]
        kbps = (_BITRATES_V1_L3 if ver == 3 else _BITRATES_V2_L3)[bi]
        samples = 1152 if ver == 3 else 576
        size = (samples // 8 * kbps * 1000) // rate + pad
        if size < 4:
            i += 1
            continue
        total += samples * 1000 / rate
        i += size

    return int(total)


def parse_timings(payload) -> dict[int, tuple[int, int]]:
    """{ayah: (start_ms, end_ms)} from an ayat_timing response.

    The endpoint answers with a bare JSON array of objects carrying `ayah`,
    `start_time` and `end_time` in milliseconds — the shape AyahTiming.kt's
    parser reads, and the reason this does not go looking for a wrapper first.
    The two wrapped shapes below are tolerated in case the API grows one; they
    are not what it returns today.

    The app's rules apply here too, and for the same reason: there is no ayah 0
    in any of these responses, a boundary must run forward, and anything else
    means the response cannot be trusted.  Nothing is interpolated.  A verse
    with no published boundary is an error, never an estimate.
    """
    rows = payload
    if isinstance(payload, dict):
        rows = payload.get("ayat_timing") or payload.get("data") or []
    if not isinstance(rows, list) or not rows:
        raise ValueError("ayat_timing did not return a list of boundaries")

    out = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        if not {"ayah", "start_time", "end_time"} <= row.keys():
            continue
        try:
            n, start, end = int(row["ayah"]), int(row["start_time"]), int(row["end_time"])
        except (TypeError, ValueError):
            continue
        if n < 1 or end <= start:
            continue
        out[n] = (start, end)

    if not out:
        raise ValueError("ayat_timing carried no usable boundary")
    return out


def fetch_surah_cut(rid: str) -> bytes:
    """The one ayah, cut out of the whole surah on its published boundaries.

    This is what the app does at playback time, done once here instead.  The
    boundaries come from MP3Quran's own ayat_timing endpoint for this exact
    recording, by the same read id the app uses — never from a guess, and never
    interpolated: a missing or malformed boundary raises rather than producing
    a clip that starts in the middle of a word.
    """
    folder, read_id = SURAH_SOURCES[rid]

    timings = parse_timings(get(f"{TIMINGS}?surah={SURAH}&read={read_id}"))
    if AYAH not in timings:
        raise ValueError(f"no published boundary for {SURAH}:{AYAH} on read {read_id}")
    start, end = timings[AYAH]

    url = f"{folder}{SURAH:03d}.mp3"          # MP3Quran's 3-digit convention
    audio = get(url, binary=True)

    with tempfile.TemporaryDirectory() as tmp:
        src = pathlib.Path(tmp) / "surah.mp3"
        dst = pathlib.Path(tmp) / "ayah.mp3"
        src.write_bytes(audio)
        # -ss before -i seeks the input, -t after it bounds the copy. Stream
        # copy, so the ayah is the reciter's own bytes and is not re-encoded.
        subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
             "-ss", f"{start / 1000:.3f}", "-i", str(src),
             "-t", f"{(end - start) / 1000:.3f}", "-c", "copy", str(dst)],
            check=True,
        )
        cut = dst.read_bytes()

    if len(cut) < 2048:
        raise ValueError(f"the cut came out at {len(cut)} bytes — "
                         f"boundary {start}..{end}ms of {url}")

    want = end - start
    got = mp3_duration_ms(cut)
    # A stream copy snaps to frame boundaries, so a little over is expected and
    # a little under is not alarming; an order of magnitude out means the seek
    # or the boundary was wrong, and that clip must not be committed.
    if got and not (want * 0.5 <= got <= want * 1.5 + 1000):
        raise ValueError(f"the cut is {got}ms but {SURAH}:{AYAH} is {want}ms "
                         f"({start}..{end} of {url}) — not writing it")
    return cut


def selftest() -> int:
    """Prove the parsing offline, before anything is downloaded on a machine
    that can reach these hosts."""
    cases = [
        ("bare array, as the endpoint answers",
         [{"ayah": 91, "start_time": 1000, "end_time": 2000},
          {"ayah": 92, "start_time": 2000, "end_time": 9500}], (2000, 9500)),
        ("string numbers",
         [{"ayah": "92", "start_time": "2000", "end_time": "9500"}], (2000, 9500)),
        ("wrapped in ayat_timing",
         {"ayat_timing": [{"ayah": 92, "start_time": 5, "end_time": 10}]}, (5, 10)),
        ("wrapped in data",
         {"data": [{"ayah": 92, "start_time": 5, "end_time": 10}]}, (5, 10)),
    ]
    bad = 0
    for name, payload, want in cases:
        try:
            got = parse_timings(payload).get(AYAH)
        except ValueError as e:
            got = f"raised {e}"
        ok = got == want
        bad += not ok
        print(f"  {'ok  ' if ok else 'FAIL'} {name}: {got}")

    rejects = [
        ("empty", []),
        ("a boundary that runs backwards", [{"ayah": 92, "start_time": 9, "end_time": 9}]),
        ("ayah 0 only", [{"ayah": 0, "start_time": 0, "end_time": 9}]),
        ("missing end_time", [{"ayah": 92, "start_time": 0}]),
        ("not a list", {"ayat_timing": "nope"}),
    ]
    for name, payload in rejects:
        try:
            parse_timings(payload)
            print(f"  FAIL {name}: accepted, should have raised")
            bad += 1
        except ValueError:
            print(f"  ok   {name}: rejected")

    # And the coordinates, which must not drift from the app's.
    urls = [
        f"{CDN}/{AYAH_SOURCES['alafasy'][1]}/{AYAH_SOURCES['alafasy'][0]}/{GLOBAL_AYAH}.mp3",
        f"{SURAH_SOURCES['raad_kurdi'][0]}{SURAH:03d}.mp3",
    ]
    want = [
        f"https://cdn.islamic.network/quran/audio/128/ar.alafasy/2575.mp3",
        "https://server6.mp3quran.net/kurdi/021.mp3",
    ]
    for got, exp in zip(urls, want):
        ok = got == exp
        bad += not ok
        print(f"  {'ok  ' if ok else 'FAIL'} url: {got}")

    # The duration reader, against streams built to a known length.
    for kbps, hdr2, secs in [(128, 0x90, 7.5), (64, 0x50, 3.0)]:
        rate, samples = 44100, 1152
        size = (samples // 8 * kbps * 1000) // rate
        frames = int(secs * rate / samples)
        stream = (bytes([0xFF, 0xFB, hdr2, 0xC0]) + b"\x00" * (size - 4)) * frames
        got = mp3_duration_ms(stream)
        want = int(frames * samples * 1000 / rate)
        ok = abs(got - want) <= 30
        bad += not ok
        print(f"  {'ok  ' if ok else 'FAIL'} duration of a {secs}s {kbps}kbps stream: "
              f"{got}ms (want {want}ms)")

    ok = mp3_duration_ms(b"not audio at all") == 0
    bad += not ok
    print(f"  {'ok  ' if ok else 'FAIL'} garbage reads as 0ms, not as a length")

    print("\nselftest:", "all green" if not bad else f"{bad} FAILING")
    return 0 if not bad else 1


# ---------------------------------------------------------------------- main

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true", help="report only, download nothing")
    ap.add_argument("--force", action="store_true", help="re-download clips already on disk")
    ap.add_argument("--prune", action="store_true", help="remove rows whose clip could not be fetched")
    ap.add_argument("--selftest", action="store_true",
                    help="check the parsing and the URLs offline, then exit")
    args = ap.parse_args()

    if args.selftest:
        return selftest()

    voices = read_page()
    soon = [v for v in voices if v[2]]
    want = [v for v in voices if not v[2]]
    print(f"{len(voices)} voices in the drum: {len(want)} with a source, "
          f"{len(soon)} marked soon and skipped\n")

    unknown = [rid for rid, _, _ in want if rid not in AYAH_SOURCES and rid not in SURAH_SOURCES]
    if unknown:
        return fail("no source for " + ", ".join(unknown) +
                    " — add them to AYAH_SOURCES or SURAH_SOURCES from the app's "
                    "AudioPlayerManager.kt, or mark the rows data-soon")

    needs_ffmpeg = any(rid in SURAH_SOURCES for rid, _, _ in want)
    if needs_ffmpeg and not shutil.which("ffmpeg") and not args.check:
        return fail("ffmpeg is not on PATH, and nine reciters need it to cut "
                    "their ayah out of a whole surah")

    # Confirm the arithmetic before trusting it with 27 downloads.
    try:
        ref = get(f"{API}/ayah/{GLOBAL_AYAH}")["data"]
    except urllib.error.URLError as e:
        return fail(f"cannot reach {API}: {e}")

    got = (ref["surah"]["number"], ref["numberInSurah"])
    if got != (SURAH, AYAH):
        return fail(f"ayah {GLOBAL_AYAH} is {got[0]}:{got[1]}, not {SURAH}:{AYAH} "
                    "— AYAH_COUNTS is wrong")
    print(f"ayah {GLOBAL_AYAH} confirmed as {SURAH}:{AYAH}")
    print(f"  {ref['text']}\n")

    OUT.mkdir(parents=True, exist_ok=True)
    have, fetched, failed = [], [], []

    for rid, name, _ in want:
        dest = OUT / f"{rid}.mp3"
        if dest.exists() and dest.stat().st_size > 0 and not args.force:
            have.append(rid)
            print(f"  have      {rid:20} {name}")
            continue

        kind = "ayah" if rid in AYAH_SOURCES else "surah cut"
        if args.check:
            print(f"  would get {rid:20} {kind:9}  {name}")
            continue

        try:
            blob = fetch_ayah(rid) if rid in AYAH_SOURCES else fetch_surah_cut(rid)
        except (urllib.error.URLError, ValueError, subprocess.CalledProcessError, KeyError) as e:
            failed.append((rid, str(e)))
            print(f"  FAILED    {rid:20} {e}")
            continue

        if len(blob) < 2048:
            failed.append((rid, f"{len(blob)} bytes"))
            print(f"  FAILED    {rid:20} {len(blob)} bytes — not audio")
            continue

        dest.write_bytes(blob)
        fetched.append((rid, kind, len(blob)))
        print(f"  fetched   {rid:20} {kind:9}  {len(blob) // 1024:>4} KB  {name}")

    if not args.check and (fetched or have):
        write_credits(fetched, have)

    print()
    print(f"on disk {len(have) + len(fetched)}/{len(want)}"
          f"  fetched {len(fetched)}  failed {len(failed)}")

    complete = len(have) + len(fetched) == len(want)
    if args.prune and not args.check and failed:
        prune({rid for rid, _ in failed})
        complete = bool(have or fetched)
    if not args.check:
        set_ready(complete)

    if complete:
        print("\nEvery voice that has a source has its clip. The player is live "
              "on the next deploy.")
    else:
        print("\nClips are missing, so the section stays hidden and nothing else "
              "on the page changes. Re-run to retry, or --prune to drop those rows.")
    return 0 if complete else 1


def write_credits(fetched, have) -> None:
    """What is in this directory, where each file came from, and under what."""
    lines = [
        "Recitation clips — Surah Al-Anbiya 21:92",
        "",
        f"One ayah, ayah {GLOBAL_AYAH} of the Book, in each reciter the app ships.",
        "Fetched by tools/fetch_recitation.py using the app's own SUPPORTED_RECITERS",
        "coordinates, so each clip is the audio the app plays, from the source the",
        "app plays it from:",
        "",
        f"  ayah       {CDN}/<bitrate>/<edition>/{GLOBAL_AYAH}.mp3 (AlQuran Cloud)",
        f"  surah cut  <mp3quran folder>/{SURAH:03d}.mp3, cut to the published",
        f"             ayat_timing boundaries for {SURAH}:{AYAH} (MP3Quran)",
        "",
        "The recitations are the reciters' own, reproduced here for the same reason",
        "the app plays them: so that the Qur'an can be heard. See the app's",
        "docs/CONTENT_LICENCES.md for the per-reciter permission record. If a",
        "reciter or a rights holder asks for a clip to be removed, delete the file",
        "and the <li> in index.html that names it, and re-run the script.",
        "",
        "id                    source",
    ]
    for rid, kind, _ in fetched:
        src = (f"{AYAH_SOURCES[rid][0]} @ {AYAH_SOURCES[rid][1]}kbps"
               if rid in AYAH_SOURCES else f"{SURAH_SOURCES[rid][0]} read {SURAH_SOURCES[rid][1]}")
        lines.append(f"{rid:20}  {src}")
    for rid in have:
        lines.append(f"{rid:20}  (already on disk)")
    (OUT / "CREDITS.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


def fail(msg: str) -> int:
    print(f"error: {msg}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    # The ayah is printed as Arabic, and a Windows console still defaults to
    # a legacy codepage that cannot encode it.  Say utf-8 rather than die
    # halfway through a report.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    raise SystemExit(main())
