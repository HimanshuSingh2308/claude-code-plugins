---
name: caching-queues
description: >
  Caching and background job patterns for backend applications. Covers Redis caching
  strategies (cache-aside, write-through, TTL), cache invalidation, Bull/BullMQ queue
  patterns, background job design, pub/sub, session storage, distributed locking,
  and rate limiting with Redis. Applied automatically when working with caching,
  Redis, queues, or background jobs.
---

# Caching & Background Jobs

This skill provides patterns for Redis-based caching and BullMQ queue management
in NestJS applications.

## Caching Strategies

### Cache-Aside (Lazy Loading)

```typescript
// Most common pattern: check cache first, load from DB on miss
async getUser(id: string): Promise<User> {
  const cacheKey = `user:${id}`;

  // 1. Check cache
  const cached = await this.redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // 2. Load from DB
  const user = await this.userRepo.findOne({ where: { id } });
  if (!user) throw new NotFoundException();

  // 3. Store in cache
  await this.redis.set(cacheKey, JSON.stringify(user), 'EX', 3600); // 1 hour

  return user;
}

// Invalidate on write
async updateUser(id: string, dto: UpdateUserDto): Promise<User> {
  const user = await this.userRepo.save({ id, ...dto });
  await this.redis.del(`user:${id}`);    // Invalidate cache
  await this.redis.del('users:list:*');   // Invalidate list caches
  return user;
}
```

**Pros:** Only caches what is actually requested, cache misses are rare after warmup
**Cons:** First request is always slow (cache miss), potential stale data window

### Write-Through

```typescript
// Write to cache AND DB simultaneously
async createUser(dto: CreateUserDto): Promise<User> {
  const user = await this.userRepo.save(dto);
  await this.redis.set(`user:${user.id}`, JSON.stringify(user), 'EX', 3600);
  return user;
}
```

**Pros:** Cache always has latest data
**Cons:** Write latency increases, caches data that may never be read

### TTL Strategies

```
Short TTL (1-5 minutes):
  - Session data
  - Rate limit counters
  - Real-time dashboards
  - Frequently changing data

Medium TTL (1-24 hours):
  - User profiles
  - Product listings
  - API responses

Long TTL (1-7 days):
  - Static reference data
  - Configuration
  - Feature flags

No TTL (manual invalidation):
  - Session tokens (invalidate on logout)
  - Cached computations (invalidate on source change)
```

## Cache Invalidation

### Event-Based Invalidation

```typescript
// Using NestJS EventEmitter
@Injectable()
export class UserCacheInvalidator {
  constructor(
    @Inject(CACHE_MANAGER) private cache: Cache,
    private eventEmitter: EventEmitter2,
  ) {
    this.eventEmitter.on('user.updated', (userId: string) => {
      this.cache.del(`user:${userId}`);
    });

    this.eventEmitter.on('user.deleted', (userId: string) => {
      this.cache.del(`user:${userId}`);
      this.invalidateListCaches();
    });
  }

  private async invalidateListCaches() {
    // Use Redis SCAN to find and delete pattern-matched keys
    const keys = await this.scanKeys('users:list:*');
    if (keys.length) await this.redis.del(...keys);
  }
}
```

### Tag-Based Invalidation

```typescript
// Store cache keys by tag for bulk invalidation
async setCacheWithTags(key: string, value: any, tags: string[], ttl: number) {
  await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
  for (const tag of tags) {
    await this.redis.sadd(`cache:tag:${tag}`, key);
  }
}

async invalidateByTag(tag: string) {
  const keys = await this.redis.smembers(`cache:tag:${tag}`);
  if (keys.length) {
    await this.redis.del(...keys);
    await this.redis.del(`cache:tag:${tag}`);
  }
}

// Usage
await setCacheWithTags('user:1', user, ['users', 'tenant:abc'], 3600);
await invalidateByTag('users'); // Clears all user caches
```

## NestJS Cache Integration

```typescript
// Module setup with Redis
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          socket: { host: 'localhost', port: 6379 },
          ttl: 60 * 1000, // default 60s in milliseconds
        }),
      }),
    }),
  ],
})
export class AppModule {}

// Use with interceptor
@UseInterceptors(CacheInterceptor)
@CacheTTL(300000) // 5 minutes
@Get('users')
async findAll() {
  return this.usersService.findAll();
}

// Or inject directly
@Injectable()
export class UsersService {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  async getUser(id: string) {
    const cached = await this.cache.get(`user:${id}`);
    if (cached) return cached;
    // ... fetch and cache
  }
}
```

## BullMQ Queue Patterns

### Setup

```typescript
// Module registration
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRoot({
      connection: { host: 'localhost', port: 6379 },
    }),
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'notifications' },
      { name: 'data-processing' },
    ),
  ],
})
export class AppModule {}
```

### Producer (Adding Jobs)

```typescript
@Injectable()
export class EmailService {
  constructor(@InjectQueue('email') private emailQueue: Queue) {}

  async sendWelcomeEmail(userId: string) {
    await this.emailQueue.add('welcome', { userId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,  // Keep last 100 completed
      removeOnFail: 500,      // Keep last 500 failed
    });
  }

  async sendBulkEmails(userIds: string[]) {
    const jobs = userIds.map(userId => ({
      name: 'newsletter',
      data: { userId },
      opts: { priority: 10 }, // Lower = higher priority
    }));
    await this.emailQueue.addBulk(jobs);
  }

  // Delayed job
  async scheduleReminder(userId: string, delayMs: number) {
    await this.emailQueue.add('reminder', { userId }, {
      delay: delayMs,
    });
  }

  // Repeatable job (cron)
  async setupDailyDigest() {
    await this.emailQueue.add('daily-digest', {}, {
      repeat: { pattern: '0 9 * * *' }, // Every day at 9 AM
    });
  }
}
```

### Consumer (Processing Jobs)

```typescript
@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  async process(job: Job<{ userId: string }>) {
    this.logger.log(`Processing ${job.name} for user ${job.data.userId}`);

    switch (job.name) {
      case 'welcome':
        await this.sendWelcomeEmail(job.data.userId);
        break;
      case 'newsletter':
        await this.sendNewsletter(job.data.userId);
        break;
      case 'reminder':
        await this.sendReminder(job.data.userId);
        break;
    }

    // Update progress (for long-running jobs)
    await job.updateProgress(100);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Job ${job.id} (${job.name}) failed: ${error.message}`,
      error.stack,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} (${job.name}) completed`);
  }
}
```

### Job Retry Strategies

```typescript
// Exponential backoff (recommended)
{
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
  // Retries at: 1s, 2s, 4s, 8s, 16s
}

// Fixed delay
{
  attempts: 3,
  backoff: { type: 'fixed', delay: 5000 },
  // Retries at: 5s, 5s, 5s
}

// Custom backoff
{
  attempts: 4,
  backoff: { type: 'custom' },
}
// In processor: implement backoffStrategy
```

## Pub/Sub with Redis

```typescript
// Publisher
@Injectable()
export class EventPublisher {
  constructor(private readonly redis: Redis) {}

  async publish(channel: string, event: any) {
    await this.redis.publish(channel, JSON.stringify(event));
  }
}

// Subscriber
@Injectable()
export class EventSubscriber implements OnModuleInit {
  private subscriber: Redis;

  constructor(private readonly redis: Redis) {
    this.subscriber = redis.duplicate();
  }

  async onModuleInit() {
    await this.subscriber.subscribe('orders', 'notifications');

    this.subscriber.on('message', (channel, message) => {
      const event = JSON.parse(message);
      switch (channel) {
        case 'orders':
          this.handleOrderEvent(event);
          break;
        case 'notifications':
          this.handleNotificationEvent(event);
          break;
      }
    });
  }
}
```

## Distributed Locking

```typescript
// Prevent concurrent operations with Redis lock
import Redlock from 'redlock';

const redlock = new Redlock([redis], {
  retryCount: 3,
  retryDelay: 200,
});

async function processPayment(orderId: string) {
  const lock = await redlock.acquire([`lock:order:${orderId}`], 30000); // 30s TTL

  try {
    // Only one instance processes this order at a time
    const order = await orderRepo.findOne({ where: { id: orderId } });
    if (order.status !== 'pending') return;

    await chargeCustomer(order);
    await orderRepo.update(orderId, { status: 'paid' });
  } finally {
    await lock.release();
  }
}
```

## Rate Limiting with Redis

```typescript
// Sliding window rate limiter
async checkRateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - windowSec * 1000;

  const multi = this.redis.multi();
  multi.zremrangebyscore(key, 0, windowStart);     // Remove old entries
  multi.zadd(key, now, `${now}:${Math.random()}`); // Add current request
  multi.zcard(key);                                  // Count in window
  multi.expire(key, windowSec);                      // Set TTL

  const results = await multi.exec();
  const count = results[2][1] as number;

  return count <= limit;
}

// Usage
const allowed = await checkRateLimit(`rate:${userId}`, 100, 60); // 100 req/min
if (!allowed) throw new TooManyRequestsException();
```

## Session Storage in Redis

```typescript
// Store sessions in Redis (not in-memory)
import * as session from 'express-session';
import RedisStore from 'connect-redis';

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
  },
}));
```
