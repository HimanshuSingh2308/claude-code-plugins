# Git Commands Reference for Auto-Update

## Essential Commands

### Check for Updates

```bash
# Fetch latest from remote (shallow)
cd ~/.claude/plugins/marketplaces/hplugins && git fetch origin main --depth 1

# Count commits behind
git rev-list HEAD..origin/main --count

# List pending commits
git log HEAD..origin/main --oneline

# Show file changes summary
git diff --stat HEAD..origin/main

# Show detailed file changes
git diff HEAD..origin/main
```

### Apply Updates

```bash
# Hard reset to remote (discards local changes)
git reset --hard origin/main

# Soft update (keeps local changes, may cause conflicts)
git pull --rebase origin main
```

### Version Information

```bash
# Current commit info
git log -1 --format="%h %ci %s"

# Full commit hash
git rev-parse HEAD

# Remote commit hash
git rev-parse origin/main

# Check if local matches remote
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && echo "Up to date"
```

### Local Modifications

```bash
# Check for uncommitted changes
git status --porcelain

# Show modified files
git diff --name-only

# Stash local changes
git stash push -m "backup-before-update"

# Restore stashed changes
git stash pop

# List stashes
git stash list
```

### Repository Health

```bash
# Verify repository integrity
git fsck --full

# Check remote connectivity
git ls-remote --exit-code origin main

# Show remote URL
git remote get-url origin

# Show current branch
git branch --show-current
```

### History and Rollback

```bash
# Show recent history
git log --oneline -10

# Show reflog (for recovery)
git reflog -10

# Reset to previous state
git reset --hard HEAD@{1}

# Reset to specific commit
git reset --hard abc1234
```

## Common Patterns

### Safe Update Flow

```bash
#!/bin/bash
PLUGINS_DIR=~/.claude/plugins/marketplaces/hplugins

cd "$PLUGINS_DIR" || exit 1

# 1. Check for local changes
if [ -n "$(git status --porcelain)" ]; then
    echo "Local changes detected. Stashing..."
    git stash push -m "auto-backup-$(date +%Y%m%d)"
fi

# 2. Fetch and check for updates
git fetch origin main --depth 1
BEHIND=$(git rev-list HEAD..origin/main --count)

if [ "$BEHIND" -eq 0 ]; then
    echo "Already up to date"
    exit 0
fi

# 3. Show pending changes
echo "Updates available: $BEHIND commits"
git log HEAD..origin/main --oneline

# 4. Apply update
git reset --hard origin/main

# 5. Verify
echo "Updated to: $(git log -1 --format='%h %s')"
```

### Check-Only Flow

```bash
#!/bin/bash
PLUGINS_DIR=~/.claude/plugins/marketplaces/hplugins

cd "$PLUGINS_DIR" || exit 1

# Fetch silently
git fetch origin main --depth 1 2>/dev/null

# Check status
BEHIND=$(git rev-list HEAD..origin/main --count 2>/dev/null)

if [ "$BEHIND" -gt 0 ]; then
    echo "Updates available: $BEHIND commits"
    exit 1
else
    echo "Up to date"
    exit 0
fi
```

### Get Changelog

```bash
#!/bin/bash
PLUGINS_DIR=~/.claude/plugins/marketplaces/hplugins

cd "$PLUGINS_DIR" || exit 1

git fetch origin main --depth 20

echo "## Changelog"
echo ""
git log HEAD..origin/main --format="- **%h** %s (%cr)"
```

## Error Codes

| Exit Code | Meaning |
|-----------|---------|
| 0 | Success / Up to date |
| 1 | Updates available / General error |
| 128 | Git error (not a repo, etc.) |
| 255 | Network error |

## Troubleshooting

### "Not a git repository"

```bash
# Re-clone the repository
rm -rf ~/.claude/plugins/marketplaces/hplugins
git clone --depth 1 https://github.com/HimanshuSingh2308/claude-code-plugins ~/.claude/plugins/marketplaces/hplugins
```

### "Unable to access remote"

```bash
# Check network
ping github.com

# Check SSH key (if using SSH)
ssh -T git@github.com

# Switch to HTTPS
git remote set-url origin https://github.com/HimanshuSingh2308/claude-code-plugins
```

### "Local changes would be overwritten"

```bash
# Option 1: Stash changes
git stash

# Option 2: Discard changes
git checkout -- .
git clean -fd

# Option 3: Force reset
git reset --hard origin/main
```
