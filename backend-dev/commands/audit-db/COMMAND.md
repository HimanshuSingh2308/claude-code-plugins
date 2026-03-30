---
name: audit-db
description: >
  Run a comprehensive database audit covering schema design, indexing, query performance,
  security, and scalability. Supports PostgreSQL (TypeORM), Firestore, and Redis.
  Outputs a scored report with prioritized fixes.
user_invocable: true
---

# Audit Database

Run a comprehensive database audit on the current project.

**Arguments**: `[target]` — optional: `schema`, `indexes`, `queries`, `security`, `all` (default: `all`)

## Overview

| Check Area | What It Audits |
|-----------|---------------|
| Schema Design | Normalization, naming, types, constraints, relationships |
| Indexing | Missing indexes, unused indexes, over-indexing, composite index order |
| Query Performance | N+1 queries, missing pagination, SELECT *, slow patterns |
| Security | SQL injection risk, RLS, permission gaps, exposed admin routes |
| Migrations | Pending migrations, irreversible changes, missing rollbacks |
| Scalability | Table size estimates, partitioning candidates, connection pooling |

## Command Options

```
/audit-db [target] [options]

Targets:
  all                  Full audit (default)
  schema               Schema design only
  indexes              Index analysis only
  queries              Query patterns only
  security             Security check only

Options:
  --fix                Suggest and apply fixes with confirmation
  --verbose            Show detailed findings per file
  --entity <name>      Audit a single entity/table
```

## Usage Examples

```bash
# Full database audit
/audit-db

# Schema design only
/audit-db schema

# Audit a single entity
/audit-db --entity User

# Audit and fix
/audit-db --fix
```

## Workflow

### Step 1: Detect Database Technology

```yaml
Scan project for:
  - TypeORM: look for *.entity.ts, data-source.ts, ormconfig
  - Prisma: look for prisma/schema.prisma
  - Firestore: look for firebase-admin imports, firestore references
  - Raw SQL: look for *.sql files, knex config
  - Redis: look for ioredis/redis imports

Report which database(s) are detected.
```

### Step 2: Schema Audit

For each entity/table, check:

```yaml
Naming:
  - Table names: snake_case, plural (users, not User)
  - Column names: snake_case (created_at, not createdAt)
  - Foreign keys: {table}_id pattern (user_id, not userId)
  - Consistent naming across all entities

Primary Keys:
  - Every table has a PK
  - PK type appropriate (UUID for distributed, SERIAL for simple)
  - No composite PKs on large tables (performance concern)

Timestamps:
  - created_at present on every entity
  - updated_at present on mutable entities
  - deleted_at for soft-deletable entities
  - Timezone-aware (TIMESTAMPTZ not TIMESTAMP)

Types:
  - Correct type for data (VARCHAR length, DECIMAL precision)
  - JSONB instead of TEXT for structured data
  - Enums for finite value sets
  - UUID for IDs exposed to clients

Constraints:
  - NOT NULL on required fields
  - UNIQUE on natural keys (email, slug)
  - CHECK constraints for value ranges
  - Foreign keys defined with proper ON DELETE

Relations:
  - All foreign keys reference valid entities
  - Cascade rules appropriate (CASCADE, SET NULL, RESTRICT)
  - No orphan references possible
  - Junction tables for M:N relationships
```

### Step 3: Index Audit

```yaml
Missing Indexes:
  - Foreign key columns without indexes
  - Columns used in WHERE clauses (scan service/repository files)
  - Columns used in ORDER BY
  - Columns used in JOIN conditions

Over-Indexing:
  - Indexes on low-cardinality columns (boolean, status with 3 values)
  - Redundant indexes (index on A when composite A,B exists)
  - Too many indexes on write-heavy tables (>8 indexes)

Composite Index Order:
  - Equality columns first, range columns last
  - Most selective column first
  - ORDER BY column included

Special Indexes:
  - GIN for JSONB columns (if queried)
  - Full-text search indexes (if text search used)
  - Partial indexes for filtered queries
  - Covering indexes for index-only scans
```

### Step 4: Query Performance Audit

Scan service and repository files for:

```yaml
N+1 Queries:
  - Loops that make DB calls (forEach with await query)
  - Relations loaded one-by-one instead of eager/join
  - Missing DataLoader for GraphQL resolvers

Pagination:
  - Large result sets without LIMIT
  - OFFSET-based pagination on large tables (should use cursor)
  - No default limit on list endpoints

SELECT *:
  - Repository.find() without select option
  - QueryBuilder without .select()
  - Loading full entities when only 2 fields needed

Slow Patterns:
  - LIKE '%search%' (can't use index, use FTS instead)
  - DISTINCT on large result sets
  - Subqueries that could be JOINs
  - COUNT(*) on large tables (use approximation or cache)
  - OR conditions that prevent index usage
```

### Step 5: Security Audit

```yaml
SQL Injection:
  - Raw queries with string concatenation
  - Template literals in query strings
  - User input passed directly to WHERE clauses

Access Control:
  - Entities accessible without auth check
  - Missing row-level filtering (tenant_id, user_id)
  - Admin endpoints without role guard
  - Bulk operations without ownership verification

Data Exposure:
  - Sensitive fields returned in API responses (password hash, tokens)
  - Internal IDs exposed (sequential, predictable)
  - Error messages leaking schema information

Firestore-specific:
  - Security rules defined and deployed
  - No open read/write rules in production
  - Custom claims used for role-based access
  - Field-level validation in rules
```

### Step 6: Migration Audit

```yaml
Pending:
  - Unmigrated entity changes (diff entities vs last migration)
  - Generated but not run migrations

Safety:
  - Migrations that drop columns (data loss risk)
  - Migrations that change column types (potential data corruption)
  - Migrations without down() method (irreversible)
  - Large data migrations without batching

Best Practices:
  - Migration naming convention (timestamp prefix)
  - One logical change per migration
  - No seed data in migrations (use seeders)
```

### Step 7: Scalability Check

```yaml
Table Size Estimates:
  - Estimate rows after 1 year based on write frequency
  - Flag tables likely to exceed 10M rows (partition candidates)
  - Flag tables likely to exceed 1GB (archive candidates)

Connection Management:
  - Connection pool configured (not default)
  - Pool size appropriate for deployment (Cloud Run = low, VM = higher)
  - Connection timeout configured
  - Idle connection cleanup

Caching Opportunities:
  - Frequently-read, rarely-updated data without caching
  - Aggregation queries that could be materialized views
  - Config/catalog data loaded on every request
```

### Step 8: Output Report

```markdown
## Database Audit Report

**Project**: {project-name}
**Database**: PostgreSQL via TypeORM / Firestore / Redis
**Entities**: {count}
**Date**: {date}

### Overall Score: {n}/100

| Category | Score | Issues |
|----------|-------|--------|
| Schema Design | 75/100 | 3 issues |
| Indexing | 60/100 | 5 issues |
| Query Performance | 80/100 | 2 issues |
| Security | 70/100 | 4 issues |
| Migrations | 90/100 | 1 issue |
| Scalability | 65/100 | 3 issues |

### Critical Issues (fix immediately)

1. **[SECURITY]** `POST /admin/seed-catalog` has no role guard
   - File: customizations.controller.ts:170
   - Fix: Add `@UseGuards(AdminGuard)` or `@Roles('admin')`

2. **[INDEX]** `scores.game_id` has no index but used in WHERE
   - File: leaderboard.service.ts:45
   - Fix: Add `@Index()` to `gameId` column in Score entity

### High Issues

...

### Recommendations

1. Add missing indexes (5 columns identified)
2. Implement cursor pagination for leaderboard
3. Add Redis caching for game catalog
4. Set up pg_stat_statements for query monitoring
```

## Scoring Rubric

| Score | Meaning |
|-------|---------|
| 90-100 | Production-ready, well-optimized |
| 70-89 | Good, minor improvements needed |
| 50-69 | Adequate, several issues to address |
| 30-49 | Concerning, significant gaps |
| 0-29 | Critical, needs immediate attention |

## Notes

- For TypeORM projects, reads entity files + migration files + service/repository files
- For Firestore projects, reads security rules + data access patterns
- Use Context7 MCP to verify latest TypeORM/Firestore best practices
- Run with `--fix` to auto-generate migration files for schema fixes
- The audit does NOT run actual database queries — it's static analysis only
