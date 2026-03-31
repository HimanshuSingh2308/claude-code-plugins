---
name: multiplayer-testing
description: >
  Testing patterns for multiplayer browser games. Covers multi-tab local testing,
  WebSocket debugging, network simulation, disconnect/reconnect testing, matchmaking
  verification, anti-cheat validation, and concurrent player stress testing. Applied
  when QA testing any multiplayer game. For architecture patterns, see multiplayer-architecture.
---

# Multiplayer Testing Guide

## Local Testing Setup

### Two-Tab Testing (Most Common)

1. Start all three services:
   ```bash
   npx nx run api:serve          # Port 8080
   npx nx run realtime:serve     # Port 3001
   npx nx run web-astro:dev      # Port 4201
   ```

2. Open two browser tabs to the game page
3. Sign in with different accounts (or use incognito for second tab)
4. Tab 1: Create private session → copy join code
5. Tab 2: Join with code
6. Tab 1: Start game
7. Play moves in both tabs, verify state syncs

### WebSocket Debugging

**Chrome DevTools → Network → WS tab:**
- Filter by `socket.io`
- See all emitted and received events
- Inspect payloads (`game:state`, `game:move`, etc.)
- Check ping/pong heartbeats

**Console logging:**
```javascript
// Temporarily add to game.js for debugging
window.multiplayerClient.on('game:state', (d) => console.log('STATE', d));
window.multiplayerClient.on('game:move-rejected', (d) => console.warn('REJECTED', d));
window.multiplayerClient.on('error', (d) => console.error('ERROR', d));
```

## Test Checklist

### Session Lifecycle

- [ ] Create session → verify Firestore doc created
- [ ] Join session → verify player added, count incremented
- [ ] Join by code → verify code lookup works
- [ ] Leave session → verify player marked `left`, count decremented
- [ ] Host leaves → verify host migrates to next player
- [ ] All players leave → verify session marked `abandoned`
- [ ] Start game → verify 3s countdown → status `playing`
- [ ] Start with insufficient players → verify error
- [ ] Non-host tries to start → verify forbidden error
- [ ] Max players reached → verify join rejected

### Move Validation

- [ ] Valid move → state updates, broadcast to all players
- [ ] Invalid move (wrong turn) → `game:move-rejected` sent
- [ ] Invalid move (illegal) → `game:move-rejected` sent
- [ ] Rapid moves (<200ms apart) → timing rejection
- [ ] Move on finished game → rejection

### Game Over

- [ ] Win condition → `game:finished` with correct results
- [ ] Draw condition → all players get `outcome: 'draw'`
- [ ] Forfeit → forfeiting player loses, others win
- [ ] Session timeout (30 min) → force-end with current scores

### Disconnect/Reconnect

- [ ] Close tab → other player sees `session:player-left`
- [ ] Reopen tab with `?session=XYZ` → rejoin, state restored
- [ ] Close tab, wait >2 min → player removed permanently
- [ ] Both tabs close → session eventually evicted from memory
- [ ] Kill realtime server, restart → players auto-reconnect, state loaded from Firestore
- [ ] Network offline (DevTools → Network → Offline) → disconnect overlay shown
- [ ] Network back online → auto-reconnect, overlay hidden

### Matchmaking

- [ ] Find match → enters queue, returns `queueEntryId`
- [ ] Two players find match for same game → paired, session created
- [ ] Cancel matchmaking → removed from queue
- [ ] Wait 120s → queue entry expires
- [ ] Already in queue → conflict error

### Invitations

- [ ] Invite friend → invitation created
- [ ] Invite non-friend → forbidden error
- [ ] Accept invitation → can join session
- [ ] Decline invitation → status updated
- [ ] Wait 5 min → invitation expires
- [ ] Max 10 pending → conflict error

### Anti-Cheat

- [ ] Submit moves faster than 200ms → rejected
- [ ] Submit move on wrong turn → rejected
- [ ] Two players from same IP → session flagged
- [ ] Try to modify game state via browser console → no effect (server-authoritative)

## Network Simulation

### Chrome DevTools Throttling

1. DevTools → Network → Throttle dropdown
2. Add custom profile: 200ms latency, 1Mbps download
3. Play a game — verify it still works with high latency
4. For turn-based: should feel slightly delayed but functional
5. For real-time: prediction should mask the latency

### Disconnect Simulation

```javascript
// In browser console — force disconnect
window.multiplayerClient.disconnect();

// Wait 5 seconds, then reconnect
setTimeout(() => {
  window.multiplayerClient.connect(sessionId);
}, 5000);
```

## Stress Testing

### Scripted WebSocket Clients

```javascript
// stress-test.js — run with Node.js
const { io } = require('socket.io-client');

const NUM_SESSIONS = 10;
const MOVES_PER_SESSION = 50;

for (let i = 0; i < NUM_SESSIONS; i++) {
  const socket = io('http://localhost:3001/game', {
    auth: { token: 'test-token' },
    query: { sessionId: `stress-test-${i}` },
  });

  socket.on('connect', () => {
    let moves = 0;
    const interval = setInterval(() => {
      socket.emit('game:move', { moveType: 'test', moveData: { n: moves } });
      moves++;
      if (moves >= MOVES_PER_SESSION) {
        clearInterval(interval);
        socket.disconnect();
      }
    }, 100); // 10 moves/sec
  });
}
```

### What to Verify Under Load

- [ ] No state corruption (game states don't mix between sessions)
- [ ] Memory usage stays stable (no leaks)
- [ ] Firestore batch writes don't fall behind
- [ ] Move latency stays under 50ms
- [ ] No unhandled errors in server logs

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "Not a participant" on connect | Player not in Firestore session doc | Ensure `joinSession()` called before `connect()` |
| State not syncing | Wrong Socket.IO namespace | Check client connects to `/game` namespace |
| Moves rejected as "too fast" | Testing with automated scripts | Increase `MIN_MOVE_INTERVAL_MS` for tests |
| Auth failed on reconnect | Token expired during game | Ensure `auth:refresh` emits new token |
| Game state lost on server restart | Not persisted before crash | Verify batch persist is working (check Firestore) |
| Both players see "your turn" | `getNextTurn()` returning wrong UID | Debug server-side game logic |
| Lobby doesn't update | Not re-fetching session after events | Call `getSession()` in `onPlayerJoined` handler |
