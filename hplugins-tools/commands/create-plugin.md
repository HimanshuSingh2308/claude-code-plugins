---
description: Create a new Claude Code plugin with the standard Wiser structure, including scaffolding, marketplace registration, and optional commands/skills/agents
---

# Create Plugin

Create or update a Claude Code plugin with intelligent scaffolding, AI model optimization, batch processing support, and self-learning capabilities baked into every agent and skill.

## Trigger

Invoke when the user asks to:
- Create a new plugin / "new plugin"
- Update an existing plugin / "add a skill to X plugin"
- Scaffold a plugin structure
- Add commands, skills, or agents to a plugin
- "create-plugin", "/create-plugin"

## Workflow

### Step 1: Gather Plugin Requirements

Ask the user (skip questions they already answered):

1. **Plugin name** — kebab-case (e.g., `seo-toolkit`, `data-pipeline`)
2. **Description** — one-line purpose
3. **Category** — `productivity`, `utilities`, `development`, `testing`, `devops`, `design`, `other`
4. **Components to create**:
   - Commands (user-invocable `/slash-commands`)
   - Skills (background knowledge auto-applied by trigger)
   - Agents (autonomous sub-agents spawned via Agent tool)
5. **For each component**: name, description, and purpose

If the user provides a natural-language description (e.g., "I need a plugin that reviews Terraform plans"), extract the answers yourself and confirm with the user before proceeding.

### Step 2: Validate Plugin Location

```bash
PLUGIN_DIR=~/.claude/plugins/marketplaces/hplugins/{plugin-name}
```

- **New plugin**: Verify the directory does NOT already exist
- **Update existing plugin**: Read `$PLUGIN_DIR/.claude-plugin/plugin.json` to understand current state

### Step 3: Scaffold Plugin Structure

For a **new plugin**, create this structure:

```
{plugin-name}/
├── .claude-plugin/
│   └── plugin.json
├── commands/           # (if commands requested)
│   └── {cmd-name}.md
├── skills/             # (if skills requested)
│   └── {skill-name}/
│       ├── SKILL.md
│       └── references/ # (optional, for large reference material)
├── agents/             # (if agents requested)
│   └── {agent-name}.md
└── README.md
```

For an **existing plugin update**, only create the new components.

### Step 4: Create plugin.json

```json
{
  "name": "{plugin-name}",
  "description": "{description}",
  "version": "1.0.0",
  "author": {
    "name": "Himanshu Singh",
    "url": "https://github.com/HimanshuSingh2308"
  },
  "repository": "https://github.com/HimanshuSingh2308/claude-code-plugins",
  "license": "MIT",
  "keywords": ["{keyword1}", "{keyword2}", "..."]
}
```

If updating, bump the version per the versioning rules:
- **Patch** (x.x.+1): Bug fixes, typo corrections
- **Minor** (x.+1.0): New skills/commands/agents added
- **Major** (+1.0.0): Breaking changes, removed features

### Step 5: Create Commands

For each command, create `commands/{cmd-name}.md`:

```markdown
---
description: {one-line description shown in skill list}
---

# {Command Title}

{Full command prompt with workflow steps, input/output format, and error handling}
```

**Command writing rules**:
- Start with a clear `## Trigger` section listing when to invoke
- Use numbered `### Step N:` workflow steps
- Include `## Output Format` with example output
- Include `## Error Handling` section

### Step 6: Create Skills (with Self-Learning Pattern)

For each skill, create `skills/{skill-name}/SKILL.md`:

```markdown
---
name: {skill-name}
description: >
  {One-line description used to decide relevance — be specific}
trigger: >
  {When this skill should auto-activate — list file patterns, imports, keywords}
---

# {Skill Title}

{Skill content — patterns, best practices, reference material}

## Self-Learning Protocol

This skill improves over time. When applying this skill:

### Capture Phase
After completing any task using this skill:
1. **Record what worked** — patterns, approaches, or decisions that led to success
2. **Record what failed** — approaches that were rejected, caused errors, or needed revision
3. **Record user corrections** — any feedback the user gave that adjusted the approach

### Adapt Phase
Before applying this skill in future tasks:
1. **Check memory** — look for feedback memories related to this skill's domain
2. **Prioritize recent corrections** — newer feedback overrides older patterns
3. **Apply learned preferences** — use the user's confirmed patterns over defaults

### Evolve Phase
When patterns stabilize (3+ consistent corrections in the same direction):
1. **Propose a skill update** — suggest updating this SKILL.md with the learned pattern
2. **Only update on user approval** — never silently modify skill files
3. **Version the change** — bump the plugin patch version
```

### Step 7: Create Agents (with AI Model Optimization + Self-Learning)

For each agent, create `agents/{agent-name}.md`:

```markdown
---
name: {agent-name}
description: {one-line description for agent selection}
model: {opus|sonnet|haiku}
---

# {Agent Title}

{Agent instructions — role, workflow, output format}
```

**Model selection rules** (apply automatically):

| Task Complexity | Model | When to Use |
|----------------|-------|-------------|
| Architecture, security, irreversible decisions | **opus** | Cost of mistake > cost of model |
| Code generation, reviews, pattern matching | **sonnet** | Default for most tasks |
| Simple extraction, classification, boilerplate | **haiku** | Tasks you'd solve with regex if AI didn't exist |

**Agent writing rules**:
- Give the agent a clear role in the first sentence
- Define a step-by-step `## Workflow` section
- Define `## Output Format` with concrete examples
- Include `## Error Handling` for failure modes
- Add the Self-Learning Protocol (same as skills above)
- Add the Batch Processing Awareness section (below)

**Batch Processing Awareness** — embed in every agent:

```markdown
## Batch Processing Awareness

When this agent is invoked on 3+ targets (files, modules, resources):

### Real-Time Path (developer is waiting)
- Process targets in parallel using multiple Agent tool calls with `run_in_background: true`
- Each sub-agent uses model: **sonnet** (or **haiku** for simple extraction)
- Merge results in the parent agent

### Batch Path (CI/CD, scheduled, not time-sensitive)
- Recommend Claude Batch API for 50% cost reduction
- Provide the batch request format:
  ```typescript
  const requests = targets.map((target, i) => ({
    custom_id: `{agent-name}-${target.id}`,
    params: {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: '{agent system prompt}',
      messages: [{ role: 'user', content: target.content }]
    }
  }));
  ```
- Advise: "This is not time-sensitive — use `client.batches.create({ requests })` for 50% savings"
```

### Step 8: Register in Marketplace

Read the marketplace catalog:
```bash
cat ~/.claude/plugins/marketplaces/hplugins/.claude-plugin/marketplace.json
```

**For new plugins**: Add the plugin entry to the `plugins` array.
**For existing plugins**: No marketplace change needed (just version bump in plugin.json).

If adding a new plugin, also bump the marketplace `metadata.version` minor.

### Step 9: Update Project Knowledge Cache

Read the current knowledge file:
```
~/.claude/projects/-Users-hsingh1-.claude-plugins-marketplaces-hplugins/memory/project_knowledge.md
```

Update it to reflect the new/updated plugin:
- Add/update the plugin in the Plugins table
- Add new skills, commands, or agents to the relevant section
- Update version numbers

### Step 10: Verify & Present Summary

Run verification:
```bash
# Check all files were created
ls -R ~/.claude/plugins/marketplaces/hplugins/{plugin-name}/

# Validate plugin.json is valid JSON
cat ~/.claude/plugins/marketplaces/hplugins/{plugin-name}/.claude-plugin/plugin.json | python3 -m json.tool

# Check marketplace.json is valid JSON (if modified)
cat ~/.claude/plugins/marketplaces/hplugins/.claude-plugin/marketplace.json | python3 -m json.tool
```

Present the result:

```
## Plugin Created: {plugin-name} v{version}

**Path**: ~/.claude/plugins/marketplaces/hplugins/{plugin-name}
**Category**: {category}

### Components Created

| Type | Name | Description |
|------|------|-------------|
| Command | /cmd-name | ... |
| Skill | skill-name | ... |
| Agent | agent-name (model) | ... |

### Built-in Intelligence

- **AI Model Optimization** — agents auto-select opus/sonnet/haiku based on task complexity
- **Batch Processing** — agents recommend Batch API for bulk operations (50% cost savings)
- **Self-Learning** — skills and agents capture feedback and evolve over time

### Next Steps
- Test with: `/{command-name}`
- Commit changes: `git add . && git commit -m "feat({plugin-name}): initial scaffold v1.0.0"`
```

## Error Handling

- **Plugin name conflict**: If directory exists and user said "create" (not "update"), warn and ask
- **Invalid plugin.json**: Validate JSON before writing; fix syntax errors
- **Missing marketplace.json**: Create it with default structure
- **Permission errors**: Suggest `chmod` fix

## AI Model Optimization Reference

When creating agents, always assign the right model:

### Opus (deep reasoning, expensive)
- Architecture design, migration planning, security audits
- Complex multi-file debugging, schema design
- Rule: use when cost of mistake > cost of model

### Sonnet (balanced, default)
- Code review, test generation, scaffolding, documentation
- Bulk file processing, refactoring suggestions
- Rule: default unless task needs deep reasoning

### Haiku (fast, cheap)
- Extract names/types, classify files, simple boilerplate
- Validate naming conventions, summarize single files
- Rule: use for tasks you'd solve with regex otherwise

### Batch API (50% cost reduction)
- Use for CI/CD pipelines, scheduled audits, bulk generation
- NOT for interactive sessions where developer is waiting
- Pattern: `client.batches.create({ requests })` — results within 24h
