---
name: multiplayer-architecture
description: >
  Multiplayer game architecture patterns for browser games. Covers session management,
  matchmaking, real-time state sync, turn-based and real-time modes, disconnect handling,
  lobby systems, and the GameLogic interface pattern. Applied when designing or building
  any multiplayer browser game. For WebSocket implementation details, see websocket-realtime.
  For testing multiplayer games, see multiplayer-testing.
---

# Multiplayer Architecture for Browser Games

## Architecture Overview

Weekly Arcade uses a **two-service architecture** for multiplayer:

```
Browser                          Backend
┌──────────┐   WebSocket    ┌──────────────┐
│  Game JS  │◄────────────►│  Realtime     │  (Socket.IO, persistent)
│           │               │  Service      │  — moves, state sync, presence
│           │   REST HTTP   ├──────────────┤
│           │◄────────────►│  API Service  │  (NestJS on Cloud Run)
└──────────┘               │              │  — sessions, matchmaking, invitations
                            └──────┬───────┘
                                   │
                            ┌──────▼───────┐
                            │  Firestore   │
                            └──────────────┘
```

**Why two services:**
- Cloud Run doesn't support persistent WebSocket connections (30-min timeout)
- REST handles session CRUD, matchmaking, invitations (stateless, auto-scales)
- Realtime handles live game state, moves, presence (stateful, persistent connections)

## Core Concepts

### Server-Authoritative Model

All game state lives on the server. Clients never write state directly.

```
Player Action → WebSocket emit → Server validates → Server updates state
                                                   → Server broadcasts to all
                                                   → Async persist to Firestore
```

**Why:** Prevents cheating. Clients can lie about their state. The server is the single source of truth.

### The GameLogic Interface

Every multiplayer game implements this interface on the server:

```typescript
interface MultiplayerGameLogic {
  readonly gameId: string;
  createInitialState(players: string[], config: Record<string, unknown>): Record<string, unknown>;
  applyMove(state, uid, moveType, moveData): Record<string, unknown>; // Throw on invalid
  checkGameOver(state): GameResult | null;
  getNextTurn(state): string | null; // null = real-time (simultaneous)
}
```

**Rules for `applyMove()`:**
1. Throw on invalid moves — the infra catches and sends `game:move-rejected`
2. Return a NEW state object — don't mutate input
3. Keep it fast (<10ms) — runs in-memory on every move
4. Validate everything server-side — check turn order, move legality, bounds

### In-Memory State (Rune Pattern)

Game state is held in a `Map<sessionId, GameState>` in memory during active play. Firestore writes are batched (every 500ms or 5 moves). This keeps move latency at ~1ms for validation.

**Crash recovery:** If the server restarts, last persisted state loads from Firestore on first reconnect. Max loss: 500ms of moves.

## Game Modes

### Turn-Based Games

```typescript
// getNextTurn() returns the UID of the active player
getNextTurn(state): string {
  const players = state.players as string[];
  return players[state.currentPlayerIndex as number];
}

// applyMove() validates turn order
applyMove(state, uid, moveType, moveData) {
  if (this.getNextTurn(state) !== uid) throw new Error('Not your turn');
  // ... apply move, advance turn index
}
```

**Server handles:**
- Turn timeout (default 30s, configurable per game)
- Auto-skip on timeout
- Turn indicator broadcast

**Examples:** Chess, Tic-Tac-Toe, card games

### Real-Time Games

```typescript
// getNextTurn() returns null — all players act simultaneously
getNextTurn(state): null { return null; }

// applyMove() validates move legality only, not turn order
applyMove(state, uid, moveType, moveData) {
  // No turn check — any player can move anytime
  // Validate move is legal for this player
}
```

**Client uses prediction:**
```javascript
multiplayerClient.predictMove('move', data, (currentState, moveData) => {
  return applyMoveLocally(currentState, moveData); // Instant feedback
});
// Server state arrives via game:state → overwrites prediction
```

**Examples:** Racing, real-time puzzle, Snake vs Snake

## Session Lifecycle

```
[Waiting] → [Starting] → [Playing] → [Finished]
    │          (3s)                        │
    └→ [Abandoned]       (all leave) ─────┘
```

### States

| State | Description | Transitions |
|-------|-------------|-------------|
| `waiting` | Lobby open, players joining | → starting (host starts), → abandoned (5 min idle) |
| `starting` | 3-second countdown | → playing |
| `playing` | Game active | → finished (game over / forfeit / timeout) |
| `finished` | Results recorded | → archived (24h cleanup) |
| `abandoned` | No activity | Auto-cleaned by cron |

### Host Concept

Session creator is the host. Privileges:
- Start the game (when minPlayers met)
- Kick players from lobby
- Change game config before starting

If host disconnects permanently, earliest-joined player auto-becomes host.

## Matchmaking

### Quick Match (Queue-Based)

1. Player enters queue with ELO rating ±100 window
2. Cron scans every 5s for compatible pairs
3. Window widens ±50 every 10s (up to ±500)
4. After 60s, match with anyone
5. After 120s, expire

### Private Lobbies

Host creates session → gets 6-char join code → shares with friends.
Players join via code or deep link (`?join=CODE`).

### ELO Rating

```
E = 1 / (1 + 10^((opponentRating - myRating) / 400))
newRating = rating + 32 * (actual - E)
```

Starting: 1000. Floor: 100. K-factor: 32.
N-player: average pairwise changes.

## Disconnect/Reconnect

| Event | Detection | Action |
|-------|-----------|--------|
| Player disconnects | Socket.IO detects (45s ping timeout) | Mark `disconnected`, broadcast to room |
| Player reconnects | Socket.IO auto-reconnect | Rejoin room, send current state, mark `connected` |
| Reconnect window expires | 2 min timer | Remove from session, host migrates if needed |
| All players leave | Room empty check | Schedule 5-min eviction from memory |

## MultiplayerConfig in Game Registry

```typescript
// In game-registry.ts — add to your game entry
multiplayer: {
  enabled: true,
  minPlayers: 2,
  maxPlayers: 4,
  mode: 'turn-based',      // or 'real-time'
  turnTimeoutSec: 30,      // turn-based only
  sessionTimeoutMin: 30,
  spectatorAllowed: true,
}
```

## Anti-Cheat (Level 2)

1. **Server-authoritative** — clients can't write state
2. **Timing validation** — moves faster than 200ms rejected
3. **Turn enforcement** — wrong-turn moves rejected server-side
4. **Full audit log** — every move stored in Firestore
5. **IP duplicate detection** — flag same-IP players in one session
6. **AFK auto-forfeit** — 3 skipped turns or 30s idle
7. **Rating manipulation** — detect win-trading, intentional losing
8. **Account age gate** — new accounts blocked from ranked (1hr)

## Decision Framework

| Question | Turn-Based | Real-Time |
|----------|-----------|-----------|
| Players act... | One at a time | Simultaneously |
| Latency tolerance | High (100-300ms fine) | Low (need <50ms feel) |
| Need prediction? | No | Yes |
| `getNextTurn()` returns | Player UID | `null` |
| Server tick rate | On-demand (per move) | Fixed (e.g., 10-60Hz) |
| Examples | Chess, cards, board games | Racing, Snake, real-time puzzle |

## File Locations

| Component | Path |
|-----------|------|
| Shared types | `packages/shared/src/lib/types/multiplayer.types.ts` |
| GameLogic interface | `packages/shared/src/lib/interfaces/game-logic.interface.ts` |
| Game registry | `packages/shared/src/lib/constants/game-registry.ts` |
| Realtime service | `apps/realtime/src/` |
| Game logic implementations | `apps/realtime/src/game/game-logic/` |
| API multiplayer module | `apps/api/src/multiplayer/` |
| Frontend client | `apps/web-astro/public/js/multiplayer-client.js` |
| Frontend UI | `apps/web-astro/public/js/multiplayer-ui.js` |
| Integration guide | `docs/MULTIPLAYER_GUIDE.md` |
