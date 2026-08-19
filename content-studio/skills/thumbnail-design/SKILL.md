---
name: thumbnail-design
description: How this channel's thumbnails and Reels covers are made - the measured CTR rules, the three-variant test discipline, and lib/thumbnail.py. Load before making any thumbnail, cover or upload bundle.
---

# thumbnail-design

The thumbnail decides whether the video is watched. It is also the only asset the
platform will A/B test for us for free, so it is never made one at a time.

## Always three, differing on ONE axis

YouTube Studio's **Test & Compare** takes up to three thumbnails on a public
long-form video and picks the winner on real impressions - no YPP membership
needed, desktop Studio only, advanced features enabled, and it wants 1-2 weeks
and thousands of impressions to call it. Shorts, private, made-for-kids and
age-restricted videos are not eligible, and neither are Reels covers.

So: **three variants for every long-form upload**, and they must differ on one
axis or the finished test says nothing. The axis is how much type and which hook:

| Strategy | Type | Hook |
| --- | --- | --- |
| `claim` | 3 words | the number or the price - the strongest single hook |
| `curiosity` | 2 words + a cue | states the cadence, withholds the payoff |
| `subject` | 1 word | tests whether the type is helping at all |

For Shorts and Reels the three still get made, because a human picking at feed
size needs something to pick between - but only one is posted.

## What the numbers say

Aggregate 2024-2026 studies (1of10, ThumbnailTest, Statista) are consistent:

- **Under 4 words beats text-heavy by ~30%.** This is the single largest effect
  available. `WORD_CAP = 3` in the tool, and it warns rather than truncates.
- **Faces are worth 20-35%** - and we have none. Browser games have no presenter,
  so the subject slot goes to the most visually active gameplay frame instead.
  Do not substitute a stock face; the channel promise is "the runs worth
  watching", and a face that is not in the video is a different promise.
- **A directional cue - a ring or an arrow - is worth up to 25%**, and only if it
  points at something. Place it on a measured salient point, never at a fixed
  fraction of the frame; on a sparse game a fixed position rings empty background,
  which is worse than no cue.
- **Optimised thumbnails move CTR 25-40%**; title work adds another 15-25% on top.
- **One subject, one message, one second.** Clutter fails because the viewer never
  processes it - the 2026 trend is aggressive simplicity.

## Two renderers, one set of rules

```
python3 "$CLAUDE_PLUGIN_ROOT/lib/thumbnail_web.py" spec.json outdir   # default
python3 "$CLAUDE_PLUGIN_ROOT/lib/thumbnail.py"     spec.json outdir   # no Chrome
```

**Reach for `thumbnail_web.py`.** It lays the frame out in
`lib/thumb-template.html` and screenshots it with headless Chrome at exactly
1280x720 or 1080x1920. The premium look is layered shadows, a gradient running
through the glyphs with a stroke outside them, perspective on the cards, a masked
reflection and blend modes - one line of CSS each, and a function each in Pillow. A
renderer that makes depth expensive produces flat work by default, which is what
the first pass of this channel's thumbnails looked like.

`thumbnail.py` stays because it needs nothing but Pillow, and it still owns every
measurement: both renderers share its frame scoring, span distinctness, salient
point, contrast check, cap-height floor, word cap and 2MB JPEG cap. Only the
drawing differs, so a spec renders under either.

Chrome is found automatically (`CHROME=` overrides). It is **calibrated per
build**, not trusted: `--window-size` is not the viewport everywhere - Chrome for
Testing 131 in `--headless=new` paints 1280x632 for a requested 1280x720 and pads
the rest with the background colour, which silently crops the bottom of the
design. The renderer shoots a known block first, keeps the flag and padding that
come back whole, then crops - never resizes - to the target.

### A platform video is not a game video

Ask which one you are making before you pick a layout, because every other
decision follows from it and they point opposite ways.

| | one game | the platform |
| --- | --- | --- |
| Layout | `blast` or `stack` - one subject, full attention | `fan` - the stack of screens is the whole point |
| Cue | a ring or arrow on the moment | **none**: a ring points into one game's scene, which is the single-game signal |
| Words | what happened in this run | what the catalogue is: free, weekly, no signup |
| Subject | the best frame of that game | games that visibly differ from each other |
| Sub line | the game's name | the domain |

The one that actually bites is the cast. `fan` fills its flankers from the other
variants' picks, which is right for a game video and wrong here: a launch montage
reuses a couple of clips across its slots, so the automatic pick keeps handing back
a second and third view of the same game. `_differs` passes them - it compares
layout and colour and cannot tell "another game" from "another moment of this
game". Three stills of one game reads as one game photocopied and contradicts the
number the words are claiming, so **cast a platform thumbnail by hand** with
`"frame"` and `"flankers"` and keep the cast identical across all three variants,
because the axis under test is the words.

Two things to check in any still before it goes on a card: the site header (a
capture that shows a "Sign In" button next to a "no signup" claim argues with
itself) and whether the game is a clone. A game named after somebody else's game
cannot be the face of a channel that claims "built from scratch, not clones",
however well it scores.

Flankers are dimmed to sit behind the hero, and the dim is **measured, not fixed**:
`brightness(.66)` assumes the flanker is as bright as the hero, and a game that is
already a dark starfield becomes a black rectangle. `dim()` aims for 62% of the
hero's luminance with an absolute floor, and returns values above 1 when a dark
game needs lifting.

### Where the depth comes from

Six layers, in this order, because "make it look premium" is not actionable and
each of these is:

1. **The light has a position.** `--lightx/--lighty` per layout, and every other
   layer points at it: the background's warm radial, the rim gradient's angle, the
   ray origin, the ambient mask. A frame where the highlight and the shadow
   disagree reads as a collage.
2. **The light is sampled from the subject, hue only.** `palette()` takes the
   dominant hue and rebuilds it at S=0.78 V=0.97. Do **not** scale the sampled RGB
   - a game frame's average is grey, and scaling it keeps the greyness and turns
   the whole thumbnail to mud. The brand ramp stays the brand's; the sampled hue
   gets 34% of the mid-tone, no more. Two overrides earn their keep: a near-grey
   subject (S < 0.15) falls back to brand cyan, and a subject whose hue is within
   0.09 of brand purple also swaps the **rim** to cyan while the ground keeps the
   sampled hue - otherwise a purple card on a purple background has no edge.
3. **The card is a lit object, not a sticker.** The rim is a gradient border
   (bright at the light, dark away from it) via a padded parent; the face carries a
   grade, a diagonal gloss, and an inset occlusion shadow so its own edges go dark.
4. **It stands on something.** A floor ellipse painted *before* the card plus a
   masked, blurred reflection under it. A cast shadow says there is a light; the
   floor says the object is standing on a surface.
5. **Ambient bounce, masked.** A 96px-wide blurred copy of the subject screened
   at .22 - but masked to a radial around the light. Screening it over the whole
   frame lifts the blacks and drops the contrast check below 4.5:1.
6. **Rays are a whisper.** `repeating-conic-gradient` under 4% alpha, period 15deg
   or wider, masked to a band close behind the card. Brighter or wider-spread and
   they become countable stripes across the type.

The type earned its own lesson: the stroke goes **outside** the glyphs
(`paint-order: stroke fill`) and stays thin, 0.030em. At 0.075em with negative
tracking, neighbouring glyphs weld into one black slab and the counters fill in.
Slightly positive tracking plus a dark blurred halo does the separating instead.

One trap in the template: `--deep` is the amber gradient's bottom stop. The
background tint is `--tint`. Collide them and the accent word goes olive.

### The three layouts

`"layout"` on the spec, or per variant to test treatment against treatment:

| Layout | What it is | Use it for |
| --- | --- | --- |
| `stack` | one card on a lit background, type beside or under it | the default - one subject, one message |
| `fan` | a hero card with two dimmed flankers behind | "there are many games" - the default for anything about the platform |
| `blast` | the frame full-bleed, graded, washed, type over it, amber bar | one game, one moment - the strongest single subject |

`fan` takes its flankers from the other variants' picks, which are already sampled
from different spans and already checked for looking different, so it gets distinct
games for free on a game video. On a platform video it does not - see above -
and `"frame"` plus `"flankers": [...]` overrides both with explicit paths.

**Three cards, not eight.** A grid of eight tiles is the obvious way to say
"catalogue" and it is wrong at feed size: eight 90px tiles are eight unreadable
smears, and the evidence on aggressive simplicity is the strongest number in this
skill. Three reads as "many" and stays legible.

`"cue_at": [fx, fy]` places the ring or arrow by hand, in fractions of the
subject, when the measured salient point misses - edge energy on a
depth-of-field frame picks a hard-edged prop over a soft-edged character, and
naming the spot is faster than arguing with the metric.

## Rules the tool enforces

- **1280x720 JPG, under 2MB**, quality stepped down until it fits.
- **Source the subject from the CLEAN gameplay track (`frames_dir`), not the
  finished cut.** The cut carries burned-in type - kicker, name chip, address bug -
  and a thumbnail sampled from it has the brand's type in the picture twice, the
  second copy in a position nobody chose. The gameplay track the render already
  extracted is the same footage with none of it.
- **Score frames by structure, not detail.** Edge energy alone rewards confetti: a
  field of thirty identical coins outscores a character under a tree, and at feed
  width the coins are noise. Weight a 64px downscale over a 320px one, times
  saturation, times colour range.
- **One pick per span of the track, and the picks must not LOOK alike.** The global
  top three all come from whichever game scores highest, which produces three
  variants of one screenshot. Spans fix most of that, but the scorer has a
  favourite look and will find it in more than one span, so inside a span it walks
  down by score until a frame that differs from the earlier picks. Where a span has
  nothing different it says so (`WARN span 3: ... reusing the look`) instead of
  quietly shipping a duplicate - that warning means re-source, not re-run.
- **Every word on its own line, fitted to the column**, then scaled down until the
  stack fits the safe box. Height wins over size; a clipped last line is worse.
- **Contrast is measured, not judged.** Take the mean of the pixels the type will
  actually cover and deepen the scrim until it clears 4.5:1. An opaque slab would
  clear it too and would throw the footage away.
- **Cap height at least 13% of frame height**, or it does not survive the feed
  card. The tool warns; a warning here means rewrite the text shorter, not shrink
  the margins.
- **On a vertical frame, nothing readable outside the surface's band.** Cards,
  type column and sub bar are checked against `band(surface)` and the warning names
  the pixels. See the covers section - this is the rule the first covers broke.
- **The column is measured by what it fills, not by the box it sits in.** `.col`
  centres its content, so a box comfortably inside the band tells you nothing if the
  type has grown past it. The check uses `colFill`, computed from the fitted size
  plus everything reserved. A story sub that wrapped to two lines was pushing its
  second line under the reply bar while the box check passed.
- **Text is measured at the weight the CSS draws it at.** Archivo is a variable font
  whose PIL default instance is weight 600 and the template asks for 700 on the sub
  line and 800 in the bar. The gap is about 2%, small enough to look like rounding
  and large enough to wrap a line that measured as fitting. `_face()` sets the axis;
  `SUB_WEIGHT` and `BAR_WEIGHT` exist so the measurement and the render cannot drift.
- **A bar's text is sized to fit the width, not to a fraction of the bar's height.**
  The bar spans the whole frame, so its overflow has nowhere to go and is clipped at
  the edge. `weeklyarcade.games` published once as `weeklyarcade.game`. `fit_line()`
  counts letter-spacing, which PIL does not, and warns if the string only fits at
  under 26% of the bar height - at that point it is fine print, not a message.
- **Flanker dimming is measured against the hero**, not a fixed `brightness(.66)`,
  so a dark game is lifted instead of turned into a black rectangle. It is switched
  off entirely on `versus`, where the two cards are the poll's two options and have
  to be equally lit.
- **A story sticker's zone is subtracted from the band before anything is sized.**
  `STICKER_KINDS` holds the measured zone per kind and `squeeze()` remaps the layout
  into what is left, so the card cannot be composed as if the sticker were optional.
  The renderer reports the kind it reserved for (`+quiz`) on the summary line.

## Reels covers are not rescaled thumbnails

`"aspect": "9x16"` - 1080x1920 - and the tall geometry is a different design, not
the wide one re-proportioned. Three things make it different.

**The frame you design is not the frame that gets seen.** Instagram crops a 9:16
post to **4:5** for the profile grid and the feed card, so the real canvas is the
middle 70% of the height: `GRID = (0.148, 0.852)`. The top and bottom eighths are
for bleed and for Instagram's own furniture - the handle row above, the caption and
button overlay below - and nothing that has to be read may go there. The renderer
enforces it: any card, type column or sub bar that leaves the band is a warning
naming the pixels. (Some surfaces still show 1:1, so treat the band's own top and
bottom as soft edges rather than putting a sub line hard against them.)

**The cards are portrait.** The captures are 720x1280. A landscape card in a tall
frame throws away most of the game and leaves dead ground either side of the
flankers - it was the single biggest reason the first covers looked worse than the
thumbnails despite identical craft. Cards take the top of the band, type the bottom
of it, disjoint by construction.

**There is no mark on a cover.** Instagram already draws the avatar and the handle
immediately above and below the post, so the logo repeats what the viewer can see -
and at 26% of the width it costs 15% of GRID, which is exactly the height the second
word needs to clear the cap-height floor. On YouTube the mark stays: there the
channel name is small grey text under the thumbnail and the mark is the only brand
signal at feed size.

Two things carry over from the old cover rules because they were right. **Three
words rarely fit**: the column forces the cap height under the 13% floor, which is
why the tool warns on the three-word variant here and not on the 16:9 one - two
words is a cover's budget, and the launch bundle therefore ships two covers, not
three. And covers **cannot be A/B tested**, so it is a straight pick from the
contact sheet rather than a Test & Compare.

On `blast`, the sub bar moves to the foot of GRID rather than closing the frame,
and the type column stops above it - a bar flush to the bottom edge is a bar nobody
reads, and a bar overlapping the column takes the contrast measurement down with it.

## Stories are a third surface, not a cover reused

`"surface": "story"` next to `"aspect": "9x16"`. The file is 1080x1920 either way;
what differs is which pixels are usable and why, and getting this wrong in the
obvious direction - treating a story like a cover - wastes half the frame.

**Nothing is cropped, and that is not the same as everything being visible.** A
story shows the whole frame, then Instagram draws its own interface on top of it:
the progress bar and profile row over the top, the "Send message" reply bar and its
controls over the bottom. Instagram asks for 250px clear at each end of a 1920 frame,
so `SURFACES['story'] = (0.130, 0.870)`, and it is an occlusion band rather than a
crop band. A cover loses those pixels; a story keeps them and cannot use them.

Do not fold the sticker reservation into that band. Getting this wrong costs 9% of
the frame on every story whether it carries a sticker or not, and it is invisible
once done because the result still looks deliberate.

**A sticker is a hole in the layout, not something laid on top of one.** The zone has
to be reserved before anything is sized, because the sticker does not exist until the
poster adds it in the app and no pixel underneath it can be relied on. `"sticker"` on
a story variant names its kind and `STICKER_KINDS` holds the measured zones:

| kind | zone | note |
|---|---|---|
| `link` | 0.790-0.870 | the only tappable link outside the bio |
| `poll` | 0.660-0.845 | two options |
| `quiz` | 0.560-0.845 | four options, the tallest of them |
| `question` | 0.690-0.850 | prompt plus an input field |
| `slider` | 0.700-0.840 | |

Pass `"none"` for a card with no sticker, or `{"kind": ..., "band": [...]}` to override
a zone. `squeeze()` then remaps the whole band onto what is left above the sticker and
moves every element together, rather than each layout carrying a hand-tuned geometry
per sticker kind. When the remainder drops under 25% of the frame you get a warning:
that is the point where the type is being starved by the sticker and the honest fix is
shorter copy, not a smaller floor.

**A sticker carries its own question, so the type must not repeat it.** This is the
whole reason a story headline is short. A poll asking "which one first?" beside a
headline reading PICK ONE says the same thing twice and spends the height twice; the
headline's only job is to frame the interaction, so it goes to one word. On `blast`
the sub bar sits just above the link zone and points at the sticker rather than
duplicating it: the sticker already displays the domain, so the bar says TAP TO PLAY.

**`versus` is the layout for a two-option poll.** Every other layout has a hero and
subordinates, which is exactly wrong here - a poll between a bright card and a dimmed
one is not a poll, it is a suggestion. So `versus` places two equal cards side by
side, drops the headline small and to the top, and suppresses flanker dimming
entirely. Keep the poll's option order matching the cards left to right or the slide
contradicts itself.

**The cap-height floor is lower here, and it is not a relaxed standard.** The floor
tracks the smallest width the surface is ever displayed at. A YouTube search row is
about 320px of a 1280px file and a profile grid tile about 360px of a 1080px one, so
both need 13%. A story plays full screen at essentially native width, so `CAP_FLOOR`
gives it 9%. Importing 13% onto a story does not make it more legible, it forces the
game cards smaller to make room for type nobody was struggling to read.

**Design them undated.** A story expires in 24 hours, so on an account without a
following the deliverable is the Highlight, not the story. Cards that name a date or
a game count stop being true; cards that state what the place is keep working on the
profile indefinitely.

**The frames of your own cut are usually unusable as backgrounds.** A launch cut
narrates with its own type, so a full-bleed story built on a sampled frame sets your
headline on top of the cut's headline, and the frame scorer will actively choose
those frames because type and UI panels are maximum edge energy. Use `avoid` to
exclude the narrated ranges, and check what is left: persistent furniture like a
corner badge, a lower-third wordmark or the chip naming the game on screen survives
every frame and has to be cropped or patched out of the source. `lib/story_bg.py`
does that - it pulls a frame at a timestamp, finds the badge band and the chip label,
crops and patches them, and prints every measurement it acted on. Both detections can
be wrong, so look at what it wrote before using it.

## Judge from the contact sheet

`thumbs-contact.png` renders every variant at feed width (420px for 16:9, 260px
plus its 1:1 crop for covers) on a neutral card. A thumbnail approved at 1280 wide
is a different image from the one anybody sees. Approve from the sheet or the
approval is meaningless.

## One caution on numbers

`social-publishing` forbids hardcoding the catalogue size in metadata because it
grows weekly, and a thumbnail is metadata that cannot be edited after a test
starts. A number is the strongest hook available, so use it only where the video
itself is dated - a launch film, a monthly compilation - and never on an evergreen
upload that will still be recommended when the count has moved.
