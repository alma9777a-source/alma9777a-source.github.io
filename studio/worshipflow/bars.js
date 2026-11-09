// 순서 자막바 — 교회가 만든 자막바 그림 묶음(디자인 / 색 / 01_예배로의부름.png …)을
// 순서가 바뀔 때 생중계 화면(필요하면 예배당 화면에도) 왼쪽 아래에 몇 초 띄운다.
const BARS = (window.BARS = { list: [], sets: {}, made: {}, madeW: {}, making: {} });
const BAR_LABELS = ["예배로의부름", "신앙고백", "찬송", "대표기도", "성경봉독", "찬양", "설교", "봉헌", "교회소식", "축도"];

function barSettings() {
  const st = WF.lib.settings;
  // 같은 묶음을 그대로 고쳐 쓴다(새로 만들면 들고 있던 쪽 변경이 사라짐)
  st.bar = st.bar || {};
  for (const [k, v] of Object.entries({ set: "", color: "", secs: -1, where: "overlay", pos: "left" })) if (st.bar[k] == null) st.bar[k] = v;
  if (!st.bar.pageV) { st.bar.pageV = 1; st.bar.secs = -1; } // 0.3.22 목사님: 초 대신 ‘넘기면 없어짐’을 기본으로(한 번만 바꿈, 초는 다시 고를 수 있음)
  // 0.3.32 목사님: 기본은 단색 한 가지(장식 없이). 그림 묶음 디자인은 목록에서 빼 두고 ‘디자인 더하기’로 꺼내 씀
  if (!st.bar.v2) Object.assign(st.bar, { v2: 1, style: "solid", solid: "#17402c", image: "", added: [] });
  if (!Array.isArray(st.bar.added)) st.bar.added = [];
  return st.bar;
}
// "T01_클래식골드/딥네이비/07_설교.png" → sets["T01_클래식골드"]["딥네이비"]["설교"]
function indexBars(list) {
  BARS.list = list; BARS.sets = {};
  for (const rel of list) {
    const parts = rel.split("/");
    if (parts.length < 3) continue;
    // 맥 파일 이름은 한글이 풀어진 모양(NFD)일 수 있어 맞춰서 비교(파일 경로 rel 은 그대로 둠)
    const [set, color] = parts.slice(-3, -1).map((x) => x.normalize("NFC"));
    const label = parts[parts.length - 1].normalize("NFC").replace(/\.png$/i, "").replace(/^\d+_/, "");
    ((BARS.sets[set] = BARS.sets[set] || {})[color] = BARS.sets[set][color] || {})[label] = rel;
  }
  const b = barSettings();
  const sets = Object.keys(BARS.sets).sort();
  if (sets.length && !BARS.sets[b.set]) b.set = sets[0];
  if (b.set && BARS.sets[b.set] && !BARS.sets[b.set][b.color]) b.color = Object.keys(BARS.sets[b.set]).sort()[0];
}
async function loadBars() {
  if (!Store.inApp) return;
  try { indexBars(await window.__TAURI__.core.invoke("list_bars")); } catch (e) {}
}
const setName = (s) => s.replace(/^T\d+_/, "");

// 순서 항목 → 자막바 이름(항목에서 직접 고른 것이 먼저, 없으면 제목 · 종류로 짐작)
function barLabelFor(it) {
  if (!it) return "";
  if (it.barLabel === "none") return ""; // 고르기는 ‘자동 · 띄우지 않음’ 둘뿐(0.3.37) — 예전에 고른 이름(신앙고백 등)은 자동으로 봄
  const t = it.title || "";
  const rules = [[/부름/, "예배로의부름"], [/신앙고백|사도신경/, "신앙고백"], [/헌금|봉헌/, "봉헌"], [/축도|강복/, "축도"], [/설교|말씀/, "설교"],
    [/성경|봉독/, "성경봉독"], [/기도/, "대표기도"], [/광고|소식/, "교회소식"], [/찬양/, "찬양"], [/찬송/, "찬송"]];
  for (const [re, l] of rules) if (re.test(t)) return l;
  return { song: "찬송", scripture: "성경봉독", sermon: "설교", prayer: "대표기도", fixed: "신앙고백", media: "교회소식" }[it.kind] || "";
}
// 순서 구분 — 자막바 글 · 제목 화면 큰 글이 같은 말: 찬송 · 설교 · 축도 …, 구분이 없으면 순서 이름(결단의 시간). 대기 화면은 구분이 있을 때만
function orderHead(it) {
  if (!it || it.barLabel === "none") return "";
  const label = barLabelFor(it);
  return (BAR_SHOW[label] || label || (it.kind === "standby" ? "" : it.title) || "").trim();
}
// 이 순서에만 다른 디자인 · 색(it.barSet / it.barColor)이 있으면 그것, 없으면 모든 순서 공통
// 단색 바 색(0.3.32)
const BAR_SOLID = [["초록", "#17402c"], ["남색", "#1b2448"], ["버건디", "#5a1f2c"], ["차콜", "#2e3136"], ["검정", "#000000"]];
// 이 순서 자막바 모양: solid 단색 · image 내 그림 · set 더한 디자인(그림 묶음)
function barMode(it) {
  const b = barSettings(), added = (x) => x && b.added.includes(x) && BARS.sets[x];
  if (it && it.barSet && added(it.barSet)) return "set";
  if (b.style === "image" && b.image) return "image";
  if (b.style === "set" && added(b.set)) return "set";
  return "solid";
}
function barPick(it) {
  const b = barSettings(), mode = barMode(it);
  if (mode !== "set") return { set: "", color: "", hex: b.solid || "#17402c", mode };
  let set = it && it.barSet && BARS.sets[it.barSet] && b.added.includes(it.barSet) ? it.barSet : b.set;
  let color = it && it.barSet === set && it.barColor ? it.barColor : b.color;
  if (BARS.sets[set] && !BARS.sets[set][color]) color = Object.keys(BARS.sets[set]).sort()[0];
  return { set, color, hex: BAR_HEX[color] || "", mode };
}
function barRel(label, it) {
  const { set, color } = barPick(it);
  return (((BARS.sets[set] || {})[color] || {})[label]) || "";
}
function barRelOf(set, color, label) { return (((BARS.sets[set] || {})[color] || {})[label]) || ""; }
const BAR_HEX = { 딥네이비: "#1b2448", 딥틸: "#0f4a4f", 버건디: "#5a1f2c", 차콜: "#2e3136" };
function barProjUrl(rel) { return rel && Store.inApp ? window.__TAURI__.core.convertFileSrc(Store.dataPath() + "/bars/" + rel) : ""; }
// ── 빈 바(00_빈바) 위에 앱이 글을 얹어 그리기 ──
// 디자인마다 글자 자리(빈 바 900×230 기준) — 글씨 있는 그림과 빈 바를 비교해서 잰 값(행복드림교회 자막바 묶음 T01~T10).
// mid = 길게 늘릴 때 늘어나는 가운데 구간, inL/inR = 가운데 디자인을 왼쪽 · 오른쪽으로 붙일 때 안쪽 끝, deco = 가운데 장식(줄 · 마름모)
const BAR_LAY = {
  T01_클래식골드: { x: 104, cy: 137, size: 54, f: "Nanum Myeongjo", sp: 14, mid: [420, 600] },
  T02_캡슐: { x: 124, cy: 134, size: 44, f: "Noto Sans KR", w: 800, sp: 4, mid: [300, 520] },
  T03_투톤분할: { x: 262, cy: 133, size: 50, f: "Nanum Myeongjo", sp: 10, mid: [420, 580] },
  T04_미니멀페이드: { x: 72, cy: 143, size: 52, f: "Noto Sans KR", w: 800, sp: 2, mid: [360, 420] },
  T05_사선리본: { x: 104, cy: 136, size: 46, f: "Noto Sans KR", w: 800, sp: 4, mid: [420, 600] },
  T06_클래식프레임: { x: 450, cy: 125, size: 50, f: "Nanum Myeongjo", sp: 12, center: true, deco: true, inL: 140, inR: 760, mid: [400, 500] },
  T07_라이트글래스: { x: 86, cy: 138, size: 52, f: "Nanum Myeongjo", sp: 10, dark: true, mid: [400, 600] },
  T08_스택라벨: { x: 69, cy: 145, size: 48, f: "Noto Sans KR", w: 900, sp: 2, subRight: true, mid: [520, 620] },
  T09_탭영문: { x: 72, cy: 150, size: 48, f: "Nanum Myeongjo", sp: 8, div: true, mid: [300, 560] },
  T10_모던브래킷: { x: 450, cy: 124, size: 50, f: "Noto Sans KR", w: 900, sp: 6, center: true, inL: 130, inR: 670, mid: [300, 600] },
};
// 위쪽 작은 글(행복드림교회 · 주일예배 등) 자리: e = 지울 칸, n = 쓰는 자리 · 모양, def = 그림에 있던 글(가운데 디자인을 옮기거나 늘릴 때 다시 씀)
const BAR_TOP = {
  T01_클래식골드: { e: [80, 47, 360, 77], n: { x: 86, cy: 62, col: "#ffffff" } },
  T02_캡슐: { e: [592, 112, 750, 150], n: { x: 733, cy: 131, right: true, size: 20 } },
  T03_투톤분할: { e: [600, 156, 748, 188], n: { x: 732, cy: 171, right: true, size: 20 } },
  T04_미니멀페이드: { e: [66, 68, 340, 100], n: { x: 72, cy: 84 } },
  T05_사선리본: { e: [104, 53, 358, 79], n: { x: 110, cy: 66 } },
  T06_클래식프레임: { e: [262, 155, 540, 184], n: { x: 450, cy: 170, center: true, size: 20 }, def: "행복드림교회  ·  주일예배" },
  T07_라이트글래스: { e: [80, 48, 352, 77], n: { x: 88, cy: 63, col: "#ffffff" } },
  T08_스택라벨: { e: [52, 63, 420, 93], n: { x: 60, cy: 78, col: "#141a33", w: 800, size: 20 } },
  T09_탭영문: { e: [618, 96, 748, 122], n: { x: 733, cy: 109, right: true, size: 18 } },
  T10_모던브래킷: { e: [262, 150, 540, 178], n: { x: 450, cy: 164, center: true, size: 20, w: 700 }, def: "행복드림교회  ·  주일예배" },
};
const BAR_LONG = 1728; // 길게: 화면 1920 에서 양쪽 96씩 비움
const BAR_SHOW = { 예배로의부름: "예배로의 부름" };
function barWipe(x, x0, y0, x1, y1) { // 칸 바로 위 · 바로 아래 줄 색을 세로로 이어 채움(바탕이 위아래로 짙어져도 티 안 나게)
  x0 = Math.round(x0); x1 = Math.round(x1); const H = y1 - y0 + 2, W = x1 - x0, d = x.getImageData(x0, y0 - 1, W, H);
  for (let xx = 0; xx < W; xx++) { const a = xx * 4, b = ((H - 1) * W + xx) * 4; for (let yy = 1; yy < H - 1; yy++) { const k = (yy * W + xx) * 4, t = yy / (H - 1); for (let j = 0; j < 4; j++) d.data[k + j] = d.data[a + j] * (1 - t) + d.data[b + j] * t; } }
  x.putImageData(d, x0, y0 - 1);
}
function barEraseGold(x, x0, x1, cy, soft) { // 글자 자리를 지나가는 금색 줄 · 마름모는 지움(위 줄 색으로) — 줄은 글 끝 뒤부터 다시 이어짐
  x0 = Math.max(0, Math.round(x0)); x1 = Math.min(x.canvas.width, Math.round(x1)); const y0 = cy - 30, W = x1 - x0, H = 60; if (W <= 0) return;
  const d = x.getImageData(x0, y0, W, H);
  for (let xx = 0; xx < W; xx++) for (let yy = 1; yy < H; yy++) { const k = (yy * W + xx) * 4; if ((soft ? d.data[k] - d.data[k + 2] > 14 && d.data[k] > 45 : d.data[k] > 105 && d.data[k] - d.data[k + 2] > 40) && d.data[k + 3] > 200) { const u = ((yy - 1) * W + xx) * 4; for (let j = 0; j < 4; j++) d.data[k + j] = d.data[u + j]; } }
  x.putImageData(d, x0, y0);
}
// img = 빈 바 그림, o = { title, side, top, align, long, color } → 캔버스
function drawBarArt(img, set, o) {
  const L = BAR_LAY[set], T = BAR_TOP[set], W = o.long ? BAR_LONG : 900, ext = W - 900, c = document.createElement("canvas"); c.width = W; c.height = 230;
  const x = c.getContext("2d"), [a, b] = L.mid, sx = (v) => (v <= a ? v : v >= b ? v + ext : v + ((v - a) / (b - a)) * ext);
  x.drawImage(img, 0, 0, a, 230, 0, 0, a, 230); x.drawImage(img, a, 0, b - a, 230, a, 0, b - a + ext, 230); x.drawImage(img, b, 0, 900 - b, 230, b + ext, 0, 900 - b, 230);
  const align = o.align || (L.center ? "center" : "left");
  // 위쪽 작은 글: 바꿨거나, 가운데 디자인을 늘렸거나 옆으로 옮겼으면 지우고 다시 씀(아니면 그림 그대로)
  if (o.top || (T.def && (ext || align !== "center"))) {
    const [e0, ey0, e1, ey1] = T.e; barWipe(x, sx(e0), ey0, sx(e1), ey1);
    const n = T.n; x.save(); x.font = `${n.w || 600} ${n.size || 22}px "Noto Sans KR"`; x.letterSpacing = "4px"; x.fillStyle = n.col || "#d9b86a"; x.textBaseline = "middle";
    let tx = sx(n.x), ta = n.center ? "center" : n.right ? "right" : "left";
    if (L.center) { ta = align; tx = align === "left" ? L.inL : align === "right" ? sx(L.inR) : W / 2; }
    x.textAlign = ta; x.fillText(o.top || T.def, tx, n.cy); x.restore();
  }
  // 큰 글 + 옆 글(같은 줄)
  const fT = `${L.w || 800} ${L.size}px "${L.f}"`, fS = `600 26px "Noto Sans KR"`;
  x.font = fT; x.letterSpacing = L.sp + "px"; const tw = x.measureText(o.title).width;
  x.font = fS; x.letterSpacing = "3px"; const sw = o.side ? x.measureText(o.side).width : 0, gap = o.side ? (L.div ? 46 : 26) : 0;
  const group = tw + (L.subRight ? 0 : gap + sw);
  let x0 = L.x;
  if (L.center) x0 = align === "left" ? L.inL : align === "right" ? sx(L.inR) - group : W / 2 - group / 2;
  else if (align === "center") x0 = W / 2 - group / 2;
  else if (align === "right") x0 = sx(L.subRight ? 733 : 728) - group; // 오른쪽 끝 장식에 붙지 않게(0.3.27)
  if (L.deco && align !== "center") barWipe(x, L.inL - 20, L.cy - 16, sx(L.inR) + 20, L.cy + 16); // 가운데 장식 지우기
  if (L.center && align !== "center") barEraseGold(x, L.inL - 30, sx(L.inR) + 30, L.cy, true);
  else if (L.center || align !== "left") barEraseGold(x, x0 - 50, x0 + group + 50, L.cy);
  else barEraseGold(x, x0 - 16, x0 + tw + 26, L.cy);
  x.textBaseline = "middle"; x.textAlign = "left";
  x.font = fT; x.letterSpacing = L.sp + "px"; x.fillStyle = L.dark ? BAR_HEX[o.color] || "#1b2448" : "#ffffff"; x.shadowColor = L.dark ? "transparent" : "rgba(0,0,0,.35)"; x.shadowBlur = 6;
  x.fillText(o.title, x0, L.cy + 2); x.shadowBlur = 0;
  if (o.side) {
    x.font = fS; x.letterSpacing = "3px"; x.fillStyle = L.dark ? "#5b6170" : "#e3c27a";
    if (L.subRight) { x.letterSpacing = "5px"; x.textAlign = "right"; x.fillText(o.side, sx(733), L.cy + 2); }
    else { const s0 = x0 + tw + gap; if (L.div) x.fillRect(s0 - 24, L.cy - 22, 2, 44); x.fillText(o.side, s0, L.cy + 3); }
  }
  return c;
}
// 옆 글을 비워 두면: 기도 = 기도하시는 분, 설교 = 설교자(‘빼기’를 누르면 none)
function barAutoSide(it) {
  if (it.kind === "prayer") return ((it.prayer || {}).name || "").trim();
  if (it.kind === "sermon") return ((it.sermon || {}).preacher || "").trim();
  return "";
}
// 이 순서 자막바를 어떻게 띄울지 — 고친 것이 없으면 묶음의 글씨 있는 그림 그대로, 고쳤으면 빈 바 위에 그림
function barSpec(it) {
  if (!it || it.barLabel === "none") return null;
  const label = barLabelFor(it), { set, color } = barPick(it);
  const title = (it.barText || "").trim() || orderHead(it);
  if (!title) return null;
  let side = it.barSide === "none" ? "" : (it.barSide || "").trim() || barAutoSide(it);
  if (side && [title, label, BAR_SHOW[label], it.title, "대표기도", "설교"].includes(side) && !(it.barSide || "").trim()) side = ""; // 이름 칸에 ‘대표기도’만 있을 때 두 번 나오지 않게
  const mode = barMode(it);
  if (mode !== "set") {
    const b = barSettings(), o2 = { mode, hex: b.solid || "#17402c", image: mode === "image" ? b.image : "", title, side, align: it.barAlign || "", long: !!it.barLong };
    return Object.assign(o2, { name: barHash(JSON.stringify(["v2", o2])) });
  }
  const o = { set, color, title, side, top: (it.barTop || "").trim(), align: it.barAlign || "", long: !!it.barLong };
  const orig = label ? barRelOf(set, color, label) : "";
  const blank = barRelOf(set, color, "빈바");
  const custom = (it.barText && it.barText.trim() && it.barText.trim() !== (BAR_SHOW[label] || label)) || o.side || o.top || o.align || o.long;
  if ((!custom || !blank || !BAR_LAY[set]) && orig) return { rel: orig, w: 900 };
  if (!blank || !BAR_LAY[set]) return null;
  return Object.assign(o, { blank, name: barHash(JSON.stringify(["v1", o, blank])) });
}
function barHash(str) { let h1 = 5381, h2 = 52711; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = (h1 * 33) ^ c; h2 = (h2 * 31) ^ c; } return "b" + (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16); }
// 자막바 그림 → { rel(bars/ 안 경로), w } — 아직 안 만든 그림이면 만들기 시작하고 null(다 되면 다시 그림)
function barImage(it) {
  const sp = barSpec(it);
  if (!sp) return null;
  if (sp.rel) return sp;
  if (BARS.made[sp.name]) return { rel: BARS.made[sp.name], w: BARS.madeW[sp.name] || (sp.long ? BAR_LONG : 900) };
  if (!BARS.making[sp.name]) BARS.making[sp.name] = makeBar(sp).then(([rel, w]) => {
    BARS.made[sp.name] = rel; BARS.madeW[sp.name] = w; delete BARS.making[sp.name];
    if (WF.live || WF.barTest) sendLive();
    if (WF.mode === "prep") { renderBarCard(); drawOvPreview(); }
  }).catch((e) => { delete BARS.making[sp.name]; console.warn("자막바 만들기 실패", e); });
  return null;
}
async function makeBar(sp) {
  await Promise.all([document.fonts.load(`800 40px "Noto Sans KR"`), document.fonts.load(`800 40px "Nanum Myeongjo"`), document.fonts.load(`500 30px "Noto Sans KR"`)]);
  const read = async (path) => createImageBitmap(new Blob([new Uint8Array(await window.__TAURI__.core.invoke("read_user_file", { path }))]));
  let c;
  if (sp.mode === "solid") c = drawSolidBar(null, sp);
  else if (sp.mode === "image") c = drawSolidBar(await read(Store.dataPath() + "/media/" + sp.image), sp);
  else c = drawBarArt(await read(Store.dataPath() + "/bars/" + sp.blank), sp.set, sp);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  const data = Array.from(new Uint8Array(await blob.arrayBuffer()));
  return [await window.__TAURI__.core.invoke("save_bar_png", { name: sp.name, data }), c.width];
}
// 단색 바(0.3.32): 장식 없이 한 색 + 큰 글 · 옆 글. img 가 있으면 한 색 대신 교회가 넣은 바 그림을 늘여 깔고 그 위에 글
function drawSolidBar(img, o) {
  const H = 116, pad = 46, gap = 28, fT = `800 52px "Noto Sans KR"`, fS = `500 32px "Noto Sans KR"`;
  const m = document.createElement("canvas").getContext("2d");
  m.font = fT; m.letterSpacing = "4px"; const tw = m.measureText(o.title).width;
  m.font = fS; m.letterSpacing = "2px"; const sw = o.side ? m.measureText(o.side).width : 0;
  const group = tw + (o.side ? gap + sw : 0);
  let W = Math.ceil(pad * 2 + group);
  if (img) W = Math.max(W, Math.round(H * img.width / img.height));
  if (o.long) W = Math.max(W, BAR_LONG);
  W = Math.min(W, BAR_LONG);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  if (img) x.drawImage(img, 0, 0, W, H);
  else { x.fillStyle = o.hex; x.beginPath(); x.roundRect(0, 0, W, H, 10); x.fill(); }
  const h = String(o.hex || "#000").replace("#", ""), n = parseInt(h.length === 3 ? h.split("").map((q) => q + q).join("") : h, 16);
  const light = !img && (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 170;
  const fg = light ? "#1d1d1f" : "#ffffff";
  const x0 = o.align === "center" ? (W - group) / 2 : o.align === "right" ? W - pad - group : pad;
  x.textBaseline = "middle"; x.textAlign = "left"; x.fillStyle = fg;
  if (img) { x.shadowColor = "rgba(0,0,0,.5)"; x.shadowBlur = 8; }
  x.font = fT; x.letterSpacing = "4px"; x.fillText(o.title, x0, H / 2 + 2);
  if (o.side) { x.font = fS; x.letterSpacing = "2px"; x.globalAlpha = 0.85; x.fillText(o.side, x0 + tw + gap, H / 2 + 3); x.globalAlpha = 1; }
  return c;
}
// 지금 상태에 실어 보낼 자막바(순서가 바뀔 때마다, 또는 ‘다시 보이기’를 누를 때마다 새 key)
function barState() {
  const b = barSettings();
  // 아직 아무것도 내보내지 않았을 때는 ‘띄워 보기’로 고른 순서를 시험으로 띄울 수 있다
  const it = itemAt(WF.live) || (WF.barTest ? WF.svc.items.find((x) => x.id === WF.barTest) : null);
  if (b.where === "off" || !it || WF.flags.black || WF.flags.logo || WF.flags.emergency) return null;
  const bi = barImage(it);
  if (!bi) return null;
  const sp = barSpec(it) || {}, label = barLabelFor(it);
  const txt = { title: sp.title || (it.barText || "").trim() || orderHead(it), side: sp.side || "" };
  let key = it.id + ":" + WF.itemStart + ":" + (WF.barKick || 0);
  let hideText = false;
  // 0.3.32 목사님: 순서 자막바가 떠 있는 동안 OBS 하단 자막(설교 제목 · 기도자 이름)은 띄우지 않음 — 성경 · 가사 화면에서는 자막바가 내려가므로 그대로
  if (WF.live) { const at = barWhen(it, +b.secs); if (!at) return null; key += ":" + at; hideText = true; }
  return { key, hideText, overlayUrl: "/bars/" + bi.rel.split("/").map(encodeURIComponent).join("/"), projUrl: b.where === "both" ? barProjUrl(bi.rel) : "", secs: +b.secs > 0 ? +b.secs : 0, w: bi.w, pos: b.pos || "left", text: txt };
}
// 예배 중 자막바를 언제 띄울지(0.3.22): 순서에 들어와도 카운트다운 화면에서는 기다렸다가, 그다음 화면(투명 화면 · 더한 화면)에서 띄운다.
// ‘넘기면’(secs -1)은 띄운 화면에서 넘기는 순간 내리고, 같은 순서 안에서는 다시 띄우지 않는다(‘순서 자막바 ▶’로는 다시).
// 띄운 때(at)를 돌려준다 — 0 이면 지금은 띄우지 않음
// 0.3.29: 순서 자막바와 가사 · 성경 · 고정 문구 하단 자막(예: 사도신경)은 한 화면에 같이 내지 않는다 —
// 자막바는 제목 화면 · 투명 화면처럼 하단 자막이 없는 화면에서만 뜨고, 하단 자막 화면으로 넘기면 내려감.
// ‘순서 자막바 ▶’로 하단 자막 화면에서 일부러 띄우면 그 화면에서는 하단 자막을 잠깐 숨긴다(hideText)
function barWhen(it, secs) {
  const token = it.id + ":" + (WF.itemSeq || 0) + ":" + (WF.barKick || 0), kicked = (WF.barKick || 0) !== (WF.barKickAt || 0);
  let t = WF.barShow;
  if (!t || t.token !== token) t = WF.barShow = { token, slide: -1, at: 0, done: false };
  const s = slideAt(WF.live), text = barTextSlide(it, s);
  if (t.slide < 0) {
    const rs = s ? resolveSlide(it, s) : null;
    const countdown = rs && (rs.kind === "standby" || (rs.kind === "media" && rs.cd && rs.cd.on));
    if ((countdown || text) && !kicked) return 0;
    t.slide = WF.live.slide; t.at = Date.now();
  }
  if (WF.live.slide !== t.slide && (secs === -1 || text)) t.done = true;
  return t.done ? 0 : t.at;
}
// 이 화면이 가사 · 성경 · 고정 문구 · 글처럼 아래에 글 띠가 나가는 화면인지
function barTextSlide(it, s) {
  const rs = it && s ? resolveSlide(it, s) : null;
  return !!(rs && rs.kind === "text" && Render.overlayContent(rs));
}
async function importBarsDialog(after) {
  if (!Store.inApp) return;
  const p = await window.__TAURI__.dialog.open({ directory: true, multiple: false, title: "자막바 폴더 고르기(디자인 폴더들이 들어 있는 폴더)" });
  if (!p) return;
  try {
    const list = await window.__TAURI__.core.invoke("import_bars", { src: Array.isArray(p) ? p[0] : p });
    indexBars(list); BARS.made = {}; markDirty("lib");
    Store.message(list.length ? `자막바 그림 ${list.length}장을 가져왔습니다 — 디자인 ${Object.keys(BARS.sets).length}가지.` : "이 폴더에서 png 그림을 찾지 못했습니다.");
    if (after) after();
  } catch (e) { Store.message("가져오지 못했습니다: " + e); }
}
function kickBar() { WF.barKick = (WF.barKick || 0) + 1; sendLive(); }

// ── 준비 화면 오른쪽 ‘순서 자막바’ 카드 — 누르면 미리보기 · 생중계에 바로 반영 ──
// 0.3.32: 모양 = 단색(기본) · 내 그림 · 더한 디자인. 그림 묶음 디자인은 ‘디자인 더하기’로 꺼낸 것만 보임
function barModeLabel(b) { return b.style === "image" ? "내 그림" : b.style === "set" && b.added.includes(b.set) ? "디자인 · " + setName(b.set) : "단색"; }
function renderBarCard() {
  const card = document.getElementById("barCard"); if (!card) return;
  const it = typeof selItem === "function" ? selItem() : null;
  if (!it) { card.innerHTML = ""; return; }
  const b = barSettings();
  const label = barLabelFor(it);
  const mode = barMode(it);
  const own = !!it.barSet && mode === "set";
  const scope = WF.barScope || (own ? "item" : "all");
  const { set, color } = barPick(it);
  const allSets = Object.keys(BARS.sets).sort();
  const added = b.added.filter((x) => BARS.sets[x]);
  const live = WF.live && itemAt(WF.live) === it;
  const seg = (name, opts, cur) => `<span class="seg" data-seg="${name}">${opts.map(([v, n]) => `<b data-v="${v}" class="${String(cur) === String(v) ? "on" : ""}">${n}</b>`).join("")}</span>`;
  const viewSeg = `<span class="seg bview" data-seg="view"><b data-v="one" class="${WF.barView !== "all" ? "on" : ""}">이 순서</b><b data-v="all" class="${WF.barView === "all" ? "on" : ""}">전체 순서 한눈에</b></span>`;
  if (WF.barView === "all") {
    card.innerHTML = `<div class="bt">순서 자막바 ${viewSeg}<span class="muted small" style="margin-left:auto">${esc(barModeLabel(b))} · ${+b.secs === -1 ? "넘기면 없어짐" : +b.secs ? b.secs + "초" : "계속"} · ${({ overlay: "생중계", both: "생중계 + 예배당", off: "끄기" })[b.where] || ""}</span></div>
      <div class="ball">${WF.svc.items.map((x, i) => { const bi = barImage(x), sp = barSpec(x); return `<div class="bone ${x === it ? "on" : ""} ${sp ? "" : "off"}" data-i="${i}"><span class="bnm">${i + 1} · ${esc(x.title)}${sp ? "" : ` <em>${x.barLabel === "none" ? "띄우지 않음" : "자막바 없음"}</em>`}</span>${bi ? `<img src="${barProjUrl(bi.rel)}" style="width:${Math.round(bi.w / BAR_LONG * 100)}%">` : sp ? `<div class="bwait">만드는 중…</div>` : `<div class="bwait">—</div>`}</div>`; }).join("")}</div>
      <div class="muted small" style="margin-top:6px">누르면 그 순서로 가서 ‘이 순서’ 칸이 열립니다 · 띄우지 않는 순서는 흐리게</div>`;
    card.querySelectorAll(".bone").forEach((el) => (el.onclick = () => { WF.barView = "one"; WF.sel = { item: +el.dataset.i, slide: 0 }; renderPrep(); }));
    card.querySelectorAll('[data-seg="view"] b').forEach((x) => (x.onclick = () => { WF.barView = x.dataset.v; renderBarCard(); }));
    return;
  }
  const style = b.style === "image" ? "image" : b.style === "set" ? "set" : "solid";
  const imgMedia = b.image ? (WF.lib.media || []).find((m) => m.file === b.image) : null;
  let body = "";
  if (style === "solid") {
    const known = BAR_SOLID.some(([, h]) => h.toLowerCase() === String(b.solid).toLowerCase());
    body = `<div class="blab"><span>색 — 모든 순서 같은 색</span></div>
      <div class="dots">${BAR_SOLID.map(([n, h]) => `<div data-solid="${h}"><i class="${h.toLowerCase() === String(b.solid).toLowerCase() ? "on" : ""}" style="background:${h}"></i><em>${n}</em></div>`).join("")}
        <label class="dpick" title="다른 색 고르기"><i class="${known ? "" : "on"}" style="background:${known ? "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)" : esc(b.solid)}"></i><em>직접</em><input type="color" id="bcSolidPick" value="${esc(b.solid)}"></label></div>`;
  } else if (style === "image") {
    body = `<div class="blab"><span>내 그림 — 교회에서 만든 바 그림(PNG) 위에 글을 얹습니다</span></div>
      <div class="brow wrap">${b.image ? `<img class="bmine" src="${Store.mediaUrl(b.image)}" title="${esc(imgMedia ? imgMedia.name : "")}">` : ""}<button class="btn sm" id="bcImgPick">${b.image ? "그림 바꾸기" : "＋ 바 그림 넣기"}</button></div>`;
  } else {
    const colors = Object.keys(BARS.sets[set] || {}).sort();
    const show = label || "설교";
    body = `<div class="blab"><span>더한 디자인 — 누르면 바로 바뀜</span><span>${own ? "이 순서만 따로" : "모든 순서 같은 디자인"}</span></div>
      ${added.length ? `<div class="thumbs">${added.map((s) => { const r = barRelOf(s, BARS.sets[s][color] ? color : Object.keys(BARS.sets[s]).sort()[0], show); return `<div class="${s === set ? "on" : ""}" data-set="${esc(s)}" title="${esc(setName(s))}">${r ? `<img src="${barProjUrl(r)}">` : ""}<span>${esc(setName(s))}</span><b class="bdel" data-del="${esc(s)}" title="목록에서 빼기">✕</b></div>`; }).join("")}</div>
      <div class="brow"><div class="dots">${colors.map((c) => `<div data-color="${esc(c)}"><i class="${c === color ? "on" : ""}" style="background:${BAR_HEX[c] || "#555"}"></i><em>${esc(c)}</em></div>`).join("")}</div>
        <div class="bscope"><div class="blab"><span></span><span>바꾸면</span></div>${seg("scope", [["item", "이 순서만"], ["all", "모든 순서"]], scope)}</div></div>` : `<div class="muted small">아직 더한 디자인이 없습니다. 아래 ‘＋ 디자인 더하기’에서 고르세요.</div>`}
      <button class="btn sm" id="bcAddOpen" style="margin-top:8px">${WF.barAddOpen ? "닫기" : "＋ 디자인 더하기"}</button>
      ${WF.barAddOpen ? (allSets.length ? `<div class="thumbs badd">${allSets.filter((s) => !added.includes(s)).map((s) => { const c0 = Object.keys(BARS.sets[s]).sort()[0], r = barRelOf(s, c0, show); return `<div data-add="${esc(s)}" title="${esc(setName(s))} 더하기">${r ? `<img src="${barProjUrl(r)}">` : ""}<span>＋ ${esc(setName(s))}</span></div>`; }).join("")}</div>
        <div class="bimp"><span class="muted small">자막바 묶음: ${allSets.length}가지 디자인 · 그림 ${BARS.list.length}장</span><button class="btn xs" id="bcImport2">묶음 바꾸기</button></div>`
        : `<div class="bimp"><span class="muted small">교회 자막바 그림 묶음을 가져오면 여기서 고를 수 있습니다.</span><button class="btn xs" id="bcImport2">자막바 폴더 가져오기</button></div>`) : ""}`;
  }
  const canText = mode !== "set" || (BAR_LAY[set] && barRelOf(set, color, "빈바"));
  const head = orderHead(Object.assign({}, it, { barLabel: "" }));
  card.innerHTML = `<div class="bt">순서 자막바 ${viewSeg}<span style="flex:1"></span>· ${esc(it.title)} <span class="tag ${barSpec(it) ? "green" : ""}">${it.barLabel === "none" ? "띄우지 않음" : esc((it.barText || "").trim() || head || "없음")}</span></div>
    <div class="brow wrap"><span class="muted small">띄울 자막바</span><select id="bcLabel"><option value="">자동 — 순서 이름 따라${head ? " (" + esc(head) + ")" : ""}</option><option value="none" ${it.barLabel === "none" ? "selected" : ""}>띄우지 않음</option></select></div>
    <div class="blab"><span>모양 — 모든 순서</span></div>
    ${seg("style", [["solid", "단색 (기본)"], ["image", "내 그림"], ["set", "더한 디자인"]], style)}
    ${body}
    ${barSpec(it) ? `<div class="bprev">${(() => { const bi = barImage(it); return bi ? `<img src="${barProjUrl(bi.rel)}" style="width:${Math.round(bi.w / BAR_LONG * 100)}%">` : `<span class="muted small">자막바 그리는 중…</span>`; })()}</div>` : ""}
    ${canText ? `<div class="blab"><span>글 — 비워 두면 자동 · 바꾸면 위 그림에 바로</span><span>이 순서만</span></div>
    <div class="bfields">
      <label><span>큰 글</span><input id="bcText" value="${esc(it.barText || "")}" placeholder="${esc(head || "예: 특송 · 성찬식")}"></label>
      <label><span>옆 글</span><input id="bcSide" value="${esc(it.barSide === "none" ? "" : it.barSide || "")}" placeholder="${esc(it.barSide === "none" ? "넣지 않음" : (barSpec(it) || {}).side || "맡은 분 · 곡 이름 · 본문")}">${barAutoSide(it) || it.barSide ? `<button class="btn sm" id="bcSideNone" title="옆 글 넣지 않기 / 다시 넣기">${it.barSide === "none" ? "넣기" : "빼기"}</button>` : ""}</label>
      ${mode === "set" ? `<label><span>위쪽 작은 글</span><input id="bcTop" value="${esc(it.barTop || "")}" placeholder="비우면 그림 그대로(행복드림교회 · 주일예배)"></label>` : ""}
      <div class="brow wrap"><span class="muted small">배열</span>${seg("align", [["", "기본"], ["left", "왼쪽"], ["center", "가운데"], ["right", "오른쪽"]], it.barAlign || "")}<span class="muted small">길이</span>${seg("long", [["", "기본"], ["1", "길게"]], it.barLong ? "1" : "")}</div>
    </div>` : ""}
    <div class="blab"><span>정렬 — 자막바를 화면 어디에(모든 순서)</span></div>
    <div class="brow wrap">${seg("pos", [["left", "왼쪽 아래"], ["center", "가운데 아래"], ["right", "오른쪽 아래"]], b.pos || "left")}</div>
    <div class="blab"><span>보이는 시간 · 어디에</span></div>
    <div class="brow wrap">${seg("secs", [[-1, "넘기면"], [5, "5초"], [8, "8초"], [12, "12초"], [0, "계속"]], b.secs)}${seg("where", [["overlay", "생중계"], ["both", "+예배당"], ["off", "끄기"]], b.where)}</div>
    <div class="muted small" style="margin-top:6px">자막바가 떠 있는 동안 OBS 하단 자막(설교 제목 · 기도자 이름)은 나가지 않습니다. 성경 · 가사는 그대로.</div>
    <button class="btn primary go" id="bcGo" ${!barSpec(it) || b.where === "off" || (WF.live && !live) ? "disabled" : ""}>${live ? "지금 생중계에 다시 띄우기 ▶" : WF.live ? "이 순서가 나갈 때 뜹니다" : "생중계에 띄워 보기 ▶"} <kbd>T</kbd></button>`;
  // 바꾼 순서가 지금 나가는 순서일 때만 생중계에 다시 띄움(다른 순서를 고칠 때 지금 자막바가 다시 뜨지 않게)
  const changed = () => { markDirty(); renderSelPreview(); renderBarCard(); if (WF.live) { if (live) kickBar(); } else if (WF.barTest) { WF.barTest = it.id; kickBar(); } };
  const changedAll = () => { markDirty("lib"); renderSelPreview(); renderBarCard(); if (WF.live) kickBar(); else if (WF.barTest) kickBar(); };
  card.querySelectorAll("[data-set]").forEach((el) => (el.onclick = (e) => {
    if (e.target.closest("[data-del]")) return;
    const s = el.dataset.set;
    if ((WF.barScope || (own ? "item" : "all")) === "item") { it.barSet = s; if (!BARS.sets[s][it.barColor || b.color]) it.barColor = Object.keys(BARS.sets[s]).sort()[0]; }
    else { b.set = s; if (!BARS.sets[s][b.color]) b.color = Object.keys(BARS.sets[s]).sort()[0]; }
    markDirty(); changedAll();
  }));
  card.querySelectorAll("[data-del]").forEach((el) => (el.onclick = (e) => {
    e.stopPropagation(); const s = el.dataset.del;
    b.added = b.added.filter((x) => x !== s);
    (WF.svc.items || []).forEach((x) => { if (x.barSet === s) { delete x.barSet; delete x.barColor; } });
    if (b.set === s) b.set = b.added[0] || b.set;
    if (!b.added.length && b.style === "set") b.style = "solid";
    markDirty(); changedAll();
  }));
  card.querySelectorAll("[data-add]").forEach((el) => (el.onclick = () => {
    const s = el.dataset.add; if (!b.added.includes(s)) b.added.push(s);
    b.set = s; if (!BARS.sets[s][b.color]) b.color = Object.keys(BARS.sets[s]).sort()[0];
    b.style = "set"; WF.barAddOpen = false; changedAll();
  }));
  card.querySelectorAll("[data-color]").forEach((el) => (el.onclick = () => {
    if ((WF.barScope || (own ? "item" : "all")) === "item") { it.barColor = el.dataset.color; if (!it.barSet) it.barSet = set; }
    else b.color = el.dataset.color;
    markDirty(); changedAll();
  }));
  card.querySelectorAll("[data-solid]").forEach((el) => (el.onclick = () => { b.solid = el.dataset.solid; changedAll(); }));
  const sp = document.getElementById("bcSolidPick"); if (sp) sp.onchange = () => { b.solid = sp.value; changedAll(); };
  const ip = document.getElementById("bcImgPick"); if (ip) ip.onclick = async () => {
    const paths = await Store.pickFiles({ multiple: false, title: "순서 자막바 그림 고르기(PNG · 가로로 긴 바 그림)", filters: [{ name: "그림", extensions: ["png", "jpg", "jpeg", "webp"] }] });
    if (!paths.length) return;
    try {
      const r = await Store.importMedia(paths[0]); addMediaToLib(r);
      const m = WF.lib.media.find((x) => x.file === r.file); if (m) { m.hidden = false; m.folder = "mf-lower"; }
      b.image = r.file; b.style = "image"; changedAll();
    } catch (e) { Store.message("넣지 못했습니다: " + e); }
  };
  const ao = document.getElementById("bcAddOpen"); if (ao) ao.onclick = () => { WF.barAddOpen = !WF.barAddOpen; renderBarCard(); };
  card.querySelectorAll("[data-seg]").forEach((sg) => sg.querySelectorAll("b").forEach((x) => (x.onclick = () => {
    const v = x.dataset.v, name = sg.dataset.seg;
    if (name === "view") { WF.barView = v; renderBarCard(); return; }
    if (name === "style") {
      b.style = v;
      if (v === "set" && !added.length) WF.barAddOpen = true;
      if (v === "image" && !b.image) { renderBarCard(); document.getElementById("bcImgPick").click(); return; }
      changedAll(); return;
    }
    if (name === "scope") {
      WF.barScope = v;
      if (v === "all" && (it.barSet || it.barColor)) { delete it.barSet; delete it.barColor; markDirty("svc"); }
      renderSelPreview(); return;
    }
    if (name === "align" || name === "long") {
      if (name === "align") { if (v) it.barAlign = v; else delete it.barAlign; } else { if (v) it.barLong = true; else delete it.barLong; }
      changed(); return;
    }
    if (name === "secs") b.secs = +v;
    if (name === "where") b.where = v;
    if (name === "pos") b.pos = v;
    markDirty("lib"); renderSelPreview(); if (WF.live) kickBar();
  })));
  const lb = document.getElementById("bcLabel"); if (lb) lb.onchange = () => { it.barLabel = lb.value === "none" ? "none" : ""; changed(); };
  const field = (id, key) => { const el = document.getElementById(id); if (el) el.onchange = () => { const v = el.value.trim(); if (v) it[key] = v; else if (!(key === "barSide" && it.barSide === "none")) delete it[key]; changed(); }; };
  field("bcText", "barText"); field("bcSide", "barSide"); field("bcTop", "barTop");
  const none = document.getElementById("bcSideNone"); if (none) none.onclick = () => { if (it.barSide === "none") delete it.barSide; else it.barSide = "none"; changed(); };
  const imp = document.getElementById("bcImport2"); if (imp) imp.onclick = () => importBarsDialog(() => renderPrep());
  const go = document.getElementById("bcGo");
  if (go) go.onclick = () => { if (!WF.live) WF.barTest = it.id; kickBar(); };
}
