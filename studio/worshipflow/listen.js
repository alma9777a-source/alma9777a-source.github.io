// 설교 중 들은 말에서 구절 찾기 — 맥 내장 받아쓰기(이 맥 안에서, 인터넷 없이).
// 장절이 들리면 후보 단추만 보여 준다. 누르면 ‘다음’에 올라가고, 성도 화면에 자동으로 나가지는 않는다.
const LISTEN = { on: false, cands: [], last: "", seen: new Set() };

function listenState(text, bad) {
  const el = $("#listenState");
  el.textContent = text;
  el.className = "small " + (bad ? "warnc" : "muted");
}
async function listenToggle() {
  if (!Store.inApp) return Store.message("앱에서만 쓸 수 있습니다.");
  const T = window.__TAURI__.core;
  if (LISTEN.on) { await T.invoke("listen_stop"); LISTEN.on = false; renderListen(); listenState("꺼짐"); return; }
  try {
    const c = await T.invoke("listen_check");
    if (c.status === "unsupported") return listenState("이 맥은 한국어 받아쓰기를 지원하지 않습니다", true);
    if (c.auth === 1 || c.auth === 2) return listenState("받아쓰기 권한이 꺼져 있습니다 — 시스템 설정 → 개인정보 보호 → 음성 인식에서 WorshipFlow 켜기", true);
    listenState(c.auth === 0 ? "처음이라 맥이 권한을 묻습니다 — ‘허용’을 눌러 주세요" : "시작하는 중…");
    LISTEN.on = true; renderListen();
    await T.invoke("listen_start", { file: null });
  } catch (e) { LISTEN.on = false; renderListen(); listenState("시작하지 못했습니다: " + e, true); }
}
function onHeard(m) {
  if (m.status) {
    if (m.status === "ready") listenState(m.onDevice ? "듣는 중 · 이 맥 안에서 받아씀" : "듣는 중");
    else if (m.status === "denied") { LISTEN.on = false; listenState("받아쓰기 권한이 없습니다 — 시스템 설정 → 개인정보 보호 → 음성 인식", true); }
    else if (m.status === "denied_mic") { LISTEN.on = false; listenState("마이크 권한이 없습니다 — 시스템 설정 → 개인정보 보호 → 마이크", true); }
    else if (m.status === "nomic") { LISTEN.on = false; listenState("마이크가 없습니다 — 믹서 출력을 맥 소리 입력에 연결하세요", true); }
    else if (m.status === "error") listenState("받아쓰기 오류: " + (m.message || ""), true);
    else if (m.status === "stopped") { LISTEN.on = false; if (!/권한|마이크/.test($("#listenState").textContent)) listenState("꺼짐"); }
    renderListen();
    return;
  }
  if (typeof m.text !== "string") return;
  LISTEN.last = m.text;
  const tail = m.text.slice(-90);
  $("#heardText").textContent = tail ? "…" + tail : "";
  for (const r of Bible.findSpokenRefs(m.text.slice(-200))) {
    if (LISTEN.seen.has(r.ref)) continue; // 같은 구절은 한 번만(한 번 받아쓰는 동안)
    LISTEN.seen.add(r.ref);
    LISTEN.cands.unshift({ ref: r.ref, label: r.label, said: r.said, at: Date.now() });
  }
  if (m.final) LISTEN.seen.clear();
  LISTEN.cands = LISTEN.cands.slice(0, 6);
  renderListen();
}
function renderListen() {
  const b = $("#listenBtn"); if (!b) return;
  b.textContent = LISTEN.on ? "■ 듣기 멈춤" : "🎙 들은 말에서 구절 찾기";
  b.classList.toggle("on", LISTEN.on);
  $("#cands").innerHTML = LISTEN.cands.map((c, i) => `<div class="cand"><b>${esc(c.label)}</b><span class="muted small">“${esc(c.said)}”</span><button class="btn sm" data-c="${i}">다음에 올리기</button></div>`).join("");
  $$("#cands [data-c]").forEach((x) => (x.onclick = () => { const c = LISTEN.cands[+x.dataset.c]; quickVerse(c.ref); x.textContent = "올림"; x.disabled = true; }));
}
Store.listen("heard", onHeard);
$("#listenBtn").onclick = listenToggle;
