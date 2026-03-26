---
name: game-trend-scout
description: >
  Use this skill whenever the user wants to discover trending game ideas, research what's popular
  in gaming right now, or evaluate which game concepts are worth building. Triggers include:
  "what games are trending", "find trending game topics", "what should I build a game about",
  "is this game idea competitive", "rank game ideas by feasibility", "what's popular in gaming",
  "find a game niche", "research game market", "scout for game trends on X", "what game concept
  has low competition", "validate my game idea", "should I build a game about X",
  "gaming trends 2025", "gaming trends 2026", or any request to scout, research, or rank game
  topics/niches. Also triggers when the user says "help me pick a game to build" or wants to
  find an opportunity in the gaming market. Always use this skill before suggesting game topics
  from memory alone — live search gives far better signal.
---

# Game Trend Scout

Researches live gaming trends and scores opportunities for browser/indie game development.
Produces a ranked report with scored candidates and deep dives on the top 3.

**Always read this entire skill before starting any searches.**

---

## When to use this skill

- User names a genre or theme: "scout space war games", "find trending puzzle ideas"
- User wants market validation: "is this game idea competitive?"
- User wants to pick what to build next
- User asks for "trending games" or "popular gaming keywords" without a specific topic
- Any time you would otherwise guess from training data — search instead

---

## 4-Pass Search Process

Run all 4 passes before scoring. Each pass has a different angle.

**IMPORTANT — Parallel execution**: All 4 passes are independent of each other. Launch all 4
WebSearch calls in a **single message with parallel tool calls**. Do NOT wait for Pass 1 to
finish before starting Pass 2. This reduces scout time by ~70%.

```
# Execute in ONE message with 4 parallel WebSearch tool calls:
Pass 1: "[topic] game trending [current year] browser"
Pass 2: "[topic] arcade casual game popular [year] indie Steam"
Pass 3: "[topic] game browser HTML5 [competitor genre keywords]"
Pass 4: "[related mechanic] browser HTML5 popular [year]"
```

After all 4 results return, proceed to scoring.

### Pass 1 — Demand & search volume
Query: `[topic] game trending [current year] browser`
- What search volumes exist?
- What games are people actually playing?
- Any breakout titles in the last 3–6 months?

### Pass 2 — Competition landscape
Query: `[topic] arcade casual game popular [year] indie Steam`
- What already exists on Steam, itch.io, browser?
- Are the existing titles download-only or browser-playable?
- What do reviews praise and criticise?

### Pass 3 — Browser gap analysis
Query: `[topic] game browser HTML5 [competitor genre keywords]`
- Is there a polished browser version with leaderboards?
- What's missing from the browser tier specifically?
- Who are the direct browser competitors?

### Pass 4 — Adjacent opportunity / mashup signal
Query: `[related mechanic] browser HTML5 popular [year]`
- What genre mashups are getting traction?
- Are there Vampire Survivors-style clones in this space?
- What's the "but roguelite" / "but survivors" version of this topic?

---

## Scoring Formula

Score each concept across 4 dimensions, each 1–10:

```
final_score = (Trend × 0.30) + (Competition × 0.30) + (Feasibility × 0.25) + (Monetization × 0.15)
```

**Trend (1–10):** Search volume growth, social buzz, recent breakout titles, YoY growth %
**Competition (1–10):** HIGH score = LOW competition (inverted). Browser niche empty = 9–10. Steam saturated = 2–3.
**Feasibility (1–10):** Can be built in 1–2 weeks in browser HTML/Canvas? 10 = yes easily. 1 = requires physics engine + months.
**Monetization (1–10):** Leaderboard stickiness, daily return rate potential, shareability

---

## Output Format

### Ranked Opportunity Table
```
| # | Concept | Trend | Comp | Feasibility | Monet | Score |
```

### Top 3 Deep Dives
For each of the top 3 scored concepts, write:

```
### [Rank] — [Concept Name] (Score: X.XX)

**Concept:** One paragraph describing the game mechanic clearly.

**Why it's trending:** 3–5 bullet points from search results, with specific data
(search volumes, review scores, player counts, YoY growth %).

**Browser gap:** What exists vs what's missing in the browser tier specifically.

**Core loop for Weekly Arcade:** Bullet list: controls, objective, scoring, leaderboard hook.

**Feasibility:** Plain language. "Canvas 2D, no libraries needed. Est. 5–7 days."

**Recommended platform:** Browser / Steam / Mobile
```

### Quick Picks
A table of 1–3 day build ideas that weren't in the top 3 but are fast to ship.

### Signals to Watch
Upcoming games, trends, or window-close risks the user should monitor.

### Recommendation
One clear recommendation: which concept to build this week and why. Include est. build time.

---

## Output File

Save the scout report to:
```
/Users/hsingh1/Documents/weekly-games/[topic]-scout-[month]-[year].md
```

Example: `space-war-scout-march-2026.md`

---

## Scoring Calibration

Use past scout reports as reference points:

| Score | Meaning | Past example |
|-------|---------|-------------|
| 8.0+ | Build immediately — rare opportunity | — |
| 7.5–7.9 | Strong — clear gap, proven demand | Auto-shooter space survivors (7.95) |
| 7.0–7.4 | Good — worth building with a twist | Asteroid roguelite (7.55), Galaga wave shooter (7.40) |
| 6.5–6.9 | Marginal — only if fast to build | — |
| <6.5 | Pass — too saturated or too niche | Space strategy / tower defence (6.25) |

---

## Weekly Arcade Context

Games are built for `weeklyarcade.games` — a browser-first arcade with weekly new releases.
Current library: Wordle, Snake, 2048, Chaos Kitchen, Memory Match, Lumble, Fieldstone, Voidbreak.
Library skews puzzle/strategy — action and arcade genres are underrepresented gaps.

**Ideal opportunity profile:**
- Playable in browser, no download
- Session length 3–10 minutes
- Leaderboard submittable (score + wave/level)
- Buildable in 5–7 days in HTML Canvas 2D
- Distinct from current library genres
