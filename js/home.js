/* DraftLy: start screen, template gallery, chart and flowchart editors, pinch-to-zoom */

/* ================= Charts ================= */
const CHART_COLORS = ['#2F5597', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47', '#264478', '#9E480E', '#636363', '#997300'];
const fmtNum = v => (Math.round(v * 100) / 100).toLocaleString('en-IN');
function niceStep(range, n) { const raw = range / n, p = Math.pow(10, Math.floor(Math.log10(raw || 1))), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
function renderChart(m, scale = 2) {
  const W = m.w || 640, H = m.h || 380;
  const c = document.createElement('canvas'); c.width = W * scale; c.height = H * scale;
  const x = c.getContext('2d'); x.scale(scale, scale);
  const font = (s, b) => `${b ? '600 ' : ''}${s}px Calibri, Carlito, "Segoe UI", Arial, sans-serif`;
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  let top = 14;
  if (m.title) { x.fillStyle = '#262626'; x.font = font(17, true); x.textAlign = 'center'; x.textBaseline = 'top'; x.fillText(m.title, W / 2, top); top += 32; }
  const series = (m.series || []).filter(s => s && s.values), labels = m.labels || [];
  const pie = m.type === 'pie' || m.type === 'doughnut';
  // legend
  const legend = pie ? labels.map((l, i) => [l, CHART_COLORS[i % CHART_COLORS.length]]) : series.map((s, i) => [s.name, CHART_COLORS[i % CHART_COLORS.length]]);
  x.font = font(12); x.textBaseline = 'middle'; x.textAlign = 'left';
  const legW = legend.reduce((a, [l]) => a + x.measureText(l || '').width + 30, 0);
  let lx = Math.max(10, (W - legW) / 2); const ly = H - 16;
  legend.forEach(([l, col]) => { x.fillStyle = col; x.fillRect(lx, ly - 5, 10, 10); x.fillStyle = '#404040'; x.fillText(l || '', lx + 15, ly); lx += x.measureText(l || '').width + 30; });
  const bottom = H - 34;
  if (pie) {
    const vals = (series[0] ? series[0].values : []).map(v => Math.max(0, +v || 0)), tot = vals.reduce((a, b) => a + b, 0) || 1;
    const cx = W / 2, cy = (top + bottom) / 2, r = Math.max(20, Math.min(W / 2 - 90, (bottom - top) / 2 - 10));
    let a0 = -Math.PI / 2;
    vals.forEach((v, i) => {
      const a1 = a0 + v / tot * Math.PI * 2;
      x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, r, a0, a1); x.closePath(); x.fillStyle = CHART_COLORS[i % CHART_COLORS.length]; x.fill();
      x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke();
      if (v / tot > 0.04) { const am = (a0 + a1) / 2, rr = m.type === 'doughnut' ? r * 0.78 : r * 0.64; x.fillStyle = '#fff'; x.font = font(12, true); x.textAlign = 'center'; x.fillText(Math.round(v / tot * 100) + '%', cx + Math.cos(am) * rr, cy + Math.sin(am) * rr); }
      a0 = a1;
    });
    if (m.type === 'doughnut') { x.beginPath(); x.arc(cx, cy, r * 0.55, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill(); }
    return c.toDataURL('image/png');
  }
  const all = series.flatMap(s => s.values.map(v => +v || 0));
  let max = Math.max(0, ...all), min = Math.min(0, ...all);
  if (max === min) max = min + 1;
  const step = niceStep(max - min, 5); max = Math.ceil(max / step) * step; min = Math.floor(min / step) * step;
  const horiz = m.type === 'bar';
  x.font = font(11);
  const yLab = []; for (let v = min; v <= max + step / 2; v += step) yLab.push(v);
  const labW = horiz ? Math.min(140, Math.max(...labels.map(l => x.measureText(l || '').width), 20) + 12) : Math.max(...yLab.map(v => x.measureText(fmtNum(v)).width)) + 14;
  const L = 16 + labW, R = W - 18, T = top + 6, B = bottom - (horiz ? 18 : 22);
  const val2 = v => horiz ? L + (v - min) / (max - min) * (R - L) : B - (v - min) / (max - min) * (B - T);
  // grid and value axis
  x.strokeStyle = '#D9D9D9'; x.lineWidth = 1; x.fillStyle = '#595959'; x.font = font(11);
  yLab.forEach(v => {
    const p = Math.round(val2(v)) + 0.5;
    x.beginPath(); if (horiz) { x.moveTo(p, T); x.lineTo(p, B); } else { x.moveTo(L, p); x.lineTo(R, p); } x.stroke();
    if (horiz) { x.textAlign = 'center'; x.textBaseline = 'top'; x.fillText(fmtNum(v), p, B + 5); } else { x.textAlign = 'right'; x.textBaseline = 'middle'; x.fillText(fmtNum(v), L - 6, p); }
  });
  const n = Math.max(1, labels.length), band = (horiz ? B - T : R - L) / n;
  x.fillStyle = '#404040'; x.font = font(12);
  labels.forEach((l, i) => {
    const mid = (horiz ? T : L) + band * (i + 0.5);
    if (horiz) { x.textAlign = 'right'; x.textBaseline = 'middle'; x.fillText(l, L - 8, mid); }
    else { x.textAlign = 'center'; x.textBaseline = 'top'; let t = l || ''; while (t.length > 3 && x.measureText(t).width > band - 4) t = t.slice(0, -2); if (t !== l) t += '…'; x.fillText(t, mid, B + 6); }
  });
  const zero = val2(0);
  if (m.type === 'column' || m.type === 'bar' || !m.type) {
    const k = Math.max(1, series.length), gw = band * 0.72, bw = gw / k;
    series.forEach((s, si) => {
      x.fillStyle = CHART_COLORS[si % CHART_COLORS.length];
      s.values.forEach((v, i) => {
        if (i >= n) return;
        const p0 = (horiz ? T : L) + band * i + (band - gw) / 2 + bw * si, pv = val2(+v || 0);
        if (horiz) x.fillRect(Math.min(zero, pv), p0 + 1, Math.abs(pv - zero), bw - 2); else x.fillRect(p0 + 1, Math.min(zero, pv), bw - 2, Math.abs(pv - zero));
      });
    });
  } else {
    series.forEach((s, si) => {
      const col = CHART_COLORS[si % CHART_COLORS.length];
      const pts = s.values.slice(0, n).map((v, i) => [L + band * (i + 0.5), val2(+v || 0)]);
      if (m.type === 'area' && pts.length) { x.beginPath(); x.moveTo(pts[0][0], zero); pts.forEach(p => x.lineTo(p[0], p[1])); x.lineTo(pts[pts.length - 1][0], zero); x.closePath(); x.globalAlpha = 0.35; x.fillStyle = col; x.fill(); x.globalAlpha = 1; }
      x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.strokeStyle = col; x.lineWidth = 2.5; x.stroke();
      pts.forEach(p => { x.beginPath(); x.arc(p[0], p[1], 3.5, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 2; x.stroke(); });
    });
  }
  x.strokeStyle = '#BFBFBF'; x.beginPath(); if (horiz) { x.moveTo(Math.round(zero) + 0.5, T); x.lineTo(Math.round(zero) + 0.5, B); } else { x.moveTo(L, Math.round(zero) + 0.5); x.lineTo(R, Math.round(zero) + 0.5); } x.stroke();
  return c.toDataURL('image/png');
}
const DEFAULT_CHART = () => ({ type: 'column', title: 'Matters by Quarter', labels: ['Q1', 'Q2', 'Q3', 'Q4'], series: [{ name: 'Civil', values: [12, 18, 15, 22] }, { name: 'Criminal', values: [6, 9, 7, 11] }, { name: 'Property', values: [9, 12, 14, 17] }] });
function chartImgHtml(m, wIn = 6) { return `<img class="chart" alt="${esc(m.title || 'Chart')}" data-chart="${esc(JSON.stringify(m))}" src="${renderChart(m)}" style="width:${wIn}in">`; }
function chartDialog(img) {
  let m = img ? JSON.parse(img.getAttribute('data-chart') || 'null') || DEFAULT_CHART() : (prefs.last && prefs.last.chartType ? Object.assign(DEFAULT_CHART(), { type: prefs.last.chartType }) : DEFAULT_CHART());
  restoreRange(); const saved = getRange() && getRange().cloneRange();
  const type = h('select', null, ...[['column', 'Column'], ['bar', 'Bar'], ['line', 'Line'], ['area', 'Area'], ['pie', 'Pie'], ['doughnut', 'Doughnut']].map(([v, l]) => h('option', { value: v, selected: m.type === v }, l)));
  const title = h('input', { value: m.title || '' });
  const grid = h('table', { class: 'chart-grid' }), prev = h('img', { class: 'chart-prev' });
  let tm = null;
  const read = () => {
    const rows = [...grid.rows];
    const names = [...rows[0].cells].slice(1).map(c => c.firstChild.value);
    m = { type: type.value, title: title.value, labels: rows.slice(1).map(r => r.cells[0].firstChild.value), series: names.map((nm, j) => ({ name: nm, values: rows.slice(1).map(r => parseFloat(String(r.cells[j + 1].firstChild.value).replace(/,/g, '')) || 0) })) };
  };
  const preview = () => { clearTimeout(tm); tm = setTimeout(() => { read(); prev.src = renderChart(m, 1); }, 120); };
  const inp = (v, cls) => { const i = h('input', { value: v, class: cls || '' }); i.addEventListener('input', preview); return i; };
  const build = () => {
    grid.innerHTML = '';
    grid.append(h('tr', null, h('th', null, ''), ...m.series.map(s => h('th', null, inp(s.name, 'sn')))));
    m.labels.forEach((l, i) => grid.append(h('tr', null, h('td', null, inp(l, 'lb')), ...m.series.map(s => h('td', null, inp(s.values[i] ?? 0, 'num'))))));
    preview();
  };
  const tool = (t, fn) => h('button', { class: 'btn', type: 'button', onclick: () => { read(); fn(); build(); } }, t);
  build();
  type.addEventListener('change', preview); title.addEventListener('input', preview);
  modal(img ? 'Edit Chart' : 'Insert Chart', h('div', { class: 'chart-dlg' },
    h('div', { class: 'g2' }, field('Chart type', type), field('Chart title', title)),
    h('div', { class: 'chart-tools' }, tool('+ Row', () => { m.labels.push('Item ' + (m.labels.length + 1)); m.series.forEach(s => s.values.push(0)); }), tool('− Row', () => { if (m.labels.length > 1) { m.labels.pop(); m.series.forEach(s => s.values.pop()); } }), tool('+ Series', () => m.series.push({ name: 'Series ' + (m.series.length + 1), values: m.labels.map(() => 0) })), tool('− Series', () => { if (m.series.length > 1) m.series.pop(); })),
    h('div', { class: 'chart-wrap' }, grid), h('p', { class: 'note' }, 'Pie and doughnut charts use the first data column. Double-click the chart in the document to edit it again.'), prev), [
    { label: 'Cancel' },
    { label: img ? 'Update Chart' : 'Insert Chart', primary: true, fn: () => {
      read(); rememberLast('chartType', m.type);
      if (img) { mutate(() => { img.src = renderChart(m); img.setAttribute('data-chart', JSON.stringify(m)); img.alt = m.title || 'Chart'; }); return; }
      if (saved) { lastRange = saved; restoreRange(); }
      insertHTML(chartImgHtml(m, Math.min(6, geom().cw / 96)) + '<p><br></p>');
    } }], { wide: true });
}

/* ================= Flowcharts ================= */
const FLOW_STYLE = { start: ['#E2EFDA', '#548235'], end: ['#E2EFDA', '#548235'], step: ['#DEEBF7', '#2F5597'], decision: ['#FFF2CC', '#BF9000'] };
function renderFlow(m, scale = 2) {
  const steps = (m.steps || []).filter(s => s.text && s.text.trim());
  const meas = document.createElement('canvas').getContext('2d');
  const font = (s, b) => `${b ? '600 ' : ''}${s}px Calibri, Carlito, "Segoe UI", Arial, sans-serif`;
  meas.font = font(14);
  const wrap = (t, w) => { const words = t.split(/\s+/), lines = []; let cur = ''; words.forEach(wd => { const tst = cur ? cur + ' ' + wd : wd; if (meas.measureText(tst).width > w && cur) { lines.push(cur); cur = wd; } else cur = tst; }); if (cur) lines.push(cur); return lines; };
  const BW = 230, GAP = 40, SIDE = steps.some(s => s.kind === 'decision' && s.no) ? 270 : 0;
  const nodes = steps.map(s => { const lines = wrap(s.text, s.kind === 'decision' ? BW - 70 : BW - 26); const hh = s.kind === 'decision' ? Math.max(86, lines.length * 18 + 44) : Math.max(s.kind === 'step' ? 50 : 44, lines.length * 18 + 22); return { s, lines, hh }; });
  const titleH = m.title ? 40 : 10;
  const H = titleH + nodes.reduce((a, n) => a + n.hh, 0) + GAP * Math.max(0, nodes.length - 1) + 20, W = BW + 60 + SIDE;
  const c = document.createElement('canvas'); c.width = W * scale; c.height = H * scale;
  const x = c.getContext('2d'); x.scale(scale, scale);
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  if (m.title) { x.fillStyle = '#262626'; x.font = font(17, true); x.textAlign = 'center'; x.textBaseline = 'top'; x.fillText(m.title, W / 2 - SIDE / 2, 10); }
  const cx = 30 + BW / 2;
  const arrow = (x1, y1, x2, y2, label, lp) => {
    x.strokeStyle = '#404040'; x.fillStyle = '#404040'; x.lineWidth = 1.6;
    x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1); x.beginPath(); x.moveTo(x2, y2); x.lineTo(x2 - 9 * Math.cos(a - 0.4), y2 - 9 * Math.sin(a - 0.4)); x.lineTo(x2 - 9 * Math.cos(a + 0.4), y2 - 9 * Math.sin(a + 0.4)); x.closePath(); x.fill();
    if (label) { x.font = font(12, true); x.fillStyle = '#595959'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(label, lp[0], lp[1]); }
  };
  const textIn = (lines, mx, my) => { x.fillStyle = '#1F1F1F'; x.font = font(14); x.textAlign = 'center'; x.textBaseline = 'middle'; lines.forEach((l, i) => x.fillText(l, mx, my + (i - (lines.length - 1) / 2) * 18)); };
  const box = (kind, x0, y0, w, hh) => {
    const [fill, line] = FLOW_STYLE[kind] || FLOW_STYLE.step;
    x.fillStyle = fill; x.strokeStyle = line; x.lineWidth = 1.8; x.beginPath();
    if (kind === 'decision') { x.moveTo(x0 + w / 2, y0); x.lineTo(x0 + w, y0 + hh / 2); x.lineTo(x0 + w / 2, y0 + hh); x.lineTo(x0, y0 + hh / 2); x.closePath(); }
    else { const r = kind === 'step' ? 6 : hh / 2; x.moveTo(x0 + r, y0); x.arcTo(x0 + w, y0, x0 + w, y0 + hh, r); x.arcTo(x0 + w, y0 + hh, x0, y0 + hh, r); x.arcTo(x0, y0 + hh, x0, y0, r); x.arcTo(x0, y0, x0 + w, y0, r); x.closePath(); }
    x.fill(); x.stroke();
  };
  let y = titleH;
  nodes.forEach((n, i) => {
    box(n.s.kind, 30, y, BW, n.hh); textIn(n.lines, cx, y + n.hh / 2);
    if (n.s.kind === 'decision' && n.s.no) {
      const lines = wrap(n.s.no, 190), bh = Math.max(50, lines.length * 18 + 22), bx = 30 + BW + 60, by = y + n.hh / 2 - bh / 2;
      arrow(30 + BW, y + n.hh / 2, bx, y + n.hh / 2, 'No', [30 + BW + 12, y + n.hh / 2 - 12]);
      box('step', bx, by, 210, bh); textIn(lines, bx + 105, by + bh / 2);
    }
    if (i < nodes.length - 1) arrow(cx, y + n.hh, cx, y + n.hh + GAP, n.s.kind === 'decision' ? 'Yes' : '', [cx + 8, y + n.hh + GAP / 2]);
    y += n.hh + GAP;
  });
  return c.toDataURL('image/png');
}
const DEFAULT_FLOW = () => ({ title: 'Legal Notice to Suit', steps: [{ kind: 'start', text: 'Client instructions received' }, { kind: 'step', text: 'Draft and issue legal notice by Speed Post / Courier' }, { kind: 'decision', text: 'Reply or payment within 15 days?', no: 'Proceed to file suit / complaint' }, { kind: 'step', text: 'Negotiate settlement and record terms' }, { kind: 'end', text: 'Close the matter' }] });
function flowImgHtml(m, wIn) { return `<img class="flow" alt="${esc(m.title || 'Flowchart')}" data-flow="${esc(JSON.stringify(m))}" src="${renderFlow(m)}" style="width:${wIn || 4.6}in">`; }
function flowDialog(img) {
  let m = img ? JSON.parse(img.getAttribute('data-flow') || 'null') || DEFAULT_FLOW() : DEFAULT_FLOW();
  restoreRange(); const saved = getRange() && getRange().cloneRange();
  const title = h('input', { value: m.title || '' });
  const list = h('div', { class: 'flow-rows' }), prev = h('img', { class: 'chart-prev' });
  let tm = null;
  const read = () => { m = { title: title.value, steps: [...list.children].map(r => ({ kind: r.querySelector('select').value, text: r.querySelector('.ft').value, no: r.querySelector('.fn2').value })) }; };
  const preview = () => { clearTimeout(tm); tm = setTimeout(() => { read(); prev.src = renderFlow(m, 1); }, 120); };
  const row = s => {
    const sel = h('select', null, ...[['start', 'Start'], ['step', 'Step'], ['decision', 'Decision'], ['end', 'End']].map(([v, l]) => h('option', { value: v, selected: s.kind === v }, l)));
    const t = h('input', { class: 'ft', value: s.text || '', placeholder: 'Text in the shape' });
    const no = h('input', { class: 'fn2', value: s.no || '', placeholder: 'If No, then… (optional)' });
    const upd = () => { no.style.display = sel.value === 'decision' ? '' : 'none'; preview(); };
    sel.addEventListener('change', upd); t.addEventListener('input', preview); no.addEventListener('input', preview);
    const r = h('div', { class: 'flow-row' }, sel, t, no,
      h('button', { class: 'x', type: 'button', title: 'Move up', html: icon('ChevronUp'), onclick: () => { if (r.previousElementSibling) { list.insertBefore(r, r.previousElementSibling); preview(); } } }),
      h('button', { class: 'x', type: 'button', title: 'Remove', html: icon('X'), onclick: () => { r.remove(); preview(); } }));
    upd(); return r;
  };
  m.steps.forEach(s => list.append(row(s)));
  title.addEventListener('input', preview);
  preview();
  modal(img ? 'Edit Flowchart' : 'Insert Flowchart', h('div', { class: 'chart-dlg' }, field('Title', title), list,
    h('div', { class: 'chart-tools' }, h('button', { class: 'btn', type: 'button', onclick: () => { list.append(row({ kind: 'step', text: '' })); list.lastChild.querySelector('.ft').focus(); } }, '+ Add step')),
    h('p', { class: 'note' }, 'Steps run top to bottom. A Decision can send "No" to a side box. Double-click the flowchart in the document to edit it again.'), prev), [
    { label: 'Cancel' },
    { label: img ? 'Update Flowchart' : 'Insert Flowchart', primary: true, fn: () => {
      read();
      if (img) { mutate(() => { img.src = renderFlow(m); img.setAttribute('data-flow', JSON.stringify(m)); }); return; }
      if (saved) { lastRange = saved; restoreRange(); }
      insertHTML(flowImgHtml(m) + '<p><br></p>');
    } }], { wide: true });
}
editor.addEventListener('dblclick', e => {
  const t = e.target;
  if (t.tagName === 'IMG' && t.classList.contains('chart')) { e.preventDefault(); chartDialog(t); }
  else if (t.tagName === 'IMG' && t.classList.contains('flow')) { e.preventDefault(); flowDialog(t); }
});

/* ================= More templates ================= */
const cell = (t, s) => `<td style="border:0.75pt solid #8EAADB;padding:4px 8px;${s || ''}">${t}</td>`;
const hcell = t => `<td style="border:0.75pt solid #2F5597;padding:4px 8px;background-color:#2F5597;color:#ffffff"><b>${t}</b></td>`;
const EXTRA_TEMPLATES = [
  { id: 'resume', cat: 'Business', name: 'Resume', settings: { theme: Object.assign({}, STYLE_SETS.Modern), margins: { top: 0.8, bottom: 0.8, left: 0.9, right: 0.9 } }, html:
    `<p style="text-align:center;margin:0"><span style="font-size:24pt"><b>[YOUR NAME]</b></span></p><p style="text-align:center">[Designation] | [City] | [Phone] | [Email] | [LinkedIn]</p><hr><h2>Profile</h2><p>[Two or three lines on your experience, practice areas and strengths.]</p><h2>Experience</h2><p><b>[Role], [Organisation]</b> <span style="color:#595959">([Month Year] to [Month Year])</span></p><ul><li>[Key responsibility or achievement]</li><li>[Key responsibility or achievement]</li></ul><p><b>[Role], [Organisation]</b> <span style="color:#595959">([Month Year] to [Month Year])</span></p><ul><li>[Key responsibility or achievement]</li></ul><h2>Education</h2><p><b>[Degree]</b>, [Institution], [Year]</p><h2>Skills</h2><ul><li>[Skill]</li><li>[Skill]</li><li>[Language]</li></ul>` },
  { id: 'cover', cat: 'Business', name: 'Cover Letter', html: `<p>[Your Name]<br>[Address]<br>[Phone] | [Email]</p><p>[Date]</p><p>[Recipient Name]<br>[Title]<br>[Organisation]<br>[Address]</p><p>Dear [Recipient Name],</p><p>[Opening: the position you are applying for and how you came to know of it.]</p><p>[Middle: your relevant experience and why you are a good fit.]</p><p>[Closing: thank the reader and request a meeting.]</p><p>Sincerely,</p><p><br></p><p>[Your Name]</p>` },
  { id: 'feebill', cat: 'Legal', name: 'Professional Fee Bill', get settings() { return { header: typeof AKH_HEADER !== 'undefined' ? AKH_HEADER : '', margins: { top: 1, bottom: 1, left: 1, right: 1 }, theme: Object.assign({}, STYLE_SETS.Legal) }; }, html:
    `<p style="text-align:center"><b><u>PROFESSIONAL FEE BILL</u></b></p><p>Bill No.: [AKH/FB/__/${new Date().getFullYear()}]<span style="float:right">Date: [Date]</span></p><p>To,<br>[Client Name]<br>[Address]</p><p><b>Matter:</b> [Case / matter details]</p><table style="width:100%;border-collapse:collapse"><tr>${hcell('Sl. No.')}${hcell('Particulars')}${hcell('Amount (Rs.)')}</tr><tr>${cell('1.')}${cell('[Professional fee for drafting and issuing legal notice]')}${cell('[0.00]', 'text-align:right')}</tr><tr>${cell('2.')}${cell('[Appearance / consultation]')}${cell('[0.00]', 'text-align:right')}</tr><tr>${cell('')}${cell('<b>Total</b>')}${cell('<b>[0.00]</b>', 'text-align:right')}</tr></table><p>Amount in words: Rupees [amount in words] only.</p><p><b>Payment details:</b><br>Account Name: [ ]<br>Bank and Branch: [ ]<br>Account No.: [ ]<br>IFSC: [ ]<br>UPI: [ ]</p><p style="text-align:right"><br>ANIRUDH K H<br>Advocate</p>` },
  { id: 'minutes', cat: 'Business', name: 'Meeting Minutes', html: `<p class="s-Title">Minutes of Meeting</p><p><b>Date:</b> [Date] &nbsp; <b>Time:</b> [Time] &nbsp; <b>Venue:</b> [Venue]</p><p><b>Present:</b> [Names]</p><h2>Agenda</h2><ol><li>[Item]</li><li>[Item]</li></ol><h2>Discussion</h2><p>[Summary of discussion]</p><h2>Decisions and Action Points</h2><table style="width:100%;border-collapse:collapse"><tr>${hcell('Action')}${hcell('Owner')}${hcell('Due by')}</tr><tr>${cell('[Action]')}${cell('[Name]')}${cell('[Date]')}</tr><tr>${cell('[Action]')}${cell('[Name]')}${cell('[Date]')}</tr></table><p><br>Next meeting: [Date]</p>` },
  { id: 'list', cat: 'Personal', name: 'Make a List', html: `<h1>[List Title]</h1><ol><li>[To write your list, just tap here and start typing.]</li><li>[Item]</li><li>[Item]</li><li>[Item]</li></ol><p>[Notes]</p>` },
  { id: 'journal', cat: 'Personal', name: 'Write a Journal', html: `<p class="s-Title">[Title]</p><p style="color:#595959">[Date]</p><hr><h1>[Heading]</h1><p>[To get started, tap any placeholder text and start typing.]</p><p>[Write about your day, an idea or a decision you are weighing.]</p><h2>[Highlights]</h2><ul><li>[Highlight]</li><li>[Highlight]</li></ul>` },
  { id: 'outline', cat: 'Personal', name: 'Create an Outline', html: `<p style="color:#595959">[Date]</p><p class="s-Title">[TITLE]</p><h1>1. [HEADING 1]</h1><p>[To get started right away, tap any placeholder text and start typing.]</p><h2>A. [Heading 2]</h2><p>[Supporting point]</p><h2>B. [Heading 2]</h2><p>[Supporting point]</p><h1>2. [HEADING 1]</h1><p>[Point]</p>` },
  { id: 'newsletter', cat: 'Visual', name: 'Newsletter', html: `<table style="width:100%;border-collapse:collapse"><tr><td style="width:30%;padding:6px;vertical-align:bottom;color:#595959">Volume [1] | Issue [1]<br><b>[Date]</b></td><td style="background-color:#70AD47;color:#ffffff;padding:18px"><span style="font-size:30pt">[Title]</span></td></tr></table><p><br></p><h1 style="color:#548235">[Heading 1]</h1><p>[View and edit this newsletter on your computer, tablet or phone. Replace any placeholder text with your own.]</p><div class="textbox tb-quote"><p>[Pull quote: a sentence that draws the reader in.]</p></div><h2 style="color:#548235">[Heading 2]</h2><p>[Story text.]</p>` },
  { id: 'chartreport', cat: 'Visual', name: 'Chart Report', get html() { return `<p class="s-Title">[Report Title]</p><p class="s-Subtitle">[Period / Department]</p><h1>Summary</h1><p>[One-paragraph summary of the figures below.]</p><h2>Trend</h2><p style="text-align:center">${chartImgHtml(DEFAULT_CHART(), 6)}</p><h2>Share</h2><p style="text-align:center">${chartImgHtml({ type: 'pie', title: 'Matters by Type', labels: ['Civil', 'Criminal', 'Property', 'Family'], series: [{ name: 'Matters', values: [67, 33, 52, 21] }], w: 520, h: 340 }, 4.6)}</p><p>[Double-click a chart to change its data.]</p>`; } },
  { id: 'flowchart', cat: 'Visual', name: 'Flowchart', get html() { return `<p class="s-Title">[Process Name]</p><p>[Describe the process this flowchart shows.]</p><p style="text-align:center">${flowImgHtml(DEFAULT_FLOW())}</p><p>[Double-click the flowchart to change the steps.]</p>`; } },
  { id: 'tablepres', cat: 'Visual', name: 'Table Presentation', html: `<p class="s-Title">[Comparison Title]</p><p>[Introduce what is being compared.]</p><table style="width:100%;border-collapse:collapse"><tr>${hcell('Particulars')}${hcell('Option A')}${hcell('Option B')}${hcell('Option C')}</tr><tr>${cell('[Cost]')}${cell('[ ]')}${cell('[ ]')}${cell('[ ]')}</tr><tr>${cell('[Timeline]', 'background-color:#DEEBF7')}${cell('[ ]', 'background-color:#DEEBF7')}${cell('[ ]', 'background-color:#DEEBF7')}${cell('[ ]', 'background-color:#DEEBF7')}</tr><tr>${cell('[Risk]')}${cell('[ ]')}${cell('[ ]')}${cell('[ ]')}</tr><tr>${cell('[Recommendation]', 'background-color:#DEEBF7')}${cell('[ ]', 'background-color:#DEEBF7')}${cell('[ ]', 'background-color:#DEEBF7')}${cell('[ ]', 'background-color:#DEEBF7')}</tr></table><p><br></p><h2>Key Figures</h2><table style="width:60%;border-collapse:collapse"><tr>${hcell('Item')}${hcell('Value')}</tr><tr>${cell('[Item]')}${cell('[Value]', 'text-align:right')}</tr><tr>${cell('[Item]')}${cell('[Value]', 'text-align:right')}</tr></table>` }
];
const TEMPLATE_CATS = { blank: 'Start', letterhead: 'Legal', notice: 'Legal', agreement: 'Legal', affidavit: 'Legal', letter: 'Business', report: 'Business' };
function allTemplates() { return TEMPLATES.map(t => Object.assign(t, { cat: t.cat || TEMPLATE_CATS[t.id] || 'Business' })).concat(EXTRA_TEMPLATES); }

/* real-looking page previews: the template laid out at page size, then scaled down */
function tplPreview(t) {
  const st = Object.assign({}, STYLE_SETS.Default, (t.settings && t.settings.theme) || {});
  const page = h('div', { class: 'tp-page', style: { fontFamily: fontStack(st.font), fontSize: st.size + 'pt', lineHeight: st.lineHeight } });
  page.innerHTML = (t.settings && t.settings.header ? `<div class="tp-hdr">${t.settings.header}</div>` : '') + t.html;
  return h('div', { class: 'thumb tp' }, page);
}

/* ================= Pinch to zoom (phone, iPhone, iPad) and trackpad pinch (Mac) ================= */
(() => {
  const canvas = $('#canvas');
  let start = null, raf = 0, pending = null;
  const webZoom = () => prefs.webZoom || 1;
  const applyWebZoom = z => { prefs.webZoom = Math.max(0.6, Math.min(3, z)); editor.style.zoom = prefs.webZoom === 1 ? '' : prefs.webZoom; $('#footnoteArea').style.zoom = editor.style.zoom; const pct = Math.round(prefs.webZoom * 100); $('#zoomPct').textContent = pct + '%'; };
  window.applyWebZoom = applyWebZoom;
  const current = () => ui.view === 'print' ? ui.zoom : webZoom();
  function zoomTo(z, fx, fy) {
    const r = canvas.getBoundingClientRect(), ox = fx - r.left, oy = fy - r.top;
    const before = current();
    const cx = canvas.scrollLeft + ox, cy = canvas.scrollTop + oy;
    if (ui.view === 'print') { ui.fitWidth = false; ui.zoom = Math.max(0.25, Math.min(3, z)); applyZoom(); if (typeof selImg !== 'undefined' && selImg) placeHandle(); }
    else applyWebZoom(z);
    const k = current() / before;
    canvas.scrollLeft = cx * k - ox; canvas.scrollTop = cy * k - oy;
  }
  const save = () => { if (ui.view === 'print') { prefs.zoom = ui.zoom; } savePrefs(); };
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const mid = t => [(t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2];
  canvas.addEventListener('touchstart', e => { if (e.touches.length === 2) { start = { d: dist(e.touches), z: current() }; e.preventDefault(); } }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    if (!start || e.touches.length !== 2) return;
    e.preventDefault();
    const d = dist(e.touches), [mx, my] = mid(e.touches);
    pending = [start.z * d / start.d, mx, my];
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (pending) zoomTo(...pending); });
  }, { passive: false });
  const end = e => { if (start && e.touches.length < 2) { start = null; save(); } };
  canvas.addEventListener('touchend', end); canvas.addEventListener('touchcancel', end);
  // Safari gesture events: stop the whole app from zooming
  ['gesturestart', 'gesturechange'].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }));
  // Mac trackpad pinch (and Ctrl + mouse wheel)
  let wheelT = 0;
  canvas.addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    zoomTo(current() * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    clearTimeout(wheelT); wheelT = setTimeout(save, 300);
  }, { passive: false });
})();

/* ================= Start screen ================= */
function launchHome() {
  ui.launch = true;
  document.body.classList.add('launch');
  openBackstage('home');
}
