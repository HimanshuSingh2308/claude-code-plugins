# Tech Stack Options for Game Development

Reference when user asks about implementation, or when writing the Technical Requirements section of the PRD.

---

## Engine Selection by Platform & Budget

### Mobile (iOS + Android)

| Engine | Language | Best For | Cost |
|--------|----------|----------|------|
| **Unity** | C# | Any genre, large community, asset store | Free tier available |
| **Godot 4** | GDScript / C# | 2D games, indie, open source | Free |
| **Flutter + Flame** | Dart | Casual/puzzle, if team knows Flutter | Free |
| **React Native + Phaser** | JS/TS | Hybrid web+native casual games | Free |

**Recommendation for MVP mobile**: Godot 4 (fastest to prototype 2D), Unity (if 3D or team experience)

### Browser / Web

| Engine | Language | Best For | Cost |
|--------|----------|----------|------|
| **Phaser 3** | JavaScript/TS | 2D arcade, casual, fast to ship | Free |
| **PixiJS** | JavaScript/TS | High-performance 2D rendering | Free |
| **Three.js / Babylon.js** | JavaScript/TS | 3D browser games | Free |
| **Unity WebGL** | C# | Complex games, already using Unity | Free tier |
| **GDevelop** | No-code + JS | Quick prototypes, no coding required | Free tier |

**Recommendation for MVP browser**: Phaser 3 (excellent for arcade/casual, huge community)

### Desktop

| Engine | Best For |
|--------|----------|
| **Unity** | Any genre, large team |
| **Godot** | Indie, open source preference |
| **Unreal Engine** | AAA visuals, 3D action |
| **GameMaker** | 2D games, fast development |

---

## Backend Services (Leaderboards, Auth, Multiplayer)

### Leaderboard & Score APIs (Managed)

| Service | Free Tier | Best For |
|---------|-----------|---------|
| **GameSparks / PlayFab** | Yes | Full game backend, analytics included |
| **Nakama (open source)** | Self-hosted | Full control, leaderboards + multiplayer |
| **Firebase Realtime DB** | Yes | Simple score storage, easy to integrate |
| **Supabase** | Yes | Postgres-based, good for custom leaderboards |
| **LootLocker** | Yes | Leaderboards + player auth, game-focused |

**Recommendation for MVP**: LootLocker or Firebase — both have free tiers and easy SDKs for Unity/Godot

### Authentication

| Option | Complexity | Notes |
|--------|-----------|-------|
| **Guest ID** (device UUID) | Minimal | No sign-up; players lose progress on reinstall |
| **Firebase Auth** | Low | Google/Apple/email; most common in mobile |
| **PlayFab Auth** | Low | Integrated with PlayFab backend |
| **Custom JWT** | Medium | Full control; requires server |

**Recommendation**: Guest ID for MVP (zero friction), add Firebase Auth in V2

### Real-time Multiplayer Infrastructure

| Option | Latency | Best For | Cost |
|--------|---------|----------|------|
| **Photon (PUN/Fusion)** | Low | Unity multiplayer, up to 20 CCU free | Free tier |
| **Nakama** | Low | Self-hosted, full-stack multiplayer | Free open-source |
| **Socket.io + Node** | Medium | Custom browser games | Server cost only |
| **WebRTC** | Very Low | P2P, no server needed (but complex) | Free |
| **AWS GameLift** | Low | Scale to millions, complex setup | Pay per use |

**Recommendation for MVP multiplayer**: Photon PUN (Unity) or Socket.io (web) — large community, well documented

---

## Async Multiplayer (Ghost/Replay) — Recommended for MVP

No real-time server needed. Implementation:

```
1. Player completes a run → record inputs as array of timestamped events
2. POST replay data to backend (Firebase / Supabase)
3. Other players "race" against this replay locally
4. Compare scores and display on leaderboard
```

This gives the feeling of multiplayer with:
- Zero real-time infrastructure cost
- No matchmaking complexity  
- Works with any engine
- Scales to any number of players

---

## MVP Tech Stack Recommendations by Project Type

### Casual Mobile Game (solo dev, bootstrap budget)
```
Engine:      Godot 4
Backend:     Firebase (auth + Firestore for scores)
Leaderboard: LootLocker free tier
Multiplayer: Async ghosts (Firebase storage)
Analytics:   Firebase Analytics (free)
Monetization: Google AdMob + Unity IAP
```

### Browser-Based Arcade Game
```
Engine:      Phaser 3
Backend:     Supabase (leaderboard + auth)
Multiplayer: Socket.io (if needed)
Hosting:     Vercel / Netlify (free tier)
Analytics:   Plausible or PostHog
```

### Cross-Platform Mid-Core Game (small team)
```
Engine:      Unity (LTS version)
Backend:     PlayFab (free tier covers most MVP needs)
Multiplayer: Photon PUN2
Analytics:   GameAnalytics (free, game-specific)
Monetization: Unity IAP + IronSource mediation
```
