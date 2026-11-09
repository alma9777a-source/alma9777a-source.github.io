// WorshipFlow 홈페이지 체험판(2026-11-09) — samples.js 바로 뒤, app.js 앞에서 돈다.
// 체험판 판(DEMO_V)이 바뀌면 이 브라우저에 남은 체험 자료를 지우고 새 예시로 시작한다.
// 가사 · 본문은 저작권 걱정이 없는 것만: 체험용으로 지은 가사, 1779년 찬송(Amazing Grace), 개역한글 샘플 구절, 옛 사도신경 · 주기도문.
(function (G) {
  const DEMO_V = "wf-demo-1";
  try {
    if (localStorage.getItem("wf:demoV") !== DEMO_V) {
      Object.keys(localStorage).filter((k) => k.startsWith("wf:")).forEach((k) => localStorage.removeItem(k));
      localStorage.setItem("wf:demoV", DEMO_V);
      try { localStorage.setItem("lastService", ""); } catch (e) {}
    }
  } catch (e) {}
  // 체험판은 카메라를 쓰지 않는다(생중계 미리보기의 ATEM 카메라 화면 — 홈페이지 방문자에게 권한 창이 뜨지 않게)
  try { if (navigator.mediaDevices) { navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error("체험판에서는 카메라를 쓰지 않습니다")); navigator.mediaDevices.enumerateDevices = () => Promise.resolve([]); } } catch (e) {}
  // 체험판은 ‘지난번 예배 중에 앱이 닫혔습니다’ 복구 안내를 띄우지 않는다(새로 열 때마다 준비 화면부터)
  try { localStorage.removeItem("wf:session.json"); } catch (e) {}
  G.WF_DEMO = { v: DEMO_V, reset() { try { Object.keys(localStorage).filter((k) => k.startsWith("wf:")).forEach((k) => localStorage.removeItem(k)); } catch (e) {} location.reload(); } };

  const S = G.Samples;
  S.FIXED = [
    { id: "fx-creed", name: "사도신경", text:
`전능하사 천지를 만드신
하나님 아버지를 내가 믿사오며

그 외아들 우리 주 예수 그리스도를 믿사오니
이는 성령으로 잉태하사 동정녀 마리아에게 나시고

본디오 빌라도에게 고난을 받으사
십자가에 못 박혀 죽으시고 장사한 지 사흘 만에
죽은 자 가운데서 다시 살아나시며

하늘에 오르사 전능하신 하나님 우편에 앉아 계시다가
저리로서 산 자와 죽은 자를 심판하러 오시리라

성령을 믿사오며 거룩한 공회와
성도가 서로 교통하는 것과

죄를 사하여 주시는 것과 몸이 다시 사는 것과
영원히 사는 것을 믿사옵나이다 아멘` },
    { id: "fx-lords", name: "주기도문", text:
`하늘에 계신 우리 아버지여
이름이 거룩히 여김을 받으시오며

나라이 임하옵시며
뜻이 하늘에서 이룬 것같이 땅에서도 이루어지이다

오늘날 우리에게 일용할 양식을 주옵시고
우리가 우리에게 죄 지은 자를 사하여 준 것같이
우리 죄를 사하여 주옵시고

우리를 시험에 들게 하지 마옵시고
다만 악에서 구하옵소서

대개 나라와 권세와 영광이
아버지께 영원히 있사옵나이다 아멘` },
    { id: "fx-motto", name: "교회 표어", text: `은혜샘교회\n\n함께 거두고, 함께 나누는 한 해` },
  ];
  S.SONGS = [
    { id: "song-sample", title: "아침 햇살 (체험용 예시 곡)", author: "", source: "체험판을 위해 지은 가사", license: "", order: "1절 후렴 2절 후렴 브리지 후렴",
      text:
`[1절]
아침 햇살 비추는 길 위에
주님 손을 잡고 걸어가네

[2절]
저녁 노을 물드는 언덕에
주님 이름 다시 불러보네

[후렴]
주의 사랑 끝이 없어라
나의 노래 되시네

내 평생에 주만 따르리
나의 길이 되시네

[브리지]
두려움 없네 주 함께 계시니
두려움 없네 주 함께 계시니` },
    { id: "song-demo2", title: "거두는 손 (체험용 예시 곡)", author: "", source: "체험판을 위해 지은 가사", license: "", order: "1절 후렴 2절 후렴",
      text:
`[1절]
흩어진 조각 하나도
주님 앞에 버려지지 않네

[2절]
작은 떡 다섯 개로도
주님 손에 넉넉하여라

[후렴]
거두시는 그 손 안에
우리 삶이 남아 있네

오늘도 그 은혜를
함께 나누며 살리라` },
    { id: "song-amazing", title: "Amazing Grace (1779, 공개 저작물)", author: "John Newton", source: "1779년 찬송 — 저작권 기간이 끝난 가사", license: "", order: "1절 2절 3절",
      text:
`[1절]
Amazing grace! How sweet the sound
That saved a wretch like me!

I once was lost, but now am found;
Was blind, but now I see.

[2절]
'Twas grace that taught my heart to fear,
And grace my fears relieved;

How precious did that grace appear
The hour I first believed.

[3절]
Through many dangers, toils and snares,
I have already come;

'Tis grace hath brought me safe thus far,
And grace will lead me home.` },
  ];
})(window);
