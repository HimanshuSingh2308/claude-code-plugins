---
description: Update the knowledge graph for recently changed files without full regeneration
argument-hint: [file1.dart file2.dart ...] or [--all]
---

# Update Knowledge Graph

Incrementally update the project's code knowledge graph for changed files.

**Arguments**: $ARGUMENTS

## When to Use

- After modifying source files during a coding session
- When the knowledge graph is slightly out of date but a full regeneration isn't needed
- Automatically suggested by the `project-context` skill after code changes

## Workflow

### Step 1: Locate Knowledge Graph

1. Check for `.claude/knowledge_graph.json` in the current project directory
2. If it doesn't exist:
   - Inform the user: "No knowledge graph found. Run `/refresh-project --deep` to generate one."
   - Stop

3. Read the existing knowledge graph
4. Note the `meta.generatedAt` timestamp and `meta.sourceDir`

### Step 2: Determine Changed Files

**If specific files are provided** (in $ARGUMENTS):
- Use those files directly
- Validate they exist and are source files (match the language extensions)

**If `--all` is provided**:
- Regenerate the entire graph — spawn the `kg-generator` agent instead
- This is equivalent to `/refresh-project --deep` for the KG only

**If no arguments** (auto-detect):
1. Get the source file extension for the project language from `meta.language`:
   - dart → `*.dart`
   - typescript → `*.ts`
   - javascript → `*.js`
   - python → `*.py`
   - go → `*.go`
   - rust → `*.rs`
2. Detect changed source files since the KG was generated:
   ```bash
   git diff --name-only HEAD -- '<sourceDir>/**/*.<ext>'
   ```
   Also check untracked new files:
   ```bash
   git ls-files --others --exclude-standard -- '<sourceDir>/**/*.<ext>'
   ```
3. Also check staged changes:
   ```bash
   git diff --cached --name-only -- '<sourceDir>/**/*.<ext>'
   ```
4. Combine all detected changed files (deduplicate)

If no changed files detected:
- Inform the user: "Knowledge graph is up to date. No source files changed since last generation."
- Stop

### Step 3: Parse Changed Files

For each changed file:

1. Read the file
2. Extract the updated file entry and symbol entries (following the kg-file-parser agent pattern):
   - File description, line count, symbols list, imports
   - Each symbol: kind, lines, extends/implements, members with line ranges
3. Compare with existing entries to identify:
   - New symbols (added)
   - Removed symbols (deleted from the file)
   - Modified symbols (line ranges changed, members added/removed)

**For 1-3 files**: Parse inline (no agent needed)
**For 4+ files**: Spawn `kg-file-parser` agent (haiku) for each file in parallel

### Step 4: Merge Updates

1. **Update `files` entries**: Replace each changed file's entry with the new one
2. **Update `symbols` entries**: Replace/add/remove symbol entries as needed
3. **Handle deleted files**: If a file no longer exists, remove its entry and all its symbols
4. **Handle new files**: Add new file entries and their symbols

### Step 5: Rebuild Reverse Dependencies

If any file's `imports` changed:
1. Clear all `importedBy` fields
2. Rebuild by scanning every file's `imports` list
3. For each import, add the importing file to the target's `importedBy`

If no imports changed, skip this step (optimization).

### Step 6: Update Metadata

Update the `meta` section:
- `generatedAt`: Current ISO timestamp
- `totalFiles`: Recount
- `totalSymbols`: Recount

Also update `directories` section if files were added/removed:
- Recount `fileCount` per directory

### Step 7: Write Updated Graph

Write the updated knowledge graph to `.claude/knowledge_graph.json`.

### Step 8: Report Changes

Display a summary:

```
## Knowledge Graph Updated

**Files updated**: 3 of 84
**Symbols changed**: 5 (2 added, 1 removed, 2 modified)
**Imports rebuilt**: Yes

### Changes
| File | Change |
|------|--------|
| lib/services/auth_service.dart | Modified: 2 methods updated |
| lib/models/user_model.dart | Added: new UserRole enum |
| lib/screens/old_screen.dart | Removed: file deleted |

Graph is now up to date.
```

If nothing changed:
```
Knowledge graph is up to date. No changes detected.
```

## Error Handling

- If `.claude/knowledge_graph.json` is corrupt or invalid JSON: suggest `/refresh-project --deep` for full regeneration
- If a file path doesn't exist: remove it from the graph and note the removal
- If git is not available: require explicit file paths in arguments
- If the graph version doesn't match: suggest full regeneration

## Notes

- This command is designed to be fast — it only re-parses changed files
- For full regeneration, use `/refresh-project --deep` instead
- The `project-context` skill will remind you to run this after making code changes
- The knowledge graph lives at `<project-root>/.claude/knowledge_graph.json`
