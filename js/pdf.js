/* DraftLy: exact-page PDF maker. Draws each laid-out page onto a canvas and packs the pages into a PDF.
   Used where the system print dialog is unavailable (iPhone/iPad Home Screen app) and as a fallback. */
const PdfMaker = (() => {
  const SCALE = 2; // 192 dpi
  const transparent = c => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
  function alpha(n) { let s = ''; while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); } return s; }
  function roman(n) { const m = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]; let s = ''; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; }
  function markerText(li) {
    const list = li.parentElement; if (!list) return '';
    const type = getComputedStyle(list).listStyleType || '';
    const isOl = list.tagName === 'OL';
    const idx = [...list.children].filter(c => c.tagName === 'LI').indexOf(li);
    const n = (isOl ? (parseInt(list.getAttribute('start')) || 1) : 1) + idx;
    switch (type) {
      case 'none': return '';
      case 'disc': return '•'; case 'circle': return '◦'; case 'square': return '▪';
      case 'lower-alpha': case 'lower-latin': return alpha(n) + '.';
      case 'upper-alpha': case 'upper-latin': return alpha(n).toUpperCase() + '.';
      case 'lower-roman': return roman(n) + '.';
      case 'upper-roman': return roman(n).toUpperCase() + '.';
      case 'paren-lower-alpha': return '(' + alpha(n) + ')';
      case 'paren-upper-alpha': return '(' + alpha(n).toUpperCase() + ')';
      case 'paren-lower-roman': return '(' + roman(n) + ')';
      case 'paren-decimal': return '(' + n + ')';
      case 'decimal-paren': return n + ')';
      default: return isOl ? n + '.' : '•';
    }
  }
  const fontOf = cs => `${cs.fontStyle} ${cs.fontVariantCaps === 'small-caps' || cs.fontVariant === 'small-caps' ? 'small-caps ' : ''}${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  let mctx = null;
  function metrics(font, sizePx) {
    mctx = mctx || document.createElement('canvas').getContext('2d');
    mctx.font = font;
    const m = mctx.measureText('Hg');
    const asc = m.fontBoundingBoxAscent ?? sizePx * 0.8, desc = m.fontBoundingBoxDescent ?? sizePx * 0.2;
    return { asc, desc };
  }

  /* collect drawing operations in page coordinates */
  function collect(base) {
    const ops = [];
    const rel = r => ({ x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height });
    const visible = cs => cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) !== 0;
    // watermark
    $$('#sheets .wm span').forEach(sp => {
      const cs = getComputedStyle(sp), r = rel(sp.getBoundingClientRect());
      ops.push({ t: 'wm', cx: r.x + r.w / 2, cy: r.y + r.h / 2, text: sp.textContent, font: fontOf(cs), color: cs.color });
    });
    const roots = [...$$('#sheets .hf'), editor, $('#footnoteArea')];
    for (const root of roots) {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let n = root;
      const hiddenCache = new WeakMap();
      const isHidden = el => {
        if (hiddenCache.has(el)) return hiddenCache.get(el);
        const v = !visible(getComputedStyle(el)) || (el.parentElement && el !== root && isHidden(el.parentElement));
        hiddenCache.set(el, v); return v;
      };
      while (n) {
        if (n.nodeType === 1) {
          const el = n, cs = getComputedStyle(el);
          if (isHidden(el)) { n = nextSkip(w); continue; }
          // backgrounds
          if (!transparent(cs.backgroundColor) && el !== editor) {
            const rects = cs.display === 'inline' ? [...el.getClientRects()] : [el.getBoundingClientRect()];
            rects.forEach(rc => { const r = rel(rc); if (r.w && r.h) ops.push({ t: 'rect', ...r, color: cs.backgroundColor }); });
          }
          // borders
          const br = rel(el.getBoundingClientRect());
          for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
            const bw = parseFloat(cs['border' + side + 'Width']), bs = cs['border' + side + 'Style'], bc = cs['border' + side + 'Color'];
            if (!bw || bs === 'none' || bs === 'hidden' || transparent(bc) || cs.display === 'inline') continue;
            const dash = bs === 'dotted' ? [bw, bw * 2] : bs === 'dashed' ? [bw * 3, bw * 2] : null;
            const o = { t: 'line', w: bw, color: bc, dash };
            if (side === 'Top') Object.assign(o, { x1: br.x, y1: br.y + bw / 2, x2: br.x + br.w, y2: br.y + bw / 2 });
            if (side === 'Bottom') Object.assign(o, { x1: br.x, y1: br.y + br.h - bw / 2, x2: br.x + br.w, y2: br.y + br.h - bw / 2 });
            if (side === 'Left') Object.assign(o, { x1: br.x + bw / 2, y1: br.y, x2: br.x + bw / 2, y2: br.y + br.h });
            if (side === 'Right') Object.assign(o, { x1: br.x + br.w - bw / 2, y1: br.y, x2: br.x + br.w - bw / 2, y2: br.y + br.h });
            ops.push(o);
          }
          if (el.tagName === 'IMG' && el.complete && el.naturalWidth) ops.push({ t: 'img', el, ...br });
          if (el.tagName === 'SUP' && el.classList.contains('fn')) {
            const { asc, desc } = metrics(fontOf(cs), parseFloat(cs.fontSize));
            ops.push({ t: 'text', x: br.x, y: br.y + (br.h - (asc + desc)) / 2 + asc, text: el.getAttribute('data-n') || '', font: fontOf(cs), color: cs.color });
          }
          if (el.tagName === 'LI') {
            const mk = markerText(el);
            if (mk) {
              let first = null;
              const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: t => t.parentElement.closest('ul,ol') !== el.parentElement && t.parentElement.closest('li') !== el ? NodeFilter.FILTER_REJECT : (t.data.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP) });
              const t = tw.nextNode();
              if (t) { const rg = document.createRange(); rg.selectNodeContents(t); first = rg.getClientRects()[0]; }
              const lcs = getComputedStyle(el);
              const font = fontOf(lcs), size = parseFloat(lcs.fontSize);
              const { asc, desc } = metrics(font, size);
              const fr = first ? rel(first) : { x: br.x, y: br.y, h: size * 1.2 };
              const lineTop = first ? fr.y : br.y;
              const lineH = first ? fr.h : (asc + desc);
              ops.push({ t: 'text', x: br.x - size * 0.45, y: lineTop + (lineH - (asc + desc)) / 2 + asc, text: mk, font, color: lcs.color, align: 'right' });
            }
          }
          n = w.nextNode();
          continue;
        }
        // text node
        const t = n, pe = t.parentElement;
        if (pe && !isHidden(pe) && t.data.replace(/[\s​]/g, '')) {
          const cs = getComputedStyle(pe);
          const font = fontOf(cs), size = parseFloat(cs.fontSize);
          const { asc, desc } = metrics(font, size);
          let data = t.data;
          if (cs.textTransform === 'uppercase') data = data.toUpperCase(); else if (cs.textTransform === 'lowercase') data = data.toLowerCase();
          const rg = document.createRange();
          const re = /[^\s​]+/g;
          let m;
          while ((m = re.exec(t.data))) {
            rg.setStart(t, m.index); rg.setEnd(t, m.index + m[0].length);
            const rects = [...rg.getClientRects()].filter(r => r.width > 0);
            const word = data.substr(m.index, m[0].length);
            if (rects.length === 1) {
              const r = rel(rects[0]);
              ops.push({ t: 'text', x: r.x, y: r.y + (r.h - (asc + desc)) / 2 + asc, text: word, font, color: cs.color, ls: cs.letterSpacing, w: r.w, size, layer: true });
            } else if (rects.length > 1) {
              for (let i = 0; i < m[0].length; i++) {
                rg.setStart(t, m.index + i); rg.setEnd(t, m.index + i + 1);
                const cr = rg.getClientRects()[0]; if (!cr) continue;
                const r = rel(cr);
                ops.push({ t: 'text', x: r.x, y: r.y + (r.h - (asc + desc)) / 2 + asc, text: word[i], font, color: cs.color, w: r.w, size, layer: true });
              }
            }
          }
          // underline / strikethrough from any inline ancestor
          let u = null, s = null;
          for (let a = pe; a && a !== root && a.parentElement; a = a.parentElement) {
            const acs = getComputedStyle(a);
            const line = acs.textDecorationLine || acs.textDecoration || '';
            if (!u && line.includes('underline')) u = acs.textDecorationColor && !/currentcolor/i.test(acs.textDecorationColor) ? acs.textDecorationColor : acs.color;
            if (!s && line.includes('line-through')) s = acs.textDecorationColor && !/currentcolor/i.test(acs.textDecorationColor) ? acs.textDecorationColor : acs.color;
            if (acs.display !== 'inline') break;
          }
          if (u || s) {
            rg.selectNodeContents(t);
            for (const cr of rg.getClientRects()) {
              const r = rel(cr); if (!r.w) continue;
              const baseY = r.y + (r.h - (asc + desc)) / 2 + asc;
              const lw = Math.max(0.6, size / 16);
              if (u) ops.push({ t: 'line', x1: r.x, y1: baseY + size * 0.12, x2: r.x + r.w, y2: baseY + size * 0.12, w: lw, color: u });
              if (s) ops.push({ t: 'line', x1: r.x, y1: baseY - asc * 0.3, x2: r.x + r.w, y2: baseY - asc * 0.3, w: lw, color: s });
            }
          }
        }
        n = w.nextNode();
      }
    }
    return ops;
  }
  function nextSkip(w) { // skip the current element's subtree
    let n = w.currentNode;
    while (n) { if (n.nextSibling) { w.currentNode = n.nextSibling; return n.nextSibling; } n = n.parentNode; if (!n || n === w.root) return null; }
    return null;
  }
  const yOf = o => o.t === 'line' ? Math.min(o.y1, o.y2) : o.t === 'wm' ? o.cy - 400 : o.y;
  const hOf = o => o.t === 'line' ? Math.abs(o.y2 - o.y1) + 2 : o.t === 'wm' ? 800 : (o.h || 60);

  function drawPage(ops, i, g, pageColor) {
    const c = document.createElement('canvas');
    c.width = Math.round(g.pw * SCALE); c.height = Math.round(g.ph * SCALE);
    const ctx = c.getContext('2d');
    ctx.fillStyle = pageColor || '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.scale(SCALE, SCALE);
    ctx.translate(0, -i * g.ph);
    ctx.textBaseline = 'alphabetic';
    const top = i * g.ph, bot = top + g.ph;
    const order = { wm: 0, rect: 1, img: 2, line: 3, text: 4 };
    const list = ops.filter(o => yOf(o) < bot && yOf(o) + hOf(o) > top).sort((a, b) => order[a.t] - order[b.t]);
    c._text = list.filter(o => o.t === 'text' && o.layer).map(o => ({ x: o.x, y: o.y - top, w: o.w, size: o.size, text: o.text }));
    for (const o of list) {
      if (o.t === 'rect') { ctx.fillStyle = o.color; ctx.fillRect(o.x, o.y, o.w, o.h); }
      else if (o.t === 'img') { try { ctx.drawImage(o.el, o.x, o.y, o.w, o.h); } catch (e) { } }
      else if (o.t === 'line') { ctx.save(); ctx.strokeStyle = o.color; ctx.lineWidth = o.w; if (o.dash) ctx.setLineDash(o.dash); ctx.beginPath(); ctx.moveTo(o.x1, o.y1); ctx.lineTo(o.x2, o.y2); ctx.stroke(); ctx.restore(); }
      else if (o.t === 'text') { ctx.font = o.font; ctx.fillStyle = o.color; ctx.textAlign = o.align || 'left'; if ('letterSpacing' in ctx) ctx.letterSpacing = o.ls && o.ls !== 'normal' ? o.ls : '0px'; ctx.fillText(o.text, o.x, o.y); }
      else if (o.t === 'wm') { ctx.save(); ctx.translate(o.cx, o.cy); ctx.rotate(-Math.PI / 4); ctx.font = o.font; ctx.fillStyle = o.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.text, 0, 0); ctx.restore(); }
    }
    return c;
  }
  async function canvasJpeg(c) {
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
    return new Uint8Array(await blob.arrayBuffer());
  }
  /* invisible, searchable text layer (WinAnsi / Helvetica) placed over each page image */
  const CP = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };
  function winAnsi(str) {
    const out = [];
    for (const ch of str.replace(/\u20B9/g, 'Rs.')) {
      const c = ch.codePointAt(0);
      let b = (c >= 32 && c < 127) || (c >= 0xA0 && c <= 0xFF) ? c : CP[c] || 63;
      if (b === 0x28 || b === 0x29 || b === 0x5C) out.push(0x5C);
      out.push(b);
    }
    return out;
  }
  function textLayer(items, hPt) {
    if (!items || !items.length) return new Uint8Array(0);
    mctx = mctx || document.createElement('canvas').getContext('2d');
    const enc = new TextEncoder(), parts = [enc.encode('BT /F1 1 Tf 3 Tr\n')];
    for (const it of items) {
      const size = it.size || 12;
      mctx.font = `${size}px Helvetica, Arial, sans-serif`;
      const mw = mctx.measureText(it.text).width || 1;
      const tz = Math.max(20, Math.min(400, (it.w || mw) / mw * 100));
      const pt = size * 0.75;
      parts.push(enc.encode(`${pt.toFixed(2)} 0 0 ${pt.toFixed(2)} ${(it.x * 0.75).toFixed(2)} ${(hPt - it.y * 0.75).toFixed(2)} Tm ${tz.toFixed(1)} Tz (`), new Uint8Array(winAnsi(it.text)), enc.encode(') Tj\n'));
    }
    parts.push(enc.encode('ET\n'));
    const len = parts.reduce((a, b) => a + b.length, 0), out = new Uint8Array(len);
    let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  function buildPdf(pages, wPt, hPt, title) {
    const enc = new TextEncoder();
    const parts = []; let off = 0; const offs = [];
    const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); off += b.length; };
    const n = pages.length, total = 3 + n * 3;
    push('%PDF-1.4\n%âãÏÓ\n');
    const obj = (num, ...body) => { offs[num] = off; push(`${num} 0 obj\n`); body.forEach(push); push('\nendobj\n'); };
    const f = v => (Math.round(v * 100) / 100).toString();
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, `<< /Type /Pages /Kids [${pages.map((_, k) => `${4 + k * 3} 0 R`).join(' ')}] /Count ${n} >>`);
    const t = (title || 'Document').replace(/[()\\]/g, ' ');
    obj(3, `<< /Title (${t}) /Producer (DraftLy) >>`);
    const fontObj = total + 1;
    pages.forEach((p, k) => {
      const po = 4 + k * 3, co = po + 1, io = po + 2;
      obj(po, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(wPt)} ${f(hPt)}] /Resources << /XObject << /Im0 ${io} 0 R >> /Font << /F1 ${fontObj} 0 R >> >> /Contents ${co} 0 R >>`);
      const head = enc.encode(`q ${f(wPt)} 0 0 ${f(hPt)} 0 0 cm /Im0 Do Q\n`);
      const layer = textLayer(p.text, hPt);
      obj(co, `<< /Length ${head.length + layer.length} >>\nstream\n`, head, layer, '\nendstream');
      obj(io, `<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`, p.bytes, '\nendstream');
    });
    obj(fontObj, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const xref = off;
    let x = `xref\n0 ${fontObj + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= fontObj; i++) x += String(offs[i] || 0).padStart(10, '0') + ' 00000 n \n';
    push(x + `trailer\n<< /Size ${fontObj + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts, { type: 'application/pdf' });
  }

  /* lay the document out exactly as printed, draw every page, return a PDF Blob */
  async function make(progress) {
    const before = { view: document.body.classList.contains('read') ? 'read' : document.body.classList.contains('focus') ? 'focus' : ui.view };
    if (before.view !== 'print') setView('print');
    selectImage(null); clearFind();
    ui.printing = true; ui.raster = true; document.body.classList.add('printing');
    try {
      paginate();
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await Promise.all($$('img', editor).concat($$('#sheets img')).map(im => im.decode ? im.decode().catch(() => { }) : null));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const g = geom();
      const base = $('#pages').getBoundingClientRect();
      const ops = collect(base);
      const out = [];
      for (let i = 0; i < ui.pages; i++) {
        progress && progress(i + 1, ui.pages);
        const c = drawPage(ops, i, g, doc.settings.pageColor);
        out.push({ w: c.width, h: c.height, bytes: await canvasJpeg(c), text: c._text });
        await new Promise(r => setTimeout(r, 0));
      }
      return buildPdf(out, g.pw * 0.75, g.ph * 0.75, doc.title);
    } finally {
      ui.printing = false; ui.raster = false; document.body.classList.remove('printing');
      if (before.view !== 'print') setView(before.view); else paginate();
    }
  }
  return { make, buildPdf };
})();
