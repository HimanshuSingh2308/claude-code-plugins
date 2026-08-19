#!/usr/bin/env python3
"""Publish one Reel to Instagram through the Graph API, no third-party deps.

    python3 instagram_publish.py --status
    python3 instagram_publish.py --discover
    python3 instagram_publish.py --set-ig-user-id 178414...
    python3 instagram_publish.py --exchange APP_ID APP_SECRET
    python3 instagram_publish.py --publish clip.mp4 cover.jpg caption.txt --confirm

READ THIS BEFORE RUNNING --publish. There is no draft endpoint and no scheduling
endpoint. `media_publish` puts the post on the live grid the moment it returns,
and the API gives you no way to un-publish it - deleting is a manual step in the
app. That is why --publish refuses to do anything without --confirm, and why it
prints the caption and the resolved account handle first. The API also cannot
attach trending audio, which is a real reach cost on Reels; posting by hand is
often still the better product decision. See skills/social-publishing.

THREE THINGS THE API NEEDS, and each one fails differently:

1. An IG user id. Not the handle - a numeric node id. The documented way to find
   it is `me/accounts` -> `instagram_business_account`, which needs the token to
   carry `pages_show_list` ON TOP of the publishing scopes. A token with only
   `instagram_basic` + `instagram_content_publish` can publish perfectly well but
   cannot discover its own account, so `me/accounts` answers `{"data": []}` and
   looks exactly like "no Page is linked". Those two causes are
   indistinguishable from the outside; --discover says so rather than guessing.
   Once the id is known it is stored and never looked up again.

2. Public HTTPS URLs for the video and the cover. There is no file upload on this
   API - `video_url` and `cover_url` are fetched by Instagram's servers, so a
   local path, a localhost tunnel or a signed URL that expires in minutes will
   not do. --publish stages both onto a Firebase Hosting preview channel, waits
   for the container to finish, publishes, then deletes the channel.

3. A token that outlives the job. Graph API Explorer hands out ~1-2 hour user
   tokens; container processing for a 9:16 clip is minutes, so a token minted
   before lunch can expire mid-poll. --exchange swaps one for a 60-day token,
   which needs the app id and secret from the App Dashboard.
"""
import json
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

GRAPH = 'https://graph.facebook.com/v21.0'
CONF = Path.home() / '.config' / 'content-studio'
CRED = CONF / 'credentials.json'
PROJECT = 'weekly-arcade'
CHANNEL = 'ig-stage'


def _cred():
    return json.loads(CRED.read_text()) if CRED.exists() else {}


def _save(**fields):
    """Merge into the `instagram` block, leaving every other block alone."""
    cred = _cred()
    cred.setdefault('instagram', {}).update(fields)
    CRED.write_text(json.dumps(cred, indent=2) + '\n')
    CRED.chmod(0o600)


def call(path, method='GET', **params):
    """Graph calls are form-encoded, not JSON, including the POSTs."""
    params['access_token'] = _token()
    raw = urllib.parse.urlencode(params).encode()
    if method == 'GET':
        url, data = f'{GRAPH}/{path}?' + raw.decode(), None
    else:
        url, data = f'{GRAPH}/{path}', raw
    req = urllib.request.Request(url, data=data, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {}


def die(what, status, payload):
    err = payload.get('error', {})
    bits = [f'HTTP {status}']
    for k in ('code', 'error_subcode', 'type'):
        if err.get(k):
            bits.append(f'{k}={err[k]}')
    sys.exit(f'{what} failed: {" ".join(bits)} {err.get("message", payload)}')


def _token():
    ig = _cred().get('instagram', {})
    # A long-lived token if --exchange has been run, else whatever was pasted in.
    tok = ig.get('accessToken') or ig.get('userToken')
    if not tok:
        sys.exit(f'no Instagram token in {CRED}. Paste a user token into '
                 f'instagram.userToken, or run --exchange to mint a long-lived one.')
    return tok


def _expiry_note():
    """Whether the stored token will still be alive when a publish finishes."""
    st, d = call('debug_token', input_token=_token())
    if st != 200:
        return None
    exp = d.get('data', {}).get('expires_at') or 0
    if not exp:
        return 'never expires'
    left = exp - int(time.time())
    if left <= 0:
        return 'EXPIRED - mint a new one'
    hrs = left / 3600
    urgent = ' (too short for a publish - run --exchange)' if hrs < 1 else ''
    return f'{hrs:.1f}h left{urgent}'


def _sh(*args, check=True, cwd=None):
    r = subprocess.run(args, capture_output=True, text=True, cwd=cwd)
    if check and r.returncode:
        sys.exit(f'{args[0]} failed: {(r.stderr or r.stdout).strip()[:500]}')
    return r


def _host_ready():
    """Firebase CLI, logged in, and able to see the project."""
    if not shutil.which('firebase'):
        return 'firebase CLI not installed'
    r = _sh('firebase', 'projects:list', '--json', check=False)
    if r.returncode:
        return 'firebase CLI cannot list projects - run `firebase login`'
    try:
        ids = {p.get('projectId') for p in json.loads(r.stdout).get('result', [])}
    except Exception:
        return 'could not parse `firebase projects:list --json`'
    return None if PROJECT in ids else f'account cannot see project {PROJECT}'


def status():
    ig = _cred().get('instagram', {})
    st, me = call('me', fields='id,name')
    print(f'token      : {"valid" if st == 200 else "REJECTED"}'
          f'{" as " + me.get("name", "?") if st == 200 else ""}')
    if st == 200:
        print(f'lifetime   : {_expiry_note()}')
        _, perms = call('me/permissions')
        got = sorted(p['permission'] for p in perms.get('data', [])
                     if p.get('status') == 'granted')
        print(f'scopes     : {", ".join(got) or "none"}')
        for need in ('instagram_basic', 'instagram_content_publish'):
            if need not in got:
                print(f'  MISSING {need} - cannot publish without it')
        if not ig.get('igUserId'):
            for s, why in (('pages_show_list', 'the Page route'),
                           ('business_management', 'the Business portfolio route')):
                if s not in got:
                    print(f'  MISSING {s} - --discover cannot use {why}')
    print(f'ig user id : {ig.get("igUserId") or "NOT SET - run --discover"}')
    if ig.get('igUserId'):
        s, d = call(ig['igUserId'], fields='username,media_count')
        print(f'  resolves to @{d.get("username", "?")}, {d.get("media_count", "?")} posts'
              if s == 200 else f'  does NOT resolve: {d.get("error", {}).get("message")}')
        s, d = call(f'{ig["igUserId"]}/content_publishing_limit',
                    fields='quota_usage,config')
        if s == 200 and d.get('data'):
            q = d['data'][0]
            print(f'  posts used : {q.get("quota_usage")}/'
                  f'{q.get("config", {}).get("quota_total", 50)} in the last 24h')
    bad = _host_ready()
    print(f'staging    : {bad if bad else f"Firebase Hosting channel on {PROJECT}, ready"}')


def _expected():
    """The handle we are supposed to be posting to.

    `instagram.handle` in credentials.json is configuration, not a discovery
    result: it names the intended account and is written by hand. Discovery must
    be checked against it and must never overwrite it. The reason is not
    hypothetical - the first token that could see Pages at all resolved to
    "CodeChef LPU Chapter" / @codecheflpu, a real and perfectly functional
    account belonging to something else entirely. A tool that trusts discovery
    posts a launch Reel to a stranger's grid and cannot un-publish it.
    """
    return (_cred().get('instagram', {}).get('handle') or '').lstrip('@').lower()


def _confirm_handle(ig_id, force=False):
    """Resolve an id to its username and refuse if it is not the intended one."""
    st, d = call(ig_id, fields='username')
    if st != 200:
        die(f'lookup of {ig_id}', st, d)
    got = (d.get('username') or '').lower()
    want = _expected()
    if want and got != want and not force:
        sys.exit(f'REFUSING: {ig_id} is @{got}, but the configured target is '
                 f'@{want}. Publishing here would post to the wrong account, and '
                 f'the API cannot un-publish. If @{got} really is the target, '
                 f'change instagram.handle in {CRED} first.')
    return got


def _candidates():
    """Every Instagram account this token can reach, by both routes.

    There are two ways an Instagram professional account is attached to Meta's
    graph and they are reached by completely different edges:

      Page route      me/accounts -> instagram_business_account
                      The classic setup and the only one most docs describe.
                      Needs `pages_show_list`.

      Portfolio route me/businesses -> owned_instagram_accounts
                      An Instagram account added straight to a Business
                      portfolio, with no Facebook Page anywhere. Invisible to
                      me/accounts however many scopes you add, which reads as
                      "the account does not exist". Needs `business_management`.

    @weeklyarcade.games is the second kind, so the Page route alone was never
    going to find it. Both are tried, and each failure names the scope it wants
    rather than being silently skipped.
    """
    out, notes = [], []
    st, d = call('me/accounts',
                 fields='id,name,instagram_business_account{id,username}')
    if st != 200:
        notes.append(f'Page route unavailable: {d.get("error", {}).get("message")}')
    else:
        for pg in d.get('data', []):
            iba = pg.get('instagram_business_account') or {}
            if iba.get('id'):
                out.append({'id': iba['id'], 'username': iba.get('username', ''),
                            'via': f'Page "{pg["name"]}" ({pg["id"]})'})
        if not d.get('data'):
            notes.append('Page route saw no Pages')

    st, d = call('me/businesses', fields='id,name')
    if st != 200:
        notes.append('portfolio route unavailable: '
                     f'{d.get("error", {}).get("message")} '
                     '(add business_management to the token)')
    else:
        for b in d.get('data', []):
            for edge in ('owned_instagram_accounts', 'client_instagram_accounts'):
                s, r = call(f'{b["id"]}/{edge}', fields='id,username')
                if s != 200:
                    notes.append(f'{b["name"]}/{edge}: '
                                 f'{r.get("error", {}).get("message")}')
                    continue
                for ig in r.get('data', []):
                    out.append({'id': ig['id'],
                                'username': ig.get('username', ''),
                                'via': f'portfolio "{b["name"]}" ({edge})'})
    # The same account can appear on both edges; first sighting wins.
    seen, uniq = set(), []
    for c in out:
        if c['id'] not in seen:
            seen.add(c['id'])
            uniq.append(c)
    return uniq, notes


def discover():
    """Find the IG user id, and be honest when it cannot."""
    cands, notes = _candidates()
    for n in notes:
        print(f'  note: {n}')
    for c in cands:
        print(f'@{c["username"] or "?"} -> {c["id"]}   via {c["via"]}')
    want = _expected()
    if not cands:
        sys.exit('\nno Instagram account is reachable by either route. If the '
                 'account lives in a Business portfolio with no Facebook Page - '
                 'which is now the common setup - the token needs '
                 '`business_management`, and without it the account is invisible '
                 'rather than reported missing. Re-issue with that scope added. '
                 'Failing that, read the numeric id off Meta Business Suite and '
                 'use --set-ig-user-id.')
    match = [c for c in cands if c['username'].lower() == want]
    if want and not match:
        sys.exit(f'\nnone of these is the target (@{want}). Reachable: '
                 + ', '.join('@' + (c["username"] or "?") for c in cands)
                 + '.\nIf @' + want + ' is in a Business portfolio, the token '
                 'likely lacks business_management - see the notes above.')
    if len(match or cands) > 1:
        sys.exit('more than one candidate - pass the right one to '
                 '--set-ig-user-id rather than letting this pick.')
    c = (match or cands)[0]
    # handle is deliberately NOT written here - see _expected().
    _save(igUserId=c['id'])
    print(f'\nsaved igUserId {c["id"]} (@{c["username"]}) to {CRED}')


def set_ig_user_id(ig_id, force=False):
    got = _confirm_handle(ig_id, force)
    st, d = call(ig_id, fields='username,account_type')
    _save(igUserId=ig_id, accountType=(d.get('account_type') or '').lower())
    print(f'{ig_id} is @{got} ({d.get("account_type")}) - saved')


def exchange(app_id, app_secret):
    """Short-lived user token -> ~60-day token. Worth doing before anything
    depends on a schedule: a publish that outlives its token fails halfway,
    after the container has been built and the files staged."""
    st, d = call('oauth/access_token', grant_type='fb_exchange_token',
                 client_id=app_id, client_secret=app_secret,
                 fb_exchange_token=_token())
    if st != 200:
        die('token exchange', st, d)
    _save(accessToken=d['access_token'], tokenType='long_lived_user',
          appId=app_id, appSecret=app_secret,
          tokenExpiresAt=int(time.time()) + int(d.get('expires_in', 0)))
    print(f'long-lived token saved, {int(d.get("expires_in", 0)) / 86400:.0f} days')


def _stage(paths):
    """Put the files on a throwaway Hosting channel and return (dir, base URL).

    Cloud Storage would be the obvious host, but the weekly-arcade project has no
    billing account, so there are no buckets to put anything in. A Hosting preview
    channel costs nothing, hands back a real public HTTPS URL, and expires on its
    own - which is a better fit than a bucket regardless.

    A channel of its own, never a path on the live site: the live site is the
    product, and a launch video parked in its public directory would ship with
    every later deploy of anything else. This channel holds these files and
    nothing else, and gets deleted when the publish finishes.
    """
    stage = Path(tempfile.mkdtemp(prefix='ig-stage-'))
    (stage / 'firebase.json').write_text(json.dumps(
        {'hosting': {'public': '.', 'ignore': ['firebase.json']}}))
    for p in paths:
        shutil.copy2(p, stage / p.name)
    r = _sh('firebase', 'hosting:channel:deploy', CHANNEL, '--project', PROJECT,
            '--expires', '1d', '--json', cwd=stage)
    try:
        res = json.loads(r.stdout)['result']
        url = next(v['url'] for v in res.values() if isinstance(v, dict) and v.get('url'))
    except Exception:
        shutil.rmtree(stage, ignore_errors=True)
        sys.exit(f'could not read the channel URL out of:\n{r.stdout[:500]}')
    return stage, url.rstrip('/')


def _unstage(stage):
    _sh('firebase', 'hosting:channel:delete', CHANNEL, '--project', PROJECT,
        '--force', check=False, cwd=stage)
    shutil.rmtree(stage, ignore_errors=True)


# The bundle's CAPTION.txt is a document a human reads: a title line, the caption,
# then COVER / AUDIO / SHARE TO FEED notes. It is the plugin's own standard output,
# so it is exactly what someone will hand to --publish, and the API would happily
# post the notes along with everything else. Refuse it and ask for the payload.
BUNDLE_MARKERS = ('CAPTION', 'COVER', 'AUDIO', 'SHARE TO FEED', 'COLLAB',
                  'INSTAGRAM REEL', 'THUMBNAIL', 'TITLE', 'DESCRIPTION', 'TAGS')


def _caption_of(path):
    text = path.read_text().strip()
    hits = [ln.strip() for ln in text.splitlines()
            if ln.strip() and ln.strip() == ln.lstrip()
            and any(ln.strip().upper().startswith(m) for m in BUNDLE_MARKERS)]
    if hits:
        sys.exit(f'{path.name} looks like a bundle document, not a caption: it has '
                 f'section headers {hits[:3]}. Publishing it would put those lines '
                 f'on the post. Extract just the caption into its own file and pass '
                 f'that instead.')
    if len(text) > 2200:
        sys.exit(f"caption is {len(text)} chars, over Instagram's 2,200 cap")
    return text


def publish(video, cover, caption_file, confirmed):
    ig = _cred().get('instagram', {})
    ig_id = ig.get('igUserId')
    if not ig_id:
        sys.exit('no igUserId stored. Run --discover (or --set-ig-user-id) first.')
    for f in (video, cover, caption_file):
        if not f.exists():
            sys.exit(f'{f} does not exist')
    caption = _caption_of(caption_file)

    # Re-resolved, not read from the config: the stored id is the thing most
    # likely to be stale or wrong, and this is the last point at which being
    # wrong is still recoverable.
    who = _confirm_handle(ig_id, '--force-account' in sys.argv)
    print(f'account : @{who} ({ig_id})')
    print(f'video   : {video.name} {video.stat().st_size / 1e6:.1f}MB')
    print(f'cover   : {cover.name}')
    print(f'caption : {len(caption)} chars, first line:\n  {caption.splitlines()[0]}')
    if not confirmed:
        sys.exit('\nthis goes live immediately and cannot be un-published by the '
                 'API. Re-run with --confirm if that is what you want.')
    bad = _host_ready()
    if bad:
        sys.exit(f'cannot stage the files: {bad}')

    stage = None
    try:
        stage, base = _stage([video, cover])
        vurl = f'{base}/{urllib.parse.quote(video.name)}'
        curl = f'{base}/{urllib.parse.quote(cover.name)}'
        print(f'staged  : {vurl}')

        st, d = call(f'{ig_id}/media', method='POST', media_type='REELS',
                     video_url=vurl, cover_url=curl, caption=caption,
                     share_to_feed='true')
        if st != 200:
            die('media container', st, d)
        cid = d['id']
        print(f'container {cid}, waiting for Instagram to fetch and transcode')

        # Instagram fetches and transcodes on its own schedule; a 9:16 clip is
        # usually under a minute but the container stays valid for 24h and the
        # docs promise nothing, so poll rather than sleep-and-hope.
        for _ in range(60):
            time.sleep(5)
            st, s = call(cid, fields='status_code,status')
            code = s.get('status_code')
            if code == 'FINISHED':
                break
            if code in ('ERROR', 'EXPIRED'):
                sys.exit(f'container {code}: {s.get("status")}')
            print(f'  {code or st}...')
        else:
            sys.exit('container never finished in 5 minutes. It stays valid for '
                     f'24h - resume with media_publish on creation_id={cid}.')

        st, d = call(f'{ig_id}/media_publish', method='POST', creation_id=cid)
        if st != 200:
            die('media_publish', st, d)
        mid = d['id']
        _, link = call(mid, fields='permalink')
        print(f'\nPUBLISHED {mid}\n{link.get("permalink", "(no permalink yet)")}')
    finally:
        # After media_publish Instagram holds its own copy, so the staged files
        # have done their job. Torn down even on failure: a half-published run
        # should not leave the video on a public URL.
        if stage:
            _unstage(stage)
            print(f'deleted the {CHANNEL} channel')


def main():
    a = sys.argv[1:]
    if not a or '--status' in a:
        return status()
    if '--discover' in a:
        return discover()
    if '--set-ig-user-id' in a:
        return set_ig_user_id(a[a.index('--set-ig-user-id') + 1],
                              '--force-account' in a)
    if '--exchange' in a:
        i = a.index('--exchange')
        return exchange(a[i + 1], a[i + 2])
    if '--publish' in a:
        i = a.index('--publish')
        return publish(Path(a[i + 1]), Path(a[i + 2]), Path(a[i + 3]),
                       '--confirm' in a)
    sys.exit(__doc__)


if __name__ == '__main__':
    main()
