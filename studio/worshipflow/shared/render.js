// 화면 한 장 그리기 — 미리보기와 예배당 화면이 이 코드 하나로 그린다.
// 늘 1920×1080 크기로 그리고, 미리보기는 CSS로 줄여서 보여 준다(줄 바꿈이 똑같이 나오게).
(function (G) {
  const W = 1920, H = 1080;
  const FONTS = {
    noto: { family: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif", weight: 700, name: "본고딕 굵게" },
    notoM: { family: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif", weight: 500, name: "본고딕 보통" },
    batang: { family: "'Gowun Batang', 'AppleMyungjo', serif", weight: 700, name: "고운바탕 굵게" },
    myeongjo: { family: "'Nanum Myeongjo', 'AppleMyungjo', serif", weight: 800, name: "나눔명조 굵게" },
  };

  // 기본 모양. 항목 종류마다 조금씩 다르게 덮어쓴다.
  const BASE = {
    font: "noto", size: 72, minSize: 44, maxLines: 3, lineHeight: 1.45,
    color: "#ffffff", accent: "#f5c84c", align: "center", valign: "middle",
    margin: 5, bg: "#000000", bgMedia: "", dim: 0, shadow: true,
    refPos: "top", refColor: "#f5c84c", refSize: 40,
  };
  const KIND_THEME = {
    song: { size: 76, maxLines: 2, refPos: "none" },
    scripture: { size: 64, maxLines: 3, refPos: "top" },
    sermon: { size: 64, maxLines: 3, refPos: "top" },
    fixed: { size: 60, maxLines: 4, refPos: "none" },
    text: { size: 72, maxLines: 3, refPos: "none" },
    prayer: { refPos: "none" },
    media: { refPos: "none" },
    standby: { refPos: "none" },
  };
  function themeFor(kind, lib, item) {
    const t = Object.assign({}, BASE, KIND_THEME[kind] || {});
    const glob = lib && lib.themes && lib.themes[kind];
    if (glob) Object.assign(t, glob);
    if (item && item.theme) Object.assign(t, item.theme);
    return t;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  // **강조** → 강조색, 줄 바꿈 유지
  function markup(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, '<span class="wf-acc">$1</span>').replace(/\n/g, "<br>");
  }

  // stage: 1920×1080 div. slide: {kind, text, ref, title, sub, name, role, media:{url, video}, section}
  // flags: {black, clear, logo, emergency, logoSlide, emergencySlide}
  // 돌려주는 값: {lines, size, overflow}
  function draw(stage, slide, theme, flags) {
    flags = flags || {};
    stage.classList.add("wf-stage");
    stage.style.width = W + "px"; stage.style.height = H + "px";
    if (flags.emergency && flags.emergencySlide) return draw(stage, flags.emergencySlide, flags.emergencyTheme || theme, {});
    if (flags.logo && flags.logoSlide) return draw(stage, flags.logoSlide, flags.logoTheme || theme, {});
    stage.innerHTML = "";
    stage.style.background = "#000";
    // 투명 화면(V · ‘투명 화면’ 순서 · 화면): 예배당 TV는 카메라(없으면 검은 화면), 생중계는 자막 없이 카메라만
    if (flags.cam && !flags.black) slide = { kind: "cam", camShot: true };
    if (flags.black || !slide) return { lines: 0, size: 0, overflow: false };
    if (slide.kind === "cam" && !(slide.camShot && flags.camStream)) {
      if (flags.hint) { const h = document.createElement("div"); h.className = "wf-camhint"; h.textContent = "투명 화면 · 카메라"; Object.assign(h.style, { position: "absolute", inset: "0", display: "grid", placeItems: "center", color: "#7f8aa3", font: "700 64px 'Noto Sans KR', sans-serif", border: "6px dashed #3a4256" }); stage.appendChild(h); }
      return { lines: 0, size: 0, overflow: false };
    }
    // 대표기도 · 설교 제목: 카메라(ATEM)가 있으면 카메라 화면 + 아래 이름 · 제목 띠
    if (slide.camShot && flags.camStream) {
      const v = document.createElement("video");
      v.className = "wf-cam"; v.muted = true; v.autoplay = true; v.playsInline = true; v.srcObject = flags.camStream;
      Object.assign(v.style, { position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover" });
      stage.appendChild(v); v.play().catch(() => {});
      if (!flags.clear) {
        const ov = document.createElement("div"); Object.assign(ov.style, { position: "absolute", left: "0", top: "0" });
        stage.appendChild(ov); drawOverlay(ov, slide, flags.camBand || null, {});
      }
      return { lines: 1, size: 0, overflow: false };
    }
    if (slide.kind === "titlecard") { drawTitleCard(stage, slide.tc || {}, flags); return { lines: 1, size: 0, overflow: false }; }
    // 화면에서 직접 고친 것(이 화면만): 글 상자 자리 · 크기 · 글자 크기 · 정렬
    const t0 = theme || BASE;
    const t = slide.kind === "text" && (slide.tbox || slide.tsize || slide.talign) ? Object.assign({}, t0, slide.tbox ? { box: slide.tbox } : {}, slide.tsize ? { size: slide.tsize } : {}, slide.talign ? { align: slide.talign } : {}) : t0;
    const f = FONTS[t.font] || FONTS.noto;

    // 배경
    stage.style.background = t.bg || "#000";
    const bgUrl = slide.bgUrl || t.bgUrl;
    if (bgUrl) {
      const isV = /\.(mp4|mov|m4v|webm)(\?|$)/i.test(bgUrl);
      if (isV && !flags.play) stage.appendChild(stillOf(bgUrl)); // 작은 미리보기: 멈춘 한 장면
      else {
        const bg = document.createElement(isV ? "video" : "img");
        bg.className = "wf-bg"; bg.src = bgUrl;
        if (bg.tagName === "VIDEO") { bg.muted = true; bg.loop = true; bg.autoplay = !!flags.play; bg.playsInline = true; }
        stage.appendChild(bg);
      }
      if (false && t.dim) { /* 0.3.33 목사님: 화면 글 배경 어둡게는 뺌(글자 그림자 · 테두리로) */ const d = document.createElement("div"); d.className = "wf-dim"; d.style.opacity = t.dim / 100; stage.appendChild(d); }
    }

    if (slide.kind === "design") { drawDesign(stage, slide, flags); return { lines: 1, size: 0, overflow: false }; }
    if (slide.kind === "media") {
      if (slide.media && slide.media.url) {
        const isVid = slide.media.video;
        const m = document.createElement(isVid ? "video" : "img");
        m.className = "wf-media"; m.src = slide.media.url;
        if (isVid) {
          m.playsInline = true; m.preload = "auto";
          m.muted = !flags.play || !!slide.media.mute || !!flags.silent; // silent: 조작 창 미리보기(움직이되 소리는 예배당 화면에서만)
          if (flags.play) { m.autoplay = true; m.loop = !!slide.media.loop; }
          else { m.currentTime = 0.5; }
        }
        stage.appendChild(m);
        if (slide.caption) stage.appendChild(captionBand(slide.caption));
        if (slide.cd && slide.cd.on) drawCountdown(stage, Object.assign({}, slide.cd, { design: "over", cdUntil: slide.cd.cdUntil }));
      } else if (slide.text) {
        // 그림 없이 글만 있는 광고
      } else {
        return { lines: 0, size: 0, overflow: false, missing: !!(slide.media && slide.media.missing) };
      }
      if (!slide.text) return { lines: 0, size: 0, overflow: false, missing: !!(slide.media && slide.media.missing) };
    }
    if (flags.clear) return { lines: 0, size: 0, overflow: false };

    const box = document.createElement("div");
    box.className = "wf-box";
    const mx = W * t.margin / 100, my = H * t.margin / 100;
    Object.assign(box.style, {
      left: mx + "px", right: mx + "px", top: my + "px", bottom: my + "px",
      fontFamily: f.family, color: t.color, textAlign: t.align,
      justifyContent: t.valign === "bottom" ? "flex-end" : t.valign === "top" ? "flex-start" : "center",
      alignItems: t.align === "left" ? "flex-start" : "center",
    });
    // 0.3.33 글자 돋보이게(목사님: 밝은 배경 영상은 어둡게 대신 — 기본 그림자): shadow 그림자 · stroke 검정 테두리 · strokeG 교회색 테두리 + 약한 그림자 · none
    const edge = t.edge || (t.shadow === false ? "none" : "shadow");
    const SH = "0 3px 10px rgba(0,0,0,.85), 0 0 3px rgba(0,0,0,.9)";
    Object.assign(box.style, edge === "stroke" ? { webkitTextStroke: "0.12em #111", paintOrder: "stroke fill", textShadow: "none" }
      : edge === "strokeG" ? { webkitTextStroke: "0.09em " + (t.edgeColor || "#17402c"), paintOrder: "stroke fill", textShadow: "0 3px 10px rgba(0,0,0,.5)" }
      : { textShadow: edge === "none" ? "none" : SH });
    // 글 상자를 끌어 옮기거나 크기를 바꾼 경우(t.box = 1920×1080 기준 x · y · w · h)
    if (t.box && slide.kind === "text") Object.assign(box.style, { left: t.box.x + "px", top: t.box.y + "px", width: t.box.w + "px", height: t.box.h + "px", right: "auto", bottom: "auto" });
    stage.appendChild(box);
    stage.style.setProperty("--wf-acc", t.accent);

    // 기도 이름표 · 설교 제목 · 대기 화면은 고정 배치
    if (slide.kind === "prayer") {
      box.style.justifyContent = "flex-end";
      box.innerHTML = `<div class="wf-role" style="font-weight:${f.weight - 200}">${esc(slide.role || "대표기도")}</div><div class="wf-name" style="font-weight:${f.weight}">${esc(slide.name || "")}</div>`;
      return { lines: 1, size: 96, overflow: false };
    }
    if (slide.kind === "title") {
      box.innerHTML = (slide.sub ? `<div class="wf-sub" style="color:${t.refColor}">${esc(slide.sub)}</div>` : "") +
        `<div class="wf-title" style="font-weight:${f.weight}">${markup(slide.title || slide.text || "")}</div>` +
        (slide.foot ? `<div class="wf-foot">${esc(slide.foot)}</div>` : "");
      const tt = box.querySelector(".wf-title");
      let s = 112; tt.style.fontSize = s + "px";
      while (tt.scrollHeight > s * 1.35 * 2 + 4 && s > 64) { s -= 4; tt.style.fontSize = s + "px"; }
      return { lines: 1, size: s, overflow: false };
    }
    if (slide.kind === "standby" && slide.design && CD_DESIGNS[slide.design]) { stage.innerHTML = ""; drawCountdown(stage, slide, flags); return { lines: 1, size: 64, overflow: false }; }
    if (slide.kind === "standby") {
      box.innerHTML = (slide.logoUrl ? `<img class="wf-logo" src="${esc(slide.logoUrl)}">` : "") +
        (slide.text ? `<div class="wf-standby" style="font-weight:${f.weight}">${markup(slide.text)}</div>` : "") +
        (slide.sub ? `<div class="wf-foot">${esc(slide.sub)}</div>` : "") +
        (slide.countTo ? `<div class="wf-count" data-to="${esc(slide.countTo)}"></div>` : "");
      tickCounts(box);
      return { lines: 1, size: 64, overflow: false };
    }

    // 장절 표시
    const ref = slide.ref && t.refPos !== "none" ? slide.ref : "";
    const refEl = document.createElement("div");
    refEl.className = "wf-ref";
    refEl.textContent = ref;
    Object.assign(refEl.style, { color: t.refColor, fontSize: t.refSize + "px", fontWeight: f.weight - 100 });
    const txt = document.createElement("div");
    txt.className = "wf-text";
    txt.innerHTML = markup(slide.text || "");
    Object.assign(txt.style, { fontWeight: f.weight, lineHeight: t.lineHeight });
    if (slide.leader) txt.classList.add("wf-leader"); // 교독문: 인도자 줄
    if (ref && t.refPos === "top") box.appendChild(refEl);
    box.appendChild(txt);
    // 두 역본 함께: 둘째 역본은 아래에 작게(0.68배) 연한 색으로
    let txt2 = null;
    if (slide.text2) {
      txt2 = document.createElement("div");
      txt2.className = "wf-text wf-text2";
      txt2.innerHTML = markup(slide.text2);
      Object.assign(txt2.style, { fontWeight: Math.max(400, f.weight - 200), lineHeight: 1.35 });
      box.appendChild(txt2);
    }
    if (ref && t.refPos === "bottom") box.appendChild(refEl);

    return fit(txt, box, t, ref ? t.refSize * 1.6 : 0, txt2);
  }

  // 파워포인트에서 모양 그대로 가져온 ‘디자인 화면’: 글상자 · 도형 · 표 · 그림을 같은 자리에
  function drawDesign(stage, slide, flags) {
    stage.style.background = slide.bg || "#fff";
    // 그림 주소는 조작 창(resolveSlide)에서 미리 붙여 보낸다(예배당 창에는 저장 도구가 없음)
    const url = (f, src) => src || (f && G.Store ? G.Store.mediaUrl(f) : "");
    if (slide.bgFile) { const im = document.createElement("img"); im.className = "wf-bg"; im.src = url(slide.bgFile, slide.bgSrc); stage.appendChild(im); }
    const textHtml = (t) => {
      if (!t) return "";
      return t.paras.map((p) => `<div style="text-align:${p.algn};line-height:${p.lh};padding-left:${p.indent * 1.2}em">${p.bullet ? `<span style="margin-right:.4em">${esc(p.bullet)}</span>` : ""}${p.runs.length ? p.runs.map((r) => r.tx === "\n" ? "<br>" : `<span style="font-size:${r.sz}px;color:${r.color};font-weight:${r.b ? 700 : 400};font-style:${r.i ? "italic" : "normal"};font-family:${r.font}${r.sp ? `;letter-spacing:${r.sp}px` : ""}">${esc(r.tx)}</span>`).join("") : "&nbsp;"}</div>`).join("");
    };
    for (const e of slide.els || []) {
      const d = document.createElement("div");
      Object.assign(d.style, { position: "absolute", left: e.x + "px", top: e.y + "px", width: Math.max(1, e.w) + "px", height: Math.max(1, e.h) + "px", boxSizing: "border-box",
        transform: (e.rot ? `rotate(${e.rot}deg)` : "") + (e.flipH ? " scaleX(-1)" : "") });
      if (e.t === "video") {
        const v = document.createElement("video");
        Object.assign(v.style, { width: "100%", height: "100%", objectFit: "contain", display: "block", background: "#000" });
        v.src = url(e.file, e.src); v.playsInline = true; v.muted = !flags.play || !!flags.silent; v.preload = "auto";
        if (flags.play) { v.autoplay = true; if (e.start) v.addEventListener("loadedmetadata", () => (v.currentTime = e.start), { once: true }); if (e.end) v.addEventListener("timeupdate", () => { if (v.currentTime >= e.end) v.pause(); }); }
        else v.addEventListener("loadedmetadata", () => (v.currentTime = (e.start || 0) + 0.5), { once: true });
        if (e.poster) v.poster = url(e.poster, e.posterSrc);
        d.appendChild(v);
      } else if (e.t === "pic") {
        d.innerHTML = e.file ? `<img src="${url(e.file, e.src)}" style="width:100%;height:100%;object-fit:fill;display:block">` : "";
      } else if (e.t === "line") {
        Object.assign(d.style, { height: "0", borderTop: `${(e.line && e.line.w) || 2}px solid ${(e.line && e.line.color) || "#000"}` });
      } else if (e.t === "table") {
        const tw = e.cols.reduce((a, b) => a + b, 0) || e.w;
        d.innerHTML = `<table style="border-collapse:collapse;width:${tw}px;table-layout:fixed">${e.cols.map((w) => `<col style="width:${w}px">`).join("")}${e.rows.map((r) => `<tr style="height:${r.h}px">${r.cells.filter((c) => !c.merged).map((c) => `<td colspan="${c.span}" style="border:1px solid rgba(0,0,0,.25);background:${c.fill && c.fill !== "none" ? c.fill : "transparent"};vertical-align:middle;padding:4px 8px">${flags.clear ? "" : textHtml(c.text)}</td>`).join("")}</tr>`).join("")}</table>`;
      } else {
        const radius = e.geom === "ellipse" ? "50%" : /round/i.test(e.geom || "") ? Math.min(e.w, e.h) * 0.12 + "px" : "0";
        Object.assign(d.style, { background: e.fillFile ? `url("${url(e.fillFile, e.fillSrc)}") center/cover` : e.fill && e.fill !== "none" ? e.fill : "transparent", borderRadius: radius,
          border: e.line ? `${e.line.w}px solid ${e.line.color}` : "none", display: "flex", flexDirection: "column", justifyContent: e.text ? e.text.anchor : "flex-start" });
        if (e.text && !flags.clear) {
          Object.assign(d.style, { padding: e.text.ins.map((v) => v + "px").join(" ") .replace(/^(\S+) (\S+) (\S+) (\S+)$/, "$2 $3 $4 $1") });
          // 파워포인트에서 ‘줄 바꿈 안 함’ 글상자는 상자 밖으로 이어 씀
          d.innerHTML = `<div style="${e.text.nowrap ? "white-space:nowrap" : "word-break:keep-all;overflow-wrap:anywhere"}">${textHtml(e.text)}</div>`;
        }
      }
      stage.appendChild(d);
    }
  }

  // 글자 크기 맞추기: 최대 줄 수와 상자 높이 안에 들어갈 때까지 줄인다.
  function fit(txt, box, t, reserve, txt2) {
    const availH = (t.box ? t.box.h : H * (1 - 2 * t.margin / 100)) - reserve;
    let s = t.size, lines = 0, total = 0;
    const minS = txt2 ? Math.min(t.minSize, 36) : t.minSize;
    for (;;) {
      txt.style.fontSize = s + "px";
      if (txt2) txt2.style.fontSize = Math.round(s * 0.68) + "px";
      const lh = s * t.lineHeight;
      lines = Math.round(txt.scrollHeight / lh);
      total = txt.scrollHeight + (txt2 ? txt2.scrollHeight + 24 : 0);
      if ((lines <= t.maxLines && total <= availH) || s <= minS) break;
      s -= 2;
    }
    return { lines, size: s, overflow: lines > t.maxLines || total > availH };
  }

  // 화면에 그리지 않고 줄 수만 재는 숨은 무대(성경 나누기에 씀)
  let probe = null;
  function measure(text, theme) {
    if (!probe) {
      probe = document.createElement("div");
      Object.assign(probe.style, { position: "fixed", left: "-30000px", top: "0", visibility: "hidden", pointerEvents: "none" });
      document.body.appendChild(probe);
    }
    const t = Object.assign({}, theme, { minSize: theme.size }); // 기본 크기 그대로 줄 수를 잰다
    return draw(probe, { kind: "text", text, ref: "" }, t, {});
  }

  // 성경 구절 → 화면들. mode: 'fit'(글자 수에 맞춰) | '1'(한 화면 한 절) | '2'(두 절)
  // 절 번호는 글 앞에 작게 붙이지 않고, 장절 표시(위쪽)에 "요 13:1-2" 로 보인다.
  function splitVerses(verses, theme, mode, labelFn) {
    const slides = [];
    const mk = (group, text) => ({ kind: "text", text, ref: labelFn(group), verses: group.map((v) => v.c + ":" + v.v) });
    if (mode === "1" || mode === "2") {
      const n = +mode;
      for (let i = 0; i < verses.length; i += n) {
        const g = verses.slice(i, i + n);
        for (const piece of splitLong(g.map((v) => v.text).join(" "), theme)) slides.push(mk(g, piece));
      }
      return slides;
    }
    let group = [], text = "";
    for (const v of verses) {
      const tryText = text ? text + " " + v.text : v.text;
      if (group.length && measure(tryText, theme).lines > theme.maxLines) {
        slides.push(mk(group, text));
        group = []; text = "";
      }
      if (!group.length && measure(v.text, theme).lines > theme.maxLines) {
        // 한 절이 너무 길면 문장 · 쉼표에서 나눈다
        for (const piece of splitLong(v.text, theme)) slides.push(mk([v], piece));
        continue;
      }
      group.push(v); text = text ? text + " " + v.text : v.text;
    }
    if (group.length) slides.push(mk(group, text));
    return slides;
  }

  // 긴 글을 최대 줄 수에 맞게 낱말 단위로 나눈다. 가능하면 문장 끝(다 · 라 · 니 · . ,)에서.
  function splitLong(text, theme) {
    if (measure(text, theme).lines <= theme.maxLines) return [text];
    const words = text.split(/\s+/);
    const out = [];
    let cur = [];
    for (let i = 0; i < words.length; i++) {
      const next = cur.concat(words[i]);
      if (cur.length && measure(next.join(" "), theme).lines > theme.maxLines) {
        // 되돌아가며 끊기 좋은 곳 찾기
        let cut = cur.length;
        for (let k = cur.length - 1; k >= Math.ceil(cur.length * 0.55); k--) {
          if (/[.,:;!?]$|(고|며|니|되|서|나|매|하여|하사|더니)$/.test(cur[k])) { cut = k + 1; break; }
        }
        out.push(cur.slice(0, cut).join(" "));
        cur = cur.slice(cut).concat(words[i]);
      } else cur = next;
    }
    if (cur.length) out.push(cur.join(" "));
    return out;
  }

  // 가사 · 고정 문구 글 → 화면들. 빈 줄 = 화면 나눔, [1절] [후렴] = 부분 이름.
  function splitLyrics(text) {
    const sections = [];
    let cur = null;
    const blocks = String(text || "").replace(/\r/g, "").split(/\n/);
    let buf = [];
    const flush = () => {
      if (buf.length) {
        if (!cur) { cur = { name: "", slides: [] }; sections.push(cur); }
        cur.slides.push(buf.join("\n").trim());
      }
      buf = [];
    };
    for (const raw of blocks) {
      const line = raw.trim();
      const m = line.match(/^\[(.+?)\]$/);
      if (m) { flush(); cur = { name: m[1].trim(), slides: [] }; sections.push(cur); continue; }
      if (!line) { flush(); continue; }
      buf.push(line);
    }
    flush();
    return sections.filter((s) => s.slides.length);
  }

  // 부분 이름 → 단축키 글자(1 · 2 · 3 · R · G · E)
  function sectionKey(name) {
    const n = String(name || "");
    let m = n.match(/^(\d+)\s*절?$/) || n.match(/^(?:verse|v)\s*(\d+)$/i);
    if (m) return m[1];
    if (/후렴|chorus|refrain|^c$/i.test(n)) return "R";
    if (/브리지|bridge|^b$/i.test(n)) return "G";
    if (/엔딩|ending|outro|코다/i.test(n)) return "E";
    if (/전주|intro/i.test(n)) return "I";
    return "";
  }

  // ── 순서 제목 화면(순서 맨 앞 한 장): 바탕(자막바 디자인 · 그림 · 영상) + 글 줄들 ──
  // tc = { kind: 디자인 모양, color, bg: design|image|video, url, dim, deco, lines: [{ t, st: big|who|small|word, pos: 9칸, dx, dy }] }
  const TC_POS = { tl: [0.12, 0.18, "left"], tc: [0.5, 0.18, "center"], tr: [0.88, 0.18, "right"], ml: [0.14, 0.5, "left"], mc: [0.5, 0.5, "center"], mr: [0.88, 0.5, "right"], bl: [0.12, 0.82, "left"], bc: [0.5, 0.82, "center"], br: [0.88, 0.82, "right"] };
  const TC_SERIF = ["frame", "gold", "glass", "twotone", "clean"]; // clean: 테두리 · 장식 없이(0.3.33, 순서 자막바가 단색 · 내 그림일 때)
  function tcShade(hex, k) { const n = parseInt(String(hex || "#1b2448").slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, "0"); return "#" + f(n >> 16) + f((n >> 8) & 255) + f(n & 255); }
  function tcDeco(kind, c, g) {
    if (kind === "clean") return "";
    if (kind === "frame") return `<div style="position:absolute;inset:70px;border:3px solid ${g}"></div><div style="position:absolute;inset:88px;border:1px solid ${g};opacity:.45"></div>` + [[70, 70], [1850, 70], [70, 1010], [1850, 1010]].map(([x, y]) => `<i style="position:absolute;left:${x - 13}px;top:${y - 13}px;width:26px;height:26px;background:${g};transform:rotate(45deg)"></i>`).join("");
    if (kind === "capsule") return `<div style="position:absolute;left:300px;right:300px;top:390px;height:300px;border-radius:200px;border:3px solid rgba(217,184,106,.5);background:linear-gradient(90deg,${tcShade(c, 1.15)},${tcShade(c, 0.8)});box-shadow:0 40px 90px rgba(0,0,0,.45)"></div><i style="position:absolute;left:390px;top:512px;width:56px;height:56px;border-radius:50%;background:${g};box-shadow:0 0 0 10px ${tcShade(c, 1.15)},0 0 0 14px ${g}"></i>`;
    if (kind === "ribbon") return `<i style="position:absolute;left:60px;top:-80px;width:34px;height:1300px;background:${g};transform:skewX(-14deg)"></i><i style="position:absolute;left:120px;top:-80px;width:14px;height:1300px;background:${g};opacity:.6;transform:skewX(-14deg)"></i>`;
    if (kind === "glass") return `<i style="position:absolute;left:0;top:0;bottom:0;width:60px;background:${c}"></i><i style="position:absolute;left:60px;right:0;bottom:0;height:8px;background:${g}"></i>`;
    if (kind === "gold") return `<i style="position:absolute;left:0;top:0;bottom:0;width:26px;background:${g}"></i><div style="position:absolute;inset:60px 60px 60px 86px;border:2px solid ${g};opacity:.45;border-radius:14px"></div>`;
    if (kind === "twotone") return `<i style="position:absolute;left:0;top:0;bottom:0;width:150px;background:${g}"></i>`;
    if (kind === "bracket") return `<i style="position:absolute;left:110px;top:300px;width:18px;height:480px;background:${g}"></i><i style="position:absolute;right:110px;top:300px;width:18px;height:480px;background:${g}"></i>`;
    return `<i style="position:absolute;left:120px;right:120px;bottom:90px;height:4px;background:${g}"></i>`;
  }
  // 제목 화면 한 줄이 화면 밖으로 나가면(긴 곡 이름) 글자를 줄여 양옆 80px 안에 — 줄의 가운데 높이는 그대로
  function fitTcLines(box) {
    box.querySelectorAll(".wf-tcl").forEach((el) => {
      if (!el.dataset.fs) el.dataset.fs = parseFloat(el.style.fontSize || getComputedStyle(el).fontSize) || 0;
      if (!el.dataset.top) el.dataset.top = parseFloat(el.style.top) || 0;
      const fs0 = +el.dataset.fs; if (!fs0) return;
      el.style.fontSize = fs0 + "px"; el.style.top = el.dataset.top + "px";
      const al = el.dataset.al, px = +el.dataset.px, max = al === "left" ? W * (1 - px) - 80 : al === "right" ? W * px - 80 : W - 160;
      const w = el.scrollWidth; if (!w || w <= max) return;
      const fs = Math.floor((fs0 * max) / w);
      el.style.fontSize = fs + "px"; el.style.top = (+el.dataset.top + ((fs0 - fs) * 1.3) / 2) + "px";
    });
  }
  function drawTitleCard(stage, tc, flags) {
    const c = tc.color || "#1b2448", g = "#d9b86a", kind = tc.kind || "plain", media = (tc.bg === "image" || tc.bg === "video") && tc.url, plain = tc.bg === "text"; // 글자만: 검은 바탕에 글만(0.3.23)
    const light = kind === "glass" && !media && tc.bg !== "text", serif = TC_SERIF.includes(kind);
    stage.style.background = "#000";
    const box = document.createElement("div"); box.className = "wf-tc"; Object.assign(box.style, { position: "absolute", inset: "0", overflow: "hidden" });
    let h = "";
    if (media) {
      h += tc.bg === "video" ? (flags.play || flags.fullPlay ? `<video class="wf-tcbg" src="${esc(tc.url)}" muted loop playsinline preload="auto" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>` : `<i class="wf-tcstill"></i>`) : `<img class="wf-tcbg" src="${esc(tc.url)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`;
      h += `<div style="position:absolute;inset:0;background:#000;opacity:0"></div>`;
      if (tc.deco) h += tcDeco(kind, c, g);
    } else if (plain) h += `<div style="position:absolute;inset:0;background:#000"></div>`;
    else h += (light ? `<div style="position:absolute;inset:0;background:linear-gradient(135deg,#f7f4ee,#e7e1d4)"></div>` : `<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,${c} 0%,${tcShade(c, 0.55)} 100%)"></div>`) + tcDeco(kind, c, g);
    const fg = light ? c : "#ffffff";
    const ST = { big: { css: serif ? `font:800 190px 'Nanum Myeongjo',serif;letter-spacing:.14em` : `font:900 200px 'Noto Sans KR',sans-serif;letter-spacing:.04em`, color: fg, size: 200 },
      who: { css: `font:600 56px 'Noto Sans KR',sans-serif;letter-spacing:.2em`, color: light ? "#a8873a" : g, size: 56 },
      small: { css: `font:600 52px 'Noto Sans KR',sans-serif`, color: light ? "#6b6f7a" : "#efe6cf", size: 52 },
      word: { css: `font:500 46px 'Nanum Myeongjo',serif`, color: light ? "#7a7f8a" : "rgba(255,255,255,.82)", size: 46 } };
    // 같은 칸의 줄은 위아래로 차례로 쌓고, dx · dy(끌어 옮긴 만큼)를 더함
    const lines = (tc.lines || []).filter((l) => l && String(l.t || "").trim());
    const by = {}; lines.forEach((l, i) => (by[l.pos || "mc"] = by[l.pos || "mc"] || []).push([l, (tc.lines || []).indexOf(l)]));
    for (const [p, ls] of Object.entries(by)) {
      const [px, py, al] = TC_POS[p] || TC_POS.mc, hOf = (l) => (ST[l.st] || ST.small).size * (+l.z || 1) * 1.3;
      let y = 1080 * py - (ls.reduce((s, [l]) => s + hOf(l) + 18, -18)) / 2;
      for (const [l, i] of ls) {
        const st = ST[l.st] || ST.small, x = al === "left" ? `left:${1920 * px}px` : al === "right" ? `right:${1920 * (1 - px)}px` : `left:960px`;
        const tr = `translate(${al === "center" ? "-50%" : "0"},0) translate(${+l.dx || 0}px,${+l.dy || 0}px)`;
        h += `<div class="wf-tcl${flags.tcSel === i ? " sel" : ""}" data-tcl="${i}" data-al="${al}" data-px="${px}" style="position:absolute;${x};top:${y}px;transform:${tr};white-space:nowrap;line-height:1.3;${st.css};${l.z && l.z !== 1 ? `font-size:${Math.round(st.size * l.z)}px;` : ""}color:${st.color};text-shadow:${light ? "none" : "0 3px 18px rgba(0,0,0,.45)"}">${markup(l.t)}</div>`;
        y += hOf(l) + 18;
      }
    }
    box.innerHTML = h; stage.appendChild(box);
    fitTcLines(box);
    if (G.document && document.fonts && document.fonts.status !== "loaded") document.fonts.ready.then(() => fitTcLines(box)); // 글꼴이 늦게 오면 다시 맞춤
    const ph = box.querySelector(".wf-tcstill"); if (ph) ph.replaceWith(stillOf(tc.url, "wf-tcbg"));
    const v = box.querySelector("video.wf-tcbg");
    if (v) { if (flags.play || flags.fullPlay) { v.autoplay = true; v.play().catch(() => {}); } else v.addEventListener("loadedmetadata", () => { try { v.currentTime = 0.1; } catch (e) {} }, { once: true }); }
  }

  // 작은 미리보기에는 배경 영상 대신 멈춘 한 장면(캔버스) — 맥이 줄인 영상을 오른쪽까지 못 그리던 것 · 영상 여러 개를 띄워 무겁던 것
  const STILL = {}, STILLW = {};
  function stillOf(url, cls, css) {
    const c = document.createElement("canvas"); c.width = 1280; c.height = 720; c.className = cls || "wf-bg"; // 미리보기에서도 흐리지 않게(720p)
    Object.assign(c.style, { position: "absolute", inset: "0", width: "100%", height: "100%" }, css || {});
    const paint = (src) => { const x = c.getContext("2d"), nw = src.videoWidth || src.width, nh = src.videoHeight || src.height; if (!nw || !nh) return; x.imageSmoothingQuality = "high"; const r = Math.max(1280 / nw, 720 / nh), w = nw * r, h = nh * r; x.drawImage(src, (1280 - w) / 2, (720 - h) / 2, w, h); };
    if (STILL[url]) { paint(STILL[url]); return c; }
    (STILLW[url] = STILLW[url] || []).push(paint);
    if (STILLW[url].length === 1) {
      const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
      v.addEventListener("loadeddata", () => { try { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); } catch (e) {} }, { once: true });
      v.addEventListener("seeked", () => { const k = document.createElement("canvas"); k.width = v.videoWidth; k.height = v.videoHeight; try { k.getContext("2d").drawImage(v, 0, 0); } catch (e) {} STILL[url] = k; (STILLW[url] || []).forEach((f) => f(k)); STILLW[url] = []; v.removeAttribute("src"); v.load(); }, { once: true });
    }
    return c;
  }

  // 미리보기용: 그릇(div)에 맞춰 1920 무대를 줄여서 넣는다
  function mountScaled(holder) {
    let stage = holder.querySelector(":scope > .wf-stage");
    if (!stage) { stage = document.createElement("div"); stage.className = "wf-stage"; holder.appendChild(stage); }
    const fit = () => { const w = holder.clientWidth || 320; holder._wfW = w; stage.style.transform = `scale(${w / W})`; stage.style.transformOrigin = "0 0"; holder.style.height = (w * H / W) + "px"; };
    fit();
    // 칸 크기가 바뀌면(창 크기 · 저장공간 접기) 줄인 정도만 다시 맞춤 — 같은 화면은 다시 그리지 않으므로(영상 · 움직임 유지) 따로 맞춰야 함
    // 칸 너비가 바뀌면 다시 맞춤. 두 너비 사이를 빠르게 오가면(스크롤 막대 되풀이) 바로 따라가지 않고, 멈춘 뒤 한 번 맞춤 — 떨림도, 덜 맞춘 화면도 없게
    if (!holder._wfRO && G.ResizeObserver) {
      let lw = holder._wfW, pw = -1, pt = 0, settle = 0; // 실제로 맞춘 너비부터(높이를 정하면 스크롤 막대 때문에 너비가 바로 바뀔 수 있음)
      const apply = () => { const st = holder.querySelector(":scope > .wf-stage"); if (!st) return; lw = holder.clientWidth; const w = lw || 320; holder._wfW = w; st.style.transform = `scale(${w / W})`; holder.style.height = (w * H / W) + "px"; };
      holder._wfRO = new ResizeObserver(() => {
        const cw = holder.clientWidth; if (cw === lw) return;
        clearTimeout(settle); settle = setTimeout(apply, 350);
        const now = Date.now(); if (cw === pw && now - pt < 800) return; // 되풀이 중: 멈출 때까지 기다림
        pw = lw; pt = now; apply();
      });
      holder._wfRO.observe(holder);
    }
    return stage;
  }

  // 예배 시작 시각 세기: data-to="11:00" → "예배 시작까지 4:32"
  // 영상 · 그림 위 글 한 줄(예: “11월 2일 추수감사 주일”) — 아래쪽 반투명 띠
  function captionBand(text) {
    const b = document.createElement("div");
    b.className = "wf-caption"; b.textContent = text;
    Object.assign(b.style, { position: "absolute", left: "50%", bottom: "70px", transform: "translateX(-50%)", maxWidth: "86%", padding: "18px 44px", borderRadius: "14px", background: "rgba(10,14,28,.72)", color: "#fff", font: "700 60px 'Noto Sans KR',-apple-system,sans-serif", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" });
    return b;
  }
  // ── 예배 시작 카운트다운(대기 화면 디자인 6가지) ──
  // 숫자는 tickCounts 가 1초마다 고친다(.wf-cd · .wf-cdring). 글은 위 글(text) · 아래 글(sub) · 말씀(verse).
  const CD_DESIGNS = { gold: "클래식 금빛", glow: "빛 입자", ring: "원형 타이머", season: "교회력 색 띠", video: "배경 영상 + 글", verse: "말씀 카드",
    mcross: "십자가 빛", mglass: "스테인드글라스 십자가", march: "아치 창 회랑", msun: "새벽 해돋이", mseason: "계절(날짜 따라)", maurora: "오로라",
    mwater: "수채화 말씀", mbig: "큰 숫자", mwave: "잔잔한 물결", mclock: "시계 문자판", morder: "오늘의 예배 순서", mads: "광고 함께", mphoto: "교회 사진" };
  // 캔버스로 그리는 움직임 디자인(ui/shared/cdmotion.js) — 이름 → 엔진 디자인
  const MOTION = { mcross: "cross", mglass: "glass", march: "arches", msun: "sunrise", mseason: "season", maurora: "aurora", mwater: "water", mbig: "bignum", mwave: "wave", mclock: "clock", morder: "order", mads: "ads", mphoto: "photo" };
  // 움직임 디자인 그리기: 화면에 보이는 크기에 맞춘 해상도로, 큰 화면(예배당 · 생중계)은 매끄럽게, 작은 미리보기는 가볍게
  function drawMotion(stage, s, flags) {
    const w = document.createElement("div"); w.className = "wf-cdw";
    const cv = document.createElement("canvas"); cv.style.cssText = "position:absolute;left:0;top:0;width:1920px;height:1080px";
    w.appendChild(cv); stage.appendChild(w);
    const small = (cv.getBoundingClientRect().width || 480) < 260; // 작은 미리보기: 1초에 한 장, 숫자 굴림 없이
    // 4K 배경 영상(‘대기 화면 영상’ 묶음에 정해진 이름으로 넣은 것): 영상을 깔고 캔버스에는 글 · 숫자만. 조작 화면 미리보기는 멈춘 장면
    const loop = s.loop || "";
    if (loop) {
      if (small || !flags.play) w.insertBefore(stillOf(loop, "wf-loopstill"), cv);
      else { const v = document.createElement("video"); v.className = "wf-loop"; v.src = loop; v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.preload = "auto"; Object.assign(v.style, { position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover" }); w.insertBefore(v, cv); const p = v.play(); if (p && p.catch) p.catch(() => {}); }
    }
    const fn = G.CDM.designs[MOTION[s.design]]({ span: Math.round((+s.cdMins || 5) * 60), big: s.big10 !== false, still: small });
    const v = s.verse || {}, S = { top: s.text || "", sub: s.sub || "", verse: v.text ? `“${v.text}”${v.ref ? "\n" + v.ref : ""}` : "", pal: s.pal, month: s.month, order: s.order, ads: s.ads, photo: s.photo };
    const leftNow = () => {
      if (s.cdUntil) return (+s.cdUntil - Date.now()) / 1000;
      if (s.cdMode === "dur") return (+s.cdMins || 5) * 60;
      const m = String(s.countTo || "").match(/^(\d{1,2}):(\d{2})$/); if (!m) return null;
      const to = new Date(); to.setHours(+m[1], +m[2], 0, 0); return (to - Date.now()) / 1000;
    };
    const ctx = cv.getContext("2d"), t0 = performance.now();
    let scale = 0, last = 0;
    const tick = () => {
      if (!cv.isConnected) return; // 화면에서 빠지면 멈춤
      const disp = cv.getBoundingClientRect().width || 480; // 아직 자리가 안 잡혔으면 작게라도 먼저 그림
      // 화면에 보이는 크기 × 화면 선명도만큼 그림 — 큰 화면은 1080p보다 선명하게(4K · 맥 레티나 화면까지), 작은 미리보기는 가볍게
      const want = Math.min(disp >= 900 ? 2 : 1, (disp * (G.devicePixelRatio || 1)) / 1920);
      if (Math.abs(want - scale) > 0.02) { scale = want; cv.width = Math.round(1920 * scale); cv.height = Math.round(1080 * scale); }
      const now = performance.now(), gapMs = disp >= 900 ? (s.lite ? 40 : 0) : disp >= 260 ? (s.lite ? 66 : 33) : 1000; // 가볍게: 큰 화면 25장 · 미리보기 15장
      if (now - last >= gapMs - 2) {
        last = now;
        ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.filter = "none"; ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
        if (loop) { ctx.clearRect(0, 0, 1920, 1080); G.CDM_PART = "fg"; }
        try { fn(ctx, (now - t0) / 1000 + 2, leftNow(), S); } finally { G.CDM_PART = ""; }
      }
      if (gapMs >= 1000) setTimeout(tick, 1000); else requestAnimationFrame(tick);
    };
    tick(); // 첫 장은 바로(창이 가려져 다음 틱이 늦어도 그림이 보이게)
  }
  function cdCss() {
    if (document.getElementById("wf-cd-css")) return;
    const st = document.createElement("style"); st.id = "wf-cd-css";
    st.textContent = `.wf-cdw{position:absolute;inset:0;overflow:hidden;color:#fff}.wf-cdw .t{position:absolute;left:0;right:0;text-align:center;white-space:pre-line}
.wf-cd{display:inline-block;font-variant-numeric:tabular-nums;transition:transform .25s}.wf-cd.wf-final{transform:scale(1.35)}.wf-cd.wf-done{font-size:.42em!important;letter-spacing:0!important}
.wf-cd.wf-tk{animation:wfTick .2s ease-out}@keyframes wfTick{0%{transform:translateY(10%);opacity:.35}100%{transform:none;opacity:1}}
[data-cdmode=instant] .wf-cd.wf-tk{animation:none}[data-cdmode=fade] .wf-cd.wf-tk{animation:wfFadeIn .25s ease-out}@keyframes wfFadeIn{0%{opacity:0}100%{opacity:1}}
.wf-cd.wf-final.wf-tk{animation:wfTickBig .2s ease-out}@keyframes wfTickBig{0%{transform:scale(1.35) translateY(10%);opacity:.35}100%{transform:scale(1.35);opacity:1}}
[data-cdmode=instant] .wf-cd.wf-final.wf-tk{animation:none}[data-cdmode=fade] .wf-cd.wf-final.wf-tk{animation:wfFadeIn .25s ease-out}
@keyframes wfFloat{0%{transform:translate(0,0) scale(1);opacity:.45}50%{transform:translate(70px,-90px) scale(1.15);opacity:1}100%{transform:translate(0,0) scale(1);opacity:.45}}
.wf-bk{position:absolute;border-radius:50%;filter:blur(8px);animation:wfFloat 12s ease-in-out infinite}
@keyframes wfRise{0%{transform:translateY(0);opacity:0}10%{opacity:1}90%{opacity:.9}100%{transform:translateY(-1250px);opacity:0}}
.wf-dust{position:absolute;bottom:-20px;border-radius:50%;animation:wfRise linear infinite}
@keyframes wfSweep{0%{transform:translateX(-700px) skewX(-18deg)}100%{transform:translateX(2600px) skewX(-18deg)}}
.wf-sweep{position:absolute;top:-10%;bottom:-10%;left:0;width:520px;background:linear-gradient(90deg,transparent,rgba(255,236,180,.16),transparent);animation:wfSweep 8s ease-in-out infinite}
@keyframes wfTw{0%,100%{opacity:.15}50%{opacity:1}}.wf-star{position:absolute;width:5px;height:5px;border-radius:50%;background:#fff;animation:wfTw ease-in-out infinite}
@keyframes wfSpin{to{transform:translate(-50%,-50%) rotate(360deg)}}.wf-rays{position:absolute;left:50%;top:46%;width:1700px;height:1700px;transform:translate(-50%,-50%);background:repeating-conic-gradient(from 0deg,rgba(140,170,255,.07) 0 6deg,transparent 6deg 18deg);border-radius:50%;animation:wfSpin 90s linear infinite;-webkit-mask:radial-gradient(circle,#000 20%,transparent 65%)}
@keyframes wfPulse{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:.75;transform:scale(1.06)}}
@keyframes wfShift{0%{background-position:0% 0%}50%{background-position:100% 100%}100%{background-position:0% 0%}}
@keyframes wfDrift{0%{transform:translate(0,0)}50%{transform:translate(120px,60px)}100%{transform:translate(0,0)}}
@keyframes wfIn{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
@keyframes wfRot{to{transform:rotate(360deg)}}
@keyframes wfLine{0%{transform:translateX(-400px) rotate(-30deg);opacity:0}20%{opacity:.5}100%{transform:translateX(1400px) rotate(-30deg);opacity:0}}`;
    document.head.appendChild(st);
  }
  // 흩날리는 작은 빛(늘 같은 자리 · 같은 박자 — 그릴 때마다 바뀌지 않게)
  function cdDots(n, seed, mk) { let x = seed; const r = () => ((x = (x * 9301 + 49297) % 233280) / 233280); let h = ""; for (let i = 0; i < n; i++) h += mk(r, i); return h; }
  function drawCountdown(stage, s, flags) {
    cdCss();
    if (G.CDM && s.digitMode) G.CDM.digitMode = s.digitMode;
    if (MOTION[s.design] && G.CDM) return drawMotion(stage, s, flags || {});
    const d = s.design, w = document.createElement("div");
    w.className = "wf-cdw"; w.dataset.cdmode = s.digitMode || "slide";
    const T = (top, css, html, cls) => `<div class="t ${cls || ""}" style="top:${top};${css}">${html}</div>`;
    // 시간: 시각(data-to="11:00") · 나가는 순간부터 길이(data-until=끝나는 때) · 아직 안 나감(data-dur=초, 그대로 보임)
    const tm = s.cdUntil ? ` data-until="${+s.cdUntil}" data-span="${Math.round((+s.cdMins || 5) * 60)}"` : s.cdMode === "dur" ? ` data-dur="${Math.round((+s.cdMins || 5) * 60)}"` : ` data-to="${esc(s.countTo || "")}"`;
    const cd = (css) => `<div class="t cdn" style="${css}"><span class="wf-cd"${tm} data-big="${s.big10 ? 1 : ""}"></span></div>`;
    const mj = "'Nanum Myeongjo','AppleMyungjo',serif", nt = "'Noto Sans KR',-apple-system,sans-serif";
    const top = esc(s.text || ""), sub = esc(s.sub || "");
    let h = "";
    // 고른 색(s.pal): 금빛 · 빛 입자 · 색 띠도 바탕 · 테두리 · 빛 · 글자를 그 색으로(없으면 디자인 그대로)
    const p = s.pal, rgb = (x) => { const n = parseInt(String(x || "#ffffff").replace("#", "").slice(0, 6), 16) || 0; return [n >> 16, (n >> 8) & 255, n & 255].join(","); };
    if (d === "gold") {
      const ac = p ? p.accent : "#e8c779", aR = rgb(ac);
      w.style.background = p ? `radial-gradient(ellipse at 50% 40%,${p.bg} 0%,${p.bg} 45%,${p.bg2} 100%)` : "radial-gradient(ellipse at 50% 40%,#245a3e 0%,#17402c 55%,#0e2a1d 100%)";
      if (p) w.style.color = p.fg;
      h = cdDots(26, 7, (r) => { const z = 3 + r() * 6; return `<i class="wf-dust" style="left:${r() * 100}%;width:${z}px;height:${z}px;background:rgba(${aR},${0.4 + r() * 0.5});box-shadow:0 0 ${z * 2}px rgba(${aR},.7);animation-duration:${9 + r() * 9}s;animation-delay:-${r() * 18}s"></i>`; }) +
        `<div class="wf-sweep"></div>` +
        `<div style="position:absolute;inset:60px;border:4px solid ${ac};border-radius:12px;animation:wfPulse 5s ease-in-out infinite"></div><div style="position:absolute;inset:80px;border:2px solid ${ac};border-radius:8px;opacity:.35"></div>` +
        T("21%", `font:600 72px ${mj};color:${ac};letter-spacing:.12em`, top, "cdt") + cd(`top:33%;font:700 270px ${mj};letter-spacing:.04em`) + T("73%", `font:500 52px ${nt};color:${p ? p.fg : "#e9e1c6"};opacity:${p ? 0.85 : 1}`, sub, "cds");
    } else if (d === "glow") {
      w.style.background = p ? `linear-gradient(160deg,${p.bg},${p.bg2})` : "#0b1226";
      if (p) w.style.color = p.fg;
      const aR = p ? rgb(p.accent) : "", star = p && !p.dark ? `background:rgba(${aR},.8);` : "";
      const dots = [[8, 18, 190, "110,150,255,.25", 0], [78, 12, 290, "150,120,255,.18", 3], [62, 66, 160, "120,200,255,.22", 6], [18, 70, 240, "255,220,140,.14", 2], [44, 10, 70, "255,255,255,.3", 8], [88, 60, 120, "255,200,230,.16", 5], [30, 40, 90, "180,210,255,.2", 9], [55, 85, 200, "130,150,255,.14", 11]];
      if (p) dots.forEach((x, i) => (x[3] = i % 3 === 2 ? (p.dark ? "255,255,255,.14" : "255,255,255,.5") : `${aR},${i % 2 ? 0.16 : 0.24}`));
      h = `<div class="wf-rays"></div>` + cdDots(40, 3, (r) => `<i class="wf-star" style="${star}left:${r() * 100}%;top:${r() * 100}%;animation-duration:${2 + r() * 4}s;animation-delay:-${r() * 6}s;transform:scale(${0.4 + r()})"></i>`) +
        dots.map(([x, y, r, c, dl]) => `<i class="wf-bk" style="left:${x}%;top:${y}%;width:${r}px;height:${r}px;background:rgba(${c});animation-delay:-${dl}s;animation-duration:${10 + (dl % 5) * 2}s"></i>`).join("") +
        T("25%", `font:600 60px ${nt};color:${p ? p.accent : "#b9c7ff"};letter-spacing:.2em`, top, "cdt") + cd(`top:34%;font:800 280px ${nt};text-shadow:0 0 60px ${p ? `rgba(${aR},.55)` : "rgba(120,160,255,.6)"}`) + T("72%", `font:500 52px ${nt};color:${p ? p.fg : "#d9def0"};opacity:${p ? 0.85 : 1}`, sub, "cds");
    } else if (d === "ring") {
      const p = s.pal || {}; w.style.background = p.bg ? `linear-gradient(135deg,${p.bg},${p.bg2})` : "#f6f3ec"; w.style.color = p.fg || "#23281f";
      h = `<div style="position:absolute;left:50%;top:48%;width:900px;height:900px;margin:-450px 0 0 -450px;border-radius:50%;background:radial-gradient(circle,rgba(42,107,71,.16),transparent 65%);animation:wfPulse 4s ease-in-out infinite"></div>` +
        `<svg width="720" height="720" viewBox="0 0 300 300" style="position:absolute;left:50%;top:48%;margin:-360px 0 0 -360px;animation:wfRot 40s linear infinite"><circle cx="150" cy="150" r="146" fill="none" stroke="#c9a24a" stroke-width="1.5" stroke-dasharray="2 9" opacity=".7"/></svg>` +
        `<svg width="600" height="600" viewBox="0 0 300 300" style="position:absolute;left:50%;top:48%;transform:translate(-50%,-50%)"><circle cx="150" cy="150" r="126" fill="none" stroke="${s.pal ? (s.pal.dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.08)") : "#e2dccd"}" stroke-width="10"/><circle class="wf-cdring"${tm} cx="150" cy="150" r="126" fill="none" stroke="${(s.pal || {}).accent || "#2a6b47"}" stroke-width="10" stroke-linecap="round" stroke-dasharray="792" stroke-dashoffset="0" transform="rotate(-90 150 150)" style="transition:stroke-dashoffset 1s linear"/></svg>` +
        T("5%", `font:700 58px ${nt};color:${(s.pal || {}).accent || "#2a6b47"};letter-spacing:.08em`, top, "cdt") + cd(`top:39%;font:800 150px ${nt};color:${(s.pal || {}).fg || "#17402c"}`) + T("86%", `font:600 50px ${nt};color:${(s.pal || {}).fg || "#5b6056"};opacity:.8`, sub, "cds");
    } else if (d === "season") {
      // ‘자동(교회력)’이면 원래처럼 교회력 띠, 다른 색을 고르면 띠를 그 색으로
      const own = p && !p.auto, sc = own ? { name: p.name || "", c1: p.bg, c2: p.bg2 } : s.season || { name: "", c1: "#2f7a4c", c2: "#1d5233" };
      const bandFg = own && !p.dark ? p.fg : "#ffffff", fgR = rgb(bandFg);
      w.style.background = "#12161c";
      h = `<div style="position:absolute;left:0;top:0;bottom:0;width:38%;overflow:hidden;background:linear-gradient(160deg,${sc.c1},${sc.c2},${sc.c1});background-size:220% 220%;animation:wfShift 14s ease-in-out infinite">` +
        cdDots(6, 11, (r, i) => `<i style="position:absolute;left:-30%;top:${10 + i * 15}%;width:160%;height:3px;background:linear-gradient(90deg,transparent,rgba(${fgR},${own && !p.dark ? 0.18 : 0.35}),transparent);animation:wfLine ${6 + r() * 5}s linear infinite;animation-delay:-${r() * 10}s"></i>`) +
        `<div style="position:absolute;right:60px;bottom:40px;font-size:170px;color:rgba(${fgR},${own && !p.dark ? 0.16 : 0.22});animation:wfPulse 6s ease-in-out infinite">✝</div></div>` +
        cdDots(18, 5, (r) => { const z = 2 + r() * 4; return `<i class="wf-dust" style="left:${40 + r() * 60}%;width:${z}px;height:${z}px;background:rgba(255,255,255,${0.25 + r() * 0.4});animation-duration:${12 + r() * 10}s;animation-delay:-${r() * 20}s"></i>`; }) +
        `<div style="position:absolute;left:70px;top:66px;font:700 40px ${nt};color:rgba(${fgR},.85);letter-spacing:.08em">${esc(sc.name)}</div>` +
        `<div class="cdt" style="position:absolute;left:70px;top:50%;width:30%;font:700 84px/1.3 ${mj};white-space:pre-line;color:${bandFg}">${top}</div>` +
        `<div class="cdn" style="position:absolute;right:7%;top:29%;font:800 290px ${nt}"><span class="wf-cd"${tm} data-big="${s.big10 ? 1 : ""}"></span></div>` +
        `<div class="cds" style="position:absolute;right:7%;top:70%;font:500 50px ${nt};color:#b8c0cc">${sub}</div>`;
    } else if (d === "video") {
      w.style.background = "#000";
      h = (s.bgUrl ? `<video src="${esc(s.bgUrl)}" muted autoplay loop playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>` : `<div style="position:absolute;inset:0;background:linear-gradient(180deg,#0d1733,#1c2b52 55%,#46506a);background-size:100% 200%;animation:wfShift 16s ease-in-out infinite"></div>`) +
        cdDots(16, 9, (r) => { const z = 2 + r() * 4; return `<i class="wf-dust" style="left:${r() * 100}%;width:${z}px;height:${z}px;background:rgba(255,255,255,${0.3 + r() * 0.4});animation-duration:${14 + r() * 10}s;animation-delay:-${r() * 24}s"></i>`; }) +
        `<div style="position:absolute;inset:0;background:#000;opacity:0"></div>` +
        T("20%", `font:600 60px ${nt};letter-spacing:.1em;text-shadow:0 2px 12px rgba(0,0,0,.6)`, top, "cdt") + cd(`top:31%;font:800 270px ${nt};text-shadow:0 4px 30px rgba(0,0,0,.5)`) + T("66%", `font:500 54px ${nt};text-shadow:0 2px 12px rgba(0,0,0,.6)`, sub, "cds");
    } else if (d === "over") {
      // 영상 · 그림 위에 얹는 카운트다운(바탕 없음)
      const pos = s.pos === "bottom" ? ["62%", "72%", "86%"] : s.pos === "top" ? ["6%", "14%", "38%"] : ["22%", "33%", "70%"];
      h = `<div style="position:absolute;inset:0;background:#000;opacity:0"></div>` +
        T(pos[0], `font:700 64px ${nt};text-shadow:0 2px 16px rgba(0,0,0,.7)`, top, "cdt") + cd(`top:${pos[1]};font:800 ${s.pos === "bottom" ? 150 : 250}px ${nt};text-shadow:0 4px 30px rgba(0,0,0,.6)`) + T(pos[2], `font:600 54px ${nt};text-shadow:0 2px 14px rgba(0,0,0,.7)`, sub, "cds");
      if (s.pos === "bottom") h = h.replace(T(pos[0], `font:700 64px ${nt};text-shadow:0 2px 16px rgba(0,0,0,.7)`, top, "cdt"), T("54%", `font:700 64px ${nt};text-shadow:0 2px 16px rgba(0,0,0,.7)`, top, "cdt")).replace(T(pos[2], `font:600 54px ${nt};text-shadow:0 2px 14px rgba(0,0,0,.7)`, sub, "cds"), T("88%", `font:600 46px ${nt};text-shadow:0 2px 14px rgba(0,0,0,.7)`, sub, "cds"));
      w.style.background = "transparent";
    } else if (d === "verse") {
      const p = Object.assign({ bg: "#faf6ee", bg2: "#faf6ee", fg: "#17402c", accent: "#a8873a", glow: "rgba(232,199,121,.28)", glow2: "rgba(42,107,71,.14)", pill: "#fff", pillFg: "#2a6b47" }, s.pal || {}); w.style.background = `linear-gradient(135deg,${p.bg},${p.bg2})`; w.style.color = p.fg;
      const v = s.verse || {};
      h = `<div style="position:absolute;left:-10%;top:-20%;width:900px;height:900px;border-radius:50%;background:radial-gradient(circle,${p.glow},transparent 65%);animation:wfDrift 18s ease-in-out infinite"></div>` +
        `<div style="position:absolute;right:-12%;bottom:-30%;width:1000px;height:1000px;border-radius:50%;background:radial-gradient(circle,${p.glow2},transparent 65%);animation:wfDrift 22s ease-in-out infinite reverse"></div>` +
        `<div style="position:absolute;left:8%;right:8%;top:16%;height:50%;display:flex;align-items:center;justify-content:center;text-align:center;font:600 68px/1.6 ${mj};color:${p.fg};white-space:pre-line;animation:wfIn 1.6s ease-out" class="cdt">${v.text ? "“" + esc(v.text) + "”" : top}</div>` +
        T("68%", `font:600 46px ${nt};color:${p.accent}`, esc(v.ref || (v.text ? "" : sub)), "cds") +
        `<div style="position:absolute;right:56px;bottom:44px;background:${p.pill};border-radius:24px;padding:8px 36px;box-shadow:0 4px 18px rgba(0,0,0,.08);font:800 80px ${nt};color:${p.pillFg}"><small style="font-size:34px;opacity:.7;color:${p.pillFg};font-weight:600;margin-right:16px">예배까지</small><span class="wf-cd cdn"${tm} data-big=""></span></div>`;
    }
    w.innerHTML = h;
    stage.appendChild(w);
    // 글꼴 · 글자 크기(목사님이 고른 대로): 위 글 · 아래 글 · 숫자
    const fam = s.font && FONTS[s.font] ? FONTS[s.font] : null;
    const fit = (sel, pct, num) => w.querySelectorAll(sel).forEach((el) => {
      if (pct && +pct !== 100) el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) * pct) / 100 + "px";
      if (fam && !num) { el.style.fontFamily = fam.family; el.style.fontWeight = fam.weight; }
    });
    fit(".cdt", s.textSize); fit(".cds", s.subSize); fit(".cdn", s.numSize, true);
    const v = w.querySelector("video"); if (v) v.play && v.play().catch(() => {});
    tickCounts(w);
  }
  function cdLeftOf(el) {
    if (el.dataset.until) return Math.ceil((+el.dataset.until - Date.now()) / 1000);
    if (el.dataset.dur) return +el.dataset.dur;
    return cdLeft(el.dataset.to);
  }
  function cdLeft(to) {
    const m = String(to || "").match(/^(\d{1,2}):(\d{2})$/); if (!m) return null;
    const now = new Date(), t = new Date(now); t.setHours(+m[1], +m[2], 0, 0);
    return Math.round((t - now) / 1000);
  }
  let tickCounts = function (root) {
    (root || document).querySelectorAll(".wf-count[data-to]").forEach((el) => {
      const m = String(el.dataset.to).match(/^(\d{1,2}):(\d{2})$/);
      if (!m) { el.textContent = ""; return; }
      const now = new Date(), to = new Date(now);
      to.setHours(+m[1], +m[2], 0, 0);
      const left = Math.round((to - now) / 1000);
      if (left > 3 * 3600 || left < -600) { el.textContent = ""; return; }
      if (left <= 0) { el.textContent = "곧 예배가 시작됩니다"; return; }
      const mm = Math.floor(left / 60), ss = left % 60;
      el.textContent = `예배 시작까지 ${mm}:${String(ss).padStart(2, "0")}`;
    });
  }
  // 카운트다운 숫자 · 고리
  const tickCd = tickCounts;
  tickCounts = function (root) {
    tickCd(root);
    (root || document).querySelectorAll(".wf-cd[data-to], .wf-cd[data-until], .wf-cd[data-dur]").forEach((el) => {
      const left = cdLeftOf(el);
      const before = el.textContent;
      el.classList.remove("wf-final", "wf-done");
      if (left == null || left > 6 * 3600) { el.textContent = "--:--"; return; }
      if (left <= 0) { el.textContent = "곧 시작합니다"; el.classList.add("wf-done"); return; }
      if (el.dataset.big && left <= 10) { el.textContent = String(left); el.classList.add("wf-final"); if (before !== el.textContent) { el.classList.remove("wf-tk"); void el.offsetWidth; el.classList.add("wf-tk"); } return; }
      const hh = Math.floor(left / 3600), mm = Math.floor((left % 3600) / 60), ss = left % 60;
      el.textContent = (hh ? hh + ":" + String(mm).padStart(2, "0") : String(mm).padStart(2, "0")) + ":" + String(ss).padStart(2, "0");
      if (before && before !== el.textContent) { el.classList.remove("wf-tk"); void el.offsetWidth; el.classList.add("wf-tk"); }
    });
    (root || document).querySelectorAll(".wf-cdring[data-to], .wf-cdring[data-until], .wf-cdring[data-dur]").forEach((el) => {
      const left = cdLeftOf(el), span = el.dataset.until || el.dataset.dur ? +(el.dataset.span || el.dataset.dur || 600) : 600;
      const f = left == null ? 1 : Math.max(0, Math.min(1, left / span));
      el.setAttribute("stroke-dashoffset", String(792 * (1 - f)));
    });
  };
  setInterval(() => tickCounts(document), 1000);

  // ── 생중계 자막(OBS 오버레이): 투명 바탕, 아래쪽 띠에 1~2줄 ──
  const OVERLAY = {
    font: "noto", size: 54, minSize: 34, maxLines: 2, lineHeight: 1.4, color: "#ffffff", accent: "#f5c84c",
    band: "box", bandColor: "#0b1020", bandAlpha: 78, bottom: 7, width: 82, refShow: true,
    showMedia: true,  // 영상 · 그림 화면은 생중계에도 화면 가득(카메라 대신)
    showBg: false,    // 가사 배경 영상도 생중계에(카메라 대신 배경 + 가사) — 기본은 카메라 위 가사만
    textFull: false,  // 기본: 생중계는 카메라 + 하단 자막(0.3.16 목사님). 켜면 찬양 · 성경 · 고정 문구 · 글도 예배당 화면 그대로. 대기(카운트다운)는 늘 화면 가득
    tpl: "a",         // 하단 자막 템플릿(0.3.20): a 어두운 띠 · b 금색 줄 · c 유리 · d 글자만 · "my:파일" 교회가 넣은 띠 그림
  };
  const LOWER_TPLS = [{ id: "a", name: "어두운 띠" }, { id: "b", name: "금색 줄" }, { id: "c", name: "유리" }, { id: "d", name: "글자만" }];
  // 템플릿마다 띠 모양 · 글꼴 · 참조 색(내 템플릿 그림은 앱 안에서는 앱 주소, OBS 페이지에서는 /media/)
  function lowerTpl(t, f, flags) {
    const tpl = String(t.tpl || "a"), o = { fam: f.family, fw: f.weight, acc: t.accent, style: {}, line: false, shade: false };
    if (tpl === "b") {
      Object.assign(o, { fam: FONTS.batang.family, fw: FONTS.batang.weight, acc: "#e8c779", line: true });
      const w = Math.min(100, t.width + 18); // 양 끝이 흐려지는 띠라 글 폭보다 조금 넓게
      o.style = { left: (100 - w) / 2 + "%", width: w + "%", borderRadius: "0", padding: "22px 9% 22px", textShadow: "none",
        background: "linear-gradient(90deg, rgba(23,64,44,0) 0%, rgba(23,64,44,.92) 18%, rgba(23,64,44,.92) 82%, rgba(23,64,44,0) 100%)" };
    } else if (tpl === "c") {
      const w = Math.round(t.width * 0.95);
      o.acc = "rgba(255,255,255,.88)";
      o.style = { width: w + "%", left: (100 - w) / 2 + "%", borderRadius: "44px", border: "2px solid rgba(255,255,255,.4)",
        background: "linear-gradient(rgba(255,255,255,.2), rgba(255,255,255,.08)), rgba(18,22,30,.4)",
        backdropFilter: "blur(18px) saturate(1.3)", webkitBackdropFilter: "blur(18px) saturate(1.3)",
        boxShadow: "0 20px 60px rgba(0,0,0,.3)", textShadow: "0 2px 10px rgba(0,0,0,.35)" };
    } else if (tpl === "d") {
      Object.assign(o, { acc: "#ffffff", shade: true });
      o.style = { background: "transparent", textShadow: "0 3px 8px rgba(0,0,0,.85), 0 0 30px rgba(0,0,0,.6)" };
    } else if (tpl.startsWith("my:")) {
      const file = tpl.slice(3);
      const url = flags.tplSrc ? flags.tplSrc(file) : G.Store && G.Store.inApp ? G.Store.mediaUrl(file) : "/media/" + file;
      o.style = { background: `url("${url}") center / 100% 100% no-repeat`, borderRadius: "0", padding: "28px 80px 30px", textShadow: "0 2px 6px rgba(0,0,0,.6)" };
    }
    return o;
  }
  // 생중계에서 ‘예배당 화면 그대로’ 보여 줄 순서 종류
  const FULL_KINDS = ["song", "scripture", "fixed", "text", "standby", "design"];
  // 생중계 화면을 카메라 대신 채울 것: 영상 · 그림 화면, 또는(켰을 때) 가사 배경. 없으면 null(카메라 그대로)
  function overlayFull(slide, ot, flags) {
    flags = flags || {};
    const t = Object.assign({}, OVERLAY, ot || {});
    if (!slide || flags.black || flags.logo || flags.emergency || flags.overlayOff || flags.cam || slide.kind === "cam") return null;
    if (slide.kind === "media" && slide.cd && slide.cd.on) return { proj: true };
    if (slide.kind === "titlecard") return t.textFull === true ? { proj: true } : null; // 제목 화면: 생중계는 카메라 + 순서 자막바(‘화면 가득’을 켜면 그대로)
    if (slide.kind === "standby") return { proj: true }; // 대기(예배로 부름 · 카운트다운) 첫 화면만 화면 가득 — 끝나고 인도자 멘트부터는 카메라 + 하단 자막
    const mediaOn = slide.ovLive === "on" || (slide.ovLive !== "off" && t.showMedia !== false); // 그림마다 · 순서마다 고른 것이 먼저(0.3.24)
    if (mediaOn && slide.kind === "media" && slide.mediaFile)
      return { file: slide.mediaFile, video: !!slide.video, mute: !!(slide.media && slide.media.mute), loop: !!(slide.media && slide.media.loop), dim: 0, caption: slide.caption || "" };
    if (t.textFull === true && FULL_KINDS.includes(slide.itemKind) && slide.kind !== "media") return { proj: true }; // 기본은 끔(카메라 + 하단 자막)
    if (t.showBg && slide.bgFile && slide.kind !== "media" && slide.kind !== "design" && overlayContent(slide))
      return { file: slide.bgFile, video: /\.(mp4|mov|m4v|webm)$/i.test(slide.bgFile), mute: true, loop: true, dim: slide.bgDim || 0, bg: true };
    return null;
  }
  function hexA(hex, a) {
    const h = String(hex || "#000").replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a / 100})`;
  }
  // 무엇을 자막으로 보일지: 글 화면 · 설교 제목 · 기도 이름표만. 그림 · 대기 화면은 자막 없음.
  function overlayContent(slide) {
    if (!slide) return null;
    if (slide.kind === "text" && slide.text) return { text: slide.text, ref: slide.ref || "" };
    if (slide.kind === "title") return { text: slide.title || slide.text || "", ref: slide.sub || "", small: slide.foot || "" };
    if (slide.kind === "prayer" && slide.name) return { text: slide.name, ref: slide.role || "", tag: true };
    if (slide.kind === "media" && slide.text) return { text: slide.text, ref: "" };
    return null;
  }
  function drawOverlay(stage, slide, ot, flags) {
    flags = flags || {};
    const t = Object.assign({}, OVERLAY, ot || {});
    const f = FONTS[t.font] || FONTS.noto;
    stage.classList.add("wf-stage", "wf-ov");
    stage.style.width = W + "px"; stage.style.height = H + "px";
    stage.style.background = "transparent";
    stage.innerHTML = "";
    // 조작 창 미리보기: 카메라 대신 나갈 영상 · 그림(flags.fullSrc 가 파일 → 주소)
    const full = flags.fullSrc ? overlayFull(slide, ot, flags) : null;
    if (full && full.proj) {
      const box = document.createElement("div"); Object.assign(box.style, { position: "absolute", left: "0", top: "0" });
      stage.appendChild(box); draw(box, slide, flags.projTheme || null, { play: !!flags.fullPlay });
      return { lines: 1, size: 0, overflow: false, proj: true };
    }
    if (full) {
      const el = document.createElement(full.video ? "video" : "img");
      el.src = flags.fullSrc(full.file) + (full.video && !flags.fullPlay ? "#t=0.5" : ""); if (full.video) el.muted = true;
      if (full.video && flags.fullPlay) { el.autoplay = true; el.loop = full.loop; el.playsInline = true; el.className = "wf-ovfull"; }
      Object.assign(el.style, { position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: full.bg ? "cover" : "contain", background: "#000" });
      stage.appendChild(el);
      if (full.dim) { const d = document.createElement("div"); Object.assign(d.style, { position: "absolute", inset: "0", background: "#000", opacity: full.dim / 100 }); stage.appendChild(d); }
      if (full.caption) stage.appendChild(captionBand(full.caption));
    }
    const c = overlayContent(slide);
    if (!c || flags.black || flags.clear || flags.logo || flags.emergency || flags.overlayOff || flags.capOff || flags.cam) return { lines: 0 }; // capOff: 순서 자막바가 떠 있어 글 띠만 숨김(화면 가득 영상은 그대로)
    const lt = c.tag ? { fam: f.family, fw: f.weight, acc: t.accent, style: {} } : lowerTpl(t, f, flags); // 기도 이름표는 늘 같은 모양
    if (lt.shade) { const sh = document.createElement("div"); sh.className = "wf-band-shade"; Object.assign(sh.style, { position: "absolute", left: "0", right: "0", bottom: "0", height: "42%", background: "linear-gradient(rgba(0,0,0,0), rgba(0,0,0,.55))" }); stage.appendChild(sh); }
    const band = document.createElement("div");
    band.className = "wf-band" + (c.tag ? " tag" : "");
    Object.assign(band.style, {
      bottom: (H * t.bottom / 100) + "px", width: c.tag ? "auto" : t.width + "%",
      left: c.tag ? (W * 0.06) + "px" : ((100 - t.width) / 2) + "%",
      background: t.band === "box" ? hexA(t.bandColor, t.bandAlpha) : "transparent",
      fontFamily: lt.fam, color: t.color, textAlign: c.tag ? "left" : "center",
      textShadow: t.band === "box" ? "none" : "0 2px 8px rgba(0,0,0,.85), 0 0 2px rgba(0,0,0,.9)",
    }, lt.style);
    // 설정 ‘띠 · 진하기’는 어두운 띠뿐 아니라 금색 줄 · 유리에도(0.3.32 — 유리일 때 안 먹던 것). 내 템플릿 그림 · 글자만은 그대로
    const tplId = String(t.tpl || "a"), bA = Math.max(0, Math.min(100, +t.bandAlpha || 0)) / 100;
    if (!c.tag && !tplId.startsWith("my:") && tplId !== "d") {
      if (t.band === "none") {
        Object.assign(band.style, { background: "transparent", border: "none", backdropFilter: "none", webkitBackdropFilter: "none", boxShadow: "none", textShadow: "0 2px 8px rgba(0,0,0,.85), 0 0 2px rgba(0,0,0,.9)" });
        lt.line = false;
      } else if (tplId === "b") band.style.background = `linear-gradient(90deg, rgba(23,64,44,0) 0%, rgba(23,64,44,${bA}) 18%, rgba(23,64,44,${bA}) 82%, rgba(23,64,44,0) 100%)`;
      else if (tplId === "c") band.style.background = `linear-gradient(rgba(255,255,255,.2), rgba(255,255,255,.08)), rgba(18,22,30,${(bA * 0.85).toFixed(2)})`;
    }
    band.style.setProperty("--wf-acc", lt.acc);
    if (lt.line) { const ln = document.createElement("div"); Object.assign(ln.style, { position: "absolute", left: "22%", right: "22%", top: "0", height: "3px", background: "linear-gradient(90deg, rgba(232,199,121,0), #e8c779, rgba(232,199,121,0))" }); band.appendChild(ln); }
    if (t.refShow && c.ref) {
      const r = document.createElement("div");
      r.className = "wf-band-ref"; r.textContent = c.ref; r.style.color = lt.acc; r.style.fontWeight = lt.fw - 100;
      band.appendChild(r);
    }
    const tx = document.createElement("div");
    tx.className = "wf-band-text"; tx.innerHTML = markup(c.text).replace(/<br>/g, " ");
    Object.assign(tx.style, { fontWeight: lt.fw, lineHeight: t.lineHeight });
    band.appendChild(tx);
    if (c.small) { const sm = document.createElement("div"); sm.className = "wf-band-ref"; sm.textContent = c.small; sm.style.opacity = .85; band.appendChild(sm); }
    stage.appendChild(band);
    let s = c.tag ? Math.round(t.size * 1.15) : t.size, lines = 0;
    for (;;) {
      tx.style.fontSize = s + "px";
      lines = Math.round(tx.scrollHeight / (s * t.lineHeight));
      if (lines <= t.maxLines || s <= t.minSize) break;
      s -= 2;
    }
    return { lines, size: s, overflow: lines > t.maxLines };
  }

  // 부드러운 넘김 ①: 새로 그린 판의 배경 영상이 옛 판과 같은 파일이면 같은 자리에서 이어 틀기(가사를 넘길 때마다 처음으로 돌아가지 않게)
  function carryVideo(from, to) {
    if (!from || !to) return;
    const old = {}; from.querySelectorAll("video.wf-bg, video.wf-loop, video.wf-tcbg").forEach((v) => { if (v.currentSrc || v.src) old[v.getAttribute("src")] = v; });
    to.querySelectorAll("video.wf-bg, video.wf-loop, video.wf-tcbg").forEach((v) => {
      const o = old[v.getAttribute("src")]; if (!o || !(o.currentTime > 0)) return;
      const go = () => { try { v.currentTime = o.currentTime + 0.05; } catch (e) {} };
      if (v.readyState >= 1) go(); else v.addEventListener("loadedmetadata", go, { once: true });
    });
  }
  // 부드러운 넘김 ②③: 같은 순서 안은 설정대로, 다음 순서로 넘어갈 때는 0.6초, 검은 화면 · 로고 · 글 지우기는 0.4초, 긴급 대기는 바로
  function fadeFor(prev, st) {
    const base = st.fade == null ? 180 : st.fade, f = st.flags || {}, pf = (prev && prev.flags) || {};
    if (!prev) return base;
    if (f.emergency && !pf.emergency) return 0;
    if (["black", "clear", "logo", "emergency"].some((k) => !!f[k] !== !!pf[k])) return base ? 400 : 0;
    if (st.itemIdx != null && prev.itemIdx != null && st.itemIdx !== prev.itemIdx) return base ? Math.max(base, 600) : 0;
    return base;
  }
  // 맥 웹 화면 기본 오른쪽 클릭 메뉴(‘Reload’ — 누르면 화면이 처음으로 돌아감)는 막는다. 앱이 만든 메뉴(보관함 등)와 글 칸 복사 · 붙여넣기는 그대로(0.3.21)
  if (G.document) G.document.addEventListener("contextmenu", (e) => {
    if (e.defaultPrevented) return;
    const t = e.target && e.target.closest ? e.target : e.target && e.target.parentElement;
    if (t && t.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return;
    e.preventDefault();
  });
  // 순서 자막바를 화면 어디에(0.3.28 정렬): 왼쪽 아래(기본) · 가운데 아래 · 오른쪽 아래 — 생중계 · 예배당 · 미리보기가 같이 씀
  function barPlace(el, pos, w) {
    Object.assign(el.style, pos === "center" ? { left: "50%", right: "auto", marginLeft: -(w / 2) + "px" } : pos === "right" ? { left: "auto", right: "96px", marginLeft: "0" } : { left: "96px", right: "auto", marginLeft: "0" });
  }
  G.Render = { barPlace, carryVideo, fadeFor, captionBand, CD_DESIGNS, W, H, FONTS, BASE, KIND_THEME, themeFor, draw, measure, splitVerses, splitLong, splitLyrics, sectionKey, mountScaled, markup, esc, OVERLAY, LOWER_TPLS, drawOverlay, overlayContent, overlayFull, tickCounts };
})(window);
