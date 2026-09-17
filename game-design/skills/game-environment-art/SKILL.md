---
name: game-environment-art
description: >
  Environment art, set dressing and scene art direction for browser games, 2D and 3D.
  Covers the mobile performance model (draw calls, materials, texture memory), the cheap
  tricks that buy the most perceived quality (baked AO, contact shadows, global bevels,
  one light plus fake rim, atlasing, fog, CSS overlay post), art fundamentals for a
  programmer with no art training (silhouette, value, focal hierarchy, palette, warm/cool,
  density rhythm, environmental storytelling), production technique (modular kits, trim
  sheets, procedural generation, Blender scripting and glTF export), generative tooling
  (Nano Banana, Meshy, CC0 libraries) and a critique checklist. Load when building or
  reviewing world art, props, materials, lighting, textures, tilesets, parallax or
  backdrops, when setting an asset budget, or when a scene works but does not look good.
---

# Game Environment Art

Environment art is everything the player sees that is not UI and not the character they
control: the world, the props in it, the light on it, the colour of it. This skill is about
making that look intentional on a mid-range phone, in a browser, at 60 fps.

Two audiences: a model acting mid-task, and a programmer who can drive Blender but has no
formal art training. Art vocabulary is explained the first time it is used.

Act from this file. Open a reference when you need the long table or the recipe.

| Need | File |
|---|---|
| Full budget tables, texture arithmetic, Babylon static-scene checklist, instrumentation, glTF delivery, 2D budgets | [references/budgets.md](references/budgets.md) |
| Blender scripting, baking, VERIFIED glTF export option names, the generated-asset cleanup pass | [references/blender-pipeline.md](references/blender-pipeline.md) |
| Tilesets, autotiling, parallax layer tables, sprite atlases, 2D lighting | [references/two-dimensional.md](references/two-dimensional.md) |
| Nano Banana, Meshy, CC0 libraries, licensing, style-drift control | [references/generative-tooling.md](references/generative-tooling.md) |
| Stylisation approaches, matcaps, outlines, the style constants file, modular kits, scatter | [references/stylisation-and-kits.md](references/stylisation-and-kits.md) |
| Full symptom / cause / fix table | [references/failure-modes.md](references/failure-modes.md) |

---

## 1. The performance model, because it reframes every art decision

### 1.1 You are not triangle-bound. You are draw-call and bandwidth-bound.

**RULE: spend triangles freely. Spend draw calls, materials, unique textures and fullscreen
passes like they are money.**

A draw call is one `engine.draw`: bind a vertex buffer, an index buffer, a shader program
and a set of textures, then tell the GPU to go. In a browser that path runs through
JavaScript and then the WebGL validation layer before it reaches the driver, so per-call
overhead is far higher than in a native engine. Meanwhile a mid-phone GPU chews tens of
thousands of triangles without noticing, provided they arrive in a few big batches. Mobile
GPUs are tile-based: they bin geometry into small on-chip tiles. What kills them is memory
bandwidth, meaning large textures, overdraw from transparency, and fullscreen post passes
that store and re-load the whole framebuffer.

The consequence, and it is the most useful sentence here:

> 200 separate small meshes at 200 triangles each (40k triangles, 200 draw calls) runs
> **worse** than one merged mesh of 80k triangles in 1 draw call.

### 1.2 The budget (mid-range Android, browser, 60 fps)

| Resource | Safe | Warning | Hard ceiling |
|---|---|---|---|
| Draw calls per frame | under 50 | 100 | 150 |
| Triangles on screen | 30k-50k | 65k | 100k |
| Distinct materials | 3-8 | 12 | 20 |
| Distinct shader programs | 2-4 | 6 | 8 |
| Texture memory (all textures + mips) | under 32 MB | 64 MB | 96 MB |
| Total asset download | under 2 MB | 5 MB | 8 MB |
| Realtime shadow-casting lights | 0-1 | 2 | 3 |
| Realtime lights total | 1-2 | 3 | 4 |
| Fullscreen post passes | 0-1 | 2 | 3 |

**Budget for the throttled state, not the first ten seconds.** A phone that holds 60 fps for
30 seconds can fall to 20 fps once the SoC throttles. *These come from the wider WebGL and
mobile-AR literature; Babylon deliberately publishes no numeric ceiling of its own. See
section 10.* 2D budgets are in [references/budgets.md](references/budgets.md).

### 1.3 Texture memory arithmetic, where budgets die silently

**RULE: GPU memory for an uncompressed RGBA texture is `width * height * 4 bytes * 1.33`
(the 1.33 is the mip chain). Download size tells you nothing about it.**

| Texture | Download (PNG) | GPU memory with mips |
|---|---|---|
| 256x256 | ~20 KB | 0.33 MB |
| 512x512 | ~80 KB | 1.33 MB |
| 1024x1024 | ~200 KB | 5.3 MB |
| 2048x2048 | ~600 KB | 21 MB |
| 4096x4096 | ~2 MB | 85 MB |

A 200 KB PNG at 2048x2048 becomes roughly 21 MB of VRAM. One 4K texture is more than the
entire mobile budget. **Cap non-hero textures at 1024.** List every texture and add these
numbers up before shipping: a two-minute arithmetic exercise that catches what no profiler
phrases clearly. Two traps:

- **KTX2 / Basis Universal (`KHR_texture_basisu`) stays compressed in VRAM**, roughly 4-8x
  less GPU memory. PNG and WebP are decompressed to raw RGBA on upload, so WebP saves
  **download** and KTX2 saves **memory**. They are not substitutes.
- **A runtime `DynamicTexture` can never be KTX2.** It is always uncompressed RGBA, so a
  2048x2048 canvas texture costs 21 MB whatever you draw on it. Size canvas textures by what
  they need, not by habit.

### 1.4 The cost ladder

When two techniques look similar on screen, prefer the one higher in this list. **Free:**
composition, framing, value contrast, palette, placement, density rhythm, mesh reuse by
rotation and mirroring. **Near-free:** vertex colours, baked AO, 2-4 triangle bevels, fog, a
vertex-coloured gradient dome. **Cheap:** one shared material and atlas per set, thin
instances, merged static geometry, a 256x256 ramp, a blob shadow quad. **Moderate:** one
shadow-casting directional light at 512-1024 refreshed once, a second material for emissives, a
1024 atlas. **Expensive:** each extra material, each extra realtime shadow light, each
fullscreen post pass, alpha-blended overdraw, a 2048+ texture, a `PointLight` with shadows (6
cube faces, 6 shadow renders). **Ruinous on a phone:** SSAO, realtime reflections and probes,
multi-light PBR with IBL, per-prop unique materials, large alpha-blended particle systems.

Scale at the expensive end: two shadow-casting point lights over 10 objects adds roughly 120
draw calls. Bloom profiles as the most taxing post pass in real mobile games.

### 1.5 Perceived quality does not come from fidelity

What players read as "this looks good", in order: **clear silhouettes, a readable value
structure, contact shadows, coherent colour, intentional composition.** None are expensive.
Texture resolution, polygon density and PBR correctness are far down the list and are where
all the cost is.

---

## 2. If you can only do five things

Ranked by visual return per unit of performance and effort. Do them in this order.

1. **A contact shadow under every prop, plus baked AO in vertex colours.** The difference between
   "floating coloured shapes" and "a room". About 2 triangles per prop and 4 bytes per vertex; 1
   draw call for the whole scene if the blobs are merged.
2. **One material and one atlas per prop set, everything static merged.** This is what makes the
   game run at all, and the palette discipline it forces is also a visual win. Cost is negative: it
   removes draw calls. **Make this decision on day one**; cheap early, painful to retrofit.
3. **Bevel every hard edge at one fixed world-space width, and delete unseen faces.** The
   difference between "programmer boxes" and "designed objects". Roughly +24 triangles per box-like
   prop, more than paid for by the deleted faces.
4. **A locked palette, hemispheric ambient with a warm key and a cool ground, and scene fog tinted
   to the background.** This is what makes 30 separately-made props feel like one world. Runtime
   cost: zero.
5. **Compose the fixed camera deliberately:** value hierarchy, density rhythm, one reserved accent
   hue for interactives, empty space around the focal point. Free, and it is what reviewers
   actually respond to.

Just missed the cut: a gradient sky, per-instance colour variation, a cel ramp texture.
**Explicitly not in the top five, and why:** bloom (bandwidth), real shadow maps (a whole extra
render for something blob shadows mostly deliver), normal maps (a fixed camera makes them nearly
pointless), PBR (cost without payoff in a stylised look), 2K textures (memory).

---

## 3. The cheap tricks, with defaults

Each entry: what it buys, what it costs, the failure mode when overdone, and a value you can
type in without deliberating.

### 3.1 Baked AO in vertex colours (3D)

**Ambient occlusion (AO)** is the soft darkening where surfaces meet: the crease where a
wall meets a floor, under a shelf lip, inside a mug. It tells the eye where things touch.
Without it, a flat-shaded scene looks like coloured paper cutouts.

- **Buys:** the single biggest readability win in stylised 3D.
- **Costs:** 4 bytes per vertex. No texture sample, no draw call, no material. Survives glTF
  export as `COLOR_0`. Compare SSAO, a fullscreen pass plus a depth prepass, unaffordable here.
- **Defaults:** ray distance 0.3-1.0 world units at prop scale. Remap so the darkest
  occlusion multiplies albedo by **0.55-0.70**, never to 0. Fully black creases read as dirt.
- **Overdone:** crunchy black seams on every edge; the model looks sooty.
- **Traps:** baking produces black spots on degenerate faces and badly triangulated n-gons,
  so triangulate and merge by distance first. Bake **after** final scale. In Babylon,
  `mesh.useVertexColors = true`; there are historical bugs with vertex colours on **thin**
  instances specifically, so test that combination.

### 3.2 A contact-shadow blob under every prop (3D and 2D)

A contact shadow is the dark patch directly under an object where it meets the ground. Without it
props hover; with it they sit. **On a fixed camera there is no motion parallax, so contact shadows
are not polish, they are the depth system.** In 2D the rule is identical: a soft ellipse under a
sprite is the difference between standing and floating.

- **Costs:** 2 triangles, sharing one material and texture with every other blob. Merge them or
  thin-instance them and the whole scene's contact shadows cost **1 draw call**. A 1024 shadow map
  is 4 MB of depth texture plus a full extra render of every caster.
- **Defaults:** a radial white-to-transparent disc `DynamicTexture` at **64x64** (128 max), on a
  plane rotated flat, **0.01 world units** above the floor, radius **0.85-1.0** of the prop
  footprint, centre opacity **0.25-0.45** with a squared or cubed falloff,
  `material.disableLighting = true`. For an off-vertical key, offset the blob 0.1-0.3 units down
  the light direction and squash it along that axis.
- **Overdone:** you can see the disc, meaning the falloff is too hard or the opacity too high.
  Blobs are alpha-blended overdraw, so keep them non-overlapping and under a few hundred.
- **Cheaper still:** bake the shadow into the floor's vertex colours for anything that never
  moves. Zero runtime cost. Use it for fixtures, keep blobs for what the player places.

*These blob defaults are conventional practice, near-universal in shipped games and essentially
never documented with numbers. A starting point, not a citation.*

### 3.3 A global bevel on every hard edge (3D)

Real edges have a tiny radius that catches a highlight. A beveled edge picks up a bright line
from the key light and a dark line from AO, which makes form read instantly. **Consistent
bevel width is the main visual separator between amateur and professional low-poly hard
surface**, and this is the best triangles-to-perceived-quality trade available.

- **Costs:** 2 triangles per edge at 1 segment; a cube goes 12 to 36 triangles. At a 50k
  budget you can afford it on literally every prop.
- **Defaults:** width **a fixed world-space value for the entire game**, not a per-object
  percentage. For a world where a human is 1.8 units tall, **0.015 world units**. Segments
  **1** (2 only on hero props, never 3). Angle limit **30 degrees**. Clamp overlap on, harden
  normals on.
- **Overdone:** a bevel wider than the smallest feature eats the shape. A **percentage**
  bevel makes a big crate and a small crate look like different materials. Always
  world-space, always the same number.

### 3.4 One light plus ambient plus a fake rim: a three-point rig for 1.5 lights

**Vocabulary.** *Key* is the main light; it defines form and shadow direction. *Fill* is a softer
light from roughly the opposite side that keeps shadows off black. *Rim* (back light) comes from
behind and separates the subject from the background.

**RULE: key = one `DirectionalLight`. Fill = `HemisphericLight` ambient. Rim = faked in the
material.** That is the full three-point rig for the cost of 1.5 lights.

- **Key:** intensity **0.8-1.0**, elevation **35-55 degrees**, azimuth **25-45 degrees** off the
  camera axis so every box shows a lit face, a mid face and a dark face. That three-tone box is
  the whole reason a scene reads as 3D. Straight-on light flattens everything.
- **Fill:** `HemisphericLight` intensity **0.35-0.55**, `groundColor` a desaturated floor colour,
  `diffuse` a desaturated sky colour. That one choice is what makes a scene feel like it is in a
  place rather than a void, and it is free.
- **Colour separation:** key slightly warm (`#FFF0DC`), ambient slightly cool (`#C8D8F0`). Warm
  light plus cool shadow is the oldest cheap trick in representational art and is where most of
  "looks expensive" comes from.
- **Fake rim:** `pow(1.0 - saturate(dot(N, V)), k)` added to emissive. Under 5 ALU instructions, no
  extra light or pass. Exponent `k` **2.0-4.0**, intensity **0.15-0.4**, rim colour the cool
  counterpart of the key. Apply it to interactive and hero props only, where it doubles as a
  gameplay signal; rim on everything reads as a shader demo.
- **Failure:** key with no ambient gives pitch-black shadow sides and reads as a 1998 tech demo;
  ambient too strong and everything goes flat. **If the scene looks flat, the ratio is wrong before
  the geometry is wrong.**
- **If you must have one real shadow:** map size 512 or 1024, `filteringQuality = QUALITY_LOW`,
  `refreshRate = REFRESHRATE_RENDER_ONCE` for a static scene, casters restricted to a few heroes.

**Lighting painted into the albedo is cheaper still and often better.** For anything the camera
never circles, bake the light into base colour and set `material.disableLighting = true`, which
removes the lighting maths from the fragment shader; an unlit material is the cheapest material
there is. Failure mode: half a scene baked and half dynamically lit will not match and reads as a
bug. Pick one per scene.

### 3.5 Atlasing and material economy

**RULE: every prop in a themed set shares one material and one texture atlas. Aim for 3 to 8
materials in the whole scene.** Material count hurts more than triangle count in a browser:
each distinct material is a shader bind, a uniform upload and a break in batching, so meshes
that share geometry but not material cannot be merged or instanced together.

A five-material budget that covers a whole scene: `env_opaque` (walls, floor, most props,
one atlas, vertex colours on); `env_emissive` (signs, screens, unlit plus emissive);
`env_cutout` (plants, decals, alpha test); `env_blend` (blob shadows, glows, drawn last);
`ui_text` (DynamicTexture surfaces, unlit).

**Atlas defaults:** **1024x1024** per material; go to 2048 only on measured evidence, since
1024 is 5.3 MB with mips and 2048 is 21 MB. **4 px padding** between islands and **4 px of
edge dilation**, or mipping bleeds neighbours into each other at distance. On a fixed camera,
consider disabling mips entirely, since screen-space texel density barely varies.

A **trim sheet** is an atlas of horizontal strips of reusable detail (a moulding, a row of
bolts, a panel edge). Meshes slide their UVs along a strip and reuse it at any length, so one
1K sheet can texture a whole building kit. Keep every strip at the same real-world scale so a
bolt on one piece matches a bolt on the next.

### 3.6 Instancing and static merging

**RULE: anything that never moves, never animates and shares a material should be one mesh.**

```js
const merged = BABYLON.Mesh.MergeMeshes(staticMeshes, true, true, undefined, false, true);
merged.freezeWorldMatrix();
merged.doNotSyncBoundingInfo = true;
merged.alwaysSelectAsActiveMesh = true;
scene.freezeActiveMeshes();   // once everything is built
material.freeze();
```

Merging destroys per-object culling and per-object picking. On a fixed camera the culling loss is
a pure win; for picking, keep an invisible proxy or do a grid lookup from the tap position, which
for a grid-based game is arithmetic. `InstancedMesh` gives one draw call plus a JS object per copy
you can address and tint; **thin instances** pack matrices into one typed array with no JS object,
much cheaper for thousands and much more restrictive. Working rule: under ~50 static copies,
**merge**; 50-5,000 static copies, merge if the vertex count allows, otherwise thin instances;
copies that move or are added at runtime, instances if you must address them. **Per-instance
colour is the cheapest variety there is:** 4 floats per instance, no extra draw call
(`mesh.registerInstancedBuffer("color", 4)`).

*Contested, and worth one measurement: public sources conflict by about 4x on merged mesh versus
thin instances, including 60 fps merged against 15 fps thin-instanced. None is a controlled
benchmark on mid-range Android. Measure once in your project, then state it as a project fact.
See section 10.*

### 3.7 Variation from one mesh

**RULE: one mesh per prop archetype. Variety comes from transform and tint, not new meshes.** A
shelf of five identical boxes reads as a mistake; the same box at 0.9, 1.0 and 1.15 scale, rotated
0/90/180, with three tints, reads as five different crates. **Defaults:** 3-5 scale variants within
**0.85x to 1.2x** (never past 1.3x, or the proportions read as a different object); 90 degree
rotation steps for grid-aligned props plus **+/- 4 degrees** random yaw on anything casually
placed; per-instance hue shift **+/- 8 degrees** and value shift **+/- 6 percent**, no more.
**Babylon trap:** a negative scale on an instance makes the engine drop back-face culling for that
instance, so mirror by rotating 180 degrees where you can.

### 3.8 Tiling plus a detail layer

A large surface reads best as a low-frequency base (the tile pattern, 1-2 repeats across the
surface) multiplied by a high-frequency detail layer (grain or noise at 8-20 repeats). Two
small textures, two samples, and it kills the "one obvious tile" look. **Defaults:** base
256x256, detail 128x128 greyscale, detail strength **0.06-0.15**.

Never put a distinctive feature (a bright knot, a strong crack) in a base tile. The eye finds
it and the grid becomes visible instantly. Distinctive features belong in a sparse decoration
layer.

### 3.9 Gradient ramps

A 1D ramp texture (dark left, light right) used as the lighting response of a toon material
is what makes cel shading look art-directed rather than default. You control where the
*terminator* (the line between lit and unlit) falls, how many bands there are, and what
colour the shadow is, so you can put cool blue-violet in shadow and warm cream in light with
no extra lights. **Costs 1 KB.**

**Defaults:** width 128 or 256, height 1 (or 4 to stack ramps and select by V). 2-3 bands for
a hard cel look, one soft step for a painted look, step at **0.45-0.55** of the range. Make
the dark end a saturated cool colour at **40-55 percent** of the light end's value, not grey.
Second use: a ramp indexed by height or depth gives a free colour gradient across a scene.

### 3.10 A flat colour usually beats a texture

**RULE: if a surface occupies under about 64x64 screen pixels at the real camera distance and
carries no readable pattern, use a flat colour plus vertex-colour AO.** At phone size a 512
wood texture is sampled down to a grey-brown mush: it costs memory, a sampler and an atlas
slot, and delivers noise.

**Test:** screenshot at real device resolution, crop the prop, blur by 1 pixel. If you cannot
name the material, the texture is doing nothing; replace it with its average colour.

Decide per surface in this order and stop at the first that works: palette flat colour; flat
colour plus vertex-colour AO and gradient; a region of the shared atlas; a tiling texture; a
dedicated texture (hero props only).

### 3.11 Fog

**RULE: turn on fog tinted to the background colour, even indoors where you think you do not
need it.** It does three things at once: *atmospheric perspective* (distant things lose
contrast and shift toward the background colour, which is how the eye reads depth); palette
unification, because every distant object is pulled toward one colour, which is the cheapest
way to make a bag of mismatched props feel like one world; and it hides draw distance.
**Costs** a handful of ALU in the existing shader. No pass, no texture.

**Defaults:** `FOGMODE_EXP2`, density tuned so the far edge of the playfield is **20-35
percent** fogged. `scene.fogColor` **must equal the background colour at the horizon** or
distant objects sit on the sky as wrong-hue silhouettes. With the camera 20 units out, start
at `fogDensity = 0.012` and tune by eye. **Overdone:** if a reviewer can name the fog, it is
too strong.

### 3.12 Gradient sky, not a cubemap

A flat single background colour reads as unfinished; a **3-stop** vertical gradient reads as
atmosphere and gives you a value field to compose against. Horizon a warm desaturated light value,
zenith a cooler mid value, optionally a darker band at the bottom, the whole gradient inside a
narrow value band so it never competes with the subject. A cubemap at 512 per face is 6 MB; a
vertex-coloured dome with 32 verts and no texture is the cheapest option; a 1x256 `DynamicTexture`
on an inward-facing sphere costs 2 KB; a CSS gradient behind a transparent WebGL canvas costs
nothing at all.

### 3.13 Post-processing: the CSS overlay is the free substitute

**RULE: budget zero or one fullscreen post pass on a phone. If you get one, spend it on a
combined vignette plus colour grade, never on bloom.** Post is a bandwidth problem: full-frame
stores, loads and sampled intermediates all cost trips through external memory, the scarcest
resource on a tile-based GPU.

**A browser game has a compositor that native engines do not.** That is the headline here.

| Want | Expensive way | Cheap way |
|---|---|---|
| Vignette | Post pass | A CSS radial-gradient **over the canvas in DOM**. Zero GPU cost |
| Colour grade | 3D LUT pass | Bake the grade into the palette before shipping. Zero |
| Bloom on neon | Bloom pass | A soft additive glow quad behind each emissive. 2 triangles each |
| Depth of field | DOF pass | Do not. Use fog and value contrast |
| Ambient occlusion | SSAO pass | Baked vertex AO plus blob shadows (3.1, 3.2) |
| Screen shake / flash | Post | CSS transform or a CSS overlay on the canvas element |

Keep it to **one** overlay layer; each extra layer costs browser compositing. If you do run a
real blur-like pass, run it at half resolution, which can roughly double frame rate in a
fill-rate-bound scene.

### 3.14 What a fixed camera lets you delete

A fixed camera is the biggest cost saving available, because it deletes whole categories of
work rather than optimising them.

**Delete outright:** back and underside geometry (typically 30-50 percent of triangles on a
box-heavy interior); LODs, since there is one distance; frustum culling logic, since
everything is in frustum; mipmaps on most textures; normal maps, whose contribution at one
fixed angle with one fixed light is a static pattern you can bake into vertex colours;
parallax, POM, reflection probes, DOF; and any correctness in the shading model, because
nothing will ever be seen from an angle that exposes it.

**Spend the savings on:** bevels everywhere, baked AO and contact shadows, silhouette
resolution on the outline-facing side, more prop variety, and a hand-tuned gradient and
colour treatment, because the one picture is all you have.

**Trap:** seeing only one angle makes it easy to build geometry that is subtly broken and
never notice. Put a debug orbit camera behind a flag so a reviewer can rotate, but never
optimise for it.

### 3.15 Cards, billboards and overdraw

Foliage, smoke, distant crowds and light shafts are textured quads, not geometry: a plant of 6
crossed cards reads better at phone size than a 2,000 triangle modelled plant and costs 12
triangles. **The cost of a card is not its triangles, it is overdraw**, the GPU shading the same
pixel several times because several transparent quads cover it, which on tile-based mobile GPUs
defeats hidden-surface removal. So **trim the card to the opaque silhouette** (a 6-10 vertex
polygon hugging the visible shape, not a quad that is 70 percent empty alpha), and keep total
transparent coverage under roughly **1.5x the screen** summed. **Defaults:** 3 crossed cards for a
small plant, 6 for a hero; texture 128x128 or 256x256 in the shared atlas; alpha cutoff 0.5.

*Alpha test versus alpha blend is contested: on older mobile GPUs alpha test breaks early-Z and is
slower than blend; on modern Adreno, Mali and Apple GPUs cutout is generally better for foliage.
Sources conflict and are hardware generations old. Measure on target.*

### 3.16 Dither large gradients

8-bit-per-channel gradients across a large screen area band visibly, especially on OLED phones. A
**0.5-1.5 / 255** ordered dither removes it entirely, as a 4x4 Bayer lookup in the shader or baked
into the gradient when you draw it on the canvas. Free either way. Grain for style: 2-4 percent
opacity and **static**, because animated grain on a phone reads as video compression noise.

---

## 4. Art fundamentals

These transfer to any engine and cost nothing at runtime, which makes them the highest return
items in this skill.

### 4.1 Silhouette first

*Silhouette* is the outline with all interior detail removed. The human visual system
identifies objects by outline before it processes surface.

**RULE: design and review every prop as a black shape on white.** If it is unrecognisable in
silhouette, no amount of texture will save it. **Automate the test:** swap every material for
an unlit black `StandardMaterial`, set the clear colour to white, screenshot. Props that merge
into one blob need separation; props you cannot name need shape work.

**Corollary:** put triangles on the parts of a prop that break the outline against the
background from the real camera angle. A teapot needs its spout and handle resolved; its body
can be 8-sided. A prop occupying roughly 100x100 screen pixels needs curved silhouette edges
at **12-16 segments**; at 40x40 pixels, 6-8. Interior curvature can be half that.

### 4.2 Value structure

*Value* is how light or dark something is, independent of hue. Convert a screenshot to
greyscale and value is what remains.

**RULE: assign every element to one of three value bands and keep them separated.** A classic
allocation is background 65-85 percent lightness, midground 40-60 percent, foreground 15-35
percent, or the inverse. **The focal point is the one place where two bands touch at high
contrast.** Muddy values hurt shape discrimination badly at small scale. **Test:** if you
cannot tell foreground from background in greyscale, colour is doing work that value should
be doing.

### 4.3 Focal hierarchy

**RULE: decide in advance the three things the player should look at, in order. Then build
exactly three high-contrast moments.** Test from the field: when a player enters a scene, can
you predict the three points their eye lands on in the first three seconds? More than three
first-look focal points means the scene is over-dressed.

Tools for directing the eye, all free: highest **value contrast** (strongest by a distance);
highest **saturation**, reserved for the focal point; **convergence**, where lines in the
scene point at it; **isolation**, negative space around it; **warm against cool**, since warm
advances and cool recedes; and **motion**, because in a static scene the only moving thing
owns the eye.

**Negative space:** leave **25-40 percent** of visible floor area empty. Density only reads as
density when there is emptiness to compare it against.

### 4.4 Palette construction

**RULE: define the entire game's colour in one constants file. No prop defines its own colour.
Every material, vertex colour and canvas gradient reads from the table.** This is the mechanism
that makes many props feel like one world, and the only reliable one when assets come from
different processes (scripted, imported, generated).

Shape of a workable palette: **6-10 hues** for the whole game (8 is a good default; sources range
from 4 to 16, so this is taste, not law); **3-5 values per hue**, giving 24-40 swatches; **1
accent hue**, reserved, on under 10 percent of screen pixels; **60/30/10** as a starting
distribution of dominant, secondary and accent.

**RULE: vary value widely, vary saturation narrowly, vary hue narrowly.** Most amateur palettes
do the opposite.

| Band | HSL range |
|---|---|
| Scenery saturation | 25-55 percent |
| Accent / interactive saturation | 70-90 percent, and nothing else goes there |
| Scenery lightness | 30-75 percent |
| Focal and emissive lightness | below 20 or above 85, reserved |

Avoid deeply saturated colours on large surfaces: they eat the lighting range, so a light can no
longer make them meaningfully brighter or darker. And **keep the ground plane darker than the
walls**: it stops the floor competing and makes props pop off it.

### 4.5 Warm/cool separation

**RULE: light warm, shadow cool (or the deliberate inverse). Never neutral grey shadow.**
Hue separation **20-40 degrees** between light and shadow: less is invisible, more reads as
two light sources. Shadow value at **40-60 percent** of lit value, never 0. Free
implementation: a cool `diffuse` and warmer `groundColor` on the hemispheric ambient plus a
warm directional key. Or bake it, multiplying the shadow side of your vertex colours toward a
cool hue rather than toward black.

### 4.6 Colour as a signal

**RULE: reserve specific colours for gameplay meaning and never use them decoratively.** The
canonical version: only explosive barrels are red. Pick one accent hue for "you can touch this",
one for "this needs attention", one for "locked", and let nothing in the scenery use those hues at
high saturation. **Then add a second, non-colour cue** (a scale pulse, a rim light, an outline),
because roughly 8 percent of male players have some colour vision deficiency and colour alone is
not accessible.

**Progression.** A *colour script* is a strip of thumbnails, one per beat of the game, showing only
dominant colours and values. Write it before building anything. Give each stage a documented
palette subset and an emotional intent, and **change one variable per stage**: hue family, or value
key, or saturation. Changing all three makes stages feel like different games. **Cheap progression
trick:** keep meshes and textures identical between stages and change only ambient colour, fog
colour and the palette lookup, which is a whole visual act change for zero new assets. Time of day
is the same architecture: interpolate between 3-5 authored presets each holding key colour and
intensity, ambient diffuse and ground, fog colour and density, background gradient stops and a
global tint. All uniforms and constants, so zero extra draw calls and no shader recompile.

### 4.7 Emissive as a focal tool

Emissive (self-illuminating) surfaces are the strongest and cheapest focal tool you have. An
emissive colour is free; an emissive texture is one more sample; a glow as an additive quad is
2 triangles; a glow as bloom is your whole post budget.

**Defaults:** emissive intensity such that the surface is **1.3-2.0x** the brightest lit
surface. Past about 2.5x without bloom it clips to white and loses its shape. Put a soft
additive quad behind each emissive at **30-50 percent** opacity and **2-3x** the sign's size,
using the same radial disc as your blob shadows in a different colour. That is bloom for 2
triangles.

**Signage:** build the sign as an emissive shape and render the *text* onto a `DynamicTexture`
as real text with `ctx.shadowBlur` for glow. **Never generate an image with words in it.**

### 4.8 Density rhythm and clustering

**RULE: props go in clusters of 2-4 related objects with empty space between clusters. Never
evenly spaced, never uniformly distributed.** Proximity and similarity make the eye group
objects, so a cluster reads as one meaningful unit rather than N separate objects. **Uniform
density is the single most common amateur tell.**

**The fractal method, about eight lines of code:** place one object, then duplicate it shrunk,
rotated and slightly offset, and repeat.

**Breaking a grid without breaking the mechanic:** random yaw **+/- 3 to 6 degrees** and
position jitter **+/- 5 to 10 percent of a cell** on non-structural props; vary the *pattern*
of occupied cells rather than the cell size (occupied-occupied-empty-occupied reads better
than alternating). *Contested:* jitter can obscure a grid that is itself the mechanic. The
compromise that works is to jitter the visual mesh inside the cell, keep the interaction
hitbox exactly on the grid, and keep structural elements perfectly aligned.

### 4.9 Environmental storytelling

**RULE: every cluster answers "who was here and what were they doing".** A stack of crates
with one open and one item beside it tells a story. Three closed crates in a row tell nothing.

Cheap ways to imply use: one item out of alignment in an otherwise tidy row; one item of a set
missing (four chairs at a five-chair table); wear concentrated where hands and feet go;
stacking and leaning rather than standing; and **a path worn through the floor pattern**,
which is a vertex-colour darkening and does more for "this place is used" than a dozen props.

Density heuristic: one is not enough, three is overkill, **two is effective**. Two or three of
a storytelling detail, placed apart, beats a pile.

**Hero, secondary, filler.** Budget detail in tiers, one hero per view.

| Tier | Count per scene | Triangles each | Texture | Where detail goes |
|---|---|---|---|---|
| Hero | 1-2 | 1,500-3,000 | Own atlas region, maybe its own emissive | Silhouette, colour accent, motion |
| Secondary | 3-8 | 400-1,200 | Shared atlas region | Silhouette only |
| Filler | 20-60 | 50-300 | Flat colour | None; variety from transform and tint |

### 4.10 Scale and readability at phone size

**RULE: design at the pixel size the prop will actually occupy, not at Blender viewport size.**
Assume a 390x844 CSS-pixel viewport with DPR capped at 2.

| On-screen size | What survives | What to do |
|---|---|---|
| Under 16 px | A coloured blob | Flat colour, no detail. Consider merging it into a neighbour |
| 16-40 px | Silhouette and one value break | Two-tone, one clear shape |
| 40-100 px | Silhouette, 3 value steps, one accent | Most props: bevels, AO, 2-3 colours |
| 100-250 px | Sub-forms, a readable pattern | Hero props |
| Over 250 px | Real texture detail is worth paying for | One or two elements at most |

*These thresholds are derived from the general principle, not taken from an authority. Verify on
device. See section 10.*

**Cap device pixel ratio at 2.0** via
`engine.setHardwareScalingLevel(1 / Math.min(devicePixelRatio, 2))`. A 3x DPR phone renders 2.25x
the pixels for a difference almost nobody sees, and fill rate is usually binding.

**Exaggerate proportions.** Correct real-world proportions read as timid in a stylised scene.
Thicken thin elements **1.3-1.6x** (a chair leg at real proportion disappears at 40 px) and
compress furniture height **0.8-0.9x** so it reads chunky and stable. **Minimum feature size is 2
screen pixels:** a groove that renders at 1 px will alias and shimmer and add nothing. Delete it
or make it 3 px.

### 4.11 Fixed camera versus moving camera

A fixed camera is one picture composed once, forever: treat it as a painting, detail only the
camera-facing surfaces, and fake every depth cue by hand (fog, value bands, size, overlap,
contact shadows) because there is no parallax doing it for you. A moving camera has to survive
every angle, so you control only sightlines and framing, you cannot delete hidden geometry, and
parallax supplies depth free. What a fixed camera lets you delete is in 3.14.

---

## 5. Stylisation, in one rule

**A cheat reads as *style* when applied consistently and completely, and as *unfinished* when
applied partially. The single strongest tell of unfinished work is inconsistency.** A reviewer
will forgive any level of simplification applied everywhere and will flag any mismatch
instantly. Flat colour next to a textured prop, one smooth-shaded object among faceted ones,
two props with normal maps and thirty without: each of those is read as a bug, not a style.

The corollary is a **style constants file**, which is what an art bible is for a
code-generated game: one table of bevel width, segment counts, saturation and value bands, key
and ambient intensities, AO floor, blob opacity, atlas size and jitter ranges, that every
generator reads. The full constants block, the ranked table of stylisation approaches, the
matcap technique (a fully shaded, apparently rim-lit object for one texture sample and no
lights, whose only limitation a fixed camera cancels), the case against global outlines, and
modular kit and scatter rules are in
[references/stylisation-and-kits.md](references/stylisation-and-kits.md).

---

## 6. 2D: what changes and what does not

**Unchanged from 3D:** silhouette first, value structure, focal hierarchy, one locked palette,
warm/cool separation, colour as a gameplay signal, clustering and density rhythm, contact
shadows (a soft ellipse under a sprite), atmospheric perspective, and consistency over quality.

**What is different:**

- **A hard palette is the strongest cohesion tool in 2D and it is free:** an actual list of RGB
  values that every pixel must be one of, **16-32 colours** for a whole game. Quantise every
  generated or imported image to it as a build step and the mismatched-asset problem largely
  disappears.
- **One tile size for the whole game:** 16x16 for pixel art, **32x32 as the safest default for a
  modern phone game**. **Autotiling: use dual-grid**, which gets 47-tile visual quality from a
  16-tile authoring cost.
- **Parallax: 3-5 layers**, each losing contrast and saturation with distance. **The tint toward
  the background colour matters more than the motion** and works even in a non-scrolling scene.
- **Bake the light into the art**, then a per-sprite tint multiply, then a composited light
  layer if you need dynamic light. Skip normal-mapped sprites: they double texture memory, need
  a WebGL renderer, and rarely pay for themselves in a browser. **Glow without post:** a
  pre-blurred radial gradient sprite behind the emitter with
  `globalCompositeOperation = 'lighter'`, **2.5-4x** the emitter size, **0.3-0.6** opacity.
- **Scaling discipline (pixel art):** render at 320x180 to 480x270 and scale by an **integer**,
  letterboxing the remainder. Non-integer scaling gives uneven pixel sizes, the single most
  visible pixel-art error. `imageRendering: pixelated`, NEAREST sampling.
- **Canvas 2D cost model:** `globalAlpha`, `globalCompositeOperation`, `shadowBlur` and `filter`
  are expensive state changes, so batch by state. `ctx.filter` and `shadowBlur` must never run
  per frame; pre-render them into an offscreen canvas once. Avoid non-integer draw coordinates.
- **An SVG used in an `<img>` tag must carry the `xmlns` attribute** or it silently fails.

Layer tables, autotiling schemes, atlas padding numbers and the 2D lighting options are in
[references/two-dimensional.md](references/two-dimensional.md).

---

## 7. Production technique

**Design a kit, not a set of props.** A kit is a few pieces that snap to a grid and combine into
many configurations. Pick **one** module size and derive everything from it by powers of two
(nothing is 3 cells, because 3 does not subdivide). Put every piece's origin at a corner of its
footprint on the floor plane, not its centre, so snapping is trivial and rotation is exact. Test
every piece in all four rotations. Where modules do not meet cleanly, **cover the seam with
another object**: a pillar, a crate, a plant. Standard practice, and cheaper than perfect
modules. Aim for **80 percent modular, 20 percent unique**, with the unique pieces at focal
points, because over-modularisation makes everything look the same.

**Prefer a scripted mesh over an imported GLB** when the shape is a solid of revolution, a
prismatic extrusion or a box assembly: zero download, diffable in git, parameterisable (one
function makes the small mug and the big jar), exact control of triangle count.

**Generates well by script:** modular architecture (walls, floors, columns, railings, stairs,
shelving, counters); solids of revolution via `CreateLathe` or a screw modifier; extrusions along
paths (pipes, cables, neon tubes, trim, rug borders); scatter and clutter placement; tiling
patterns, gradients and noise onto a canvas; colour variation, AO baking and transform jitter;
foliage as parameterised cards; vertex-colour gradients for wear. **Does not generate well:**
anything with character or personality; organic asymmetry that must read as designed rather than
random; anything where the shape itself is the joke; hand-painted detail; and believable clutter
that implies a specific story. **Script places the props; a human decides which props and why.**

**Runtime canvas textures** cover every gradient, noise field, flat swatch set, simple pattern
and **all text**: zero download, reproducible from code in git, and the text stays real. Batch
every label into **one** big `DynamicTexture` with a rectangular region each; to change a label,
clear that region, redraw, update. **Never call `update()` in the render loop** (it re-uploads
the whole canvas, and `drawText` defaults `update` to true, so pass `false` and batch). Size the
canvas to on-screen pixel size times 1.5, rounded to a power of two, and remember the
uncompressed-RGBA VRAM cost from 1.3.

**Blender and the build pipeline.** Write assets as Python scripts that build meshes and export,
and check the `.py` into git rather than only the `.blend`; a `.blend` is an opaque binary in a
diff. **Never ship a raw Blender export**: run every GLB through glTF-Transform in the build.
Verified exporter option names, the geometry-nodes realize trap, baking targets, the compression
decision table and scatter defaults are in
[references/blender-pipeline.md](references/blender-pipeline.md) and
[references/stylisation-and-kits.md](references/stylisation-and-kits.md).

---

## 8. Generative tooling, and what is actually available here

Two hard constraints bind this whole section. **No lettering from image generators:** all
in-scene text is rendered as real text onto a canvas texture at runtime, and a generated image
must never carry baked-in words, not even decorative background lettering. Where a generated
backdrop would naturally contain signage, prompt for blank plates or banners and draw the text on
top at runtime. **No emojis as art:** not as icons, not as props, not as placeholders that
survive to a commit.

**Availability in this environment, verified:**

| Tool | Status |
|---|---|
| **Nano Banana (Gemini image)** | **Available now.** The `gemini` CLI is on PATH and a `nano-banana` skill drives it |
| **Blender** | **Available now.** CLI at `/opt/homebrew/bin/blender`, plus a Blender MCP server, so Blender can be scripted directly |
| **Meshy AI** | **NOT configured.** No API key, no MCP, no reference in settings or this repo. Requires setup before any use |

**Order of preference for producing any asset:** (1) **procedural code** (Babylon mesh builders,
canvas textures, Blender Python), which is free, diffable, parameterisable and exactly on budget,
and covers most environment geometry; (2) **CC0 asset libraries** restyled to the palette; (3)
**generated 2D** for textures, backdrops, matcaps, ramps and reference boards; (4) **generated
3D** for hero props with character that code cannot express, followed by a mandatory cleanup
pass; (5) **hand modelling**, where none of the above works.

**Use generators for the parts of the problem that are taste (what should this look like) and
code for the parts that are structure (how is it built). Generated output is an input to the
pipeline, never the shipped asset.**

**CC0 libraries are the most under-used option here and deserve their weight.** Kenney,
Quaternius, KayKit, Poly Haven and ambientCG are all CC0: free for commercial use, **no
attribution required**. For a stylised low-poly browser game, **Kenney and Quaternius are a
better starting point than any generator**: already low-poly, already flat-shaded, already
sharing a palette, already a few hundred triangles, legally unambiguous. Restyle to your palette
and you are done.

**Meshy's free tier is CC BY 4.0**, so a free-tier asset drags an attribution obligation into
your git repo. State that out loud before anyone uses it. Prefer CC0 or self-generated; avoiding
an attribution obligation is worth more than the time saved.

**Raw generated 3D misses a browser-game budget by two to three orders of magnitude** (50k-300k
triangles for one prop against a 50k whole-scene budget; a 2K or 4K PBR set per prop against a
32 MB whole-game budget). That is not a reason never to use it. It is the reason the **11-step
Blender cleanup pass is mandatory and should be automated. Without that pass, do not use
generated 3D at all.**

**The key insight, and it is not obvious: style coherence is not achieved by prompting carefully.
It is achieved by every asset passing through one deterministic finishing pass.** Same bevel
width, same AO bake settings, same palette quantisation, same triangle budget tier, applied by a
script. That does most of the work and does not depend on the generator cooperating.

Per-tool detail, the 11-step cleanup path, licensing and the five mechanisms for controlling
style drift are in [references/generative-tooling.md](references/generative-tooling.md).

### 8.1 When NOT to generate

**Twenty lines of code beat a generated mesh when the object is** a box or an assembly of boxes;
a solid of revolution; an extrusion along a path; a repeat of something you have; parameterised
by gameplay; or required to snap exactly to a grid. For all of those a generated mesh is strictly
worse: bigger, slower to load, not parameterisable, not diffable, and it will not match your
bevel width.

**A flat colour beats a generated texture when** the surface is under roughly 64x64 screen
pixels; the surface has no pattern; vertex-colour AO is already doing the form work; the
"texture" you want is really just a value change; or using it would need a new material, which
costs more than the texture.

**Generation earns its place when** the object has character that must be *designed* rather than
derived; is organic and asymmetric in a way that must read as intentional; is a one-off hero at a
focal point with a 1,500-3,000 triangle budget; is a 2D backdrop, tiling material or matcap; or
is being **explored** rather than produced, which is the highest-value use of all: twelve
concepts in a minute to pick a direction you then implement in code.

---

## 9. Critique checklist

Review from a screenshot at the **real camera and real device resolution**, plus two derived
images: a **greyscale** version and a **flat-black-on-white silhouette** version. A scene that
cannot produce those three images has not been reviewed. Never approve a Blender render or a
desktop screenshot; both lie in different directions.

**The fast gate. Any "no" is a finding.**

1. In silhouette, can you name every prop, and do any two props merge into one blob?
2. In greyscale, can you tell foreground from background?
3. Name the first three things your eye lands on. Are they the three you intended, with no
   fourth competing?
4. Does every prop touch the ground with a visible contact shadow or baked AO?
5. Pick three props at random: does the lit side face the same way on all three?
6. Is there a beveled highlight on every hard edge, at the same width everywhere?
7. Is every colour in the frame from the palette table? Sample five pixels.
8. Is scenery saturation in the 25-55 percent band, with the accent only on interactives and
   under about 10 percent of pixels?
9. Are shadows cool rather than grey or black, and is the ground darker than the walls?
10. Is at least a quarter of the floor empty, and are props in clusters of 2-4 with gaps?
11. Is every interactive object distinguished from every non-interactive one by a rule you can
    state in one sentence, and by at least two cues (not colour alone)?
12. Is detail consistent across props of the same tier? Any prop obviously from a different
    pipeline?
13. Draw calls under 50, triangles under 50k, materials under 8, texture memory under 32 MB,
    measured rather than asserted?
14. Does any generated asset carry baked-in lettering? (Must be zero.) Is every third-party
    asset's license recorded?
15. **Three-second test:** look at the screenshot for three seconds, look away, describe it.
    If the description matches the intent it works. If you describe "a bunch of shapes", it
    does not.

The full 41-item pass, grouped as read / form and lighting / colour / composition / scale /
technical, is in [references/critique-checklist.md](references/critique-checklist.md). Use it
as an acceptance gate; use the fast gate above mid-build.

Symptom-to-fix lookup for anything that fails: [references/failure-modes.md](references/failure-modes.md).

---

## 10. What is settled, and what is not

**State these flatly.** Silhouette first. Value carries the image and colour decorates it.
Contact shadows and AO are the cheapest large gain in perceived quality. Consistency beats
quality. Draw calls and materials matter more than triangles in a browser. A consistent
world-space bevel width separates amateur from professional low-poly. Clustered placement beats
even distribution. One shared palette applied by rule is the mechanism for cohesion. Reserve
colours for gameplay meaning. Generated 3D is not game-ready without a cleanup pass. Ground
darker than walls. Tiling and trim sheets for bulk surfaces, unique textures for heroes only.

**Do not state these as fact. They are unverified, derived, or genuinely contested.**

| Claim | Status |
|---|---|
| Screen-pixel detail-survival thresholds (4.10) | **Derived, not sourced.** No authority publishes "detail survives above N pixels". Reasonable, but verify on device |
| The draw-call and triangle budgets (1.2) | **Not Babylon's own figures.** Babylon publishes no numeric ceilings. These come from the wider WebGL and mobile-AR literature and apply equally, but are not authoritative for Babylon |
| Blob-shadow defaults (3.2) | **Universal in practice, undocumented.** Conventional values, not cited numbers |
| Alpha test versus alpha blend on current mobile GPUs (3.15) | **Sources conflict and are hardware generations old.** Measure on target hardware |
| Current Gemini / Nano Banana licensing for shipped game assets | **Check the current terms at time of use.** Do not assert a position; they change |
| Merged mesh versus thin instances (3.6) | **Conflicts by about 4x in public sources.** No controlled benchmark on mid-range Android exists. A measurement to take once in the real project and then state as a project fact, not a settled answer |
| Palette size, outlines, grid jitter, texture-less versus lightly textured, rim on everything, whether to ship PBR at all | **Taste.** The defaults above are defensible, not laws |

Blender glTF export option names **were verified** against the installed Blender build. The
version, the verification method and the exact names are in
[references/blender-pipeline.md](references/blender-pipeline.md).

---

## 11. Related skills

`babylonjs-3d` for the engine API. `performance-tuning` for the frame-rate work these budgets
feed into. `css-game-art` for UI and CSS-drawn art, which is a different problem from world
art. `level-design` for spatial layout, which decides *where* things go; this skill decides
what they look like when they get there. `mobile-game-ux` for the HUD that sits over the scene.
