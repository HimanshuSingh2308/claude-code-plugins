# Game UI Library — Shared Implementations

Canonical CSS and JS implementations for sound, achievements, visual feedback, XP/levels,
and common UI components. These are the exact patterns used across all Weekly Arcade games.

**Usage**: When `add-new-game` or any game integration skill needs these patterns,
reference this file instead of duplicating the code inline.

---

## Required CSS — Achievement Toast, Confetti, Level-Up, Score Pop, Shake, Pulse

Copy this block into the game's `<style>` section. Customise colours to match the game's theme.

```css
/* ── Achievement Toast ── */
.achievement-toast {
  position: fixed; top: 20px; right: -320px;
  background: linear-gradient(135deg, #b59f3b, #8b7a2e);
  padding: 1rem 1.5rem; border-radius: 12px;
  display: flex; align-items: center; gap: 1rem;
  z-index: 2000; box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  transition: right 0.35s ease; max-width: 300px;
}
.achievement-toast.show { right: 20px; }
.achievement-icon { font-size: 2rem; }
.achievement-info { color: #fff; }
.achievement-name { font-weight: 700; font-size: 1rem; }
.achievement-desc { font-size: 0.8rem; opacity: 0.9; }

/* ── Confetti ── */
.confetti-container {
  position: fixed; inset: 0;
  pointer-events: none; z-index: 1500; overflow: hidden;
}
.confetti {
  position: absolute; width: 10px; height: 10px; top: -10px;
  animation: confettiFall 3s ease-out forwards;
}
@keyframes confettiFall {
  0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}

/* ── Level-Up Burst ── */
.levelup-container {
  position: fixed; inset: 0; pointer-events: none;
  z-index: 1600; display: flex; align-items: center; justify-content: center;
}
.levelup-particle {
  position: absolute; width: 8px; height: 8px; border-radius: 50%;
  animation: levelupBurst 1s ease-out var(--delay, 0s) forwards;
}
@keyframes levelupBurst {
  0%   { transform: rotate(var(--angle,0deg)) translateX(0); opacity: 1; }
  100% { transform: rotate(var(--angle,0deg)) translateX(150px); opacity: 0; }
}

/* ── Score Pop ── */
.score-pop {
  position: fixed; pointer-events: none; z-index: 1400;
  font-size: 1.4rem; font-weight: 900; color: #ffd700;
  text-shadow: 0 2px 8px rgba(0,0,0,0.6);
  animation: scorePop 1.2s ease-out forwards;
}
@keyframes scorePop {
  0%   { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(-80px); opacity: 0; }
}

/* ── Shake ── */
.shake { animation: shake 0.5s; }
@keyframes shake {
  0%,100% { transform: translateX(0); }
  20%,60% { transform: translateX(-6px); }
  40%,80% { transform: translateX(6px); }
}

/* ── Pulse ── */
.pulse { animation: pulse 0.4s ease-out; }
@keyframes pulse {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.25); }
  100% { transform: scale(1); }
}
```

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

## Score Submission — via game-cloud.js

**Do NOT write raw `apiClient.submitScore` calls with auth guards.** Use `game-cloud.js`:

```javascript
// ── SCORE SUBMISSION (via game-cloud.js) ───────────────────

// Option A: Simple submit (for games without guest score queuing)
// Handles auth check, nudge for guests, error logging internally.
async function submitScore() {
  await window.gameCloud.submitScore('GAME_SLUG', {
    score: scoreValue,
    level: currentLevel,
    timeMs: elapsedMs,
    metadata: { wave: 5, deck: 'merchant' },
  });
}

// Option B: Submit or queue (for games that store guest scores locally)
// If signed in: submits directly. If guest: saves to localStorage queue.
// { silent: true } suppresses the auth nudge (use for milestones/level-ups).
async function submitScore(isMilestone = false) {
  await window.gameCloud.submitOrQueue('GAME_SLUG', {
    score: scoreValue,
    level: currentLevel,
    timeMs: elapsedMs,
    metadata: { /* game-specific */ },
  }, { silent: isMilestone });
}
```

The old `submitScoreToCloud` pattern with manual `if (!currentUser) return` is deprecated.
All new games must use `gameCloud.submitScore()` or `gameCloud.submitOrQueue()`.

---

## HTML Head Template — SEO, OG, Structured Data

Copy into every game's `<head>`. Replace all `GAME_*` placeholders with PRD values.

**Customization points** (after copying):
- `GAME_NAME`, `GAME_SLUG`, `GAME_THEME_COLOR`, `GAME_KEYWORDS`, `GAME_OG_DESC` — from PRD
- `GAME_GENRE_ARRAY` — JSON array of genre strings from PRD
- `FULL_DESCRIPTION` — longer description for meta + JSON-LD (can differ from card desc)
- `SHORT_TAGLINE` — brief tagline for `<title>` suffix
- Add extra `<meta>` tags if the game has unique SEO needs (e.g. `game:section`)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GAME_NAME | Weekly Arcade - SHORT_TAGLINE</title>
  <meta name="description" content="FULL_DESCRIPTION. No download required.">
  <meta name="keywords" content="GAME_KEYWORDS, browser game, free game, no download">
  <link rel="canonical" href="https://weekly-arcade.web.app/games/GAME_SLUG/">
  <meta property="og:title" content="GAME_NAME | Weekly Arcade">
  <meta property="og:description" content="GAME_OG_DESC">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://weekly-arcade.web.app/games/GAME_SLUG/">
  <meta property="og:image" content="https://weekly-arcade.web.app/og-image.png">
  <meta property="og:site_name" content="Weekly Arcade">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="GAME_NAME | Weekly Arcade">
  <meta name="twitter:description" content="GAME_OG_DESC">
  <meta name="twitter:image" content="https://weekly-arcade.web.app/og-image.png">
  <meta name="theme-color" content="GAME_THEME_COLOR">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    "name": "GAME_NAME",
    "url": "https://weekly-arcade.web.app/games/GAME_SLUG/",
    "description": "FULL_DESCRIPTION",
    "genre": GAME_GENRE_ARRAY,
    "playMode": "SinglePlayer",
    "applicationCategory": "Game",
    "operatingSystem": "Web Browser",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Weekly Arcade", "item": "https://weekly-arcade.web.app/" },
        { "@type": "ListItem", "position": 2, "name": "GAME_NAME", "item": "https://weekly-arcade.web.app/games/GAME_SLUG/" }
      ]
    }
  }
  </script>
</head>
```

---

## Game-Over / Round-End Sequence

Copy into every game. This is the standard 7-step end-of-round sequence.

**Customization points** (after copying):
- **XP formula**: `Math.round(scoreValue / 10)` is the default — adjust divisor per game feel
- **Loss XP**: `25` is the consolation default — set to `0` for punishing games, higher for casual
- **Win condition**: Some games don't have a binary win/lose — adapt the `won` parameter
- **Extra gameData fields**: Pass whatever `checkAchievements` needs (e.g. `combo`, `timeMs`, `wave`)
- **Custom end-of-round actions**: Add game-specific steps after step 6 (e.g. save replay, show stats)

```javascript
function onGameEnd(won, scoreValue, extras = {}) {
  // 1. Sound
  playSound(won ? 'win' : 'fail');

  // 2. Confetti on win
  if (won) showConfetti();

  // 3. Check achievements — returns new IDs
  const newAchievements = checkAchievements({
    won,
    score: scoreValue,
    // pass whatever fields your checkAchievements uses
  });

  // 4. Add XP
  const xpEarned = won ? Math.round(scoreValue / 10) : 25;
  addXP(xpEarned);

  // 5. Show achievement toasts (staggered)
  showNewAchievements(newAchievements);

  // 6. Submit score to cloud (via game-cloud.js)
  window.gameCloud.submitScore('GAME_SLUG', { score: scoreValue, ...extras });

  // 7. Show game-over UI (your own modal/overlay)
  showGameOverModal(won, scoreValue);
}
```
