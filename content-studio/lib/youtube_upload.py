#!/usr/bin/env python3
"""Upload one video to YouTube, resumably, with no third-party dependencies.

    python3 youtube_upload.py video.mp4 meta.json [--thumbnail t.jpg] [--dry-run]
    python3 youtube_upload.py --set-thumbnail VIDEO_ID thumb.jpg
    python3 youtube_upload.py --update VIDEO_ID meta.json

meta.json: {"title": ..., "description": ..., "tags": [...],
            "privacyStatus": "private|unlisted|public",
            "categoryId": "20", "madeForKids": false}

Auth needs an OAuth client that belongs to the project. gcloud's own
application-default client does NOT work: Google blocklists it for sensitive
scopes, so `gcloud auth application-default login --scopes=...youtube.upload`
ends at "This app is blocked" no matter how the scopes are spelled. Create a
Desktop client in the Console once, save the download to

    ~/.config/content-studio/youtube-oauth-client.json     (mode 600)

and this file runs the loopback consent flow itself, then keeps the refresh
token in ~/.config/content-studio/credentials.json under `youtube`. Both live
outside every repo on purpose - a token cannot be committed from there.

WHAT TO EXPECT. An upload from an API project that has not passed a YouTube
compliance audit comes back `private` with `uploadStatus: rejected` reason
`youtubeSignupRequired` or with privacyStatus forced private, and the channel
owner cannot change it afterwards. This tool therefore prints the privacyStatus
the API actually returned next to the one that was asked for. If they differ,
the project is unaudited and the answer is to upload by hand - see
skills/social-publishing.

Resumable rather than a single POST because a 6MB file over a home connection
is exactly the size that fails often enough to matter and cheaply enough to
retry. The session URL survives a dropped socket; a multipart POST does not.
"""
import http.server
import json
import mimetypes
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

API = 'https://www.googleapis.com/youtube/v3'
UPLOAD = 'https://www.googleapis.com/upload/youtube/v3'
CHUNK = 8 << 20


CONF = Path.home() / '.config' / 'content-studio'
CRED = CONF / 'credentials.json'
CLIENT = CONF / 'youtube-oauth-client.json'
# force-ssl, not just upload: `videos.insert` is happy with youtube.upload but
# `videos.update` answers 403 insufficientPermissions on it, and editing a title
# after the fact is not an edge case. Ask for both at first consent or the second
# scope costs another trip through the browser.
SCOPES = ('https://www.googleapis.com/auth/youtube.upload '
          'https://www.googleapis.com/auth/youtube.force-ssl '
          'https://www.googleapis.com/auth/youtube.readonly')


def _post_form(url, fields):
    raw = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(url, data=raw, method='POST', headers={
        'Content-Type': 'application/x-www-form-urlencoded'})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        sys.exit(f'token endpoint: HTTP {e.code} '
                 f'{e.read()[:300].decode(errors="replace")}')


def _client():
    if not CLIENT.exists():
        sys.exit(f'no OAuth client at {CLIENT}. Create a Desktop client in the '
                 f'Console for this project and save the download there '
                 f'(chmod 600). gcloud ADC cannot be used - see the docstring.')
    d = json.loads(CLIENT.read_text())
    d = d.get('installed') or d.get('web') or d
    return d['client_id'], d['client_secret']


def _save(**fields):
    """Merge into the `youtube` block, leaving every other block alone."""
    cred = json.loads(CRED.read_text()) if CRED.exists() else {}
    cred.setdefault('youtube', {}).update(fields)
    CRED.write_text(json.dumps(cred, indent=2) + '\n')
    CRED.chmod(0o600)


def consent():
    """Loopback consent, stdlib only. A Desktop client accepts any localhost
    port, so bind 0 and let the OS choose rather than hoping a fixed one is
    free."""
    cid, secret = _client()
    box = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            box.update({k: v[0] for k, v in q.items()})
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'Done. Close this tab and go back to the terminal.')

        def log_message(self, *a):
            pass

    srv = http.server.HTTPServer(('127.0.0.1', 0), Handler)
    redirect = f'http://127.0.0.1:{srv.server_port}'
    url = ('https://accounts.google.com/o/oauth2/v2/auth?' + urllib.parse.urlencode({
        'client_id': cid, 'redirect_uri': redirect, 'response_type': 'code',
        'scope': SCOPES, 'access_type': 'offline', 'prompt': 'consent'}))
    print('Open this and grant access as the account that manages the channel:')
    print('\n  ' + url + '\n')
    try:
        webbrowser.open(url)
    except Exception:
        pass
    srv.handle_request()
    if 'code' not in box:
        sys.exit(f'consent did not return a code: {box}')
    t = _post_form('https://oauth2.googleapis.com/token', {
        'code': box['code'], 'client_id': cid, 'client_secret': secret,
        'redirect_uri': redirect, 'grant_type': 'authorization_code'})
    if 'refresh_token' not in t:
        sys.exit('no refresh token came back. Revoke the app at '
                 'myaccount.google.com/permissions and retry - Google only '
                 'issues one on first consent.')
    _save(clientId=cid, clientSecret=secret, refreshToken=t['refresh_token'])
    print(f'refresh token saved to {CRED}')
    return t['access_token']


def token():
    y = (json.loads(CRED.read_text()).get('youtube', {})
         if CRED.exists() else {})
    if y.get('refreshToken') and y.get('clientId'):
        t = _post_form('https://oauth2.googleapis.com/token', {
            'client_id': y['clientId'], 'client_secret': y['clientSecret'],
            'refresh_token': y['refreshToken'], 'grant_type': 'refresh_token'})
        return t['access_token']
    return consent()


def call(url, tok, method='GET', body=None, headers=None, raw=None):
    h = {'Authorization': f'Bearer {tok}'}
    if body is not None:
        raw = json.dumps(body).encode()
        h['Content-Type'] = 'application/json'
    h.update(headers or {})
    req = urllib.request.Request(url, data=raw, headers=h, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, dict(resp.headers), resp.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()


def show_error(what, status, payload):
    try:
        err = json.loads(payload)['error']
        msg = err.get('message', '')
        reasons = ','.join(d.get('reason', '') for d in err.get('errors', []))
    except Exception:
        msg, reasons = payload[:400].decode(errors='replace'), ''
    sys.exit(f'{what} failed: HTTP {status} {reasons} {msg}')


def whoami(tok):
    """The channel about to be written to. Worth one call: the OAuth account can
    own several channels and the API silently picks the default one, which is how
    a video lands on a personal channel instead of the brand's."""
    status, _, payload = call(f'{API}/channels?part=snippet,statistics&mine=true',
                              tok)
    if status != 200:
        show_error('channels.list', status, payload)
    items = json.loads(payload).get('items', [])
    if not items:
        sys.exit('this account owns no channel the API can see. If the target is '
                 'a Brand Account, sign in as it during the gcloud login.')
    return items[0]


def upload(path, meta, tok):
    size = path.stat().st_size
    body = {
        'snippet': {
            'title': meta['title'],
            'description': meta['description'],
            'tags': meta.get('tags', []),
            'categoryId': str(meta.get('categoryId', '20')),
        },
        'status': {
            'privacyStatus': meta.get('privacyStatus', 'private'),
            'selfDeclaredMadeForKids': bool(meta.get('madeForKids', False)),
        },
    }
    status, headers, payload = call(
        f'{UPLOAD}/videos?uploadType=resumable&part=snippet,status', tok,
        method='POST', body=body,
        headers={'X-Upload-Content-Length': str(size),
                 'X-Upload-Content-Type': mimetypes.guess_type(path.name)[0]
                 or 'video/mp4'})
    if status not in (200, 201):
        show_error('resumable session', status, payload)
    session = headers['Location']

    sent = 0
    data = path.read_bytes()
    while sent < size:
        end = min(sent + CHUNK, size) - 1
        st, _, pl = call(session, tok, method='PUT', raw=data[sent:end + 1],
                         headers={'Content-Length': str(end - sent + 1),
                                  'Content-Range': f'bytes {sent}-{end}/{size}'})
        # 308 is the server asking for the next chunk, not an error.
        if st in (200, 201):
            return json.loads(pl)
        if st != 308:
            show_error(f'chunk {sent}-{end}', st, pl)
        sent = end + 1
        print(f'  {sent / size:.0%}')
    sys.exit('upload ran out of bytes without a final response')


def set_thumbnail(video_id, thumb, tok):
    """Replace the thumbnail on a video that is already up.

    Separate from the upload path because thumbnails get iterated on long after
    the video lands - a better cut of the same image, a layout fix, a Test &
    Compare loser being retired - and re-uploading a video to change its picture
    would burn 1,600 quota units and a fresh URL. This costs 50.
    """
    if thumb.stat().st_size > 2 * 1024 * 1024:
        sys.exit(f'{thumb.name} is over 2MB, which YouTube rejects.')
    st, _, pl = call(f'{UPLOAD}/thumbnails/set?videoId={video_id}', tok,
                     method='POST', raw=thumb.read_bytes(),
                     headers={'Content-Type': 'image/jpeg'})
    if st != 200:
        show_error('thumbnails.set', st, pl)
    print(f'https://youtu.be/{video_id}')
    print(f'  thumbnail      set from {thumb.name} '
          f'({thumb.stat().st_size / 1024:.0f}KB)')
    print('  Studio can take a few minutes to show the new image, and a stale '
          'one often survives a browser cache - check in an incognito window '
          'before re-pushing.')
    return json.loads(pl)


def update(video_id, meta, tok):
    """Rewrite title/description/tags on an existing video.

    videos.update REPLACES the parts it is given rather than merging, so the
    whole snippet goes every time - a partial one silently blanks the fields it
    leaves out, and categoryId is not optional even when it is unchanged.
    """
    body = {'id': video_id, 'snippet': {
        'title': meta['title'], 'description': meta['description'],
        'tags': meta.get('tags', []),
        'categoryId': str(meta.get('categoryId', '20'))}}
    st, _, pl = call(f'{API}/videos?part=snippet', tok, method='PUT', body=body)
    if st != 200:
        show_error('videos.update', st, pl)
    v = json.loads(pl)
    print(f"updated https://youtu.be/{video_id}")
    print(f"  title  {v['snippet']['title']}")
    print(f"  tags   {len(v['snippet'].get('tags', []))}")
    print(f"  desc   {len(v['snippet']['description'])} chars, "
          f"{len(v['snippet']['description'].split())} words")
    return v


def surface(video):
    """Which surface YouTube will file this file under, or None if unknowable.

    Vertical and under three minutes becomes a Short automatically - there is no
    setting for it and no way to opt out. Worth printing before an upload because
    the two aspect ratios of one cut are different posts with different text, and
    sending the wrong file is silent: it uploads fine and lands in the wrong place.
    """
    try:
        out = subprocess.run(
            ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
             '-show_entries', 'stream=width,height', '-show_entries',
             'format=duration', '-of', 'default=nw=1:nk=1', str(video)],
            capture_output=True, text=True, timeout=20)
        if out.returncode:
            return None
        w, h, dur = (float(x) for x in out.stdout.split()[:3])
    except (OSError, ValueError, subprocess.SubprocessError):
        return None
    if h > w and dur <= 180:
        return (f'Short (vertical {int(w)}x{int(h)}, {dur:.0f}s) - not eligible '
                'for Test & Compare')
    return (f'long-form ({int(w)}x{int(h)}, {dur:.0f}s)'
            + (' - vertical but over 3 min' if h > w else ''))


def main():
    args = sys.argv[1:]
    dry = '--dry-run' in args
    args = [a for a in args if a != '--dry-run']
    if '--set-thumbnail' in args:
        i = args.index('--set-thumbnail')
        set_thumbnail(args[i + 1], Path(args[i + 2]), token())
        return
    if '--update' in args:
        i = args.index('--update')
        vid = args[i + 1]
        meta = json.loads(Path(args[i + 2]).read_text())
        update(vid, meta, token())
        return
    thumb = None
    if '--thumbnail' in args:
        i = args.index('--thumbnail')
        thumb = Path(args[i + 1])
        args = args[:i] + args[i + 2:]
    if len(args) != 2:
        sys.exit(__doc__)
    video, meta = Path(args[0]), json.loads(Path(args[1]).read_text())

    tok = token()
    ch = whoami(tok)
    print(f"channel: {ch['snippet']['title']}  ({ch['id']})  "
          f"{ch['statistics'].get('subscriberCount', '?')} subs")
    want = meta.get('privacyStatus', 'private')
    print(f"video:   {video.name}  {video.stat().st_size / 1e6:.1f} MB  "
          f"asking for {want}")
    s = surface(video)
    if s:
        print(f"surface: {s}")
    if dry:
        print('dry run, nothing uploaded')
        return

    v = upload(video, meta, tok)
    got = v['status']['privacyStatus']
    print(f"\nhttps://youtu.be/{v['id']}")
    print(f"  uploadStatus   {v['status']['uploadStatus']}")
    print(f"  privacyStatus  {got}" +
          ('' if got == want else f'  <- ASKED FOR {want.upper()}'))
    if got != want:
        print('  The project is unaudited: the API forced the visibility and '
              'Studio cannot change it. Delete this and upload by hand.')
    if v['status'].get('rejectionReason'):
        print(f"  rejected       {v['status']['rejectionReason']}")

    if thumb:
        st, _, pl = call(f'{UPLOAD}/thumbnails/set?videoId={v["id"]}', tok,
                         method='POST', raw=thumb.read_bytes(),
                         headers={'Content-Type': 'image/jpeg'})
        print(f"  thumbnail      {'set' if st == 200 else f'FAILED {st}'}")
        if st != 200:
            print('   ', pl[:200].decode(errors='replace'))


if __name__ == '__main__':
    main()
