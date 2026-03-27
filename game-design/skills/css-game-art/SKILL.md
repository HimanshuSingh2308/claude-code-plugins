---
name: css-game-art
description: >
  CSS-only game art patterns for browser games. Covers character design, environment
  drawing, UI components, visual effects, and how to make flat CSS feel rich and alive.
  No images, no canvas, no sprites — pure CSS divs, gradients, shadows, and pseudo-elements.
  Applied when building any visual element in a CSS-drawn browser game.
---

# CSS Game Art & Visual Design

No images, no canvas — pure CSS divs, gradients, shadows, and pseudo-elements.

---

## 1. Character Design

### The Universal Character Template

```
[Hair/Hat] ← ::before    (O) ← Head: circle    [  ] ← Body: rounded rect
/    \ ← Arms            ||  || ← Legs          ~~~~~~ ← Shadow: radial-gradient
```

### Head (16-24px circle)

```css
.character-head {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #FFDAB9; /* peach skin */
  position: relative;
  margin: 0 auto;
}

/* Face — simple emoji or CSS dots */
.character-face {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  font-size: 10px;
  line-height: 1;
}
```

### Skin Tone Palette

| Tone | Hex | Usage |
|------|-----|-------|
| Light | `#FFDAB9` | Default |
| Warm | `#E8B887` | Variant |
| Medium | `#D4956B` | Variant |
| Tan | `#C68642` | Variant |
| Brown | `#8D5524` | Variant |
| Dark | `#5C3317` | Variant |

Randomize skin tones for NPCs to add diversity.

### Body (20-28px wide, 24-36px tall)

```css
.character-body {
  width: 24px;
  height: 32px;
  border-radius: 6px 6px 4px 4px;
  background: var(--shirt-color);
  position: relative;
  margin: -2px auto 0;
}

/* Apron/vest overlay */
.character-body::after {
  content: '';
  position: absolute;
  top: 8px; left: 2px; right: 2px; bottom: 0;
  background: var(--apron-color);
  border-radius: 2px 2px 4px 4px;
}
```

### Hair Styles

All use `::before` pseudo-element on head. Pattern: `content:''; position:absolute; background:var(--hair-color);`

| Style | Class | Position | Size | Border-radius | Extra |
|-------|-------|----------|------|---------------|-------|
| Short | `.hair-short` | top:-3px; left:2px; right:2px | h:8px | 10px 10px 0 0 | — |
| Long | `.hair-long` | top:-3px; left:-2px; right:-2px | h:20px | 10px 10px 4px 4px | z-index:-1 |
| Cap | `.hair-cap` | top:-6px; left:-3px; right:-3px | h:10px | 10px 10px 2px 2px | +`::after` brim: top:-2px; left:-6px; w:32px h:4px |

**Hair colors**: `#2C1810` black, `#5C3317` dark brown, `#8B6914` brown, `#D4A574` blonde, `#C0392B` red, `#E8E8E8` gray, `#FF69B4` pink, `#4A90D9` blue

### Accessories

All use `::before` or `::after` on body. Pattern: `content:''; position:absolute;`

| Accessory | Class | Pseudo | Position | Size | Style |
|-----------|-------|--------|----------|------|-------|
| Tie | `.accessory-tie` | after | top:4px; left:50%; translateX(-50%) | 4×14px | `#C0392B`, clip-path: trapezoid |
| Backpack | `.accessory-backpack` | before | top:4px; right:-6px | 8×14px | `#FF9800`, border-radius:2px |
| Glasses | `.accessory-glasses` | after | top:6px; left:2px | 16×6px | border:2px solid #333, border-radius:50% |
| Crown | `.accessory-crown` | before | top:-14px; center | emoji | `content:'👑'; font-size:12px` |

### Character Shadow

```css
.character-shadow {
  position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%);
  width: 30px; height: 8px;
  background: radial-gradient(ellipse, rgba(0,0,0,0.2) 0%, transparent 70%);
  pointer-events: none;
}
```

### Character States

All animations use GPU-accelerated `transform` only.

| State | Keyframe | Duration | Property | Key Values |
|-------|----------|----------|----------|------------|
| Walking | `walkBob` | 0.4s infinite | translateY | 0 → -3px → 0 |
| Happy | `happyBounce` | 0.5s once | translateY + scale | 0,1 → -12px,1.05/.95 → 0,1 |
| Angry | `angryShake` | 0.15s ×3 | translateX | 0 → -3px → 3px → 0. Add `filter: saturate(1.5) hue-rotate(-10deg)` |
| Idle | `idleBreathe` | 3s infinite | scaleY | 1 → 1.02 → 1 |
| Serving | `serveArms` | 0.6s once | rotate (on `.arm`) | 0 → -25deg → 0 |

### Character Size Guide

| Context | Head | Body | Total Height | Touch Target |
|---------|------|------|-------------|--------------|
| Queue customer | 20px | 24×32 | ~56px | 48×72px |
| Worker behind counter | 16px | 20×28 | ~48px | — (not tappable) |
| Small NPC / distance | 12px | 16×20 | ~36px | — |
| Title screen / large | 28px | 32×40 | ~72px | — |

---

## 2. Environment Design

### Wall & Floor Techniques

All surfaces use `linear-gradient` or `repeating-linear-gradient` layers. Pattern: base color gradient + optional texture overlay.

| Surface | Class | Technique | Key Colors |
|---------|-------|-----------|------------|
| Painted wall | `.wall` | gradient 180deg | `#D4B896` → `#C8A87C` |
| Wainscoting | `.wall::after` | bottom 35%, border-top | `#B89468` → `#A8845C`, trim `#96784E` |
| Wallpaper | `.wall-premium` | 45deg repeating + gradient | Gold `rgba(255,215,0,0.03)` overlay |
| Brick | `.wall-brick` | H+V repeating 18/20px, 38/40px | Mortar `#8B6914`, base `#C8956E` |
| Wood floor | `.floor-wood` | 90deg repeating planks 59/60px | `#B89468` → `#D4A87C` |
| Tile floor | `.floor-tile` | H+V grid 39/40px | `#C89B6E` → `#D4A87C` |
| Carpet | `.floor-carpet` | 135deg 4/8px subtle | `#3D2A5C` → `#4E3872` |

**Depth**: Add `::before` with `linear-gradient(180deg, rgba(0,0,0,0.15), transparent)` on any floor for back-to-front depth.

### Counter / Furniture with 3D Effect

```css
.counter {
  height: 16px;
  background: linear-gradient(180deg, #D4A54A 0%, #B8860B 100%);
  position: relative;
}

/* Top shine */
.counter::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(180deg, rgba(255,255,255,0.3), transparent);
}

/* Edge thickness */
.counter::after {
  content: '';
  position: absolute;
  bottom: -8px; left: 0; right: 0;
  height: 8px;
  background: linear-gradient(180deg, #8B6914, #7A5C10);
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}
```

### Shelves

```css
.shelf {
  width: 80px;
  height: 6px;
  background: linear-gradient(180deg, #C49A6C, #A88050);
  border-radius: 2px;
  position: absolute;
  box-shadow: 0 2px 4px rgba(0,0,0,0.15);
}

/* Shelf bracket */
.shelf::before, .shelf::after {
  content: '';
  position: absolute;
  top: 100%;
  width: 3px; height: 10px;
  background: #8B7355;
}
.shelf::before { left: 8px; }
.shelf::after { right: 8px; }
```

### Ceiling Lights

```css
.ceiling-light {
  position: absolute;
  top: 0;
  width: 4px; height: 20px;
  background: #666;
}

/* Bulb */
.ceiling-light::before {
  content: '';
  position: absolute;
  bottom: -8px; left: -6px;
  width: 16px; height: 12px;
  background: radial-gradient(ellipse, #FFF8E0, #E8D8A0);
  border-radius: 50%;
  box-shadow: 0 0 12px rgba(255,240,200,0.4);
}

/* Light cone glow */
.ceiling-light::after {
  content: '';
  position: absolute;
  bottom: -120px; left: -50px;
  width: 104px; height: 120px;
  background: radial-gradient(ellipse at top, rgba(255,240,200,0.15), transparent 70%);
  pointer-events: none;
}
```

### Decorative Elements

| Element | Size | Key Style | Notes |
|---------|------|-----------|-------|
| Menu board | 80×50px | bg:`#2C1810`, border:2px `#5C3317` | White text 8px centered |
| Wall clock | 24×24px circle | bg:white, border:2px `#333` | Rotate hand via `transform-origin:bottom center` |
| Potted plant | pot:14×10px, leaves:20×14px | pot:`#A0522D`, leaves:`radial-gradient(#4CAF50, #2E7D32)` | Overlap leaves -4px above pot |
| Framed picture | 24×18px | border:2px `#8B6914`, gradient fill | box-shadow for depth |

---

## 3. Equipment & Machines

```css
/* Boba/coffee machine */
.machine {
  width: 28px; height: 36px;
  background: linear-gradient(180deg, #888, #666);
  border-radius: 4px 4px 2px 2px;
  position: relative;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
/* Machine screen */
.machine::before {
  content: '';
  position: absolute;
  top: 6px; left: 4px;
  width: 12px; height: 8px;
  background: #333;
  border-radius: 2px;
  box-shadow: inset 0 0 4px rgba(0,255,0,0.3);
}
/* Machine nozzle */
.machine::after {
  content: '';
  position: absolute;
  bottom: -4px; left: 50%;
  transform: translateX(-50%);
  width: 6px; height: 6px;
  background: #555;
  border-radius: 0 0 2px 2px;
}

/* Table (round, for VIP/restaurant) */
.table {
  position: relative;
}
.table-top {
  width: 36px; height: 20px;
  background: radial-gradient(ellipse, #C49A6C, #A88050);
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
.table-leg {
  width: 4px; height: 12px;
  background: #8B6914;
  margin: -2px auto 0;
  border-radius: 0 0 2px 2px;
}

/* Chair */
.chair {
  width: 14px; height: 14px;
  background: linear-gradient(180deg, #8B4513, #6B3410);
  border-radius: 3px 3px 1px 1px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
```

---

## 4. Visual Effects (CSS-only)

### Floating Text (+$25, +TIP!)

```css
@keyframes floatUp {
  0% { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-40px) scale(0.8); }
}
.float-text {
  position: absolute;
  font-weight: 800;
  font-size: 14px;
  color: #F5C542;
  text-shadow: 0 1px 3px rgba(0,0,0,0.3);
  pointer-events: none;
  animation: floatUp 1s ease-out forwards;
}
```

### Coin Particles

```css
@keyframes coinFloat {
  0% { opacity: 1; transform: translate(0, 0) scale(1); }
  100% { opacity: 0; transform: translate(var(--dx), -30px) scale(0.5); }
}
.coin-particle {
  position: absolute;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: radial-gradient(circle, #FFE44D, #B8860B);
  pointer-events: none;
  animation: coinFloat 0.6s ease-out forwards;
}
```

### Sparkle Burst

```css
@keyframes sparkle {
  0% { opacity: 1; transform: translate(0, 0) scale(1); }
  100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0); }
}
.sparkle {
  position: absolute;
  width: 4px; height: 4px;
  background: #FFD700;
  border-radius: 50%;
  pointer-events: none;
  animation: sparkle 0.5s ease-out forwards;
}
```

### Confetti

```css
@keyframes confettiFall {
  0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(400px) rotate(var(--rot)) translateX(var(--dx)); opacity: 0; }
}
.confetti {
  position: absolute;
  width: 4px; height: 8px;
  border-radius: 1px;
  pointer-events: none;
  animation: confettiFall 2s ease-in forwards;
}
```

### Screen Shake

```css
@keyframes screenShake {
  0%, 100% { transform: translate(0, 0); }
  20% { transform: translate(-3px, 1px); }
  40% { transform: translate(3px, -1px); }
  60% { transform: translate(-2px, 2px); }
  80% { transform: translate(2px, -2px); }
}
.shake { animation: screenShake 0.4s ease-in-out; }
```

### Progress Ring (Serving Indicator)

```css
.progress-ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: conic-gradient(
    #4CAF50 var(--progress),
    transparent var(--progress)
  );
  mask: radial-gradient(circle, transparent 60%, black 61%);
  -webkit-mask: radial-gradient(circle, transparent 60%, black 61%);
}
```

---

## 5. UI Components

### Patience/Health Bar

```css
.bar-container {
  width: 30px; height: 4px;
  background: rgba(0,0,0,0.2);
  border-radius: 2px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.1s linear;
  /* Color based on ratio */
}
/* Green > 50% */
.bar-fill.high { background: #4CAF50; }
/* Yellow 25-50% */
.bar-fill.medium { background: #F5C542; }
/* Red < 25% */
.bar-fill.low { background: #E8736A; }
```

### Emoji Order Bubble

```css
.order-bubble {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 14px;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));
  animation: orderBob 2s ease-in-out infinite;
}
@keyframes orderBob {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(-3px); }
}
```

### Buttons

```css
/* Primary game button */
.btn-primary {
  background: linear-gradient(180deg, #7DB87D, #5A9A5A);
  color: white;
  border: none;
  padding: 0.6rem 1.5rem;
  border-radius: 12px;
  font-weight: 700;
  font-size: 1rem;
  min-height: 44px;
  cursor: pointer;
  box-shadow: 0 4px 0 #4A8A4A, 0 6px 12px rgba(0,0,0,0.2);
  transition: transform 0.1s, box-shadow 0.1s;
}
.btn-primary:active {
  transform: translateY(2px);
  box-shadow: 0 2px 0 #4A8A4A, 0 3px 6px rgba(0,0,0,0.2);
}
```

---

## 6. Color Palette Templates

### Warm/Cozy (Cafe, Bakery, Shop)

| Name | Hex | Usage |
|------|-----|-------|
| Cream | `#FFF8F0` | Background |
| Warm Taupe | `#D4A574` | Wood, furniture |
| Soft Pink | `#F2B5B5` | Accent, buttons |
| Boba Brown | `#5C3D2E` | Dark text, headers |
| Matcha Green | `#7DB87D` | Success, positive |
| Golden Coin | `#F5C542` | Currency, rewards |
| Coral Red | `#E8736A` | Warning, danger |

### Cool/Space (Sci-fi, Shooter)

| Name | Hex | Usage |
|------|-----|-------|
| Deep Space | `#0A0A2E` | Background |
| Neon Blue | `#00D4FF` | Primary accent |
| Neon Pink | `#FF2D95` | Secondary accent |
| Star White | `#EEEEEE` | Text |
| Void Purple | `#1A1040` | Cards, panels |
| Energy Green | `#39FF14` | Health, success |
| Alert Red | `#FF3B3B` | Damage, danger |

### Nature/Forest (Farming, Eco)

| Name | Hex | Usage |
|------|-----|-------|
| Sky | `#87CEEB` | Background |
| Grass | `#4CAF50` | Ground, nature |
| Earth | `#8B6914` | Wood, paths |
| Sunlight | `#FFD700` | Rewards, highlights |
| Stone | `#9E9E9E` | Neutral elements |
| Berry | `#9C27B0` | Rare, special |
| Water | `#2196F3` | Calm, flow |

---

## 7. Color Psychology for Games

Color isn't decoration — it's communication. Players read color faster than text. A red flash means danger before the brain processes "you took damage."

### Feedback Color Language

These associations are near-universal in games. Break them and players get confused.

| Color | Meaning | Usage | Hex Range |
|-------|---------|-------|-----------|
| **Green** | Good, safe, health, success, money | Score pop, health bar, "correct", coins earned | `#4ade80`, `#22c55e`, `#7DB87D` |
| **Red** | Danger, damage, error, urgency | Health loss, wrong answer, timer warning, enemy | `#ef4444`, `#FF3B3B`, `#E8736A` |
| **Gold/Yellow** | Reward, premium, achievement, currency | Coins, XP, achievement unlocked, combo streak | `#FFD700`, `#F5C542`, `#fbbf24` |
| **Blue** | Calm, info, mana, cooldown, water | Tutorial hints, info tooltips, ability cooldown | `#3498db`, `#00D4FF`, `#87CEEB` |
| **Purple** | Rare, epic, magic, prestige | Rare items, epic loot, VIP status | `#9b59b6`, `#7c3aed`, `#9C27B0` |
| **White** | Neutral, clean, common | Regular text, common items, empty states | `#ffffff`, `#f0f0f5`, `#eeeeee` |
| **Gray** | Disabled, unavailable, used | Locked upgrades, cooldown state, past items | `#888888`, `#9E9E9E`, `#666666` |
| **Orange** | Warning, energy, moderate urgency | "Almost out of time", medium rarity, warmth | `#FF9800`, `#f39c12`, `#FFA500` |

### Emotional Mood Through Palette

The background palette sets the emotional tone before a single mechanic runs.

| Mood | Palette Style | Example Games |
|------|--------------|---------------|
| **Cozy/Warm** | Cream, taupe, soft pink, warm brown | Tiny Tycoon, cafe games, farming sims |
| **Intense/Competitive** | Dark bg, neon accents, high contrast | Voidbreak, shooters, racing |
| **Cerebral/Calm** | Muted blues, greens, low contrast | Wordle, Solitaire, chess |
| **Playful/Fun** | Bright primaries, rounded shapes | Memory Match, party games |
| **Dark/Mysterious** | Deep purple/navy, gold accents | Roguelites, dungeon games |
| **Natural/Organic** | Greens, browns, sky blue | Fieldstone, farming, eco games |

### Color Contrast for Readability

| Element | Minimum Contrast | Why |
|---------|-----------------|-----|
| Body text on background | 4.5:1 (WCAG AA) | Readable in all lighting |
| Large headings | 3:1 | Acceptable for >18px bold |
| Interactive elements | 3:1 vs surrounding | Must be distinguishable |
| Score/timer during gameplay | 7:1 | Must read instantly while focused on game |
| Disabled state | Reduce opacity to 40-50% | Clearly not interactive |

### Color Progression for Game Tiers

Use color to signal advancement without words:

```
Tier 1 (Starter):  Muted, desaturated → "Basic, room to grow"
Tier 2 (Upgraded): Slightly richer    → "Getting better"
Tier 3 (Premium):  Saturated + glow   → "This is impressive"
Tier 4 (Max):      Gold accents + shimmer → "You've mastered this"
```

Example — shop wall evolution:
```css
/* Tier 1 */ background: #E8D5C0;
/* Tier 2 */ background: #F2EADC; /* lighter, cleaner */
/* Tier 3 */ background: #D4B896; box-shadow: inset 0 0 40px rgba(245,197,66,0.08); /* warm glow */
/* Tier 4 */ background: #C9A87C; /* rich + gold pattern overlay */
```

---

## 8. Art Checklist for PRD

```
[ ] Color palette chosen (6-8 colors with hex codes and usage)
[ ] Character template defined (head size, body size, skin tones)
[ ] Character differentiation method (colors, accessories, or both)
[ ] Environment style chosen (side-view, top-down, etc.)
[ ] Wall/floor/ceiling techniques specified
[ ] Furniture and equipment drawn with 3D edge effects
[ ] Shadow system defined (under characters, under furniture)
[ ] Ambient elements listed (steam, lights, particles)
[ ] Visual states for characters (idle, walking, happy, angry, serving)
[ ] UI components styled (bars, buttons, modals, badges)
[ ] Color progression for environment tiers documented
```
