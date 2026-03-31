---
name: astro-pro
description: >
  Astro framework knowledge for browser game development. Covers island architecture,
  zero-JS-by-default, GameLayout patterns, content collections, View Transitions,
  Firebase deployment, PWA support, and incremental migration from vanilla HTML.
  Applied when building new games with Astro, migrating existing games, or optimizing
  frontend delivery. Essential for the Weekly Arcade Astro migration.
---

# Astro Pro — Frontend Framework for Browser Games

## Why Astro for Games

Astro is a **build-first web framework** — not a runtime framework. It compiles pages to static HTML at build time and ships **zero JavaScript by default**. Interactive pieces ("islands") only hydrate when explicitly told to.

This makes it ideal for Weekly Arcade because:
- Games are **islands of interactivity** in otherwise static pages
- Canvas/DOM game code doesn't need hydration — it runs as raw `<script>`
- Shared boilerplate (meta, SEO, header, auth) moves to layouts — write once, every game gets it
- Built on Vite: automatic minification, asset hashing, code splitting, HMR

**Current version**: Astro 6.x (requires Node 22+)

---

## Core Architecture: Islands

```
┌─────────────────────────────────────────────┐
│  Static HTML (rendered at build time)        │
│                                              │
│  ┌──────────┐  ┌──────────────────────────┐  │
│  │ Island 1 │  │ Island 2                 │  │
│  │ (Canvas  │  │ (Leaderboard — hydrates  │  │
│  │  game —  │  │  when scrolled into view) │  │
│  │  client: │  │  client:visible           │  │
│  │  load)   │  │                          │  │
│  └──────────┘  └──────────────────────────┘  │
│                                              │
│  Everything else = pure HTML, zero JS        │
└─────────────────────────────────────────────┘
```

### Client Directives

| Directive | Loads When | Use Case |
|-----------|-----------|----------|
| `client:load` | Immediately | Game canvas, auth button |
| `client:idle` | Browser idle | Notification manager, analytics |
| `client:visible` | Enters viewport | Leaderboard, "More Games" |
| `client:media` | Media query matches | Mobile-only controls |
| `client:only` | Never SSR'd | Canvas-heavy games |
| *(none)* | Never | Header, footer, meta — stays static |

---

## Weekly Arcade Astro Structure

```
apps/web-astro/
├── astro.config.mjs         ← output: 'static', site URL, trailing slash
├── package.json              ← astro 6.x dependency
├── project.json              ← Nx targets (build, serve, preview, check)
├── tsconfig.json             ← strict TS, path aliases
└── src/
    ├── layouts/
    │   ├── BaseLayout.astro  ← charset, viewport, CSS reset, reduced-motion
    │   └── GameLayout.astro  ← SEO, header, shared JS, fallback, more-games
    ├── components/
    │   ├── SEOHead.astro     ← meta, OG, Twitter, JSON-LD from props
    │   ├── GameHeader.astro  ← static header shell (JS upgrades at runtime)
    │   ├── GameCloudFallback.astro ← single fallback polyfill
    │   └── MoreGames.astro   ← "More Games" with auto-exclude
    ├── data/games/
    │   └── {game-id}.json   ← game metadata (drives SEO + layout)
    ├── pages/
    │   ├── index.astro       ← landing page
    │   └── games/
    │       └── {game-id}.astro ← game page (game-specific code only)
    └── public/
        └── js/               ← shared modules (api-client, auth, game-cloud, game-header)
```

---

## GameLayout — What It Handles

`GameLayout.astro` eliminates all boilerplate. Each game file only contains game-specific code.

**Provided by layout (write ZERO of this per game):**
- `<meta charset>`, viewport, `<title>`
- Preconnects (gstatic, firestore)
- SEO: description, keywords, canonical
- Open Graph (title, desc, image, site_name)
- Twitter Card meta
- PWA manifest link, theme-color, apple-touch-icon
- JSON-LD: VideoGame schema + BreadcrumbList
- CSS reset, scrollbar hide, reduced-motion
- Shared body styles (font, background, touch-action, overflow)
- `<GameHeader>` static shell
- Shared JS: api-client.js, auth.js, game-cloud.js, game-header.js
- GameCloud fallback polyfill
- "More Games" section (auto-excludes current game)

**Game file only needs:**
- CSS variables (`:root { --accent: ... }`)
- Game-specific CSS
- Game HTML
- Game JavaScript

---

## Componentized Game Architecture

Games are split into focused component files instead of a single monolithic `.astro` page. This keeps each file small, testable, and easy to navigate.

### File Layout

```
apps/web-astro/src/
├── data/games/{game-id}.json              ← Game metadata (drives SEO + layout)
├── pages/games/{game-id}.astro            ← Thin page shell — imports components
└── components/games/{game-id}/
    ├── GameEngine.js                      ← Core game loop, state machine, update/render
    ├── GameRenderer.js                    ← All drawing/DOM manipulation
    ├── GameInput.js                       ← Keyboard, touch, pointer input handling
    ├── GameAudio.js                       ← Web Audio sound effects + music
    ├── GameUI.js                          ← HUD, menus, overlays, game-over screen
    ├── GameConfig.js                      ← Constants, tuning, level definitions
    └── styles.css                         ← Game-specific CSS (imported in .astro)
```

Not every game needs all files. Small games can combine renderer + engine, or skip audio. The rule: **if a file exceeds ~300 lines, split it**.

### Component Responsibilities

| File | Owns | Exports |
|------|------|---------|
| `GameConfig.js` | Constants, levels, tuning values, achievement IDs | `CONFIG` object |
| `GameEngine.js` | Game state, game loop, collision, scoring, state transitions | `GameEngine` class |
| `GameRenderer.js` | Canvas drawing OR DOM updates, animations, particles | `GameRenderer` class |
| `GameInput.js` | Keyboard map, touch handlers, pointer events, gamepad | `GameInput` class |
| `GameAudio.js` | AudioContext, sound effects, music, volume/mute | `GameAudio` class |
| `GameUI.js` | HUD updates, menu show/hide, game-over overlay, score display | `GameUI` class |
| `styles.css` | CSS variables, game container, UI element styles | CSS (imported) |

### How Components Connect

```
GameConfig ──────────────────────────────────┐
     │                                        │
GameEngine (imports Config)                   │
     │  ├── owns game state + loop            │
     │  ├── calls Renderer.draw(state)        │
     │  ├── calls Audio.play('hit')           │
     │  ├── reads Input.keys / Input.touches  │
     │  └── calls UI.updateScore(score)       │
     │                                        │
GameRenderer (imports Config)                 │
     │  └── pure drawing — no state logic     │
     │                                        │
GameInput                                     │
     │  └── captures input, exposes state     │
     │                                        │
GameAudio                                     │
     │  └── plays/stops sounds                │
     │                                        │
GameUI (imports Config)                       │
     └── updates DOM overlays, HUD            │
```

**Rule**: Components communicate through the engine. Renderer doesn't talk to Input. Audio doesn't talk to UI. The engine orchestrates.

### Component Templates

**GameConfig.js**:
```javascript
export const CONFIG = {
  GAME_ID: '{game-id}',
  GAME_NAME: '{Game Name}',
  GAME_EMOJI: '{emoji}',

  // Tuning
  CANVAS_WIDTH: 400,
  CANVAS_HEIGHT: 600,
  TARGET_FPS: 60,
  TIMESTEP: 1000 / 60,

  // Game-specific constants
  PLAYER_SPEED: 5,
  GRAVITY: 0.5,
  MAX_LIVES: 3,

  // Levels / difficulty progression
  LEVELS: [
    { speed: 1, spawnRate: 2000 },
    { speed: 1.5, spawnRate: 1500 },
    // ...
  ],

  // Achievement IDs (must match achievements.ts)
  ACHIEVEMENTS: {
    FIRST_WIN: '{game-id}_first_win',
    HIGH_SCORE: '{game-id}_high_score_1000',
  },
};
```

**GameAudio.js**:
```javascript
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  play(sound) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    switch (sound) {
      case 'hit':
        osc.frequency.value = 220;
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        osc.start(); osc.stop(this.ctx.currentTime + 0.2);
        break;
      // ... more sounds
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}
```

**GameInput.js**:
```javascript
export class GameInput {
  constructor(canvas) {
    this.keys = {};
    this.touch = { active: false, x: 0, y: 0, startX: 0, startY: 0 };
    this.canvas = canvas;
    this._bindEvents();
  }

  _bindEvents() {
    document.addEventListener('keydown', (e) => { this.keys[e.key] = true; });
    document.addEventListener('keyup', (e) => { this.keys[e.key] = false; });

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      this.touch = { active: true, x: t.clientX, y: t.clientY, startX: t.clientX, startY: t.clientY };
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      this.touch.x = t.clientX;
      this.touch.y = t.clientY;
    }, { passive: false });

    this.canvas.addEventListener('touchend', () => { this.touch.active = false; });
  }

  getSwipeDirection(threshold = 30) {
    const dx = this.touch.x - this.touch.startX;
    const dy = this.touch.y - this.touch.startY;
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return null;
    return Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up');
  }

  destroy() {
    // Remove listeners if needed
  }
}
```

**GameRenderer.js** (canvas example):
```javascript
import { CONFIG } from './GameConfig.js';

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.canvas.width = CONFIG.CANVAS_WIDTH;
    this.canvas.height = CONFIG.CANVAS_HEIGHT;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawPlayer(player) { /* ... */ }
  drawEnemies(enemies) { /* ... */ }
  drawParticles(particles) { /* ... */ }

  draw(state) {
    this.clear();
    this.drawPlayer(state.player);
    this.drawEnemies(state.enemies);
    this.drawParticles(state.particles);
  }
}
```

**GameEngine.js**:
```javascript
import { CONFIG } from './GameConfig.js';
import { GameRenderer } from './GameRenderer.js';
import { GameInput } from './GameInput.js';
import { GameAudio } from './GameAudio.js';
import { GameUI } from './GameUI.js';

export class GameEngine {
  constructor(canvas) {
    this.renderer = new GameRenderer(canvas);
    this.input = new GameInput(canvas);
    this.audio = new GameAudio();
    this.ui = new GameUI();

    this.state = {
      status: 'menu', // menu | playing | paused | gameOver
      score: 0,
      level: 0,
      player: { x: CONFIG.CANVAS_WIDTH / 2, y: CONFIG.CANVAS_HEIGHT - 50 },
      enemies: [],
      particles: [],
    };

    this.lastTime = 0;
    this.accumulator = 0;
    this.animId = null;
  }

  start() {
    this.audio.init();
    this.state.status = 'playing';
    this.ui.hideMenu();
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  loop(timestamp) {
    const delta = timestamp - this.lastTime;
    this.lastTime = timestamp;
    this.accumulator += delta;

    while (this.accumulator >= CONFIG.TIMESTEP) {
      this.update(CONFIG.TIMESTEP);
      this.accumulator -= CONFIG.TIMESTEP;
    }

    this.renderer.draw(this.state);
    this.animId = requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    if (this.state.status !== 'playing') return;
    // Update player, enemies, collisions, scoring...
  }

  async gameOver() {
    this.state.status = 'gameOver';
    cancelAnimationFrame(this.animId);

    // Submit score
    await window.gameCloud?.submitScore(CONFIG.GAME_ID, {
      score: this.state.score,
      level: this.state.level,
    });

    // Check achievements
    if (this.state.score >= 1000) {
      window.gameCloud?.unlockAchievement(CONFIG.ACHIEVEMENTS.HIGH_SCORE, CONFIG.GAME_ID);
    }

    this.ui.showGameOver(this.state.score);
  }

  restart() {
    this.state = { /* reset state */ };
    this.start();
  }

  destroy() {
    cancelAnimationFrame(this.animId);
    this.input.destroy();
  }
}
```

### Page Shell (.astro file) — Thin Orchestrator

The `.astro` page file becomes a thin shell that imports components:

```astro
---
import GameLayout from '../../layouts/GameLayout.astro';
import gameData from '../../data/games/my-game.json';
---

<GameLayout
  title={gameData.title}
  gameName={gameData.name}
  gameId={gameData.id}
  icon={gameData.icon}
  description={gameData.description}
  keywords={gameData.keywords}
  url={gameData.url}
  themeColor={gameData.themeColor}
  accentColor={gameData.accentColor}
  genres={gameData.genres}
  ratingValue={gameData.ratingValue}
  ratingCount={gameData.ratingCount}
>
  <Fragment slot="head">
    <link rel="stylesheet" href={`/components/games/${gameData.id}/styles.css`} />
  </Fragment>

  <div class="game-container">
    <div id="menu-screen"><!-- menu UI --></div>
    <canvas id="gameCanvas"></canvas>
    <div id="game-over-screen" style="display:none;"><!-- game over UI --></div>
  </div>

  <Fragment slot="scripts">
    <script type="module">
      import { CONFIG } from '/components/games/my-game/GameConfig.js';
      import { GameEngine } from '/components/games/my-game/GameEngine.js';

      const canvas = document.getElementById('gameCanvas');
      const game = new GameEngine(canvas);

      // Header integration
      window.gameHeader.init({
        title: CONFIG.GAME_NAME,
        icon: CONFIG.GAME_EMOJI,
        gameId: CONFIG.GAME_ID,
        buttons: ['sound', 'leaderboard', 'auth'],
        onSound: () => game.audio.toggle(),
        onSignIn: async (user) => {
          const cloudState = await window.gameCloud.loadState(CONFIG.GAME_ID);
          await window.gameCloud.syncGuestScores(CONFIG.GAME_ID);
          if (cloudState?.highScore) game.ui.updateHighScore(cloudState.highScore);
        },
        onSignOut: () => {},
      });

      // Start
      document.getElementById('start-btn')?.addEventListener('click', () => game.start());
      document.getElementById('restart-btn')?.addEventListener('click', () => game.restart());
    </script>
  </Fragment>
</GameLayout>
```

**Key change**: The `.astro` file is now ~40-60 lines (layout props + wiring) instead of 500-2000+ lines. All game logic lives in the component files.

### Where Component Files Live

Component JS/CSS files go in `public/components/games/{game-id}/` so they're served as static assets:

```
apps/web-astro/
  public/
    components/games/{game-id}/
      GameConfig.js
      GameEngine.js
      GameRenderer.js
      GameInput.js
      GameAudio.js
      GameUI.js
      styles.css
```

Using `public/` means files are served as-is (no Astro bundling), which works with `<script type="module">` and dynamic imports. This keeps Astro's build fast and avoids bundling game code with the framework.

**Alternative** — for games that benefit from bundling/tree-shaking (e.g., Babylon.js 3D games), put components in `src/components/games/{game-id}/` and import them in a `<script>` tag (without `is:inline`). Astro will bundle them via Vite.

### Engine Sub-Modules (Large/Complex Games)

For bigger games, `GameEngine.js` itself can be split into feature-specific modules:

```
public/components/games/{game-id}/
├── GameConfig.js
├── GameEngine.js          ← Thin orchestrator that imports sub-modules
├── engine/
│   ├── PhysicsSystem.js   ← Collision detection, gravity, movement
│   ├── SpawnSystem.js     ← Enemy/item spawning, wave management
│   ├── ScoreSystem.js     ← Scoring, combos, multipliers, achievements
│   ├── ParticleSystem.js  ← Visual particles, explosions, trails
│   ├── PowerUpSystem.js   ← Power-up logic, timers, effects
│   └── LevelManager.js   ← Level progression, transitions, difficulty
├── entities/
│   ├── Player.js          ← Player state, abilities, inventory
│   ├── Enemy.js           ← Enemy types, AI behaviors, patterns
│   ├── Projectile.js      ← Bullets, lasers, throwables
│   └── Pickup.js          ← Coins, health, power-ups
├── GameRenderer.js
├── GameInput.js
├── GameAudio.js
├── GameUI.js
└── styles.css
```

**GameEngine.js becomes a thin coordinator:**

```javascript
import { CONFIG } from './GameConfig.js';
import { PhysicsSystem } from './engine/PhysicsSystem.js';
import { SpawnSystem } from './engine/SpawnSystem.js';
import { ScoreSystem } from './engine/ScoreSystem.js';
import { ParticleSystem } from './engine/ParticleSystem.js';
import { LevelManager } from './engine/LevelManager.js';
import { GameRenderer } from './GameRenderer.js';
import { GameInput } from './GameInput.js';
import { GameAudio } from './GameAudio.js';
import { GameUI } from './GameUI.js';

export class GameEngine {
  constructor(canvas) {
    this.renderer = new GameRenderer(canvas);
    this.input = new GameInput(canvas);
    this.audio = new GameAudio();
    this.ui = new GameUI();

    // Sub-systems
    this.physics = new PhysicsSystem();
    this.spawner = new SpawnSystem();
    this.scoring = new ScoreSystem();
    this.particles = new ParticleSystem();
    this.levels = new LevelManager();

    this.state = { status: 'menu', entities: [], /* ... */ };
  }

  update(dt) {
    this.spawner.update(dt, this.state);
    this.physics.update(dt, this.state);     // Movement + collisions
    this.scoring.update(this.state);          // Score changes from collisions
    this.particles.update(dt, this.state);    // Visual effects
    this.levels.checkProgression(this.state); // Level-up check

    this.ui.update(this.state);
    this.renderer.draw(this.state);
  }
}
```

**Common sub-modules by game genre:**

| Genre | Likely Sub-Modules |
|-------|-------------------|
| Platformer | PhysicsSystem, LevelManager, entities/Player, entities/Platform |
| Tower Defense | SpawnSystem, PathSystem, entities/Tower, entities/Enemy, WaveManager |
| Puzzle | BoardSystem, MatchSystem, ScoreSystem, AnimationQueue |
| Idle/Tycoon | EconomySystem, UpgradeManager, TickSystem, SaveSystem |
| Racing | PhysicsSystem, TrackManager, entities/Vehicle, LapSystem |
| RPG | CombatSystem, InventorySystem, DialogSystem, QuestManager |
| Card Game | DeckManager, HandSystem, TurnManager, CardEffects |

**Rule**: Extract a sub-module when a system has its own state + its own update logic. If it's just a helper function, keep it in the parent.

### When to Split vs Keep Together

| Game Size | Lines of Game Code | Approach |
|-----------|-------------------|----------|
| Tiny (< 200 lines) | Simple clicker, timer | Single `<script is:inline>` IIFE is fine |
| Small (200-500 lines) | Basic arcade game | Split into Engine + Config + Audio at minimum |
| Medium (500-1500 lines) | Full arcade/puzzle game | Full component split (all 6-7 files) |
| Large (1500+ lines) | RPG, strategy, 3D game | Full split + sub-modules (e.g., `entities/`, `levels/`) |

### Migration: Monolith to Components

To refactor an existing monolithic game:

1. Extract constants/config → `GameConfig.js`
2. Extract sound functions → `GameAudio.js`
3. Extract input handling → `GameInput.js`
4. Extract all draw/render calls → `GameRenderer.js`
5. Extract DOM/UI updates → `GameUI.js`
6. What remains is the engine → `GameEngine.js`
7. Update `.astro` page to import and wire components
8. Move CSS to `styles.css`, import via `<link>`

---

## Creating a New Game (.astro)

### Step 1: Game Data JSON

Create `src/data/games/{game-id}.json`:

```json
{
  "id": "my-game",
  "name": "My Game",
  "icon": "🎮",
  "title": "My Game | Weekly Arcade - Free Browser Game",
  "description": "Play My Game free online. ...",
  "keywords": "my game, browser game, ...",
  "url": "/games/my-game/",
  "themeColor": "#e94560",
  "accentColor": "#e94560",
  "genres": ["Arcade", "Puzzle"],
  "ratingValue": "4.8",
  "ratingCount": "500",
  "category": "arcade",
  "rendering": "canvas"
}
```

### Step 2: Game Components

Create `public/components/games/{game-id}/`:
- `GameConfig.js` — constants and tuning
- `GameEngine.js` — game loop and state
- `GameRenderer.js` — drawing/rendering
- `GameInput.js` — input handling
- `GameAudio.js` — sound effects
- `GameUI.js` — HUD and overlays
- `styles.css` — game-specific styles

See the component templates above for each file's structure.

### Step 3: Game Page

Create `src/pages/games/{game-id}.astro` as a thin shell that imports the components and wires them to the layout (see "Page Shell" template above).

### Step 4: Build & Verify

```bash
cd apps/web-astro && npx astro build   # builds to dist/apps/web-astro/
cd apps/web-astro && npx astro dev --port 4201  # dev server with HMR
```

---

## Script Execution Order (Critical)

In GameLayout, scripts load in this order:
1. Shared modules (`/js/api-client.js`, `/js/auth.js`, `/js/game-cloud.js`, `/js/game-header.js`)
2. GameCloud fallback polyfill
3. Game's `slot="scripts"` content

**This means:** the game script runs AFTER shared modules are available. If a game defines
a callback function that shared scripts should call (like `_ttInitHeader`), the trigger
call must come AFTER the game IIFE in the scripts slot, not before.

```astro
<Fragment slot="scripts">
  <script is:inline>
    // Game IIFE — defines window._myCallback
    (() => {
      window._myCallback = function() { /* ... */ };
    })();
  </script>
  <!-- Trigger AFTER definition -->
  <script is:inline>if(window._myCallback) window._myCallback();</script>
</Fragment>
```

---

## Migrating an Existing Game to Astro

### What to Extract

| Section | Original Location | Astro Location |
|---------|------------------|----------------|
| Meta/SEO/OG/JSON-LD (75-80 lines) | `<head>` | Eliminated — `SEOHead.astro` generates from JSON |
| CSS reset + body styles (30 lines) | `<style>` | Eliminated — `BaseLayout` + `GameLayout` |
| Reduced-motion media query (6 lines) | `<style>` | Eliminated — `BaseLayout` |
| Header HTML (1 line inline) | `<body>` top | Eliminated — `GameHeader.astro` |
| Shared script tags (4 lines) | Bottom of `<body>` | Eliminated — `GameLayout` |
| Fallback polyfill (1,748 chars) | Per game | Eliminated — `GameCloudFallback.astro` |
| More Games section (15-20 lines) | Bottom of `<body>` | Eliminated — `MoreGames.astro` |

**Total eliminated per game: ~130-160 lines of boilerplate**

### Migration Steps

1. Create `src/data/games/{id}.json` with game metadata
2. Create `src/pages/games/{id}.astro` with the template above
3. Copy game-specific CSS (skip reset, body, reduced-motion, scrollbar hide)
4. Copy game-specific HTML (skip header, more-games section)
5. Copy game script into `<script is:inline>` in scripts slot
6. Remove old `../../js/` script tags (layout provides them as `/js/`)
7. Remove fallback polyfill (layout provides it)
8. Verify script execution order (callbacks defined before triggered)
9. Build and compare screenshots

---

## Firebase Deployment

Astro builds to static files — deploy to Firebase Hosting same as before.

```js
// astro.config.mjs
export default defineConfig({
  output: 'static',
  outDir: '../../dist/apps/web-astro',
  site: 'https://weeklyarcade.games',
  trailingSlash: 'always',
});
```

```json
// firebase.json — point to Astro output
{
  "hosting": {
    "public": "dist/apps/web-astro",
    "cleanUrls": true,
    "trailingSlash": true,
    "rewrites": [{ "source": "/api/**", "run": { "serviceId": "weekly-arcade-api" }}]
  }
}
```

---

## Nx Integration

```json
// apps/web-astro/project.json
{
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "options": { "command": "cd apps/web-astro && npx astro build" },
      "outputs": ["{workspaceRoot}/dist/apps/web-astro"]
    },
    "serve": {
      "executor": "nx:run-commands",
      "options": { "command": "cd apps/web-astro && npx astro dev --port 4201" }
    }
  }
}
```

---

## Performance Benefits

| Metric | Raw HTML (no build) | Astro |
|--------|-------------------|-------|
| CSS/JS minification | None | Automatic |
| Asset hashing | None | Automatic (`_assets/*.Ksn13fEP.css`) |
| Code splitting | None (all shared modules load) | Per-page |
| SEO boilerplate per game | ~80 lines | 0 (in layout) |
| Fallback polyfill copies | 12x | 1x |
| Build time | N/A (raw copy) | ~2s for 4 pages |
| Typical output savings | Baseline | 20-30% smaller |

---

## View Transitions (SPA-smooth navigation)

```astro
<!-- In BaseLayout.astro -->
---
import { ViewTransitions } from 'astro:transitions';
---
<head>
  <ViewTransitions />
</head>
```

Uses browser's native View Transitions API. Landing page → game page feels instant.
85%+ browser coverage with graceful fallback.

---

## PWA & Service Worker

Use `@vite-pwa/astro` to replace manual service worker:

```js
import AstroPWA from '@vite-pwa/astro';

export default defineConfig({
  integrations: [
    AstroPWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{html,js,css,png,svg,wav}'],
      }
    })
  ]
});
```

No more manually bumping `CACHE_VERSION` or maintaining precache lists.

---

## Content Collections (Game Registry)

For managing game metadata at scale (future):

```ts
// src/content.config.ts
import { defineCollection, z } from 'astro:content';

const games = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/data/games' }),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    icon: z.string(),
    description: z.string(),
    accentColor: z.string(),
    genres: z.array(z.string()),
    rendering: z.enum(['canvas', 'dom', 'hybrid']),
  })
});
```

---

## Multiplayer Compatibility

Astro doesn't block multiplayer. It delivers the page; the game logic runs as plain JavaScript.

```astro
<script is:inline>
  // WebSocket connection — Astro is irrelevant here
  const ws = new WebSocket('wss://weeklyarcade.games/api/ws/poker');
  ws.onmessage = (event) => { /* update game state */ };
</script>
```

Multiplayer complexity lives in the NestJS backend (WebSocket gateway, game engine, state machine), not the frontend framework.

---

## Common Pitfalls

1. **Script order**: Game IIFE must come before callback triggers in `slot="scripts"`
2. **`is:inline` required**: Use `<script is:inline>` for game scripts that use `window.*` globals — Astro would otherwise try to bundle them as ES modules
3. **CSS scope**: Use `<style is:global>` for game CSS that targets IDs/classes in the game HTML — Astro's default scoped styles won't match
4. **JSON emoji**: Use actual emoji characters in `.json` files, not `\u{1F40D}` syntax (Vite's JSON parser rejects it)
5. **Firebase SDK**: Do NOT add Firebase script tags — `auth.js` loads them dynamically
6. **Body overrides**: If a game needs `overflow: auto` or different `touch-action`, override in the `slot="head"` style block
