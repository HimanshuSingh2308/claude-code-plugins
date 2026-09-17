# Generative Tooling: What Is Wired Up, What Each Tool Is Good For, and the Licensing

Companion to `../SKILL.md` section 8. The skill states the judgement; this file has the detail.

**Two hard constraints bind everything here.** No lettering from image generators: all in-scene
text is drawn as real text onto a canvas texture at runtime, and a generated image must never
carry baked-in words, not even decorative background lettering. Generated glyphs are unreliable,
unlocalisable, unsearchable, cannot be updated without regenerating art, and read as gibberish at
any size where they are legible. Where a generated backdrop would naturally contain signage,
prompt for blank plates, banners or panels and draw the text on top at runtime. And no emojis as
art: not as icons, not as props, not as placeholders that survive to a commit.

---

## 1. Availability in this environment (verified, 2026-09-17)

| Tool | Status | How to reach it |
|---|---|---|
| **Nano Banana (Gemini image generation)** | **Available now** | The `gemini` CLI is on PATH and there is a `nano-banana` skill in this environment that drives it. Use the skill rather than shelling out directly |
| **Blender** | **Available now** | CLI at `/opt/homebrew/bin/blender` (5.2.0 LTS), plus a Blender MCP server, so Blender can be scripted directly. See [blender-pipeline.md](blender-pipeline.md) |
| **Meshy AI** | **NOT configured** | No API key, no MCP server, no reference anywhere in settings or in this repo. The workflow below is documented so it is ready, but **it requires setup before any use**. Do not plan work that assumes it is one call away |

## 2. Nano Banana / Gemini image generation

**Genuinely good at:**

- **Reference and concept boards.** The cheapest, highest-value use. Generate 6-12 variants of a
  scene mood in a minute, pick one, then build it in code. The generated image is never shipped.
- **Tileable textures.** It handles seamless requests better than most models when you explicitly
  ask for the tiling property, but **verify**: offset the result by 50 percent in both axes and
  look at the seam.
- **Matcaps.** A matcap is literally a picture of a shaded sphere, and "a sphere rendered in glossy
  ceramic, soft studio light from upper left, dark neutral background, no text" is a task an image
  model does well. A 256x256 matcap is a tiny, perfectly usable shipped asset.
- **Gradient ramps and colour keys.** Better still: generate a mood image, *sample* the ramp from
  it, and write the ramp as code constants. That keeps the asset diffable.
- **2D sprites and backdrops**, subject to the cleanup below.
- **Iterative editing** of an existing image, which is where these models are now strongest: hand
  it your current screenshot and ask for a restyled version to use as a target.

**Bad at:**

- **Text.** Even improved models produce glyphs that are wrong on close inspection. Forbidden here
  anyway.
- **True transparency.** Gemini image models do not produce real alpha; you always need a
  post-processing step. The workaround that works: generate on a flat chroma background with a
  clean 2-3 px outline fully separating the subject, then key it out.
- **Exact repeatability.** The same prompt does not give the same image. This is the core conflict
  with a git-based reproducible pipeline; see section 5.
- **Sprite sheets with consistent character across frames.** Frame-to-frame coherence is the
  classic failure.
- **Respecting a palette.** It will drift. Quantise afterwards.

**Cleanup path for a generated 2D asset:**

1. Key out the background (chroma or the generated outline), producing real alpha.
2. **Quantise to the project palette.** The single most important step for coherence: map every
   pixel to the nearest of your 16-32 locked colours, nearest in a perceptual space rather than
   naive RGB. Everything suddenly belongs to the same game.
3. Resize down to the target resolution with the right filter: NEAREST for pixel art,
   area-average for painted.
4. Crop to content, then pack into the atlas with padding and edge extrusion.
5. **Check it at real device size.** Most generated detail disappears; if it disappears, remove it
   so it is not costing bytes.
6. Strip metadata; commit the processed asset plus the prompt and the processing script.

**Cost:** cheap per image. The real cost is curation time and the pull toward inconsistency.

## 3. Meshy AI and comparable text-to-3D / image-to-3D (requires setup)

**State of the field as of 2026:** Meshy is on version 7 (`meshy-7` since 12 August 2026), with
Meshy 6 and a faster Meshy 6 Lite still offered; generation takes on the order of a minute.
Comparable services include Tripo (Tripo Studio bundles mesh, topology, segmentation, PBR
texturing, auto-rig and export), Rodin, Luma and the open Hunyuan3D line.

**What Meshy exposes:** target polycount from 1k to 300k triangles or quads; topology type
(triangle or quad); export as GLB, FBX or OBJ; PBR texture generation. API generation runs roughly
$0.10 to $0.30 per model, against Rodin at $0.50+ and Luma at about $1.00. Plans: free at 100
credits per month under **CC BY 4.0**; Pro $20 per month for 1,000 credits and Studio $60 per
month for 4,000, both with API access and private assets.

**Genuinely good at:** producing a recognisable, characterful **shape** from a description or an
image, fast; static props, background objects, grayboxing and prototyping; and **image-to-3D from
your own concept image**, which gives far more control than text-to-3D and is the mode to prefer.

**Bad at, structurally rather than temporarily:**

- **Topology.** These systems reconstruct an implicit field and extract polygons with something
  like marching cubes. The output is uniform triangulation that minimises surface error with
  **zero awareness of creases, joints or deformation**: no edge flow, no clean silhouette loops,
  dense in flat areas, sparse where the detail is.
- **UVs.** Often absent, overlapping, or auto-unwrapped into hundreds of tiny islands.
- **Textures.** 1K-4K with baked-in lighting and shadow, in a photoreal idiom that will not match
  a stylised game. De-lighting is an ill-posed problem and the albedo typically still contains
  shading.
- **Scale and orientation.** Arbitrary. Assume nothing.
- **Bevels.** Generated hard-surface edges are either razor sharp or mushy, never your consistent
  0.015.
- Anything that must deform or animate.

**Where the raw output fails a browser-game budget:** 50k-300k triangles for one prop against a
50k whole-scene budget; a 2K or 4K PBR set per prop at 21-85 MB of VRAM **per prop** against a
32 MB whole-game budget; one unique material per prop against a 6-material scene budget; a
photoreal texture idiom against a flat stylised palette; megabytes per GLB against a 30 KB
per-prop target. **Two to three orders of magnitude off.** That is not a reason never to use it.
It is the reason the cleanup pass is mandatory and should be automated.

**The cleanup path is the 11-step chain in
[blender-pipeline.md](blender-pipeline.md) section 5. Without it, do not use generated 3D at all.**

**Before shipping anything from a generator, it needs:** origin and scale normalised to the game
unit; triangles inside the tier budget (300-1,200 secondary, 1,500-3,000 hero); the global bevel
re-applied; its generated textures discarded and its colour restyled to the palette, preferably as
vertex colours; AO re-baked with the project's settings; a license record; and a budget check that
fails the build if it misses.

**AI retopology** is now offered by Meshy and Tripo, but for static props at 300-1,200 triangles
**Blender's Decimate modifier is as good and it is free, local, scriptable and deterministic.** AI
retopology earns its money on deforming characters, which environments do not have.

## 4. CC0 libraries, which are the best option here

**Poly Haven** (models, textures, HDRIs), **ambientCG** (textures), **Kenney** (stylised low-poly
game assets, exactly this idiom), **Quaternius**, **KayKit**. All CC0 / public domain: free for
commercial use, **no attribution required**.

**For a stylised low-poly browser game, Kenney and Quaternius are a better starting point than any
generator**: already low-poly, already flat-shaded, already sharing a palette, already a few
hundred triangles, and legally unambiguous. Restyle to your palette and you are done. This is the
highest-value option in this whole area and it is free. Do not skip past it to a generator because
the generator is more interesting.

**Not useful here:** photogrammetry and scan libraries (photoreal and high-poly; occasionally
useful as a source for baking curvature and AO, rarely worth it); Substance-style procedural
texturing (powerful, but the output is a texture set, which is the thing you are trying not to
ship, and Blender's own procedural nodes baked to a small texture cover the same ground for free
and stay in the repo); AI upscaling (you are downscaling, not upscaling); and
normal-map-from-albedo generators, which infer height from luminance and therefore hallucinate
whenever the albedo has painted-in light or dark pigment. If you need a normal map, generate it
from real geometry in Blender.

## 5. Keeping generated assets looking like one world

Style drift across generations is the obvious and near-certain failure mode. Five mechanisms, in
order of effectiveness:

1. **The deterministic finishing pass.** Every asset gets the same bevel width, the same AO bake
   settings, the same palette quantisation, the same triangle budget tier. **This does most of the
   work and it does not depend on the generator cooperating.** Style coherence is not achieved by
   prompting carefully; it is achieved by every asset going through one script.
2. **Palette quantisation enforced in the build.** Nothing enters the repo with a colour that is
   not in the palette table. A build step that fails on an off-palette colour is worth more than
   any amount of prompt engineering.
3. **A fixed style prefix in every prompt**, stored in the repo next to the assets, naming the
   idiom (stylised low-poly, flat shaded), the palette by name and hex, the lighting (soft key
   from upper left, cool ambient), the camera (three-quarter, orthographic-ish), the background
   (flat neutral), and the negatives (no text, no lettering, no logos, no watermark, no emoji, no
   photorealism, no complex surface detail).
4. **Generate in batches from one seed image.** Use image-to-3D and image-editing modes with a
   reference from the existing game rather than fresh text-to-image each time; coherence within
   one batch is far higher than across sessions.
5. **A contact sheet review.** Render every prop in the game, in one grid, at the fixed camera
   angle, with the game's lighting, as a build artifact. **Drift is obvious in a grid and
   invisible one prop at a time.** This is cheap to automate and it is the review mechanism that
   actually catches drift.

## 6. Reproducibility, licensing and cost

**Reproducibility.** Generated output is not reproducible from a prompt. Handle it like a vendored
dependency, not like source. Commit the **finished asset** (the post-cleanup GLB or PNG), because
it is the artifact the game loads. Commit alongside it, in a sidecar JSON: the tool and version,
the exact prompt or source image hash, the seed if one exists, the date, and the license. Commit
the **cleanup script** and its parameters, because that part *is* reproducible and it is where all
the style decisions live. **Never make a build step call a generation API**; builds must be
deterministic and offline.

**Licensing.**

| Source | License | Safe to ship commercially? |
|---|---|---|
| Kenney, Quaternius, KayKit, Poly Haven, ambientCG | CC0 | **Yes**, no attribution required |
| **Meshy free tier** | **CC BY 4.0** | Yes but **attribution is required**. This is a trap: a free-tier asset drags an attribution obligation into the repo |
| Meshy Pro / Studio | Paid plan, private assets | Yes, per their terms. Check the current terms at the time of use |
| Gemini / Nano Banana output | Per Google's current terms for the tier in use | **Check the current terms at the time of use.** They change, and output may carry a SynthID watermark. Do not assert a position on this from memory |
| Anything from a marketplace | Read the license | Watch for "no redistribution in a competing asset pack" and "no use in NFT/AI training" clauses |
| Scraped or scanned real-world branded objects | Trademark risk regardless of the 3D license | **No** |

Practical rules: keep a `LICENSES.md` or a per-asset sidecar with source and license for every
non-generated asset, so a shipped game can answer the question in one minute. **Prefer CC0 and
self-generated over CC BY**; avoiding an attribution obligation is worth more than the time saved.
Never ship a generated asset containing a recognisable brand, logo, character or real person. And
never ship generated lettering, which is also a legal risk because generated glyph shapes can
resemble licensed typefaces.

**Cost.** Generation is cheap in dollars ($0.10-$0.30 per 3D model, fractions of a cent per image)
and expensive in curation and cleanup time. **Budget the human time, not the API bill.** A
generated prop that takes 40 minutes to clean up is worse than a scripted prop that takes 20
minutes to write and can be re-parameterised forever.
