Recitation clips for the one-verse player on the landing page.

anbiya-92/  one ayah — Surah Al-Anbiya 21:92, ayah 2575 of the Book — in each
            reciter named in the drum in index.html, as <slug>.mp3, where
            <slug> is that row's data-clip.

The clips are not written by hand, and they are not fetched by the browser
from anywhere else: the site's Content-Security-Policy has connect-src 'none'
and no media-src, so media falls back to default-src 'self' and a clip that
is not on this origin cannot be played at all. No reader's IP reaches a third
party in order to hear a verse.

Fill this directory with

    python3 tools/fetch_recitation.py

which downloads each clip from the same per-ayah source the app itself plays
from, writes CREDITS.txt beside them, and flips data-clips="pending" to
"ready" in index.html once every voice in the drum has its clip. Until then
the player stays hidden and the page is exactly as it was.
