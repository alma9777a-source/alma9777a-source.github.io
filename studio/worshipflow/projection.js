// 예배당 화면 — 조작 창이 보낸 '지금 상태'를 받아 그대로 그린다. 여기서는 아무것도 고르지 않는다.
(function () {
  const T = window.__TAURI__;
  const wrap = document.getElementById("wrap");
  let front = document.getElementById("a"), back = document.getElementById("b");
  let lastKey = "", lastSeq = -1;

  function fitWindow() {
    const s = Math.min(innerWidth / Render.W, innerHeight / Render.H);
    wrap.style.transform = `translate(${(innerWidth - Render.W * s) / 2}px, ${(innerHeight - Render.H * s) / 2}px) scale(${s})`;
  }
  addEventListener("resize", fitWindow);
  fitWindow();

  let barKey = "", barTimer = null;
  const barEl = document.getElementById("bar");
  function bar(b) {
    if (!b || !b.projUrl) { barEl.classList.remove("on"); barKey = ""; return; }
    if (b.key === barKey) return;
    barKey = b.key; clearTimeout(barTimer);
    barEl.onload = () => barEl.classList.add("on");
    barEl.style.width = (b.w || 900) + "px"; Render.barPlace(barEl, b.pos, b.w || 900); barEl.src = b.projUrl;
    if (b.secs) barTimer = setTimeout(() => barEl.classList.remove("on"), b.secs * 1000);
  }
  // 카메라(ATEM USB) — 조작 창이 고른 카메라 번호(camId)로 연다. 녹화하지 않고 화면에만.
  let camStream = null, camId = "", camOpening = null;
  function openCam(id) {
    if (camOpening) return camOpening;
    camOpening = (async () => {
      try {
        if (camStream) camStream.getTracks().forEach((t) => t.stop());
        camStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: id }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
        camId = id;
      } catch (e) { camStream = null; }
      camOpening = null;
    })();
    return camOpening;
  }
  let lastSt = null, shownSt = null, drawSeq = 0;
  // 0.3.33 깜박임: 새 판의 그림 · 배경 영상 첫 장면이 준비될 때까지(최대 0.3초) 기다렸다가 바꿔 끼움 — 준비 전에 바꾸면 검은 화면이 잠깐 보임
  function ready(el, maxMs) {
    const jobs = [];
    el.querySelectorAll("img").forEach((im) => { if (!im.complete) jobs.push(im.decode ? im.decode().catch(() => {}) : new Promise((r) => { im.onload = im.onerror = r; })); });
    el.querySelectorAll("video").forEach((v) => { if (v.readyState < 2) jobs.push(new Promise((r) => { v.addEventListener("loadeddata", r, { once: true }); v.addEventListener("error", r, { once: true }); })); });
    // CSS 배경 그림(style background-image)
    el.querySelectorAll("[style*='url(']").forEach((d) => { const m = /url\(["']?([^"')]+)/.exec(d.getAttribute("style")); if (m) { const im = new Image(); im.src = m[1]; if (!im.complete) jobs.push(im.decode().catch(() => {})); } });
    if (!jobs.length) return Promise.resolve();
    return Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, maxMs))]);
  }
  async function show(st) {
    if (!st || st.seq <= lastSeq && st.seq !== 0) return;
    lastSeq = st.seq; lastSt = st;
    bar(st.bar);
    const key = JSON.stringify([st.slide, st.theme, st.flags, !!(camStream && camStream.active && st.camId)]);
    if (key === lastKey) return;
    lastKey = key;
    // 뒤쪽 판에 그린 다음 바꿔 끼우기(짧게 겹쳐 사라짐)
    const prevVideo = front.querySelector("video");
    // 대표기도 · 설교 제목: 카메라(ATEM) 화면을 아직 못 열었으면 열고 나서 다시 그림(그동안은 보통 화면)
    if (((st.slide && st.slide.camShot) || (st.flags && st.flags.cam)) && st.camId && !(camStream && camStream.active && camId === st.camId)) {
      openCam(st.camId).then(() => { if (camStream && lastSt) { const cur = lastSt; lastKey = ""; lastSeq = -1; show(cur); } });
    }
    back._tok = {}; // 이 판에 지금 그린 것 표시(옛 판 지우기가 그 뒤에 새로 그린 것을 지우지 않게)
    Render.draw(back, st.slide, st.theme, Object.assign({ play: true }, st.flags, camStream && camStream.active && st.camId ? { camStream, camBand: st.overlay && st.overlay.theme } : {}, {
      logoSlide: st.logoSlide, logoTheme: st.logoTheme, emergencySlide: st.emergencySlide, emergencyTheme: st.emergencyTheme,
    }));
    const v = back.querySelector("video.wf-media");
    if (v) {
      const seq = st.seq;
      v.addEventListener("ended", () => { if (T) T.event.emit("video-ended", { seq }); });
      // 조작 창의 미디어 칸에 영상이 어디까지 나갔는지 알림(1초마다)
      let lastT = -1;
      v.addEventListener("timeupdate", () => { const t = Math.floor(v.currentTime); if (t !== lastT && T) { lastT = t; T.event.emit("video-time", { seq, t: v.currentTime, d: v.duration || 0 }); } });
      const p = v.play(); if (p && p.catch) p.catch(() => { v.muted = true; v.play().catch(() => {}); });
    }
    Render.carryVideo(front, back); // 같은 배경 영상은 이어서
    // 넘김 방식: 바로(0) · 부드럽게(0.18초) · 천천히(0.6초) — 다음 순서 0.6초 · 검은 화면 등 0.4초 · 긴급 대기 바로
    const ms = Render.fadeFor(shownSt, st); shownSt = st;
    const my = ++drawSeq;
    if (!(st.flags && st.flags.emergency)) await ready(back, 300);
    if (my !== drawSeq) return; // 기다리는 사이 더 새 화면이 왔음(그쪽이 같은 판에 다시 그림)
    // 새 판을 위에 두고 그것만 나타나게(옛 판은 아래에서 그대로 → 중간에 검은 바탕이 비치지 않음)
    back.style.transition = "none"; back.classList.add("off", "top"); front.classList.remove("top"); back.getBoundingClientRect();
    back.style.transition = ""; back.style.transitionDuration = ms + "ms";
    back.classList.remove("off");
    const old = front, oldTok = old._tok;
    setTimeout(() => { if (prevVideo && !front.contains(prevVideo)) { prevVideo.pause(); prevVideo.removeAttribute("src"); prevVideo.load(); } if (old._tok !== oldTok || old === front) return; old.style.transition = "none"; old.classList.add("off"); old.innerHTML = ""; }, ms + 80);
    [front, back] = [back, old];
    if (T) T.event.emitTo("main", "proj-shown", { seq: st.seq, text: front.innerText.slice(0, 200), w: innerWidth, h: innerHeight });
  }

  async function start() {
    try { await document.fonts.load("700 40px 'Noto Sans KR'"); await document.fonts.load("700 40px 'Gowun Batang'"); await document.fonts.load("800 40px 'Nanum Myeongjo'"); } catch (e) {}
    if (!T) { // 브라우저 미리보기
      try { show(JSON.parse(localStorage.getItem("wf:live"))); } catch (e) {}
      if ("BroadcastChannel" in window) new BroadcastChannel("wf-live").onmessage = (e) => show(e.data);
      return;
    }
    T.event.listen("live", (e) => show(e.payload));
    const st = await T.core.invoke("get_live");
    if (st) show(st);
  }
  // 예배당 창에서 눌린 키도 조작 창으로 넘긴다(클리커가 이 창을 눌렀을 때)
  addEventListener("keydown", (e) => { if (T) T.event.emitTo("main", "proj-key", { key: e.key, code: e.code, meta: e.metaKey, ctrl: e.ctrlKey, shift: e.shiftKey }); e.preventDefault(); });
  start();
})();
