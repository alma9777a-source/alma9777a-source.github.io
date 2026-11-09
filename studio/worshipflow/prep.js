// 준비 화면 — 예배 순서 · 항목 내용 · 화면 나누기 · 글 고치기 · 모양.
function selItem() { return WF.svc.items[WF.sel.item]; }

function itemSub(it) {
  const n = it.slides.length;
  const tail = n ? ` · 화면 ${n}장` : "";
  if (it.error) return `<span class="warnc">${esc(it.error)}</span>`;
  switch (it.kind) {
    case "song": { const s = WF.lib.songs.find((x) => x.id === (it.song || {}).songId); return esc(s ? s.title : "") + tail; }
    case "scripture": return esc((it.scripture || {}).ref || "") + tail;
    case "sermon": return esc((it.sermon || {}).title || "제목 없음") + tail;
    case "prayer": return esc((it.prayer || {}).name || "이름 없음");
    case "fixed": { const f = WF.lib.fixed.find((x) => x.id === (it.fixed || {}).fixedId); return esc(f ? f.name : "") + tail; }
    case "media": return `그림·영상 ${((it.media || {}).files || []).length}개` + tail;
    case "standby": return "대기 화면 · 교회 로고";
    default: return tail.replace(/^ · /, "");
  }
}

function renderPrep() {
  const svc = WF.svc;
  if (WF.sel.item >= svc.items.length) WF.sel.item = Math.max(0, svc.items.length - 1);
  // 순서 목록
  const mins = svc.items.reduce((a, b) => a + (+b.minutes || 0), 0);
  $("#orderSum").textContent = `${svc.items.length}개 · 약 ${mins}분`;
  const ol = $("#orderList");
  ol.innerHTML = svc.items.map((it, i) => {
    const k = KINDS[it.kind] || KINDS.text;
    const isLive = WF.live && WF.live.item === i;
    return `<div class="oitem ${i === WF.sel.item ? "sel" : ""} ${isLive ? "islive" : ""} ${it.error ? "haserr" : ""}" draggable="true" data-i="${i}">
      <span class="oicon" style="background:${k.color}">${k.icon}</span>
      <span class="otext"><b>${esc(it.title)}${it.carried ? ' <span class="carried">지난주 그대로?</span>' : ""}</b><small>${itemSub(it)}</small></span>
      <span class="omin">${it.minutes ? it.minutes + "분" : ""}</span>
      <button class="omore" data-more="${i}" title="더 보기">⋯</button>
    </div>`;
  }).join("");
  $$(".oitem", ol).forEach((el) => {
    const i = +el.dataset.i;
    el.onclick = (e) => { if (e.target.closest(".omore")) return; WF.sel = { item: i, slide: 0 }; WF.barScope = null; renderPrep(); };
    el.ondblclick = async () => { const t = await prompt2("항목 이름", svc.items[i].title); if (t) { renameItem(svc.items[i], t.trim()); markDirty("svc"); afterItemChange(svc.items[i]); } };
    el.ondragstart = (e) => { e.dataTransfer.setData("text/plain", String(i)); el.classList.add("dragging"); };
    el.ondragend = () => el.classList.remove("dragging");
    el.ondragover = (e) => { e.preventDefault(); el.classList.add("dropto"); };
    el.ondragleave = () => el.classList.remove("dropto");
    el.ondrop = (e) => {
      e.preventDefault(); el.classList.remove("dropto");
      const from = +e.dataTransfer.getData("text/plain");
      if (isNaN(from) || from === i) return;
      moveItem(from, i);
    };
  });
  $$(".omore", ol).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); itemMenu(b, +b.dataset.more); }));
  $("#addItemBtn").onclick = () => showMenu($("#addItemBtn"), Object.keys(KINDS).map((k) => ({
    html: `<span class="oicon sm" style="background:${KINDS[k].color}">${KINDS[k].icon}</span> ${esc(KINDS[k].name)}`,
    run: () => addItem(k),
  })).concat(["-", { html: `<span class="oicon sm" style="background:#e58a4a">P</span> 파워포인트에서 가져오기 (.pptx)`, run: importPptxItem }]));

  renderItemEditor();
  renderPrepLivePreview();
  if (window.renderShelf) renderShelf();
}

// 순서 옮기기 — 지금/다음 위치도 같이 따라가게
function moveItem(from, to) {
  const items = WF.svc.items;
  const liveId = WF.live && items[WF.live.item] && items[WF.live.item].id;
  const cueId = WF.cue && items[WF.cue.item] && items[WF.cue.item].id;
  const selId = items[WF.sel.item] && items[WF.sel.item].id;
  const [x] = items.splice(from, 1);
  items.splice(to, 0, x);
  const idx = (id) => items.findIndex((it) => it.id === id);
  if (liveId) WF.live.item = idx(liveId);
  if (cueId) WF.cue.item = idx(cueId);
  WF.sel.item = selId ? idx(selId) : to;
  WF.undo = []; // 순서가 바뀌면 되돌리기 위치가 어긋나므로 비운다
  markDirty("svc");
  renderPrep();
}

function addItem(kind) {
  const it = { id: uid("i"), kind, title: KINDS[kind].name.split(" · ")[0], minutes: 3, slides: [] };
  if (kind === "song") Object.assign(it, { title: "찬양", song: { songId: "" } });
  if (kind === "scripture") Object.assign(it, { scripture: { ref: "", bibleId: "", split: "fit" } });
  if (kind === "sermon") Object.assign(it, { sermon: { title: "", ref: "", preacher: "", points: [], verses: [] }, minutes: 30 });
  if (kind === "prayer") Object.assign(it, { title: "기도", prayer: { name: "", role: "대표기도" } });
  if (kind === "fixed") Object.assign(it, { title: "신앙고백", fixed: { fixedId: (WF.lib.fixed[0] || {}).id || "" } });
  if (kind === "media") Object.assign(it, { title: "광고", media: { files: [], text: "", auto: 0 } });
  if (kind === "text") Object.assign(it, { title: "글", text: { text: "" } });
  if (kind === "standby") Object.assign(it, { title: "대기", standby: { text: "", sub: "" } });
  it.slides = buildSlides(it);
  const at = Math.min(WF.sel.item + 1, WF.svc.items.length);
  WF.svc.items.splice(at, 0, it);
  if (WF.live && WF.live.item >= at) WF.live.item++;
  if (WF.cue && WF.cue.item >= at) WF.cue.item++;
  WF.sel = { item: at, slide: 0 };
  WF.undo = [];
  markDirty("svc");
  renderPrep();
}

function itemMenu(anchor, i) {
  const items = WF.svc.items;
  showMenu(anchor, [
    { label: "이름 바꾸기", run: async () => { const t = await prompt2("항목 이름", items[i].title); if (t) { renameItem(items[i], t.trim()); markDirty("svc"); afterItemChange(items[i]); } } },
    { label: "예상 시간(분) 바꾸기", run: async () => { const t = await prompt2("예상 시간(분)", items[i].minutes); if (t != null && !isNaN(+t)) { items[i].minutes = +t; markDirty("svc"); renderPrep(); } } },
    { label: "다음에 올리기", disabled: !items[i].slides.length, run: () => cue({ item: i, slide: 0 }) },
    { label: "복제", run: () => { const c = clone(items[i]); c.id = uid("i"); items.splice(i + 1, 0, c); if (WF.live && WF.live.item > i) WF.live.item++; if (WF.cue && WF.cue.item > i) WF.cue.item++; markDirty("svc"); renderPrep(); } },
    { label: "위로", disabled: i === 0, run: () => moveItem(i, i - 1) },
    { label: "아래로", disabled: i === items.length - 1, run: () => moveItem(i, i + 1) },
    "-",
    { label: "이 항목 빼기", danger: true, disabled: WF.live && WF.live.item === i, run: async () => {
      if (!(await Store.confirm(`‘${items[i].title}’ 항목을 뺄까요?`))) return;
      items.splice(i, 1);
      WF.undo = [];
      if (WF.live && WF.live.item > i) WF.live.item--;
      if (WF.cue) { if (WF.cue.item === i) WF.cue = nextPos(WF.live); else if (WF.cue.item > i) WF.cue.item--; }
      WF.sel = { item: Math.max(0, i - 1), slide: 0 };
      markDirty("svc"); renderPrep();
    } },
  ]);
}

/* ── 항목 내용(종류별) ── */
function renderItemEditor() {
  const it = selItem();
  const head = $("#itemHead"), src = $("#itemSource");
  if (!it) { head.innerHTML = "<b>순서를 더하세요</b>"; src.innerHTML = ""; $("#slideGrid").innerHTML = ""; return; }
  const k = KINDS[it.kind];
  head.innerHTML = `<span class="oicon" style="background:${k.color}">${k.icon}</span><b>${esc(it.title)}</b><span class="muted small">${esc(k.name)}</span>
    <div class="grow"></div>${it.carried ? `<span class="carried">지난주 내용이 그대로 있어요</span><button class="btn sm primary" id="keepBtn" title="지난주 내용을 이번 주에도 그대로 씁니다">이번 주도 똑같이 쓰기</button><button class="btn sm" id="newBtn" title="이번 주 내용을 고릅니다">새로 고르기</button>` : ""}${it.edited ? `<span class="muted small">손으로 고친 화면</span><button class="btn sm" id="rebuildBtn">나누기 다시</button>` : ""}${it.slides.some((x) => x.kind === "text") ? `<button class="btn sm" id="stageEditBtn" title="큰 화면 위에서 글을 눌러 고치고 끌어 옮깁니다(미리보기를 두 번 눌러도 됨)">✎ 화면에서 고치기</button>` : ""}`;
  const kb = $("#keepBtn");
  if (kb) kb.onclick = () => { delete it.carried; markDirty("svc"); renderPrep(); };
  const nb = $("#newBtn");
  if (nb) nb.onclick = () => { const f = $("#itemSource input:not([type=checkbox]), #itemSource select, #itemSource textarea"); if (f) { f.scrollIntoView({ block: "center" }); f.focus(); } };
  const se = $("#stageEditBtn");
  if (se) se.onclick = () => { const s = it.slides[WF.sel.slide]; openStageEditor(WF.sel.item, s && s.kind === "text" ? WF.sel.slide : Math.max(0, it.slides.findIndex((x) => x.kind === "text"))); };
  const rb = $("#rebuildBtn");
  if (rb) rb.onclick = async () => { if (await Store.confirm("손으로 고친 화면을 버리고 처음 내용으로 다시 나눌까요?")) { it.edited = false; rebuild(it); markDirty("svc"); afterItemChange(it); } };

  // 모든 순서 같은 틀(2026-10-29 B안): 왼쪽 미리보기, 오른쪽 ① ② ③ 꼭 물어볼 것, ✎ 단추는 가끔 쓰는 것, 아래 한 줄은 공통
  if (EDX.item !== it.id) { EDX.item = it.id; EDX.open = it.kind === "scripture" && it.noText ? "paste" : ""; CDX.open = ""; }
  let q = 0;
  const qt = (t, r) => `<div class="cdqt"><span class="n">${++q}</span>${t}${r ? `<span class="r">${r}</span>` : ""}</div>`;
  const Q = (title, body, r) => `<div class="cdq">${qt(title, r)}${body}</div>`;
  const L = (html) => `<div class="cdline">${html}</div>`;
  const seg = (id, cur, opts) => `<span class="seg2" id="${id}">${opts.map(([v, n]) => `<button data-v="${v}" class="${String(cur) === String(v) ? "on" : ""}">${n}</button>`).join("")}</span>`;
  const pills = (list) => {
    list = list.filter(Boolean); if (!list.length) return "";
    const open = list.find((x) => x.k === EDX.open);
    return `<div class="cdpills">${list.map((x) => `<button class="cdpill ${EDX.open === x.k ? "on" : ""}" data-x="${x.k}">${x.t} <small>${esc(x.s || "")}</small><span class="e">✎</span></button>`).join("")}</div>` + (open ? `<div class="cdpop">${open.body}</div>` : "");
  };
  const vids = (m) => (m.files || []).some((x) => /^(mp4|mov|m4v|webm)$/i.test(x.ext || ""));
  let right = "", side = "";
  if (it.kind === "song") {
    const opts = WF.lib.songs.filter((x) => !x.hidden || x.id === it.song.songId).map((x) => `<option value="${x.id}" ${x.id === it.song.songId ? "selected" : ""}>${esc(x.title)}</option>`).join("");
    const song = WF.lib.songs.find((x) => x.id === it.song.songId);
    right = Q("어떤 곡인가요?", L(`<input id="fHymnNo" inputmode="numeric" placeholder="번호" style="width:72px" title="찬송가 번호를 치고 Enter"><select id="fSong" class="full"><option value="">— 곡 고르기 —</option>${opts}</select><button class="btn sm" id="fSongEdit">${song ? "가사 고치기" : "새 곡 만들기"}</button>`)) +
      (song ? Q("부르는 순서", songChips(song), "눌러서 빼기 · 끌어서 바꾸기") : "") +
      pills([{ k: "keys", t: "예배 중 바로 가기", s: "1 · 2 · R · G", body: `<span class="muted small">예배 중에 <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> 절, <kbd>R</kbd> 후렴, <kbd>G</kbd> 브리지로 바로 갑니다. 부르는 순서를 바꾸면 이 곡을 쓰는 모든 예배에 같이 바뀝니다.</span>` }]);
  } else if (it.kind === "scripture") {
    const s = it.scripture, refs = Bible.parseRef(s.ref || "");
    const bn = (id) => (WF.lib.bibles.find((b) => b.id === (id || WF.lib.settings.defaultBible)) || {}).name || "기본";
    right = Q("어디를 읽나요?", L(`<input id="fRef" value="${esc(s.ref)}" placeholder="예: 요 13:1-5 · 시 23 · ㅇㅎ 3:16" style="width:230px"><span class="small ${it.error ? "warnc" : "okc"}">${it.error ? esc(it.error) : refs.length ? "✓ " + esc(Bible.refsLabel(refs)) + " · " + it.slides.length + "장" : ""}</span>`)) +
      Q("한 화면에 얼마나?", L(seg("fSplitSeg", s.split || "fit", [["fit", "글자 수에 맞춰"], ["1", "한 절씩"], ["2", "두 절씩"]]))) +
      pills([
        { k: "bible", t: "역본", s: bn(s.bibleId) + (s.bibleId2 ? " + " + bn(s.bibleId2) : ""), body: `<div class="cdsl"><label>역본</label>${bibleSelect("fBible", s.bibleId)}</div><div class="cdsl"><label>함께 보일 역본</label><select id="fBible2"><option value="">없음</option>${WF.lib.bibles.filter((b) => !b.hidden).map((b) => `<option value="${b.id}" ${b.id === s.bibleId2 ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select><span class="muted small">아래에 작게</span></div>` },
        { k: "paste", t: "본문 붙여 넣기", s: s.pasted ? "붙여 넣은 본문 씀" : it.noText ? "성경 파일에 없음" : "", body: `<textarea id="fPasted" rows="4" placeholder="성경 파일이 없을 때: 인터넷 성경 등에서 복사한 본문을 붙여 넣으세요. 절 번호(1 유월절… 2 마귀가…)가 있으면 절마다 나눕니다.">${esc(s.pasted || "")}</textarea><span class="muted small">${s.pasted ? "붙여 넣은 본문을 씁니다(역본 대신). 비우면 역본에서 찾습니다." : ""}</span>` },
      ]);
  } else if (it.kind === "sermon") {
    const s = it.sermon;
    right = Q("설교 제목", L(`<input id="fTitle" class="full" value="${esc(s.title)}" placeholder="예: 사자 굴 속의 기도">`)) +
      Q("본문 · 설교자", L(`<input id="fRef" value="${esc(s.ref)}" placeholder="본문 (예: 단 6:10)" style="width:170px"><input id="fPreacher" value="${esc(s.preacher || "")}" placeholder="설교자 (예: 최완수 목사)" style="width:190px">`)) +
      Q("요점", `<textarea id="fPoints" rows="3" class="full" placeholder="한 줄에 하나씩 — 한 줄이 한 화면">${esc((s.points || []).join("\n"))}</textarea>`, "한 줄 = 한 화면") +
      pills([
        { k: "verses", t: "띄울 구절", s: (s.verses || []).join(" · ") || "없음", body: `<textarea id="fVerses" rows="3" placeholder="설교 중에 띄울 구절, 한 줄에 하나씩 (예: 롬 5:8)">${esc((s.verses || []).join("\n"))}</textarea>` },
        { k: "text", t: "본문 화면도", s: s.showText ? "켬" : "끔", body: `<label class="chk"><input type="checkbox" id="fShowText" ${s.showText ? "checked" : ""}> 설교 제목 다음에 본문 말씀 화면도 넣기</label>` },
      ]);
  } else if (it.kind === "prayer") {
    const recent = (WF.lib.settings.recentPrayers || []).filter((n) => n && n !== it.prayer.name).slice(0, 5);
    right = Q("누가 기도하시나요?", L(`<input id="fName" value="${esc(it.prayer.name)}" placeholder="김○○ 장로" style="width:220px">${recent.length ? `<span class="muted small">최근:</span>${recent.map((n) => `<button class="btn xs" data-pname="${esc(n)}">${esc(n)}</button>`).join("")}` : ""}`)) +
      Q("위 글", L(`<input id="fRole" value="${esc(it.prayer.role)}" placeholder="대표기도" style="width:220px">`)) +
      `<div class="muted small">생중계 · 예배당 TV에는 카메라 위에 이름 띠로 나갑니다(설정 → 예배당 TV 카메라).</div>`;
  } else if (it.kind === "fixed") {
    const first = (x) => String(x.text || "").split("\n").map((l) => l.replace(/^\[.*\]$/, "").replace(/^(인도|회중|다같이)\s*[:：]\s*/, "").trim()).find(Boolean) || "";
    right = Q("어떤 문구를 띄울까요?", `<div class="muted small fxhint">보관함에 넣어 둔 문구입니다. 누르면 이 순서에 그 문구가 들어갑니다(초록 = 지금 들어 있는 문구).</div><div class="fxcards">${WF.lib.fixed.filter((x) => !x.hidden || x.id === it.fixed.fixedId).map((x) => `<button class="fxcard ${x.id === it.fixed.fixedId ? "on" : ""}" data-fx="${x.id}"><b>${x.id === it.fixed.fixedId ? "✓ " : ""}${esc(x.name)}</b><em>${esc(first(x))}</em><span>화면 ${fixedSlides(x).length}장</span></button>`).join("")}<button class="fxcard add" id="fFixedNew"><b>＋ 새 문구</b><em>교독문 · 축도 · 표어 등</em><span>보관함에 만들기</span></button></div>`) +
      `<div class="cdpills"><button class="cdpill" id="fFixedEdit">보관함에서 고치기 <span class="e">✎</span></button></div>`;
  } else if (it.kind === "media") {
    const m = it.media;
    const th = (m.files || []).map((x, i) => { const v = /^(mp4|mov|m4v|webm)$/i.test(x.ext || ""); return `<div class="mth" draggable="true" data-mi="${i}" title="${esc(x.name)}">${v ? `<video src="${Store.mediaUrl(x.file)}#t=0.5" muted preload="metadata"></video><i>영상</i>` : `<img src="${Store.mediaUrl(x.file)}">`}<button class="mdel" data-mdel="${i}" title="빼기">×</button><button class="mlive ${mediaLiveOn(it, x.file) ? "on" : ""}" data-mlive="${i}" title="이 그림 · 영상을 생중계(OBS)에도 띄울지 — 누르면 바뀜">${mediaLiveOn(it, x.file) ? "생중계" : "카메라"}</button></div>`; }).join("");
    right = Q("띄울 그림 · 영상", `<div class="mths">${th}<button class="mth add" id="fAddMedia" title="그림 · 영상 더하기">＋</button><button class="mth add lib" id="fLibMedia" title="보관함에서 고르기">보관함</button></div>`, (m.files || []).length > 1 ? "끌어서 순서 바꾸기" : "") +
      Q("어떻게 넘길까요?", L(seg("fAutoSeg", +m.auto || 0, [[0, "직접"], [5, "5초"], [8, "8초"], [10, "10초"], [15, "15초"], [30, "30초"]])) +
        (vids(m) ? L(`<span class="muted small">영상이 끝나면</span>${seg("fVEndSeg", m.loop ? "loop" : m.videoEnd || "", [["", "설정대로"], ["next", "다음"], ["stop", "멈춤"], ["loop", "반복"]])}`) : "") +
        L(`<span class="muted small">생중계(OBS)에는</span>${seg("fLiveSeg", m.live || "", [["", "기본대로(" + (overlayTheme().showMedia !== false ? "생중계에도" : "카메라만") + ")"], ["on", "생중계에도"], ["off", "카메라만"]])}`) +
        L(`<label class="chk" title="예배 시작 전 영상 위에 남은 시간 · 글을 얹습니다"><input type="checkbox" id="fMCd" ${(m.cd || {}).on ? "checked" : ""}> 이 영상 위에 카운트다운</label>`)) +
      ((m.cd || {}).on ? `<div class="cdbox">` + cdTimeRow(m.cd, qt) +
        `<div class="cdq">${qt("무슨 글을 띄울까요?")}<div class="cdline"><input id="cdText" class="full" value="${esc(m.cd.text || "")}" placeholder="위 글 — 예: 주일 2부 예배"></div><div class="cdline"><input id="cdSub" class="full" value="${esc(m.cd.sub || "")}" placeholder="아래 글 — 예: 11시 예배가 곧 시작합니다"></div></div>` +
        cdMore(m.cd, true) + `</div>` : "") +
      pills([
        { k: "cap", t: "영상 위 글", s: m.caption || "없음", body: `<input id="fMCap" class="full" value="${esc(m.caption || "")}" placeholder="그림 · 영상 아래쪽에 얹을 한 줄 (예: 11월 2일 추수감사 주일)">` },
        vids(m) && { k: "mute", t: "소리", s: m.mute ? "끔" : "켬", body: `<label class="chk"><input type="checkbox" id="fMute" ${m.mute ? "checked" : ""}> 영상 소리 끔</label>` },
        { k: "text", t: "글 광고", s: m.text ? "있음" : "없음", body: `<textarea id="fMText" rows="3" placeholder="그림 없이 글로 띄울 광고 (빈 줄 = 화면 나눔)">${esc(m.text || "")}</textarea>` },
      ]);
  } else if (it.kind === "text") {
    right = Q("띄울 글", `<textarea id="fText" rows="5" class="full" placeholder="빈 줄 = 화면 나눔. **강조** 처럼 쓰면 강조색">${esc(it.text.text || "")}</textarea>`, "빈 줄 = 화면 나눔 · **강조**");
  } else if (it.kind === "camera") {
    right = Q("이 순서 동안", `<div class="muted">생중계에는 자막 없이 카메라만, 예배당 TV에는 카메라(없으면 검은 화면)가 나갑니다. 간주 · 쉼 · 영상 기도 때 씁니다.</div><div class="muted small">예배 중에 <kbd>V</kbd> 키로도 언제든 띄울 수 있습니다.</div>`);
  } else if (it.kind === "design") {
    right = Q("파워포인트에서 가져온 화면", `<div class="muted">배경 · 도형 · 그림은 가져온 모양 그대로입니다. 글은 아래 ‘화면 글’ 칸에서 고칩니다.</div><div class="muted small">${it.slides.length}장</div>`);
  } else if (it.kind === "standby") {
    // B안(2026-10-29): 왼쪽 미리보기 + 디자인 그림, 오른쪽에는 꼭 물어볼 것(시간 · 글 · 말씀)만
    const sb = it.standby, d = sb.design || "";
    side = `<div class="cdthumbs" id="fSbDesign">` + [["", "기본"]].concat(Object.keys(Render.CD_DESIGNS).map((k) => [k, CD_SHORT[k] || Render.CD_DESIGNS[k]])).map(([k, n]) =>
      `<button class="cdth ${d === k ? "on" : ""}" data-d="${k}" title="${esc(k ? Render.CD_DESIGNS[k] : "기본(로고 · 글)")}"><span class="p cdt-${k || "base"}">${k ? `<em>${k === "ring" ? "5:00" : "05:00"}</em>` : "<i></i>"}</span>${esc(n)}</button>`).join("") + `</div>`;
    right = (d ? cdTimeRow(sb, qt) : `<div class="cdq">${qt("언제 시작하나요?", "넣으면 남은 시간을 셉니다")}<div class="cdline"><input id="fSbCount" value="${esc(sb.countTo || "")}" placeholder="11:00" style="width:90px"><span class="muted small">비우면 세지 않음 · 교회 로고는 설정에서</span></div></div>`) +
      `<div class="cdq">${qt("무슨 글을 띄울까요?")}<div class="cdline"><input id="fSbText" class="full" value="${esc(sb.text || "")}" placeholder="위 글 — 비우면 ‘${esc(WF.lib.settings.standbyText)}’"></div><div class="cdline"><input id="fSbSub" class="full" value="${esc(sb.sub || "")}" placeholder="아래 글 — 예: 11시 예배가 곧 시작합니다"></div></div>` +
      (CD_VERSE_DESIGNS.includes(d) ? `<div class="cdq">${qt("말씀", d === "verse" ? "말씀 카드" : "숫자와 함께")}<div class="cdline"><input id="fSbVerse" value="${esc(sb.verseRef || "")}" placeholder="예: 시 105:1" style="width:140px"><span class="muted small">${sb.verseRef ? (it.slides[0] && it.slides[0].verse && it.slides[0].verse.text ? "✓ 찾음" : "본문을 찾지 못했습니다") : ""}</span></div></div>` : "") +
      (d === "video" ? `<div class="cdq">${qt("배경 영상")}<div class="cdline"><select id="fSbBg"><option value="">— 고르기 —</option>${WF.lib.media.filter((m) => !m.hidden && /^(mp4|mov|m4v|webm)$/i.test(m.ext)).map((m) => `<option value="${m.file}" ${m.file === sb.bgFile ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select></div></div>` : "") +
      (d === "mphoto" ? `<div class="cdq">${qt("어떤 사진을 쓸까요?", "보관함 ‘그림’")}<div class="cdline"><select id="fSbPhoto"><option value="">— 고르기 —</option>${WF.lib.media.filter((m) => !m.hidden && /^(jpe?g|png|webp|heic|gif)$/i.test(m.ext)).map((m) => `<option value="${m.file}" ${m.file === sb.photoFile ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select><span class="muted small">천천히 확대되며 움직입니다</span></div></div>` : "") +
      (d === "morder" ? `<div class="muted small">오른쪽에 오늘 찬양 · 성경 · 설교 · 기도가 예배 순서에서 저절로 나옵니다(따로 쓸 것 없음).</div>` : "") +
      (d === "mads" ? `<div class="muted small">‘광고 그림’ 미디어 묶음의 그림이 8초마다 바뀌며 나옵니다(지금 ${WF.lib.media.filter((m) => !m.hidden && m.folder === "mf-ad").length}장).</div>` : "") +
      (d === "mseason" ? `<div class="muted small">예배 날짜에 따라 봄 꽃잎 · 여름 잎 · 가을 단풍 · 겨울 눈으로 저절로 바뀝니다.</div>` : "") +
      (SB_LOOP[d] ? (() => { const date = WF.svc && WF.svc.date, lp = standbyLoop(d, date ? +date.slice(5, 7) : 0, cdPal(sb.pal, date)); return lp.file ? `<div class="muted small sbloop on">✓ 4K 영상으로 나갑니다 — ‘${esc(lp.want)}’ 영상 위에 글 · 숫자만 얹습니다</div>` : lp.found ? `<div class="muted small sbloop">‘${esc(lp.want)}’ 4K 영상이 있지만 색을 골라서 그려서 보여 줍니다(색을 ‘기본’으로 하면 영상)</div>` : `<div class="muted small sbloop">보관함 ‘대기 화면 영상’ 묶음에 <b>${esc(lp.want)}.mp4</b>(4K)를 넣으면 더 선명한 영상으로 나갑니다</div>`; })() : "") +
      (CD_PAL_DESIGNS.includes(d) ? cdPalRow(sb) : "") +
      (d ? cdMore(sb) : "");
  }
  let h = `<div class="sbx"><div class="sbx-l"><div class="pv sbpv" id="sbPv"></div><div class="pvcap" id="sbPvCap"></div>${side}</div><div class="sbx-r">${right}</div></div>`;
  // 아래 한 줄: 모든 순서 공통(순서 자막바 · 운영 메모)
  let foot = "";
  // 순서 자막바 고르기는 아래 ‘이 순서 꾸미기 → 순서 자막바’ 탭 한 곳에서(겹치지 않게)
  foot += `<button class="btn sm" id="fBarGo" title="아래 ‘순서 자막바’ 탭 열기">순서 자막바 · ${esc(it.barLabel === "none" ? "띄우지 않음" : it.barText || orderHead(it) || "없음")} ✎</button>`;
  foot += `<label>운영 메모</label><input id="fNote" class="memo" value="${esc(it.note || "")}" placeholder="예배 중 조작 화면과 강단에만 보임 (예: 끝나면 바로 찬양 · 2절 반복)">`;
  h += `<div class="edfoot">${foot}</div>`;
  src.innerHTML = h;
  wireSource(it);
  const fb = $("#fBarGo");
  if (fb) fb.onclick = () => setDock("bar");
  const fn = $("#fNote");
  if (fn) fn.onchange = () => { it.note = fn.value.trim(); markDirty("svc"); if (WF.live && itemAt(WF.live) === it) sendLive(); };
  $$(".cdpill[data-x]", src).forEach((b) => (b.onclick = () => { EDX.open = EDX.open === b.dataset.x ? "" : b.dataset.x; renderItemEditor(); }));
  renderSlideGrid();
  drawEdPreview();
}
// 편집 칸 왼쪽 미리보기: 고른 화면(없으면 첫 화면)
function drawEdPreview() {
  const h = document.getElementById("sbPv"), it = selItem(); if (!h || !it) return;
  const i = Math.min(WF.sel.slide || 0, Math.max(0, it.slides.length - 1)), s = it.slides[i];
  drawInto(h, it, s, camFlags());
  const cap = document.getElementById("sbPvCap");
  if (cap) cap.innerHTML = it.slides.length ? `<span>${esc(slideLabel(s) || "화면")} · ${i + 1} / ${it.slides.length}장</span>` : `<span class="warnc">${esc(it.error || "화면이 없습니다")}</span>`;
}
// 찬양 부르는 순서: 색 꼬리표(눌러서 빼기 · 끌어서 바꾸기 · ＋로 더하기). song.order 를 고친다(이 곡을 쓰는 모든 예배에 같이)
function songTokens(song) {
  const names = Render.splitLyrics(song.text).map((x) => x.name).filter(Boolean);
  const order = String(song.order || "").trim().split(/\s+/).filter(Boolean);
  return { names: [...new Set(names)], order: order.length && order.every((n) => names.includes(n)) ? order : names, custom: !!order.length };
}
function songChips(song) {
  const t = songTokens(song);
  if (!t.names.length) return `<div class="muted small">가사에 [1절] [후렴] 같은 부분 이름이 없어 적힌 순서대로 나갑니다 — ‘가사 고치기’에서 붙일 수 있습니다.</div>`;
  const col = (n) => (partTag({ section: n }) || {}).color || "#5d6676";
  return `<div class="sgchips" id="fSongChips">${t.order.map((n, i) => `<button class="sgchip" draggable="true" data-si="${i}" style="background:${col(n)}" title="누르면 빼기 · 끌어서 옮기기">${esc(n)}</button>`).join("")}` +
    t.names.map((n) => `<button class="sgadd" data-sadd="${esc(n)}">＋ ${esc(n)}</button>`).join("") + (t.custom ? `<button class="sgadd" data-sreset>처음대로</button>` : "") + `</div>`;
}

function bibleSelect(id, cur) {
  return `<select id="${id}"><option value="">기본(${esc((WF.lib.bibles.find((b) => b.id === WF.lib.settings.defaultBible) || {}).name || "")})</option>` +
    WF.lib.bibles.map((b) => `<option value="${b.id}" ${b.id === cur ? "selected" : ""}>${esc(b.name)}</option>`).join("") + "</select>";
}

async function confirmDropEdits(it) {
  if (!it.edited) return true;
  if (!(it.slides || []).some((s) => s.kind !== "titlecard")) return true; // 제목 화면만 있을 때(곡을 아직 안 고름)는 잃을 글이 없으니 묻지 않음
  return Store.confirm("이 항목은 화면 글을 손으로 고쳤습니다. 내용을 바꾸면 고친 화면이 처음 내용으로 다시 만들어집니다. 계속할까요?");
}
async function sourceChanged(it, fn) {
  if (!(await confirmDropEdits(it))) { renderItemEditor(); return; }
  fn();
  delete it.carried;
  it.edited = false;
  if (it.kind === "scripture" || it.kind === "sermon") { const x = it.scripture || it.sermon; await loadBible(x.bibleId); if (x.bibleId2) await loadBible(x.bibleId2); }
  rebuild(it);
  markDirty("svc");
  afterItemChange(it);
}
function afterItemChange(it) {
  const i = WF.svc.items.indexOf(it);
  if (WF.sel.slide >= it.slides.length) WF.sel.slide = Math.max(0, it.slides.length - 1);
  // 지금 나가는 항목이면 화면 번호를 맞추고 다시 보낸다
  if (WF.live && WF.live.item === i) {
    if (WF.live.slide >= it.slides.length) WF.live.slide = Math.max(0, it.slides.length - 1);
    if (it.slides.length) sendLive();
  }
  if (WF.cue && WF.cue.item === i && WF.cue.slide >= it.slides.length) WF.cue = nextPos(WF.live);
  renderPrep();
}

function wireSource(it) {
  const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };
  const val = (id) => (document.getElementById(id) || {}).value;
  if (it.kind === "song") {
    on("fSong", "change", () => sourceChanged(it, () => {
      it.song.songId = val("fSong");
      const s = WF.lib.songs.find((x) => x.id === it.song.songId);
      if (s) songTitleFollow(it);
    }));
    on("fHymnNo", "keydown", (e) => {
      if (e.key !== "Enter") return;
      const n = parseInt(e.target.value, 10);
      const s = WF.lib.songs.find((x) => !x.hidden && (x.number === n || new RegExp("^" + n + "(\\D|$)").test(x.title)));
      if (!s) return Store.message(`찬송가 ${n}장이 보관함에 없습니다. 보관함 → 찬양 · 곡에서 넣어 주세요.`);
      sourceChanged(it, () => { it.song.songId = s.id; songTitleFollow(it); });
    });
    on("fSongEdit", "click", () => {
      let s = WF.lib.songs.find((x) => x.id === it.song.songId);
      if (!s) { s = { id: uid("song"), title: "새 곡", author: "", source: "", license: "", order: "", text: "[1절]\n\n[후렴]\n" }; WF.lib.songs.push(s); it.song.songId = s.id; markDirty(); }
      WF.libTab = "songs"; WF.libSel = s.id; WF.libReturn = true; setMode("library");
    });
    const song = WF.lib.songs.find((x) => x.id === it.song.songId);
    const setOrder = (list) => sourceChanged(it, () => { song.order = list ? list.join(" ") : ""; markDirty("lib"); rebuildSongEverywhere(song.id, it); });
    if (song) {
      const cur = () => songTokens(song).order.slice();
      $$("#fSongChips [data-si]").forEach((b) => {
        b.onclick = () => { const o = cur(); o.splice(+b.dataset.si, 1); setOrder(o.length ? o : null); };
        b.ondragstart = (e) => { e.dataTransfer.setData("text/plain", b.dataset.si); };
        b.ondragover = (e) => e.preventDefault();
        b.ondrop = (e) => { e.preventDefault(); const from = +e.dataTransfer.getData("text/plain"), to = +b.dataset.si; if (from === to || isNaN(from)) return; const o = cur(); const [x] = o.splice(from, 1); o.splice(to, 0, x); setOrder(o); };
      });
      $$("#fSongChips [data-sadd]").forEach((b) => (b.onclick = () => { const o = cur(); o.push(b.dataset.sadd); setOrder(o); }));
      const rs = $("#fSongChips [data-sreset]"); if (rs) rs.onclick = () => setOrder(null);
    }
  }
  if (it.kind === "scripture") {
    on("fRef", "change", () => sourceChanged(it, () => { it.scripture.ref = val("fRef").trim(); if (/^성경봉독/.test(it.title) || !it.title) { const r = Bible.parseRef(it.scripture.ref); it.title = r.length ? "성경봉독 · " + Bible.refsLabel(r, true) : "성경봉독"; } }));
    on("fRef", "keydown", (e) => { if (e.key === "Enter") e.target.blur(); });
    on("fBible", "change", () => sourceChanged(it, () => (it.scripture.bibleId = val("fBible"))));
    $$("#fSplitSeg [data-v]").forEach((b) => (b.onclick = () => sourceChanged(it, () => (it.scripture.split = b.dataset.v))));
    on("fBible2", "change", () => sourceChanged(it, () => (it.scripture.bibleId2 = val("fBible2"))));
    on("fPasted", "change", () => sourceChanged(it, () => (it.scripture.pasted = val("fPasted"))));
    on("fShowPaste", "click", () => { it.scripture.showPaste = true; renderItemEditor(); const ta = $("#fPasted"); if (ta) ta.focus(); });
  }
  if (it.kind === "sermon") {
    const s = it.sermon;
    on("fTitle", "change", () => sourceChanged(it, () => { s.title = val("fTitle").trim(); if (/^설교/.test(it.title)) it.title = s.title ? "설교 · " + s.title : "설교"; }));
    on("fRef", "change", () => sourceChanged(it, () => (s.ref = val("fRef").trim())));
    on("fPreacher", "change", () => sourceChanged(it, () => (s.preacher = val("fPreacher").trim())));
    on("fShowText", "change", () => sourceChanged(it, () => (s.showText = document.getElementById("fShowText").checked)));
    on("fPoints", "change", () => sourceChanged(it, () => (s.points = val("fPoints").split("\n").map((x) => x.trim()).filter(Boolean))));
    on("fVerses", "change", () => sourceChanged(it, () => (s.verses = val("fVerses").split("\n").map((x) => x.trim()).filter(Boolean))));
  }
  if (it.kind === "prayer") {
    on("fName", "input", () => { it.prayer.name = val("fName"); delete it.carried; rebuild(it); markDirty("svc"); afterItemChange(it); setTimeout(() => { const el = $("#fName"); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 0); });
    on("fRole", "change", () => { it.prayer.role = val("fRole"); rebuild(it); markDirty("svc"); afterItemChange(it); });
    // 최근에 기도하신 분: 이름을 다 쓰고 나면 기억해 두고, 누르면 넣기
    const remember = (n) => { n = (n || "").trim(); if (!n) return; const st = WF.lib.settings; st.recentPrayers = [n].concat((st.recentPrayers || []).filter((x) => x !== n)).slice(0, 8); markDirty("lib"); };
    on("fName", "change", () => remember(val("fName")));
    $$("[data-pname]").forEach((b) => (b.onclick = () => { it.prayer.name = b.dataset.pname; delete it.carried; remember(it.prayer.name); rebuild(it); markDirty("svc"); afterItemChange(it); renderItemEditor(); }));
  }
  if (it.kind === "fixed") {
    $$("[data-fx]").forEach((b) => (b.onclick = () => sourceChanged(it, () => { it.fixed.fixedId = b.dataset.fx; const fx = WF.lib.fixed.find((x) => x.id === it.fixed.fixedId); if (fx && /^(신앙고백|고정 문구)/.test(it.title)) it.title = "신앙고백 · " + fx.name; })));
    on("fFixedNew", "click", () => { WF.libTab = "fixed"; WF.libSel = ""; WF.libReturn = true; setMode("library"); });
    on("fFixedEdit", "click", () => { WF.libTab = "fixed"; WF.libSel = it.fixed.fixedId; WF.libReturn = true; setMode("library"); });
  }
  if (it.kind === "media") {
    const m = it.media;
    on("fAddMedia", "click", async () => {
      const paths = await Store.pickFiles({ title: "그림 · 영상 고르기", filters: [{ name: "그림 · 영상", extensions: MEDIA_EXT }] });
      if (!paths.length) return;
      for (const p of paths) {
        try { const r = await Store.importMedia(p); addMediaToLib(r); m.files.push({ file: r.file, name: r.name, ext: r.ext }); delete it.carried; }
        catch (e) { Store.message("가져오지 못한 파일: " + p + "\n" + e); }
      }
      rebuild(it); markDirty(); afterItemChange(it);
    });
    on("fLibMedia", "click", () => pickFromLibrary((f) => { m.files.push({ file: f.file, name: f.name, ext: f.ext }); delete it.carried; rebuild(it); markDirty("svc"); afterItemChange(it); }));
    $$("#fAutoSeg [data-v]").forEach((b) => (b.onclick = () => { m.auto = +b.dataset.v; markDirty("svc"); renderItemEditor(); }));
    $$("#fVEndSeg [data-v]").forEach((b) => (b.onclick = () => {
      const v = b.dataset.v; m.loop = v === "loop"; m.videoEnd = m.loop ? "" : v; markDirty("svc");
      if (WF.live && itemAt(WF.live) === it) sendLive(); // 지금 나가는 중이면 예배당 화면에도 바로
      renderPrepLivePreview(); renderItemEditor();
    }));
    // 그림 · 영상 작은 그림: 끌어서 순서 바꾸기 · × 로 빼기
    const files = () => (m.files = m.files || []);
    const redoFiles = () => { delete it.carried; rebuild(it); markDirty("svc"); afterItemChange(it); };
    $$(".mth[data-mi]").forEach((el) => {
      el.ondragstart = (e) => e.dataTransfer.setData("text/plain", el.dataset.mi);
      el.ondragover = (e) => e.preventDefault();
      el.ondrop = (e) => { e.preventDefault(); const from = +e.dataTransfer.getData("text/plain"), to = +el.dataset.mi; if (isNaN(from) || from === to) return; const [x] = files().splice(from, 1); files().splice(to, 0, x); redoFiles(); };
    });
    $$("[data-mdel]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); files().splice(+b.dataset.mdel, 1); redoFiles(); }));
    // 생중계에 띄울지: 순서 전체 · 그림 한 장마다(그림마다 고른 것이 먼저). 바꾸면 화면 번호는 그대로, 나가는 중이면 바로 반영
    const liveChanged = () => { markDirty("svc"); renderItemEditor(); drawOvPreview(); if (WF.live && itemAt(WF.live) === it) sendLive(); };
    $$("#fLiveSeg [data-v]").forEach((b) => (b.onclick = () => { if (b.dataset.v) m.live = b.dataset.v; else delete m.live; files().forEach((x) => delete x.live); liveChanged(); }));
    $$("[data-mlive]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); toggleMediaLive(it, files()[+b.dataset.mlive].file); liveChanged(); }));
    on("fMute", "change", () => { m.mute = document.getElementById("fMute").checked; markDirty("svc"); });
    on("fMCap", "change", () => sourceChanged(it, () => (m.caption = val("fMCap"))));
    on("fMCd", "change", () => {
      m.cd = Object.assign({ cdMode: "dur", cdMins: 5, countTo: "11:00", text: "예배가 곧 시작됩니다", sub: "", big10: true, atZero: "next" }, m.cd || {}, { on: document.getElementById("fMCd").checked });
      if (m.cd.on) { m.loop = true; m.videoEnd = ""; } // 카운트다운 동안 영상은 반복
      markDirty("svc"); afterItemChange(it); renderItemEditor(); if (WF.live && itemAt(WF.live) === it) sendLive();
    });
    if ((m.cd || {}).on) {
      const redo = (redraw) => { markDirty("svc"); afterItemChange(it); if (redraw) renderItemEditor(); if (WF.live && itemAt(WF.live) === it) sendLive(); };
      wireCdControls(m.cd, redo);
    }
    on("fMText", "change", () => sourceChanged(it, () => (m.text = val("fMText"))));
  }
  if (it.kind === "text") on("fText", "change", () => sourceChanged(it, () => (it.text.text = val("fText"))));
  if (it.kind === "standby") {
    const pv = () => drawEdPreview();
    const sbSet = (fn) => { fn(it.standby); rebuild(it); markDirty("svc"); afterItemChange(it); pv(); };
    pv();
    on("fSbText", "change", () => sbSet((x) => (x.text = val("fSbText"))));
    on("fSbSub", "change", () => sbSet((x) => (x.sub = val("fSbSub"))));
    $$("#fSbDesign [data-d]").forEach((b) => (b.onclick = () => { sbSet((x) => { x.design = b.dataset.d; if (x.design && !x.countTo) x.countTo = "11:00"; }); renderItemEditor(); }));
    on("fSbVerse", "change", () => { sbSet((x) => (x.verseRef = val("fSbVerse").trim())); renderItemEditor(); });
    on("fSbBg", "change", () => sbSet((x) => (x.bgFile = val("fSbBg"))));
    on("fSbPhoto", "change", () => sbSet((x) => (x.photoFile = val("fSbPhoto"))));
    $$("[data-pal]").forEach((b) => (b.onclick = () => { sbSet((x) => (x.pal = b.dataset.pal)); renderItemEditor(); if (WF.live && itemAt(WF.live) === it) sendLive(); }));
    on("fSbPalC", "change", () => { sbSet((x) => (x.pal = val("fSbPalC"))); renderItemEditor(); if (WF.live && itemAt(WF.live) === it) sendLive(); });
    if (it.standby.design) wireCdControls(it.standby, (redraw) => { rebuild(it); markDirty("svc"); afterItemChange(it); if (redraw) renderItemEditor(); else pv(); if (WF.live && itemAt(WF.live) === it) sendLive(); });
    on("fSbCount", "change", () => {
      const v = val("fSbCount").trim().replace(/^(\d{1,2})시\s*(\d{0,2})분?$/, (m, h, mm) => h + ":" + (mm || "00").padStart(2, "0"));
      if (v && !/^\d{1,2}:\d{2}$/.test(v)) return Store.message("시각은 11:00 처럼 적어 주세요.");
      sbSet((x) => (x.countTo = v));
    });
  }
}

// 카운트다운 칸(대기 항목 · 영상 위 카운트다운 같이 씀) — B안: 꼭 물어볼 것(시간 · 글)만 보이고,
// 글꼴 · 크기 · 끝날 때 · 자리는 작은 단추를 누르면 그 자리에 열린다(CDX.open)
const CD_SHORT = { gold: "금빛", glow: "빛 입자", ring: "원형", season: "색 띠", video: "영상", verse: "말씀", mcross: "십자가 빛", mglass: "유리 십자가", march: "아치 창", msun: "해돋이", mseason: "계절", maurora: "오로라", mwater: "수채화", mbig: "큰 숫자", mwave: "물결", mclock: "시계", morder: "오늘 순서", mads: "광고 함께", mphoto: "교회 사진" };
const CD_PAL_DESIGNS = ["gold", "glow", "season", "mcross", "verse", "ring", "mwater", "mbig", "mwave", "mclock", "morder", "mads"], CD_VERSE_DESIGNS = ["verse", "msun", "mwater", "mwave"];
const CDX = { open: "" };
const EDX = { open: "", item: "" }; // 순서 편집 칸에서 열린 ✎ 단추
// 색 고르기 줄: 자동(교회력) · 10가지 · 직접 고르기
function cdPalRow(c) {
  const cur = c.pal || "", sw = (k, p, label) => `<button class="pal ${cur === k ? "on" : ""}" data-pal="${k}" title="${esc(label)}"><span style="background:${p ? `linear-gradient(135deg,${p.bg},${p.bg2})` : "conic-gradient(#6b3fa0 0 25%,#c9a24a 0 50%,#2a6b47 0 75%,#b3261e 0)"}"><b style="background:${p ? p.fg : "#fff"}"></b><i style="background:${p ? p.accent : "#fff"}"></i></span>${esc(label)}</button>`;
  const custom = /^#/.test(cur) ? cur : "#2a3a50";
  return `<div class="cdq"><div class="cdqt"><span class="n">•</span>어떤 색으로 할까요?<span class="r">‘자동’은 예배 날짜의 교회력 색</span></div><div class="pals">` +
    `<button class="pal ${!cur ? "on" : ""}" data-pal=""><span style="background:#2b2f36"><b style="background:#8b93a4"></b></span>디자인 그대로</button>` + sw("auto", null, "자동(교회력)") +
    Object.entries(CD_PALS).map(([k, p]) => sw(k, p, p.name)).join("") +
    `<label class="pal ${/^#/.test(cur) ? "on" : ""}" title="직접 고르기"><span style="background:${custom}"><input type="color" id="fSbPalC" value="${custom}"></span>직접</label></div></div>`;
}
function cdTimeRow(c, qt) {
  const dur = c.cdMode === "dur", mins = +c.cdMins || 5, mm = Math.floor(mins), ss = Math.round((mins - mm) * 60);
  return `<div class="cdq">${qt("언제까지 셀까요?")}<div class="cdline"><span class="seg2" id="cdModeSeg"><button data-m="clock" class="${dur ? "" : "on"}">시각까지</button><button data-m="dur" class="${dur ? "on" : ""}">길이만큼</button></span>` +
    (dur ? `<input id="cdMinM" type="number" min="0" max="120" value="${mm}" class="num"><span>분</span><input id="cdMinS" type="number" min="0" max="59" step="5" value="${ss}" class="num"><span>초</span><span class="muted small">나가는 순간부터</span>`
         : `<input id="cdTo" value="${esc(c.countTo || "")}" placeholder="11:00" style="width:90px"><span class="muted small">까지</span>`) + `</div></div>`;
}
function cdMore(c, media) {
  const sz = [c.textSize, c.subSize, c.numSize].map((v) => +v || 100);
  const look = (c.font ? (Render.FONTS[c.font] || {}).name || "글꼴" : "디자인 그대로") + " · " + (sz.every((v) => v === 100) ? "100%" : sz.join("/") + "%");
  const end = (c.atZero === "stay" ? "멈춤" : "다음 순서") + (c.music ? " · 음악 함께" : "");
  const place = ({ center: "가운데", top: "위쪽", bottom: "아래쪽" }[c.pos || "center"]) ;
  const pill = (k, t, sub) => `<button class="cdpill ${CDX.open === k ? "on" : ""}" data-p="${k}">${t} <small>${esc(sub)}</small><span class="e">✎</span></button>`;
  const pct = (id, v, label) => `<div class="cdsl"><label>${label}</label><input type="range" id="${id}" min="50" max="200" step="10" value="${+v || 100}"><b class="tv" id="${id}V">${+v || 100}%</b></div>`;
  let pop = "";
  if (CDX.open === "look") pop = `<div class="cdsl"><label>글꼴</label><select id="cdFont"><option value="">디자인 그대로</option>${Object.entries(Render.FONTS).map(([k, x]) => `<option value="${k}" ${c.font === k ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div>` +
    pct("cdTS", c.textSize, "위 글") + pct("cdSS", c.subSize, "아래 글") + pct("cdNS", c.numSize, "숫자");
  if (CDX.open === "end") pop = `<div class="cdsl"><label>0이 되면</label><select id="cdEnd"><option value="next" ${c.atZero !== "stay" ? "selected" : ""}>다음 순서로</option><option value="stay" ${c.atZero === "stay" ? "selected" : ""}>‘곧 시작합니다’로 멈춤</option></select></div>` +
    `<div class="cdsl"><label></label><label class="chk"><input type="checkbox" id="cdBig" ${c.big10 !== false ? "checked" : ""}> 마지막 10초 크게</label><label class="chk"><input type="checkbox" id="cdMusic" ${c.music ? "checked" : ""}> 예배 전 음악 함께</label></div>`;
  if (CDX.open === "place" && media) pop = `<div class="cdsl"><label>자리</label><select id="cdPos"><option value="center" ${(c.pos || "center") === "center" ? "selected" : ""}>가운데</option><option value="top" ${c.pos === "top" ? "selected" : ""}>위쪽</option><option value="bottom" ${c.pos === "bottom" ? "selected" : ""}>아래쪽</option></select></div>` +
    ""; // 0.3.33 목사님: 영상 어둡게는 뺌
  return `<div class="cdpills">${pill("look", "글꼴 · 크기", look)}${pill("end", "끝날 때", end)}${media ? pill("place", "자리", place) : ""}</div>` + (pop ? `<div class="cdpop">${pop}</div>` : "");
}
function wireCdControls(c, done) {
  const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };
  const v = (id) => document.getElementById(id).value;
  const set = (fn, redraw) => { fn(); done(redraw); };
  on("cdText", "change", () => set(() => (c.text = v("cdText"))));
  on("cdSub", "change", () => set(() => (c.sub = v("cdSub"))));
  document.querySelectorAll("#cdModeSeg [data-m]").forEach((b) => (b.onclick = () => { if (c.cdMode !== b.dataset.m && !(b.dataset.m === "clock" && c.cdMode !== "dur")) set(() => (c.cdMode = b.dataset.m), true); }));
  on("cdTo", "change", () => {
    const t = v("cdTo").trim().replace(/^(\d{1,2})시\s*(\d{0,2})분?$/, (m, h, mm) => h + ":" + (mm || "00").padStart(2, "0"));
    if (t && !/^\d{1,2}:\d{2}$/.test(t)) return Store.message("시각은 11:00 처럼 적어 주세요.");
    set(() => (c.countTo = t));
  });
  const mins = () => set(() => (c.cdMins = Math.max(10 / 60, (+v("cdMinM") || 0) + Math.min(59, +v("cdMinS") || 0) / 60)));
  on("cdMinM", "change", mins); on("cdMinS", "change", mins);
  document.querySelectorAll(".cdpill[data-p]").forEach((b) => (b.onclick = () => { CDX.open = CDX.open === b.dataset.p ? "" : b.dataset.p; renderItemEditor(); }));
  on("cdFont", "change", () => set(() => (c.font = v("cdFont")), true));
  for (const [id, k] of [["cdTS", "textSize"], ["cdSS", "subSize"], ["cdNS", "numSize"], ["cdDim", "dim"]]) {
    on(id, "input", () => (document.getElementById(id + "V").textContent = v(id) + "%"));
    on(id, "change", () => set(() => (c[k] = +v(id)), true));
  }
  on("cdPos", "change", () => set(() => (c.pos = v("cdPos")), true));
  on("cdEnd", "change", () => set(() => (c.atZero = v("cdEnd")), true));
  on("cdBig", "change", () => set(() => (c.big10 = document.getElementById("cdBig").checked), true));
  on("cdMusic", "change", () => set(() => (c.music = document.getElementById("cdMusic").checked), true));
}
function addMediaToLib(r) {
  if (!WF.lib.media.find((x) => x.file === r.file)) WF.lib.media.push({ id: uid("m"), file: r.file, name: r.name, ext: r.ext, added: Date.now() });
}
function pickFromLibraryList(onlyImages) { return WF.lib.media.filter((m) => !m.hidden && !AUDIO_RE.test(m.ext) && (!onlyImages || !/^(mp4|mov|m4v|webm)$/i.test(m.ext))); }
function pickFromLibrary(cb, onlyImages) {
  const list = pickFromLibraryList(onlyImages);
  if (!list.length) return Store.message("보관함에 그림 · 영상이 없습니다. ‘＋ 그림 · 영상 더하기’로 먼저 넣으세요.");
  modal(`<h3>보관함에서 고르기</h3><div class="mgrid">${list.map((m, i) => `<button class="mcell" data-i="${i}">${/^(mp4|mov|m4v|webm)$/i.test(m.ext) ? `<video src="${Store.mediaUrl(m.file)}#t=0.5" muted></video>` : `<img src="${Store.mediaUrl(m.file)}">`}<span>${esc(m.name)}</span></button>`).join("")}</div><div class="mfoot"><button class="btn" data-close>닫기</button></div>`, (box, close) => {
    $$(".mcell", box).forEach((b) => (b.onclick = () => { close(); cb(list[+b.dataset.i]); }));
  });
}
// 곡 가사를 고치면 그 곡을 쓰는 이 예배의 항목을 다시 만든다
function rebuildSongEverywhere(songId, except) {
  for (const it of WF.svc.items) if (it !== except && it.kind === "song" && it.song.songId === songId) rebuild(it, true);
}

/* ── 화면 모음 ── */
function slideCaption(it, s, i) {
  const bits = [`${i + 1}`];
  if (s.section) bits.push(s.section);
  else if (s.group && s.group !== "본문") bits.push(s.group);
  else if (s.verses) bits.push(s.verses[0] + (s.verses.length > 1 ? "-" + s.verses[s.verses.length - 1].split(":")[1] : ""));
  else if (s.kind === "media") bits.push(s.mediaName || "");
  if (s.who) bits.push(s.who);
  return bits.join(" · ");
}
function renderSlideGrid() {
  const it = selItem();
  const g = $("#slideGrid");
  if (!it) { g.innerHTML = ""; return; }
  g.innerHTML = it.slides.map((s, i) => `<div class="scell ${i === WF.sel.slide ? "sel" : ""} ${WF.live && WF.live.item === WF.sel.item && WF.live.slide === i ? "islive" : ""}" data-i="${i}">
      <div class="thumb">${partBadge(s)}</div><div class="scap${partTag(s) ? " part" : ""}"${partStyle(s)}><span>${esc(slideCaption(it, s, i))}</span><span class="lines"></span></div></div>`).join("") +
    `<button class="scell add" id="addSlide">＋ 화면 더하기</button><button class="scell add" id="addCamSlide" title="고른 화면 바로 뒤에 — 간주 · 쉼처럼 자막 없이 카메라만">＋ 투명 화면</button>`;
  $$(".scell[data-i]", g).forEach((el) => {
    const i = +el.dataset.i;
    const r = drawInto($(".thumb", el), it, it.slides[i]);
    const ln = $(".lines", el);
    if (r && r.lines) ln.textContent = r.lines + "줄";
    if (r && r.overflow) { el.classList.add("over"); ln.textContent = "넘침 · 나누기 권함"; }
    if (r && r.missing) { el.classList.add("over"); ln.textContent = "파일 없음"; }
    el.onclick = () => { WF.sel.slide = i; WF.slideFocus = true; renderSlideGrid(); fillEditor(); renderSelPreview(); };
    el.ondblclick = () => cue({ item: WF.sel.item, slide: i });
    // 오른쪽 클릭: 다음에 올리기 · 앞으로 · 뒤로 · 화면 빼기
    el.oncontextmenu = (e) => {
      e.preventDefault();
      WF.sel.slide = i; WF.slideFocus = true; renderSlideGrid(); fillEditor(); renderSelPreview();
      const at = { getBoundingClientRect: () => ({ left: e.clientX, top: e.clientY, bottom: e.clientY }) };
      showMenu(at, [
        { label: "다음에 올리기", run: () => cue({ item: WF.sel.item, slide: i }) },
        { label: "화면에서 직접 고치기", disabled: it.slides[i].kind !== "text", run: () => openStageEditor(WF.sel.item, i) },
        "-",
        { label: "← 앞으로 옮기기", disabled: i === 0, run: () => moveSlide(i, -1) },
        { label: "뒤로 옮기기 →", disabled: i >= it.slides.length - 1, run: () => moveSlide(i, 1) },
        "-",
        { label: "화면 빼기  (Delete)", danger: true, run: () => deleteSlide(i) },
      ]);
    };
  });
  $("#addSlide").onclick = () => {
    it.slides.splice(WF.sel.slide + 1, 0, { kind: "text", text: "" });
    it.edited = true; WF.sel.slide = Math.min(WF.sel.slide + 1, it.slides.length - 1);
    markDirty("svc"); renderItemEditor(); $("#slideText").focus();
  };
  $("#addCamSlide").onclick = () => {
    it.slides.splice(WF.sel.slide + 1, 0, { kind: "cam", group: "투명" });
    it.edited = true; WF.sel.slide = Math.min(WF.sel.slide + 1, it.slides.length - 1);
    markDirty("svc"); renderItemEditor();
  };
  fillEditor();
  renderSelPreview();
  renderThemeForm();
}

/* ── 화면 글 고치기 ── */
function editableField(s) {
  if (!s) return null;
  if (s.kind === "design") return "design";
  if (s.kind === "title") return "title";
  if (s.kind === "prayer") return "name";
  if (s.kind === "text" || s.kind === "media") return "text";
  if (s.kind === "standby") return "text";
  return null;
}
function fillEditor() {
  const it = selItem(); const s = it && it.slides[WF.sel.slide];
  const ta = $("#slideText");
  const fld = editableField(s);
  ta.value = fld === "design" ? designTexts(s).join("\n────\n") : fld ? s[fld] || "" : "";
  ta.disabled = !fld;
  ta.placeholder = s && s.kind === "titlecard" ? "제목 화면 글은 아래 ‘제목 화면’ 탭에서 고칩니다" : "화면을 고르면 글이 여기 나옵니다";
  ta.dataset.orig = ta.value;
  $("#editState").innerHTML = s && s.kind === "titlecard" ? `<button class="btn sm" id="goTcTab">제목 화면 탭으로</button>` : "";
  const g = $("#goTcTab"); if (g) g.onclick = () => setDock("tc");
  $("#applyBtn").disabled = true;
  ["splitBtn", "joinBtn", "accBtn"].forEach((id) => ($("#" + id).disabled = !s || s.kind !== "text"));
  $("#delSlideBtn").disabled = !s;
}
function wireEditor() {
  const ta = $("#slideText");
  // 쓰는 대로 바로 반영(잠깐 멈추면 · 칸을 나가면) — ‘적용’ 단추 없이
  let autoT = 0;
  ta.addEventListener("input", () => {
    const changed = ta.value !== ta.dataset.orig;
    $("#editState").textContent = changed ? "고치는 중…" : "";
    clearTimeout(autoT); if (changed) autoT = setTimeout(applyQuiet, 600);
  });
  ta.addEventListener("blur", () => { clearTimeout(autoT); if (ta.value !== ta.dataset.orig) applyQuiet(); });
  ta.addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); applyEdit(); } });
  $("#applyBtn").onclick = applyEdit;
  $("#accBtn").onclick = () => {
    const a = ta.selectionStart, b = ta.selectionEnd;
    if (a === b) return;
    ta.value = ta.value.slice(0, a) + "**" + ta.value.slice(a, b) + "**" + ta.value.slice(b);
    ta.dispatchEvent(new Event("input"));
  };
  $("#splitBtn").onclick = () => {
    const it = selItem(); const s = it.slides[WF.sel.slide]; if (!s) return;
    const a = ta.selectionStart;
    const one = ta.value.slice(0, a).trim(), two = ta.value.slice(a).trim();
    if (!one || !two) return Store.message("나눌 자리(커서)를 글 가운데에 두고 누르세요.");
    s.text = one;
    it.slides.splice(WF.sel.slide + 1, 0, Object.assign({}, s, { text: two, secFirst: false }));
    it.edited = true; markDirty("svc"); afterItemChange(it);
  };
  $("#joinBtn").onclick = () => {
    const it = selItem(); const i = WF.sel.slide; const s = it.slides[i], n = it.slides[i + 1];
    if (!s || !n || n.kind !== "text") return;
    s.text = (ta.value || s.text) + "\n" + n.text;
    if (s.verses && n.verses) { s.verses = s.verses.concat(n.verses); if (s.ref && n.ref) s.ref = mergeRef(s.ref, n.ref); }
    it.slides.splice(i + 1, 1);
    it.edited = true; markDirty("svc"); afterItemChange(it);
  };
  $("#delSlideBtn").onclick = () => deleteSlide(WF.sel.slide);
  // 미리보기(①)를 두 번 누르면 화면에서 직접 고치기(가사 · 성경 · 글 화면)
  const seOpen = (e) => { if (e.target.closest && !e.target.closest("#pvSel, #sbPv")) return; const it = selItem(), s = it && it.slides[WF.sel.slide]; if (s && (s.kind === "text" || s.kind === "titlecard")) openStageEditor(WF.sel.item, WF.sel.slide); };
  $("#pvSel").addEventListener("dblclick", seOpen); $("#itemSource").addEventListener("click", seOpen);
}
// 화면 하나 빼기(빼기 단추 · 오른쪽 클릭 · Delete) — 뺀 뒤 잠깐 ‘되돌리기’
function deleteSlide(i) {
  const it = selItem(); if (!it || !it.slides[i]) return;
  if (WF.live && WF.live.item === WF.sel.item && WF.live.slide === i) return Store.message("지금 나가는 화면은 뺄 수 없습니다.");
  const [gone] = it.slides.splice(i, 1);
  if (gone.kind === "titlecard") (it.titleCard = it.titleCard || {}).on = false; // 제목 화면을 빼면 ‘제목 화면 먼저’도 끔
  if (WF.live && WF.live.item === WF.sel.item && WF.live.slide > i) WF.live.slide--;
  it.edited = true; WF.sel.slide = Math.max(0, Math.min(i, it.slides.length - 1));
  markDirty("svc"); afterItemChange(it);
  const b = flash(`화면을 뺐습니다. <button class="btn sm" id="undoSlide">되돌리기</button>`, 6000);
  const u = b && b.querySelector("#undoSlide");
  if (u) u.onclick = () => { if (selItem() !== it) return; it.slides.splice(i, 0, gone); if (gone.kind === "titlecard" && it.titleCard) it.titleCard.on = true; if (WF.live && WF.live.item === WF.sel.item && WF.live.slide >= i) WF.live.slide++; WF.sel.slide = i; markDirty("svc"); afterItemChange(it); banner(""); };
}
function moveSlide(i, d) {
  const it = selItem(), j = i + d; if (!it || !it.slides[i] || !it.slides[j]) return;
  [it.slides[i], it.slides[j]] = [it.slides[j], it.slides[i]];
  it.edited = true; WF.sel.slide = j; markDirty("svc"); afterItemChange(it);
}
// Delete(⌫): 준비 화면에서 화면 칸을 눌러 고른 뒤에만(다른 곳을 누르면 풀림)
document.addEventListener("mousedown", (e) => { if (!e.target.closest || !e.target.closest("#slideGrid, #menu")) WF.slideFocus = false; });
function deleteSelSlide() { if (WF.mode !== "prep" || !WF.slideFocus) return false; deleteSlide(WF.sel.slide); return true; }
function mergeRef(a, b) {
  const m1 = a.match(/^(.*?)(\d+):(\d+)(?:-(\d+))?$/), m2 = b.match(/^(.*?)(\d+):(\d+)(?:-(\d+))?$/);
  if (m1 && m2 && m1[1] === m2[1] && m1[2] === m2[2]) return `${m1[1]}${m1[2]}:${m1[3]}-${m2[4] || m2[3]}`;
  return a;
}
// 바로 반영: 글 칸은 그대로 두고(커서가 튀지 않게) 화면 목록 · 미리보기 · 나가는 화면만 다시
function applyQuiet() {
  const it = selItem(); const s = it && it.slides[WF.sel.slide], ta = $("#slideText");
  const fld = editableField(s); if (!fld || ta.value === ta.dataset.orig) return;
  if (fld === "design") { applyDesignTexts(s, ta.value); if (it.design) it.design.slides[WF.sel.slide] = clone(s); }
  else s[fld] = ta.value;
  if (it.kind !== "prayer" && it.kind !== "standby") it.edited = true;
  if (it.kind === "prayer") it.prayer.name = s.name;
  delete it.carried;
  ta.dataset.orig = ta.value;
  markDirty("svc");
  if (WF.live && WF.live.item === WF.svc.items.indexOf(it)) sendLive();
  renderSlideGrid(); renderSelPreview();
  $("#editState").textContent = "✓ 바로 반영됨";
}
function applyEdit() {
  const it = selItem(); const s = it && it.slides[WF.sel.slide];
  const fld = editableField(s); if (!fld) return;
  if (fld === "design") { applyDesignTexts(s, $("#slideText").value); if (it.design) it.design.slides[WF.sel.slide] = clone(s); }
  else s[fld] = $("#slideText").value;
  if (it.kind !== "prayer" && it.kind !== "standby") it.edited = true;
  if (it.kind === "prayer") it.prayer.name = s.name;
  delete it.carried;
  markDirty("svc");
  afterItemChange(it);
}

/* ── 미리보기 ── */
function renderSelPreview() {
  const it = selItem(); const s = it && it.slides[WF.sel.slide];
  drawEdPreview();
  drawInto($("#pvSel"), it, s, camFlags());
  const isLive = WF.live && WF.live.item === WF.sel.item && WF.live.slide === WF.sel.slide;
  const isCue = WF.cue && WF.cue.item === WF.sel.item && WF.cue.slide === WF.sel.slide;
  $("#pvTag").textContent = isLive ? "지금 나감" : isCue ? "다음" : "준비";
  $("#pvTag").className = "tag " + (isLive ? "red" : isCue ? "green" : "");
  renderBarCard();
  renderTcCard();
  attachTcDrag();
  drawOvPreview();
  const n = it ? nextPos({ item: WF.sel.item, slide: WF.sel.slide }) : null;
  const ns = slideAt(n), ni = itemAt(n);
  const nl = slideLabel(ns);
  $("#pvStage").innerHTML = `<div class="sp-top"><span>${esc(it ? it.title : "")}</span><span>${it && +it.minutes ? (it.kind === "sermon" ? "설교 남은 시간 " : "남은 시간 ") + it.minutes + ":00" : ""}</span></div>
    ${WF.stageMsg ? `<div class="sp-msg">${esc(WF.stageMsg)}</div>` : ""}
    <div class="sp-now"><div class="sp-lab">지금 <b>${esc(slideLabel(s))}</b></div>${Render.markup(slideText(s))}</div>
    <div class="sp-next"><div class="sp-lab">다음 <b>${esc((ni && ni !== it ? ni.title + (nl ? " · " + nl : "") : nl) || "")}</b></div>${Render.markup(slideText(ns))}</div>`;
}
// ② 생중계(OBS) 미리보기: 예배 중(무언가 나가는 중)이면 지금 생중계에 나가는 그대로(영상도 움직임),
//    아직 아무것도 안 나갔으면 고른 화면이 생중계에 어떻게 나갈지
function drawOvPreview() {
  const holder = $("#pvOv"); if (!holder) return;
  const useLive = !!WF.live;
  const it = useLive ? itemAt(WF.live) : selItem();
  const s = useLive ? slideAt(WF.live) : it && it.slides[WF.sel.slide];
  const rs = it && s ? resolveSlide(it, s) : null;
  const flags = useLive ? Object.assign({}, WF.flags, { overlayOff: WF.overlayOn === false }) : {};
  // 순서 자막바: 고른 화면이면 늘, 지금 나가는 중이면 생중계와 똑같이(나간 뒤 정한 초 동안 · ‘순서 자막바 ▶’로 다시)
  // 고른 화면이 가사 · 성경처럼 아래 글 띠가 나가는 화면이면 자막바는 그리지 않음(생중계와 같게 — 같이 나가지 않음)
  let bimg = !useLive && it && barSettings().where !== "off" && !barTextSlide(it, s) ? barImage(it) : null;
  if (useLive && window.barState) {
    const b = barState();
    if (b) {
      if (holder._barKey !== b.key) { holder._barKey = b.key; holder._barT = Date.now(); }
      const left = b.secs ? b.secs * 1000 - (Date.now() - holder._barT) : 1;
      if (left > 0) { if (b.hideText) flags.capOff = true; bimg = barImage(itemAt(WF.live)); clearTimeout(holder._barTm); if (b.secs) holder._barTm = setTimeout(drawOvPreview, left + 50); }
    }
  }
  const brel = bimg ? bimg.rel : "";
  if (brel) flags.capOff = true; // 0.3.32: 순서 자막바가 떠 있으면 하단 자막(설교 제목 · 기도자 이름)은 생중계에 안 나감
  $("#pvOvLabel").textContent = useLive ? "② 지금 생중계(OBS)에 나가는 화면" : "② 생중계(OBS)에 나갈 모양 · 고른 화면";
  const full = Render.overlayFull(rs, overlayTheme(), flags);
  const key = JSON.stringify([rs, flags, overlayTheme(), brel, barSettings().pos]);
  let r = holder._r || {};
  if (holder.dataset.key !== key || !holder.firstChild) {
    holder.dataset.key = key;
    r = holder._r = Render.drawOverlay(Render.mountScaled(holder), rs, overlayTheme(), Object.assign({}, flags, { fullSrc: (f) => Store.mediaUrl(f), fullPlay: true, projTheme: it ? themeOf(it) : null }));
    if (brel) {
      const img = document.createElement("img");
      img.src = barProjUrl(brel);
      Object.assign(img.style, { position: "absolute", bottom: "76px", width: bimg.w + "px", zIndex: 3 }); Render.barPlace(img, barSettings().pos, bimg.w);
      const st = holder.querySelector(".wf-stage"); st.appendChild(img);
      st.querySelectorAll(".wf-band").forEach((b) => (b.style.transform = "translateY(-250px)"));
    }
  }
  const has = Render.overlayContent(rs) && !(flags.black || flags.clear || flags.logo || flags.emergency || flags.overlayOff || flags.capOff || flags.cam);
  $("#pvOvTag").textContent = full && full.proj ? "예배당 화면 그대로" : full && !full.bg ? (full.video ? "영상 화면 가득" : "그림 화면 가득") : full ? "배경 영상 + 가사" : flags.overlayOff ? "자막 꺼짐 · 카메라만" : !has ? (brel ? "카메라 + 순서 자막바" : "카메라만") : r.overflow ? "길어서 작게 나감" : "카메라 위 자막";
  $("#pvOvTag").className = "tag " + (r.overflow ? "red" : full ? "live" : "");
  if (window.startCam) { attachCam(); startCam(); }
  // 그림 · 영상 화면이면 바로 아래에 ‘생중계에도 / 거두기’ 단추(그 그림에 저장 — 다음에도 그대로)
  const lm = liveMediaAt(useLive ? WF.live : WF.sel), mr = $("#ovMedia");
  if (mr) {
    mr.classList.toggle("hidden", !lm);
    if (lm) {
      const on = mediaLiveOn(lm.it, lm.file), what = lm.video ? "영상" : "그림";
      mr.innerHTML = `<span>${useLive ? "지금 나가는" : "고른"} ${what} · 생중계에 <b>${on ? "보임" : "안 보임(카메라)"}</b></span><button class="btn sm ${on ? "" : "primary"}" id="ovMediaBtn">${on ? "거두기" : "생중계에도 ▶"}</button>`;
      $("#ovMediaBtn").onclick = () => { toggleMediaLive(lm.it, lm.file); markDirty("svc"); if (WF.live && itemAt(WF.live) === lm.it) sendLive(); if (selItem() === lm.it) renderItemEditor(); drawOvPreview(); };
    }
  }
  renderOvTpl();
}
// ② 아래 ‘하단 자막 모양’: 템플릿을 누르면 미리보기 · 생중계에 바로(설정 › 생중계 자막 모양과 같은 값)
function renderOvTpl() {
  const box = $("#ovTpl"); if (!box) return;
  const t = overlayTheme(), mine = lowerTplList();
  const cur = Render.LOWER_TPLS.find((x) => x.id === t.tpl) || mine.find((m) => "my:" + m.file === t.tpl);
  const key = JSON.stringify([WF.ovTplOpen, t.tpl, t.size, t.width, t.bottom, t.textFull === true, t.showMedia !== false, mine.map((m) => m.file)]);
  if (box.dataset.key === key) return;
  box.dataset.key = key;
  const chip = (id, label, inner, my) => `<button class="tplchip${t.tpl === id ? " on" : ""}" data-tpl="${esc(id)}" title="${esc(label)}"><span class="tplsw">${inner}</span><span class="tplname">${esc(label)}</span>${my ? `<i class="tplx" data-hide="${esc(my)}" title="목록에서 빼기">×</i>` : ""}</button>`;
  box.innerHTML = `<button class="tplhead" id="ovTplHead">하단 자막 모양 <b>${esc(cur ? cur.name : "어두운 띠")}</b><span>${WF.ovTplOpen ? "▴" : "▾"}</span></button>` +
    (WF.ovTplOpen ? `<div class="tplrow">${Render.LOWER_TPLS.map((x) => chip(x.id, x.name, `<i class="tsw-${x.id}"></i>`)).join("")}${mine.map((m) => chip("my:" + m.file, m.name, `<img src="${Store.mediaUrl(m.file)}">`, m.id)).join("")}<button class="tplchip tpladd" id="ovTplAdd" title="교회에서 만든 띠 그림(PNG, 투명 바탕)을 넣으면 그 위에 가사 · 성경 글을 얹습니다"><span class="tplsw">＋</span><span class="tplname">내 템플릿 넣기</span></button></div>
      <div class="tplsl"><label>글자 크기 <input type="range" id="ovTplSize" min="36" max="80" step="2" value="${t.size}"></label><label>가로 폭 <input type="range" id="ovTplWidth" min="40" max="100" step="2" value="${t.width}"><b id="ovTplWidthV">${t.width}%</b></label><label>아래에서 <input type="range" id="ovTplBottom" min="2" max="20" step="1" value="${t.bottom}"></label></div>
      <div class="tplopt"><span>찬양 · 성경 · 고정 문구</span><span class="seg2" data-ovo="textFull">${[["", "하단 자막"], ["1", "화면 가득"]].map(([v, n]) => `<button data-v="${v}" class="${(t.textFull === true ? "1" : "") === v ? "on" : ""}">${n}</button>`).join("")}</span></div>
      <div class="tplopt"><span>영상 · 그림(기본)</span><span class="seg2" data-ovo="showMedia">${[["1", "생중계에도"], ["", "카메라만"]].map(([v, n]) => `<button data-v="${v}" class="${(t.showMedia !== false ? "1" : "") === v ? "on" : ""}">${n}</button>`).join("")}</span></div>
      <div class="muted small" style="margin-top:4px">화면 가득 = 예배당 화면 그대로. 대기 화면(카운트다운)은 늘 화면 가득. 영상 · 그림은 순서마다 · 그림마다 따로 고를 수 있습니다.</div>` : "");
  const set = (k, v) => { WF.lib.themes.overlay = Object.assign(WF.lib.themes.overlay || {}, { [k]: v }); markDirty("lib"); sendLive(); drawOvPreview(); };
  $("#ovTplHead").onclick = () => { WF.ovTplOpen = !WF.ovTplOpen; renderOvTpl(); };
  $$(".tplchip[data-tpl]", box).forEach((b) => (b.onclick = async (e) => {
    if (e.target.dataset.hide) {
      const m = WF.lib.media.find((x) => x.id === e.target.dataset.hide); if (!m) return;
      if (!(await Store.confirm(`‘${m.name}’ 템플릿을 목록에서 뺄까요?\n그림은 지우지 않고 숨기기만 합니다.`, "빼기"))) return;
      m.hidden = true; if (t.tpl === "my:" + m.file) WF.lib.themes.overlay.tpl = "a";
      markDirty("lib"); sendLive(); drawOvPreview(); return;
    }
    set("tpl", b.dataset.tpl);
  }));
  const add = $("#ovTplAdd");
  if (add) add.onclick = async () => {
    const paths = await Store.pickFiles({ multiple: false, title: "하단 자막 띠 그림 고르기(PNG, 투명 바탕 · 가로로 긴 그림)", filters: [{ name: "그림", extensions: ["png", "jpg", "jpeg", "webp"] }] });
    if (!paths.length) return;
    try {
      const r = await Store.importMedia(paths[0]);
      addMediaToLib(r);
      const m = WF.lib.media.find((x) => x.file === r.file);
      if (m) { m.hidden = false; m.folder = "mf-lower"; }
      set("tpl", "my:" + r.file);
    } catch (e) { Store.message("넣지 못했습니다: " + e); }
  };
  const sl = (id, k) => { const el = $("#" + id); if (el) el.onchange = () => set(k, +el.value); };
  sl("ovTplSize", "size"); sl("ovTplWidth", "width"); sl("ovTplBottom", "bottom");
  $$("[data-ovo] [data-v]", box).forEach((b) => (b.onclick = () => { set(b.parentElement.dataset.ovo, !!b.dataset.v); if (selItem() && selItem().kind === "media") renderItemEditor(); }));
  const wv = $("#ovTplWidth"); if (wv) wv.oninput = () => ($("#ovTplWidthV").textContent = wv.value + "%");
}
function renderPrepLivePreview() {
  if (WF.mode !== "prep") return;
  drawLivePreview($("#pvLive"));
  showVideoTime(null);
  $("#pvLiveTag").textContent = WF.live ? posLabel(WF.live) : "아직 없음";
  renderSelPreview();
}

/* ── 모양 ── */
// 교회력 13시기 배경(어두운1)과 금색 — 남은 조각 v2.js SC_FAM 과 같은 값. 첫 칸은 기본 검정.
const SEASONS = [["검정(기본)", "#000000", "#f5c84c"], ["새해 · 주현절", "#1b2130", "#d9b46a"], ["겨울 묵상", "#262c33", "#cfc7b4"], ["사순절", "#2a1f33", "#d4b06a"], ["고난 주간", "#2c1519", "#d6a575"], ["부활절", "#26241f", "#d8b257"], ["봄", "#20342a", "#e3c27a"], ["가정의 달", "#36222a", "#e8b6a2"], ["오순절", "#381714", "#f0a35e"], ["여름", "#0f2f38", "#a3d9d2"], ["맥추 · 성장", "#2d3120", "#d8c06a"], ["가을", "#32241a", "#e0a95e"], ["추수감사", "#3a2216", "#e9b25a"], ["대림 · 성탄", "#13281f", "#e0c06a"]];
function renderThemeForm() {
  const it = selItem();
  const box = $("#themeForm");
  if (!it) { box.innerHTML = ""; return; }
  const own = !!it.theme;
  $("#themeOwn").checked = own;
  $("#themeKind").textContent = own ? `‘${it.title}’ 항목만` : `${KINDS[it.kind].name} 모두`;
  const t = themeOf(it);
  const sel = (id, opts, v) => `<select id="${id}">${opts.map(([k, n]) => `<option value="${k}" ${String(v) === String(k) ? "selected" : ""}>${n}</option>`).join("")}</select>`;
  const row = (label, ctl) => `<div class="trow2"><span>${label}</span>${ctl}</div>`;
  const imgs = WF.lib.media.filter((m) => !m.hidden && !AUDIO_RE.test(m.ext));
  box.innerHTML =
    row("글꼴", sel("tFont", Object.entries(Render.FONTS).map(([k, f]) => [k, f.name]), t.font)) +
    row("최대 줄 수", sel("tLines", [[1, "1줄"], [2, "2줄"], [3, "3줄"], [4, "4줄"], [5, "5줄"]], t.maxLines)) +
    row("글자색 · 강조색", `<input type="color" id="tColor" value="${t.color}"><input type="color" id="tAccent" value="${t.accent}">`) +
    row("배경", `<input type="color" id="tBg" value="${t.bg}">${sel("tBgMedia", [["", "그림 없음"]].concat(imgs.map((m) => [m.file, m.name])), t.bgMedia)}`) +
    (t.bgMedia ? row("생중계에도", `<label class="chk"><input type="checkbox" id="tBgLive" ${overlayTheme().showBg ? "checked" : ""}> 배경 영상 · 그림을 생중계에도 보이기(꺼 두면 카메라 위에 가사만 — 모든 순서 공통)</label>`) : "") +
    `<div class="trow2"><span>교회력 색</span><div class="swatches">${SEASONS.map((x, i) => `<button class="sw ${t.bg === x[1] ? "on" : ""}" data-sw="${i}" title="${esc(x[0])}" style="background:${x[1]};border-color:${x[2]}"></button>`).join("")}</div></div>` +
    row("장절 표시", sel("tRef", [["top", "위쪽"], ["bottom", "아래쪽"], ["none", "안 보임"]], t.refPos)) +
    row("글자 돋보이게", sel("tEdge", [["shadow", "그림자 (기본)"], ["stroke", "검정 테두리"], ["strokeG", "초록 테두리 + 약한 그림자"], ["none", "없음"]], t.edge || (t.shadow === false ? "none" : "shadow")) + (t.bgMedia ? ` <span class="muted small">밝은 배경 영상이면 그림자나 테두리로</span>` : "")) +
    `<div class="trow2"><span>예배 전체</span><div><button class="btn sm" id="tAll">이 색을 예배 전체에</button> <span class="muted small" id="tAllNote">${themeMix()}</span></div></div>` +
    `<div class="trow2"><span></span><button class="btn sm" id="tReset">처음 모양으로</button></div>`;
  const target = () => {
    if (window.SE && SE.open) { if (SE.scope === "kind") return (WF.lib.themes[it.kind] = WF.lib.themes[it.kind] || {}); return (it.theme = it.theme || {}); } // 고치기 창: ‘어디에 쓸까요?’
    if ($("#themeOwn").checked) return (it.theme = it.theme || {});
    WF.lib.themes[it.kind] = WF.lib.themes[it.kind] || {};
    return WF.lib.themes[it.kind];
  };
  const set = (key, v, live) => {
    target()[key] = v;
    markDirty();
    if (live) { // 끄는 동안은 미리보기만, 손을 떼면 다시 나누기
      renderSelPreview(); return;
    }
    themeChanged(it);
  };
  const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };
  on("tFont", "change", (e) => set("font", e.target.value));
  on("tSize", "input", (e) => { e.target.nextElementSibling.textContent = e.target.value; set("size", +e.target.value, true); });
  on("tSize", "change", (e) => set("size", +e.target.value));
  on("tLines", "change", (e) => set("maxLines", +e.target.value));
  on("tColor", "change", (e) => set("color", e.target.value));
  on("tAccent", "change", (e) => { set("accent", e.target.value); target().refColor = e.target.value; });
  on("tBg", "change", (e) => set("bg", e.target.value));
  on("tBgMedia", "change", (e) => { set("bgMedia", e.target.value); renderThemeForm(); });
  on("tDim", "input", (e) => { e.target.nextElementSibling.textContent = e.target.value + "%"; set("dim", +e.target.value, true); });
  on("tDim", "change", (e) => set("dim", +e.target.value));
  on("tAlign", "change", (e) => set("align", e.target.value));
  on("tVal", "change", (e) => set("valign", e.target.value));
  on("tRef", "change", (e) => set("refPos", e.target.value));
  on("tMargin", "change", (e) => set("margin", +e.target.value));
  on("tEdge", "change", (e) => { set("edge", e.target.value); set("shadow", e.target.value !== "none"); });
  on("tBgLive", "change", (e) => { WF.lib.themes.overlay = Object.assign(WF.lib.themes.overlay || {}, { showBg: e.target.checked }); markDirty("lib"); sendLive(); renderSelPreview(); });
  $$(".sw", box).forEach((b) => (b.onclick = () => { const x = SEASONS[+b.dataset.sw]; const tg = target(); tg.bg = x[1]; tg.accent = x[2]; tg.refColor = x[2]; markDirty(); themeChanged(it); }));
  on("tAll", "click", () => { applyColorToAll(t); flash("예배 전체를 같은 색으로 맞췄습니다"); });
  on("tReset", "click", () => { if ($("#themeOwn").checked) delete it.theme; else delete WF.lib.themes[it.kind]; markDirty(); themeChanged(it); });
  $("#themeOwn").onchange = (e) => { if (e.target.checked) it.theme = {}; else delete it.theme; markDirty("svc"); themeChanged(it); };
}
// 예배 전체 색 맞추기: 글 화면(찬양 · 성경 · 설교 · 기도 · 고정 문구 · 글)이 모두 같은 바탕 · 강조색을 쓰게.
// 종류 공통 모양에 넣고, ‘이 항목만’에 따로 정한 색(바탕 · 강조 · 배경 그림)은 지운다(글꼴 · 크기는 그대로)
const COLOR_KINDS = ["song", "scripture", "sermon", "prayer", "fixed", "text"], COLOR_KEYS = ["bg", "accent", "refColor", "bgMedia", "dim"];
function themeMix() {
  const set = new Set(WF.svc.items.filter((x) => COLOR_KINDS.includes(x.kind)).map((x) => { const t = themeOf(x); return t.bgMedia ? "그림" : t.bg.toLowerCase(); }));
  return set.size > 1 ? `지금 이 예배에 바탕 ${set.size}가지` : "지금 이 예배는 한 가지 바탕";
}
function applyColorToAll(t) {
  const v = { bg: t.bg, accent: t.accent, refColor: t.refColor || t.accent, bgMedia: t.bgMedia || "", dim: t.dim || 0 };
  for (const k of COLOR_KINDS) WF.lib.themes[k] = Object.assign(WF.lib.themes[k] || {}, v);
  for (const x of WF.svc.items) if (x.theme && COLOR_KINDS.includes(x.kind)) { COLOR_KEYS.forEach((k) => delete x.theme[k]); if (!Object.keys(x.theme).length) delete x.theme; }
  markDirty();
  for (const x of WF.svc.items) if (x.kind === "scripture" || x.kind === "sermon") rebuild(x, true);
  if (WF.live) sendLive();
  renderPrep();
}
// 모양이 바뀌면(글자 크기 · 줄 수) 성경 나누기도 달라진다 → 손대지 않은 항목은 다시 나눔
function themeChanged(it) {
  for (const x of WF.svc.items) if (x === it || (!x.theme && x.kind === it.kind)) if (x.kind === "scripture" || x.kind === "sermon") rebuild(x, true);
  if (WF.live && itemAt(WF.live) && (itemAt(WF.live) === it || itemAt(WF.live).kind === it.kind)) sendLive();
  if (window.SE && SE.open) { seRender(); return; } // 고치기 창 안에서 바꾸면 창만 다시 그림
  renderPrep();
}

wireEditor();

// 파워포인트 글 가져오기 — 슬라이드 하나 = 화면 하나(글만). 그림 · 꾸밈은 가져오지 않는다.
async function pickPptx() {
  const p = await Store.pickFiles({ multiple: false, title: "파워포인트 파일 고르기", filters: [{ name: "파워포인트", extensions: ["pptx"] }] });
  if (!p.length) return null;
  try {
    const slides = (await Store.pptxText(p[0])).map((t) => t.trim()).filter(Boolean);
    if (!slides.length) { Store.message("이 파일에서 글을 찾지 못했습니다(그림으로만 된 슬라이드는 가져올 수 없습니다)."); return null; }
    return { name: p[0].split("/").pop().replace(/\.pptx$/i, ""), slides };
  } catch (e) { Store.message(String(e)); return null; }
}
async function importPptxItem() {
  // 모양 그대로(글상자 · 도형 · 표 · 그림 · 배경) 또는 글만(WorshipFlow 모양으로) 고르기
  const how = await new Promise((res) => modal(`<h3>파워포인트 가져오기</h3><div class="muted small">모양 그대로: 파워포인트 화면을 위치 · 색 · 글자 크기 그대로 가져옵니다(글은 ‘화면 글’ 칸에서 고칠 수 있음, 애니메이션 · 차트는 빠짐).<br>글만: 슬라이드의 글만 꺼내 WorshipFlow 모양으로 나눕니다(찬양 가사에 알맞음).</div>
    <div class="mfoot"><button class="btn" data-close>취소</button><button class="btn" id="pText">글만</button><button class="btn primary" id="pDesign">모양 그대로</button></div>`, (box, close) => {
    $("#pDesign", box).onclick = () => { close(); res("design"); };
    $("#pText", box).onclick = () => { close(); res("text"); };
    $$("[data-close]", box).forEach((b) => (b.onclick = () => { close(); res(null); }));
  }));
  if (!how) return;
  if (how === "design") {
    const p = await Store.pickFiles({ multiple: false, title: "파워포인트 파일 고르기", filters: [{ name: "파워포인트", extensions: ["pptx"] }] });
    if (!p.length) return;
    banner("파워포인트를 읽는 중…", "info");
    let slides;
    try { slides = await importPptxDesign(p[0]); } catch (e) { banner(""); return Store.message("가져오지 못했습니다: " + (e.message || e)); }
    banner("");
    const at = Math.min(WF.sel.item + 1, WF.svc.items.length);
    const it = { id: uid("i"), kind: "design", title: p[0].split("/").pop().replace(/\.pptx$/i, ""), minutes: 3, design: { slides }, slides: [] };
    it.slides = buildSlides(it);
    WF.svc.items.splice(at, 0, it);
    if (WF.live && WF.live.item >= at) WF.live.item++;
    if (WF.cue && WF.cue.item >= at) WF.cue.item++;
    WF.sel = { item: at, slide: 0 }; WF.undo = [];
    markDirty("svc"); renderPrep();
    return;
  }
  const r = await pickPptx(); if (!r) return;
  addItem("text");
  const it = selItem();
  it.title = r.name;
  it.text.text = r.slides.join("\n\n");
  rebuild(it); markDirty("svc"); renderPrep();
  Store.message(`‘${r.name}’에서 화면 ${r.slides.length}장을 가져왔습니다.\n찬양 가사라면 보관함 → 찬양 · 곡에서 ‘파워포인트에서 가져오기’로 곡으로 저장하면 매주 다시 쓸 수 있습니다.`);
}

/* ── 순서 제목 화면(전체 화면 · 순서 맨 앞 한 장) — 켜기 · 바탕(디자인 · 그림 · 영상) · 글 줄 · 자리 9칸 · 넘어가기 ── */
const TC_ST = [["big", "큰 글"], ["who", "이름"], ["small", "작은 글"], ["word", "한마디"]];
const TC_P9 = [["tl", "왼쪽 위"], ["tc", "위"], ["tr", "오른쪽 위"], ["ml", "왼쪽"], ["mc", "가운데"], ["mr", "오른쪽"], ["bl", "왼쪽 아래"], ["bc", "아래"], ["br", "오른쪽 아래"]];
function tcChanged(it, rerender) {
  markDirty("svc");
  const had = it.slides[0] && it.slides[0].kind === "titlecard";
  syncTitleCard(it);
  // 제목 화면이 들어가거나 빠지면 지금 나가는 · 다음 화면 번호도 한 칸 밀거나 당김
  const d = (it.slides[0] && it.slides[0].kind === "titlecard" ? 1 : 0) - (had ? 1 : 0), i0 = WF.svc.items.indexOf(it);
  if (d) for (const p of [WF.live, WF.cue]) if (p && p.item === i0) p.slide = Math.max(0, p.slide + d);
  if (rerender !== false) afterItemChange(it); else renderSelPreview();
  const i = WF.svc.items.indexOf(it);
  if (WF.live && WF.live.item === i) sendLive();
}
// 이 예배 모든 순서(찬양 · 성경 · 설교 · 기도 · 고정 문구 · 글)의 제목 화면을 한꺼번에 — 새로 더하는 순서도 같게(설정에 있던 칸을 여기로, 0.3.37)
function tcAll(on) {
  WF.lib.settings.tcDefault = on; markDirty("lib");
  for (const x of WF.svc.items) if (TC_KINDS.includes(x.kind)) (x.titleCard = x.titleCard || {}).on = on;
  syncAllTitleCards();
  if (WF.live) sendLive();
  renderPrep();
  flash(on ? "이 예배 모든 순서에 제목 화면을 넣었습니다." : "이 예배 모든 순서에서 제목 화면을 뺐습니다.", 3000);
}
function renderTcCard() {
  const card = document.getElementById("tcCard"); if (!card) return;
  const it = selItem();
  if (!it || !TC_KINDS.includes(it.kind)) { card.innerHTML = it ? `<div class="bt">제목 화면</div><div class="muted small">제목 화면은 찬양 · 성경 · 설교 · 기도 · 고정 문구 · 글 순서에 넣을 수 있습니다. 이 순서(${esc(KINDS[it.kind] ? KINDS[it.kind].name : it.kind)})에는 넣지 않습니다.</div>` : ""; return; }
  const tc = it.titleCard || {}, on = tcOn(it);
  const seg = (name, opts, cur) => `<span class="seg" data-tseg="${name}">${opts.map(([v, n]) => `<b data-v="${v}" class="${String(cur) === String(v) ? "on" : ""}">${n}</b>`).join("")}</span>`;
  let h = `<div class="bt">전체 화면 제목 <span class="tag ${on ? "green" : ""}">${on ? "켜짐 · 맨 앞 한 장" : "꺼짐"}</span></div>
    <div class="brow wrap"><span class="muted small">제목 화면 먼저</span>${seg("on", [["1", "켜기"], ["", "끄기"]], on ? "1" : "")}<span style="flex:1"></span><span class="muted small">이 예배 모든 순서</span><button class="btn sm" data-tcall="1">모두 켜기</button><button class="btn sm" data-tcall="">모두 끄기</button></div>`;
  if (on) {
    const lines = tcLines(it), sel = Math.min(WF.tcSel || 0, Math.max(0, lines.length - 1));
    const bg = tc.bg || "text", want = bg === "video" ? VIDEO_RE : /^(png|jpe?g|gif|webp|heic)$/i;
    const files = WF.lib.media.filter((m) => !m.hidden && want.test(m.ext || ""));
    h += `<div class="blab"><span>바탕</span></div><div class="brow wrap">${seg("bg", [["text", "글자만"], ["design", "디자인 그대로"], ["image", "그림"], ["video", "영상"]], bg)}</div>`;
    if (bg === "image" || bg === "video") h += `<div class="bfields"><label><span>${bg === "video" ? "영상" : "그림"}</span><select id="tcMedia"><option value="">— 저장공간에서 고르기 —</option>${files.map((m) => `<option value="${esc(m.file)}" ${tc.media === m.file ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select></label>
      <div class="brow wrap">
      <label class="chk small"><input type="checkbox" id="tcDeco" ${tc.deco !== false ? "checked" : ""}> 디자인 테두리 얹기</label>${bg === "video" ? `<span class="muted small">소리 없이 되풀이</span>` : ""}</div></div>`;
    h += `<div class="blab"><span>글 줄 — ${tc.custom ? "손으로 고친 글" : "순서를 따라 저절로(큰 글 = 순서 구분 · 작은 글 = 순서 이름)"}</span>${tc.custom ? `<button class="btn sm" id="tcAuto" title="고친 글을 버리고 순서를 따라가게">순서 따라 다시</button>` : ""}</div><div class="tclines">` +
      lines.map((l, i) => `<div class="tcl ${i === sel ? "on" : ""}" data-i="${i}"><input data-k="t" value="${esc(l.t || "")}" placeholder="글"><select data-k="st">${TC_ST.map(([v, n]) => `<option value="${v}" ${l.st === v ? "selected" : ""}>${n}</option>`).join("")}</select><span class="p9" title="${esc((TC_P9.find((x) => x[0] === (l.pos || "mc")) || [, ""])[1])}">${TC_P9.map(([v]) => `<i class="${(l.pos || "mc") === v ? "on" : ""}"></i>`).join("")}</span><button class="btn sm" data-a="up" title="위로">↑</button><button class="btn sm" data-a="del" title="빼기">×</button></div>`).join("") +
      `<button class="btn sm" id="tcAdd">+ 글 줄 더하기</button></div>`;
    if (lines[sel]) h += `<div class="blab"><span>고른 줄 자리 · ‘${esc(String(lines[sel].t || "").slice(0, 12))}’</span>${+lines[sel].dx || +lines[sel].dy ? `<button class="btn sm" id="tcReset">끌어 옮긴 것 되돌리기</button>` : ""}</div>
      <div class="pos9">${TC_P9.map(([v, n]) => `<b data-pos="${v}" class="${(lines[sel].pos || "mc") === v ? "on" : ""}">${n}</b>`).join("")}</div>`;
    h += `<div class="brow wrap" style="margin-top:8px"><span class="muted small">넘어가기</span>${seg("adv", [["", "다음 누를 때"], ["5", "5초 뒤 저절로"]], tc.adv || "")}</div>`;
  }
  card.innerHTML = h;
  const T = () => (it.titleCard = it.titleCard || {});
  card.querySelectorAll("[data-tseg]").forEach((sg) => sg.querySelectorAll("b").forEach((x) => (x.onclick = () => {
    const v = x.dataset.v, name = sg.dataset.tseg, t = T();
    if (name === "on") {
      t.on = !!v;
      tcChanged(it); if (t.on) { WF.sel.slide = 0; renderPrep(); } return;
    }
    if (name === "bg") { t.bg = v; if (v !== "design" && t.dim == null) t.dim = 30; }
    if (name === "adv") { if (v) t.adv = v; else delete t.adv; }
    tcChanged(it, false);
  })));
  const ta = document.getElementById("tcAuto"); if (ta) ta.onclick = () => { const t = T(); delete t.lines; delete t.custom; WF.tcSel = 0; tcChanged(it, false); renderTcCard(); };
  card.querySelectorAll("[data-tcall]").forEach((b) => (b.onclick = () => tcAll(b.dataset.tcall === "1")));
  const media = document.getElementById("tcMedia"); if (media) media.onchange = () => { T().media = media.value; tcChanged(it, false); };
  const dim = document.getElementById("tcDim"); if (dim) dim.onchange = () => { T().dim = +dim.value; tcChanged(it, false); };
  const deco = document.getElementById("tcDeco"); if (deco) deco.onchange = () => { T().deco = deco.checked; tcChanged(it, false); };
  card.querySelectorAll(".tcl").forEach((row) => {
    const i = +row.dataset.i, l = () => tcEditLines(it)[i];
    row.onmousedown = (e) => { if (WF.tcSel !== i && !e.target.closest("input,select,button")) { WF.tcSel = i; renderSelPreview(); } };
    row.querySelector("[data-k=t]").onfocus = () => { if (WF.tcSel !== i) { WF.tcSel = i; card.querySelectorAll(".tcl").forEach((r) => r.classList.toggle("on", +r.dataset.i === i)); } };
    row.querySelector("[data-k=t]").onchange = (e) => { l().t = e.target.value; tcChanged(it, false); };
    row.querySelector("[data-k=st]").onchange = (e) => { l().st = e.target.value; WF.tcSel = i; tcChanged(it, false); };
    row.querySelector("[data-a=up]").onclick = () => { const L = tcEditLines(it); if (i > 0) { [L[i - 1], L[i]] = [L[i], L[i - 1]]; WF.tcSel = i - 1; tcChanged(it, false); } };
    row.querySelector("[data-a=del]").onclick = () => { tcEditLines(it).splice(i, 1); WF.tcSel = Math.max(0, i - 1); tcChanged(it, false); };
  });
  const add = document.getElementById("tcAdd"); if (add) add.onclick = () => { const L = tcEditLines(it); L.push({ t: "", st: "small", pos: (L[L.length - 1] || {}).pos || "mc" }); WF.tcSel = L.length - 1; tcChanged(it, false); setTimeout(() => { const r = card.querySelector(`.tcl[data-i="${L.length - 1}"] input`); if (r) r.focus(); }, 0); };
  card.querySelectorAll("[data-pos]").forEach((b) => (b.onclick = () => { const L = tcEditLines(it), x = L[Math.min(WF.tcSel || 0, L.length - 1)]; if (!x) return; x.pos = b.dataset.pos; delete x.dx; delete x.dy; tcChanged(it, false); }));
  const rs = document.getElementById("tcReset"); if (rs) rs.onclick = () => { const x = tcEditLines(it)[WF.tcSel || 0]; if (x) { delete x.dx; delete x.dy; tcChanged(it, false); } };
}
// 미리보기(①)에서 제목 화면 글을 끌어 옮기기 — 옮긴 만큼(1920 화면 기준) dx · dy 로 저장
function attachTcDrag() {
  const it = selItem(), s = it && it.slides[WF.sel.slide], holder = $("#pvSel");
  if (!holder || !s || s.kind !== "titlecard") return;
  holder.querySelectorAll(".wf-tcl").forEach((el) => {
    const i = +el.dataset.tcl;
    if (i === (WF.tcSel || 0)) el.style.outline = "4px dashed #5fbf86", el.style.outlineOffset = "12px";
    el.style.cursor = "move";
    el.onpointerdown = (e) => {
      e.preventDefault(); el.setPointerCapture(e.pointerId);
      const line0 = tcLines(it)[i]; if (!line0) return;
      const k = holder.clientWidth / 1920, x0 = e.clientX, y0 = e.clientY, dx0 = +line0.dx || 0, dy0 = +line0.dy || 0, base = el.style.transform.replace(/ translate\([^)]*\)$/, "");
      let dx = dx0, dy = dy0;
      WF.tcSel = i;
      el.onpointermove = (m) => { dx = Math.round(dx0 + (m.clientX - x0) / k); dy = Math.round(dy0 + (m.clientY - y0) / k); el.style.transform = `${base} translate(${dx}px,${dy}px)`; };
      el.onpointerup = () => { el.onpointermove = el.onpointerup = null; if (dx !== dx0 || dy !== dy0) { const line = tcEditLines(it)[i]; if (line) { line.dx = dx; line.dy = dy; } } tcChanged(it, false); }; // 옮겼을 때만 ‘손으로 고친 것’
    };
  });
}
