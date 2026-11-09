// 예배 전 점검 — 빠진 것 · 넘치는 화면 · 빠진 파일 · 화면 연결을 한 번에. ‘주의’는 무시하고 시작할 수 있다.
async function runCheck() {
  const rows = [];
  const add = (level, text, go) => rows.push({ level, text, go });
  const st = WF.lib.settings;
  await saveNow();
  add("ok", "예배 자료 저장됨");

  // 예배당 화면
  await refreshMonitors();
  const other = WF.monitors.filter((m) => !m.primary);
  if (!WF.projOn) add("warn", other.length ? "예배당 화면이 꺼져 있습니다 — 위의 ‘예배당 화면 켜기’" : "예배당 화면이 꺼져 있습니다. 두 번째 모니터(분배기)도 연결되어 있지 않습니다");
  else if (!WF.projMonitor) add("warn", "예배당 화면이 ‘창으로 보기’입니다 — 두 번째 모니터를 연결하고 설정에서 고르세요");
  else if ((WF.monitors.find((m) => m.name === WF.projMonitor) || {}).primary) add("bad", "예배당 화면이 조작 화면(주 모니터)에 떠 있습니다 — 성도에게 조작 화면이 보일 수 있습니다");
  else add("ok", `예배당 화면 · ${monName(WF.projMonitor)}에 연결됨`);
  if (WF.projMissing) add("bad", "예배당 모니터가 빠졌습니다 — 분배기 · 케이블 확인");

  // 성경
  if (st.defaultBible === Samples.SAMPLE_BIBLE.id) add("warn", "성경 역본이 시험용 몇 구절뿐입니다 — 보관함 → 성경 역본에서 교회 성경 파일을 불러오세요", () => { WF.libTab = "bibles"; setMode("library"); });

  // 순서 항목
  const probe = document.createElement("div");
  Object.assign(probe.style, { position: "fixed", left: "-30000px", top: 0, visibility: "hidden" });
  document.body.appendChild(probe);
  let slides = 0, over = 0, missing = 0;
  for (let i = 0; i < WF.svc.items.length; i++) {
    const it = WF.svc.items[i];
    const goto = () => { WF.sel = { item: i, slide: 0 }; setMode("prep"); };
    if (it.error) add("warn", `‘${it.title}’ — ${it.error}`, goto);
    else if (!it.slides.length) add("warn", `‘${it.title}’ — 화면이 없습니다(예배 중에 건너뜀)`, goto);
    if (it.carried) add("warn", `‘${it.title}’ — 지난주 내용이 그대로 있어요(새로 고르거나 ‘이번 주도 똑같이 쓰기’)`, goto);
    if (it.kind === "prayer" && !(it.prayer || {}).name) add("warn", `‘${it.title}’ — 기도하시는 분 이름이 비어 있습니다`, goto);
    if (it.kind === "sermon" && !(it.sermon || {}).title) add("warn", `‘${it.title}’ — 설교 제목이 비어 있습니다`, goto);
    for (let k = 0; k < it.slides.length; k++) {
      const s = it.slides[k];
      slides++;
      if (s.kind === "media" && s.mediaFile && !(await Store.mediaExists(s.mediaFile))) {
        missing++; add("bad", `‘${it.title}’ ${k + 1}번 화면 — 그림 · 영상 파일이 없습니다(${s.mediaName || s.mediaFile})`, () => { WF.sel = { item: i, slide: k }; setMode("prep"); });
      }
      if (s.kind === "text" || s.kind === "media") {
        const r = Render.draw(probe, resolveSlide(it, s), themeOf(it), {});
        if (r.overflow) { over++; add("warn", `‘${it.title}’ ${k + 1}번 화면 — 글이 길어 넘칩니다(나누기 권함)`, () => { WF.sel = { item: i, slide: k }; setMode("prep"); }); }
      }
    }
  }
  probe.remove();
  add("ok", `화면 ${slides}장 확인 — 넘침 ${over} · 빠진 파일 ${missing}`);

  // 대기 · 긴급 · 출력
  if (!st.logoMedia) add("info", "교회 로고 그림이 없습니다 — 로고 · 대기 화면에 글만 나옵니다", () => setMode("settings"));
  add(st.emergencyText || st.emergencyMedia ? "ok" : "warn", "긴급 대기(F9) 화면 준비됨");
  add("info", WF.overlayOn === false ? "생중계 자막(OBS) 꺼짐" : "생중계 자막(OBS) 켜짐 — OBS에 브라우저 소스로 넣었는지 확인");
  const info = await Store.serverInfo().catch(() => null);
  if (info) add("info", info.stageOn ? `강단 페이지 켜짐 · 번호 ${info.code}` : "강단 페이지 꺼짐(쓰지 않으면 그대로 두세요)");
  if (WF.lib.settings.lumaMode) add("info", "루마키 모드 켜짐 — 예배당 화면도 검은 바탕 · 아래쪽 글자입니다");
  add("info", "유튜브 스튜디오 · 소리는 사람이 직접 확인하세요");
  return rows;
}

async function showCheck() {
  modal(`<h3>예배 전 점검</h3><div id="ckList" class="cklist"><div class="muted">확인하는 중…</div></div><div class="mfoot"><button class="btn" id="ckAgain">다시 확인</button><button class="btn primary" data-close>닫기</button></div>`, async (box, close) => {
    const fill = async () => {
      const rows = await runCheck();
      const icon = { ok: "✓", warn: "!", bad: "✕", info: "i" };
      const order = { bad: 0, warn: 1, info: 2, ok: 3 };
      rows.sort((a, b) => order[a.level] - order[b.level]);
      const bad = rows.filter((r) => r.level === "bad").length, warn = rows.filter((r) => r.level === "warn").length;
      $("#ckList", box).innerHTML = `<div class="cksum ${bad ? "bad" : warn ? "warn" : "ok"}">${bad ? `꼭 고칠 것 ${bad}개` : warn ? `주의 ${warn}개 — 확인하고 시작할 수 있습니다` : "준비 끝 — 문제를 찾지 못했습니다"}</div>` +
        rows.map((r, i) => `<div class="ckrow ${r.level}"><span class="ckicon">${icon[r.level]}</span><span class="cktext">${esc(r.text)}</span>${r.go ? `<button class="btn sm" data-go="${i}">가기</button>` : ""}</div>`).join("");
      $$("[data-go]", box).forEach((b) => (b.onclick = () => { close(); rows[+b.dataset.go].go(); }));
    };
    $("#ckAgain", box).onclick = fill;
    fill();
  });
}
$("#checkBtn").onclick = showCheck;

// 도움말 — 단축키와 매주 쓰는 순서(자세한 것은 배포/WorshipFlow_사용법)
function showHelp() {
  const k = (keys, text) => `<div class="hrow"><span>${keys.split(" ").map((x) => `<kbd>${x}</kbd>`).join(" ")}</span><span>${text}</span></div>`;
  modal(`<h3>도움말</h3><div class="help">
    <div><b>예배 중 단추</b>
      ${k("→ Space", "다음 화면 (클리커도 됨)")}${k("←", "이전 화면")}${k("↓ ↑", "다음 · 이전 순서를 ‘다음’에 올림")}
      ${k("B", "검은 화면 (다시 B = 돌아오기)")}${k("C", "글만 지우기")}${k("L", "로고 · 대기 화면")}${k("F9", "긴급 대기 (OBS 긴급 장면도)")}
      ${k("1 2 3", "찬양 1 · 2 · 3절")}${k("R", "후렴 (부르는 중이면 후렴 처음으로)")}${k("G", "브리지")}${k("⌘Z", "방금 넘긴 것 되돌리기")}${k("Esc", "글 칸에서 빠져나오기")}
      <p class="muted small">순서 · 화면을 누르면 ‘다음’에만 올라갑니다. 화면에 마우스를 올리면 나오는 <b>바로 내보내기 ▶</b>(또는 0.5초 길게 누르기)는 바로 나갑니다.</p>
      <b>새로 생긴 것</b><p class="muted small">· 준비 화면 아래 <b>‘이 순서 꾸미기’</b> 탭: 화면 글 · 모양 · 순서 자막바 · 제목 화면 · 그림 · 소리(열린 탭을 다시 누르면 접힘)<br>
      · <b>제목 화면</b>: 순서 맨 앞 전체 화면 한 장 — 글 줄 · 자리 9칸 · 끌어 옮기기 · 영상 바탕<br>
      · <b>순서 자막바 글</b>: 큰 글 · 옆 글 · 위쪽 작은 글 · 배열 · 길게<br>
      · <b>미리보기에서 바로 고치기</b>: 준비 화면 ① 미리보기의 글을 두 번 누르면 그 자리에서 고치고, 끌면 옮겨짐<br>
      · 설정은 왼쪽 목차(화면 · 생중계 · 카메라 · 손에 드는 것 · 교회 · 조작 창 · 자료)</p></div>
    <div><b>매주 준비</b><ol>
      <li>위쪽 예배 이름 → <b>지금 예배 복제 (다음 주일로)</b></li>
      <li><span class="carried">지난주</span> 표시 항목을 이번 주 내용으로 (찬양 · 본문 · 설교 · 기도 · 광고)</li>
      <li>화면을 눌러 아래 ‘화면 글’에서 고치기(쓰는 대로 바로 반영). 노란 테두리 = 글이 넘침</li>
      <li>위쪽 <b>점검</b> → 예배당 화면 켜기 → <b>예배 중</b></li></ol>
      <b>성경</b><p class="muted small">장절은 요 13:1-5 · 요한복음 13장 1절 · ㅇㅎ 3:16 · 시 23 처럼. 교회 성경 파일은 보관함 → 성경 역본.</p>
      <b>찬양</b><p class="muted small">보관함 → 찬양 · 곡. 빈 줄 = 화면 나눔, [1절] [후렴] = 부분 이름. 파워포인트 파일도 가져올 수 있습니다.</p></div>
  </div><div class="mfoot"><button class="btn primary" data-close>닫기</button></div>`);
}
$("#helpBtn").onclick = showHelp;

// 예배 순서표 — 방송 봉사자용(항목 · 예상 시간 · 화면 수 · 곡 부분 · 운영 메모). 저장하면 브라우저로 열려 인쇄할 수 있다.
function cueSheetHtml() {
  const svc = WF.svc;
  let t = 0;
  const rows = svc.items.map((it, i) => {
    const start = t; t += +it.minutes || 0;
    const k = KINDS[it.kind] || KINDS.text;
    let detail = "";
    if (it.kind === "song") { const seen = []; it.slides.forEach((s) => { if (s.secFirst && s.section && !seen.includes(s.section)) seen.push(s.section); }); const song = WF.lib.songs.find((x) => x.id === (it.song || {}).songId); detail = (song ? song.title : "곡 없음") + (seen.length ? " — " + seen.join(" · ") : ""); }
    else if (it.kind === "scripture") detail = (it.scripture || {}).ref || "";
    else if (it.kind === "sermon") { const s = it.sermon || {}; detail = [s.title, s.ref, s.preacher].filter(Boolean).join(" · ") + ((s.verses || []).length ? " / 띄울 구절: " + s.verses.join(", ") : ""); }
    else if (it.kind === "prayer") detail = [(it.prayer || {}).role, (it.prayer || {}).name].filter(Boolean).join(" ");
    else if (it.kind === "fixed") { const f = WF.lib.fixed.find((x) => x.id === (it.fixed || {}).fixedId); detail = f ? f.name : ""; }
    else if (it.kind === "media") detail = `그림 · 영상 ${((it.media || {}).files || []).length}개` + ((it.media || {}).auto ? ` · ${(it.media || {}).auto}초마다 넘김` : "");
    return `<tr><td class="n">${i + 1}</td><td class="tm">${start ? "+" + start + "분" : "시작"}</td><td><b>${esc(it.title)}</b><div class="k">${esc(k.name)}</div></td><td>${esc(detail)}</td><td class="n">${it.slides.length}</td><td class="n">${it.minutes || ""}</td><td class="memo">${esc(it.note || "")}</td></tr>`;
  }).join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(svc.title)} 순서표 ${esc(svc.date)}</title>
<style>body{font-family:-apple-system,"Apple SD Gothic Neo",sans-serif;margin:28px;color:#111}h1{font-size:22px;margin:0 0 4px}.sub{color:#555;margin-bottom:16px}
table{width:100%;border-collapse:collapse;font-size:13.5px}th,td{border-bottom:1px solid #ccc;padding:7px 6px;text-align:left;vertical-align:top}th{background:#f2f2f2}
.n{text-align:center;width:40px}.tm{width:60px;color:#555}.k{color:#777;font-size:11.5px}.memo{color:#a35b00;font-weight:600}
.keys{margin-top:18px;font-size:12px;color:#444}kbd{border:1px solid #999;border-radius:4px;padding:0 4px;font-size:11px}@media print{body{margin:10mm}}</style></head><body>
<h1>${esc(svc.title)} — 순서표</h1><div class="sub">${esc(dateLabel(svc.date))} · ${svc.items.length}개 · 약 ${t}분 · WorshipFlow</div>
<table><tr><th>#</th><th>시간</th><th>순서</th><th>내용</th><th>화면</th><th>분</th><th>운영 메모</th></tr>${rows}</table>
<div class="keys"><kbd>→</kbd> 다음 · <kbd>←</kbd> 이전 · <kbd>B</kbd> 검은 화면 · <kbd>C</kbd> 글 지우기 · <kbd>L</kbd> 로고 · <kbd>F9</kbd> 긴급 대기 · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 절 · <kbd>R</kbd> 후렴 · <kbd>G</kbd> 브리지 · <kbd>⌘Z</kbd> 되돌리기</div>
</body></html>`;
}
async function saveCueSheet() {
  const html = cueSheetHtml();
  if (!Store.inApp) { const w = window.open(); if (w) { w.document.write(html); w.document.close(); } return; }
  const dest = await Store.pickSave({ title: "순서표 저장", defaultPath: `순서표_${WF.svc.date}_${WF.svc.title}.html`, filters: [{ name: "웹 문서", extensions: ["html"] }] });
  if (!dest) return;
  try { await Store.writeUserFile(dest, html); await window.__TAURI__.core.invoke("open_html", { path: dest }); }
  catch (e) { Store.message("순서표를 저장하지 못했습니다: " + e); }
}
