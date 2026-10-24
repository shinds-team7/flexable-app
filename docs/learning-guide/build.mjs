// 텅장관리 학습 가이드 생성기.
// 저장소 파일에서 코드 발췌(줄 번호 포함)를 읽고, 내용(content/*.mjs)의 상호 링크·스키마·계산 시뮬레이터를 검증한 뒤
// 외부 의존 없는 HTML 한 장(out/guide.html)을 만든다. 검증이 하나라도 실패하면 파일을 쓰지 않는다.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = process.env.REPO || path.resolve(HERE, "..", "..");
const SCHEMA_DIR = path.join(HERE, "schema");
const errors = [];
const fail = (m) => errors.push(m);

const git = (cmd) => execSync(`git -C "${REPO}" ${cmd}`, { encoding: "utf8" }).trim();
const SHA = git("rev-parse HEAD");
const BRANCH = git("branch --show-current");
// 가이드 폴더 자체의 변경은 분석 대상 코드가 아니므로 빼고 본다
const DIRTY = git('status --porcelain -- . ":(exclude)docs/learning-guide"');
const COMMIT_DATE = git("log -1 --format=%ci");
const TRACKED = new Set(git("ls-files").split(/\r?\n/));

const fileCache = new Map();
function readLines(p) {
  if (!fileCache.has(p)) {
    if (!TRACKED.has(p)) fail(`추적되지 않는 파일: ${p}`);
    const full = path.join(REPO, p);
    if (!fs.existsSync(full)) {
      fail(`파일 없음: ${p}`);
      fileCache.set(p, []);
    } else fileCache.set(p, fs.readFileSync(full, "utf8").split(/\r?\n/));
  }
  return fileCache.get(p);
}
export function permalink(p, a, b) {
  const enc = p.split("/").map(encodeURIComponent).join("/");
  return `https://github.com/shinds-team7/flexable-app/blob/${SHA}/${enc}${a ? `#L${a}${b && b !== a ? `-L${b}` : ""}` : ""}`;
}
function findLine(p, anchor, { after, nth } = {}) {
  const lines = readLines(p);
  let startAt = 0;
  if (after) {
    const i = lines.findIndex((l) => l.includes(after));
    if (i < 0) {
      fail(`${p}: after 기준 '${after}' 없음`);
      return -1;
    }
    startAt = i + 1;
  }
  const hits = [];
  for (let i = startAt; i < lines.length; i++) if (lines[i].includes(anchor)) hits.push(i);
  if (!hits.length) {
    fail(`${p}: '${anchor}' 없음`);
    return -1;
  }
  if (nth === undefined && hits.length > 1) {
    fail(`${p}: '${anchor}'가 ${hits.length}번 나옴(after/nth 필요)`);
  }
  return hits[nth ?? 0];
}
/** 파일에서 기준 문자열이 있는 줄 번호(1부터). 내용 검증·줄 링크에 쓴다. */
export function lineOf(p, anchor, opts) {
  const i = findLine(p, anchor, opts);
  return i < 0 ? 0 : i + 1;
}

const LANG = { java: "java", ts: "ts", tsx: "ts", cjs: "js", mjs: "js", js: "js", sql: "sql", yml: "yaml", yaml: "yaml", json: "json", sh: "bash", md: "md" };
function langOf(p) {
  if (p.endsWith("Dockerfile")) return "docker";
  if (p.endsWith("Caddyfile")) return "caddy";
  return LANG[p.split(".").pop()] || "text";
}
function dedent(lines) {
  const ind = lines.filter((l) => l.trim()).map((l) => l.match(/^[\t ]*/)[0]);
  if (!ind.length) return lines;
  let common = ind[0];
  for (const s of ind) while (!s.startsWith(common)) common = common.slice(0, -1);
  return lines.map((l) => (l.startsWith(common) ? l.slice(common.length) : l)).map((l) => l.replace(/\t/g, "  "));
}

// ---------- 코드 발췌 ----------
const { SNIPPETS } = await import("./content/snippets.mjs");
const snippets = {};
for (const sp of SNIPPETS) {
  if (snippets[sp.id]) fail(`발췌 id 중복: ${sp.id}`);
  const lines = readLines(sp.path);
  let s, e;
  if (sp.whole) {
    s = 0;
    e = lines.length - 1;
    while (e > 0 && !lines[e].trim()) e--;
  } else {
    const m = findLine(sp.path, sp.from, { after: sp.after, nth: sp.nth });
    if (m < 0) continue;
    s = m + (sp.fromOffset || 0);
    if (sp.lines) e = s + sp.lines - 1;
    else if (sp.to) {
      let j = -1;
      for (let k = m; k < lines.length; k++)
        if (lines[k].includes(sp.to)) {
          j = k;
          break;
        }
      if (j < 0) {
        fail(`${sp.id}: 끝 기준 '${sp.to}' 없음`);
        continue;
      }
      e = j + (sp.toOffset || 0);
    } else {
      fail(`${sp.id}: 끝 지정 없음`);
      continue;
    }
  }
  if (e >= lines.length) fail(`${sp.id}: 파일 끝을 넘음`);
  let code = dedent(lines.slice(s, e + 1));
  let masked = false;
  for (const [re, rep] of sp.mask || []) {
    const before = code.join("\n");
    const after = before.replace(re, rep);
    if (after !== before) masked = true;
    code = after.split("\n");
  }
  snippets[sp.id] = {
    id: sp.id,
    path: sp.path,
    start: s + 1,
    end: e + 1,
    lang: sp.lang || langOf(sp.path),
    code: code.join("\n"),
    title: sp.title || "",
    url: permalink(sp.path, s + 1, e + 1),
    masked,
  };
}

// ---------- 내용 ----------
const ctx = { lineOf, permalink, snippets, SHA, BRANCH, DIRTY };
const ent = await import("./content/entities.mjs");
const { _stats: ENT_STATS, ...ENTITIES } = ent.build(ctx);
const { SCENARIO, simTests, SIM_SOURCE } = await import("./content/sim.mjs");
const sim = await import("./content/sim.mjs");
const flow = (await import("./content/flow.mjs")).build(ctx);
const views = (await import("./content/views.mjs")).build({ ...ctx, ENTITIES, SC: sim.scenarioNumbers() });
const scenes = (await import("./content/present.mjs")).build({ ...ctx, ENTITIES, SC: sim.scenarioNumbers() });

// ---------- 시뮬레이터 = 서버 규칙 검증(BudgetCalculatorTest 기대값) ----------
const simResults = simTests();
for (const r of simResults) if (!r.ok) fail(`시뮬레이터 불일치: ${r.name} — ${r.detail}`);

// ---------- 스키마 검증(H2에서 뽑은 최종 스키마와 비교) ----------
function csv(name) {
  const text = fs.readFileSync(path.join(SCHEMA_DIR, name), "utf8").trim().split(/\r?\n/);
  const head = JSON.parse("[" + text[0] + "]");
  return text.slice(1).map((line) => {
    const out = [];
    let cur = "",
      q = false,
      had = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') {
        q = true;
        had = true;
      } else if (ch === ",") {
        out.push(had ? cur : cur === "" ? null : cur);
        cur = "";
        had = false;
      } else cur += ch;
    }
    out.push(had ? cur : cur === "" ? null : cur);
    return Object.fromEntries(head.map((h, i) => [h, out[i]]));
  });
}
const schemaReport = { tables: 0, columns: 0, fks: 0, uniques: 0, indexes: 0 };
{
  const cols = csv("cols.csv");
  const cons = csv("cons.csv");
  const refs = csv("refs.csv");
  const idx = csv("idx.csv");
  const tables = ENTITIES.t;
  const h2Tables = [...new Set(cols.map((c) => c.table_name))];
  for (const tn of h2Tables) if (!tables[tn]) fail(`ERD에 없는 테이블: ${tn}`);
  for (const tn of Object.keys(tables)) if (!h2Tables.includes(tn)) fail(`H2에 없는 테이블: ${tn}`);
  for (const [tn, t] of Object.entries(tables)) {
    schemaReport.tables++;
    const hc = cols.filter((c) => c.table_name === tn);
    const names = hc.map((c) => c.column_name);
    const mine = t.columns.map((c) => c.name);
    if (names.join(",") !== mine.join(",")) fail(`${tn} 컬럼 순서/목록 불일치\n  H2: ${names}\n  가이드: ${mine}`);
    for (const c of t.columns) {
      const h = hc.find((x) => x.column_name === c.name);
      if (!h) continue;
      schemaReport.columns++;
      const nullable = h.is_nullable === "YES";
      if (nullable !== !!c.nullable) fail(`${tn}.${c.name} NULL 여부 불일치(H2 ${h.is_nullable})`);
      const hd = h.column_default == null ? null : String(h.column_default).toUpperCase();
      const md = c.default == null ? null : String(c.default).toUpperCase();
      if (hd !== md) fail(`${tn}.${c.name} 기본값 불일치(H2 ${hd}, 가이드 ${md})`);
    }
    // PK
    const pk = cons.filter((x) => x.table_name === tn && x.constraint_type === "PRIMARY KEY").map((x) => x.column_name);
    if (pk.join(",") !== t.pk.join(",")) fail(`${tn} PK 불일치(H2 ${pk}, 가이드 ${t.pk})`);
    // UNIQUE
    const uq = {};
    cons.filter((x) => x.table_name === tn && x.constraint_type === "UNIQUE").forEach((x) => (uq[x.constraint_name] = [...(uq[x.constraint_name] || []), x.column_name]));
    const mineU = Object.fromEntries((t.uniques || []).map((u) => [u.name, u.columns]));
    for (const [n, c] of Object.entries(uq)) {
      if (!mineU[n] || mineU[n].join(",") !== c.join(",")) fail(`${tn} UNIQUE ${n}(${c}) 불일치`);
      schemaReport.uniques++;
    }
    for (const n of Object.keys(mineU)) if (!uq[n]) fail(`${tn} UNIQUE ${n} 이 H2에 없음`);
    // FK
    const fk = {};
    cons.filter((x) => x.table_name === tn && x.constraint_type === "FOREIGN KEY").forEach((x) => (fk[x.constraint_name] = x.column_name));
    const mineF = Object.fromEntries((t.fks || []).map((f) => [f.name, f]));
    for (const [n, col] of Object.entries(fk)) {
      const r = refs.find((x) => x.constraint_name === n);
      const m = mineF[n];
      schemaReport.fks++;
      if (!m) {
        fail(`${tn} FK ${n} 가 가이드에 없음`);
        continue;
      }
      if (m.column !== col || m.refTable !== r.ref_table || m.refColumn !== r.ref_column || m.onDelete !== r.delete_rule)
        fail(`${tn} FK ${n} 불일치(H2 ${col}→${r.ref_table}.${r.ref_column} ${r.delete_rule})`);
    }
    for (const n of Object.keys(mineF)) if (!fk[n]) fail(`${tn} FK ${n} 이 H2에 없음`);
    // 이름 붙인 인덱스(CREATE INDEX로 만든 것)
    const named = {};
    idx.filter((x) => x.table_name === tn && x.index_name.startsWith("idx_")).forEach((x) => (named[x.index_name] = [...(named[x.index_name] || []), x.column_name]));
    const mineI = Object.fromEntries((t.indexes || []).map((i) => [i.name, i.columns]));
    for (const [n, c] of Object.entries(named)) {
      schemaReport.indexes++;
      if (!mineI[n] || mineI[n].join(",") !== c.join(",")) fail(`${tn} INDEX ${n}(${c}) 불일치`);
    }
    for (const n of Object.keys(mineI)) if (!named[n]) fail(`${tn} INDEX ${n} 이 H2에 없음`);
  }
}

// ---------- 링크 문법 해석 ----------
// {{a:id}} {{a:id|글자}} {{v:view}} {{v:view.anchor|글자}} {{snip:id}} {{b:code}} {{p:경로}} {{n:키}} {{g:용어}}
const TYPE_LABEL = { f: "기능", s: "화면", a: "API", c: "코드", t: "테이블", x: "테스트", g: "용어" };
const BADGES = {
  code: ["코드 확인", "구현 코드에서 직접 읽어 확인한 사실"],
  config: ["설정 파일", "설정·배포 파일에 정의된 구성(실제 운영 상태는 별도)"],
  doc: ["문서 기록", "문서(HANDOFF·FEATURES 등)에만 기록된 운영 현황. 이번에 확인하지 않음"],
  test: ["테스트 코드", "테스트 코드가 검증하도록 작성된 내용(읽은 것)"],
  ran: ["직접 실행", "이번 분석에서 직접 실행해 결과를 확인함(2026-10-24~25, 로컬; 항목별 실행 날짜 참고)"],
  ci: ["CI 확인", "2026-10-24 GitHub Actions에서 PR #128·#129·#130의 검사 통과를 확인함. 로컬 실행·머지·운영 배포를 뜻하지 않음"],
  infer: ["추론", "코드·설정을 근거로 한 설계 의도·동작 추론"],
  suggest: ["개선 제안", "검토해 볼 만한 제안(팀 결정 아님)"],
  unknown: ["미확인", "이번에 확인하지 못한 사항"],
};
const viewIds = new Set(views.map((v) => v.id));
const anchorIds = new Set();
for (const v of views) for (const m of (v.html || "").matchAll(/id="([A-Za-z0-9._~-]+)"/g)) anchorIds.add(m[1]);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const backlinks = {};
function addBack(target, from) {
  if (!from) return;
  (backlinks[target] ||= new Set()).add(from);
}
const SCN = sim.scenarioNumbers();
function resolve(html, owner) {
  if (!html) return html;
  return html.replace(/\{\{([a-z]+):([^}|]+)(?:\|([^}]*))?\}\}/g, (all, type, id, label) => {
    id = id.trim();
    if (type === "b") {
      const b = BADGES[id];
      if (!b) {
        fail(`${owner}: 알 수 없는 배지 ${id}`);
        return all;
      }
      return `<span class="badge b-${id}" title="${esc(b[1])}">${b[0]}</span>`;
    }
    if (type === "n") {
      const v = id.split(".").reduce((o, k) => (o == null ? o : o[k]), SCN);
      if (v === undefined) {
        fail(`${owner}: 숫자 키 없음 ${id}`);
        return all;
      }
      return typeof v === "number" ? v.toLocaleString("ko-KR") : esc(v);
    }
    if (type === "snip") {
      const sn = snippets[id];
      if (!sn) {
        fail(`${owner}: 발췌 없음 ${id}`);
        return all;
      }
      addBack("snip:" + id, owner);
      return `<div class="snip-slot" data-snip="${id}"${label ? ` data-note="${esc(label)}"` : ""}></div>`;
    }
    if (type === "p") {
      const [p, ln] = id.split("#L");
      if (!TRACKED.has(p) && !TRACKED.has(p.replace(/\/$/, "")) && ![...TRACKED].some((x) => x.startsWith(p.replace(/\/$/, "") + "/")))
        fail(`${owner}: 경로 없음 ${p}`);
      const url = TRACKED.has(p) ? permalink(p, ln ? +ln : 0) : `https://github.com/shinds-team7/flexable-app/tree/${SHA}/${p.split("/").map(encodeURIComponent).join("/")}`;
      return `<a class="path" href="${url}" target="_blank" rel="noopener" title="커밋 ${SHA.slice(0, 7)} 고정 링크(새 탭)">${esc(label || p + (ln ? ":" + ln : ""))}</a>`;
    }
    if (type === "v") {
      const [vid] = id.split(".");
      if (!viewIds.has(vid)) fail(`${owner}: 화면(섹션) 없음 ${id}`);
      if (id.includes(".") && !anchorIds.has(id) && !/^flow-tx\.(s\d+|q-[\w-]+)$/.test(id)) fail(`${owner}: 앵커 없음 ${id}`);
      const v = views.find((x) => x.id === vid);
      return `<a class="ref ref-v" href="#${id}" data-go="${id}">${esc(label || (v ? v.title : id))}</a>`;
    }
    const coll = ENTITIES[type];
    if (!coll) {
      fail(`${owner}: 알 수 없는 링크 종류 ${type}`);
      return all;
    }
    const e = coll[id];
    if (!e) {
      fail(`${owner}: ${TYPE_LABEL[type]} 없음 '${id}'`);
      return `<span class="ref broken">${esc(label || id)}</span>`;
    }
    addBack(`${type}.${id}`, owner);
    return `<a class="ref ref-${type}" href="#${type}.${id}" data-go="${type}.${id}" title="${TYPE_LABEL[type]}: ${esc(e.title)}">${esc(label || e.short || e.title)}</a>`;
  });
}
function deepResolve(obj, owner) {
  if (typeof obj === "string") return resolve(obj, owner);
  if (Array.isArray(obj)) return obj.map((x) => deepResolve(x, owner));
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = k === "id" || k === "title" || k === "short" ? v : deepResolve(v, owner);
    return out;
  }
  return obj;
}
const outEntities = {};
for (const [type, coll] of Object.entries(ENTITIES)) {
  outEntities[type] = {};
  for (const [id, e] of Object.entries(coll)) outEntities[type][id] = deepResolve(e, `${type}.${id}`);
}
const outViews = views.map((v) => deepResolve(v, v.id));
const outFlow = deepResolve(flow, "flow-tx");
const outScenes = deepResolve(scenes, "present");

// 엔티티 사이 관계(정방향 rel + 본문 링크의 역방향)
const relations = {};
for (const [type, coll] of Object.entries(ENTITIES))
  for (const [id, e] of Object.entries(coll)) {
    const key = `${type}.${id}`;
    for (const r of e.rel || []) {
      const [rt, ...rest] = r.split(".");
      const rid = rest.join(".");
      if (!ENTITIES[rt] || !ENTITIES[rt][rid]) fail(`${key}: rel 대상 없음 ${r}`);
      (relations[key] ||= new Set()).add(r);
      (relations[r] ||= new Set()).add(key);
    }
  }
for (const [target, froms] of Object.entries(backlinks))
  for (const f of froms) {
    if (target.startsWith("snip:")) continue;
    if (/^[fsactxg]\./.test(f) && f !== target) {
      (relations[target] ||= new Set()).add(f);
    }
  }
const relOut = Object.fromEntries(Object.entries(relations).map(([k, v]) => [k, [...v].sort()]));
const mentionedIn = {};
for (const [target, froms] of Object.entries(backlinks)) {
  const vs = [...froms].filter((f) => !/^[fsactxg]\./.test(f) && f !== "present");
  if (vs.length) mentionedIn[target] = [...new Set(vs.map((f) => f.split(".")[0]))];
}

// ---------- 검색 색인 ----------
const strip = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/\{\{[^}]+\}\}/g, " ").replace(/\s+/g, " ").trim();
const search = [];
for (const v of views) {
  search.push({ k: "섹션", go: v.id, t: v.title, s: v.group || "", x: strip(v.summary || "") });
  for (const m of (v.html || "").matchAll(/<h([23])[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g))
    search.push({ k: "소제목", go: m[2], t: strip(m[3]), s: v.title, x: "" });
}
for (const [type, coll] of Object.entries(ENTITIES))
  for (const [id, e] of Object.entries(coll)) {
    const extra = [e.kw || "", e.symbols ? e.symbols.join(" ") : "", e.path || "", e.route || "", e.columns ? e.columns.map((c) => c.name).join(" ") : ""].join(" ");
    search.push({ k: TYPE_LABEL[type], go: `${type}.${id}`, t: e.title, s: e.sub || "", x: (strip(e.summary || e.desc || "") + " " + extra).slice(0, 600) });
    if (type === "t") for (const c of e.columns) search.push({ k: "컬럼", go: `${type}.${id}`, t: `${id}.${c.name}`, s: c.type, x: strip(c.note || "") });
  }
for (const st of flow.steps) search.push({ k: "흐름 단계", go: `flow-tx.s${st.n}`, t: `${st.n}. ${st.title}`, s: st.track === "create" ? "거래 등록" : "거래 수정", x: strip(st.where || "") });
for (const q of flow.faq) search.push({ k: "질문", go: `flow-tx.${q.id}`, t: q.q, s: "거래 흐름 질문", x: "" });
// 발췌의 메서드·함수 이름도 그 파일의 코드 항목으로 찾게 한다
const symIndex = {};
for (const sn of Object.values(snippets)) {
  const names = new Set();
  for (const m of sn.code.matchAll(/(?:function|const|let)\s+([A-Za-z_]\w{2,})/g)) names.add(m[1]);
  for (const m of sn.code.matchAll(/\b(?:public|private|protected|static|void|long|int|boolean)\b[\w<>\[\], .]*?\s([a-z]\w{2,})\s*\(/g)) names.add(m[1]);
  const owner = Object.entries(ENTITIES.c).find(([, e]) => e.path === sn.path);
  for (const nm of names) {
    if (["return", "new", "if", "for", "while", "switch", "catch"].includes(nm)) continue;
    (symIndex[nm] ||= new Set()).add(owner ? `c.${owner[0]}` : `snip:${sn.id}`);
  }
}
for (const [nm, targets] of Object.entries(symIndex))
  for (const t of targets) if (t.startsWith("c.")) search.push({ k: "함수", go: t, t: nm, s: ENTITIES.c[t.slice(2)].title, x: "" });

if (errors.length) {
  console.error("검증 실패 " + errors.length + "건:\n- " + errors.join("\n- "));
  process.exit(1);
}

// ---------- 출력 ----------
const meta = {
  repo: "shinds-team7/flexable-app",
  branch: BRANCH,
  sha: SHA,
  commitDate: COMMIT_DATE,
  dirty: DIRTY ? "있음" : "없음",
  built: new Date().toISOString(),
  analysisDate: "2026-10-25",
  counts: {
    snippets: Object.keys(snippets).length,
    links: Object.values(backlinks).reduce((a, s) => a + s.size, 0),
    ...Object.fromEntries(Object.entries(ENTITIES).map(([k, v]) => [k, Object.keys(v).length])),
    schema: schemaReport,
    sim: simResults.length,
    mappings: ENT_STATS.mappings,
  },
};
const DATA = {
  meta,
  views: outViews.map(({ id, title, group, html, summary, crumb }) => ({ id, title, group, html, summary, crumb })),
  toc: (await import("./content/views.mjs")).TOC,
  e: outEntities,
  rel: relOut,
  mentioned: mentionedIn,
  snippets,
  flow: outFlow,
  scenes: outScenes,
  search,
  scenario: SCENARIO,
  simReport: simResults,
  badges: BADGES,
  files: [...TRACKED].filter((f) => f && !/\.(png|jpe?g|webp|mp4|gif|ttf|otf|ico|webm|mov|jar)$/i.test(f) && !f.startsWith("frontend/assets/")).sort(),
  fileUrl: `https://github.com/shinds-team7/flexable-app/blob/${SHA}/`,
};
const css = fs.readFileSync(path.join(HERE, "template", "style.css"), "utf8");
const js = fs.readFileSync(path.join(HERE, "template", "app.js"), "utf8");
const json = JSON.stringify(DATA).replace(/</g, "\\u003c");
const html = `<title>텅장관리 학습 가이드</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="텅장관리(Flex-able) 저장소를 처음 읽는 팀원을 위한 코드·DB·요청 흐름 학습 가이드">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;700&family=JetBrains+Mono:wght@400;600&display=swap">
<style>${css}</style>
<div id="app"></div>
<script id="guide-data" type="application/json">${json}</script>
<script>${SIM_SOURCE}</script>
<script>${js}</script>
`;
fs.mkdirSync(path.join(HERE, "out"), { recursive: true });
fs.writeFileSync(path.join(HERE, "out", "guide.html"), html);
fs.writeFileSync(path.join(HERE, "out", "report.json"), JSON.stringify(meta, null, 2));
console.log("OK", (html.length / 1024).toFixed(0) + "KB", JSON.stringify(meta.counts));
