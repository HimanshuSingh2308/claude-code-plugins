---
name: project-context
description: >
  Background knowledge for project context management. Applied automatically when
  working with projects, detecting tech stacks, managing session state, and
  navigating between codebases. Provides patterns for project detection, registry
  management, and context persistence.
---

# Project Context Management

This skill provides background knowledge for managing project contexts in Claude Code sessions.

## Project Registry Schema

The project registry is stored at `~/.claude/project-registry.json`:

```json
{
  "version": "1.0",
  "maxProjects": 20,
  "projects": {
    "/absolute/path/to/project": {
      "name": "project-name",
      "alias": "short-alias",
      "lastAccessed": "2026-03-18T14:30:00Z",
      "accessCount": 15,
      "techStack": {
        "language": "typescript",
        "runtime": "node",
        "framework": "react",
        "buildTool": "vite",
        "packageManager": "pnpm",
        "testing": "vitest"
      },
      "hasClaudeConfig": true,
      "scripts": ["dev", "build", "test", "lint"],
      "gitBranch": "main",
      "gitRemote": "origin"
    }
  }
}
```

## Tech Stack Detection Patterns

### Language Detection

| File/Pattern | Language |
|--------------|----------|
| `package.json` | JavaScript/TypeScript |
| `tsconfig.json` | TypeScript |
| `Cargo.toml` | Rust |
| `go.mod` | Go |
| `pyproject.toml`, `setup.py` | Python |
| `pom.xml`, `build.gradle` | Java |
| `*.csproj`, `*.sln` | C# |
| `mix.exs` | Elixir |
| `Gemfile` | Ruby |

### Framework Detection

| File/Pattern | Framework |
|--------------|-----------|
| `next.config.*` | Next.js |
| `nuxt.config.*` | Nuxt |
| `svelte.config.*` | SvelteKit |
| `astro.config.*` | Astro |
| `remix.config.*` | Remix |
| `angular.json` | Angular |
| `vite.config.*` + react | React + Vite |
| `nest-cli.json` | NestJS |
| `fastapi` in requirements | FastAPI |
| `django` in requirements | Django |
| `flask` in requirements | Flask |

### Build Tool Detection

| File/Pattern | Build Tool |
|--------------|------------|
| `vite.config.*` | Vite |
| `webpack.config.*` | Webpack |
| `esbuild.*` | esbuild |
| `turbo.json` | Turborepo |
| `nx.json` | NX |
| `rollup.config.*` | Rollup |

### Package Manager Detection

| File/Pattern | Package Manager |
|--------------|-----------------|
| `pnpm-lock.yaml` | pnpm |
| `yarn.lock` | yarn |
| `package-lock.json` | npm |
| `bun.lockb` | bun |
| `Pipfile.lock` | pipenv |
| `poetry.lock` | poetry |
| `Cargo.lock` | cargo |

## Project Markers Priority

When detecting if a directory is a project, check in this order:

1. **Claude Config** (highest priority)
   - `CLAUDE.md`
   - `.claude/settings.json`

2. **Version Control**
   - `.git/`
   - `.svn/`

3. **Package Manifests**
   - `package.json`
   - `Cargo.toml`
   - `pyproject.toml`
   - `go.mod`

4. **Build Config**
   - `Makefile`
   - `Dockerfile`
   - `docker-compose.yml`

## Context Switching Best Practices

When switching between projects:

1. **Save Current State**
   - Note any uncommitted changes
   - Remember current branch
   - Save any session-specific context

2. **Load New Context**
   - Read CLAUDE.md for project-specific instructions
   - Detect tech stack for appropriate tooling
   - Load custom commands if available

3. **Update Registry**
   - Bump `lastAccessed` timestamp
   - Increment `accessCount`
   - Update `gitBranch` if changed

## Project Templates Location

Custom templates stored at `~/.claude/project-templates/`:

```
~/.claude/project-templates/
├── templates.json           # Template index
├── react-vite/              # Template files
│   ├── template.json        # Template config
│   ├── CLAUDE.md            # Claude config template
│   └── files/               # Template files to copy
├── fastapi/
└── custom-company-stack/
```

### Template Config Schema

```json
{
  "name": "template-name",
  "description": "Template description",
  "category": "frontend|backend|fullstack|cli|library",
  "techStack": ["react", "typescript", "vite"],
  "scaffoldCommands": [
    "npm create vite@latest $PROJECT_NAME -- --template react-ts"
  ],
  "postScaffold": [
    "cd $PROJECT_NAME",
    "npm install tailwindcss"
  ],
  "files": {
    "CLAUDE.md": "templates/claude.md",
    ".eslintrc.js": "templates/eslintrc.js"
  },
  "variables": {
    "AUTHOR_NAME": { "prompt": "Author name", "default": "Your Name" }
  }
}
```

## Session State Management

Project context is maintained through:

1. **Current Working Directory** - Primary context indicator
2. **Project Registry** - Metadata and history (`~/.claude/project-registry.json`)
3. **Knowledge Cache** - Persistent project knowledge (`~/.claude/projects/{path}/memory/project_knowledge.md`)
4. **Session Memory** - Conversation context (managed by Claude)

## Knowledge Cache System

Each project gets a knowledge file saved to the Claude memory system:

**Location**: `~/.claude/projects/{sanitized-path}/memory/project_knowledge.md`

**Contents**: Tech stack, directory structure, key scripts, CLAUDE.md summary, dependencies, CI/CD, custom commands, conventions.

**Cache rules**:
- Created on first `/load-project` (full scan)
- Reused on subsequent `/load-project` calls (instant load)
- Expires after 7 days (auto-refreshed on next load)
- Manually refreshed via `/refresh-project`
- Deep refresh via `/refresh-project --deep`

**Cache validation on load**:
1. Check file exists and `scannedAt` is within 7 days
2. Quick git check (branch, latest commit) to freshen context
3. Skip full scan, present cached summary

**Sanitized path format**: Replace `/` with `-`, remove leading `-`
- `/Users/hsingh1/Documents/weekly-arcade` → `-Users-hsingh1-Documents-weekly-arcade`

## Error Recovery

Common issues and solutions:

| Issue | Solution |
|-------|----------|
| Project path doesn't exist | Check for moved/renamed, offer to remove from registry |
| Git repo corrupted | Suggest `git fsck` or re-clone |
| Package manifest invalid | Offer to validate/fix JSON |
| Missing dependencies | Suggest `npm install` or equivalent |
| Permission denied | Check file permissions, suggest `chmod` |

## Integration Points

This skill integrates with:

- `/load-project` - Main command for switching context (uses knowledge cache)
- `/refresh-project` - Force re-scan and update knowledge cache
- `/recent-projects` - List and navigate history
- `/project-info` - Display current project details
- `/new-project` - Create from templates
