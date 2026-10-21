# Concepts and Meshy

Stage 1 and 2 of the character pipeline. General Meshy facts (pricing, licence tiers, what it is
bad at) are in `game-environment-art/references/generative-tooling.md`; this file is what is
specific to characters.

## 1. Concept references

**One turnaround per look, plus a base-body sheet per skeleton.**

- Per look: front, side and back in one image, A-pose with arms about 30 degrees from the body,
  plain light background, no text. Made with Nano Banana (load the `nano-banana` skill). Resize to at
  most 1024 px before it goes to Meshy.
- Redo the image when the three views disagree, the hands touch or fuse to the body, or the outfit
  drifts between views. Meshy reconstructs exactly those errors.
- Base-body sheet per skeleton (LWTS: him and her): the same pose in a skin-tight bodysuit, bald.
  Clothed meshes have nothing under the clothes, so swappable outfits need a closed body to sit on.
- Parts are not separate concepts. They are cut out of the clothed meshes by colour (see
  blender-build.md). When a part fails and must be regenerated (LWTS: hair), make part-only
  references (hair front, side, back) for that rerun.
- Prompt wording matters on reruns: "Keep exactly this hair" fought every restyle; "restyle the hair
  exactly as described below" worked.
- Keep the concepts in the repo (LWTS: `docs/art/113/`); they are the standard every face and
  proportion round is measured against, at the same scale and camera.
- Settle the roster early. The user may add looks (LWTS: a rival, then a teacher). Extra looks
  that share a skeleton cost no new Meshy body: same body, different head shape and parts.

## 2. The credit gate

Write the estimate, then stop until the user answers. Every batch, every time.

```
Meshy batch: challenger hair rerun
Calls: 2 x multi-image-to-3d at 30 = 60 credits
Ledger: 375 of 1,000 cap spent -> 435 after
Account balance: 2,119 (other projects share it)
Why Meshy: reshaping the current hair failed on X and Y (renders in review/r8)
Approve with a cap?
```

- An approval covers that batch and cap only. A later rerun, a rig call, or animation lookups are a
  new batch.
- Prefer one cheap probe (one variant) before a batch of variants.
- Before using it, ask whether reshaping in Blender can do it. LWTS rule from the user: "you can use
  meshy but only if it's required".
- Paid plan for anything that ships (private assets). Free tier output is CC BY 4.0 and drags an
  attribution duty into the game.

## 3. Endpoints and settings that worked (Meshy 7, Oct 2026)

| Call | Cost | Settings |
|---|---:|---|
| `POST /openapi/v1/multi-image-to-3d` | 30 | `ai_model: meshy-7`, `topology: quad`, `target_polycount: 30000`, `should_remesh: true`, `should_texture: true` (texture used only to label regions), `enable_pbr: false`, `pose_mode: a-pose`, `remove_lighting: true` |
| `POST /openapi/v1/rigging` | 5 | `input_task_id`, `height_meters`; walk and run come free with the rig |
| `POST /openapi/v1/animations` | 3 | `rig_task_id`, `action_id` (library ids, e.g. idle, stand-to-sit, sit-to-stand, talk, wave, sleep) |
| `GET /openapi/v1/balance` | 0 | read-only |

- Raw output is about 55k triangles a model and needs heavy reduction.
- The rig call is worth its 5 credits on each bare base body: it supplies the 24 core bones and
  usable body weights, which the build script extends (fingers, face, feet). Rig only the bare base bodies. Rigs on dressed models deformed the clothes badly (20 credits
  wasted in LWTS); clothes take the body's weights in Blender.
- Mixamo is out for unattended work: it needs an interactive Adobe login.

## 4. The runner and ledger

A small script outside the game repo (LWTS: `~/meshy-eval/lwts-characters/scripts/meshy_lwts.py`):

- Reads the key from `.env` into the process; never prints it, never writes it into the repo.
- Appends every call to `ledger.jsonl` (task id, endpoint, credits, time, purpose).
- Counts spend from each task's `consumed_credits`, not from balance differences, because other
  projects share the account.
- Refuses to submit when `spent + cost > cap` for the batch or for the project. Checking only
  `spent >= cap` lets the last call overshoot.
- Raw downloads go outside the repo (`~/meshy-eval/<game>-characters/raw/`) and are kept as exact
  byte copies; the build script reads them with `--src`.
- Record task ids and spend in a repo doc (LWTS: `docs/art/113/README.md`, "Meshy runs") so a
  future session knows the provenance and licence.

## 5. LWTS spend, for calibration

| Batch | Credits | Ledger after |
|---|---:|---:|
| 6 multi-image (2 base bodies, 4 clothed looks) + 6 rigs (4 unused) | 210 | 210 |
| 15 animation calls | 45 | 255 |
| Hair rerun, 4 runs | 120 | 375 |
| Challenger hair, 2 runs | 60 | 435 |

The planned worst case was 460 of a 1,000 cap. What Meshy did not deliver usably: hands (decimated,
no knuckle loops), small accessories (ragged), hair on the first pass (looked scanned, not drawn),
shoe sub-regions, and a skin hand print baked into a blazer texture where the hand hung beside the
hip.
