---
description: Run backend tests, generate coverage reports, and auto-generate missing test files for services and controllers. Identifies untested code paths and suggests test cases.
argument-hint: [--coverage | --generate <service-name> | --watch | --e2e | --unit | --verbose]
---

# Test API

Run tests, check coverage, and generate missing tests for NestJS backend applications.

**Arguments**: $ARGUMENTS

## Overview

| Subcommand | Purpose |
|------------|---------|
| (default) | Run all tests |
| `--coverage` | Run tests with coverage report |
| `--generate <name>` | Auto-generate test file for a service/controller |
| `--watch` | Run in watch mode |
| `--e2e` | Run E2E tests only |
| `--unit` | Run unit tests only |

## Command Options

```
/test-api [options]

Options:
  --coverage             Run with coverage report
  --generate <name>      Generate missing tests for a service
  --watch                Run in watch mode
  --e2e                  E2E tests only
  --unit                 Unit tests only
  --verbose              Detailed test output
  --bail                 Stop on first failure
  --file <path>          Run specific test file
```

## Usage Examples

```bash
# Run all tests
/test-api

# Run with coverage
/test-api --coverage

# Generate tests for users service
/test-api --generate users

# Run only E2E tests
/test-api --e2e

# Run specific file
/test-api --file src/users/users.service.spec.ts
```

## Workflow

### /test-api (default)

```bash
# Step 1: Run unit tests
npm run test

# Step 2: Report results
# Show pass/fail count, duration, any failures with details
```

### /test-api --coverage

```yaml
Step 1: Run tests with coverage
  npm run test:cov

Step 2: Parse coverage report and identify:
  - Files with 0% coverage (no tests at all)
  - Files below 80% line coverage
  - Untested branches (error handling, edge cases)
  - Untested services vs tested services

Step 3: Output coverage summary
```

```markdown
## Coverage Report

| Category | Coverage | Target |
|----------|----------|--------|
| Statements | {n}% | 80% |
| Branches | {n}% | 70% |
| Functions | {n}% | 80% |
| Lines | {n}% | 80% |

### Untested Files
| File | Lines | Branch |
|------|-------|--------|
| src/orders/orders.service.ts | 0% | 0% |
| src/auth/auth.guard.ts | 45% | 30% |

### Untested Code Paths
1. `orders.service.ts:42` — Error handling for duplicate order
2. `auth.guard.ts:18` — Expired token branch
3. `users.service.ts:67` — Null user edge case

### Recommendation
Run `/test-api --generate orders` to auto-generate missing tests.
```

### /test-api --generate <service-name>

#### Step 1: Read Service Code

```yaml
Read the target service file and analyze:
  - All public methods
  - Dependencies (injected services/repos)
  - Return types
  - Error cases (throws)
  - Edge cases from code paths
```

#### Step 2: Generate Test File

```yaml
For each public method, generate tests for:
  - Happy path (normal operation)
  - Error cases (NotFoundException, ConflictException, etc.)
  - Edge cases (null input, empty arrays, boundary values)
  - Auth/permission checks (if applicable)
  - Validation failures

Generate mocks for:
  - Repository methods (find, findOne, save, update, delete)
  - External service calls
  - EventEmitter
```

#### Step 3: Write Test File

```yaml
Output: src/{name}/{name}.service.spec.ts

Structure:
  - describe block per method
  - beforeEach with fresh mocks
  - Clear test names: "should {expected behavior} when {condition}"
```

#### Step 4: Run Generated Tests

```bash
# Verify generated tests pass
npx jest src/{name}/{name}.service.spec.ts --verbose
```

#### Step 5: Output Summary

```markdown
## Generated Tests: {Name}Service

File: src/{name}/{name}.service.spec.ts

| Method | Tests Generated | Coverage |
|--------|----------------|----------|
| findAll | 3 | Happy, empty list, with filters |
| findOne | 2 | Found, not found |
| create | 3 | Success, duplicate, validation |
| update | 3 | Success, not found, partial |
| remove | 2 | Success, not found |
| **Total** | **13** | |

All tests passing.
Run `/test-api --coverage` to check updated coverage.
```

## Test Conventions

```yaml
File naming: {name}.service.spec.ts, {name}.controller.spec.ts
Test naming: "should {behavior} when {condition}"
Structure: Arrange-Act-Assert pattern
Mocking: Use jest.fn() for repository methods
Assertions: Use expect().toEqual() for objects, .toBe() for primitives
```
