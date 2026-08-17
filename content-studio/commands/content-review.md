---
description: Open the local review dashboard and record approve/reject decisions
argument-hint: [outRoot] [--port 4399]
allowed-tools: Read, Bash, Glob
---

# /content-review

Serve every rendered shot for approval. Nothing here publishes.

## Steps

1. Resolve the render root. Default `content/out` under the game repo; `$1`
   overrides it.
2. Start the dashboard:
   ```bash
   node <plugin>/lib/review.mjs <outRoot> ${PORT:-4399}
   ```
   Run it in the background and report the URL. It binds to `127.0.0.1` only.
3. Summarise what is waiting, per shot: id, game, template, unique fps of the
   chosen take, which platforms rendered, and current approval state.
4. Flag anything questionable before the user watches it:
   - unique fps under 20 on the chosen take
   - a shot whose `preferMark` never fired (visible in `marks` in `shot.json`)
   - VO that runs longer than the plate
   - missing `metadata.igCaption` or `metadata.ytTitle`
5. Leave the server running and stop describing the clips. The point of the gate
   is that a person watches them.

## What approval means

Approval writes `approved: true` and `approvedAt` into that shot's `shot.json`.
It publishes nothing. `/content-publish` acts on approved shots, and the two are
separate commands on purpose.

State the asymmetry plainly whenever approval is discussed:

- **YouTube** uploads land as a **private draft**. Reversible; publish from Studio.
- **Instagram** has no draft state. Publishing is immediate and **cannot be
  undone**. The approval click does not publish, but `/content-publish` does, and
  for Instagram that is final.
