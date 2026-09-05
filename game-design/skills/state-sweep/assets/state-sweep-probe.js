/* =====================================================================
   STATE SWEEP PROBE

   Paste this whole file as the `initScript` of a chrome-devtools-mcp
   `navigate_page` call. It MUST run before the page's own scripts: every
   metric here works by wrapping a constructor or a factory, and anything
   the game allocated before the wrapper was installed is invisible.

   Installing it with `evaluate_script` after load is the single most
   common way to get a clean-looking sweep on a leaking game.

   It exposes four readers on `window`:

     __live()     live listeners, counted by whether the target still
                  exists AND is still in the document
     __pend()     setTimeout ids that are neither fired nor cleared,
                  each with the delay and the stack that created it
     __audio()    source nodes made vs ended, and the running gap
     __frames()   frame intervals since the last read, drained

   Every one of them is a measurement, not an assertion. Read the
   companion SKILL.md for what each number does and does not prove.
   ===================================================================== */
(() => {
  const M = {
    recs: [],            // {ref, type, w, d} per addEventListener call
    srcMade: 0, srcEnded: 0, nodeMade: 0,
    rafLive: 0,
    frames: [], lastFrame: 0,
  };
  window.__M = M;

  /* --------------------------------------------------------------
     LISTENERS. The count of addEventListener CALLS is not a leak
     curve - a game that rebuilds a grid on every paint calls it
     hundreds of times and leaks nothing, because the elements are
     replaced. What matters is whether the TARGET is still reachable
     and still in the document. WeakRef is what separates the two:
     a detached element with no other reference is collected, and its
     record here goes empty.
     -------------------------------------------------------------- */
  const ael = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    try {
      M.recs.push({
        ref: new WeakRef(this),
        type: type,
        w: this === window,
        d: this === document,
      });
    } catch (e) { /* a target WeakRef cannot hold is not a leak we can see */ }
    return ael.call(this, type, fn, opts);
  };

  window.__live = function () {
    const out = { total: 0, win: 0, doc: 0, el: 0, byType: {}, byTarget: {} };
    for (const r of M.recs) {
      const t = r.ref.deref();
      if (!t) continue;                                  // collected: not live
      if (!(r.w || r.d || t.isConnected === true)) continue;  // detached: not live
      out.total++;
      if (r.w) out.win++; else if (r.d) out.doc++; else out.el++;
      out.byType[r.type] = (out.byType[r.type] || 0) + 1;
      const key = r.w ? 'window' : r.d ? 'document'
        : t.tagName ? t.tagName + (t.id ? '#' + t.id : '.' + String(t.className).split(' ')[0])
        : '?';
      out.byTarget[key] = (out.byTarget[key] || 0) + 1;
    }
    return out;
  };

  /* --------------------------------------------------------------
     TIMERS. A pending setTimeout is only interesting with its stack.
     On a real sweep the pending set filled up with 30s promise
     timers from the site's shared auth module and a 60s beacon from
     an analytics script - neither of them the game's, and both of
     them would have been "fixed" in the wrong file without this.
     -------------------------------------------------------------- */
  const st = window.setTimeout.bind(window);
  const ct = window.clearTimeout.bind(window);
  const pend = new Map();
  window.setTimeout = function (fn, delay) {
    const args = Array.prototype.slice.call(arguments, 2);
    const stack = new Error().stack;
    const id = st(function () {
      pend.delete(id);
      if (typeof fn === 'function') fn.apply(null, args);
    }, delay);
    pend.set(id, { delay: delay, at: Date.now(), stack: stack });
    return id;
  };
  window.clearTimeout = function (id) { pend.delete(id); return ct(id); };

  const si = window.setInterval.bind(window);
  const ci = window.clearInterval.bind(window);
  const ivs = new Map();
  window.setInterval = function (fn, delay) {
    const id = si.apply(null, arguments);
    ivs.set(id, { delay: delay, at: Date.now(), stack: new Error().stack });
    return id;
  };
  window.clearInterval = function (id) { ivs.delete(id); return ci(id); };

  const trim = (s) => (s || '').split('\n').slice(1, 5)
    .map((l) => l.trim().replace(/^at /, '').replace(/https?:\/\/[^ )]*\//g, ''))
    .join(' <- ');

  const dump = (m) => {
    const groups = {};
    for (const v of m.values()) {
      const k = v.delay + 'ms | ' + trim(v.stack);
      groups[k] = (groups[k] || 0) + 1;
    }
    return { count: m.size, groups: Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 10) };
  };
  window.__pend = () => dump(pend);
  window.__intervals = () => dump(ivs);

  /* --------------------------------------------------------------
     AUDIO. Total node creations is another forged curve: gains,
     panners and filters have no lifetime of their own. A WebAudio
     subgraph is released when its SOURCE stops and nothing holds a
     JS reference, so the only honest question is whether sources
     end at the rate they are made. Watch the GAP, not the totals -
     the gap is the voices currently sounding and should sit flat
     while `made` climbs into the thousands.
     -------------------------------------------------------------- */
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    const SOURCES = ['createOscillator', 'createBufferSource', 'createConstantSource'];
    const ALL = SOURCES.concat([
      'createGain', 'createBiquadFilter', 'createWaveShaper', 'createStereoPanner',
      'createDelay', 'createConvolver', 'createDynamicsCompressor',
      'createChannelMerger', 'createChannelSplitter', 'createPanner', 'createAnalyser',
    ]);
    for (const f of ALL) {
      if (!AC.prototype[f]) continue;
      const orig = AC.prototype[f];
      const isSource = SOURCES.indexOf(f) >= 0;
      AC.prototype[f] = function () {
        const n = orig.apply(this, arguments);
        M.nodeMade++;
        if (isSource) {
          M.srcMade++;
          ael.call(n, 'ended', () => { M.srcEnded++; });
        }
        return n;
      };
    }
  }
  window.__audio = () => ({
    srcMade: M.srcMade, srcEnded: M.srcEnded,
    gap: M.srcMade - M.srcEnded, nodeMade: M.nodeMade,
  });

  /* --------------------------------------------------------------
     FRAMES. Sampled on this probe's OWN rAF, never by asking the
     game how long its frame took. A loop that measures itself
     cannot see a second loop running beside it, and a second loop
     is the failure this catches: `rafLive` on a screen the game
     says it is not animating must be 0.
     -------------------------------------------------------------- */
  const raf = window.requestAnimationFrame.bind(window);
  const caf = window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) {
    M.rafLive++;
    return raf((t) => { M.rafLive--; cb(t); });
  };
  window.cancelAnimationFrame = function (id) { M.rafLive--; return caf(id); };

  M.lastFrame = performance.now();
  const sample = (t) => {
    M.frames.push(t - M.lastFrame);
    M.lastFrame = t;
    if (M.frames.length > 20000) M.frames.shift();
    raf(sample);   // the raw one, so the probe is not counted in rafLive
  };
  raf(sample);

  window.__frames = () => {
    const f = M.frames.splice(0, M.frames.length).sort((a, b) => a - b);
    if (!f.length) return { n: 0 };
    const at = (q) => +(f[Math.floor(f.length * q)] || 0).toFixed(1);
    return { n: f.length, p50: at(0.5), p95: at(0.95), p99: at(0.99), max: +f[f.length - 1].toFixed(1) };
  };

  window.__snap = (tag) => ({
    tag: tag,
    live: window.__live().total,
    dom: document.getElementsByTagName('*').length,
    rafLive: M.rafLive,
    pend: window.__pend().count,
    intervals: window.__intervals().count,
    audio: window.__audio(),
    frames: window.__frames(),
    mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
  });

  /* The service worker serves the PREVIOUS build. Every sweep that
     does not do this is a sweep of whatever shipped last. */
  if (navigator.serviceWorker) {
    navigator.serviceWorker.getRegistrations()
      .then((rs) => rs.forEach((r) => r.unregister()))
      .catch(() => {});
  }
})();
