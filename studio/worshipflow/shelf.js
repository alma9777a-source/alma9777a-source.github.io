// 왼쪽 저장공간(곡 묶음 · 예배 목록 · 곡 · 미디어 묶음)과 아래쪽 미디어 · 오디오 칸.
//  · 곡 묶음: ‘모든 곡’ · ‘새찬송가’는 저절로, 나머지는 교회가 만든 묶음(lib.songFolders, 곡은 여러 묶음에 들어갈 수 있음)
//  · 미디어 묶음: lib.mediaFolders(오디오 묶음은 audio:true), 그림 · 영상 · 오디오마다 folder 칸
//  · 오디오는 이 조작 창에서 재생(맥의 소리 출력 → 음향 콘솔). 예배당 화면과는 따로 논다.
WF.shelf = Object.assign({ songFolder: "all", mediaFolder: "", audioFolder: "", q: "", dock: "text", dockClosed: false, open: true }, (() => { try { return JSON.parse(localStorageGet("shelf") || "{}"); } catch (e) { return {}; } })());
if (WF.shelf.dock === "edit" || WF.shelf.dock === "theme") WF.shelf.dock = "text"; // 예전 ‘화면 글 · 모양’ · ‘모양’ 칸(모양은 화면에서 고치기 창 안으로)
function saveShelfUi() { const { songFolder, mediaFolder, audioFolder, dock, dockClosed, open } = WF.shelf; localStorageSet("shelf", JSON.stringify({ songFolder, mediaFolder, audioFolder, dock, dockClosed, open })); }

const isHymn = (s) => /^hymn\d+$/.test(s.id) || /새찬송가/.test(s.source || "");
const isAudio = (m) => AUDIO_RE.test(m.ext || "");
const isVid = (m) => VIDEO_RE.test(m.ext || "");
const fmtDur = (t) => (t > 0 && isFinite(t) ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}` : "");
WF.durs = WF.durs || {}; // 파일 → 길이(초), 한 번 읽으면 기억

/* ── 곡 묶음 ── */
function songFolderList() {
  const songs = WF.lib.songs.filter((s) => !s.hidden);
  const hymns = songs.filter(isHymn);
  const out = [{ id: "all", name: "모든 곡", count: songs.length, auto: true }];
  if (hymns.length) out.push({ id: "hymn", name: "새찬송가", count: hymns.length, auto: true });
  if (hymns.length && hymns.length < songs.length) out.push({ id: "other", name: "찬양 · 그 밖의 곡", count: songs.length - hymns.length, auto: true });
  for (const f of WF.lib.songFolders || []) out.push({ id: f.id, name: f.name, count: f.songs.filter((id) => songs.some((s) => s.id === id)).length });
  return out;
}
function songsInFolder(fid) {
  const songs = WF.lib.songs.filter((s) => !s.hidden);
  if (fid === "hymn") return songs.filter(isHymn).sort((a, b) => (+a.number || 0) - (+b.number || 0));
  if (fid === "other") return songs.filter((s) => !isHymn(s)).sort((a, b) => a.title.localeCompare(b.title, "ko", { numeric: true }));
  const f = (WF.lib.songFolders || []).find((x) => x.id === fid);
  if (f) return f.songs.map((id) => songs.find((s) => s.id === id)).filter(Boolean); // 묶음은 넣은 순서대로
  return songs.slice().sort((a, b) => (isHymn(a) !== isHymn(b) ? (isHymn(a) ? 1 : -1) : isHymn(a) ? (+a.number || 0) - (+b.number || 0) : a.title.localeCompare(b.title, "ko", { numeric: true })));
}
function filterSongs(list, q) {
  q = (q || "").trim();
  if (!q) return list;
  if (/^\d+$/.test(q)) { const n = +q; const exact = list.filter((s) => +s.number === n); return exact.concat(list.filter((s) => +s.number !== n && s.title.startsWith(q))); }
  const cho = /^[ㄱ-ㅎ]+$/.test(q);
  const nq = q.replace(/\s/g, "");
  const t = list.filter((s) => s.title.replace(/\s/g, "").includes(nq) || (cho && Bible.chosung(s.title.replace(/^\d+장\s*/, "")).replace(/\s/g, "").includes(q)));
  return cho ? t : t.concat(list.filter((s) => !t.includes(s) && (s.text || "").replace(/\s/g, "").includes(nq)));
}

/* ── 미디어 묶음 ── */
function mediaFolders() {
  const fs = WF.lib.mediaFolders || (WF.lib.mediaFolders = []);
  const ad = fs.find((f) => f.id === "mf-ad" && f.name === "광고 그림"); if (ad) ad.name = "광고 그림 · 영상"; // 광고에 영상도 들어감(0.3.16)
  if (!fs.find((f) => f.id === "mf-standby")) fs.splice(Math.max(0, fs.findIndex((f) => f.id === "mf-ad") + 1), 0, { id: "mf-standby", name: "대기 화면 영상" }); // 4K 대기 화면 영상(0.3.18)
  if (!fs.find((f) => f.id === "mf-lower")) fs.splice(Math.max(0, fs.findIndex((f) => f.id === "mf-standby") + 1), 0, { id: "mf-lower", name: "생중계 하단 템플릿" }); // 교회가 넣은 하단 자막 띠 그림(0.3.20)
  return fs;
}
function mediaIn(fid, audio) {
  const known = new Set(mediaFolders().map((f) => f.id));
  return WF.lib.media.filter((m) => !m.hidden && isAudio(m) === !!audio && (fid === "_none" ? !known.has(m.folder) : m.folder === fid));
}
function mediaFolderRows() {
  const rows = mediaFolders().map((f) => ({ id: f.id, name: f.name, audio: !!f.audio, count: mediaIn(f.id, f.audio).length }));
  const loose = mediaIn("_none", false).length, looseA = mediaIn("_none", true).length;
  if (loose) rows.push({ id: "_none", name: "분류 안 된 그림 · 영상", count: loose, auto: true });
  if (looseA) rows.push({ id: "_none", name: "분류 안 된 오디오", audio: true, count: looseA, auto: true });
  return rows;
}

/* ── 그리기 ── */
function renderShelf() {
  const sh = $("#shelf"); if (!sh || !WF.lib) return;
  sh.classList.toggle("hidden", !WF.shelf.open);
  if (!WF.shelf.open) return renderDock();
  // 곡 묶음
  const sf = songFolderList();
  if (!sf.find((f) => f.id === WF.shelf.songFolder)) WF.shelf.songFolder = sf.find((f) => f.id === "hymn") ? "hymn" : "all";
  $("#shSFCount").textContent = sf.length + "개";
  $("#shSongFolders").innerHTML = sf.map((f) => `<div class="shrow ${f.id === WF.shelf.songFolder ? "sel" : ""}" data-f="${f.id}"><i class="fi"></i><span class="nm">${esc(f.name)}</span><span class="n">${f.count}</span></div>`).join("");
  $$("#shSongFolders .shrow").forEach((el) => {
    const f = sf.find((x) => x.id === el.dataset.f);
    el.onclick = () => { WF.shelf.songFolder = f.id; saveShelfUi(); renderShelf(); };
    el.oncontextmenu = (e) => { e.preventDefault(); if (!f.auto) songFolderMenu(el, f.id); };
    if (!f.auto) {
      el.ondblclick = () => renameSongFolder(f.id);
      // 곡을 끌어다 묶음에 넣기
      el.ondragover = (e) => { e.preventDefault(); el.classList.add("dropto"); };
      el.ondragleave = () => el.classList.remove("dropto");
      el.ondrop = (e) => { e.preventDefault(); el.classList.remove("dropto"); const d = e.dataTransfer.getData("text/plain"); if (d.startsWith("song:")) addSongToFolder(d.slice(5), f.id); };
    }
  });
  // 예배 목록
  $("#shSvcCount").textContent = WF.services.length + "개";
  $("#shServices").innerHTML = WF.services.map((s) => `<div class="shrow ${WF.svc && s.id === WF.svc.id ? "sel" : ""}" data-s="${s.id}"><i class="fi svc"></i><span class="nm">${esc(s.title)} · ${esc(dateLabel(s.date))}</span></div>`).join("");
  $$("#shServices .shrow").forEach((el) => (el.onclick = () => { if (!WF.svc || el.dataset.s !== WF.svc.id) openService(el.dataset.s); }));
  renderShelfSongs();
  // 미디어 묶음
  const mf = mediaFolderRows();
  $("#shMFCount").textContent = mediaFolders().length + "개";
  // 골라진 것은 하나만: 마지막에 누른 쪽(그림 묶음 또는 소리 묶음). 소리가 나오는 묶음은 ‘♪ 재생 중’
  const last = WF.shelf.lastKind || "media";
  const cur = (f) => WF.shelf.dock === "media" && (last === "audio" ? f.audio && WF.shelf.audioFolder === f.id : !f.audio && WF.shelf.mediaFolder === f.id);
  const playingF = AP.el && !AP.el.paused && AP.list[AP.idx] ? AP.list[AP.idx].folder : "";
  $("#shMediaFolders").innerHTML = mf.map((f, i) => `<div class="shrow ${cur(f) ? "sel" : ""}" data-i="${i}"><i class="fi ${f.audio ? "aud" : "med"}"></i><span class="nm">${esc(f.name)}${f.audio && playingF === f.id ? ' <span class="ptag">♪ 재생 중</span>' : ""}</span><span class="n">${f.count}</span></div>`).join("");
  $$("#shMediaFolders .shrow").forEach((el) => {
    const f = mf[+el.dataset.i];
    el.onclick = () => { if (f.audio) WF.shelf.audioFolder = f.id; else WF.shelf.mediaFolder = f.id; WF.shelf.lastKind = f.audio ? "audio" : "media"; setDock("media"); };
    el.oncontextmenu = (e) => { e.preventDefault(); if (!f.auto) mediaFolderMenu(el, f.id); };
    if (!f.auto) el.ondblclick = () => renameMediaFolder(f.id);
    el.ondragover = (e) => { e.preventDefault(); el.classList.add("dropto"); };
    el.ondragleave = () => el.classList.remove("dropto");
    el.ondrop = (e) => { e.preventDefault(); el.classList.remove("dropto"); const d = e.dataTransfer.getData("text/plain"); if (d.startsWith("media:")) moveMedia(d.slice(6), f.id === "_none" ? "" : f.id); };
  });
  renderDock();
}
function renderShelfSongs() {
  const sf = songFolderList().find((f) => f.id === WF.shelf.songFolder) || { name: "곡" };
  const all = songsInFolder(WF.shelf.songFolder);
  const list = filterSongs(all, WF.shelf.q);
  $("#shSongsTitle").textContent = sf.name;
  $("#shSongsCount").textContent = (WF.shelf.q ? `${list.length}/` : "") + all.length + "곡";
  const curId = (() => { const it = WF.svc && WF.svc.items[WF.sel.item]; return it && it.kind === "song" ? it.song.songId : ""; })();
  const shown = list.slice(0, 400);
  $("#shSongs").innerHTML = shown.map((s) => `<div class="shrow ${s.id === curId ? "sel" : ""}" draggable="true" data-id="${s.id}" title="＋ · 두 번 누르기: 고른 순서가 찬양이면 그 곡을 바꾸고, 아니면 뒤에 넣기 · 끌어서 찬양 위에 놓으면 바꾸기, 사이에 놓으면 넣기"><span class="nm">${esc(s.title)}</span><button class="plus" title="고른 찬양을 이 곡으로 바꾸기 (찬양이 아니면 뒤에 넣기)">＋</button></div>`).join("") +
    (list.length > shown.length ? `<div class="muted small pad">… ${list.length - shown.length}곡 더 — 찾기로 좁혀 보세요</div>` : "") +
    (!list.length ? `<div class="muted small pad">${WF.shelf.q ? "찾는 곡이 없습니다." : (WF.lib.songFolders || []).some((f) => f.id === WF.shelf.songFolder) ? "아직 비어 있습니다. 다른 묶음의 곡을 이 묶음 이름 위로 끌어다 놓거나, 곡의 ⋯ 메뉴에서 넣으세요." : "곡이 없습니다."}</div>` : "");
  $$("#shSongs .shrow").forEach((el) => {
    const id = el.dataset.id;
    el.ondragstart = (e) => { e.dataTransfer.setData("text/plain", "song:" + id); e.dataTransfer.effectAllowed = "copy"; WF.dragKind = "song"; };
    el.ondragend = () => { WF.dragKind = ""; };
    el.ondblclick = () => addSongToService(id);
    $(".plus", el).onclick = (e) => { e.stopPropagation(); addSongToService(id); };
    el.onclick = (e) => { if (!e.target.closest(".plus")) songRowMenu(el, id); };
    el.oncontextmenu = (e) => { e.preventDefault(); songRowMenu(el, id); };
  });
}

/* ── 곡 → 예배 순서 ── */
// 누르기 · Enter · ＋: 고른 순서가 찬양이면 그 자리의 곡을 바꾸고, 아니면 고른 순서 바로 뒤에 새 찬양으로.
// mode: "auto"(위 규칙) · "insert"(늘 새 순서로, at 자리) · "replace"(at 자리의 찬양 곡을 바꿈)
function songTitleOf(it) { const s = it && it.kind === "song" && WF.lib.songs.find((x) => x.id === it.song.songId); return s ? s.title : ""; }
function addSongToService(songId, at, mode) {
  const song = WF.lib.songs.find((s) => s.id === songId); if (!song || !WF.svc) return;
  const items = WF.svc.items;
  mode = mode || "auto";
  const ti = mode === "replace" ? at : WF.sel.item;
  const cur = items[ti];
  if ((mode === "auto" || mode === "replace") && cur && cur.kind === "song") return replaceSong(ti, songId);
  const it = { id: uid("i"), kind: "song", title: isHymn(song) ? "찬송" : "찬양", minutes: 4, song: { songId }, slides: [] };
  it.slides = buildSlides(it);
  insertItem(it, at == null || mode === "auto" ? Math.min(WF.sel.item + 1, items.length) : at);
}
async function replaceSong(i, songId) {
  const items = WF.svc.items, it = items[i];
  const song = WF.lib.songs.find((s) => s.id === songId);
  if (it.song.songId === songId) return;
  const oldTitle = songTitleOf(it) || "빈 찬양";
  // 지금 나가고 있는 찬양이면: 그 자리는 그대로 두고(이미 부른 기록), 바로 뒤에 새 곡을 넣어 ‘다음’에 올림
  if (WF.live && WF.live.item === i) {
    if (!(await Store.confirm(`‘${oldTitle}’은 지금 예배당에 나가고 있습니다.\n‘${song.title}’을 바로 다음에 올릴까요? (→ 를 눌러야 나갑니다)`, "찬양 바꾸기"))) return;
    const n = { id: uid("i"), kind: "song", title: it.title, minutes: it.minutes, song: { songId }, slides: [] };
    n.slides = buildSlides(n);
    insertItem(n, i + 1);
    cue({ item: i + 1, slide: 0 });
    return flash(`‘${esc(song.title)}’ 첫 화면을 ‘다음’에 올렸습니다. → 를 누르면 나갑니다.`);
  }
  const prev = { songId: it.song.songId, carried: it.carried, edited: it.edited, slides: clone(it.slides) };
  const prevTitle = it.title;
  it.song.songId = songId; delete it.carried; it.edited = false;
  songTitleFollow(it);
  rebuild(it);
  if (WF.cue && WF.cue.item === i) WF.cue.slide = 0;
  WF.sel = { item: i, slide: 0 };
  markDirty("svc"); renderPrep();
  const b = flash(`‘${esc(oldTitle)}’ → ‘${esc(song.title)}’으로 바꿨습니다. <button class="btn sm" id="undoSong">되돌리기</button>`, 8000);
  const u = $("#undoSong", b);
  if (u) u.onclick = () => {
    if (WF.svc.items[i] !== it) return banner("");
    it.song.songId = prev.songId; it.edited = prev.edited; it.slides = prev.slides; it.title = prevTitle;
    if (prev.carried) it.carried = true;
    if (WF.cue && WF.cue.item === i) WF.cue.slide = 0;
    markDirty("svc"); renderPrep(); banner("");
  };
}
// 잠깐 보이는 알림(되돌리기 단추 등)
function flash(html, ms) {
  const b = banner(html, "info");
  clearTimeout(flash.t); flash.t = setTimeout(() => banner(""), ms || 3000);
  return b;
}
function insertItem(it, at) {
  const items = WF.svc.items;
  items.splice(at, 0, it);
  if (WF.live && WF.live.item >= at) WF.live.item++;
  if (WF.cue && WF.cue.item >= at) WF.cue.item++;
  WF.sel = { item: at, slide: 0 };
  WF.undo = [];
  markDirty("svc");
  if (WF.mode === "prep") renderPrep(); else refreshLive();
}
function songRowMenu(anchor, id) {
  const song = WF.lib.songs.find((s) => s.id === id); if (!song) return;
  const folders = WF.lib.songFolders || [];
  const inThis = folders.find((f) => f.id === WF.shelf.songFolder);
  showMenu(anchor, [
    ...(() => {
      const cur = WF.svc && WF.svc.items[WF.sel.item];
      if (cur && cur.kind === "song") return [
        { label: `‘${songTitleOf(cur) || cur.title + " (빈 찬양)"}’ → 이 곡으로 바꾸기`, run: () => addSongToService(id, WF.sel.item, "replace") },
        { label: "새 순서로 넣기 (고른 순서 뒤에)", run: () => addSongToService(id, Math.min(WF.sel.item + 1, WF.svc.items.length), "insert") },
      ];
      return [{ label: "예배 순서에 넣기 (고른 순서 뒤에)", run: () => addSongToService(id) }];
    })(),
    { label: "가사 보기 · 고치기 (보관함)", run: () => { WF.libTab = "songs"; WF.libSel = id; WF.libReturn = true; setMode("library"); } },
    "-",
    ...folders.filter((f) => !f.songs.includes(id)).map((f) => ({ label: `‘${f.name}’ 묶음에 넣기`, run: () => addSongToFolder(id, f.id) })),
    { label: "새 묶음을 만들어 넣기…", run: async () => { const f = await newSongFolder(); if (f) addSongToFolder(id, f.id); } },
    ...(inThis ? [{ label: `‘${inThis.name}’ 묶음에서 빼기`, run: () => { inThis.songs = inThis.songs.filter((x) => x !== id); markDirty("lib"); renderShelf(); } }] : []),
  ]);
}
function addSongToFolder(songId, fid) {
  const f = (WF.lib.songFolders || []).find((x) => x.id === fid); if (!f) return;
  if (!f.songs.includes(songId)) f.songs.push(songId);
  markDirty("lib"); renderShelf();
}
async function newSongFolder() {
  const t = await prompt2("곡 묶음 이름 (예: 05_CCM, 절기 찬양)", ""); if (!t || !t.trim()) return null;
  const f = { id: uid("sf"), name: t.trim(), songs: [] };
  (WF.lib.songFolders = WF.lib.songFolders || []).push(f);
  WF.shelf.songFolder = f.id; saveShelfUi(); markDirty("lib"); renderShelf();
  return f;
}
async function renameSongFolder(fid) {
  const f = WF.lib.songFolders.find((x) => x.id === fid); if (!f) return;
  const t = await prompt2("묶음 이름", f.name); if (!t || !t.trim()) return;
  f.name = t.trim(); markDirty("lib"); renderShelf();
}
function songFolderMenu(anchor, fid) {
  const f = WF.lib.songFolders.find((x) => x.id === fid); if (!f) return;
  const i = WF.lib.songFolders.indexOf(f);
  showMenu(anchor, [
    { label: "이름 바꾸기", run: () => renameSongFolder(fid) },
    { label: "위로", disabled: i === 0, run: () => { WF.lib.songFolders.splice(i, 1); WF.lib.songFolders.splice(i - 1, 0, f); markDirty("lib"); renderShelf(); } },
    { label: "아래로", disabled: i === WF.lib.songFolders.length - 1, run: () => { WF.lib.songFolders.splice(i, 1); WF.lib.songFolders.splice(i + 1, 0, f); markDirty("lib"); renderShelf(); } },
    "-",
    { label: "묶음 지우기 (곡은 보관함에 그대로)", danger: true, run: async () => {
      if (!(await Store.confirm(`‘${f.name}’ 묶음을 지울까요?\n곡은 지워지지 않고 ‘모든 곡’에 그대로 있습니다.`))) return;
      WF.lib.songFolders.splice(i, 1); WF.shelf.songFolder = "all"; markDirty("lib"); renderShelf();
    } },
  ]);
}

/* ── 미디어 묶음 고치기 ── */
async function newMediaFolder() {
  const kind = await new Promise((res) => modal(`<h3>새 미디어 묶음</h3><div class="tools" style="padding:0"><button class="btn primary" id="nmV">그림 · 영상 묶음</button><button class="btn" id="nmA">오디오 묶음 (음악 · MR)</button><button class="btn" data-close>취소</button></div>`, (box, close) => {
    $("#nmV", box).onclick = () => { close(); res("v"); };
    $("#nmA", box).onclick = () => { close(); res("a"); };
    $$("[data-close]", box).forEach((b) => (b.onclick = () => { close(); res(null); }));
  }));
  if (!kind) return;
  const t = await prompt2("묶음 이름 (예: 성탄 영상, 절기 배경)", ""); if (!t || !t.trim()) return;
  const f = { id: uid("mf"), name: t.trim() };
  if (kind === "a") { f.audio = true; WF.shelf.audioFolder = f.id; } else WF.shelf.mediaFolder = f.id;
  mediaFolders().push(f); markDirty("lib"); setDock("media");
}
async function renameMediaFolder(fid) {
  const f = mediaFolders().find((x) => x.id === fid); if (!f) return;
  const t = await prompt2("묶음 이름", f.name); if (!t || !t.trim()) return;
  f.name = t.trim(); markDirty("lib"); renderShelf();
}
function mediaFolderMenu(anchor, fid) {
  const fs = mediaFolders(), f = fs.find((x) => x.id === fid); if (!f) return;
  const i = fs.indexOf(f);
  showMenu(anchor, [
    { label: "이름 바꾸기", run: () => renameMediaFolder(fid) },
    { label: "위로", disabled: i === 0, run: () => { fs.splice(i, 1); fs.splice(i - 1, 0, f); markDirty("lib"); renderShelf(); } },
    { label: "아래로", disabled: i === fs.length - 1, run: () => { fs.splice(i, 1); fs.splice(i + 1, 0, f); markDirty("lib"); renderShelf(); } },
    "-",
    { label: "묶음 지우기 (파일은 ‘분류 안 됨’으로)", danger: true, run: async () => {
      if (!(await Store.confirm(`‘${f.name}’ 묶음을 지울까요?\n안에 있던 파일은 지워지지 않고 ‘분류 안 됨’으로 갑니다.`))) return;
      fs.splice(i, 1); markDirty("lib"); renderShelf();
    } },
  ]);
}
function moveMedia(mediaId, fid) {
  const m = WF.lib.media.find((x) => x.id === mediaId); if (!m) return;
  const f = mediaFolders().find((x) => x.id === fid);
  if (f && !!f.audio !== isAudio(m)) return Store.message(f.audio ? "오디오 묶음에는 음악 파일만 넣을 수 있습니다." : "그림 · 영상 묶음에는 오디오를 넣을 수 없습니다.");
  m.folder = fid || ""; markDirty("lib"); renderShelf();
}
async function importIntoFolder(audio) {
  const paths = await Store.pickFiles({ title: audio ? "음악 · MR 파일 고르기" : "그림 · 영상 고르기", filters: [audio ? { name: "오디오", extensions: AUDIO_EXT } : { name: "그림 · 영상", extensions: MEDIA_EXT }] });
  if (!paths.length) return;
  const fid = audio ? WF.shelf.audioFolder : WF.shelf.mediaFolder;
  const failed = [];
  for (const p of paths) {
    try {
      const r = await Store.importMedia(p);
      addMediaToLib(r);
      const m = WF.lib.media.find((x) => x.file === r.file);
      if (m) { m.hidden = false; if (fid && fid !== "_none") m.folder = fid; }
    } catch (e) { failed.push(p.split("/").pop() + " (" + e + ")"); }
  }
  markDirty("lib"); renderShelf();
  if (failed.length) Store.message("넣지 못한 파일:\n" + failed.join("\n"));
}

/* ── 아래쪽 칸 ── */
// 아래 칸 ‘이 순서 꾸미기’: 화면 글 · 모양 · 순서 자막바 · 제목 화면 · 그림 · 소리. 열린 탭을 다시 누르면 접힘(화면 목록이 넓어짐)
function setDock(which, toggle) {
  if (toggle && WF.shelf.dock === which) WF.shelf.dockClosed = !WF.shelf.dockClosed;
  else { WF.shelf.dock = which; WF.shelf.dockClosed = false; }
  saveShelfUi();
  renderShelf();
  if (WF.mode === "prep" && (which === "bar" || which === "tc") && typeof renderSelPreview === "function") renderSelPreview();
}
function renderDock() {
  const d = WF.shelf.dock, shut = !!WF.shelf.dockClosed;
  $$("#dockTabs button[data-dock]").forEach((b) => b.classList.toggle("on", b.dataset.dock === d && !shut));
  $("#dockFold").textContent = shut ? "펴기 ▴" : "접기 ▾";
  $("#dockEdit").hidden = shut || (d !== "text" && d !== "theme");
  const pe = $("#dockEdit .panel.edit"), pt = $("#dockEdit .panel.theme");
  if (pe) pe.hidden = d !== "text"; if (pt) pt.hidden = d !== "theme";
  $("#dockCard").hidden = shut || (d !== "bar" && d !== "tc");
  $("#barCard").hidden = d !== "bar"; $("#tcCard").hidden = d !== "tc";
  $("#dockMedia").hidden = shut || d !== "media";
  $("#dockAudioDot").classList.toggle("hidden", !(AP.el && !AP.el.paused));
  if (d === "media" && !shut) { renderBin(); renderAudio(); }
}
function renderBin() {
  const rows = mediaFolderRows().filter((f) => !f.audio);
  if (!rows.find((f) => f.id === WF.shelf.mediaFolder)) WF.shelf.mediaFolder = (rows[0] || {}).id || "";
  $("#binTabs").innerHTML = rows.map((f) => `<button data-f="${f.id}" class="${f.id === WF.shelf.mediaFolder ? "on" : ""}">${esc(f.name)}</button>`).join("");
  $$("#binTabs button").forEach((b) => (b.onclick = () => { WF.shelf.mediaFolder = b.dataset.f; saveShelfUi(); renderShelf(); }));
  const list = WF.shelf.mediaFolder ? mediaIn(WF.shelf.mediaFolder, false) : [];
  const liveS = slideAt(WF.live), cueS = slideAt(WF.cue);
  const onair = liveS && liveS.kind === "media" ? liveS.mediaFile : "", cued = cueS && cueS.kind === "media" ? cueS.mediaFile : "";
  // 같은 내용이면 다시 그리지 않음(영상 작은 그림이 깜빡이지 않게)
  const key = JSON.stringify([WF.shelf.mediaFolder, list.map((m) => m.id + m.name), onair, cued]);
  if (key === renderBin.key && $("#binGrid").childElementCount) return;
  renderBin.key = key;
  $("#binGrid").innerHTML = list.map((m) => `<div class="bcell ${m.file === onair ? "onair" : ""} ${m.file === cued ? "cued" : ""}" draggable="true" data-id="${m.id}" title="${esc(m.name)}">
      <div class="bt">${isVid(m) ? `<video src="${Store.mediaUrl(m.file)}#t=1" muted preload="metadata"></video>` : `<img src="${Store.mediaUrl(m.file)}" loading="lazy">`}
        ${m.file === onair ? `<span class="tagn">지금</span>` : m.file === cued ? `<span class="tagn g">다음</span>` : ""}
        ${isVid(m) ? `<span class="dur">${fmtDur(WF.durs[m.file])}</span>` : ""}${m.file === onair && isVid(m) ? `<i class="vp" id="binVp"></i>` : ""}</div>
      <span class="nm">${esc(m.name.replace(/\.[^.]+$/, ""))}</span></div>`).join("") +
    `<div class="bcell addc" id="binAddCell"><div class="bt">＋</div><span class="nm">그림 · 영상 넣기</span></div>` +
    (!WF.shelf.mediaFolder ? `<div class="binempty">왼쪽 ‘보관함 · 그림 · 영상 · 소리’의 ＋로 묶음을 먼저 만드세요.</div>` : "");
  $("#binAddCell").onclick = () => (WF.shelf.mediaFolder ? importIntoFolder(false) : newMediaFolder());
  $$("#binGrid .bcell[data-id]").forEach((el) => {
    const m = WF.lib.media.find((x) => x.id === el.dataset.id);
    const v = $("video", el);
    if (v) v.onloadedmetadata = () => { WF.durs[m.file] = v.duration; const d = $(".dur", el); if (d) d.textContent = fmtDur(v.duration); };
    let clickT = null;
    el.onclick = () => { clearTimeout(clickT); clickT = setTimeout(() => cueMedia(m, false), 230); };
    el.ondblclick = () => { clearTimeout(clickT); cueMedia(m, true); };
    el.ondragstart = (e) => { e.dataTransfer.setData("text/plain", "media:" + m.id); e.dataTransfer.effectAllowed = "copy"; };
    el.oncontextmenu = (e) => { e.preventDefault(); mediaMenu(el, m); };
  });
}
// 미디어 하나를 지금 순서 바로 뒤에 ‘급히 더한’ 항목으로 넣고 ‘다음’에 올림(now 면 바로 내보냄)
function mediaItem(m, quick) {
  const it = { id: uid("i"), kind: "media", title: m.name.replace(/\.[^.]+$/, ""), minutes: quick ? 0 : 3, media: { files: [{ file: m.file, name: m.name, ext: m.ext }], text: "", auto: 0 }, slides: [] };
  if (quick) it.quick = true;
  if (m.folder === "mf-bg" && isVid(m)) it.media.loop = true; // 배경 영상 묶음은 처음부터 반복
  it.slides = buildSlides(it);
  return it;
}
function cueMedia(m, now) {
  if (!WF.svc) return;
  const items = WF.svc.items;
  // 이미 ‘다음’에 같은 파일이 올라가 있으면 새로 만들지 않음
  const c = slideAt(WF.cue);
  let p;
  if (c && c.kind === "media" && c.mediaFile === m.file) p = WF.cue;
  else {
    const it = mediaItem(m, true);
    const at = (WF.live ? WF.live.item : WF.cue ? WF.cue.item - 1 : -1) + 1;
    items.splice(at, 0, it);
    if (WF.cue && WF.cue.item >= at) WF.cue.item++;
    if (WF.sel.item >= at) WF.sel.item++;
    WF.undo = [];
    markDirty("svc");
    p = { item: at, slide: 0 };
  }
  if (now) {
    if (WF.rehearsal) return cue(p);
    goLive(p);
  } else cue(p);
  if (WF.mode === "prep") renderPrep();
  banner(now ? `‘${esc(m.name)}’을 예배당 화면에 내보냈습니다.` : `‘${esc(m.name)}’을 ‘다음’에 올렸습니다. 예배 중 화면에서 → 를 누르면 나갑니다.`, "info");
  clearTimeout(cueMedia.t); cueMedia.t = setTimeout(() => banner(""), 3000);
}
function mediaMenu(anchor, m) {
  const fs = mediaFolders().filter((f) => !!f.audio === isAudio(m) && f.id !== m.folder);
  showMenu(anchor, [
    ...(isAudio(m) ? [{ label: "재생", run: () => playAudio(m) }] : [
      { label: "다음에 올리기", run: () => cueMedia(m, false) },
      { label: "바로 내보내기", run: () => cueMedia(m, true) },
      { label: "예배 순서에 넣기", run: () => insertItem(mediaItem(m, false), Math.min(WF.sel.item + 1, WF.svc.items.length)) },
    ]),
    { label: "이름 바꾸기", run: async () => { const t = await prompt2("이름", m.name); if (t && t.trim()) { m.name = t.trim(); markDirty("lib"); renderShelf(); } } },
    "-",
    ...fs.map((f) => ({ label: `‘${f.name}’ 묶음으로 옮기기`, run: () => moveMedia(m.id, f.id) })),
    "-",
    { label: "목록에서 숨기기", danger: true, run: async () => { if (await Store.confirm(`‘${m.name}’을 목록에서 숨길까요? (이미 순서에 넣은 것은 그대로 나옵니다)`)) { m.hidden = true; markDirty("lib"); renderShelf(); } } },
  ]);
}

/* ── 오디오 재생 ── */
const AP = { el: null, list: [], idx: -1, fading: null };
function audioFolderRows() { return mediaFolderRows().filter((f) => f.audio); }
function renderAudio() {
  const rows = audioFolderRows();
  if (!rows.find((f) => f.id === WF.shelf.audioFolder)) WF.shelf.audioFolder = (rows[0] || {}).id || "";
  $("#audTabs").innerHTML = rows.map((f) => `<button data-f="${f.id}" class="${f.id === WF.shelf.audioFolder ? "on" : ""}">${esc(f.name)}</button>`).join("") || `<span class="muted small">오디오 묶음 없음</span>`;
  $$("#audTabs button").forEach((b) => (b.onclick = () => { WF.shelf.audioFolder = b.dataset.f; saveShelfUi(); renderShelf(); }));
  const list = WF.shelf.audioFolder ? mediaIn(WF.shelf.audioFolder, true) : [];
  const playing = AP.list[AP.idx];
  $("#audList").innerHTML = list.map((m) => `<div class="arow ${playing && playing.id === m.id ? "on" : ""}" data-id="${m.id}"><span>${playing && playing.id === m.id && AP.el && !AP.el.paused ? "▶" : "♪"}</span><span class="nm">${esc(m.name.replace(/\.[^.]+$/, ""))}</span><span class="d">${fmtDur(WF.durs[m.file])}</span></div>`).join("") ||
    `<div class="muted small pad">${WF.shelf.audioFolder ? "＋ 넣기로 예배 전 음악 · MR 파일(mp3 · m4a · wav)을 넣으세요." : "왼쪽 ‘미디어 저장공간’의 ＋로 오디오 묶음을 만드세요."}</div>`;
  $$("#audList .arow").forEach((el) => {
    const m = WF.lib.media.find((x) => x.id === el.dataset.id);
    el.onclick = () => (playing && playing.id === m.id ? toggleAudio() : playAudio(m, list));
    el.oncontextmenu = (e) => { e.preventDefault(); mediaMenu(el, m); };
    if (!WF.durs[m.file]) { const a = new Audio(); a.preload = "metadata"; a.src = Store.mediaUrl(m.file); a.onloadedmetadata = () => { WF.durs[m.file] = a.duration; const d = $(".d", el); if (d) d.textContent = fmtDur(a.duration); }; }
  });
  $("#audRepeat").classList.toggle("on", !!WF.lib.settings.audioRepeat);
  $("#audShuffle").classList.toggle("on", !!WF.lib.settings.audioShuffle);
  $("#audVol").value = Math.round((WF.lib.settings.audioVolume == null ? 0.8 : WF.lib.settings.audioVolume) * 100);
  updateAudioUi();
}
function audioEl() {
  if (AP.el) return AP.el;
  const a = (AP.el = new Audio());
  a.addEventListener("timeupdate", updateAudioUi);
  a.addEventListener("play", () => { updateAudioUi(); renderAudioList(); });
  a.addEventListener("pause", () => { updateAudioUi(); renderAudioList(); });
  a.addEventListener("ended", () => nextAudio(true));
  a.addEventListener("error", () => { banner("이 오디오 파일을 재생하지 못했습니다.", "warn"); setTimeout(() => banner(""), 3000); });
  return a;
}
function renderAudioList() { if (WF.shelf.dock === "media" && WF.mode === "prep") renderAudio(); else updateAudioUi(); }
function playAudio(m, list) {
  const a = audioEl();
  clearInterval(AP.fading); AP.fading = null;
  AP.list = list || mediaIn(m.folder || "_none", true);
  if (!AP.list.find((x) => x.id === m.id)) AP.list = [m];
  AP.idx = AP.list.findIndex((x) => x.id === m.id);
  a.src = Store.mediaUrl(m.file);
  a.volume = WF.lib.settings.audioVolume == null ? 0.8 : WF.lib.settings.audioVolume;
  a.play().catch((e) => console.warn(e));
}
function toggleAudio() {
  const a = AP.el; if (!a || !a.src) { const m = mediaIn(WF.shelf.audioFolder, true)[0]; return m && playAudio(m, mediaIn(WF.shelf.audioFolder, true)); }
  if (a.paused) a.play().catch(() => {}); else a.pause();
}
function stopAudio() {
  const a = AP.el; if (!a) return;
  clearInterval(AP.fading); AP.fading = null;
  a.pause(); a.currentTime = 0; a.removeAttribute("src"); a.load();
  AP.idx = -1; updateAudioUi(); renderAudioList();
}
function nextAudio(auto) {
  if (!AP.list.length) return stopAudio();
  const st = WF.lib.settings;
  let i;
  if (st.audioShuffle && AP.list.length > 1) { do i = Math.floor(Math.random() * AP.list.length); while (i === AP.idx); }
  else i = AP.idx + 1;
  if (i >= AP.list.length) { if (auto && !st.audioRepeat) return stopAudio(); i = 0; }
  playAudio(AP.list[i], AP.list);
}
function fadeAudio(sec) {
  const a = AP.el; if (!a || a.paused) return;
  clearInterval(AP.fading);
  const v0 = a.volume, steps = sec * 10; let k = 0;
  AP.fading = setInterval(() => { k++; a.volume = Math.max(0, v0 * (1 - k / steps)); if (k >= steps) { stopAudio(); a.volume = v0; } }, 100);
}
function updateAudioUi() {
  const a = AP.el, m = AP.list[AP.idx];
  const on = !!(a && m && a.src);
  const chip = $("#chipAudio");
  chip.classList.toggle("hidden", !on);
  if (on) { $("span", chip).textContent = (a.paused ? "❚❚ " : "♪ ") + m.name.replace(/\.[^.]+$/, ""); $(".dot", chip).className = "dot" + (a.paused ? " off" : ""); }
  const dot = $("#dockAudioDot"); if (dot) dot.classList.toggle("hidden", !(on && !a.paused));
  if (WF.shelf.dock !== "media") return;
  $("#audPlay").textContent = on && !a.paused ? "❚❚" : "▶";
  const d = on ? a.duration || WF.durs[m.file] || 0 : 0, t = on ? a.currentTime : 0;
  $("#audProg i").style.width = d ? (100 * t) / d + "%" : "0";
  $("#audTime").textContent = on ? `${fmtDur(t) || "0:00"} / ${fmtDur(d)}` : "0:00";
}

// 곡을 순서 위로 끌 때: 찬양 항목의 가운데면 ‘곡 바꾸기’, 위쪽 1/3 이나 다른 항목이면 ‘그 자리에 새로’
function dropMode(row, e) {
  const it = WF.svc.items[+row.dataset.i];
  if (!it || it.kind !== "song") return "insert";
  const r = row.getBoundingClientRect();
  return e.clientY - r.top > r.height / 3 ? "replace" : "insert";
}

/* ── 연결 ── */
(function wireShelf() {
  $("#shelfToggle").onclick = () => {
    // 좁은 창(맥북)에서는 저장공간이 접혀 있다가 누르면 위에 떠서 펼쳐짐
    if (matchMedia("(max-width: 1600px)").matches) { if (!WF.shelf.open) { WF.shelf.open = true; saveShelfUi(); renderShelf(); } $("#shelf").classList.toggle("peek"); return; }
    WF.shelf.open = !WF.shelf.open; saveShelfUi(); renderShelf();
  };
  addEventListener("keydown", (e) => { if (e.key === "Escape") { const sh = $("#shelf"); if (sh) sh.classList.remove("peek"); } });
  // 위에 떠서 펼친 저장공간: 안의 ‘접기’ 또는 바깥을 누르면 접힘(순서 칸의 ◧ 를 덮어도 닫을 수 있게)
  $("#shelfClose").onclick = () => { const sh = $("#shelf"); if (sh.classList.contains("peek")) sh.classList.remove("peek"); else { WF.shelf.open = false; saveShelfUi(); renderShelf(); } };
  document.addEventListener("mousedown", (e) => { const sh = $("#shelf"); if (sh && sh.classList.contains("peek") && !sh.contains(e.target) && !e.target.closest("#shelfToggle, #menu, #modal")) sh.classList.remove("peek"); });
  $("#shSFAdd").onclick = () => newSongFolder();
  $("#shSvcAdd").onclick = () => svcMenu();
  $("#shSongAdd").onclick = () => { WF.libTab = "songs"; WF.libReturn = true; setMode("library"); libAdd(); };
  $("#shMFAdd").onclick = () => newMediaFolder();
  $("#shSearch").oninput = (e) => { WF.shelf.q = e.target.value; renderShelfSongs(); };
  $("#shSearch").addEventListener("keydown", (e) => {
    // Enter: 맨 위 곡을 순서에 넣기
    if (e.key === "Enter") { const first = $("#shSongs .shrow"); if (first) { addSongToService(first.dataset.id); e.target.select(); } }
    if (e.key === "Escape") { e.target.value = ""; WF.shelf.q = ""; renderShelfSongs(); e.target.blur(); }
  });
  $$("#dockTabs button[data-dock]").forEach((b) => (b.onclick = () => setDock(b.dataset.dock, true)));
  $("#dockFold").onclick = () => { WF.shelf.dockClosed = !WF.shelf.dockClosed; saveShelfUi(); renderDock(); };
  $("#binAdd").onclick = () => (WF.shelf.mediaFolder ? importIntoFolder(false) : newMediaFolder());
  $("#audAdd").onclick = () => (WF.shelf.audioFolder ? importIntoFolder(true) : newMediaFolder());
  $("#audPlay").onclick = () => toggleAudio();
  $("#audStop").onclick = () => stopAudio();
  $("#audNext").onclick = () => nextAudio(false);
  $("#audFade").onclick = () => fadeAudio(5);
  $("#audRepeat").onclick = () => { WF.lib.settings.audioRepeat = !WF.lib.settings.audioRepeat; markDirty("lib"); renderAudio(); };
  $("#audShuffle").onclick = () => { WF.lib.settings.audioShuffle = !WF.lib.settings.audioShuffle; markDirty("lib"); renderAudio(); };
  $("#audVol").oninput = (e) => { const v = +e.target.value / 100; WF.lib.settings.audioVolume = v; if (AP.el) AP.el.volume = v; markDirty("lib"); };
  $("#audProg").onclick = (e) => { const a = AP.el; if (!a || !a.duration) return; const r = e.currentTarget.getBoundingClientRect(); a.currentTime = ((e.clientX - r.left) / r.width) * a.duration; };
  $("#chipAudio").onclick = () => toggleAudio();
  // 순서 목록에 곡 · 미디어를 끌어다 놓기(빈 곳에 놓으면 맨 끝)
  const ol = $("#orderList");
  ol.addEventListener("dragover", (e) => {
    e.preventDefault();
    const row = e.target.closest(".oitem"); if (!row || WF.dragKind !== "song") return;
    const rep = dropMode(row, e) === "replace";
    row.classList.toggle("replaceto", rep); row.classList.toggle("dropto", !rep);
  });
  ol.addEventListener("dragleave", (e) => { const row = e.target.closest(".oitem"); if (row) row.classList.remove("replaceto"); });
  ol.addEventListener("drop", (e) => {
    const d = e.dataTransfer.getData("text/plain");
    if (!/^(song|media):/.test(d)) return;
    e.preventDefault();
    const row = e.target.closest(".oitem");
    const at = row ? +row.dataset.i : WF.svc.items.length;
    if (row) row.classList.remove("dropto", "replaceto");
    if (d.startsWith("song:")) addSongToService(d.slice(5), at, row && dropMode(row, e) === "replace" ? "replace" : "insert");
    else { const m = WF.lib.media.find((x) => x.id === d.slice(6)); if (m) insertItem(mediaItem(m, false), at); }
  });
  // 예배당 화면의 영상 진행
  Store.listen("video-time", (p) => {
    const vp = $("#binVp"); if (vp && p.d) vp.style.width = (100 * p.t) / p.d + "%";
    const s = slideAt(WF.live); if (s && s.mediaFile && p.d) WF.durs[s.mediaFile] = p.d;
    showVideoTime(p);
  });
})();
