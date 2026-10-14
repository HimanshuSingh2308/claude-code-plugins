# Editor plugins and addons

Source: https://docs.godotengine.org/en/stable/tutorials/plugins/editor/making_plugins.html

Write a plugin only when editor tooling is the actual goal. For gameplay types, `class_name` and
scene composition are enough.

## Layout

```
res://addons/<plugin_name>/
	plugin.cfg
	plugin.gd
	(other scripts, icons, scenes)
```

`plugin.cfg`:

```ini
[plugin]
name="My Plugin"
description="What it does"
author="Studio"
version="1.0"
script="plugin.gd"
```

`plugin.gd`:

```gdscript
@tool
extends EditorPlugin


func _enter_tree() -> void:
	add_custom_type("Spawner", "Node2D", preload("spawner.gd"), preload("icon.svg"))


func _exit_tree() -> void:
	remove_custom_type("Spawner")
```

Everything added in `_enter_tree()` is removed in `_exit_tree()`.

## API

- `add_custom_type(name, base, script, icon)` / `remove_custom_type(name)`
- `add_dock(dock: EditorDock)` / `remove_dock(dock)`. An `EditorDock` is a container with
  `title`, `default_slot` and `layout_key`; put the dock's UI inside it. `add_control_to_dock()`
  and `remove_control_from_docks()` still work but are deprecated in 4.7.2 ("Use add_dock
  instead"); do not use them in new code.
- `add_autoload_singleton(name, path)` / `remove_autoload_singleton(name)`
- `add_inspector_plugin()` / `remove_inspector_plugin()`
- `add_tool_menu_item()` / `remove_tool_menu_item()`
- `_get_plugin_name()`, `_handles()`, `_edit()`
- `EditorInterface` is a singleton since 4.2; `get_editor_interface()` is deprecated (4.7.2
  docs), so do not use it in new code.

Any script the editor runs without `@tool` behaves like an empty file.

## Enabling

Project Settings > Plugins. Stored in `project.godot` as:

```ini
[editor_plugins]
enabled=PackedStringArray("res://addons/my_plugin/plugin.cfg")
```

Without a GUI, writing that key is a safe hand-edit; then run `--import`.

## Third-party addons

- Install from the Asset Library, the new Asset Store (https://store.godotengine.org/, 4.7), or
  git, into top-level `addons/`, and commit them.
- Do not edit vendor addon code. Extend or wrap it, and report problems upstream.
- Record the addon's license alongside it, as for any third-party asset.
- GUT and gdUnit4 are addons (see [testing.md](testing.md)).
