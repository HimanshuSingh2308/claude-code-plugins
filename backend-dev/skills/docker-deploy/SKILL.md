---
name: docker-deploy
description: >
  Deployment and containerization patterns for backend applications. Covers Dockerfile
  best practices, multi-stage builds, docker-compose for local dev, Cloud Run deployment,
  environment management, CI/CD pipelines, health checks, graceful shutdown, and
  deployment strategies. Applied automatically when deploying, dockerizing, or setting up CI/CD.
---

# Deployment Patterns

This skill provides containerization and deployment best practices for NestJS
backend applications.

## Dockerfile Best Practices

### Multi-Stage Build

```dockerfile
# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production && cp -R node_modules prod_modules
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production image
FROM node:20-alpine AS runner
WORKDIR /app

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy only what's needed
COPY --from=deps /app/prod_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

USER nestjs
EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
```

### Layer Caching Optimization

```dockerfile
# GOOD: package.json copied first (changes less often)
COPY package.json package-lock.json ./
RUN npm ci
COPY . .   # Source changes don't invalidate npm cache

# BAD: Everything copied at once (any change busts npm cache)
COPY . .
RUN npm ci
```

### .dockerignore

```
node_modules
dist
.git
.env
.env.*
*.md
test
coverage
.vscode
.idea
docker-compose*.yml
Dockerfile
```

## Docker Compose for Local Dev

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: deps  # Use deps stage for dev
    command: npm run start:dev
    volumes:
      - .:/app
      - /app/node_modules  # Don't override node_modules
    ports:
      - "3000:3000"
      - "9229:9229"  # Debug port
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/myapp
      - REDIS_URL=redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  adminer:
    image: adminer
    ports:
      - "8080:8080"  # DB admin UI

volumes:
  postgres_data:
  redis_data:
```

### Useful Docker Compose Commands

```bash
docker compose up -d              # Start all services
docker compose up -d db redis     # Start only DB + Redis
docker compose logs -f app        # Follow app logs
docker compose exec app sh        # Shell into app container
docker compose exec db psql -U postgres myapp  # Connect to DB
docker compose down               # Stop all
docker compose down -v            # Stop + remove volumes (reset data)
```

## Cloud Run Deployment

### Dockerfile Adjustments

```dockerfile
# Cloud Run requires listening on PORT env var
ENV PORT=8080
EXPOSE 8080

# Cloud Run sends SIGTERM on shutdown
CMD ["node", "dist/main.js"]
```

### NestJS main.ts for Cloud Run

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cloud Run provides PORT env var
  const port = process.env.PORT || 3000;

  // Enable graceful shutdown
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0'); // Must bind to 0.0.0.0
  console.log(`Server running on port ${port}`);
}
```

### Deploy Script

```bash
# Build and push to Artifact Registry
gcloud builds submit --tag gcr.io/PROJECT_ID/my-api

# Deploy to Cloud Run
gcloud run deploy my-api \
  --image gcr.io/PROJECT_ID/my-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets "DATABASE_URL=db-url:latest,JWT_SECRET=jwt-secret:latest" \
  --min-instances 1 \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --concurrency 80
```

## Environment Management

```
.env                 — Default values (committed, no secrets)
.env.local           — Local overrides (NOT committed)
.env.development     — Dev-specific defaults
.env.production      — Prod-specific defaults (no secrets)
.env.test            — Test-specific defaults

Priority: .env.local > .env.{NODE_ENV} > .env
```

### Config Validation

```typescript
// app.config.ts
import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().default('redis://localhost:6379'),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRY: Joi.string().default('15m'),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
});

// app.module.ts
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: configValidationSchema,
  validationOptions: { abortEarly: true },
});
```

## CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: test_db
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run test:e2e
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      - uses: google-github-actions/setup-gcloud@v2
      - run: gcloud builds submit --tag gcr.io/${{ vars.GCP_PROJECT }}/my-api
      - uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: my-api
          image: gcr.io/${{ vars.GCP_PROJECT }}/my-api
          region: us-central1
```

## Health Check Endpoints

```typescript
// health.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck, HealthCheckService,
  TypeOrmHealthIndicator, MemoryHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
  ) {}

  // Liveness: is the process alive?
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024), // 200MB
    ]);
  }

  // Readiness: can it handle traffic?
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.db.pingCheck('database'),
    ]);
  }
}
```

## Graceful Shutdown

```typescript
// main.ts
app.enableShutdownHooks();

// In services
@Injectable()
export class AppService implements OnApplicationShutdown {
  async onApplicationShutdown(signal: string) {
    console.log(`Received ${signal}, shutting down gracefully...`);

    // 1. Stop accepting new requests (handled by NestJS)
    // 2. Finish in-flight requests (handled by NestJS)
    // 3. Close connections
    await this.redis.quit();
    await this.dataSource.destroy();
    // 4. Flush logs
    console.log('Shutdown complete');
  }
}
```

## Logging in Containers

```typescript
// ALWAYS log to stdout/stderr (not files) in containers
// Use structured JSON for log aggregation

import { Logger } from 'nestjs-pino';

// main.ts
const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger));

// Output: {"level":"info","time":1700000000,"msg":"Request handled","method":"GET","path":"/users","statusCode":200,"duration":42}
```

## Deployment Strategies

```
Blue-Green:
  1. Deploy new version to "green" (inactive)
  2. Run smoke tests on green
  3. Switch traffic from "blue" to "green"
  4. Keep blue as rollback target

Canary:
  1. Deploy new version to 10% of instances
  2. Monitor error rates and latency
  3. Gradually increase (25%, 50%, 100%)
  4. Roll back if metrics degrade

Rolling Update (default for Cloud Run):
  1. New instances start with new version
  2. Old instances drain connections
  3. Traffic gradually shifts
  4. Old instances terminate
```

## Anti-Patterns

1. **NEVER** run as root in containers
2. **NEVER** store secrets in Docker images
3. **NEVER** use `latest` tag in production
4. **NEVER** skip health checks
5. **NEVER** log to files in containers (use stdout)
6. **NEVER** use `npm install` in Dockerfile (use `npm ci`)
7. **NEVER** copy `node_modules` into container (install fresh)
