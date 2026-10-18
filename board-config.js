/* 묻고 답하기 게시판 연결 — 비어 있으면 게시판 대신 ‘준비 중’ 안내와 자주 묻는 질문만 보인다.
   api: Cloudflare Workers 주소 · sitekey: Cloudflare Turnstile의 Site Key(공개해도 되는 값). Secret Key는 여기에 넣지 않는다 */
window.BOARD = { api: "https://namunjogak-board.namunjogak-board.workers.dev", sitekey: "0x4AAAAAAFZ79JXYuE7qg0fa" };
