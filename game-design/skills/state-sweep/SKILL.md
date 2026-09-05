---
name: state-sweep
description: >
  Long-run state and leak sweep for a browser game. Finds what survives a round,
  a screen change or a session - stacked listeners, orphaned DOM, undying timers,
  WebAudio voices that never end, caches with an unbounded key space, and a second
  rAF loop. Measures each one in a real browser instead of reading for it, because
  every cheap proxy for these metrics forges a leak curve. Run it before every
  game release and after any merge that touches game.js.
---

# State Sweep

A game that plays well for ninety seconds and badly for twenty minutes is not
slow, it is **accumulating**. This skill finds what accumulates.

Six things survive when they should not, and each has a cheap proxy that lies
about it. The whole skill is: use the honest measure, and read the stack before
you fix anything.

| What accumulates | The lying proxy | The honest measure |
|---|---|---|
| Listeners on persistent nodes | count of `addEventListener` calls | live listeners: target still reachable AND `isConnected` |
| Detached DOM kept alive | "the screen looks right" | total element count, flat across N cycles |
| Timers | count of `setTimeout` calls | pending ids, **with their creation stack** |
| WebAudio voices | total nodes created | source nodes made vs **ended**; watch the gap, not the totals |
| A second game loop | fps looks fine | probe-owned `rafLive` on a screen that should not animate |
| Caches, pools, run arrays | reading the code | the key space and the prune site, both named |

## Phase 0 - do not sweep the wrong build

Two failures make an entire sweep meaningless and neither one errors:

1. **The service worker serves the previous build.** Unregister every
   registration and delete every cache, then navigate again. The probe does this
   on load, but confirm it: if the numbers look identical to last week's, this is
   why.
2. **The probe was installed after the game.** Every metric here wraps a factory
   or a prototype method. Anything allocated before the wrapper is invisible, so
   a game that stacks all its listeners at boot measures perfectly clean. The
   probe MUST be the `initScript` of the navigation, not an `evaluate_script`
   after it.

Confirm both before reading a single number:

```
navigate_page(url, initScript: <contents of assets/state-sweep-probe.js>)
evaluate_script(() => ({ probe: typeof window.__live, dom: document.getElementsByTagName('*').length }))
```

`probe` must be `"function"`. If it is `"undefined"`, the init script did not
run and everything after this is fiction.

## Phase 1 - the static pass

Fast, and it tells you where to point the browser. Answer each question with a
line number, not an impression.

```bash
G=path/to/game.js

# 1. Wiring: every addEventListener, and the function that owns it.
#    A wire* function called once from boot is fine. The same call inside a
#    paint* or open* function that runs on every screen open is the leak.
grep -n "addEventListener" "$G"

# 2. Timers: every setTimeout/setInterval needs a clear on the path that
#    replaces it, and stopLoop needs to be reachable from every screen exit.
grep -n "setInterval\|setTimeout\|requestAnimationFrame\|clearTimeout\|clearInterval\|cancelAnimationFrame" "$G"

# 3. Containers: every list builder must clear before it appends.
#    Count the clears against the appends - both spellings.
grep -c "appendChild" "$G"
grep -cF "textContent = '';" "$G"; grep -cF "innerHTML = '';" "$G"

# 4. Module-level collections: for each one, name where it drains.
grep -n "^  let \|^  const .*= \[\]\|^  const .*= {}\|^  const .*= new Map\|^  const .*= new Set" "$G"

# 5. Pushes into anything persisted (a save blob, a meta object): each needs
#    a dedupe guard, or the save grows for the life of the account.
grep -n -B3 "\.push(" "$G" | grep -A3 "meta\.\|save\|acct\."
```

Attribute every listener to its enclosing function mechanically rather than by
eye - the file is long and the eye skips:

```bash
python3 - "$G" <<'PY'
import re, sys
src = open(sys.argv[1]).read().split('\n')
fns = [(i + 1, m.group(1)) for i, l in enumerate(src)
       if (m := re.match(r'^  (?:async )?function (\w+)', l))]
def owner(ln):
    best = '?'
    for l, n in fns:
        if l <= ln: best = n
        else: break
    return best
for i, l in enumerate(src):
    if 'addEventListener' in l:
        print(f"{i+1:6d}  {owner(i+1):24s}  {l.strip()[:70]}")
PY
```

Two shapes are worth flagging on sight:

- **A cache keyed on a size.** `cache.set(kind + ':' + size, ...)` is bounded
  only if every caller passes a constant. One caller passing a viewport-derived
  or animated size makes the key space infinite. Grep the call sites and read
  the arguments; do not assume.
- **A start function with no re-entry guard.** `function startLoop() { raf = requestAnimationFrame(tick) }`
  called twice runs two loops forever, at double CPU, with no error and a
  plausible-looking fps. It needs `if (raf) return;`.

## Phase 2 - the screen-cycle sweep

Open and close every menu, panel and overlay 25 times. This is where listeners
on persistent nodes stack.

```js
async () => {
  const $ = (i) => document.getElementById(i);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const cycle = async () => {
    // one open/close pair per screen the game has
    $('navCustomize').click(); await sleep(30); $('czBack').click(); await sleep(30);
    $('navRegistry').click();  await sleep(30); $('rgBack').click(); await sleep(30);
    $('navBoard').click();     await sleep(60); $('boardClose').click(); await sleep(30);
    $('navSettings').click();  await sleep(30); $('setClose').click(); await sleep(30);
  };
  const out = [window.__snap('base')];
  for (let r = 0; r < 25; r++) { await cycle(); if ([0,4,9,24].includes(r)) out.push(window.__snap('cycle' + (r+1))); }
  await sleep(4000);                       // let in-flight toasts and banners fire
  out.push(window.__snap('settled'));
  out.push({ pend: window.__pend(), targets: Object.entries(window.__live().byTarget).sort((a,b)=>b[1]-a[1]).slice(0,12) });
  return out;
}
```

**Reading it.** `live` and `dom` rise once, on the first cycle, as the screens
build themselves for the first time. From cycle 2 to cycle 25 both must be
**flat**. A rising `live` with a flat `dom` is a listener stacked on a
persistent node - `byTarget` names it. A rising `dom` is a container that
appends without clearing.

`pend` will be non-zero and that is usually not the game. Read `__pend().groups`:
each group carries the delay and the stack. On a real sweep the pending set was
almost entirely 30-second promise timers from the site's shared auth module and
a 60-second analytics beacon. Both were other people's files. Attribute before
you fix, and if the owner is a shared or third-party file, **report it, do not
edit it** - see `orchestrator-guardrails`.

## Phase 3 - the round-to-round sweep

Play a round, end it, and return, twelve times. This is where per-run state that
is rebuilt rather than reset shows up, and where a loop that was started on
entry but never stopped on exit becomes visible.

```js
async () => {
  const $ = (i) => document.getElementById(i);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const out = [window.__snap('boot')];
  for (let r = 0; r < 12; r++) {
    $('navStart').click();  await sleep(150);
    $('launch').click();    await sleep(250);
    $('enter').click();     await sleep(1500);   // actually fly for a moment
    $('pauseBtn').click();  await sleep(150);
    $('leaveRun').click();  await sleep(600);
    $('sumLobby').click();  await sleep(300);
    if ([0,2,5,11].includes(r)) out.push(window.__snap('run' + (r+1)));
  }
  return out;
}
```

**`rafLive` must be 0 in every snapshot taken on a non-animating screen.** That
single number is the whole test for the second-loop bug, and it is the one no
fps counter can see: two loops each render correctly, the game looks right, and
the device runs hot until the battery is flat.

## Phase 4 - the sustained-run sweep

The one that answers "does this degrade over a long session". Drive the game
continuously for at least 90 seconds - 3 minutes is better - and bucket the
metrics every 10 seconds. Do not sample by hand; the interesting failure is a
slope, and a slope needs points.

```js
async () => {
  const c = document.getElementById('gameCanvas');
  const r = c.getBoundingClientRect();
  let a = 0;
  const pd = (t, x, y) => c.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true, buttons: 1 }));
  pd('pointerdown', r.left + r.width / 2, r.top + r.height / 2);
  // fly a circle, and climb back in whenever the run ends
  window.__driver = setInterval(() => {
    a += 0.15;
    pd('pointermove', r.left + r.width/2 + Math.cos(a) * r.width * 0.3,
                      r.top + r.height/2 + Math.sin(a) * r.height * 0.3);
    for (const [screen, btn] of [['draft','.card'], ['tower','#enter'], ['summary','#again'], ['ascent','#launch']]) {
      const el = document.getElementById(screen);
      if (el && el.classList.contains('on')) { const b = el.querySelector(btn); if (b) b.click(); }
    }
  }, 120);
  window.__buckets = [];
  window.__bucket = setInterval(() => window.__buckets.push({ t: window.__buckets.length * 10, ...window.__snap('t') }), 10000);
  return { started: true };
}
```

Poll `window.__buckets` until you have at least nine of them, then read the
**slopes**, not the values:

- `frames.p50` and `frames.p95` flat, bucket to bucket. A p95 that climbs while
  p50 holds is garbage collection, which means allocation per frame.
- `audio.gap` flat while `audio.srcMade` climbs into the thousands. The gap is
  the voices currently sounding. A gap that tracks `srcMade` is a graph that
  never releases, and it ends as audio dropouts once the context runs out of
  voices - typically twenty minutes in, which is why nobody catches it.
- `dom` and `mem` with no trend. Both oscillate; neither should climb.

Then stop the driver, return to the lobby and take one last snapshot. `rafLive`
must be back to 0.

## What a pass looks like

Report the numbers, not a verdict. A pass is four flat lines and one named
owner for every pending timer:

```
Screen cycles (25x):   live 163 -> 163      dom 1418 -> 1418     rafLive 0
Round trips (12x):     live 147 -> 147      dom 1347 -> 1347     rafLive 0
Sustained (100s):      p50 8.3 -> 8.3ms     p95 9.2 -> 9.2ms     mem 132 -> 129MB
Audio (100s):          srcMade 1954  srcEnded 1920  gap 34 (non-trending)
Pending timers:        23 x 30000ms auth.js:93 (shared, reported not fixed)
                        1 x 60000ms clarity.js (third party)
```

## Traps this skill exists because of

1. **The listener count that grew to 2015.** A first sweep counted
   `addEventListener` calls and showed a clean linear leak, 71 per screen cycle.
   The DOM was flat the whole time: the elements were being replaced and their
   listeners collected with them. Counting calls measures churn. Only
   `WeakRef` + `isConnected` measures a leak.
2. **The audio graph that looked like it leaked 1500 nodes.** Total node
   creations climb forever by design - gains, panners and filters are made per
   voice. Only sources have a lifetime. `srcMade - srcEnded` was 34 after two
   thousand voices, which is the number of voices actually sounding.
3. **The timer leak in someone else's file.** Pending timers grew two per
   screen cycle and never drained. They were 30-second promise timers from the
   site's shared auth module, plus an analytics beacon - both off-limits to
   edit. Without the creation stack this would have been "fixed" inside the game,
   where it did not exist.
4. **The probe installed too late.** Running the instrument from
   `evaluate_script` after load shows a game with no boot-time listeners at all,
   which reads as a clean result.
5. **The service worker.** Three screenshots in a row showed pre-edit rendering
   on a game whose dev server serves `public/` live. There was never anything to
   rebuild; the SW was serving the last build.
6. **A loop measuring itself.** An in-game fps counter cannot see a second rAF
   loop, and a second loop is the failure most worth catching. Sample frames on
   the probe's own rAF and count live callbacks separately.

## Reporting

Findings go out ranked by what they cost a real session, with the measurement
attached to each. Split them three ways, because they are acted on differently:

- **In this game's files** - fix, then re-run the phase that found it.
- **In shared or third-party files** - report with the stack; do not edit.
  `api-client.js` and `auth.js` are blocked by `orchestrator-guardrails`.
- **Bounded but unbounded-looking** - a run array that grows one entry per
  layer, a tower that keeps every layer flown. Name the bound and the realistic
  ceiling, and say plainly that it is not a leak, so the next sweep does not
  re-litigate it.

If a fix lands, add a `scripts/<name>-check.js` gate in the repo's existing
convention so the class cannot come back, and mutation-test the gate: break the
thing it checks and confirm it fails. A guard that passes against a deliberately
broken input is checking nothing.
