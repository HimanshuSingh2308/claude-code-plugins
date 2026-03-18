# Engagement & Retention Patterns

Deep-dive reference for designing player retention systems. Use this when designing the long loop
or when the user asks specifically about keeping players engaged.

---

## The Hook Model (applied to games)

Based on Nir Eyal's framework, adapted for game design:

1. **Trigger** → What brings the player back? (notification, habit, social pull, curiosity)
2. **Action** → Simplest behavior in anticipation of reward (open app → tap play)
3. **Variable Reward** → Unpredictable, exciting payoff (loot drop, perfect score, beat friend)
4. **Investment** → Player puts something in that makes future use better (progress, collection, skill)

Every strong game hits all 4. Design explicitly for each.

---

## Reward Schedules

### Fixed Ratio (predictable)
- Reward after every N actions
- Example: Every 5 levels → chest reward
- Use for: Milestone rewards, feel-good moments
- Risk: Players stop after getting reward ("scallop effect")

### Variable Ratio (unpredictable — most powerful)
- Reward after *average* N actions, but timing is random
- Example: Random rare item drops, loot boxes
- Use for: Core engagement loop, "one more run" feeling
- Warning: Don't overuse — can feel manipulative

### Fixed Interval (time-gated)
- Reward available after time passes (regardless of actions)
- Example: Daily login bonus, energy refill
- Use for: Daily active users metric, habit formation
- Risk: Players only log in for the reward, then leave

### Variable Interval (time + surprise)
- Random time between rewards
- Example: Mystery gift "sometime this week"
- Use for: FOMO events, surprise bonuses

**Best practice**: Use all 4 in combination. Variable ratio for core loop, fixed interval for daily habit.

---

## Progression Psychology

### Endowed Progress Effect
Start players at 20% progress rather than 0%.
- "You have 2/10 achievements already!" (even if those are trivial ones)
- Players more likely to complete a partially-filled card than an empty one

### Loss Aversion
Players work harder to avoid losing something than to gain the equivalent.
- Streak protection ("don't break your 7-day streak!")
- Lives system with regeneration
- Limited-time rewards that expire

### Sunk Cost (use carefully)
Players continue because of what they've already invested.
- Level-specific currency (can't be transferred)
- Character upgrades that took time to build
- Warning: Can feel manipulative — balance with genuine fun

### Social Comparison
Seeing others' scores is more motivating than absolute scores.
- "You're #47 out of your 120 friends"
- "Beat 73% of players today"
- Show nearby ranks on leaderboard, not just top 10

---

## Retention Benchmarks (mobile F2P games)

| Metric | Poor | Average | Good | Great |
|--------|------|---------|------|-------|
| D1 Retention | <20% | 25-35% | 40% | 50%+ |
| D7 Retention | <5% | 8-12% | 15% | 20%+ |
| D30 Retention | <2% | 3-5% | 7% | 10%+ |
| Session Length | <1 min | 3-5 min | 8-12 min | 15+ min |
| Sessions/Day | 1 | 2-3 | 4-5 | 6+ |

Use these to set PRD success metrics.

---

## Difficulty Curve Design

### Flow Channel
Players must stay between boredom and anxiety:
```
High |        /------ Anxiety (too hard)
     |      /
Skill| ----/ ← Flow Zone
     |   /
Low  | /______ Boredom (too easy)
     +----------→ Challenge
```

### Techniques to stay in flow:
- **Dynamic difficulty**: Subtly adjust based on performance (used in Mario Kart's rubber-banding)
- **Optional challenge**: Hard mode / bonus objectives for skilled players
- **Catch-up mechanics**: In multiplayer, give trailing player small boosts
- **Checkpoint system**: Don't punish too harshly — let players retry sections
- **Tutorial fade**: Gradually remove guidance as player demonstrates mastery

---

## Session Pacing Template

For a 5-minute session, pace it like this:

| Time | What Happens | Design Goal |
|------|-------------|-------------|
| 0:00–0:30 | Quick start, familiar mechanics | Minimize friction |
| 0:30–2:00 | Rising challenge, build combo | Enter flow state |
| 2:00–3:30 | Peak moment (boss, hard level, clutch play) | High emotion |
| 3:30–4:30 | Resolution + score reveal | Satisfaction |
| 4:30–5:00 | Hook for next session ("Try again?", new reward available) | Retention trigger |

---

## Social Mechanics

### Cooperative Social (low friction)
- Gift sending (extra lives, coins)
- Collaborative challenges (all friends contribute)
- Guild/clan events

### Competitive Social (high engagement)
- Friend leaderboards (updated live)
- Challenge a friend (share score → they try to beat it)
- Shared replay / ghost racing

### Spectator Social (low friction, high viral)
- Shareable score cards
- Replay export for TikTok/social
- Clip/highlight sharing after great runs
