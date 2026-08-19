#!/usr/bin/env node
/* Master render: gameplay plate + per-line VO + music bed + burned captions.

   ffmpeg does all of it in one graph, so a scheduled run needs no GUI app and no
   headless browser. Everything here is deliberately one pass: re-encoding a
   1080x1920 plate twice is where render time goes on a laptop that also has to
   run the capture.

   Before any of that it refuses to render a starved plate. A CDP screencast on a
   loaded machine silently delivers a fraction of the frames it should - the
   file's container fps still reads 24 because duplicate frames pad it out - and
   the result looks like a slideshow. That failure is invisible in ffprobe and
   obvious to a viewer, so it is checked rather than trusted. */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { FONT_DIR } from './captions.mjs';

const FFMPEG = process.env.CONTENT_FFMPEG || 'ffmpeg';
const FFPROBE = process.env.CONTENT_FFPROBE || 'ffprobe';

export const PRESETS = {
  reel: { w: 1080, h: 1920, fps: 30, maxMs: 90000, crf: 20 },
  short: { w: 1080, h: 1920, fps: 30, maxMs: 180000, crf: 20 },
  long: { w: 1920, h: 1080, fps: 30, maxMs: 3600000, crf: 21 },
};

function run(bin, args, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', capture ? 'pipe' : 'ignore', 'pipe'] });
    let out = '';
    let err = '';
    if (capture) proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.stderr.on('data', (d) => { err += d.toString(); });
    proc.on('error', (e) => reject(new Error(`${bin} failed to start: ${e.message}`)));
    proc.on('close', (code) => {
      if (code === 0) resolve({ out, err });
      else reject(new Error(`${bin} exited ${code}\n${err.split('\n').slice(-25).join('\n')}`));
    });
  });
}

export async function probe(file) {
  const { out } = await run(FFPROBE, [
    '-v', 'error', '-of', 'json',
    '-show_entries', 'format=duration:stream=codec_type,width,height,nb_frames,avg_frame_rate',
    file,
  ], { capture: true });
  const j = JSON.parse(out);
  const v = (j.streams || []).find((s) => s.codec_type === 'video') || {};
  const a = (j.streams || []).find((s) => s.codec_type === 'audio');
  return {
    width: v.width || 0,
    height: v.height || 0,
    durationMs: Math.round(parseFloat(j.format?.duration || '0') * 1000),
    nbFrames: parseInt(v.nb_frames || '0', 10),
    hasAudio: Boolean(a),
  };
}

/* mpdecimate drops frames that are near-identical to their predecessor, so what
   survives is the count of frames that actually show something new. That is the
   number that matters for perceived smoothness, and the only one that exposes a
   starved screencast. */
export async function uniqueFrames(file) {
  const { err } = await run(FFMPEG, ['-hide_banner', '-i', file, '-vf', 'mpdecimate', '-f', 'null', '-']);
  const matches = [...err.matchAll(/frame=\s*(\d+)/g)];
  if (!matches.length) throw new Error(`could not count unique frames in ${file}`);
  return parseInt(matches[matches.length - 1][1], 10);
}

export async function validatePlate(file, { minUniqueFps = 12 } = {}) {
  const info = await probe(file);
  if (!info.durationMs) throw new Error(`plate has no duration: ${file}`);
  const unique = await uniqueFrames(file);
  const uniqueFps = unique / (info.durationMs / 1000);
  const ok = uniqueFps >= minUniqueFps;
  return {
    ...info,
    unique,
    uniqueFps: Math.round(uniqueFps * 10) / 10,
    ok,
    reason: ok
      ? null
      : `plate delivers only ${Math.round(uniqueFps * 10) / 10} unique fps over ${(info.durationMs / 1000).toFixed(1)}s `
        + `(${unique} distinct frames, need >= ${minUniqueFps}). The capture was frame-starved, not mis-timed: `
        + `re-shoot on an idle machine and check load average first.`,
  };
}

/* Fit to frame without letterboxing. A 9:16 plate into a 16:9 frame gets a
   blurred, over-scaled copy of itself behind it, which is the convention for
   portrait footage on YouTube and reads better than pillarbox bars. */
function videoFit(preset, plate) {
  const portraitPlate = plate.height >= plate.width;
  const portraitTarget = preset.h >= preset.w;
  if (portraitPlate === portraitTarget) {
    return `scale=${preset.w}:${preset.h}:force_original_aspect_ratio=increase,crop=${preset.w}:${preset.h}`;
  }
  return `split=2[bg][fg];`
    + `[bg]scale=${preset.w}:${preset.h}:force_original_aspect_ratio=increase,crop=${preset.w}:${preset.h},`
    + `gblur=sigma=40,eq=brightness=-0.12[bgb];`
    + `[fg]scale=-2:${preset.h}[fgs];`
    + `[bgb][fgs]overlay=(W-w)/2:0`;
}

/* Ducking is sidechaincompress keyed on the VO, not a static music level: the
   bed stays present between lines and gets out of the way under them. A fixed
   -18dB bed either fights the voice or disappears entirely. */
function buildFilter({ preset, plate, vo, musicIndex, hasGameAudio, assPath, offsetMs, targetMs }) {
  const parts = [];
  const fit = videoFit(preset, plate);
  /* fontsdir, not just the .ass file: libass falls back to a system font silently
     when it cannot resolve Fontname, and a silent fallback to Helvetica is how a
     render ends up off-brand with no error anywhere in the log. */
  const ass = assPath
    ? `,subtitles='${assPath.replace(/'/g, "\\'")}':fontsdir='${FONT_DIR.replace(/'/g, "\\'")}'`
    : '';
  parts.push(`[0:v]fps=${preset.fps},${fit},format=yuv420p${ass}[v]`);

  const voLabels = [];
  vo.lines.forEach((line, i) => {
    const idx = i + 1; // input 0 is the plate
    const at = Math.max(0, line.startMs + offsetMs);
    parts.push(`[${idx}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,adelay=${at}:all=1[vo${i}]`);
    voLabels.push(`[vo${i}]`);
  });

  let voLabel = null;
  if (voLabels.length === 1) {
    parts.push(`${voLabels[0]}volume=1.6[voall]`);
    voLabel = '[voall]';
  } else if (voLabels.length > 1) {
    parts.push(`${voLabels.join('')}amix=inputs=${voLabels.length}:normalize=0:dropout_transition=0,volume=1.6[voall]`);
    voLabel = '[voall]';
  }

  const bedLabels = [];
  if (hasGameAudio) {
    parts.push(`[0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=0.85[game]`);
    bedLabels.push('[game]');
  }
  if (musicIndex !== null) {
    parts.push(`[${musicIndex}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=0.30[mus]`);
    bedLabels.push('[mus]');
  }

  let bedLabel = null;
  if (bedLabels.length === 1) bedLabel = bedLabels[0];
  else if (bedLabels.length > 1) {
    parts.push(`${bedLabels.join('')}amix=inputs=${bedLabels.length}:normalize=0:dropout_transition=0[bed]`);
    bedLabel = '[bed]';
  }

  /* Loudness target, not just a limiter. IG and YouTube both normalise on
     ingest, so delivering around -14 LUFS with 1.5dB of true-peak headroom is
     what stops the platform pulling the whole mix down and taking the VO with
     it. It also removes the AAC overshoot a bare limiter leaves behind. */
  const master = `loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000`;

  if (voLabel && bedLabel) {
    /* The sidechain key gates the bed, and sidechaincompress ends when its
       shorter input does - so an unpadded key silences the music the moment the
       last VO line finishes. Padding the key to the full target keeps the bed
       alive under the tail of the clip. */
    parts.push(`${voLabel}asplit=2[vo_mix][vo_key_raw]`);
    parts.push(`[vo_key_raw]apad=whole_dur=${targetMs}ms[vo_key]`);
    parts.push(`${bedLabel}[vo_key]sidechaincompress=threshold=0.04:ratio=9:attack=15:release=340:makeup=1[bedduck]`);
    parts.push(`[bedduck][vo_mix]amix=inputs=2:normalize=0:dropout_transition=0,${master}[a]`);
  } else if (voLabel) {
    parts.push(`${voLabel}${master}[a]`);
  } else if (bedLabel) {
    parts.push(`${bedLabel}${master}[a]`);
  }

  return { filter: parts.join(';'), hasAudioOut: Boolean(voLabel || bedLabel) };
}

export async function render({
  plate,
  vo = { lines: [] },
  music = null,
  ass = null,
  out,
  platform = 'reel',
  offsetMs = 0,
  durationMs = null,
  skipPlateCheck = false,
  minUniqueFps = 12,
}) {
  const preset = PRESETS[platform] || PRESETS.reel;
  if (!existsSync(plate)) throw new Error(`plate not found: ${plate}`);
  mkdirSync(path.dirname(out), { recursive: true });

  const check = await validatePlate(plate, { minUniqueFps });
  if (!check.ok && !skipPlateCheck) {
    throw new Error(`${check.reason}\nPass skipPlateCheck to render it anyway (for pipeline testing only).`);
  }

  const args = ['-hide_banner', '-y', '-i', plate];
  for (const line of vo.lines) args.push('-i', line.wav);
  let musicIndex = null;
  if (music) {
    musicIndex = 1 + vo.lines.length;
    args.push('-stream_loop', '-1', '-i', music);
  }

  // The plate is the shortest input once music is looping, so the target length
  // is whichever of plate and VO runs longer, clamped to the platform cap.
  // Computed before the filter graph because the bed's sidechain key is padded
  // to it.
  const target = Math.min(
    durationMs || Math.max(check.durationMs, vo.totalMs ? vo.totalMs + offsetMs + 400 : 0),
    preset.maxMs,
  );

  const { filter, hasAudioOut } = buildFilter({
    preset, plate: check, vo, musicIndex, hasGameAudio: check.hasAudio, assPath: ass, offsetMs,
    targetMs: target,
  });

  args.push('-filter_complex', filter, '-map', '[v]');
  if (hasAudioOut) args.push('-map', '[a]');
  args.push(
    '-c:v', 'libx264', '-preset', 'medium', '-crf', String(preset.crf),
    '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-g', String(preset.fps * 2),
    '-movflags', '+faststart',
  );
  if (hasAudioOut) args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000');
  args.push('-t', (target / 1000).toFixed(3), out);

  await run(FFMPEG, args);
  const result = await probe(out);
  return { out, plate: check, result, target, filter };
}

/* CLI: node lib/render.mjs <spec.json>
   spec.json mirrors the render() options. Written as a file rather than flags
   because a real shot carries a VO manifest and an overlay list. */
if (import.meta.url === `file://${process.argv[1]}`) {
  const specPath = process.argv[2];
  if (!specPath) {
    console.error('usage: render.mjs <spec.json>');
    process.exit(2);
  }
  const { readFileSync } = await import('node:fs');
  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  if (typeof spec.vo === 'string') spec.vo = JSON.parse(readFileSync(spec.vo, 'utf8'));
  const r = await render(spec);
  writeFileSync(`${spec.out}.render.json`, `${JSON.stringify({ plate: r.plate, result: r.result }, null, 2)}\n`);
  console.log(`plate: ${r.plate.width}x${r.plate.height} ${r.plate.uniqueFps} unique fps (${r.plate.unique} frames)`);
  console.log(`out:   ${r.out} ${r.result.width}x${r.result.height} ${(r.result.durationMs / 1000).toFixed(2)}s`);
}
