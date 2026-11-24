/* DraftLy: layout and editing extras (last custom settings, borders, sort, paste options,
   cover/blank page, text boxes, drop caps, line numbers, outline view, split view) */

/* ---------- remembered custom settings ---------- */
prefs.last = prefs.last || {};
prefs.recentColors = prefs.recentColors || [];
function rememberLast(key, val) { prefs.last[key] = val; savePrefs(); }
function addRecentColor(c) {
  if (!c) return;
  c = c.toUpperCase();
  prefs.recentColors = [c, ...prefs.recentColors.filter(x => x !== c)].slice(0, 10);
  savePrefs();
}
const fmtIn = v => (Math.round(v * 100) / 100) + '"';

/* ---------- page size ---------- */
function customSizeDialog() {
  const g = geom();
  const w = h('input', { type: 'number', step: '0.01', min: '2', max: '22', value: ((doc.settings.pageSize === 'Custom' ? doc.settings.pageW : g.pw / 96)).toFixed(2) });
  const ht = h('input', { type: 'number', step: '0.01', min: '2', max: '22', value: ((doc.settings.pageSize === 'Custom' ? doc.settings.pageH : g.ph / 96)).toFixed(2) });
  modal('Custom Paper Size (inches)', h('div', { class: 'g2' }, field('Width', w), field('Height', ht)), [{ label: 'Cancel' }, {
    label: 'OK', primary: true, fn: () => {
      const W = Math.max(2, Math.min(22, parseFloat(w.value) || 8.27)), H = Math.max(2, Math.min(22, parseFloat(ht.value) || 11.69));
      rememberLast('size', { w: W, h: H });
      setPage({ pageSize: 'Custom', pageW: W, pageH: H, orientation: 'portrait' });
    }
  }]);
}
function marginsDialog2() {
  const m = doc.settings.margins;
  const ins = ['top', 'bottom', 'left', 'right'].map(k => [k, h('input', { type: 'number', step: '0.05', min: '0', value: m[k] })]);
  const read = () => Object.fromEntries(ins.map(([k, i]) => [k, Math.max(0, Math.min(4, parseFloat(i.value) || 0))]));
  modal('Custom Margins (inches)', h('div', { class: 'g2' }, ...ins.map(([k, i]) => field(k[0].toUpperCase() + k.slice(1), i))), [
    { label: 'Set As Default', fn: () => { const mm = read(); prefs.defaultPage = Object.assign({}, prefs.defaultPage || {}, { margins: mm, pageSize: doc.settings.pageSize, pageW: doc.settings.pageW, pageH: doc.settings.pageH, orientation: doc.settings.orientation }); savePrefs(); rememberLast('margins', mm); setPage({ margins: mm }); toast('New documents will use these margins and this paper size'); } },
    { label: 'Cancel' },
    { label: 'OK', primary: true, fn: () => { const mm = read(); rememberLast('margins', mm); setPage({ margins: mm }); } }]);
}
function columnsDialog() {
  const n = h('input', { type: 'number', min: '1', max: '6', value: (prefs.last.columns && prefs.last.columns.n) || 2 });
  const gap = h('input', { type: 'number', min: '0', step: '0.05', value: (prefs.last.columns && prefs.last.columns.gap) || 0.5 });
  const line = h('input', { type: 'checkbox' }); line.checked = !!(prefs.last.columns && prefs.last.columns.line);
  modal('Columns', h('div', null, h('div', { class: 'g2' }, field('Number of columns', n), field('Spacing (inches)', gap)), h('label', { class: 'fl' }, line, ' Line between columns'), h('p', { class: 'note' }, 'Applies to the selected paragraphs.')), [{ label: 'Cancel' }, {
    label: 'OK', primary: true, fn: () => { const c = { n: Math.max(1, Math.min(6, parseInt(n.value) || 2)), gap: parseFloat(gap.value) || 0.5, line: line.checked }; rememberLast('columns', c); applyColumns(c); }
  }]);
}
function applyColumns(c) {
  columnsSet(c.n);
  const r = getRange(); const wrap = r && closestOf(r.startContainer, '.cols');
  if (wrap) mutate(() => { wrap.style.columnGap = c.gap + 'in'; wrap.style.columnRule = c.line ? '0.75pt solid #000' : ''; });
}

/* ---------- paragraph & page borders ---------- */
const BORDER = '0.75pt solid #000000';
function paraBorders(kind) {
  blockStyle(b => {
    const set = (side, on) => { if (on) b.style['border' + side] = BORDER; else b.style['border' + side] = ''; };
    if (kind === 'none') { ['Top', 'Bottom', 'Left', 'Right'].forEach(s => set(s, false)); b.style.padding = ''; }
    else if (kind === 'box') { ['Top', 'Bottom', 'Left', 'Right'].forEach(s => set(s, true)); b.style.padding = '1pt 4pt'; }
    else { const s = kind[0].toUpperCase() + kind.slice(1); set(s, !b.style['border' + s]); }
    if (!b.getAttribute('style')) b.removeAttribute('style');
  });
}
function pageBorderDialog() {
  const pb = doc.settings.pageBorder || prefs.last.pageBorder || { style: 'single', width: 1, color: '#000000' };
  const st = h('select', null, ...[['none', 'None'], ['single', 'Single line'], ['double', 'Double line'], ['thick', 'Thick line'], ['dotted', 'Dotted'], ['dashed', 'Dashed']].map(([v, l]) => h('option', { value: v, selected: (doc.settings.pageBorder ? pb.style : 'single') === v }, l)));
  const wd = h('select', null, ...[0.5, 0.75, 1, 1.5, 2.25, 3, 4.5, 6].map(v => h('option', { value: v, selected: +pb.width === v }, v + ' pt')));
  const col = h('input', { type: 'color', value: pb.color || '#000000', style: { height: '32px', width: '100%' } });
  modal('Page Border', h('div', null, field('Style', st), h('div', { class: 'g2' }, field('Width', wd), field('Colour', col))), [{ label: 'Cancel' }, {
    label: 'OK', primary: true, fn: () => {
      const v = st.value === 'none' ? null : { style: st.value, width: parseFloat(wd.value), color: col.value };
      if (v) rememberLast('pageBorder', v);
      setPage({ pageBorder: v });
    }
  }]);
}

/* ---------- sort paragraphs ---------- */
function sortParagraphs(dir, numeric) {
  const blocks = selectedBlocks().filter(b => b.parentNode && (b.parentNode === editor || b.tagName === 'LI'));
  if (blocks.length < 2) return toast('Select two or more paragraphs or list items to sort');
  const parent = blocks[0].parentNode;
  if (blocks.some(b => b.parentNode !== parent)) return toast('Select paragraphs at the same level to sort');
  mutate(() => {
    const anchor = blocks[blocks.length - 1].nextSibling;
    const key = b => b.textContent.trim();
    const cmp = numeric ? (a, b) => (parseFloat(key(a).replace(/[^\d.-]/g, '')) || 0) - (parseFloat(key(b).replace(/[^\d.-]/g, '')) || 0) : (a, b) => key(a).localeCompare(key(b), 'en-IN', { numeric: true, sensitivity: 'base' });
    blocks.sort((a, b) => cmp(a, b) * dir).forEach(b => parent.insertBefore(b, anchor));
  });
}

/* ---------- paste options ---------- */
function mergeFormatting(html) {
  const d = new DOMParser().parseFromString(sanitizeHtml(html, true), 'text/html').body;
  d.querySelectorAll('[style]').forEach(el => {
    ['font-family', 'font-size', 'color', 'background-color', 'line-height', 'margin-top', 'margin-bottom'].forEach(p => el.style.removeProperty(p));
    if (!el.getAttribute('style')) el.removeAttribute('style');
  });
  d.querySelectorAll('[class]').forEach(el => { [...el.classList].filter(c => c.startsWith('s-')).forEach(c => el.classList.remove(c)); if (!el.className) el.removeAttribute('class'); });
  d.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(hd => { const p = document.createElement('p'); p.innerHTML = '<b>' + hd.innerHTML + '</b>'; hd.replaceWith(p); });
  return d.innerHTML;
}
async function pasteAs(mode) {
  restoreRange();
  try {
    let html = '', text = '';
    if (navigator.clipboard.read) {
      for (const it of await navigator.clipboard.read()) {
        if (it.types.includes('text/html')) html = await (await it.getType('text/html')).text();
        if (it.types.includes('text/plain')) text = await (await it.getType('text/plain')).text();
      }
    } else text = await navigator.clipboard.readText();
    restoreRange();
    if (Review.isTracking()) return mutate(() => Review.trackedInsert(text));
    History.record();
    insertPasted(mode, html, text);
    afterChange();
  } catch (e) { toast(`Use ${IS_MAC ? '⌘' : 'Ctrl'}+V to paste (${IS_MAC ? '⌘⇧V' : 'Ctrl+Shift+V'} for text only)`); }
}
/* the small "Paste Options" button Word shows after a paste */
let pasteChip = null;
function hidePasteOptions() { if (pasteChip) { pasteChip.remove(); pasteChip = null; } }
function showPasteOptions(html, text, mode) {
  hidePasteOptions();
  const r = getRange(); if (!r) return;
  const rc = r.getBoundingClientRect(); if (!rc || (!rc.top && !rc.left)) return;
  const opt = (m, ic, t) => { const b = h('button', { type: 'button', title: t, class: m === mode ? 'on' : '', html: icon(ic) }); b.addEventListener('mousedown', e => e.preventDefault()); b.addEventListener('click', () => { History.undo(); insertPasted(m, html, text); afterChange(); mode = m; [...pasteChip.querySelectorAll('button')].forEach(x => x.classList.toggle('on', x === b)); }); return b; };
  pasteChip = h('div', { class: 'paste-chip' }, h('span', null, 'Paste:'), opt('keep', 'Paintbrush', 'Keep Source Formatting'), opt('merge', 'Merge', 'Merge Formatting'), opt('text', 'Type', 'Keep Text Only'),
    h('button', { type: 'button', class: 'pc-def', title: 'Make the selected option the default when you paste', onclick: () => { prefs.pasteMode = mode === 'text' ? 'keep' : mode; savePrefs(); toast('Default paste: ' + ({ keep: 'Keep Source Formatting', merge: 'Merge Formatting' }[prefs.pasteMode])); hidePasteOptions(); } }, 'Set Default'));
  pasteChip.style.left = Math.min(innerWidth - 260, Math.max(8, rc.left)) + 'px';
  pasteChip.style.top = Math.min(innerHeight - 50, rc.bottom + 8) + 'px';
  document.body.append(pasteChip);
  const off = e => { if (pasteChip && pasteChip.contains(e.target)) return; hidePasteOptions(); document.removeEventListener('keydown', off, true); document.removeEventListener('pointerdown', off, true); };
  setTimeout(() => { document.addEventListener('keydown', off, true); document.addEventListener('pointerdown', off, true); }, 0);
  $('#canvas').addEventListener('scroll', hidePasteOptions, { once: true });
}

/* ---------- cover page & blank page ---------- */
const COVERS = {
  court: { name: 'Court Filing', html: () => `<div class="cover"><p style="text-align:center"><b>IN THE [NAME OF THE COURT]</b></p><p style="text-align:center"><b>AT BENGALURU</b></p><p><br></p><p style="text-align:center"><b>[CASE TYPE] No. ____ / ${YEAR}</b></p><p><br></p><p style="text-align:center"><b>BETWEEN:</b></p><p>[Name of Petitioner / Plaintiff]<br>[Address]</p><p style="text-align:right"><b>... PETITIONER / PLAINTIFF</b></p><p style="text-align:center"><b>AND:</b></p><p>[Name of Respondent / Defendant]<br>[Address]</p><p style="text-align:right"><b>... RESPONDENT / DEFENDANT</b></p><p><br></p><p style="text-align:center"><b><u>[TITLE OF THE DOCUMENT]</u></b></p><p><br></p><p><br></p><p style="text-align:right">Filed by:<br><b>ANIRUDH K H</b><br>Advocate for the [Petitioner / Plaintiff]</p></div>` },
  report: { name: 'Report', html: () => `<div class="cover"><p><br></p><p><br></p><p class="s-Title" style="text-align:left">[Report Title]</p><p class="s-Subtitle">[Subtitle]</p><p><br></p><p>Prepared for: [Client]</p><p>Prepared by: Anirudh K H, Advocate &amp; Consultant</p><p>Date: [Date]</p><p>Ref: [Reference No.]</p></div>` },
  agreement: { name: 'Agreement', html: () => `<div class="cover"><p><br></p><p><br></p><p><br></p><h1 style="text-align:center">[TITLE OF AGREEMENT]</h1><p style="text-align:center"><br></p><p style="text-align:center"><b>BETWEEN</b></p><p style="text-align:center">[FIRST PARTY]</p><p style="text-align:center"><b>AND</b></p><p style="text-align:center">[SECOND PARTY]</p><p><br></p><p style="text-align:center">Dated: [Date]</p></div>` },
  simple: { name: 'Simple Title', html: () => `<div class="cover"><p><br></p><p><br></p><p><br></p><p><br></p><p class="s-Title" style="text-align:center">[Document Title]</p><p class="s-Subtitle" style="text-align:center">[Subtitle]</p><p style="text-align:center">[Author] | [Date]</p></div>` }
};
function insertCover(key) {
  mutate(() => {
    const old = $('.cover', editor);
    if (old) { const nx = old.nextElementSibling; old.remove(); if (nx && nx.matches('hr.pb')) nx.remove(); }
    if (!key) return;
    const tmp = document.createElement('div'); tmp.innerHTML = COVERS[key].html() + '<hr class="pb">';
    const first = editor.firstChild;
    [...tmp.childNodes].forEach(n => editor.insertBefore(n, first));
  });
  $('#canvas').scrollTop = 0;
}
function insertBlankPage() { insertHTML('<hr class="pb"><p><br></p><hr class="pb"><p><br></p>'); }

/* ---------- text boxes ---------- */
function insertTextBox(kind) {
  const cls = { simple: 'textbox', right: 'textbox tb-right', left: 'textbox tb-left', quote: 'textbox tb-quote' }[kind] || 'textbox';
  const txt = kind === 'quote' ? '[“Type a quote from the document to draw attention to a key point.”]' : '[Type text here]';
  restoreRange();
  const r = getRange();
  let top = r && r.startContainer; while (top && top.parentNode !== editor) top = top.parentNode;
  if (!top || top === editor) return insertHTML(`<div class="${cls}"><p>${txt}</p></div><p><br></p>`);
  mutate(() => {
    const box = h('div', { class: cls }, h('p', null, txt));
    const empty = top.tagName === 'P' && !top.textContent.trim() && !top.querySelector('img');
    // side boxes float beside the current paragraph; others go after it
    if (empty) top.replaceWith(box); else if (/tb-(right|left)/.test(cls)) editor.insertBefore(box, top); else top.after(box);
    if (!box.nextElementSibling) box.after(h('p', null, h('br')));
    const rg = document.createRange(); rg.selectNodeContents(box.firstChild); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(rg);
  });
}

/* ---------- drop cap ---------- */
function dropCap(kind) {
  const b = selectedBlocks()[0];
  if (!b || b.tagName !== 'P') return toast('Place the cursor in a paragraph');
  mutate(() => {
    const ex = b.querySelector('span.dropcap');
    if (ex) Review.unwrap(ex);
    if (kind === 'none') return;
    const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    let t; while ((t = w.nextNode()) && !t.data.trim()) { }
    if (!t) return;
    const i = t.data.search(/\S/);
    const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 1);
    const sp = document.createElement('span'); sp.className = 'dropcap' + (kind === 'margin' ? ' dc-margin' : '');
    r.surroundContents(sp);
  });
}

/* ---------- line numbers ---------- */
function setLineNumbers(mode) { setPage({ lineNumbers: mode === 'none' ? null : { restart: mode } }); }
function renderLineNumbers() {
  $$('#sheets .lnwrap').forEach(e => e.remove());
  const ln = doc && doc.settings.lineNumbers;
  if (!ln || ui.view !== 'print') return;
  const g = geom(), stride = g.ph + (ui.printing ? 0 : GAP);
  const pr = $('#pages').getBoundingClientRect(), z = ui.printing ? 1 : ui.zoom;
  const tops = [];
  const w = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement.closest('table,.toc,.cover,del.tc') || !n.data.trim() ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const rg = document.createRange(); let n;
  while ((n = w.nextNode())) { rg.selectNodeContents(n); for (const r of rg.getClientRects()) if (r.width) tops.push({ y: (r.top - pr.top) / z, h: r.height / z }); }
  tops.sort((a, b) => a.y - b.y);
  const lines = [];
  for (const t of tops) { const last = lines[lines.length - 1]; if (!last || t.y > last.y + last.h * 0.6) lines.push(t); }
  const sheets = $$('#sheets .sheet');
  let count = 0, curPage = -1;
  const wraps = {};
  for (const l of lines) {
    const p = Math.floor(l.y / stride);
    if (p !== curPage) { curPage = p; if (ln.restart === 'page') count = 0; }
    count++;
    const sh = sheets[p]; if (!sh) continue;
    let wr = wraps[p]; if (!wr) { wr = wraps[p] = h('div', { class: 'lnwrap' }); sh.append(wr); }
    wr.append(h('span', { class: 'lnum', style: { top: (l.y - p * stride) + 'px', height: l.h + 'px', lineHeight: l.h + 'px', left: Math.max(4, g.ml - 40) + 'px' } }, String(count)));
  }
}

/* ---------- outline view ---------- */
let outlineLevel = 9;
function outlineMark() {
  let level = 0;
  for (const el of editor.children) {
    const m = el.tagName.match(/^H([1-6])$/);
    if (m) level = +m[1];
    el.setAttribute('data-olv', m ? m[1] : 'b');
    el.setAttribute('data-oli', m ? +m[1] - 1 : level);
    el.classList.toggle('olhide', outlineLevel < 9 && (!m || +m[1] > outlineLevel));
  }
}
function outlineClear() { editor.querySelectorAll('[data-olv]').forEach(e => { e.removeAttribute('data-olv'); e.classList.remove('olhide'); if (!e.className) e.removeAttribute('class'); }); }
function showOutline(on) {
  if (on) { if (!$('#splitPane').classList.contains('hidden')) toggleSplit(); setView('web'); document.body.classList.add('outline'); currentTab = 'outlining'; outlineMark(); }
  else { document.body.classList.remove('outline'); outlineClear(); outlineLevel = 9; setView('print'); currentTab = 'home'; }
  renderTabs(); renderRibbon();
}
function outlineShowLevel(n) { outlineLevel = n; outlineMark(); }
function outlinePromote(dir) {
  const b = selectedBlocks()[0]; if (!b) return;
  const m = b.tagName.match(/^H([1-6])$/);
  if (dir === 'body') { if (m) applyStyle('Normal'); }
  else if (m) { const nl = Math.max(1, Math.min(6, +m[1] + dir)); applyStyle('Heading ' + nl); }
  else if (dir < 0) applyStyle('Heading 1');
  else applyStyle('Heading 2');
  outlineMark();
}

/* ---------- split view ---------- */
let splitTimer = null;
function renderSplit() {
  const box = $('#splitDoc'); if (!box || $('#splitPane').classList.contains('hidden')) return;
  const st = box.parentElement.scrollTop;
  box.innerHTML = cleanHTML();
  box.querySelectorAll('[contenteditable]').forEach(e => e.removeAttribute('contenteditable'));
  box.parentElement.scrollTop = st;
}
function toggleSplit() {
  const p = $('#splitPane');
  const on = p.classList.contains('hidden');
  p.classList.toggle('hidden', !on);
  if (on) { renderSplit(); toast('Split view: scroll the right side to read another part while you edit'); }
  if (ui.fitWidth) applyZoom();
  updateRibbonState();
}
(() => {
  const pane = h('aside', { id: 'splitPane', class: 'pane right split hidden' },
    h('div', { class: 'pane-head' }, h('span', null, 'Split View (read only, click to jump)'), h('button', { class: 'x', onclick: () => toggleSplit() }, '×')),
    h('div', { class: 'pane-body' }, h('div', { id: 'splitDoc', class: 'splitdoc' })));
  $('#main').append(pane);
  $('#splitDoc').addEventListener('click', e => {
    let el = e.target; while (el && el.parentElement && el.parentElement.id !== 'splitDoc') el = el.parentElement;
    if (!el || !el.parentElement) return;
    const i = [...el.parentElement.children].indexOf(el);
    const target = editor.children[i];
    if (target) { target.scrollIntoView({ block: 'center', behavior: 'smooth' }); const r = document.createRange(); r.selectNodeContents(target); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  });
})();
function extrasAfterChange() {
  clearTimeout(splitTimer);
  splitTimer = setTimeout(renderSplit, 600);
  if (document.body.classList.contains('outline')) outlineMark();
}
