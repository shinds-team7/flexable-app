// 본문 작성 도우미. 모두 HTML 문자열을 돌려준다.
export const h2 = (id, t) => `<h2 id="${id}">${t}</h2>`;
export const h3 = (id, t) => `<h3 id="${id}">${t}</h3>`;
export const p = (t) => `<p>${t}</p>`;
export const basic = (title, body, open = false) =>
  `<details class="fold basic"${open ? " open" : ""}><summary><span class="fold-tag">기초</span>${title}</summary><div class="fold-body">${body}</div></details>`;
export const deep = (title, body) =>
  `<details class="fold deep"><summary><span class="fold-tag">상세</span>${title}</summary><div class="fold-body">${body}</div></details>`;
export const note = (kind, body) => `<div class="callout c-${kind}">${body}</div>`;
export const snip = (id, n) => `{{snip:${id}${n ? "|" + n : ""}}}`;
export const ul = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
export const ol = (items) => `<ol>${items.map((i) => `<li>${i}</li>`).join("")}</ol>`;
export const table = (head, rows, cls = "") =>
  `<div class="tbl-wrap"><table class="tbl ${cls}"><thead><tr>${head.map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((x) => `<td>${x}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
/** 확인 질문. 답은 접혀 있다. */
export const quiz = (items) =>
  `<div class="quiz"><div class="quiz-h">이해했는지 확인</div>${items
    .map(([q, a], i) => `<details class="qa"><summary><span class="qn">Q${i + 1}</span>${q}</summary><div class="qa-a">${a}</div></details>`)
    .join("")}</div>`;
/** 주제 하나를 정해진 순서(문제 → 기초 → 역할 → 코드 → 입출력 → 다음 → 확인)로 쓴다. */
export function topic(o) {
  const part = (label, body) => (body ? `<div class="part"><div class="part-l">${label}</div><div class="part-b">${body}</div></div>` : "");
  return `<section class="topic">${h2(o.id, o.title)}${o.lead ? p(o.lead) : ""}
${part("하려는 일·문제", o.problem)}
${o.basics ? `<div class="part"><div class="part-l">필요한 기초</div><div class="part-b">${o.basics}</div></div>` : ""}
${part("우리 프로젝트에서 맡은 역할", o.role)}
${part("실제 파일과 핵심 코드", o.code)}
${part("입력 → 처리 → 출력", o.io)}
${part("다음으로 이어지는 코드", o.next)}
${o.extra || ""}
${o.quiz ? quiz(o.quiz) : ""}</section>`;
}
/** 문제 → 코드 → 동작 → 지켜야 할 규칙 → 관련 테스트(+ 효과·추정 이유·제약) */
export function design(o) {
  const row = (label, body, cls = "") => (body ? `<div class="part ${cls}"><div class="part-l">${label}</div><div class="part-b">${body}</div></div>` : "");
  return `<section class="topic design">${h2(o.id, o.title)}
${row("문제", o.problem)}
${row("코드", o.code)}
${row("동작", o.how)}
${row("지켜야 할 규칙", o.rules)}
${row("관련 테스트", o.tests)}
${row("이 구조의 효과", o.effect)}
${row("추정되는 이유", o.why, "infer")}
${row("제약·검토할 점", o.limits, "limits")}
${o.extra || ""}${o.quiz ? quiz(o.quiz) : ""}</section>`;
}
export const steps = (items) =>
  `<ol class="steps">${items.map(([t, b]) => `<li><div class="st-t">${t}</div>${b ? `<div class="st-b">${b}</div>` : ""}</li>`).join("")}</ol>`;
export const lookNext = (look, next) => `<div class="looknext"><div><b>이 파일에서 볼 것</b>${look}</div><div><b>다음에 갈 곳</b>${next}</div></div>`;
