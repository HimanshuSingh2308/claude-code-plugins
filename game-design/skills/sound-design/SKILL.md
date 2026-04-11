---
name: sound-design
description: >
  Web Audio API patterns for browser games. Covers sound effects generation,
  music loops, audio feedback, and mobile-friendly audio handling. All sounds
  are generated programmatically - no external audio files required.
---

# Sound Design for Browser Games

## Core Principles

1. **No external files**: Generate all sounds with Web Audio API
2. **User gesture required**: Audio must start from user interaction
3. **Volume control**: Always provide mute option
4. **Feedback, not distraction**: Sounds reinforce actions, don't annoy

---

## Basic Audio Context Setup

```javascript
class GameAudio {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = false;
    this.volume = 0.3;
    this.initialized = false;
  }

  // MUST be called from user gesture (click/touch)
  init() {
    if (this.initialized) return;

    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = this.volume;
    this.initialized = true;

    // Resume context if suspended (iOS requirement)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
    }
    return this.muted;
  }

  // Base method for creating oscillators
  createOscillator(type = 'sine', frequency = 440) {
    if (!this.ctx) return null;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.value = frequency;
    osc.connect(gain);
    gain.connect(this.masterGain);

    return { osc, gain, ctx: this.ctx };
  }
}

// Global instance
const audio = new GameAudio();

// Initialize on first user interaction
document.addEventListener('click', () => audio.init(), { once: true });
document.addEventListener('touchstart', () => audio.init(), { once: true });
```

---

## Sound Effect Library

All SFX follow the same oscillator pattern. The table below defines each sound's parameters.
Use the **pattern template** with values from the table to generate any sound.

### Oscillator Pattern Template

```javascript
// Single-tone SFX pattern
function singleTone(type, freq, volume, duration, freqRamp) {
  const { osc, gain, ctx } = audio.createOscillator(type, freq);
  if (!osc) return;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  if (freqRamp) osc.frequency.linearRampToValueAtTime(freqRamp, ctx.currentTime + duration * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

// Multi-note SFX pattern (arpeggios, chords, melodies)
function multiNote(type, notes, volume, noteDuration, spacing, simultaneous = false) {
  if (!audio.ctx) return;
  notes.forEach((freq, i) => {
    const { osc, gain, ctx } = audio.createOscillator(type, freq);
    const startTime = simultaneous ? ctx.currentTime : ctx.currentTime + (i * spacing);
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + noteDuration);
    osc.start(startTime);
    osc.stop(startTime + noteDuration);
  });
}
```

### SFX Reference Table

| Name | Type | Pattern | Freq(s) | Vol | Duration | Notes |
|------|------|---------|---------|-----|----------|-------|
| **UI Sounds** |
| click | sine | single | 800 | 0.1 | 0.1s | Short, satisfying |
| hover | sine | single | 600 | 0.03 | 0.05s | Subtle |
| toggleOn | sine | single | 500→700 | 0.1 | 0.15s | Rising pitch |
| toggleOff | sine | single | 700→400 | 0.1 | 0.15s | Falling pitch |
| **Game Actions** |
| move | sine | single | 440 | 0.08 | 0.05s | Cursor/selection |
| score | sine | single | 523→784 | 0.1 | 0.2s | Rising tone |
| bigScore | sine | multi | [523,659,784,1047] | 0.1 | 0.2s | C major arpeggio, 80ms spacing |
| combo(n) | triangle | single | 400+(n*50) | 0.08 | 0.1s | Pitch rises with combo |
| collect | sine | single | 880→1760 | 0.08 | 0.15s | Octave jump up |
| **Feedback** |
| success | sine | multi | [523,659,784] | 0.08 | 0.3s | C-E-G chord, simultaneous |
| error | sawtooth | single | 150 | 0.1 | 0.3s | Low buzz |
| warning | square | multi | [440,440] | 0.05 | 0.1s | 2 beeps, 150ms spacing |
| gameOver | sine | multi | [392,349,330,294] | 0.1 | 0.3s | Descending, 200ms spacing |
| victory | triangle | multi | [523,523,523,698,880] | 0.1 | var | Fanfare melody |
| levelUp | triangle | multi | [523,659,784,1047] | 0.1 | 0.3s | Ascending arpeggio, 100ms |
| achievement | sine | multi | [1047,1319,1568,2093] | 0.06 | 0.2s | High sparkle, 50ms |
| **Timers** |
| tick | sine | single | 1000 | 0.03 | 0.02s | Metronome tick |
| countdown(final) | sine | single | 440/880 | 0.1 | 0.1/0.3s | Higher on final |

### Noise-Based SFX (Special — use noise buffer, not oscillator)

```javascript
// Explosion: white noise burst with lowpass sweep 1000→100Hz, 0.3s, vol 0.3
// Whoosh: bandpass noise at 2000Hz, Q=1, shaped by sin(t*PI), 0.15s, vol 0.2
Object.assign(SFX, {
  explosion() {
    if (!audio.ctx) return;
    const bufferSize = audio.ctx.sampleRate * 0.3;
    const buffer = audio.ctx.createBuffer(1, bufferSize, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const noise = audio.ctx.createBufferSource();
    const filter = audio.ctx.createBiquadFilter();
    const gain = audio.ctx.createGain();
    noise.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, audio.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, audio.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, audio.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audio.ctx.currentTime + 0.3);
    noise.connect(filter); filter.connect(gain); gain.connect(audio.masterGain);
    noise.start();
  },

  whoosh() {
    if (!audio.ctx) return;
    const bufferSize = audio.ctx.sampleRate * 0.15;
    const buffer = audio.ctx.createBuffer(1, bufferSize, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI) * 0.3;
    }
    const noise = audio.ctx.createBufferSource();
    const filter = audio.ctx.createBiquadFilter();
    const gain = audio.ctx.createGain();
    noise.buffer = buffer;
    filter.type = 'bandpass'; filter.frequency.value = 2000; filter.Q.value = 1;
    gain.gain.setValueAtTime(0.2, audio.ctx.currentTime);
    noise.connect(filter); filter.connect(gain); gain.connect(audio.masterGain);
    noise.start();
  },
});
```

---

## ADSR Envelopes

ADSR stands for **Attack, Decay, Sustain, Release** — the four stages that shape how a sound's volume changes over time. Every real-world instrument and most satisfying game sounds follow this pattern.

```
Volume
  │
  │   /\
  │  / | \
  │ /  |  \________
  │/   |   |       \
  │    |   |        \
  └────┼───┼────────┼──── Time
    Attack Decay  Release
           Sustain
```

- **Attack**: How fast the sound reaches peak volume (0 = instant snap, 0.5s = slow swell)
- **Decay**: How fast it drops from peak to sustain level
- **Sustain**: The held volume level while a key/action is active (0–1 ratio of peak)
- **Release**: How fast it fades to silence after the action ends

### Mapping ADSR to Web Audio API

Web Audio API doesn't have a built-in ADSR node, but you can shape any `GainNode` with scheduled value changes.

```javascript
/**
 * Create an ADSR envelope on a GainNode.
 * Returns { start, stop } methods to trigger and release the envelope.
 *
 * @param {AudioContext} ctx
 * @param {GainNode} gainNode
 * @param {Object} params
 * @param {number} params.attack   - seconds to reach peak
 * @param {number} params.decay    - seconds from peak to sustain level
 * @param {number} params.sustain  - gain level during sustain (0–1)
 * @param {number} params.release  - seconds to fade to silence
 * @param {number} params.peakGain - maximum gain at end of attack (default 1)
 */
function createADSR(ctx, gainNode, { attack, decay, sustain, release, peakGain = 1 }) {
  return {
    start(time) {
      const t = time || ctx.currentTime;
      gainNode.gain.cancelScheduledValues(t);
      gainNode.gain.setValueAtTime(0.001, t);
      // Attack: ramp up to peak
      gainNode.gain.linearRampToValueAtTime(peakGain, t + attack);
      // Decay: ramp down to sustain level
      gainNode.gain.linearRampToValueAtTime(sustain * peakGain, t + attack + decay);
    },
    stop(time) {
      const t = time || ctx.currentTime;
      gainNode.gain.cancelScheduledValues(t);
      gainNode.gain.setValueAtTime(gainNode.gain.value, t);
      // Release: ramp to silence
      gainNode.gain.linearRampToValueAtTime(0.001, t + release);
    }
  };
}
```

### ADSR Preset Examples

```javascript
const ADSR_PRESETS = {
  // Pluck: instant attack, no sustain — like a guitar string or harp
  pluck: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.1, peakGain: 0.8 },

  // Pad: slow swell, long sustain — ambient background tone
  pad: { attack: 0.8, decay: 0.3, sustain: 0.6, release: 1.0, peakGain: 0.5 },

  // Percussion: instant attack, fast decay, no sustain — snare, kick, tap
  percussion: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05, peakGain: 1.0 },

  // Bell: fast attack, long decay, low sustain — chime, notification
  bell: { attack: 0.01, decay: 0.6, sustain: 0.1, release: 0.4, peakGain: 0.7 },
};

// Usage with an oscillator
function playWithEnvelope(presetName, frequency, duration) {
  if (!audio.ctx) return;

  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  osc.connect(gain);
  gain.connect(audio.masterGain);

  const preset = ADSR_PRESETS[presetName];
  const env = createADSR(audio.ctx, gain, preset);

  osc.start(audio.ctx.currentTime);
  env.start(audio.ctx.currentTime);

  // Schedule release after the sustain duration
  const releaseTime = audio.ctx.currentTime + duration;
  env.stop(releaseTime);
  osc.stop(releaseTime + preset.release);
}

// Examples
// playWithEnvelope('pluck', 440, 0.3);      // Short plucked note
// playWithEnvelope('pad', 220, 2.0);        // Long ambient pad
// playWithEnvelope('percussion', 150, 0.1); // Quick drum hit
// playWithEnvelope('bell', 880, 0.5);       // Chime notification
```

---

## Music & Ambient Loops

Procedurally generated music keeps your game's audio fresh without shipping audio files. These patterns use Web Audio API oscillators and gain scheduling to create looping background music and ambient soundscapes.

### Procedural Music Loop Generator

A simple 4-bar loop using oscillators and gain scheduling. Each bar plays a chord, creating a repeating harmonic progression.

```javascript
class ProceduralMusicLoop {
  constructor(audioInstance, options = {}) {
    this.audio = audioInstance;
    this.bpm = options.bpm || 120;
    this.bars = options.bars || 4;
    this.volume = options.volume || 0.15;
    this.playing = false;
    this.scheduledNodes = [];

    // Default chord progression: I - V - vi - IV (C major)
    this.chords = options.chords || [
      [261.63, 329.63, 392.00],  // C major (C E G)
      [196.00, 246.94, 293.66],  // G major (G B D)
      [220.00, 261.63, 329.63],  // A minor (A C E)
      [174.61, 220.00, 261.63],  // F major (F A C)
    ];
  }

  start() {
    if (!this.audio.ctx || this.playing) return;
    this.playing = true;
    this.scheduleLoop();
  }

  stop() {
    this.playing = false;
    this.scheduledNodes.forEach(node => {
      try { node.stop(); } catch (e) { /* already stopped */ }
    });
    this.scheduledNodes = [];
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
  }

  scheduleLoop() {
    if (!this.playing) return;

    const ctx = this.audio.ctx;
    const beatDuration = 60 / this.bpm;
    const barDuration = beatDuration * 4; // 4 beats per bar
    const loopDuration = barDuration * this.bars;

    const startTime = ctx.currentTime + 0.05; // Tiny offset to avoid clicks

    this.chords.forEach((chord, barIndex) => {
      const barStart = startTime + (barIndex * barDuration);

      chord.forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(this.audio.masterGain);

        // Gentle fade in/out per bar to avoid clicks
        gain.gain.setValueAtTime(0.001, barStart);
        gain.gain.linearRampToValueAtTime(this.volume, barStart + 0.05);
        gain.gain.setValueAtTime(this.volume, barStart + barDuration - 0.05);
        gain.gain.linearRampToValueAtTime(0.001, barStart + barDuration);

        osc.start(barStart);
        osc.stop(barStart + barDuration);
        this.scheduledNodes.push(osc);
      });
    });

    // Schedule next loop iteration
    const nextLoopTime = (loopDuration * 1000) - 100; // Slight overlap for seamlessness
    this.loopTimer = setTimeout(() => {
      this.scheduledNodes = [];
      this.scheduleLoop();
    }, nextLoopTime);
  }
}

// Usage
const music = new ProceduralMusicLoop(audio, {
  bpm: 100,
  volume: 0.12,
  chords: [
    [261.63, 329.63, 392.00],  // C major
    [196.00, 246.94, 293.66],  // G major
    [220.00, 261.63, 329.63],  // A minor
    [174.61, 220.00, 261.63],  // F major
  ]
});
// music.start();
// music.stop();
```

### Ambient Background Pattern

A low drone with subtle random tones layered on top — good for menus, exploration, and puzzle games.

```javascript
class AmbientBackground {
  constructor(audioInstance, options = {}) {
    this.audio = audioInstance;
    this.volume = options.volume || 0.08;
    this.droneFreq = options.droneFreq || 80;        // Low hum frequency
    this.toneRange = options.toneRange || [300, 800]; // Random tone range
    this.toneInterval = options.toneInterval || 3000; // ms between random tones
    this.playing = false;
    this.droneOsc = null;
    this.droneGain = null;
    this.toneTimer = null;
  }

  start() {
    if (!this.audio.ctx || this.playing) return;
    this.playing = true;

    const ctx = this.audio.ctx;

    // Continuous low drone
    this.droneOsc = ctx.createOscillator();
    this.droneGain = ctx.createGain();
    this.droneOsc.type = 'sine';
    this.droneOsc.frequency.value = this.droneFreq;
    this.droneOsc.connect(this.droneGain);
    this.droneGain.connect(this.audio.masterGain);
    this.droneGain.gain.setValueAtTime(0.001, ctx.currentTime);
    this.droneGain.gain.linearRampToValueAtTime(this.volume, ctx.currentTime + 2);
    this.droneOsc.start();

    // Schedule random subtle tones
    this.scheduleTone();
  }

  stop() {
    this.playing = false;
    if (this.droneGain && this.audio.ctx) {
      const ctx = this.audio.ctx;
      this.droneGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 1);
      this.droneOsc.stop(ctx.currentTime + 1);
    }
    if (this.toneTimer) {
      clearTimeout(this.toneTimer);
      this.toneTimer = null;
    }
  }

  scheduleTone() {
    if (!this.playing) return;

    const ctx = this.audio.ctx;
    const freq = this.toneRange[0] + Math.random() * (this.toneRange[1] - this.toneRange[0]);
    const duration = 1 + Math.random() * 2;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(this.audio.masterGain);

    // Slow fade in, slow fade out
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(this.volume * 0.4, now + duration * 0.4);
    gain.gain.linearRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration);

    // Next random tone
    const nextDelay = this.toneInterval + Math.random() * this.toneInterval;
    this.toneTimer = setTimeout(() => this.scheduleTone(), nextDelay);
  }
}

// Usage
const ambient = new AmbientBackground(audio, {
  volume: 0.06,
  droneFreq: 65,
  toneRange: [400, 900],
  toneInterval: 2500
});
// ambient.start();
// ambient.stop();
```

### Seamless Looping Techniques

Two approaches for gapless looping depending on your audio source.

```javascript
// Approach 1: AudioBufferSourceNode.loop (for pre-rendered buffers)
// Best when you've pre-rendered a music clip into a buffer.
function loopBuffer(ctx, buffer, gainNode) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.loopStart = 0;             // Start of loop region (seconds)
  source.loopEnd = buffer.duration;  // End of loop region
  source.connect(gainNode);
  source.start();
  return source; // Call source.stop() to end
}

// Approach 2: Scheduling-based looping (for oscillator-generated music)
// Re-schedule the next iteration before the current one ends.
// See ProceduralMusicLoop above — it uses setTimeout to re-trigger
// the loop ~100ms before the current pass finishes, avoiding gaps.

// Approach 3: Crossfade two sources for zero-gap loops
function crossfadeLoop(ctx, createSourceFn, gainNode, loopDuration, fadeTime = 0.1) {
  let current = null;
  let timer = null;

  function scheduleNext() {
    const source = createSourceFn(ctx);
    const fadeGain = ctx.createGain();
    source.connect(fadeGain);
    fadeGain.connect(gainNode);

    const now = ctx.currentTime;
    fadeGain.gain.setValueAtTime(0.001, now);
    fadeGain.gain.linearRampToValueAtTime(1, now + fadeTime);
    fadeGain.gain.setValueAtTime(1, now + loopDuration - fadeTime);
    fadeGain.gain.linearRampToValueAtTime(0.001, now + loopDuration);

    source.start(now);
    source.stop(now + loopDuration);

    // Schedule next loop slightly before this one ends
    timer = setTimeout(scheduleNext, (loopDuration - fadeTime) * 1000);
    current = source;
  }

  scheduleNext();
  return { stop: () => { clearTimeout(timer); if (current) current.stop(); } };
}
```

### Volume Ducking (Music + SFX)

Lower music volume when a sound effect plays so SFX cut through clearly, then restore it.

```javascript
class VolumeDucker {
  constructor(audioInstance, musicGainNode, options = {}) {
    this.audio = audioInstance;
    this.musicGain = musicGainNode;
    this.normalVolume = options.normalVolume || 0.15;
    this.duckedVolume = options.duckedVolume || 0.04;
    this.duckTime = options.duckTime || 0.05;     // Seconds to duck down
    this.restoreTime = options.restoreTime || 0.3; // Seconds to restore
    this.restoreTimer = null;
  }

  duck(sfxDuration) {
    if (!this.audio.ctx) return;

    const ctx = this.audio.ctx;
    const now = ctx.currentTime;

    // Drop music volume quickly
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(this.duckedVolume, now + this.duckTime);

    // Restore after SFX finishes
    clearTimeout(this.restoreTimer);
    this.restoreTimer = setTimeout(() => {
      const restoreNow = ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(restoreNow);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, restoreNow);
      this.musicGain.gain.linearRampToValueAtTime(this.normalVolume, restoreNow + this.restoreTime);
    }, (sfxDuration || 0.3) * 1000);
  }
}

// Usage: create a dedicated gain node for music routing
// const musicGain = audio.ctx.createGain();
// musicGain.connect(audio.masterGain);
// const ducker = new VolumeDucker(audio, musicGain);
//
// // Before playing an SFX:
// ducker.duck(0.2); // duck for 0.2s (the SFX duration)
// SFX.score();
```

---

## Usage Pattern

```javascript
// Initialize on first interaction
document.addEventListener('click', () => audio.init(), { once: true });

// Play sounds on game events
function onTileMove() {
  SFX.move();
}

function onScorePoints(points) {
  if (points >= 100) {
    SFX.bigScore();
  } else {
    SFX.score();
  }
}

function onComboHit(combo) {
  SFX.combo(combo);
}

function onGameOver(won) {
  if (won) {
    SFX.victory();
  } else {
    SFX.gameOver();
  }
}

function onAchievementUnlock() {
  SFX.achievement();
}
```

---

## Mobile Considerations

```javascript
// iOS requires user gesture to start audio
function ensureAudioContext() {
  if (audio.ctx?.state === 'suspended') {
    audio.ctx.resume();
  }
}

// Call on any user interaction
document.addEventListener('touchstart', ensureAudioContext);
document.addEventListener('touchend', ensureAudioContext);

// Mute button for accessibility
function createMuteButton() {
  const btn = document.createElement('button');
  btn.className = 'btn-icon mute-btn';
  btn.innerHTML = '🔊';
  btn.onclick = () => {
    const muted = audio.toggleMute();
    btn.innerHTML = muted ? '🔇' : '🔊';
  };
  return btn;
}
```

---

## Syncing Audio with Visuals

Audio feedback and visual feedback should be designed together. When a ball lands, the sound and the animation should hit at the same frame.

**Key sync points:**
- Trigger SFX at the START of the CSS transition/animation (not at the end)
- Match audio duration roughly to animation duration (±50ms is fine)
- For multi-step animations (cascades, arpeggios), schedule audio notes to match each visual step

> **See also**: `animation-patterns` — covers CSS/JS animation timing, easing functions, and particle effects that should be synchronized with audio events.
