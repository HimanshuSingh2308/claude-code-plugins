# content-studio - design

A Claude Code plugin that turns a Weekly Arcade game into engaging short-form and long-form
video, on a schedule, with a human approval gate before anything goes live.

Status: **Phase 1 render layer built and verified; capture blocked on machine load.** `lib/` is
implemented and tested end to end (TTS, captions, render, take selection, review gate). What is
not yet proven is one genuinely good Duneburst clip, because every capture on this machine has
come back frame-starved. See "Corrections from implementation" for what the build changed about
the plan.

## Decisions locked

| Decision | Choice | Why it matters |
| --- | --- | --- |
| Renderer | ffmpeg + Remotion; Premiere optional | Scheduled runs cannot depend on a GUI app being open. Premiere gets an importable bundle for hand-polish. |
| Instagram | API publish on approval | No draft or schedule endpoint exists. The approval click is the publish. |
| Voice | TTS voiceover + burned-in captions | Scripted as reaction/commentary, not feature copy. |
| TTS | Piper now, ElevenLabs later behind one interface | Nothing blocked on billing. Mirrors muse-studio's provider split. |
| YouTube | Shorts (9:16) + long-form (16:9) | Long-form starts as compilations of existing short captures. |
| YouTube upload | Bundle for manual Studio upload, no API | An API upload from an un-audited project is locked `private` *permanently* - the owner cannot unlock it. |
| Brand voice | One `social-publishing` skill, not per-agent prose | The live profile copy is the source of truth; duplicating it in agents guarantees drift. |
| Code layout | Engine in plugin, per-game data in weekly-arcade | Game-specific source patches must sit next to the source they patch. |
| Schedule | Claude Code scheduled agent + local review page | Shot selection and scripting need the model, not a bare cron script. |

## Layout

```
hplugins/content-studio/            # the engine, portable
├── .claude-plugin/plugin.json
├── agents/
│   ├── game-brief-writer.md        # stage 1
│   ├── capture-config-author.md    # stage 2 - the expensive one
│   ├── shot-planner.md             # stage 3
│   ├── script-writer.md            # stage 5a
│   └── content-orchestrator.md     # drives 1-7 for a scheduled run
├── commands/
│   ├── content-brief.md            # /content-brief duneburst
│   ├── content-shoot.md            # /content-shoot duneburst --format reel
│   ├── content-review.md           # opens the review dashboard
│   ├── content-publish.md          # publishes approved items
│   └── content-schedule.md         # installs/removes the cron routine
├── skills/
│   ├── video-hooks/                # retention patterns, hook taxonomy
│   ├── vo-scripting/               # commentary voice, anti-ad rules
│   ├── caption-style/              # overlay timing, safe areas per platform
│   ├── render-pipeline/            # ffmpeg + Remotion recipes
│   ├── thumbnail-design/           # BUILT - CTR rules, 3-variant test discipline
│   └── social-publishing/          # BUILT - brand voice, handles, per-field templates
└── lib/                            # node scripts, zero-to-few deps
    ├── render.mjs                  # master render, ffmpeg orchestration
    ├── tts.mjs                     # piper | elevenlabs, per-line WAVs
    ├── remotion/                   # caption + overlay compositions
    ├── sfx.py                      # BUILT - synthesised cue bed from a cue list
    ├── thumbnail.py                # BUILT - 3 thumbnail variants + Reels cover
    ├── bundle-youtube.mjs          # writes the manual-upload bundle, does NOT upload
    ├── publish-instagram.mjs
    └── premiere-export.mjs         # XMEML timeline + SRT + clips

weekly-arcade/content/              # per-game data, git-tracked
├── briefs/<game>.json              # stage 1 output, hash-invalidated
├── shots/<game>/<shot-id>.json     # planned clip specs
├── shot-log.jsonl                  # what shipped, prevents repeats
├── music/                          # licensed beds, manually sourced
└── out/<date>/<shot-id>/           # renders, thumbnails, metadata

weekly-arcade/scripts/demo-capture/configs/   # existing, one config per game
```

The capture harness stays where it is and is not modified. content-studio calls it.

## Pipeline

### 1. Game brief (cached)

`game-brief-writer` reads the game source, its PRD, its registry entry, and runs one throwaway
capture, then writes `content/briefs/<game>.json`:

```json
{
  "gameId": "duneburst",
  "sourceHash": "sha256 of game.js",
  "mechanics": "...", "controls": "...", "scoring": "...",
  "unmuteKeys": { "duneburst-muted": "0", "duneburst-music": "1" },
  "gateKeys": { "gl_played_duneburst": "1", "duneburst-seen-intro": "1" },
  "filmableMoments": [
    { "id": "cascade", "beat": "3-colour chain", "why": "the payoff", "durationMs": 8000 }
  ],
  "hookAngles": ["satisfying", "near-miss", "score-challenge"],
  "audioCharacter": "granular, percussive"
}
```

`sourceHash` is the invalidation key. A game whose `game.js` changed gets a re-brief before its
next shoot, because a stale brief is how a capture config silently stops matching.

### 2. Capture config authoring

The real bottleneck, and honest about it: Duneburst's config needed 9 source patches, a
hand-authored board that provably does not pre-span, and a 4x sim-clock override. Only Duneburst
has one today.

`capture-config-author` follows the procedure the demo-capture README already documents:
headful with an empty timeline, seed past the gates, block the API origin, build the timeline
with input steps only, patch in `[demo]` marks to get a beat sheet, then tune `record` windows
against a recorded run. It always sets `expect` on every patch.

One-time cost per game, human-reviewed once, reusable forever after. This stage is not on the
scheduled path.

### 3. Shot planning

`shot-planner` reads the brief plus `shot-log.jsonl` and picks a format template and hook that
has not been used recently for that game. Templates:

| Template | Shape | Format |
| --- | --- | --- |
| `satisfying` | open mid-cascade, no setup, loop-friendly end | reel, short |
| `near-miss` | tension, almost-fail, recovery | reel, short |
| `challenge` | score on screen, "beat this" | reel, short |
| `mechanic-reveal` | one non-obvious interaction | short |
| `compilation` | N existing captures, narrated | long-form |

Output is a shot spec: template, target duration, capture config + seed, record window, VO beats,
overlay text, music track, platform targets.

### 4. Capture

Runs `capture.js <config> --seed N` against **`http://localhost:4321`**, several seeds per shot,
and picks the take whose `[demo]` marks land closest to the planned beat sheet and whose frames
actually arrived.

**Localhost is mandatory, not a preference.** Production serves a minified `game.js`, and capture
configs patch source by exact whitespace-sensitive string match, so against
`https://weeklyarcade.games` all nine Duneburst patches miss and the capture films a default
board while reporting success. A scheduled run therefore has to start the Astro dev server as a
prerequisite. `capture.js` already defaults `--base` to localhost, so this is the harness's own
assumption too.

Every take is gated on unique frame count before anything is rendered on top of it. See risks.

Note: capture defaults to 720px wide; the render upscales to 1080 rather than the capture, since
a starved 1080 screencast is worse than a healthy 720 one.

### 5. Script, voice, render

**5a.** `script-writer` writes the VO as timed lines against the beat sheet. Rules from the
`vo-scripting` skill: first 1.5s wordless so gameplay hooks before any voice, commentary not
copy, no "check out", no feature lists, one idea per line, lines under ~12 words.

**5b.** `tts.mjs` synthesizes **one WAV per line**. This is the whole caption-alignment trick:
each line's duration is measured from its own file, so caption timing is exact by construction
and no forced alignment or whisper install is needed. Provider is env-selected
(`CONTENT_TTS_PROVIDER=piper|elevenlabs`), Piper reading voices from `~/voices`.

**5c.** Render. Captions and overlays are **ASS subtitles burned in by ffmpeg**, not Remotion:
ASS supports the fades, punch-ins and colour accents the format needs, burns in one filter, and
adds no npm install and no headless-browser pass to a scheduled job. Remotion stays available for
overlays that genuinely need layout or data-driven motion, and nothing in the pipeline depends on
it. ffmpeg also does the music bed with game audio ducked under VO via `sidechaincompress` keyed
on the voice, a `loudnorm` master at -14 LUFS, and the platform encodes. 1080x1920 for reels and
shorts; a 16:9 variant with a blurred self-background for long-form.

**5d.** `premiere-export.mjs` also emits clips + an XMEML timeline with markers on every beat +
an SRT, so any video can be opened in Premiere and hand-finished. Nothing in the automated path
depends on it.

### 6. Metadata

Per platform: IG caption + hashtags, YT Shorts title/description/tags, long-form title +
thumbnail (nano-banana skill generates it), and the game's deep link.

### 7. Review gate

`/content-review` writes a local dashboard listing each rendered video with its player, caption,
VO transcript, and approve/reject. Approval writes to the shot record; nothing publishes without it.

### 8. Publish

**YouTube** is not published through the API at all. Uploads via `videos.insert` from an
un-audited API project are forced to `private` and **the owner cannot change the visibility** -
not from Studio, not by any call. The video is stranded. The only exits are passing a YouTube
compliance audit or re-uploading by hand, so `/content-publish` writes an **upload bundle** (mp4,
thumbnail, and a text file with title, description and tags) that a human drags into Studio.
Studio's native scheduler is better than the API's anyway, and the quota question (~100 units per
`videos.insert` against a separate 100-uploads/day bucket) never arises.

**Instagram** has no draft state. Publishing is `POST /media` (container, needs a public
`video_url`, so the mp4 is uploaded to Firebase Storage first) then `POST /media_publish`.
Containers expire in 24h and Reels via API are capped at 90s. Requires an IG Business/Creator
account linked to a Facebook Page and a Meta app; dev mode suffices for accounts you own, no App
Review needed. **The approval click publishes live and cannot be undone.** The dashboard will
say so on the button.

### 9. Feedback

A later pass pulls per-video metrics and appends them to `shot-log.jsonl` so `shot-planner` can
favour templates and hooks that actually performed.

## Build order

1. **Phase 1 - one game, one format, manual.** Duneburst reel end to end: brief, shot plan,
   capture, Piper VO, captions, render, review page. No publishing, no schedule. This is the
   phase that proves whether the output is actually good.
2. **Phase 2 - publish.** YT upload bundle for manual Studio upload, then IG container/publish
   with Firebase hosting.
3. **Phase 3 - scale the catalogue.** `capture-config-author` against 4-5 more games, which is
   what makes daily volume possible at all.
4. **Phase 4 - schedule + long-form.** Cron routine, compilations, feedback loop.

## Risks

- **Config authoring may not fully automate.** If `capture-config-author` cannot reliably author
  boards for complex games, per-game setup stays partly manual and daily volume is gated on it.
- **Piper may not be good enough.** A synthetic voice on a 30s clip can read as exactly the ad
  we are trying not to make. Phase 1 is the checkpoint for swapping to ElevenLabs.
- **IG has no undo.** Mitigated only by the review gate being explicit about it.
- **Long-form needs a capture library first.** Compilations cannot exist before short-form has
  produced enough distinct clips.
- **Frame starvation, now the live blocker.** A CDP screencast delivers frames only as fast as
  the compositor produces them, and pads the file with duplicates when it cannot keep up - so
  `ffprobe` still reports 24fps while the clip plays as a slideshow. Container-level checks cannot
  see this. Mitigated by `validatePlate()`, which counts genuinely distinct frames via
  `mpdecimate` and refuses anything under 12 unique fps. Observed on this machine: 22-30 unique
  fps idle, **0.4-2 under a load average of ~64 on 12 cores**. A wall-clock-driven sim also slows
  down under the same load, which stretched Duneburst's span beat from a tuned 2897ms to 28478ms.
  The fix is machine state, not configuration, so a scheduled run must check load before shooting.

## Corrections from implementation

Things the build proved wrong about the plan above, recorded rather than quietly edited away:

| Assumed | Actual |
| --- | --- |
| Captures can run against production | Production is minified; source patches can never match. Localhost is mandatory. |
| Remotion draws the caption layer | ASS burned in by ffmpeg is enough and far cheaper to schedule. Remotion is now optional. |
| A completed capture is a usable capture | Frame delivery is the dominant failure and is invisible to `ffprobe`. Needs an explicit gate. |
| Screencast is silent, so audio must be added | The harness's Web Audio tap works; plates arrive **with** a game audio track. |
| Caption timing is the hard part | It is free, given per-line WAVs. Frame health and beat timing are the hard parts. |
| A forced-`private` YouTube upload is a usable draft | It is a dead end. The owner cannot change the visibility of a video uploaded from an un-audited project, so the API cannot be used to publish at all. Metadata is generated as text a human pastes into Studio. |

## Open items and assumed defaults

| Item | Default I will assume |
| --- | --- |
| Do the IG/YT channels exist? | Assumed not yet. Phase 2 needs them created plus API credentials before it can be built. |
| "2 videos a day" | 2 short-form masters/day, each cut for both IG Reels and YT Shorts, plus 1 long-form compilation/week. |
| Music | A small royalty-free library you drop in `content/music/`, sourced manually from the YouTube Audio Library. I will not auto-download tracks of unclear licence. |
| Capture target | Localhost always, including scheduled runs, since production is minified. A scheduled run starts the dev server itself. |
| Machine load during a scheduled run | Checked before shooting and the run is skipped, not attempted, if the load average is above roughly 2x core count. A starved clip is worse than no clip. |
| Pilot game | Duneburst, since it owns the only existing capture config. |
