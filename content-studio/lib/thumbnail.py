#!/usr/bin/env python3
"""Thumbnail generator: N variants per video, from the video itself.

    python3 thumbnail.py spec.json outdir

Locked channel tool, same status as sfx.py: the layouts, the contrast floor and
the legibility checks are the channel's, not the video's. Add a strategy when a
new hook shape appears; do not re-tune these per upload.

WHY IT ALWAYS EMITS MORE THAN ONE. YouTube Studio's Test & Compare takes up to
three thumbnails on a public long-form video and picks the winner on real
impressions, so a generator that emits one option throws away the only free CTR
experiment the platform gives us. Shorts and Reels are NOT eligible, so there the
extra variants are for a human choosing at feed size - which is what the contact
sheet is for.

The variants must differ on ONE axis, or a finished test says nothing. The three
strategies below are that axis - how much text, and which hook:

    claim      3 words, a number or the price. The strongest single hook there is.
    curiosity  2 words plus a cue, states the cadence and withholds the payoff.
    subject    1 word. Tests whether type is helping at all.

Measured ground the layouts sit on (2024-2026 aggregate studies, 1of10 /
ThumbnailTest / Statista): under 4 words of text outperforms text-heavy by ~30%;
a directional cue (ring or arrow) is worth up to 25%; optimised thumbnails move
CTR 25-40% overall. Faces are worth 20-35% and we have none - browser games have
no presenter - so the subject slot is filled by the most visually active frame in
the cut instead, picked by measurement rather than by scrubbing.
"""
import json
import math
import subprocess
import sys
from pathlib import Path

from PIL import (Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont,
                 ImageStat)

# 1280x720 is YouTube's spec and also the size the image is JUDGED at about a
# sixth of: a feed card is ~210px wide on mobile. Every check below is really a
# check about that smaller size.
YT = (1280, 720)
COVER = (1080, 1920)
# Reels covers get cropped twice - to 3:4 in the profile grid and to 1:1 in feed -
# so nothing readable may sit in the top or bottom 480px of a 1920 cover.
COVER_SAFE = (480, 1440)

AMBER = (0xFF, 0xC9, 0x3D)
WHITE = (0xFF, 0xFF, 0xFF)
INK = (0x0B, 0x0D, 0x14)

WORD_CAP = 3            # warn past this; the 30% CTR gap sits at 4
MIN_CAP_FRAC = 0.13     # cap height as a fraction of frame height
MIN_RATIO = 4.5         # WCAG AA on the pixels actually under the type
JPEG_MAX = 2 * 1024 * 1024


def sh(*a):
    subprocess.run(a, check=True, capture_output=True)


def duration(video):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries',
                          'format=duration', '-of', 'csv=p=0', video],
                         check=True, capture_output=True, text=True)
    return float(out.stdout.strip())


def lum(rgb):
    def c(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (c(x) for x in rgb[:3])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def score_frame(im):
    """How much is going on in this frame.

    Edge energy times saturation. A launch cut is mostly gradient, and gradient
    scores near zero on both terms - which is the point: the frames that win are
    the ones with a game actually happening in them. Scrubbing by hand picks the
    frame you remember, which is not the same thing as the frame that reads at
    210px wide.
    """
    small = im.convert('RGB').resize((320, 180), Image.LANCZOS)
    tiny = small.resize((64, 36), Image.LANCZOS)

    def edges(x):
        return ImageStat.Stat(x.convert('L').filter(ImageFilter.FIND_EDGES)).mean[0]

    # Two scales, weighted toward the coarse one. Detail alone rewards confetti -
    # a field of 30 identical coins scores higher than a character under a tree,
    # and at feed width the coins are noise while the character is a subject. Big
    # shapes keep their edges through a 64px downscale; small repeated ones do not.
    structure, detail = edges(tiny), edges(small)
    sat = ImageStat.Stat(small.convert('HSV').getchannel('S')).mean[0]
    # Colour range, so a frame that is one flat hue loses to one with a palette.
    variety = sum(ImageStat.Stat(small).stddev) / 3.0
    return ((0.72 * structure + 0.28 * detail)
            * (0.35 + sat / 255.0) * (0.45 + variety / 64.0))


def best_panel(im, panels):
    """Which vertical slice of a multi-panel strip is the strongest subject.

    A 3-up montage strip is three games, and a thumbnail has room for one. Left
    alone, `cover` crops the middle - which is the panel the layout put there for
    composition reasons, not the one with anything happening in it.
    """
    if panels <= 1:
        return im
    w = im.width // panels
    best = max(range(panels),
               key=lambda i: score_frame(im.crop((i * w, 0, (i + 1) * w, im.height))))
    return im.crop((best * w, 0, (best + 1) * w, im.height))


def sample_stills(frames_dir, panels, n, every, tmp):
    """Score a directory of stills. THE PREFERRED SOURCE - see the skill.

    The finished cut carries burned-in type: a kicker, a name chip, an address
    bug. Sample a thumbnail from it and the type is in the picture twice, and the
    second copy is the one nobody chose the position of. The gameplay track that
    the render extracted is the same footage with none of that on it.
    """
    files = sorted(Path(frames_dir).glob('*.png'))[::max(1, every)]
    scored = []
    for i, f in enumerate(files):
        im = best_panel(Image.open(f).convert('RGB'), panels)
        p = f
        if panels > 1:
            p = tmp / f'panel-{f.stem}.png'
            im.save(p)
        scored.append((score_frame(im), float(i), p))

    # One pick per BUCKET, the track cut into n equal spans. Taking the global top
    # n instead gives n frames of whichever game happens to score highest - and a
    # panel-scored track has a clear winner, so all three variants came back
    # showing the same game from three camera positions. Different games is the
    # whole point: the test is meant to compare hooks, and a viewer who sees the
    # same screenshot three times is being asked nothing. Spans of the track are a
    # good proxy for different games because the montage plan puts one game per
    # segment and lays the segments out in order.
    # Buckets alone are not enough where a span holds more than one game: the
    # scorer has a favourite look (scattered bright tokens on a flat field) and
    # picks it out of every bucket it appears in, so three spans came back showing
    # the same game. Inside a bucket, walk down by score until a frame that does
    # not LOOK like an earlier pick, and only settle for the bucket's best if
    # nothing in it differs - a repeat is worth saying out loud, not hiding.
    size = max(1, len(scored) // n)
    picks, sigs = [], []
    for b in range(n):
        span = [c for c in scored if b * size <= c[1] < (b + 1) * size] or scored
        span = sorted(span, key=lambda c: -c[0])
        for cand in span:
            sig = _sig(cand[2])
            if all(_differs(sig, s2) for s2 in sigs):
                picks.append(cand)
                sigs.append(sig)
                break
        else:
            picks.append(span[0])
            sigs.append(_sig(span[0][2]))
            print(f'  WARN span {b + 1}: no frame here differs from an earlier '
                  f'pick, reusing the look')
    return picks


def _sig(path):
    """A 16x16 grey signature plus a mean colour, for telling frames apart.

    Grey alone was not enough: two shots of the same game from a moved camera
    differ in layout while being obviously the same subject to a viewer. Mean
    colour is what separates GAMES rather than moments, because each game in the
    catalogue has its own palette.
    """
    im = Image.open(path).convert('RGB')
    grey = list(im.convert('L').resize((16, 16), Image.LANCZOS).getdata())
    return grey, ImageStat.Stat(im.resize((32, 32), Image.LANCZOS)).mean[:3]


def _differs(a, b, layout_floor=34.0, colour_floor=12.0):
    """Different SUBJECT, by either test - palette or layout.

    Either, not both: requiring both rejected almost every candidate, because two
    shots of one game usually share a palette *and* a rough layout, and so does a
    different game that happens to be built from the same three colours. Palette
    is the stronger signal (each game in the catalogue has its own), so it clears
    at a low threshold; layout has to differ a lot to count on its own.
    """
    ga, ca = a
    gb, cb = b
    layout = sum(abs(x - y) for x, y in zip(ga, gb)) / len(ga)
    colour = max(abs(x - y) for x, y in zip(ca, cb))
    return colour >= colour_floor or layout >= layout_floor


def _spread(scored, n):
    """Best first, but every pick must LOOK different from the ones before it.

    Spreading by timestamp was not enough: two frames a third of a second apart
    are the same picture, and so are two frames from different segments of the
    same game. Three variants of one subject is not a test of anything, so the
    gate is a signature comparison - if a candidate is within 14 mean grey levels
    of an accepted pick, it is the same subject and gets skipped.
    """
    scored.sort(key=lambda s: -s[0])
    picked, sigs = [], []
    for s, t, p in scored:
        sig = _sig(p)
        if all(_differs(sig, q) for q in sigs):
            picked.append((s, t, p))
            sigs.append(sig)
        if len(picked) >= n:
            break
    if len(picked) < n:
        print(f'note: only {len(picked)} visually distinct subjects available, '
              f'{n} asked for')
    return picked


def sample_frames(video, avoid, n, tmp):
    """Pull evenly spaced stills, drop the avoided ranges, return the best n."""
    dur = duration(video)
    times = [dur * (i + 0.5) / 48.0 for i in range(48)]
    times = [t for t in times
             if not any(a <= t <= b for a, b in avoid)]
    scored = []
    for i, t in enumerate(times):
        p = tmp / f'cand-{i:03d}.png'
        sh('ffmpeg', '-v', 'error', '-ss', f'{t:.3f}', '-i', video,
           '-frames:v', '1', '-y', str(p))
        im = Image.open(p).convert('RGB')
        scored.append((score_frame(im), t, p))
    # Spread the picks out in TIME as well as by score, or three variants get
    # three frames from the same half second and the test compares nothing but
    # the type.
    return _spread(scored, n)


def cover(im, tw, th, bias_y=0.5):
    """Scale to fill, crop the overflow. Same helper the render uses."""
    s = max(tw / im.width, th / im.height)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))),
                   Image.LANCZOS)
    x = (im.width - tw) // 2
    y = int((im.height - th) * bias_y)
    return im.crop((x, y, x + tw, y + th))


def font(path, size, axes=None):
    f = ImageFont.truetype(path, max(1, int(size)))
    if axes:
        f.set_variation_by_axes(list(axes))
    return f


def fit_word(word, path, width, max_px):
    """Largest size at which `word` is exactly `width` wide, capped."""
    lo, hi, best = 8, max_px, 8
    while lo <= hi:
        mid = (lo + hi) // 2
        f = font(path, mid)
        w = f.getbbox(word)[2] - f.getbbox(word)[0]
        if w <= width:
            best, lo = mid, mid + 1
        else:
            hi = mid - 1
    return best


def scrim(size, edge, strength, vertical=False):
    """A one-directional dark wash, so the type has something to sit on.

    Generated as a 1px gradient and resized - a per-pixel loop at 1280 wide is
    slower than the whole rest of the render.
    """
    n = 256
    g = Image.new('L', (n, 1))
    px = g.load()
    for i in range(n):
        f = i / (n - 1)
        px[i, 0] = int(255 * strength * max(0.0, 1.0 - (f / edge) if edge else 0) ** 1.35)
    g = g.resize((size[1] if vertical else size[0], 1), Image.BILINEAR)
    g = g.resize(size[::-1] if vertical else size, Image.BILINEAR)
    if vertical:
        g = g.rotate(-90, expand=True)
    lay = Image.new('RGBA', size, INK + (0,))
    lay.putalpha(g)
    return lay


def text_ratio(im, box, colour):
    """Contrast of `colour` against the mean of the pixels it will cover."""
    x0, y0, x1, y1 = (max(0, int(v)) for v in box)
    x1, y1 = min(im.width, max(x0 + 1, x1)), min(im.height, max(y0 + 1, y1))
    mean = ImageStat.Stat(im.convert('RGB').crop((x0, y0, x1, y1))).mean
    return ratio(colour, tuple(int(m) for m in mean))


def salient(im, x_from):
    """The busiest cell outside the type column - what the cue should point at.

    A ring drawn at a fixed fraction of the frame is a ring around whatever
    happened to be there, and on a sparse game that is empty background. It has to
    be measured per frame or the cue is worse than no cue.
    """
    n, m = 32, 18
    g = im.convert('L').resize((n, m), Image.LANCZOS).filter(ImageFilter.FIND_EDGES)
    px = g.load()
    x0 = int(n * x_from)
    best, bx, by = -1, int(n * 0.7), m // 2
    for y in range(1, m - 1):
        for x in range(max(1, x0), n - 1):
            v = sum(px[x + dx, y + dy] for dx in (-1, 0, 1) for dy in (-1, 0, 1))
            # Weighted towards the middle of the searched area. Raw edge energy
            # happily picks a lamp in the top corner over the character in the
            # middle, and a ring in the corner reads as decoration - the cue is
            # meant to say "look here", so a tie should break inwards.
            fx = (x - x0) / max(1, (n - 1 - x0)) - 0.5
            fy = y / (m - 1) - 0.5
            v *= 1.0 - 0.55 * min(1.0, 2 * (fx * fx + fy * fy) ** 0.5)
            if v > best:
                best, bx, by = v, x, y
    return int((bx + 0.5) / n * im.width), int((by + 0.5) / m * im.height)


def draw_cue(im, kind, cx, cy, r):
    """A ring or an arrow. Worth up to 25% and costs one shape."""
    lay = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    w = max(4, int(r * 0.13))
    if kind == 'circle':
        d.ellipse([cx - r, cy - r * 0.82, cx + r, cy + r * 0.82],
                  outline=AMBER + (255,), width=w)
    else:
        # A tapered arrow pointing in at 30 degrees from upper left, because an
        # arrow that points at nothing is just a shape.
        th = math.radians(150)
        tipx, tipy = cx + math.cos(th) * r * 0.42, cy + math.sin(th) * r * 0.42
        tailx, taily = cx + math.cos(th) * r * 1.7, cy + math.sin(th) * r * 1.7
        d.line([(tailx, taily), (tipx, tipy)], fill=AMBER + (255,), width=w)
        hx, hy = r * 0.30, r * 0.30
        d.polygon([(tipx, tipy),
                   (tipx - hx, tipy - hy * 0.25),
                   (tipx - hx * 0.25, tipy - hy)], fill=AMBER + (255,))
    im.alpha_composite(lay)


# --------------------------------------------------------------------------
# Premium treatment. Flat white type on a dimmed screenshot is legible and
# ignorable: it reads as a frame grab with a caption, and a frame grab is what
# every un-clicked video in the feed looks like. What separates a thumbnail that
# gets picked is depth - the subject sitting in front of something rather than
# being everything - plus type that has an edge of its own instead of borrowing
# the footage's. None of it is decoration for its own sake: each pass below
# either separates the subject from the background or separates the type from
# the subject.
# --------------------------------------------------------------------------

NAVY = (0x0B, 0x10, 0x30)
PLUM = (0x3B, 0x1E, 0x6E)
CYAN = (0x35, 0xD6, 0xF5)
DEEP = (0xE0, 0x8A, 0x18)      # bottom of the accent gradient


def ramp(size, c0, c1, diagonal=True):
    """A linear gradient, built small and scaled - a per-pixel loop at 1280 is
    slower than everything else in the render put together."""
    n = 64
    g = Image.new('RGB', (n, n))
    px = g.load()
    for y in range(n):
        for x in range(n):
            f = ((x + y) / (2 * n - 2)) if diagonal else (y / (n - 1))
            px[x, y] = tuple(int(a + (b - a) * f) for a, b in zip(c0, c1))
    return g.resize(size, Image.BICUBIC).convert('RGBA')


def vignette(size, strength=0.55, cx=0.5, cy=0.45):
    """Darken the corners. This is the cheapest depth cue there is: the eye reads
    a brighter centre as nearer, so the subject stops being wallpaper."""
    W, H = size
    n = 96
    g = Image.new('L', (n, n))
    px = g.load()
    for y in range(n):
        for x in range(n):
            dx, dy = (x / (n - 1) - cx) / 0.72, (y / (n - 1) - cy) / 0.72
            px[x, y] = int(255 * strength * min(1.0, (dx * dx + dy * dy) ** 0.85))
    lay = Image.new('RGBA', size, INK + (0,))
    lay.putalpha(g.resize((W, H), Image.BICUBIC))
    return lay


def spotlight(size, cx, cy, r, colour=CYAN, alpha=90):
    """A soft coloured light behind the subject. Warm-cool separation does what
    a drop shadow cannot: it puts air between subject and background even where
    both are mid-tone."""
    lay = Image.new('RGBA', size, colour + (0,))
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).ellipse((cx - r, cy - r, cx + r, cy + r), fill=alpha)
    lay.putalpha(m.filter(ImageFilter.GaussianBlur(r * 0.55)))
    return lay


def grade(im, lift=0.10, sat=1.22, contrast=1.10):
    """Push saturation and contrast before anything is drawn on top. Measured
    CTR work keeps finding saturated frames outperform accurate ones, and game
    footage captured for motion is usually flatter than it looks in play."""
    im = ImageEnhance.Color(im.convert('RGB')).enhance(sat)
    im = ImageEnhance.Contrast(im).enhance(contrast)
    im = Image.blend(im, Image.new('RGB', im.size, INK), lift)
    return im.convert('RGBA')


def rounded_mask(size, radius):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1),
                                        radius=radius, fill=255)
    return m


def card(im, size, radius=26, rot=-3.0, rim=CYAN, rim_px=7):
    """The subject as a physical object: rounded, rimmed, glowing, tilted, with a
    shadow under it. The tilt is small on purpose - past about 5 degrees the
    gameplay inside starts reading as broken rather than staged.

    Returns an RGBA layer the size of the frame's own canvas plus margin, so the
    caller composites once and the glow is not clipped by the card's own box.
    """
    cw, ch = size
    pad = int(max(cw, ch) * 0.16)
    lay = Image.new('RGBA', (cw + 2 * pad, ch + 2 * pad), (0, 0, 0, 0))
    face = cover(im, cw, ch, 0.45).convert('RGBA')
    face.putalpha(rounded_mask((cw, ch), radius))

    sil = Image.new('RGBA', lay.size, (0, 0, 0, 0))
    sil.paste(rim + (255,), (pad, pad), face.getchannel('A'))
    # Shadow first, then glow, then the rim, then the face - painting the glow
    # after the face would haze the gameplay it is supposed to frame.
    sh = Image.new('RGBA', lay.size, (0, 0, 0, 0))
    sh.paste(INK + (190,), (pad + int(pad * 0.10), pad + int(pad * 0.16)),
             face.getchannel('A'))
    lay.alpha_composite(sh.filter(ImageFilter.GaussianBlur(pad * 0.30)))
    lay.alpha_composite(sil.filter(ImageFilter.GaussianBlur(pad * 0.28)))
    rimlay = Image.new('RGBA', lay.size, (0, 0, 0, 0))
    ImageDraw.Draw(rimlay).rounded_rectangle(
        (pad - rim_px, pad - rim_px, pad + cw + rim_px, pad + ch + rim_px),
        radius=radius + rim_px, fill=WHITE + (235,))
    lay.alpha_composite(rimlay)
    lay.alpha_composite(face, (pad, pad))
    return lay.rotate(rot, Image.BICUBIC, expand=True), pad


def text_layer(size, xy, word, f, top, bottom, outline, anchor='la'):
    """Display type with a gradient fill, a hard outline and a soft shadow.

    The gradient is what stops a flat fill reading as a caption: real thumbnail
    type is lit. The outline is not styling either - it is what lets the same
    word sit over a bright sky and a dark cave in two different frames without
    the contrast pass having to black the footage out to compensate.
    """
    lay = Image.new('RGBA', size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    ow = max(3, int(f.size * 0.075))
    d.text(xy, word, font=f, fill=WHITE + (255,), anchor=anchor,
           stroke_width=ow, stroke_fill=outline + (255,))
    mask = lay.getchannel('A')

    sh = Image.new('RGBA', size, (0, 0, 0, 0))
    sh.paste(INK + (150,), (0, int(f.size * 0.055)), mask)
    sh = sh.filter(ImageFilter.GaussianBlur(f.size * 0.045))

    body = Image.new('RGBA', size, (0, 0, 0, 0))
    inner = Image.new('L', size, 0)
    di = ImageDraw.Draw(inner)
    di.text(xy, word, font=f, fill=255, anchor=anchor)
    body.paste(ramp(size, top, bottom, diagonal=False), (0, 0), inner)

    out = Image.new('RGBA', size, (0, 0, 0, 0))
    out.alpha_composite(sh)
    edge = Image.new('RGBA', size, (0, 0, 0, 0))
    ImageDraw.Draw(edge).text(xy, word, font=f, fill=outline + (255,),
                              anchor=anchor, stroke_width=ow,
                              stroke_fill=outline + (255,))
    out.alpha_composite(edge)
    out.alpha_composite(body)
    return out


def render(frame, variant, size, mark, fonts, warn, others=()):
    """One thumbnail, in one of three styles.

    `punch`  the subject full-bleed and graded, lit behind, type over it
    `card`   the subject as a tilted glowing card on a brand gradient
    `beam`   full-bleed with a hard spotlight and an accent bar under the type
    `grid`   a hero card with two flankers, for when the subject is the CATALOGUE
             rather than one game - a platform trailer, a month-in-review

    Style belongs to the SPEC, not to the variant, and the default is that all
    three variants share it. The test is meant to compare one thing at a time; a
    set where the words and the whole treatment both change measures nothing.
    """
    W, H = size
    tall = H > W
    words = [w.upper() for w in variant['text'].split()]
    if len(words) > WORD_CAP:
        warn(f"{variant['id']}: {len(words)} words; under {WORD_CAP + 1} tests ~30% better")
    style = variant.get('style', 'punch')
    subj = Image.open(frame).convert('RGB')

    if tall:
        col_x, col_w = int(W * 0.09), int(W * 0.82)
        top, bot = COVER_SAFE
    else:
        col_x, col_w = int(W * 0.055), int(W * 0.47)
        top, bot = int(H * 0.08), int(H * 0.92)

    if style == 'grid':
        # Three cards, not eight. The reference version of this layout carries a
        # laptop plus eight floating tiles, and at the ~360px a feed card actually
        # gets, those tiles are 30px tall - they read as texture, not as
        # abundance. Three at descending size still say "more than one game" and
        # each one is still big enough to be a game.
        im = ramp(size, NAVY, PLUM)
        im.alpha_composite(spotlight(size, int(W * (0.5 if tall else 0.72)),
                                     int(H * 0.46), int(min(W, H) * 0.52),
                                     CYAN, 130))
        # Every card lives to the right of the type column. The first cut let a
        # flanker sit under the words, which is the one collision no amount of
        # outline saves - the type stops being on top of anything and starts
        # being tangled in it.
        if tall:
            hero = (int(W * 0.72), int(H * 0.28), int(W * 0.14), int(H * 0.56))
            flank = [(0.34, 0.60, 0.055, 7.0), (0.34, 0.60, 0.72, -7.0)]
        else:
            hero = (int(W * 0.40), int(H * 0.54), int(W * 0.545), int(H * 0.23))
            flank = [(0.26, 0.53, 0.05, 7.0), (0.26, 0.80, 0.56, -7.0)]
        # Flankers first so the hero overlaps them - overlap is the depth cue that
        # makes a group read as a stack instead of a row.
        # `flankers` in the spec overrides the automatic choice. The automatic
        # one reuses the other variants' frames, which is free and usually right,
        # but on a catalogue thumbnail the two cards behind the hero are the
        # difference between "more games" and "the same game twice" - worth naming
        # explicitly when the track cannot supply two that look different.
        pool = [Path(f) for f in variant.get('flankers', [])] or list(others)
        for (fw, fx, fy, rot), src in zip(flank, pool[:2]):
            cw, ch = int(W * fw), int(W * fw * (H / W if tall else 0.62))
            lay, pad = card(Image.open(src).convert('RGB'), (cw, ch),
                            rot=rot, rim=PLUM, rim_px=5)
            im.alpha_composite(lay, (int(W * fx) - pad, int(H * fy) - pad))
        lay, pad = card(subj, hero[:2], rot=-2.0)
        im.alpha_composite(lay, (hero[2] - pad, hero[3] - pad))
        im.alpha_composite(vignette(size, 0.44))
        strength = 0.0
    elif style == 'card':
        # A controlled background instead of the footage. The subject stops being
        # the whole frame and becomes a thing IN the frame, which is the entire
        # difference between a screenshot and a thumbnail.
        im = ramp(size, NAVY, PLUM)
        if tall:
            cw, ch = int(W * 0.84), int(H * 0.40)
            pos = ((W - cw) // 2, int(H * 0.53))
        else:
            cw, ch = int(W * 0.50), int(H * 0.76)
            pos = (int(W * 0.47), (H - ch) // 2)
        im.alpha_composite(spotlight(size, pos[0] + cw // 2, pos[1] + ch // 2,
                                     int(min(W, H) * 0.44), CYAN, 120))
        lay, pad = card(subj, (cw, ch))
        im.alpha_composite(lay, (pos[0] - pad, pos[1] - pad))
        im.alpha_composite(vignette(size, 0.40))
        strength = 0.0
    else:
        im = grade(cover(subj, W, H, variant.get('bias_y', 0.42)),
                   lift=0.06, sat=1.26, contrast=1.12)
        gx, gy = salient(im, 0.52 if not tall else 0.0)
        im.alpha_composite(spotlight(size, gx, gy, int(min(W, H) * 0.36), CYAN,
                                     130 if style == 'beam' else 80))
        im.alpha_composite(vignette(size, 0.62 if style == 'beam' else 0.50))
        # Contrast is still measured, not eyeballed - the outline below buys a lot
        # of latitude but not permission to skip the check. Starts lower than it
        # used to precisely because the outline is doing part of the job.
        strength, box = 0.34, (col_x, top, col_x + col_w, bot)
        for _ in range(8):
            test = im.copy()
            test.alpha_composite(scrim(size, 0.72 if tall else 0.60, strength, tall))
            if text_ratio(test, box, WHITE) >= MIN_RATIO:
                break
            strength = min(1.0, strength + 0.07)
        im.alpha_composite(scrim(size, 0.72 if tall else 0.60, strength, tall))

    # The mark is resolved before the type because on the card layouts it takes a
    # bite out of the column and the stack has to be centred in what is left.
    # Bottom-right, its home on a full-bleed frame, is where those layouts keep
    # their subject.
    m = None
    if mark and mark.exists():
        m = Image.open(mark).convert('RGBA')
        # Smaller on the card layouts: there the mark costs the type column
        # height rather than sitting in dead space, and cap height is worth more
        # than badge size.
        mw = int(W * ((0.16 if style in ('card', 'grid') else 0.20) if tall
                      else (0.085 if style in ('card', 'grid') else 0.115)))
        m = m.resize((mw, max(1, round(m.height * mw / m.width))), Image.LANCZOS)
    if m is not None and style in ('card', 'grid'):
        im.alpha_composite(m, (col_x, top))
        top += m.height + int(H * 0.015)

    if variant.get('cue'):
        cx, cy = salient(im, 0.52 if not tall else 0.0)
        draw_cue(im, variant['cue'], cx, cy, int(min(W, H) * 0.15))

    # Every word on its own line, each set to the column width, then the stack
    # scaled until it fits. Height wins over size: a clipped bottom line is worse
    # than type 20% smaller, and the cap check decides if that trade went too far.
    disp = fonts['display']
    px = min(fit_word(w, disp, col_w, int(H * 0.42)) for w in words)
    bar_h = int(H * 0.115) if (style == 'beam' and variant.get('sub')) else 0
    sub_px = int(H * (0.030 if tall else 0.042)) if variant.get('sub') else 0
    bot_eff = bot - (bar_h if bar_h else int(sub_px * 2.4))
    avail = (bot_eff - top) - int(H * 0.03)
    while len(words) * px * 0.94 > avail and px > 12:
        px = int(px * 0.94)
    lines = [(w, font(disp, px)) for w in words]
    caps = [f.getbbox('H')[3] - f.getbbox('H')[1] for _, f in lines]
    if caps[0] / H < MIN_CAP_FRAC:
        warn(f"{variant['id']}: cap height {caps[0] / H:.1%} of frame, want "
             f"{MIN_CAP_FRAC:.0%}+ to read at feed size")
    lead = int(px * 0.94)
    block = lead * (len(lines) - 1) + caps[0]
    y = (top + bot_eff) // 2 - block // 2
    accent = (variant.get('accent') or '').upper()
    for (w, f), cap in zip(lines, caps):
        hot = w == accent
        im.alpha_composite(text_layer(
            size, (col_x, y), w, f,
            AMBER if hot else WHITE,
            DEEP if hot else (0xC9, 0xD2, 0xE4),
            INK))
        y += lead

    if bar_h:
        # An accent bar rather than loose small type: at feed size a thin line of
        # white text vanishes, while a solid band still reads as a second beat.
        bar = Image.new('RGBA', size, (0, 0, 0, 0))
        ImageDraw.Draw(bar).rectangle((0, H - bar_h, W, H), fill=AMBER + (250,))
        im.alpha_composite(bar)
        f = font(fonts['body'], int(bar_h * 0.42), (700, 100))
        ImageDraw.Draw(im).text((W // 2, H - bar_h // 2), variant['sub'].upper(),
                                font=f, fill=INK + (255,), anchor='mm')
    elif variant.get('sub'):
        f = font(fonts['body'], sub_px, (600, 100))
        d = ImageDraw.Draw(im)
        # Anchored to the bottom of the safe area, not to the end of the stack:
        # the stack's height depends on the word count, so a relative offset put
        # this line through the last word's descenders on the three-word variant.
        d.text((col_x + 3, bot - int(H * 0.012) + 3), variant['sub'].upper(),
               font=f, fill=INK + (170,), anchor='ls')
        d.text((col_x + 2, bot - int(H * 0.012)), variant['sub'].upper(), font=f,
               fill=WHITE + (240,), anchor='ls')

    if m is not None and style not in ('card', 'grid'):
        # On a cover the type column is 82% of the width, so a bottom-right mark
        # sits on top of the last word. It goes above the stack instead, still
        # inside the grid-safe box.
        im.alpha_composite(m, (W - m.width - int(W * 0.035),
                               top + int(H * 0.02) if tall
                               else H - m.height - int(H * 0.05) - bar_h))
    return im.convert('RGB')


def contact(variants, size, out):
    """All variants at the size they are actually judged at, side by side.

    A thumbnail approved at 1280 wide is a different image from the one a viewer
    sees. This sheet renders each at feed width on a neutral card, with the 1:1
    profile-grid crop next to the vertical ones, and it is the only view worth
    approving from.
    """
    tall = size[1] > size[0]
    cw = 260 if tall else 420
    cards = []
    for vid, im in variants:
        th = round(im.height * cw / im.width)
        card = [im.resize((cw, th), Image.LANCZOS)]
        if tall:
            s = im.crop((0, (im.height - im.width) // 2,
                         im.width, (im.height + im.width) // 2))
            card.append(s.resize((cw, cw), Image.LANCZOS))
        cards.append((vid, card))
    pad, label = 26, 34
    colw = cw + pad
    hmax = max(sum(c.height for c in cs) + pad * (len(cs) - 1) for _, cs in cards)
    sheet = Image.new('RGB', (colw * len(cards) + pad, hmax + pad * 2 + label),
                      (0x18, 0x1B, 0x24))
    d = ImageDraw.Draw(sheet)
    for i, (vid, cs) in enumerate(cards):
        x, y = pad + i * colw, pad + label
        d.text((x, pad + 6), vid.upper(), fill=(0xC9, 0xD3, 0xF5))
        for c in cs:
            sheet.paste(c, (x, y))
            y += c.height + pad
    sheet.save(out)


def main():
    spec = json.loads(Path(sys.argv[1]).read_text())
    outdir = Path(sys.argv[2])
    outdir.mkdir(parents=True, exist_ok=True)
    tmp = outdir / '.frames'
    tmp.mkdir(exist_ok=True)

    size = COVER if spec.get('aspect') == '9x16' else YT
    fonts = spec['fonts']
    mark = Path(spec['mark']) if spec.get('mark') else None
    warnings = []
    if spec.get('frames_dir'):
        picks = sample_stills(spec['frames_dir'], spec.get('panels', 1),
                              len(spec['variants']), spec.get('every', 6), tmp)
        print('subject frames from ' + spec['frames_dir'] + ': ' +
              ', '.join(f'{p.name} (score {s:.0f})' for s, _, p in picks))
    else:
        picks = sample_frames(spec['video'], [tuple(a) for a in spec.get('avoid', [])],
                              len(spec['variants']), tmp)
        print('subject frames from the cut at ' +
              ', '.join(f'{t:.2f}s (score {s:.0f})' for s, t, _ in picks))

    made = []
    for v, (s, t, p) in zip(spec['variants'], picks):
        # Style is a property of the SET so the variants differ on their words
        # alone. A per-variant override exists for deliberately testing treatment
        # against treatment, which is a different experiment.
        v.setdefault('style', spec.get('style', 'punch'))
        frame = Path(v['frame']) if v.get('frame') else p
        # The other variants' frames are this one's flankers: they are already
        # picked from different spans and already checked for looking different,
        # so the grid gets three distinct games for free.
        others = [q for _, _, q in picks if q != p]
        im = render(frame, v, size, mark, fonts, warnings.append, others)
        out = outdir / f"thumb-{v['id']}.jpg"
        q = 92
        while True:
            im.save(out, 'JPEG', quality=q, subsampling=0, optimize=True)
            if out.stat().st_size <= JPEG_MAX or q <= 60:
                break
            q -= 8
        print(f"  {out.name}  {v['style']:<6} {v['strategy']:<9} "
              f"\"{v['text']}\"  {Path(p).name}  "
              f"{out.stat().st_size // 1024}KB q{q}")
        made.append((v['id'], im))

    contact(made, size, outdir / 'thumbs-contact.png')
    print(f"  thumbs-contact.png  judge from this, not the full-size files")
    for w in warnings:
        print(f'WARN {w}')


if __name__ == '__main__':
    main()
