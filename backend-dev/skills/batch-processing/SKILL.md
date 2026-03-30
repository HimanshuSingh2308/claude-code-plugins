---
name: batch-processing
description: >
  Batch processing and bulk operation patterns for backend applications. Covers batch
  database operations, chunked processing, streaming large datasets, bulk API endpoints,
  ETL patterns, queue-based batch jobs, memory-efficient processing, and progress tracking.
  Applied when handling large data volumes, bulk imports/exports, or background data processing.
trigger: >
  When user processes large datasets, implements bulk operations, handles CSV/file imports,
  runs data migrations, or needs to process thousands of records efficiently.
  When user mentions "batch", "bulk", "import", "export", "process all", "large dataset".
---

# Batch Processing & Bulk Operations

## Core Principle

> Never load everything into memory. Process in chunks, report progress, handle failures gracefully.

---

## 1. Database Batch Operations

### Bulk Insert

```typescript
// ❌ BAD — one INSERT per record (N database calls)
for (const item of items) {
  await repo.save(item); // 10,000 items = 10,000 queries
}

// ✅ GOOD — batch insert with chunks
async function batchInsert<T>(repo: Repository<T>, items: T[], chunkSize = 500) {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await repo
      .createQueryBuilder()
      .insert()
      .values(chunk)
      .orIgnore() // skip duplicates instead of failing
      .execute();
  }
}

// ✅ BEST — with progress tracking
async function batchInsertWithProgress<T>(
  repo: Repository<T>,
  items: T[],
  chunkSize = 500,
  onProgress?: (processed: number, total: number) => void,
) {
  let processed = 0;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await repo.createQueryBuilder().insert().values(chunk).execute();
    processed += chunk.length;
    onProgress?.(processed, items.length);
  }
  return processed;
}
```

### Bulk Update

```typescript
// ❌ BAD — individual updates
for (const user of users) {
  await userRepo.update(user.id, { lastActive: new Date() });
}

// ✅ GOOD — single query bulk update
await userRepo
  .createQueryBuilder()
  .update(User)
  .set({ lastActive: new Date() })
  .where('id IN (:...ids)', { ids: userIds })
  .execute();

// ✅ GOOD — conditional bulk update
await userRepo
  .createQueryBuilder()
  .update(User)
  .set({ tier: () => "CASE WHEN total_score > 10000 THEN 'gold' WHEN total_score > 5000 THEN 'silver' ELSE 'bronze' END" })
  .where('tier_updated_at < :cutoff', { cutoff: yesterday })
  .execute();
```

### Bulk Delete

```typescript
// ❌ BAD — delete one by one
for (const id of idsToDelete) {
  await repo.delete(id);
}

// ✅ GOOD — batch delete
await repo
  .createQueryBuilder()
  .delete()
  .where('id IN (:...ids)', { ids: idsToDelete })
  .execute();

// ✅ GOOD — delete with conditions (e.g., cleanup old data)
await scoreRepo
  .createQueryBuilder()
  .delete()
  .where('createdAt < :cutoff', { cutoff: thirtyDaysAgo })
  .andWhere('period = :period', { period: 'daily' })
  .execute();
```

---

## 2. Streaming Large Datasets

### Stream from Database (Memory-Efficient)

```typescript
// ❌ BAD — loads ALL rows into memory
const allScores = await scoreRepo.find(); // 1M rows = OOM crash

// ✅ GOOD — stream with cursor
async function processAllScores(callback: (score: Score) => Promise<void>) {
  const queryRunner = dataSource.createQueryRunner();
  const stream = await queryRunner.stream('SELECT * FROM scores ORDER BY id');

  return new Promise<void>((resolve, reject) => {
    stream.on('data', async (row) => {
      stream.pause(); // backpressure
      try {
        await callback(row);
      } catch (err) {
        // log error, continue processing
      }
      stream.resume();
    });
    stream.on('end', resolve);
    stream.on('error', reject);
  });
}

// ✅ ALTERNATIVE — paginated cursor processing
async function processInPages<T>(
  repo: Repository<T>,
  pageSize = 1000,
  callback: (batch: T[]) => Promise<void>,
) {
  let lastId: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const qb = repo.createQueryBuilder('e').orderBy('e.id', 'ASC').take(pageSize);
    if (lastId) qb.where('e.id > :lastId', { lastId });

    const batch = await qb.getMany();
    if (batch.length === 0) { hasMore = false; break; }

    await callback(batch);
    lastId = batch[batch.length - 1].id;
    hasMore = batch.length === pageSize;
  }
}
```

### Stream to Client (Large Exports)

```typescript
// NestJS streaming response for CSV export
@Get('export')
async exportScores(@Res() res: Response) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=scores.csv');
  res.write('id,userId,game,score,date\n');

  await processInPages(this.scoreRepo, 1000, async (batch) => {
    for (const score of batch) {
      res.write(`${score.id},${score.userId},${score.gameId},${score.score},${score.createdAt}\n`);
    }
  });

  res.end();
}
```

---

## 3. Queue-Based Batch Jobs

### BullMQ Pattern

```typescript
// batch-processor.module.ts
@Module({
  imports: [
    BullModule.registerQueue({ name: 'batch-jobs' }),
  ],
  providers: [BatchProcessor, BatchJobConsumer],
})
export class BatchModule {}

// Submit a batch job
@Injectable()
export class BatchProcessor {
  constructor(@InjectQueue('batch-jobs') private queue: Queue) {}

  async submitBatchJob(type: string, data: any[], options?: { priority?: number }) {
    // Split into chunks and create sub-jobs
    const chunkSize = 500;
    const chunks = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }

    // Create a parent job with child jobs
    const parentJob = await this.queue.add('batch-parent', {
      type, totalItems: data.length, totalChunks: chunks.length,
    }, { priority: options?.priority || 0 });

    for (let i = 0; i < chunks.length; i++) {
      await this.queue.add('batch-chunk', {
        parentJobId: parentJob.id,
        chunkIndex: i,
        items: chunks[i],
        type,
      }, { priority: options?.priority || 0 });
    }

    return { jobId: parentJob.id, totalChunks: chunks.length, totalItems: data.length };
  }
}

// Process chunks
@Processor('batch-jobs')
export class BatchJobConsumer {
  @Process('batch-chunk')
  async processChunk(job: Job) {
    const { items, type, chunkIndex } = job.data;
    let processed = 0;
    let failed = 0;

    for (const item of items) {
      try {
        await this.processItem(type, item);
        processed++;
      } catch (err) {
        failed++;
        // Log but don't fail the entire chunk
      }
      // Update progress
      await job.updateProgress(Math.round((processed / items.length) * 100));
    }

    return { processed, failed, chunkIndex };
  }
}
```

### Job Progress Tracking

```typescript
// GET /batch-jobs/:jobId/status
@Get(':jobId/status')
async getJobStatus(@Param('jobId') jobId: string) {
  const job = await this.queue.getJob(jobId);
  if (!job) throw new NotFoundException('Job not found');

  const state = await job.getState();
  const progress = job.progress;
  const result = job.returnvalue;

  return {
    jobId,
    state, // 'waiting' | 'active' | 'completed' | 'failed'
    progress,
    result,
    createdAt: new Date(job.timestamp),
    processedAt: job.processedOn ? new Date(job.processedOn) : null,
    completedAt: job.finishedOn ? new Date(job.finishedOn) : null,
  };
}
```

---

## 4. Bulk API Endpoints

### Bulk Create

```typescript
// POST /users/bulk
@Post('bulk')
async bulkCreate(@Body() dto: BulkCreateUsersDto) {
  const { items } = dto; // max 100 items per request

  const results = {
    created: [] as string[],
    failed: [] as { index: number; error: string }[],
  };

  // Process in transaction
  await this.dataSource.transaction(async (manager) => {
    for (let i = 0; i < items.length; i++) {
      try {
        const user = manager.create(User, items[i]);
        const saved = await manager.save(user);
        results.created.push(saved.id);
      } catch (err) {
        results.failed.push({ index: i, error: err.message });
      }
    }
  });

  return {
    total: items.length,
    created: results.created.length,
    failed: results.failed.length,
    failures: results.failed,
  };
}

// DTO with validation
export class BulkCreateUsersDto {
  @IsArray()
  @ArrayMaxSize(100) // prevent abuse
  @ValidateNested({ each: true })
  @Type(() => CreateUserDto)
  items: CreateUserDto[];
}
```

### Bulk Update / Patch

```typescript
// PATCH /users/bulk
@Patch('bulk')
async bulkUpdate(@Body() dto: BulkUpdateDto) {
  const { ids, update } = dto;

  if (ids.length > 500) {
    throw new BadRequestException('Max 500 items per bulk update');
  }

  const result = await this.userRepo
    .createQueryBuilder()
    .update(User)
    .set(update)
    .where('id IN (:...ids)', { ids })
    .execute();

  return { updated: result.affected };
}
```

---

## 5. File Import Processing

### CSV Import with Streaming

```typescript
import * as csv from 'csv-parser';
import { Readable } from 'stream';

@Post('import')
@UseInterceptors(FileInterceptor('file'))
async importCsv(@UploadedFile() file: Express.Multer.File) {
  const results: any[] = [];
  const errors: { line: number; error: string }[] = [];
  let lineNum = 0;

  return new Promise((resolve) => {
    const stream = Readable.from(file.buffer);

    stream
      .pipe(csv())
      .on('data', (row) => {
        lineNum++;
        try {
          // Validate row
          const validated = this.validateRow(row);
          results.push(validated);
        } catch (err) {
          errors.push({ line: lineNum, error: err.message });
        }
      })
      .on('end', async () => {
        // Batch insert valid rows
        const inserted = await batchInsert(this.repo, results, 500);

        resolve({
          totalRows: lineNum,
          imported: inserted,
          errors: errors.length,
          errorDetails: errors.slice(0, 50), // return first 50 errors
        });
      });
  });
}
```

---

## 6. Data Migration / Transformation

### Idempotent Migration Pattern

```typescript
// Migration that transforms data safely
async function migrateUserTiers(dataSource: DataSource) {
  const batchSize = 1000;
  let processed = 0;
  let lastId: string | null = null;

  while (true) {
    // Fetch batch (only unprocessed rows)
    const qb = dataSource
      .createQueryBuilder()
      .select('u')
      .from(User, 'u')
      .where('u.tier IS NULL') // idempotent: skip already-migrated
      .orderBy('u.id', 'ASC')
      .take(batchSize);

    if (lastId) qb.andWhere('u.id > :lastId', { lastId });

    const batch = await qb.getMany();
    if (batch.length === 0) break;

    // Transform and update
    await dataSource.transaction(async (manager) => {
      for (const user of batch) {
        const tier = calculateTier(user.totalScore);
        await manager.update(User, user.id, { tier });
      }
    });

    processed += batch.length;
    lastId = batch[batch.length - 1].id;
    console.log(`Migrated ${processed} users...`);
  }

  console.log(`Migration complete. ${processed} users updated.`);
}
```

---

## 7. Retry & Error Handling

```typescript
// Retry with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;

      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
      console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Unreachable');
}

// Dead letter queue for failed items
async function processWithDLQ<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  dlqHandler: (item: T, error: Error) => Promise<void>,
) {
  const results = { success: 0, failed: 0 };

  for (const item of items) {
    try {
      await withRetry(() => processor(item));
      results.success++;
    } catch (err) {
      results.failed++;
      await dlqHandler(item, err as Error);
    }
  }

  return results;
}
```

---

## 8. Firestore Batch Operations

```typescript
// Firestore batch write (max 500 per batch)
async function firestoreBatchWrite(
  db: Firestore,
  collection: string,
  items: any[],
) {
  const batchSize = 450; // leave margin under 500 limit
  let written = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = db.batch();
    const chunk = items.slice(i, i + batchSize);

    for (const item of chunk) {
      const ref = db.collection(collection).doc();
      batch.set(ref, {
        ...item,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    written += chunk.length;
  }

  return written;
}

// Firestore bulk delete (recursive collection delete)
async function deleteCollection(db: Firestore, collectionPath: string) {
  const batchSize = 100;
  const collectionRef = db.collection(collectionPath);

  while (true) {
    const snapshot = await collectionRef.limit(batchSize).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
}
```

---

## 9. Performance Benchmarks

| Approach | 10K records | 100K records | 1M records |
|----------|------------|-------------|-----------|
| Individual INSERT | 30s | 5min | 50min |
| Batch INSERT (500/chunk) | 2s | 15s | 2.5min |
| COPY (PostgreSQL) | 0.5s | 3s | 30s |
| Streaming + batch | 3s | 20s | 3min |

**Rule of thumb**: If > 100 records, always batch. If > 10K, stream. If > 100K, use COPY or queue.

---

## 10. Batch Processing Checklist

```
□ Never load unbounded dataset into memory (use streaming/pagination)
□ Chunk size configured (typically 100-1000 depending on row size)
□ Progress tracking for long-running jobs
□ Idempotent operations (safe to re-run on failure)
□ Error handling: log failures, continue processing remaining
□ Dead letter queue for items that fail after retries
□ Timeout configured for the entire batch job
□ Rate limiting for external API calls within batch
□ Transaction boundaries per chunk (not entire batch)
□ Monitoring: track success/failure counts, duration
□ Bulk API endpoints have max item limits (prevent abuse)
□ File imports validate before inserting (don't insert partial bad data)
```
