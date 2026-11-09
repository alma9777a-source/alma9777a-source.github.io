// 생중계 미리보기(②)에 진짜 카메라 화면: ATEM Mini 를 USB 로 꽂으면 맥에 웹캠 ‘Blackmagic Design’으로 잡힌다.
// 기본은 ‘자동’ — Blackmagic · ATEM 이름의 카메라만 쓰고(맥북 내장 카메라는 쓰지 않음), 없으면 그림(자리 표시)을 그대로 둔다.
// 화면만 보여 줄 뿐 녹화 · 저장하지 않는다. OBS 가 같은 카메라를 써도 함께 볼 수 있다.
const Cam = { stream: null, label: "", tried: false, err: "", devs: [] };
async function camDevices() {
  try { Cam.devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput"); } catch (e) { Cam.devs = []; }
  return Cam.devs;
}
async function startCam(force) {
  const want = (WF.lib && WF.lib.settings.liveCam) || "auto";
  if (WF.testing) return attachCam(); // 시험 중에는 진짜 카메라를 열지 않음(허락 창이 시험을 멈춤)
  if (want === "off" || !navigator.mediaDevices) return stopCam();
  if (Cam.stream && !force) return attachCam();
  if (Cam.tried && !force) return;
  Cam.tried = true; Cam.err = "";
  try {
    let devs = await camDevices();
    if (!devs.length) return;
    // 카메라 이름은 허락을 받은 뒤에만 보인다 → 한 번 열었다 바로 닫고 다시 목록
    if (!devs.some((d) => d.label)) { const s = await navigator.mediaDevices.getUserMedia({ video: true }); s.getTracks().forEach((t) => t.stop()); devs = await camDevices(); }
    // 자동: ATEM(Blackmagic) 먼저, 없으면 캡처 장치(Cam Link · Magewell · AVerMedia …). 맥북 내장 카메라는 쓰지 않음.
    const dev = want === "auto" ? devs.find((d) => /blackmagic|atem/i.test(d.label)) || devs.find((d) => /cam ?link|elgato|magewell|avermedia|ultrastudio|usb capture|usb video|hdmi/i.test(d.label)) : devs.find((d) => d.deviceId === want);
    if (!dev) { if (want !== "auto") Cam.err = "고른 카메라를 찾지 못했습니다"; return attachCam(); }
    if (Cam.stream) Cam.stream.getTracks().forEach((t) => t.stop());
    Cam.stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: dev.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } });
    Cam.label = dev.label;
    Cam.stream.getVideoTracks()[0].addEventListener("ended", () => { Cam.stream = null; Cam.tried = false; attachCam(); });
    attachCam();
  } catch (e) { Cam.err = String((e && e.message) || e); attachCam(); }
}
function stopCam() { if (Cam.stream) Cam.stream.getTracks().forEach((t) => t.stop()); Cam.stream = null; attachCam(); }
// 미리보기 칸에 영상 붙이기(자막 그림은 그 위에 그대로 그려짐)
function attachCam() {
  const h = document.getElementById("pvOv"); if (!h) return;
  let v = h.querySelector(":scope > video.camfeed");
  if (!Cam.stream) { if (v) v.remove(); h.classList.remove("realcam"); return; }
  if (!v) { v = document.createElement("video"); v.className = "camfeed"; v.muted = true; v.autoplay = true; v.playsInline = true; h.prepend(v); }
  if (v.srcObject !== Cam.stream) { v.srcObject = Cam.stream; v.play().catch(() => {}); }
  h.classList.add("realcam");
}
if (navigator.mediaDevices) navigator.mediaDevices.addEventListener("devicechange", () => {
  if (typeof OBS !== "undefined" && OBS.state === "on") setTimeout(() => obsHealth(), 1500); // ATEM USB를 다시 꽂으면 OBS 카메라도 다시 맞춤
  Cam.tried = false; if (!Cam.stream || !Cam.stream.active) { Cam.stream = null; startCam(); }
});
