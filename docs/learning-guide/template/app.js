(function () {
  "use strict";
  var D = JSON.parse(document.getElementById("guide-data").textContent);
  var TYPE = { f: "기능", s: "화면", a: "API", c: "코드", t: "테이블", x: "테스트", g: "용어" };
  var V = {}; D.views.forEach(function (v) { V[v.id] = v; });
  var ORDER = []; D.toc.forEach(function (g) { g.items.forEach(function (i) { ORDER.push(i); }); });
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  var store = { get: function (k, d) { try { var v = localStorage.getItem("tg." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem("tg." + k, JSON.stringify(v)); } catch (e) {} } };

  document.getElementById("app").innerHTML =
    '<header class="top"><div class="top-in"><button class="icon-btn" id="menu" aria-label="목차 열기" aria-expanded="false">☰</button>' +
    '<a class="brand" href="#home" data-go="home"><span class="brand-mark">₩</span><span class="brand-t">텅장관리 학습 가이드</span></a>' +
    '<div class="search"><input id="q" type="search" autocomplete="off" placeholder="기능·파일·함수·API·테이블·용어 검색 ( / )" aria-label="검색"><div id="sr" class="sr" hidden></div></div>' +
    '<div class="tools"><button class="tool" id="t-basic" aria-pressed="false">기초 모두 펼치기</button><button class="tool" id="t-deep" aria-pressed="false">상세 모두 펼치기</button>' +
    '<div class="mode" role="group" aria-label="보기 모드"><button id="m-learn" aria-pressed="true">학습</button><button id="m-present" aria-pressed="false">발표</button></div></div></div></header>' +
    '<div class="shell"><nav class="side" id="side" aria-label="목차"></nav><main id="main" tabindex="-1"></main><aside class="rail" id="rail" aria-label="이 페이지"></aside></div>' +
    '<div class="scrim" id="scrim" hidden></div><div class="present" id="present" hidden></div>';

  // ---------- 목차 ----------
  var side = $("#side");
  side.innerHTML = D.toc.map(function (g) { return '<div class="side-g">' + esc(g.g) + "</div>" + g.items.map(function (i) { return '<a href="#' + i + '" data-go="' + i + '" data-nav="' + i + '">' + esc(V[i].title) + "</a>"; }).join(""); }).join("") +
    '<div class="side-meta">기준 <code>' + D.meta.sha.slice(0, 7) + "</code> · 분석 " + D.meta.analysisDate + "<br>커밋 안 된 변경 " + D.meta.dirty + "</div>";
  function closeMenu() { side.classList.remove("open"); $("#scrim").hidden = true; $("#menu").setAttribute("aria-expanded", "false"); }
  $("#menu").onclick = function () { var o = !side.classList.contains("open"); side.classList.toggle("open", o); $("#scrim").hidden = !o; this.setAttribute("aria-expanded", String(o)); };
  $("#scrim").onclick = closeMenu;

  // ---------- 코드 강조 ----------
  var KW = "public private protected static final class interface record enum extends implements return new if else for while switch case yield throw throws try catch finally void long int boolean null true false this import package var let const function async await export default from type of in instanceof";
  var KWS = new RegExp("^(" + KW.split(" ").join("|") + ")$");
  var SQLK = /^(SELECT|FROM|WHERE|AND|OR|JOIN|ON|AS|ORDER|BY|GROUP|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|ALTER|ADD|COLUMN|MODIFY|PRIMARY|KEY|CONSTRAINT|UNIQUE|FOREIGN|REFERENCES|CASCADE|NOT|NULL|DEFAULT|BIGINT|INT|VARCHAR|BOOLEAN|DATETIME|DATE|TRUE|FALSE|SUM|COUNT|COALESCE|DESC|ASC|SHOW|TABLES|IN|IS|DUPLICATE|AUTO_INCREMENT)$/i;
  function hl(line, lang) {
    var t = line.trim();
    if ((lang === "java" || lang === "ts" || lang === "js") && (t.indexOf("*") === 0 || t.indexOf("/*") === 0)) return '<span class="sx-com">' + esc(line) + "</span>";
    var re;
    if (lang === "sql") re = /(--.*$)|('(?:[^'\\]|\\.)*')|(\b\d+\b)|([A-Za-z_]+)/g;
    else if (lang === "yaml" || lang === "bash" || lang === "docker" || lang === "caddy") re = /(#.*$)|("(?:[^"\\]|\\.)*"|'[^']*')|(\$\{[^}]*\})|(^\s*[\w.-]+(?=:))/g;
    else re = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(@\w+)|(\b\d[\d_]*L?\b)|([A-Za-z_$][\w$]*)/g;
    var out = "", last = 0, m;
    while ((m = re.exec(line))) {
      out += esc(line.slice(last, m.index)); last = re.lastIndex;
      var s = m[0], cls = "";
      if (m[1]) cls = "com"; else if (m[2]) cls = "str";
      else if (lang === "sql") cls = m[3] ? "num" : SQLK.test(s) ? "kw" : "";
      else if (lang === "yaml" || lang === "bash" || lang === "docker" || lang === "caddy") cls = m[3] ? "ann" : m[4] ? "key" : "";
      else if (m[3]) cls = "ann"; else if (m[4]) cls = "num"; else if (KWS.test(s)) cls = "kw";
      out += cls ? '<span class="sx-' + cls + '">' + esc(s) + "</span>" : esc(s);
      if (re.lastIndex === m.index) re.lastIndex++;
    }
    return out + esc(line.slice(last));
  }
  function snipHTML(id, note) {
    var s = D.snippets[id]; if (!s) return "";
    var lines = s.code.split("\n");
    var cut = lines.length > 30;
    return '<figure class="snip' + (cut ? " cut" : "") + '" data-sid="' + id + '"><figcaption><span class="snip-t">' + esc(s.title) + '</span><a class="snip-p" href="' + s.url + '" target="_blank" rel="noopener" title="커밋 고정 GitHub 링크(새 탭)">' + esc(s.path) + ":" + s.start + "–" + s.end + ' ↗</a><span class="snip-acts"><button class="copy" data-copy-snip="' + id + '">복사</button></span></figcaption>' +
      '<pre class="code"><code>' + lines.map(function (l, i) { return '<div class="cl"><span class="ln">' + (s.start + i) + '</span><span class="lc">' + (hl(l, s.lang) || " ") + "</span></div>"; }).join("") + "</code></pre>" +
      (cut ? '<div class="snip-foot"><button class="more">전체 ' + lines.length + "줄 보기</button></div>" : "") + (note || s.masked ? '<div class="snip-note">' + esc(note || "가이드에서 일부 값을 가렸다") + "</div>" : "") + "</figure>";
  }

  // ---------- 복사 ----------
  function copyText(text, btn) {
    function done(msg) { var o = btn.textContent; btn.textContent = msg; btn.classList.add("done"); setTimeout(function () { btn.textContent = o; btn.classList.remove("done"); }, 1500); }
    try { navigator.clipboard.writeText(text).then(function () { done("복사됨"); }, function () { fallback(); }); } catch (e) { fallback(); }
    function fallback() { var pre = btn.closest(".snip, .pre-wrap"); var target = pre && pre.querySelector("pre"); if (target) { var r = document.createRange(); r.selectNodeContents(target); var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } done("선택됨: Ctrl+C"); }
  }

  // ---------- 화면 그리기 ----------
  var main = $("#main"), rail = $("#rail"), hist = [], cur = null, suppress = false, flowStep = 1;
  function parse(tok) {
    tok = tok || "home";
    if (/^[fsactxg]\./.test(tok)) { var i = tok.indexOf("."); return { kind: "e", type: tok.slice(0, i), id: tok.slice(i + 1), tok: tok }; }
    var vid = tok.split(".")[0];
    if (V[vid]) return { kind: "v", id: vid, anchor: tok.indexOf(".") > 0 ? tok : null, tok: tok };
    return { kind: "v", id: "home", anchor: null, tok: "home" };
  }
  function go(tok, opt) {
    opt = opt || {};
    var r = parse(tok);
    var same = cur && ((cur.kind === "v" && r.kind === "v" && cur.id === r.id) || (cur.kind === "e" && cur.tok === r.tok));
    if (!same) { if (cur && !opt.noHist) hist.push(cur.tok); render(r); }
    cur = r;
    if (r.kind === "v") afterAnchor(r);
    if (!same && !r.anchor) window.scrollTo(0, 0);
    closeMenu(); closeSearch();
    if (!opt.fromHash) { suppress = true; try { location.hash = r.tok; } catch (e) {} setTimeout(function () { suppress = false; }, 0); }
  }
  window.addEventListener("hashchange", function () { if (suppress) return; go(location.hash.slice(1), { fromHash: true }); });
  function afterAnchor(r) {
    var a = r.anchor; if (!a) return;
    var m = a.match(/^flow-tx\.s(\d+)$/);
    if (m) { selectStep(+m[1]); var f = $("#flow"); if (f) f.scrollIntoView(); return; }
    var el = document.getElementById(a);
    if (el) { if (el.tagName === "DETAILS") el.open = true; el.scrollIntoView(); }
  }
  function crumb(group, title) {
    return '<div class="crumb">' + (hist.length ? '<button class="back" data-back="1">← 이전</button>' : "") + "<span>" + esc(group) + "</span> › <b>" + esc(title) + '</b><span id="crumb-sub"></span></div>';
  }
  function render(r) {
    $$("[data-nav]", side).forEach(function (a) { a.removeAttribute("aria-current"); });
    if (r.kind === "e") return renderEntity(r);
    var v = V[r.id];
    var nav = $('[data-nav="' + v.id + '"]', side); if (nav) nav.setAttribute("aria-current", "page");
    var head = v.id === "home" ? "" : '<div class="view-h"><h1>' + esc(v.title) + '</h1><p class="view-sum">' + esc(v.summary || "") + "</p></div>";
    var i = ORDER.indexOf(v.id), pv = ORDER[i - 1], nx = ORDER[i + 1];
    main.innerHTML = crumb(v.group, v.title) + '<article class="doc">' + head + v.html + "</article>" +
      '<nav class="pager">' + (pv ? '<a href="#' + pv + '" data-go="' + pv + '">이전<b>' + esc(V[pv].title) + "</b></a>" : "<span></span>") + (nx ? '<a href="#' + nx + '" data-go="' + nx + '" style="text-align:right">다음<b>' + esc(V[nx].title) + "</b></a>" : "") + "</nav>";
    hydrate(main);
    buildRail();
  }
  function hydrate(root) {
    $$(".snip-slot", root).forEach(function (el) { el.outerHTML = snipHTML(el.getAttribute("data-snip"), el.getAttribute("data-note")); });
    $$("pre[data-copy]", root).forEach(function (pre) { var w = document.createElement("div"); w.className = "pre-wrap"; pre.parentNode.insertBefore(w, pre); w.appendChild(pre); var b = document.createElement("button"); b.className = "copy"; b.textContent = "복사"; b.setAttribute("data-copy-pre", "1"); w.appendChild(b); });
    $$("pre.code-sql", root).forEach(function (pre) { if (!pre.hasAttribute("data-hl")) { pre.setAttribute("data-hl", "1"); pre.innerHTML = pre.textContent.split("\n").map(function (l) { return hl(l, "sql"); }).join("\n"); } });
    if ($("#flow-slot", root)) renderFlow();
    if ($("#sim-slot", root)) renderSim($("#sim-slot", root));
    var idx = $(".idx", root); if (idx) renderIndex(idx, idx.getAttribute("data-idx"));
    if ($("#build-report", root)) renderBuild($("#build-report", root));
    applyFolds(root);
  }
  // ---------- 오른쪽 '이 페이지' ----------
  var spy;
  function buildRail() {
    var hs = $$(".doc h2[id]", main);
    rail.innerHTML = hs.length ? '<div class="rail-h">이 페이지</div>' + hs.map(function (h) { return '<a href="#' + h.id + '" data-go="' + h.id + '" data-rail="' + h.id + '">' + esc(h.textContent) + "</a>"; }).join("") : "";
    if (spy) spy.disconnect();
    if (!("IntersectionObserver" in window)) return;
    spy = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { $$("[data-rail]", rail).forEach(function (a) { a.classList.toggle("on", a.getAttribute("data-rail") === e.target.id); }); var cs = $("#crumb-sub"); if (cs) cs.textContent = " › " + e.target.textContent; } });
    }, { rootMargin: "-70px 0px -70% 0px" });
    hs.forEach(function (h) { spy.observe(h); });
  }
  // ---------- 접기·펼치기 ----------
  var folds = { basic: store.get("basic", false), deep: store.get("deep", false) };
  function applyFolds(root) {
    if (folds.basic) $$("details.basic", root).forEach(function (d) { d.open = true; });
    if (folds.deep) $$("details.deep", root).forEach(function (d) { d.open = true; });
    $("#t-basic").setAttribute("aria-pressed", String(folds.basic)); $("#t-basic").textContent = folds.basic ? "기초 모두 접기" : "기초 모두 펼치기";
    $("#t-deep").setAttribute("aria-pressed", String(folds.deep)); $("#t-deep").textContent = folds.deep ? "상세 모두 접기" : "상세 모두 펼치기";
  }
  function toggleFold(k) { folds[k] = !folds[k]; store.set(k, folds[k]); $$("details." + k, main).forEach(function (d) { d.open = folds[k]; }); applyFolds(document.createElement("div")); }
  $("#t-basic").onclick = function () { toggleFold("basic"); };
  $("#t-deep").onclick = function () { toggleFold("deep"); };

  // ---------- 거래 흐름 ----------
  function renderFlow() {
    var st = D.flow.steps;
    $("#flow-slot").outerHTML = '<div class="flow" id="flow"><div class="flow-list" role="tablist" aria-label="단계">' +
      '<div class="fl-g">등록 (POST)</div>' + st.filter(function (s) { return s.track === "create"; }).map(stepBtn).join("") +
      '<div class="fl-g">수정 (PATCH)</div>' + st.filter(function (s) { return s.track === "edit"; }).map(stepBtn).join("") +
      '</div><div class="fd" id="fd" role="tabpanel" aria-live="polite"></div></div>';
    $("#faq-slot").outerHTML = '<div class="faq">' + D.flow.faq.map(function (q) { return '<details class="qa fold" id="flow-tx.' + q.id + '"><summary>' + esc(q.q) + '</summary><div class="fold-body">' + q.a + "</div></details>"; }).join("") + "</div>";
    $$("#flow-tx\\.q-idem .snip-slot, .faq .snip-slot").forEach(function (el) { el.outerHTML = snipHTML(el.getAttribute("data-snip")); });
    selectStep(flowStep);
  }
  function stepBtn(s) { return '<button class="fl-b" role="tab" data-step="' + s.n + '"><span>' + s.n + "</span>" + esc(s.title) + "</button>"; }
  function selectStep(n) {
    var st = D.flow.steps, s = st[n - 1]; if (!s || !$("#fd")) { flowStep = n; return; }
    flowStep = n;
    $$(".fl-b").forEach(function (b) { b.setAttribute("aria-selected", String(+b.getAttribute("data-step") === n)); });
    $$(".d-step").forEach(function (g) { g.classList.toggle("on", g.getAttribute("data-go") === "flow-tx.s" + n); });
    var snips = (s.snips || []).concat(s.extraSnips || []);
    $("#fd").innerHTML = '<div class="fd-top"><span class="fd-track' + (s.track === "edit" ? " edit" : "") + '">' + (s.track === "edit" ? "수정 PATCH" : "등록 POST") + "</span><span>" + n + " / " + st.length + " 단계</span></div><h3>" + esc(s.title) + '</h3><div class="fd-where"><b>지금 실행 위치</b> · ' + s.where + "</div>" + s.body +
      '<div class="io"><div><b>들어오는 값</b>' + s.input + "</div><div><b>나가는 값</b>" + s.output + "</div><div><b>메모리 상태 변화</b>" + s.memory + '</div><div class="db"><b>DB 데이터 변화</b>' + s.db + "</div></div>" +
      snips.map(function (id) { return snipHTML(id); }).join("") +
      (s.evidence ? '<details class="fold deep"><summary><span class="fold-tag">로그</span>실행 로그(로컬 H2, 2026-10-24 캡처)</summary><div class="fold-body"><pre class="code-log">' + esc(s.evidence) + "</pre></div></details>" : "") +
      '<div class="fd-next"><b>다음 단계로 넘어가는 이유</b> · ' + s.next + '</div><div class="fd-nav"><button class="nav-b" data-step-nav="' + (n - 1) + '"' + (n === 1 ? " disabled" : "") + '>← 이전 단계</button><button class="nav-b primary" data-step-nav="' + (n + 1) + '"' + (n === st.length ? " disabled" : "") + ">다음 단계 →</button></div>";
    applyFolds($("#fd"));
  }

  // ---------- 계산 시뮬레이터 ----------
  function renderSim(el) {
    var S = D.scenario;
    var presets = {
      scenario: { today: S.today, balance: S.balance, at: S.balanceAtLocal, payday: S.payday, card: S.cardUnpaid, prot: 300000, saved: 0, fixed: [{ day: 15, amount: 450000 }], tx: [{ type: "EXPENSE", amount: 9000, at: S.lunchLocal, fixed: false }] },
      test: { today: "2026-10-13", balance: 1250000, at: "2026-10-13T10:00", payday: 25, card: 0, prot: 300000, saved: 0, fixed: [{ day: 15, amount: 450000 }], tx: [{ type: "EXPENSE", amount: 12000, at: "2026-10-13T12:30", fixed: false }, { type: "EXPENSE", amount: 58000, at: "2026-10-13T09:00", fixed: false }, { type: "INCOME", amount: 30000, at: "2026-10-13T13:00", fixed: false }] },
      negative: { today: "2026-10-13", balance: 100000, at: "2026-10-13T10:00", payday: 25, card: 50000, prot: 0, saved: 0, fixed: [{ day: 20, amount: 200000 }], tx: [] },
    };
    var st = JSON.parse(JSON.stringify(presets.scenario));
    function num(v) { var x = parseInt(String(v).replace(/[^\d-]/g, ""), 10); return isNaN(x) ? 0 : x; }
    function draw() {
      el.innerHTML = '<div class="sim-presets"><button class="sim-preset" data-p="scenario">가이드 시나리오(9,000원 저장 후)</button><button class="sim-preset" data-p="test">테스트 예제 computesDocumentedExample</button><button class="sim-preset" data-p="negative">남은 돈이 음수</button></div>' +
        '<div class="sim-grid"><label>오늘(한국 날짜)<input id="s-today" type="date" value="' + st.today + '"></label><label>잔액(원)<input id="s-bal" inputmode="numeric" value="' + st.balance + '"></label><label>잔액 기준 시각<input id="s-at" type="datetime-local" value="' + st.at + '"></label>' +
        '<label>수입일(1~31)<input id="s-pay" inputmode="numeric" value="' + st.payday + '"></label><label>카드 미결제액<input id="s-card" inputmode="numeric" value="' + st.card + '"></label><label>매달 저축할 돈 합<input id="s-prot" inputmode="numeric" value="' + st.prot + '"></label>' +
        '<label>기준 시각 뒤 시드머니로 옮긴 돈<input id="s-saved" inputmode="numeric" value="' + st.saved + '"></label></div>' +
        '<div class="sim-sub">고정지출 <button class="sim-add" data-add="fixed">+ 추가</button></div>' + st.fixed.map(function (f, i) { return '<div class="sim-row fx"><input aria-label="날짜(1~31)" data-f="' + i + '" data-k="day" value="' + f.day + '"><input aria-label="금액" data-f="' + i + '" data-k="amount" value="' + f.amount + '"><span class="sim-fix">일 · 원</span><button class="sim-x" data-del-f="' + i + '" aria-label="삭제">×</button></div>'; }).join("") +
        '<div class="sim-sub">거래 <button class="sim-add" data-add="tx">+ 추가</button></div>' + st.tx.map(function (t, i) { return '<div class="sim-row"><select data-t="' + i + '" data-k="type" aria-label="종류"><option value="EXPENSE"' + (t.type === "EXPENSE" ? " selected" : "") + '>지출</option><option value="INCOME"' + (t.type === "INCOME" ? " selected" : "") + '>수입</option></select><input aria-label="금액" data-t="' + i + '" data-k="amount" value="' + t.amount + '"><input type="datetime-local" aria-label="시각" data-t="' + i + '" data-k="at" value="' + t.at + '"><label class="sim-fix"><input type="checkbox" data-t="' + i + '" data-k="fixed"' + (t.fixed ? " checked" : "") + '>자동 기록</label><button class="sim-x" data-del-t="' + i + '" aria-label="삭제">×</button></div>'; }).join("") +
        '<div class="sim-out" id="sim-out"></div><p class="sim-warn">학습 도구다. 서비스 화면은 이 계산을 하지 않고 서버 값을 받는다. 공휴일은 PublicHolidays.java(2026-12-25부터)를 그대로 쓴다.</p>';
      calc();
    }
    function calc() {
      var r = BudgetSim.compute({ balance: num(st.balance), balanceAt: BudgetSim.kst(st.at), payday: Math.min(31, Math.max(1, num(st.payday))), cardUnpaid: num(st.card), protectedTotal: num(st.prot), savedSinceBalance: num(st.saved),
        fixed: st.fixed.map(function (f) { return { day: Math.min(31, Math.max(1, num(f.day))), amount: num(f.amount) }; }),
        transactions: st.tx.map(function (t) { return { type: t.type, amount: num(t.amount), at: BudgetSim.kst(t.at), fixed: !!t.fixed }; }) }, st.today);
      var f = function (x) { return '<span class="' + (x < 0 ? "neg" : "") + '">' + x.toLocaleString("ko-KR") + "</span>"; };
      $("#sim-out", el).innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>값</th><th>결과</th><th>어떻게</th></tr></thead><tbody>' +
        "<tr><td>다음 수입일 · 남은 날</td><td>" + r.nextPayday + " · " + r.daysLeft + "일</td><td>오늘 제외 가장 가까운 수입일(주말·공휴일이면 다음 평일)</td></tr>" +
        "<tr><td>추정 잔액</td><td>" + f(r.estimatedBalance) + "</td><td>잔액 − 옮긴 돈 ± 기준 시각 뒤 거래</td></tr>" +
        "<tr><td>남은 고정지출</td><td>" + f(r.reservedFixed) + "</td><td>내일 ~ 수입일 전날</td></tr>" +
        "<tr><td>남은 생활비</td><td>" + f(r.remaining) + "</td><td>추정 잔액 − 고정지출 − 카드 − 저축</td></tr>" +
        "<tr><td>오늘 쓴 돈</td><td>" + f(r.todaySpent) + "</td><td>오늘 지출(자동 기록 제외)</td></tr>" +
        "<tr><td>하루 예산</td><td>" + f(r.dailyBudget) + "</td><td>⌊max(0, 남은 생활비 + 오늘 쓴 돈) ÷ " + r.daysLeft + "⌋</td></tr>" +
        "<tr><td><b>오늘 쓸 수 있는 돈</b></td><td>" + f(r.todayAvailable) + "</td><td>하루 예산 − 오늘 쓴 돈</td></tr>" +
        "<tr><td>부족액</td><td>" + f(r.shortage) + "</td><td>남은 생활비가 음수면 그만큼, 아니면 초과분</td></tr>" +
        "<tr><td>이번 주 쓸 수 있는 돈</td><td>" + f(r.weekAvailable) + "</td><td>max(0, 하루 예산 × " + r.weekDaysLeft + "일 − 오늘 쓴 돈)</td></tr>" +
        "<tr><td>정산 주기 시작</td><td>" + r.cycleStart + "</td><td>직전 수입일</td></tr></tbody></table></div>";
    }
    el.addEventListener("input", function (e) {
      var t = e.target, ids = { "s-today": "today", "s-bal": "balance", "s-at": "at", "s-pay": "payday", "s-card": "card", "s-prot": "prot", "s-saved": "saved" };
      if (ids[t.id]) st[ids[t.id]] = t.value;
      else if (t.hasAttribute("data-f")) st.fixed[+t.getAttribute("data-f")][t.getAttribute("data-k")] = t.value;
      else if (t.hasAttribute("data-t")) st.tx[+t.getAttribute("data-t")][t.getAttribute("data-k")] = t.type === "checkbox" ? t.checked : t.value;
      try { calc(); } catch (err) {}
    });
    el.addEventListener("change", function (e) { if (e.target.type === "checkbox" || e.target.tagName === "SELECT") { el.dispatchEvent(new Event("input")); var t = e.target; st.tx[+t.getAttribute("data-t")][t.getAttribute("data-k")] = t.type === "checkbox" ? t.checked : t.value; calc(); } });
    el.addEventListener("click", function (e) {
      var t = e.target;
      if (t.hasAttribute("data-p")) { st = JSON.parse(JSON.stringify(presets[t.getAttribute("data-p")])); draw(); }
      else if (t.getAttribute("data-add") === "fixed") { st.fixed.push({ day: 25, amount: 10000 }); draw(); }
      else if (t.getAttribute("data-add") === "tx") { st.tx.push({ type: "EXPENSE", amount: 5000, at: st.today + "T18:00", fixed: false }); draw(); }
      else if (t.hasAttribute("data-del-f")) { st.fixed.splice(+t.getAttribute("data-del-f"), 1); draw(); }
      else if (t.hasAttribute("data-del-t")) { st.tx.splice(+t.getAttribute("data-del-t"), 1); draw(); }
    });
    draw();
  }

  // ---------- 엔티티 페이지 ----------
  function chips(keys) { return '<div class="chips">' + keys.map(function (k) { var t = k.split(".")[0], id = k.slice(2), e = D.e[t] && D.e[t][id]; return e ? '<a class="chip" href="#' + k + '" data-go="' + k + '">' + esc(e.short || e.title) + "</a>" : ""; }).join("") + "</div>"; }
  function relsHTML(key) {
    var rel = D.rel[key] || [], by = {};
    rel.forEach(function (k) { (by[k[0]] = by[k[0]] || []).push(k); });
    var rows = ["f", "s", "a", "c", "t", "x", "g"].filter(function (t) { return by[t]; }).map(function (t) { return '<div class="rel-row"><b>' + TYPE[t] + "</b>" + chips(by[t]) + "</div>"; }).join("");
    var m = D.mentioned[key] || [];
    if (m.length) rows += '<div class="rel-row"><b>설명</b><div class="chips">' + m.filter(function (v) { return V[v]; }).map(function (v) { return '<a class="chip" href="#' + v + '" data-go="' + v + '">' + esc(V[v].title) + "</a>"; }).join("") + "</div></div>";
    return rows ? '<h2 id="ent-rel">연결된 항목</h2><div class="rels">' + rows + "</div>" : "";
  }
  function renderEntity(r) {
    var e = D.e[r.type] && D.e[r.type][r.id];
    if (!e) { main.innerHTML = crumb("찾아보기", "없음") + '<article class="doc"><h1>찾을 수 없어요</h1><p>‘' + esc(r.tok) + '’ 항목이 이 가이드에 없습니다. 위 검색을 써 보세요.</p></article>'; rail.innerHTML = ""; return; }
    var key = r.type + "." + r.id, h = "";
    h += '<div class="ent-h"><span class="ent-k">' + TYPE[r.type] + "</span><h1>" + esc(e.title) + '</h1><div class="ent-sub">' + esc(e.sub || "") + (e.url ? ' · <a class="path" href="' + e.url + '" target="_blank" rel="noopener">GitHub(커밋 고정)</a>' : "") + "</div></div>";
    if (r.type === "a") h += '<p><span class="method">' + e.method + '</span><span class="apipath">' + esc(e.path) + '</span></p><div class="kv"><b>인증</b><span>' + esc(e.auth) + '</span><b>컨트롤러</b><span><a class="path" href="' + e.url + '" target="_blank" rel="noopener">' + esc(e.file.split("/").pop()) + ":" + e.line + "</a></span></div>";
    h += '<p class="ent-sum">' + (e.summary || e.def || "") + "</p>";
    if (r.type === "a") { if (e.req) h += "<h3>요청 본문 예</h3><pre class=\"code-plain\" data-copy>" + esc(e.req) + "</pre>"; if (e.res) h += "<h3>응답 예</h3><pre class=\"code-plain\" data-copy>" + esc(e.res) + "</pre>"; if (e.errors) h += "<h3>주요 실패 응답</h3><ul>" + e.errors.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>"; }
    if (r.type === "c") { if (e.look || e.next) h += '<div class="looknext"><div><b>이 파일에서 볼 것</b>' + (e.look || "—") + "</div><div><b>다음에 갈 곳</b>" + (e.next || "—") + "</div></div>"; if (e.symbols) h += '<p class="note">주요 함수·메서드: ' + e.symbols.map(function (s) { return "<code>" + esc(s) + "</code>"; }).join(" ") + "</p>"; h += e.snips.map(function (s) { return snipHTML(s); }).join(""); }
    if (r.type === "s") h += '<div class="kv"><b>주소</b><span><code>' + esc(e.route) + '</code></span><b>경로 파일</b><span><a class="path" href="' + e.url + '" target="_blank" rel="noopener">' + esc(e.path) + "</a></span></div>";
    if (r.type === "g" && e.where) h += "<h3>우리 코드에서</h3><div>" + e.where + "</div>";
    if (r.type === "x") h += '<div class="kv"><b>종류</b><span>' + esc(e.kind) + '</span><b>실행 결과</b><span>' + e.run + '</span></div><h3>주요 테스트 메서드</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>메서드</th><th>검사하도록 작성된 내용</th></tr></thead><tbody>' + e.methods.map(function (m) { return '<tr><td><a class="path" href="' + m.url + '" target="_blank" rel="noopener">' + esc(m.name) + ":" + m.line + "</a></td><td>" + esc(m.what) + "</td></tr>"; }).join("") + "</tbody></table></div>";
    if (r.type === "t") {
      h += '<h2 id="ent-cols">열</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>열</th><th>타입</th><th>NULL</th><th>기본값</th><th>키</th><th>설명</th></tr></thead><tbody>' + e.columns.map(function (c) { return "<tr><td><code>" + esc(c.name) + "</code></td><td><code>" + esc(c.type) + "</code></td><td>" + (c.nullable ? "가능" : "NOT NULL") + "</td><td>" + esc(c.default || "") + "</td><td>" + esc(c.key) + "</td><td>" + c.note + (c.since ? ' <span class="note">(' + esc(c.since) + ")</span>" : "") + "</td></tr>"; }).join("") + "</tbody></table></div>";
      h += '<h2 id="ent-keys">키·제약·인덱스</h2><ul><li>PK: <code>(' + e.pk.join(", ") + ")</code></li>" + e.uniques.map(function (u) { return "<li>UNIQUE <code>" + u.name + "</code>: <code>(" + u.columns.join(", ") + ")</code></li>"; }).join("") + e.fks.map(function (f) { return "<li>FK <code>" + f.name + "</code>: <code>" + f.column + "</code> → <a class=\"ref ref-t\" href=\"#t." + f.refTable + "\" data-go=\"t." + f.refTable + "\">" + f.refTable + "</a>.<code>" + f.refColumn + "</code> · ON DELETE <code>" + f.onDelete + "</code></li>"; }).join("") + e.indexes.map(function (i) { return "<li>INDEX <code>" + i.name + "</code>: <code>(" + i.columns.join(", ") + ")</code></li>"; }).join("") + (e.logical || []).map(function (l) { return "<li>논리 관계: <code>" + l.column + "</code> → <code>" + l.to + "</code> — " + esc(l.note) + "</li>"; }).join("") + "</ul><p class=\"note\">마이그레이션: " + e.migrations.join(", ") + ' · <a class="ref ref-v" href="#db.flyway" data-go="db.flyway">Flyway 이력</a></p>';
      if (e.rows) h += '<h2 id="ent-rows">예시 행</h2><div class="tbl-wrap"><table class="tbl"><thead><tr>' + e.rows[0].map(function (x) { return "<th>" + esc(x) + "</th>"; }).join("") + "</tr></thead><tbody>" + e.rows.slice(1).map(function (rw) { return "<tr>" + rw.map(function (x) { return "<td>" + esc(x) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div><p class=\"note\">" + (e.rowsNote || "가이드 시나리오의 가상 데이터다(실제 사용자 데이터 아님). 시각은 운영 설정(UTC 저장) 기준으로 적었다.") + "</p>";
    }
    h += relsHTML(key);
    main.innerHTML = crumb("찾아보기 · " + TYPE[r.type], e.title) + '<article class="doc">' + h + "</article>";
    hydrate(main); buildRail();
  }
  // ---------- 목록 ----------
  function renderIndex(el, t) {
    var items = Object.keys(D.e[t]).map(function (id) { var e = D.e[t][id]; return { k: t + "." + id, title: e.short || e.title, sub: e.sub || "", sum: String(e.summary || e.def || "").replace(/<[^>]+>/g, "").slice(0, 140) }; });
    function draw(q) {
      q = (q || "").toLowerCase();
      var list = items.filter(function (i) { return !q || (i.title + " " + i.sub + " " + i.sum).toLowerCase().indexOf(q) >= 0; });
      $(".idx-list", el).innerHTML = list.length ? list.map(function (i) { return '<a class="idx-i" href="#' + i.k + '" data-go="' + i.k + '"><b>' + esc(i.title) + "<small>" + esc(i.sub) + "</small></b><span>" + esc(i.sum) + "</span></a>"; }).join("") : '<p class="note">맞는 항목이 없어요. 다른 말로 걸러 보세요.</p>';
    }
    el.innerHTML = '<input class="idx-filter" type="search" placeholder="이 목록에서 거르기" aria-label="목록 거르기"><p class="note">' + items.length + '개</p><div class="idx-list"></div>' + (t === "c" ? '<div class="idx-sec">저장소 전체 파일(미디어 제외, ' + D.files.length + "개)</div><div class=\"files\">" + D.files.map(function (f) { var c = null; Object.keys(D.e.c).some(function (id) { if (D.e.c[id].path === f) { c = id; return true; } return false; }); return c ? '<a href="#c.' + c + '" data-go="c.' + c + '">' + esc(f) + "</a>" : '<a href="' + D.fileUrl + encodeURI(f) + '" target="_blank" rel="noopener" class="path">' + esc(f) + "</a>"; }).join("") + "</div>" : "");
    $(".idx-filter", el).addEventListener("input", function () { draw(this.value); });
    draw("");
  }
  function renderBuild(el) {
    var c = D.meta.counts, s = c.schema;
    el.innerHTML = '<div class="tbl-wrap"><table class="tbl"><tbody>' +
      "<tr><td>코드 발췌</td><td>" + c.snippets + "개, 모두 실제 파일의 기준 문자열로 찾음(줄 번호 자동)</td></tr>" +
      "<tr><td>내부 링크</td><td>" + c.links + "개 연결, 대상 없음 0</td></tr>" +
      "<tr><td>항목 수</td><td>기능 " + c.f + " · 화면 " + c.s + " · API " + c.a + " · 코드 " + c.c + " · 테이블 " + c.t + " · 테스트 " + c.x + " · 용어 " + c.g + "</td></tr>" +
      "<tr><td>API 누락 검사</td><td>컨트롤러 매핑 " + c.mappings + "개 모두 API 목록에 있음</td></tr>" +
      "<tr><td>ERD 대조(H2 실제 스키마)</td><td>테이블 " + s.tables + " · 열 " + s.columns + " · FK " + s.fks + " · UNIQUE " + s.uniques + " · 이름 붙은 인덱스 " + s.indexes + " — 불일치 0</td></tr>" +
      "<tr><td>계산 시뮬레이터</td><td>BudgetCalculatorTest 기대값 " + c.sim + "개와 모두 일치</td></tr>" +
      "<tr><td>만든 시각</td><td>" + esc(D.meta.built) + " (커밋 " + D.meta.sha.slice(0, 7) + ")</td></tr></tbody></table></div>";
  }

  // ---------- 검색 ----------
  var q = $("#q"), sr = $("#sr"), sel = -1, hits = [];
  var KORDER = ["섹션", "소제목", "흐름 단계", "질문", "기능", "화면", "API", "코드", "함수", "테이블", "컬럼", "테스트", "용어"];
  function closeSearch() { sr.hidden = true; sel = -1; }
  function mark(t, terms) { var s = esc(t); terms.forEach(function (w) { if (!w) return; var i = s.toLowerCase().indexOf(esc(w).toLowerCase()); if (i >= 0) s = s.slice(0, i) + "<mark>" + s.slice(i, i + esc(w).length) + "</mark>" + s.slice(i + esc(w).length); }); return s; }
  function search(text) {
    var terms = text.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) { closeSearch(); return; }
    var res = [];
    D.search.forEach(function (it) {
      var T = it.t.toLowerCase(), S = (it.s || "").toLowerCase(), X = (it.x || "").toLowerCase(), score = 0, ok = true;
      terms.forEach(function (w) { var sc = T === w ? 100 : T.indexOf(w) === 0 ? 60 : T.indexOf(w) >= 0 ? 40 : S.indexOf(w) >= 0 ? 15 : X.indexOf(w) >= 0 ? 8 : 0; if (!sc) ok = false; score += sc; });
      if (ok) res.push({ it: it, score: score });
    });
    res.sort(function (a, b) { return b.score - a.score; });
    var groups = {}; res.forEach(function (r) { var g = groups[r.it.k] = groups[r.it.k] || []; if (g.length < 7) g.push(r.it); });
    hits = []; var html = "";
    KORDER.forEach(function (k) { if (!groups[k]) return; html += '<div class="sr-g">' + k + "</div>"; groups[k].forEach(function (it) { hits.push(it); html += '<a class="sr-i" role="option" href="#' + it.go + '" data-hit="' + (hits.length - 1) + '"><span><span class="sr-t">' + mark(it.t, terms) + '</span><br><span class="sr-s">' + esc(it.s) + "</span></span></a>"; }); });
    if (!hits.length) html = '<div class="sr-empty">‘' + esc(text) + '’에 맞는 항목이 없어요. 다른 낱말로 찾아보세요.<div class="chips">' + ["거래", "idempotency", "token_version", "flush", "고정지출", "transactions", "BudgetCalculator", "JOIN"].map(function (w) { return '<button class="chip" data-suggest="' + w + '">' + w + "</button>"; }).join("") + "</div></div>";
    sr.innerHTML = html; sr.hidden = false; sel = hits.length ? 0 : -1; paintSel();
  }
  function paintSel() { $$(".sr-i", sr).forEach(function (a, i) { a.setAttribute("aria-selected", String(i === sel)); if (i === sel) a.scrollIntoView({ block: "nearest" }); }); }
  q.addEventListener("input", function () { search(q.value); });
  q.addEventListener("focus", function () { if (q.value) search(q.value); });
  q.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { sel = Math.min(hits.length - 1, sel + 1); paintSel(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); paintSel(); e.preventDefault(); }
    else if (e.key === "Enter" && sel >= 0) { go(hits[sel].go); q.blur(); e.preventDefault(); }
    else if (e.key === "Escape") { closeSearch(); q.blur(); }
  });

  // ---------- 클릭(위임) ----------
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t.closest && !t.closest(".search")) closeSearch();
    var sug = t.closest("[data-suggest]"); if (sug) { q.value = sug.getAttribute("data-suggest"); search(q.value); q.focus(); return; }
    var hit = t.closest("[data-hit]"); if (hit) { e.preventDefault(); go(hits[+hit.getAttribute("data-hit")].go); return; }
    var cs = t.closest("[data-copy-snip]"); if (cs) { copyText(D.snippets[cs.getAttribute("data-copy-snip")].code, cs); return; }
    var cp = t.closest("[data-copy-pre]"); if (cp) { copyText(cp.parentNode.querySelector("pre").textContent, cp); return; }
    var more = t.closest(".more"); if (more) { var f = more.closest(".snip"); var cut = f.classList.toggle("cut"); more.textContent = cut ? "전체 " + f.querySelectorAll(".cl").length + "줄 보기" : "앞부분만 보기"; return; }
    var sb = t.closest("[data-step]"); if (sb) { selectStep(+sb.getAttribute("data-step")); return; }
    var sn = t.closest("[data-step-nav]"); if (sn && !sn.disabled) { selectStep(+sn.getAttribute("data-step-nav")); $("#flow").scrollIntoView(); return; }
    if (t.closest("[data-back]")) { var prev = hist.pop(); if (prev) go(prev, { noHist: true }); return; }
    if (t.closest('[data-action="present"]')) { openPresent(0); return; }
    var g = t.closest("[data-go]");
    if (g) {
      var tok = g.getAttribute("data-go");
      if (tok.indexOf("flow-tx.s") === 0 && cur && cur.id === "flow-tx" && cur.kind === "v") { e.preventDefault(); selectStep(+tok.slice(9)); $("#flow").scrollIntoView(); return; }
      e.preventDefault(); if (!$("#present").hidden) closePresent(); go(tok);
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === "Enter" && e.target.closest && e.target.closest("svg [data-go]")) { e.target.closest("[data-go]").dispatchEvent(new MouseEvent("click", { bubbles: true })); return; }
    if (!$("#present").hidden) return presentKey(e);
    if (e.key === "/") { e.preventDefault(); q.focus(); }
    else if (cur && cur.id === "flow-tx" && cur.kind === "v" && (e.key === "ArrowRight" || e.key === "ArrowLeft")) { var n = flowStep + (e.key === "ArrowRight" ? 1 : -1); if (n >= 1 && n <= D.flow.steps.length) selectStep(n); }
  });

  // ---------- 발표 모드 ----------
  var pIdx = 0, pNotes = store.get("notes", true);
  function openPresent(i) { pIdx = i || 0; $("#present").hidden = false; $("#m-present").setAttribute("aria-pressed", "true"); $("#m-learn").setAttribute("aria-pressed", "false"); drawPresent(); }
  function closePresent() { $("#present").hidden = true; $("#m-present").setAttribute("aria-pressed", "false"); $("#m-learn").setAttribute("aria-pressed", "true"); try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {} }
  $("#m-present").onclick = function () { openPresent(pIdx); };
  $("#m-learn").onclick = closePresent;
  function fixIds(h) { return String(h || "").replace(/(id="|#|aria-labelledby=")dg-/g, "$1pdg-"); }
  function drawPresent() {
    var s = D.scenes[pIdx], N = D.scenes.length, el = $("#present");
    el.innerHTML = '<div class="p-bar"><span class="p-k">발표 모드 · 약 10분</span><div class="p-dots">' + D.scenes.map(function (x, i) { return '<button data-scene="' + i + '" aria-current="' + (i === pIdx) + '" title="' + esc(x.title) + '">' + (i + 1) + "</button>"; }).join("") + '</div><div class="p-nav"><button class="nav-b" data-pn="-1"' + (pIdx === 0 ? " disabled" : "") + '>←</button><button class="nav-b primary" data-pn="1"' + (pIdx === N - 1 ? " disabled" : "") + '>→</button><button class="nav-b" data-pnotes>' + (pNotes ? "메모 숨기기" : "발표자 메모") + '</button><button class="nav-b" data-pexit>학습으로 (Esc)</button></div></div>' +
      '<div class="p-body' + (pNotes ? " with-notes" : "") + '"><div class="p-stage"><div class="p-in"><div class="p-time">' + (pIdx + 1) + " / " + N + " · " + esc(s.time) + '</div><h2 class="p-title">' + esc(s.title) + "</h2>" + (s.big || "") + (s.diagram ? '<div class="p-diagram">' + fixIds(s.diagram) + "</div>" : "") + '<ul class="p-points">' + s.points.map(function (p) { return "<li>" + p + "</li>"; }).join("") + "</ul></div></div>" +
      (pNotes ? '<aside class="p-notes" aria-label="발표자 메모"><h4>자기 말로 설명할 핵심</h4><div>' + s.notes.say + "</div><h4>가리켜 볼 코드</h4><div>" + s.notes.point + "</div><h4>예상 질문</h4><div>" + s.notes.expect + "</div><h4>답변의 근거</h4><div>" + s.notes.answer + '</div><h4>질문이 나오면 바로 가기</h4><div class="p-jumps">' + s.jumps.map(function (j) { return '<button class="p-jump" data-go="' + j[1] + '">' + esc(j[0]) + "</button>"; }).join("") + "</div></aside>" : "") + "</div>";
  }
  $("#present").addEventListener("click", function (e) {
    var t = e.target;
    var sc = t.closest("[data-scene]"); if (sc) { pIdx = +sc.getAttribute("data-scene"); drawPresent(); return; }
    var pn = t.closest("[data-pn]"); if (pn && !pn.disabled) { pIdx += +pn.getAttribute("data-pn"); drawPresent(); return; }
    if (t.closest("[data-pnotes]")) { pNotes = !pNotes; store.set("notes", pNotes); drawPresent(); return; }
    if (t.closest("[data-pexit]")) closePresent();
  });
  function presentKey(e) {
    var N = D.scenes.length;
    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { if (pIdx < N - 1) { pIdx++; drawPresent(); } e.preventDefault(); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { if (pIdx > 0) { pIdx--; drawPresent(); } e.preventDefault(); }
    else if (e.key === "Escape") closePresent();
    else if (e.key === "n" || e.key === "N") { pNotes = !pNotes; store.set("notes", pNotes); drawPresent(); }
    else if (e.key === "f" || e.key === "F") { try { document.documentElement.requestFullscreen().catch(function () {}); } catch (x) {} }
  }

  go((location.hash || "#home").slice(1), { fromHash: true, noHist: true });
})();
