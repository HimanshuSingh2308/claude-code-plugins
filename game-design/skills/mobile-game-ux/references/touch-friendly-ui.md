# Touch-Friendly UI Components

## Core Principles

1. **Minimum touch target**: 44x44px (iOS) / 48x48dp (Android)
2. **Spacing between targets**: Minimum 8px
3. **Visual feedback**: Every touch must have immediate response
4. **Right-hand priority**: Primary actions on right side

---

## Button Components

### Primary Action Button (Right Side)

```css
.btn-primary {
  /* Size */
  min-width: 48px;
  min-height: 48px;
  padding: 12px 24px;

  /* Visual */
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  border: none;
  border-radius: 12px;
  color: white;
  font-size: var(--font-md);
  font-weight: 600;

  /* Touch feedback */
  transition: transform 0.1s ease, box-shadow 0.1s ease;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  user-select: none;

  /* Accessibility */
  cursor: pointer;
}

.btn-primary:active {
  transform: scale(0.95);
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

/* Disabled state */
.btn-primary:disabled {
  opacity: 0.5;
  pointer-events: none;
}
```

### Icon Button (Settings, Back)

```css
.btn-icon {
  /* Exact touch target size */
  width: 48px;
  height: 48px;
  padding: 12px;

  /* Visual */
  background: rgba(255,255,255,0.1);
  border: none;
  border-radius: 50%;
  color: white;

  /* Center icon */
  display: flex;
  align-items: center;
  justify-content: center;

  /* Touch */
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  transition: transform 0.1s, background 0.1s;
}

.btn-icon:active {
  transform: scale(0.9);
  background: rgba(255,255,255,0.2);
}

.btn-icon svg,
.btn-icon img {
  width: 24px;
  height: 24px;
}
```

### Floating Action Button (Bottom-Right)

```css
.fab {
  position: fixed;
  bottom: max(24px, env(safe-area-inset-bottom) + 16px);
  right: max(24px, env(safe-area-inset-right) + 16px);

  width: 56px;
  height: 56px;

  background: var(--accent);
  border: none;
  border-radius: 50%;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);

  display: flex;
  align-items: center;
  justify-content: center;

  transition: transform 0.15s, box-shadow 0.15s;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  z-index: 100;
}

.fab:active {
  transform: scale(0.9);
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
}

.fab svg {
  width: 28px;
  height: 28px;
  color: white;
}
```

---

## Game HUD Layout

### Minimal Top Bar (Right-Aligned Controls)

```html
<header class="game-hud-top">
  <div class="hud-left">
    <button class="btn-icon btn-back" aria-label="Back">
      <svg><!-- back icon --></svg>
    </button>
  </div>
  <div class="hud-center">
    <span class="score">1250</span>
  </div>
  <div class="hud-right">
    <button class="btn-icon btn-settings" aria-label="Settings">
      <svg><!-- settings icon --></svg>
    </button>
  </div>
</header>
```

```css
.game-hud-top {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: max(8px, env(safe-area-inset-top)) 16px 8px;
  background: linear-gradient(to bottom, rgba(0,0,0,0.5), transparent);
  pointer-events: none;
  z-index: 50;
}

.game-hud-top > * {
  pointer-events: auto;
}

.hud-left,
.hud-right {
  flex: 0 0 48px;
}

.hud-center {
  flex: 1 1 auto;
  text-align: center;
}

.score {
  font-size: var(--font-xl);
  font-weight: 700;
  color: white;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}
```

---

## Modal / Popup (Game Over, Pause)

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.8);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 200;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
}

.modal-overlay.active {
  opacity: 1;
  visibility: visible;
}

.modal-content {
  width: 100%;
  max-width: 320px;
  background: var(--surface);
  border-radius: 24px;
  padding: 32px 24px;
  text-align: center;
  transform: scale(0.9);
  transition: transform 0.2s;
}

.modal-overlay.active .modal-content {
  transform: scale(1);
}

.modal-title {
  font-size: var(--font-2xl);
  font-weight: 700;
  margin-bottom: 8px;
}

.modal-score {
  font-size: var(--font-3xl);
  font-weight: 800;
  color: var(--accent);
  margin: 16px 0;
}

.modal-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
}

/* Primary action is larger and more prominent */
.modal-actions .btn-primary {
  width: 100%;
  padding: 16px;
  font-size: var(--font-lg);
}

/* Secondary action is smaller */
.modal-actions .btn-secondary {
  width: 100%;
  padding: 12px;
  background: transparent;
  border: 2px solid rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.7);
}
```

```html
<div class="modal-overlay" id="gameOverModal">
  <div class="modal-content">
    <h2 class="modal-title">Game Over</h2>
    <div class="modal-score">1,250</div>
    <p class="modal-subtitle">New High Score!</p>
    <div class="modal-actions">
      <button class="btn-primary" onclick="restartGame()">
        Play Again
      </button>
      <button class="btn-secondary" onclick="goHome()">
        Home
      </button>
    </div>
  </div>
</div>
```

---

## Touch Feedback System

### Visual Feedback

```css
/* Ripple effect */
.touch-ripple {
  position: relative;
  overflow: hidden;
}

.touch-ripple::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%);
  transform: scale(0);
  opacity: 0;
  transition: transform 0.3s, opacity 0.3s;
}

.touch-ripple:active::after {
  transform: scale(2);
  opacity: 1;
  transition: none;
}

/* Scale feedback */
.touch-scale {
  transition: transform 0.1s ease;
}

.touch-scale:active {
  transform: scale(0.95);
}

/* Glow feedback */
.touch-glow {
  transition: box-shadow 0.1s ease;
}

.touch-glow:active {
  box-shadow: 0 0 20px var(--accent);
}
```

### Haptic Feedback (Vibration)

```javascript
function haptic(type = 'light') {
  if (!navigator.vibrate) return;

  const patterns = {
    light: [10],
    medium: [20],
    heavy: [30],
    success: [10, 50, 10],
    error: [50, 30, 50],
    selection: [5]
  };

  navigator.vibrate(patterns[type] || patterns.light);
}

// Usage
button.addEventListener('touchstart', () => haptic('light'));
submitButton.addEventListener('click', () => haptic('success'));
errorOccurred && haptic('error');
```

---

## Keyboard (Virtual)

```html
<div class="keyboard">
  <div class="keyboard-row">
    <button class="key" data-key="Q">Q</button>
    <button class="key" data-key="W">W</button>
    <!-- ... -->
  </div>
  <div class="keyboard-row">
    <button class="key" data-key="A">A</button>
    <!-- ... -->
  </div>
  <div class="keyboard-row">
    <button class="key key-wide" data-key="ENTER">Enter</button>
    <!-- ... -->
    <button class="key key-wide" data-key="BACK">⌫</button>
  </div>
</div>
```

```css
.keyboard {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  max-width: 500px;
  margin: 0 auto;
}

.keyboard-row {
  display: flex;
  justify-content: center;
  gap: 6px;
}

.key {
  min-width: 32px;
  height: 52px;
  padding: 0 12px;

  background: var(--key-bg, #818384);
  border: none;
  border-radius: 4px;
  color: white;
  font-size: var(--font-md);
  font-weight: 600;

  display: flex;
  align-items: center;
  justify-content: center;

  transition: transform 0.05s, background 0.1s;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.key:active {
  transform: scale(0.95);
}

.key-wide {
  min-width: 65px;
  font-size: var(--font-sm);
}

/* State colors */
.key.correct { background: var(--correct, #538d4e); }
.key.present { background: var(--present, #b59f3b); }
.key.absent { background: var(--absent, #3a3a3c); }
```

---

## Swipe Indicators

```html
<div class="swipe-hint">
  <span class="swipe-arrow left">←</span>
  <span class="swipe-text">Swipe to play</span>
  <span class="swipe-arrow right">→</span>
</div>
```

```css
.swipe-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  color: rgba(255,255,255,0.5);
  animation: fadeInOut 2s ease-in-out infinite;
}

.swipe-arrow {
  font-size: 24px;
  animation: bounce 1s ease-in-out infinite;
}

.swipe-arrow.left {
  animation-delay: 0s;
}

.swipe-arrow.right {
  animation-delay: 0.5s;
}

@keyframes bounce {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(8px); }
}

.swipe-arrow.left {
  @keyframes bounce {
    50% { transform: translateX(-8px); }
  }
}

@keyframes fadeInOut {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.7; }
}
```

---

## Score Display with Animation

```html
<div class="score-display">
  <span class="score-label">Score</span>
  <span class="score-value" id="score">0</span>
</div>
```

```css
.score-display {
  text-align: center;
}

.score-label {
  display: block;
  font-size: var(--font-sm);
  color: rgba(255,255,255,0.6);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.score-value {
  display: block;
  font-size: var(--font-2xl);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: white;
  transition: transform 0.15s, color 0.15s;
}

.score-value.bump {
  transform: scale(1.2);
  color: var(--accent);
}
```

```javascript
function updateScore(newScore) {
  const el = document.getElementById('score');
  el.textContent = newScore.toLocaleString();
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 150);
}
```

---

## Progress Bar (Lives, Timer)

```css
.progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(255,255,255,0.1);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 4px;
  transition: width 0.3s ease;
}

/* Color states */
.progress-fill.warning { background: var(--warning, #f59e0b); }
.progress-fill.danger { background: var(--danger, #ef4444); }
```

---

## Empty States

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-state .icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state .title {
  font-size: var(--font-lg);
  font-weight: 600;
  margin-bottom: 8px;
}

.empty-state .description {
  font-size: var(--font-md);
  color: rgba(255,255,255,0.6);
  max-width: 280px;
}
```

---

## Loading States

```css
.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Skeleton loading for game tiles */
.skeleton {
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0.05) 0%,
    rgba(255,255,255,0.1) 50%,
    rgba(255,255,255,0.05) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```
