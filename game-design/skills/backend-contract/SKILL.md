# Backend Contract — API Rules for Game Development

Applied automatically when building games, submitting scores, awarding coins, or unlocking achievements. All game-building agents MUST follow these rules.

---

## Score Submission Contract

Games submit scores via `window.gameCloud.submitOrQueue(gameId, scoreData)`.

### Allowed top-level fields:
```javascript
{
  score: number,         // REQUIRED
  guessCount?: number,   // Optional
  level?: number,        // Optional
  timeMs?: number,       // Optional — REQUIRED if game has minTimeMs validation
  wordHash?: string,     // Optional — word games only
  metadata?: {           // Optional — game-specific data
    // ONLY keys declared in allowedMetadataKeys for this game
  }
}
```

### Metadata Key Validation (CRITICAL)

The backend validates ALL metadata keys against a per-game allowlist in `apps/api/src/leaderboard/config/game-config.ts`.

**If a game sends a metadata key NOT in its `allowedMetadataKeys`, the score submission is REJECTED.**

Common keys allowed for ALL games: `perfectGame`, `streakBonus`

**When building a new game:**
1. Decide which metadata keys the game will send
2. Add them to the game's config in `game-config.ts`:
   ```typescript
   'my-game': {
     maxScore: 50000,
     maxScorePerSecond: 200,
     minTimeMs: 10000,
     allowedMetadataKeys: ['myKey1', 'myKey2'],  // ← MUST declare all keys
   }
   ```
3. Only send those declared keys in the game's `submitScore()` call

**Common mistake:** Adding useful tracking data to metadata without declaring it in game-config.ts. The score will be rejected silently.

---

## Coin System (Server-Side Only)

**Coins are awarded automatically by the server during score submission.**

Formula: `Math.min(50, Math.floor(score / 100))` coins per submission.

### Rules:
- **NEVER call `window.apiClient.addCoins()`** — this endpoint has been removed
- **NEVER implement client-side coin awarding** — it was removed to prevent injection
- Games CAN show coin popup animations locally for UX feel, but the actual balance is managed server-side
- The `addCoins()` method in api-client.js is a deprecated no-op

### If a game needs custom coin rewards:
Encode the reward logic in the server's `leaderboard.service.ts`, not in the game client.

---

## Achievement Contract

Games unlock achievements via `window.gameCloud.unlockAchievement(achievementId, gameId)`.

### Rules:
- Every achievement ID MUST exist in `packages/shared/src/lib/constants/achievements.ts`
- If the ID doesn't exist, the backend returns `400 Bad Request: Unknown achievement`
- Achievement IDs follow the pattern: `{gameSlug}_{achievement_name}` (e.g., `voidbreak_wave_10`)

### When building a new game:
1. Define achievements in `packages/shared/src/lib/constants/achievements.ts`
2. Add the `AchievementCategory` type if creating a new category
3. Only THEN reference those IDs in the game client code

**Common mistake:** Referencing achievement IDs in game code before adding them to the registry. The unlock call fails silently.

---

## Leaderboard Architecture

Leaderboards use a **Firestore subcollection model**:

```
leaderboards/{gameId}_{period}_{dateKey}/entries/{userId}
  └── { odId, score, updatedAt }
```

- Each user gets their own entry document — no write contention
- Display names are resolved from user profiles at read time (always fresh)
- Rank is computed via `count(score > userScore) + 1` — works for ALL users, not just top 100
- 4 periods: daily, weekly, monthly, allTime

### Rules:
- Games do NOT need to interact with leaderboard storage directly
- `submitScore()` handles all leaderboard updates automatically
- Display name changes propagate immediately (no stale data)

---

## Game Config Requirements

Every new game MUST have an entry in `apps/api/src/leaderboard/config/game-config.ts`:

```typescript
'game-slug': {
  maxScore: number,           // Theoretical maximum score
  maxScorePerSecond: number,  // Prevents instant high scores
  minTimeMs: number,          // Minimum game duration
  maxLevel?: number,          // Level cap (if applicable)
  maxGuessCount?: number,     // Guess limit (if applicable)
  allowedMetadataKeys: [],    // MUST list all metadata keys the game sends
  customValidation?: (dto) => ValidationResult,  // Game-specific rules
}
```

**If a game is not in this config, it falls back to very strict defaults (10K max score, 5s min time).**

---

## Quick Checklist for New Games

- [ ] Game config added to `game-config.ts` with `allowedMetadataKeys`
- [ ] All achievement IDs registered in `packages/shared/src/lib/constants/achievements.ts`
- [ ] Game registered in `packages/shared/src/lib/constants/game-registry.ts`
- [ ] Score submission uses only declared metadata keys
- [ ] No `addCoins()` calls anywhere in game code
- [ ] `timeMs` is sent if the game config has `minTimeMs > 0`
- [ ] Achievement IDs follow pattern: `{gameSlug}_{name}`
