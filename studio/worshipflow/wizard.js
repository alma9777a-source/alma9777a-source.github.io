// 장비 연결 도우미 — 교회마다 다른 장비를 고르면 그에 맞는 단계만. 자동으로 되는 것(ATEM USB 카메라 · OBS)은 단추 하나로,
// 그 밖의 제품(Roland · Ecamm · Wirecast · vMix …)은 공통 방식(자막 주소 · 카메라 장치)과 안내로.
// 고른 것은 설정(rig)에 남고, ‘장비 구성 파일’로 다른 맥 · 다른 교회에 옮길 수 있다(비밀번호는 넣지 않음).
const WZ = { step: 1, obsLog: [] };
const RIG_CHOICES = {
  screens: [["one", "TV · 프로젝터 1대", "앞에만"], ["two", "2대 (같은 화면)", "분배기로 앞 · 뒤"], ["stage", "＋ 강단 화면", "설교자용 따로(뒤쪽 모니터)"], ["unknown", "모름 · 기타", "화면 찾기로 알아보기"]],
  switcher: [["atem", "Blackmagic ATEM", "Mini · Pro · Extreme", "auto"], ["roland", "Roland", "V-1HD · V-8HD · V-160HD", "man"], ["capture", "캡처 장치만", "Cam Link · Magewell · AVerMedia", "auto"], ["none", "카메라 없음", "자막만 쓰기"]],
  stream: [["obs", "OBS", "무료 · 가장 많이 씀", "auto"], ["other", "Ecamm · Wirecast · vMix", "자막 주소만 넣으면 됨", "man"], ["switcher", "전환기에서 바로", "ATEM 자체 생중계", "man"], ["none", "생중계 안 함", "예배당 화면만"]],
};
const WZ_STEPS = ["우리 교회 장비", "화면 (TV · 모니터)", "카메라 · 전환기", "생중계 프로그램", "점검"];
function rig() { const st = WF.lib.settings; st.rig = Object.assign({ screens: "two", switcher: "atem", stream: "obs" }, st.rig || {}); return st.rig; }

function openWizard(step) {
  WZ.step = step || 1;
  let el = document.getElementById("wizard");
  if (!el) { el = document.createElement("div"); el.id = "wizard"; el.className = "wz"; document.body.appendChild(el); }
  el.classList.remove("hidden");
  refreshMonitors().then(() => camDevices()).then(renderWizard);
  renderWizard();
}
function closeWizard() { const el = document.getElementById("wizard"); if (el) el.classList.add("hidden"); if (WF.mode === "settings") renderSettings(); }

function renderWizard() {
  const el = document.getElementById("wizard"); if (!el || el.classList.contains("hidden")) return;
  const s = WZ.step;
  el.innerHTML = `<div class="wzwin">
    <div class="wzbar"><b>장비 연결 도우미</b><span class="tag">${esc(WF.lib.settings.churchName || "")}</span><div class="grow"></div><button class="btn sm" id="wzClose">닫기 ✕</button></div>
    <div class="wzbody">
      <div class="wzsteps">${WZ_STEPS.map((n, i) => `<button class="wzst ${i + 1 === s ? "on" : i + 1 < s ? "done" : ""}" data-s="${i + 1}"><i>${i + 1 < s ? "✓" : i + 1}</i>${esc(n)}</button>`).join("")}</div>
      <div class="wzmain" id="wzMain"></div>
    </div></div>`;
  $("#wzClose", el).onclick = closeWizard;
  $$(".wzst", el).forEach((b) => (b.onclick = () => { WZ.step = +b.dataset.s; renderWizard(); }));
  [wzRig, wzScreens, wzCamera, wzStream, wzCheck][s - 1]($("#wzMain", el));
}
function wzFoot(box, html) {
  const f = document.createElement("div"); f.className = "wzfoot";
  f.innerHTML = (WZ.step > 1 ? `<button class="btn" id="wzPrev">◀ 이전</button>` : "") + `<div class="grow"></div>` + html +
    (WZ.step < 5 ? `<button class="btn primary" id="wzNext">다음 — ${esc(WZ_STEPS[WZ.step])} ▶</button>` : `<button class="btn primary" id="wzDone">끝내기</button>`);
  box.appendChild(f);
  const p = $("#wzPrev", f); if (p) p.onclick = () => { WZ.step--; renderWizard(); };
  const n = $("#wzNext", f); if (n) n.onclick = () => { WZ.step++; renderWizard(); };
  const d = $("#wzDone", f); if (d) d.onclick = closeWizard;
}

/* 1. 우리 교회 장비 */
function wzRig(box) {
  const r = rig();
  const grp = (key, title) => `<div class="wzgrp"><div class="t">${title}</div><div class="wzopts">${RIG_CHOICES[key].map(([v, n, d, a]) => `<button class="wzopt ${r[key] === v ? "sel" : ""}" data-k="${key}" data-v="${v}"><b>${esc(n)}</b><span>${esc(d)}</span>${a ? `<em class="${a}">${a === "auto" ? "자동 설정" : "안내"}</em>` : ""}</button>`).join("")}</div></div>`;
  box.innerHTML = `<h2>어떤 장비를 쓰시나요?</h2><div class="hint">모르시면 ‘모름 · 기타’를 고르세요. 나중에 언제든 바꿀 수 있습니다.</div>` +
    grp("screens", "예배당 화면") + grp("switcher", "카메라 · 영상 전환기") + grp("stream", "생중계 프로그램");
  $$(".wzopt", box).forEach((b) => (b.onclick = () => { r[b.dataset.k] = b.dataset.v; markDirty("lib"); renderWizard(); }));
  wzFoot(box, `<button class="btn" id="wzSave">장비 구성 파일로 저장</button><button class="btn" id="wzLoad">불러오기</button>`);
  $("#wzSave", box).onclick = saveRigFile; $("#wzLoad", box).onclick = loadRigFile;
}

/* 2. 화면 */
function wzScreens(box) {
  const st = WF.lib.settings, ms = WF.monitors;
  const role = (m) => (m.primary ? "control" : st.projMonitor === m.name ? "proj" : st.stageMonitor === m.name ? "stage" : "none");
  box.innerHTML = `<h2>화면 (TV · 모니터)</h2><div class="hint">이 맥에 꽂힌 화면입니다. 화면마다 할 일을 고르세요. 헷갈리면 ‘이름 붙이기’로 우리 이름을 붙이세요.</div>` +
    (ms.length < 2 ? `<div class="wzwarn">맥이 화면을 하나만 봅니다. TV에 맥 화면이 똑같이 나오면 ‘미러링’입니다 → 시스템 설정 → 디스플레이 → TV → ‘확장 디스플레이’. TV에 아무것도 안 나오면 HDMI 선 · TV 입력을 확인하세요.</div>` : "") +
    ms.map((m) => `<div class="wzck"><span class="s ${m.primary ? "no" : role(m) === "none" ? "warn" : "ok"}">${m.primary ? "⌘" : role(m) === "none" ? "?" : "✓"}</span>
      <div class="tx"><b>${esc(monNick(m) || monBase(m))}</b><span>${monNick(m) ? esc(monBase(m)) + " · " : ""}${m.width}×${m.height}</span></div>
      ${m.primary ? `<span class="tag">조작 화면</span>` : `<select data-m="${esc(m.name)}"><option value="none">안 씀</option><option value="proj" ${role(m) === "proj" ? "selected" : ""}>예배당 화면 (성도용 TV)</option><option value="stage" ${role(m) === "stage" ? "selected" : ""}>강단 화면 (설교자용)</option></select>`}
      <button class="btn sm" data-nick="${esc(m.name)}">이름 붙이기</button></div>`).join("") +
    (rig().screens === "stage" && !st.stageMonitor ? `<div class="wzwarn">강단 화면용 모니터가 따로 없습니다. 맥미니 M2 기본형은 화면 2대까지라 DisplayLink 어댑터가 필요합니다. 어댑터 없이 태블릿 · 스마트 TV 브라우저로 ‘강단 페이지’를 열 수도 있습니다(설정 → 강단 페이지 · 태블릿).</div>` : "");
  $$("select[data-m]", box).forEach((sel) => (sel.onchange = () => {
    const k = sel.dataset.m;
    if (st.projMonitor === k) st.projMonitor = ""; if (st.stageMonitor === k) st.stageMonitor = "";
    if (sel.value === "proj") st.projMonitor = k; if (sel.value === "stage") st.stageMonitor = k;
    markDirty("lib"); renderWizard();
  }));
  $$("[data-nick]", box).forEach((b) => (b.onclick = async () => {
    const m = ms.find((x) => x.name === b.dataset.nick);
    const t = await prompt2(`이 화면 이름 (${monBase(m)}) — 예: 예배당 TV · 뒤쪽 모니터`, monNick(m)); if (t == null) return;
    st.monitorNick = Object.assign({}, st.monitorNick || {}, { [m.name]: t.trim() }); if (!t.trim()) delete st.monitorNick[m.name];
    markDirty("lib"); renderWizard();
  }));
  wzFoot(box, `<button class="btn" id="wzTv">TV에 예배당 화면 띄워 보기</button>`);
  $("#wzTv", box).onclick = () => projectionOn().then(renderWizard);
}

/* 3. 카메라 · 전환기 */
function wzCamera(box) {
  const r = rig(), st = WF.lib.settings;
  const cams = (Cam.devs || []).filter((d) => d.label);
  const guide = {
    atem: `<ol><li>ATEM <b>USB-C → 이 맥</b> (맥에서 카메라 ‘Blackmagic Design’으로 잡힘)</li><li>본체 <b>오른쪽 위 출력 = WorshipFlow가 꽂힌 번호(보통 2)</b> → 예배당 TV는 늘 WorshipFlow</li><li><b>왼쪽 전환 = 카메라(1)</b>에 두기 — 찬양 · 성경은 WorshipFlow가 생중계에 화면 가득, 기도 · 설교는 카메라 + 띠로 알아서 바꿉니다</li><li>ATEM에 <b>랜선</b>을 꽂아 교회 공유기에 연결하면 다음 판에서 출력 · 전환을 WorshipFlow가 저절로 맞춥니다(준비 중)</li></ol>`,
    roland: `<ol><li>Roland 출력(PGM)을 <b>캡처 장치(USB)</b>로 이 맥에 넣으면 카메라로 잡힙니다</li><li>WorshipFlow 예배당 화면(TV 쪽 HDMI)을 Roland 입력 하나에 넣기</li><li>전환은 Roland 단추로 — 생중계 자막 · 화면 가득은 WorshipFlow가 알아서</li></ol>`,
    capture: `<ol><li>카메라 HDMI → 캡처 장치 → 이 맥 USB</li><li>아래 목록에서 그 장치를 고르면 미리보기 · 예배당 TV 카메라(기도 · 설교 때)에 씁니다</li></ol>`,
    none: `<div class="hint">카메라 없이 예배당 화면과 생중계 자막만 씁니다. 기도 · 설교 때 TV는 예전 이름 · 제목 화면.</div>`,
  }[r.switcher] || "";
  box.innerHTML = `<h2>카메라 · 전환기</h2><div class="hint">${esc((RIG_CHOICES.switcher.find((x) => x[0] === r.switcher) || [])[1] || "")}</div>${guide}` +
    (r.switcher !== "none" ? `<div class="wzck"><span class="s ${Cam.stream ? "ok" : "warn"}">${Cam.stream ? "✓" : "!"}</span><div class="tx"><b>${Cam.stream ? "카메라 보는 중: " + esc(Cam.label) : "카메라를 찾지 못했습니다"}</b><span>${Cam.stream ? "준비 화면 ② 칸 · 기도 · 설교 때 예배당 TV에 씁니다" : "USB 연결을 확인하거나 아래에서 고르세요. 처음이면 카메라 허용 창이 뜹니다."}</span></div>
      <select id="wzCam"><option value="auto">자동(ATEM · 캡처 장치 찾기)</option><option value="off">끄기</option>${cams.map((d) => `<option value="${esc(d.deviceId)}" ${st.liveCam === d.deviceId ? "selected" : ""}>${esc(d.label)}</option>`).join("")}</select>
      <button class="btn sm" id="wzCamTry">다시 찾기</button></div>
      <div class="wzck"><span class="s ${st.camOnTv !== false ? "ok" : "no"}">${st.camOnTv !== false ? "✓" : "–"}</span><div class="tx"><b>대표기도 · 설교 제목 때 예배당 TV에 카메라</b><span>카메라 + 이름 · 제목 띠</span></div><label class="chk"><input type="checkbox" id="wzCamTv" ${st.camOnTv !== false ? "checked" : ""}> 켜기</label></div>` : "");
  const sel = $("#wzCam", box); if (sel && (st.liveCam === "off" || !st.liveCam)) sel.value = st.liveCam || "auto";
  if (sel) sel.onchange = async () => { st.liveCam = sel.value; markDirty("lib"); Cam.tried = false; if (st.liveCam === "off") stopCam(); else await startCam(true); renderWizard(); };
  const tr = $("#wzCamTry", box); if (tr) tr.onclick = async () => { Cam.tried = false; await startCam(true); await camDevices(); renderWizard(); };
  const tv = $("#wzCamTv", box); if (tv) tv.onchange = () => { st.camOnTv = tv.checked; markDirty("lib"); sendLive(); renderWizard(); };
  wzFoot(box, "");
}

/* 4. 생중계 */
function wzStream(box) {
  const r = rig(), st = WF.lib.settings;
  const url = (WF.srv && WF.srv.overlayUrl) || "http://127.0.0.1:17860/overlay";
  let h = `<h2>생중계 프로그램</h2>`;
  if (r.stream === "obs") {
    h += `<div class="hint">OBS를 켜고 <b>도구 → WebSocket 서버 설정 → 서버 사용</b>을 켠 뒤, 비밀번호가 있으면 아래에 넣으세요.</div>
      <div class="wzck"><span class="s ${OBS.state === "on" ? "ok" : "warn"}">${OBS.state === "on" ? "✓" : "!"}</span><div class="tx"><b>${OBS.state === "on" ? "OBS 연결됨" : "OBS 연결 안 됨"}</b><span>${esc(OBS.state === "on" ? "장면 " + OBS.scenes.length + "개 · 지금 ‘" + OBS.current + "’" : OBS.err || "아래 ‘연결’을 누르세요")}</span></div>
        <input id="wzObsUrl" value="${esc(st.obsUrl || "ws://127.0.0.1:4455")}" style="width:190px"><input id="wzObsPw" type="password" placeholder="비밀번호(있으면)" style="width:150px"><button class="btn sm" id="wzObsGo">연결</button></div>
      <div class="wzbox"><div class="t">OBS 자동 설정 <span class="tag auto">한 번 누르면 끝</span></div>
        <ul><li>장면 ‘${OBS_SCENE}’ 만들기</li><li>소스 ① 카메라(ATEM · 캡처 장치) · ② WorshipFlow 자막(1920×1080) · ③ ATEM 소리</li><li>F9 긴급 장면 ‘${esc(obsSettings().emergency)}’(검은 바탕 + ‘잠시 후 이어집니다’)</li><li>이미 있는 것은 그대로 둠</li></ul>
        <button class="btn primary" id="wzObsSetup" ${OBS.state === "on" ? "" : "disabled"}>OBS 설정하기</button>
        <div class="wzlog">${WZ.obsLog.map((x) => `<div class="${x.ok ? "okc" : "warnc"}">${x.ok ? "✓" : "!"} ${esc(x.text)}</div>`).join("")}</div></div>`;
  } else if (r.stream === "other") {
    h += `<div class="hint">Ecamm Live · Wirecast · vMix 같은 프로그램은 ‘웹 페이지(브라우저) 소스’를 더하고 이 주소를 넣으면 됩니다(너비 1920 · 높이 1080, 카메라 위에).</div>
      <div class="wzck"><span class="s ok">↗</span><div class="tx"><b>자막 주소</b><span><code>${esc(url)}</code></span></div><button class="btn sm" id="wzCopy">복사</button></div>
      <ul class="hint"><li>Ecamm Live: 오버레이 → ＋ → 웹 페이지(Web Page)</li><li>Wirecast: ＋ → 웹 페이지 · 브라우저(Web Page)</li><li>vMix(윈도우): Add Input → Web Browser</li></ul>`;
  } else if (r.stream === "switcher") {
    h += `<div class="hint">ATEM이 직접 유튜브로 보낼 때는, 가사 자막을 ATEM 안에서 카메라 위에 얹어야 합니다(루마 키). 설정 → ‘루마키 모드 · ATEM (모드 B)’를 켜면 예배당 화면이 ‘검은 바탕 + 아래 두 줄 흰 글자’가 됩니다. 그 화면을 분배기로 ATEM 입력에 넣고 ATEM에서 루마 키로 얹으세요(성도용 TV도 같은 모양이 됩니다).</div>`;
  } else h += `<div class="hint">생중계를 하지 않습니다. 예배당 화면만 씁니다.</div>`;
  box.innerHTML = h;
  const cp = $("#wzCopy", box); if (cp) cp.onclick = async () => { if (await Store.copy(url)) cp.textContent = "복사됨"; };
  const go = $("#wzObsGo", box);
  if (go) go.onclick = async () => {
    st.obsOn = true; st.obsUrl = $("#wzObsUrl", box).value.trim() || "ws://127.0.0.1:4455"; markDirty("lib");
    const pw = $("#wzObsPw", box).value; if (pw && Store.inApp) await window.__TAURI__.core.invoke("secret_set", { key: "obs-password", value: pw }).catch(() => {});
    obsClose(); obsConnect(); for (let i = 0; i < 30 && OBS.state !== "on" && OBS.state !== "error"; i++) await new Promise((r) => setTimeout(r, 100));
    await new Promise((r) => setTimeout(r, 500)); renderWizard();
  };
  const su = $("#wzObsSetup", box);
  if (su) su.onclick = async () => { su.disabled = true; su.textContent = "설정하는 중…"; WZ.obsLog = await obsAutoSetup(url); renderWizard(); };
  wzFoot(box, "");
}

/* 5. 점검 */
function wizardChecks() {
  const r = rig(), st = WF.lib.settings, ms = WF.monitors;
  const out = [], add = (state, title, sub, act) => out.push({ state, title, sub, act });
  const pm = ms.find((m) => m.name === st.projMonitor);
  if (ms.length < 2) add("warn", "예배당 TV", "맥이 화면을 하나만 봅니다 — 미러링이면 ‘확장 디스플레이’로", 2);
  else if (!pm) add("warn", "예배당 TV", "어느 화면이 TV인지 골라 주세요", 2);
  else add("ok", "예배당 TV", `${monName(pm.name)} (${pm.width}×${pm.height}) → 예배당 화면`, 2);
  if (r.screens === "stage") {
    const sm = ms.find((m) => m.name === st.stageMonitor);
    if (sm) add("ok", "강단 화면 (뒤쪽 모니터)", `${monName(sm.name)} → 강단 화면`, 2);
    else if (WF.srv && WF.srv.stageOn) add("ok", "강단 화면", "태블릿 · 스마트 TV에서 강단 페이지로", 2);
    else add("warn", "강단 화면 (뒤쪽 모니터)", "세 번째 화면이 없습니다 — DisplayLink 어댑터 또는 태블릿(강단 페이지)", 2);
  }
  if (r.switcher !== "none") {
    if (Cam.stream) add("ok", "카메라", `${Cam.label} · 생중계 미리보기 · 기도 · 설교 때 TV 카메라`, 3);
    else add("warn", "카메라", "카메라(ATEM · 캡처 장치)를 찾지 못했습니다 — USB · 카메라 허용 확인", 3);
  }
  if (r.switcher === "atem") {
    add("info", "ATEM 출력 · 전환", "출력 = WorshipFlow 입력(2) · 전환 = 카메라(1) — 본체 단추로 한 번 맞춰 두세요", 3);
    if (st.atemOn) add(ATEM.state === "on" ? "ok" : "warn", "ATEM 카메라 바꾸기(네트워크)", ATEM.state === "on" ? `연결됨 · ${ATEM.product || "ATEM"} — 예배 중 화면 카메라 단추` : ATEM.err || "ATEM에 연결되어 있지 않습니다 — 설정 → ATEM 전환기", 0);
    else add("info", "ATEM 카메라 바꾸기(네트워크)", "ATEM을 공유기에 꽂으면 설정 → ATEM 전환기에서 켤 수 있습니다(선택)", 0);
  }
  if (r.stream === "obs") {
    if (OBS.state !== "on") add("warn", "OBS", OBS.err || "OBS에 연결되어 있지 않습니다", 4);
    else if (!OBS.scenes.includes(OBS_SCENE)) add("warn", "OBS", `장면 ‘${OBS_SCENE}’이 없습니다 — 4단계 ‘OBS 설정하기’`, 4);
    else {
      add(OBS.current === OBS_SCENE ? "ok" : "warn", "OBS 장면", OBS.current === OBS_SCENE ? `지금 ‘${OBS_SCENE}’ 장면` : `지금 OBS 장면이 ‘${OBS.current}’입니다 — OBS 장면 목록에서 ‘${OBS_SCENE}’을 누르세요`, 4);
      const hh = OBS.health || {};
      if (hh.cam === "missing") add("warn", "OBS 카메라", "OBS가 ATEM(카메라)을 찾지 못합니다 — ATEM USB를 꽂으면 저절로 다시 맞춥니다", 4);
      else if (hh.cam === "ok" || hh.cam === "fixed") add("ok", "OBS 카메라", `${hh.camName}${hh.cam === "fixed" ? " (USB 번호가 바뀌어 다시 맞춤)" : ""}`, 4);
      if (hh.cap === "ok") add("ok", "OBS 자막", "주소 맞음 · 새 판 페이지로 새로 고침함", 4);
      const em = obsSettings().emergency;
      add(OBS.scenes.includes(em) ? "ok" : "warn", "OBS 긴급 장면(F9)", OBS.scenes.includes(em) ? `‘${em}’ 있음 — F9를 누르면 생중계도 이 장면으로` : `‘${em}’이 없어 F9를 눌러도 생중계는 그대로입니다 — 4단계 ‘OBS 설정하기’를 다시 누르세요`, 4);
    }
    if (!WF.live) add("info", "지금 내보낸 화면", "아직 아무것도 내보내지 않았습니다 — 생중계에는 카메라만 나갑니다. 예배 중에서 → 를 누르면 자막 · 화면이 나갑니다", 0);
  } else if (r.stream === "other") add("info", "생중계 프로그램", "자막 주소를 브라우저 소스로 넣었는지 확인하세요", 4);
  return out;
}
function wzCheck(box) {
  if (OBS.state === "on" && Date.now() - ((OBS.health || {}).at || 0) > 5000) obsHealth().then(() => { if (WZ.step === 5) renderWizard(); });
  const cs = wizardChecks(), warn = cs.filter((c) => c.state === "warn").length;
  box.innerHTML = `<h2>점검</h2><div class="hint">초록이면 끝 · 노랑은 단추를 누르면 그 단계로 갑니다</div>
    <div class="wzsum ${warn ? "warn" : ""}">${warn ? `거의 다 되었습니다 — ${warn}개만 확인하세요` : "모두 준비되었습니다"}</div>` +
    cs.map((c, i) => `<div class="wzck"><span class="s ${c.state === "ok" ? "ok" : c.state === "warn" ? "warn" : "no"}">${c.state === "ok" ? "✓" : c.state === "warn" ? "!" : "i"}</span><div class="tx"><b>${esc(c.title)}</b><span>${esc(c.sub)}</span></div>${c.act ? `<button class="btn sm" data-go="${c.act}">${c.state === "warn" ? "고치기" : "보기"}</button>` : ""}</div>`).join("");
  $$("[data-go]", box).forEach((b) => (b.onclick = () => { WZ.step = +b.dataset.go; renderWizard(); }));
  wzFoot(box, `<button class="btn" id="wzSave">장비 구성 파일로 저장</button>`);
  $("#wzSave", box).onclick = saveRigFile;
}

/* 장비 구성 파일(비밀번호 빼고) */
const RIG_KEYS = ["rig", "projMonitor", "stageMonitor", "monitorNick", "liveCam", "camOnTv", "obsOn", "obsUrl", "atemOn", "atemAddr"];
function rigData() {
  const st = WF.lib.settings, o = { format: "worshipflow-rig", version: 1, church: st.churchName || "", savedAt: new Date().toISOString(), settings: {}, overlay: WF.lib.themes.overlay || {} };
  for (const k of RIG_KEYS) if (st[k] != null) o.settings[k] = st[k];
  return o;
}
function applyRig(o) {
  if (!o || o.format !== "worshipflow-rig") throw new Error("WorshipFlow 장비 구성 파일이 아닙니다");
  for (const k of RIG_KEYS) if (o.settings && o.settings[k] != null) WF.lib.settings[k] = o.settings[k];
  if (o.overlay) WF.lib.themes.overlay = Object.assign({}, WF.lib.themes.overlay || {}, o.overlay);
  markDirty("lib");
}
async function saveRigFile() {
  const p = await Store.pickSave({ title: "장비 구성 저장", defaultPath: "WorshipFlow_장비구성.json", filters: [{ name: "json", extensions: ["json"] }] });
  if (!p) return;
  await Store.writeUserFile(p, JSON.stringify(rigData(), null, 1));
  Store.message("장비 구성을 저장했습니다. 다른 맥의 장비 연결 도우미에서 ‘불러오기’로 넣으세요.\n(OBS 비밀번호는 들어 있지 않습니다)");
}
async function loadRigFile() {
  const p = await Store.pickFiles({ multiple: false, title: "장비 구성 파일 고르기", filters: [{ name: "json", extensions: ["json"] }] });
  if (!p.length) return;
  try { applyRig(JSON.parse(await Store.readUserFile(p[0]))); renderWizard(); if (WF.lib.settings.obsOn) { obsClose(); obsConnect(); } if (WF.lib.settings.atemOn) atemConnect(); }
  catch (e) { Store.message("불러오지 못했습니다: " + (e.message || e)); }
}
