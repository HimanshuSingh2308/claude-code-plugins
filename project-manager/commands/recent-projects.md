---
description: List recently accessed projects and quickly jump to any of them
argument-hint: [number-to-load | clear]
---

# Recent Projects

Manage and navigate to recently accessed projects.

**Argument**: $ARGUMENTS

## Workflow

### Step 1: Load Project Registry

Read `~/.claude/project-registry.json`. If it doesn't exist, inform the user no projects have been registered yet and suggest using `/load-project`.

```json
{
  "projects": {
    "/Users/hsingh1/code/weekly-arcade": {
      "name": "weekly-arcade",
      "lastAccessed": "2026-03-18T14:30:00Z",
      "techStack": ["node", "typescript", "nx", "firebase"],
      "hasClaudeConfig": true
    },
    "/Users/hsingh1/code/my-api": {
      "name": "my-api",
      "lastAccessed": "2026-03-17T09:15:00Z",
      "techStack": ["python", "fastapi", "postgresql"],
      "hasClaudeConfig": false
    }
  }
}
```

### Step 2: Process Arguments

- **No argument**: Display list of recent projects
- **Number (1-9)**: Immediately load that project (shortcut)
- **`clear`**: Clear the project history after confirmation

### Step 3: Display Recent Projects

Sort projects by `lastAccessed` (most recent first) and display:

```
## Recent Projects

| # | Project           | Last Accessed      | Tech Stack                    |
|---|-------------------|--------------------|------------------------------ |
| 1 | weekly-arcade     | Today, 2:30 PM     | Node, TypeScript, NX          |
| 2 | my-api            | Yesterday, 9:15 AM | Python, FastAPI               |
| 3 | blog-platform     | Mar 15, 10:00 AM   | Next.js, Tailwind, Prisma     |
| 4 | rust-cli-tool     | Mar 12, 3:45 PM    | Rust, Clap                    |
| 5 | data-pipeline     | Mar 10, 11:20 AM   | Python, Apache Airflow        |

Enter a number (1-5) to load that project, or use `/load-project <path>` for a new one.
```

### Step 4: Handle Selection

If user provides a number or selects one:

1. Validate the number is within range
2. Check if the project path still exists
3. If exists: execute `/load-project /path/to/project`
4. If not exists: offer to remove from registry and suggest alternatives

### Step 5: Clear History (if requested)

If argument is `clear`:

1. Ask for confirmation: "This will remove all 5 projects from your history. Continue? (y/n)"
2. If confirmed: clear the registry and confirm
3. If declined: cancel operation

## Additional Features

### Filtering by Tech Stack

If you have many projects, suggest filtering:
- `/recent-projects node` - Show only Node.js projects
- `/recent-projects python` - Show only Python projects

### Project Health Indicators

Add indicators for each project:
- **Active** - Has recent git commits (within 7 days)
- **Stale** - No activity for 30+ days
- **Missing** - Path no longer exists

## Output Format

When displaying the table, include:
- Relative time formatting ("Today", "Yesterday", "Mar 15")
- Truncated tech stack if too long
- Color/emoji indicators for project status (if supported)

## Registry Management

The registry is stored at `~/.claude/project-registry.json`:
- Maximum 20 projects stored (oldest auto-removed)
- Projects automatically added when using `/load-project`
- Manual entries can be added via `/load-project` with aliases
