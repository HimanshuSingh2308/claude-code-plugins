---
name: api-design
description: >
  Generic API design patterns for REST and GraphQL backends. Covers resource naming,
  HTTP methods, status codes, pagination, filtering, versioning, error handling,
  rate limiting, idempotency, webhooks, and bulk operations. Applied automatically
  when designing or reviewing API endpoints.
---

# API Design Patterns

This skill provides best practices for designing robust, consistent, and developer-friendly APIs.

## REST Best Practices

### Resource Naming

```
GOOD:
  GET    /users              — List users
  GET    /users/:id          — Get single user
  POST   /users              — Create user
  PATCH  /users/:id          — Partial update
  PUT    /users/:id          — Full replace
  DELETE /users/:id          — Delete user
  GET    /users/:id/orders   — Nested resource

BAD:
  GET    /getUsers
  POST   /createUser
  GET    /user/list
  POST   /users/delete/:id
```

**Rules:**
- **ALWAYS** use plural nouns for collections (`/users`, not `/user`)
- **ALWAYS** use kebab-case for multi-word resources (`/order-items`)
- **NEVER** use verbs in URIs (HTTP method conveys the action)
- **ALWAYS** nest sub-resources logically (`/users/:id/posts`)
- Limit nesting to 2 levels max (`/users/:id/posts/:postId`)

### HTTP Methods & Status Codes

| Method | Purpose | Request Body | Idempotent | Status Codes |
|--------|---------|-------------|------------|--------------|
| GET | Read | No | Yes | 200, 404 |
| POST | Create | Yes | No | 201, 400, 409 |
| PUT | Full Replace | Yes | Yes | 200, 404 |
| PATCH | Partial Update | Yes | No | 200, 404 |
| DELETE | Remove | No | Yes | 204, 404 |

**Common Status Codes:**

```
2xx Success:
  200 OK                  — General success
  201 Created             — Resource created (return Location header)
  204 No Content          — Success with no body (DELETE)

4xx Client Errors:
  400 Bad Request          — Validation error
  401 Unauthorized         — Missing/invalid auth
  403 Forbidden            — Authenticated but not allowed
  404 Not Found            — Resource doesn't exist
  409 Conflict             — Duplicate or state conflict
  422 Unprocessable Entity — Semantic validation failure
  429 Too Many Requests    — Rate limited

5xx Server Errors:
  500 Internal Server Error — Unexpected server failure
  502 Bad Gateway           — Upstream service failure
  503 Service Unavailable   — Temporary overload
```

### Pagination

```typescript
// Cursor-based (preferred for large datasets)
GET /users?cursor=eyJpZCI6MTAwfQ&limit=20

// Response
{
  "data": [...],
  "meta": {
    "cursor": "eyJpZCI6MTIwfQ",
    "hasMore": true,
    "limit": 20
  }
}

// Offset-based (simpler, OK for small datasets)
GET /users?page=2&limit=20

// Response
{
  "data": [...],
  "meta": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Filtering, Sorting, Search

```
# Filtering
GET /users?status=active&role=admin

# Sorting (prefix with - for descending)
GET /users?sort=-createdAt,name

# Search
GET /users?search=john

# Combined
GET /users?status=active&sort=-createdAt&page=1&limit=20
```

### Request/Response Envelope

```typescript
// Success response
{
  "data": { ... },         // or array for collections
  "meta": {                // pagination, counts
    "total": 42,
    "page": 1,
    "limit": 20
  }
}

// Error response
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "must be a valid email address",
        "code": "INVALID_FORMAT"
      }
    ]
  }
}
```

## GraphQL Patterns

### Schema Design

```graphql
type User {
  id: ID!
  email: String!
  name: String!
  posts(first: Int, after: String): PostConnection!
  createdAt: DateTime!
}

type PostConnection {
  edges: [PostEdge!]!
  pageInfo: PageInfo!
}

type PostEdge {
  node: Post!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  endCursor: String
}

type Query {
  user(id: ID!): User
  users(filter: UserFilter, first: Int, after: String): UserConnection!
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
  deleteUser(id: ID!): Boolean!
}

input CreateUserInput {
  email: String!
  name: String!
  password: String!
}
```

### N+1 Problem & DataLoader

```typescript
// BAD: N+1 queries
@ResolveField('posts')
async posts(@Parent() user: User) {
  return this.postService.findByUserId(user.id); // 1 query per user
}

// GOOD: DataLoader batching
@ResolveField('posts')
async posts(@Parent() user: User, @Context() ctx) {
  return ctx.loaders.postsByUserId.load(user.id); // Batched!
}

// DataLoader setup
const postsByUserId = new DataLoader(async (userIds: string[]) => {
  const posts = await postRepo.find({ where: { userId: In(userIds) } });
  return userIds.map(id => posts.filter(p => p.userId === id));
});
```

## API Versioning

| Strategy | Example | Pros | Cons |
|----------|---------|------|------|
| URL Path | `/v1/users` | Clear, easy routing | URL changes |
| Header | `Accept: application/vnd.api+json;version=1` | Clean URLs | Hidden |
| Query Param | `/users?version=1` | Simple | Ugly |

**Recommendation:** Use URL path versioning (`/v1/`) for public APIs; use header versioning for internal APIs.

## Rate Limiting

```typescript
// Return rate limit headers
{
  "X-RateLimit-Limit": "100",       // Max requests per window
  "X-RateLimit-Remaining": "95",    // Remaining in window
  "X-RateLimit-Reset": "1672531200" // Window reset timestamp
}

// When exceeded: 429 Too Many Requests
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Retry after 60 seconds.",
    "retryAfter": 60
  }
}
```

## Idempotency Keys

```typescript
// Client sends idempotency key for non-idempotent requests
POST /payments
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

// Server stores result keyed by idempotency key
// Duplicate requests return cached result (same status + body)
```

## Webhook Design

```typescript
// Webhook payload
{
  "id": "evt_abc123",
  "type": "order.completed",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "orderId": "ord_456",
    "total": 99.99
  }
}

// Webhook best practices:
// - Sign payloads with HMAC-SHA256
// - Include event ID for deduplication
// - Retry with exponential backoff (1s, 5s, 30s, 5m, 1h)
// - Allow consumers to verify signature
// - Return 2xx within 5 seconds (process async)
```

## Bulk Operations

```typescript
// Batch create
POST /users/bulk
{
  "items": [
    { "email": "a@test.com", "name": "Alice" },
    { "email": "b@test.com", "name": "Bob" }
  ]
}

// Response with per-item status
{
  "results": [
    { "index": 0, "status": 201, "data": { "id": "1", ... } },
    { "index": 1, "status": 400, "error": { "message": "Email taken" } }
  ],
  "summary": { "succeeded": 1, "failed": 1, "total": 2 }
}
```

## File Upload Patterns

```typescript
// Small files: multipart/form-data
POST /uploads
Content-Type: multipart/form-data
  file: <binary>
  metadata: {"type": "avatar"}

// Large files: presigned URL pattern
// Step 1: Get upload URL
POST /uploads/presign
{ "filename": "video.mp4", "contentType": "video/mp4" }
// Response: { "uploadUrl": "https://s3...", "key": "uploads/abc123.mp4" }

// Step 2: Client uploads directly to S3
PUT {uploadUrl}
Content-Type: video/mp4
<binary>

// Step 3: Confirm upload
POST /uploads/confirm
{ "key": "uploads/abc123.mp4" }
```

## Anti-Patterns

1. **NEVER** use verbs in REST URIs
2. **NEVER** return 200 for errors
3. **NEVER** ignore pagination (even for "small" collections)
4. **NEVER** expose internal IDs without consideration (use UUIDs)
5. **NEVER** return different shapes for the same endpoint
6. **NEVER** nest resources more than 2 levels deep
7. **NEVER** use GET for state-changing operations
8. **NEVER** ignore content-type headers
