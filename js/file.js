/* DraftLy: documents, files, backstage, sync wiring, startup */
const fileHandles = {};
const YEAR = new Date().getFullYear();
const AKH_HEADER = `<p style="text-align:center"><b><span style="font-size:20pt;letter-spacing:2px">ANIRUDH K H</span></b></p><p style="text-align:center"><span style="font-size:10pt">Advocate &amp; Consultant</span></p><p style="text-align:center"><span style="font-size:9pt">162, Ground Floor, 1st Main, 1st Cross, Arekere Mico Layout, Bannerghatta Road, Bengaluru 560076</span></p><p style="text-align:center"><span style="font-size:9pt">+91 7975570750 | anirudhlegal93@gmail.com</span></p><hr>`;
const TEMPLATES = [
  { id: 'blank', name: 'Blank document', html: '<p><br></p>' },
  { id: 'letterhead', name: 'Letterhead (Anirudh K H)', settings: { header: AKH_HEADER, margins: { top: 1.9, bottom: 1, left: 1, right: 1 }, theme: Object.assign({}, STYLE_SETS.Legal) }, html: `<p style="text-align:right">Date: [Date]</p><p>To,</p><p>[Name]<br>[Address]</p><p><b>Sub: [Subject]</b></p><p>Sir/Madam,</p><p>[Body of the letter]</p><p><br></p><p>Yours faithfully,</p><p><br></p><p><b>(ANIRUDH K H)</b><br>Advocate</p>` },
  { id: 'notice', name: 'Legal Notice', settings: { header: AKH_HEADER, margins: { top: 1.9, bottom: 1, left: 1, right: 1 }, footer: '<p style="text-align:center"><span style="font-size:9pt">Page {PAGE} of {NUMPAGES}</span></p>', theme: Object.assign({}, STYLE_SETS.Legal) }, html: `<p><b>Ref: AKH/LN/__/${YEAR}</b>\t\t\t\t\t\t<b>Date: [Date]</b></p><p style="text-align:center"><b><u>BY SPEED POST / COURIER</u></b></p><p>To,</p><p>[Name of the Noticee]<br>[Address]</p><p style="text-align:center"><b><u>LEGAL NOTICE</u></b></p><p>Sir/Madam,</p><p>Under instructions from and on behalf of my client, [Name of client], aged about [ ] years, residing at [Address] (hereinafter referred to as "my client"), I hereby serve upon you the following legal notice:</p><ol><li><p>That [facts].</p></li><li><p>That [facts].</p></li><li><p>That [cause of action].</p></li></ol><p>I therefore call upon you to [demand] within 15 (fifteen) days from the date of receipt of this notice, failing which my client shall be constrained to initiate appropriate legal proceedings against you, civil and/or criminal, entirely at your risk as to costs and consequences.</p><p>A copy of this notice is retained in my office for further action.</p><p><br></p><p style="text-align:right">Yours faithfully,</p><p><br></p><p style="text-align:right"><b>(ANIRUDH K H)</b><br>Advocate</p>` },
  { id: 'agreement', name: 'Agreement', settings: { theme: Object.assign({}, STYLE_SETS.Legal), footer: '<p style="text-align:center"><span style="font-size:9pt">Page {PAGE} of {NUMPAGES}</span></p>' }, html: `<h1 style="text-align:center">[TITLE OF AGREEMENT]</h1><p>THIS AGREEMENT is made and executed at Bengaluru on this [day] day of [month], ${YEAR}.</p><p style="text-align:center"><b>BY AND BETWEEN</b></p><p>[Name of First Party], [description], residing at [address], hereinafter referred to as the "<b>FIRST PARTY</b>" (which expression shall, unless repugnant to the context, mean and include its successors and permitted assigns) of the ONE PART;</p><p style="text-align:center"><b>AND</b></p><p>[Name of Second Party], [description], residing at [address], hereinafter referred to as the "<b>SECOND PARTY</b>" (which expression shall, unless repugnant to the context, mean and include its successors and permitted assigns) of the OTHER PART.</p><p><b>WHEREAS:</b></p><ol style="list-style-type:upper-alpha"><li><p>[Recital].</p></li><li><p>[Recital].</p></li></ol><p><b>NOW THIS AGREEMENT WITNESSETH AS FOLLOWS:</b></p><h2>1. Definitions</h2><p>[Clause]</p><h2>2. Term</h2><p>[Clause]</p><h2>3. Consideration</h2><p>[Clause]</p><h2>4. Governing Law and Jurisdiction</h2><p>This Agreement shall be governed by the laws of India, and the courts at Bengaluru shall have exclusive jurisdiction.</p><p>IN WITNESS WHEREOF the parties have signed this Agreement on the day, month and year first above written.</p><table class="nb"><tbody><tr><td><p><b>FIRST PARTY</b></p><p><br></p><p>____________________</p></td><td><p><b>SECOND PARTY</b></p><p><br></p><p>____________________</p></td></tr></tbody></table><p><b>WITNESSES:</b></p><p>1.</p><p>2.</p>` },
  { id: 'affidavit', name: 'Affidavit', settings: { theme: Object.assign({}, STYLE_SETS.Legal) }, html: `<h1 style="text-align:center"><u>AFFIDAVIT</u></h1><p>I, [Name], aged about [ ] years, [S/o / D/o / W/o] [Name], residing at [Address], do hereby solemnly affirm and state on oath as follows:</p><ol><li><p>That I am [description] and I am well acquainted with the facts of the case.</p></li><li><p>That [statement].</p></li><li><p>That [statement].</p></li></ol><p><br></p><p style="text-align:right"><b>DEPONENT</b></p><p style="text-align:center"><b><u>VERIFICATION</u></b></p><p>I, the deponent above named, do hereby verify that the contents of the above affidavit are true and correct to the best of my knowledge, information and belief, and nothing material has been concealed therefrom.</p><p>Verified at Bengaluru on this [day] day of [month], ${YEAR}.</p><p style="text-align:right"><b>DEPONENT</b></p>` },
  { id: 'letter', name: 'Formal Letter', html: `<p>[Your Name]<br>[Address]<br>[Email] | [Phone]</p><p>[Date]</p><p>[Recipient Name]<br>[Title]<br>[Company]<br>[Address]</p><p>Dear [Recipient Name],</p><p>[Body of the letter.]</p><p>Sincerely,</p><p><br></p><p>[Your Name]</p>` },
  { id: 'report', name: 'Report', html: `<p class="s-Title">[Report Title]</p><p class="s-Subtitle">[Subtitle]</p><h1>Introduction</h1><p>[Text]</p><h1>Findings</h1><h2>[Finding 1]</h2><p>[Text]</p><h1>Conclusion</h1><p>[Text]</p>` }
];

/* ---------- document lifecycle ---------- */
function setSaveState(t) { $('#saveState').textContent = t; }
function markDirty() {
  if (!doc) return;
  doc.modified = Date.now();
  setSaveState('Saving…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 500);
}
function record() { return { id: doc.id, title: doc.title, html: cleanHTML(), settings: doc.settings, comments: doc.comments, created: doc.created, modified: doc.modified, syncedAt: doc.syncedAt || 0 }; }
async function persist(immediate) {
  if (!doc) return;
  clearTimeout(saveTimer);
  const rec = record();
  await Store.put(rec);
  setSaveState(Sync.enabled ? (Sync.status === 'live' ? 'Saved · syncing…' : 'Saved on this device') : 'Saved on this device');
  if (Sync.enabled) Sync.push(rec, immediate);
  scheduleFolderCopy();
}
async function loadDoc(d) {
  if (doc && doc.id !== d.id) await persist(true);
  if (typeof Merge !== "undefined") { Merge.preview = false; Merge.idx = 0; }
  const s = Object.assign(DEFAULT_SETTINGS(), d.settings || {});
  s.margins = Object.assign({ top: 1, bottom: 1, left: 1, right: 1 }, s.margins || {});
  s.theme = Object.assign({}, STYLE_SETS.Default, s.theme || {});
  doc = { id: d.id, title: d.title || 'Document', settings: s, comments: d.comments || {}, created: d.created || Date.now(), modified: d.modified || Date.now(), syncedAt: d.syncedAt || 0 };
  editor.innerHTML = d.html || '<p><br></p>';
  normalize();
  $('#docTitle').value = doc.title;
  document.title = doc.title + ' · DraftLy';
  applyDocStyles();
  Review.setTracking(!!s.trackChanges);
  $('#stTrack').classList.toggle('hidden', !s.trackChanges);
  if (typeof applyRestriction === 'function') applyRestriction();
  selectImage(null);
  if ($('.toc[data-regen]', editor)) { $$('.toc[data-regen]', editor).forEach(t => t.removeAttribute('data-regen')); requestAnimationFrame(() => updateTOC()); }
  prefs.lastDoc = doc.id; savePrefs();
  History.reset();
  paginate(); renderRibbon(); refreshPanes(); updateWordCount();
  if (Object.keys(doc.comments).length && Review.commentIds().length && innerWidth > 900) showPane('commentPane', true);
  setSaveState(doc.syncedAt && doc.syncedAt >= doc.modified ? 'Saved · synced' : 'Saved on this device');
  $('#canvas').scrollTop = 0;
}
async function newDoc(opts = {}) {
  const d = { id: uid(), title: opts.title || nextTitle(), html: opts.html || '<p><br></p>', settings: Object.assign(DEFAULT_SETTINGS(), opts.settings || {}), comments: opts.comments || {}, created: Date.now(), modified: Date.now() };
  await Store.put(d);
  await loadDoc(d);
  if (Sync.enabled) Sync.push(record(), true);
  closeBackstage();
  editor.focus();
  return d;
}
let docCounter = 1;
const nextTitle = () => 'Document' + (docCounter++);
async function deleteDoc(id) {
  await Store.del(id);
  if (Sync.enabled) Sync.remove(id);
  if (doc && doc.id === id) {
    const all = (await Store.all()).filter(d => !d.stub);
    if (all.length) await loadDoc(all[0]); else { doc = null; await newDoc(); }
  }
}
async function openRecord(id) {
  let d = await Store.get(id);
  if (!d) return toast('Document not found');
  if (d.stub || (Sync.enabled && Sync.meta[id] && Sync.meta[id].modified > (d.modified || 0))) {
    if (!Sync.enabled) return toast('Sign in to sync to open this document');
    try { setSaveState('Downloading…'); const r = await Sync.pull(id); if (r) { d = Object.assign({ id }, r, { syncedAt: r.modified, stub: false }); await Store.put(d); } }
    catch (e) { if (d.stub) return toast('Could not download this document. Check your connection.'); }
  }
  await loadDoc(d);
  closeBackstage();
}

/* ---------- opening files ---------- */
async function openFileObject(file, handle) {
  try {
    const name = file.name || 'Document';
    const ext = (name.split('.').pop() || '').toLowerCase();
    toast('Opening ' + name + '…', 1500);
    let opts;
    if (ext === 'docx' || ext === 'docm' || ext === 'dotx') {
      const r = await DocxImport.parse(await file.arrayBuffer(), name);
      if (r === null) return; // password prompt cancelled
      opts = { title: r.title, html: r.html, settings: r.settings, comments: r.comments, password: r.password };
    } else if (ext === 'doc') { return toast('Old .doc files are not supported. Open it in Word or Google Docs and save as .docx first.', 5000); }
    else if (ext === 'html' || ext === 'htm') opts = { title: name.replace(/\.[^.]+$/, ''), html: sanitizeHtml(await file.text(), false) };
    else if (ext === 'md') opts = { title: name.replace(/\.[^.]+$/, ''), html: mdToHtml(await file.text()) };
    else opts = { title: name.replace(/\.[^.]+$/, ''), html: (await file.text()).replace(/\r\n?/g, '\n').split('\n').map(l => `<p>${esc(l) || '<br>'}</p>`).join('') };
    // reopening the same file (e.g. double-click in Finder) refreshes its existing copy instead of making a duplicate
    if (handle && ext === 'docx' && handle.isSameEntry) {
      for (const old of await Store.all()) {
        const h2 = await KV.get('fh:' + old.id);
        let same = false;
        try { same = !!(h2 && await h2.isSameEntry(handle)); } catch (e) { }
        if (!same) continue;
        const rec = Object.assign({}, old, { title: opts.title, html: opts.html, settings: Object.assign(DEFAULT_SETTINGS(), opts.settings || {}), comments: opts.comments || {}, modified: Date.now(), stub: false });
        await Store.put(rec);
        if (opts.password) Protect.remember(rec.id, opts.password);
        await loadDoc(rec);
        fileHandles[rec.id] = handle;
        if (Sync.enabled) Sync.push(record(), true);
        closeBackstage();
        toast('Opened ' + name);
        return;
      }
    }
    const d = await newDoc(opts);
    if (opts.password) Protect.remember(d.id, opts.password);
    if (handle && ext === 'docx') { fileHandles[d.id] = handle; KV.set('fh:' + d.id, handle); }
    toast('Opened ' + name);
  } catch (e) { console.error(e); toast('Could not open the file: ' + e.message, 5000); }
}
function mdToHtml(md) {
  const inl = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<i>$2</i>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/\[(.+?)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>');
  let out = '', list = null;
  const close = () => { if (list) { out += `</${list}>`; list = null; } };
  for (const line of md.replace(/\r\n?/g, '\n').split('\n')) {
    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)/))) { close(); out += `<h${m[1].length}>${inl(m[2])}</h${m[1].length}>`; }
    else if ((m = line.match(/^\s*[-*+]\s+(.*)/))) { if (list !== 'ul') { close(); out += '<ul>'; list = 'ul'; } out += `<li>${inl(m[1])}</li>`; }
    else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); out += '<ol>'; list = 'ol'; } out += `<li>${inl(m[1])}</li>`; }
    else if (/^\s*(---|\*\*\*)\s*$/.test(line)) { close(); out += '<hr>'; }
    else if (!line.trim()) close();
    else { close(); out += `<p>${inl(line)}</p>`; }
  }
  close();
  return out || '<p><br></p>';
}

/* ---------- saving & exporting ---------- */
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const IOS_STANDALONE = IS_IOS && (navigator.standalone === true || matchMedia('(display-mode: standalone)').matches);
const safeName = t => (t || 'Document').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Document';
async function buildDocx(opts = {}) {
  const blob = await buildDocxPlain();
  if (!doc.settings.encrypted || typeof Protect === 'undefined') return blob;
  const pw = await Protect.passwordFor(doc.id, opts.background);
  if (!pw) { if (opts.background) return null; throw new Error('the password is needed to save this protected document'); }
  return new Blob([await OfficeCrypto.encrypt(new Uint8Array(await blob.arrayBuffer()), pw)], { type: DOCX_MIME });
}
async function buildDocxPlain() {
  return DocxExport.build({ root: editor, settings: doc.settings, comments: doc.comments, theme: doc.settings.theme, title: doc.title, author: prefs.author, trackChanges: Review.isTracking(), created: doc.created, anonymous: !!doc.settings.anonymous });
}
function buildHtml() {
  const g = geom();
  const css = $('#docStyles').textContent.replace(/#editor/g, '.doc').replace(/#footnoteArea, |\.sheet \.hf, |\.hf-editor/g, '');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(doc.title)}</title><style>${css}
body{margin:0;background:#f3f3f3}.doc{max-width:${Math.round(g.cw)}px;margin:30px auto;background:#fff;padding:60px;box-shadow:0 1px 4px rgba(0,0,0,.15);white-space:pre-wrap}
.doc table{border-collapse:collapse;width:100%}.doc td,.doc th{border:1px solid #000;padding:2px 6px;vertical-align:top}.doc table.nb td{border:0}
.doc ins.tc{color:#B4009E;text-decoration:underline}.doc del.tc{color:#B4009E}.doc hr.pb{border:0;page-break-after:always}
.doc img.fl{float:left;margin:2px 12px 6px 0}.doc img.fr{float:right;margin:2px 0 6px 12px}.doc img.ctr{display:block;margin:auto}.doc sup.fn::after{content:attr(data-n)}
@media print{body{background:#fff}.doc{box-shadow:none;margin:0;padding:0}}</style></head><body><article class="doc">${cleanHTML()}</article></body></html>`;
}
function buildText() {
  const c = editor.cloneNode(true);
  c.querySelectorAll('del.tc,.toc').forEach(e => e.remove());
  c.querySelectorAll('br').forEach(b => b.replaceWith('\n'));
  c.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,tr,hr').forEach(b => b.append('\n'));
  c.querySelectorAll('td,th').forEach(b => b.append('\t'));
  return c.textContent.replace(/​/g, '').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
async function blobToBase64(blob) { return new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(blob); }); }
const capPlugins = {};
function capCall(plugin, method, opts) {
  const C = window.Capacitor;
  let P = C && C.Plugins && C.Plugins[plugin];
  if (!P && C && C.registerPlugin) P = capPlugins[plugin] || (capPlugins[plugin] = C.registerPlugin(plugin));
  if (P && typeof P[method] === 'function') return P[method](opts || {});
  if (C && C.nativePromise) return C.nativePromise(plugin, method, opts || {});
  return Promise.reject(new Error(plugin + ' is not available'));
}

/* small key-value store for folder and file permissions (Chrome / Edge on Mac) */
const KV = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('draftly-fs', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const run = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('kv', mode); const q = fn(t.objectStore('kv')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); };
  return { get: k => run('readonly', s => s.get(k)).catch(() => null), set: (k, v) => run('readwrite', s => s.put(v, k)).catch(() => null), del: k => run('readwrite', s => s.delete(k)).catch(() => null) };
})();
const FS_OK = !!window.showDirectoryPicker && !IS_NATIVE && !IS_IOS;
const SaveFolder = {
  /* returns a writable folder handle, asking only when `ask` is true (needs a click) */
  async get(ask) {
    if (!FS_OK) return null;
    let dir = await KV.get('saveDir');
    if (dir) {
      try {
        let p = await dir.queryPermission({ mode: 'readwrite' });
        if (p !== 'granted' && ask) p = await dir.requestPermission({ mode: 'readwrite' });
        if (p === 'granted') return dir;
      } catch (e) { }
      if (!ask) return null;
    }
    if (!ask) return null;
    return this.choose();
  },
  async choose() {
    try {
      toast('Choose the folder for your DraftLy files (Documents is suggested)', 4000);
      const dir = await showDirectoryPicker({ id: 'draftly-save', mode: 'readwrite', startIn: 'documents' });
      await KV.set('saveDir', dir);
      prefs.saveDirName = dir.name; savePrefs();
      return dir;
    } catch (e) { return null; }
  },
  async write(dir, name, blob, key) {
    // reuse the file name this document was saved under before; avoid clobbering other documents
    let fname = key ? await KV.get('name:' + key) : null;
    if (!fname) {
      fname = name;
      const dot = name.lastIndexOf('.'), stem = name.slice(0, dot), ext = name.slice(dot);
      for (let i = 2; i < 200; i++) { try { await dir.getFileHandle(fname); fname = `${stem} (${i})${ext}`; } catch (e) { break; } }
      if (key) await KV.set('name:' + key, fname);
    }
    const fh = await dir.getFileHandle(fname, { create: true });
    const w = await fh.createWritable(); await w.write(blob); await w.close();
    return fname;
  }
};
async function saveBlob(blob, name, key) {
  if (IS_NATIVE) {
    const data = await blobToBase64(blob);
    try {
      await capCall('Filesystem', 'writeFile', { path: 'DraftLy/' + name, data, directory: 'DOCUMENTS', recursive: true });
      if (key && /\.docx$/.test(name)) KV.set('nname:' + key.replace(/\.docx$/, ''), name);
      toast('Saved to Documents/DraftLy/' + name, 4000);
      return;
    } catch (e) {
      try { const res = await capCall('Filesystem', 'writeFile', { path: name, data, directory: 'CACHE' }); await capCall('Share', 'share', { title: name, url: res && res.uri, dialogTitle: 'Save or send ' + name }); }
      catch (e2) { if (!/cancel/i.test(e2.message || '')) toast('Save failed: ' + (e2.message || e2)); }
      return;
    }
  }
  const dir = await SaveFolder.get(false);
  if (dir) {
    try { const f = await SaveFolder.write(dir, name, blob, key); toast(`Saved to ${dir.name} › ${f}`, 3500); return; }
    catch (e) { console.warn(e); }
  }
  const file = new File([blob], name, { type: blob.type });
  if (IS_IOS && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Downloaded ' + name);
}
/* PDF made inside DraftLy: exact pages, searchable text */
async function makePdf() {
  const m = modal('Save as PDF', h('div', null, h('p', { id: 'pdfProg' }, 'Preparing pages…')), []);
  try {
    await persist(true);
    return await PdfMaker.make((i, n) => { const p = $('#pdfProg'); if (p) p.textContent = `Preparing page ${i} of ${n}…`; });
  } finally { m.close(); }
}
function pdfReadyDialog(blob, name, forPrint) {
  const file = new File([blob], name, { type: 'application/pdf' });
  const canShare = navigator.canShare && navigator.canShare({ files: [file] });
  const btns = [{ label: 'Close' }];
  if (!canShare || !forPrint) btns.push({ label: 'Save PDF', primary: !forPrint, fn: () => saveBlob(blob, name, doc.id + '.pdf') });
  if (canShare) btns.push({ label: forPrint ? 'Print…' : 'Share…', primary: forPrint, fn: () => navigator.share({ files: [file], title: name }).catch(() => { }) });
  modal(forPrint ? 'Ready to print' : 'PDF ready', h('p', { class: 'note' }, forPrint ? `Tap Print…, then choose Print in the share sheet. (${ui.pages} page${ui.pages > 1 ? 's' : ''})` : `${name} · ${ui.pages} page${ui.pages > 1 ? 's' : ''}`), btns);
}
async function exportAs(fmt) {
  await persist(true);
  const base = safeName(doc.title);
  const dir = await SaveFolder.get(true); // ask for the folder while we still have the click
  if (FS_OK && !IS_NATIVE && !dir) { toast('Not saved. Your work is still kept in DraftLy.', 4000); return; }
  try {
    if (fmt === 'docx') return saveBlob(await buildDocx(), base + '.docx', doc.id + '.docx');
    if (fmt === 'html') return saveBlob(new Blob([buildHtml()], { type: 'text/html' }), base + '.html', doc.id + '.html');
    if (fmt === 'txt') return saveBlob(new Blob([buildText()], { type: 'text/plain' }), base + '.txt', doc.id + '.txt');
    if (fmt === 'pdf') {
      closeBackstage();
      const blob = await makePdf();
      if (IS_IOS) return pdfReadyDialog(blob, base + '.pdf', false);
      return saveBlob(blob, base + '.pdf', doc.id + '.pdf');
    }
  } catch (e) { console.error(e); toast('Export failed: ' + e.message, 5000); }
}
async function convertDocxToPdf() {
  await SaveFolder.get(true);
  const pick = h('input', { type: 'file', accept: '.docx,' + DOCX_MIME });
  pick.onchange = async () => { const f = pick.files[0]; if (!f) return; await openFileObject(f); exportAs('pdf'); };
  pick.click();
}
CMD.save = async () => {
  await persist(true);
  const hnd = fileHandles[doc.id] || await KV.get('fh:' + doc.id);
  if (hnd && hnd.createWritable) {
    try {
      let p = await hnd.queryPermission({ mode: 'readwrite' });
      if (p !== 'granted') p = await hnd.requestPermission({ mode: 'readwrite' });
      if (p === 'granted') { const w = await hnd.createWritable(); await w.write(await buildDocx()); await w.close(); fileHandles[doc.id] = hnd; toast('Saved ' + hnd.name); return; }
      // you pressed Cancel: leave the file alone and do not download a copy
      toast('Not saved to ' + hnd.name + '. Your work is still kept in DraftLy.', 4500);
      return;
    } catch (e) { if (e.name === 'AbortError' || e.name === 'NotAllowedError') { toast('Not saved to the file. Your work is still kept in DraftLy.', 4500); return; } }
  }
  exportAs('docx');
};
CMD.savePdf = () => exportAs('pdf');
/* keep the .docx in the save folder up to date automatically (only once permission exists) */
let folderTimer = null;
function scheduleFolderCopy() {
  if (prefs.autoDocx === false || !doc || (!FS_OK && !IS_NATIVE)) return;
  clearTimeout(folderTimer);
  folderTimer = setTimeout(() => autoSaveNow(false), 3000);
}
/* AutoSave: write this document's Word file now (only once it has been saved as a file) */
async function autoSaveNow(ask) {
  if (!doc) return 'none';
  const id = doc.id;
  try {
    if (IS_NATIVE) {
      const nm = await KV.get('nname:' + id);
      if (!nm) return 'none';
      const blob = await buildDocx({ background: true }); if (!blob) return 'none';
      await capCall('Filesystem', 'writeFile', { path: 'DraftLy/' + nm, data: await blobToBase64(blob), directory: 'DOCUMENTS', recursive: true });
      if (doc && doc.id === id) setSaveState('AutoSaved · ' + nm);
      return 'ok';
    }
    const t = await docxTarget(id, ask);
    if (t === 'none') return 'none';
    if (t === 'perm') { permDocx.add(id); showDocxBar(); return 'perm'; }
    const blob = await buildDocx({ background: true }); if (!blob) return 'none';
    const nm = await t(blob);
    permDocx.delete(id); showDocxBar();
    if (doc && doc.id === id) setSaveState('AutoSaved · ' + nm);
    return 'ok';
  } catch (e) { console.warn('autosave', e); return 'none'; }
}
function renderAutoSave() {
  const b = $('#autoSave'); if (!b) return;
  b.classList.toggle('hidden', !FS_OK && !IS_NATIVE);
  const on = prefs.autoDocx !== false;
  b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
  b.title = on ? 'AutoSave is on: the Word file is updated a few seconds after each change' : 'AutoSave is off: click Save to update the Word file';
}
async function toggleAutoSave() {
  const on = prefs.autoDocx === false;
  prefs.autoDocx = on; savePrefs(); renderAutoSave();
  if (!on) { clearTimeout(folderTimer); return toast('AutoSave is off. Click Save to update the Word file. DraftLy still keeps your work and syncs it.', 5000); }
  const r = await autoSaveNow(true);
  if (r === 'none') { toast('Choose where to save this document. AutoSave will then keep it up to date.', 4000); await CMD.save(); }
  else toast('AutoSave is on. The Word file is updated a few seconds after each change.', 4000);
}
/* Mac: when another device edits a document, rewrite its Word file in the save folder too */
const pendingDocx = new Set(), permDocx = new Set();
let docxTimer = null;
function queueDocxRefresh(id) {
  if (!FS_OK || IS_NATIVE || prefs.autoDocx === false) return;
  pendingDocx.add(id);
  clearTimeout(docxTimer); docxTimer = setTimeout(flushDocxRefresh, 4000);
}
async function docxBlobFor(rec) {
  const open = doc && doc.id === rec.id;
  const s = open ? doc.settings : Object.assign(DEFAULT_SETTINGS(), rec.settings || {});
  const root = open ? editor : h('div', { html: rec.html || '<p></p>' });
  let blob = await DocxExport.build({ root, settings: s, comments: (open ? doc.comments : rec.comments) || {}, theme: s.theme, title: rec.title, author: prefs.author, trackChanges: open ? Review.isTracking() : !!s.trackChanges, created: rec.created, anonymous: !!s.anonymous });
  if (s.encrypted) {
    const pw = await Protect.passwordFor(rec.id, true);
    if (!pw) return null;
    blob = new Blob([await OfficeCrypto.encrypt(new Uint8Array(await blob.arrayBuffer()), pw)], { type: DOCX_MIME });
  }
  return blob;
}
/* where this document's Word file lives: 'none' (never saved here), 'perm' (needs your OK), or a writer */
async function docxTarget(id, ask) {
  const hnd = fileHandles[id] || await KV.get('fh:' + id);
  const saved = await KV.get('name:' + id + '.docx');
  if (!hnd && !saved) return 'none';
  try {
    if (hnd) {
      let p = await hnd.queryPermission({ mode: 'readwrite' });
      if (p !== 'granted' && ask) p = await hnd.requestPermission({ mode: 'readwrite' });
      if (p !== 'granted') return 'perm';
      fileHandles[id] = hnd;
      return async blob => { const w = await hnd.createWritable(); await w.write(blob); await w.close(); return hnd.name; };
    }
    const dir = await KV.get('saveDir');
    if (!dir) return 'none';
    let p = await dir.queryPermission({ mode: 'readwrite' });
    if (p !== 'granted' && ask) p = await dir.requestPermission({ mode: 'readwrite' });
    if (p !== 'granted') return 'perm';
    return async blob => { await SaveFolder.write(dir, saved, blob, id + '.docx'); return saved; };
  } catch (e) { return 'perm'; }
}
async function flushDocxRefresh(ask) {
  const ids = [...pendingDocx, ...(ask ? permDocx : [])];
  pendingDocx.clear();
  const done = [];
  for (const id of new Set(ids)) {
    try {
      const rec = await Store.get(id);
      if (!rec || rec.stub) { permDocx.delete(id); continue; }
      const t = await docxTarget(id, ask);
      if (t === 'none') { permDocx.delete(id); continue; }
      if (t === 'perm') { permDocx.add(id); continue; }
      const blob = await docxBlobFor(rec);
      if (!blob) { permDocx.delete(id); continue; }
      done.push(await t(blob)); permDocx.delete(id);
    } catch (e) { console.warn('docx refresh', e); }
  }
  if (done.length) toast(done.length === 1 ? `Word file updated: ${done[0]}` : `${done.length} Word files updated in ${prefs.saveDirName || 'your folder'}`);
  showDocxBar();
}
function showDocxBar() {
  let bar = $('#docxBar');
  if (!permDocx.size) { if (bar) bar.remove(); return; }
  const n = permDocx.size;
  const msg = `AutoSave needs your OK to update ${n > 1 ? n + ' Word files' : 'the Word file'} in ${prefs.saveDirName || 'your folder'}.`;
  if (!bar) {
    bar = h('div', { id: 'docxBar', class: 'docx-bar' }, h('span', { class: 'msg' }),
      h('button', { class: 'btn primary', type: 'button', onclick: () => flushDocxRefresh(true) }, 'Update'),
      h('button', { class: 'x', type: 'button', title: 'Not now', onclick: () => bar.remove() }, '×'));
    document.body.append(bar);
  }
  bar.querySelector('.msg').textContent = msg;
}
CMD.open = async () => {
  if (window.showOpenFilePicker && !IS_NATIVE) {
    try {
      const [hnd] = await showOpenFilePicker({ id: 'draftly-open', startIn: 'documents', types: [{ description: 'Documents', accept: { [DOCX_MIME]: ['.docx'], 'text/html': ['.html', '.htm'], 'text/plain': ['.txt', '.md'] } }] });
      return openFileObject(await hnd.getFile(), hnd);
    } catch (e) { if (e.name === 'AbortError') return; }
  }
  $('#fileOpen').click();
};
CMD.newDoc = () => newDoc();
/* Share: ask Word or PDF, then hand the file to the device share sheet */
async function shareBlob(blob, name, mime) {
  if (IS_NATIVE) {
    try { const data = await blobToBase64(blob); const res = await capCall('Filesystem', 'writeFile', { path: name, data, directory: 'CACHE' }); await capCall('Share', 'share', { title: name, url: res && res.uri, dialogTitle: 'Share ' + name }); }
    catch (e) { if (!/cancel/i.test(e.message || '')) toast('Share failed: ' + (e.message || e)); }
    return;
  }
  const file = new File([blob], name, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; }
    catch (e) {
      if (e.name === 'AbortError') return;
      // the browser needs a fresh tap after a long preparation (common with PDFs)
      modal('Ready to share', h('p', { class: 'note' }, name), [{ label: 'Close' }, { label: 'Share…', primary: true, fn: () => navigator.share({ files: [file], title: name }).catch(() => { }) }]);
      return;
    }
  }
  await saveBlob(blob, name);
  toast(name + ' saved. Attach it to your email or message.', 5000);
}
async function shareAs(fmt) {
  prefs.shareFmt = fmt; savePrefs();
  await persist(true);
  const base = safeName(doc.title);
  try {
    if (fmt === 'pdf') { closeBackstage(); const blob = await makePdf(); return shareBlob(blob, base + '.pdf', 'application/pdf'); }
    return shareBlob(await buildDocx(), base + '.docx', DOCX_MIME);
  } catch (e) { console.error(e); toast('Share failed: ' + e.message, 5000); }
}
function shareChoice(fmt, title, sub, ic) {
  return h('button', { class: 'bs-act' + (prefs.shareFmt === fmt ? ' last' : ''), type: 'button', onclick: () => { $$('.modal-bg').forEach(m => m.remove()); shareAs(fmt); } }, h('span', { class: 'ic', html: icon(ic) }), h('b', null, title), h('small', null, sub));
}
CMD.share = () => {
  modal('Share "' + doc.title + '"', h('div', null,
    h('p', { class: 'note' }, 'How should the other person receive it?'),
    h('div', { class: 'bs-actions share-pick' },
      shareChoice('docx', 'Word document (.docx)', 'Opens and edits in MS Word, Google Docs, Pages', 'FileText'),
      shareChoice('pdf', 'PDF', 'Fixed layout for reading, printing or filing', 'FileDown'))), [{ label: 'Cancel' }]);
};
let viewBeforePrint = null;
function startPrintLayout() {
  viewBeforePrint = document.body.classList.contains('read') ? 'read' : document.body.classList.contains('focus') ? 'focus' : ui.view;
  if (viewBeforePrint !== 'print') setView('print');
  selectImage(null); clearFind();
  const g = geom();
  $('#printStyles').textContent = `@page { size: ${g.pw}px ${g.ph}px; margin: 0; }`;
  ui.printing = true; document.body.classList.add('printing');
  paginate();
}
CMD.print = async () => {
  if (IS_NATIVE) {
    startPrintLayout();
    let hid = false;
    const onVis = () => { if (document.visibilityState === 'hidden') hid = true; else if (hid) { document.removeEventListener('visibilitychange', onVis); setTimeout(endPrint, 400); } };
    document.addEventListener('visibilitychange', onVis);
    setTimeout(() => { if (!hid) { document.removeEventListener('visibilitychange', onVis); endPrint(); } }, 6000);
    try { await capCall('DraftlyNative', 'print', { name: doc.title, size: doc.settings.pageSize, landscape: doc.settings.orientation === 'landscape' }); }
    catch (e) { endPrint(); const blob = await makePdf(); pdfReadyDialog(blob, safeName(doc.title) + '.pdf', true); }
    return;
  }
  if (IOS_STANDALONE) { const blob = await makePdf(); return pdfReadyDialog(blob, safeName(doc.title) + '.pdf', true); }
  startPrintLayout();
  let started = false;
  const mark = () => { started = true; };
  window.addEventListener('beforeprint', mark, { once: true });
  setTimeout(() => {
    window.print();
    // safety net: leave print mode on the next interaction if the browser never reports "afterprint"
    setTimeout(() => { const done = () => { ['pointerdown', 'keydown'].forEach(t => window.removeEventListener(t, done, true)); setTimeout(endPrint, 50); }; ['pointerdown', 'keydown'].forEach(t => window.addEventListener(t, done, true)); }, 600);
    setTimeout(async () => {
      window.removeEventListener('beforeprint', mark);
      if (!started && ui.printing) { endPrint(); const blob = await makePdf(); pdfReadyDialog(blob, safeName(doc.title) + '.pdf', true); }
      else if (IS_IOS) setTimeout(endPrint, 1500);
    }, 1200);
  }, 60);
};
function endPrint() {
  if (!ui.printing) return;
  ui.printing = false; document.body.classList.remove('printing');
  $('#printStyles').textContent = '';
  if (viewBeforePrint && viewBeforePrint !== 'print') setView(viewBeforePrint); else paginate();
  viewBeforePrint = null;
}
window.addEventListener('afterprint', endPrint);
/* Android app: files opened with "Open with DraftLy" */
async function takeNativeFile() {
  if (!IS_NATIVE) return;
  try {
    const r = await capCall('DraftlyNative', 'takePendingFile', {});
    if (r && r.data) {
      const bin = atob(r.data), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      openFileObject(new File([bytes], r.name || 'Document.docx', { type: DOCX_MIME }));
    }
  } catch (e) { }
}

/* ---------- backstage ---------- */
function closeBackstage() { $('#backstage').classList.add('hidden'); }
async function openBackstage(page = 'home') {
  await persist();
  const bs = $('#backstage');
  bs.classList.remove('hidden');
  const pages = [['home', 'FileText', 'Home'], ['new', 'FilePlus', 'New'], ['open', 'FolderOpen', 'Open'], ['info', 'Info', 'Info'], ['save', 'Save', 'Save'], ['saveas', 'Download', 'Save As / Export'], ['print', 'Printer', 'Print'], ['share', 'Share2', 'Share'], ['sync', 'History', 'Sync & Devices'], ['options', 'Settings', 'Options']];
  const side = h('div', { class: 'bs-side' }, h('button', { class: 'back', title: 'Back', onclick: closeBackstage, html: icon('ArrowLeft') }));
  pages.forEach(([id, ic, label]) => side.append(h('button', { class: id === page ? 'on' : '', onclick: () => openBackstage(id) }, h('span', { html: icon(ic) }), h('span', { class: 't' }, label))));
  const main = h('div', { class: 'bs-main' });
  bs.innerHTML = '';
  bs.append(side, main);
  await BACKSTAGE[page](main);
}
const tplThumb = t => h('div', { class: 'thumb', html: (t.settings && t.settings.header ? t.settings.header : '') + t.html });
async function recentList(limit) {
  const all = await Store.all();
  const list = h('div', { class: 'recent-list' });
  if (!all.length) list.append(h('p', { class: 'note' }, 'No documents yet.'));
  all.slice(0, limit || 500).forEach(d => {
    const it = h('div', { class: 'recent-item' }, h('span', { class: 'ic', html: icon(d.stub ? 'Download' : 'FileText') }), h('div', null, h('div', { class: 'nm' }, d.title || 'Untitled', doc && d.id === doc.id ? ' (open)' : ''), h('div', { class: 'dt' }, new Date(d.modified || Date.now()).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }), d.stub ? ' · on another device' : '')),
      h('button', { class: 'del', title: 'Delete', html: icon('Trash2'), onclick: async ev => { ev.stopPropagation(); if (confirm(`Delete "${d.title}"${Sync.enabled ? ' from all your devices' : ''}?`)) { await deleteDoc(d.id); openBackstage('open'); } } }));
    it.addEventListener('click', () => openRecord(d.id));
    list.append(it);
  });
  return list;
}
async function folderSection(m) {
  if (IS_NATIVE) { m.append(h('p', { class: 'note' }, 'Files are saved to Documents › DraftLy on this phone.')); return; }
  if (!FS_OK) { m.append(h('p', { class: 'note' }, IS_IOS ? 'On iPhone and iPad, files open in the share sheet: choose "Save to Files" to keep them in a folder.' : 'Files go to your Downloads folder. (Install DraftLy with Chrome or Edge to save straight into Documents.)')); return; }
  const dir = await KV.get('saveDir');
  m.append(h('h3', null, 'Save folder'), h('div', { class: 'sync-status' }, dir ? h('span', null, 'Files are saved to ', h('b', null, dir.name), '. ') : h('span', null, 'No folder chosen yet. Choose your Documents folder (or a DraftLy folder inside it) and every Save and PDF goes there automatically.'),
    h('button', { class: 'btn', style: { marginLeft: '8px' }, onclick: async () => { const d = await SaveFolder.choose(); if (d) { toast('Saving to ' + d.name); openBackstage('save'); } } }, dir ? 'Change folder' : 'Choose folder')));
}
const BACKSTAGE = {
  async home(m) {
    m.append(h('h2', null, 'Good ' + (new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening')));
    await BACKSTAGE.newGrid(m, 4);
    m.append(h('h3', null, 'Recent'), await recentList(12));
  },
  async newGrid(m, n) {
    const g = h('div', { class: 'tpl-grid' });
    TEMPLATES.slice(0, n || 99).forEach(t => g.append(h('button', { class: 'tpl', onclick: () => newDoc({ html: t.html, settings: t.settings ? JSON.parse(JSON.stringify(t.settings)) : {}, title: t.id === 'blank' ? undefined : t.name }) }, tplThumb(t), t.name)));
    m.append(g);
  },
  async new(m) { m.append(h('h2', null, 'New')); await BACKSTAGE.newGrid(m); },
  async open(m) {
    m.append(h('h2', null, 'Open'), h('div', { class: 'bs-actions' }, h('button', { class: 'bs-act', onclick: () => { closeBackstage(); CMD.open(); } }, h('span', { class: 'ic', html: icon('FolderOpen') }), h('b', null, 'Browse…'), h('small', null, '.docx, .html, .txt, .md'))));
    m.append(h('h3', null, 'Documents' + (Sync.enabled ? ' (all devices)' : ' on this device')), await recentList());
  },
  async info(m) {
    const t = docText();
    m.append(h('h2', null, 'Info'));
    const title = h('input', { value: doc.title });
    title.addEventListener('change', () => { doc.title = title.value.trim() || 'Document'; $('#docTitle').value = doc.title; markDirty(); });
    m.append(h('div', { class: 'form' }, h('label', null, 'Title'), title, h('label', null, 'Author'), h('span', null, prefs.author), h('label', null, 'Created'), h('span', null, new Date(doc.created).toLocaleString('en-IN')), h('label', null, 'Last modified'), h('span', null, new Date(doc.modified).toLocaleString('en-IN')), h('label', null, 'Pages'), h('span', null, String(ui.pages)), h('label', null, 'Words'), h('span', null, countWords(t).toLocaleString('en-IN')), h('label', null, 'Comments'), h('span', null, String(Review.commentIds().length)), h('label', null, 'Tracked changes'), h('span', null, String(Review.changes().length))));
    const act = (ic, t, sub, fn) => h('button', { class: 'bs-act', type: 'button', onclick: () => { closeBackstage(); setTimeout(fn, 50); } }, h('span', { class: 'ic', html: icon(ic) }), h('b', null, t), h('small', null, sub));
    m.append(h('h3', null, 'Protect Document'), h('div', { class: 'bs-actions' },
      act(doc.settings.encrypted ? 'FileLock' : 'KeyRound', doc.settings.encrypted ? 'Password: On' : 'Encrypt with Password', doc.settings.encrypted ? 'Change or remove the password' : 'Word file needs a password to open', encryptDialog),
      act('Lock', doc.settings.restrict ? 'Editing Restricted' : 'Restrict Editing', doc.settings.restrict ? 'Stop protection' : 'Read only, or tracked changes only', restrictDialog)));
    m.append(h('h3', null, 'Inspect Document'), h('div', { class: 'bs-actions' }, act('ScanSearch', 'Check for Issues', 'Comments, changes, personal info, hidden data', inspectDialog)));
  },
  async save(m) {
    m.append(h('h2', null, 'Save'), h('p', { class: 'note' }, 'DraftLy saves your work automatically on this device' + (Sync.enabled ? ' and syncs it to your other devices.' : '.') + ' Save writes a Word file (.docx).'));
    m.append(h('div', { class: 'bs-actions' },
      h('button', { class: 'bs-act', onclick: () => CMD.save() }, h('span', { class: 'ic', html: icon('Save') }), h('b', null, 'Save (.docx)'), h('small', null, IS_MAC ? '⌘S' : 'Ctrl+S')),
      h('button', { class: 'bs-act', onclick: () => exportAs('pdf') }, h('span', { class: 'ic', html: icon('FileDown') }), h('b', null, 'Save as PDF'), h('small', null, 'Exact pages, searchable text'))));
    await folderSection(m);
  },
  async saveas(m) {
    m.append(h('h2', null, 'Save As / Export'));
    const act = (ic, t, s, fn) => h('button', { class: 'bs-act', onclick: fn }, h('span', { class: 'ic', html: icon(ic) }), h('b', null, t), h('small', null, s));
    m.append(h('div', { class: 'bs-actions' }, act('FileText', 'Word Document', '.docx', () => exportAs('docx')), act('FileDown', 'PDF', 'Exact pages, searchable text', () => exportAs('pdf')), act('Globe', 'Web Page', '.html', () => exportAs('html')), act('Type', 'Plain Text', '.txt', () => exportAs('txt'))));
    m.append(h('h3', null, 'Convert'), h('div', { class: 'bs-actions' }, act('FileDown', 'Convert a Word file to PDF', 'Pick any .docx; DraftLy opens it and saves the PDF', convertDocxToPdf)));
    await folderSection(m);
  },
  async print(m) {
    m.append(h('h2', null, 'Print'), h('p', { class: 'note' }, `Prints exactly what you see in Print Layout: ${ui.pages} page${ui.pages > 1 ? 's' : ''}, ${doc.settings.pageSize} ${doc.settings.orientation}. Tracked changes print as shown; switch Markup to "No Markup" to hide them. Comment highlights never print.` + (IOS_STANDALONE ? ' On iPhone and iPad, DraftLy prepares the pages and opens the share sheet; tap Print there.' : '')));
    m.append(h('div', { class: 'bs-actions' }, h('button', { class: 'bs-act', onclick: () => { closeBackstage(); setTimeout(CMD.print, 200); } }, h('span', { class: 'ic', html: icon('Printer') }), h('b', null, 'Print'), h('small', null, IS_MAC ? '⌘P' : 'Ctrl+P'))));
  },
  async share(m) {
    m.append(h('h2', null, 'Share'), h('p', { class: 'note' }, 'Send a copy of this document by Mail, Gmail, WhatsApp or AirDrop. Choose Word if the other person needs to edit it, or PDF if they only need to read, print or file it.'));
    m.append(h('div', { class: 'bs-actions' }, shareChoice('docx', 'Share as Word (.docx)', 'Editable in MS Word', 'FileText'), shareChoice('pdf', 'Share as PDF', 'Fixed layout, ready to print', 'FileDown')));
  },
  async sync(m) {
    m.append(h('h2', null, 'Sync & Devices'));
    const st = { off: 'Sync is off', connecting: 'Connecting…', live: 'Live: changes sync in real time', offline: 'Offline: changes will sync when you reconnect', error: 'Sync problem: please sign in again' }[Sync.status];
    if (Sync.enabled) {
      m.append(h('div', { class: 'sync-status' }, h('b', null, st), h('div', null, 'Signed in as ' + Sync.email)));
      const link = Sync.setupLink();
      m.append(h('h3', null, 'Add another device'), h('p', { class: 'note' }, 'Open this link on your other device (send it to yourself by WhatsApp, email or AirDrop). The project details fill in automatically; you only type your password.'),
        h('div', { class: 'bs-actions' }, h('button', { class: 'bs-act', onclick: async () => { try { await navigator.clipboard.writeText(link); toast('Setup link copied'); } catch (e) { prompt('Copy this link', link); } } }, h('span', { class: 'ic', html: icon('Copy') }), h('b', null, 'Copy setup link'), h('small', null, 'Contains no password')),
          navigator.share ? h('button', { class: 'bs-act', onclick: () => navigator.share({ title: 'DraftLy setup', url: link }).catch(() => { }) }, h('span', { class: 'ic', html: icon('Share2') }), h('b', null, 'Send setup link'), h('small', null, 'WhatsApp, Mail, AirDrop')) : null,
          h('button', { class: 'bs-act', onclick: () => { Sync.connect(); toast('Reconnecting…'); setTimeout(() => openBackstage('sync'), 1500); } }, h('span', { class: 'ic', html: icon('History') }), h('b', null, 'Sync now'), h('small', null, 'Reconnect and refresh')),
          h('button', { class: 'bs-act', onclick: () => { if (confirm('Sign out of sync on this device? Documents stay on this device.')) { Sync.signOut(); openBackstage('sync'); } } }, h('span', { class: 'ic', html: icon('X') }), h('b', null, 'Sign out'), h('small', null, 'This device only'))));
      return;
    }
    const pre = Sync.readSetupLink() || (Sync.cfg || {});
    const apiKey = h('input', { value: pre.apiKey || '', placeholder: 'AIza…', autocomplete: 'off', spellcheck: 'false' });
    const dbUrl = h('input', { value: pre.dbUrl || '', placeholder: 'https://your-project-default-rtdb.firebaseio.com', autocomplete: 'off', spellcheck: 'false' });
    const email = h('input', { type: 'email', value: pre.email || '', autocomplete: 'username' });
    const pass = h('input', { type: 'password', autocomplete: 'current-password' });
    const msg = h('div', { class: 'note' });
    const linkIn = h('input', { placeholder: 'Paste the setup link from your Mac here', autocomplete: 'off', spellcheck: 'false' });
    linkIn.addEventListener('input', () => {
      const m = linkIn.value.match(/sync=([A-Za-z0-9+/=%_-]+)/);
      if (!m) return;
      try {
        const c = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
        apiKey.value = c.apiKey || ''; dbUrl.value = c.dbUrl || ''; email.value = c.email || '';
        msg.textContent = 'Setup details filled in. Type your password and tap Sign in.';
        pass.focus();
      } catch (e) { msg.textContent = 'That link could not be read. Copy it again from the Mac (File › Sync & Devices › Copy setup link).'; }
    });
    const go = create => async () => {
      msg.textContent = 'Signing in…';
      try { await Sync.signIn({ apiKey: apiKey.value, dbUrl: dbUrl.value, email: email.value, password: pass.value, create }); toast('Sync is on'); if (location.hash.includes('sync=')) history.replaceState(null, '', location.pathname); openBackstage('sync'); }
      catch (e) { msg.textContent = e.message; }
    };
    m.append(h('div', { class: 'sync-status' }, h('b', null, 'Keep every document in sync across your Mac, iPhone, iPad and Android.'), h('div', null, 'Edits appear on your other open devices within a couple of seconds. Your documents are stored in your own free Firebase project, visible only to you.')));
    m.append(h('div', { class: 'form' }, h('label', null, 'Setup link (other devices)'), linkIn, h('label', null, 'Firebase API key'), apiKey, h('label', null, 'Database URL'), dbUrl, h('label', null, 'Email'), email, h('label', null, 'Password'), pass, h('span'), h('div', { class: 'row', style: { display: 'flex', gap: '8px' } }, h('button', { class: 'btn primary', onclick: go(false) }, 'Sign in'), h('button', { class: 'btn', onclick: go(true) }, 'Create account (first device)'))), msg);
    m.append(h('h3', null, 'One-time setup (about 10 minutes, on your Mac)'), h('div', { class: 'note', html: `<ol>
<li>Go to <b>console.firebase.google.com</b>, sign in with your Google account, and click <b>Create a project</b> (name it "draftly"; Google Analytics is not needed).</li>
<li>In the left menu open <b>Build › Authentication › Get started</b>, choose <b>Email/Password</b>, switch it on and save.</li>
<li>Open <b>Build › Realtime Database › Create database</b>, pick the location <b>Singapore (asia-southeast1)</b> and start in <b>locked mode</b>.</li>
<li>In the database's <b>Rules</b> tab, replace everything with the rules below and click <b>Publish</b>:<pre style="background:var(--hover);padding:8px;border-radius:4px;white-space:pre-wrap">{ "rules": { "users": { "$uid": {
  ".read": "auth != null && auth.uid === $uid",
  ".write": "auth != null && auth.uid === $uid" } } } }</pre></li>
<li>Copy the database URL shown at the top of the <b>Data</b> tab into "Database URL" above.</li>
<li>Click the gear icon › <b>Project settings</b>, then under "Your apps" click the <b>&lt;/&gt;</b> (Web) icon, register an app named DraftLy, and copy the <b>apiKey</b> value into "Firebase API key" above.</li>
<li>Type your email and a password, then click <b>Create account</b>. On your other devices, use <b>Sign in</b> (or open the setup link this page gives you).</li></ol>` }));
  },
  async options(m) {
    m.append(h('h2', null, 'Options'));
    const author = h('input', { value: prefs.author });
    author.addEventListener('change', () => { prefs.author = author.value.trim() || 'Author'; savePrefs(); });
    const set = h('select', null, ...Object.keys(STYLE_SETS).map(k => h('option', { value: k, selected: prefs.styleSet === k }, k)));
    set.addEventListener('change', () => { prefs.styleSet = set.value; savePrefs(); toast('New documents will use the ' + set.value + ' style set'); });
    const dark = h('input', { type: 'checkbox', style: { width: '20px' } }); dark.checked = prefs.dark;
    dark.addEventListener('change', () => CMD.toggleDark());
    const auto = h('input', { type: 'checkbox', style: { width: '20px' } }); auto.checked = prefs.autoDocx !== false;
    auto.addEventListener('change', () => { prefs.autoDocx = auto.checked; savePrefs(); renderAutoSave(); });
    m.append(h('div', { class: 'form' }, h('label', null, 'Your name'), author, h('label', null, 'Style set for new documents'), set, h('label', null, 'Dark mode'), dark,
      FS_OK ? h('label', null, 'Keep saved .docx files up to date automatically') : null, FS_OK ? auto : null,
      h('label', null, 'Sound when DraftLy opens'), (() => { const c = h('input', { type: 'checkbox', style: { width: '20px' } }); c.checked = prefs.launchSound !== false; c.addEventListener('change', () => { prefs.launchSound = c.checked; savePrefs(); }); return c; })()));
    m.append(h('p', { class: 'note' }, 'DraftLy remembers your last custom page size, margins, columns, paragraph spacing, table size, watermark and colours on this device. ',
      h('button', { class: 'btn', type: 'button', onclick: () => { prefs.last = {}; prefs.recentColors = []; delete prefs.defaultPage; delete prefs.pasteMode; savePrefs(); toast('Remembered settings cleared'); } }, 'Clear remembered settings')));
    await folderSection(m);
    m.append(h('h3', null, 'Theme'));
    const grid = h('div', { class: 'theme-grid' });
    Object.entries(THEMES).forEach(([k, t]) => {
      const card = h('button', { type: 'button', class: 'theme-card' + ((prefs.theme || 'ocean') === k ? ' on' : '') },
        h('div', { class: 'tc-top', style: { background: t.tb, color: t.tbText || '#fff' } }, h('i'), h('b')),
        h('div', { class: 'tc-body', style: { background: t.canvas } }, h('em', { style: { background: t.side } }), h('span')),
        h('div', { class: 'tc-name' }, h('span', { style: { color: t.accent2 } }, '● '), t.name));
      card.addEventListener('click', () => { setTheme(k); openBackstage('options'); });
      grid.append(card);
    });
    m.append(grid);
    m.append(h('h3', null, 'About'), h('p', { class: 'note' }, 'DraftLy works offline. Documents are kept in this browser or app on each device' + (Sync.enabled ? ' and synced through your Firebase project.' : '.') + ' Device ID: ' + Sync.deviceId));
    m.append(h('h3', null, 'Reset'), h('button', { class: 'btn', onclick: async () => { if (confirm('Delete ALL DraftLy documents stored on this device? Synced copies stay in your Firebase project.')) { indexedDB.deleteDatabase('draftly'); localStorage.removeItem(PREFS_KEY); location.reload(); } } }, 'Clear this device'));
  }
};

/* ---------- sync wiring ---------- */
const syncBusy = new Set();
async function receiveRemote(id, meta) {
  if (syncBusy.has(id)) return;
  syncBusy.add(id);
  try {
    const local = await Store.get(id);
    const isOpen = doc && doc.id === id;
    if (!meta) { // deleted on another device
      if (local && local.syncedAt && !isOpen) await Store.del(id);
      if (isOpen) { doc.syncedAt = 0; toast('This document was deleted on another device. It is still open here.'); }
      return;
    }
    if (meta.device === Sync.deviceId) return;
    const localMod = isOpen ? doc.modified : (local ? local.modified || 0 : 0);
    if (local && meta.modified <= localMod) return;
    if (!local) { await Store.put({ id, title: meta.title, modified: meta.modified, created: meta.modified, stub: true, syncedAt: meta.modified }); return; }
    if (!isOpen && local.stub) { await Store.put(Object.assign(local, { title: meta.title, modified: meta.modified })); return; }
    const remote = await Sync.pull(id);
    if (!remote) return;
    const cur = isOpen ? doc : local;
    const unsynced = (cur.modified || 0) > (cur.syncedAt || 0);
    if (unsynced) {
      const copy = isOpen ? record() : local;
      const cid = uid();
      await Store.put(Object.assign({}, copy, { id: cid, title: copy.title + ' (conflict copy ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ')', syncedAt: 0, modified: Date.now() }));
      Sync.push(await Store.get(cid), true);
      toast('Edited on two devices at once. Your version was kept as a conflict copy.', 6000);
    }
    const rec = Object.assign({ id }, remote, { syncedAt: remote.modified, stub: false });
    await Store.put(rec);
    if (isOpen) applyRemoteToOpen(rec);
    queueDocxRefresh(id);
  } catch (e) { console.warn('sync receive', e); }
  finally { syncBusy.delete(id); }
}
function applyRemoteToOpen(rec) {
  const sel = saveSel(), focused = document.activeElement === editor, scroll = $('#canvas').scrollTop;
  editor.innerHTML = rec.html || '<p><br></p>';
  normalize();
  const themeChanged = JSON.stringify(doc.settings.theme) !== JSON.stringify((rec.settings || {}).theme);
  doc.settings = Object.assign(DEFAULT_SETTINGS(), rec.settings || {});
  doc.comments = rec.comments || {};
  doc.title = rec.title || doc.title; doc.modified = rec.modified; doc.syncedAt = rec.modified;
  $('#docTitle').value = doc.title;
  if (themeChanged) applyDocStyles();
  if (focused) restoreSel(sel);
  History.record();
  paginate(); refreshPanes(); updateWordCount();
  $('#canvas').scrollTop = scroll;
  setSaveState('Updated from another device');
}
async function mergeRemote(all) {
  const locals = await Store.all();
  for (const [id, meta] of Object.entries(all || {})) await receiveRemote(id, meta);
  for (const l of locals) {
    if (all && all[l.id]) { if ((l.modified || 0) > (all[l.id].modified || 0) && !l.stub) Sync.push(l, true); continue; }
    if (l.syncedAt && !(doc && doc.id === l.id)) await Store.del(l.id);
    else if (!l.stub) Sync.push(l, true);
  }
  if (!$('#backstage').classList.contains('hidden')) { const on = $('.bs-side button.on'); if (on && /Open|Home/.test(on.textContent)) openBackstage(/Open/.test(on.textContent) ? 'open' : 'home'); }
}
Sync.on(async (type, data) => {
  if (type === 'status') {
    const on = $('.bs-side button.on');
    if (on && /Sync/.test(on.textContent) && !$('#backstage').classList.contains('hidden') && !$('.bs-main input[type=password]')) openBackstage('sync');
    if (data === 'offline') setSaveState('Offline · saved on this device');
    else if (data === 'error') setSaveState('Sync needs sign-in');
    else if (data === 'live' && doc && (doc.syncedAt || 0) >= doc.modified) setSaveState('Saved · synced');
  }
  if (type === 'full') mergeRemote(data);
  if (type === 'meta') receiveRemote(data.id, data.meta);
  if (type === 'pushed') {
    if (doc && data.id === doc.id) doc.syncedAt = Math.max(doc.syncedAt || 0, data.modified);
    const rec = await Store.get(data.id);
    if (rec && (rec.modified || 0) <= data.modified && (rec.syncedAt || 0) < data.modified) { rec.syncedAt = data.modified; await Store.put(rec); }
    if (doc && data.id === doc.id && doc.modified <= doc.syncedAt) setSaveState('Saved · synced');
  }
  if (type === 'pushfail' && doc && data.id === doc.id) setSaveState('Saved on this device · will sync later');
  if (type === 'online' && doc) persist(true);
});

/* ---------- startup ---------- */
(async function init() {
  document.body.classList.toggle('dark', !!prefs.dark);
  applyTheme(prefs.theme || 'ocean');
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { }
  editor.lang = prefs.lang || 'en-IN';
  Review.init(editor, () => prefs.author, () => afterChange());
  setMarkup('all');
  const qaIcons = { print: 'Printer', savePdf: 'FileDown', save: 'Save', undo: 'Undo2', redo: 'Redo2', findPane: 'Search', share: 'Share2', toggleDark: 'Moon', readMode: 'BookOpen', printLayout: 'FileText', webLayout: 'Globe' };
  $$('[data-cmd]').forEach(b => {
    if (qaIcons[b.dataset.cmd]) b.innerHTML = icon(qaIcons[b.dataset.cmd]);
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', () => CMD[b.dataset.cmd] && CMD[b.dataset.cmd]());
  });
  $('#autoSave').addEventListener('mousedown', e => e.preventDefault()); $('#autoSave').addEventListener('click', toggleAutoSave); renderAutoSave();
  $('#ribbon').addEventListener('mousedown', e => { if (!/INPUT|SELECT|TEXTAREA|OPTION/.test(e.target.tagName)) e.preventDefault(); });
  $('#zoomRange').addEventListener('input', e => { ui.fitWidth = false; setZoom(+e.target.value / 100); });
  $('#docTitle').addEventListener('change', e => { doc.title = e.target.value.trim() || 'Document'; e.target.value = doc.title; document.title = doc.title + ' · DraftLy'; markDirty(); });
  $('#docTitle').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); editor.focus(); } });
  $('#fileOpen').addEventListener('change', e => { const f = e.target.files[0]; if (f) openFileObject(f); e.target.value = ''; });
  $('#imgOpen').addEventListener('change', e => { [...e.target.files].forEach(insertImageFile); e.target.value = ''; });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist(true); });
  window.addEventListener('pagehide', () => persist(true));

  const all = await Store.all();
  docCounter = all.length + 1;
  const last = prefs.lastDoc && all.find(d => d.id === prefs.lastDoc && !d.stub);
  const first = last || all.find(d => !d.stub);
  if (first) await loadDoc(first);
  else await newDoc({ title: 'Document1' });
  closeBackstage();
  if (innerWidth < 760) { ui.fitWidth = true; setView('web'); }
  else { if (prefs.zoom === 'width') ui.fitWidth = true; else if (typeof prefs.zoom === 'number') ui.zoom = prefs.zoom; ui.ruler = !!prefs.ruler; }
  renderTabs(); renderRibbon(); applyZoom();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => paginate());
  if (Sync.readSetupLink()) openBackstage('sync');
  if (IS_NATIVE) { takeNativeFile(); window.addEventListener('draftlyopenfile', takeNativeFile); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') takeNativeFile(); }); }
  if ('launchQueue' in window) launchQueue.setConsumer(async p => { for (const hnd of p.files || []) openFileObject(await hnd.getFile(), hnd); });
  if (Sync.enabled) Sync.connect();
  if ('serviceWorker' in navigator && !IS_NATIVE && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => { });
  window.DraftLy = { get doc() { return doc; }, editor, exportAs, buildDocx, openFileObject, newDoc, paginate, Review, History, Sync };
})();
