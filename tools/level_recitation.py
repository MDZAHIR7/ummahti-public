#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Even out the playback level of the one-verse drum, without touching a clip.

The drum's whole interaction is spinning between voices, and the clips arrive
from two providers at whatever level each publisher mastered them.  Measured
as EBU R128 integrated loudness they ran from -8.4 LUFS (Mustafa Ismail) to
-21.4 LUFS (Hani Ar-Rifai): a thirteen decibel spread, so turning the drum one
way made the Qur'an roughly four times as loud and turning it back buried it.

The fix is not to re-encode the audio.  These are named men's recitations and
fetch_recitation.py goes to some trouble to make each clip byte-for-byte what
the app plays, from the source the app plays it from; normalising the files
would throw that away for a volume slider.  So the bytes stay exactly as the
reciter published them and the levelling happens at playback: this writes a
`data-gain` on each row and verse.js hands it to the audio element.

    python3 tools/level_recitation.py            # measure and write
    python3 tools/level_recitation.py --check    # measure and report only

An element's volume can only attenuate, so the target has to be a level the
loud clips come down to rather than one the quiet clips come up to.  Aiming at
the median means the loudest clip gives up about 8dB and the quietest gives up
nothing, leaving a residual spread of about 5dB -- the difference between two
reciters, rather than between two mixing desks.  Aiming any lower would even
the drum out perfectly and leave the whole thing too quiet on a phone.

Needs ffmpeg.  Run it after fetch_recitation.py, and again whenever a clip is
added or replaced.
"""

from __future__ import annotations

import argparse
import pathlib
import re
import shutil
import statistics
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
CLIPS = ROOT / "media" / "recitation" / "anbiya-92"


def ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:                                    # the sandbox's copy, if that is all there is
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        sys.exit("ffmpeg is needed to measure loudness and is not on PATH")


def loudness(exe: str, path: pathlib.Path) -> float | None:
    """Integrated loudness in LUFS, or None when ffmpeg will not report one."""
    out = subprocess.run(
        [exe, "-hide_banner", "-nostats", "-i", str(path),
         "-af", "ebur128=framelog=quiet", "-f", "null", "-"],
        capture_output=True, text=True).stderr
    tail = out.split("Integrated loudness")[-1]
    m = re.search(r"I:\s*(-?\d+(?:\.\d+)?)\s*LUFS", tail)
    return float(m.group(1)) if m else None


def rows(html: str) -> list[tuple[str, str]]:
    """(whole <li>, clip id) for every playable row, in page order."""
    block = re.search(r'<ul class="wheel-list".*?</ul>', html, re.S)
    if not block:
        sys.exit("index.html: no wheel-list found")
    out = []
    for li in re.finditer(r"<li\b[^>]*>.*?</li>", block.group(0), re.S):
        tag = li.group(0)
        m = re.search(r'data-clip="([^"]+)"', tag)
        if m and "data-nosite" not in tag:
            out.append((tag, m.group(1)))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="report, write nothing")
    args = ap.parse_args()

    exe = ffmpeg()
    html = INDEX.read_text(encoding="utf-8")
    playable = rows(html)
    if not playable:
        sys.exit("index.html: the drum has no playable rows")

    measured: dict[str, float] = {}
    for _, cid in playable:
        clip = CLIPS / f"{cid}.mp3"
        if not clip.exists():
            print(f"  {cid:22} no clip on disk — skipped")
            continue
        lufs = loudness(exe, clip)
        if lufs is None:
            print(f"  {cid:22} ffmpeg reported no integrated loudness — skipped")
            continue
        measured[cid] = lufs

    if not measured:
        sys.exit("nothing could be measured")

    target = statistics.median(measured.values())
    lo, hi = min(measured.values()), max(measured.values())
    print(f"\n{len(measured)} clips, {hi - lo:.1f}dB apart "
          f"({lo:.1f} to {hi:.1f} LUFS); levelling to the median, {target:.1f} LUFS\n")

    # Only ever down. Two decimal places is finer than the ear and keeps the
    # attribute short.
    gains = {cid: min(1.0, round(10 ** ((target - lufs) / 20), 2))
             for cid, lufs in measured.items()}

    for _, cid in playable:
        if cid in gains:
            print(f"  {cid:22} {measured[cid]:6.1f} LUFS   gain {gains[cid]:.2f}")

    after = [measured[c] + 20 * __import__("math").log10(gains[c]) for c in gains]
    print(f"\n  spread after levelling: {max(after) - min(after):.1f}dB")

    if args.check:
        return 0

    out = html
    written = 0
    for tag, cid in playable:
        new = re.sub(r'\s+data-gain="[^"]*"', "", tag)
        if cid in gains and gains[cid] < 1.0:
            new = new.replace(f'data-clip="{cid}"',
                              f'data-clip="{cid}" data-gain="{gains[cid]:.2f}"', 1)
        if new != tag:
            out = out.replace(tag, new, 1)
            written += 1

    if out == html:
        print("\nindex.html: already level")
        return 0
    INDEX.write_text(out, encoding="utf-8")
    print(f"\nindex.html: {written} row(s) updated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
