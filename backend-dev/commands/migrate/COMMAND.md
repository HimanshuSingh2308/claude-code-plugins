---
description: Database migration management for TypeORM. Generate migrations from entity changes, run pending migrations, revert, and check status. Includes safety checks for production environments.
argument-hint: <generate|run|revert|status> [migration-name] [--production | --dry-run | --verbose]
---

# Migrate

Manage TypeORM database migrations with safety checks and best practices.

**Arguments**: $ARGUMENTS

## Overview

| Subcommand | Purpose |
|------------|---------|
| `generate <name>` | Generate migration from entity changes |
| `run` | Run all pending migrations |
| `revert` | Revert the last applied migration |
| `status` | Show migration status (pending/applied) |

## Command Options

```
/migrate <subcommand> [options]

Subcommands:
  generate <name>    Generate migration from entity diff
  run                Run pending migrations
  revert             Revert last migration
  status             Show all migrations and their status

Options:
  --production       Enable production safety checks
  --dry-run          Show SQL without executing
  --verbose          Show detailed output
  --data-source <path>  Custom data source path (default: src/data-source.ts)
```

## Usage Examples

```bash
# Generate migration from entity changes
/migrate generate add-status-to-users

# Check what's pending
/migrate status

# Run all pending migrations
/migrate run

# Revert last migration
/migrate revert

# Dry run (show SQL without executing)
/migrate run --dry-run

# Generate with production safety checks
/migrate generate drop-legacy-columns --production
```

## Workflow

### /migrate generate <name>

#### Step 1: Locate Data Source

```yaml
Search order:
  1. --data-source flag
  2. src/data-source.ts
  3. ormconfig.ts / ormconfig.js
  4. Prompt user if not found
```

#### Step 2: Compare Entities vs Database Schema

```bash
npx typeorm migration:generate src/migrations/{timestamp}-{name} -d src/data-source.ts
```

#### Step 3: Review Generated Migration

```yaml
Read the generated migration file and analyze:
  - What tables are being created/altered/dropped
  - What columns are being added/removed/changed
  - What indexes are being created/dropped
  - What constraints are being added/removed

Classify changes:
  SAFE (zero-downtime):
    - ADD COLUMN with DEFAULT
    - CREATE INDEX CONCURRENTLY
    - ADD TABLE
    - ADD nullable column

  CAUTION (may lock):
    - ALTER COLUMN TYPE
    - ADD NOT NULL constraint
    - CREATE INDEX (non-concurrent)

  DANGEROUS (data loss risk):
    - DROP TABLE
    - DROP COLUMN
    - RENAME COLUMN
```

#### Step 4: Production Safety Check (--production)

```yaml
If --production flag or NODE_ENV=production:
  BLOCK if migration contains:
    - DROP TABLE
    - DROP COLUMN
    - ALTER COLUMN TYPE (with data loss)

  WARN if migration contains:
    - Any ALTER that may lock tables
    - Operations on tables with >1M rows

  SUGGEST:
    - Zero-downtime alternatives
    - Multi-step migration strategies
    - Backfill scripts
```

#### Step 5: Output

```markdown
## Migration Generated

File: src/migrations/1700000001-add-status-to-users.ts

### Changes Detected:
  - ADD COLUMN "status" (user_status_enum) to "users" — SAFE
  - CREATE INDEX "idx_users_status" on "users"("status") — SAFE

### Review:
  The migration adds a status column with default value 'active'.
  This is safe for zero-downtime deployment.

### Next:
  /migrate run          — Apply this migration
  /migrate run --dry-run — Preview SQL without applying
```

### /migrate run

#### Step 1: Check Pending Migrations

```bash
npx typeorm migration:show -d src/data-source.ts
```

#### Step 2: Confirm

```yaml
Show list of pending migrations with summary of changes.
Ask: "Apply {N} pending migration(s)? [Y/n]"
```

#### Step 3: Execute

```bash
npx typeorm migration:run -d src/data-source.ts
```

#### Step 4: Verify

```yaml
- Check that migration completed without errors
- Run a quick health check query (SELECT 1)
- Report success or failure with details
```

### /migrate revert

#### Step 1: Identify Last Migration

```yaml
Show the last applied migration and its down() changes.
```

#### Step 2: Confirm

```yaml
Ask: "Revert migration '{name}'? This will execute the down() method. [Y/n]"

If --production:
  Additional warning: "WARNING: Reverting in production. Ensure no dependent code is running."
```

#### Step 3: Execute

```bash
npx typeorm migration:revert -d src/data-source.ts
```

### /migrate status

#### Output Format

```markdown
## Migration Status

| # | Migration | Status | Applied At |
|---|-----------|--------|------------|
| 1 | 1700000001-create-users-table | APPLIED | 2025-01-10 10:00:00 |
| 2 | 1700000002-create-orders-table | APPLIED | 2025-01-10 10:00:01 |
| 3 | 1700000003-add-status-to-users | PENDING | — |

Pending: 1 migration(s)
```

## Migration Naming Conventions

```
{timestamp}-{action}-{description}.ts

Actions:
  create-{table}          — New table
  add-{column}-to-{table} — Add column
  remove-{column}-from-{table} — Remove column
  alter-{column}-in-{table}    — Change column type
  create-{index-name}-index    — Add index
  seed-{description}           — Data seeding
```

## Safety Rules

1. **NEVER** modify a migration that has been applied to any environment
2. **ALWAYS** test migrations against production-sized data
3. **ALWAYS** write both `up()` and `down()` methods
4. **ALWAYS** use transactions for DDL changes
5. **NEVER** run `synchronize: true` in production
6. **ALWAYS** back up database before running migrations in production
