#!/usr/bin/env node
/* Per-line text-to-speech.

   One WAV per line, never one WAV for the whole script. That single choice is
   what removes forced alignment from the pipeline: a line's duration is a
   property of its own file, so caption timing is measured rather than guessed,
   and no whisper install is needed anywhere downstream.

   Provider is env-selected so nothing here is blocked on a paid account:
     CONTENT_TTS_PROVIDER=piper|elevenlabs   (default piper)
   Piper reads voices from CONTENT_PIPER_VOICE_DIR (default ~/voices), mirroring
   the provider split muse-studio already uses. */

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const PIPER_BIN = process.env.CONTENT_PIPER_BIN || 'piper';
const VOICE_DIR = process.env.CONTENT_PIPER_VOICE_DIR || path.join(homedir(), 'voices');
const DEFAULT_VOICE = process.env.CONTENT_PIPER_VOICE || 'en_US-ryan-high';

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

/* lines: [{ text, atMs? }]. A line with `atMs` is pinned to that timestamp
   because it has to land on a specific gameplay beat; a line without one falls
   in right after its predecessor plus `gapMs`. Pinning is how VO stays synced to
   the capture's beat sheet instead of drifting a little further out on every
   line, and a pin that would land before the previous line has finished is
   pushed rather than allowed to overlap. */
export async function synthesize({ lines, outDir, voice = DEFAULT_VOICE, provider, gapMs = 220 }) {
  const prov = provider || process.env.CONTENT_TTS_PROVIDER || 'piper';
  mkdirSync(outDir, { recursive: true });

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
    if (prov === 'elevenlabs') await synthElevenLabs(spoken, voice, wav);
    else await runPiper(spoken, voice, wav);

    const durationMs = wavDurationMs(wav);
    const wanted = typeof line.atMs === 'number' ? line.atMs : cursor;
    const startMs = Math.max(wanted, cursor);
    if (startMs > wanted) pushed++;
    out.push({ index: i, text, wav, startMs, durationMs, endMs: startMs + durationMs });
    cursor = startMs + durationMs + gapMs;
  }

  return {
    provider: prov,
    voice,
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
