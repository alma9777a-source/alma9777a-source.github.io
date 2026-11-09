// ATEM 전환기 직접 조작(같은 네트워크) — 예배 중 화면에서 카메라 단추로 송출 화면을 바꾼다.
// 원칙: ATEM이 알려 준 상태(송출 · 다음)만 단추에 보인다. 연결이 끊겨도 예배당 화면은 그대로.
const ATEM = (window.ATEM = { state: "off", err: "", product: "", program: 0, preview: 0, inputs: [], poll: null, smooth: false });

function atemSettings() { const st = WF.lib.settings; return { on: !!st.atemOn, addr: st.atemAddr || "192.168.10.240" }; }
async function atemConnect() {
  const cfg = atemSettings();
  if (!cfg.on || !Store.inApp) { atemClose(); return; }
  try { await window.__TAURI__.core.invoke("atem_connect", { addr: cfg.addr }); } catch (e) { ATEM.state = "error"; ATEM.err = String(e); }
  clearInterval(ATEM.poll);
  ATEM.poll = setInterval(atemPoll, 500);
  atemPoll();
}
function atemClose() {
  clearInterval(ATEM.poll); ATEM.poll = null;
  if (Store.inApp) window.__TAURI__.core.invoke("atem_disconnect").catch(() => {});
  Object.assign(ATEM, { state: "off", err: "", product: "", inputs: [] });
  atemUpdate();
}
async function atemPoll() {
  const s = await window.__TAURI__.core.invoke("atem_state").catch(() => null);
  if (!s) return;
  const key = JSON.stringify(s);
  if (key === ATEM.key) return;
  ATEM.key = key;
  Object.assign(ATEM, s);
  atemUpdate();
}
// 카메라 단추에 쓸 입력: 카메라 · HDMI 입력만(색 · 미디어 플레이어 등은 뺌), 1~8번
function atemCams() { return ATEM.inputs.filter((x) => x.id >= 1 && x.id <= 8); }
function atemSwitch(id) {
  if (ATEM.state !== "on") return;
  window.__TAURI__.core.invoke("atem_cmd", { kind: ATEM.smooth ? "auto" : "cut", input: id }).catch((e) => Store.message(String(e)));
}
function atemUpdate() {
  const c = document.getElementById("chipAtem");
  if (c) {
    c.classList.toggle("hidden", ATEM.state === "off");
    const cam = ATEM.inputs.find((x) => x.id === ATEM.program);
    setChip("chipAtem", ATEM.state === "on" ? "ATEM · " + (cam ? cam.short || cam.name : "송출 " + ATEM.program) : ATEM.state === "connecting" ? "ATEM 연결 중…" : "ATEM 연결 안 됨", ATEM.state === "on" ? "ok" : ATEM.state === "connecting" ? "busy" : "bad");
  }
  const bar = document.getElementById("atemBar");
  if (bar) {
    const cams = atemCams();
    bar.classList.toggle("hidden", ATEM.state !== "on" || !cams.length);
    if (ATEM.state === "on") {
      bar.innerHTML = `<b>카메라</b>` + cams.map((x) => `<button class="atbtn ${x.id === ATEM.program ? "pgm" : x.id === ATEM.preview ? "pvw" : ""}" data-in="${x.id}" title="${esc(x.name)}"><i>${x.id}</i>${esc(x.short || x.name)}</button>`).join("") +
        `<label class="chk small" title="끄면 바로 바뀌고, 켜면 부드럽게(ATEM에 정한 전환) 넘어갑니다"><input type="checkbox" id="atemSmooth" ${ATEM.smooth ? "checked" : ""}> 부드럽게</label><span class="muted small">${esc(ATEM.product || "ATEM")} · 빨강 = 지금 송출</span>`;
      $$("[data-in]", bar).forEach((b) => (b.onclick = () => atemSwitch(+b.dataset.in)));
      $("#atemSmooth", bar).onchange = (e) => (ATEM.smooth = e.target.checked);
    }
  }
  const s = document.getElementById("atemStateTx");
  if (s) s.textContent = ATEM.state === "on" ? `연결됨 · ${ATEM.product || "ATEM"} · 입력 ${atemCams().length}개 · 지금 송출 ${ATEM.program}` : ATEM.err || (ATEM.state === "connecting" ? "연결 중…" : "사용 안 함");
}
setTimeout(() => { if (WF.lib && atemSettings().on) atemConnect(); }, 1600);
