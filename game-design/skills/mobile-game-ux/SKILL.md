---
name: mobile-game-ux
description: >
  Mobile-first game development patterns for optimal user experience. Applied automatically
  when building browser games for mobile devices. Covers gesture controls, right-handed
  ergonomic design, full-screen layouts, clean UI principles, and touch-friendly interactions.
  ALWAYS prioritize user experience over cluttered information.
---

# Mobile Game UX Design Principles

This skill ensures all games are built with mobile-first, touch-friendly experiences that
prioritize clean UI and intuitive controls.

## Core Principles

### 1. Mobile-First, Always

- **ALWAYS** design for mobile viewport first, then scale up
- **ALWAYS** use full viewport width and height (`100vw`, `100dvh`)
- **NEVER** show scrollbars during gameplay
- **NEVER** rely on hover states for core functionality

### 2. Right-Handed Ergonomic Design

Since ~90% of users are right-handed and hold phones with right thumb accessible:

```
┌─────────────────────────────┐
│  Secondary    │   Primary   │
│  Controls     │   Controls  │
│  (Left 40%)   │  (Right 60%)│
│               │             │
│  - Settings   │  - Actions  │
│  - Info       │  - Submit   │
│  - Back       │  - Confirm  │
│  - Pause      │  - Next     │
│               │             │
└─────────────────────────────┘
```

**Right Side (Primary Zone)**:
- Main action buttons
- Frequently used controls
- Game interactions (tap, swipe targets)
- Submit/Confirm/Play buttons

**Left Side (Secondary Zone)**:
- Settings/Menu
- Info/Help
- Back/Exit
- Pause
- Less frequent actions

### 3. Gesture Controls Priority

**ALWAYS prefer gestures over buttons when possible:**

| Action | Gesture (Preferred) | Button (Fallback) |
|--------|---------------------|-------------------|
| Move | Swipe direction | Arrow buttons |
| Select | Tap | - |
| Cancel | Swipe down / Back gesture | X button |
| Confirm | Double-tap | Confirm button |
| Menu | Long press | Menu button |
| Restart | Shake / Pull down | Restart button |
| Zoom | Pinch | +/- buttons |

### 4. Clean UI Philosophy

**LESS IS MORE** - Remove everything that isn't essential during gameplay.

```
GOOD:                          BAD:
┌─────────────────────┐       ┌─────────────────────┐
│ Score: 1250    ⚙️   │       │ Score  Lives  Time  │
│                     │       │ 1250   ❤️❤️❤️  2:30  │
│                     │       │ Level: 5  XP: 450   │
│    GAME AREA        │       │ Combo: 3x  Best:2k  │
│    (Maximum         │       │                     │
│     space)          │       │   GAME AREA         │
│                     │       │   (Cramped)         │
│                     │       │                     │
│                     │       │ [Btn1][Btn2][Btn3]  │
└─────────────────────┘       │ [Btn4][Btn5][Btn6]  │
                              └─────────────────────┘
```

**Rules:**
- Show only score during gameplay (other stats on pause/game-over)
- Single settings icon (top-right for right-handers)
- No visible buttons during active gameplay if gestures work
- Use the ENTIRE screen for the game
- Reveal controls only when needed

### 5. Full-Screen Layout

```css
/* REQUIRED for all mobile games */
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100dvh; /* Dynamic viewport height for mobile */
  overflow: hidden;
  touch-action: manipulation; /* Disable double-tap zoom */
  -webkit-user-select: none;
  user-select: none;
}

.game-container {
  width: 100vw;
  height: 100dvh;
  position: fixed;
  top: 0;
  left: 0;
}
```

### 6. Touch Target Sizing

**Minimum touch targets: 44x44px (Apple) / 48x48dp (Google)**

```css
.touch-target {
  min-width: 48px;
  min-height: 48px;
  padding: 12px;
}

/* Spacing between touch targets */
.button-group {
  gap: 8px; /* Minimum 8px between targets */
}
```

### 7. Visual Feedback

Every touch MUST have immediate feedback:

```css
.interactive {
  transition: transform 0.1s ease, opacity 0.1s ease;
}

.interactive:active {
  transform: scale(0.95);
  opacity: 0.8;
}
```

---

## Implementation Patterns

### Viewport Meta Tag (Required)

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
```

### Safe Area Handling (Notch/Island)

```css
.game-ui {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

### Gesture Detection Setup

```javascript
// Basic swipe detection
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', (e) => {
  const deltaX = e.changedTouches[0].clientX - touchStartX;
  const deltaY = e.changedTouches[0].clientY - touchStartY;
  const threshold = 50;

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    if (deltaX > threshold) handleSwipe('right');
    else if (deltaX < -threshold) handleSwipe('left');
  } else {
    if (deltaY > threshold) handleSwipe('down');
    else if (deltaY < -threshold) handleSwipe('up');
  }
}, { passive: true });
```

### Prevent Unwanted Browser Behaviors

```javascript
// Prevent pull-to-refresh
document.body.addEventListener('touchmove', (e) => {
  if (e.touches.length === 1) {
    e.preventDefault();
  }
}, { passive: false });

// Prevent context menu on long press
document.addEventListener('contextmenu', (e) => e.preventDefault());

// Prevent double-tap zoom
let lastTap = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTap < 300) {
    e.preventDefault();
  }
  lastTap = now;
}, { passive: false });
```

### Orientation Handling

```javascript
// Lock to portrait or handle both
function handleOrientation() {
  const isLandscape = window.innerWidth > window.innerHeight;
  if (isLandscape) {
    // Option 1: Show rotate message
    showRotateMessage();
    // Option 2: Adapt layout for landscape
    // adaptToLandscape();
  }
}

window.addEventListener('resize', handleOrientation);
screen.orientation?.addEventListener('change', handleOrientation);
```

---

## UI Component Placement Guide

### Portrait Mode Layout

```
┌───────────────────────────────┐
│ ← Back              Score ⚙️  │  ← Top bar (minimal)
├───────────────────────────────┤
│                               │
│                               │
│                               │
│         GAME CANVAS           │  ← Maximum play area
│         (Touch zone)          │
│                               │
│                               │
│                               │
├───────────────────────────────┤
│        [Action Button]        │  ← Bottom (if needed)
└───────────────────────────────┘
    Right-thumb reachable zone
```

### Control Placement by Frequency

| Usage Frequency | Position | Examples |
|-----------------|----------|----------|
| Every second | Center/Right | Tap targets, swipe area |
| Every 10 seconds | Bottom-right | Action button |
| Every minute | Top-right | Settings, pause |
| Once per session | Top-left | Back, exit |

---

## Anti-Patterns (NEVER DO)

1. **NEVER** put primary actions on the left side
2. **NEVER** use tiny buttons (< 44px)
3. **NEVER** require precise tapping
4. **NEVER** show keyboard unless text input needed
5. **NEVER** use horizontal scroll during gameplay
6. **NEVER** block the screen with popups during action
7. **NEVER** rely solely on device orientation
8. **NEVER** use fixed pixel dimensions (use %, vw, vh, dvh)
9. **NEVER** forget touch feedback (visual + haptic)
10. **NEVER** clutter the game area with stats/buttons

---

## Testing Checklist

Before releasing any mobile game:

- [ ] Works on 320px width (iPhone SE)
- [ ] Works on 428px width (iPhone 14 Pro Max)
- [ ] Works with notch/dynamic island
- [ ] All touch targets >= 44px
- [ ] Primary controls reachable by right thumb
- [ ] Gestures work for main interactions
- [ ] No accidental zooming/scrolling
- [ ] Visual feedback on all touches
- [ ] Looks clean with minimal UI
- [ ] Full viewport used (no dead space)
- [ ] Works in portrait (and landscape if supported)
- [ ] No browser chrome interference
