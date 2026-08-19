# Channel faces

Vendored, not linked: a plugin that renders type has to carry the type, or the
first machine without `~/Documents/wa-brand` silently falls back to a system
sans and the video stops looking like the channel.

| File | Role | Used at |
| --- | --- | --- |
| `Anton-Regular.ttf` | display - headlines, the count-up, kickers, CTA button | display sizes x 1.03 |
| `Archivo-Variable.ttf` | body - labels, chips, the address bug, captions | weight 600, sizes x 1.0 |

Both SIL Open Font License 1.1; the licences are next to them and must ship with
any redistribution.

Two gotchas that cost a re-render each:

- Anton's caps are ~3% shorter than Archivo's at the same nominal size, which is
  where the 1.03 display multiplier comes from. Re-check headline clearance after
  any size change - cap bands are what collide with cards.
- `Archivo-Variable.ttf` is a variable font. PIL selects an instance
  (`font.set_variation_by_name('SemiBold')`); ffmpeg `drawtext` does NOT and will
  render weight 400. Anything burned in by ffmpeg needs a static instance.
