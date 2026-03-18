# Game Genre Design Patterns

Reference this file when the user's concept maps to a known genre. Use these patterns as defaults
and customize for the specific concept.

---

## Puzzle Games
- **Core loop**: Present problem → Player solves → Reveal solution elegance → Next problem
- **Scoring**: Stars (1–3), move count efficiency, time bonus
- **Retention**: 500+ levels common; use world/chapter groupings to create narrative progress
- **Multiplayer**: Async head-to-head (same puzzle, compare solutions)
- **Engagement risk**: Difficulty spikes — use a gentle curve with optional hard mode
- **Examples**: Monument Valley, Candy Crush, The Room

## Endless Runner / Arcade
- **Core loop**: Run → Avoid obstacle → Collect → Die → Beat your score
- **Scoring**: Distance + collectibles + multiplier combos
- **Retention**: Character unlocks, seasonal skins, daily challenges
- **Multiplayer**: Ghost races (async) work extremely well
- **Engagement risk**: Becomes stale fast — add biome variety and event modes
- **Examples**: Temple Run, Subway Surfers, Alto's Adventure

## Platformer
- **Core loop**: Explore level → Master movement → Reach goal → Unlock next
- **Scoring**: Speed runs, collectible %, deaths count
- **Retention**: Hidden secrets, achievement hunting, challenge modes
- **Multiplayer**: Co-op or race modes; speedrun leaderboards per level
- **Engagement risk**: Precision controls on mobile are hard — plan touch scheme carefully
- **Examples**: Celeste, Super Mario Run, Hollow Knight

## Tower Defense / Strategy
- **Core loop**: Plan → Place units → Watch wave → Adjust → Survive → Upgrade
- **Scoring**: Stars/medals per level, speed clear bonus
- **Retention**: Tower upgrade trees, new map types, endless mode
- **Multiplayer**: Co-op (shared base) or PvP (send enemies at opponent)
- **Engagement risk**: New players overwhelmed — tutorial waves essential
- **Examples**: Bloons TD, Kingdom Rush, Plants vs Zombies

## Roguelike / Roguelite
- **Core loop**: Start fresh → Build synergies → Push deeper → Die → Unlock permanent upgrades
- **Scoring**: Depth reached + enemies killed + build rating
- **Retention**: Meta-progression unlocks between runs (huge for retention)
- **Multiplayer**: Co-op runs or async score comparison
- **Engagement risk**: Early runs feel weak — give impactful starting unlock immediately
- **Examples**: Hades, Slay the Spire, Vampire Survivors

## Idle / Clicker
- **Core loop**: Click → Earn → Buy upgrade → Earn more passively → Return for multiplier
- **Scoring**: Total earned, prestige count, milestone achievements
- **Retention**: Prestige resets with permanent bonuses; season events
- **Multiplayer**: Guild events, contribution leaderboards
- **Engagement risk**: Loses players in "dead zones" where progress feels slow — add mini-events
- **Examples**: Cookie Clicker, AdVenture Capitalist, Merge Mansion

## Battle Royale / PvP Action
- **Core loop**: Enter match → Gather resources → Engage players → Survive → Win
- **Scoring**: Kills, placement, damage dealt
- **Retention**: Season pass, ranked tiers, battle pass cosmetics
- **Multiplayer**: Core feature — requires robust matchmaking and anti-cheat
- **Engagement risk**: Extremely complex to build; recommend scoping to 10-player max for MVP
- **Examples**: Fortnite, PUBG, Fall Guys

## Card / Deck Builder
- **Core loop**: Draw hand → Play cards → Defeat encounter → Acquire new cards → Build synergies
- **Scoring**: Win streak, deck efficiency rating, speed clear
- **Retention**: Huge card collection, daily challenges, ranked mode
- **Multiplayer**: PvP deck battles or co-op challenges
- **Engagement risk**: Overwhelming for new players — start with limited card pool
- **Examples**: Hearthstone, Balatro, Legends of Runeterra

## Match-3 / Casual Puzzle
- **Core loop**: Swap tiles → Match 3+ → Chain combos → Clear goal → Next level
- **Scoring**: Score based on combos, special tile activations, moves remaining
- **Retention**: 1000+ levels, lives system, event levels
- **Multiplayer**: Async tournaments (same level, compare score)
- **Engagement risk**: Lives/energy systems can frustrate — balance generosity carefully
- **Examples**: Candy Crush, Bejeweled, Royal Match

## Simulation / Builder
- **Core loop**: Place object → See effect → Optimize → Expand → Reach milestone
- **Scoring**: Efficiency rating, population/income, happiness metrics
- **Retention**: Endless mode, scenarios, sandbox unlocks
- **Multiplayer**: Co-op city building, trade between player cities
- **Engagement risk**: Analysis paralysis in complex sims — provide guided goals
- **Examples**: SimCity, Stardew Valley, Two Point Hospital
