---
name: firestore
description: >
  Cloud Firestore (Firebase) NoSQL document database patterns for backend development.
  Covers data modeling, denormalization, security rules, real-time listeners, performance
  optimization, NestJS integration, and pricing-aware design. Applied automatically when
  working with Firestore, Firebase, or projects using @google-cloud/firestore or firebase-admin.
trigger: >
  When the project imports firebase-admin, @google-cloud/firestore, or firebase/firestore.
  When user discusses Firestore, Firebase database, document collections, or NoSQL patterns.
  When user asks about real-time data, security rules, or Firebase integration.
---

# Cloud Firestore Patterns

## Core Concepts

Firestore is a **NoSQL document database** — not relational. Think in terms of documents and collections, not tables and rows.

```
Collection → Document → Fields (+ optional Subcollections)

users/                          ← collection
  user123/                      ← document
    name: "Virat"               ← field
    email: "virat@example.com"
    scores/                     ← subcollection
      score1/ { game: "cricket-blitz", score: 245 }
      score2/ { game: "snake", score: 1200 }
```

### Key Constraints
- Document max size: **1 MB**
- Max subcollection depth: **100 levels** (but keep shallow — 2-3 max)
- Max writes per document: **1 write/second** sustained
- Collection group queries: query across ALL subcollections with the same name
- No joins — denormalize instead

---

## Data Modeling Patterns

### Pattern 1: Embedded Data (1:1 or 1:few)

When data is always read together, embed it in the same document:

```javascript
// GOOD — user profile with address (always read together)
{
  name: "Rohit Sharma",
  email: "rohit@example.com",
  address: {
    city: "Mumbai",
    state: "Maharashtra",
    pin: "400001"
  }
}
```

**Use when**: Data is read together 90%+ of the time, rarely updated independently.

### Pattern 2: Subcollections (1:Many)

When child data grows unboundedly or is queried independently:

```javascript
// users/{userId}/scores/{scoreId}
// Each score is a separate document in a subcollection

// Parent: users/user123
{ name: "Rohit", totalGames: 45 }

// Child: users/user123/scores/score1
{ game: "cricket-blitz", score: 245, date: Timestamp.now() }
```

**Use when**: Child items grow without limit, need independent queries, or are paginated.

### Pattern 3: Root Collection with References (M:N)

For many-to-many relationships, use a junction collection or store ID arrays:

```javascript
// Option A: ID arrays (good for small sets < 100)
// teams/team1
{ name: "Mumbai Mavericks", memberIds: ["user1", "user2", "user3"] }

// Option B: Junction collection (good for large sets)
// teamMembers/{autoId}
{ teamId: "team1", userId: "user1", role: "captain", joinedAt: Timestamp }
```

### Pattern 4: Denormalization (Read-Optimized)

Duplicate frequently-read data to avoid extra reads:

```javascript
// In the score document, embed the user's display name
// (even though it also exists in users/userId)
// scores/score123
{
  userId: "user1",
  userName: "Rohit Sharma",  // denormalized — saves 1 read
  game: "cricket-blitz",
  score: 245
}
```

**Trade-off**: Faster reads, but you must update ALL copies when the source changes (fan-out writes).

### Pattern 5: Aggregation Documents

Firestore has no COUNT/SUM — maintain aggregation docs manually:

```javascript
// stats/cricket-blitz
{
  totalScores: 1247,
  totalPlayers: 342,
  highScore: 12890,
  lastUpdated: Timestamp
}

// Update atomically on each score submission:
const statsRef = db.doc('stats/cricket-blitz');
await statsRef.update({
  totalScores: FieldValue.increment(1),
  totalPlayers: FieldValue.increment(isNewPlayer ? 1 : 0),
  highScore: newScore > currentHigh ? newScore : FieldValue.delete(), // conditional
  lastUpdated: FieldValue.serverTimestamp()
});
```

---

## Querying

### Basic Queries

```javascript
const db = admin.firestore();

// Simple where
const scores = await db.collection('scores')
  .where('game', '==', 'cricket-blitz')
  .where('score', '>=', 100)
  .orderBy('score', 'desc')
  .limit(10)
  .get();

// Array contains
const users = await db.collection('users')
  .where('achievements', 'array-contains', 'cb_first_four')
  .get();

// In query (max 30 values)
const games = await db.collection('scores')
  .where('game', 'in', ['cricket-blitz', 'snake', '2048'])
  .get();
```

### Pagination (Cursor-Based)

```javascript
// First page
const first = await db.collection('scores')
  .orderBy('score', 'desc')
  .limit(25)
  .get();

// Next page — use last document as cursor
const lastDoc = first.docs[first.docs.length - 1];
const next = await db.collection('scores')
  .orderBy('score', 'desc')
  .startAfter(lastDoc)
  .limit(25)
  .get();
```

### Composite Indexes

Firestore auto-creates single-field indexes. For queries with multiple `where` + `orderBy`, you need composite indexes:

```
// This query requires a composite index:
.where('game', '==', 'cricket-blitz')
.where('period', '==', 'daily')
.orderBy('score', 'desc')

// Firestore will show an error link to create the index in console
// Or define in firestore.indexes.json:
{
  "indexes": [
    {
      "collectionGroup": "scores",
      "fields": [
        { "fieldPath": "game", "order": "ASCENDING" },
        { "fieldPath": "period", "order": "ASCENDING" },
        { "fieldPath": "score", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### Query Limitations (IMPORTANT)
- Cannot use `!=` and `>` on different fields in the same query
- `array-contains` can only be used once per query
- `in` and `array-contains-any` limited to 30 values
- Range filters (`<`, `>`, `<=`, `>=`) on only ONE field per query
- `orderBy` must match the field used in range filter

---

## Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can read/write their own profile
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }

    // Scores: anyone can read, only authenticated users can create
    match /scores/{scoreId} {
      allow read: if true;
      allow create: if request.auth != null
        && request.resource.data.userId == request.auth.uid
        && request.resource.data.score is number
        && request.resource.data.score >= 0
        && request.resource.data.score <= 10000;
      allow update, delete: if false; // scores are immutable
    }

    // Admin-only access via custom claims
    match /admin/{document=**} {
      allow read, write: if request.auth.token.admin == true;
    }

    // Validate required fields
    match /games/{gameId} {
      allow create: if request.resource.data.keys().hasAll(['name', 'slug', 'createdAt']);
    }
  }
}
```

### Security Rules Best Practices
- **Default deny** — start with no access, open up specifically
- **Validate data types** — `is number`, `is string`, `is list`
- **Validate size** — `request.resource.data.name.size() <= 100`
- **Use custom claims** for roles — `request.auth.token.role == 'admin'`
- **Never trust client data** — validate everything in rules
- **Test rules** with the Firebase emulator before deploying

---

## NestJS Integration

### Setup with firebase-admin

```typescript
// firebase.module.ts
import { Module, Global } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Global()
@Module({
  providers: [
    {
      provide: 'FIREBASE_ADMIN',
      useFactory: () => {
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: process.env.FIREBASE_PROJECT_ID,
          });
        }
        return admin;
      },
    },
    {
      provide: 'FIRESTORE',
      useFactory: () => admin.firestore(),
    },
  ],
  exports: ['FIREBASE_ADMIN', 'FIRESTORE'],
})
export class FirebaseModule {}
```

### Repository Pattern for Firestore

```typescript
// base-firestore.repository.ts
import { Inject, Injectable } from '@nestjs/common';
import { Firestore, CollectionReference, DocumentData } from '@google-cloud/firestore';

@Injectable()
export abstract class BaseFirestoreRepository<T> {
  protected collection: CollectionReference<DocumentData>;

  constructor(
    @Inject('FIRESTORE') protected firestore: Firestore,
    protected collectionName: string,
  ) {
    this.collection = this.firestore.collection(collectionName);
  }

  async findById(id: string): Promise<T | null> {
    const doc = await this.collection.doc(id).get();
    return doc.exists ? ({ id: doc.id, ...doc.data() } as T) : null;
  }

  async findAll(limit = 100): Promise<T[]> {
    const snapshot = await this.collection.limit(limit).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
  }

  async create(data: Partial<T>): Promise<T> {
    const ref = await this.collection.add({
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() } as T;
  }

  async update(id: string, data: Partial<T>): Promise<void> {
    await this.collection.doc(id).update({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  async delete(id: string): Promise<void> {
    await this.collection.doc(id).delete();
  }
}

// scores.repository.ts
@Injectable()
export class ScoresRepository extends BaseFirestoreRepository<Score> {
  constructor(@Inject('FIRESTORE') firestore: Firestore) {
    super(firestore, 'scores');
  }

  async getLeaderboard(gameId: string, limit = 10): Promise<Score[]> {
    const snapshot = await this.collection
      .where('game', '==', gameId)
      .orderBy('score', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Score));
  }
}
```

---

## Real-Time Listeners

```javascript
// Server-side (NestJS) — listen for changes
const unsubscribe = db.collection('scores')
  .where('game', '==', 'cricket-blitz')
  .orderBy('score', 'desc')
  .limit(10)
  .onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') console.log('New score:', change.doc.data());
      if (change.type === 'modified') console.log('Updated:', change.doc.data());
      if (change.type === 'removed') console.log('Removed:', change.doc.id);
    });
  });

// Client-side (browser) — real-time leaderboard
import { onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';

const q = query(collection(db, 'scores'), orderBy('score', 'desc'), limit(10));
const unsubscribe = onSnapshot(q, (snapshot) => {
  const scores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderLeaderboard(scores);
});
```

---

## Performance Optimization

### Batch Writes (max 500 operations)

```javascript
const batch = db.batch();
scores.forEach(score => {
  const ref = db.collection('scores').doc();
  batch.set(ref, score);
});
await batch.commit();
```

### Transactions (read-then-write atomically)

```javascript
await db.runTransaction(async (tx) => {
  const statsRef = db.doc('stats/cricket-blitz');
  const stats = await tx.get(statsRef);
  const current = stats.data();

  tx.update(statsRef, {
    totalScores: current.totalScores + 1,
    highScore: Math.max(current.highScore, newScore),
  });
});
```

### Avoid Hot Spots
- **Don't use sequential IDs** — causes write contention on the same storage node
- **Distribute writes** across document paths
- **Ramp up gradually** — start at 500 ops/sec, increase 50% every 5 minutes for new collections

### Offline Caching (Client)

```javascript
// Enable offline persistence (web)
import { enableIndexedDbPersistence } from 'firebase/firestore';
await enableIndexedDbPersistence(db);
// Now queries work offline and sync when reconnected
```

---

## Pricing Awareness

| Operation | Cost (US) | Tip |
|-----------|-----------|-----|
| Document read | $0.06 / 100K | Cache aggressively, denormalize to reduce reads |
| Document write | $0.18 / 100K | Batch writes, avoid unnecessary updates |
| Document delete | $0.02 / 100K | Cheap — clean up old data |
| Storage | $0.18 / GB / month | Keep documents small, use Cloud Storage for files |
| Network egress | $0.12 / GB | Use `select()` to return only needed fields |

### Cost Reduction Patterns
- **select() specific fields** — don't read entire documents if you only need 2 fields
- **Use aggregation docs** instead of counting all documents
- **Paginate** — never load all documents at once
- **Cache on server** — Redis/memory cache for frequently-read data
- **Use Firebase emulator** for development (free, no quota)

---

## Firestore vs PostgreSQL — When to Use Which

| Factor | Firestore | PostgreSQL |
|--------|-----------|------------|
| **Real-time sync** | Built-in onSnapshot | Need WebSockets + pub/sub |
| **Scaling** | Automatic, serverless | Manual (or managed like Cloud SQL) |
| **Complex queries** | Limited (no joins, single inequality) | Full SQL power |
| **Relationships** | Denormalize or reference IDs | Foreign keys, JOINs |
| **Transactions** | Limited (500 writes, 10s timeout) | Full ACID |
| **Schema** | Schemaless (flexible) | Schema enforced (strict) |
| **Cost model** | Pay per read/write | Pay per instance (fixed) |
| **Best for** | Real-time apps, MVPs, mobile | Complex data, analytics, enterprise |

### Use BOTH Together
Many projects use Firestore for real-time features (chat, presence, notifications) and PostgreSQL for complex relational data (users, orders, analytics). Firebase Data Connect bridges them with GraphQL.

---

## Common Anti-Patterns

1. **Storing large arrays in documents** — arrays > 100 items cause read/write cost spikes
2. **Using sequential document IDs** — creates hot spots
3. **Not setting security rules** — default is open in test mode!
4. **Reading entire collections** — always use `limit()` and pagination
5. **Updating the same document rapidly** — max 1 write/sec sustained per doc
6. **Not using batch writes** — individual writes are slower and more expensive
7. **Deeply nested subcollections** — keep to 2-3 levels max
8. **Not planning indexes** — composite queries fail without indexes
