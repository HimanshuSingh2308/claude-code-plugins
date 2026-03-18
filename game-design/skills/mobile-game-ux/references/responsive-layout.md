# Responsive Layout Patterns for Mobile Games

## Full-Screen Game Container

```css
/* Base reset for full-screen games */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  height: 100%;
  overflow: hidden;
}

body {
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
  -webkit-overflow-scrolling: none;
}

.game-wrapper {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100dvh; /* Dynamic viewport height */
  overflow: hidden;
  background: var(--game-bg, #1a1a2e);
}

/* Fallback for browsers without dvh support */
@supports not (height: 100dvh) {
  .game-wrapper {
    height: 100vh;
    height: calc(var(--vh, 1vh) * 100);
  }
}
```

### Dynamic Viewport Height Fix

```javascript
// Fix for mobile browser chrome (address bar)
function setViewportHeight() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

setViewportHeight();
window.addEventListener('resize', setViewportHeight);
window.addEventListener('orientationchange', () => {
  setTimeout(setViewportHeight, 100);
});
```

---

## Safe Area Handling

```css
/* Account for notch, dynamic island, home indicator */
.game-ui {
  /* Top UI (score, settings) */
  padding-top: max(12px, env(safe-area-inset-top));

  /* Bottom UI (controls) */
  padding-bottom: max(12px, env(safe-area-inset-bottom));

  /* Side margins */
  padding-left: max(8px, env(safe-area-inset-left));
  padding-right: max(8px, env(safe-area-inset-right));
}

/* Full-bleed game canvas with safe UI overlay */
.game-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.game-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.game-hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  padding: env(safe-area-inset-top) env(safe-area-inset-right)
           env(safe-area-inset-bottom) env(safe-area-inset-left);
}

.game-hud > * {
  pointer-events: auto;
}
```

---

## Responsive Grid for Different Screen Sizes

```css
/* Grid-based game board that scales to fit */
.game-board {
  --columns: 4;
  --gap: 8px;
  --max-size: min(100vw - 32px, 100dvh - 200px, 500px);

  display: grid;
  grid-template-columns: repeat(var(--columns), 1fr);
  gap: var(--gap);
  width: var(--max-size);
  height: var(--max-size);
  margin: auto;
}

.game-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Responsive adjustments */
@media (max-width: 350px) {
  .game-board {
    --gap: 4px;
  }
}

@media (min-aspect-ratio: 1/1) {
  /* Landscape: constrain by height */
  .game-board {
    --max-size: min(70dvh, 100vw - 32px, 500px);
  }
}
```

---

## Flexible Typography

```css
:root {
  /* Fluid typography that scales with viewport */
  --font-xs: clamp(0.625rem, 2.5vw, 0.75rem);   /* 10-12px */
  --font-sm: clamp(0.75rem, 3vw, 0.875rem);      /* 12-14px */
  --font-md: clamp(0.875rem, 3.5vw, 1rem);       /* 14-16px */
  --font-lg: clamp(1rem, 4vw, 1.25rem);          /* 16-20px */
  --font-xl: clamp(1.25rem, 5vw, 1.75rem);       /* 20-28px */
  --font-2xl: clamp(1.5rem, 6vw, 2.5rem);        /* 24-40px */
  --font-3xl: clamp(2rem, 8vw, 4rem);            /* 32-64px */
}

.score {
  font-size: var(--font-xl);
  font-weight: 700;
}

.score-value {
  font-size: var(--font-2xl);
  font-variant-numeric: tabular-nums;
}

.game-title {
  font-size: var(--font-3xl);
}

.button-text {
  font-size: var(--font-md);
}
```

---

## Portrait vs Landscape Layouts

```css
/* Portrait (default) */
.game-layout {
  display: flex;
  flex-direction: column;
  height: 100dvh;
}

.game-header {
  flex: 0 0 auto;
  padding: max(8px, env(safe-area-inset-top)) 16px 8px;
}

.game-main {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.game-footer {
  flex: 0 0 auto;
  padding: 8px 16px max(16px, env(safe-area-inset-bottom));
}

/* Landscape */
@media (orientation: landscape) {
  .game-layout {
    flex-direction: row;
  }

  .game-header {
    flex: 0 0 auto;
    width: 120px;
    padding: 16px max(8px, env(safe-area-inset-left));
    flex-direction: column;
  }

  .game-main {
    flex: 1 1 auto;
  }

  .game-footer {
    flex: 0 0 auto;
    width: 120px;
    padding: 16px max(8px, env(safe-area-inset-right));
    flex-direction: column;
  }
}
```

---

## Canvas Scaling

```javascript
class ResponsiveCanvas {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.baseWidth = options.baseWidth || 400;
    this.baseHeight = options.baseHeight || 600;
    this.maxPixelRatio = options.maxPixelRatio || 2;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const container = this.canvas.parentElement;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Calculate scale to fit while maintaining aspect ratio
    const scaleX = containerWidth / this.baseWidth;
    const scaleY = containerHeight / this.baseHeight;
    const scale = Math.min(scaleX, scaleY);

    // Calculate actual canvas size
    const width = Math.floor(this.baseWidth * scale);
    const height = Math.floor(this.baseHeight * scale);

    // Account for device pixel ratio (capped for performance)
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);

    // Set canvas dimensions
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;

    // Set display size
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Scale context
    this.ctx.scale(dpr, dpr);

    // Store for game logic
    this.displayWidth = width;
    this.displayHeight = height;
    this.scale = scale;

    // Trigger redraw
    this.onResize?.(width, height, scale);
  }

  // Convert touch coordinates to game coordinates
  touchToGame(touchX, touchY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (touchX - rect.left) / this.scale,
      y: (touchY - rect.top) / this.scale
    };
  }
}

// Usage
const gameCanvas = new ResponsiveCanvas(document.getElementById('game'), {
  baseWidth: 400,
  baseHeight: 600
});

gameCanvas.onResize = (width, height, scale) => {
  game.redraw();
};
```

---

## Grid Cell Sizing

```javascript
function calculateGridLayout(containerWidth, containerHeight, columns, rows) {
  const padding = 16;
  const gap = 8;

  const availableWidth = containerWidth - (padding * 2) - (gap * (columns - 1));
  const availableHeight = containerHeight - (padding * 2) - (gap * (rows - 1));

  const cellWidth = Math.floor(availableWidth / columns);
  const cellHeight = Math.floor(availableHeight / rows);

  // Use smaller dimension for square cells
  const cellSize = Math.min(cellWidth, cellHeight);

  // Calculate actual grid size
  const gridWidth = (cellSize * columns) + (gap * (columns - 1));
  const gridHeight = (cellSize * rows) + (gap * (rows - 1));

  // Center offset
  const offsetX = Math.floor((containerWidth - gridWidth) / 2);
  const offsetY = Math.floor((containerHeight - gridHeight) / 2);

  return { cellSize, gap, offsetX, offsetY, gridWidth, gridHeight };
}
```

---

## Orientation Lock Message

```css
.orientation-message {
  display: none;
  position: fixed;
  inset: 0;
  background: var(--game-bg);
  z-index: 9999;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px;
}

.orientation-message .icon {
  font-size: 64px;
  animation: rotate 1.5s ease-in-out infinite;
}

@keyframes rotate {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(90deg); }
}

/* Show in landscape if game requires portrait */
@media (orientation: landscape) {
  .portrait-only .orientation-message {
    display: flex;
  }

  .portrait-only .game-container {
    display: none;
  }
}

/* Show in portrait if game requires landscape */
@media (orientation: portrait) {
  .landscape-only .orientation-message {
    display: flex;
  }

  .landscape-only .game-container {
    display: none;
  }
}
```

```html
<div class="orientation-message">
  <span class="icon">📱</span>
  <h2>Please Rotate Your Device</h2>
  <p>This game is best played in portrait mode</p>
</div>
```

---

## Screen Size Breakpoints

```css
/* Extra small phones (iPhone SE, etc.) */
@media (max-width: 350px) {
  :root {
    --ui-scale: 0.85;
  }
}

/* Small phones */
@media (min-width: 351px) and (max-width: 390px) {
  :root {
    --ui-scale: 0.9;
  }
}

/* Standard phones */
@media (min-width: 391px) and (max-width: 430px) {
  :root {
    --ui-scale: 1;
  }
}

/* Large phones / Small tablets */
@media (min-width: 431px) and (max-width: 768px) {
  :root {
    --ui-scale: 1.1;
  }
}

/* Tablets and above */
@media (min-width: 769px) {
  :root {
    --ui-scale: 1.2;
  }

  .game-wrapper {
    max-width: 500px;
    max-height: 900px;
    margin: auto;
    border-radius: 24px;
    box-shadow: 0 0 60px rgba(0,0,0,0.3);
  }
}
```
