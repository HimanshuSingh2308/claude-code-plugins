# Failure Modes: Symptom, Cause, Fix

Companion to `../SKILL.md` section 9. Look the symptom up here rather than re-deriving the fix.
Section numbers in parentheses point back into the skill.

## Look and read

| Symptom | Cause | Fix |
|---|---|---|
| Props look like they float | No contact shadow, no baked AO | Blob shadow quad under every prop; bake AO to vertex colours (3.1, 3.2) |
| Scene looks flat and lifeless | Ambient too strong relative to key; no value separation; no warm/cool split | Key 0.9 / ambient 0.45; separate scenery into three value bands; warm key, cool ambient (3.4, 4.2, 4.5) |
| Everything reads as one mush in greyscale | Muddy values: too many elements in the same value band | Assign depth bands explicit value ranges; push the focal point out of the band (4.2) |
| Everything screams for attention | Everything at the same high saturation | Desaturate scenery to 25-55 percent; reserve 70-90 percent for the accent, under 10 percent of pixels (4.4) |
| Scene feels cluttered but empty of meaning | Uniform density, no clustering | Cluster in 2-4s with gaps; delete 20-40 percent of scattered items; leave 25-40 percent of floor empty (4.3, 4.8) |
| Looks like programmer art | Sharp 90 degree edges, default primitives, no bevels | Global bevel at one world-space width, angle limit 30 degrees, 1 segment (3.3) |
| Props look like they come from different games | No shared palette; different bevel widths; different normal treatment; different detail tiers | One palette table read by everything; one finishing script every asset passes through; a contact-sheet review (4.4, 8) |
| Neon sign looks dull | Emissive without a glow | Add a soft additive quad behind it at 2-3x size, 30-50 percent opacity (4.7) |
| Neon/emissive clips to white and loses shape | Emissive intensity too high without tonemapping | Cap at 1.3-2.0x the brightest lit value; use the glow quad for the sense of brightness (4.7) |
| Gradients show visible bands | 8-bit quantisation over a large area | Add 0.5-1.5/255 dither (3.16) |
| Text on a sign is blurry or wrong | Text baked into a generated or scaled image | Draw text with `drawText` on a `DynamicTexture` at the right pixel size; never bake words into art (4.7, 8) |
| Generated prop looks imported | Wrong bevel, wrong palette, wrong triangle density, photoreal texture | Run the full finishing pass: re-bevel, palette-quantise, re-bake AO, decimate to tier (blender-pipeline.md section 5) |

## Geometry and texture

| Symptom | Cause | Fix |
|---|---|---|
| Flickering surfaces | Z-fighting from coplanar geometry | Offset by 0.005-0.02 world units, or use a rendering group / `zOffset` on the decal material, or reduce `camera.maxZ` to improve depth precision |
| Texture looks smeared on one face | UV stretching from non-uniform scaling or a bad unwrap | Apply scale before unwrapping; check with a checker texture; re-unwrap |
| A bright spot repeats across the floor in a grid | A distinctive feature inside a tiling texture | Remove distinctive features from base tiles; move them to a sparse decoration layer (3.8) |
| Visible seams between atlas tiles at distance | Mipmap bleeding between atlas islands | 4 px padding plus 4 px edge dilation, or disable mips on that atlas, or cap the mip level (3.5) |
| Visible seams or gaps where modules meet | Kit pieces not tested in all four rotations | Test all four; cover unavoidable seams with a pillar, crate or plant (7) |

## Process

| Symptom | Cause | Fix |
|---|---|---|
| Looks fine in Blender, wrong in game | Different colour space, lighting, camera; modifiers not applied; materials not exported | Review only in-game at the real camera. **Never approve a Blender render** |
| Looks fine on desktop, unreadable on phone | Reviewed at the wrong size | Review at real device resolution; apply the screen-size detail table (4.10) |

## Performance

| Symptom | Cause | Fix |
|---|---|---|
| 60 fps then 30 fps after a minute | Thermal throttling | Reduce sustained GPU load: cap DPR at 2, cut overdraw, remove post passes |
| Low triangles but poor frame rate | Too many draw calls / materials | Merge static meshes, share one material and atlas per set, instance repeats (3.5, 3.6) |
| Frame rate drops when a transparent effect appears | Overdraw from alpha blending | Trim cards to the opaque silhouette, prefer alpha test, reduce overlapping quads (3.15) |
| Long stutter the first time something appears | Shader compilation at first render | Warm all materials at load with `forceCompilation` |
| Game is slow to start | Download size; the Draco decoder | Use quantize or meshopt instead of Draco for small meshes; shrink atlases; generate more at runtime (budgets.md section 7) |
| Memory climbs across a session | Textures and meshes not disposed; new DynamicTextures per update | Reuse one DynamicTexture with regions; dispose eagerly |
| A counter says the scene is fine and it plainly is not | The capture flag was never enabled, so the counter reads 0 | Prove the instrument moves before trusting it (budgets.md section 5) |
