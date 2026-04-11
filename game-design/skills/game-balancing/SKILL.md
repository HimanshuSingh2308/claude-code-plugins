---
name: game-balancing
description: >
  Game balancing patterns for difficulty curves, scoring systems, XP progression,
  and reward timing. Applied when designing game mechanics, tuning difficulty,
  or implementing progression systems. Ensures games are challenging but fair,
  with satisfying reward loops.
---

# Game Balancing & Progression Design

## Core Principles

1. **Flow State**: Keep players in the "zone" - not too easy, not too hard
2. **Clear Progression**: Players should always feel they're improving
3. **Meaningful Rewards**: Every reward should feel earned
4. **Fair Challenge**: Difficulty from skill, not randomness or unfairness

---

## Difficulty Curves

### Linear Progression (Simple Games)

```
Difficulty
    │
    │                    ╱
    │                  ╱
    │                ╱
    │              ╱
    │            ╱
    │          ╱
    │        ╱
    │      ╱
    │    ╱
    │  ╱
    │╱
    └────────────────────── Level/Time
```

**Use for**: Puzzle games, endless runners
**Formula**: `difficulty = baseValue + (level * increment)`

```javascript
function getLinearDifficulty(level) {
  const BASE_SPEED = 1;
  const INCREMENT = 0.1;
  return BASE_SPEED + (level * INCREMENT);
}
```

### Exponential Curve (RPGs, Idle Games)

```
Difficulty
    │                      │
    │                     ╱
    │                   ╱
    │                 ╱
    │              ╱╱
    │           ╱╱
    │        ╱╱
    │     ╱╱
    │  ╱╱
    │╱╱
    └────────────────────── Level/Time
```

**Use for**: RPGs, idle games, long-term progression
**Formula**: `difficulty = baseValue * (multiplier ^ level)`

```javascript
function getExponentialDifficulty(level) {
  const BASE = 100;
  const MULTIPLIER = 1.15; // 15% increase per level
  return Math.floor(BASE * Math.pow(MULTIPLIER, level - 1));
}
```

### S-Curve (Best for Most Games)

```
Difficulty
    │                    ────────
    │                 ╱╱╱
    │               ╱╱
    │             ╱╱
    │           ╱╱
    │         ╱╱
    │       ╱╱
    │     ╱╱
    │   ╱╱╱
    │────
    └────────────────────── Level/Time
```

**Use for**: Action games, arcade games
**Why**: Easy start (learn), steep middle (challenge), plateau (mastery)

```javascript
function getSCurveDifficulty(level, maxLevel = 100) {
  const MIN_DIFFICULTY = 0.1;
  const MAX_DIFFICULTY = 1.0;
  const STEEPNESS = 0.1;
  const MIDPOINT = maxLevel / 2;

  const sigmoid = 1 / (1 + Math.exp(-STEEPNESS * (level - MIDPOINT)));
  return MIN_DIFFICULTY + (MAX_DIFFICULTY - MIN_DIFFICULTY) * sigmoid;
}
```

### Wave Pattern (Tension & Release)

```
Difficulty
    │    ╱╲      ╱╲      ╱╲
    │   ╱  ╲    ╱  ╲    ╱  ╲
    │  ╱    ╲  ╱    ╲  ╱    ╲
    │ ╱      ╲╱      ╲╱      ╲
    │╱
    └────────────────────── Level/Time
```

**Use for**: Story games, boss fights, rhythm games
**Why**: Build tension, release with easier sections

```javascript
function getWaveDifficulty(level, waveLength = 5) {
  const BASE = 0.5;
  const AMPLITUDE = 0.3;
  const wave = Math.sin((level / waveLength) * Math.PI * 2);
  const trend = level * 0.02; // Gradual increase
  return BASE + AMPLITUDE * wave + trend;
}
```

---

## Scoring Systems

### Basic Scoring

```javascript
const SCORING = {
  // Base points
  POINT_PER_ACTION: 10,
  POINT_PER_LEVEL: 100,

  // Multipliers
  COMBO_MULTIPLIER: 0.1,     // +10% per combo
  MAX_COMBO_MULTIPLIER: 3.0, // Cap at 3x
  SPEED_BONUS_THRESHOLD: 5,  // Seconds for speed bonus
  SPEED_BONUS_MULTIPLIER: 1.5,

  // Penalties
  MISTAKE_PENALTY: -5,
  TIME_PENALTY_PER_SECOND: -1,
};

function calculateScore(actions, combo, timeSeconds, mistakes) {
  let score = actions * SCORING.POINT_PER_ACTION;

  // Combo bonus
  const comboMultiplier = Math.min(
    1 + (combo * SCORING.COMBO_MULTIPLIER),
    SCORING.MAX_COMBO_MULTIPLIER
  );
  score *= comboMultiplier;

  // Speed bonus
  if (timeSeconds < SCORING.SPEED_BONUS_THRESHOLD) {
    score *= SCORING.SPEED_BONUS_MULTIPLIER;
  }

  // Penalties
  score += mistakes * SCORING.MISTAKE_PENALTY;

  return Math.max(0, Math.floor(score));
}
```

### Combo System

```javascript
class ComboSystem {
  constructor(options = {}) {
    this.count = 0;
    this.maxCount = 0;
    this.timer = null;
    this.decayTime = options.decayTime || 2000; // ms before combo resets
    this.onUpdate = options.onUpdate || (() => {});
  }

  hit() {
    this.count++;
    this.maxCount = Math.max(this.maxCount, this.count);
    this.resetTimer();
    this.onUpdate(this.count, this.getMultiplier());
    return this.getMultiplier();
  }

  miss() {
    const lostCombo = this.count;
    this.count = 0;
    this.clearTimer();
    this.onUpdate(0, 1);
    return lostCombo;
  }

  getMultiplier() {
    // Diminishing returns after 10
    if (this.count <= 10) {
      return 1 + (this.count * 0.1);
    }
    return 2 + ((this.count - 10) * 0.05);
  }

  resetTimer() {
    this.clearTimer();
    this.timer = setTimeout(() => this.miss(), this.decayTime);
  }

  clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
```

### Star Rating System

```javascript
function calculateStars(score, parScore, thresholds = [0.5, 0.75, 0.9]) {
  const ratio = score / parScore;

  if (ratio >= thresholds[2]) return 3; // ⭐⭐⭐
  if (ratio >= thresholds[1]) return 2; // ⭐⭐
  if (ratio >= thresholds[0]) return 1; // ⭐
  return 0; // No stars
}

// Visual representation
function renderStars(count, max = 3) {
  return '⭐'.repeat(count) + '☆'.repeat(max - count);
}
```

---

## XP & Level Progression

### XP Requirements per Level

```javascript
// Common formulas for XP to next level

// Linear: 100 XP per level
const linearXP = (level) => level * 100;

// Quadratic: Gets harder each level
const quadraticXP = (level) => Math.floor(100 * Math.pow(level, 1.5));

// Fibonacci-like: Natural feeling progression
const fibonacciXP = (level) => {
  if (level <= 1) return 100;
  return fibonacciXP(level - 1) + fibonacciXP(level - 2) * 0.5;
};

// Runescape-style: Exponential with diminishing returns
const runescapeXP = (level) => Math.floor(
  (Math.pow(level, 2) - level + 600) *
  (Math.pow(2, level / 7) - Math.pow(2, 1/7)) /
  (Math.pow(2, 1/7) - 1) / 4
);
```

### Level-Up System

```javascript
class LevelSystem {
  constructor(options = {}) {
    this.xp = options.startXP || 0;
    this.level = options.startLevel || 1;
    this.maxLevel = options.maxLevel || 100;
    this.xpFormula = options.xpFormula || ((lvl) => Math.floor(100 * Math.pow(lvl, 1.5)));
    this.onLevelUp = options.onLevelUp || (() => {});
  }

  getXPForLevel(level) {
    return this.xpFormula(level);
  }

  getXPToNextLevel() {
    if (this.level >= this.maxLevel) return Infinity;
    return this.getXPForLevel(this.level) - this.xp;
  }

  getProgress() {
    const required = this.getXPForLevel(this.level);
    const prevRequired = this.level > 1 ? this.getXPForLevel(this.level - 1) : 0;
    const currentLevelXP = this.xp - prevRequired;
    const neededForLevel = required - prevRequired;
    return currentLevelXP / neededForLevel;
  }

  addXP(amount) {
    if (this.level >= this.maxLevel) return { levelsGained: 0 };

    this.xp += amount;
    let levelsGained = 0;

    while (this.xp >= this.getXPForLevel(this.level) && this.level < this.maxLevel) {
      this.level++;
      levelsGained++;
      this.onLevelUp(this.level);
    }

    return { levelsGained, newLevel: this.level, totalXP: this.xp };
  }
}

// Usage
const playerLevel = new LevelSystem({
  xpFormula: (lvl) => Math.floor(100 * Math.pow(lvl, 1.5)),
  onLevelUp: (newLevel) => {
    showLevelUpEffect();
    unlockRewards(newLevel);
  }
});
```

---

## Reward Timing

### Variable Ratio Schedule (Most Engaging)

Like slot machines - unpredictable but frequent enough to keep playing.

```javascript
class RewardScheduler {
  constructor(options = {}) {
    this.baseChance = options.baseChance || 0.1; // 10% base
    this.pityCounter = 0;
    this.pityThreshold = options.pityThreshold || 10; // Guaranteed after 10 tries
  }

  roll() {
    this.pityCounter++;

    // Pity system: guaranteed reward after threshold
    if (this.pityCounter >= this.pityThreshold) {
      this.pityCounter = 0;
      return true;
    }

    // Increasing chance as pity builds
    const adjustedChance = this.baseChance + (this.pityCounter * 0.02);

    if (Math.random() < adjustedChance) {
      this.pityCounter = 0;
      return true;
    }

    return false;
  }
}
```

### Achievement Unlocks

```javascript
const ACHIEVEMENTS = {
  // Early game - Easy wins to hook player
  first_game: { name: 'First Steps', xp: 50, requirement: 1 },
  score_100: { name: 'Getting Started', xp: 100, requirement: 100 },

  // Mid game - Skill demonstrations
  combo_10: { name: 'Combo Master', xp: 200, requirement: 10 },
  no_mistakes: { name: 'Perfect Run', xp: 300, requirement: 0 },

  // Late game - Mastery
  score_10000: { name: 'High Roller', xp: 500, requirement: 10000 },
  streak_7: { name: 'Weekly Warrior', xp: 1000, requirement: 7 },

  // Secret/Rare - Surprise and delight
  lucky_777: { name: 'Lucky Seven', xp: 777, requirement: 777, secret: true },
};

// Space achievements across playtime
const ACHIEVEMENT_TIMELINE = {
  0: ['first_game'],           // Immediate
  5: ['score_100'],            // ~5 minutes
  15: ['combo_10'],            // ~15 minutes
  30: ['no_mistakes'],         // ~30 minutes
  60: ['score_10000'],         // ~1 hour
  'daily': ['streak_7'],       // Multi-day
};
```

---

## Adaptive Difficulty & Rubber-Banding

Adaptive difficulty adjusts game parameters in real-time based on how the player is performing. The goal is to keep every player in the flow channel — challenged but not frustrated — without them noticing the system exists.

### When to Use Adaptive Difficulty

| Scenario | Use? | Why |
|----------|------|-----|
| Story/campaign mode | Yes | Keep all skill levels engaged |
| Casual/mobile games | Yes | Reduce bounce from frustration |
| Endless/arcade mode | Sometimes | Gentle assist, but let skill shine |
| Daily challenges | **No** | Must be identical for all players |
| Leaderboard-competitive modes | **No** | Undermines fair competition |
| Speedrun/hardcore modes | **No** | Players expect and want the challenge |

### Simple Adaptive Difficulty System

Track recent performance and adjust a difficulty multiplier up or down.

```javascript
class AdaptiveDifficulty {
  constructor(options = {}) {
    this.multiplier = 1.0;
    this.min = options.min || 0.5;
    this.max = options.max || 1.5;
    this.step = options.step || 0.05;
    this.history = [];            // Recent outcomes: true = success, false = fail
    this.windowSize = options.windowSize || 10;
  }

  recordOutcome(success) {
    this.history.push(success);
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }
    this.adjust();
  }

  adjust() {
    if (this.history.length < 3) return; // Need minimum data

    const recentWinRate = this.history.filter(Boolean).length / this.history.length;

    if (recentWinRate > 0.8) {
      // Player is cruising — increase difficulty
      this.multiplier = Math.min(this.max, this.multiplier + this.step);
    } else if (recentWinRate < 0.4) {
      // Player is struggling — decrease difficulty
      this.multiplier = Math.max(this.min, this.multiplier - this.step);
    }
    // Between 0.4–0.8 win rate: player is in the flow zone, hold steady
  }

  // Apply to any game parameter
  apply(baseValue) {
    return baseValue * this.multiplier;
  }

  reset() {
    this.multiplier = 1.0;
    this.history = [];
  }
}

// Usage
const difficulty = new AdaptiveDifficulty({ min: 0.6, max: 1.4 });

function startLevel(levelConfig) {
  const enemySpeed = difficulty.apply(levelConfig.baseEnemySpeed);
  const enemyCount = Math.round(difficulty.apply(levelConfig.baseEnemyCount));
  const timeLimit = levelConfig.baseTimeLimit / difficulty.multiplier; // More time when harder
  return { enemySpeed, enemyCount, timeLimit };
}

function onLevelComplete(won) {
  difficulty.recordOutcome(won);
}
```

### Rubber-Banding

Rubber-banding specifically helps struggling players catch up. Unlike general adaptive difficulty, rubber-banding kicks in only when a player is clearly behind.

```javascript
class RubberBanding {
  constructor() {
    this.consecutiveFailures = 0;
    this.hints = [];
  }

  onSuccess() {
    this.consecutiveFailures = 0;
    this.hints = [];
  }

  onFailure(context) {
    this.consecutiveFailures++;
    return this.getAssist();
  }

  getAssist() {
    // Escalating assistance based on failure count
    if (this.consecutiveFailures >= 5) {
      return {
        type: 'skip_offer',
        message: 'This one is tough! Skip to the next level?',
        bonusApplied: true
      };
    }
    if (this.consecutiveFailures >= 3) {
      return {
        type: 'power_up',
        message: 'Here\'s a boost to help out!',
        bonusApplied: true
      };
    }
    if (this.consecutiveFailures >= 2) {
      return {
        type: 'hint',
        message: 'Tip: Try focusing on the left side first.',
        bonusApplied: false
      };
    }
    return null; // No assist yet
  }
}
```

### Anti-Frustration Features

These are specific quality-of-life mechanics that prevent player drop-off.

```javascript
const ANTI_FRUSTRATION = {
  // Show a contextual hint after player is stuck
  stuckTimer: {
    idleThreshold: 15000,   // 15 seconds with no progress
    hintDelay: 20000,       // Show hint at 20 seconds
    autoSolveOffer: 45000,  // Offer to show solution at 45 seconds
  },

  // Coyote time — forgive near-misses
  coyoteTime: {
    platformJump: 100,      // ms after leaving platform edge
    hitboxShrink: 0.8,      // Enemy hitbox 80% of visual (favor player)
  },

  // Retry quality of life
  retry: {
    instantRetry: true,      // No loading screen on retry
    checkpointFrequency: 30, // Seconds between auto-checkpoints
    keepCollectibles: true,  // Don't lose items on death
  },
};

// Stuck detection example
class StuckDetector {
  constructor(onHint, onAutoSolve) {
    this.lastProgressTime = Date.now();
    this.hintShown = false;
    this.onHint = onHint;
    this.onAutoSolve = onAutoSolve;
    this.checkInterval = setInterval(() => this.check(), 1000);
  }

  recordProgress() {
    this.lastProgressTime = Date.now();
    this.hintShown = false;
  }

  check() {
    const stuckTime = Date.now() - this.lastProgressTime;

    if (stuckTime >= ANTI_FRUSTRATION.stuckTimer.autoSolveOffer) {
      this.onAutoSolve();
    } else if (stuckTime >= ANTI_FRUSTRATION.stuckTimer.hintDelay && !this.hintShown) {
      this.onHint();
      this.hintShown = true;
    }
  }

  destroy() {
    clearInterval(this.checkInterval);
  }
}
```

---

## Balancing Checklist

### Before Launch

- [ ] First 5 minutes feel rewarding (early achievements)
- [ ] Difficulty ramps smoothly (no sudden spikes — see spike detection below)
- [ ] Scoring feels fair and understandable
- [ ] Combo system is satisfying but forgiving
- [ ] XP curve feels neither too slow nor too fast
- [ ] Rewards come at varied but regular intervals
- [ ] High scores are achievable but aspirational
- [ ] No "impossible" levels or unfair deaths

### Detecting Difficulty Spikes

A difficulty spike occurs when a level is disproportionately harder than its neighbors. Use this formula to flag spikes:

```javascript
function detectSpikes(levels) {
  // levels = [{ level: 1, parMoves: 12 }, { level: 2, parMoves: 15 }, ...]
  const spikes = [];
  for (let i = 1; i < levels.length; i++) {
    const prev = levels[i - 1].parMoves;
    const curr = levels[i].parMoves;
    const delta = (curr - prev) / prev;  // % increase

    // Flag if difficulty jumps more than 40% between adjacent levels
    if (delta > 0.4) {
      spikes.push({
        level: levels[i].level,
        increase: Math.round(delta * 100) + '%',
        severity: delta > 0.8 ? 'CRITICAL' : 'WARNING',
      });
    }
  }
  return spikes;
}
```

**Thresholds:**
| Jump | Severity | Action |
|------|----------|--------|
| < 25% | Normal | Expected progression |
| 25-40% | Watch | Monitor drop-off at this level |
| 40-80% | WARNING | Add a breather level before, or split into 2 levels |
| > 80% | CRITICAL | Players will quit here — must flatten the curve |

**Common spike locations:**
- Tutorial → first real level (fix: add 1-2 bridge levels)
- New mechanic introduction (fix: introduce mechanic in isolation first)
- Color/element count increase (fix: increase by 1, not 2+)
- Mode transitions (easy → medium → hard in daily challenges)

### Metrics to Track

```javascript
const BALANCE_METRICS = {
  // Session metrics
  averageSessionLength: '5-15 min target',
  sessionsBeforeChurn: '3+ sessions target',
  levelCompletionRate: '70-90% per level',

  // Difficulty metrics
  deathsPerLevel: '0.5-2 deaths target',
  retryRate: '20-40% target',
  skipRate: '<10% target',

  // Engagement metrics
  achievementUnlockRate: '1 per 10 min target',
  comboHitRate: '60-80% target',
  scoreVariance: 'Should decrease with skill',
};
```
