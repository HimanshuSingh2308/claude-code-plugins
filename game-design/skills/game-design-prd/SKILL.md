---
name: game-design-prd
description: >
  Use this skill whenever the user wants to design a game, brainstorm game concepts, or create a
  detailed Product Requirements Document (PRD) for a game. Triggers include: requests to "design a game",
  "create a game concept", "write a game PRD", "help me build a game idea", "make a fun game about X",
  "game design document", or any prompt involving game mechanics, player engagement, scoring systems,
  leaderboards, or multiplayer features. Also triggers when the user says things like "I want to make a
  mobile game", "help me spec out a browser game", "design a casual game for X audience", or "I have a
  game idea and need to flesh it out". Use this skill even if the user only has a vague idea — part of
  the skill is helping them discover and refine the concept. Do NOT use for general game engine coding
  tasks, debugging existing games, or asset creation unless a design document is also being produced.
---

# Game Design PRD Skill

This skill helps create complete, actionable game design concepts and PRDs. It covers everything from
concept ideation to full specification — with a strong emphasis on player engagement, fun, replayability,
scoring systems, leaderboards, and optional multiplayer.

---

## Phase 1: Concept Discovery

If the user has a vague idea or just a theme/genre, help them crystallize it by exploring:

- **Core Fantasy**: What does the player *feel* like they're doing? (e.g., "I'm a wizard solving puzzles", "I'm racing against time", "I'm building an empire")
- **Player Motivation Loop**: Why does the player keep coming back? (progression, competition, creativity, social)
- **Session Length**: Casual (1–3 min), mid-core (5–15 min), or hardcore (30 min+)?
- **Platform**: Mobile, browser, desktop, console?
- **Target Audience**: Age range, gaming experience level, social context

Ask only what you need. If the user has given clear intent, skip to Phase 2 directly.

---

## Phase 2: Core Game Loop Design

Define the tight loop that runs every session:

```
ACTION → FEEDBACK → REWARD → NEXT ACTION
```

Document:
- **Primary Verb**: What does the player *do* most? (tap, match, build, aim, collect, navigate)
- **Immediate Feedback**: Visual, audio, haptic — what confirms the action?
- **Short Loop** (5–30 seconds): One round / one combo / one level segment
- **Medium Loop** (1–5 minutes): A full level / match / run
- **Long Loop** (days/weeks): Meta-progression — unlocks, rankings, story, collection

---

## Phase 3: Engagement & Retention Systems

Always include at least 3 of these proven engagement systems:

### Mandatory Sections
1. **Progression System** — How does the player get stronger/better? (XP, unlocks, skill trees, items)
2. **Variable Reward Schedule** — Unpredictable rewards (loot, rare drops, streaks) to drive dopamine
3. **Daily/Weekly Hooks** — Login bonuses, daily challenges, limited-time events
4. **Mastery Curve** — Difficulty ramps and skill expression moments (combo chains, perfect runs)

### Optional (include if fits the concept)
- Social proof (see friends' scores)
- FOMO mechanics (limited-time rewards)
- Narrative hooks (story drips, mysteries)
- Creative expression (player customization, base building)

---

## Phase 4: Scoring System Design

Every game needs a scoring philosophy. Choose and document:

### Scoring Archetypes
| Archetype | Best For | Example |
|-----------|----------|---------|
| **Time-based** | Action/speed games | Finish faster = higher score |
| **Accuracy-based** | Puzzle/aim games | More correct = higher score |
| **Combo/Multiplier** | Arcade games | Chain actions for x2, x3... multiplier |
| **Survival** | Roguelikes, endless runners | Survive longer = higher score |
| **Resource efficiency** | Strategy games | Accomplish goals with fewer moves/resources |
| **Hybrid** | Most modern games | Combine 2–3 above |

### Score Display Rules
- Show score **in real-time** during play (not just at end)
- Use **+points popups** on actions to reinforce behavior
- Show **personal best** comparison ("New Record!" / "3,000 behind your best")
- Post-game: Show breakdown (what earned the most points and why)

---

## Phase 5: Leaderboard Design

### Leaderboard Types to Specify
1. **Global All-Time** — Full ranking, updated real-time or daily
2. **Weekly Reset Board** — Resets every Monday; prizes for top N
3. **Friends Board** — Pull from social graph; most motivating for casual players
4. **Level/Mode-Specific** — Per-level bests (great for puzzle games)
5. **Seasonal** — Tied to a theme/event; creates urgency

### Anti-Frustration Rules
- Never show a leaderboard where the user is below rank 500 without context — show their rank + 5 above/below
- Include "Your Best" in every leaderboard view
- For new players, show a "Beginner" leaderboard for first 10 sessions

### Leaderboard Data Model (for PRD)
```
LeaderboardEntry {
  userId: string
  displayName: string
  avatarUrl: string
  score: number
  rank: number
  timestamp: datetime
  metadata: { level, mode, platform }
}
```

---

## Phase 6: Multiplayer Design (Optional but Encouraged)

If multiplayer makes sense, specify the type:

### Multiplayer Modes
| Type | Complexity | Best For |
|------|-----------|---------|
| **Async** (ghost/replay) | Low | Mobile, casual — compete vs recorded runs |
| **Turn-based** | Low-Medium | Puzzle, strategy — no real-time needed |
| **Real-time PvP** | High | Action games — needs server infra |
| **Co-op** | Medium | Social games — play together vs environment |
| **Battle Royale** | Very High | Mass competition — complex but high engagement |

### Async Multiplayer (recommended for MVP)
- Player beats a level → their run is saved as a "ghost"
- Other players race/compete vs the ghost
- No servers needed — ideal for indie/bootstrap

### Real-time Multiplayer (if chosen)
Specify:
- Max players per room
- Matchmaking logic (skill-based? random? friends-first?)
- Latency tolerance (< 100ms for action, < 500ms for casual)
- Fallback if opponent disconnects

---

## Phase 7: PRD Document Structure

When producing the final PRD, use this exact structure:

```markdown
# [Game Title] — Game Design PRD
**Version**: 1.0  
**Date**: [date]  
**Platform**: [platforms]  
**Genre**: [genre tags]

## 1. Executive Summary
One paragraph: what the game is, who it's for, why it's fun, what makes it unique.

## 2. Core Concept
- Core Fantasy
- Primary Mechanic
- Unique Selling Point (USP)

## 3. Target Audience
- Primary: [age, gaming level, platform habits]
- Secondary: [broader reach]

## 4. Core Game Loop
- Short Loop (diagram or step-by-step)
- Medium Loop
- Long Loop / Meta Progression

## 5. Gameplay Mechanics
- Controls / Inputs
- Core Rules
- Win/Lose Conditions
- Power-ups / Special Mechanics

## 6. Level & World Design
- Camera perspective (side-view, top-down, isometric)
- Zone layout diagram (action zone, upgrade zone, unlock zones)
- How zones unlock and evolve visually with progression
- NPC roles and positioning (player character, workers, customers, special NPCs)
- Customer/NPC pathfinding (spawn point → queue/destination → exit)
- Visual depth approach (layers, shadows, ambient elements)
- Mobile spatial budget (where things go in 480px)

## 7. Game Economy
- Currency types and their purpose
- Faucets: earning sources with rates per session
- Sinks: spending options with cost formulas
- Upgrade pricing formula (linear/polynomial/exponential)
- Revenue projection table: earnings vs costs by day/session
- Inflation control (diminishing returns, scaling costs)
- Key milestones: first upgrade, mid-game unlock, endgame

## 8. Scoring System
- Scoring formula / method
- Multipliers and combos
- Score display rules
- Post-game summary

## 9. Progression & Engagement Systems
- Leveling / XP
- Unlockables
- Daily/Weekly systems
- Retention hooks
- Player psychology: flow channel, cognitive load, reward cascading

## 10. Leaderboards
- Types and reset schedules
- Display logic
- Anti-frustration rules

## 11. Multiplayer (if applicable)
- Mode type
- Matchmaking
- Session flow
- Fallback behavior

## 12. Monetization (optional)
- Model: F2P / Premium / IAP
- What's monetized (cosmetics, boosts, levels)
- What's NEVER paywalled (core fun loop should always be free)

## 13. Art & Audio Direction
- Visual style (reference 2–3 games)
- Color palette with hex codes
- Audio feel (chiptune? ambient? hype?)
- Environmental storytelling (what the space communicates without words)

### UI Reference Research (Required)
Before designing the visual style, **always search for UI references** from similar games:
- **Game UI Database** (https://www.gameuidatabase.com/) — Browse 55,000+ screenshots from 1,300+ games. Filter by genre, element type (HUD, menu, inventory, settings), or game name. Use this to find real-world examples of how successful games handle menus, HUDs, scoreboards, game-over screens, and in-game UI.
- **Dribbble** (https://dribbble.com/tags/game-ui) — Designer community with game UI concepts
- **Behance** (https://www.behance.net/search/projects/game%20ui) — Professional game UI projects

**Workflow**: Search Game UI Database for the genre you're designing (e.g., "sports", "arcade", "puzzle"), screenshot 3-5 UI patterns you want to reference, and describe them in the PRD as visual targets. This prevents designing in a vacuum and ensures the game feels polished from day one.

## 14. Onboarding & First-Time Experience

The first 30 seconds determine whether a player stays or bounces. Design the onboarding
as carefully as the core loop.

### The "Aha Moment"
Every game has an "aha moment" — the instant the player *gets it* and feels the fun.
Design for that moment to happen within the first 15-30 seconds.

| Game Type | Aha Moment | When |
|-----------|-----------|------|
| Arcade (Snake) | "I ate the food and grew!" | 3 seconds |
| Puzzle (2048) | "Two tiles merged — I see the pattern" | 5 seconds |
| Tycoon (Tiny Tycoon) | "I tapped a customer and got coins!" | 5 seconds |
| Card (Solitaire) | "I moved a card to the foundation — progress!" | 10 seconds |

### Onboarding Principles

| Principle | Why | Implementation |
|-----------|-----|----------------|
| **Show, don't tell** | Players skip text walls | Highlight first interactive element, let them discover |
| **Progressive disclosure** | Reveal mechanics one at a time as needed | Level 1: move only. Level 2: introduce power-ups. Level 3: introduce enemies. |
| **Immediate success** | First action must feel rewarding | First tap = satisfying sound + visual feedback + points |
| **Safe failure** | Early mistakes should teach, not punish | First "death" shows tip, doesn't count against score |
| **Tutorial blindness** | Players WILL skip your tutorial modal | Design the game so it's playable WITHOUT reading anything |
| **Contextual hints** | Show controls when needed, not upfront | Arrow hint appears when player hasn't moved in 3 seconds |

### Onboarding Flow Template
```
1. Game loads → visual hook (animated scene, inviting color) — 0-2s
2. Single clear CTA ("Tap to start" / "Play") — 2-3s
3. First action guided by visual affordance (pulsing button, arrow) — 3-5s
4. Immediate reward for first action (sound + animation + score) — 5-8s
5. Second mechanic introduced organically — 10-20s
6. First "aha moment" — player understands the loop — 15-30s
7. First challenge / near-failure — player is invested — 30-60s
```

### Anti-Patterns
- **Modal tutorial walls** — "Here are 6 paragraphs explaining the game" → instant bounce
- **Forced practice rounds** — "Complete this tutorial to unlock the real game" → frustration
- **Too many controls at once** — Showing all buttons on first screen → cognitive overload
- **No feedback on first action** — Player taps, nothing visible happens → confusion

## 15. Technical Requirements
- Platform targets
- Recommended engine (Unity, Godot, Phaser, etc.)
- Backend needs (leaderboard API, matchmaking, auth)
- MVP scope vs full scope

## 16. MVP Feature List
Prioritized list: P0 (launch), P1 (week 2), P2 (month 2)

## 17. Success Metrics
- D1 / D7 / D30 retention targets
- Session length target
- Target score variance (good score spread across player skill levels)
```

---

## Phase 8: Output Format Rules

- **Always produce a full PRD** as the final output, even if the concept was generated by you
- Use tables for comparisons, bullet points for lists, code blocks for data models
- Include at least one **core loop diagram** (text-based flowchart is fine)
- Flag any design risks (e.g., "this mechanic may frustrate new players — consider a tutorial")
- End every PRD with a **"Fun Test" checklist** — 5 questions to ask during playtesting

---

## Fun Test Checklist (always append to PRD)

```
## Fun Test Checklist
Ask these during your first playtest session:

[ ] Did the player understand what to do within 30 seconds?
[ ] Did the player say "one more round" or attempt to replay immediately?
[ ] Was there a moment where the player felt clever or skilled?
[ ] Did the score feel fair — neither too easy nor frustrating?
[ ] Did the player ask "what happens if I try X?" (curiosity signal)
```

---

## Reference Files

- `references/game-genres.md` — Genre-specific design patterns and conventions
- `references/engagement-patterns.md` — Deep dive on retention loops, psychological hooks
- `references/tech-stack-options.md` — Engine/backend recommendations by platform and budget

## Related Agent

- **`product-designer`** — Agent that performs web research (competitors, trends, player psychology) before PRD creation. Use the agent for research-backed PRDs; use this skill directly for quick PRD drafting without web research.

## Related Skills (auto-applied)

- **`level-design`** — Zone layout, camera perspective, NPC pathfinding, spatial progression, environment evolution. Consult when designing the game world section of the PRD.
- **`game-theory`** — Flow theory, player psychology, cognitive load, motivation frameworks, peak-end rule. Consult when designing difficulty curves, reward systems, and engagement hooks.
- **`economy-design`** — Currency systems, upgrade pricing formulas, faucets/sinks, revenue projections, inflation control. Consult when designing the upgrade shop and economy section of the PRD.
- **`game-balancing`** — Difficulty curves, scoring formulas, XP progression, combo systems. Consult when tuning numbers.
- **`playtesting`** — Structured self-testing methodology, feel/pacing evaluation, iteration priorities. Consult when writing the Fun Test Checklist and success metrics.

---

Read the relevant reference file or related skill when the user's concept needs genre-specific
guidance, spatial design, economy balancing, or psychological framework application.
