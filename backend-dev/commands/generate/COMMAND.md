---
description: Scaffold NestJS resources with proper module structure, service, controller, DTOs, entity, and test files. Auto-detects GraphQL vs REST based on project configuration.
argument-hint: <resource-name> [--rest | --graphql | --crud | --no-tests | --dry-run]
---

# Generate NestJS Resource

Scaffold a complete NestJS feature module with all necessary files following project conventions.

**Arguments**: $ARGUMENTS

## Overview

This command generates a full NestJS resource module with:

| File | Purpose |
|------|---------|
| `{name}.module.ts` | Feature module with imports/exports |
| `{name}.controller.ts` / `{name}.resolver.ts` | REST controller or GraphQL resolver |
| `{name}.service.ts` | Business logic layer |
| `entities/{name}.entity.ts` | TypeORM entity |
| `dto/create-{name}.dto.ts` | Create DTO with validation |
| `dto/update-{name}.dto.ts` | Update DTO (PartialType) |
| `{name}.service.spec.ts` | Unit test for service |

## Command Options

```
/generate <resource-name> [options]

Arguments:
  <resource-name>    Singular name in kebab-case (e.g., "order-item")

Options:
  --rest             Force REST controller generation
  --graphql          Force GraphQL resolver generation
  --crud             Generate full CRUD (default)
  --no-tests         Skip test file generation
  --dry-run          Show what would be generated without writing files
```

## Usage Examples

```bash
# Generate full REST resource
/generate user

# Generate GraphQL resource
/generate product --graphql

# Preview without creating files
/generate order --dry-run
```

## Workflow

### Step 1: Detect Project Configuration

```yaml
Detect API type:
  - Check for @nestjs/graphql in package.json → GraphQL
  - Check for existing .resolver.ts files → GraphQL
  - Check for existing .controller.ts files → REST
  - Use --rest or --graphql flag override
  - Default: REST

Detect project conventions:
  - Read existing modules to match naming style
  - Check if project uses barrel exports (index.ts)
  - Check if DTOs use class-validator or zod
  - Check if entities use uuid or auto-increment
```

### Step 2: Validate Resource Name

```yaml
Rules:
  - Must be kebab-case (e.g., "order-item")
  - Convert to PascalCase for class names (OrderItem)
  - Convert to camelCase for variables (orderItem)
  - Singularize if plural provided
  - Check no existing module with same name
```

### Step 3: Generate Entity

```typescript
// entities/{name}.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';

@Entity('{table-name}')
export class {PascalName} {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp with time zone' })
  deletedAt?: Date;
}
```

### Step 4: Generate DTOs

```typescript
// dto/create-{name}.dto.ts
import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Create{PascalName}Dto {
  @ApiProperty({ description: '{PascalName} name', example: 'Example' })
  @IsString()
  @MinLength(1)
  name: string;
}

// dto/update-{name}.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { Create{PascalName}Dto } from './create-{name}.dto';

export class Update{PascalName}Dto extends PartialType(Create{PascalName}Dto) {}
```

### Step 5: Generate Service

```yaml
Generate service with:
  - Constructor injecting Repository<Entity>
  - findAll() with pagination
  - findOne() with NotFoundException
  - create() with DTO
  - update() with DTO + NotFoundException
  - remove() with soft delete
  - Proper error handling
  - Logger instance
```

### Step 6: Generate Controller/Resolver

```yaml
For REST:
  - CRUD endpoints with proper HTTP methods
  - Swagger decorators (@ApiTags, @ApiOperation, @ApiResponse)
  - ParseUUIDPipe for ID params
  - ValidationPipe for body

For GraphQL:
  - @Query and @Mutation decorators
  - @Args with proper types
  - @ResolveField for relations
```

### Step 7: Generate Module

```yaml
- Import TypeOrmModule.forFeature([Entity])
- Register controller/resolver and service
- Export service for use in other modules
```

### Step 8: Generate Tests (unless --no-tests)

```yaml
- Mock repository with jest.fn()
- Test findAll, findOne, create, update, remove
- Test NotFoundException for missing resources
- Test ConflictException for duplicates (if applicable)
```

### Step 9: Register Module

```yaml
- Add import to parent module (usually AppModule)
- Or prompt user to add manually if auto-detection fails
```

### Step 10: Output Summary

```markdown
## Generated: {PascalName} Module

Files created:
  src/{name}/{name}.module.ts
  src/{name}/{name}.controller.ts
  src/{name}/{name}.service.ts
  src/{name}/entities/{name}.entity.ts
  src/{name}/dto/create-{name}.dto.ts
  src/{name}/dto/update-{name}.dto.ts
  src/{name}/{name}.service.spec.ts

Next steps:
  1. Customize entity columns in entities/{name}.entity.ts
  2. Add validation rules to DTOs
  3. Generate migration: /migrate generate create-{table-name}
  4. Run migration: /migrate run
```
