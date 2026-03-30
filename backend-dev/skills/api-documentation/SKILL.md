---
name: api-documentation
description: >
  API documentation patterns and tooling. Covers OpenAPI/Swagger setup with NestJS
  decorators, schema generation, GraphQL documentation, Postman collection generation,
  API changelog practices, code-first vs schema-first approaches, example responses,
  and authentication documentation. Applied automatically when documenting APIs or
  setting up Swagger.
---

# API Documentation

This skill provides best practices for documenting APIs using OpenAPI/Swagger,
GraphQL schema docs, and related tooling.

## OpenAPI/Swagger with NestJS

### Setup

```typescript
// main.ts
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('My API')
    .setDescription('Backend API documentation')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT-auth',
    )
    .addTag('users', 'User management endpoints')
    .addTag('auth', 'Authentication endpoints')
    .addTag('orders', 'Order management endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Keep token between page reloads
    },
  });

  await app.listen(3000);
}
```

### Controller Decorators

```typescript
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth,
  ApiParam, ApiQuery, ApiBody,
} from '@nestjs/swagger';

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {

  @ApiOperation({ summary: 'Get all users', description: 'Returns paginated list of users' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully', type: PaginatedUsersDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get()
  findAll(@Query() query: FindUsersQueryDto) { ... }

  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User found', type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) { ... }

  @ApiOperation({ summary: 'Create a new user' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, description: 'User created successfully', type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @Post()
  create(@Body() dto: CreateUserDto) { ... }

  @ApiOperation({ summary: 'Update user' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, description: 'User updated', type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) { ... }

  @ApiOperation({ summary: 'Delete user (soft delete)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 204, description: 'User deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) { ... }
}
```

### DTO Decorators for Schema Generation

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'john@example.com',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({
    description: 'User password (min 8 characters)',
    example: 'SecurePass123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({
    description: 'User role',
    enum: Role,
    default: Role.USER,
  })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}

export class UserResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ enum: Role, example: Role.USER })
  role: Role;

  @ApiProperty({ example: '2025-01-15T10:30:00.000Z' })
  createdAt: Date;
}

export class PaginatedUsersDto {
  @ApiProperty({ type: [UserResponseDto] })
  data: UserResponseDto[];

  @ApiProperty({
    example: { page: 1, limit: 20, total: 150, totalPages: 8 },
  })
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### Error Response Schema

```typescript
export class ErrorResponseDto {
  @ApiProperty({
    example: {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: [
        { field: 'email', message: 'must be a valid email' },
      ],
    },
  })
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}
```

## GraphQL Schema Documentation

```typescript
// Code-first approach with descriptions
@ObjectType({ description: 'User entity representing a registered user' })
export class UserType {
  @Field(() => ID, { description: 'Unique user identifier' })
  id: string;

  @Field({ description: 'User email address' })
  email: string;

  @Field({ description: 'User display name' })
  name: string;

  @Field(() => [PostType], {
    description: 'Posts authored by this user',
    nullable: 'items',
  })
  posts: PostType[];
}

@InputType({ description: 'Input for creating a new user' })
export class CreateUserInput {
  @Field({ description: 'Valid email address' })
  email: string;

  @Field({ description: 'Full name (min 2 characters)' })
  name: string;
}
```

## Postman Collection Generation

```typescript
// Export OpenAPI spec as JSON
const document = SwaggerModule.createDocument(app, config);

// Write to file for Postman import
import { writeFileSync } from 'fs';
writeFileSync('./openapi-spec.json', JSON.stringify(document, null, 2));

// Import into Postman:
// 1. Open Postman → Import → File → openapi-spec.json
// 2. Auto-generates collection with all endpoints
// 3. Set {{baseUrl}} variable to your API URL
```

## API Changelog Practices

```markdown
# API Changelog

## v1.3.0 (2025-01-15)
### Added
- `GET /users/:id/orders` — List user orders
- `status` filter on `GET /orders`

### Changed
- `GET /users` response now includes `lastLoginAt` field

### Deprecated
- `GET /users?active=true` — Use `status=active` filter instead (removal in v1.5.0)

## v1.2.0 (2025-01-01)
### Added
- Bulk create endpoint: `POST /users/bulk`

### Fixed
- Pagination `total` count now excludes soft-deleted records
```

**Rules:**
- **ALWAYS** document breaking changes prominently
- **ALWAYS** provide deprecation notices with removal timeline
- **ALWAYS** version the API when making breaking changes
- **NEVER** remove fields without deprecation period

## Code-First vs Schema-First

```
Code-First (NestJS default):
  - Define DTOs/entities in TypeScript
  - Swagger decorators generate OpenAPI spec
  - Pros: Single source of truth in code, type-safe
  - Cons: Spec is derived, harder to share upfront

Schema-First:
  - Write OpenAPI YAML/JSON first
  - Generate code from schema
  - Pros: Design-first, share spec before implementation
  - Cons: Code generation complexity, potential drift
```

**Recommendation:** Use code-first for NestJS projects. Generate and commit the OpenAPI spec
as a build artifact for consumers.

## Authentication Documentation

```typescript
// Document auth requirements clearly
const config = new DocumentBuilder()
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Enter your JWT access token',
    },
    'JWT-auth',
  )
  .addApiKey(
    {
      type: 'apiKey',
      in: 'header',
      name: 'X-API-Key',
      description: 'API key for service-to-service calls',
    },
    'api-key',
  )
  .build();

// Per-controller or per-endpoint
@ApiBearerAuth('JWT-auth')  // Requires JWT
@ApiSecurity('api-key')      // Requires API key
```

## Documentation Checklist

- [ ] All endpoints have `@ApiOperation` with summary
- [ ] All DTOs have `@ApiProperty` with examples
- [ ] All error responses documented (`@ApiResponse`)
- [ ] Authentication requirements documented
- [ ] Query parameters documented with types and examples
- [ ] Pagination format documented
- [ ] Error response format documented with examples
- [ ] Changelog maintained
- [ ] OpenAPI spec exported and versioned
