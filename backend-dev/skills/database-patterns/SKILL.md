---
name: database-patterns
description: >
  Comprehensive database schema design patterns for scalable, performant backends.
  Covers normalization vs denormalization, indexing strategies, query optimization,
  migration best practices, multi-tenancy, audit trails, soft deletes, partitioning,
  connection pooling, and transaction patterns. Database-agnostic foundations with
  SQL and NoSQL examples.
trigger: >
  When user designs database schemas, creates tables/collections, writes migrations,
  discusses normalization, indexes, query performance, or database architecture.
---

# Database Schema Design — Scalable & Performant

## Core Philosophy

Design for your queries, not your entities. The shape of your data should mirror how you READ it.

## 1. Normalization vs Denormalization

### Normalized (3NF) — each fact stored once, JOINs for reads
### Denormalized — duplicate data for read speed, fan-out writes

| Scenario | Strategy | Why |
|----------|----------|-----|
| Read:Write > 10:1 | Denormalize | Reads dominate |
| Read:Write < 3:1 | Normalize | Writes dominate |
| Data changes rarely | Denormalize | Low sync cost |
| Real-time dashboards | Denormalize | No JOIN latency |
| Financial/transactional | Normalize | Consistency critical |

**Hybrid**: Normalize source of truth, create materialized views for hot paths.

## 2. Primary Key Design

| Type | Use When |
|------|----------|
| SERIAL/BIGSERIAL | Single DB, internal IDs |
| UUID v4 | Distributed systems, public APIs |
| ULID | Need time-sortable unique IDs |
| UUID v7 | Best of both (2025+) |

## 3. Indexing Strategy

Index columns in WHERE, ORDER BY, and JOIN ON clauses.

### PostgreSQL Index Types
- B-Tree (default): equality + range
- GIN: JSONB, arrays, full-text search
- Partial: index only matching rows
- Composite: multi-column queries (order matters!)
- Covering (INCLUDE): avoid table lookups

### Anti-Patterns
- Index on every column (slows writes)
- Index on low-cardinality (boolean)
- No index on foreign keys
- Not using EXPLAIN ANALYZE

## 4. Scaling Patterns

- Vertical partitioning: split hot/cold columns
- Horizontal partitioning: split rows by range/hash
- Read replicas: scale reads horizontally
- Connection pooling: PgBouncer (1000 app connections → 50 DB connections)

## 5. Soft Deletes

Never truly delete — add deleted_at column + partial index.

## 6. Audit Trail

Track all changes with trigger-based audit_log table (table_name, record_id, action, old_data, new_data, user_id, timestamp).

## 7. Multi-Tenancy

- Row-level: tenant_id on every table + RLS policies
- Schema-level: separate schema per tenant
- Database-level: separate DB per tenant (enterprise)

## 8. Migration Rules

1. Forward-only in production
2. Every migration reversible
3. Never drop column in same deploy that stops using it
4. Test on copy of production data

## 9. Query Optimization Checklist

- EXPLAIN ANALYZE all slow queries (>100ms)
- Composite indexes for multi-column filters
- Cursor pagination (not OFFSET)
- SELECT only needed columns
- Batch INSERTs
- Monitor pg_stat_statements

## 10. Schema Design Checklist

- Every table: PK, created_at, updated_at
- Soft delete on user-facing entities
- Foreign keys have indexes
- JSONB for flexible data
- NOT NULL on required fields
- Migrations tested with rollback
