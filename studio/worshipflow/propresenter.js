// 프로프리젠터 자료 가져오기 → 곡 보관함
//  · ProPresenter 6: .pro6 (XML, 글은 RTF 를 base64 로)  · 묶음 .pro6x (zip)
//  · ProPresenter 7: .pro (protobuf, 글은 RTF)          · 묶음 .probundle (zip, 안에 .pro + 미디어)
// 부분 이름(Verse 1 · Chorus · Bridge …)은 [1절] [후렴] [브리지] 로 바꾸고, 슬라이드 순서대로 넣는다.
// (공개 자료가 없는 PP7 은 형식을 짐작해 읽는다 — 글과 부분 이름 중심)

// RTF → 글자: \uN 유니코드 · \'hh · \par/\line 줄 바꿈, 글꼴표 · 색표 같은 묶음은 버림
function rtfToText(rtf) {
  let out = "", i = 0, depth = 0, skipDepth = -1, ucSkip = 1;
  const s = String(rtf);
  while (i < s.length) {
    const ch = s[i];
    if (ch === "{") { depth++; i++; if (s.startsWith("\\*", i) || /^\\(fonttbl|colortbl|stylesheet|info|expandedcolortbl|listtable|pict)/.test(s.slice(i, i + 20))) if (skipDepth < 0) skipDepth = depth; continue; }
    if (ch === "}") { if (depth === skipDepth) skipDepth = -1; depth--; i++; continue; }
    if (ch === "\\") {
      const m = s.slice(i).match(/^\\([a-z]+)(-?\d+)? ?|^\\'([0-9a-f]{2})|^\\(.)/i);
      if (!m) { i++; continue; }
      i += m[0].length;
      if (skipDepth >= 0) continue;
      if (m[3]) { out += String.fromCharCode(parseInt(m[3], 16)); continue; }
      if (m[4]) { if (m[4] === "\n" || m[4] === "\r") out += "\n"; else if ("\\{}".includes(m[4])) out += m[4]; continue; }
      const w = m[1], n = m[2];
      if (w === "par" || w === "line") out += "\n";
      else if (w === "tab") out += "\t";
      else if (w === "uc") ucSkip = +n;
      else if (w === "u") { let c = +n; if (c < 0) c += 65536; out += String.fromCharCode(c); i += ucSkip; }
      continue;
    }
    if (skipDepth >= 0 || ch === "\r" || ch === "\n") { i++; continue; }
    out += ch; i++;
  }
  return out.replace(/\u2028|\u2029/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// 부분 이름 → 우리 이름
function ppGroup(name) {
  const n = String(name || "").trim();
  let m;
  if ((m = n.match(/^(?:verse|v|절)\s*(\d+)$/i) || n.match(/^(\d+)\s*절$/))) return m[1] + "절";
  if (/^(chorus|refrain|후렴)\s*\d*$/i.test(n)) return "후렴";
  if (/^(pre-?chorus)/i.test(n)) return "전후렴";
  if (/^(bridge|브리지|브릿지)\s*\d*$/i.test(n)) return "브리지";
  if (/^(ending|outro|tag|엔딩)/i.test(n)) return "엔딩";
  if (/^(intro|전주)/i.test(n)) return "전주";
  return n;
}
const GROUP_RE = /^(verse|chorus|refrain|pre-?chorus|bridge|tag|ending|outro|intro|blank|group|\d+\s*절|절\s*\d+|후렴|브리지|브릿지|엔딩|전주|간주)\s*\d*$/i;

// ── PP6 (.pro6 XML) ──
function parsePro6(text, fileName) {
  const d = new DOMParser().parseFromString(text, "application/xml");
  const root = d.documentElement;
  const title = root.getAttribute("CCLISongTitle") || fileName;
  const secs = [];
  for (const g of Array.from(d.getElementsByTagName("RVSlideGrouping"))) {
    const slides = [];
    for (const s of Array.from(g.getElementsByTagName("RVDisplaySlide"))) {
      if (s.getAttribute("enabled") === "false") continue;
      const texts = [];
      for (const te of Array.from(s.getElementsByTagName("RVTextElement"))) {
        const plain = te.getElementsByTagName("NSString");
        const rtfB64 = te.getAttribute("RTFData") || Array.from(plain).map((x) => x.getAttribute("rvXMLIvarName") === "RTFData" ? x.textContent : "").join("");
        let t = "";
        if (rtfB64) { try { t = rtfToText(new TextDecoder("utf-8").decode(Uint8Array.from(atob(rtfB64.trim()), (c) => c.charCodeAt(0)))); } catch (e) {} }
        if (!t) t = (te.getAttribute("PlainText") ? atob(te.getAttribute("PlainText")) : "");
        if (t.trim()) texts.push(t.trim());
      }
      if (texts.length) slides.push(texts.join("\n"));
    }
    if (slides.length) secs.push({ name: ppGroup(g.getAttribute("name")), slides });
  }
  return { title, secs, author: root.getAttribute("CCLIAuthor") || "" };
}

// ── PP7 (.pro protobuf): 설명서 없이 짐작 — 길이로 묶인 칸을 따라 내려가며 RTF 글과 부분 이름을 차례로 모은다 ──
function parsePro7(bytes, fileName) {
  const dec = new TextDecoder("utf-8", { fatal: false });
  const seq = []; // { kind: 'rtf'|'str', v }
  function varint(b, o) { let r = 0, s = 0, x; do { x = b[o++]; r += (x & 127) * 2 ** s; s += 7; } while (x & 128 && o < b.length); return [r, o]; }
  function walk(b, depth) {
    let o = 0;
    while (o < b.length) {
      let key; [key, o] = varint(b, o);
      const wt = key & 7;
      if (wt === 0) { [, o] = varint(b, o); }
      else if (wt === 1) o += 8;
      else if (wt === 5) o += 4;
      else if (wt === 2) {
        let len; [len, o] = varint(b, o);
        if (len < 0 || o + len > b.length) return false;
        const sub = b.subarray(o, o + len); o += len;
        const head = dec.decode(sub.subarray(0, 6));
        if (head.startsWith("{\\rtf")) { seq.push({ kind: "rtf", v: rtfToText(dec.decode(sub)) }); continue; }
        // 하위 메시지처럼 보이면 내려가 보고, 아니면 글자
        if (depth < 40 && len > 1 && walkTry(sub, depth + 1)) continue;
        const str = dec.decode(sub);
        if (/^[\x20-\x7eㄱ-힣\s\-:]{1,40}$/.test(str)) seq.push({ kind: "str", v: str.trim() });
      } else return false;
    }
    return true;
  }
  function walkTry(b, depth) { const mark = seq.length; const ok = walk(b, depth); if (!ok) seq.length = mark; return ok; }
  walk(bytes, 0);
  // 부분 이름이 나오면 새 부분, RTF 가 나오면 그 부분의 화면
  const secs = []; let cur = null;
  let title = fileName;
  for (const x of seq) {
    if (x.kind === "str" && GROUP_RE.test(x.v)) { cur = { name: ppGroup(x.v), slides: [] }; secs.push(cur); continue; }
    if (x.kind === "rtf" && x.v.trim()) { if (!cur) { cur = { name: "", slides: [] }; secs.push(cur); } if (!cur.slides.includes(x.v.trim())) cur.slides.push(x.v.trim()); }
  }
  // 같은 이름의 부분이 여러 번(배열 정보) 나오면 글이 있는 첫 번째만
  const seen = new Set();
  return { title, secs: secs.filter((s) => s.slides.length && !seen.has(s.name) && (seen.add(s.name) || true)) };
}

function songFromParsed(p) {
  const text = p.secs.map((s) => (s.name ? `[${s.name}]\n` : "") + s.slides.join("\n\n")).join("\n\n");
  return { id: uid("song"), title: p.title, author: p.author || "", source: "프로프리젠터에서 가져옴", license: "", order: "", text, created: Date.now() };
}

// 파일 여러 개(.pro · .pro6 · .probundle · .pro6x) → 곡들
async function importProPresenter() {
  if (!Store.inApp) return;
  const paths = await Store.pickFiles({ multiple: true, title: "프로프리젠터 자료 고르기", filters: [{ name: "프로프리젠터", extensions: ["pro", "pro6", "probundle", "pro6x", "proBundle"] }] });
  if (!paths.length) return;
  const added = [], failed = [];
  const T = window.__TAURI__.core;
  for (const p of paths) {
    const base = p.split("/").pop().replace(/\.[^.]+$/, "");
    try {
      const ext = p.split(".").pop().toLowerCase();
      const parsed = [];
      if (ext === "probundle" || ext === "pro6x") {
        const z = await Zip.openZipPath(p);
        for (const n of z.names.filter((n) => /\.pro6?$/i.test(n) && !n.startsWith("__MACOSX"))) {
          const nm = n.split("/").pop().replace(/\.[^.]+$/, "");
          if (/\.pro6$/i.test(n)) parsed.push(parsePro6(await z.text(n), nm));
          else parsed.push(await parsePro7FromZip(z, n, nm));
        }
      } else if (ext === "pro6") parsed.push(parsePro6(await Store.readUserFile(p), base));
      else parsed.push(parsePro7(new Uint8Array(await T.invoke("read_user_file", { path: p })), base));
      for (const x of parsed) { if (!x.secs.length) { failed.push(x.title); continue; } const s = songFromParsed(x); WF.lib.songs.push(s); added.push(s.title); }
    } catch (e) { failed.push(base); }
  }
  markDirty("lib");
  if (window.renderLibrary && WF.mode === "library") renderLibrary();
  Store.message(`프로프리젠터 곡 ${added.length}개를 보관함에 넣었습니다.` + (failed.length ? `\n글을 찾지 못함: ${failed.join(", ")}` : "") + (added.length ? "\n\n부분 이름(절 · 후렴)이 바르게 들어왔는지 보관함에서 한 번 확인해 주세요." : ""));
}
// probundle 안의 .pro: 앱 바탕에서 바이트로 꺼내 짐작해 읽기
async function parsePro7FromZip(z, name, title) {
  const r = await window.__TAURI__.core.invoke("zip_bytes_entry", { path: z.path, name });
  return parsePro7(new Uint8Array(r || []), title);
}
