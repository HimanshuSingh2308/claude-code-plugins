---
name: playtesting
description: >
  Structured playtesting framework for browser games. Covers self-testing methodology,
  what to observe, how to measure feel/pacing/fun, iteration cycles, and how to
  prioritize improvements. Applied after building a game to evaluate quality before
  release, and after release to guide iteration.
---

# Playtesting Framework

## Core Principle: Play Your Own Game Like a Stranger

The hardest part of playtesting is forgetting what you know. You built it, so you know every mechanic. A real player doesn't. Test with fresh eyes.

---

## 1. The Three-Pass Test

Every game should be playtested in three distinct passes:

### Pass 1: First-Touch Test (Pretend you've never seen this game)

**Goal**: Can a new player figure out what to do?

**What to check**:
- [ ] Is the first action obvious within 10 seconds?
- [ ] Does the game communicate its rules WITHOUT text instructions?
- [ ] Is the first reward within 30 seconds of starting?
- [ ] Does the player know when they've succeeded or failed?
- [ ] Is there anything confusing in the first 60 seconds?

**How to test**: Clear all localStorage, open the game fresh. Pretend you're seeing it for the first time. Note EVERY moment of confusion.

**Red flags**:
- Staring at the screen not knowing what to tap
- Tapping the wrong thing and nothing happens
- No feedback after an action
- Death/failure before understanding the rules

### Pass 2: Flow Test (Play 5-10 sessions normally)

**Goal**: Does the game maintain engagement across multiple sessions?

**What to check**:
- [ ] Is Day/Round 1 too easy or boring? (Should be simple but not trivial)
- [ ] When does difficulty first feel challenging? (Should be within 3-5 sessions)
- [ ] Is there a "one more round" pull at session end?
- [ ] Does the upgrade shop feel motivating? (Clear next purchase goal)
- [ ] Are there "dead zones" where nothing interesting happens?
- [ ] Does the combo/streak system feel fair? (Not too fragile, not too easy)
- [ ] Is the scoring understandable? (Do you know what earns more points?)

**Metrics to note**:
| Metric | Target | Actual |
|--------|--------|--------|
| Time to understand core loop | < 30s | |
| Time to first upgrade purchase | 2-5 min | |
| Sessions before boredom | > 10 | |
| Score variance across sessions | 20-50% | |
| "Almost!" moments per session | 1-3 | |

### Pass 3: Edge Case / Stress Test

**Goal**: Does the game break under unusual conditions?

**What to check**:
- [ ] What happens if you do nothing? (Let timer run with no taps)
- [ ] What happens at maximum everything? (All upgrades, max level)
- [ ] What happens on the very first play? (No upgrades, no experience)
- [ ] Rapid tapping — does anything break?
- [ ] Tab away and back — does the game handle it?
- [ ] Resize the window during gameplay
- [ ] Turn off sound — is the game still playable?
- [ ] Play on the slowest supported device/viewport (320px wide)

---

## 2. The Feel Checklist

Game "feel" is hard to measure but critical to fun. Check each:

### Responsiveness
- [ ] Tap → visual response in < 100ms (no perceptible delay)
- [ ] No input lag during busy moments (many customers/enemies)
- [ ] Touch targets are easy to hit (no mis-taps)
- [ ] No accidental scrolling or zooming

### Feedback Quality
- [ ] Every action has visual feedback (animation, color change, particle)
- [ ] Every action has audio feedback (even if subtle)
- [ ] Success feels GOOD (multiple signals: visual + audio + score)
- [ ] Failure feels FAIR (player understands why)
- [ ] Score increases are visible and celebratory

### Pacing
- [ ] No long periods of doing nothing
- [ ] No overwhelming moments that last too long
- [ ] Tension builds and releases rhythmically
- [ ] Session end comes at a satisfying moment, not mid-action

### Satisfaction
- [ ] There's a moment each session where you feel clever/skilled
- [ ] Upgrades make a noticeable gameplay difference
- [ ] High scores feel earned, not lucky
- [ ] "Close calls" happen naturally (almost failed but didn't)

---

## 3. Observation Protocol

When someone else plays your game (or you record yourself):

### What to Watch For

| Observation | What It Means | Action |
|-------------|--------------|--------|
| Player pauses, looks confused | Unclear what to do | Add hint, visual cue, or tutorial |
| Player taps wrong thing | Misleading visual hierarchy | Make correct target more prominent |
| Player ignores a feature | Feature is invisible or unclear | Make it more visible or remove it |
| Player retries immediately | Good sign — they want to do better | Core loop is working |
| Player checks phone/looks away | Bored — nothing interesting happening | Add events, increase pace |
| Player says "that's unfair!" | Perceived unfairness | Review that mechanic for fairness |
| Player smiles/laughs | Delight moment — preserve this! | Don't touch whatever caused it |
| Player leans forward | Deep engagement — flow state | Note what they're doing |

### Questions to Ask After

1. "What were you trying to do?" (tests clarity)
2. "What was the best moment?" (find the peak)
3. "What was frustrating?" (find friction)
4. "Would you play again? Why/why not?" (tests retention)
5. "What would you change?" (player intuition, take with grain of salt)

---

## 4. Measurement Framework

### Quantitative Metrics (Track with code)

```javascript
// Add to game for tracking
const METRICS = {
  sessionStart: Date.now(),
  tapsTotal: 0,
  tapsSuccessful: 0,  // hit the right thing
  tapsMissed: 0,       // hit nothing
  timeToFirstAction: 0, // ms from game start to first tap
  timeToFirstReward: 0, // ms from game start to first score
  peakCombo: 0,
  comboBreaks: 0,
  customersServed: 0,
  customersLost: 0,
  dayRevenue: 0,
  upgradesPurchased: 0,
  sessionDuration: 0,
  replayed: false,      // did they click "play again"?
};

// Log at session end
console.log('SESSION METRICS:', JSON.stringify(METRICS));
```

### Qualitative Metrics (Observe and note)

| Aspect | Score 1-5 | Notes |
|--------|-----------|-------|
| Clarity | | Could the player figure out what to do? |
| Fun | | Did they smile, laugh, or show excitement? |
| Fairness | | Did failures feel deserved? |
| Pacing | | Were there boring or overwhelming moments? |
| Polish | | Did anything look janky or broken? |
| Retention | | Did they want to play again? |

---

## 5. Iteration Prioritization

After playtesting, you'll have a list of issues. Prioritize them:

### The Impact/Effort Matrix

```
High Impact ┌──────────────────────┐
            │  DO FIRST  │ PLAN   │
            │  (quick    │ (big   │
            │   wins)    │  but   │
            │            │ worth  │
            ├────────────┤ it)    │
            │  SKIP      │ MAYBE  │
            │  (not      │ (only  │
            │   worth    │ if     │
            │   effort)  │ time)  │
Low Impact  └──────────────────────┘
            Low Effort   High Effort
```

### Priority Categories

| Priority | Criteria | Examples |
|----------|----------|---------|
| **P0 — Fix Now** | Blocks gameplay, crashes, unfair | Game-breaking bugs, scoring errors, impossible levels |
| **P1 — Fix Before Release** | Noticeably hurts experience | Missing feedback, confusing UI, bad pacing |
| **P2 — Fix Soon** | Improves quality but game works without | Visual polish, better animations, sound tweaks |
| **P3 — Nice to Have** | Enhancement, not a fix | Extra features, cosmetic options, additional content |

### The "One Change" Rule

After each playtest, make ONE significant change, then re-test. Multiple changes at once make it impossible to know what helped.

---

## 6. Common Issues & Solutions

| Symptom | Likely Cause | Quick Fix |
|---------|-------------|-----------|
| "I don't know what to do" | No onboarding | Add tutorial overlay, highlight first action |
| "Too easy / boring" | Difficulty too low | Speed up spawns, reduce patience timers |
| "Too hard / unfair" | Difficulty too high or feels random | Slow spawns, increase patience, add visual warning |
| "I don't know what I earned" | Poor score feedback | Add floating "+$X" text, score breakdown at end |
| "Nothing to do between rounds" | Dead upgrade screen | Add mini-preview, tease next unlock, show progress |
| "Can't tell what's different after upgrade" | Upgrade effect invisible | Visual change in game world, stat comparison |
| "Combo broke and I don't know why" | Missing failure feedback | Flash "COMBO LOST!", show which customer caused it |
| "The game looks flat/boring" | No visual depth | Add shadows, gradients, ambient particles, 3D edges |
| "It feels laggy" | Too many DOM elements or reflows | Profile, reduce DOM ops in game loop, use transforms |

---

## 7. Pre-Release Checklist

```
## Gameplay
[ ] Core loop is fun without upgrades (Day 1 is enjoyable)
[ ] Difficulty ramps smoothly (no spikes, no dead zones)
[ ] Scoring feels fair and understandable
[ ] All upgrades have noticeable effect
[ ] Session end pulls for "one more round"

## Visual
[ ] No overlapping/clipped elements on 375px width
[ ] No layout breaks on 1280px width
[ ] All text is readable (contrast, size)
[ ] Animations are smooth (no jank, no stutter)
[ ] Game looks polished (not prototype-y)

## Audio
[ ] Sound toggle works and persists
[ ] No audio plays before user interaction
[ ] Sounds match actions (not annoying, not missing)

## Technical
[ ] No console errors during normal play
[ ] Game handles tab blur/focus correctly
[ ] localStorage save/load works across refreshes
[ ] Score submission works when signed in
[ ] Game loads in < 2 seconds

## Mobile
[ ] All touch targets >= 44px
[ ] No accidental scroll/zoom
[ ] Works on iPhone SE (375px) and Android (360px)
[ ] Safe areas respected (notch, home indicator)

## Accessibility
[ ] prefers-reduced-motion disables animations
[ ] Game is playable with sound off
[ ] Color is not the ONLY indicator of state
```

---

## 8. Post-Launch Iteration

After players start using the game:

### What to Monitor

1. **Session count per player** — Are people coming back?
2. **Day/level reached** — Where do people stop?
3. **Score distribution** — Is there healthy spread or everyone clumps?
4. **Upgrade purchase order** — What do players buy first?
5. **Achievement unlock rate** — Which are too easy/hard?

### Iteration Signals

| Signal | Meaning | Action |
|--------|---------|--------|
| Most players stop at Day 3 | Early difficulty spike or boredom | Tune Day 3-5 difficulty/rewards |
| Nobody buys Upgrade X | Too expensive or unclear benefit | Lower cost or make effect more visible |
| Everyone has same score | Not enough skill expression | Add combo depth, bonus mechanics |
| Top score is impossibly high | Cheating or exploit | Check server validation, add anti-cheat |
| Players skip tutorial | Tutorial is annoying or too long | Shorten to 1 screen, auto-dismiss faster |
