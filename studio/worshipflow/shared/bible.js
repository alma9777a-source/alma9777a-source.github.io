// 성경 책 이름 · 줄임말 · 초성 · 장절 해석 · 역본 파일 읽기.
// 책 이름 목록은 남은 조각(app/ui/app.js BIBLE)과 같다.
(function (G) {
  const BOOKS = "창세기 출애굽기 레위기 민수기 신명기 여호수아 사사기 룻기 사무엘상 사무엘하 열왕기상 열왕기하 역대상 역대하 에스라 느헤미야 에스더 욥기 시편 잠언 전도서 아가 이사야 예레미야 예레미야애가 에스겔 다니엘 호세아 요엘 아모스 오바댜 요나 미가 나훔 하박국 스바냐 학개 스가랴 말라기 마태복음 마가복음 누가복음 요한복음 사도행전 로마서 고린도전서 고린도후서 갈라디아서 에베소서 빌립보서 골로새서 데살로니가전서 데살로니가후서 디모데전서 디모데후서 디도서 빌레몬서 히브리서 야고보서 베드로전서 베드로후서 요한일서 요한이서 요한삼서 유다서 요한계시록".split(" ");
  const SHORT = "창 출 레 민 신 수 삿 룻 삼상 삼하 왕상 왕하 대상 대하 스 느 에 욥 시 잠 전 아 사 렘 애 겔 단 호 욜 암 옵 욘 미 나 합 습 학 슥 말 마 막 눅 요 행 롬 고전 고후 갈 엡 빌 골 살전 살후 딤전 딤후 딛 몬 히 약 벧전 벧후 요일 요이 요삼 유 계".split(" ");
  const ENG = "Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev".split(" ");
  // 다른 이름(자주 쓰는 것)
  const ALIAS = { "시": 18, "시편": 18, "아가서": 21, "애가": 24, "예레미야 애가": 24, "요한계시록": 65, "계시록": 65, "마태": 39, "마가": 40, "누가": 41, "요한": 42, "행전": 43, "Psalm": 18, "Psalms": 18, "PSA": 18, "GEN": 0, "EXO": 1, "MAT": 39, "MRK": 40, "LUK": 41, "JHN": 42, "ACT": 43, "ROM": 44, "REV": 65 };
  // 책마다 장 수(장 전체 · 범위 확인에 씀)
  const CHAPTERS = [50,40,27,36,34,24,21,4,31,24,22,25,29,36,10,13,10,42,150,31,12,8,66,52,5,48,12,14,3,9,1,4,7,3,3,3,2,14,4,28,16,24,21,28,16,16,13,6,6,4,4,5,3,6,4,3,1,13,5,5,3,5,1,1,1,22];

  // 설교에서 자주 쓰는 순서(초성 찾기 때 먼저 고름). 나머지는 성경 순서.
  const OFTEN = "요한복음 시편 로마서 마태복음 누가복음 마가복음 사도행전 창세기 이사야 고린도전서 에베소서 빌립보서 히브리서 잠언 갈라디아서 요한일서 고린도후서 골로새서 출애굽기 신명기 야고보서 베드로전서 요한계시록 예레미야 다니엘 여호수아 사무엘상 데살로니가전서 디모데후서 전도서".split(" ");
  const rank = (b) => { const i = OFTEN.indexOf(BOOKS[b]); return i >= 0 ? i : 100 + b; };
  const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
  function chosung(s) {
    let r = "";
    for (const ch of s) {
      const c = ch.charCodeAt(0);
      if (c >= 0xac00 && c <= 0xd7a3) r += CHO[Math.floor((c - 0xac00) / 588)];
      else if (/[ㄱ-ㅎ]/.test(ch)) r += ch;
      else if (/[0-9A-Za-z]/.test(ch)) r += ch;
    }
    return r;
  }
  const isCho = (s) => /^[ㄱ-ㅎ]+$/.test(s);

  // 책 이름 → 번호(0~65). 못 찾으면 -1.
  function findBook(raw) {
    let s = String(raw || "").trim().replace(/\s+/g, "").replace(/\.$/, "");
    if (!s) return -1;
    // "1요" "1Jn" 같은 앞 숫자 형태
    s = s.replace(/^1(요|베|벧|고|살|딤|사|왕|대)/, (m, a) => ({ 요: "요일", 베: "벧전", 벧: "벧전", 고: "고전", 살: "살전", 딤: "딤전", 사: "삼상", 왕: "왕상", 대: "대상" }[a]))
         .replace(/^2(요|베|벧|고|살|딤|사|왕|대)/, (m, a) => ({ 요: "요이", 베: "벧후", 벧: "벧후", 고: "고후", 살: "살후", 딤: "딤후", 사: "삼하", 왕: "왕하", 대: "대하" }[a]))
         .replace(/^3요/, "요삼");
    let i = BOOKS.indexOf(s); if (i >= 0) return i;
    i = SHORT.indexOf(s); if (i >= 0) return i;
    if (ALIAS[s] != null) return ALIAS[s];
    const low = s.toLowerCase();
    i = ENG.findIndex((e) => e.toLowerCase() === low); if (i >= 0) return i;
    i = ENG.findIndex((e) => low.length >= 3 && e.toLowerCase().startsWith(low)); if (i >= 0) return i;
    if (isCho(s)) {
      // 초성은 여러 책에 겹친다(ㅇㅎ = 요한복음 · 왕하 · 요한일서…) → 설교에서 자주 쓰는 책부터
      const cands = [];
      for (let b = 0; b < 66; b++) if (chosung(BOOKS[b]).startsWith(s) || chosung(SHORT[b]) === s) cands.push(b);
      if (!cands.length) return -1;
      cands.sort((a, b) => rank(a) - rank(b));
      return cands[0];
    }
    // 이름 앞부분("요한복" "고린도전")
    i = BOOKS.findIndex((x) => s.length >= 2 && x.startsWith(s)); if (i >= 0) return i;
    return -1;
  }

  // "요 13:1-5" "요한 13 1" "요13:1~5" "ㅇㅎ 13:1" "시 23" "롬 5:8, 6:23" "요 13:34-14:1"
  // → [{book, c1, v1, c2, v2}] (v1/v2 가 0 이면 장 전체)
  function parseRef(input) {
    const out = [];
    let s = String(input || "").trim().replace(/[～~–—]/g, "-").replace(/장\s*/g, ":").replace(/절/g, "").replace(/：/g, ":");
    if (!s) return out;
    let lastBook = -1, lastCh = 0;
    for (let part of s.split(/[;,，]/)) {
      part = part.trim(); if (!part) continue;
      const m = part.match(/^([1-3]?\s*[^\d\s:]+)?\s*(\d+)?(?:\s*[:\s.]\s*(\d+))?(?:\s*-\s*(\d+)(?:\s*:\s*(\d+))?)?\s*$/);
      if (!m) return [];
      let book = lastBook;
      if (m[1]) { book = findBook(m[1]); if (book < 0) return []; }
      if (book < 0) return [];
      let c1, v1, c2, v2;
      if (!m[1] && m[2] && !m[3] && lastCh) { // ", 7" → 같은 장 7절
        c1 = lastCh; v1 = +m[2]; c2 = c1; v2 = v1;
        if (m[4]) v2 = +m[4];
      } else {
        c1 = +(m[2] || 1); v1 = +(m[3] || 0);
        if (m[4] && m[5]) { c2 = +m[4]; v2 = +m[5]; }
        else if (m[4]) { if (v1) { c2 = c1; v2 = +m[4]; } else { c2 = +m[4]; v2 = 0; } }
        else { c2 = c1; v2 = v1; }
      }
      if (c1 < 1 || c1 > CHAPTERS[book] || c2 < c1) return [];
      out.push({ book, c1, v1, c2, v2 });
      lastBook = book; lastCh = c2;
    }
    return out;
  }

  // 화면에 보이는 장절 표시
  function refLabel(r, short) {
    const b = short ? SHORT[r.book] + " " : BOOKS[r.book] + " ";
    if (!r.v1) return b + (r.c1 === r.c2 ? r.c1 + (short ? "" : "장") : r.c1 + "-" + r.c2 + (short ? "" : "장"));
    if (r.c1 === r.c2) return b + r.c1 + ":" + r.v1 + (r.v2 !== r.v1 ? "-" + r.v2 : "");
    return b + r.c1 + ":" + r.v1 + "-" + r.c2 + ":" + r.v2;
  }
  function refsLabel(refs, short) {
    return refs.map((r) => refLabel(r, short)).join("; ");
  }

  // 역본 자료 모양: { books: { "42": { "13": { "1": "본문", ... } } } } (책 번호는 0부터)
  function getVerses(bible, refs) {
    const res = [];
    if (!bible || !bible.books) return res;
    for (const r of refs) {
      const bk = bible.books[r.book]; if (!bk) continue;
      for (let c = r.c1; c <= r.c2; c++) {
        const ch = bk[c]; if (!ch) continue;
        const nums = Object.keys(ch).map(Number).sort((a, b) => a - b);
        for (const v of nums) {
          if (r.v1 && c === r.c1 && v < r.v1) continue;
          if (r.v2 && c === r.c2 && v > r.v2) continue;
          let t = ch[v];
          if (typeof t === "string" && t[0] === "=") { // 묶은 절의 뒷 번호
            const to = +t.slice(1);
            if (res.some((x) => x.book === r.book && x.c === c && x.v === to)) continue;
            res.push({ book: r.book, c, v: to, v2: v, text: ch[to] });
            continue;
          }
          res.push({ book: r.book, c, v, text: t });
        }
      }
    }
    return res;
  }

  // 낱말 찾기(최대 limit 개)
  function searchWords(bible, q, limit) {
    const res = [];
    if (!bible || !bible.books || !q || q.length < 2) return res;
    for (let b = 0; b < 66; b++) {
      const bk = bible.books[b]; if (!bk) continue;
      for (const c of Object.keys(bk).map(Number).sort((a, b2) => a - b2)) {
        for (const v of Object.keys(bk[c]).map(Number).sort((a, b2) => a - b2)) {
          if (bk[c][v][0] !== "=" && bk[c][v].includes(q)) { res.push({ book: b, c, v, text: bk[c][v] }); if (res.length >= (limit || 50)) return res; }
        }
      }
    }
    return res;
  }

  // 역본 파일 읽기 — 지원하는 모양:
  //  1) JSON {name, books:{책번호:{장:{절:본문}}}}  또는 [{book,chapter,verse,text}]
  //  2) CSV/TSV: 책,장,절,본문 (책은 이름·줄임말·번호)
  //  3) 한 줄 한 절: "창1:1 태초에…"  "창세기 1:1 태초에…"  "요 13:1 유월절…"
  //  4) USFM(\id \c \v)
  function parseBibleFile(text, fileName) {
    const books = {};
    let count = 0;
    const put = (b, c, v, t) => {
      if (b < 0 || !c || !v || !t) return;
      t = String(t).replace(/<[^>]+>\s*/g, "").replace(/\s+/g, " ").trim();
      if (!t) return;
      ((books[b] = books[b] || {})[c] = books[b][c] || {})[v] = t;
      count++;
    };
    text = String(text).replace(/^﻿/, "");
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      const j = JSON.parse(trimmed);
      if (Array.isArray(j)) {
        for (const r of j) put(typeof r.book === "number" ? r.book : findBook(r.book), +r.chapter, +r.verse, r.text);
      } else if (j.books) {
        for (const k of Object.keys(j.books)) {
          const b = /^\d+$/.test(k) ? +k : findBook(k);
          const chs = j.books[k];
          for (const c of Object.keys(chs)) for (const v of Object.keys(chs[c])) put(b, +c, +v, chs[c][v]);
        }
      }
      return { books, count, name: (j && j.name) || "" };
    }
    if (/^\\id\s/m.test(text)) {
      let b = -1, c = 0;
      for (const line of text.split(/\r?\n/)) {
        let m;
        if ((m = line.match(/^\\id\s+(\S+)/))) { b = findBook(m[1]); c = 0; }
        else if ((m = line.match(/^\\c\s+(\d+)/))) c = +m[1];
        else if ((m = line.match(/^\\v\s+(\d+)\s+(.*)/))) put(b, c, +m[1], m[2].replace(/\\\w+\*?/g, ""));
      }
      return { books, count, name: "" };
    }
    let last = null;
    // 앞 책 마지막 절 끝에 다음 책 1:1 이 줄바꿈 없이 붙은 파일이 있다(“…찬송하니라요1:1 …”) → 나눈다
    const names = SHORT.concat(BOOKS).slice().sort((a, b) => b.length - a.length).join("|");
    text = text.replace(new RegExp("([^\\s\\n])(" + names + ")(1:1\\s)", "g"), "$1\n$2$3");
    for (const line of text.split(/\r?\n/)) {
      const L = line.trim(); if (!L) continue;
      let m;
      if ((m = L.match(/^([^,\t]+)[,\t]\s*(\d+)[,\t]\s*(\d+)[,\t]\s*(.+)$/))) {
        const b = /^\d+$/.test(m[1].trim()) ? +m[1].trim() - 1 : findBook(m[1].replace(/"/g, ""));
        put(b, +m[2], +m[3], m[4].replace(/^"|"$/g, ""));
      } else if ((m = L.match(/^([1-3]?[^\d\s:]+)\s*(\d+):(\d+)(?:-(\d+))?\s+(.+)$/))) {
        // ‘신6:18-19’처럼 두 절을 묶은 줄은 앞 절에 두고, 뒷 절은 앞 절을 가리키게(“=18”)
        const b = findBook(m[1]);
        put(b, +m[2], +m[3], m[5]);
        if (m[4] && books[b] && books[b][+m[2]]) for (let v = +m[3] + 1; v <= +m[4]; v++) books[b][+m[2]][v] = "=" + m[3];
        last = { b, c: +m[2], v: +m[3] };
      } else if ((m = L.match(/^([1-3]?[^\d\s:]+)\s*(\d+):(\D.*)$/))) {
        // 절 번호가 빠진 줄: 시편 권 제목(제이권 등)은 버리고, 같은 장 앞 절의 뒷부분이면 이어 붙이고, 장 첫 줄이면 1절
        const b = findBook(m[1]), c = +m[2], rest = m[3].trim();
        if (/^제[일이삼사오]권$/.test(rest)) continue;
        if (last && last.b === b && last.c === c && books[b] && books[b][c] && books[b][c][last.v]) {
          books[b][c][last.v] += " " + rest.replace(/<[^>]+>\s*/g, "").replace(/\s+/g, " ").trim();
        } else { put(b, c, 1, rest); last = { b, c, v: 1 }; }
      }
    }
    return { books, count, name: "" };
  }

  // 같은 줄로 붙일 때 장절 표시 "13:1"
  const verseTag = (v) => v.c + ":" + v.v;

  // ── 들은 말에서 장절 찾기 ── “요한복음 3장 16절”, “요한 1서 4장 10절”, “로마서 5장 8절에서 10절”, “시편 23편”, “요 3:16”
  const SPOKEN = (() => {
    const list = [];
    BOOKS.forEach((b, i) => list.push([b.split("").join("\\s*"), i]));
    const pair = (stem, a, b, ia, ib) => { list.push([stem + "\\s*" + a, ia]); list.push([stem + "\\s*" + b, ib]); };
    pair("요한\\s*", "(?:일|1)\\s*서", "(?:이|2)\\s*서", 61, 62); list.push(["요한\\s*(?:삼|3)\\s*서", 63]);
    pair("고린도\\s*", "전\\s*서", "후\\s*서", 45, 46); pair("데살로니가\\s*", "전\\s*서", "후\\s*서", 51, 52);
    pair("디모데\\s*", "전\\s*서", "후\\s*서", 53, 54); pair("베드로\\s*", "전\\s*서", "후\\s*서", 59, 60);
    pair("사무엘\\s*", "상", "하", 8, 9); pair("열왕기\\s*", "상", "하", 10, 11); pair("역대\\s*", "상", "하", 12, 13);
    list.sort((a, b) => b[0].length - a[0].length);
    return list;
  })();
  function findSpokenRefs(text) {
    const out = [];
    const t = String(text || "");
    for (const [pat, book] of SPOKEN) {
      const re = new RegExp("(" + pat + ")\\s*(\\d{1,3})\\s*(?:장|편|:)\\s*(?:(\\d{1,3})\\s*절?)?(?:\\s*(?:에서|부터|~|-|에서부터)\\s*(\\d{1,3})\\s*절)?", "g");
      let m;
      while ((m = re.exec(t))) {
        const c = +m[2], v1 = m[3] ? +m[3] : 0, v2 = m[4] ? +m[4] : v1;
        if (c < 1 || c > CHAPTERS[book]) continue;
        if (out.some((o) => o.at < m.index + m[0].length && m.index < o.end)) continue; // 더 긴 이름이 이미 잡은 자리
        const ref = SHORT[book] + " " + c + (v1 ? ":" + v1 + (v2 && v2 !== v1 ? "-" + v2 : "") : "");
        out.push({ ref, label: BOOKS[book] + " " + c + (v1 ? ":" + v1 + (v2 && v2 !== v1 ? "-" + v2 : "") : (book === 18 ? "편" : "장")), at: m.index, end: m.index + m[0].length, said: m[0] });
      }
    }
    return out.sort((a, b) => a.at - b.at);
  }

  G.Bible = { BOOKS, SHORT, ENG, CHAPTERS, chosung, findBook, parseRef, refLabel, refsLabel, getVerses, searchWords, parseBibleFile, verseTag, findSpokenRefs };
})(window);
