// 휴대폰 리모컨 — 다음 · 이전 · 검은 화면 · 찬양 부분. 누른 결과는 조작 창이 보낸 상태로만 보인다.
(function () {
  const $ = (id) => document.getElementById(id);
  const q = location.search;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let busy = false;
  function send(a) {
    if (busy) return; busy = true;
    if (navigator.vibrate) navigator.vibrate(20);
    fetch("/cmd" + q + "&a=" + encodeURIComponent(a)).catch(() => {}).finally(() => setTimeout(() => (busy = false), 150));
  }
  document.querySelectorAll("[data-a]").forEach((b) => b.addEventListener("click", () => send(b.dataset.a)));
  function show(s) {
    const g = s.stage || {};
    $("item").textContent = (g.now && g.now.title) || "";
    $("nowLab").textContent = (g.now && g.now.label) || "";
    $("nowTxt").innerHTML = esc((g.now && g.now.text) || "").replace(/\*\*/g, "").replace(/\n/g, "<br>");
    $("nextLab").textContent = (g.next && g.next.label) || "";
    $("nextTxt").innerHTML = esc((g.next && g.next.text) || "").replace(/\*\*/g, "").replace(/\n/g, "<br>");
    const f = s.flags || {};
    $("bBlack").classList.toggle("on", !!f.black); $("bClear").classList.toggle("on", !!f.clear); $("bLogo").classList.toggle("on", !!f.logo);
    $("secs").innerHTML = (g.keys || []).map((k) => `<button data-sec="${esc(k.key)}">${esc(k.name)}</button>`).join("");
    document.querySelectorAll("[data-sec]").forEach((b) => b.addEventListener("click", () => send(b.dataset.sec)));
  }
  function tick() { const d = new Date(); $("clock").textContent = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  setInterval(tick, 5000); tick();
  const es = new EventSource("/events" + q);
  es.onmessage = (e) => { $("off").style.display = "none"; try { show(JSON.parse(e.data)); } catch (x) {} };
  es.onerror = () => ($("off").style.display = "block");
})();
