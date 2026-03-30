---
name: logging-monitoring
description: >
  Observability patterns for backend applications. Covers structured logging with
  JSON format, log levels, request ID tracing, error tracking with Sentry, health
  check endpoints, metrics collection, APM basics, and alerting patterns.
  Applied automatically when setting up logging, monitoring, or error tracking.
---

# Logging & Monitoring

This skill provides observability best practices for backend applications,
ensuring issues are detectable, diagnosable, and alertable.

## Structured Logging

### Why Structured (JSON) Logs

```
UNSTRUCTURED (bad for search/aggregation):
  [2025-01-15 10:30:00] INFO: User john@test.com logged in from 192.168.1.1

STRUCTURED (searchable, parseable):
  {
    "level": "info",
    "timestamp": "2025-01-15T10:30:00.000Z",
    "message": "User logged in",
    "email": "john@test.com",
    "ip": "192.168.1.1",
    "requestId": "abc-123",
    "service": "auth"
  }
```

### Pino Setup (Recommended for NestJS)

```typescript
// app.module.ts
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        transport: process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
            query: req.query,
            // NEVER log request body (may contain passwords)
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
        },
        // Auto-assign request ID
        genReqId: (req) => req.headers['x-request-id'] || randomUUID(),
        customProps: () => ({
          service: 'my-api',
          environment: process.env.NODE_ENV,
        }),
      },
    }),
  ],
})
export class AppModule {}

// main.ts
import { Logger } from 'nestjs-pino';

const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger));
```

### Winston Alternative

```typescript
import * as winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'my-api' },
  transports: [
    new winston.transports.Console(),
  ],
});
```

## Log Levels

| Level | When to Use | Examples |
|-------|------------|---------|
| `error` | Operation failed, requires attention | DB connection lost, payment failed, unhandled exception |
| `warn` | Unexpected but recoverable | Deprecated API used, retry succeeded, rate limit approaching |
| `info` | Normal operations worth recording | Request handled, user logged in, job completed |
| `debug` | Diagnostic detail for troubleshooting | Query executed, cache hit/miss, variable values |
| `trace` | Very verbose, rarely used | Function entry/exit, loop iterations |

```typescript
// GOOD: Meaningful log messages with context
this.logger.info('Order created', { orderId: order.id, userId, total: order.total });
this.logger.error('Payment failed', { orderId, error: err.message, provider: 'stripe' });
this.logger.warn('Rate limit approaching', { userId, current: 95, limit: 100 });

// BAD: Useless logs
this.logger.info('here');
this.logger.info(JSON.stringify(bigObject)); // Too much data
this.logger.error(err); // No context
```

**Rules:**
- **NEVER** log passwords, tokens, credit card numbers, or PII
- **NEVER** log at `debug` level in production
- **ALWAYS** include context (IDs, relevant fields)
- **ALWAYS** log errors with stack traces
- **ALWAYS** use `info` for request lifecycle events

## Request ID / Correlation ID

```typescript
// Middleware to propagate request ID across services
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] || randomUUID();
    req['requestId'] = requestId;
    res.setHeader('x-request-id', requestId);

    // Store in AsyncLocalStorage for access anywhere
    requestContext.run({ requestId }, () => next());
  }
}

// Access in services
@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  async createOrder(dto: CreateOrderDto) {
    const requestId = requestContext.getStore()?.requestId;
    this.logger.log({ message: 'Creating order', requestId, ...dto });
  }
}

// Pass to downstream services
async callPaymentService(orderId: string) {
  const requestId = requestContext.getStore()?.requestId;
  return this.httpService.post('/charge', { orderId }, {
    headers: { 'x-request-id': requestId },
  });
}
```

## Error Tracking (Sentry)

```typescript
// Setup
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  integrations: [
    Sentry.httpIntegration(),
    Sentry.expressIntegration(),
  ],
});

// Global exception filter with Sentry
@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    // Don't report 4xx to Sentry (client errors)
    if (exception instanceof HttpException && exception.getStatus() < 500) {
      // Handle normally
    } else {
      Sentry.captureException(exception, {
        extra: {
          url: request.url,
          method: request.method,
          userId: request.user?.id,
        },
      });
    }

    // Send error response
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : 500;
    response.status(status).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: status === 500 ? 'Internal server error' : exception['message'],
      },
    });
  }
}
```

## Metrics

### Key Metrics to Track

```
Request Metrics:
  - request_count (by method, path, status)
  - request_duration_ms (histogram: p50, p95, p99)
  - request_errors (by type: 4xx, 5xx)

Business Metrics:
  - users_registered_total
  - orders_created_total
  - payments_processed_total

System Metrics:
  - process_memory_usage_bytes
  - process_cpu_usage_percent
  - active_connections (DB, Redis)
  - event_loop_lag_ms
```

### Prometheus Metrics (Basic)

```typescript
// Middleware to track request metrics
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const labels = {
        method: req.method,
        path: req.route?.path || req.path,
        status: res.statusCode,
      };

      // Log metrics (or push to Prometheus/Datadog)
      if (duration > 1000) {
        this.logger.warn('Slow request', { ...labels, duration });
      }
    });

    next();
  }
}
```

## Health Check Endpoints

```typescript
// /health — Liveness (is the process running?)
// /health/ready — Readiness (can it handle traffic?)

@Controller('health')
export class HealthController {
  @Get()
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async readiness() {
    const checks = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
    };

    const allHealthy = Object.values(checks).every(c => c.status === 'up');
    return {
      status: allHealthy ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<{ status: string }> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'up' };
    } catch {
      return { status: 'down' };
    }
  }
}
```

## Alerting Patterns

```
CRITICAL (page on-call):
  - Error rate > 5% for 5 minutes
  - P99 latency > 5 seconds for 5 minutes
  - Health check failing for 2+ minutes
  - Database connection failures

WARNING (notify channel):
  - Error rate > 1% for 10 minutes
  - P95 latency > 2 seconds for 10 minutes
  - Memory usage > 80%
  - Queue backlog > 1000 jobs
  - Rate limiting triggered frequently

INFO (daily digest):
  - Deploy completed
  - Slow query threshold exceeded
  - New error type detected
```

## Logging Anti-Patterns

1. **NEVER** log sensitive data (passwords, tokens, PII)
2. **NEVER** use `console.log` in production code (use structured logger)
3. **NEVER** log entire request/response bodies
4. **NEVER** suppress errors silently (`catch (e) {}`)
5. **NEVER** log at debug level in production
6. **NEVER** create log files in containers (use stdout)
7. **NEVER** alert on every single error (batch and threshold)
