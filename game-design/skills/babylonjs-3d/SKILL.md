---
name: babylonjs-3d
description: >
  Babylon.js 3D game development patterns for browser games. Covers scene setup,
  cameras, lighting (clustered, area, volumetric), meshes, materials/PBR/OpenPBR,
  physics (Havok + character controller), animations (retargeting), particle systems
  (node editor, flow maps), Gaussian splats, GUI, asset loading, WebXR, navigation
  meshes, atmosphere rendering, geospatial, performance optimization, and mobile-friendly
  3D. Includes Babylon 9 features. Applied when building any 3D browser game or
  interactive 3D experience.
trigger: >
  When building 3D browser games, when the user mentions Babylon.js, WebGL, 3D game,
  3D rendering, when code imports @babylonjs/*, when files reference BABYLON namespace,
  or when the user asks about 3D meshes, physics, shaders, PBR materials, or WebXR.
---

# Babylon.js 3D Game Development

Babylon.js is a powerful, open-source 3D engine for the web. It renders via WebGL/WebGPU and provides a complete game development toolkit: physics, animation, particles, GUI, audio, and XR support — all in the browser.

**Current Version**: 9.x (latest), 7.x/8.x (stable)
**Docs**: https://doc.babylonjs.com
**Playground**: https://playground.babylonjs.com
**Feature Demos**: https://www.babylonjs.com/featureDemos/

---

## Project Setup

### NPM (Recommended for Production)

```bash
npm install @babylonjs/core @babylonjs/loaders @babylonjs/gui
# Optional
npm install @babylonjs/materials    # Advanced materials (water, fire, sky)
npm install @babylonjs/inspector    # Debug inspector (dev only)
npm install @babylonjs/havok        # Havok physics plugin
```

### ES Module Imports (Tree-Shakeable)

```typescript
// Only import what you use — keeps bundle small
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3, Color3 } from "@babylonjs/core/Maths/math";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
```

**Rule**: Never `import * as BABYLON from "@babylonjs/core"` in production — it defeats tree-shaking and bloats the bundle by 2-5MB.

### CDN (Prototyping / Astro Integration)

```html
<script src="https://cdn.babylonjs.com/babylon.js"></script>
<script src="https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js"></script>
<script src="https://cdn.babylonjs.com/gui/babylon.gui.min.js"></script>
```

When using CDN, everything is under the `BABYLON` namespace.

### Astro Integration

```astro
---
// game-page.astro
import GameLayout from '../layouts/GameLayout.astro';
---
<GameLayout title="3D Game" description="A 3D browser game">
  <canvas id="renderCanvas" style="width:100%;height:100%;touch-action:none;"></canvas>
  <script>
    // Inline script — runs client-side
    import { Engine } from "@babylonjs/core/Engines/engine";
    // ... game code
  </script>
</GameLayout>
```

Or with CDN approach (simpler, no build step):

```html
<canvas id="renderCanvas" style="width:100%;height:100%;touch-action:none;"></canvas>
<script src="https://cdn.babylonjs.com/babylon.js"></script>
<script is:inline>
  // Game code using BABYLON namespace
</script>
```

---

## Scene Setup

### Minimal Scene Template

```typescript
class Game {
  private engine: Engine;
  private scene: Scene;

  constructor(canvas: HTMLCanvasElement) {
    // Engine — handles WebGL/WebGPU context
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
    });

    this.scene = this.createScene();

    // Game loop
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });

    // Responsive resize
    window.addEventListener("resize", () => {
      this.engine.resize();
    });
  }

  private createScene(): Scene {
    const scene = new Scene(this.engine);

    // Camera
    const camera = new FreeCamera("camera", new Vector3(0, 5, -10), scene);
    camera.setTarget(Vector3.Zero());
    camera.attachControl(this.engine.getRenderingCanvas(), true);

    // Light
    const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    // Ground
    const ground = MeshBuilder.CreateGround("ground", { width: 10, height: 10 }, scene);

    // Example mesh
    const sphere = MeshBuilder.CreateSphere("sphere", { diameter: 2 }, scene);
    sphere.position.y = 1;

    return scene;
  }

  dispose(): void {
    this.scene.dispose();
    this.engine.dispose();
  }
}

// Bootstrap
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const game = new Game(canvas);
```

### WebGPU Engine (Babylon 7+)

```typescript
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";

// WebGPU with WebGL fallback
let engine: Engine;
if (navigator.gpu) {
  engine = new WebGPUEngine(canvas);
  await (engine as WebGPUEngine).initAsync();
} else {
  engine = new Engine(canvas, true);
}
```

---

## Cameras

### Camera Types for Games

| Camera | Use Case | Controls |
|--------|----------|----------|
| `FreeCamera` | First-person / free-roam | WASD + mouse |
| `ArcRotateCamera` | Third-person / orbit | Click-drag orbit, scroll zoom |
| `FollowCamera` | Chase camera behind player | Auto-follows target mesh |
| `UniversalCamera` | FreeCamera + touch/gamepad | Best for cross-platform games |

### ArcRotateCamera (Most Common for 3D Games)

```typescript
const camera = new ArcRotateCamera(
  "camera",
  Math.PI / 4,    // alpha — horizontal rotation
  Math.PI / 3,    // beta — vertical angle
  10,             // radius — distance from target
  Vector3.Zero(), // target point
  scene
);
camera.attachControl(canvas, true);

// Limits — prevent clipping through ground or zooming too far
camera.lowerBetaLimit = 0.1;
camera.upperBetaLimit = Math.PI / 2.2;  // Don't go below ground
camera.lowerRadiusLimit = 3;
camera.upperRadiusLimit = 25;

// Smooth inertia
camera.inertia = 0.9;

// Touch-friendly
camera.pinchPrecision = 50;
camera.panningSensibility = 100;
```

### FollowCamera (Third-Person Chase)

```typescript
const camera = new FollowCamera("followCam", new Vector3(0, 10, -10), scene);
camera.lockedTarget = playerMesh;
camera.radius = 10;          // Distance behind
camera.heightOffset = 4;     // Height above target
camera.rotationOffset = 0;   // Angle behind (0 = directly behind)
camera.cameraAcceleration = 0.05;
camera.maxCameraSpeed = 20;
```

---

## Lighting

### Common Lighting Setups

```typescript
// Ambient fill — soft overall lighting
const hemiLight = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
hemiLight.intensity = 0.4;
hemiLight.groundColor = new Color3(0.2, 0.2, 0.3); // Blueish shadow fill

// Directional sun — casts shadows
const dirLight = new DirectionalLight("sun", new Vector3(-1, -2, -1), scene);
dirLight.position = new Vector3(10, 20, 10);
dirLight.intensity = 0.8;

// Point light — lamp, torch, explosion
const pointLight = new PointLight("lamp", new Vector3(0, 3, 0), scene);
pointLight.intensity = 1;
pointLight.range = 15;

// Spot light — flashlight, spotlight
const spotLight = new SpotLight(
  "spot", new Vector3(0, 10, 0),  // position
  new Vector3(0, -1, 0),          // direction
  Math.PI / 4,                     // cone angle
  2,                                // exponent (falloff)
  scene
);
```

### Shadows

```typescript
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";

const shadowGen = new ShadowGenerator(1024, dirLight);
shadowGen.useBlurExponentialShadowMap = true; // Soft shadows
shadowGen.blurKernel = 32;

// Add shadow casters
shadowGen.addShadowCaster(playerMesh);
shadowGen.addShadowCaster(enemyMesh);

// Receive shadows on ground
ground.receiveShadows = true;
```

**Performance rule**: Use 512px shadow maps for mobile, 1024px for desktop. Only shadow-cast meshes that matter.

### Shadow-Receiving for All Meshes

```typescript
// Enable shadow receiving on all scene meshes (after loading a GLB)
scene.meshes.forEach((mesh) => {
  mesh.receiveShadows = true;
});

// Directional light with explicit shadow bounds (no auto-extend overhead)
const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(0.5, -0.7, 0.5), scene);
dirLight.position = new BABYLON.Vector3(-16, 12, 9);
dirLight.intensity = 0.5;
dirLight.shadowMinZ = -5;
dirLight.shadowMaxZ = 30;
dirLight.autoUpdateExtends = false; // Manual bounds — faster than auto
dirLight.orthoLeft = -15;
dirLight.orthoRight = 25;
dirLight.orthoBottom = -10;
dirLight.orthoTop = 20;
dirLight.shadowOrthoScale = 0;
```

### GPU Capability Checks

Check GPU support before enabling advanced lighting features:

```typescript
const caps = engine.getCaps();

// Area lights require half-float textures
const supportsAreaLights = caps.textureHalfFloat;

// Clustered lights and volumetric lighting require these
const supportsAdvancedLighting = caps.blendFloat && caps.texelFetch && caps.colorBufferFloat;

// Show fallback UI if requirements aren't met
if (!supportsAdvancedLighting) {
  const msg = engine.isWebGPU
    ? "This device does not support minimum requirements."
    : "WebGL on this device doesn't meet requirements. Try WebGPU.";
  showFallbackMessage(msg);
}
```

---

## Meshes & Geometry

### Built-in Mesh Primitives

```typescript
// Box/Cube
const box = MeshBuilder.CreateBox("box", { size: 2 }, scene);
const crate = MeshBuilder.CreateBox("crate", { width: 1, height: 2, depth: 1 }, scene);

// Sphere
const ball = MeshBuilder.CreateSphere("ball", { diameter: 1, segments: 16 }, scene);

// Cylinder / Cone
const pillar = MeshBuilder.CreateCylinder("pillar", { height: 3, diameter: 0.5 }, scene);
const cone = MeshBuilder.CreateCylinder("cone", { diameterTop: 0, diameterBottom: 1, height: 2 }, scene);

// Plane (wall, billboard)
const wall = MeshBuilder.CreatePlane("wall", { width: 5, height: 3 }, scene);

// Ground with height map
const terrain = MeshBuilder.CreateGroundFromHeightMap("terrain", "heightmap.png", {
  width: 100, height: 100,
  subdivisions: 50,
  minHeight: 0, maxHeight: 10,
}, scene);

// Torus (ring, donut)
const ring = MeshBuilder.CreateTorus("ring", { diameter: 2, thickness: 0.3 }, scene);
```

### Loading 3D Models

```typescript
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF"; // Register glTF loader

// Load .glb / .gltf model (classic 3-arg form)
const result = await SceneLoader.ImportMeshAsync(
  "",                    // mesh names ("" = all)
  "/models/",           // root URL
  "character.glb",      // filename
  scene
);
const character = result.meshes[0];
character.position = new Vector3(0, 0, 0);
character.scaling = new Vector3(0.5, 0.5, 0.5);

// Babylon 9 single-URL form — simpler for full URLs
await BABYLON.ImportMeshAsync("https://example.com/models/scene.glb", scene);

// Load as Asset Container — adds to scene manually (good for deferred loading)
const container = await BABYLON.LoadAssetContainerAsync(
  "https://example.com/models/camera-path.glb",
  scene,
  {
    pluginOptions: {
      gltf: {
        // Control animation auto-start behavior
        animationStartMode: BABYLON.GLTFLoaderAnimationStartMode.NONE, // Don't auto-play
      }
    }
  }
);

// Inspect what was loaded before adding to scene
console.log(container.meshes.length, "meshes");
console.log(container.cameras.length, "cameras");
console.log(container.animationGroups.length, "animation groups");

// Configure animations, then add everything to the scene
for (const animGroup of container.animationGroups) {
  animGroup.loopAnimation = true;
  animGroup.start(true);
}
container.addAllToScene();

// Use a camera from the loaded file
if (container.cameras.length > 0) {
  scene.activeCamera = container.cameras[0];
}

// Access animations from import result
const animations = result.animationGroups;
animations[0].start(true); // Loop first animation
```

**Supported formats**: `.glb` / `.gltf` (recommended), `.obj`, `.stl`, `.babylon`

**GLTF material tip**: For physically correct light falloff on imported PBR materials:

```typescript
for (const material of scene.materials) {
  material.useGLTFLightFalloff = true;  // Match glTF spec light attenuation
  material.maxSimultaneousLights = 6;   // Allow more lights to affect each mesh
}
```

### Mesh Manipulation

```typescript
// Position, rotation, scaling
mesh.position = new Vector3(1, 2, 3);
mesh.rotation = new Vector3(0, Math.PI / 4, 0);  // Euler radians
mesh.scaling = new Vector3(2, 2, 2);

// Parent-child hierarchy
childMesh.parent = parentMesh;  // Moves with parent

// Clone (shares geometry, independent transform)
const clone = mesh.clone("clone");

// Instance (GPU instancing — much faster for many copies)
const instance = mesh.createInstance("instance1");
instance.position.x = 5;

// Merge meshes (combine into one draw call)
const merged = Mesh.MergeMeshes([mesh1, mesh2, mesh3]);

// Visibility
mesh.isVisible = false;
mesh.setEnabled(false); // Also disables picking/physics
```

**Performance rule**: Use instances (not clones) for repeated objects like trees, rocks, bullets. Instances share GPU data.

---

## Materials & PBR

### Standard Material (Simple, Fast)

```typescript
const mat = new StandardMaterial("mat", scene);
mat.diffuseColor = new Color3(0.8, 0.2, 0.2);   // Base color
mat.specularColor = new Color3(0.5, 0.5, 0.5);    // Highlight
mat.emissiveColor = new Color3(0, 0, 0);           // Self-glow
mat.alpha = 1;                                       // Opacity

// Textures
mat.diffuseTexture = new Texture("textures/brick.jpg", scene);
mat.bumpTexture = new Texture("textures/brick_normal.jpg", scene);

mesh.material = mat;
```

### PBR Material (Realistic, Industry Standard)

```typescript
import { PBRMetallicRoughnessMaterial } from "@babylonjs/core/Materials/PBR/pbrMetallicRoughnessMaterial";

const pbr = new PBRMetallicRoughnessMaterial("pbr", scene);
pbr.baseColor = new Color3(0.9, 0.1, 0.1);
pbr.metallic = 0.0;   // 0 = dielectric (plastic, wood), 1 = metal
pbr.roughness = 0.5;  // 0 = mirror, 1 = matte

// Textures
pbr.baseTexture = new Texture("textures/albedo.png", scene);
pbr.metallicRoughnessTexture = new Texture("textures/metallic_roughness.png", scene);
pbr.normalTexture = new Texture("textures/normal.png", scene);
pbr.occlusionTexture = new Texture("textures/ao.png", scene);

mesh.material = pbr;
```

### Environment & Skybox

```typescript
// HDR environment for reflections
const envTexture = CubeTexture.CreateFromPrefilteredData("env/environment.env", scene);
scene.environmentTexture = envTexture;

// Skybox
const skybox = MeshBuilder.CreateBox("skybox", { size: 1000 }, scene);
const skyMat = new StandardMaterial("skyMat", scene);
skyMat.backFaceCulling = false;
skyMat.reflectionTexture = new CubeTexture("textures/skybox/skybox", scene);
skyMat.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
skyMat.diffuseColor = Color3.Black();
skyMat.specularColor = Color3.Black();
skybox.material = skyMat;
skybox.infiniteDistance = true;

// Or simpler — environment helper
scene.createDefaultEnvironment({
  createSkybox: true,
  skyboxSize: 500,
  createGround: true,
  groundSize: 100,
});
```

### Procedural Materials (No Textures Needed)

```typescript
import { GridMaterial } from "@babylonjs/materials/grid/gridMaterial";

const gridMat = new GridMaterial("grid", scene);
gridMat.majorUnitFrequency = 5;
gridMat.gridRatio = 0.5;
gridMat.mainColor = new Color3(0, 0, 0);
gridMat.lineColor = new Color3(0, 1, 1);
ground.material = gridMat;
```

---

## Physics (Havok)

Babylon.js 7+ uses Havok as the default physics engine — fast, stable, production-grade.

### Setup

```typescript
import HavokPhysics from "@babylonjs/havok";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core/Physics/v2";

// Initialize Havok WASM
const havokInstance = await HavokPhysics();
const havokPlugin = new HavokPlugin(true, havokInstance);
scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin);
```

### Physics Bodies

```typescript
// Static ground (mass = 0 → immovable)
const groundAggregate = new PhysicsAggregate(
  ground,
  PhysicsShapeType.BOX,
  { mass: 0, restitution: 0.5 },
  scene
);

// Dynamic sphere (affected by gravity)
const sphereAggregate = new PhysicsAggregate(
  sphere,
  PhysicsShapeType.SPHERE,
  { mass: 1, restitution: 0.7, friction: 0.5 },
  scene
);

// Apply force / impulse
sphereAggregate.body.applyImpulse(
  new Vector3(0, 10, 5),   // force direction + magnitude
  sphere.getAbsolutePosition() // application point
);

// Set velocity directly
sphereAggregate.body.setLinearVelocity(new Vector3(0, 5, 0));
sphereAggregate.body.setAngularVelocity(new Vector3(0, 2, 0));
```

### Collision Detection

```typescript
// Observable-based collision
sphereAggregate.body.setCollisionCallbackEnabled(true);

const observable = havokPlugin.onCollisionObservable;
observable.add((event) => {
  if (event.type === "COLLISION_STARTED") {
    const meshA = event.collider.transformNode;
    const meshB = event.collidedAgainst.transformNode;
    console.log(`${meshA.name} hit ${meshB.name}`);
  }
});
```

### Character Controller Pattern

```typescript
class CharacterController {
  private aggregate: PhysicsAggregate;
  private moveSpeed = 5;
  private jumpForce = 8;
  private isGrounded = false;

  constructor(private mesh: Mesh, scene: Scene) {
    // Capsule collider for character
    this.aggregate = new PhysicsAggregate(
      mesh,
      PhysicsShapeType.CAPSULE,
      { mass: 1, friction: 0.5, restitution: 0 },
      scene
    );
    // Lock rotation so character doesn't tumble
    this.aggregate.body.setMassProperties({
      inertia: Vector3.Zero(),
    });
  }

  move(direction: Vector3): void {
    const velocity = this.aggregate.body.getLinearVelocity();
    this.aggregate.body.setLinearVelocity(new Vector3(
      direction.x * this.moveSpeed,
      velocity.y, // Preserve gravity
      direction.z * this.moveSpeed
    ));
  }

  jump(): void {
    if (this.isGrounded) {
      this.aggregate.body.applyImpulse(
        new Vector3(0, this.jumpForce, 0),
        this.mesh.getAbsolutePosition()
      );
      this.isGrounded = false;
    }
  }
}
```

---

## Animation

### Babylon Animation System

```typescript
import { Animation } from "@babylonjs/core/Animations/animation";

// Float animation (e.g., rotation)
const rotateAnim = new Animation(
  "rotate",
  "rotation.y",           // target property
  30,                      // FPS
  Animation.ANIMATIONTYPE_FLOAT,
  Animation.ANIMATIONLOOPMODE_CYCLE
);

rotateAnim.setKeys([
  { frame: 0, value: 0 },
  { frame: 120, value: Math.PI * 2 },
]);

mesh.animations.push(rotateAnim);
scene.beginAnimation(mesh, 0, 120, true); // loop = true
```

### Animation Groups (from Loaded Models)

```typescript
const result = await SceneLoader.ImportMeshAsync("", "/models/", "character.glb", scene);

// Animation groups loaded from the file
const idle = result.animationGroups.find(a => a.name === "Idle");
const run = result.animationGroups.find(a => a.name === "Run");
const jump = result.animationGroups.find(a => a.name === "Jump");

// Stop all, play one
result.animationGroups.forEach(a => a.stop());
idle.start(true, 1.0); // loop, speed multiplier

// Blend between animations
function switchToRun() {
  idle.stop();
  run.start(true, 1.0);
}
```

### Animation Weights (Blending)

```typescript
// Enable blending
idle.weight = 1.0;
run.weight = 0.0;
idle.play(true);
run.play(true);

// Smooth transition
function blendToRun(t: number) {
  idle.weight = 1 - t;
  run.weight = t;
}

// In render loop, interpolate t from 0 to 1
```

---

## Particle Systems

```typescript
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";

// Fire effect
const fire = new ParticleSystem("fire", 2000, scene);
fire.particleTexture = new Texture("textures/flare.png", scene);
fire.emitter = new Vector3(0, 0.5, 0);

// Emission shape
fire.minEmitBox = new Vector3(-0.2, 0, -0.2);
fire.maxEmitBox = new Vector3(0.2, 0, 0.2);

// Particle behavior
fire.color1 = new Color4(1, 0.5, 0, 1);
fire.color2 = new Color4(1, 0.2, 0, 1);
fire.colorDead = new Color4(0.2, 0, 0, 0);
fire.minSize = 0.1;
fire.maxSize = 0.5;
fire.minLifeTime = 0.3;
fire.maxLifeTime = 1.0;
fire.emitRate = 500;
fire.direction1 = new Vector3(-0.5, 1, -0.5);
fire.direction2 = new Vector3(0.5, 2, 0.5);
fire.gravity = new Vector3(0, -2, 0);

fire.start();

// Stop after duration
setTimeout(() => fire.stop(), 3000);
```

### Explosion Effect

```typescript
function createExplosion(position: Vector3, scene: Scene): void {
  const explosion = new ParticleSystem("explosion", 500, scene);
  explosion.particleTexture = new Texture("textures/spark.png", scene);
  explosion.emitter = position;
  explosion.minEmitBox = Vector3.Zero();
  explosion.maxEmitBox = Vector3.Zero();

  explosion.color1 = new Color4(1, 0.8, 0, 1);
  explosion.color2 = new Color4(1, 0.2, 0, 1);
  explosion.minSize = 0.1;
  explosion.maxSize = 0.4;
  explosion.minLifeTime = 0.2;
  explosion.maxLifeTime = 0.8;
  explosion.emitRate = 500;
  explosion.createPointEmitter(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
  explosion.minEmitPower = 5;
  explosion.maxEmitPower = 15;
  explosion.targetStopDuration = 0.1;
  explosion.disposeOnStop = true;

  explosion.start();
}
```

---

## GUI (2D UI Overlay)

```typescript
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Button } from "@babylonjs/gui/2D/controls/button";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { Control } from "@babylonjs/gui/2D/controls/control";

// Full-screen UI layer
const ui = AdvancedDynamicTexture.CreateFullscreenUI("ui");

// Score text
const scoreText = new TextBlock("score", "Score: 0");
scoreText.color = "white";
scoreText.fontSize = 24;
scoreText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
scoreText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
scoreText.paddingLeft = "20px";
scoreText.paddingTop = "20px";
ui.addControl(scoreText);

// Update score
function updateScore(score: number): void {
  scoreText.text = `Score: ${score}`;
}

// Button
const btn = Button.CreateSimpleButton("restartBtn", "Restart");
btn.width = "150px";
btn.height = "50px";
btn.color = "white";
btn.background = "green";
btn.cornerRadius = 10;
btn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
btn.paddingBottom = "40px";
btn.onPointerClickObservable.add(() => {
  restartGame();
});
ui.addControl(btn);
```

### 3D GUI (Floating Labels, Health Bars)

```typescript
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";

// GUI attached to a mesh
const label = new TextBlock("name", "Enemy");
label.color = "white";
label.fontSize = 14;

const rect = new Rectangle("nameplate");
rect.width = "100px";
rect.height = "30px";
rect.background = "rgba(0,0,0,0.5)";
rect.cornerRadius = 5;
rect.addControl(label);

const meshUI = AdvancedDynamicTexture.CreateFullscreenUI("meshUI");
meshUI.addControl(rect);
rect.linkWithMesh(enemyMesh);
rect.linkOffsetY = -50; // Above the mesh
```

---

## Input Handling

### Keyboard

```typescript
const inputMap: Record<string, boolean> = {};

scene.actionManager = new ActionManager(scene);
scene.actionManager.registerAction(new ExecuteCodeAction(
  ActionManager.OnKeyDownTrigger, (evt) => {
    inputMap[evt.sourceEvent.key.toLowerCase()] = true;
  }
));
scene.actionManager.registerAction(new ExecuteCodeAction(
  ActionManager.OnKeyUpTrigger, (evt) => {
    inputMap[evt.sourceEvent.key.toLowerCase()] = false;
  }
));

// In update loop
scene.onBeforeRenderObservable.add(() => {
  const direction = Vector3.Zero();
  if (inputMap["w"]) direction.z += 1;
  if (inputMap["s"]) direction.z -= 1;
  if (inputMap["a"]) direction.x -= 1;
  if (inputMap["d"]) direction.x += 1;
  if (inputMap[" "]) player.jump();

  if (direction.length() > 0) {
    direction.normalize();
    player.move(direction);
  }
});
```

### Touch / Mobile Input

```typescript
// Virtual joystick
import { VirtualJoystick } from "@babylonjs/core/Misc/virtualJoystick";

const leftJoystick = new VirtualJoystick(true);  // left side
const rightJoystick = new VirtualJoystick(false); // right side (camera)

scene.onBeforeRenderObservable.add(() => {
  if (leftJoystick.pressed) {
    const moveDir = new Vector3(
      leftJoystick.deltaPosition.x,
      0,
      leftJoystick.deltaPosition.y * -1
    );
    player.move(moveDir);
  }
});

// Cleanup
leftJoystick.releaseCanvas();
```

### Mesh Picking (Click/Tap on Objects)

```typescript
scene.onPointerDown = (evt, pickResult) => {
  if (pickResult.hit && pickResult.pickedMesh) {
    const mesh = pickResult.pickedMesh;
    console.log(`Clicked: ${mesh.name}`);

    if (mesh.name.startsWith("enemy_")) {
      handleEnemyClick(mesh);
    }
  }
};

// Ray-based picking (custom direction)
const ray = scene.createPickingRay(
  scene.pointerX, scene.pointerY,
  Matrix.Identity(), camera
);
const hit = scene.pickWithRay(ray);
```

---

## Asset Management

### AssetsManager (Preload Everything)

```typescript
import { AssetsManager } from "@babylonjs/core/Misc/assetsManager";

const assetsManager = new AssetsManager(scene);

// Queue assets
const meshTask = assetsManager.addMeshTask("player", "", "/models/", "player.glb");
const texTask = assetsManager.addTextureTask("ground", "textures/ground.jpg");
const binTask = assetsManager.addBinaryFileTask("audio", "sounds/hit.wav");

// Progress
assetsManager.onProgress = (remaining, total) => {
  const pct = Math.round(((total - remaining) / total) * 100);
  loadingText.text = `Loading... ${pct}%`;
};

// Complete
assetsManager.onFinish = (tasks) => {
  const playerMesh = meshTask.loadedMeshes[0];
  const groundTex = texTask.texture;
  startGame(playerMesh, groundTex);
};

assetsManager.load();
```

### Lazy Loading (Load on Demand)

```typescript
// Load a level when the player reaches a trigger zone
async function loadLevel(levelName: string): Promise<void> {
  const result = await SceneLoader.ImportMeshAsync(
    "", `/levels/`, `${levelName}.glb`, scene
  );
  // Position and setup
  result.meshes[0].position = new Vector3(0, 0, 100);
}
```

---

## Audio

### Babylon 9 Audio Engine (Recommended)

```typescript
// Async audio engine — built on Web Audio API with automatic unlock handling
const audioEngine = await BABYLON.CreateAudioEngineAsync({ volume: 0.5 });

// Babylon auto-injects an unmute button — style it above your game UI
document.getElementById("babylonUnmuteButton").style.zIndex = 50;

// Create sounds with async factory
const music = await BABYLON.CreateSoundAsync("music", "audio/music.mp3", {
  autoplay: true,
  loop: true,
  volume: 0,
});

// Unlock audio (required for mobile — waits for user gesture internally)
await audioEngine.unlockAsync();

// Smooth volume ramp — fade in over 2 seconds with logarithmic curve
music.setVolume(0.2, {
  duration: 2,
  shape: BABYLON.AudioParameterRampShape.Logarithmic,
});

// Sound effects
const hitSound = await BABYLON.CreateSoundAsync("hit", "audio/hit.wav", {
  volume: 0.8,
});
hitSound.play();
```

### Legacy Audio API (Babylon 7/8)

```typescript
import { Sound } from "@babylonjs/core/Audio/sound";

// Background music
const music = new Sound("bgm", "audio/music.mp3", scene, null, {
  loop: true,
  autoplay: true,
  volume: 0.3,
});

// Spatial 3D audio (attached to mesh)
const engineSound = new Sound("engine", "audio/engine.mp3", scene, null, {
  loop: true,
  autoplay: true,
  spatialSound: true,
  maxDistance: 50,
});
engineSound.attachToMesh(carMesh);
```

**Mobile rule**: Audio won't play until user interaction. The Babylon 9 async engine handles this automatically via `unlockAsync()`. For legacy API:

```typescript
canvas.addEventListener("pointerdown", () => {
  Engine.audioEngine?.unlock();
}, { once: true });
```

---

## Performance Optimization

### Rendering Budget

| Target | Desktop | Mobile |
|--------|---------|--------|
| FPS | 60 | 30-60 |
| Draw calls | < 200 | < 50 |
| Triangles | < 1M | < 200K |
| Texture memory | < 512MB | < 128MB |

### Key Optimization Techniques

```typescript
// 1. Freeze materials that don't change
material.freeze();

// 2. Freeze world matrix for static meshes
staticMesh.freezeWorldMatrix();

// 3. Use instances for repeated objects (NOT clones)
const tree = MeshBuilder.CreateCylinder("tree", {}, scene);
for (let i = 0; i < 100; i++) {
  const inst = tree.createInstance(`tree_${i}`);
  inst.position = randomPosition();
}

// 4. LOD (Level of Detail)
const highPoly = createHighPolyMesh();   // close up
const lowPoly = createLowPolyMesh();     // far away
highPoly.addLODLevel(30, lowPoly);       // switch at distance 30
highPoly.addLODLevel(60, null);          // hide at distance 60

// 5. Occlusion queries — skip rendering hidden meshes
mesh.occlusionType = AbstractMesh.OCCLUSION_TYPE_OPTIMISTIC;
mesh.occlusionQueryAlgorithmType = AbstractMesh.OCCLUSION_ALGORITHM_TYPE_ACCURATE;

// 6. Reduce shadow map resolution on mobile
if (/Mobi|Android/i.test(navigator.userAgent)) {
  shadowGenerator.mapSize = 512;
  engine.setHardwareScalingLevel(2); // Render at half resolution
}

// 7. Scene optimizer (auto-adjusts quality)
import { SceneOptimizer, SceneOptimizerOptions } from "@babylonjs/core/Misc/sceneOptimizer";

const options = SceneOptimizerOptions.ModerateDegradation();
const optimizer = new SceneOptimizer(scene, options);
optimizer.start();
```

### Static Mesh Optimization Checklist

For meshes that don't move, interact, or change material — apply all of these together for maximum benefit:

```typescript
// Full static mesh optimization (apply to every non-interactive mesh)
function optimizeStaticMesh(mesh: AbstractMesh): void {
  mesh.freezeWorldMatrix();          // Skip matrix recalc every frame
  mesh.doNotSyncBoundingInfo = true; // Skip bounding box updates
  mesh.isPickable = false;           // Skip raycasting (big win if many meshes)
  mesh.alwaysSelectAsActiveMesh = true; // Skip frustum check (if always visible)
}

// For meshes that move occasionally — toggle freeze on/off
mesh.freezeWorldMatrix();
// ... later, when it needs to move:
mesh.unfreezeWorldMatrix();
mesh.position.x = 10;
mesh.freezeWorldMatrix(); // Re-freeze after move
```

**Rule**: If users can't click or hover a mesh, set `isPickable = false`. In a scene with 600+ meshes, this alone can cut frame time significantly.

### Scene-Level Optimizations

```typescript
// 1. Freeze active meshes list — stops per-frame visibility recomputation
//    Use when camera doesn't move or scene is mostly static
scene.freezeActiveMeshes();
// scene.unfreezeActiveMeshes(); // Call when camera/scene changes significantly

// 2. Skip pointer move picking — avoid raycasting on every mouse move
scene.skipPointerMovePicking = true;

// 3. Disable auto-clear when viewport is fully covered by geometry
scene.autoClear = false;
scene.autoClearDepthAndStencil = false;

// 4. Batch material property changes without per-change shader recompilation
scene.blockMaterialDirtyMechanism = true;
material.diffuseColor = new Color3(1, 0, 0);
material.specularColor = new Color3(0, 0, 0);
material.alpha = 0.8;
scene.blockMaterialDirtyMechanism = false; // Triggers single recompilation

// 5. Performance priority — one-call aggressive optimization
//    Intermediate: freezes materials, disables picking, skips pointer events
//    Aggressive: also skips frustum clipping and bounding info sync
scene.performancePriority = ScenePerformancePriority.Intermediate;
// scene.performancePriority = ScenePerformancePriority.Aggressive;
```

### Color Palette Technique (Reduce Materials to One)

Every unique material adds a draw call. The color palette technique uses a single shared material with a small palette texture, mapping mesh UVs to the desired color region. This can cut draw calls by 10x in large scenes.

```typescript
// 1. Create a small color palette texture (e.g. 8x1 px strip of colors)
const paletteTex = new Texture("textures/color-palette.png", scene);
paletteTex.hasAlpha = false;

// 2. Single shared material for ALL meshes
const sharedMat = new StandardMaterial("palette", scene);
sharedMat.diffuseTexture = paletteTex;
sharedMat.freeze(); // Material never changes — freeze it

// 3. In Blender/3D tool: UV-map each face to the desired color on the palette
//    Import model — all objects share one material, one draw call batch
```

**When to use**: Stylized/low-poly scenes with many objects (harbors, cities, landscapes). A real-world scene with 631 meshes dropped from 631 draw calls to 73 by combining this with instancing.

### Mesh Grouping and Container Nodes

```typescript
// Use TransformNode (not empty Mesh) for grouping/hierarchy
// TransformNode is excluded from frustum checks — cheaper than an invisible mesh
const group = new TransformNode("enemyGroup", scene);
enemy1.parent = group;
enemy2.parent = group;
group.position.y = 5; // Moves all children
```

### Culling Strategy

Trade frustum check accuracy for speed on meshes that are roughly spherical or always near-visible:

```typescript
// Default — full bounding box check
mesh.cullingStrategy = AbstractMesh.CULLINGSTRATEGY_STANDARD;

// Bounding sphere only — faster, slight false positives
mesh.cullingStrategy = AbstractMesh.CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;

// Optimistic — assume visible first, verify with sphere
mesh.cullingStrategy = AbstractMesh.CULLINGSTRATEGY_OPTIMISTIC_INCLUSION;
```

### Depth Pre-Pass

For meshes with expensive shaders (PBR with many maps), render depth first so fragments behind other objects are rejected early:

```typescript
material.needDepthPrePass = true;
// Best for: overlapping PBR meshes, complex fragment shaders
// Skip for: simple materials, non-overlapping geometry
```

### Octree Spatial Partitioning

For scenes with 200+ meshes, an octree speeds up visibility selection:

```typescript
// Scene-level octree for mesh selection
scene.createOrUpdateSelectionOctree(64, 3); // capacity, maxDepth

// Mesh-level octree for picking/collisions on complex meshes
mesh.createOrUpdateSubmeshesOctree();
mesh.useOctreeForPicking = true;
mesh.useOctreeForCollisions = true;
```

### Large Scene Constructor Options

For scenes where meshes are frequently added/removed, enable lookup maps at the cost of extra memory:

```typescript
const scene = new Scene(engine, {
  useGeometryUniqueIdsMap: true,  // Faster geometry add/remove
  useMaterialMeshMap: true,       // Faster material lookups
  useClonedMeshMap: true,         // Faster clone management
});

// Bulk disposal — prevent recomputation when removing many meshes at once
scene.blockfreeActiveMeshesAndRenderingGroups = true;
meshesToRemove.forEach(m => m.dispose());
scene.blockfreeActiveMeshesAndRenderingGroups = false;
```

### Asset Pipeline Tips

- **Triangulate faces in Blender before export** — gives you control over polygon/face counts instead of letting the glTF exporter decide
- **Use the Inspector's wireframe mode** to visually check polygon density and find over-tessellated meshes
- **Toggle individual meshes** in the Inspector to isolate which mesh is killing FPS (not always the highest poly count)
- **Compress textures** — use KTX2/Basis Universal for GPU-compressed textures, reducing VRAM by 4-6x

### Debug Performance

```typescript
// Show FPS and draw call count
scene.debugLayer.show();

// Detailed instrumentation
const instrumentation = new SceneInstrumentation(scene);
instrumentation.captureActiveMeshesEvaluationTime = true;
instrumentation.captureRenderTargetsRenderTime = true;
instrumentation.captureFrameTime = true;
instrumentation.captureRenderTime = true;
instrumentation.captureDrawCalls = true;

scene.onAfterRenderObservable.add(() => {
  console.log("FPS:", engine.getFps().toFixed(0));
  console.log("Draw calls:", instrumentation.drawCallsCounter.current);
  console.log("Active meshes:", scene.getActiveMeshes().length);
  console.log("Frame time:", instrumentation.frameTimeCounter.lastSecAverage.toFixed(2), "ms");
});

// GPU frame time (requires EXT_DISJOINT_TIMER_QUERY — not available in all browsers)
const engineInstrumentation = new EngineInstrumentation(engine);
engineInstrumentation.captureGPUFrameTime = true;

// Inspector (dev only)
import "@babylonjs/inspector";
scene.debugLayer.show({ embedMode: true });
```

---

## WebXR (VR/AR)

```typescript
// Basic VR support
const xrHelper = await scene.createDefaultXRExperienceAsync({
  floorMeshes: [ground],
});

// Teleportation locomotion
const teleportation = xrHelper.teleportation;
teleportation.addFloorMesh(ground);

// Hand tracking
xrHelper.input.onControllerAddedObservable.add((controller) => {
  controller.onMotionControllerInitObservable.add((motionController) => {
    const trigger = motionController.getComponent("xr-standard-trigger");
    trigger?.onButtonStateChangedObservable.add((component) => {
      if (component.pressed) {
        handleTriggerPress(controller);
      }
    });
  });
});
```

---

## Game Architecture Pattern

### Recommended Structure for 3D Browser Games

```
game/
├── src/
│   ├── core/
│   │   ├── Game.ts           # Engine + scene init, game loop
│   │   ├── SceneManager.ts   # Scene switching (menu, gameplay, gameover)
│   │   └── AssetLoader.ts    # Centralized asset loading with progress
│   ├── entities/
│   │   ├── Player.ts         # Player mesh + physics + input
│   │   ├── Enemy.ts          # Enemy AI + physics
│   │   └── Projectile.ts     # Bullet/projectile pool
│   ├── systems/
│   │   ├── InputSystem.ts    # Keyboard + touch + gamepad
│   │   ├── PhysicsSystem.ts  # Physics setup + collision handlers
│   │   ├── AudioSystem.ts    # Sound management + spatial audio
│   │   └── UISystem.ts       # HUD, menus, score display
│   ├── levels/
│   │   ├── Level.ts          # Base level interface
│   │   └── Level1.ts         # Specific level setup
│   └── utils/
│       ├── ObjectPool.ts     # Reusable object pool
│       └── MathUtils.ts      # Game math helpers
```

### Scene Manager Pattern

```typescript
class SceneManager {
  private scenes: Map<string, Scene> = new Map();
  private activeScene: Scene | null = null;

  async switchTo(name: string): Promise<void> {
    if (this.activeScene) {
      this.activeScene.detachControl();
    }

    if (!this.scenes.has(name)) {
      const scene = await this.createScene(name);
      this.scenes.set(name, scene);
    }

    this.activeScene = this.scenes.get(name)!;
    this.activeScene.attachControl();
  }

  private async createScene(name: string): Promise<Scene> {
    switch (name) {
      case "menu": return this.createMenuScene();
      case "gameplay": return this.createGameplayScene();
      case "gameover": return this.createGameOverScene();
      default: throw new Error(`Unknown scene: ${name}`);
    }
  }

  render(): void {
    this.activeScene?.render();
  }
}
```

### Object Pool (Critical for Performance)

```typescript
class ObjectPool<T extends { setEnabled(enabled: boolean): void }> {
  private pool: T[] = [];
  private active: T[] = [];

  constructor(
    private factory: () => T,
    private resetFn: (obj: T) => void,
    initialSize: number
  ) {
    for (let i = 0; i < initialSize; i++) {
      const obj = factory();
      obj.setEnabled(false);
      this.pool.push(obj);
    }
  }

  acquire(): T {
    const obj = this.pool.pop() || this.factory();
    obj.setEnabled(true);
    this.active.push(obj);
    return obj;
  }

  release(obj: T): void {
    obj.setEnabled(false);
    this.resetFn(obj);
    this.active = this.active.filter(a => a !== obj);
    this.pool.push(obj);
  }

  releaseAll(): void {
    [...this.active].forEach(obj => this.release(obj));
  }
}

// Usage: bullet pool
const bulletPool = new ObjectPool(
  () => MeshBuilder.CreateSphere("bullet", { diameter: 0.1 }, scene),
  (bullet) => { bullet.position = Vector3.Zero(); },
  50 // pre-allocate 50
);
```

---

## Common Game Patterns

### Raycasting (Shooting, Line of Sight)

```typescript
function shoot(origin: Vector3, direction: Vector3): void {
  const ray = new Ray(origin, direction, 100); // max distance
  const hit = scene.pickWithRay(ray, (mesh) => mesh.name.startsWith("enemy"));

  if (hit?.pickedMesh) {
    handleHit(hit.pickedMesh, hit.pickedPoint!);
  }
}
```

### Trigger Zones

```typescript
// Invisible trigger volume
const trigger = MeshBuilder.CreateBox("trigger", { size: 3 }, scene);
trigger.isVisible = false;
trigger.checkCollisions = false;

scene.onBeforeRenderObservable.add(() => {
  if (player.intersectsMesh(trigger, false)) {
    onPlayerEnterZone();
    trigger.dispose(); // One-time trigger
  }
});
```

### Day/Night Cycle

```typescript
let timeOfDay = 0; // 0-1

scene.onBeforeRenderObservable.add(() => {
  timeOfDay += 0.0001;
  if (timeOfDay > 1) timeOfDay = 0;

  // Sun position
  const angle = timeOfDay * Math.PI * 2;
  sunLight.direction = new Vector3(Math.sin(angle), -Math.cos(angle), 0);

  // Sky color
  const dayColor = new Color3(0.5, 0.7, 1.0);
  const nightColor = new Color3(0.05, 0.05, 0.15);
  const t = Math.max(0, Math.cos(angle));
  scene.clearColor = Color3.Lerp(nightColor, dayColor, t).toColor4();

  // Light intensity
  sunLight.intensity = t * 0.8;
  hemiLight.intensity = 0.1 + t * 0.4;
});
```

---

## Mobile-Specific Considerations

```typescript
// Detect mobile
const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

if (isMobile) {
  // Lower render resolution
  engine.setHardwareScalingLevel(2);

  // Reduce shadow quality
  shadowGenerator.mapSize = 512;
  shadowGenerator.useBlurExponentialShadowMap = false;

  // Fewer particles
  particleSystem.emitRate = particleSystem.emitRate / 2;

  // Simpler materials
  // Use StandardMaterial instead of PBR on low-end devices

  // Touch-friendly UI
  // Buttons >= 44px, joystick controls, no hover states

  // Prevent default touch behaviors
  canvas.style.touchAction = "none";
}

// Prevent canvas selection / context menu
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("selectstart", (e) => e.preventDefault());
```

---

## Post-Processing Effects

```typescript
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";

const pipeline = new DefaultRenderingPipeline("default", true, scene, [camera]);

// Bloom (glow on bright objects)
pipeline.bloomEnabled = true;
pipeline.bloomThreshold = 0.8;
pipeline.bloomWeight = 0.5;
pipeline.bloomKernel = 64;

// Depth of field
pipeline.depthOfFieldEnabled = true;
pipeline.depthOfField.focusDistance = 5000;  // in mm
pipeline.depthOfField.focalLength = 50;
pipeline.depthOfField.fStop = 2.8;

// Anti-aliasing (FXAA)
pipeline.fxaaEnabled = true;

// Chromatic aberration
pipeline.chromaticAberrationEnabled = true;
pipeline.chromaticAberration.aberrationAmount = 30;

// Tone mapping & exposure
pipeline.imageProcessingEnabled = true;
pipeline.imageProcessing.toneMappingEnabled = true;
pipeline.imageProcessing.toneMappingType = 1; // ACES
pipeline.imageProcessing.exposure = 1.2;
pipeline.imageProcessing.contrast = 1.1;

// Vignette
pipeline.imageProcessing.vignetteEnabled = true;
pipeline.imageProcessing.vignetteWeight = 2;

// Grain
pipeline.grainEnabled = true;
pipeline.grain.intensity = 10;
pipeline.grain.animated = true;
```

### SSAO (Ambient Occlusion)

```typescript
import { SSAO2RenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline";

const ssao = new SSAO2RenderingPipeline("ssao", scene, {
  ssaoRatio: 0.5,
  blurRatio: 1,
});
ssao.radius = 2;
ssao.totalStrength = 1.5;
ssao.samples = 16;
scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("ssao", camera);
```

### Screen Space Reflections

```typescript
import { SSRRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssrRenderingPipeline";

const ssr = new SSRRenderingPipeline("ssr", scene, [camera], false);
ssr.strength = 1;
ssr.reflectionSpecularFalloffExponent = 2;
ssr.maxSteps = 100;
```

---

## Sprites (2D in 3D World)

For 2D elements like health bars, indicators, trees in the distance, or 2D characters in a 3D world.

```typescript
import { SpriteManager } from "@babylonjs/core/Sprites/spriteManager";
import { Sprite } from "@babylonjs/core/Sprites/sprite";

// Sprite manager — handles a sprite sheet
const spriteManager = new SpriteManager(
  "trees",
  "textures/tree_sprites.png",
  100,                  // max sprite count
  { width: 64, height: 128 }, // cell size
  scene
);

// Create individual sprites
const tree = new Sprite("tree", spriteManager);
tree.position = new Vector3(5, 2, 0);
tree.size = 4;
tree.cellIndex = 0; // Which frame in the sprite sheet

// Animated sprite
const explosion = new Sprite("boom", explosionManager);
explosion.playAnimation(0, 15, false, 50); // start, end, loop, delay(ms)
```

---

## Thin Instances (Extreme Performance)

Render 100K+ copies of a mesh with a single draw call. Faster than instances for massive counts.

```typescript
// Thin instances — provide transformation matrices directly
const matricesData = new Float32Array(16 * count);

for (let i = 0; i < count; i++) {
  const matrix = Matrix.Translation(
    Math.random() * 100 - 50,
    0,
    Math.random() * 100 - 50
  );
  matrix.copyToArray(matricesData, i * 16);
}

mesh.thinInstanceSetBuffer("matrix", matricesData, 16);

// Update a specific instance
const newMatrix = Matrix.Translation(10, 0, 10);
mesh.thinInstanceSetMatrixAt(index, newMatrix);
```

**Use case**: Grass, stars, rain, crowds, debris — anything with 1000+ identical objects.

---

## Node Material Editor (Shader Graphs)

Create custom shaders visually — no GLSL/WGSL needed.

```typescript
import { NodeMaterial } from "@babylonjs/core/Materials/Node/nodeMaterial";

// Load a node material exported from the editor
const nodeMat = await NodeMaterial.ParseFromFileAsync("", "materials/custom.json", scene);
mesh.material = nodeMat;

// Or create programmatically
const nodeMat = new NodeMaterial("custom", scene);
// Build graph with code... (typically use the visual editor instead)
// Editor: https://nme.babylonjs.com
```

**Tools available**:
- **NME** (Node Material Editor): https://nme.babylonjs.com — custom shaders
- **NGE** (Node Geometry Editor): https://nge.babylonjs.com — procedural geometry
- **NPE** (Node Particle Editor): visual particle system design (Babylon 9)
- **NRGE** (Node Render Graph Editor): custom render pipelines (Babylon 9)

---

## Development Tools

| Tool | URL | Purpose |
|------|-----|---------|
| Playground | https://playground.babylonjs.com | Live code editor with instant preview |
| Sandbox | https://sandbox.babylonjs.com | Drag-and-drop 3D model viewer |
| Inspector | Built-in (`scene.debugLayer.show()`) | Scene tree, material editor, performance |
| NME | https://nme.babylonjs.com | Visual shader/material editor |
| NGE | https://nge.babylonjs.com | Procedural geometry editor |
| Spector.js | Browser extension | WebGL call debugger |

### Inspector (Essential for Development)

```typescript
// Enable inspector — add in dev only
import "@babylonjs/inspector";

// Toggle with keyboard shortcut
window.addEventListener("keydown", (e) => {
  if (e.key === "F12" || (e.ctrlKey && e.shiftKey && e.key === "I")) {
    if (scene.debugLayer.isVisible()) {
      scene.debugLayer.hide();
    } else {
      scene.debugLayer.show({ embedMode: true });
    }
  }
});
```

---

## Babylon 9 Advanced Features

### Clustered Lighting (Many Dynamic Lights)

Babylon 9 uses clustered forward rendering to efficiently handle dozens of dynamic lights without performance collapse. Use `ClusteredLightContainer` to explicitly manage which lights are clustered.

```typescript
// Explicit clustered light container — gives you control over which lights cluster
const clustered = new BABYLON.ClusteredLightContainer("clustered", [], scene);

const torchLight = new BABYLON.PointLight("torch", new BABYLON.Vector3(5, 3, 10), scene, true);
torchLight.diffuse = new BABYLON.Color3(1.0, 0.5, 0.1);
torchLight.intensity = 4;
torchLight.range = 6;
clustered.addLight(torchLight);

// Add many lights — clustered rendering keeps it fast
for (let i = 0; i < 50; i++) {
  const light = new BABYLON.PointLight(`light_${i}`, randomPosition(), scene, true);
  light.intensity = 2;
  light.range = 4;
  light.diffuse = randomColor();
  clustered.addLight(light);
}
// Engine clusters the view frustum into a 3D grid
// Each pixel only evaluates lights in its cluster — O(1) per light
```

**Flickering / blinking lights** — common in sci-fi and horror scenes:

```typescript
// Procedural flicker using layered sine waves at different frequencies
let time = 0;
scene.onBeforeRenderObservable.add(() => {
  const flicker = 1.0
    + 0.35 * Math.sin(time * 47)
    + 0.25 * Math.sin(time * 113)
    + 0.15 * Math.sin(time * 229);
  blinkingLight.intensity = Math.max(0, flicker * 8);
  time += engine.getDeltaTime() * 0.001;
});
```

**Use case**: Night scenes with many torches, fireflies, neon signs, explosions.
**Demo**: https://aka.ms/babylon9CLDemo

### Area Lights (Rectangular Light Emitters)

Physically-based rectangular lights that emit from a surface — like screens, LED panels, and windows. Require `textureHalfFloat` GPU capability.

```typescript
// Check GPU support first
if (!engine.getCaps().textureHalfFloat) {
  console.warn("Area lights not supported on this device");
}

// Create area light from a mesh (e.g. a TV screen)
const screenMesh = scene.getMeshByName("Screen");
const transform = new BABYLON.TransformNode("screenTransform", scene);
transform.parent = screenMesh;
transform.rotation.x = Math.PI * 0.5;

// Compute light dimensions from mesh bounds
screenMesh.computeWorldMatrix(true);
const bounds = screenMesh.getBoundingInfo().boundingBox.extendSizeWorld;
const w = bounds.x * 2;
const h = bounds.y * 2;

// Area light — emits from a rectangle
const areaLight = new BABYLON.RectAreaLight("screenLight", BABYLON.Vector3.Zero(), w, h, scene);
areaLight.parent = transform;
areaLight.intensity = 2;

// Process texture for area light emission (generates SH coefficients)
const textureProcessor = new BABYLON.AreaLightTextureTools(engine);
const sourceTexture = new BABYLON.Texture("textures/screen-content.png", scene);
areaLight.emissionTexture = await textureProcessor.processAsync(sourceTexture);

// Apply emissive material to the screen mesh itself (so it glows visually)
const screenMat = new BABYLON.StandardMaterial("screenMat", scene);
screenMat.disableLighting = true;
screenMat.emissiveTexture = sourceTexture;
screenMat.backFaceCulling = false;
screenMesh.material = screenMat;
```

**Use case**: Monitors, neon signs, windows, LED panels, display boards.
**Demo**: https://aka.ms/babylon9ALDemo

### Volumetric Lighting (God Rays)

```typescript
// Classic post-process god rays
import { VolumetricLightScatteringPostProcess } from "@babylonjs/core/PostProcesses/volumetricLightScatteringPostProcess";

const godrays = new VolumetricLightScatteringPostProcess(
  "godrays", 1.0, camera, sunMesh, 100,
  Texture.BILINEAR_SAMPLINGMODE, engine
);
godrays.exposure = 0.3;
godrays.decay = 0.96;
godrays.weight = 0.5;
godrays.density = 0.8;
```

**Babylon 9 Node Render Graph** — advanced volumetric lighting via render graph snippets:

```typescript
// Node Render Graph — composable render pipeline defined visually or via snippets
const nrg = await BABYLON.NodeRenderGraph.ParseFromSnippetAsync("9F3FV1#16", scene, {
  debugTextures: true,
});

nrg.onBuildObservable.add(() => {
  // Configure volumetric lighting parameters after build
  const lightVolume = nrg.getBlockByName("lightingVolume").task.lightingVolume;
  lightVolume.frequency = engine.isWebGPU ? 1 : 0;
  lightVolume.tesselation = engine.hostInformation.isMobile ? 256 : 1024;

  const volumetricLighting = nrg.getBlockByName("volumetricLighting").task;
  const scale = 0.04;
  volumetricLighting.lightPower.set(0.18 * scale, 0.2 * scale, 0.22 * scale);
});

await nrg.buildAsync();
```

**Use case**: Cathedrals, warehouses, forests with sunbeams, sci-fi corridors.
**Demo**: https://aka.ms/babylon9vlDemo

### Gaussian Splats (Photorealistic 3D Captures)

Gaussian splatting renders photorealistic 3D scenes captured from real-world photos/video — no traditional mesh or texture needed.

```typescript
import { GaussianSplattingMesh } from "@babylonjs/core/Meshes/GaussianSplatting/gaussianSplattingMesh";

// Load a .ply or .splat file
const splat = new GaussianSplattingMesh("splat", null, scene);
await splat.loadFileAsync("models/scene.ply");
splat.position = new Vector3(0, 0, 0);

// SPZ format (compressed, faster loading — Babylon 8+)
const spzSplat = new GaussianSplattingMesh("spz", null, scene);
await spzSplat.loadFileAsync("models/scene.spz");
```

**Use case**: Real-world environments, product visualization, mixed reality.
**Formats**: `.ply`, `.splat`, `.spz` (compressed)
**Demo**: https://aka.ms/babylon9GSDemo

### Animation Retargeting

Share animations between characters with different body proportions.

```typescript
// Load source animation and target character
const source = await SceneLoader.ImportMeshAsync("", "/models/", "animated_char.glb", scene);
const target = await SceneLoader.ImportMeshAsync("", "/models/", "different_char.glb", scene);

// Retarget animations from source skeleton to target skeleton
const sourceAnim = source.animationGroups[0];
const retargeted = sourceAnim.clone("retargeted");
retargeted.retargetTo(target.skeletons[0]);
retargeted.start(true);
```

**Use case**: Apply a walk cycle to any humanoid character regardless of proportions.
**Demo**: https://aka.ms/babylon9ARDemo

### Node Particle Editor (Visual Particle Design)

Babylon 9 introduces a node-based visual editor for particle systems — design complex effects without code.

```typescript
// Single node particle system from file
import { NodeParticleSystem } from "@babylonjs/core/Particles/Node/nodeParticleSystem";

const nps = await NodeParticleSystem.ParseFromFileAsync("", "particles/fire.json", scene);
nps.emitter = torchMesh;
nps.start();

// Node Particle System SET from snippet — loads multiple coordinated particle systems
// Snippet IDs come from the Babylon.js snippet server (designed in the NPE visual editor)
const nodeSet = await BABYLON.NodeParticleSystemSet.ParseFromSnippetAsync("ICTSOG#1");
const builtSet = await nodeSet.buildAsync(scene);
builtSet.start();

// Position all systems in the set to the same emitter point
const emitPos = new BABYLON.Vector3(8, 5, 15);
for (const system of builtSet.systems) {
  system.emitter.copyFrom(emitPos);
}

// Control individual systems — e.g., burst emission on one system
const burstSystem = builtSet.systems[3];
if (burstSystem) {
  burstSystem.emitRate = 0; // Disable continuous emission
  scene.registerBeforeRender(() => {
    const now = performance.now() * 0.001;
    if (shouldBurst(now)) {
      burstSystem.manualEmitCount = 1 + Math.floor(Math.random() * 4);
    }
  });
}
```

**Use case**: Complex effects (fire, magic, weather, sparkles) designed visually.
**Demo**: https://aka.ms/babylon9NPEDemo

### Particle Flow Maps

Direct particles along artistic paths using flow map textures.

```typescript
// Flow maps guide particle movement using a texture
// Red channel = X velocity, Green channel = Y velocity
particleSystem.noiseTexture = new Texture("textures/flow_map.png", scene);
particleSystem.noiseStrength = new Vector3(2, 2, 2);
```

**Use case**: Swirling magic effects, wind-driven particles, water flow.
**Demo**: https://aka.ms/babylon9PartFMDemo

### Atmosphere Rendering

Physically-based atmospheric scattering for realistic skies, sunsets, and time-of-day.

```typescript
// Atmosphere rendering — Babylon 9
// Creates realistic sky with Rayleigh + Mie scattering
// Responds to sun position for dawn/day/dusk/night transitions
// Use the time-of-day slider pattern from the demo
```

**Demo**: https://aka.ms/babylon9ATMDemo

### OpenPBR Material

Next-gen material model beyond standard metallic-roughness PBR. Supports subsurface scattering, thin-film iridescence, diffuse transmission, and more.

```typescript
// OpenPBR provides physically accurate rendering with:
// - Subsurface scattering (skin, wax, marble)
// - Diffuse transmission (leaves, thin fabrics)
// - Thin-film interference (soap bubbles, oil slicks)
// - Sheen (velvet, fabric)
// - Clear coat (car paint, lacquered wood)
```

**Demo**: https://aka.ms/babylon9OPBRDemo

### Navigation Mesh (AI Pathfinding)

```typescript
import { RecastJSPlugin } from "@babylonjs/core/Navigation/Plugins/recastJSPlugin";
import Recast from "recast-detour";

// Initialize navigation plugin
const recast = await Recast();
const navPlugin = new RecastJSPlugin(recast);

// Build nav mesh from level geometry
navPlugin.createNavMesh([ground, obstacles], {
  cs: 0.2,           // cell size
  ch: 0.2,           // cell height
  walkableSlopeAngle: 45,
  walkableHeight: 2,
  walkableClimb: 0.5,
  walkableRadius: 0.5,
});

// Compute path
const path = navPlugin.computePath(
  startPosition,  // Vector3
  endPosition     // Vector3
);
// path = array of Vector3 waypoints

// Crowd agent (multiple AI characters)
const crowd = navPlugin.createCrowd(10, 0.5, scene);
const agentIndex = crowd.addAgent(startPos, {
  radius: 0.5,
  height: 1.8,
  maxSpeed: 3.0,
  maxAcceleration: 4.0,
});
crowd.agentGoto(agentIndex, targetPosition);
```

**Use case**: Enemy AI pathfinding, NPC movement, strategy games.
**Demo**: https://aka.ms/babylon9NMDemo

### Havok Character Controller (Babylon 8+)

Dedicated character controller built on Havok — better than manual physics body for player movement.

```typescript
// Purpose-built character controller — handles slopes, stairs, grounding
// See demo for spiral staircase test
```

**Demo**: https://aka.ms/babylon8havokCCDemo

### Geometric Booleans (CSG)

Combine meshes using boolean operations — union, intersection, subtraction.

```typescript
import { CSG } from "@babylonjs/core/Meshes/csg";

const boxCSG = CSG.FromMesh(box);
const sphereCSG = CSG.FromMesh(sphere);

// Subtract sphere from box → creates a hole
const result = boxCSG.subtract(sphereCSG);
const holedBox = result.toMesh("holedBox", null, scene);

// Union — merge shapes
const merged = boxCSG.union(sphereCSG).toMesh("merged", null, scene);

// Intersect — keep only overlap
const intersection = boxCSG.intersect(sphereCSG).toMesh("intersect", null, scene);
```

**Demo**: https://aka.ms/babylon8booleanDemo

### Geospatial Camera & 3D Tiles

Render real-world geography with photogrammetry tiles (Google 3D Tiles, Cesium).

```typescript
// Geospatial camera for globe/map rendering
// 3D Tiles for streaming massive real-world datasets
// See demos for Manhattan aerial view and orbital planet view
```

**Demo (Geospatial)**: https://aka.ms/babylon9GSCDemo
**Demo (3D Tiles)**: https://aka.ms/babylon93DTDemo

### SDF Text (Resolution-Independent 3D Text)

Signed Distance Field text stays sharp at any distance or angle — no pixelation.

**Demo**: https://aka.ms/babylon9sdfDemo

### Frame Graph (Advanced Render Pipeline)

Customize the rendering pipeline with a node-based frame graph — add custom passes, post-processing chains, and render targets.

**Demo**: https://aka.ms/babylon9FGDemo

---

## Feature Selection Guide

| Game Type | Key Features to Use |
|-----------|-------------------|
| FPS / Third-person | Havok physics, character controller, nav mesh, raycasting, animation retargeting |
| Racing | Havok vehicles, follow camera, particle trails, volumetric dust |
| Tower Defense / Strategy | Nav mesh pathfinding, ArcRotateCamera, crowd agents, clustered lighting |
| Horror / Atmospheric | Volumetric lighting, atmosphere, Gaussian splats, spatial audio, shadows |
| Puzzle / Casual | CSG booleans, standard materials, GUI, simple physics |
| Open World | 3D tiles, geospatial camera, LOD, large world rendering, atmosphere |
| Product Viewer | PBR/OpenPBR, environment HDR, ArcRotateCamera, GUI hotspots |
| VR/AR | WebXR, hand tracking, teleportation, spatial audio |

---

## Self-Learning Protocol

This skill improves over time through user feedback.

### Capture Phase
After completing any task using this skill:
1. **Record what worked** — Babylon.js patterns, scene setups, or approaches that succeeded
2. **Record what failed** — approaches rejected, caused rendering issues, or poor performance
3. **Record user corrections** — any feedback about preferred Babylon.js patterns or versions

### Adapt Phase
---

## Checklist

### For PRD Phase
- [ ] Decide: Babylon.js vs Three.js (Babylon for physics/GUI, Three.js for lightweight scenes)
- [ ] Define camera type: ArcRotate (orbit), FreeCamera (FPS), FollowCamera (3rd person)
- [ ] Specify lighting mood: bright/dark, shadow quality needed?
- [ ] List 3D assets: use basic meshes or load glTF models?
- [ ] Define mobile target: low-perf devices need reduced shadows, fewer draw calls
- [ ] Specify interaction: mouse/touch raycasting, drag-and-drop, physics-based?

### For Build Phase
- [ ] Load Babylon.js from CDN with `is:inline` in Astro (critical!)
- [ ] Defer `BABYLON.*` constructors to inside `initGame()` (not module level)
- [ ] Use `ArcRotateCamera` with radius/beta limits for controllable orbit
- [ ] Add `HemisphericLight` + `DirectionalLight` for balanced lighting
- [ ] Use `InstancedMesh` for repeated objects (pieces, tiles, trees)
- [ ] Enable shadows only on capable devices (`detectLowPerf()` guard)
- [ ] Set `canvas.tabindex = 0` after init (override Babylon's positive tabindex)
- [ ] Detach camera controls when HTML overlays are open
- [ ] Test on mobile: touch orbit, pinch zoom, no interference with UI buttons
- [ ] Dispose scene + engine on `beforeunload` (prevent memory leaks)

### Performance Budget
- [ ] Draw calls: < 100 (use instancing)
- [ ] Triangles: < 50K for mobile, < 200K for desktop
- [ ] Textures: < 10MB total, use compressed where possible
- [ ] FPS: 60 desktop, 30+ mobile
- [ ] AI/game logic: < 16ms per frame (don't block render loop)
- [ ] Initial load: Babylon.js CDN ~800KB, keep game code < 200KB

---

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| `BABYLON.Color3` at module level | Crashes if CDN hasn't loaded yet | Defer to `initGame()` or behind `typeof BABYLON` guard |
| Missing `is:inline` on CDN script | Astro strips external scripts without it | Always add `is:inline` to Babylon CDN tags |
| Positive `tabindex` on canvas | Breaks DOM focus order for accessibility | Set `canvas.tabindex = 0` after Babylon init |
| `camera.attachControl` while overlay open | Babylon steals pointer events from HTML buttons | `detachControl()` on overlay show, reattach on hide |
| Creating meshes every frame | Memory leak, GC pressure | Pre-create mesh pool, reuse with visibility toggle |
| Shadows on mobile | Kills FPS on low-end devices | Guard with `detectLowPerf()`, disable shadow generator |
| Full scene rebuild on state change | Expensive, causes flicker | Diff state, only update changed meshes |
| No `dispose()` on navigation | Memory leak on SPA page transitions | Dispose scene + engine on `beforeunload` |

---

## Self-Learning Protocol

### Recall Phase

Before applying this skill in future tasks:
1. **Check memory** — search for feedback memories related to Babylon.js / 3D games
2. **Prioritize recent corrections** — newer feedback overrides older patterns
3. **Apply learned preferences** — e.g., user prefers PBR over StandardMaterial

### Evolve Phase
When patterns stabilize (3+ consistent corrections):
1. **Propose a skill update** — suggest edits to this SKILL.md
2. **Only update on user approval** — never silently modify
3. **Version the change** — bump game-design plugin patch version
