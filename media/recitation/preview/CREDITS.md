# Ayah recordings used by the interactive previews

Mishary Rashid Alafasy (`ar.alafasy`) and Mahmoud Khalil Al-Husary
(`ar.husary`), 128 kbps editions published by AlQuran Cloud / Islamic Network.
The named reciters retain their copyrights. This is a free, non-commercial
educational website. Their recordings are unmodified.

The [provider's terms](https://alquran.cloud/terms-and-conditions), section IV,
were checked on 23 October 2026. They describe free non-commercial redistribution
and educational streaming, embedding and downloading, with reciter copyrights
retained. Honor removal/correction requests from a rights holder.

Only Al-Fatiha 1:1–7, Ad-Dhuha 93:1–11 and Ash-Sharh 94:1–8 are included, in
these two editions. `manifest.json` records the exact provider URL, global ayah
number, file size and SHA-256 of every clip. Global coordinates are calculated
from the same verified per-surah counts as the website's Quran corpus.

Run `python tools/fetch_preview_recitation.py --check` to verify the local
coordinates and file digests without making requests. The fetch command is a
local maintenance step; visitors only load audio from Ummahti's own origin.
No microphone access, remote inference or browser query transmission is added.
