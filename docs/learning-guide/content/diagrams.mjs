// 인라인 SVG 그림. 색은 CSS 변수(라이트·다크)로 칠한다. data-go가 붙은 요소는 눌러서 이동한다.
import { TABLES, GROUPS } from "./e-tables.mjs";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const defs = (id) => `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-head"/></marker></defs>`;
function box(x, y, w, h, lines, o = {}) {
  const cls = o.cls || "d-box";
  const t = lines
    .map((l, i) => `<text x="${x + 14}" y="${y + 24 + i * 19}" class="${i === 0 ? "d-t" : "d-s"}">${esc(l)}</text>`)
    .join("");
  const g = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" class="${cls}"/>${t}`;
  return o.go ? `<g class="d-link" data-go="${o.go}" tabindex="0" role="link" aria-label="${esc(lines[0])}">${g}</g>` : g;
}
function arrow(d, label, o = {}) {
  const m = o.marker || "ah";
  const lbl = label
    ? label
        .split("\n")
        .map((l, i) => `<text x="${o.lx}" y="${o.ly + i * 16}" class="d-lbl"${o.anchor ? ` text-anchor="${o.anchor}"` : ""}>${esc(l)}</text>`)
        .join("")
    : "";
  return `<path d="${d}" class="${o.dash ? "d-arrow d-dash" : "d-arrow"}" marker-end="url(#${m})"${o.both ? ` marker-start="url(#${m})"` : ""}/>${lbl}`;
}
const svg = (id, w, h, body, title) =>
  `<figure class="diagram" id="${id}"><div class="dg-scroll"><svg viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${id}-t" style="min-width:${Math.min(w, 760)}px"><title id="${id}-t">${esc(title)}</title>${defs(id + "-ah").replace(`id="${id}-ah"`, `id="${id}-ah"`)}${body.replaceAll("url(#ah)", `url(#${id}-ah)`)}</svg></div>`;

/** 전체 구조(개념 + 저장소에서 확인한 연결). */
export function archSvg(id = "dg-arch") {
  const b = [
    box(20, 10, 210, 58, ["EAS Update", "앱 JS·이미지 원격 배포"], { cls: "d-box d-soft" }),
    arrow("M125,68 L125,98", "JS 번들", { lx: 135, ly: 88 }),
    box(20, 100, 210, 92, ["Android 앱", "Expo · React Native", "src/app + src/service"], { cls: "d-box d-accent", go: "front" }),
    box(20, 240, 210, 92, ["웹(브라우저)", "같은 코드의 웹 빌드", "expo export -p web"], { cls: "d-box d-accent", go: "front" }),
    box(20, 384, 210, 58, ["Vercel", "웹 정적 파일 제공"], { cls: "d-box d-soft" }),
    arrow("M125,384 L125,334", "HTML·JS 파일", { lx: 135, ly: 366 }),
    `<rect x="290" y="30" width="540" height="300" rx="14" class="d-group"/><text x="306" y="54" class="d-gt">EC2 (Ubuntu) · Docker Compose</text>`,
    box(320, 120, 190, 104, ["caddy 컨테이너", "웹 서버 · HTTPS 인증서", "80·443 공개", "reverse_proxy api:8080"], { go: "arch.deploy" }),
    box(590, 100, 220, 144, ["api 컨테이너", "Spring Boot (WAS)", "Tomcat + app.jar", ":8080 (밖에 안 열림)", "보안 필터 → 컨트롤러 → …"], { cls: "d-box d-accent", go: "back" }),
    arrow("M230,140 C270,140 280,160 318,160", "HTTPS · JSON\nAuthorization: Bearer", { lx: 236, ly: 120 }),
    arrow("M230,286 C270,286 280,196 318,196", "HTTPS · JSON\n(허용된 출처만, CORS)", { lx: 236, ly: 300 }),
    arrow("M510,172 L588,172", "HTTP", { lx: 532, ly: 164 }),
    box(900, 116, 180, 112, ["RDS MySQL", "DB: flexable", "계정: flexable_app", "EC2에서만 접근(문서)"], { cls: "d-box d-db", go: "db" }),
    arrow("M810,160 L898,160", "SQL (JDBC, TLS)", { lx: 818, ly: 150 }),
    arrow("M898,196 L812,196", "조회 결과(행)", { lx: 818, ly: 214 }),
    box(590, 384, 300, 76, ["flexable-web 서버 (별도 저장소)", "자기 계정·DB를 따로 운영", "이 저장소에서는 경계 API만 보인다"], { cls: "d-box d-ext", go: "arch.web" }),
    arrow("M650,384 L650,350 L440,350 L440,226", "HTTPS · JSON + X-Service-Key\n/internal/v1/web-links/*", { lx: 452, ly: 368, dash: true }),
  ].join("");
  return (
    svg("dg-arch", 1100, 470, b, "텅장관리 전체 구조: 앱·웹 → Caddy → API 컨테이너 → RDS MySQL") +
    `<figcaption>실선 = 저장소의 코드·설정 파일에서 확인한 연결({{b:config}}). 점선 = 다른 저장소(flexable-web) 쪽. EC2·RDS의 실제 상태(보안 그룹·접근 제한)는 문서 기록이며 이번에 확인하지 않았다({{b:doc}}). 상자를 누르면 해당 설명으로 간다.</figcaption></figure>`
  );
}

/** 배포 구성(backend/deploy 파일 기준). */
export function deploySvg() {
  const b = [
    box(20, 40, 250, 170, ["개발자 PC (사람이 실행)", "backend/deploy/deploy.sh", "① ./gradlew bootJar → app.jar", "② scp: app.jar, Dockerfile,", "    compose, Caddyfile → 서버", "③ ssh: docker compose up -d --build", "④ 이전 이미지·빌드 캐시 정리"], { cls: "d-box d-soft" }),
    `<rect x="310" y="20" width="560" height="380" rx="14" class="d-group"/><text x="326" y="44" class="d-gt">EC2 · /opt/flexable</text>`,
    arrow("M270,120 L308,120", "scp / ssh", { lx: 274, ly: 110 }),
    box(340, 64, 200, 70, [".env (권한 600)", "DB·JWT·CORS·OAuth 값", "저장소에 없음"], { cls: "d-box d-ext" }),
    box(340, 196, 210, 130, ["caddy (image caddy:2)", "Caddyfile {$API_DOMAIN}", "자동 HTTPS(Let's Encrypt)", "볼륨 caddy_data", "포트 80·443 → 밖"]),
    box(600, 160, 250, 176, ["api (Dockerfile로 빌드)", "eclipse-temurin:21-jre", "java -jar app.jar", "mem_limit 700m, -Xmx448m", "-Duser.timezone=UTC", "healthcheck /api/v1/health", "restart: unless-stopped"], { cls: "d-box d-accent" }),
    arrow("M540,100 C600,100 640,120 660,158", "env_file", { lx: 574, ly: 96 }),
    arrow("M550,262 L598,262", "HTTP :8080", { lx: 552, ly: 252 }),
    arrow("M120,260 L120,300 L338,300", "인터넷 HTTPS", { lx: 130, ly: 292 }),
    box(910, 196, 170, 104, ["RDS MySQL", "DB_URL", "sslMode=REQUIRED", "serverTimezone=UTC"], { cls: "d-box d-db" }),
    arrow("M850,248 L908,248", "JDBC", { lx: 858, ly: 240 }),
  ].join("");
  return svg("dg-deploy", 1100, 420, b, "배포 구성: deploy.sh가 app.jar를 올리고 docker compose가 caddy·api 컨테이너를 띄운다") +
    `<figcaption>모두 <code>backend/deploy/</code>의 파일에 적힌 구성이다({{b:config}}). 지금 서버에서 이대로 돌고 있는지는 HANDOFF 기록 기준이며 이번에 접속해 보지 않았다({{b:doc}}).</figcaption></figure>`;
}

/** 백엔드 계층(요청 한 개가 지나는 순서). */
export function layerSvg() {
  const W = 168, H = 86;
  const row1 = [
    ["HTTP 요청", "Tomcat이 받음", null],
    ["보안 필터 체인", "SecurityConfig", "c.SecurityConfig"],
    ["DispatcherServlet", "주소 → 메서드 찾기", null],
    ["Controller", "@RestController", "c.TransactionController"],
    ["Service", "@Transactional · 규칙", "c.TransactionService"],
  ];
  const row2 = [
    ["DB", "MySQL(운영) · H2", "db"],
    ["JDBC · Hikari", "연결 풀, SQL 전송", "g.jdbc"],
    ["Hibernate (JPA)", "영속성 컨텍스트", "g.jpa"],
    ["Repository", "JpaRepository", "c.TransactionRepository"],
    ["Entity", "@Entity ↔ 테이블", "c.Transaction"],
  ];
  let b = "";
  row1.forEach(([a, s, go], i) => {
    const x = 20 + i * 212;
    b += box(x, 30, W, H, [a, s], { go: go || undefined, cls: i >= 3 ? "d-box d-accent" : "d-box" });
    if (i < row1.length - 1) b += arrow(`M${x + W},73 L${x + 210},73`, "", {});
  });
  row2.forEach(([a, s, go], i) => {
    const x = 20 + i * 212;
    b += box(x, 190, W, H, [a, s], { go: go || undefined, cls: i === 0 ? "d-box d-db" : "d-box" });
    if (i < row2.length - 1) b += arrow(`M${x + 210},233 L${x + W + 2},233`, "", {});
  });
  b += arrow("M932,116 L932,188", "리포지토리 호출", { lx: 940, ly: 156 });
  b += box(536, 320, 260, 60, ["GlobalExceptionHandler", "예외 → { code, message } JSON"], { cls: "d-box d-ext", go: "c.GlobalExceptionHandler" });
  b += arrow("M720,116 L720,318", "예외가 나면", { lx: 728, ly: 300, dash: true });
  return svg("dg-layer", 1080, 400, b, "백엔드 계층: 필터 → 컨트롤러 → 서비스 → 리포지토리 → JPA → JDBC → DB") +
    `<figcaption>윗줄 왼쪽 → 오른쪽, 아랫줄 오른쪽 → 왼쪽으로 읽는다. 응답은 같은 길을 거꾸로 돌아간다.</figcaption></figure>`;
}

/** 대표 요청 레인: 단계 번호를 누르면 그 단계로 간다. */
export function laneSvg() {
  const cols = ["화면(React)", "api() 클라이언트", "보안 필터", "Controller", "Service", "JPA·Repository", "DB"];
  const cw = 150, x0 = 10;
  const place = { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 3, 11: 0, 12: 0, 13: 1, 14: 4, 15: 6, 16: 0 };
  const short = { 1: "입력 state", 2: "save()", 3: "api()", 4: "HTTP POST", 5: "토큰 검사", 6: "DTO 검증", 7: "키·카테고리", 8: "save()", 9: "INSERT", 10: "201 응답", 11: "다시 읽기", 12: "거래 읽기", 13: "HTTP PATCH", 14: "엔티티 수정", 15: "UPDATE·commit", 16: "다시 읽기" };
  let b = "";
  cols.forEach((c, i) => {
    const x = x0 + i * cw;
    b += `<rect x="${x}" y="10" width="${cw - 8}" height="560" rx="8" class="${i % 2 ? "d-lane2" : "d-lane"}"/><text x="${x + (cw - 8) / 2}" y="34" class="d-t" text-anchor="middle">${esc(c)}</text>`;
  });
  b += `<text x="${x0 + 4}" y="62" class="d-s">등록 (POST)</text><text x="${x0 + 4}" y="404" class="d-s">수정 (PATCH)</text>`;
  let prev = null;
  for (let n = 1; n <= 16; n++) {
    const cx = x0 + place[n] * cw + (cw - 8) / 2;
    const cy = n <= 11 ? 70 + n * 28 : 120 + n * 28 + 24;
    if (prev && !(n === 12)) b += `<path d="M${prev[0]},${prev[1]} L${cx},${cy}" class="d-arrow d-thin" marker-end="url(#ah)"/>`;
    b += `<g class="d-link d-step" data-go="flow-tx.s${n}" tabindex="0" role="link" aria-label="${n}단계 ${esc(short[n])}"><circle cx="${cx}" cy="${cy}" r="12" class="d-dot"/><text x="${cx}" y="${cy + 4}" text-anchor="middle" class="d-dotn">${n}</text><text x="${cx + 17}" y="${cy + 4}" class="d-s">${esc(short[n])}</text></g>`;
    prev = [cx, cy];
  }
  return svg("dg-lane", 1060, 580, b, "거래 등록·수정 요청이 지나는 곳(번호를 누르면 그 단계로 이동)") +
    `<figcaption>세로 띠 하나가 코드의 한 층이다. 번호를 누르면 아래 단계 설명으로 간다.</figcaption></figure>`;
}

const ERD = {
  users: [30, 60], user_identities: [30, 210], web_link_codes: [30, 430], web_links: [30, 580],
  budget_settings: [320, 60], fixed_expenses: [600, 60], protected_items: [880, 60],
  daily_budgets: [320, 210], fixed_expense_postings: [600, 210], seed_money_entries: [880, 210],
  categories: [320, 420], transactions: [600, 420],
  coin_wallets: [320, 620], outfits: [600, 620], coin_ledger: [880, 620],
  referrals: [320, 770], user_outfits: [600, 770],
};
/** ERD: 키 열만 보이고, 누르면 테이블 상세로 간다. users를 가리키는 FK는 머리글 왼쪽 점으로 표시. */
export function erdSvg() {
  const W = 230, HEAD = 30, ROW = 19;
  const geo = {};
  let b = "";
  const keyCols = (t) => t.columns.filter((c) => c.key || (t.logical || []).some((l) => l.column === c.name));
  for (const [name, t] of Object.entries(TABLES)) {
    const [x, y] = ERD[name];
    const cols = keyCols(t);
    const h = HEAD + cols.length * ROW + 22;
    geo[name] = { x, y, h, rows: Object.fromEntries(cols.map((c, i) => [c.name, y + HEAD + 14 + i * ROW - 4])) };
  }
  for (const g of GROUPS) {
    const ms = g.tables.map((n) => geo[n]);
    const x1 = Math.min(...ms.map((m) => m.x)) - 12, y1 = Math.min(...ms.map((m) => m.y)) - 34;
    const x2 = Math.max(...ms.map((m) => m.x + W)) + 12, y2 = Math.max(...ms.map((m) => m.y + m.h)) + 14;
    b += `<rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" rx="14" class="d-group"/><text x="${x1 + 14}" y="${y1 + 20}" class="d-gt">${esc(g.title)}</text>`;
  }
  const line = (d, label, lx, ly, dash, anchor) => `<path d="${d}" class="d-arrow${dash ? " d-dash" : ""}" marker-end="url(#ah)"/><text x="${lx}" y="${ly}" class="d-lbl"${anchor ? ` text-anchor="${anchor}"` : ""}>${esc(label)}</text>`;
  const tx = geo.transactions, ca = geo.categories, fp = geo.fixed_expense_postings, uo = geo.user_outfits, ou = geo.outfits, cw = geo.coin_wallets;
  b += line(`M${tx.x},${tx.rows.category_id} L${ca.x + W + 2},${ca.rows.id}`, "삭제 제한", (ca.x + W + tx.x) / 2, Math.min(tx.rows.category_id, ca.rows.id) - 8, false, "middle");
  b += line(`M${fp.x + 196},${fp.y + fp.h} L${fp.x + 196},${tx.y - 2}`, "FK 없음", fp.x + 202, (fp.y + fp.h + tx.y) / 2 + 4, true);
  b += line(`M${uo.x + 196},${uo.y} L${uo.x + 196},${ou.y + ou.h + 2}`, "삭제 제한", uo.x + 202, (uo.y + ou.y + ou.h) / 2 + 4);
  b += line(`M${cw.x + W},${cw.rows.equipped_outfit_id} L${ou.x - 2},${ou.rows.id}`, "FK 없음", (cw.x + W + ou.x) / 2, Math.min(cw.rows.equipped_outfit_id, ou.rows.id) - 8, true, "middle");
  for (const [name, t] of Object.entries(TABLES)) {
    const { x, y, h } = geo[name];
    const cols = keyCols(t);
    const toUsers = (t.fks || []).filter((f) => f.refTable === "users").length;
    let dots = "";
    for (let i = 0; i < toUsers; i++) dots += `<circle cx="${x + 14 + i * 10}" cy="${y + 15}" r="4" class="d-udot"/>`;
    const nameX = x + 14 + (toUsers ? toUsers * 10 + 4 : 0);
    let rows = "";
    cols.forEach((c, i) => {
      const ry = y + HEAD + 14 + i * ROW;
      const logical = (t.logical || []).some((l) => l.column === c.name);
      rows += `<text x="${x + 12}" y="${ry}" class="d-k">${esc(c.key || (logical ? "논리" : ""))}</text><text x="${x + 60}" y="${ry}" class="d-s">${esc(c.name)}</text>`;
    });
    const more = t.columns.length - cols.length;
    rows += `<text x="${x + 12}" y="${y + h - 8}" class="d-xs">${more > 0 ? `+ 다른 열 ${more}개` : "모든 열 표시"}</text>`;
    b += `<g class="d-link erd-t" data-go="t.${name}" tabindex="0" role="link" aria-label="테이블 ${name}"><rect x="${x}" y="${y}" width="${W}" height="${h}" rx="9" class="d-box"/><rect x="${x}" y="${y}" width="${W}" height="${HEAD}" rx="9" class="d-head-r"/>${dots}<text x="${nameX}" y="${y + 20}" class="d-t">${esc(name)}</text>${rows}</g>`;
  }
  return svg("dg-erd", 1130, 900, b, "최종 스키마 ERD(V1~V12 적용 결과, 17개 테이블)") +
    `<figcaption>키 열만 보인다(PK·FK·UQ, 논리 = 제약 없이 다른 행의 id를 담는 열). 이름 앞의 <span class="udot"></span> 점은 <code>users.id</code>를 가리키는 FK다(점 두 개 = 두 열). users를 가리키는 FK는 <code>referrals.inviter_id</code>(SET NULL) 하나만 빼고 모두 <code>ON DELETE CASCADE</code>다. 테이블을 누르면 모든 열·제약·예시 행을 볼 수 있다. 이 그림의 열·키 목록은 빌드할 때 H2에 V1~V11을 실제로 적용해 뽑은 스키마와 자동으로 대조했다({{b:ran}}).</figcaption></figure>`;
}
