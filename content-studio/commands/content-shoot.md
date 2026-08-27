---
description: Shoot, score, caption and render one gameplay clip for a game
argument-hint: <game> [--format reel|short|long] [--template satisfying|near-miss|challenge] [--skip-capture]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Skill
---

# /content-shoot

Produce one finished, unpublished clip for **$1**.

## Preconditions, checked in order

1. **Locate the game repo.** Default `~/Documents/weekly-arcade`. Confirm
   `scripts/demo-capture/capture.js` exists.
2. **Confirm a capture config exists** at
   `scripts/demo-capture/configs/$1.json`. If it does not, stop and say so:
   authoring one is `capture-config-author`'s job and is not on this path.
3. **Confirm the dev server is up** on `http://localhost:4321`. Captures must run
   against unminified source or every source patch misses silently. If it is
   down, start it (`npx nx dev web-astro`) and wait for it to serve.
4. **Check machine load** with `uptime` against `sysctl -n hw.ncpu`. If the
   1-minute load average exceeds roughly twice the core count, say so and stop
   before shooting - captures come back frame-starved and unusable, and this is
   cheaper to check than to diagnose afterwards.
5. **Clear orphaned Chrome** from earlier failed runs: `pkill -f "demo-capture-"`.
6. **Read the brief** at `content/briefs/$1.json` if present. If missing, run
   `/content-brief $1` first.

## Steps

1. **Plan the shot.** Load the `video-hooks` skill and read
   `content/shot-log.jsonl` to see which template and hook this game has used
   recently; pick one it has not. Honour `--template` if given.
2. **Write the VO.** Load the `vo-scripting` skill. Pin the payoff line to a
   gameplay beat with `atMark` naming a `[demo]` mark label from the capture
   config, not a guessed timestamp.
3. **Write the shot spec** to `content/shots/$1/<shot-id>.json`. Shot id is
   `<game>-<template>-<YYYYMMDD>`. Include `platforms`, `overlays`, `metadata`
   (IG caption, YT title, hashtags), `music` if a bed exists in
   `content/music/`, and `preferMark` plus `preferMarkAtMs` so takes can be
   scored on timing.
   The YT title for a vertical cut must carry two or three topical hashtags -
   `youtube_upload.py` refuses a Short whose title has none. Genre and platform
   words, not the game name; see `social-publishing`.

4. **Shoot it:**
   ```bash
   node <plugin>/lib/shoot.mjs content/shots/$1/<shot-id>.json \
     --repo <repo> --out content/out/<date>
   ```
   It shoots several seeds, rejects starved takes, picks the best, synthesizes
   per-line VO, builds captions, and renders every requested platform.
5. **Report** the take table (seed, unique fps, score), the output files with
   dimensions and durations, and the resolved VO timings. If every take was
   starved, report the load average alongside the failure - the config is
   probably fine.
6. **Do not publish.** Point at `/content-review`.

## Flags

- `--format` one or more of `reel`, `short`, `long`. Default `reel`.
- `--template` overrides hook selection.
- `--skip-capture` reuses the existing `plate.mp4` in the shot's work dir. Use it
  when iterating on VO or captions so a good take is not re-shot.
- `--takes N` seeds to try. Default 3.

## Never

- Never shoot against the production URL.
- Never render a plate that failed the frame gate without saying so explicitly.
- Never treat a `MISS` on a source patch as a warning; the game changed and the
  brief is stale.
