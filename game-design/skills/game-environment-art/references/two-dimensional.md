# 2D Environment Art: Tiles, Parallax, Atlases, Lighting

Companion to `../SKILL.md` section 6. Everything in the skill's fundamentals (silhouette, value,
focal hierarchy, palette, warm/cool, clustering, contact shadows) applies unchanged in 2D. This
file holds only what is 2D-specific.

---

## 1. Tilesets and tilemaps

**RULE: pick one tile size for the whole game and never deviate.**

| Tile size | Suits | Notes |
|---|---|---|
| 8x8 | Very retro, dense detail | Hard to read on a phone without integer scaling |
| **16x16** | The default for pixel-art tile games | Good balance; scales to 32/48/64 cleanly |
| **32x32** | Detailed 2D, non-pixel-art styles | The safest default for a modern phone game |
| 64x64 | Illustrative, low tile count | Texture memory grows fast |

Powers of two pack cleanly into atlases, scale by whole numbers, and avoid packing seams.

### Autotiling / bitmasking

Each tile inspects its neighbours, builds a bitmask, and looks up the right variant.

| Scheme | Neighbours checked | Tiles needed | Use when |
|---|---|---|---|
| **4-bit / Wang** | 4 (N/E/S/W) | **16** | Simple terrain, cheapest to author. Corners are blunt |
| **8-bit / blob** | 8, corner rules collapsing duplicates | **47** (from 256 raw combinations) | Proper terrain with correct inner corners |
| **Dual-grid** | Corners rather than cells | **16** tiles, 47-tile quality | The best modern trade. Recommended |

**Use dual-grid.** It gets 47-tile visual quality at a 16-tile authoring cost, which for a
generated tileset is a large saving.

### Avoiding visible repetition

- Author **3-5 variants** of the fully-surrounded interior tile and pick with weighted randomness:
  common 70 percent, alt 20 percent, rare 10 percent.
- Add a sparse **decoration layer** on top: a crack, a tuft, a stain on roughly 1 in 12 tiles,
  drawn from a small set, rotated and flipped.
- Vary the tile **tint** by a few percent per tile from low-frequency noise. Nearly free, and it
  breaks the grid better than extra variants do.
- **Never let a distinctive feature** (a bright knot in wood, a strong crack) appear in a base
  tile. The eye finds it and the grid becomes visible instantly. Distinctive features belong in
  the decoration layer.

**Seamlessness test:** tile 4x4 and look for a visible grid line from edge value mismatch, a
diagonal moire from a repeated bright spot, or a lighting direction that reverses at the seam.

## 2. Parallax and depth

**RULE: 3-5 layers. Each moves at a fixed fraction of camera motion, and each loses contrast and
saturation with distance.**

| Layer | Scroll factor | Contrast | Saturation | Detail |
|---|---|---|---|---|
| Far background / sky | 0.05-0.15 | 15-25 percent of full | 30-50 percent | Almost none; shapes only |
| Mid background | 0.20-0.35 | 35-50 percent | 50-70 percent | Silhouettes |
| Near background | 0.50-0.65 | 60-80 percent | 70-90 percent | Readable forms |
| Gameplay plane | **1.0** | 100 percent | 100 percent | Full |
| Foreground overlay | 1.1-1.4 | often near-silhouette | low | Frames the view |

**Atmospheric perspective is the free half of this and does more for depth than the motion does.**
Composite each background layer with a tint toward the background colour at **20 percent** (near),
**40 percent** (mid), **60 percent** (far). It works even in a non-scrolling scene.

**Cost:** each layer is one more fullscreen-ish draw (one `drawImage` on canvas 2D, one more
composited element in DOM/CSS). Keep layers to 5, keep them as single wide images rather than many
sprites, and keep foreground overlays to one, because they are overdraw.

**Depth cues available without parallax:** overlap (the strongest, and free), size gradient,
vertical position on screen (higher equals further, for a ground plane), contact shadows, and
contrast and saturation falloff. Blur is expensive on canvas; prefer pre-blurred art.

## 3. Sprite atlases, formats and scaling discipline

**RULE: one atlas per scene or per state. Power-of-two dimensions. Never let the renderer scale
sprites by a non-integer factor in a pixel-art game.**

- Atlas **1024x1024** default, **2048x2048** ceiling (2048 is the safe maximum on mobile; 4096 is
  supported on most but not all).
- Padding between sprites: **2 px** minimum, **4 px** if the atlas is mipped or filtered.
- Extrude (repeat the edge pixel outward) by 1-2 px to stop bleeding.

| | Pixel art | Vector / CSS+SVG | Painted raster |
|---|---|---|---|
| Authoring | Slow per asset, very cheap per byte | Fast to vary, tiny files | Slow, large files |
| Generation by code | Excellent (a canvas and a palette) | Excellent (SVG is text, diffable) | Poor |
| Scaling | Integer only, or it looks wrong | Perfect at any scale | Needs 2x assets |
| Memory | Tiny | Tiny, but rasterisation costs CPU | Large |
| Fits a generated pipeline | Very well, with a locked palette | Very well for UI and flat shapes | Hero art only |

**SVG trap:** an SVG used in an `<img>` tag **must carry the `xmlns` attribute** or it fails.
Inline-`innerHTML` SVG has different rules. This bites people regularly.

**Scaling discipline for pixel art:** render at a base resolution (320x180 or 400x225) and scale
up by an integer to fill the screen, letterboxing the remainder. Non-integer scaling produces
uneven pixel sizes, the single most visible pixel-art error. Set `imageRendering: pixelated` in
CSS and NEAREST sampling in WebGL. Never rotate pixel-art sprites by non-90-degree angles unless
the style explicitly embraces it.

**Palette limits:** a hard palette (an actual list of RGB values every pixel must be one of) is
the strongest cohesion tool in 2D and it is free. **16-32 colours** for a whole game is common and
workable. Quantise every generated or imported image to the palette as a build step and the
mismatched-asset problem largely disappears.

## 4. 2D lighting

**RULE: bake the light into the art. Add dynamic 2D light only where it is a gameplay signal.**

1. **Light painted into the sprite.** Zero cost. Requires a fixed light direction, which in a 2D
   game you have. Near-universal practice.
2. **A tint multiply per sprite.** One uniform. Day/night by lerping a global tint, and a torch
   can brighten nearby sprites. Extremely cheap and covers 80 percent of what people want.
3. **A light layer composited over the scene.** Render soft radial gradients into an offscreen
   canvas, then composite with `multiply` (darkness) or `screen` / `lighter` (glow). One extra
   fullscreen composite. The standard canvas 2D approach; gets convincing day/night and torchlight
   for one pass.
4. **Normal-mapped sprites.** A second texture per sprite encoding surface direction in RGB, lit
   per pixel by a shader. Genuinely dynamic, but it **doubles texture memory** and needs a WebGL
   renderer; pure canvas 2D cannot do it.

**Recommendation: 1 + 2 + 3. Skip normal maps** unless dynamic lighting is a mechanic.

**Glow and bloom:** do not post-process. Draw a pre-blurred radial gradient sprite behind the
glowing thing with `globalCompositeOperation = 'lighter'`. One extra draw, no pass, and you
control the shape exactly. Default: glow sprite **2.5-4x** the emitter size, opacity **0.3-0.6**.

**Day/night:** interpolate between 3-5 presets, each holding a multiply tint, an additive tint, a
background gradient and a light-layer opacity. Same architecture as the 3D time-of-day preset
system in the skill.

## 5. Canvas 2D cost model

State changes (`globalAlpha`, `globalCompositeOperation`, `shadowBlur`, `filter`) are expensive,
so batch by state. `ctx.filter` and `shadowBlur` in particular should never run per frame;
pre-render them into an offscreen canvas once. Avoid non-integer draw coordinates, which force
sub-pixel resampling. The numeric 2D budget is in [budgets.md](budgets.md).
