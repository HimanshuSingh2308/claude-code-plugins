# Orchestrator Guardrails

Safety rules and boundaries for the Weekly Game Release Orchestrator. This skill defines what operations are allowed, blocked, or require confirmation during autonomous workflow execution.

## Purpose

Prevent catastrophic mistakes during autonomous game release workflows by:
- Hard-blocking dangerous operations
- Requiring confirmation for potentially destructive actions
- Enforcing path boundaries to protect existing code
- Running pre-flight checks before any workflow

---

## Operation Classifications

### BLOCKED Operations (Never Allowed)

These operations are **permanently blocked** and will cause immediate workflow abort:

#### Database Operations
```
DROP DATABASE
DROP TABLE
TRUNCATE TABLE
DELETE FROM {table} WHERE 1=1
DELETE FROM {table} (without WHERE clause)
```

#### Git Destructive Operations
```
git push --force
git push -f
git push origin +{branch}
git reset --hard origin/main
git reset --hard HEAD~{n} (on main branch)
git clean -fd
git checkout -- . (on main branch)
git rebase -i (on main branch)
```

#### File System Catastrophic
```
rm -rf /
rm -rf ~
rm -rf .
rm -rf /*
rm -rf {project_root}
del /s /q (Windows equivalent)
```

#### Production Deployment
```
firebase deploy --only hosting:production
firebase deploy (without --only functions)
npm publish
gcloud app deploy
aws s3 sync --delete (to production buckets)
kubectl apply (to production namespace)
```

#### Credential/Secret Operations
```
Modifying .env files
Modifying *credentials*.json
Modifying *secret*.yaml
Accessing AWS_SECRET_ACCESS_KEY
Accessing FIREBASE_TOKEN
```

---

### CONFIRM Operations (Pause & Ask User)

These operations require explicit user confirmation before proceeding:

#### File Modifications (Outside New Game)
```yaml
Trigger: Edit or Write to files outside /games/{new-game-slug}/
Files requiring confirmation:
  - apps/web/src/index.html
  - apps/web/src/sitemap.xml
  - apps/web/src/leaderboard/index.html
  - Any file in apps/web/src/games/{existing-game}/
  - Any configuration file (*.json, *.yaml, *.toml)

Confirmation format:
  "About to modify {file_path}. This file affects {description}."
  "Changes: {summary_of_changes}"
  "Proceed? [Y/n]"
```

#### File Deletions
```yaml
Trigger: rm, unlink, delete operations
Scope: Any file deletion outside /games/{new-game-slug}/

Confirmation format:
  "About to delete {file_path}."
  "This action cannot be undone."
  "Proceed? [Y/n]"
```

#### Git Operations
```yaml
git push:
  Confirmation: "Push {n} commits to origin/{branch}? [Y/n]"
  Show: List of commits to be pushed

git merge:
  Confirmation: "Merge {source_branch} into {target_branch}? [Y/n]"

git branch -d/-D:
  Confirmation: "Delete branch {branch_name}? [Y/n]"

git tag:
  Confirmation: "Create tag {tag_name}? [Y/n]"
```

#### GitHub Operations
```yaml
Merge PR:
  Confirmation: "Merge PR #{number} '{title}' to {base_branch}? [Y/n]"
  Show: PR summary, checks status

Close Issue:
  Confirmation: "Close issue #{number} '{title}'? [Y/n]"

Delete Branch (remote):
  Confirmation: "Delete remote branch origin/{branch}? [Y/n]"
```

#### Security-Sensitive Fixes
```yaml
Trigger: Any fix identified by leaderboard-validator as HIGH risk
Confirmation: "Apply security fix for: {vulnerability_description}? [Y/n]"
Show: Code diff of proposed fix
```

---

### SAFE Operations (Auto-Proceed)

These operations proceed without confirmation:

#### Read-Only Operations
```
Read files (any path)
Glob file patterns
Grep content search
git status
git log
git diff
git branch --list
ls, cat, head, tail (read operations)
```

#### New Game File Operations
```yaml
Scope: /apps/web/src/games/{new-game-slug}/**
Allowed:
  - Create new files
  - Edit files
  - Delete files (within new game folder only)
```

#### Feature Branch Operations
```yaml
git checkout -b feature/game-{slug}
git branch feature/game-{slug}
git add (within allowed paths)
git commit
git stash (on feature branch)
```

#### Build and Test
```
npm install
npm run lint
npm run build
npm run test
npm run typecheck
npx {linter/formatter}
```

#### GitHub Non-Destructive
```
Create PR
Create issue
Add comment to PR/issue
Add label to issue
Request review
```

#### Output Files
```yaml
Scope: ~/Documents/weekly-games/**
Allowed:
  - Create scout reports
  - Create PRD documents
  - Create release notes
  - Create workflow logs
```

---

## Path Boundaries

### ALLOWED Paths (Full Access)

```yaml
New Game Folder:
  Pattern: apps/web/src/games/{new-game-slug}/**
  Permissions: CREATE, READ, EDIT, DELETE
  Note: {new-game-slug} is determined during Phase 2 (Design)

Output Directory:
  Pattern: ~/Documents/weekly-games/**
  Permissions: CREATE, READ, EDIT
  Contents: Scout reports, PRDs, logs, release notes

Workflow State:
  Pattern: ~/Documents/weekly-games/workflows/**
  Permissions: CREATE, READ, EDIT
  Contents: Workflow state JSON files
```

### ALLOWED Paths (Modify with Confirmation)

```yaml
Integration Files:
  - apps/web/src/index.html
  - apps/web/src/sitemap.xml
  - apps/web/src/leaderboard/index.html

Permissions: READ, EDIT (with confirmation)
Note: These files are modified to integrate the new game
```

### READ-ONLY Paths

```yaml
Other Games:
  Pattern: apps/web/src/games/{other-games}/**
  Permissions: READ only
  Reason: Protect existing deployed games

Reference Files:
  Pattern: game-design/skills/*/references/**
  Permissions: READ only
  Reason: Reference documentation
```

### FORBIDDEN Paths (No Access)

```yaml
Backend/API:
  - apps/api/**
  - apps/functions/**
  Reason: Separate deployment pipeline

Infrastructure:
  - firebase.json
  - firestore.rules
  - firestore.indexes.json
  - *.tfvars
  - *.tf
  Reason: Infrastructure changes require manual review

Environment:
  - .env
  - .env.*
  - *credentials*
  - *secret*
  Reason: Security sensitive

Shared Code:
  - apps/web/src/js/api-client.js
  - apps/web/src/js/auth.js
  Reason: Shared across all games, changes affect production

Package Management:
  - package.json (root)
  - package-lock.json
  - yarn.lock
  - pnpm-lock.yaml
  Reason: Dependency changes require security review

CI/CD:
  - .github/**
  - .gitlab-ci.yml
  - Jenkinsfile
  Reason: Pipeline changes require manual review
```

---

## Pre-Flight Checks

Before starting any workflow, verify ALL conditions:

### Repository State
```bash
# Must be clean
[ -z "$(git status --porcelain)" ] || FAIL "Uncommitted changes detected"

# Must be on main
[ "$(git branch --show-current)" = "main" ] || FAIL "Not on main branch"

# Must be up to date
git fetch origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || FAIL "main is behind origin"
```

### No Conflicts
```bash
# No existing feature branch for this game
! git branch --list "feature/game-*" | grep -q . || WARN "Existing feature branch found"

# No open PR with similar title
gh pr list --state open --json title | jq -e '.[] | select(.title | contains("Weekly Game"))' && FAIL "Open PR exists"
```

### Build Health
```bash
# Dependencies install
npm install || FAIL "npm install failed"

# Build succeeds
npm run build || FAIL "Build failed on main"

# Tests pass
npm run test || WARN "Tests failing on main"
```

### Permissions
```bash
# GitHub token valid
gh auth status || FAIL "GitHub not authenticated"

# Can push to origin
git push --dry-run origin main || FAIL "Cannot push to origin"
```

### Pre-Flight Report Format
```
## Pre-Flight Check Report

| Check | Status | Details |
|-------|--------|---------|
| Clean working directory | PASS/FAIL | {details} |
| On main branch | PASS/FAIL | Current: {branch} |
| Up to date with origin | PASS/FAIL | {commits behind} |
| No conflicting branches | PASS/WARN | {branch list} |
| No open PRs | PASS/FAIL | {pr list} |
| npm install | PASS/FAIL | {error if any} |
| npm build | PASS/FAIL | {error if any} |
| npm test | PASS/WARN | {failures if any} |
| GitHub auth | PASS/FAIL | {user} |
| Push permission | PASS/FAIL | {error if any} |

Overall: READY / NOT READY
```

---

## Dry-Run Mode Behavior

When `--dry-run` flag is set:

### Simulation Rules
```yaml
File Operations:
  - Log: "[DRY-RUN] Would create: {path}"
  - Log: "[DRY-RUN] Would modify: {path}"
  - Log: "[DRY-RUN] Would delete: {path}"
  - Action: Skip actual operation

Git Operations:
  - Log: "[DRY-RUN] Would commit: {message}"
  - Log: "[DRY-RUN] Would push: {branch}"
  - Action: Skip actual operation

GitHub Operations:
  - Log: "[DRY-RUN] Would create PR: {title}"
  - Log: "[DRY-RUN] Would create issue: {title}"
  - Log: "[DRY-RUN] Would merge PR: #{number}"
  - Action: Skip actual operation

Skill/Agent Invocations:
  - Execute normally (read-only analysis)
  - Capture outputs for planning
```

### Dry-Run Output Format
```
## Dry-Run Summary

### Files to Create
| Path | Size | Purpose |
|------|------|---------|
| {path} | {size} | {description} |

### Files to Modify
| Path | Changes | Preview |
|------|---------|---------|
| {path} | +{added}/-{removed} | {first 3 lines of diff} |

### Git Operations
1. Create branch: feature/game-{slug}
2. Commit: "{message}"
3. Push to origin/feature/game-{slug}

### GitHub Operations
1. Create PR: "{title}"
2. Create {n} issues for deferred bugs

### Execution Command
To execute this plan: /weekly-game-release --execute
```

---

## Error Handling

### On BLOCKED Operation Detected
```yaml
Action: Immediate abort
Log: "[BLOCKED] Attempted forbidden operation: {operation}"
Cleanup: None (no changes made yet, or rollback in progress)
User notification: "Workflow aborted: Attempted blocked operation"
```

### On CONFIRM Rejection
```yaml
Action: Pause workflow
Options:
  - Skip this operation and continue
  - Abort workflow
  - Retry with modifications
Log: "[CONFIRM-REJECTED] User rejected: {operation}"
```

### On Path Violation
```yaml
Action: Abort operation, continue workflow if possible
Log: "[PATH-VIOLATION] Attempted access to forbidden path: {path}"
Recovery: Skip file, log warning, continue if non-critical
```

---

## Audit Log Format

All guardrail decisions are logged:

```
[{timestamp}] [GUARDRAIL] [{level}] {message}
  Operation: {operation_type}
  Path: {path_if_applicable}
  Decision: {ALLOW|BLOCK|CONFIRM|SKIP}
  User Response: {if_confirmation_required}
  Context: {additional_context}
```

### Log Levels
- `INFO`: Safe operation allowed
- `WARN`: Operation allowed with warning
- `CONFIRM`: User confirmation requested
- `BLOCK`: Operation blocked
- `ABORT`: Workflow aborted due to violation
