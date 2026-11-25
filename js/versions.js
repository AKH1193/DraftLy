/* DraftLy: Version History. Snapshots are kept on each device (up to 60 per document). */
const Versions = (() => {
  const MAX = 60, GAP = 10 * 60 * 1000;
  const last = {}; // docId -> { ts, html }
  const words = html => (h('div', { html }).textContent.match(/\S+/g) || []).length;
  const deviceLabel = () => IS_NATIVE ? 'Android phone' : IS_IOS ? (/iPad/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform)) ? 'iPad' : 'iPhone') : /Mac/.test(navigator.platform) ? 'Mac' : 'this device';
  async function list(id) { return (await KV.get('v:' + id)) || []; }
  async function get(id, ts) { return KV.get('vd:' + id + ':' + ts); }
  /* save a snapshot of a document record { id, title, html, settings, comments } */
  async function snap(rec, reason, force) {
    if (!rec || !rec.id || rec.stub || !rec.html) return;
    const id = rec.id, now = Date.now();
    let l = last[id];
    if (!l) { const vs = await list(id); const v = vs[0]; l = last[id] = v ? { ts: v.ts, html: (await get(id, v.ts) || {}).html } : { ts: 0, html: null }; }
    if (l.html === rec.html) return;
    if (!force && now - l.ts < GAP) return;
    const data = { title: rec.title, html: rec.html, settings: JSON.parse(JSON.stringify(rec.settings || {})), comments: JSON.parse(JSON.stringify(rec.comments || {})) };
    await KV.set('vd:' + id + ':' + now, data);
    const vs = await list(id);
    vs.unshift({ ts: now, reason, by: deviceLabel(), words: words(rec.html), title: rec.title });
    while (vs.length > MAX) { const old = vs.pop(); await KV.del('vd:' + id + ':' + old.ts); }
    await KV.set('v:' + id, vs);
    last[id] = { ts: now, html: rec.html };
  }
  async function removeAll(id) { for (const v of await list(id)) await KV.del('vd:' + id + ':' + v.ts); await KV.del('v:' + id); delete last[id]; }
  return { snap, list, get, removeAll };
})();

function versionsDialog() {
  const id = doc.id;
  const body = h('div', { class: 'ver-list' }, h('p', { class: 'note' }, 'Loading…'));
  const m = modal('Version History: ' + doc.title, h('div', null,
    h('p', { class: 'note' }, 'DraftLy keeps a copy of this document about every 10 minutes while you work, when you save, and before changes arrive from your other devices. Each device keeps its own history (the last 60 versions).'), body), [{ label: 'Close', primary: true }], { wide: true });
  (async () => {
    await Versions.snap(Object.assign(record(), {}), 'Current', false);
    const vs = await Versions.list(id);
    body.innerHTML = '';
    if (!vs.length) { body.append(h('p', { class: 'note' }, 'No earlier versions yet. Versions appear here as you work.')); return; }
    let day = '';
    vs.forEach((v, i) => {
      const d = new Date(v.ts), dl = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      if (dl !== day) { day = dl; body.append(h('div', { class: 'ver-day' }, dl)); }
      const act = (t, fn, primary) => h('button', { class: 'btn' + (primary ? ' primary' : ''), type: 'button', onclick: fn }, t);
      body.append(h('div', { class: 'ver-row' },
        h('div', { class: 'ver-info' }, h('b', null, d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })), h('span', null, `${v.reason || 'Auto'} · ${v.by || ''} · ${v.words} words`)),
        h('div', { class: 'ver-acts' },
          act('Preview', () => previewVersion(id, v)),
          act('Compare', () => compareVersion(id, v)),
          act('Restore', () => restoreVersion(id, v), true))));
    });
  })();
}
async function previewVersion(id, v) {
  const data = await Versions.get(id, v.ts); if (!data) return toast('This version is no longer available');
  const page = h('div', { class: 'splitdoc ver-prev', html: data.html });
  page.querySelectorAll('[contenteditable]').forEach(e => e.removeAttribute('contenteditable'));
  modal(new Date(v.ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' version', h('div', { class: 'ver-prev-wrap' }, page), [{ label: 'Close' }, { label: 'Restore This Version', primary: true, fn: () => restoreVersion(id, v) }], { wide: true });
}
async function compareVersion(id, v) {
  const data = await Versions.get(id, v.ts); if (!data) return toast('This version is no longer available');
  $$('.modal-bg').forEach(m => m.remove());
  const res = Compare.run(data.html, cleanHTML(), prefs.author);
  await newDoc({ title: 'Changes since ' + new Date(v.ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' - ' + doc.title, html: res.html, settings: JSON.parse(JSON.stringify(doc.settings)) });
  showPane('changesPane', true);
  toast(`${res.stats.ins} insertions and ${res.stats.del} deletions since that version`, 5000);
}
async function restoreVersion(id, v) {
  const data = await Versions.get(id, v.ts); if (!data) return toast('This version is no longer available');
  if (!doc || doc.id !== id) return;
  await Versions.snap(record(), 'Before restoring', true);
  $$('.modal-bg').forEach(m => m.remove());
  const ro = ui.readonly; ui.readonly = false;
  mutate(() => {
    editor.innerHTML = data.html;
    doc.settings = Object.assign(DEFAULT_SETTINGS(), data.settings || {});
    doc.comments = data.comments || {};
  });
  ui.readonly = ro;
  applyDocStyles(); normalize(); afterChange(); paginate();
  toast('Restored the version from ' + new Date(v.ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '. Undo brings back what you had.', 6000);
}
