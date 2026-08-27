#!/usr/bin/env node
/* Captions and text overlays as ASS subtitles.

   ASS rather than Remotion for the caption layer: it supports fades, moves and
   colour transforms, ffmpeg burns it in one filter, and it adds no npm install
   and no headless-browser render pass to a scheduled job. Remotion stays worth
   it only for overlays that genuinely need layout or data-driven motion.

   Two outputs, deliberately different:
   - .ass  word-grouped pop captions, burned in. Group timings are *estimated*
           inside each line by character weight.
   - .srt  one cue per line, using only the measured per-line WAV durations. No
           estimation at all, so it is the honest artifact to hand to YouTube or
           Premiere. */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/* Bottom margin has to clear each platform's own UI or the punchline sits under
   a Send button. Reels stack caption, handle and actions over the lower third,
   so it is the tightest of the three. */
export const SAFE_AREAS = {
  reel: { w: 1080, h: 1920, marginV: 480, marginH: 140 },
  short: { w: 1080, h: 1920, marginV: 360, marginH: 100 },
  long: { w: 1920, h: 1080, marginV: 120, marginH: 120 },
};

/* The channel display face, vendored at assets/fonts. Arial Black was the old
   default and it is the single most recognisable "made in a hurry" signal a video
   can carry - libass will happily find it on any Mac, which is exactly the
   problem. libass resolves this name from FONT_DIR, which render.mjs passes to the
   subtitles filter as fontsdir, so the caption face does not depend on what
   happens to be installed. */
const FONT = process.env.CONTENT_CAPTION_FONT || 'Anton';
export const FONT_DIR = process.env.CONTENT_FONT_DIR
  || path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'assets', 'fonts');

function assHeader({ w, h, marginV, marginH }) {
  // &H00BBGGRR. Outline 6 plus a shadow keeps text legible over a bright,
  // high-contrast game plate without a background box eating the gameplay.
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,${FONT},92,&H00FFFFFF,&H000000FF,&H00101010,&H80000000,-1,0,0,0,100,100,1,0,1,6,3,2,${marginH},${marginH},${marginV},1
Style: Accent,${FONT},92,&H0055E0FF,&H000000FF,&H00101010,&H80000000,-1,0,0,0,100,100,1,0,1,6,3,2,${marginH},${marginH},${marginV},1
Style: Hook,${FONT},104,&H00FFFFFF,&H000000FF,&H00101010,&H80000000,-1,0,0,0,100,100,2,0,1,7,4,8,${marginH},${marginH},180,1
Style: Stat,${FONT},130,&H0055E0FF,&H000000FF,&H00101010,&H80000000,-1,0,0,0,100,100,2,0,1,8,4,5,${marginH},${marginH},0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}

function ts(ms) {
  const cs = Math.round(ms / 10);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
}

function srtTs(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
}

/* Two or three words at a time, and never a group so long it wraps to three
   lines on a phone. Character count drives the split because a group of three
   short words reads faster than a group of three long ones. */
function groupWords(text, maxChars = 22) {
  const words = text.split(/\s+/).filter(Boolean);
  const groups = [];
  let cur = [];
  for (const w of words) {
    const candidate = [...cur, w].join(' ');
    if (cur.length && (candidate.length > maxChars || cur.length >= 3)) {
      groups.push(cur.join(' '));
      cur = [w];
    } else {
      cur.push(w);
    }
  }
  if (cur.length) groups.push(cur.join(' '));
  return groups;
}

function escapeAss(s) {
  return s.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/\n/g, '\\N');
}

/* Speech is not uniform, so character-proportional timing inside a line is an
   approximation. It is a safe one only because the line's own start and end are
   measured: error cannot accumulate past the end of the line it lives in. */
function distribute(groups, startMs, durationMs) {
  const weights = groups.map((g) => Math.max(g.length, 4));
  const total = weights.reduce((a, b) => a + b, 0);
  let t = startMs;
  return groups.map((g, i) => {
    const share = Math.round((weights[i] / total) * durationMs);
    const seg = { text: g, startMs: t, endMs: i === groups.length - 1 ? startMs + durationMs : t + share };
    t = seg.endMs;
    return seg;
  });
}

/* A word wrapped in *asterisks* in the VO script gets the accent colour, which
   is how the script writer flags the one word per line that carries the beat. */
function styleFor(text) {
  return /\*/.test(text) ? 'Accent' : 'Caption';
}

export function buildAss({ vo, overlays = [], platform = 'reel', offsetMs = 0 }) {
  const area = SAFE_AREAS[platform] || SAFE_AREAS.reel;
  const events = [];

  for (const line of vo.lines || []) {
    const groups = groupWords(line.text.replace(/\*/g, ''));
    const marked = groupWords(line.text);
    const segs = distribute(groups, line.startMs + offsetMs, line.durationMs);
    segs.forEach((seg, i) => {
      const style = styleFor(marked[i] || '');
      // 90ms fade in, 60 out: enough to feel like a cut, not a dissolve.
      const body = `{\\fad(90,60)}${escapeAss(seg.text.toUpperCase())}`;
      events.push({ start: seg.startMs, end: seg.endMs, style, text: body, layer: 0 });
    });
  }

  for (const ov of overlays) {
    const start = (ov.atMs || 0) + offsetMs;
    const end = start + (ov.durationMs || 2000);
    const style = ov.style || 'Hook';
    // Stat callouts punch in; hooks just fade. A scale transform on a 130px
    // font is the cheapest thing that reads as "editing" rather than "subtitle".
    const anim = style === 'Stat'
      ? `{\\fad(80,180)\\fscx60\\fscy60\\t(0,160,\\fscx110\\fscy110)\\t(160,260,\\fscx100\\fscy100)}`
      : `{\\fad(140,140)}`;
    /* `marginV` per overlay, because one style cannot serve both orientations.
       Hook's own MarginV is 180: the top 9% of the 1080x1920 frame the styles
       were tuned for, and the top 17% of a 1920x1080 one. A portrait plate in a
       landscape frame had pillarboxes to print into; a native desktop capture
       fills the frame, so the band that was empty is now a heading. Zero means
       "inherit the style", which is what every existing shot spec gets. */
    events.push({
      start, end, style, layer: 1,
      marginV: ov.marginV || 0,
      text: `${anim}${escapeAss(String(ov.text).toUpperCase())}`,
    });
  }

  events.sort((a, b) => a.start - b.start || a.layer - b.layer);
  const body = events
    .map((e) => `Dialogue: ${e.layer},${ts(e.start)},${ts(e.end)},${e.style},,0,0,${e.marginV || 0},,${e.text}`)
    .join('\n');
  return `${assHeader(area)}${body}\n`;
}

export function buildSrt({ vo, offsetMs = 0 }) {
  return (vo.lines || [])
    .map((l, i) => {
      const text = l.text.replace(/\*/g, '');
      return `${i + 1}\n${srtTs(l.startMs + offsetMs)} --> ${srtTs(l.endMs + offsetMs)}\n${text}\n`;
    })
    .join('\n');
}

/* CLI: node lib/captions.mjs vo.json outDir [platform] [overlays.json] */
if (import.meta.url === `file://${process.argv[1]}`) {
  const [voPath, outDir, platform = 'reel', overlaysPath] = process.argv.slice(2);
  if (!voPath || !outDir) {
    console.error('usage: captions.mjs <vo.json> <outDir> [platform] [overlays.json]');
    process.exit(2);
  }
  const vo = JSON.parse(readFileSync(voPath, 'utf8'));
  const overlays = overlaysPath ? JSON.parse(readFileSync(overlaysPath, 'utf8')) : [];
  const ass = path.join(outDir, 'captions.ass');
  const srt = path.join(outDir, 'captions.srt');
  writeFileSync(ass, buildAss({ vo, overlays, platform }));
  writeFileSync(srt, buildSrt({ vo }));
  console.log(`wrote ${ass}\nwrote ${srt}`);
}
