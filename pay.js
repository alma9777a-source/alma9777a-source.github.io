/* 결제·내려받기 연결 설정 — 두 홈페이지가 함께 쓴다.
   결제 서비스(토스페이먼츠·스트라이프·레몬스퀴지 등)의 결제 링크나 앱스토어 주소가 생기면 아래 빈칸("")에 넣는다.
   빈칸이면 단추에 ‘곧 열립니다 / Coming soon’이 붙고 눌리지 않는다. 가격 글도 여기서 바꾼다 */
window.PAY = {
  namun: {
    price_mac: "49,000원",        // 맥용 등록(1대, 1회 구입)
    price_ipad: "29,000원",       // 아이패드 앱스토어 정식판(앱 내 구입)
    price_win: "49,000원",        // Windows용 등록 — 맥용과 같은 값(2026-10-12 결정)
    win_trial: "https://github.com/alma9777a-source/alma9777a-source.github.io/releases/download/v0.9.14/NamunJogak-0.9.14-setup.exe",   // Windows용 무료 체험 내려받기(설치 파일). 2026-10-18 엶(저작자 결정). 닫을 때: 이 값을 비운다. 새 판을 낼 때 맥용과 함께 주소를 바꾼다
    mac_trial: "https://github.com/alma9777a-source/alma9777a-source.github.io/releases/download/v0.9.17/NamunJogak-0.9.17.dmg",   // 맥용 무료 체험 내려받기(dmg). 2026-10-12 저작자 결정으로 다시 엶(지금 0.9.17 — 링크 받기가 빠진 공식판). 닫을 때: 이 값을 비우고 릴리스 v0.9.17을 초안으로 돌린다
    mac_buy: "mailto:alma9777a@gmail.com?subject=%EB%82%A8%EC%9D%80%20%EC%A1%B0%EA%B0%81%20%EB%AC%B8%EC%9D%98&body=%EB%AC%B8%EC%9D%98%ED%95%98%EC%8B%A4%20%EB%82%B4%EC%9A%A9%EC%9D%84%20%EC%A0%81%EC%96%B4%20%EC%A3%BC%EC%84%B8%EC%9A%94.%0A%0A%28%EA%B5%AC%EC%9E%85%20%EC%8B%A0%EC%B2%AD%EC%9D%80%20%EC%95%B1%EC%9D%98%20%EB%93%B1%EB%A1%9D%20%ED%99%94%EB%A9%B4%EC%97%90%EC%84%9C%20%E2%80%98%EC%8B%A0%EC%B2%AD%20%EB%B3%B4%EB%82%B4%EA%B8%B0%E2%80%99%EB%A1%9C%20%ED%95%98%EC%8B%9C%EB%A9%B4%20%EA%B0%80%EC%9E%A5%20%EB%B9%A0%EB%A6%85%EB%8B%88%EB%8B%A4.%29%0A",   // 구입 · 등록 문의(메일). 신청과 등록은 앱의 등록 화면에서 한다(판매 장부)
    ipad_appstore: "",            // 아이패드 앱스토어 주소
    // 토스페이먼츠 클라이언트 키(공개해도 되는 키). 넣으면 홈페이지에 '구입하기'가 나타나고 buy.html에서 결제할 수 있다.
    // test_ck_… = 시험 결제(돈이 나가지 않고, 구입 쪽에 '시험 결제 중' 안내가 뜸) · live_ck_… = 실제 판매(계약 · 통신판매업 신고 뒤에)
    // 시크릿 키(…_sk_…)는 절대 여기에 넣지 않는다 — 판매 장부의 스크립트 속성 TOSS_SECRET_KEY에만 넣는다
    toss_client_key: ""   // 2026-10-17 저작자 결정: 토스페이먼츠는 아직 결정 전이라 잠시 닫음(구입하기 숨김) — 메일 신청 + 계좌이체로. 다시 열 때 시험 키는 test_ck_kYG57Eba3G47AZQDn4n9VpWDOxmA
  },
  // 출시 기념가 — 'until'이 지나면 홈페이지가 알아서 위의 원래 가격(49,000원)으로 돌아간다. 아이패드(App Store)는 해당 없음.
  // 2026-10-16 저작자 결정: 한 달 동안 20,000원. 끝내려면 until을 지난 날짜로, 늘리려면 날짜만 바꾼다
  promo: {
    label: "출시 기념가",
    price: "20,000원",
    keys: ["namun.price_mac", "namun.price_win"],
    until: "2026-11-15T23:59:59+09:00"   // 한국 시간 11월 15일 밤까지 → 11월 16일 0시부터 49,000원
  },
  snippetcut: {
    price_krw: "49,000원",
    price_usd: "$34.99",
    mac_trial: "",                // Mac 무료 체험 내려받기 주소
    mac_buy: "",                  // Mac 정식판 결제 링크
    appstore: ""                  // App Store 주소(맥·아이패드 유니버설)
  }
};
(function(){
  function apply(){
    document.documentElement.classList.toggle("win-open", !!window.PAY.namun.win_trial);
    document.documentElement.classList.toggle("buy-open", !!window.PAY.namun.toss_client_key);
    if (window.PAY.namun.win_trial) document.querySelectorAll("[data-win-src]").forEach(function(i){ i.src = i.getAttribute("data-win-src"); });
    document.querySelectorAll("[data-pay]").forEach(function(a){
      var p = a.getAttribute("data-pay").split("."), url = (window.PAY[p[0]] || {})[p[1]];
      if (url){ a.setAttribute("href", url); a.classList.remove("soon"); a.removeAttribute("aria-disabled"); }
      else { a.removeAttribute("href"); a.classList.add("soon"); a.setAttribute("aria-disabled", "true"); }
    });
    var pr = window.PAY.promo, on = pr && new Date() <= new Date(pr.until), d = on && new Date(pr.until);
    document.querySelectorAll("[data-price]").forEach(function(e){
      var k = e.getAttribute("data-price"), p = k.split("."), v = (window.PAY[p[0]] || {})[p[1]];
      if (!v) return;
      if (on && pr.keys.indexOf(k) >= 0){
        e.innerHTML = '<s class="was"></s> <span class="now"></span> <span class="promo"></span>';
        e.querySelector(".was").textContent = v;
        e.querySelector(".now").textContent = pr.price;
        e.querySelector(".promo").textContent = pr.label + " · " + (d.getMonth() + 1) + "월 " + d.getDate() + "일까지";
      }
      else e.textContent = v;
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply); else apply();
})();
