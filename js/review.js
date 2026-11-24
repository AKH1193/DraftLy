/* DraftLy: Track Changes and Comments engine. */
const Review = (() => {
  let ed, getAuthor, onChange;
  const now = () => new Date().toISOString();
  const isTc = (n, tag) => n && n.nodeType === 1 && n.tagName === tag && n.classList.contains('tc');
  const up = (n, sel) => { while (n && n !== ed) { if (n.nodeType === 1 && n.matches(sel)) return n; n = n.parentNode; } return null; };
  const idx = n => Array.prototype.indexOf.call(n.parentNode.childNodes, n);
  const mk = tag => { const e = document.createElement(tag); e.className = 'tc'; e.setAttribute('data-author', getAuthor()); e.setAttribute('data-date', now()); return e; };
  const unwrap = el => { const p = el.parentNode; if (!p) return; while (el.firstChild) p.insertBefore(el.firstChild, el); p.removeChild(el); p.normalize && p.normalize(); };
  const sel = () => window.getSelection();
  const inEditor = r => r && ed.contains(r.commonAncestorContainer);

  function init(editor, authorFn, changeFn) {
    ed = editor; getAuthor = authorFn; onChange = changeFn;
    ed.addEventListener('beforeinput', onBeforeInput);
    ed.addEventListener('compositionstart', onCompStart);
    ed.addEventListener('compositionend', onCompEnd);
  }
  let tracking = false;
  const setTracking = v => { tracking = !!v; };
  const isTracking = () => tracking;

  /* split text at range edges and return the atomic nodes fully inside the range */
  function isolate(range) {
    let sc = range.startContainer, so = range.startOffset, ec = range.endContainer, eo = range.endOffset;
    if (ec.nodeType === 3 && eo > 0 && eo < ec.length) ec.splitText(eo);
    if (sc.nodeType === 3 && so > 0 && so < sc.length) {
      const nn = sc.splitText(so);
      if (ec === sc) { ec = nn; eo = eo - so; }
      sc = nn; so = 0;
    }
    const r = document.createRange();
    r.setStart(sc, so);
    r.setEnd(ec, eo);
    // move text-node boundaries to node boundaries so whole nodes compare as "inside"
    if (sc.nodeType === 3 && sc.parentNode) { if (so === 0) r.setStartBefore(sc); else if (so >= sc.length) r.setStartAfter(sc); }
    if (ec.nodeType === 3 && ec.parentNode) { if (eo >= ec.length) r.setEndAfter(ec); else if (eo === 0) r.setEndBefore(ec); }
    const root = r.commonAncestorContainer.nodeType === 3 ? r.commonAncestorContainer.parentNode : r.commonAncestorContainer;
    const out = [];
    const inside = n => { const p = n.parentNode, i = idx(n); try { return r.comparePoint(p, i) === 0 && r.comparePoint(p, i + 1) === 0; } catch (e) { return false; } };
    if (root.nodeType === 3) { if (inside(root)) out.push(root); return { nodes: out, range: r }; }
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(n) {
        if (n.nodeType === 3) return n.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        if (n.tagName === 'IMG' || n.tagName === 'BR' || (n.tagName === 'SUP' && n.classList.contains('fn'))) return NodeFilter.FILTER_ACCEPT;
        if (n.getAttribute('contenteditable') === 'false') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_SKIP;
      }
    });
    if (root.nodeType === 3) { if (inside(root)) out.push(root); }
    let n;
    while ((n = w.nextNode())) if (inside(n)) out.push(n);
    return { nodes: out, range: r };
  }

  /* mark nodes in range as deleted (or truly delete own/other insertions) */
  function markDeleted(range) {
    const { nodes } = isolate(range);
    let first = null, last = null, removedAny = false;
    const author = getAuthor();
    for (const n of nodes) {
      if (!n.parentNode) continue;
      if (up(n, 'del.tc')) { first = first || up(n, 'del.tc'); last = up(n, 'del.tc'); continue; }
      const ins = up(n, 'ins.tc');
      if (ins) {
        const holder = n.parentNode;
        holder.removeChild(n);
        removedAny = true;
        if (!ins.textContent && !ins.querySelector('img,br,sup')) {
          const marker = document.createTextNode('');
          ins.parentNode.insertBefore(marker, ins);
          ins.parentNode.removeChild(ins);
          if (!first) first = marker; last = marker;
        }
        continue;
      }
      const prev = n.previousSibling;
      let d;
      if (isTc(prev, 'DEL') && prev.getAttribute('data-author') === author) { d = prev; d.appendChild(n); }
      else { d = mk('del'); n.parentNode.insertBefore(d, n); d.appendChild(n); }
      const nx = d.nextSibling;
      if (isTc(nx, 'DEL') && nx.getAttribute('data-author') === author) { while (nx.firstChild) d.appendChild(nx.firstChild); nx.remove(); }
      d.normalize();
      if (!first) first = d; last = d;
    }
    return { first, last, any: !!first || removedAny };
  }
  function caretBefore(node) { const r = document.createRange(); r.setStartBefore(node); r.collapse(true); const s = sel(); s.removeAllRanges(); s.addRange(r); }
  function caretAfter(node) { const r = document.createRange(); r.setStartAfter(node); r.collapse(true); const s = sel(); s.removeAllRanges(); s.addRange(r); }

  function escapeDel(r) {
    const d = up(r.startContainer, 'del.tc');
    if (d) { r.setStartAfter(d); r.collapse(true); }
    return r;
  }
  function ownIns(n) { const i = up(n, 'ins.tc'); return i && i.getAttribute('data-author') === getAuthor() ? i : null; }

  function trackedInsert(text) {
    const s = sel();
    if (!s.rangeCount) return;
    let r = s.getRangeAt(0);
    if (!r.collapsed) {
      const res = markDeleted(r);
      if (res.last) { r = document.createRange(); r.setStartAfter(res.last); r.collapse(true); }
      else r = s.getRangeAt(0);
    }
    r = escapeDel(r);
    let c = r.startContainer, o = r.startOffset;
    if (c === ed) {
      // caret directly in editor: make a paragraph
      const p = document.createElement('p');
      ed.insertBefore(p, ed.childNodes[o] || null);
      c = p; o = 0;
    }
    // continue an adjacent insertion by the same author
    let target = null, toff = 0;
    if (c.nodeType === 3 && ownIns(c)) { target = c; toff = o; }
    else {
      let prev = null;
      if (c.nodeType === 3 && o === 0) prev = c.previousSibling;
      else if (c.nodeType === 1) prev = c.childNodes[o - 1];
      if (c.nodeType === 3 && o === c.length && !ownIns(c)) prev = null;
      if (isTc(prev, 'INS') && prev.getAttribute('data-author') === getAuthor()) {
        let t = prev.lastChild;
        if (!t || t.nodeType !== 3) { t = document.createTextNode(''); prev.appendChild(t); }
        target = t; toff = t.length;
      }
    }
    if (target) {
      target.insertData(toff, text);
      const nr = document.createRange(); nr.setStart(target, toff + text.length); nr.collapse(true);
      s.removeAllRanges(); s.addRange(nr);
    } else {
      const ins = mk('ins');
      const t = document.createTextNode(text);
      ins.appendChild(t);
      if (c.nodeType === 3) {
        const after = c.splitText(o);
        c.parentNode.insertBefore(ins, after);
        if (!c.length) c.remove();
      } else {
        const ref = c.childNodes[o] || null;
        if (ref && ref.nodeName === 'BR' && ref === c.lastChild && c.childNodes.length === 1) c.replaceChild(ins, ref);
        else c.insertBefore(ins, ref);
      }
      const nr = document.createRange(); nr.setStart(t, t.length); nr.collapse(true);
      s.removeAllRanges(); s.addRange(nr);
    }
  }

  function trackedDelete(dir, unit) {
    const s = sel();
    if (!s.rangeCount) return false;
    let r = s.getRangeAt(0);
    if (r.collapsed) {
      let guard = 0;
      while (guard++ < 400) {
        const sv = s.getRangeAt(0).cloneRange();
        s.modify('extend', dir, unit);
        const nr = s.getRangeAt(0);
        if (nr.collapsed || (nr.compareBoundaryPoints(Range.START_TO_START, sv) === 0 && nr.compareBoundaryPoints(Range.END_TO_END, sv) === 0)) { s.removeAllRanges(); s.addRange(sv); return false; }
        const { nodes } = isolateProbe(nr);
        if (!nodes.length) { s.removeAllRanges(); s.addRange(sv); return false; }
        if (nodes.every(n => up(n, 'del.tc'))) {
          // skip over already deleted text
          const d = up(nodes[dir === 'backward' ? 0 : nodes.length - 1], 'del.tc');
          if (dir === 'backward') caretBefore(d); else caretAfter(d);
          continue;
        }
        r = nr; break;
      }
    }
    const res = markDeleted(r);
    if (!res.any) return false;
    const target = dir === 'backward' ? res.first : res.last;
    if (target && target.parentNode) { if (dir === 'backward') caretBefore(target); else caretAfter(target); if (target.nodeType === 3 && !target.length) target.remove(); }
    return true;
  }
  /* like isolate but without splitting text (read-only probe) */
  function isolateProbe(r) {
    const out = [];
    const root = r.commonAncestorContainer;
    if (root.nodeType === 3) return { nodes: [root] };
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(n) {
        if (n.nodeType === 3) return n.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        return (n.tagName === 'IMG' || n.tagName === 'SUP') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    let n;
    while ((n = w.nextNode())) if (r.intersectsNode(n)) {
      if (n.nodeType === 3) {
        if (n === r.startContainer && r.startOffset >= n.length) continue;
        if (n === r.endContainer && r.endOffset === 0) continue;
      }
      out.push(n);
    }
    return { nodes: out };
  }

  function onBeforeInput(e) {
    if (!tracking) return;
    const t = e.inputType;
    const s = sel();
    if (!s.rangeCount || !inEditor(s.getRangeAt(0))) return;
    if (t === 'insertCompositionText' || t === 'historyUndo' || t === 'historyRedo') return;
    let handled = false;
    if (t === 'insertText') {
      const data = e.data != null ? e.data : (e.dataTransfer && e.dataTransfer.getData('text/plain')) || '';
      if (data) { trackedInsert(data); handled = true; }
    } else if (t === 'insertReplacementText' || t === 'insertFromPaste' || t === 'insertFromDrop' || t === 'insertFromYank') {
      const data = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || e.data || '';
      if (t === 'insertReplacementText' && e.getTargetRanges) { const tr = e.getTargetRanges()[0]; if (tr) { const r = document.createRange(); r.setStart(tr.startContainer, tr.startOffset); r.setEnd(tr.endContainer, tr.endOffset); s.removeAllRanges(); s.addRange(r); } }
      if (data) {
        const lines = data.replace(/\r\n?/g, '\n').split('\n');
        lines.forEach((ln, i) => { if (i > 0) document.execCommand('insertParagraph'); if (ln) trackedInsert(ln); });
        handled = true;
      }
    } else if (t.startsWith('delete')) {
      const map = { deleteContentBackward: ['backward', 'character'], deleteContentForward: ['forward', 'character'], deleteWordBackward: ['backward', 'word'], deleteWordForward: ['forward', 'word'], deleteSoftLineBackward: ['backward', 'lineboundary'], deleteSoftLineForward: ['forward', 'lineboundary'], deleteHardLineBackward: ['backward', 'paragraphboundary'], deleteHardLineForward: ['forward', 'paragraphboundary'] };
      const m = map[t];
      if (m) handled = trackedDelete(m[0], m[1]);
      else if (t === 'deleteByCut' || t === 'deleteByDrag' || t === 'deleteContent') { const r = s.getRangeAt(0); if (!r.collapsed) { const res = markDeleted(r); if (res.last) caretAfter(res.last); handled = true; } }
    }
    if (handled) { e.preventDefault(); onChange && onChange(); }
  }

  /* IME / Android keyboards: diff the text node after composition */
  let comp = null;
  function onCompStart() {
    if (!tracking) return;
    const s = sel(); if (!s.rangeCount) return;
    const n = s.anchorNode;
    comp = n && n.nodeType === 3 ? { node: n, before: n.data, own: !!ownIns(n), inDel: !!up(n, 'del.tc') } : { node: null };
  }
  function onCompEnd(e) {
    if (!tracking || !comp) return;
    const c = comp; comp = null;
    setTimeout(() => {
      const s = sel();
      if (c.node && c.node.isConnected && !c.own) {
        const a = c.before, b = c.node.data;
        if (a === b) return;
        let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
        let q = 0; while (q < a.length - p && q < b.length - p && a[a.length - 1 - q] === b[b.length - 1 - q]) q++;
        const deleted = a.slice(p, a.length - q), inserted = b.slice(p, b.length - q), tail = b.slice(b.length - q);
        const node = c.node;
        node.data = b.slice(0, p);
        let ref = node.nextSibling;
        const parent = node.parentNode;
        if (deleted && !c.inDel) { const d = mk('del'); d.textContent = deleted; parent.insertBefore(d, ref); }
        let insText = null;
        if (inserted) { const i = mk('ins'); insText = document.createTextNode(inserted); i.appendChild(insText); parent.insertBefore(i, ref); }
        const tn = document.createTextNode(tail); parent.insertBefore(tn, ref);
        const r = document.createRange();
        if (insText) r.setStart(insText, insText.length); else r.setStart(tn, 0);
        r.collapse(true); s.removeAllRanges(); s.addRange(r);
        onChange && onChange();
      } else if (!c.node && e.data && s.rangeCount) {
        const r0 = s.getRangeAt(0); const n = r0.startContainer;
        if (n.nodeType === 3 && !ownIns(n) && r0.startOffset >= e.data.length) {
          const rr = document.createRange(); rr.setStart(n, r0.startOffset - e.data.length); rr.setEnd(n, r0.startOffset);
          const i = mk('ins'); rr.surroundContents(i); caretAfter(i);
          onChange && onChange();
        }
      }
    }, 0);
  }

  /* ---------- reviewing ---------- */
  function changes() { return [...ed.querySelectorAll('ins.tc, del.tc')].filter(el => !el.parentNode.closest || !el.parentNode.closest('ins.tc,del.tc')); }
  function accept(el) { if (el.tagName === 'INS') unwrap(el); else el.remove(); }
  function reject(el) { if (el.tagName === 'INS') el.remove(); else unwrap(el); }
  function inSelection() {
    const s = sel(); if (!s.rangeCount) return [];
    const r = s.getRangeAt(0);
    if (r.collapsed) { const h = up(r.startContainer, 'ins.tc,del.tc'); return h ? [h] : []; }
    return changes().filter(el => r.intersectsNode(el));
  }
  function nextChange(dir) {
    const list = changes(); if (!list.length) return null;
    const s = sel();
    if (!s.rangeCount || !inEditor(s.getRangeAt(0))) return dir > 0 ? list[0] : list[list.length - 1];
    const r = s.getRangeAt(0);
    const cur = up(r.startContainer, 'ins.tc,del.tc');
    if (dir > 0) return list.find(el => el !== cur && r.comparePoint(el, 0) > 0) || list[0];
    const rev = list.slice().reverse();
    return rev.find(el => el !== cur && r.comparePoint(el, 0) < 0 && !el.contains(r.startContainer)) || list[list.length - 1];
  }
  function selectNode(el) {
    const r = document.createRange(); r.selectNodeContents(el);
    const s = sel(); s.removeAllRanges(); s.addRange(r);
    (el.nodeType === 1 ? el : el.parentNode).scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ---------- comments ---------- */
  function wrapComment(range, cid) {
    const { nodes } = isolate(range);
    let first = null;
    for (const n of nodes) {
      if (!n.parentNode || n.nodeName === 'BR') continue;
      const prev = n.previousSibling;
      let sp;
      if (prev && prev.nodeType === 1 && prev.classList.contains('cmt') && prev.getAttribute('data-cid') === cid) { sp = prev; sp.appendChild(n); }
      else { sp = document.createElement('span'); sp.className = 'cmt'; sp.setAttribute('data-cid', cid); n.parentNode.insertBefore(sp, n); sp.appendChild(n); }
      if (!first) first = sp;
    }
    return first;
  }
  function removeComment(cid) { ed.querySelectorAll(`span.cmt[data-cid="${cid}"]`).forEach(unwrap); }
  function commentAt() {
    const s = sel(); if (!s.rangeCount) return null;
    const h = up(s.getRangeAt(0).startContainer, 'span.cmt');
    return h ? h.getAttribute('data-cid') : null;
  }
  function commentIds() { const seen = []; ed.querySelectorAll('span.cmt[data-cid]').forEach(e => { const c = e.getAttribute('data-cid'); if (!seen.includes(c)) seen.push(c); }); return seen; }

  return { init, setTracking, isTracking, markDeleted, trackedInsert, changes, accept, reject, inSelection, nextChange, selectNode, wrapComment, removeComment, commentAt, commentIds, isolate, unwrap };
})();
