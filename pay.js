/* 결제·내려받기 연결 설정 — 두 홈페이지가 함께 쓴다.
   결제 서비스(토스페이먼츠·스트라이프·레몬스퀴지 등)의 결제 링크나 앱스토어 주소가 생기면 아래 빈칸("")에 넣는다.
   빈칸이면 단추에 ‘곧 열립니다 / Coming soon’이 붙고 눌리지 않는다. 가격 글도 여기서 바꾼다 */
window.PAY = {
  namun: {
    price_mac: "49,000원",        // 맥용 등록(1대, 1회 구입)
    price_ipad: "29,000원",       // 아이패드 앱스토어 정식판(앱 내 구입)
    price_win: "49,000원",        // Windows용 등록 — 맥용과 같은 값(2026-10-12 결정)
    win_trial: "",                // Windows용 무료 체험 내려받기(설치 파일) 주소 — 유튜브 심사 완료 후 연다
    mac_trial: "https://github.com/alma9777a-source/alma9777a-source.github.io/releases/download/v0.8.5/NamunJogak-0.8.5.dmg",   // 맥용 무료 체험 내려받기(dmg). 2026-10-12 저작자 결정으로 다시 엶(지금 0.8.5). 닫을 때: 이 값을 비우고 릴리스 v0.8.5를 초안으로 돌린다
    mac_buy: "mailto:alma9777a@gmail.com?subject=%EB%82%A8%EC%9D%80%20%EC%A1%B0%EA%B0%81%20%EB%93%B1%EB%A1%9D%20%EC%BD%94%EB%93%9C%20%EC%8B%A0%EC%B2%AD&body=%EC%95%84%EB%9E%98%20%EB%82%B4%EC%9A%A9%EC%9D%84%20%EC%A0%81%EC%96%B4%20%EB%B3%B4%EB%82%B4%20%EC%A3%BC%EC%84%B8%EC%9A%94.%0A%0A1.%20%EA%B8%B0%EA%B8%B0%20%EB%B2%88%ED%98%B8%28%EC%95%B1%EC%9D%98%20%EB%93%B1%EB%A1%9D%20%ED%99%94%EB%A9%B4%EC%97%90%20%EB%82%98%EC%98%B5%EB%8B%88%EB%8B%A4%29%3A%20%0A2.%20%EC%9D%B4%EB%A6%84%3A%20%0A3.%20%EA%B5%90%ED%9A%8C%20%EC%9D%B4%EB%A6%84%3A%20%0A4.%20%EC%97%B0%EB%9D%BD%EC%B2%98%3A%20%0A%0A%EA%B2%B0%EC%A0%9C%20%EB%B0%A9%EB%B2%95%EC%9D%84%20%EB%8B%B5%EC%9E%A5%EC%9C%BC%EB%A1%9C%20%EC%95%88%EB%82%B4%ED%95%B4%20%EB%93%9C%EB%A6%BD%EB%8B%88%EB%8B%A4.",   // 맥용 등록 코드 신청(메일 양식). 결제 서비스가 생기면 그 주소로 바꾼다
    ipad_appstore: ""             // 아이패드 앱스토어 주소
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
    document.querySelectorAll("[data-pay]").forEach(function(a){
      var p = a.getAttribute("data-pay").split("."), url = (window.PAY[p[0]] || {})[p[1]];
      if (url){ a.setAttribute("href", url); a.classList.remove("soon"); a.removeAttribute("aria-disabled"); }
      else { a.removeAttribute("href"); a.classList.add("soon"); a.setAttribute("aria-disabled", "true"); }
    });
    document.querySelectorAll("[data-price]").forEach(function(e){
      var p = e.getAttribute("data-price").split("."), v = (window.PAY[p[0]] || {})[p[1]];
      if (v) e.textContent = v;
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply); else apply();
})();
