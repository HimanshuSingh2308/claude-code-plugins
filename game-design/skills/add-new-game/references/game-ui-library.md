# Game UI Library — Shared Implementations

Canonical implementations for sound, achievements, visual feedback, and XP/levels.
These are the exact patterns used across all Weekly Arcade games.

**Usage**: When `add-new-game` or any game integration skill needs these patterns,
reference this file instead of duplicating the code inline.

---

## Sound System — Web Audio API (no external files)

Uses the same oscillator approach as chaos-kitchen.
Add or remove cases as needed for the game. Keep `try/catch` — audio can fail silently.

```javascript
// ── SOUND ──────────────────────────────────────────────────
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.08;

    switch (type) {
      case 'move':
        osc.frequency.value = 440;
        osc.start(); osc.stop(ctx.currentTime + 0.05);
        break;
      case 'place':
        osc.frequency.value = 520;
        osc.start(); osc.stop(ctx.currentTime + 0.08);
        break;
      case 'score':
        osc.frequency.value = 660;
        osc.start();
        setTimeout(() => osc.frequency.value = 880, 60);
        osc.stop(ctx.currentTime + 0.18);
        break;
      case 'levelup':
        osc.type = 'triangle';
        osc.frequency.value = 523;
        osc.start();
        setTimeout(() => osc.frequency.value = 659, 80);
        setTimeout(() => osc.frequency.value = 784, 160);
        osc.stop(ctx.currentTime + 0.5);
        break;
      case 'achievement':
        osc.type = 'sine';
        osc.frequency.value = 880;
        osc.start();
        setTimeout(() => osc.frequency.value = 1100, 100);
        osc.stop(ctx.currentTime + 0.35);
        break;
      case 'fail':
        osc.type = 'sawtooth';
        osc.frequency.value = 200;
        osc.start(); osc.stop(ctx.currentTime + 0.3);
        break;
      case 'win':
        osc.type = 'sine';
        osc.frequency.value = 523;
        osc.start();
        setTimeout(() => osc.frequency.value = 784, 100);
        setTimeout(() => osc.frequency.value = 1047, 220);
        osc.stop(ctx.currentTime + 0.6);
        break;
    }
  } catch (e) { /* audio unavailable */ }
}
```

**When to call each sound:**
- `move` — any cursor/selection movement
- `place` — placing/confirming an item
- `score` — points awarded (combine with score pop animation)
- `levelup` — XP level up
- `achievement` — achievement unlocked
- `fail` — wrong move, death, game over
- `win` — run complete / round won

Add game-specific cases (e.g. `'harvest'`, `'attack'`) following the same pattern.

---

## Achievement System

Define achievements from the PRD. Use this exact shape — it matches the
`ACHIEVEMENTS` object pattern from wordle that `showAchievementToast` expects.

```javascript
// ── ACHIEVEMENTS ───────────────────────────────────────────
// Shape must be: { name, desc, icon, xp }
// IDs are kebab-case strings stored in localStorage
const ACHIEVEMENTS = {
  'first_game':    { name: 'First Steps',   desc: 'Complete your first game',    icon: '🎯', xp: 100 },
  'no_damage':     { name: 'Untouchable',   desc: 'Win without taking damage',   icon: '🛡️', xp: 300 },
  'speed_run':     { name: 'Speed Demon',   desc: 'Complete in under 3 minutes', icon: '⚡', xp: 300 },
  'high_score':    { name: 'Top Scorer',    desc: 'Score over 10,000 points',    icon: '🌟', xp: 500 },
  'streak_3':      { name: 'On a Roll',     desc: '3 wins in a row',             icon: '🔥', xp: 200 },
  'max_level':     { name: 'Grand Master',  desc: 'Reach max level',             icon: '👑', xp: 1000 },
  // Add game-specific achievements from the PRD here
};

// Returns array of newly unlocked achievement IDs
function checkAchievements(gameData) {
  const playerData = JSON.parse(
    localStorage.getItem('GAME_STORAGE_KEY') ||
    '{"xp":0,"level":1,"achievements":[]}'
  );
  const newOnes = [];

  // Always check first_game
  if (!playerData.achievements.includes('first_game')) {
    newOnes.push('first_game');
  }

  // Add game-specific checks using gameData fields:
  // if (gameData.won && gameData.score > 10000 && !playerData.achievements.includes('high_score'))
  //   newOnes.push('high_score');

  if (newOnes.length > 0) {
    let bonusXP = 0;
    newOnes.forEach(id => bonusXP += ACHIEVEMENTS[id]?.xp ?? 0);
    playerData.achievements = [...playerData.achievements, ...newOnes];
    playerData.xp += bonusXP;
    localStorage.setItem('GAME_STORAGE_KEY', JSON.stringify(playerData));
  }
  return newOnes;
}
```

---

## Visual Feedback Functions

Exact implementations from wordle — copy verbatim.

```javascript
// ── VISUAL FEEDBACK ────────────────────────────────────────
let activeToasts = 0;

function showAchievementToast(achievement) {
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `
    <span class="achievement-icon">${achievement.icon}</span>
    <div class="achievement-info">
      <div class="achievement-name">${achievement.name}</div>
      <div class="achievement-desc">${achievement.desc}</div>
    </div>`;
  toast.style.top = (20 + activeToasts * 90) + 'px';
  activeToasts++;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    activeToasts = Math.max(0, activeToasts - 1);
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

function showConfetti() {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);
  const colors = ['#538d4e','#b59f3b','#e94560','#6b5b95','#ffd700','#60a5fa'];
  for (let i = 0; i < 80; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.cssText = `
      left:${Math.random()*100}%;
      background:${colors[i % colors.length]};
      animation-delay:${Math.random()*2}s;
      animation-duration:${2 + Math.random()*2}s;
      border-radius:${Math.random() > 0.5 ? '50%' : '0'};
    `;
    container.appendChild(el);
  }
  setTimeout(() => container.remove(), 5000);
}

function showScorePop(points, x, y) {
  const el = document.createElement('div');
  el.className = 'score-pop';
  el.textContent = `+${points}`;
  el.style.cssText = `left:${x}px; top:${y}px;`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function showLevelUpEffect() {
  const container = document.createElement('div');
  container.className = 'levelup-container';
  document.body.appendChild(container);
  const colors = ['#ffd700','#ff6b35','#4ade80','#60a5fa','#f472b6'];
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'levelup-particle';
    p.style.cssText = `
      --angle:${(i / 40) * 360}deg;
      --delay:${(i % 5) * 0.05}s;
      background:${colors[i % colors.length]};
    `;
    container.appendChild(p);
  }
  setTimeout(() => container.remove(), 1500);
}

// Call after checking achievements — staggers toasts so they don't stack instantly
function showNewAchievements(newIds) {
  newIds.forEach((id, i) => {
    const ach = ACHIEVEMENTS[id];
    if (ach) setTimeout(() => {
      showAchievementToast(ach);
      playSound('achievement');
    }, i * 900);
  });
}
```

---

## XP & Level Progression

```javascript
// ── XP & LEVELS ────────────────────────────────────────────
const XP_PER_LEVEL = 500; // matches packages/shared SCORING.XP_PER_LEVEL

function addXP(amount) {
  const data = JSON.parse(
    localStorage.getItem('GAME_STORAGE_KEY') ||
    '{"xp":0,"level":1,"achievements":[]}'
  );
  const prevLevel = Math.floor(data.xp / XP_PER_LEVEL) + 1;
  data.xp += amount;
  const newLevel = Math.floor(data.xp / XP_PER_LEVEL) + 1;
  localStorage.setItem('GAME_STORAGE_KEY', JSON.stringify(data));

  if (newLevel > prevLevel) {
    showAchievementToast({ name: `Level ${newLevel}!`, icon: '⬆️', desc: 'Player level up!' });
    showLevelUpEffect();
    playSound('levelup');
  }
  return { xp: data.xp, playerLevel: newLevel, leveledUp: newLevel > prevLevel };
}
```

---

## Score Submission — Exact API Pattern

```javascript
// ── SCORE SUBMISSION ───────────────────────────────────────
async function submitScoreToCloud(scoreValue, extras = {}) {
  if (!currentUser || !window.apiClient) return;
  try {
    const result = await window.apiClient.submitScore('GAME_SLUG', {
      score: scoreValue,
      // include only fields relevant to this game (see SubmitScoreDto):
      // level: currentLevel,
      // timeMs: elapsedMs,
      // guessCount: attempts,
      // metadata: { wave: 5, deck: 'merchant' },
      ...extras,
    });
    console.log('[GAME_NAME] Score submitted:', result);
  } catch (err) {
    console.error('[GAME_NAME] Score submit failed:', err);
  }
}
```
