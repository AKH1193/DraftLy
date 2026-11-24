/* DraftLy UI: commands, ribbon, menus, dialogs, panes */
const FONTS = ['Aptos', 'Aptos Display', 'Arial', 'Arial Narrow', 'Avenir', 'Baskerville', 'Book Antiqua', 'Bookman Old Style', 'Calibri', 'Calibri Light', 'Cambria', 'Century Gothic', 'Courier New', 'Didot', 'Futura', 'Garamond', 'Georgia', 'Gill Sans', 'Helvetica', 'Helvetica Neue', 'Kannada Sangam MN', 'Devanagari Sangam MN', 'Noto Sans Kannada', 'Noto Sans Devanagari', 'Nirmala UI', 'Tunga', 'Mangal', 'Menlo', 'Optima', 'Palatino', 'Palatino Linotype', 'Roboto', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'];
const SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
const THEME_COLORS = ['#FFFFFF', '#000000', '#E8E8E8', '#0E2841', '#156082', '#E97132', '#196B24', '#0F9ED5', '#A02B93', '#4EA72E',
  '#F2F2F2', '#7F7F7F', '#D0D0D0', '#DCEAF7', '#C1E4F5', '#FBE2D5', '#C2F1C8', '#CAEEFB', '#F2CEEF', '#D9F2D0',
  '#D9D9D9', '#595959', '#ADADAD', '#A5C9EB', '#83CBEB', '#F7C7AC', '#8ED973', '#95DCF7', '#E59EDD', '#B4E5A2',
  '#BFBFBF', '#404040', '#757575', '#4E95D9', '#45B0E1', '#F1A983', '#47D45A', '#61CBF3', '#D86DCB', '#8ED973',
  '#A6A6A6', '#262626', '#3A3A3A', '#215F9A', '#0F4761', '#C04F15', '#124F1A', '#0B76A0', '#77206D', '#3B7D23',
  '#C00000', '#FF0000', '#FFC000', '#FFFF00', '#92D050', '#00B050', '#00B0F0', '#0070C0', '#002060', '#7030A0'];
const HIGHLIGHTS = ['#FFFF00', '#00FF00', '#00FFFF', '#FF00FF', '#0000FF', '#FF0000', '#000080', '#008080', '#008000', '#800080', '#800000', '#808000', '#808080', '#C0C0C0', '#000000'];
const SYMBOLS = '§ ¶ © ® ™ ° ± × ÷ ≠ ≈ ≤ ≥ ∞ √ ∑ ∏ ∆ π Ω µ α β γ δ θ λ σ φ ₹ $ € £ ¥ ¢ • · … ‹ › « » “ ” ‘ ’ † ‡ ½ ¼ ¾ ⅓ ⅔ ¹ ² ³ ← → ↑ ↓ ↔ ⇒ ⇔ ✓ ✔ ✗ ✘ ★ ☆ ☐ ☑ ☒ ♦ ■ □ ▪ ▫ ● ○ ◆ ◇ ▲ △ ▼ ▽ ※ ‰ ℅ № ℓ ℃ ℉ Ⓡ ¿ ¡ ß æ œ ø å ü ö ä é è ê ç ñ'.split(' ');

let pendingSize = null, painter = null, lastFore = '#C00000', lastHilite = '#FFFF00', ctxTab = null, currentTab = 'home';
const mod = e => IS_MAC ? e.metaKey : e.ctrlKey;

/* ---------- core command execution ---------- */
function exec(cmd, val) {
  if (ui.readonly) return toast('Editing is restricted. Turn off Restrict Editing in the Review tab.');
  restoreRange();
  History.flush();
  try { document.execCommand('styleWithCSS', false, cmd !== 'hiliteColor' ? true : true); } catch (e) { }
  document.execCommand(cmd, false, val);
  afterChange();
}
function mutate(fn) {
  if (ui.readonly) return toast('Editing is restricted.');
  History.flush();
  const r = fn();
  afterChange();
  return r;
}
function fixFontSizes() {
  editor.querySelectorAll('font[size="7"]').forEach(f => {
    const s = document.createElement('span'); s.style.fontSize = (pendingSize || 36) + 'pt';
    while (f.firstChild) s.appendChild(f.firstChild);
    f.replaceWith(s);
  });
  editor.querySelectorAll('span[style*="xxx-large"]').forEach(s => { s.style.fontSize = (pendingSize || 36) + 'pt'; });
}
function normalize() {
  fixFontSizes();
  // wrap stray top-level inline content into paragraphs
  let p = null;
  for (const n of [...editor.childNodes]) {
    const inline = n.nodeType === 3 || (n.nodeType === 1 && !/^(P|H[1-6]|UL|OL|TABLE|HR|DIV|BLOCKQUOTE|PRE|SECTION)$/.test(n.tagName));
    if (inline) {
      if (n.nodeType === 3 && !n.nodeValue.trim() && !p) { if (n.nodeValue.includes('\n') || !n.nodeValue) { n.remove(); continue; } }
      if (!p) { p = document.createElement('p'); editor.insertBefore(p, n); }
      p.appendChild(n);
    } else p = null;
  }
  if (!editor.firstElementChild) { editor.innerHTML = '<p><br></p>'; }
  editor.querySelectorAll('ins.tc:empty, del.tc:empty, span.cmt:empty').forEach(e => e.remove());
  editor.querySelectorAll('span:not([class]):not([style])').forEach(s => { if (!s.attributes.length) Review.unwrap(s); });
}
let changeTimer = null, saveTimer = null;
function afterChange(opts = {}) {
  normalize();
  if (!opts.noHistory) History.soon();
  schedulePaginate();
  markDirty();
  clearTimeout(changeTimer);
  changeTimer = setTimeout(() => { refreshPanes(); updateWordCount(); }, 250);
  scheduleUI();
  if (typeof extrasAfterChange === 'function') extrasAfterChange();
}

/* ---------- editor events ---------- */
editor.addEventListener('input', () => afterChange());
editor.addEventListener('beforeinput', e => {
  if (ui.readonly) { e.preventDefault(); return; }
  if (e.inputType === 'historyUndo') { e.preventDefault(); History.undo(); }
  else if (e.inputType === 'historyRedo') { e.preventDefault(); History.redo(); }
}, true);
document.addEventListener('selectionchange', () => {
  const s = getSelection();
  if (s.rangeCount && editor.contains(s.getRangeAt(0).commonAncestorContainer)) lastRange = s.getRangeAt(0).cloneRange();
  scheduleUI();
});
function insertPasted(mode, html, text) {
  if (mode !== 'text' && html) return document.execCommand('insertHTML', false, mode === 'merge' && typeof mergeFormatting === 'function' ? mergeFormatting(html) : sanitizeHtml(html, true));
  if (!text) return;
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length === 1) document.execCommand('insertText', false, text);
  else document.execCommand('insertHTML', false, lines.map(l => `<p>${esc(l) || '<br>'}</p>`).join(''));
}
editor.addEventListener('paste', async e => {
  if (ui.readonly) { e.preventDefault(); return; }
  const cd = e.clipboardData;
  if (!cd) return;
  const files = [...cd.files || []].filter(f => f.type.startsWith('image/'));
  if (files.length) { e.preventDefault(); for (const f of files) insertImageFile(f); return; }
  if (Review.isTracking()) return; // tracked paste handled in beforeinput
  const html = cd.getData('text/html'), text = cd.getData('text/plain');
  e.preventDefault();
  History.record();
  const mode = e.shiftKey || !html ? 'text' : prefs.pasteMode || 'keep';
  insertPasted(mode, html, text);
  afterChange();
  if (html && typeof showPasteOptions === 'function') showPasteOptions(html, text, mode);
});
editor.addEventListener('drop', e => {
  const f = [...(e.dataTransfer && e.dataTransfer.files) || []];
  if (f.some(x => x.type.startsWith('image/'))) { e.preventDefault(); f.filter(x => x.type.startsWith('image/')).forEach(insertImageFile); }
  else if (f.some(x => /\.(docx|html?|txt|md)$/i.test(x.name))) { e.preventDefault(); openFileObject(f[0]); }
});
editor.addEventListener('click', e => {
  const img = e.target.closest && e.target.closest('img');
  selectImage(img && editor.contains(img) ? img : null);
  // like Word: clicking into a table shows Table Design; clicking out returns to Home
  const inCell = e.target.closest && e.target.closest('td,th');
  const tabNow = TABS.find(t => t.id === currentTab);
  if (inCell && !img && (!tabNow || !tabNow.ctx)) { currentTab = 'tdesign'; ctxTab = 'table'; renderTabs(); renderRibbon(); }
  else if (!inCell && !img && tabNow && tabNow.ctx) { currentTab = 'home'; renderTabs(); renderRibbon(); }
  else if (img && currentTab !== 'picture') { currentTab = 'picture'; renderTabs(); renderRibbon(); }
  const fn = e.target.closest && e.target.closest('sup.fn');
  if (fn) editFootnote(fn);
  const a = e.target.closest && e.target.closest('a[href]');
  if (a && (mod(e) || ui.readonly)) { e.preventDefault(); const href = a.getAttribute('href'); if (href.startsWith('#')) { const t = document.getElementById(href.slice(1)) || editor.querySelector(`[name="${CSS.escape(href.slice(1))}"]`); t && t.scrollIntoView({ block: 'center' }); } else window.open(href, '_blank', 'noopener'); }
  const tocRow = e.target.closest && e.target.closest('.toc-row');
  if (tocRow) { const hs = headings(); const hd = hs[+tocRow.getAttribute('data-i')]; hd && hd.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  const tocEl = e.target.closest && e.target.closest('.toc');
  if (tocEl && !tocRow) { updateTOC(); toast('Table of contents updated'); }
});
editor.addEventListener('mouseup', () => { if (painter) setTimeout(applyPainter, 0); });
editor.addEventListener('touchend', () => { if (painter) setTimeout(applyPainter, 300); });
editor.addEventListener('dblclick', e => { const img = e.target.closest && e.target.closest('img'); if (img) altTextDialog(img); });
$('#footnoteArea').addEventListener('click', e => { const it = e.target.closest('.fn-item'); if (it) { const n = $$('sup.fn', editor)[+it.getAttribute('data-i')]; n && editFootnote(n); } });
/* header/footer zones: double-click (or tap on touch screens) in the top or bottom margin of a page, like Word */
function hfZoneAt(e) {
  if (ui.view !== 'print' || ui.printing) return null;
  const pr = $('#pages').getBoundingClientRect();
  const g = geom(), stride = g.ph + GAP;
  const y = (e.clientY - pr.top) / ui.zoom, x = (e.clientX - pr.left) / ui.zoom;
  if (x < 0 || x > g.pw || y < 0) return null;
  const page = Math.floor(y / stride), yIn = y - page * stride;
  if (yIn > g.ph) return null;
  const first = page === 0 && doc.settings.differentFirst;
  if (yIn < g.mt - 4) return first ? 'firstHeader' : 'header';
  if (yIn > g.ph - g.mb + 4) return first ? 'firstFooter' : 'footer';
  return null;
}
$('#pages').addEventListener('dblclick', e => {
  const z = hfZoneAt(e);
  if (!z) return;
  e.preventDefault(); e.stopPropagation();
  headerFooterDialog(z);
}, true);
$('#pages').addEventListener('pointerup', e => {
  if (e.pointerType !== 'touch') return;
  const z = hfZoneAt(e);
  if (z) { e.preventDefault(); headerFooterDialog(z); }
}, true);
$('#canvas').addEventListener('mousedown', e => {
  if (e.target.id === 'canvas' || e.target.id === 'scaler' || e.target.id === 'pages' || e.target.classList.contains('sheet')) {
    if (e.target.closest('.hf')) return;
    e.preventDefault();
    editor.focus({ preventScroll: true });
    const last = editor.lastElementChild;
    if (last) { const r = document.createRange(); r.selectNodeContents(last); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  }
});

document.addEventListener('keydown', e => {
  const inEditor = editor.contains(document.activeElement) || document.activeElement === editor;
  const k = e.key.toLowerCase();
  if (e.key === 'Escape') { closeMenu(); if ($('#backstage').classList.contains('hidden') === false) closeBackstage(); if (document.body.classList.contains('read') || document.body.classList.contains('focus')) setView('print'); if (painter) { painter = null; updateRibbonState(); } }
  if (!mod(e)) {
    if (inEditor && e.key === 'Tab') { e.preventDefault(); handleTab(e.shiftKey); }
    return;
  }
  const inField = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || (document.activeElement.isContentEditable && !inEditor);
  const map = {
    s: () => CMD.save(), o: () => CMD.open(), p: () => CMD.print(), f: () => CMD.findPane(), n: () => (e.altKey || !IS_MAC) && CMD.newDoc()
  };
  if (k === 's' && !e.shiftKey) { e.preventDefault(); return CMD.save(); }
  if (k === 's' && e.shiftKey) { e.preventDefault(); return openBackstage('saveas'); }
  if (k === 'o') { e.preventDefault(); return CMD.open(); }
  if (k === 'p') { e.preventDefault(); return CMD.print(); }
  if (k === 'f' && !e.shiftKey) { e.preventDefault(); return CMD.findPane(); }
  if ((k === 'h' && !IS_MAC) || (k === 'h' && e.shiftKey && IS_MAC)) { e.preventDefault(); return CMD.replacePane(); }
  if (inField) return;
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); return History.undo(); }
  if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); return History.redo(); }
  if (!inEditor) return;
  const acts = {
    b: 'bold', i: 'italic', u: 'underline', e: 'center', l: 'left', r: 'right', j: 'justify', k: 'link'
  };
  if (e.altKey && /^[1-3]$/.test(e.key)) { e.preventDefault(); return applyStyle('Heading ' + e.key); }
  if (e.code === 'Digit0' && e.altKey) { e.preventDefault(); return applyStyle('Normal'); }
  if (k === 'enter') { e.preventDefault(); return CMD.pageBreak(); }
  if (e.shiftKey && (e.key === '>' || e.key === '.')) { e.preventDefault(); return CMD.grow(); }
  if (e.shiftKey && (e.key === '<' || e.key === ',')) { e.preventDefault(); return CMD.shrink(); }
  if (e.key === '=' && !e.shiftKey) { e.preventDefault(); return CMD.subscript(); }
  if ((e.key === '+' || e.key === '=') && e.shiftKey) { e.preventDefault(); return CMD.superscript(); }
  if (k === 'e' && e.shiftKey) { e.preventDefault(); return CMD.track(); }
  if (k === 'm' && e.altKey) { e.preventDefault(); return CMD.comment(); }
  if (e.code === 'Space' && !e.shiftKey && !e.altKey && !IS_MAC) { e.preventDefault(); return CMD.clear(); }
  if (k === 'l' && e.shiftKey) { e.preventDefault(); return CMD.bullets(); }
  if (acts[k] && !e.shiftKey && !e.altKey) { e.preventDefault(); return CMD[acts[k]](); }
});
function handleTab(shift) {
  const r = getRange(); if (!r) return;
  const cell = closestOf(r.startContainer, 'td,th');
  const li = closestOf(r.startContainer, 'li');
  if (cell) {
    const cells = [...cell.closest('table').querySelectorAll('td,th')].filter(c => !c.parentElement.classList.contains('pg-sp'));
    let i = cells.indexOf(cell) + (shift ? -1 : 1);
    if (i >= cells.length) { tableOp('rowBelow'); return handleTab(false); }
    const t = cells[Math.max(0, i)];
    const nr = document.createRange(); nr.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(nr);
    return;
  }
  if (li) return exec(shift ? 'outdent' : 'indent');
  if (shift) return;
  if (Review.isTracking()) mutate(() => Review.trackedInsert('\t'));
  else exec('insertText', '\t');
}
const closestOf = (n, sel) => { while (n && n !== editor) { if (n.nodeType === 1 && n.matches(sel)) return n; n = n.parentNode; } return null; };

/* ---------- formatting commands ---------- */
function setFontSize(pt) {
  pt = Math.max(1, Math.min(1638, +pt || 11));
  pendingSize = pt;
  const r = getRange();
  if (r && r.collapsed) {
    restoreRange();
    History.flush();
    const sp = document.createElement('span'); sp.style.fontSize = pt + 'pt'; sp.textContent = '​';
    r.insertNode(sp);
    const nr = document.createRange(); nr.setStart(sp.firstChild, 1); nr.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(nr);
    afterChange();
  } else exec('fontSize', 7);
}
function currentSize() {
  const el = selElement();
  return el ? Math.round(parseFloat(getComputedStyle(el).fontSize) * 0.75 * 2) / 2 : 11;
}
function selElement() {
  const r = getRange(); if (!r) return null;
  let n = r.startContainer;
  if (n.nodeType === 1 && n.childNodes[r.startOffset] && n.childNodes[r.startOffset].nodeType === 3) n = n.childNodes[r.startOffset];
  return n.nodeType === 3 ? n.parentElement : n;
}
function textNodesForCase() {
  const r = getRange(); if (!r || r.collapsed) return [];
  return Review.isolate(r).nodes.filter(n => n.nodeType === 3);
}
function changeCase(mode) {
  mutate(() => {
    const nodes = textNodesForCase();
    if (!nodes.length) return;
    let startSentence = true;
    for (const n of nodes) {
      let t = n.data;
      if (mode === 'upper') t = t.toUpperCase();
      else if (mode === 'lower') t = t.toLowerCase();
      else if (mode === 'title') t = t.toLowerCase().replace(/(^|[\s(\["'“‘-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
      else if (mode === 'toggle') t = [...t].map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join('');
      else if (mode === 'sentence') {
        t = [...t.toLowerCase()].map(c => { if (startSentence && /\p{L}/u.test(c)) { startSentence = false; return c.toUpperCase(); } if (/[.!?]/.test(c)) startSentence = true; return c; }).join('');
      }
      n.data = t;
    }
    const s = getSelection(); const nr = document.createRange(); nr.setStart(nodes[0], 0); const l = nodes[nodes.length - 1]; nr.setEnd(l, l.length); s.removeAllRanges(); s.addRange(nr);
  });
}
function clearFormatting() {
  exec('removeFormat');
  mutate(() => {
    const r = getRange();
    selectedBlocks().forEach(b => {
      if (/^H[1-6]$/.test(b.tagName) || b.className.startsWith('s-')) { /* handled by applyStyle below */ }
      b.removeAttribute('style');
      if (b.tagName === 'P') b.removeAttribute('class');
    });
    if (r && !r.collapsed) Review.isolate(r).nodes.forEach(n => { let p = n.parentElement; while (p && p !== editor && p.tagName === 'SPAN' && !p.className) { const pp = p.parentElement; Review.unwrap(p); p = pp; } });
  });
  applyStyle('Normal');
}
function blockStyle(fn) { mutate(() => { restoreRange(); selectedBlocks().forEach(fn); }); }
const STYLES = [
  { name: 'Normal', tag: 'p', cls: '' }, { name: 'No Spacing', tag: 'p', cls: 's-NoSpacing' },
  { name: 'Heading 1', tag: 'h1' }, { name: 'Heading 2', tag: 'h2' }, { name: 'Heading 3', tag: 'h3' }, { name: 'Heading 4', tag: 'h4' },
  { name: 'Title', tag: 'p', cls: 's-Title' }, { name: 'Subtitle', tag: 'p', cls: 's-Subtitle' },
  { name: 'Quote', tag: 'p', cls: 's-Quote' }, { name: 'Intense Quote', tag: 'p', cls: 's-IntenseQuote' }
];
function applyStyle(name) {
  const st = STYLES.find(s => s.name === name); if (!st) return;
  if (ui.readonly) return;
  restoreRange();
  History.flush();
  const blocks = selectedBlocks();
  const inList = blocks.some(b => b.tagName === 'LI');
  if (!inList) {
    try { document.execCommand('formatBlock', false, st.tag); } catch (e) { }
    selectedBlocks().forEach(b => {
      if (b.tagName.toLowerCase() !== st.tag) return;
      [...b.classList].filter(c => c.startsWith('s-')).forEach(c => b.classList.remove(c));
      if (st.cls) b.classList.add(st.cls);
      if (!b.className) b.removeAttribute('class');
    });
  } else {
    // in lists, wrap li content in the heading tag
    blocks.forEach(li => {
      if (li.tagName !== 'LI') return;
      const inner = li.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > p');
      if (st.name === 'Normal') { if (inner) Review.unwrap(inner); return; }
      const el = document.createElement(st.tag); if (st.cls) el.className = st.cls;
      const nodes = [...li.childNodes].filter(n => !(n.nodeType === 1 && /^(UL|OL)$/.test(n.tagName)));
      if (inner) Review.unwrap(inner);
      li.insertBefore(el, nodes[0] || null);
      [...li.childNodes].filter(n => n !== el && !(n.nodeType === 1 && /^(UL|OL)$/.test(n.tagName))).forEach(n => el.appendChild(n));
    });
  }
  afterChange();
}
function currentStyleName() {
  const b = selectedBlocks()[0]; if (!b) return 'Normal';
  const el = b.tagName === 'LI' ? (b.querySelector(':scope > h1,:scope > h2,:scope > h3,:scope > h4,:scope > p[class]') || b) : b;
  const t = el.tagName.toLowerCase();
  const cls = [...el.classList].find(c => c.startsWith('s-')) || '';
  const st = STYLES.find(s => s.tag === t && (s.cls || '') === cls) || STYLES.find(s => s.tag === t);
  return st ? st.name : 'Normal';
}
function setList(ordered, styleType) {
  restoreRange();
  const r = getRange();
  const cur = r && closestOf(r.startContainer, 'ul,ol');
  const want = ordered ? 'OL' : 'UL';
  if (!cur || cur.tagName !== want) exec(ordered ? 'insertOrderedList' : 'insertUnorderedList');
  else if (!styleType) { exec(ordered ? 'insertOrderedList' : 'insertUnorderedList'); return; }
  const r2 = getRange();
  const list = r2 && closestOf(r2.startContainer, 'ul,ol');
  if (list && styleType) mutate(() => { if (styleType === 'default') list.style.removeProperty('list-style-type'); else list.style.listStyleType = styleType; if (!list.getAttribute('style')) list.removeAttribute('style'); });
}
function indentBlocks(dir) {
  const blocks = selectedBlocks();
  if (blocks.some(b => b.tagName === 'LI')) return exec(dir > 0 ? 'indent' : 'outdent');
  blockStyle(b => {
    const cur = parseFloat(b.style.marginLeft) || 0;
    const v = Math.max(0, cur + dir * 48);
    if (v) b.style.marginLeft = v + 'px'; else b.style.removeProperty('margin-left');
    if (!b.getAttribute('style')) b.removeAttribute('style');
  });
}
function align(a) { blockStyle(b => { if (a === 'left' && !doc.settings.theme.justify) b.style.removeProperty('text-align'); else b.style.textAlign = a; if (!b.getAttribute('style')) b.removeAttribute('style'); }); }
function lineSpacing(v) { blockStyle(b => { b.style.lineHeight = v; }); }
function spaceBA(which, pt) { blockStyle(b => { const prop = which === 'before' ? 'marginTop' : 'marginBottom'; if (pt == null || pt === '') b.style[prop] = ''; else b.style[prop] = pt + 'pt'; if (!b.getAttribute('style')) b.removeAttribute('style'); }); }
function applyPainter() {
  const r = getRange(); if (!painter || !r || r.collapsed) return;
  const p = painter; painter = null;
  exec('removeFormat');
  if (p.b) exec('bold'); if (p.i) exec('italic'); if (p.u) exec('underline'); if (p.s) exec('strikeThrough');
  exec('fontName', p.font); pendingSize = p.size; exec('fontSize', 7);
  if (p.color) exec('foreColor', p.color); if (p.bg) exec('hiliteColor', p.bg);
  updateRibbonState();
}
function pickPainter() {
  const el = selElement(); if (!el) return;
  const cs = getComputedStyle(el);
  let bg = null; for (let n = el; n && n !== editor; n = n.parentElement) { const c = n.style && n.style.backgroundColor; if (c) { bg = c; break; } }
  painter = { b: document.queryCommandState('bold'), i: document.queryCommandState('italic'), u: document.queryCommandState('underline'), s: document.queryCommandState('strikeThrough'), font: cs.fontFamily.split(',')[0].replace(/["']/g, ''), size: currentSize(), color: cs.color, bg };
  toast('Format Painter: select the text to format');
  updateRibbonState();
}

/* ---------- menus & dialogs ---------- */
let menuEl = null;
function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
function showMenu(anchor, items, opts = {}) {
  closeMenu();
  const m = h('div', { class: 'menu' });
  for (const it of items) {
    if (!it) continue;
    if (it.sep) { m.append(h('div', { class: 'sep' })); continue; }
    if (it.header) { m.append(h('div', { class: 'mh' }, it.header)); continue; }
    if (it.el) { m.append(it.el); continue; }
    const b = h('button', { class: 'mi', type: 'button' }, h('span', { class: 'ic', html: it.icon ? icon(it.icon) : (it.checked ? icon('Check') : '') }), h('span', { style: it.style || null }, it.label));
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', () => { closeMenu(); it.fn && it.fn(); });
    m.append(b);
  }
  document.body.append(m);
  menuEl = m;
  const r = anchor.getBoundingClientRect();
  let x = r.left, y = r.bottom + 2;
  const mw = m.offsetWidth, mh = m.offsetHeight;
  if (x + mw > innerWidth - 6) x = Math.max(6, innerWidth - mw - 6);
  if (y + mh > innerHeight - 6) y = Math.max(6, r.top - mh - 2);
  m.style.left = x + 'px'; m.style.top = y + 'px';
  m.addEventListener('mousedown', e => { if (!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) e.preventDefault(); });
  setTimeout(() => document.addEventListener('pointerdown', function off(e) { if (menuEl && !menuEl.contains(e.target)) { closeMenu(); document.removeEventListener('pointerdown', off); } else if (!menuEl) document.removeEventListener('pointerdown', off); }), 0);
  return m;
}
function paletteEl(colors, pick, extra) {
  const wrap = h('div');
  if (extra) wrap.append(extra);
  const g = h('div', { class: 'palette' });
  colors.forEach(c => { const b = h('button', { type: 'button', title: c, style: { background: c } }); b.addEventListener('mousedown', e => e.preventDefault()); b.addEventListener('click', () => { closeMenu(); pick(c); }); g.append(b); });
  wrap.append(g);
  return wrap;
}
function colorMenu(anchor, colors, pick0, noneLabel) {
  const pick = c => { if (c && typeof addRecentColor === 'function') addRecentColor(c); pick0(c); };
  const items = [];
  if (noneLabel) items.push({ label: noneLabel, icon: 'Ban', fn: () => pick0(null) });
  items.push({ el: paletteEl(colors, pick) });
  if (prefs.recentColors && prefs.recentColors.length) items.push({ header: 'Recent Colours' }, { el: paletteEl(prefs.recentColors, pick) });
  items.push({ sep: true }, { label: 'More colours…', icon: 'Droplet', fn: () => { const i = h('input', { type: 'color', style: { position: 'fixed', left: '-100px' } }); document.body.append(i); let v = null; i.addEventListener('input', () => { v = i.value; pick0(v); }); i.addEventListener('change', () => { if (v) addRecentColor(v); i.remove(); }); i.click(); } });
  showMenu(anchor, items);
}
function modal(title, body, buttons, opts = {}) {
  const bg = h('div', { class: 'modal-bg' });
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA' && !e.target.isContentEditable) { const p = buttons.find(b => b.primary); if (p) { e.preventDefault(); run(p); } } };
  const run = async b => { const r = b.fn ? await b.fn() : true; if (r !== false) close(); };
  const m = h('div', { class: 'modal' + (opts.wide ? ' wide' : '') }, h('h3', null, title), h('div', { class: 'mb' }, body), h('div', { class: 'mf' }, ...buttons.map(b => h('button', { class: 'btn' + (b.primary ? ' primary' : ''), type: 'button', onclick: () => run(b) }, b.label))));
  bg.append(m);
  bg.addEventListener('mousedown', e => { if (e.target === bg) close(); });
  document.addEventListener('keydown', onKey);
  $('#modalRoot').append(bg);
  setTimeout(() => { const f = m.querySelector('input,textarea,select,[contenteditable]'); f && f.focus(); }, 30);
  return { close, el: m };
}
function ask(title, label, value = '', type = 'text') {
  return new Promise(res => {
    const inp = h(type === 'textarea' ? 'textarea' : 'input', { type: type === 'textarea' ? null : type, value: type === 'textarea' ? null : value });
    if (type === 'textarea') inp.value = value;
    let done = false;
    const m = modal(title, h('div', null, h('label', { class: 'fl' }, label), inp), [{ label: 'Cancel', fn: () => { done = true; res(null); } }, { label: 'OK', primary: true, fn: () => { done = true; res(inp.value); } }]);
    const obs = new MutationObserver(() => { if (!m.el.isConnected) { obs.disconnect(); if (!done) res(null); } });
    obs.observe($('#modalRoot'), { childList: true });
  });
}
const field = (label, input) => h('div', null, h('label', { class: 'fl' }, label), input);

/* ---------- insert features ---------- */
function insertHTML(html) { exec('insertHTML', html); }
function insertTable(rows, cols) {
  if (typeof rememberLast === 'function') rememberLast('table', { rows, cols });
  const row = '<tr>' + '<td><p><br></p></td>'.repeat(cols) + '</tr>';
  insertHTML(`<table data-new="1"><tbody>${row.repeat(rows)}</tbody></table><p><br></p>`);
  const t = $('table[data-new]', editor);
  if (t) {
    t.removeAttribute('data-new');
    const p = t.querySelector('td p') || t.querySelector('td');
    const r = document.createRange(); r.setStart(p, 0); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); lastRange = r.cloneRange();
    History.record(); scheduleUI();
  }
}
function tablePicker(anchor) {
  const wrap = h('div', { class: 'tbl-pick' });
  const g = h('div', { class: 'g' }), lab = h('div', { class: 'lab' }, 'Insert Table');
  for (let r = 0; r < 8; r++) for (let c = 0; c < 10; c++) {
    const i = h('i'); i.dataset.r = r; i.dataset.c = c;
    i.addEventListener('mouseenter', () => { $$('i', g).forEach(x => x.classList.toggle('on', +x.dataset.r <= r && +x.dataset.c <= c)); lab.textContent = `${c + 1} × ${r + 1} Table`; });
    i.addEventListener('click', () => { closeMenu(); insertTable(r + 1, c + 1); });
    g.append(i);
  }
  wrap.append(g, lab);
  const lt = prefs.last && prefs.last.table;
  showMenu(anchor, [{ el: wrap }, { sep: true }, ...(lt ? [{ label: `Last Custom Setting: ${lt.cols} × ${lt.rows} Table`, icon: 'History', fn: () => insertTable(lt.rows, lt.cols) }] : []), { label: 'Insert Table…', icon: 'Table', fn: async () => { const v = await ask('Insert Table', 'Columns × rows (for example 3x4)', lt ? `${lt.cols}x${lt.rows}` : '3x3'); const m = v && v.match(/(\d+)\s*[x×*,]\s*(\d+)/i); if (m) insertTable(Math.min(200, +m[2]), Math.min(40, +m[1])); } }]);
}
function insertImageFile(file) {
  const rd = new FileReader();
  rd.onload = () => {
    const img = new Image();
    img.onload = () => {
      let src = rd.result;
      const maxW = 1800;
      if (img.naturalWidth > maxW || file.size > 1.5e6 || !/png|jpe?g|gif/.test(file.type)) {
        const sc = Math.min(1, maxW / img.naturalWidth);
        const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        src = /png/.test(file.type) && file.size < 3e6 ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.86);
      }
      const w = Math.min(img.naturalWidth, Math.floor(geom().cw));
      insertHTML(`<img src="${src}" alt="${esc(file.name.replace(/\.[^.]+$/, ''))}" style="width:${w}px;height:${Math.round(w * img.naturalHeight / img.naturalWidth)}px">`);
      setTimeout(schedulePaginate, 50);
    };
    img.src = rd.result;
  };
  rd.readAsDataURL(file);
}
function linkDialog() {
  restoreRange();
  const r = getRange();
  const a = r && closestOf(r.startContainer, 'a');
  const text = h('input', { type: 'text', value: a ? a.textContent : (r ? r.toString() : '') });
  const url = h('input', { type: 'url', value: a ? a.getAttribute('href') : 'https://', placeholder: 'https://' });
  const saved = r && r.cloneRange();
  const btns = [{ label: 'Cancel' }];
  if (a) btns.push({ label: 'Remove Link', fn: () => mutate(() => Review.unwrap(a)) });
  btns.push({
    label: 'OK', primary: true, fn: () => {
      let href = url.value.trim(); if (!href || href === 'https://') return;
      if (!/^[a-z]+:|^#/i.test(href)) href = (href.includes('@') ? 'mailto:' : 'https://') + href;
      lastRange = saved;
      if (a) return mutate(() => { a.setAttribute('href', href); if (text.value) a.textContent = text.value; });
      if (saved && !saved.collapsed && (!text.value || text.value === saved.toString())) exec('createLink', href);
      else insertHTML(`<a href="${esc(href)}">${esc(text.value || href)}</a>&nbsp;`);
    }
  });
  modal(a ? 'Edit Link' : 'Insert Link', h('div', null, field('Text to display', text), field('Address', url)), btns);
  setTimeout(() => url.focus(), 40);
}
function symbolDialog() {
  const grid = h('div', { class: 'sym-grid' });
  let m;
  SYMBOLS.forEach(s => grid.append(h('button', { type: 'button', onclick: () => { m.close(); if (Review.isTracking()) { restoreRange(); mutate(() => Review.trackedInsert(s)); } else exec('insertText', s); } }, s)));
  m = modal('Symbol', grid, [{ label: 'Close' }], { wide: true });
}
function dateDialog() {
  const d = new Date();
  const M = d.toLocaleString('en-IN', { month: 'long' });
  const day = d.getDate(), ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
  const pad = n => String(n).padStart(2, '0');
  const fmts = [
    `${pad(day)}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, `${pad(day)}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`, `${day} ${M} ${d.getFullYear()}`, `${M} ${day}, ${d.getFullYear()}`,
    `${ord(day)} day of ${M}, ${d.getFullYear()}`, `${d.toLocaleDateString('en-IN', { weekday: 'long' })}, ${day} ${M} ${d.getFullYear()}`, `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(day)}`,
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), `${day} ${M} ${d.getFullYear()}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
  ];
  const list = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } });
  let m;
  fmts.forEach(f => list.append(h('button', { class: 'btn', type: 'button', style: { textAlign: 'left' }, onclick: () => { m.close(); if (Review.isTracking()) { restoreRange(); mutate(() => Review.trackedInsert(f)); } else exec('insertText', f); } }, f)));
  m = modal('Date and Time', list, [{ label: 'Close' }]);
}
function headerFooterDialog(focus) {
  const s = doc.settings;
  const mkEd = html => h('div', { class: 'hf-editor', contenteditable: 'true', html: html || '' });
  const eds = { header: mkEd(s.header), footer: mkEd(s.footer), firstHeader: mkEd(s.firstHeader), firstFooter: mkEd(s.firstFooter) };
  let active = eds[focus] || eds.header;
  Object.values(eds).forEach(e => e.addEventListener('focus', () => active = e));
  const tool = (label, fn) => h('button', { type: 'button', onmousedown: e => e.preventDefault(), onclick: () => { active.focus(); fn(); } }, label);
  const tools = h('div', { class: 'hf-tools' },
    tool('B', () => document.execCommand('bold')), tool('I', () => document.execCommand('italic')), tool('U', () => document.execCommand('underline')),
    tool('Left', () => document.execCommand('justifyLeft')), tool('Centre', () => document.execCommand('justifyCenter')), tool('Right', () => document.execCommand('justifyRight')),
    tool('Page #', () => document.execCommand('insertText', false, '{PAGE}')), tool('Page X of Y', () => document.execCommand('insertText', false, 'Page {PAGE} of {NUMPAGES}')),
    tool('Date', () => document.execCommand('insertText', false, new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }))),
    tool('Line', () => document.execCommand('insertHTML', false, '<hr>')),
    tool('Picture', () => { const i = h('input', { type: 'file', accept: 'image/*' }); i.onchange = () => { const f = i.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { active.focus(); document.execCommand('insertHTML', false, `<img src="${rd.result}" style="height:60px">`); }; rd.readAsDataURL(f); }; i.click(); }),
    tool('Size 9', () => { document.execCommand('styleWithCSS', false, true); document.execCommand('fontSize', false, 7); active.querySelectorAll('span[style*="xxx-large"]').forEach(x => x.style.fontSize = '9pt'); })
  );
  const diff = h('input', { type: 'checkbox' }); diff.checked = !!s.differentFirst;
  const firstBox = h('div', { class: s.differentFirst ? '' : 'hidden' }, field('First page header', eds.firstHeader), field('First page footer', eds.firstFooter));
  diff.addEventListener('change', () => firstBox.classList.toggle('hidden', !diff.checked));
  const body = h('div', null, tools, field('Header', eds.header), field('Footer', eds.footer), h('label', { class: 'fl' }, diff, ' Different first page'), firstBox,
    h('p', { class: 'note' }, '{PAGE} shows the page number and {NUMPAGES} the total. Both become live page fields in Word.'));
  modal('Header & Footer', body, [{ label: 'Cancel' }, {
    label: 'Apply', primary: true, fn: () => mutate(() => {
      const clean = e => { const v = e.innerHTML.trim(); return v === '<br>' ? '' : sanitizeHtml(v); };
      s.header = clean(eds.header); s.footer = clean(eds.footer); s.firstHeader = clean(eds.firstHeader); s.firstFooter = clean(eds.firstFooter); s.differentFirst = diff.checked;
    })
  }], { wide: true });
  setTimeout(() => active.focus(), 50);
}
function pageNumberMenu(anchor) {
  const set = (where, alignV, tpl) => mutate(() => {
    const s = doc.settings;
    const strip = html => { const d = h('div', { html: html || '' }); d.querySelectorAll('[data-pn]').forEach(x => x.remove()); return d.innerHTML; };
    s.header = strip(s.header); s.footer = strip(s.footer);
    if (!where) return;
    const p = `<p data-pn="1" style="text-align:${alignV}">${tpl}</p>`;
    s[where] = where === 'header' ? s[where] + p : p + s[where];
  });
  showMenu(anchor, [
    { header: 'Bottom of page' },
    { label: 'Plain number, left', fn: () => set('footer', 'left', '{PAGE}') }, { label: 'Plain number, centre', fn: () => set('footer', 'center', '{PAGE}') }, { label: 'Plain number, right', fn: () => set('footer', 'right', '{PAGE}') },
    { label: 'Page X of Y, centre', fn: () => set('footer', 'center', 'Page {PAGE} of {NUMPAGES}') }, { label: 'Page X of Y, right', fn: () => set('footer', 'right', 'Page {PAGE} of {NUMPAGES}') },
    { header: 'Top of page' },
    { label: 'Plain number, right', fn: () => set('header', 'right', '{PAGE}') }, { label: 'Plain number, centre', fn: () => set('header', 'center', '{PAGE}') },
    { sep: true }, { label: 'Remove Page Numbers', icon: 'X', fn: () => set(null) }
  ]);
}
function editFootnote(sup) {
  const en = sup.classList.contains('en');
  ask((en ? 'Endnote ' : 'Footnote ') + (sup.getAttribute('data-n') || ''), en ? 'Endnote text' : 'Footnote text', sup.getAttribute('data-note') || '', 'textarea').then(v => { if (v != null) mutate(() => sup.setAttribute('data-note', v)); });
}
async function insertFootnote(endnote) {
  restoreRange();
  const r = getRange(); if (!r) return;
  const saved = r.cloneRange();
  const v = await ask(endnote ? 'Insert Endnote' : 'Insert Footnote', endnote ? 'Endnote text' : 'Footnote text', '', 'textarea');
  if (v == null) return;
  lastRange = saved; restoreRange();
  mutate(() => {
    const s = getSelection(); const rr = s.getRangeAt(0); rr.collapse(false);
    const sup = h('sup', { class: endnote ? 'fn en' : 'fn', contenteditable: 'false', 'data-note': v });
    rr.insertNode(sup);
    if (Review.isTracking()) { const ins = h('ins', { class: 'tc', 'data-author': prefs.author, 'data-date': new Date().toISOString() }); sup.replaceWith(ins); ins.append(sup); }
    const nr = document.createRange(); nr.setStartAfter(sup.closest('ins.tc') || sup); nr.collapse(true); s.removeAllRanges(); s.addRange(nr);
  });
}
function headings() { return $$('h1,h2,h3,h4,h5,h6', editor).filter(el => !el.closest('.toc') && el.textContent.trim()); }
function updateTOC(insertNew) {
  const hs = headings().filter(el => +el.tagName[1] <= 3);
  const g = geom(), stride = g.ph + GAP;
  const build = toc => {
    toc.innerHTML = '';
    toc.append(h('div', { class: 'toc-title' }, 'Contents'));
    if (!hs.length) toc.append(h('div', { class: 'toc-row' }, 'No headings yet. Apply Heading 1, 2 or 3 styles, then click here to update.'));
    hs.forEach((el, i) => {
      const lvl = +el.tagName[1];
      const page = ui.view === 'print' ? Math.floor(topIn(el) / stride) + 1 : '';
      toc.append(h('div', { class: 'toc-row toc-l' + lvl, 'data-level': lvl, 'data-i': headings().indexOf(el) }, h('span', { class: 't' }, el.textContent.trim().replace(/\s+/g, ' ')), h('span', { class: 'dots' }), h('span', { class: 'p' }, String(page))));
    });
  };
  if (insertNew) {
    const toc = h('div', { class: 'toc', contenteditable: 'false', title: 'Table of Contents (click to update)' });
    build(toc);
    insertHTML(toc.outerHTML + '<p><br></p>');
    setTimeout(() => updateTOC(), 60);
    return;
  }
  const tocs = $$('.toc', editor);
  if (!tocs.length) return;
  tocs.forEach(build);
  afterChange({ noHistory: false });
}
function columnsSet(n) {
  mutate(() => {
    restoreRange();
    const blocks = selectedBlocks().map(b => { let t = b; while (t.parentNode !== editor && t.parentNode && t.parentNode !== editor) { if (t.parentNode.classList && t.parentNode.classList.contains('cols')) return t.parentNode; t = t.parentNode; } return t.parentNode === editor ? t : null; }).filter(Boolean);
    const existing = blocks.find(b => b.classList.contains('cols'));
    if (n === 1) { if (existing) Review.unwrap(existing); else toast('Select text in a multi-column section first'); return; }
    if (existing) { existing.style.columnCount = n; return; }
    let top = [...new Set(blocks)];
    if (!top.length) return;
    if (top.length === 1 && editor.children.length > 1) toast('Tip: select several paragraphs to put them in columns');
    const wrap = h('div', { class: 'cols', style: { columnCount: n } });
    editor.insertBefore(wrap, top[0]);
    top.forEach(b => wrap.append(b));
  });
}

/* ---------- tables ---------- */
function curCell() { const r = getRange(); return r && closestOf(r.startContainer, 'td,th'); }
function tableOp(op, val) {
  const cell = curCell();
  if (!cell) return toast('Place the cursor in a table first');
  const tr = cell.parentElement, table = cell.closest('table');
  const ci = [...tr.cells].indexOf(cell);
  const newCell = () => { const td = document.createElement('td'); td.innerHTML = '<p><br></p>'; return td; };
  mutate(() => {
    switch (op) {
      case 'rowAbove': case 'rowBelow': {
        const nr = document.createElement('tr');
        const cols = [...tr.cells].reduce((a, c) => a + (c.colSpan || 1), 0);
        for (let i = 0; i < cols; i++) nr.append(newCell());
        tr.parentNode.insertBefore(nr, op === 'rowAbove' ? tr : tr.nextSibling);
        break;
      }
      case 'colLeft': case 'colRight':
        [...table.rows].forEach(r => { const ref = r.cells[Math.min(ci, r.cells.length - 1)]; if (ref) r.insertBefore(newCell(), op === 'colLeft' ? ref : ref.nextSibling); else r.append(newCell()); });
        table.querySelectorAll('colgroup').forEach(c => c.remove());
        break;
      case 'delRow': tr.remove(); if (!table.rows.length) table.remove(); break;
      case 'delCol': [...table.rows].forEach(r => r.cells[ci] && r.cells[ci].remove()); table.querySelectorAll('colgroup').forEach(c => c.remove()); if (!table.querySelector('td,th')) table.remove(); break;
      case 'delTable': { const p = h('p', null, h('br')); table.replaceWith(p); break; }
      case 'merge': {
        const r = getRange();
        const cells = [...table.querySelectorAll('td,th')].filter(c => r.intersectsNode(c));
        if (cells.length < 2) return toast('Select two or more cells to merge');
        const rows = new Set(cells.map(c => c.parentElement));
        const first = cells[0];
        if (rows.size === 1) { first.colSpan = cells.reduce((a, c) => a + (c.colSpan || 1), 0); }
        else {
          const col = [...first.parentElement.cells].indexOf(first);
          if (cells.some(c => [...c.parentElement.cells].indexOf(c) !== col)) return toast('Merge cells in one row or one column');
          first.rowSpan = cells.length;
        }
        cells.slice(1).forEach(c => { if (c.textContent.trim()) [...c.childNodes].forEach(n => first.append(n)); c.remove(); });
        break;
      }
      case 'split': { const n = cell.colSpan || 1; if (n > 1) { cell.colSpan = 1; for (let i = 1; i < n; i++) cell.after(newCell()); } else toast('This cell is not merged'); break; }
      case 'borders': table.classList.toggle('nb'); if (!table.className) table.removeAttribute('class'); break;
      case 'shade': { const r = getRange(); const cells = [...table.querySelectorAll('td,th')].filter(c => r.intersectsNode(c)); (cells.length ? cells : [cell]).forEach(c => { c.style.backgroundColor = val || ''; if (!c.getAttribute('style')) c.removeAttribute('style'); }); break; }
      case 'valign': [...table.querySelectorAll('td,th')].filter(c => getRange().intersectsNode(c)).forEach(c => { c.style.verticalAlign = val; }); break;
      case 'distribute': table.querySelectorAll('colgroup').forEach(c => c.remove()); [...table.querySelectorAll('td,th')].forEach(c => c.style.removeProperty('width')); break;
      case 'header': { const first = table.rows[0]; [...first.cells].forEach(c => { const th = document.createElement(c.tagName === 'TH' ? 'td' : 'th'); th.innerHTML = c.innerHTML; [...c.attributes].forEach(a => th.setAttribute(a.name, a.value)); c.replaceWith(th); }); break; }
    }
  });
}

/* ---------- images ---------- */
let selImg = null;
function selectImage(img) {
  if (selImg && selImg !== img) { selImg.classList.remove('sel'); if (!selImg.className) selImg.removeAttribute('class'); }
  selImg = img;
  const hnd = $('#imgHandle');
  if (!img) { hnd.classList.add('hidden'); ctxTab = ctxTab === 'picture' ? null : ctxTab; renderTabs(); return; }
  img.classList.add('sel');
  placeHandle();
  if (ctxTab !== 'picture') { ctxTab = 'picture'; renderTabs(); }
}
function placeHandle() {
  const hnd = $('#imgHandle');
  if (!selImg || !selImg.isConnected) { hnd.classList.add('hidden'); return; }
  const r = selImg.getBoundingClientRect();
  Object.assign(hnd.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  hnd.classList.remove('hidden');
}
(() => {
  const knob = $('#imgHandle span');
  let start = null;
  knob.addEventListener('pointerdown', e => {
    if (!selImg) return; e.preventDefault(); knob.setPointerCapture(e.pointerId);
    start = { x: e.clientX, w: selImg.getBoundingClientRect().width, ratio: (selImg.naturalHeight || selImg.height) / (selImg.naturalWidth || selImg.width || 1) };
    History.flush();
  });
  knob.addEventListener('pointermove', e => {
    if (!start || !selImg) return;
    const z = ui.view === 'print' ? ui.zoom : 1;
    const w = Math.max(16, Math.min(geom().cw, (start.w + e.clientX - start.x) / z));
    selImg.style.width = Math.round(w) + 'px'; selImg.style.height = Math.round(w * start.ratio) + 'px';
    placeHandle();
  });
  knob.addEventListener('pointerup', () => { if (start) { start = null; afterChange(); } });
})();
$('#canvas').addEventListener('scroll', () => { if (selImg) placeHandle(); }, { passive: true });
window.addEventListener('resize', () => { if (selImg) placeHandle(); if (ui.fitWidth) applyZoom(); });
function imageOp(op, val) {
  if (!selImg) return toast('Select a picture first');
  mutate(() => {
    const img = selImg;
    if (op === 'size') { const w = Math.round(geom().cw * val); const ratio = (img.naturalHeight || img.height) / (img.naturalWidth || img.width); img.style.width = w + 'px'; img.style.height = Math.round(w * ratio) + 'px'; }
    if (op === 'reset') { img.style.width = Math.min(img.naturalWidth, geom().cw) + 'px'; img.style.height = Math.round(Math.min(img.naturalWidth, geom().cw) * img.naturalHeight / img.naturalWidth) + 'px'; }
    if (op === 'wrap') { img.classList.remove('fl', 'fr', 'ctr'); if (val) img.classList.add(val); }
    if (op === 'delete') { img.remove(); selectImage(null); }
  });
  setTimeout(placeHandle, 30);
}
function altTextDialog(img) { ask('Alt Text', 'Describe this picture', img.alt || '').then(v => { if (v != null) mutate(() => img.alt = v); }); }

/* ---------- comments & review ---------- */
async function addComment() {
  restoreRange();
  const s = getSelection();
  if (!s.rangeCount) return;
  let r = s.getRangeAt(0);
  if (r.collapsed) { s.modify('move', 'backward', 'word'); s.modify('extend', 'forward', 'word'); r = s.getRangeAt(0); }
  if (r.collapsed || !r.toString().trim()) return toast('Select the text you want to comment on');
  const saved = r.cloneRange();
  const text = await ask('New Comment', `Comment by ${prefs.author}`, '', 'textarea');
  if (!text) return;
  mutate(() => {
    const cid = 'c' + uid();
    doc.comments[cid] = { author: prefs.author, date: new Date().toISOString(), text, replies: [], resolved: false };
    Review.wrapComment(saved, cid);
  });
  showPane('commentPane', true);
}
function deleteComment(cid) { mutate(() => { Review.removeComment(cid); delete doc.comments[cid]; }); }
function renderComments() {
  const list = $('#commentList');
  const ids = Review.commentIds().filter(id => doc.comments[id]);
  list.innerHTML = '';
  if (!ids.length) { list.append(h('p', { class: 'empty-note' }, 'No comments yet. Select some text and choose New Comment (Review tab).')); return; }
  const active = Review.commentAt();
  $$('span.cmt.active', editor).forEach(e => e.classList.remove('active'));
  if (active) $$(`span.cmt[data-cid="${active}"]`, editor).forEach(e => e.classList.add('active'));
  ids.forEach(id => {
    const c = doc.comments[id];
    const anchorText = $$(`span.cmt[data-cid="${id}"]`, editor).map(e => e.textContent).join('').trim();
    const card = h('div', { class: 'card' + (id === active ? ' active' : '') + (c.resolved ? ' resolved' : '') },
      h('div', { class: 'who' }, c.author, h('span', { class: 'when' }, fmtDate(c.date))),
      h('div', { class: 'when', style: { fontStyle: 'italic' } }, '“' + anchorText.slice(0, 70) + (anchorText.length > 70 ? '…' : '') + '”'),
      h('div', { class: 'txt' }, c.text),
      ...(c.replies || []).map(rp => h('div', { class: 'reply' }, h('b', null, rp.author + ': '), rp.text)),
      h('div', { class: 'acts' },
        h('button', { onclick: ev => { ev.stopPropagation(); ask('Reply', 'Reply', '', 'textarea').then(v => { if (v) mutate(() => { c.replies = c.replies || []; c.replies.push({ author: prefs.author, text: v, date: new Date().toISOString() }); }); }); } }, 'Reply'),
        h('button', { onclick: ev => { ev.stopPropagation(); ask('Edit Comment', 'Comment', c.text, 'textarea').then(v => { if (v != null) mutate(() => c.text = v); }); } }, 'Edit'),
        h('button', { onclick: ev => { ev.stopPropagation(); mutate(() => c.resolved = !c.resolved); } }, c.resolved ? 'Reopen' : 'Resolve'),
        h('button', { onclick: ev => { ev.stopPropagation(); deleteComment(id); } }, 'Delete')));
    card.addEventListener('click', () => { const sp = $(`span.cmt[data-cid="${id}"]`, editor); if (sp) Review.selectNode(sp); });
    list.append(card);
  });
}
function renderChanges() {
  const list = $('#changeList');
  const ch = Review.changes();
  list.innerHTML = '';
  list.append(h('div', { class: 'row', style: { marginBottom: '10px' } }, h('button', { onclick: () => CMD.acceptAll() }, 'Accept All'), h('button', { onclick: () => CMD.rejectAll() }, 'Reject All')));
  if (!ch.length) { list.append(h('p', { class: 'empty-note' }, 'No revisions. Turn on Track Changes (Review tab) to record insertions and deletions.')); return; }
  ch.forEach(el => {
    const ins = el.tagName === 'INS';
    const txt = el.textContent || (el.querySelector('img') ? '[picture]' : el.querySelector('sup.fn') ? '[footnote]' : '[line break]');
    const card = h('div', { class: 'card' },
      h('div', { class: 'who' }, h('span', null, el.getAttribute('data-author') || 'Author'), h('span', { class: 'when' }, fmtDate(el.getAttribute('data-date')))),
      h('div', { class: 'txt' }, h('span', { class: ins ? 'kind-ins' : 'kind-del' }, ins ? 'Inserted: ' : 'Deleted: '), txt.slice(0, 160)),
      h('div', { class: 'acts' }, h('button', { onclick: ev => { ev.stopPropagation(); mutate(() => Review.accept(el)); } }, 'Accept'), h('button', { onclick: ev => { ev.stopPropagation(); mutate(() => Review.reject(el)); } }, 'Reject')));
    card.addEventListener('click', () => Review.selectNode(el));
    list.append(card);
  });
}
function renderNav() {
  const list = $('#navList');
  const hs = headings();
  list.innerHTML = '';
  if (!hs.length) { list.append(h('p', { class: 'empty-note' }, 'Apply Heading styles (Home tab) to build an outline of your document here.')); return; }
  hs.forEach(el => { const it = h('div', { class: 'nav-item l' + el.tagName[1], title: el.textContent }, el.textContent.trim()); it.addEventListener('click', () => { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); const r = document.createRange(); r.selectNodeContents(el); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }); list.append(it); });
}
function refreshPanes() {
  if (!$('#commentPane').classList.contains('hidden')) renderComments();
  if (!$('#changesPane').classList.contains('hidden')) renderChanges();
  if (!$('#navPane').classList.contains('hidden')) renderNav();
}
function showPane(id, on) {
  const p = $('#' + id);
  const show = on === undefined ? p.classList.contains('hidden') : on;
  if (show && innerWidth < 760) $$('.pane').forEach(x => x !== p && x.classList.add('hidden'));
  if (show && (id === 'commentPane' || id === 'changesPane')) $$('.pane.right').forEach(x => x !== p && x.classList.add('hidden'));
  if (show && (id === 'navPane' || id === 'findPane')) $$('.pane.left').forEach(x => x !== p && x.classList.add('hidden'));
  p.classList.toggle('hidden', !show);
  refreshPanes();
  if (ui.fitWidth) applyZoom();
  updateRibbonState();
}
$$('[data-close]').forEach(b => b.addEventListener('click', () => { showPane(b.dataset.close, false); if (b.dataset.close === 'findPane') clearFind(); }));
const fmtDate = d => { try { const x = new Date(d); return isNaN(x) ? '' : x.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
function setMarkup(m) { ui.markup = m; ['all', 'simple', 'none', 'original'].forEach(x => document.body.classList.toggle('markup-' + x, x === m)); schedulePaginate(); updateRibbonState(); }
function toggleTrack(on) {
  const v = on === undefined ? !Review.isTracking() : on;
  if (!v && doc.settings.restrict && doc.settings.restrict.mode === 'trackedChanges') return toast('Track Changes is locked on. Use Review › Restrict Editing to stop protection.');
  Review.setTracking(v);
  doc.settings.trackChanges = v;
  $('#stTrack').classList.toggle('hidden', !v);
  markDirty();
  toast(v ? 'Track Changes is on. Your edits are recorded as revisions.' : 'Track Changes is off');
  updateRibbonState();
}

/* ---------- find & replace ---------- */
let findMatches = [], findIdx = -1;
function buildTextIndex() {
  const nodes = []; let text = '', lastB = null;
  const w = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement.closest('.toc') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  let n;
  while ((n = w.nextNode())) { const b = closestBlock(n); if (b !== lastB && text) text += '\n'; lastB = b; nodes.push({ n, s: text.length }); text += n.data; }
  return { text, nodes };
}
function rangeAt(idx, s, e) {
  const find = pos => { let lo = 0, hi = idx.nodes.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (idx.nodes[mid].s <= pos) lo = mid; else hi = mid - 1; } return idx.nodes[lo]; };
  const a = find(s), b = find(e - 1);
  const r = document.createRange();
  r.setStart(a.n, Math.min(a.n.length, s - a.s)); r.setEnd(b.n, Math.min(b.n.length, e - b.s));
  return r;
}
function runFind(keepIdx) {
  const q = $('#findInput').value;
  findMatches = [];
  if (!q) { clearFind(); $('#findInfo').textContent = ''; return; }
  const idx = buildTextIndex();
  const reS = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp($('#findWhole').checked ? `(?<![\\p{L}\\p{N}_])${reS}(?![\\p{L}\\p{N}_])` : reS, 'gu' + ($('#findCase').checked ? '' : 'i'));
  let m;
  while ((m = re.exec(idx.text))) { if (!m[0].length) { re.lastIndex++; continue; } findMatches.push(rangeAt(idx, m.index, m.index + m[0].length)); if (findMatches.length > 5000) break; }
  if (!keepIdx) findIdx = findMatches.length ? 0 : -1;
  else findIdx = Math.min(findIdx, findMatches.length - 1);
  paintFind();
}
function paintFind() {
  if (window.CSS && CSS.highlights) {
    CSS.highlights.set('find-all', new Highlight(...findMatches));
    if (findIdx >= 0) CSS.highlights.set('find-cur', new Highlight(findMatches[findIdx])); else CSS.highlights.delete('find-cur');
  }
  $('#findInfo').textContent = findMatches.length ? `Result ${findIdx + 1} of ${findMatches.length}` : 'No results';
  if (findIdx >= 0) { const r = findMatches[findIdx]; const el = r.startContainer.parentElement; el && el.scrollIntoView({ block: 'center' }); }
}
function clearFind() { if (window.CSS && CSS.highlights) { CSS.highlights.delete('find-all'); CSS.highlights.delete('find-cur'); } findMatches = []; }
function findStep(d) { if (!findMatches.length) runFind(); if (!findMatches.length) return; findIdx = (findIdx + d + findMatches.length) % findMatches.length; paintFind(); }
function replaceOne(r, text) {
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  if (Review.isTracking()) Review.trackedInsert(text);
  else { r.deleteContents(); if (text) { const t = document.createTextNode(text); r.insertNode(t); } }
}
$('#findInput').addEventListener('input', () => runFind());
$('#findInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); findStep(e.shiftKey ? -1 : 1); } });
['findCase', 'findWhole'].forEach(id => $('#' + id).addEventListener('change', () => runFind()));
$$('[data-find]').forEach(b => b.addEventListener('click', () => {
  const a = b.dataset.find;
  if (a === 'next') findStep(1);
  if (a === 'prev') findStep(-1);
  if (a === 'replace') { if (findIdx < 0) runFind(); if (findIdx >= 0) { mutate(() => replaceOne(findMatches[findIdx], $('#replaceInput').value)); runFind(true); } }
  if (a === 'all') {
    runFind();
    const n = findMatches.length; if (!n) return;
    mutate(() => { for (let i = findMatches.length - 1; i >= 0; i--) replaceOne(findMatches[i], $('#replaceInput').value); });
    runFind(); $('#findInfo').textContent = `Replaced ${n} occurrence${n > 1 ? 's' : ''}`;
  }
}));

/* ---------- dictation ---------- */
let rec = null;
function toggleDictate() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast('Dictation is not supported in this browser');
  if (rec) { rec.stop(); rec = null; updateRibbonState(); return; }
  rec = new SR(); rec.lang = prefs.lang || 'en-IN'; rec.continuous = true; rec.interimResults = false;
  rec.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) { const t = e.results[i][0].transcript; const r = getRange(); const needSpace = r && r.startContainer.nodeType === 3 && /\S$/.test(r.startContainer.data.slice(0, r.startOffset)); const txt = (needSpace ? ' ' : '') + t.trim(); if (Review.isTracking()) { restoreRange(); mutate(() => Review.trackedInsert(txt)); } else exec('insertText', txt); } };
  rec.onend = () => { rec = null; updateRibbonState(); };
  rec.onerror = e => toast('Dictation: ' + e.error);
  rec.start(); toast('Listening… speak now');
  updateRibbonState();
}

/* ---------- word count & status ---------- */
function docText() {
  let t = '';
  const w = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: n => n.nodeType === 1 ? ((n.matches('del.tc') || n.classList.contains('toc')) ? NodeFilter.FILTER_REJECT : (/^(P|H\d|LI|TD|TH|BR|DIV)$/.test(n.tagName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP)) : NodeFilter.FILTER_ACCEPT });
  let n; while ((n = w.nextNode())) t += n.nodeType === 3 ? n.data : ' ';
  return t.replace(/​/g, '');
}
const countWords = t => (t.match(/[^\s​]+/g) || []).length;
let wordTotal = 0;
function updateWordCount() {
  wordTotal = countWords(docText());
  updateStatus();
}
function updateStatus() {
  const s = getSelection();
  let sel = '';
  if (s.rangeCount && !s.isCollapsed && editor.contains(s.anchorNode)) sel = s.toString();
  $('#stWords').textContent = sel ? `${countWords(sel)} of ${wordTotal} words` : `${wordTotal.toLocaleString('en-IN')} word${wordTotal === 1 ? '' : 's'}`;
  let page = 1;
  if (ui.view === 'print') {
    const r = getRange();
    if (r) {
      let rect = r.getBoundingClientRect();
      if (!rect.height) { const b = closestBlock(r.startContainer) || r.startContainer.parentElement; rect = b && b.getBoundingClientRect ? b.getBoundingClientRect() : rect; }
      const pr = $('#pages').getBoundingClientRect();
      page = Math.max(1, Math.min(ui.pages, Math.floor((rect.top - pr.top) / ui.zoom / (geom().ph + GAP)) + 1));
    }
  }
  $('#stPage').textContent = ui.view === 'print' ? `Page ${page} of ${ui.pages}` : `${ui.pages} page${ui.pages > 1 ? 's' : ''}`;
}
function wordCountDialog() {
  const t = docText();
  const paras = $$('p,h1,h2,h3,h4,h5,h6,li', editor).filter(p => p.textContent.trim()).length;
  const rows = [['Pages', ui.pages], ['Words', countWords(t)], ['Characters (no spaces)', t.replace(/\s/g, '').length], ['Characters (with spaces)', t.replace(/\s+/g, ' ').trim().length], ['Paragraphs', paras], ['Comments', Review.commentIds().length], ['Revisions', Review.changes().length]];
  modal('Word Count', h('table', { style: { width: '100%', borderCollapse: 'collapse' } }, ...rows.map(([a, b]) => h('tr', null, h('td', { style: { padding: '6px 0' } }, a), h('td', { style: { textAlign: 'right', fontWeight: '600' } }, Number(b).toLocaleString('en-IN'))))), [{ label: 'Close', primary: true }]);
}

/* ---------- paragraph & page dialogs ---------- */
function paragraphDialog() {
  restoreRange();
  const b = selectedBlocks()[0];
  if (!b) return;
  const saved = getRange() && getRange().cloneRange();
  const cs = getComputedStyle(b);
  const al = h('select', null, ...['left', 'center', 'right', 'justify'].map(v => h('option', { value: v, selected: cs.textAlign === v || (v === 'left' && cs.textAlign === 'start') }, v[0].toUpperCase() + v.slice(1))));
  const inL = h('input', { type: 'number', step: '0.1', value: ((parseFloat(b.style.marginLeft) || 0) / 96).toFixed(2) });
  const inR = h('input', { type: 'number', step: '0.1', value: ((parseFloat(b.style.marginRight) || 0) / 96).toFixed(2) });
  const ti = parseFloat(b.style.textIndent) || 0;
  const sp = h('select', null, h('option', { value: 'none' }, '(none)'), h('option', { value: 'first', selected: ti > 0 }, 'First line'), h('option', { value: 'hang', selected: ti < 0 }, 'Hanging'));
  const by = h('input', { type: 'number', step: '0.1', value: (Math.abs(ti) / 96 || 0.5).toFixed(2) });
  const bef = h('input', { type: 'number', step: '1', value: Math.round(parseFloat(cs.marginTop) * 0.75) });
  const aft = h('input', { type: 'number', step: '1', value: Math.round(parseFloat(cs.marginBottom) * 0.75) });
  const ls = h('select', null, ...[['1', 'Single'], ['1.15', '1.15'], ['1.5', '1.5 lines'], ['2', 'Double'], ['2.5', '2.5'], ['3', 'Triple']].map(([v, l]) => h('option', { value: v, selected: String(b.style.lineHeight) === v }, l)));
  modal('Paragraph', h('div', null, field('Alignment', al), h('div', { class: 'g2' }, field('Indent left (inches)', inL), field('Indent right (inches)', inR), field('Special', sp), field('By (inches)', by), field('Spacing before (pt)', bef), field('Spacing after (pt)', aft)), field('Line spacing', ls)), [{ label: 'Cancel' }, {
    label: 'OK', primary: true, fn: () => { lastRange = saved; const v = { align: al.value, left: parseFloat(inL.value) || 0, right: parseFloat(inR.value) || 0, special: sp.value, by: parseFloat(by.value) || 0, before: +bef.value || 0, after: +aft.value || 0, line: ls.value }; rememberLast('para', v); applyPara(v); }
  }]);
}
function applyPara(v) {
  blockStyle(el => {
    el.style.textAlign = v.align;
    el.style.marginLeft = v.left ? v.left * 96 + 'px' : ''; el.style.marginRight = v.right ? v.right * 96 + 'px' : '';
    el.style.textIndent = v.special === 'none' ? '' : (v.special === 'hang' ? -v.by : v.by) * 96 + 'px';
    if (v.special === 'hang' && !v.left) el.style.marginLeft = v.by * 96 + 'px';
    el.style.marginTop = v.before + 'pt'; el.style.marginBottom = v.after + 'pt';
    el.style.lineHeight = v.line;
  });
}
function marginsDialog() { return marginsDialog2(); }
function marginsDialogOld() {
  const m = doc.settings.margins;
  const ins = ['top', 'bottom', 'left', 'right'].map(k => [k, h('input', { type: 'number', step: '0.05', min: '0', value: m[k] })]);
  modal('Custom Margins (inches)', h('div', { class: 'g2' }, ...ins.map(([k, i]) => field(k[0].toUpperCase() + k.slice(1), i))), [{ label: 'Cancel' }, { label: 'OK', primary: true, fn: () => setPage({ margins: Object.fromEntries(ins.map(([k, i]) => [k, Math.max(0, Math.min(4, parseFloat(i.value) || 0))])) }) }]);
}
function setPage(patch) { mutate(() => Object.assign(doc.settings, patch)); applyZoom(); }
function zoomDialog() {
  const sel = h('select', null, ...[50, 75, 100, 125, 150, 200, 300].map(v => h('option', { value: v, selected: Math.round(ui.zoom * 100) === v }, v + '%')));
  modal('Zoom', field('Zoom to', sel), [{ label: 'Page width', fn: () => setZoom('width') }, { label: 'Whole page', fn: () => setZoom('page') }, { label: 'OK', primary: true, fn: () => setZoom(+sel.value / 100) }]);
}
function setZoom(z) {
  if (ui.view !== 'print') setView('print');
  ui.fitWidth = z === 'width';
  if (z === 'page') { const c = $('#canvas'); z = Math.min((c.clientHeight - 40) / geom().ph, (c.clientWidth - 40) / geom().pw); }
  if (typeof z === 'number') ui.zoom = Math.max(0.25, Math.min(3, z));
  prefs.zoom = ui.fitWidth ? 'width' : ui.zoom; savePrefs();
  applyZoom();
  if (selImg) placeHandle();
}
function setView(v) {
  ui.view = v === 'read' || v === 'web' || v === 'focus' ? (v === 'focus' ? 'print' : 'web') : 'print';
  document.body.classList.toggle('web', v === 'web' || v === 'read');
  document.body.classList.toggle('read', v === 'read');
  document.body.classList.toggle('focus', v === 'focus');
  $$('.exit-mode').forEach(e => e.remove());
  if (v === 'read' || v === 'focus') document.body.append(h('button', { class: 'exit-mode', onclick: () => setView('print') }, v === 'read' ? 'Exit Read Mode' : 'Exit Focus'));
  editor.contentEditable = v === 'read' || ui.readonly ? 'false' : 'true';
  paginate(); applyZoom(); updateStatus(); updateRibbonState();
}

/* ---------- table column / row resizing (drag the cell borders, like Word) ---------- */
(() => {
  const EDGE = 6;
  let drag = null;
  const gridCount = t => Math.max(...[...t.rows].filter(r => !r.classList.contains('pg-sp')).map(r => [...r.cells].reduce((a, c) => a + (c.colSpan || 1), 0)), 1);
  function ensureCols(table) {
    const n = gridCount(table);
    let cg = table.querySelector(':scope > colgroup');
    const ref = [...table.rows].find(r => !r.classList.contains('pg-sp') && r.cells.length === n);
    let widths;
    if (cg && cg.children.length === n) widths = [...cg.children].map(c => c.getBoundingClientRect().width / (ui.view === 'print' ? ui.zoom : 1));
    else if (ref) widths = [...ref.cells].map(c => c.offsetWidth);
    else widths = new Array(n).fill(table.offsetWidth / n);
    if (!cg || cg.children.length !== n) { if (cg) cg.remove(); cg = document.createElement('colgroup'); for (let i = 0; i < n; i++) cg.append(document.createElement('col')); table.insertBefore(cg, table.firstChild); }
    [...cg.children].forEach((c, i) => c.style.width = widths[i] + 'px');
    return { cols: [...cg.children], widths };
  }
  function hit(e) {
    const td = e.target.closest && e.target.closest('td,th');
    if (!td || !editor.contains(td) || td.parentElement.classList.contains('pg-sp') || ui.readonly) return null;
    const r = td.getBoundingClientRect();
    const tol = EDGE * (e.pointerType === 'touch' ? 2.5 : 1);
    if (Math.abs(r.right - e.clientX) <= tol) return { td, kind: 'col' };
    if (Math.abs(r.bottom - e.clientY) <= tol) return { td, kind: 'row' };
    return null;
  }
  editor.addEventListener('pointermove', e => {
    if (drag) return;
    const hh = hit(e);
    editor.style.cursor = hh ? (hh.kind === 'col' ? 'col-resize' : 'row-resize') : '';
  });
  editor.addEventListener('pointerdown', e => {
    const hh = hit(e);
    if (!hh || e.button > 0) return;
    e.preventDefault(); e.stopPropagation();
    History.flush();
    const table = hh.td.closest('table'), z = ui.view === 'print' ? ui.zoom : 1;
    if (hh.kind === 'col') {
      const row = hh.td.parentElement;
      let idx = -1; for (const c of row.cells) { idx += c.colSpan || 1; if (c === hh.td) break; }
      const { cols, widths } = ensureCols(table);
      drag = { kind: 'col', table, cols, widths, idx, x: e.clientX, z, tw: table.offsetWidth, last: idx === cols.length - 1 };
    } else {
      const tr = hh.td.parentElement;
      drag = { kind: 'row', tr, y: e.clientY, z, h: tr.offsetHeight };
    }
    editor.setPointerCapture(e.pointerId);
    document.body.style.cursor = editor.style.cursor;
  }, true);
  editor.addEventListener('pointermove', e => {
    if (!drag) return;
    e.preventDefault();
    if (drag.kind === 'col') {
      const d = (e.clientX - drag.x) / drag.z, i = drag.idx, w = drag.widths;
      if (drag.last) {
        const nw = Math.max(24, w[i] + d);
        drag.cols[i].style.width = nw + 'px';
        drag.table.style.width = Math.min(geom().cw * 1.25, drag.tw - w[i] + nw) + 'px';
      } else {
        const a = Math.max(24, Math.min(w[i] + w[i + 1] - 24, w[i] + d));
        drag.cols[i].style.width = a + 'px';
        drag.cols[i + 1].style.width = (w[i] + w[i + 1] - a) + 'px';
      }
    } else {
      const nh = Math.max(16, drag.h + (e.clientY - drag.y) / drag.z);
      [...drag.tr.cells].forEach(c => c.style.height = Math.round(nh) + 'px');
    }
  });
  const end = () => {
    if (!drag) return;
    if (drag.kind === 'col') {
      // store widths as percentages so the table keeps its shape on any page size
      const ws = drag.cols.map(c => parseFloat(c.style.width) || 0), tot = ws.reduce((a, b) => a + b, 0) || 1;
      drag.cols.forEach((c, k) => c.style.width = (ws[k] / tot * 100).toFixed(2) + '%');
      if (!drag.last) drag.table.style.removeProperty('width');
      if (!drag.table.getAttribute('style')) drag.table.removeAttribute('style');
    }
    drag = null; document.body.style.cursor = ''; editor.style.cursor = '';
    afterChange();
  };
  editor.addEventListener('pointerup', end);
  editor.addEventListener('pointercancel', end);
})();
