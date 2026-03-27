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

### Step 2: Game Page

Create `src/pages/games/{game-id}.astro`:

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
  <!-- Game CSS variables -->
  <Fragment slot="head">
    <style>
      :root {
        --bg-primary: #0f0f1a;
        --accent: #e94560;
        /* game-specific variables */
      }
    </style>
  </Fragment>

  <!-- Game HTML (ONLY game-specific markup) -->
  <div class="game-container">
    <canvas id="gameCanvas"></canvas>
  </div>

  <!-- Game scripts -->
  <Fragment slot="scripts">
    <script is:inline>
    (function() {
      'use strict';

      // Game header init (shared module does auth, buttons, etc.)
      window.gameHeader.init({
        title: 'My Game',
        icon: '🎮',
        gameId: 'my-game',
        buttons: ['sound', 'leaderboard', 'auth'],
        onSound: () => toggleSound(),
        onSignIn: async (user) => { /* load cloud state */ },
        onSignOut: () => { /* clear user */ }
      });

      // ... game logic ...
    })();
    </script>
  </Fragment>
</GameLayout>

<!-- Game-specific styles -->
<style is:global>
  .game-container { /* ... */ }
  /* Only game-specific styles — no reset, body, header, overlay boilerplate */
</style>
```

### Step 3: Build & Verify

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
