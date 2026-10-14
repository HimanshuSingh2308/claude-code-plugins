---
name: game-toolchain
description: >
  Checks every tool a game task needs against what is actually installed, using real commands
  (version and path), never memory. Builds a "needed vs available" table from the game context,
  engine and targets: git, gh and its account, node / npm, the engine (Godot binary and matching
  export templates, Babylon / Phaser via npm), per-target toolchains (browser checks, Android JDK
  and SDK, iOS Xcode and signing), test runners, creative tools (Claude Design MCP, Nano Banana,
  Meshy, Blender) and relevant MCP servers. For anything missing it explains what it is for and
  the exact install command, and installs only after the user says yes. Run before building,
  exporting or releasing any game.
---

# Game Toolchain Check

Answers one question before work starts: **does this machine have everything this game task
needs, right now?** Every row is checked with a command; nothing is assumed from memory, from
earlier sessions or from what "is usually installed".

## Step 0: Game context

Applies to Weekly Arcade and standalone games; load `game-context` to know which platform rules (if any) apply.

## 1. Decide what is needed

Inputs: the resolved `Context:` line, the engine, the targets and the task (build, test, export,
release, art). Only rows the task needs are "needed"; everything else is "not needed" and is not
probed beyond a cheap presence check.

| Area | Needed when |
|------|-------------|
| git, gh + authenticated account (with `repo` scope) | Always for release work; git always |
| node / npm at the version the repo needs (`.nvmrc`, `engines` in package.json) | Web engines, Weekly Arcade, gemini CLI |
| Godot binary matching `config/features` + export templates for that exact version | Godot projects |
| Babylon.js / Phaser | Resolved through `npm ls` in the repo, not globally |
| Browser checks: Chrome, Chrome DevTools MCP or Playwright MCP | Web targets, visual QA, state sweep, accessibility |
| Android: JDK 17, Android SDK (cmdline-tools, platform-tools, build-tools, platforms), NDK for Godot, release keystore reachable | Android target |
| iOS: macOS, Xcode, `xcodebuild`, a signing identity, a simulator runtime | iOS target |
| Desktop: Godot desktop export templates, or the repo's Electron / Tauri toolchain | Desktop target |
| Tests: GUT or gdUnit4 addon (Godot), the repo's runner (vitest, jest, playwright) | Any test or gate run |
| Creative: claude-design MCP connected; `nano-banana` skill + gemini CLI authenticated; Meshy API key present; Blender + `blender` MCP | Visual design phase, asset generation, environment art |
| MCP servers: `godot` MCP (Godot), chrome-devtools / playwright (web) | When the task would call them |

## 2. Probe with real commands

Record the version and the path for every needed row. Examples (adapt to the task):

```bash
git --version; command -v git
gh --version; gh auth status 2>&1 | grep -E 'Logged in|scopes'   # account names and scopes only
node --version; npm --version; command -v node
# Godot: GODOT_PATH, then PATH, then the app bundle
"${GODOT_PATH:-$(command -v godot || echo /Applications/Godot.app/Contents/MacOS/Godot)}" --version
ls "$HOME/Library/Application Support/Godot/export_templates/"      # must contain the exact version dir
npm ls @babylonjs/core phaser 2>/dev/null                           # inside the repo
/usr/libexec/java_home -v 17 2>/dev/null; java -version 2>&1 | head -1
echo "${ANDROID_HOME:-$ANDROID_SDK_ROOT}"; ls "$ANDROID_HOME"/{cmdline-tools,platform-tools,build-tools,platforms} 2>/dev/null
xcodebuild -version; security find-identity -v -p codesigning | tail -1; xcrun simctl list runtimes | tail -3
ls addons/gut addons/gdUnit4 2>/dev/null                            # Godot test addons
command -v gemini; ls ~/meshy-eval/.env && grep -c '^MESHY' ~/meshy-eval/.env   # count only, never the value
/opt/homebrew/bin/blender --version | head -1
claude mcp list 2>/dev/null | grep -iE 'claude-design|blender|godot|chrome|playwright'
```

MCP connection state can also be read from the session (tools present or a "failed to connect"
notice). A configured but disconnected server is **missing**, with the reason (for example the
claude-design MCP needs `/design-login`).

**Secrets:** check that a key, keystore password or token exists (count, file presence, env var
name), never print its value, never write it to a file, a log or a state file.

## 3. Output

```
## Toolchain: <game> (<engine>, targets: <list>)

| Tool | Needed for | Status | Version | Path |
|------|------------|--------|---------|------|
| gh (account: <login>) | PR, release | ok | 2.x | /opt/homebrew/bin/gh |
| Godot 4.7.2 templates | export | missing | - | - |
| JDK 17 | android | outdated | 11.0.2 | ... |
| Xcode | ios | not needed | - | - |

Verdict: READY | NOT READY (<n> missing: ...)
```

Status values: `ok`, `missing`, `outdated` (present but below what the repo or engine needs),
`not needed`.

## 4. Missing items: ask, then install

For each `missing` or `outdated` row, show:
- what it is for in this task,
- the exact install command,
- download size or cost if known (Meshy credits, Xcode is many GB, export templates about 1 GB),

then ask for permission. **Install only after a yes, then re-run the probe and update the row.**

- **Never install silently.** Never use `sudo` without asking for that specific command.
- **This Mac has two Homebrew installs.** Use the arm64 one: `/opt/homebrew/bin/brew install ...`,
  never `/usr/local/bin/brew` (the Intel prefix).
- Typical commands (verify the current package names first, for example `brew info <name>`):
  `brew install gh`, `brew install --cask godot`, `brew install --cask temurin@17`,
  `brew install --cask android-commandline-tools` then `sdkmanager "platform-tools"
  "build-tools;<ver>" "platforms;android-<api>"`, Godot export templates from the official
  `.tpz` for the exact version (unzip its `templates/` into the export_templates version folder),
  Xcode from the App Store (user action), `npm install` in the repo for engine packages.
- Things the user must do themselves (sign in to an Apple account, `/design-login`, `gh auth
  login`, create a keystore, accept licenses) are listed as user actions with the exact command;
  do not attempt them on the user's behalf.
- If the user declines, mark the row `missing (declined)` and say which phases or targets cannot
  run without it.

## 5. Rules

- Every status comes from a command run in this session.
- Report in the table format above, then the one-line verdict.
- Run it again after any install, and before exports if it has been a while or the target list
  changed.
