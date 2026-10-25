"""Refresh the public channel figures and the newest YouTube uploads for the wall.

Nothing private is read. Sources, in order of preference:

  YouTube    the Data API v3 when YOUTUBE_API_KEY is set; otherwise the channel's public
             Atom feed for the newest uploads, and the public channel pages for the video and
             subscriber counts and for upload order. Titles missing from either come from
             YouTube's public oEmbed endpoint.
  Instagram  the Instagram Graph API when INSTAGRAM_TOKEN is set; otherwise the committed
             figures are kept exactly as they are.

Each new upload's thumbnail is downloaded once and kept locally as a 360x640 WebP, so the
page keeps its own-origin image policy and never calls YouTube from a visitor's browser.

The script never fails a build: when nothing can be reached it leaves media/channel/feed.json
untouched and says so. Run it by hand or let .github/workflows/channels.yml run it daily:

    python tools/refresh_channels.py          # refresh the figures and thumbnails
    python tools/refresh_channels.py --check  # only confirm the committed feed is consistent
"""
from pathlib import Path
from datetime import date, datetime, timedelta, timezone
from io import BytesIO
import json, os, re, sys, urllib.request, urllib.parse, xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
FEED = ROOT / 'media/channel/feed.json'
THUMBS = ROOT / 'media/channel/latest'
CHANNEL_ID = 'UCwZp3l_DFMtGEqqYOY9Odxw'
HANDLE = '@Ummahti'
INSTAGRAM = 'ummahti_quran'
LATEST = 12
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36 ummahti-site-refresh'
TODAY = datetime.now(timezone.utc).date()


def log(message):
    print('channels:', message, flush=True)


def fetch(url, timeout=25, accept='*/*'):
    """Bytes, or None. Every failure is a quiet None: the build must not depend on the web."""
    try:
        request = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': accept, 'Accept-Language': 'en'})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            if response.status != 200:
                return None
            return response.read()
    except Exception as error:  # noqa: BLE001 - any network or parse failure is handled by the caller
        log(f'could not fetch {url.split("?")[0]}: {type(error).__name__}')
        return None


def count(text):
    """'15.2K' -> 15200, '1,234' -> 1234, '1.5M' -> 1500000."""
    if text is None:
        return None
    text = str(text).strip().replace(',', '')
    match = re.fullmatch(r'(\d+(?:\.\d+)?)\s*([KkMm]?)', text)
    if not match:
        return None
    value = float(match[1]) * {'': 1, 'k': 1000, 'm': 1000000}[match[2].lower()]
    return int(round(value))


def relative(text):
    """'3 days ago' -> an ISO date, approximately. Only used when the feed gives no exact time."""
    match = re.search(r'(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago', text or '')
    if not match:
        return None
    n, unit = int(match[1]), match[2]
    days = {'second': 0, 'minute': 0, 'hour': 0, 'day': 1, 'week': 7, 'month': 30, 'year': 365}[unit] * n
    return (TODAY - timedelta(days=days)).isoformat()


# ----------------------------------------------------------------------------- YouTube
def youtube_api(key):
    base = 'https://www.googleapis.com/youtube/v3/'
    raw = fetch(base + 'channels?' + urllib.parse.urlencode({'part': 'statistics,contentDetails', 'id': CHANNEL_ID, 'key': key}))
    if not raw:
        return None
    try:
        channel = json.loads(raw)['items'][0]
        uploads = channel['contentDetails']['relatedPlaylists']['uploads']
        stats = channel['statistics']
        raw = fetch(base + 'playlistItems?' + urllib.parse.urlencode({'part': 'snippet', 'playlistId': uploads, 'maxResults': 20, 'key': key}))
        items = json.loads(raw)['items'] if raw else []
        latest = [{'id': item['snippet']['resourceId']['videoId'], 'title': item['snippet']['title'], 'published': item['snippet']['publishedAt'][:10]}
                  for item in items if item['snippet'].get('resourceId', {}).get('videoId')]
        return {'videos': int(stats['videoCount']), 'subscribers': int(stats.get('subscriberCount', 0)) or None, 'latest': latest, 'source': 'youtube-data-api'}
    except Exception as error:  # noqa: BLE001
        log(f'Data API response not usable: {type(error).__name__}')
        return None


def youtube_feed():
    raw = fetch('https://www.youtube.com/feeds/videos.xml?channel_id=' + CHANNEL_ID, accept='application/atom+xml,application/xml')
    if not raw:
        return []
    try:
        ns = {'a': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015'}
        entries = []
        for entry in ET.fromstring(raw).findall('a:entry', ns):
            video = entry.findtext('yt:videoId', namespaces=ns)
            if video:
                entries.append({'id': video, 'title': entry.findtext('a:title', namespaces=ns) or '', 'published': (entry.findtext('a:published', namespaces=ns) or '')[:10] or None})
        return entries
    except ET.ParseError:
        log('feed was not XML')
        return []


def youtube_pages():
    """Upload order, titles, relative dates and counts from the public channel pages."""
    found, order, counts = {}, [], {}
    for page in ('shorts', 'videos'):
        raw = fetch(f'https://www.youtube.com/{HANDLE}/{page}', accept='text/html')
        if not raw:
            continue
        html = raw.decode('utf-8', 'ignore')
        subscribers = re.search(r'([0-9][0-9.,]*[KM]?) subscribers', html)
        videos = re.search(r'([0-9][0-9.,]*[KM]?) videos', html)
        if subscribers and 'subscribers' not in counts:
            counts['subscribers'] = count(subscribers[1])
        if videos and 'videos' not in counts:
            counts['videos'] = count(videos[1])
        for match in re.finditer(r'"videoId":"([\w-]{11})"', html):
            video = match[1]
            window = html[match.end():match.end() + 4000]
            title = re.search(r'"primaryText":\{"content":"((?:[^"\\]|\\.)*)"', window) or re.search(r'"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"', window)
            when = re.search(r'"publishedTimeText":\{"simpleText":"((?:[^"\\]|\\.)*)"', window)
            item = found.setdefault(video, {'id': video, 'title': '', 'published': None})
            if title and not item['title']:
                try:
                    item['title'] = json.loads('"' + title[1] + '"')
                except ValueError:
                    item['title'] = title[1]
            if when and not item['published']:
                item['published'] = relative(when[1])
            if video not in order:
                order.append(video)
    return [found[video] for video in order], counts


def oembed_title(video):
    raw = fetch('https://www.youtube.com/oembed?' + urllib.parse.urlencode({'url': 'https://www.youtube.com/watch?v=' + video, 'format': 'json'}), accept='application/json')
    if not raw:
        return ''
    try:
        return json.loads(raw).get('title', '')
    except ValueError:
        return ''


def thumbnail(video):
    """A local 360x640 WebP for one upload; Shorts carry a portrait frame, others are centre-cropped."""
    target = THUMBS / f'yt-{video}.webp'
    if target.exists():
        return True
    from PIL import Image  # Only needed when a new upload arrives.
    for name in ('oar2.jpg', 'oardefault.jpg', 'maxresdefault.jpg', 'hqdefault.jpg'):
        raw = fetch(f'https://i.ytimg.com/vi/{video}/{name}', accept='image/*')
        if not raw or len(raw) < 2000:
            continue
        try:
            image = Image.open(BytesIO(raw)).convert('RGB')
        except Exception:  # noqa: BLE001
            continue
        width, height = image.size
        if width / height > 9 / 16 + 0.01:
            new_width = int(height * 9 / 16)
            left = (width - new_width) // 2
            image = image.crop((left, 0, left + new_width, height))
        elif height / width > 16 / 9 + 0.01:
            new_height = int(width * 16 / 9)
            top = (height - new_height) // 2
            image = image.crop((0, top, width, top + new_height))
        image = image.resize((360, 640), Image.LANCZOS)
        THUMBS.mkdir(parents=True, exist_ok=True)
        image.save(target, 'WEBP', quality=82, method=6)
        return True
    return False


def refresh_youtube(previous):
    known = {item['id']: item for item in previous.get('latest', [])}
    result = {'channelId': CHANNEL_ID, 'handle': HANDLE, 'videos': previous.get('videos'), 'subscribers': previous.get('subscribers'), 'latest': [], 'source': previous.get('source')}
    api = youtube_api(os.environ['YOUTUBE_API_KEY']) if os.environ.get('YOUTUBE_API_KEY') else None
    latest, counts = [], {}
    if api:
        latest, counts = api['latest'], {'videos': api['videos'], 'subscribers': api['subscribers']}
        result['source'] = 'youtube-data-api'
    else:
        latest = youtube_feed()
        if latest:
            result['source'] = 'youtube-feed'
        scraped, counts = youtube_pages()
        if not latest and scraped:
            latest, result['source'] = scraped, 'youtube-pages'
        elif scraped:
            seen = {item['id'] for item in latest}
            # The feed is authoritative for what it lists; the pages add anything newer that it has not reached yet.
            newer = []
            for item in scraped:
                if item['id'] in seen:
                    break
                newer.append(item)
            latest = newer + latest
    if not latest and not counts:
        log('YouTube unreachable; keeping the committed figures')
        result['latest'] = previous.get('latest', [])
        return result, False
    for item in latest:
        old = known.get(item['id'], {})
        item['published'] = item.get('published') or old.get('published')
        item['title'] = item.get('title') or old.get('title') or oembed_title(item['id'])
    result['latest'] = [item for item in latest if item.get('title')][:LATEST]
    if counts.get('videos'):
        result['videos'] = counts['videos']
    if counts.get('subscribers'):
        result['subscribers'] = counts['subscribers']
    result['latest'] = [item for item in result['latest'] if thumbnail(item['id'])]
    return result, True


# --------------------------------------------------------------------------- Instagram
def refresh_instagram(previous):
    result = {'handle': INSTAGRAM, 'posts': previous.get('posts'), 'followers': previous.get('followers'), 'source': previous.get('source', 'manual')}
    token = os.environ.get('INSTAGRAM_TOKEN')
    if not token:
        return result, False
    raw = fetch('https://graph.instagram.com/me?' + urllib.parse.urlencode({'fields': 'media_count,followers_count,username', 'access_token': token}), accept='application/json')
    if not raw:
        log('Instagram Graph API unreachable; keeping the committed figures')
        return result, False
    try:
        data = json.loads(raw)
        if data.get('media_count') is not None:
            result['posts'] = int(data['media_count'])
        if data.get('followers_count') is not None:
            result['followers'] = int(data['followers_count'])
        result['source'] = 'instagram-graph-api'
        return result, True
    except (ValueError, TypeError, KeyError):
        return result, False


# -------------------------------------------------------------------------------- main
def load():
    if FEED.exists():
        return json.loads(FEED.read_text(encoding='utf-8'))
    return {'updated': None, 'youtube': {}, 'instagram': {}}


def check():
    feed = load()
    latest = feed.get('youtube', {}).get('latest', [])
    assert feed.get('updated') and feed['youtube'].get('videos'), 'feed.json needs a date and a video count'
    assert latest, 'feed.json lists no uploads'
    for item in latest:
        assert re.fullmatch(r'[\w-]{11}', item['id']) and item.get('title'), item
        assert (THUMBS / f"yt-{item['id']}.webp").is_file(), 'missing thumbnail for ' + item['id']
    stale = sorted(path.name for path in THUMBS.glob('yt-*.webp') if path.stem[3:] not in {item['id'] for item in latest})
    assert not stale, 'thumbnails no longer on the wall: ' + ', '.join(stale)
    print(f"channels: feed of {feed['updated']} is consistent: {feed['youtube']['videos']} videos, {len(latest)} on the wall.")


def main():
    if '--check' in sys.argv:
        check()
        return
    feed = load()
    youtube, youtube_changed = refresh_youtube(feed.get('youtube', {}))
    instagram, instagram_changed = refresh_instagram(feed.get('instagram', {}))
    if not youtube_changed and not instagram_changed:
        log('nothing reachable; feed.json left as it was')
        return
    keep = {f"yt-{item['id']}.webp" for item in youtube['latest']}
    for path in THUMBS.glob('yt-*.webp'):
        if path.name not in keep:
            path.unlink()
    feed = {'updated': TODAY.isoformat(), 'youtube': youtube, 'instagram': instagram}
    FEED.write_text(json.dumps(feed, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    log(f"{youtube['videos']} videos, {youtube.get('subscribers')} subscribers, {len(youtube['latest'])} newest uploads kept ({youtube['source']}); Instagram {instagram['posts']} posts ({instagram['source']}).")


if __name__ == '__main__':
    main()
