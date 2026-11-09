// WorshipFlow 조작 창 — 자료 · 화면 만들기 · 지금/다음 엔진 · 단축키 · 저장.
// 화면별 그리기는 prep.js(준비) · live.js(예배 중) · library.js(보관함) · settings.js(설정).
const WF = (window.WF = {
  version: "0.3.33",
  lib: null,          // 보관함(곡 · 고정 문구 · 역본 목록 · 그림 · 모양 · 설정)
  bibles: {},         // 불러온 역본 본문 {id: {books}}
  services: [],       // 예배 목록 [{id, title, date, updatedAt}]
  svc: null,          // 지금 고른 예배
  mode: "prep",
  sel: { item: 0, slide: 0 },   // 준비 화면에서 고른 것
  live: null,                    // 지금 나가는 화면 {item, slide}
  cue: null,                     // 다음 {item, slide}
  flags: { black: false, clear: false, logo: false, emergency: false, cam: false },
  undo: [],
  seq: 1,
  rehearsal: false,
  serviceStart: 0,
  itemStart: 0,
  projOn: false,
  projMonitor: "",
  monitors: [],
});

const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const esc = Render.esc;
const uid = (p) => (p || "") + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = (o) => JSON.parse(JSON.stringify(o));

// 넣을 수 있는 그림 · 영상(맥에서 안 열리는 영상은 넣을 때 mp4 로 저절로 바뀜)
const MEDIA_EXT = ["jpg", "jpeg", "png", "gif", "webp", "heic", "mp4", "mov", "m4v", "avi", "wmv", "mkv", "flv", "mpg", "mpeg", "vob", "3gp", "ts", "m2ts", "webm"];
const VIDEO_RE = /^(mp4|mov|m4v|webm)$/i;
// 오디오(예배 전 음악 · MR) — 맥에서 바로 재생되는 것만
const AUDIO_EXT = ["mp3", "m4a", "aac", "wav", "aif", "aiff", "flac"];
const AUDIO_RE = /^(mp3|m4a|aac|wav|aif|aiff|flac)$/i;
const KINDS = {
  standby: { name: "대기 · 로고", icon: "○", color: "#8a93a6" },
  song: { name: "찬송 · 찬양", icon: "♪", color: "#f2c94c" },
  fixed: { name: "고정 문구", icon: "✦", color: "#56cfb2" },
  prayer: { name: "기도 이름표", icon: "◎", color: "#a99cf0" },
  scripture: { name: "성경봉독", icon: "☰", color: "#6fcf97" },
  sermon: { name: "설교", icon: "✝", color: "#64a8f5" },
  media: { name: "광고 · 그림 · 영상", icon: "▣", color: "#f2786f" },
  text: { name: "글 화면", icon: "T", color: "#b8bfcc" },
  design: { name: "파워포인트 화면", icon: "P", color: "#e58a4a" },
  camera: { name: "카메라 · 투명 화면", icon: "◌", color: "#7fb3d9" },
};

/* ───────── 보관함 기본값 ───────── */
function defaultLib() {
  return {
    schemaVersion: 1,
    songs: clone(Samples.SONGS),
    fixed: clone(Samples.FIXED),
    bibles: [{ id: Samples.SAMPLE_BIBLE.id, name: Samples.SAMPLE_BIBLE.name, note: Samples.SAMPLE_BIBLE.note, count: 12 }],
    media: [],
    // 저장공간: 곡 묶음(새찬송가 · 모든 곡은 저절로) · 미디어 묶음
    songFolders: [],
    mediaFolders: [
      { id: "mf-pre", name: "예배 전 영상" }, { id: "mf-bg", name: "배경 영상" },
      { id: "mf-ad", name: "광고 그림 · 영상" }, { id: "mf-standby", name: "대기 화면 영상" }, { id: "mf-lower", name: "생중계 하단 템플릿" }, { id: "mf-mr", name: "찬양 MR", audio: true }, { id: "mf-bgm", name: "예배 전 음악", audio: true },
    ],
    themes: {},
    settings: {
      churchName: "행복드림교회",
      defaultBible: Samples.SAMPLE_BIBLE.id,
      projMonitor: "",
      logoMedia: "", standbyText: "행복드림교회", standbySub: "",
      emergencyMedia: "", emergencyText: "잠시 기다려 주십시오",
      videoEnd: "stop",
      noticeSeen: false,
    },
  };
}
// 옛 자료에 새 칸이 없으면 더해 준다(지우거나 이름을 바꾸지 않는다)
function upgradeLib(lib) {
  const d = defaultLib();
  for (const k of Object.keys(d)) if (lib[k] == null) lib[k] = d[k];
  for (const k of Object.keys(d.settings)) if (lib.settings[k] == null) lib.settings[k] = d.settings[k];
  return lib;
}

function nextSunday(from) {
  const d = from ? new Date(from) : new Date();
  d.setHours(12);
  const add = (7 - d.getDay()) % 7;
  d.setDate(d.getDate() + add);
  return d.toISOString().slice(0, 10);
}
function dateLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// 새 예배 — 행복드림교회 주일 순서 기본 틀
function newService(title, date) {
  const it = (kind, title, minutes, data) => Object.assign({ id: uid("i"), kind, title, minutes, slides: [] }, data || {});
  const svc = {
    schemaVersion: 1, id: uid("s"), title: title || "주일 예배", date: date || nextSunday(),
    createdAt: Date.now(), updatedAt: Date.now(),
    items: [
      it("standby", "예배로 부름", 2, { standby: { text: "", sub: "" } }),
      it("song", "찬송", 4, { song: { songId: "" } }),
      it("fixed", "신앙고백", 2, { fixed: { fixedId: "fx-creed" } }),
      it("song", "찬양", 12, { song: { songId: "song-sample" } }),
      it("prayer", "대표기도", 4, { prayer: { name: "", role: "대표기도" } }),
      it("scripture", "성경봉독", 3, { scripture: { ref: "요 13:1-5", bibleId: "", split: "fit" } }),
      it("sermon", "설교", 35, { sermon: { title: "", ref: "요 13:1-5", preacher: "", points: [], verses: [] } }),
      it("song", "헌금 찬송", 4, { song: { songId: "" } }),
      it("media", "광고", 5, { media: { files: [], text: "", auto: 0 } }),
      it("text", "축도", 1, { text: { text: "" } }),
    ],
  };
  for (const item of svc.items) item.slides = buildSlides(item);
  return svc;
}

/* ───────── 화면 만들기 ───────── */
function bibleFor(id) {
  id = id || WF.lib.settings.defaultBible;
  if (WF.bibles[id]) return WF.bibles[id];
  if (id === Samples.SAMPLE_BIBLE.id) return (WF.bibles[id] = Samples.SAMPLE_BIBLE);
  return null;
}
async function loadBible(id) {
  if (!id || bibleFor(id)) return bibleFor(id);
  const b = await Store.loadJSON(`bibles/${id}.json`, null);
  if (b) WF.bibles[id] = b;
  return b;
}
// 루마키 모드(모드 B): 예배당 화면을 ‘생중계 겸용’으로 — 검은 바탕, 아래쪽 2줄, 그림자 없음.
const LUMA = { bg: "#000000", bgMedia: "", dim: 0, valign: "bottom", maxLines: 2, shadow: false, margin: 6, refPos: "top" };
function themeOf(item) {
  const t = Render.themeFor(item.kind, WF.lib, item);
  if (WF.lib.settings.lumaMode && item.kind !== "standby" && item.kind !== "media") Object.assign(t, LUMA, { size: Math.min(t.size, 64) });
  return t;
}
function overlayTheme() {
  const t = Object.assign({}, Render.OVERLAY, WF.lib.themes.overlay || {});
  // 내 하단 템플릿 그림을 보관함에서 숨겼거나 지웠으면 기본(어두운 띠)으로
  if (String(t.tpl).startsWith("my:") && !lowerTplList().some((m) => "my:" + m.file === t.tpl)) t.tpl = "a";
  return t;
}
// 교회가 넣은 생중계 하단 템플릿 그림(보관함 ‘생중계 하단 템플릿’ 묶음)
function lowerTplList() { return (WF.lib.media || []).filter((m) => m.folder === "mf-lower" && !m.hidden && /^(png|jpe?g|webp|gif)$/i.test(m.ext || "")); }

// 강단 페이지에 보일 글
function slideText(s) {
  if (!s) return "";
  if (s.kind === "titlecard") { const it = WF.svc && WF.svc.items.find((x) => x.slides.includes(s)); return it ? tcLines(it).map((l) => l.t).filter(Boolean).join("\n") : "(제목 화면)"; }
  if (s.kind === "title") return [s.sub, s.title].filter(Boolean).join("\n");
  if (s.kind === "prayer") return [s.role, s.name].filter(Boolean).join(" · ");
  if (s.kind === "cam") return "(투명 화면 · 카메라)";
  if (s.kind === "media") return s.text || `(그림 · 영상: ${s.mediaName || ""})`;
  if (s.kind === "standby") return s.text || WF.lib.settings.standbyText || "(대기 화면)";
  return s.text || "";
}
// 찬양 부분 색 꼬리표: 절 = 청록 · 후렴 = 빨강 · 브리지 = 보라 · 그 밖 = 회색, 구석에 단축키
function partTag(s) {
  if (!s || !s.section) return null;
  const k = Render.sectionKey(s.section);
  const color = /^\d$/.test(k) ? "#2f8f86" : k === "R" ? "#c2453f" : k === "G" ? "#7a5ad6" : "#5d6676";
  return { color, key: k };
}
function partBadge(s) { const p = partTag(s); return p && p.key ? `<span class="pkey" style="background:${p.color}">${p.key}</span>` : ""; }
function partStyle(s) { const p = partTag(s); return p ? ` style="--part:${p.color}"` : ""; }
function slideLabel(s) { return s ? s.section || (s.group && s.group !== "본문" ? s.group : "") || s.ref || "" : ""; }

// 붙여 넣은 본문 → 절. “1 유월절 전에… 2 마귀가…” · “13:1 유월절…” 처럼 절 번호가 차례로 나오는 곳에서만 나눈다
// (본문 속 숫자 ‘12 제자’ 같은 것은 차례가 맞지 않으면 무시). 번호가 없으면 통째로 한 절.
function pastedVerses(text, refs) {
  const r = refs[0];
  let t = String(text || "").replace(/<[^>]*>/g, " ").replace(/[\[［][^\]］]*[\]］]/g, " ").replace(/\s+/g, " ").trim();
  if (!t || !r) return [];
  const marks = [];
  const re = /(?:^|\s)(?:(\d{1,3})\s*:\s*)?(\d{1,3})\s*(?:절)?\s+(?=\S)/g;
  let m, expect = r.v1 || null, ch = r.c1;
  while ((m = re.exec(t))) {
    const v = +m[2], c = m[1] ? +m[1] : ch;
    if (expect == null) expect = v;
    if (v === expect && (!m[1] || c === ch || c === ch + 1)) {
      if (m[1] && c !== ch) ch = c;
      marks.push({ at: m.index, end: re.lastIndex, c: ch, v });
      expect = v + 1;
    } else if (m[1] && v === 1 && c === ch + 1) { // 다음 장으로 넘어감
      ch = c; marks.push({ at: m.index, end: re.lastIndex, c, v }); expect = 2;
    }
  }
  if (!marks.length) return [{ book: r.book, c: r.c1, v: r.v1 || 1, text: t }];
  const out = [];
  marks.forEach((mk, i) => {
    const body = t.slice(mk.end, i + 1 < marks.length ? marks[i + 1].at : t.length).trim();
    if (body) out.push({ book: r.book, c: mk.c, v: mk.v, text: body });
  });
  return out;
}

function scriptureSlides(refStr, bibleId, theme, split, bibleId2, pasted) {
  const refs = Bible.parseRef(refStr);
  if (!refs.length) return { slides: [], error: refStr ? "장절을 알아볼 수 없습니다" : "" };
  const bible = pasted ? { name: "붙여 넣은 본문" } : bibleFor(bibleId);
  if (!bible) return { slides: [], error: "성경 역본을 불러오지 못했습니다" };
  const verses = pasted ? pastedVerses(pasted, refs) : Bible.getVerses(bible, refs);
  if (!verses.length) return { slides: [], error: `이 역본(${bible.name || ""})에 ${Bible.refsLabel(refs, true)} 본문이 없습니다 — 아래 ‘본문 붙여 넣기’로 넣을 수 있습니다`, noText: true };
  const label = (g) => {
    const a = g[0], z = g[g.length - 1], zv = z.v2 || z.v; // 묶은 절(신6:18-19)은 뒷 번호까지
    const bk = Bible.BOOKS[a.book];
    if (a.c === z.c && a.v === zv) return `${bk} ${a.c}:${a.v}`;
    if (a.c === z.c) return `${bk} ${a.c}:${a.v}-${zv}`;
    return `${bk} ${a.c}:${a.v}-${z.c}:${zv}`;
  };
  // 두 역본 함께: 절 단위로 나누고(글자 수 맞춤은 한 절씩) 같은 절의 둘째 역본 글을 붙인다
  const bible2 = bibleId2 ? bibleFor(bibleId2) : null;
  if (bible2) {
    const v2 = {};
    for (const v of Bible.getVerses(bible2, refs)) v2[v.c + ":" + v.v] = v.text;
    const n = split === "2" ? 2 : 1;
    const out = [];
    for (let i = 0; i < verses.length; i += n) {
      const g = verses.slice(i, i + n);
      out.push({ kind: "text", text: g.map((v) => v.text).join(" "), text2: g.map((v) => v2[v.c + ":" + v.v] || "").join(" ").trim(), ref: label(g), verses: g.map((v) => v.c + ":" + v.v) });
    }
    const miss = verses.filter((v) => !v2[v.c + ":" + v.v]).length;
    return { slides: out, error: miss ? `둘째 역본(${bible2.name || ""})에 ${miss}절이 없습니다` : "" };
  }
  return { slides: Render.splitVerses(verses, theme, split || "fit", label), error: "" };
}

// 교회력 시기와 색(카운트다운 ‘교회력 색 띠’) — 날짜(예배일)로 계산. 부활절은 그레고리력 계산법.
function easterOf(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mo - 1, da);
}
// 카운트다운 색(팔레트): 말씀 카드 · 원형 타이머 · 새 템플릿이 함께 씀. ‘auto’ = 예배 날짜의 교회력 색
const CD_PALS = {
  cream: { name: "미색", bg: "#faf6ee", bg2: "#efe7d6", fg: "#17402c", accent: "#a8873a", glow: "rgba(232,199,121,.28)", glow2: "rgba(42,107,71,.14)", pill: "#ffffff", pillFg: "#2a6b47", dark: false },
  marble: { name: "흰 대리석", bg: "#ffffff", bg2: "#eceae6", fg: "#2b2b2b", accent: "#8a8a8a", glow: "rgba(0,0,0,.05)", glow2: "rgba(0,0,0,.04)", pill: "#f2f2f2", pillFg: "#2b2b2b", dark: false },
  green: { name: "깊은 초록", bg: "#17402c", bg2: "#0e2a1d", fg: "#f6efd9", accent: "#e8c779", glow: "rgba(232,199,121,.18)", glow2: "rgba(120,200,150,.12)", pill: "rgba(255,255,255,.1)", pillFg: "#e8c779", dark: true },
  navy: { name: "남색 밤", bg: "#13213f", bg2: "#0b1430", fg: "#ffffff", accent: "#9fb6ff", glow: "rgba(120,150,255,.22)", glow2: "rgba(255,220,150,.1)", pill: "rgba(255,255,255,.1)", pillFg: "#ffffff", dark: true },
  purple: { name: "보라", bg: "#3e2257", bg2: "#24123a", fg: "#f6eefe", accent: "#c7a6ea", glow: "rgba(199,166,234,.2)", glow2: "rgba(255,200,240,.1)", pill: "rgba(255,255,255,.12)", pillFg: "#f1e4ff", dark: true },
  crimson: { name: "진홍", bg: "#6d1a1a", bg2: "#3e0c0c", fg: "#fff3e8", accent: "#f2b28c", glow: "rgba(255,170,110,.22)", glow2: "rgba(255,230,180,.1)", pill: "rgba(255,255,255,.12)", pillFg: "#ffe9d6", dark: true },
  whitegold: { name: "흰빛 금", bg: "#fffaf0", bg2: "#f1e2b8", fg: "#5a420e", accent: "#a8873a", glow: "rgba(255,230,160,.5)", glow2: "rgba(201,162,74,.18)", pill: "#ffffff", pillFg: "#7a5a12", dark: false },
  stone: { name: "회색 돌", bg: "#e9e7e2", bg2: "#d4d0c8", fg: "#3b3a36", accent: "#8b8578", glow: "rgba(255,255,255,.4)", glow2: "rgba(0,0,0,.06)", pill: "#ffffff", pillFg: "#3b3a36", dark: false },
  sky: { name: "하늘", bg: "#cfe6f7", bg2: "#f3f8fc", fg: "#1f4a6e", accent: "#5f8fb4", glow: "rgba(255,255,255,.6)", glow2: "rgba(95,143,180,.16)", pill: "#ffffff", pillFg: "#1f4a6e", dark: false },
};
// 대기 화면 4K 영상: 보관함 ‘대기 화면 영상’ 묶음(또는 어디든)에 정해진 이름의 영상이 있으면 그 영상 위에 글 · 숫자만 얹음
// 색을 직접 고르면(영상은 색이 정해져 있어서) 지금처럼 그림. 이름은 띄어쓰기 · 밑줄 · 대소문자 · 맥 한글 자모 나뉨을 가리지 않음
const SB_LOOP = { mcross: "cross", mglass: "glass", march: "arches", mseason: "season", maurora: "aurora", mwater: "water" };
function standbyLoop(design, month, pal) {
  const eng = SB_LOOP[design]; if (!eng || !window.CDM) return null;
  let want = CDM.LOOPS[eng];
  if (eng === "season") { const m = month || new Date().getMonth() + 1; want += "_" + (m >= 3 && m <= 5 ? "봄" : m >= 6 && m <= 8 ? "여름" : m >= 9 && m <= 11 ? "가을" : "겨울"); }
  const norm = (x) => String(x || "").normalize("NFC").replace(/\.[a-z0-9]+$/i, "").replace(/[\s_·\-]/g, "").toLowerCase();
  const key = norm(want), vids = WF.lib.media.filter((m) => !m.hidden && /^(mp4|mov|m4v)$/i.test(m.ext || "") && norm(m.name || String(m.file).split("/").pop()) === key);
  const hit = vids.find((m) => m.folder === "mf-standby") || vids[0];
  return { want, file: hit && !pal ? hit.file : "", found: !!hit };
}
function cdPal(key, iso) {
  if (!key) return null;
  if (key === "auto") { const n = seasonOf(iso).name; return Object.assign({ auto: true }, CD_PALS[/대림|사순/.test(n) ? "purple" : /고난|성령강림절/.test(n) ? "crimson" : /성탄|부활/.test(n) ? "whitegold" : /추수/.test(n) ? "cream" : "green"]); }
  if (CD_PALS[key]) return CD_PALS[key];
  const m = String(key).match(/^#([0-9a-f]{6})$/i); if (!m) return null; // 직접 고른 색: 밝기에 따라 글자색
  const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, light = 0.299 * r + 0.587 * g + 0.114 * b > 150;
  const sh = (v, k) => Math.max(0, Math.min(255, Math.round(v * k))), bg2 = "#" + [r, g, b].map((v) => sh(v, light ? 0.92 : 0.7).toString(16).padStart(2, "0")).join("");
  return light ? { bg: key, bg2, fg: "#22262b", accent: "#6b6f66", glow: "rgba(255,255,255,.4)", glow2: "rgba(0,0,0,.06)", pill: "#ffffff", pillFg: "#22262b", dark: false }
    : { bg: key, bg2, fg: "#ffffff", accent: "#e8e2d0", glow: "rgba(255,255,255,.12)", glow2: "rgba(255,255,255,.06)", pill: "rgba(255,255,255,.12)", pillFg: "#ffffff", dark: true };
}
function seasonOf(iso) {
  const d = iso ? new Date(iso + "T12:00:00") : new Date(), y = d.getFullYear(), day = 86400000;
  const ea = easterOf(y), ash = new Date(ea - 46 * day), palm = new Date(ea - 7 * day), pent = new Date(+ea + 49 * day);
  const xmas = new Date(y, 11, 25), adv = new Date(xmas - ((xmas.getDay() || 7) + 21) * day); // 성탄 전 넷째 주일
  const nov = new Date(y, 10, 1), thanks = new Date(y, 10, 1 + ((7 - nov.getDay()) % 7) + 14); // 11월 셋째 주일(추수감사)
  const S = (name, c1, c2) => ({ name, c1, c2 });
  if (d >= xmas || d < new Date(y, 0, 6)) return S("성탄절", "#c9a24a", "#7a5a1e");
  if (d < ash) return S("주현절", "#2f7a4c", "#1d5233");
  if (d < palm) return S("사순절", "#5b3a7a", "#33204a");
  if (d < ea) return S("고난 주간", "#8a2430", "#4a1219");
  if (d < pent) return S("부활절", "#c9a24a", "#7a5a1e");
  if (d < new Date(+pent + 7 * day)) return S("성령강림절", "#c0392b", "#7a1f16");
  if (d >= adv) return S("대림절", "#4b2c7a", "#2a1648");
  if (d >= thanks && d < new Date(+thanks + 7 * day)) return S("추수감사절", "#c27a2c", "#7a4516");
  return S("성령강림 후 · 연중", "#2f7a4c", "#1d5233");
}
function buildSlides(item) {
  const th = themeOf(item);
  const k = item.kind;
  item.error = "";
  if (k === "song") {
    const song = WF.lib.songs.find((s) => s.id === (item.song || {}).songId);
    if (!song) { item.error = "곡을 고르세요"; return []; }
    return songSlides(song);
  }
  if (k === "fixed") {
    const fx = WF.lib.fixed.find((f) => f.id === (item.fixed || {}).fixedId);
    if (!fx) { item.error = "고정 문구를 고르세요"; return []; }
    return fixedSlides(fx);
  }
  if (k === "scripture") {
    const s = item.scripture || {};
    const r = scriptureSlides(s.ref, s.bibleId, th, s.split, s.bibleId2, s.pasted && s.pasted.trim() ? s.pasted : "");
    item.error = r.error;
    item.noText = !!r.noText;
    return r.slides;
  }
  if (k === "sermon") {
    const s = item.sermon || {};
    const refs = Bible.parseRef(s.ref || "");
    const out = [{ kind: "title", title: s.title || "설교 제목", sub: refs.length ? Bible.refsLabel(refs) : (s.ref || ""), foot: s.preacher || "", group: "설교 제목" }];
    if (s.showText && refs.length) {
      for (const sl of scriptureSlides(s.ref, s.bibleId, Render.themeFor("scripture", WF.lib), "fit").slides) out.push(Object.assign(sl, { group: "본문" }));
    }
    (s.points || []).forEach((p, i) => { if (p && p.trim()) out.push({ kind: "text", text: p.trim(), ref: s.pointRef ? `요점 ${i + 1}` : "", group: `요점 ${i + 1}` }); });
    for (const v of s.verses || []) {
      const r = scriptureSlides(v, s.bibleId, Render.themeFor("scripture", WF.lib), "fit");
      if (r.slides.length) for (const sl of r.slides) out.push(Object.assign(sl, { group: v }));
      else out.push({ kind: "text", text: `(${v} — 본문 없음)`, group: v, missing: true });
    }
    return out;
  }
  if (k === "camera") return [{ kind: "cam" }];
  if (k === "prayer") {
    const p = item.prayer || {};
    return [{ kind: "prayer", name: p.name || "", role: p.role || "대표기도" }];
  }
  if (k === "media") {
    const m = item.media || {};
    const out = (m.files || []).map((f) => ({ kind: "media", mediaFile: f.file, mediaName: f.name, video: /^(mp4|mov|m4v|webm)$/i.test(f.ext || ""), caption: (m.caption || "").trim() }));
    if (m.text && m.text.trim()) for (const sec of Render.splitLyrics(m.text)) for (const t of sec.slides) out.push({ kind: "text", text: t });
    return out;
  }
  if (k === "text") {
    const t = (item.text || {}).text || "";
    const out = [];
    for (const sec of Render.splitLyrics(t)) for (const x of sec.slides) out.push({ kind: "text", text: x });
    return out.length ? out : [{ kind: "text", text: item.title || "" }];
  }
  if (k === "design") return clone((item.design || {}).slides || []); // 가져온 모양 그대로(글은 화면 글 칸에서 고침)
  if (k === "standby") {
    const s = item.standby || {};
    const sl = { kind: "standby", text: s.text || "", sub: s.sub || "", countTo: s.countTo || "", useLogo: true };
    if (s.design) {
      Object.assign(sl, { design: s.design, lite: !!WF.lib.settings.cdLite, big10: s.big10 !== false, season: seasonOf(WF.svc && WF.svc.date), cdMode: s.cdMode || "clock", cdMins: s.cdMins || 5, font: s.font || "", textSize: s.textSize || 100, subSize: s.subSize || 100, numSize: s.numSize || 100 });
      if (s.verseRef) {
        const r = scriptureSlides(s.verseRef, "", Render.themeFor("scripture", WF.lib), "fit");
        const txt = (r.slides || []).map((x) => x.text).join(" ").replace(/\s+/g, " ").trim();
        sl.verse = { ref: Bible.refsLabel(Bible.parseRef(s.verseRef)), text: txt };
      }
    }
    return [sl];
  }
  return [];
}

function songSlides(song) {
  const secs = Render.splitLyrics(song.text);
  const byName = {};
  secs.forEach((s) => { if (s.name && !byName[s.name]) byName[s.name] = s; });
  let order = String(song.order || "").trim().split(/\s+/).filter(Boolean);
  let list;
  if (order.length && order.every((n) => byName[n])) list = order.map((n) => byName[n]);
  else list = secs;
  const out = [];
  for (const sec of list) sec.slides.forEach((t, i) => out.push({ kind: "text", text: t, section: sec.name, secFirst: i === 0 }));
  return out;
}
// 교독문: "인도:" "회중:" 으로 시작하는 줄은 색을 나눔
function fixedSlides(fx) {
  const out = [];
  for (const sec of Render.splitLyrics(fx.text)) for (const t of sec.slides) {
    const leader = /^(인도|인도자)\s*[:：]/.test(t);
    out.push({ kind: "text", text: t.replace(/^(인도자?|회중|다같이|다 같이)\s*[:：]\s*/, ""), leader, section: sec.name, who: leader ? "인도" : /^(회중|다같이|다 같이)/.test(t) ? "회중" : "" });
  }
  return out;
}

function rebuild(item, keepEdits) {
  if (keepEdits && item.edited) return syncTitleCard(item);
  item.slides = buildSlides(item);
  item.edited = false;
  syncTitleCard(item);
}
// 순서 이름을 바꿀 때: 제목 화면 글 줄 · 자막바 큰 글 중 옛 이름(또는 옛 이름에서 나온 자동 글)과 같은 것만 새 이름으로
function renameItem(it, name) {
  const old = it.title, oldLabel = window.barLabelFor ? barLabelFor(it) : "";
  it.title = name; it.titleCustom = true;
  const show = (l) => (typeof BAR_SHOW !== "undefined" && BAR_SHOW[l]) || l;
  const olds = [old, oldLabel, show(oldLabel)].filter(Boolean);
  for (const l of ((it.titleCard || {}).lines || [])) if (olds.includes(l.t)) l.t = name;
  if (it.barText && olds.includes(it.barText)) it.barText = name;
  // 자막바 큰 글 · 제목 화면은 자동이면 새 이름을 저절로 따라감(0.3.37)
}
// 찬양 순서 이름이 고른 곡을 따라가게: 목사님이 직접 고친 이름(titleCustom · ‘헌금 찬송’처럼 곡 이름이 아닌 것)은 그대로
function songTitleFollow(it) {
  if (it.kind !== "song" || it.titleCustom) return false;
  const s = WF.lib.songs.find((x) => x.id === (it.song || {}).songId);
  if (!s || it.title === s.title) return false;
  const t = (it.title || "").trim();
  const auto = !t || /^(찬양|찬송)$/.test(t) || /^(찬송 · )?\d+장$/.test(t) || WF.lib.songs.some((x) => x.title === t);
  if (!auto) return false;
  // 제목 화면을 손으로 고친 순서: 옛 곡 이름 줄만 새 곡 이름으로(자동이면 저절로 따라감)
  const tc = it.titleCard || {};
  if (tc.custom) for (const l of tc.lines || []) if (l.t === t && !/^(찬양|찬송)$/.test(t)) l.t = s.title;
  it.title = s.title; return true;
}
// 순서 제목 화면(전체 화면 · 순서 맨 앞 한 장): 켜져 있으면 맨 앞에 넣고, 꺼지면 뺀다(고친 화면들은 그대로)
const TC_KINDS = ["song", "scripture", "sermon", "prayer", "fixed", "text"];
// 켜고 끈 적이 없는 순서는 설정 ‘순서마다 전체 화면 제목’을 따른다(0.3.23)
function tcOn(item) { const tc = item.titleCard || {}; return TC_KINDS.includes(item.kind) && (tc.on != null ? !!tc.on : !!WF.lib.settings.tcDefault); }
function syncTitleCard(item) {
  if (!item.slides) return;
  const on = tcOn(item);
  const has = item.slides[0] && item.slides[0].kind === "titlecard";
  item.slides = item.slides.filter((x, i) => x.kind !== "titlecard" || (on && i === 0 && has));
  if (on && !has) item.slides.unshift({ kind: "titlecard", group: "제목 화면" });
}
// 영상 · 그림을 생중계(OBS)에도 띄울지 — "on" · "off", 정한 것이 없으면 ""(설정 기본값)
function mediaLive(item, file) {
  const m = item.media || {}, f = (m.files || []).find((x) => x.file === file) || {};
  return f.live || m.live || "";
}
// 그림 한 장의 생중계 여부를 뒤집음 — 순서에서 정한 것과 같아지면 그림마다 정한 것은 지움
function toggleMediaLive(item, file) {
  const m = item.media || (item.media = {}), f = (m.files || []).find((x) => x.file === file); if (!f) return;
  const want = !mediaLiveOn(item, file), base = m.live ? m.live === "on" : overlayTheme().showMedia !== false;
  if (want === base) delete f.live; else f.live = want ? "on" : "off";
}
// 지금(또는 고른) 화면이 생중계에 따로 띄울 수 있는 그림 · 영상이면 그 순서 · 파일
function liveMediaAt(p) {
  const it = itemAt(p), s = slideAt(p);
  if (!it || !s || s.kind !== "media" || !s.mediaFile || (it.media && it.media.cd && it.media.cd.on)) return null;
  return { it, file: s.mediaFile, video: !!s.video };
}
function mediaLiveOn(item, file) { const v = mediaLive(item, file); return v ? v === "on" : overlayTheme().showMedia !== false; }
// 설정을 바꾸면 이 예배의 모든 순서에 바로(지금 나가는 · 다음 화면 번호도 맞춤)
function syncAllTitleCards() {
  WF.svc.items.forEach((it, i) => {
    const had = it.slides && it.slides[0] && it.slides[0].kind === "titlecard";
    syncTitleCard(it);
    const d = (it.slides && it.slides[0] && it.slides[0].kind === "titlecard" ? 1 : 0) - (had ? 1 : 0);
    if (d) for (const p of [WF.live, WF.cue, WF.sel]) if (p && p.item === i) p.slide = Math.max(0, p.slide + d);
  });
  markDirty("svc");
}
// 제목 화면 글 줄(0.3.37 기준) — 큰 글 = 순서 구분(찬송 · 설교 · 축도 …, 구분이 없으면 순서 이름) · 이름 = 맡은 분 · 작은 글 = 순서 이름(곡 · 본문 · 설교 제목)
// 글 줄은 순서를 늘 따라가고, ‘화면에서 고치기’ · 제목 화면 탭에서 직접 고친 순서(custom)만 고친 그대로
function tcAutoLines(item) {
  const head = (item.barText || "").trim() || (window.orderHead ? orderHead(Object.assign({}, item, { barLabel: "" })) : "") || item.title || "";
  const side = window.barAutoSide ? (item.barSide && item.barSide !== "none" ? item.barSide : barAutoSide(item)) : "";
  const song = item.kind === "song" ? WF.lib.songs.find((x) => x.id === (item.song || {}).songId) : null;
  const sub = song ? song.title : item.kind === "scripture" ? (item.scripture || {}).ref || "" : item.kind === "sermon" ? (item.sermon || {}).title || "" : item.kind === "prayer" ? "" : item.title || "";
  return [{ t: head, st: "big", pos: "mc" }].concat(side && side !== head ? [{ t: side, st: "who", pos: "mc" }] : []).concat(sub && sub !== head && sub !== side ? [{ t: sub, st: "small", pos: "mc" }] : []);
}
function tcLines(item) {
  const tc = item.titleCard || {}, auto = tcAutoLines(item);
  if (!tc.lines || !tc.lines.length) return auto;
  if (tc.custom) return tc.lines;
  // 예전 판이 저장해 둔 글 줄: 옮기거나 · 크기를 바꾸거나 · 순서와 상관없는 글을 쓴 것은 ‘손으로 고친 것’으로 두고, 아니면 순서를 따라가게 고쳐 씀(같은 줄 그대로)
  const song = item.kind === "song" ? WF.lib.songs.find((x) => x.id === (item.song || {}).songId) : null;
  const known = new Set(["찬송", "찬양", item.title, song && song.title, ...auto.map((l) => l.t)].filter(Boolean));
  if (tc.lines.some((l) => +l.dx || +l.dy || (l.z && l.z !== 1) || (l.pos || "mc") !== "mc" || !known.has(String(l.t || "").trim()))) { tc.custom = true; return tc.lines; }
  if (tc.lines.length === auto.length) tc.lines.forEach((l, i) => Object.assign(l, auto[i])); // 같은 줄(고치기 창이 잡고 있는 줄)을 그대로 고쳐 씀
  else { tc.lines.length = 0; tc.lines.push(...auto); }
  return tc.lines;
}
// 제목 화면 글 줄을 고치기 시작할 때 — 지금 보이는 줄을 저장하고 ‘손으로 고친 것’으로
function tcEditLines(item) {
  const tc = (item.titleCard = item.titleCard || {});
  if (!tc.lines || !tc.lines.length) tc.lines = clone(tcLines(item)); else tcLines(item);
  tc.custom = true;
  return tc.lines;
}
const TC_DESIGN = { T01: "gold", T02: "capsule", T03: "twotone", T04: "plain", T05: "ribbon", T06: "frame", T07: "glass", T08: "plain", T09: "plain", T10: "bracket" };

// 그리기 직전에 그림 주소 · 로고를 붙인 화면 한 장
function resolveSlide(item, slide) {
  if (!slide) return null;
  const s = Object.assign({}, slide);
  if (s.kind === "design") {
    if (s.bgFile) s.bgSrc = Store.mediaUrl(s.bgFile);
    s.els = (s.els || []).map((e) => Object.assign({}, e, e.file ? { src: Store.mediaUrl(e.file) } : {}, e.fillFile ? { fillSrc: Store.mediaUrl(e.fillFile) } : {}, e.poster ? { posterSrc: Store.mediaUrl(e.poster) } : {}));
  }
  if (s.kind === "titlecard") {
    const tc = item.titleCard || {}, pick = window.barPick ? barPick(item) : {};
    s.tc = { kind: pick.mode && pick.mode !== "set" ? "clean" : TC_DESIGN[String(pick.set || "").slice(0, 3)] || "frame", color: pick.hex || (typeof BAR_HEX !== "undefined" && BAR_HEX[pick.color]) || "#1b2448", bg: tc.bg || "text", dim: tc.dim == null ? 30 : tc.dim, deco: tc.deco !== false, lines: clone(tcLines(item)) };
    if ((tc.bg === "image" || tc.bg === "video") && tc.media) { s.tc.file = tc.media; s.tc.url = Store.mediaUrl(tc.media); }
  }
  if (s.kind === "media" && s.mediaFile) s.ovLive = mediaLive(item, s.mediaFile); // 생중계에 띄울지: 그림마다 → 순서마다 → 설정(0.3.24)
  if (s.kind === "media" && s.mediaFile) s.media = { url: Store.mediaUrl(s.mediaFile), video: s.video, mute: (item.media || {}).mute, loop: (item.media || {}).loop };
  if (s.kind === "standby") {
    const st = WF.lib.settings;
    if (!s.text) s.text = st.standbyText || "";
    if (!s.sub) s.sub = st.standbySub || "";
    if (st.logoMedia) s.logoUrl = Store.mediaUrl(st.logoMedia);
  }
  const th = themeOf(item);
  if (th.bgMedia) { s.bgUrl = Store.mediaUrl(th.bgMedia); s.bgFile = th.bgMedia; s.bgDim = 0; } // 0.3.33 목사님: 배경 어둡게는 뺌(글자 그림자 · 테두리로)
  // 카운트다운 ‘길이’ 방식: 이 항목이 나가는 중이면 나간 순간 + 길이 = 끝나는 때
  const cdc = cdCfg(item);
  const until = cdc && cdc.cdMode === "dur" && WF.cdStart && WF.cdStart[item.id] && WF.live && itemAt(WF.live) === item ? WF.cdStart[item.id] + (+cdc.cdMins || 5) * 60000 : 0;
  if (s.kind === "standby" && s.design && until) s.cdUntil = until;
  if (s.kind === "media" && cdc && cdc.on) s.cd = Object.assign({}, cdc, until ? { cdUntil: until } : {}, { digitMode: WF.lib.settings.cdDigit || "slide" });
  if (s.kind === "standby" && s.design) s.digitMode = WF.lib.settings.cdDigit || "slide"; // 숫자 바뀌는 모양(설정)
  if (s.kind === "standby" && s.design) {
    const sb = item.standby || {}, date = WF.svc && WF.svc.date;
    s.pal = cdPal(sb.pal, date) || undefined;
    s.month = date ? +date.slice(5, 7) : new Date().getMonth() + 1;
    if (s.design === "morder") s.order = WF.svc.items.filter((x) => ["song", "scripture", "sermon", "prayer", "fixed"].includes(x.kind) && x.slides && x.slides.length).map((x) => ({ icon: KINDS[x.kind].icon, title: x.kind === "sermon" && x.sermon.title ? x.sermon.title : x.title, sub: x.kind === "sermon" ? [x.sermon.ref, x.sermon.preacher].filter(Boolean).join(" · ") : x.kind === "scripture" ? x.scripture.ref : x.kind === "prayer" ? x.prayer.name : "" }));
    if (s.design === "mads") { s.adFiles = WF.lib.media.filter((m) => !m.hidden && m.folder === "mf-ad" && !/^(mp3|m4a|wav|aac|aif|aiff|flac)$/i.test(m.ext)).slice(0, 12).map((m) => m.file); s.ads = s.adFiles.map((f) => Store.mediaUrl(f)); } // 광고: 그림 · 영상 모두
    const lp = standbyLoop(s.design, s.month, s.pal); if (lp && lp.file) { s.loopFile = lp.file; s.loop = Store.mediaUrl(lp.file); }
    if (s.design === "mphoto" && sb.photoFile) { s.photoFile = sb.photoFile; s.photo = Store.mediaUrl(sb.photoFile); }
  }
  if (s.kind === "standby" && s.design === "video" && (item.standby || {}).bgFile) { s.bgUrl = Store.mediaUrl(item.standby.bgFile); s.bgFile = item.standby.bgFile; s.dim = item.standby.dim; }
  if (s.kind === "cam") s.camShot = true;
  s.itemKind = item.kind; // 생중계: 예배당 화면 그대로 보일지(찬양 · 성경 …) 카메라 + 띠일지(기도 · 설교)
  // 예배당 TV: 대표기도 · 설교 제목은 카메라(있으면) + 아래 띠
  if (WF.lib.settings.camOnTv !== false && (s.kind === "prayer" || (s.kind === "title" && item.kind === "sermon"))) s.camShot = true;
  if (s.kind === "standby" && WF.lib.settings.logoMedia) s.logoFile = WF.lib.settings.logoMedia; // bgFile: 생중계 페이지가 자막 서버에서 받을 때
  return s;
}
function logoSlide() {
  const st = WF.lib.settings;
  return { kind: "standby", text: st.standbyText || "", sub: st.standbySub || "", logoUrl: st.logoMedia ? Store.mediaUrl(st.logoMedia) : "" };
}
function emergencySlide() {
  const st = WF.lib.settings;
  if (st.emergencyMedia) return { kind: "media", media: { url: Store.mediaUrl(st.emergencyMedia), video: false } };
  return { kind: "standby", text: st.emergencyText || "", logoUrl: st.logoMedia ? Store.mediaUrl(st.logoMedia) : "" };
}

/* ───────── 그리기 도우미 ───────── */
function drawInto(holder, item, slide, flags) {
  const stage = Render.mountScaled(holder);
  if (!item || !slide) { Render.draw(stage, null, null, flags || {}); return { lines: 0 }; }
  return Render.draw(stage, resolveSlide(item, slide), themeOf(item), Object.assign({
    hint: true, // 조작 창 미리보기: 투명 화면 자리 표시
    logoSlide: logoSlide(), logoTheme: Render.themeFor("standby", WF.lib),
    emergencySlide: emergencySlide(), emergencyTheme: Render.themeFor("standby", WF.lib),
  }, flags || {}));
}
// ‘지금 나가는 화면’ 미리보기: 영상도 소리 없이 움직이게. 같은 화면이면 다시 그리지 않아 영상이 처음으로 돌아가지 않음.
function drawLivePreview(holder) {
  const it = itemAt(WF.live), s = slideAt(WF.live);
  const key = JSON.stringify([it && it.id, WF.live, WF.flags, s, it && it.theme, it && it.media, it && it.titleCard, WF.projOn, !!(typeof Cam !== "undefined" && Cam.stream), (WF.cdStart || {})[it && it.id]]); // 카운트다운이 나가기 시작한 때가 정해지면 다시 그림
  if (holder.dataset.key === key && holder.firstChild) return;
  holder.dataset.key = key;
  return drawInto(holder, it, s, Object.assign({}, WF.flags, { play: true, silent: true }, camFlags()));
}
// 카메라 화면(대표기도 · 설교 제목)을 그릴 때 쓰는 것: 카메라 흐름과 아래 띠 모양
function camFlags() { return typeof Cam !== "undefined" && Cam.stream && Cam.stream.active ? { camStream: Cam.stream, camBand: overlayTheme() } : {}; }
// 예배당 화면 영상의 진행을 미리보기에 맞추고 ‘0:05 / 0:19’로 보여 줌
function previewVideo(holder) { return holder && (holder.querySelector("video.wf-media") || holder.querySelector(".wf-stage video:not(.wf-bg)")); }
function showVideoTime(p) {
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  // 생중계 미리보기의 영상도 같은 시간으로(같은 파일일 때)
  const ov = document.querySelector("#pvOv video.wf-ovfull"), lv = previewVideo($("#pvNow")) || previewVideo($("#pvLive"));
  if (ov && p && lv && ov.src === lv.src && Math.abs(ov.currentTime - p.t) > 0.8) { try { ov.currentTime = p.t; } catch (e) {} }
  for (const [pv, lab] of [["#pvNow", "#nowVtime"], ["#pvLive", "#pvLiveVtime"]]) {
    const v = previewVideo($(pv)), l = $(lab);
    if (v && p && Math.abs(v.currentTime - p.t) > 0.8) { try { v.currentTime = p.t; } catch (e) {} }
    if (l) { l.textContent = v ? `▶ ${fmt(p ? p.t : v.currentTime)} / ${fmt(p && p.d ? p.d : v.duration || 0)}` : ""; l.classList.toggle("hidden", !v); }
  }
}
// 지금 생중계(OBS)에 무엇이 나가는지 한 마디로
function liveOvStatus() {
  const it = itemAt(WF.live), s = slideAt(WF.live);
  const rs = it && s ? resolveSlide(it, s) : null;
  const flags = Object.assign({}, WF.flags, { overlayOff: WF.overlayOn === false });
  const full = Render.overlayFull(rs, overlayTheme(), flags);
  const has = Render.overlayContent(rs) && !(flags.black || flags.clear || flags.logo || flags.emergency || flags.overlayOff || flags.cam);
  return { text: full && full.proj ? "예배당 화면 그대로" : full && !full.bg ? (full.video ? "영상 화면 가득" : "그림 화면 가득") : full ? "배경 영상 + 가사" : flags.overlayOff ? "자막 꺼짐 · 카메라만" : !has ? (window.barState && barState() ? "카메라 + 순서 자막바" : "카메라만") : "카메라 위 자막", full: !!full };
}
const itemAt = (p) => (p && WF.svc ? WF.svc.items[p.item] : null);
const slideAt = (p) => { const it = itemAt(p); return it ? it.slides[p.slide] : null; };
function posLabel(p) {
  const it = itemAt(p), sl = slideAt(p);
  if (!it || !sl) return "";
  const part = sl.section ? ` · ${sl.section}` : sl.group ? ` · ${sl.group}` : sl.ref ? ` · ${sl.ref}` : "";
  return `${it.title}${part} · ${p.slide + 1}/${it.slides.length}`;
}

/* ───────── 지금 / 다음 엔진 ───────── */
function nextPos(p) {
  const items = WF.svc.items;
  if (!p) { for (let i = 0; i < items.length; i++) if (items[i].slides.length) return { item: i, slide: 0 }; return null; }
  const it = items[p.item];
  if (it && p.slide + 1 < it.slides.length) return { item: p.item, slide: p.slide + 1 };
  for (let i = p.item + 1; i < items.length; i++) if (items[i].slides.length) return { item: i, slide: 0 };
  return null;
}
function prevPos(p) {
  const items = WF.svc.items;
  if (!p) return null;
  if (p.slide > 0) return { item: p.item, slide: p.slide - 1 };
  for (let i = p.item - 1; i >= 0; i--) if (items[i].slides.length) return { item: i, slide: items[i].slides.length - 1 };
  return null;
}
function samePos(a, b) { return a && b && a.item === b.item && a.slide === b.slide; }

function pushUndo() {
  WF.undo.push({ live: WF.live && { ...WF.live }, cue: WF.cue && { ...WF.cue }, flags: { ...WF.flags } });
  if (WF.undo.length > 50) WF.undo.shift();
}

// 화면을 내보낸다(지금으로). 다음은 그 뒤 화면으로 자동.
// 카운트다운: 0이 되면 다음 순서로(고른 경우) · 예배 전 음악 서서히 끄기. 나갈 때 예배 전 음악 틀기.
setInterval(() => {
  const it = itemAt(WF.live), c = cdCfg(it);
  if (!c) return;
  let end;
  if (c.cdMode === "dur") { if (!(WF.cdStart || {})[it.id]) return; end = WF.cdStart[it.id] + (+c.cdMins || 5) * 60000; }
  else { const m = String(c.countTo || "").match(/^(\d{1,2}):(\d{2})$/); if (!m) return; const to = new Date(); to.setHours(+m[1], +m[2], 0, 0); end = +to; }
  const left = Math.round((end - Date.now()) / 1000);
  const key = it.id + "@" + end;
  const shownBefore = ((WF.cdStart || {})[it.id] || 0) < end; // 0이 되기 전부터 나가고 있었을 때만(시각이 지난 뒤 띄운 경우는 넘기지 않음)
  if (left <= 0 && left > -60 && shownBefore && WF.cdFired !== key) { // 맥이 잠깐 바빠도 놓치지 않게 1분 안에서
    WF.cdFired = key;
    if (c.music && typeof AP !== "undefined" && AP.el && !AP.el.paused) fadeAudio(5);
    if (c.atZero !== "stay" && !WF.flags.black && !WF.flags.emergency) next();
  }
}, 1000);
// 이 항목의 카운트다운 설정(대기 항목 · 영상 위 카운트다운)
function cdCfg(it) {
  if (!it) return null;
  if (it.kind === "standby" && (it.standby || {}).design) return it.standby;
  if (it.kind === "media" && ((it.media || {}).cd || {}).on) return it.media.cd;
  return null;
}
function cdMusic(it) {
  const c = cdCfg(it);
  if (!c || !c.music || typeof AP === "undefined" || (AP.el && !AP.el.paused)) return;
  const f = (WF.lib.mediaFolders || []).find((x) => x.audio && /예배 전/.test(x.name)) || (WF.lib.mediaFolders || []).find((x) => x.audio);
  const list = f ? mediaIn(f.id, true) : [];
  if (list.length) playAudio(list[0], list);
}
function goLive(p, opts) {
  if (!p || !slideAt(p)) return;
  pushUndo();
  const changedItem = !WF.live || WF.live.item !== p.item;
  WF.live = { item: p.item, slide: p.slide };
  WF.cue = nextPos(WF.live);
  WF.barTest = null;
  recordShown();
  WF.flags.clear = false;
  if (changedItem) { WF.itemStart = Date.now(); WF.barKickAt = WF.barKick || 0; WF.itemSeq = (WF.itemSeq || 0) + 1; (WF.cdStart = WF.cdStart || {})[(itemAt(p) || {}).id] = Date.now(); cdMusic(itemAt(p)); }
  if (!WF.serviceStart) WF.serviceStart = Date.now();
  sendLive();
  scheduleAuto();
  if (!(opts && opts.quiet)) refreshLive();
}
// 그날 실제로 띄운 화면 기록(예배 파일 안에 남음 — 다음 주 복제 때는 비움)
function recordShown() {
  if (WF.rehearsal || !WF.svc) return;
  const it = itemAt(WF.live), sl = slideAt(WF.live);
  if (!it || !sl) return;
  const h = (WF.svc.shown = WF.svc.shown || []);
  h.push({ t: Date.now(), item: it.title, label: slideLabel(sl), text: slideText(sl).slice(0, 60) });
  // 곡 보관함에 ‘마지막으로 부른 날’
  if (it.kind === "song") {
    const song = WF.lib.songs.find((x) => x.id === (it.song || {}).songId);
    if (song && song.lastUsed !== WF.svc.date) { song.lastUsed = WF.svc.date; song.useCount = (song.useCount || 0) + 1; markDirty("lib"); }
  }
  if (h.length > 600) h.splice(0, h.length - 600);
  markDirty("svc");
}
function next() {
  if (WF.cue && slideAt(WF.cue)) return goLive(WF.cue);
  const n = nextPos(WF.live);
  if (n) goLive(n);
}
function prev() {
  const p = prevPos(WF.live);
  if (p) goLive(p);
}
function cue(p) {
  if (!p || !slideAt(p)) return;
  WF.cue = { item: p.item, slide: p.slide };
  refreshLive();
}
function cueItem(delta) {
  const items = WF.svc.items;
  let i = (WF.cue || WF.live || { item: -1 }).item;
  for (let k = 0; k < items.length; k++) {
    i += delta;
    if (i < 0 || i >= items.length) return;
    if (items[i].slides.length) return cue({ item: i, slide: 0 });
  }
}
function toggleFlag(name) {
  pushUndo();
  if (name === "emergency" && !WF.flags.emergency) WF.preEmergency = { ...WF.flags };
  WF.flags[name] = !WF.flags[name];
  if (name === "emergency" && !WF.flags.emergency && WF.preEmergency) { Object.assign(WF.flags, WF.preEmergency, { emergency: false }); WF.preEmergency = null; }
  if (name === "black" && WF.flags.black) WF.flags.logo = false;
  if (name === "logo" && WF.flags.logo) WF.flags.black = false;
  if (name === "cam" && WF.flags.cam) { WF.flags.black = false; WF.flags.logo = false; }
  if ((name === "black" && WF.flags.black) || (name === "logo" && WF.flags.logo)) WF.flags.cam = false;
  if (name === "emergency" && window.obsEmergency) obsEmergency(WF.flags.emergency);
  sendLive();
  refreshLive();
}
function undoLast() {
  const u = WF.undo.pop();
  if (!u) return;
  WF.live = u.live; WF.cue = u.cue; WF.flags = u.flags;
  sendLive();
  refreshLive();
}
// 찬양 부분 단축키: 지금 항목 안에서 그 부분의 다음 차례(없으면 첫 번째)를 '바로' 내보낸다
function jumpSection(key) {
  const p = WF.live || WF.cue; if (!p) return false;
  const it = itemAt(p); if (!it || it.kind !== "song") return false;
  const idx = [];
  it.slides.forEach((s, i) => { if (s.secFirst && Render.sectionKey(s.section) === key) idx.push(i); });
  if (!idx.length) return false;
  const inItem = WF.live && WF.live.item === p.item;
  // 지금 그 부분을 부르는 중이면(후렴을 한 번 더) 그 부분 처음으로, 아니면 뒤에 오는 그 부분으로
  if (inItem) {
    const cur = WF.live.slide;
    const start = idx.filter((i) => i <= cur).pop();
    if (start != null && Render.sectionKey(it.slides[cur].section) === key) return goLive({ item: p.item, slide: start }), true;
  }
  const after = idx.find((i) => !inItem || i > WF.live.slide);
  goLive({ item: p.item, slide: after != null ? after : idx[0] });
  return true;
}

let autoTimer = null;
function scheduleAuto() {
  clearTimeout(autoTimer);
  const it = itemAt(WF.live);
  const sl = slideAt(WF.live);
  // 제목 화면 ‘5초 뒤 저절로’: 5초 지나면 그 순서의 첫 화면(가사 · 본문)으로
  if (sl && sl.kind === "titlecard" && it && (it.titleCard || {}).adv === "5") {
    autoTimer = setTimeout(() => { if (WF.live && itemAt(WF.live) === it && slideAt(WF.live) === sl && it.slides[WF.live.slide + 1]) goLive({ item: WF.live.item, slide: WF.live.slide + 1 }); }, 5000);
    return;
  }
  const sec = it && it.kind === "media" ? +((it.media || {}).auto || 0) : 0;
  if (!sec || !sl || sl.video) return;
  autoTimer = setTimeout(() => {
    if (!WF.live || itemAt(WF.live) !== it) return;
    // 광고 그림은 그 항목 안에서 돌아가며
    const n = WF.live.slide + 1 < it.slides.length ? WF.live.slide + 1 : 0;
    const keepCue = WF.cue;
    goLive({ item: WF.live.item, slide: n }, { quiet: true });
    if (keepCue && keepCue.item !== WF.live.item) WF.cue = keepCue;
    refreshLive();
  }, sec * 1000);
}

function liveState() {
  const it = itemAt(WF.live), sl = slideAt(WF.live);
  return {
    seq: WF.seq++,
    slide: it && sl ? resolveSlide(it, sl) : null,
    theme: it ? themeOf(it) : null,
    flags: { ...WF.flags },
    logoSlide: logoSlide(), logoTheme: Render.themeFor("standby", WF.lib),
    emergencySlide: emergencySlide(), emergencyTheme: Render.themeFor("standby", WF.lib),
    overlay: { on: WF.overlayOn !== false, theme: overlayTheme() },
    camId: typeof Cam !== "undefined" && Cam.stream && Cam.stream.active ? Cam.stream.getVideoTracks()[0].getSettings().deviceId || "" : "",
    stage: stageState(),
    bar: window.barState ? barState() : null,
    fade: WF.lib.settings.transition === "cut" ? 0 : WF.lib.settings.transition === "slow" ? 600 : 180,
    itemIdx: WF.live ? WF.live.item : -1, // 다음 순서로 넘어갈 때만 천천히
  };
}
// 찬양 부분 단추(리모컨용): 이름과 키
function songKeys(it) {
  if (!it || it.kind !== "song") return [];
  const seen = new Set(), out = [];
  for (const s of it.slides) { const k = Render.sectionKey(s.section); if (s.secFirst && k && !seen.has(k)) { seen.add(k); out.push({ key: k, name: s.section }); } }
  return out;
}
function stageState() {
  const it = itemAt(WF.live), sl = slideAt(WF.live), ni = itemAt(WF.cue), ns = slideAt(WF.cue);
  let nextLabel = slideLabel(ns);
  if (ni && ni !== it) nextLabel = ni.title + (nextLabel ? " · " + nextLabel : "");
  return {
    now: { title: it ? it.title : "", label: slideLabel(sl), text: slideText(sl), note: it && it.note ? it.note : "" },
    next: { label: nextLabel ? nextLabel + " →" : "", text: slideText(ns) },
    msg: WF.stageMsg || "",
    keys: songKeys(it),
    timer: it && WF.itemStart && +it.minutes ? { start: WF.itemStart, minutes: +it.minutes, label: it.kind === "sermon" ? "설교 남은 시간" : "남은 시간" } : null,
    sentAt: Date.now(),
  };
}
function sendLive() {
  if (WF.rehearsal) { saveSession(); return; }
  Store.setLive(liveState()).catch((e) => console.warn("set_live", e));
  saveSession();
}

/* ───────── 저장 ───────── */
let saveTimer = null, libDirty = false, svcDirty = false, lastSaved = 0;
function markDirty(what) {
  if (what !== "svc") libDirty = true;
  if (what !== "lib") svcDirty = true;
  if (WF.svc) WF.svc.updatedAt = Date.now();
  setChip("chipSave", "저장 중…", "busy");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 700);
}
async function saveNow() {
  clearTimeout(saveTimer);
  try {
    if (libDirty) { libDirty = false; await Store.saveJSON("library.json", WF.lib); }
    if (svcDirty && WF.svc) {
      svcDirty = false;
      await Store.saveJSON(`services/${WF.svc.id}.json`, WF.svc);
      const row = WF.services.find((s) => s.id === WF.svc.id);
      if (row) Object.assign(row, { title: WF.svc.title, date: WF.svc.date, updatedAt: WF.svc.updatedAt });
    }
    lastSaved = Date.now();
    updateSaveChip();
  } catch (e) {
    setChip("chipSave", "저장 실패 — " + e, "bad");
  }
}
function updateSaveChip() {
  if (!lastSaved) return setChip("chipSave", "저장됨", "ok");
  const s = Math.round((Date.now() - lastSaved) / 1000);
  setChip("chipSave", s < 10 ? "저장됨 · 방금" : s < 60 ? `저장됨 · ${s}초 전` : `저장됨 · ${Math.round(s / 60)}분 전`, "ok");
}
let sessTimer = null;
function saveSession() {
  clearTimeout(sessTimer);
  sessTimer = setTimeout(() => {
    Store.saveJSON("session.json", {
      serviceId: WF.svc && WF.svc.id, live: WF.live, cue: WF.cue, flags: WF.flags,
      inLive: WF.mode === "live" || !!WF.live, serviceStart: WF.serviceStart, at: Date.now(),
    }).catch(() => {});
  }, 150);
}

function setChip(id, text, state) {
  const c = document.getElementById(id); if (!c) return;
  const sp = c.querySelector("span"), d = c.querySelector(".dot");
  const cls = "dot" + (state === "bad" ? " bad" : state === "busy" ? " busy" : state === "off" ? " off" : "");
  if (sp.textContent !== text) sp.textContent = text;
  if (d.className !== cls) d.className = cls;
}

/* ───────── 예배 목록 ───────── */
async function loadServices() {
  const files = (await Store.list("services")).filter((f) => f.endsWith(".json"));
  const rows = [];
  for (const f of files) {
    const s = await Store.loadJSON(`services/${f}`, null);
    if (s && s.id) rows.push({ id: s.id, title: s.title, date: s.date, updatedAt: s.updatedAt || 0 });
  }
  rows.sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.updatedAt - a.updatedAt);
  WF.services = rows;
}
async function openService(id) {
  await saveNow();
  const s = await Store.loadJSON(`services/${id}.json`, null);
  if (!s) return;
  WF.svc = s;
  for (const it of s.items) if (it.kind === "scripture" || it.kind === "sermon") { const x = it.scripture || it.sermon || {}; await loadBible(x.bibleId); if (x.bibleId2) await loadBible(x.bibleId2); }
  // 성경 · 곡이 바뀌었을 수 있으니 손대지 않은 항목은 다시 만든다
  for (const it of s.items) { if (it.kind === "song") songTitleFollow(it); rebuild(it, true); }
  WF.sel = { item: 0, slide: 0 };
  WF.live = null; WF.cue = nextPos(null); WF.undo = [];
  WF.serviceStart = 0;
  localStorageSet("lastService", id);
  renderAll();
}
async function createService(copyFrom) {
  let s;
  if (copyFrom) {
    s = clone(copyFrom);
    s.id = uid("s");
    s.date = nextSunday(new Date(new Date(copyFrom.date + "T12:00:00").getTime() + 86400000));
    s.createdAt = s.updatedAt = Date.now();
    for (const it of s.items) it.id = uid("i");
    delete s.shown;
    s.items = s.items.filter((it) => !it.quick); // 예배 중에 급히 더한 구절은 복제하지 않음
    // 매주 바뀌는 항목에는 ‘지난주’ 표시 — 고치거나 ‘그대로 쓰기’를 누르면 사라짐
    for (const it of s.items) if (["song", "scripture", "sermon", "prayer", "media"].includes(it.kind)) it.carried = true;
  } else s = newService();
  await Store.saveJSON(`services/${s.id}.json`, s);
  WF.services.unshift({ id: s.id, title: s.title, date: s.date, updatedAt: s.updatedAt });
  await openService(s.id);
  if (copyFrom) {
    setMode("prep");
    const b = banner(`지난 예배를 <b>${esc(dateLabel(s.date))}</b>로 복제했습니다. <span class="carried">지난주</span> 표시가 있는 항목(찬양 · 본문 · 설교 · 기도 · 광고)을 이번 주 내용으로 바꾸세요. <button class="btn sm" id="cpOk">알겠습니다</button>`, "info");
    $("#cpOk", b).onclick = () => banner("");
  }
}
function localStorageSet(k, v) { try { localStorage.setItem("wf-ui:" + k, v); } catch (e) {} }
function localStorageGet(k) { try { return localStorage.getItem("wf-ui:" + k); } catch (e) { return null; } }

/* ───────── 예배당 화면(모니터) ───────── */
async function refreshMonitors() {
  try { WF.monitors = await Store.monitors(); } catch (e) { WF.monitors = []; }
  return WF.monitors;
}
// 화면 이름: 목사님이 붙인 이름(예배당 TV · 뒤쪽 모니터) → 맥이 아는 이름(BMD HDMI) → ‘이 맥 화면’
function monNick(m) { return (WF.lib.settings.monitorNick || {})[m.name] || ""; }
function monBase(m) { return m.primary ? "이 맥 화면" + (m.label && !/내장|built-in/i.test(m.label) ? ` (${m.label})` : "") : m.label || "외부 화면"; }
function monName(key) { const m = WF.monitors.find((x) => x.name === key); return m ? monNick(m) || monBase(m) : key || ""; }
function pickMonitor() {
  const want = WF.lib.settings.projMonitor;
  const ms = WF.monitors;
  if (want && ms.find((m) => m.name === want)) return want;
  const other = ms.find((m) => !m.primary);
  return other ? other.name : "";
}
// 맥이 화면을 하나로만 볼 때(TV를 ‘미러링’으로 연결했거나 TV가 안 잡힘): 어떻게 바꾸는지 알려 줌
const MIRROR_HELP = "맥이 지금 화면을 하나로만 보고 있습니다.\n\n" +
  "TV에 맥 화면이 똑같이 나온다면 ‘미러링(같은 화면)’으로 되어 있는 것입니다. 파워포인트는 이 상태에서도 되지만, WorshipFlow는 TV를 ‘따로 쓰는 화면(확장)’으로 써야 합니다.\n\n" +
  "바꾸는 법: 시스템 설정 → 디스플레이 → TV를 누르고 ‘다음으로 사용’을 ‘확장 디스플레이’로 (또는 ‘미러링’ 끄기).\n" +
  "그다음 WorshipFlow 설정 → 예배당 화면에서 TV를 고르고 ‘예배당 화면 켜기’.\n\n" +
  "TV에 아무것도 안 나오면: HDMI 선 · TV 입력(외부 입력)을 확인하세요.\n\n지금은 시험용으로 작은 창에 띄웁니다.";
async function projectionOn() {
  await refreshMonitors();
  if (Store.inApp && WF.monitors.length < 2 && !WF.mirrorWarned) { WF.mirrorWarned = true; if (!WF.testing) await Store.message(MIRROR_HELP, "TV가 따로 잡히지 않습니다"); }
  const mon = pickMonitor();
  try {
    let where = await Store.openProjection(mon || null);
    // 창을 새로 만든 직후에는 맥이 크기를 나중에 다시 맞추는 일이 있어, 잠깐 뒤 한 번 더 맞춘다
    if (Store.inApp && mon) { await new Promise((r) => setTimeout(r, 400)); where = await Store.openProjection(mon); }
    WF.projOn = true; WF.projMonitor = mon;
    WF.projMissing = false;
    WF.projWindowed = Store.inApp && where !== "덮음"; // 모니터를 골랐는데 꽉 채우지 못하고 창으로 뜬 경우
    updateProjChip(where);
    setTimeout(() => Store.setLive(liveState()), 400);
    if (WF.lib.settings.stageScreenOn && !WF.stageOn && WF.lib.settings.stageMonitor && WF.lib.settings.stageMonitor !== mon) stageScreenOn();
  } catch (e) {
    Store.message("예배당 화면을 열지 못했습니다: " + e);
  }
}
// 강단 화면(뒤쪽 모니터): 강단 페이지와 같은 화면(지금 · 다음 가사, 시간, 방송실 메시지)을 고른 모니터에 꽉 채움
async function stageScreenOn() {
  await refreshMonitors();
  const want = WF.lib.settings.stageMonitor;
  const mon = want && WF.monitors.find((m) => m.name === want) ? want : "";
  if (!mon) { setMode("settings"); return Store.message("강단 화면을 띄울 모니터를 설정에서 먼저 골라 주세요."); }
  if (WF.projOn && mon === WF.projMonitor) return Store.message("예배당 화면과 같은 모니터입니다. 다른 모니터를 골라 주세요.");
  try {
    let where = await Store.openStageScreen(mon);
    if (Store.inApp) { await new Promise((r) => setTimeout(r, 400)); where = await Store.openStageScreen(mon); }
    WF.stageOn = true; WF.lib.settings.stageScreenOn = true; markDirty("lib");
    updateStageChip(where);
    setTimeout(() => Store.setLive(liveState()), 400);
  } catch (e) { Store.message("강단 화면을 열지 못했습니다: " + e); }
}
async function stageScreenOff() {
  await Store.closeStageScreen();
  WF.stageOn = false; WF.lib.settings.stageScreenOn = false; markDirty("lib");
  updateStageChip();
}
function updateStageChip(where) {
  const c = $("#chipStage"); if (!c) return;
  c.classList.toggle("hidden", !WF.stageOn);
  if (!WF.stageOn) return;
  const idx = WF.monitors.findIndex((m) => m.name === WF.lib.settings.stageMonitor);
  setChip("chipStage", where && where !== "덮음" ? "강단 화면을 창으로 띄움 — 모니터 확인" : `강단 화면 · ${monName(WF.lib.settings.stageMonitor)}`, where && where !== "덮음" ? "busy" : "ok");
}
async function projectionOff() {
  await Store.closeProjection();
  WF.projOn = false;
  updateProjChip();
}
function updateProjChip(where) {
  const b = $("#projBtn");
  if (!WF.projOn) { setChip("chipProj", "예배당 화면 꺼짐", "off"); b.textContent = "켜기"; b.classList.remove("on"); return; }
  b.textContent = "끄기"; b.classList.add("on");
  if (WF.projMissing) return setChip("chipProj", "예배당 화면(TV)이 빠짐 — 케이블 확인", "bad");
  if (WF.projMonitor && WF.projWindowed) return setChip("chipProj", "예배당 화면을 창으로 띄움 — 설정에서 모니터 확인", "busy");
  const idx = WF.monitors.findIndex((m) => m.name === WF.projMonitor);
  if (!WF.projMonitor && WF.monitors.length < 2) return setChip("chipProj", "TV가 따로 안 잡힘 — 미러링을 ‘확장’으로", "bad");
  setChip("chipProj", WF.projMonitor ? `예배당 화면 · ${monName(WF.projMonitor)}` : "예배당 화면 · 창으로 보기", "ok");
}
// 2초마다 모니터 확인: 빠지면 알리고, 다시 꽂히면 그 화면에 다시 띄운다
async function watchMonitors() {
  if (!Store.inApp) return;
  const before = WF.monitors.map((m) => m.name).join("|");
  await refreshMonitors();
  const now = WF.monitors.map((m) => m.name).join("|");
  if (WF.projOn) {
    const open = await Store.projectionOpen().catch(() => true);
    if (!open) { WF.projOn = false; updateProjChip(); Store.closeProjection().catch(() => {}); } // 화면 꺼짐 막기도 풀기
    else if (WF.projMonitor && !WF.monitors.find((m) => m.name === WF.projMonitor)) {
      if (!WF.projMissing) { WF.projMissing = true; updateProjChip(); }
    } else if (WF.projMissing || (before !== now && WF.projMonitor)) {
      WF.projMissing = false;
      await projectionOn();
    }
  }
  if (before !== now && WF.mode === "settings" && window.renderSettings) renderSettings();
}

/* ───────── 단축키 ───────── */
function typing() {
  const a = document.activeElement;
  return a && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && !["checkbox", "radio", "button", "range"].includes(a.type)) || a.tagName === "SELECT" || a.isContentEditable);
}
function handleKey(e) {
  if (WF.mode === "library" || WF.mode === "settings") return false;
  if (!$("#modal").classList.contains("hidden")) return false;
  const k = e.key, meta = e.metaKey || e.ctrlKey;
  if (meta && (k === "z" || k === "Z")) { undoLast(); return true; }
  if (meta) return false;
  if ((k === "Delete" || k === "Backspace") && typeof deleteSelSlide === "function" && deleteSelSlide()) return true;
  if (k === "ArrowRight" || k === " " || k === "PageDown") { next(); return true; }
  if (k === "ArrowLeft" || k === "PageUp") { prev(); return true; }
  if (k === "ArrowDown") { cueItem(1); return true; }
  if (k === "ArrowUp") { cueItem(-1); return true; }
  if (k === "F9" || e.code === "F9") { toggleFlag("emergency"); return true; }
  if (k === "Escape" && WF.flags.emergency) { toggleFlag("emergency"); return true; }
  const up = k.length === 1 ? k.toUpperCase() : k;
  if (up === "B" || up === "ㅠ" || k === "." ) { toggleFlag("black"); return true; }   // 클리커의 검은 화면 단추는 '.' 를 보냄
  if (up === "C" || up === "ㅊ") { toggleFlag("clear"); return true; }
  if (up === "L" || up === "ㅣ") { toggleFlag("logo"); return true; }
  if (up === "V" || up === "ㅍ") { toggleFlag("cam"); return true; }
  if (up === "T" || up === "ㅅ") { kickBar(); return true; }
  const map = { R: "R", "ㄱ": "R", G: "G", "ㅎ": "G", E: "E", "ㄷ": "E" };
  if (/^[1-9]$/.test(k) && jumpSection(k)) return true;
  if (map[up] && jumpSection(map[up])) return true;
  return false;
}
document.addEventListener("keydown", (e) => {
  if (typing()) {
    if (e.key === "Escape") document.activeElement.blur();
    // 메뉴에 실행 취소가 없으므로 글 칸의 ⌘Z · ⇧⌘Z 는 여기서
    if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) { e.preventDefault(); document.execCommand(e.shiftKey ? "redo" : "undo"); }
    return;
  }
  if (handleKey(e)) e.preventDefault();
});
document.addEventListener("focusin", () => document.body.classList.toggle("editing", typing()));
document.addEventListener("focusout", () => setTimeout(() => document.body.classList.toggle("editing", typing()), 0));
Store.listen("proj-key", (p) => { if (!typing()) handleKey({ key: p.key, code: p.code, metaKey: p.meta, ctrlKey: p.ctrl }); });
// 휴대폰 리모컨에서 온 명령
Store.listen("remote-cmd", (a) => {
  if (a === "next") next();
  else if (a === "prev") prev();
  else if (a === "black" || a === "clear" || a === "logo") toggleFlag(a);
  else jumpSection(a);
});

// 끝내기: 예배 중이면 한 번 더 묻고, 저장한 뒤 끝낸다
let quitting = false;
Store.listen("ask-quit", async () => {
  if (quitting) return;
  quitting = true;
  try {
    const inService = WF.mode === "live" && WF.live;
    if (inService && !(await Store.confirm("예배 중입니다. WorshipFlow를 끝낼까요?\n예배당 화면도 함께 꺼집니다.", "끝내기"))) return;
    await saveNow();
    clearTimeout(sessTimer);
    await Store.saveJSON("session.json", { serviceId: WF.svc && WF.svc.id, live: WF.live, cue: WF.cue, flags: WF.flags, inLive: false, at: Date.now() }).catch(() => {});
    await window.__TAURI__.core.invoke("quit_app");
  } finally { quitting = false; }
});
Store.listen("video-ended", () => {
  const it = itemAt(WF.live);
  if (it && it.kind === "media" && ((it.media || {}).videoEnd || WF.lib.settings.videoEnd) === "next") next();
});

/* ───────── 작은 메뉴 · 창 ───────── */
function showMenu(anchor, items) {
  const m = $("#menu");
  items = items.filter((x, i, a) => x !== "-" || (i > 0 && i < a.length - 1 && a[i + 1] !== "-")); // 앞뒤 · 겹친 구분선 빼기
  m.innerHTML = items.map((x, i) => x === "-" ? '<hr>' : `<button data-i="${i}" class="${x.danger ? "danger" : ""}" ${x.disabled ? "disabled" : ""}>${x.html || esc(x.label)}</button>`).join("");
  const r = anchor.getBoundingClientRect();
  m.style.left = Math.min(r.left, innerWidth - 300) + "px";
  m.style.top = r.bottom + 4 + "px";
  m.classList.remove("hidden");
  // 화면 아래쪽에서 열면 위로 펼침
  if (m.getBoundingClientRect().bottom > innerHeight - 8) m.style.top = Math.max(8, r.top - m.offsetHeight - 4) + "px";
  m.onclick = (e) => {
    const b = e.target.closest("button[data-i]"); if (!b) return;
    hideMenu();
    items[+b.dataset.i].run();
  };
  setTimeout(() => document.addEventListener("mousedown", outside), 0);
  function outside(e) { if (!m.contains(e.target)) { hideMenu(); } }
  function hideMenu() { m.classList.add("hidden"); document.removeEventListener("mousedown", outside); }
}
function modal(html, onReady) {
  const md = $("#modal");
  if (window.SE && SE.open && SE.panel && SE.home) { SE.home.appendChild(SE.panel); SE.open = false; md.onclick = null; } // 고치기 창 위에 다른 창이 뜨면 모양 칸을 제자리로
  $("#mbox").className = "mbox";
  $("#mbox").innerHTML = html;
  md.classList.remove("hidden");
  const close = () => md.classList.add("hidden");
  $$("[data-close]", md).forEach((b) => (b.onclick = close));
  if (onReady) onReady($("#mbox"), close);
  const first = $("input, textarea", md); if (first) setTimeout(() => first.focus(), 30);
  return close;
}
function prompt2(title, value) {
  return new Promise((res) => {
    modal(`<h3>${esc(title)}</h3><input id="p2" value="${esc(value || "")}"><div class="mfoot"><button class="btn" data-close>취소</button><button class="btn primary" id="p2ok">확인</button></div>`, (box, close) => {
      const ok = () => { const v = $("#p2", box).value; close(); res(v); };
      $("#p2ok", box).onclick = ok;
      $("#p2", box).onkeydown = (e) => { if (e.key === "Enter") ok(); if (e.key === "Escape") { close(); res(null); } };
      $$("[data-close]", box).forEach((b) => (b.onclick = () => { close(); res(null); }));
    });
  });
}
function banner(html, kind) {
  const b = $("#banner");
  if (!html) { b.classList.add("hidden"); return; }
  b.className = "banner " + (kind || "");
  b.innerHTML = html;
  return b;
}

/* ───────── 화면 바꾸기 ───────── */
function setMode(m) {
  WF.mode = m;
  $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.mode === m));
  $$(".view").forEach((v) => v.classList.toggle("on", v.id === "v-" + m));
  document.body.dataset.mode = m;
  if (m === "live" && !WF.serviceStart && WF.svc) { Store.autoBackup("service_start").catch(() => {}); }
  renderAll();
  saveSession();
}
// 맥 스타일 유리 효과(설정 → 화면 모양). 앱 창에서는 맥이 창 뒤에 유리를 그린다(html.vib).
function applyGlass() {
  const h = document.documentElement;
  h.classList.toggle("glass", WF.lib.settings.glass !== false);
  h.classList.toggle("vib", !!Store.inApp && WF.lib.settings.glass !== false);
}
// 화면 크기(설정 → 조작 창 모양): 저절로면 큰 모니터(창 너비 2300 이상)에서 115%.
// 앱에서는 창 전체 확대(webview zoom) — 확대하면 칸 배치(좁음 · 보통 · 넓음)도 그 크기에 맞춰 바뀐다.
function uiScaleNow() {
  const v = WF.lib.settings.uiScale || "auto";
  return v === "auto" ? (window.outerWidth >= 2300 ? 1.15 : 1) : +v || 1;
}
function applyUiScale() {
  const z = uiScaleNow();
  if (WF.uiZoom === z) return;
  WF.uiZoom = z;
  const wv = Store.inApp && window.__TAURI__.webview && window.__TAURI__.webview.getCurrentWebview && window.__TAURI__.webview.getCurrentWebview();
  if (wv && wv.setZoom) wv.setZoom(z).catch(() => (document.documentElement.style.zoom = z));
  else document.documentElement.style.zoom = z;
}
addEventListener("resize", () => { clearTimeout(WF.uiZoomT); WF.uiZoomT = setTimeout(() => { if (WF.lib) applyUiScale(); }, 300); });
function renderAll() {
  if (!WF.svc) return;
  $("#svcTitle").textContent = `${dateLabel(WF.svc.date)} · ${WF.svc.title}`;
  if (WF.mode === "prep") renderPrep();
  if (WF.mode === "live") renderLive();
  if (WF.mode === "library") renderLibrary();
  if (WF.mode === "settings") renderSettings();
  updateFlagChip();
}
function refreshLive() {
  if (WF.mode === "live") renderLive();
  else if (WF.mode === "prep") renderPrepLivePreview();
  updateFlagChip();
}
function updateFlagChip() {
  const f = WF.flags;
  const c = $("#chipFlag");
  const t = f.emergency ? "긴급 대기 중 (F9로 돌아가기)" : f.black ? "검은 화면 중 (B)" : f.logo ? "로고 화면 중 (L)" : f.cam ? "투명 화면 중 — 카메라만 (V)" : f.clear ? "글 지움 (C)" : WF.rehearsal ? "리허설 — 내보내지 않음" : "";
  c.classList.toggle("hidden", !t);
  c.querySelector("span").textContent = t;
}

function svcMenu() {
  const items = WF.services.slice(0, 12).map((s) => ({
    html: `<span class="mi-t">${esc(s.title)}</span><span class="mi-d">${esc(dateLabel(s.date))}</span>${WF.svc && s.id === WF.svc.id ? " ✓" : ""}`,
    run: () => openService(s.id),
  }));
  showMenu($("#svcBtn"), items.concat(["-",
    { label: "지금 예배 복제 (다음 주일로)", run: () => createService(WF.svc) },
    { label: "새 예배 (기본 순서)", run: () => createService(null) },
    { label: "이름 · 날짜 바꾸기", run: renameService },
    { label: "순서표 저장 · 인쇄 (방송 봉사자용)", run: () => saveCueSheet() },
    { label: "사역 행정에서 가져오기 (이번 주일 예배 순서)", run: () => importSaeyeok() },
    { label: "큐시트 파일 가져오기 (한글 · 엑셀 CSV · 사역 행정 파일)", run: () => importCue() },
    "-",
    { label: "이 예배 지우기…", danger: true, disabled: WF.services.length < 2, run: deleteService },
  ]));
}
async function renameService() {
  const t = await prompt2("예배 이름", WF.svc.title); if (t == null) return;
  const d = await prompt2("날짜 (예: 2026-11-01)", WF.svc.date); if (d == null) return;
  WF.svc.title = t.trim() || WF.svc.title;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d.trim())) WF.svc.date = d.trim();
  markDirty("svc"); renderAll();
}
async function deleteService() {
  if (!(await Store.confirm(`‘${WF.svc.title}’(${dateLabel(WF.svc.date)})을 지울까요?\n지운 예배는 데이터 폴더의 trash 에 보관됩니다.`))) return;
  const id = WF.svc.id;
  await Store.trash(`services/${id}.json`);
  WF.services = WF.services.filter((s) => s.id !== id);
  WF.svc = null;
  await openService(WF.services[0].id);
}

/* ───────── 시작 ───────── */
async function boot() {
  await Store.init();
  try { await document.fonts.load("700 40px 'Noto Sans KR'"); await document.fonts.load("700 40px 'Gowun Batang'"); await document.fonts.load("800 40px 'Nanum Myeongjo'"); } catch (e) {}
  WF.lib = upgradeLib((await Store.loadJSON("library.json", null)) || defaultLib());
  applyGlass();
  applyUiScale();
  await loadBible(WF.lib.settings.defaultBible);
  if (window.loadBars) await loadBars();
  await loadServices();
  if (!WF.services.length) {
    const s = newService();
    await Store.saveJSON(`services/${s.id}.json`, s);
    WF.services = [{ id: s.id, title: s.title, date: s.date, updatedAt: s.updatedAt }];
    await Store.saveJSON("library.json", WF.lib);
  }
  const sess = await Store.loadJSON("session.json", null);
  const lastId = (sess && sess.serviceId) || localStorageGet("lastService");
  await openService(WF.services.find((s) => s.id === lastId) ? lastId : WF.services[0].id);

  $$("#tabs button").forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
  $("#svcBtn").onclick = svcMenu;
  $("#projBtn").onclick = () => (WF.projOn ? projectionOff() : projectionOn());
  $("#keysHelp").onclick = () => $("#helpBtn").click();
  $("#chipStage").onclick = async () => { if (await Store.confirm("강단 화면(뒤쪽 모니터)을 끌까요?")) stageScreenOff(); };
  setInterval(updateSaveChip, 5000);
  if (WF.lib.settings.stageOn) Store.setStage(true).catch(() => {});
  // 강단 페이지의 남은 시간 · 태블릿이 새로 붙었을 때를 위해 30초마다 지금 상태를 다시 보냄(예배당 화면은 같은 내용이면 다시 그리지 않음)
  setInterval(() => { if (WF.live && !WF.rehearsal) Store.setLive(liveState()).catch(() => {}); }, 30000);
  setInterval(watchMonitors, 2000);
  await refreshMonitors();
  updateProjChip();

  // 비정상 종료 복구: 예배 중에 꺼졌으면 그 자리로 돌아갈지 묻는다(방송은 자동으로 다시 시작하지 않음)
  if (sess && sess.inLive && sess.live && sess.serviceId === WF.svc.id && Date.now() - sess.at < 6 * 3600 * 1000 && slideAt(sess.live)) {
    const b = banner(`지난번 예배 중에 앱이 닫혔습니다. 마지막 화면: <b>${esc(posLabel(sess.live))}</b>
      <button class="btn sm primary" id="rsYes">예배당 화면 켜고 그 화면부터 다시</button><button class="btn sm" id="rsNo">처음부터</button>`, "info");
    $("#rsYes", b).onclick = async () => {
      banner("");
      WF.serviceStart = sess.serviceStart || Date.now();
      WF.flags = Object.assign({ black: false, clear: false, logo: false, emergency: false }, sess.flags || {});
      setMode("live");
      await projectionOn();
      goLive(sess.live);
    };
    $("#rsNo", b).onclick = () => { banner(""); saveSession(); };
  } else if (!WF.lib.settings.noticeSeen) {
    const b = banner(`성경 본문 · 찬양 가사 · 글꼴의 이용 허락은 사용하는 교회의 책임입니다. 처음에는 시험용 성경 몇 구절만 들어 있습니다 — <b>보관함 → 성경 역본</b>에서 교회가 가진 성경 파일을 불러오세요. <button class="btn sm" id="ntOk">알겠습니다</button>`, "info");
    $("#ntOk", b).onclick = () => { WF.lib.settings.noticeSeen = true; markDirty("lib"); banner(""); };
  }
  // 창을 닫기 전에 저장
  addEventListener("beforeunload", () => { saveNow(); });
  addEventListener("resize", () => renderAll());
  runTestScript();
  // 브라우저 미리보기에서 문서용 화면 사진을 찍을 때만: index.html#shot=live 등
  const shot = !Store.inApp && (location.hash.match(/shot=(\w+)/) || [])[1];
  if (shot) {
    banner("");
    const sc = WF.svc.items.findIndex((i) => i.kind === "scripture");
    if (shot === "live") { setMode("live"); goLive({ item: sc, slide: 0 }); WF.stageMsg = ""; }
    else if (shot === "song") { setMode("live"); goLive({ item: WF.svc.items.findIndex((i) => i.kind === "song" && i.slides.length), slide: 1 }); }
    else if (shot === "prep") { WF.sel = { item: sc, slide: 0 }; renderPrep(); }
    else if (shot === "check") showCheck();
    else setMode(shot);
  }
}

// 자동 시험(개발용): 환경변수로 받은 시험 글을 돌리고 결과를 파일로 남긴다
async function runTestScript() {
  if (!Store.inApp) return;
  const src = await window.__TAURI__.core.invoke("test_script").catch(() => null);
  if (!src) return;
  WF.testing = true; // 시험 중에는 안내 창(확인 누를 때까지 멈춤)을 띄우지 않음
  const log = [];
  const ok = (cond, msg) => log.push((cond ? "PASS " : "FAIL ") + msg);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // 5초마다 중간 결과도 남김(시험이 멈췄을 때 어디서 멈췄는지 보이게) — 단, 셸이 기다리는 표시(REMOTE 등)를 앞서 쓴 시험은 건드리지 않음
  const flush = /test_report/.test(src) ? null : setInterval(() => window.__TAURI__.core.invoke("test_report", { text: log.join("\n") + "\n(진행 중)\n" }).catch(() => {}), 5000);
  try { await new Function("WF", "ok", "wait", "log", "return (async () => {" + src + "})()")(WF, ok, wait, log); }
  catch (e) { log.push("ERROR " + (e && e.stack || e)); }
  clearInterval(flush);
  await window.__TAURI__.core.invoke("test_report", { text: log.join("\n") + "\nDONE\n" });
}
document.addEventListener("DOMContentLoaded", boot);
