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

## Balancing Checklist

### Before Launch

- [ ] First 5 minutes feel rewarding (early achievements)
- [ ] Difficulty ramps smoothly (no sudden spikes)
- [ ] Scoring feels fair and understandable
- [ ] Combo system is satisfying but forgiving
- [ ] XP curve feels neither too slow nor too fast
- [ ] Rewards come at varied but regular intervals
- [ ] High scores are achievable but aspirational
- [ ] No "impossible" levels or unfair deaths

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
