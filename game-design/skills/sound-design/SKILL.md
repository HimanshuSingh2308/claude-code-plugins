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
