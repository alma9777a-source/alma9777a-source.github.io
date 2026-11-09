// WorshipFlow 홈페이지 체험판(2026-11-09) — 모든 앱 글 뒤, 시작(DOMContentLoaded) 전에 돈다.
// 처음 켤 때 만드는 예배를 ‘은혜샘교회 주일 예배(체험용)’로 바꾸고, 맥 앱에서만 되는 일은 안내로 바꾼다.
(function (G) {
  const it = (kind, title, minutes, data) => Object.assign({ id: uid("i"), kind, title, minutes, slides: [] }, data || {});
  G.newService = function (title, date) {
    const st = WF.lib.settings;
    Object.assign(st, { churchName: "은혜샘교회", standbyText: "은혜샘교회", standbySub: "주일 예배", emergencyText: "잠시 기다려 주십시오" });
    const svc = {
      schemaVersion: 1, id: uid("s"), title: title || "주일 예배 (체험용)", date: date || nextSunday(),
      createdAt: Date.now(), updatedAt: Date.now(),
      items: [
        it("standby", "예배 전 카운트다운", 5, { standby: { text: "예배가 곧 시작됩니다", sub: "은혜샘교회 주일 예배", design: "morder", cdMode: "dur", cdMins: 5, big10: true, atZero: "next" } }),
        it("song", "경배와 찬양", 8, { song: { songId: "song-sample" } }),
        it("fixed", "신앙고백", 2, { fixed: { fixedId: "fx-creed" } }),
        it("song", "찬송", 4, { song: { songId: "song-amazing" } }),
        it("prayer", "대표기도", 4, { prayer: { name: "김은혜 장로", role: "대표기도" } }),
        it("scripture", "성경봉독", 3, { scripture: { ref: "시 23:1-6", bibleId: "", split: "fit" } }),
        it("sermon", "설교", 30, { sermon: { title: "내 잔이 넘치나이다", ref: "시 23:1-6", preacher: "담임목사", points: ["부족함이 없는 삶", "함께 하시는 골짜기", "넘치는 잔"], verses: ["시 23:4", "요 3:16"] } }),
        it("song", "헌금 찬송", 4, { song: { songId: "song-demo2" } }),
        it("text", "교회 소식", 3, { text: { text: "교회 소식\n\n다음 주일은 추수감사주일입니다\n예배 후 온 성도 함께 점심을 나눕니다" } }),
        it("fixed", "주기도문", 1, { fixed: { fixedId: "fx-lords" } }),
        it("text", "축도", 1, { text: { text: "축도" } }),
      ],
    };
    for (const item of svc.items) item.slides = buildSlides(item);
    return svc;
  };

  // 맥 앱에서만 되는 일: 파일 고르기 · 가져오기 · 백업 · 장비 연결 · 받아쓰기
  const onlyApp = (what) => Store.message(`체험판에서는 ${what}를 할 수 없습니다.\n맥 앱 WorshipFlow에서 쓸 수 있어요(테스트 중 · 곧 출시).`, "WorshipFlow 체험판");
  Store.pickFiles = async () => { onlyApp("파일 불러오기"); return []; };
  Store.pickSave = async () => { onlyApp("파일 저장"); return null; };
  Store.exportBackup = async () => onlyApp("백업");
  Store.importBackup = async () => onlyApp("백업 되살리기");

  // 화면 아래 왼쪽 ‘체험판’ 표시 — 처음으로 · 나눔스튜디오로
  function badge() {
    const b = document.createElement("div");
    b.id = "wfDemo";
    b.innerHTML = `<b>체험판</b><span>예시 글로 체험</span><a href="stage.html" target="wf-stage" title="설교자 · 인도자가 보는 화면">강단 페이지</a><a href="overlay.html" target="wf-ovl" title="OBS로 나가는 생중계 하단 자막(투명 바탕)">생중계 자막</a><button type="button" id="wfDemoReset">처음 상태로</button><a href="../index.html#worshipflow">← 나눔스튜디오</a>`;
    const css = document.createElement("style");
    css.textContent = `#wfDemo{white-space:nowrap;position:fixed;left:50%;transform:translateX(-50%);bottom:4px;z-index:99999;display:flex;align-items:center;gap:10px;background:rgba(20,26,51,.94);color:#fff;font:500 12.5px "Noto Sans KR",system-ui,sans-serif;padding:4px 6px 4px 10px;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.14)}
#wfDemo b{background:#D7A34B;color:#17130D;border-radius:999px;padding:1px 9px;font-size:12px}
#wfDemo span{opacity:.75}
#wfDemo button,#wfDemo a{background:rgba(255,255,255,.1);color:#fff;border:0;border-radius:999px;padding:3px 10px;font:inherit;cursor:pointer;text-decoration:none}
#wfDemo button:hover,#wfDemo a:hover{background:rgba(255,255,255,.2)}`;
    document.head.append(css); document.body.append(b);
    b.querySelector("#wfDemoReset").onclick = async () => { if (await Store.confirm("체험한 내용을 지우고 처음 예시 예배로 돌아갈까요?", "WorshipFlow 체험판")) WF_DEMO.reset(); };
  }
  document.addEventListener("DOMContentLoaded", badge);
})(window);
