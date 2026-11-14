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
const { parsePaymentNotice, extraPaymentSources } = load(
  "paymentNotifications/sources.ts",
);
const { maskNoticeText, maskedCaptureJson, maskedNoticeJson } = load(
  "paymentNotifications/mask.ts",
);

const shinhan = {
  id: "a".repeat(64),
  title: "신한카드 승인",
  body: "가*나님\n1,200원 일시불\n10/29 10:00\n가상커피\n누적 50,000원",
  postedAt: Date.parse("2026-10-29T10:00:10+09:00"),
  prepared: "",
};
const plain = (value) => JSON.parse(JSON.stringify(value));

test("old queue rows without a package and SOL Pay rows use the Shinhan parser; other apps are never parsed", () => {
  const expected = {
    approval: {
      title: "가상커피",
      amount: 1200,
      occurredAt: "2026-10-29T10:00:00+09:00",
    },
  };
  assert.deepEqual(plain(parsePaymentNotice(shinhan)), expected);
  assert.deepEqual(
    plain(
      parsePaymentNotice({ ...shinhan, packageName: "com.shcard.smartpay" }),
    ),
    expected,
  );
  assert.equal(
    parsePaymentNotice({ ...shinhan, packageName: "com.example.card" })
      .approval,
    undefined,
  );
  assert.deepEqual(plain(extraPaymentSources()).sort(), [
    "com.hyundaicard.appcard",
    "com.kbcard.cxh.appcard",
    "com.lcacApp",
    "kr.co.samsungcard.mpocket",
  ]);
});

test("each card app is read only by its own brand's parser", () => {
  const hyundai = {
    ...shinhan,
    title: "",
    body: "[현대카드]-승인\n김*수님\n1,500원(일시불)\n가상가게\n누적:354,220원",
    postedAt: Date.parse("2026-11-14T12:30:40+09:00"),
  };
  assert.equal(
    parsePaymentNotice({ ...hyundai, packageName: "com.hyundaicard.appcard" })
      .approval.title,
    "가상가게",
  );
  // 현대카드 알림이 삼성카드 앱에서 왔다고 하면 읽지 않는다
  assert.equal(
    parsePaymentNotice({ ...hyundai, packageName: "kr.co.samsungcard.mpocket" })
      .approval,
    undefined,
  );
  // 신한 알림도 다른 카드 앱 이름으로는 읽지 않는다
  assert.equal(
    parsePaymentNotice({ ...shinhan, packageName: "com.lcacApp" }).approval,
    undefined,
  );
});

test("masking hides names, card digits and long numbers but keeps amounts, dates and line breaks", () => {
  // 조사 자료의 과거 SMS 형식(가상 값)
  assert.equal(
    maskNoticeText(
      "신한카드승인 강*혜(9*0*) 04/27 21:31 (일시불)39,500원 (주)가상상점 누적688,800원",
    ),
    "신한카드승인 ○○○(****) 04/27 21:31 (일시불)39,500원 (주)가상상점 누적688,800원",
  );
  assert.equal(
    maskNoticeText("[신한체크승인] 가*나(0000)\n- 승인금액: 9,000원"),
    "[신한체크승인] ○○○(****)\n- 승인금액: 9,000원",
  );
  assert.equal(
    maskNoticeText("KB국민카드 2*5*\n정*욱님"),
    "KB국민카드 ****\n○○○님",
  );
  assert.equal(maskNoticeText("홍길동님 10,000원"), "○○○님 10,000원");
  assert.equal(
    maskNoticeText(
      "카드 1234-****-****-5678 계좌 12345678901 문의 1544-7000 010-1234-5678",
    ),
    "카드 ****-****-****-**** 계좌 *********** 문의 1544-7000 ***-****-****",
  );
  const json = maskedCaptureJson({
    packageName: "com.example.card",
    postedAt: Date.parse("2026-11-14T10:00:00+09:00"),
    title: "[가상카드] 승인",
    text: "김*수님\n1,500원(일시불)",
    bigText: "",
    textLines: "",
    subText: "",
    summary: false,
    ongoing: false,
  });
  assert.match(json, /"text": "○○○님\\n1,500원\(일시불\)"/);
  assert.match(json, /"packageName": "com.example.card"/);
});

test("unread card notices in the review list are shared with names and card digits masked", () => {
  const json = maskedNoticeJson({
    ...shinhan,
    packageName: "com.hyundaicard.appcard",
    title: "[현대카드] 승인",
    body: "김*수님 2*5* 1,500원 일시불",
  });
  assert.match(json, /"packageName": "com.hyundaicard.appcard"/);
  assert.match(json, /"body": "○○○님 \*\*\*\* 1,500원 일시불"/);
  assert.doesNotMatch(json, /"id"|"prepared"/);
});
