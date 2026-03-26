---
name: post-launch
description: >
  Post-launch iteration framework for browser games. Covers analyzing player behavior,
  prioritizing improvements, structured feedback loops, A/B testing patterns, and
  deciding what to polish, what to add, and what to cut. Applied after a game is
  deployed when deciding "what should we improve next?"
---

# Post-Launch Iteration

**Arguments**: $ARGUMENTS

## Step 0: Check for Existing Post-Launch Plan

Before running the full analysis, check if a post-launch plan already exists for this game.

```
GAME_SLUG = first word of $ARGUMENTS (e.g., "tiny-tycoon")
PLAN_PATH = apps/web/src/games/{GAME_SLUG}/post-launch.md

IF file exists at PLAN_PATH:
  READ the file
  PARSE the patch list (## Patches section)

  pending = patches where status is "[ ]" (unchecked)
  completed = patches where status is "[x]" (checked)

  IF pending.length > 0:
    DISPLAY:
      "## Existing Post-Launch Plan Found"
      ""
      "**Game**: {GAME_SLUG}"
      "**Progress**: {completed.length}/{total} patches applied"
      ""
      "### Pending Patches (priority order):"
      {list pending patches with their scores}
      ""
      "### Completed Patches:"
      {list completed patches}
      ""
      "**Recommendation**: Apply the next pending patch before re-running full analysis."
      "To apply: describe which patch to implement, or say 'apply next' for the highest priority."
      "To re-run full analysis: say 'post-launch {GAME_SLUG} --fresh'"

    WAIT for user instruction:
      IF user says "apply next" or names a specific patch:
        IMPLEMENT the patch in the game code
        UPDATE post-launch.md: check off the patch as [x], add date
        RUN improvement checklist (Section 7)
        COMMIT changes
        STOP

      IF user says "--fresh" or "re-run":
        CONTINUE to full analysis (Step 1+)

  ELSE (all patches completed):
    DISPLAY:
      "## All Patches Applied!"
      "All {total} patches from the previous analysis have been implemented."
      "Running fresh analysis to identify new improvements..."

    CONTINUE to full analysis (Step 1+)

ELSE (no plan file exists):
  CONTINUE to full analysis (Step 1+)
```

---

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

---

## 9. Save Post-Launch Plan

After completing the full analysis, save the plan as a file inside the game folder
so subsequent runs can resume from where you left off.

**File**: `apps/web/src/games/{GAME_SLUG}/post-launch.md`

Also save a copy to: `~/Documents/weekly-games/{GAME_SLUG}-post-launch.md`

### File Format

```markdown
# Post-Launch Plan: {GAME_NAME}

**Created**: {date}
**Last Updated**: {date}
**Status**: {IN_PROGRESS | ALL_APPLIED | MONITORING}

---

## Funnel Assessment

{Copy of the improvement funnel findings from the analysis}

---

## Patches

Ordered by improvement matrix score (highest first).
Check off each patch as it's applied.

### Week 1 — Fix & Clarify

- [ ] **#{n} {title}** (Score: {score}) — {one-line description}
  - Category: {BROKEN | CONFUSING | UNFUN}
  - Files: {likely files to modify}
  - Applied: {date or blank}

- [ ] **#{n} {title}** (Score: {score}) — {one-line description}
  ...

### Week 2 — Polish & Feel

- [ ] **#{n} {title}** (Score: {score}) — {one-line description}
  ...

### Week 3+ — Depth & Content

- [ ] **#{n} {title}** (Score: {score}) — {one-line description}
  ...

---

## Metrics Baseline

| Metric | Value at Analysis | Target |
|--------|-------------------|--------|
| ... | ... | ... |

---

## Cut Candidates

| Element | Verdict | Notes |
|---------|---------|-------|
| ... | ... | ... |

---

## Health Check Log

| Date | Signal | Action Taken |
|------|--------|-------------|
| {date} | Initial analysis | Plan created |
| ... | ... | ... |
```

### After Saving

1. Display the plan summary to the user
2. Recommend starting with the highest-scored pending patch
3. Remind: "Run `/post-launch {GAME_SLUG}` again to apply the next patch"
