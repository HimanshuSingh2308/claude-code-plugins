---
name: animation-patterns
description: >
  CSS and JavaScript animation patterns for browser games. Covers transitions,
  keyframe animations, particle effects, screen shake, and "juice" - the polish
  that makes games feel satisfying. Focus on 60fps performance.
---

# Animation Patterns for Browser Games

## Core Principles

1. **60fps or nothing**: Animations must be smooth
2. **GPU-accelerated**: Use transform/opacity, avoid layout triggers
3. **Purposeful**: Every animation reinforces gameplay feedback
4. **Responsive**: Reduce motion for users who prefer it

---

## CSS Animation Fundamentals

### GPU-Accelerated Properties (USE THESE)

```css
/* GOOD - GPU accelerated */
.animated {
  transform: translateX(100px);
  transform: scale(1.2);
  transform: rotate(45deg);
  opacity: 0.5;
  filter: blur(5px);
}

/* BAD - Triggers layout/paint */
.slow {
  left: 100px;      /* Triggers layout */
  width: 200px;     /* Triggers layout */
  background: red;  /* Triggers paint */
  box-shadow: ...;  /* Triggers paint */
}
```

### Force GPU Layer

```css
.gpu-layer {
  will-change: transform;
  transform: translateZ(0); /* Fallback for older browsers */
}
```

### Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Essential Game Animations

### 1. Pop/Bounce (Score, Collect)

```css
@keyframes pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

.pop {
  animation: pop 0.2s ease-out;
}

/* Elastic version */
@keyframes popElastic {
  0% { transform: scale(1); }
  40% { transform: scale(1.4); }
  60% { transform: scale(0.9); }
  80% { transform: scale(1.1); }
  100% { transform: scale(1); }
}
```

### 2. Shake (Error, Damage)

```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  40% { transform: translateX(8px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

.shake {
  animation: shake 0.4s ease-out;
}
```

### 3. Pulse (Highlight, Attention)

```css
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
}

.pulse {
  animation: pulse 1s ease-in-out infinite;
}
```

### 4. Float (Idle, Ambient)

```css
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.float {
  animation: float 2s ease-in-out infinite;
}
```

### 5. Spin (Loading, Processing)

```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spin {
  animation: spin 1s linear infinite;
}
```

### 6. Fade In/Out

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

.fade-in { animation: fadeIn 0.3s ease-out; }
.fade-in-up { animation: fadeInUp 0.3s ease-out; }
.fade-out { animation: fadeOut 0.3s ease-out forwards; }
```

### 7. Slide Transitions

```css
@keyframes slideInRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@keyframes slideOutLeft {
  from { transform: translateX(0); }
  to { transform: translateX(-100%); }
}

@keyframes slideInUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
```

---

## Particle Effects (JavaScript)

### Confetti

```javascript
function createConfetti(container, count = 50) {
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9'];

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.style.cssText = `
      position: absolute;
      width: ${Math.random() * 10 + 5}px;
      height: ${Math.random() * 10 + 5}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${Math.random() * 100}%;
      top: -20px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
      pointer-events: none;
    `;

    container.appendChild(particle);

    const animation = particle.animate([
      {
        transform: `translateY(0) rotate(0deg)`,
        opacity: 1
      },
      {
        transform: `translateY(${window.innerHeight + 50}px) rotate(${Math.random() * 720}deg)`,
        opacity: 0
      }
    ], {
      duration: 2000 + Math.random() * 2000,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      delay: Math.random() * 500
    });

    animation.onfinish = () => particle.remove();
  }
}
```

### Score Pop

```javascript
function showScorePop(x, y, points, container) {
  const pop = document.createElement('div');
  pop.textContent = `+${points}`;
  pop.style.cssText = `
    position: absolute;
    left: ${x}px;
    top: ${y}px;
    font-size: 24px;
    font-weight: bold;
    color: #ffd700;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
    pointer-events: none;
    z-index: 1000;
  `;

  container.appendChild(pop);

  pop.animate([
    { transform: 'translateY(0) scale(1)', opacity: 1 },
    { transform: 'translateY(-60px) scale(1.2)', opacity: 0 }
  ], {
    duration: 800,
    easing: 'ease-out'
  }).onfinish = () => pop.remove();
}
```

### Burst Effect (Level Up)

```javascript
function createBurst(x, y, container, count = 20) {
  const colors = ['#ffd700', '#ff6b35', '#4ade80', '#60a5fa', '#f472b6'];

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const velocity = 100 + Math.random() * 100;
    const particle = document.createElement('div');

    particle.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: 8px;
      height: 8px;
      background: ${colors[i % colors.length]};
      border-radius: 50%;
      pointer-events: none;
    `;

    container.appendChild(particle);

    const endX = x + Math.cos(angle) * velocity;
    const endY = y + Math.sin(angle) * velocity;

    particle.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${endX - x}px, ${endY - y}px) scale(0)`, opacity: 0 }
    ], {
      duration: 600,
      easing: 'ease-out',
      delay: (i % 5) * 30
    }).onfinish = () => particle.remove();
  }
}
```

### Sparkle Trail

```javascript
function createSparkle(x, y, container) {
  const sparkle = document.createElement('div');
  sparkle.innerHTML = '✨';
  sparkle.style.cssText = `
    position: absolute;
    left: ${x}px;
    top: ${y}px;
    font-size: 16px;
    pointer-events: none;
    transform: translate(-50%, -50%);
  `;

  container.appendChild(sparkle);

  sparkle.animate([
    { transform: 'translate(-50%, -50%) scale(0) rotate(0deg)', opacity: 1 },
    { transform: 'translate(-50%, -50%) scale(1.5) rotate(180deg)', opacity: 0 }
  ], {
    duration: 500,
    easing: 'ease-out'
  }).onfinish = () => sparkle.remove();
}

// Usage: create sparkles on mouse/touch move
let lastSparkle = 0;
document.addEventListener('mousemove', (e) => {
  if (Date.now() - lastSparkle > 50) {
    createSparkle(e.clientX, e.clientY, document.body);
    lastSparkle = Date.now();
  }
});
```

---

## Screen Effects

### Screen Shake

```javascript
function screenShake(element, intensity = 10, duration = 300) {
  const startTime = performance.now();
  const originalTransform = element.style.transform;

  function shake(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = elapsed / duration;

    if (progress >= 1) {
      element.style.transform = originalTransform;
      return;
    }

    const decay = 1 - progress;
    const x = (Math.random() - 0.5) * intensity * decay;
    const y = (Math.random() - 0.5) * intensity * decay;

    element.style.transform = `translate(${x}px, ${y}px)`;
    requestAnimationFrame(shake);
  }

  requestAnimationFrame(shake);
}
```

### Flash Effect

```javascript
function screenFlash(color = 'white', duration = 100) {
  const flash = document.createElement('div');
  flash.style.cssText = `
    position: fixed;
    inset: 0;
    background: ${color};
    pointer-events: none;
    z-index: 9999;
  `;

  document.body.appendChild(flash);

  flash.animate([
    { opacity: 0.8 },
    { opacity: 0 }
  ], {
    duration,
    easing: 'ease-out'
  }).onfinish = () => flash.remove();
}
```

### Vignette Pulse

```css
.vignette-danger {
  animation: vignettePulse 0.5s ease-in-out;
}

@keyframes vignettePulse {
  0%, 100% {
    box-shadow: inset 0 0 100px rgba(255, 0, 0, 0);
  }
  50% {
    box-shadow: inset 0 0 100px rgba(255, 0, 0, 0.5);
  }
}
```

---

## Tile/Card Animations

### Flip Card

```css
.card {
  perspective: 1000px;
}

.card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.6s;
  transform-style: preserve-3d;
}

.card.flipped .card-inner {
  transform: rotateY(180deg);
}

.card-front, .card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
}

.card-back {
  transform: rotateY(180deg);
}
```

### Tile Merge (2048-style)

```css
@keyframes tileMerge {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

@keyframes tileAppear {
  0% { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.tile-merge {
  animation: tileMerge 0.2s ease-out;
}

.tile-new {
  animation: tileAppear 0.15s ease-out;
}
```

### Stagger Animation

```javascript
function staggerAnimation(elements, animationClass, delay = 50) {
  elements.forEach((el, i) => {
    setTimeout(() => {
      el.classList.add(animationClass);
    }, i * delay);
  });
}

// Usage
const tiles = document.querySelectorAll('.tile');
staggerAnimation(tiles, 'fade-in-up', 30);
```

---

## Animation Utilities

```javascript
const Animate = {
  // Ease functions
  easeOutElastic(t) {
    const p = 0.3;
    return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
  },

  easeOutBounce(t) {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  },

  // Animate value over time
  tween(from, to, duration, onUpdate, onComplete, easing = (t) => t) {
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);
      const value = from + (to - from) * easedProgress;

      onUpdate(value);

      if (progress < 1) {
        requestAnimationFrame(update);
      } else if (onComplete) {
        onComplete();
      }
    }

    requestAnimationFrame(update);
  },

  // Animate counter
  countUp(element, from, to, duration = 1000) {
    this.tween(from, to, duration, (value) => {
      element.textContent = Math.floor(value).toLocaleString();
    });
  }
};

// Usage
Animate.countUp(scoreElement, 0, 1250, 500);
```

---

## Performance Tips

1. **Use `transform` and `opacity`** - Only these are GPU-accelerated
2. **Avoid layout thrashing** - Don't read then write in loops
3. **Use `will-change` sparingly** - Only on elements about to animate
4. **Prefer CSS animations** - They run on compositor thread
5. **Use `requestAnimationFrame`** - Never `setInterval` for animations
6. **Clean up** - Remove particles after animation completes
7. **Batch DOM operations** - Use `DocumentFragment` for many elements
