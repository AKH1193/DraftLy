/* DraftLy: minimal ZIP reader/writer (no dependencies). Uses the browser's
   CompressionStream / DecompressionStream for deflate. */
const Zip = (() => {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  const enc = new TextEncoder();

  async function deflate(data) {
    if (typeof CompressionStream === 'undefined') return null;
    try {
      const s = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(s).arrayBuffer());
    } catch (e) { return null; }
  }
  async function inflate(data) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot read compressed files. Please update it.');
    const s = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }

  /* files: [{name, data: string | Uint8Array}] -> Blob */
  async function build(files, mime) {
    const parts = [], central = [];
    let offset = 0;
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (const f of files) {
      const name = enc.encode(f.name);
      const raw = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const crc = crc32(raw);
      let comp = await deflate(raw), method = 8;
      if (!comp || comp.length >= raw.length) { comp = raw; method = 0; }
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, method, true); lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, comp.length, true); lh.setUint32(22, raw.length, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, comp);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true); ch.setUint16(10, method, true); ch.setUint16(12, dosTime, true);
      ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true); ch.setUint32(20, comp.length, true);
      ch.setUint32(24, raw.length, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + comp.length;
    }
    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: mime || 'application/zip' });
  }

  async function read(arrayBuffer) {
    const u8 = new Uint8Array(arrayBuffer);
    const dv = new DataView(arrayBuffer);
    let e = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65558); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    }
    if (e < 0) throw new Error('This is not a valid .docx file. (Old .doc files must first be saved as .docx.)');
    const count = dv.getUint16(e + 10, true);
    let p = dv.getUint32(e + 16, true);
    const entries = {};
    const dec = new TextDecoder();
    for (let i = 0; i < count; i++) {
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      entries[name] = { method, csize, lho };
      p += 46 + nlen + xlen + clen;
    }
    const find = n => entries[n] ? n : Object.keys(entries).find(k => k.toLowerCase() === n.toLowerCase());
    return {
      names: Object.keys(entries),
      has(n) { return !!find(n); },
      async bytes(n) {
        const k = find(n); if (!k) return null;
        const en = entries[k], l = en.lho;
        const start = l + 30 + dv.getUint16(l + 26, true) + dv.getUint16(l + 28, true);
        const data = u8.subarray(start, start + en.csize);
        return en.method === 0 ? data.slice() : inflate(data);
      },
      async text(n) { const b = await this.bytes(n); return b ? dec.decode(b) : null; }
    };
  }
  return { build, read, crc32 };
})();
