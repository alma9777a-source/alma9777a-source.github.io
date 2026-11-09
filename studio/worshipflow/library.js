// 보관함 — 곡 · 성경 역본 · 고정 문구 · 그림/영상. 한 번 넣으면 매주 순서에서 골라 쓴다.
WF.libTab = WF.libTab || "songs";

function libRows() {
  const q = ($("#libSearch").value || "").trim();
  const cho = /^[ㄱ-ㅎ]+$/.test(q);
  const match = (s) => !q || s.includes(q) || (cho && Bible.chosung(s).includes(q));
  if (WF.libTab === "songs") return WF.lib.songs.slice().sort((a, b) => a.title.localeCompare(b.title, "ko", { numeric: true })).filter((s) => !s.hidden && ((/^\d+$/.test(q) && s.number === +q) || match(s.title) || (!cho && q && (s.text || "").includes(q)))).map((s) => ({ id: s.id, t: s.title, d: [s.author, s.lastUsed ? `마지막 ${s.lastUsed.slice(5).replace("-", "/")} · ${s.useCount || 1}번` : ""].filter(Boolean).join(" · ") }));
  if (WF.libTab === "fixed") return WF.lib.fixed.filter((s) => !s.hidden && match(s.name)).map((s) => ({ id: s.id, t: s.name, d: "" }));
  if (WF.libTab === "bibles") return WF.lib.bibles.filter((b) => !b.hidden && match(b.name)).map((b) => ({ id: b.id, t: b.name, d: (b.count || 0).toLocaleString() + "절" + (b.id === WF.lib.settings.defaultBible ? " · 기본" : "") }));
  return WF.lib.media.filter((m) => !m.hidden && match(m.name)).map((m) => ({ id: m.id, t: m.name, d: /^(mp4|mov|m4v|webm)$/i.test(m.ext) ? "영상" : AUDIO_RE.test(m.ext) ? "오디오" : "그림" }));
}

function renderLibrary() {
  $$("#libTabs button").forEach((b) => b.classList.toggle("on", b.dataset.lib === WF.libTab));
  const rows = libRows();
  if (!rows.find((r) => r.id === WF.libSel)) WF.libSel = rows[0] && rows[0].id;
  $("#libList").innerHTML = rows.map((r) => `<div class="oitem ${r.id === WF.libSel ? "sel" : ""}" data-id="${r.id}"><span class="otext"><b>${esc(r.t)}</b><small>${esc(r.d)}</small></span></div>`).join("") ||
    `<div class="muted small pad">아직 없습니다.</div>`;
  $$("#libList .oitem").forEach((el) => (el.onclick = () => { WF.libSel = el.dataset.id; renderLibrary(); }));
  $("#libAdd").textContent = { songs: "＋ 새 곡", fixed: "＋ 새 고정 문구", bibles: "＋ 성경 파일 불러오기", media: "＋ 그림 · 영상 더하기" }[WF.libTab];
  const ed = $("#libEdit");
  const back = WF.libReturn ? `<button class="btn" id="libBack">← 준비 화면으로</button>` : "";
  if (WF.libTab === "songs") songEditor(ed, back);
  else if (WF.libTab === "fixed") fixedEditor(ed, back);
  else if (WF.libTab === "bibles") bibleEditor(ed, back);
  else mediaEditor(ed, back);
  const bb = $("#libBack"); if (bb) bb.onclick = () => { WF.libReturn = false; setMode("prep"); };
}

function secsHtml(s) {
  const secs = Render.splitLyrics(s.text);
  const names = secs.map((x) => x.name).filter(Boolean);
  const missing = String(s.order || "").trim().split(/\s+/).filter((n) => n && !names.includes(n));
  return secs.map((x) => `<div class="sec"><b>${esc(x.name || "(이름 없음)")}</b>${Render.sectionKey(x.name) ? `<kbd>${Render.sectionKey(x.name)}</kbd>` : ""}<span class="muted small">화면 ${x.slides.length}장</span></div>`).join("") +
    (missing.length ? `<div class="warnc small">부르는 순서에 있는데 가사에 없는 부분: ${esc(missing.join(", "))} — 적힌 순서대로 나갑니다</div>` : "") +
    `<div class="muted small">나가는 화면 ${songSlides(s).length}장</div>`;
}
function songEditor(ed, back) {
  const s = WF.lib.songs.find((x) => x.id === WF.libSel);
  if (!s) { ed.innerHTML = `<div class="empty-note">왼쪽에서 곡을 고르거나 ‘＋ 새 곡’을 누르세요.${back}</div>`; return; }
  ed.innerHTML = `<div class="phead"><b>곡</b><div class="grow"></div>${back}<button class="btn sm danger" id="sDel">곡 숨기기</button></div>
    <div class="form2">
      <label>제목</label><input id="sTitle" value="${esc(s.title)}">
      <label>찬송가 번호</label><input id="sNum" value="${s.number || ""}" placeholder="새찬송가 번호(있으면)" style="max-width:160px">
      <label>지은이 · 출처</label><input id="sAuthor" value="${esc(s.author || "")}" placeholder="작사 · 작곡 · 찬송가 번호">
      <label>사용 허락 메모</label><input id="sLic" value="${esc(s.license || "")}" placeholder="예: CCLI 번호, 교회 사용 허락 받음(2026-10)">
      <label>부르는 순서</label><input id="sOrder" value="${esc(s.order || "")}" placeholder="예: 1절 후렴 2절 후렴 브리지 후렴 (비우면 적힌 순서대로)">
    </div>
    <div class="lyrics-wrap">
      <div>
        <div class="muted small">가사 — 빈 줄 = 화면 나눔 · <b>[1절] [2절] [후렴] [브리지]</b> = 부분 이름. 한글 · 메모장 · PPT에서 복사해 붙여 넣으세요.</div>
        <textarea id="sText" spellcheck="false">${esc(s.text || "")}</textarea>
        <div class="tools"><button class="btn sm" id="sPptx">파워포인트에서 가사 가져오기</button><button class="btn sm" id="sAuto">부분 이름 없이 붙여 넣었으면: 빈 줄마다 나누기</button><button class="btn sm" id="sUse">지금 예배 순서에 넣기</button></div>
      </div>
      <div class="secs">${secsHtml(s)}</div>
    </div>`;
  const save = () => { s.updatedAt = Date.now(); markDirty("lib"); rebuildSongEverywhere(s.id); markDirty("svc"); };
  $("#sTitle").onchange = (e) => { s.title = e.target.value.trim() || "제목 없음"; save(); renderLibrary(); };
  $("#sNum").onchange = (e) => { const n = parseInt(e.target.value, 10); s.number = n > 0 ? n : undefined; save(); renderLibrary(); };
  $("#sAuthor").onchange = (e) => { s.author = e.target.value; save(); };
  $("#sLic").onchange = (e) => { s.license = e.target.value; save(); };
  $("#sOrder").onchange = (e) => { s.order = e.target.value.trim(); save(); renderLibrary(); };
  let tm = null;
  // 글을 치는 동안 화면 전체를 다시 그리지 않고(스크롤 · 커서 유지) 오른쪽 부분 목록만 고친다
  $("#sText").oninput = (e) => { s.text = e.target.value; clearTimeout(tm); tm = setTimeout(() => { save(); const sc = $(".secs"); if (sc) sc.innerHTML = secsHtml(s); }, 600); };
  $("#sAuto").onclick = () => {
    if (/^\s*\[/m.test(s.text)) return Store.message("이미 [부분 이름]이 있습니다.");
    const blocks = s.text.trim().split(/\n\s*\n/);
    s.text = blocks.map((b, i) => `[${i + 1}절]\n${b.trim()}`).join("\n\n");
    save(); renderLibrary();
  };
  $("#sPptx").onclick = async () => {
    const r = await pickPptx(); if (!r) return;
    if (s.text.trim() && s.text.trim() !== "[1절]\n\n\n[후렴]".trim() && !(await Store.confirm("지금 가사를 파워포인트 글로 바꿀까요?"))) return;
    s.text = r.slides.join("\n\n");
    if (/^(새 곡|제목 없음)$/.test(s.title)) s.title = r.name;
    save(); renderLibrary();
  };
  $("#sUse").onclick = () => {
    const it = { id: uid("i"), kind: "song", title: s.title, minutes: 4, song: { songId: s.id }, slides: [] };
    it.slides = buildSlides(it);
    const at = Math.min(WF.sel.item + 1, WF.svc.items.length);
    WF.svc.items.splice(at, 0, it);
    if (WF.live && WF.live.item >= at) WF.live.item++;
    if (WF.cue && WF.cue.item >= at) WF.cue.item++;
    WF.sel = { item: at, slide: 0 };
    markDirty("svc"); setMode("prep");
  };
  $("#sDel").onclick = async () => {
    if (!(await Store.confirm(`‘${s.title}’을 보관함 목록에서 숨길까요? (자료는 지우지 않고 남겨 둡니다)`))) return;
    s.hidden = true; markDirty("lib"); renderLibrary();
  };
}

function fixedEditor(ed, back) {
  const f = WF.lib.fixed.find((x) => x.id === WF.libSel);
  if (!f) { ed.innerHTML = `<div class="empty-note">사도신경 · 주기도문 · 교독문 · 축도처럼 매주 쓰는 글을 넣어 두세요.${back}</div>`; return; }
  const n = fixedSlides(f).length;
  ed.innerHTML = `<div class="phead"><b>고정 문구</b><div class="grow"></div>${back}<button class="btn sm danger" id="fDel">숨기기</button></div>
    <div class="form2"><label>이름</label><input id="fName2" value="${esc(f.name)}"></div>
    <div class="muted small">빈 줄 = 화면 나눔. 교독문은 줄 앞에 <b>인도:</b> · <b>회중:</b> 을 붙이면 따로 표시됩니다. 교회가 쓰는 판(새 번역 / 옛 번역) 그대로 적으세요. — 화면 ${n}장</div>
    <textarea id="fText2" class="tall" spellcheck="false">${esc(f.text)}</textarea>`;
  const save = () => { markDirty("lib"); for (const it of WF.svc.items) if (it.kind === "fixed" && it.fixed.fixedId === f.id) rebuild(it, true); markDirty("svc"); };
  $("#fName2").onchange = (e) => { f.name = e.target.value.trim() || "이름 없음"; save(); renderLibrary(); };
  let tm = null;
  $("#fText2").oninput = (e) => { f.text = e.target.value; clearTimeout(tm); tm = setTimeout(save, 700); };
  $("#fDel").onclick = async () => { if (await Store.confirm(`‘${f.name}’을 목록에서 숨길까요?`)) { f.hidden = true; save(); renderLibrary(); } };
}

function bibleEditor(ed, back) {
  const b = WF.lib.bibles.find((x) => x.id === WF.libSel);
  ed.innerHTML = `<div class="phead"><b>성경 역본</b><div class="grow"></div>${back}</div>
    <div class="note-box">성경 번역본은 앱에 들어 있지 않습니다. 교회가 이용 허락을 받은 성경 파일을 불러와 쓰세요.
      개역개정 · 새번역은 대한성서공회의 허락이 필요합니다. 처음 들어 있는 것은 시험용 몇 구절(개역한글)뿐입니다.<br>
      <span class="muted small">읽을 수 있는 파일: ① 한 줄에 한 절 — <code>창1:1 태초에…</code> 또는 <code>창세기 1:1 태초에…</code> ② CSV — <code>책,장,절,본문</code> ③ JSON ④ USFM. 한글 옛 파일(EUC-KR)도 됩니다.</span></div>
    ${b ? `<div class="form2"><label>이름</label><input id="bName" value="${esc(b.name)}">
      <label>구절 수</label><span>${(b.count || 0).toLocaleString()}절</span>
      <label>허락 메모</label><input id="bNote" value="${esc(b.note || "")}" placeholder="예: 대한성서공회 허락 (2026-11)">
      <label></label><span>${b.id === WF.lib.settings.defaultBible ? `<b class="okc">기본 역본으로 쓰는 중</b>` : `<button class="btn sm" id="bDefault">기본 역본으로</button>`}
      ${b.id !== Samples.SAMPLE_BIBLE.id ? `<button class="btn sm danger" id="bHide">목록에서 숨기기</button>` : ""}</span></div>
      <div class="qrow"><input id="bTest" placeholder="찾아보기: 요 3:16 · 시 23 · 또는 낱말(사랑)" ><button class="btn" id="bTestGo">찾기</button></div>
      <div id="bTestOut" class="vlist"></div>` : ""}`;
  if (!b) return;
  $("#bName").onchange = (e) => { b.name = e.target.value.trim() || b.name; markDirty("lib"); renderLibrary(); };
  $("#bNote").onchange = (e) => { b.note = e.target.value; markDirty("lib"); };
  const d = $("#bDefault"); if (d) d.onclick = async () => { WF.lib.settings.defaultBible = b.id; await loadBible(b.id); for (const it of WF.svc.items) if ((it.kind === "scripture" || it.kind === "sermon") && !(it.scripture || it.sermon).bibleId) rebuild(it, true); markDirty(); renderLibrary(); };
  const h = $("#bHide"); if (h) h.onclick = async () => { if (await Store.confirm(`‘${b.name}’을 목록에서 숨길까요? (파일은 남겨 둡니다)`)) { b.hidden = true; if (WF.lib.settings.defaultBible === b.id) WF.lib.settings.defaultBible = Samples.SAMPLE_BIBLE.id; markDirty("lib"); renderLibrary(); } };
  const go = async () => {
    const q = $("#bTest").value.trim(); if (!q) return;
    const bible = await loadBible(b.id);
    const refs = Bible.parseRef(q);
    const vs = refs.length ? Bible.getVerses(bible, refs) : Bible.searchWords(bible, q, 60);
    $("#bTestOut").innerHTML = vs.length ? vs.map((v) => `<div><b>${Bible.SHORT[v.book]} ${v.c}:${v.v}</b> ${esc(v.text)}</div>`).join("") : `<div class="muted">찾은 구절이 없습니다.</div>`;
  };
  $("#bTestGo").onclick = go;
  $("#bTest").onkeydown = (e) => { if (e.key === "Enter") go(); };
}

async function importBibleFile() {
  const paths = await Store.pickFiles({ multiple: false, title: "성경 파일 고르기", filters: [{ name: "성경 파일", extensions: ["txt", "csv", "tsv", "json", "usfm", "sfm"] }] });
  if (!paths.length) return;
  let parsed;
  try {
    const txt = await Store.readUserFile(paths[0]);
    parsed = Bible.parseBibleFile(txt, paths[0]);
  } catch (e) { return Store.message("파일을 읽지 못했습니다: " + e); }
  if (!parsed.count) return Store.message("이 파일에서 성경 구절을 찾지 못했습니다.\n한 줄에 한 절(창1:1 태초에…) 또는 CSV(책,장,절,본문) 모양인지 확인해 주세요.");
  const fname = paths[0].split("/").pop().replace(/\.[^.]+$/, "");
  const name = await prompt2(`구절 ${parsed.count.toLocaleString()}개를 찾았습니다. 역본 이름`, parsed.name || fname);
  if (name == null) return;
  const id = uid("bib");
  await Store.saveJSON(`bibles/${id}.json`, { id, name, books: parsed.books });
  WF.bibles[id] = { id, name, books: parsed.books };
  WF.lib.bibles.push({ id, name, note: "", count: parsed.count, added: Date.now() });
  const books = Object.keys(parsed.books).length;
  if (WF.lib.settings.defaultBible === Samples.SAMPLE_BIBLE.id && books >= 60) WF.lib.settings.defaultBible = id;
  markDirty("lib");
  WF.libSel = id;
  renderLibrary();
  Store.message(`‘${name}’을 불러왔습니다 — ${books}권, ${parsed.count.toLocaleString()}절.` + (WF.lib.settings.defaultBible === id ? "\n기본 역본으로 정했습니다." : ""));
}

function mediaEditor(ed, back) {
  const list = WF.lib.media.filter((m) => !m.hidden);
  const m = list.find((x) => x.id === WF.libSel);
  const st = WF.lib.settings;
  const isVid = (x) => /^(mp4|mov|m4v|webm)$/i.test(x.ext);
  ed.innerHTML = `<div class="phead"><b>그림 · 영상</b><span class="muted small">파일은 앱 보관 폴더에 복사되어 원본을 옮겨도 깨지지 않습니다</span><div class="grow"></div>${back}</div>
    ${m ? `<div class="mdetail">
      <div class="mbig">${AUDIO_RE.test(m.ext) ? `<audio src="${Store.mediaUrl(m.file)}" controls></audio>` : isVid(m) ? `<video src="${Store.mediaUrl(m.file)}" controls muted></video>` : `<img src="${Store.mediaUrl(m.file)}">`}</div>
      <div class="form2"><label>이름</label><input id="mName" value="${esc(m.name)}">
        <label>쓰임</label><span>
          ${isVid(m) || AUDIO_RE.test(m.ext) ? "" : `<button class="btn sm" id="mLogo">${st.logoMedia === m.file ? "✓ 교회 로고" : "교회 로고로 쓰기"}</button>
          <button class="btn sm" id="mEmerg">${st.emergencyMedia === m.file ? "✓ 긴급 화면" : "긴급 화면으로 쓰기"}</button>`}
          <button class="btn sm danger" id="mHide">목록에서 숨기기</button></span></div></div>` : `<div class="empty-note">광고 그림 · 영상, 교회 로고, 배경 그림을 넣어 두세요.</div>`}
    <div class="mgrid">${list.map((x) => `<button class="mcell ${x.id === WF.libSel ? "sel" : ""}" data-id="${x.id}">${AUDIO_RE.test(x.ext) ? `<div class="aud">♪</div>` : isVid(x) ? `<video src="${Store.mediaUrl(x.file)}#t=0.5" muted preload="metadata"></video>` : `<img src="${Store.mediaUrl(x.file)}" loading="lazy">`}<span>${esc(x.name)}</span></button>`).join("")}</div>`;
  $$(".mcell", ed).forEach((b) => (b.onclick = () => { WF.libSel = b.dataset.id; renderLibrary(); }));
  if (!m) return;
  $("#mName").onchange = (e) => { m.name = e.target.value; markDirty("lib"); renderLibrary(); };
  const lg = $("#mLogo"); if (lg) lg.onclick = () => { st.logoMedia = st.logoMedia === m.file ? "" : m.file; markDirty("lib"); renderLibrary(); };
  const em = $("#mEmerg"); if (em) em.onclick = () => { st.emergencyMedia = st.emergencyMedia === m.file ? "" : m.file; markDirty("lib"); renderLibrary(); };
  $("#mHide").onclick = async () => { if (await Store.confirm(`‘${m.name}’을 목록에서 숨길까요? (이미 순서에 넣은 것은 그대로 나옵니다)`)) { m.hidden = true; markDirty("lib"); renderLibrary(); } };
}

// 파워포인트 여러 개 → 곡 여러 개(파일 이름 = 곡 제목, 슬라이드 = 화면). 같은 제목이 있으면 건너뜀.
async function importPptxSongs() {
  const paths = await Store.pickFiles({ multiple: true, title: "찬양 파워포인트 고르기(여러 개 가능)", filters: [{ name: "파워포인트", extensions: ["pptx"] }] });
  if (!paths.length) return;
  let added = 0, skipped = [], failed = [];
  for (const p of paths) {
    const name = p.split("/").pop().replace(/\.pptx$/i, "").trim();
    if (WF.lib.songs.find((x) => !x.hidden && x.title === name)) { skipped.push(name); continue; }
    try {
      const slides = (await Store.pptxText(p)).map((t) => t.trim()).filter(Boolean);
      // 첫 장이 제목만 있는 슬라이드면 빼기(곡 제목과 같을 때)
      if (slides.length > 1 && slides[0].replace(/\s/g, "") === name.replace(/\s/g, "")) slides.shift();
      if (!slides.length) { failed.push(name); continue; }
      const num = (name.match(/^(\d{1,3})(?=\D|$)/) || [])[1]; // “305 나 같은 죄인” · “305장” → 찬송가 번호
      WF.lib.songs.push({ id: uid("song"), title: name, number: num ? +num : undefined, author: "", source: "파워포인트에서 가져옴", license: "", order: "", text: slides.join("\n\n"), created: Date.now() });
      added++;
    } catch (e) { failed.push(name); }
  }
  markDirty("lib"); renderLibrary();
  Store.message(`곡 ${added}개를 가져왔습니다.` + (skipped.length ? `\n이미 있어서 건너뜀: ${skipped.join(", ")}` : "") + (failed.length ? `\n글을 찾지 못함: ${failed.join(", ")}` : "") +
    (added ? "\n\n가져온 곡에는 [1절] [후렴] 같은 부분 이름이 없습니다. 자주 부르는 곡부터 부분 이름을 붙이면 예배 중 1 · 2 · R 키를 쓸 수 있습니다." : ""));
}

async function libAdd() {
  if (WF.libTab === "songs") {
    const how = await new Promise((res) => modal(`<h3>새 곡</h3><div class="tools" style="padding:0"><button class="btn primary" id="nsType">직접 입력</button><button class="btn" id="nsPptx">파워포인트 파일에서 (여러 개 가능)</button><button class="btn" id="nsPro">프로프리젠터 자료에서</button><button class="btn" data-close>취소</button></div>`, (box, close) => {
      $("#nsType", box).onclick = () => { close(); res("type"); };
      $("#nsPptx", box).onclick = () => { close(); res("pptx"); };
      $("#nsPro", box).onclick = () => { close(); res("pro"); };
      $$("[data-close]", box).forEach((b) => (b.onclick = () => { close(); res(null); }));
    }));
    if (how === "pptx") return importPptxSongs();
    if (how === "pro") return importProPresenter();
    if (how !== "type") return;
    const t = await prompt2("새 곡 제목", ""); if (!t) return;
    const s = { id: uid("song"), title: t.trim(), author: "", source: "", license: "", order: "", text: "[1절]\n\n\n[후렴]\n", created: Date.now() };
    WF.lib.songs.push(s); WF.libSel = s.id; markDirty("lib"); renderLibrary();
    const ta = $("#sText"); if (ta) { ta.focus(); ta.setSelectionRange(5, 5); }
  } else if (WF.libTab === "fixed") {
    const t = await prompt2("이름 (예: 교독문 1번, 축도)", ""); if (!t) return;
    const f = { id: uid("fx"), name: t.trim(), text: "" };
    WF.lib.fixed.push(f); WF.libSel = f.id; markDirty("lib"); renderLibrary();
  } else if (WF.libTab === "bibles") importBibleFile();
  else {
    const paths = await Store.pickFiles({ title: "그림 · 영상 고르기", filters: [{ name: "그림 · 영상 · 오디오", extensions: MEDIA_EXT.concat(AUDIO_EXT) }] });
    for (const p of paths) { try { const r = await Store.importMedia(p); addMediaToLib(r); WF.libSel = WF.lib.media.find((x) => x.file === r.file).id; } catch (e) { Store.message("가져오지 못했습니다: " + e); } }
    if (paths.length) { markDirty("lib"); renderLibrary(); }
  }
}

(function wireLibrary() {
  $$("#libTabs button").forEach((b) => (b.onclick = () => { WF.libTab = b.dataset.lib; WF.libSel = null; $("#libSearch").value = ""; renderLibrary(); }));
  $("#libSearch").oninput = () => renderLibrary();
  $("#libAdd").onclick = libAdd;
})();
