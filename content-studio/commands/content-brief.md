---
description: Build or refresh the cached game brief that shot planning reads from
argument-hint: <game> [--force]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task
---

# /content-brief

Produce `content/briefs/$1.json` - the cached understanding of a game that every
later stage reads instead of re-deriving.

## Invalidation

The brief stores `sourceHash`, the sha256 of the game's `game.js`. Before using a
brief, compare it against the file on disk:

```bash
shasum -a 256 apps/web-astro/public/games/$1/game.js
```

A hash mismatch means the brief is stale and must be rebuilt before the game is
shot again. This matters more than it sounds: capture configs patch game source by
exact string match, so a changed source file turns into missed patches and a clip
that films a default board while reporting success.

`--force` rebuilds regardless.

## Steps

1. **Read the source.** The game's `game.js`, its PRD under `docs/` if present,
   and its `GAME_REGISTRY` entry in `packages/shared`.
2. **Extract the gate and mute keys.** Every localStorage key the game reads to
   decide whether to show an intro, a tutorial or a mute state. These become the
   capture config's `localStorage` block; a missed gate key means the capture
   films an intro screen.
3. **Identify filmable moments.** Each needs an id, the beat it corresponds to,
   why it is worth filming, and a realistic duration. A filmable moment is a
   visible state change legible at phone size - a score ticking up is not one.
4. **Note the audio character** so music selection has something to work with.
5. **Run one throwaway capture** if a config exists, to confirm the gates and
   patches still hold and to collect the current `[demo]` beat sheet.
6. **Write the brief:**

```json
{
  "gameId": "duneburst",
  "sourceHash": "<sha256>",
  "mechanics": "...", "controls": "...", "scoring": "...",
  "gateKeys": { "gl_played_duneburst": "1", "duneburst-seen-intro": "1" },
  "unmuteKeys": { "duneburst-muted": "0", "duneburst-music": "1" },
  "filmableMoments": [
    { "id": "span", "beat": "multi-row clear", "why": "the payoff", "durationMs": 8000 }
  ],
  "hookAngles": ["satisfying", "near-miss", "challenge"],
  "audioCharacter": "granular, percussive",
  "beatSheet": [{ "atMs": 2897, "label": "span 4 x3568" }],
  "menuMs": 10400
}
```

`menuMs` is how long the game sits on a menu before play begins. Record windows
must start after it or the clip opens on a still screen and loses the viewer in
the first two seconds.

## Report

State what changed against the previous brief, and say explicitly whether the
existing capture config is still valid or needs re-tuning.
