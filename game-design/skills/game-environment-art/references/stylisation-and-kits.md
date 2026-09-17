# Stylisation, Style Constants, Modular Kits and Scatter

Companion to `../SKILL.md` section 5 and section 7.

---

## 1. Which stylised approaches suit a browser game

Ranked by cost, cheapest first.

| Approach | What it is | Runtime cost | Fit |
|---|---|---|---|
| **Flat / unlit with baked light** | `disableLighting = true`, all shading painted into albedo or vertex colours | Lowest possible. No lighting maths at all | Best for a fixed camera |
| **Faceted flat shading** | No smooth normals; each triangle has its own normal, so every face is one flat tone | Same per-pixel cost, but more *vertices* since normals cannot be shared (a cube goes 8 to 24 verts) | Excellent. The classic low-poly look |
| **Vertex-coloured** | Colour in the vertex stream, no texture | Lowest texture cost of all | Excellent |
| **Gradient ramp / cel** | One ramp texture drives the lighting response, giving hard bands | 1 extra sample, needs a custom or node material | Very good, and the most art-directed look for the money |
| **Matcap** | A sphere rendered with the material you want, sampled by view-space normal | 1 sample, **no lights at all** | Very good for props, bad where light direction must match the scene |
| **Toon + outline** | Cel plus an outline | Outlines cost a second pass or inverted-hull geometry, roughly 2x draw calls for outlined objects | Selective only |
| **Hand-painted look** | Detail painted into the albedo | Cost of the texture only | Good, but expensive in authoring time and hard to generate reproducibly |
| **Light PBR** | Metallic/roughness with an environment map | Highest: IBL, more samples, bigger textures | Avoid |

**Matcaps deserve the note.** A *matcap* (material capture) is a small image, typically 128x128 or
256x256, of a sphere rendered with the material and lighting you want; the shader looks it up
using the view-space normal. You get a fully shaded, apparently lit, apparently rim-lit object for
**one texture sample and no lights**. Its only real limitation is that the lighting is locked to
the camera and does not respond to the scene, **which a fixed camera cancels entirely**. Pack 16
matcaps into one 1024 atlas at 256 each and shade an entire prop set with one material and one
sample.

## 2. Which cheats read as deliberate

**The general principle: a cheat reads as style when applied consistently and completely, and as
unfinished when applied partially.**

| Cheat | Deliberate when | Unfinished when |
|---|---|---|
| Flat untextured colour | Every surface is flat colour, values separated, edges beveled | Some props textured, some not |
| Visible facets | Every curved object has the same facet density, normals hard everywhere | Some objects smooth-shaded, some faceted |
| No cast shadows | Everything has a blob and baked AO, consistently | Some props have real shadows, some float |
| Hard cel bands | Every material uses the same ramp with the same step position | Band positions differ per object |
| Low texture resolution | The whole game is at one tier and the pixels read as a choice (crisp NEAREST sampling) | Blurry LINEAR-filtered low-res next to crisp |
| Simple geometry | Silhouettes are designed and beveled | Silhouettes are default primitives with sharp corners |
| No normal maps | Nothing has them; form is carried by geometry and AO | Two props have them and thirty do not |
| Visible tiling | The tile pattern is graphic and obviously decorative | The tile is trying to be a photo and repeating |

**The single strongest tell of unfinished work is inconsistency.** A reviewer will forgive any
level of simplification applied everywhere and will flag any mismatch instantly.

**Outlines are contested and have real cost.** Inverted-hull outlines double the draw calls for
outlined meshes; a post-process edge detect costs a fullscreen pass plus a depth or normal buffer.
Neither is cheap on a phone. **Recommendation: no global outlines.** Use a selective outline only
on the currently selected or hoverable object, where it is a UI signal rather than an art style,
as one inverted-hull instance at a time (1 extra draw call).

**Texture-less versus lightly textured is also contested.** Purely texture-less low-poly is clean
but can feel sterile; a very light noise or grain overlay at 3-8 percent opacity, tiled, adds
perceived material quality for one extra sample on a 128x128 greyscale texture. Recommendation:
one shared subtle detail texture used multiplicatively across the whole scene at low strength. Some
art directors consider any noise overlay a cop-out; that is taste.

## 3. The style constants file

This is what an art bible is for a code-generated game. Write it once and have every generator,
Babylon and Blender alike, read from it.

```
// STYLE CONSTANTS - every generator reads these
BEVEL_WIDTH_WORLD      = 0.015     // world units, identical for every prop
BEVEL_SEGMENTS         = 1         // 2 only on hero props
BEVEL_ANGLE_LIMIT_DEG  = 30
NORMALS                = "hard"    // no auto-smooth except on explicit smooth groups
SMOOTH_ANGLE_DEG       = 0         // never auto-smooth; opt in per object
CURVE_SEGMENTS_HERO    = 16
CURVE_SEGMENTS_NORMAL  = 12
CURVE_SEGMENTS_FILLER  = 8
MIN_FEATURE_PX         = 2

SAT_SCENERY            = [0.25, 0.55]
SAT_ACCENT             = [0.70, 0.90]
VAL_SCENERY            = [0.30, 0.75]
VAL_FOCAL              = [0.10, 0.90]
HUE_COUNT              = 8
VALUES_PER_HUE         = 4
ACCENT_SCREEN_FRACTION = 0.10      // max fraction of pixels at accent saturation

LIGHT_SHADOW_HUE_SEP   = 30        // degrees
SHADOW_VALUE_RATIO     = 0.50      // shadow value as a fraction of lit
KEY_INTENSITY          = 0.9
AMBIENT_INTENSITY      = 0.45
RIM_POWER              = 3.0
RIM_INTENSITY          = 0.25

AO_MIN_MULTIPLIER      = 0.62      // darkest AO multiplies albedo by this
BLOB_OPACITY           = 0.35
BLOB_RADIUS_FACTOR     = 0.9
BLOB_Y_OFFSET          = 0.01

ATLAS_SIZE             = 1024
ATLAS_PADDING_PX       = 4
MAX_MATERIALS          = 6
JITTER_YAW_DEG         = 5
JITTER_POS_CELL_FRAC   = 0.08
SCALE_VARIANTS         = [0.88, 1.0, 1.12]
```

## 4. Modular kit design

**RULE: design a kit, not a set of props.** A kit is a small number of pieces that snap to a grid
and combine into many configurations.

**Grid rules:**

- Pick **one** module size and derive everything from it by powers of two. Wall pieces are 1, 2 and
  4 cells wide. Nothing is 3 cells, because 3 does not subdivide.
- Every piece's origin is at a **corner of its footprint on the floor plane**, not at its centre.
  Snapping arithmetic becomes trivial and rotation about the grid becomes exact.
- Pieces must tile in all four rotations. Test all four before shipping any piece.
- Where modules do not meet cleanly, **cover the seam with another object**: a pillar, a crate, a
  plant. Standard practice, and cheaper than making the modules perfect.

**Getting many looks from few meshes**, ranked by cost:

1. Transform variation: rotate, mirror, scale (free).
2. Per-instance tint (free).
3. A UV offset into a different atlas region on the same material (free, one mesh variant per
   offset).
4. Combining two or three base meshes into an assembly (free at authoring; merge for runtime).
5. A new mesh (expensive: download, memory, an atlas slot, authoring time).

**Modularity has a ceiling.** Over-modularisation makes everything look the same. Practical split:
**80 percent modular, 20 percent unique**, with the unique pieces all at focal points.

## 5. Scatter defaults that avoid the uniform look

- Poisson-disc sampling with a minimum radius of **1.5-2.5x** the average prop radius.
- Then **delete 20-40 percent** of samples at random, to open up negative space.
- Then cluster: for each remaining sample, with probability 0.4 add 1-2 companions within 1.0-2.0
  radii.
- Yaw fully random for natural objects; snapped to 90 degrees plus jitter for manufactured ones.
- **A density mask from low-frequency noise**, so density itself varies across the space. This is
  the step that produces rhythm rather than even coverage, and it is the one most often skipped.

## 6. The fractal clustering method

Place one object, then duplicate it shrunk, rotated and slightly offset, and repeat. This produces
natural-looking asymmetric groups from one mesh in about eight lines of code, and it is the
standard set-dressing technique described in the field as "place one rock, then duplicate, shrink,
rotate, and slightly offset, and repeat".
