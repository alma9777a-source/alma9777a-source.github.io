// 큐시트 가져오기 — 한글(HWP) 큐시트 표 · 엑셀에서 저장한 CSV · 사역 행정 프로그램의 JSON 을
// WorshipFlow 예배 순서로 바꾼다. 화면에 나갈 것(곡 · 본문 · 설교 제목 · 기도자)은 항목으로,
// 음향 · 영상 · 동선 · 무대 · 조명 · 기타 칸은 ‘운영 메모’로(예배 중 조작 화면 · 강단에만 보임).
//
// 사역 행정 프로그램과 주고받는 파일(JSON) 모양:
//   { "format": "worship-cue", "version": 1, "title": "주일 2부 예배", "date": "2026-11-01",
//     "people": { "설교": "최완수 목사", "대표기도": "김○○ 장로", "봉헌기도": "", "축도": "" },
//     "rows": [ { "time": "11:05", "minutes": 15, "title": "[경배와 찬양] 1. … 2. …", "who": "찬양팀",
//                 "notes": { "음향": "유선 Mic", "영상": "가사자막" } } ],
//     "notice": "① … ② …" }
const CUE_COLS = { 시간: "time", 타이틀: "title", 순서: "title", 내용: "title", 항목: "title", 출연자: "who", 담당: "who", 담당자: "who", 인도: "who" };
const compact = (s) => String(s || "").replace(/\s+/g, "");

// 표(행 · 칸 글) → { rows, people, notice }
function cueFromTable(table) {
  const people = {};
  let h = table.findIndex((r) => r.some((c) => compact(c) === "시간") && r.some((c) => ["타이틀", "순서", "내용", "항목"].includes(compact(c))));
  if (h < 0) return null;
  // 머리 위쪽 칸의 “■설교: 최완수” 같은 줄 → 사람
  for (const r of table.slice(0, h)) for (const c of r) for (const line of String(c).split("\n")) {
    const m = line.match(/^\s*■?\s*([^:：]+?)\s*[:：]\s*(.*)$/);
    // 빈 양식(“■찬양팀 (팀장 & 인도: )”, “건반1: 베이스:”)은 건너뜀
    if (m && m[2].trim() && !/^[)\]\s]*$/.test(m[2]) && !/[:：]/.test(m[2])) people[compact(m[1]).replace(/\(.*$/, "")] = m[2].trim();
  }
  const head = table[h].map((c) => (c === "\u0001" ? "" : compact(c)));
  const cols = head.map((c) => CUE_COLS[c] || (c ? c : null));
  // i 번 칸의 이름: 머리 이름이 있는 가장 가까운 왼쪽 칸
  const nameAt = (i) => { for (let j = i; j >= 0; j--) if (cols[j]) return cols[j]; return null; };
  const rows = [], prev = {};
  let notice = "";
  for (const r of table.slice(h + 1)) {
    const filled = r.filter((v) => v && v !== "\u0001" && String(v).trim());
    // 시간 없이 긴 글(공지 · 광고, ① ② …) → 광고 화면 글
    const joined = filled.map((x) => String(x).trim()).join("\n");
    if (!/^\s*\d{1,2}\s*:\s*\d{2}/.test(filled[0] || "") && joined.length > 40 && /공지|광고|소식|[①-⑳]/.test(joined)) { notice = joined; continue; }
    const cells = {};
    r.forEach((v, i) => {
      if (v === "\u0001") return;
      let k = nameAt(i);
      if (!k) return;
      // 여러 이름 칸을 덮는 합친 칸은 ‘메모’로
      let j = i + 1; const names = new Set([k]);
      while (r[j] === "\u0001") { const n = nameAt(j); if (n) names.add(n); j++; }
      if (names.size > 1 && !["time", "title", "who"].includes(k)) k = names.size === 2 ? [...names].join("·") : "메모";
      v = String(v || "").trim();
      if (/^[〃″"]$/.test(v)) v = prev[k] || "";
      if (v) cells[k] = cells[k] ? cells[k] + "\n" + v : v;
    });
    const time = cells.time || "";
    if (!time && !cells.title) continue;
    if (!/\d{1,2}\s*[:시]\s*\d{0,2}/.test(time) && !cells.title) continue;
    Object.assign(prev, cells);
    const notes = {};
    for (const [k, v] of Object.entries(cells)) if (!["time", "title", "who"].includes(k)) notes[k] = v.replace(/\n/g, " ");
    const mm = time.match(/\((\d+)\s*[‘’'′분]?\s*\)/) || time.match(/(\d+)\s*분/);
    rows.push({ time: (time.match(/\d{1,2}\s*:\s*\d{2}/) || [""])[0].replace(/\s/g, ""), minutes: mm ? +mm[1] : 0, title: cells.title || "", who: (cells.who || "").replace(/\n/g, " "), notes });
  }
  return { rows, people, notice };
}

// CSV/TSV(엑셀) → 표
function tableFromCsv(text) {
  const sep = text.includes("\t") ? "\t" : ",";
  const out = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); out.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out;
}

// 큐시트 줄 → WorshipFlow 순서 항목
function cueToItems(cue) {
  const P = cue.people || {};
  const nameOf = (who) => { const w = compact(who); return !w || /다같이|전체|선생님|찬양팀|방송실|교사/.test(w) ? "" : w === "목사" ? "목사" : who.replace(/\s{2,}/g, " ").trim(); };
  const items = [];
  let lastRef = "";
  const findSong = (name) => {
    const n = compact(name).replace(/[“”"'‘’\[\]()·.,!?]/g, "");
    const num = (name.match(/(\d{1,3})\s*장/) || [])[1];
    return WF.lib.songs.find((s) => !s.hidden && num && s.number === +num) ||
      WF.lib.songs.find((s) => !s.hidden && n.length >= 3 && compact(s.title).replace(/^\d+장/, "").replace(/[“”"'‘’\[\]()·.,!?]/g, "") === n) ||
      WF.lib.songs.find((s) => !s.hidden && n.length >= 4 && compact(s.title).replace(/[“”"'‘’\[\]()·.,!?]/g, "").includes(n));
  };
  for (const r of cue.rows) {
    const lines = String(r.title).split("\n").map((x) => x.trim()).filter(Boolean);
    const head = (lines[0] || "").replace(/^\[|\]$/g, "").trim();
    const H = compact(head);
    const inBr = (String(r.title).match(/\[([^\]]+)\]/g) || []).map((x) => x.slice(1, -1).trim()).filter((x) => compact(x) !== H);
    const quoted = (String(r.title).match(/[“"]([^”"]+)[”"]/g) || []).map((x) => x.slice(1, -1).trim());
    const numbered = lines.slice(1).map((l) => (l.match(/^\d+\s*[.)]\s*(.+)$/) || [])[1]).filter(Boolean);
    const afterBar = (head.split(/_/)[1] || "").replace(/[“”"]/g, "").trim();
    const note = [r.time, r.who && "출연: " + r.who, ...Object.entries(r.notes || {}).map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join(" · ");
    const base = { id: uid("i"), minutes: r.minutes || 3, note, slides: [], fromCue: true };
    const cleanHead = head.replace(/_.*$/, "").replace(/\s+/g, " ").trim();

    if (/찬양|찬송|성가/.test(H) && !/기도/.test(H)) {
      const hymnNo = (String(r.title).match(/(\d{1,3})\s*장/) || [])[0]; // “찬송 305장”
      const names = numbered.length ? numbered : quoted.length ? quoted : inBr.length ? inBr : afterBar ? [afterBar] : hymnNo ? [hymnNo] : [];
      const label = /봉헌|헌금/.test(H) ? "봉헌 찬양" : cleanHead.replace(/[\[\]]/g, "").replace(/\s*\d{1,3}\s*장/, "").trim() || "찬송";
      if (!names.length) { items.push(Object.assign({}, base, { kind: "song", title: label, song: { songId: "" } })); continue; }
      names.forEach((nm, k) => {
        const s = findSong(nm);
        items.push(Object.assign({}, base, { id: uid("i"), minutes: k === 0 ? base.minutes : 0, kind: "song", title: `${label} · ${s ? s.title : nm}`, song: { songId: s ? s.id : "" }, cueSong: s ? "" : nm, barLabel: /봉헌|헌금/.test(H) ? "봉헌" : "" }));
      });
      continue;
    }
    if (/봉헌기도|헌금기도/.test(H)) { items.push(Object.assign({}, base, { kind: "prayer", title: "봉헌기도", prayer: { name: P["봉헌기도"] || nameOf(r.who), role: "봉헌기도" }, barLabel: "봉헌" })); continue; }
    if (/대표기도/.test(H)) { items.push(Object.assign({}, base, { kind: "prayer", title: "대표기도", prayer: { name: P["대표기도"] || nameOf(r.who), role: "대표기도" } })); continue; }
    if (/성경봉독|봉독|성경말씀|본문/.test(H)) {
      const src = inBr.concat(lines.slice(1)).join(" ") || head;
      const sp = Bible.findSpokenRefs(src)[0];
      const ref = sp ? sp.ref : (Bible.parseRef(src).length ? src : "");
      lastRef = ref;
      items.push(Object.assign({}, base, { kind: "scripture", title: ref ? "성경봉독 · " + Bible.refsLabel(Bible.parseRef(ref), true) : "성경봉독", scripture: { ref, bibleId: "", split: "fit" } }));
      continue;
    }
    if (/설교|말씀/.test(H) && !/기도/.test(H)) {
      const title = (inBr[0] || afterBar || lines.slice(1).join(" ")).replace(/^\s+|\s+$/g, "");
      items.push(Object.assign({}, base, { kind: "sermon", title: title ? "설교 · " + title : "설교", sermon: { title, ref: lastRef, preacher: P["설교"] || nameOf(r.who), points: [], verses: [] } }));
      continue;
    }
    if (/축도|강복/.test(H)) { items.push(Object.assign({}, base, { kind: "text", title: "축도", text: { text: "축도" + (P["축도"] ? "\n" + P["축도"] : "") } })); continue; }
    if (/신앙고백|사도신경/.test(H)) { items.push(Object.assign({}, base, { kind: "fixed", title: "신앙고백", fixed: { fixedId: (WF.lib.fixed.find((f) => /사도신경/.test(f.name)) || {}).id || "" } })); continue; }
    if (/광고|소식|공지/.test(H)) {
      const txt = cue.notice ? cue.notice.replace(/^\[[^\]]*\]\s*/, "").split(/\n(?=[①-⑳])/).map((x) => x.trim()).join("\n\n") : "";
      items.push(Object.assign({}, base, { kind: "media", title: cleanHead || "광고", media: { files: [], text: txt, auto: 0 } }));
      continue;
    }
    if (/환영|준비|대기|경건회|입례|부름/.test(H) && !/기도/.test(H)) {
      items.push(Object.assign({}, base, { kind: "standby", title: cleanHead, standby: { text: "", sub: "" }, barLabel: /부름/.test(H) ? "" : "none" }));
      continue;
    }
    // 그 밖(예배를 위한 기도 · 결단기도 등): 제목을 화면에 띄우는 글 화면
    const sub = afterBar || inBr[0] || lines.slice(1).join(" ");
    items.push(Object.assign({}, base, { kind: "text", title: cleanHead, text: { text: cleanHead + (sub ? "\n" + sub : "") } }));
  }
  for (const it of items) it.slides = buildSlides(it);
  return items;
}

async function readCueFile(path) {
  const ext = path.split(".").pop().toLowerCase();
  if (ext === "hwp") {
    const bytes = new Uint8Array(await window.__TAURI__.core.invoke("read_user_file", { path }));
    const doc = await Hwp.readHwp(bytes);
    for (const t of doc.tables) { const c = cueFromTable(t); if (c && c.rows.length) { c.title = (doc.paras.find((p) => /예배/.test(p)) || "").replace(/cue-?sheet/i, "").trim(); return c; } }
    throw new Error("이 한글 문서에서 큐시트 표(시간 · 타이틀 칸)를 찾지 못했습니다");
  }
  const text = await Store.readUserFile(path);
  if (ext === "json") {
    const j = JSON.parse(text);
    if (j.format !== "worship-cue") throw new Error("사역 행정 큐시트(worship-cue) 파일이 아닙니다");
    return { title: j.title || "", date: j.date || "", people: j.people || {}, notice: j.notice || "", rows: (j.rows || []).map((r) => ({ time: r.time || "", minutes: +r.minutes || 0, title: r.title || "", who: r.who || "", notes: r.notes || {} })) };
  }
  const c = cueFromTable(tableFromCsv(text));
  if (!c || !c.rows.length) throw new Error("큐시트 표(시간 · 타이틀 칸)를 찾지 못했습니다");
  return c;
}

async function importCue() {
  if (!Store.inApp) return Store.message("앱에서만 쓸 수 있습니다.");
  const p = await Store.pickFiles({ multiple: false, title: "큐시트 고르기", filters: [{ name: "큐시트", extensions: ["hwp", "csv", "tsv", "txt", "json"] }] });
  if (!p.length) return;
  let cue;
  try { cue = await readCueFile(p[0]); } catch (e) { return Store.message(String(e.message || e)); }
  showCueImport(cue, p[0].split("/").pop().replace(/\.[^.]+$/, ""));
}
// 사역 행정에서 가져오기(0.3.30): 같은 맥의 사역 행정 서버에서 그 주일 큐시트(예배 순서)를 받아 위와 같은 규칙으로 옮긴다
async function importSaeyeok() {
  if (!Store.inApp) return Store.message("앱에서만 쓸 수 있습니다.");
  const day = await prompt2("어느 주일 예배 순서를 가져올까요? (날짜)", nextSunday());
  if (day == null) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day.trim())) return Store.message("날짜는 2026-11-08 처럼 적어 주세요.");
  let w;
  try { w = JSON.parse(await window.__TAURI__.core.invoke("saeyeok_weekly", { sunday: day.trim() })); } catch (e) { return Store.message(String(e.message || e)); }
  const svcs = (w.services || []).filter((s) => (s.order || []).length);
  if (!svcs.length) return Store.message(`사역 행정에 ${dateLabel(w.sunday || day)} 예배 순서(큐시트)가 아직 없습니다.`);
  const go = (sv) => showCueImport(saeyeokCue(w, sv), "사역 행정 · " + sv.title);
  if (svcs.length === 1) return go(svcs[0]);
  modal(`<h3>사역 행정 — ${esc(dateLabel(w.sunday))}</h3><div class="muted small">어느 예배 순서를 가져올까요?</div>
    <div class="cuelist">${svcs.map((s, i) => `<button class="btn" data-sv="${i}" style="justify-content:flex-start;width:100%;margin:4px 0">${esc(s.title)} <span class="muted small">${esc(s.start || "")} · 순서 ${s.order.length}개</span></button>`).join("")}</div>
    <div class="mfoot"><button class="btn" data-close>취소</button></div>`, (box, close) => {
    $$("[data-sv]", box).forEach((b) => (b.onclick = () => { close(); go(svcs[+b.dataset.sv]); }));
  });
}
// 사역 행정 큐시트 → 가져오기 모양. ‘[ ]장’ · ‘[본문]’처럼 아직 안 채운 칸은 버리고, 설교 제목 · 본문은 주일 준비에서 채움
function saeyeokCue(w, sv) {
  const blank = (x) => !x || /\[[^\]]*\]/.test(x);
  const rows = sv.order.map((r) => {
    const t = String(r.title || "").trim(), sub = blank(r.sub) ? "" : String(r.sub).trim();
    let title = t + (sub ? "\n" + sub : "");
    if (/성경봉독|봉독|본문/.test(t)) title = t + (w.passage ? "\n" + w.passage : sub ? "\n" + sub : "");
    if (/설교|말씀/.test(t) && !/기도/.test(t)) title = t + (w.sermon ? "\n[" + w.sermon + "]" : sub ? "\n[" + sub + "]" : ""); // 제목은 둘째 줄(제목에 ‘기도’가 있어도 설교로)
    if (/찬양|찬송|성가/.test(t) && sub && !/\d{1,3}\s*장/.test(sub)) title = t + "\n“" + sub.replace(/[“”"]/g, "") + "”"; // 곡명은 따옴표로 → 보관함에서 찾기
    const who = /기도/.test(t) && sub ? sub : "";
    return { time: "", minutes: +r.min || 1, title, who, notes: sub && !who && !/찬송|찬양|성경|설교|말씀/.test(t) ? { "사역 행정": sub } : {} };
  });
  return { title: sv.title || "주일 예배", date: w.sunday || "", people: {}, notice: "", rows };
}
function showCueImport(cue, file) {
  const items = cueToItems(cue);
  const kn = (it) => (KINDS[it.kind] || KINDS.text).name.split(" · ")[0];
  const missing = items.filter((it) => it.cueSong).map((it) => it.cueSong);
  modal(`<h3>큐시트 가져오기 — ${esc(file)}</h3>
    <div class="muted small">순서 ${items.length}개 · 음향 · 영상 · 동선 등은 각 순서의 ‘운영 메모’로 들어갑니다. 가져온 뒤 준비 화면에서 고치면 됩니다.</div>
    <div class="cuelist">${items.map((it) => `<div class="cuerow"><span class="oicon sm" style="background:${(KINDS[it.kind] || KINDS.text).color}">${(KINDS[it.kind] || KINDS.text).icon}</span><b>${esc(it.title)}</b><span class="muted small">${esc(kn(it))}${it.error ? " · " + esc(it.error) : ` · 화면 ${it.slides.length}장`}</span></div>`).join("")}</div>
    ${missing.length ? `<div class="warnc small">보관함에 없는 곡: ${esc(missing.join(", "))} — 가져온 뒤 그 순서에서 곡을 고르거나 새 곡으로 넣으세요.</div>` : ""}
    <div class="mfoot"><button class="btn" data-close>취소</button><button class="btn" id="cueAppend">지금 예배 끝에 붙이기</button><button class="btn primary" id="cueNew">새 예배로 만들기</button></div>`, (box, close) => {
    $("#cueNew", box).onclick = async () => {
      close();
      const s = newService(cue.title || "주일 예배", /^\d{4}-\d{2}-\d{2}$/.test(cue.date || "") ? cue.date : nextSunday());
      s.items = items;
      await Store.saveJSON(`services/${s.id}.json`, s);
      WF.services.unshift({ id: s.id, title: s.title, date: s.date, updatedAt: s.updatedAt });
      await openService(s.id);
      setMode("prep");
    };
    $("#cueAppend", box).onclick = () => { close(); WF.svc.items.push(...items); markDirty("svc"); renderAll(); };
  });
}
