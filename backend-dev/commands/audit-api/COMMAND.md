---
description: Run comprehensive API audit covering security, performance, and code quality. Scans for injection vulnerabilities, N+1 queries, missing indexes, pagination gaps, untested code, and architectural issues. Outputs a scored report with prioritized fixes.
argument-hint: [path-to-src] [--security-only | --performance-only | --quality-only | --fix | --verbose]
---

# Audit API

Run a comprehensive quality audit on a NestJS backend application.

**Arguments**: $ARGUMENTS

## Overview

This command analyzes the backend codebase across three dimensions:

| Category | What It Checks | Max Score |
|----------|---------------|-----------|
| Security | Injection, auth bypass, missing validation, secrets | /10 |
| Performance | N+1 queries, missing indexes, no pagination, slow queries | /10 |
| Code Quality | Missing tests, unused imports, circular deps, architecture | /10 |
| **Total** | | **/30** |

## Command Options

```
/audit-api [path] [options]

Arguments:
  [path]              Source directory (default: src/)

Options:
  --security-only     Run security scan only
  --performance-only  Run performance check only
  --quality-only      Run code quality check only
  --fix               Auto-fix identified issues (with confirmation)
  --verbose           Show detailed findings with file:line references
  --output <path>     Save report to specific file
```

## Usage Examples

```bash
# Full audit
/audit-api

# Security scan only
/audit-api --security-only

# Audit specific module
/audit-api src/orders/

# Audit with auto-fix
/audit-api --fix
```

## Workflow

### Step 1: Discover Source Files

```yaml
Scan directory for:
  - *.controller.ts
  - *.service.ts
  - *.guard.ts
  - *.interceptor.ts
  - *.pipe.ts
  - *.entity.ts
  - *.dto.ts
  - *.spec.ts
  - *.module.ts
  - *.middleware.ts

Build file map for analysis.
```

### Step 2: Security Scan

```yaml
Check for:

CRITICAL:
  - Raw SQL queries with string interpolation (SQL injection)
  - Missing ValidationPipe (no input validation)
  - Hardcoded secrets, API keys, passwords in source
  - Missing auth guards on sensitive endpoints
  - Password stored in plaintext

HIGH:
  - Missing rate limiting on auth endpoints
  - CORS set to origin: '*'
  - Missing Helmet.js or security headers
  - JWT secret less than 32 characters
  - No CSRF protection with cookie-based auth

MEDIUM:
  - Missing input sanitization (XSS)
  - Excessive data exposure in responses (password, internal IDs)
  - Missing HTTPS enforcement
  - Debug/verbose error messages in production
  - API keys in query parameters

LOW:
  - No API key rotation mechanism
  - Missing request ID for tracing
  - No audit logging for sensitive operations
```

### Step 3: Performance Check

```yaml
Check for:

CRITICAL:
  - N+1 queries (relations loaded in loops without DataLoader)
  - No pagination on list endpoints
  - Missing database indexes on foreign keys
  - Synchronous blocking operations in request handlers

HIGH:
  - Missing caching on frequently read endpoints
  - No connection pooling configuration
  - SELECT * queries (loading unnecessary columns)
  - Missing database query timeout

MEDIUM:
  - No query logging in development
  - Missing health check endpoints
  - No graceful shutdown handlers
  - Unoptimized file uploads (no streaming)

LOW:
  - Missing compression middleware
  - No ETags for cache validation
  - Missing CDN configuration for static assets
```

### Step 4: Code Quality Check

```yaml
Check for:

CRITICAL:
  - Business logic in controllers (should be in services)
  - Circular dependencies between modules
  - No error handling (empty catch blocks)

HIGH:
  - Missing test files for services
  - Test coverage below 60%
  - No DTOs for request bodies
  - Unused imports and dead code
  - God services (>500 lines)

MEDIUM:
  - Missing Swagger/OpenAPI documentation
  - Inconsistent naming conventions
  - No environment variable validation
  - Missing TypeORM migration files (using synchronize)

LOW:
  - Missing barrel exports (index.ts)
  - Inconsistent file structure
  - Missing README or architecture docs
  - No linting configuration
```

### Step 5: Generate Report

```markdown
# API Audit Report

**Date**: {date}
**Path**: {audited-path}
**Files Analyzed**: {count}

---

## Summary

| Category | Score | Issues |
|----------|-------|--------|
| Security | {n}/10 | {critical} critical, {high} high, {medium} medium |
| Performance | {n}/10 | {critical} critical, {high} high, {medium} medium |
| Code Quality | {n}/10 | {critical} critical, {high} high, {medium} medium |
| **Overall** | **{n}/30** | |

**Health**: {HEALTHY (25-30) | NEEDS_ATTENTION (15-24) | CRITICAL (<15)}

---

## Security Findings

### Critical
{numbered list with file:line references and fix suggestions}

### High
{numbered list}

### Medium
{numbered list}

---

## Performance Findings

### Critical
{numbered list with file:line references and fix suggestions}

### High
{numbered list}

---

## Code Quality Findings

### Critical
{numbered list with file:line references and fix suggestions}

### High
{numbered list}

---

## Recommended Actions (Priority Order)

1. {Most critical fix with specific instructions}
2. {Second most critical}
3. ...

---

## Score Interpretation

- **25-30**: Production ready
- **20-24**: Minor issues, can deploy
- **15-19**: Needs work before production
- **10-14**: Significant issues
- **<10**: Major rework needed
```

### Step 6: Fix Mode (--fix)

```yaml
When --fix is specified:
  1. Group fixes by severity (critical first)
  2. For each fixable issue:
     - Show issue description and proposed fix
     - Show diff preview
     - Ask: "Apply fix? [Y/n/s(kip all)]"
  3. Apply confirmed fixes
  4. Re-run affected checks to verify
  5. Show summary of applied fixes
```

## Notes

- Audit is read-only by default
- Use `--fix` to enable auto-fixing with confirmations
- All fixes are scoped to the audited directory
- Use Context7 MCP to verify latest security best practices for NestJS
