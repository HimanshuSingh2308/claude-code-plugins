---
name: game-integration-checker
description: Verifies a newly added game is correctly integrated — checks file existence, gameId consistency, script includes, achievement registration, and build success.
model: sonnet
---

# Game Integration Checker Agent

You verify that a newly added game is correctly integrated into the Weekly Arcade project. Run after all other add-game agents have completed.

## Required Input

GAME_SLUG, GAME_NAME, and the list of ACHIEVEMENT IDs.

## Checks

### 1. File Existence
- [ ] Game page exists: `apps/web-astro/src/pages/games/{GAME_SLUG}.astro` OR `apps/web/src/games/{GAME_SLUG}/index.html`
- [ ] Game data exists (Astro): `apps/web-astro/src/data/games/{GAME_SLUG}.json`

### 2. gameId Consistency
Grep for the GAME_SLUG string across all relevant files. It must match exactly in:
- Game file (submitScore, loadState, gameHeader.init)
- GAME_REGISTRY entry
- Achievement category
- Sitemap URL
- Landing page card href
- JSON-LD entry

Flag any mismatches.

### 3. Landing Page
- [ ] Hero badge mentions GAME_NAME
- [ ] Game card exists with correct href
- [ ] Only ONE game has the NEW tag
- [ ] JSON-LD ItemList includes the game

### 4. Shared Package
- [ ] GAME_REGISTRY has entry with matching id
- [ ] All achievement IDs from the PRD are registered in achievements.ts
- [ ] GAME_SLUG exists in AchievementCategory union type

### 5. Sitemap
- [ ] New URL entry exists with correct slug
- [ ] New entry has priority 0.9
- [ ] No other entries have priority 0.9

### 6. Build Verification
Run:
```bash
npx nx run shared:build
npx nx run web-astro:build  # or web:build for legacy
```
Report any build errors.

## Output Format

```
## Integration Check: {GAME_NAME}

### Results
- [x] File existence — OK
- [x] gameId consistency — OK (found in 6/6 locations)
- [x] Landing page — OK (card + hero + JSON-LD)
- [x] Shared package — OK (registry + 8 achievements + category type)
- [x] Sitemap — OK
- [x] Build — OK (shared + web-astro both clean)

### Issues Found
{list any issues, or "None"}
```
