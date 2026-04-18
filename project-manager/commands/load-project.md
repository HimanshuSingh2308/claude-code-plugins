---
description: Switch working context to a project - loads configurations, detects tech stack, and prepares the session
argument-hint: <project-path or project-name>
---

# Load Project

Load and switch context to the project: $ARGUMENTS

## Workflow

### Step 1: Resolve Project Path

If the argument is:
- An absolute path: use it directly
- A relative path: resolve from current working directory
- A project name: check `~/.claude/project-registry.json` for registered projects
- Empty: prompt the user to provide a project path or select from recent projects

### Step 2: Check for Cached Project Knowledge

Check if a project knowledge file already exists at:
```
~/.claude/projects/{sanitized-path}/memory/project_knowledge.md
```

Where `{sanitized-path}` is the project path with `/` replaced by `-` and leading `-` removed (e.g., `/Users/hsingh1/Documents/weekly-arcade` → `-Users-hsingh1-Documents-weekly-arcade`).

**If the knowledge file EXISTS and is less than 7 days old:**
1. Read the knowledge file instead of re-scanning the project
2. Do a QUICK validation only:
   - Verify the project path still exists
   - Check `git branch --show-current` for current branch
   - Check `git log --oneline -1` for latest commit
3. Check if `.claude/knowledge_graph.json` exists in the project:
   - If it exists and `meta.generatedAt` is less than 7 days old: note "Knowledge graph: cached"
   - If missing or stale: note that KG needs generation (will run Step 6.5)
4. Update `lastAccessed` in the registry
5. Present the cached summary (with branch/commit freshened)
6. If KG needs generation, run Step 6.5 before proceeding
7. Skip to Step 7 (change directory)

**If the knowledge file DOES NOT exist or is older than 7 days:**
Continue with full scan (Steps 3-6), then save results.

### Step 3: Validate Project

1. Check the path exists and is a directory
2. Look for project markers:
   - `package.json` (Node.js/npm)
   - `Cargo.toml` (Rust)
   - `pyproject.toml` or `requirements.txt` (Python)
   - `go.mod` (Go)
   - `pom.xml` or `build.gradle` (Java)
   - `.git` directory (any git repo)
   - `CLAUDE.md` or `.claude/` (Claude Code project)

If no project markers found, ask user to confirm this is the correct directory.

### Step 4: Load Project Context

Read and summarize key configuration files (if they exist):

1. **Claude Configuration**:
   - `CLAUDE.md` - Project instructions for Claude (summarize key rules/patterns)
   - `AGENTS.md` - Agent configurations
   - `.claude/settings.json` - Claude Code settings
   - `.claude/commands/` - Custom commands (list available ones)

2. **Project Configuration**:
   - `package.json` - dependencies, scripts, project name/version
   - `tsconfig.json` / `jsconfig.json` - TypeScript/JS config
   - `.env.example` - environment variables needed
   - `README.md` - project description (first 2-3 paragraphs)

3. **CI/CD & Quality**:
   - `.github/workflows/` - GitHub Actions (list workflow names)
   - `.eslintrc*` / `prettier.config*` - code style tools
   - `jest.config*` / `vitest.config*` - testing setup

4. **Project Structure**:
   - Top-level directory layout (1 level deep)
   - Key source directories and their purpose
   - Number of source files by type

5. **Git Context**:
   - Current branch
   - Last 5 commits (oneline)
   - Remote URLs
   - Any uncommitted changes

### Step 5: Detect Tech Stack

Based on files found, identify:
- **Runtime**: Node.js, Deno, Bun, Python, Rust, Go, Java, etc.
- **Framework**: React, Next.js, Vue, Svelte, Express, FastAPI, NestJS, etc.
- **Package Manager**: npm, yarn, pnpm, pip, cargo, etc.
- **Build Tool**: webpack, vite, esbuild, turbopack, nx, etc.
- **Testing**: Jest, Vitest, pytest, cargo test, etc.
- **Database**: PostgreSQL, MongoDB, Redis, Firebase, etc.
- **Deployment**: Firebase, Vercel, AWS, Docker, etc.

### Step 6: Save Project Knowledge

Save all gathered information to a knowledge file so future loads are instant.

**File**: `~/.claude/projects/{sanitized-path}/memory/project_knowledge.md`

```markdown
---
name: {project-name} project knowledge
description: Cached project context for {project-name} — tech stack, structure, scripts, and key patterns
type: project
scannedAt: {ISO timestamp}
---

## Project: {project-name}

**Path**: {absolute-path}
**Tech Stack**: {comma-separated list}
**Package Manager**: {name}
**Framework**: {name}

## Structure

{top-level directory layout with purpose of each dir}

## Key Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| ... | ... | ... |

## CLAUDE.md Summary

{Key rules, patterns, and API conventions from CLAUDE.md — condensed}

## Dependencies (Key)

**Production**: {list of important deps}
**Dev**: {list of important dev deps}

## CI/CD

{GitHub Actions workflows, deploy process}

## Custom Commands

{List of available /commands}

## Conventions

{Coding patterns, naming conventions, file organization rules extracted from CLAUDE.md and project config}
```

Also update `~/.claude/projects/{sanitized-path}/memory/MEMORY.md` to include a pointer to this file if not already present.

### Step 6.5: Generate Knowledge Graph

If the project has a source directory with 10+ source files, generate a code knowledge graph for fast symbol lookup and dependency tracking.

1. **Check for existing graph**: Look for `<project-root>/.claude/knowledge_graph.json`
   - If it exists and `meta.generatedAt` is less than 7 days old: skip generation (use cached graph)
   - If missing or stale: proceed with generation

2. **Detect source directory** based on the language/framework:
   - Dart/Flutter: `lib/`
   - TypeScript/JavaScript: `src/` (or project root if no `src/`)
   - Python: main package directory or `src/`
   - Go: project root (`.go` files)
   - Rust: `src/`
   - Java: `src/main/java/`

3. **Count source files** in the detected directory. If fewer than 10, skip KG generation (project is small enough to scan directly).

4. **Spawn the `kg-generator` agent** (sonnet) with:
   - Project path (absolute)
   - Detected language
   - Source directory (relative)
   - Detected framework (if any)

5. The agent will:
   - Read all source files
   - Extract symbols, methods, imports, line ranges
   - Build reverse dependency maps
   - Detect framework-specific patterns (providers, routes, DI)
   - Write `.claude/knowledge_graph.json`

6. **Update CLAUDE.md** with knowledge graph instructions:
   - If CLAUDE.md exists: check if it already has a `## Knowledge Graph` section
     - If not: append the KG instructions section
   - If CLAUDE.md doesn't exist: create it with KG instructions

   The KG instructions section:
   ```markdown
   ## Knowledge Graph

   This project has a code knowledge graph at `.claude/knowledge_graph.json`.

   **ALWAYS check the knowledge graph before reading source files:**
   1. Look up symbols in `symbols.<Name>` for exact file path and line range
   2. Check `files.<path>.importedBy` to find all files affected by a change
   3. Use `providers`/`routes`/`dataFlows` for architectural understanding
   4. Read only relevant line ranges (offset/limit) — avoid reading entire files
   5. After making code changes, run `/kg-update` to keep the graph current
   ```

7. **Update registry**: Set `hasKnowledgeGraph: true` in the project's registry entry.

**Note**: Knowledge graph generation runs in the background via the agent. If it takes too long (very large projects), it won't block the project load — the summary will note that KG generation is in progress.

### Step 7: Update Project Registry

Add/update entry in `~/.claude/project-registry.json`:

```json
{
  "projects": {
    "/path/to/project": {
      "name": "project-name",
      "lastAccessed": "2026-03-25T12:00:00Z",
      "techStack": ["node", "typescript", "react", "vite"],
      "hasClaudeConfig": true,
      "hasKnowledgeCache": true
    }
  }
}
```

### Step 8: Present Summary

Display a concise summary:

```
## Project Loaded: {project-name} {cached ? "(from cache)" : ""}

**Path**: /path/to/project
**Tech Stack**: Node.js, TypeScript, React, Vite
**Package Manager**: pnpm
**Branch**: main (latest: abc1234 - commit message)

### Key Files Found
- CLAUDE.md (project instructions)
- 15 npm scripts available
- Jest test setup configured
- GitHub Actions CI/CD

### Knowledge Graph
- {N} files indexed, {M} symbols mapped
- Run `/kg-update` after code changes to keep it fresh

### Quick Actions
- `npm run dev` - Start development server
- `npm run test` - Run tests
- `npm run build` - Build for production

Ready to work! Ask me anything about this project.
```

### Step 9: Change Working Directory

Use the Bash tool to change to the project directory:
```bash
cd /path/to/project
```

## Error Handling

- If path doesn't exist: suggest similar paths or recent projects
- If path is a file: use its parent directory
- If permission denied: inform user and suggest alternatives
- If no project markers: warn but still load if user confirms
- If knowledge cache is corrupted: delete it and do a fresh scan

## Notes

- This command updates the session context for all subsequent interactions
- Recent projects can be accessed via `/recent-projects`
- Project metadata can be viewed anytime via `/project-info`
- Use `/refresh-project` to force a full re-scan and update the knowledge cache
- Knowledge cache expires after 7 days and is automatically refreshed
