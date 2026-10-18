/* 묻고 답하기 게시판 — board.html(한국어) · en/board.html(영어)이 함께 쓴다.
   서버: 배포/게시판_서버(Cloudflare Workers + D1). 연결 주소는 board-config.js
   관리: 주소 끝에 #admin → 관리자 암호를 넣으면 답변 · 숨기기 · 고정 · 공개 · 지우기 단추가 생긴다(암호는 이 브라우저에만 저장) */
(function(){
  const EN = document.documentElement.lang === "en";
  const L = EN ? {
    cats: { "": "All", howto: "How to", buy: "Purchase", windows: "Windows", error: "Problems", idea: "Ideas" },
    answered: "✓ Answered", checking: "Checking", notice: "📌 Notice", secret: "🔒 Private post", secretBody: "Only the author and the admin can see this.",
    views: "views", photos: n => "🖼 " + n + (n > 1 ? " photos" : " photo"), back: "← Back to list", answerFrom: "Answer from Namun Jogak",
    attach: n => "🖼 " + n + " screenshot" + (n > 1 ? "s" : "") + " · click to enlarge", none: "No questions yet. Be the first to ask!",
    loading: "Loading…", fail: "Couldn’t load the board. Please try again in a moment.", notReady: "The Q&A board is being prepared. Until then, please check the FAQ or email alma9777a@gmail.com.",
    commentName: "Name", commentBody: "Write a comment", commentPost: "Post comment", sent: "Your question was posted. We’ll answer soon.", sentSecret: "Your question was posted as private. Only you (in this browser) and the admin can see it.",
    need: "Please fill in name, title and details.", agreeNeed: "Please agree to the collection of personal information.", human: "Please complete the human check.", tooMany: "Too many posts. Please try again later.", tooBig: "Each photo must be under 5 MB.",
    adminIn: "Admin password", adminGo: "Sign in", adminBad: "Wrong password.", adminOn: "Admin mode", adminOut: "Sign out",
    aAnswer: "Save answer", aHide: "Hide / show", aPin: "Pin / unpin", aPublic: "Private ↔ public", aDel: "Delete", aDelQ: "Delete this post permanently? Type DELETE to confirm.", hiddenTag: "Hidden", email: "Email",
    date: s => new Date(s.replace(" ", "T") + "Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  } : {
    cats: { "": "전체", howto: "사용법", buy: "구입·등록", windows: "Windows", error: "오류", idea: "제안" },
    answered: "✓ 답변 완료", checking: "확인 중", notice: "📌 공지", secret: "🔒 비밀글입니다", secretBody: "작성자와 관리자만 볼 수 있습니다.",
    views: "조회", photos: n => "🖼 사진 " + n, back: "← 목록으로", answerFrom: "남은 조각 답변",
    attach: n => "🖼 올린 화면 사진 " + n + "장 · 누르면 크게 보입니다", none: "아직 글이 없습니다. 처음으로 질문해 주세요!",
    loading: "불러오는 중…", fail: "게시판을 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.", notReady: "묻고 답하기 게시판을 준비하고 있습니다. 그동안은 자주 묻는 질문을 보시거나 alma9777a@gmail.com으로 메일 주세요.",
    commentName: "이름", commentBody: "댓글을 적어 주세요", commentPost: "댓글 올리기", sent: "질문이 올라갔습니다. 곧 답해 드리겠습니다.", sentSecret: "비밀글로 올라갔습니다. 이 브라우저에서 쓰신 분과 관리자만 볼 수 있습니다.",
    need: "이름 · 제목 · 내용을 적어 주세요.", agreeNeed: "개인정보 수집에 동의해 주세요.", human: "사람 확인을 마쳐 주세요.", tooMany: "글을 너무 자주 올리셨습니다. 잠시 뒤 다시 해 주세요.", tooBig: "사진은 한 장에 5MB까지입니다.",
    adminIn: "관리자 암호", adminGo: "들어가기", adminBad: "암호가 맞지 않습니다.", adminOn: "관리자 모드", adminOut: "나가기",
    aAnswer: "답변 저장", aHide: "숨기기 / 보이기", aPin: "공지로 고정 / 풀기", aPublic: "비밀글 ↔ 공개", aDel: "지우기", aDelQ: "이 글을 완전히 지울까요? 지우려면 아래에 ‘지우기’라고 적어 주세요.", hiddenTag: "숨김", email: "이메일",
    date: s => { const d = new Date(s.replace(" ", "T") + "Z"); return d.getFullYear() + ". " + (d.getMonth() + 1) + ". " + d.getDate(); }
  };
  const CFG = window.BOARD || {}, API = (CFG.api || "").replace(/\/$/, "");
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const br = s => esc(s).replace(/\n/g, "<br>");
  const ls = { get(k, d){ try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e){ return d; } }, set(k, v){ try { localStorage.setItem(k, v); } catch (e){} }, del(k){ try { localStorage.removeItem(k); } catch (e){} } };
  const myKeys = () => { try { return JSON.parse(ls.get("boardKeys", "{}")); } catch (e){ return {}; } };
  const addKey = (id, k) => { const m = myKeys(); m[id] = k; ls.set("boardKeys", JSON.stringify(m)); };
  let admin = ls.get("boardAdmin", ""), st = { cat: "", q: "", page: 1 }, tsLoaded = false;

  async function call(path, opt = {}){
    const h = Object.assign({ "content-type": "application/json" }, opt.headers || {});
    const keys = Object.values(myKeys()); if (keys.length) h["x-author-key"] = keys.join(",");
    if (admin) h.authorization = "Bearer " + admin;
    const r = await fetch(API + path, Object.assign({}, opt, { headers: h }));
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(d.error || r.status); e.status = r.status; throw e; }
    return d;
  }
  const list = $("#bList"), view = $("#bView"), form = $("#bForm"), pager = $("#bPager"), chips = $("#bChips");
  function show(which){ [["list", $("#bListWrap")], ["view", view], ["form", form]].forEach(([k, el]) => el.style.display = k === which ? "" : "none"); const fb = document.querySelector(".faqbox"); if (fb) fb.style.display = which === "list" ? "" : "none"; window.scrollTo({ top: $("#bTop").offsetTop - 70 }); }

  /* ---------- 탭: 묻고 답하기 / 자주 묻는 질문 ---------- */
  document.querySelectorAll(".tabs2 span").forEach(t => t.onclick = () => {
    document.querySelectorAll(".tabs2 span").forEach(x => x.classList.toggle("on", x === t));
    $("#bBoard").style.display = t.dataset.t === "faq" ? "none" : ""; $("#bFaq").style.display = t.dataset.t === "faq" ? "" : "none";
  });
  if (location.hash === "#faq") document.querySelector('.tabs2 span[data-t="faq"]').click();

  if (!API){ $("#bBoard").innerHTML = '<div class="note2">' + esc(L.notReady) + "</div>"; return; }

  /* ---------- 목록 ---------- */
  function paintChips(counts){
    const total = Object.values(counts || {}).reduce((a, b) => a + b, 0);
    chips.innerHTML = Object.entries(L.cats).map(([k, n]) => '<span class="chip' + (k === st.cat ? " on" : "") + '" data-c="' + k + '">' + esc(n) + " " + (k ? (counts[k] || 0) : total) + "</span>").join("");
    chips.querySelectorAll(".chip").forEach(c => c.onclick = () => { st.cat = c.dataset.c; st.page = 1; load(); });
  }
  async function load(){
    list.innerHTML = '<div class="note2">' + esc(L.loading) + "</div>";
    try {
      const d = await call("/posts?cat=" + encodeURIComponent(st.cat) + "&q=" + encodeURIComponent(st.q) + "&page=" + st.page + "&lang=" + (EN ? "en" : "ko"));
      if (admin && !d.admin){ admin = ""; ls.del("boardAdmin"); paintAdmin(); }
      paintChips(d.counts);
      if (!d.items.length){ list.innerHTML = '<div class="note2">' + esc(L.none) + "</div>"; pager.innerHTML = ""; return; }
      list.innerHTML = d.items.map(p => {
        const tags = (p.pinned ? '<span class="tag g">' + L.notice + "</span>" : '<span class="tag">' + esc(L.cats[p.cat] || p.cat) + "</span>" + (p.answered ? '<span class="tag d">' + L.answered + "</span>" : '<span class="tag w">' + L.checking + "</span>")) + (p.hidden ? '<span class="tag w">' + L.hiddenTag + "</span>" : "");
        const title = p.title ? (p.secret ? "🔒 " : "") + esc(p.title) : L.secret, body = p.title ? esc(p.body) : L.secretBody;
        const meta = "<span>" + esc(p.name) + (p.church ? " · " + esc(p.church) : "") + "</span><span>" + L.date(p.created_at) + "</span>" + (p.images ? "<span>" + L.photos(p.images) + "</span>" : "") + (p.comments ? "<span>💬 " + p.comments + "</span>" : "") + (p.title ? "<span>" + L.views + " " + p.views + "</span>" : "");
        return '<a class="post' + (p.pinned ? " pin" : "") + (p.hidden ? " hidden-flag" : "") + '" data-id="' + p.id + '"><div class="ptop">' + tags + "</div><h3>" + title + "</h3><p>" + body + '</p><div class="meta">' + meta + "</div></a>";
      }).join("");
      list.querySelectorAll(".post").forEach(a => a.onclick = () => openPost(+a.dataset.id));
      pager.innerHTML = d.pages > 1 ? Array.from({ length: d.pages }, (_, i) => '<span class="' + (i + 1 === st.page ? "on" : "") + '" data-p="' + (i + 1) + '">' + (i + 1) + "</span>").join("") : "";
      pager.querySelectorAll("span").forEach(s => s.onclick = () => { st.page = +s.dataset.p; load(); });
    } catch (e){ list.innerHTML = '<div class="note2">' + esc(L.fail) + "</div>"; }
  }
  let qT = 0; $("#bQ").addEventListener("input", e => { clearTimeout(qT); qT = setTimeout(() => { st.q = e.target.value.trim(); st.page = 1; load(); }, 350); });

  /* ---------- 글 보기 ---------- */
  function imgUrl(id, postId){ const k = myKeys()[postId]; return API + "/img/" + id + (admin ? "?t=" + encodeURIComponent(admin) : k ? "?k=" + k : ""); }
  async function openPost(id){
    show("view"); view.innerHTML = '<div class="note2">' + esc(L.loading) + "</div>";
    history.replaceState(null, "", "#p" + id);
    try {
      const p = await call("/posts/" + id);
      if (!p.title){ view.innerHTML = '<button class="back" id="bBack">' + L.back + '</button><div class="view"><h2>' + L.secret + "</h2><p>" + L.secretBody + "</p></div>"; $("#bBack").onclick = backToList; return; }
      let h = '<button class="back" id="bBack">' + L.back + '</button><div class="view"><div class="ptop"><span class="tag">' + esc(L.cats[p.cat] || p.cat) + "</span>" + (p.answer ? '<span class="tag d">' + L.answered + "</span>" : '<span class="tag w">' + L.checking + "</span>") + "</div>";
      h += "<h2>" + (p.secret ? "🔒 " : "") + esc(p.title) + '</h2><div class="meta"><span>' + esc(p.name) + (p.church ? " · " + esc(p.church) : "") + "</span><span>" + L.date(p.created_at) + "</span><span>" + L.views + " " + p.views + "</span>" + (admin && p.email ? "<span>" + L.email + ": " + esc(p.email) + "</span>" : "") + "</div>";
      h += '<div class="body">' + br(p.body) + "</div>";
      if (p.images && p.images.length) h += '<div class="att"><small>' + L.attach(p.images.length) + "</small>" + p.images.map(i => '<img src="' + imgUrl(i, p.id) + '" alt="" data-z="1" style="width:300px">').join("") + "</div>";
      if (p.answer) h += '<div class="ans"><b><img src="' + (EN ? "../" : "") + 'icon.png" alt="">' + L.answerFrom + "</b>" + br(p.answer) + "</div>";
      (p.comments || []).forEach(c => { h += '<div class="cmt"' + (c.hidden ? ' style="opacity:.5"' : "") + "><i>" + esc(c.name) + " · " + L.date(c.created_at) + (admin ? ' <button class="cmtHide" data-c="' + c.id + '" style="font-size:11px">' + L.aHide + "</button>" : "") + "</i>" + br(c.body) + "</div>"; });
      h += '<div class="form" style="padding:18px 20px;margin-top:16px">' + (admin ? "" : '<input class="in2" id="cName" placeholder="' + esc(L.commentName) + '" maxlength="40" style="margin-bottom:8px">') + '<textarea class="in2" id="cBody" placeholder="' + esc(L.commentBody) + '" maxlength="2000" style="min-height:80px"></textarea>' + (admin ? "" : '<div id="cTs" style="margin-top:10px"></div>') + '<div style="text-align:right;margin-top:10px"><a class="btn sm" id="cGo">' + L.commentPost + '</a></div><div class="err" id="cErr"></div></div>';
      if (admin){
        h += '<div class="adm" style="display:block;margin-top:16px"><textarea class="in2" id="aText" placeholder="' + esc(L.answerFrom) + '">' + esc(p.answer || "") + '</textarea><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button data-a="answer">' + L.aAnswer + '</button><button data-a="hide">' + L.aHide + '</button><button data-a="pin">' + L.aPin + '</button><button data-a="public">' + L.aPublic + '</button><button data-a="delete" style="color:#c0392b">' + L.aDel + "</button></div></div>";
      }
      view.innerHTML = h + "</div>";
      $("#bBack").onclick = backToList;
      view.querySelectorAll("[data-z]").forEach(i => i.onclick = () => zoom(i.src));
      if (!admin) mountTs("#cTs");
      $("#cGo").onclick = async () => {
        const body = $("#cBody").value.trim(), name = admin ? "" : $("#cName").value.trim();
        if (!body || (!admin && !name)) { $("#cErr").textContent = L.need; return; }
        try { await call("/posts/" + id + "/comments", { method: "POST", body: JSON.stringify({ name, body, turnstile: tsToken("#cTs") }) }); openPost(id); }
        catch (e){ $("#cErr").textContent = e.status === 403 ? L.human : e.status === 429 ? L.tooMany : L.fail; tsReset("#cTs"); }
      };
      view.querySelectorAll(".cmtHide").forEach(b => b.onclick = async () => { await call("/posts/" + id + "/hidecomment", { method: "POST", body: JSON.stringify({ comment: b.dataset.c }) }); openPost(id); });
      view.querySelectorAll(".adm [data-a]").forEach(b => b.onclick = async () => {
        const a = b.dataset.a;
        if (a === "delete"){ const w = window.prompt(L.aDelQ); if (w !== (EN ? "DELETE" : "지우기")) return; await call("/posts/" + id, { method: "DELETE" }); backToList(); return; }
        await call("/posts/" + id + "/" + a, { method: "POST", body: JSON.stringify({ text: $("#aText").value }) }); openPost(id);
      });
    } catch (e){ view.innerHTML = '<button class="back" id="bBack">' + L.back + '</button><div class="note2">' + esc(L.fail) + "</div>"; $("#bBack").onclick = backToList; }
  }
  function backToList(){ history.replaceState(null, "", location.pathname); show("list"); load(); }
  function zoom(src){ const z = $("#bZoom"); z.querySelector("img").src = src; z.classList.add("on"); }
  $("#bZoom").onclick = () => $("#bZoom").classList.remove("on");

  /* ---------- 사람 확인(Cloudflare Turnstile) ---------- */
  function loadTs(cb){
    if (!CFG.sitekey) return cb && cb();
    if (window.turnstile) return cb && cb();
    if (!tsLoaded){ tsLoaded = true; const s = document.createElement("script"); s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.async = true; document.head.append(s); }
    const t = setInterval(() => { if (window.turnstile){ clearInterval(t); cb && cb(); } }, 120);
  }
  const tsIds = {};
  function mountTs(sel){ loadTs(() => { const el = $(sel); if (!el || !window.turnstile || !CFG.sitekey) return; el.innerHTML = ""; tsIds[sel] = window.turnstile.render(el, { sitekey: CFG.sitekey, language: EN ? "en" : "ko" }); }); }
  const tsToken = sel => (window.turnstile && tsIds[sel] != null) ? window.turnstile.getResponse(tsIds[sel]) : "";
  const tsReset = sel => { if (window.turnstile && tsIds[sel] != null) window.turnstile.reset(tsIds[sel]); };

  /* ---------- 질문하기 ---------- */
  let shots = [];
  $("#bAsk").onclick = () => { show("form"); mountTs("#fTs"); };
  $("#fCancel").onclick = () => show("list");
  async function shrink(file){
    if (file.size > 5 * 1024 * 1024) throw new Error("big");
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(file); });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    let q = .85, url = c.toDataURL("image/jpeg", q);
    while (url.length * .75 > 600 * 1024 && q > .4){ q -= .1; url = c.toDataURL("image/jpeg", q); }
    return { mime: "image/jpeg", b64: url.split(",")[1], url };
  }
  function paintShots(){
    $("#fThumbs").innerHTML = shots.map((s, i) => '<div class="th"><img src="' + s.url + '" alt=""><span data-i="' + i + '">✕</span></div>').join("");
    $("#fThumbs").querySelectorAll("span").forEach(x => x.onclick = () => { shots.splice(+x.dataset.i, 1); paintShots(); });
    if (shots.length){ $("#fSecret").checked = true; $("#fSecret").disabled = true; } else $("#fSecret").disabled = false;
  }
  async function addFiles(files){
    $("#fErr").textContent = "";
    for (const f of [...files].filter(f => /^image\//.test(f.type))){ if (shots.length >= 3) break; try { shots.push(await shrink(f)); } catch (e){ $("#fErr").textContent = L.tooBig; } }
    paintShots();
  }
  $("#fFile").onchange = e => addFiles(e.target.files);
  const up = $("#fUp");
  up.onclick = () => $("#fFile").click();
  up.addEventListener("dragover", e => { e.preventDefault(); up.style.borderColor = "var(--gold)"; });
  up.addEventListener("dragleave", () => { up.style.borderColor = ""; });
  up.addEventListener("drop", e => { e.preventDefault(); up.style.borderColor = ""; addFiles(e.dataTransfer.files); });
  $("#fGo").onclick = async () => {
    const v = id => $(id).value.trim(), err = $("#fErr"); err.textContent = "";
    const d = { lang: EN ? "en" : "ko", name: v("#fName"), church: v("#fChurch"), email: v("#fMail"), cat: $("#fCat").value, title: v("#fTitle"), body: v("#fBody"), secret: $("#fSecret").checked, agree: $("#fAgree").checked, images: shots.map(s => ({ mime: s.mime, b64: s.b64 })), turnstile: tsToken("#fTs") };
    if (!d.name || !d.title || !d.body){ err.textContent = L.need; return; }
    if (!d.agree){ err.textContent = L.agreeNeed; return; }
    if (CFG.sitekey && !d.turnstile){ err.textContent = L.human; return; }
    $("#fGo").style.pointerEvents = "none";
    try {
      const r = await call("/posts", { method: "POST", body: JSON.stringify(d) });
      addKey(r.id, r.key);
      ["#fTitle", "#fBody"].forEach(s => $(s).value = ""); shots = []; paintShots(); tsReset("#fTs");
      window.alert(r.secret ? L.sentSecret : L.sent);
      openPost(r.id);
    } catch (e){ err.textContent = e.status === 403 ? L.human : e.status === 429 ? L.tooMany : L.fail; tsReset("#fTs"); }
    $("#fGo").style.pointerEvents = "";
  };

  /* ---------- 관리자 ---------- */
  function paintAdmin(){
    const box = $("#bAdmin"); if (!box) return;
    if (location.hash !== "#admin" && !admin){ box.style.display = "none"; return; }
    box.style.display = "";
    box.innerHTML = admin ? '<span class="tag d">' + L.adminOn + '</span> <a class="btn ghost sm" id="adOut">' + L.adminOut + "</a>"
      : '<input class="in2" type="password" id="adPw" placeholder="' + esc(L.adminIn) + '" style="max-width:260px;display:inline-block"> <a class="btn sm" id="adGo">' + L.adminGo + '</a> <span class="err" id="adErr"></span>';
    if (admin) $("#adOut").onclick = () => { admin = ""; ls.del("boardAdmin"); paintAdmin(); load(); };
    else $("#adGo").onclick = async () => {
      const pw = $("#adPw").value; admin = pw;
      try { const d = await call("/admin/check"); if (!d.admin) throw 0; ls.set("boardAdmin", pw); paintAdmin(); load(); }
      catch (e){ admin = ""; $("#adErr").textContent = L.adminBad; }
    };
  }
  paintAdmin();
  const m = location.hash.match(/^#p(\d+)$/);
  if (m) openPost(+m[1]); else { show("list"); load(); }
})();
