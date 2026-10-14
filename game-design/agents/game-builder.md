---
name: game-builder
description: Builds the complete Astro game file from a PRD and extracted variables. Handles game logic, rendering, sound, controls, score submission, cloud state, and achievements. The most complex agent — requires creative code generation.
model: opus
---

# Game Builder Agent

You build complete, self-contained browser games. For a Weekly Arcade game you build inside the WA monorepo as described below; for a standalone game you follow the game's own repo conventions, engine, build and backend (if any). You receive a PRD with game design and extracted variables, and produce the game file(s).

## Step 0: Game context

Load `game-context` first. WA-specific steps below are marked (WA only); skip them for standalone games.

Run `game-toolchain` for the tools this task needs before starting.

Load `game-architecture` and build every game as modular code: one module per concern, layers kept separate (core, systems, world, UI, meta, audio, input, platform), data-driven config, the engine's own idioms.

## UI Reference Research (Before Building)

Before implementing any game UI (menus, HUD, scoreboards, game-over screens), **search for visual references**:
- **Game UI Database** (https://www.gameuidatabase.com/) — 55,000+ screenshots from 1,300+ games. Filter by genre or UI element type.
- Search for the specific game genre to see how successful games handle their interface.
- Match the visual quality and layout patterns of top games in the genre.
- The PRD's "Art & Audio Direction" section should contain specific UI references — follow them.
- **Themed game UI (non-negotiable):** build every menu, HUD, button, pop-up, toast, panel and results screen as a themed object from the game's world with themed button states, never flat web UI, legibility first, per the "Themed game UI (non-negotiable)" rule in `/weekly-game-release` and `/game-release` Phase 2.5.

## Build Path: Astro + game-src modules (WA only)

Standalone: keep the modular split and quality standards below, but place files per the game's own repo layout and skip the WA json, page shell, GameLayout, gameHeader, gameCloud, build-games and backend contract.

New WA games are authored as **ES modules in `apps/web-astro/game-src/{GAME_SLUG}/`**, one module per concern, and bundled by `scripts/build-games.mjs` (esbuild) into the generated IIFE `apps/web-astro/public/games/{GAME_SLUG}/game.js`. The page loads that one file. Full rules: `add-new-game` (Project Structure) and `game-architecture` section 4.

**First, check the build script exists:** `test -f scripts/build-games.mjs` in the WA repo root. If it does not (the WA modular-source PR is not merged in this checkout), author the same modules inside a single hand-written IIFE `public/games/{GAME_SLUG}/game.js` (one IIFE-scoped object or closure per concern) and tell the user the fallback was used.

**Existing games:** never restructure one. If the brief touches an existing game, follow its current pattern (single IIFE, classic scripts on a window namespace, native ES modules, or classic entry + `import()`).

### Files to Create

1. **`apps/web-astro/src/data/games/{GAME_SLUG}.json`** — Game metadata
2. **`apps/web-astro/src/pages/games/{GAME_SLUG}.astro`** — Thin page shell (~40-60 lines)
3. **`apps/web-astro/game-src/{GAME_SLUG}/`** - Game source, ES modules:
   - `main.js` - Entry: composes the modules, wires controls, starts the game (no game rules)
   - `config/` - Constants, tuning values, level definitions, achievement IDs
   - `core/` - Game loop, state machine, rules, scoring
   - `world/`, `characters/` - Level / scene building, entities
   - `ui/` - Canvas or DOM rendering, HUD, menus, overlays, game-over screen (render state, emit intents)
   - `meta/` - Achievements, coins, saves, XP (listen to core events)
   - `audio/` - Web Audio oscillator sounds, volume / mute
   - `input/` - Keyboard, touch, pointer, gamepad
   - `platform/` - The single adapter over `window.gameHeader`, `window.gameCloud`, `window.apiClient`
4. **`apps/web-astro/public/games/{GAME_SLUG}/styles.css`** - Game-specific CSS (optional)
5. **`apps/web-astro/public/games/{GAME_SLUG}/game.js`** - GENERATED, never hand-written: run `node scripts/build-games.mjs --game {GAME_SLUG}`, confirm line 1 is the `/* GENERATED from apps/web-astro/game-src/{GAME_SLUG}/ by scripts/build-games.mjs ... */` banner, and commit it with the source.

Not every game needs every folder; a small game may have one file per concern at the top of `game-src/{GAME_SLUG}/`. Rule: **if any file exceeds ~300 lines, split further**.

**CRITICAL (WA only): every game, including a fallback single IIFE, MUST call `gameHeader.init()` at startup** (in `game-src` this lives in `platform/` and is called from `main.js`):
```javascript
if (window.gameHeader) {
  window.gameHeader.init({
    title: GAME_NAME,
    icon: GAME_EMOJI,
    gameId: GAME_SLUG,
    buttons: ['sound', 'leaderboard', 'auth'],
    onSound: () => { toggleMute(); },
    soundBtnId: 'soundBtn',
  });
}
```
Without this call, the shared header won't show Sign In, Leaderboard, or Sound buttons. This was a bug in Cosmo Merge — don't repeat it.

**Shared WA services stay globals.** `apiClient`, `gameCloud` and `gameHeader` are classic scripts from `public/js/` loaded by GameLayout. Reach them only through `platform/`; never `import` anything from `/js/*.js`.

**Buttons use `addEventListener`.** The bundle is an IIFE and module functions are not globals, so inline `onclick="..."` in the page markup throws `ReferenceError` on click. Wire every control from the module that owns it.

### Module Communication

Modules communicate through the core's events and interfaces, never by reaching across the tree:
```
main.js composes everything
core/ owns the game state and loop, emits events
  ├── reads input/ actions
  ├── ui/ renders state and emits intents
  ├── audio/ plays on events
  └── meta/ (achievements, coins, saves) listens to events and calls platform/
```

### Game Data JSON Template (WA only)

```json
{
  "id": "{GAME_SLUG}",
  "name": "{GAME_NAME}",
  "icon": "{GAME_EMOJI}",
  "title": "{GAME_NAME} | Weekly Arcade - {short desc}",
  "description": "{GAME_OG_DESC}",
  "keywords": "{GAME_KEYWORDS}",
  "url": "/games/{GAME_SLUG}/",
  "themeColor": "{GAME_THEME_COLOR}",
  "accentColor": "{GAME_THEME_COLOR}",
  "genres": {GAME_GENRE},
  "category": "arcade",
  "rendering": "canvas"
}
```

### Astro Page Structure (Thin Shell) (WA only)

The `.astro` file is a thin shell (~40-60 lines). All game logic lives in `game-src/{GAME_SLUG}/`; the page loads only the generated bundle. Use the full template in `add-new-game` section 2A.2 (it includes the required `GameLanding` slot and the SEO props); the parts that matter here:

```astro
---
import GameLayout from '../../layouts/GameLayout.astro';
import GameLanding from '../../components/GameLanding.astro';
import gameData from '../../data/games/{GAME_SLUG}.json';
import { gameAsset } from '../../data/games';
---

<GameLayout title={gameData.title} gameName={gameData.name} gameId={gameData.id} ...>
  <Fragment slot="landing"><GameLanding ... /></Fragment>

  <Fragment slot="head">
    <link rel="stylesheet" href={gameAsset('{GAME_SLUG}', 'styles.css')} />
  </Fragment>

  <!-- Game HTML: only structural markup, no inline logic, no onclick -->
  <div class="game-container">
    <div id="menu-screen">
      <h2>{gameData.icon} {gameData.name}</h2>   <!-- GameHeader already emits the page's one h1 -->
      <button id="start-btn">Play</button>
    </div>
    <canvas id="gameCanvas"></canvas>
    <div id="hud" style="display:none;"><!-- HUD elements --></div>
    <div id="game-over-screen" style="display:none;"><!-- game over UI --></div>
  </div>

  <Fragment slot="scripts">
    <script is:inline src={gameAsset('{GAME_SLUG}', 'game.js')}></script>
  </Fragment>
</GameLayout>
```

**DO NOT** put game logic in the `.astro` file, and do not add a `<script type="module">` that imports game files: `public/components/games/` is not a WA path, and a Vite-bundled `<script>` breaks the service worker's offline contract. The page only:
1. Imports layout, landing, game data and `gameAsset`
2. Provides structural HTML (containers, buttons, canvas)
3. Loads the generated `game.js`

`game-src/{GAME_SLUG}/main.js` does the wiring the old inline shell did: header init via `platform/`, `addEventListener` on `#start-btn` and friends, starting the loop.

### What GameLayout Handles (DO NOT duplicate) (WA only)

- `<meta>` tags, viewport, title, SEO, OG tags, JSON-LD
- CSS reset, scrollbar hide, body styles, reduced-motion
- Header (`gameHeader`)
- Script tags for api-client, auth, game-cloud, game-header
- GameCloud fallback polyfill
- "More Games" section

### Required Integration Patterns (WA only)

Standalone: use the game's own auth, save and score code, or none; never import WA `api-client.js`, `auth.js` or `gameCloud`.

**Header + Auth:**
```javascript
let currentUser = null;
let cloudState = null;

window.gameHeader.init({
  title: '{GAME_NAME}',
  icon: '{GAME_EMOJI}',
  gameId: '{GAME_SLUG}',
  buttons: ['sound', 'leaderboard', 'auth'],
  onSound: () => toggleSound(),
  onSignIn: async (user) => {
    currentUser = user;
    cloudState = await window.gameCloud.loadState('{GAME_SLUG}');
    await window.gameCloud.syncGuestScores('{GAME_SLUG}');
  },
  onSignOut: () => { currentUser = null; cloudState = null; }
});
```

**Score Submission:**
```javascript
await window.gameCloud.submitScore('{GAME_SLUG}', {
  score, level, timeMs, metadata: { /* game-specific — keys MUST be in allowedMetadataKeys */ }
});
```

**Achievements:**
```javascript
// Achievement ID MUST exist in packages/shared/src/lib/constants/achievements.ts
window.gameCloud.unlockAchievement('{achievement_id}', '{GAME_SLUG}');
```

**Sound:** Use Web Audio API oscillator pattern — `playSound(type)` with game-specific cases.

### Backend Contract Rules (CRITICAL) (WA only)

- **NEVER call `window.apiClient.addCoins()`** — coins are awarded server-side during score submission. The endpoint was removed. Show coin animations locally for UX, but never call the API.
- **ALL metadata keys must be declared** in `game-config.ts` `allowedMetadataKeys`. Undeclared keys cause the score submission to be REJECTED.
- **ALL achievement IDs must be registered** in `achievements.ts` before referencing in game code. Unknown IDs return 400.
- **Every new game needs a game-config.ts entry** with score limits and `allowedMetadataKeys`.
- See `backend-contract` skill for the full API contract.

### Quality Standards

- **Modular source**: `game-src/{GAME_SLUG}/` with `main.js` plus config, core, world, characters, ui, meta, audio, input and platform modules (WA fallback: the same modules inside one hand-written IIFE)
- **No file over ~300 lines** — split further into sub-modules:
  - `core/systems/` - PhysicsSystem, SpawnSystem, ScoreSystem, ParticleSystem, LevelManager, etc.
  - `characters/` - Player, Enemy, Projectile, Pickup, etc.
  - See `astro-pro` skill "Engine Sub-Modules" section for genre-specific patterns
- **ES modules** (`export`, `import { }`) in `game-src`; no globals, no IIFEs in source files (the bundler produces the IIFE)
- **Core orchestrates** - modules talk through core events and interfaces, only `platform/` touches `window.*`
- **WA build**: `node scripts/build-games.mjs --game {GAME_SLUG}` after every source change; `node scripts/build-games.mjs --check` passes before reporting done; the generated `game.js` is never hand-edited
- Mobile-first: touch controls, 44px touch targets, responsive layout
- 60fps target: use requestAnimationFrame, avoid layout thrashing
- Reduced motion support: check `prefers-reduced-motion`
- Sound only on user gesture (not on page load)
- Game-over sequence: submit score, check achievements (WA only, or the game's own systems), show confetti on win
- localStorage for local state persistence

