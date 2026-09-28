#!/bin/bash
# The film, for the web: what media/film/ is made from, and how.
#
#   tools/make_film.sh <landscape.mp4> <portrait.mp4> [name]
#
#   tools/make_film.sh ../ads/Videos/ummahti-ad-v4-desktop-1920x1080.mp4 \
#                      ../ads/Videos/ummahti-ad-v4-phone-1080x1920.mp4 ummahti-ad-v4
#
# The sources are the two cuts the ads repository renders (Videos/), 1920x1080
# and 1080x1920 at 60 fps, the same film on the same clock. Nothing here edits
# the picture or the sound.
#
# - The landscape cut keeps 60 fps. The portrait cut goes to 30: on a phone
#   that is the same picture for half the data and half the decoding, and a
#   motion-blurred 60 fps render dropped to 30 is the ordinary cinema shutter.
# - Colour tagged BT.709, so the film's black renders as the page's black.
# - A keyframe every two seconds, so a chapter jump or a rotate lands at once.
# - faststart, so playback begins on the first chunk rather than the last.
# - AV1 + Opus is the primary; H.264 + AAC is the fallback, at level 4.2 for
#   1080p60 and 4.1 for 1080p30, which every hardware decoder takes.
# - The still, for whoever does not get autoplay, is the du'a at eleven
#   seconds.
#
# /media/* is served immutable for a year, so a new cut is a new name, never
# an overwrite. Change the four <source> paths, the <picture> and the poster
# in index.html, and the VideoObject block. A recut also needs its timings
# re-measured: END_CARD in app.js, the chapters' data-at values, the
# .film-get coordinates in styles.css, and the words written out under it.
set -euo pipefail

LAND=${1:?landscape cut}
PORT=${2:?portrait cut}
NAME=${3:-ummahti-ad-v4}
OUT="$(cd "$(dirname "$0")/.." && pwd)/media/film"
mkdir -p "$OUT"

TAGS="-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv"
COMMON="-pix_fmt yuv420p $TAGS -map_metadata -1 -movflags +faststart"

for cut in land port; do
  if [ "$cut" = land ]; then src=$LAND; fps=60; crf=42; level=4.2
  else                        src=$PORT; fps=30; crf=40; level=4.1; fi
  base="$OUT/$NAME-$cut"
  gop=$((fps * 2))

  ffmpeg -hide_banner -loglevel error -y -i "$src" -vf "fps=$fps" \
    -c:v libaom-av1 -crf $crf -b:v 0 -cpu-used 7 -row-mt 1 -tiles 2x2 -g $gop -keyint_min $gop $COMMON \
    -c:a libopus -b:a 96k -ac 2 "$base.av1.mp4"

  ffmpeg -hide_banner -loglevel error -y -i "$src" -vf "fps=$fps" \
    -c:v libx264 -preset slow -crf 28 -profile:v high -level:v $level -g $gop -keyint_min $gop -sc_threshold 0 $COMMON \
    -c:a aac -b:a 128k -ac 2 "$base.h264.mp4"

  ffmpeg -hide_banner -loglevel error -y -ss 11 -i "$src" -frames:v 1 -c:v libwebp -quality 78 "$base.webp"

  echo "$cut: $(du -h "$base.av1.mp4" | cut -f1) AV1, $(du -h "$base.h264.mp4" | cut -f1) H.264"
done
