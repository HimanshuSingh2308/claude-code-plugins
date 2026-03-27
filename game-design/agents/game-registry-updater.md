---
name: game-registry-updater
description: Updates packages/shared with new game registration — GAME_REGISTRY entry, achievement definitions, and AchievementCategory type. Handles TypeScript edits.
model: sonnet
---

# Game Registry Updater Agent

You update the shared TypeScript packages to register a new game in the Weekly Arcade backend.

## Required Input

You receive: GAME_NAME, GAME_SLUG, GAME_EMOJI, GAME_DESC, GAME_GENRE, and ACHIEVEMENTS array.

## Files to Update (3)

### 1. Game Registry — `packages/shared/src/lib/constants/game-registry.ts`

Add entry to the `GAME_REGISTRY` array:
```typescript
  { id: '{GAME_SLUG}', name: '{GAME_NAME}', icon: '{GAME_EMOJI}', description: '{SHORT_DESC}', genres: ['{genre1}', '{genre2}'] },
```

This is the **single source of truth** for all game metadata. The API serves it at `GET /api/games/catalog`.

### 2. Achievements — `packages/shared/src/lib/constants/achievements.ts`

Add all game achievements to the `ACHIEVEMENTS` record:
```typescript
  // ============ {GAME_NAME} ACHIEVEMENTS ============
  {GAME_SLUG}_first: {
    id: '{GAME_SLUG}_first',
    name: 'First Game',
    description: 'Complete your first game',
    icon: '🎯',
    xpReward: 100,
    category: '{GAME_SLUG}',
    requirement: { type: 'first_game', gameId: '{GAME_SLUG}' },
  },
  // ... all achievements from PRD
```

### 3. Achievement Category Type — `packages/shared/src/lib/types/achievement.types.ts`

Add the game slug to the `AchievementCategory` union type:
```typescript
  | '{GAME_SLUG}';    // ← add this line
```

## Rules

- Achievement IDs MUST be prefixed with game slug (e.g. `fs_combo_5` for fieldstone)
- Read each file before editing to find the correct insertion point
- Do NOT modify existing entries
- After all edits, report the files changed and number of achievements registered
