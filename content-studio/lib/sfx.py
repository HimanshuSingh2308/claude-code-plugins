#!/usr/bin/env python3
"""Synthesise the motion-graphics sound effects from a cue list.

THIS IS THE CHANNEL'S CUE LIBRARY AND IT IS LOCKED, same as the voice and the type.
Every video renders its effects from here so that a whoosh, a tick and a count-up
sound like the same channel from one cut to the next. Add cue types when a new kind
of motion appears; do not re-tune the existing ones per video, and do not swap in
sampled effects - these are synthesised so they render identically on any machine
with no asset library to keep in sync.

Called by the picture, not by hand: the render script writes a cues.json while it
lays out its timeline, then runs

    python3 <plugin>/lib/sfx.py cues.json sfx.wav <durationSec>

and mixes the result in as a fourth source under VO, game audio and music.

WHY A CUE LIST AND NOT HAND-PLACED SOUNDS
Every sound here has to land on a frame where something visibly happens, and the
frames are decided by launch_video.py's own timeline - scene starts, montage cut
points, the chip pops, the CTA. So the picture emits the cue list while it lays
itself out, and this renders against those numbers. Placing effects by ear
afterwards means every timeline edit silently desyncs the audio, and 40ms of slip
is enough to turn a hit into a mistake.

WHAT MAKES GRAPHICS FEEL IMMERSIVE RATHER THAN NOISY
Each moving element gets ONE sound with a job:
  whoosh   air moving with a transition, pitch following the direction of travel
  tick     the montage cut itself - a short bright transient, the "edit" you hear
  pop      something arriving on screen (a chip, a card)
  sparkle  small high detail so pops do not all sound identical
  impact   weight landing: the closing card, the big number
  riser    tension into a cut, and the only long sound in the set
  sub      a low drop under a scene change, felt more than heard on a phone
  key      a keystroke in the cold open's address bar
  glass    a fingertip on a screen, or the Go key being hit
  ratchet  the count-up: cog teeth, decelerating with the digits
  loader   a progress bar filling, optionally with a launch rumble under it
The restraint is the point: a sound on every element at once is mush, so type
that merely fades gets nothing at all.

WHY SOME MAKERS TAKE ARGUMENTS
`ratchet` and `loader` are the only sounds whose SHAPE is dictated by the
picture - a click per digit and a whir that has to finish exactly when the bar
does. Duplicating those numbers here would mean two places to edit and one of
them silently wrong, so the cue carries them: {"type": "ratchet", "args": {...}}.

Usage: python3 sfx.py <cues.json> <out.wav> <durationSec>
"""
import json
import sys
import wave

import numpy as np

SR = 44100
MASTER = 0.5        # sits under the VO and above the bed; the mux limiter catches peaks

rng = np.random.default_rng(6813)   # seeded so the effects render identically


def t_axis(n):
    return np.arange(n, dtype=np.float64) / SR


def env(n, attack, decay, power=1.0):
    t = t_axis(n)
    e = np.exp(-np.maximum(0.0, t - attack) / decay) ** power
    if attack > 0:
        e = np.where(t < attack, t / attack, e)
    return e


def lp(x, cutoff):
    """One-pole low-pass. Explicit loop: these are all short buffers."""
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    prev = 0.0
    for i, s in enumerate(x):
        prev = s * (1 - a) + prev * a
        y[i] = prev
    return y


def hp(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    pi_ = po = 0.0
    for i, s in enumerate(x):
        po = a * (po + s - pi_)
        pi_ = s
        y[i] = po
    return y


def whoosh(up=True, dur=0.40):
    """Filtered noise with a moving cutoff. The sweep direction is what reads as
    a direction of travel, so a card entering and a card leaving are not the same
    sound played twice."""
    n = int(dur * SR)
    x = rng.normal(0, 1, n)
    k = t_axis(n) / dur
    # Sweeping a one-pole per-sample would mean a python loop over the buffer, so
    # crossfade between two fixed filterings instead - indistinguishable here and
    # an order of magnitude faster.
    lo, hi = lp(x, 700.0), lp(hp(x, 1800.0), 8000.0)
    mix = k if up else (1.0 - k)
    return (lo * (1 - mix) + hi * mix) * env(n, 0.06, 0.13) * 0.9


def tick(bright=1.0):
    """The cut. A tiny noise transient plus a high blip - short enough that at one
    per half-second it reads as rhythm and not as clicking."""
    n = int(0.09 * SR)
    t = t_axis(n)
    body = np.sin(2 * np.pi * (2600 * bright) * t) * env(n, 0.0006, 0.010)
    air = hp(rng.normal(0, 1, n), 4500.0) * env(n, 0.0004, 0.018)
    return (body * 0.5 + air * 0.6) * 0.55


def pop(f=760.0):
    """Something arrives: a short upward pitch bend, which is the sound shape ears
    read as an object appearing rather than being struck."""
    n = int(0.16 * SR)
    t = t_axis(n)
    freq = f * (1.0 + 0.8 * np.exp(-t / 0.020))
    ph = 2 * np.pi * np.cumsum(freq) / SR
    return (np.sin(ph) + 0.3 * np.sin(2 * ph)) * env(n, 0.002, 0.038) * 0.5


def sparkle():
    """High shimmer, three random partials. Detail, not information."""
    n = int(0.30 * SR)
    t = t_axis(n)
    out = np.zeros(n)
    for f in rng.uniform(4200, 9000, 3):
        out += np.sin(2 * np.pi * f * t) * env(n, 0.004, rng.uniform(0.05, 0.14))
    return out * 0.10


def impact(level=1.0):
    """Weight landing: a sub thump, a body, and a short bright crack on top."""
    n = int(0.9 * SR)
    t = t_axis(n)
    sub = np.sin(2 * np.pi * (38 + 70 * np.exp(-t / 0.035)) * t) * env(n, 0.002, 0.14)
    body = lp(rng.normal(0, 1, n), 1400.0) * env(n, 0.001, 0.10)
    crack = hp(rng.normal(0, 1, n), 3000.0) * env(n, 0.0005, 0.05)
    return (sub * 1.0 + body * 0.5 + crack * 0.35) * 0.85 * level


def riser(dur=1.2):
    """Tension into a cut. Noise and a sweeping tone rising together, ending hard
    at the cue's end so whatever lands next lands into silence."""
    n = int(dur * SR)
    t = t_axis(n)
    k = t / dur
    tone = np.sin(2 * np.pi * (300 + 2400 * k ** 2.4) * t)
    noise = hp(rng.normal(0, 1, n), 1200.0)
    out = (tone * 0.45 + noise * 0.55) * (k ** 2.2) * 0.55
    out[-int(0.012 * SR):] *= np.linspace(1, 0, int(0.012 * SR))
    return out


def sub(dur=0.7):
    """Felt, not heard: a low sine dropping in pitch under a scene change. On a
    phone speaker this mostly disappears, which is fine - it is there for the
    half of viewers wearing headphones."""
    n = int(dur * SR)
    t = t_axis(n)
    f = 90.0 * np.exp(-t / 0.30) + 34.0
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.006, 0.22) * 0.8


def key():
    """A keystroke. Duller and quieter than `tick`: a key is a small object being
    damped by a finger, so the transient has a body under it and almost no air.
    Typing eighteen characters means several of these in under a second, and a
    bright click at that rate reads as a fault rather than as typing."""
    n = int(0.05 * SR)
    t = t_axis(n)
    body = np.sin(2 * np.pi * 1250 * t) * env(n, 0.0004, 0.006)
    thud = lp(rng.normal(0, 1, n), 900.0) * env(n, 0.0006, 0.012)
    return (body * 0.35 + thud * 0.8) * 0.32


def glass():
    """A fingertip landing on a screen. A glass surface rings briefly and high
    with no low end at all - the absence of body is what stops it sounding like a
    knock on wood."""
    n = int(0.22 * SR)
    t = t_axis(n)
    out = np.zeros(n)
    for f, a, d in ((2850.0, 1.00, 0.030), (4400.0, 0.55, 0.020),
                    (6900.0, 0.30, 0.013)):
        out += np.sin(2 * np.pi * f * t) * env(n, 0.0008, d) * a
    tap = hp(rng.normal(0, 1, n), 2200.0) * env(n, 0.0005, 0.008)
    return (out * 0.30 + tap * 0.5) * 0.42


def ratchet(steps=24, dur=0.55, ease=3.0):
    """The count-up: one cog tooth per digit, on the digits' own easing curve.

    The number is animated with a cubic ease-out, so the value changes very fast
    at first and crawls at the end. Clicking on that curve is what makes this a
    mechanism spinning down rather than a click track: the front of it is dense
    enough to fuse into a whir, and it separates into discrete teeth exactly as
    the digits do. `ease` must match launch_video.ease_out's exponent.

    Each tooth gets louder as the teeth separate, which is the same reason a real
    ratchet gets more articulate as it slows - and it means the LAST tick, the one
    that lands on the final number, is the one you actually hear.
    """
    n = int((dur + 0.22) * SR)
    out = np.zeros(n)
    for m in range(1, steps + 1):
        # Invert value = steps * (1 - (1-p)**ease) at the half-step, which is where
        # the rounded digit actually flips.
        frac = min(1.0, (m - 0.5) / steps)
        p = 1.0 - (1.0 - frac) ** (1.0 / ease)
        at = p * dur
        k = m / steps                      # 0 at the buzz, 1 at the last tooth
        ln = int(0.06 * SR)
        tt = t_axis(ln)
        tooth = (np.sin(2 * np.pi * (1500 + 900 * k) * tt)
                 * env(ln, 0.0003, 0.004 + 0.004 * k))
        edge = hp(rng.normal(0, 1, ln), 2600.0) * env(ln, 0.0003, 0.005)
        sig = (tooth * 0.5 + edge * 0.45) * (0.22 + 0.78 * k ** 1.6)
        i0 = int(at * SR)
        out[i0:i0 + ln] += sig[:n - i0]
    # A little mechanism noise under the teeth so the gaps are not dead silent,
    # gated to the run itself.
    hum_n = int(dur * SR)
    hum_k = t_axis(hum_n) / dur
    hum = lp(hp(rng.normal(0, 1, hum_n), 260.0), 2200.0) * (1.0 - hum_k) ** 1.4
    out[:hum_n] += hum * 0.10
    return out * 0.5


def loader(dur=1.45, rumble=0.0):
    """A progress bar filling. Rising, but deliberately NOT a riser: the top of
    the sweep is around 900Hz rather than 2700, so it sits under the voice instead
    of screaming over it, and a tremolo that speeds up is what reads as a machine
    working rather than as tension.

    `rumble` adds low broadband thrust, which is what turns the same gesture into
    a launch. It is a parameter and not a second maker because the two sounds are
    the same mechanism at different weights, and the cue that wants a launch is
    the one where the picture is filling a bar toward a claim about every week.
    """
    n = int(dur * SR)
    t = t_axis(n)
    k = t / dur
    sweep = np.sin(2 * np.pi * (240 + 660 * k ** 1.5) * t) * 0.34
    # Tremolo 8Hz -> 15Hz. Integrated phase, so the rate ramps smoothly instead of
    # stepping at the buffer's midpoint.
    trem = 0.62 + 0.38 * np.sin(2 * np.pi * np.cumsum(8.0 + 7.0 * k) / SR)
    whir = lp(hp(rng.normal(0, 1, n), 700.0), 3400.0) * trem * 0.30
    low = lp(rng.normal(0, 1, n), 150.0) * rumble * 1.2
    thrust = np.sin(2 * np.pi * 52 * t) * rumble * 0.22
    out = (sweep + whir + low + thrust) * (0.25 + 0.75 * k ** 1.3) * 0.5
    fo = int(0.05 * SR)
    out[-fo:] *= np.linspace(1, 0, fo)
    return out


MAKERS = {
    'whoosh_in': lambda: whoosh(up=True),
    'whoosh_out': lambda: whoosh(up=False),
    'whoosh_big': lambda: whoosh(up=True, dur=0.80),
    'tick': tick,
    'tick_hi': lambda: tick(bright=1.35),
    'pop': pop,
    'pop_hi': lambda: pop(1080.0),
    'sparkle': sparkle,
    'impact': impact,
    'impact_big': lambda: impact(1.35),
    'riser': riser,
    'riser_short': lambda: riser(0.55),
    'riser_long': lambda: riser(1.9),
    'sub': sub,
    'key': key,
    'glass': glass,
    'ratchet': ratchet,
    'loader': loader,
}


def render(cues, duration):
    n = int(duration * SR)
    buf = np.zeros(n + SR)          # slack so a cue near the end is not truncated
    unknown = sorted({c['type'] for c in cues} - set(MAKERS))
    if unknown:
        sys.exit(f'unknown cue types: {", ".join(unknown)}')
    for c in cues:
        # A riser has to END on its cue, not start there - it is anticipation, so
        # the whole point is that the hit lands where the riser stops.
        mk = MAKERS[c['type']]
        sig = (mk(**c['args']) if c.get('args') else mk()) * float(c.get('gain', 1.0))
        at = float(c['at'])
        i0 = int((at - len(sig) / SR) * SR) if c['type'].startswith('riser') else int(at * SR)
        if i0 < 0:
            sig, i0 = sig[-i0:], 0
        i1 = min(len(buf), i0 + len(sig))
        if i1 > i0:
            buf[i0:i1] += sig[:i1 - i0]
    out = buf[:n] * MASTER
    out = np.tanh(out * 1.3) / 1.3
    fo = int(0.05 * SR)
    out[-fo:] *= np.linspace(1, 0, fo)
    return (out * 32767).astype('<i2').tobytes(), float(np.max(np.abs(out)))


def main():
    cues = json.loads(open(sys.argv[1]).read())
    out_path = sys.argv[2]
    duration = float(sys.argv[3])
    pcm, peak = render(cues, duration)
    with wave.open(out_path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm)
    kinds = {}
    for c in cues:
        kinds[c['type']] = kinds.get(c['type'], 0) + 1
    print(f'wrote {out_path}: {duration:.2f}s, {len(cues)} cues, peak {peak:.3f}')
    print('  ' + ', '.join(f'{k} x{v}' for k, v in sorted(kinds.items())))


if __name__ == '__main__':
    main()
