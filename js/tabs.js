/* DraftLy: several documents open at once. Each document runs in its own pane (this same page loaded with
   ?pane=<id>), so opening a second document never replaces the first. The main window holds the tabs and can
   show two documents side by side, as Word's View Side by Side does. */

/* ---------- inside a document pane ---------- */
if (IN_PANE) {
  window.DLPane = {
    get id() { return doc && doc.id; },
    persist: () => persist(true),
    // the document was deleted: close without saving it back
    drop() { clearTimeout(saveTimer); doc = null; },
    fit(on) {
      if (window.parent.innerWidth < 760) return;
      if (on) ui.fitWidth = true;
      else { ui.fitWidth = prefs.zoom === 'width'; if (typeof prefs.zoom === 'number') ui.zoom = prefs.zoom; }
      applyZoom();
    },
    syncStatus: s => Sync.mirror(s),
    focusEditor() { try { window.focus(); if (doc && $('#backstage').classList.contains('hidden') && !editor.contains(document.activeElement)) editor.focus({ preventScroll: true }); } catch (e) { } }
  };
  // Ctrl+Tab / Ctrl+Shift+Tab move between open documents
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); const H = hostApi(); if (H) H.next(e.shiftKey ? -1 : 1); }
  }, true);
}

/* ---------- main window: the tabs ---------- */
const DLTabs = HOST_SHELL ? (() => {
  const tabs = [];            // { id, frame, title }
  let slots = [];             // ids on screen: one, or two side by side
  let focus = 0;              // which slot has the keyboard
  let mru = [];               // most recently used first
  let ratio = 0.5, syncScroll = false;
  const last = {}, expect = {};

  const box = h('div', { id: 'tabHost', class: 'hidden' });
  const strip = h('div', { id: 'tabStrip', role: 'tablist' });
  const area = h('div', { id: 'paneArea' });
  const divider = h('div', { class: 'pane-div', title: 'Drag to resize' });
  area.append(divider);
  box.append(strip, area);
  document.body.append(box);

  const find = id => tabs.find(t => t.id === id);
  const win = id => { const t = find(id); try { return t && t.frame.contentWindow; } catch (e) { return null; } };
  const pane = id => { const w = win(id); return w && w.DLPane; };
  const canSplit = () => innerWidth >= 700;
  const touch = id => { mru = [id, ...mru.filter(x => x !== id)]; };

  function frameFor(id) {
    const src = location.pathname.replace(/[^/]*$/, '') + 'index.html?pane=' + encodeURIComponent(id);
    const fr = h('iframe', { class: 'pane-frame off', src, title: 'Document', allow: 'fullscreen; clipboard-read; clipboard-write; web-share' });
    fr.addEventListener('load', () => wire(id, fr));
    area.append(fr);
    return fr;
  }
  function wire(id, fr) {
    let w, d;
    try { w = fr.contentWindow; d = fr.contentDocument; } catch (e) { return; }
    if (!w || !d) return;
    const t = find(id);
    const take = () => { if (slots.includes(id)) { const i = slots.indexOf(id); if (i !== focus) { focus = i; touch(id); render(false, true); } } };
    w.addEventListener('pointerdown', take, true);
    w.addEventListener('focus', take, true);
    const setTitle = () => { const tt = (d.title || '').replace(/ · DraftLy$/, ''); if (t && tt && tt !== 'DraftLy' && t.title !== tt) { t.title = tt; render(true); } };
    const ttl = d.querySelector('title');
    if (ttl) new MutationObserver(setTitle).observe(ttl, { childList: true, characterData: true, subtree: true });
    setTitle();
    const c = d.getElementById('canvas');
    if (c) { last[id] = c.scrollTop; c.addEventListener('scroll', () => onScroll(id, c), { passive: true }); }
    if (w.DLPane) { w.DLPane.syncStatus(Sync.status); if (slots.length > 1) w.DLPane.fit(true); }
    if (slots[focus] === id) setTimeout(() => w.DLPane && w.DLPane.focusEditor(), 30);
  }
  function onScroll(id, c) {
    if (expect[id] !== undefined && Math.abs(c.scrollTop - expect[id]) < 2) { last[id] = c.scrollTop; delete expect[id]; return; }
    const delta = c.scrollTop - (last[id] || 0);
    last[id] = c.scrollTop;
    if (!syncScroll || slots.length < 2 || !slots.includes(id) || !delta) return;
    const other = slots.find(x => x !== id);
    const w = win(other); const oc = w && w.document.getElementById('canvas');
    if (!oc) return;
    const before = oc.scrollTop;
    oc.scrollTop = before + delta;
    if (oc.scrollTop !== before) { expect[other] = oc.scrollTop; last[other] = oc.scrollTop; }
  }

  function open(id) {
    $('#backstage').classList.add('hidden');
    ui.launch = false; document.body.classList.remove('launch');
    let t = find(id);
    if (!t) { t = { id, title: 'Document', frame: null }; tabs.push(t); t.frame = frameFor(id); Store.get(id).then(r => { if (r && r.title && t.title === 'Document') { t.title = r.title; render(true); } }); }
    show(id);
  }
  function show(id) {
    if (!find(id)) return;
    if (slots.includes(id)) focus = slots.indexOf(id);
    else if (!slots.length) { slots = [id]; focus = 0; }
    else slots[focus] = id;
    touch(id);
    render();
  }
  async function close(id, opts = {}) {
    const t = find(id);
    if (!t) return;
    const p = pane(id);
    if (p) { if (opts.drop) p.drop(); else { try { await p.persist(); } catch (e) { } } }
    t.frame.remove();
    tabs.splice(tabs.indexOf(t), 1);
    mru = mru.filter(x => x !== id);
    const at = slots.indexOf(id);
    if (at >= 0) {
      if (slots.length > 1) { slots.splice(at, 1); focus = 0; }
      else { const nxt = mru.find(x => find(x)); slots = nxt ? [nxt] : []; focus = 0; }
    }
    if (!tabs.length) { slots = []; box.classList.add('hidden'); document.title = 'DraftLy'; launchHome(); return; }
    if (slots.length === 1) { const pn = pane(slots[0]); if (pn) pn.fit(false); }
    render();
  }
  function toggleSplit(on = slots.length < 2) {
    if (on) {
      if (!canSplit()) return toast('Make the window wider to see two documents side by side.');
      const other = mru.find(x => x !== slots[0] && find(x)) || tabs.map(t => t.id).find(x => x !== slots[0]);
      if (!other) return toast('Open another document first, then show the two side by side.');
      slots = [slots[0], other]; focus = 0; ratio = 0.5;
    } else { slots = [slots[focus]]; focus = 0; }
    slots.forEach(id => { const p = pane(id); if (p) p.fit(slots.length > 1); });
    if (slots.length > 1) syncScroll = false;
    render();
  }
  function next(dir) {
    if (tabs.length < 2) return;
    const cur = slots[focus], i = tabs.findIndex(t => t.id === cur);
    show(tabs[(i + dir + tabs.length) % tabs.length].id);
  }
  function showHome() {
    box.classList.add('hidden');
    ui.launch = true; document.body.classList.add('launch');
    openBackstage('home');
  }
  function backToTabs() { if (!tabs.length) return; $('#backstage').classList.add('hidden'); render(); }

  function render(stripOnly, noFocus) {
    box.classList.remove('hidden');
    const sideBySide = slots.length > 1;
    box.classList.toggle('one', tabs.length < 2 && !sideBySide);
    // strip
    strip.innerHTML = '';
    tabs.forEach(t => {
      const at = slots.indexOf(t.id);
      const chip = h('div', { class: 'tab' + (at >= 0 ? ' shown' : '') + (at === focus ? ' on' : ''), role: 'tab', title: t.title },
        h('span', { class: 'ic', html: icon('FileText') }), h('span', { class: 'nm' }, t.title),
        h('button', { class: 'x', type: 'button', title: 'Close', html: icon('X'), onclick: ev => { ev.stopPropagation(); close(t.id); } }));
      chip.addEventListener('click', () => show(t.id));
      chip.addEventListener('auxclick', ev => { if (ev.button === 1) close(t.id); });
      strip.append(chip);
    });
    strip.append(h('button', { class: 'tb-btn', type: 'button', title: 'Open or start another document', html: icon('Plus'), onclick: showHome }));
    strip.append(h('span', { class: 'sp' }));
    if (sideBySide) strip.append(h('button', { class: 'tb-btn txt' + (syncScroll ? ' on' : ''), type: 'button', title: 'Scroll both documents together', onclick: () => { syncScroll = !syncScroll; slots.forEach(id => { const w = win(id); const c = w && w.document.getElementById('canvas'); if (c) last[id] = c.scrollTop; }); render(true); } }, h('span', { html: icon('MoveVertical') }), h('span', { class: 'l' }, 'Synchronous Scrolling')));
    if (tabs.length > 1 && canSplit()) strip.append(h('button', { class: 'tb-btn txt' + (sideBySide ? ' on' : ''), type: 'button', title: 'View Side by Side', onclick: () => toggleSplit() }, h('span', { html: icon('Columns2') }), h('span', { class: 'l' }, 'Side by Side')));
    const cur = find(slots[focus]);
    document.title = (cur ? cur.title + ' · ' : '') + 'DraftLy';
    if (stripOnly) return;
    // panes
    tabs.forEach(t => {
      const at = slots.indexOf(t.id);
      t.frame.classList.toggle('off', at < 0);
      t.frame.classList.toggle('focus', sideBySide && at === focus);
      if (at < 0) { t.frame.style.left = '0'; t.frame.style.width = '100%'; }
      else if (!sideBySide) { t.frame.style.left = '0'; t.frame.style.width = '100%'; }
      else if (at === 0) { t.frame.style.left = '0'; t.frame.style.width = `calc(${ratio * 100}% - 3px)`; }
      else { t.frame.style.left = `calc(${ratio * 100}% + 3px)`; t.frame.style.width = `calc(${(1 - ratio) * 100}% - 3px)`; }
    });
    divider.classList.toggle('hidden', !sideBySide);
    divider.style.left = `calc(${ratio * 100}% - 3px)`;
    if (noFocus) return;
    const p = pane(slots[focus]);
    if (p) setTimeout(() => p.focusEditor(), 0);
  }

  // drag the divider between two documents
  divider.addEventListener('pointerdown', e => {
    e.preventDefault();
    divider.setPointerCapture(e.pointerId);
    area.classList.add('dragging');
    const r = area.getBoundingClientRect();
    const mv = ev => { ratio = Math.min(0.8, Math.max(0.2, (ev.clientX - r.left) / r.width)); render(); };
    const up = () => { area.classList.remove('dragging'); divider.removeEventListener('pointermove', mv); divider.removeEventListener('pointerup', up); divider.removeEventListener('pointercancel', up); };
    divider.addEventListener('pointermove', mv); divider.addEventListener('pointerup', up); divider.addEventListener('pointercancel', up);
  });
  divider.addEventListener('dblclick', () => { ratio = 0.5; render(); });
  window.addEventListener('resize', () => { if (slots.length > 1 && !canSplit()) toggleSplit(false); else if (tabs.length) render(true); });
  Sync.on((type, data) => { if (type === 'status') tabs.forEach(t => { const p = pane(t.id); if (p) p.syncStatus(data); }); });
  window.addEventListener('pagehide', () => tabs.forEach(t => { const p = pane(t.id); if (p) p.persist(); }));

  return {
    open, close, show, next, showHome, backToTabs, toggleSplit,
    closeDeleted: id => close(id, { drop: true }),
    has: id => !!find(id), win, count: () => tabs.length,
    get slots() { return slots.slice(); }, get ids() { return tabs.map(t => t.id); },
    syncReload: () => Sync.reload()
  };
})() : null;
if (DLTabs) window.DLHost = DLTabs;
