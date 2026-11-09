// 설정 — 예배당 화면 모니터 · 대기/로고 · 긴급 화면 · 영상 · 백업 · 저작권 안내.
function renderSettings() {
  const st = WF.lib.settings;
  const ms = WF.monitors;
  const imgs = WF.lib.media.filter((m) => !m.hidden && !AUDIO_RE.test(m.ext) && !/^(mp4|mov|m4v|webm)$/i.test(m.ext));
  const mediaSel = (id, cur) => `<select id="${id}"><option value="">없음</option>${imgs.map((m) => `<option value="${m.file}" ${m.file === cur ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select>`;
  $("#settingsBox").innerHTML = `
  <div style="display:flex;align-items:center;gap:12px"><h2 style="margin:0">설정</h2><button class="btn primary" id="setWizard" title="화면 · 카메라 · 전환기 · OBS를 단계별로 맞추기">장비 연결 도우미</button></div>
  <section class="sgroup" data-g="ui">
    <h3>조작 창 모양</h3>
    <div class="form2">
      <label>화면 크기</label><div><span class="seg2" id="setScale">${[["auto", "저절로"], ["0.9", "작게"], ["1", "보통"], ["1.15", "크게"], ["1.3", "아주 크게"]].map(([v, n]) => `<button data-v="${v}" class="${String(st.uiScale || "auto") === v ? "on" : ""}">${n}</button>`).join("")}</span> <span class="muted small">저절로: 큰 모니터에서는 글자 · 단추를 115%로. 창이 좁으면 왼쪽 저장공간이 접힙니다(◧로 펼침)</span></div>
      <label>유리 효과</label><label class="chk"><input type="checkbox" id="setGlass" ${st.glass !== false ? "checked" : ""}> 맥 스타일(위 막대 · 왼쪽 칸 · 조작 단추가 유리처럼) — 맥이 느리면 끄세요. 예배당 TV · 생중계 화면에는 쓰지 않습니다</label>
    </div>
  </section>
  <section class="sgroup" data-g="screen">
    <h3>예배당 화면</h3>
    <div class="form2">
      <label>내보낼 모니터</label>
      <div>${ms.map((m, i) => `<label class="radio"><input type="radio" name="mon" value="${esc(m.name)}" ${pickMonitor() === m.name ? "checked" : ""}>
          <b>${esc(monNick(m) || monBase(m))}</b> <span class="muted small">${monNick(m) ? esc(monBase(m)) + " · " : ""}${m.width}×${m.height}${m.primary ? " · 조작 화면(주 모니터)" : ""}</span>
          <button class="btn xs" data-nick="${esc(m.name)}" title="예: 예배당 TV · 뒤쪽 모니터">이름 붙이기</button></label>`).join("")}
        <label class="radio"><input type="radio" name="mon" value="" ${!pickMonitor() ? "checked" : ""}> 창으로 보기 <span class="muted small">(화면이 하나뿐일 때 · 시험용)</span></label>
        ${ms.length < 2 ? `<div class="warnc small" style="margin:6px 0">맥이 화면을 하나만 보고 있습니다. TV에 맥 화면이 똑같이 나오면 ‘미러링’ 상태입니다 → 시스템 설정 → 디스플레이 → TV → ‘확장 디스플레이’로 바꾸면 여기에 TV가 나타납니다.</div>` : ""}
        <div class="muted small">‘이름 붙이기’로 화면마다 우리 이름(예배당 TV · 뒤쪽 모니터)을 붙여 두면 헷갈리지 않습니다. 모니터 순서가 바뀌어도 이름으로 찾습니다. 조작 화면(주 모니터)에 예배당 화면을 띄우면 성도에게 조작 화면이 보일 수 있으니 피하세요.</div>
      </div>
      <label></label><div>${WF.projOn ? `<button class="btn" id="setProjTest">이 모니터로 다시 띄우기</button>` : `<span class="muted small">예배당 화면은 위쪽 ‘예배당 화면 꺼짐 [켜기]’로 켭니다.</span>`}</div>
    </div>
  </section>
  <section class="sgroup" data-g="screen">
    <h3>강단 모니터(뒤쪽 TV)</h3>
    <div class="muted small">설교자 · 찬양팀이 보는 화면입니다. 지금 가사와 다음 가사, 남은 시간, 방송실에서 보낸 말이 크게 나옵니다(성도용 예배당 화면과 따로).
      이 맥에 꽂힌 모니터를 고르세요. 맥미니 M2 기본형은 모니터를 2대까지만 따로 쓸 수 있어, 세 번째 모니터는 DisplayLink 어댑터로 연결합니다.</div>
    <div class="form2">
      <label>띄울 모니터</label>
      <div>${ms.map((m, i) => { const proj = WF.projOn ? WF.projMonitor === m.name : pickMonitor() === m.name; return `<label class="radio"><input type="radio" name="stmon" value="${esc(m.name)}" ${st.stageMonitor === m.name ? "checked" : ""} ${m.primary || proj ? "disabled" : ""}>
          <b>${esc(monNick(m) || monBase(m))}</b> <span class="muted small">${monNick(m) ? esc(monBase(m)) + " · " : ""}${m.width}×${m.height}${m.primary ? " · 조작 화면" : proj ? " · 예배당 화면" : ""}</span></label>`; }).join("")}
        ${ms.filter((m) => !m.primary).length < 2 ? `<div class="warnc small">지금 쓸 수 있는 모니터가 없습니다. 조작 화면 · 예배당 화면 말고 모니터가 하나 더 연결되어야 합니다.</div>` : ""}
      </div>
      <label></label><div><button class="btn" id="setStageScr">${WF.stageOn ? "강단 화면 끄기" : "강단 화면 켜기"}</button> <span class="muted small">켜 두면 다음부터 ‘예배당 화면 켜기’ 때 함께 켜집니다.</span></div>
    </div>
  </section>
  <section class="sgroup" data-g="live">
    <h3>생중계(OBS) — 자막 모양</h3>
    <div class="muted small">OBS에서 ‘브라우저’ 소스를 더하고 아래 주소를 넣으세요(너비 1920 · 높이 1080). 바탕이 투명해서 카메라 위에 자막만 얹힙니다. 이 주소는 이 Mac 안에서만 열립니다.</div>
    <div class="form2">
      <label>OBS에 넣을 주소</label><div class="urlrow"><code id="ovUrl">…</code><button class="btn sm" id="ovCopy">복사</button></div>
      <label>하단 템플릿</label><div><select id="ovTplSel">${Render.LOWER_TPLS.map((x) => [x.id, x.name]).concat(lowerTplList().map((m) => ["my:" + m.file, "내 템플릿 · " + m.name])).map(([k, n]) => `<option value="${esc(k)}" ${overlayTheme().tpl === k ? "selected" : ""}>${esc(n)}</option>`).join("")}</select> <span class="muted small">조작 화면 ② 생중계 미리보기 아래 ‘하단 자막 모양’에서도 고르고 내 템플릿(PNG)을 넣을 수 있습니다.</span></div>
      <label>글자 크기</label><div><input type="range" id="ovSize" min="36" max="80" step="2" value="${overlayTheme().size}"> <b id="ovSizeV">${overlayTheme().size}</b></div>
      <label>최대 줄 수</label><select id="ovLines">${[1, 2, 3].map((n) => `<option ${overlayTheme().maxLines === n ? "selected" : ""}>${n}</option>`).join("")}</select>
      <label>띠</label><div><select id="ovBand"><option value="box" ${overlayTheme().band === "box" ? "selected" : ""}>반투명 띠</option><option value="none" ${overlayTheme().band === "none" ? "selected" : ""}>띠 없이 글자 그림자만</option></select>
        진하기 <input type="range" id="ovAlpha" min="30" max="100" step="5" value="${overlayTheme().bandAlpha}"> <span class="muted small">어두운 띠 · 금색 줄 · 유리에 적용</span></div>
      <label>아래에서 띄우기</label><div><input type="range" id="ovBottom" min="2" max="20" step="1" value="${overlayTheme().bottom}"> <span class="muted small">휴대폰으로 볼 때 화면 아래 진행 막대에 가리지 않게</span></div>
      <label>화면 가득</label><div class="muted small">찬양 · 성경을 화면 가득(예배당 화면 그대로)으로 낼지, 영상 · 그림을 생중계에도 띄울지는 <b>준비 화면 ② 생중계 미리보기 아래 ‘하단 자막 모양’</b>에서 고릅니다. 영상 · 그림은 순서마다 · 그림마다 따로 고를 수 있습니다.</div>
    </div>
    <div class="pv cam small-pv" id="pvOvSet"></div>
  </section>
  <section class="sgroup" data-g="live">
    <h3>생중계(OBS) — 연결 · 방송 제어</h3>
    <div class="muted small">OBS 메뉴 <b>도구 → WebSocket 서버 설정</b>에서 ‘WebSocket 서버 사용’을 켜고, 거기 나온 비밀번호를 아래에 넣으세요. 비밀번호는 이 Mac의 키체인에만 저장됩니다. 연결되면 위쪽에 OBS 표시가 생기고, 누르면 장면 · 방송 · 녹화를 다룰 수 있습니다.</div>
    <div class="form2">
      <label>OBS 연결</label><label class="chk"><input type="checkbox" id="obsOn" ${st.obsOn ? "checked" : ""}> 사용</label>
      <label>주소</label><input id="obsUrl" value="${esc(st.obsUrl || "ws://127.0.0.1:4455")}">
      <label>비밀번호</label><div><input id="obsPw" type="password" placeholder="(키체인에 저장됨 — 바꿀 때만 입력)" style="width:260px"> <button class="btn sm" id="obsPwSave">저장</button></div>
      <label>긴급 장면 이름</label><div><input id="obsEm" value="${esc(st.obsEmergencyScene || "WFL_EMERGENCY")}"> <span class="muted small">F9를 누르면 이 장면으로(OBS에 있을 때만)</span></div>
      <label>지금 상태</label><div id="obsState" class="muted">${esc(OBS.state === "on" ? "연결됨 · 장면 " + OBS.scenes.length + "개" : OBS.err || (st.obsOn ? "연결 중…" : "사용 안 함"))}</div>
    </div>
  </section>
  <section class="sgroup" data-g="cam">
    <h3>카메라 전환기(ATEM)</h3>
    <div class="muted small">ATEM을 교회 공유기(랜선)에 꽂으면, 예배 중 화면에서 카메라 단추로 송출 화면을 바꿀 수 있습니다. ATEM 주소는 ATEM Software Control → 설정(Network)에 나옵니다. ATEM Mini 처음 주소는 192.168.10.240 이고, 이 맥과 같은 네트워크(192.168.10.x)여야 합니다. USB 카메라(미리보기)와는 따로입니다.</div>
    <div class="form2">
      <label>ATEM 연결</label><label class="chk"><input type="checkbox" id="atemOn" ${st.atemOn ? "checked" : ""}> 사용</label>
      <label>주소</label><input id="atemAddr" value="${esc(st.atemAddr || "192.168.10.240")}" placeholder="192.168.10.240">
      <label>지금 상태</label><div id="atemStateTx" class="muted">-</div>
      <label>예배당 TV 카메라</label><label class="chk"><input type="checkbox" id="setCamTv" ${st.camOnTv !== false ? "checked" : ""}> 대표기도 · 설교 제목 때 예배당 TV에도 카메라 + 이름 · 제목 띠 (ATEM이 USB로 연결되어 있을 때). ATEM 출력이 WorshipFlow(2)면 화면이 끝없이 겹치니 ATEM 전환은 카메라(1)에</label>
      <label>미리보기 카메라</label><div><select id="ovCam"><option value="auto">자동 — ATEM(Blackmagic)을 찾아 보여 줌</option><option value="off">끄기 — 그림으로</option>${(Cam.devs || []).filter((d) => d.label).map((d) => `<option value="${esc(d.deviceId)}">${esc(d.label)}</option>`).join("")}</select>
        <span class="muted small" id="ovCamState">${Cam.stream ? "보는 중: " + esc(Cam.label) : Cam.err ? esc(Cam.err) : "ATEM을 USB로 꽂으면 준비 화면 ② 칸에 진짜 카메라 화면이 나옵니다"}</span></div>
    </div>
  </section>
  <section class="sgroup" data-g="hand">
    <h3>태블릿(강단 페이지)</h3>
    <div class="muted small">강대상에 아이패드나 안 쓰는 노트북을 두고, 교회 와이파이에서 아래 주소를 열면 지금 · 다음 화면 · 시계 · 남은 시간 · 보낸 말이 보입니다. 보기 전용이라 강단에서 화면을 넘길 수는 없습니다. 처음 켤 때 Mac이 ‘들어오는 연결 허용’을 물으면 ‘허용’을 누르세요.</div>
    <div class="form2">
      <label>강단 페이지</label><div><button class="btn swbtn" id="stToggle">…</button></div>
      <label>태블릿에서 열 주소</label><div class="urlrow"><code id="stUrl">-</code><button class="btn sm" id="stCopy">복사</button></div>
      <label>4자리 번호</label><div><b id="stCode" class="bigcode">-</b> <button class="btn sm" id="stRenew">번호 바꾸기</button></div>
    </div>
  </section>
  <section class="sgroup" data-g="hand">
    <h3>휴대폰 리모컨</h3>
    <div class="muted small">설교자나 찬양 인도자가 휴대폰으로 다음 · 이전 · 검은 화면 · 찬양 부분(1절 · 후렴)을 직접 넘길 수 있습니다. 같은 와이파이에서 아래 주소를 엽니다. 6자리 번호를 아는 사람만 쓸 수 있으니 예배가 끝나면 끄거나 번호를 바꾸세요.</div>
    <div class="form2">
      <label>리모컨</label><div><button class="btn swbtn" id="rmToggle">…</button></div>
      <label>휴대폰에서 열 주소</label><div class="urlrow"><code id="rmUrl">-</code><button class="btn sm" id="rmCopy">복사</button></div>
      <label>6자리 번호</label><div><b id="rmCode" class="bigcode">-</b> <button class="btn sm" id="rmRenew">번호 바꾸기</button></div>
    </div>
  </section>
  <section class="sgroup" data-g="cam">
    <h3>카메라 전환기 — 루마키(모드 B)</h3>
    <div class="muted small">예배당 화면 출력을 분배기로 ATEM HDMI 4에 넣고 루마키로 자막을 얹을 때 켭니다. 예배당 화면이 ‘검은 바탕 + 아래쪽 2줄 흰 글자’가 되고 배경 그림 · 글자 그림자를 끕니다(루마키에서 글자가 깨지지 않게). 분배기 때문에 성도용 TV도 같은 모양이 됩니다.</div>
    <div class="form2"><label>루마키 모드</label><label class="chk"><input type="checkbox" id="setLuma" ${st.lumaMode ? "checked" : ""}> 켜기</label></div>
  </section>
  <section class="sgroup" data-g="church">
    <h3>교회 · 대기 · 로고 <kbd>L</kbd></h3>
    <div class="form2">
      <label>교회 이름</label><input id="setChurch" value="${esc(st.churchName || "")}">
      <label>교회 로고 그림</label><div>${mediaSel("setLogo", st.logoMedia)} <span class="muted small">그림은 보관함 → 그림 · 영상에서 넣습니다</span></div>
      <label>큰 글</label><input id="setSbText" value="${esc(st.standbyText || "")}">
      <label>작은 글</label><input id="setSbSub" value="${esc(st.standbySub || "")}" placeholder="예: 주일 2부 예배 · 오전 11시">
    </div>
    <div class="pv small-pv" id="pvLogo"></div>
  </section>
  <section class="sgroup" data-g="church">
    <h3>대기 화면 카운트다운</h3>
    <div class="form2">
      <label>숫자 바뀌는 모양</label><div><span class="seg2" id="setCdDigit">${[["slide", "살짝"], ["instant", "바로"], ["fade", "부드럽게"]].map(([v, n]) => `<button data-v="${v}" class="${(st.cdDigit || "slide") === v ? "on" : ""}">${n}</button>`).join("")}</span> <span class="muted small">카운트다운 숫자가 1초마다 바뀔 때 — 살짝: 새 숫자만 조금 올라오며 또렷해짐(기본) · 바로: 움직임 없음 · 부드럽게: 제자리에서 흐려졌다 또렷해짐</span></div>
      <label>카운트다운 움직임</label><label class="chk"><input type="checkbox" id="setCdLite" ${st.cdLite ? "checked" : ""}> 가볍게 — 움직이는 카운트다운(십자가 빛 · 유리 십자가 · 아치 창 · 해돋이 · 가을 · 오로라)을 덜 자주 그림. 맥이 느릴 때만 켜세요</label>
    </div>
  </section>
  <section class="sgroup" data-g="church">
    <h3>긴급 대기 화면 <kbd>F9</kbd></h3>
    <div class="form2">
      <label>그림</label><div>${mediaSel("setEmMedia", st.emergencyMedia)} <span class="muted small">비우면 로고 + 아래 글</span></div>
      <label>글</label><input id="setEmText" value="${esc(st.emergencyText || "")}">
    </div>
    <div class="pv small-pv" id="pvEmerg"></div>
  </section>
  <section class="sgroup" data-g="ui">
    <h3>화면 넘김 · 영상</h3>
    <div class="form2">
      <label>화면 넘김</label><select id="setTrans"><option value="fade" ${(st.transition || "fade") === "fade" ? "selected" : ""}>부드럽게(0.2초)</option><option value="slow" ${st.transition === "slow" ? "selected" : ""}>천천히(0.6초)</option><option value="cut" ${st.transition === "cut" ? "selected" : ""}>바로</option></select>
      <label>영상이 끝나면</label><select id="setVEnd"><option value="stop" ${st.videoEnd === "stop" ? "selected" : ""}>마지막 장면에서 멈춤</option><option value="next" ${st.videoEnd === "next" ? "selected" : ""}>다음 화면으로</option></select>
    </div>
  </section>
  <section class="sgroup" data-g="data">
    <h3>백업 · 복원</h3>
    <div class="muted small">예배 · 곡 · 고정 문구 · 성경 파일 · 그림을 zip 하나로 묶습니다. 다른 Mac에서 복원할 수 있습니다. ‘예배 중’으로 바꿀 때마다 자동 백업(최근 30개)도 남습니다.</div>
    <div class="tools"><button class="btn" id="setExport">백업 파일 만들기</button><button class="btn" id="setImport">백업에서 복원</button><button class="btn" id="setReveal">데이터 폴더 열기</button></div>
  </section>
  <section class="sgroup" data-g="data">
    <h3>저작권 안내</h3>
    <div class="note-box">성경 본문 · 찬양 가사 · 글꼴의 이용 허락은 사용하는 교회의 책임입니다. WorshipFlow에는 성경 번역본과 찬양 가사가 들어 있지 않으며, 교회가 허락받은 파일을 불러와 씁니다.
    앱에 들어 있는 글꼴(본고딕 Noto Sans KR · 고운바탕 · 나눔명조)은 SIL 오픈 폰트 라이선스로 자유롭게 쓸 수 있습니다.</div>
    <div class="muted small">WorshipFlow ${WF.version} · 나눔스튜디오</div>
  </section>`;
  drawInto($("#pvLogo"), { kind: "standby" }, logoSlide());
  Render.drawOverlay(Render.mountScaled($("#pvOvSet")), { kind: "text", text: "세상에 있는 자기 사람들을 사랑하시되 끝까지 사랑하시니라", ref: "요한복음 13:1" }, overlayTheme(), {});
  const ovSet = (k, v) => { WF.lib.themes.overlay = Object.assign(WF.lib.themes.overlay || {}, { [k]: v }); markDirty("lib"); sendLive(); Render.drawOverlay(Render.mountScaled($("#pvOvSet")), { kind: "text", text: "세상에 있는 자기 사람들을 사랑하시되 끝까지 사랑하시니라", ref: "요한복음 13:1" }, overlayTheme(), {}); };
  $("#ovSize").oninput = (e) => { $("#ovSizeV").textContent = e.target.value; ovSet("size", +e.target.value); };
  $("#ovLines").onchange = (e) => ovSet("maxLines", +e.target.value);
  $("#ovBand").onchange = (e) => ovSet("band", e.target.value);
  $("#ovAlpha").oninput = (e) => ovSet("bandAlpha", +e.target.value);
  $("#ovBottom").oninput = (e) => ovSet("bottom", +e.target.value);
  $("#ovTplSel").onchange = (e) => ovSet("tpl", e.target.value);
  $("#atemOn").onchange = (e) => { st.atemOn = e.target.checked; markDirty("lib"); st.atemOn ? atemConnect() : atemClose(); };
  $("#atemAddr").onchange = (e) => { st.atemAddr = e.target.value.trim(); markDirty("lib"); if (st.atemOn) atemConnect(); };
  atemUpdate();
  $$("#setScale [data-v]").forEach((b) => (b.onclick = () => { st.uiScale = b.dataset.v; markDirty("lib"); applyUiScale(); renderSettings(); }));
  $$("#setCdDigit [data-v]").forEach((b) => (b.onclick = () => { st.cdDigit = b.dataset.v; markDirty("lib"); WF.svc.items.forEach((x) => { if (x.kind === "standby" || x.kind === "media") rebuild(x); }); if (WF.live) sendLive(); renderSettings(); }));
  $("#setCdLite").onchange = (e) => { st.cdLite = e.target.checked; markDirty("lib"); WF.svc.items.forEach((x) => { if (x.kind === "standby") rebuild(x); }); if (WF.live) sendLive(); };
  $("#setGlass").onchange = (e) => { st.glass = e.target.checked; markDirty("lib"); applyGlass(); };
  $("#setCamTv").onchange = (e) => { st.camOnTv = e.target.checked; markDirty("lib"); sendLive(); };
  $("#ovCam").value = st.liveCam || "auto"; if ($("#ovCam").value !== (st.liveCam || "auto")) $("#ovCam").value = "auto";
  $("#ovCam").onchange = async (e) => { st.liveCam = e.target.value; markDirty("lib"); Cam.tried = false; if (st.liveCam === "off") stopCam(); else await startCam(true); renderSettings(); };
  if (!(Cam.devs || []).length) camDevices().then((d) => { if (d.some((x) => x.label) && WF.mode === "settings") renderSettings(); });
  // ‘가사 배경 영상 — 생중계에도’는 준비 화면 ‘모양’ 칸의 배경 옆으로 옮김
  $("#setLuma").onchange = (e) => { st.lumaMode = e.target.checked; markDirty("lib"); for (const it of WF.svc.items) if (it.kind === "scripture" || it.kind === "sermon") rebuild(it, true); sendLive(); renderSettings(); };
  $("#obsOn").onchange = (e) => { st.obsOn = e.target.checked; markDirty("lib"); st.obsOn ? obsConnect() : obsClose(); setTimeout(renderSettings, 1500); };
  $("#obsUrl").onchange = (e) => { st.obsUrl = e.target.value.trim(); markDirty("lib"); obsClose(); if (st.obsOn) obsConnect(); };
  $("#obsEm").onchange = (e) => { st.obsEmergencyScene = e.target.value.trim(); markDirty("lib"); };
  $("#obsPwSave").onclick = async () => {
    if (!Store.inApp) return;
    try { await window.__TAURI__.core.invoke("secret_set", { key: "obs-password", value: $("#obsPw").value }); $("#obsPw").value = ""; $("#obsPwSave").textContent = "저장됨"; obsClose(); if (st.obsOn) obsConnect(); setTimeout(renderSettings, 2000); }
    catch (e) { Store.message("키체인에 저장하지 못했습니다: " + e); }
  };
  // 순서 자막바(묶음 바꾸기 포함)는 준비 화면 ‘이 순서 꾸미기 → 순서 자막바’ 한 곳에서
  const showSrv = (info) => {
    $("#ovUrl").textContent = info.overlayUrl;
    $("#stToggle").innerHTML = `<i class="swi"></i>${info.stageOn ? "켜짐" : "꺼짐"}`; $("#stToggle").classList.toggle("off", !info.stageOn);

    $("#stUrl").innerHTML = info.stageOn ? ((info.stageUrls && info.stageUrls.length ? info.stageUrls : [info.stageUrl]).filter(Boolean).map((u, i) => `<div>${esc(u)}${i === 0 ? "" : ' <span class="muted small">(다른 연결)</span>'}</div>`).join("") || "와이파이 연결을 확인하세요") : "-";
    $("#stCode").textContent = info.stageOn ? info.code : "-";
    $("#rmToggle").innerHTML = `<i class="swi"></i>${info.remoteOn ? "켜짐" : "꺼짐"}`; $("#rmToggle").classList.toggle("off", !info.remoteOn);

    $("#rmUrl").innerHTML = info.remoteOn ? ((info.remoteUrls || []).map((u, i) => `<div>${esc(u)}${i === 0 ? "" : ' <span class="muted small">(다른 연결)</span>'}</div>`).join("") || "와이파이 연결을 확인하세요") : "-";
    $("#rmCode").textContent = info.remoteOn ? info.remoteCode : "-";
    WF.srv = info;
  };
  Store.serverInfo().then(showSrv);
  $("#ovCopy").onclick = async () => { if (await Store.copy($("#ovUrl").textContent)) $("#ovCopy").textContent = "복사됨"; };
  $("#stCopy").onclick = async () => { if (WF.srv && WF.srv.stageOn && (await Store.copy(WF.srv.stageUrl))) $("#stCopy").textContent = "복사됨"; };
  $("#stToggle").onclick = async () => { try { const on = !(WF.srv && WF.srv.stageOn); showSrv(await Store.setStage(on)); st.stageOn = on; markDirty("lib"); sendLive(); } catch (e) { Store.message(String(e)); } };
  $("#rmToggle").onclick = async () => { try { showSrv(await Store.setRemote(!(WF.srv && WF.srv.remoteOn))); } catch (e) { Store.message(String(e)); } };
  $("#rmRenew").onclick = async () => { if (WF.srv && WF.srv.remoteOn) showSrv(await Store.setRemote(true, true)); };
  $("#rmCopy").onclick = async () => { if (WF.srv && WF.srv.remoteOn && (await Store.copy((WF.srv.remoteUrls || [])[0] || ""))) $("#rmCopy").textContent = "복사됨"; };
  $("#stRenew").onclick = async () => { if (WF.srv && WF.srv.stageOn) showSrv(await Store.setStage(true, true)); };
  drawInto($("#pvEmerg"), { kind: "standby" }, emergencySlide());
  const ch = (id, fn) => { const el = document.getElementById(id); if (el) el.onchange = (e) => { fn(e.target.value); markDirty("lib"); renderSettings(); if (WF.flags.logo || WF.flags.emergency) sendLive(); }; };
  $$("input[name=mon]").forEach((r) => (r.onchange = () => { st.projMonitor = r.value; markDirty("lib"); }));
  if ($("#setProjTest")) $("#setProjTest").onclick = () => projectionOn().then(renderSettings);
  $("#setWizard").onclick = async () => { WF.srv = await Store.serverInfo().catch(() => WF.srv); openWizard(1); };
  $$("[data-nick]").forEach((b) => (b.onclick = async (e) => {
    e.preventDefault(); e.stopPropagation();
    const key = b.dataset.nick, m = WF.monitors.find((x) => x.name === key);
    const t = await prompt2(`이 화면 이름 (${m ? monBase(m) : key}) — 예: 예배당 TV · 뒤쪽 모니터 · 방송실 보조`, monNick(m || { name: key }));
    if (t == null) return;
    st.monitorNick = Object.assign({}, st.monitorNick || {}, { [key]: t.trim() }); if (!t.trim()) delete st.monitorNick[key];
    markDirty("lib"); renderSettings(); if (WF.projOn) updateProjChip(); if (WF.stageOn) updateStageChip();
  }));
  $$("input[name=stmon]").forEach((r) => (r.onchange = () => { st.stageMonitor = r.value; markDirty("lib"); if (WF.stageOn) stageScreenOn(); }));
  $("#setStageScr").onclick = () => (WF.stageOn ? stageScreenOff() : stageScreenOn()).then(renderSettings);
  ch("setLogo", (v) => (st.logoMedia = v));
  ch("setSbText", (v) => (st.standbyText = v));
  ch("setSbSub", (v) => (st.standbySub = v));
  ch("setEmMedia", (v) => (st.emergencyMedia = v));
  ch("setEmText", (v) => (st.emergencyText = v));
  ch("setVEnd", (v) => (st.videoEnd = v));
  ch("setTrans", (v) => (st.transition = v));
  ch("setChurch", (v) => (st.churchName = v));
  $("#setExport").onclick = async () => {
    await saveNow();
    const d = new Date().toISOString().slice(0, 10);
    const dest = await Store.pickSave({ title: "백업 파일 저장", defaultPath: `WorshipFlow_백업_${d}.zip`, filters: [{ name: "zip", extensions: ["zip"] }] });
    if (!dest) return;
    try { await Store.exportBackup(dest); Store.message("백업 파일을 만들었습니다:\n" + dest); } catch (e) { Store.message("백업 실패: " + e); }
  };
  $("#setImport").onclick = async () => {
    const p = await Store.pickFiles({ multiple: false, title: "백업 파일 고르기", filters: [{ name: "zip", extensions: ["zip"] }] });
    if (!p.length) return;
    if (!(await Store.confirm("백업으로 지금 자료를 바꿀까요?\n지금 자료는 먼저 자동 백업해 둡니다."))) return;
    try { await saveNow(); await Store.importBackup(p[0]); await Store.message("복원했습니다. 화면을 다시 불러옵니다."); location.reload(); }
    catch (e) { Store.message("복원 실패: " + e); }
  };
  $("#setReveal").onclick = () => (Store.inApp ? window.__TAURI__.core.invoke("reveal_data") : Store.message("데이터 폴더:\n(브라우저 미리보기)"));
  settingsNav();
}
// 설정 목차: 왼쪽 7묶음 — 누르면 그 묶음 칸만 보임(같은 장치는 한 묶음에)
const SET_GROUPS = [["screen", "화면", "예배당 TV · 강단 모니터"], ["live", "생중계", "OBS 자막 · 연결"], ["cam", "카메라", "전환기(ATEM) · 루마키"], ["hand", "손에 드는 것", "태블릿 · 휴대폰 리모컨"], ["church", "교회", "이름 · 로고 · 대기 · 카운트다운 · 긴급"], ["ui", "조작 창", "모양 · 화면 넘김 · 영상"], ["data", "자료", "백업 · 복원 · 저작권"]];
function settingsNav() {
  const box = $("#settingsBox"); if (!box) return;
  const g = WF.setGroup || "screen";
  const nav = document.createElement("nav"); nav.className = "setnav";
  nav.innerHTML = SET_GROUPS.map(([k, n, d]) => `<button data-g="${k}" class="${k === g ? "on" : ""}"><b>${n}</b><small>${d}</small></button>`).join("");
  const body = document.createElement("div"); body.className = "setbody";
  box.querySelectorAll(":scope > .sgroup").forEach((sec) => { sec.hidden = sec.dataset.g !== g; body.appendChild(sec); });
  const wrap = document.createElement("div"); wrap.className = "setwrap"; wrap.append(nav, body); box.appendChild(wrap);
  nav.querySelectorAll("button").forEach((b) => (b.onclick = () => { WF.setGroup = b.dataset.g; nav.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); body.querySelectorAll(".sgroup").forEach((sec) => (sec.hidden = sec.dataset.g !== WF.setGroup)); box.scrollTop = 0; }));
}
// 넓은 화면: 설정 묶음을 두 단에 높이가 비슷하게 나눠 담는다(빈 곳 없이). 좁으면 한 단 그대로.
function balanceSettings() {
  const box = $("#settingsBox"); if (!box || box.clientWidth < 1100) return;
  const secs = [...box.querySelectorAll(":scope > .sgroup")]; if (secs.length < 2) return;
  const cols = [document.createElement("div"), document.createElement("div")], h = [0, 0];
  cols.forEach((c) => (c.className = "scol"));
  const hs = secs.map((s) => s.offsetHeight);
  secs.forEach((s, i) => { const k = h[0] <= h[1] ? 0 : 1; cols[k].appendChild(s); h[k] += hs[i]; });
  const wrap = document.createElement("div"); wrap.className = "scols"; wrap.append(...cols); box.appendChild(wrap);
}
