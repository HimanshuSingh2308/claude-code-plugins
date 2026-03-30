---
name: nestjs
description: >
  Comprehensive NestJS framework patterns and best practices. Covers module architecture,
  dependency injection, controllers, services, guards, interceptors, pipes, exception
  filters, middleware, DTOs, configuration, GraphQL integration, microservices, WebSockets,
  CQRS, event emitters, decorators, module organization, circular dependency resolution,
  and lifecycle hooks. This is the primary skill for all NestJS development. Use Context7
  MCP to look up latest NestJS docs when needed. Applied automatically when working with
  NestJS, importing @nestjs/* packages, or creating modules/services/controllers.
---

# NestJS Patterns & Best Practices

This is the most comprehensive skill in the backend-dev plugin. It covers every major
NestJS concept with code examples. Use Context7 MCP to verify latest API changes.

## Module Architecture

### Feature Module

```typescript
// users/users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Export for use in other modules
})
export class UsersModule {}
```

### Shared Module

```typescript
// shared/shared.module.ts
@Global() // Available everywhere without importing
@Module({
  providers: [
    LoggerService,
    CacheService,
    HelperService,
  ],
  exports: [
    LoggerService,
    CacheService,
    HelperService,
  ],
})
export class SharedModule {}
```

### Dynamic Module

```typescript
// mailer/mailer.module.ts
@Module({})
export class MailerModule {
  static forRoot(options: MailerOptions): DynamicModule {
    return {
      module: MailerModule,
      global: true,
      providers: [
        { provide: 'MAILER_OPTIONS', useValue: options },
        MailerService,
      ],
      exports: [MailerService],
    };
  }

  static forRootAsync(options: MailerAsyncOptions): DynamicModule {
    return {
      module: MailerModule,
      global: true,
      imports: options.imports || [],
      providers: [
        {
          provide: 'MAILER_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        MailerService,
      ],
      exports: [MailerService],
    };
  }
}

// Usage in AppModule
MailerModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    host: config.get('SMTP_HOST'),
    port: config.get('SMTP_PORT'),
  }),
  inject: [ConfigService],
});
```

### Module Organization (Feature-Based)

```
src/
  app.module.ts
  main.ts
  common/                    # Shared utilities
    decorators/
    filters/
    guards/
    interceptors/
    middleware/
    pipes/
  config/                    # Configuration
    config.module.ts
    database.config.ts
    jwt.config.ts
  auth/                      # Auth feature
    auth.module.ts
    auth.controller.ts
    auth.service.ts
    strategies/
    guards/
    dto/
  users/                     # Users feature
    users.module.ts
    users.controller.ts
    users.service.ts
    entities/
      user.entity.ts
    dto/
      create-user.dto.ts
      update-user.dto.ts
    users.service.spec.ts
  orders/                    # Orders feature
    orders.module.ts
    orders.controller.ts
    orders.service.ts
    entities/
    dto/
```

## Dependency Injection

### Standard Provider

```typescript
@Module({
  providers: [UsersService], // shorthand for:
  // providers: [{ provide: UsersService, useClass: UsersService }],
})
```

### Custom Providers

```typescript
// Value provider
{ provide: 'CONFIG', useValue: { apiKey: 'abc123' } }

// Factory provider
{
  provide: 'DATABASE_CONNECTION',
  useFactory: async (config: ConfigService) => {
    return createConnection(config.get('DATABASE_URL'));
  },
  inject: [ConfigService],
}

// Alias provider
{ provide: 'AliasedService', useExisting: UsersService }

// Class provider with different implementation
{ provide: PaymentService, useClass: StripePaymentService }
```

### Injection Scopes

```typescript
// DEFAULT: Singleton (shared across entire app)
@Injectable() // or @Injectable({ scope: Scope.DEFAULT })
export class UsersService {}

// REQUEST: New instance per request
@Injectable({ scope: Scope.REQUEST })
export class RequestScopedService {
  constructor(@Inject(REQUEST) private request: Request) {}
}

// TRANSIENT: New instance per injection
@Injectable({ scope: Scope.TRANSIENT })
export class TransientService {}
```

**Rules:**
- **ALWAYS** use DEFAULT scope unless you need per-request state
- REQUEST scope bubbles up (if A depends on B with REQUEST scope, A becomes REQUEST-scoped too)
- TRANSIENT is rare; use for stateful utilities like loggers with context

## Controllers

### REST Controller

```typescript
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll({ page, limit, search });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @HttpCode(201)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }

  @Get(':id/avatar')
  @Header('Content-Type', 'image/png')
  getAvatar(@Param('id') id: string, @Res() res: Response) {
    const stream = this.usersService.getAvatarStream(id);
    stream.pipe(res);
  }
}
```

### Request Decorators

```typescript
@Get()
example(
  @Param('id') id: string,             // Route param
  @Query('page') page: string,          // Query string
  @Body() body: CreateDto,              // Request body
  @Body('name') name: string,           // Specific body field
  @Headers('authorization') auth: string, // Header
  @Ip() ip: string,                     // Client IP
  @Req() req: Request,                  // Full request (avoid)
  @Res() res: Response,                 // Full response (avoid)
) {}
```

## Services

### Service Pattern

```typescript
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(options: FindAllOptions): Promise<PaginatedResult<User>> {
    const [data, total] = await this.userRepo.findAndCount({
      skip: (options.page - 1) * options.limit,
      take: options.limit,
      where: options.search
        ? { name: ILike(`%${options.search}%`) }
        : undefined,
      order: { createdAt: 'DESC' },
    });

    return {
      data,
      meta: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.ceil(total / options.limit),
      },
    };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const user = this.userRepo.create(dto);
    const saved = await this.userRepo.save(user);

    this.eventEmitter.emit('user.created', saved);
    this.logger.log(`User created: ${saved.id}`);

    return saved;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id); // Throws if not found
    Object.assign(user, dto);
    const updated = await this.userRepo.save(user);

    this.eventEmitter.emit('user.updated', updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepo.softRemove(user);
    this.eventEmitter.emit('user.deleted', id);
  }
}
```

## Guards

### Authentication Guard

```typescript
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    try {
      const payload = this.jwtService.verify(token);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(request: Request): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : null;
  }
}
```

### Authorization Guard (Role-Based)

```typescript
// roles.decorator.ts
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);

// roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some(role => user.roles?.includes(role));
  }
}

// Usage
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Delete(':id')
remove(@Param('id') id: string) { ... }
```

## Interceptors

### Logging Interceptor

```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const duration = Date.now() - start;
        this.logger.log(`${method} ${url} ${response.statusCode} — ${duration}ms`);
      }),
    );
  }
}
```

### Response Transformation Interceptor

```typescript
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map(data => ({
        data,
        statusCode: context.switchToHttp().getResponse().statusCode,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

### Cache Interceptor

```typescript
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    if (request.method !== 'GET') return next.handle();

    const key = `cache:${request.url}`;
    const cached = await this.cache.get(key);
    if (cached) return of(cached);

    return next.handle().pipe(
      tap(response => this.cache.set(key, response, 60)),
    );
  }
}
```

### Timeout Interceptor

```typescript
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      timeout(5000),
      catchError(err => {
        if (err instanceof TimeoutError) {
          throw new RequestTimeoutException();
        }
        throw err;
      }),
    );
  }
}
```

## Pipes

### Validation Pipe (Global)

```typescript
// main.ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,            // Strip unknown properties
  forbidNonWhitelisted: true, // Error on unknown properties
  transform: true,            // Auto-transform to DTO class instances
  transformOptions: {
    enableImplicitConversion: true, // Convert query string types
  },
}));
```

### Built-in Pipes

```typescript
@Get(':id')
findOne(
  @Param('id', ParseUUIDPipe) id: string,
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('active', new DefaultValuePipe(true), ParseBoolPipe) active: boolean,
) {}
```

### Custom Pipe

```typescript
@Injectable()
export class ParseSortPipe implements PipeTransform {
  transform(value: string): { field: string; order: 'ASC' | 'DESC' }[] {
    if (!value) return [{ field: 'createdAt', order: 'DESC' }];

    return value.split(',').map(item => {
      const order = item.startsWith('-') ? 'DESC' : 'ASC';
      const field = item.replace(/^-/, '');
      return { field, order };
    });
  }
}

// Usage: GET /users?sort=-createdAt,name
@Get()
findAll(@Query('sort', ParseSortPipe) sort: SortOption[]) {}
```

## Exception Filters

### Custom Exception Filter

```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = 500;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message = typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any).message;
      code = this.getErrorCode(status);
    }

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url}`, exception);
    }

    response.status(status).json({
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }

  private getErrorCode(status: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
    };
    return codes[status] || 'INTERNAL_ERROR';
  }
}

// Register globally
app.useGlobalFilters(new AllExceptionsFilter());
```

### Custom Business Exceptions

```typescript
export class BusinessException extends HttpException {
  constructor(
    public readonly errorCode: string,
    message: string,
    status: number = 400,
  ) {
    super({ errorCode, message }, status);
  }
}

export class InsufficientBalanceException extends BusinessException {
  constructor(required: number, available: number) {
    super(
      'INSUFFICIENT_BALANCE',
      `Required ${required} but only ${available} available`,
      422,
    );
  }
}
```

## Middleware

### Functional Middleware

```typescript
// Simple middleware
export function loggerMiddleware(req: Request, res: Response, next: NextFunction) {
  console.log(`[${req.method}] ${req.url}`);
  next();
}

// Register in module
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(loggerMiddleware)
      .forRoutes('*');
  }
}
```

### Class Middleware

```typescript
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantService: TenantService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new BadRequestException('Missing X-Tenant-Id header');
    }

    const tenant = await this.tenantService.findOne(tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    req['tenant'] = tenant;
    next();
  }
}

// Register with exclusions
consumer
  .apply(TenantMiddleware)
  .exclude({ path: 'health', method: RequestMethod.GET })
  .forRoutes('*');
```

## DTOs & Validation

### class-validator Decorators

```typescript
import {
  IsString, IsEmail, IsEnum, IsOptional, IsArray,
  MinLength, MaxLength, IsUUID, ValidateNested,
  IsNumber, Min, Max, IsDateString, Matches,
  ArrayMinSize, ArrayMaxSize,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateOrderDto {
  @IsUUID()
  userId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  items: OrderItemDto[];

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsEmail()
  contactEmail: string;

  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, { message: 'Phone must be E.164 format' })
  @IsOptional()
  phone?: string;
}

export class OrderItemDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(1)
  @Max(999)
  quantity: number;
}
```

### PartialType and OmitType

```typescript
import { PartialType, OmitType, IntersectionType, PickType } from '@nestjs/mapped-types';

// All fields optional
export class UpdateUserDto extends PartialType(CreateUserDto) {}

// Remove specific fields
export class CreateUserResponseDto extends OmitType(CreateUserDto, ['password']) {}

// Pick specific fields
export class LoginDto extends PickType(CreateUserDto, ['email', 'password']) {}

// Combine types
export class ExtendedUserDto extends IntersectionType(CreateUserDto, AdditionalInfoDto) {}
```

## Configuration

### ConfigModule Setup

```typescript
// config/configuration.ts
export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'myapp',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRY || '15m',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  },
});

// app.module.ts
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: Joi.object({
        PORT: Joi.number().default(3000),
        DB_HOST: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
      }),
    }),
  ],
})
export class AppModule {}

// Usage in service
@Injectable()
export class AppService {
  constructor(private config: ConfigService) {}

  getDatabaseHost(): string {
    return this.config.get<string>('database.host');
  }
}
```

## GraphQL with NestJS

### Code-First Approach

```typescript
// GraphQL module setup
@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: process.env.NODE_ENV !== 'production',
      context: ({ req }) => ({ req }),
    }),
  ],
})
export class AppModule {}
```

### Object Types

```typescript
@ObjectType()
export class UserType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field(() => [PostType], { nullable: 'items' })
  posts?: PostType[];

  @Field()
  createdAt: Date;
}
```

### Resolvers

```typescript
@Resolver(() => UserType)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [UserType], { name: 'users' })
  findAll(
    @Args('first', { type: () => Int, defaultValue: 20 }) first: number,
    @Args('after', { type: () => String, nullable: true }) after?: string,
  ) {
    return this.usersService.findAll({ first, after });
  }

  @Query(() => UserType, { name: 'user', nullable: true })
  findOne(@Args('id', { type: () => ID }) id: string) {
    return this.usersService.findOne(id);
  }

  @Mutation(() => UserType)
  @UseGuards(GqlAuthGuard)
  createUser(@Args('input') input: CreateUserInput) {
    return this.usersService.create(input);
  }

  @Mutation(() => UserType)
  @UseGuards(GqlAuthGuard)
  updateUser(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateUserInput,
  ) {
    return this.usersService.update(id, input);
  }

  // Field resolver (for nested relations)
  @ResolveField('posts', () => [PostType])
  getPosts(@Parent() user: UserType, @Context() ctx) {
    return ctx.loaders.postsByUserId.load(user.id);
  }

  // Subscription
  @Subscription(() => UserType)
  userCreated() {
    return this.pubSub.asyncIterator('userCreated');
  }
}
```

### Input Types

```typescript
@InputType()
export class CreateUserInput {
  @Field()
  @IsEmail()
  email: string;

  @Field()
  @MinLength(2)
  name: string;

  @Field()
  @MinLength(8)
  password: string;
}

@InputType()
export class UpdateUserInput extends PartialType(CreateUserInput) {}
```

## CQRS Pattern

```typescript
// Setup
@Module({
  imports: [CqrsModule],
})
export class UsersModule {}

// Command
export class CreateUserCommand {
  constructor(
    public readonly name: string,
    public readonly email: string,
  ) {}
}

// Command Handler
@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(private readonly userRepo: Repository<User>) {}

  async execute(command: CreateUserCommand): Promise<User> {
    const user = this.userRepo.create(command);
    return this.userRepo.save(user);
  }
}

// Query
export class GetUserQuery {
  constructor(public readonly id: string) {}
}

// Query Handler
@QueryHandler(GetUserQuery)
export class GetUserHandler implements IQueryHandler<GetUserQuery> {
  constructor(private readonly userRepo: Repository<User>) {}

  async execute(query: GetUserQuery): Promise<User> {
    return this.userRepo.findOne({ where: { id: query.id } });
  }
}

// Usage in controller
@Controller('users')
export class UsersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.commandBus.execute(new CreateUserCommand(dto.name, dto.email));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.queryBus.execute(new GetUserQuery(id));
  }
}
```

## Event Emitter Patterns

```typescript
// Setup
@Module({
  imports: [EventEmitterModule.forRoot()],
})
export class AppModule {}

// Emit events
@Injectable()
export class OrdersService {
  constructor(private eventEmitter: EventEmitter2) {}

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    const order = await this.orderRepo.save(dto);
    this.eventEmitter.emit('order.created', new OrderCreatedEvent(order));
    return order;
  }
}

// Listen to events
@Injectable()
export class NotificationsListener {
  @OnEvent('order.created')
  handleOrderCreated(event: OrderCreatedEvent) {
    // Send email, push notification, etc.
  }

  @OnEvent('order.*') // Wildcard
  handleAllOrderEvents(event: any) {
    // Log all order events
  }
}
```

## Common Decorators

```typescript
// Combine multiple decorators
export function Auth(...roles: Role[]) {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(...roles),
    ApiBearerAuth('JWT-auth'),
    ApiResponse({ status: 401, description: 'Unauthorized' }),
    ApiResponse({ status: 403, description: 'Forbidden' }),
  );
}

// Custom parameter decorator
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);

// Usage
@Auth(Role.ADMIN)
@Get('profile')
getProfile(@CurrentUser() user: JwtPayload) {
  return user;
}

@Get('my-id')
getMyId(@CurrentUser('sub') userId: string) {
  return userId;
}
```

## Circular Dependency Resolution

```typescript
// PROBLEM: ModuleA imports ModuleB, ModuleB imports ModuleA

// SOLUTION 1: forwardRef
@Module({
  imports: [forwardRef(() => ModuleB)],
  providers: [ServiceA],
  exports: [ServiceA],
})
export class ModuleA {}

@Module({
  imports: [forwardRef(() => ModuleA)],
  providers: [ServiceB],
  exports: [ServiceB],
})
export class ModuleB {}

// In service
@Injectable()
export class ServiceA {
  constructor(
    @Inject(forwardRef(() => ServiceB))
    private serviceB: ServiceB,
  ) {}
}

// SOLUTION 2 (better): Extract shared logic into a third module
@Module({
  providers: [SharedService],
  exports: [SharedService],
})
export class SharedModule {}
```

## Lifecycle Hooks

```typescript
@Injectable()
export class AppService implements
  OnModuleInit,
  OnModuleDestroy,
  OnApplicationBootstrap,
  OnApplicationShutdown
{
  // Called after module's dependencies are resolved
  async onModuleInit() {
    console.log('Module initialized');
    // Connect to external services, warm up caches
  }

  // Called after all modules initialized
  async onApplicationBootstrap() {
    console.log('App bootstrapped');
    // Start background tasks, register cron jobs
  }

  // Called when module is being destroyed
  async onModuleDestroy() {
    console.log('Module destroying');
  }

  // Called on SIGTERM/SIGINT
  async onApplicationShutdown(signal: string) {
    console.log(`Shutting down: ${signal}`);
    // Close connections, flush buffers, stop workers
    await this.redis.quit();
    await this.dataSource.destroy();
  }
}
```

## Execution Order

```
Request Flow:
  Middleware → Guards → Interceptors (before) → Pipes → Controller
  → Service → Controller return → Interceptors (after) → Response

Registration Order:
  Global → Controller-level → Method-level

Exception Flow:
  Exception thrown → Exception Filter → Error Response
```

## WebSockets (Brief)

```typescript
@WebSocketGateway({ cors: true })
export class EventsGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('message')
  handleMessage(client: Socket, payload: any): WsResponse<any> {
    return { event: 'response', data: payload };
  }

  // Broadcast to all
  broadcastToAll(event: string, data: any) {
    this.server.emit(event, data);
  }

  // Broadcast to room
  broadcastToRoom(room: string, event: string, data: any) {
    this.server.to(room).emit(event, data);
  }
}
```

## Microservices (Brief)

```typescript
// TCP microservice
const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
  transport: Transport.TCP,
  options: { host: '0.0.0.0', port: 3001 },
});

// Message pattern handler
@MessagePattern({ cmd: 'get_user' })
async getUser(@Payload() data: { id: string }) {
  return this.usersService.findOne(data.id);
}

// Event pattern handler
@EventPattern('user_created')
async handleUserCreated(@Payload() data: UserCreatedEvent) {
  await this.notificationService.sendWelcome(data.userId);
}

// Client (in another service)
@Inject('USER_SERVICE') private client: ClientProxy;

async getUser(id: string) {
  return this.client.send({ cmd: 'get_user' }, { id }).toPromise();
}
```

## Anti-Patterns

1. **NEVER** put business logic in controllers (controllers are thin routing layers)
2. **NEVER** inject Repository directly into controllers (use services)
3. **NEVER** use `@Res()` unless streaming/custom response (loses interceptors)
4. **NEVER** create circular dependencies (use shared modules or events)
5. **NEVER** use REQUEST scope unnecessarily (massive performance impact)
6. **NEVER** skip validation pipes (always validate input)
7. **NEVER** catch exceptions in services just to re-throw (let filters handle it)
8. **NEVER** hardcode configuration values (use ConfigModule)
9. **NEVER** export everything from a module (minimal public API)
10. **NEVER** put database queries in guards or interceptors
