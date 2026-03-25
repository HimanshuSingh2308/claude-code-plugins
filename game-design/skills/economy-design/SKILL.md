---
name: economy-design
description: >
  Game economy design patterns for currency systems, upgrade pricing, resource
  sinks/faucets, inflation control, and progression pacing. Applied when designing
  in-game shops, upgrade trees, currency rewards, or balancing how fast players
  earn vs spend. Essential for idle/tycoon, RPG, and any game with purchasable upgrades.
---

# Game Economy Design

## Core Principle: The Economy IS the Progression

In any game with upgrades or currency, the economy determines how fast the player progresses. Too generous → trivially easy, no motivation. Too stingy → frustrating grind. The goal is a steady feeling of "I can almost afford the next thing."

---

## 1. Faucets and Sinks

Every game economy has two sides:

| | Definition | Examples |
|--|-----------|---------|
| **Faucet** | Source of currency entering the system | Coins per customer, level completion reward, daily bonus |
| **Sink** | Drain that removes currency from the system | Upgrade purchases, consumable items, retry costs |

### The Balance Rule

```
Total Faucets per Session ≈ 60-80% of Cheapest Available Sink
```

This means a player needs ~1.3-1.7 sessions to afford their next upgrade. This is the sweet spot — achievable but not instant.

### Common Faucets

| Faucet Type | Pacing | Best For |
|-------------|--------|----------|
| **Per-action** | Continuous | Core loop reward (coins per serve) |
| **Per-session** | End of round | Session completion bonus |
| **Time-based** | Idle | Idle/offline earnings |
| **Streak/daily** | Daily | Retention hook |
| **Achievement** | One-time | Milestone reward |
| **Random bonus** | Surprise | Engagement spike (VIP customer, tip) |

### Common Sinks

| Sink Type | Purpose | Design Rule |
|-----------|---------|-------------|
| **Upgrades** | Primary progression | Always have at least 2 affordable upgrades |
| **Consumables** | Tactical spending | Optional, never required to progress |
| **Cosmetics** | Endgame sink | Pure vanity, doesn't affect gameplay |
| **Prestige/Reset** | Infinite sink | Resets progress for permanent multiplier |
| **Repair/Maintenance** | Resource drain | Use sparingly — feels like punishment |

---

## 2. Upgrade Pricing Formulas

### Linear Cost Scaling

```javascript
cost = baseCost + (level * increment)
```

**Example**: `80 + (level * 40)` → 120, 160, 200, 240...
**Feel**: Steady, predictable. Each level costs a bit more.
**Best for**: Early game, non-critical upgrades.

### Exponential Cost Scaling

```javascript
cost = baseCost * Math.pow(multiplier, level)
```

**Example**: `100 * 1.5^level` → 100, 150, 225, 337, 506...
**Feel**: Cheap at first, then increasingly expensive.
**Best for**: Core upgrades, primary progression path.

### Polynomial Cost Scaling

```javascript
cost = baseCost * Math.pow(level + 1, exponent)
```

**Example**: `50 * (level+1)^2` → 50, 200, 450, 800, 1250...
**Feel**: Accelerating but not as steep as exponential.
**Best for**: Mid-game upgrades, balanced progression.

### Flat Cost (Single Purchase)

```javascript
cost = fixedPrice
```

**Example**: Auto-Serve #1 = 500 coins, always.
**Feel**: Clear goal, satisfying to save up for.
**Best for**: Binary unlocks (on/off), zone unlocks, special items.

### Comparison Table

| Level | Linear (80+40n) | Polynomial (50n²) | Exponential (100×1.5ⁿ) |
|-------|-----------------|-------------------|----------------------|
| 1 | 120 | 50 | 150 |
| 2 | 160 | 200 | 225 |
| 3 | 200 | 450 | 337 |
| 4 | 240 | 800 | 506 |
| 5 | 280 | 1,250 | 759 |
| 8 | 400 | 3,200 | 2,562 |
| 10 | 480 | 5,000 | 5,766 |

**Rule of thumb**: Use linear for levels 1-3, polynomial for 4-7, exponential for 8+.

---

## 3. Revenue Curve Validation

Before shipping, verify that upgrade costs align with expected revenue:

### Revenue Projection Template

| Day | Est. Customers | Est. Revenue/Day | Cumulative Wallet | Affordable Upgrades |
|-----|---------------|-------------------|-------------------|---------------------|
| 1 | 15 | ~100 | 100 | Tip Jar Lv1 |
| 2 | 17 | ~130 | 230 | Speed Boost Lv1 |
| 3 | 19 | ~170 | 400 | Patience Plus Lv1 |
| 5 | 22 | ~250 | 900 | Auto-Serve #1 |
| 8 | 26 | ~400 | 1,900 | Premium Menu, VIP Lv1 |
| 10 | 30 | ~550 | 3,000 | Auto-Serve #2 |
| 15 | 35 | ~800 | 6,500 | Most maxed, Auto #3 |
| 20 | 40 | ~1,200 | 12,000 | Everything maxed |

### Key Milestones to Validate

```
[ ] Day 1-2: Player can afford SOMETHING (first upgrade = dopamine hit)
[ ] Day 3-5: Player has 2-3 upgrades, feels meaningfully stronger
[ ] Day 5-8: First major unlock (auto-serve or new zone)
[ ] Day 10-12: Mid-game power spike (multiple upgrades stacking)
[ ] Day 15+: Approaching max — upgrades become luxury, leaderboard is the goal
[ ] Day 20+: All upgrades maxed — pure score chasing
```

### The "Can't Afford Anything" Test

At no point should the player be in a state where:
- They can't afford ANY upgrade AND
- Their next day's revenue won't change this

If this happens, the economy is broken. Fix by either:
1. Reducing the cheapest available upgrade cost
2. Adding a bonus faucet (daily bonus, achievement reward)
3. Adding a cheaper "bridge" upgrade between tiers

---

## 4. Multi-Currency Systems

### When to Use Multiple Currencies

| Currencies | When | Example |
|------------|------|---------|
| **1 (simple)** | Casual games, short sessions | Coins only |
| **2 (soft + hard)** | F2P with optional monetization | Coins (earned) + Gems (bought/rare) |
| **3+ (economy)** | Deep sims, MMOs | Gold + Wood + Iron + Gems |

### Dual Currency Design

```
┌─────────────────────────────────┐
│  SOFT CURRENCY (Coins)          │
│  Earned by: playing the game    │
│  Spent on: upgrades, retries    │
│  Rate: ~100 per session         │
├─────────────────────────────────┤
│  HARD CURRENCY (Gems)           │
│  Earned by: achievements, rare  │
│  Spent on: cosmetics, speed-ups │
│  Rate: ~5 per session           │
└─────────────────────────────────┘
```

**Golden rule**: NEVER gate core gameplay behind hard currency. Hard currency buys convenience or cosmetics only.

---

## 5. Inflation Control

As players get stronger, they earn more. If costs don't scale, money becomes meaningless.

### Inflation Sources

| Source | Impact | Mitigation |
|--------|--------|------------|
| Upgrades that boost earnings | High | Cap earning multipliers |
| Auto-serve / passive income | High | Auto-serve earns less per action |
| Combo multipliers | Medium | Cap at 3x |
| Level progression (more customers) | Medium | More customers = more angry risk |

### Anti-Inflation Patterns

**Upgrade cost scaling** — Each upgrade level costs more (exponential or polynomial)

**Diminishing returns** — Each upgrade level gives less benefit:
```javascript
// Level 1: -5% serve time, Level 2: -4.75%, Level 3: -4.5%...
serveTime * Math.pow(0.95, level)  // Compounding gives diminishing absolute reduction
```

**New sinks at milestones** — When player reaches mid-game, unlock expensive cosmetics or prestige options that drain excess currency

**Prestige/Reset system** — Player resets progress for a permanent multiplier, draining ALL accumulated currency

---

## 6. Upgrade Tree Design

### Flat List (Simple)

```
[Speed Boost]  [Patience Plus]  [Tip Jar]  [Premium Menu]
  Each independent, buy in any order
```

**Pros**: Simple, player has autonomy
**Cons**: No strategy, no "aha" moments

### Prerequisite Chain (Linear)

```
[Basic] → [Advanced] → [Expert] → [Master]
```

**Pros**: Clear progression path
**Cons**: No choice, everyone has same build

### Branching Tree (Best for most games)

```
                    [Speed Boost]
                   /
[Start] → [Core] → [Auto-Serve #1] → [Auto-Serve #2] → [Auto-Serve #3]
                   \
                    [VIP Lounge] → [VIP Lv2] → [VIP Lv3]
```

**Pros**: Strategic choices, replayability (different build paths)
**Cons**: More complex to balance

### Upgrade Tiers (Idle/Tycoon)

| Tier | Cost Range | When Available | Purpose |
|------|-----------|----------------|---------|
| 1 (Basic) | 50-200 | Day 1-3 | Learn upgrade system, feel progress |
| 2 (Standard) | 200-600 | Day 3-7 | Core power growth |
| 3 (Premium) | 600-2,000 | Day 7-12 | Significant gameplay additions |
| 4 (Endgame) | 2,000-10,000 | Day 12+ | Min-maxing, luxury |

---

## 7. Pricing Psychology

### Anchoring

Show the most expensive upgrade first → cheaper ones feel like deals.

### The "Almost There" Effect

Show progress toward next purchase: "142/200 coins to Speed Boost Lv3"
Players are more motivated when they can see they're close.

### Round Number Pricing

Avoid round numbers for upgrade costs — `120` feels more considered than `100`.
Players trust non-round numbers more (feels calculated, not arbitrary).

### Bundle/Package Deals

If selling multiple things, offer a "starter pack" bundle at 20% discount.
Even in non-monetized games, "buy 2 upgrades in a row" → small bonus coins.

---

## 8. Economy Balancing Checklist

```
[ ] Player can afford first upgrade within 2 sessions
[ ] There's always at least 1 affordable upgrade available
[ ] No "dead zone" where player can't afford anything and can't earn enough
[ ] Upgrade costs scale faster than earnings (prevents trivial late game)
[ ] Earnings per session are visible and predictable (player can plan purchases)
[ ] Major unlocks (new zones, workers) feel like milestone achievements
[ ] Late-game players have something to spend on (cosmetics, prestige, max upgrades)
[ ] Revenue projection validates: costs align with ~1.5 sessions per upgrade
[ ] Currency earned per minute stays satisfying even at max upgrades
[ ] Total time to "max everything" is 2-4 hours for casual games
```

---

## 9. Economy Design Checklist for PRD

```
[ ] How many currencies? What are they?
[ ] What are the faucets? (earning sources with rates)
[ ] What are the sinks? (spending options with costs)
[ ] What pricing formula do upgrades use? (linear/poly/exponential)
[ ] Revenue projection table: earnings vs costs by day/session
[ ] When does the player afford their first upgrade?
[ ] When does the player max out everything?
[ ] Are there diminishing returns on earning upgrades?
[ ] Is there an endgame sink for excess currency?
[ ] What happens if a player earns way more/less than expected?
```
