/* DraftLy: Compare Documents (legal blackline) and Mail Merge */

/* ================= Compare ================= */
const Compare = (() => {
  const SIMPLE = /^(P|H[1-6]|LI|BLOCKQUOTE|PRE|TD|TH)$/;
  const norm = s => s.replace(/[\s ​]+/g, ' ').trim();
  const keyOf = el => el.nodeType === 1 ? el.tagName + '|' + norm(el.textContent) + (el.querySelector && el.querySelector('img') ? '|img' + el.querySelectorAll('img').length : '') : '#|' + norm(el.textContent || '');
  const tokens = s => s.match(/\s+|\p{N}[\p{N},.\/-]*\p{N}|[\p{L}\p{N}_'’]+|[^\s\p{L}\p{N}_]/gu) || [];

  /* accepted view of existing markup: drop deletions, keep insertions */
  function accepted(root) {
    root.querySelectorAll('del.tc').forEach(e => e.remove());
    root.querySelectorAll('ins.tc').forEach(e => Review.unwrap(e));
    root.querySelectorAll('tr.pg-sp').forEach(e => e.remove());
    return root;
  }
  /* longest common subsequence over two key arrays; returns matched index pairs */
  function lcs(a, b) {
    let s = 0; while (s < a.length && s < b.length && a[s] === b[s]) s++;
    let ea = a.length, eb = b.length; while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
    const pairs = [];
    for (let i = 0; i < s; i++) pairs.push([i, i]);
    const n = ea - s, m = eb - s;
    if (n && m) {
      if (n * m > 25e6) { /* very large: fall back to greedy matching */
        let j = 0; for (let i = 0; i < n; i++) { const k = b.indexOf(a[s + i], s + j); if (k >= 0 && k < eb) { pairs.push([s + i, k]); j = k - s + 1; } }
      } else {
        const W = m + 1, dp = new Uint32Array((n + 1) * W);
        for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i * W + j] = a[s + i] === b[s + j] ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
        let i = 0, j = 0;
        while (i < n && j < m) { if (a[s + i] === b[s + j]) { pairs.push([s + i, s + j]); i++; j++; } else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) i++; else j++; }
      }
    }
    for (let i = 0; i < a.length - ea; i++) pairs.push([ea + i, eb + i]);
    return pairs;
  }
  const similar = (x, y) => {
    if (x.nodeType !== y.nodeType || (x.nodeType === 1 && x.tagName !== y.tagName)) return false;
    const A = new Set(norm(x.textContent).toLowerCase().split(' ').filter(Boolean)), B = new Set(norm(y.textContent).toLowerCase().split(' ').filter(Boolean));
    if (!A.size && !B.size) return true;
    let c = 0; A.forEach(w => { if (B.has(w)) c++; });
    return 2 * c / (A.size + B.size) >= 0.35;
  };
  let AUTHOR = 'Compare', DATE = new Date().toISOString();
  const mk = tag => { const e = document.createElement(tag); e.className = 'tc'; e.setAttribute('data-author', AUTHOR); e.setAttribute('data-date', DATE); return e; };
  /* wrap every text node (and image) of an element as inserted or deleted */
  function markAll(el, tag) {
    if (el.nodeType === 3) { if (!el.data) return el; const w = mk(tag); el.replaceWith(w); w.append(el); return w; }
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: n => n.nodeType === 3 ? (n.data ? 1 : 3) : n.tagName === 'IMG' || (n.tagName === 'SUP' && n.classList.contains('fn')) ? 1 : 3 });
    const list = []; let n; while ((n = w.nextNode())) list.push(n);
    list.forEach(t => { const x = mk(tag); t.parentNode.insertBefore(x, t); x.append(t); });
    if (!list.length && el.tagName && /^(P|H[1-6]|LI)$/.test(el.tagName)) { /* empty paragraph: keep it, nothing to mark */ }
    return el;
  }
  /* word-level diff inside one paragraph; keeps the revised paragraph's formatting */
  function diffInline(orig, rev) {
    const out = rev.cloneNode(true);
    const ta = tokens(orig.textContent), tb = tokens(out.textContent);
    const pairs = lcs(ta, tb);
    // build ops in revised coordinates
    const ops = []; // {pos, type:'ins', end} | {pos, type:'del', text}
    let ia = 0, ib = 0, pos = 0;
    const offs = []; { let o = 0; for (const t of tb) { offs.push(o); o += t.length; } offs.push(o); }
    const flush = (ea, eb) => {
      if (ea > ia) ops.push({ pos: offs[ib], type: 'del', text: ta.slice(ia, ea).join('') });
      if (eb > ib) ops.push({ pos: offs[ib], type: 'ins', end: offs[eb] });
    };
    for (const [x, y] of pairs) { flush(x, y); ia = x + 1; ib = y + 1; }
    flush(ta.length, tb.length);
    // ignore whitespace-only changes
    const real = ops.filter(o => o.type === 'del' ? o.text.trim() : norm(out.textContent.slice(o.pos, o.end)));
    real.sort((p, q) => q.pos - p.pos || (p.type === 'ins' ? -1 : 1));
    for (const op of real) {
      if (op.type === 'ins') wrapRange(out, op.pos, op.end);
      else insertDel(out, op.pos, op.text);
    }
    return out;
  }
  function textNodes(root) { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const a = []; let n; while ((n = w.nextNode())) a.push(n); return a; }
  function locate(root, off) {
    let o = 0;
    for (const t of textNodes(root)) { if (off < o + t.length || (off === o + t.length && false)) return [t, off - o]; o += t.length; }
    const all = textNodes(root); const last = all[all.length - 1];
    return last ? [last, last.length] : [null, 0];
  }
  function wrapRange(root, a, b) {
    let o = 0;
    for (const t of textNodes(root)) {
      const s = o, e = o + t.length; o = e;
      if (e <= a || s >= b || t.parentElement.closest('del.tc')) continue;
      let node = t;
      if (a > s) node = node.splitText(a - s);
      if (b < e) node.splitText(b - Math.max(a, s));
      const w = mk('ins'); node.parentNode.insertBefore(w, node); w.append(node);
    }
  }
  function insertDel(root, pos, text) {
    const d = mk('del'); d.textContent = text;
    const [t, off] = locate(root, pos);
    if (!t) { root.append(d); return; }
    if (off === t.length) { t.after(d); return; }
    const rest = off > 0 ? t.splitText(off) : t;
    let anchor = rest;
    while (anchor.parentNode !== root && !anchor.previousSibling && anchor.parentNode.matches('ins.tc')) anchor = anchor.parentNode;
    anchor.parentNode.insertBefore(d, anchor);
  }
  /* align children of two containers and write the blackline into out */
  function diffChildren(origEl, revEl, out) {
    const A = [...origEl.childNodes].filter(n => n.nodeType === 1 || norm(n.data || '')), B = [...revEl.childNodes].filter(n => n.nodeType === 1 || norm(n.data || ''));
    const pairs = lcs(A.map(keyOf), B.map(keyOf));
    let ia = 0, ib = 0;
    const gap = (ea, eb) => {
      const D = A.slice(ia, ea), I = B.slice(ib, eb);
      // pair up changed paragraphs, then write deletions before insertions like Word's blackline
      const pairs2 = []; let dx = 0;
      for (let k = 0; k < I.length; k++) for (let x = dx; x < D.length; x++) if (similar(D[x], I[k])) { pairs2.push([x, k]); dx = x + 1; break; }
      let di = 0, ii = 0;
      for (const [x, k] of pairs2) {
        for (; di < x; di++) out.append(markAll(D[di].cloneNode(true), 'del'));
        for (; ii < k; ii++) out.append(markAll(I[ii].cloneNode(true), 'ins'));
        out.append(diffNode(D[x], I[k])); di = x + 1; ii = k + 1;
      }
      for (; di < D.length; di++) out.append(markAll(D[di].cloneNode(true), 'del'));
      for (; ii < I.length; ii++) out.append(markAll(I[ii].cloneNode(true), 'ins'));
    };
    for (const [x, y] of pairs) { gap(x, y); out.append(B[y].cloneNode(true)); ia = x + 1; ib = y + 1; }
    gap(A.length, B.length);
    return out;
  }
  function diffNode(o, r) {
    if (o.nodeType === 3 || r.nodeType === 3) { const p = document.createElement('span'); p.textContent = r.textContent || ''; const q = document.createElement('span'); q.textContent = o.textContent || ''; return diffInline(q, p); }
    const t = r.tagName;
    if ((t === 'UL' || t === 'OL' || t === 'DIV' || t === 'TBODY' || t === 'THEAD' || t === 'BLOCKQUOTE' && [...r.children].some(c => /^(P|H\d|UL|OL|TABLE)$/.test(c.tagName))) && o.tagName === t) {
      const shell = r.cloneNode(false); return diffChildren(o, r, shell);
    }
    if (t === 'TABLE' && o.tagName === 'TABLE') {
      const ro = [...o.rows], rr = [...r.rows];
      const sameShape = ro.length === rr.length && ro.every((x, i) => x.cells.length === rr[i].cells.length);
      if (!sameShape) { const f = document.createDocumentFragment(); f.append(markAll(o.cloneNode(true), 'del'), markAll(r.cloneNode(true), 'ins')); return f; }
      const out = r.cloneNode(true);
      [...out.rows].forEach((row, i) => [...row.cells].forEach((cell, j) => {
        const oc = ro[i].cells[j], rc = rr[i].cells[j];
        if (keyOf(oc) === keyOf(rc)) return;
        cell.innerHTML = ''; diffChildren(oc, rc, cell);
      }));
      return out;
    }
    if (SIMPLE.test(t) && !r.querySelector('ul,ol,table,p,div')) return diffInline(o, r);
    if (/^(LI|TD|TH)$/.test(t)) { const shell = r.cloneNode(false); return diffChildren(o, r, shell); }
    const f = document.createDocumentFragment(); f.append(markAll(o.cloneNode(true), 'del'), markAll(r.cloneNode(true), 'ins')); return f;
  }
  function run(origHtml, revHtml, author) {
    AUTHOR = author || 'Compare'; DATE = new Date().toISOString();
    const a = accepted(h('div', { html: origHtml })), b = accepted(h('div', { html: revHtml }));
    const out = diffChildren(a, b, h('div'));
    const stats = { ins: out.querySelectorAll('ins.tc').length, del: out.querySelectorAll('del.tc').length };
    return { html: out.innerHTML, stats };
  }
  return { run, diffInline };
})();

async function readDocSource(src) {
  if (src === 'current') { await persist(true); return { html: cleanHTML(), settings: JSON.parse(JSON.stringify(doc.settings)), comments: JSON.parse(JSON.stringify(doc.comments || {})), title: doc.title }; }
  if (src instanceof File) {
    if (/\.docx$/i.test(src.name)) return DocxImport.parse(await src.arrayBuffer(), src.name);
    const t = await src.text();
    return { html: /\.html?$/i.test(src.name) ? sanitizeHtml(t) : mdToHtml(t), settings: DEFAULT_SETTINGS(), comments: {}, title: src.name.replace(/\.\w+$/, '') };
  }
  const rec = await Store.get(src);
  return rec ? { html: rec.html, settings: rec.settings, comments: rec.comments || {}, title: rec.title } : null;
}
async function compareDialog() {
  const all = (await Store.all()).filter(d => !d.stub);
  const mkPick = (label, def) => {
    const sel = h('select', null, h('option', { value: 'current' }, 'This document: ' + doc.title), h('option', { value: 'file' }, 'Browse for a .docx file…'), ...all.filter(d => d.id !== doc.id).slice(0, 60).map(d => h('option', { value: d.id }, d.title)));
    sel.value = def;
    const fi = h('input', { type: 'file', accept: '.docx,.html,.htm,.txt,.md', style: { display: 'none' } });
    const nm = h('small', { class: 'note' });
    sel.addEventListener('change', () => { if (sel.value === 'file') fi.click(); });
    fi.addEventListener('change', () => { nm.textContent = fi.files[0] ? fi.files[0].name : ''; });
    const get = () => sel.value === 'file' ? fi.files[0] : sel.value;
    return { el: h('div', null, field(label, sel), fi, nm), get };
  };
  const o = mkPick('Original document', 'file'), r = mkPick('Revised document', 'current');
  const who = h('input', { value: prefs.author });
  modal('Compare Documents', h('div', null, h('p', { class: 'note' }, 'Shows every difference as tracked changes (a blackline) in a new document. Your files are not changed.'), o.el, r.el, field('Label changes with', who)), [{ label: 'Cancel' }, {
    label: 'Compare', primary: true, fn: async () => {
      const a = o.get(), b = r.get();
      if (!a || !b) { toast('Choose both documents'); return false; }
      if (a === b) { toast('Choose two different documents'); return false; }
      const pm = modal('Comparing…', h('p', null, 'Working…'), []);
      try {
        const A = await readDocSource(a), B = await readDocSource(b);
        if (!A || !B) throw new Error('Could not read one of the documents');
        const res = Compare.run(A.html, B.html, who.value.trim() || 'Compare');
        await newDoc({ title: 'Compare Result - ' + (A.title || 'Original') + ' vs ' + (B.title || 'Revised'), html: res.html, settings: B.settings || DEFAULT_SETTINGS(), comments: B.comments || {} });
        setMarkup && setMarkup('all');
        showPane('changesPane', true);
        toast(`${res.stats.ins} insertions and ${res.stats.del} deletions found`, 5000);
      } catch (e) { console.error(e); toast('Compare failed: ' + e.message, 5000); }
      finally { pm.close(); }
    }
  }]);
}

/* ================= Mail Merge ================= */
const Merge = { idx: 0, preview: false };
function mergeData() { return doc && doc.settings.merge; }
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const delim = (text.split('\n')[0].match(/\t/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? '\t' : (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; continue; }
    if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
async function parseXLSX(buf) {
  const files = await Zip.read(buf);
  const txt = p => files[p] ? new TextDecoder().decode(files[p]) : '';
  const X = s => new DOMParser().parseFromString(s, 'application/xml');
  const ss = [...X(txt('xl/sharedStrings.xml')).getElementsByTagNameNS('*', 'si')].map(si => [...si.getElementsByTagNameNS('*', 't')].map(t => t.textContent).join(''));
  // first worksheet in workbook order
  let sheet = 'xl/worksheets/sheet1.xml';
  const wb = X(txt('xl/workbook.xml')), rels = X(txt('xl/_rels/workbook.xml.rels'));
  const first = wb.getElementsByTagNameNS('*', 'sheet')[0];
  if (first) { const rid = first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || first.getAttribute('r:id'); const rel = [...rels.getElementsByTagNameNS('*', 'Relationship')].find(r => r.getAttribute('Id') === rid); if (rel) { const t = rel.getAttribute('Target').replace(/^\//, ''); sheet = t.startsWith('xl/') ? t : 'xl/' + t; } }
  // date formats
  const st = X(txt('xl/styles.xml'));
  const custom = {}; [...st.getElementsByTagNameNS('*', 'numFmt')].forEach(n => custom[n.getAttribute('numFmtId')] = n.getAttribute('formatCode') || '');
  const xfs = [...(st.getElementsByTagNameNS('*', 'cellXfs')[0] || { children: [] }).children].map(x => +x.getAttribute('numFmtId'));
  const isDate = s => { const id = xfs[+s]; if (id == null) return false; if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47)) return true; const f = custom[id]; return !!f && /[dy]/i.test(f.replace(/\[[^\]]*\]|"[^"]*"/g, '')); };
  const fmtDate = v => { const d = new Date(Math.round((v - 25569) * 864e5)); return [String(d.getUTCDate()).padStart(2, '0'), String(d.getUTCMonth() + 1).padStart(2, '0'), d.getUTCFullYear()].join('.'); };
  const col = ref => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const rows = [];
  for (const r of X(txt(sheet)).getElementsByTagNameNS('*', 'row')) {
    const out = [];
    for (const c of r.getElementsByTagNameNS('*', 'c')) {
      const t = c.getAttribute('t'), v = c.getElementsByTagNameNS('*', 'v')[0];
      let val = '';
      if (t === 's') val = ss[+(v && v.textContent)] || '';
      else if (t === 'inlineStr') val = [...c.getElementsByTagNameNS('*', 't')].map(x => x.textContent).join('');
      else if (v) { val = v.textContent; if (t !== 'str' && t !== 'b' && t !== 'e' && isDate(c.getAttribute('s'))) val = fmtDate(+val); else if (/^-?\d+\.\d{6,}$/.test(val)) val = String(Math.round(+val * 1e6) / 1e6); }
      out[col(c.getAttribute('r') || 'A')] = val;
    }
    rows.push([...out].map(x => x == null ? '' : x));
  }
  return rows.filter(r => r.some(x => String(x).trim()));
}
function selectRecipients() {
  const fi = h('input', { type: 'file', accept: '.csv,.tsv,.txt,.xlsx' });
  fi.onchange = async () => {
    const f = fi.files[0]; if (!f) return;
    try {
      const rows = /\.xlsx$/i.test(f.name) ? await parseXLSX(await f.arrayBuffer()) : parseCSV(await f.text());
      if (rows.length < 2) return toast('The list needs a header row and at least one recipient');
      const fields = rows[0].map((x, i) => String(x).trim() || 'Column ' + (i + 1));
      const data = rows.slice(1).map(r => Object.fromEntries(fields.map((k, i) => [k, String(r[i] ?? '').trim()])));
      mutate(() => { doc.settings.merge = { source: f.name, fields, rows: data, include: data.map(() => true) }; });
      Merge.idx = 0;
      toast(`${data.length} recipients loaded from ${f.name}`);
      renderRibbon();
    } catch (e) { console.error(e); toast('Could not read the list: ' + e.message, 5000); }
  };
  fi.click();
}
function typeRecipients() {
  const ta = h('textarea', { rows: 10, style: { width: '100%', fontFamily: 'monospace' }, placeholder: 'Name, Address, Amount\nSri. A, Bengaluru, 1,00,000' });
  const m = mergeData();
  if (m) ta.value = [m.fields.join('\t'), ...m.rows.map(r => m.fields.map(k => r[k]).join('\t'))].join('\n');
  modal('Type a New List', h('div', null, h('p', { class: 'note' }, 'First line: column names. One recipient per line. Separate columns with commas or tabs (you can paste straight from Excel).'), ta), [{ label: 'Cancel' }, {
    label: 'OK', primary: true, fn: () => {
      const rows = parseCSV(ta.value);
      if (rows.length < 2) { toast('Add a header line and at least one recipient'); return false; }
      const fields = rows[0].map((x, i) => x.trim() || 'Column ' + (i + 1));
      const data = rows.slice(1).map(r => Object.fromEntries(fields.map((k, i) => [k, (r[i] || '').trim()])));
      mutate(() => { doc.settings.merge = { source: 'Typed list', fields, rows: data, include: data.map(() => true) }; });
      Merge.idx = 0; renderRibbon();
    }
  }], { wide: true });
}
function editRecipients() {
  const m = mergeData(); if (!m) return toast('Select recipients first');
  const tbl = h('table', { class: 'rcp' }, h('tr', null, h('th', null, ''), ...m.fields.map(f => h('th', null, f))));
  const boxes = m.rows.map((r, i) => { const c = h('input', { type: 'checkbox' }); c.checked = m.include[i] !== false; tbl.append(h('tr', null, h('td', null, c), ...m.fields.map(f => h('td', null, r[f])))); return c; });
  const all = h('button', { class: 'btn', type: 'button', onclick: () => { const on = !boxes.every(b => b.checked); boxes.forEach(b => b.checked = on); } }, 'Select / clear all');
  modal('Mail Merge Recipients  (' + m.source + ')', h('div', null, all, h('div', { style: { maxHeight: '50vh', overflow: 'auto', marginTop: '8px' } }, tbl)), [{ label: 'Cancel' }, { label: 'OK', primary: true, fn: () => mutate(() => { m.include = boxes.map(b => b.checked); }) }], { wide: true });
}
function insertMergeField(name) {
  if (!mergeData()) return toast('Select recipients first');
  restoreRange();
  const r = getRange();
  if (!r) return toast('Place the cursor where the field should go');
  mutate(() => {
    if (!r.collapsed) r.deleteContents();
    const sp = h('span', { class: 'mf', contenteditable: 'false', 'data-f': name }, '«' + name + '»');
    const z = document.createTextNode('\u200B');
    r.insertNode(z); r.insertNode(sp);
    const c = document.createRange(); c.setStart(z, 1); c.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(c);
  });
  if (Merge.preview) mergePreviewApply();
}
function mergeRecords() { const m = mergeData(); return m ? m.rows.filter((r, i) => m.include[i] !== false) : []; }
function mergePreviewApply() {
  const recs = mergeRecords(), r = recs[Merge.idx];
  editor.querySelectorAll('span.mf').forEach(s => { const f = s.getAttribute('data-f'); s.textContent = Merge.preview && r ? (r[f] ?? '') : '«' + f + '»'; s.classList.toggle('pv', Merge.preview); });
  schedulePaginate(); updateRibbonState();
  const st = $('#mergeRec'); if (st) st.textContent = recs.length ? `${Merge.idx + 1} / ${recs.length}` : '0';
}
function mergePreview(on) { Merge.preview = on === undefined ? !Merge.preview : on; Merge.idx = Math.max(0, Math.min(Merge.idx, mergeRecords().length - 1)); mergePreviewApply(); }
function mergeGo(d) { const n = mergeRecords().length; if (!n) return; Merge.idx = d === 'first' ? 0 : d === 'last' ? n - 1 : Math.max(0, Math.min(n - 1, Merge.idx + d)); if (!Merge.preview) Merge.preview = true; mergePreviewApply(); }
function mergedHtmlFor(r) {
  const d = h('div', { html: cleanHTML() });
  d.querySelectorAll('span.mf').forEach(s => s.replaceWith(document.createTextNode(r[s.getAttribute('data-f')] ?? '')));
  return d.innerHTML.replace(/​/g, '');
}
async function mergeFinish(kind) {
  const recs = mergeRecords();
  if (!recs.length) return toast('No recipients selected');
  if (!editor.querySelector('span.mf')) return toast('Insert at least one merge field first');
  const base = doc, baseTitle = doc.title;
  const html = recs.map(mergedHtmlFor).join('<hr class="pb">');
  if (kind === 'doc') {
    await newDoc({ title: baseTitle + ' (Merged)', html, settings: JSON.parse(JSON.stringify(base.settings)) });
    delete doc.settings.merge; markDirty();
    return toast(`${recs.length} letters created`);
  }
  if (kind === 'pdf') {
    await newDoc({ title: baseTitle + ' (Merged)', html, settings: JSON.parse(JSON.stringify(base.settings)) });
    delete doc.settings.merge; markDirty();
    return exportAs('pdf');
  }
  if (kind === 'files') {
    const m = mergeData();
    const sel = h('select', null, ...m.fields.map(f => h('option', { value: f }, f)));
    modal('Save Each Letter as a Word File', h('div', null, field('Name each file after', sel), h('p', { class: 'note' }, IS_NATIVE ? 'Files go to Documents/DraftLy.' : 'Files go to your save folder (or Downloads).')), [{ label: 'Cancel' }, {
      label: 'Save ' + recs.length + ' files', primary: true, fn: async () => {
        await SaveFolder.get(true);
        const used = {};
        for (let i = 0; i < recs.length; i++) {
          const r = recs[i];
          let nm = safeName(baseTitle + ' ' + (r[sel.value] || i + 1));
          if (used[nm]) nm += ' ' + (++used[nm]); else used[nm] = 1;
          const root = h('div', { html: mergedHtmlFor(r) });
          const s = JSON.parse(JSON.stringify(base.settings)); delete s.merge;
          const blob = await DocxExport.build({ root, settings: s, comments: base.comments || {}, theme: s.theme, title: nm, author: prefs.author, created: base.created });
          await saveBlob(blob, nm + '.docx');
          toast(`Saved ${i + 1} of ${recs.length}`);
        }
      }
    }]);
  }
}
