/* 결제·내려받기 연결 설정 — 두 홈페이지가 함께 쓴다.
   결제 서비스(토스페이먼츠·스트라이프·레몬스퀴지 등)의 결제 링크나 앱스토어 주소가 생기면 아래 빈칸("")에 넣는다.
   빈칸이면 단추에 ‘곧 열립니다 / Coming soon’이 붙고 눌리지 않는다. 가격 글도 여기서 바꾼다 */
window.PAY = {
  namun: {
    price_mac: "49,000원",        // 맥용 등록(1대, 1회 구입)
    price_ipad: "29,000원",       // 아이패드 앱스토어 정식판(앱 내 구입)
    price_church: "99,000원",     // 교회 묶음(맥 3대)
    mac_trial: "",                // 맥용 무료 체험 내려받기(dmg) 주소
    mac_buy: "",                  // 맥용 등록 코드 결제 링크
    church_buy: "",               // 교회 묶음(맥 3대) 결제 링크
    ipad_appstore: ""             // 아이패드 앱스토어 주소
  },
  snippetcut: {
    price_krw: "19,000원",
    price_usd: "$14.99",
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
