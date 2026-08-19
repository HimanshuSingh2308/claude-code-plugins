#!/usr/bin/env python3
"""Thumbnails rendered through headless Chrome from lib/thumb-template.html.

    python3 thumbnail_web.py spec.json outdir/

Same spec file as thumbnail.py, plus `layout`: stack | fan | blast. Frame
selection, the distinctness check, the cap-height floor, the contrast floor, the
word-count warning and the 2 MB JPEG cap all come from thumbnail.py, so both
renderers are held to the same rules and only the drawing differs.

Why two renderers: the PIL one has no dependency beyond Pillow and is what runs
where Chrome is not installed. This one is the one to reach for by default - the
layered shadows, gradient-through-glyph type, perspective and masked reflection
that separate a premium thumbnail from a caption on a screenshot are a line of CSS
each and a function each in Pillow.

Python keeps the measurements. The page is handed final pixel sizes, because a
size the browser discovered after the screenshot is a size nothing can warn about.
"""

import colorsys
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from thumbnail import (COVER, JPEG_MAX, MIN_CAP_FRAC, MIN_RATIO, WHITE, WORD_CAP,
                       YT, contact, cover, fit_word, font, sample_frames,
                       sample_stills, salient, text_ratio)

TEMPLATE = Path(__file__).resolve().parent / 'thumb-template.html'

# The weights thumb-template.html draws body text at. Kept here because the
# measurement has to match the render, and a mismatch shows up as a wrapped line
# rather than as an error.
SUB_WEIGHT = 700
BAR_WEIGHT = 800


def _path(uri):
    return Path(uri[7:]) if uri.startswith('file://') else Path(uri)

# Cap height as a fraction of the em, measured off Anton. Used to turn the
# cap-height floor into a font-size, and to convert back for the warning.
CAP_OF_EM = 0.72

CHROMES = (
    os.environ.get('CHROME', ''),
    str(Path.home() / '.cache/puppeteer/chrome/mac_arm-131.0.6778.204/'
        'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/'
        'Google Chrome for Testing'),
    '/Applications/Google Chrome for Testing.app/Contents/MacOS/'
    'Google Chrome for Testing',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    shutil.which('chromium') or '',
    shutil.which('google-chrome') or '',
)


def chrome():
    for c in CHROMES:
        if c and Path(c).exists():
            return c
    sys.exit('no Chrome found. Set CHROME=/path/to/chrome, or render with '
             'thumbnail.py instead.')


def _shot(bin_, flag, html, win, out):
    subprocess.run([bin_, flag, '--disable-gpu', '--hide-scrollbars',
                    '--force-device-scale-factor=1', '--no-sandbox',
                    '--default-background-color=ff0b0d14',
                    f'--window-size={win[0]},{win[1]}',
                    f'--screenshot={out}', html.as_uri()],
                   capture_output=True, text=True)
    return Image.open(out).convert('RGB') if Path(out).exists() else None


def _painted(im, size):
    """How much of a known solid block actually landed, in each axis."""
    W, H = size
    hit = lambda x, y: im.getpixel((x, y)) == (255, 0, 0)
    rows = sum(1 for y in range(im.height) if hit(min(W, im.width) // 2, y))
    cols = sum(1 for x in range(im.width) if hit(x, min(H, im.height) // 2))
    return cols, rows


CAL = {}


def calibrate(bin_, size, tmp):
    """Find the flag and window size that paint exactly `size`.

    Chrome's `--window-size` is not the viewport in every build. Chrome for
    Testing 131 in `--headless=new` paints 1280x632 for a requested 1280x720 -
    the ~88px of window frame comes off the content and the screenshot pads the
    rest with the background colour, which silently crops the bottom of the
    design. Chrome 151 paints all 720. Rather than pin a flag that is right on one
    machine, shoot a red block of the target size, see what landed, and keep the
    flag plus the padding that gets it whole. Cached per binary and size.
    """
    key = (bin_, size)
    if key in CAL:
        return CAL[key]
    probe = tmp / 'calibrate.html'
    probe.write_text('<body style="margin:0"><div style="width:%dpx;height:%dpx;'
                     'background:#f00"></div>' % size)
    for flag in ('--headless=old', '--headless=new'):
        im = _shot(bin_, flag, probe, size, tmp / 'calibrate.png')
        if im is None:
            continue
        cols, rows = _painted(im, size)
        if not rows or not cols:
            continue            # blank: this flag never painted, try the other
        pad = (size[0] - cols, size[1] - rows)
        CAL[key] = (flag, pad)
        if pad != (0, 0):
            print(f'  chrome pads {pad[0]}x{pad[1]}px of window frame into the '
                  f'viewport, compensating')
        return CAL[key]
    sys.exit('chrome painted nothing in either headless mode. Try CHROME=<path> '
             'with a different build, or render with thumbnail.py.')


def shoot(html, size, out, tmp):
    """Screenshot at exactly the output size, so nothing is ever resampled.

    --force-device-scale-factor=1 matters: on a retina machine Chrome otherwise
    hands back a 2x image, and downsampling it softens the 3px hairlines and
    thickens the glows that the whole look rests on.
    """
    bin_ = chrome()
    flag, pad = calibrate(bin_, size, tmp)
    im = _shot(bin_, flag, html, (size[0] + pad[0], size[1] + pad[1]), out)
    if im is None:
        sys.exit('chrome wrote no screenshot for ' + html.name)
    # Crop, never resize: the window may be a row taller than asked for, and
    # resampling to fix an off-by-one would soften every edge in the frame.
    return im.crop((0, 0, size[0], size[1]))


def prep(src, w, h, tmp, name, bias_y=0.42):
    """Crop a still to the card's aspect up front.

    CSS `background-size: cover` would do this, but it crops from the centre and
    a game frame's subject is usually above centre. Doing it here also keeps the
    page's images the size they are drawn at, which is what stops Chrome's
    downscaler from softening them.
    """
    im = cover(Image.open(src).convert('RGB'), max(2, int(w * 2)),
               max(2, int(h * 2)), bias_y)
    p = tmp / f'{name}.png'
    im.save(p)
    return p.as_uri()


def meanY(src):
    """Mean luminance 0-255 of a prepped still."""
    im = Image.open(_path(src)).convert('RGB').resize((48, 27), Image.LANCZOS)
    px = list(im.getdata())
    return sum(0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in px) / len(px)


def dim(flank, hero):
    """How much to dim a flanker so it sits behind the hero without vanishing.

    A fixed brightness(.66) assumes the flanker is as bright as the hero. Dim a
    game that is already a dark starfield and it becomes a black rectangle - the
    fan then reads as one game with two shadows, which is the opposite of the
    "many games" claim the layout exists to make. So: aim for 62% of the hero's
    luminance, but never below an absolute floor, and allow a value above 1 to
    lift a dark game up to it.
    """
    target = max(0.62 * hero, 46.0)
    return round(min(1.9, max(0.50, target / max(1.0, flank))), 3)


def palette(src):
    """The subject's own dominant colour, boosted into a light.

    A fixed cyan glow behind every card is the tell of a template: a green
    platformer lit cyan looks like a screenshot pasted onto someone else's design.
    Sampling the subject and lighting it with its own hue is what makes the
    background look like it belongs to the game, and it costs one quantize.

    Weighted by saturation as well as area, because the largest region in a game
    frame is usually a flat sky or floor and the colour that reads as the game's is
    the saturated one.
    """
    im = Image.open(src).convert('RGB').resize((80, 45), Image.LANCZOS)
    best, score = (0x35, 0xD6, 0xF5), -1.0
    for count, rgb in im.quantize(colors=8).convert('RGB').getcolors(4096):
        mx, mn = max(rgb), min(rgb)
        sat = 0.0 if not mx else (mx - mn) / mx
        v = count * (0.25 + sat) * (0.4 + mx / 255)
        if v > score:
            best, score = rgb, v

    # Take the HUE only, and rebuild the colour at full strength. Scaling the
    # sampled RGB keeps its greyness, and a grey-teal "light" turns the whole frame
    # into mud - which is exactly what the first attempt did.
    h, s, _ = colorsys.rgb_to_hsv(*[c / 255 for c in best])
    h_bg = h                            # the ground keeps the hue as sampled
    if s < 0.15:
        h = 0.52                        # near-grey subject: fall back to brand cyan
    # A subject that is already the brand's own purple gets lit cyan instead of
    # more purple. Lighting a purple card with purple light is how it ends up the
    # same value as the ground it is standing on - the rim survives, the shape does
    # not, and separation is the entire job of a rim light.
    if min(abs(h - 0.71), 1 - abs(h - 0.71)) < 0.09:
        h = 0.52
    hexa = lambda r, g, b: '#%02X%02X%02X' % (int(r * 255), int(g * 255),
                                              int(b * 255))
    glow = hexa(*colorsys.hsv_to_rgb(h, 0.78, 0.97))
    # The ramp stays the brand's. The sampled hue is allowed a third of the
    # mid-tone and no more: the background is Weekly Arcade's navy-to-plum
    # whatever game is in the picture, or the channel has no colour of its own.
    # The ground keeps the SAMPLED hue even when the light was swapped: it is the
    # one that ties the frame to the game, and it is only a third of the mid-tone.
    tint = colorsys.hsv_to_rgb(h_bg, 0.60, 0.34)
    mid = (0x22 / 255, 0x1A / 255, 0x5C / 255)
    deep = hexa(*[t_ * 0.34 + m * 0.66 for t_, m in zip(tint, mid)])
    return glow, deep


def ambient(src, tmp, name):
    """A heavily blurred copy of the subject, for the light it throws.

    Blurred in Pillow at 1/8 scale rather than by CSS at full size: a 60px CSS
    blur on a 1280px layer is the slowest thing in the render and it bleeds the
    frame edge into the vignette, while an 80px-wide blur scaled up by the browser
    is smoother and weighs nothing.
    """
    im = Image.open(src).convert('RGB')
    im = im.resize((96, max(1, round(96 * im.height / im.width))), Image.LANCZOS)
    im = im.filter(ImageFilter.GaussianBlur(9))
    p = tmp / f'{name}.png'
    im.save(p)
    return p.as_uri()


# Two different vertical surfaces, and they are not interchangeable.
#
# A Reels COVER is cropped: Instagram shows the middle 4:5 of a 9:16 file in the
# profile grid and the feed card, so the outer eighths are bleed and anything that
# has to be read lives in the middle 70%.
#
# A STORY is not cropped - the whole frame shows - but Instagram draws its own
# furniture ON TOP of it: the progress bar and the profile row at the top, the
# "Send message" reply bar at the foot. Meta's own Stories guidance reserves
# roughly the top 250px and bottom 250px of a 1080x1920 frame for exactly this.
# We reserve more at the bottom than that, because of the sticker zone below.
SURFACES = {
    'cover': (0.148, 0.852),
    # Instagram asks for 250px clear at the top and bottom of a 1920 frame, which
    # is where 0.130 and 0.870 come from: the progress bar and profile row occupy
    # the first, the reply bar and its controls the second. This is an OCCLUSION
    # band, not a crop band - unlike a cover, every pixel of a story is displayed,
    # and the band is only about what Instagram draws on top.
    'story': (0.130, 0.870),
}
GRID = SURFACES['cover']

# The link sticker is the only tappable link Instagram gives an account outside
# the bio, so a Story that wants traffic must have somewhere to put one - and it
# is added by hand, after the render, so nothing in the image can be relying on
# those pixels. This band is deliberately BELOW the type band and above the reply
# bar: type stops at 0.780, the sticker lands here, the reply bar owns the rest.
# Composing without it is how a launch Story ends up with the sticker sitting on
# top of a word.
# Zones per sticker kind, as fractions of a 1920 frame, at roughly Instagram's
# default sticker scale. A poster can resize a sticker, so these are reservations
# rather than measurements, and they are generous on purpose: a card with slightly
# too much air costs nothing, a sticker sitting on a word costs the card.
#
# These are what make a story interactive rather than a poster. An interactive
# sticker is not decoration added on top of a finished design, it is a hole the
# design has to leave, so the zone is declared per variant and the layout is
# compressed into what is left above it.
STICKER_KINDS = {
    'link': (0.790, 0.870),
    'poll': (0.660, 0.845),          # 2 options
    'quiz': (0.560, 0.845),          # 4 options, the tallest of them
    'question': (0.690, 0.850),
    'slider': (0.700, 0.840),
}
STICKER = STICKER_KINDS['link']
# Clear air between the last drawn element and the sticker. Without it the two
# touch, which reads as a mistake even when nothing actually overlaps.
STICKER_GAP = 0.015


def squeeze(g, band, bottom):
    """Compress a layout's vertical fractions into a shorter band.

    Rather than hand-tuning a geometry per sticker kind, remap the surface's band
    onto whatever is left above the sticker and let every element move together.
    A quiz with four options takes nearly a third of the frame, so the difference
    between this and a fixed layout is the difference between a card that has room
    for the interaction and a card with a quiz sitting on its headline.
    """
    top = band[0]
    k = (bottom - top) / (band[1] - band[0])

    def y(v):
        return top + (v - top) * k

    out = dict(g)
    c = g['col']
    out['col'] = (c[0], y(c[1]), c[2], c[3] * k)
    out['cards'] = [(d[0], y(d[1]), d[2], d[3] * k) + tuple(d[4:])
                    for d in g['cards']]
    out['flanks'] = [(f[0], y(f[1]), f[2], f[3] * k) + tuple(f[4:])
                     for f in g['flanks']]
    out['light'] = (g['light'][0], y(g['light'][1]))
    return out


# The cap-height floor is not a house style, it is a function of the smallest
# width a surface is ever displayed at. A YouTube thumbnail is judged in a search
# row about 320px wide and a Reels cover in a profile tile around 360px, so on
# those the type has to be a big fraction of the frame or it is mush. A Story is
# shown FULL SCREEN at essentially the file's own width - about three times the
# relative scale - so importing the thumbnail floor onto it is simply the wrong
# constraint, and obeying it would mean shrinking the game cards to make room for
# type nobody was struggling to read. 9% of 1920 is a 173px cap: still huge.
CAP_FLOOR = {'youtube': MIN_CAP_FRAC, 'cover': MIN_CAP_FRAC, 'story': 0.09}


def band(surface):
    """The top and bottom of the region a surface can be read in, as fractions."""
    return SURFACES.get(surface, SURFACES['cover'])


def geometry(layout, size, surface='cover'):
    """Where the card(s), the type column and the light live, per layout.

    Fractions, not pixels, so 16:9 and 9:16 share one description. The type
    column and every card are disjoint by construction - the collisions worth
    preventing are prevented here rather than checked for later.
    """
    W, H = size
    tall = H > W
    story = tall and surface == 'story'
    if layout == 'blast':
        # Lower on a cover: the subject wants the upper two thirds, the words sit
        # over the darkest part of the wash, and the bar closes the frame. Centred
        # in a tall column the type floats in the middle of the picture with the
        # subject's head behind it.
        # Tall: the column stops above the bar's new home at the foot of GRID,
        # or the bar lands inside the type and takes the contrast down with it.
        # A Story's bar sits at the foot of its type band, which is higher up than
        # a cover's, so the column has to start higher again to stay clear of it.
        if story:
            col = (0.07, 0.300, 0.80, 0.34)
        else:
            col = (0.07, 0.355, 0.80, 0.37) if tall else (0.055, 0.10, 0.60, 0.72)
        return dict(col=col, light=(0.60, 0.30) if tall else (0.72, 0.40),
                    cards=[], flanks=[])

    if layout == 'versus':
        # Two options, equally weighted, for a two-option poll. The other layouts
        # all have a hero and subordinates, which is exactly wrong here: a poll
        # between a bright card and a dimmed one is not a poll, it is a
        # suggestion. Headline small and at the top, because the poll sticker
        # carries its own question and the type only has to frame it.
        if not story:
            return dict(col=(0.075, 0.140, 0.85, 0.185), light=(0.50, 0.42),
                        cards=[(0.055, 0.345, 0.44, 0.425, -5.0, -2.5)],
                        flanks=[(0.505, 0.345, 0.44, 0.425, 5.0, 2.5, 1.0)])
        return dict(col=(0.075, 0.140, 0.85, 0.185), light=(0.50, 0.42),
                    cards=[(0.055, 0.345, 0.44, 0.425, -5.0, -2.5)],
                    flanks=[(0.505, 0.345, 0.44, 0.425, 5.0, 2.5, 1.0)])

    if layout == 'fan':
        if tall:
            # The cover's type gets the lower half of the band and the cards the
            # top: a vertical frame read at 260px wide has room for one stack of
            # words at a legible size and nothing else, so the cards go where the
            # words are not rather than sharing a band with them. Both live inside
            # GRID, and the cards are PORTRAIT - the captures are 720x1280, so a
            # landscape card in a tall frame throws away most of the game and
            # leaves dead ground either side of the flankers.
            if story:
                # Everything shifts up against the cover's numbers: the Story band
                # ends at 0.780 rather than 0.852, and the 0.790-0.870 sticker zone
                # under it has to stay clear of both the type and the cards.
                col = (0.075, 0.435, 0.85, 0.340)
                cards = [(0.280, 0.145, 0.44, 0.262, -6.0, -3.0)]
                flanks = [(0.055, 0.172, 0.31, 0.210, -16.0, 7.0, 0.94),
                          (0.635, 0.172, 0.31, 0.210, 16.0, -7.0, 0.94)]
                light = (0.50, 0.25)
            else:
                col = (0.075, 0.430, 0.85, 0.420)
                cards = [(0.280, 0.150, 0.44, 0.272, -6.0, -3.0)]
                flanks = [(0.055, 0.178, 0.31, 0.218, -16.0, 7.0, 0.94),
                          (0.635, 0.178, 0.31, 0.218, 16.0, -7.0, 0.94)]
                light = (0.50, 0.26)
        else:
            # The flankers live at x >= 0.505, so the type column has no reason to
            # be shorter here than under `stack`: three lines at the cap-height
            # floor need 82% of the frame height and 0.80 fails them.
            col = (0.05, 0.08, 0.45, 0.84)
            cards = [(0.545, 0.235, 0.40, 0.52, -9.0, -2.5)]
            flanks = [(0.505, 0.105, 0.30, 0.39, -18.0, 7.0, 0.95),
                      (0.505, 0.545, 0.30, 0.39, -18.0, -7.0, 0.95)]
            light = (0.74, 0.46)
        return dict(col=col, light=light, cards=cards, flanks=flanks)

    # stack: one subject, one message. The default, and the one the CTR evidence
    # actually supports - a single card beats a wall of them at feed size.
    if tall:
        if story:
            col = (0.075, 0.450, 0.85, 0.325)
            cards = [(0.250, 0.145, 0.50, 0.280, -7.0, -2.5)]
            light = (0.52, 0.25)
        else:
            col = (0.075, 0.430, 0.85, 0.420)
            cards = [(0.250, 0.150, 0.50, 0.285, -7.0, -2.5)]
            light = (0.52, 0.26)
    else:
        col = (0.05, 0.08, 0.47, 0.84)
        cards = [(0.535, 0.145, 0.425, 0.60, -11.0, -2.5)]
        light = (0.76, 0.42)
    return dict(col=col, light=light, cards=cards, flanks=[])


def _face(fpath, px, weight):
    """The font at the size and weight the CSS will actually draw it at.

    Archivo is a variable font whose default instance is weight 600, and the
    template asks for 700 on the sub line and 800 in the bar. Measuring the
    default underestimates the width by about 2% - which is small enough to look
    like a rounding error and large enough to wrap a line that was measured as
    fitting. Width axis stays at its 100 default; only weight is set.
    """
    return font(fpath, px, [weight, 100] if weight else None)


def fit_line(text, fpath, width, max_px, track=0.0, weight=None):
    """Largest size at which one line of `text` fits `width`, tracking included.

    The browser adds `track` em of letter-spacing after every character and PIL
    does not, so a size chosen from glyph widths alone overflows. A bar is exactly
    as wide as the frame, so its overflow has nowhere to go and gets clipped at
    the edge - which is how "WEEKLYARCADE.GAMES" rendered as "WEEKLYARCADE.GAME".
    """
    lo, hi, best = 8, max(8, int(max_px)), 8
    while lo <= hi:
        mid = (lo + hi) // 2
        f = _face(fpath, mid, weight)
        w = f.getbbox(text)[2] - f.getbbox(text)[0] + track * mid * len(text)
        if w <= width:
            best, lo = mid, mid + 1
        else:
            hi = mid - 1
    return best


def wrap_lines(text, fpath, width, px, track=0.0, weight=None):
    """How many lines the browser will break `text` into at `px`.

    Greedy on spaces, the way the flex column wraps it. This has to be counted
    rather than assumed, because the sub line's height comes out of the headline's
    budget: reserve one line for a sub that wraps to two and the whole centred
    column grows past the bottom of the safe band.
    """
    f = _face(fpath, max(1, int(px)), weight)

    def w(t):
        return f.getbbox(t)[2] - f.getbbox(t)[0] + track * px * len(t)

    lines, cur = 1, ''
    for word in text.split():
        trial = f'{cur} {word}'.strip()
        if cur and w(trial) > width:
            lines, cur = lines + 1, word
        else:
            cur = trial
    return lines


def fit(words, fpath, col_w, col_h, size, reserve, warn, vid,
        floor=MIN_CAP_FRAC):
    """One size for every line: the largest that fits the column both ways.

    Per-line sizing reads as a ransom note, so the widest word sets the size for
    all of them. Then the stack has to fit what is left of the column's height
    after the mark and the sub line have taken their share - measured in pixels,
    not guessed as a fraction, because guessing is how "GAMES" ended up half off
    the bottom edge. The floor is checked last: a line that only fits by shrinking
    under it is not a line anyone reads in a feed.
    """
    H = size[1]
    px = min(fit_word(w['text'], fpath, col_w, int(H * 0.6)) for w in words)
    budget = max(1, col_h - reserve)
    if len(words) * px * 0.94 > budget:
        px = int(budget / (len(words) * 0.94))
    cap = px * CAP_OF_EM
    if cap < H * floor:
        want = len(words) * (H * floor / CAP_OF_EM) * 0.94 + reserve
        warn(f'{vid}: cap height {cap / H * 100:.1f}% of frame, floor is '
             f'{floor * 100:.0f}%. Cut a word - {len(words)} lines at the '
             f'floor need {want / H * 100:.0f}% of the frame height and the '
             f'column is {col_h / H * 100:.0f}%.')
    return px


def build(v, frame, others, size, spec, mark, tmp, warn, surface='cover'):
    layout = v['layout']
    W, H = size
    tall = H > W
    bd = band(surface)
    g = geometry(layout, size, surface)

    # An interactive sticker is a hole in the layout, so it is resolved before
    # anything is sized: the type and the cards get the band above it, not the
    # whole band. `sticker: "none"` opts a card out.
    zone, kind = None, None
    if tall and surface == 'story':
        want = v.get('sticker', 'link')
        if isinstance(want, dict):
            kind = want.get('kind', 'link')
            zone = tuple(want['band']) if want.get('band') else STICKER_KINDS.get(kind)
        elif want and want != 'none':
            kind = want
            zone = STICKER_KINDS.get(kind)
        if kind and zone is None:
            sys.exit(f"{v['id']}: unknown sticker kind {kind!r} - one of "
                     f"{sorted(STICKER_KINDS)}, or \"none\"")
        if zone:
            usable = zone[0] - STICKER_GAP
            if usable - bd[0] < 0.25:
                warn(f"{v['id']}: a {kind} sticker leaves only "
                     f"{(usable - bd[0]) * 100:.0f}% of the frame for the card. "
                     f"Move the zone down or use a shorter sticker.")
            g = squeeze(g, bd, usable)
            bd = (bd[0], usable)
    cx, cy, cw, ch = (g['col'][0] * W, g['col'][1] * H,
                      g['col'][2] * W, g['col'][3] * H)

    # `accent` names the word that carries the amber gradient, same key the PIL
    # renderer uses. With none named the last word takes it: it is the one the eye
    # finishes on, and one hot word out of three is the point - two is a stripe.
    ws = v['text'].split()
    acc = v.get('accent', ws[-1]).upper()
    words = [{'text': w.upper(), 'hot': w.upper() == acc} for w in ws]
    if len(words) > WORD_CAP:
        warn(f"{v['id']}: {len(words)} words. Under four beats text-heavy by "
             f"about 30% - \"{v['text']}\" is a title, not a thumbnail.")

    sub = v.get('sub', '')
    bar = layout == 'blast' and bool(sub)
    # Measure the mark rather than reserving a fraction for it: it is a fixed
    # aspect PNG, so its height at the width we draw it is arithmetic.
    # No mark on a cover. Instagram already draws the avatar and the handle
    # immediately above and below the post, so the logo says nothing the viewer
    # cannot see - and at 26% of the width it eats 15% of GRID, which is exactly
    # the height the second word needs to clear the cap-height floor.
    if tall:
        mark = None
    mark_w = int(W * 0.155) if mark is not None else 0
    gap = int(H * 0.025)
    reserve = 0
    if mark is not None and not tall:
        mi = Image.open(mark)
        reserve += round(mark_w * mi.height / mi.width) + gap
    sub_px = 0
    sub_lines = 1
    if sub and not bar:
        sub_px = max(14, int(H * 0.032))
        # .sub carries 0.06em of tracking and wraps at the column's width.
        sub_lines = wrap_lines(sub.upper(), spec['fonts']['body'], cw, sub_px,
                               0.06, SUB_WEIGHT)
        reserve += round(sub_px * (0.9 + sub_lines))   # the lines plus the margin

    bar_h = int(H * (0.10 if H > W else 0.115))
    # The bar spans the whole frame, so there is no margin for its text to spill
    # into. Size it to fit the width rather than to a fraction of its height.
    bar_px = 0
    if bar:
        bar_px = fit_line(sub.upper(), spec['fonts']['body'],
                          W - 2 * int(W * 0.05), bar_h * 0.4, 0.1, BAR_WEIGHT)
        if bar_px < bar_h * 0.26:
            warn(f"{v['id']}: \"{sub}\" only fits the bar at {bar_px}px, "
                 f'{bar_px / bar_h * 100:.0f}% of the bar height, so it reads as '
                 f'fine print rather than a second message. Shorten it.')
    px = fit(words, spec['fonts']['display'], cw, ch, size, reserve, warn,
             v['id'], CAP_FLOOR.get(surface, MIN_CAP_FRAC))

    # What .col actually fills, as opposed to the box it is centred in. This is
    # the number check() has to measure against the safe band.
    fill = round(len(words) * px * 0.94 + reserve)
    fill_y = round(cy + (ch - fill) / 2)

    glow, deep = palette(frame)
    S = {
        'w': W, 'h': H, 'layout': layout, 'light': g['light'],
        'glow': glow, 'deep': deep,
        'ambient': ambient(frame, tmp, f"amb-{v['id']}"),
        'col': {'x': round(cx), 'y': round(cy), 'w': round(cw), 'h': round(ch)},
        'colFill': {'y': fill_y, 'h': fill},
        'words': words, 'fontPx': px,
        'sub': sub.upper(), 'barSub': bar,
        'subPx': sub_px or max(14, int(H * 0.032)),
        'subLines': sub_lines,
        'markGap': gap,
        'barH': bar_h,
        'barSubPx': bar_px or round(bar_h * 0.4),
        # On a cover the bar cannot close the frame: the bottom eighth is cropped
        # away in the grid and covered by Instagram's caption overlay in the feed,
        # so a bar flush to the edge is a bar nobody reads.
        'barBottom': round(H * (1 - bd[1])) if tall else 0,
        # Carried on the spec so check() measures against the surface actually
        # being rendered instead of assuming the cover's crop.
        'surface': surface, 'band': [round(bd[0] * H), round(bd[1] * H)],
        'sticker': [round(zone[0] * H), round(zone[1] * H)] if zone else None,
        'stickerKind': kind,
        'hero': prep(frame, W, H, tmp, f"hero-{v['id']}") if layout == 'blast'
                else None,
        'flankers': [],
    }
    if mark is not None:
        S['mark'] = Path(mark).as_uri()
        S['markW'] = mark_w

    if layout != 'blast':
        x, y, w, h, ry, rot = g['cards'][0]
        S['card'] = {'x': round(x * W), 'y': round(y * H),
                     'w': round(w * W), 'h': round(h * H), 'ry': ry, 'rot': rot}
        bias = v.get('bias_y', spec.get('bias_y', 0.42))
        S['hero'] = prep(frame, w * W, h * H, tmp, f"hero-{v['id']}", bias)
        # Flankers come from the other variants' picks: already sampled from
        # different spans, already checked for looking different, so the fan gets
        # distinct games without a second selection pass.
        pool = [Path(f) for f in v.get('flankers', [])] or list(others)
        yh = meanY(S['hero'])
        for i, ((x, y, w, h, ry, rot, sc), src) in enumerate(
                zip(g['flanks'], pool)):
            fs = prep(src, w * W, h * H, tmp, f"flank-{v['id']}-{i}", bias)
            S['flankers'].append({
                'x': round(x * W), 'y': round(y * H),
                'w': round(w * W), 'h': round(h * H),
                'ry': ry, 'rot': rot, 'scale': sc, 'src': fs,
                # Never on a versus card: dimming one of two poll options is a
                # thumb on the scale, and the whole point is that the vote is real.
                'dim': 1.0 if layout == 'versus' else dim(meanY(fs), yh),
            })
        if g['flanks'] and len(pool) < len(g['flanks']):
            warn(f"{v['id']}: {layout} wants {len(g['flanks'])} flankers and has "
                 f"{len(pool)}. Give it more variants or a `flankers` list.")

    if v.get('cue'):
        # Measured, not placed: a ring at a fixed fraction of the frame is a ring
        # around whatever happened to be there. Measured on the CROPPED hero, not
        # the source still - prep() has already cut the frame to the card's aspect
        # off centre, so a coordinate from the original lands somewhere else.
        # `cue_at: [fx, fy]` overrides the measurement, in fractions of the
        # subject. Edge energy on a depth-of-field frame picks a hard-edged prop
        # over a soft-edged character, and when it does, arguing with the metric
        # is slower than naming the spot.
        if v.get('cue_at'):
            fx, fy = v['cue_at']
        else:
            probe = Image.open(_path(S['hero'])).convert('RGB')
            sx, sy = salient(probe, 0.40)
            fx, fy = sx / probe.width, sy / probe.height
        if layout == 'blast':
            cue_x, cue_y = fx * W, fy * H
        else:
            c = S['card']
            cue_x, cue_y = c['x'] + fx * c['w'], c['y'] + fy * c['h']
        # Clamp: the busiest cell can be against an edge, and a ring half off
        # the frame is not a cue, it is a scratch.
        r = int(min(W, H) * 0.11)
        pad = r + int(min(W, H) * 0.02)
        S['cue'] = {'kind': v['cue'], 'r': r,
                    'x': round(min(max(cue_x, pad), W - pad)),
                    'y': round(min(max(cue_y, pad), H - pad))}
    return S


def page(S, spec, tmp, name):
    html = TEMPLATE.read_text()
    html = html.replace('__DISPLAY__', Path(spec['fonts']['display']).as_uri())
    html = html.replace('__BODY__', Path(spec['fonts']['body']).as_uri())
    html = html.replace('<script>', '<script>window.SPEC = ' + json.dumps(S) + ';\n',
                        1)
    p = tmp / f'{name}.html'
    p.write_text(html)
    return p


def check(im, S, vid, warn):
    """Contrast under the type, after the render rather than before it.

    Measuring the source frame answers a question about the frame. What the
    viewer squints at is the composite, where a scrim, a vignette and a card's
    shadow have all already landed - so measure that.
    """
    box = (S['col']['x'], S['col']['y'],
           S['col']['x'] + S['col']['w'], S['col']['y'] + S['col']['h'])
    if S['h'] > S['w']:
        top, bot = S['band']
        why = ("Instagram's 4:5 crop" if S.get('surface') != 'story'
               else "the Story safe band")
        harm = ('It will be cut off in the grid and the feed.'
                if S.get('surface') != 'story'
                else "Instagram's own UI is drawn over it there.")
        # The box is only a container. What overflows it is the type, and .col
        # centres its content, so measure the content's own extent: a box that
        # sits inside the band tells you nothing if the type has grown past it.
        cf = S.get('colFill') or {'y': S['col']['y'], 'h': S['col']['h']}
        edges = [('type column', cf['y'], cf['y'] + cf['h'])]
        if S.get('card'):
            edges.append(('card', S['card']['y'],
                          S['card']['y'] + S['card']['h']))
        if S.get('barSub'):
            bb = S['h'] - S.get('barBottom', 0)
            edges.append(('sub bar', bb - S['barH'], bb))
        for what, y0, y1 in edges:
            if y0 < top - 1 or y1 > bot + 1:
                warn(f'{vid}: the {what} runs {round(y0)}-{round(y1)}px, outside '
                     f'{why} at {round(top)}-{round(bot)}px. {harm}')
        # The link sticker gets added by hand later. If any drawn element reaches
        # into its zone, the sticker will land on top of that element - which is
        # not something the render can show you, so it has to be checked.
        if S.get('sticker'):
            s0, s1 = S['sticker']
            for what, y0, y1 in edges:
                if y1 > s0 and y0 < s1:
                    warn(f'{vid}: the {what} reaches into the link-sticker zone '
                         f'({s0}-{s1}px). The sticker will sit on top of it.')
    r = text_ratio(im, box, WHITE)
    if r < MIN_RATIO:
        warn(f'{vid}: white type sits at {r:.1f}:1 over its column, AA wants '
             f'{MIN_RATIO}. Darken the wash or move the type off the subject.')
    return r


def main():
    spec = json.loads(Path(sys.argv[1]).read_text())
    outdir = Path(sys.argv[2]).resolve()
    outdir.mkdir(parents=True, exist_ok=True)
    tmp = outdir / '.web'
    tmp.mkdir(exist_ok=True)
    frames_tmp = outdir / '.frames'
    frames_tmp.mkdir(exist_ok=True)

    # 'story' and 'cover' are both 1080x1920 files; what differs is which pixels
    # Instagram will cover up, so the surface is named rather than inferred.
    vertical = spec.get('aspect') == '9x16'
    size = COVER if vertical else YT
    surface = spec.get('surface', 'cover' if vertical else 'youtube')
    if vertical and surface not in SURFACES:
        sys.exit(f"unknown surface {surface!r} - one of {sorted(SURFACES)}")
    mark = Path(spec['mark']) if spec.get('mark') else None
    warnings = []

    if spec.get('frames_dir'):
        picks = sample_stills(spec['frames_dir'], spec.get('panels', 1),
                              len(spec['variants']), spec.get('every', 6),
                              frames_tmp)
        print('subject frames from ' + spec['frames_dir'] + ': ' +
              ', '.join(f'{p.name} (score {s:.0f})' for s, _, p in picks))
    else:
        picks = sample_frames(spec['video'], [tuple(a) for a in spec.get('avoid', [])],
                             len(spec['variants']), frames_tmp)
        print('subject frames from the cut at ' +
              ', '.join(f'{t:.2f}s (score {s:.0f})' for s, t, _ in picks))

    made = []
    for v, (s, t, p) in zip(spec['variants'], picks):
        v.setdefault('layout', spec.get('layout', 'stack'))
        frame = Path(v['frame']) if v.get('frame') else p
        others = [q for _, _, q in picks if q != p]
        S = build(v, frame, others, size, spec, mark, tmp,
                  warnings.append, surface)
        html = page(S, spec, tmp, f"page-{v['id']}")
        shot = tmp / f"shot-{v['id']}.png"
        im = shoot(html, size, shot, tmp)
        r = check(im, S, v['id'], warnings.append)

        out = outdir / f"thumb-{v['id']}.jpg"
        q = 92
        while True:
            im.save(out, 'JPEG', quality=q, subsampling=0, optimize=True)
            if out.stat().st_size <= JPEG_MAX or q <= 60:
                break
            q -= 8
        st = f"  +{S['stickerKind']}" if S.get('stickerKind') else ''
        print(f"  {out.name}  {v['layout']:<6} {v.get('strategy', '-'):<9} "
              f"\"{v['text']}\"  {Path(frame).name}  cap {S['fontPx']}px "
              f"{r:.1f}:1  {out.stat().st_size // 1024}KB q{q}{st}")
        made.append((v['id'], im))

    contact(made, size, outdir / 'thumbs-contact.png')
    print('  thumbs-contact.png  judge from this, not the full-size files')
    for w in warnings:
        print(f'WARN {w}')


if __name__ == '__main__':
    main()
