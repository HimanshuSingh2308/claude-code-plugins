---
name: post-launch
description: >
  Post-launch iteration framework for browser games. Covers analyzing player behavior,
  prioritizing improvements, structured feedback loops, A/B testing patterns, and
  deciding what to polish, what to add, and what to cut. Applied after a game is
  deployed when deciding "what should we improve next?"
---

# Post-Launch Iteration

## Core Principle: Ship → Observe → Improve → Repeat

No game is perfect at launch. The best games are the ones that iterate quickly based on real player behavior.

---

## 1. The Improvement Funnel

After launch, improvements fall into five categories. Work top-to-bottom:

```
1. BROKEN → Fix bugs that block gameplay
     ↓
2. CONFUSING → Fix UX that players don't understand
     ↓
3. UNFUN → Fix mechanics that feel bad
     ↓
4. MISSING → Add features players expect
     ↓
5. POLISH → Add delight that makes it special
```

**Rule**: Never polish (5) if something is broken (1) or confusing (2).

---

## 2. Signal Detection

### What to Look For

| Signal | Where to Find It | What It Means |
|--------|------------------|---------------|
| Players quit early (Day 1-2) | Leaderboard data (low scores only) | Onboarding problem or not fun enough |
| Players hit a wall (Day 5-8) | Score clustering at specific point | Difficulty spike or economy imbalance |
| Everyone buys same upgrade first | Score metadata (upgradeLevels) | One upgrade is clearly dominant |
| Nobody buys a specific upgrade | Score metadata | Upgrade is overpriced or unclear |
| Top scores are impossibly high | Leaderboard | Exploit or missing server validation |
| Very few scores submitted | Auth + leaderboard | Sign-in friction or submission bug |
| Scores are all similar | Leaderboard distribution | Not enough skill expression |
| Wide score variance | Leaderboard distribution | Good — indicates skill matters |

### Gathering Feedback

| Source | Quality | Effort |
|--------|---------|--------|
| **Play it yourself** | High (you feel the friction) | Low |
| **Watch someone play** | Very high (see confusion) | Medium |
| **Score/metadata analysis** | Quantitative, objective | Low |
| **Direct user feedback** | Mixed (often "add X" not "fix Y") | Medium |
| **GitHub issues** | Specific, actionable | Low |
| **Social media mentions** | Honest reactions | Low |

---

## 3. The Improvement Matrix

For each potential improvement, score it:

| Factor | Score 1-5 | Weight |
|--------|-----------|--------|
| **Player impact** | How many players affected? | 3x |
| **Fun impact** | How much more fun? | 2x |
| **Build effort** | How hard to implement? (invert: 5=easy) | 1x |
| **Risk** | Could it break something? (invert: 5=safe) | 1x |

**Total = (Impact×3) + (Fun×2) + (Effort×1) + (Risk×1)**

Example:
| Improvement | Impact | Fun | Effort | Risk | Score |
|-------------|--------|-----|--------|------|-------|
| Fix scoring bug | 5 | 3 | 4 | 5 | 30 |
| Add walking animation | 3 | 4 | 5 | 5 | 27 |
| VIP lounge visual area | 4 | 5 | 2 | 3 | 27 |
| Daily streak system | 3 | 3 | 2 | 4 | 21 |

Work in score order.

---

## 4. Common Post-Launch Improvements

### Week 1: Fix & Clarify

| Category | Typical Fixes |
|----------|--------------|
| **Bugs** | Score not submitting, layout broken on X device, sound not playing |
| **UX clarity** | Add tutorial, improve button labels, fix confusing icon |
| **Balance** | Adjust difficulty curve, fix overpriced upgrade, tune spawn rates |
| **Missing feedback** | Add "+coins" float, combo indicator, serve progress |

### Week 2: Polish & Feel

| Category | Typical Improvements |
|----------|---------------------|
| **Visual juice** | Particles, animations, screen shake, celebrations |
| **Sound** | Missing sound effects, background ambiance, better timing |
| **Environment** | Visual depth, ambient elements, lighting, shadows |
| **Character** | Walking animation, expressions, accessories |

### Week 3+: Depth & Content

| Category | Typical Additions |
|----------|------------------|
| **New mechanics** | New customer type, new drink, special event |
| **Visual evolution** | Shop changes with upgrades, unlock zones |
| **Social** | Leaderboard improvements, shareable scores |
| **Retention** | Daily challenges, streak bonuses, seasonal events |

---

## 5. A/B Testing (Simple Version)

For browser games, true A/B testing is complex. Instead, use **sequential testing**:

1. **Baseline**: Measure key metric for 3-7 days (e.g., average Day reached)
2. **Change**: Deploy improvement
3. **Measure**: Measure same metric for 3-7 days
4. **Compare**: Did it improve?

### Key Metrics to Track

| Metric | How to Measure | Good Direction |
|--------|---------------|----------------|
| Session count per player | Leaderboard entries per userId | More sessions = better |
| Highest day reached | `level` field in score submissions | Higher = better retention |
| Score distribution | Leaderboard score range | Wider = more skill expression |
| Score submission rate | Submissions vs page loads | Higher = better engagement |

---

## 6. What to Cut

Sometimes the best improvement is REMOVING something:

### Cut Signals

| Signal | Action |
|--------|--------|
| Feature that nobody uses | Remove or make more visible (test visibility first) |
| Mechanic that frustrates without adding fun | Remove or make optional |
| UI element that confuses | Remove or relocate |
| Sound that annoys | Remove or make quieter |
| Tutorial step that everyone skips | Remove |

### The "Would Anyone Notice?" Test

Before removing something, ask: "If I deleted this, would any player notice within 5 minutes of play?"

If no → safe to cut.

---

## 7. Improvement Checklist

After each post-launch iteration:

```
[ ] All critical bugs fixed first
[ ] Changes tested on mobile (375px) and desktop
[ ] Score submission still works
[ ] Achievements still trigger correctly
[ ] localStorage save/load still works
[ ] No new console errors
[ ] Visual QA via `game-visual-tester` agent — screenshots before/after on desktop + mobile
[ ] Change committed with descriptive message
[ ] Deployed and verified on production
```

---

## 8. Long-Term Health Signals

For games that stay in the arcade long-term:

| Timeframe | Healthy Signal | Unhealthy Signal |
|-----------|---------------|------------------|
| **Week 1** | Scores being submitted daily | Zero submissions after day 1 |
| **Week 2** | Multiple players reaching Day 10+ | All scores are Day 1-3 |
| **Month 1** | Returning players (same userId, improving scores) | Only new players, no returns |
| **Month 3** | Consistent daily submissions | Zero activity for weeks |

If a game goes quiet, consider:
1. Featuring it on the landing page again
2. Adding a new mechanic or event
3. Creating a "challenge of the week" variant
4. Retiring it gracefully (archive, don't delete)
