// 화면에서 직접 고치기(파워포인트처럼) — 큰 화면 위에서 글을 두 번 눌러 고치고, 글 상자를 끌어 옮기고,
// 모서리로 크기를 바꾸고, 위 도구 줄로 글자 크기 · 강조색 · 정렬. 바꾼 것은 ‘이 화면만 / 이 순서 모두 / 같은 종류 모두’ 중에 씀.
const SE = { undo: [] };
const SE_SCOPES = [["slide", "이 화면만"], ["item", "이 순서 모두"], ["kind", "같은 종류 모두"]];

function seKindName(it) { return (KINDS[it.kind] || {}).name || "같은 종류"; }
// 지금 이 화면에 쓰이는 글 상자 모양(화면만 → 순서 → 종류 → 기본 순)
function seTheme(it, s) {
  const t = themeOf(it);
  if (s.tbox) t.box = s.tbox;
  if (s.tsize) t.size = s.tsize;
  if (s.talign) t.align = s.talign;
  return t;
}
function seDefaultBox(t) { const mx = 1920 * t.margin / 100, my = 1080 * t.margin / 100; return { x: Math.round(mx), y: Math.round(my), w: Math.round(1920 - 2 * mx), h: Math.round(1080 - 2 * my) }; }

function openStageEditor(itemIdx, slideIdx) {
  const it = WF.svc.items[itemIdx]; if (!it) return;
  SE.item = itemIdx; SE.slide = slideIdx; SE.undo = []; SE.scope = SE.scope || "item";
  WF.sel = { item: itemIdx, slide: slideIdx };
  modal(`<div class="se">
    <div class="se-left" id="seThumbs"></div>
    <div class="se-main">
      <div class="se-head"><b>화면에서 직접 고치기</b><span class="muted small" id="seWhat"></span><div class="grow"></div><button class="btn" data-close>닫기</button></div>
      <div class="se-bar" id="seBar"></div>
      <div class="se-hold" id="seHold"></div>
      <div class="se-foot"><span class="muted small">바꾼 것을 어디에 쓸까요?</span><span class="seg" id="seScope"></span>
        <button class="btn sm" id="seReset" title="끌어 옮긴 자리 · 크기를 처음대로">처음 자리로</button><button class="btn sm" id="seUndo">되돌리기 ⌘Z</button>
        <span class="muted small se-tip">글을 <b>두 번 누르면</b> 고치기 · <b>끌면</b> 옮기기 · <b>모서리</b>로 크기 · <b>Esc</b> 닫기</span><button class="btn primary" id="seDone">다 고쳤어요 · 닫기</button></div>
    </div>
    <div class="se-look" id="seLook"></div></div>`, (box, close) => {
    box.classList.add("wide");
    // 닫기: 위 ‘닫기’ · 아래 ‘다 고쳤어요’ · Esc · 바깥(어두운 곳) 누르기 — 맥 전체 화면에서도 닫을 수 있게
    const md = $("#modal"), look = $("#seLook"), panel = $("#dockEdit .panel.theme") || $(".panel.theme");
    SE.panel = panel; SE.home = panel && panel.parentNode;
    if (panel) { look.appendChild(panel); panel.hidden = false; }
    SE.open = true;
    SE.close = () => {
      if (!SE.open) return; seCommitText(); SE.open = false;
      if (SE.panel && SE.home) { SE.home.appendChild(SE.panel); }
      md.onclick = null; close(); if (WF.mode === "prep") renderPrep();
    };
    $$("[data-close]", box).forEach((b) => (b.onclick = SE.close));
    $("#seDone").onclick = SE.close;
    md.onclick = (e) => { if (e.target === md) SE.close(); };
    box.tabIndex = -1; box.onkeydown = seKey; setTimeout(() => box.focus(), 30);
    seRender();
  });
}
function seItem() { return WF.svc.items[SE.item]; }
function seSlide() { const it = seItem(); return it && it.slides[SE.slide]; }

function seRender() {
  const it = seItem(), s = seSlide(); if (!it || !s) return;
  // 왼쪽: 이 순서의 화면들
  const th = $("#seThumbs");
  th.innerHTML = it.slides.map((x, i) => `<div class="se-th ${i === SE.slide ? "on" : ""}" data-i="${i}"><div class="pv"></div><span>${esc(slideCaption(it, x, i))}</span></div>`).join("");
  $$(".se-th", th).forEach((el) => { const i = +el.dataset.i; drawInto($(".pv", el), it, it.slides[i]); el.onclick = () => { seCommitText(); SE.slide = i; WF.sel = { item: SE.item, slide: i }; seRender(); }; });
  if (typeof renderThemeForm === "function" && SE.panel) renderThemeForm();
  const cur = $(".se-th.on", th); if (cur) cur.scrollIntoView({ block: "nearest" });
  $("#seWhat").textContent = `${it.title} · ${SE.slide + 1}/${it.slides.length}`;
  $("#seScope").innerHTML = SE_SCOPES.map(([v, n]) => `<b data-v="${v}" class="${SE.scope === v ? "on" : ""}">${v === "kind" ? seKindName(it) + " 모두" : n}</b>`).join("");
  $$("#seScope b").forEach((b) => (b.onclick = () => { SE.scope = b.dataset.v; seRender(); }));
  $("#seUndo").onclick = seUndo; $("#seReset").onclick = () => seCommit({ box: null });
  const hold = $("#seHold");
  drawInto(hold, it, s);
  if (s.kind === "titlecard") return seTitleCard(hold, it, s);
  const ok = s.kind === "text";
  const t = seTheme(it, s);
  $("#seBar").innerHTML = ok ? `<span class="muted small">글자 크기</span><button class="btn sm" data-a="sz-">－</button><b class="se-sz">${t.size}</b><button class="btn sm" data-a="sz+">＋</button>
    <span class="se-sep"></span><button class="btn sm se-acc" data-a="acc" title="고친 글에서 고른 글자를 강조색으로">강조색</button>
    <span class="se-sep"></span><span class="seg"><b data-a="al-left" class="${t.align === "left" ? "on" : ""}">왼쪽</b><b data-a="al-center" class="${t.align !== "left" ? "on" : ""}">가운데</b></span>
    <span class="se-sep"></span><span class="muted small" id="seState"></span>`
    : `<span class="muted small">${s.kind === "titlecard" ? "제목 화면은 준비 화면 아래 ‘제목 화면’ 탭에서 고치고, 미리보기에서 끌어 옮깁니다." : "이 화면(설교 제목 · 기도 · 대기 · 그림)은 아래 칸에서 고칩니다. 여기서는 가사 · 성경 · 글 화면을 고칩니다."}</span>`;
  $$("#seBar [data-a]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); seAction(b.dataset.a); }));
  $$("#seBar [data-a]").forEach((b) => (b.onmousedown = (e) => e.preventDefault())); // 글 고치는 중에 눌러도 고른 글자가 풀리지 않게
  if (ok) seFrame(hold, it, s, t);
}

// 글 상자 테두리 · 손잡이 · 끌기 · 크기 · 안내선 · 두 번 눌러 고치기
function seFrame(hold, it, s, t) {
  const stage = hold.querySelector(".wf-stage"), boxEl = stage && stage.querySelector(".wf-box"), txt = stage && stage.querySelector(".wf-text");
  if (!boxEl) return;
  const k = () => hold.clientWidth / 1920;
  let b = t.box ? Object.assign({}, t.box) : seDefaultBox(t);
  const fr = document.createElement("div"); fr.className = "se-frame";
  fr.innerHTML = ["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((h) => `<i class="se-h" data-h="${h}"></i>`).join("") + `<div class="se-gv"></div><div class="se-gh"></div>`;
  stage.appendChild(fr);
  const place = () => { Object.assign(fr.style, { left: b.x + "px", top: b.y + "px", width: b.w + "px", height: b.h + "px" }); Object.assign(boxEl.style, { left: b.x + "px", top: b.y + "px", width: b.w + "px", height: b.h + "px", right: "auto", bottom: "auto" }); };
  place();
  const gv = fr.querySelector(".se-gv"), gh = fr.querySelector(".se-gh");
  const drag = (e, mode) => {
    if (SE.editing) return;
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, y0 = e.clientY, b0 = Object.assign({}, b), kk = k();
    const mv = (m) => {
      const dx = (m.clientX - x0) / kk, dy = (m.clientY - y0) / kk;
      if (mode === "move") { b.x = b0.x + dx; b.y = b0.y + dy; }
      else {
        if (mode.includes("e")) b.w = Math.max(240, b0.w + dx);
        if (mode.includes("s")) b.h = Math.max(120, b0.h + dy);
        if (mode.includes("w")) { b.w = Math.max(240, b0.w - dx); b.x = b0.x + b0.w - b.w; }
        if (mode.includes("n")) { b.h = Math.max(120, b0.h - dy); b.y = b0.y + b0.h - b.h; }
      }
      // 안내선: 가운데에 가까우면 딱 붙음
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const snapX = mode === "move" && Math.abs(cx - 960) < 16, snapY = mode === "move" && Math.abs(cy - 540) < 16;
      if (snapX) b.x = 960 - b.w / 2; if (snapY) b.y = 540 - b.h / 2;
      b.x = Math.max(-b.w / 2, Math.min(1920 - b.w / 2, b.x)); b.y = Math.max(-b.h / 2, Math.min(1080 - b.h / 2, b.y));
      gv.style.display = snapX ? "block" : "none"; gh.style.display = snapY ? "block" : "none";
      gv.style.left = (960 - b.x) + "px"; gh.style.top = (540 - b.y) + "px";
      place();
    };
    const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); gv.style.display = gh.style.display = "none";
      const r = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) };
      if (r.x !== b0.x || r.y !== b0.y || r.w !== b0.w || r.h !== b0.h) seCommit({ box: r }); };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
  };
  fr.onpointerdown = (e) => drag(e, e.target.dataset.h || "move");
  // 두 번 누르면 그 자리에서 글 고치기
  fr.ondblclick = (e) => {
    if (!txt) return;
    e.preventDefault(); SE.editing = true; fr.classList.add("editing");
    txt.contentEditable = "true"; txt.spellcheck = false; txt.focus();
    const sel = getSelection(), rg = document.createRange(); rg.selectNodeContents(txt); rg.collapse(false); sel.removeAllRanges(); sel.addRange(rg);
    const st = $("#seState"); if (st) st.textContent = "글 고치는 중 — 다 쓰면 바깥을 누르거나 Esc";
    txt.onblur = () => seCommitText();
    SE.txt = txt;
  };
}
// 화면 글(꾸민 글) → 앱 글: 강조색 글자는 **…**, 줄 바꿈 유지
function seTextOf(el) {
  let out = "";
  for (const n of el.childNodes) {
    if (n.nodeType === 3) out += n.textContent;
    else if (n.nodeName === "BR") out += "\n";
    else if (n.classList && n.classList.contains("wf-acc")) out += "**" + n.textContent + "**";
    else if (n.nodeName === "DIV" || n.nodeName === "P") out += (out && !out.endsWith("\n") ? "\n" : "") + seTextOf(n);
    else out += seTextOf(n);
  }
  return out;
}
function seCommitText() {
  const txt = SE.txt; if (!txt || !SE.editing) return;
  SE.editing = false; SE.txt = null; txt.contentEditable = "false"; txt.onblur = null;
  const v = seTextOf(txt).replace(/ /g, " ").replace(/\n{3,}/g, "\n\n").trim(), s = seSlide();
  if (s && v !== (s.text || "")) seCommit({ text: v }); else seRender();
}
function seAction(a) {
  const it = seItem(), s = seSlide(); if (!it || !s) return;
  const t = seTheme(it, s);
  if (a === "sz-" || a === "sz+") { seCommitText(); return seCommit({ size: Math.max(32, Math.min(140, t.size + (a === "sz+" ? 4 : -4))) }); }
  if (a === "al-left" || a === "al-center") { seCommitText(); return seCommit({ align: a.slice(3) }); }
  if (a === "acc") {
    const sel = getSelection(), word = sel ? String(sel).trim() : "";
    if (!SE.editing || !word) return Store.message("글을 두 번 눌러 고치는 중에, 강조할 글자를 고른 뒤 누르세요.");
    const txt = SE.txt; SE.editing = false; SE.txt = null; txt.contentEditable = "false"; txt.onblur = null;
    const v = seTextOf(txt).replace(/ /g, " ").trim(), i = v.indexOf(word);
    seCommit({ text: i < 0 ? v : v.slice(0, i) + "**" + word + "**" + v.slice(i + word.length) });
  }
}
// 바꾼 것 쓰기: 글은 늘 이 화면에, 자리 · 크기 · 정렬은 고른 범위에
function seCommit(ch) {
  const it = seItem(), s = seSlide(); if (!it || !s) return;
  const kind = it.kind, lib = WF.lib.themes;
  SE.undo.push({ slides: clone(it.slides), theme: it.theme ? clone(it.theme) : null, kt: lib[kind] ? clone(lib[kind]) : null, edited: it.edited });
  if (SE.undo.length > 40) SE.undo.shift();
  if ("text" in ch) { s.text = ch.text; it.edited = true; delete it.carried; }
  const look = {}; ["box", "size", "align"].forEach((k) => { if (k in ch) look[k] = ch[k]; });
  if (Object.keys(look).length) {
    if (SE.scope === "slide") {
      const map = { box: "tbox", size: "tsize", align: "talign" };
      for (const [k, v] of Object.entries(look)) { if (v == null) delete s[map[k]]; else s[map[k]] = v; }
      it.edited = true;
    } else {
      const tg = SE.scope === "kind" ? (lib[kind] = lib[kind] || {}) : (it.theme = it.theme || {});
      for (const [k, v] of Object.entries(look)) { if (v == null) delete tg[k]; else tg[k] = v; }
      // ‘처음 자리로’는 이 화면에 따로 둔 자리도 지움
      if ("box" in look && look.box == null) delete s.tbox;
    }
  }
  markDirty();
  seAfter(it, "size" in ch && SE.scope !== "slide");
}
function seAfter(it, resplit) {
  if (resplit && (it.kind === "scripture" || it.kind === "sermon") && !it.edited) { rebuild(it); if (SE.slide >= it.slides.length) SE.slide = it.slides.length - 1; }
  if (WF.live && WF.svc.items.indexOf(it) === WF.live.item) sendLive();
  seRender();
  if (WF.mode === "prep") { WF.sel = { item: SE.item, slide: SE.slide }; renderSlideGrid(); renderSelPreview(); }
  const st = $("#seState"); if (st) st.textContent = "✓ 바로 반영 · 저장됨";
}
function seUndo() {
  const it = seItem(), u = SE.undo.pop(); if (!it || !u) return;
  it.slides = u.slides; it.edited = u.edited;
  if (u.theme) it.theme = u.theme; else delete it.theme;
  if (u.kt) WF.lib.themes[it.kind] = u.kt; else delete WF.lib.themes[it.kind];
  if (u.tc) it.titleCard = u.tc;
  if (SE.slide >= it.slides.length) SE.slide = it.slides.length - 1;
  markDirty(); seAfter(it, false);
}
function seKey(e) {
  if (SE.editing) { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); seCommitText(); } return; }
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); return SE.close(); }
  if (e.target && e.target.closest && e.target.closest("input, select, textarea")) return; // 모양 칸에서 글을 쓰는 중
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.stopPropagation(); return seUndo(); }
  const it = seItem(), s = seSlide(); if (!it || !s) return;
  const d = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key];
  if (d && s.kind === "text") { e.preventDefault(); e.stopPropagation(); const t = seTheme(it, s), b = Object.assign({}, t.box || seDefaultBox(t)); b.x += d[0]; b.y += d[1]; seCommit({ box: b }); }
  if (e.key === "PageDown" || e.key === "PageUp") { e.preventDefault(); const n = SE.slide + (e.key === "PageDown" ? 1 : -1); if (it.slides[n]) { SE.slide = n; seRender(); } }
}

// 제목 화면: 줄을 눌러 고르고, 두 번 눌러 글 고치기, 끌어 옮기기, 위 도구 줄로 크기 · 모양 · 줄 더하기 · 빼기
const SE_ST = [["big", "큰 글"], ["who", "이름"], ["small", "작은 글"], ["word", "한마디"]];
function seTcLines(it) { const tc = (it.titleCard = it.titleCard || {}); if (!tc.lines || !tc.lines.length) tc.lines = clone(tcLines(it)); else tcLines(it); return tc.lines; } // 고치기 전까지는 순서를 따라감(push 때 손으로 고친 것으로)
function seTitleCard(hold, it, s) {
  const lines = seTcLines(it), sel = Math.min(SE.tcSel || 0, lines.length - 1), l = lines[sel] || {};
  $("#seBar").innerHTML = `<span class="muted small">고른 줄</span><b class="se-sz" style="min-width:0">‘${esc(String(l.t || "").slice(0, 14))}’</b>
    <select id="seTcSt">${SE_ST.map(([v, n]) => `<option value="${v}" ${l.st === v ? "selected" : ""}>${n}</option>`).join("")}</select>
    <span class="se-sep"></span><span class="muted small">크기</span><button class="btn sm" data-a="z-">－</button><b class="se-sz">${Math.round((l.z || 1) * 100)}%</b><button class="btn sm" data-a="z+">＋</button>
    <span class="se-sep"></span><button class="btn sm" data-a="add">+ 글 줄</button><button class="btn sm" data-a="del">줄 빼기</button><button class="btn sm" data-a="home" title="끌어 옮긴 자리를 처음대로">자리 처음대로</button>
    <span class="se-sep"></span><span class="muted small" id="seState">줄을 눌러 고르고 · 두 번 눌러 글 고치기 · 끌어 옮기기</span>`;
  const push = () => { SE.undo.push({ slides: clone(it.slides), theme: it.theme ? clone(it.theme) : null, kt: WF.lib.themes[it.kind] ? clone(WF.lib.themes[it.kind]) : null, edited: it.edited, tc: clone(it.titleCard) }); it.titleCard.custom = true; };
  const done = () => { markDirty("svc"); seAfter(it, false); };
  $("#seTcSt").onchange = (e) => { push(); l.st = e.target.value; done(); };
  $$("#seBar [data-a]").forEach((b) => (b.onclick = () => {
    const a = b.dataset.a; push();
    if (a === "z-" || a === "z+") l.z = Math.max(0.4, Math.min(2.5, Math.round(((l.z || 1) + (a === "z+" ? 0.1 : -0.1)) * 10) / 10));
    if (a === "add") { lines.push({ t: "새 글", st: "small", pos: l.pos || "mc" }); SE.tcSel = lines.length - 1; }
    if (a === "del" && lines.length > 1) { lines.splice(sel, 1); SE.tcSel = Math.max(0, sel - 1); }
    if (a === "home") { delete l.dx; delete l.dy; }
    done();
  }));
  const stage = hold.querySelector(".wf-stage"), k = () => hold.clientWidth / 1920;
  stage.querySelectorAll(".wf-tcl").forEach((el) => {
    const i = +el.dataset.tcl, ln = lines[i]; if (!ln) return;
    el.style.cursor = "move";
    if (i === sel) { el.style.outline = "6px solid #4c9bff"; el.style.outlineOffset = "14px"; }
    el.onpointerdown = (e) => {
      if (el.isContentEditable) return;
      e.preventDefault(); SE.tcSel = i;
      const x0 = e.clientX, y0 = e.clientY, dx0 = +ln.dx || 0, dy0 = +ln.dy || 0, base = el.style.transform.replace(/ translate\([^)]*\)$/, ""), kk = k();
      let moved = false;
      const mv = (m) => { const dx = (m.clientX - x0) / kk, dy = (m.clientY - y0) / kk; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; el.style.transform = `${base} translate(${Math.round(dx0 + dx)}px,${Math.round(dy0 + dy)}px)`; ln._dx = Math.round(dx0 + dx); ln._dy = Math.round(dy0 + dy); };
      const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up);
        if (moved) { push(); ln.dx = ln._dx; ln.dy = ln._dy; } delete ln._dx; delete ln._dy; done(); };
      document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
    };
    el.ondblclick = (e) => {
      e.preventDefault(); el.onpointerdown = null; el.contentEditable = "true"; el.style.cursor = "text"; el.focus();
      const r = document.createRange(); r.selectNodeContents(el); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r);
      SE.editing = true; SE.txt = null;
      el.onkeydown = (ev) => { if (ev.key === "Enter") { ev.preventDefault(); el.blur(); } };
      el.onblur = () => { SE.editing = false; const v = el.innerText.replace(/\n+/g, " ").trim(); if (v && v !== ln.t) { push(); ln.t = v; } done(); };
    };
  });
}
