// 예배 중 화면 — 큰 단추, 지금과 다음. 순서 · 화면을 누르면 ‘다음’에만 올라가고, → 를 눌러야 나간다.
function stripItemIndex() {
  if (WF.live) return WF.live.item;
  if (WF.cue) return WF.cue.item;
  return 0;
}

function renderLive() {
  const svc = WF.svc;
  // 순서
  const lo = $("#liveOrder");
  lo.innerHTML = svc.items.map((it, i) => {
    const done = WF.live && i < WF.live.item;
    const isLive = WF.live && i === WF.live.item;
    const isCue = WF.cue && i === WF.cue.item && !isLive;
    const n = it.slides.length;
    return `<div class="litem ${done ? "done" : ""} ${isLive ? "live" : ""} ${isCue ? "cue" : ""} ${!n ? "empty" : ""}" data-i="${i}">
      <span class="lname">${isLive ? "● " : ""}${esc(it.title)}${!n ? ` <span class="ltag">${it.kind === "song" && !(it.song || {}).songId ? "곡 안 고름" : "화면 없음"} · 건너뜀</span>` : ""}</span>
      <span class="lmeta">${isLive ? `${WF.live.slide + 1}/${n}` : isCue ? "다음" : done ? "✓" : it.minutes ? it.minutes + "분" : ""}</span></div>`;
  }).join("");
  $$(".litem", lo).forEach((el) => (el.onclick = () => { const i = +el.dataset.i; if (svc.items[i].slides.length) cue({ item: i, slide: 0 }); }));
  const liveEl = $(".litem.live", lo); if (liveEl) liveEl.scrollIntoView({ block: "nearest" });

  // 지금 · 다음
  const r = drawLivePreview($("#pvNow"));
  showVideoTime(null);
  const ovs = liveOvStatus();
  $("#nowOvTag").textContent = WF.live ? "생중계: " + ovs.text : "";
  $("#nowOvTag").className = "tag " + (ovs.full ? "live" : "") + (WF.live ? "" : " hidden");
  $("#nowLabel").textContent = WF.live ? posLabel(WF.live) : "아직 내보낸 화면이 없습니다 — → 를 누르면 시작";
  const lit = itemAt(WF.live), nit = itemAt(WF.cue);
  const notes = [lit && lit.note ? lit.note : "", nit && nit !== lit && nit.note ? `다음(${nit.title}): ${nit.note}` : ""].filter(Boolean);
  $("#liveNote").textContent = notes.join("  ·  ");
  $("#liveNote").classList.toggle("hidden", !notes.length);
  drawInto($("#pvNext"), itemAt(WF.cue), slideAt(WF.cue), camFlags());
  $("#nextLabel").textContent = WF.cue ? posLabel(WF.cue) : "마지막 화면입니다";
  $("#pvNow").classList.toggle("rehearsal", WF.rehearsal);

  // 화면 띠
  const si = stripItemIndex();
  const it = svc.items[si];
  const strip = $("#liveStrip");
  strip.innerHTML = it ? it.slides.map((s, i) => {
    const isLive = WF.live && WF.live.item === si && WF.live.slide === i;
    const isCue = WF.cue && WF.cue.item === si && WF.cue.slide === i;
    return `<div class="tcell ${isLive ? "live" : ""} ${isCue ? "cue" : ""}" data-i="${i}"><div class="thumb">${partBadge(s)}</div>${isLive ? "" : `<button class="golive" title="이 화면을 바로 내보냅니다">바로 내보내기 ▶</button>`}
      <div class="scap${partTag(s) ? " part" : ""}"${partStyle(s)}><span>${esc(slideCaption(it, s, i))}</span><span>${isLive ? "지금" : isCue ? "다음" : ""}</span></div></div>`;
  }).join("") : "";
  // 화면 띠는 남는 높이만큼 커진다(큰 단추 · 아래 칸은 맨 아래로) — 그림 너비를 띠 높이에 맞춤
  const sh = strip.clientHeight - 14 - 36;
  const cw = Math.round(Math.max(168, Math.min(560, sh * 16 / 9)));
  $$(".tcell", strip).forEach((el) => {
    const i = +el.dataset.i;
    el.style.width = cw + "px";
    drawInto($(".thumb", el), it, it.slides[i]);
    // 누르면 ‘다음’에, 0.5초 길게 누르면 바로 내보내기
    let t = null, fired = false;
    el.onmousedown = () => { fired = false; el.classList.add("pressing"); t = setTimeout(() => { fired = true; el.classList.remove("pressing"); goLive({ item: si, slide: i }); }, 500); };
    el.onmouseup = el.onmouseleave = () => { clearTimeout(t); el.classList.remove("pressing"); };
    el.onclick = () => { if (!fired) cue({ item: si, slide: i }); };
    const gb = $(".golive", el); if (gb) { gb.onmousedown = (e) => e.stopPropagation(); gb.onclick = (e) => { e.stopPropagation(); goLive({ item: si, slide: i }); }; }
  });
  const cur = $(".tcell.live", strip) || $(".tcell.cue", strip);
  if (cur) cur.scrollIntoView({ block: "nearest", inline: "center" });

  // 큰 단추 상태
  $("#bBlack").classList.toggle("active", WF.flags.black);
  $("#bClear").classList.toggle("active", WF.flags.clear);
  $("#bLogo").classList.toggle("active", WF.flags.logo);
  $("#bCam").classList.toggle("active", !!WF.flags.cam);
  $("#bEmerg").classList.toggle("active", WF.flags.emergency);
  $("#bNext").disabled = !WF.cue && !nextPos(WF.live);
  $("#bPrev").disabled = !prevPos(WF.live);

  const ov = $("#ovToggle");
  ov.innerHTML = `<i class="swi"></i>생중계 자막`; ov.title = WF.overlayOn === false ? "지금 꺼짐 — 누르면 켬" : "지금 켜짐 — 누르면 끔";
  ov.classList.toggle("off", WF.overlayOn === false);
  const lm = liveMediaAt(WF.live), mb = $("#mediaLiveBtn");
  mb.classList.toggle("hidden", !lm);
  if (lm) { const on = mediaLiveOn(lm.it, lm.file); mb.textContent = on ? `${lm.video ? "영상" : "그림"} 생중계에서 거두기` : `${lm.video ? "영상" : "그림"} 생중계에도 ▶`; mb.classList.toggle("primary", !on); }
  $$("#stageQuick .jbtn").forEach((b) => b.classList.toggle("on", !!WF.stageMsg && b.textContent === WF.stageMsg));
  renderJumps();
  tickClock();
}

// 바로 가기: 찬양이면 부분(1절 · 후렴), 설교면 제목 · 요점 · 구절
function renderJumps() {
  const p = WF.live || WF.cue;
  const it = itemAt(p);
  const box = $("#jumpBtns");
  let btns = [];
  if (it && it.kind === "song") {
    $("#jumpTitle").textContent = "찬양 부분";
    $("#jumpHint").textContent = "누르면 바로 나갑니다 · 단축키도 같음";
    const seen = new Set();
    it.slides.forEach((s, i) => {
      if (!s.secFirst || !s.section || seen.has(s.section)) return;
      seen.add(s.section);
      const key = Render.sectionKey(s.section);
      btns.push(`<button class="jbtn" data-sec="${esc(key)}" data-i="${i}">${esc(s.section)}${key ? `<kbd>${key}</kbd>` : ""}</button>`);
    });
  } else if (it && it.kind === "sermon") {
    $("#jumpTitle").textContent = "설교 중 띄울 구절";
    $("#jumpHint").textContent = "미리 준비 · 누르면 ‘다음’에";
    const seen = new Set();
    it.slides.forEach((s, i) => {
      if (!s.group || seen.has(s.group)) return;
      seen.add(s.group);
      btns.push(`<button class="jbtn" data-i="${i}">${esc(s.group)}</button>`);
    });
  } else {
    $("#jumpTitle").textContent = "바로 가기";
    $("#jumpHint").textContent = "찬양 · 설교 항목에서 부분 단추가 나옵니다";
  }
  box.innerHTML = btns.join("") || `<span class="muted small">이 항목에는 바로 가기가 없습니다.</span>`;
  const idx = WF.svc.items.indexOf(it);
  $$(".jbtn", box).forEach((b) => (b.onclick = () => {
    const i = +b.dataset.i;
    if (it.kind === "song") goLive({ item: idx, slide: i });
    else cue({ item: idx, slide: i });
  }));
}

function fmt(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? h + ":" : "") + String(m).padStart(2, "0") + ":" + String(x).padStart(2, "0");
}
function tickClock() {
  if (WF.mode !== "live") return;
  const now = Date.now();
  $("#tService").textContent = WF.serviceStart ? fmt(now - WF.serviceStart) : "-";
  const it = itemAt(WF.live);
  const el = $("#tItem");
  if (it && WF.itemStart) {
    const used = now - WF.itemStart, plan = (+it.minutes || 0) * 60000;
    el.textContent = fmt(used) + (plan ? " / " + fmt(plan) : "");
    el.className = plan && used > plan ? "over" : plan && used > plan * 0.8 ? "near" : "";
  } else el.textContent = "-";
  const d = new Date();
  $("#tClock").textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
setInterval(tickClock, 1000);

// 빠른 구절: 지금 항목 바로 뒤에 ‘구절’ 항목을 만들어 ‘다음’에 올린다(예배 기록에도 남음)
async function quickVerse(given) {
  const inp = $("#quickRef"), msg = $("#quickMsg");
  const ref = (typeof given === "string" ? given : inp.value).trim(); if (!ref) return;
  const refs = Bible.parseRef(ref);
  if (!refs.length) { msg.textContent = "장절을 알아볼 수 없습니다 (예: 요 13:34)"; return; }
  await loadBible(WF.lib.settings.defaultBible);
  const it = { id: uid("i"), kind: "scripture", title: "구절 · " + Bible.refsLabel(refs, true), minutes: 0, scripture: { ref, bibleId: "", split: "fit" }, slides: [], quick: true };
  it.slides = buildSlides(it);
  if (!it.slides.length) { msg.textContent = it.error || "본문이 없습니다"; return; }
  const at = (WF.live ? WF.live.item : WF.cue ? WF.cue.item - 1 : -1) + 1;
  WF.svc.items.splice(at, 0, it);
  if (WF.cue && WF.cue.item >= at) WF.cue.item++;
  WF.undo = [];
  markDirty("svc");
  cue({ item: at, slide: 0 });
  msg.textContent = `‘${it.title}’ 화면 ${it.slides.length}장을 다음에 올렸습니다. → 를 누르면 나갑니다.`;
  inp.value = ""; inp.blur();
}

(function wireLive() {
  $("#bPrev").onclick = prev;
  $("#bNext").onclick = next;
  $("#bBlack").onclick = () => toggleFlag("black");
  $("#bClear").onclick = () => toggleFlag("clear");
  $("#bLogo").onclick = () => toggleFlag("logo");
  $("#bCam").onclick = () => toggleFlag("cam");
  $("#bEmerg").onclick = () => toggleFlag("emergency");
  // 단추를 누른 뒤에도 키보드(→)가 단추에 걸리지 않게
  $$(".bb").forEach((b) => b.addEventListener("mouseup", () => b.blur()));
  $("#rehearsal").onchange = (e) => {
    WF.rehearsal = e.target.checked;
    if (!WF.rehearsal) sendLive();
    else Store.setLive(Object.assign(liveState(), { slide: null, flags: { logo: true } })).catch(() => {});
    renderLive(); updateFlagChip();
  };
  $("#barKick").onclick = () => kickBar();
  $("#mediaLiveBtn").onclick = () => { const lm = liveMediaAt(WF.live); if (!lm) return; toggleMediaLive(lm.it, lm.file); markDirty("svc"); sendLive(); renderLive(); };
  $("#ovToggle").onclick = () => { WF.overlayOn = WF.overlayOn === false; sendLive(); renderLive(); };
  const sendMsg = (m) => { WF.stageMsg = m; $("#stageMsg").value = m; sendLive(); renderLive(); };
  $("#stageMsgGo").onclick = () => { sendMsg($("#stageMsg").value.trim()); $("#stageMsg").blur(); };
  $("#stageMsg").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("#stageMsgGo").click(); } });
  $$("#stageQuick .jbtn").forEach((b) => (b.onclick = () => sendMsg(b.classList.contains("clear") ? "" : b.textContent)));
  $("#quickGo").onclick = () => quickVerse();
  $("#quickRef").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); quickVerse(); } });
})();
