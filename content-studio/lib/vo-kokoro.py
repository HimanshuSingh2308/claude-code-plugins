#!/usr/bin/env python3
"""Synthesise and de-robotise the voice-over.

WHY THIS REPLACES vo.sh
vo.sh drove Piper and measured every one of its six voices into a 4.61-5.00
semitone pitch-SD band no matter how --noise-w was swept. That is an engine
ceiling, so this moves to Kokoro-82M, which is a better model. But swapping the
model is NOT the fix on its own: auditioning twelve Kokoro voices on the script's
own opening line put most of them BELOW Piper's band (am_onyx 3.28, bm_george
3.37, am_michael 3.57) and only af_heart clearly above it at 5.76. A flat read is
mostly not the model's fault.

WHAT ACTUALLY MAKES SYNTHETIC SPEECH SOUND SYNTHETIC
Four things, none of which are the voice:

1. Every line is rendered with identical settings, so six lines arrive with one
   delivery. A person reads "Twenty four original games" slower and lower than
   "No clones. No filler." - the second is a jab. DELIVERY below gives each line
   its own rate and pitch, which is the single biggest change in here.

2. A multi-sentence line is rendered as one utterance, so the model spreads one
   contour across it and the internal full stop becomes a comma. "No clones. No
   filler." is two attacks or it is nothing. Sentences are therefore synthesised
   SEPARATELY and butted back together with a deliberate gap. Measured, this is
   worth more than the model choice was: line 2 went from 2.70 semitones as one
   utterance to 4.52 split, and it is why the punctuation in vo-script.json is
   load-bearing rather than cosmetic.

3. The pitch is metronomically stable. Human pitch wanders by several cents
   constantly, and its absence is a tell even when the timbre is convincing. So a
   slow random walk is applied by resampling against a warped time map.

4. It is recorded in a vacuum. Every real voice-over has a room around it, and
   dry TTS has none - no early reflections, no tail. But a plain room turned out
   to FLATTEN the voice measurably (see room()), so the reverb here is ducked by
   the dry signal and speaks only in the gaps between words.

Then the ordinary voice bus: de-ess, EQ, compress, limit, normalise. Those make
it sit in a mix; they do not make it human.

WHAT IS MEASURED, AND WHAT THAT DOES NOT TELL YOU
Every claim above is pitch SD in semitones, tracked by autocorrelation. It is a
good proxy for a flat contour, which is the largest single component of "robotic",
and it is the reason this file is not just a pile of plausible-sounding DSP - two
of the ideas in the first draft (rubberband, an unducked room) measured WORSE and
were replaced. But it cannot hear buzzy voicing, wrong emphasis, or a mangled
word, so the finished lines still have to be listened to before they ship.

THIS IS THE CHANNEL VOICE, AND af_heart IS LOCKED
Every Weekly Arcade video uses this file and this voice. Not because af_heart is
the best voice in the abstract - because a channel whose narrator changes between
uploads has no narrator. The measurements below are what chose it; they are not a
reason to re-audition it per video. Change it only to change the channel.

Writes vo/vo-NN.wav plus a vo.json manifest in the shape lib/tts.mjs produces, so
captions.mjs and render.mjs need no changes and neither does launch_video.py.

Usage:
  python3 vo-kokoro.py --script vo-script.json --out vo/
  python3 vo-kokoro.py --lines lines.json --out vo/    # [{text, role}], no pins
  python3 vo-kokoro.py --script s.json --out vo/ --voice am_liam
  python3 vo-kokoro.py --script s.json --out vo/ --compare

--script takes {"vo": [{text, atMs, role?}]} and honours the pins. --lines takes a
bare array with no timing at all and only reports measured durations, which is the
mode lib/tts.mjs drives: that keeps ONE model load per video while leaving the
cursor-and-pin arithmetic in the place that already owned it.

Setup, once per machine (both paths are durable on purpose - the model is 350MB
and the voice has to survive between sessions):
  python3 -m venv ~/.local/share/content-studio/ttsenv
  ~/.local/share/content-studio/ttsenv/bin/pip install kokoro-onnx numpy
  # kokoro-v1.0.onnx and voices-v1.0.bin into
  # ~/.local/share/content-studio/kokoro/
Run it with that venv's python, not the system one.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
# The model lives in a DURABLE per-user location, not beside this script and not in
# a temp directory. Two reasons: it is 350MB and has no business in a git repo, and
# this voice is the channel voice - every future video has to be able to find the
# same weights, so the default cannot be a path that gets cleaned up between
# sessions. KOKORO_DIR still overrides for a one-off.
MODEL_DIR = Path(os.environ.get(
    'KOKORO_DIR',
    Path.home() / '.local' / 'share' / 'content-studio' / 'kokoro'))
SR = 44100

# af_heart is the default because it measured 5.76 semitones of pitch movement
# against Piper's 4.82 - it is the one voice that clears the old ceiling by a
# margin rather than by noise. am_liam (4.95) is the nearest male alternative and
# bm_lewis (4.55) the nearest British one; --compare renders all three.
DEFAULT_VOICE = 'af_heart'
CANDIDATES = ['af_heart', 'am_liam', 'bm_lewis', 'am_michael']

# Delivery, BY ROLE. `speed` is Kokoro's own rate; `semis` is a pitch shift applied
# afterwards; `gap` is the silence inserted between sentences INSIDE a line. Keep
# `semis` well under a semitone - see shift_semis() for why the shift is a plain
# resample and what that costs above that range.
#
# Roles rather than line numbers, because the whole point of this table is that one
# script does not read in one voice, and the next video will not have six lines in
# this order. A script names the role it wants; unnamed lines fall back to
# DEFAULT_ORDER, which is the launch cut's own shape.
#
#   hook      the claim, usually the only line with a number in it - slower and a
#             touch lower, because a claim read fast sounds like a disclaimer
#   neutral   setup. The default for anything that is carrying information
#   jab       fast, flat-ish, long gap, so a two-word sentence lands alone
#   warm      the promise. Slightly slower and lifted - the one warm line
#   staccato  several short claims in one slot: quick, short gap
#   cta       slowest and highest. An address has to be understood on one pass
#
# The rates are also bounded by the CLOCK: atMs is locked to the music's beat grid,
# so a line has to finish before the next one starts, and line 0 has only 2200ms
# for two sentences. If a line overruns after an edit the run prints a WARNING -
# shorten the text or the gap, never move atMs.
#
# The exact rates were then SWEPT rather than reasoned about, because reasoning
# about them got it wrong: I set the hook slower on the theory that a slow read
# carries authority, and measured, slowing it from 1.04 to 1.00 cost the whole
# track 0.24 semitones. Kokoro's contour does not vary smoothly with rate - line 2
# measured 4.02 / 5.45 / 4.74 / 5.20 / 4.24 / 5.59 across 0.94 to 1.14 - so each
# line's rate is the widest-measuring one that still fits its budget. Five of the
# six agreed with the intended fast/slow shape anyway; only the hook did not, and
# its budget was pushing it faster regardless. Re-run scratchpad/sweep.py if the
# script text changes, since the sweet spots move with the words.
ROLES = {
    'hook':     {'speed': 1.06, 'semis': -0.6, 'gap': 0.12},
    'neutral':  {'speed': 0.94, 'semis': +0.0, 'gap': 0.16},
    'jab':      {'speed': 1.14, 'semis': -0.2, 'gap': 0.26},
    'warm':     {'speed': 1.06, 'semis': +0.4, 'gap': 0.16},
    # 1.24, not the 1.10 the other lines sit near: this line carries four claims
    # in a 2770ms slot pinned at both ends by the music, and a fourth claim does
    # not fit at a normal rate. Swept, and the rate is NOT free to go higher -
    # by 1.34 Kokoro stops inflecting at all (SD collapses to 2.2 from 4.7), so
    # this is the fastest read that still has a contour.
    'staccato': {'speed': 1.24, 'semis': +0.2, 'gap': 0.13},
    'cta':      {'speed': 0.94, 'semis': +0.5, 'gap': 0.18},
}
DEFAULT_ORDER = ['hook', 'neutral', 'jab', 'warm', 'staccato', 'cta']


def delivery_for(item, i):
    """The role a line asked for, or the launch cut's shape at that position."""
    role = (item.get('role') or '').strip().lower() if isinstance(item, dict) else ''
    if role in ROLES:
        return role, ROLES[role]
    role = DEFAULT_ORDER[i] if i < len(DEFAULT_ORDER) else 'neutral'
    return role, ROLES[role]

rng = np.random.default_rng(415)      # seeded: the drift must be reproducible


def split_sentences(text):
    """Break on sentence-final punctuation, keeping the punctuation.

    Kokoro needs the full stop to place the terminal fall, so it stays attached
    to the sentence it ends rather than being stripped as a delimiter.
    """
    # A run of dots is one boundary, not three. "No clones... no filler." would
    # otherwise split into "No clones.", ".", "." and a fragment, and the two bare
    # full stops synthesise as noise.
    text = re.sub(r'[.!?]{2,}|…', '.', text)
    out, cur = [], ''
    for ch in text:
        cur += ch
        if ch in '.!?':
            out.append(cur.strip())
            cur = ''
    if cur.strip():
        out.append(cur.strip())
    return [s for s in out if any(c.isalnum() for c in s)]


def resample(x, src_sr, dst_sr):
    if src_sr == dst_sr:
        return x
    n = int(round(len(x) * dst_sr / src_sr))
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x)


def pitch_drift(x, cents=8.0, hz=0.7):
    """Wander the pitch by a few cents on a slow random walk.

    Implemented as variable-rate resampling: a time map whose local slope is
    2**(c/1200) plays the audio slightly fast or slow, and playing audio fast
    raises its pitch. That couples pitch to duration, which is exactly what
    happens when a person's voice drifts - a syllable that rises also shortens.

    8 cents is under a tenth of a semitone. It is not meant to be heard as pitch
    movement; it is meant to stop the pitch being perfectly, detectably still.
    """
    n = len(x)
    steps = max(2, int(n / SR * hz * 4))
    walk = np.cumsum(rng.normal(0, 1, steps))
    walk = walk / (np.abs(walk).max() + 1e-9) * cents
    c = np.interp(np.linspace(0, steps - 1, n), np.arange(steps), walk)
    rate = 2.0 ** (c / 1200.0)
    tmap = np.cumsum(rate)
    tmap *= (n - 1) / tmap[-1]
    return np.interp(tmap, np.arange(n), x)


def deess(x, thresh=0.055, ratio=0.45):
    """Duck the 5-9kHz band when it runs hot, leaving the rest untouched.

    Synthetic sibilance is a giveaway: models over-produce /s/ because the band
    is cheap to fit and there is no real mouth damping it. A broadband compressor
    cannot fix that - it would pump the whole word. So the band is split out, its
    own envelope measured, and only the band is reduced.
    """
    hi = x - _one_pole(x, 5000.0)
    low = x - hi
    env = _one_pole(np.abs(hi), 60.0)
    gain = np.where(env > thresh, (thresh / np.maximum(env, 1e-9)) ** ratio, 1.0)
    gain = _one_pole(gain, 220.0)
    return low + hi * gain


def _one_pole(x, cutoff):
    a = float(np.exp(-2 * np.pi * cutoff / SR))
    y = np.empty_like(x, dtype=np.float64)
    prev = 0.0
    for i in range(len(x)):
        prev = x[i] * (1 - a) + prev * a
        y[i] = prev
    return y


def room(x, mix=0.16, duck=0.92):
    """A small room whose reverb is DUCKED by the dry signal.

    A plain room at even 7% wet cost 1.4 semitones of measured pitch movement,
    and gating the measurement to frames where the dry signal is loud did NOT
    recover it - so this is not a measurement artifact, the reverb really does
    flatten the voice. The mechanism: each tail overlaps the syllable AFTER it, so
    the pitch tracker at that syllable sees the sum of two pitches and lands
    between them. Reverb on speech is a contour smoother.

    The fix is not less reverb, it is reverb in the gaps only. The wet path is
    attenuated in proportion to the dry envelope, so while a word is being spoken
    there is almost no reverb over it, and between words the tail blooms. The ear
    still gets its early reflections and its tail - which is the entire cue that
    says this was recorded somewhere rather than generated - and the contour the
    tracker measures is left alone. `mix` can then be set HIGHER than an unducked
    room would allow, because it is only audible where nothing else is.

    Taps at 11/17/29/43ms read as a wall, a ceiling and a desk. The tail is short
    (180ms) and dark on purpose: a voice-over booth is small, and a long bright
    tail would sound like a church.
    """
    n = len(x)
    pad = int(0.30 * SR)
    wet = np.zeros(n + pad)
    for delay_ms, level in ((11, 0.34), (17, 0.26), (29, 0.20), (43, 0.13)):
        d = int(delay_ms / 1000 * SR)
        wet[d:d + n] += x * level
    tail_n = int(0.18 * SR)
    ir = rng.normal(0, 1, tail_n) * np.exp(-np.linspace(0, 5.5, tail_n))
    ir = _one_pole(ir, 2600.0)                     # dark: no fizzy tail
    ir /= np.abs(ir).max() + 1e-9
    tail = np.convolve(x, ir)[:len(wet)] * 0.5
    wet[:len(tail)] += tail

    # The duck. A fast-attack, slow-release envelope of the dry signal, so the
    # reverb is pushed down the instant a word starts and comes back gradually
    # once it stops - the release is what stops the room flickering on and off
    # between syllables.
    env = np.zeros(len(wet))
    env[:n] = np.abs(x)
    env = _one_pole(env, 12.0)
    env /= env.max() + 1e-9
    wet *= 1.0 - duck * np.clip(env * 3.0, 0, 1)

    out = np.zeros(len(wet))
    out[:n] = x
    return out + wet * mix


def shift_semis(x, semis):
    """Per-line pitch shift by constant-rate resampling.

    This started out as rubberband -F, on the reasoning that a formant-preserving
    shift keeps the voice sounding like the same person. Measured, rubberband cost
    0.4-0.9 semitones of pitch movement at every shift tried, because a phase
    vocoder reconstructs the signal from smoothed frame estimates - it smooths the
    contour along with everything else. A constant-rate resample cannot: it
    multiplies every f0 by one factor, so the contour is unchanged in the log
    domain by construction, and it measured 5.71 against rubberband's 4.84 on the
    same +0.5 semitone move.

    The formants shift too, which is exactly what rubberband existed to prevent -
    but every shift in DELIVERY is under a semitone, i.e. under 6% , which is
    inside the range a person's own formants move between a relaxed and an
    emphatic reading. It also couples pitch to duration, so a lifted line comes
    out slightly shorter, which is what happens when someone lifts their voice.
    """
    if abs(semis) < 0.05:
        return x
    r = 2.0 ** (semis / 12.0)
    n = int(len(x) / r)
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x)


def write_wav(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm)


def read_wav(path):
    with wave.open(str(path)) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2')
        if w.getnchannels() == 2:
            a = a.reshape(-1, 2).mean(axis=1)
        return resample(a.astype(np.float64) / 32768.0, w.getframerate(), SR)


def bus(path_in, path_out):
    """The ordinary voice bus, in the order it would be patched on a real desk."""
    subprocess.run([
        'ffmpeg', '-y', '-v', 'error', '-i', str(path_in),
        '-af', ('highpass=f=85,'
                'equalizer=f=240:t=q:w=1.0:g=-2.5,'      # unbox the low mids
                'equalizer=f=3600:t=q:w=1.4:g=3.5,'      # presence, to cut over music
                'equalizer=f=9000:t=q:w=1.2:g=2.0,'      # air
                'acompressor=threshold=-20dB:ratio=3:attack=5:release=140:makeup=2,'
                'alimiter=limit=0.93,'
                'loudnorm=I=-16:TP=-1.5:LRA=9'),
        '-ar', str(SR), '-ac', '1', str(path_out),
    ], check=True)


def trim_tail(x, floor=0.0012, fade_ms=45.0):
    """Cut the inaudible end of the reverb tail, with a fade so it cannot click.

    room() pads by a fixed 300ms to leave the tail somewhere to go, and on a short
    line most of that is silence the pad guessed at rather than tail. That silence
    is not free: it counts toward the line's duration, and the atMs values are
    locked to the beat grid, so 60ms of nothing at the end of line 0 was enough to
    make it collide with line 1. Trimming here is the right place to fix that -
    the alternative was speeding the read up further, which would be paying for
    padding with delivery.

    The fade matters. Truncating a decaying tail at a non-zero sample is a step
    discontinuity, i.e. a click, and a click is far more audible than the 40dB-down
    tail being removed.
    """
    below = np.abs(x) > floor
    if not below.any():
        return x
    end = int(np.where(below)[0][-1]) + 1
    n = int(fade_ms / 1000 * SR)
    y = x[:min(len(x), end + n)].copy()
    if len(y) > n:
        y[-n:] *= np.linspace(1.0, 0.0, n)
    return y


def synth_line(kokoro, text, voice, d):
    """One script line: sentence by sentence, then treated as a whole."""
    parts = []
    for s in split_sentences(text):
        a, sr = kokoro.create(s, voice=voice, speed=d['speed'], lang='en-us')
        a = resample(np.asarray(a, dtype=np.float64), sr, SR)
        # Trim the model's own leading/trailing silence before adding our gap, or
        # the gap lands on top of whatever padding it chose and the rhythm drifts.
        nz = np.where(np.abs(a) > 0.004)[0]
        if len(nz):
            a = a[max(0, nz[0] - int(0.01 * SR)):nz[-1] + int(0.03 * SR)]
        parts.append(a)
    gap = np.zeros(int(d['gap'] * SR))
    x = parts[0]
    for p in parts[1:]:
        x = np.concatenate([x, gap, p])
    x = pitch_drift(x)
    x = shift_semis(x, d['semis'])
    x = deess(x)
    x = room(x)
    x = trim_tail(x)
    peak = float(np.abs(x).max())
    return x / peak * 0.89 if peak > 0 else x


def build(voice, out_dir, items, gap_ms=220):
    """Synthesise every line, measure it, and place it.

    A line with `atMs` is PINNED there because it has to land on a musical beat or
    a gameplay mark; a line without one falls in after its predecessor plus
    `gap_ms`. A pin that would land before the previous line has finished is pushed
    rather than allowed to overlap, and the push is reported - silently overlapping
    two lines of the same voice is the one failure nobody notices until the whole
    render is watched.
    """
    sys.path.insert(0, '')
    from kokoro_onnx import Kokoro
    kokoro = Kokoro(str(MODEL_DIR / 'kokoro-v1.0.onnx'),
                    str(MODEL_DIR / 'voices-v1.0.bin'))
    out_dir.mkdir(parents=True, exist_ok=True)
    lines, cursor, pushed = [], 0, 0
    for i, item in enumerate(items):
        role, d = delivery_for(item, i)
        # The caller may own the numbering: lib/tts.mjs names files by the line's
        # position in the ORIGINAL script, which is not the same as its position in
        # this list once blank lines have been dropped.
        idx = item['index'] if isinstance(item.get('index'), int) else i
        raw = out_dir / f'raw-{idx:02d}.wav'
        fin = out_dir / f'vo-{idx:02d}.wav'
        write_wav(raw, synth_line(kokoro, item['text'], voice, d))
        bus(raw, fin)
        raw.unlink(missing_ok=True)
        with wave.open(str(fin)) as w:
            ms = round(w.getnframes() / w.getframerate() * 1000)
        wanted = item['atMs'] if isinstance(item.get('atMs'), int) else cursor
        start = max(wanted, cursor)
        if start > wanted:
            pushed += 1
        lines.append({'index': idx, 'text': item['text'], 'role': role,
                      'wav': f'{out_dir.name}/vo-{idx:02d}.wav',
                      'startMs': start, 'durationMs': ms, 'endMs': start + ms})
        cursor = start + ms + gap_ms
        print(f"  {idx}  {start:>6}ms +{ms:>5}ms  {role:<8} speed {d['speed']:.2f} "
              f"pitch {d['semis']:+.1f}  {item['text']}")
    manifest = {'provider': 'kokoro-82m', 'voice': voice, 'processed': True,
                'gapMs': gap_ms, 'pinsPushed': pushed,
                'techniques': ['per-role rate and pitch', 'per-sentence synthesis',
                               'pitch drift 8c', 'de-ess', 'ducked room',
                               'presence EQ', 'compress', 'limit', 'loudnorm'],
                'lines': lines,
                'totalMs': max((l['endMs'] for l in lines), default=0)}
    (out_dir / 'vo.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return lines


def overrun(lines):
    """Warn where a line runs into the next one's start.

    The timings are locked to the music's beat grid, so a line that overruns is
    not a small problem - it collides with the next scene's own line. Kokoro's
    pacing differs from Piper's, so this has to be checked rather than assumed.
    """
    bad = []
    for a, b in zip(lines, lines[1:]):
        if a['endMs'] > b['startMs']:
            bad.append((a['index'], a['endMs'] - b['startMs']))
    return bad


def main():
    ap = argparse.ArgumentParser()
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument('--script', help='{"vo": [{text, atMs, role}]} - honours pins')
    src.add_argument('--lines', help='[{text, role}] - durations only, no pins')
    ap.add_argument('--out', required=True, help='output directory')
    ap.add_argument('--voice', default=DEFAULT_VOICE)
    ap.add_argument('--gap-ms', type=int, default=220,
                    help='silence after an unpinned line (default 220)')
    ap.add_argument('--compare', action='store_true',
                    help='render every candidate to <out>/ab/<voice>/ for an A/B')
    args = ap.parse_args()

    raw = json.loads(Path(args.script or args.lines).read_text())
    items = raw['vo'] if isinstance(raw, dict) else raw
    items = [{'text': x} if isinstance(x, str) else dict(x) for x in items]
    if args.lines:
        # --lines is the tts.mjs path and it owns the timing itself, so any atMs
        # that came along in the file is deliberately ignored here rather than
        # half-honoured.
        for it in items:
            it.pop('atMs', None)

    if not (MODEL_DIR / 'kokoro-v1.0.onnx').exists():
        sys.exit(f'Kokoro model not found in {MODEL_DIR}. See the setup notes at '
                 'the top of this file, or set KOKORO_DIR.')

    base = Path(args.out)
    for v in (CANDIDATES if args.compare else [args.voice]):
        out = (base / 'ab' / v) if args.compare else base
        print(f'\n=== {v}')
        lines = build(v, out, items, gap_ms=args.gap_ms)
        for idx, ms in overrun(lines):
            print(f'  WARNING line {idx} overruns the next start by {ms}ms')
        total = max(l['endMs'] for l in lines)
        print(f'  total {total}ms, {len(lines)} lines -> {out}')


if __name__ == '__main__':
    main()
