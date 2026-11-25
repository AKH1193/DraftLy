/* DraftLy: open old Word 97-2003 (.doc) files and PDFs as editable documents */

/* ================= Word 97-2003 (.doc) ================= */
const DocImport = (() => {
  const CP1252 = { 0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160, 0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153, 0x9E: 0x017E, 0x9F: 0x0178 };
  const ICO = [null, '#000000', '#0000FF', '#00FFFF', '#00FF00', '#FF00FF', '#FF0000', '#FFFF00', '#FFFFFF', '#000080', '#008080', '#008000', '#800080', '#800000', '#808000', '#808080', '#C0C0C0'];
  const sprmSize = (sprm, b, i) => { const spra = sprm >> 13; switch (spra) { case 0: case 1: return 1; case 2: case 4: case 5: return 2; case 3: return 4; case 7: return 3; default: return (sprm === 0xD608 || sprm === 0xC615) ? null : b[i] + 1; } };
  function sprms(b, start, end, fn) {
    let i = start;
    while (i + 2 <= end) {
      const sprm = b[i] | (b[i + 1] << 8); i += 2;
      let n = sprmSize(sprm, b, i);
      if (n === null) { n = (b[i] | (b[i + 1] << 8)) + 2; }
      fn(sprm, i, n);
      i += n;
    }
  }
  function parse(buf, name) {
    const files = CFB.read(buf);
    const wd = files['WordDocument'];
    if (!wd) throw new Error('this is not a Word document');
    const dv = new DataView(wd.buffer, wd.byteOffset, wd.byteLength);
    if (dv.getUint16(0, true) !== 0xA5EC) throw new Error('this Word file is in a format older than Word 97');
    const flags = dv.getUint16(0x0A, true);
    if (flags & 0x0100) throw new Error('this .doc file is password-protected. Open it in Word, remove the password and save it as .docx first');
    const tbl = files[(flags & 0x0200) ? '1Table' : '0Table'];
    if (!tbl) throw new Error('the document table is missing');
    const tdv = new DataView(tbl.buffer, tbl.byteOffset, tbl.byteLength);
    const csw = dv.getUint16(32, true), lwOff = 34 + csw * 2 + 2, cslw = dv.getUint16(34 + csw * 2, true);
    const lw = i => dv.getInt32(lwOff + i * 4, true);
    const ccpText = lw(3), ccpFtn = lw(4), ccpHdd = lw(5);
    const fcOff = lwOff + cslw * 4 + 2;
    const fc = i => dv.getUint32(fcOff + i * 8, true), lcb = i => dv.getUint32(fcOff + i * 8 + 4, true);

    /* piece table */
    const clx = fc(33), clxEnd = clx + lcb(33);
    let p = clx;
    while (p < clxEnd && tbl[p] === 1) p += 3 + tdv.getInt16(p + 1, true);
    if (tbl[p] !== 2) throw new Error('the text table could not be read');
    const plcLen = tdv.getUint32(p + 1, true), plc = p + 5, nPcd = (plcLen - 4) / 12;
    const pieces = [];
    for (let k = 0; k < nPcd; k++) {
      const cpS = tdv.getUint32(plc + k * 4, true), cpE = tdv.getUint32(plc + (k + 1) * 4, true);
      const raw = tdv.getUint32(plc + (nPcd + 1) * 4 + k * 8 + 2, true);
      const comp = !!(raw & 0x40000000), f = raw & 0x3FFFFFFF;
      pieces.push({ cpS, cpE, comp, fc: comp ? f / 2 : f });
    }
    const charAt = (pc, cp) => { const o = cp - pc.cpS; if (pc.comp) { const c = wd[pc.fc + o]; return [String.fromCharCode(CP1252[c] || c), pc.fc + o]; } const a = pc.fc + o * 2; return [String.fromCharCode(wd[a] | (wd[a + 1] << 8)), a]; };
    /* formatting runs keyed by file position */
    function bte(idx, isPap) {
      const runs = [], f0 = fc(idx), n = (lcb(idx) - 4) / 8;
      for (let k = 0; k < n; k++) {
        const pn = tdv.getUint32(f0 + (n + 1) * 4 + k * 4, true), pg = pn * 512;
        if (pg + 512 > wd.length) continue;
        const crun = wd[pg + 511];
        for (let r = 0; r < crun; r++) {
          const s = dv.getUint32(pg + r * 4, true), e = dv.getUint32(pg + (r + 1) * 4, true);
          if (isPap) {
            const bo = wd[pg + (crun + 1) * 4 + r * 13] * 2;
            if (!bo) { runs.push({ s, e, b: null }); continue; }
            let cb = wd[pg + bo], st = pg + bo + 1, len;
            if (cb === 0) { cb = wd[pg + bo + 1]; st++; len = cb * 2; } else len = cb * 2 - 1;
            runs.push({ s, e, istd: wd[st] | (wd[st + 1] << 8), b: [st + 2, st + len] });
          } else {
            const bo = wd[pg + (crun + 1) * 4 + r] * 2;
            runs.push({ s, e, b: bo ? [pg + bo + 1, pg + bo + 1 + wd[pg + bo]] : null });
          }
        }
      }
      runs.sort((a, b) => a.s - b.s);
      return runs;
    }
    const chpRuns = bte(12, false), papRuns = bte(13, true);
    const find = (runs, f) => { let lo = 0, hi = runs.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (f < runs[m].s) hi = m - 1; else if (f >= runs[m].e) lo = m + 1; else return runs[m]; } return null; };
    /* fonts */
    const fonts = [];
    try { const f0 = fc(15), n = tdv.getUint16(f0, true); let q = f0 + 4; for (let k = 0; k < n; k++) { const cb = tbl[q]; let nm = '', a = q + 1 + 39; while (a < q + 1 + cb) { const ch = tbl[a] | (tbl[a + 1] << 8); if (!ch) break; nm += String.fromCharCode(ch); a += 2; } fonts.push(nm); q += 1 + cb; } } catch (e) { }
    /* lists */
    const lists = {}, lfo = [];
    try {
      const L = fc(73);
      if (lcb(73)) {
        const n = tdv.getInt16(L, true); let q = L + 2; const lst = [];
        for (let k = 0; k < n; k++) { lst.push({ lsid: tdv.getInt32(q, true), simple: !!(tbl[q + 26] & 1) }); q += 28; }
        lst.forEach(l => {
          const lv = [];
          for (let k = 0; k < (l.simple ? 1 : 9); k++) {
            const start = tdv.getInt32(q, true), nfc = tbl[q + 4], cbChp = tbl[q + 24], cbPap = tbl[q + 25];
            q += 28 + cbPap + cbChp;
            const cch = tdv.getUint16(q, true); let txt = ''; for (let c = 0; c < cch; c++) txt += String.fromCharCode(tdv.getUint16(q + 2 + c * 2, true));
            q += 2 + cch * 2;
            lv.push({ start, nfc, txt });
          }
          lists[l.lsid] = lv;
        });
      }
      const F = fc(74);
      if (lcb(74)) { const n = tdv.getInt32(F, true); for (let k = 0; k < n; k++) lfo.push(tdv.getInt32(F + 4 + k * 16, true)); }
    } catch (e) { }
    const chpOf = f => {
      const r = find(chpRuns, f), o = {};
      if (!r || !r.b) return o;
      sprms(wd, r.b[0], r.b[1], (s, i) => {
        const v = wd[i];
        if (s === 0x0835) o.b = v === 1 || v === 0x81; else if (s === 0x0836) o.i = v === 1 || v === 0x81; else if (s === 0x0837) o.s = v === 1 || v === 0x81;
        else if (s === 0x2A3E) o.u = v !== 0; else if (s === 0x4A43) o.sz = (wd[i] | (wd[i + 1] << 8)) / 2;
        else if (s === 0x2A48) o.va = v === 1 ? 'sup' : v === 2 ? 'sub' : null;
        else if (s === 0x2A42) o.col = ICO[v] || null;
        else if (s === 0x6870) { if (!wd[i + 3]) o.col = '#' + [wd[i], wd[i + 1], wd[i + 2]].map(x => x.toString(16).padStart(2, '0')).join(''); }
        else if (s === 0x4A4F) o.font = fonts[wd[i] | (wd[i + 1] << 8)];
        else if (s === 0x2A0C) o.hl = ICO[v] || null;
        else if (s === 0x0838) o.cap = v === 1;
      });
      return o;
    };
    const papOf = f => {
      const r = find(papRuns, f), o = { istd: r ? r.istd : 0 };
      if (!r || !r.b) return o;
      sprms(wd, r.b[0], r.b[1], (s, i) => {
        const v = wd[i], i16 = (wd[i] | (wd[i + 1] << 8)) << 16 >> 16;
        if (s === 0x2403 || s === 0x2461) o.jc = v;
        else if (s === 0x2416) o.inTable = v === 1; else if (s === 0x2417) o.ttp = v === 1;
        else if (s === 0x6649 && i + 4 <= wd.length) o.itap = dv.getInt32(i, true);
        else if (s === 0x840F || s === 0x845E) o.left = i16; else if (s === 0x8411 || s === 0x8460) o.first = i16;
        else if (s === 0xA413) o.before = i16; else if (s === 0xA414) o.after = i16;
        else if (s === 0x460B) o.ilfo = i16; else if (s === 0x260A) o.ilvl = v;
        else if (s === 0x6412) { o.line = i16; o.mult = (wd[i + 2] | (wd[i + 3] << 8)); }
      });
      return o;
    };
    /* read a range of CPs into paragraphs of runs */
    const pieceAt = cp => pieces.find(pc => cp >= pc.cpS && cp < pc.cpE);
    function readRange(cpS, cpE, notes) {
      const paras = []; let cur = []; let fld = [];
      let run = null;
      const push = (t, f) => { if (fld.length && fld[fld.length - 1].inCode) { fld[fld.length - 1].code += t; return; } if (fld.length && fld[fld.length - 1].hide) return; const key = JSON.stringify(f); if (run && run.k === key) run.t += t; else { run = { k: key, f, t }; cur.push(run); } };
      for (let cp = cpS; cp < cpE; cp++) {
        const pc = pieceAt(cp); if (!pc) break;
        const [ch, fpos] = charAt(pc, cp);
        const c = ch.charCodeAt(0);
        if (c === 0x13) { fld.push({ code: '', inCode: true }); continue; }
        if (c === 0x14) { const f = fld[fld.length - 1]; if (f) { f.inCode = false; const m = f.code.trim().match(/^(PAGE|NUMPAGES)\b/i); if (m) { push(m[1].toUpperCase() === 'PAGE' ? '{PAGE}' : '{NUMPAGES}', chpOf(fpos)); f.hide = true; } } continue; }
        if (c === 0x15) { const f = fld.pop(); if (f && f.inCode) { const m = f.code.trim().match(/^(PAGE|NUMPAGES)\b/i); if (m) push(m[1].toUpperCase() === 'PAGE' ? '{PAGE}' : '{NUMPAGES}', chpOf(fpos)); } continue; }
        if (c === 0x0D || c === 0x07) {
          if (fld.length && fld[fld.length - 1].inCode) continue;
          paras.push({ runs: cur, pap: papOf(fpos), cell: c === 0x07 }); cur = []; run = null; continue;
        }
        if (c === 0x0B) { push('\n', chpOf(fpos)); continue; }
        if (c === 0x0C) { paras.push({ runs: cur, pap: papOf(fpos), pageBreak: true }); cur = []; run = null; continue; }
        if (c === 0x02 && notes) { const t = notes.shift(); if (t != null) cur.push({ note: t }); run = null; continue; }
        if (c === 0x1E) { push('-', chpOf(fpos)); continue; }
        if (c === 0x09) { push('\t', chpOf(fpos)); continue; }
        if (c < 0x20 || c === 0x1F) continue;
        push(ch, chpOf(fpos));
      }
      if (cur.length) paras.push({ runs: cur, pap: { istd: 0 } });
      return paras;
    }
    const esc2 = t => esc(t).replace(/\n/g, '<br>').replace(/\t/g, '<span style="white-space:pre">\t</span>');
    const runHtml = r => {
      if (r.note != null) return `<sup class="fn" contenteditable="false" data-note="${esc(r.note)}"></sup>`;
      const f = r.f; let t = esc2(f.cap ? r.t.toUpperCase() : r.t);
      if (!t) return '';
      const st = [];
      if (f.sz) st.push(`font-size:${f.sz}pt`); if (f.font) st.push(`font-family:'${f.font.replace(/'/g, '')}'`);
      if (f.col && f.col !== '#000000') st.push(`color:${f.col}`); if (f.hl) st.push(`background-color:${f.hl}`);
      if (st.length) t = `<span style="${st.join(';')}">${t}</span>`;
      if (f.b) t = `<b>${t}</b>`; if (f.i) t = `<i>${t}</i>`; if (f.u) t = `<u>${t}</u>`; if (f.s) t = `<s>${t}</s>`; if (f.va) t = `<${f.va}>${t}</${f.va}>`;
      return t;
    };
    const paraCss = pap => {
      const st = [];
      if (pap.jc === 1) st.push('text-align:center'); else if (pap.jc === 2) st.push('text-align:right'); else if (pap.jc === 3) st.push('text-align:justify');
      if (pap.left) st.push(`margin-left:${(pap.left / 1440).toFixed(2)}in`); if (pap.first) st.push(`text-indent:${(pap.first / 1440).toFixed(2)}in`);
      if (pap.before != null) st.push(`margin-top:${pap.before / 20}pt`); if (pap.after != null) st.push(`margin-bottom:${pap.after / 20}pt`);
      if (pap.line && pap.mult === 1 && pap.line > 0) st.push(`line-height:${(pap.line / 240).toFixed(2)}`);
      return st.length ? ` style="${st.join(';')}"` : '';
    };
    function toHtml(paras, forHF) {
      let out = '', i = 0;
      const listStack = [], curList = [];
      const closeLists = d => { while (listStack.length > d) out += `</li></${listStack.pop()}>`; };
      while (i < paras.length) {
        const pr = paras[i];
        if (pr.pap.inTable && !forHF) {
          // gather the table: cells end with a cell mark, rows end with a row mark (ttp)
          closeLists(0);
          let rows = [], row = [], cell = [];
          while (i < paras.length && paras[i].pap.inTable) {
            const q = paras[i];
            if (q.pap.ttp) { if (row.length) rows.push(row); row = []; cell = []; i++; continue; }
            cell.push(q);
            if (q.cell) { row.push(cell); cell = []; }
            i++;
          }
          if (row.length) rows.push(row);
          const cols = Math.max(1, ...rows.map(r => r.length));
          out += '<table style="width:100%;border-collapse:collapse">' + rows.map(r => '<tr>' + r.map(c => `<td style="border:0.75pt solid #000;padding:2px 6px;vertical-align:top;width:${(100 / cols).toFixed(1)}%">${c.map(q => `<p${paraCss(q.pap)}>${q.runs.map(runHtml).join('') || '<br>'}</p>`).join('')}</td>`).join('') + '</tr>').join('') + '</table>';
          continue;
        }
        const inner = pr.runs.map(runHtml).join('');
        const lv = pr.pap.ilfo > 0 && lfo[pr.pap.ilfo - 1] != null ? (lists[lfo[pr.pap.ilfo - 1]] || [])[pr.pap.ilvl || 0] : null;
        if (lv && !forHF) {
          const depth = (pr.pap.ilvl || 0) + 1, tag = lv.nfc === 23 || /^[•▪●\-o]/.test(lv.txt) ? 'ul' : 'ol';
          const type = { 1: 'I', 2: 'i', 3: 'A', 4: 'a' }[lv.nfc];
          if (listStack.length > depth) closeLists(depth);
          // a different list (or bullets after numbers) starts a new list
          if (listStack.length === depth && (curList[depth] !== pr.pap.ilfo || listStack[depth - 1] !== tag)) closeLists(depth - 1);
          curList[depth] = pr.pap.ilfo;
          if (listStack.length === depth) out += '</li>';
          while (listStack.length < depth) { out += `<${tag}${tag === 'ol' && type ? ` type="${type}"` : ''}${tag === 'ol' && lv.start > 1 ? ` start="${lv.start}"` : ''}>`; listStack.push(tag); }
          out += `<li>${inner || '<br>'}`;
          i++; continue;
        }
        closeLists(0);
        const hd = !forHF && pr.pap.istd >= 1 && pr.pap.istd <= 6 && inner.trim() ? 'h' + pr.pap.istd : 'p';
        out += `<${hd}${paraCss(pr.pap)}>${inner || '<br>'}</${hd}>`;
        if (pr.pageBreak && !forHF) out += '<hr class="pb">';
        i++;
      }
      closeLists(0);
      return out;
    }
    /* footnotes */
    let notes = [];
    try {
      if (lcb(3) && ccpFtn) {
        const f0 = fc(3), n = (lcb(3) - 4) / 4;
        for (let k = 0; k < n - 1; k++) {
          const s = ccpText + tdv.getUint32(f0 + k * 4, true), e = ccpText + tdv.getUint32(f0 + (k + 1) * 4, true);
          notes.push(readRange(s, e).map(pr => pr.runs.map(r => r.t || '').join('')).join(' ').replace(/[\u0002]/g, '').trim());
        }
      }
    } catch (e) { notes = []; }
    const body = toHtml(readRange(0, ccpText, notes.slice()));
    /* headers and footers of the first section */
    const settings = DEFAULT_SETTINGS();
    try {
      if (lcb(11) && ccpHdd) {
        const f0 = fc(11), n = lcb(11) / 4, base = ccpText + ccpFtn, at = k => tdv.getUint32(f0 + k * 4, true);
        const story = k => { if (k + 1 >= n) return ''; const s = at(k), e = at(k + 1); if (e - s <= 1) return ''; return toHtml(readRange(base + s, base + e), true).replace(/(<p[^>]*><br><\/p>)+$/, ''); };
        settings.header = story(7); settings.footer = story(9);
        const fh = story(10), ff = story(11);
        if (fh || ff) { settings.differentFirst = true; settings.firstHeader = fh; settings.firstFooter = ff; }
      }
    } catch (e) { }
    /* page setup from the section */
    try {
      const sed = fc(6);
      if (lcb(6) >= 16) {
        const nSed = (lcb(6) - 4) / 16, fcSepx = tdv.getInt32(sed + (nSed + 1) * 4 + 2, true);
        if (fcSepx > 0 && fcSepx < wd.length) {
          const cb = dv.getInt16(fcSepx, true);
          let W = 0, H = 0, m = {};
          sprms(wd, fcSepx + 2, fcSepx + 2 + cb, (s, i) => { if (i + 2 > wd.length) return; const v = dv.getInt16(i, true), u = dv.getUint16(i, true); if (s === 0xB01F) W = u; else if (s === 0xB020) H = u; else if (s === 0x9023) m.top = v; else if (s === 0x9024) m.bottom = v; else if (s === 0xB021) m.left = u; else if (s === 0xB022) m.right = u; else if (s === 0x301D) settings.orientation = wd[i] === 2 ? 'landscape' : 'portrait'; });
          for (const k in m) if (m[k] > 0) settings.margins[k] = Math.round(Math.abs(m[k]) / 1440 * 100) / 100;
          if (W && H) {
            const w = Math.min(W, H), hh = Math.max(W, H);
            let best = 'A4', bd = 1e9; for (const [k, v] of Object.entries(PAGE_PX)) { const d = Math.abs(v[0] * 15 - w) + Math.abs(v[1] * 15 - hh); if (d < bd) { bd = d; best = k; } }
            settings.pageSize = best;
            if (bd > 300) { settings.pageSize = 'Custom'; settings.pageW = Math.round(w / 1440 * 100) / 100; settings.pageH = Math.round(hh / 1440 * 100) / 100; }
          }
        }
      }
    } catch (e) { console.warn('doc page setup', e); }
    return { title: name.replace(/\.[^.]+$/, ''), html: body || '<p><br></p>', settings, comments: {} };
  }
  return { parse };
})();

/* ================= PDF ================= */
const PdfImport = (() => {
  let lib = null;
  async function load() {
    if (lib) return lib;
    lib = await import(new URL('js/vendor/pdf.min.mjs', location.href).href);
    lib.GlobalWorkerOptions.workerSrc = new URL('js/vendor/pdf.worker.min.mjs', location.href).href;
    return lib;
  }
  async function parse(buf, name, progress) {
    const pdfjs = await load();
    const task = pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false });
    let tries = 0;
    task.onPassword = async (update, reason) => {
      const pw = await askPassword('Password', `"${name}" is protected with a password. Enter it to open the PDF.`, reason === 2 ? 'The password is incorrect.' : '', false);
      if (pw == null || ++tries > 6) { task.destroy(); return; }
      update(pw);
    };
    const pdf = await task.promise;
    const pages = [], scanned = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      if (progress) progress(n, pdf.numPages);
      const pg = await pdf.getPage(n);
      const vp = pg.getViewport({ scale: 1 });
      await pg.getOperatorList(); // loads fonts so bold and italic can be told apart
      const tc = await pg.getTextContent();
      const items = tc.items.filter(it => it.str !== undefined && (it.str.trim() || it.hasEOL));
      if (!items.some(it => it.str.trim())) { scanned.push(n); pages.push({ n, image: await renderPage(pg), w: vp.width, h: vp.height }); continue; }
      const fontInfo = id => { try { const f = pg.commonObjs.get(id); const nm = (f && (f.name || f.loadedName)) || ''; return { b: /bold|black|heavy|semibold|demi/i.test(nm) || !!(f && f.bold), i: /italic|oblique/i.test(nm) || !!(f && f.italic) }; } catch (e) { return { b: false, i: false }; } };
      const runs = items.filter(it => it.str.trim() || it.str === ' ').map(it => {
        const [a, b, , d, e, f] = it.transform;
        const size = Math.hypot(b, d) || Math.hypot(a, b) || 10;
        return { s: it.str.replace(/[\uF0B7\uF0A7\uF076\uF0D8]/g, '•'), x: e, y: vp.height - f, w: it.width, size, fi: fontInfo(it.fontName) };
      });
      pages.push({ n, runs, w: vp.width, h: vp.height });
    }
    return build(pages, scanned, name);
  }
  async function renderPage(pg) {
    const vp = pg.getViewport({ scale: 1.6 });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    return c.toDataURL('image/jpeg', 0.85);
  }
  function lines(runs) {
    runs.sort((p, q) => p.y - q.y || p.x - q.x);
    const out = [];
    runs.forEach(r => {
      const L = out.find(l => Math.abs(l.y - r.y) < Math.max(2, r.size * 0.35));
      if (L) L.runs.push(r); else out.push({ y: r.y, runs: [r] });
    });
    out.forEach(l => {
      l.runs.sort((p, q) => p.x - q.x);
      l.x0 = l.runs[0].x; l.x1 = Math.max(...l.runs.map(r => r.x + r.w));
      l.size = Math.max(...l.runs.map(r => r.size));
      l.text = l.runs.map(r => r.s).join('');
    });
    return out.sort((p, q) => p.y - q.y);
  }
  function build(pages, scanned, name) {
    const textPages = pages.filter(p => p.runs);
    // body text size = the most common size
    const sizes = {}; textPages.forEach(p => p.runs.forEach(r => { const k = Math.round(r.size * 2) / 2; sizes[k] = (sizes[k] || 0) + r.s.length; }));
    const body = +Object.entries(sizes).sort((a, b) => b[1] - a[1])[0]?.[0] || 11;
    // lines that repeat at the top or bottom of most pages (running headers, page numbers) are dropped
    const pl = textPages.map(p => ({ p, ls: lines(p.runs) }));
    const norm = t => t.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
    const edgeCount = {};
    pl.forEach(({ p, ls }) => [...ls.filter(l => l.y < p.h * 0.1), ...ls.filter(l => l.y > p.h * 0.9)].forEach(l => { const k = norm(l.text); edgeCount[k] = (edgeCount[k] || 0) + 1; }));
    const isRunning = (l, p) => (l.y < p.h * 0.1 || l.y > p.h * 0.9) && (pl.length > 2 && edgeCount[norm(l.text)] >= Math.max(2, pl.length * 0.5) || /^(page\s*)?\d+(\s*(of|\/)\s*\d+)?$/i.test(l.text.trim()));
    let html = '', left = 1e9, right = 0, pw = 612, ph = 792;
    pl.forEach(({ p, ls }) => { pw = p.w; ph = p.h; ls.forEach(l => { if (!isRunning(l, p)) { left = Math.min(left, l.x0); right = Math.max(right, l.x1); } }); });
    const textW = Math.max(100, right - left);
    const runHtml = (r, prev) => {
      let t = esc(r.s);
      if (prev && r.x - (prev.x + prev.w) > r.size * 0.12 && !/\s$/.test(prev.s) && !/^\s/.test(r.s)) t = (r.x - (prev.x + prev.w) > r.size * 2.5 ? '<span style="white-space:pre">\t</span>' : ' ') + t;
      const k = Math.round(r.size * 2) / 2;
      if (Math.abs(k - body) >= 1) t = `<span style="font-size:${k}pt">${t}</span>`;
      if (r.fi.b) t = `<b>${t}</b>`; if (r.fi.i) t = `<i>${t}</i>`;
      return t;
    };
    const hasTabs = l => l.runs.some((r, i) => i && r.x - (l.runs[i - 1].x + l.runs[i - 1].w) > r.size * 2.5);
    const lineHtml = l => l.runs.map((r, i) => runHtml(r, l.runs[i - 1])).join('').replace(/<\/b><b>/g, '').replace(/<\/i><i>/g, '');
    pages.forEach((p, pi) => {
      if (p.image) { html += `<p style="text-align:center"><img src="${p.image}" alt="Page ${p.n}" style="width:100%"></p>`; if (pi < pages.length - 1) html += '<hr class="pb">'; return; }
      const ls = pl.find(x => x.p === p).ls.filter(l => !isRunning(l, p));
      let para = null;
      const flush = () => {
        if (!para) return;
        const c = (para.x0 + para.x1) / 2, mid = left + textW / 2;
        const centered = para.lines.length <= 3 && Math.abs(c - mid) < textW * 0.06 && para.x0 - left > textW * 0.08;
        const rightAl = !centered && para.x0 - left > textW * 0.45 && Math.abs(para.x1 - right) < body;
        const ind = para.x0 - left > body * 1.5 && !centered && !rightAl ? `margin-left:${((para.x0 - left) / 72).toFixed(2)}in;` : '';
        const first = !ind && para.firstX - left > body && !centered ? `text-indent:${((para.firstX - left) / 72).toFixed(2)}in;` : '';
        const just = para.lines.length > 2 && !centered && !rightAl ? 'text-align:justify;' : '';
        const big = para.size >= body * 1.35;
        const tag = big && para.lines.length <= 2 ? (para.size >= body * 1.7 ? 'h1' : 'h2') : 'p';
        const st = (centered ? 'text-align:center;' : rightAl ? 'text-align:right;' : just) + ind + first;
        html += `<${tag}${st ? ` style="${st}"` : ''}>${para.html}</${tag}>`;
        para = null;
      };
      ls.forEach((l, i) => {
        const prev = ls[i - 1];
        const gap = prev ? l.y - prev.y : 0;
        const prevShort = prev && prev.x1 < right - body * 4;
        const newPara = !para || hasTabs(l) || (prev && hasTabs(prev)) || gap > l.size * 1.75 || Math.abs(l.size - para.size) > 1.5 || (prevShort && /[.:;!?)]$/.test(prev.text.trim())) || (Math.abs(l.x0 - para.x0) > body * 2 && !(para.lines.length === 1 && l.x0 < para.firstX)) || /^\s*(\(?\d{1,3}[.)]|\(?[a-z]\)|[ivx]+\.|[•●▪\-])\s/i.test(l.text) && prev;
        if (newPara) { flush(); para = { lines: [], html: '', x0: l.x0, x1: l.x1, firstX: l.x0, size: l.size }; }
        else { para.html += /-$/.test(para.lines[para.lines.length - 1].text) ? '' : ' '; para.x0 = Math.min(para.x0, l.x0); }
        para.lines.push(l); para.html += lineHtml(l); para.x1 = Math.max(para.x1, l.x1);
      });
      flush();
    });
    const settings = DEFAULT_SETTINGS();
    let best = 'A4', bd = 1e9; for (const [k, v] of Object.entries(PAGE_PX)) { const d = Math.abs(v[0] * 0.75 - Math.min(pw, ph)) + Math.abs(v[1] * 0.75 - Math.max(pw, ph)); if (d < bd) { bd = d; best = k; } }
    settings.pageSize = best; settings.orientation = pw > ph ? 'landscape' : 'portrait';
    if (left < 1e9) { const ml = Math.max(0.4, Math.min(2, Math.round(left / 72 * 10) / 10)), mr = Math.max(0.4, Math.min(2, Math.round((pw - right) / 72 * 10) / 10)); settings.margins.left = ml; settings.margins.right = mr; }
    settings.theme = Object.assign({}, settings.theme, { size: Math.round(body * 2) / 2 });
    return { title: name.replace(/\.[^.]+$/, ''), html: html || '<p><br></p>', settings, comments: {}, scanned };
  }
  return { parse };
})();
