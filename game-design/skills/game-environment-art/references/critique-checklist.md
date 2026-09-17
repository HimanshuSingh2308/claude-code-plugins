# Critique Checklist (full)

The condensed gate is in `SKILL.md` section 9. This is the full 41-item pass, for a
review that has time to be thorough or for an agent using it as an acceptance gate.

Apply these to a screenshot from the real camera at real device resolution, plus two
derived images: a greyscale version and a flat-black-on-white silhouette version. A scene
that cannot produce those three images has not been reviewed.

**Read (does it communicate)**

1. In the silhouette image, can you name every prop?
2. In the silhouette image, do any two separate props merge into one blob?
3. In the greyscale image, can you tell foreground from background?
4. Name the first three things your eye lands on, in order. Are they the three you intended?
   Are more than three competing?
5. Is the focal point the highest-contrast area in the frame?
6. Is every interactive object distinct from every non-interactive one, by a rule you can state
   in one sentence, and by at least two cues (not colour alone)?
7. At real device size, can a first-time player tell what to do?

**Form and lighting**

8. Does every prop touch the ground with a visible contact shadow or baked AO?
9. Does anything float, or sink into the floor?
10. Pick three props at random: does the lit side face the same way on all three?
11. Are shadows coloured (cool) rather than grey or black?
12. Does every box-like prop show three distinct tones (lit, mid, dark)?
13. Is there a beveled highlight on every hard edge, at the same width everywhere?
14. Are any surfaces pure white or pure black where they should not be?

**Colour**

15. Is every colour in the frame from the palette table? Sample five pixels and check.
16. Scenery saturation in the 25-55 percent band, accent only on interactives?
17. Is the accent under about 10 percent of pixels?
18. Is there warm/cool separation between light and shadow?
19. Is the ground plane darker than the walls?
20. Does the distant part of the scene shift toward the fog or background colour?

**Composition and dressing**

21. Is at least a quarter of the floor empty?
22. Are props in clusters of 2-4 with gaps between clusters, rather than evenly spread?
23. Is anything in a perfectly even row that should not be?
24. Does any cluster tell a small story (use, wear, interruption)?
25. Are there *tangents*: two edges that just touch or just align, creating an accidental shape
    or flattening depth?
26. Does anything important sit at the frame edge, behind a UI element, or in a phone notch or
    safe-area band?
27. Is there exactly one hero prop, and is it at a focal point?

**Scale and consistency**

28. Compare three props to a known reference. Are the relative sizes believable?
29. Is texel density consistent? A checker texture on everything should show the same checker
    size on every surface.
30. Is detail consistent across props of the same tier? Any prop obviously from a different
    pipeline?
31. Are bevel widths identical across props?
32. Are normals consistently hard, or consistently smooth, across the set?

**Technical**

33. Draw calls under 50, triangles under 50k, materials under 8, texture memory under 32 MB?
34. Is any texture larger than 1024 without a written justification?
35. Any z-fighting? Check decals, floor overlays, blob shadows, wall art.
36. Any visible texture stretching? (The checker test again.)
37. Any visible seams where modules meet, or gaps you can see through to the void?
38. Does the scene hold 60 fps after 60 seconds on a throttled device?
39. Does any generated asset carry baked-in lettering? (Must be zero.)
40. Is every third-party asset's license recorded?

**The three-second test**

41. Look at the screenshot for three seconds, look away, describe it. If the description
    matches the intent, it works. If you describe "a bunch of shapes", it does not.

Symptom-to-fix lookup for anything that fails: [failure-modes.md](failure-modes.md).
