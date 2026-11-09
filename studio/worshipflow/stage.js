// 강단 페이지 — 지금 · 다음 · 시계 · 남은 시간 · 운영자 메모. 보기 전용(넘길 수 없음).
(function () {
  const $ = (id) => document.getElementById(id);
  document.addEventListener("contextmenu", (e) => e.preventDefault()); // 보기 전용 — 오른쪽 클릭 ‘Reload’로 화면이 처음으로 돌아가지 않게
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const mark = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<span class="wf-acc">$1</span>').replace(/\n/g, "<br>");
  let st = null;
  function fmt(ms) {
    const neg = ms < 0; ms = Math.abs(ms);
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), x = s % 60;
    return (neg ? "+" : "") + m + ":" + String(x).padStart(2, "0");
  }
  function tick() {
    const d = new Date();
    $("clock").textContent = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    const tm = st && st.stage && st.stage.timer, el = $("timer");
    if (tm && tm.start && tm.minutes) {
      const left = tm.start + tm.minutes * 60000 - Date.now() + (st.stage.skew || 0);
      el.textContent = (tm.label || "남은 시간") + " " + fmt(left);
      el.className = left < 0 ? "over" : left < 5 * 60000 ? "near" : "";
    } else el.textContent = "";
  }
  // 칸에 다 들어가게 글자 크기를 줄인다(태블릿 크기마다 다름)
  function fitBox(el) {
    el.style.fontSize = "";
    let px = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollHeight > el.clientHeight + 2 && px > 14) { px -= 2; el.style.fontSize = px + "px"; }
  }
  addEventListener("resize", () => { fitBox($("nowTxt")); fitBox($("nextTxt")); });
  function show(s) {
    st = s;
    const g = s.stage || {};
    // 조작 컴퓨터와 태블릿 시계 차이 맞추기
    if (g.sentAt) g.skew = Date.now() - g.sentAt;
    // 아직 예배를 시작하지 않았으면(나가는 화면 없음) 연결은 되었다고 알려 줌 — 빈 화면 · ‘연결 중…’으로 보이지 않게
    const idle = !(g.now && (g.now.text || g.now.title));
    $("item").textContent = idle ? "WorshipFlow 연결됨 ✓" : g.now.title || "";
    document.body.classList.toggle("idle", idle);
    $("nowLab").textContent = (g.now && g.now.label) || "";
    $("nowTxt").innerHTML = idle ? '<span class="wait">예배를 시작하면 여기에<br>지금 가사가 나옵니다</span>' : mark((g.now && g.now.text) || "");
    $("nextLab").textContent = (g.next && g.next.label) || "";
    $("nextTxt").innerHTML = mark((g.next && g.next.text) || "");
    fitBox($("nowTxt")); fitBox($("nextTxt"));
    const m = [g.msg, g.now && g.now.note].filter(Boolean).join("  ·  ");
    $("msg").textContent = m;
    $("msg").classList.toggle("hidden", !m);
    const f = s.flags || {};
    const ft = f.emergency ? "긴급 대기" : f.black ? "검은 화면" : f.logo ? "로고 화면" : f.clear ? "글 지움" : "";
    $("flag").textContent = ft; $("flag").classList.toggle("hidden", !ft);
    tick();
    const T = window.__TAURI__;
    if (T && T.event) T.event.emitTo("main", "stage-shown", { now: $("nowTxt").innerText.slice(0, 120), next: $("nextTxt").innerText.slice(0, 120), w: innerWidth, h: innerHeight });
  }
  async function connect() {
    // 앱 안 ‘강단 화면’ 창(뒤쪽 모니터): 조작 창이 보내는 상태를 바로 받는다
    const T = window.__TAURI__;
    if (T && T.event) {
      T.event.listen("live", (e) => { $("off").classList.add("hidden"); show(e.payload); });
      const st0 = await T.core.invoke("get_live").catch(() => null);
      show(st0 || { stage: {} });
      $("off").classList.add("hidden");
      // 이 창에서 눌린 키도 조작 창으로(실수로 이 창을 눌렀을 때)
      addEventListener("keydown", (e) => T.event.emitTo("main", "proj-key", { key: e.key, code: e.code, shift: e.shiftKey, meta: e.metaKey }));
      return;
    }
    const es = new EventSource("/events" + location.search);
    es.onopen = () => { $("off").classList.add("hidden"); if (!st) show({ stage: {} }); };
    es.onmessage = (e) => { $("off").classList.add("hidden"); try { show(JSON.parse(e.data)); } catch (x) {} };
    es.onerror = () => $("off").classList.remove("hidden");
  }
  setInterval(tick, 1000);
  connect();
})();
