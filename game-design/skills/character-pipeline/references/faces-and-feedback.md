# Anime Faces and User Feedback

How the LWTS faces got from "wtf happened to their faces?" to "looks good to me". Use the rounds as
worked examples of turning a one-line comment into a measured geometric change.

## 1. The rule

User, LWTS #113: "as they are anime char nothing should be round, on their face always either
straight line or sharp turns instead of rounded face features".

- Face outline, jaw, chin, nose, brows, mouth, eye outlines and lids: straight segments meeting at
  defined corners. A V chin for younger looks, a square jaw for the older teacher.
- Female looks may use gentler angles and a slightly wider chin point, never curves.
- "Slightly round brow" means a slight angular arch: straight segments with a break near the outer
  third.
- Granted exceptions: round irises (asked for); **ears read as a curved "C", including a curved join
  where the ear meets the head**. A straight join was called wrong.
- Pass the rule and its exceptions into every art agent brief. A fresh agent will round things
  "to look natural" and will make ears angular by applying the rule where the user lifted it.

## 2. Reading at game size

- Judge every face change at close range and at game size (head about 100 px tall). Wrinkles and
  under-lip marks "very subtle, won't be visible at game play size" were redrawn as bold blade
  strokes; faint round-capped strokes vanish.
- Small things the user will look for: teeth and tongue when talking, a closed-mouth expression
  matching the concept, brows thick enough to read, a tie or bow big enough to see.
- Compare against the concept at the same scale and camera, side by side. Eyeballing drifted for
  four rounds ("faces are still off, they are looking more towards scary side").

## 3. Rounds as worked examples

| Round | User said | What it meant | Geometric fix |
|---|---|---|---|
| 3d-1 | "wtf happened to their faces?" | face read as a pale mask, cheek creases, smeared mouth | features measured on the concept crops; face grid cast on the decimated head |
| 3d-4 | "we need sharp chin", "sharp edges instead of soft round faces", "ear looking a bit unnatural" | jaw and chin too soft; ears were discs | V jaw (square for the teacher); ears built as their own mesh (about 2.5 x 5 cm, tilted, about 9 mm stand-off) |
| 5 | brows feminine, ears read as coins, bald ring round the ears | | flat brow; ear as bowl plus ridge; hair cleared round the ear |
| 6 | "iris ... only cover about 60%", "lips length by 40%", nose "slightly pointy and sharp", challenger "decrease by 3% both sides", brows 2% thicker | percent changes per look | iris radius; brows as polygons; nose ridge 4 mm; angular outline knots; jaw crease; a separate challenger head |
| 6 | "eyebrows are missing from teacher" | glasses frame sat at brow height; a depth test dropped face triangles | brows raised about 11 px; face grid exempt from the depth test |
| 7 | chin up 8%, lips 5% longer, "noses are still not done" | | chins moved; nose ridge 12 / 9.5 mm |
| 8 | lips 30% and 35% longer, challenger eyes like him with round iris | | mouth width; lip split as long as the paint; hooded almond eye, round iris |
| 8b | "no teeth while talking", "tongue and bottom teeth", "black inside the mouth ... better color" | | teeth, lower teeth, tongue mapped on the pocket walls; interior `#722A34` |
| 8b | "ears needs to be extrude outward a bit" | his ear hid behind cheek and hair | ear flared out on a hinge (40 degrees for him) |

## 4. The ears, 8e to 8j (the clearest lesson)

| Round | User said | Diagnosis | Change | Result |
|---|---|---|---|---|
| 8e | (extrude outward) | flat ear | rigid flare about a hinge: him 40, challenger 26, teacher tipped -20 to clear the glasses | ears read as wedges from the front |
| 8f | "his ears need work, hers are fine" | front: top read as a sharp point; side: narrower oval than the concept | fuller outline per vertex (radius share 1.17 back, 0.93 top), side widths matched to the concept within about 0.02 | closer, still a wedge |
| 8g | "when it's connecting with head currently it's straight line but it should be curved, whole ear should look like a 'C' letter" | the join to the head was a straight line | smooth periodic Catmull-Rom outline on 24 vertices; per-vertex stand-off instead of a rigid hinge: 17.1 mm back, 2.5 top, 0 front; root ring sunk in the skin | "approved" |
| 8h | "challenger ear ... more of a closed c", "also the teacher's ear" | rigid hinge gave a pointed top | the 8g approach on their outlines, stand-off 18.0 back, about 3 top, 1.1 front, 0 lobe; dropped the inner bowl ring to stay under 10,000 triangles | delivered |
| 8i | "it's just too much out", "from the top" | top third stood 20 mm off the head | stand-off moved to the back and lower back: top third 20.3 to 10.8 mm | "it looks v rotated" |
| 8j | "it should be proportional, the middle is too much out, it looks v rotated" | pulling only the top in left middle and lobe at 18 mm, so the ear read as a tilted V | **even stand-off** at back, upper back and lower back (about 11.5 / 12.0 / 11.5 mm per third, about 0.6 of his reach), falling round top and lobe: an upright C | "looks good to me" |

Lessons:

- **Before acting on a one-line comment, write its readings down.** "Too much out" could mean the
  whole ear, the top, or the proportion. Pick the reading that keeps the shape's proportions (here:
  reduce the stand-off evenly), and when two readings stay plausible, render both side by side on
  the review page and let the user point. A question with pictures beats a guessed round; 8i guessed
  "the top only" and cost a round.
- **Fix the ratio, not one region.** Moving one third of the ear changed the perceived rotation. When
  feedback names one region, check what the change does to the shape's proportions and silhouette
  from the front, and report all thirds.
- **Measure what the user sees.** Report the front-view reach per third of the height and where the
  widest point sits, before and after, and render all looks side by side at one scale.
- **Gate the change to the looks named.** "His ears need work, hers are fine": only his ear moved;
  the other looks rebuilt byte-identical. "Check others as well, keep the changes minimal" widens
  the review, not the edit.
- **Pay for it inside the feature.** The smoother ear cost triangles; the bowl ring went, not hair.
- **Keep dependent parts still.** The hair stayed fitted on the old ear oval (`fit_oval`) so its
  input and the clip gate did not move; only its ear hole follows the new outline.
- **A rule has edges.** The angular rule does not reach the ears; the user's later exception wins.

## 5. Other feedback worth knowing in advance

- Modesty first: "her seating posture still misses the skirt properly wrapping her thighs and
  shouldn't show anything under it". Treated as top priority; a skin-through-cloth check runs on
  every clip frame.
- "while walking we should also rotate the hand ... no one walks like this" (palms to the body).
- "some fingers are overlapping each other ... every char's fingers have some problems": procedural
  hands and a finger-crossing check.
- "collars are a little far from his neck": collar gap 0.5 to 1.5 cm for him.
- "hair for teacher looks like a cap": hair needs strands and a shade region, not a shell.
- "round 2 hairs were better than round 3": revert to the approved version from git.
