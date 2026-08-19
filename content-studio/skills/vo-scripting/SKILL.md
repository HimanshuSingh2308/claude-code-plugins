---
name: vo-scripting
description: Write voiceover for short-form gameplay video that reads as commentary rather than advertising. Use when scripting VO lines for a game clip, writing hooks for reels or shorts, or reviewing a script that sounds like marketing copy.
---

# VO scripting for gameplay clips

The failure mode is not a bad script, it is a script that sounds like an ad. A
viewer decides in under two seconds, and "check out this amazing puzzle game"
loses them in one. Everything below exists to avoid that.

## Hard rules

1. **The first 1200-1500ms is wordless.** Gameplay hooks before any voice does.
   Set the first line's `atMs` no earlier than 1200, or pin it to a beat that
   lands after that point.
2. **Never name the game in the first line.** The clip earns the name; if the
   footage is good, the caption and profile carry it.
3. **Banned openers:** "check out", "introducing", "have you ever", "this game
   lets you", "look at this". Also ban any sentence whose subject is the game
   rather than what is happening on screen.
4. **One idea per line, under 12 words.** Lines become 2-3 word caption groups,
   so a long line produces a wall of text nobody reads.
5. **React to what is visible.** If a line would still make sense over different
   footage, it is copy, not commentary. Cut it.
6. **No feature lists.** "Six colours, daily challenges and a leaderboard" is a
   store description. One mechanic, shown, is worth all three.
7. **Mark exactly one accent word per line** with `*asterisks*`. It gets the
   accent colour in captions. Two accents per line means neither reads.

## Structure that works

| Beat | Timing | Job |
| --- | --- | --- |
| Cold open | 0 to ~1400ms | Pure gameplay, mid-action. No voice, no title. |
| Tension | first line | Name the problem on screen, not the game. |
| Escalation | middle | Raise the stakes. Shortest lines here. |
| Payoff | pinned to the beat | Land on the actual moment via `atMark`. |
| Rest | after payoff | Silence. Let the result sit for ~800ms. |
| Turn | last line | A reason to replay or to try it, in one clause. |

## Pinning to gameplay

Do not guess payoff timing. The capture harness prints a `[demo] <ms>ms <label>`
line for every marked beat, and `shoot.mjs` resolves `atMark` against those
labels, so:

```json
{ "text": "And then the whole *column* goes.", "atMark": "span", "leadMs": -400 }
```

A negative `leadMs` starts the line slightly before the beat so the voice is
mid-sentence when the payoff hits. That is the single highest-leverage detail in
the whole script: a reaction that arrives after the moment reads as narration.

## Openers with a track record

- State the constraint: "Nothing has cleared in four rows."
- Bet against the player: "There is no way this comes back."
- Count: "Three moves left and the board is full."
- Name the risk: "One wrong colour here and the run is over."

## Length targets

| Format | Total VO | Lines |
| --- | --- | --- |
| Reel (IG) | 8-16s | 3-5 |
| Short (YT) | 10-25s | 4-7 |
| Long compilation | per segment, 6-10s | 2-3 per clip |

Keep total VO shorter than the plate. A clip that ends the instant the last word
lands has no room to breathe, and on a loop-friendly platform the last 500ms of
silence is what makes the loop feel intentional.

## The channel voice is locked

**Kokoro-82M `af_heart`, via `lib/vo-kokoro.py`, on every video.** Not because it
is the best voice in the abstract - because a channel whose narrator changes
between uploads has no narrator. Do not re-audition it per video, and do not
switch a single shot to another provider for variety. `tts.mjs` defaults to it;
passing no `voice` is the correct call.

What chose it, so nobody has to relitigate it: pitch standard deviation of 5.76
semitones across the launch cut, against a 4.61-5.00 ceiling for every Piper
voice in `~/voices` measured on the same script. Piper's flatness is not a style
choice that reads as deadpan - at 4.6 semitones a listener hears a machine, and
the first cut of the launch video was rejected twice for exactly that.

Piper (`en_US-ryan-high`) and ElevenLabs are still wired up in `tts.mjs` behind
`CONTENT_TTS_PROVIDER`. They exist for a machine with no model installed, not as
a creative option.

### Delivery is per line, by role

`lib/vo-kokoro.py` shapes every line by the `role` named in the script. This is
where the voice stops sounding like one setting applied to six sentences.

| role | speed | pitch | sentence gap | what it is for |
| --- | --- | --- | --- | --- |
| `hook` | 1.06 | -0.6 | 0.12 | the claim, usually the line with the number in it |
| `neutral` | 0.94 | 0.0 | 0.16 | setup, and the default for anything informational |
| `jab` | 1.14 | -0.2 | 0.26 | fast and flat, long gap so a two-word sentence lands alone |
| `warm` | 1.06 | +0.4 | 0.16 | the promise - the one warm line in the cut |
| `staccato` | 1.24 | +0.2 | 0.13 | several short claims in one slot ("No ads. No downloads.") |
| `cta` | 0.94 | +0.5 | 0.18 | slowest and highest. An address has to land on one pass |

Name the role on every line. Unnamed lines fall back to the launch cut's own
order (hook, neutral, jab, warm, staccato, cta) and then to `neutral`, which is
a safety net, not a plan.

A claim read fast sounds like a disclaimer, which is why `hook` is slower than
the lines around it and `cta` is slower still. Pitch shifts stay well under a
semitone: the shift is a plain resample, so anything larger audibly changes the
speaker's size.

### Techniques that are part of the voice, not options

Every one of these is already in `vo-kokoro.py` and applies to every line:

- **Per-sentence synthesis.** A line is split on sentence boundaries, each
  sentence synthesised separately, and the pieces joined with the role's own gap.
  This is the single biggest win in the file: the launch cut's second line went
  from 2.70 to 4.52 semitones of pitch variation on this change alone, because a
  synthesizer resets its intonation contour at the start of each utterance and
  flattens it across a long one.
- **`default_rng(415)`.** The dither, the pitch drift and the room are all seeded,
  so a re-render of an unchanged script is bit-identical and re-rendering one line
  does not change the others.
- **8-cent, 0.7Hz pitch drift.** Below the threshold of hearing a pitch change,
  above the threshold of hearing a machine hold a note.
- **Ducked room.** 16% wet, and the reverb is side-chained off the dry voice at
  0.92 so the tail only rises in the gaps. An undicked room on a voice this close
  reads as a bathroom.
- **De-ess, then the bus:** highpass 85, -2.5dB at 240 (Kokoro's chest resonance),
  +3.5 at 3600 and +2.0 at 9000 for presence, `acompressor`, `alimiter` at 0.93,
  `loudnorm I=-16`. The -16 here is deliberate: the render's master pass takes the
  whole mix to -14, and a VO already at -14 has nothing left to duck with.

Do not leave `*asterisks*` in text sent to a synthesizer; `tts.mjs` strips them,
but a script written for another tool should not rely on that.

### Setup

The model and the venv live outside every repo, because the model is 350MB and a
committed venv is a broken venv on the next machine:

```
python3 -m venv ~/.local/share/content-studio/ttsenv
~/.local/share/content-studio/ttsenv/bin/pip install kokoro-onnx numpy
# kokoro-v1.0.onnx + voices-v1.0.bin -> ~/.local/share/content-studio/kokoro/
```

`CONTENT_KOKORO_PYTHON` overrides the interpreter, `KOKORO_DIR` the model path.
`tts.mjs` batches the whole script through one process, so the model loads once
per video - roughly 8 seconds for three lines, most of it the load.
