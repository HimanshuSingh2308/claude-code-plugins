# Shared Animation Library

Stage 4. Every look plays the same clips on the same skeleton. Engine-neutral up to `clips.glb`;
the Godot import is in godot.md.

## 1. The library

LWTS shipped 13 clips at 30 fps (`build_clips.py`, `clip_common.py`):

| Clip | Loop | Made from |
|---|---|---|
| idle | yes | Meshy idle, shoulders relaxed, palms to the thighs |
| walk | yes | the rig's walk, timed to 1.2 m/s, in place |
| run | yes | the rig's run (4.55 m/s), in place, knees capped about 92 degrees |
| sit_enter / sit_loop / sit_exit | loop only | Meshy stand-to-sit and sit-to-stand, joined on sit_loop's first key |
| lie_enter / lie_loop / lie_exit | loop only | composed: sit on the bed edge, Meshy sleep at half speed, wake_up |
| use_loop | yes | idle with the hands working at a counter target |
| talk | yes | Meshy talk, jaw 0 to 8 degrees at about 4 syllables a second |
| wave | no | Meshy wave, palm turned toward the other person |
| wake_up | no | lie_loop's first key to sit_loop's |

Design the list against what the game needs (furniture anchors, conversation, races) before
buying animation calls. Contact clips depend on furniture: seat height (0.30 m), bed height,
counter hand target are contract constants shared with the engine and with room props.

## 2. Retargeting

- Retarget each of Meshy's 24 bones by its world rotation relative to bind, applied on the shared
  rest world rotation ("share the joints, not the rolls"). Bones Meshy does not drive (fingers,
  jaw, brows, mouth corners) stay at rest unless you key them in script: per-clip finger curls, jaw
  for talk.
- Translation on Hips only. The engine scales hip motion per body (see godot.md, `motion_scale`).
- Fix-ups users asked for in LWTS, each a script pass: palms turned to the body when walking (not
  facing camera or sky), shoulders relaxed, less knee bend in walk, a less upright stance for one
  body, a feminine walk variant for her, wave palm toward the other person, seated hands resting on
  the thighs. Two-bone IK for feet and hands on contact clips.
- One shared sit pose cannot rest hands on four different laps. LWTS searched one pose that works
  on every look (`fit_sit_hands.py`, about 12 minutes, seeded); per-look arms or runtime IK is the
  better long-term answer.

## 3. The clip gate (`check_clips.py`)

Plays every clip on every look and counts problems; exit 1 on any. Checks:

- Structure: clip count, every bone keyed, translation on Hips only, 30 fps.
- Limits: finger curl <= 45 degrees (thumb 30), backward bend 0.5, spread 15, twist 2, jaw 0 to 8,
  talk opens >= 4.
- Seams: loop and transition seams meet within 1 degree / 5 mm; no jump over 2x neighbouring steps.
- Palms (medial >= 0.7), shoulders (rise <= 5 mm), arms clear the torso in walk.
- Sit and use hands: palm down >= 0.85, within 5 cm of target; seat height -2.5 to +1 cm.
- Cloth: sleeves, skirt, finger crossings in every sampled frame.
- Skin showing through clothes: flat ID render from 16 views at 480 px, fail at >= 3 px.
  This is also the modesty check: a seated skirt must wrap the thighs and show nothing under it.

### The ceiling

Some problems were accepted with the user's knowledge (one-pixel skin speckles in extreme
frames), so the gate tracks a count: 171, 170, 159, 158, then 153 after the round 5 hair, and 153
every round since.

**The count only goes down.** If a change raises it, fix the change. In LWTS round 8h a sub-millimetre
hair shift reframed the clips and gave 154 (one new speckle); the fix kept the hair fitted on the
old ear oval, back to 153. If you cannot fix it now, show the renders with the number stated
("gate 156 against 153, one sit frame clips a thigh, fixing next"), and let the user decide. Never
edit the ceiling, a tolerance or a sample count to get green.

## 4. Sabotage kinds (broken-copy proofs for the clip gate)

`build_clips.py -- . --sabotage KIND --out /tmp/clips_sabotaged.glb`, then
`check_clips.py -- . --clips /tmp/clips_sabotaged.glb` must fail on the named check:

| Kind | Change | Must trip |
|---|---|---|
| palms_out | forearms turned 180 degrees | palms |
| arm_in_torso | upper arms swung 35 degrees in | arms |
| shoulders_up | collar bones +15 degrees | shoulders |
| sit_hands_float | upper arms 8 degrees out | sit hands |
| sit_hands_cross | hands 10 cm inward | sit across |
| finger_back | index -50 degrees | limits |
| finger_over | middle finger 70 degrees a joint | limits |
| jaw_wide | 15 degrees | limits |
| loop_seam | Spine1 20 degrees off on the last key | seams |
| sit_enter_end | head 10 degrees off | seams |
| wake_up_start | arms 10 degrees off | seams |
| skin_show | thighs +40 degrees | skin |
| seat_sink | Hips -5 cm | seat |
| use_short | elbows +30 degrees | use hands |

Add a kind with every new check. Run them all after changing a check.

## 5. Order matters

Clothes are cleared against clip frames (her skirt against sit, lie and run; his shirt covered in
named run frames). So: build clips, then parts, when either changes. Reading clips or skeletons
from a missing path must stop the build, not skip the clearing.
