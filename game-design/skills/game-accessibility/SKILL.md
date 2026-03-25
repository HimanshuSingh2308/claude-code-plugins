---
name: game-accessibility
description: >
  Accessibility patterns for browser games. Covers reduced motion, color contrast,
  cognitive accessibility, alternative inputs, screen reader hints, and inclusive
  game design. Applied when building any browser game to ensure it's playable by
  the widest possible audience. Not just compliance — good accessibility is good design.
---

# Game Accessibility

## Core Principle: Accessibility Expands Your Audience

15-20% of people have some form of disability. Even more have situational impairments (bright sunlight, one hand busy, noisy environment). Accessible games serve MORE players, not fewer.

---

## 1. Motor Accessibility

### Touch Target Sizes

| Element | Minimum Size | Recommended | Spacing |
|---------|-------------|-------------|---------|
| Primary game action | 44×44px | 48×48px | 8px gap |
| Menu buttons | 44×44px | 48×48px | 8px gap |
| Close/dismiss | 44×44px | 44×44px | — |
| Secondary actions | 36×36px | 44×44px | 4px gap |

```css
/* Ensure all interactive elements meet minimums */
button, a, [role="button"], .tappable {
  min-width: 44px;
  min-height: 44px;
}
```

### Timing Flexibility

Not everyone can react quickly. Consider:

```javascript
// Accessibility option: Relaxed Mode
const TIMING_MODES = {
  normal: { patienceMultiplier: 1.0, spawnMultiplier: 1.0 },
  relaxed: { patienceMultiplier: 1.5, spawnMultiplier: 1.3 }, // 50% more patience, 30% slower spawns
};
```

- Offer a "Relaxed Mode" toggle in settings
- Don't penalize score for using it (or have a separate leaderboard)
- Auto-suggest relaxed mode if player fails 3+ days in a row

### One-Handed Play

Many players use one hand (holding phone, disability, multitasking):

- All gameplay should work with single thumb
- Place primary actions in the bottom 60% of screen (thumb-reachable)
- Avoid simultaneous multi-touch requirements
- Avoid drag-and-drop for core gameplay (tap-to-select is more accessible)

### No Rapid Inputs Required

- Core gameplay should never require rapid consecutive taps (> 3 per second)
- If rapid tapping gives bonus, it should be optional, not required
- Auto-serve mechanics help players who can't tap quickly

---

## 2. Visual Accessibility

### Color Contrast

WCAG AA requires 4.5:1 contrast ratio for normal text, 3:1 for large text.

| Element | Good | Bad |
|---------|------|-----|
| Text on dark bg | `#EEEEEE` on `#333333` (14:1) | `#888888` on `#333333` (3.5:1) |
| Text on light bg | `#333333` on `#FFFFFF` (12.6:1) | `#999999` on `#FFFFFF` (2.8:1) |
| Score text | `#FFD700` on `#5C3D2E` (5.2:1) | `#FFD700` on `#FFF8F0` (1.5:1) |

**Tool**: Use `color-contrast()` or test at https://webaim.org/resources/contrastchecker/

### Color Is Never the Only Indicator

If color communicates state, ALWAYS add a second signal:

| State | Color Only (Bad) | Color + Shape/Text (Good) |
|-------|-----------------|--------------------------|
| Patience high | Green bar | Green bar + full width |
| Patience low | Red bar | Red bar + thin width + pulse animation |
| Affordable | Green button | Green button + price visible |
| Too expensive | Gray button | Gray button + 🔒 + "Need X more" |
| Combo active | Orange text | Orange text + "🔥 x2.3" + pulse |
| Error/angry | Red character | Red character + 😤 emoji + shake |

### Colorblind-Safe Palette

~8% of men are colorblind. Avoid red-green as the only distinction.

| Instead of | Use |
|------------|-----|
| Red vs Green | Red vs Blue, or Red vs Green + icons/shapes |
| Green = good, Red = bad | Use shapes: ✓ = good, ✗ = bad |
| Color-coded characters | Color + accessory (hat, tie, backpack) |

### Text Readability

```css
/* Minimum sizes */
.game-text { font-size: 14px; } /* minimum for game UI */
.score-text { font-size: 16px; font-weight: 700; } /* important numbers */
.hud-text { font-size: 12px; } /* minimum for status info */

/* Readable font stack */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

/* Text shadow for readability over variable backgrounds */
.overlay-text {
  text-shadow: 0 1px 3px rgba(0,0,0,0.5);
}
```

---

## 3. Motion & Animation Accessibility

### Respect prefers-reduced-motion

This is NON-NEGOTIABLE. Always include:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### What to Keep vs Remove

| With Motion | Without Motion | Why Keep/Remove |
|-------------|---------------|-----------------|
| Walking bob animation | Static slide movement | Remove — decorative |
| Coin float particles | Instant score update | Remove — decorative |
| Serve progress ring fill | Instant completion with checkmark | Simplify — functional |
| Patience bar smooth drain | Stepped bar drain (jumps) | Simplify — functional |
| Screen shake | No shake | Remove — can trigger vestibular issues |
| Confetti celebration | Static "🎉 New Best!" text | Remove — decorative |
| Combo pulse animation | Bold text only | Remove — decorative |

### Avoid Seizure Triggers

- No flashing faster than 3 times per second
- No large areas of rapidly changing contrast
- No strobing effects
- Screen shake should be subtle (< 5px displacement, < 0.5s duration)

---

## 4. Cognitive Accessibility

### Information Hierarchy

Show information in order of importance. Don't overwhelm.

```
CRITICAL (always visible):
├── Score / currency
├── Timer
└── Current action feedback

IMPORTANT (visible but secondary):
├── Combo streak
├── Day/level number
└── Best score comparison

AVAILABLE ON DEMAND (hidden until needed):
├── Detailed stats
├── Achievement progress
└── Upgrade details
```

### Reduce Cognitive Load

| Principle | Implementation |
|-----------|---------------|
| **One thing at a time** | Introduce one mechanic per level/day |
| **Consistent patterns** | Same button always does the same thing |
| **Recognition over recall** | Show options, don't require memorization |
| **Forgiving** | Undo button, retry without penalty, save progress |
| **Clear state** | Player always knows: what to do, score, time left |

### Tutorial Design for Cognitive Accessibility

```
DO:
- Show, don't tell (visual demo > text explanation)
- One concept at a time
- Let player try before explaining more
- Auto-dismiss or "Got it" button
- Can be replayed from settings

DON'T:
- Wall of text explaining all mechanics
- Quiz-style "tap the correct thing"
- Unskippable multi-step tutorial
- Explain things the player hasn't seen yet
```

---

## 5. Audio Accessibility

### Sound Is Never Required

The game must be fully playable with sound OFF:

| Audio Cue | Visual Equivalent |
|-----------|-------------------|
| Serve "ding" | Coin pop animation + "+$X" text |
| Angry customer buzzer | Red flash + 😤 emoji + shake |
| Combo up sound | Number increase + color change + pulse |
| Rush Hour alert | Banner + flashing border |
| Timer warning beep | Timer text turns red + pulse |

### Sound Toggle

```javascript
// Sound must be toggleable and persistent
const isMuted = localStorage.getItem('tt_muted') === 'true';

// Toggle button always visible
<button class="icon-btn" id="soundToggle" aria-label="Toggle sound">
  ${isMuted ? '🔇' : '🔊'}
</button>
```

### Volume Control

If the game has background music or frequent sounds, offer volume control:

```javascript
const masterVolume = parseFloat(localStorage.getItem('tt_volume') || '0.5');
// Range: 0.0 (silent) to 1.0 (full)
```

---

## 6. Screen Reader & Semantic HTML

Even for visual games, basic screen reader support helps:

### Landmarks

```html
<header role="banner">Game title, navigation</header>
<main role="main">Game area</main>
<div role="status" aria-live="polite">Score: 450</div>
<div role="alert" aria-live="assertive">New Personal Best!</div>
```

### ARIA Labels

```html
<button aria-label="Toggle sound" class="icon-btn">🔊</button>
<button aria-label="Go back to home page" class="back-btn">←</button>
<button aria-label="Sign in with Google" class="auth-btn">Sign In</button>
<div role="timer" aria-label="Time remaining: 0:45">0:45</div>
<div role="status" aria-label="Score: 450 coins">💰 450</div>
```

### Game State Announcements

```javascript
// Announce major events to screen readers
function announceToSR(message) {
  const el = document.getElementById('srAnnounce');
  el.textContent = message;
}

// Usage
announceToSR('Day 5 started');
announceToSR('Customer served. Earned 25 coins. Combo x3.');
announceToSR('Day complete. Revenue: 450 coins. New personal best!');
```

```html
<div id="srAnnounce" role="status" aria-live="polite" class="sr-only"></div>

<style>
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
  border: 0;
}
</style>
```

---

## 7. Settings & Customization

Offer an accessible settings panel:

```
## Accessibility Settings

[ ] Relaxed Mode (slower pace, more forgiving)
[slider] Sound Volume (0-100%)
[ ] Mute All Sound
[ ] High Contrast Mode
[ ] Larger Text
[ ] Reduce Motion (follows system preference by default)
```

### High Contrast Mode

```css
.high-contrast {
  --bg: #000000;
  --text: #FFFFFF;
  --accent: #FFFF00;
  --success: #00FF00;
  --danger: #FF0000;
  --border: #FFFFFF;
}

.high-contrast .game-element {
  border: 2px solid var(--border);
}
```

---

## 8. Testing Accessibility

### Manual Tests

```
[ ] Play entire game with sound OFF — still fun and understandable?
[ ] Play with prefers-reduced-motion ON — game still functional?
[ ] Play at 320px width — everything visible and tappable?
[ ] Navigate with keyboard (Tab, Enter, Escape) — can you access everything?
[ ] Check all text contrast with a contrast checker tool
[ ] Use Lighthouse accessibility audit (Chrome DevTools → Lighthouse → Accessibility)
[ ] Use colorblind simulator (Chrome DevTools → Rendering → Emulate vision deficiency)
[ ] Check with VoiceOver (Mac) or TalkBack (Android) — major elements announced?
```

### Automated Tests (Lighthouse)

Target score: **90+ on Lighthouse Accessibility**

Common issues caught:
- Missing alt text on images
- Missing button labels
- Low contrast text
- Missing lang attribute
- Interactive elements without accessible names

---

## 9. Accessibility Checklist for PRD

```
[ ] Touch targets >= 44px for all interactive elements
[ ] Color is never the only indicator of state
[ ] prefers-reduced-motion media query disables decorative animations
[ ] Game is fully playable with sound OFF
[ ] Sound toggle is visible and persists across sessions
[ ] Text meets WCAG AA contrast (4.5:1 for normal, 3:1 for large)
[ ] One-handed play is possible for core gameplay
[ ] No rapid input requirements for core mechanics
[ ] Tutorial is short, visual, and skippable
[ ] Major game events have ARIA announcements
[ ] Settings include: volume, mute, and optionally relaxed mode
[ ] Tested with reduced-motion, colorblind simulation, and keyboard navigation
```
