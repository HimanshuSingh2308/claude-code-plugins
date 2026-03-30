---
name: ai-model-strategy
description: >
  Guide for selecting the right Claude model (Opus/Sonnet/Haiku) for each backend
  development task, and when to use Claude Batch API for cost-effective bulk processing.
  Applied automatically when spawning agents or processing multiple files.
trigger: >
  When spawning sub-agents for backend tasks, when processing multiple files/modules,
  when the user asks about cost optimization, or when running bulk audits/reviews.
---

# AI Model Strategy for Backend Development

## Model Selection Guide

### Claude Opus 4.6 — Deep Reasoning (use sparingly)

**Cost**: Highest | **Speed**: Slower | **Best for**: Decisions that can't be wrong

| Task | Why Opus |
|------|----------|
| API architecture design | Complex trade-offs, domain modeling |
| Migration planning | Data safety critical, irreversible |
| Security audit (critical paths) | Must catch every vulnerability |
| Schema design review | Normalization decisions, scaling implications |
| Complex debugging | Multi-file reasoning, race conditions |

**Rule**: Use Opus when the cost of a mistake > the cost of the model.

### Claude Sonnet 4.6 — Balanced (default for most tasks)

**Cost**: Medium | **Speed**: Fast | **Best for**: Pattern matching + code generation

| Task | Why Sonnet |
|------|-----------|
| Code review | Pattern recognition, checklist-style |
| Test generation | Boilerplate-heavy, follows patterns |
| DTO/entity scaffolding | Template-based generation |
| Documentation (Swagger) | Decorator addition, description writing |
| Refactoring suggestions | Code transformation patterns |
| Bulk file processing | Good enough quality, faster throughput |

**Rule**: Default to Sonnet unless the task requires deep architectural reasoning.

### Claude Haiku 4.5 — Fast & Cheap (use for simple tasks)

**Cost**: Lowest | **Speed**: Fastest | **Best for**: Simple extraction + classification

| Task | Why Haiku |
|------|----------|
| Extract entity names from files | Simple parsing |
| Classify file types (controller/service/dto) | Pattern matching |
| Generate simple boilerplate | Import statements, empty test files |
| Validate naming conventions | String pattern checks |
| Summarize a single file | Short text generation |

**Rule**: Use Haiku for tasks where you'd write a regex if AI didn't exist.

---

## Agent Model Assignments

| Agent | Model | Rationale |
|-------|-------|-----------|
| `api-designer` | **opus** | Architecture decisions, entity relationships, complex trade-offs |
| `api-reviewer` | **sonnet** | Pattern matching across 6 categories, checklist evaluation |
| `api-tester` | **sonnet** | Test generation is pattern-based, boilerplate-heavy |
| `migration-planner` | **opus** | Data safety critical, breaking change detection, rollback planning |

---

## Claude Batch API — 50% Cost Reduction

The [Claude Batch API](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing) processes requests asynchronously within 24 hours at **50% of the standard cost**.

### When to Use Batch API

| Scenario | Use Batch? | Why |
|----------|-----------|-----|
| CI/CD code review pipeline | ✅ Yes | Runs on every PR, not time-sensitive |
| Weekly full codebase audit | ✅ Yes | Scheduled, 50% savings |
| Generate tests for all 10 services | ✅ Yes | Not blocking developer, batch saves $$ |
| Bulk Swagger documentation | ✅ Yes | Apply decorators to all controllers |
| Interactive PR review | ❌ No | Developer waiting, needs real-time |
| Live debugging session | ❌ No | Immediate feedback required |
| Single file review | ❌ No | Too small for batch overhead |

### Batch API Pattern

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// 1. Prepare requests (one per file/module)
const requests = files.map((file, i) => ({
  custom_id: `review-${file.name}`,
  params: {
    model: 'claude-sonnet-4-20250514',  // Sonnet for batch reviews
    max_tokens: 4096,
    system: 'You are a NestJS code reviewer. Review this file for security, performance, and best practices.',
    messages: [{
      role: 'user',
      content: `Review this file:\n\n\`\`\`typescript\n${file.content}\n\`\`\``
    }]
  }
}));

// 2. Submit batch
const batch = await client.batches.create({ requests });
console.log(`Batch submitted: ${batch.id}`);
console.log(`Status: ${batch.processing_status}`);
console.log(`Requests: ${requests.length}`);

// 3. Poll for completion
let status = batch.processing_status;
while (status !== 'ended') {
  await new Promise(r => setTimeout(r, 60000)); // check every minute
  const updated = await client.batches.retrieve(batch.id);
  status = updated.processing_status;
  console.log(`Progress: ${updated.request_counts.succeeded}/${requests.length}`);
}

// 4. Retrieve results
const results = [];
for await (const result of client.batches.results(batch.id)) {
  results.push({
    file: result.custom_id,
    review: result.result.message.content[0].text,
    tokens: result.result.usage,
  });
}

// 5. Merge into unified report
const report = mergeReviews(results);
```

### Cost Comparison

| Task | Files | Real-time Cost | Batch Cost | Savings |
|------|-------|---------------|------------|---------|
| Full API review (8 controllers) | 8 | ~$0.40 | ~$0.20 | $0.20 |
| Generate tests (10 services) | 10 | ~$0.60 | ~$0.30 | $0.30 |
| Swagger doc generation (15 DTOs) | 15 | ~$0.30 | ~$0.15 | $0.15 |
| Weekly full audit (30 files) | 30 | ~$1.50 | ~$0.75 | $0.75 |
| Monthly codebase review (100 files) | 100 | ~$5.00 | ~$2.50 | $2.50 |

*Estimates based on Sonnet at ~$3/M input + $15/M output tokens, ~2K tokens per file review*

---

## Parallel Sub-Agent Pattern (Real-Time)

For interactive sessions where batch API is too slow, use parallel sub-agents:

```yaml
When reviewing 3+ modules interactively:
  1. Spawn N parallel agents using the Agent tool (one per module)
  2. Each agent uses model: sonnet
  3. Set run_in_background: true for all
  4. Collect results as agents complete
  5. Merge into unified report

Benefits:
  - 5x faster than sequential review
  - Each agent has focused context (one module)
  - Real-time results as each completes

Limits:
  - Max ~5 parallel agents (context window management)
  - Each agent has independent context (can't cross-reference)
  - Use the parent agent (opus) to merge and find cross-module issues
```

### Example: Review All Controllers

```
Parent (opus): "Review all 8 controllers. I'll spawn sub-agents."

  ├── Agent 1 (sonnet): Review achievements.controller.ts → Score: 22/30
  ├── Agent 2 (sonnet): Review auth.controller.ts → Score: 25/30
  ├── Agent 3 (sonnet): Review leaderboard.controller.ts → Score: 20/30
  ├── Agent 4 (sonnet): Review users.controller.ts → Score: 23/30
  └── ... (run in parallel via run_in_background: true)

Parent (opus): Merge results, identify cross-cutting issues
  → "3 controllers share the same auth pattern bug"
  → "Consistent missing: @ApiResponse on error codes"
  → Overall score: 22.5/30
```

---

## Decision Flowchart

```
Is the developer waiting for results?
├── YES → Use real-time (Agent tool)
│   ├── Is it 1-2 files? → Single agent (sonnet)
│   └── Is it 3+ files? → Parallel sub-agents (sonnet each)
│
└── NO → Is it scheduled/CI?
    ├── YES → Use Claude Batch API (50% cheaper)
    │   └── Model: sonnet (or haiku for simple extraction)
    └── NO → Use real-time, default sonnet
```
