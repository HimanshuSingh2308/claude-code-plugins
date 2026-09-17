# Blender Pipeline: Scripting, Baking, Export and the Cleanup Pass

Companion to `../SKILL.md` sections 7 and 8.

Blender is available in this environment: CLI at `/opt/homebrew/bin/blender`, plus a Blender MCP
server, so it can be driven directly. Prefer `bpy.ops` for standard actions and the `bpy.data`
API for precise control. The usual traps apply: mode matters; the active object and the selection
are distinct and both must be set explicitly; operators change selection as a side effect; and
the dependency graph must be updated before reading computed results.

---

## 1. Script assets, do not hand-model them

**RULE: write assets as Python scripts that build meshes from `bmesh` or from primitives plus
modifiers, then export. Check the `.py` into git, not only the `.blend`.** A `.blend` is an opaque
binary in a diff. A script is reproducible, diffable, parameterisable, and re-runnable when the
style constants change.

Practical skeleton:

- Build with `bmesh` for precise control, or `bpy.ops.mesh.primitive_*` plus modifiers for speed.
- Apply modifiers before export; glTF has no modifier concept.
- Create a colour attribute and write baked AO into it:
  `mesh.color_attributes.new(name="Col", type='BYTE_COLOR', domain='CORNER')`.
- Triangulate explicitly before export so you control the triangulation rather than the exporter.
- Update the depsgraph after changing geometry, before reading evaluated results.

Global bevel, matching the style constants:

```python
m = ob.modifiers.new("bev", 'BEVEL')
m.width = 0.015                 # BEVEL_WIDTH_WORLD, world units, same for every prop
m.segments = 1                  # 2 only on hero props
m.limit_method = 'ANGLE'
m.angle_limit = math.radians(30)
m.harden_normals = True
```

## 2. Geometry nodes

**Good for:** scatter (Distribute Points on Faces plus Instance on Points), variation (Random
Value into rotation, scale or material index), procedural tiling, greebling, curve-based
generation (fences, pipes, railings), and anything you want to art-direct live with sliders. Node
trees are data blocks and can be built, parameterised and connected entirely from Python.

**The critical export trap:** geometry nodes instances are **not real geometry** until you apply
the modifier or use a Realize Instances node. Export without realizing and you get an empty file.

**The performance trap:** realizing defeats the point for runtime. Realizing 200 plants into one
mesh gives one draw call and 200x the vertex data, which is often *correct* for a browser game,
but decide deliberately. The alternative, and the pattern worth building once: export **one**
plant and do the instancing in Babylon with thin instances, driven by a JSON transform list that
the geometry nodes setup exports. Blender decides placement, Babylon does the instancing.

## 3. Baking

In order of usefulness here:

1. **AO to vertex colours.** Highest value. Blender removed the old Blender-Internal "bake AO to
   vertex colour" button at 2.8. Current scriptable options: bake AO to an image with Cycles then
   transfer image to a colour attribute (reliable, two steps, needs UVs); an addon such as Vertex
   Oven, which bakes AO straight to a colour attribute; or do it yourself in Python with raycasts
   from each vertex along the hemisphere around its normal. For a low-poly prop of a few thousand
   verts the raycast approach is a few seconds and fully reproducible in git, which is the
   argument for it. **32-64 rays per vertex with cosine-weighted hemisphere sampling is plenty.**
   Known trap: baking to vertex colours produces black spots on meshes with degenerate or
   zero-area faces and on n-gons Blender triangulates badly. Triangulate and remove doubles first.
2. **AO plus curvature plus a colour gradient into one atlas texture.** The closest thing to a
   free hand-painted look: curvature lights convex edges and darkens concave ones, which is what
   hand-painted stylised texturing is imitating. Combine with the base palette colour in a few mix
   nodes.
3. **Lighting to a lightmap** in the atlas, for static scenes.
4. **High-poly normal detail to a low-poly normal map.** Usually **not worth it here**: with a
   fixed camera and one light you can bake the same information into the albedo or vertex colours
   and skip the map's texture and sample entirely.

## 4. glTF / GLB export options (VERIFIED)

**Verified on 2026-09-17 against the installed build: Blender 5.2.0 LTS (build date 2026-07-14).**

Method: introspected `bpy.ops.export_scene.gltf.get_rna_type().properties` under
`blender --background --factory-startup --python`, printing every property identifier, type and
default; then ran a real GLB export of a beveled cube carrying a `BYTE_COLOR` corner attribute
with the exact keyword arguments below, which succeeded and wrote a valid file. The `export_format`
enum is not introspectable as a static list, so its members were read back from the operator's own
type error: `('GLB', 'GLTF_SEPARATE')`.

Re-verify with this one-liner whenever the Blender version changes:

```
blender --background --factory-startup --python-expr \
  "import bpy; print([p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties])"
```

| Option (verified identifier) | Value for this idiom | Default | Why |
|---|---|---|---|
| `export_format` | `'GLB'` | (dynamic) | One binary file, no base64 bloat. Members: `GLB`, `GLTF_SEPARATE` |
| `use_selection` | `True` | False | Export only what the script built |
| `export_cameras` | `False` | False | You create the camera in Babylon |
| `export_lights` | `False` | False | Exported lights need `KHR_lights_punctual` and you do not want them |
| `export_yup` | `True` | True | glTF convention |
| `export_apply` | `True` | **False** | glTF has no modifiers. **This one defaults the wrong way for this pipeline** |
| `export_texcoords` | only if you use UVs | True | Every unused attribute is bytes per vertex |
| `export_normals` | `True` | True | Needed unless fully unlit |
| `export_tangents` | `False` | False | Only needed for normal maps, which you are not shipping |
| `export_vertex_color` | `'MATERIAL'` | `'MATERIAL'` | Members: `MATERIAL`, `ACTIVE`, `NAME`, `NONE`. This is your AO and colour variation |
| `export_all_vertex_colors` | `True` | True | |
| `export_vertex_color_name` | `'Col'` | `'Color'` | Set it to whatever your bake script names the attribute |
| `export_materials` | `'EXPORT'` | `'EXPORT'` | Members: `EXPORT`, `PLACEHOLDER`, `VIEWPORT`, `NONE`. Use `NONE` if you define every material in Babylon, which is the recommendation below |
| `use_mesh_edges` | `False` | False | Loose edges |
| `use_mesh_vertices` | `False` | False | Loose points |
| `export_animations` | `False` | **True** | Environments do not animate. **Defaults the wrong way** |
| `export_skins` / `export_morph` | `False` | True | Same reason |
| `export_extras` | `False` | False | Custom properties |
| `export_image_format` | `'AUTO'` or `'NONE'` | `'AUTO'` | Members: `AUTO`, `JPEG`, `WEBP`, `NONE`. `NONE` if you ship no textures |
| `export_draco_mesh_compression_enable` | `False` | False | Compress in glTF-Transform instead, so the choice is in the build not the exporter |
| `export_shared_accessors` | `True` | False | Deduplicates accessors across meshes |

**There is no `export_triangulate` option.** Triangulate with a modifier before export so you
control the result rather than the exporter.

Blender 5.2 also exposes a gltfpack path (`export_use_gltfpack`, `export_gltfpack_tc` for KTX2,
`export_gltfpack_si` for simplification, and the `export_gltfpack_v*` quantization bit counts).
Prefer doing that work in glTF-Transform in the build, where it is visible in the repo.

**Full working call, as verified:**

```python
bpy.ops.export_scene.gltf(
    filepath=out, export_format='GLB', use_selection=True,
    export_apply=True, export_yup=True,
    export_cameras=False, export_lights=False,
    export_normals=True, export_tangents=False, export_texcoords=False,
    export_vertex_color='MATERIAL', export_all_vertex_colors=True,
    export_materials='EXPORT', export_animations=False,
    use_mesh_edges=False, use_mesh_vertices=False, export_extras=False)
```

### What survives export

Base colour (factor and texture), metallic, roughness, normal, occlusion, emissive (including
`KHR_materials_emissive_strength` for values above 1), alpha mode and cutoff, vertex colours
(`COLOR_0`), UV maps, and a documented set of PBR extensions, several of which need the optional
glTF Material Output node.

### What does not survive

Procedural texture nodes, complex node groups, most Blender-only shading, geometry nodes that are
not realized, modifiers that are not applied, and anything relying on Blender's renderer rather
than the material graph. **If it is not a straight Principled BSDF with image textures or constant
factors, bake it.**

**Practical rule: do not try to ship Blender materials at all.** Export geometry plus vertex
colours plus UVs, and define every material in Babylon code from the palette constants. Materials
then live in the same diffable place as everything else and you avoid every exporter surprise.

## 5. The cleanup pass for generated or foreign 3D

**Blender is where every foreign asset is normalised.** Generated meshes, CC0 downloads, scans and
hand-made props all pass through the same script. That script, not careful prompting, is the
actual style enforcement mechanism.

1. **Import** the GLB. Record the original for provenance.
2. **Normalise transform:** origin to the base centre, rotate to +Y up, scale to the game's unit
   so the prop is its real size relative to the play grid. Apply all transforms.
3. **Clean the mesh:** merge by distance (0.0001-0.001), delete loose geometry, recalculate
   normals outside, remove interior faces.
4. **Reduce.** Static prop with a good silhouette: **Decimate, Collapse mode**, ratio tuned to hit
   the target. Decimate keeps existing flow, which is right for static props and wrong for
   anything that deforms. Silhouette breaks under decimation, or topology is genuinely broken:
   **Remesh (Voxel)** to rebuild from the volume, then decimate; this destroys UVs, which you are
   about to redo anyway. Targets: **300-1,200 triangles** for a secondary prop, **1,500-3,000**
   for a hero.
5. **Re-bevel** at the global `BEVEL_WIDTH_WORLD` with the angle limit, so the prop matches the
   rest of the game's edge treatment. **This step is what makes a generated prop stop looking
   imported.**
6. **Re-UV** only if you need texture at all: Smart UV Project with an island margin, then pack
   into the shared atlas. Often you will find you do not need UVs, which is better.
7. **Restyle to the palette.** Discard the generated textures. Either assign flat palette colours
   per material slot (using the generated texture only as a *guide* for which region gets which
   colour), or bake the generated albedo down to a 32-64 px texture and quantise to the palette,
   or bake it to **vertex colours** and quantise those. The third is usually right here because it
   removes the texture entirely.
8. **Bake AO to vertex colours** with the same settings as every other prop.
9. **Triangulate**, apply modifiers, strip unused attributes.
10. **Export GLB** with the settings in section 4, then run the glTF-Transform chain from
    [budgets.md](budgets.md).
11. **Verify against the budget:** triangle count, vertex count, material count, texture count,
    file size. **Fail the build if it misses.**

That whole chain is a Blender Python script plus a shell step. Build it once and every generated
prop goes through it. **Without it, do not use generated 3D at all.**
