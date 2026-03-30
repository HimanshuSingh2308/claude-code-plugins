---
description: Database seeding management. Run seed scripts, generate seed files for entities using faker.js, and reset database with fresh seed data. Respects foreign key dependencies.
argument-hint: [--generate <entity-name> | --reset | --production | --count <number> | --verbose]
---

# Seed DB

Manage database seed data for development and testing environments.

**Arguments**: $ARGUMENTS

## Overview

| Subcommand | Purpose |
|------------|---------|
| (default) | Run all seed scripts |
| `--generate <entity>` | Generate seed file for an entity |
| `--reset` | Clear all data and re-seed |
| `--production` | Run production seeds only (reference data) |

## Command Options

```
/seed-db [options]

Options:
  --generate <entity>   Generate seed file for an entity using faker
  --reset               Drop all data and re-seed (DESTRUCTIVE)
  --production          Only run production seeds (roles, categories, etc.)
  --count <n>           Number of records to generate (default: 50)
  --verbose             Show detailed output
  --dry-run             Show what would be seeded without executing
```

## Usage Examples

```bash
# Run all seeds
/seed-db

# Generate seed file for users entity
/seed-db --generate user

# Generate 200 seed records
/seed-db --generate order --count 200

# Reset and re-seed
/seed-db --reset

# Production seeds only (roles, categories)
/seed-db --production
```

## Workflow

### /seed-db (default)

#### Step 1: Discover Seed Files

```yaml
Search for seed files in:
  - src/seeds/*.seed.ts
  - src/database/seeds/*.ts
  - seeds/*.ts

Sort by dependency order:
  1. Independent tables (roles, categories, statuses)
  2. Parent tables (users, products)
  3. Child tables (orders, comments)
  4. Junction tables (user_roles, order_items)
```

#### Step 2: Run Seeds

```yaml
For each seed file in order:
  1. Check if already seeded (optional idempotency check)
  2. Run seed function
  3. Report: "{entity}: {count} records created"
```

#### Step 3: Output Summary

```markdown
## Seed Complete

| Entity | Records | Duration |
|--------|---------|----------|
| roles | 4 | 12ms |
| users | 50 | 245ms |
| products | 100 | 189ms |
| orders | 200 | 567ms |
| order_items | 500 | 890ms |

Total: 854 records in 1.9s
```

### /seed-db --generate <entity>

#### Step 1: Read Entity Definition

```yaml
Read src/**/{entity}.entity.ts and extract:
  - All columns with types
  - Relations (to determine FK dependencies)
  - Constraints (unique, nullable, enum values)
  - Default values
```

#### Step 2: Generate Seed File

```typescript
// src/seeds/{entity}.seed.ts
import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { {PascalName} } from '../{path}/{entity}.entity';

export async function seed{PascalName}s(
  dataSource: DataSource,
  count: number = 50,
): Promise<{PascalName}[]> {
  const repo = dataSource.getRepository({PascalName});

  const items = Array.from({ length: count }, () => {
    const item = repo.create({
      // Generated based on column types:
      name: faker.commerce.productName(),
      email: faker.internet.email(),
      status: faker.helpers.arrayElement(['active', 'inactive']),
      price: parseFloat(faker.commerce.price({ min: 10, max: 500 })),
      description: faker.lorem.paragraph(),
      createdAt: faker.date.past({ years: 1 }),
    });
    return item;
  });

  return repo.save(items);
}
```

#### Step 3: Map Column Types to Faker Methods

```yaml
Mapping:
  string (name)       → faker.person.fullName()
  string (email)      → faker.internet.email()
  string (phone)      → faker.phone.number()
  string (url)        → faker.internet.url()
  string (address)    → faker.location.streetAddress()
  string (default)    → faker.lorem.words(3)
  text                → faker.lorem.paragraph()
  number (price)      → faker.commerce.price()
  number (quantity)   → faker.number.int({ min: 1, max: 100 })
  number (default)    → faker.number.int({ min: 1, max: 1000 })
  decimal             → parseFloat(faker.commerce.price())
  boolean             → faker.datatype.boolean()
  date                → faker.date.past()
  uuid (FK)           → randomly pick from seeded parent records
  enum                → faker.helpers.arrayElement(enumValues)
  jsonb               → { key: faker.lorem.word() }
  array (string)      → faker.helpers.arrayElements([...])
```

#### Step 4: Output

```markdown
## Seed File Generated

File: src/seeds/{entity}.seed.ts
Entity: {PascalName}
Columns: {count}
Dependencies: {list of FK entities}

Run `/seed-db` to execute all seeds.
```

### /seed-db --reset

#### Step 1: Safety Check

```yaml
If NODE_ENV === 'production':
  BLOCK: "Cannot reset production database. Use --production for reference data only."

Otherwise:
  WARN: "This will DELETE ALL DATA and re-seed. Continue? [Y/n]"
```

#### Step 2: Truncate Tables

```sql
-- Disable FK constraints temporarily
SET session_replication_role = replica;

-- Truncate all tables in reverse dependency order
TRUNCATE TABLE order_items CASCADE;
TRUNCATE TABLE orders CASCADE;
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE roles CASCADE;

-- Re-enable FK constraints
SET session_replication_role = DEFAULT;
```

#### Step 3: Run All Seeds

```yaml
Same as /seed-db default flow.
```

### /seed-db --production

```yaml
Only run seeds marked as production:
  - roles (admin, user, moderator)
  - categories
  - countries / currencies
  - default settings
  - system user accounts

These seeds should be idempotent (check before insert).
```

## Seed File Conventions

```
src/seeds/
  01-roles.seed.ts        — Reference data (production + dev)
  02-categories.seed.ts   — Reference data (production + dev)
  10-users.seed.ts        — Fake users (dev only)
  20-products.seed.ts     — Fake products (dev only)
  30-orders.seed.ts       — Fake orders (dev only)
  seed-runner.ts          — Main entry point

Naming:
  - Prefix with number for execution order
  - Use .seed.ts suffix
  - Export async function that accepts DataSource

Idempotency:
  - Production seeds: check if exists before inserting
  - Dev seeds: always create fresh (after reset)
```
