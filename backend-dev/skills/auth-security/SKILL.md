---
name: auth-security
description: >
  Authentication and security patterns for backend applications. Covers JWT tokens,
  OAuth 2.0, password hashing, RBAC, input validation, SQL injection prevention,
  XSS/CSRF protection, CORS configuration, rate limiting, and secret management.
  Applied automatically when implementing auth, security, validation, or guards.
---

# Authentication & Security Patterns

This skill provides security best practices for backend applications, covering
authentication, authorization, and common vulnerability prevention.

## JWT Authentication

### Token Architecture

```
Access Token:
  - Short-lived (15 minutes)
  - Contains user identity + roles
  - Sent in Authorization header
  - Stateless verification (signature check only)

Refresh Token:
  - Long-lived (7-30 days)
  - Stored in httpOnly cookie or DB
  - Used only to get new access tokens
  - Revocable (stored in DB with family tracking)
```

### JWT Implementation

```typescript
// Token payload (keep minimal)
interface JwtPayload {
  sub: string;       // user ID
  email: string;
  roles: string[];
  iat: number;       // issued at
  exp: number;       // expiration
}

// Sign tokens
const accessToken = jwt.sign(payload, ACCESS_SECRET, { expiresIn: '15m' });
const refreshToken = jwt.sign({ sub: userId }, REFRESH_SECRET, { expiresIn: '7d' });

// Token refresh flow
async refreshTokens(refreshToken: string) {
  const payload = jwt.verify(refreshToken, REFRESH_SECRET);
  const storedToken = await this.tokenRepo.findOne({
    where: { token: refreshToken, revoked: false }
  });

  if (!storedToken) {
    // Token reuse detected — revoke entire family
    await this.tokenRepo.update(
      { family: storedToken.family },
      { revoked: true }
    );
    throw new UnauthorizedException('Token reuse detected');
  }

  // Rotate: revoke old, issue new
  await this.tokenRepo.update(storedToken.id, { revoked: true });
  const newRefresh = await this.createRefreshToken(payload.sub, storedToken.family);
  const newAccess = this.createAccessToken(payload.sub);

  return { accessToken: newAccess, refreshToken: newRefresh };
}
```

### Token Storage

```
RECOMMENDED: httpOnly cookie for refresh token
  - Immune to XSS (JavaScript can't read it)
  - Automatically sent with requests
  - Set Secure, SameSite=Strict

ACCEPTABLE: In-memory for access token
  - Lost on page refresh (refresh token recovers it)
  - Not vulnerable to XSS via localStorage

AVOID: localStorage for any token
  - Accessible to any JavaScript on the page
  - XSS attack can steal tokens
```

```typescript
// Set refresh token as httpOnly cookie
response.cookie('refresh_token', refreshToken, {
  httpOnly: true,
  secure: true,           // HTTPS only
  sameSite: 'strict',     // CSRF protection
  path: '/auth/refresh',  // Only sent to refresh endpoint
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});
```

## OAuth 2.0 / OpenID Connect

### Authorization Code Flow (recommended for web apps)

```
1. Client → Auth Server: /authorize?response_type=code&client_id=...&redirect_uri=...&scope=openid
2. User authenticates with Auth Server
3. Auth Server → Client: redirect_uri?code=AUTHORIZATION_CODE
4. Client → Auth Server: /token (POST with code + client_secret)
5. Auth Server → Client: { access_token, id_token, refresh_token }
```

### PKCE (for SPAs and mobile)

```typescript
// Generate code verifier and challenge
const codeVerifier = crypto.randomBytes(32).toString('base64url');
const codeChallenge = crypto
  .createHash('sha256')
  .update(codeVerifier)
  .digest('base64url');

// Step 1: Include challenge in auth request
`/authorize?...&code_challenge=${codeChallenge}&code_challenge_method=S256`

// Step 4: Include verifier in token request
`/token?...&code_verifier=${codeVerifier}`
```

## Password Hashing

```typescript
// RECOMMENDED: bcrypt (widely supported)
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12; // ~250ms on modern hardware

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ALTERNATIVE: argon2 (winner of Password Hashing Competition)
import * as argon2 from 'argon2';

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,   // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}
```

**Rules:**
- **NEVER** store plaintext passwords
- **NEVER** use MD5, SHA-1, or SHA-256 alone for passwords
- **ALWAYS** use bcrypt (12+ rounds) or argon2id
- **ALWAYS** enforce minimum password requirements (8+ chars, complexity)

## RBAC (Role-Based Access Control)

```typescript
// Roles and permissions
enum Role {
  USER = 'user',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

enum Permission {
  READ_USERS = 'read:users',
  WRITE_USERS = 'write:users',
  DELETE_USERS = 'delete:users',
  MANAGE_ROLES = 'manage:roles',
}

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.USER]: [Permission.READ_USERS],
  [Role.MODERATOR]: [Permission.READ_USERS, Permission.WRITE_USERS],
  [Role.ADMIN]: [Permission.READ_USERS, Permission.WRITE_USERS, Permission.DELETE_USERS],
  [Role.SUPER_ADMIN]: Object.values(Permission), // all permissions
};

// NestJS guard
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
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Delete(':id')
async deleteUser(@Param('id') id: string) { ... }
```

## Input Validation

```typescript
// class-validator with DTOs
import { IsEmail, IsString, MinLength, IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ValidateNested()
  @Type(() => AddressDto)
  @IsOptional()
  address?: AddressDto;
}

// Enable globally
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,           // Strip unknown properties
  forbidNonWhitelisted: true, // Throw on unknown properties
  transform: true,           // Auto-transform types
}));
```

## SQL Injection Prevention

```typescript
// ALWAYS use parameterized queries
// GOOD
const user = await repo.findOne({ where: { email } });
const result = await queryBuilder
  .where('user.email = :email', { email })
  .getOne();

// BAD — SQL injection vulnerable
const result = await query(`SELECT * FROM users WHERE email = '${email}'`);

// BAD — string interpolation in QueryBuilder
queryBuilder.where(`user.email = '${email}'`);
```

## XSS Prevention

```typescript
// Server-side: sanitize output
import * as sanitizeHtml from 'sanitize-html';

function sanitize(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [],        // Strip all HTML
    allowedAttributes: {},
  });
}

// Set security headers
import helmet from 'helmet';
app.use(helmet());
// Sets: Content-Security-Policy, X-XSS-Protection, X-Content-Type-Options, etc.
```

## CORS Configuration

```typescript
// NestJS CORS
app.enableCors({
  origin: [
    'https://yourdomain.com',
    'https://admin.yourdomain.com',
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,          // Allow cookies
  maxAge: 86400,              // Preflight cache (24h)
});

// NEVER in production:
app.enableCors({ origin: '*' }); // Wide open
```

## Rate Limiting

```typescript
// Per-IP and per-user rate limiting
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

ThrottlerModule.forRoot([
  { name: 'short', ttl: 1000, limit: 3 },    // 3 req/sec
  { name: 'medium', ttl: 10000, limit: 20 },  // 20 req/10sec
  { name: 'long', ttl: 60000, limit: 100 },   // 100 req/min
]);

// Custom throttle per endpoint
@Throttle({ short: { limit: 1, ttl: 1000 } }) // 1 req/sec for login
@Post('login')
async login() { ... }

// Stricter for sensitive endpoints (login, password reset)
// More lenient for read-only endpoints
```

## CSRF Protection

```typescript
// For cookie-based auth, use CSRF tokens
import * as csurf from 'csurf';

// Set CSRF cookie
app.use(csurf({ cookie: { httpOnly: true, sameSite: 'strict' } }));

// Client reads token from cookie and sends in header
// X-CSRF-Token: <token>

// SameSite=Strict cookies provide significant CSRF protection alone
// Double-submit cookie pattern is the recommended approach
```

## Secret Management

```
NEVER:
  - Hardcode secrets in source code
  - Commit .env files to git
  - Log secrets or tokens
  - Share secrets via chat/email

ALWAYS:
  - Use environment variables
  - Use secret managers (AWS Secrets Manager, GCP Secret Manager, Vault)
  - Rotate secrets regularly
  - Use different secrets per environment
  - Add .env to .gitignore

Environment variable hierarchy:
  1. Secret manager (production)
  2. Environment variables (CI/CD)
  3. .env.local (local dev, never committed)
  4. .env (defaults, can be committed if no secrets)
```

```typescript
// NestJS ConfigModule
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRY: Joi.string().default('15m'),
      }),
    }),
  ],
})
export class AppModule {}
```

## Security Checklist

- [ ] Passwords hashed with bcrypt/argon2
- [ ] JWT access tokens short-lived (15m)
- [ ] Refresh tokens rotated and revocable
- [ ] Input validated with class-validator (whitelist mode)
- [ ] SQL injection prevented (parameterized queries only)
- [ ] XSS headers set (Helmet)
- [ ] CORS restricted to known origins
- [ ] Rate limiting on auth endpoints
- [ ] CSRF protection for cookie-based auth
- [ ] Secrets in env vars / secret manager
- [ ] HTTPS enforced in production
- [ ] Sensitive data never logged
