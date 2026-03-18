---
name: performance-tuning
description: >
  Performance optimization patterns for browser games. Covers 60fps rendering,
  canvas optimization, memory management, and mobile performance. Essential for
  smooth gameplay on all devices.
---

# Performance Tuning for Browser Games

## Core Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Frame Rate | 60 FPS | 16.67ms per frame |
| Frame Budget | <12ms | Leave headroom for browser |
| Memory | <100MB | Avoid GC pauses |
| Load Time | <3s | First playable |
| Input Latency | <100ms | Touch to response |

---

## Game Loop Optimization

### Proper Game Loop Structure

```javascript
class GameLoop {
  constructor(update, render) {
    this.update = update;
    this.render = render;
    this.lastTime = 0;
    this.accumulator = 0;
    this.timestep = 1000 / 60; // Fixed 60 FPS logic
    this.running = false;
    this.frameId = null;
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.loop.bind(this));
  }

  stop() {
    this.running = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }
  }

  loop(currentTime) {
    if (!this.running) return;

    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;
    this.accumulator += deltaTime;

    // Fixed timestep for physics/logic
    while (this.accumulator >= this.timestep) {
      this.update(this.timestep);
      this.accumulator -= this.timestep;
    }

    // Variable timestep for rendering (interpolation possible)
    this.render(this.accumulator / this.timestep);

    this.frameId = requestAnimationFrame(this.loop.bind(this));
  }
}

// Usage
const game = new GameLoop(
  (dt) => updateGameLogic(dt),
  (interpolation) => renderGame(interpolation)
);
game.start();
```

### Frame Rate Monitor

```javascript
class FPSMonitor {
  constructor() {
    this.frames = [];
    this.lastTime = performance.now();
  }

  tick() {
    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;

    this.frames.push(delta);
    if (this.frames.length > 60) {
      this.frames.shift();
    }
  }

  getFPS() {
    if (this.frames.length === 0) return 0;
    const avg = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    return Math.round(1000 / avg);
  }

  getFrameTime() {
    if (this.frames.length === 0) return 0;
    return this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
  }
}
```

---

## Canvas Optimization

### Canvas Setup

```javascript
function createOptimizedCanvas(width, height) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', {
    alpha: false,         // Disable alpha if not needed
    desynchronized: true, // Reduce latency (experimental)
  });

  // Handle device pixel ratio
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.scale(dpr, dpr);

  // Disable image smoothing for pixel art
  ctx.imageSmoothingEnabled = false;

  return { canvas, ctx, dpr };
}
```

### Offscreen Canvas (Background Rendering)

```javascript
// Pre-render static elements
function createOffscreenBuffer(width, height, drawFn) {
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const offCtx = offscreen.getContext('2d');
  drawFn(offCtx);
  return offscreen;
}

// Usage - render grid once
const gridBuffer = createOffscreenBuffer(400, 400, (ctx) => {
  ctx.strokeStyle = '#333';
  for (let i = 0; i <= 10; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 40, 0);
    ctx.lineTo(i * 40, 400);
    ctx.moveTo(0, i * 40);
    ctx.lineTo(400, i * 40);
    ctx.stroke();
  }
});

// In render loop - just draw the buffer
function render(ctx) {
  ctx.drawImage(gridBuffer, 0, 0);
  // Draw dynamic elements on top
}
```

### Dirty Rectangle Rendering

```javascript
class DirtyRectRenderer {
  constructor(ctx, width, height) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.dirtyRects = [];
  }

  markDirty(x, y, w, h) {
    this.dirtyRects.push({ x, y, w, h });
  }

  render(drawFn) {
    if (this.dirtyRects.length === 0) return;

    // Merge overlapping rects
    const merged = this.mergeRects(this.dirtyRects);

    merged.forEach(rect => {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(rect.x, rect.y, rect.w, rect.h);
      this.ctx.clip();

      drawFn(this.ctx, rect);

      this.ctx.restore();
    });

    this.dirtyRects = [];
  }

  mergeRects(rects) {
    // Simplified - in production use proper rect merging
    return rects;
  }
}
```

### Sprite Batching

```javascript
class SpriteBatcher {
  constructor(ctx, spriteSheet) {
    this.ctx = ctx;
    this.spriteSheet = spriteSheet;
    this.batch = [];
  }

  add(srcX, srcY, srcW, srcH, destX, destY, destW, destH) {
    this.batch.push({ srcX, srcY, srcW, srcH, destX, destY, destW, destH });
  }

  flush() {
    // Sort by texture (already same texture here)
    // Draw all in one go
    this.batch.forEach(sprite => {
      this.ctx.drawImage(
        this.spriteSheet,
        sprite.srcX, sprite.srcY, sprite.srcW, sprite.srcH,
        sprite.destX, sprite.destY, sprite.destW, sprite.destH
      );
    });
    this.batch = [];
  }
}
```

---

## Memory Management

### Object Pooling

```javascript
class ObjectPool {
  constructor(createFn, resetFn, initialSize = 10) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.pool = [];
    this.active = [];

    // Pre-allocate
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
    }
  }

  get() {
    let obj = this.pool.pop();
    if (!obj) {
      obj = this.createFn();
    }
    this.active.push(obj);
    return obj;
  }

  release(obj) {
    const index = this.active.indexOf(obj);
    if (index > -1) {
      this.active.splice(index, 1);
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }

  releaseAll() {
    while (this.active.length > 0) {
      const obj = this.active.pop();
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }
}

// Usage - particle pool
const particlePool = new ObjectPool(
  () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0 }),
  (p) => { p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; p.life = 0; },
  100
);

function spawnParticle(x, y) {
  const p = particlePool.get();
  p.x = x;
  p.y = y;
  p.vx = Math.random() * 4 - 2;
  p.vy = Math.random() * -4;
  p.life = 60;
  return p;
}
```

### Avoid Garbage Collection

```javascript
// BAD - Creates garbage every frame
function update() {
  const velocity = { x: 0, y: 0 }; // New object each frame!
  velocity.x = player.vx;
  velocity.y = player.vy;
}

// GOOD - Reuse objects
const tempVec = { x: 0, y: 0 };
function update() {
  tempVec.x = player.vx;
  tempVec.y = player.vy;
}

// BAD - Array methods create new arrays
const activeEnemies = enemies.filter(e => e.alive);

// GOOD - Modify in place
let activeCount = 0;
for (let i = 0; i < enemies.length; i++) {
  if (enemies[i].alive) {
    enemies[activeCount++] = enemies[i];
  }
}
enemies.length = activeCount;
```

### Memory Monitoring

```javascript
function getMemoryUsage() {
  if (performance.memory) {
    return {
      used: Math.round(performance.memory.usedJSHeapSize / 1048576),
      total: Math.round(performance.memory.totalJSHeapSize / 1048576),
      limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
    };
  }
  return null;
}
```

---

## Mobile Optimization

### Touch Event Optimization

```javascript
// Use passive listeners when not preventing default
document.addEventListener('touchmove', handleMove, { passive: true });

// Only use non-passive when needed
document.addEventListener('touchmove', (e) => {
  e.preventDefault(); // Prevent scroll
  handleMove(e);
}, { passive: false });
```

### Reduce Draw Calls

```javascript
// BAD - Multiple draw calls
tiles.forEach(tile => {
  ctx.fillStyle = tile.color;
  ctx.fillRect(tile.x, tile.y, tile.w, tile.h);
});

// GOOD - Batch by color
const tilesByColor = {};
tiles.forEach(tile => {
  if (!tilesByColor[tile.color]) {
    tilesByColor[tile.color] = [];
  }
  tilesByColor[tile.color].push(tile);
});

Object.entries(tilesByColor).forEach(([color, colorTiles]) => {
  ctx.fillStyle = color;
  colorTiles.forEach(tile => {
    ctx.fillRect(tile.x, tile.y, tile.w, tile.h);
  });
});
```

### Throttle Expensive Operations

```javascript
function throttle(fn, limit) {
  let lastRun = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastRun >= limit) {
      lastRun = now;
      fn.apply(this, args);
    }
  };
}

// Throttle collision detection
const checkCollisions = throttle(() => {
  // Expensive collision checks
}, 50); // Max 20 times per second
```

### Reduce Resolution on Low-End Devices

```javascript
function detectPerformanceTier() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl');

  if (!gl) return 'low';

  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  if (debugInfo) {
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    // Check for known low-end GPUs
    if (renderer.includes('Mali-4') || renderer.includes('Adreno 3')) {
      return 'low';
    }
  }

  // Check device memory
  if (navigator.deviceMemory && navigator.deviceMemory < 4) {
    return 'low';
  }

  return 'high';
}

// Adjust quality based on tier
const tier = detectPerformanceTier();
const QUALITY = {
  high: { dpr: 2, particles: 100, shadows: true },
  low: { dpr: 1, particles: 30, shadows: false }
}[tier];
```

---

## Performance Checklist

### Before Launch

- [ ] Maintain 60 FPS on target devices
- [ ] No memory leaks (heap doesn't grow indefinitely)
- [ ] Load time under 3 seconds
- [ ] Touch response under 100ms
- [ ] No jank during gameplay
- [ ] Tested on low-end devices

### Common Issues

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Stuttering | GC pauses | Object pooling |
| Slow render | Too many draw calls | Batch rendering |
| Memory growth | Event listener leaks | Remove listeners |
| Slow touch | Non-passive listeners | Use passive |
| Choppy animations | Layout thrashing | Use transform only |

### Profiling Tools

```javascript
// Mark performance timeline
performance.mark('update-start');
update();
performance.mark('update-end');
performance.measure('update', 'update-start', 'update-end');

// Log slow frames
let lastFrameTime = performance.now();
function checkFrameTime() {
  const now = performance.now();
  const delta = now - lastFrameTime;
  if (delta > 20) { // Slower than 50fps
    console.warn(`Slow frame: ${delta.toFixed(1)}ms`);
  }
  lastFrameTime = now;
  requestAnimationFrame(checkFrameTime);
}
```
