---
name: websocket-realtime
description: >
  NestJS WebSocket gateway patterns with Socket.IO for real-time multiplayer games.
  Covers gateway setup, room management, connection lifecycle, auth middleware,
  message broadcasting, heartbeat/ping, in-memory state management, and batch
  Firestore persistence. Applied when building real-time features with @nestjs/websockets
  and @nestjs/platform-socket.io. For game design patterns, see multiplayer-architecture.
---

# WebSocket & Real-Time Patterns for NestJS

## Setup

### Dependencies

```bash
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
```

### Bootstrap with Socket.IO Adapter

```typescript
// main.ts
import { IoAdapter } from '@nestjs/platform-socket.io';

const app = await NestFactory.create(AppModule);
app.useWebSocketAdapter(new IoAdapter(app));
```

## Gateway Pattern

### Basic Gateway

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/game',
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
  pingInterval: 15000,   // Heartbeat every 15s
  pingTimeout: 45000,    // Disconnect after 45s no pong
})
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  afterInit(server: Server) {
    // Attach middleware (auth, logging)
    server.use(authMiddleware);
  }

  handleConnection(client: Socket) {
    // Verify auth, join room, load state
  }

  handleDisconnect(client: Socket) {
    // Leave room, update status, start reconnect timer
  }

  @SubscribeMessage('game:move')
  handleMove(@ConnectedSocket() client: Socket, @MessageBody() payload: MovePayload) {
    // Validate, apply, broadcast
  }
}
```

## Authentication Middleware

Verify Firebase JWT on WebSocket handshake — runs once per connection:

```typescript
export function createWsAuthMiddleware(firebaseService: FirebaseService) {
  return async (socket: Socket, next: (err?: Error) => void) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No auth token'));

    try {
      const decoded = await firebaseService.verifyIdToken(token);
      socket.data.user = { uid: decoded.uid, email: decoded.email };
      socket.data.sessionId = socket.handshake.query?.sessionId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  };
}
```

**Token refresh:** Client emits `auth:refresh` with new token every 50 minutes.

## Room Management

### Join/Leave Rooms

```typescript
// Join a room (session-scoped)
client.join(`session:${sessionId}`);

// Leave a room
client.leave(`session:${sessionId}`);

// Broadcast to room (excludes sender)
client.to(`session:${sessionId}`).emit('event', data);

// Broadcast to room (includes sender)
this.server.to(`session:${sessionId}`).emit('event', data);
```

### Room Manager Service

Track clients, ready states, spectators separately from Socket.IO rooms:

```typescript
@Injectable()
export class GameRoomManager {
  private rooms = new Map<string, {
    clients: Map<string, { uid: string; socketId: string; isSpectator: boolean; isReady: boolean }>;
  }>();

  addClient(sessionId, uid, socketId, isSpectator) { /* ... */ }
  removeClient(sessionId, socketId) { /* ... */ }
  isSpectator(sessionId, socketId): boolean { /* ... */ }
  markReady(sessionId, uid) { /* ... */ }
  getConnectedPlayers(sessionId): string[] { /* ... */ }
}
```

## In-Memory State Management

### The Pattern (from Rune architecture)

Hold active game state in memory. Validate moves in-memory (~1ms). Persist to database asynchronously in batches.

```typescript
@Injectable()
export class GameStateManager {
  private sessions = new Map<string, {
    state: Record<string, unknown>;
    version: number;
    logic: MultiplayerGameLogic;
    players: Set<string>;
    lastPersisted: number;
    pendingMoves: number;
    persistTimer: NodeJS.Timeout | null;
  }>();

  // Load from DB on first player connect
  async loadSession(sessionId: string) { /* ... */ }

  // Validate + apply in-memory (~1ms, no DB hit)
  applyMove(sessionId, uid, moveType, moveData) {
    const session = this.sessions.get(sessionId);
    const newState = session.logic.applyMove(session.state, uid, moveType, moveData);
    session.state = newState;
    session.version++;
    this.schedulePersist(sessionId);
    return newState;
  }

  // Batch persist: every 500ms or 5 moves
  private schedulePersist(sessionId: string) { /* ... */ }

  // Evict from memory when all players leave + grace period
  private scheduleEviction(sessionId: string) { /* ... */ }
}
```

### Batch Persistence Strategy

```
Move 1 → in-memory update → schedule persist (500ms timer)
Move 2 → in-memory update → timer still running
Move 3 → in-memory update → timer still running
Move 4 → in-memory update → timer still running
Move 5 → in-memory update → threshold reached → persist NOW (cancel timer)
```

**Config:**
- `PERSIST_INTERVAL_MS = 500` — max time between persists
- `PERSIST_MOVE_THRESHOLD = 5` — max moves between persists
- `EVICTION_GRACE_MS = 5 * 60 * 1000` — 5 min after all players leave

## Event Protocol

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `game:move` | `{ moveType, moveData }` | Submit a game move |
| `game:ready` | `{}` | Signal ready in lobby |
| `game:forfeit` | `{}` | Forfeit the game |
| `auth:refresh` | `{ token }` | Refresh JWT |
| `presence:ping` | `{}` | Keep-alive |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `game:state` | `{ state, version, turnUid }` | Authoritative state |
| `game:move-rejected` | `{ reason }` | Invalid move |
| `game:started` | `{ initialState }` | Game begins |
| `game:finished` | `{ results }` | Game over |
| `session:player-joined` | `{ uid, displayName }` | Player joined |
| `session:player-left` | `{ uid, reason }` | Player left/disconnected |
| `session:player-reconnected` | `{ uid }` | Player returned |
| `session:host-changed` | `{ newHostUid }` | Host migrated |
| `error` | `{ code, message }` | Error |

## Connection Lifecycle

```
Client connects
  → Auth middleware verifies JWT
  → Extract sessionId from handshake query
  → Verify user is session participant (Firestore read)
  → Load session into memory (if not already)
  → Join Socket.IO room
  → Broadcast 'player-joined' to room
  → Send current game:state to connecting client

Client disconnects
  → Remove from room manager
  → Update player status to 'disconnected' in Firestore
  → Broadcast 'player-left' to room
  → Start 2-min reconnect timer
  → If all players gone: schedule 5-min eviction

Client reconnects (Socket.IO auto-reconnect)
  → Re-authenticate via handshake
  → Rejoin room
  → Server sends current game:state immediately
  → Broadcast 'player-reconnected'
```

## Client-Side Integration

```javascript
// Connect with auth
const socket = io('https://realtime-service.example.com/game', {
  auth: { token: firebaseIdToken },
  query: { sessionId: 'abc123' },
  reconnection: true,
  reconnectionAttempts: 10,
});

// Listen for state updates
socket.on('game:state', ({ state, version, turnUid }) => {
  renderGame(state, turnUid);
});

// Submit a move
socket.emit('game:move', { moveType: 'place-piece', moveData: { row: 0, col: 1 } });

// Handle rejection
socket.on('game:move-rejected', ({ reason }) => {
  showError(reason);
});
```

## Anti-Cheat: Timing Validation

```typescript
const MIN_MOVE_INTERVAL_MS = 200;

applyMove(sessionId, uid, moveType, moveData) {
  const now = Date.now();
  const lastMove = session.lastMoveTime.get(uid);
  if (lastMove && (now - lastMove) < MIN_MOVE_INTERVAL_MS) {
    throw new Error('Move too fast');
  }
  session.lastMoveTime.set(uid, now);
  // ... validate and apply
}
```

## Scaling Considerations

- **Single instance:** In-memory state means all players in a session must connect to the same server instance
- **Sticky sessions:** Use session affinity (Render, Fly.io, Cloud Run all support this)
- **Horizontal scaling:** For multiple instances, use Redis pub/sub to broadcast state changes across instances (Phase 2+)
- **Max sessions per instance:** ~500 concurrent sessions per 512MB RAM (depends on state size)

## Common Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Client writes game state directly | Cheating | Server-authoritative only |
| Persisting on every move | High latency, DB costs | Batch persistence (500ms/5 moves) |
| No auth on WebSocket | Anyone can connect | JWT verification on handshake |
| Trusting client timestamps | Time manipulation | Use server timestamps only |
| No reconnect handling | Lost progress on network blip | Socket.IO auto-reconnect + state resend |
| Broadcasting full state always | Bandwidth waste | Delta updates for large states |
