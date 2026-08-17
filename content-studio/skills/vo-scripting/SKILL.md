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

## Voice selection

Piper voices in `~/voices`. `en_US-ryan-high` is the default: dry and
unenthusiastic, which suits commentary and is the opposite of ad-read energy.
`en_US-amy-medium` and `en_GB-cori-high` are the alternates worth trying. If a
line only works with real inflection, that is the signal to swap the provider to
ElevenLabs for that shot, not to rewrite the line flat.

Do not leave `*asterisks*` in text sent to a synthesizer; `tts.mjs` strips them,
but a script written for another tool should not rely on that.
