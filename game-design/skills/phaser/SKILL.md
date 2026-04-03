---
name: phaser
description: >
  Phaser 3 game development patterns for browser games. Covers scene management,
  sprite animation, physics (Arcade + Matter.js), tilemaps, particle effects,
  input handling, audio, cameras, tweens, and mobile optimization.
  Applied when building 2D browser games that need physics, sprites, or tilemaps
  beyond what vanilla Canvas provides. Use for platformers, RPGs, tower defense,
  shoot-em-ups, and other complex 2D games.
---

# Phaser 3 for Browser Games

## When to Use Phaser vs Vanilla Canvas

| Feature Needed | Vanilla Canvas | Phaser |
|----------------|---------------|--------|
| Simple shapes, text | Yes | Overkill |
| Sprite sheets + animation | Manual (hard) | Built-in |
| Physics (gravity, collisions) | Manual (very hard) | Built-in (Arcade + Matter.js) |
| Tilemaps / level editor | Manual | Built-in (Tiled integration) |
| Particle systems | Manual | Built-in |
| Camera follow + zoom | Manual | Built-in |
| Scene management | Manual | Built-in |
| Tweens / easing | Manual | Built-in |

**Rule**: If your game needs 2+ items from the right column, use Phaser.

---

## Setup for Weekly Arcade (Astro)

### CDN Loading (recommended for arcade — no build step)

```html
<!-- In chess-3d.astro pattern: -->
<Fragment slot="head">
  <link rel="preload" href="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js" as="script">
</Fragment>

<Fragment slot="scripts">
  <script is:inline src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"></script>
  <script is:inline src="/games/{game-slug}/game.js"></script>
</Fragment>
```

### Game Config Template

```javascript
(function () {
  'use strict';

  const config = {
    type: Phaser.AUTO,               // WebGL with Canvas fallback
    parent: 'gameContainer',          // DOM element ID
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#0f0f1a',
    scale: {
      mode: Phaser.Scale.RESIZE,     // Auto-resize to fit viewport
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',             // or 'matter' for complex physics
      arcade: {
        gravity: { y: 300 },
        debug: false,
      },
    },
    scene: [MenuScene, GameScene, GameOverScene],
    // Performance: limit FPS on mobile
    fps: {
      target: 60,
      min: 30,
    },
    // iOS audio fix
    audio: {
      disableWebAudio: false,
    },
    input: {
      activePointers: 2,              // Support multi-touch
    },
  };

  const game = new Phaser.Game(config);
})();
```

---

## Scene Management

```javascript
class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  preload() {
    // Load assets here — Phaser handles loading screen
    this.load.image('background', '/games/my-game/assets/bg.png');
    this.load.spritesheet('player', '/games/my-game/assets/player.png', {
      frameWidth: 32, frameHeight: 48
    });
    this.load.audio('bgm', '/games/my-game/assets/music.mp3');
    this.load.tilemapTiledJSON('level1', '/games/my-game/assets/level1.json');
  }

  create() {
    this.add.text(400, 300, 'Play', { fontSize: '48px', fill: '#fff' })
      .setOrigin(0.5)
      .setInteractive()
      .on('pointerdown', () => this.scene.start('GameScene'));
  }
}

class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    // Game setup here
  }

  update(time, delta) {
    // Game loop — called every frame
    // delta = ms since last frame (use for frame-rate independent movement)
  }
}

class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create() {
    const score = this.registry.get('score');
    this.add.text(400, 200, 'Game Over', { fontSize: '64px', fill: '#fff' }).setOrigin(0.5);
    this.add.text(400, 300, `Score: ${score}`, { fontSize: '32px', fill: '#ccc' }).setOrigin(0.5);

    // Submit to Weekly Arcade leaderboard
    if (window.gameCloud) {
      window.gameCloud.submitOrQueue('my-game', { score, level: 1, timeMs: Date.now() - this.registry.get('startTime') });
    }
  }
}
```

---

## Sprites & Animation

```javascript
// In preload:
this.load.spritesheet('hero', '/games/my-game/hero.png', {
  frameWidth: 32, frameHeight: 48
});

// In create:
this.player = this.physics.add.sprite(100, 450, 'hero');
this.player.setCollideWorldBounds(true);

// Define animations
this.anims.create({
  key: 'walk',
  frames: this.anims.generateFrameNumbers('hero', { start: 0, end: 7 }),
  frameRate: 10,
  repeat: -1,
});

this.anims.create({
  key: 'idle',
  frames: [{ key: 'hero', frame: 0 }],
  frameRate: 1,
});

this.anims.create({
  key: 'jump',
  frames: [{ key: 'hero', frame: 8 }],
  frameRate: 1,
});

// In update:
if (cursors.left.isDown) {
  this.player.setVelocityX(-160);
  this.player.anims.play('walk', true);
  this.player.flipX = true;
} else if (cursors.right.isDown) {
  this.player.setVelocityX(160);
  this.player.anims.play('walk', true);
  this.player.flipX = false;
} else {
  this.player.setVelocityX(0);
  this.player.anims.play('idle', true);
}

if (cursors.up.isDown && this.player.body.touching.down) {
  this.player.setVelocityY(-330);
  this.player.anims.play('jump');
}
```

---

## Physics

### Arcade Physics (Simple — AABB collisions)

```javascript
// Groups
this.enemies = this.physics.add.group();
this.coins = this.physics.add.group();
this.platforms = this.physics.add.staticGroup();

// Add platform
this.platforms.create(400, 568, 'ground').setScale(2).refreshBody();

// Collisions
this.physics.add.collider(this.player, this.platforms);
this.physics.add.collider(this.enemies, this.platforms);

// Overlaps (trigger, no physics response)
this.physics.add.overlap(this.player, this.coins, (player, coin) => {
  coin.destroy();
  this.score += 10;
  this.sound.play('collect');
}, null, this);

this.physics.add.overlap(this.player, this.enemies, (player, enemy) => {
  this.scene.start('GameOverScene');
}, null, this);
```

### Matter.js Physics (Complex — polygons, joints, constraints)

```javascript
// Config: physics.default = 'matter'

// Create body from vertices (complex shapes)
const vertices = '50 0 100 50 50 100 0 50';
this.matter.add.fromVertices(400, 300, vertices, { isStatic: false });

// Constraints (ropes, joints)
const bodyA = this.matter.add.rectangle(300, 200, 50, 50);
const bodyB = this.matter.add.rectangle(400, 200, 50, 50);
this.matter.add.constraint(bodyA, bodyB, 100, 0.5);

// Sensors (triggers without collision response)
const sensor = this.matter.add.rectangle(500, 500, 100, 20, { isSensor: true, isStatic: true });
this.matter.world.on('collisionstart', (event) => {
  event.pairs.forEach(pair => {
    if (pair.bodyA === sensor || pair.bodyB === sensor) {
      // Triggered!
    }
  });
});
```

---

## Tilemaps (Tiled Editor Integration)

```javascript
// preload:
this.load.tilemapTiledJSON('map', '/games/my-game/level1.json');
this.load.image('tiles', '/games/my-game/tileset.png');

// create:
const map = this.make.tilemap({ key: 'map' });
const tileset = map.addTilesetImage('my-tileset', 'tiles');

// Layers
const backgroundLayer = map.createLayer('Background', tileset);
const platformLayer = map.createLayer('Platforms', tileset);
const foregroundLayer = map.createLayer('Foreground', tileset);

// Set collision on specific tile indices
platformLayer.setCollisionByProperty({ collides: true });

// Physics collision with tilemap
this.physics.add.collider(this.player, platformLayer);

// Camera follows player within map bounds
this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
```

---

## Input Handling

```javascript
// Keyboard
const cursors = this.input.keyboard.createCursorKeys();
const wasd = this.input.keyboard.addKeys('W,A,S,D');

// Touch / pointer
this.input.on('pointerdown', (pointer) => {
  // pointer.x, pointer.y
  if (pointer.x < this.cameras.main.width / 2) {
    this.player.setVelocityX(-200); // Left side = move left
  } else {
    this.player.setVelocityX(200);  // Right side = move right
  }
});

// Virtual joystick (mobile)
// Use rexUI plugin or build custom:
this.input.on('pointermove', (pointer) => {
  if (pointer.isDown) {
    const dx = pointer.x - pointer.downX;
    const dy = pointer.y - pointer.downY;
    this.player.setVelocity(dx * 2, dy * 2);
  }
});

// Swipe detection
let startX, startY;
this.input.on('pointerdown', (p) => { startX = p.x; startY = p.y; });
this.input.on('pointerup', (p) => {
  const dx = p.x - startX;
  const dy = p.y - startY;
  const threshold = 50;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
    // Horizontal swipe
    if (dx > 0) handleSwipe('right');
    else handleSwipe('left');
  } else if (Math.abs(dy) > threshold) {
    // Vertical swipe
    if (dy > 0) handleSwipe('down');
    else handleSwipe('up');
  }
});
```

---

## Camera

```javascript
// Follow player
this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

// Zoom
this.cameras.main.setZoom(1.5);

// Screen shake
this.cameras.main.shake(200, 0.01); // duration, intensity

// Flash
this.cameras.main.flash(300, 255, 0, 0); // red flash on hit

// Fade
this.cameras.main.fadeOut(500);
this.cameras.main.once('camerafadeoutcomplete', () => {
  this.scene.start('NextScene');
});

// Bounds
this.cameras.main.setBounds(0, 0, 3200, 600); // Level wider than screen
```

---

## Tweens (Animation Without Sprites)

```javascript
// Scale bounce on collect
this.tweens.add({
  targets: coin,
  scaleX: 1.5,
  scaleY: 1.5,
  alpha: 0,
  duration: 300,
  ease: 'Power2',
  onComplete: () => coin.destroy(),
});

// Float text "+10"
const scoreText = this.add.text(x, y, '+10', { fontSize: '20px', fill: '#FFD700' });
this.tweens.add({
  targets: scoreText,
  y: y - 50,
  alpha: 0,
  duration: 800,
  ease: 'Power1',
  onComplete: () => scoreText.destroy(),
});

// Heartbeat effect on health icon
this.tweens.add({
  targets: healthIcon,
  scaleX: 1.2,
  scaleY: 1.2,
  duration: 200,
  yoyo: true,
  repeat: -1,
  repeatDelay: 800,
});
```

---

## Particles

```javascript
// Phaser 3.60+ particle system
const particles = this.add.particles(0, 0, 'spark', {
  speed: { min: 50, max: 200 },
  scale: { start: 0.5, end: 0 },
  lifespan: 800,
  blendMode: 'ADD',
  gravityY: 200,
  emitting: false,
});

// Emit burst on collect
particles.emitParticleAt(coin.x, coin.y, 20);

// Continuous emitter (fire, smoke)
const fire = this.add.particles(400, 500, 'particle', {
  speed: { min: 20, max: 60 },
  angle: { min: -110, max: -70 },
  scale: { start: 0.6, end: 0 },
  lifespan: 600,
  tint: [0xff4400, 0xff8800, 0xffcc00],
  quantity: 2,
  frequency: 50,
});
```

---

## Weekly Arcade Integration

```javascript
// In GameOverScene.create():

// Score submission
if (window.gameCloud) {
  window.gameCloud.submitOrQueue('my-game', {
    score: this.registry.get('score'),
    level: this.registry.get('level'),
    timeMs: Date.now() - this.registry.get('startTime'),
    metadata: {
      enemiesKilled: this.registry.get('kills'),
      coinsCollected: this.registry.get('coins'),
    }
  });
}

// Auth check
const authCheck = setInterval(() => {
  if (window.authManager?.isInitialized) {
    clearInterval(authCheck);
    window.authManager.onAuthStateChanged(user => {
      // Update UI with user info
    });
  }
}, 100);

// Cloud state save/load
async function saveProgress() {
  if (!window.apiClient) return;
  await window.apiClient.saveGameState('my-game', {
    currentLevel: level,
    currentStreak: streak,
    bestStreak: bestStreak,
    gamesPlayed: gamesPlayed,
    gamesWon: gamesWon,
  });
}
```

---

## Performance Checklist

### For PRD Phase
- [ ] Estimate sprite count (< 200 on mobile)
- [ ] Decide physics: Arcade (simple) or Matter (complex)
- [ ] Plan asset sizes: sprites < 2MB total, audio < 1MB
- [ ] Define target FPS: 60 desktop, 30+ mobile

### For Build Phase
- [ ] Use texture atlases (fewer draw calls than individual images)
- [ ] Object pool enemies/bullets: `group.get()` instead of `new`
- [ ] Limit particles: max 100 simultaneous on mobile
- [ ] Compress audio to OGG/MP3 (not WAV)
- [ ] Set `pixelArt: true` in config if using pixel art (disables anti-aliasing)
- [ ] Use `Phaser.Scale.RESIZE` for responsive (not fixed dimensions)
- [ ] Test on iPhone SE (weakest common device)

### Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Creating sprites every frame | Memory leak, GC stutter | Object pool with `group.get(x, y, key)` |
| Loading images in `create()` | Blocks game start | Load everything in `preload()` |
| `setInterval` for game logic | Out of sync with Phaser loop | Use `update()` or `this.time.addEvent()` |
| Individual images instead of atlas | 50 draw calls instead of 1 | Pack sprites into atlas with TexturePacker |
| No `destroy()` on scene change | Memory leak across scenes | Clean up in `shutdown()` method |
| Matter.js for simple AABB | 10x CPU overhead | Use Arcade physics unless you need polygons |

---

## Game Type Templates

### Platformer
```
Scenes: Menu → Game → GameOver
Physics: Arcade (gravity: 300)
Assets: player spritesheet, tilemap, collectibles, enemies
Input: left/right + jump (keyboard + touch zones)
Camera: follow player, world bounds from tilemap
```

### Tower Defense
```
Scenes: Menu → LevelSelect → Game → GameOver
Physics: None (path-based movement)
Assets: tower sprites, enemy sprites, projectiles, tilemap
Input: tap to place tower, tap tower to upgrade
Camera: static or pinch-zoom
```

### Top-Down RPG
```
Scenes: Menu → Overworld → Battle → Dialogue
Physics: Arcade (no gravity, 4-directional movement)
Assets: character sheets, tilemap, NPCs, items
Input: virtual joystick + action button
Camera: follow player, smooth lerp
```

### Endless Runner
```
Scenes: Menu → Game → GameOver
Physics: Arcade (gravity for jump)
Assets: ground tiles, obstacles, player, collectibles
Input: tap to jump (single input)
Camera: fixed, world scrolls left
```
