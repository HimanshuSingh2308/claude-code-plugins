---
description: Force a full re-scan of the current project and update the knowledge cache with latest changes
argument-hint: [--deep | --quick]
---

# Refresh Project

Force re-scan the current project and update the cached knowledge.

**Options**: $ARGUMENTS

## When to Use

- After major changes (new dependencies, restructured directories, updated CLAUDE.md)
- When the cached knowledge feels stale or incorrect
- After merging a large PR or switching branches with significant changes
- When `/load-project` shows "(from cache)" but you know things have changed

## Workflow

### Step 1: Verify Current Project

1. Check current working directory is a valid project
2. Look up the project in `~/.claude/project-registry.json`
3. If not in a project, suggest using `/load-project` first

### Step 2: Determine Scan Depth

Based on argument:

- **No argument** or **`--quick`**: Quick refresh — only update things that change frequently:
  - Git status (branch, recent commits, uncommitted changes)
  - Package versions (check package.json version field)
  - Available scripts (in case new ones were added)
  - CLAUDE.md changes (re-read and re-summarize if modified since last scan)
  - New/removed top-level directories

- **`--deep`**: Full deep refresh — re-scan everything:
  - Complete tech stack re-detection
  - Full dependency analysis
  - All configuration files re-read
  - Project structure re-mapped
  - CI/CD workflows re-scanned
  - All CLAUDE.md / AGENTS.md re-summarized
  - Custom commands re-listed
  - Environment variables re-checked

### Step 3: Detect Changes

Before scanning, read the existing knowledge file at:
```
~/.claude/projects/{sanitized-path}/memory/project_knowledge.md
```

Compare what's changed since the last scan:
- Check `scannedAt` timestamp in the frontmatter
- Use `git log --oneline --since={scannedAt}` to see commits since last scan
- Check if key files were modified: `git diff --name-only {last-scan-commit}..HEAD`
- Flag significant changes:
  - CLAUDE.md modified → re-read conventions
  - package.json modified → re-read deps/scripts
  - New directories created → update structure
  - CI workflows modified → re-read CI/CD
  - New .claude/commands/ added → update custom commands list

### Step 4: Perform Scan

#### Quick Refresh (default)

1. **Git context**:
   ```bash
   git branch --show-current
   git log --oneline -5
   git status --porcelain | head -10
   git remote -v
   ```

2. **Changed files since last scan**:
   ```bash
   git diff --name-only --stat {last-scan-commit}..HEAD
   ```

3. **CLAUDE.md** — only re-read if modified (check mtime or git diff)

4. **package.json** — only re-read scripts/version if modified

5. **New directories** — quick `ls` of top-level dirs, compare with cached list

#### Deep Refresh

Everything from the quick refresh, PLUS:

1. **Full tech stack re-detection** — scan all config files
2. **Dependency audit**:
   - Read package.json (or equivalent) for all deps
   - Note key production and dev dependencies
   - Check for lockfile changes
3. **All config files**:
   - tsconfig.json, .eslintrc, prettier.config, jest.config, etc.
   - .env.example for required env vars
4. **Project structure** — full directory tree (2 levels deep), file counts by type
5. **CI/CD** — re-read all workflow files
6. **Custom commands** — re-list .claude/commands/
7. **AGENTS.md** — re-read if exists

### Step 5: Update Knowledge File

Rewrite `~/.claude/projects/{sanitized-path}/memory/project_knowledge.md` with:
- Updated `scannedAt` timestamp
- All refreshed information
- A `## Recent Changes` section showing what changed since last scan:

```markdown
## Recent Changes (since last scan)

**Scanned**: {previous timestamp} → {now}
**Commits since last scan**: {count}

| Change | Details |
|--------|---------|
| New dependency | added `zod` to production deps |
| CLAUDE.md updated | added score submission format docs |
| New directory | `apps/web/src/games/tiny-tycoon/` |
| Script added | `deploy:staging` added to package.json |
| Branch changed | main → feature/new-game |
```

### Step 6: Update Registry

Update `~/.claude/project-registry.json`:
- Bump `lastAccessed`
- Update `techStack` if changed
- Set `hasKnowledgeCache: true`

### Step 7: Present Diff Summary

Show the user what changed:

```
## Project Refreshed: {project-name}

**Scan type**: Quick refresh
**Last scanned**: 2 days ago
**Commits since**: 12

### What Changed
- 📦 New dependency: `zod` added
- 📝 CLAUDE.md updated (score submission docs added)
- 📂 New game directory: `tiny-tycoon/`
- 🔀 Branch: main (was: feature/old-branch)
- 🚀 3 new scripts in package.json

### Current State
**Branch**: main
**Latest**: abc1234 - feat: add tiny tycoon game
**Status**: Clean working tree

Knowledge cache updated ✓
```

If nothing changed:
```
## Project Refreshed: {project-name}

No significant changes detected since last scan (2 hours ago).
Knowledge cache is up to date ✓
```

## Error Handling

- If not in a project directory: suggest `/load-project` first
- If no knowledge cache exists: perform a full deep scan (equivalent to first `/load-project`)
- If git is not available: skip git-dependent checks, note in output
- If knowledge file is corrupted: delete and re-scan from scratch

## Notes

- Quick refresh is fast (2-3 tool calls) — use it liberally
- Deep refresh reads many files (10-20 tool calls) — use after major changes
- The knowledge cache is stored per-project in the Claude memory system
- Other memory files in the project's memory directory are NOT affected by refresh
