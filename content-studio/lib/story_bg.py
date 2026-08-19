#!/usr/bin/env python3
"""Pull a full-bleed Story background out of a cut and take the cut's furniture off it.

A launch cut narrates with its own type, and a Story built full-bleed on one of its
frames sets your headline on top of the cut's headline. `avoid` in the thumbnail spec
keeps the frame scorer out of the narrated ranges, but it cannot help with furniture
that persists across every frame - a corner badge, a lower-third wordmark, the chip
naming the game on screen. Those have to come off the source.

Everything it does is measured and printed. Detection can be wrong, so it says what
it found and there are flags to override or skip each step.

  story_bg.py --video cut.mp4 --at 7.6 --out cast/story-bg-coins.png
  story_bg.py ... --no-patch-chip            # keep the chip
  story_bg.py ... --crop-top 0.14            # crop by hand instead
"""
import argparse
import subprocess
import sys
from pathlib import Path

from PIL import Image


def frame_at(video, t, tmp):
    subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t:.3f}', '-i', str(video),
                    '-frames:v', '1', '-y', str(tmp)], check=True)
    return Image.open(tmp).convert('RGB')


def badge_band(im, limit=0.20, step=4, thresh=8):
    """The lowest dense band of saturated type in the top `limit` of the frame.

    A badge is a horizontal run of rows carrying many strongly coloured pixels.
    Gameplay does not usually produce that near the top edge; a label does.
    """
    W, H = im.size
    runs, cur = [], None
    for y in range(int(H * limit)):
        n = 0
        for x in range(0, W, step):
            r, g, b = im.getpixel((x, y))
            mx, mn = max(r, g, b), min(r, g, b)
            if mx > 150 and mx - mn > 70:
                n += 1
        if n > thresh and cur is None:
            cur = y
        elif n <= thresh and cur is not None:
            runs.append((cur, y - 1))
            cur = None
    if cur is not None:
        runs.append((cur, int(H * limit)))
    runs = [r for r in runs if r[1] - r[0] >= 8]
    return runs[-1] if runs else None


def label_rows(im, step=3, thresh=6, pad=30):
    """Rows of near-white text in the lower half - the chip naming the game."""
    W, H = im.size
    ys = [y for y in range(H // 2, H)
          if sum(1 for x in range(int(W * 0.18), int(W * 0.84), step)
                 if min(im.getpixel((x, y))) > 190) > thresh]
    if not ys:
        return None
    return max(0, min(ys) - pad), min(H, max(ys) + pad)


def patch(im, y0, y1):
    """Cover a band by lifting a clean slab of the same field from above it.

    Only sane on a near-uniform background, which is what a game's play field
    usually is behind a chip. On a busy field this will look like what it is, so
    the caller gets told the rows and can look.
    """
    n = y1 - y0
    src_top = y0 - n - 40
    if src_top < 0:
        return False
    im.paste(im.crop((0, src_top, im.width, y0 - 40)), (0, y0))
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--video', required=True)
    ap.add_argument('--at', type=float, required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--crop-top', type=float, default=None,
                    help='fraction to cut off the top instead of detecting a badge')
    ap.add_argument('--no-crop-top', action='store_true')
    ap.add_argument('--no-patch-chip', action='store_true')
    a = ap.parse_args()

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.parent / f'.{out.stem}-raw.png'
    im = frame_at(a.video, a.at, tmp)
    W, H = im.size
    print(f'{a.video} at {a.at}s -> {W}x{H}')

    if a.crop_top is not None:
        cut = round(H * a.crop_top)
        print(f'  crop top {cut}px ({a.crop_top:.3f}) as asked')
        im = im.crop((0, cut, W, H))
    elif not a.no_crop_top:
        b = badge_band(im)
        if b:
            cut = min(b[1] + 12, int(H * 0.25))
            print(f'  badge rows {b[0]}-{b[1]} ({b[0]/H:.3f}-{b[1]/H:.3f}), '
                  f'cropping top {cut}px')
            im = im.crop((0, cut, W, H))
        else:
            print('  no badge band found, leaving the top alone')

    if not a.no_patch_chip:
        lb = label_rows(im)
        if lb:
            ok = patch(im, *lb)
            print(f'  chip rows {lb[0]}-{lb[1]}: '
                  f'{"patched from the field above" if ok else "too high to patch, left alone"}')
        else:
            print('  no chip label found')

    im.save(out)
    tmp.unlink(missing_ok=True)
    print(f'  wrote {out}  {im.size[0]}x{im.size[1]}')
    print('  look at it before using it - both detections can be wrong')


if __name__ == '__main__':
    main()
