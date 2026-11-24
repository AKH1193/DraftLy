/* DraftLy: Table Design and Table Layout tools */
const TSTYLES = {
  grid: { name: 'Table Grid', border: '#000000' },
  plain: { name: 'Plain', none: true },
  light: { name: 'Grid Light', border: '#BFBFBF' },
  legal: { name: 'Legal', border: '#000000', head: '#F2F2F2', headText: '#000000' },
  blue: { name: 'Blue', border: '#8EAADB', head: '#1F5F8B', headText: '#FFFFFF', band: '#DEEAF6' },
  gray: { name: 'Grey', border: '#A6A6A6', head: '#D9D9D9', headText: '#000000', band: '#F2F2F2' },
  green: { name: 'Green', border: '#A8D08D', head: '#538135', headText: '#FFFFFF', band: '#E2EFD9' },
  orange: { name: 'Orange', border: '#F4B083', head: '#C45911', headText: '#FFFFFF', band: '#FBE4D5' },
  gold: { name: 'Gold', border: '#FFD966', head: '#BF8F00', headText: '#FFFFFF', band: '#FFF2CC' }
};
const curTable = () => { const c = curCell(); return c && c.closest('table'); };
const realRows = t => [...t.rows].filter(r => !r.classList.contains('pg-sp') && r.closest('table') === t);
function cellsInSelection(table) {
  const r = getRange(); if (!r) return [];
  const all = [...table.querySelectorAll('td,th')].filter(c => c.closest('table') === table && !c.parentElement.classList.contains('pg-sp'));
  const hit = all.filter(c => r.intersectsNode(c));
  return hit.length ? hit : (curCell() ? [curCell()] : []);
}
function tableCols(table) {
  const rows = realRows(table);
  const n = Math.max(1, ...rows.map(r => [...r.cells].reduce((a, c) => a + (c.colSpan || 1), 0)));
  let cg = table.querySelector(':scope > colgroup');
  const ref = rows.find(r => r.cells.length === n);
  const widths = cg && cg.children.length === n ? [...cg.children].map(c => c.getBoundingClientRect().width / (ui.view === 'print' ? ui.zoom : 1)) : ref ? [...ref.cells].map(c => c.offsetWidth) : new Array(n).fill(table.offsetWidth / n);
  if (!cg || cg.children.length !== n) { if (cg) cg.remove(); cg = document.createElement('colgroup'); for (let i = 0; i < n; i++) cg.append(document.createElement('col')); table.insertBefore(cg, table.firstChild); }
  return { cg, cols: [...cg.children], widths };
}
function colIndexOf(cell) { let i = -1; for (const c of cell.parentElement.cells) { i += c.colSpan || 1; if (c === cell) break; } return i - (cell.colSpan || 1) + 1; }

/* ---------- design ---------- */
function paintTable(t) {
  const key = t.getAttribute('data-ts');
  const st = TSTYLES[key];
  if (!st) return;
  const hdr = t.getAttribute('data-hr') !== '0', band = t.getAttribute('data-br') === '1', first = t.getAttribute('data-fc') === '1';
  t.classList.remove('nb', 'ob', 'ib');
  if (st.none) t.classList.add('nb');
  if (st.border && st.border !== '#000000') t.style.setProperty('--bc', st.border); else t.style.removeProperty('--bc');
  realRows(t).forEach((r, ri) => {
    [...r.cells].forEach((c, ci) => {
      c.style.removeProperty('background-color'); c.style.removeProperty('color'); c.style.removeProperty('font-weight');
      if (ri === 0 && hdr && (st.head || key === 'grid' || key === 'light' || key === 'plain')) {
        if (st.head) c.style.backgroundColor = st.head;
        if (st.headText && st.headText !== '#000000') c.style.color = st.headText;
        c.style.fontWeight = 'bold';
      } else if (band && st.band && ((ri - (hdr ? 1 : 0)) % 2 === 0)) c.style.backgroundColor = st.band;
      if (first && ci === 0) c.style.fontWeight = 'bold';
      if (!c.getAttribute('style')) c.removeAttribute('style');
    });
  });
  if (!t.className) t.removeAttribute('class');
  if (!t.getAttribute('style')) t.removeAttribute('style');
}
function setTableStyle(key) { const t = curTable(); if (!t) return toast('Click inside a table first'); mutate(() => { t.setAttribute('data-ts', key); if (!t.hasAttribute('data-hr')) t.setAttribute('data-hr', '1'); if (!t.hasAttribute('data-br') && TSTYLES[key].band) t.setAttribute('data-br', '1'); paintTable(t); }); }
function toggleTableOpt(attr) {
  const t = curTable(); if (!t) return;
  mutate(() => {
    const def = attr === 'data-hr' ? '1' : '0';
    const cur = (t.getAttribute(attr) ?? def) === '1';
    t.setAttribute(attr, cur ? '0' : '1');
    if (!t.getAttribute('data-ts')) t.setAttribute('data-ts', t.classList.contains('nb') ? 'plain' : 'grid');
    paintTable(t);
  });
}
const tableOptOn = attr => () => { const t = curTable(); if (!t) return false; return (t.getAttribute(attr) ?? (attr === 'data-hr' ? (t.getAttribute('data-ts') ? '1' : '0') : '0')) === '1'; };
function setBorders(kind) {
  const t = curTable(); if (!t) return;
  mutate(() => { t.classList.remove('nb', 'ob', 'ib'); if (kind === 'none') t.classList.add('nb'); if (kind === 'outside') t.classList.add('ob'); if (kind === 'inside') t.classList.add('ib'); if (!t.className) t.removeAttribute('class'); });
}
function setPen(prop, val) {
  const t = curTable(); if (!t) return;
  mutate(() => { if (val) t.style.setProperty(prop, val); else t.style.removeProperty(prop); if (!t.getAttribute('style')) t.removeAttribute('style'); });
}
function styleGallery() {
  const g = h('div', { class: 'stylesGallery tstyles' });
  Object.entries(TSTYLES).forEach(([k, s]) => {
    const mini = h('div', { class: 'tmini' });
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const cell = h('i');
      const bg = r === 0 ? s.head : (s.band && r % 2 === 1 ? s.band : null);
      cell.style.background = bg || '#fff';
      cell.style.borderColor = s.none ? 'transparent' : s.border;
      mini.append(cell);
    }
    const b = h('button', { type: 'button', title: s.name, 'data-ts': k }, mini, h('small', null, s.name));
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', () => setTableStyle(k));
    g.append(b);
  });
  return g;
}

/* ---------- layout ---------- */
function selectTablePart(kind) {
  const c = curCell(); if (!c) return;
  const t = c.closest('table');
  const r = document.createRange();
  if (kind === 'cell') r.selectNodeContents(c);
  else if (kind === 'row') { r.setStartBefore(c.parentElement.cells[0]); r.setEndAfter(c.parentElement.cells[c.parentElement.cells.length - 1]); }
  else { r.selectNode(t); }
  const s = getSelection(); s.removeAllRanges(); s.addRange(r); lastRange = r.cloneRange();
}
function setRowHeight(inches) {
  const t = curTable(); if (!t) return;
  mutate(() => {
    const rows = new Set(cellsInSelection(t).map(c => c.parentElement));
    rows.forEach(r => [...r.cells].forEach(c => { if (inches > 0) c.style.height = Math.round(inches * 96) + 'px'; else c.style.removeProperty('height'); if (!c.getAttribute('style')) c.removeAttribute('style'); }));
  });
}
function setColWidth(inches) {
  const c = curCell(); if (!c) return;
  const t = c.closest('table');
  mutate(() => {
    const { cols, widths } = tableCols(t);
    const i = colIndexOf(c), want = Math.max(24, inches * 96);
    const total = widths.reduce((a, b) => a + b, 0);
    const others = total - widths[i];
    cols.forEach((col, k) => { const w = k === i ? want : widths[k] * Math.max(0.05, (total - want)) / (others || 1); col.style.width = (w / total * 100).toFixed(2) + '%'; });
  });
}
function distributeRows() {
  const t = curTable(); if (!t) return;
  mutate(() => { const rows = realRows(t); const h0 = Math.max(...rows.map(r => r.offsetHeight)); rows.forEach(r => [...r.cells].forEach(c => c.style.height = h0 + 'px')); });
}
function autofit(kind) {
  const t = curTable(); if (!t) return;
  mutate(() => {
    if (kind === 'contents') { t.querySelectorAll(':scope > colgroup').forEach(c => c.remove()); t.style.tableLayout = 'auto'; t.style.width = 'auto'; }
    else if (kind === 'window') { t.querySelectorAll(':scope > colgroup').forEach(c => c.remove()); t.style.removeProperty('table-layout'); t.style.removeProperty('width'); }
    else { const { cols, widths } = tableCols(t); const tot = widths.reduce((a, b) => a + b, 0); cols.forEach((c, k) => c.style.width = (widths[k] / tot * 100).toFixed(2) + '%'); t.style.removeProperty('table-layout'); }
    if (!t.getAttribute('style')) t.removeAttribute('style');
  });
}
function alignCells(hAlign, vAlign) {
  const t = curTable(); if (!t) return;
  mutate(() => cellsInSelection(t).forEach(c => {
    c.style.verticalAlign = vAlign;
    c.style.textAlign = hAlign;
    c.querySelectorAll(':scope > p, :scope > h1, :scope > h2, :scope > h3').forEach(p => p.style.textAlign = hAlign);
  }));
}
function cellMargins(kind) {
  const t = curTable(); if (!t) return;
  mutate(() => { if (kind === 'normal') t.removeAttribute('data-pad'); else t.setAttribute('data-pad', kind); });
}
function toggleRepeatHeader() {
  const t = curTable(); if (!t) return;
  const r0 = realRows(t)[0];
  mutate(() => { if (r0.hasAttribute('data-hdr')) r0.removeAttribute('data-hdr'); else r0.setAttribute('data-hdr', '1'); });
  toast(r0.hasAttribute('data-hdr') ? 'The first row will repeat at the top of each page in Word' : 'Header row will not repeat');
}
function sortTable(dir) {
  const c = curCell(); if (!c) return;
  const t = c.closest('table');
  const col = colIndexOf(c);
  mutate(() => {
    const rows = realRows(t);
    const skipHead = rows[0].querySelector('th') || t.getAttribute('data-hr') === '1' || rows[0].hasAttribute('data-hdr');
    const body = skipHead ? rows.slice(1) : rows;
    const key = r => { let i = -1; for (const x of r.cells) { i += x.colSpan || 1; if (i >= col) return x.textContent.trim(); } return ''; };
    const parent = body[0] && body[0].parentElement;
    body.sort((a, b) => key(a).localeCompare(key(b), 'en-IN', { numeric: true, sensitivity: 'base' }) * dir).forEach(r => r.parentElement.appendChild(r));
    if (t.getAttribute('data-ts')) paintTable(t);
  });
}
function convertTableToText() {
  const t = curTable(); if (!t) return;
  mutate(() => {
    const frag = document.createDocumentFragment();
    realRows(t).forEach(r => { const p = document.createElement('p'); p.textContent = [...r.cells].map(c => c.innerText.replace(/\n+/g, ' ').trim()).join('\t'); frag.append(p); });
    t.replaceWith(frag);
  });
}
function tableAlign(where) {
  const t = curTable(); if (!t) return;
  mutate(() => {
    if (!t.style.width || t.style.width === '100%') t.style.width = '80%';
    t.style.marginLeft = where === 'left' ? '0' : 'auto';
    t.style.marginRight = where === 'right' ? '0' : 'auto';
  });
}
function tableWidthPct(p) { const t = curTable(); if (!t) return; mutate(() => { if (p >= 100) { t.style.removeProperty('width'); t.style.removeProperty('margin-left'); t.style.removeProperty('margin-right'); } else t.style.width = p + '%'; if (!t.getAttribute('style')) t.removeAttribute('style'); }); }
function alignGrid() {
  const g = h('div', { class: 'agrid' });
  [['top', 'Top'], ['middle', 'Centre'], ['bottom', 'Bottom']].forEach(([v, vl]) => [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']].forEach(([a, al]) => {
    const b = h('button', { type: 'button', title: `Align ${vl.toLowerCase()} ${al.toLowerCase()}`, class: `ag ag-${v}-${a}` }, h('i'), h('i'), h('i'));
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', () => alignCells(a, v));
    g.append(b);
  }));
  return g;
}
const numIn = (label, get, set, step) => {
  const i = h('input', { type: 'number', class: 'rin numIn', step: step || 0.1, min: 0 });
  i._sync = () => { if (document.activeElement !== i) { const v = get(); i.value = v == null ? '' : v; } };
  i.addEventListener('change', () => set(parseFloat(i.value) || 0));
  i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); set(parseFloat(i.value) || 0); } });
  return h('div', { class: 'lblrow' }, h('label', null, label), i);
};
const rowHeightGet = () => { const c = curCell(); return c ? (c.parentElement.offsetHeight / 96).toFixed(2) : ''; };
const colWidthGet = () => { const c = curCell(); return c ? (c.offsetWidth / 96).toFixed(2) : ''; };
