/* DraftLy core: state, helpers, storage, history, page layout */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const editor = $('#editor');
const IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform) || /Macintosh/.test(navigator.userAgent);
const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
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
const DEFAULT_SETTINGS = () => ({ pageSize: 'A4', orientation: 'portrait', margins: { top: 1, bottom: 1, left: 1, right: 1 }, header: '', footer: '', firstHeader: '', firstFooter: '', differentFirst: false, watermark: '', pageColor: '', theme: Object.assign({}, STYLE_SETS[prefs.styleSet] || STYLE_SETS.Default) });
let doc = null;          // { id, title, settings, comments, created, modified, syncedAt }
const ui = { zoom: 1, view: 'print', markup: 'all', showComments: true, printing: false, pages: 1, readonly: false, ruler: false, fitWidth: false };

function geom() {
  const s = doc.settings;
  let [pw, ph] = PAGE_PX[s.pageSize] || PAGE_PX.A4;
  if (s.orientation === 'landscape') [pw, ph] = [ph, pw];
  const m = s.margins;
  return { pw, ph, mt: m.top * 96, mb: m.bottom * 96, ml: m.left * 96, mr: m.right * 96, cw: pw - (m.left + m.right) * 96, ch: ph - (m.top + m.bottom) * 96 };
}

/* ---------- storage (IndexedDB) ---------- */
const Store = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('draftly', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('docs', { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('docs', mode); const st = t.objectStore('docs'); const out = fn(st); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); }); };
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
  c.querySelectorAll('[data-pg]').forEach(el => { el.removeAttribute('data-pg'); el.removeAttribute('data-pgb'); el.style.removeProperty('--pg'); if (!el.getAttribute('style')) el.removeAttribute('style'); });
  c.querySelectorAll('img.sel').forEach(el => { el.classList.remove('sel'); if (!el.className) el.removeAttribute('class'); });
  c.querySelectorAll('.cmt.active').forEach(el => el.classList.remove('active'));
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
  $('#docStyles').textContent = `
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
}

/* ---------- page layout & pagination ---------- */
function topIn(el) { let y = 0; while (el && el !== editor) { y += el.offsetTop; el = el.offsetParent; } return y; }
function clearPushes() {
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
  clearPushes();
  if (!print) { renderSheets(1, g, 0); layoutFootnotes(g, false); return; }
  const gap = ui.printing ? 0 : GAP, stride = g.ph + gap;
  let breakPage = null, bottom = g.mt;
  for (const u of collectUnits()) {
    const el = u.el;
    if (el.tagName === 'HR' && el.classList.contains('pb')) { breakPage = Math.floor(topIn(el) / stride); bottom = Math.max(bottom, topIn(el) + el.offsetHeight); continue; }
    const top = topIn(el), hgt = el.offsetHeight;
    const p = Math.max(0, Math.floor(top / stride));
    const cTop = p * stride + g.mt, cBot = p * stride + g.ph - g.mb;
    let target = null;
    if (breakPage !== null) { const tp = (breakPage + 1) * stride + g.mt; if (top < tp - 0.5) target = tp; breakPage = null; }
    else if (top >= cBot - 0.5) target = (p + 1) * stride + g.mt;
    else if (top < cTop - 0.5) target = cTop;
    else if (top + hgt > cBot + 0.5 && hgt <= g.ch) target = (p + 1) * stride + g.mt;
    if (target !== null && target > top) {
      el.setAttribute('data-pg', '');
      el.style.setProperty('--pg', (target - top) + 'px');
    }
    bottom = Math.max(bottom, topIn(el) + el.offsetHeight);
  }
  if (ui.printing && !ui.raster) {
    // printing: turn each push into a real page break so printed pages match the screen exactly
    editor.querySelectorAll('[data-pg]').forEach(el => {
      el.setAttribute('data-pgb', '');
      const m = el.tagName === 'TR' ? 0 : parseFloat(getComputedStyle(el).marginTop) || 0;
      el.style.setProperty('--pg', Math.max(0, g.mt - m) + 'px');
    });
  }
  const fnH = layoutFootnotes(g, true, bottom);
  const last = bottom + fnH;
  const pages = Math.max(1, Math.floor(Math.max(0, last - 1) / stride) + 1);
  renderSheets(pages, g, gap);
}
function layoutFootnotes(g, print, contentBottom) {
  const fa = $('#footnoteArea');
  const notes = $$('sup.fn', editor);
  notes.forEach((n, i) => n.setAttribute('data-n', i + 1));
  if (!notes.length) { fa.innerHTML = ''; return 0; }
  fa.innerHTML = '<div class="fn-sep"></div>' + notes.map((n, i) => `<p class="fn-item" data-i="${i}"><sup>${i + 1}</sup> ${esc(n.getAttribute('data-note') || '')}</p>`).join('');
  if (print) {
    Object.assign(fa.style, { position: 'absolute', left: g.ml + 'px', width: g.cw + 'px', top: (contentBottom + 12) + 'px' });
    return fa.offsetHeight + 12;
  }
  Object.assign(fa.style, { position: '', left: '', width: '', top: '' });
  return 0;
}
function hfRender(html, page, total) {
  return (html || '').replace(/\{PAGE\}/g, page).replace(/\{NUMPAGES\}/g, total);
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
    Object.assign(hd.style, { top: Math.min(48, g.mt * 0.5) + 'px', left: g.ml + 'px', right: g.mr + 'px', maxHeight: Math.max(10, g.mt - Math.min(48, g.mt * 0.5) - 4) + 'px' });
    Object.assign(ft.style, { bottom: Math.min(48, g.mb * 0.5) + 'px', left: g.ml + 'px', right: g.mr + 'px', maxHeight: Math.max(10, g.mb - Math.min(48, g.mb * 0.5) - 4) + 'px' });
    const wm = sh.children[0];
    const wmText = s.watermark || '';
    if (wm._t !== wmText) { wm.innerHTML = wmText ? `<span>${esc(wmText)}</span>` : ''; wm._t = wmText; const sp = wm.firstChild; if (sp) sp.style.fontSize = Math.min(110, Math.round(g.pw * 1.15 / Math.max(4, wmText.length))) + 'px'; }
    sh.children[3].textContent = n > 1 ? String(i + 1) : '';
  }
  // editor box
  const totalH = n * stride - gap;
  Object.assign(editor.style, { marginLeft: g.ml + 'px', width: g.cw + 'px', paddingTop: g.mt + 'px', minHeight: Math.max(0, (n - 1) * stride + g.ph - g.mb) + 'px' });
  const pages = $('#pages');
  pages.style.width = g.pw + 'px';
  pages.style.height = totalH + 'px';
  applyZoom();
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
