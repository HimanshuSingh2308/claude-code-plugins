---
name: typeorm
description: >
  TypeORM-specific patterns for NestJS applications. Covers entity definition, relations,
  repository pattern, QueryBuilder, migrations, subscribers, custom repositories,
  transactions, soft deletes, indexes, embedded entities, inheritance, query optimization,
  connection configuration, and multiple database connections. Use Context7 MCP to look
  up latest TypeORM docs when needed. Applied automatically when working with TypeORM
  entities, migrations, or repositories.
---

# TypeORM Patterns

This skill covers TypeORM-specific patterns for use with NestJS and PostgreSQL.
Use Context7 MCP to verify latest API changes.

## Entity Definition

### Basic Entity

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, DeleteDateColumn, Index,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Index({ unique: true })
  @Column({ length: 255 })
  email: string;

  @Column({ select: false }) // Excluded from default queries
  password: string;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'text', array: true, default: '{}' })
  tags: string[];

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  balance: number;

  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp with time zone' })
  deletedAt?: Date; // Soft delete
}
```

### Column Types Reference

```typescript
@Column({ type: 'varchar', length: 255 })     // Variable string
@Column({ type: 'text' })                      // Unlimited text
@Column({ type: 'int' })                       // Integer
@Column({ type: 'bigint' })                    // Large integer
@Column({ type: 'decimal', precision: 10, scale: 2 }) // Exact decimal
@Column({ type: 'float' })                     // Floating point
@Column({ type: 'boolean' })                   // True/false
@Column({ type: 'uuid' })                      // UUID
@Column({ type: 'jsonb' })                     // JSON binary (indexable)
@Column({ type: 'timestamp with time zone' })  // Timestamp with TZ
@Column({ type: 'date' })                      // Date only
@Column({ type: 'enum', enum: MyEnum })        // PostgreSQL enum
@Column({ type: 'text', array: true })         // Text array
@Column({ type: 'simple-array' })              // Comma-separated (portable)
```

## Relations

### OneToMany / ManyToOne

```typescript
// User has many Orders
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToMany(() => Order, order => order.user)
  orders: Order[];
}

// Order belongs to one User
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string; // ALWAYS keep the FK column for direct access

  @ManyToOne(() => User, user => user.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;
}
```

### OneToOne

```typescript
@Entity('users')
export class User {
  @OneToOne(() => Profile, profile => profile.user, { cascade: true })
  profile: Profile;
}

@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  bio: string;

  @OneToOne(() => User, user => user.profile, { onDelete: 'CASCADE' })
  @JoinColumn() // JoinColumn goes on the owning side
  user: User;
}
```

### ManyToMany

```typescript
// With junction table (auto-generated)
@Entity('posts')
export class Post {
  @ManyToMany(() => Tag, tag => tag.posts)
  @JoinTable() // Creates post_tags junction table
  tags: Tag[];
}

@Entity('tags')
export class Tag {
  @ManyToMany(() => Post, post => post.tags)
  posts: Post[];
}

// With custom junction entity (when junction needs extra columns)
@Entity('user_roles')
export class UserRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, user => user.userRoles)
  user: User;

  @ManyToOne(() => Role, role => role.userRoles)
  role: Role;

  @Column({ type: 'timestamp with time zone' })
  assignedAt: Date;

  @Column({ nullable: true })
  assignedBy: string;
}
```

### Eager vs Lazy Loading

```typescript
// Eager: always loaded with parent (use sparingly)
@ManyToOne(() => User, { eager: true })
user: User;

// Lazy: loaded on access (requires Promise type)
@OneToMany(() => Order, order => order.user)
orders: Promise<Order[]>;

// RECOMMENDED: Neither. Use explicit relations in queries
const user = await userRepo.findOne({
  where: { id },
  relations: ['orders', 'profile'],
});
```

## Repository Pattern

### Basic CRUD

```typescript
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // Find
  findAll(): Promise<User[]> {
    return this.userRepo.find({
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  findOne(id: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id },
      relations: ['orders'],
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { email },
      select: ['id', 'email', 'password', 'name'], // Include password
    });
  }

  // Create
  async create(dto: CreateUserDto): Promise<User> {
    const user = this.userRepo.create(dto); // Creates entity instance (no DB call)
    return this.userRepo.save(user);         // Inserts into DB
  }

  // Update
  async update(id: string, dto: UpdateUserDto): Promise<User> {
    await this.userRepo.update(id, dto); // Partial update, no return
    return this.findOne(id);
  }

  // Or update with save (returns updated entity)
  async updateWithSave(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  // Soft delete
  async remove(id: string): Promise<void> {
    await this.userRepo.softDelete(id);
  }

  // Hard delete
  async hardRemove(id: string): Promise<void> {
    await this.userRepo.delete(id);
  }

  // Count
  count(status: UserStatus): Promise<number> {
    return this.userRepo.count({ where: { status } });
  }

  // Exists
  exists(email: string): Promise<boolean> {
    return this.userRepo.exists({ where: { email } });
  }
}
```

### QueryBuilder

```typescript
// Complex queries with QueryBuilder
async findWithFilters(filters: UserFilters): Promise<PaginatedResult<User>> {
  const qb = this.userRepo.createQueryBuilder('user')
    .leftJoinAndSelect('user.orders', 'order')
    .where('user.deletedAt IS NULL');

  // Dynamic filters
  if (filters.status) {
    qb.andWhere('user.status = :status', { status: filters.status });
  }

  if (filters.search) {
    qb.andWhere(
      '(user.name ILIKE :search OR user.email ILIKE :search)',
      { search: `%${filters.search}%` },
    );
  }

  if (filters.minOrders) {
    qb.andWhere(
      qb => {
        const sub = qb.subQuery()
          .select('COUNT(*)')
          .from(Order, 'o')
          .where('o.userId = user.id')
          .getQuery();
        return `(${sub}) >= :minOrders`;
      },
    ).setParameter('minOrders', filters.minOrders);
  }

  // Sorting
  const sortField = filters.sortBy || 'createdAt';
  const sortOrder = filters.sortOrder || 'DESC';
  qb.orderBy(`user.${sortField}`, sortOrder);

  // Pagination
  qb.skip((filters.page - 1) * filters.limit).take(filters.limit);

  const [data, total] = await qb.getManyAndCount();

  return { data, meta: { page: filters.page, limit: filters.limit, total } };
}
```

## Migrations

### Generate Migration

```bash
# From entity changes (auto-detects diff)
npx typeorm migration:generate src/migrations/AddStatusToUsers -d src/data-source.ts

# Create empty migration
npx typeorm migration:create src/migrations/SeedDefaultRoles
```

### Migration Structure

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStatusToUsers1700000001 implements MigrationInterface {
  name = 'AddStatusToUsers1700000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type
    await queryRunner.query(`
      CREATE TYPE "user_status_enum" AS ENUM ('active', 'inactive', 'suspended')
    `);

    // Add column with default
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "status" "user_status_enum" NOT NULL DEFAULT 'active'
    `);

    // Create index
    await queryRunner.query(`
      CREATE INDEX "idx_users_status" ON "users" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_users_status"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "user_status_enum"`);
  }
}
```

### Run/Revert Migrations

```bash
# Run pending migrations
npx typeorm migration:run -d src/data-source.ts

# Revert last migration
npx typeorm migration:revert -d src/data-source.ts

# Show migration status
npx typeorm migration:show -d src/data-source.ts
```

## Subscribers and Listeners

```typescript
@EventSubscriber()
export class UserSubscriber implements EntitySubscriberInterface<User> {
  listenTo() {
    return User;
  }

  // Before insert
  async beforeInsert(event: InsertEvent<User>) {
    if (event.entity.password) {
      event.entity.password = await bcrypt.hash(event.entity.password, 12);
    }
  }

  // After insert
  afterInsert(event: InsertEvent<User>) {
    console.log(`User created: ${event.entity.id}`);
  }

  // Before update
  async beforeUpdate(event: UpdateEvent<User>) {
    if (event.entity?.password) {
      event.entity.password = await bcrypt.hash(event.entity.password, 12);
    }
  }

  // After soft remove
  afterSoftRemove(event: SoftRemoveEvent<User>) {
    console.log(`User soft-deleted: ${event.entity?.id}`);
  }
}
```

## Transactions

### Using QueryRunner

```typescript
async transferBalance(fromId: string, toId: string, amount: number): Promise<void> {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const from = await queryRunner.manager.findOne(User, { where: { id: fromId } });
    const to = await queryRunner.manager.findOne(User, { where: { id: toId } });

    if (from.balance < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    from.balance -= amount;
    to.balance += amount;

    await queryRunner.manager.save(from);
    await queryRunner.manager.save(to);

    await queryRunner.commitTransaction();
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
  }
}
```

### Using DataSource.transaction

```typescript
async transferBalance(fromId: string, toId: string, amount: number): Promise<void> {
  await this.dataSource.transaction(async manager => {
    const from = await manager.findOne(User, { where: { id: fromId } });
    const to = await manager.findOne(User, { where: { id: toId } });

    if (from.balance < amount) throw new BadRequestException('Insufficient balance');

    from.balance -= amount;
    to.balance += amount;

    await manager.save([from, to]);
  });
}
```

## Indexes

```typescript
@Entity('orders')
@Index(['userId', 'status'])                        // Composite
@Index(['createdAt'], { where: '"deletedAt" IS NULL' }) // Partial
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()                                          // Simple index
  @Column()
  userId: string;

  @Index({ unique: true })                          // Unique index
  @Column()
  orderNumber: string;

  @Column()
  status: string;
}
```

## Embedded Entities

```typescript
// Reusable embedded column group
export class Address {
  @Column({ length: 255 })
  street: string;

  @Column({ length: 100 })
  city: string;

  @Column({ length: 2 })
  country: string;

  @Column({ length: 20 })
  zipCode: string;
}

@Entity('users')
export class User {
  @Column(() => Address)
  shippingAddress: Address;

  @Column(() => Address)
  billingAddress: Address;
}
// Creates columns: shippingAddressStreet, shippingAddressCity, etc.
```

## Query Optimization

```typescript
// Select only needed columns
const users = await this.userRepo.find({
  select: ['id', 'name', 'email'],
  where: { status: 'active' },
});

// Use relations wisely (avoid loading unnecessary relations)
const user = await this.userRepo.findOne({
  where: { id },
  relations: ['orders'], // Only load when needed
  order: { orders: { createdAt: 'DESC' } },
});

// QueryBuilder with specific selects for performance
const result = await this.userRepo
  .createQueryBuilder('user')
  .select(['user.id', 'user.name', 'user.email'])
  .leftJoin('user.orders', 'order') // leftJoin without Select = don't hydrate
  .addSelect('COUNT(order.id)', 'orderCount')
  .groupBy('user.id')
  .getRawMany();
```

## Connection Configuration

```typescript
// data-source.ts
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'myapp',
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  subscribers: [__dirname + '/**/*.subscriber{.ts,.js}'],
  synchronize: false, // NEVER true in production
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  extra: {
    max: 20,                  // Connection pool max
    connectionTimeoutMillis: 5000,
  },
});
```

## Anti-Patterns

1. **NEVER** use `synchronize: true` in production
2. **NEVER** use `eager: true` on relations with large datasets
3. **NEVER** use `save()` for bulk operations (use `insert()` or QueryBuilder)
4. **NEVER** forget to add indexes on foreign key columns
5. **NEVER** load all relations by default (use explicit `relations` option)
6. **NEVER** use `SELECT *` equivalent (specify `select` for performance)
7. **NEVER** modify a migration that has already been applied
8. **NEVER** use string concatenation in QueryBuilder (always use parameters)
