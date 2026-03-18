# Gesture Controls Implementation

Complete guide for implementing touch gestures in mobile browser games.

## Gesture Types

### 1. Tap (Single Touch)

```javascript
class TapDetector {
  constructor(element, callback, options = {}) {
    this.element = element;
    this.callback = callback;
    this.maxDuration = options.maxDuration || 300;
    this.maxDistance = options.maxDistance || 10;

    this.startTime = 0;
    this.startX = 0;
    this.startY = 0;

    this.element.addEventListener('touchstart', this.onStart.bind(this), { passive: true });
    this.element.addEventListener('touchend', this.onEnd.bind(this), { passive: false });
  }

  onStart(e) {
    this.startTime = Date.now();
    this.startX = e.touches[0].clientX;
    this.startY = e.touches[0].clientY;
  }

  onEnd(e) {
    const duration = Date.now() - this.startTime;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const distance = Math.hypot(endX - this.startX, endY - this.startY);

    if (duration < this.maxDuration && distance < this.maxDistance) {
      e.preventDefault();
      this.callback({ x: endX, y: endY, duration });
    }
  }
}

// Usage
new TapDetector(gameCanvas, (tap) => {
  handleTap(tap.x, tap.y);
});
```

### 2. Double Tap

```javascript
class DoubleTapDetector {
  constructor(element, callback, options = {}) {
    this.element = element;
    this.callback = callback;
    this.maxDelay = options.maxDelay || 300;
    this.maxDistance = options.maxDistance || 40;

    this.lastTap = { time: 0, x: 0, y: 0 };

    new TapDetector(element, this.onTap.bind(this));
  }

  onTap(tap) {
    const now = Date.now();
    const distance = Math.hypot(tap.x - this.lastTap.x, tap.y - this.lastTap.y);

    if (now - this.lastTap.time < this.maxDelay && distance < this.maxDistance) {
      this.callback({ x: tap.x, y: tap.y });
      this.lastTap = { time: 0, x: 0, y: 0 }; // Reset
    } else {
      this.lastTap = { time: now, x: tap.x, y: tap.y };
    }
  }
}

// Usage
new DoubleTapDetector(gameCanvas, (tap) => {
  handleDoubleTap(tap.x, tap.y);
});
```

### 3. Swipe (4-Direction)

```javascript
class SwipeDetector {
  constructor(element, callback, options = {}) {
    this.element = element;
    this.callback = callback;
    this.threshold = options.threshold || 50;
    this.maxTime = options.maxTime || 500;

    this.startX = 0;
    this.startY = 0;
    this.startTime = 0;

    this.element.addEventListener('touchstart', this.onStart.bind(this), { passive: true });
    this.element.addEventListener('touchend', this.onEnd.bind(this), { passive: false });
  }

  onStart(e) {
    this.startX = e.touches[0].clientX;
    this.startY = e.touches[0].clientY;
    this.startTime = Date.now();
  }

  onEnd(e) {
    const duration = Date.now() - this.startTime;
    if (duration > this.maxTime) return;

    const deltaX = e.changedTouches[0].clientX - this.startX;
    const deltaY = e.changedTouches[0].clientY - this.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (Math.max(absX, absY) < this.threshold) return;

    e.preventDefault();

    let direction;
    if (absX > absY) {
      direction = deltaX > 0 ? 'right' : 'left';
    } else {
      direction = deltaY > 0 ? 'down' : 'up';
    }

    this.callback({
      direction,
      deltaX,
      deltaY,
      velocity: Math.max(absX, absY) / duration
    });
  }
}

// Usage
new SwipeDetector(gameCanvas, (swipe) => {
  switch (swipe.direction) {
    case 'up': moveUp(); break;
    case 'down': moveDown(); break;
    case 'left': moveLeft(); break;
    case 'right': moveRight(); break;
  }
});
```

### 4. Long Press

```javascript
class LongPressDetector {
  constructor(element, callback, options = {}) {
    this.element = element;
    this.callback = callback;
    this.duration = options.duration || 500;
    this.maxDistance = options.maxDistance || 10;

    this.timer = null;
    this.startX = 0;
    this.startY = 0;

    this.element.addEventListener('touchstart', this.onStart.bind(this), { passive: false });
    this.element.addEventListener('touchmove', this.onMove.bind(this), { passive: true });
    this.element.addEventListener('touchend', this.onEnd.bind(this), { passive: true });
    this.element.addEventListener('touchcancel', this.onEnd.bind(this), { passive: true });
  }

  onStart(e) {
    e.preventDefault(); // Prevent context menu
    this.startX = e.touches[0].clientX;
    this.startY = e.touches[0].clientY;

    this.timer = setTimeout(() => {
      this.callback({ x: this.startX, y: this.startY });
    }, this.duration);
  }

  onMove(e) {
    const distance = Math.hypot(
      e.touches[0].clientX - this.startX,
      e.touches[0].clientY - this.startY
    );
    if (distance > this.maxDistance) {
      this.cancel();
    }
  }

  onEnd() {
    this.cancel();
  }

  cancel() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

// Usage
new LongPressDetector(gameElement, (pos) => {
  showContextMenu(pos.x, pos.y);
});
```

### 5. Pinch (Zoom)

```javascript
class PinchDetector {
  constructor(element, callback) {
    this.element = element;
    this.callback = callback;
    this.initialDistance = 0;
    this.currentScale = 1;

    this.element.addEventListener('touchstart', this.onStart.bind(this), { passive: false });
    this.element.addEventListener('touchmove', this.onMove.bind(this), { passive: false });
    this.element.addEventListener('touchend', this.onEnd.bind(this), { passive: true });
  }

  getDistance(touches) {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  }

  getCenter(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  }

  onStart(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      this.initialDistance = this.getDistance(e.touches);
    }
  }

  onMove(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const currentDistance = this.getDistance(e.touches);
      const scale = currentDistance / this.initialDistance;
      const center = this.getCenter(e.touches);

      this.callback({
        scale,
        center,
        type: 'pinch'
      });
    }
  }

  onEnd(e) {
    if (e.touches.length < 2) {
      this.initialDistance = 0;
    }
  }
}

// Usage
new PinchDetector(gameCanvas, (pinch) => {
  zoomTo(pinch.scale, pinch.center);
});
```

### 6. Drag/Pan

```javascript
class DragDetector {
  constructor(element, callbacks) {
    this.element = element;
    this.onStart = callbacks.onStart || (() => {});
    this.onMove = callbacks.onMove || (() => {});
    this.onEnd = callbacks.onEnd || (() => {});

    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;

    this.element.addEventListener('touchstart', this.handleStart.bind(this), { passive: false });
    this.element.addEventListener('touchmove', this.handleMove.bind(this), { passive: false });
    this.element.addEventListener('touchend', this.handleEnd.bind(this), { passive: true });
    this.element.addEventListener('touchcancel', this.handleEnd.bind(this), { passive: true });
  }

  handleStart(e) {
    if (e.touches.length !== 1) return;
    e.preventDefault();

    this.isDragging = true;
    this.startX = e.touches[0].clientX;
    this.startY = e.touches[0].clientY;

    this.onStart({
      x: this.startX,
      y: this.startY
    });
  }

  handleMove(e) {
    if (!this.isDragging || e.touches.length !== 1) return;
    e.preventDefault();

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;

    this.onMove({
      x: currentX,
      y: currentY,
      deltaX: currentX - this.startX,
      deltaY: currentY - this.startY
    });
  }

  handleEnd(e) {
    if (!this.isDragging) return;
    this.isDragging = false;

    this.onEnd({
      x: e.changedTouches[0]?.clientX || 0,
      y: e.changedTouches[0]?.clientY || 0
    });
  }
}

// Usage
new DragDetector(gameCanvas, {
  onStart: (pos) => startDragging(pos),
  onMove: (pos) => updateDragPosition(pos),
  onEnd: (pos) => endDragging(pos)
});
```

---

## Unified Gesture Manager

```javascript
class GestureManager {
  constructor(element) {
    this.element = element;
    this.handlers = {
      tap: null,
      doubleTap: null,
      swipe: null,
      longPress: null,
      pinch: null,
      drag: null
    };

    this.setupListeners();
  }

  on(gesture, callback) {
    this.handlers[gesture] = callback;
    return this; // Chainable
  }

  setupListeners() {
    let touchStartTime = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let lastTapTime = 0;
    let longPressTimer = null;
    let isDragging = false;
    let initialPinchDistance = 0;

    this.element.addEventListener('touchstart', (e) => {
      touchStartTime = Date.now();
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;

      // Long press detection
      if (this.handlers.longPress) {
        longPressTimer = setTimeout(() => {
          this.handlers.longPress({ x: touchStartX, y: touchStartY });
        }, 500);
      }

      // Pinch detection
      if (e.touches.length === 2 && this.handlers.pinch) {
        initialPinchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }

      if (this.handlers.drag) {
        isDragging = true;
        this.handlers.drag({ type: 'start', x: touchStartX, y: touchStartY });
      }
    }, { passive: false });

    this.element.addEventListener('touchmove', (e) => {
      clearTimeout(longPressTimer);

      if (e.touches.length === 2 && this.handlers.pinch && initialPinchDistance) {
        e.preventDefault();
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        this.handlers.pinch({
          scale: currentDistance / initialPinchDistance,
          center: {
            x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
            y: (e.touches[0].clientY + e.touches[1].clientY) / 2
          }
        });
      }

      if (isDragging && this.handlers.drag) {
        e.preventDefault();
        this.handlers.drag({
          type: 'move',
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          deltaX: e.touches[0].clientX - touchStartX,
          deltaY: e.touches[0].clientY - touchStartY
        });
      }
    }, { passive: false });

    this.element.addEventListener('touchend', (e) => {
      clearTimeout(longPressTimer);

      const duration = Date.now() - touchStartTime;
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const deltaX = endX - touchStartX;
      const deltaY = endY - touchStartY;
      const distance = Math.hypot(deltaX, deltaY);

      // Tap detection
      if (duration < 300 && distance < 10) {
        const now = Date.now();
        if (now - lastTapTime < 300 && this.handlers.doubleTap) {
          this.handlers.doubleTap({ x: endX, y: endY });
          lastTapTime = 0;
        } else {
          lastTapTime = now;
          if (this.handlers.tap) {
            setTimeout(() => {
              if (lastTapTime === now) {
                this.handlers.tap({ x: endX, y: endY });
              }
            }, 300);
          }
        }
      }

      // Swipe detection
      if (duration < 500 && distance > 50 && this.handlers.swipe) {
        const direction = Math.abs(deltaX) > Math.abs(deltaY)
          ? (deltaX > 0 ? 'right' : 'left')
          : (deltaY > 0 ? 'down' : 'up');
        this.handlers.swipe({ direction, deltaX, deltaY });
      }

      // Drag end
      if (isDragging && this.handlers.drag) {
        isDragging = false;
        this.handlers.drag({ type: 'end', x: endX, y: endY });
      }

      initialPinchDistance = 0;
    }, { passive: false });
  }
}

// Usage
const gestures = new GestureManager(gameCanvas)
  .on('tap', (e) => handleTap(e.x, e.y))
  .on('swipe', (e) => handleSwipe(e.direction))
  .on('longPress', (e) => showMenu(e.x, e.y))
  .on('doubleTap', (e) => handleDoubleTap(e.x, e.y));
```

---

## Game-Specific Gesture Patterns

### Puzzle Game (2048-style)

```javascript
new SwipeDetector(gameCanvas, (swipe) => {
  switch (swipe.direction) {
    case 'up': game.move('up'); break;
    case 'down': game.move('down'); break;
    case 'left': game.move('left'); break;
    case 'right': game.move('right'); break;
  }
});
```

### Wordle-style (Tap to select)

```javascript
new TapDetector(keyboard, (tap) => {
  const key = document.elementFromPoint(tap.x, tap.y);
  if (key?.dataset.letter) {
    game.inputLetter(key.dataset.letter);
  }
});
```

### Snake Game (Continuous direction)

```javascript
let currentDirection = 'right';

new SwipeDetector(gameCanvas, (swipe) => {
  // Prevent 180-degree turns
  const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
  if (swipe.direction !== opposite[currentDirection]) {
    currentDirection = swipe.direction;
  }
});
```

### Card Game (Drag and drop)

```javascript
new DragDetector(card, {
  onStart: () => card.classList.add('dragging'),
  onMove: (pos) => {
    card.style.transform = `translate(${pos.deltaX}px, ${pos.deltaY}px)`;
  },
  onEnd: (pos) => {
    card.classList.remove('dragging');
    const dropZone = document.elementFromPoint(pos.x, pos.y);
    if (dropZone?.classList.contains('drop-zone')) {
      placeCard(card, dropZone);
    } else {
      card.style.transform = '';
    }
  }
});
```
