# Godot web export

Web is the Godot target for browsers (static hosts, portals, the game's own site). It is not the
mobile route for a standalone game: phones get Godot's native Android / iOS export
([mobile-export.md](mobile-export.md)). The Capacitor WebView route in section 6 is WA only.
Everything here follows the official page; read it before changing an export:
https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html

Related: https://docs.godotengine.org/en/stable/tutorials/rendering/renderers.html ,
https://docs.godotengine.org/en/stable/tutorials/io/data_paths.html

---

## 1. Hard constraints

| Constraint | Detail |
|---|---|
| Renderer | **Compatibility only** (WebGL 2.0). Forward+ and Mobile do not run on the web. Set the project renderer to `gl_compatibility`, or add a web-only override `rendering/renderer/rendering_method.web="gl_compatibility"`. |
| Language | **GDScript.** C# projects cannot export to Web in Godot 4 (still true on 4.7.2). |
| GDExtension | Needs a separate web build of the extension and the "Extensions Support" export option, which also requires cross-origin isolation. Avoid for web. |
| Networking | HTTP (`HTTPRequest`, which uses fetch), WebSocket, WebRTC. No raw TCP/UDP. |
| Threads | Single-threaded by default since 4.3. Do not design around `Thread` / `WorkerThreadPool` for a single-threaded web export. |

## 2. Threads and cross-origin isolation

**Single-threaded export is the default and the preferred choice** (since 4.3). It needs no
`SharedArrayBuffer`, no special headers, and works on plain static hosts, itch.io, Poki,
CrazyGames, inside iframes, and inside a WebView (including the WA Capacitor apps).

Only if the export option **"Thread Support"** is enabled does the game need:

- HTTPS, and
- response headers `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp`.

Those headers cross-origin-isolate the page. That breaks third-party iframes and scripts that do
not send CORP headers (ads, analytics, some fonts) and breaks embedding the game in another
origin's page unless that page also sets matching headers. The PWA export type can inject the
isolation headers through its service worker.

Default stance: **leave Thread Support off.** Turning it on is a decision for the brief, with the
hosting consequences written down.

## 3. Output files and hosting

A release export of a small 2D project to `build/web/index.html` on 4.7.2 produced these files,
named after the export path (the directory must exist first: `mkdir -p build/web`):

| File | Bytes |
|---|---|
| `index.html` | 5,441 |
| `index.js` | 279,815 |
| `index.wasm` | 39,514,754 |
| `index.pck` | 33,508 |
| `index.png` (boot splash) | 21,443 |
| `index.icon.png` | 5,765 |
| `index.apple-touch-icon.png` | 11,939 |
| `index.audio.worklet.js` | 7,298 |
| `index.audio.position.worklet.js` | 2,973 |

With `progressive_web_app/enabled=true` the export adds `index.manifest.json`,
`index.offline.html`, `index.service.worker.js`, `index.144x144.png`, `index.180x180.png` and
`index.512x512.png`. A debug export's wasm was 37.9 MB.

Hosting rules:

- Serve `.wasm` as `application/wasm`. Check the actual `Content-Type` the server returns, both
  locally and in production.
- Compress `.wasm` and `.pck` (gzip or brotli).
- Test locally with the engine's `serve.py` or any static server; add the COOP/COEP headers only
  if Thread Support is on. `python3 -m http.server` (3.14) already serves `.wasm` as
  `application/wasm`.
- Size, measured on the 4.7.2 stock release template: `index.wasm` is 39.5 MB raw, 10.1 MB with
  `gzip -9`, 6.9 MB with brotli. That is the floor for any project on the stock template. Reduce it
  with a custom export template that disables unused modules or 3D; keep textures and audio
  small (VRAM texture compression, trimmed assets) so the `.pck` stays small too.
- Non-resource files (`.json`, `.txt`, `.cfg`) are not exported unless listed in the preset's
  "Filters to export non-resource files" (for example `*.json`).

## 4. Browser behaviour the game must handle

- **Audio needs a user gesture.** Browsers block autoplay. Start or resume audio from the first
  click, tap or key press. Default sample playback (Web Audio, low latency, no bus effects on
  samples) vs Stream mode (full AudioServer, more latency, best with threads): pick in the export
  options and know which one you are on.
- **Fullscreen and mouse capture** must be requested inside an input callback.
- **The game pauses when the tab loses focus.** Do not treat that as a bug.
- **`user://` is IndexedDB**, a virtual filesystem. Saves must be flushed; durability is not
  guaranteed in private browsing. Keep saves small and write them in response to gameplay
  events, not every frame.
- **Safari / WebKit** has WebGL 2 quirks. Test Safari and iOS WebKit, not only Chromium.
- **Mobile web is much slower than native.** Keep to 2D or light 3D, low draw calls, small
  textures, `CPUParticles2D` rather than GPU particles where it matters, and few lights.

## 5. Embedding in the site

- Copy the export into the site's static folder (for an Astro site, `public/<game>/`) and embed
  with `<iframe src="/<game>/index.html">`, or
- use a Custom HTML Shell (Project > Export > Web) with the `Engine` JS API
  (`new Engine(config).startGame({ executable: "index", ... })`). The placeholders the 4.7.2
  exporter substitutes in a shell are `$GODOT_URL`, `$GODOT_PROJECT_NAME`, `$GODOT_HEAD_INCLUDE`,
  `$GODOT_CONFIG`, `$GODOT_SPLASH`, `$GODOT_SPLASH_CLASSES`, `$GODOT_SPLASH_COLOR` and
  `$GODOT_THREADS_ENABLED` (start from the stock `index.html` the export writes).
- JavaScript interop from GDScript (all three exist in 4.7.2): `JavaScriptBridge.eval("...")`,
  `JavaScriptBridge.get_interface("window")`, `JavaScriptBridge.create_callback(callable)`. Use
  it to reach the host page's own APIs (for a WA game, the WA score and leaderboard API, WA only); `HTTPRequest` also works (it uses fetch). Guard
  it with `OS.has_feature("web")` so desktop runs do not break.

## 6. Godot inside the WA Capacitor apps (WA only)

This section applies only to a Weekly Arcade game that must ship inside the WA Capacitor apps.
A standalone Godot game uses Godot's native Android / iOS export ([mobile-export.md](mobile-export.md))
and is never wrapped in Capacitor. Godot's native exports do **not** run inside Capacitor. The two
routes are:

1. **Web export inside Capacitor's WebView** (WA only, for WA games in the WA apps). Use the single-threaded export.
   WKWebView needs the files served through the Capacitor scheme (`capacitor://`), not `file://`.
   COOP/COEP threading is unlikely to work there, which is another reason to stay
   single-threaded. WKWebView memory limits matter; keep the wasm heap and textures small.
2. **Native Godot apps** exported with Godot's own Android / iOS export (see mobile-export.md).
   Separate store binaries, not Capacitor apps. This is the route for every standalone game.

Do not mix the two in one app.

## 7. Verify in a browser

A successful export command is not a working web build. In headless Chrome a healthy 4.7.2
single-threaded build logs the engine banner, a renderer line naming WebGL 2.0 and
`Compatibility`, and `Emscripten 4.0.20, single-threaded, no GDExtension support` in the
console, then the game's own output. After every web export:

1. Serve the folder over HTTP (not `file://`).
2. Load it in a real browser (Chrome DevTools MCP or Playwright MCP), check the console for
   errors, check the `.wasm` Content-Type in the network panel.
3. Click once, confirm audio starts and input works.
4. Take a screenshot at a phone viewport (for example 390x844) and at desktop.
5. Record load time and the transferred size of `.wasm` and `.pck`.
6. Repeat in Safari / WebKit for anything going to iOS.
