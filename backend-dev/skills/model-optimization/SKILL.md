---
name: model-optimization
description: >
  Data model optimization patterns for backend applications. Covers entity design for
  performance, lazy vs eager loading, projection queries, denormalization strategies,
  computed/virtual columns, polymorphic patterns, and memory-efficient data structures.
  Applied when entities are slow, responses are bloated, or models need restructuring.
trigger: >
  When user optimizes entities, reduces response payload, fixes slow queries caused by
  model design, restructures data models, or discusses entity relationships performance.
  When user mentions "model is slow", "response too large", "entity optimization".
---

# Data Model Optimization

## Core Principle

> Your model is not your schema. Your schema serves your queries.
> If reads are slow, reshape the model. If writes are slow, simplify the model.

---

## 1. Lazy vs Eager Loading

### The N+1 Problem

```typescript
// ❌ BAD — N+1 queries (1 for orders + N for users)
const orders = await orderRepo.find(); // SELECT * FROM orders
for (const order of orders) {
  order.user = await userRepo.findOne(order.userId); // N queries
}

// ✅ GOOD — eager join (1 query)
const orders = await orderRepo.find({
  relations: ['user'],
});

// ✅ BETTER — selective join (1 query, only needed fields)
const orders = await orderRepo
  .createQueryBuilder('order')
  .leftJoin('order.user', 'user')
  .select(['order.id', 'order.total', 'user.name', 'user.email'])
  .getMany();
```

### TypeORM Loading Strategies

```typescript
@Entity()
export class Order {
  // ❌ NEVER use eager: true on large relations
  @ManyToOne(() => User, { eager: true })  // loads user on EVERY query
  user: User;

  // ✅ Default: lazy (load only when accessed)
  @ManyToOne(() => User)
  user: User;

  // ✅ Best: explicit join in repository when needed
  // orderRepo.find({ relations: ['user'] })
}
```

### When to Use Each

| Strategy | Use When | Avoid When |
|----------|----------|------------|
| **Eager** | Relation needed in 95%+ of queries, small payload | Large relations, list endpoints |
| **Lazy** | Relation rarely needed | Frequent access (triggers extra query) |
| **Explicit join** | Control per-query what's loaded | Simple CRUD with no joins |
| **DataLoader** | GraphQL resolvers with batched access | REST endpoints |

---

## 2. Projection — Select Only What You Need

```typescript
// ❌ BAD — loads entire user entity (20+ columns)
const users = await userRepo.find();

// ✅ GOOD — select only needed fields
const users = await userRepo.find({
  select: ['id', 'name', 'email', 'avatar'],
});

// ✅ GOOD — QueryBuilder projection
const leaderboard = await scoreRepo
  .createQueryBuilder('s')
  .select(['s.userId', 's.score', 's.createdAt'])
  .where('s.gameId = :gameId', { gameId })
  .orderBy('s.score', 'DESC')
  .limit(10)
  .getRawMany();

// ✅ BEST — DTO projection (return shape matches API response)
const users = await userRepo
  .createQueryBuilder('u')
  .select('u.id', 'id')
  .addSelect('u.name', 'name')
  .addSelect('u.avatar', 'avatarUrl')
  .addSelect('COUNT(s.id)', 'totalGames')
  .leftJoin('u.scores', 's')
  .groupBy('u.id')
  .getRawMany();
```

### Payload Size Impact

| Approach | Columns Loaded | Payload | Network Cost |
|----------|---------------|---------|-------------|
| `find()` (full entity) | 20 columns | ~2KB/row | 20KB for 10 rows |
| `find({ select: [...] })` | 4 columns | ~200B/row | 2KB for 10 rows |
| Raw projection | 3 columns + computed | ~150B/row | 1.5KB for 10 rows |

**Rule**: Never return more data than the client renders.

---

## 3. Denormalization for Read Performance

### Pre-Computed Fields

```typescript
@Entity()
export class User {
  @Column({ default: 0 })
  totalGamesPlayed: number;  // denormalized — updated on each score submit

  @Column({ default: 0 })
  highestScore: number;  // denormalized — updated on new high score

  @Column({ nullable: true })
  lastPlayedAt: Date;  // denormalized — updated on each game
}

// Update on score submission (one extra write, saves COUNT query every time)
async submitScore(userId: string, score: number) {
  await this.scoreRepo.save({ userId, score, ... });

  // Update denormalized fields atomically
  await this.userRepo
    .createQueryBuilder()
    .update(User)
    .set({
      totalGamesPlayed: () => 'total_games_played + 1',
      highestScore: () => `GREATEST(highest_score, ${score})`,
      lastPlayedAt: new Date(),
    })
    .where('id = :userId', { userId })
    .execute();
}
```

### Materialized Aggregations

```typescript
// Instead of computing leaderboard on every request:
// ❌ SELECT user_id, SUM(score) FROM scores GROUP BY user_id ORDER BY SUM(score) DESC

// ✅ Pre-compute into a summary table
@Entity('leaderboard_daily')
export class DailyLeaderboard {
  @PrimaryColumn()
  gameId: string;

  @PrimaryColumn()
  userId: string;

  @Column()
  totalScore: number;

  @Column()
  gamesPlayed: number;

  @Column()
  bestScore: number;

  @Column({ type: 'date' })
  date: string;

  @Index()
  @Column()
  rank: number;
}

// Refresh via cron job or on-write trigger
```

### When to Denormalize

| Signal | Action |
|--------|--------|
| COUNT/SUM query on every request | Add pre-computed column |
| JOIN 3+ tables for a single API response | Flatten into a read model |
| Same aggregation computed > 10x/minute | Materialize into a summary table |
| Response includes data from 5+ entities | Create a view or denormalized table |

---

## 4. Polymorphic / Inheritance Patterns

### Single Table Inheritance (STI)

One table, discriminator column — best for few subtypes with similar fields:

```typescript
@Entity()
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  message: string;

  @CreateDateColumn()
  createdAt: Date;
}

@ChildEntity('achievement')
export class AchievementNotification extends Notification {
  @Column()
  achievementId: string;
}

@ChildEntity('score')
export class ScoreNotification extends Notification {
  @Column()
  gameId: string;

  @Column()
  score: number;
}
```

**Pros**: Single query gets all types, simple JOINs
**Cons**: Many NULL columns if subtypes diverge, table gets wide

### JSONB Column (Flexible Schema)

```typescript
@Entity()
export class GameEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  type: string; // 'score_submit' | 'achievement_unlock' | 'purchase'

  @Column({ type: 'jsonb' })
  data: Record<string, unknown>; // flexible per event type

  @CreateDateColumn()
  createdAt: Date;

  @Index()
  @Column()
  userId: string;
}

// Query specific event types efficiently
const purchases = await repo
  .createQueryBuilder('e')
  .where("e.type = 'purchase'")
  .andWhere("e.data->>'itemId' = :itemId", { itemId })
  .getMany();
```

**Pros**: No schema changes for new types, flexible
**Cons**: No column-level validation, harder to index deeply nested fields

### Which Pattern to Use

| Scenario | Pattern | Why |
|----------|---------|-----|
| 2-4 subtypes, 80%+ shared fields | STI | Simple, one table |
| 5+ subtypes, many unique fields | JSONB column | Avoids wide table with NULLs |
| Subtypes queried independently | Separate tables | Clean schema, no discriminator overhead |
| Audit log / event sourcing | JSONB column | Each event has different shape |

---

## 5. Computed / Virtual Columns

### Database-Level Computed

```sql
-- PostgreSQL generated column (stored, indexed)
ALTER TABLE users ADD COLUMN
  full_name VARCHAR(511) GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED;

-- Virtual column via view
CREATE VIEW user_stats AS
SELECT
  u.id, u.name,
  COUNT(s.id) AS total_games,
  COALESCE(MAX(s.score), 0) AS high_score,
  COALESCE(AVG(s.score)::int, 0) AS avg_score
FROM users u
LEFT JOIN scores s ON s.user_id = u.id
GROUP BY u.id;
```

### Application-Level Virtual

```typescript
@Entity()
export class Score {
  @Column()
  score: number;

  @Column()
  fours: number;

  @Column()
  sixes: number;

  @Column()
  wicketsLost: number;

  // Virtual — not stored in DB, computed on read
  get finalScore(): number {
    return this.score + (this.fours * 2) + (this.sixes * 4) - (this.wicketsLost * 10);
  }

  // Virtual — for API response
  get strikeRate(): string {
    const balls = this.metadata?.ballsFaced || 1;
    return ((this.score / balls) * 100).toFixed(1);
  }
}
```

---

## 6. Response Shape Optimization

### Avoid Over-Fetching with Response DTOs

```typescript
// ❌ BAD — returns entire entity including internal fields
@Get(':id')
async getUser(@Param('id') id: string) {
  return this.userRepo.findOne(id);
  // Returns: { id, email, passwordHash, firebaseUid, internalNotes, ... }
}

// ✅ GOOD — map to response DTO
@Get(':id')
async getUser(@Param('id') id: string): Promise<UserResponseDto> {
  const user = await this.userRepo.findOne(id);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatarUrl,
    joinedAt: user.createdAt,
  };
}

// ✅ BEST — use class-transformer
import { Exclude, Expose, plainToInstance } from 'class-transformer';

export class UserResponseDto {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() email: string;
  @Exclude() passwordHash: string;
  @Exclude() firebaseUid: string;
}

// In controller
return plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });
```

### Nested Response Flattening

```typescript
// ❌ BAD — deeply nested response
{
  "user": {
    "id": "...",
    "profile": {
      "name": "...",
      "settings": {
        "theme": "dark",
        "notifications": {
          "email": true
        }
      }
    }
  }
}

// ✅ GOOD — flat, client-friendly
{
  "id": "...",
  "name": "...",
  "theme": "dark",
  "emailNotifications": true
}
```

---

## 7. Index-Aware Model Design

Design entities so common queries hit indexes:

```typescript
@Entity()
@Index(['gameId', 'period', 'score']) // composite for leaderboard query
@Index(['userId', 'createdAt'])        // composite for user history
export class Score {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  gameId: string;

  @Column()
  userId: string;

  @Column()
  score: number;

  @Column({ type: 'enum', enum: ['daily', 'weekly', 'monthly'] })
  period: string;

  @CreateDateColumn()
  createdAt: Date;
}

// The composite index on (gameId, period, score DESC) serves:
// WHERE gameId = ? AND period = ? ORDER BY score DESC LIMIT 10
// — this is the #1 most frequent query (leaderboard)
```

---

## 8. Model Optimization Checklist

```
□ No eager: true on any relation (use explicit joins)
□ List endpoints use select/projection (not full entities)
□ Response DTOs exclude internal fields (passwordHash, etc.)
□ Frequently-computed aggregations are denormalized
□ Composite indexes match the most common WHERE + ORDER BY
□ JSONB used for flexible/sparse data instead of wide tables
□ Virtual/computed fields used instead of storing derived data
□ Pagination uses cursor (not OFFSET) for large tables
□ Relations loaded only when needed (check each endpoint)
□ No circular entity references in API responses
□ Response payload < 10KB for list endpoints, < 50KB for detail
□ Entity has appropriate timestamps (created_at, updated_at)
```
