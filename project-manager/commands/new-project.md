---
description: Create a new project from built-in or custom templates
argument-hint: <project-name> [--template <template-name>]
---

# New Project

Create a new project from a template.

**Arguments**: $ARGUMENTS

## Workflow

### Step 1: Parse Arguments

Parse the input for:
- `project-name` - Required name for the new project
- `--template <name>` - Optional template to use
- `--path <dir>` - Optional parent directory (defaults to current directory)

If no project name provided, prompt for it.

### Step 2: Select Template

If no template specified, present options:

```
## Select a Project Template

### Web Frontend
1. **react-vite** - React 18 + Vite + TypeScript + Tailwind
2. **nextjs-app** - Next.js 14 App Router + TypeScript
3. **vue-vite** - Vue 3 + Vite + TypeScript + Pinia
4. **svelte-kit** - SvelteKit + TypeScript

### Backend API
5. **express-ts** - Express.js + TypeScript + Prisma
6. **fastapi** - FastAPI + Python 3.11 + SQLAlchemy
7. **nestjs** - NestJS + TypeScript + TypeORM
8. **go-fiber** - Go + Fiber + GORM

### Full Stack
9. **t3-stack** - Next.js + tRPC + Prisma + Tailwind
10. **remix-stack** - Remix + Prisma + Tailwind

### CLI / Library
11. **node-cli** - Node.js CLI with Commander + TypeScript
12. **rust-cli** - Rust CLI with Clap
13. **npm-package** - NPM package with TypeScript + Vitest

### Other
14. **monorepo-nx** - NX Monorepo + TypeScript
15. **custom** - Define your own stack

Enter a number or template name:
```

### Step 3: Gather Project Details

Based on template, ask for additional config:

```
## Project Configuration

Project Name: my-awesome-app
Template: react-vite

Additional options:
- Include ESLint + Prettier? (Y/n)
- Include testing setup (Vitest)? (Y/n)
- Include CI/CD (GitHub Actions)? (Y/n)
- Initialize Git repository? (Y/n)
- Create CLAUDE.md? (Y/n)
```

### Step 4: Scaffold Project

Execute the appropriate scaffolding command based on template:

#### React + Vite
```bash
npm create vite@latest my-awesome-app -- --template react-ts
cd my-awesome-app
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

#### Next.js
```bash
npx create-next-app@latest my-awesome-app --typescript --tailwind --eslint --app --src-dir
```

#### FastAPI
```bash
mkdir my-awesome-app && cd my-awesome-app
python -m venv venv
source venv/bin/activate
pip install fastapi uvicorn sqlalchemy alembic
```

#### Custom Template
For custom templates, prompt for:
- Language/runtime
- Framework
- Database (if any)
- Authentication (if any)
- Testing framework
- CI/CD provider

### Step 5: Add Standard Files

After scaffolding, add these files:

#### CLAUDE.md
```markdown
# Project: {project-name}

## Overview
{description based on template}

## Tech Stack
- {detected tech stack}

## Getting Started
\`\`\`bash
{startup commands}
\`\`\`

## Project Structure
{auto-generated structure}

## Key Commands
- `npm run dev` - Start development
- `npm run build` - Build for production
- `npm run test` - Run tests
```

#### .gitignore (if not present)
Add template-appropriate ignores.

#### README.md (if not present)
Generate basic README with project info.

### Step 6: Initialize Git

If requested:
```bash
git init
git add .
git commit -m "Initial commit: {template} scaffold"
```

### Step 7: Register Project

Add to project registry (`~/.claude/project-registry.json`) for quick access later.

### Step 8: Present Summary

```
## Project Created Successfully!

**Name**: my-awesome-app
**Path**: /Users/hsingh1/code/my-awesome-app
**Template**: react-vite

### What was set up:
- React 18 with TypeScript
- Vite build tool
- Tailwind CSS
- ESLint + Prettier
- Vitest for testing
- GitHub Actions CI
- CLAUDE.md for Claude Code

### Next Steps:
1. `cd my-awesome-app`
2. `npm run dev` to start development
3. Open http://localhost:5173

Or run `/load-project my-awesome-app` to switch context.
```

## Custom Templates

Users can define custom templates in `~/.claude/project-templates/`:

```json
// ~/.claude/project-templates/my-template.json
{
  "name": "my-company-stack",
  "description": "Standard company project setup",
  "commands": [
    "npm create vite@latest $PROJECT_NAME -- --template react-ts",
    "cd $PROJECT_NAME && npm install",
    "npm install @company/ui-kit @company/eslint-config"
  ],
  "files": {
    "CLAUDE.md": "templates/company-claude.md",
    ".eslintrc.js": "templates/eslintrc.js"
  },
  "postSetup": [
    "git init",
    "git remote add origin git@github.com:company/$PROJECT_NAME.git"
  ]
}
```

## Error Handling

- If directory exists: offer to use different name or overwrite
- If scaffold command fails: show error and suggest manual steps
- If git init fails: continue without git, warn user
- If template not found: show available templates
