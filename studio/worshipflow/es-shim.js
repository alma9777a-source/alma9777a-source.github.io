// WorshipFlow 체험판: 생중계 자막 · 강단 페이지는 원래 앱 안 서버(/events)에서 지금 상태를 받는다.
// 홈페이지에는 서버가 없으니, 같은 브라우저의 조작 창이 보내는 상태(BroadcastChannel "wf-live")로 대신 받는다.
(function (G) {
  // 체험판은 카메라를 쓰지 않는다(방문자에게 권한 창이 뜨지 않게)
  try { if (navigator.mediaDevices) { navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error("체험판")); navigator.mediaDevices.enumerateDevices = () => Promise.resolve([]); } } catch (e) {}
  G.EventSource = function () {
    const self = this;
    setTimeout(() => {
      if (self.onopen) self.onopen({});
      try { const s = localStorage.getItem("wf:live"); if (s && self.onmessage) self.onmessage({ data: s }); } catch (e) {}
    }, 50);
    if ("BroadcastChannel" in G) new BroadcastChannel("wf-live").onmessage = (e) => { if (self.onmessage) self.onmessage({ data: JSON.stringify(e.data) }); };
    this.close = () => {};
  };
})(window);
