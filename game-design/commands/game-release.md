---
description: Release workflow for standalone games (own repo, own build) - sets up or connects the game's repository, then either designs and builds a new game or ships a new version of an existing one, runs the quality gates, builds engine-native targets, opens a PR, tags a GitHub release and writes a store-submission checklist
argument-hint: '[--dry-run | --resume <id>] [--new --concept "<idea>" | --scout] [--repo <path|url> | --create-repo | --path <dir>] [--engine <vanilla|phaser|babylon|godot>] [--targets web,android,ios,desktop] [--version <x.y.z>] [--merge]'
---

# Game Release (standalone games)

Execute the release workflow for a standalone game: a game with its own repo, brand, build and
deploy. This is the counterpart of `/weekly-game-release`, with every Weekly Arcade part swapped
for the game's own repo, engine and targets.

**Arguments**: $ARGUMENTS

## Step 0: Game context

Requires a standalone game. Load `game-context` first; if the result is Weekly Arcade, stop and tell the user this command is for standalone games and Weekly Arcade releases go through `/weekly-game-release`.

**Pass the context down.** Every agent this command spawns (directly or through `game-release-orchestrator`) receives the resolved `Context: standalone game <name> at <path>` line at the top of its dispatch prompt, so no sub-agent re-resolves or re-asks. In `--new` mode the context is resolved for the game's repo path (from Phase 0), not the current directory; a new game counts as standalone because it is being created through this workflow. Before the name is known use `Context: standalone game (new, name pending) at <path>`. If the repo path is inside the Weekly Arcade monorepo (git remote or directory name contains `weekly-arcade`, or `apps/web-astro` plus `packages/shared` exist above it), stop: a standalone game never lives there.

**Modular code is a standing rule** (`game-architecture` skill): the skeleton creates the module layout for the chosen engine per its official practices, builders and fixers keep it, and the code review gate scores it (god files and game logic inside UI are HIGH findings).

## Overview

| Component | Type | Purpose |
|-----------|------|---------|
| `game-release-orchestrator` | Agent | State machine for this workflow (runs every phase below) |
| `orchestrator-guardrails` | Skill | BLOCKED / CONFIRM / SAFE rules, standalone section |
| `game-toolchain` | Skill | Needed vs available tools, installs only after a yes (Phase 0.5) |
| `game-trend-scout` | Skill | Optional concept research (`--scout`) |
| `product-designer` | Agent | Web research + competitive analysis + PRD (`--new`) |
| `game-design-prd` | Skill | PRD template (used by product-designer) |
| Claude Design MCP | External | Visual design pass (Phase 2.5), only if connected |
| `godot` | Skill | Godot skeleton, validation loop, GUT / gdUnit4, native export |
| `babylonjs-3d` / `phaser` | Skill | Engine rules for web 3D / complex 2D |
| `godot-developer` | Agent | Builds, fixes and exports Godot games |
| `game-builder` | Agent | Builds web-engine games (standalone mode: the game's own repo conventions) |
| `game-environment-artist` | Agent | Environment art pass on a new game (Phase 3.5) |
| `game-code-reviewer` | Agent | Code quality score (target 20/30) |
| `game-qa-tester` | Agent | Bug detection |
| `game-visual-tester` | Agent | Screenshot visual QA (web targets) |
| `state-sweep` | Skill | Long-run leak sweep (web); Godot uses the monitor variant below |
| `game-accessibility-auditor` | Agent | Accessibility score (target 45/65+) |
| `game-economy-validator` | Agent | Only if the game has an economy |
| `leaderboard-validator` | Agent | Only if the game has its own leaderboard / backend |
| `performance-tuning` | Knowledge | Frame and asset budgets |
| `playtesting` / `post-launch` | Knowledge | Self-playtest, monitoring plan |
| `game-bug-fixer` | Agent | Fixes for web-engine findings (Godot fixes go to `godot-developer`) |
| `game-environment-art` | Skill | Asset rules, generative tooling, Blender pipeline, licensing |
| `nano-banana` | Skill | Nano Banana Pro 2D images, textures, UI art, icons, key art |
| Meshy AI / Blender MCP | External | 3D model generation (credits, approval first) / cleanup and GLB export |
| GitHub CLI (`gh`) | External | Repo creation, PRs, issues, tags, releases |

Not used here (Weekly Arcade only): `add-game-orchestrator`, `game-prd-extractor`,
`game-landing-updater`, `game-registry-updater`, `game-seo-updater`, `game-integration-checker`,
`backend-contract`, `astro-pro`.

## Command Options

```
/game-release [options]

Run control:
  (no flag)                  Execute the workflow (DEFAULT)
  --dry-run                  Show the full plan and change nothing: phases, parallel
                             groups, the questions it will ask, toolchain status, and
                             what would be created or changed
  --resume <id>              Resume a workflow from its last completed phase
  --verbose                  Show detailed progress logs

Repository (Phase 0):
  --repo <path|url>          Existing repo: a local path, or a remote URL to clone
  --create-repo              Skip the "is there a repository?" question and create one
  --path <dir>               Local folder for the repo (new repo: parent or target folder)
  --owner <user|org>         GitHub owner for a new repo
  --visibility <private|public>   New repo visibility (default: private)
  --gh-account <login>       gh account to use for this workflow (gh auth switch)
  --token-env <ENV_NAME>     Env var holding the GitHub token to use (name only, never a value)

Mode:
  --new                      Create a new standalone game (concept -> PRD -> build -> ship)
  (no --new)                 Release a new version of the existing game in the repo
  --concept "<idea>"         Concept for --new (skips the concept question)
  --scout                    Run game-trend-scout to pick the concept (--new only)
  --engine <name>            vanilla | phaser | babylon | godot (skips the engine question)
  --targets <list>           Any of web,android,ios,desktop (default: see Phase 2.7 / R1)
  --version <x.y.z>          Version to release (default: bump proposed from the changelog;
                             0.1.0 for --new)

Ship:
  --merge                    Merge the PR after CI and confirmation, then tag + release
                             (default: stop at the open PR)
  --skip-gates <list>        Skip named gates; REQUIRES --reason "<why>"
  --reason "<why>"           Reason recorded for --skip-gates (state, PR body, release notes)
```

Skippable gates: `visual-design`, `env-art`, `review`, `visual`, `qa`, `sweep`, `security`,
`economy`, `a11y`, `perf`. Never skippable: `preflight`, `repo-setup`, `toolchain`, `engine-validate`,
`build-recheck`, `target-builds`. A skipped gate is listed in the PR body and the release notes.

**Run mode.** The workflow executes by default. `--dry-run` prints the full plan (see Dry Run
Output) and changes nothing. Executing by default does not remove any safety step: each of
these still asks at the moment it happens, in every mode: creating a GitHub repo, pushing,
installing a tool, spending Meshy or image-generation credits, adding a native export target,
tagging and publishing a GitHub release, any store upload, any production deploy, and merging
(only with `--merge`, and still confirmed).

## Usage Examples

```
/game-release --new --dry-run                                  # preview a new game
/game-release --new --concept "Lantern ferry puzzle"           # build a new game
/game-release --new --scout --engine godot --targets android,ios --path ~/Documents
/game-release --dry-run                                        # preview next version of this repo
/game-release --version 1.4.0 --targets web,android            # ship 1.4.0
/game-release --resume gr-2026-10-14-101500 --merge            # merge, tag and release
```

## Creative Tooling (mockups and asset generation)

**Mockups come before the build.** The visual design phase uses the Claude Design MCP
(`mcp__claude-design__*`): read its design skill and prompt, pick the design system, create the
project, build a mockup for every screen, render every screen at every breakpoint, finalize. If
the claude-design MCP is not connected, say so and ask the user to run `/design-login` and retry,
or to approve skipping the phase; never skip it silently. A skip is recorded with the user's
approval in workflow state and the PR body.

**Asset generation.** The rules, costs, cleanup pipeline and licensing live in the
`game-environment-art` skill and its `references/generative-tooling.md` and
`references/blender-pipeline.md`; follow them, do not restate them. In short:

| Asset | Tool | Notes |
|-------|------|-------|
| 2D images, textures, UI art, icons, key art, reference boards | Nano Banana Pro via the `nano-banana` skill (gemini CLI) | No text baked into images; style-lock per the reference |
| 3D models | Meshy AI (`meshy-7`) via its API (`~/meshy-eval`) | Verify the key is present without printing it; never copy it into a repo |
| 3D cleanup, retopology / decimation, rig and animation retargeting, export | Blender via the `blender` MCP (live tools need GUI Blender; `*_for_cli` variants run background Blender) | glTF / GLB for web engines; `.glb` (or `.blend`) import for Godot |
| Anything else | Name the tool and get user approval before using it | |

- Procedural code and CC0 libraries come first when they fit (preference order in the skill).
- **Every credit-spending call** (Meshy, image generation) gets a cost estimate first (number of
  generations and credits) and user approval before it runs.
- **Every asset gets a license record** (source, prompt or URL, date, license). Meshy free tier is
  CC BY 4.0 and needs attribution; paid plans are private.

---

## Execution Model (subagents, maximum parallelism)

**Every phase's real work runs in a subagent (Agent tool), never inline in the main session.**
The main session and `game-release-orchestrator` only ask the user questions, dispatch agents,
read short handoff reports, update the state file and decide the next step. Bulky output (test
runs, exports, gate logs, screenshots) stays inside the subagent; it returns a short report.

**Parallelize everything independent:** send all independent Agent calls in ONE message so they
run concurrently. Run sequentially only where data truly depends on the previous step.

```
Pre-flight: git || gh account listing
        |
Phase 0  Repo setup (asks the user; sequential)
        |
Phase 0.5 toolchain check (probes per area in parallel; installs only after a yes)
        |
--new:   [ trend scout || competitor scan ] -> PRD -> visual design -> engine choice
         -> skeleton (+ validation) -> build -> env art
version: [ read repo || changelog draft ] -> version bump
        |
Phase 4  engine validation
        |
Gates, ALL AT ONCE (read-only):
  code review || QA || visual test (web) || accessibility || economy (if any)
  || state sweep || performance budget || security (if backend)
        |
Fix loop: merged fix list -> ONE builder (game-builder / godot-developer)
          -> re-run ONLY the failed gates, again in parallel (max 3 rounds)
        |
Phase 9.7 build re-check
        |
[ export web || export android || export ios || export desktop ]
  || [ release notes + changelog section ] || [ store checklist ]
        |
PR -> (merge) -> tag + GitHub release -> post-release
```

| Group | Runs in parallel | Waits for |
|-------|------------------|-----------|
| Pre-flight | git, gh account listing | nothing |
| Toolchain (0.5) | probes per area (engine, android, ios, web, creative, MCP) | Phase 0 |
| Research (`--new`) | trend scout, competitor scan | concept question answered |
| Repo read (version) | repo / target detection, changelog draft | Phase 0 |
| Gates | review, QA, visual (web), a11y, economy, state sweep, perf, security | engine validation |
| Re-gates | only the gates that failed | the single fix pass |
| Ship prep | one export agent per target, release notes, store checklist | build re-check |

**Fix loop.** Findings from all parallel gates are merged and deduplicated into one fix list and
dispatched to one builder (`game-builder` for web engines, `godot-developer` for Godot); then only
the failed gates re-run, in parallel. Never two fixers on the same files at once.

**Subagent briefs.** Every dispatch includes the resolved `Context:` line, the repo path, the
exact deliverable, the files it may touch, and the short-report format (verdict, numbers, findings
by severity, files changed, under about 30 lines). Any subagent that starts a long process
(export, Gradle, emulator, xcodebuild, a test suite) waits inside its own turn with a blocking
poll, for example `until ! ps -p <pid> >/dev/null 2>&1; do sleep 15; done`, and never ends its
turn "waiting for a notification".

**Models.** Do not set `model` on dispatches unless the user names one; the project's model
routing decides, and agent definitions keep their own `model` frontmatter.

**No file conflicts.** Parallel agents get disjoint files or directories (each export agent writes
only `build/<target>/`); gates are read-only; conflicting work runs sequentially.

---

## Workflow Execution

### Pre-Flight Checks (minimal)

Run before Phase 0: `git --version`, `gh --version`, `gh auth status` (account names and scopes
only). Everything else is checked by the `game-toolchain` skill in Phase 0.5, once the repo,
engine and targets are known. Repository checks run at the end of Phase 0.

### Phase 0: Repository Setup (every mode, always first)

**The workflow first settles where the game lives.** Nothing is designed or built until the repo
exists, is a git repo with a remote, and the account to use is chosen.

```yaml
0a. Is there a repository?
  Skip the question when:
    - --repo or --path points at an existing git repo, or --create-repo is given, or
    - the current directory is clearly the game's repo AND game-context resolved it
      (version mode normally resolves here)
  Otherwise ask: "Is there already a repository for this game?"

  YES:
    - Get a local path or a remote URL (--repo).
    - Remote only: ask where to clone (default ~/Documents/<repo-name>), then clone.
    - Verify: `git rev-parse --is-inside-work-tree`, `git remote get-url origin` exists.
    - Not inside the Weekly Arcade monorepo (else stop, point to /weekly-game-release).

  NO (create):
    - Ask: local parent folder (default ~/Documents/<game-slug>), GitHub owner (user or
      org, --owner), repo name (default the game slug), visibility (default private).
      In --new mode the slug may still be pending: default from --concept, else ask for
      a working name.
    - 0b. Account / token: list what is available WITHOUT printing any secret value:
        * accounts from `gh auth status` (logins only)
        * env vars whose NAMES look like GitHub tokens: GH_TOKEN, GITHUB_TOKEN, and any
          *_GITHUB_PAT / *_GH_TOKEN (check `env | cut -d= -f1`; never echo values)
      Use the choice only for this workflow's gh / git calls: `gh auth switch -u <login>`,
      or a per-command `GH_TOKEN="$<ENV_NAME>" gh ...` prefix. Never write a token into
      files, git config, remote URLs, logs or the state file. State records only the
      login or the env var NAME (repoSetup.account).
    - 0c. CONFIRM (outward-facing): show local path, owner/name, visibility, account.
      Only on yes:
        gh repo create <owner>/<name> --private|--public
        git init -b main <local path>
        git -C <local path> remote add origin https://github.com/<owner>/<name>.git
    - 0d. Skeleton (see "Skeleton per engine"). Runs here when the engine is already
      known (--engine; version mode on an existing repo never needs it), AFTER the
      Phase 0.5 toolchain check. In --new mode without --engine, the empty repo is
      created and connected here, and the skeleton runs as Phase 3, immediately after
      the engine is chosen in Phase 2.7 (with a second toolchain check for that engine).
    - Initial commit on main ("chore: initial skeleton"), CONFIRM push to origin main.

  Then: all further work happens on a feature branch
    --new:        feature/initial-release
    version mode: release/v<x.y.z>

Repository checks (after 0a, before any later phase):
  - git status --porcelain is empty            (clean tree)
  - on a branch, not detached HEAD
  - origin exists and `git fetch` succeeds; base branch up to date with origin
  - no existing tag v<x.y.z>; no open PR titled "release: v<x.y.z>"
  - build health on the base branch (Godot: headless import + smoke; web: install + build);
    a newly created empty repo skips this until its skeleton has passed validation
```

### Phase 0.5: Toolchain Check (gate)

Load the `game-toolchain` skill and dispatch it with the context, engine (if known) and targets.
It builds the "needed vs available" table from real commands (git, gh + account with `repo`
scope, node / npm, Godot binary + exact export templates, JDK 17 + Android SDK + keystore, Xcode +
signing identity + simulator, test runners, claude-design MCP, nano-banana + gemini, Meshy key
present, Blender + `blender` MCP, godot / chrome-devtools / playwright MCP as relevant). Missing
items: what it is for, the exact install command (arm64 Homebrew at `/opt/homebrew`), size or
cost, and an install only after the user says yes, then re-verify. Runs before any skeleton
validation; in `--new` mode without `--engine` it runs again for the chosen engine and targets
right after Phase 2.7. A declined, needed item drops that target (with the user's agreement) or
stops the workflow.

Signing material missing for a selected target (Android release keystore, iOS team / profiles)
is a WARN in `--dry-run` and a FAIL in execute mode (the default). Desktop for a web engine without an
existing Electron / Tauri shell is dropped with a warning.

### Skeleton per engine (Phase 0d or Phase 3)

**Rule:** the skeleton follows the chosen engine's OWN official best practices, never a generic or
Weekly Arcade layout. Prefer the engine's official scaffolder or template when one exists;
otherwise use the project layout from the engine's official docs. Before scaffolding, check the
current official docs or template (WebFetch the docs page, `npm view <template> version`) instead
of relying on memory, and record the source URL and template version in state
(`skeleton.source`, `skeleton.templateVersion`) and in the repo README.

| Engine | Source of truth | Skeleton | AGENTS.md links / CLAUDE.md loads | Built by |
|--------|-----------------|----------|-----------------------------------|----------|
| Godot 4 | `godot` skill + docs.godotengine.org (stable) | `project.godot` created headlessly per the skill's headless-scene-builder reference; main scene; snake_case folders in the official project organization; official Godot `.gitignore`; `.uid` / `.import` sidecars committed; `export_presets.cfg` with presets only for the chosen targets (no secrets; credentials stay in `.godot/export_credentials.cfg`); GUT or gdUnit4 addon with one passing smoke test | docs.godotengine.org (stable) / `godot` skill + `godot-developer` | `godot-developer` |
| Babylon.js | `babylonjs-3d` skill + Babylon's official docs | ES module packages (`@babylonjs/core` and only the other `@babylonjs/*` packages needed) with tree-shaking, and the bundler setup the Babylon docs currently recommend (for example Vite). Not the Weekly Arcade Astro integration | doc.babylonjs.com / `babylonjs-3d` skill | `game-builder` |
| Phaser 3 | `phaser` skill + Phaser's official scaffolder | `npm create @phaserjs/game@latest`, picking the template that matches the chosen bundler / framework | docs.phaser.io / `phaser` skill | `game-builder` |
| Vanilla canvas / other web | Vite official templates | `npm create vite@latest -- --template vanilla` (or `vanilla-ts`) | vite.dev / `performance-tuning`, `css-game-art` | `game-builder` |
| Anything else the user names (Three.js, PixiJS, Defold, Unity, ...) | That engine's official template or documented structure | As documented. If no official guidance exists, tell the user and propose a layout for approval; never invent one silently | that engine's docs / the closest engine skill, if any | engine-appropriate agent, or the orchestrator with user approval |

The skeleton also lays out the module structure from the `game-architecture` skill in the
engine's own idiom (Godot: scenes and scripts per component, Resources for data, an event-bus
autoload only if needed; Phaser: Scenes plus system modules; Babylon.js / vanilla: ES module
folders per layer), with empty or stub modules where the build will fill them.

Every skeleton also gets:
- `README.md` (game name, engine + version, targets, how to run / build / test, skeleton source
  URL and template version)
- `.gitignore`: the engine's official one (Godot official; Node for web engines)
- `.claude/game-context.json` = `{"platform":"standalone","game":"<name>"}`
- `AGENTS.md` and `CLAUDE.md` (below)
- `CHANGELOG.md` (Keep a Changelog layout, `## [Unreleased]`)
- `LICENSE` only if the user picks one; a CI workflow only if the user wants one

**The skeleton must pass that engine's own validation before the initial commit:** Godot: the
headless validation loop (import, check-only, smoke run, grep for errors) plus the smoke test;
web engines: `npm install`, `npm run build`, and a dev-server boot check (server starts, the page
returns 200 and the console has no errors). The commands that passed are the ones written into
AGENTS.md.

#### AGENTS.md and CLAUDE.md (generated with the skeleton)

Two files, split so nothing is written twice and drifts. Both are concise, specific to this repo,
imperative, and hold only what an agent cannot infer from the code; together under about 120
lines.

**`AGENTS.md`** (tool-neutral, the agents.md standard read by Codex, Cursor, Copilot, Gemini CLI
and others; no Claude-specific skill or agent names):

1. Project summary: game name, engine + version (from the scaffold), targets, and the line
   `Platform: standalone game (not Weekly Arcade); see .claude/game-context.json`.
2. Commands that actually work here, verified during skeleton validation: run / dev, build, test,
   lint / validate (Godot: the headless validation loop and the GUT / gdUnit4 command; web: the
   npm scripts), export per chosen target.
3. Engine conventions, linking the official docs instead of restating them. Godot: follow the
   Godot editor and docs.godotengine.org (stable), Godot 4 APIs only, never hand-invent uids.
   Babylon.js / Phaser / Vite: their official docs.
4. Project layout map: top-level folders and what goes where, matching the official layout used.
5. Workflow and release rules: branch per change, PRs into main, version bump locations, tag
   format `v<x.y.z>`, never upload to a store or deploy to production without explicit
   confirmation from the user.

**`CLAUDE.md`** (Claude-specific only). Its first line is `@AGENTS.md`: Claude Code expands
`@path` imports in CLAUDE.md, and when both files exist without the import it reads only
CLAUDE.md (verified: https://code.claude.com/docs/en/memory, sections "Import additional files"
and "AGENTS.md"). Then:

1. Skills and agents to load: `game-design:game-context` (already resolved by
   `.claude/game-context.json`), the engine skill (`game-design:godot`, `babylonjs-3d` or
   `phaser`), `godot-developer` for Godot work, `playtesting`, `performance-tuning`,
   `game-accessibility`, `sound-design`, and the gate agents.
2. Releases: `/game-release` (add `--dry-run` first to see the plan); `--merge` to tag and release.
3. Claude Code notes: run long exports and test suites with a blocking wait, never end a turn
   waiting on a background process.

Existing repos (version mode): never overwrite either file. Neither exists: offer to create both
(CONFIRM). Only one exists: propose the other plus the import wiring (`@AGENTS.md` at the top of
CLAUDE.md) in the PR description. Both exist: propose additions only.

---

### Mode A: `--new` (new standalone game)

#### Phase 1: Concept

```yaml
--concept "<idea>":   use it as given
--scout:              Skill game-trend-scout
                      Output: ~/Documents/game-releases/{topic}-scout-{month}-{year}.md
                      Selection: score >= 7.0 select; 6.5-6.9 select with warning;
                                 < 6.5 abort (same thresholds as the weekly workflow)
neither:              ask the user for a concept (one question)
```

#### Phase 2: Design (PRD)

```yaml
Agent: product-designer (Mode: create)
Prompt starts with: Context: standalone game (new, name pending) at <repo path>
Output: ~/Documents/game-releases/{game-slug}/prd.md  (copied to docs/PRD.md in the repo
        with the first build commit)
Validation:
  - All 14 PRD sections + Section 18 (Research & Competitive Analysis, 3+ competitors)
  - Core loop diagram, scoring system, target platforms section
  - Flags recorded in state: hasEconomy, hasLeaderboard/backend, is3D, targets wanted
  - No Weekly Arcade fields (registry, games json, coin shop) unless the user asked
```

#### Phase 2.5: Visual Design (gate when available)

Same as `/weekly-game-release` Phase 2.5 (screens, the four breakpoints 390x844, 844x390,
820x1180, 1440x900, tokens, contrast >= 4.5:1, touch targets >= 44px, `finalize_plan` before
build), with the game's own brand instead of Weekly Arcade's and no GameLanding screen unless the
game has its own landing page. 3D games and Godot games: design the UI and HUD only, with the
viewport as a flat placeholder; Godot implements the tokens as a Theme resource.

#### Themed game UI (non-negotiable)

Every menu, HUD, button, pop-up / modal, toast, card, tooltip, settings panel, results /
game-over screen, shop and leaderboard panel is designed as an object from the game's own world
(a laminated notice, a carved wooden sign, a neon arcade plate, a ship console), with material
texture, borders or frames, depth, wear, and themed button states (idle, hover, pressed,
disabled). Typography and iconography match the theme.

- Not acceptable: flat web UI (plain rounded rectangles, default system fonts, generic
  Bootstrap / Material-looking buttons and modals, browser-default controls).
- Claude Design mockups show every UI state in the themed style at every breakpoint.
- The visual tester and the code reviewer fail a screen that reads as web UI (HIGH finding).
- Readable and accessible first: contrast and touch targets per `mobile-game-ux` and
  `game-accessibility`. Theming never overrides legibility.
- Godot: build it as a Theme resource with StyleBoxTexture / NinePatchRect frames and per-state
  styles, not the default editor theme.

**If the Claude Design MCP is not connected, say so and ask the user** to run `/design-login`
and retry, or to approve skipping. Never skip silently. On an approved skip, record it in state
(`visualDesign.status = "skipped"`, reason, approval) and in the PR body; the builder then works
from the PRD and the `css-game-art` / engine skills. See "Creative Tooling".

#### Phase 2.7: Engine and Targets (gate: confirmed)

```yaml
Recommend from the PRD (record the rationale):
  vanilla canvas  simple 2D, web-first, small scope
  phaser          complex 2D: physics, tilemaps, many scenes, sprite animation
  babylon         3D in the browser
  godot           native mobile or desktop first, store release, heavier 2D/3D, or
                  any target where a web wrapper would be the weak link
Targets default: from the PRD platform section; else web for web engines,
                 android,ios for Godot.
Confirm engine + targets with the user unless --engine (and --targets) were given.
Web engine + android/ios without an existing Capacitor app: warn that mobile needs
  either Godot (native) or adding a Capacitor wrapper; adding Capacitor is a CONFIRM
  decision recorded in state, never a default.
```

#### Phase 3: Skeleton

Runs only if Phase 0 deferred it (no `--engine`). See "Skeleton per engine". Initial commit and
push to main, then branch `feature/initial-release`.

#### Phase 3.2: Build

```yaml
Godot:       Agent godot-developer (loads the godot skill)
Web engines: Agent game-builder, standalone mode: the game's own repo conventions,
             engine skill (phaser / babylonjs-3d), no WA header, registry, api-client,
             auth or Astro
Inputs: PRD, design dir + tokens (if Phase 2.5 ran), engine, targets, skeleton layout
Themed game UI: non-negotiable (Phase 2.5 rule), also when Phase 2.5 was skipped; every UI
             element is a themed game object with all button states, never flat web UI
Knowledge: performance-tuning, sound-design, animation-patterns, mobile-game-ux
           (responsive always; gestures / touch only if the PRD defines them), game-accessibility
Gate: the engine validation (Phase 4) passes on the build before Phase 3.5 starts.
Commit: "feat: initial game build"
```

#### Phase 3.5: Environment Art Pass (gate)

Same as `/weekly-game-release` Phase 3.5: `game-environment-artist`, the `game-environment-art`
skill, budgets measured before and after (draw calls < 50, triangles < 50k, materials < 8,
texture memory < 32 MB), 60 fps sustained at 60 s, four images, the 41-item checklist.
Godot: measured from a windowed run through the `Performance` monitors
(`RENDER_TOTAL_DRAW_CALLS_IN_FRAME`, `RENDER_TOTAL_PRIMITIVES_IN_FRAME`,
`RENDER_TEXTURE_MEM_USED`); a headless run uses the dummy renderer and reads zero, so it is not
evidence. New games only; version mode skips this phase.

---

### Mode B: default / `--version <x.y.z>` (new version of an existing game)

#### Phase R1: Read the Repo

```yaml
Detect: engine and version (project.godot config/features, package.json deps),
        existing targets (export_presets.cfg presets, capacitor.config.* + android/ ios/,
        web build script, Electron / Tauri), test setup, CI, CLAUDE.md presence
Flags:  hasEconomy (currency / upgrades in code), hasBackend (own API, leaderboard,
        cloud saves), hasCapacitor, webTarget
Targets default: exactly what the repo already ships; --targets narrows or extends
                 (extending to a target with no preset / wrapper is a CONFIRM)
```

#### Phase R2: Changelog

```yaml
- Last tag: git describe --tags --abbrev=0 (none: first release, base = root commit)
- Commits since: git log <last-tag>..HEAD --no-merges
- Group (conventional commits): Added / Changed / Fixed / Removed / Security
- Bump proposal: breaking -> major, feat -> minor, else patch; --version overrides
- Write the new section into CHANGELOG.md (create it if missing)
```

#### Phase R3: Version Bump (engine-native places, all of them)

```yaml
Branch: release/v<x.y.z>
Bump every place the repo actually uses, and no others:
  - package.json "version" (+ package-lock.json via `npm version <x.y.z> --no-git-tag-version`)
  - Godot project.godot  application/config/version="<x.y.z>"
  - Godot export_presets.cfg  Android version/name="<x.y.z>", version/code=<previous + 1>
                              iOS application/short_version="<x.y.z>",
                                  application/version="<build + 1>"
  - Capacitor (only if the game has its own): android/app/build.gradle versionName /
    versionCode (+1); ios/App/App.xcodeproj MARKETING_VERSION / CURRENT_PROJECT_VERSION (+1)
  - Any in-game version string the repo already displays
Rules: Android versionCode and iOS build number are monotonic integers, never reused,
       never reset. Record previous and new values in state.
Commit: "chore(release): v<x.y.z>"
```

---

### Shared gates (both modes; thresholds mirror the weekly workflow)

Phases 5 through 9.5 are numbered for reference, not order: after Phase 4 passes, every
applicable gate (review, QA, visual, state sweep, security, economy, accessibility,
performance) is dispatched in ONE message and runs concurrently, read-only. Their findings feed
one merged fix list (Phase 5 fix loop), and only the failed gates re-run.

#### Phase 4: Engine Validation (gate, not skippable)

```yaml
Godot (per the godot skill):
  - headless validation loop: --import, --check-only on changed scripts, smoke run
    --quit-after 120, grep logs for "ERROR" / "SCRIPT ERROR" / "Parse Error" (Godot exits 0
    on these, so the grep is the check)
  - GUT or gdUnit4 headless; "Nothing was run" or zero tests is a FAIL
  PASS: zero error lines, all tests pass
Web engines:
  - npm ci (or install), lint if configured, npm test if configured, npm run build
  PASS: build succeeds, tests pass
Fix with godot-developer (Godot) or game-bug-fixer (web); max 3 attempts, then abort.
```

#### Phase 5: Parallel Validation, Fix Loop, Deferred Issues

Same structure as the weekly workflow's Phases 4-6:

```yaml
Parallel (one message): game-code-reviewer, game-qa-tester,
                        game-visual-tester (web targets only: desktop 1920x1080,
                        iPhone 14 Pro, iPhone SE, Pixel 7, breakpoints 320-1920)
Fix loop: max 3 iterations
  PASS:       review >= 20/30 AND zero CRITICAL/HIGH (QA + visual)
  BORDERLINE: review >= 15/30 after 3 iterations, zero CRITICAL/HIGH -> proceed with warning
  ABORT:      otherwise
Deferred: MEDIUM/LOW -> GitHub issues in the game's own repo (labels bug|visual, severity,
          deferred), created in parallel
Visual pass criteria (web): zero CRITICAL, Lighthouse accessibility >= 70
Themed game UI: game-visual-tester (web) and game-code-reviewer (every engine) fail a screen
                that reads as web UI (HIGH), per the Phase 2.5 rule
Knowledge: playtesting self-playtest after CRITICAL/HIGH are fixed; feel issues -> MEDIUM issues
Version mode: QA and review focus on the diff since the last tag plus a full smoke playthrough.
```

#### Phase 6: State Sweep (gate)

```yaml
Web targets: Skill state-sweep, all four sub-phases, numbers in the PR body (same PASS rules
             as the weekly Phase 6.5: listeners and DOM flat across cycles 2..25 and 12 round
             trips, rafLive 0 on menus, no p50/p95 frame slope, audio gap non-trending, every
             pending timer attributed)
Godot:       the same four-phase shape driven through Performance monitors in a windowed run:
             OBJECT_COUNT, OBJECT_NODE_COUNT, OBJECT_ORPHAN_NODE_COUNT, MEMORY_STATIC,
             TIME_PROCESS flat across 25 scene cycles, 12 round trips and a 90 s+ sustained run
             (bucketed every 10 s); orphan nodes must be 0 after each cycle
No numbers, no pass.
```

#### Phase 7: Security (only if the game has its own leaderboard / backend)

`leaderboard-validator` on the game's own backend. HIGH risk: CONFIRM each fix, re-validate,
abort if still HIGH. MEDIUM: accepted risk in the PR body. No backend: recorded as not applicable.

#### Phase 8: Economy (only if the game has an economy)

`game-economy-validator` with the weekly checks (20-session projections, dead zones, payback
1.5-4 sessions, dominant upgrade, score spread 10-30x). Server-side config check only if the game
has its own backend. CRITICAL fix and re-validate; HIGH fix if straightforward; MEDIUM documented.

#### Phase 9: Accessibility (gate)

`game-accessibility-auditor`, target 45/65+. Web targets: Lighthouse accessibility 90+ target,
WCAG AA contrast, reduced motion, touch targets >= 44px, keyboard, ARIA, non-colour cues.
Godot native: the same checklist applied to Control nodes and project settings (contrast, a
reduced-motion setting, remappable input, touch target size, text scaling); Lighthouse only on a
web export. CRITICAL fix and re-audit; HIGH fix or issue; MEDIUM/LOW issues.

#### Phase 9.5: Performance Budget (gate)

Skill `performance-tuning`. Web: 60 fps desktop, 30+ fps mobile, Lighthouse performance recorded,
no long tasks on input. Godot: frame time from `Performance.TIME_PROCESS` on the slowest target
device class, budgets from Phase 3.5 (new games) or no regression against the previous release
(version mode). Record the numbers.

#### Phase 9.7: Build Re-Check (gate, not skippable)

The analogue of the weekly integration re-check: Phases 5-9.5 change code, so re-run Phase 4 in
full on the final commit, plus the version check (every bumped location agrees on `<x.y.z>`).

---

### Ship

#### Phase 10: Target Builds (engine-native)

```yaml
Godot (native, NOT Capacitor):
  mkdir -p build/{web,android,ios,desktop}
  web:     "$GODOT" --headless --path . --export-release "Web" build/web/index.html
           + real browser check (godot skill web reference, section 7)
  android: --export-release "Android" build/android/<slug>-<x.y.z>.aab  (Play)
           + an .apk from the same preset for sideload testing
  ios:     --export-release "iOS" build/ios/<slug>-<x.y.z>.ipa (macOS, signing in preset)
  desktop: one --export-release per desktop preset (macOS .zip/.dmg, Windows .exe, Linux)
  Keystore and signing secrets come from env vars or .godot/export_credentials.cfg,
  never from the committed export_presets.cfg.
Web engines:
  web:     the repo's own build (npm run build) -> dist/ ; zipped as a release artifact
  android / ios: ONLY if the repo already has its own Capacitor app:
           npx cap sync, then Gradle bundleRelease / xcodebuild archive
  desktop: only if the repo already has an Electron / Tauri shell
Output: artifact paths + sha256 in state; build/ stays untracked
One export subagent per target, all dispatched in one message; each writes only build/<target>/
and waits on its own export process with a blocking poll.
```

#### Phase 10.5: Store Submission Checklist (always; never an upload)

Runs in parallel with the Phase 10 exports and the release-notes draft (one message).

Written to `~/Documents/game-releases/{slug}/releases/v<x.y.z>-store-checklist.md` and summarised
in the PR body:

- Store listing copy per store (App Store: name, subtitle, promotional text, description,
  keywords; Play: title, short and full description; itch / Steam page copy if targeted), within
  each store's current length limits
- Screenshots and art needed per store and device class (phone, tablet, feature graphic, icon,
  Steam capsules), with which ones exist and which are missing
- Privacy: App Store privacy labels, Play Data safety form, privacy policy URL, what data the game
  collects (saves, analytics, ads, accounts)
- Age rating questionnaires (App Store, IARC for Play), export compliance (encryption), ads / IAP
  declarations
- Version numbers table: marketing version, Android versionCode, iOS build number, previous values
- Which artifact goes where, and the exact manual upload step for each store

**Never upload to App Store Connect, Play Console, itch.io or Steam, and never deploy to
production, without explicit user confirmation at that moment.** No flag pre-authorizes it,
`--merge` included, and execute being the default does not either.

#### Phase 11: PR (and merge only with `--merge`)

```yaml
1. CONFIRM push of the branch to origin
2. gh pr create --base main --title "release: v<x.y.z>" (new: "feat: <Game Name> v0.1.0")
   Body: changelog section, gate scores, skipped gates + reason, deferred issues,
         accepted risks, artifact list + sha256, store checklist summary, CLAUDE.md
         additions proposed (version mode), workflow id
3. gh pr checks --watch; fixable failure -> fix, push, retry once; else abort
4. Without --merge: stop here, status "awaiting_merge"; tell the user to merge and run
   /game-release --resume <id> (or pass --merge on resume) to tag and release
5. With --merge: CONFIRM "Merge PR #<n>?", squash merge, delete branch
```

#### Phase 12: Tag and GitHub Release (after merge)

```yaml
- Check out the merge commit on main; rebuild the artifacts there (Phase 10) so they
  match the tag exactly; re-verify versions
- CONFIRM tag: git tag -a v<x.y.z> -m "v<x.y.z>" && git push origin v<x.y.z>
- CONFIRM release: gh release create v<x.y.z> <artifacts> --title "v<x.y.z>"
                   --notes-file <changelog section>
  (Repo is public -> the artifacts become public; say so in the confirmation)
```

#### Phase 13: Post-Release

Release notes (`~/Documents/game-releases/{slug}/releases/v<x.y.z>-release-notes.md`) with
the `post-launch` monitoring plan, workflow metrics, final state saved. The summary lists the
store checklist and the manual upload steps still open.

---

## Guardrails Summary

| Category | Behavior |
|----------|----------|
| Database ops, force push, secrets in files / config / logs | BLOCKED |
| Any change inside the Weekly Arcade monorepo | BLOCKED |
| Store uploads, production deploys | BLOCKED unless confirmed by the user at that moment |
| Create remote repo, push, merge, tag, GitHub release | CONFIRM |
| Add Capacitor / Electron / a new export target | CONFIRM |
| Delete outside the game repo's working files | CONFIRM |
| Read, build, test, export to build/ | SAFE |
| Create issues / PRs in the game's own repo | SAFE |

See the `orchestrator-guardrails` skill, "Standalone game releases" section.

---

## Dry Run Output

`--dry-run` runs read-only analysis, changes nothing, and prints:

```
## Dry Run Summary (game-release, mode: new | version)

### Repository (Phase 0)
- Existing repo: <path>, origin <url>                     | or
- Would create: <owner>/<name> (private) at <local path>, account: <login | ENV_NAME>
- Skeleton: <engine> from <official template + version / docs URL>
- Files: README.md, .gitignore, .claude/game-context.json, AGENTS.md, CLAUDE.md (@AGENTS.md
         import + Claude-specific parts), CHANGELOG.md, engine project files
         [, LICENSE] [, CI workflow]
- Version mode: AGENTS.md / CLAUDE.md missing -> would offer to create (or propose the
  missing one + import wiring) | present -> additions only

### Phase Results
| Phase | Status | Key Output |
|-------|--------|------------|
| Pre-flight | Checked | git, gh, accounts |
| Repo setup | Planned | create / connect |
| Toolchain | Checked | needed vs available table, installs proposed (none run) |
| Concept | Simulated | (new) |
| Design | Simulated | PRD sections (new) |
| Visual Design | Simulated / Skipped | MCP connected? (new) |
| Engine + Targets | Recommended | engine, rationale, targets (new) |
| Skeleton + Build | Planned | files to create (new) |
| Env Art | Estimated | budgets pending (new) |
| Read repo / Changelog / Bump | Simulated | v<prev> -> v<x.y.z>, files to bump (version) |
| Engine validation | Estimated | |
| Review / QA / Visual | Estimated | visual only for web targets |
| State sweep | Estimated | web probe or Godot monitors |
| Security / Economy | Applicable? | only with backend / economy |
| Accessibility / Perf | Estimated | |
| Build re-check | Estimated | |
| Target builds | Planned | artifact list per target |
| Store checklist | Planned | path |
| PR | Planned | merge: no (use --merge) |
| Tag + Release | Planned | after merge |

### Parallel Groups (each row = one message of concurrent subagents)
| Group | Agents |
|-------|--------|
| Research | game-trend-scout, competitor scan (new) / repo read, changelog draft (version) |
| Gates | game-code-reviewer, game-qa-tester, game-visual-tester (web), game-accessibility-auditor, game-economy-validator (if economy), state sweep, performance, leaderboard-validator (if backend) |
| Re-gates | failed gates only, after one fix pass |
| Ship prep | export per target (web, android, ios, desktop), release notes, store checklist |

### Questions It Will Ask
- Repository: is there one? (unless --repo / --create-repo), owner, visibility, account
- Concept, engine and targets (new mode, unless passed as flags)
- Version bump confirmation (version mode, unless --version)
- Each tool install, each credit spend (Meshy, image generation), each CONFIRM below

### Toolchain Status
| Item | Needed for | Available | Action on execute |
|------|------------|-----------|-------------------|

### Git / GitHub Operations (all CONFIRM)
create repo, push main, push branch, PR, [merge], tag, release

To execute: /game-release <same flags without --dry-run>
```

---

## Error Handling and Rollback

On failure: `CONFIRM "Workflow failed at {phase}. Rollback? [Y/n]"`. Rollback deletes the
feature / release branch (local and remote if pushed), closes the PR, closes deferred issues
created by this run, and reverts nothing on main. A remote repo created in Phase 0 is never
deleted by rollback; tell the user it exists and let them decide.

## Workflow State

**Location**: `~/Documents/game-releases/workflows/{workflow-id}.json` (id `gr-YYYY-MM-DD-HHmmss`).
Kept outside the game repo so it never dirties the working tree or gets committed. Artifacts
(scout report, PRD, design export, release notes, store checklist) live under
`~/Documents/game-releases/{slug}/`. `/workflow-status` reads both this directory and the weekly
one. Use `--resume {id}` to continue from any checkpoint.

## Notes

- Requires `gh`, git, and the toolchain for each selected target
- All confirmations are logged in state for the audit trail
- The account / token used is recorded by login or env var name only
