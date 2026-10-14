# Headless scene building, validation and export

How an agent with no editor window creates and edits Godot scenes and resources, validates the
project, and exports it. Every recipe here makes **Godot itself** serialize the files, in the
editor's format. Every code block below was run on Godot 4.7.2.stable (macOS) and its output
inspected; the one difference from editor output is called out in section 1.

Sources:
- Command line: https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html
- TSCN format: https://docs.godotengine.org/en/stable/engine_details/file_formats/tscn.html
- PackedScene: https://docs.godotengine.org/en/stable/classes/class_packedscene.html
- ResourceSaver: https://docs.godotengine.org/en/stable/classes/class_resourcesaver.html
- Exporting: https://docs.godotengine.org/en/stable/tutorials/export/exporting_projects.html

Set the binary once per shell. On macOS after `brew install --cask godot`:

```bash
export GODOT="${GODOT_PATH:-/Applications/Godot.app/Contents/MacOS/Godot}"
"$GODOT" --version   # 4.7.2.stable.official.ed1daf0bf
```

Always pass `--path <dir>` (the directory that contains `project.godot`).

**Always pass `--quit-after <N>` when running a `--script` tool.** A runtime error inside
`_init()` stops the function before it reaches `quit()`, and the process then never exits.
`--quit-after 300` ends it after 300 iterations (it still exits 0, so grep the output).

---

## 0. Create a new project

There is no CLI flag that creates a project. The Project Manager (4.7.2,
`editor/project_manager/project_dialog.cpp`) writes these files; write the same ones, then run
`--import`. For the Compatibility renderer (the web renderer):

`project.godot`:

```ini
config_version=5

[application]

config/name="My Game"
config/features=PackedStringArray("4.7", "GL Compatibility")
config/icon="res://icon.svg"

[display]

window/stretch/mode="canvas_items"
window/stretch/aspect="expand"

[physics]

3d/physics_engine="Jolt Physics"

[rendering]

rendering_device/driver.windows="d3d12"
renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
```

For Forward+ the feature is `"Forward Plus"` and `rendering_method="forward_plus"` with no
`.mobile` override; for Mobile, `"Mobile"` and `"mobile"`. The `[display]`, `[physics]` and
`driver.windows` keys are the editor's initial settings for every new 4.7 project.

The other files the Project Manager writes:

- `icon.svg`: the default icon, `editor/icons/DefaultProjectIcon.svg` in the engine source
  (`gh api "repos/godotengine/godot/contents/editor/icons/DefaultProjectIcon.svg?ref=4.7.2-stable" --jq .content | base64 -d > icon.svg`).
- `.gitignore`: `# Godot 4+ specific ignores`, `.godot/`, `/android/`.
- `.gitattributes`: `# Normalize EOL for all files that Git considers text files.`,
  `* text=auto eol=lf`.
- `.editorconfig`: `root = true`, blank line, `[*]`, `charset = utf-8`.

Then `"$GODOT" --headless --path . --import`. To have Godot re-serialize `project.godot` in its
own layout (it adds the standard comment header and keeps every key), run a script that calls
`ProjectSettings.save()` (section 5). `--import` alone does not rewrite `project.godot`.

## 1. Create a new scene

Builder scripts are tools, not game code. Put them where they will not be exported, for example a
`tools/` folder, and keep them in version control so the scene can be regenerated.

```gdscript
# res://tools/build_level.gd
# Run: "$GODOT" --headless --path . --script res://tools/build_level.gd --quit-after 300
extends SceneTree


func _init() -> void:
	var root := Node2D.new()
	root.name = "Level"

	var sprite := Sprite2D.new()
	sprite.name = "Sprite2D"
	sprite.texture = load("res://icon.svg")
	root.add_child(sprite)
	sprite.owner = root  # REQUIRED: nodes without owner == root are not packed

	var packed := PackedScene.new()
	var err := packed.pack(root)
	if err != OK:
		push_error("pack failed: %d" % err)
		root.free()
		quit(1)
		return

	DirAccess.make_dir_recursive_absolute("res://levels")
	err = ResourceSaver.save(packed, "res://levels/level.tscn")
	root.free()
	if err != OK:
		push_error("save failed: %d" % err)
		quit(1)
		return
	quit(0)
```

Output (4.7.2):

```
[gd_scene format=3]

[ext_resource type="Texture2D" path="res://icon.svg" id="1_80vhd"]

[node name="Level" type="Node2D" unique_id=1488154860]

[node name="Sprite2D" type="Sprite2D" parent="." unique_id=355657616]
texture = ExtResource("1_80vhd")
```

Rules that make this work:

- **`owner`**. `PackedScene.pack(root)` only stores nodes whose `owner` is `root`. Set
  `child.owner = root` on every node you add, at every depth, after `add_child`.
- **The target folder must exist.** Without `DirAccess.make_dir_recursive_absolute()` (it accepts
  `res://` paths) `ResourceSaver.save()` prints `Cannot save file` and returns error 19.
- **No `uid=` outside the editor.** The editor writes `uid="uid://..."` on the `[gd_scene]`
  header and on each `ext_resource`. A `--script` run does not, even with `--editor`: the uid
  writer (`ResourceSaver::save_get_id_for_path`) is registered only by the editor's running
  filesystem. Path-only references load fine and the editor adds the uids the next time it saves
  the scene. Do not add them by hand.
- **Instanced sub-scenes**. Place another scene inside this one the way the editor does:
  ```gdscript
  var enemy_scene := load("res://characters/enemy/enemy.tscn") as PackedScene
  var enemy := enemy_scene.instantiate(PackedScene.GEN_EDIT_STATE_INSTANCE)
  root.add_child(enemy)
  enemy.owner = root  # only the instance root; its children keep their own owner
  ```
  This saves `[node name="Enemy" parent="." unique_id=... instance=ExtResource("2_...")]` with
  the instance's children left in `enemy.tscn`. A plain `instantiate()` also stays linked but
  adds `type="CharacterBody2D"` to that header, which the editor does not write. Do not set
  `owner = root` on the instance's internal children, or they get baked into this scene as local
  copies.
- **Groups**: `node.add_to_group("enemies", true)`. The second argument (`persistent`) is what
  makes `pack()` save `groups=["enemies"]` on the node header; without it the group is dropped.
- **`ResourceSaver.save(resource, path)`**: resource first, path second. Check the returned
  `Error`.
- **Free what you built** (`root.free()`) and **always call `quit()`**.
- **Autoloads are not in the tree during `_init()`** of a `--script` SceneTree. They are after
  `await process_frame`. Do not depend on them in a builder.
- Exported properties, `unique_name_in_owner = true`, collision shapes (as `sub_resource`),
  materials and scripts (`set_script(load(...))`) serialize through `pack()`.

## 2. Add a signal connection that is saved in the scene

Connections are saved by `pack()` only when made with the persistent flag:

```gdscript
root.set_script(load("res://ui/menu.gd"))  # the target method must exist first
button.pressed.connect(root._on_button_pressed, CONNECT_PERSIST)
```

Saved as `[connection signal="pressed" from="HUD/Button" to="." method="_on_button_pressed"]`
after the nodes. A connection made without `CONNECT_PERSIST` is not saved. If attaching the
script in the builder is awkward, connect in code in the script's `_ready()` instead; both are
idiomatic.

## 3. Edit an existing scene

Load, instantiate with the editor's edit state, change, re-pack, save over the same path:

```gdscript
# res://tools/edit_level.gd
extends SceneTree


func _init() -> void:
	var path := "res://levels/level.tscn"
	var scene := load(path) as PackedScene
	# GEN_EDIT_STATE_INSTANCE keeps instanced sub-scenes linked when re-packing.
	var root := scene.instantiate(PackedScene.GEN_EDIT_STATE_INSTANCE)

	var hud := root.get_node("HUD") as CanvasLayer
	var label := Label.new()
	label.name = "ScoreLabel"
	label.unique_name_in_owner = true
	hud.add_child(label)
	label.owner = root

	var packed := PackedScene.new()
	var err := packed.pack(root)
	if err == OK:
		err = ResourceSaver.save(packed, path)
	root.free()
	quit(0 if err == OK else 1)
```

On 4.7.2 the diff of the re-saved file was only the added `ScoreLabel` node: existing
`unique_id`s, `ext_resource` ids, groups, the instanced sub-scene and the `[connection]` were all
kept. With a plain `instantiate()` the instance header also gained a `type=` attribute.

After any re-save, **read `git diff` of the `.tscn`**. Godot normalises whitespace, drops `;`
comments, may add `unique_id=` (4.6+) and may reorder. That is expected. Lost nodes, lost
connections, or a sub-scene that turned into inline nodes are not.

## 4. Create a data Resource (.tres)

```gdscript
# res://items/item_data.gd
class_name ItemData
extends Resource

@export var display_name: String = ""
@export var price: int = 0
@export var icon: Texture2D
```

```gdscript
# res://tools/build_items.gd
extends SceneTree


func _init() -> void:
	var sword := ItemData.new()
	sword.display_name = "Sword"
	sword.price = 120
	var err := ResourceSaver.save(sword, "res://items/sword.tres")
	quit(0 if err == OK else 1)
```

`class_name ItemData` only resolves after the global class cache exists: before `--import` the
builder fails with `Identifier "ItemData" not declared in the current scope`. Run `--import` once
after creating `item_data.gd`, or use `load("res://items/item_data.gd").new()`. Output:

```
[gd_resource type="Resource" script_class="ItemData" format=3]

[ext_resource type="Script" path="res://items/item_data.gd" id="1_es5ut"]

[resource]
script = ExtResource("1_es5ut")
display_name = "Sword"
price = 120
```

## 5. Project settings and Input Map without the editor

Change project settings through `ProjectSettings` so Godot serializes them, rather than typing
`[input]` objects. This writes Input Map actions in the same form the editor's Input Map tab
does (`"deadzone"` plus an `Array[InputEvent]` of serialized events, `device` -1 for all
devices):

```gdscript
# res://tools/add_input_actions.gd
# Run: "$GODOT" --headless --path . --script res://tools/add_input_actions.gd --quit-after 300
extends SceneTree


func _init() -> void:
	_add_action(&"jump", [KEY_SPACE])
	_add_action(&"move_left", [KEY_A, KEY_LEFT])
	_add_action(&"move_right", [KEY_D, KEY_RIGHT])
	var err := ProjectSettings.save()
	quit(0 if err == OK else 1)


func _add_action(action: StringName, keys: Array[Key]) -> void:
	var events: Array[InputEvent] = []
	for key: Key in keys:
		var ev := InputEventKey.new()
		ev.device = -1  # all devices, as the editor writes it (a new event defaults to 16)
		ev.physical_keycode = key
		events.append(ev)
	ProjectSettings.set_setting("input/" + action, {"deadzone": 0.2, "events": events})
```

`ProjectSettings.save()` rewrites the whole `project.godot`, keeping existing keys and adding the
editor's comment header. Review `git diff` afterwards. The same pattern sets any other key
(`ProjectSettings.set_setting("display/window/size/viewport_width", 720)`).

## 6. What not to do

- Do not hand-write a new `.tscn` with more than a couple of nodes, any `sub_resource`, an
  AnimationPlayer, a TileSet, a Theme, SpriteFrames, or a mesh. Use a builder.
- Do not invent `uid://` values, `ext_resource` ids, or `unique_id` numbers. A path-only
  `ext_resource` still loads; Godot assigns a uid on next save. A stale or duplicated uid is worse
  than none.
- Do not add `load_steps=` (deprecated and ignored since 4.6; 4.7.2 never writes it).
- Do not hand-write `.import` files or `.uid` files. Run `--import` and let Godot create them.

## 7. Small safe hand-edits

Fine to make directly, keeping existing ids, with a minimal diff:

- change a number, string, colour or exported value on an existing node or resource;
- add `groups=["enemies"]` to a `[node]` header;
- add a `[connection signal="pressed" from="Button" to="." method="_on_button_pressed"]` line
  at the end of the file (connections come after all nodes);
- change a script path;
- `project.godot` keys, `export_presets.cfg` values, `plugin.cfg`, `.gdignore`.

Section order in a `.tscn` is: header, `[ext_resource]`, `[sub_resource]`, `[node]` (each after its
parent), `[connection]`, `[editable]`. Root has no `parent`; its children use `parent="."`;
deeper nodes use the path from the root (`parent="Player/Head"`).

Always follow a hand-edit with the validation loop below. A parse error in a `.tscn` can fail
silently in headless runs; look for `Parse Error` and `Failed loading resource` in the output.

---

## 8. Validation loop

Run this after every change. **Godot exits 0 when scripts fail to parse, when a smoke run logs
errors, and when a `--script` hits a runtime error (all measured on 4.7.2), so the exit code is
not enough: grep the output.**

```bash
"$GODOT" --headless --path . --import 2>&1 | tee /tmp/godot-import.log
"$GODOT" --headless --path . --check-only --script res://path/to/changed_file.gd 2>&1 | tee /tmp/godot-check.log
"$GODOT" --headless --path . --quit-after 120 2>&1 | tee /tmp/godot-smoke.log
grep -nE 'SCRIPT ERROR|Parse Error|ERROR:|Failed loading' /tmp/godot-import.log /tmp/godot-check.log /tmp/godot-smoke.log
```

1. `--import` builds `.godot/`, the global class cache (so `class_name` types resolve), and
   creates missing `.uid` and `.import` sidecars. Commit those sidecars. It does **not**
   parse-check scripts: a script with a parse error imports with zero error lines.
2. `--check-only --script` parses one script. Measured on 4.7.2: it **exits 0 even on a parse
   error** (the errors are printed), it needs step 1 first for `class_name` resolution, and it
   **never resolves autoload names**, even when the autoload is registered in `project.godot`
   (`Compile Error: Identifier not found: MyAutoload`). Use it for a quick check of a script that
   does not reference autoloads; use the CI script's in-tree check otherwise.
3. The smoke run executes the main scene for N iterations. Use `--scene res://x.tscn` to target a
   specific scene. Missing Input Map actions show up here as
   `ERROR: The InputMap action "jump" doesn't exist.`
4. Running Godot on a project can rewrite files (re-save, add `.uid`, upgrade format). Review
   `git diff` afterwards.

### CI script

Save as `tools/validate.sh` in the Godot project (adjust the test step to the project's runner).
Tested on 4.7.2 with macOS's stock bash 3.2: passes a clean project (including scripts that use
an autoload) and fails on a tracked script with a parse error.

```bash
#!/usr/bin/env bash
# Headless validation for a Godot 4 project. Usage: tools/validate.sh [project_dir]
set -uo pipefail

GODOT="${GODOT_PATH:-godot}"
PROJECT="${1:-.}"
LOGDIR="$(mktemp -d)"
PATTERN='SCRIPT ERROR|Parse Error|ERROR:|Failed loading'
status=0

step() {
	local name="$1"; shift
	echo "== $name"
	"$GODOT" "$@" >"$LOGDIR/$name.log" 2>&1
	local code=$?
	if [ $code -ne 0 ]; then
		echo "FAIL ($name): exit $code"; status=1
	fi
	if grep -nE "$PATTERN" "$LOGDIR/$name.log"; then
		echo "FAIL ($name): errors in output"; status=1
	fi
}

step import --headless --path "$PROJECT" --import

# Parse-check every tracked GDScript outside addons/ by loading it inside a running SceneTree.
# Not --check-only: that exits 0 on parse errors and cannot see autoload names.
cat >"$LOGDIR/check_scripts.gd" <<'GD'
extends SceneTree


func _init() -> void:
	await process_frame  # autoloads are in the tree from here on
	var failed := 0
	for path: String in OS.get_cmdline_user_args():
		var script := ResourceLoader.load(path, "", ResourceLoader.CACHE_MODE_IGNORE) as Script
		if script == null or not script.can_instantiate():
			printerr("CHECK FAILED: ", path)
			failed += 1
	quit(1 if failed > 0 else 0)
GD
scripts=()
while IFS= read -r f; do
	scripts+=("res://$f")
done < <(cd "$PROJECT" && git ls-files '*.gd' | grep -v '^addons/')
if [ ${#scripts[@]} -gt 0 ]; then
	step check-scripts --headless --path "$PROJECT" --script "$LOGDIR/check_scripts.gd" \
		--quit-after 600 -- "${scripts[@]}"
fi

step smoke --headless --path "$PROJECT" --quit-after 120

# Tests (GUT shown; see references/testing.md for gdUnit4)
if [ -f "$PROJECT/addons/gut/gut_cmdln.gd" ]; then
	step tests --headless --path "$PROJECT" -s addons/gut/gut_cmdln.gd \
		-gdir=res://test -ginclude_subdirs -gexit
fi

echo "logs: $LOGDIR"
exit $status
```

The checker script is written to the temp log folder and run from there (`--script` accepts a
path outside the project), so it adds nothing to the repo. Tune `PATTERN` to the project if a
known, accepted warning line matches it, and say so in the report rather than silently widening
it.

---

## 9. Export from the command line

Presets come from `export_presets.cfg`, which the editor creates in Project > Export. The preset
name on the command line must match `name=` in that file exactly (quote it if it has spaces).
The output path is absolute or relative to the project directory, and **its directory must
already exist** (otherwise exit 1). Export templates for the exact engine version must be
installed: macOS `~/Library/Application Support/Godot/export_templates/<version>/`, for example
`4.7.2.stable/`, or Editor > Manage Export Templates. Headless install: download
`Godot_v4.7.2-stable_export_templates.tpz` (1.28 GB) from the GitHub release, check it against
the release's `SHA512-SUMS.txt`, unzip it (a `.tpz` is a zip), and copy the contents of its
`templates/` folder into that directory. The C# build needs the separate `mono` `.tpz`.

```bash
mkdir -p build/web build/web-debug build/android build/ios

# Web (see references/web-export.md)
"$GODOT" --headless --path . --export-release "Web" build/web/index.html

# Debug build of the same preset
"$GODOT" --headless --path . --export-debug "Web" build/web-debug/index.html

# Only the .pck (data pack), for patching an existing build
"$GODOT" --headless --path . --export-pack "Web" build/game.pck

# Android (Editor Settings must already have Java SDK and Android SDK paths)
"$GODOT" --headless --path . --export-release "Android" build/android/game.aab

# iOS: by default Godot writes build/ios/game.xcodeproj plus a game/ folder, then runs
# xcodebuild to produce game.ipa (signing set up in the preset). With the preset option
# application/export_project_only=true it stops at the Xcode project and expects a .xcodeproj path.
"$GODOT" --headless --path . --export-release "iOS" build/ios/game.ipa
```

The Web, debug Web and pack commands were run on 4.7.2 (about 2 s each for a small project). The
Android and iOS lines were not run here; the iOS path rules come from the 4.7.2 source
(`editor/export/editor_export_platform_apple_embedded.*`).

`--headless` is required on GPU-less machines. Scan export output with the same grep as the
validation loop.

Other flags from `--help` worth knowing: `--export-patch <preset> <path>` with
`--patches <paths>`, `--install-android-build-template`, `--quit-after <N>`, `--fixed-fps`,
`--write-movie <file>` (deterministic video capture), `--print-fps`, `--debug-collisions`,
`--log-file`, `--doctool <dir>` (dumps the full class reference as XML, useful for checking an
API exists), and `--` / `++` to pass user args readable with `OS.get_cmdline_user_args()`. There
is no `--doctor` flag.

### export_presets.cfg without an editor

Prefer a preset the editor wrote. If there is none, this minimal Web preset exports with zero
`ERROR:` lines on 4.7.2; Godot fills every other option with its default. Leaving out
`include_filter`, `exclude_filter` or the `[preset.0.options]` section exports too, but logs
`ERROR: Couldn't find the given section "preset.0" and key "include_filter"` and similar.

```ini
[preset.0]

name="Web"
platform="Web"
runnable=true
export_filter="all_resources"
include_filter=""
exclude_filter=""
export_path="build/web/index.html"

[preset.0.options]

variant/thread_support=false
```

`runnable=true` is the older form; a 4.7 editor writes a top-level `[runnable_presets]` section
(`Web="Web"`) instead and still reads the old key. Running the editor headless does not
normalise the file. Other Web option keys (4.7.2 source): `variant/extensions_support`,
`vram_texture_compression/for_desktop` / `for_mobile`, `html/export_icon`,
`html/custom_html_shell`, `html/head_include`, `html/canvas_resize_policy`,
`html/focus_canvas_on_start`, `html/experimental_virtual_keyboard`,
`progressive_web_app/enabled` (and its `ensure_cross_origin_isolation_headers`, `offline_page`,
`display`, `orientation`, `icon_*`, `background_color`), `threads/emscripten_pool_size`,
`threads/godot_pool_size`, `custom_template/debug` / `release`.

`export_filter="all_resources"` also exports test and tool addons (for example GUT). Exclude
them with `exclude_filter="addons/gut/*, test/*"` or similar.

The file has no secrets and is committed. Keystore passwords and the script encryption key live
in `.godot/export_credentials.cfg`, which is never committed.
