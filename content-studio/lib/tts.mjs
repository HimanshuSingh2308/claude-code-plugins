#!/usr/bin/env node
/* Per-line text-to-speech.

   One WAV per line, never one WAV for the whole script. That single choice is
   what removes forced alignment from the pipeline: a line's duration is a
   property of its own file, so caption timing is measured rather than guessed,
   and no whisper install is needed anywhere downstream.

   Provider is env-selected so nothing here is blocked on a paid account:
     CONTENT_TTS_PROVIDER=kokoro|piper|elevenlabs   (default kokoro)
   Piper reads voices from CONTENT_PIPER_VOICE_DIR (default ~/voices), mirroring
   the provider split muse-studio already uses.

   KOKORO IS THE CHANNEL VOICE and it is the default. It is not a drop-in sibling
   of the other two: it batches. Kokoro loads a 350MB model, so spawning it per
   line would spend more time loading weights than speaking, and lib/vo-kokoro.py
   therefore synthesises every line in one process before the measuring loop runs.
   Timing stays here either way - vo-kokoro.py is told nothing about pins, and this
   file keeps doing the cursor-and-atMs arithmetic over whatever WAVs came back. */

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const PIPER_BIN = process.env.CONTENT_PIPER_BIN || 'piper';
const VOICE_DIR = process.env.CONTENT_PIPER_VOICE_DIR || path.join(homedir(), 'voices');
const DEFAULT_VOICE = process.env.CONTENT_PIPER_VOICE || 'en_US-ryan-high';

/* The channel voice, and the paths its model and venv live at. Both are outside
   any repo and outside the plugin: the model is 350MB and has to survive plugin
   reinstalls, and a venv committed to a marketplace is a broken venv on every
   other machine. See the setup notes at the top of lib/vo-kokoro.py. */
const KOKORO_VOICE = process.env.CONTENT_KOKORO_VOICE || 'af_heart';
const KOKORO_PY = process.env.CONTENT_KOKORO_PYTHON
  || path.join(homedir(), '.local/share/content-studio/ttsenv/bin/python3');
const KOKORO_SCRIPT = path.join(path.dirname(new URL(import.meta.url).pathname), 'vo-kokoro.py');

/* An absolute .onnx path overrides the voice-dir lookup, so a voice living
   outside the library is still usable without moving files around. */
function piperVoicePath(voice) {
  if (voice.endsWith('.onnx')) return voice;
  return path.join(VOICE_DIR, `${voice}.onnx`);
}

/* Walk the RIFF chunk list rather than assuming a 44-byte header. Piper's
   output is canonical today, but a header with a LIST or fact chunk in front of
   the data would silently skew every caption in the video, and that class of
   bug is invisible until someone watches the whole render. */
export function wavDurationMs(file) {
  const buf = readFileSync(file);
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`Not a RIFF/WAVE file: ${file}`);
  }
  let byteRate = 0;
  let dataBytes = 0;
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') byteRate = buf.readUInt32LE(off + 16); // fmt body: format, channels, rate, byteRate
    else if (id === 'data') { dataBytes = Math.min(size, buf.length - (off + 8)); break; }
    off += 8 + size + (size % 2); // chunks are word-aligned
  }
  if (!byteRate || !dataBytes) throw new Error(`Could not measure duration: ${file}`);
  return Math.round((dataBytes / byteRate) * 1000);
}

function runPiper(text, voice, outFile) {
  return new Promise((resolve, reject) => {
    const args = ['-m', piperVoicePath(voice), '-f', outFile];
    const proc = spawn(PIPER_BIN, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    proc.stderr.on('data', (d) => { err += d.toString(); });
    proc.on('error', (e) => reject(new Error(`piper failed to start (${PIPER_BIN}): ${e.message}`)));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`piper exited ${code}\n${err.trim()}`));
    });
    proc.stdin.end(text);
  });
}

async function synthElevenLabs(text, voice, outFile) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('CONTENT_TTS_PROVIDER=elevenlabs but ELEVENLABS_API_KEY is unset');
  const voiceId = process.env.ELEVENLABS_VOICE_ID || voice;
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=pcm_22050`,
    {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
      }),
    },
  );
  if (!res.ok) throw new Error(`elevenlabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const pcm = Buffer.from(await res.arrayBuffer());
  writeFileSync(outFile, wrapPcmAsWav(pcm, 22050, 1));
}

/* ElevenLabs returns headerless PCM; downstream everything expects a WAV it can
   measure, so give it one instead of special-casing the provider later. */
function wrapPcmAsWav(pcm, sampleRate, channels) {
  const head = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;
  head.write('RIFF', 0, 'ascii');
  head.writeUInt32LE(36 + pcm.length, 4);
  head.write('WAVEfmt ', 8, 'ascii');
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(channels, 22);
  head.writeUInt32LE(sampleRate, 24);
  head.writeUInt32LE(byteRate, 28);
  head.writeUInt16LE(channels * 2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36, 'ascii');
  head.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([head, pcm]);
}

/* One process for the whole script: writes vo-NN.wav for every item, already
   EQ'd, compressed, de-essed and loudness-matched, because the delivery shaping
   and the mastering are what make this voice the channel's voice rather than a
   generic sample of it. `index` is passed explicitly so the filenames match the
   indices this file hands out, which are the line's position in the ORIGINAL
   script - blank lines are skipped here and must not shift the numbering. */
async function synthKokoro(items, outDir, voice) {
  const listFile = path.join(outDir, '.kokoro-lines.json');
  writeFileSync(listFile, `${JSON.stringify(items, null, 2)}\n`);
  await new Promise((resolve, reject) => {
    const proc = spawn(KOKORO_PY,
      [KOKORO_SCRIPT, '--lines', listFile, '--out', outDir, '--voice', voice],
      { stdio: ['ignore', 'inherit', 'pipe'] });
    let err = '';
    proc.stderr.on('data', (d) => { err += d.toString(); });
    proc.on('error', (e) => reject(new Error(
      `kokoro failed to start (${KOKORO_PY}): ${e.message}\n`
      + 'Set CONTENT_KOKORO_PYTHON, or see the setup notes in lib/vo-kokoro.py.')));
    proc.on('close', (code) => (code === 0 ? resolve()
      : reject(new Error(`vo-kokoro.py exited ${code}\n${err.trim()}`))));
  });
}

/* lines: [{ text, atMs?, role? }]. `role` picks the delivery shape (hook, jab,
   warm, staccato, cta, neutral) and is honoured by the kokoro provider only - the
   other two have no rate or pitch control worth the name, which is most of why
   they are no longer the default. A line with `atMs` is pinned to that timestamp
   because it has to land on a specific gameplay beat; a line without one falls
   in right after its predecessor plus `gapMs`. Pinning is how VO stays synced to
   the capture's beat sheet instead of drifting a little further out on every
   line, and a pin that would land before the previous line has finished is
   pushed rather than allowed to overlap. */
export async function synthesize({ lines, outDir, voice, provider, gapMs = 220 }) {
  const prov = provider || process.env.CONTENT_TTS_PROVIDER || 'kokoro';
  const vox = voice || (prov === 'kokoro' ? KOKORO_VOICE : DEFAULT_VOICE);
  mkdirSync(outDir, { recursive: true });

  /* Batch first, measure second. Every provider ends up at the same place: one
     WAV per line on disk, named by its index in the original script. */
  if (prov === 'kokoro') {
    const items = [];
    lines.forEach((line, i) => {
      const text = (typeof line === 'string' ? line : line.text || '').trim();
      if (text) items.push({ index: i, text: text.replace(/\*/g, ''), role: line.role });
    });
    if (items.length) await synthKokoro(items, outDir, vox);
  }

  const out = [];
  let cursor = 0;
  let pushed = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = (typeof line === 'string' ? line : line.text || '').trim();
    if (!text) continue;
    const wav = path.join(outDir, `vo-${String(i).padStart(2, '0')}.wav`);

    /* *asterisks* mark the accent word for the caption layer only. Left in, a
       synthesizer either spells them out or inserts a pause, which throws off
       the one duration the caption timing depends on. */
    const spoken = text.replace(/\*/g, '');
    if (prov === 'kokoro') { /* already written by synthKokoro */ }
    else if (prov === 'elevenlabs') await synthElevenLabs(spoken, vox, wav);
    else await runPiper(spoken, vox, wav);

    const durationMs = wavDurationMs(wav);
    const wanted = typeof line.atMs === 'number' ? line.atMs : cursor;
    const startMs = Math.max(wanted, cursor);
    if (startMs > wanted) pushed++;
    out.push({ index: i, text, wav, startMs, durationMs, endMs: startMs + durationMs });
    cursor = startMs + durationMs + gapMs;
  }

  return {
    provider: prov,
    voice: vox,
    gapMs,
    lines: out,
    totalMs: out.length ? out[out.length - 1].endMs : 0,
    pinsPushed: pushed,
  };
}

/* CLI: node lib/tts.mjs script.json out/vo [voice]
   script.json is either an array of lines or { vo: [...] }. */
if (import.meta.url === `file://${process.argv[1]}`) {
  const [scriptPath, outDir, voice] = process.argv.slice(2);
  if (!scriptPath || !outDir) {
    console.error('usage: tts.mjs <script.json> <outDir> [voice]');
    process.exit(2);
  }
  const raw = JSON.parse(readFileSync(scriptPath, 'utf8'));
  const lines = Array.isArray(raw) ? raw : raw.vo || raw.lines || [];
  const manifest = await synthesize({ lines, outDir, voice });
  writeFileSync(path.join(outDir, 'vo.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  for (const l of manifest.lines) {
    console.log(`${String(l.startMs).padStart(6)}ms +${String(l.durationMs).padStart(5)}ms  ${l.text}`);
  }
  if (manifest.pinsPushed) console.log(`note: ${manifest.pinsPushed} pinned line(s) pushed later to avoid overlap`);
  console.log(`total ${manifest.totalMs}ms via ${manifest.provider}/${manifest.voice}`);
}
