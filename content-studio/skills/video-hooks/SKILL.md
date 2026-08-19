---
name: video-hooks
description: Hook and retention patterns for short-form gameplay video. Use when choosing a shot template, deciding what the first two seconds show, or diagnosing why a clip is not holding viewers.
---

# Hooks and retention for gameplay clips

Short-form is decided in the first two seconds and won or lost on whether the
clip resolves. Both halves are structural, not a matter of polish.

## The two-second rule

The opening frame must already show motion mid-action. A start menu, a title
card, a logo, or a board at rest is a scroll. This is why capture record windows
start *after* the game is underway rather than at page load: Duneburst's first
10 seconds are a static menu, and a record window that includes them wastes the
entire hook.

Practical test: pause on frame one. If you cannot tell something is happening,
the record window starts too early.

## Templates

| Template | Opens on | Holds with | Resolves with | Best for |
| --- | --- | --- | --- | --- |
| `satisfying` | mid-cascade, already resolving | escalating chain | the full clear, then stillness | reel |
| `near-miss` | board nearly lost | visible countdown or pressure | recovery from one move | reel, short |
| `challenge` | a score already on screen | narration of the attempt | beat-this framing | reel, short |
| `mechanic-reveal` | a non-obvious interaction | "wait, you can do that" | the interaction paying off | short |
| `compilation` | strongest single moment first | variety across games | best clip held for last | long |

Rotate templates per game. `shot-log.jsonl` exists so the same game does not ship
`satisfying` four times running - the footage differs, the shape does not, and the
shape is what the audience remembers.

## Retention structure

- **Loop the ending.** End on a frame close to the opening state so a replay
  feels continuous. Platforms count loops as watch time.
- **Leave ~800ms of silence after the payoff.** A clip that cuts on the last
  syllable feels truncated; the pause is what reads as a punchline landing.
- **Never explain before showing.** Setup narration is the most reliable way to
  lose the first three seconds.
- **One idea per clip.** Two mechanics in 15 seconds means neither lands.

## Choosing the payoff beat

Every capture config marks beats with `[demo]`. The payoff is whichever mark
produces the largest visible state change, and it should land between 55% and 80%
of the way through the clip: earlier leaves dead air after it, later gives no
room to react.

For Duneburst that mark is `span` - the multi-row clear with its score callout.
The `draft opens` mark is a secondary beat and not a payoff on its own.

## Overlay text

- **Hook overlay** top-centre, first ~1500ms, in place of a spoken line. Restates
  the constraint the viewer is looking at: "no clears yet", "3 moves left".
- **Stat overlay** centre, punched in on the payoff mark. The number the game
  just produced, nothing else: "+29,849".
- Never put the game name in an overlay before the payoff. The caption carries it.

## Diagnosing a clip that is not working

| Symptom | Likely cause |
| --- | --- |
| Drop in first 2s | Opens on a menu or a still board; record window too early |
| Drop mid-clip | Setup narration, or payoff lands past 80% |
| Watched but no engagement | No resolution, or payoff not visually legible at phone size |
| Reads as an ad | VO subject is the game rather than the screen. See `vo-scripting`. |
