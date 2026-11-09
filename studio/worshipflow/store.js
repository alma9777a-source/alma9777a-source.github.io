// 저장 · 창 · 파일 다루기. 앱(Tauri) 안에서는 Rust 명령을, 브라우저 미리보기에서는 localStorage 를 쓴다.
(function (G) {
  const T = G.__TAURI__;
  const inApp = !!(T && T.core);
  const call = (cmd, args) => T.core.invoke(cmd, args || {});
  const LS = "wf:";
  const bc = !inApp && "BroadcastChannel" in G ? new BroadcastChannel("wf-live") : null;
  let dataPath = "";

  const Store = {
    inApp,
    async init() { if (inApp) dataPath = await call("data_path"); return dataPath; },
    dataPath: () => dataPath,
    async load(name) {
      if (inApp) return call("load_text", { name });
      return localStorage.getItem(LS + name);
    },
    async save(name, text) {
      if (inApp) return call("save_text", { name, text });
      localStorage.setItem(LS + name, text);
    },
    async trash(name) {
      if (inApp) return call("trash_file", { name });
      localStorage.removeItem(LS + name);
    },
    async list(dir) {
      if (inApp) return call("list_dir", { name: dir });
      const pre = LS + dir + "/";
      return Object.keys(localStorage).filter((k) => k.startsWith(pre)).map((k) => k.slice(pre.length)).sort();
    },
    async loadJSON(name, fallback) {
      try { const s = await Store.load(name); return s ? JSON.parse(s) : fallback; }
      catch (e) {
        // 망가진 파일이면 직전 판(.bak)을 읽어 본다
        try { const b = await Store.load(name.replace(/\.json$/, ".bak")); if (b) return JSON.parse(b); } catch (e2) {}
        return fallback;
      }
    },
    saveJSON: (name, obj) => Store.save(name, JSON.stringify(obj, null, 1)),
    mediaUrl(file) {
      if (!file) return "";
      if (!inApp) return localStorage.getItem(LS + "blob:" + file) || "";
      return T.core.convertFileSrc(dataPath + "/media/" + file);
    },
    async pickFiles(opts) {
      if (!inApp) return [];
      const r = await T.dialog.open(Object.assign({ multiple: true }, opts || {}));
      return r == null ? [] : Array.isArray(r) ? r : [r];
    },
    async pickSave(opts) { return inApp ? T.dialog.save(opts || {}) : null; },
    async importMedia(path) {
      // 영상은 확인 · 변환에 시간이 걸릴 수 있어 위에 알림을 띄운다
      const vid = /\.(avi|wmv|mkv|flv|mpg|mpeg|vob|3gp|ts|m2ts|webm|mp4|mov|m4v)$/i.test(path);
      if (vid && G.banner) G.banner("영상을 확인하는 중… 맥에서 바로 안 열리는 영상은 mp4 로 바꿉니다(긴 영상은 몇 분 걸릴 수 있습니다).", "info");
      try { return await call("import_media", { path }); } finally { if (vid && G.banner) G.banner(""); }
    },
    async mediaExists(file) { return inApp ? call("media_exists", { file }) : true; },
    async readUserFile(path) {
      const bytes = new Uint8Array(await call("read_user_file", { path }));
      // UTF-8 이 아니면(옛 한글 파일) EUC-KR 로 다시 읽는다
      let txt = new TextDecoder("utf-8").decode(bytes);
      if (txt.includes("�")) { try { txt = new TextDecoder("euc-kr").decode(bytes); } catch (e) {} }
      return txt;
    },
    writeUserFile: (path, text) => call("write_user_file", { path, text }),
    exportBackup: (dest) => call("export_backup", { dest }),
    importBackup: (src) => call("import_backup", { src }),
    autoBackup: (reason) => (inApp ? call("auto_backup", { reason }) : Promise.resolve()),
    async monitors() {
      if (inApp) return call("list_monitors");
      return [{ index: 0, name: "이 화면", x: 0, y: 0, width: screen.width, height: screen.height, scale: 1, primary: true }];
    },
    async openProjection(monitor) {
      if (inApp) return call("open_projection", { monitor: monitor || null });
      G.open("projection.html", "wf-proj", "width=960,height=540");
      return "창";
    },
    async closeProjection() { if (inApp) return call("close_projection"); },
    async openStageScreen(monitor) { return inApp ? call("open_stage_screen", { monitor: monitor || null }) : "창"; },
    async closeStageScreen() { if (inApp) return call("close_stage_screen"); },
    async projectionOpen() { return inApp ? call("projection_open") : false; },
    async setLive(state) {
      if (inApp) return call("set_live", { state });
      localStorage.setItem(LS + "live", JSON.stringify(state));
      if (bc) bc.postMessage(state);
    },
    async pptxText(path) { return call("pptx_text", { path }); },
    async serverInfo() {
      if (inApp) return call("server_info");
      return { overlayUrl: "http://127.0.0.1:17860/overlay", stageUrl: "", stageOn: false, code: "0000", ip: "" };
    },
    async setRemote(on, renew) { return inApp ? call("set_remote", { on, renew: !!renew }) : Store.serverInfo(); },
    async setStage(on, renew) { return inApp ? call("set_stage", { on, renew: !!renew }) : Store.serverInfo(); },
    async copy(text) { try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; } },
    listen(ev, fn) { if (inApp) T.event.listen(ev, (e) => fn(e.payload)); },
    async confirm(msg, title) {
      if (inApp && T.dialog && T.dialog.ask) return T.dialog.ask(msg, { title: title || "WorshipFlow", kind: "warning", okLabel: "예", cancelLabel: "아니요" });
      return G.confirm(msg);
    },
    async message(msg, title) {
      if (inApp && T.dialog && T.dialog.message) return T.dialog.message(msg, { title: title || "WorshipFlow" });
      G.alert(msg);
    },
  };
  G.Store = Store;
})(window);
