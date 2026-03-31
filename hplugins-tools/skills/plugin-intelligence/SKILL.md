---
name: plugin-intelligence
description: >
  Background knowledge for building intelligent Claude Code plugins — AI model optimization
  (Opus/Sonnet/Haiku selection), Claude Batch API patterns for cost-effective bulk processing,
  and self-learning protocols that let agents and skills evolve from user feedback over time.
  Applied automatically when creating, updating, or scaffolding plugins via /create-plugin.
trigger: >
  When creating or updating plugins, when scaffolding agents or skills, when the user asks
  about AI model selection, batch processing for agents, or self-learning capabilities.
  Also triggers on: /create-plugin, "new plugin", "add agent", "add skill", "plugin scaffold".
---

# Plugin Intelligence Framework

Background knowledge that makes every plugin, agent, and skill created by `/create-plugin` intelligent by default. Three pillars: **Model Optimization**, **Batch Processing**, and **Self-Learning**.

---

## Pillar 1: AI Model Optimization

Every agent created under a plugin must declare a `model` in its frontmatter. Use the decision matrix below to assign the correct model.

### Decision Matrix

```
Is the task safety-critical or architecturally complex?
├── YES → opus
│   Examples: migration planning, security audit, API architecture,
│             schema design, complex multi-file debugging
│   Rule: cost of mistake > cost of model
│
├── MAYBE → sonnet (default)
│   Examples: code review, test generation, scaffolding, documentation,
│             refactoring, bulk file processing, pattern matching
│   Rule: default unless deep reasoning is clearly needed
│
└── NO, it's simple extraction/classification → haiku
    Examples: extract names, classify file types, simple boilerplate,
              validate naming, summarize a single file
    Rule: would you solve this with regex if AI didn't exist?
```

### Model Properties

| Property | Opus 4.6 | Sonnet 4.6 | Haiku 4.5 |
|----------|----------|------------|-----------|
| Cost | Highest | Medium | Lowest |
| Speed | Slower | Fast | Fastest |
| Reasoning | Deep, multi-step | Good pattern matching | Simple extraction |
| Context | 1M tokens | 1M tokens | 200K tokens |
| Best for | Decisions that can't be wrong | Code gen + reviews | Classification + boilerplate |

### Multi-Agent Model Strategy

When an agent orchestrates sub-agents:

```
Orchestrator (opus or sonnet)
├── Heavy reasoning sub-task → spawn with model: opus
├── Code generation sub-task → spawn with model: sonnet
├── Simple extraction sub-task → spawn with model: haiku
└── Merge results in orchestrator
```

**Rule**: The orchestrator should be at least as capable as its most complex sub-task. Use sonnet orchestrators for routine workflows, opus for workflows with architectural decisions.

---

## Pillar 2: Batch Processing Awareness

The Claude Batch API processes requests asynchronously within 24 hours at **50% of standard cost**. Every agent that may process multiple targets should be batch-aware.

### When to Recommend Batch vs Real-Time

| Signal | Path | Reason |
|--------|------|--------|
| Developer is waiting, interactive session | Real-time (parallel agents) | Latency matters |
| CI/CD pipeline, automated trigger | Batch API | Not time-sensitive, 50% savings |
| Scheduled audit (weekly, monthly) | Batch API | Planned, cost-sensitive |
| 1-2 targets | Real-time, single agent | Batch overhead not worth it |
| 3+ targets, developer waiting | Real-time, parallel agents | Fast + concurrent |
| 3+ targets, not time-sensitive | Batch API | Maximum savings |

### Batch API Template

Embed this pattern in agents that process multiple targets:

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// 1. Build requests (one per target)
const requests = targets.map((target) => ({
  custom_id: `${agentName}-${target.id}`,
  params: {
    model: 'claude-sonnet-4-20250514', // or haiku for simple tasks
    max_tokens: 4096,
    system: 'System prompt for this agent...',
    messages: [{
      role: 'user',
      content: `Process this target:\n\n${target.content}`
    }]
  }
}));

// 2. Submit batch
const batch = await client.batches.create({ requests });

// 3. Poll for completion
let status = batch.processing_status;
while (status !== 'ended') {
  await new Promise(r => setTimeout(r, 60000));
  const updated = await client.batches.retrieve(batch.id);
  status = updated.processing_status;
}

// 4. Collect results
const results = [];
for await (const result of client.batches.results(batch.id)) {
  results.push({
    id: result.custom_id,
    output: result.result.message.content[0].text,
    tokens: result.result.usage,
  });
}
```

### Cost Estimation

```
Per-file cost (Sonnet, ~2K input + ~1K output tokens):
  Real-time: ~$0.02/file
  Batch:     ~$0.01/file (50% savings)

Breakeven: Batch overhead is ~30 seconds setup. Worth it at 5+ files.
```

### Parallel Real-Time Pattern

When batch is not suitable (developer waiting), use parallel sub-agents:

```yaml
Strategy:
  1. Spawn N agents via Agent tool (one per target)
  2. Set run_in_background: true for all
  3. Each agent uses model: sonnet (or haiku)
  4. Collect results as agents complete
  5. Parent merges into unified report

Limits:
  - Max ~5 parallel agents recommended
  - Each has independent context
  - Parent (opus/sonnet) handles cross-cutting analysis
```

---

## Pillar 3: Self-Learning Protocol

Every skill and agent created by `/create-plugin` includes a self-learning protocol that allows it to improve over time based on user feedback.

### How Self-Learning Works

```
                  ┌─────────────────┐
                  │   Task Begins    │
                  └────────┬────────┘
                           │
                  ┌────────▼────────┐
                  │  Check Memory    │◄── Look for feedback memories
                  │  for this domain │    related to this skill/agent
                  └────────┬────────┘
                           │
                  ┌────────▼────────┐
                  │  Apply Learned   │◄── Prioritize recent corrections
                  │  Preferences     │    over default patterns
                  └────────┬────────┘
                           │
                  ┌────────▼────────┐
                  │  Execute Task    │
                  └────────┬────────┘
                           │
                  ┌────────▼────────┐
                  │  Capture Results │◄── What worked, what failed,
                  │  & Feedback      │    what user corrected
                  └────────┬────────┘
                           │
                  ┌────────▼────────┐
                  │  Save to Memory  │◄── feedback-type memory with
                  │  (if non-obvious)│    Why + How to apply
                  └────────┬────────┘
                           │
              ┌────────────▼────────────┐
              │  Pattern Stabilized?     │
              │  (3+ same corrections)   │
              └────────────┬────────────┘
                     YES   │   NO
              ┌────────────▼──┐  │
              │ Propose Skill  │  └── Continue learning
              │ File Update    │
              └───────────────┘
```

### Self-Learning Template for Skills

Add this section to every skill created:

```markdown
## Self-Learning Protocol

This skill improves over time through user feedback.

### Capture Phase
After completing any task using this skill:
1. **Record what worked** — patterns, approaches, or decisions that succeeded
2. **Record what failed** — approaches rejected, caused errors, or needed revision
3. **Record user corrections** — any feedback that adjusted the approach
4. Save non-obvious learnings as `feedback`-type memories with:
   - The rule itself
   - **Why**: the reason (user's words or observed outcome)
   - **How to apply**: when/where this guidance kicks in

### Adapt Phase
Before applying this skill in future tasks:
1. **Check memory** — search for feedback memories in this skill's domain
2. **Prioritize recent corrections** — newer feedback overrides older patterns
3. **Apply learned preferences** — use confirmed patterns over defaults
4. **Flag conflicts** — if memory contradicts current code state, verify before acting

### Evolve Phase
When patterns stabilize (3+ consistent corrections in the same direction):
1. **Propose a skill update** — suggest concrete edits to this SKILL.md
2. **Only update on user approval** — never silently modify skill files
3. **Version the change** — bump the plugin patch version
4. **Log the evolution** — note what changed and why in the commit message
```

### Self-Learning Template for Agents

Add this section to every agent created:

```markdown
## Self-Learning Protocol

This agent learns from feedback to improve future runs.

### Before Each Run
1. Check memory for feedback related to this agent's domain
2. Adjust approach based on learned preferences:
   - If user previously rejected an approach, avoid it
   - If user confirmed a non-obvious approach, prefer it
3. Note any project-specific conventions from memory

### After Each Run
1. If the user corrects the output, save a feedback memory:
   - Rule: what to do differently
   - Why: user's reason or observed failure
   - How to apply: in which situations
2. If the user confirms a non-obvious choice, save it too
3. Do NOT save: obvious patterns, code conventions derivable from the codebase

### Evolution Trigger
After 3+ feedback entries point in the same direction:
- Propose updating this agent's instructions
- Show the diff to the user for approval
- Bump plugin version on approval
```

### What Self-Learning Does NOT Do

- Never silently modifies skill or agent files
- Never overrides explicit user instructions with learned patterns
- Never saves code patterns or architecture (derivable from code)
- Never saves ephemeral task state (use tasks for that)
- Always verifies memory against current state before applying

---

## Putting It All Together

When `/create-plugin` scaffolds a new plugin, every component gets:

| Component | Model Optimization | Batch Awareness | Self-Learning |
|-----------|-------------------|-----------------|---------------|
| Command | N/A (commands are prompts) | Recommend batch for bulk ops | N/A |
| Skill | Advises model selection for related agents | Includes batch template if applicable | Full self-learning protocol |
| Agent | `model:` frontmatter assigned by decision matrix | Batch-aware section if multi-target | Full self-learning protocol |

This ensures plugins are intelligent from day one and get smarter with use.
