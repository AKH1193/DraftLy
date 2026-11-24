/* DraftLy: document protection (Word-compatible password encryption), Inspect Document,
   bookmarks, cross-references and endnotes */

/* ---------- SHA-512 (synchronous, needed for 100,000-round password hashing) ---------- */
const SHA512 = (() => {
const K=[0x428a2f98,0xd728ae22,0x71374491,0x23ef65cd,0xb5c0fbcf,0xec4d3b2f,0xe9b5dba5,0x8189dbbc,0x3956c25b,0xf348b538,0x59f111f1,0xb605d019,0x923f82a4,0xaf194f9b,0xab1c5ed5,0xda6d8118,0xd807aa98,0xa3030242,0x12835b01,0x45706fbe,0x243185be,0x4ee4b28c,0x550c7dc3,0xd5ffb4e2,0x72be5d74,0xf27b896f,0x80deb1fe,0x3b1696b1,0x9bdc06a7,0x25c71235,0xc19bf174,0xcf692694,0xe49b69c1,0x9ef14ad2,0xefbe4786,0x384f25e3,0x0fc19dc6,0x8b8cd5b5,0x240ca1cc,0x77ac9c65,0x2de92c6f,0x592b0275,0x4a7484aa,0x6ea6e483,0x5cb0a9dc,0xbd41fbd4,0x76f988da,0x831153b5,0x983e5152,0xee66dfab,0xa831c66d,0x2db43210,0xb00327c8,0x98fb213f,0xbf597fc7,0xbeef0ee4,0xc6e00bf3,0x3da88fc2,0xd5a79147,0x930aa725,0x06ca6351,0xe003826f,0x14292967,0x0a0e6e70,0x27b70a85,0x46d22ffc,0x2e1b2138,0x5c26c926,0x4d2c6dfc,0x5ac42aed,0x53380d13,0x9d95b3df,0x650a7354,0x8baf63de,0x766a0abb,0x3c77b2a8,0x81c2c92e,0x47edaee6,0x92722c85,0x1482353b,0xa2bfe8a1,0x4cf10364,0xa81a664b,0xbc423001,0xc24b8b70,0xd0f89791,0xc76c51a3,0x0654be30,0xd192e819,0xd6ef5218,0xd6990624,0x5565a910,0xf40e3585,0x5771202a,0x106aa070,0x32bbd1b8,0x19a4c116,0xb8d2d0c8,0x1e376c08,0x5141ab53,0x2748774c,0xdf8eeb99,0x34b0bcb5,0xe19b48a8,0x391c0cb3,0xc5c95a63,0x4ed8aa4a,0xe3418acb,0x5b9cca4f,0x7763e373,0x682e6ff3,0xd6b2b8a3,0x748f82ee,0x5defb2fc,0x78a5636f,0x43172f60,0x84c87814,0xa1f0ab72,0x8cc70208,0x1a6439ec,0x90befffa,0x23631e28,0xa4506ceb,0xde82bde9,0xbef9a3f7,0xb2c67915,0xc67178f2,0xe372532b,0xca273ece,0xea26619c,0xd186b8c7,0x21c0c207,0xeada7dd6,0xcde0eb1e,0xf57d4f7f,0xee6ed178,0x06f067aa,0x72176fba,0x0a637dc5,0xa2c898a6,0x113f9804,0xbef90dae,0x1b710b35,0x131c471b,0x28db77f5,0x23047d84,0x32caab7b,0x40c72493,0x3c9ebe0a,0x15c9bebc,0x431d67c4,0x9c100d4c,0x4cc5d4be,0xcb3e42b6,0x597f299c,0xfc657e2a,0x5fcb6fab,0x3ad6faec,0x6c44198c,0x4a475817];
const H0=[0x6a09e667,0xf3bcc908,0xbb67ae85,0x84caa73b,0x3c6ef372,0xfe94f82b,0xa54ff53a,0x5f1d36f1,0x510e527f,0xade682d1,0x9b05688c,0x2b3e6c1f,0x1f83d9ab,0xfb41bd6b,0x5be0cd19,0x137e2179];
  const W = new Int32Array(160);
  function digest(msg) {
    const len = msg.length, padLen = ((len + 16 + 1 + 127) >> 7) << 7;
    const buf = new Uint8Array(padLen); buf.set(msg); buf[len] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(padLen - 8, Math.floor(len / 0x20000000)); dv.setUint32(padLen - 4, (len << 3) >>> 0);
    const H = Int32Array.from(H0);
    for (let off = 0; off < padLen; off += 128) {
      for (let t = 0; t < 32; t++) W[t] = dv.getInt32(off + t * 4);
      for (let t = 16; t < 80; t++) {
        let xh = W[(t - 15) * 2], xl = W[(t - 15) * 2 + 1];
        const s0h = ((xh >>> 1) | (xl << 31)) ^ ((xh >>> 8) | (xl << 24)) ^ (xh >>> 7);
        const s0l = ((xl >>> 1) | (xh << 31)) ^ ((xl >>> 8) | (xh << 24)) ^ ((xl >>> 7) | (xh << 25));
        xh = W[(t - 2) * 2]; xl = W[(t - 2) * 2 + 1];
        const s1h = ((xh >>> 19) | (xl << 13)) ^ ((xl >>> 29) | (xh << 3)) ^ (xh >>> 6);
        const s1l = ((xl >>> 19) | (xh << 13)) ^ ((xh >>> 29) | (xl << 3)) ^ ((xl >>> 6) | (xh << 26));
        const lo = (W[(t - 16) * 2 + 1] >>> 0) + (s0l >>> 0) + (W[(t - 7) * 2 + 1] >>> 0) + (s1l >>> 0);
        W[t * 2] = W[(t - 16) * 2] + s0h + W[(t - 7) * 2] + s1h + ((lo / 4294967296) | 0);
        W[t * 2 + 1] = lo | 0;
      }
      let ah = H[0], al = H[1], bh = H[2], bl = H[3], ch = H[4], cl = H[5], dh = H[6], dl = H[7];
      let eh = H[8], el = H[9], fh = H[10], fl = H[11], gh = H[12], gl = H[13], hh = H[14], hl = H[15];
      for (let t = 0; t < 80; t++) {
        const S1h = ((eh >>> 14) | (el << 18)) ^ ((eh >>> 18) | (el << 14)) ^ ((el >>> 9) | (eh << 23));
        const S1l = ((el >>> 14) | (eh << 18)) ^ ((el >>> 18) | (eh << 14)) ^ ((eh >>> 9) | (el << 23));
        const chh = (eh & fh) ^ (~eh & gh), chl = (el & fl) ^ (~el & gl);
        let lo = (hl >>> 0) + (S1l >>> 0) + (chl >>> 0) + (K[t * 2 + 1] >>> 0) + (W[t * 2 + 1] >>> 0);
        const T1h = (hh + S1h + chh + K[t * 2] + W[t * 2] + ((lo / 4294967296) | 0)) | 0, T1l = lo | 0;
        const S0h = ((ah >>> 28) | (al << 4)) ^ ((al >>> 2) | (ah << 30)) ^ ((al >>> 7) | (ah << 25));
        const S0l = ((al >>> 28) | (ah << 4)) ^ ((ah >>> 2) | (al << 30)) ^ ((ah >>> 7) | (al << 25));
        const mh = (ah & bh) ^ (ah & ch) ^ (bh & ch), ml = (al & bl) ^ (al & cl) ^ (bl & cl);
        lo = (S0l >>> 0) + (ml >>> 0);
        const T2h = (S0h + mh + ((lo / 4294967296) | 0)) | 0, T2l = lo | 0;
        hh = gh; hl = gl; gh = fh; gl = fl; fh = eh; fl = el;
        lo = (dl >>> 0) + (T1l >>> 0); eh = (dh + T1h + ((lo / 4294967296) | 0)) | 0; el = lo | 0;
        dh = ch; dl = cl; ch = bh; cl = bl; bh = ah; bl = al;
        lo = (T1l >>> 0) + (T2l >>> 0); ah = (T1h + T2h + ((lo / 4294967296) | 0)) | 0; al = lo | 0;
      }
      const add = (i, xh, xl) => { const lo = (H[i + 1] >>> 0) + (xl >>> 0); H[i] = (H[i] + xh + ((lo / 4294967296) | 0)) | 0; H[i + 1] = lo | 0; };
      add(0, ah, al); add(2, bh, bl); add(4, ch, cl); add(6, dh, dl); add(8, eh, el); add(10, fh, fl); add(12, gh, gl); add(14, hh, hl);
    }
    const out = new Uint8Array(64), odv = new DataView(out.buffer);
    for (let i = 0; i < 16; i++) odv.setInt32(i * 4, H[i]);
    return out;
  }
  return { digest };
})();

/* ---------- Compound File (OLE2) container, version 4 sectors ---------- */
const CFB = (() => {
  const END = 0xFFFFFFFE, FREE = 0xFFFFFFFF, FATS = 0xFFFFFFFD, NONE = 0xFFFFFFFF;
  const cmp = (a, b) => a.length - b.length || (a.toUpperCase() < b.toUpperCase() ? -1 : a.toUpperCase() > b.toUpperCase() ? 1 : 0);
  function build(entries, v4) {
    const SS = v4 ? 4096 : 512, MS = 64, CUT = 4096;
    const root = { name: 'Root Entry', type: 5, kids: [] }, all = [root];
    for (const e of entries) {
      const parts = e.path.split('/'); let cur = root;
      parts.forEach((nm, i) => {
        let k = cur.kids.find(x => x.name === nm);
        if (!k) { k = i === parts.length - 1 ? { name: nm, type: 2, data: e.data } : { name: nm, type: 1, kids: [] }; cur.kids.push(k); all.push(k); }
        cur = k;
      });
    }
    all.forEach((n, i) => n.id = i);
    const bst = arr => { if (!arr.length) return NONE; const m = arr.length >> 1; const n = arr[m]; n.left = bst(arr.slice(0, m)); n.right = bst(arr.slice(m + 1)); return n.id; };
    all.filter(n => n.kids).forEach(n => { n.child = bst(n.kids.slice().sort((a, b) => cmp(a.name, b.name))); });
    // mini stream
    const small = all.filter(n => n.type === 2 && n.data.length < CUT && n.data.length > 0), big = all.filter(n => n.type === 2 && n.data.length >= CUT);
    const miniFat = [];
    let mpos = 0;
    small.forEach(n => { const c = Math.ceil(n.data.length / MS); n.start = mpos; for (let i = 0; i < c; i++) miniFat.push(i === c - 1 ? END : mpos + i + 1); mpos += c; });
    const miniBytes = mpos * MS;
    const D = Math.ceil(all.length / (SS / 128)), MF = Math.ceil(miniFat.length * 4 / SS), MSS = Math.ceil(miniBytes / SS);
    const bigSecs = big.map(n => Math.ceil(n.data.length / SS));
    const N0 = D + MF + MSS + bigSecs.reduce((a, b) => a + b, 0);
    // FAT sectors, plus DIFAT sectors when more than 109 FAT sectors are needed
    let F = 1, X = 0;
    for (;;) { X = F > 109 ? Math.ceil((F - 109) / (SS / 4 - 1)) : 0; if (F * (SS / 4) >= N0 + F + X) break; F++; }
    const total = F + X + N0;
    const fat = new Uint32Array(F * (SS / 4)).fill(FREE);
    let s = 0;
    for (let i = 0; i < F; i++) fat[s++] = FATS;
    const difatStart = s;
    for (let i = 0; i < X; i++) fat[s++] = 0xFFFFFFFC;
    const chain = n => { const start = s; for (let i = 0; i < n; i++, s++) fat[s] = i === n - 1 ? END : s + 1; return n ? start : END; };
    const dirStart = chain(D), mfStart = chain(MF), msStart = chain(MSS);
    big.forEach((n, i) => { n.start = chain(bigSecs[i]); });
    const out = new Uint8Array(SS * (total + 1)), dv = new DataView(out.buffer);
    out.set([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
    dv.setUint16(24, 0x3E, true); dv.setUint16(26, v4 ? 4 : 3, true); dv.setUint16(28, 0xFFFE, true); dv.setUint16(30, v4 ? 12 : 9, true); dv.setUint16(32, 6, true);
    dv.setUint32(40, v4 ? D : 0, true); dv.setUint32(44, F, true); dv.setUint32(48, dirStart, true); dv.setUint32(56, CUT, true);
    dv.setUint32(60, MF ? mfStart : END, true); dv.setUint32(64, MF, true); dv.setUint32(68, X ? difatStart : END, true); dv.setUint32(72, X, true);
    for (let i = 0; i < 109; i++) dv.setUint32(76 + i * 4, i < F ? i : FREE, true);
    const sec = i => SS * (i + 1);
    for (let i = 0; i < fat.length; i++) dv.setUint32(sec(0) + i * 4, fat[i], true);
    for (let x = 0; x < X; x++) {
      const o = sec(difatStart + x), per = SS / 4 - 1;
      for (let i = 0; i < per; i++) { const f = 109 + x * per + i; dv.setUint32(o + i * 4, f < F ? f : FREE, true); }
      dv.setUint32(o + SS - 4, x < X - 1 ? difatStart + x + 1 : END, true);
    }
    // directory
    for (let i = 0; i < D * (SS / 128); i++) {
      const o = sec(dirStart) + i * 128, n = all[i];
      if (!n) { dv.setUint32(o + 68, NONE, true); dv.setUint32(o + 72, NONE, true); dv.setUint32(o + 76, NONE, true); continue; }
      for (let c = 0; c < n.name.length; c++) dv.setUint16(o + c * 2, n.name.charCodeAt(c), true);
      dv.setUint16(o + 64, (n.name.length + 1) * 2, true);
      out[o + 66] = n.type; out[o + 67] = 1;
      dv.setUint32(o + 68, n.left ?? NONE, true); dv.setUint32(o + 72, n.right ?? NONE, true); dv.setUint32(o + 76, n.child ?? NONE, true);
      if (n.type === 5) { dv.setUint32(o + 116, MSS ? msStart : END, true); dv.setUint32(o + 120, miniBytes, true); }
      else if (n.type === 2) { dv.setUint32(o + 116, n.data.length ? n.start : END, true); dv.setUint32(o + 120, n.data.length, true); }
    }
    for (let i = 0; i < miniFat.length; i++) dv.setUint32(sec(mfStart) + i * 4, miniFat[i], true);
    for (let i = miniFat.length; i < MF * SS / 4; i++) dv.setUint32(sec(mfStart) + i * 4, FREE, true);
    small.forEach(n => out.set(n.data, sec(msStart) + n.start * MS));
    big.forEach(n => out.set(n.data, sec(n.start)));
    return out;
  }
  function read(buf) {
    const u = new Uint8Array(buf), dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    if (dv.getUint32(0, true) !== 0xE011CFD0) throw new Error('Not a compound file');
    const SS = 1 << dv.getUint16(30, true), MS = 1 << dv.getUint16(32, true), CUT = dv.getUint32(56, true);
    const off = i => SS * (i + 1);
    const difat = [];
    for (let i = 0; i < 109; i++) { const v = dv.getUint32(76 + i * 4, true); if (v !== FREE) difat.push(v); }
    let dn = dv.getUint32(68, true), dc = dv.getUint32(72, true);
    while (dc-- > 0 && dn !== END && dn !== FREE) { for (let i = 0; i < SS / 4 - 1; i++) { const v = dv.getUint32(off(dn) + i * 4, true); if (v !== FREE) difat.push(v); } dn = dv.getUint32(off(dn) + SS - 4, true); }
    const fat = [];
    difat.forEach(s => { for (let i = 0; i < SS / 4; i++) fat.push(dv.getUint32(off(s) + i * 4, true)); });
    const chainOf = (start, table) => { const a = []; let s = start, guard = 0; while (s !== END && s !== FREE && s < table.length && guard++ < 1e7) { a.push(s); s = table[s]; } return a; };
    const readChain = (start, size) => { const secs = chainOf(start, fat); const o = new Uint8Array(secs.length * SS); secs.forEach((s, i) => o.set(u.subarray(off(s), off(s) + SS), i * SS)); return size == null ? o : o.subarray(0, size); };
    const dir = readChain(dv.getUint32(48, true));
    const ddv = new DataView(dir.buffer);
    const ents = [];
    for (let o = 0; o + 128 <= dir.length; o += 128) {
      const nl = ddv.getUint16(o + 64, true); let name = '';
      for (let c = 0; c < Math.max(0, nl / 2 - 1); c++) name += String.fromCharCode(ddv.getUint16(o + c * 2, true));
      ents.push({ name, type: dir[o + 66], left: ddv.getUint32(o + 68, true), right: ddv.getUint32(o + 72, true), child: ddv.getUint32(o + 76, true), start: ddv.getUint32(o + 116, true), size: ddv.getUint32(o + 120, true) });
    }
    const mfStart = dv.getUint32(60, true);
    const mfBytes = mfStart === END ? new Uint8Array(0) : readChain(mfStart);
    const mfdv = new DataView(mfBytes.buffer); const miniFat = []; for (let i = 0; i < mfBytes.length / 4; i++) miniFat.push(mfdv.getUint32(i * 4, true));
    const ministream = ents[0].start === END ? new Uint8Array(0) : readChain(ents[0].start, ents[0].size);
    const files = {};
    const data = e => {
      if (e.size < CUT) { const secs = chainOf(e.start, miniFat); const o = new Uint8Array(secs.length * MS); secs.forEach((s, i) => o.set(ministream.subarray(s * MS, s * MS + MS), i * MS)); return o.subarray(0, e.size); }
      return readChain(e.start, e.size);
    };
    const visit = (id, prefix, depth) => {
      if (id === NONE || !ents[id] || depth > 64) return;
      const e = ents[id];
      visit(e.left, prefix, depth + 1); visit(e.right, prefix, depth + 1);
      if (e.type === 2) files[prefix + e.name] = data(e);
      if (e.type === 1) visit(e.child, prefix + e.name + '/', depth + 1);
    };
    visit(ents[0].child, '', 0);
    return files;
  }
  const isCFB = buf => { const u = new Uint8Array(buf, 0, 8); return u[0] === 0xD0 && u[1] === 0xCF && u[2] === 0x11 && u[3] === 0xE0; };
  return { build, read, isCFB };
})();

/* ---------- Office "Encrypt with Password" (ECMA-376 Agile Encryption, AES-256 / SHA-512) ---------- */
const OfficeCrypto = (() => {
  const enc = new TextEncoder();
  const cat = (...a) => { const n = a.reduce((s, x) => s + x.length, 0), o = new Uint8Array(n); let p = 0; a.forEach(x => { o.set(x, p); p += x.length; }); return o; };
  const u32 = v => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v, true); return b; };
  const hexb = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
  const B64 = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const unB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));
  const utf16 = s => { const b = new Uint8Array(s.length * 2); for (let i = 0; i < s.length; i++) { b[i * 2] = s.charCodeAt(i) & 255; b[i * 2 + 1] = s.charCodeAt(i) >> 8; } return b; };
  const BLK = { vin: hexb('fea7d2763b4b9e79'), vval: hexb('d7aa0f6d3061344e'), key: hexb('146e0be7abacd0d6'), hkey: hexb('5fb2ad010cb9e1f6'), hval: hexb('a0677f02b22c8433') };
  function passwordHash(pw, salt, spin) {
    let hh = SHA512.digest(cat(salt, utf16(pw)));
    const buf = new Uint8Array(68), dv = new DataView(buf.buffer);
    for (let i = 0; i < spin; i++) { dv.setUint32(0, i, true); buf.set(hh, 4); hh = SHA512.digest(buf); }
    return hh;
  }
  const derive = (hh, blk, bytes) => { const d = SHA512.digest(cat(hh, blk)); const k = new Uint8Array(bytes).fill(0x36); k.set(d.subarray(0, Math.min(bytes, d.length))); return k; };
  const ivFor = (salt, blk, bs) => { const d = SHA512.digest(cat(salt, blk)); const iv = new Uint8Array(bs).fill(0x36); iv.set(d.subarray(0, Math.min(bs, d.length))); return iv; };
  async function aes(keyBytes, iv, data, decrypt) {
    const k = await crypto.subtle.importKey('raw', keyBytes, 'AES-CBC', false, [decrypt ? 'decrypt' : 'encrypt']);
    if (!decrypt) return new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, k, data)).subarray(0, data.length); // no padding: drop the extra block
    // raw CBC decrypt without padding: append a block that decrypts to valid PKCS#7 padding
    const last = data.subarray(data.length - 16);
    const ke = await crypto.subtle.importKey('raw', keyBytes, 'AES-CBC', false, ['encrypt']);
    const pad = new Uint8Array(16).fill(16);
    const extra = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: last }, ke, pad)).subarray(0, 16);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, k, cat(data, extra)));
  }
  const pad16 = u => u.length % 16 ? cat(u, new Uint8Array(16 - u.length % 16)) : u;
  function lpp4(s) { const b = utf16(s); const o = cat(u32(b.length), b); return o.length % 4 ? cat(o, new Uint8Array(4 - o.length % 4)) : o; }
  const ver = () => cat(new Uint8Array([1, 0, 0, 0]));
  function dataSpaces() {
    const version = cat(lpp4('Microsoft.Container.DataSpaces'), u32(1), u32(1), u32(1));
    const entry = cat(u32(1), u32(0), lpp4('EncryptedPackage'), lpp4('StrongEncryptionDataSpace'));
    const map = cat(u32(8), u32(1), u32(entry.length + 4), entry);
    const def = cat(u32(8), u32(1), lpp4('StrongEncryptionTransform'));
    const tid = lpp4('{FF9A3F03-56EF-4613-BDD5-5A41C1D07246}');
    const primary = cat(u32(8 + tid.length), u32(1), tid, lpp4('Microsoft.Container.EncryptionTransform'), u32(1), u32(1), u32(1), u32(0), u32(0), u32(0), u32(4));
    return [
      { path: '\u0006DataSpaces/Version', data: version },
      { path: '\u0006DataSpaces/DataSpaceMap', data: map },
      { path: '\u0006DataSpaces/DataSpaceInfo/StrongEncryptionDataSpace', data: def },
      { path: '\u0006DataSpaces/TransformInfo/StrongEncryptionTransform/\u0006Primary', data: primary }
    ];
  }
  async function encrypt(plain, password) {
    const spin = 100000, keyBytes = 32, bs = 16;
    const keySalt = rnd(16), pwSalt = rnd(16), secret = rnd(keyBytes), verIn = rnd(16), hmacKey = rnd(64);
    // package: 8-byte size, then 4096-byte segments
    const segs = [u32(plain.length), u32(0)];
    for (let i = 0, n = 0; i < plain.length; i += 4096, n++) segs.push(await aes(secret, ivFor(keySalt, u32(n), bs), pad16(plain.subarray(i, i + 4096))));
    const pkg = cat(...segs);
    const hk = await crypto.subtle.importKey('raw', hmacKey, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
    const hmacVal = new Uint8Array(await crypto.subtle.sign('HMAC', hk, pkg));
    const encHmacKey = await aes(secret, ivFor(keySalt, BLK.hkey, bs), hmacKey);
    const encHmacVal = await aes(secret, ivFor(keySalt, BLK.hval, bs), hmacVal);
    const ph = passwordHash(password, pwSalt, spin);
    const eVin = await aes(derive(ph, BLK.vin, keyBytes), pwSalt, verIn);
    const eVval = await aes(derive(ph, BLK.vval, keyBytes), pwSalt, SHA512.digest(verIn));
    const eKey = await aes(derive(ph, BLK.key, keyBytes), pwSalt, secret);
    const xmlInfo = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<encryption xmlns="http://schemas.microsoft.com/office/2006/encryption" xmlns:p="http://schemas.microsoft.com/office/2006/keyEncryptor/password" xmlns:c="http://schemas.microsoft.com/office/2006/keyEncryptor/certificate"><keyData saltSize="16" blockSize="16" keyBits="256" hashSize="64" cipherAlgorithm="AES" cipherChaining="ChainingModeCBC" hashAlgorithm="SHA512" saltValue="${B64(keySalt)}"/><dataIntegrity encryptedHmacKey="${B64(encHmacKey)}" encryptedHmacValue="${B64(encHmacVal)}"/><keyEncryptors><keyEncryptor uri="http://schemas.microsoft.com/office/2006/keyEncryptor/password"><p:encryptedKey spinCount="${spin}" saltSize="16" blockSize="16" keyBits="256" hashSize="64" cipherAlgorithm="AES" cipherChaining="ChainingModeCBC" hashAlgorithm="SHA512" saltValue="${B64(pwSalt)}" encryptedVerifierHashInput="${B64(eVin)}" encryptedVerifierHashValue="${B64(eVval)}" encryptedKeyValue="${B64(eKey)}"/></keyEncryptor></keyEncryptors></encryption>`;
    const info = cat(new Uint8Array([4, 0, 4, 0, 0x40, 0, 0, 0]), enc.encode(xmlInfo));
    return CFB.build([...dataSpaces(), { path: 'EncryptionInfo', data: info }, { path: 'EncryptedPackage', data: pkg }]);
  }
  /* SHA-1 (synchronous) for the older "Standard" encryption used by Word 2007 and LibreOffice */
  function sha1(m) {
    const len = m.length, pl = ((len + 8 + 1 + 63) >> 6) << 6, b = new Uint8Array(pl); b.set(m); b[len] = 0x80;
    const dv = new DataView(b.buffer); dv.setUint32(pl - 8, Math.floor(len / 0x20000000)); dv.setUint32(pl - 4, (len << 3) >>> 0);
    let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0; const w = new Int32Array(80);
    for (let o = 0; o < pl; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getInt32(o + i * 4);
      for (let i = 16; i < 80; i++) { const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]; w[i] = (x << 1) | (x >>> 31); }
      let a = h0, bb = h1, c = h2, d = h3, e = h4;
      for (let i = 0; i < 80; i++) {
        const f = i < 20 ? (bb & c) | (~bb & d) : i < 40 ? bb ^ c ^ d : i < 60 ? (bb & c) | (bb & d) | (c & d) : bb ^ c ^ d;
        const k = i < 20 ? 0x5A827999 : i < 40 ? 0x6ED9EBA1 : i < 60 ? 0x8F1BBCDC : 0xCA62C1D6;
        const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) | 0; e = d; d = c; c = (bb << 30) | (bb >>> 2); bb = a; a = t;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + bb) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
    }
    const out = new Uint8Array(20), odv = new DataView(out.buffer); [h0, h1, h2, h3, h4].forEach((v, i) => odv.setInt32(i * 4, v)); return out;
  }
  async function ecbDecrypt(key, data) {
    const out = await aes(key, new Uint8Array(16), data, true);
    for (let i = data.length - 16; i >= 16; i -= 16) for (let j = 0; j < 16; j++) out[i + j] ^= data[i - 16 + j];
    return out;
  }
  async function decryptStandard(info, pkg, password) {
    const dv = new DataView(info.buffer, info.byteOffset, info.byteLength);
    const hsz = dv.getUint32(8, true), algId = dv.getUint32(12 + 8, true), keyBits = dv.getUint32(12 + 16, true) || 128;
    if (algId !== 0x660E && algId !== 0x660F && algId !== 0x6610) throw new Error('This file uses an old RC4 encryption that DraftLy cannot open. Open it in Word, remove the password, and try again.');
    const v = 12 + hsz, saltSize = dv.getUint32(v, true), salt = info.subarray(v + 4, v + 4 + saltSize);
    const encVer = info.subarray(v + 4 + saltSize, v + 20 + saltSize), encVerHash = info.subarray(v + 24 + saltSize, v + 24 + saltSize + 32);
    let hh = sha1(cat(salt, utf16(password)));
    const buf = new Uint8Array(24), bdv = new DataView(buf.buffer);
    for (let i = 0; i < 50000; i++) { bdv.setUint32(0, i, true); buf.set(hh, 4); hh = sha1(buf); }
    hh = sha1(cat(hh, u32(0)));
    const x = n => { const b = new Uint8Array(64).fill(n); for (let i = 0; i < 20; i++) b[i] ^= hh[i]; return sha1(b); };
    const key = cat(x(0x36), x(0x5C)).subarray(0, keyBits / 8);
    const ver = await ecbDecrypt(key, encVer), vh = await ecbDecrypt(key, encVerHash);
    const want = sha1(ver);
    if (!want.every((b, i) => b === vh[i])) { const e = new Error('Wrong password'); e.wrongPassword = true; throw e; }
    const size = new DataView(pkg.buffer, pkg.byteOffset).getUint32(0, true);
    const body = pkg.subarray(8, 8 + Math.floor((pkg.length - 8) / 16) * 16);
    return (await ecbDecrypt(key, body)).subarray(0, size);
  }
  async function decrypt(buf, password) {
    const files = CFB.read(buf);
    const info = files['EncryptionInfo'], pkg = files['EncryptedPackage'];
    if (!info || !pkg) throw new Error('This file is not a password-protected Word document');
    const vMaj = info[0] | (info[1] << 8), vMin = info[2] | (info[3] << 8);
    if (vMin === 2 && (vMaj === 3 || vMaj === 4)) return decryptStandard(info, pkg, password);
    if (!(vMaj === 4 && vMin === 4)) throw new Error('This file uses an encryption that DraftLy cannot open. Open it in Word, remove the password, and try again.');
    const doc = new DOMParser().parseFromString(new TextDecoder().decode(info.subarray(8)), 'application/xml');
    const kd = doc.getElementsByTagNameNS('*', 'keyData')[0], ek = doc.getElementsByTagNameNS('*', 'encryptedKey')[0];
    if (!kd || !ek) throw new Error('Unsupported encryption (certificate based)');
    const A = (el, n) => el.getAttribute(n);
    const hashAlg = A(ek, 'hashAlgorithm');
    if (hashAlg !== 'SHA512') throw new Error('Unsupported encryption hash ' + hashAlg);
    const kb = +A(ek, 'keyBits') / 8, bs = +A(kd, 'blockSize') || 16;
    const pwSalt = unB64(A(ek, 'saltValue')), ph = passwordHash(password, pwSalt, +A(ek, 'spinCount'));
    const vin = await aes(derive(ph, BLK.vin, kb), pwSalt, unB64(A(ek, 'encryptedVerifierHashInput')), true);
    const vval = await aes(derive(ph, BLK.vval, kb), pwSalt, unB64(A(ek, 'encryptedVerifierHashValue')), true);
    const want = SHA512.digest(vin.subarray(0, +A(ek, 'saltSize') || 16));
    if (!want.every((x, i) => x === vval[i])) { const e = new Error('Wrong password'); e.wrongPassword = true; throw e; }
    const secret = (await aes(derive(ph, BLK.key, kb), pwSalt, unB64(A(ek, 'encryptedKeyValue')), true)).subarray(0, +A(kd, 'keyBits') / 8);
    const keySalt = unB64(A(kd, 'saltValue'));
    const size = new DataView(pkg.buffer, pkg.byteOffset).getUint32(0, true);
    const parts = [];
    for (let i = 8, n = 0; i < pkg.length; i += 4096, n++) parts.push(await aes(secret, ivFor(keySalt, u32(n), bs), pkg.subarray(i, Math.min(pkg.length, i + 4096)), true));
    return cat(...parts).subarray(0, size);
  }
  return { encrypt, decrypt, passwordHash };
})();

/* ---------- passwords for this device, prompts ---------- */
function askPassword(title, msg, err, confirm) {
  return new Promise(res => {
    const p1 = h('input', { type: 'password', autocomplete: 'new-password' }), p2 = confirm ? h('input', { type: 'password', autocomplete: 'new-password' }) : null;
    const show = h('input', { type: 'checkbox' }); show.addEventListener('change', () => { p1.type = show.checked ? 'text' : 'password'; if (p2) p2.type = p1.type; });
    let done = false;
    const m = modal(title, h('div', null, h('p', { class: 'note' }, msg), err ? h('p', { class: 'err' }, err) : null, field('Password', p1), p2 ? field('Re-enter password', p2) : null, h('label', { class: 'fl' }, show, ' Show password')), [
      { label: 'Cancel', fn: () => { done = true; res(null); } },
      { label: 'OK', primary: true, fn: () => { if (!p1.value) { toast('Type a password'); return false; } if (p2 && p1.value !== p2.value) { toast('The passwords do not match'); return false; } done = true; res(p1.value); } }]);
    const obs = new MutationObserver(() => { if (!m.el.isConnected) { obs.disconnect(); if (!done) res(null); } });
    obs.observe($('#modalRoot'), { childList: true });
  });
}
/* document-level setting changes are allowed even when the text is read-only */
function settingsChange(fn) { const ro = ui.readonly; ui.readonly = false; try { mutate(fn); } finally { ui.readonly = ro; } }
const Protect = (() => {
  const mem = {};
  function remember(id, pw) { mem[id] = pw; try { KV.set('pw:' + id, pw); } catch (e) { } }
  async function forget(id) { delete mem[id]; try { await KV.set('pw:' + id, null); } catch (e) { } }
  async function passwordFor(id, background) {
    if (mem[id]) return mem[id];
    try { const v = await KV.get('pw:' + id); if (v) return (mem[id] = v); } catch (e) { }
    if (background) return null;
    const p = await askPassword('Password Needed', 'This document is set to save as a password-protected Word file. Enter its password once on this device.', '', false);
    if (p) remember(id, p);
    return p;
  }
  async function openEncrypted(buf, name) {
    let files;
    try { files = CFB.read(buf); } catch (e) { throw new Error('the file is damaged or is not a Word document'); }
    if (!files['EncryptionInfo']) throw new Error('this is an old Word 97-2003 (.doc) file. Open it in Word or Google Docs and save it as .docx first');
    let err = '';
    for (let tries = 0; tries < 6; tries++) {
      const pw = await askPassword('Password', `"${name}" is protected with a password. Enter it to open the document.`, err, false);
      if (pw == null) return null;
      const busy = modal('Opening…', h('p', null, 'Unlocking the document…'), []);
      try { const bytes = await OfficeCrypto.decrypt(buf, pw); return { bytes, password: pw }; }
      catch (e) { if (!e.wrongPassword) throw e; err = 'The password is incorrect. Passwords are case-sensitive.'; }
      finally { busy.close(); }
    }
    return null;
  }
  return { remember, forget, passwordFor, openEncrypted };
})();
async function encryptDialog() {
  if (doc.settings.encrypted) {
    return modal('Encrypt Document', h('p', { class: 'note' }, 'This document is saved as a password-protected Word file. Remove the password?'), [{ label: 'Cancel' }, { label: 'Change Password', fn: async () => { const p = await askPassword('Change Password', 'Type the new password.', '', true); if (p) { Protect.remember(doc.id, p); toast('Password changed. Save the document to apply it.'); } } }, { label: 'Remove Password', primary: true, fn: async () => { await Protect.forget(doc.id); settingsChange(() => { delete doc.settings.encrypted; }); toast('Password removed. Save the document to apply it.'); renderRibbon(); } }]);
  }
  const p = await askPassword('Encrypt Document', 'Every Word file saved or shared from this document will need this password to open, in DraftLy, MS Word or any other app. If you forget the password it cannot be recovered, so keep a note of it somewhere safe.', '', true);
  if (!p) return;
  Protect.remember(doc.id, p);
  settingsChange(() => { doc.settings.encrypted = true; });
  renderRibbon();
  toast('Protected. Word files saved from now on need the password to open.', 5000);
}

/* ---------- Restrict Editing ---------- */
function applyRestriction() {
  const r = doc && doc.settings.restrict;
  ui.readonly = !!(r && r.mode === 'readOnly');
  editor.contentEditable = ui.readonly || document.body.classList.contains('read') ? 'false' : 'true';
  editor.classList.toggle('readonly', ui.readonly);
  if (r && r.mode === 'trackedChanges') { Review.setTracking(true); doc.settings.trackChanges = true; $('#stTrack').classList.remove('hidden'); }
  updateRibbonState();
}
const b64 = u => btoa(String.fromCharCode(...u));
async function restrictDialog() {
  const r = doc.settings.restrict;
  if (r) {
    const stop = async () => {
      if (r.hash) {
        const pw = await askPassword('Stop Protection', 'Enter the password to stop protection.', '', false);
        if (pw == null) return;
        const hh = OfficeCrypto.passwordHash(pw, Uint8Array.from(atob(r.salt), c => c.charCodeAt(0)), 100000);
        if (b64(hh) !== r.hash) return toast('The password is incorrect.');
      } else if (r.fromWord && !confirm('This document was protected in MS Word. DraftLy cannot check Word passwords. Stop protection anyway?')) return;
      settingsChange(() => { delete doc.settings.restrict; });
      applyRestriction(); renderRibbon(); toast('Protection stopped. You can edit the document.');
    };
    return modal('Restrict Editing', h('p', { class: 'note' }, r.mode === 'trackedChanges' ? 'Only tracked changes are allowed: every edit is recorded and Track Changes cannot be turned off.' : 'The document is read-only.'), [{ label: 'Close' }, { label: 'Stop Protection', primary: true, fn: stop }]);
  }
  const mode = h('select', null, h('option', { value: 'readOnly' }, 'No changes (read only)'), h('option', { value: 'trackedChanges' }, 'Tracked changes only'));
  const pw = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Optional' });
  modal('Restrict Editing', h('div', null, h('p', { class: 'note' }, 'Applies on all your devices and in the Word file you save or share. In MS Word the restriction is shown, but Word only checks passwords it set itself.'), field('Allow only this type of editing', mode), field('Password to stop protection', pw)), [{ label: 'Cancel' }, {
    label: 'Start Enforcing Protection', primary: true, fn: () => {
      const v = { mode: mode.value };
      if (pw.value) { const salt = crypto.getRandomValues(new Uint8Array(16)); v.salt = b64(salt); v.hash = b64(OfficeCrypto.passwordHash(pw.value, salt, 100000)); }
      settingsChange(() => { doc.settings.restrict = v; });
      applyRestriction(); renderRibbon();
      toast(v.mode === 'readOnly' ? 'The document is now read-only' : 'Track Changes is now locked on');
    }
  }]);
}

/* ---------- Inspect Document ---------- */
function inspectDialog() {
  const s = doc.settings;
  const comments = Review.commentIds().length, changes = Review.changes().length;
  const hf = !!(s.header || s.footer || s.firstHeader || s.firstFooter), wm = !!s.watermark;
  const noAlt = $$('img', editor).filter(i => !(i.getAttribute('alt') || '').trim()).length;
  const merge = !!s.merge, bms = $$('span.bm', editor).length, fields = $$('span.mf', editor).length;
  const rows = [];
  const add = (title, found, detail, actionLabel, action) => {
    const st = h('span', { class: 'ins-st ' + (found ? 'warn' : 'ok') }, found ? '!' : '✓');
    const btn = found && action ? h('button', { class: 'btn', type: 'button', onclick: () => { action(); btn.disabled = true; btn.textContent = 'Done'; st.className = 'ins-st ok'; st.textContent = '✓'; } }, actionLabel) : null;
    rows.push(h('div', { class: 'ins-row' }, st, h('div', null, h('b', null, title), h('div', { class: 'note' }, detail)), btn));
  };
  add('Comments', comments, comments ? `${comments} comment${comments > 1 ? 's' : ''} found.` : 'No comments.', 'Remove All', () => CMD.deleteAllComments());
  add('Tracked changes', changes, changes ? `${changes} revision${changes > 1 ? 's' : ''} found, showing who changed what.` : 'No tracked changes.', 'Accept All', () => CMD.acceptAll());
  add('Personal information', !s.anonymous, s.anonymous ? 'Your name is removed from saved Word files.' : `Saved Word files show "${prefs.author}" as the author, and on comments and changes.`, 'Remove from saved files', () => settingsChange(() => { s.anonymous = true; }));
  add('Headers, footers and watermark', hf || wm, hf || wm ? [hf ? 'Headers or footers' : '', wm ? 'Watermark "' + s.watermark + '"' : ''].filter(Boolean).join(' and ') + ' found.' : 'None found.', 'Remove All', () => setPage({ header: '', footer: '', firstHeader: '', firstFooter: '', differentFirst: false, watermark: '' }));
  add('Mail merge data', merge, merge ? `A recipient list (${s.merge.rows.length} people) is stored with the document${fields ? ', with ' + fields + ' merge fields' : ''}.` : 'None.', 'Remove List', () => settingsChange(() => { delete s.merge; }));
  add('Pictures without alt text', noAlt, noAlt ? `${noAlt} picture${noAlt > 1 ? 's have' : ' has'} no alternative text for screen readers (Picture › Alt Text).` : 'All pictures have alt text.', null, null);
  rows.push(h('div', { class: 'note', style: { marginTop: '8px' } }, `Bookmarks: ${bms}. Password: ${s.encrypted ? 'on' : 'off'}. Editing restriction: ${s.restrict ? (s.restrict.mode === 'readOnly' ? 'read only' : 'tracked changes only') : 'off'}.`));
  modal('Inspect Document', h('div', { class: 'inspect' }, ...rows), [{ label: 'Close', primary: true }], { wide: true });
}

/* ---------- Bookmarks ---------- */
const bmList = () => $$('span.bm', editor).filter(b => !/^_/.test(b.getAttribute('data-bm') || ''));
function gotoBookmark(name) {
  const b = editor.querySelector(`span.bm[data-bm="${CSS.escape(name)}"]`); if (!b) return toast('Bookmark not found');
  b.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const r = document.createRange(); if (b.childNodes.length) r.selectNodeContents(b); else { r.setStartAfter(b); r.collapse(true); }
  const s = getSelection(); s.removeAllRanges(); s.addRange(r); lastRange = r.cloneRange();
}
function bookmarkDialog() {
  restoreRange();
  const saved = getRange() && getRange().cloneRange();
  const name = h('input', { placeholder: 'e.g. Clause_12' });
  const list = h('select', { size: 8, style: { width: '100%' } });
  const fill = () => { list.innerHTML = ''; bmList().forEach(b => list.append(h('option', { value: b.getAttribute('data-bm') }, b.getAttribute('data-bm')))); };
  fill();
  list.addEventListener('change', () => { name.value = list.value; });
  list.addEventListener('dblclick', () => list.value && gotoBookmark(list.value));
  const add = () => {
    const nm = name.value.trim().replace(/\s+/g, '_');
    if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(nm)) { toast('Names start with a letter and use letters, numbers and _ only (up to 40)'); return false; }
    if (!saved) { toast('Place the cursor in the document first'); return false; }
    lastRange = saved; restoreRange();
    mutate(() => {
      editor.querySelectorAll(`span.bm[data-bm="${CSS.escape(nm)}"]`).forEach(b => Review.unwrap(b));
      const r = getRange();
      const sp = h('span', { class: 'bm', 'data-bm': nm });
      const sameBlock = !r.collapsed && closestOf(r.startContainer, 'p,li,h1,h2,h3,h4,h5,h6,td') === closestOf(r.endContainer, 'p,li,h1,h2,h3,h4,h5,h6,td');
      if (!r.collapsed && sameBlock) { sp.append(r.extractContents()); r.insertNode(sp); }
      else { sp.setAttribute('contenteditable', 'false'); r.collapse(true); r.insertNode(sp); }
    });
    fill(); toast('Bookmark "' + nm + '" added');
  };
  modal('Bookmark', h('div', null, field('Bookmark name', name), list, h('p', { class: 'note' }, 'Double-click a bookmark to go to it. Turn on ¶ (Show/Hide) to see bookmarks in the text.')), [
    { label: 'Delete', fn: () => { if (!list.value) return false; mutate(() => editor.querySelectorAll(`span.bm[data-bm="${CSS.escape(list.value)}"]`).forEach(b => Review.unwrap(b))); fill(); return false; } },
    { label: 'Go To', fn: () => { if (list.value) gotoBookmark(list.value); } },
    { label: 'Add', primary: true, fn: add }]);
}

/* ---------- Cross-references ---------- */
function refTargets(kind) {
  if (kind === 'heading') return headings().map(hd => ({ label: '  '.repeat(+hd.tagName[1] - 1) + hd.textContent.trim().slice(0, 90), el: hd }));
  return bmList().map(b => ({ label: b.getAttribute('data-bm'), name: b.getAttribute('data-bm') }));
}
function ensureHeadingRef(hd) {
  const ex = hd.querySelector('span.bm[data-bm^="_Ref"]');
  if (ex) return ex.getAttribute('data-bm');
  const nm = '_Ref' + (Date.now() % 1e9) + Math.floor(Math.random() * 90 + 10);
  const sp = h('span', { class: 'bm', 'data-bm': nm });
  while (hd.firstChild) sp.append(hd.firstChild);
  hd.append(sp);
  return nm;
}
function xrefDialog() {
  restoreRange();
  const saved = getRange() && getRange().cloneRange();
  const type = h('select', null, h('option', { value: 'heading' }, 'Heading'), h('option', { value: 'bookmark' }, 'Bookmark'));
  const what = h('select', null, h('option', { value: 'text' }, 'Heading or bookmark text'), h('option', { value: 'page' }, 'Page number'), h('option', { value: 'pos' }, 'Above / below'));
  const list = h('select', { size: 10, style: { width: '100%' } });
  let items = [];
  const fill = () => { items = refTargets(type.value); list.innerHTML = ''; items.forEach((it, i) => list.append(h('option', { value: i }, it.label))); if (!items.length) list.append(h('option', { disabled: true }, type.value === 'heading' ? 'No headings yet (use the Heading styles)' : 'No bookmarks yet (Insert › Bookmark)')); };
  type.addEventListener('change', fill); fill();
  modal('Cross-reference', h('div', null, h('div', { class: 'g2' }, field('Reference type', type), field('Insert reference to', what)), list, h('p', { class: 'note' }, 'References update by themselves when the text or page changes. Double-click one in the document to jump to its target.')), [{ label: 'Cancel' }, {
    label: 'Insert', primary: true, fn: () => {
      const it = items[+list.value]; if (!it) { toast('Choose an item'); return false; }
      if (!saved) { toast('Place the cursor in the document first'); return false; }
      lastRange = saved; restoreRange();
      mutate(() => {
        const nm = it.el ? ensureHeadingRef(it.el) : it.name;
        const r = getRange(); r.collapse(false);
        const sp = h('span', { class: 'xref', contenteditable: 'false', 'data-ref': nm, 'data-kind': what.value }, '…');
        const z = document.createTextNode('​');
        r.insertNode(z); r.insertNode(sp);
        const c = document.createRange(); c.setStart(z, 1); c.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(c);
      });
      updateXrefs();
    }
  }]);
}
function updateXrefs() {
  const refs = editor.querySelectorAll('span.xref');
  if (!refs.length) return;
  const g = geom(), stride = g.ph + (ui.printing ? 0 : GAP), print = ui.view === 'print' || ui.printing;
  const pagesTop = $('#pages').getBoundingClientRect().top, z = ui.printing ? 1 : ui.zoom;
  refs.forEach(x => {
    const t = editor.querySelector(`span.bm[data-bm="${CSS.escape(x.getAttribute('data-ref') || '')}"]`);
    let txt;
    if (!t) txt = 'Error! Reference source not found.';
    else {
      const k = x.getAttribute('data-kind');
      if (k === 'page') txt = print ? String(Math.floor((t.getBoundingClientRect().top - pagesTop) / z / stride) + 1) : (x.textContent || '1');
      else if (k === 'pos') txt = t.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING ? 'above' : 'below';
      else txt = (t.textContent || (t.closest('h1,h2,h3,h4,h5,h6,p,li') || t).textContent || '').replace(/​/g, '').trim();
    }
    if (x.textContent !== txt) x.textContent = txt;
  });
}
editor.addEventListener('dblclick', e => {
  const x = e.target.closest && e.target.closest('span.xref');
  if (x) { const t = editor.querySelector(`span.bm[data-bm="${CSS.escape(x.getAttribute('data-ref') || '')}"]`); if (t) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }
});
