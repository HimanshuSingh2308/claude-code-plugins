---
name: redis
description: >
  Redis-specific patterns and data structures. Covers strings, hashes, lists, sets,
  sorted sets, TTL and expiration, pub/sub, Redis Streams, Lua scripting, connection
  management with ioredis, cluster mode, Sentinel HA, memory management, and key
  naming conventions. Applied automatically when working with Redis, caching, or sessions.
---

# Redis Patterns

This skill covers Redis-specific data structures, operations, and best practices
for use in NestJS backend applications.

## Data Structures

### Strings

```typescript
// Basic key-value (most common for caching)
await redis.set('user:123:name', 'Alice');
await redis.get('user:123:name'); // "Alice"

// With expiration
await redis.set('session:abc', JSON.stringify(data), 'EX', 3600); // 1 hour
await redis.setex('temp:key', 300, 'value'); // 5 minutes

// Set if not exists (for locks)
const acquired = await redis.setnx('lock:order:456', 'worker-1');
// Or with NX and EX combined
await redis.set('lock:order:456', 'worker-1', 'NX', 'EX', 30);

// Atomic increment/decrement
await redis.incr('counter:visits');           // +1
await redis.incrby('counter:visits', 10);     // +10
await redis.decr('counter:stock:item-1');     // -1

// Multiple operations
await redis.mset('k1', 'v1', 'k2', 'v2', 'k3', 'v3');
const values = await redis.mget('k1', 'k2', 'k3'); // ["v1", "v2", "v3"]
```

### Hashes

```typescript
// Hash: map of field-value pairs (like an object)
// Great for storing structured data without serialization

// Set fields
await redis.hset('user:123', {
  name: 'Alice',
  email: 'alice@example.com',
  role: 'admin',
  loginCount: '42',
});

// Get single field
const name = await redis.hget('user:123', 'name'); // "Alice"

// Get all fields
const user = await redis.hgetall('user:123');
// { name: "Alice", email: "alice@example.com", role: "admin", loginCount: "42" }

// Increment field
await redis.hincrby('user:123', 'loginCount', 1); // 43

// Check field exists
await redis.hexists('user:123', 'email'); // 1

// Delete field
await redis.hdel('user:123', 'deprecated_field');

// Get specific fields
const partial = await redis.hmget('user:123', 'name', 'email');
```

### Lists

```typescript
// List: ordered collection (linked list)
// Great for: queues, activity feeds, recent items

// Push
await redis.rpush('queue:emails', 'email-1', 'email-2'); // Right push
await redis.lpush('queue:emails', 'email-0');              // Left push (prepend)

// Pop (for queue processing)
const item = await redis.lpop('queue:emails');  // Remove from left
const item2 = await redis.rpop('queue:emails'); // Remove from right

// Blocking pop (wait for item, great for workers)
const [key, value] = await redis.blpop('queue:emails', 30); // Wait 30 seconds

// Get range
const items = await redis.lrange('recent:posts', 0, 9); // First 10

// Trim (keep only recent N items)
await redis.ltrim('recent:posts', 0, 99); // Keep last 100

// Length
const len = await redis.llen('queue:emails');
```

### Sets

```typescript
// Set: unordered unique collection
// Great for: tags, unique visitors, relationships

// Add members
await redis.sadd('tags:post:1', 'javascript', 'typescript', 'nodejs');

// Check membership
await redis.sismember('tags:post:1', 'javascript'); // 1 (true)

// Get all members
const tags = await redis.smembers('tags:post:1');

// Set operations
await redis.sinter('tags:post:1', 'tags:post:2');  // Intersection
await redis.sunion('tags:post:1', 'tags:post:2');  // Union
await redis.sdiff('tags:post:1', 'tags:post:2');   // Difference

// Random member
await redis.srandmember('tags:post:1');

// Count
await redis.scard('tags:post:1'); // 3

// Remove
await redis.srem('tags:post:1', 'nodejs');
```

### Sorted Sets

```typescript
// Sorted Set: set with scores, sorted by score
// Great for: leaderboards, rate limiting, priority queues, time-series

// Add with scores
await redis.zadd('leaderboard', 1500, 'alice', 1200, 'bob', 1800, 'charlie');

// Get top N (highest score)
const top = await redis.zrevrange('leaderboard', 0, 9); // Top 10
const topWithScores = await redis.zrevrange('leaderboard', 0, 9, 'WITHSCORES');

// Get rank
const rank = await redis.zrevrank('leaderboard', 'alice'); // 0-based

// Get score
const score = await redis.zscore('leaderboard', 'alice'); // "1500"

// Increment score
await redis.zincrby('leaderboard', 100, 'alice'); // 1600

// Range by score
const mid = await redis.zrangebyscore('leaderboard', 1000, 1500);

// Count in score range
const count = await redis.zcount('leaderboard', 1000, 1500);

// Remove by score range (cleanup old entries)
await redis.zremrangebyscore('rate:user:123', 0, Date.now() - 60000);
```

## TTL and Expiration Patterns

```typescript
// Set TTL on existing key
await redis.expire('session:abc', 3600);       // 1 hour from now
await redis.expireat('session:abc', timestamp); // Specific Unix timestamp
await redis.pexpire('temp:key', 500);           // 500 milliseconds

// Check TTL
const ttl = await redis.ttl('session:abc');     // Seconds remaining (-1 = no expiry, -2 = not found)

// Remove TTL (persist forever)
await redis.persist('session:abc');

// Patterns
// - Short TTL for rate limits: 1-60 seconds
// - Medium TTL for cache: 5 minutes - 1 hour
// - Long TTL for sessions: 1-30 days
// - No TTL for reference data (invalidate manually)
```

## Pub/Sub

```typescript
// Publisher
const pub = new Redis();
await pub.publish('notifications', JSON.stringify({
  type: 'order.created',
  data: { orderId: '123' },
}));

// Subscriber
const sub = new Redis();
await sub.subscribe('notifications', 'events');

sub.on('message', (channel, message) => {
  const event = JSON.parse(message);
  console.log(`[${channel}] ${event.type}:`, event.data);
});

// Pattern subscribe (wildcards)
await sub.psubscribe('orders.*');
sub.on('pmessage', (pattern, channel, message) => {
  console.log(`[${pattern}] ${channel}:`, message);
});

// NOTE: Pub/Sub is fire-and-forget. Messages are lost if no subscriber
// is listening. For reliable messaging, use Redis Streams or BullMQ.
```

## Redis Streams

```typescript
// Streams: append-only log with consumer groups
// Better than Pub/Sub for reliable message processing

// Add to stream
await redis.xadd('orders', '*', 'orderId', '123', 'total', '99.99');

// Create consumer group
await redis.xgroup('CREATE', 'orders', 'order-processors', '0', 'MKSTREAM');

// Read as consumer in group
const messages = await redis.xreadgroup(
  'GROUP', 'order-processors', 'worker-1',
  'COUNT', 10,
  'BLOCK', 5000,  // Wait 5s for new messages
  'STREAMS', 'orders', '>'
);

// Acknowledge processed message
await redis.xack('orders', 'order-processors', messageId);

// Read pending (unacknowledged) messages
const pending = await redis.xpending('orders', 'order-processors');
```

## Lua Scripting

```typescript
// Atomic operations with Lua scripts
// Executes atomically on Redis server (no race conditions)

// Rate limiter (sliding window, atomic)
const rateLimitScript = `
  local key = KEYS[1]
  local limit = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])

  redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
  local count = redis.call('ZCARD', key)

  if count < limit then
    redis.call('ZADD', key, now, now .. ':' .. math.random())
    redis.call('EXPIRE', key, window / 1000)
    return 1
  else
    return 0
  end
`;

const allowed = await redis.eval(
  rateLimitScript, 1,
  `rate:${userId}`, 100, 60000, Date.now()
);

// Define reusable scripts
const redis = new Redis();
redis.defineCommand('rateLimit', {
  numberOfKeys: 1,
  lua: rateLimitScript,
});

// Use as: await redis.rateLimit(key, limit, window, now);
```

## Connection Management (ioredis)

```typescript
import Redis from 'ioredis';

// Single connection
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  db: 0,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
  lazyConnect: true,    // Connect on first command
  enableReadyCheck: true,
});

// Error handling
redis.on('error', (err) => console.error('Redis error:', err));
redis.on('connect', () => console.log('Redis connected'));
redis.on('ready', () => console.log('Redis ready'));

// Pipeline (batch commands, single round-trip)
const pipeline = redis.pipeline();
pipeline.get('key1');
pipeline.get('key2');
pipeline.set('key3', 'value3');
const results = await pipeline.exec(); // [[null, val1], [null, val2], [null, 'OK']]

// Transaction (atomic pipeline)
const multi = redis.multi();
multi.decrby('balance:from', 100);
multi.incrby('balance:to', 100);
await multi.exec(); // All or nothing
```

## Key Naming Conventions

```
Pattern: {entity}:{id}:{field}

Examples:
  user:123                    — User hash
  user:123:name               — User name string
  user:123:sessions           — User sessions set
  session:abc123              — Session data
  cache:users:list:page:1     — Cached user list page 1
  cache:user:123              — Cached single user
  rate:ip:192.168.1.1         — Rate limit by IP
  rate:user:123               — Rate limit by user
  lock:order:456              — Distributed lock
  queue:emails                — Email queue
  leaderboard:weekly          — Weekly leaderboard
  counter:visits:2025-01-15   — Daily visit counter
  stream:orders               — Order event stream

Rules:
  - Use colons as separators
  - Use lowercase
  - Keep keys short but descriptive
  - Include entity type prefix
  - Include identifiers
  - Use consistent patterns across the app
```

## Memory Management

```bash
# Check memory usage
redis-cli INFO memory

# Key memory analysis
redis-cli MEMORY USAGE "user:123"  # Bytes for single key

# Set max memory
CONFIG SET maxmemory 256mb

# Eviction policies
CONFIG SET maxmemory-policy allkeys-lru    # Evict least recently used (recommended)
# Other options: volatile-lru, allkeys-random, volatile-ttl, noeviction

# Find large keys
redis-cli --bigkeys

# Scan for keys matching pattern (safe, non-blocking)
redis-cli --scan --pattern "cache:*" --count 100
```

## Anti-Patterns

1. **NEVER** use `KEYS *` in production (blocks server). Use `SCAN` instead
2. **NEVER** store large blobs (>1MB). Use object storage + reference
3. **NEVER** use Redis as primary database (it is a cache/store, not ACID)
4. **NEVER** create unbounded lists/sets (set max length or TTL)
5. **NEVER** use Pub/Sub for reliable messaging (use Streams or BullMQ)
6. **NEVER** forget to set TTL on cache keys (memory leak)
7. **NEVER** parse JSON repeatedly (consider hashes for structured data)
8. **NEVER** use Redis transactions when you need Lua atomicity (multi/exec is not the same)
