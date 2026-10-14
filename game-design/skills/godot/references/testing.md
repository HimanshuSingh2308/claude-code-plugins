# Testing Godot 4 projects headless

There is no first-party test framework in the engine and no official testing guide. The two
community standards are below. Both install as addons into `addons/` and need the project
imported (`--import`) before they run headless. Enable the plugin in Project Settings > Plugins
for the editor panel; both command-line runners below worked on 4.7.2 without enabling it.

Exclude test addons and test folders from exports: `export_filter="all_resources"` exports
`addons/gut/` too and logs an `ERROR:` line for it. Set the preset's
`exclude_filter="addons/gut/*, addons/gdUnit4/*, test/*"`.


## GUT

https://github.com/bitwes/Gut. Releases as of Oct 2026: **9.7.1** (2026-07-10) for Godot 4.7,
9.6.1 for 4.6.x. 9.7.0 was the breaking release that adapted GUT to 4.7's return typing, so do
not use a pre-9.7 GUT on 4.7. Check the releases page before pinning a newer one. Install by
copying the release's `addons/gut/` into the project, then `--import`.

```gdscript
# res://test/unit/test_inventory.gd
extends GutTest


func test_adding_item_increases_count() -> void:
	var inventory := Inventory.new()
	inventory.add(preload("res://items/sword.tres"))
	assert_eq(inventory.count(), 1)
```

```bash
"$GODOT" --headless --path . -s addons/gut/gut_cmdln.gd -gdir=res://test -ginclude_subdirs -gexit
# -gjunit_xml_file=reports/gut.xml  -gselect=<name>  -glog=1  -gprefix=test_ ; or .gutconfig.json
```

Measured with GUT 9.7.1 on 4.7.2: the run exits 1 when a test fails and 0 when all pass.
`-gdir` is **not** recursive: without `-ginclude_subdirs`, tests in `res://test/unit/` are not
found, GUT prints `Nothing was run.` and **exits 0**. Grep for that line in CI, or check the
`Tests` total in the summary. Also: `before_each`, `after_each`, `watch_signals`, `autofree()`,
doubles and stubs.

## gdUnit4

https://godot-gdunit-labs.github.io/gdUnit4/latest/ (repo `godot-gdunit-labs/gdUnit4`, moved from
`MikeSchulze/gdUnit4`, which still redirects). Latest release as of Oct 2026: **v6.2.2**
(2026-10-07), listed for Godot 4.5 to 4.7.1; it ran correctly on 4.7.2 (below). The `master`
branch is v7.0.0 for 4.7 and later and is not released yet. Releases have no asset; install from
the tag's source archive, which contains only `addons/gdUnit4/`:

```bash
gh api repos/godot-gdunit-labs/gdUnit4/zipball/v6.2.2 > /tmp/gdunit4.zip   # or the GitHub "Source code" zip
unzip -q /tmp/gdunit4.zip -d /tmp/gdunit4 && cp -R /tmp/gdunit4/*/addons/gdUnit4 addons/
"$GODOT" --headless --path . --import    # required: registers gdUnit4's class_names
```

```gdscript
# res://test/test_stats.gd
extends GdUnitTestSuite


func test_damage_clamps_to_zero() -> void:
	var stats := Stats.new()
	stats.take_damage(999)
	assert_int(stats.health).is_equal(0)


func test_d_key_moves_player() -> void:
	var runner := scene_runner("res://levels/level.tscn")
	runner.simulate_key_pressed(KEY_D)
	await runner.simulate_frames(2)
	assert_float(runner.find_child("Player").position.x).is_greater(0.0)
```

```bash
"$GODOT" --headless --path . -s res://addons/gdUnit4/bin/GdUnitCmdTool.gd \
	--ignoreHeadlessMode -a res://test --report-directory reports
# -a <dir|suite> (repeatable)  -i <suite|suite:test> to skip  -c continue  -rc <n> reports kept
# or: GODOT_BIN="$GODOT" addons/gdUnit4/runtest.sh --headless --ignoreHeadlessMode -a res://test
```

Measured with v6.2.2 on 4.7.2, plugin not enabled in `project.godot`:

- Exit **0** when all pass, **100** when any test fails (101 is warnings). Each run writes
  `reports/report_N/results.xml` (JUnit XML, one `<failure>` with file and line per failed assert)
  and `reports/report_N/index.html`; `-rc` sets how many are kept (default 20). Add `reports/` to
  `.gitignore`.
- **Import first.** On a clone with no `.godot/`, the runner fails with `Parse Error: Could not
  find type "GdUnitTestCIRunner"` and **exits 0** with no tests run. Run `--import` in CI before
  the tests, and grep the output for `Overall Summary`.
- Without `--ignoreHeadlessMode` it prints "Headless mode is not supported!" and exits **103**.
  With it, `scene_runner()` input still worked headless (`simulate_key_pressed`,
  `simulate_action_pressed` both reached `_unhandled_input`).
- A directory with no suites prints "No test cases found, abort test run!" and exits **0**.
- `--run-tests` is not an option ("Unknown '--run-tests' command!", exit 100).
- `runtest.sh` does not add `--headless`; without it a window opens. It wants `GODOT_BIN` or
  `--godot_binary <path>` and passes every other argument to the runner.
- The scene runner sends each simulated event through `Input.parse_input_event()` and then also
  calls the scene root's `_unhandled_input()` directly, so a handler on the **root** node runs
  twice per simulated event (one `simulate_key_pressed` counted 2). Assert on the resulting state,
  or put handlers below the root.
- It runs only scripts that extend `GdUnitTestSuite`; a GUT suite under the same `-a` directory
  was skipped, not failed.

## What to test

- Use whichever framework the project already has. Do not add a second one.
- Keep logic in `RefCounted` and `Resource` classes with no scene dependency so it tests
  headless. Keep node scripts thin.
- Autoloads are not in the tree during a `--script` SceneTree's `_init()` (they are after
  `await process_frame`); run tests through the framework's runner.
