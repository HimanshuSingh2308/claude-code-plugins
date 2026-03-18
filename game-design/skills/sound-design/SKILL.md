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

### UI Sounds

```javascript
const SFX = {
  // Button click - short, satisfying
  click() {
    const { osc, gain, ctx } = audio.createOscillator('sine', 800);
    if (!osc) return;

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  },

  // Hover/focus - subtle
  hover() {
    const { osc, gain, ctx } = audio.createOscillator('sine', 600);
    if (!osc) return;

    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  },

  // Toggle on
  toggleOn() {
    const { osc, gain, ctx } = audio.createOscillator('sine', 500);
    if (!osc) return;

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.frequency.setValueAtTime(500, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(700, ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  },

  // Toggle off
  toggleOff() {
    const { osc, gain, ctx } = audio.createOscillator('sine', 700);
    if (!osc) return;

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.frequency.setValueAtTime(700, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  },
};
```

### Game Action Sounds

```javascript
Object.assign(SFX, {
  // Move/Place piece
  move() {
    const { osc, gain, ctx } = audio.createOscillator('sine', 440);
    if (!osc) return;

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  },

  // Score points - rising tone
  score() {
    const { osc, gain, ctx } = audio.createOscillator('sine', 523);
    if (!osc) return;

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.frequency.setValueAtTime(523, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(784, ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  },

  // Big score - arpeggio
  bigScore() {
    if (!audio.ctx) return;

    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const { osc, gain, ctx } = audio.createOscillator('sine', freq);
      const startTime = ctx.currentTime + (i * 0.08);

      gain.gain.setValueAtTime(0.1, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

      osc.start(startTime);
      osc.stop(startTime + 0.2);
    });
  },

  // Combo hit - pitch increases with combo
  combo(comboCount) {
    const baseFreq = 400;
    const freq = baseFreq + (comboCount * 50); // Higher pitch for higher combo
    const { osc, gain, ctx } = audio.createOscillator('triangle', freq);
    if (!osc) return;

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  },

  // Collect/Pickup
  collect() {
    const { osc, gain, ctx } = audio.createOscillator('sine', 880);
    if (!osc) return;

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  },
});
```

### Feedback Sounds

```javascript
Object.assign(SFX, {
  // Success/Correct
  success() {
    if (!audio.ctx) return;

    const notes = [523, 659, 784]; // C, E, G major chord
    notes.forEach((freq, i) => {
      const { osc, gain, ctx } = audio.createOscillator('sine', freq);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    });
  },

  // Error/Wrong
  error() {
    const { osc, gain, ctx } = audio.createOscillator('sawtooth', 150);
    if (!osc) return;

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  },

  // Warning/Alert
  warning() {
    if (!audio.ctx) return;

    for (let i = 0; i < 2; i++) {
      const { osc, gain, ctx } = audio.createOscillator('square', 440);
      const startTime = ctx.currentTime + (i * 0.15);

      gain.gain.setValueAtTime(0.05, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.1);

      osc.start(startTime);
      osc.stop(startTime + 0.1);
    }
  },

  // Game Over
  gameOver() {
    if (!audio.ctx) return;

    const notes = [392, 349, 330, 294]; // G4, F4, E4, D4 - descending
    notes.forEach((freq, i) => {
      const { osc, gain, ctx } = audio.createOscillator('sine', freq);
      const startTime = ctx.currentTime + (i * 0.2);

      gain.gain.setValueAtTime(0.1, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  },

  // Victory/Win
  victory() {
    if (!audio.ctx) return;

    const melody = [523, 523, 523, 698, 880]; // Fanfare
    const durations = [0.1, 0.1, 0.1, 0.15, 0.4];
    let time = audio.ctx.currentTime;

    melody.forEach((freq, i) => {
      const { osc, gain, ctx } = audio.createOscillator('triangle', freq);

      gain.gain.setValueAtTime(0.1, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + durations[i]);

      osc.start(time);
      osc.stop(time + durations[i]);

      time += durations[i] + 0.05;
    });
  },

  // Level Up
  levelUp() {
    if (!audio.ctx) return;

    const notes = [523, 659, 784, 1047]; // C major arpeggio up
    notes.forEach((freq, i) => {
      const { osc, gain, ctx } = audio.createOscillator('triangle', freq);
      const startTime = ctx.currentTime + (i * 0.1);

      gain.gain.setValueAtTime(0.1, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  },

  // Achievement Unlocked
  achievement() {
    if (!audio.ctx) return;

    // Sparkle effect
    const notes = [1047, 1319, 1568, 2093]; // High notes
    notes.forEach((freq, i) => {
      const { osc, gain, ctx } = audio.createOscillator('sine', freq);
      const startTime = ctx.currentTime + (i * 0.05);

      gain.gain.setValueAtTime(0.06, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

      osc.start(startTime);
      osc.stop(startTime + 0.2);
    });
  },
});
```

### Special Effect Sounds

```javascript
Object.assign(SFX, {
  // Explosion
  explosion() {
    if (!audio.ctx) return;

    // Noise burst
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

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audio.masterGain);

    noise.start();
  },

  // Whoosh/Swipe
  whoosh() {
    if (!audio.ctx) return;

    const bufferSize = audio.ctx.sampleRate * 0.15;
    const buffer = audio.ctx.createBuffer(1, bufferSize, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * Math.sin(t * Math.PI) * 0.3;
    }

    const noise = audio.ctx.createBufferSource();
    const filter = audio.ctx.createBiquadFilter();
    const gain = audio.ctx.createGain();

    noise.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, audio.ctx.currentTime);
    filter.Q.value = 1;

    gain.gain.setValueAtTime(0.2, audio.ctx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audio.masterGain);

    noise.start();
  },

  // Tick (timer)
  tick() {
    const { osc, gain, ctx } = audio.createOscillator('sine', 1000);
    if (!osc) return;

    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.02);
  },

  // Countdown beep
  countdown(final = false) {
    const freq = final ? 880 : 440;
    const duration = final ? 0.3 : 0.1;
    const { osc, gain, ctx } = audio.createOscillator('sine', freq);
    if (!osc) return;

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
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
