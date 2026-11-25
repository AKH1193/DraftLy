/* DraftLy: click a paragraph number (or bullet) to select it, as in Word, then move the list left or right,
   change its level, or restart / continue the numbering. Drag the number sideways to move the whole list. */
const NumSel = (() => {
  let cur = null, bar = null, layer = null;
  const isMarkerHit = (li, e) => {
    if (!li || li.hasAttribute('data-cont') || getComputedStyle(li).display !== 'list-item') return false;
    const r = li.getBoundingClientRect();
    return e.clientX < r.left + 2 && e.clientX > r.left - 60 && e.clientY >= r.top && e.clientY <= r.top + Math.min(r.height, 40);
  };
  const levelItems = li => [...li.parentElement.children].filter(x => x.tagName === 'LI' && !x.hasAttribute('data-cont'));
  function clear() { if (layer) layer.innerHTML = ''; if (bar) { bar.remove(); bar = null; } cur = null; document.removeEventListener('keydown', onKey, true); }
  function draw() {
    if (!cur || !cur.li.isConnected) return clear();
    if (!layer) { layer = h('div', { id: 'numSelLayer' }); $('#pages').append(layer); }
    layer.innerHTML = '';
    const pr = $('#pages').getBoundingClientRect(), z = ui.view === 'print' ? ui.zoom : 1;
    levelItems(cur.li).forEach(li => {
      const r = li.getBoundingClientRect(), fs = parseFloat(getComputedStyle(li).fontSize) || 15;
      layer.append(h('div', { class: 'num-hl' + (li === cur.li ? ' main' : ''), style: { left: ((r.left - pr.left) / z - 30) + 'px', top: ((r.top - pr.top) / z) + 'px', width: '28px', height: (fs * 1.35) + 'px' } }));
    });
    const r = cur.li.getBoundingClientRect();
    if (!bar) {
      const b = (ic, t, fn) => { const x = h('button', { type: 'button', title: t, html: icon(ic) }); x.addEventListener('mousedown', e => e.preventDefault()); x.addEventListener('click', fn); return x; };
      bar = h('div', { class: 'num-bar' },
        b('ChevronsLeft', 'Move the list left (←)', () => move(-12)),
        b('ChevronsRight', 'Move the list right (→)', () => move(12)),
        h('span', { class: 'sep' }),
        b('IndentDecrease', 'Promote this point (Shift+Tab)', () => level(-1)),
        b('IndentIncrease', 'Demote this point (Tab)', () => level(1)),
        h('span', { class: 'sep' }),
        h('button', { type: 'button', class: 'txt', onmousedown: e => e.preventDefault(), onclick: restart }, 'Restart at 1'),
        h('button', { type: 'button', class: 'txt', onmousedown: e => e.preventDefault(), onclick: cont }, 'Continue'),
        h('button', { type: 'button', class: 'txt', onmousedown: e => e.preventDefault(), onclick: setValue }, 'Set value…'));
      document.body.append(bar);
    }
    bar.style.left = Math.max(8, Math.min(innerWidth - 420, r.left - 40)) + 'px';
    bar.style.top = Math.max(60, r.top - 46) + 'px';
  }
  function select(li) { cur = { li }; draw(); document.addEventListener('keydown', onKey, true); }
  /* move the whole list (all its numbers and text) sideways, like dragging the ruler in Word */
  function move(px) {
    const list = cur.li.parentElement;
    mutate(() => {
      const v = Math.max(-48, Math.min(480, (parseFloat(list.style.marginLeft) || 0) + px));
      if (v) list.style.marginLeft = v + 'px'; else list.style.removeProperty('margin-left');
      if (!list.getAttribute('style')) list.removeAttribute('style');
    });
    requestAnimationFrame(draw);
  }
  function level(dir) {
    const li = cur.li;
    const r = document.createRange(); r.selectNodeContents(li); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); lastRange = r.cloneRange();
    exec(dir > 0 ? 'indent' : 'outdent');
    const n = getSelection().anchorNode, nli = n && (n.nodeType === 1 ? n : n.parentElement).closest('li');
    if (nli) { cur.li = nli; requestAnimationFrame(draw); } else clear();
  }
  function restart() {
    const li = cur.li, list = li.parentElement;
    mutate(() => {
      if (li === list.firstElementChild) { list.removeAttribute('start'); return; }
      const nl = list.cloneNode(false); nl.removeAttribute('start');
      let n = li; const move = []; while (n) { move.push(n); n = n.nextElementSibling; }
      move.forEach(x => nl.append(x)); list.after(nl);
    });
    requestAnimationFrame(draw);
  }
  function cont() {
    const li = cur.li, list = li.parentElement;
    let prev = list.previousElementSibling;
    while (prev && !/^(OL|UL)$/.test(prev.tagName) && !prev.textContent.trim()) prev = prev.previousElementSibling;
    if (!prev || prev.tagName !== list.tagName) { // number on from the last list of the same kind above
      let p = list.previousElementSibling, count = 0;
      while (p) { if (p.tagName === list.tagName) { count = (parseInt(p.getAttribute('start')) || 1) + [...p.children].filter(x => x.tagName === 'LI' && !x.hasAttribute('data-cont')).length; break; } p = p.previousElementSibling; }
      if (!count) return toast('There is no earlier list to continue from');
      mutate(() => list.setAttribute('start', count));
    } else mutate(() => { [...list.children].forEach(x => prev.append(x)); list.remove(); });
    requestAnimationFrame(draw);
  }
  async function setValue() {
    const li = cur.li, list = li.parentElement;
    const items = levelItems(li), idx = items.indexOf(li);
    const curVal = (parseInt(list.getAttribute('start')) || 1) + idx;
    const v = await ask('Set Numbering Value', 'Set this point to', String(curVal));
    const n = parseInt(v); if (!n || n < 0) return;
    mutate(() => list.setAttribute('start', n - idx));
    requestAnimationFrame(draw);
  }
  function onKey(e) {
    if (!cur) return;
    if (e.key === 'Escape') { clear(); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); move(e.key === 'ArrowLeft' ? -12 : 12); return; }
    if (e.key === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); level(e.shiftKey ? -1 : 1); return; }
    if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Delete' || e.key.startsWith('Arrow')) clear();
  }
  // pick up clicks and taps on numbers; dragging the number sideways moves the list
  editor.addEventListener('pointerdown', e => {
    const li = e.target.closest && e.target.closest('li');
    if (!isMarkerHit(li, e)) { if (cur && !(bar && bar.contains(e.target))) clear(); return; }
    e.preventDefault();
    select(li);
    const x0 = e.clientX, list = li.parentElement, m0 = parseFloat(list.style.marginLeft) || 0, z = ui.view === 'print' ? ui.zoom : 1;
    let moved = false;
    const mv = ev => {
      const dx = (ev.clientX - x0) / z;
      if (!moved && Math.abs(dx) < 4) return;
      moved = true;
      const v = Math.round(Math.max(-48, Math.min(480, m0 + dx)) / 6) * 6;
      list.style.marginLeft = v ? v + 'px' : ''; draw();
    };
    const up = () => {
      document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up);
      if (moved) { const v = list.style.marginLeft; list.style.marginLeft = m0 ? m0 + 'px' : ''; mutate(() => { list.style.marginLeft = v; if (!list.getAttribute('style')) list.removeAttribute('style'); }); requestAnimationFrame(draw); }
    };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
  }, true);
  editor.addEventListener('mousemove', e => { const li = e.target.closest && e.target.closest('li'); editor.classList.toggle('over-num', isMarkerHit(li, e)); });
  $('#canvas').addEventListener('scroll', () => { if (cur) draw(); });
  return { clear, redraw: () => cur && draw(), get active() { return !!cur; } };
})();
