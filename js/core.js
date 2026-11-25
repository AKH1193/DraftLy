/* DraftLy core: state, helpers, storage, history, page layout */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const editor = $('#editor');
const IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform) || /Macintosh/.test(navigator.userAgent);
const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/* Each open document runs in its own pane (an iframe of this same page, ?pane=<id>). The top window is the
   shell that holds the tabs; ?single keeps the old one-document window (used by tests). */
const PANE_ID = (() => { try { return window.parent !== window && window.parent.location.origin === location.origin ? new URLSearchParams(location.search).get('pane') : null; } catch (e) { return null; } })();
const IN_PANE = !!PANE_ID;
const HOST_SHELL = !IN_PANE && !/[?&]single\b/.test(location.search);
const hostApi = () => { try { return IN_PANE ? window.parent.DLHost : window.DLHost; } catch (e) { return null; } };
if (IN_PANE && window.parent.Capacitor) try { window.Capacitor = window.parent.Capacitor; } catch (e) { } // the native bridge lives in the main window
const IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const icon = n => ICONS[n] || '';
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
let toastTimer;
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

/* ---------- preferences ---------- */
const PREFS_KEY = 'draftly.prefs';
const prefs = Object.assign({ author: 'Anirudh K H', styleSet: 'Default', dark: false, autosave: true, lastDoc: null, lang: 'en-IN' }, JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'));
const savePrefs = () => localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
// several documents can be open at once (one pane each); keep everyone's settings in step
window.addEventListener('storage', e => {
  if (e.key !== PREFS_KEY || !e.newValue) return;
  let n; try { n = JSON.parse(e.newValue); } catch (err) { return; }
  const was = { dark: prefs.dark, theme: prefs.theme };
  Object.assign(prefs, n);
  if (was.dark !== prefs.dark) document.body.classList.toggle('dark', !!prefs.dark);
  if (was.theme !== prefs.theme && typeof applyTheme === 'function') applyTheme(prefs.theme || 'ocean');
});

/* ---------- interface themes ---------- */
const THEMES = {
  ocean:    { name: 'Ocean',          tb: 'linear-gradient(120deg,#1B4F78,#2470A6)', side: '#1B4F78', accent: '#1F5F8B', accent2: '#2E7DB5', soft: '#E3EEF7', canvas: '#E9ECF0', ribbon: '#F7F9FB' },
  burgundy: { name: 'Burgundy',       tb: 'linear-gradient(120deg,#5A1424,#8A2438)', side: '#5A1424', accent: '#7A1F33', accent2: '#A3263F', soft: '#F6E6EA', canvas: '#ECE7E8', ribbon: '#FBF8F8' },
  emerald:  { name: 'Emerald',        tb: 'linear-gradient(120deg,#0C4A3E,#137A62)', side: '#0C4A3E', accent: '#0F5E4E', accent2: '#12866A', soft: '#E1F2EC', canvas: '#E6ECE9', ribbon: '#F7FAF9' },
  royal:    { name: 'Royal Purple',   tb: 'linear-gradient(120deg,#2E1F66,#5236A8)', side: '#2E1F66', accent: '#3E2A88', accent2: '#6A4BD1', soft: '#ECE7FA', canvas: '#E9E7EF', ribbon: '#F9F8FC' },
  ink:      { name: 'Ink & Gold',     tb: 'linear-gradient(120deg,#0E1116,#232A35)', side: '#11151B', accent: '#1C222C', accent2: '#B8901F', soft: '#F6EFD9', canvas: '#E7E6E3', ribbon: '#FAF9F6', tbText: '#F3D77A' },
  graphite: { name: 'Graphite',       tb: 'linear-gradient(120deg,#2B2E35,#454A55)', side: '#2B2E35', accent: '#3A3E47', accent2: '#E07A2E', soft: '#FBEADF', canvas: '#E8E8EA', ribbon: '#F8F8F9' },
  saffron:  { name: 'Saffron',        tb: 'linear-gradient(120deg,#9A3F05,#D46B08)', side: '#9A3F05', accent: '#B4530A', accent2: '#C9620A', soft: '#FCEBDA', canvas: '#EEE9E3', ribbon: '#FCFAF7' },
  teal:     { name: 'Teal',           tb: 'linear-gradient(120deg,#0B5563,#138A9E)', side: '#0B5563', accent: '#0E6A7A', accent2: '#0F8EA3', soft: '#DFF2F5', canvas: '#E5ECED', ribbon: '#F7FAFB' },
  rose:     { name: 'Rose',           tb: 'linear-gradient(120deg,#7D1F4E,#B33A74)', side: '#7D1F4E', accent: '#962A5E', accent2: '#C2417A', soft: '#F8E4EE', canvas: '#EEE8EB', ribbon: '#FCF9FA' },
  forest:   { name: 'Forest',         tb: 'linear-gradient(120deg,#25402A,#3F6B45)', side: '#25402A', accent: '#2F5535', accent2: '#4C8A55', soft: '#E6F0E7', canvas: '#E8EBE6', ribbon: '#F9FAF8' },
  slate:    { name: 'Slate',          tb: 'linear-gradient(120deg,#334155,#52637A)', side: '#334155', accent: '#3E4F66', accent2: '#4F7CC4', soft: '#E6EDF8', canvas: '#E8EAEE', ribbon: '#F8F9FB' },
  liquid:   { name: 'Liquid Glass',    glass: 'liquid', tb: 'linear-gradient(135deg,rgba(255,255,255,.75),rgba(225,235,255,.55))', side: 'rgba(255,255,255,.55)', accent: '#0A64D8', accent2: '#0A84FF', soft: 'rgba(10,132,255,.14)', canvas: 'radial-gradient(60% 70% at 15% 20%,#BFD9FF 0%,transparent 60%),radial-gradient(55% 60% at 85% 25%,#E6CCFF 0%,transparent 60%),radial-gradient(60% 60% at 60% 90%,#FFD9C7 0%,transparent 60%),#EEF1F8', ribbon: 'rgba(255,255,255,.5)', tbText: '#1D1D1F', tbHover: 'rgba(0,0,0,.07)', light: true, meta: '#E9EEF8' },
  midnight: { name: 'Midnight Glass',  glass: 'midnight', tb: 'linear-gradient(135deg,rgba(40,46,78,.85),rgba(22,26,46,.75))', side: 'rgba(22,26,46,.6)', accent: '#6E8BFF', accent2: '#8FA6FF', soft: 'rgba(143,166,255,.18)', canvas: 'radial-gradient(55% 60% at 15% 15%,#3B2A7A 0%,transparent 60%),radial-gradient(50% 55% at 90% 30%,#0E5C6B 0%,transparent 60%),radial-gradient(60% 60% at 50% 100%,#5A1E5C 0%,transparent 60%),#0B0F1E', ribbon: 'rgba(28,32,56,.5)', tbText: '#EEF1FF', tbHover: 'rgba(255,255,255,.12)', meta: '#141a30' },
  rosegold: { name: 'Rose Gold Glass', glass: 'rosegold', tb: 'linear-gradient(135deg,rgba(255,244,238,.78),rgba(250,226,214,.6))', side: 'rgba(255,240,232,.6)', accent: '#A8573F', accent2: '#C2765A', soft: 'rgba(194,118,90,.15)', canvas: 'radial-gradient(60% 70% at 12% 18%,#FFD3C2 0%,transparent 60%),radial-gradient(55% 60% at 88% 22%,#F6E2B3 0%,transparent 60%),radial-gradient(60% 60% at 55% 95%,#F2C4D0 0%,transparent 60%),#F7EEE9', ribbon: 'rgba(255,248,244,.5)', tbText: '#3A2620', tbHover: 'rgba(80,30,10,.08)', light: true, meta: '#F6E6DE' },
  paper:    { name: 'Paper (light)',  tb: '#F4F1EA', side: '#EAE5DA', accent: '#2F6F5E', accent2: '#2F6F5E', soft: '#E2EFEA', canvas: '#E9E5DC', ribbon: '#FBFAF6', tbText: '#2A2A2A', tbHover: 'rgba(0,0,0,.07)', light: true }
};
function applyTheme(name) {
  const t = THEMES[name] || THEMES.ocean;
  const dark = document.body.classList.contains('dark');
  const r = document.documentElement.style;
  const tb = dark && t.light ? '#2B2B2B' : t.tb;
  r.setProperty('--tb-bg', tb);
  r.setProperty('--side-bg', dark && t.light ? '#262626' : t.side);
  r.setProperty('--tb-text', dark && t.light ? '#EDEDED' : (t.tbText || '#FFFFFF'));
  r.setProperty('--tb-hover', dark && t.light ? 'rgba(255,255,255,.12)' : (t.tbHover || 'rgba(255,255,255,.16)'));
  r.setProperty('--accent', t.accent);
  r.setProperty('--accent-2', t.accent2);
  r.setProperty('--accent-soft', t.soft);
  r.setProperty('--canvas', t.canvas);
  r.setProperty('--ribbon', t.ribbon);
  const b = document.body;
  b.classList.toggle('glass', !!t.glass);
  b.dataset.glass = t.glass ? (dark ? 'midnight' : t.glass) : '';
  if (t.glass && dark && t.glass !== 'midnight') { const m = THEMES.midnight; ['tb-bg', 'side-bg', 'tb-text', 'tb-hover', 'canvas', 'ribbon'].forEach((k, i) => r.setProperty('--' + k, [m.tb, m.side, m.tbText, m.tbHover, m.canvas, m.ribbon][i])); }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t.meta && !(dark && t.light) ? t.meta : dark && t.light ? '#2B2B2B' : (t.tb.match(/#[0-9A-Fa-f]{6}/) || ['#1F5F8B'])[0]);
}
function setTheme(name) { prefs.theme = name; savePrefs(); applyTheme(name); if (typeof updateRibbonState === 'function') updateRibbonState(); }

/* ---------- page geometry ---------- */
const PAGE_PX = { A4: [793.7, 1122.5], Letter: [816, 1056], Legal: [816, 1344], A5: [559.4, 793.7], Executive: [696, 1008] };
const GAP = 22;
const STYLE_SETS = {
  Default: { font: 'Aptos', size: 11, lineHeight: 1.15, after: 8, headingFont: 'Aptos Display', headingColor: '#0F4761', justify: false },
  Legal: { font: 'Times New Roman', size: 12, lineHeight: 1.5, after: 6, headingFont: 'Times New Roman', headingColor: '#000000', justify: true, headingBold: true, h1: 28, h2: 26, h3: 24 },
  Classic: { font: 'Georgia', size: 12, lineHeight: 1.2, after: 10, headingFont: 'Georgia', headingColor: '#1F3864', justify: false },
  Modern: { font: 'Helvetica Neue', size: 11, lineHeight: 1.35, after: 8, headingFont: 'Helvetica Neue', headingColor: '#2E74B5', justify: false },
  Compact: { font: 'Arial', size: 10, lineHeight: 1.0, after: 4, headingFont: 'Arial', headingColor: '#1F3864', justify: false, headingBold: true }
};
const FONT_STACKS = {
  'Aptos': "Aptos, 'Segoe UI', Calibri, Carlito, 'Helvetica Neue', Arial, sans-serif",
  'Aptos Display': "'Aptos Display', Aptos, 'Segoe UI', Calibri, Carlito, 'Helvetica Neue', Arial, sans-serif",
  'Calibri': "Calibri, Carlito, 'Helvetica Neue', Arial, sans-serif",
  'Calibri Light': "'Calibri Light', Calibri, Carlito, 'Helvetica Neue', Arial, sans-serif",
  'Cambria': "Cambria, Caladea, Georgia, serif",
  'Times New Roman': "'Times New Roman', Times, 'Liberation Serif', 'Nimbus Roman', serif",
  'Arial': "Arial, 'Liberation Sans', Helvetica, sans-serif",
  'Courier New': "'Courier New', Courier, 'Liberation Mono', monospace"
};
const fontStack = f => FONT_STACKS[f] || `'${String(f).replace(/'/g, '')}', ${/mono|courier|menlo|consol/i.test(f) ? 'monospace' : /times|georgia|garamond|cambria|book|palatino|baskerville|didot|serif|antiqua|century/i.test(f) && !/sans/i.test(f) ? 'serif' : 'sans-serif'}`;

/* ---------- document state ---------- */
const DEFAULT_SETTINGS = () => { const d = prefs.defaultPage || {}; return { pageSize: d.pageSize || 'A4', pageW: d.pageW, pageH: d.pageH, orientation: d.orientation || 'portrait', margins: Object.assign({ top: 1, bottom: 1, left: 1, right: 1 }, d.margins || {}), header: '', footer: '', firstHeader: '', firstFooter: '', differentFirst: false, watermark: '', pageColor: '', theme: Object.assign({}, STYLE_SETS[prefs.styleSet] || STYLE_SETS.Default) }; };
let doc = null;          // { id, title, settings, comments, created, modified, syncedAt }
const ui = { zoom: 1, view: 'print', markup: 'all', showComments: true, printing: false, pages: 1, readonly: false, ruler: false, fitWidth: false };

function geom() {
  const s = doc.settings;
  let [pw, ph] = s.pageSize === 'Custom' && s.pageW && s.pageH ? [s.pageW * 96, s.pageH * 96] : PAGE_PX[s.pageSize] || PAGE_PX.A4;
  if (s.orientation === 'landscape') [pw, ph] = [ph, pw];
  const m = s.margins;
  const ml = m.left * 96, mr = m.right * 96, cw = pw - ml - mr;
  // like Word: a header or footer taller than the margin pushes the text down (or up) instead of being cut off
  const top = m.top * 96, bot = m.bottom * 96, hTop = hfOffset(top), fBot = hfOffset(bot);
  const needT = html => html && html.trim() ? Math.max(top, hTop + measureHF(html, cw) + 6) : top;
  const needB = html => html && html.trim() ? Math.max(bot, fBot + measureHF(html, cw) + 6) : bot;
  const mt = needT(s.header), mb = needB(s.footer);
  const mt1 = s.differentFirst ? needT(s.firstHeader) : mt, mb1 = s.differentFirst ? needB(s.firstFooter) : mb;
  return { pw, ph, mt, mb, mt1, mb1, ml, mr, cw, ch: ph - mt - mb };
}
const hfOffset = margin => Math.min(48, margin * 0.5);
const _hfMeasure = new Map();
function measureHF(html, cw) {
  const t = (doc && doc.settings.theme) || {};
  const key = Math.round(cw) + '|' + t.font + '|' + t.size + '|' + t.lineHeight + '|' + html;
  if (_hfMeasure.has(key)) return _hfMeasure.get(key);
  let box = document.getElementById('hfMeasure');
  if (!box) { box = h('div', { id: 'hfMeasure', class: 'sheet', style: { position: 'absolute', left: '-10000px', top: '0', visibility: 'hidden', height: 'auto' } }, h('div', { class: 'hf' })); document.body.append(box); }
  const hf = box.firstChild;
  hf.style.cssText = `position:static;width:${cw}px;max-height:none;overflow:visible`;
  hf.innerHTML = hfRender(html, 1, 1);
  const v = hf.scrollHeight;
  const pending = [...hf.querySelectorAll('img')].filter(i => !i.complete);
  if (pending.length) pending.forEach(i => i.addEventListener('load', () => { _hfMeasure.delete(key); if (typeof schedulePaginate === 'function') schedulePaginate(); }, { once: true }));
  else { if (_hfMeasure.size > 40) _hfMeasure.clear(); if (v > 0) _hfMeasure.set(key, v); }
  return v;
}

/* ---------- storage (IndexedDB) ---------- */
const Store = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('draftly', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('docs', { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('docs', mode); const st = t.objectStore('docs'); const out = fn(st); t.oncomplete = () => res(out instanceof IDBRequest ? out.result : out); t.onerror = () => rej(t.error); }); };
  return {
    async get(id) { try { return await tx('readonly', s => s.get(id)); } catch (e) { return null; } },
    async put(d) { try { await tx('readwrite', s => s.put(d)); } catch (e) { console.warn('save failed', e); } },
    async del(id) { try { await tx('readwrite', s => s.delete(id)); } catch (e) { } },
    async all() { try { const r = await tx('readonly', s => s.getAll()); return (r || []).sort((a, b) => (b.modified || 0) - (a.modified || 0)); } catch (e) { return []; } }
  };
})();

/* ---------- serialization ---------- */
function cleanHTML(root = editor) {
  const c = root.cloneNode(true);
  c.querySelectorAll('tr.pg-sp').forEach(r => r.remove());
  [...c.querySelectorAll('[data-cont]')].reverse().forEach(t => { const prev = t.previousElementSibling; if (prev && prev.tagName === t.tagName && c.querySelector(`[data-sid="${t.getAttribute('data-cont')}"]`)) { [...t.childNodes].forEach(k => prev.appendChild(k)); t.remove(); prev.normalize(); } else t.removeAttribute('data-cont'); });
  c.querySelectorAll('[data-sid]').forEach(e => { e.removeAttribute('data-sid'); e.removeAttribute('data-split'); });
  c.querySelectorAll('[data-pg]').forEach(el => { el.removeAttribute('data-pg'); el.removeAttribute('data-pgb'); el.style.removeProperty('--pg'); if (!el.getAttribute('style')) el.removeAttribute('style'); });
  c.querySelectorAll('img.sel').forEach(el => { el.classList.remove('sel'); if (!el.className) el.removeAttribute('class'); });
  c.querySelectorAll('.cmt.active').forEach(el => el.classList.remove('active'));
  c.querySelectorAll('[data-olv],[data-oli]').forEach(el => { el.removeAttribute('data-olv'); el.removeAttribute('data-oli'); el.classList.remove('olhide'); if (!el.className) el.removeAttribute('class'); });
  c.querySelectorAll('span.mf').forEach(s => { s.textContent = '«' + s.getAttribute('data-f') + '»'; s.classList.remove('pv'); });
  c.querySelectorAll('td.csel,th.csel').forEach(el => { el.classList.remove('csel'); if (!el.className) el.removeAttribute('class'); });
  return c.innerHTML.replace(/​/g, '');
}

/* ---------- selection save/restore ---------- */
let lastRange = null;
function nodePath(node, root = editor) {
  const p = [];
  while (node && node !== root) { const par = node.parentNode; if (!par) return null; p.unshift([...par.childNodes].indexOf(node)); node = par; }
  return node === root ? p : null;
}
function fromPath(path, root = editor) {
  let n = root;
  for (const i of path || []) { if (!n.childNodes[i]) return null; n = n.childNodes[i]; }
  return n;
}
function saveSel() {
  const s = getSelection(); if (!s.rangeCount) return null;
  const r = s.getRangeAt(0);
  if (!editor.contains(r.commonAncestorContainer)) return null;
  return { sp: nodePath(r.startContainer), so: r.startOffset, ep: nodePath(r.endContainer), eo: r.endOffset };
}
function restoreSel(x) {
  if (!x) return;
  try {
    const sn = fromPath(x.sp), en = fromPath(x.ep);
    if (!sn || !en) return;
    const r = document.createRange();
    r.setStart(sn, Math.min(x.so, sn.nodeType === 3 ? sn.length : sn.childNodes.length));
    r.setEnd(en, Math.min(x.eo, en.nodeType === 3 ? en.length : en.childNodes.length));
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    lastRange = r.cloneRange();
  } catch (e) { }
}
function getRange() {
  const s = getSelection();
  if (s.rangeCount && editor.contains(s.getRangeAt(0).commonAncestorContainer)) return s.getRangeAt(0);
  return lastRange && editor.contains(lastRange.commonAncestorContainer) ? lastRange : null;
}
function restoreRange() {
  if (ui.readonly) return false;
  const s = getSelection();
  if (s.rangeCount && editor.contains(s.getRangeAt(0).commonAncestorContainer) && document.activeElement === editor) return true;
  editor.focus({ preventScroll: true });
  if (lastRange && editor.contains(lastRange.commonAncestorContainer)) { s.removeAllRanges(); s.addRange(lastRange); return true; }
  return s.rangeCount > 0;
}
const BLOCK_SEL = 'p,h1,h2,h3,h4,h5,h6,li,pre,blockquote,td,th,div:not(.toc):not(.cols)';
function closestBlock(n) {
  while (n && n !== editor) { if (n.nodeType === 1 && n.matches(BLOCK_SEL)) return n; n = n.parentNode; }
  return null;
}
function selectedBlocks() {
  const r = getRange(); if (!r) return [];
  const set = new Set();
  const add = n => { const b = closestBlock(n); if (b) set.add(b); };
  add(r.startContainer.nodeType === 3 ? r.startContainer : (r.startContainer.childNodes[r.startOffset] || r.startContainer));
  if (!r.collapsed) {
    const root = r.commonAncestorContainer.nodeType === 3 ? r.commonAncestorContainer.parentNode : r.commonAncestorContainer;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: n => (n.nodeType === 3 || n.tagName === 'BR' || n.tagName === 'IMG') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP });
    let n; while ((n = w.nextNode())) if (r.intersectsNode(n)) add(n);
    add(r.endContainer.nodeType === 3 ? r.endContainer : (r.endContainer.childNodes[Math.max(0, r.endOffset - 1)] || r.endContainer));
  }
  // prefer innermost blocks (drop containers that hold other selected blocks)
  const arr = [...set];
  return arr.filter(b => !arr.some(o => o !== b && b.contains(o)));
}

/* ---------- history (undo/redo) ---------- */
const History = (() => {
  let stack = [], pos = -1, timer = null;
  const snap = () => ({ html: cleanHTML(), sel: saveSel(), settings: JSON.stringify(doc.settings), comments: JSON.stringify(doc.comments) });
  return {
    reset() { stack = [snap()]; pos = 0; },
    record() {
      clearTimeout(timer); timer = null;
      const s = snap(); const cur = stack[pos];
      if (cur && cur.html === s.html && cur.settings === s.settings && cur.comments === s.comments) { cur.sel = s.sel; return; }
      stack = stack.slice(0, pos + 1); stack.push(s);
      if (stack.length > 300) stack.shift();
      pos = stack.length - 1;
    },
    soon() { clearTimeout(timer); timer = setTimeout(() => this.record(), 350); },
    flush() { if (timer) this.record(); },
    undo() { this.flush(); if (pos <= 0) return; pos--; this.apply(stack[pos]); },
    redo() { if (pos >= stack.length - 1) return; pos++; this.apply(stack[pos]); },
    apply(s) {
      editor.innerHTML = s.html;
      const prev = doc.settings.theme;
      doc.settings = JSON.parse(s.settings); doc.comments = JSON.parse(s.comments);
      if (JSON.stringify(prev) !== JSON.stringify(doc.settings.theme)) applyDocStyles();
      restoreSel(s.sel);
      afterChange({ noHistory: true });
    },
    canUndo: () => pos > 0, canRedo: () => pos < stack.length - 1
  };
})();

/* ---------- document CSS from theme ---------- */
function applyDocStyles() {
  const t = Object.assign({}, STYLE_SETS.Default, doc.settings.theme || {});
  const F = fontStack(t.font), HF = fontStack(t.headingFont || t.font);
  const hb = t.headingBold ? 'bold' : 'normal';
  const hs = k => (t[k] ? t[k] / 2 : { h1: 20, h2: 16, h3: 14 }[k]) + 'pt';
  const css = `
#editor, #footnoteArea, .sheet .hf, .hf-editor { font-family: ${F}; font-size: ${t.size}pt; line-height: ${t.lineHeight}; }
#editor p, #editor pre, #editor blockquote, #editor div:not(.toc):not(.cols) > p { margin: 0 0 ${t.after}pt; }
${t.justify ? '#editor p:not([class]), #editor li { text-align: justify; }' : ''}
#editor h1, #editor h2, #editor h3, #editor h4, #editor h5, #editor h6 { font-family: ${HF}; color: ${t.headingColor}; font-weight: ${hb}; line-height: 1.15; }
#editor h1 { font-size: ${hs('h1')}; margin: 18pt 0 4pt; } #editor h2 { font-size: ${hs('h2')}; margin: 8pt 0 4pt; }
#editor h3 { font-size: ${hs('h3')}; margin: 8pt 0 4pt; } #editor h4 { font-size: ${t.size}pt; font-style: italic; margin: 4pt 0 2pt; }
#editor h5 { font-size: ${t.size}pt; margin: 4pt 0 2pt; } #editor h6 { font-size: ${t.size}pt; font-style: italic; margin: 4pt 0 2pt; }
#editor > :first-child { margin-top: 0; }
#editor .s-Title { font-family: ${HF}; font-size: 28pt; line-height: 1.1; letter-spacing: -0.5px; margin: 0 0 4pt; text-align: left; }
#editor .s-Subtitle { font-size: 14pt; color: #595959; letter-spacing: .5px; margin: 0 0 ${t.after}pt; text-align: left; }
#editor .s-Quote { font-style: italic; text-align: center; color: #404040; margin: 8pt 0.6in ${t.after}pt; }
#editor .s-IntenseQuote { font-style: italic; text-align: center; color: ${t.headingColor}; border-top: 1px solid ${t.headingColor}; border-bottom: 1px solid ${t.headingColor}; padding: 10pt 0; margin: 18pt 0.6in; }
#editor .s-NoSpacing { margin: 0; line-height: 1; }
#editor td > p, #editor th > p, #editor li > p { margin: 0; }
#editor blockquote { margin-left: 0.5in; }
#editor .toc .toc-title { font-family: ${HF}; }
:root { --h-color: ${t.headingColor}; --doc-after: ${t.after}pt; }`;
  $('#docStyles').textContent = css + css.replace(/#editor/g, '.splitdoc');
}

/* ---------- page layout & pagination ---------- */
/* ---------- paragraphs that run across a page break (like Word: lines flow onto the next page) ---------- */
let _splitId = 0;
function selTextSave() {
  const s = getSelection(); if (!s.rangeCount) return null;
  const r = s.getRangeAt(0); if (!editor.contains(r.startContainer)) return null;
  const off = (node, o) => { const pre = document.createRange(); pre.setStart(editor, 0); try { pre.setEnd(node, o); } catch (e) { return 0; } return pre.toString().length; };
  return { s: off(r.startContainer, r.startOffset), e: off(r.endContainer, r.endOffset) };
}
function selTextRestore(x) {
  if (!x) return;
  const find = n => { const w = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT); let t, c = 0, last = null; while ((t = w.nextNode())) { if (c + t.length >= n) return [t, n - c]; c += t.length; last = t; } return last ? [last, last.length] : [editor, 0]; };
  try { const [a, ao] = find(x.s), [b, bo] = find(x.e); const r = document.createRange(); r.setStart(a, ao); r.setEnd(b, bo); const s = getSelection(); s.removeAllRanges(); s.addRange(r); lastRange = r.cloneRange(); } catch (e) { }
}
function unsplitAll() {
  const tails = editor.querySelectorAll('[data-cont]');
  if (tails.length) {
    [...tails].reverse().forEach(t => {
      const head = editor.querySelector(`[data-sid="${t.getAttribute('data-cont')}"]`);
      const prev = t.previousElementSibling;
      // normally the tail goes back into its head; if Enter added a paragraph in between, it joins that one
      const into = prev && prev.tagName === t.tagName && head ? prev : null;
      if (into) {
        if (into.lastChild && into.lastChild.nodeName === 'BR' && !into.lastChild.previousSibling) into.lastChild.remove();
        const kids = [...t.childNodes]; if (kids.length === 1 && kids[0].nodeName === 'BR' && into.childNodes.length) kids.length = 0;
        kids.forEach(k => into.appendChild(k)); t.remove(); into.normalize();
      } else t.removeAttribute('data-cont');
    });
  }
  editor.querySelectorAll('[data-sid]').forEach(e => { e.removeAttribute('data-sid'); e.removeAttribute('data-split'); });
}
function splitAtPage(el, cut) {
  if (!/^(P|LI|BLOCKQUOTE)$/.test(el.tagName) || el.querySelector('ul,ol,table,img,div,hr,br + br')) return null;
  const z = ui.printing ? 1 : (ui.view === 'print' ? ui.zoom : 1);
  const er = editor.getBoundingClientRect(), yC = er.top + cut * z;
  const texts = []; { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let t; while ((t = w.nextNode())) if (t.length) texts.push(t); }
  if (!texts.length) return null;
  const rg = document.createRange(), lines = [];
  for (const t of texts) { rg.selectNodeContents(t); for (const r of rg.getClientRects()) { if (!r.height || !r.width) continue; const L = lines.find(l => Math.abs(l.top - r.top) < 3 * z); if (L) L.bottom = Math.max(L.bottom, r.bottom); else lines.push({ top: r.top, bottom: r.bottom }); } }
  lines.sort((a, b) => a.top - b.top);
  let fit = lines.filter(l => l.bottom <= yC + 0.5).length;
  // widow and orphan control, as in Word: never leave a single line alone at the bottom or top of a page
  if (lines.length - fit < 2) fit = lines.length - 2;
  if (fit < 2 || fit >= lines.length) return null;
  const lineTop = lines[fit].top;
  // first character that sits on the first line that does not fit
  const idx = []; let total = 0; texts.forEach(t => { idx.push(total); total += t.length; });
  const at = g => { let k = idx.length - 1; while (k > 0 && idx[k] > g) k--; return [texts[k], g - idx[k]]; };
  const topOf = g => { for (let j = g; j < Math.min(total, g + 4); j++) { const [n, o] = at(j); rg.setStart(n, o); rg.setEnd(n, o + 1); const r = rg.getBoundingClientRect(); if (r.height) return r.top; } return -1e9; };
  let lo = 0, hi = total - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (topOf(mid) >= lineTop - 2 * z) hi = mid; else lo = mid + 1; }
  if (lo <= 0) return null;
  const [node, off] = at(lo);
  const range = document.createRange(); range.setStart(node, off); range.setEnd(el, el.childNodes.length);
  const frag = range.extractContents();
  const tail = el.cloneNode(false);
  tail.removeAttribute('id'); tail.removeAttribute('data-pg'); tail.style.removeProperty('--pg'); if (!tail.getAttribute('style')) tail.removeAttribute('style');
  const id = String(++_splitId);
  el.setAttribute('data-sid', id); el.setAttribute('data-split', getComputedStyle(el).textAlign === 'justify' ? 'j' : '1');
  tail.setAttribute('data-cont', id);
  tail.appendChild(frag); el.after(tail);
  return tail;
}
function topIn(el) { let y = 0; while (el && el !== editor) { y += el.offsetTop; el = el.offsetParent; } return y; }
function clearPushes() {
  editor.querySelectorAll('tr.pg-sp').forEach(r => r.remove());
  editor.querySelectorAll('[data-pg]').forEach(el => { el.removeAttribute('data-pg'); el.removeAttribute('data-pgb'); el.style.removeProperty('--pg'); if (!el.getAttribute('style')) el.removeAttribute('style'); });
}
function collectUnits() {
  const out = [];
  for (const el of editor.children) {
    if (el.tagName === 'UL' || el.tagName === 'OL') { for (const li of el.children) out.push({ el: li }); }
    else if (el.tagName === 'TABLE') { for (const tr of el.rows) if (tr.closest('table') === el) out.push({ el: tr, tr: true }); }
    else out.push({ el });
  }
  return out;
}
function paginate() {
  if (!doc) return;
  const g = geom();
  const print = ui.view === 'print' || ui.printing;
  const selKeep = editor.querySelector('[data-cont]') ? selTextSave() : null;
  clearPushes();
  unsplitAll();
  if (!print) { renderSheets(1, g, 0); layoutFootnotes(g, false); if (selKeep) selTextRestore(selKeep); return; }
  let splitSel = selKeep, didSplit = false;
  const gap = ui.printing ? 0 : GAP, stride = g.ph + gap;
  const MT = p => p === 0 ? g.mt1 : g.mt, MB = p => p === 0 ? g.mb1 : g.mb;
  let breakPage = null, bottom = g.mt1;
  const units = collectUnits();
  for (let ux = 0; ux < units.length; ux++) {
    const u = units[ux], el = u.el;
    if (el.tagName === 'HR' && el.classList.contains('pb')) { breakPage = Math.floor(topIn(el) / stride); bottom = Math.max(bottom, topIn(el) + el.offsetHeight); continue; }
    const top = topIn(el), hgt = el.offsetHeight;
    const p = Math.max(0, Math.floor(top / stride));
    const cTop = p * stride + MT(p), cBot = p * stride + g.ph - MB(p);
    let target = null;
    if (breakPage !== null) { const tp = (breakPage + 1) * stride + MT(breakPage + 1); if (top < tp - 0.5) target = tp; breakPage = null; }
    else if (top >= cBot - 0.5) target = (p + 1) * stride + MT(p + 1);
    else if (top < cTop - 0.5) target = cTop;
    else if (top + hgt > cBot + 0.5) {
      // a long paragraph flows on to the next page instead of jumping there whole
      if (!u.tr) {
        if (!didSplit && !splitSel) splitSel = selTextSave();
        const tail = splitAtPage(el, cBot);
        if (tail) { didSplit = true; units.splice(ux + 1, 0, { el: tail }); bottom = Math.max(bottom, topIn(el) + el.offsetHeight); continue; }
      }
      if (hgt <= g.ch) target = (p + 1) * stride + MT(p + 1);
    }
    if (target !== null && target > top) {
      if (u.tr) {
        // move the whole row: insert an invisible spacer row so the table breaks cleanly between pages
        const cols = [...el.cells].reduce((a, c) => a + (c.colSpan || 1), 0) || 1;
        const sp = document.createElement('tr');
        sp.className = 'pg-sp'; sp.setAttribute('contenteditable', 'false');
        const td = document.createElement('td'); td.colSpan = cols;
        td.style.cssText = `height:${target - top}px;padding:0;border-left-style:hidden;border-right-style:hidden;border-top-style:none;border-bottom-style:none;background:transparent`;
        sp.appendChild(td); el.parentNode.insertBefore(sp, el);
        const diff = target - topIn(el);
        if (Math.abs(diff) > 0.5) td.style.height = Math.max(0, target - top + diff) + 'px';
      } else {
        el.setAttribute('data-pg', '');
        el.style.setProperty('--pg', (target - top) + 'px');
      }
    }
    bottom = Math.max(bottom, topIn(el) + el.offsetHeight);
  }
  if (ui.printing && !ui.raster) {
    // printing: turn each push into a real page break so printed pages match the screen exactly
    editor.querySelectorAll('tr.pg-sp').forEach(sp => { sp.setAttribute('data-pgb', ''); sp.firstChild.style.height = g.mt + 'px'; });
    editor.querySelectorAll('[data-pg]').forEach(el => {
      el.setAttribute('data-pgb', '');
      const m = el.tagName === 'TR' ? 0 : parseFloat(getComputedStyle(el).marginTop) || 0;
      el.style.setProperty('--pg', Math.max(0, g.mt - m) + 'px');
    });
  }
  if (splitSel && (didSplit || selKeep)) selTextRestore(splitSel);
  const fnH = layoutFootnotes(g, true, bottom);
  const last = bottom + fnH;
  const pages = Math.max(1, Math.floor(Math.max(0, last - 1) / stride) + 1);
  renderSheets(pages, g, gap);
}
function layoutFootnotes(g, print, contentBottom) {
  const fa = $('#footnoteArea');
  const notes = $$('sup.fn', editor);
  const rom = n => { const m = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]; let r = ''; for (const [v, t] of m) while (n >= v) { r += t; n -= v; } return r; };
  let nf = 0, ne = 0;
  notes.forEach(n => n.setAttribute('data-n', n.classList.contains('en') ? rom(++ne) : ++nf));
  if (!notes.length) { fa.innerHTML = ''; return 0; }
  const item = (n, i) => `<p class="fn-item" data-i="${i}"><sup>${n.getAttribute('data-n')}</sup> ${esc(n.getAttribute('data-note') || '')}</p>`;
  const fns = notes.map((n, i) => [n, i]).filter(([n]) => !n.classList.contains('en')), ens = notes.map((n, i) => [n, i]).filter(([n]) => n.classList.contains('en'));
  fa.innerHTML = (fns.length ? '<div class="fn-sep"></div>' + fns.map(([n, i]) => item(n, i)).join('') : '') + (ens.length ? '<div class="fn-sep en-sep"></div><p class="en-title">Endnotes</p>' + ens.map(([n, i]) => item(n, i)).join('') : '');
  if (print) {
    Object.assign(fa.style, { position: 'absolute', left: g.ml + 'px', width: g.cw + 'px', top: (contentBottom + 12) + 'px' });
    return fa.offsetHeight + 12;
  }
  Object.assign(fa.style, { position: '', left: '', width: '', top: '' });
  return 0;
}
const _hfClean = new Map();
function hfRender(html, page, total) {
  html = html || '';
  if (html && /background/i.test(html) && typeof stripBackgrounds === 'function') {
    if (!_hfClean.has(html)) { if (_hfClean.size > 20) _hfClean.clear(); _hfClean.set(html, stripBackgrounds(html)); }
    html = _hfClean.get(html);
  }
  return html.replace(/\{PAGE\}/g, page).replace(/\{NUMPAGES\}/g, total);
}
function renderSheets(n, g, gap) {
  ui.pages = n;
  const s = doc.settings;
  const sheets = $('#sheets');
  while (sheets.children.length > n) sheets.lastChild.remove();
  const stride = g.ph + gap;
  for (let i = 0; i < n; i++) {
    let sh = sheets.children[i];
    if (!sh) {
      sh = h('div', { class: 'sheet' }, h('div', { class: 'wm' }), h('div', { class: 'hf hdr', title: 'Double-click to edit header' }), h('div', { class: 'hf ftr', title: 'Double-click to edit footer' }), h('span', { class: 'pgnum-tip' }));
      sheets.append(sh);
    }
    Object.assign(sh.style, { top: i * stride + 'px', width: g.pw + 'px', height: g.ph + 'px', background: s.pageColor || '#fff' });
    const first = i === 0 && s.differentFirst;
    const hd = sh.children[1], ft = sh.children[2];
    const hh = hfRender(first ? s.firstHeader : s.header, i + 1, n), fh = hfRender(first ? s.firstFooter : s.footer, i + 1, n);
    if (hd._h !== hh) { hd.innerHTML = hh; hd._h = hh; }
    if (ft._h !== fh) { ft.innerHTML = fh; ft._h = fh; }
    const m = s.margins;
    Object.assign(hd.style, { top: hfOffset(m.top * 96) + 'px', left: g.ml + 'px', right: g.mr + 'px', maxHeight: 'none' });
    Object.assign(ft.style, { bottom: hfOffset(m.bottom * 96) + 'px', left: g.ml + 'px', right: g.mr + 'px', maxHeight: 'none' });
    const wm = sh.children[0];
    const wmText = s.watermark || '';
    if (wm._t !== wmText) { wm.innerHTML = wmText ? `<span>${esc(wmText)}</span>` : ''; wm._t = wmText; const sp = wm.firstChild; if (sp) sp.style.fontSize = Math.min(110, Math.round(g.pw * 1.15 / Math.max(4, wmText.length))) + 'px'; }
    sh.children[3].textContent = n > 1 ? String(i + 1) : '';
    let fr = sh.querySelector('.pgframe');
    const pb = s.pageBorder;
    if (pb) {
      if (!fr) { fr = h('div', { class: 'pgframe' }); sh.append(fr); }
      const w = pb.style === 'thick' ? pb.width * 2 : pb.style === 'double' ? Math.max(3, pb.width * 3) : pb.width;
      fr.style.border = `${w}pt ${pb.style === 'thick' ? 'solid' : pb.style === 'single' ? 'solid' : pb.style} ${pb.color || '#000'}`;
    } else if (fr) fr.remove();
  }
  // editor box
  const totalH = n * stride - gap;
  Object.assign(editor.style, { marginLeft: g.ml + 'px', width: g.cw + 'px', paddingTop: g.mt1 + 'px', minHeight: Math.max(0, (n - 1) * stride + g.ph - g.mb) + 'px' });
  const pages = $('#pages');
  pages.style.width = g.pw + 'px';
  pages.style.height = totalH + 'px';
  applyZoom();
  if (typeof renderLineNumbers === 'function') renderLineNumbers();
  if (typeof updateXrefs === 'function') updateXrefs();
}
function applyZoom() {
  const g = geom();
  const pages = $('#pages'), scaler = $('#scaler');
  if (ui.view !== 'print' && !ui.printing) { pages.style.transform = ''; scaler.style.width = ''; scaler.style.height = ''; updateRuler(); return; }
  if (ui.fitWidth) { const cw = $('#canvas').clientWidth - (innerWidth < 760 ? 12 : 48); ui.zoom = Math.max(0.25, Math.min(3, cw / g.pw)); }
  const z = ui.printing ? 1 : ui.zoom;
  const total = parseFloat(pages.style.height) || g.ph;
  pages.style.transform = z === 1 ? '' : `scale(${z})`;
  scaler.style.width = g.pw * z + 'px';
  scaler.style.height = total * z + 'px';
  const pct = Math.round(ui.zoom * 100);
  $('#zoomPct').textContent = pct + '%';
  $('#zoomRange').value = pct;
  updateRuler();
}
function updateRuler() {
  const r = $('#ruler');
  r.classList.toggle('hidden', !ui.ruler || ui.view !== 'print');
  if (!ui.ruler || ui.view !== 'print') return;
  const g = geom(), z = ui.zoom, inner = $('#rulerInner');
  inner.style.width = g.pw * z + 'px';
  let x = `<div class="m" style="left:0;width:${g.ml * z}px"></div><div class="m" style="right:0;width:${g.mr * z}px"></div>`;
  for (let q = 0; q <= g.pw / 24; q++) {
    const px = q * 24 * z;
    if (q % 4 === 0 && q) x += `<span class="t" style="left:${px}px">${q / 4}</span>`;
    else x += `<i class="k" style="left:${px}px;height:${q % 2 ? 3 : 5}px"></i>`;
  }
  inner.innerHTML = x;
}
let paginateQueued = false;
function schedulePaginate() {
  if (paginateQueued) return;
  paginateQueued = true;
  requestAnimationFrame(() => { paginateQueued = false; paginate(); updateStatus(); });
}
