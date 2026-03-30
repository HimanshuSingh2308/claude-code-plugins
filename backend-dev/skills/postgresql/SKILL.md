---
name: postgresql
description: >
  PostgreSQL-specific patterns and features. Covers data types (jsonb, array, enum, uuid),
  index types (B-tree, GIN, GiST, BRIN), full-text search, JSONB operations, window
  functions, CTEs, materialized views, partitioning, VACUUM/ANALYZE, connection pooling,
  query analysis, and row-level security. Applied automatically when working with
  PostgreSQL, writing SQL, or optimizing queries.
---

# PostgreSQL Patterns

This skill covers PostgreSQL-specific features and optimization techniques
beyond generic database patterns.

## Data Types

### JSONB

```sql
-- JSONB: binary JSON, indexable, slightly slower writes, faster reads
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  attributes JSONB NOT NULL DEFAULT '{}',
  tags JSONB NOT NULL DEFAULT '[]'
);

-- Insert
INSERT INTO products (name, attributes, tags)
VALUES (
  'Laptop',
  '{"brand": "Dell", "specs": {"ram": 16, "storage": 512}, "colors": ["silver", "black"]}',
  '["electronics", "computers"]'
);
```

### Arrays

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  roles TEXT[] NOT NULL DEFAULT '{}',
  scores INTEGER[] DEFAULT '{}'
);

-- Insert
INSERT INTO users (name, roles) VALUES ('Alice', ARRAY['admin', 'editor']);

-- Query
SELECT * FROM users WHERE 'admin' = ANY(roles);
SELECT * FROM users WHERE roles @> ARRAY['admin']; -- contains
SELECT * FROM users WHERE roles && ARRAY['admin', 'editor']; -- overlaps
```

### Enums

```sql
-- Create enum type
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'deleted');

-- Use in table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status user_status NOT NULL DEFAULT 'active'
);

-- Add value to existing enum (no removal possible)
ALTER TYPE user_status ADD VALUE 'pending' BEFORE 'active';
```

### UUID

```sql
-- gen_random_uuid() is built-in since PostgreSQL 13
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(20) NOT NULL
);

-- UUID is 128-bit, excellent for distributed systems
-- Index performance: comparable to BIGINT for B-tree
```

### Timestamps

```sql
-- ALWAYS use WITH TIME ZONE
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- NEVER use TIMESTAMP WITHOUT TIME ZONE (ambiguous)
```

## Index Types

### B-tree (Default)

```sql
-- Best for: equality, range, sorting, LIKE 'prefix%'
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- Composite B-tree (left-to-right usage)
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
```

### GIN (Generalized Inverted Index)

```sql
-- Best for: JSONB, arrays, full-text search, trigrams
-- Slower to build/update, faster to query

-- JSONB containment queries
CREATE INDEX idx_products_attrs ON products USING GIN(attributes);
SELECT * FROM products WHERE attributes @> '{"brand": "Dell"}';
SELECT * FROM products WHERE attributes ? 'brand'; -- key exists
SELECT * FROM products WHERE attributes ?| ARRAY['brand', 'color']; -- any key exists

-- Array queries
CREATE INDEX idx_users_roles ON users USING GIN(roles);
SELECT * FROM users WHERE roles @> ARRAY['admin'];

-- Full-text search
CREATE INDEX idx_posts_search ON posts USING GIN(to_tsvector('english', title || ' ' || body));

-- Trigram (for LIKE '%substring%')
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_users_name_trgm ON users USING GIN(name gin_trgm_ops);
SELECT * FROM users WHERE name ILIKE '%john%'; -- Uses index!
```

### GiST (Generalized Search Tree)

```sql
-- Best for: geometric data, range types, nearest-neighbor
CREATE INDEX idx_locations_point ON locations USING GiST(coordinates);

-- Range types
CREATE INDEX idx_events_during ON events USING GiST(tstzrange(starts_at, ends_at));
```

### BRIN (Block Range Index)

```sql
-- Best for: naturally ordered data (timestamps, sequential IDs)
-- Very small index size, good for append-only tables

CREATE INDEX idx_logs_created ON logs USING BRIN(created_at);
-- Works well when physically ordered data correlates with column values
```

### Partial Indexes

```sql
-- Index only active records (smaller, faster)
CREATE INDEX idx_users_email_active ON users(email)
  WHERE deleted_at IS NULL;

-- Index only recent orders
CREATE INDEX idx_orders_recent ON orders(created_at DESC)
  WHERE created_at > NOW() - INTERVAL '30 days';
```

## Full-Text Search

```sql
-- Add tsvector column (precomputed for performance)
ALTER TABLE posts ADD COLUMN search_vector tsvector;

-- Populate
UPDATE posts SET search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(body, '')), 'B');

-- Create GIN index
CREATE INDEX idx_posts_search ON posts USING GIN(search_vector);

-- Auto-update with trigger
CREATE FUNCTION update_search_vector() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.body, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_posts_search
  BEFORE INSERT OR UPDATE OF title, body ON posts
  FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- Search with ranking
SELECT id, title,
  ts_rank(search_vector, query) AS rank
FROM posts, plainto_tsquery('english', 'database optimization') AS query
WHERE search_vector @@ query
ORDER BY rank DESC
LIMIT 20;

-- Phrase search
SELECT * FROM posts
WHERE search_vector @@ phraseto_tsquery('english', 'connection pooling');

-- Highlight matching text
SELECT ts_headline('english', body, plainto_tsquery('english', 'database'),
  'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15')
FROM posts
WHERE search_vector @@ plainto_tsquery('english', 'database');
```

## JSONB Operations

```sql
-- Access
SELECT attributes->>'brand' AS brand FROM products;           -- text
SELECT attributes->'specs'->'ram' AS ram FROM products;       -- jsonb
SELECT attributes #>> '{specs,ram}' AS ram FROM products;     -- text via path

-- Containment
SELECT * FROM products WHERE attributes @> '{"brand": "Dell"}';

-- Key existence
SELECT * FROM products WHERE attributes ? 'brand';            -- has key
SELECT * FROM products WHERE attributes ?& ARRAY['brand', 'specs']; -- has all keys
SELECT * FROM products WHERE attributes ?| ARRAY['brand', 'color']; -- has any key

-- Path queries
SELECT * FROM products WHERE attributes #>> '{specs,ram}' = '16';

-- Modify JSONB
UPDATE products SET attributes = attributes || '{"color": "silver"}';  -- merge
UPDATE products SET attributes = attributes - 'deprecated_field';       -- remove key
UPDATE products SET attributes = jsonb_set(attributes, '{specs,ram}', '32'); -- set path

-- Aggregate JSONB
SELECT jsonb_agg(name) FROM products WHERE attributes @> '{"brand": "Dell"}';
SELECT jsonb_object_agg(name, attributes->>'brand') FROM products;
```

## Window Functions

```sql
-- Row number (ranking)
SELECT name, department, salary,
  ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS rank
FROM employees;

-- Running total
SELECT date, amount,
  SUM(amount) OVER (ORDER BY date) AS running_total
FROM transactions;

-- Moving average
SELECT date, amount,
  AVG(amount) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS avg_7d
FROM daily_revenue;

-- Lead/Lag (compare with adjacent rows)
SELECT date, amount,
  LAG(amount) OVER (ORDER BY date) AS prev_amount,
  amount - LAG(amount) OVER (ORDER BY date) AS change
FROM daily_revenue;

-- Percentile
SELECT department,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary) AS median_salary,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY salary) AS p95_salary
FROM employees
GROUP BY department;
```

## CTEs (Common Table Expressions)

```sql
-- Readable subqueries
WITH active_users AS (
  SELECT id, name, email
  FROM users
  WHERE status = 'active' AND deleted_at IS NULL
),
user_orders AS (
  SELECT user_id, COUNT(*) AS order_count, SUM(total) AS total_spent
  FROM orders
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY user_id
)
SELECT u.name, u.email, COALESCE(o.order_count, 0) AS orders, COALESCE(o.total_spent, 0) AS spent
FROM active_users u
LEFT JOIN user_orders o ON o.user_id = u.id
ORDER BY spent DESC;

-- Recursive CTE (tree/hierarchy)
WITH RECURSIVE category_tree AS (
  -- Base case
  SELECT id, name, parent_id, 0 AS depth
  FROM categories
  WHERE parent_id IS NULL

  UNION ALL

  -- Recursive case
  SELECT c.id, c.name, c.parent_id, ct.depth + 1
  FROM categories c
  JOIN category_tree ct ON c.parent_id = ct.id
)
SELECT * FROM category_tree ORDER BY depth, name;
```

## Materialized Views

```sql
-- Create (stores results physically)
CREATE MATERIALIZED VIEW mv_user_stats AS
SELECT
  u.id AS user_id,
  u.name,
  COUNT(o.id) AS total_orders,
  COALESCE(SUM(o.total), 0) AS total_spent,
  MAX(o.created_at) AS last_order_at
FROM users u
LEFT JOIN orders o ON o.user_id = u.id AND o.status = 'completed'
GROUP BY u.id, u.name;

-- Create unique index (required for CONCURRENTLY refresh)
CREATE UNIQUE INDEX idx_mv_user_stats ON mv_user_stats(user_id);

-- Refresh (blocks reads)
REFRESH MATERIALIZED VIEW mv_user_stats;

-- Refresh concurrently (no blocking, requires unique index)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_stats;

-- Query like a regular table
SELECT * FROM mv_user_stats WHERE total_orders > 10 ORDER BY total_spent DESC;

-- Schedule refresh with pg_cron or application cron
```

## Partitioning

```sql
-- Range partitioning (by date)
CREATE TABLE events (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create partitions
CREATE TABLE events_2025_q1 PARTITION OF events
  FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');
CREATE TABLE events_2025_q2 PARTITION OF events
  FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');

-- Auto-create partitions with pg_partman extension
```

## VACUUM and ANALYZE

```sql
-- VACUUM: reclaims dead row space
VACUUM (VERBOSE) users;         -- Standard vacuum
VACUUM (FULL) users;            -- Reclaims all space (locks table)

-- ANALYZE: updates query planner statistics
ANALYZE users;
ANALYZE users(email, status);   -- Specific columns

-- Combined
VACUUM ANALYZE users;

-- Check dead tuples
SELECT relname, n_dead_tup, n_live_tup,
  round(n_dead_tup::numeric / NULLIF(n_live_tup, 0) * 100, 2) AS dead_pct
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

## Connection Pooling (PgBouncer)

```ini
; pgbouncer.ini
[databases]
myapp = host=localhost port=5432 dbname=myapp

[pgbouncer]
listen_port = 6432
listen_addr = 0.0.0.0
auth_type = md5
pool_mode = transaction    ; Most common mode
max_client_conn = 1000
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
```

## Query Analysis

```sql
-- Enable pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find slowest queries
SELECT
  calls,
  round(total_exec_time::numeric, 2) AS total_ms,
  round(mean_exec_time::numeric, 2) AS avg_ms,
  round(max_exec_time::numeric, 2) AS max_ms,
  rows,
  LEFT(query, 100) AS query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Find most called queries
SELECT calls, query
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 20;

-- Reset stats
SELECT pg_stat_statements_reset();
```

## Row-Level Security

```sql
-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy: users see only their own orders
CREATE POLICY user_orders ON orders
  USING (user_id = current_setting('app.current_user_id')::uuid);

-- Policy: admins see all
CREATE POLICY admin_all ON orders
  USING (current_setting('app.current_role') = 'admin');

-- Set context per request (in application)
SET app.current_user_id = 'user-uuid-here';
SET app.current_role = 'user';

-- Force RLS for table owner too
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
```
