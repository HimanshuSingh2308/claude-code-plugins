---
name: testing-backend
description: >
  Backend testing patterns for NestJS applications. Covers unit testing with Jest,
  integration testing with databases, E2E testing, mocking strategies, test data
  factories, coverage targets, snapshot testing, load testing, and CI pipeline patterns.
  Applied automatically when writing tests, asking about testing strategy, or test setup.
---

# Backend Testing Patterns

This skill provides comprehensive testing strategies for NestJS backend applications
using Jest as the primary test framework.

## Testing Pyramid

```
         /  E2E  \           — Few: full HTTP cycle, slow, flaky
        / Integration \      — Some: service + DB, medium speed
       /    Unit Tests   \   — Many: fast, isolated, deterministic
      ─────────────────────
```

**Coverage Targets:**
- Unit tests: 80%+ line coverage on services
- Integration tests: All controller endpoints
- E2E tests: Critical user flows (auth, main CRUD)

## Unit Testing

### Testing Services

```typescript
// users.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let mockRepo: Partial<Record<keyof Repository<User>, jest.Mock>>;

  beforeEach(async () => {
    mockRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findOne', () => {
    it('should return a user when found', async () => {
      const user = { id: '1', name: 'Alice', email: 'alice@test.com' };
      mockRepo.findOne.mockResolvedValue(user);

      const result = await service.findOne('1');

      expect(result).toEqual(user);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create and return a new user', async () => {
      const dto = { name: 'Bob', email: 'bob@test.com', password: 'pass123' };
      const created = { id: '2', ...dto };
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(result).toEqual(created);
      expect(mockRepo.create).toHaveBeenCalledWith(dto);
      expect(mockRepo.save).toHaveBeenCalledWith(created);
    });

    it('should throw ConflictException on duplicate email', async () => {
      mockRepo.save.mockRejectedValue({ code: '23505' }); // unique violation

      await expect(service.create({
        name: 'Bob', email: 'existing@test.com', password: 'pass'
      })).rejects.toThrow(ConflictException);
    });
  });
});
```

### Testing Guards

```typescript
// auth.guard.spec.ts
describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: JwtService, useValue: { verify: jest.fn() } },
      ],
    }).compile();

    guard = module.get(AuthGuard);
    jwtService = module.get(JwtService);
  });

  it('should allow valid token', () => {
    const mockContext = createMockExecutionContext({
      headers: { authorization: 'Bearer valid-token' },
    });
    jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: '1' });

    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('should reject missing token', () => {
    const mockContext = createMockExecutionContext({ headers: {} });

    expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
  });
});
```

### Testing Pipes

```typescript
// parse-uuid.pipe.spec.ts
describe('ParseUUIDPipe', () => {
  const pipe = new ParseUUIDPipe();

  it('should pass valid UUID', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(pipe.transform(uuid, { type: 'param' })).toBe(uuid);
  });

  it('should reject invalid UUID', () => {
    expect(() => pipe.transform('not-a-uuid', { type: 'param' }))
      .toThrow(BadRequestException);
  });
});
```

## Integration Testing

### Controller + Database

```typescript
// users.controller.integration.spec.ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

describe('UsersController (integration)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: 'localhost',
          port: 5433,        // test database port
          database: 'test_db',
          synchronize: true, // OK for tests only
          entities: [User],
        }),
        UsersModule,
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    // Get auth token for protected routes
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: 'password' });
    authToken = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /users', () => {
    it('should create a user', () => {
      return request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test', email: 'test@example.com', password: 'pass1234' })
        .expect(201)
        .expect(res => {
          expect(res.body.data).toHaveProperty('id');
          expect(res.body.data.email).toBe('test@example.com');
        });
    });

    it('should reject invalid email', () => {
      return request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test', email: 'not-an-email', password: 'pass1234' })
        .expect(400);
    });
  });

  describe('GET /users/:id', () => {
    it('should return 404 for non-existent user', () => {
      return request(app.getHttpServer())
        .get('/users/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
```

## E2E Testing

### Full Request Cycle

```typescript
// test/app.e2e-spec.ts
describe('App E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  it('should complete full user lifecycle', async () => {
    // 1. Register
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'e2e@test.com', password: 'password123', name: 'E2E' })
      .expect(201);

    // 2. Login
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e@test.com', password: 'password123' })
      .expect(200);

    const token = loginRes.body.accessToken;

    // 3. Get profile
    const profileRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(profileRes.body.data.email).toBe('e2e@test.com');

    // 4. Update profile
    await request(app.getHttpServer())
      .patch(`/users/${profileRes.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' })
      .expect(200);
  });
});
```

## Test Database Setup

### Docker Test Database

```yaml
# docker-compose.test.yml
services:
  test-db:
    image: postgres:16
    environment:
      POSTGRES_DB: test_db
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data  # RAM disk for speed
```

### In-Memory with SQLite (faster but less accurate)

```typescript
TypeOrmModule.forRoot({
  type: 'sqlite',
  database: ':memory:',
  synchronize: true,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
});
```

## Mocking Patterns

### External API Mocking

```typescript
// Mock HTTP calls with nock
import * as nock from 'nock';

beforeEach(() => {
  nock('https://api.stripe.com')
    .post('/v1/charges')
    .reply(200, { id: 'ch_test', status: 'succeeded' });
});

afterEach(() => {
  nock.cleanAll();
});
```

### Service Mocking

```typescript
const mockEmailService = {
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordReset: jest.fn().mockResolvedValue(undefined),
};

// In module
{ provide: EmailService, useValue: mockEmailService }
```

## Test Data Factory

```typescript
// test/factories/user.factory.ts
import { faker } from '@faker-js/faker';

export function createUserFactory(overrides?: Partial<User>): User {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password: faker.internet.password(),
    status: 'active',
    createdAt: faker.date.past(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Usage
const user = createUserFactory({ role: 'admin' });
const users = Array.from({ length: 10 }, () => createUserFactory());
```

## Load Testing

```typescript
// k6 load test script
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },   // ramp up
    { duration: '1m', target: 20 },     // steady
    { duration: '10s', target: 0 },     // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95% under 500ms
    http_req_failed: ['rate<0.01'],     // <1% errors
  },
};

export default function () {
  const res = http.get('http://localhost:3000/users');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  sleep(1);
}
```

## CI Pipeline Pattern

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

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
        ports: ['5433:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run test          # unit tests
      - run: npm run test:e2e      # E2E tests
      - run: npm run test:cov      # coverage report
      - uses: codecov/codecov-action@v4  # upload coverage
```

## What to Test vs What Not to Test

```
ALWAYS TEST:
  - Business logic in services
  - Input validation (DTOs)
  - Auth guards and role checks
  - Error handling paths
  - Database queries (integration)
  - API contract (status codes, response shape)

SKIP TESTING:
  - Framework internals (NestJS decorators work)
  - Simple getters/setters
  - Third-party library behavior
  - Configuration files
  - Generated code
```
