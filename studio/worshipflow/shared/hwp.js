// 한글(HWP 5) 문서에서 글과 표를 읽는다 — 외부 프로그램 없이.
// OLE 복합 문서(CFB) → BodyText/Section* (raw deflate) → 레코드(문단 글 · 표 칸 위치).
// 돌려주는 값: { paras: [문단…], tables: [ [ [칸 글…] …행 ] … ] }
(function (G) {
  const u16 = (b, o) => b[o] | (b[o + 1] << 8);
  const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  const END = 0xfffffffa;

  function cfb(b) {
    const sig = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    if (!sig.every((x, i) => b[i] === x)) throw new Error("HWP 5 문서가 아닙니다(.hwpx 는 한글에서 .hwp 로 저장해 주세요)");
    const ssz = 1 << u16(b, 30), mssz = 1 << u16(b, 32);
    const nFat = u32(b, 44), dirStart = u32(b, 48), miniCut = u32(b, 56);
    const miniFatStart = u32(b, 60), nMiniFat = u32(b, 64), difatStart = u32(b, 68), nDifat = u32(b, 72);
    const sec = (i) => b.subarray(512 + i * ssz, 512 + (i + 1) * ssz);
    const difat = [];
    for (let i = 0; i < 109; i++) difat.push(u32(b, 76 + i * 4));
    let d = difatStart;
    for (let k = 0; k < nDifat && d < END; k++) {
      const s = sec(d);
      for (let i = 0; i < ssz / 4 - 1; i++) difat.push(u32(s, i * 4));
      d = u32(s, ssz - 4);
    }
    const fat = [];
    for (const i of difat.slice(0, nFat)) { const s = sec(i); for (let j = 0; j < ssz / 4; j++) fat.push(u32(s, j * 4)); }
    const chain = (start, table) => { const out = [], seen = new Set(); let i = start; while (i < END && !seen.has(i) && i < table.length + 1) { seen.add(i); out.push(i); i = table[i]; } return out; };
    const read = (start) => { const ids = chain(start, fat); const out = new Uint8Array(ids.length * ssz); ids.forEach((i, k) => out.set(sec(i), k * ssz)); return out; };
    const dirs = read(dirStart);
    const ents = [];
    for (let o = 0; o + 128 <= dirs.length; o += 128) {
      const nl = u16(dirs, o + 64);
      let name = ""; for (let i = 0; i < Math.max(0, nl - 2); i += 2) name += String.fromCharCode(u16(dirs, o + i));
      ents.push({ name, typ: dirs[o + 66], left: u32(dirs, o + 68), right: u32(dirs, o + 72), child: u32(dirs, o + 76), start: u32(dirs, o + 116), size: u32(dirs, o + 120) });
    }
    const root = ents[0];
    const mini = root.start < END ? read(root.start) : new Uint8Array(0);
    const miniFat = [];
    if (nMiniFat) for (const i of chain(miniFatStart, fat)) { const s = sec(i); for (let j = 0; j < ssz / 4; j++) miniFat.push(u32(s, j * 4)); }
    const readMini = (start, size) => { const ids = chain(start, miniFat); const out = new Uint8Array(ids.length * mssz); ids.forEach((i, k) => out.set(mini.subarray(i * mssz, (i + 1) * mssz), k * mssz)); return out.subarray(0, size); };
    const streams = {};
    const walk = (idx, path) => {
      if (idx >= ents.length || idx === 0xffffffff) return;
      const e = ents[idx];
      walk(e.left, path); walk(e.right, path);
      const p = path.concat(e.name);
      if (e.typ === 2) streams[p.join("/")] = e.size < miniCut ? readMini(e.start, e.size) : read(e.start).subarray(0, e.size);
      else if (e.typ === 1) walk(e.child, p);
    };
    walk(root.child, []);
    return streams;
  }

  // 문단 글: 8칸짜리 조절 문자는 건너뛰고, 10 = 줄 바꿈
  const EXT = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
  function paraText(b) {
    let s = "";
    for (let i = 0; i + 1 < b.length;) {
      const c = u16(b, i);
      if (c < 32) { if (EXT.has(c)) { if (c === 9) s += "\t"; i += 16; continue; } if (c === 10) s += "\n"; i += 2; continue; }
      s += String.fromCharCode(c); i += 2;
    }
    return s;
  }

  // inflateRaw(바이트) → Promise<바이트>. 한글 문서는 압축 끝 뒤에 남는 바이트가 있어서,
  // 앱에서는 Rust(flate2 — 끝에서 멈춤)에 맡기고, node 시험에서는 zlib 를 너그럽게 쓴다.
  async function inflateRaw(b) {
    if (G.__TAURI__) return new Uint8Array(await G.__TAURI__.core.invoke("inflate_raw", { data: Array.from(b) }));
    const z = require("zlib");
    return new Uint8Array(z.inflateRawSync(Buffer.from(b), { finishFlush: z.constants.Z_SYNC_FLUSH }));
  }

  async function readHwp(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const st = cfb(b);
    const hdr = st["FileHeader"] || new Uint8Array(40);
    const props = hdr.length >= 40 ? u32(hdr, 36) : 1;
    if (props & 2) throw new Error("암호가 걸린 한글 문서입니다");
    const secs = Object.keys(st).filter((k) => k.startsWith("BodyText/Section")).sort((a, c) => +a.split("Section")[1] - +c.split("Section")[1]);
    const paras = [], tables = [];
    for (const k of secs) {
      let raw = st[k];
      if (props & 1) raw = await inflateRaw(raw);
      let o = 0;
      const stack = []; // 열린 표들 { level, cells, cur, cellLevel }
      while (o + 4 <= raw.length) {
        const h = u32(raw, o); o += 4;
        const tag = h & 0x3ff, level = (h >>> 10) & 0x3ff;
        let size = (h >>> 20) & 0xfff;
        if (size === 0xfff) { size = u32(raw, o); o += 4; }
        const body = raw.subarray(o, o + size);
        o += size;
        // 표가 끝났는지(표 머리보다 얕은 레코드가 나오면)
        while (stack.length && level <= stack[stack.length - 1].level && tag !== 72) {
          const t = stack.pop(); tables.push(t.rows());
        }
        if (tag === 71 && body.length >= 4 && String.fromCharCode(body[3], body[2], body[1], body[0]) === "tbl ") {
          const cells = [];
          stack.push({ level, cells, cur: null, rows() {
            // 합쳐진 칸이 덮는 오른쪽 칸들은 "\u0001" 로 표시(가져오는 쪽에서 칸 이름을 판단하게)
            const R = []; for (const c of cells) { const row = (R[c.r] = R[c.r] || []); row[c.c] = c.text.join("\n").trim(); for (let k = 1; k < (c.cs || 1); k++) if (row[c.c + k] == null) row[c.c + k] = "\u0001"; }
            return R.filter(Boolean).map((r) => Array.from(r, (x) => x || ""));
          } });
        } else if (tag === 72 && stack.length) {
          // 표 칸 머리: 문단 수(2) · ?(2) · 속성(4) · 열(2) · 행(2) · 열 합침(2) · 행 합침(2)
          const t = stack[stack.length - 1];
          const off = body.length >= 16 ? 8 : 6;
          const c = u16(body, off), r = u16(body, off + 2), cs = u16(body, off + 4);
          t.cur = { c, r, cs: cs > 0 && cs < 64 ? cs : 1, text: [] }; t.cells.push(t.cur);
        } else if (tag === 67) {
          const txt = paraText(body);
          const t = stack[stack.length - 1];
          if (t && t.cur) t.cur.text.push(txt); else paras.push(txt);
        }
      }
      while (stack.length) tables.push(stack.pop().rows());
    }
    return { paras, tables };
  }

  G.Hwp = { readHwp };
  if (typeof module !== "undefined") module.exports = { readHwp };
})(typeof window !== "undefined" ? window : globalThis);
