/* DraftLy: Office Open XML (.docx) -> editable HTML reader. */
const DocxImport = (() => {
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const kids = (el, name) => el ? [...el.children].filter(c => !name || c.localName === name) : [];
  const child = (el, name) => el ? [...el.children].find(c => c.localName === name) || null : null;
  const desc = (el, name) => el ? el.getElementsByTagNameNS('*', name)[0] || null : null;
  const attr = (el, name) => {
    if (!el) return null;
    let v = el.getAttributeNS(W, name);
    if (v === null || v === '') v = el.getAttribute('w:' + name);
    if (v === null || v === '') v = el.getAttribute(name);
    return v === '' ? null : v;
  };
  const rid = (el, name) => el ? (el.getAttributeNS(R, name) || el.getAttribute('r:' + name)) : null;
  const on = el => { if (!el) return undefined; const v = attr(el, 'val'); return !(v === 'false' || v === '0' || v === 'off' || v === 'none'); };
  const tw2px = v => Math.round((+v || 0) / 15 * 100) / 100;
  const HL = { yellow: '#FFFF00', green: '#00FF00', cyan: '#00FFFF', magenta: '#FF00FF', blue: '#0000FF', red: '#FF0000', darkBlue: '#000080', darkCyan: '#008080', darkGreen: '#008000', darkMagenta: '#800080', darkRed: '#800000', darkYellow: '#808000', darkGray: '#808080', lightGray: '#C0C0C0', black: '#000000', white: '#FFFFFF' };
  const xml = s => new DOMParser().parseFromString(s, 'application/xml');

  async function parse(buf, fileName) {
    const z = await Zip.read(buf);
    const readXml = async p => { const t = await z.text(p); return t ? xml(t) : null; };
    const relsOf = async partPath => {
      const dir = partPath.substring(0, partPath.lastIndexOf('/') + 1);
      const relPath = dir + '_rels/' + partPath.substring(dir.length) + '.rels';
      const d = await readXml(relPath);
      const map = {};
      if (d) for (const r of d.getElementsByTagName('Relationship')) {
        const target = r.getAttribute('Target');
        const ext = r.getAttribute('TargetMode') === 'External';
        map[r.getAttribute('Id')] = { type: (r.getAttribute('Type') || '').split('/').pop(), target, external: ext, path: ext ? null : resolvePath(dir, target) };
      }
      return map;
    };
    const resolvePath = (dir, target) => {
      if (target.startsWith('/')) return target.slice(1);
      const parts = (dir + target).split('/'), out = [];
      for (const p of parts) { if (p === '..') out.pop(); else if (p !== '.') out.push(p); }
      return out.join('/');
    };
    const imgCache = {};
    const loadImages = async rels => {
      for (const id in rels) {
        const r = rels[id];
        if (r.type !== 'image' || r.external || imgCache[r.path]) continue;
        const bytes = await z.bytes(r.path);
        if (!bytes) continue;
        const ext = r.path.split('.').pop().toLowerCase();
        const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', webp: 'image/webp', tif: 'image/tiff', tiff: 'image/tiff', emf: 'image/emf', wmf: 'image/wmf' }[ext] || 'application/octet-stream';
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        imgCache[r.path] = `data:${mime};base64,${btoa(bin)}`;
      }
    };

    // locate main document
    let mainPath = 'word/document.xml';
    const rootRels = await readXml('_rels/.rels');
    if (rootRels) for (const r of rootRels.getElementsByTagName('Relationship')) if ((r.getAttribute('Type') || '').endsWith('/officeDocument')) mainPath = r.getAttribute('Target').replace(/^\//, '');
    const docXml = await readXml(mainPath);
    if (!docXml || !desc(docXml, 'body')) throw new Error('Could not find the document body in this file.');
    const docRels = await relsOf(mainPath);
    await loadImages(docRels);
    const relFile = type => { const r = Object.values(docRels).find(x => x.type === type); return r ? r.path : null; };

    /* theme fonts */
    const themeFonts = { minor: null, major: null };
    const themeP = relFile('theme');
    if (themeP) {
      const th = await readXml(themeP);
      if (th) {
        const mn = desc(th, 'minorFont'), mj = desc(th, 'majorFont');
        themeFonts.minor = mn && child(mn, 'latin') ? child(mn, 'latin').getAttribute('typeface') : null;
        themeFonts.major = mj && child(mj, 'latin') ? child(mj, 'latin').getAttribute('typeface') : null;
      }
    }
    const fontOf = rf => {
      if (!rf) return null;
      const a = attr(rf, 'ascii') || attr(rf, 'hAnsi');
      if (a) return a;
      const t = attr(rf, 'asciiTheme') || attr(rf, 'hAnsiTheme');
      if (t) return t.startsWith('major') ? themeFonts.major : themeFonts.minor;
      return null;
    };

    /* styles */
    const styles = {};
    let defaults = { rPr: null, pPr: null };
    const stylesP = relFile('styles');
    if (stylesP) {
      const sd = await readXml(stylesP);
      if (sd) {
        const dd = desc(sd, 'docDefaults');
        if (dd) { defaults.rPr = desc(dd, 'rPr'); defaults.pPr = desc(dd, 'pPr'); }
        for (const s of sd.getElementsByTagNameNS('*', 'style')) {
          const id = attr(s, 'styleId');
          styles[id] = { id, type: attr(s, 'type'), name: (attr(child(s, 'name'), 'val') || id || '').toLowerCase(), basedOn: attr(child(s, 'basedOn'), 'val'), pPr: child(s, 'pPr'), rPr: child(s, 'rPr'), tblPr: child(s, 'tblPr'), isDefault: attr(s, 'default') === '1' };
        }
      }
    }
    const chain = id => { const out = []; let g = 0; while (id && styles[id] && g++ < 20) { out.unshift(styles[id]); id = styles[id].basedOn; } return out; };

    /* numbering */
    const abstracts = {}, nums = {};
    const numP = relFile('numbering');
    if (numP) {
      const nd = await readXml(numP);
      if (nd) {
        for (const a of nd.getElementsByTagNameNS('*', 'abstractNum')) {
          const lv = {};
          for (const l of kids(a, 'lvl')) lv[attr(l, 'ilvl')] = { fmt: attr(child(l, 'numFmt'), 'val') || 'decimal', text: attr(child(l, 'lvlText'), 'val') || '', start: +(attr(child(l, 'start'), 'val') || 1) };
          abstracts[attr(a, 'abstractNumId')] = lv;
        }
        for (const n of nd.getElementsByTagNameNS('*', 'num')) {
          const ov = {};
          for (const o of kids(n, 'lvlOverride')) { const so = child(o, 'startOverride'); if (so) ov[attr(o, 'ilvl')] = +attr(so, 'val'); }
          nums[attr(n, 'numId')] = { abs: attr(child(n, 'abstractNumId'), 'val'), ov };
        }
      }
    }
    const levelInfo = (numId, ilvl) => {
      const n = nums[numId]; const a = n && abstracts[n.abs];
      const l = (a && a[ilvl]) || { fmt: 'decimal', text: '%1.', start: 1 };
      const start = n && n.ov[ilvl] != null ? n.ov[ilvl] : l.start;
      let tag = 'ol', lst = null;
      const paren = /^\(%\d\)$/.test(l.text), close = /^%\d\)$/.test(l.text);
      switch (l.fmt) {
        case 'bullet': tag = 'ul'; lst = /[▪■§]/.test(l.text) ? 'square' : (l.text === 'o' ? 'circle' : null); break;
        case 'lowerLetter': lst = paren ? 'paren-lower-alpha' : 'lower-alpha'; break;
        case 'upperLetter': lst = paren ? 'paren-upper-alpha' : 'upper-alpha'; break;
        case 'lowerRoman': lst = paren ? 'paren-lower-roman' : 'lower-roman'; break;
        case 'upperRoman': lst = 'upper-roman'; break;
        case 'none': lst = 'none'; break;
        default: lst = paren ? 'paren-decimal' : close ? 'decimal-paren' : null;
      }
      return { tag, lst, start };
    };

    /* comments & footnotes */
    const comments = {};
    const cmtP = relFile('comments');
    if (cmtP) {
      const cd = await readXml(cmtP);
      if (cd) for (const c of cd.getElementsByTagNameNS('*', 'comment')) {
        const text = kids(c, 'p').map(p => [...p.getElementsByTagNameNS('*', 't')].map(t => t.textContent).join('')).join('\n');
        comments[attr(c, 'id')] = { cid: 'c' + Math.random().toString(36).slice(2, 9), author: attr(c, 'author') || 'Author', date: attr(c, 'date') || new Date().toISOString(), text, replies: [] };
      }
    }
    const notes = {};
    for (const [type, tag] of [['footnotes', 'footnote'], ['endnotes', 'endnote']]) {
      const p = relFile(type);
      if (!p) continue;
      const fd = await readXml(p);
      if (fd) for (const f of fd.getElementsByTagNameNS('*', tag)) notes[tag + attr(f, 'id')] = kids(f, 'p').map(pp => [...pp.getElementsByTagNameNS('*', 't')].map(t => t.textContent).join('')).join(' ').trim();
    }

    /* ---------- run properties ---------- */
    function rProps(rPr, base) {
      const p = Object.assign({}, base || {});
      if (!rPr) return p;
      const rs = attr(child(rPr, 'rStyle'), 'val');
      if (rs) chain(rs).forEach(s => Object.assign(p, rProps(s.rPr)));
      for (const c of rPr.children) {
        switch (c.localName) {
          case 'b': p.b = on(c); break;
          case 'i': p.i = on(c); break;
          case 'u': p.u = on(c); break;
          case 'strike': case 'dstrike': p.s = on(c); break;
          case 'caps': p.caps = on(c); break;
          case 'smallCaps': p.sc = on(c); break;
          case 'vanish': p.hidden = on(c); break;
          case 'vertAlign': p.va = attr(c, 'val'); break;
          case 'color': { const v = attr(c, 'val'); if (v && v !== 'auto') p.color = '#' + v; break; }
          case 'sz': p.size = (+attr(c, 'val')) / 2; break;
          case 'rFonts': { const f = fontOf(c); if (f) p.font = f; break; }
          case 'highlight': { const v = attr(c, 'val'); if (HL[v]) p.hl = HL[v]; break; }
          case 'shd': { const f = attr(c, 'fill'); if (f && f !== 'auto' && f.toUpperCase() !== 'FFFFFF') p.hl = '#' + f; break; }
        }
      }
      return p;
    }
    function runCss(p) {
      let css = '';
      if (p.font) css += `font-family:'${p.font.replace(/'/g, '')}';`;
      if (p.size) css += `font-size:${p.size}pt;`;
      if (p.color) css += `color:${p.color};`;
      if (p.hl) css += `background-color:${p.hl};`;
      if (p.caps) css += 'text-transform:uppercase;';
      if (p.sc) css += 'font-variant:small-caps;';
      if (p.b === false) css += 'font-weight:normal;';
      if (p.i === false) css += 'font-style:normal;';
      return css;
    }
    function wrapRun(html, p) {
      if (!html) return '';
      if (p.va === 'superscript') html = `<sup>${html}</sup>`;
      else if (p.va === 'subscript') html = `<sub>${html}</sub>`;
      if (p.s) html = `<s>${html}</s>`;
      if (p.u) html = `<u>${html}</u>`;
      if (p.i) html = `<i>${html}</i>`;
      if (p.b) html = `<b>${html}</b>`;
      const css = runCss(p);
      if (css) html = `<span style="${esc(css)}">${html}</span>`;
      return html;
    }

    /* ---------- inline content ---------- */
    function imgFrom(el, part) {
      const blip = desc(el, 'blip') || desc(el, 'imagedata');
      if (!blip) return '';
      const id = rid(blip, 'embed') || rid(blip, 'id') || rid(blip, 'link');
      const rel = part.rels[id];
      if (!rel) return '';
      const src = rel.external ? rel.target : imgCache[rel.path];
      if (!src) return '';
      let w = null, h = null;
      const ext = desc(el, 'extent');
      if (ext) { w = Math.round(+ext.getAttribute('cx') / 9525); h = Math.round(+ext.getAttribute('cy') / 9525); }
      else {
        const shape = desc(el, 'shape'); const st = shape && shape.getAttribute('style');
        if (st) { const mw = st.match(/width:([\d.]+)pt/), mh = st.match(/height:([\d.]+)pt/); if (mw) w = Math.round(mw[1] * 96 / 72); if (mh) h = Math.round(mh[1] * 96 / 72); }
      }
      let cls = '';
      const anchor = desc(el, 'anchor');
      if (anchor) {
        const align = desc(anchor, 'align');
        const a = align && align.textContent;
        if (desc(anchor, 'wrapSquare') || desc(anchor, 'wrapTight')) cls = a === 'right' ? 'fr' : a === 'center' ? 'ctr' : 'fl';
      }
      const alt = (desc(el, 'docPr') && desc(el, 'docPr').getAttribute('descr')) || '';
      return `<img src="${src}"${cls ? ` class="${cls}"` : ''} alt="${esc(alt)}"${w ? ` style="width:${w}px;height:${h}px"` : ''}>`;
    }
    function textboxFrom(el, part, st) {
      const tx = desc(el, 'txbxContent');
      if (!tx) return '';
      return kids(tx, 'p').map(p => inline(p.children, part, st, {})).join('<br>');
    }
    function convRun(r, part, st, base) {
      const p = rProps(child(r, 'rPr'), base);
      if (p.hidden) return '';
      let html = '';
      for (const c of r.children) {
        const ln = c.localName;
        const fld = st.fld[st.fld.length - 1];
        if (ln === 'fldChar') {
          const t = attr(c, 'fldCharType');
          if (t === 'begin') st.fld.push({ instr: '', phase: 'instr' });
          else if (t === 'separate' && fld) {
            fld.phase = 'result';
            const ins = fld.instr.trim();
            const m = ins.match(/^(PAGE|NUMPAGES|SECTIONPAGES)\b/i);
            if (m) { fld.suppress = true; html += m[1].toUpperCase() === 'PAGE' ? '{PAGE}' : '{NUMPAGES}'; }
            const hl = ins.match(/^HYPERLINK\s+"([^"]+)"/i);
            if (hl) fld.link = hl[1];
          } else if (t === 'end') {
            if (fld && fld.phase === 'instr') { const m = fld.instr.trim().match(/^(PAGE|NUMPAGES)\b/i); if (m) html += m[1].toUpperCase() === 'PAGE' ? '{PAGE}' : '{NUMPAGES}'; }
            st.fld.pop();
          }
          continue;
        }
        if (ln === 'instrText') { if (fld) fld.instr += c.textContent; continue; }
        if (fld && (fld.phase === 'instr' || fld.suppress)) continue;
        switch (ln) {
          case 't': case 'delText': html += esc(c.textContent); break;
          case 'tab': case 'ptab': html += '\t'; break;
          case 'br': {
            const t = attr(c, 'type');
            if (t === 'page' || t === 'column') { if (st.hasText) st.pbAfter = true; else st.pbBefore = true; }
            else html += '<br>';
            break;
          }
          case 'cr': html += '<br>'; break;
          case 'noBreakHyphen': html += '‑'; break;
          case 'sym': { const ch = attr(c, 'char'); if (ch) { let code = parseInt(ch, 16); if (code >= 0xF000) code -= 0xF000; html += esc(String.fromCharCode(code)); } break; }
          case 'drawing': case 'pict': case 'object': html += imgFrom(c, part) || textboxFrom(c, part, st); break;
          case 'footnoteReference': case 'endnoteReference': {
            const key = (ln === 'footnoteReference' ? 'footnote' : 'endnote') + attr(c, 'id');
            html += `<sup class="fn" contenteditable="false" data-note="${esc(notes[key] || '')}"></sup>`;
            break;
          }
          case 'AlternateContent': { const ch = child(c, 'Choice') || child(c, 'Fallback'); if (ch) html += imgFrom(ch, part) || textboxFrom(ch, part, st); break; }
        }
      }
      if (html.includes('class="fn"')) p.va = null;
      if (/[^\s]/.test(html.replace(/<[^>]+>/g, ''))) st.hasText = true;
      let out = wrapRun(html, p);
      const openFld = st.fld[st.fld.length - 1];
      if (openFld && openFld.link && openFld.phase === 'result' && out) out = `<a href="${esc(openFld.link)}">${out}</a>`;
      for (const cid of st.active) if (comments[cid]) out = `<span class="cmt" data-cid="${comments[cid].cid}">${out}</span>`;
      return out;
    }
    function inline(nodes, part, st, base) {
      let html = '';
      for (const n of nodes) {
        switch (n.localName) {
          case 'r': html += convRun(n, part, st, base); break;
          case 'hyperlink': {
            const id = rid(n, 'id'), anc = attr(n, 'anchor');
            const href = id && part.rels[id] ? part.rels[id].target : anc ? '#' + anc : null;
            const inner = inline(n.children, part, st, base);
            html += href ? `<a href="${esc(href)}">${inner}</a>` : inner;
            break;
          }
          case 'ins': case 'moveTo': {
            const inner = inline(n.children, part, st, base);
            if (inner) html += `<ins class="tc" data-author="${esc(attr(n, 'author') || 'Author')}" data-date="${esc(attr(n, 'date') || '')}">${inner}</ins>`;
            break;
          }
          case 'del': case 'moveFrom': {
            const inner = inline(n.children, part, st, base);
            if (inner) html += `<del class="tc" data-author="${esc(attr(n, 'author') || 'Author')}" data-date="${esc(attr(n, 'date') || '')}">${inner}</del>`;
            break;
          }
          case 'commentRangeStart': st.active.add(attr(n, 'id')); break;
          case 'commentRangeEnd': st.active.delete(attr(n, 'id')); break;
          case 'fldSimple': {
            const ins = (attr(n, 'instr') || '').trim();
            const m = ins.match(/^(PAGE|NUMPAGES)\b/i);
            if (m) html += m[1].toUpperCase() === 'PAGE' ? '{PAGE}' : '{NUMPAGES}';
            else html += inline(n.children, part, st, base);
            break;
          }
          case 'smartTag': case 'customXml': case 'bdo': case 'dir': html += inline(n.children, part, st, base); break;
          case 'sdt': html += inline(kids(child(n, 'sdtContent')), part, st, base); break;
          case 'oMath': case 'oMathPara': html += `<i>${esc(n.textContent)}</i>`; break;
        }
      }
      return html;
    }

    /* ---------- paragraphs ---------- */
    function pProps(pPr, into) {
      const p = into || {};
      if (!pPr) return p;
      for (const c of pPr.children) {
        switch (c.localName) {
          case 'jc': { const v = attr(c, 'val'); p.align = { both: 'justify', distribute: 'justify', center: 'center', right: 'right', end: 'right', left: 'left', start: 'left' }[v] || null; break; }
          case 'ind': {
            const l = attr(c, 'left') ?? attr(c, 'start'), r = attr(c, 'right') ?? attr(c, 'end'), h = attr(c, 'hanging'), f = attr(c, 'firstLine');
            if (l != null) p.left = tw2px(l);
            if (r != null) p.right = tw2px(r);
            if (h != null) p.indent = -tw2px(h); else if (f != null) p.indent = tw2px(f);
            break;
          }
          case 'spacing': {
            const b = attr(c, 'before'), a = attr(c, 'after'), l = attr(c, 'line'), lr = attr(c, 'lineRule');
            if (b != null && attr(c, 'beforeAutospacing') !== '1') p.before = tw2px(b);
            if (a != null && attr(c, 'afterAutospacing') !== '1') p.after = tw2px(a);
            if (l != null) p.line = (!lr || lr === 'auto') ? Math.round(+l / 240 * 100) / 100 : tw2px(l) + 'px';
            break;
          }
          case 'numPr': { const id = attr(child(c, 'numId'), 'val'); p.num = id && id !== '0' ? { id, ilvl: +(attr(child(c, 'ilvl'), 'val') || 0) } : null; break; }
          case 'outlineLvl': p.outline = +attr(c, 'val'); break;
          case 'pageBreakBefore': p.pbb = on(c); break;
          case 'shd': { const f = attr(c, 'fill'); if (f && f !== 'auto') p.shade = '#' + f; break; }
          case 'pBdr': p.border = !!child(c, 'bottom') && attr(child(c, 'bottom'), 'val') !== 'none'; break;
          case 'keepNext': p.keepNext = on(c); break;
        }
      }
      return p;
    }
    const BUILTIN = { 'heading 1': 'h1', 'heading 2': 'h2', 'heading 3': 'h3', 'heading 4': 'h4', 'heading 5': 'h5', 'heading 6': 'h6', title: 'p.s-Title', subtitle: 'p.s-Subtitle', quote: 'p.s-Quote', 'intense quote': 'p.s-IntenseQuote', 'no spacing': 'p.s-NoSpacing' };
    function convP(p, part, st) {
      const pPr = child(p, 'pPr');
      const sid = attr(child(pPr, 'pStyle'), 'val') || Object.values(styles).find(s => s.type === 'paragraph' && s.isDefault)?.id;
      const ch = chain(sid);
      // style-level paragraph and run properties
      const sp = {};
      ch.forEach(s => pProps(s.pPr, sp));
      let base = {};
      ch.forEach(s => { base = rProps(s.rPr, base); });
      const dp = pProps(pPr, {});
      const P = Object.assign({}, sp, dp);
      if (dp.num === null) P.num = null;
      let builtin = null;
      for (const s of ch.slice().reverse()) { if (BUILTIN[s.name]) { builtin = BUILTIN[s.name]; break; } }
      if (!builtin && P.outline != null && P.outline < 6) builtin = 'h' + (P.outline + 1);
      const isNormal = !sid || (styles[sid] && (styles[sid].isDefault || styles[sid].name === 'normal'));
      const isList = ch.some(s => s.name === 'list paragraph');
      st.hasText = false; st.pbBefore = !!P.pbb; st.pbAfter = false;
      const runBase = builtin || isNormal || isList ? {} : base;
      let inner = inline(p.children, part, st, runBase);
      // section break inside paragraph
      const sect = pPr && child(pPr, 'sectPr');
      if (sect) { const t = attr(child(sect, 'type'), 'val'); if (!t || t === 'nextPage' || t === 'oddPage' || t === 'evenPage') st.pbAfter = true; }
      let tag = 'p', cls = '';
      if (builtin) { const [t, c] = builtin.split('.'); tag = t; cls = c || ''; }
      let css = '';
      const custom = !builtin && !isNormal && !isList;
      const usePara = custom ? P : dp;
      if (usePara.align) css += `text-align:${usePara.align};`;
      if (!P.num) {
        if (usePara.left) css += `margin-left:${usePara.left}px;`;
        if (usePara.indent) css += `text-indent:${usePara.indent}px;`;
      }
      if (usePara.right) css += `margin-right:${usePara.right}px;`;
      if (usePara.before != null) css += `margin-top:${usePara.before}px;`;
      if (usePara.after != null) css += `margin-bottom:${usePara.after}px;`;
      if (usePara.line != null) css += `line-height:${usePara.line};`;
      if (P.shade && P.shade.toUpperCase() !== '#FFFFFF') css += `background-color:${P.shade};`;
      if (custom) css += runCss(base) + (base.b ? 'font-weight:bold;' : '') + (base.i ? 'font-style:italic;' : '');
      const textOnly = inner.replace(/<[^>]+>/g, '').trim();
      if (P.border && !textOnly && !/<img/.test(inner)) return { html: '<hr>', pbBefore: st.pbBefore, pbAfter: st.pbAfter };
      const attrs = (cls ? ` class="${cls}"` : '') + (css ? ` style="${esc(css)}"` : '');
      const body = inner || '<br>';
      return { html: `<${tag}${attrs}>${body}</${tag}>`, num: P.num, tag, attrs, inner: body, pbBefore: st.pbBefore, pbAfter: st.pbAfter, align: usePara.align };
    }

    /* ---------- tables ---------- */
    function convTbl(tbl, part, st) {
      const tblPr = child(tbl, 'tblPr');
      const sid = attr(child(tblPr, 'tblStyle'), 'val');
      let bordered = false;
      const bd = child(tblPr, 'tblBorders') || chain(sid).map(s => s.tblPr && child(s.tblPr, 'tblBorders')).filter(Boolean).pop();
      if (bd) bordered = [...bd.children].some(b => { const v = attr(b, 'val'); return v && v !== 'none' && v !== 'nil'; });
      const cols = kids(child(tbl, 'tblGrid'), 'gridCol').map(g => +attr(g, 'w') || 0);
      const totalW = cols.reduce((a, b) => a + b, 0);
      const rows = [], origins = {};
      for (const tr of kids(tbl, 'tr')) {
        const trHgt = desc(child(tr, 'trPr'), 'trHeight');
        const rowH = trHgt && attr(trHgt, 'val') ? tw2px(attr(trHgt, 'val')) : 0;
        const row = { cells: [], header: !!desc(child(tr, 'trPr'), 'tblHeader') };
        let gc = 0;
        const cells = [];
        for (const n of tr.children) {
          if (n.localName === 'tc') cells.push(n);
          else if (n.localName === 'sdt') kids(child(n, 'sdtContent'), 'tc').forEach(c => cells.push(c));
        }
        for (const tc of cells) {
          const tcPr = child(tc, 'tcPr');
          const span = +(attr(child(tcPr, 'gridSpan'), 'val') || 1);
          const vm = child(tcPr, 'vMerge');
          if (vm && attr(vm, 'val') !== 'restart') {
            if (origins[gc]) origins[gc].rowspan++;
            gc += span; continue;
          }
          const cell = { span, rowspan: 1, html: '', css: rowH > 24 ? `height:${Math.round(rowH)}px;` : '' };
          const shd = child(tcPr, 'shd'), fill = shd && attr(shd, 'fill');
          if (fill && fill !== 'auto') cell.css += `background-color:#${fill};`;
          const va = attr(child(tcPr, 'vAlign'), 'val');
          if (va === 'center') cell.css += 'vertical-align:middle;'; else if (va === 'bottom') cell.css += 'vertical-align:bottom;';
          cell.html = blocks(tc.children, part, st) || '<p><br></p>';
          for (let k = 0; k < span; k++) delete origins[gc + k];
          if (vm) origins[gc] = cell;
          row.cells.push(cell);
          gc += span;
        }
        rows.push(row);
      }
      let tstyle = '';
      if (bd) {
        const tb = [...bd.children].find(b => { const v = attr(b, 'val'); return v && v !== 'none' && v !== 'nil'; });
        if (tb) {
          const col = attr(tb, 'color'), sz = +attr(tb, 'sz');
          if (col && col !== 'auto' && col.toUpperCase() !== '000000') tstyle += `--bc:#${col};`;
          if (sz && sz !== 4) tstyle += `--bw:${sz / 8}pt;`;
        }
      }
      let h = `<table${bordered ? '' : ' class="nb"'}${tstyle ? ` style="${tstyle}"` : ''}>`;
      if (totalW) h += '<colgroup>' + cols.map(w => `<col style="width:${Math.round(w / totalW * 1000) / 10}%">`).join('') + '</colgroup>';
      h += '<tbody>';
      for (const r of rows) {
        h += '<tr>' + r.cells.map(c => `<td${c.span > 1 ? ` colspan="${c.span}"` : ''}${c.rowspan > 1 ? ` rowspan="${c.rowspan}"` : ''}${c.css ? ` style="${c.css}"` : ''}>${c.html}</td>`).join('') + '</tr>';
      }
      return h + '</tbody></table>';
    }

    /* ---------- block assembly with list grouping ---------- */
    function blocks(nodes, part, st) {
      const items = [];
      const walk = list => {
        for (const n of list) {
          switch (n.localName) {
            case 'p': {
              const psid = attr(child(child(n, 'pPr'), 'pStyle'), 'val');
              const pname = psid && styles[psid] ? styles[psid].name : (psid || '').toLowerCase();
              if (/^toc ?(heading|\d)$/.test(pname) || /^toc(heading|\d)$/i.test(psid || '')) {
                if (!(items.length && items[items.length - 1].toc)) items.push({ html: '<div class="toc" contenteditable="false" data-regen="1"></div>', toc: true });
                break;
              }
              const r = convP(n, part, st);
              if (r.pbBefore) items.push({ html: '<hr class="pb">' });
              items.push(r);
              if (r.pbAfter) items.push({ html: '<hr class="pb">' });
              break;
            }
            case 'tbl': items.push({ html: convTbl(n, part, st) }); break;
            case 'sdt': {
              const gal = desc(child(n, 'sdtPr'), 'docPartGallery');
              if (gal && /Table of Contents/i.test(attr(gal, 'val') || '')) { if (!(items.length && items[items.length - 1].toc)) items.push({ html: '<div class="toc" contenteditable="false" data-regen="1"></div>', toc: true }); }
              else walk(kids(child(n, 'sdtContent')));
              break;
            }
            case 'customXml': case 'smartTag': walk(kids(n)); break;
            case 'AlternateContent': walk(kids(child(n, 'Fallback') || child(n, 'Choice'))); break;
          }
        }
      };
      walk(nodes);
      // group numbered paragraphs into nested lists, continuing numbering across interruptions
      let out = '';
      const stack = [];
      const counters = st.counters;
      const close = d => { while (stack.length > d) out += `</li></${stack.pop().tag}>`; };
      for (const it of items) {
        if (!it.num) { close(0); out += it.html; continue; }
        const { ilvl } = it.num;
        const nn = nums[it.num.id];
        // Word keeps one counter per abstract list; a num with a start override restarts it the first time it is used
        const id = nn ? 'a' + nn.abs : 'n' + it.num.id;
        const info = levelInfo(it.num.id, ilvl);
        const key = id + ':' + ilvl;
        const seenKey = it.num.id + ':' + ilvl;
        if (nn && nn.ov[ilvl] != null && !st.seenNums.has(seenKey)) { delete counters[key]; st.restartAt = st.restartAt || {}; st.restartAt[key] = nn.ov[ilvl]; }
        st.seenNums.add(seenKey);
        if (st.restartAt && st.restartAt[key] != null) info.start = st.restartAt[key];
        const content = it.tag !== 'p' || it.attrs.includes('class=') ? it.html : it.inner;
        const liAttr = it.tag === 'p' && it.align ? ` style="text-align:${it.align}"` : '';
        if (stack.length > ilvl + 1) close(ilvl + 1);
        const top = stack[ilvl];
        if (stack.length === ilvl + 1 && top.numId === id && top.tag === info.tag) {
          out += `</li><li${liAttr}>${content}`;
        } else {
          if (stack.length === ilvl + 1) close(ilvl);
          while (stack.length < ilvl) { out += '<ul style="list-style-type:none"><li>'; stack.push({ tag: 'ul', numId: null }); }
          const count = counters[key] || 0;
          const start = info.start + count;
          const style = info.lst ? ` style="list-style-type:${info.lst}"` : '';
          out += `<${info.tag}${style}${info.tag === 'ol' && start !== 1 ? ` start="${start}"` : ''}><li${liAttr}>${content}`;
          stack.push({ tag: info.tag, numId: id });
        }
        counters[key] = (counters[key] || 0) + 1;
        for (let d = ilvl + 1; d < 9; d++) delete counters[id + ':' + d];
      }
      close(0);
      return out;
    }

    const newState = () => ({ active: new Set(), fld: [], counters: {}, seenNums: new Set() });
    const body = desc(docXml, 'body');
    const mainPart = { rels: docRels };
    const html = blocks(kids(body), mainPart, newState());

    /* ---------- section / page settings ---------- */
    const settings = {};
    const sect = child(body, 'sectPr') || [...body.getElementsByTagNameNS('*', 'sectPr')].pop();
    if (sect) {
      const pg = child(sect, 'pgSz');
      if (pg) {
        let w = +attr(pg, 'w'), h = +attr(pg, 'h');
        const land = attr(pg, 'orient') === 'landscape' || w > h;
        if (land) [w, h] = [h, w];
        settings.orientation = land ? 'landscape' : 'portrait';
        let best = 'A4', bd = 1e9;
        for (const [k, [sw, sh]] of Object.entries(DocxExport.PAGE_SIZES)) { const d = Math.abs(sw - w) + Math.abs(sh - h); if (d < bd) { bd = d; best = k; } }
        settings.pageSize = best;
      }
      const mg = child(sect, 'pgMar');
      if (mg) settings.margins = { top: Math.abs(+attr(mg, 'top') || 1440) / 1440, bottom: Math.abs(+attr(mg, 'bottom') || 1440) / 1440, left: (+attr(mg, 'left') || 1440) / 1440, right: (+attr(mg, 'right') || 1440) / 1440 };
      settings.differentFirst = !!child(sect, 'titlePg') && on(child(sect, 'titlePg'));
      const hfHtml = async (relId) => {
        const rel = docRels[relId]; if (!rel) return '';
        const d = await readXml(rel.path); if (!d) return '';
        const rels = await relsOf(rel.path);
        await loadImages(rels);
        const root = d.documentElement;
        const tp = desc(root, 'textpath');
        if (tp && tp.getAttribute('string') && !settings.watermark) settings.watermark = tp.getAttribute('string');
        // drop the watermark shape paragraph
        for (const p of [...root.getElementsByTagNameNS('*', 'p')]) if (desc(p, 'textpath')) p.parentNode.removeChild(p);
        return blocks(kids(root), { rels }, newState()).replace(/^<p><br><\/p>$/, '');
      };
      for (const ref of kids(sect, 'headerReference')) {
        const t = attr(ref, 'type');
        if (t === 'default') settings.header = await hfHtml(rid(ref, 'id'));
        if (t === 'first') settings.firstHeader = await hfHtml(rid(ref, 'id'));
      }
      for (const ref of kids(sect, 'footerReference')) {
        const t = attr(ref, 'type');
        if (t === 'default') settings.footer = await hfHtml(rid(ref, 'id'));
        if (t === 'first') settings.firstFooter = await hfHtml(rid(ref, 'id'));
      }
    }
    const bg = desc(docXml, 'background');
    if (bg && attr(bg, 'color') && attr(bg, 'color') !== 'auto') settings.pageColor = '#' + attr(bg, 'color');

    /* document theme from defaults and Normal style */
    const normal = Object.values(styles).find(s => s.type === 'paragraph' && s.isDefault) || styles.Normal;
    const dr = rProps(normal ? normal.rPr : null, rProps(defaults.rPr));
    const dpp = pProps(normal ? normal.pPr : null, pProps(defaults.pPr));
    const theme = {
      font: dr.font || themeFonts.minor || 'Calibri',
      size: dr.size || 10,
      lineHeight: typeof dpp.line === 'number' ? dpp.line : 1,
      after: dpp.after != null ? Math.round(dpp.after * 0.75 * 10) / 10 : 0,
      justify: dpp.align === 'justify'
    };
    const h1 = styles.Heading1 || Object.values(styles).find(s => s.name === 'heading 1');
    if (h1) { const hr = rProps(h1.rPr); if (hr.color) theme.headingColor = hr.color; if (hr.font) theme.headingFont = hr.font; }
    else if (themeFonts.major) theme.headingFont = themeFonts.major;
    settings.theme = theme;

    let title = '';
    const core = await readXml('docProps/core.xml');
    if (core) { const t = desc(core, 'title'); if (t) title = t.textContent.trim(); }
    const commentMap = {};
    for (const id in comments) { const c = comments[id]; commentMap[c.cid] = { author: c.author, date: c.date, text: c.text, replies: [] }; }
    return { html, settings, comments: commentMap, title: (fileName || title || 'Document').replace(/\.docx$/i, '') };
  }
  return { parse };
})();
