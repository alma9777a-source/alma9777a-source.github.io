// 파워포인트(.pptx)를 모양 그대로 가져오기 — 글상자 · 도형 · 표 · 그림 · 배경을 위치 · 색 · 글자 크기 그대로
// WorshipFlow 화면(‘디자인 화면’, 1920×1080)으로 바꾼다. 파워포인트가 없는 맥에서도 된다.
// 애니메이션 · 전환 효과 · 차트 · 스마트아트는 가져오지 않는다(차트는 빈 자리).
const PX = { W: 1920, H: 1080 };
const NS = { a: "http://schemas.openxmlformats.org/drawingml/2006/main", p: "http://schemas.openxmlformats.org/presentationml/2006/main", r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships" };

const kids = (el, tag) => (el ? Array.from(el.children).filter((c) => !tag || c.localName === tag) : []);
const kid = (el, tag) => kids(el, tag)[0] || null;
const path = (el, ...tags) => { let e = el; for (const t of tags) { e = kid(e, t); if (!e) return null; } return e; };
const attr = (el, n, d) => (el && el.hasAttribute(n) ? el.getAttribute(n) : d);
const xml = (s) => new DOMParser().parseFromString(s, "application/xml");

// "../media/image1.png" (slides/ 기준) → "ppt/media/image1.png"
function resolveTarget(base, target) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/"); parts.pop();
  for (const seg of target.split("/")) { if (seg === "..") parts.pop(); else if (seg !== ".") parts.push(seg); }
  return parts.join("/");
}
async function readRels(zip, partPath) {
  const p = partPath.replace(/([^/]+)$/, "_rels/$1.rels");
  const t = await zip.text(p);
  const out = {};
  if (!t) return out;
  for (const r of Array.from(xml(t).getElementsByTagName("Relationship"))) out[r.getAttribute("Id")] = { target: resolveTarget(partPath, r.getAttribute("Target")), type: r.getAttribute("Type") || "", external: r.getAttribute("TargetMode") === "External" };
  return out;
}

// ── 색 ──
function hex2rgb(h) { const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgb2hsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; }
function hsl2rgb([h, s, l]) { if (!s) return [l * 255, l * 255, l * 255]; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; const f = (t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]; }
function colorOf(el, theme) {
  if (!el) return null;
  const c = kids(el).find((k) => ["srgbClr", "schemeClr", "sysClr", "prstClr", "scrgbClr"].includes(k.localName));
  if (!c) return null;
  let rgb;
  if (c.localName === "srgbClr") rgb = hex2rgb(c.getAttribute("val"));
  else if (c.localName === "sysClr") rgb = hex2rgb(c.getAttribute("lastClr") || (c.getAttribute("val") === "window" ? "FFFFFF" : "000000"));
  else if (c.localName === "schemeClr") { const v = c.getAttribute("val"); const m = { tx1: "dk1", bg1: "lt1", tx2: "dk2", bg2: "lt2" }[v] || v; rgb = hex2rgb(theme[m] || "000000"); }
  else if (c.localName === "prstClr") rgb = hex2rgb({ black: "000000", white: "FFFFFF", red: "FF0000", blue: "0000FF", green: "008000", yellow: "FFFF00" }[c.getAttribute("val")] || "000000");
  else rgb = [0, 0, 0];
  let alpha = 1;
  for (const m of kids(c)) {
    const v = +m.getAttribute("val") / 100000;
    if (m.localName === "alpha") alpha = v;
    else if (m.localName === "lumMod" || m.localName === "lumOff") { const hsl = rgb2hsl(rgb); hsl[2] = m.localName === "lumMod" ? hsl[2] * v : Math.min(1, hsl[2] + v); rgb = hsl2rgb(hsl); }
    else if (m.localName === "shade") rgb = rgb.map((x) => x * v);
    else if (m.localName === "tint") rgb = rgb.map((x) => x + (255 - x) * (1 - v));
  }
  return `rgba(${rgb.map((x) => Math.round(x)).join(",")},${+alpha.toFixed(3)})`;
}
function fillOf(spPr, theme, styleEl) {
  if (spPr) {
    if (kid(spPr, "noFill")) return "none";
    const s = kid(spPr, "solidFill"); if (s) return colorOf(s, theme);
    const g = kid(spPr, "gradFill"); if (g) { const stops = kids(kid(g, "gsLst"), "gs").map((x) => [colorOf(x, theme), +x.getAttribute("pos") / 1000]); if (stops.length) return `linear-gradient(180deg,${stops.map(([c, p]) => `${c} ${p}%`).join(",")})`; }
  }
  if (styleEl) { const fr = kid(styleEl, "fillRef"); if (fr && +fr.getAttribute("idx") > 0) return colorOf(fr, theme); }
  return null;
}

// ── 글꼴 이름 → 맥 글꼴 ──
function fontStack(name) {
  const n = String(name || "");
  if (/명조|바탕|Batang|Myeong|궁서|Serif|Times|Georgia/i.test(n)) return "'AppleMyungjo','Gowun Batang',serif";
  return "'Apple SD Gothic Neo','Noto Sans KR',sans-serif";
}

// ── 파워포인트 하나 열기 ──
async function openPptx(zip) {
  const pres = xml(await zip.text("ppt/presentation.xml"));
  const sz = pres.getElementsByTagNameNS(NS.p, "sldSz")[0];
  const cx = +attr(sz, "cx", 12192000), cy = +attr(sz, "cy", 6858000);
  const k = Math.min(PX.W / cx, PX.H / cy), ox = (PX.W - cx * k) / 2, oy = (PX.H - cy * k) / 2;
  const presRels = await readRels(zip, "ppt/presentation.xml");
  const ids = Array.from(pres.getElementsByTagNameNS(NS.p, "sldId")).map((e) => e.getAttributeNS(NS.r, "id"));
  const slidePaths = ids.map((id) => presRels[id] && presRels[id].target).filter(Boolean);
  // 테마 색
  const themeRel = Object.values(presRels).find((r) => /theme/.test(r.type));
  const theme = {};
  if (themeRel) {
    const t = xml(await zip.text(themeRel.target));
    const cs = t.getElementsByTagNameNS(NS.a, "clrScheme")[0];
    for (const c of kids(cs)) { const v = kid(c, "srgbClr") || kid(c, "sysClr"); if (v) theme[c.localName] = v.getAttribute("val") === "windowText" ? "000000" : v.getAttribute("lastClr") || v.getAttribute("val"); }
  }
  return { zip, cx, cy, k, ox, oy, slidePaths, theme };
}

// 한 장 → 디자인 화면 { kind:'design', bg, els, text }
async function pptxSlide(P, slidePath, saveImage) {
  const { zip, k, ox, oy, theme } = P;
  const E = (v) => +v * k; // EMU → px
  const parts = [];
  const sdoc = xml(await zip.text(slidePath)); const srels = await readRels(zip, slidePath);
  const layoutRel = Object.values(srels).find((r) => /slideLayout/.test(r.type));
  let ldoc = null, lrels = {}, mdoc = null, mrels = {}, mpath = "";
  if (layoutRel) {
    ldoc = xml(await zip.text(layoutRel.target)); lrels = await readRels(zip, layoutRel.target);
    const mr = Object.values(lrels).find((r) => /slideMaster/.test(r.type));
    if (mr) { mpath = mr.target; mdoc = xml(await zip.text(mpath)); mrels = await readRels(zip, mpath); }
  }
  const root = (d) => (d ? d.documentElement : null);
  const cSld = (d) => path(root(d), "cSld");
  // 자리표시자(제목 · 본문) 찾기: 같은 type/idx 의 layout → master 모양
  const phOf = (sp) => { const ph = sp && sp.getElementsByTagNameNS(NS.p, "ph")[0]; return ph ? { type: attr(ph, "type", "body"), idx: attr(ph, "idx", "") } : null; };
  const findPh = (d, ph) => { if (!d || !ph) return null; const all = Array.from(d.getElementsByTagNameNS(NS.p, "sp")); return all.find((s) => { const q = phOf(s); return q && q.idx && q.idx === ph.idx; }) || all.find((s) => { const q = phOf(s); return q && (q.type === ph.type || (ph.type === "body" && q.type === "obj")); }) || null; };
  const xfrmOf = (sp) => { const x = path(sp, "spPr", "xfrm") || path(sp, "xfrm"); return x; };

  // 배경
  const bgOf = (d, rels) => {
    const bg = path(cSld(d), "bg"); if (!bg) return null;
    const pr = kid(bg, "bgPr");
    if (pr) { const b = kid(pr, "blipFill"); if (b) { const id = path(b, "blip").getAttributeNS(NS.r, "embed"); return { img: rels[id] && rels[id].target }; } const f = fillOf(pr, theme); if (f) return { color: f }; }
    const ref = kid(bg, "bgRef"); if (ref) return { color: colorOf(ref, theme) };
    return null;
  };
  const bgx = bgOf(sdoc, srels) || bgOf(ldoc, lrels) || bgOf(mdoc, mrels) || { color: "#" + (theme.lt1 || "FFFFFF") };
  const slide = { kind: "design", bg: bgx.color || "#ffffff", els: [], text: "" };
  if (bgx.img) slide.bgFile = await saveImage(bgx.img);

  // 글 상자 → 문단
  const masterTx = (type) => { if (!mdoc) return null; const ts = root(mdoc).getElementsByTagNameNS(NS.p, "txStyles")[0]; if (!ts) return null; return kid(ts, type === "title" || type === "ctrTitle" ? "titleStyle" : ["body", "obj", "subTitle"].includes(type) ? "bodyStyle" : "otherStyle"); };
  const lvlDef = (lst, lvl) => { const l = lst && kid(lst, `lvl${lvl + 1}pPr`); return l ? kid(l, "defRPr") : null; };
  function textOf(txBody, ph, inherited) {
    if (!txBody) return null;
    const bp = kid(txBody, "bodyPr");
    const fit = bp && kid(bp, "normAutofit"); const fscale = fit ? +attr(fit, "fontScale", 100000) / 100000 : 1;
    const lstLocal = kid(txBody, "lstStyle");
    const paras = [];
    let any = false;
    for (const p of kids(txBody, "p")) {
      const pPr = kid(p, "pPr"); const lvl = +attr(pPr, "lvl", 0);
      const defs = [pPr && kid(pPr, "defRPr"), lvlDef(lstLocal, lvl), ...inherited.map((l) => lvlDef(l, lvl)), lvlDef(ph ? masterTx(ph.type) : masterTx("other"), lvl)].filter(Boolean);
      const pick = (n) => { for (const d of defs) if (d.hasAttribute(n)) return d.getAttribute(n); return null; };
      const pickClr = () => { for (const d of defs) { const f = kid(d, "solidFill"); if (f) return colorOf(f, theme); } return null; };
      const pickFont = () => { for (const d of defs) { const f = kid(d, "ea") || kid(d, "latin"); if (f) return f.getAttribute("typeface"); } return null; };
      const algn = attr(pPr, "algn", null) || (() => { for (const l of [lstLocal, ...inherited, ph ? masterTx(ph.type) : null]) { const x = l && kid(l, `lvl${lvl + 1}pPr`); if (x && x.hasAttribute("algn")) return x.getAttribute("algn"); } return "l"; })();
      const ln = pPr && path(pPr, "lnSpc", "spcPct");
      const runs = [];
      for (const r of kids(p)) {
        if (r.localName === "br") { runs.push({ tx: "\n" }); continue; }
        if (r.localName !== "r" && r.localName !== "fld") continue;
        const t = kid(r, "t"); const tx = t ? t.textContent : ""; if (!tx) continue;
        any = true;
        const rp = kid(r, "rPr");
        const szv = +(attr(rp, "sz", null) || pick("sz") || 1800);
        const f = rp && (kid(rp, "solidFill")); const font = rp && (kid(rp, "ea") || kid(rp, "latin"));
        const spc = +(attr(rp, "spc", null) || pick("spc") || 0); // 글자 사이(1/100 pt)
        runs.push({ tx, sp: spc ? Math.round((spc / 100) * 12700 * k * 10) / 10 : 0, sz: Math.round((szv / 100) * 12700 * k * fscale * 10) / 10, color: (f && colorOf(f, theme)) || pickClr() || "#" + (theme.dk1 || "000000"), b: (attr(rp, "b", null) || pick("b")) === "1", i: (attr(rp, "i", null) || pick("i")) === "1", font: fontStack((font && font.getAttribute("typeface")) || pickFont()) });
      }
      const bu = pPr && kid(pPr, "buChar");
      paras.push({ algn: { ctr: "center", r: "right", just: "justify" }[algn] || "left", lh: ln ? +ln.getAttribute("val") / 100000 : 1.15, bullet: bu && runs.length ? bu.getAttribute("char") : "", indent: lvl, runs });
    }
    if (!any) return null; // 비어 있는 자리표시자는 그리지 않음
    const anchor = attr(bp, "anchor", null) || "t";
    const ins = ["lIns", "tIns", "rIns", "bIns"].map((n, i) => E(attr(bp, n, i % 2 ? 45720 : 91440)));
    return { anchor: { t: "flex-start", ctr: "center", b: "flex-end" }[anchor] || "flex-start", ins, paras, vert: attr(bp, "vert", "horz") !== "horz", nowrap: attr(bp, "wrap", "square") === "none" };
  }

  // 모양 하나 → els (그룹은 좌표를 바꿔 안으로)
  async function walk(tree, rels, map, fromSlide) {
    for (const el of kids(tree)) {
      const tag = el.localName;
      if (tag === "grpSp") {
        const x = path(el, "grpSpPr", "xfrm"); if (!x) continue;
        const off = kid(x, "off"), ext = kid(x, "ext"), cho = kid(x, "chOff"), che = kid(x, "chExt");
        const sx = +attr(ext, "cx", 1) / Math.max(1, +attr(che, "cx", 1)), sy = +attr(ext, "cy", 1) / Math.max(1, +attr(che, "cy", 1));
        const m2 = (X, Y, W, H) => map(+attr(off, "x", 0) + (X - +attr(cho, "x", 0)) * sx, +attr(off, "y", 0) + (Y - +attr(cho, "y", 0)) * sy, W * sx, H * sy);
        await walk(el, rels, m2, fromSlide);
        continue;
      }
      const ph = phOf(el);
      if (!fromSlide && ph) continue; // layout · master 의 자리표시자는 그리지 않음(슬라이드가 채움)
      let xf = tag === "graphicFrame" ? kid(el, "xfrm") : xfrmOf(el);
      const lph = ph ? findPh(ldoc, ph) : null, mph = ph ? findPh(mdoc, ph) : null;
      if (!xf && ph) xf = xfrmOf(lph) || xfrmOf(mph);
      if (!xf) continue;
      const off = kid(xf, "off"), ext = kid(xf, "ext");
      const [X, Y, W, H] = map(+attr(off, "x", 0), +attr(off, "y", 0), +attr(ext, "cx", 0), +attr(ext, "cy", 0));
      const box = { x: ox + E(X), y: oy + E(Y), w: E(W), h: E(H), rot: +attr(xf, "rot", 0) / 60000, flipH: attr(xf, "flipH", "0") === "1" };
      if (tag === "sp" || tag === "cxnSp") {
        const spPr = kid(el, "spPr"), style = kid(el, "style");
        const geom = attr(path(spPr, "prstGeom"), "prst", "rect");
        const ln = kid(spPr, "ln");
        let line = null;
        if (ln && !kid(ln, "noFill")) { const c = colorOf(kid(ln, "solidFill"), theme); if (c) line = { w: Math.max(1, E(attr(ln, "w", 12700))), color: c }; }
        else if (!ln && style && tag === "cxnSp") { const lr = kid(style, "lnRef"); if (lr) line = { w: 2, color: colorOf(lr, theme) }; }
        else if (!ln && style) { const lr = kid(style, "lnRef"); if (lr && +lr.getAttribute("idx") > 0) line = { w: Math.max(1, E(12700)), color: colorOf(lr, theme) }; }
        let fill = tag === "cxnSp" ? "none" : fillOf(spPr, theme, style);
        let fillFile = "";
        const bf = spPr && kid(spPr, "blipFill"); if (bf) { const id = path(bf, "blip").getAttributeNS(NS.r, "embed"); if (rels[id]) fillFile = await saveImage(rels[id].target); }
        const inh = [lph && path(lph, "txBody", "lstStyle"), mph && path(mph, "txBody", "lstStyle")].filter(Boolean);
        const text = fromSlide || !ph ? textOf(kid(el, "txBody"), ph, inh) : null;
        if (!text && (!fill || fill === "none") && !line && !fillFile) continue;
        slide.els.push(Object.assign(box, { t: tag === "cxnSp" ? "line" : "shape", geom, fill: fill || "none", fillFile, line, text }));
      } else if (tag === "pic") {
        const id = path(el, "blipFill", "blip") && path(el, "blipFill", "blip").getAttributeNS(NS.r, "embed");
        // 슬라이드 안 영상(a:videoFile 또는 p14:media)
        // a:videoFile(연결) 과 p14:media(들어 있는 것) 중 파일이 실제로 들어 있는 쪽, 그리고 잘라 쓴 구간(p14:trim)
        const vf = el.getElementsByTagNameNS(NS.a, "videoFile")[0];
        const pm = Array.from(el.getElementsByTagName("*")).find((n) => n.localName === "media" && n.namespaceURI !== NS.a);
        const trim = pm && Array.from(pm.children).find((n) => n.localName === "trim");
        const cands = [pm && pm.getAttributeNS(NS.r, "embed"), vf && vf.getAttributeNS(NS.r, "link")].filter(Boolean);
        const vid = cands.find((c) => rels[c] && !rels[c].external);
        if (vid) {
          const f = await saveImage(rels[vid].target);
          if (f) { slide.els.push(Object.assign(box, { t: "video", file: f, poster: id && rels[id] ? await saveImage(rels[id].target) : "", start: trim ? +attr(trim, "st", 0) / 1000 : 0, end: trim && trim.hasAttribute("end") ? +trim.getAttribute("end") / 1000 : 0 })); continue; }
        }
        if (id && rels[id] && !rels[id].external) slide.els.push(Object.assign(box, { t: "pic", file: await saveImage(rels[id].target) }));
      } else if (tag === "graphicFrame") {
        const tbl = el.getElementsByTagNameNS(NS.a, "tbl")[0];
        if (!tbl) { slide.els.push(Object.assign(box, { t: "shape", geom: "rect", fill: "rgba(128,128,128,.15)", text: null, note: "차트 · 스마트아트(가져오지 않음)" })); continue; }
        const cols = kids(kid(tbl, "tblGrid"), "gridCol").map((g) => E(attr(g, "w", 0)));
        const rows = kids(tbl, "tr").map((tr) => ({ h: E(attr(tr, "h", 0)), cells: kids(tr, "tc").map((tc) => ({ span: +attr(tc, "gridSpan", 1), merged: attr(tc, "hMerge", "0") === "1" || attr(tc, "vMerge", "0") === "1", fill: fillOf(kid(tc, "tcPr"), theme), text: textOf(kid(tc, "txBody"), null, []) })) }));
        slide.els.push(Object.assign(box, { t: "table", cols, rows }));
      }
    }
  }
  const id = (X, Y, W, H) => [X, Y, W, H];
  const showMaster = (d) => attr(root(d), "showMasterSp", "1") !== "0";
  if (mdoc && showMaster(sdoc) && showMaster(ldoc)) await walk(path(cSld(mdoc), "spTree"), mrels, id, false);
  if (ldoc && showMaster(sdoc)) await walk(path(cSld(ldoc), "spTree"), lrels, id, false);
  await walk(path(cSld(sdoc), "spTree"), srels, id, true);
  slide.text = slide.els.flatMap((e) => (e.text ? [e.text.paras.map((p) => p.runs.map((r) => r.tx).join("")).join("\n")] : e.rows ? e.rows.map((r) => r.cells.map((c) => (c.text ? c.text.paras.map((p) => p.runs.map((x) => x.tx).join("")).join(" ") : "")).join(" · ")) : [])).filter((s) => s.trim()).join("\n");
  return slide;
}

// 파일 → 디자인 화면들. 그림 · 영상은 앱 보관 폴더(media/)에 넣는다.
async function importPptxDesign(filePath) {
  const P = await openPptx(await Zip.openZipPath(filePath));
  const saved = {};
  const saveImage = async (zipPath) => {
    if (saved[zipPath] !== undefined) return saved[zipPath];
    if (!/\.(png|jpe?g|gif|bmp|webp|tiff?|mp4|mov|m4v|wmv|avi|mpe?g)$/i.test(zipPath)) return (saved[zipPath] = ""); // emf/wmf 는 그릴 수 없음
    const r = await P.zip.saveMedia(zipPath);
    return (saved[zipPath] = r ? r.file : "");
  };
  const slides = [];
  for (const sp of P.slidePaths) {
    try { slides.push(await pptxSlide(P, sp, saveImage)); }
    catch (e) { console.warn(e); slides.push({ kind: "design", bg: "#000", els: [], text: "(이 장은 가져오지 못했습니다)" }); }
  }
  return slides;
}

// ── 디자인 화면 글 고치기: 글상자마다 ‘────’ 로 나눠 보여 주고, 고친 글을 같은 자리에 되돌린다(글자 모양은 그 문단 첫 글자 모양) ──
function designTexts(slide) {
  return (slide.els || []).filter((e) => e.text).map((e) => e.text.paras.map((p) => p.runs.map((r) => r.tx).join("")).join("\n"));
}
function applyDesignTexts(slide, value) {
  const blocks = value.split(/\n?────+\n?/);
  const boxes = (slide.els || []).filter((e) => e.text);
  boxes.forEach((e, i) => {
    if (blocks[i] == null) return;
    const lines = blocks[i].split("\n");
    const old = e.text.paras;
    e.text.paras = lines.map((ln, j) => {
      const base = old[Math.min(j, old.length - 1)] || { algn: "left", lh: 1.15, runs: [] };
      const st = base.runs.find((r) => r.tx !== "\n") || old.flatMap((p) => p.runs).find((r) => r.tx !== "\n") || { sz: 40, color: "#000", font: fontStack("") };
      return Object.assign({}, base, { runs: ln ? [Object.assign({}, st, { tx: ln })] : [] });
    });
  });
  slide.text = designTexts(slide).join("\n");
}
