---
description: Audit all game foundation skills (game-theory, game-balancing, level-design, economy-design, etc.) for quality, completeness, cross-referencing, and actual usage in the design/build pipeline. Suggests improvements and flags orphaned skills.
argument-hint: [--skill <name>] [--fix] [--verbose]
---

# Game Foundations Check

Audit the game mechanics foundation skills for quality, completeness, and integration into the design pipeline.

**Arguments**: $ARGUMENTS

## Overview

Foundation skills are the knowledge layer that informs game design (PRD phase) and game building (implementation phase). This command validates that:

1. Each foundation skill is **complete and current** — covers its domain thoroughly
2. Each foundation skill is **actually referenced** by a workflow skill or agent
3. Cross-references between skills are **consistent and bidirectional**
4. No foundation knowledge is **duplicated** across skills
5. Content follows the **established patterns** (actionable, example-driven, browser-game-focused)

## Foundation Skills Registry

These are the foundation skills that should exist and be integrated:

### Design Phase (referenced by `game-design-prd`)

| Skill | Domain | PRD Section It Informs |
|-------|--------|------------------------|
| `game-theory` | Player psychology, flow, motivation | Difficulty curves, reward systems, engagement hooks |
| `game-balancing` | Difficulty curves, scoring, progression | Number tuning, XP formulas, combo systems |
| `level-design` | Zones, camera, spatial layout | Game world design, environment progression |
| `economy-design` | Currency, pricing, sinks/faucets | Upgrade shop, economy section |
| `playtesting` | Testing methodology, feel/pacing | Fun Test Checklist, success metrics |

### Build Phase (referenced by `game-builder` agent via game-ui-library patterns)

| Skill | Domain | Implementation Area |
|-------|--------|---------------------|
| `sound-design` | Web Audio API, procedural SFX | Audio feedback, music loops |
| `animation-patterns` | CSS/JS animations, juice/polish | Transitions, particles, screen shake |
| `css-game-art` | CSS-only art, gradients, shadows | Characters, environments, UI elements |
| `performance-tuning` | 60fps, memory, load time | Game loop, canvas, DOM optimization |
| `mobile-game-ux` | Touch, gestures, responsive layout | Mobile-first UI, ergonomic controls |
| `game-accessibility` | WCAG, motor/cognitive/visual a11y | Reduced motion, contrast, touch targets |

### Post-Release Phase

| Skill | Domain | Lifecycle Stage |
|-------|--------|-----------------|
| `post-launch` | Iteration, analytics, A/B testing | After deployment, improvement cycles |

## Command Options

```
/game-foundations-check [options]

Options:
  --skill <name>       Audit a single skill (e.g., --skill game-theory)
  --fix                Suggest and apply fixes (requires confirmation)
  --verbose            Show full analysis per skill
  --coverage-only      Only check integration/usage — skip content audit
  --content-only       Only check content quality — skip integration audit
```

## Audit Workflow

### Phase 1: Skill Inventory

Read each foundation skill's SKILL.md and collect:
- Title, description, trigger conditions
- Section headings (coverage map)
- Line count and depth
- Code examples present? (yes/no)
- Checklists present? (yes/no)
- Last modified date

Present as a table:

```
| Skill | Sections | Lines | Examples | Checklists | Last Modified |
|-------|----------|-------|----------|------------|---------------|
```

### Phase 2: Content Quality Audit

For each foundation skill, evaluate:

#### Structure (score /5)
- [ ] Has clear intro explaining *when* to apply this knowledge
- [ ] Organized into scannable sections with headers
- [ ] Includes concrete examples (not just theory)
- [ ] Has a quick-reference checklist or decision table
- [ ] Ends with anti-patterns or "common mistakes" section

#### Relevance (score /5)
- [ ] Content is specific to **browser games** (not generic game dev)
- [ ] Examples use **vanilla JS/CSS** (matches Weekly Arcade stack)
- [ ] Patterns are **actionable** — can be copy-adapted into a game
- [ ] Numbers/formulas are **calibrated for casual web games** (not AAA)
- [ ] References current web APIs (Web Audio, CSS containment, etc.)

#### Completeness (score /5)
- [ ] Covers the core concepts of its domain
- [ ] No major subtopics missing (compare against domain checklist below)
- [ ] Doesn't duplicate content from other foundation skills
- [ ] Appropriate depth — detailed enough to be useful, not overwhelming

**Domain Checklists** (what each skill SHOULD cover):

| Skill | Must-Have Topics |
|-------|-----------------|
| `game-theory` | Flow state, cognitive load, intrinsic/extrinsic motivation, loss aversion, variable ratio rewards, peak-end rule, Bartle's types, decision fatigue |
| `game-balancing` | Linear/exponential/adaptive difficulty, scoring formulas, combo multipliers, XP curves, rubber-banding, difficulty spikes detection |
| `level-design` | Camera perspectives, zone progression, environmental storytelling, spatial pacing, screen transitions, scrolling patterns |
| `economy-design` | Single/dual currency, upgrade pricing formulas, faucet/sink balance, inflation prevention, "almost afford" psychology, revenue curves |
| `playtesting` | First-touch test, three-pass methodology, feel metrics, pacing evaluation, fun-killer identification, iteration prioritization |
| `sound-design` | AudioContext setup, oscillator patterns, ADSR envelopes, spatial audio, music loops, mobile audio unlock, volume control |
| `animation-patterns` | GPU-accelerated properties, easing functions, particle systems, screen shake, number pop, state transitions, reduced-motion |
| `css-game-art` | Character anatomy, environment tiles, gradient techniques, shadow layering, pseudo-element tricks, responsive scaling |
| `performance-tuning` | requestAnimationFrame loop, canvas vs DOM, object pooling, spatial hashing, throttling, memory profiling, load budgets |
| `mobile-game-ux` | Touch targets (44px+), gesture handling, viewport locking, right-hand ergonomics, orientation handling, safe areas |
| `game-accessibility` | Reduced motion, color-blind modes, font sizing, focus management, screen reader hints, cognitive load reduction, one-hand play |
| `post-launch` | Analytics setup, session metrics, drop-off analysis, A/B testing, patch cadence, player feedback loops |

### Phase 3: Integration Audit

Check that every foundation skill is actually wired into the pipeline:

#### 3a. PRD Integration
Read `game-design-prd/SKILL.md` → "Related Skills" section.
- List which foundation skills are referenced
- Flag any foundation skill NOT referenced that should be
- Check that the reference description accurately matches the skill's content

**Expected gaps to flag:**
- `sound-design` — not in PRD "Related Skills" but PRDs should consider audio design
- `animation-patterns` — not in PRD but PRDs should specify polish/juice expectations
- `game-accessibility` — not in PRD but accessibility should be designed in, not bolted on
- `mobile-game-ux` — not in PRD but mobile UX constraints should inform design
- `post-launch` — not in PRD but success metrics and iteration plans belong in design

#### 3b. Build Integration
Read `add-new-game/SKILL.md` (reference material) and `add-new-game/references/game-ui-library.md`.
- List which foundation skills' patterns are embedded
- Flag any build-phase skill not represented in the library

#### 3c. Audit Integration
Read `game-audit` command and agent definitions.
- List which agents consume which foundation skills
- Flag any foundation skill not used by any agent

#### 3d. Orphan Detection
A foundation skill is **orphaned** if it is:
- Not referenced by `game-design-prd` (design phase)
- Not embedded in `game-builder` agent or `add-new-game` reference patterns (build phase)
- Not consumed by any audit agent (quality phase)

Flag orphaned skills with severity:
- **Critical**: Skill exists but is never used anywhere
- **Warning**: Skill is used in only one phase (should be in at least two)

### Phase 4: Cross-Reference Consistency

Check for:
- Skills that reference each other but with inconsistent descriptions
- Overlapping content between skills (e.g., difficulty curves in both `game-theory` and `game-balancing`)
- Missing cross-references (e.g., `economy-design` should reference `game-balancing` for pricing curves)

### Phase 5: Report

Present a summary report:

```markdown
## Foundation Skills Health Report

### Overall Score: X/100

### Skill Scores

| Skill | Structure | Relevance | Completeness | Integration | Total | Status |
|-------|-----------|-----------|--------------|-------------|-------|--------|
| game-theory | 4/5 | 5/5 | 4/5 | Design+Audit | 13/15 | ✅ |
| post-launch | 3/5 | 3/5 | 2/5 | ⚠️ Weak | 8/15 | ⚠️ |

### Integration Map

| Skill | PRD Phase | Build Phase | Audit Phase | Coverage |
|-------|-----------|-------------|-------------|----------|
| game-theory | ✅ Referenced | — | ✅ QA agent | 2/3 |
| post-launch | ❌ Missing | — | ❌ Missing | 0/3 |

### Top Recommendations

1. **[Critical]** `post-launch` is orphaned — add to PRD "Related Skills" and create post-launch audit agent
2. **[High]** `game-accessibility` missing from PRD phase — accessibility should be designed in
3. **[Medium]** `game-theory` and `game-balancing` overlap on difficulty curves — clarify boundaries
```

### Phase 6: Fix Mode (--fix)

If `--fix` is specified, for each recommendation:

1. **Show the proposed change** (diff preview)
2. **Ask for confirmation** before applying
3. Apply changes to:
   - Foundation skill SKILL.md files (content improvements)
   - `game-design-prd` Related Skills section (add missing references)
   - `game-builder` agent and `add-new-game` references (add missing patterns)
   - Agent definitions (add missing knowledge references)

**Never auto-apply without confirmation. Show each change individually.**

## Usage Examples

### Full audit
```
/game-foundations-check
```
Runs all phases, produces the health report.

### Single skill deep-dive
```
/game-foundations-check --skill economy-design --verbose
```
Full audit of just economy-design with detailed findings.

### Check what's wired up
```
/game-foundations-check --coverage-only
```
Skip content audit, just show the integration map and orphan detection.

### Audit and fix
```
/game-foundations-check --fix
```
Run full audit then walk through fixes one by one with confirmation.
