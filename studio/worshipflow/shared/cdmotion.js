// 카운트다운 움직임 엔진(2026-10-29 시안 → 앱) — 캔버스에 직접 그린다. draw(t초, 남은초)로 한 장씩 그리므로 영상으로 똑같이 녹화된다.
// 설계 단위는 1920×1080. 디자인마다 바탕 · 빛 · 입자 · 숫자를 겹쳐 그린다.
(function (G) {
  const W = 1920, H = 1080;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  // "#rrggbb" 두 색을 k만큼 섞어 "r,g,b"로(빛 색을 고른 색에서 만들 때)
  const rgbMix = (a, b, k) => { const h = (x) => { const n = parseInt(String(x).replace("#", "").slice(0, 6), 16) || 0; return [n >> 16, (n >> 8) & 255, n & 255]; }, A = h(a), B = h(b); return A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(","); };
  const ease = (k) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  // 부드러운 1차원 잡음(흔들림 · 바람)
  function noise1(x, seed) { const i = Math.floor(x), f = x - i, h = (n) => { const v = Math.sin((n + seed * 31.7) * 127.1) * 43758.5453; return v - Math.floor(v); }; const u = f * f * (3 - 2 * f); return lerp(h(i), h(i + 1), u) * 2 - 1; }
  const fbm = (x, seed) => noise1(x, seed) * 0.6 + noise1(x * 2.3, seed + 3) * 0.3 + noise1(x * 5.1, seed + 7) * 0.1;
  const CACHE = {}; const cached = (k, fn) => CACHE[k] || (CACHE[k] = fn());
  function layer(w, h, fn) { const c = document.createElement("canvas"); c.width = w; c.height = h; fn(c.getContext("2d"), c); return c; }
  // 남은 시간 → 글자. 모름(--:--) · 0 이하(곧 시작합니다) · 한 시간 넘으면 시:분:초
  // 흐림: 맥 WebKit 은 캔버스 filter(blur)를 그리지 않으므로, 작게 그렸다가 크게 늘려 부드럽게(어디서나 같게 · 가벼움)
  const SOFT = {};
  // 고화질로 영상을 미리 만들 때(G.CDM_HQ): 작게 그렸다 늘리지 않고, 크게 그린 뒤 진짜 흐림(크롬에서만 — 앱 화면에서는 쓰지 않음)
  function soft(ctx, k, draw, key) {
    if (G.CDM_PART === "fg") return; // 4K 영상 위에 글만 얹을 때: 배경은 영상에 있음
    if (G.CDM_HQ) {
      const id = "hq" + (key || "s"), c = SOFT[id] || (SOFT[id] = document.createElement("canvas")); if (c.width !== W) { c.width = W; c.height = H; }
      const x = c.getContext("2d"); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = "source-over"; x.filter = "none"; x.clearRect(0, 0, W, H);
      draw(x);
      ctx.save(); ctx.filter = `blur(${(k * 0.55).toFixed(1)}px)`; ctx.drawImage(c, 0, 0, W, H); ctx.restore(); return;
    }
    const w = Math.ceil(W / k), h = Math.ceil(H / k), id = (key || "s") + k;
    const c = SOFT[id] || (SOFT[id] = document.createElement("canvas")); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const x = c.getContext("2d"); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = "source-over"; x.clearRect(0, 0, w, h); x.setTransform(1 / k, 0, 0, 1 / k, 0, 0);
    draw(x);
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(c, 0, 0, W, H); ctx.restore();
  }
  // 정지 그림을 흐린 작은 그림으로(한 번 만들어 둠) — 반씩 여러 번 줄여 계단 무늬 없이
  function blurred(img, k) {
    if (G.CDM_HQ) { const pad = Math.ceil(k * 1.2); return layer(img.width, img.height, (c) => { c.filter = `blur(${(k * 0.45).toFixed(1)}px)`; c.drawImage(img, 0, 0); }); }
    let src = img, w = img.width, h = img.height; const tw = Math.max(2, Math.round(w / k)), th = Math.max(2, Math.round(h / k));
    while (w / 2 > tw) { const t = document.createElement("canvas"); t.width = Math.round(w / 2); t.height = Math.round(h / 2); const x = t.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, t.width, t.height); src = t; w = t.width; h = t.height; }
    return layer(tw, th, (c) => { c.imageSmoothingQuality = "high"; c.drawImage(src, 0, 0, tw, th); });
  }
  const fmt = (s) => {
    if (s == null || isNaN(s) || s > 6 * 3600) return "--:--";
    if (s <= 0) return "곧 시작합니다";
    s = Math.ceil(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + ":" + String(m).padStart(2, "0") : String(m).padStart(2, "0")) + ":" + String(x).padStart(2, "0");
  };
  const SANS = "'Apple SD Gothic Neo','Noto Sans KR',-apple-system,sans-serif", SERIF = "'Nanum Myeongjo','AppleMyungjo','Nanum Myeongjo',serif";

  // ── 숫자: 자리마다 굴러 바뀜(옛 숫자는 위로 사라지고 새 숫자가 아래에서) + 마지막 10초 맥박 ──
  function Digits(big, still) { this.cells = []; this.big = big; this.still = still; }
  Digits.prototype.draw = function (ctx, str, x, y, o, t, left) {
    if (G.CDM_PART === "bg") return; ctx = ctx.__real || ctx;
    if (!/\d/.test(str)) { text(ctx, str, x, y, { size: o.size * 0.36, color: o.color || "#fff", weight: 700, family: o.family, glow: o.glow, glowSize: o.glowSize }); return; }
    const size = o.size, font = `${o.weight || 700} ${size}px ${o.family || SANS}`;
    ctx.save(); ctx.font = font; ctx.textBaseline = "middle"; ctx.textAlign = "center";
    // 자리 폭 고정: 숫자 자리는 가장 넓은 숫자 폭으로(1 ↔ 0 이 바뀌어도 옆으로 미끄러지지 않게)
    const wDigit = Math.max(...[..."0123456789"].map((d) => ctx.measureText(d).width)) * 0.96, wColon = ctx.measureText(":").width * 1.25;
    const widths = [...str].map((c) => (c === ":" ? wColon : wDigit)), total = widths.reduce((a, b) => a + b, 0);
    let acc = -total / 2; this.cur = widths.map((w) => { const m = acc + w / 2; acc += w; return m; });
    const final = left <= 10 && left > 0, frac = left - Math.floor(left);
    const pulse = final ? 1 + 0.12 * Math.pow(1 - (1 - frac), 3) * 0 + 0.1 * Math.max(0, (frac - 0.55) / 0.45) : 1;
    const scale = (final && this.big !== false ? 1.1 : 1) * (this.big !== false ? pulse : 1);
    ctx.translate(x, y); ctx.scale(scale, scale);
    [...str].forEach((c, i) => {
      const cell = this.cells[i] || (this.cells[i] = { c, prev: c, t0: -9 });
      if (cell.c !== c) { cell.prev = cell.c; cell.c = c; cell.t0 = t; }
      const mode = this.still ? "instant" : G.CDM.digitMode || "slide";
      const dur = mode === "fade" ? 0.25 : 0.2, k = ease((t - cell.t0) / dur), mid = this.cur[i];
      const glyph = (ch, dy, a, blur) => {
        ctx.save(); ctx.globalAlpha = a;
        if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowSize || 40; }
        if (o.grad) { const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2); o.grad.forEach(([p, col]) => g.addColorStop(p, col)); ctx.fillStyle = g; } else ctx.fillStyle = o.color;
        ctx.fillText(ch, mid, dy);
        if (o.stroke) { ctx.shadowBlur = 0; ctx.lineWidth = o.strokeW || 2; ctx.strokeStyle = o.stroke; ctx.strokeText(ch, mid, dy); }
        ctx.restore();
      };
      // 숫자 바뀌는 모양(설정): 바로 · 살짝(옛 숫자는 바로 사라지고 새 숫자만 조금 올라오며 또렷해짐) · 부드럽게(제자리에서 흐려졌다 또렷해짐)
      if (k < 1 && c !== ":" && mode === "slide") glyph(c, (1 - k) * size * 0.1, 0.35 + 0.65 * k);
      else if (k < 1 && c !== ":" && mode === "fade") { if (k < 0.5) glyph(cell.prev, 0, 1 - k * 2); else glyph(c, 0, (k - 0.5) * 2); }
      else glyph(c, 0, 1);
    });
    ctx.restore();
  };
  // 마지막 10초: 숫자가 바뀔 때마다 빛 고리와 불꽃이 퍼짐
  // 마지막 10초 빛 고리 · 불꽃 — 목사님 말씀으로 뺌(2026-10-29). 숫자만 조금 커짐
  function finalBurst(ctx, x, y, left, color) {
    return;
    if (!(left <= 10 && left > 0)) return;
    const k = 1 - (left - Math.floor(left));
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const r = 120 + ease(k) * 520;
    ctx.strokeStyle = color.replace("A", String(0.55 * (1 - k))); ctx.lineWidth = 10 * (1 - k) + 1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    const R = rng(Math.floor(left) * 97 + 5);
    for (let i = 0; i < 46; i++) {
      const a = R() * TAU, sp = 200 + R() * 520, d = ease(k) * sp, s = (1 - k) * (2 + R() * 4);
      ctx.fillStyle = color.replace("A", String(0.9 * (1 - k)));
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, s, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function text(ctx, s, x, y, o) {
    if (!s || G.CDM_PART === "bg") return; ctx = ctx.__real || ctx;
    ctx.save(); ctx.font = `${o.weight || 500} ${o.size}px ${o.family || SANS}`; ctx.textAlign = o.align || "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = o.color; if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowSize || 20; }
    if (o.spacing) { try { ctx.letterSpacing = o.spacing + "px"; } catch (e) {} }
    let lines = String(s).split("\n");
    if (o.maxW) { // 너무 긴 줄은 낱말 단위로 나눔(최대 3줄)
      const out = []; for (const ln of lines) { let cur = ""; for (const w of ln.split(" ")) { const tr = cur ? cur + " " + w : w; if (ctx.measureText(tr).width > o.maxW && cur) { out.push(cur); cur = w; } else cur = tr; } out.push(cur); }
      lines = out.slice(0, 3); if (out.length > 3) lines[2] += "…";
    }
    const y0 = o.maxW ? y - ((lines.length - 1) * o.size * (o.lh || 1.5)) / 2 : y;
    lines.forEach((ln, i) => ctx.fillText(ln, x, y0 + i * o.size * (o.lh || 1.5)));
    ctx.restore();
  }
  // 떠다니는 먼지(빛줄기 안에서 더 밝게)
  function Motes(n, seed, area) { const R = rng(seed); this.p = Array.from({ length: n }, () => ({ x: R() * area.w + area.x, y: R() * area.h + area.y, z: 0.3 + R() * 0.7, s: R() * 1000, sp: 6 + R() * 16 })); this.area = area; }
  Motes.prototype.draw = function (ctx, t, lightAt, col) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const m of this.p) {
      const x = m.x + fbm(t * 0.05 + m.s, 1) * 60 * m.z + t * m.sp * 0.4 * m.z, y = m.y + fbm(t * 0.04 + m.s, 2) * 50 * m.z - t * m.sp * 0.25;
      const X = ((x - this.area.x) % this.area.w + this.area.w) % this.area.w + this.area.x, Y = ((y - this.area.y) % this.area.h + this.area.h) % this.area.h + this.area.y;
      const L = lightAt ? lightAt(X, Y) : 1, tw = 0.6 + 0.4 * Math.sin(t * 2 + m.s);
      const a = 0.08 + 0.85 * L * tw * m.z, r = 1 + m.z * 2.6;
      const g = ctx.createRadialGradient(X, Y, 0, X, Y, r * 3); g.addColorStop(0, col.replace("A", a.toFixed(3))); g.addColorStop(1, col.replace("A", "0"));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, r * 3, 0, TAU); ctx.fill();
    }
    ctx.restore();
  };
  // 둥근 빛망울(초점 밖 빛)
  function bokeh(ctx, t, n, seed, cols, scale) {
    const R = rng(seed); ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < n; i++) {
      const bx = R() * W, by = R() * H, r = (30 + R() * 110) * (scale || 1), ph = R() * 100, c = cols[i % cols.length], z = 0.3 + R() * 0.7;
      const x = bx + Math.sin(t * 0.07 * z + ph) * 90 * z, y = by + Math.cos(t * 0.05 * z + ph) * 60 * z, a = (0.05 + 0.12 * (0.5 + 0.5 * Math.sin(t * 0.6 + ph))) * z;
      const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r); g.addColorStop(0, c.replace("A", (a * 0.7).toFixed(3))); g.addColorStop(0.85, c.replace("A", a.toFixed(3))); g.addColorStop(1, c.replace("A", "0"));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  // 창으로 들어오는 빛줄기(부드러운 띠 여러 겹, 천천히 흔들림)
  function godRays(ctx, t, o) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    soft(ctx, o.blur >= 30 ? 14 : 10, (ctx) => { ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < o.n; i++) {
      const R = rng(o.seed + i * 13), w = o.w * (0.5 + R()), off = (R() - 0.5) * o.spread, br = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (0.25 + R() * 0.3) + R() * 9))) * o.a;
      const x0 = o.x + off + Math.sin(t * 0.1 + i) * 30;
      ctx.save(); ctx.translate(x0, o.y); ctx.rotate(o.angle + (R() - 0.5) * 0.05);
      const g = ctx.createLinearGradient(0, 0, 0, o.len); g.addColorStop(0, o.col.replace("A", br.toFixed(3))); g.addColorStop(0.55, o.col.replace("A", (br * 0.45).toFixed(3))); g.addColorStop(1, o.col.replace("A", "0"));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-w * 0.35, 0); ctx.lineTo(w * 0.35, 0); ctx.lineTo(w * 0.9, o.len); ctx.lineTo(-w * 0.9, o.len); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    }, "rays");
    ctx.restore();
  }
  function vignette(ctx, a) { const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  // 필름 같은 고운 알갱이(정지된 화면도 살아 있어 보이게)
  let grainC = null;
  function grain(ctx, t, a) {
    if (!grainC) grainC = layer(256, 256, (c) => { const d = c.createImageData(256, 256), R = rng(7); for (let i = 0; i < d.data.length; i += 4) { const v = R() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } c.putImageData(d, 0, 0); });
    ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = "overlay"; const ox = (Math.floor(t * 24) * 73) % 256, oy = (Math.floor(t * 24) * 41) % 256;
    ctx.translate(-ox, -oy); ctx.fillStyle = ctx.createPattern(grainC, "repeat"); ctx.fillRect(0, 0, W + 256, H + 256); ctx.restore();
  }

  const D = {};

  // 1. 십자가 빛 — 높은 창에서 내려오는 빛줄기, 그 속을 떠도는 먼지, 빛나는 십자가(번짐), 숨 쉬는 후광
  D.cross = function (o) {
    const motes = new Motes(170, 11, { x: 0, y: 0, w: W, h: H });
    const dg = new Digits(o.big, o.still);
    const cross = cached("cross.shape", () => layer(520, 760, (c) => {
      c.translate(260, 380); c.fillStyle = "#fff8e6";
      const bar = (x, y, w, h) => { c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 10); c.fill(); };
      bar(0, 0, 46, 520); bar(0, -110, 280, 46);
    }));
    const crossB40 = cached("cross.b40", () => blurred(cross, 18)), crossB12 = cached("cross.b12", () => blurred(cross, 6));
    // 고른 색(s.pal)이 있으면 바탕 · 빛 · 글자를 그 색으로. 밝은 색이면 십자가를 강조색으로 칠해 보이게
    const tint = (img, col, key) => cached(key + col, () => layer(img.width, img.height, (c) => { c.drawImage(img, 0, 0); c.globalCompositeOperation = "source-in"; c.fillStyle = col; c.fillRect(0, 0, img.width, img.height); }));
    return (ctx, t, left, s) => {
      const p = s.pal, lite = p && !p.dark, L = p ? rgbMix(p.accent, "#ffffff", p.dark ? 0.55 : 0) : "255,224,160";
      const g = ctx.createLinearGradient(0, 0, 0, H);
      if (p) { g.addColorStop(0, p.bg); g.addColorStop(0.6, p.bg2); g.addColorStop(1, lite ? p.bg2 : "#050505"); } else { g.addColorStop(0, "#1b1712"); g.addColorStop(0.6, "#0d0b09"); g.addColorStop(1, "#070605"); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // 벽의 은은한 돌결
      ctx.save(); ctx.globalAlpha = 0.18; const wl = ctx.createRadialGradient(W * 0.5, H * 0.35, 50, W * 0.5, H * 0.35, 900); wl.addColorStop(0, p ? p.accent : "#6b5a3a"); wl.addColorStop(1, "transparent"); ctx.fillStyle = wl; ctx.fillRect(0, 0, W, H); ctx.restore();
      // 왼쪽 위 높은 창에서 비스듬히 내려오는 빛
      godRays(ctx, t, { n: 7, seed: 3, x: W * 0.32, y: -120, angle: -0.42, len: 1700, w: 220, spread: 360, blur: 28, a: lite ? 0.12 : 0.22, col: `rgba(${L},A)` });
      const lightAt = (x, y) => { const dx = x - (W * 0.32 + y * 0.45); return clamp(1 - Math.abs(dx) / 380, 0, 1) * clamp(1.1 - y / H, 0, 1); };
      // 십자가 뒤 후광(숨 쉬듯)
      const br = 0.55 + 0.25 * Math.sin(t * 0.8) + (left <= 10 && left > 0 ? 0.35 * (1 - (left % 1)) : 0);
      ctx.save(); ctx.globalCompositeOperation = lite ? "source-over" : "lighter";
      for (const [r, a] of [[620, 0.10], [380, 0.16], [200, 0.26]]) { const h = ctx.createRadialGradient(W / 2, 360, 0, W / 2, 360, r); h.addColorStop(0, `rgba(${lite ? "255,255,255" : L},${a * br * (lite ? 1.6 : 1)})`); h.addColorStop(1, `rgba(${lite ? "255,255,255" : L},0)`); ctx.fillStyle = h; ctx.fillRect(0, 0, W, H); }
      // 십자가: 겹겹이 번진 빛 + 선명한 본체
      const cs = 0.62; ctx.translate(W / 2 - 260 * cs, 360 - 380 * cs + 40); ctx.scale(cs, cs);
      const cc = lite ? p.accent : p ? `rgb(${rgbMix(p.accent, "#ffffff", 0.8)})` : null;
      ctx.globalAlpha = 0.9 * br; ctx.drawImage(cc ? tint(crossB40, cc, "cross.b40.") : crossB40, 0, 0, 520, 760);
      ctx.globalAlpha = 0.9; ctx.drawImage(cc ? tint(crossB12, cc, "cross.b12.") : crossB12, 0, 0, 520, 760);
      ctx.globalAlpha = 1; ctx.drawImage(cc ? tint(cross, cc, "cross.c.") : cross, 0, 0);
      ctx.restore();
      // 십자가에서 아주 가늘게 번지는 빛 줄(한 방향 아님 — 위아래로 길게, 옆으로 짧게)
      if (!lite) {
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        const st = (w, h, a) => { ctx.save(); ctx.translate(W / 2, 330); ctx.scale(w, h); const q = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); q.addColorStop(0, `rgba(${p ? L : "255,240,200"},${a})`); q.addColorStop(1, `rgba(${p ? L : "255,240,200"},0)`); ctx.fillStyle = q; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill(); ctx.restore(); };
        st(26, 520, 0.22 * br); st(380, 18, 0.18 * br);
        ctx.restore();
      }
      motes.draw(ctx, t, lightAt, lite ? `rgba(${rgbMix(p.accent, "#ffffff", 0)},A)` : p ? `rgba(${L},A)` : "rgba(255,226,170,A)");
      text(ctx, s.top, W / 2, 668, { size: 48, color: p ? p.accent : "rgba(246,231,191,.9)", family: SERIF, weight: 700, spacing: 12 });
      dg.draw(ctx, fmt(left), W / 2, 820, { size: 190, family: SERIF, weight: 700, grad: p ? [[0, p.fg], [1, lite ? p.fg : p.accent]] : [[0, "#fff8e6"], [1, "#e8c779"]], glow: lite ? "rgba(255,255,255,.7)" : p ? `rgba(${L},.5)` : "rgba(255,210,140,.55)", glowSize: 50 }, t, left);
      finalBurst(ctx, W / 2, 820, left, "rgba(255,220,150,A)");
      text(ctx, s.sub, W / 2, 965, { size: 40, color: p ? p.fg : "rgba(220,205,170,.85)" });
      vignette(ctx, lite ? 0.18 : 0.65); grain(ctx, t, 0.05);
    };
  };


  // ── 스테인드글라스 공통: 망치 자국 유리 결(밝고 어두운 작은 볼록이), 둥근 부채꼴 햇살(고르지 않은 가는 빛줄) ──
  let hammerC = null;
  function hammer() {
    if (hammerC) return hammerC;
    hammerC = layer(512, 512, (c) => {
      c.fillStyle = "rgb(128,128,128)"; c.fillRect(0, 0, 512, 512);
      const R = rng(77);
      for (let i = 0; i < 2600; i++) { const x = R() * 512, y = R() * 512, r = 3 + R() * 9, l = R() < 0.5; const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r); g.addColorStop(0, l ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.4)"); g.addColorStop(1, "rgba(128,128,128,0)"); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
      for (let i = 0; i < 160; i++) { const y = R() * 512; c.strokeStyle = `rgba(255,255,255,${0.04 + R() * 0.06})`; c.lineWidth = 1 + R() * 2; c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= 512; x += 32) c.lineTo(x, y + Math.sin(x / 40 + i) * 6); c.stroke(); }
    });
    return hammerC;
  }
  function texture(ctx, x, y, w, h, a) { ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = "overlay"; ctx.fillStyle = ctx.createPattern(hammer(), "repeat"); ctx.translate(x, y); ctx.fillRect(0, 0, w, h); ctx.restore(); }
  function sunFlare(ctx, t, x, y, k, warm) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const [r, a] of [[1300, 0.20], [700, 0.32], [320, 0.55], [120, 0.9]]) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,250,235,${a * k})`); g.addColorStop(0.35, `rgba(${warm || "255,190,90"},${a * 0.5 * k})`); g.addColorStop(1, "rgba(255,160,60,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    // 가는 빛줄: 길이 · 굵기 · 밝기가 제각각이고 천천히 돌며 반짝임(규칙적인 줄무늬가 아님)
    const R = rng(51); ctx.lineCap = "round";
    for (let i = 0; i < 64; i++) {
      const a0 = R() * TAU + t * 0.02 * (R() < 0.5 ? 1 : -1), len = (220 + R() * 900) * (0.7 + 0.3 * Math.sin(t * (0.4 + R()) + i)), wdt = 1 + R() * 5, al = (0.05 + R() * 0.16) * k;
      const g = ctx.createLinearGradient(x, y, x + Math.cos(a0) * len, y + Math.sin(a0) * len); g.addColorStop(0, `rgba(255,240,200,${al})`); g.addColorStop(1, "rgba(255,200,120,0)");
      ctx.strokeStyle = g; ctx.lineWidth = wdt; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a0) * len, y + Math.sin(a0) * len); ctx.stroke();
    }
    // 렌즈에 비친 작은 빛 무늬
    for (let i = 1; i <= 4; i++) { const fx = lerp(x, W - x * 0.6, i * 0.22), fy = lerp(y, H - y * 0.5, i * 0.22), r = 30 + i * 18; const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, r); g.addColorStop(0, `rgba(255,220,170,${0.05 * k})`); g.addColorStop(0.8, `rgba(200,160,255,${0.06 * k})`); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, r, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // 픽셀마다 비틀린 보로노이로 조각 나누기(곡선 경계) — 조각 색 · 납줄 · 유리 결을 한 번에
  function glassPane(w, h, o) {
    return layer(w, h, (c) => {
      const R = rng(o.seed), pts = [];
      for (let i = 0; i < o.n; i++) pts.push({ x: R() * w, y: R() * h, c: o.pick(R, i), l: 0.82 + R() * 0.36 });
      const rgb = (hx) => [parseInt(hx.slice(1, 3), 16), parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16)];
      const cols = pts.map((p) => rgb(p.c)), img = c.createImageData(w, h), d = img.data, N = rng(o.seed + 5);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const wx = x + Math.sin(y / o.warp + o.seed) * o.amp + Math.sin(y / (o.warp * 0.37)) * o.amp * 0.3, wy = y + Math.sin(x / (o.warp * 0.8) + 1.3) * o.amp;
        let b1 = 1e9, b2 = 1e9, bi = 0;
        for (let i = 0; i < pts.length; i++) { const dx = wx - pts[i].x, dy = (wy - pts[i].y) * (o.sy || 1), dd = dx * dx + dy * dy; if (dd < b1) { b2 = b1; b1 = dd; bi = i; } else if (dd < b2) b2 = dd; }
        const edge = Math.sqrt(b2) - Math.sqrt(b1), i4 = (y * w + x) * 4;
        if (edge < o.lead) { d[i4] = 18; d[i4 + 1] = 16; d[i4 + 2] = 15; d[i4 + 3] = 255; continue; }
        const [r, g, b] = cols[bi], k = pts[bi].l * (0.78 + 0.22 * clamp(edge / 22, 0, 1)) * (1 + (N() - 0.5) * 0.1) * (1 + 0.08 * Math.sin(x * 0.07 + y * 0.05 + bi));
        d[i4] = clamp(r * k, 0, 255); d[i4 + 1] = clamp(g * k, 0, 255); d[i4 + 2] = clamp(b * k, 0, 255); d[i4 + 3] = 255;
      }
      c.putImageData(img, 0, 0);
      c.save(); c.globalCompositeOperation = "overlay"; c.globalAlpha = 0.75; c.fillStyle = c.createPattern(hammer(), "repeat"); c.fillRect(0, 0, w, h); c.restore();
    });
  }

  // 2. 스테인드글라스 십자가 — 앞에는 선명한 유리 십자가(굵은 납 테두리 · 비스듬한 조각 · 울퉁불퉁한 유리 결),
  //    뒤에는 흐릿한 색유리 창(얕은 초점), 왼쪽 위 햇빛이 천천히 움직이며 십자가 조각이 차례로 빛남, 빛 속 먼지
  D.glass = function (o) {
    const dg = new Digits(o.big, o.still), motes = new Motes(150, 23, { x: 0, y: 0, w: W, h: H });
    const warm = ["#c8102e", "#e8590c", "#f59f00", "#ffd43b", "#9c36b5", "#d6336c", "#f76707", "#e03131"];
    const cool = ["#1971c2", "#0b7285", "#2f9e44", "#5f3dc4", "#1098ad", "#e67700", "#f08c00", "#c92a2a", "#ffd43b", "#74b816"];
    // 뒤 창: 키 큰 유리판 여러 장(흐리게 그릴 것)
    // 고화질 영상(G.CDM_HQ): 뒤 창 · 십자가를 두 배 크게 · 조각을 더 잘게 그리고, 뒤 창은 덜 흐리게(유리 결이 보이게)
    const BK = G.CDM_HQ ? 2 : 1;
    const back = cached("glass.back" + BK, () => layer(1100 * BK, 620 * BK, (c) => {
      c.fillStyle = "#120c08"; c.fillRect(0, 0, 1100 * BK, 620 * BK);
      const cols = 7, cw = (1100 * BK) / cols;
      for (let i = 0; i < cols; i++) {
        const pane = glassPane(Math.floor(cw - 14 * BK), 600 * BK, { seed: 40 + i, n: BK > 1 ? 16 : 9, warp: 90 * BK, amp: 6 * BK, lead: 3 * BK, sy: 0.35, pick: (R) => cool[Math.floor(R() * cool.length)] });
        c.drawImage(pane, i * cw + 7 * BK, 10 * BK);
      }
    }));
    // 앞 십자가: 끝을 비스듬히 깎은 십자 모양, 안을 비스듬한 납줄로 나눔
    const CW = 760, CH = 1080, cx = CW / 2, armY = 330, th = 120, armW = 700;
    const crossPath = (c, inset) => { const i = inset || 0, a = th / 2 - i, cut = 26; c.beginPath();
      c.moveTo(cx - a + cut, 0 + i); c.lineTo(cx + a - cut, 0 + i); c.lineTo(cx + a, cut + i); c.lineTo(cx + a, armY - a); c.lineTo(cx + armW / 2 - cut - i, armY - a); c.lineTo(cx + armW / 2 - i, armY - a + cut); c.lineTo(cx + armW / 2 - i, armY + a - cut); c.lineTo(cx + armW / 2 - cut - i, armY + a); c.lineTo(cx + a, armY + a); c.lineTo(cx + a, CH); c.lineTo(cx - a, CH); c.lineTo(cx - a, armY + a); c.lineTo(cx - armW / 2 + cut + i, armY + a); c.lineTo(cx - armW / 2 + i, armY + a - cut); c.lineTo(cx - armW / 2 + i, armY - a + cut); c.lineTo(cx - armW / 2 + cut + i, armY - a); c.lineTo(cx - a, armY - a); c.lineTo(cx - a, cut + i); c.closePath(); };
    const cross = cached("glass.cross" + BK, () => layer(CW * BK, CH * BK, (c) => { c.scale(BK, BK);
      // 조각 색: 위아래 막대는 따뜻한 붉은 · 주황 · 보라, 가로 막대는 보라 · 주황이 번갈아
      const pane = glassPane(CW * BK, CH * BK, { seed: 9, n: 26, warp: 1e9, amp: 0, lead: 0, sy: 1, pick: (R) => warm[Math.floor(R() * warm.length)] });
      c.save(); crossPath(c, 14); c.clip(); c.drawImage(pane, 0, 0, CW, CH);
      // 조각을 나누는 비스듬한 납줄(사진처럼)
      c.strokeStyle = "#1a120d"; c.lineWidth = 11; c.lineCap = "round";
      const cuts = [[cx - 60, 150, cx + 60, 90], [cx - 60, 560, cx + 60, 470], [cx - 60, 760, cx + 60, 690], [cx - 60, 920, cx + 60, 860], [cx - 290, armY + 60, cx - 220, armY - 60], [cx - 150, armY + 60, cx - 110, armY - 60], [cx + 110, armY - 60, cx + 170, armY + 60], [cx + 230, armY - 60, cx + 290, armY + 60]];
      cuts.forEach(([a, b, d2, e]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(d2, e); c.stroke(); });
      c.beginPath(); c.moveTo(cx - 60, armY - 60); c.lineTo(cx + 60, armY + 60); c.moveTo(cx + 60, armY - 60); c.lineTo(cx - 60, armY + 60); c.lineWidth = 7; c.stroke();
      c.restore();
      // 굵은 납 테두리(살짝 둥글게 빛 받는 모서리)
      c.lineJoin = "round"; crossPath(c, 7); c.lineWidth = 16; c.strokeStyle = "#1c130e"; c.stroke();
      crossPath(c, 2); c.lineWidth = 3; c.strokeStyle = "rgba(255,210,150,.25)"; c.stroke();
    }));
    const crossGlow = cached("glass.glow" + BK, () => blurred(cross, 18 * BK)), backB = cached("glass.backB" + BK, () => blurred(back, BK > 1 ? 11 * BK : 30));
    return (ctx, t, left, s) => {
      ctx.fillStyle = "#0b0705"; ctx.fillRect(0, 0, W, H);
      // 카메라가 아주 천천히 흔들림(뒤 창은 덜, 십자가는 더 — 깊이)
      const camX = Math.sin(t * 0.12) * 40, camY = Math.cos(t * 0.09) * 18;
      ctx.save(); ctx.imageSmoothingQuality = "high"; ctx.globalAlpha = 0.95; ctx.drawImage(backB, -120 + camX * 0.35, -60 + camY * 0.35, W + 240, H + 120); ctx.restore();
      bokeh(ctx, t, 22, 15, ["rgba(255,200,120,A)", "rgba(120,200,255,A)", "rgba(255,120,160,A)", "rgba(160,255,170,A)"], 1.3);
      const sx = 420 + Math.sin(t * 0.18) * 140, sy = 210 + Math.cos(t * 0.13) * 50, flick = 0.85 + 0.15 * fbm(t * 0.7, 2);
      sunFlare(ctx, t, sx, sy, flick);
      // 십자가 뒤로 새어 나오는 색 빛
      const X = 1080 + camX, Y = 40 + camY, sc = 0.98;
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.55 * flick; ctx.drawImage(crossGlow, X - 40, Y - 20, CW * sc + 80, CH * sc + 40); ctx.restore();
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 40; ctx.imageSmoothingQuality = "high"; ctx.drawImage(cross, X, Y, CW * sc, CH * sc); ctx.restore();
      // 햇빛이 지나가는 자리 조각이 더 밝게(십자가 모양 안에서만)
      ctx.save(); ctx.translate(X, Y); ctx.scale(sc, sc); crossPath(ctx, 14); ctx.clip();
      ctx.globalCompositeOperation = "lighter";
      const bx = ((t * 120) % (CW + 600)) - 300, lg = ctx.createLinearGradient(bx - 220, 0, bx + 220, CH); lg.addColorStop(0, "rgba(255,240,200,0)"); lg.addColorStop(0.5, "rgba(255,240,200,.32)"); lg.addColorStop(1, "rgba(255,240,200,0)");
      ctx.fillStyle = lg; ctx.fillRect(0, 0, CW, CH);
      const hl = ctx.createRadialGradient((sx - X) / sc, (sy - Y) / sc, 0, (sx - X) / sc, (sy - Y) / sc, 900); hl.addColorStop(0, `rgba(255,230,180,${0.35 * flick})`); hl.addColorStop(1, "rgba(255,230,180,0)"); ctx.fillStyle = hl; ctx.fillRect(0, 0, CW, CH);
      ctx.restore();
      godRays(ctx, t, { n: 7, seed: 31, x: sx + 80, y: sy - 40, angle: -0.95, len: 1900, w: 200, spread: 300, blur: 30, a: 0.10, col: "rgba(255,226,170,A)" });
      motes.draw(ctx, t, (x, y) => clamp(1 - Math.hypot(x - sx, y - sy) / 1300, 0, 1), "rgba(255,232,190,A)");
      // 글 · 숫자: 왼쪽 아래 흐린 쪽에(고화질 영상은 뒤 창이 또렷해서 글 뒤를 살짝 어둡게)
      if (BK > 1) { const dk = ctx.createRadialGradient(520, 750, 60, 520, 750, 620); dk.addColorStop(0, "rgba(0,0,0,.5)"); dk.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = dk; ctx.fillRect(0, 0, W, H); }
      text(ctx, s.top, 520, 588, { size: 50, color: "rgba(255,240,215,.95)", family: SERIF, weight: 700, spacing: 10, glow: "rgba(0,0,0,.6)", glowSize: 18 });
      dg.draw(ctx, fmt(left), 520, 760, { size: 210, weight: 800, color: "#fff8ec", glow: "rgba(255,170,90,.6)", glowSize: 46 }, t, left);
      text(ctx, s.sub, 520, 905, { size: 40, color: "rgba(255,230,200,.9)", glow: "rgba(0,0,0,.6)", glowSize: 14 });
      vignette(ctx, 0.6); grain(ctx, t, 0.05);
    };
  };

  // 7. 아치 창 회랑 — 고딕 아치 창 여러 개(창마다 다른 빛깔, 곡선 납줄), 해가 지나며 창이 차례로 빛나고 바닥에 색 빛이 길게 비침
  D.arches = function (o) {
    const dg = new Digits(o.big, o.still), motes = new Motes(140, 41, { x: 0, y: 0, w: W, h: H });
    const themes = [["#0ca678", "#15aabf", "#74c0fc", "#38d9a9", "#e6fcf5"], ["#1c7ed6", "#4dabf7", "#3bc9db", "#845ef7", "#d0ebff"], ["#99e9f2", "#a5d8ff", "#e9ecef", "#ffe066", "#b2f2bb"], ["#fab005", "#ffd43b", "#fd7e14", "#94d82d", "#fff3bf"], ["#fd7e14", "#fa5252", "#ffa94d", "#f783ac", "#ffe066"], ["#e64980", "#ff8787", "#fcc419", "#ff6b6b", "#ffc9c9"], ["#12b886", "#40c057", "#7950f2", "#228be6", "#c0eb75"], ["#f76707", "#e8590c", "#d6336c", "#fab005", "#ffd8a8"]];
    const n = themes.length, gap = 26, mx = 60, aw = (W - mx * 2 - gap * (n - 1)) / n, ah = 820, top = 40;
    const archPath = (c, x, y, w, h) => { c.beginPath(); c.moveTo(x, y + h); c.lineTo(x, y + w * 0.9); c.quadraticCurveTo(x, y, x + w / 2, y - w * 0.12); c.quadraticCurveTo(x + w, y, x + w, y + w * 0.9); c.lineTo(x + w, y + h); c.closePath(); };
    const wall = cached("arches.wall", () => layer(W, H, (c) => {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#1c2024"); g.addColorStop(1, "#0b0d0f"); c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (let i = 0; i < n; i++) {
        const x = mx + i * (aw + gap), th = themes[i];
        const pane = glassPane(Math.ceil(aw), ah, { seed: 100 + i * 7, n: 22, warp: 70, amp: 26, lead: 2.6, sy: 0.8, pick: (R) => th[Math.floor(R() * th.length)] });
        c.save(); archPath(c, x, top + 40, aw, ah - 40); c.clip(); c.drawImage(pane, x, top);
        c.fillStyle = "#15120f"; c.fillRect(x, top + ah * 0.42, aw, 6); c.fillRect(x, top + ah * 0.7, aw, 6); c.restore();
        // 돌 틀
        c.lineWidth = 16; c.strokeStyle = "#2b2f33"; archPath(c, x, top + 40, aw, ah - 40); c.stroke();
        c.lineWidth = 3; c.strokeStyle = "rgba(255,255,255,.06)"; archPath(c, x - 5, top + 35, aw + 10, ah - 30); c.stroke();
      }
      // 바닥(어두운 돌)
      const fg = c.createLinearGradient(0, top + ah, 0, H); fg.addColorStop(0, "#15181b"); fg.addColorStop(1, "#08090a"); c.fillStyle = fg; c.fillRect(0, top + ah, W, H - top - ah);
    }));
    const glow = cached("arches.glow", () => blurred(wall, 4)), glowS = cached("arches.glowS", () => blurred(wall, 12));
    return (ctx, t, left, s) => {
      ctx.drawImage(wall, 0, 0);
      // 해가 왼쪽에서 오른쪽으로 지나감: 가까운 창이 더 밝게 빛남
      const sunX = ((t * 70) % (W + 800)) - 400;
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < n; i++) {
        const x = mx + i * (aw + gap), k = clamp(1 - Math.abs(x + aw / 2 - sunX) / 700, 0, 1), base = 0.25 + 0.15 * Math.sin(t * 0.6 + i);
        ctx.save(); archPath(ctx, x, top + 40, aw, ah - 40); ctx.clip();
        ctx.globalAlpha = base + 0.65 * k; ctx.drawImage(glow, x / 4, top / 4, aw / 4, ah / 4, x - 10, top - 10, aw + 20, ah + 20); ctx.restore();
        // 바닥으로 길게 비친 색 빛(비스듬히)
        ctx.save(); ctx.globalAlpha = (0.12 + 0.35 * k); ctx.transform(1, 0, 0.55, 0.32, 0, 0);
        const fy = (top + ah + 10) / 0.32; ctx.drawImage(glowS, x / 12, (top + ah * 0.3) / 12, aw / 12, (ah * 0.7) / 12, x - fy * 0.55 + 40, fy, aw * 1.1, ah * 1.05); ctx.restore();
      }
      ctx.restore();
      // 창마다 아래로 내려오는 색 빛줄기
      for (let i = 0; i < n; i += 2) { const x = mx + i * (aw + gap) + aw / 2, k = clamp(1 - Math.abs(x - sunX) / 700, 0, 1); godRays(ctx, t, { n: 2, seed: 60 + i, x, y: top + 200, angle: 0.5, len: 1100, w: 160, spread: 80, blur: 34, a: 0.05 + 0.12 * k, col: "rgba(255,245,225,A)" }); }
      motes.draw(ctx, t, (x, y) => clamp(1 - Math.abs(x - sunX) / 900, 0, 1) * (y > top + 200 ? 1 : 0.4), "rgba(255,245,230,A)");
      // 아래 글판
      const pg = ctx.createLinearGradient(0, 760, 0, H); pg.addColorStop(0, "rgba(5,6,7,0)"); pg.addColorStop(0.5, "rgba(5,6,7,.78)"); pg.addColorStop(1, "rgba(5,6,7,.9)"); ctx.fillStyle = pg; ctx.fillRect(0, 760, W, H - 760);
      text(ctx, s.top, W / 2, 822, { size: 42, color: "rgba(235,240,245,.9)", family: SERIF, weight: 700, spacing: 10 });
      dg.draw(ctx, fmt(left), W / 2, 965, { size: 160, weight: 800, color: "#ffffff", glow: "rgba(160,220,255,.5)", glowSize: 40 }, t, left);
      vignette(ctx, 0.55); grain(ctx, t, 0.05);
    };
  };

  function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const f = (v) => clamp(Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k), 0, 255); return `rgb(${f(r)},${f(g)},${f(b)})`; }

  // 4. 새벽 해돋이 — 남은 시간만큼 해가 떠오르고 하늘색이 바뀜, 겹겹이 흐르는 구름, 산 능선과 안개, 해 둘레 빛무리, 새
  D.sunrise = function (o) {
    const dg = new Digits(o.big, o.still), span = o.span || 15;
    const clouds = []; const CR = rng(12); for (let i = 0; i < 26; i++) clouds.push({ x: CR() * W * 1.4, y: 80 + CR() * 520, w: 260 + CR() * 520, h: 40 + CR() * 70, z: 0.2 + CR() * 0.8, s: CR() * 100 });
    const ridge = (seed, base, amp) => { const pts = []; for (let x = -20; x <= W + 20; x += 20) pts.push([x, base - Math.abs(fbm(x / 260, seed)) * amp - fbm(x / 70, seed + 4) * amp * 0.12]); return pts; };
    const R1 = ridge(3, 860, 220), R2 = ridge(8, 930, 160), R3 = ridge(13, 1000, 90);
    return (ctx, t, left, s) => {
      const p = clamp(1 - left / span, 0, 1), e = ease(p);
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, mix("#0d1530", "#3f6fb5", e)); sky.addColorStop(0.45, mix("#3a2a55", "#f0a36b", e)); sky.addColorStop(0.75, mix("#7a4a5a", "#ffd59a", e)); sky.addColorStop(1, mix("#2a1e2a", "#ffe9c4", e));
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // 별(해가 뜨면 사라짐)
      const SR = rng(2); ctx.save(); for (let i = 0; i < 120; i++) { const x = SR() * W, y = SR() * 500, a = (1 - e) * (0.3 + 0.7 * Math.abs(Math.sin(t * (1 + SR() * 2) + i))); ctx.fillStyle = `rgba(255,255,255,${a * 0.8})`; ctx.fillRect(x, y, 2, 2); } ctx.restore();
      const sy = lerp(1060, 700, e), sx = W * 0.5;
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (const [r, a] of [[1100, 0.18], [600, 0.28], [300, 0.45]]) { const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r); g.addColorStop(0, `rgba(255,214,150,${a})`); g.addColorStop(1, "rgba(255,180,120,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      // 해 빛살: 부드러운 원뿔(줄무늬 아님), 천천히 일렁임
      soft(ctx, 10, (ctx) => { ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.28 + Math.sin(t * 0.15 + i) * 0.04, L = 900 + 200 * Math.sin(t * 0.3 + i * 2); ctx.save(); ctx.translate(sx, sy); ctx.rotate(a + Math.PI / 2); const g = ctx.createLinearGradient(0, 0, 0, -L); g.addColorStop(0, `rgba(255,236,190,${0.10 * e + 0.03})`); g.addColorStop(1, "rgba(255,236,190,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(30, 0); ctx.lineTo(130, -L); ctx.lineTo(-130, -L); ctx.fill(); ctx.restore(); }
      }, "sunrays");
      ctx.restore();
      ctx.save(); ctx.fillStyle = "#fff6dc"; ctx.shadowColor = "rgba(255,210,140,1)"; ctx.shadowBlur = 90; ctx.beginPath(); ctx.arc(sx, sy, 92, 0, TAU); ctx.fill(); ctx.restore();
      // 구름: 깊이에 따라 다른 빠르기, 아래쪽은 해빛을 받아 물듦
      soft(ctx, 6, (ctx) => { for (const c of clouds) {
        const x = ((c.x + t * 14 * c.z) % (W * 1.4)) - W * 0.2, y = c.y;
        ctx.save(); ctx.globalAlpha = 0.5 + 0.4 * c.z;
        const g = ctx.createLinearGradient(0, y - c.h, 0, y + c.h); g.addColorStop(0, mix("#2a2440", "#fff2e2", e * 0.9)); g.addColorStop(1, mix("#4a3048", "#ffb47a", e));
        ctx.fillStyle = g;
        for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(x + (k - 2) * c.w * 0.22, y + Math.sin(k + c.s) * c.h * 0.25, c.w * 0.3, c.h * (0.7 + 0.3 * Math.sin(k * 2 + c.s)), 0, 0, TAU); ctx.fill(); }
        ctx.restore();
      } }, "clouds");
      // 산 능선 3겹 + 그 사이 안개
      const hill = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-20, H); pts.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.lineTo(W + 20, H); ctx.fill(); };
      hill(R1, mix("#2a1e30", "#8a6a78", e * 0.6)); ctx.save(); ctx.globalAlpha = 0.5; const fog = ctx.createLinearGradient(0, 800, 0, 980); fog.addColorStop(0, "rgba(255,220,200,0)"); fog.addColorStop(1, `rgba(255,220,200,${0.35 * e + 0.1})`); ctx.fillStyle = fog; ctx.fillRect(0, 780, W, 220); ctx.restore();
      hill(R2, mix("#1e1624", "#5a4456", e * 0.5)); hill(R3, mix("#120d16", "#2e2230", e * 0.4));
      // 새 몇 마리
      ctx.save(); ctx.strokeStyle = "rgba(30,20,30,.75)"; ctx.lineWidth = 3; for (let i = 0; i < 5; i++) { const bx = ((t * 60 + i * 140) % (W + 400)) - 200, by = 420 + i * 22 + Math.sin(t * 1.3 + i) * 10, f = Math.sin(t * 9 + i * 1.7) * 8; ctx.beginPath(); ctx.moveTo(bx - 16, by - f); ctx.quadraticCurveTo(bx - 7, by - 6, bx, by); ctx.quadraticCurveTo(bx + 7, by - 6, bx + 16, by - f); ctx.stroke(); } ctx.restore();
      text(ctx, s.top, W / 2, 110, { size: 44, color: "rgba(255,248,235,.95)", family: SERIF, weight: 700, spacing: 10, glow: "rgba(0,0,0,.35)", glowSize: 14 });
      dg.draw(ctx, fmt(left), W / 2, 250, { size: 170, weight: 800, color: "#ffffff", glow: "rgba(255,190,120,.55)", glowSize: 40 }, t, left);
      finalBurst(ctx, W / 2, 250, left, "rgba(255,230,190,A)");
      text(ctx, s.verse || s.sub, W / 2, 410, { size: 36, color: "rgba(255,248,235,.95)", family: SERIF, weight: 700, glow: "rgba(0,0,0,.35)", glowSize: 14, maxW: 1500, lh: 1.45 });
      grain(ctx, t, 0.04);
    };
  };
  function mix(a, b, k) { const p = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; const A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], k))).join(",")})`; }

  // 5. 계절(가을) — 바람에 흔들리며 뒤집히는 잎, 깊이(크기 · 흐림), 따뜻한 빛망울, 바닥에 쌓인 잎
  // 5. 계절 — 예배 날짜에 따라 저절로: 봄(꽃잎) · 여름(초록 잎 · 햇살) · 가을(단풍) · 겨울(눈)
  const SEASONS = {
    spring: { bg: ["#f6dfe6", "#f1c6d3", "#e9b3c4"], bok: ["rgba(255,255,255,A)", "rgba(255,190,210,A)", "rgba(255,230,240,A)"], cols: ["#f7b6c8", "#f9cdd9", "#f39bb6", "#ffe1ea", "#f5a8c0"], kind: "petal", fg: "#6b2e45", glow: "rgba(255,255,255,.7)", sub: "rgba(110,50,75,.85)", ground: null },
    summer: { bg: ["#cfe8c9", "#8cc79a", "#3f8a5c"], bok: ["rgba(255,255,220,A)", "rgba(200,255,200,A)", "rgba(255,255,255,A)"], cols: ["#4caf50", "#66bb6a", "#2e7d32", "#81c784", "#9ccc65"], kind: "leaf", fg: "#ffffff", glow: "rgba(30,80,40,.55)", sub: "rgba(255,255,255,.92)", ground: null, rays: true },
    autumn: { bg: ["#3a2414", "#5a3018", "#2a160a"], bok: ["rgba(255,190,110,A)", "rgba(255,150,80,A)", "rgba(255,220,150,A)"], cols: ["#d9822b", "#b3461e", "#e0a040", "#c96a2a", "#8f3a1a", "#e6b84a"], kind: "maple", fg: "#fff3e0", glow: "rgba(255,170,90,.5)", sub: "rgba(250,225,195,.9)", ground: "leaves" },
    winter: { bg: ["#0f1d33", "#1c3354", "#2c4a6e"], bok: ["rgba(255,230,180,A)", "rgba(180,210,255,A)", "rgba(255,255,255,A)"], cols: ["#ffffff"], kind: "snow", fg: "#ffffff", glow: "rgba(160,200,255,.6)", sub: "rgba(225,235,250,.9)", ground: "snow" },
  };
  function seasonKey(m) { return m >= 3 && m <= 5 ? "spring" : m >= 6 && m <= 8 ? "summer" : m >= 9 && m <= 11 ? "autumn" : "winter"; }
  D.season = function (o) {
    const dg = new Digits(o.big, o.still); const R = rng(31);
    const parts = Array.from({ length: 90 }, () => ({ x: R() * W, y: R() * H, z: 0.25 + R() * 0.75, s: R() * 100, r: R() * TAU, ci: Math.floor(R() * 6), k: R() < 0.5 ? 0 : 1 }));
    const shape = (ctx, size, kind, k) => {
      ctx.beginPath();
      if (kind === "maple" && k === 0) { for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + (i / 10) * TAU, rr = i % 2 ? size * 0.45 : size; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.9); } }
      else if (kind === "petal") { ctx.moveTo(0, -size); ctx.bezierCurveTo(size * 0.9, -size * 0.6, size * 0.7, size * 0.8, 0, size); ctx.bezierCurveTo(-size * 0.7, size * 0.8, -size * 0.9, -size * 0.6, 0, -size); ctx.moveTo(0, -size); ctx.lineTo(-size * 0.15, -size * 0.75); ctx.lineTo(size * 0.15, -size * 0.75); }
      else { ctx.moveTo(0, -size); ctx.quadraticCurveTo(size * 0.7, -size * 0.2, 0, size); ctx.quadraticCurveTo(-size * 0.7, -size * 0.2, 0, -size); }
      ctx.closePath(); ctx.fill();
      if (kind !== "petal") { ctx.strokeStyle = "rgba(40,25,10,.35)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -size * 0.9); ctx.lineTo(0, size * 0.9); ctx.stroke(); }
    };
    return (ctx, t, left, s) => {
      const C = SEASONS[s.season || seasonKey(s.month || new Date().getMonth() + 1)];
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.bg[0]); g.addColorStop(0.6, C.bg[1]); g.addColorStop(1, C.bg[2]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (C.rays) godRays(ctx, t, { n: 6, seed: 4, x: W * 0.25, y: -100, angle: -0.35, len: 1600, w: 260, spread: 500, blur: 30, a: 0.16, col: "rgba(255,255,220,A)" });
      if (C.kind === "snow") { ctx.save(); ctx.globalCompositeOperation = "lighter"; for (const [x, y, r] of [[320, 760, 420], [1500, 700, 520]]) { const gg = ctx.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, "rgba(255,200,130,.18)"); gg.addColorStop(1, "rgba(255,200,130,0)"); ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H); } ctx.restore(); }
      bokeh(ctx, t, 24, 4, C.bok, 1.2);
      const wind = fbm(t * 0.25, 5) * 1.2 + (C.kind === "snow" ? 0.15 : 0.4);
      const draw = (front, ctx, far) => { for (const L of parts) {
        if ((L.z > 0.6) !== front) continue;
        if (far !== undefined && (L.z < 0.45) !== far) continue;
        const snow = C.kind === "snow", fall = (snow ? 30 : 40) + (snow ? 50 : 70) * L.z;
        const x0 = L.x + t * (60 * wind) * L.z + Math.sin(t * (snow ? 0.6 : 0.9) + L.s) * (snow ? 40 : 80) * L.z, y0 = L.y + t * fall;
        const x = ((x0 % (W + 200)) + W + 200) % (W + 200) - 100, y = ((y0 % (H + 200)) + H + 200) % (H + 200) - 100;
        if (snow) { const r = 2 + 6 * L.z; const gg = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6); gg.addColorStop(0, `rgba(255,255,255,${0.5 + 0.5 * L.z})`); gg.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, TAU); ctx.fill(); continue; }
        const size = (C.kind === "petal" ? 10 : 14) + (C.kind === "petal" ? 16 : 26) * L.z, flip = Math.cos(t * (1.2 + L.z) + L.s), rot = L.r + t * (0.6 + L.z) * (L.s > 50 ? 1 : -1), col = C.cols[L.ci % C.cols.length];
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(Math.max(0.15, Math.abs(flip)), 1);
        ctx.fillStyle = flip > 0 ? col : shade(col, -0.2); ctx.globalAlpha = 0.6 + 0.4 * L.z; shape(ctx, size, C.kind, L.k); ctx.restore();
      } };
      soft(ctx, 4, (x) => draw(false, x, true), "leaves"); draw(false, ctx, false);
      text(ctx, s.top, W / 2, 330, { size: 52, color: C.fg, family: SERIF, weight: 700, spacing: 10, glow: C.glow });
      dg.draw(ctx, fmt(left), W / 2, 500, { size: 200, weight: 800, color: C.fg, glow: C.glow, glowSize: 40 }, t, left);
      text(ctx, s.sub, W / 2, 660, { size: 38, color: C.sub, family: SERIF, weight: 700 });
      if (C.ground === "leaves") { ctx.save(); const BR = rng(9); for (let i = 0; i < 160; i++) { const x = BR() * W, y = H - 20 + BR() * 40 - Math.abs(Math.sin(x / 300)) * 30, sz = 12 + BR() * 20, c = C.cols[Math.floor(BR() * C.cols.length)]; ctx.save(); ctx.translate(x, y); ctx.rotate(BR() * TAU); ctx.scale(1, 0.55); ctx.fillStyle = shade(c, -0.3 + BR() * 0.3); shape(ctx, sz, "maple", BR() < 0.5 ? 0 : 1); ctx.restore(); } ctx.restore(); }
      if (C.ground === "snow") { const sg = ctx.createLinearGradient(0, H - 140, 0, H); sg.addColorStop(0, "#dfe9f5"); sg.addColorStop(1, "#b9cbe0"); ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 40) ctx.lineTo(x, H - 90 - Math.sin(x / 260) * 26 - Math.sin(x / 90) * 8); ctx.lineTo(W, H); ctx.fill(); }
      draw(true, ctx);
      vignette(ctx, C.kind === "snow" || C.kind === "maple" ? 0.55 : 0.25); grain(ctx, t, 0.04);
    };
  };

  // 6. 빛 입자(새로) — 깊은 하늘의 빛망울 세 겹(앞 · 뒤 다른 빠르기), 오로라 띠, 별똥별, 반짝이는 숫자
  D.aurora = function (o) {
    const dg = new Digits(o.big, o.still), motes = new Motes(200, 17, { x: 0, y: 0, w: W, h: H });
    return (ctx, t, left, s) => {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#050816"); g.addColorStop(1, "#0b1430"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // 오로라: 사인 곡선 띠 여러 겹, 색이 천천히 흐름
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      soft(ctx, 20, (ctx) => { ctx.globalCompositeOperation = "lighter"; for (let b = 0; b < 4; b++) {
        const hue = [150, 175, 200, 280][b], y0 = 260 + b * 70;
        for (let x = -40; x < W + 40; x += 18) {
          const y = y0 + Math.sin(x / 260 + t * 0.35 + b) * 70 + fbm(x / 400 + t * 0.1, b) * 90, hgt = 160 + 120 * (0.5 + 0.5 * Math.sin(x / 180 - t * 0.5 + b * 2));
          const a = 0.10 + 0.10 * (0.5 + 0.5 * Math.sin(x / 120 + t * 0.8 + b));
          const gg = ctx.createLinearGradient(0, y, 0, y + hgt); gg.addColorStop(0, `hsla(${hue},90%,65%,0)`); gg.addColorStop(0.3, `hsla(${hue},90%,65%,${a})`); gg.addColorStop(1, `hsla(${hue + 20},90%,55%,0)`);
          ctx.fillStyle = gg; ctx.fillRect(x, y, 18.5, hgt); // 겹치지 않게(겹치면 더해져 세로 줄무늬)
        }
      } }, "aurora");
      ctx.restore();
      bokeh(ctx, t, 18, 9, ["rgba(120,160,255,A)", "rgba(170,130,255,A)", "rgba(120,220,255,A)"], 1.5);
      // 별 · 별똥별
      const SR = rng(3); ctx.save(); for (let i = 0; i < 220; i++) { const x = SR() * W, y = SR() * H, tw = 0.3 + 0.7 * Math.abs(Math.sin(t * (0.5 + SR() * 2) + i)); ctx.fillStyle = `rgba(255,255,255,${tw * 0.7})`; const z = SR() < 0.1 ? 3 : 1.6; ctx.fillRect(x, y, z, z); } ctx.restore();
      for (let k = 0; k < 2; k++) { const per = 5.5 + k * 3.1, ph = ((t + k * 2.3) % per) / per; if (ph < 0.18) { const q = ph / 0.18, x = 300 + k * 900 + q * 700, y = 100 + k * 60 + q * 260; ctx.save(); ctx.globalCompositeOperation = "lighter"; const sg = ctx.createLinearGradient(x - 260, y - 100, x, y); sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(1, `rgba(255,255,255,${0.9 * (1 - q)})`); ctx.strokeStyle = sg; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 260, y - 100); ctx.lineTo(x, y); ctx.stroke(); ctx.restore(); } }
      motes.draw(ctx, t, null, "rgba(180,200,255,A)");
      text(ctx, s.top, W / 2, 360, { size: 50, color: "rgba(200,215,255,.95)", weight: 600, spacing: 18 });
      dg.draw(ctx, fmt(left), W / 2, 540, { size: 230, weight: 800, color: "#ffffff", glow: "rgba(120,170,255,.75)", glowSize: 60 }, t, left);
      finalBurst(ctx, W / 2, 540, left, "rgba(170,200,255,A)");
      text(ctx, s.sub, W / 2, 720, { size: 40, color: "rgba(210,220,245,.9)" });
      vignette(ctx, 0.5); grain(ctx, t, 0.04);
    };
  };


  // ── 색 고르기(팔레트) — 렌더러가 s.pal 로 넘김. 없으면 디자인마다 기본 ──
  function P(s, def) { return Object.assign({ bg: "#faf6ee", bg2: "#efe7d6", fg: "#17402c", accent: "#a8873a", glow: "rgba(232,199,121,.28)", glow2: "rgba(42,107,71,.14)", pill: "#ffffff", pillFg: "#2a6b47", dark: false }, def || {}, s.pal || {}); }
  function bgFill(ctx, p) { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, p.bg); g.addColorStop(1, p.bg2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  const IMG = {};
  function img(url) { if (!url) return null; let im = IMG[url]; if (!im) { im = IMG[url] = new Image(); im.src = url; } return im.complete && im.naturalWidth ? im : null; }
  function cover(ctx, im, x, y, w, h, zoom, px, py) { const nw = im.naturalWidth || im.videoWidth, nh = im.naturalHeight || im.videoHeight; if (!nw || !nh) return; const r = Math.max(w / nw, h / nh) * (zoom || 1), iw = nw * r, ih = nh * r; ctx.drawImage(im, x + (w - iw) * (px == null ? 0.5 : px), y + (h - ih) * (py == null ? 0.5 : py), iw, ih); }
  const VID = {};
  function vid(url) { let v = VID[url]; if (!v) { v = VID[url] = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url; } return v; }
  const isVid = (u) => /\.(mp4|mov|m4v|webm)(\?|$)/i.test(String(u || ""));

  // 8. 수채화 말씀 — 물감이 번지듯 색이 천천히 퍼지고 겹치는 종이 바탕, 가운데 말씀, 얇은 숫자
  D.water = function (o) {
    const dg = new Digits(o.big, o.still);
    const paper = cached("water.paper", () => layer(512, 512, (c) => { c.fillStyle = "#808080"; c.fillRect(0, 0, 512, 512); const R = rng(3); for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(${R() < 0.5 ? 255 : 0},${R() < 0.5 ? 255 : 0},${R() < 0.5 ? 255 : 0},.05)`; c.fillRect(R() * 512, R() * 512, 1 + R() * 2, 1 + R() * 2); } }));
    const blooms = Array.from({ length: 10 }, (_, i) => { const R = rng(70 + i); return { x: ((i % 5) + 0.2 + R() * 0.6) * (W / 5), y: (Math.floor(i / 5) * 0.62 + 0.12 + R() * 0.3) * H, r: 240 + R() * 260, ph: R() * 10, sp: 0.04 + R() * 0.06, ci: i }; });
    return (ctx, t, left, s) => {
      const p = P(s, { bg: "#fbf8f2", bg2: "#f3ece0", fg: "#33465c", accent: "#8a7a5c" });
      bgFill(ctx, p);
      const cols = p.dark ? [p.accent, "#6fa8dc", "#e6a870", "#96c896"] : s.pal ? [p.accent, p.fg, "#e6a870", "#6fa0d2"] : ["#5b9bd5", "#f0a35e", "#8cc58c", "#e58fa8", "#c9a24a"];
      soft(ctx, 3, (x) => {
        x.globalCompositeOperation = p.dark ? "lighter" : "source-over";
        for (const b of blooms) {
          const cx = b.x + Math.sin(t * b.sp + b.ph) * 120, cy = b.y + Math.cos(t * b.sp * 0.8 + b.ph) * 90, rr = b.r * (0.85 + 0.15 * Math.sin(t * 0.3 + b.ph));
          const col = cols[b.ci % cols.length];
          for (let k = 0; k < 5; k++) {
            x.beginPath();
            for (let a = 0; a <= TAU + 0.01; a += TAU / 40) { const n = fbm(a * 1.6 + k * 3 + b.ph + t * 0.05, b.ci + k); const r = rr * (0.55 + k * 0.1) * (1 + 0.22 * n); x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8); }
            x.closePath(); x.fillStyle = hexA(col, p.dark ? 0.08 : 0.06); x.fill();
            if (k === 4) { x.strokeStyle = hexA(col, p.dark ? 0.12 : 0.16); x.lineWidth = 10; x.stroke(); } // 물감이 마르며 가장자리에 모이는 진한 테
          }
        }
      }, "water");
      ctx.save(); ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = 0.35; ctx.fillStyle = ctx.createPattern(paper, "repeat"); ctx.fillRect(0, 0, W, H); ctx.restore();
      text(ctx, s.top, W / 2, 200, { size: 44, color: p.fg, family: SERIF, weight: 700, spacing: 10 });
      const v = s.verse || s.sub || "";
      if (v) text(ctx, v, W / 2, 420, { size: 56, color: p.fg, family: SERIF, weight: 700, lh: 1.6, maxW: 1500 });
      dg.draw(ctx, fmt(left), W / 2, 740, { size: 190, weight: 300, color: p.fg }, t, left);
      if (s.verse && s.sub) text(ctx, s.sub, W / 2, 900, { size: 36, color: p.accent, weight: 600 });
      grain(ctx, t, 0.03);
    };
  };
  function hexA(c, a) { if (c[0] !== "#") return c; const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

  // 9. 큰 숫자 — 아주 큰 얇은 숫자 하나, 숫자 위를 지나가는 빛, 가는 진행 막대, 은은한 점 무늬
  D.bignum = function (o) {
    const dg = new Digits(o.big, o.still), span = o.span || 300, motes = new Motes(80, 61, { x: 0, y: 0, w: W, h: H });
    return (ctx, t, left, s) => {
      const p = P(s, { bg: "#0e1013", bg2: "#16191e", fg: "#ffffff", accent: "#4fbf7c", dark: true });
      bgFill(ctx, p);
      ctx.save(); ctx.globalAlpha = p.dark ? 0.06 : 0.08; ctx.fillStyle = p.fg; for (let y = 60; y < H; y += 60) for (let x = 60; x < W; x += 60) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill(); } ctx.restore();
      motes.draw(ctx, t, null, p.dark ? "rgba(255,255,255,A)" : "rgba(0,0,0,A)");
      text(ctx, s.top, W / 2, 230, { size: 46, color: hexA(p.fg, 0.8), weight: 500, spacing: 18 });
      dg.draw(ctx, fmt(left), W / 2, 520, { size: 400, weight: 200, color: p.fg }, t, left);
      // 숫자 위를 천천히 지나가는 빛
      ctx.save(); ctx.globalCompositeOperation = p.dark ? "lighter" : "overlay"; const sx = ((t * 260) % (W + 1200)) - 600; const lg = ctx.createLinearGradient(sx - 300, 0, sx + 300, 0); lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.5, `rgba(255,255,255,${p.dark ? 0.10 : 0.25})`); lg.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = lg; ctx.fillRect(0, 320, W, 400); ctx.restore();
      const f = left == null ? 0 : clamp(left / span, 0, 1);
      ctx.fillStyle = hexA(p.fg, 0.12); ctx.beginPath(); ctx.roundRect(W * 0.18, 790, W * 0.64, 8, 4); ctx.fill();
      ctx.fillStyle = p.accent; ctx.beginPath(); ctx.roundRect(W * 0.18, 790, W * 0.64 * f, 8, 4); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = "lighter"; const gx = W * 0.18 + W * 0.64 * f; const gg = ctx.createRadialGradient(gx, 794, 0, gx, 794, 40); gg.addColorStop(0, hexA(p.accent, 0.7)); gg.addColorStop(1, hexA(p.accent, 0)); ctx.fillStyle = gg; ctx.fillRect(gx - 40, 754, 80, 80); ctx.restore();
      text(ctx, s.sub, W / 2, 880, { size: 38, color: hexA(p.fg, 0.7) });
      grain(ctx, t, 0.03);
    };
  };

  // 10. 잔잔한 물결 — 여러 겹 물결선이 흐르고, 수평선 위 달빛(햇빛) 기둥이 물 위에 반짝임
  D.wave = function (o) {
    const dg = new Digits(o.big, o.still);
    return (ctx, t, left, s) => {
      const p = P(s, { bg: "#0f2a3a", bg2: "#14445a", fg: "#e6f6fb", accent: "#bfe3ee", dark: true });
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, p.bg); g.addColorStop(0.55, p.bg2); g.addColorStop(1, shade(p.bg.length === 7 ? p.bg : "#0f2a3a", -0.3)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const hy = 640;
      ctx.save(); ctx.globalCompositeOperation = "lighter"; const mg = ctx.createRadialGradient(W / 2, hy - 120, 0, W / 2, hy - 120, 520); mg.addColorStop(0, hexA(p.accent, 0.35)); mg.addColorStop(1, hexA(p.accent, 0)); ctx.fillStyle = mg; ctx.fillRect(0, 0, W, H);
      // 물 위 빛 기둥: 짧은 가로 반짝임들이 흔들림
      const R = rng(5); for (let i = 0; i < 160; i++) { const yy = hy + 10 + R() * 420, spread = 60 + (yy - hy) * 0.5, xx = W / 2 + (R() - 0.5) * spread * 2 + Math.sin(t * 1.2 + i) * 14, w = 10 + R() * 50 * (1 - (yy - hy) / 500), a = (0.25 + 0.75 * Math.abs(Math.sin(t * (1 + R() * 2) + i))) * 0.35 * (1 - (yy - hy) / 480); ctx.fillStyle = hexA(p.accent, a); ctx.fillRect(xx - w / 2, yy, w, 2); }
      ctx.restore();
      // 물결선 여러 겹(멀수록 얇고 촘촘하게)
      for (let k = 0; k < 14; k++) { const y0 = hy + 8 + Math.pow(k / 14, 1.6) * 430, amp = 4 + k * 2.2, a = 0.08 + 0.18 * (k / 14); ctx.strokeStyle = hexA(p.accent, a); ctx.lineWidth = 1 + k * 0.18; ctx.beginPath(); for (let x = -20; x <= W + 20; x += 16) { const y = y0 + Math.sin(x / (120 + k * 22) + t * (0.5 + k * 0.05) + k) * amp + fbm(x / 300 + t * 0.2, k) * amp * 0.8; x < 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
      ctx.fillStyle = hexA(p.accent, 0.25); ctx.fillRect(0, hy, W, 1.5);
      text(ctx, s.top, W / 2, 150, { size: 44, color: hexA(p.fg, 0.85), family: SERIF, weight: 700, spacing: 10 });
      dg.draw(ctx, fmt(left), W / 2, 330, { size: 190, weight: 700, color: p.fg, glow: hexA(p.accent, 0.4), glowSize: 30 }, t, left);
      text(ctx, s.verse || s.sub, W / 2, 510, { size: 40, color: hexA(p.fg, 0.9), family: SERIF, weight: 700, maxW: 1500, lh: 1.45 });
      vignette(ctx, 0.45); grain(ctx, t, 0.03);
    };
  };

  // 11. 시계 문자판 — 지금 시각을 가리키는 바늘(초침이 흐름), 지금부터 예배 시작까지 남은 부분이 색 띠로 줄어듦
  D.clock = function (o) {
    const dg = new Digits(o.big, o.still);
    return (ctx, t, left, s) => {
      const p = P(s, { bg: "#f2efe8", bg2: "#e6e0d3", fg: "#17402c", accent: "#c9a24a" });
      bgFill(ctx, p);
      const cx = W * 0.36, cy = H * 0.5, R0 = 360, now = new Date(), sec = now.getSeconds() + now.getMilliseconds() / 1000, min = now.getMinutes() + sec / 60, hr = (now.getHours() % 12) + min / 60;
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 50; ctx.fillStyle = p.dark ? shade("#222831", 0.05) : "#ffffff"; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, TAU); ctx.fill(); ctx.restore();
      ctx.lineWidth = 14; ctx.strokeStyle = p.fg; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, TAU); ctx.stroke();
      // 남은 시간 띠: 지금 분침 자리 → 시작 시각(최대 60분)
      if (left != null && left > 0) { const a0 = (min / 60) * TAU - Math.PI / 2, a1 = a0 + Math.min(1, left / 3600) * TAU; ctx.strokeStyle = hexA(p.accent, 0.85); ctx.lineWidth = 26; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(cx, cy, R0 - 44, a0, a1); ctx.stroke(); ctx.lineCap = "butt"; }
      for (let i = 0; i < 60; i++) { const a = (i / 60) * TAU, big = i % 5 === 0; ctx.strokeStyle = hexA(p.fg, big ? 0.9 : 0.35); ctx.lineWidth = big ? 6 : 2; ctx.beginPath(); ctx.moveTo(cx + Math.sin(a) * (R0 - 18), cy - Math.cos(a) * (R0 - 18)); ctx.lineTo(cx + Math.sin(a) * (R0 - (big ? 70 : 40)), cy - Math.cos(a) * (R0 - (big ? 70 : 40))); ctx.stroke(); }
      const hand = (a, len, w, col) => { ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, len * 0.15); ctx.lineTo(0, -len); ctx.stroke(); ctx.restore(); };
      hand((hr / 12) * TAU, 190, 16, p.fg); hand((min / 60) * TAU, 280, 10, p.fg); hand((sec / 60) * TAU, 300, 3, p.accent);
      ctx.fillStyle = p.accent; ctx.beginPath(); ctx.arc(cx, cy, 14, 0, TAU); ctx.fill();
      const rx = W * 0.73;
      text(ctx, s.top, rx, 330, { size: 48, color: p.fg, family: SERIF, weight: 700, spacing: 6 });
      text(ctx, "예배까지", rx, 450, { size: 36, color: hexA(p.fg, 0.7), weight: 600 });
      dg.draw(ctx, fmt(left), rx, 570, { size: 170, weight: 800, color: p.fg }, t, left);
      text(ctx, s.sub, rx, 720, { size: 36, color: hexA(p.fg, 0.75) });
      grain(ctx, t, 0.03);
    };
  };

  // 12. 오늘의 예배 순서 — 왼쪽 큰 숫자, 오른쪽에 오늘 찬양 · 말씀 · 설교가 하나씩 떠오르고 차례로 밝아짐
  D.order = function (o) {
    const dg = new Digits(o.big, o.still);
    return (ctx, t, left, s) => {
      const p = P(s, { bg: "#f6f3ec", bg2: "#ebe4d4", fg: "#17402c", accent: "#2a6b47" });
      bgFill(ctx, p);
      ctx.save(); ctx.globalCompositeOperation = p.dark ? "lighter" : "multiply"; for (const [x, y, r, c] of [[300, 200, 700, p.glow], [1700, 900, 800, p.glow2]]) { const gg = ctx.createRadialGradient(x + Math.sin(t * 0.1) * 80, y, 0, x, y, r); gg.addColorStop(0, c); gg.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H); } ctx.restore();
      const lx = W * 0.27;
      ctx.fillStyle = hexA(p.fg, 0.15); ctx.fillRect(W * 0.5, 180, 2, H - 360);
      text(ctx, s.top, lx, 330, { size: 46, color: p.fg, family: SERIF, weight: 700, spacing: 8 });
      text(ctx, "예배까지", lx, 430, { size: 34, color: p.accent, weight: 700 });
      dg.draw(ctx, fmt(left), lx, 560, { size: 190, weight: 800, color: p.fg }, t, left);
      text(ctx, s.sub, lx, 700, { size: 34, color: hexA(p.fg, 0.75) });
      const list = (s.order || []).slice(0, 7);
      text(ctx, "오늘의 예배", W * 0.56, 250, { size: 40, color: p.accent, weight: 800, align: "left" });
      const cyc = list.length ? Math.floor(t / 3) % list.length : -1;
      list.forEach((it, i) => {
        const k = ease((t - 0.4 * i) / 0.8), y = 340 + i * 88 + (1 - k) * 30;
        ctx.save(); ctx.globalAlpha = k * (i === cyc ? 1 : 0.78);
        if (i === cyc) { ctx.fillStyle = hexA(p.accent, p.dark ? 0.25 : 0.12); ctx.beginPath(); ctx.roundRect(W * 0.55, y - 38, W * 0.38, 76, 14); ctx.fill(); }
        text(ctx, it.icon || "•", W * 0.575, y, { size: 34, color: p.accent, weight: 800, align: "center" });
        text(ctx, it.title, W * 0.6, y - (it.sub ? 12 : 0), { size: 36, color: p.fg, weight: 700, align: "left" });
        if (it.sub) text(ctx, it.sub, W * 0.6, y + 24, { size: 24, color: hexA(p.fg, 0.65), align: "left" });
        ctx.restore();
      });
      grain(ctx, t, 0.03);
    };
  };

  // 13. 광고 함께 — 왼쪽에 ‘광고 그림’이 8초마다 천천히 확대되며 바뀌고(겹쳐 사라짐), 오른쪽에 숫자
  D.ads = function (o) {
    const dg = new Digits(o.big, o.still), st = {};
    return (ctx, t, left, s) => {
      const p = P(s, { bg: "#12161c", bg2: "#1b212b", fg: "#ffffff", accent: "#8b93a4", dark: true });
      bgFill(ctx, p);
      const urls = s.ads || [], n = urls.length, X = 90, Y = 110, Wd = 1130, Hd = 636, per = 8;
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 40; ctx.fillStyle = "#000"; ctx.beginPath(); ctx.roundRect(X, Y, Wd, Hd, 18); ctx.fill(); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.roundRect(X, Y, Wd, Hd, 18); ctx.clip();
      let prog = 0;
      if (n) {
        // 차례 넘기기: 그림은 8초, 영상은 끝날 때까지(소리 없이). 멈춘 미리보기에서는 첫 장만
        if (st.cur == null || st.cur >= n) { st.cur = 0; st.t0 = t; }
        let u = urls[st.cur];
        if (isVid(u) && !o.still) {
          const v = vid(u);
          if (st.vStarted !== st.cur) { st.vStarted = st.cur; try { v.currentTime = 0; } catch (e) {} v.play().catch(() => {}); }
          if (v.ended || (v.duration && t - st.t0 > v.duration + 1) || (v.error && t - st.t0 > 2)) { v.pause(); st.cur = (st.cur + 1) % n; st.t0 = t; u = urls[st.cur]; }
          else { if (v.readyState >= 2) cover(ctx, v, X, Y, Wd, Hd, 1, 0.5, 0.5); prog = v.duration ? v.currentTime / v.duration : 0; }
        }
        if (!isVid(u) || o.still) {
          const k = clamp((t - st.t0) / per, 0, 1), a = isVid(u) ? null : img(u);
          if (a) cover(ctx, a, X, Y, Wd, Hd, 1 + 0.08 * k, 0.5 + 0.1 * Math.sin(st.cur), 0.5);
          else if (isVid(u)) text(ctx, "▶ 영상", X + Wd / 2, Y + Hd / 2, { size: 40, color: "rgba(255,255,255,.7)" });
          prog = k;
          if (k >= 1 && !o.still && n > 1) { st.cur = (st.cur + 1) % n; st.t0 = t; }
        }
        if (n > 1 || isVid(urls[st.cur])) {
          ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.beginPath(); ctx.roundRect(X + 18, Y + 18, 230, 44, 10); ctx.fill();
          text(ctx, `광고 ${st.cur + 1} / ${n}${isVid(urls[st.cur]) ? " · 영상" : ""}`, X + 34, Y + 41, { size: 24, color: "#fff", weight: 700, align: "left" });
          ctx.fillStyle = "rgba(255,255,255,.2)"; ctx.fillRect(X, Y + Hd - 6, Wd, 6); ctx.fillStyle = "#e8c779"; ctx.fillRect(X, Y + Hd - 6, Wd * clamp(prog, 0, 1), 6);
        }
      } else text(ctx, "‘광고 그림 · 영상’ 묶음에 그림이나 영상을 넣으면 여기에 차례로 나옵니다", X + Wd / 2, Y + Hd / 2, { size: 30, color: "rgba(255,255,255,.6)" });
      ctx.restore();
      const rx = 1540;
      text(ctx, s.top, rx, 330, { size: 42, color: hexA(p.fg, 0.85), family: SERIF, weight: 700, spacing: 6 });
      text(ctx, "예배까지", rx, 430, { size: 32, color: p.accent, weight: 600 });
      dg.draw(ctx, fmt(left), rx, 540, { size: 150, weight: 800, color: p.fg }, t, left);
      text(ctx, s.sub, rx, 680, { size: 32, color: hexA(p.fg, 0.75), lh: 1.4 });
      grain(ctx, t, 0.03);
    };
  };

  // 14. 교회 사진 — 고른 사진이 천천히 확대 · 이동(켄 번즈), 빛 번짐이 흐르고, 가운데 반투명 판에 숫자
  D.photo = function (o) {
    const dg = new Digits(o.big, o.still);
    return (ctx, t, left, s) => {
      ctx.fillStyle = "#101418"; ctx.fillRect(0, 0, W, H);
      const im = img(s.photo);
      if (im) { const k = (t % 40) / 40, z = 1.06 + 0.1 * Math.sin(k * Math.PI); cover(ctx, im, 0, 0, W, H, z, 0.5 + 0.12 * Math.sin(t * 0.05), 0.5 + 0.08 * Math.cos(t * 0.04)); }
      else { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#5a6a5a"); g.addColorStop(1, "#1a2228"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); text(ctx, "보관함 ‘그림’에서 교회 사진을 고르세요", W / 2, 120, { size: 30, color: "rgba(255,255,255,.7)" }); }
      ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalCompositeOperation = "lighter"; const lx = ((t * 40) % (W + 1400)) - 700; const lg = ctx.createRadialGradient(lx, 200, 0, lx, 200, 700); lg.addColorStop(0, "rgba(255,210,150,.22)"); lg.addColorStop(1, "rgba(255,210,150,0)"); ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H); ctx.restore();
      const px = W / 2 - 520, py = 300, pw = 1040, ph = 480;
      ctx.save(); ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 30); ctx.fillStyle = "rgba(10,14,18,.55)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
      text(ctx, s.top, W / 2, py + 95, { size: 46, color: "rgba(255,255,255,.92)", family: SERIF, weight: 700, spacing: 10 });
      dg.draw(ctx, fmt(left), W / 2, py + 255, { size: 190, weight: 800, color: "#ffffff", glow: "rgba(0,0,0,.4)", glowSize: 20 }, t, left);
      text(ctx, s.sub, W / 2, py + 410, { size: 38, color: "rgba(255,255,255,.85)" });
      vignette(ctx, 0.5); grain(ctx, t, 0.04);
    };
  };

  // 4K 배경 영상(대기 화면 영상 묶음)을 쓸 때 — G.CDM_PART: "bg" 배경만(영상 만들 때) · "fg" 글 · 숫자만(앱에서 영상 위에)
  // fg 에서는 디자인이 그리는 배경(채우기 · 그림 · 선)을 모두 건너뛰고 text() · 숫자만 진짜 판에 그림
  const SKIP = new Set(["fillRect", "strokeRect", "fill", "stroke", "drawImage", "putImageData", "clearRect", "fillText", "strokeText"]);
  function fgCtx(ctx) {
    if (ctx.__fg) return ctx.__fg;
    const p = new Proxy(ctx, { get(o, k) { if (k === "__real") return o; if (SKIP.has(k)) return () => {}; const v = o[k]; return typeof v === "function" ? v.bind(o) : v; }, set(o, k, v) { o[k] = v; return true; } });
    return (ctx.__fg = p);
  }
  for (const k of Object.keys(D)) { const make = D[k]; D[k] = (o) => { const fn = make(o); return (ctx, t, left, s) => fn(G.CDM_PART === "fg" ? fgCtx(ctx) : ctx, t, left, s); }; }
  // 4K 영상이 있을 수 있는 디자인(움직임이 남은 시간과 상관없이 되풀이되는 것만)과 영상 파일 이름
  const LOOPS = { cross: "십자가빛", glass: "유리십자가", arches: "아치창", season: "계절", aurora: "오로라", water: "수채화" };
  G.CDM = { W, H, designs: D, LOOPS, fmt, digitMode: "slide", names: { cross: "십자가 빛", glass: "스테인드글라스 십자가", arches: "아치 창 회랑", sunrise: "새벽 해돋이", season: "계절", aurora: "오로라", water: "수채화 말씀", bignum: "큰 숫자", wave: "잔잔한 물결", clock: "시계 문자판", order: "오늘의 예배 순서", ads: "광고 함께", photo: "교회 사진" } };
})(window);
