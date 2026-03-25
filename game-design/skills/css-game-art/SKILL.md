---
name: css-game-art
description: >
  CSS-only game art patterns for browser games. Covers character design, environment
  drawing, UI components, visual effects, and how to make flat CSS feel rich and alive.
  No images, no canvas, no sprites — pure CSS divs, gradients, shadows, and pseudo-elements.
  Applied when building any visual element in a CSS-drawn browser game.
---

# CSS Game Art & Visual Design

## Core Principle: Constraints Breed Creativity

CSS-only games have a distinct charm. The constraint of "no images" forces clean, readable, scalable visuals that load instantly and look sharp on any screen.

---

## 1. Character Design

### The Universal Character Template

Every CSS game character uses the same base structure:

```
     [Hair/Hat]        ← ::before pseudo-element
        (O)            ← Head: circle div
       [  ]            ← Body: rounded rect div
      /    \           ← Arms: small rects or pseudo-elements
       ||  ||          ← Legs: thin rects (optional)
     ~~~~~~            ← Shadow: radial-gradient ellipse
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

```css
/* Short hair — arc on top of head */
.hair-short::before {
  content: '';
  position: absolute;
  top: -3px; left: 2px; right: 2px;
  height: 8px;
  background: var(--hair-color);
  border-radius: 10px 10px 0 0;
}

/* Long hair — extends down sides */
.hair-long::before {
  content: '';
  position: absolute;
  top: -3px; left: -2px; right: -2px;
  height: 20px;
  background: var(--hair-color);
  border-radius: 10px 10px 4px 4px;
  z-index: -1;
}

/* Hat/cap */
.hair-cap::before {
  content: '';
  position: absolute;
  top: -6px; left: -3px; right: -3px;
  height: 10px;
  background: var(--hat-color);
  border-radius: 10px 10px 2px 2px;
}
.hair-cap::after {
  content: '';
  position: absolute;
  top: -2px; left: -6px;
  width: 32px; height: 4px;
  background: var(--hat-color);
  border-radius: 2px;
}
```

### Hair Color Palette

`#2C1810` (black), `#5C3317` (dark brown), `#8B6914` (brown), `#D4A574` (blonde), `#C0392B` (red), `#E8E8E8` (gray/white), `#FF69B4` (pink/dyed), `#4A90D9` (blue/dyed)

### Accessories (Differentiate Character Types)

```css
/* Tie (business character) */
.accessory-tie::after {
  content: '';
  position: absolute;
  top: 4px; left: 50%;
  transform: translateX(-50%);
  width: 4px; height: 14px;
  background: #C0392B;
  clip-path: polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%);
}

/* Backpack (student) */
.accessory-backpack::before {
  content: '';
  position: absolute;
  top: 4px; right: -6px;
  width: 8px; height: 14px;
  background: #FF9800;
  border-radius: 2px;
}

/* Glasses */
.accessory-glasses::after {
  content: '';
  position: absolute;
  top: 6px; left: 2px;
  width: 16px; height: 6px;
  border: 2px solid #333;
  border-radius: 50%;
  background: rgba(255,255,255,0.1);
}

/* Crown (VIP) */
.accessory-crown::before {
  content: '👑';
  position: absolute;
  top: -14px; left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
}
```

### Character Shadow (Grounding)

```css
.character-shadow {
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 30px;
  height: 8px;
  background: radial-gradient(ellipse, rgba(0,0,0,0.2) 0%, transparent 70%);
  pointer-events: none;
}
```

### Character States

```css
/* Walking — vertical bob */
@keyframes walkBob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
.character.walking { animation: walkBob 0.4s ease-in-out infinite; }

/* Happy — bounce */
@keyframes happyBounce {
  0% { transform: translateY(0) scale(1); }
  30% { transform: translateY(-12px) scale(1.05, 0.95); }
  60% { transform: translateY(0) scale(0.95, 1.05); }
  100% { transform: translateY(0) scale(1); }
}
.character.happy { animation: happyBounce 0.5s ease-out; }

/* Angry — shake + red tint */
@keyframes angryShake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-3px); }
  75% { transform: translateX(3px); }
}
.character.angry {
  animation: angryShake 0.15s ease-in-out 3;
  filter: saturate(1.5) hue-rotate(-10deg);
}

/* Idle — subtle breathe */
@keyframes idleBreathe {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(1.02); }
}
.character.idle { animation: idleBreathe 3s ease-in-out infinite; }

/* Serving — arms forward */
@keyframes serveArms {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(-25deg); }
}
.character.serving .arm { animation: serveArms 0.6s ease-in-out; }
```

### Character Size Guide

| Context | Head | Body | Total Height | Touch Target |
|---------|------|------|-------------|--------------|
| Queue customer | 20px | 24×32 | ~56px | 48×72px |
| Worker behind counter | 16px | 20×28 | ~48px | — (not tappable) |
| Small NPC / distance | 12px | 16×20 | ~36px | — |
| Title screen / large | 28px | 32×40 | ~72px | — |

---

## 2. Environment Design

### Wall Techniques

```css
/* Basic painted wall */
.wall {
  background: linear-gradient(180deg, #D4B896 0%, #C8A87C 100%);
}

/* Wainscoting (lower panel trim) */
.wall::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 35%;
  background: linear-gradient(180deg, #B89468, #A8845C);
  border-top: 2px solid #96784E;
}

/* Wallpaper pattern */
.wall-premium {
  background:
    repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,215,0,0.03) 10px, rgba(255,215,0,0.03) 20px),
    linear-gradient(180deg, #E8D5B7, #D4C4A0);
}

/* Brick wall */
.wall-brick {
  background:
    repeating-linear-gradient(0deg, transparent, transparent 18px, #8B6914 18px, #8B6914 20px),
    repeating-linear-gradient(90deg, transparent, transparent 38px, #8B6914 38px, #8B6914 40px),
    #C8956E;
}
```

### Floor Techniques

```css
/* Wood floor with plank lines */
.floor-wood {
  background:
    repeating-linear-gradient(90deg, transparent, transparent 59px, rgba(0,0,0,0.08) 59px, rgba(0,0,0,0.08) 60px),
    linear-gradient(180deg, #B89468, #D4A87C);
}

/* Tile floor */
.floor-tile {
  background:
    repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(0,0,0,0.05) 39px, rgba(0,0,0,0.05) 40px),
    repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(0,0,0,0.05) 39px, rgba(0,0,0,0.05) 40px),
    linear-gradient(180deg, #C89B6E, #D4A87C);
}

/* Carpet (VIP/premium areas) */
.floor-carpet {
  background:
    repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(255,255,255,0.02) 4px, rgba(255,255,255,0.02) 8px),
    linear-gradient(180deg, #3D2A5C, #4E3872);
}

/* Depth gradient (darker at back, lighter at front) */
.floor::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0.15) 0%, transparent 100%);
  pointer-events: none;
}
```

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

```css
/* Menu board */
.menu-board {
  width: 80px; height: 50px;
  background: #2C1810;
  border-radius: 4px;
  border: 2px solid #5C3317;
  position: relative;
}
.menu-board-text {
  color: #FFF8F0;
  font-size: 8px;
  font-weight: 700;
  text-align: center;
  padding-top: 6px;
}

/* Wall clock */
.wall-clock {
  width: 24px; height: 24px;
  border-radius: 50%;
  background: #FFF;
  border: 2px solid #333;
  position: relative;
}
.clock-hand {
  position: absolute;
  bottom: 50%; left: 50%;
  width: 2px; height: 8px;
  background: #333;
  transform-origin: bottom center;
  /* Rotate based on timer: 0→360 degrees over game duration */
}

/* Potted plant */
.plant {
  position: relative;
}
.plant-pot {
  width: 14px; height: 10px;
  background: #A0522D;
  border-radius: 0 0 3px 3px;
}
.plant-leaves {
  width: 20px; height: 14px;
  background: radial-gradient(ellipse, #4CAF50, #2E7D32);
  border-radius: 50%;
  margin: -4px auto 0;
}

/* Framed picture */
.picture-frame {
  width: 24px; height: 18px;
  border: 2px solid #8B6914;
  background: linear-gradient(135deg, #87CEEB, #98D8C8);
  border-radius: 1px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
```

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

## 7. Art Checklist for PRD

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
