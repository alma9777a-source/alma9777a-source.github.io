// zip 묶음(.pptx · .probundle) 읽기 — 가운데 목록을 읽고, 압축된 파일은 Rust(inflate_raw)로 푼다.
(function (G) {
  const u16 = (b, o) => b[o] | (b[o + 1] << 8);
  const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  async function inflate(b) {
    if (G.__TAURI__) return new Uint8Array(await G.__TAURI__.core.invoke("inflate_raw", { data: Array.from(b) }));
    return new Uint8Array(require("zlib").inflateRawSync(Buffer.from(b)));
  }
  // 돌려주는 값: { names: [...], read(name) → Promise<Uint8Array>, text(name) → Promise<string> }
  function openZip(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("압축 묶음(zip) 파일이 아닙니다");
    const n = u16(b, eocd + 10), cdOff = u32(b, eocd + 16);
    const ents = {};
    let o = cdOff;
    const dec = new TextDecoder("utf-8");
    for (let k = 0; k < n && u32(b, o) === 0x02014b50; k++) {
      const method = u16(b, o + 10), csize = u32(b, o + 20), nlen = u16(b, o + 28), xlen = u16(b, o + 30), clen = u16(b, o + 32), lho = u32(b, o + 42);
      const name = dec.decode(b.subarray(o + 46, o + 46 + nlen));
      ents[name] = { method, csize, lho };
      o += 46 + nlen + xlen + clen;
    }
    const read = async (name) => {
      const e = ents[name]; if (!e) return null;
      const lo = e.lho, start = lo + 30 + u16(b, lo + 26) + u16(b, lo + 28);
      const data = b.subarray(start, start + e.csize);
      return e.method === 0 ? data : await inflate(data);
    };
    return { names: Object.keys(ents), read, text: async (name) => { const r = await read(name); return r ? dec.decode(r) : null; } };
  }
  // 큰 파일: 앱 바탕(Rust)에서 필요한 부분만 꺼낸다
  async function openZipPath(path) {
    const inv = G.__TAURI__.core.invoke;
    const names = await inv("zip_list", { path });
    return { names, path, text: (name) => inv("zip_text", { path, name }), saveMedia: (name) => inv("zip_save_media", { path, name }) };
  }
  G.Zip = { openZip, openZipPath };
  if (typeof module !== "undefined") module.exports = { openZip };
})(typeof window !== "undefined" ? window : globalThis);
