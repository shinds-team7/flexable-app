const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const ts = require("typescript");

const cache = {};
function load(file) {
  file = path.resolve(__dirname, "../src/service", file);
  if (cache[file]) return cache[file];
  const exports = {};
  cache[file] = exports;
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      Date,
      require: (name) => load(path.resolve(path.dirname(file), name + ".ts")),
    },
  );
  return exports;
}
const { parseCardNotice } = load("paymentNotifications/cards.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));
const notice = (body, postedAt, title = "") => ({
  id: "a".repeat(64),
  title,
  body,
  postedAt: Date.parse(postedAt),
  prepared: "",
});

// 2026-11-14 외부 조사의 공개 SMS 예시 모양(이름·가맹점·번호는 가짜 값으로 바꿈).
// 실제 앱 푸시 원문을 받으면 그 모양을 여기에 더하고 파서를 고친다.
test("삼성카드: 줄바꿈 형식(머리에 카드 끝번호, 일시·금액·할부·가맹점이 각 줄)", () => {
  const n = notice(
    "[Web발신]\n삼성가족카드승인1234\n03/24 18:45\n10,000원\n일시불\n가상우동",
    "2026-03-24T18:45:20+09:00",
  );
  assert.deepEqual(plain(parseCardNotice("SAMSUNG", n)), {
    approval: {
      title: "가상우동",
      amount: 10000,
      occurredAt: "2026-03-24T18:45:00+09:00",
    },
  });
});

test("현대카드: 일시가 없으면 받은 시각, 누적 금액은 결제 금액이 아님, [현대카드 Zero] 승인 머리도 받음", () => {
  const body =
    "[Web발신]\n[현대카드]-승인\n김*수님\n1,500원(일시불)\n가상익스프레스신림\n누적:354,220원";
  assert.deepEqual(
    plain(
      parseCardNotice("HYUNDAI", notice(body, "2026-11-14T12:30:40+09:00")),
    ),
    {
      approval: {
        title: "가상익스프레스신림",
        amount: 1500,
        occurredAt: "2026-11-14T12:30:00+09:00",
      },
    },
  );
  const zero = body.replace("[현대카드]-승인", "[현대카드 Zero] 승인");
  assert.equal(
    parseCardNotice("HYUNDAI", notice(zero, "2026-11-14T12:30:40+09:00"))
      .approval.title,
    "가상익스프레스신림",
  );
});

test("KB국민카드: 머리·이름 다음 일시·금액·가맹점·누적 순서(조사 자료의 순서 설명대로 만든 가정 형식)", () => {
  const n = notice(
    "KB국민카드 1*2*\n정*욱님\n11/14 09:05\n4,500원 일시불\n가상커피\n누적 50,000원",
    "2026-11-14T09:05:30+09:00",
  );
  assert.deepEqual(plain(parseCardNotice("KB", n)), {
    approval: {
      title: "가상커피",
      amount: 4500,
      occurredAt: "2026-11-14T09:05:00+09:00",
    },
  });
});

test("롯데카드: 한 줄 형식(머리 괄호 안 번호, 금액·할부·일시·가맹점·누적)", () => {
  const n = notice(
    "롯데OO(1*2*) 75,000원 일시불 08/16 10:30 가상백화점 본점 누적 754,000원",
    "2026-08-16T10:30:05+09:00",
  );
  assert.deepEqual(plain(parseCardNotice("LOTTE", n)), {
    approval: {
      title: "가상백화점 본점",
      amount: 75000,
      occurredAt: "2026-08-16T10:30:00+09:00",
    },
  });
});

test("할부·제목 줄에 카드사 이름이 있어도 읽는다", () => {
  const n = notice(
    "삼성카드승인1234\n11/14 19:00\n120,000원\n3개월\n가상전자",
    "2026-11-14T19:00:30+09:00",
    "삼성카드",
  );
  assert.equal(parseCardNotice("SAMSUNG", n).approval.amount, 120000);
});

test("취소·해외·다른 카드사·금액 여러 개·누적만·가맹점 불명확·오래된 일시는 기록하지 않는다", () => {
  const ok =
    "[현대카드]-승인\n김*수님\n1,500원(일시불)\n가상가게\n누적:354,220원";
  const at = "2026-11-14T12:30:40+09:00";
  for (const [brand, body] of [
    ["HYUNDAI", ok.replace("승인", "승인취소")],
    ["HYUNDAI", ok + "\n해외 USD"],
    ["SAMSUNG", ok],
    ["HYUNDAI", ok + "\n2,000원"],
    ["HYUNDAI", ok.replace("1,500원(일시불)", "누적 1,500원")],
    ["HYUNDAI", ok.replace("가상가게", "가상가게\n추가 안내 문구")],
    ["HYUNDAI", ok + "\n11/10 12:00"],
  ])
    assert.equal(
      parseCardNotice(brand, notice(body, at)).approval,
      undefined,
      `${brand} ${body}`,
    );
});
