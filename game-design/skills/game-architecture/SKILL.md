---
name: game-architecture
description: >
  The standing modularity rule for every game, Weekly Arcade and standalone: UI components, world
  building, characters, scripts, core loop logic, meta features and everything else are properly
  modular code. One module per concern with a public interface, separate layers (core loop and
  state, gameplay systems, world, UI, meta, audio, input, platform adapters), data-driven config,
  one-way dependencies through events or signals, no god files, pure logic testable without
  rendering, mapped onto each engine's own official idioms (Godot scenes and signals, Phaser
  Scenes, ES modules for Babylon.js and vanilla). Load before designing, building, reviewing or
  fixing any game code.
---

# Game Architecture: modular by default

**Non-negotiable for every game, WA and standalone:** UI components, world building, characters,
scripts, core loop logic, meta features and everything else are properly modular code. A build
that works but is one tangle is not done; the code reviewer scores it and fails the gate (see
section 6).

## Step 0: Game context

Applies to Weekly Arcade and standalone games; load `game-context` to know which platform rules (if any) apply.

## 1. The rules

1. **One module per concern.** Each module owns one thing, exposes a small public interface
   (functions, methods, signals, events) and hides the rest. No module reaches into another
   module's internals (its private state, its child nodes, its DOM, its arrays).
2. **Keep the layers separate** (section 2). A file that belongs to two layers is two files.
3. **Data-driven config over hard-coded constants.** Tuning values, level definitions, enemy
   stats, prices, drop tables, achievement lists and copy live in config data (a config module,
   JSON, or engine resources), read by the systems, not scattered as literals.
4. **Dependencies point one way.** UI and meta depend on the core through events or interfaces;
   the core never imports UI, meta, platform services or a specific renderer.
5. **Cross-module communication goes through an event bus, signals or explicit interfaces**,
   never through shared mutable globals or reaching across the tree.
6. **No god files.** Smell thresholds: a file over about 400 lines, a function over about 60
   lines, or a class / module with several unrelated responsibilities gets split. (A generated
   WA `game.js` bundle is exempt from the file count, since its source files are what count; a
   hand-written single-IIFE fallback or an existing single-file WA game is the exception to the
   file count, not to the internal structure; see section 4.)
7. **Testable modules.** Pure logic (rules, scoring, economy math, state transitions, level
   generation) is separable from rendering and input, so it can run in a test without a canvas,
   a scene tree or a browser.

## 2. Layers

| Layer | Owns | Must not |
|-------|------|----------|
| Core loop / game state | The loop, the state machine (menu, playing, paused, game over), the authoritative game state, time | Draw, play audio, touch the DOM or UI nodes, call a backend |
| Gameplay systems | Characters, enemies, abilities, projectiles, physics / collision rules, spawning, scoring rules | Know about screens, menus or platform services |
| World building | Levels, environment, terrain, props, set dressing, camera rigs, lighting | Hold gameplay rules (hitboxes and spawn points are data the systems read) |
| UI components | Each screen and widget is its own module (HUD, menus, pause, shop, game over, settings) | Contain game logic; UI renders state and emits intents ("buy", "restart"), the core decides |
| Meta features | Progression, economy, achievements, saves, settings, analytics, monetization, each behind its own module | Be called inline from gameplay code; gameplay emits events, meta listens |
| Audio | Sound and music playback, mixing, mute | Decide when gameplay events happen |
| Input | Keyboard, touch, pointer, gamepad mapped to actions | Change game state directly; it emits actions |
| Platform / services adapters | Backend, leaderboards, stores, ads, cloud saves, haptics, native bridges; WA `api-client` / `gameCloud` in WA mode only | Leak platform types into the core; swap the adapter, not the game |

## 3. Per-engine mapping (each engine's own official idioms, not a house pattern)

| Engine | How the rule is expressed |
|--------|---------------------------|
| Godot 4 | Follow the `godot` skill, which follows the Godot docs; do not restate it here. In short: scenes as reusable components, one script per scene, signals up and calls down, Resources for data, autoloads only for true globals (an event bus, settings, save service), groups and unique names instead of hard-coded paths |
| Phaser 3 | Phaser's Scene model for screens and states (Boot, Preload, Menu, Game, UI scene running in parallel for the HUD), ES modules per system, game objects as classes, the Scene's event emitter or a shared emitter for cross-scene events; per the `phaser` skill and Phaser's docs |
| Babylon.js | ES modules per system, imported from `@babylonjs/*` packages, scene setup separate from gameplay systems, GUI (or DOM overlay) as its own modules, observables for events; per the `babylonjs-3d` skill and Babylon's docs |
| Vanilla canvas / DOM | ES modules per system (`core/`, `systems/`, `world/`, `ui/`, `meta/`, `audio/`, `input/`, `platform/`, `config/`), a small event emitter, a renderer that reads state and never mutates it |
| Other engines | That engine's own documented component / module model |

The skeleton step of `/game-release` creates this layout for the chosen engine using that engine's
official structure, and the code review gate checks it.

## 4. Weekly Arcade games (WA only)

**New WA games** (see the `add-new-game` skill) are authored as ES modules in
`apps/web-astro/game-src/{game-id}/`, with `main.js` as the entry and one module per concern,
grouped by the layers above (`config/`, `core/`, `world/`, `characters/`, `ui/`, `meta/`,
`audio/`, `input/`, `platform/`). `node scripts/build-games.mjs` (esbuild) bundles each game into
the generated IIFE `apps/web-astro/public/games/{game-id}/game.js`, which carries a
`/* GENERATED from apps/web-astro/game-src/{id}/ by scripts/build-games.mjs. ... */` banner and
is committed. It runs in `build` and during `astro dev`; `--check` fails on a stale bundle (CI
runs it); `--game <id>` builds one. The served page, minifier, service worker and offline
manifest still see one `game.js` per game.

- Never hand-edit the generated `game.js`; edit `game-src/{id}/` and rebuild.
- Shared WA services (`window.apiClient`, `window.gameCloud`, `window.gameHeader`) stay classic
  globals from `public/js/`. Only the `platform/` adapter module reads them; never `import`
  `/js/*.js`.
- Controls are wired with `addEventListener` from the module that owns them. Module-scoped
  functions are not globals, so an inline `onclick` cannot reach them in the bundle.
- An internal event emitter (or `_shared/` helper), UI modules that only render and emit intents,
  meta modules (coins, achievements, saves) that listen to events.

**Fallback while the build script is not merged.** Check that `scripts/build-games.mjs` exists in
the WA checkout. If it does not, author the same modules inside a single hand-written IIFE
`public/games/{game-id}/game.js`, each an IIFE-scoped object or closure with a returned public
interface (`const Input = (() => { ...; return { actions, bind }; })();`), in layer order, and
tell the user the fallback was used.

**Existing WA games are not migrated.** They keep whichever of the four shipped patterns they
use: a single IIFE `game.js`; several classic scripts on a window namespace (tiny-tycoon-3d,
strait-runner, drift-legends, chess-3d, lantern-deep); native ES modules (8-ball-lounge); or a
classic entry plus `import()` of ES module leaves (voidbreak-2). No agent changes an existing
game's structure unless the user asks. A bug fix follows that game's current structure, and a
reviewer judges modularity within it rather than demanding a migration.

## 5. Checklist (builders and fixers)

- [ ] Each layer in section 2 exists as its own module(s); none is merged into another
- [ ] No UI module contains game rules; no core module draws or plays audio
- [ ] Meta features listen to events; gameplay does not call them inline
- [ ] Tuning and content in config data
- [ ] No file over about 400 lines (WA fallback single IIFE: no internal module over about 400 lines)
- [ ] Pure logic has at least one test, or can be called without rendering
- [ ] Platform services behind an adapter

## 6. Review criteria (used by `game-code-reviewer`)

Scored in the Architecture category (1-5) of the /30 rubric:

| Score | Meaning |
|-------|---------|
| 5 | Every layer separated, one-way dependencies, data-driven config, pure logic tested |
| 4 | Minor coupling, one oversized module |
| 3 | Layers mostly separated, some UI-logic mixing or hard-coded tuning |
| 2 | God file or tangled dependencies, logic inside UI |
| 1 | No structure |

Gate failures, reported as HIGH (CRITICAL when they block a fix elsewhere): a god file (over
about 400 lines with several unrelated responsibilities), game rules inside a UI module, the
core importing UI, meta or platform code, and a module mutating another module's internals.

## 7. Fixing code (used by `game-bug-fixer` and `godot-developer`)

Fix inside the module that owns the behaviour. Do not add a cross-module hack (reaching into
another module, a new global, a special case in the wrong layer) to make a symptom go away; if
the right fix needs a new interface or event, add it and say so in the report.
