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

### The gate does not apply to synthetic renders

The 12-unique-fps floor diagnoses *captured* footage, where duplicate frames mean
frames that were dropped. A drawn render has no capture step, so duplicates there
mean something else entirely: nothing on screen is moving. Do not "fix" a
synthetic render by relaxing the gate - read it as a report on how much of the
cut is frozen, and animate the dead time instead.

The launch video measured 247 unique frames in 630 (11.8 unique fps). Reading it
as a starvation failure would have been wrong; read as a report on frozen time it
found a real one - 24 cards at 0.042s stagger all landed 1.6s into a 6.2s scene,
leaving 4.5s of dead frame. Pacing the stagger to 0.11s so the cascade fills most
of its scene took the count to 296 (14.1 unique fps).

**Do not expect to reach the frame count, and do not try to buy it with a drifting
backdrop.** Replacing the `round()`ed crop of the padded backdrop with a float
affine transform moved the count by almost nothing, and measuring the frame
sequence directly showed why: at radius-190 blur the local gradient is so shallow
that a 0.07px/frame shift changes every pixel by under 1/255 and rounds away.
7.9s of the cut is still bit-for-bit frozen. A drift that cannot change a pixel
cannot be seen by a viewer either, so it buys nothing on the look and nothing on
the metric. Perceptible slow motion needs high-frequency detail to move, not a
soft gradient.

What the count is good for is spotting holds that are too long. A typographic cut
that pauses long enough to be read *should* score low: 14 unique fps on drawn
motion graphics is healthy, while the same number on a capture means half the
frames were dropped. Judge the holds themselves - 2 to 3s on a card is normal,
4.5s was not.

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

## The look is locked too

Everything below shipped in the launch video after it was rejected twice for
being flat, and none of it is per-video taste. A new video that skips these does
not look like this channel.

### Type

**Anton for display, Archivo 600 for body.** Both OFL, both vendored at
`assets/fonts/` with their licences - see that directory's README. Burned-in
captions get `Anton` and `render.mjs` passes `fontsdir` to the subtitles filter,
because libass falls back to a system face silently and a silent fallback is how a
render goes off-brand with nothing in the log. Anton is a single weight with no italic and no
alternates - that is the point: it is a poster face, it fills a headline box at
any size, and it cannot be set badly. Arial and Helvetica are banned outright;
they read as a slide deck.

Sizes: Anton's caps are 3% shorter than Archivo's at the same nominal size, so
display sizes carry a 1.03 multiplier and body 1.0. **Re-check clearance after
any size change** - the multiplier moves cap bands, and cap bands are what
collide with cards.

`drawtext` in ffmpeg picks a family's default weight (Archivo 400), so anything
burned in by ffmpeg rather than PIL needs a static instance named explicitly.
`banner.sh` still has this bug.

### Colour

- Gradient: navy through violet into teal, and it drifts slowly all cut. A static
  gradient reads as a still.
- **`ACCENT = AMBER`.** Cyan was the first accent and it lost against the
  gradient's own teal. **The accent must never be a colour that appears in the
  gradient** - that is the whole rule, and it is why amber (the one saturated warm
  in the palette) owns every highlight, the CTA button and the progress line.
- White for primary type, one muted grey for tertiary. Nothing else.

### Every scene sits on a card

Gameplay is never full-bleed. One inset rounded card per panel, with:

- a drop shadow (dy 12, blur 24, alpha 120) so it sits on the gradient,
- a hairline edge highlight at alpha 46,
- a 16% corner vignette inside the card,
- per-panel punch on the beat, not a whole-frame zoom.

A scrim blends footage toward the gradient so three different games in one frame
read as one video; `SCRIM_PANEL_RELIEF` pulls it back inside the panels so the
game itself is not muddy. Bloom on the brightest areas, applied last.

Safe bands are the platform's, not the designer's: in 9x16 the top ~150px and the
bottom ~320px belong to the app's own UI (Reels chrome above, caption block and
action rail below).

**ART may run under the platform's UI. TYPE may not.** This is the rule that
settles "there is too much empty space", and it takes two or three passes to
believe: reserving the whole overlay zone as unusable frame leaves bands of bare
gradient, and at feed size the eye reads bare gradient as a small video inside a
big empty one no matter what is on the card. So the card bleeds past the caption
line and under the action rail - footage continuing under the app's own UI is what
makes a cut look native to the feed - while the kicker, the name chip and the
address bug stop at the safe lines and sit ON the card with their `with_backing`
halo for contrast.

**Then make the margins equal on three sides.** Unequal bands read as a mistake
even when each one is individually defensible, and a top band that differs from the
side band is the specific thing a viewer describes as "empty space on top and
bottom". For a 1080x1920 cut that is 48 top / 48 side, with the bottom at double
(96) because the card carries a drop shadow and the frame's own bottom edge is
where a Reels caption crowds it - 48 there looked pinned rather than placed. The
result is a 984x1776 card running y 48..1824, and every readable element moves
INSIDE it: the kicker sits ~200 down from the card's top rather than above the
card, and the chip and address bug ride on the footage near the bottom.

### Claims get a glint burst, not a bigger font

The lines a viewer is least likely to believe (`NO ADS`, `NO DOWNLOAD`,
`NO SIGNUP`) are emphasised with a burst of four-point stars per line, on the frame
the line lands. Four rules make the difference between a highlight and dust:

- **Ring, do not scatter.** Place stars on an ellipse around the line's measured
  box. Hashed points inside the box always drop some glints onto a glyph, where
  they read as compression artefacts.
- **Only the arcs within ~40 degrees of horizontal**, sides alternating. Stacked
  lines are one line-height apart, so straight above the middle line is on top of
  the line above it. Flanking the ends and reaching diagonally into the interline
  gaps is the only placement that works for all three lines.
- **Halo under core.** Each star is drawn twice - a wide dim pass (2x size, alpha
  ~46) under a hard one - then the bloom pass picks up the cores. One flat white
  star is a plus sign.
- **Burst, not shimmer**, and pop in a fifth of the life then fall away over the
  rest. Anything still twinkling a beat later reads as decoration rather than as
  the moment the claim landed. Pair each burst with a `sparkle` cue 40ms after the
  line's own tick, quieter each time so three in 1.3s do not pile up.

Hash the positions off a seed; never call `random`. Renders resume per frame, and a
re-render of one frame has to match the pass it came from or the clip flickers.

### The CTA is mandatory

Address, pressable button, one instruction, one tagline. Plus a small address bug
under every scene between the hook and the CTA: a launch video gets watched from
the middle and abandoned before the end, so the one piece of information that has
to survive cannot live only in the last two seconds.

### SFX are a fourth audio source

A cue bed rendered from a cue list by **`lib/sfx.py`**, which is vendored here and
locked the same way the voice is - use it, do not re-tune it per video. The picture
writes `cues.json` while it lays out its timeline, then:

```
python3 "$CLAUDE_PLUGIN_ROOT/lib/sfx.py" cues.json sfx.wav <durationSec>
```

and the result mixes in as a fourth source under VO, game audio and music. Cues are
synthesised and shaped by name, never sampled, so they render identically anywhere
with no asset library to keep in sync: `ratchet` clicks on the digits' own easing
curve so a count-up sounds geared; `loader` tops out near 900Hz with an 8-15Hz
tremolo so it reads as a machine rather than a riser. Whooshes, ticks, pops and
sparkles land on the grid, never between beats.

The restraint is the rule, not the library: one sound per moving element, and type
that merely fades in gets none. Emitting the cue list from the layout code is what
keeps them honest - place effects by ear afterwards and every timeline edit
silently desyncs the audio, where 40ms of slip turns a hit into a mistake.

Everything is on ONE clock, expressed in BARS at 126bpm (beat 0.47619s, bar
1.90476s). Scene boundaries, SFX cues and the cold open's phases all derive from
it. A cold open of "about two and a half seconds" is what breaks this: 2.5s is
5.25 beats and puts the whole arrangement off the grid. 1.5 bars is six whole
beats and is the shortest open that lands.

**The one exception: type that stamps a spoken word follows the VOICE, not the
grid.** Three claims spaced evenly on beats against a VO whose real gaps are
0.57 / 0.74 / 0.62 put the last line about half a second early, and a word arriving
half a second before it is said is the most obvious fault in a cut. So measure the
onsets - a 10ms RMS envelope over the clip, then a 5ms pass across any comma dip -
add the clip's own start offset from `vo.json`, subtract ~0.07 so a 0.20s reveal has
the word at ~70% opacity on the consonant, and hold the result in ONE constant that
both the scene and the cue builder read. Two copies of those numbers is how type,
sound and voice drift apart. Comment it with the file it was measured from and a
warning to re-measure if the line is ever re-recorded.

## The cold open

The hook is a browser being used, then punched through into the video. It is the
one part of the cut a viewer decides on, and every rule here was learned by
getting it wrong first.

- **Per aspect, a real device.** 9x16 gets a phone, 16x9 gets a laptop with a deck
  and a keyboard. Rendered by hand-rolled yaw/pitch projection into a PIL
  PERSPECTIVE warp - no 3D library, eight vertices.
- **Compose it BIG.** Roughly three quarters of the frame width. At 56% it is a
  product shot, and a product shot gets scrolled past.
- **Keep it three-quarter until the punch.** Easing all rotation to zero on the
  settle leaves the device face-on and dead for the two seconds of typing. Hold
  ~46% of the opening yaw; the punch is what flattens it.
- **The page is the frame's own aspect ratio**, its background IS the frame's
  gradient, and its mark sits at the hook's own mark width and centre. That is
  what makes the handoff seamless: the last frame of the punch and the first frame
  of the hook are the same picture, so no crossfade is needed.
- **The page must have two states.** Before navigation it is a browser's blank tab
  with its own furniture - a search field and a row of shortcut tiles - because
  the site gradient shown before the address is submitted both lies about the
  order of events and makes the screen read as a hole in the frame. A flat black
  rectangle is not an acceptable blank tab either: it is the shot for a second and
  a half.
- **The address bar is left-aligned, with a padlock**, in both aspects. Centred
  type in a pill reads as a title, not as a field someone is typing into.
- **Glass, and the glass MOVES.** Two soft white diagonal bands - one broad very
  faint wash (spread 0.30, alpha 13, blur 16) plus one narrow brighter streak
  (0.085, alpha 26, blur 7) inside it - are the cheapest thing that separates a
  rendered rectangle from a screen. A single 26-alpha wedge reads as a grey stripe
  painted on the glass; mostly gradient with one edge is what a reflection looks
  like. Sweep the pair once, entering off the top-left and leaving at the
  bottom-right, on a path steeper than 45 degrees (0.90w against 1.42h) so it reads
  as top-to-bottom with a diagonal lean rather than as a corner-to-corner wipe. A
  static highlight reads as texture baked into the render; the same two polygons
  moving read as a light source the device is turning under. Travel mostly linear
  with a fast first third (0.30 ease_out + 0.70 linear) so it agrees with the tilt
  still settling, brightest across the middle of the glass (a bell, not flat, or the
  entrance and exit are the loudest moments), and end the travel exactly where the
  highlight starts fading so the slide and the fade are one move.
- **Dim the surround, radially.** A flat scrim lifts the device off a background
  that is otherwise the same value as its screen; a RADIAL one (about 88 at centre,
  196 in the corners) also says where to look. It lifts to zero exactly as the
  punch completes.
- **Real content on the loaded page**, built once at the largest scale the dolly
  asks for - never upscaled from small icons - and it must be **gone before the
  page becomes the frame**. Slide it out of the page at full opacity rather than
  fading it: translucent cards at partial alpha are legible text with no card
  under them, which reads as a broken render.
- **Open from black in 0.14s, not 0.3s.** The cold open already starts dark; a
  third of a second of fade on top of that puts a near-black frame in the exact
  place a feed decides whether to keep playing.
