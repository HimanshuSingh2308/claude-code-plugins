# Game Design Plugin

A comprehensive Claude Code plugin for game design workflows, featuring autonomous release orchestration, game lifecycle management, quality assurance, and analytics.

## Quick Start

```bash
# Run the autonomous weekly release (executes by default)
/weekly-game-release

# Preview the plan first without changing anything
/weekly-game-release --dry-run

# Standalone game release (own repo); add --dry-run to preview
/game-release --new --concept "<idea>"

# Check game health
/game-status --all
```

---

## Weekly Arcade vs standalone

The plugin serves two kinds of games: **Weekly Arcade** games (in the weekly-arcade monorepo,
listed in `GAME_REGISTRY` and `apps/web-astro/src/data/games/*.json`) and **standalone** games
(their own repo, brand, backend and build, for example most Godot projects). Every agent, command
and skill starts with a "Step 0: Game context" block that loads the `game-context` skill, which
resolves the platform and states it in one line (`Context: Weekly Arcade game <slug>` or
`Context: standalone game <name> at <path>`). Resolution order: override file, the user's words,
detection signals, then one question to the user; it never guesses.

- **WA-only** agents and commands (release, registry, landing, SEO, lifecycle) stop in standalone mode.
- **Mixed** agents and skills skip steps marked "(WA only)" for standalone games.
- **Generic** knowledge skills apply to both.
- Orchestrators pass the resolved `Context:` line to every sub-agent so none re-asks.
- Standalone games are never added to WA listings, registry, sitemap or landing pages, never get
  WA shared packages, and ship to phones through engine-native export (for example Godot's native
  iOS / Android export), not the WA Capacitor apps.

To skip the check, add `.claude/game-context.json` at the game's repo root:

```json
{"platform": "standalone", "game": "boat-jam"}
```

(`"platform"` is `"weekly-arcade"` or `"standalone"`; `"game"` is the WA slug or the game name.)

---

## Commands

### Orchestration

| Command | Description |
|---------|-------------|
| `/weekly-game-release` | Autonomous end-to-end weekly game release |
| `/game-release` | **NEW** Release workflow for standalone games: repo setup, new game or new version, gates, engine-native builds, PR, tag + GitHub release, store checklist |
| `/workflow-status` | View history and status of orchestrator runs (weekly and standalone) |

### Game Lifecycle

| Command | Description |
|---------|-------------|
| `/game-clone` | Clone existing game as template for variations |
| `/game-retire` | Safely archive/sunset old games |

### Operations

| Command | Description |
|---------|-------------|
| `/game-status` | Check health of deployed games |
| `/game-audit` | Run all quality agents on any game |
| `/game-hotfix` | Emergency fixes with enhanced safety |
| `/game-rollback` | Revert recent deployments |

### Analytics

| Command | Description |
|---------|-------------|
| `/game-analytics` | View performance metrics and stats |

---

## Command Details

### `/weekly-game-release`

**Flagship feature** - Autonomous orchestration of the entire weekly game release workflow.

```bash
/weekly-game-release [options]

Options:
  (no flag)              Execute the workflow (default)
  --dry-run              Show the full plan, change nothing
  --resume <id>          Resume failed workflow
  --skip-scout           Use provided concept
  --game "<concept>"     Specify game concept
  --no-merge             Create PR only
  --verbose              Detailed logging
```

**Workflow Phases**:
1. Scout - Research trends, select best concept
2. Design - Generate complete PRD
3. Build - Implement game with integrations
4. Review - Code quality loop (target: 20/30)
5. QA - Bug testing loop (fix CRITICAL/HIGH)
6. Security - Leaderboard validation
7. PR & Merge - Create and merge PR
8. Post-Release - Release notes, metrics

---

### `/game-release`

**Standalone counterpart of `/weekly-game-release`** - for games with their own repo, brand,
build and deploy (stops and points to `/weekly-game-release` if the context is Weekly Arcade).
Runs through `game-release-orchestrator`.

```bash
/game-release [options]

Options:
  (no flag)              Execute the workflow (default)
  --dry-run              Show the full plan (phases, parallel groups, questions,
                         toolchain status, what would change), change nothing
  --resume <id>          Resume a workflow (gr-YYYY-MM-DD-HHmmss)
  --new                  New game (default: new version of the game in this repo)
  --concept "<idea>"     Concept for --new
  --scout                Pick the concept with game-trend-scout
  --repo <path|url>      Existing repo (local path or URL to clone)
  --create-repo          Create a new repo (skip the question)
  --path <dir>           Local folder for the repo
  --owner <user|org>     GitHub owner for a new repo
  --visibility <v>       private (default) | public
  --gh-account <login>   gh account to use
  --token-env <NAME>     Env var holding the token (name only)
  --engine <name>        vanilla | phaser | babylon | godot
  --targets <list>       web,android,ios,desktop
  --version <x.y.z>      Version to release
  --merge                Merge the PR, then tag + GitHub release (default: stop at PR)
  --skip-gates <list>    Skip gates; requires --reason "<why>"
  --verbose              Detailed logging
```

Executing by default does not skip any safety step: creating a GitHub repo, installing tools,
spending Meshy / image credits, store uploads, production deploys and merging (only with
`--merge`) each still ask at that moment.

**Workflow Phases**:
0. Repository setup - asks if a repo exists; connects / clones it, or creates it (owner, name,
   visibility, account chosen by name; secrets never written anywhere) after confirmation
0.5. Toolchain check - `game-toolchain` needed vs available table, installs only after a yes
1. `--new`: concept (optional scout) -> PRD -> visual design (Claude Design mockups, every screen
   at every breakpoint) -> engine + targets -> skeleton -> build -> environment art
   Version mode: read repo -> changelog since last tag -> version bump in every engine-native place
2. Gates (all in parallel): engine validation first (Godot headless loop + GUT / gdUnit4), then
   code review (20/30), QA, visual QA (web), state sweep, accessibility (45/65), economy and
   security only if the game has them, performance budget; one merged fix pass, failed gates re-run
3. Build re-check, then engine-native exports per target in parallel (Godot native AAB / IPA, not
   Capacitor), release notes and a store-submission checklist
4. PR in the game's own repo; with `--merge`: merge, tag, GitHub release with artifacts.
   Never uploads to a store or deploys to production without confirmation at that moment

**Skeleton per engine**: the engine's own official best practice, checked against current docs /
template versions first (recorded in state and README). Godot: `godot` skill, `project.godot`
created headlessly, built by `godot-developer`. Babylon.js: `@babylonjs/*` ES modules with the
bundler Babylon's docs recommend. Phaser: `npm create @phaserjs/game@latest`. Vanilla: Vite
template. Other engines: official template or an approved layout. Every skeleton gets README,
official `.gitignore`, `.claude/game-context.json`, CHANGELOG, `AGENTS.md` (tool-neutral) and
`CLAUDE.md` (`@AGENTS.md` import plus Claude-specific skills and agents), and passes the engine's
own validation before the first commit. Existing repos: AGENTS.md / CLAUDE.md are never
overwritten, only proposed.

**Execution model**: every phase runs in a subagent; independent work is dispatched in one
message (gates, per-target exports, release notes, store checklist); only failed gates re-run.

**Creative tooling**: Claude Design mockups before the build (asks for `/design-login` or a
skip approval if disconnected); Nano Banana Pro for 2D, Meshy AI for 3D models, Blender MCP for
cleanup and GLB export; credit-spending calls need an estimate and approval.

State: `~/Documents/game-releases/workflows/{id}.json`; artifacts: `~/Documents/game-releases/{slug}/`.

---

### `/game-status`

Monitor health of deployed games.

```bash
/game-status [<game-slug> | --all] [--verbose] [--watch]
```

Shows: Runtime errors, loading issues, recent activity, open bugs.

---

### `/game-audit`

Run comprehensive quality audit on any game.

```bash
/game-audit <game-slug> [--review-only | --qa-only | --security-only | --fix]
```

Invokes: `game-code-reviewer`, `game-qa-tester`, `leaderboard-validator`

---

### `/game-hotfix`

Emergency fixes with enhanced safety guardrails.

```bash
/game-hotfix <game-slug> [--issue <number> | --description "<bug>"] [--dry-run]
```

Features: Minimal change principle, extra confirmations, automatic rollback prep.

---

### `/game-rollback`

Revert recent game deployments.

```bash
/game-rollback <game-slug> [--to <commit> | --pr <number>] [--dry-run]
```

Features: Creates backup before rollback, generates rollback PR, preserves history.

---

### `/game-clone`

Clone existing game as template.

```bash
/game-clone <source-game> <new-slug> [--strip-content | --keep-scores]
```

Modes: Standard clone, template (stripped), A/B test (shared leaderboard).

---

### `/game-retire`

Safely sunset games without breaking links.

```bash
/game-retire <game-slug> [--archive | --hide | --redirect <new-game>] [--dry-run]
```

Options: Archive (keep playable), Hide (show message), Redirect (to replacement).

---

### `/workflow-status`

View orchestrator run history.

```bash
/workflow-status [<id> | --running | --failed | --completed]
```

Shows: Phase progress, duration, metrics, artifacts, error logs.

---

### `/game-analytics`

View game performance metrics.

```bash
/game-analytics <game-slug> [--period <7d|30d|90d>] [--compare <other>]
```

Shows: Plays, players, scores, retention, engagement trends.

---

## Safety Guardrails

All commands enforce safety rules:

| Category | Behavior |
|----------|----------|
| Database ops | BLOCKED |
| Force push | BLOCKED |
| Modify existing games | BLOCKED |
| Modify shared code | BLOCKED |
| Delete outside game folder | CONFIRM |
| Modify integration files | CONFIRM |
| Git push | CONFIRM |
| Merge PR | CONFIRM |
| Create in new game folder | SAFE |
| Read operations | SAFE |
| Build/test | SAFE |

---

## Skills

### Context
- `/game-design:game-context` - **NEW** Run first: decides Weekly Arcade vs standalone and which platform rules apply
- `/game-design:game-architecture` - **NEW** Standing rule: every game is modular code (one module per concern; core, systems, world, UI, meta, audio, input, platform layers; data-driven config; no god files), in each engine's own idiom
- `/game-design:game-toolchain` - **NEW** Needed vs available tools for the engine and targets, checked with real commands; installs only with permission

### Design Skills
- `/game-design:game-design-prd` - Create complete PRDs
- `/game-design:game-trend-scout` - Research trending games
- `/game-design:add-new-game` - Integrate games into monorepo (spawns `add-game-orchestrator` agent with 6 sub-agents)

### Knowledge Skills (auto-applied)
- `/game-design:level-design` - **NEW** Zone layout, camera perspective, NPC pathfinding, spatial progression
- `/game-design:game-theory` - **NEW** Flow theory, player psychology, cognitive load, motivation
- `/game-design:economy-design` - **NEW** Currency systems, upgrade pricing, faucets/sinks, inflation
- `/game-design:mobile-game-ux` - Mobile UX patterns, touch targets, gesture controls
- `/game-design:animation-patterns` - Animation best practices, CSS/JS patterns
- `/game-design:sound-design` - Web Audio API implementation, procedural audio
- `/game-design:performance-tuning` - 60fps optimization, memory management
- `/game-design:game-balancing` - Difficulty curves, scoring formulas, XP progression
- `/game-design:css-game-art` - **NEW** CSS-only characters, environments, effects, color palettes
- `/game-design:playtesting` - **NEW** Three-pass testing, feel checklist, iteration prioritization
- `/game-design:game-accessibility` - **NEW** Color contrast, reduced motion, cognitive load, inclusive design
- `/game-design:post-launch` - **NEW** Improvement funnel, signal detection, what to fix/add/cut
- `/game-design:orchestrator-guardrails` - Safety rules for automated workflows
- `/game-design:godot` - **NEW** Godot 4 the editor's way: official docs as source of truth, GDScript style guide, headless scene building, validation loop, native iOS / Android export, web export
- `/game-design:character-pipeline` - **NEW** Stylised 3D characters end to end (anime / toon, low-poly, web budget): concept turnarounds, Meshy credit gate, Blender cleanup, shared skeleton with fingers, face and heel / toe, procedural hands, region-id palette, shared clips and the clip ceiling, checks with broken-copy proofs, byte-identical rebuilds, review page, anime face rule; Godot 4 engine side (other engines later)

---

## Agents

| Agent | Purpose | Output |
|-------|---------|--------|
| `game-code-reviewer` | Code quality analysis | Score /30 + issues |
| `game-qa-tester` | Bug and UX testing | Bug reports by severity |
| `game-visual-tester` | Screenshot-based visual QA via Chrome DevTools | Visual bug reports |
| `game-accessibility-auditor` | **NEW** Lighthouse + manual a11y audit | Score /65 + issues |
| `game-economy-validator` | **NEW** Economy math, pricing, dead zones | Balance report + tuning recs |
| `leaderboard-validator` | Security validation | Risk assessment |
| `weekly-release-orchestrator` | Workflow orchestration | Release artifacts |
| `game-release-orchestrator` | **NEW** Standalone game release orchestration (opus): repo setup, toolchain, gates in parallel subagents, engine-native builds, PR, tag, release | Release artifacts + store checklist |
| `godot-developer` | **NEW** Builds and fixes Godot 4 games via headless builders / MCP, validated headless and in a browser | Change report + validation output |

---

## MCP server

The plugin bundles one MCP server in `.mcp.json`: `godot`, running
[godot-mcp-runtime](https://github.com/Erodenn/godot-mcp-runtime) 3.8.1 via `npx`. Launching a
project (`run_project`) asks for confirmation in a Claude Code dialog once per project per session;
`run_script` hard-blocks process execution and dynamic code and asks before file, network and
save calls. Strict mode is off by default because it refuses to launch any game whose autoloads or
main scene touch files (a save system is enough); `export GODOT_MCP_STRICT=true` before starting
Claude Code turns it on. It needs Node 20+ and a Godot 4 binary: `brew install --cask godot` on macOS, or
`export GODOT_PATH=/path/to/Godot` before starting Claude Code. Without Godot the server still
starts and only the Godot-dependent tools error. Toggle it off in `/mcp` if unused.

---

## Installation

```bash
# Via marketplace
/plugin marketplace add HimanshuSingh2308/claude-code-plugins
/plugin install game-design@hplugins

# Or local development
claude --plugin-dir ./game-design
```

---

## Usage Examples

### Full Release Workflow
```bash
/weekly-game-release               # Execute (default)
/weekly-game-release --dry-run     # Preview the plan, change nothing
/weekly-game-release --resume <id> # Resume failed
```

### Game Operations
```bash
/game-status --all                 # Check all games
/game-audit emoji-match            # Full audit
/game-hotfix word-stack --issue 42 # Emergency fix
/game-rollback puzzle-rush         # Revert release
```

### Game Lifecycle
```bash
/game-clone emoji-match emoji-v2   # Create variation
/game-retire old-game --archive    # Sunset game
```

### Analytics
```bash
/game-analytics emoji-match --period 30d
/game-analytics all --period 7d
```

---

## Output Locations

| Artifact | Location |
|----------|----------|
| Scout Reports | `~/Documents/weekly-games/{topic}-scout-{month}-{year}.md` |
| PRD Documents | `~/Documents/weekly-games/{game-slug}-prd.md` |
| Release Notes | `~/Documents/weekly-games/releases/{slug}-release-notes.md` |
| Workflow State | `~/Documents/weekly-games/workflows/{id}.json` |
| Standalone Release State | `~/Documents/game-releases/workflows/{id}.json` |
| Standalone Artifacts (PRD, release notes, store checklist) | `~/Documents/game-releases/{slug}/` |
| Audit Reports | `~/Documents/weekly-games/audits/{slug}-audit-{date}.md` |
| Hotfix Logs | `~/Documents/weekly-games/hotfixes/` |
| Rollback Records | `~/Documents/weekly-games/rollbacks/` |
| Retired Games | `~/Documents/weekly-games/retired/{slug}/` |

---

## Version History

### v2.37.0
- Added `character-pipeline` skill (+6 references: concepts and Meshy, Blender build, animation library, checks and review, faces and feedback, Godot) - the route that built The Long Way to Success #113 characters and the traps hit there; gates: Meshy estimate and approval per batch, user approves every look from renders before push, gates only tighten, every check has a broken-copy proof, byte-identical rebuilds, angular anime faces with user-granted exceptions

### v2.36.0
- Added `godot` skill - Godot 4 development with the Godot editor and docs.godotengine.org (stable, 4.7.x) as the source of truth, no house conventions on top
  - Version and renderer detection, project layout and file conventions (.uid, .import, .godot/), scene architecture, official GDScript style guide and static typing
  - Headless scene and resource building (SceneTree builders, PackedScene.pack, owner, ResourceSaver), CLI validation loop, GUT / gdUnit4, native Android / iOS export as the mobile route for standalone games, web export (Compatibility, single-threaded; Capacitor WebView for WA games only)
  - References: Godot 3 to 4 rename table, headless builder and CI script, web export, mobile export, testing, editor plugins
- Added `godot-developer` agent (opus) - detects version, plans in scenes/nodes/resources/signals, implements headless, validates before reporting
- Added bundled `godot` MCP server (`.mcp.json`, godot-mcp-runtime@3.8.1, strict mode)
- Added `game-context` skill - Weekly Arcade or standalone check, run first by every agent, command and skill
  - Resolution: `.claude/game-context.json` override, the user's words, detection signals (git remote, registry / games json, project.godot, own repo), else ask once
  - Every agent, command and skill now has one "Step 0: Game context" block (WA-only, mixed or generic variant); WA-specific steps in mixed and generic files are marked "(WA only)"
  - Orchestrators (add-game-orchestrator, weekly-release-orchestrator, add-new-game, weekly-game-release, game-audit, game-design, fix-game-bug) pass the resolved context to every sub-agent
- Added `/game-release` command and `game-release-orchestrator` agent (opus) - the weekly release workflow for standalone games
  - Phase 0 repository setup (connect, clone or create with a confirmed owner / name / visibility / account; tokens never written anywhere), Phase 0.5 toolchain check
  - `--new` mode (concept, PRD, Claude Design mockups, engine choice, official per-engine skeleton with AGENTS.md + CLAUDE.md, build, environment art) and version mode (changelog, engine-native version bump)
  - Shared gates with weekly thresholds, run in parallel subagents; Godot headless validation + GUT / gdUnit4; engine-native exports (Godot native AAB / IPA, not Capacitor)
  - PR in the game's own repo, `--merge` for merge + tag + GitHub release, store-submission checklist, never a store upload or production deploy without confirmation at that moment
- Added `game-toolchain` skill - needed vs available table from real commands, install only after permission; wired into both release workflows and the build, art, visual-test and fix agents
- Added `game-architecture` skill - modular code as a non-negotiable for every game, layers, dependency direction, event bus / signals, about 400-line god-file threshold, per-engine mapping (Godot, Phaser, Babylon.js, vanilla); wired into game-builder, game-code-reviewer (scored, gate findings), game-bug-fixer, game-environment-artist, product-designer, game-design-prd, the orchestrators and both release commands
- New Weekly Arcade games are authored as ES modules in `apps/web-astro/game-src/{id}/` (`main.js` entry, one module per concern, shared services through a `platform/` adapter) and bundled by `scripts/build-games.mjs` into the generated, committed IIFE `public/games/{id}/game.js` (`--check` in CI); existing games keep their current structure; single-IIFE fallback while the build script is absent (add-new-game, game-architecture, astro-pro, game-builder, game-integration-checker, game-code-reviewer, game-bug-fixer, the orchestrators, weekly-game-release, fix-game-bug, state-sweep, multiplayer-testing, phaser)
- Creative tooling rule in both release workflows: Claude Design mockups before build (never skipped silently), Nano Banana Pro for 2D, Meshy AI for 3D models, Blender MCP for cleanup and export, cost estimate and approval for credit-spending calls
- `generative-tooling.md`, `game-environment-art`, `game-environment-artist`, `weekly-release-orchestrator`: Meshy AI is now documented as available via its API (was "not configured")
- `orchestrator-guardrails` and `/workflow-status` are now mixed: standalone release rules and `/game-release` runs alongside the Weekly Arcade ones
- Themed game UI (non-negotiable) rule in the design phase of `/weekly-game-release` and `/game-release` and their orchestrators: every menu, HUD, button, pop-up and panel is a themed object from the game's world, never flat web UI; carried into the build brief, code review and visual QA (`game-builder`, `game-visual-tester` point to it)
- Run mode: every workflow command executes by default and `--dry-run` is the one preview flag (full plan, nothing changed); `/game-release` flipped from a dry-run default and the separate execute flag is gone; per-step confirmations (repo creation, installs, credit spend, store uploads, production deploys, merge) still ask at that moment

### v2.26.0
- Fixed workflow state persistence: orchestrator now writes state to disk after **every phase transition**, not just at completion
  - Added explicit INIT phase that creates `workflows/{id}.json` immediately on start
  - Added `PERSIST state` step after scout, design, build, fix_loop, deferred_issues, visual_qa, security, and pr phases
  - Failed/aborted workflows also persist state before exiting
  - Enables `--resume` and `/workflow-status --running` to work reliably

### v2.25.0
- Added `phaser` skill — Phaser 3 game development patterns for complex 2D browser games
  - Scene management, sprites, Arcade/Matter physics, tilemaps, particles, tweens
  - Weekly Arcade integration patterns (auth, leaderboard, cloud state)
  - Game type templates (platformer, tower defense, RPG, endless runner)
  - Performance checklist + anti-patterns
  - CDN setup for Astro (no build step needed)
- Added `phaser` to PRD "Related Skills" under "Complex 2D Games (conditional)"
- Recommended stack: Vanilla Canvas (simple) → Phaser (complex 2D) → Babylon.js (3D)

### v2.24.0
- Document dynamic game count system (import.meta.glob auto-counts)
- Updated game-landing-updater, game-integration-checker, add-new-game skill

### v2.17.0
- Foundation skills audit fixes:
  - Added 7 missing skills to PRD "Related Skills" (sound-design, animation-patterns, css-game-art, mobile-game-ux, game-accessibility, post-launch, babylonjs-3d) — organized by phase
  - Added checklist + anti-patterns to `babylonjs-3d` (PRD/build checklists, performance budget, 8 anti-patterns from Chess 3D learnings)
  - Added checklist + anti-patterns to `animation-patterns` (PRD/build checklists, 6 anti-patterns)
  - Added `economy-design` + `level-design` to game-audit knowledge references
- Expanded `sound-design` skill (261→520 lines): background music loops, audio ducking/mixing, spatial audio for 3D, design checklist, 10 anti-patterns
- Added multiplayer skills: `multiplayer-architecture`, `multiplayer-testing`, `websocket-realtime`

### v2.16.0
- Added `product-designer` agent — web research, competitive analysis, and data-driven PRD creation/updates
- Added `/game-design` command — create, update, review, or research PRDs via the product-designer agent
- Updated `weekly-release-orchestrator` Phase 2 to use product-designer agent (research-backed PRDs)
- Updated `game-landing-updater` agent to handle Astro landing page hero section (7 changes) in addition to legacy (6 changes)
- Updated `add-new-game` skill with Astro hero section checklist

### v2.15.0
- Player psychology additions across 4 skills (+340 lines):
  - `game-theory`: Hook Model (habit formation), Emotional Arc Design
  - `game-design-prd`: Onboarding Psychology (first 30 seconds, aha moment, tutorial blindness)
  - `post-launch`: Retention Psychology (D1/D7/D30, streaks, comeback rewards, notification timing)
  - `css-game-art`: Color Psychology (feedback colors, mood palettes, contrast, tier progression)

### v2.14.0
- Model optimization: all 13 agents now have explicit `model:` frontmatter (opus for orchestrators/builders, sonnet for reviewers/checkers, haiku for extractors/simple tasks)
- Converted `add-new-game` from monolithic skill to agent architecture with 6 specialized sub-agents:
  - `add-game-orchestrator` (sonnet), `game-prd-extractor` (haiku), `game-builder` (opus), `game-landing-updater` (sonnet), `game-registry-updater` (sonnet), `game-seo-updater` (haiku), `game-integration-checker` (sonnet)
- Original `add-new-game` skill retained as reference material for sub-agents

### v2.13.0
- Added `astro-pro` skill — Astro framework knowledge for browser game development
- Updated `add-new-game` skill with Astro-first game creation workflow
- Astro covers: island architecture, GameLayout, content collections, Firebase deployment, PWA, multiplayer compatibility

### v2.1.0
- Added `/game-status` - Health monitoring
- Added `/game-audit` - Comprehensive quality audits
- Added `/game-hotfix` - Emergency fixes with safety
- Added `/game-rollback` - Deployment recovery
- Added `/game-clone` - Game templating
- Added `/game-retire` - Game lifecycle management
- Added `/workflow-status` - Orchestrator history
- Added `/game-analytics` - Performance metrics

### v2.0.0
- Added `/weekly-game-release` autonomous orchestrator
- Added `orchestrator-guardrails` skill
- Added `weekly-release-orchestrator` agent
- Added safety guardrails system
- Added dry-run mode
- Added workflow state persistence and resume

### v1.1.0
- Added `leaderboard-validator` agent
- Added knowledge skills (mobile-ux, animations, sound, performance)

### v1.0.0
- Initial release with core skills and agents

---

## License

MIT
