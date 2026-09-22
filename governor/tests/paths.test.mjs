import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import {
  isSafeBash, isUnderHandoff, gitToplevel, repoDirFor, handoffOnDisk
} from '../scripts/lib/paths.mjs';

// os.tmpdir() is itself a symlink on macOS (/tmp -> /private/tmp); git
// resolves it when reporting the toplevel, so tests compare against the
// resolved path rather than the raw mkdtemp() one.
function tmp(prefix) { return realpathSync(mkdtempSync(join(tmpdir(), prefix))); }

function initRepo() {
  const dir = tmp('gov-repo-');
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'x@x.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'x'], { cwd: dir });
  return dir;
}

test('isSafeBash allows only the read-only/handoff git commands', () => {
  assert.ok(isSafeBash('git status'));
  assert.ok(isSafeBash('git commit -m "x"'));
  assert.ok(!isSafeBash('git push'));
  assert.ok(!isSafeBash('rm -rf .'));
});

test('isUnderHandoff matches regardless of cwd - anywhere in the path', () => {
  // The bug: a Write's absolute path lands inside the real worktree, but the
  // hook's stdin cwd drifted to an unrelated directory (e.g. a memory
  // project). The old cwd-relative check denied this; the fix does not care
  // about cwd at all.
  assert.ok(isUnderHandoff('/Users/x/wiser/weekly-arcade/docs/handoffs/2026-09-22-x.md', 'docs/handoffs/'));
  assert.ok(isUnderHandoff('docs/handoffs/2026-09-22-x.md', 'docs/handoffs/'));
  assert.ok(isUnderHandoff('docs/handoffs/x.md', 'docs/handoffs'));  // handoffPath without trailing slash
});

test('isUnderHandoff does not match a same-prefix file that is not under the directory', () => {
  assert.ok(!isUnderHandoff('docs/handoffs-legacy/x.md', 'docs/handoffs/'));
  assert.ok(!isUnderHandoff('docs/handoffs.md', 'docs/handoffs/'));
});

test('isUnderHandoff is false with no path or no handoffPath', () => {
  assert.ok(!isUnderHandoff(undefined, 'docs/handoffs/'));
  assert.ok(!isUnderHandoff('docs/handoffs/x.md', ''));
});

test('gitToplevel finds the repo root, and is null outside any repo', () => {
  const repo = initRepo();
  mkdirSync(join(repo, 'a/b'), { recursive: true });
  assert.equal(gitToplevel(join(repo, 'a/b')), repo);

  const outside = tmp('gov-norepo-');
  assert.equal(gitToplevel(outside), null);
});

test('repoDirFor resolves a relative file_path against cwd, then finds the toplevel', () => {
  const repo = initRepo();
  mkdirSync(join(repo, 'src'), { recursive: true });
  assert.equal(repoDirFor(repo, 'src/app.js'), repo);
  assert.equal(repoDirFor(repo, join(repo, 'src/app.js')), repo);
});

test('repoDirFor is null for a cwd outside any repo', () => {
  const outside = tmp('gov-norepo-');
  assert.equal(repoDirFor(outside, 'src/app.js'), null);
  assert.equal(repoDirFor(undefined, undefined), null);
});

test('handoffOnDisk finds a handoff written directly to disk, not through a hook', () => {
  const cwd = tmp('gov-cwd-');
  mkdirSync(join(cwd, 'docs/handoffs'), { recursive: true });
  writeFileSync(join(cwd, 'docs/handoffs/2026-09-22-preview-tt3d-all.md'), '# Handoff');
  const found = handoffOnDisk(cwd, 'docs/handoffs/', null);
  assert.ok(found && found.endsWith('2026-09-22-preview-tt3d-all.md'));
});

test('handoffOnDisk respects the recency filter against capReachedAt', () => {
  const cwd = tmp('gov-cwd-');
  mkdirSync(join(cwd, 'docs/handoffs'), { recursive: true });
  const file = join(cwd, 'docs/handoffs/old.md');
  writeFileSync(file, '# Old');
  const old = new Date(Date.now() - 60_000);
  utimesSync(file, old, old);

  assert.equal(handoffOnDisk(cwd, 'docs/handoffs/', Date.now()), null, 'older than capReachedAt: not credited');
  assert.ok(handoffOnDisk(cwd, 'docs/handoffs/', Date.now() - 120_000), 'newer than an earlier capReachedAt: credited');
});

test('handoffOnDisk prefers the git toplevel over a drifted cwd', () => {
  const repo = initRepo();
  mkdirSync(join(repo, 'docs/handoffs'), { recursive: true });
  writeFileSync(join(repo, 'docs/handoffs/2026-09-22-main.md'), '# Handoff');
  mkdirSync(join(repo, 'sub/dir'), { recursive: true });
  // cwd passed in is a subdirectory of the repo, not the toplevel itself.
  const found = handoffOnDisk(join(repo, 'sub/dir'), 'docs/handoffs/', null);
  assert.ok(found && found.includes('2026-09-22-main.md'));
});

test('handoffOnDisk is null - fails open - with no matching directory anywhere', () => {
  const outside = tmp('gov-norepo-');
  assert.equal(handoffOnDisk(outside, 'docs/handoffs/', null), null);
});
