# Budgets, Texture Arithmetic and Delivery

Companion to `../SKILL.md` sections 1 and 7. The headline numbers are in the skill; this file
holds the full tables, the Babylon setup block, the instrumentation and the glTF delivery
decisions.

---

## 1. 3D budget, mid-range Android phone, browser, 60 fps

| Resource | Safe target | Warning | Hard ceiling |
|---|---|---|---|
| Draw calls per frame | under 50 | 100 | 150 |
| Triangles on screen | 30k-50k | 65k | 100k |
| Distinct materials in scene | 3-8 | 12 | 20 |
| Distinct shader programs | 2-4 | 6 | 8 |
| Texture memory (GPU, all textures + mips) | under 32 MB | 64 MB | 96 MB |
| Total asset download (all GLB + textures) | under 2 MB | 5 MB | 8 MB |
| Realtime lights casting shadows | 0-1 | 2 | 3 |
| Realtime lights total | 1-2 | 3 | 4 |
| Fullscreen post passes | 0-1 | 2 | 3 |
| JS heap for the scene | under 60 MB | 120 MB | 200 MB |

Derived from a mobile draw-call budget of roughly 100 with an aggressive target under 50 via
merging, instancing and LOD; a 50k triangle full-scene ceiling for mid-range Android with frame
drops above 65k; under 100,000 combined vertices for mobile; and 3 or fewer active dynamic
lights.

**Thermal trap.** A phone that holds 60 fps for 30 seconds can fall to 20 fps once the SoC
throttles. Budget for the throttled state.

**Provenance caveat.** Babylon publishes no numeric draw-call ceilings of its own; its
documentation deliberately says only "keep draw calls as small as possible". These figures come
from the broader WebGL, three.js and mobile-AR literature and apply equally to Babylon, but they
are not Babylon's own published numbers.

## 2. 2D budget

| Resource | Target |
|---|---|
| Canvas `drawImage` calls per frame | under 300 for canvas 2D, under 1,000 batched in WebGL |
| Atlas count bound per frame | 1-3 |
| Total sprite atlas memory | under 16 MB |
| Full-canvas composite passes (light layer, parallax, overlays) | under 6 |
| DOM elements animated per frame | under 30, and `transform` / `opacity` only |
| Base render resolution (pixel art) | 320x180 to 480x270, integer-scaled |

## 3. Texture memory arithmetic

`width * height * 4 bytes * 1.33` for an uncompressed RGBA texture with mipmaps.

| Texture | Download (PNG) | GPU memory, no mips | GPU memory, with mips |
|---|---|---|---|
| 256x256 RGBA | ~20 KB | 0.25 MB | 0.33 MB |
| 512x512 RGBA | ~80 KB | 1 MB | 1.33 MB |
| 1024x1024 RGBA | ~200 KB | 4 MB | 5.3 MB |
| 2048x2048 RGBA | ~600 KB | 16 MB | 21 MB |
| 4096x4096 RGBA | ~2 MB | 64 MB | 85 MB |

**Cap non-hero textures at 1024.** Cap the whole game by listing every texture and adding these
numbers up before you ship. A runtime `DynamicTexture` is always uncompressed RGBA in VRAM and
can never be KTX2, so size canvas textures by what they actually need.

### Texture size decision table

| Use | Size | Notes |
|---|---|---|
| Blob shadow / glow disc | 64x64 | Generated at runtime |
| Gradient ramp | 256x1 or 256x4 | Generated at runtime |
| Detail / grain overlay | 128x128 | Greyscale, tiling |
| Matcap | 256x256 each, packed 4x4 into 1024 | |
| Prop atlas | 1024x1024 | One per material |
| Floor / wall tiling | 256x256 | Separate from the atlas so mips are safe |
| Text / signage canvas | 1024x1024 shared, regions per label | Uncompressed in VRAM. Budget it |
| Anything else | Question whether it should exist | |

### Channel packing

If you ship non-colour maps at all, pack three greyscale maps into RGB. The convention is ORM:
AO in R, roughness in G, metallic in B. One sample instead of three, one third the memory, one
sampler slot instead of three. A stylised browser game probably should not ship ORM at all, but
the idea generalises: pack an AO mask, an emissive mask and an "is interactive" mask into one RGB
texture and read all three in a node material.

## 4. The Babylon static-scene checklist

Apply in this order to a fixed-camera scene, roughly descending by payoff.

```js
// engine
new BABYLON.Engine(canvas, true, { powerPreference: "high-performance",
                                   doNotHandleContextLost: false }, true);
engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio, 2));

// scene
scene.performancePriority = BABYLON.ScenePerformancePriority.Aggressive;
scene.autoClear = false;                 // only if a skybox/background covers the viewport
scene.autoClearDepthAndStencil = false;  // only if you do not need the depth buffer cleared
scene.skipPointerMovePicking = true;
scene.blockMaterialDirtyMechanism = true;  // while building, then false
scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
camera.maxZ = /* just past the far edge of the playfield */;

// geometry
const merged = BABYLON.Mesh.MergeMeshes(staticMeshes, true, true, undefined, false, true);
merged.freezeWorldMatrix();
merged.doNotSyncBoundingInfo = true;
merged.alwaysSelectAsActiveMesh = true;
merged.cullingStrategy =
  BABYLON.AbstractMesh.CULLINGSTRATEGY_OPTIMISTIC_INCLUSION_THEN_BSPHERE_ONLY;
merged.convertToUnIndexedMesh();   // only when vertex reuse is low, e.g. flat-shaded geometry

// materials
mat.disableLighting = true;   // where light is baked
mat.freeze();

// once everything is built
scene.freezeActiveMeshes();
```

`ScenePerformancePriority.Aggressive` automatically applies material freezing,
`alwaysSelectAsActiveMesh`, `isPickable = false`, `skipPointerMovePicking`, `autoClear = false`,
`skipFrustumClipping`, `doNotSyncBoundingInfo` and
`renderingManager.maintainStateBetweenFrames`. **It turns off picking**, so you need your own hit
testing: a grid lookup from the tap position is arithmetic.

`convertToUnIndexedMesh` is worth calling out for flat-shaded low-poly: with hard normals no
vertex is shared anyway, so the index buffer is pure overhead.

`MergeMeshes` needs 32-bit indices enabled once the merged vertex count exceeds 65,535.

## 5. Instrumentation: measure, do not guess

```js
const si = new BABYLON.SceneInstrumentation(scene);
si.captureFrameTime = true;
si.captureRenderTime = true;
si.captureActiveMeshesEvaluationTime = true;
// si.drawCallsCounter.current  <- the number that matters most

const ei = new BABYLON.EngineInstrumentation(engine);
ei.captureGPUFrameTime = true;         // needs EXT_DISJOINT_TIMER_QUERY
ei.captureShaderCompilationTime = true;
```

**The four numbers to print in a debug overlay and assert in CI:**

1. `drawCallsCounter.current` (target under 50).
2. Total active triangles (target under 50k).
3. Number of distinct materials (target under 8).
4. Sum of `width * height * 4 * 1.33` over all textures (target under 32 MB).

**Instrument on a throttled device, not a laptop.** Chrome DevTools CPU throttling at 4x-6x plus
a mobile emulation profile is the minimum; a real mid-range Android after 60 seconds of play is
the real test.

**Instruments are guilty until proven innocent.** A counter that reads 0 because you never
enabled its capture flag looks exactly like a pass. Prove the instrument moves before you trust
a number it reports.

## 6. Where the frame time goes

| Symptom | Likely cause | Fix |
|---|---|---|
| High CPU, low GPU | Too many draw calls, active mesh evaluation, per-frame allocations | Merge, instance, freeze, `TmpVectors` instead of `new Vector3()` in the loop |
| GPU frame time high, few triangles | Fill rate: overdraw from transparency, a post pass, or too-high DPR | Cut alpha-blended coverage, drop the post pass, cap DPR at 2 |
| Stutters at first sight of a prop | Shader compilation | Warm materials at load with `material.forceCompilation` before the first frame |
| Memory grows over a session | Textures and meshes not disposed, DynamicTextures recreated | Dispose eagerly; reuse one DynamicTexture with regions |
| Fine on wifi, slow to start on 4G | Download size | GLB compression, smaller atlases, generate more at runtime |
| Fine for 30 s then halves | Thermal throttling | Reduce sustained GPU load: cap DPR, less overdraw, fewer passes |

## 7. glTF / GLB delivery

**Never ship a raw Blender export.** Run every GLB through glTF-Transform in the build.

```
gltf-transform dedup   in.glb a.glb   # remove duplicate accessors/textures
gltf-transform weld    a.glb  b.glb   # merge duplicate vertices
gltf-transform join    b.glb  c.glb   # merge meshes, reduce draw calls
gltf-transform prune   c.glb  d.glb   # drop unused nodes/materials/attributes
gltf-transform meshopt d.glb  e.glb   # or: quantize, or: draco
gltf-transform resize  e.glb  f.glb --width 1024 --height 1024
gltf-transform webp    f.glb  out.glb # or ktx2/basisu
```

One-shot form, accepting that the defaults are not ideal for every scene:
`gltf-transform optimize in.glb out.glb --compress draco --texture-compress webp --texture-resize 1024`

### Geometry compression

| Option | Size saving | Decode cost | Use when |
|---|---|---|---|
| **Quantize** (`KHR_mesh_quantization`) | 35-50 percent memory on big meshes; float32 32 bytes/vertex down to ~20 | **Zero** decoder | Default for small stylised meshes. No WASM, no extra JS |
| **Meshopt** (`EXT_meshopt_compression`) | Comparable to Draco on small meshes | Small, very fast decoder | Best general choice when you want compression |
| **Draco** (`KHR_draco_mesh_compression`) | 60-90 percent on vertex data | Heaviest: a WASM decoder plus per-mesh decode | Large meshes where download dominates |

**Recommendation:** for props of a few hundred to a few thousand triangles the Draco decoder
(hundreds of KB of WASM) can cost more than it saves. Use **quantize** or **meshopt**. Reach for
Draco only if total geometry exceeds a megabyte.

### Texture format

| Format | Download | GPU memory | Support |
|---|---|---|---|
| PNG | large | full uncompressed RGBA | universal |
| WebP | 50-70 percent smaller than PNG/JPEG | full uncompressed RGBA (still decompressed on upload) | universal in current browsers |
| **KTX2 / Basis** (`KHR_texture_basisu`) | small | **stays compressed: 4-8x less VRAM** | needs a transcoder; universally supported on modern mobile |

**The distinction most guides blur: WebP saves download, KTX2 saves GPU memory.** On a phone GPU
memory is usually the binding constraint. For a game whose textures are mostly runtime-generated
canvases this barely applies, which is another argument for the canvas-texture approach.

### File size budgets

- Individual prop GLB: **under 30 KB** after compression. A beveled 500-triangle prop with vertex
  colours and no textures compresses to a few KB.
- A whole prop set (30 props): **under 500 KB**.
- Total 3D download for a game: **under 2 MB**, hard ceiling 5 MB.
- Time to first interactive frame on a mid phone on 4G: budget 3 seconds, roughly 1.5-2 MB.
