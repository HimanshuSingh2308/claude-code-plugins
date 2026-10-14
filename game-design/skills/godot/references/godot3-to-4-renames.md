# Godot 3 to Godot 4 renames and traps

Use this table to recognise Godot 3 code (in old projects, tutorials, forum answers, or your own
training data) and translate it to the Godot 4 API. **Never write the left-hand column in new
code.** This file is the only place in the skill where Godot 3 names appear as anything other
than an anti-pattern.

Sources:
- Official migration guide: https://docs.godotengine.org/en/stable/tutorials/migrating/upgrading_to_godot_4.html
- The engine's own rename map, used by the 3-to-4 converter:
  https://github.com/godotengine/godot/blob/master/editor/project_upgrade/renames_map_3_to_4.cpp
- Per-version upgrade pages, for example
  https://docs.godotengine.org/en/stable/tutorials/migrating/upgrading_to_godot_4.7.html

Legend for the "Check" column:
- **V** - verified against Godot 4.7.2: the class reference (`--doctool` dump checked with
  ClassDB), the engine's rename map, or by running the code headless (Godot 3 forms such as
  `export var`, `onready`, `tool`, `setget` and `yield` were confirmed to be parse errors, and the
  behaviour rows such as end-exclusive `slice`, auto-seeded `randi`, immediate `call_group`, no
  implicit parent `_ready`, and `Tween.new()` failing were run). Last checked Oct 2026.

When a rename is not in this table, do not guess. Search the class reference for the Godot 4
class, or grep `renames_map_3_to_4.cpp`.

---

## Converting a whole project

Do it the engine's way, not by hand:

```bash
# Dry run first: reports what would change
godot --headless --path . --validate-conversion-3to4
# Then convert (back up or commit first)
godot --headless --path . --convert-3to4
```

The Project Manager offers the same conversion when you open a 3.x project. Both use the rename
map above. Manual leftovers are listed on the migration page. After converting, run the full
headless validation loop from SKILL.md and review `git diff`.

---

## Language and syntax

| Godot 3 | Godot 4 | Check |
|---|---|---|
| `export var x` / `export(int) var x` | `@export var x: int` | V |
| `export(NodePath) var p` | `@export var p: NodePath`, or better `@export var target: Node` | V |
| `onready var` | `@onready var` | V |
| `tool` | `@tool` | V |
| `setget` | inline `set(value):` / `get:` blocks on the property | V |
| `yield(obj, "signal")` | `await obj.signal_name` | V |
| `yield(get_tree().create_timer(1), "timeout")` | `await get_tree().create_timer(1).timeout` | V |
| `yield(get_tree(), "idle_frame")` | `await get_tree().process_frame` | V |
| `connect("sig", self, "_method")` | `sig.connect(_method)`; with args `sig.connect(_method.bind(arg))` | V |
| `emit_signal("sig", a)` | `sig.emit(a)` (the old form still works) | V |
| `funcref(obj, "m")` | `Callable(obj, "m")` or `obj.m` | V |
| `instance()` | `instantiate()` (PackedScene) | V |
| `PoolStringArray`, `PoolIntArray`, `PoolByteArray`, `PoolVector2Array` ... | `PackedStringArray`, `PackedInt32Array` / `PackedInt64Array`, `PackedByteArray`, `PackedVector2Array` | V |
| `puppet` / `master` / `remote` keywords, `rset` | `@rpc("any_peer", ...)` annotation | V |
| `is_network_master()` | `is_multiplayer_authority()`; `multiplayer.get_unique_id()` | V |
| `rand_range(a, b)` | `randf_range(a, b)` / `randi_range(a, b)` | V |
| `deg2rad` / `rad2deg` | `deg_to_rad` / `rad_to_deg` | V |
| `stepify` | `snapped` / `snappedf` | V |
| `range_lerp` | `remap` | V |
| `str2var` / `var2str` / `bytes2var` / `var2bytes` | `str_to_var` / `var_to_str` / `bytes_to_var` / `var_to_bytes` | V |
| `db2linear` / `linear2db` | `db_to_linear` / `linear_to_db` | V |
| `dict2inst` / `inst2dict` | `dict_to_inst` / `inst_to_dict` | V |
| `is_valid_integer()` | `is_valid_int()` | V |
| `find_last` | `rfind` | V |
| `Vector2.clamped()` | `limit_length()` | V |
| `Color.linear_interpolate` | `lerp` | V |
| `to_utf8()` | `to_utf8_buffer()` | V |
| `Array.empty()` | `is_empty()` | V |
| `Array.remove(i)` | `remove_at(i)` | V |
| `Array.invert()` | `reverse()` | V |
| `Array.slice(b, e)` (end inclusive) | `slice(b, e)` with **end exclusive** | V |
| `randomize()` at startup | automatic at startup; call only to reseed | V |
| `Engine.editor_hint` | `Engine.is_editor_hint()` | V |
| `_ready` / `_process` implicitly calling the parent | explicit `super()` call | V |
| `Color.palegreen` | `Color.PALE_GREEN` | V |
| `call_group` (deferred by default) | immediate now; use `call_group_flags(SceneTree.GROUP_CALL_DEFERRED, ...)` for deferred | V |
| `Thread.start(self, "m", arg)` / `is_active()` | `thread.start(m.bind(arg))` / `is_alive()` | V |
| `remove_and_skip()` | removed | V |
| `get_node("x")` used on possibly-missing nodes | `get_node_or_null("x")` or `has_node()` | V |
| `is_instance_valid()` | unchanged | V |

## OS, time, files, scenes

| Godot 3 | Godot 4 | Check |
|---|---|---|
| `OS.get_ticks_msec()` | `Time.get_ticks_msec()` | V |
| `OS.get_unix_time()` | `Time.get_unix_time_from_system()` | V |
| `OS.get_system_time_msecs()` | `int(Time.get_unix_time_from_system() * 1000.0)` | V |
| `OS.window_fullscreen = true` | `DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)` | V |
| `OS.get_screen_size()` | `DisplayServer.screen_get_size()` | V |
| `OS.window_size` | `get_window().size` / `DisplayServer.window_set_size()` | V |
| `File`, `Directory` | `FileAccess`, `DirAccess` | V |
| `File.new()` then `open()` | `FileAccess.open(path, FileAccess.WRITE)` (static; check for null) | V |
| `get_tree().change_scene("res://x.tscn")` | `change_scene_to_file()` / `change_scene_to_packed()` | V |
| `ResourceSaver.save(path, res)` | `ResourceSaver.save(res, path)` (argument order swapped) | V |
| `Node.filename` | `scene_file_path` | V |
| `pause_mode` | `process_mode` | V |

## Nodes and classes

| Godot 3 | Godot 4 | Check |
|---|---|---|
| `Spatial` | `Node3D` | V |
| `KinematicBody2D` | `CharacterBody2D` | V |
| `KinematicBody` | `CharacterBody3D` | V |
| `Sprite` | `Sprite2D` | V |
| `AnimatedSprite` | `AnimatedSprite2D` | V |
| `Area` | `Area3D` | V |
| `RigidBody` | `RigidBody3D` | V |
| `StaticBody` | `StaticBody3D` | V |
| `CollisionShape` | `CollisionShape3D` | V |
| `Camera` | `Camera3D` | V |
| `MeshInstance` | `MeshInstance3D` | V |
| `Particles` | `GPUParticles3D` | V |
| `Particles2D` | `GPUParticles2D` | V |
| `CPUParticles` | `CPUParticles3D` | V |
| `Position2D` / `Position3D` | `Marker2D` / `Marker3D` | V |
| `YSort` | `Node2D` with `y_sort_enabled = true` | V |
| `ToolButton` | `Button` (flat) | V |
| `VisibilityNotifier` | `VisibleOnScreenNotifier3D` | V |
| `PathFollow` | `PathFollow3D` | V |
| `Physics2DServer` | `PhysicsServer2D` | V |
| `ARVRCamera` | `XRCamera3D` | V |
| `GIProbe` | `VoxelGI` | V |
| `Navigation2D` / `Navigation` | `NavigationServer2D` + `NavigationAgent2D` / `NavigationRegion2D` | V |
| `TileMap` | `TileMapLayer` (4.3+; `TileMap` deprecated) | V |
| `SceneTreeTween` | `Tween` | V |
| `Tween` node (`$Tween.interpolate_property`) | `create_tween()` + `tween_property()`; `Tween.new()` is invalid | V |
| `TextureProgress` | `TextureProgressBar` | V |
| `Light2D` | `PointLight2D` / `DirectionalLight2D` | V |
| `Viewport` inside a container | `SubViewport` | V |
| `ViewportContainer` | `SubViewportContainer` | V |
| `SpatialMaterial` | `StandardMaterial3D` | V |
| `Texture` | `Texture2D` | V |

## Control and UI properties

| Godot 3 | Godot 4 | Check |
|---|---|---|
| `rect_position` | `position` | V |
| `rect_size` | `size` | V |
| `rect_min_size` | `custom_minimum_size` | V |
| `margin_*` | `offset_*` | V |
| `RichTextLabel.bbcode_text` | `text` (with `bbcode_enabled`) | V |
| `Label.percent_visible` | `visible_ratio` | V |
| `get_stylebox` | `get_theme_stylebox` | V |
| `add_stylebox_override` | `add_theme_stylebox_override` | V |
| `add_color_override` | `add_theme_color_override` | V |
| `add_font_override` | `add_theme_font_override` | V |
| `CanvasItem.update()` | `queue_redraw()` | V |

## Physics and movement

| Godot 3 | Godot 4 | Check |
|---|---|---|
| `velocity = move_and_slide(velocity, Vector2.UP)` | set the built-in `velocity` property, then `move_and_slide()` (no args, returns bool) | V |
| `move_and_slide` up-direction argument | `up_direction` property; also `floor_stop_on_slope`, `floor_max_angle` | V |
| `move_and_slide_with_snap` | removed; use `floor_snap_length` | V |
| `get_slide_count()` | `get_slide_collision_count()` | V |
| `RigidBody2D.mode` | `freeze` + `freeze_mode` | V |
| `apply_impulse(Vector2.ZERO, impulse)` | `apply_central_impulse(impulse)` | V |
| `space_state.intersect_ray(from, to, exclude, mask)` | `PhysicsRayQueryParameters2D.create(from, to, mask)` then `space_state.intersect_ray(query)` | V |
| `Camera.zfar` / `znear` | `Camera3D.far` / `near` | V |

Unchanged: `is_on_floor()`, `body_entered`, `linear_velocity`, `_integrate_forces(state)` (state is
now `PhysicsDirectBodyState2D` / `3D`). Raycast results are a Dictionary with `collider`,
`position`, `normal`.

## Rendering and shaders

| Godot 3 | Godot 4 | Check |
|---|---|---|
| `WORLD_MATRIX` | `MODEL_MATRIX` | V |
| `CAMERA_MATRIX` | `INV_VIEW_MATRIX` | V |
| `ALPHA_SCISSOR` | `ALPHA_SCISSOR_THRESHOLD` | V |
| `SCREEN_TEXTURE` built-in | `uniform sampler2D tex : hint_screen_texture;` | V |
| `Image.lock()` / `unlock()` | removed | V |
| `ImageTexture.new()` + `create_from_image()` | static `ImageTexture.create_from_image(img)` | V |

## Input

| Godot 3 | Godot 4 | Check |
|---|---|---|
| `event.shift` / `.control` / `.alt` / `.command` / `.meta` | `shift_pressed` / `ctrl_pressed` / `alt_pressed` / `command_pressed` / `meta_pressed` | V |
| `InputEventMouseButton.doubleclick` | `double_click` | V |
| `BUTTON_LEFT` | `MOUSE_BUTTON_LEFT` | V |
| `get_tree().set_input_as_handled()` | `get_viewport().set_input_as_handled()` | V |
| `TileMap.set_cell(x, y, id)` | `TileMapLayer.set_cell(Vector2i, source_id, atlas_coords)` | V |

---

## Common hallucination traps

These are the Godot 3 (or early Godot 4) forms that models write from memory. If you see any of
them in code you just wrote, stop and fix it:

- `onready` / `export` / `tool` without `@`
- `yield(...)` anywhere
- `.connect("signal", obj, "method")` string form
- `KinematicBody2D`, `Spatial`, `Sprite`, `Position2D`, `YSort`, `TileMap` in new code
- `move_and_slide(velocity)` with arguments, or assigning its return value to `velocity`
- `instance()`, `rand_range`, `deg2rad`, `stepify`
- `OS.get_ticks_msec`, `File.new()`, `Directory.new()`
- `get_tree().change_scene(`
- `$Tween.interpolate_property` or `Tween.new()`
- `setget`
- `Vector2.clamped`
- `Engine.editor_hint`
- `get_editor_interface()` from an EditorPlugin in new code (still present but deprecated in
  4.7.2; use the `EditorInterface` singleton), and `add_control_to_dock()` (deprecated in 4.7; use
  `add_dock()` with an `EditorDock`)

Not traps, but prefer the typed forms: `clampf` / `clampi` over `clamp`, `maxf` / `maxi` over `max`,
`absf` / `absi` over `abs`, `floori` when you want an int. `rotation_degrees` still exists on
`Node2D` and `Node3D` in 4.7.2 (a helper over `rotation`); `rotation` itself is radians, so
animation tracks and tweens on `rotation` take radians.

## Intra-4.x traps (by version)

| Version | Change |
|---|---|
| 4.2 | `EditorInterface` became a singleton |
| 4.3 | `TileMap` deprecated, use `TileMapLayer`; single-threaded web export became the default; physics interpolation |
| 4.4 | `.uid` sidecar files for scripts and shaders; typed `Dictionary[K, V]`; `@export_tool_button` |
| 4.5 | `@abstract` classes and methods; variadic functions `func f(a, ...args)`; `Resource.duplicate(true)` no longer duplicates external (saved) sub-resources, only embedded ones; use `duplicate_deep(Resource.DEEP_DUPLICATE_ALL)` for a full copy |
| 4.6 | `unique_id=` on `[node]` in `.tscn`; `load_steps` dropped; Jolt default physics for new 3D projects; D3D12 default on new Windows projects |
| 4.7 | Mouse and keyboard device ids are `InputEvent.DEVICE_ID_MOUSE` (32) / `DEVICE_ID_KEYBOARD` (16), not 0; packed array element assignment no longer triggers property setters; an override of a method with a typed return inherits that return type, so every code path needs a `return` (otherwise "Not all code paths return a value"; GH-115763); `Object.is_class` takes `StringName`; `RichTextLabel.add_image` parameters changed |

Source for 4.6 and 4.7: https://godotengine.org/releases/4.6/ ,
https://godotengine.org/releases/4.7/ ,
https://docs.godotengine.org/en/stable/tutorials/migrating/upgrading_to_godot_4.7.html
