---
description: Research, create, update, or review game PRDs using the product designer agent. Performs web research, competitive analysis, and grounds design decisions in real data.
argument-hint: <create|update|review> <game-concept-or-slug> [--competitors-only | --trends-only]
---

# Game Design (Product Designer)

Use the product designer agent to research and produce data-driven game PRDs.

**Arguments**: $ARGUMENTS

## Step 0: Game context

Load `game-context` first. WA-specific steps below are marked (WA only); skip them for standalone games.

## Parse Arguments

Determine the mode from the first argument:

| Mode | Trigger | Action |
|------|---------|--------|
| `create` | `/game-design create tower defense` | Research + create new PRD |
| `update` | `/game-design update tiny-tycoon` | Read existing PRD, research gaps, update |
| `review` | `/game-design review` (no slug = all) | Review existing PRDs for quality |
| `research` | `/game-design research idle games` | Pure research, no PRD output |
| (no mode) | `/game-design cricket blitz game` | Infer intent — default to `create` |

If `--competitors-only`: skip PRD creation, only return competitive analysis.
If `--trends-only`: skip PRD creation, only return market trend research.

## Execution

Resolve `game-context` first (for `research` mode with no game yet, state the intended platform or ask), then spawn the `product-designer` agent with the resolved `Context:` line so it does not re-ask:

```
{resolved Context: line from game-context}
Task: {mode} a game PRD
Concept/Slug: {parsed from arguments}
Project path: {current working directory}
Flags: {any --flags}

Instructions:
1. Check docs/ for existing PRDs
2. (WA only) Check apps/web-astro/src/data/games/ for shipped games. Standalone: check the game's own repo instead
3. Perform web research relevant to the concept
4. {Create new PRD / Update existing / Review all} per the mode
5. Save new/updated PRDs to docs/{game-slug}-prd.md
```

## Examples

```bash
# Create a new PRD with full research
/game-design create cricket blitz

# Update an existing PRD with fresh research
/game-design update tiny-tycoon

# Review all existing PRDs for completeness
/game-design review

# Just research competitors for a concept
/game-design research idle restaurant --competitors-only

# Quick trend scan
/game-design research puzzle games 2026 --trends-only
```
