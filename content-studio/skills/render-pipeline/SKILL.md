---
name: render-pipeline
description: Capture, caption and render gameplay video with the content-studio lib scripts. Use when shooting a clip, debugging a starved or mis-timed capture, tuning audio ducking, or adding a platform preset.
---

# Render pipeline

Four scripts in `lib/`, each usable standalone or through `shoot.mjs`:

| Script | Does | Standalone |
| --- | --- | --- |
| `tts.mjs` | One WAV per VO line, measured durations | `node lib/tts.mjs script.json out/vo [voice]` |
| `captions.mjs` | ASS pop captions + honest SRT | `node lib/captions.mjs vo.json outDir [platform] [overlays.json]` |
| `render.mjs` | ffmpeg master render | `node lib/render.mjs spec.json` |
| `shoot.mjs` | Capture, take selection, then all of the above | `node lib/shoot.mjs shot.json --repo <root> --out <dir>` |
| `review.mjs` | Local approval dashboard | `node lib/review.mjs <outRoot> [port]` |

## Capture must run against localhost

`--base` defaults to `http://localhost:4321` and it must stay that way.
Production serves a minified `game.js`, and every capture config patches the
source by exact string match, so against `https://weeklyarcade.games` all nine
Duneburst patches miss and the capture silently films a default board.

Start the dev server first:

```bash
cd <weekly-arcade> && npx nx dev web-astro   # serves unminified source on 4321
```

A `MISS` line in capture output is fatal, not a warning. `shoot.mjs` throws on
it, because the resulting clip looks plausible and shows nothing.

## Frame starvation is the failure to watch for

A CDP screencast delivers frames only as fast as the compositor produces them.
Under load it hands over a fraction of them and pads the file with duplicates, so
**ffprobe still reports 24fps** while the clip plays like a slideshow. This is
invisible in every container-level check.

`validatePlate()` runs the plate through `mpdecimate` and counts frames that
actually differ, then rejects anything under 12 unique fps. Observed values:

| Machine state | Unique fps | Usable |
| --- | --- | --- |
| Idle | 22-30 | yes |
| Moderate load | 12-20 | marginal |
| Load average ~64 on 12 cores | 0.4-2 | no |

If takes come back starved, the fix is the machine, not the config. Check
`sysctl -n hw.ncpu` against `uptime` load averages, and look for runaway
`Google Chrome Helper (GPU)` processes before re-shooting. A game whose sim
clock is driven by wall time also *slows down* under load, so beats drift far
from the tuned beat sheet - Duneburst's span mark moved from 2897ms to 28478ms,
a 10x stretch, on a saturated machine.

Orphaned Chrome from a failed run blocks later ones: `cdp.js` derives its debug
port from `process.uptime()`, which is near-zero at launch, so nearly every run
tries port 9333. Clear them with `pkill -f "demo-capture-"`.

## Take selection

`shoot.mjs` shoots several seeds and scores each on unique fps first, then on how
close the `preferMark` beat lands to `preferMarkAtMs`. It stops early once a take
is healthy and well timed. A take whose payoff mark never fired is scored down
hard rather than discarded, so a shot still renders if every take missed - but the
score in `shot.json` records that it did.

## Audio

Three sources, mixed in one graph:

- **VO**: each line delayed to its own `startMs`, mixed with `normalize=0` so
  levels do not drop as lines are added.
- **Game audio**: present when the capture used its Web Audio tap. Held at 0.85.
- **Music bed**: looped with `-stream_loop -1`, held at 0.30.

The bed is ducked under the VO with `sidechaincompress` keyed on the voice, not
set to a fixed level, so it stays present between lines. **The key must be padded
with `apad` to the full target duration** - `sidechaincompress` ends when its
shorter input does, so an unpadded key kills the music the moment the last line
finishes.

Master through `loudnorm=I=-14:TP=-1.5:LRA=11`. Both platforms normalise on
ingest, so delivering near -14 LUFS stops them pulling the mix down and taking
the voice with it. A bare limiter leaves AAC overshoot above 0dBFS.

## Platform presets

| Preset | Frame | Cap | Caption bottom margin |
| --- | --- | --- | --- |
| `reel` | 1080x1920 | 90s (IG API limit) | 480px |
| `short` | 1080x1920 | 180s | 360px |
| `long` | 1920x1080 | - | 120px |

Reels need the largest bottom margin: caption, handle and action buttons all sit
over the lower third. A 9:16 plate rendered to `long` gets a blurred, darkened,
over-scaled copy of itself as a background rather than pillarbox bars.

## Captions

ASS, burned in, rather than Remotion. It supports fades, moves and colour
transforms, ffmpeg burns it in one filter, and it adds no npm install and no
headless-browser pass to a scheduled job. Reach for Remotion only for overlays
that genuinely need layout or data-driven motion.

Word-group timing inside a line is estimated by character weight. That is safe
only because each line's own start and end are measured from its WAV, so error
cannot accumulate past the line it lives in. The `.srt` uses measured per-line
timings only, with no estimation, which is why it is the file to hand to YouTube
or Premiere.
