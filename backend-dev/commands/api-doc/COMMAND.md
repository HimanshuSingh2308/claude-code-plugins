---
description: Generate, validate, and export OpenAPI documentation from NestJS source code. Checks for missing descriptions, examples, and response schemas. Exports as JSON or YAML.
argument-hint: <generate|validate|export> [--format json|yaml] [--output <path>] [--verbose]
---

# API Doc

Manage OpenAPI/Swagger documentation for NestJS backend applications.

**Arguments**: $ARGUMENTS

## Overview

| Subcommand | Purpose |
|------------|---------|
| `generate` | Generate or update OpenAPI spec from code |
| `validate` | Check for missing descriptions, examples, response types |
| `export` | Export OpenAPI spec as JSON or YAML file |

## Command Options

```
/api-doc <subcommand> [options]

Subcommands:
  generate             Generate/update OpenAPI spec from decorators
  validate             Validate documentation completeness
  export               Export spec to file

Options:
  --format <type>      Output format: json (default) or yaml
  --output <path>      Custom output path
  --verbose            Show detailed findings
```

## Usage Examples

```bash
# Generate OpenAPI spec
/api-doc generate

# Validate documentation completeness
/api-doc validate

# Export as YAML
/api-doc export --format yaml --output ./docs/api-spec.yaml

# Export as JSON
/api-doc export --format json
```

## Workflow

### /api-doc generate

#### Step 1: Scan Source Files

```yaml
Find and read:
  - All *.controller.ts files for endpoints
  - All *.dto.ts files for schemas
  - All *.entity.ts files for data models
  - main.ts for existing Swagger config
```

#### Step 2: Identify Missing Decorators

```yaml
For each controller method, check for:
  - @ApiOperation (summary, description)
  - @ApiResponse for each possible status code
  - @ApiParam for route parameters
  - @ApiQuery for query parameters
  - @ApiBody for request bodies
  - @ApiBearerAuth or @ApiSecurity for auth

For each DTO property, check for:
  - @ApiProperty or @ApiPropertyOptional
  - example values
  - description
  - format specification (email, uuid, etc.)
```

#### Step 3: Add Missing Decorators

```yaml
For each missing decorator:
  - Infer description from property name and type
  - Generate example values based on type:
    - string → "example string"
    - email → "user@example.com"
    - uuid → "550e8400-e29b-41d4-a716-446655440000"
    - number → 1
    - boolean → true
    - Date → "2025-01-15T10:30:00.000Z"
  - Show proposed changes
  - Apply with confirmation
```

#### Step 4: Verify Swagger Setup

```yaml
Check main.ts for:
  - DocumentBuilder configuration
  - SwaggerModule.setup call
  - Bearer auth configuration
  - API tags matching controllers

If missing, generate setup code.
```

### /api-doc validate

#### Step 1: Build Completeness Report

```yaml
For each endpoint, check:
  - Has summary (ApiOperation)
  - Has description
  - All parameters documented
  - All response codes documented
  - Request body schema present
  - Auth requirements documented

For each DTO, check:
  - All properties have @ApiProperty
  - All properties have examples
  - All properties have descriptions
  - Nested DTOs are documented
  - Enums are documented
```

#### Step 2: Output Validation Report

```markdown
## API Documentation Validation

### Completeness Score: {n}%

### Endpoints

| Endpoint | Summary | Params | Responses | Auth | Status |
|----------|---------|--------|-----------|------|--------|
| GET /users | Yes | Yes | Partial | Yes | WARN |
| POST /users | Yes | N/A | Yes | Yes | PASS |
| GET /users/:id | No | No | No | No | FAIL |

### DTOs

| DTO | Properties | Examples | Descriptions | Status |
|-----|-----------|----------|--------------|--------|
| CreateUserDto | 4/4 | 3/4 | 4/4 | WARN |
| UpdateUserDto | 4/4 | 4/4 | 4/4 | PASS |

### Issues Found

CRITICAL (blocks API consumers):
  1. GET /users/:id — No @ApiOperation summary
  2. GET /users/:id — Missing @ApiResponse decorators
  3. OrderItemDto — No @ApiProperty on 'quantity' field

WARNING (reduces documentation quality):
  1. CreateUserDto.role — Missing example value
  2. POST /orders — Missing 409 Conflict response documentation

### Fix Command
Run `/api-doc generate` to auto-fix missing documentation.
```

### /api-doc export

#### Step 1: Generate Spec Programmatically

```yaml
Option A: Build and extract from running app
  - Compile TypeScript
  - Bootstrap NestJS app (without listening)
  - Extract OpenAPI document
  - Serialize to JSON/YAML

Option B: Use NestJS CLI plugin
  - Run: npx nest build
  - Extract from dist/swagger-spec.json
```

#### Step 2: Write Output

```yaml
Default output:
  JSON: ./docs/openapi-spec.json
  YAML: ./docs/openapi-spec.yaml

Report:
  - File path
  - Endpoint count
  - Schema count
  - File size
```

#### Step 3: Output Summary

```markdown
## API Spec Exported

File: ./docs/openapi-spec.yaml
Format: OpenAPI 3.0
Endpoints: 24
Schemas: 18
Size: 42 KB

Import into:
  - Postman: Import → File → openapi-spec.yaml
  - Swagger UI: Already at /api/docs
  - Stoplight: Import → File
```

## Notes

- Use Context7 MCP to verify latest @nestjs/swagger decorator API
- Swagger UI is available at /api/docs when app is running
- Export the spec to version control for API consumers
- Run validation in CI to prevent documentation drift
