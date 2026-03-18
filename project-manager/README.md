# Project Manager Plugin

A Claude Code plugin for managing project sessions, switching contexts, tracking recent projects, and scaffolding new projects from templates.

## Commands

| Command | Description |
|---------|-------------|
| `/load-project <path>` | Switch working context to a project |
| `/recent-projects` | List and navigate to recent projects |
| `/project-info` | Display metadata about current project |
| `/new-project <name>` | Create a new project from a template |

## Features

### Context Switching
Quickly switch between different project directories. When you load a project, the plugin:
- Detects the tech stack (language, framework, build tools)
- Reads project configuration (CLAUDE.md, package.json, etc.)
- Updates the project registry for quick access later
- Changes to the project directory

### Recent Projects
Never lose track of projects you've worked on:
- Automatically tracks projects when using `/load-project`
- Shows last accessed time and tech stack
- Quick jump to any recent project by number
- Maintains up to 20 recent projects

### Project Metadata
Get a comprehensive view of your project:
- Tech stack detection (language, framework, build tool, testing)
- Available scripts and commands
- Git status and recent commits
- Dependencies summary
- Environment variables required
- Claude Code configuration status

### Project Templates
Scaffold new projects quickly:
- Built-in templates for React, Next.js, Vue, FastAPI, and more
- Custom templates support
- Automatic CLAUDE.md generation
- Git initialization and initial commit

## Built-in Templates

| Template | Description |
|----------|-------------|
| `react-vite` | React 18 + Vite + TypeScript + Tailwind |
| `nextjs-app` | Next.js 14 App Router + TypeScript |
| `vue-vite` | Vue 3 + Vite + TypeScript + Pinia |
| `svelte-kit` | SvelteKit + TypeScript |
| `express-ts` | Express.js + TypeScript + Prisma |
| `fastapi` | FastAPI + Python 3.11 + SQLAlchemy |
| `nestjs` | NestJS + TypeScript + TypeORM |
| `go-fiber` | Go + Fiber + GORM |
| `t3-stack` | Next.js + tRPC + Prisma + Tailwind |
| `node-cli` | Node.js CLI with Commander |
| `rust-cli` | Rust CLI with Clap |
| `npm-package` | NPM package with TypeScript |
| `monorepo-nx` | NX Monorepo |

## Project Registry

Projects are tracked in `~/.claude/project-registry.json`:

```json
{
  "projects": {
    "/path/to/project": {
      "name": "project-name",
      "lastAccessed": "2026-03-18T12:00:00Z",
      "techStack": ["node", "typescript", "react"],
      "hasClaudeConfig": true
    }
  }
}
```

## Custom Templates

Create custom templates at `~/.claude/project-templates/`:

```
~/.claude/project-templates/my-template/
├── template.json       # Template configuration
├── files/              # Files to copy
└── README.md           # Template documentation
```

## Installation

This plugin is part of the `hplugins` marketplace. To use it:

1. Ensure the marketplace is installed
2. Run `/wiser-sync` to update plugins (if using wiser-tools)
3. Commands will be available immediately

## Usage Examples

```bash
# Load a project
/load-project ~/code/my-app

# See recent projects
/recent-projects

# Jump to project #2
/recent-projects 2

# Get project info
/project-info

# Get only dependency info
/project-info deps

# Create a new React project
/new-project my-new-app --template react-vite
```

## License

MIT
