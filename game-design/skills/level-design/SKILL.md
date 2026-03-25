---
name: level-design
description: >
  Level design and spatial layout patterns for browser games. Covers zone design,
  environment layout, camera perspectives, NPC placement, pathfinding, and how
  game spaces evolve with progression. Applied when designing game worlds, shop
  interiors, maps, arenas, or any spatial game element. Essential for idle/tycoon,
  tower defense, platformer, and simulation games.
---

# Level Design & Spatial Layout

## Core Principle: The Game Space IS the Game

A game's spatial layout directly shapes player behavior. Where you place things determines what players do, what they see, and how they feel. Level design is not decoration — it's game design.

---

## 1. Camera Perspectives

Choose based on game type and platform:

| Perspective | Best For | CSS Feasibility | Examples |
|-------------|----------|-----------------|----------|
| **Side-view / Cutaway** | Tycoon, idle sims, platformers | Excellent | My Perfect Hotel, Fallout Shelter |
| **Top-down** | Strategy, tower defense, maze | Excellent | Monkey Mart, Into the Breach |
| **Isometric** | Builder, RPG, city sim | Hard (CSS transforms) | SimCity, Stardew Valley |
| **First-person UI** | Card games, cooking sims | Good (layered panels) | Papa's Freezeria, Slay the Spire |
| **Scrolling** | Endless runners, shooters | Excellent | Subway Surfers, Jetpack Joyride |

### For CSS-only browser games, prefer:
- **Side-view cutaway** for tycoon/idle (show interior like a dollhouse)
- **Top-down** for strategy/puzzle (grid-based, clean hit detection)
- **Layered panels** for station-based games (discrete screens)

---

## 2. Zone Architecture

Every game world should be divided into functional zones:

### Zone Types

| Zone Type | Purpose | Example |
|-----------|---------|---------|
| **Action Zone** | Where the core gameplay happens | Counter/queue in a shop sim |
| **Upgrade Zone** | Where players spend resources | Upgrade shop, skill tree area |
| **Premium/Unlock Zone** | Locked area that motivates progression | VIP lounge, second floor, new biome |
| **Display Zone** | Shows status/progress passively | Trophy shelf, score display, leaderboard wall |
| **Rest Zone** | Low-intensity area between action | Lobby, menu, transition screens |

### Zone Layout Patterns

**Hub and Spoke** (idle/tycoon):
```
         [Upgrade Shop]
              |
[Zone A] -- [HUB] -- [Zone B]
              |
         [Zone C (locked)]
```
Player returns to hub between zones. Great for progression-gated content.

**Linear Corridor** (platformer, runner):
```
[Start] → [Zone 1] → [Zone 2] → [Boss] → [Zone 3] → ...
```
Players move forward. Difficulty increases linearly.

**Layered / Stacked** (tycoon, builder):
```
┌─────────────────────┐
│   Premium Area      │  ← Unlocked later
├─────────────────────┤
│   Main Game Area    │  ← Core gameplay
├─────────────────────┤
│   HUD / Controls    │  ← Always visible
└─────────────────────┘
```
Vertical stacking works great for mobile (scroll or fixed split).

**Grid / Tile** (strategy, puzzle, builder):
```
┌──┬──┬──┬──┬──┐
│  │  │  │  │  │
├──┼──┼──┼──┼──┤
│  │  │  │  │  │
├──┼──┼──┼──┼──┤
│  │  │  │  │  │
└──┴──┴──┴──┴──┘
```
Each cell is a discrete game object position. Clean, predictable.

---

## 3. Spatial Progression (Environment Evolution)

The game world should VISIBLY change as the player progresses:

### Tier System

| Upgrade Total | Visual Tier | Changes |
|---------------|-------------|---------|
| 0-3 | **Starter** | Basic materials, minimal decoration, dim lighting |
| 4-7 | **Established** | Painted walls, small plant/poster, brighter |
| 8-12 | **Professional** | New furniture, framed art, warm lighting, richer colors |
| 13-18 | **Premium** | Wallpaper patterns, golden accents, ambient particles |
| 19+ | **Luxury** | Complete visual overhaul, premium materials, animations |

### Implementation Pattern

```javascript
function getEnvironmentTier(totalUpgrades) {
  if (totalUpgrades >= 19) return 'luxury';
  if (totalUpgrades >= 13) return 'premium';
  if (totalUpgrades >= 8) return 'professional';
  if (totalUpgrades >= 4) return 'established';
  return 'starter';
}

// Apply via CSS class on the game container
gameContainer.className = `tier-${getEnvironmentTier(totalUpgrades)}`;
```

```css
.tier-starter   { --wall: #C8A87C; --floor: #B89468; --accent: #8B7355; }
.tier-established { --wall: #D4B896; --floor: #C4A47C; --accent: #A08860; }
.tier-professional { --wall: #E8D5B7; --floor: #D4B896; --accent: #C49A6C; }
.tier-premium    { --wall: #F5E6D0; --floor: #E0C8A8; --accent: #D4A855; }
.tier-luxury     { --wall: #FFF5E6; --floor: #F0DCC0; --accent: #FFD700; }
```

### Decorative Elements by Tier

| Tier | Decorations Added |
|------|------------------|
| Starter | Empty walls, bare floor |
| Established | Small plant, clock, one shelf |
| Professional | Framed picture, more shelves, better lighting |
| Premium | Wallpaper pattern, golden trim, ambient particles |
| Luxury | Chandelier, premium flooring, animated elements |

---

## 4. Unlock Zone Design

Locked areas are one of the most powerful progression motivators:

### The Tease Pattern

1. **Show** the locked zone from the start (grayed out, with lock icon)
2. **Hint** at what's inside (faded furniture, silhouetted characters)
3. **Gate** with a specific upgrade or achievement
4. **Unlock** with a satisfying animation (scale up, color flood, fanfare)
5. **Populate** the zone with new gameplay elements

### CSS Pattern for Locked Zones

```css
.zone.locked {
  filter: grayscale(0.6) brightness(0.7);
  opacity: 0.6;
  pointer-events: none;
  position: relative;
}
.zone.locked::after {
  content: '🔒';
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  font-size: 2rem;
  filter: none;
}
.zone.unlocked {
  filter: none;
  opacity: 1;
  pointer-events: auto;
  animation: zoneUnlock 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
@keyframes zoneUnlock {
  0% { transform: scaleY(0.8); opacity: 0.5; }
  100% { transform: scaleY(1); opacity: 1; }
}
```

### Multi-Level Unlock Zones

For upgrades with multiple levels (like VIP Lounge 1/2/3):

| Level | What Unlocks |
|-------|-------------|
| 1 | Zone opens, basic functionality, 1 slot/table/unit |
| 2 | Zone expands, better decor, 2 slots, new features |
| 3 | Full premium zone, max capacity, visual flourish |

---

## 5. NPC Placement & Pathfinding

### Character Roles in Game Space

| Role | Position | Behavior |
|------|----------|----------|
| **Player Character / Barista** | Behind counter/station | Animates on player action |
| **Customers / Visitors** | Queue area, walk in from edge | Walk → queue → get served → leave |
| **Workers / Auto-serve** | At stations/machines | Idle animation, work animation when active |
| **Special NPCs (Waiter, VIP)** | Premium zones | Autonomous pathfinding within zone |

### Queue/Path Design

**Linear Queue** (most common):
```
[Entrance] → C4 → C3 → C2 → C1 → [Counter/Service Point]
```
- Customers line up left-to-right or right-to-left
- When served, customer leaves opposite direction
- Queue shifts forward when front customer leaves

**Multi-Lane Queue** (advanced):
```
[Counter 1] ← C1a ← C2a ← [Entrance]
[Counter 2] ← C1b ← C2b ←
```
- Multiple service points serve in parallel
- Customers pick shortest queue

**Roaming NPCs** (tycoon/sim):
```
[Entrance] → Walk to zone → Interact → Walk to next zone → Exit
```
- NPCs have a "destination" and walk toward it
- On arrival, perform action (sit, order, browse)
- After action, pick next destination or exit

### Pathfinding for CSS-Based Games

Simple waypoint system (no A* needed):

```javascript
const PATHS = {
  queue: [
    { x: 400, y: 200 },  // entrance
    { x: 300, y: 200 },  // queue pos 4
    { x: 200, y: 200 },  // queue pos 3
    { x: 100, y: 200 },  // queue pos 2
    { x: 50, y: 200 },   // counter (queue pos 1)
  ],
  vipLounge: [
    { x: 400, y: 200 },  // entrance
    { x: 300, y: 300 },  // walk down
    { x: 180, y: 350 },  // table position
  ],
  exit: [
    { x: -50, y: 200 },  // walk off-screen left
  ]
};

function moveToward(npc, target, speed, dt) {
  const dx = target.x - npc.x;
  const dy = target.y - npc.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 2) return true; // arrived
  npc.x += (dx / dist) * speed * dt;
  npc.y += (dy / dist) * speed * dt;
  return false;
}
```

---

## 6. Visual Depth in 2D

Techniques to make flat CSS layouts feel 3D and rich:

### Layer Stack (back to front)

| Layer | z-index | Content | Technique |
|-------|---------|---------|-----------|
| Background | 0 | Wall, sky, distant elements | Darker, less saturated |
| Mid-ground | 5 | Furniture, machines, shelves | Normal colors |
| Interactive | 10 | Counter, service area | Brighter, drop shadows |
| Characters | 20 | NPCs, player | Shadows underneath, bob animation |
| Foreground | 30 | UI elements over game area | Bright, sharp |
| Effects | 40 | Particles, popups, toasts | Semi-transparent |

### Depth Cues

```css
/* Objects further back are smaller, dimmer */
.back-layer { transform: scale(0.9); filter: brightness(0.85); }
.mid-layer { transform: scale(1.0); }
.front-layer { transform: scale(1.05); filter: brightness(1.05); }

/* Every object casts a floor shadow */
.game-object::after {
  content: '';
  position: absolute;
  bottom: -4px; left: 10%; width: 80%; height: 8px;
  background: radial-gradient(ellipse, rgba(0,0,0,0.2), transparent 70%);
}

/* Counter/furniture has visible thickness */
.counter {
  border-bottom: 6px solid color-mix(in srgb, var(--wood) 70%, black);
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

/* Floor has depth gradient (dark at back, light at front) */
.floor {
  background: linear-gradient(to bottom, #B89060, #D4A87C);
}
```

### Ambient Elements

| Element | Implementation | Purpose |
|---------|---------------|---------|
| Steam/smoke | Blurred circles with translateY animation | Show activity/life |
| Light cones | Radial gradients from ceiling | Warm atmosphere |
| Dust motes | Tiny dots with slow drift | Organic feel |
| Shadows | Radial gradient ellipses under objects | Grounding |

---

## 7. Mobile-First Spatial Design

### Viewport Budgeting (480px max width)

```
┌──────────────────────┐
│ Header: 48px         │  ← Navigation, title, auth
├──────────────────────┤
│ HUD: 36px            │  ← Score, timer, combo
├──────────────────────┤
│                      │
│ Game Area: ~60%      │  ← Core gameplay
│ (flexible)           │
│                      │
├──────────────────────┤
│ Secondary Zone: ~30% │  ← Unlock zone, info panel
│                      │
└──────────────────────┘
```

### Touch Target Zones

```
┌──────────────────────┐
│  Safe zone (no taps) │  ← Status/display only
├──────────────────────┤
│                      │
│  Primary tap zone    │  ← Core interaction area
│  (center of screen)  │  ← 44px+ targets
│                      │
├──────────────────────┤
│  Secondary tap zone  │  ← Less frequent interactions
│  (bottom 30%)        │  ← Buttons, menus
└──────────────────────┘
```

### One-Handed Design (right thumb)

Most mobile players use their right thumb. The primary interaction area should be reachable:

```
         Difficult to reach
    ┌─────────────────────┐
    │ × × × × × × × × × │
    │ × × ✓ ✓ ✓ ✓ × × × │
    │ × ✓ ✓ ✓ ✓ ✓ ✓ × × │
    │ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ × │
    │ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ │
    └─────────────────────┘
         Easy to reach (thumb arc)
```

Place primary game actions in the bottom 60% of the screen.

---

## 8. Environment Storytelling

The game space should communicate information without words:

| Visual Cue | What It Communicates |
|------------|---------------------|
| Locked/grayed zone | "There's more to unlock" |
| Empty shelves/slots | "Fill these with upgrades" |
| Faded preview of future content | "This is what you're working toward" |
| Color progression (dull → rich) | "You're improving" |
| Size of crowd/activity | "Business is booming" |
| Decorative details appearing | "Your investment is paying off" |

---

## 9. Level Design Checklist for PRD

When designing a game's spatial layout, answer these:

```
[ ] What camera perspective? (side-view, top-down, isometric)
[ ] How many zones? What is each zone's purpose?
[ ] Which zones are locked at start? What unlocks them?
[ ] How do zones evolve visually with upgrades?
[ ] Where do NPCs spawn, path, and exit?
[ ] What's the visual hierarchy? (what draws the eye first?)
[ ] How does the layout work on mobile (480px)?
[ ] Where are the primary touch/interaction targets?
[ ] What ambient elements make the space feel alive?
[ ] How does the player know what to do without text?
```
