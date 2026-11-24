/* DraftLy: HTML document -> Office Open XML (.docx) writer. */
const DocxExport = (() => {
  const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w10="urn:schemas-microsoft-com:office:word"';
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
  const XMLH = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const clean = s => String(s).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F￾￿​]/g, '');
  const esc = s => clean(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const isoDate = d => { try { return new Date(d || Date.now()).toISOString().replace(/\.\d+Z$/, 'Z'); } catch (e) { return new Date().toISOString().replace(/\.\d+Z$/, 'Z'); } };

  const PAGE_SIZES = { A4: [11906, 16838], Letter: [12240, 15840], Legal: [12240, 20160], A5: [8391, 11906], Executive: [10440, 15120] };

  let _ctx2d = null;
  function hex(c) {
    if (!c || c === 'transparent' || c === 'inherit' || c === 'initial') return null;
    c = c.trim();
    let m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) { let h = m[1]; if (h.length === 3) h = h.split('').map(x => x + x).join(''); return h.toUpperCase(); }
    m = c.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?\s*\)$/i);
    if (m) {
      if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
      return [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join('').toUpperCase();
    }
    try {
      _ctx2d = _ctx2d || document.createElement('canvas').getContext('2d');
      _ctx2d.fillStyle = '#000'; _ctx2d.fillStyle = c;
      const v = _ctx2d.fillStyle;
      return v.startsWith('#') ? v.slice(1).toUpperCase() : hex(v);
    } catch (e) { return null; }
  }
  function toPx(v, basePx) {
    if (v == null || v === '') return null;
    v = String(v).trim();
    const n = parseFloat(v); if (isNaN(n)) return null;
    if (v.endsWith('px')) return n;
    if (v.endsWith('pt')) return n * 96 / 72;
    if (v.endsWith('in')) return n * 96;
    if (v.endsWith('cm')) return n * 96 / 2.54;
    if (v.endsWith('mm')) return n * 96 / 25.4;
    if (v.endsWith('em') || v.endsWith('rem')) return n * (basePx || 14.67);
    if (v.endsWith('%')) return null;
    return n;
  }
  const FONT_SIZE_KEYWORDS = { 'xx-small': 7.5, 'x-small': 7.5, small: 10, medium: 12, large: 13.5, 'x-large': 18, 'xx-large': 24, 'xxx-large': 36, '-webkit-xxx-large': 36 };
  function sizePt(v) {
    if (!v) return null;
    if (FONT_SIZE_KEYWORDS[v]) return FONT_SIZE_KEYWORDS[v];
    const px = toPx(v, 14.67); return px ? px * 72 / 96 : null;
  }
  const firstFont = f => f ? f.split(',')[0].replace(/["']/g, '').trim() : null;

  /* ---------- per-build context ---------- */
  function makeBuild(opts) {
    const b = {
      opts, media: [], revId: 100, picId: 1, comments: opts.comments || {}, cmtNum: new Map(), cmtStarted: new Set(), cmtLast: new Map(),
      footnotes: [], abstracts: new Map(), nums: [], hasNumbering: false
    };
    b.newNum = (key, start, depth) => {
      if (!b.abstracts.has(key)) b.abstracts.set(key, b.abstracts.size + 1);
      const id = b.nums.length + 1;
      b.nums.push({ id, abs: b.abstracts.get(key), start, depth });
      b.hasNumbering = true;
      return id;
    };
    return b;
  }
  function makePart(build) {
    const part = { rels: [], build };
    part.rel = (type, target, external) => {
      const ex = part.rels.find(r => r.type === type && r.target === target);
      if (ex) return ex.id;
      const id = 'rId' + (part.rels.length + 100);
      part.rels.push({ id, type, target, external });
      return id;
    };
    part.relsXml = () => XMLH + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      part.rels.map(r => `<Relationship Id="${r.id}" Type="${REL}${r.type}" Target="${esc(r.target)}"${r.external ? ' TargetMode="External"' : ''}/>`).join('') + '</Relationships>';
    return part;
  }

  /* ---------- run formatting ---------- */
  function fmtFrom(el, f) {
    const g = Object.assign({}, f);
    const t = el.tagName, st = el.style;
    if (t === 'B' || t === 'STRONG') g.b = true;
    if (t === 'I' || t === 'EM' || t === 'CITE') g.i = true;
    if (t === 'U') g.u = true;
    if (t === 'S' || t === 'STRIKE' || (t === 'DEL' && !el.classList.contains('tc'))) g.s = true;
    if (t === 'SUB') g.va = 'subscript';
    if (t === 'SUP') g.va = 'superscript';
    if (t === 'MARK') g.hl = 'FFFF00';
    if (t === 'CODE' || t === 'PRE' || t === 'TT' || t === 'KBD') g.font = 'Courier New';
    if (t === 'FONT') {
      if (el.getAttribute('face')) g.font = firstFont(el.getAttribute('face'));
      if (el.getAttribute('color')) g.color = hex(el.getAttribute('color'));
      const sz = +el.getAttribute('size'); if (sz) g.size = [0, 8, 10, 12, 14, 18, 24, 36][Math.min(7, sz)];
    }
    if (t === 'A' && el.getAttribute('href')) g.link = el.getAttribute('href');
    if (st && el.getAttribute('style')) {
      const fw = st.fontWeight; if (fw) g.b = fw === 'bold' || fw === 'bolder' || +fw >= 600;
      if (st.fontStyle) g.i = st.fontStyle === 'italic' || st.fontStyle === 'oblique';
      const td = st.textDecorationLine || st.textDecoration || '';
      if (td.includes('underline')) g.u = true;
      if (td.includes('line-through')) g.s = true;
      if (td === 'none') { g.u = false; g.s = false; }
      if (st.fontFamily) g.font = firstFont(st.fontFamily);
      if (st.fontSize) { const p = sizePt(st.fontSize); if (p) g.size = p; }
      if (st.color) { const c = hex(st.color); if (c) g.color = c; }
      if (st.backgroundColor) { const c = hex(st.backgroundColor); if (c) g.hl = c; }
      if (st.verticalAlign === 'super') g.va = 'superscript';
      if (st.verticalAlign === 'sub') g.va = 'subscript';
      if (st.textTransform === 'uppercase') g.caps = true;
      if (st.fontVariant === 'small-caps' || st.fontVariantCaps === 'small-caps') g.smallCaps = true;
    }
    return g;
  }
  function rPr(f) {
    let s = '';
    if (f.link && !f.color) s += '<w:rStyle w:val="Hyperlink"/>';
    if (f.font) s += `<w:rFonts w:ascii="${esc(f.font)}" w:hAnsi="${esc(f.font)}" w:cs="${esc(f.font)}" w:eastAsia="${esc(f.font)}"/>`;
    if (f.b) s += '<w:b/><w:bCs/>';
    if (f.i) s += '<w:i/><w:iCs/>';
    if (f.caps) s += '<w:caps/>';
    if (f.smallCaps) s += '<w:smallCaps/>';
    if (f.s) s += '<w:strike/>';
    if (f.color) s += `<w:color w:val="${f.color}"/>`;
    if (f.size) { const hp = Math.max(2, Math.round(f.size * 2)); s += `<w:sz w:val="${hp}"/><w:szCs w:val="${hp}"/>`; }
    if (f.u) s += '<w:u w:val="single"/>';
    if (f.hl) s += `<w:shd w:val="clear" w:color="auto" w:fill="${f.hl}"/>`;
    if (f.va) s += `<w:vertAlign w:val="${f.va}"/>`;
    return s ? `<w:rPr>${s}</w:rPr>` : '';
  }
  function wrap(f, x, part) {
    const b = part.build;
    if (f.del) x = `<w:del w:id="${b.revId++}" w:author="${esc(f.del.a)}" w:date="${isoDate(f.del.d)}">${x}</w:del>`;
    if (f.ins) x = `<w:ins w:id="${b.revId++}" w:author="${esc(f.ins.a)}" w:date="${isoDate(f.ins.d)}">${x}</w:ins>`;
    if (f.link) {
      if (f.link.startsWith('#')) x = `<w:hyperlink w:anchor="${esc(f.link.slice(1))}" w:history="1">${x}</w:hyperlink>`;
      else if (/^(https?:|mailto:|tel:|ftp:)/i.test(f.link)) x = `<w:hyperlink r:id="${part.rel('hyperlink', f.link, true)}" w:history="1">${x}</w:hyperlink>`;
    }
    return x;
  }
  function fieldRuns(instr, shown, f) {
    const rp = rPr(f);
    return `<w:r>${rp}<w:fldChar w:fldCharType="begin"/></w:r><w:r>${rp}<w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r><w:r>${rp}<w:fldChar w:fldCharType="separate"/></w:r><w:r>${rp}<w:t>${shown}</w:t></w:r><w:r>${rp}<w:fldChar w:fldCharType="end"/></w:r>`;
  }
  function textRuns(text, f, part) {
    let out = '';
    for (const seg of text.split(/(\{PAGE\}|\{NUMPAGES\})/)) {
      if (!seg) continue;
      if (seg === '{PAGE}' || seg === '{NUMPAGES}') { out += wrap(f, fieldRuns(seg.slice(1, -1), '1', f), part); continue; }
      let inner = '';
      const tTag = f.del ? 'w:delText' : 'w:t';
      for (const piece of seg.split(/(\t|\n)/)) {
        if (piece === '\t') inner += '<w:tab/>';
        else if (piece === '\n') inner += '<w:br/>';
        else if (piece) inner += `<${tTag} xml:space="preserve">${esc(piece)}</${tTag}>`;
      }
      if (inner) out += wrap(f, `<w:r>${rPr(f)}${inner}</w:r>`, part);
    }
    return out;
  }
  function dataUrlBytes(src) {
    const m = src.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
    if (!m) return null;
    let bytes;
    if (m[2]) { const bin = atob(m[3]); bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); }
    else bytes = new TextEncoder().encode(decodeURIComponent(m[3]));
    const ext = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/jpg': 'jpeg', 'image/gif': 'gif', 'image/bmp': 'bmp' }[m[1].toLowerCase()];
    return ext ? { bytes, ext } : null;
  }
  function imageRun(img, f, part) {
    const d = dataUrlBytes(img.getAttribute('src') || '');
    if (!d) return '';
    const b = part.build;
    const n = b.media.length + 1;
    const name = `image${n}.${d.ext}`;
    b.media.push({ name, bytes: d.bytes, ext: d.ext });
    const rid = part.rel('image', 'media/' + name);
    let w = img.width || img.naturalWidth || 200, h = img.height || img.naturalHeight || 150;
    const sw = toPx(img.style.width), sh = toPx(img.style.height);
    if (sw) { if (!sh && img.naturalWidth) h = sw * img.naturalHeight / img.naturalWidth; w = sw; }
    if (sh) h = sh;
    const cx = Math.round(w * 9525), cy = Math.round(h * 9525), id = b.picId++;
    return wrap(f, `<w:r>${rPr(f)}<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${id}" name="Picture ${id}" descr="${esc(img.alt || '')}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`, part);
  }

  function runNode(n, f, part) {
    if (n.nodeType === 3) return textRuns(n.nodeValue, f, part);
    if (n.nodeType !== 1) return '';
    const el = n, t = el.tagName, b = part.build;
    if (t === 'BR') return isTrailingBr(el) ? '' : wrap(f, `<w:r>${rPr(f)}<w:br/></w:r>`, part);
    if (t === 'IMG') return imageRun(el, f, part);
    if (t === 'SCRIPT' || t === 'STYLE') return '';
    if (t === 'SUP' && el.classList.contains('fn')) {
      b.footnotes.push(el.getAttribute('data-note') || '');
      const id = b.footnotes.length;
      return wrap(f, `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="${id}"/></w:r>`, part);
    }
    if ((t === 'INS' || t === 'DEL') && el.classList.contains('tc')) {
      const g = Object.assign({}, f);
      const info = { a: el.getAttribute('data-author') || 'Author', d: el.getAttribute('data-date') };
      if (t === 'INS') g.ins = info; else g.del = info;
      return runsOf(el.childNodes, g, part);
    }
    if (t === 'SPAN' && el.classList.contains('cmt')) {
      const cid = el.getAttribute('data-cid');
      let s = '';
      const known = b.comments[cid];
      if (known && part.isBody) {
        if (!b.cmtNum.has(cid)) b.cmtNum.set(cid, b.cmtNum.size);
        const num = b.cmtNum.get(cid);
        if (!b.cmtStarted.has(cid)) { b.cmtStarted.add(cid); s += `<w:commentRangeStart w:id="${num}"/>`; }
        s += runsOf(el.childNodes, fmtFrom(el, f), part);
        if (b.cmtLast.get(cid) === el) s += `<w:commentRangeEnd w:id="${num}"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="${num}"/></w:r>`;
        return s;
      }
    }
    return runsOf(el.childNodes, fmtFrom(el, f), part);
  }
  /* a <br> that ends a block only keeps an empty line open in HTML; Word must not get an extra break */
  function isTrailingBr(br) {
    let n = br;
    while (n) {
      let x = n.nextSibling;
      while (x) {
        if (x.nodeType === 3 && x.nodeValue.replace(/[\u200B\n]/g, '') !== '') return false;
        if (x.nodeType === 1 && (x.tagName === 'IMG' || x.tagName === 'BR' || x.tagName === 'SUP' || x.textContent.replace(/\u200B/g, '') !== '' || x.querySelector('img,br'))) return false;
        x = x.nextSibling;
      }
      n = n.parentNode;
      if (!n || BLOCKS.has(n.tagName)) return true;
    }
    return true;
  }
  function runsOf(nodes, f, part) { let s = ''; for (const n of nodes) s += runNode(n, f, part); return s; }

  /* ---------- paragraphs ---------- */
  const STYLE_MAP = { H1: 'Heading1', H2: 'Heading2', H3: 'Heading3', H4: 'Heading4', H5: 'Heading5', H6: 'Heading6', BLOCKQUOTE: 'Quote' };
  const CLASS_STYLES = { 's-Title': 'Title', 's-Subtitle': 'Subtitle', 's-Quote': 'Quote', 's-IntenseQuote': 'IntenseQuote', 's-NoSpacing': 'NoSpacing' };
  function styleOf(el) {
    if (!el) return null;
    if (STYLE_MAP[el.tagName]) return STYLE_MAP[el.tagName];
    for (const c of el.classList || []) if (CLASS_STYLES[c]) return CLASS_STYLES[c];
    return null;
  }
  function jcOf(a) { return { left: 'left', start: 'left', center: 'center', right: 'right', end: 'right', justify: 'both' }[a] || null; }
  function pPr(el, o, part) {
    let s = '';
    const style = o.style || styleOf(el);
    if (style) s += `<w:pStyle w:val="${style}"/>`;
    if (o.keepNext) s += '<w:keepNext/>';
    if (o.num) s += `<w:numPr><w:ilvl w:val="${o.num.ilvl}"/><w:numId w:val="${o.num.id}"/></w:numPr>`;
    if (o.bdr) s += o.bdr;
    if (o.tabs) s += o.tabs;
    const st = el && el.getAttribute && el.getAttribute('style') ? el.style : null;
    let sp = '';
    if (st) {
      const mt = toPx(st.marginTop), mb = toPx(st.marginBottom);
      if (mt != null && !el.hasAttribute('data-pg')) sp += ` w:before="${Math.round(mt * 15)}"`;
      if (mb != null) sp += ` w:after="${Math.round(mb * 15)}"`;
      const lh = st.lineHeight;
      if (lh && lh !== 'normal') {
        if (/^[\d.]+$/.test(lh)) sp += ` w:line="${Math.round(parseFloat(lh) * 240)}" w:lineRule="auto"`;
        else if (lh.endsWith('%')) sp += ` w:line="${Math.round(parseFloat(lh) * 2.4)}" w:lineRule="auto"`;
        else { const px = toPx(lh); if (px) sp += ` w:line="${Math.round(px * 15)}" w:lineRule="exact"`; }
      }
    }
    if (sp) s += `<w:spacing${sp}/>`;
    let left = o.indLeft || 0, right = 0, first = 0, hasInd = !!o.indLeft;
    if (st) {
      const ml = toPx(st.marginLeft) ?? toPx(st.paddingLeft), mr = toPx(st.marginRight), ti = toPx(st.textIndent);
      if (ml != null) { left += Math.round(ml * 15); hasInd = true; }
      if (mr != null) { right = Math.round(mr * 15); hasInd = true; }
      if (ti != null) { first = Math.round(ti * 15); hasInd = true; }
    }
    if (hasInd && !o.num) s += `<w:ind w:left="${left}" w:right="${right}"${first < 0 ? ` w:hanging="${-first}"` : first > 0 ? ` w:firstLine="${first}"` : ''}/>`;
    else if (o.num && st && toPx(st.textIndent)) { /* keep list indents from numbering */ }
    const jc = jcOf(st && st.textAlign) || o.align || null;
    if (jc) s += `<w:jc w:val="${jc}"/>`;
    if (o.sectPr) s += o.sectPr;
    return s ? `<w:pPr>${s}</w:pPr>` : '';
  }
  function para(el, nodes, part, inh, extra) {
    const o = Object.assign({}, inh, extra || {});
    let f = o.fmt || {};
    if (el && (el.tagName === 'PRE')) f = Object.assign({}, f, { font: 'Courier New' });
    if (el && el.getAttribute && el.getAttribute('style')) f = fmtFrom(el, f); // block-level font settings apply to runs
    const list = [...nodes];
    if (!o.align && list.length && list.every(n => (n.nodeType === 1 && n.tagName === 'IMG' && n.classList.contains('ctr')) || (n.nodeType === 3 && !n.nodeValue.trim()))) o.align = 'center';
    return `<w:p>${pPr(el, o, part)}${runsOf(list, f, part)}</w:p>`;
  }
  const BLOCKS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV', 'UL', 'OL', 'TABLE', 'HR', 'BLOCKQUOTE', 'PRE', 'LI', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'FIGURE', 'ADDRESS', 'MAIN', 'ASIDE', 'NAV', 'DL', 'DT', 'DD', 'FIGCAPTION']);
  const isBlock = n => n.nodeType === 1 && BLOCKS.has(n.tagName);
  function blocks(container, part, inh) {
    let out = '', inline = [];
    const flush = () => {
      if (inline.some(n => n.nodeType === 1 || n.nodeValue.replace(/[\s​]/g, ''))) out += para(null, inline, part, inh);
      inline = [];
    };
    for (const n of [...container.childNodes]) {
      if (isBlock(n)) { flush(); out += block(n, part, inh); }
      else inline.push(n);
    }
    flush();
    return out;
  }
  function block(el, part, inh) {
    const t = el.tagName;
    if (t === 'HR') {
      if (el.classList.contains('pb')) return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>';
    }
    if (t === 'UL' || t === 'OL') return list(el, 0, part, inh);
    if (t === 'TABLE') return table(el, part, inh);
    if (t === 'DIV' && el.classList.contains('toc')) return toc(el, part);
    if (t === 'DIV' && el.classList.contains('cols') && part.isBody) return columns(el, part, inh);
    if (t === 'BLOCKQUOTE' && [...el.childNodes].some(isBlock)) return blocks(el, part, Object.assign({}, inh, { indLeft: (inh.indLeft || 0) + 720 }));
    if (t === 'DL' || t === 'DD') return blocks(el, part, Object.assign({}, inh, t === 'DD' ? { indLeft: (inh.indLeft || 0) + 720 } : {}));
    if ([...el.childNodes].some(isBlock)) {
      const a = jcOf(el.style && el.style.textAlign);
      return blocks(el, part, a ? Object.assign({}, inh, { align: a }) : inh);
    }
    return para(el, el.childNodes, part, inh);
  }

  /* ---------- lists ---------- */
  function listKey(el) {
    const lst = (el.style && el.style.listStyleType) || '';
    const type = el.getAttribute('type');
    if (el.tagName === 'UL') return lst === 'square' ? 'bullet-square' : lst === 'circle' ? 'bullet-circle' : lst === 'none' ? 'none' : 'bullet';
    const map = { a: 'lowerLetter', A: 'upperLetter', i: 'lowerRoman', I: 'upperRoman', 1: 'decimal' };
    if (lst) {
      return { 'lower-alpha': 'lowerLetter', 'lower-latin': 'lowerLetter', 'upper-alpha': 'upperLetter', 'upper-latin': 'upperLetter', 'lower-roman': 'lowerRoman', 'upper-roman': 'upperRoman', 'paren-lower-alpha': 'lowerLetter|(|)', 'paren-upper-alpha': 'upperLetter|(|)', 'paren-lower-roman': 'lowerRoman|(|)', 'paren-decimal': 'decimal|(|)', 'decimal-paren': 'decimal||)', none: 'none' }[lst] || 'decimal';
    }
    return map[type] || 'decimal';
  }
  function list(el, depth, part, inh) {
    const b = part.build;
    const numId = b.newNum(listKey(el), parseInt(el.getAttribute('start')) || 1, Math.min(depth, 8));
    let out = '';
    for (const li of el.children) {
      if (li.tagName === 'UL' || li.tagName === 'OL') { out += list(li, depth + 1, part, inh); continue; }
      let first = true, inline = [];
      const emit = (blockEl, nodes) => {
        out += para(blockEl || li, nodes, part, inh, first ? { num: { id: numId, ilvl: Math.min(depth, 8) } } : { indLeft: 720 * (depth + 1) });
        first = false;
      };
      const flush = () => { if (inline.length && inline.some(n => n.nodeType === 1 || n.nodeValue.trim())) emit(null, inline); else if (inline.length && first) emit(null, inline); inline = []; };
      for (const n of [...li.childNodes]) {
        if (n.nodeType === 1 && (n.tagName === 'UL' || n.tagName === 'OL')) { flush(); if (first) emit(null, []); out += list(n, depth + 1, part, inh); }
        else if (isBlock(n) && n.tagName !== 'TABLE') { flush(); emit(n, n.childNodes); }
        else if (n.nodeType === 1 && n.tagName === 'TABLE') { flush(); out += table(n, part, inh); }
        else inline.push(n);
      }
      flush();
      if (first) emit(null, []);
    }
    return out;
  }
  function numberingXml(b) {
    const BUL = ['•', 'o', '▪'];
    let abs = '';
    for (const [key, id] of b.abstracts) {
      const [fmt, pre = '', suf = '.'] = key.split('|');
      let lv = '';
      for (let i = 0; i < 9; i++) {
        let numFmt, text;
        if (key.startsWith('bullet')) { numFmt = 'bullet'; text = key === 'bullet-square' ? '▪' : key === 'bullet-circle' ? 'o' : BUL[i % 3]; }
        else if (fmt === 'none') { numFmt = 'none'; text = ''; }
        else { numFmt = fmt; text = `${pre}%${i + 1}${key.includes('|') ? suf : '.'}`; }
        const left = 720 * (i + 1);
        lv += `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${numFmt}"/><w:lvlText w:val="${esc(text)}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${left}" w:hanging="360"/></w:pPr>${numFmt === 'bullet' && text === 'o' ? '<w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New" w:hint="default"/></w:rPr>' : ''}</w:lvl>`;
      }
      abs += `<w:abstractNum w:abstractNumId="${id}"><w:multiLevelType w:val="hybridMultilevel"/>${lv}</w:abstractNum>`;
    }
    const nums = b.nums.map(n => {
      let ov = '';
      for (let i = 0; i < 9; i++) ov += `<w:lvlOverride w:ilvl="${i}"><w:startOverride w:val="${i === n.depth ? n.start : 1}"/></w:lvlOverride>`;
      return `<w:num w:numId="${n.id}"><w:abstractNumId w:val="${n.abs}"/>${ov}</w:num>`;
    }).join('');
    return XMLH + `<w:numbering ${W_NS}>${abs}${nums}</w:numbering>`;
  }

  /* ---------- tables ---------- */
  function table(el, part, inh) {
    const rows = [...el.rows].filter(r => !r.classList.contains('pg-sp'));
    if (!rows.length) return '';
    let cols = 0;
    rows.forEach(r => { let c = 0; [...r.cells].forEach(td => c += td.colSpan || 1); cols = Math.max(cols, c); });
    const tw = toPx(el.style.width);
    const total = tw ? Math.round(tw * 15) : part.build.contentTw;
    let grid = new Array(cols).fill(Math.round(total / cols));
    const ref = rows.find(r => r.cells.length === cols);
    if (ref) {
      const ws = [...ref.cells].map(c => c.offsetWidth || 0), sum = ws.reduce((a, b) => a + b, 0);
      if (sum > 0) grid = ws.map(w => Math.max(200, Math.round(total * w / sum)));
    }
    const kind = el.classList.contains('nb') ? 'none' : el.classList.contains('ob') ? 'outside' : el.classList.contains('ib') ? 'inside' : 'all';
    const bc = hex(el.style.getPropertyValue('--bc')) || 'auto';
    const bwPt = parseFloat(el.style.getPropertyValue('--bw')) || 0.5;
    const sz = Math.max(2, Math.min(96, Math.round(bwPt * 8)));
    const B = (v, on) => on ? `<w:${v} w:val="single" w:sz="${sz}" w:space="0" w:color="${bc}"/>` : `<w:${v} w:val="nil"/>`;
    const outer = kind === 'all' || kind === 'outside', inner = kind === 'all' || kind === 'inside';
    let x = `<w:tbl><w:tblPr><w:tblStyle w:val="${kind === 'none' ? 'TableNormal' : 'TableGrid'}"/><w:tblW w:w="${total}" w:type="dxa"/>`;
    if (el.style.marginLeft === 'auto' && el.style.marginRight === 'auto') x += '<w:jc w:val="center"/>';
    else if (el.style.marginLeft === 'auto') x += '<w:jc w:val="right"/>';
    x += `<w:tblBorders>${B('top', outer)}${B('left', outer)}${B('bottom', outer)}${B('right', outer)}${B('insideH', inner)}${B('insideV', inner)}</w:tblBorders>`;
    x += '<w:tblLayout w:type="fixed"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>';
    x += '<w:tblGrid>' + grid.map(w => `<w:gridCol w:w="${w}"/>`).join('') + '</w:tblGrid>';
    const pending = []; // per grid column: remaining rowspan rows
    rows.forEach((r, ri) => {
      const hts = [...r.cells].map(c => toPx(c.style.height)).filter(Boolean);
      const trh = hts.length ? `<w:trHeight w:val="${Math.round(Math.max(...hts) * 15)}" w:hRule="atLeast"/>` : '';
      const thd = (r.parentElement && r.parentElement.tagName === 'THEAD') || r.hasAttribute('data-hdr') ? '<w:tblHeader/>' : '';
      x += '<w:tr>' + (trh || thd ? `<w:trPr>${trh}${thd}</w:trPr>` : '');
      let gc = 0;
      const cells = [...r.cells];
      let ci = 0;
      const vcont = () => {
        while (pending[gc] && pending[gc].left > 0) {
          const p = pending[gc]; p.left--;
          const w = grid.slice(gc, gc + p.span).reduce((a, b) => a + b, 0);
          x += `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${p.span > 1 ? `<w:gridSpan w:val="${p.span}"/>` : ''}<w:vMerge/></w:tcPr><w:p/></w:tc>`;
          gc += p.span;
        }
      };
      vcont();
      while (ci < cells.length) {
        const td = cells[ci++];
        const span = Math.max(1, td.colSpan || 1), rs = Math.max(1, td.rowSpan || 1);
        const w = grid.slice(gc, gc + span).reduce((a, b) => a + b, 0) || grid[0];
        let pr = `<w:tcW w:w="${w}" w:type="dxa"/>`;
        if (span > 1) pr += `<w:gridSpan w:val="${span}"/>`;
        if (rs > 1) { pr += '<w:vMerge w:val="restart"/>'; pending[gc] = { left: rs - 1, span }; }
        const bg = hex(td.style.backgroundColor);
        if (bg) pr += `<w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>`;
        const va = td.style.verticalAlign;
        if (va === 'middle' || va === 'bottom') pr += `<w:vAlign w:val="${va === 'middle' ? 'center' : 'bottom'}"/>`;
        const cinh = Object.assign({}, inh, { indLeft: 0 });
        const a = jcOf(td.style.textAlign); if (a) cinh.align = a;
        if (td.tagName === 'TH' || /bold|[6-9]00/.test(td.style.fontWeight)) cinh.fmt = Object.assign({}, cinh.fmt || {}, { b: true });
        if (td.style.color) { const tc = hex(td.style.color); if (tc) cinh.fmt = Object.assign({}, cinh.fmt || {}, { color: tc }); }
        let content = blocks(td, part, cinh);
        if (!content.endsWith('</w:p>') && !content.endsWith('<w:p/>')) content += '<w:p/>';
        x += `<w:tc><w:tcPr>${pr}</w:tcPr>${content}</w:tc>`;
        gc += span;
        vcont();
      }
      x += '</w:tr>';
    });
    return x + '</w:tbl>';
  }

  /* ---------- TOC, columns, sections ---------- */
  function toc(el, part) {
    const rows = [...el.querySelectorAll('.toc-row')];
    const tab = `<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${part.build.contentTw - 10}"/></w:tabs>`;
    const begin = '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>';
    const end = '<w:r><w:fldChar w:fldCharType="end"/></w:r>';
    let x = `<w:p><w:pPr><w:pStyle w:val="TOCHeading"/></w:pPr><w:r><w:t>${esc((el.querySelector('.toc-title') || {}).textContent || 'Contents')}</w:t></w:r></w:p>`;
    if (!rows.length) return x + `<w:p>${begin}<w:r><w:t>No table of contents entries found.</w:t></w:r>${end}</w:p>`;
    rows.forEach((r, i) => {
      const lvl = Math.min(3, +r.getAttribute('data-level') || 1);
      const txt = (r.querySelector('.t') || r).textContent;
      const pg = (r.querySelector('.p') || {}).textContent || '';
      x += `<w:p><w:pPr><w:pStyle w:val="TOC${lvl}"/>${tab}</w:pPr>${i === 0 ? begin : ''}<w:r><w:t xml:space="preserve">${esc(txt)}</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>${esc(pg)}</w:t></w:r>${i === rows.length - 1 ? end : ''}</w:p>`;
    });
    return x;
  }
  function sectPr(part, o) {
    const b = part.build, s = b.opts.settings || {};
    let x = '<w:sectPr>';
    if (b.hdr) x += `<w:headerReference w:type="default" r:id="${b.hdr}"/>`;
    if (b.hdrFirst) x += `<w:headerReference w:type="first" r:id="${b.hdrFirst}"/>`;
    if (b.ftr) x += `<w:footerReference w:type="default" r:id="${b.ftr}"/>`;
    if (b.ftrFirst) x += `<w:footerReference w:type="first" r:id="${b.ftrFirst}"/>`;
    if (o.continuous) x += '<w:type w:val="continuous"/>';
    let [pw, ph] = PAGE_SIZES[s.pageSize] || PAGE_SIZES.A4;
    const land = s.orientation === 'landscape';
    if (land) [pw, ph] = [ph, pw];
    const m = s.margins || { top: 1, bottom: 1, left: 1, right: 1 };
    x += `<w:pgSz w:w="${pw}" w:h="${ph}"${land ? ' w:orient="landscape"' : ''}/>`;
    x += `<w:pgMar w:top="${Math.round(m.top * 1440)}" w:right="${Math.round(m.right * 1440)}" w:bottom="${Math.round(m.bottom * 1440)}" w:left="${Math.round(m.left * 1440)}" w:header="708" w:footer="708" w:gutter="0"/>`;
    x += `<w:cols w:space="720"${o.cols > 1 ? ` w:num="${o.cols}"` : ''}/>`;
    if (s.differentFirst) x += '<w:titlePg/>';
    x += '<w:docGrid w:linePitch="360"/></w:sectPr>';
    return x;
  }
  function columns(el, part, inh) {
    const n = parseInt(el.style.columnCount) || 2;
    part.build.anySections = true;
    let x = `<w:p><w:pPr>${sectPr(part, { cols: 1, continuous: part.build.sectionsSoFar++ > 0 })}</w:pPr></w:p>`;
    x += blocks(el, part, inh);
    x += `<w:p><w:pPr>${sectPr(part, { cols: n, continuous: true })}</w:pPr></w:p>`;
    return x;
  }

  /* ---------- styles ---------- */
  function stylesXml(theme) {
    const font = esc(theme.font || 'Aptos'), hfont = esc(theme.headingFont || theme.font || 'Aptos Display');
    const sz = Math.round((theme.size || 11) * 2), after = Math.round((theme.after ?? 8) * 20), line = Math.round((theme.lineHeight || 1.15) * 240);
    const hc = (theme.headingColor || '#0F4761').replace('#', '');
    const jc = theme.justify ? '<w:jc w:val="both"/>' : '';
    const H = (n, size, extra = '') => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="${n === 1 ? 360 : 160}" w:after="80"/><w:jc w:val="left"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:rFonts w:ascii="${hfont}" w:hAnsi="${hfont}" w:eastAsia="${hfont}" w:cs="${hfont}"/>${theme.headingBold ? '<w:b/><w:bCs/>' : ''}${extra}<w:color w:val="${hc}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:style>`;
    return XMLH + `<w:styles ${W_NS}>
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:eastAsia="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:kern w:val="2"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:lang w:val="en-IN" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="${after}" w:line="${line}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr>${jc}</w:pPr></w:style>
<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/><w:unhideWhenUsed/></w:style>
<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
<w:style w:type="numbering" w:default="1" w:styleId="NoList"><w:name w:val="No List"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/></w:style>
${H(1, theme.h1 || 40)}${H(2, theme.h2 || 32)}${H(3, theme.h3 || 28)}${H(4, sz, '<w:i/><w:iCs/>')}${H(5, sz)}${H(6, sz, '<w:i/><w:iCs/>')}
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="10"/><w:qFormat/><w:pPr><w:spacing w:after="80" w:line="240" w:lineRule="auto"/><w:contextualSpacing/><w:jc w:val="left"/></w:pPr><w:rPr><w:rFonts w:ascii="${hfont}" w:hAnsi="${hfont}" w:eastAsia="${hfont}" w:cs="${hfont}"/><w:spacing w:val="-10"/><w:kern w:val="28"/><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="11"/><w:qFormat/><w:pPr><w:jc w:val="left"/></w:pPr><w:rPr><w:color w:val="595959"/><w:spacing w:val="15"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="29"/><w:qFormat/><w:pPr><w:spacing w:before="160"/><w:ind w:left="864" w:right="864"/><w:jc w:val="center"/></w:pPr><w:rPr><w:i/><w:iCs/><w:color w:val="404040"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="IntenseQuote"><w:name w:val="Intense Quote"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="30"/><w:qFormat/><w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:space="10" w:color="${hc}"/><w:bottom w:val="single" w:sz="4" w:space="10" w:color="${hc}"/></w:pBdr><w:spacing w:before="360" w:after="360"/><w:ind w:left="864" w:right="864"/><w:jc w:val="center"/></w:pPr><w:rPr><w:i/><w:iCs/><w:color w:val="${hc}"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="NoSpacing"><w:name w:val="No Spacing"/><w:uiPriority w:val="1"/><w:qFormat/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="34"/><w:qFormat/><w:pPr><w:ind w:left="720"/><w:contextualSpacing/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Header"><w:name w:val="header"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:pPr><w:tabs><w:tab w:val="center" w:pos="4680"/><w:tab w:val="right" w:pos="9360"/></w:tabs><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:pPr><w:tabs><w:tab w:val="center" w:pos="4680"/><w:tab w:val="right" w:pos="9360"/></w:tabs><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr></w:style>
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:basedOn w:val="DefaultParagraphFont"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="FootnoteText"><w:name w:val="footnote text"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>
<w:style w:type="character" w:styleId="FootnoteReference"><w:name w:val="footnote reference"/><w:basedOn w:val="DefaultParagraphFont"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="CommentText"><w:name w:val="annotation text"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:pPr><w:spacing w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>
<w:style w:type="character" w:styleId="CommentReference"><w:name w:val="annotation reference"/><w:basedOn w:val="DefaultParagraphFont"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="TOCHeading"><w:name w:val="TOC Heading"/><w:basedOn w:val="Heading1"/><w:next w:val="Normal"/><w:uiPriority w:val="39"/><w:unhideWhenUsed/><w:qFormat/><w:pPr><w:outlineLvl w:val="9"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="TOC1"><w:name w:val="toc 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="39"/><w:unhideWhenUsed/><w:pPr><w:spacing w:after="100"/><w:jc w:val="left"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="TOC2"><w:name w:val="toc 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="39"/><w:unhideWhenUsed/><w:pPr><w:spacing w:after="100"/><w:ind w:left="220"/><w:jc w:val="left"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="TOC3"><w:name w:val="toc 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="39"/><w:unhideWhenUsed/><w:pPr><w:spacing w:after="100"/><w:ind w:left="440"/><w:jc w:val="left"/></w:pPr></w:style>
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/><w:uiPriority w:val="39"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tblBorders></w:tblPr></w:style>
</w:styles>`;
  }

  const WATERMARK_SHAPETYPE = '<v:shapetype id="_x0000_t136" coordsize="21600,21600" o:spt="136" adj="10800" path="m@7,l@8,m@5,21600l@6,21600e"><v:formulas><v:f eqn="sum #0 0 10800"/><v:f eqn="prod #0 2 1"/><v:f eqn="sum 21600 0 @1"/><v:f eqn="sum 0 0 @2"/><v:f eqn="sum 21600 0 @3"/><v:f eqn="if @0 @3 0"/><v:f eqn="if @0 21600 @1"/><v:f eqn="if @0 0 @2"/><v:f eqn="if @0 @4 21600"/><v:f eqn="mid @5 @6"/><v:f eqn="mid @8 @5"/><v:f eqn="mid @7 @8"/><v:f eqn="mid @6 @7"/><v:f eqn="sum @6 0 @5"/></v:formulas><v:path textpathok="t" o:connecttype="custom" o:connectlocs="@9,0;@10,10800;@11,21600;@12,10800" o:connectangles="270,180,90,0"/><v:textpath on="t" fitshape="t"/><v:handles><v:h position="#0,bottomRight" xrange="6629,14971"/></v:handles><o:lock v:ext="edit" text="t" shapetype="t"/></v:shapetype>';
  function watermarkPara(text) {
    return `<w:p><w:pPr><w:pStyle w:val="Header"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr><w:pict>${WATERMARK_SHAPETYPE}<v:shape id="PowerPlusWaterMarkObject1" o:spid="_x0000_s2049" type="#_x0000_t136" style="position:absolute;margin-left:0;margin-top:0;width:468pt;height:117pt;rotation:315;z-index:-251657216;mso-position-horizontal:center;mso-position-horizontal-relative:margin;mso-position-vertical:center;mso-position-vertical-relative:margin" o:allowincell="f" fillcolor="silver" stroked="f"><v:fill opacity=".5"/><v:textpath style="font-family:&quot;Calibri&quot;;font-size:1pt" string="${esc(text)}"/><w10:wrap anchorx="margin" anchory="margin"/></v:shape></w:pict></w:r></w:p>`;
  }

  function parseHtml(html) {
    const d = new DOMParser().parseFromString('<!DOCTYPE html><body>' + (html || '') + '</body>', 'text/html');
    return d.body;
  }

  /* ---------- prepare images (external / unsupported -> PNG data URL) ---------- */
  async function toDataUrl(img) {
    const src = img.getAttribute('src') || '';
    if (/^data:image\/(png|jpe?g|gif|bmp)/i.test(src)) return src;
    try {
      if (!img.complete) await new Promise(r => { img.onload = img.onerror = r; });
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || 1; c.height = img.naturalHeight || 1;
      c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/png');
    } catch (e) { return null; }
  }

  /* opts: { root: Element, settings, comments, theme, title, author, trackChanges } */
  async function build(opts) {
    const b = makeBuild(opts);
    const s = opts.settings || {};
    let [pw] = PAGE_SIZES[s.pageSize] || PAGE_SIZES.A4;
    if (s.orientation === 'landscape') pw = (PAGE_SIZES[s.pageSize] || PAGE_SIZES.A4)[1];
    const m = s.margins || { left: 1, right: 1 };
    b.contentTw = Math.round(pw - (m.left + m.right) * 1440);
    b.sectionsSoFar = 0;

    const root = opts.root;
    const fixes = [];
    for (const img of root.querySelectorAll('img')) {
      const src = img.getAttribute('src') || '';
      if (!/^data:image\/(png|jpe?g|gif|bmp)/i.test(src)) {
        const d = await toDataUrl(img);
        if (d) { fixes.push([img, src]); img.setAttribute('src', d); }
      }
    }
    root.querySelectorAll('span.cmt[data-cid]').forEach(el => b.cmtLast.set(el.getAttribute('data-cid'), el));

    const doc = makePart(b); doc.isBody = true;
    const files = [];
    const hfXml = (tag, html, isHeader, withWm) => {
      const part = makePart(b);
      let inner = blocks(parseHtml(html), part, { style: isHeader ? 'Header' : 'Footer' });
      if (withWm) inner = watermarkPara(withWm) + inner;
      if (!inner) inner = `<w:p><w:pPr><w:pStyle w:val="${isHeader ? 'Header' : 'Footer'}"/></w:pPr></w:p>`;
      return { xml: XMLH + `<${tag} ${W_NS}>${inner}</${tag}>`, part };
    };
    let hfN = 0;
    const addHF = (html, isHeader, wm) => {
      hfN++;
      const name = (isHeader ? 'header' : 'footer') + hfN + '.xml';
      const { xml, part } = hfXml(isHeader ? 'w:hdr' : 'w:ftr', html, isHeader, wm);
      files.push({ name: 'word/' + name, data: xml, ct: isHeader ? 'header' : 'footer' });
      if (part.rels.length) files.push({ name: `word/_rels/${name}.rels`, data: part.relsXml() });
      return doc.rel(isHeader ? 'header' : 'footer', name);
    };
    const wm = s.watermark || '';
    if (s.header || wm) b.hdr = addHF(s.header || '', true, wm);
    if (s.footer) b.ftr = addHF(s.footer, false);
    if (s.differentFirst) { b.hdrFirst = addHF(s.firstHeader || '', true, wm); b.ftrFirst = addHF(s.firstFooter || '', false); }

    let body = blocks(root, doc, {});
    if (!body) body = '<w:p/>';
    const finalSect = sectPr(doc, { cols: 1, continuous: b.anySections });
    const bg = hex(s.pageColor);
    const documentXml = XMLH + `<w:document ${W_NS}>${bg && bg !== 'FFFFFF' ? `<w:background w:color="${bg}"/>` : ''}<w:body>${body}${finalSect}</w:body></w:document>`;

    fixes.forEach(([img, src]) => img.setAttribute('src', src));

    doc.rel('styles', 'styles.xml');
    doc.rel('settings', 'settings.xml');
    if (b.hasNumbering) { doc.rel('numbering', 'numbering.xml'); files.push({ name: 'word/numbering.xml', data: numberingXml(b), ct: 'numbering' }); }
    if (b.cmtNum.size) {
      let cx = '';
      const author = opts.author || 'Author';
      for (const [cid, num] of b.cmtNum) {
        const c = b.comments[cid]; if (!c) continue;
        const a = c.author || author;
        const initials = a.split(/\s+/).map(w => w[0] || '').join('').slice(0, 3).toUpperCase();
        const paraOf = (text, first) => String(text || '').split('\n').map((ln, i) => `<w:p><w:pPr><w:pStyle w:val="CommentText"/></w:pPr>${first && i === 0 ? '<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:annotationRef/></w:r>' : ''}<w:r><w:t xml:space="preserve">${esc(ln)}</w:t></w:r></w:p>`).join('');
        let ps = paraOf(c.text, true);
        (c.replies || []).forEach(r => { ps += paraOf(`Reply from ${r.author || a}: ${r.text}`, false); });
        cx += `<w:comment w:id="${num}" w:author="${esc(a)}" w:date="${isoDate(c.date)}" w:initials="${esc(initials)}">${ps}</w:comment>`;
      }
      doc.rel('comments', 'comments.xml');
      files.push({ name: 'word/comments.xml', data: XMLH + `<w:comments ${W_NS}>${cx}</w:comments>`, ct: 'comments' });
    }
    if (b.footnotes.length) {
      const sepP = t => `<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:${t}/></w:r></w:p>`;
      let fx = `<w:footnote w:type="separator" w:id="-1">${sepP('separator')}</w:footnote><w:footnote w:type="continuationSeparator" w:id="0">${sepP('continuationSeparator')}</w:footnote>`;
      b.footnotes.forEach((t, i) => { fx += `<w:footnote w:id="${i + 1}"><w:p><w:pPr><w:pStyle w:val="FootnoteText"/></w:pPr><w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteRef/></w:r><w:r><w:t xml:space="preserve"> ${esc(t)}</w:t></w:r></w:p></w:footnote>`; });
      doc.rel('footnotes', 'footnotes.xml');
      files.push({ name: 'word/footnotes.xml', data: XMLH + `<w:footnotes ${W_NS}>${fx}</w:footnotes>`, ct: 'footnotes' });
    }
    const settingsXml = XMLH + `<w:settings ${W_NS}><w:zoom w:percent="100"/>${bg ? '<w:displayBackgroundShape/>' : ''}${opts.trackChanges ? '<w:trackRevisions/>' : ''}<w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/>${b.footnotes.length ? '<w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr>' : ''}<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;

    const now = isoDate();
    const core = XMLH + `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(opts.title || '')}</dc:title><dc:creator>${esc(opts.author || '')}</dc:creator><cp:lastModifiedBy>${esc(opts.author || '')}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${isoDate(opts.created)}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
    const app = XMLH + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>DraftLy</Application><DocSecurity>0</DocSecurity></Properties>';

    const CT = {
      header: 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml',
      footer: 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml',
      numbering: 'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml',
      comments: 'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml',
      footnotes: 'application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml'
    };
    const overrides = files.filter(f => f.ct).map(f => `<Override PartName="/${f.name}" ContentType="${CT[f.ct]}"/>`).join('');
    const types = XMLH + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Default Extension="bmp" ContentType="image/bmp"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>${overrides}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
    const rootRels = XMLH + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>';

    const all = [
      { name: '[Content_Types].xml', data: types },
      { name: '_rels/.rels', data: rootRels },
      { name: 'word/document.xml', data: documentXml },
      { name: 'word/styles.xml', data: stylesXml(opts.theme || {}) },
      { name: 'word/settings.xml', data: settingsXml },
      ...files,
      { name: 'word/_rels/document.xml.rels', data: doc.relsXml() },
      ...b.media.map(md => ({ name: 'word/media/' + md.name, data: md.bytes })),
      { name: 'docProps/core.xml', data: core },
      { name: 'docProps/app.xml', data: app }
    ];
    return Zip.build(all, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  }
  return { build, hex, toPx, PAGE_SIZES };
})();
