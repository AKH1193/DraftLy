/* DraftLy ribbon: command registry, tab definitions, rendering and state */
const CMD = {
  undo: () => History.undo(), redo: () => History.redo(),
  bold: () => exec('bold'), italic: () => exec('italic'), underline: () => exec('underline'), strike: () => exec('strikeThrough'),
  subscript: () => exec('subscript'), superscript: () => exec('superscript'),
  left: () => align('left'), center: () => align('center'), right: () => align('right'), justify: () => align('justify'),
  bullets: () => setList(false), numbering: () => setList(true),
  indent: () => indentBlocks(1), outdent: () => indentBlocks(-1),
  grow: () => { const c = currentSize(); setFontSize(SIZES.find(s => s > c) || c + 10); },
  shrink: () => { const c = currentSize(); setFontSize([...SIZES].reverse().find(s => s < c) || Math.max(1, c - 1)); },
  clear: () => clearFormatting(),
  cut: () => { restoreRange(); document.execCommand('cut') || toast(`Use ${IS_MAC ? '⌘' : 'Ctrl'}+X to cut`); afterChange(); },
  copy: () => { restoreRange(); document.execCommand('copy') || toast(`Use ${IS_MAC ? '⌘' : 'Ctrl'}+C to copy`); },
  paste: async (plain) => {
    restoreRange();
    try {
      if (!plain && navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const it of items) {
          if (it.types.includes('text/html')) { const html = await (await it.getType('text/html')).text(); restoreRange(); return exec('insertHTML', sanitizeHtml(html, true)); }
          const imgT = it.types.find(t => t.startsWith('image/')); if (imgT) return insertImageFile(new File([await it.getType(imgT)], 'pasted.png', { type: imgT }));
        }
      }
      const t = await navigator.clipboard.readText(); restoreRange();
      if (Review.isTracking()) mutate(() => Review.trackedInsert(t)); else exec('insertText', t);
    } catch (e) { toast(`Use ${IS_MAC ? '⌘' : 'Ctrl'}+V to paste`); }
  },
  painter: () => { if (painter) { painter = null; updateRibbonState(); } else pickPainter(); },
  link: () => linkDialog(), pageBreak: () => insertHTML('<hr class="pb"><p><br></p>'),
  hr: () => insertHTML('<hr><p><br></p>'),
  picture: () => $('#imgOpen').click(),
  comment: () => addComment(),
  footnote: () => insertFootnote(),
  toc: () => updateTOC(true), tocUpdate: () => { if (!$('.toc', editor)) return toast('There is no table of contents. Insert one first.'); updateTOC(); toast('Table of contents updated'); },
  tocRemove: () => mutate(() => $$('.toc', editor).forEach(t => t.remove())),
  track: () => toggleTrack(),
  acceptCur: () => { const els = Review.inSelection(); if (!els.length) { const n = Review.nextChange(1); if (n) Review.selectNode(n); return; } mutate(() => els.forEach(Review.accept)); const n = Review.nextChange(1); n && Review.selectNode(n); },
  rejectCur: () => { const els = Review.inSelection(); if (!els.length) { const n = Review.nextChange(1); if (n) Review.selectNode(n); return; } mutate(() => els.forEach(Review.reject)); const n = Review.nextChange(1); n && Review.selectNode(n); },
  acceptAll: () => mutate(() => Review.changes().forEach(Review.accept)),
  rejectAll: () => mutate(() => Review.changes().forEach(Review.reject)),
  nextChange: () => { const n = Review.nextChange(1); n ? Review.selectNode(n) : toast('No revisions in this document'); },
  prevChange: () => { const n = Review.nextChange(-1); n ? Review.selectNode(n) : toast('No revisions in this document'); },
  nextComment: () => stepComment(1), prevComment: () => stepComment(-1),
  deleteComment: () => { const c = Review.commentAt(); c ? deleteComment(c) : toast('Place the cursor inside a comment'); },
  deleteAllComments: () => mutate(() => { Review.commentIds().forEach(Review.removeComment); doc.comments = {}; }),
  showComments: () => { ui.showComments = !ui.showComments; document.body.classList.toggle('hide-comments', !ui.showComments); showPane('commentPane', ui.showComments); },
  reviewPane: () => showPane('changesPane'),
  navPane: () => showPane('navPane'),
  findPane: () => { showPane('findPane', true); const r = getRange(); const t = r && !r.collapsed ? r.toString() : ''; if (t && t.length < 80) $('#findInput').value = t; $('#findInput').focus(); $('#findInput').select(); runFind(); },
  replacePane: () => { CMD.findPane(); setTimeout(() => $('#replaceInput').focus(), 30); },
  selectAll: () => { editor.focus(); document.execCommand('selectAll'); },
  spelling: () => { editor.spellcheck = !editor.spellcheck; editor.blur(); editor.focus(); toast(editor.spellcheck ? 'Spelling check on' : 'Spelling check off'); updateRibbonState(); },
  wordCount: () => wordCountDialog(),
  restrict: () => { ui.readonly = !ui.readonly; editor.contentEditable = ui.readonly ? 'false' : 'true'; editor.classList.toggle('readonly', ui.readonly); toast(ui.readonly ? 'Editing restricted: the document is read-only' : 'Editing enabled'); updateRibbonState(); },
  userName: () => ask('User Name', 'Your name (used for comments and tracked changes)', prefs.author).then(v => { if (v) { prefs.author = v.trim(); savePrefs(); toast('Name set to ' + prefs.author); } }),
  readMode: () => setView('read'), printLayout: () => setView('print'), webLayout: () => setView('web'), focus: () => setView('focus'),
  ruler: () => { ui.ruler = !ui.ruler; updateRuler(); updateRibbonState(); },
  gridlines: () => { document.body.classList.toggle('nogrid'); updateRibbonState(); },
  marks: () => { document.body.classList.toggle('showmarks'); updateRibbonState(); },
  zoomIn: () => setZoom(Math.round((ui.zoom + 0.1) * 10) / 10), zoomOut: () => setZoom(Math.round((ui.zoom - 0.1) * 10) / 10),
  zoom100: () => setZoom(1), zoomPage: () => setZoom('page'), zoomWidth: () => setZoom('width'), zoomDialog: () => zoomDialog(),
  toggleDark: () => { prefs.dark = !prefs.dark; savePrefs(); document.body.classList.toggle('dark', prefs.dark); updateRibbonState(); },
  fullscreen: () => { if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); else toast('Full screen is not available here'); },
  dictate: () => toggleDictate(),
  paragraph: () => paragraphDialog(),
  symbol: () => symbolDialog(), date: () => dateDialog(), headerFooter: () => headerFooterDialog('header'), footerEdit: () => headerFooterDialog('footer'),
  signature: () => insertHTML('<p><br></p><p>____________________________</p><p><b>[Name]</b></p><p>[Designation]</p><p><br></p>'),
  setNumber: async () => { const r = getRange(); const ol = r && closestOf(r.startContainer, 'ol'); if (!ol) return toast('Place the cursor in a numbered list'); const v = await ask('Set Numbering Value', 'Start at', ol.getAttribute('start') || '1', 'number'); if (v) mutate(() => ol.setAttribute('start', Math.max(0, parseInt(v) || 1))); },
  restartNumber: () => { const r = getRange(); const ol = r && closestOf(r.startContainer, 'ol'); if (ol) mutate(() => ol.removeAttribute('start')); }
};
function stepComment(d) {
  const ids = Review.commentIds(); if (!ids.length) return toast('No comments in this document');
  const cur = Review.commentAt(); let i = ids.indexOf(cur); i = i < 0 ? (d > 0 ? 0 : ids.length - 1) : (i + d + ids.length) % ids.length;
  const sp = $(`span.cmt[data-cid="${ids[i]}"]`, editor); if (sp) Review.selectNode(sp);
  showPane('commentPane', true);
}

/* ---------- ribbon definition ---------- */
const big = (icon, label, cmd, o = {}) => Object.assign({ t: 'big', icon, label, cmd }, o);
const btn = (icon, title, cmd, o = {}) => Object.assign({ t: 'btn', icon, title, cmd }, o);
const sbtn = (icon, label, cmd, o = {}) => Object.assign({ t: 'btn', icon, title: label, label, cmd }, o);
const row = (...items) => ({ t: 'row', items });
const col = (...items) => ({ t: 'col', items });
const isOn = c => () => { try { return document.queryCommandState(c); } catch (e) { return false; } };
const blockAlign = a => () => { const b = selectedBlocks()[0]; if (!b) return false; const v = getComputedStyle(b).textAlign; return v === a || (a === 'left' && (v === 'start' || v === '-webkit-left')); };
const inListTag = t => () => { const r = getRange(); const l = r && closestOf(r.startContainer, 'ul,ol'); return !!l && l.tagName === t; };

const MENUS = {
  paste: a => showMenu(a, [{ label: 'Paste', icon: 'ClipboardPaste', fn: () => CMD.paste() }, { label: 'Paste as plain text', icon: 'Type', fn: () => CMD.paste(true) }]),
  changeCase: a => showMenu(a, [{ label: 'Sentence case.', fn: () => changeCase('sentence') }, { label: 'lowercase', fn: () => changeCase('lower') }, { label: 'UPPERCASE', fn: () => changeCase('upper') }, { label: 'Capitalize Each Word', fn: () => changeCase('title') }, { label: 'tOGGLE cASE', fn: () => changeCase('toggle') }]),
  foreColor: a => colorMenu(a, THEME_COLORS, c => { lastFore = c || '#000000'; exec('foreColor', lastFore); updateSwatches(); }, 'Automatic'),
  hilite: a => colorMenu(a, HIGHLIGHTS, c => { lastHilite = c; exec('hiliteColor', c || 'transparent'); if (!c) mutate(() => { const r = getRange(); r && Review.isolate(r).nodes.forEach(n => { const p = n.parentElement; if (p && p.style && p.style.backgroundColor === 'transparent') { p.style.removeProperty('background-color'); if (!p.getAttribute('style')) p.removeAttribute('style'); } }); }); updateSwatches(); }, 'No Colour'),
  bullets: a => showMenu(a, [{ header: 'Bullet Library' }, { label: '●  Filled circle', fn: () => setList(false, 'disc') }, { label: '○  Hollow circle', fn: () => setList(false, 'circle') }, { label: '■  Square', fn: () => setList(false, 'square') }, { label: 'None', fn: () => setList(false, 'none') }]),
  numbering: a => showMenu(a, [{ header: 'Numbering Library' }, { label: '1.  2.  3.', fn: () => setList(true, 'default') }, { label: '1)  2)  3)', fn: () => setList(true, 'decimal-paren') }, { label: '(1)  (2)  (3)', fn: () => setList(true, 'paren-decimal') }, { label: 'a.  b.  c.', fn: () => setList(true, 'lower-alpha') }, { label: '(a)  (b)  (c)', fn: () => setList(true, 'paren-lower-alpha') }, { label: 'A.  B.  C.', fn: () => setList(true, 'upper-alpha') }, { label: 'i.  ii.  iii.', fn: () => setList(true, 'lower-roman') }, { label: '(i)  (ii)  (iii)', fn: () => setList(true, 'paren-lower-roman') }, { label: 'I.  II.  III.', fn: () => setList(true, 'upper-roman') }, { sep: true }, { label: 'Set Numbering Value…', fn: CMD.setNumber }, { label: 'Restart at 1', fn: CMD.restartNumber }]),
  multilevel: a => showMenu(a, [{ label: 'Increase list level', icon: 'IndentIncrease', fn: () => exec('indent') }, { label: 'Decrease list level', icon: 'IndentDecrease', fn: () => exec('outdent') }, { sep: true }, { label: 'Set Numbering Value…', fn: CMD.setNumber }]),
  lineSpacing: a => showMenu(a, [...['1.0', '1.15', '1.5', '2.0', '2.5', '3.0'].map(v => ({ label: v, fn: () => lineSpacing(v) })), { sep: true }, { label: 'Add space before paragraph', fn: () => spaceBA('before', 12) }, { label: 'Remove space before', fn: () => spaceBA('before', 0) }, { label: 'Add space after paragraph', fn: () => spaceBA('after', 12) }, { label: 'Remove space after', fn: () => spaceBA('after', 0) }, { sep: true }, { label: 'Line Spacing Options…', fn: paragraphDialog }]),
  shading: a => colorMenu(a, THEME_COLORS, c => blockStyle(b => { b.style.backgroundColor = c || ''; if (!b.getAttribute('style')) b.removeAttribute('style'); }), 'No Colour'),
  table: a => tablePicker(a),
  pageNumber: a => pageNumberMenu(a),
  margins: a => showMenu(a, [
    { label: 'Normal  (1" all sides)', fn: () => setPage({ margins: { top: 1, bottom: 1, left: 1, right: 1 } }) },
    { label: 'Narrow  (0.5")', fn: () => setPage({ margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 } }) },
    { label: 'Moderate  (1" / 0.75")', fn: () => setPage({ margins: { top: 1, bottom: 1, left: 0.75, right: 0.75 } }) },
    { label: 'Wide  (1" / 2")', fn: () => setPage({ margins: { top: 1, bottom: 1, left: 2, right: 2 } }) },
    { label: 'Court filing  (1.5" left, 1" others)', fn: () => setPage({ margins: { top: 1, bottom: 1, left: 1.5, right: 1 } }) },
    { label: 'Letterhead  (1.5" top)', fn: () => setPage({ margins: { top: 1.5, bottom: 1, left: 1, right: 1 } }) },
    { sep: true }, { label: 'Custom Margins…', fn: marginsDialog }]),
  orientation: a => showMenu(a, [{ label: 'Portrait', icon: 'RectangleVertical', checked: doc.settings.orientation !== 'landscape', fn: () => setPage({ orientation: 'portrait' }) }, { label: 'Landscape', icon: 'RectangleHorizontal', fn: () => setPage({ orientation: 'landscape' }) }]),
  size: a => showMenu(a, Object.keys(PAGE_PX).map(k => ({ label: k + { A4: '  (21 × 29.7 cm)', Letter: '  (8.5" × 11")', Legal: '  (8.5" × 14")', A5: '  (14.8 × 21 cm)', Executive: '  (7.25" × 10.5")' }[k], checked: doc.settings.pageSize === k, fn: () => setPage({ pageSize: k }) }))),
  columns: a => showMenu(a, [{ label: 'One', fn: () => columnsSet(1) }, { label: 'Two', fn: () => columnsSet(2) }, { label: 'Three', fn: () => columnsSet(3) }, { sep: true }, { header: 'Applies to the selected paragraphs' }]),
  breaks: a => showMenu(a, [{ label: 'Page Break', icon: 'SeparatorHorizontal', fn: CMD.pageBreak }, { label: 'Horizontal Line', icon: 'Minus', fn: CMD.hr }]),
  watermark: a => showMenu(a, [...['DRAFT', 'CONFIDENTIAL', 'DO NOT COPY', 'SAMPLE', 'URGENT', 'COPY', 'ORIGINAL', 'WITHOUT PREJUDICE'].map(w => ({ label: w, checked: doc.settings.watermark === w, fn: () => setPage({ watermark: w }) })), { sep: true }, { label: 'Custom Watermark…', fn: () => ask('Watermark', 'Text', doc.settings.watermark || '').then(v => v != null && setPage({ watermark: v.trim() })) }, { label: 'Remove Watermark', icon: 'X', fn: () => setPage({ watermark: '' }) }]),
  pageColor: a => colorMenu(a, THEME_COLORS, c => setPage({ pageColor: c || '' }), 'No Colour'),
  spacing: a => { const set = (lh, af) => { mutate(() => { doc.settings.theme = Object.assign({}, doc.settings.theme, { lineHeight: lh, after: af }); }); applyDocStyles(); schedulePaginate(); }; showMenu(a, [{ label: 'No Paragraph Space', fn: () => set(1, 0) }, { label: 'Compact', fn: () => set(1, 4) }, { label: 'Tight', fn: () => set(1.15, 6) }, { label: 'Open', fn: () => set(1.15, 10) }, { label: 'Relaxed', fn: () => set(1.5, 6) }, { label: 'Double', fn: () => set(2, 8) }]); },
  themeFont: a => showMenu(a, FONTS.map(f => ({ label: f, style: `font-family:${fontStack(f)}`, checked: doc.settings.theme.font === f, fn: () => { mutate(() => { doc.settings.theme = Object.assign({}, doc.settings.theme, { font: f, headingFont: doc.settings.theme.headingFont === doc.settings.theme.font ? f : doc.settings.theme.headingFont }); }); applyDocStyles(); schedulePaginate(); } }))),
  addText: a => showMenu(a, [{ label: 'Do Not Show in Table of Contents', fn: () => applyStyle('Normal') }, { label: 'Level 1', fn: () => applyStyle('Heading 1') }, { label: 'Level 2', fn: () => applyStyle('Heading 2') }, { label: 'Level 3', fn: () => applyStyle('Heading 3') }]),
  tocMenu: a => showMenu(a, [{ label: 'Insert Table of Contents', icon: 'TableOfContents', fn: CMD.toc }, { label: 'Update Table', icon: 'History', fn: CMD.tocUpdate }, { label: 'Remove Table of Contents', icon: 'X', fn: CMD.tocRemove }]),
  markup: a => showMenu(a, [['all', 'All Markup'], ['simple', 'Simple Markup'], ['none', 'No Markup'], ['original', 'Original']].map(([k, l]) => ({ label: l, checked: ui.markup === k, fn: () => setMarkup(k) }))),
  accept: a => showMenu(a, [{ label: 'Accept and Move to Next', icon: 'Check', fn: CMD.acceptCur }, { label: 'Accept All Changes', icon: 'CheckCheck', fn: CMD.acceptAll }, { label: 'Accept All and Stop Tracking', fn: () => { CMD.acceptAll(); toggleTrack(false); } }]),
  reject: a => showMenu(a, [{ label: 'Reject and Move to Next', icon: 'X', fn: CMD.rejectCur }, { label: 'Reject All Changes', icon: 'Ban', fn: CMD.rejectAll }, { label: 'Reject All and Stop Tracking', fn: () => { CMD.rejectAll(); toggleTrack(false); } }]),
  deleteComment: a => showMenu(a, [{ label: 'Delete', fn: CMD.deleteComment }, { label: 'Delete All Comments in Document', fn: CMD.deleteAllComments }]),
  language: a => showMenu(a, [['en-IN', 'English (India)'], ['en-GB', 'English (UK)'], ['en-US', 'English (US)'], ['hi-IN', 'Hindi'], ['kn-IN', 'Kannada']].map(([c, l]) => ({ label: l, checked: (editor.lang || 'en-IN') === c, fn: () => { editor.lang = c; prefs.lang = c; savePrefs(); $('#stLang').textContent = l; editor.blur(); editor.focus(); } }))),
  zoomMenu: a => showMenu(a, [{ label: '100%', fn: CMD.zoom100 }, { label: 'One Page', fn: CMD.zoomPage }, { label: 'Page Width', fn: CMD.zoomWidth }, { sep: true }, { label: 'Zoom…', fn: zoomDialog }]),
  tblDelete: a => showMenu(a, [{ label: 'Delete Rows', fn: () => tableOp('delRow') }, { label: 'Delete Columns', fn: () => tableOp('delCol') }, { label: 'Delete Table', fn: () => tableOp('delTable') }]),
  tblShade: a => colorMenu(a, THEME_COLORS, c => tableOp('shade', c), 'No Colour'),
  tblBorders: a => showMenu(a, [{ label: 'All Borders', icon: 'Table', fn: () => setBorders('all') }, { label: 'Outside Borders', icon: 'Square', fn: () => setBorders('outside') }, { label: 'Inside Borders', icon: 'Grid3X3', fn: () => setBorders('inside') }, { label: 'No Border', icon: 'SquareDashed', fn: () => setBorders('none') }]),
  penColor: a => colorMenu(a, THEME_COLORS, c => setPen('--bc', c), 'Automatic (black)'),
  penWeight: a => showMenu(a, [['0.5pt', '½ pt'], ['0.75pt', '¾ pt'], ['1pt', '1 pt'], ['1.5pt', '1½ pt'], ['2.25pt', '2¼ pt'], ['3pt', '3 pt']].map(([v, l]) => ({ label: l, fn: () => setPen('--bw', v === '0.75pt' ? '' : v) }))),
  tblSelect: a => showMenu(a, [{ label: 'Select Cell', fn: () => selectTablePart('cell') }, { label: 'Select Row', fn: () => selectTablePart('row') }, { label: 'Select Table', fn: () => selectTablePart('table') }]),
  tblPosition: a => showMenu(a, [{ header: 'Table position' }, { label: 'Left', fn: () => tableAlign('left') }, { label: 'Centre', fn: () => tableAlign('center') }, { label: 'Right', fn: () => tableAlign('right') }, { header: 'Table width' }, ...[100, 90, 75, 60, 50].map(p => ({ label: p + '% of page width', fn: () => tableWidthPct(p) }))]),
  tblAutofit: a => showMenu(a, [{ label: 'AutoFit Contents', fn: () => autofit('contents') }, { label: 'AutoFit Window', fn: () => autofit('window') }, { label: 'Fixed Column Width', fn: () => autofit('fixed') }]),
  tblMargins: a => showMenu(a, [{ label: 'Narrow', fn: () => cellMargins('narrow') }, { label: 'Normal', fn: () => cellMargins('normal') }, { label: 'Wide', fn: () => cellMargins('wide') }]),
  tblSort: a => showMenu(a, [{ label: 'Sort by this column, A to Z / 1 to 9', icon: 'ArrowDown', fn: () => sortTable(1) }, { label: 'Sort by this column, Z to A / 9 to 1', icon: 'ArrowUp', fn: () => sortTable(-1) }]),
  tblAlign: a => showMenu(a, [{ label: 'Top', fn: () => tableOp('valign', 'top') }, { label: 'Centre', fn: () => tableOp('valign', 'middle') }, { label: 'Bottom', fn: () => tableOp('valign', 'bottom') }]),
  imgSize: a => showMenu(a, [25, 50, 75, 100].map(p => ({ label: p + '% of text width', fn: () => imageOp('size', p / 100) })).concat([{ sep: true }, { label: 'Original size', fn: () => imageOp('reset') }])),
  imgWrap: a => showMenu(a, [{ label: 'In Line with Text', fn: () => imageOp('wrap', null) }, { label: 'Square, left', fn: () => imageOp('wrap', 'fl') }, { label: 'Square, right', fn: () => imageOp('wrap', 'fr') }, { label: 'Centred on its own line', fn: () => imageOp('wrap', 'ctr') }])
};

const fontInput = () => {
  const i = h('input', { id: 'fontName', class: 'rin', list: 'fontList', title: 'Font', spellcheck: 'false', autocomplete: 'off' });
  const dl = h('datalist', { id: 'fontList' }, ...FONTS.map(f => h('option', { value: f })));
  const apply = () => { const v = i.value.trim(); if (v) { exec('fontName', v); } };
  i.addEventListener('change', apply);
  i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); apply(); editor.focus(); } });
  i.addEventListener('focus', () => i.select());
  return h('span', null, i, dl);
};
const sizeInput = () => {
  const i = h('input', { id: 'fontSize', class: 'rin', list: 'sizeList', title: 'Font size', inputmode: 'decimal', autocomplete: 'off' });
  const dl = h('datalist', { id: 'sizeList' }, ...SIZES.map(s => h('option', { value: s })));
  const apply = () => { const v = parseFloat(i.value); if (v) setFontSize(v); };
  i.addEventListener('change', apply);
  i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); apply(); editor.focus(); } });
  i.addEventListener('focus', () => i.select());
  return h('span', null, i, dl);
};
const stylesGallery = () => {
  const g = h('div', { class: 'stylesGallery', id: 'stylesGallery' });
  const t = doc ? doc.settings.theme : STYLE_SETS.Default;
  const prev = { 'Normal': '', 'No Spacing': '', 'Heading 1': `font-family:${fontStack(t.headingFont || t.font)};color:${t.headingColor};font-size:16px`, 'Heading 2': `font-family:${fontStack(t.headingFont || t.font)};color:${t.headingColor};font-size:14px`, 'Heading 3': `color:${t.headingColor};font-size:13px`, 'Heading 4': `color:${t.headingColor};font-style:italic`, 'Title': `font-family:${fontStack(t.headingFont || t.font)};font-size:19px`, 'Subtitle': 'color:#595959', 'Quote': 'font-style:italic;color:#404040', 'Intense Quote': `font-style:italic;color:${t.headingColor}` };
  STYLES.forEach(s => {
    const b = h('button', { type: 'button', 'data-style': s.name, style: `font-family:${fontStack(t.font)}` }, h('span', { style: prev[s.name] }, 'AaBbCc'), h('small', null, s.name));
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', () => applyStyle(s.name));
    g.append(b);
  });
  return g;
};
const styleSetGallery = () => {
  const g = h('div', { class: 'stylesGallery' });
  Object.entries(STYLE_SETS).forEach(([name, t]) => {
    const b = h('button', { type: 'button', 'data-set': name, style: `font-family:${fontStack(t.font)}` }, h('span', { style: `font-family:${fontStack(t.headingFont)};color:${t.headingColor};font-size:15px` }, 'Title'), h('small', null, name));
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', () => { mutate(() => { doc.settings.theme = Object.assign({}, t); }); prefs.styleSet = name; savePrefs(); applyDocStyles(); renderRibbon(); schedulePaginate(); });
    g.append(b);
  });
  return g;
};
const numField = (label, get, set, step = 1) => {
  const i = h('input', { type: 'number', class: 'rin numIn', step });
  i._sync = () => { if (document.activeElement !== i) i.value = get(); };
  i.addEventListener('change', () => set(i.value));
  return h('div', { class: 'lblrow' }, h('label', null, label), i);
};

const TABS = [
  { id: 'file', label: 'File' },
  { id: 'home', label: 'Home', groups: [
    { label: 'Clipboard', items: [big('ClipboardPaste', 'Paste', 'paste', { menu: 'paste' }), col(sbtn('Scissors', 'Cut', 'cut'), sbtn('Copy', 'Copy', 'copy'), sbtn('Paintbrush', 'Format Painter', 'painter', { state: () => !!painter }))] },
    { label: 'Font', items: [col(row({ t: 'el', el: fontInput }, { t: 'el', el: sizeInput }, btn('ALargeSmall', 'Grow Font', 'grow'), btn('CaseSensitive', 'Change Case', null, { menu: 'changeCase' }), btn('RemoveFormatting', 'Clear All Formatting', 'clear')),
      row(btn('Bold', 'Bold', 'bold', { state: isOn('bold') }), btn('Italic', 'Italic', 'italic', { state: isOn('italic') }), btn('Underline', 'Underline', 'underline', { state: isOn('underline') }), btn('Strikethrough', 'Strikethrough', 'strike', { state: isOn('strikeThrough') }), btn('Subscript', 'Subscript', 'subscript', { state: isOn('subscript') }), btn('Superscript', 'Superscript', 'superscript', { state: isOn('superscript') }),
        { t: 'split', icon: 'Highlighter', title: 'Text Highlight Colour', cmd: () => exec('hiliteColor', lastHilite), menu: 'hilite', swatch: () => lastHilite },
        { t: 'split', icon: 'Baseline', title: 'Font Colour', cmd: () => exec('foreColor', lastFore), menu: 'foreColor', swatch: () => lastFore }))] },
    { label: 'Paragraph', items: [col(row({ t: 'split', icon: 'List', title: 'Bullets', cmd: 'bullets', menu: 'bullets', state: inListTag('UL') }, { t: 'split', icon: 'ListOrdered', title: 'Numbering', cmd: 'numbering', menu: 'numbering', state: inListTag('OL') }, btn('ListTree', 'Multilevel List', null, { menu: 'multilevel' }), btn('IndentDecrease', 'Decrease Indent', 'outdent'), btn('IndentIncrease', 'Increase Indent', 'indent'), btn('Pilcrow', 'Show/Hide ¶', 'marks', { state: () => document.body.classList.contains('showmarks') })),
      row(btn('AlignLeft', 'Align Left', 'left', { state: blockAlign('left') }), btn('AlignCenter', 'Centre', 'center', { state: blockAlign('center') }), btn('AlignRight', 'Align Right', 'right', { state: blockAlign('right') }), btn('AlignJustify', 'Justify', 'justify', { state: blockAlign('justify') }), btn('MoveVertical', 'Line and Paragraph Spacing', null, { menu: 'lineSpacing' }), btn('PaintBucket', 'Shading', null, { menu: 'shading' }), btn('Settings', 'Paragraph Settings', 'paragraph')))] },
    { label: 'Styles', items: [{ t: 'el', el: stylesGallery }] },
    { label: 'Editing', items: [col(sbtn('Search', 'Find', 'findPane'), sbtn('Replace', 'Replace', 'replacePane'), sbtn('TextCursor', 'Select All', 'selectAll'))] },
    { label: 'Voice', items: [big('Languages', 'Dictate', 'dictate', { state: () => !!rec })] }
  ] },
  { id: 'insert', label: 'Insert', groups: [
    { label: 'Pages', items: [big('SeparatorHorizontal', 'Page Break', 'pageBreak')] },
    { label: 'Tables', items: [big('Table', 'Table', null, { menu: 'table' })] },
    { label: 'Illustrations', items: [big('Image', 'Pictures', 'picture'), big('Minus', 'Horizontal Line', 'hr')] },
    { label: 'Links', items: [big('Link', 'Link', 'link')] },
    { label: 'Comments', items: [big('MessageSquarePlus', 'Comment', 'comment')] },
    { label: 'Header & Footer', items: [big('PanelTop', 'Header', 'headerFooter'), big('PanelBottom', 'Footer', 'footerEdit'), big('Hash', 'Page Number', null, { menu: 'pageNumber' })] },
    { label: 'Text', items: [big('Calendar', 'Date & Time', 'date'), big('LetterText', 'Signature Line', 'signature')] },
    { label: 'Symbols', items: [big('Omega', 'Symbol', 'symbol')] }
  ] },
  { id: 'design', label: 'Design', groups: [
    { label: 'Document Formatting', items: [{ t: 'el', el: styleSetGallery }] },
    { label: 'Fonts & Spacing', items: [big('Type', 'Fonts', null, { menu: 'themeFont' }), big('MoveVertical', 'Paragraph Spacing', null, { menu: 'spacing' })] },
    { label: 'Page Background', items: [big('Stamp', 'Watermark', null, { menu: 'watermark' }), big('Droplet', 'Page Colour', null, { menu: 'pageColor' })] }
  ] },
  { id: 'layout', label: 'Layout', groups: [
    { label: 'Page Setup', items: [big('Square', 'Margins', null, { menu: 'margins' }), big('RectangleVertical', 'Orientation', null, { menu: 'orientation' }), big('File', 'Size', null, { menu: 'size' }), big('Columns2', 'Columns', null, { menu: 'columns' }), big('SeparatorHorizontal', 'Breaks', null, { menu: 'breaks' })] },
    { label: 'Indent', items: [col({ t: 'el', el: () => numField('Left', () => { const b = selectedBlocks()[0]; return b ? ((parseFloat(b.style.marginLeft) || 0) / 96).toFixed(2) : '0'; }, v => blockStyle(b => b.style.marginLeft = (parseFloat(v) || 0) * 96 + 'px'), 0.1) }, { t: 'el', el: () => numField('Right', () => { const b = selectedBlocks()[0]; return b ? ((parseFloat(b.style.marginRight) || 0) / 96).toFixed(2) : '0'; }, v => blockStyle(b => b.style.marginRight = (parseFloat(v) || 0) * 96 + 'px'), 0.1) })] },
    { label: 'Spacing (pt)', items: [col({ t: 'el', el: () => numField('Before', () => { const b = selectedBlocks()[0]; return b ? Math.round(parseFloat(getComputedStyle(b).marginTop) * 0.75) : 0; }, v => spaceBA('before', v)) }, { t: 'el', el: () => numField('After', () => { const b = selectedBlocks()[0]; return b ? Math.round(parseFloat(getComputedStyle(b).marginBottom) * 0.75) : 0; }, v => spaceBA('after', v)) })] },
    { label: 'Paragraph', items: [big('Settings', 'Paragraph Settings', 'paragraph')] }
  ] },
  { id: 'references', label: 'References', groups: [
    { label: 'Table of Contents', items: [big('TableOfContents', 'Table of Contents', null, { menu: 'tocMenu' }), col(sbtn('Heading1', 'Add Text', null, { menu: 'addText' }), sbtn('History', 'Update Table', 'tocUpdate'))] },
    { label: 'Footnotes', items: [big('Footprints', 'Insert Footnote', 'footnote')] }
  ] },
  { id: 'review', label: 'Review', groups: [
    { label: 'Proofing', items: [big('SpellCheck', 'Spelling', 'spelling', { state: () => editor.spellcheck }), big('WholeWord', 'Word Count', 'wordCount')] },
    { label: 'Language', items: [big('Globe', 'Language', null, { menu: 'language' })] },
    { label: 'Comments', items: [big('MessageSquarePlus', 'New Comment', 'comment'), col(sbtn('MessageSquareX', 'Delete', null, { menu: 'deleteComment' }), sbtn('ChevronLeft', 'Previous', 'prevComment'), sbtn('ChevronRight', 'Next', 'nextComment')), big('MessageSquare', 'Show Comments', 'showComments', { state: () => !$('#commentPane').classList.contains('hidden') })] },
    { label: 'Tracking', items: [big('FileDiff', 'Track Changes', 'track', { state: () => Review.isTracking() }), col(sbtn('Eye', 'Markup', null, { menu: 'markup' }), sbtn('PanelRight', 'Reviewing Pane', 'reviewPane', { state: () => !$('#changesPane').classList.contains('hidden') }), sbtn('User', 'Change User Name', 'userName'))] },
    { label: 'Changes', items: [big('CircleCheck', 'Accept', 'acceptCur', { menu: 'accept', splitBig: true }), big('CircleX', 'Reject', 'rejectCur', { menu: 'reject', splitBig: true }), col(sbtn('ArrowUp', 'Previous', 'prevChange'), sbtn('ArrowDown', 'Next', 'nextChange'))] },
    { label: 'Protect', items: [big('Lock', 'Restrict Editing', 'restrict', { state: () => ui.readonly })] }
  ] },
  { id: 'view', label: 'View', groups: [
    { label: 'Views', items: [big('BookOpen', 'Read Mode', 'readMode'), big('FileText', 'Print Layout', 'printLayout', { state: () => ui.view === 'print' && !document.body.classList.contains('focus') }), big('Globe', 'Web Layout', 'webLayout', { state: () => ui.view === 'web' && !document.body.classList.contains('read') })] },
    { label: 'Immersive', items: [big('Focus', 'Focus', 'focus'), big('Expand', 'Full Screen', 'fullscreen')] },
    { label: 'Show', items: [col(sbtn('Ruler', 'Ruler', 'ruler', { state: () => ui.ruler }), sbtn('Table', 'Gridlines', 'gridlines', { state: () => !document.body.classList.contains('nogrid') }), sbtn('ListTree', 'Navigation Pane', 'navPane', { state: () => !$('#navPane').classList.contains('hidden') }))] },
    { label: 'Zoom', items: [big('ZoomIn', 'Zoom', 'zoomDialog'), col(sbtn('Search', '100%', 'zoom100'), sbtn('File', 'One Page', 'zoomPage'), sbtn('Scaling', 'Page Width', 'zoomWidth'))] },
    { label: 'Appearance', items: [big('Moon', 'Dark Mode', 'toggleDark', { state: () => prefs.dark }), big('Pilcrow', 'Formatting Marks', 'marks', { state: () => document.body.classList.contains('showmarks') })] }
  ] },
  { id: 'tdesign', label: 'Table Design', ctx: 'table', groups: [
    { label: 'Table Style Options', items: [col(sbtn('Heading1', 'Header Row', null, { fn: () => toggleTableOpt('data-hr'), state: tableOptOn('data-hr') }), sbtn('Rows3', 'Banded Rows', null, { fn: () => toggleTableOpt('data-br'), state: tableOptOn('data-br') }), sbtn('Columns2', 'First Column', null, { fn: () => toggleTableOpt('data-fc'), state: tableOptOn('data-fc') }))] },
    { label: 'Table Styles', items: [{ t: 'el', el: styleGallery }] },
    { label: 'Shading', items: [big('PaintBucket', 'Shading', null, { menu: 'tblShade' })] },
    { label: 'Borders', items: [big('Square', 'Borders', null, { menu: 'tblBorders' }), col(sbtn('Droplet', 'Pen Colour', null, { menu: 'penColor' }), sbtn('Minus', 'Pen Weight', null, { menu: 'penWeight' }))] }
  ] },
  { id: 'tlayout', label: 'Table Layout', ctx: 'table', groups: [
    { label: 'Table', items: [col(sbtn('TextCursor', 'Select', null, { menu: 'tblSelect' }), sbtn('Table', 'View Gridlines', 'gridlines', { state: () => !document.body.classList.contains('nogrid') }), sbtn('AlignCenter', 'Position', null, { menu: 'tblPosition' }))] },
    { label: 'Rows & Columns', items: [big('Trash2', 'Delete', null, { menu: 'tblDelete' }), col(sbtn('BetweenHorizontalStart', 'Insert Above', null, { fn: () => tableOp('rowAbove') }), sbtn('BetweenHorizontalEnd', 'Insert Below', null, { fn: () => tableOp('rowBelow') })), col(sbtn('BetweenVerticalStart', 'Insert Left', null, { fn: () => tableOp('colLeft') }), sbtn('BetweenVerticalEnd', 'Insert Right', null, { fn: () => tableOp('colRight') }))] },
    { label: 'Merge', items: [col(sbtn('TableCellsMerge', 'Merge Cells', null, { fn: () => tableOp('merge') }), sbtn('Columns3', 'Split Cells', null, { fn: () => tableOp('split') }))] },
    { label: 'Cell Size (inches)', items: [col({ t: 'el', el: () => numIn('Height', rowHeightGet, setRowHeight) }, { t: 'el', el: () => numIn('Width', colWidthGet, setColWidth) }), col(sbtn('Scaling', 'AutoFit', null, { menu: 'tblAutofit' }), sbtn('MoveVertical', 'Distribute Rows', null, { fn: distributeRows }), sbtn('Columns3', 'Distribute Columns', null, { fn: () => tableOp('distribute') }))] },
    { label: 'Alignment', items: [{ t: 'el', el: alignGrid }, col(sbtn('Square', 'Cell Margins', null, { menu: 'tblMargins' }))] },
    { label: 'Data', items: [col(sbtn('ArrowDown', 'Sort', null, { menu: 'tblSort' }), sbtn('History', 'Repeat Header Row', null, { fn: toggleRepeatHeader, state: () => { const t = curTable(); return !!(t && realRows(t)[0] && realRows(t)[0].hasAttribute('data-hdr')); } }), sbtn('Type', 'Convert to Text', null, { fn: convertTableToText }))] }
  ] },
  { id: 'picture', label: 'Picture', ctx: 'picture', groups: [
    { label: 'Size', items: [big('Scaling', 'Size', null, { menu: 'imgSize' })] },
    { label: 'Arrange', items: [big('AlignCenter', 'Wrap Text', null, { menu: 'imgWrap' })] },
    { label: 'Accessibility', items: [big('Info', 'Alt Text', null, { fn: () => selImg && altTextDialog(selImg) })] },
    { label: 'Delete', items: [big('Trash2', 'Delete', null, { fn: () => imageOp('delete') })] }
  ] }
];

/* ---------- rendering ---------- */
let stateful = [];
function renderTabs() {
  const tabs = $('#tabs');
  tabs.innerHTML = '';
  const cell = curCell();
  const ctxNow = selImg ? 'picture' : cell ? 'table' : null;
  ctxTab = ctxNow;
  if (!ctxNow && TABS.find(t => t.id === currentTab && t.ctx)) currentTab = 'home';
  TABS.forEach(t => {
    if (t.ctx && t.ctx !== ctxNow) return;
    const b = h('button', { class: (t.id === 'file' ? 'file ' : '') + (t.ctx ? 'ctx ' : '') + (t.id === currentTab ? 'on' : ''), role: 'tab', type: 'button' }, t.label);
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', () => { if (t.id === 'file') return openBackstage(); currentTab = t.id; renderTabs(); renderRibbon(); });
    tabs.append(b);
  });
}
function renderItem(it) {
  if (it.t === 'row' || it.t === 'col') { const d = h('div', { class: it.t === 'row' ? 'rowb' : 'col' }); it.items.forEach(x => d.append(renderItem(x))); return d; }
  if (it.t === 'el') return it.el();
  const run = () => { if (it.fn) return it.fn(); if (typeof it.cmd === 'function') return it.cmd(); if (it.cmd && CMD[it.cmd]) return CMD[it.cmd](); };
  if (it.t === 'split') {
    const wrap = h('span', { class: 'rowb' });
    const sw = it.swatch ? h('i') : null;
    const main = h('button', { class: 'rb split-main', title: it.title, type: 'button' }, h('span', { class: 'ic swatch', html: icon(it.icon) }, sw));
    const arr = h('button', { class: 'rb split-arrow', title: it.title + ' options', type: 'button', html: '<span class="dd">▾</span>' });
    [main, arr].forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
    main.addEventListener('click', run);
    arr.addEventListener('click', () => MENUS[it.menu](arr));
    if (it.state) stateful.push([main, it.state]);
    if (sw) stateful.push([null, () => { sw.style.background = it.swatch(); }]);
    wrap.append(main, arr);
    return wrap;
  }
  const isBig = it.t === 'big';
  const b = h('button', { class: 'rb' + (isBig ? ' big' : '') + (!isBig && !it.label ? ' sq' : ''), title: it.title || it.label, type: 'button' },
    h('span', { class: 'ic', html: icon(it.icon) }), it.label ? h('span', { class: 'lbl' }, it.label) : null, it.menu && !it.splitBig && !it.cmd ? h('span', { class: 'dd' }, '▾') : null);
  b.addEventListener('mousedown', e => e.preventDefault());
  b.addEventListener('click', () => { if (it.menu && (!it.cmd || it.splitBig)) { if (it.splitBig) return MENUS[it.menu](b); return MENUS[it.menu](b); } run(); });
  if (it.state) stateful.push([b, it.state]);
  return b;
}
function renderRibbon() {
  const r = $('#ribbon');
  r.innerHTML = '';
  stateful = [];
  const tab = TABS.find(t => t.id === currentTab) || TABS[1];
  (tab.groups || []).forEach(g => {
    const grp = h('div', { class: 'grp' }, h('div', { class: 'grp-body' }), h('div', { class: 'grp-label' }, g.label));
    g.items.forEach(it => grp.firstChild.append(renderItem(it)));
    r.append(grp);
  });
  updateRibbonState();
}
function updateSwatches() { stateful.forEach(([b, f]) => { if (!b) f(); }); }
function updateRibbonState() {
  for (const [b, f] of stateful) { try { const v = f(); if (b) b.classList.toggle('on', !!v); } catch (e) { } }
  const fn = $('#fontName'), fs = $('#fontSize');
  const el = selElement();
  if (el && fn && document.activeElement !== fn) fn.value = getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim();
  if (el && fs && document.activeElement !== fs) fs.value = currentSize();
  const g = $('#stylesGallery');
  if (g) { const cur = currentStyleName(); $$('button', g).forEach(b => b.classList.toggle('on', b.dataset.style === cur)); }
  $$('#ribbon .numIn').forEach(i => i._sync && i._sync());
  $$('.qa[data-cmd="undo"]').forEach(b => b.style.opacity = History.canUndo() ? 1 : .5);
  $$('.qa[data-cmd="redo"]').forEach(b => b.style.opacity = History.canRedo() ? 1 : .5);
}
let uiQueued = false;
function scheduleUI() {
  if (uiQueued) return; uiQueued = true;
  requestAnimationFrame(() => {
    uiQueued = false;
    const cell = curCell();
    const want = selImg ? 'picture' : cell ? 'table' : null;
    if (want !== ctxTab) renderTabs();
    updateRibbonState();
    updateStatus();
    const c = Review.commentAt();
    if (!$('#commentPane').classList.contains('hidden')) { $$('span.cmt.active', editor).forEach(e => e.classList.remove('active')); if (c) $$(`span.cmt[data-cid="${c}"]`, editor).forEach(e => e.classList.add('active')); $$('#commentList .card').forEach((card, i) => card.classList.toggle('active', Review.commentIds().filter(id => doc.comments[id])[i] === c)); }
    if (selImg && !selImg.isConnected) selectImage(null);
  });
}

/* ---------- HTML sanitising (paste and .html import) ---------- */
const KEEP_STYLE = ['font-weight', 'font-style', 'text-decoration', 'text-decoration-line', 'color', 'background-color', 'font-size', 'font-family', 'text-align', 'vertical-align', 'margin-left', 'text-indent', 'list-style-type', 'width', 'height', 'line-height', 'column-count', 'margin-top', 'margin-bottom', 'margin-right'];
const KEEP_CLASS = /^(tc|cmt|pb|nb|fn|toc|toc-.*|t|p|dots|cols|fl|fr|ctr|s-[A-Za-z]+)$/;
function sanitizeHtml(html, fromPaste) {
  const d = new DOMParser().parseFromString(html, 'text/html');
  const body = d.body;
  body.querySelectorAll('script,style,meta,link,title,iframe,object,embed,form,input,button,select,textarea,noscript,svg,canvas,video,audio,template').forEach(e => e.remove());
  const walk = d.createTreeWalker(body, NodeFilter.SHOW_COMMENT); const cm = []; while (walk.nextNode()) cm.push(walk.currentNode); cm.forEach(c => c.remove());
  [...body.querySelectorAll('*')].forEach(el => {
    if (el.tagName.includes(':')) { const p = el.parentNode; while (el.firstChild) p.insertBefore(el.firstChild, el); el.remove(); return; }
    for (const a of [...el.attributes]) {
      const n = a.name.toLowerCase();
      if (n === 'style') {
        const keep = KEEP_STYLE.map(k => { const v = el.style.getPropertyValue(k); return v && !/mso|windowtext/i.test(v) ? `${k}:${v}` : null; }).filter(Boolean);
        if (fromPaste) { const fs = el.style.fontSize; if (fs && /^(medium|12pt|16px)$/.test(fs)) { } }
        if (keep.length) el.setAttribute('style', keep.join(';')); else el.removeAttribute('style');
      } else if (n === 'class') {
        const keep = [...el.classList].filter(c => KEEP_CLASS.test(c));
        if (fromPaste) { const k2 = keep.filter(c => c !== 'cmt'); if (k2.length) el.className = k2.join(' '); else el.removeAttribute('class'); }
        else if (keep.length) el.className = keep.join(' '); else el.removeAttribute('class');
      } else if (n === 'href') { if (/^\s*javascript:/i.test(a.value)) el.removeAttribute('href'); }
      else if (n === 'src') { if (!/^(data:image\/|https?:|blob:)/i.test(a.value)) el.removeAttribute('src'); }
      else if (['colspan', 'rowspan', 'start', 'type', 'alt', 'contenteditable', 'data-author', 'data-date', 'data-note', 'data-level', 'data-i', 'data-pn'].includes(n) || (n === 'data-cid' && !fromPaste)) { }
      else el.removeAttribute(a.name);
    }
    if (el.tagName === 'FONT' || (el.tagName === 'SPAN' && !el.attributes.length)) { const p = el.parentNode; while (el.firstChild) p.insertBefore(el.firstChild, el); el.remove(); }
    if (el.tagName === 'DIV' && !el.attributes.length && fromPaste && ![...el.children].some(c => /^(P|DIV|H\d|UL|OL|TABLE|BLOCKQUOTE|PRE|HR)$/.test(c.tagName))) { const p = d.createElement('p'); while (el.firstChild) p.appendChild(el.firstChild); el.replaceWith(p); }
  });
  if (fromPaste) body.querySelectorAll('span.cmt').forEach(s => s.removeAttribute('class'));
  return body.innerHTML;
}
