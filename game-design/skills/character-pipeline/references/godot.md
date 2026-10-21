# Godot 4 Engine Side

**Engine-specific: Godot 4.x (verified on 4.7.2, Compatibility renderer, web first).** Load the
`godot` skill for headless builders, validation and testing; this file is only what characters
add. Other engines: write the same contract (section 1) in that engine's idiom and add a sibling
reference.

LWTS files: `data/character_parts.gd`, `data/character_look.gd`,
`scenes/world/characters/character.gd` + `character.tscn`, `character_clips.gd`,
`character_lighting.gd`, `assets/materials/character_toon.gdshader`, `outline_character.gdshader`,
`tools/world/build_character_scene.gd`, `tools/world/build_character_clips.gd`,
`test/unit/test_character*.gd`.

## 1. The contract the engine side keeps

One skeleton per character, parts skinned to it, colours from a per-character region palette, one
fixed toon key light matching the preview renders, a hull outline, one shared clip library, and a
draw-call budget measured in the running game.

## 2. Part registry (`CharacterParts`)

- Static tables of id to GLB path per slot: `BODIES`, `HAIR`, `TOPS`, `BOTTOMS`, `SHOES`,
  `ACCESSORIES`. The id is the file name without the slot prefix (`top_blazer_male.glb` is
  `TOPS[&"blazer_male"]`). Split outfits into top, bottom and shoes from the start: a single
  `outfit` slot had to be split later for a closet feature.
- `BODY_SKELETONS` maps a body to its skeleton (extra looks reuse male or female).
- `static func path_for(table, id) -> String` returns `""` and `push_warning` for an unknown id.
- `static func fits(body, path) -> bool` checks the part's skeleton matches the body's.
- A table tests need to stub (LWTS `HEADWEAR`) is a `static var`, not a `const`; tests save and
  restore it in `before_each` / `after_each`.
- Any list duplicated between the Blender checks and GDScript (LWTS: female skeleton parts) is a
  drift risk; test that both agree, or generate one from the other.

## 3. Look resource (`CharacterLook extends Resource`)

Exported fields: `body`, `hair`, `hair_color`, `hair_shade_color`, `top`, `bottom`, `shoes`,
`outfit_colors: Dictionary[int, Color]` (regions 2 to 8), `accessories: Array[StringName]`,
`accessory_color`, `skin_tone`, `face_index` (atlas cell), `height_scale`, `build_scale`
(0.9 to 1.15), `headwear`. `part_paths()` returns body, top, bottom, shoes, headwear or hair, then
accessories; unknown or non-fitting ids warn and are skipped; headwear hides hair.

## 4. Character scene

- `Character` root, a `Rig` Node3D, an `AnimationPlayer` with the shared library. Written by a
  headless builder (`build_character_scene.gd`), never hand-edited.
- The body GLB goes under `Rig`; every other part's `MeshInstance3D` is reparented under the body's
  `Skeleton3D` with `skin` and `skeleton` set.
- **Per-mesh Skin for build scale.** `build_scale` widens the chest by editing bind poses. The
  imported `Skin` is shared between instances, so duplicate it per mesh first; a test asserts the
  imported Skin is unchanged. Shoulder joints move out with the chest so arm roots stay put.
- `height_scale` is a uniform scale on `Rig`. `Skeleton3D.motion_scale = hips_rest_y / HIPS_HEIGHT`
  keeps feet on the floor on every body (clips key absolute Hips positions).
- Tracks are `Skeleton3D:<bone>`; set `AnimationPlayer.root_node` to the skeleton's parent on rebuild.
- Editing the look resource in place does nothing until `rebuild()`; `rebuild()` before `_ready`
  returns at once (the setter waits for `is_node_ready()`).

## 5. Shading

`character_toon.gdshader` (`render_mode unshaded`):

- Region from vertex colour in the vertex stage: `int(COLOR.r * 16.0 + 0.5)`; colour from a
  `uniform vec4 region_colors[13]` set per character from the look. Eye white and mouth are fixed.
- Skin samples the face atlas through `UV2` and the look's `face_index` cell (4 x 2).
- Toon: `lit = step(toon_step, dot(N, key_light))` with `toon_step = 0.12` and a **fixed view-space
  key light** copied from the preview script's light. Characters ignore room lights by design: the
  approved look is the preview look.
- `ALBEDO = albedo * mix(character_shadow_tint, vec3(1.0), lit) * character_light_tint`, two
  **global shader uniforms** declared in Project Settings > Shader Globals (default white light and
  the approved shadow `(0.80, 0.68, 0.70)`), so a scene or time of day tints every character at once
  with no extra pass.
- A `CharacterLighting` class with a static API (`set_light_tint`, `set_shadow_tint`, `set_tints`,
  `reset`, getters) that stores the values it sets in static vars.

`outline_character.gdshader` (the toon material's `next_pass`): inverted hull, `cull_front`,
unshaded, offset along the **skinned NORMAL** (a city outline that reads baked `COLOR` direction
does not follow skinning), width `0.0024` of viewport height capped at 0.15 m, `abs()` on the
projection term for the Compatibility renderer's flipped target, colour from the UI tokens.

## 6. Draw calls

- Each part is its own skinned `MeshInstance3D` with an outline pass: about 2 draws a part. LWTS:
  him, challenger, teacher 6 parts = 12 draws; her 8 parts = 16. The plan assumed 6.
- Skinned meshes do not batch. Ten characters at 16 is 160 draws, over a mobile web budget alone.
- Recommendation: merge a look's parts into one skinned mesh at build or spawn time with two
  surfaces (toon body, hair): about 4 draws with outline. Keep the separate parts as the source for
  dressing and the closet; merge after `rebuild()`. Measure in the running web build (Task 9), do not
  assert.
- Not yet built or verified in LWTS. Points to settle when building it: merge after `build_scale`
  has edited the bind poses (all parts share the edited chest), give the merged mesh one Skin
  covering the union of bones, keep region ids in `COLOR` and atlas `UV2` per vertex, keep the toon
  and hair materials as the two surfaces, and add a test that the merged mesh skins to the same
  positions as the separate parts and a draw-call budget test.

## 7. Traps

| Trap | Symptom | Do |
|---|---|---|
| Godot exits 0 on errors (also `--check-only` on parse errors) | CI green with broken scripts | grep every log for `SCRIPT ERROR\|Parse Error\|ERROR:\|Failed loading`; load scripts in a running SceneTree |
| `push_error` in code under test | the validate grep fails the run on an expected error | test the inner function directly, or use `assert_push_error` / `assert_engine_error_count`; use `push_warning` for recoverable bad ids |
| `RenderingServer.global_shader_parameter_get` | errors outside the editor (editor-only) | store the values you set (static vars) and read those |
| Fresh clone, first import | `ERROR: Failed loading` on generated or gitignored inputs (LWTS: translation files; also reported for theme textures); second import is clean | run a warm-up import with `continue-on-error`, then the real import with the grep |
| Rebuild during a finished one-shot clip | `is_playing()` is false after `sit_enter` ends, rebuild falls back to idle, the seated character stands | keep `assigned_animation` and `current_animation_position`, restore and `pause()`; regression test `test_rebuild_after_a_finished_clip_holds_its_last_frame` |
| `animation_finished` | fires only for clips that reach their end, not loops | emit your own `clip_finished(clip)` from it and test both cases |
| Material `.tres` with `shader_parameter/x = null` | the shader default may not be what you think | set values explicitly or leave them out |
| Validation outside a git clone | script check silently skipped | always validate inside the clone |
| Editor rewrites `.import` files on open | unrelated diffs | do not commit them unless intended |

## 8. Tests (GUT)

- Skeleton: bone count and order on every body, finger chains, face bones under `Head`, foot leaves.
- Clips: count, loop flags, tracks only on shared bones, every clip keys every bone, plays on both
  bodies, feet on the floor, seated and lying poses reach the contract constants, seams.
- Look: every part path exists, every shipped GLB has an id, unknown ids warn and skip, headwear
  hides hair, each part fits its body, the proof looks resolve.
- Lighting: shader reads both globals, materials carry no shadow tint, project defaults, set and
  reset, fragment maths at default tints equals the approved constants.
- Character: builds each body with the right mesh count, rebuild replaces parts, motion scale,
  play and unknown clip warnings, finished clip held across rebuild, build scale widens shoulders not
  head, materials by slot and region, outline follows skinning (skin positions computed by hand:
  sum of weight x bone global pose x bind pose), seams skin together, no orphans.
- Write the regression test red before the fix and say so in the commit.
- Still to build in LWTS (later tasks): snapping to furniture anchors, a no-deep-clipping test with a
  long-garment fixture, a draw-call budget test.
