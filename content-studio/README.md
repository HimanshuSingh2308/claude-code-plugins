# content-studio

Turns a browser game into short-form and long-form video: deterministic gameplay
capture, per-line TTS voiceover, burned-in pop captions, an ffmpeg render, and a
local approval gate before anything reaches Instagram or YouTube.

Built for Weekly Arcade, but the engine is game-agnostic - it needs a capture
config and a game brief, both of which live in the game's own repo.

## Status

| Phase | State |
| --- | --- |
| 1. One clip end to end | `lib/` built and verified. One genuinely good Duneburst clip still pending, blocked on machine load. |
| 2. Publish (YT private draft, IG live) | not built |
| 3. More capture configs | not built - only `duneburst` has one |
| 4. Schedule, compilations, feedback | not built |

See `DESIGN.md` for the full spec, the locked decisions, and the list of things
implementation proved wrong about the original plan.

## Requirements

- Node 22+ and ffmpeg 7+ on PATH
- [Piper](https://github.com/rhasspy/piper) with voices in `~/voices`, or
  `CONTENT_TTS_PROVIDER=elevenlabs` with `ELEVENLABS_API_KEY`
- The game repo with `scripts/demo-capture/capture.js` and a config for the game
- An Astro dev server on `localhost:4321` while capturing

## Commands

| Command | Does |
| --- | --- |
| `/content-brief <game>` | Build or refresh the cached game brief |
| `/content-shoot <game>` | Shoot, score, caption and render one clip |
| `/content-review` | Local approval dashboard |
| `/content-publish` | Publish approved shots (Phase 2) |
| `/content-schedule` | Install the recurring routine (Phase 4) |

## lib/

Every script runs standalone, so any stage can be debugged without the others.

```bash
# per-line VO, one WAV per line, durations measured from the WAV headers
node lib/tts.mjs script.json out/vo en_US-ryan-high

# ASS pop captions + an SRT that uses only measured timings
node lib/captions.mjs out/vo/vo.json out reel overlays.json

# render: plate + VO + ducked music bed + burned captions
node lib/render.mjs spec.json

# all of the above, plus capture and take selection
node lib/shoot.mjs shot.json --repo ~/Documents/weekly-arcade --out content/out/2026-08-17

# approval gate, 127.0.0.1 only
node lib/review.mjs content/out 4399
```

## Two things worth knowing before using it

**Captures must run against localhost.** Production serves a minified `game.js`
and capture configs patch source by exact string match, so against the live site
every patch misses and the capture films a default board while reporting success.

**A capture that finishes is not a capture that worked.** A CDP screencast under
load delivers a fraction of its frames and pads the file with duplicates, so
`ffprobe` reports a healthy 24fps for a clip that plays as a slideshow.
`validatePlate()` counts genuinely distinct frames with `mpdecimate` and refuses
anything under 12 unique fps. If takes come back starved, fix the machine, not the
config - check load average against core count and look for runaway Chrome GPU
helpers.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `CONTENT_TTS_PROVIDER` | `piper` | `piper` or `elevenlabs` |
| `CONTENT_PIPER_BIN` | `piper` | Piper executable |
| `CONTENT_PIPER_VOICE_DIR` | `~/voices` | Voice library |
| `CONTENT_PIPER_VOICE` | `en_US-ryan-high` | Default voice |
| `CONTENT_CAPTION_FONT` | `Arial Black` | Caption face |
| `CONTENT_FFMPEG` / `CONTENT_FFPROBE` | `ffmpeg` / `ffprobe` | Binary overrides |
| `ELEVENLABS_API_KEY` | - | Required for the elevenlabs provider |

## Publishing, and why the gate is split in two

`/content-review` records intent; `/content-publish` acts on it. They are separate
commands because the platforms are not symmetrical:

- **YouTube** uploads from an unverified API project are forced to `private`,
  which is a real draft. Reversible, published from Studio.
- **Instagram** has no draft or scheduling endpoint. Publishing is
  `POST /media` then `POST /media_publish`, it is immediate, and it **cannot be
  undone**.
