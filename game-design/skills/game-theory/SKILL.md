---
name: game-theory
description: >
  Game theory and player psychology foundations for game design. Covers flow theory,
  cognitive load, player motivation (intrinsic/extrinsic), Bartle's player types,
  the peak-end rule, loss aversion, decision fatigue, and other psychological
  frameworks that drive fun, engagement, and retention. Applied when designing
  core loops, difficulty, reward systems, or analyzing why a game feels good or bad.
---

# Game Theory & Player Psychology

## Why This Matters

Every design decision in a game is a psychological decision. Understanding WHY players feel fun, frustration, flow, or boredom lets you design intentionally instead of guessing.

---

## 1. Flow Theory (Csikszentmihalyi)

The single most important framework in game design.

**Flow** is the mental state where a person is fully immersed — challenged but capable, focused but not anxious. Games that achieve flow are the ones players call "addictive" in a positive sense.

### The Flow Channel

```
High ┌──────────────────────────────┐
     │                              │
     │   ANXIETY                    │
     │   (too hard)     ╱╱╱╱       │
     │               ╱╱╱╱          │
Skill│            ╱╱╱╱  ← FLOW    │
     │         ╱╱╱╱     CHANNEL    │
     │      ╱╱╱╱                   │
     │   ╱╱╱╱                      │
     │   BOREDOM                   │
     │   (too easy)                │
Low  └──────────────────────────────┘
     Low        Challenge        High
```

### How to Keep Players in Flow

| Condition | How to Achieve It |
|-----------|------------------|
| **Clear goals** | Player always knows what to do next (serve customers, reach score, clear level) |
| **Immediate feedback** | Every action has instant visual/audio response (coins pop, bars fill, sounds play) |
| **Balance of challenge and skill** | Difficulty matches player's growing ability (dynamic difficulty, progressive unlocks) |
| **Sense of control** | Player's choices matter; outcomes feel fair, not random |
| **Merged action and awareness** | No menus/interruptions during core loop; everything happens in the game space |
| **Loss of self-consciousness** | Player forgets they're "playing a game" — deeply immersed |

### Practical Application

```
Day 1: Easy (3s spawn, 12s patience) → Player learns mechanics in flow
Day 3: Medium (2.4s spawn, 10s patience) → Challenge matches new skill
Day 5: Hard event (Rush Hour) → Spike of tension, then relief
Day 8: Complex (6 drink types, fast spawns) → Skill expression, combo mastery
Day 15+: Expert (auto-serve management, VIP + regular balance) → Deep flow
```

**Rule of thumb**: If a player fails more than 3 times in a row, the game is out of flow. If they never fail, they're bored.

---

## 2. Player Motivation

### Intrinsic vs Extrinsic Motivation

| Type | Driver | Example | Longevity |
|------|--------|---------|-----------|
| **Intrinsic** | Internal satisfaction, curiosity, mastery | "I want to see how high I can score" | Very long — this is real fun |
| **Extrinsic** | External rewards, points, unlocks | "I want to unlock the VIP Lounge" | Shorter — needs constant new rewards |

**Best games use both**: Intrinsic fun from the core loop (satisfying to serve customers) + extrinsic rewards for progression (upgrades, achievements, leaderboard rank).

**Warning**: Over-reliance on extrinsic rewards kills intrinsic motivation (the "overjustification effect"). If you make the game about earning coins, players forget that tapping to serve is fun on its own.

### Self-Determination Theory (Deci & Ryan)

Three universal human needs that games should satisfy:

| Need | In Games | Design Implication |
|------|----------|-------------------|
| **Autonomy** | Player chooses strategy, order, approach | Don't force one optimal path; let players decide upgrade order |
| **Competence** | Player feels skilled and effective | Clear feedback, fair difficulty, visible improvement |
| **Relatedness** | Connection to others (even async) | Leaderboards, friend scores, shared achievements |

### Bartle's Player Types

Players are motivated differently. Design for all four:

| Type | Motivation | % of Players | What They Want |
|------|-----------|-------------|----------------|
| **Achiever** | Mastering systems, completing goals | ~40% | All achievements, max score, 100% completion |
| **Explorer** | Discovering hidden content | ~25% | Secret achievements, hidden mechanics, Easter eggs |
| **Socializer** | Connecting with other players | ~25% | Leaderboards, friend challenges, sharing |
| **Killer** | Dominating competition | ~10% | Top of leaderboard, PvP, world records |

**Design checklist**: Does your game have something for each type?
- Achievers: Achievement system, upgrade completion, milestones
- Explorers: Hidden combos, secret customer types, Easter egg rewards
- Socializers: Leaderboards, shareable scores, friend comparison
- Killers: Daily/weekly leaderboard resets, rank #1 chasing

---

## 3. Cognitive Load Theory

### Working Memory Limits

Players can hold **4 ± 1 items** in working memory simultaneously. Exceeding this causes confusion and frustration.

| Elements to Track | Cognitive Load | Player Feeling |
|-------------------|---------------|----------------|
| 1-2 | Very low | Bored (too simple) |
| 3-4 | Optimal | Engaged (flow zone) |
| 5-6 | High | Challenged (exciting) |
| 7+ | Overload | Frustrated (overwhelming) |

### Application to Game Design

**HUD**: Show maximum 4 key pieces of info (score, timer, combo, coins left)
**Mechanics**: Introduce one new mechanic at a time, never two simultaneously
**Customer types**: Start with 2 types, gradually add more (don't show 6 types on day 1)
**Upgrades**: Categorize into groups; don't show 10 upgrades at once without structure

### Progressive Disclosure

Reveal complexity gradually:

```
Day 1:   2 drink types, simple serve-and-earn
Day 3:   3rd drink type introduced
Day 5:   Rush Hour events appear
Day 8:   Complex drinks unlock
Day 10+: Auto-serve management layer
VIP:     Entirely new zone + waiter mechanic
```

Each addition is a "lesson" the player can absorb before the next.

---

## 4. The Peak-End Rule (Kahneman)

People judge an experience based on two moments:
1. The **peak** (most intense moment)
2. The **end** (how it concluded)

**NOT** the average or duration.

### Application

| Moment | How to Design It |
|--------|-----------------|
| **Peak** | Rush Hour event, massive combo, close call that succeeds |
| **End** | Day-end summary with celebration, personal best fanfare, "one more?" prompt |

**Bad ending**: Timer runs out during a frustrating streak → player remembers frustration
**Good ending**: Even if the day was mediocre, show positive stats ("You served 25 customers!") → player remembers positivity

### Design Pattern: The End Celebration

Always end a session on a positive note:
1. Show what went RIGHT (customers served, coins earned)
2. Compare to personal best (even if not beaten — "only 50 coins away!")
3. Tease the next session ("Day 6 unlocks Smoothies!")
4. Make the "play again" button the most prominent element

---

## 5. Loss Aversion & the Endowment Effect

People feel losses **2x more intensely** than equivalent gains.

### Losing 5 coins feels TWICE as bad as gaining 5 coins feels good.

| Mechanism | Usage | Caution |
|-----------|-------|---------|
| **Streak protection** | "Don't break your 7-day streak!" | Very effective but can feel manipulative |
| **Combo preservation** | Combo Keeper upgrade protects combos | Lets players BUY protection against loss |
| **Persistent progress** | Upgrades carry across sessions | Player won't quit because they'd "lose" progress |
| **Limited-time events** | "Rush Hour — bonus coins for 10s!" | FOMO drives engagement |

### The Endowment Effect

Players value what they already own more than equivalent things they don't.

**Application**: Let players customize their shop → they become attached → higher retention because they don't want to "lose" their unique shop.

---

## 6. Decision Fatigue

Every decision costs mental energy. Too many decisions → exhaustion → quitting.

### Reduce Decision Fatigue

| Problem | Solution |
|---------|----------|
| 10 upgrades to choose from | Categorize into groups, highlight "recommended" |
| Which customer to serve? | Only front-of-queue is tappable (forced order) |
| When to use power-ups? | Auto-activate, or very clear "use now" moments |
| Complex menu systems | One screen at a time, clear hierarchy |

### Good Defaults

If the player does NOTHING, the game should still be somewhat playable:
- Auto-serve workers handle some customers
- Patience bars show urgency visually (no reading required)
- Best upgrade is highlighted with "RECOMMENDED" badge

---

## 7. Reward Psychology

### Variable Ratio Reinforcement

The most addictive reward schedule (slot machines use this):
- Reward comes after an **unpredictable** number of actions
- Player never knows when the next reward hits
- This drives "one more try" behavior

**In games**: Random VIP customers, random Rush Hour events, random tip bonuses.

### The Reward Cascade

Layer multiple rewards on a single action for maximum satisfaction:

```
Serve a customer:
  ├── Coins appear (+$25)          ← Immediate reward
  ├── Combo increments (x2.1!)     ← Progress reward
  ├── Tip bonus (+TIP!)            ← Surprise reward (sometimes)
  ├── Achievement unlocks (🏆)     ← Milestone reward (rare)
  └── Sound + particles             ← Sensory reward (always)
```

### Reward Frequency Guidelines

| Reward Type | Frequency | Purpose |
|-------------|-----------|---------|
| Micro (coins, points) | Every action | Continuous feedback |
| Small (combo milestone, tip) | Every 5-10 actions | Rhythmic satisfaction |
| Medium (achievement, level up) | Every 5-15 minutes | Session milestone |
| Large (new zone, major unlock) | Every 30-60 minutes | Long-term goal |
| Epic (personal best, #1 rank) | Unpredictable | Peak experience |

---

## 8. The Zeigarnik Effect

**Unfinished tasks are remembered better than completed ones.**

### Application

- Show a partially-filled progress bar toward the next upgrade ("67% to Auto-Serve!")
- Show "3 more achievements to unlock" on the title screen
- Day-end: "You're 120 coins from upgrading Speed Boost!"
- This creates tension that pulls the player back for "one more day"

---

## 9. Social Comparison Theory (Festinger)

People evaluate themselves by comparing to others, especially similar others.

### In-Game Social Design

| Pattern | Effect | Implementation |
|---------|--------|---------------|
| **Nearby ranks** | Motivation to climb | Show rank #47 + 3 above and 3 below |
| **Friend scores** | Personal competition | "Your friend scored 1,200 on Day 12" |
| **Percentile** | Normalized comparison | "Better than 73% of players" |
| **Aspirational** | Goal setting | "Top 10 scores this week" |

**Never** show a player they're rank #50,000 with no context. Always frame competitively: "Top 15% of all players!"

---

## 10. Practical Framework: The "Fun Equation"

```
FUN = (Agency × Mastery × Surprise) / Friction
```

| Component | Description | Increase By |
|-----------|-------------|-------------|
| **Agency** | Player's choices matter | Multiple valid strategies, upgrade paths |
| **Mastery** | Getting better feels tangible | Skill expression, score improvement, visual evolution |
| **Surprise** | Unexpected moments of delight | Random events, hidden achievements, VIP customers |
| **Friction** | Barriers to fun (menus, loading, confusion) | Clear tutorial, instant restart, minimal UI |

If any numerator is 0, fun is 0. If friction is high, fun is low regardless.

---

## 11. Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | Better Alternative |
|-------------|-------------|-------------------|
| **Pay-to-win** | Destroys sense of mastery/fairness | Cosmetic-only purchases |
| **Artificial energy/lives** | Punishes engaged players | Unlimited plays, reward breaks instead |
| **Forced waiting** | Breaks flow, disrespects time | Rewarded patience (idle earnings) |
| **Random unfair deaths** | Violates sense of control | Deaths should always feel fair |
| **Information overload** | Cognitive overload → quit | Progressive disclosure |
| **Invisible progress** | No sense of advancement | Always show XP/progress bars |
| **Punishment without teaching** | Player doesn't learn from failure | Show WHY they failed, suggest improvement |

---

## 12. Game Theory Checklist for PRD

```
[ ] Is the core loop intrinsically fun (not just reward-chasing)?
[ ] Does difficulty stay in the flow channel?
[ ] Are there things for Achievers, Explorers, Socializers, and Killers?
[ ] Is cognitive load managed (4±1 active elements)?
[ ] Are mechanics introduced one at a time (progressive disclosure)?
[ ] Does the session end on a positive note (peak-end rule)?
[ ] Are rewards layered (micro + small + medium + large)?
[ ] Is loss aversion used ethically (combo protection, not punishment)?
[ ] Does the player know what to do without reading instructions?
[ ] Is there a "one more round" pull at every session boundary?
```
