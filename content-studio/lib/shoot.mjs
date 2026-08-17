#!/usr/bin/env node
/* One shot, end to end: capture -> VO -> captions -> render -> shot record.

   The part worth reading is take selection. A capture is deterministic in what
   the game does but not in how many frames the compositor actually hands over,
   so several takes are shot and scored, and a take that came back frame-starved
   is discarded rather than rendered. Chasing that by eye is how three unusable
   clips got built before this existed.

   VO lines can be pinned to a gameplay beat by name (`atMark`) instead of a
   timestamp. capture.js prints every `[demo]` mark with its page-clock time, so
   the line that reacts to a big clear lands on the clear even when the run
   drifts between takes. That is the difference between commentary and narration
   over unrelated footage. */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, appendFileSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { synthesize } from './tts.mjs';
import { buildAss, buildSrt } from './captions.mjs';
import { render, validatePlate } from './render.mjs';

const MARK_RE = /\[demo\]\s+(\d+)ms\s+(.+)/;

function runCapture({ captureScript, config, seed, outDir, base, extraArgs = [] }) {
  return new Promise((resolve, reject) => {
    const args = [captureScript, config, '--seed', String(seed), '--out', outDir, ...extraArgs];
    if (base) args.push('--base', base);
    const proc = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.stderr.on('data', (d) => { err += d.toString(); });
    proc.on('error', (e) => reject(new Error(`capture failed to start: ${e.message}`)));
    proc.on('close', (code) => {
      const marks = out.split('\n').map((l) => l.match(MARK_RE)).filter(Boolean)
        .map((m) => ({ atMs: parseInt(m[1], 10), label: m[2].trim() }));
      const missed = out.split('\n').filter((l) => /MISS|not found or not visible/.test(l));
      if (code !== 0) reject(new Error(`capture exited ${code}\n${(err || out).split('\n').slice(-20).join('\n')}`));
      else resolve({ stdout: out, marks, missed });
    });
  });
}

/* A patch that silently stops matching is the failure mode the capture harness
   warns about, and it produces a clip that looks fine and shows nothing. Treat
   any MISS as fatal rather than shipping footage of a default board. */
function assertCaptureClean(res, { allowMissedSteps }) {
  const patchMiss = res.missed.filter((l) => /MISS/.test(l));
  if (patchMiss.length) {
    throw new Error(`capture had ${patchMiss.length} failed source patch(es):\n${patchMiss.join('\n')}\n`
      + 'The game source changed under the config. Re-brief the game before shooting it.');
  }
  const stepMiss = res.missed.filter((l) => /not found or not visible/.test(l));
  if (stepMiss.length && !allowMissedSteps) {
    throw new Error(`capture skipped ${stepMiss.length} timeline step(s):\n${stepMiss.join('\n')}\n`
      + 'Pass allowMissedSteps if those beats are genuinely optional.');
  }
  return { patchMiss, stepMiss };
}

function resolveMark(marks, spec) {
  if (!spec) return null;
  const wanted = String(spec).toLowerCase();
  const hit = marks.find((m) => m.label.toLowerCase().includes(wanted));
  return hit ? hit.atMs : null;
}

/* Score a take on frame health first, then on how close its beats land to the
   plan. A perfectly timed slideshow is still a slideshow. */
function scoreTake(take, shot) {
  if (!take.plate.ok) return -1;
  let score = Math.min(take.plate.uniqueFps, 30) * 10;
  const target = shot.preferMark;
  if (target) {
    const at = resolveMark(take.marks, target);
    if (at === null) return score * 0.4; // the payoff beat never fired
    const ideal = shot.preferMarkAtMs ?? 2500;
    const plateAt = at - (shot.recordFromMs ?? 0);
    score -= Math.abs(plateAt - ideal) / 100;
  }
  return score;
}

export async function shoot(shot, opts = {}) {
  const {
    repoRoot,
    outRoot,
    takes = shot.takes || 3,
    base = shot.base || 'http://localhost:4321',
    skipCapture = false,
    allowMissedSteps = shot.allowMissedSteps ?? false,
    minUniqueFps = 12,
  } = opts;

  const captureScript = path.join(repoRoot, 'scripts', 'demo-capture', 'capture.js');
  if (!skipCapture && !existsSync(captureScript)) {
    throw new Error(`capture harness not found at ${captureScript}`);
  }

  const workDir = path.join(outRoot, shot.id);
  const takesDir = path.join(workDir, 'takes');
  mkdirSync(takesDir, { recursive: true });

  let best = null;
  const tried = [];

  if (skipCapture) {
    const plateFile = shot.plate || path.join(workDir, 'plate.mp4');
    if (!existsSync(plateFile)) throw new Error(`skipCapture set but no plate at ${plateFile}`);
    best = { seed: null, plateFile, marks: shot.marks || [], plate: await validatePlate(plateFile, { minUniqueFps }) };
  } else {
    const seeds = shot.seeds && shot.seeds.length
      ? shot.seeds
      : Array.from({ length: takes }, (_, i) => (shot.seed || 20260115) + i);

    for (const seed of seeds) {
      const seedDir = path.join(takesDir, `seed-${seed}`);
      mkdirSync(seedDir, { recursive: true });
      const res = await runCapture({ captureScript, config: shot.captureConfig, seed, outDir: seedDir, base });
      assertCaptureClean(res, { allowMissedSteps });
      const plateFile = path.join(seedDir, `${shot.captureName || shot.captureConfig}.mp4`);
      if (!existsSync(plateFile)) throw new Error(`capture produced no mp4 at ${plateFile}`);
      const plate = await validatePlate(plateFile, { minUniqueFps });
      const take = { seed, plateFile, marks: res.marks, plate };
      take.score = scoreTake(take, shot);
      tried.push({ seed, uniqueFps: plate.uniqueFps, ok: plate.ok, score: take.score, marks: res.marks });
      if (!best || take.score > best.score) best = take;
      // A healthy, well-timed take makes further seeds pure cost.
      if (plate.ok && plate.uniqueFps >= 22 && take.score > 0) break;
    }

    if (!best || !best.plate.ok) {
      const detail = tried.map((t) => `  seed ${t.seed}: ${t.uniqueFps} unique fps`).join('\n');
      throw new Error(`no usable take after ${tried.length} attempt(s):\n${detail}\n${best?.plate?.reason || ''}`);
    }
  }

  const plate = path.join(workDir, 'plate.mp4');
  if (path.resolve(best.plateFile) !== path.resolve(plate)) copyFileSync(best.plateFile, plate);

  /* Pin VO to real beats. Mark times are page-clock; the plate starts at
     record.from, so everything shifts by that offset. */
  const recordFrom = shot.recordFromMs ?? 0;
  const lines = (shot.vo || []).map((l) => {
    const line = typeof l === 'string' ? { text: l } : { ...l };
    if (line.atMark) {
      const at = resolveMark(best.marks, line.atMark);
      if (at !== null) line.atMs = Math.max(0, at - recordFrom + (line.leadMs || 0));
      delete line.atMark;
    }
    return line;
  });

  const vo = await synthesize({
    lines,
    outDir: path.join(workDir, 'vo'),
    voice: shot.voice,
    gapMs: shot.gapMs,
  });
  writeFileSync(path.join(workDir, 'vo', 'vo.json'), `${JSON.stringify(vo, null, 2)}\n`);

  const overlays = (shot.overlays || []).map((ov) => {
    if (!ov.atMark) return ov;
    const at = resolveMark(best.marks, ov.atMark);
    return at === null ? null : { ...ov, atMs: Math.max(0, at - recordFrom + (ov.leadMs || 0)) };
  }).filter(Boolean);

  const outputs = [];
  for (const platform of shot.platforms || ['reel']) {
    const ass = path.join(workDir, `captions.${platform}.ass`);
    writeFileSync(ass, buildAss({ vo, overlays, platform, offsetMs: shot.voOffsetMs || 0 }));
    const out = path.join(workDir, `${shot.id}.${platform}.mp4`);
    const r = await render({
      plate,
      vo,
      music: shot.music || null,
      ass,
      out,
      platform,
      offsetMs: shot.voOffsetMs || 0,
      durationMs: shot.durationMs || null,
      minUniqueFps,
    });
    outputs.push({ platform, file: out, durationMs: r.result.durationMs, width: r.result.width, height: r.result.height });
  }

  writeFileSync(path.join(workDir, 'captions.srt'), buildSrt({ vo, offsetMs: shot.voOffsetMs || 0 }));

  const record = {
    id: shot.id,
    game: shot.game,
    template: shot.template,
    hook: shot.hook,
    seed: best.seed,
    marks: best.marks,
    plate: { uniqueFps: best.plate.uniqueFps, durationMs: best.plate.durationMs },
    takesTried: tried,
    vo: vo.lines.map((l) => ({ text: l.text, startMs: l.startMs, durationMs: l.durationMs })),
    overlays,
    outputs,
    metadata: shot.metadata || {},
    approved: null,
    published: {},
  };
  writeFileSync(path.join(workDir, 'shot.json'), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

/* CLI: node lib/shoot.mjs <shot.json> --repo <path> --out <dir> [--skip-capture] */
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const shotPath = argv[0];
  const flag = (n, d) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
  };
  if (!shotPath) {
    console.error('usage: shoot.mjs <shot.json> --repo <repoRoot> --out <outRoot> [--skip-capture] [--takes N]');
    process.exit(2);
  }
  const shot = JSON.parse(readFileSync(shotPath, 'utf8'));
  const repoRoot = flag('repo', process.cwd());
  const outRoot = flag('out', path.join(repoRoot, 'content', 'out'));
  const rec = await shoot(shot, {
    repoRoot,
    outRoot,
    skipCapture: argv.includes('--skip-capture'),
    takes: Number(flag('takes', shot.takes || 3)),
  });
  const logFile = path.join(path.dirname(outRoot), 'shot-log.jsonl');
  mkdirSync(path.dirname(logFile), { recursive: true });
  appendFileSync(logFile, `${JSON.stringify({ id: rec.id, game: rec.game, template: rec.template, hook: rec.hook, outputs: rec.outputs.map((o) => o.platform) })}\n`);
  for (const t of rec.takesTried) console.log(`take seed ${t.seed}: ${t.uniqueFps} unique fps score ${Math.round(t.score)}`);
  for (const o of rec.outputs) console.log(`${o.platform}: ${o.file} ${o.width}x${o.height} ${(o.durationMs / 1000).toFixed(2)}s`);
}
