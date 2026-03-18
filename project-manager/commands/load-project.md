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

### Step 2: Validate Project

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

### Step 3: Load Project Context

Read and summarize key configuration files (if they exist):

1. **Claude Configuration**:
   - `CLAUDE.md` - Project instructions for Claude
   - `AGENTS.md` - Agent configurations
   - `.claude/settings.json` - Claude Code settings
   - `.claude/commands/` - Custom commands

2. **Project Configuration**:
   - `package.json` - dependencies, scripts, project info
   - `tsconfig.json` / `jsconfig.json` - TypeScript/JS config
   - `.env.example` - environment variables needed
   - `README.md` - project documentation

3. **CI/CD & Quality**:
   - `.github/workflows/` - GitHub Actions
   - `.eslintrc*` / `prettier.config*` - code style
   - `jest.config*` / `vitest.config*` - testing setup

### Step 4: Detect Tech Stack

Based on files found, identify:
- **Runtime**: Node.js, Deno, Bun, Python, Rust, Go, Java, etc.
- **Framework**: React, Next.js, Vue, Svelte, Express, FastAPI, etc.
- **Package Manager**: npm, yarn, pnpm, pip, cargo, etc.
- **Build Tool**: webpack, vite, esbuild, turbopack, etc.
- **Testing**: Jest, Vitest, pytest, cargo test, etc.

### Step 5: Update Project Registry

Add/update entry in `~/.claude/project-registry.json`:

```json
{
  "projects": {
    "/path/to/project": {
      "name": "project-name",
      "lastAccessed": "2026-03-18T12:00:00Z",
      "techStack": ["node", "typescript", "react", "vite"],
      "hasClaudeConfig": true
    }
  }
}
```

### Step 6: Present Summary

Display a concise summary:

```
## Project Loaded: {project-name}

**Path**: /path/to/project
**Tech Stack**: Node.js, TypeScript, React, Vite
**Package Manager**: pnpm

### Key Files Found
- CLAUDE.md (project instructions)
- 15 npm scripts available
- Jest test setup configured
- GitHub Actions CI/CD

### Quick Actions
- `npm run dev` - Start development server
- `npm run test` - Run tests
- `npm run build` - Build for production

Ready to work! Ask me anything about this project.
```

### Step 7: Change Working Directory

Use the Bash tool to change to the project directory:
```bash
cd /path/to/project
```

## Error Handling

- If path doesn't exist: suggest similar paths or recent projects
- If path is a file: use its parent directory
- If permission denied: inform user and suggest alternatives
- If no project markers: warn but still load if user confirms

## Notes

- This command updates the session context for all subsequent interactions
- Recent projects can be accessed via `/recent-projects`
- Project metadata can be viewed anytime via `/project-info`
