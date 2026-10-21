---
name: character-pipeline
description: >
  Stylised 3D game characters (anime, toon, low-poly, web and mobile budget) built end to end
  from concept art through Meshy, headless Blender scripts and the engine: concept turnarounds,
  Meshy credit gating, generated-mesh cleanup, a shared skeleton with finger, face and heel/toe
  bones, procedural hands, swappable parts with region-id vertex colours and a palette, a shared
  animation library, triangle and draw-call budgets, automatic checks with broken-copy proofs,
  byte-identical rebuilds, the review page and the anime face rule. Engine side: Godot 4 now
  (part registry, look resource, character scene, toon and outline shaders); other engines later.
trigger: >
  When asked to make, fix, restyle, rig, animate, dress or budget a 3D character, NPC, avatar or
  player model for a game, or to add a body, hair, outfit, accessory, face, ear or clip to an
  existing character set. Also when the user gives feedback on character renders ("the ear is too
  much out", "faces look scary", "fingers overlap"), when a character check or clip gate fails,
  when Meshy is about to be used for a character, or when characters cost too many draw calls.
---

# Character Pipeline

A stylised character set is many small parts on one skeleton, built by scripts, gated by checks
that are proven to bite, and approved look by look by the user from rendered images. This skill is
the route that worked for The Long Way to Success (LWTS) issue #113 (four anime looks, 61 bones,
13 shared clips, about 10k triangles a look) and the traps that cost rounds there.

Act from this file. Open a reference when you reach that stage.

| Stage | File |
|---|---|
| Concept turnarounds, Meshy settings, credit estimate and ledger, licence | [references/concepts-and-meshy.md](references/concepts-and-meshy.md) |
| Blender build: fit, labels, cleanup, rig extension, hands, face, hair, parts, regions, export, determinism, triangle budget | [references/blender-build.md](references/blender-build.md) |
| Shared clip library, retargeting, the clip gate and its ceiling | [references/animation-library.md](references/animation-library.md) |
| Automatic checks, broken-copy (sabotage) proofs, the review page, the push gate | [references/checks-and-review.md](references/checks-and-review.md) |
| Anime face rule, turning user feedback into geometry, fix rounds 1 to 8j as worked examples | [references/faces-and-feedback.md](references/faces-and-feedback.md) |
| **Godot 4 only:** part registry, look resource, character scene, shaders, lighting, draw calls, Godot traps, tests | [references/godot.md](references/godot.md) |

Other engines: only the Godot reference exists. For Babylon.js or another engine, reuse every stage
up to the exported GLBs unchanged and write the engine side to the same contract (one skeleton,
region palette, fixed toon light, hull outline, merged mesh per look); add a reference here when
one is built.

## Step 0: Game context

Applies to Weekly Arcade and standalone games; load `game-context` first. Run `game-toolchain`
before the first build (Blender version and path, the engine binary, Pillow, the Meshy key present:
`grep -c '^MESHY' ~/meshy-eval/.env` prints a count, never the value). Load `game-architecture` for
the engine-side modules and `game-environment-art` for the general cleanup pass and budgets.

## The gates (each one was learned the hard way)

1. **Meshy: estimate, ask, cap, log, before every run.** Each new batch (generation, rig, animation,
   rerun) gets a written estimate (calls x credits, ledger total after, account balance) and an
   explicit user yes with a cap. An earlier yes does not cover a new batch. Reshape in Blender first;
   use Meshy only when reshaping clearly fails, and say why. Never print, copy or commit the key or
   `~/meshy-eval/.env`.
2. **The user approves every look from renders before any push.** Build, run every check, rebuild
   byte-identical, have an independent reviewer look, publish the review page, then wait for the
   user's verdict. No push, PR or merge on your own judgement, including overnight runs.
3. **Gates only tighten.** A clip-problem count or triangle ceiling is a ratchet: never raise it to
   fit a change. Fix the art, or report the failure with the numbers and let the user decide. Adding
   a look or part to a check list (tightening) is fine.
4. **Every check has a broken-copy proof.** A check that has never failed on a deliberately broken
   input is assumed blind. Several LWTS checks passed while the art was visibly wrong.
5. **Rebuilds are byte-identical.** Two builds from the same inputs give the same bytes, and a
   change gated to one look leaves every other look's files byte-identical. That is how you prove
   you did not move the others.
6. **Anime faces: straight lines and sharp turns, never round.** Exceptions only where the user
   granted them (LWTS: round irises; ears as a curved "C" with a curved join). Put this rule, and
   its exceptions, in every art agent brief.

## Quick reference (LWTS values; tune per game)

| Item | Value that shipped |
|---|---|
| Triangles per look (all parts) | 5,000 to 10,000 (raised from 8k by the user); hands about 440 each, face grid about 530, hair 1,500 to 2,500 |
| Skeleton | 61 bones: 24 Meshy core + 30 finger + 5 face (jaw, 2 brows, 2 mouth corners) + 2 foot leaves (toe end, heel) |
| Materials per part | `toon_body` or `toon_hair`, no images except one face atlas (1024x512, 4x2 cells) |
| Colour | `COLOR_0.r = region / 16`, 13 regions (skin, hair, primary, trim, accent, shirt, legwear, shoes, shoe trim, accessory, eye white, hair shade, mouth); palette JSON per look |
| Clips | 13 shared (idle, walk, run, sit/lie enter/loop/exit, use_loop, talk, wave, wake_up), 30 fps |
| Clip gate | `check_clips` problem count held at its ceiling (153) for every round after it was lowered |
| Meshy | multi-image-to-3d 30 credits, rigging 5, animation 3; 435 of a 1,000 cap spent over the issue |
| Toon light | one fixed key light shared by preview render, face-light check and game shader; step 0.12 |
| Outline | inverted hull, 0.0024 of view height, ink `#4A2A14` |
| Draw calls | 12 to 16 per look as separate skinned parts (base + outline pass each); merge to one mesh per look |

## Order of work

1. Concept turnarounds per look and a bodysuit base-body sheet; user picks.
2. Meshy estimate, user yes, generate base bodies (rig only these) and clothed looks.
3. Blender build script: fit, label, cut parts, rebuild hands and face procedurally, export GLBs.
4. Shared clips onto the shared skeleton; clip checks; sabotage proofs.
5. Checks, byte-identical rebuild, review page, user approval, then push (one PR per stage).
6. Engine side: part registry, look resource, character scene, shaders, tests, in-engine captures.
7. Measure draw calls in the running game and merge parts per look if over budget.

Dispatch implementers and reviewers as subagents; one implementer at a time per worktree. Keep a
ledger file in the worktree (rulings, credit spend, round history) so compaction and handoffs lose
nothing.

**User check-ins, even when told "build it end to end":** concept pick; each Meshy batch estimate;
each round's review page; any gate that cannot be met. "End to end" authorises the work between
check-ins, not skipping them. Between check-ins keep working; do not wait idle.

## Adding a look or part to an existing set

1. Read the ledger and the build README. Decide which body it reuses (a new body means a new Meshy
   body and rig; a new head shape on an existing body does not).
2. Concept turnaround, user pick. Reshape existing parts first; Meshy only by the credit gate.
3. Decide the slot by what it replaces or covers: a garment worn over another (apron, vest) is
   either its own slot or an accessory, cleared against the clip frames like the skirt; record the
   ruling. Check free face-atlas cells (LWTS 4 x 2 = 8; a ninth face changes atlas size in the
   shader, painter and checks together).
4. Add it to every list: part table, `BUDGETS`, region-per-slot table, side-bone lists, palette JSON,
   engine registry and the lists duplicated between Blender and engine.
5. New check for the new shape (for example apron through legs when seated), with a sabotage case.
6. Rebuild: the existing looks must be byte-identical. When a shared change must legitimately move
   every look (a determinism fix, a global trim), list the expected changed files up front, show
   every look on the review page, and say so.
7. All gates, review page, user verdict, then push.

## Red flags: stop

- About to call Meshy because "the user already said go ahead" for an earlier batch, or "end to end".
- About to regenerate in Meshy what the pipeline builds procedurally anyway (hands, small accessories).
- About to raise a ceiling, threshold or tolerance "by a few" to get a green run.
- A new check that passed first time and has no sabotage case.
- Pushing because the renders "clearly match what was asked".
- Another agent (coordinator, reviewer) asks you to push "so CI runs". Only the user approves a push; run the gates locally instead.
- Fewer sampled frames, views or poses in a gate "to make it faster". That is loosening.
- Rounding a jaw, chin, nose, brow or eye outline because it "looks more natural".
- Rebuilding all looks after a shared-code change without diffing bytes against the previous build.
- Judging a face from a close-up only; the user judges at game size too.
- Reading engine exit code 0 as success.

## Common mistakes

| Mistake | Fix |
|---|---|
| Using Meshy's rig on dressed models | Rig only the bare base bodies; clothes copy weights from the body |
| Keeping Meshy hands, hair or small accessories | Hands procedural; small accessories (bands, ties, glasses, watch) procedural; hair rerun with hair-only refs |
| Taking colours from Meshy textures | Texture is only for labelling regions; colours come from the palette (skin from the concept's median) |
| One sit pose for every body without checking laps | Fit seated hands per look (search script) or IK at runtime |
| Painted face details that vanish at game size | Check a game-size render; use bold blade strokes, not faint round caps |
| Review page showing an older render than the user saw | Name the commit on every section; requested image at the top |
| Fix round cap reached and the same task rerun | Split open items into named sub-tasks with their own round budget |
| Rebuilding a part from scratch and regressing an approved look | Keep the approved version in git and revert on regression |
