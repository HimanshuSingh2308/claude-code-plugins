# Checks and Review

Stage 5. Checks catch what can be measured; the user catches the rest from renders. Neither is
optional.

## 1. Part checks (`check_characters.py`)

Read the GLBs raw (glTF JSON plus binary chunk), so you check exactly what the engine imports, not
Blender's view of it. Exit 1 on any failure; wrap `main()` so a crash also exits 1.

| Group | Checks (LWTS thresholds) |
|---|---|
| Structure | one mesh, one skin, bone list equal to the reference body in order, every mesh node skinned, materials exactly `[toon_body]` or `[toon_hair]`, no images |
| Regions | `COLOR_0` present, values in 0..12, allowed regions per slot prefix, body-only regions never on other parts |
| Symmetry and reach | parts reach both sides unless listed one-sided; side bones weighted on both sides; head sides within 2 mm in jaw and cheek bands |
| Global | identical rest pose; inverse binds match exactly one body (1e-4); heights; feet at y=0; toes +Z; triangle budget per look; atlas size; a long-garment fixture passes the part check |
| Tops | sleeve ends (no vertex past 1.5x the loop's median radius), sleeve fit (<= 2 cm off the arm), front opening, posed sleeves in walk, sit and raise, collar (>= 150 faces, mirror 0.95), collar gap 0.2 to 2.8 cm |
| Hands | 60 degree curl moves the tip >= 1 cm and other tips < 3 mm; no finger crossings at rest, walking, seated or one finger curled; gap >= 1.5 mm; no spikes |
| Face | each face bone moves >= 6 vertices by >= 2 mm; jaw 15 degrees parts lips >= 4 mm; chin moves >= 5 mm while neck and other parts move < 1 mm; face relief median <= 0.6 mm |
| Face light | lit width on the shadow side >= 90% of the lit side at eye, cheek and mouth rows, with the same light as preview and game |
| Feet | toe and heel leaves within 1.5 cm of the shoe tip and heel, on the ground within 5 mm |
| Poses | walk arms clear the body; seated hands on the thighs (palm down 0.85, 0.4 to 0.7 along the thigh, each over its own thigh); seated skirt 3 mm clear |
| Accessories | wristband 1 to 4 mm off the skin; glasses 2 to 12 mm, bridge <= 5 mm; bow >= 0.27 of shoulder width (readable at game size); no tie vertex over the coat |

### Checks that lied in LWTS (design against these)

- A probe pose that was inverted (raise pose checked the wrong way).
- A skirt check that could not see above the hips; a tie check that could not see the tip.
- A tolerance (`SIT_ACROSS 0.05`) that passed hands crossed over the lap.
- A depth check that flagged hem faces falsely, which trains everyone to ignore it.
- Running the validator outside a git clone silently skipped the script check.
- A height check that measured the neck joint, not the top of the head.
- Building into a clean output dir silently skipped clip clearing.

## 2. Broken-copy proofs

Every check gets a sabotaged input that must make it fail, on the named check, with a readable
message. Build the broken copy from the real one by one targeted change; never hand-edit a GLB.

- Clips: `--sabotage KIND` in the clip builder (14 kinds, see animation-library.md).
- Parts: LWTS has no committed harness for `check_characters.py`; its evidence is historical (a
  real commit failed relief 0.61 and unmirrored corner weights until fixed). **Do better:** add
  `--sabotage` to the part builder (drop a finger ring, paint skin region on a sleeve, shift one ear
  2 mm, swap two bones, add 50 triangles over budget, write region 13) and a test that runs each.
- Engine side: a unit test that was red before the fix (see godot.md).
- A check you add mid-round is not done until its sabotage case fails and the real build passes.

## 3. The round, in order

1. Implementer subagent makes the change, gated to the looks it should touch.
2. Build twice (or rebuild into an empty dir) and compare bytes with the committed files. Only the
   intended files differ.
3. Run every check: part checks, clip gate (count not above the ceiling), engine import with output
   grepped for errors, unit tests. Report counts (tests passed, triangles per look, clip count).
4. Independent read-only reviewer subagent measures the result (not just looks), verdict
   Approve / Approve with follow-ups / Needs fixes.
5. Renders to the review page (below).
6. User verdict. Only then commit to the PR branch and push. One PR per stage.

Use governor tiers honestly: build briefs start with "Implement" or "Fix", reviewer briefs with
"Review", and keep the other tier's words out of the opening.

## 4. Renders and the review page

- `preview_look.py`: orthographic camera, emission-only toon material with the game's fixed key
  light and step, inverted-hull outline at the game ratio, palette from the shared JSON, magenta for
  missing regions. Preview, face-light check and game shader use the same light so they agree.
- Render outside the repo (LWTS `~/meshy-eval/<game>-characters/review/rN/`), convert sheets to JPG
  for the page.
- Standard set for a feature round: vs concept front and side (same scale), front zoom, three-
  quarter back, top, game size (a head about 100 px tall), the feature through the clips, and all
  looks side by side at one scale. Before/after columns labelled with commit hashes.
- One shared review page (an Artifact) updated each round: a section per round, the commit it
  shows, the image the user asked for at the top of its section, the measured numbers next to the
  pictures (for example ear stand-off per third, before and after).
- A reviewer must judge the same render the user sees; stale images caused disagreement.

## 5. Handling the user's verdict

- Approval words seen: "looks good to me", "approved", "this version looks good to me you can
  proceed". Anything else is feedback for another round.
- Percent requests ("iris 30% smaller", "lips 40% longer", "chin up 8%") are turned into mm or px,
  applied, and reported back in the same units; very small changes may not be visible ("I don't see
  any changes in the lips"), so say the measured delta and offer a bigger one.
- Vague feedback ("her face is worst of them all") gets one question, then a side by side with the
  concept at the same scale.
- Keep a ledger file in the worktree (rulings, spend, round history). Write rulings there, not only
  in chat; compaction loses chat.
