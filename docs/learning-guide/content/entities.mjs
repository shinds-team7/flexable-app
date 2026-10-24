// 엔티티를 모으고 줄 번호를 붙인다. 줄 번호는 모두 실제 파일에서 찾는다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TABLES, GROUPS, ERD_LAYOUT } from "./e-tables.mjs";
import { APIS } from "./e-api.mjs";
import { CODE } from "./e-code.mjs";
import { FEATURES, SCREENS, TESTS, GLOSSARY } from "./e-misc.mjs";

const REPO = process.env.REPO || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export { GROUPS, ERD_LAYOUT };

export function build({ lineOf, permalink, snippets }) {
  const out = { f: {}, s: {}, a: {}, c: {}, t: {}, x: {}, g: {} };
  const problems = [];

  // 코드
  for (const [id, c] of Object.entries(CODE)) {
    const title = c.title || id;
    out.c[id] = { ...c, title, sub: `${c.layer} · ${c.path}`, url: permalink(c.path), snips: c.snips || [], rel: c.rel || [] };
  }
  // 테이블: 엔티티·리포지토리 코드와 잇는다
  for (const [name, t] of Object.entries(TABLES)) {
    const rel = [];
    if (t.entity && out.c[t.entity]) rel.push(`c.${t.entity}`);
    if (t.repo && out.c[t.repo]) rel.push(`c.${t.repo}`);
    out.t[name] = { ...t, title: name, sub: GROUPS.find((g) => g.id === t.group).title, rel, kw: (t.migrations || []).join(" ") };
  }
  // API: 컨트롤러 매핑 줄 번호
  const seen = new Set();
  for (const a of APIS) {
    const line = lineOf(a.file, a.anchor, { nth: a.nth });
    seen.add(`${a.file}:${line}`);
    out.a[a.id] = {
      ...a,
      title: `${a.method} ${a.path.replace(/^\/api\/v1/, "")}`,
      short: `${a.method} ${a.path.replace(/^\/api\/v1/, "")}`,
      sub: `${a.auth} · ${path.basename(a.file)}:${line}`,
      line,
      url: permalink(a.file, line),
      rel: [...(a.rel || []), ...(a.feature ? [`f.${a.feature}`] : [])],
      kw: `${a.method} ${a.path}`,
    };
  }
  // 컨트롤러의 모든 매핑이 API 목록에 있는지 검사
  const ctlDir = path.join(REPO, "backend/src/main/java/com/flexable/api");
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  let mappings = 0;
  for (const f of walk(ctlDir).filter((f) => f.endsWith(".java"))) {
    const rel = path.relative(REPO, f).split(path.sep).join("/");
    const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
    lines.forEach((l, i) => {
      if (/^\s*@(Get|Post|Put|Patch|Delete)Mapping\b/.test(l)) {
        mappings++;
        if (!seen.has(`${rel}:${i + 1}`)) problems.push(`API 목록에 없는 매핑: ${rel}:${i + 1} ${l.trim()}`);
      }
    });
  }
  // 기능·화면
  for (const [id, f] of Object.entries(FEATURES)) out.f[id] = { ...f, sub: "서비스 기능" };
  for (const [id, s] of Object.entries(SCREENS)) out.s[id] = { ...s, sub: `${s.route} · ${s.path.replace("frontend/src/", "")}`, url: permalink(s.path), kw: s.route };
  // 테스트: 메서드 줄 번호
  for (const [id, x] of Object.entries(TESTS)) {
    const methods = x.methods.map(([name, what]) => {
      const anchor = x.testAnchor ? `${x.testAnchor}${name}` : `void ${name}(`;
      const line = lineOf(x.path, anchor);
      return { name, what, line, url: permalink(x.path, line) };
    });
    out.x[id] = { ...x, title: x.title || id, sub: `${x.kind} · ${x.path.split("/").pop()}`, methods, url: permalink(x.path), kw: methods.map((m) => m.name).join(" ") };
  }
  for (const [id, g] of Object.entries(GLOSSARY)) out.g[id] = { ...g, sub: "용어", summary: g.def };

  // 발췌 존재 확인
  for (const c of Object.values(out.c)) for (const s of c.snips) if (!snippets[s]) problems.push(`코드 ${c.title}: 발췌 없음 ${s}`);
  if (problems.length) throw new Error(problems.join("\n"));
  out._stats = { mappings };
  return out;
}
