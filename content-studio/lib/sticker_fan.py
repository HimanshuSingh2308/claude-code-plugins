#!/usr/bin/env python3
"""sticker_fan - the channel's house thumbnail language, as a callable.

    python3 sticker_fan.py spec.json outdir

This is the layout that replaced a clean centred grid, and the reason it exists
is the audience: 18-35, mostly gamers. A tidy, well-kerned, symmetrical
thumbnail is the correct answer for a B2B webinar card and the wrong answer for a
game platform, because it reads as something produced by a marketing department
rather than by someone who plays. Everything below is a deliberate loudness, and
each element is here because it survives 210px, not because it looks good at
1280.

THE LANGUAGE, in the order it is painted:

  1. The channel backdrop - navy, plum, a warm glow. Never a video frame.
  2. A wide teal BURST radiating from behind the fan. Alpha 17, blurred 11px at
     1280: this is a texture, not rays. See burst().
  3. A VIGNETTE that sinks the corners so the fan sits in a pool of light.
  4. THREE tilted card STICKERS, fanned, each a game's real gameplay art with a
     thick WHITE stroke OUTSIDE it and a cast shadow under it. Three, not eight,
     and not ten - see the count rule below.
  5. An amber RANK DISC on each card's outer corner, numeral only.
  6. The mark-and-wordmark LOCKUP.
  7. The HEADLINE in a heavy display face with a HARD-OFFSET pink shadow - an
     offset copy, not an outline and not a blur.
  8. An optional PROOF line in amber under the headline.

WHY THREE CARDS AND NOT THE WHOLE CATALOGUE. The obvious way to say "ten games"
is to show ten games, and it is wrong at the size the image is served. Ten tiles
across 1280px is ten 232px stamps, and at the ~210px a YouTube sidebar actually
serves that is ten 38px stamps - a texture, not ten games. The count belongs in
the words, where a numeral is legible at any size; the picture area belongs to
however many games can be recognised, which is three. Rank discs on 1, 2 and 3
do the rest: a countdown whose lowest visible number is 3 implies the other
seven without drawing them. `CARDS = 3` and render() refuses a longer cast.

WHY THE TILT HAS TO BE SUPERSAMPLED. A card rotated at its final size shows a
visibly jagged stroke, because the stroke is the highest-contrast edge in the
frame and the one crossing the pixel grid at an angle. So the sticker is built at
up to 2x, rotated there with BICUBIC, and reduced to size LAST with LANCZOS.
Getting this wrong does not look like aliasing, it looks like cheap.

WHY THE STROKE IS OUTSIDE THE ART. It is a filled rounded rect on a plate
`2 * stroke` larger, with the art composited into the middle. A stroke drawn
inset eats the outer pixels of art that was composed to its own edges, which on
a gameplay capture means eating the HUD.

WHAT IS FIXED AND WHAT IS FREE. The tilt, the stroke, the shadow, the discs, the
burst, the vignette and the pink offset are LAYOUT CONSTANTS and must be
identical across a variant set. The only thing a variant may change is the words
and whether the hero gets a ring. A three-variant test whose arms also differ in
treatment cannot say which difference moved the number, and the words are the
axis worth testing - see thumbnail-design's three-variant rule.

THE PORTRAIT FRAME YOU DESIGN IS NOT THE FRAME ANYBODY SEES. Instagram crops a
9:16 post to 4:5 in the feed and 1:1 in the profile grid, so of a 1920-tall
frame only y 284..1636 is ever on screen. The first portrait pass in this
language put the lockup at y 132 and the headline band at 168..563 - the top
eighth - and shipped, because a 1080x1920 file with the type at the top looks
completely correct when you open it. The feed crop cut the top third off every
headline and removed the mark entirely. render() therefore ENDS in a guard that
exits and names the pixels; it is not a warning, because the whole failure mode
is that the output looks right.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import thumbnail as T                                    # noqa: E402

CARDS = 3

# Mirrors thumbnail_web.SURFACES['cover']. Duplicated rather than imported
# because importing thumbnail_web drags in the Chrome calibration, and this
# module has no browser dependency. If one moves, move the other.
GRID = (0.148, 0.852)

PINK = (0xFF, 0x4D, 0x9B)       # the headline's offset shadow, and only that
TEAL = (0x35, 0xD6, 0xF5)
AMBER = T.AMBER
WHITE = T.WHITE
INK = T.INK

# Geometry as FRACTIONS of the frame, so the same numbers render a 1280x720 and
# a 2560x1440 identically. Pixel constants were the first version and they went
# stale the moment anything moved.
#
# `fan` is in RANK ORDER, 1 first. Painting order is derived: the hero is
# painted LAST so it sits in front, which is also why its badge corner is the
# one that is never covered.
LAYOUT = {
    '16x9': dict(
        # 3 left, 2 right, which is NOT podium order. The hero overlaps the
        # inner half of each flanker, so a flanker only ever shows its OUTER
        # half - put the game whose art lives on its right on the right. Getting
        # this backwards cost a whole render: the game with a text HUD down its
        # left third showed nothing but small type.
        fan=[dict(cx=0.500, cy=0.664, w=0.4375, rot=-2.5, badge='tl'),
             dict(cx=0.795, cy=0.733, w=0.2938, rot=9.0, badge='tr'),
             dict(cx=0.205, cy=0.733, w=0.2938, rot=-9.0, badge='tl')],
        stroke=0.0055, radius=0.014,
        kicker_cy=0.075, kicker=0.039, kicker_tr=0.008, mark_w=0.0438,
        head_max=0.898, head_cap=0.417, head_top_gap=0.95, head_pad=0.042,
        head_shadow=0.0125,
        proof_cy=0.3444, proof=0.042, proof_tr=0.0047,
        badge=0.0861, badge_hero=0.1111, ring_w=0.0111,
        burst_at=(0.50, 0.66), burst_n=20, burst_r=1.9,
    ),
    '9x16': dict(
        # Portrait cascades instead of fanning: three cards side by side in a
        # 1080-wide frame are 340px each, which is the crowding this language
        # exists to remove. Rank order runs top to bottom, which is reading
        # order, so no podium trick is needed. Every number is seated against
        # GRID rather than against the frame - cards 1 and 2 and all three discs
        # are inside the band, and card 3 is allowed past its bottom on purpose,
        # because a cascade cut by the frame is the one element that should say
        # "there are more than three".
        fan=[dict(cx=0.500, cy=0.523, w=0.5926, rot=-3.0, badge='tl'),
             dict(cx=0.528, cy=0.695, w=0.5185, rot=5.5, badge='tr'),
             dict(cx=0.481, cy=0.858, w=0.4815, rot=-4.5, badge='tl')],
        stroke=0.0093, radius=0.0241,
        kicker_cy=0.175, kicker=0.0198, kicker_tr=0.0120, mark_w=0.0741,
        head_max=0.889, head_cap=0.224, head_top_gap=0.95, head_pad=0.0229,
        head_shadow=0.0068,
        proof_cy=0.3698, proof=0.0193, proof_tr=0.0074,
        badge=0.0796, badge_hero=0.1037, ring_w=0.0111,
        burst_at=(0.50, 0.52), burst_n=22, burst_r=1.5,
    ),
}

# What each fraction is measured against. Widths, x positions and tracking scale
# with W; heights, y positions and type sizes scale with H. Mixing these up
# produces a layout that is subtly wrong at one aspect and correct at the other,
# which is the hardest kind of wrong to see.
BY_W = {'cx', 'w', 'head_max', 'mark_w', 'kicker_tr', 'proof_tr', 'stroke',
        'radius', 'ring_w', 'badge', 'badge_hero'}


def px(S, key, W, H, v=None):
    v = S[key] if v is None else v
    return v * (W if key in BY_W else H)


def geometry(aspect, W, H):
    """LAYOUT resolved to whole pixels for one frame size.

    Card widths are forced to a multiple of 8 so `w / card_ar` stays whole at
    the 1.6 art aspect the captures use. An off-aspect card can only be filled
    by cropping or stretching, and both are visible on a HUD.
    """
    S = dict(LAYOUT[aspect])
    g = {}
    for k, v in S.items():
        if k == 'fan':
            g['fan'] = []
            for i, f in enumerate(v):
                w = int(round(f['w'] * W)) & ~7
                g['fan'].append(dict(rank=i + 1, hero=(i == 0),
                                     cx=round(f['cx'] * W), cy=round(f['cy'] * H),
                                     w=max(8, w), rot=f['rot'], badge=f['badge']))
        elif k in ('burst_at', 'burst_n', 'burst_r', 'head_top_gap'):
            g[k] = v
        else:
            g[k] = px(S, k, W, H)
    g['W'], g['H'] = W, H
    return g


def fit_box(d, s, path, start, max_w, max_h):
    """Largest size at which the string's INK fits a box on BOTH axes.

    thumbnail.fit_word measures width only, which is right for one word in a
    column and wrong here: a one-word headline in a wide band has nothing
    stopping it growing straight up through the kicker above it. Returns
    (font, bbox) so the caller can centre on ink rather than on the face's
    ascender/descender box, which for a heavy display face is most of a line of
    slack.
    """
    for size in range(int(start), 7, -2):
        f = T.font(path, size)
        b = d.textbbox((0, 0), s, font=f)
        if b[2] - b[0] <= max_w and b[3] - b[1] <= max_h:
            return f, b
    f = T.font(path, 8)
    return f, d.textbbox((0, 0), s, font=f)


def backdrop(W, H):
    """The channel ground: navy to plum, one warm glow, never a video frame.

    A composed thumbnail's whole advantage is that the background was chosen. A
    frame of the cut brings the cut's own burnt-in type with it, and then the
    brand's type is in the picture twice, the second copy in a position nobody
    picked.
    """
    im = T.ramp((W, H), T.NAVY, T.PLUM).convert('RGBA')
    im.alpha_composite(T.spotlight((W, H), 0.50, 0.30, max(W, H) * 0.55,
                                   colour=TEAL, alpha=52))
    im.alpha_composite(T.spotlight((W, H), 0.14, 0.86, max(W, H) * 0.40,
                                   colour=T.PLUM, alpha=70))
    return im


def burst(g):
    """Wide teal wedges from a point behind the fan.

    Alpha 17 and an 11px blur at 1280, and both numbers are the second attempt.
    At alpha 26 with a 7px blur the wedges banded visibly in the top corners,
    where there is no card to break their edges up, and the whole frame read as
    a cheap filter. A burst is either felt or wrong; there is no middle setting.
    """
    W, H, k = g['W'], g['H'], max(g['W'], g['H']) / 1280
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    cx, cy = g['burst_at'][0] * W, g['burst_at'][1] * H
    r = max(W, H) * g['burst_r']
    step = 360.0 / (g['burst_n'] * 2)
    for i in range(g['burst_n']):
        d.pieslice([cx - r, cy - r, cx + r, cy + r],
                   i * step * 2, i * step * 2 + step, fill=TEAL + (17,))
    return lay.filter(ImageFilter.GaussianBlur(11 * k))


def sticker(art, w, rot, g, card_ar=1.6):
    """One card: art, white stroke OUTSIDE it, tilted, antialiased properly.

    `art` is any image; it is centre-cropped to `card_ar` rather than squeezed.
    The plate is built at up to 2x and reduced LAST, which is the only thing
    that keeps the stroke clean through the rotation - see the module docstring.
    """
    h = round(w / card_ar)
    pw = min(1920, w * 2)
    pw -= pw % 8
    ph = round(pw / card_ar)
    k = pw / w

    R = max(2, round(g['radius'] * k))
    face = T.cover(art.convert('RGB'), pw, ph, 0.5).convert('RGBA')
    face.putalpha(T.rounded_mask((pw, ph), R))

    sw = max(2, round(g['stroke'] * k))
    cw, ch = pw + 2 * sw, ph + 2 * sw
    im = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([0, 0, cw - 1, ch - 1],
                                         radius=R + sw, fill=WHITE + (242,))
    im.alpha_composite(face, (sw, sw))
    im = im.rotate(rot, expand=True, resample=Image.BICUBIC)
    return im.resize((max(1, round(im.width / k)), max(1, round(im.height / k))),
                     Image.LANCZOS)


def cast_shadow(st, dx, dy, blur, alpha=165):
    """The shadow is derived from the rotated sticker's OWN alpha, so it is the
    right silhouette at any tilt. A rounded rect drawn to match is a rounded
    rect that stops matching the first time an angle changes."""
    m = round(blur * 3)
    lay = Image.new('RGBA', (st.width + 2 * m, st.height + 2 * m), (0, 0, 0, 0))
    lay.paste(INK + (alpha,), (m, m), st.getchannel('A'))
    return lay.filter(ImageFilter.GaussianBlur(blur)), dx - m, dy - m


def hero_ring(g, w, rot, card_ar=1.6):
    """The cue: a rounded rect around the hero, following its tilt.

    It was an ellipse for exactly one render. An ellipse inscribing a 1.6:1 card
    has to bulge about 20% of the card's height past every edge, which in a
    portrait cascade swallows the card below it and crosses that card's rank
    disc. A rounded rect tracks the shape, so the inflation drops to 3.5%.

    Returned cropped to its own INK. The layer carries a transparent margin so
    the rotation has room, and measuring the layer instead of the ink makes
    every number wrong by that margin per side - it reported a visibly clipped
    ring as fitting with a pixel to spare, and it silently stole ~30px of
    headline from the variant that uses it, because the band floor was being set
    off a transparent edge.
    """
    ow = w + 2 * g['stroke']
    oh = round(w / card_ar) + 2 * g['stroke']
    infl = round(min(ow, oh) * 0.035) + g['ring_w']
    m = round(2 * g['ring_w'])
    lw, lh = round(ow + 2 * infl), round(oh + 2 * infl)
    lay = Image.new('RGBA', (lw + 2 * m, lh + 2 * m), (0, 0, 0, 0))
    ImageDraw.Draw(lay).rounded_rectangle(
        [m, m, m + lw - 1, m + lh - 1], radius=round(g['radius'] + infl),
        outline=AMBER + (255,), width=max(1, round(g['ring_w'])))
    lay = lay.rotate(rot, expand=True, resample=Image.BICUBIC)
    return lay.crop(lay.getchannel('A').getbbox())


def disc(d, x, y, r, label, fonts):
    """An amber disc with a navy numeral. Numeral ONLY, and upright even though
    the card under it is tilted.

    A disc with a game name in it is a smear at feed size; a numeral is the one
    glyph that survives 38px. And a tilted numeral is a legibility cost with no
    funk to show for it - the cards carry the energy, the numbers carry the
    information.
    """
    d.ellipse([x - r, y - r, x + r, y + r], fill=AMBER + (255,),
              outline=INK + (210,), width=max(1, round(r * 0.09)))
    f = T.font(fonts['display'], round(r * 1.46))
    d.text((x, y + r * 0.04), label, font=f, fill=INK + (255,), anchor='mm')


def render(cast, headline, aspect='16x9', fonts=None, mark=None, kicker=None,
           proof=None, ring=False, card_ar=1.6, warn=print):
    """One frame in the house language.

    cast      exactly CARDS images or paths, in RANK ORDER (1 first).
    headline  the words. Keep it under four - see thumbnail-design.
    fonts     {'display': path, 'body': path}.
    mark      an RGBA logo, or None. Covers drop it: Instagram already draws the
              avatar and handle immediately above the post.
    ring      put the amber cue around the hero. One variant of a set, at most.
    """
    if len(cast) != CARDS:
        sys.exit(f"sticker_fan takes exactly {CARDS} cards in rank order, got "
                 f"{len(cast)}. The count belongs in the words, not the picture "
                 f"- see the module docstring.")
    if abs(card_ar - 1.6) > 0.3:
        warn(f"WARN card_ar {card_ar:.2f} is a long way from the 1.6 the fan "
             f"fractions were measured on; re-seat LAYOUT[{aspect!r}]['fan'] "
             f"rather than trusting these positions.")
    W, H = (1280, 720) if aspect == '16x9' else (1080, 1920)
    g = geometry(aspect, W, H)

    im = backdrop(W, H)
    im.alpha_composite(burst(g))
    im.alpha_composite(T.vignette((W, H), 0.38, g['burst_at'][0],
                                  g['burst_at'][1]).convert('RGBA'))
    d = ImageDraw.Draw(im)

    art = [a if isinstance(a, Image.Image) else Image.open(a) for a in cast]
    fan = list(zip(g['fan'], art))
    # Painting order: back to front, hero last. Every shadow goes down before
    # any card does, so no card casts a shadow onto a card in front of it.
    order = sorted(fan, key=lambda p: p[0]['hero'])
    built = [(sticker(a, f['w'], f['rot'], g, card_ar), f) for f, a in order]

    def at(st, f):
        return round(f['cx'] - st.width / 2), round(f['cy'] - st.height / 2)

    for st, f in built:
        sh, dx, dy = cast_shadow(st, round(g['stroke'] * 1.4),
                                 round(g['stroke'] * 2.2), g['stroke'] * 1.6)
        x, y = at(st, f)
        im.alpha_composite(sh, (x + dx, y + dy))
    for st, f in built:
        im.alpha_composite(st, at(st, f))

    # The ring is part of the fan's FOOTPRINT, not decoration on top of it: it
    # sets the top of the picture block, and it is the element most likely to
    # run off the frame because it is the outermost one. Both are handled by
    # measuring it rather than by trusting the numbers above.
    top = min(f['cy'] - st.height / 2 for st, f in built)
    if ring:
        hero = next(f for f in g['fan'] if f['hero'])
        r = hero_ring(g, hero['w'], hero['rot'], card_ar)
        rx, ry = round(hero['cx'] - r.width / 2), round(hero['cy'] - r.height / 2)
        if rx < 0 or ry < 0 or rx + r.width > W or ry + r.height > H:
            sys.exit(f"{aspect}: the hero ring lands at ({rx},{ry}).."
                     f"({rx + r.width},{ry + r.height}) in {W}x{H}, so an edge "
                     f"of it is cut off. A closed shape clipped on one side "
                     f"reads as a mistake rather than as a bleed - move the fan "
                     f"or shrink the hero.")
        im.alpha_composite(r, (rx, ry))
        top = min(top, ry)

    # Discs last, so nothing is ever drawn over a rank - including the ring.
    discs = []
    for st, f in built:
        br = (g['badge_hero'] if f['hero'] else g['badge']) / 2
        bx = f['cx'] + st.width * (0.40 if f['badge'] == 'tr' else -0.40)
        by = f['cy'] - st.height * 0.36
        disc(d, bx, by, br, str(f['rank']), fonts)
        discs.append((f['rank'], by - br, by + br))

    lock_h = 0
    if mark is not None and kicker:
        m = mark.resize((round(g['mark_w']),
                         round(mark.height * g['mark_w'] / mark.width)),
                        Image.LANCZOS)
        kf = T.font(fonts['body'], round(g['kicker']))
        kw = d.textlength(kicker, font=kf) + g['kicker_tr'] * (len(kicker) - 1)
        gap = round(g['mark_w'] * 0.34)
        lx = round((W - (m.width + gap + kw)) / 2)
        im.alpha_composite(m, (lx, round(g['kicker_cy'] - m.height / 2)))
        # One optical centre line for the mark and the wordmark. Anchoring the
        # text to its own top hangs it a half-cap low, which reads as a lockup
        # that was assembled rather than set.
        tx = lx + m.width + gap
        for ch in kicker:
            d.text((tx, g['kicker_cy']), ch, font=kf, fill=TEAL + (250,),
                   anchor='lm')
            tx += d.textlength(ch, font=kf) + g['kicker_tr']
        lock_h = m.height

    # The band the headline owns: under the lockup, over whatever comes next.
    # The offset shadow lives inside the band, so the fit has to pay for it.
    off = round(g['head_shadow'])
    band_top = g['kicker_cy'] + g['kicker'] * g['head_top_gap']
    band_bot = (g['proof_cy'] - g['proof'] * 1.15 if proof
                else top - g['head_pad'])
    hf, hb = fit_box(d, headline, fonts['display'], g['head_cap'],
                     g['head_max'] - off, band_bot - band_top - off)
    hx = W / 2 - (hb[0] + hb[2]) / 2
    hy = (band_top + band_bot) / 2 - (hb[1] + hb[3]) / 2
    # A HARD OFFSET COPY, not an outline and not a blur. An outline at display
    # weight welds neighbouring glyphs into one slab and fills the counters; a
    # blur is a drop shadow and reads as a slide deck. The offset is the arcade
    # signal and it costs nothing at 38px.
    d.text((hx + off, hy + off), headline, font=hf, fill=PINK + (255,))
    d.text((hx, hy), headline, font=hf, fill=WHITE + (255,))

    if proof:
        pf = T.font(fonts['body'], round(g['proof']))
        pw = d.textlength(proof, font=pf) + g['proof_tr'] * (len(proof) - 1)
        tx = W / 2 - pw / 2
        for ch in proof:
            d.text((tx, g['proof_cy']), ch, font=pf, fill=AMBER + (245,),
                   anchor='lm')
            tx += d.textlength(ch, font=pf) + g['proof_tr']
        # The proof line is the strongest thing the channel owns, and a card
        # crossing it is worse than a card sitting lower. Required clearance
        # scales with the TYPE, not the frame - 0.4 of the proof's own size is
        # where the line stops reading as resting on the fan. This has bitten at
        # both aspects and both times it was found by looking at a finished
        # render: 6px of gap at 1280 wide looks finished and is not.
        need = g['proof'] * 0.4
        gap = top - (g['proof_cy'] + g['proof'] * 0.5)
        if gap < need:
            sys.exit(f"{aspect}: the proof line's ink reaches y "
                     f"{g['proof_cy'] + g['proof'] * 0.5:.0f} and the top of the "
                     f"fan is at y {top:.0f}, a gap of {gap:.0f}px where "
                     f"{need:.0f} is the floor. Raise proof_cy or drop the fan.")

    if len(headline.split()) > T.WORD_CAP:
        warn(f"WARN {len(headline.split())} words - the ~30% CTR gap opens at 4. "
             f"Rewrite shorter; do not shrink the type to fit.")
    cap = (hb[3] - hb[1]) / H
    if cap < T.MIN_CAP_FRAC:
        warn(f"WARN headline ink is {cap:.1%} of frame height, under the "
             f"{T.MIN_CAP_FRAC:.0%} floor - it will not survive the feed card.")

    if aspect == '9x16':
        crop_guard(g, headline, lock_h, hy + hb[1], hy + hb[3], proof, discs)
    return im.convert('RGB')


def crop_guard(g, headline, lock_h, ink_top, ink_bot, proof, discs):
    """Everything that must be READ, checked against GRID. Exits, not warns.

    What is checked is the lockup, the headline's ink, the proof line, the hero
    card and every rank disc. What is deliberately NOT checked is the art of the
    lower cards: the cascade bleeding out of the band is the design, and it is
    what says there are more than three.

    This exits rather than warning because the failure mode is that the file
    looks correct. A warning about a frame that opens perfectly well gets read
    as pedantry and ignored, which is exactly what happened the first time.
    """
    H = g['H']
    g0, g1 = round(GRID[0] * H), round(GRID[1] * H)
    must = [('the headline', ink_top, ink_bot)]
    if lock_h:
        must.append(('the mark lockup', g['kicker_cy'] - lock_h / 2,
                     g['kicker_cy'] + lock_h / 2))
    if proof:
        must.append(('the proof line', g['proof_cy'] - g['proof'] * 0.75,
                     g['proof_cy'] + g['proof'] * 0.75))
    for f in g['fan']:
        if f['hero']:
            h = f['w'] / 1.6
            must.append(('the hero card', f['cy'] - h / 2, f['cy'] + h / 2))
    must += [(f'rank {r}\'s disc', a, b) for r, a, b in discs]
    bad = [(n, a, b) for n, a, b in must if a < g0 or b > g1]
    if bad:
        sys.exit(f"9x16 {headline!r}: Instagram crops this to 4:5, so only "
                 f"y {g0}..{g1} of the {H} is ever on screen, and "
                 + '; '.join(f'{n} sits at {a:.0f}..{b:.0f}' for n, a, b in bad)
                 + ". Re-seat the fan and the type zone. Do not widen GRID - it "
                   "is Instagram's number, not ours.")


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    spec = json.loads(Path(sys.argv[1]).read_text())
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    fonts = spec['fonts']
    mark = Image.open(spec['mark']).convert('RGBA') if spec.get('mark') else None
    for v in spec['variants']:
        im = render(spec['cast'], v['text'], aspect=spec.get('aspect', '16x9'),
                    fonts=fonts, mark=mark, kicker=spec.get('kicker'),
                    proof=v.get('proof'), ring=v.get('ring', False),
                    card_ar=spec.get('card_ar', 1.6))
        p = out / f"thumb-{v['id']}.jpg"
        for q in (92, 88, 84, 80, 74):
            im.save(p, 'JPEG', quality=q, optimize=True, subsampling=1)
            if p.stat().st_size <= T.JPEG_MAX:
                break
        print(f"  {spec.get('aspect', '16x9')} {v['id']}  {im.width}x{im.height}"
              f"  {p.stat().st_size // 1024} KB  {v['text']}")


if __name__ == '__main__':
    main()
