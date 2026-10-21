# Blender Build

Stage 3: one headless Blender script turns raw Meshy output into shared-skeleton part GLBs.
Engine-neutral. The generic cleanup pass for props is in
`game-environment-art/references/blender-pipeline.md`; characters add fitting, rigging, parts and
deformation on top.

LWTS layout to copy (`tools/art/characters/`): `build_characters.py` (entry), `char_common.py`
(bone map, constants), `char_fit.py`, `char_labels.py`, `char_parts.py` (part table, export),
`char_openings.py`, `char_rig.py`, `char_hand.py`, `char_face.py`, `char_head.py`, `char_ear.py`,
`char_hair_shape.py`, `char_garment.py`, `paint_face_atlas.py`, `preview_look.py`,
`preview_palette.json`, `check_characters.py`, `build_clips.py`, `check_clips.py`, and a README
holding the run commands, the contract and one section per fix round.

```sh
Blender -b -P tools/art/characters/build_characters.py -- \
  --src ~/meshy-eval/<game>-characters/raw --out assets/models/characters \
  --test-out test/fixtures/characters
python3 tools/art/characters/paint_face_atlas.py
Blender -b -P tools/art/characters/check_characters.py     # exit 1 on any failure
```

Blender exits 0 when a `-P` script raises. Wrap `main()` so any exception exits 1.

## 1. The contract (write it first, check it always)

- One skeleton, same bone names and order in every part; one rest pose shared by all bodies
  (rest rotations agree to quaternion dot >= 0.9999). Her body keeps her bone lengths but takes the
  male bone directions.
- Feet at y = 0, forward +Z in the engine (-Y in Blender), heights per look within 2 cm.
- Each part: one mesh, one skin, every mesh node skinned, materials only `toon_body` / `toon_hair`,
  no images, `COLOR_0` with region ids, bodies carry `TEXCOORD_1` for the face atlas.
- Body-only regions (skin, eye white, mouth) never appear on clothing, hair or accessories. This
  rule kills the "hand print on the coat" bug at the source.
- The full body stays closed under every slot, so no slot combination can open a hole.

## 2. Bone map and rig extension

- Map Meshy names to yours in one table. Meshy's spine runs the other way: `Spine02` -> `Spine`,
  `Spine01` -> `Spine1`, `Spine` -> `Spine2`; `neck` -> `Neck`; `Head`, `head_end`, `headfront`
  merge into `Head`.
- Meshy gives 24 core bones. Add, in a script, before any clip work:
  - **Fingers (30):** index to pinky roots on one knuckle arc; middle and end joints at 0.49 and 0.76
    of the way to the tip; thumb base 0.35 of the way from wrist to web. +X curls toward the palm,
    Z spreads.
  - **Face (5):** `Jaw` pivots in front of the ear and points at the chin (+X opens); two brows
    move along local Y; two mouth corners at the painted corners. A face bone that moves 2 to 7
    vertices is inert: give it real face loops (see the face grid).
  - **Feet:** `ToeBase` plus unweighted `Toe_End` and `Heel` leaves snapped onto the shipped shoes
    (for running and foot IK).
- Users ask for these late ("hands don't have finger bones?", "face bones as well", "foot as well
  for running races"). Add them in the first build.

## 3. Fit and weights

- Fit each clothed mesh to its base body without a rig: uniform scale and height, then the posed
  body's limb angles; transfer the body's weights; undo the fit so the part sits in the shared rest
  pose. Seed every sampler (LWTS: `default_rng(113)`).
- Fit garments to a frozen body layout and hair to a frozen head. Blender's BVH breaks nearest-face
  ties by tree layout, so changing the head moved tops, trousers and shoes by up to 5 cm.
- Weight fixes Meshy needs: fade thigh weight into Hips 6 to 14 cm above the hip joint (Meshy put a
  third of the thigh weight 15 cm up the back and tore the blazer when seated); ramp forearm to hand
  from 6 cm above the wrist; cap the hand's first ring at 0.5 (0.8 swung the wrist 0.9 cm into the
  coat). Smooth weights once; more lets the body poke through.

## 4. Labels and parts

- Label each face by texture colour, the bone it follows, and per-look cut lines. Flood-fill skin
  flecks on clothing from their neighbours. Patches under 10 faces take their border's label, with
  a keep list for designed details (pocket welts).
- Cut bottoms before tops. Push parts out from the body: top 8 mm, bottom 6 mm, shoes 4 mm.
- Hole fill only loops of 30 cm or less that do not wind round a limb axis, so sleeves and necks are
  never capped. Run it again after decimation (collapse reopens holes).
- Rebuild openings procedurally: sleeves as 20-sided rings every 1.2 cm, coat tails 48-sided, collars
  as stands. Draw trim (lapels, cuffs, collars) from cut-distance fields, not from the texture.
  Mirror one side to get symmetric lapels.
- Overlaps that hide seams: hidden waist band on every bottom, 2.5 cm shoe collars under the trouser
  hem, coat tails at least 6 mm over trousers.
- Make small things procedurally: wristbands (rings), tie, neckerchief, watch, glasses. They are too
  small to cut cleanly and too visible to be ragged. Accessories are separate parts, never baked in
  ("bands should be an accessory and only on one hand").

## 5. Procedural hands (`char_hand.py`)

One template for all bodies, scaled shorter and slimmer for her. Palm: four 16-vertex rings with a
thumb pad. Five separate fingers, a ring at each knuckle, a pre-tip ring, a cap ring and a tip
vertex. Web quads keep fingers 4.5 to 7.4 mm apart at rest. Cut the arm 1 cm before the wrist and
zip it to the hand's first ring. Joint rings 50/50 between the two bones. About 434 to 440
triangles a hand. This is the most reusable piece of the kit.

## 6. Face, head and ears

- **Face grid:** a mirror-symmetric grid (LWTS 16 x 15, about 530 triangles) with loops following
  the painted mouth and brows, cast onto the decimated head (casting onto the full-resolution head
  carried the sculpt through and read as a pale mask), relaxed, zipped to the head.
- **Mouth:** split the lips along the mouth line (upper lip on `Head`, lower on `Jaw`), a mouth pocket
  behind the split in the mouth region, teeth, lower teeth and tongue mapped by UV onto the pocket
  walls (no extra triangles). Mouth interior a warm dark red (`#722A34`), not black.
- **Head shaping passes:** reshape, symmetrise, jaw width table, angular outline from knots with
  small soft corners (1.2 mm), jaw crease. See faces-and-feedback.md for the angular rule.
- **Face normals:** copy normals from a fitted ellipsoid so the toon terminator falls evenly either
  side of the nose; low-poly cheeks otherwise give jagged, uneven light.
- **Ears:** a ring outline (12 to 24 vertices) with a per-vertex stand-off from the head and a root
  ring sunk in the skin, so the ear is closed to the head from every side. Cut the hair's ear hole
  from the same outline. Full history in faces-and-feedback.md.
- **Face atlas:** painted in Pillow at 4x supersampling, 1024 x 512, 4 x 2 cells of 256 px (eyes,
  brows, mouth lines per face index). Texels under alpha 32 take the painted colour (LANCZOS ringing
  left a pink fleck otherwise). The exporter flips v.

## 7. Hair

Classify by colour, place by nose and chin then trimmed ICP (scale and translation only), cover
and clear the ears (97% of the ear radii), push out, remesh to target with holes up to 18 cm
filled, lift the fringe to brow height (a fringe over one eye kills the lit face width), add a
hair-shade region, smooth the rim with Taubin (0.5, -0.53; plain smoothing shrinks ear holes) and
lay it 0.5 mm off the skin. Rigid on `Head`; ponytail and nape up to 50% `Neck`. Hair 1,500 to 2,500
triangles. If a rebuilt hair regresses, revert to the approved one rather than rebuild again.

## 8. Region ids and palette

`COLOR_0` red channel = region / 16, written as a FLOAT_COLOR corner attribute, checked within
+/- 0.02. Regions: 0 skin, 1 hair, 2 primary, 3 trim, 4 accent, 5 shirt, 6 legwear, 7 shoes,
8 shoe trim, 9 accessory, 10 eye white (fixed), 11 hair shade, 12 mouth (fixed). The engine shader
looks up a per-character colour array, so one GLB serves every colourway.

`preview_palette.json`: `{"tokens": {name: hex}, "looks": {look: {"0".."12": hex or token}}}`. One
shared file for previews, checks and engine looks; a second made-up palette in a render script
caused "him and challenger need the same colour dress as her". Skin = the median skin colour of
the concept face. Missing regions render magenta. Never take colours from Meshy textures.

## 9. Export

```python
bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
    export_yup=True, export_apply=False, export_skins=True, export_def_bones=False,
    export_influence_nb=4, export_animations=False, export_vertex_color="ACTIVE",
    export_normals=True, export_texcoords=True, export_tangents=False, export_morph=False,
    export_materials="EXPORT", export_cameras=False, export_lights=False)
```

Drop degenerate and duplicate triangles first; set custom normals with
`normals_split_custom_set_from_vertices`.

## 10. Determinism (byte-identical rebuilds)

- Python set and dict-from-set order is hashed per process: every majority vote breaks ties in
  sorted order (`max(sorted(set(vals)), key=vals.count)`).
- Seed every RNG. Write clip GLBs byte by byte (numpy) if the exporter is not stable.
- Never read inputs from the output dir. A clean `--out` silently skipped clip clearing; the build
  now stops when `--clips` or `--skel-dir` is missing. Make every missing input loud.
- Gate each round: rebuild into an empty dir and compare every part, fixture and atlas byte for byte
  with the committed files; a change gated to one look must leave the others identical.

## 11. Triangle budget

LWTS ceiling 10,000 a look (5,000 floor), summed over the look's parts in a `BUDGETS` table that
must list every look (it once covered two of four). Shipped: him 9,962, her 9,995, challenger
9,995, teacher 10,000.

How it was met:
- Decimation targets per part (body about 2,100 before hands and face are added; tops 650 to 1,900).
- Hands and face (about 800 to 900 a body) are paid for by the tops, never by thinning hands or face.
- Every new detail is paid for explicitly, usually from hair or hidden geometry: 4 pocket triangles
  from one hair, an ear patch from another, an ear bowl ring dropped where it lay within 2 mm of the
  cone it became.
- A look at exactly the ceiling needs a trim before any further change. Say so in the report.
- A user request for more detail does not lift the ceiling. Try shape first (move existing
  vertices), then pay for added triangles from hair or hidden geometry and state the trade in the
  report; only the user can raise a ceiling, and only when asked directly.
- Detail that must read at game size is shape, not triangles (thicker wristbands came from shape).
