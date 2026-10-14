---
name: game-context
description: >
  Decides whether the game being worked on is a Weekly Arcade game (lives in the weekly-arcade
  monorepo, listed in the registry and games json) or a standalone game (its own repo, own brand,
  own build and deploy). Single source of truth for which platform rules apply. Load it FIRST,
  before any game work, from every game-design agent, command and skill, and pass the result to
  every sub-agent you dispatch.
---

# Game Context: Weekly Arcade or standalone?

This plugin was written for Weekly Arcade (WA), but the same user also builds standalone games
in their own repos (Boat Jam, most Godot projects). Applying WA integration to a standalone game
is a real, repeated failure: adding a standalone game to a WA listing page, importing WA shared
packages into a game that has its own backend, or enforcing coin-shop rules on a game with its
own economy. This skill exists to stop that.

## Step 0: Game context

This skill is the game context check itself. Every other game-design agent, command and skill loads it first.

## When to run

Run it FIRST, before reading game code, planning, or dispatching any agent. Then state the
result in one line, exactly in one of these forms:

```
Context: Weekly Arcade game <slug>
Context: standalone game <name> at <path>
```

If a dispatching agent already passed a resolved context in your prompt (a line starting with
`Context:`), use it and do not re-resolve or re-ask, unless what you find on disk flatly
contradicts it (then stop and report the contradiction).

## Resolution order

Stop at the first step that gives a clear answer.

1. **Override file.** `.claude/game-context.json` at the repo root:
   ```json
   {"platform": "weekly-arcade", "game": "<slug>"}
   {"platform": "standalone", "game": "<name>"}
   ```
   If present and valid, it wins. If it is malformed, say so and continue to step 2.
2. **The user's words in this conversation.** "This is a WA game", "Boat Jam is standalone",
   "add it to Weekly Arcade" are decisive.
3. **Detection signals** (below). Use them only when they all point the same way.
4. **Ask.** If signals conflict or are absent, ask the user one question:
   "Is <game> a Weekly Arcade game or a standalone game?" Never guess.

After the user answers in step 4 (or states it in step 2), offer to write
`.claude/game-context.json` so the question is not asked again. Write it only with their consent.

## Detection signals

### Weekly Arcade (strong)

- The git remote URL or the repo directory name contains `weekly-arcade`.
- `apps/web-astro/src/data/games/` exists AND the game's slug has a json file there, or the slug
  has an entry in `GAME_REGISTRY` in `packages/shared`.

Being inside the WA monorepo is not, on its own, enough to call a game WA for listing purposes.
A game with no registry entry and no games json is a WA game only when the user is adding it
through `add-new-game` or the weekly release workflow. Otherwise ask.

### Standalone

- Its own repo with no WA monorepo structure (no `apps/web-astro`, no `packages/shared`).
- `project.godot`, a Unity project (`Assets/` plus `ProjectSettings/`), or its own `package.json`
  app at the repo root.
- Its own Capacitor app (`capacitor.config.*` with its own bundle id) outside the WA monorepo.
- The user says so.

A game's presence in personal memory, notes or past conversations is never evidence of WA
membership. The WA set comes only from the registry and the games json.

## What applies per mode

| Area | Weekly Arcade mode | Standalone mode |
|------|--------------------|-----------------|
| Game registry (`GAME_REGISTRY`, `packages/shared`) | Yes | No |
| Games json (`apps/web-astro/src/data/games/*.json`) | Yes | No |
| Landing, /games/ index, category, SEO and sitemap pages | Yes | No; the game's own site, if any |
| Shared `api-client.js` / `auth.js` / `gameCloud` | Yes | No; the game's own backend, if any |
| Leaderboards and server-side anti-cheat (`backend-contract`) | Yes | Only if the game has its own backend; apply the principles, not the WA contract |
| Coin award and coin shop rules | Yes | No, unless the user asks |
| WA achievements and AchievementCategory | Yes | No; the game's own achievements, if any |
| WA brand, copy rules, header and footer | Yes | No; the game's own brand |
| Build and deploy | WA pipeline (weekly release, Firebase, WA PRs) | The game's own build and deploy |
| Mobile shipping | Inside the WA Capacitor apps | Engine-native export (for example Godot's native iOS and Android export), or the game's own wrapper |
| Repo conventions | WA monorepo conventions | The game's own repo conventions |
| Generic design skills (balancing, level design, sound, accessibility, performance, playtesting, game-theory, environment art, Babylon / Phaser / Godot engine skills) | Yes | Yes |

## Rules

- Never add a standalone game to any WA listing, registry, games json, sitemap or landing page.
- Never import WA shared packages (`packages/shared`, `api-client.js`, `auth.js`, `gameCloud`)
  into a standalone repo.
- Never apply WA economy, coin-award or coin-shop rules to a standalone game unless the user asks.
- Never apply WA brand or copy rules to a standalone game.
- WA-only agents and commands must stop in standalone mode and tell the user they only work for
  Weekly Arcade games.
- Mixed agents and skills skip every step marked "(WA only)" in standalone mode.
- Orchestrators pass the resolved `Context:` line to every sub-agent in the dispatch prompt so
  sub-agents do not re-ask.
