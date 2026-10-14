---
name: godot
description: >
  Godot 4 game development the way the Godot editor and the official documentation do it.
  The editor and docs.godotengine.org (stable, Godot 4.7.x) are the source of truth; no house
  conventions are layered on top. Covers version and renderer detection, project layout and
  file conventions (.uid, .import, .godot/, official .gitignore, naming), scene and node
  architecture (signals up calls down, composition, Resources, autoloads, groups, scene unique
  nodes, @export), the official GDScript style guide and static typing, creating and editing
  scenes and resources without a GUI (headless SceneTree builders, PackedScene.pack, owner,
  ResourceSaver), the headless validation loop, testing with GUT and gdUnit4, input, physics,
  tweens, saving, export (native Android and iOS for mobile, Web for browsers), performance, version control,
  editor plugins, the bundled godot MCP server, a pre-ship checklist and anti-patterns.
trigger: >
  When the user mentions Godot, GDScript, Godot 4, a .gd, .tscn, .tres, .gdshader or .import
  file, export_presets.cfg, or when project.godot exists in the working tree. Also when asked to
  build, fix, port, test or export a Godot game, or to convert a Godot 3 project.
---

# Godot 4

**The Godot editor is the source of truth.** Build a Godot project the way the editor would
build it and the way the official documentation says to. This skill adds no studio conventions
on top of Godot's. When it is unclear what to do, answer two questions and do that:

1. What would the editor do or write here?
2. What does https://docs.godotengine.org/en/stable/ say? Cite the page you followed.

If this skill and the official docs disagree, **the docs win**. Say so in your report so the skill
can be fixed.

Act from this file. Open a reference when you need the long table or the full recipe.

| Need | File |
|---|---|
| Godot 3 API you need to translate, or code you suspect is Godot 3 | [references/godot3-to-4-renames.md](references/godot3-to-4-renames.md) |
| Full headless scene / resource builders, the CI validation script, export commands | [references/headless-scene-builder.md](references/headless-scene-builder.md) |
| Web export, hosting, browser behaviour, embedding, WA Capacitor WebView (WA only) | [references/web-export.md](references/web-export.md) |
| Native Android and iOS export (the default mobile route), toolchains, signing | [references/mobile-export.md](references/mobile-export.md) |
| GUT and gdUnit4 setup, example tests, CLI flags | [references/testing.md](references/testing.md) |
| Writing an EditorPlugin, enabling and vendoring addons | [references/editor-plugins.md](references/editor-plugins.md) |

**Verified against a real engine.** The commands, recipes and API names in this skill and its
references were run on Godot 4.7.2.stable (macOS, Homebrew cask, Oct 2026) or checked against
that build's ClassDB (`--doctool`) and source. Anything still marked *(unverified)* was not
runnable here; check it against the cited page or the class reference
(https://docs.godotengine.org/en/stable/classes/) before depending on it.

---

## Step 0: Game context

Load `game-context` first. WA-specific steps below are marked (WA only); skip them for standalone games.

## 1. Version baseline

- Current stable: **Godot 4.7.2** (18 Aug 2026). 4.7.0 shipped 18 Jun 2026. Maintained older
  branches: 4.6.3, 4.5.2. 4.8 is in dev snapshots. Sources: https://godotengine.org/download/archive/ ,
  https://docs.godotengine.org/en/stable/about/release_policy.html
- `docs.godotengine.org/en/stable/` currently documents 4.7.

**Never assume the version or renderer. Read them.**

```bash
grep -n 'config/features' project.godot
# config/features=PackedStringArray("4.7", "GL Compatibility")
grep -n 'rendering_method' project.godot
"$GODOT" --version
```

- `config/features` names the engine minor version the project was saved with and the renderer
  (for example "GL Compatibility"); `rendering_method` under `[rendering]` confirms it.
- If the project is on an older 4.x, write code for **that** version. Do not upgrade the project
  unless the brief says so. If you do upgrade, use Project > Tools > Upgrade Project Files (or open
  and re-save in the editor) and read the matching `upgrading_to_godot_4.x` page.
- If it is a Godot 3 project (no 4.x entry in `config/features`, a `.import/` cache folder at the
  root, `config_version=4`; Godot 4 writes `config_version=5`), stop and report.
  Porting is its own brief; see the renames reference.
- A `.cs` file or a `.csproj` means a C# (.NET) project. It needs the .NET editor build and cannot
  export to Web.

What changed recently and bites generated code:

| Version | Change |
|---|---|
| 4.6 | `.tscn` `[node]` headers carry `unique_id=`; `load_steps` dropped; Jolt default physics for new 3D projects; "Modern" editor theme |
| 4.7 | Mouse / keyboard device ids are `InputEvent.DEVICE_ID_MOUSE` (32) / `DEVICE_ID_KEYBOARD` (16), not 0; packed array element assignment no longer calls property setters; an override of a method with a typed return inherits that return type, so every code path needs a `return` (otherwise "Not all code paths return a value"); `Object.is_class` takes `StringName`; HDR output, `AreaLight3D`, `VirtualJoystick` node, new Asset Store, GABE (standalone Android build environment) |

Sources: https://godotengine.org/releases/4.6/ , https://godotengine.org/releases/4.7/ ,
https://docs.godotengine.org/en/stable/tutorials/migrating/upgrading_to_godot_4.7.html

---

## 2. Editor is the source of truth: principles

1. **Do it in the editor's terms.** Plan and describe work as scenes, nodes, resources, signals,
   groups, autoloads, Project Settings, Input Map actions and export presets. Not as "modules",
   "services" or "managers" invented on the side.
2. **Let Godot write Godot's files.** Scenes, resources, `.import` and `.uid` files are serialized
   by the engine. Generate them through the engine (headless builder or MCP tools), never by
   typing structure from memory.
3. **Settings live in Project Settings.** Input actions, physics layer names, autoloads, renderer,
   window size, GDScript warnings: all in `project.godot` under the keys the editor uses. Do not
   build a parallel config system.
4. **Follow the project's existing conventions when they are Godot's.** If the project already
   types everything, type everything. If it is untyped, match it (the docs say not to mix) and
   raise typing as a suggestion. If a project has drifted from the official guidance, do not
   silently "fix" the whole tree; report it.
5. **No layer of our own.** No custom scene format, no wrapper around signals, no home-made
   service locator, no extra naming prefixes, no folder scheme beyond what the docs recommend.
6. **When in doubt, cite.** Every non-obvious decision in a report names the docs page it
   follows.

---

## 3. Project layout and file conventions

Sources (under https://docs.godotengine.org/en/stable/):
`tutorials/best_practices/project_organization.html`, `tutorials/io/data_paths.html`,
`tutorials/best_practices/version_control_systems.html`.

### Paths

- `res://` is the folder containing `project.godot`. It is **read-only in exported builds**.
- `user://` is the writable per-user folder (macOS `~/Library/Application Support/Godot/app_userdata/<name>`,
  Windows `%APPDATA%\Godot\app_userdata\<name>`, Linux `~/.local/share/godot/app_userdata/<name>`).
  On Web it is IndexedDB.

### Files Godot manages

| File / folder | What it is | Commit? |
|---|---|---|
| `project.godot` | INI-like project settings. Prefer editing through Project Settings; hand-edits are fine if section and key names are exact | Yes |
| `.godot/` | Editor cache: imported assets, `global_script_class_cache.cfg`, `uid_cache.bin`, `export_credentials.cfg`. Rebuilt by the editor or `--import` | **Never** |
| `*.import` (next to each asset) | Import settings, uid, path into `.godot/imported` | Yes. Never hand-write |
| `*.uid` (4.4+, next to `.gd`, `.cs`, `.gdshader`, `.gdshaderinc`) | One line `uid://...` | Yes. Move and rename together with the script |
| `export_presets.cfg` | Export presets, no secrets | Yes |
| `addons/` | Third-party and editor plugins | Yes |
| `*.translation` | Generated from CSV / PO | No (the CSV / PO is the source) |

If a `.uid` merge conflict happens: delete the stray `.uid`, let the editor (or `--import`)
recreate it, then fix references.

### Official .gitignore

Use the editor's generated one (Project Manager "Git" option, or Project > Version Control >
Generate Version Control Metadata). In 4.7.2 that writes `.gitignore` as
`# Godot 4+ specific ignores`, `.godot/`, `/android/`, and `.gitattributes` as
`* text=auto eol=lf`. The GitHub
`Godot.gitignore` (https://github.com/github/gitignore/blob/main/Godot.gitignore) covers `.godot/`,
`.import/` (the Godot 3 cache), `export.cfg`, `export_credentials.cfg`, `*.tmp`, `*.translation`,
`.mono/`, `data_*/`, `mono_crash.*.json`, `~*.dll`, `.nomedia`, `*.exe`, and optionally `*.pck`.
Fetch the upstream file when creating one rather than retyping it, and add the project's build
output folders (for example `build/`).

### New project without the Project Manager

There is no CLI flag that creates a project. Write the same `project.godot`, `icon.svg`,
`.gitignore`, `.gitattributes` and `.editorconfig` the Project Manager writes, then run
`--import`. The exact file contents are in
[references/headless-scene-builder.md](references/headless-scene-builder.md) section 0.

### Folder organisation

- **Group by feature, close to the scene that uses it**: `res://characters/player/player.tscn`,
  `player.gd`, `player_sprite.png`. Not global `scripts/`, `textures/`, `sounds/` buckets.
- Third-party content goes in top-level `addons/`, even if it is not a plugin.
- An empty `.gdignore` file in a folder stops Godot importing or listing it. Use it for raw
  sources (`.blend`, `.psd`), docs, `node_modules`, and web build output inside the project.

### Naming

- Files and folders: `snake_case` (`player_controller.gd`, `main_menu.tscn`). Mixed case breaks on
  case-sensitive filesystems and inside `.pck` files. Exception: C# scripts are PascalCase to
  match the class.
- Node names: `PascalCase`, matching built-in node naming.
- A scene file is named after its root node in snake_case: `player.tscn` with root `Player`.

---

## 4. Scene and node architecture

The plugin-wide modularity rule is the `game-architecture` skill; this section is its Godot form.

Sources (under https://docs.godotengine.org/en/stable/):
`tutorials/best_practices/scene_organization.html`,
`tutorials/best_practices/scenes_versus_scripts.html`,
`tutorials/best_practices/node_alternatives.html`,
`tutorials/best_practices/data_preferences.html`, `tutorials/scripting/singletons_autoload.html`,
`tutorials/scripting/scene_unique_nodes.html`, `tutorials/scripting/groups.html`.

### Scenes are the unit of reuse

- "Design scenes to have no dependencies if at all possible." Every scene should run on its own
  with F6 (run current scene). The parent wires its children together.
- A common root: `Main` (Node) with `World` (Node2D / Node3D) and `GUI` (Control) children.
- Use **scenes** for game-specific, hierarchy-heavy things (they instance faster than building
  the same tree with `add_child` in code). Use **scripts with `class_name`** for reusable generic
  types.

### Signals up, calls down

- A child **emits signals** about what happened (past tense: `died`, `door_opened`,
  `health_changed`). The parent connects and **calls methods down** on its children.
- Siblings never reach for each other. Their common ancestor mediates.
- Dependency injection options, safest first: signal; method call on the child; a `Callable`
  property; an object reference property; a `NodePath` property.
- No long `get_node("../../Other")` paths across scene boundaries. They break on reuse.

```gdscript
# player.gd (child)
signal died

func take_damage(amount: int) -> void:
	health -= amount
	if health <= 0:
		died.emit()

# level.gd (parent)
func _ready() -> void:
	%Player.died.connect(_on_player_died)
```

Signal API: declare `signal died` (typed params: `signal health_changed(old_value: int, new_value: int)`),
emit with `died.emit()`, connect with `button.pressed.connect(_on_button_pressed)`, bind extra args
with `.bind(x)`, one-shot with `CONNECT_ONE_SHOT`, check with `is_connected()`, remove with
`disconnect()`. Connections made in the editor's Node dock are saved in the `.tscn` as
`[connection]` lines; both editor and code connections are idiomatic.

### Pick the lightest type that does the job

| Type | Use for |
|---|---|
| `Node` and subclasses | Things that live in the tree: need processing, rendering, physics, input |
| `RefCounted` | Plain logic and data classes; the default for non-node code. Auto-freed |
| `Resource` | Serializable, Inspector-editable data: items, stats, level definitions, settings. Saved as `.tres` |
| `Object` | Rare; manual `free()` |

Data belongs in Resources: a `class_name ItemData extends Resource` script with `@export` fields,
instances saved as `.tres` (full example in the headless builder reference).

`load()` returns one cached instance per path. Mutating it changes it for every user. Use
`resource.duplicate()` or "Local to Scene" for per-instance state.

### Autoloads

Project Settings > Globals > Autoload; stored in `project.godot` as `Name="*res://path.gd"`
(the `*` means enabled as a global).

- Use for **global state that must survive scene changes**: settings, save manager, audio
  manager, an event bus of signals. The official criteria: it tracks its own data, needs global
  access, and is isolated.
- Do not move gameplay logic that belongs to a scene into an autoload.
- Never `free()` or `queue_free()` an autoload. They load top to bottom in the list order.
- Do not give an autoload script a `class_name` equal to the autoload name. Autoload scripts
  normally have no `class_name`.

### Groups, unique nodes, exports, owner

- **Groups** are tags: `add_to_group("enemies")`, `get_tree().get_nodes_in_group("enemies")`,
  `get_tree().call_group("guards", "enter_alert_mode")`. Add them in the Node > Groups dock (or
  Project Settings > Globals > Groups for global groups). Names are snake_case. Saved in `.tscn` as
  `groups=["enemies"]`.
- **Scene unique nodes**: right-click > "Access as Unique Name" gives `%Name` (saved as
  `unique_name_in_owner = true`). Resolves only inside the same scene. Prefer
  `@onready var score_label: Label = %ScoreLabel` over `$HUD/Panel/VBox/ScoreLabel`.
- **`@export var target: Node`** lets the Inspector assign references (saved as a NodePath).
  Typed exports work for Resources and arrays: `@export var stats: ItemData`,
  `@export var waves: Array[PackedScene]`. An `@export` read in `_init()` returns the default, not
  the Inspector value; read it in `_ready()`.
- **`owner`** is the scene root that saves a node. A node added in code is not saved with the
  scene unless `node.owner = scene_root`. This is the key to generating scenes headless (section 6).

### Lifecycle and processing

- `_enter_tree` runs top-down; `_ready` runs bottom-up (children first). `@onready` vars resolve
  just before `_ready`. Look up children in `_ready`.
- `_process(delta)`: per-frame visuals and UI. `_physics_process(delta)`: movement and physics
  at the fixed tick (60 Hz default). Scale by `delta`.
- Gameplay input in `_unhandled_input(event)` (GUI gets first refusal); `_input` only to
  pre-empt the GUI.
- Turn off idle loops: `set_process(false)`, `set_physics_process(false)`.
- Changing physics state inside a physics callback: `set_deferred("disabled", true)` or
  `call_deferred(...)`.
- Pause: `get_tree().paused = true` with per-node `process_mode` (Inherit, Pausable, When Paused,
  Always, Disabled).
- `_get_configuration_warnings()` in a `@tool` script surfaces missing children or exports as
  editor warnings, the way built-in nodes do.
- Scene switching: `get_tree().change_scene_to_file("res://x.tscn")`,
  `change_scene_to_packed(packed)`, `reload_current_scene()`. Instancing:
  `var enemy := EnemyScene.instantiate()`.

---

## 5. GDScript style guide

Sources (under https://docs.godotengine.org/en/stable/):
`tutorials/scripting/gdscript/gdscript_styleguide.html`,
`tutorials/scripting/gdscript/static_typing.html`,
`tutorials/scripting/gdscript/gdscript_exports.html`,
`tutorials/scripting/gdscript/gdscript_warning_system.html`.

### Official code order

```
01. @tool, @icon, @static_unload
02. class_name
03. extends
04. ## doc comment
05. signals
06. enums
07. constants
08. static variables
09. @export variables
10. remaining regular variables
11. @onready variables
12. _static_init() and other static methods
13. overridden built-in virtual methods: _init, _enter_tree, _ready, _process,
    _physics_process, then other virtuals
14. remaining public methods
15. private methods (leading underscore)
16. inner classes
```

### Naming

| Thing | Style | Example |
|---|---|---|
| File | snake_case | `yaml_parser.gd` |
| `class_name` | PascalCase | `class_name YAMLParser` |
| Node name | PascalCase | `Player`, `ScoreLabel` |
| Function, variable | snake_case | `func load_level()`, `var move_speed` |
| Private member | leading `_` | `var _counter`, `func _recalculate()` |
| Signal | snake_case, past tense | `signal door_opened` |
| Constant, enum member | CONSTANT_CASE | `const MAX_SPEED = 200`, `enum Element { EARTH, WATER }` |
| Enum name | PascalCase | `enum Element` |
| Signal callback | `_on_<node>_<signal>` | `_on_hit_timer_timeout` |

### Formatting

- **Tabs** for indentation, one per level (the editor default; mixing errors).
- Lines under 100 characters, aim for 80.
- Two blank lines between functions.
- Double quotes. `and` / `or` / `not` rather than `&&` / `||` / `!`.
- `0.5` not `.5`; `1_000_000` for big numbers; lowercase hex.
- Trailing comma in multi-line arrays, dictionaries and enums.
- One statement per line, no semicolons, no parentheses around conditions.

### Static typing

The docs recommend it: it catches errors earlier and is faster.

```gdscript
var health: int = 100
var direction := Vector2.ZERO          # inferred
@onready var bar: ProgressBar = %HealthBar
var enemies: Array[Enemy] = []
var scores: Dictionary[String, int] = {}   # typed dictionaries since 4.4

func take_damage(amount: int) -> void:
	health = maxi(health - amount, 0)
```

- `as` returns `null` on a type mismatch; test with `is` first when unsure.
- 4.7: an override of a method with a typed return inherits that type, so every path must
  `return` a value. Untyped `func _ready():` still parses, but write `-> void` anyway for a typed
  project.
- Pick one style per project. The docs advise against mixing typed and untyped code.

### Warnings as errors

Project Settings > Debug > GDScript; warning names equal setting names, and in `project.godot`
the value `2` means Error (`[debug] gdscript/warnings/untyped_declaration=2`). For a typed
project these are worth setting to Error so `--import` and `--check-only` catch them in CI:
`UNTYPED_DECLARATION`, `INFERENCE_ON_VARIANT`, `UNSAFE_METHOD_ACCESS`, `UNSAFE_PROPERTY_ACCESS`,
`UNSAFE_CALL_ARGUMENT`, `UNUSED_VARIABLE`, `UNUSED_PARAMETER`, `SHADOWED_VARIABLE`,
`INTEGER_DIVISION`, `NARROWING_CONVERSION`, `RETURN_VALUE_DISCARDED`.

Change these only with the brief's agreement; they are project settings, not yours to impose.
Suppress a single case with `@warning_ignore("unused_parameter")`, or a region with
`@warning_ignore_start(...)` / `@warning_ignore_restore(...)`.

### Language features to use (4.x)

- Properties with a setter block on indented lines (the one-line form is a parse error,
  "Property with inline code must go to an indented block"):
  ```gdscript
  var hp: int:
  	set(value):
  		hp = clampi(value, 0, max_hp)
  ```
  `await some_signal`;
  `await get_tree().process_frame`; `super()` to call a parent override (no implicit chaining).
- Lambdas, `match` with `when` guards, `static var` / `static func`, `@abstract` and variadic
  `func f(a, ...args)` (4.5+).
- `preload()` with a constant path; `load()` or `ResourceLoader.load_threaded_request()` for
  dynamic or large resources. `StringName` literals for hot lookups (`&"jump"`).
- Typed helpers `clampf` / `clampi`, `maxf` / `maxi`, `absf` / `absi`, `floori`. `int / int` is
  an int (and warns): use `float(a) / b`. No `randomize()` needed at startup.
- `push_error`, `push_warning`, `print_debug`, `assert(cond, "msg")` (stripped in release).
- Export hints: `@export_range`, `@export_enum`, `@export_file`, `@export_dir`,
  `@export_multiline`, `@export_flags`, `@export_node_path`, `@export_group` / `_subgroup` /
  `_category`, `@export_storage`, `@export_tool_button` (4.4+).

**GDScript, not C#**, by default: C# cannot export to Web and its mobile export is
experimental. Source: https://docs.godotengine.org/en/stable/tutorials/scripting/c_sharp/index.html

---

## 6. Creating and editing scenes and resources without a GUI

Agents have no editor window. The rule: **Godot serializes Godot's files.** In order of
preference:

1. **A headless SceneTree builder script** that constructs nodes, sets `owner`, packs with
   `PackedScene.pack()` and saves with `ResourceSaver.save()`. Output is the editor's format
   (`format=3`, generated `ext_resource` / `sub_resource` ids, `unique_id=`) with one difference:
   outside the editor no `uid=` attributes are written, on the scene header or on
   `ext_resource` lines. The uid writer is registered only by the running editor's
   filesystem. Paths still load, and the editor adds the uids the next time it saves the
   scene. Do not add them by hand.
2. **The bundled `godot` MCP server's scene tools** (`create_scene`, `add_node`,
   `set_node_properties`, `attach_script`, `connect_signal`, `batch_scene_operations`, and so on;
   section 15). They drive the same engine APIs headless.
3. **A hand-edit of the `.tscn` / `.tres` text**, only for tiny safe changes.

Minimal builder (full versions, including editing an existing scene and creating a `.tres`, are in
[references/headless-scene-builder.md](references/headless-scene-builder.md)):

```gdscript
# res://tools/build_level.gd
# "$GODOT" --headless --path . --script res://tools/build_level.gd --quit-after 300
extends SceneTree


func _init() -> void:
	var root := Node2D.new()
	root.name = "Level"
	var sprite := Sprite2D.new()
	sprite.name = "Sprite2D"
	sprite.texture = load("res://icon.svg")
	root.add_child(sprite)
	sprite.owner = root  # REQUIRED or the child is not packed
	var packed := PackedScene.new()
	var err := packed.pack(root)
	if err == OK:
		DirAccess.make_dir_recursive_absolute("res://levels")  # save fails (error 19) without it
		err = ResourceSaver.save(packed, "res://levels/level.tscn")
	root.free()
	quit(0 if err == OK else 1)
```

- Always pass `--quit-after <N>` when running a builder. A runtime error inside `_init()` stops
  the function before `quit()`, and without `--quit-after` the process never exits.
- Place instanced sub-scenes with `instantiate(PackedScene.GEN_EDIT_STATE_INSTANCE)`, as the
  editor does; a plain `instantiate()` still links the instance but adds a `type=` attribute the
  editor would not write.
- Groups are saved only with `add_to_group("name", true)`; signal connections only with
  `CONNECT_PERSIST`.

Then run `--import` so `.uid` / `.import` sidecars and the class cache are created, and validate
(section 7).

### Never

- **Never invent a `uid://` value, an `ext_resource` id, or a `unique_id`.** A path-only
  `ext_resource` still loads, and Godot assigns a uid on next save. A stale or duplicated uid is
  worse than none. If you need a real uid, read it from the target's `.uid` file, `.import` file
  or header, or use `ResourceLoader.get_resource_uid(path)` with `ResourceUID.id_to_text(id)`.
- Never add `load_steps=` (deprecated and ignored since 4.6).
- Never hand-write `.import` or `.uid` files.
- Never hand-write Input Map entries (`[input]` is serialized `InputEvent` objects). Use the
  editor, or a headless script that calls `ProjectSettings.set_setting("input/<action>", ...)`
  and `ProjectSettings.save()`, so Godot serializes them (recipe in the headless builder
  reference). The bundled MCP server can read project settings but has no tool that writes
  input actions. `InputMap.add_action()` / `action_add_event()` change only the running game.
- Never hand-write a new scene with more than a couple of nodes, or anything with
  `sub_resource`s, AnimationPlayer tracks, TileSets, Themes, SpriteFrames, materials or meshes.

### Safe hand-edits

Minimal diffs, existing ids kept: change a number, string, colour or exported value; add
`groups=[...]`; add a `[connection]` line after the nodes; change a script path; edit
`project.godot` keys, `export_presets.cfg` values, `plugin.cfg`, `.gdignore`. Format rules
(section order, `parent` paths, id style) are in the headless builder reference and
https://docs.godotengine.org/en/stable/engine_details/file_formats/tscn.html

After any generation or re-save, read `git diff`. Godot normalises whitespace, drops `;` comments,
and may add `unique_id=` and `.uid` files. Lost nodes, lost connections or a flattened sub-scene
are bugs.

`EditorScript` (`@tool extends EditorScript`, `_run()`) and `@tool` scripts need the editor; they
are for humans in the editor, not for headless agents. `EditorInterface` is a singleton since 4.2.

---

## 7. CLI and the headless validation loop

Source: https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html

Set `GODOT` to the binary (section 15 covers installing it):
`export GODOT="${GODOT_PATH:-/Applications/Godot.app/Contents/MacOS/Godot}"`.

**Run this loop after every change. It is the definition of "done".**

```bash
# 1. Import: builds .godot/, class cache, missing .uid / .import sidecars
"$GODOT" --headless --path . --import 2>&1 | tee /tmp/godot-import.log

# 2. Parse-check each changed script (exit code is 0 even on a parse error: grep the output)
"$GODOT" --headless --path . --check-only --script res://path/to/changed.gd 2>&1 | tee /tmp/godot-check.log

# 3. Smoke run the main scene (or --scene res://x.tscn) for N iterations
"$GODOT" --headless --path . --quit-after 120 2>&1 | tee /tmp/godot-smoke.log

# 4. Grep. Godot exits 0 with script, parse and load errors.
grep -nE 'SCRIPT ERROR|Parse Error|ERROR:|Failed loading' /tmp/godot-import.log /tmp/godot-check.log /tmp/godot-smoke.log

# 5. Tests (section 8), then an export dry run for the target (section 10)
```

- **The exit code is not enough.** Measured on 4.7.2: `--check-only` on a file with a parse
  error, a smoke run with runtime `ERROR:` lines, and a `--script` with a runtime error all exit
  0. Always grep the output. Zero matches is the pass condition; any match is either fixed or
  explicitly explained in the report.
- `--import` does not parse-check scripts; a broken script imports cleanly. Step 2 or the CI
  script's in-tree check is what catches it.
- `--check-only` checks one file in isolation. It needs step 1 first for `class_name`
  resolution (before it: "Identifier not declared"). It **cannot see autoload names**, even
  when the autoload is registered: a script using one reports `Compile Error: Identifier not
  found`. For such scripts, and for checking a whole project, use the CI script in the
  headless builder reference, which loads every script inside a running SceneTree where
  autoloads exist. Neither replaces the smoke run.
- Running Godot can rewrite project files. Review `git diff` after the loop.
- There is no `--doctor` flag (`--help` lists every flag).
- The full CI script (checks every tracked `.gd`, smoke run, tests, aggregates failures) is in
  [references/headless-scene-builder.md](references/headless-scene-builder.md).

Other documented flags (`--scene`, `--fixed-fps`, `--write-movie`, `--print-fps`, `--log-file`,
`--` for user args) are listed in the reference and on the command line page.

---

## 8. Testing

There is no first-party test framework and no official testing guide. The two community
standards are **GUT** and **gdUnit4**, both installed as addons in `addons/` and run headless.
Install, example tests, CLI flags and version notes are in
[references/testing.md](references/testing.md).

```bash
# GUT (-ginclude_subdirs is needed for tests in res://test/unit/ and similar)
"$GODOT" --headless --path . -s addons/gut/gut_cmdln.gd -gdir=res://test -ginclude_subdirs -gexit
# gdUnit4 v6.2.2 (exit 0 pass, 100 fail; JUnit XML in reports/report_N/results.xml)
"$GODOT" --headless --path . -s res://addons/gdUnit4/bin/GdUnitCmdTool.gd \
	--ignoreHeadlessMode -a res://test --report-directory reports
```

- Use whichever framework the project already has. Do not add a second one.
- Run `"$GODOT" --headless --path . --import` first on a fresh clone or after adding the addon.
  Without it gdUnit4's runner fails to parse (`Could not find type "GdUnitTestCIRunner"`) and
  **exits 0**.
- Both frameworks exit 0 when they find no tests: GUT prints "Nothing was run", gdUnit4 prints
  "No test cases found, abort test run!". Check the test count, not just the exit code.
- gdUnit4 without `--ignoreHeadlessMode` refuses to run headless and exits 103.
- Keep logic in `RefCounted` and `Resource` classes with no scene dependency so it tests
  headless. Keep node scripts thin.
- Autoloads are not in the tree during a `--script` SceneTree's `_init` (they appear after
  `await process_frame`); run tests through the framework's runner.

---

## 9. Input, physics, tweens, data and saves

Sources (under https://docs.godotengine.org/en/stable/): `tutorials/inputs/inputevent.html`,
`tutorials/physics/physics_introduction.html`, `classes/class_tween.html`,
`tutorials/io/saving_games.html`, `tutorials/scripting/resources.html`,
`tutorials/i18n/internationalizing_games.html`.

### Input

- Define actions in Project Settings > Input Map. Code uses **actions, never raw keycodes**:
  `Input.is_action_just_pressed(&"jump")`, `Input.get_vector(&"move_left", &"move_right",
  &"move_up", &"move_down")`, `Input.get_axis()`, and `event.is_action_pressed(&"jump")` in
  `_unhandled_input`.
- Built-ins `ui_accept`, `ui_cancel`, `ui_left` and so on already exist.
- Touch: `InputEventScreenTouch` / `InputEventScreenDrag`; the `emulate_mouse_from_touch` setting;
  4.7's `VirtualJoystick` node for on-screen sticks.
- 4.7: compare device ids with `InputEvent.DEVICE_ID_MOUSE` / `DEVICE_ID_KEYBOARD`, not 0.

### Physics

- Name layers in Project Settings > Layer Names (`[layer_names] 2d_physics/layer_1="world"`).
  Layer is what I am; mask is what I scan for.
- `StaticBody`, `RigidBody` (custom forces in `_integrate_forces`), `CharacterBody`
  (`move_and_slide()`), `Area` (detection). All in `_physics_process`.
- `CharacterBody2D` / `3D`: set the built-in `velocity` property, call `move_and_slide()` (no
  arguments, returns bool), read `is_on_floor()`. **Do not multiply `velocity` by `delta`** before
  `move_and_slide()`; it applies delta itself. Do multiply accelerations such as gravity by `delta`.

```gdscript
extends CharacterBody2D

@export var speed: float = 300.0
@export var jump_velocity: float = -400.0

var _gravity: float = ProjectSettings.get_setting("physics/2d/default_gravity")


func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y += _gravity * delta
	if Input.is_action_just_pressed(&"jump") and is_on_floor():
		velocity.y = jump_velocity
	velocity.x = Input.get_axis(&"move_left", &"move_right") * speed
	move_and_slide()
```

`physics/2d/default_gravity` is a float, default `980.0` (`physics/3d/default_gravity` for 3D).
4.6+: Jolt is the default 3D physics engine for new projects (the Project Manager writes
`physics/3d/physics_engine="Jolt Physics"`); check which one the project uses before tuning.

### Tweens and animation

- `var tween := create_tween()` then `tween.tween_property(node, "position", target, 0.3)
  .set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)`. Chain with `parallel()`,
  `tween_callback()`, `tween_interval()`; await `tween.finished`.
- Tweens are one-shot. Kill the old one before starting another on the same property.
  `Tween.new()` is invalid. `bind_node(self)` ties its life to a node.
- `AnimationPlayer` animates any property, method or audio track. `AnimationTree` (with an
  AnimationPlayer) for state machines and blend spaces:
  `anim_tree["parameters/playback"].travel("run")`. For simple feel and UI, AnimationPlayer plus
  tweens is enough.
- Timers: `await get_tree().create_timer(1.0).timeout` or a `Timer` node. Time:
  `Time.get_ticks_msec()`, `Time.get_unix_time_from_system()`.

### Data and saves

| Need | Use |
|---|---|
| Static game data (items, stats, levels) | Custom `Resource` classes saved as `.tres` in `res://` |
| Player settings | `ConfigFile` at `user://settings.cfg` |
| Save games | JSON (`JSON.stringify` / `JSON.parse_string`) via `FileAccess` at `user://` |
| Binary blobs | `store_var()` / `get_var()` with `allow_objects` left false |

- **Never use `.tres` / `.res` (ResourceLoader) for save files or anything a player can supply.**
  Loading a resource can instantiate embedded scripts and run arbitrary code. Use JSON or
  `ConfigFile` and validate every field. Never pass `allow_objects = true` on untrusted data.
- `FileAccess.open("user://save.json", FileAccess.WRITE)` returns null on failure; check
  `FileAccess.get_open_error()`. Use `DirAccess` for directories.
- Write only to `user://`. `res://` is read-only in exports.
- The docs' save pattern: nodes in a "Persist" group each implement a method returning their save
  data.

### Localization

CSV or gettext `.po` registered in Project Settings > Localization; `tr("KEY")`, `tr_n()` for
plurals, `TranslationServer.set_locale("fr")`; Controls auto-translate. Commit the CSV / PO, ignore
generated `.translation`.

---

## 10. Export

Standalone releases (version bump, exports, tag, store checklist) go through `/game-release`.

Sources (under https://docs.godotengine.org/en/stable/):
`tutorials/export/exporting_projects.html`, `tutorials/export/exporting_for_web.html`,
`tutorials/export/exporting_for_android.html`, `tutorials/export/exporting_for_ios.html`.

General:

- Presets live in `export_presets.cfg`, created in Project > Export. The CLI preset name must
  match `name=` exactly. Export templates for the exact engine version must be installed
  (macOS `~/Library/Application Support/Godot/export_templates/<version>/`, for example
  `4.7.2.stable/`; the official `.tpz` is a zip whose `templates/` folder goes there).
- **The output directory must exist** or the export fails with exit 1. `mkdir -p` it first.
- Without an editor, a preset needs at least `name`, `platform`, `export_filter`,
  `include_filter`, `exclude_filter` and a non-empty `[preset.N.options]` section; missing ones
  produce `ERROR:` lines (full minimal Web preset in the headless builder reference).
- Non-resource files (`*.json`, `*.txt`) are not exported unless added to "Filters to export
  non-resource files".
- Feature tags (`web`, `mobile`, `debug`, `release`) let code branch:
  `OS.has_feature("web")`. Project settings can carry per-feature overrides (`setting.web=...`).

```bash
mkdir -p build/web
"$GODOT" --headless --path . --export-release "Web" build/web/index.html
```

### Which route ships to phones

- **Standalone Godot game: Godot's own native Android and iOS export is the mobile route.**
  Godot exports natively to both; do not wrap a standalone game's web export in Capacitor.
  Set up `Android`, `Android AAB` and `iOS` presets in `export_presets.cfg` and follow the native
  section below.
- **Weekly Arcade game that must ship inside the WA Capacitor apps (WA only):** the single-threaded
  Web export running in the Capacitor WebView. This is the only case for the WebView route.
- Web on its own (itch.io, portals, the game's own site) is a browser target, not a mobile route.

### Web (browser target)

Full detail in [references/web-export.md](references/web-export.md). The essentials:

- **Compatibility renderer only** (WebGL 2). Forward+ and Mobile do not run on the web.
- **Single-threaded export is the default (4.3+) and preferred.** No `SharedArrayBuffer`, no
  special headers; works on static hosts, game portals, iframes and WebViews.
- **COOP/COEP headers are needed only if "Thread Support" is enabled**
  (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`, plus
  HTTPS). They break third-party embeds and ads. Leave threads off unless the brief requires them.
- **No C# on web.** GDExtension needs its own web build and isolation headers.
- **Audio starts only after a user gesture.** Gate the first sound behind a click, tap or key.
- **`user://` is IndexedDB.** Keep saves small; durability is not guaranteed in private mode.
- **Serve `.wasm` as `application/wasm`**; compress `.wasm` and `.pck`. The 4.7.2 release
  `index.wasm` is 39.5 MB raw, 10.1 MB gzip -9, 6.9 MB brotli -q 11 (measured).
- **(WA only) Godot inside the WA Capacitor apps means the Web export running in the WebView**
  (single-threaded, served through the Capacitor scheme, not `file://`). Standalone games use the
  native export below instead.
- **Check every web export in a real browser** (section 7 of the web reference).

### Android and iOS (native, the default mobile route)

Godot's own native exports, and the route for every standalone Godot game on phones. Toolchain
versions, keystores, Team ID and the renderer notes are in
[references/mobile-export.md](references/mobile-export.md). Short version:

- **Export presets.** Three presets with contiguous indices: `Android` (APK, no Gradle, for
  emulator and sideload), `Android AAB` (Gradle, AAB, Play Store) and `iOS`. One preset cannot
  emit both APK and AAB, and a gap in `[preset.N]` numbering hides every later preset from the CLI.
- **Android (measured on 4.7.2).** JDK 17, build-tools **36.1.0** and `platforms;android-36`
  (the 4.7.2 template targets SDK 36; the docs' 35.x list is stale), NDK optional.
  `java_sdk_path` (the JDK home) and `android_sdk_path` in `editor_settings-4.7.tres`; the debug
  keystore is then generated automatically. `textures/vram_compression/import_etc2_astc=true` is
  required. The build template installs headlessly with `--install-android-build-template` on the
  first `--export-release "Android AAB"`; the release keystore comes from
  `GODOT_ANDROID_KEYSTORE_RELEASE_PATH` / `_USER` / `_PASSWORD`.
- **iOS (measured on 4.7.2, Xcode 26).** Team ID and bundle id in the preset. Export with
  `export_project_only=true`, then archive and `-exportArchive` with xcodebuild yourself: Godot's
  own `.ipa` path either forces Manual signing (fails with Xcode-managed profiles) or runs
  `-allowProvisioningUpdates`, which can change the Apple account. Official 4.7.2 templates do
  not run in the iOS Simulator on Apple silicon (x86_64-only simulator slice); test on a device.
- Renderer: Compatibility (ran on the Android emulator) or Mobile.

---

## 11. Performance

Sources (under https://docs.godotengine.org/en/stable/): `tutorials/performance/index.html`,
`tutorials/performance/general_optimization.html`, `tutorials/performance/using_servers.html`,
`tutorials/performance/optimizing_3d_performance.html`, `tutorials/rendering/renderers.html`.

**Measure, change, measure again.** The docs: profile, optimize, profile again; design and
algorithms beat micro-optimisation; find out whether you are CPU- or GPU-bound first.

- Tools: Debugger > Profiler, Monitors (draw calls, objects, nodes), Visual Profiler,
  `--print-fps`, `Performance.get_monitor()` in code. Report numbers, before and after.
- Renderers: **Forward+** (desktop high end, not web), **Mobile** (newer phones, XR, not web),
  **Compatibility** (OpenGL / WebGL 2; the only web renderer; older and low-end devices).
  Switching renderer can need lighting and environment changes.
- CPU: cache node lookups in `@onready` instead of `get_node` / `find_child` per frame; disable
  idle `_process`; use signals rather than polling; static typing; packed arrays; no per-frame
  allocation in hot loops; ints and `StringName` over strings.
- Many objects: pool nodes (hide plus `process_mode = PROCESS_MODE_DISABLED`) instead of
  instantiate / `queue_free` churn; `MultiMesh` for thousands of identical instances; the server
  APIs (`RenderingServer`, `PhysicsServer2D/3D`) only after profiling shows nodes are the cost.
- 2D: fewer nodes, `TileMapLayer` (4.3+), atlas textures, same texture and material for batching,
  `y_sort_enabled`, `CPUParticles2D` on web and low-end.
- 3D: occlusion culling, LOD and visibility ranges, baked lighting over dynamic, static light bake
  mode, avoid transparency (especially mobile and web), `VisibleOnScreenEnabler3D` to pause
  offscreen work. Mobile and web: few lights, small shadow maps, compressed (VRAM) textures, no
  SSAO / SSR / volumetrics in Compatibility, light post-processing.
- Shader compile stutter: ubershaders / pipeline precompilation (Forward+ and Mobile), or warm up
  materials at load.
- Threads: `WorkerThreadPool` and `Thread` exist, but not on a single-threaded web export.

---

## 12. Version control

Source: https://docs.godotengine.org/en/stable/tutorials/best_practices/version_control_systems.html

- Commit and ignore exactly as in the section 3 table. Line endings via the editor-generated
  `.gitattributes`; on Windows `git config --global core.autocrlf input`.
- Git LFS for large binaries (png, jpg, psd, blend, fbx, glb, ogg, wav, mp3, ttf, otf, binary
  `.scn` / `.res`), set up **before** their first commit. Prefer text `.tscn` / `.tres`.
- One person edits a given `.tscn` at a time. After a merge, `--import` and check for duplicate
  UIDs. An official Git plugin for in-editor version control exists (announced Oct 2025).

---

## 13. Editor plugins and addons

Third-party addons live in top-level `addons/`, committed, enabled in Project Settings > Plugins
(stored as `[editor_plugins] enabled=PackedStringArray("res://addons/x/plugin.cfg")`; without a
GUI, write that key and run `--import`). **Do not edit vendor addon code.** Prefer `class_name`
and scene composition to writing a plugin unless editor tooling is the goal. Writing one
(`plugin.cfg`, `@tool extends EditorPlugin`, the API): [references/editor-plugins.md](references/editor-plugins.md).

---

## 14. Godot 3 code

Most Godot material on the internet, and much of what a model remembers, is Godot 3. **Never write
Godot 3 APIs.** If code you produced, or code you were given, contains any of these, it is wrong
for Godot 4: `yield(`, `export var` / `onready var` without `@`, string-form
`connect("sig", self, "m")`, `KinematicBody2D`, `Spatial`, `instance()`, `move_and_slide(velocity)`
with arguments, `File.new()`, `OS.get_ticks_msec`, `change_scene(`, the `Tween` node, `setget`.
The full table, with the converter commands, is in
[references/godot3-to-4-renames.md](references/godot3-to-4-renames.md).

---

## 15. The bundled `godot` MCP server

The `game-design` plugin's `.mcp.json` declares one server, `godot`, which runs
`npx -y godot-mcp-runtime@3.8.1` with `GODOT_MCP_STRICT` taken from the shell (default `false`):
[godot-mcp-runtime](https://github.com/Erodenn/godot-mcp-runtime) (MIT, in the official MCP
registry, pinned to 3.8.1). There is no official Godot Foundation MCP server. It runs Godot
headless with no addon installed in the project. Tools appear as
`mcp__plugin_game-design_godot__<tool>` and are loaded on demand through tool search.

### What it gives you (39 tools in 3.8.1)

| Area | Tools |
|---|---|
| Project | `launch_editor`, `run_project`, `attach_project`, `detach_project`, `stop_project`, `get_debug_output`, `list_projects`, `check_project`, `validate` |
| Scenes | `create_scene`, `add_node`, `load_sprite`, `save_scene`, `export_mesh_library`, `batch_scene_operations` |
| Nodes | `get_scene_tree`, `get_node_properties`, `set_node_properties`, `attach_script`, `duplicate_node`, `delete_nodes`, `get_node_signals`, `connect_signal`, `disconnect_signal` |
| Config | `list_autoloads`, `add_autoload`, `remove_autoload`, `update_autoload`, `get_project_settings`, `get_project_files`, `search_project`, `get_scene_dependencies` |
| Runtime | `take_screenshot`, `simulate_input`, `get_ui_elements`, `run_script` |
| Profiling | `profile_project`, `start_profiler`, `stop_profiler` |

Use the read tools (`get_scene_tree`, `get_node_properties`, `get_scene_dependencies`,
`get_project_settings`, `search_project`) to understand a project the way the editor shows it.
Use the scene and node tools as an alternative to a builder script. Either way, the validation
loop in section 7 still runs afterwards.

Tested against Godot 4.7.2: `check_project`,
`get_project_settings`, `get_scene_dependencies`, `create_scene`, `add_node`, `load_sprite`,
`attach_script`, `connect_signal`, `set_node_properties`, `get_scene_tree` and `validate` all
worked, and the scene they wrote matched a builder's output (connection saved, `unique_id=`,
no `uid=`). Points to know:

- `create_scene` names the root node `root`. Rename it to the PascalCase scene name (a one-word
  change to the root's `[node name=...]`, which is a safe hand-edit, or build the scene with a
  builder) so it matches the docs' naming.
- Node paths in its tools start at `root` (`root/Player/Sprite2D`).
- Tool output can include `ERROR: N RID allocations ... were leaked at exit` lines from the
  headless Godot it spawns. They are engine shutdown noise from the tool run, not project errors;
  your own validation loop is what counts.
- Mutating tools save the scene immediately; there is no separate commit step.

### Runtime tools, the launch confirmation and strict mode

Verified with Claude Code 2.1.299 and Godot 4.7.2. After an approved `run_project`, these all
worked: `take_screenshot` (PNG saved under `.mcp/godot-runtime/screenshots/`), `simulate_input`,
`run_script`, `get_ui_elements`, `profile_project` (needs `run_project` with `profiling: true`)
and `stop_project`.

- **The launch confirmation.** `run_project` runs the project's own autoloads and scripts, so the
  server asks once per project per server session through MCP elicitation ("Launching a Godot
  project executes arbitrary code in its autoloads and main scene. Proceed?"). In an interactive
  Claude Code session this is a dialog: press Space to tick `confirm`, then select Accept. Esc
  cancels and `run_project` returns "run_project confirmation was cancelled without an explicit
  choice". The prompt appears with or without strict mode.
- **Non-interactive runs (`claude -p`, subagents in print mode, CI).** Claude Code cancels the
  prompt automatically, so `run_project` fails with that same "cancelled" message, strict or not.
  To allow launches there, the user adds an `Elicitation` hook that answers it (verified in `-p`;
  the server name the hook sees is `plugin:game-design:godot`):
  ```json
  {"hooks": {"Elicitation": [{"matcher": ".*godot", "hooks": [{"type": "command",
    "command": "echo '{\"hookSpecificOutput\":{\"hookEventName\":\"Elicitation\",\"action\":\"accept\",\"content\":{\"confirm\":true}}}'"}]}]}}
  ```
  It approves every launch and every Tier 2 `run_script` prompt from this server without asking,
  so it is the user's decision, for projects they trust. Do not add it yourself.
- **The script scanner.** `run_script` source is scanned before it runs. Tier 1 is always blocked
  (`OS.execute` and other process calls, `Expression`, `str_to_var`, `Callable(...)`,
  `Engine.get_singleton`, `load()` or `call()` with a non-literal argument). Tier 2 asks the user
  first (`FileAccess.open`, `DirAccess` writes, `ConfigFile`, `ResourceSaver.save`, `HTTPRequest`
  and other networking, `Image.save_png`). Tier 3 only warns. `run_project` runs the same scan over
  the autoloads and the launched scene's scripts (recursively through instanced scenes) and
  reports findings as warnings. Its own docs call this best effort, not a sandbox.
- **Strict mode (`GODOT_MCP_STRICT=true`) is off by default.** It turns every Tier 2 finding into a
  hard block, including in the project's own scripts: `run_project` then refuses any game whose
  autoloads or launched scene contain `FileAccess.open`, `ConfigFile`, a `load(path_var)` and so on
  (verified: one save-system autoload with `FileAccess.open` gave "Strict mode: refusing to launch
  project because autoload or launched-scene scripts contain Tier 1 primitives"). In Claude Code it
  adds no extra confirmation, because the launch prompt is shown either way. It exists for
  unattended clients that cannot show prompts. A user who wants it runs
  `export GODOT_MCP_STRICT=true` before starting Claude Code (the plugin's `.mcp.json` reads it).
- **`simulate_input` types.** `type: "action"` calls `Input.action_press()`, which polling code
  (`Input.is_action_pressed()` in `_process` / `_physics_process`) sees but `_input()` and
  `_unhandled_input()` do not. To drive event handlers, send `type: "key"` with the bound key (it
  sets both `keycode` and `physical_keycode`). Verified: three `action` taps of `move_right` left
  an `_unhandled_input` counter at 0; three `key` taps of `D` moved it to 3.
- The runtime tools need a running or attached session; without one they return "No active
  runtime session". If `run_project` is refused or cancelled, use the CLI smoke run instead.
- `attach_project` without a Godot process already running reports "bridge not ready" and adds
  `.mcp/` to `.gitignore` and creates `.mcp/godot-runtime/`.
- Never set `GODOT_MCP_DISABLE_SECURITY` or `GODOT_MCP_DISABLE_ELICITATION` (the second removes the
  launch prompt). Do not change the strict setting or add an approval hook for the user.
- When it runs a project, the server injects a temporary `McpBridge` autoload (localhost only,
  per-session token) and removes it on stop. Its artifacts go to `.mcp/godot-runtime/`, which it
  adds to `.gitignore`. Check `git diff` for leftovers anyway.

### Installing Godot for it

Godot is not bundled. On macOS: `brew install --cask godot`, which installs
`/Applications/Godot.app/Contents/MacOS/Godot` and links `godot` into `/opt/homebrew/bin`. The
server tries `godot` on `PATH` first, then `/Applications/Godot.app`, `/Applications/Godot_4.app`
and `~/Applications/Godot.app` (verified: with `godot` off `PATH` it picked the `/Applications`
binary). For any other location, `export GODOT_PATH=/path/to/Godot`
in the shell before starting Claude Code. Do not hardcode `GODOT_PATH` in `.mcp.json`: an invalid
value stops autodetection. Without Godot the server still starts; Godot-dependent tools return
an error asking for `GODOT_PATH`, and file-only tools (settings, search) still work. Node 20+ is
required.

If the server is missing from `/mcp` or failed to start, fall back to the CLI recipes in sections
6 and 7. Nothing in this skill requires the MCP server.

### Optional: live editor control

For driving a running editor (not headless), users can separately add
[hi-godot/godot-ai](https://github.com/hi-godot/godot-ai) (`uvx godot-ai`). It needs an addon
installed in the project, the editor open, and local HTTP and WebSocket ports; it has telemetry.
It is not bundled. Do not install its addon into a project without the brief saying so.

---

## 16. Pre-ship checklist

- [ ] Version and renderer read from `config/features`; code matches that version.
- [ ] No Godot 3 APIs (grep for the traps in section 14).
- [ ] Scenes generated or saved by Godot; no invented uids, ids or `load_steps`.
- [ ] `.uid` and `.import` sidecars present for every new script and asset; `.godot/` not
      committed.
- [ ] Files and folders snake_case; nodes PascalCase; feature-folder layout.
- [ ] Scripts follow the official code order and naming; typing consistent with the project.
- [ ] Signals up, calls down; no cross-scene `../../` paths; autoloads only for global state.
- [ ] Input through Input Map actions; physics in `_physics_process`; `velocity` not
      pre-multiplied by delta.
- [ ] Saves are JSON or ConfigFile in `user://`; no `.tres` saves; untrusted input validated.
- [ ] `--import` clean, script check clean for every changed script (`--check-only`, or the CI
      script's in-tree check for scripts that use autoloads), smoke run clean: zero
      `SCRIPT ERROR` / `Parse Error` / `ERROR:` / `Failed loading` lines.
- [ ] Tests pass headless with the project's framework.
- [ ] Export succeeds headless for each target preset.
- [ ] Web: Compatibility renderer, single-threaded (or headers documented), audio behind a
      gesture, `.wasm` served as `application/wasm`, loaded and played in a real browser, console
      clean, phone viewport screenshot taken.
- [ ] Mobile (standalone): native Android AAB and iOS export succeed from their presets; no
      Capacitor wrapper. (WA only: web export verified inside the WA Capacitor WebView.)
- [ ] Performance measured with the profiler or monitors, numbers in the report.
- [ ] Third-party assets and addons have a license record.
- [ ] `git diff` reviewed for unintended re-saves and MCP leftovers.

---

## 17. Anti-patterns

| Anti-pattern | Why it is wrong | Do instead |
|---|---|---|
| Studio conventions layered over Godot (custom folder schemes, wrappers, prefixes) | The editor and docs are the source of truth | The official layout, naming and APIs |
| Hand-writing a whole `.tscn` from memory | Wrong ids, ordering and property formats; silent load failures | Headless builder or MCP scene tools |
| Inventing `uid://` values or copying them between files | Duplicate or stale uids break references | Omit the uid, or read the real one |
| Adding `load_steps=` | Deprecated and ignored | Omit it |
| Trusting Godot's exit code | Exits 0 with parse, script and load errors (measured on 4.7.2) | Grep the output |
| Godot 3 code (`yield`, `export var`, `onready var`, `KinematicBody2D`, `instance()`, `connect("sig", self, "m")`) | Does not parse or behaves differently in 4.x | See the renames reference |
| `get_node("../../Other")` across scenes | Breaks on reuse | Signals, groups, `@export` references, `%Unique` |
| Children calling parents or siblings directly | Couples scenes | Signals up, calls down |
| Gameplay logic in autoloads | Global state that should belong to a scene | Keep it in the scene; autoload only global services |
| Thousands of nodes for data | Slow, memory heavy | `Resource` / `RefCounted`, MultiMesh, pooling |
| Raw keycodes in gameplay code | Not rebindable, ignores the Input Map | Input Map actions |
| `velocity * delta` passed into `move_and_slide()` | Double-applies delta | Set `velocity`, call `move_and_slide()` |
| Mutating a loaded Resource shared by many nodes | Changes it everywhere | `duplicate()` or Local to Scene |
| `.tres` / `ResourceLoader` for save files | Can execute embedded scripts | JSON or ConfigFile, validated |
| Writing to `res://` at runtime | Read-only in exports | `user://` |
| Forward+ or Mobile renderer for a web build | Unsupported on web | Compatibility |
| Enabling web Thread Support by default | Needs COOP/COEP, breaks embeds and ads | Single-threaded export |
| C# for a web target | Cannot export to web | GDScript |
| Wrapping a standalone Godot game's web export in Capacitor | Godot exports natively to iOS and Android; the WebView adds memory limits, no threads and a second toolchain | Native Android / iOS export presets |
| Committing `.godot/` or skipping `.uid` / `.import` | Cache churn; broken uids on clone | Official `.gitignore`, commit sidecars |
| Editing vendor code in `addons/` | Lost on update | Wrap or extend; report upstream |
| Asserting performance without measuring | Unfalsifiable | Profiler and monitor numbers, before and after |
