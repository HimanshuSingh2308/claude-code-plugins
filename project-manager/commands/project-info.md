---
description: Display comprehensive metadata and info about the current project
argument-hint: [section: deps|scripts|structure|git|all]
---

# Project Info

Display detailed information about the current working project.

**Section filter**: $ARGUMENTS

## Workflow

### Step 1: Verify Project Context

Check current working directory. If not in a valid project:
- Suggest using `/load-project` first
- Or offer to analyze the current directory anyway

### Step 2: Gather Project Metadata

Collect information from multiple sources:

#### 2.1 Basic Info (package.json, Cargo.toml, pyproject.toml, etc.)

```
Project: weekly-arcade
Version: 1.2.0
Description: Browser-based arcade games with leaderboards
License: MIT
Author: Himanshu Singh
```

#### 2.2 Tech Stack Detection

Scan project files to determine:
- **Language**: JavaScript/TypeScript, Python, Rust, Go, Java
- **Runtime**: Node.js (v20), Python 3.11, etc.
- **Framework**: React 18, Next.js 14, FastAPI, etc.
- **Build Tool**: Vite, Webpack, esbuild, Turbopack
- **Package Manager**: npm, pnpm, yarn, pip, cargo
- **Database**: PostgreSQL, MongoDB, Redis, Firebase
- **Testing**: Jest, Vitest, pytest, cargo test

#### 2.3 Project Structure

```
weekly-arcade/
├── apps/
│   ├── web/          (Frontend - React + Vite)
│   └── api/          (Backend - Firebase Functions)
├── packages/
│   └── shared/       (Shared types and utilities)
├── nx.json           (NX monorepo config)
└── package.json      (Root workspace)
```

#### 2.4 Available Scripts

From package.json scripts, Makefile, or similar:

```
## Available Scripts

| Script      | Command           | Description                    |
|-------------|-------------------|--------------------------------|
| dev         | nx serve web      | Start development server       |
| build       | nx build web      | Build for production           |
| test        | nx test           | Run all tests                  |
| lint        | nx lint           | Lint all projects              |
| deploy      | firebase deploy   | Deploy to Firebase             |
```

#### 2.5 Dependencies Summary

```
## Dependencies

**Production**: 45 packages
- Key: react, firebase, @tanstack/query, tailwindcss

**Development**: 32 packages
- Key: typescript, vite, vitest, eslint, prettier

**Outdated**: 3 packages need updates
- react: 18.2.0 → 18.3.1
- vite: 5.0.0 → 5.2.0
- typescript: 5.3.0 → 5.4.2
```

#### 2.6 Git Status

```
## Git Status

**Branch**: feature/new-game
**Remote**: origin/main (3 commits behind)
**Status**: 2 staged, 5 modified, 1 untracked

**Recent Commits**:
- abc1234 feat: add fieldstone game (2 hours ago)
- def5678 fix: leaderboard sorting (yesterday)
- ghi9012 chore: update dependencies (2 days ago)
```

#### 2.7 Claude Configuration

```
## Claude Code Setup

**CLAUDE.md**: Found (2.3 KB)
**AGENTS.md**: Found (1.1 KB)
**Custom Commands**: 3 commands
  - /deploy-preview
  - /run-e2e
  - /update-game

**Settings**:
  - Model: claude-sonnet-4-20250514
  - Permissions: Bash, Read, Write, Edit
```

#### 2.8 Environment Variables

From `.env.example` or `.env.template`:

```
## Required Environment Variables

| Variable              | Description              | Status  |
|-----------------------|--------------------------|---------|
| FIREBASE_API_KEY      | Firebase API key         | Set     |
| DATABASE_URL          | PostgreSQL connection    | Missing |
| OPENAI_API_KEY        | OpenAI API access        | Set     |
```

### Step 3: Section Filtering

Based on argument, show only specific sections:
- `deps` - Dependencies only
- `scripts` - Available scripts only
- `structure` - Project structure only
- `git` - Git status only
- `all` or empty - Everything (default)

### Step 4: Output Format

Present information in a clean, scannable format:
- Use tables for structured data
- Use code blocks for file structures
- Highlight important info (outdated deps, missing env vars)
- Keep sections collapsible in mind for large output

## Quick Actions

At the end, suggest relevant actions:

```
## Quick Actions

Based on your project, you might want to:
- `npm run dev` - Start the development server
- `npm outdated` - Check for dependency updates
- `git pull origin main` - Sync with remote
```

## Caching

To avoid re-reading files repeatedly:
- Cache project info for the session
- Invalidate on file changes or after 5 minutes
- Use `/project-info refresh` to force refresh
