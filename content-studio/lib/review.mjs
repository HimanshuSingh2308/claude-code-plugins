#!/usr/bin/env node
/* Local review dashboard - the approval gate.

   A tiny HTTP server rather than a static file, because approval has to persist
   back into each shot.json and a file:// page cannot write anything. It binds to
   127.0.0.1 only: these are unpublished drafts and there is no reason for them
   to be reachable from the network.

   Nothing in this file publishes. It records intent; /content-publish acts on
   it. That split is deliberate - the button that costs money or goes live should
   not be the same button that says "this one is good". */

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

function findShots(root) {
  const found = [];
  const walk = (dir, depth = 0) => {
    if (depth > 3 || !existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) walk(full, depth + 1);
      else if (entry === 'shot.json') found.push(full);
    }
  };
  walk(root);
  return found
    .map((f) => {
      try { return { file: f, dir: path.dirname(f), data: JSON.parse(readFileSync(f, 'utf8')) }; }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => statSync(b.file).mtimeMs - statSync(a.file).mtimeMs);
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function page(shots, root) {
  const cards = shots.map((s, i) => {
    const d = s.data;
    const rel = (f) => `/media/${encodeURIComponent(path.relative(root, f))}`;
    const players = (d.outputs || []).map((o) => `
      <figure>
        <figcaption>${esc(o.platform)} &middot; ${o.width}&times;${o.height} &middot; ${(o.durationMs / 1000).toFixed(1)}s</figcaption>
        <video src="${rel(o.file)}" controls preload="metadata" playsinline></video>
      </figure>`).join('');
    const vo = (d.vo || []).map((l) => `
      <tr><td class="t">${(l.startMs / 1000).toFixed(2)}s</td><td>${esc(l.text)}</td></tr>`).join('');
    const state = d.approved === true ? 'approved' : d.approved === false ? 'rejected' : 'pending';
    const meta = d.metadata || {};
    return `
    <article class="shot ${state}" data-id="${esc(d.id)}">
      <header>
        <h2>${esc(d.id)}</h2>
        <span class="badge">${esc(d.game)} / ${esc(d.template || 'n/a')}</span>
        <span class="badge">seed ${esc(d.seed)}</span>
        <span class="badge ${d.plate?.uniqueFps >= 20 ? 'good' : 'warn'}">${esc(d.plate?.uniqueFps)} unique fps</span>
        <span class="state">${state}</span>
      </header>
      <div class="players">${players || '<p class="muted">no renders</p>'}</div>
      <details><summary>Voiceover (${(d.vo || []).length} lines)</summary><table>${vo}</table></details>
      <details><summary>Metadata</summary>
        <dl>
          <dt>Instagram caption</dt><dd>${esc(meta.igCaption) || '<span class="muted">unset</span>'}</dd>
          <dt>YouTube title</dt><dd>${esc(meta.ytTitle) || '<span class="muted">unset</span>'}</dd>
          <dt>Hashtags</dt><dd>${esc((meta.hashtags || []).join(' ')) || '<span class="muted">unset</span>'}</dd>
        </dl>
      </details>
      <footer>
        <button data-act="approve" data-i="${i}">Approve for publish</button>
        <button data-act="reject" data-i="${i}" class="ghost">Reject</button>
        <span class="note">Approving only marks it. <strong>/content-publish</strong> uploads:
          YouTube lands as a private draft, Instagram goes live immediately and cannot be undone.</span>
      </footer>
    </article>`;
  }).join('');

  return `<!doctype html><meta charset="utf-8"><title>content-studio review</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{color-scheme:dark;--bg:#0e0f12;--card:#171a1f;--line:#262b33;--fg:#e8eaed;--muted:#8b939f;--ok:#41d18a;--warn:#f0b840}
*{box-sizing:border-box}body{margin:0;padding:28px;background:var(--bg);color:var(--fg);
font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
h1{font-size:20px;margin:0 0 4px}.sub{color:var(--muted);margin:0 0 24px;font-size:13px}
.shot{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px;margin-bottom:18px}
.shot.approved{border-color:var(--ok)}.shot.rejected{opacity:.5}
header{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}
h2{font-size:16px;margin:0}
.badge{font-size:11px;color:var(--muted);border:1px solid var(--line);border-radius:99px;padding:2px 9px}
.badge.good{color:var(--ok);border-color:var(--ok)}.badge.warn{color:var(--warn);border-color:var(--warn)}
.state{margin-left:auto;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.players{display:flex;gap:14px;flex-wrap:wrap}
figure{margin:0}figcaption{font-size:11px;color:var(--muted);margin-bottom:6px}
video{width:248px;border-radius:8px;background:#000;display:block}
details{margin-top:12px;font-size:13px}summary{cursor:pointer;color:var(--muted)}
table{width:100%;border-collapse:collapse;margin-top:8px}td{padding:3px 0;vertical-align:top}
td.t{color:var(--muted);width:64px;font-variant-numeric:tabular-nums}
dl{margin:8px 0 0}dt{color:var(--muted);font-size:12px;margin-top:8px}dd{margin:2px 0 0}
footer{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:16px;padding-top:14px;border-top:1px solid var(--line)}
button{background:var(--ok);color:#08130d;border:0;border-radius:8px;padding:9px 15px;font-weight:600;cursor:pointer}
button.ghost{background:transparent;color:var(--muted);border:1px solid var(--line)}
.note{font-size:11px;color:var(--muted);flex:1;min-width:240px}
.muted{color:var(--muted)}
</style>
<h1>content-studio review</h1>
<p class="sub">${shots.length} shot(s) in ${esc(root)}</p>
${cards || '<p class="muted">Nothing rendered yet. Run /content-shoot first.</p>'}
<script>
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  b.disabled = true;
  const res = await fetch('/decision', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ i: Number(b.dataset.i), approved: b.dataset.act === 'approve' })
  });
  if (res.ok) location.reload(); else { b.disabled = false; alert('failed to save'); }
});
</script>`;
}

export function serveReview({ root, port = 4399 }) {
  let shots = findShots(root);

  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');

    if (req.method === 'POST' && url.pathname === '/decision') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        try {
          const { i, approved } = JSON.parse(body);
          const shot = shots[i];
          if (!shot) { res.writeHead(404).end(); return; }
          shot.data.approved = approved;
          shot.data.approvedAt = new Date().toISOString();
          writeFileSync(shot.file, `${JSON.stringify(shot.data, null, 2)}\n`);
          res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
        } catch (e) {
          res.writeHead(400, { 'content-type': 'text/plain' }).end(String(e.message));
        }
      });
      return;
    }

    if (url.pathname.startsWith('/media/')) {
      const relRaw = decodeURIComponent(url.pathname.slice('/media/'.length));
      const full = path.resolve(root, relRaw);
      // Serving arbitrary paths from a local server is still worth containing:
      // a path that escapes the render root is a bug, not a request to honour.
      if (!full.startsWith(path.resolve(root)) || !existsSync(full)) { res.writeHead(404).end(); return; }
      const buf = readFileSync(full);
      const type = full.endsWith('.mp4') ? 'video/mp4' : full.endsWith('.wav') ? 'audio/wav' : 'application/octet-stream';
      res.writeHead(200, { 'content-type': type, 'content-length': buf.length, 'accept-ranges': 'none' }).end(buf);
      return;
    }

    shots = findShots(root);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page(shots, root));
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${port}/` }));
  });
}

/* CLI: node lib/review.mjs <outRoot> [port] */
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = path.resolve(process.argv[2] || 'content/out');
  const port = Number(process.argv[3] || 4399);
  const { url } = await serveReview({ root, port });
  console.log(`review dashboard: ${url}`);
  console.log(`serving ${findShots(root).length} shot(s) from ${root}`);
  console.log('Ctrl-C to stop.');
}
