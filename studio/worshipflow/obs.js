// OBS 연결(obs-websocket 5) — 장면 · 방송 · 녹화 상태를 읽고, 사람이 누를 때만 바꾼다.
// 원칙: 보낸 명령보다 OBS가 알려 준 상태만 화면에 보인다. OBS가 꺼져도 예배당 화면은 그대로.
const OBS = (window.OBS = {
  ws: null, state: "off", err: "", scenes: [], current: "", streaming: false, recording: false,
  streamTime: "", recTime: "", skipped: 0, total: 0, kbps: 0, level: -100, quietSince: 0,
  reqs: {}, rid: 1, retry: null, poll: null, prevScene: "", lastBytes: 0, lastBytesAt: 0,
});

async function sha256b64(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return btoa(String.fromCharCode(...new Uint8Array(d)));
}
function obsSettings() {
  const st = WF.lib.settings;
  return { on: !!st.obsOn, url: st.obsUrl || "ws://127.0.0.1:4455", emergency: st.obsEmergencyScene || "WFL_EMERGENCY" };
}
async function obsSecret() {
  if (!Store.inApp) return "";
  return (await window.__TAURI__.core.invoke("secret_get", { key: "obs-password" }).catch(() => null)) || "";
}

function obsConnect() {
  clearTimeout(OBS.retry);
  const cfg = obsSettings();
  if (!cfg.on) { obsClose(); return; }
  if (OBS.ws && OBS.ws.readyState <= 1) return;
  const quiet = OBS.state === "error" && OBS.fails > 0; // 뒤에서 조용히 다시 찾는 중이면 표시를 바꾸지 않음
  if (!quiet) { OBS.state = "connecting"; OBS.err = ""; updateObsChip(); }
  let ws;
  try { ws = new WebSocket(cfg.url); } catch (e) { OBS.state = "error"; OBS.err = "주소가 잘못되었습니다"; updateObsChip(); return; }
  OBS.ws = ws;
  ws.onmessage = async (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.op === 0) { // Hello
      const ident = { rpcVersion: 1, eventSubscriptions: 1 | 4 | 64 | (1 << 16) };
      const a = m.d.authentication;
      if (a) {
        const pw = await obsSecret();
        if (!pw) { OBS.err = "OBS 비밀번호가 필요합니다(설정)"; ws.close(); return; }
        ident.authentication = await sha256b64((await sha256b64(pw + a.salt)) + a.challenge);
      }
      ws.send(JSON.stringify({ op: 1, d: ident }));
    } else if (m.op === 2) { // Identified
      OBS.state = "on"; OBS.err = ""; OBS.fails = 0;
      obsLog("OBS 연결됨");
      await obsRefresh();
      obsHealth(); // 카메라 장치 번호 · 자막 주소 · 자막 페이지 새로 고침
      clearInterval(OBS.poll);
      OBS.poll = setInterval(obsPoll, 2000);
    } else if (m.op === 7) { // 요청 답
      const r = OBS.reqs[m.d.requestId];
      if (r) { delete OBS.reqs[m.d.requestId]; clearTimeout(r.t); m.d.requestStatus.result ? r.ok(m.d.responseData || {}) : r.no(new Error(m.d.requestStatus.comment || ("코드 " + m.d.requestStatus.code))); }
    } else if (m.op === 5) obsEvent(m.d.eventType, m.d.eventData || {});
  };
  ws.onclose = (e) => {
    const was = OBS.state;
    OBS.state = obsSettings().on ? "error" : "off";
    if (!OBS.err) OBS.err = e.code === 4009 ? "OBS 비밀번호가 틀립니다" : "OBS에 연결할 수 없습니다 — OBS가 켜져 있는지, 도구 → WebSocket 서버 설정이 켜져 있는지 확인";
    if (e.code === 4009) OBS.err = "OBS 비밀번호가 틀립니다";
    if (was === "on") obsLog("OBS 연결 끊김");
    OBS.ws = null; clearInterval(OBS.poll);
    for (const k of Object.keys(OBS.reqs)) { OBS.reqs[k].no(new Error("연결 끊김")); delete OBS.reqs[k]; }
    updateObsChip();
    OBS.fails = (OBS.fails || 0) + 1;
    if (obsSettings().on) OBS.retry = setTimeout(obsConnect, OBS.fails < 3 ? 3000 : OBS.fails < 6 ? 10000 : 30000); // 3초 → 10초 → 30초마다 조용히 다시 찾기
  };
  ws.onerror = () => {};
}
function obsClose() {
  clearTimeout(OBS.retry); clearInterval(OBS.poll);
  if (OBS.ws) { const w = OBS.ws; OBS.ws = null; w.onclose = null; w.close(); }
  OBS.state = "off"; OBS.err = ""; updateObsChip();
}
function obsReq(type, data) {
  return new Promise((ok, no) => {
    if (!OBS.ws || OBS.state !== "on") return no(new Error("OBS 연결 안 됨"));
    const id = "r" + OBS.rid++;
    const t = setTimeout(() => { delete OBS.reqs[id]; no(new Error("OBS 응답 없음")); }, 4000);
    OBS.reqs[id] = { ok, no, t };
    OBS.ws.send(JSON.stringify({ op: 6, d: { requestType: type, requestId: id, requestData: data || {} } }));
  });
}
async function obsRefresh() {
  try {
    const sl = await obsReq("GetSceneList");
    OBS.scenes = (sl.scenes || []).map((s) => s.sceneName).reverse();
    OBS.current = sl.currentProgramSceneName || "";
    const ss = await obsReq("GetStreamStatus"); OBS.streaming = !!ss.outputActive; OBS.streamTime = ss.outputTimecode || "";
    const rs = await obsReq("GetRecordStatus"); OBS.recording = !!rs.outputActive; OBS.recTime = rs.outputTimecode || "";
  } catch (e) { OBS.err = String(e.message || e); }
  updateObsChip();
}
async function obsPoll() {
  try {
    const ss = await obsReq("GetStreamStatus");
    OBS.streaming = !!ss.outputActive; OBS.streamTime = (ss.outputTimecode || "").split(".")[0];
    OBS.skipped = ss.outputSkippedFrames || 0; OBS.total = ss.outputTotalFrames || 0;
    const now = Date.now();
    if (OBS.lastBytesAt && ss.outputBytes >= OBS.lastBytes) OBS.kbps = Math.round(((ss.outputBytes - OBS.lastBytes) * 8) / (now - OBS.lastBytesAt));
    OBS.lastBytes = ss.outputBytes || 0; OBS.lastBytesAt = now;
    if (OBS.recording) { const rs = await obsReq("GetRecordStatus"); OBS.recTime = (rs.outputTimecode || "").split(".")[0]; }
  } catch (e) {}
  updateObsChip();
}
function obsEvent(type, d) {
  if (type === "CurrentProgramSceneChanged") { OBS.current = d.sceneName; obsLog("OBS 장면: " + d.sceneName); }
  else if (type === "SceneListChanged") OBS.scenes = (d.scenes || []).map((s) => s.sceneName).reverse();
  else if (type === "StreamStateChanged") { OBS.streaming = !!d.outputActive; if (/STARTED|STOPPED/.test(d.outputState)) obsLog(d.outputActive ? "방송 시작됨" : "방송 끝남"); }
  else if (type === "RecordStateChanged") { OBS.recording = !!d.outputActive; if (/STARTED|STOPPED/.test(d.outputState)) obsLog(d.outputActive ? "녹화 시작됨" : "녹화 끝남" + (d.outputPath ? " · " + d.outputPath : "")); if (d.outputPath) OBS.lastRecord = d.outputPath; }
  else if (type === "InputVolumeMeters") {
    // 가장 큰 소리 입력의 봉우리(dB)
    let peak = 0;
    for (const inp of d.inputs || []) for (const ch of inp.inputLevelsMul || []) peak = Math.max(peak, ch[1] || 0);
    OBS.level = peak > 0 ? 20 * Math.log10(peak) : -100;
    if (OBS.level > -50) OBS.quietSince = 0; else if (!OBS.quietSince) OBS.quietSince = Date.now();
    const m = document.getElementById("obsMeter");
    if (m) { m.style.width = Math.max(0, Math.min(100, (OBS.level + 60) * (100 / 60))) + "%"; m.className = OBS.level > -3 ? "hot" : OBS.level > -20 ? "good" : ""; }
    return;
  }
  updateObsChip();
}

// 기록(비밀번호 · 스트림 키는 절대 남기지 않음)
function obsLog(msg) {
  const L = (WF.obsLog = WF.obsLog || []);
  const d = new Date();
  L.push(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")} ${msg}`);
  if (L.length > 200) L.shift();
}

function obsQuiet() { return OBS.state === "on" && (OBS.streaming || OBS.recording) && OBS.quietSince && Date.now() - OBS.quietSince > 10000; }
function updateObsChip() {
  const c = document.getElementById("chipObs"); if (!c) return;
  c.classList.toggle("hidden", OBS.state === "off");
  let text = "OBS", state = "ok";
  if (OBS.state === "connecting") { text = "OBS 연결 중…"; state = "busy"; }
  else if (OBS.state === "error") { text = WF.live ? "OBS 끊김 · 누르면 다시 연결" : "OBS 안 켜짐"; state = WF.live ? "bad" : "off"; } // 예배 전에는 회색(걱정 덜게), 예배 중에 끊기면 빨강
  else if (OBS.streaming) { text = "방송 중 " + (OBS.streamTime || ""); state = "bad"; }
  else if (OBS.recording) { text = "녹화 중 " + (OBS.recTime || ""); state = "bad"; }
  else text = "OBS · " + (OBS.current || "연결됨");
  if (obsQuiet()) text += " · 소리 없음!";
  if (OBS.state === "on" && OBS.health && OBS.health.cam === "missing") { text += " · 카메라 못 찾음"; if (state === "ok") state = "busy"; }
  setChip("chipObs", text, state);
  c.classList.toggle("live", OBS.streaming);
  c.classList.toggle("warn", obsQuiet());
  if (!$("#modal").classList.contains("hidden") && document.getElementById("obsPanel")) fillObsPanel();
}

// F9 긴급 대기와 함께: OBS 긴급 장면으로(있을 때만). 다시 F9 → 직전 장면.
async function obsEmergency(on) {
  if (OBS.state !== "on") return;
  const name = obsSettings().emergency;
  try {
    if (on && !OBS.scenes.includes(name)) obsLog(`긴급 장면 ‘${name}’이 OBS에 없어 생중계는 그대로 — 장비 연결 도우미 4단계 ‘OBS 설정하기’`);
    else if (on && OBS.current !== name) { OBS.prevScene = OBS.current; await obsReq("SetCurrentProgramScene", { sceneName: name }); }
    else if (!on && OBS.prevScene && OBS.current === name) { await obsReq("SetCurrentProgramScene", { sceneName: OBS.prevScene }); OBS.prevScene = ""; }
  } catch (e) { obsLog("긴급 장면 바꾸기 실패: " + e.message); }
}

function showObsPanel() {
  modal(`<div id="obsPanel" class="obspanel"></div><div class="mfoot"><button class="btn" data-close>닫기</button></div>`, () => fillObsPanel());
}
function fillObsPanel() {
  const box = document.getElementById("obsPanel"); if (!box) return;
  const on = OBS.state === "on";
  const drop = OBS.total ? ((OBS.skipped / OBS.total) * 100).toFixed(1) : "0.0";
  box.innerHTML = `<h3>방송 제어 · OBS <span class="muted small">${on ? "연결됨" : esc(OBS.err || "연결 안 됨")}</span></h3>
    ${on ? `<div class="obsrow"><b>장면</b><span class="muted small">누르면 바로 바뀝니다 · OBS가 확인한 장면이 초록</span></div>
    <div class="obsscenes">${OBS.scenes.map((s) => `<button class="jbtn ${s === OBS.current ? "cur" : ""}" data-scene="${esc(s)}">${esc(s)}</button>`).join("") || '<span class="muted">장면이 없습니다</span>'}</div>
    <div class="obsgrid">
      <div class="obsbox ${OBS.streaming ? "live" : ""}"><div class="muted small">유튜브 방송</div><b>${OBS.streaming ? "방송 중 " + esc(OBS.streamTime) : "꺼짐"}</b>
        <div class="muted small">${OBS.streaming ? `${OBS.kbps} kbps · 끊긴 프레임 ${drop}%` : "스트림 키는 OBS 안에만 있습니다"}</div>
        <button class="btn ${OBS.streaming ? "danger" : "primary"}" id="obsStream">${OBS.streaming ? "방송 끝내기…" : "방송 시작…"}</button></div>
      <div class="obsbox ${OBS.recording ? "live" : ""}"><div class="muted small">녹화</div><b>${OBS.recording ? "녹화 중 " + esc(OBS.recTime) : "꺼짐"}</b>
        <div class="muted small">${OBS.lastRecord ? "마지막 파일: " + esc(OBS.lastRecord.split("/").pop()) : "녹화 파일은 OBS 설정의 폴더에"}</div>
        <button class="btn ${OBS.recording ? "danger" : ""}" id="obsRec">${OBS.recording ? "녹화 끝내기…" : "녹화 시작"}</button></div>
    </div>
    <div class="obsrow"><b>소리</b><div class="meter"><i id="obsMeter"></i></div><span class="muted small">${obsQuiet() ? '<b class="warnc">10초 넘게 소리가 없습니다 — 믹서 → ATEM → OBS 순서로 확인</b>' : "가장 큰 입력"}</span></div>` :
    `<div class="note-box">OBS가 연결되어 있지 않습니다. OBS를 켜고, OBS 메뉴 <b>도구 → WebSocket 서버 설정</b>에서 ‘WebSocket 서버 사용’을 켠 뒤, WorshipFlow 설정의 OBS 칸에 비밀번호를 넣으세요. 예배당 화면은 OBS 없이도 그대로 됩니다.</div>`}
    <div class="obslog">${(WF.obsLog || []).slice(-6).reverse().map((l) => `<div>${esc(l)}</div>`).join("")}</div>`;
  $$("[data-scene]", box).forEach((b) => (b.onclick = () => obsReq("SetCurrentProgramScene", { sceneName: b.dataset.scene }).catch((e) => { obsLog("장면 바꾸기 실패: " + e.message); fillObsPanel(); })));
  const sb = document.getElementById("obsStream");
  if (sb) sb.onclick = async () => {
    if (OBS.streaming) { if (await Store.confirm("유튜브 방송을 끝낼까요?\n시청자 화면이 끝납니다.")) obsReq("StopStream").catch((e) => Store.message("방송 끝내기 실패: " + e.message)); }
    else if (await Store.confirm("유튜브 방송을 시작할까요?\n(OBS 방송 시작 — 유튜브 스튜디오에서 공개 상태를 확인하세요)")) obsReq("StartStream").catch((e) => Store.message("방송 시작 실패: " + e.message));
  };
  const rb = document.getElementById("obsRec");
  if (rb) rb.onclick = async () => {
    if (OBS.recording) { if (await Store.confirm("녹화를 끝낼까요?")) obsReq("StopRecord").catch((e) => Store.message("녹화 끝내기 실패: " + e.message)); }
    else obsReq("StartRecord").catch((e) => Store.message("녹화 시작 실패: " + e.message));
  };
}

(function wireObs() {
  const c = document.getElementById("chipObs");
  if (c) c.onclick = showObsPanel;
  setTimeout(() => { if (WF.lib && obsSettings().on) obsConnect(); }, 1500);
  setInterval(() => { if (OBS.state === "on") updateObsChip(); }, 1000);
})();

// ── OBS 자동 설정(장비 연결 도우미): 장면 ‘WorshipFlow 예배’ + ATEM 카메라 + WorshipFlow 자막 + ATEM 소리 ──
// 이미 있는 것은 그대로 두고 없는 것만 만든다. 결과는 한 줄씩 [{ok, text}] 로 돌려준다.
const OBS_SCENE = "WorshipFlow 예배", OBS_CAM = "WF 카메라", OBS_CAP = "WF 자막", OBS_SND = "WF 소리", OBS_EM_BG = "WF 긴급 바탕", OBS_EM_TXT = "WF 긴급 글";
const CAM_RE = /blackmagic|atem|cam ?link|elgato|magewell|avermedia|ultrastudio|usb capture|hdmi/i;
async function obsAutoSetup(overlayUrl) {
  const out = [], step = (ok, text) => out.push({ ok, text });
  if (OBS.state !== "on") { step(false, "OBS에 연결되어 있지 않습니다 — OBS를 켜고 도구 → WebSocket 서버 설정을 켜 주세요"); return out; }
  try {
    const sl = await obsReq("GetSceneList");
    if (!(sl.scenes || []).some((x) => x.sceneName === OBS_SCENE)) { await obsReq("CreateScene", { sceneName: OBS_SCENE }); step(true, `장면 ‘${OBS_SCENE}’ 만듦`); }
    else step(true, `장면 ‘${OBS_SCENE}’ 이미 있음`);
    const have = new Set(((await obsReq("GetInputList")).inputs || []).map((x) => x.inputName));
    const fit = async (id) => { try { await obsReq("SetSceneItemTransform", { sceneName: OBS_SCENE, sceneItemId: id, sceneItemTransform: { boundsType: "OBS_BOUNDS_SCALE_INNER", boundsWidth: 1920, boundsHeight: 1080, positionX: 0, positionY: 0 } }); } catch (e) {} };
    // 1) 카메라(ATEM USB · 캡처 장치)
    if (!have.has(OBS_CAM)) {
      let r = null;
      for (const kind of ["av_capture_input_v2", "av_capture_input", "dshow_input"]) { try { r = await obsReq("CreateInput", { sceneName: OBS_SCENE, inputName: OBS_CAM, inputKind: kind, inputSettings: {} }); break; } catch (e) {} }
      if (!r) step(false, "카메라 소스를 만들지 못했습니다 — OBS에서 ‘비디오 캡처 장치’를 직접 더해 주세요");
      else { await fit(r.sceneItemId); step(true, `카메라 소스 ‘${OBS_CAM}’ 만듦`); }
    } else step(true, `카메라 소스 ‘${OBS_CAM}’ 이미 있음`);
    // 카메라 장치 고르기: 목록에서 Blackmagic · 캡처 장치 이름 찾기
    try {
      const it = (await obsReq("GetInputPropertiesListPropertyItems", { inputName: OBS_CAM, propertyName: "device" })).propertyItems || [];
      const dev = it.find((x) => CAM_RE.test(x.itemName));
      if (dev) { await obsReq("SetInputSettings", { inputName: OBS_CAM, inputSettings: { device: dev.itemValue, use_preset: true, preset: "AVCaptureSessionPresetHigh" } }); step(true, `카메라 장치: ${dev.itemName}`); }
      else step(false, "카메라 장치(ATEM · 캡처 장치)를 찾지 못했습니다 — USB 연결을 확인하고 다시 누르세요");
    } catch (e) { step(false, "카메라 장치를 고르지 못했습니다 — OBS에서 ‘" + OBS_CAM + "’ 속성을 열어 고르세요"); }
    // 2) 자막(브라우저 소스) — 카메라 위
    if (!have.has(OBS_CAP)) {
      const r = await obsReq("CreateInput", { sceneName: OBS_SCENE, inputName: OBS_CAP, inputKind: "browser_source", inputSettings: { url: overlayUrl, width: 1920, height: 1080, reroute_audio: true, shutdown: false } });
      await fit(r.sceneItemId); step(true, `자막 소스 ‘${OBS_CAP}’ 만듦 (${overlayUrl})`);
    } else { await obsReq("SetInputSettings", { inputName: OBS_CAP, inputSettings: { url: overlayUrl, width: 1920, height: 1080 } }); step(true, `자막 소스 ‘${OBS_CAP}’ 주소 맞춤`); }
    // 3) 소리(ATEM USB 소리)
    if (!have.has(OBS_SND)) {
      let ok = false;
      for (const kind of ["coreaudio_input_capture", "wasapi_input_capture"]) { try { await obsReq("CreateInput", { sceneName: OBS_SCENE, inputName: OBS_SND, inputKind: kind, inputSettings: {} }); ok = true; break; } catch (e) {} }
      if (ok) {
        try {
          const it = (await obsReq("GetInputPropertiesListPropertyItems", { inputName: OBS_SND, propertyName: "device_id" })).propertyItems || [];
          const dev = it.find((x) => CAM_RE.test(x.itemName));
          if (dev) { await obsReq("SetInputSettings", { inputName: OBS_SND, inputSettings: { device_id: dev.itemValue } }); step(true, `소리: ${dev.itemName}`); }
          else step(false, "ATEM 소리 장치를 찾지 못했습니다 — OBS ‘" + OBS_SND + "’ 속성에서 고르세요");
        } catch (e) { step(true, `소리 소스 ‘${OBS_SND}’ 만듦 (장치는 OBS에서 확인)`); }
      } else step(false, "소리 소스를 만들지 못했습니다");
    } else step(true, `소리 소스 ‘${OBS_SND}’ 이미 있음`);
    // 4) 긴급 장면(F9) — 검은 바탕 + 교회 이름 · ‘잠시 후 이어집니다’. 없으면 F9를 눌러도 OBS는 그대로라서 같이 만든다
    const em = obsSettings().emergency;
    if (!(sl.scenes || []).some((x) => x.sceneName === em)) {
      await obsReq("CreateScene", { sceneName: em });
      if (!have.has(OBS_EM_BG)) {
        try { const r = await obsReq("CreateInput", { sceneName: em, inputName: OBS_EM_BG, inputKind: "color_source_v3", inputSettings: { color: 0xff000000, width: 1920, height: 1080 } }); await obsReq("SetSceneItemTransform", { sceneName: em, sceneItemId: r.sceneItemId, sceneItemTransform: { positionX: 0, positionY: 0 } }).catch(() => {}); } catch (e) {}
      }
      if (!have.has(OBS_EM_TXT)) {
        const text = [WF.lib.settings.churchName, "잠시 후 이어집니다"].filter(Boolean).join("\n");
        for (const kind of ["text_ft2_source_v2", "text_gdiplus_v3"]) {
          try {
            const r = await obsReq("CreateInput", { sceneName: em, inputName: OBS_EM_TXT, inputKind: kind, inputSettings: { text, align: "center", font: { face: "Apple SD Gothic Neo", size: 96, style: "Bold", flags: 1 } } });
            await obsReq("SetSceneItemTransform", { sceneName: em, sceneItemId: r.sceneItemId, sceneItemTransform: { alignment: 0, positionX: 960, positionY: 540 } }).catch(() => {}); // 0 = 가운데 기준
            break;
          } catch (e) {}
        }
      }
      step(true, `긴급 장면 ‘${em}’ 만듦 (F9 · 글과 그림은 OBS에서 바꿔도 됨)`);
    } else step(true, `긴급 장면 ‘${em}’ 이미 있음`);
    await obsReq("SetCurrentProgramScene", { sceneName: OBS_SCENE }); step(true, `지금 장면을 ‘${OBS_SCENE}’로`);
    await obsRefresh();
  } catch (e) { step(false, "OBS 설정 중 문제: " + (e.message || e)); }
  return out;
}

// ── OBS 스스로 점검 · 고치기(연결될 때 · USB 장치가 바뀔 때) ──
// ① WF 카메라: OBS는 장치를 ‘번호’로 기억하는데 ATEM 번호는 USB를 다른 구멍에 꽂으면 바뀐다 → 고른 장치를 못 찾을 때만 Blackmagic · 캡처 장치를 찾아 다시 맞춤(찾아지면 어떤 카메라든 그대로)
// ② WF 자막: 주소가 지금 WorshipFlow 자막 주소와 다르면 맞추고, 새 판 뒤에도 옛 페이지가 남지 않게 한 번 새로 고침
OBS.health = { cam: "", cap: "", at: 0 };
async function obsHealth() {
  if (OBS.state !== "on") return OBS.health;
  const h = { cam: "none", cap: "none", at: Date.now(), camName: "" };
  try {
    const names = new Set(((await obsReq("GetInputList")).inputs || []).map((x) => x.inputName));
    if (names.has(OBS_CAM)) {
      const cur = ((await obsReq("GetInputSettings", { inputName: OBS_CAM })).inputSettings || {}).device || "";
      const items = (await obsReq("GetInputPropertiesListPropertyItems", { inputName: OBS_CAM, propertyName: "device" })).propertyItems || [];
      const here = items.find((x) => x.itemValue === cur && x.itemEnabled !== false);
      if (here) { h.cam = "ok"; h.camName = here.itemName; } // 목사님이 OBS에서 고른 카메라(맥북 카메라 등)는 그대로 둔다
      else {
        const dev = items.find((x) => CAM_RE.test(x.itemName) && x.itemEnabled !== false);
        if (dev) { await obsReq("SetInputSettings", { inputName: OBS_CAM, inputSettings: { device: dev.itemValue, use_preset: true, preset: "AVCaptureSessionPresetHigh" } }); h.cam = "fixed"; h.camName = dev.itemName; obsLog("OBS 카메라를 ‘" + dev.itemName + "’로 다시 맞춤(USB 번호 바뀜)"); }
        else h.cam = "missing";
      }
      // 예전 판이 ‘프리셋 사용’을 끄고 해상도 · 프레임을 비워 두어 카메라가 까맣던 것 → 프리셋(High)으로
      const cs = (await obsReq("GetInputSettings", { inputName: OBS_CAM })).inputSettings || {};
      if (cs.use_preset === false && !cs.frame_rate) { await obsReq("SetInputSettings", { inputName: OBS_CAM, inputSettings: { use_preset: true, preset: "AVCaptureSessionPresetHigh" } }); obsLog("OBS 카메라를 ‘프리셋 사용’으로 고침(까만 화면 방지)"); h.preset = "fixed"; }
    }
    if (names.has(OBS_CAP)) {
      const url = ((await Store.serverInfo().catch(() => ({}))) || {}).overlayUrl || "";
      const cur = ((await obsReq("GetInputSettings", { inputName: OBS_CAP })).inputSettings || {}).url || "";
      if (url && cur !== url) { await obsReq("SetInputSettings", { inputName: OBS_CAP, inputSettings: { url, width: 1920, height: 1080 } }); obsLog("OBS 자막 주소를 맞춤"); }
      if (!OBS.capRefreshed) { await obsReq("PressInputPropertiesButton", { inputName: OBS_CAP, propertyName: "refreshnocache" }).catch(() => {}); OBS.capRefreshed = true; }
      h.cap = "ok";
    }
  } catch (e) { h.err = String(e.message || e); }
  OBS.health = h; updateObsChip();
  return h;
}
