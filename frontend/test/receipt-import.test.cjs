// Runs the real src/service/receiptImport/parse.ts (transpiled) on OCR lines laid out like the four sample screens.
// Coordinates follow the pixel positions of the screenshots; text is what ML Kit is expected to return per line.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load() {
  const source = fs.readFileSync(
    require.resolve("../src/service/receiptImport/parse.ts"),
    "utf8",
  );
  const js = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const context = { exports: {}, Date };
  vm.runInNewContext(js, context);
  return context.exports;
}
const api = load();
// The module runs in a vm realm: copy results so deepEqual compares plain objects.
const plain = (v) => JSON.parse(JSON.stringify(v));
const parseReceipt = (l, t) => plain(api.parseReceipt(l, t));
const { resolveDate } = api;
const TODAY = "2026-10-26";
// rows: [y, [x, text], ...]
const lines = (rows) =>
  rows.flatMap(([y, ...cells]) => cells.map(([x, text]) => ({ x, y, text })));
const brief = (r) =>
  r.items.map((i) => [i.date.slice(5), i.title, i.type, i.amount]);

const TOSS1 = lines([
  [320, [50, "2,336,700원"]],
  [437, [180, "채우기"], [620, "보내기"]],
  [660, [40, "10월 26일"]],
  [735, [155, "스타벅스"], [675, "-5,500원"]],
  [777, [155, "체크카드"], [610, "잔액 2,336,700원"]],
  [868, [155, "홍길동"], [637, "+100,000원"]],
  [910, [155, "내 신한계좌에서 이체"], [610, "잔액 2,342,200원"]],
  [1003, [40, "10월 25일"]],
  [1080, [155, "쿠팡"], [655, "+32,900원"]],
  [1122, [155, "체크카드 취소 · 환불"], [610, "잔액 2,242,200원"]],
  [1217, [155, "쿠팡"], [660, "-32,900원"]],
  [1261, [155, "체크카드 결제"], [610, "잔액 2,209,300원"]],
  [1356, [40, "10월 24일"]],
  [1433, [155, "CU 광화문점"], [677, "-7,800원"]],
  [1475, [155, "체크카드"], [610, "잔액 2,242,200원"]],
  [1568, [155, "홍길동"], [640, "-500,000원"]],
  [1610, [155, "내 카카오뱅크 계좌로 이체"], [610, "잔액 2,250,000원"]],
  [1687, [40, "10월 23일"]],
  [1750, [155, "급여"], [605, "+2,500,000원"]],
  [1792, [155, "입금"], [610, "잔액 2,750,000원"]],
  [1810, [345, "테스트용 가상 내역"]],
]);
// KB account inside Toss: dark, date only on the first row of a day, income has no sign.
const TOSS2 = lines([
  [320, [60, "2,143,200원"]],
  [830, [45, "전체"]],
  [930, [45, "10.26"], [150, "CU 광화문점"], [660, "-6,800원"]],
  [975, [150, "체크카드"], [655, "2,143,200원"]],
  [1050, [150, "홍길동"], [635, "200,000원"]],
  [1098, [150, "내 토스뱅크 계좌에서 이체"], [662, "2,150,000원"]],
  [1182, [45, "10.25"], [150, "이마트"], [660, "48,600원"]],
  [1228, [150, "체크카드 취소 · 환불"], [657, "1,950,000원"]],
  [1306, [150, "이마트"], [645, "-48,600원"]],
  [1352, [150, "체크카드 결제"], [657, "1,901,400원"]],
  [1433, [45, "10.24"], [150, "홍길동"], [620, "-700,000원"]],
  [1480, [150, "내 신한계좌로 이체"], [657, "1,950,000원"]],
  [1562, [45, "10.23"], [150, "급여"], [615, "2,500,000원"]],
  [1607, [150, "입금"], [657, "2,650,000원"]],
  [1795, [355, "테스트용 가상 내역"]],
]);
const KAKAOBANK = lines([
  [330, [280, "홍길동의 통장"]],
  [570, [190, "이체"], [560, "가져오기"]],
  [743, [40, "3개월 · 전체 · 최신순"]],
  [868, [37, "10.26"], [160, "CU 광화문점"], [668, "-6,800원"]],
  [914, [160, "체크카드"], [590, "잔액 2,143,200원"]],
  [1030, [37, "10.26"], [160, "홍길동"], [627, "+200,000원"]],
  [1080, [160, "내 토스뱅크 계좌에서"], [590, "잔액 2,150,000원"]],
  [1196, [37, "10.25"], [160, "이마트"], [652, "+48,600원"]],
  [1245, [160, "체크카드 취소 · 환불"], [590, "잔액 1,950,000원"]],
  [1370, [37, "10.25"], [160, "이마트"], [652, "-48,600원"]],
  [1418, [160, "체크카드 결제"], [590, "잔액 1,901,400원"]],
  [1538, [37, "10.24"], [160, "홍길동"], [632, "-700,000원"]],
  [1587, [160, "내 신한계좌로 이체"], [590, "잔액 1,950,000원"]],
  [1704, [37, "10.23"], [160, "급여"], [606, "+2,500,000원"]],
  [1752, [160, "타행입금"], [590, "잔액 2,650,000원"]],
]);
const KAKAOPAY = lines([
  [250, [180, "내역"], [555, "카드만들기"]],
  [355, [295, "10월 · 페이머니"]],
  [453, [36, "26일 월요일"], [203, "+60,500원"]],
  [551, [150, "송금 받기 | 김민지 → 카카오페이머니"]],
  [604, [150, "+15,000원"]],
  [718, [150, "송금 | 카카오페이머니 → 홍길동(내 국민계좌)"]],
  [770, [150, "-50,000원"]],
  [885, [150, "충전 | 홍길동(내 신한계좌) → 카카오페이머니"]],
  [936, [150, "+100,000원"]],
  [1052, [150, "결제 | 메가MGC커피"]],
  [1103, [150, "-4,500원"]],
  [1220, [36, "25일 일요일"], [197, "0원"]],
  [1318, [150, "결제취소 · 환불 | 카카오톡 선물하기"]],
  [1369, [150, "+18,000원"]],
  [1486, [150, "결제 | 카카오톡 선물하기"]],
  [1537, [150, "-18,000원"]],
]);

test("toss: date headers, signs and balance chain", () => {
  const r = parseReceipt(TOSS1, TODAY);
  assert.equal(r.source, "toss");
  assert.deepEqual(brief(r), [
    ["10-26", "스타벅스", "EXPENSE", 5500],
    ["10-26", "홍길동", "INCOME", 100000],
    ["10-25", "쿠팡", "INCOME", 32900],
    ["10-25", "쿠팡", "EXPENSE", 32900],
    ["10-24", "CU 광화문점", "EXPENSE", 7800],
    ["10-24", "홍길동", "EXPENSE", 500000],
    ["10-23", "급여", "INCOME", 2500000],
  ]);
  assert.ok(r.items.every((i) => i.review.length === 0));
  assert.equal(r.items[0].date, "2026-10-26");
});

test("toss: own transfers and refunds are flagged, not dropped", () => {
  const r = parseReceipt(TOSS1, TODAY);
  assert.deepEqual(
    r.items.map((i) => [i.ownTransfer, i.refund]),
    [
      [false, false],
      [true, false],
      [false, true],
      [false, false],
      [false, false],
      [true, false],
      [false, false],
    ],
  );
});

test("toss (dark, left date column): dates carry over and signs come from the balance", () => {
  const r = parseReceipt(TOSS2, TODAY);
  assert.equal(r.source, "toss");
  assert.deepEqual(brief(r), [
    ["10-26", "CU 광화문점", "EXPENSE", 6800],
    ["10-26", "홍길동", "INCOME", 200000],
    ["10-25", "이마트", "INCOME", 48600],
    ["10-25", "이마트", "EXPENSE", 48600],
    ["10-24", "홍길동", "EXPENSE", 700000],
    ["10-23", "급여", "INCOME", 2500000],
  ]);
  assert.ok(r.items.every((i) => i.review.length === 0));
  assert.equal(r.items[2].refund, true);
});

test("kakaobank: every row has its own date", () => {
  const r = parseReceipt(KAKAOBANK, TODAY);
  assert.equal(r.source, "kakaobank");
  assert.deepEqual(brief(r), [
    ["10-26", "CU 광화문점", "EXPENSE", 6800],
    ["10-26", "홍길동", "INCOME", 200000],
    ["10-25", "이마트", "INCOME", 48600],
    ["10-25", "이마트", "EXPENSE", 48600],
    ["10-24", "홍길동", "EXPENSE", 700000],
    ["10-23", "급여", "INCOME", 2500000],
  ]);
  assert.ok(r.items.every((i) => i.review.length === 0));
});

test("kakaopay: amount sits under the title, no balance column", () => {
  const r = parseReceipt(KAKAOPAY, TODAY);
  assert.equal(r.source, "kakaopay");
  assert.deepEqual(brief(r), [
    ["10-26", "김민지", "INCOME", 15000],
    ["10-26", "홍길동", "EXPENSE", 50000],
    ["10-26", "홍길동", "INCOME", 100000],
    ["10-26", "메가MGC커피", "EXPENSE", 4500],
    ["10-25", "카카오톡 선물하기", "INCOME", 18000],
    ["10-25", "카카오톡 선물하기", "EXPENSE", 18000],
  ]);
  assert.deepEqual(
    r.items.map((i) => [i.ownTransfer, i.refund]),
    [
      [false, false],
      [true, false],
      [true, false],
      [false, false],
      [false, true],
      [false, false],
    ],
  );
});

test("a balance that does not match asks for review", () => {
  const broken = KAKAOBANK.map((l) =>
    l.text === "잔액 2,150,000원" ? { ...l, text: "잔액 2,100,000원" } : l,
  );
  const r = parseReceipt(broken, TODAY);
  assert.ok(r.items[0].review.length > 0);
});

test("a screen with no transactions is not supported", () => {
  const r = parseReceipt(lines([[100, [40, "설정"]]]), TODAY);
  assert.equal(r.source, null);
  assert.deepEqual(r.items, []);
});

test("year is the nearest past occurrence", () => {
  assert.equal(resolveDate(12, 30, "2027-01-02"), "2026-12-30");
  assert.equal(resolveDate(1, 2, "2027-01-02"), "2027-01-02");
  assert.equal(resolveDate(10, 27, "2026-10-26"), "2025-10-27");
});

// ML Kit may return a whole visual row as one line; the result must not change.
const merge = (input) => {
  const byY = new Map();
  for (const l of input) byY.set(l.y, [...(byY.get(l.y) ?? []), l]);
  return [...byY].map(([y, row]) => ({
    y,
    x: Math.min(...row.map((l) => l.x)),
    text: row
      .sort((a, b) => a.x - b.x)
      .map((l) => l.text)
      .join(" "),
  }));
};

for (const [name, fixture] of [
  ["toss", TOSS1],
  ["toss (dark)", TOSS2],
  ["kakaobank", KAKAOBANK],
  ["kakaopay", KAKAOPAY],
]) {
  test(`${name}: rows merged into single OCR lines parse the same`, () => {
    assert.deepEqual(
      parseReceipt(merge(fixture), TODAY),
      parseReceipt(fixture, TODAY),
    );
  });
}

test("an unknown direction is flagged with the shared review message", () => {
  const r = parseReceipt(
    lines([
      [100, [40, "10.26"], [150, "이마트"], [660, "48,600원"]],
      [150, [150, "체크카드"], [657, "2,000,000원"]],
    ]),
    TODAY,
  );
  assert.equal(r.items[0].type, null);
  assert.deepEqual(r.items[0].review, [api.REVIEW_TYPE]);
});

test("toss: spaces inside dotted dates do not discard every transaction", () => {
  const spaced = TOSS2.map((l) => ({
    ...l,
    text: l.text.replace(/^(\d+)\.(\d+)$/, "$1. $2"),
  }));
  assert.deepEqual(parseReceipt(spaced, TODAY), parseReceipt(TOSS2, TODAY));
  assert.deepEqual(
    parseReceipt(merge(spaced), TODAY),
    parseReceipt(TOSS2, TODAY),
  );
});

test("toss: date, sign and currency fragments are joined only inside their row", () => {
  const fragments = TOSS2.flatMap((l) => {
    const date = l.text.match(/^(\d+)\.(\d+)$/);
    if (date)
      return [
        { ...l, text: `${date[1]}.` },
        { ...l, x: l.x + 1, text: date[2] },
      ];
    const amount = l.text.match(/^([+\-])?([\d,]+)원$/);
    if (!amount) return [l];
    return [amount[1], amount[2], "원"].filter(Boolean).map((text, i) => ({
      ...l,
      x: l.x + i,
      text,
    }));
  });
  assert.deepEqual(parseReceipt(fragments, TODAY), parseReceipt(TOSS2, TODAY));
});

// Layout and punctuation variants observed by local Windows OCR. All titles and amounts are synthetic;
// these are not captured Android ML Kit output or the user's transaction data.
const KAKAOPAY_OCR_VARIANTS = lines([
  [318, [230, "내역"], [704, "카드만들기"]],
  [450, [375, "10월 • 페이머니"]],
  [574, [46, "24일 토요일 -42,000원"]],
  [700, [192, "송금 1 카카오페이머니 → 가상친구"]],
  [768, [193, "-42,000원"]],
  [942, [46, "20일 화요일 -4,800원"]],
  [1066, [192, "송금 I 카카오페이머니 → 내 국민계좌"]],
  [1101, [71, "PPay"]],
  [1134, [193, "-5,100원"]],
  [1286, [194, "My 구독 - 가상클라우드"]],
  [1320, [71, "PPay"]],
  [1351, [193, "-900원"]],
  [1504, [194, "My 구독 - 가상이모티콘"]],
  [1539, [71, ",Pay"]],
  [1572, [193, "-3,900원"]],
  [1746, [48, "18일 일요일 -10,000원"]],
  [1870, [192, "송금 l 카카오페이머니 → 가상친구"]],
  [1938, [193, "-10,000원"]],
  [2112, [48, "17일 토요일 -22,000원"]],
  [2236, [192, "송금 1 카카오페이머니 → 내 국민계좌"]],
  [2271, [71, "PPay"]], // Bottom is cut off: no amount for this transaction.
]);

test("kakaopay: bullet header, misread dividers, subscriptions and logo rows", () => {
  const r = parseReceipt(KAKAOPAY_OCR_VARIANTS, TODAY);
  assert.equal(r.source, "kakaopay");
  assert.deepEqual(brief(r), [
    ["10-24", "가상친구", "EXPENSE", 42000],
    ["10-20", "내 국민계좌", "EXPENSE", 5100],
    ["10-20", "가상클라우드", "EXPENSE", 900],
    ["10-20", "가상이모티콘", "EXPENSE", 3900],
    ["10-18", "가상친구", "EXPENSE", 10000],
  ]);
  assert.ok(r.items.every((i) => i.review.length === 0));
  assert.equal(r.items[1].ownTransfer, true);
});

test("kakaopay: month and day spacing and a full-width divider are accepted", () => {
  const spaced = KAKAOPAY.map((l) => ({
    ...l,
    text: l.text
      .replace("10월 ·", "10 월 ㆍ")
      .replace(/(\d+)일/g, "$1 일")
      .replaceAll(" | ", " │ "),
  }));
  assert.deepEqual(parseReceipt(spaced, TODAY), parseReceipt(KAKAOPAY, TODAY));
});

test("kakaopay: inline amount does not become part of the merchant title", () => {
  const r = parseReceipt(
    lines([
      [100, [40, "10월 • 페이머니"]],
      [150, [40, "24일 토요일 -900원"]],
      [200, [150, "My 구독 - 가상서비스 -900원"]],
    ]),
    TODAY,
  );
  assert.deepEqual(brief(r), [["10-24", "가상서비스", "EXPENSE", 900]]);
});

test("kakaopay: a spaced refund label keeps its refund badge with a bullet divider", () => {
  const r = parseReceipt(
    lines([
      [100, [40, "10월 • 페이머니"]],
      [150, [40, "24일 토요일 +900원"]],
      [200, [150, "결제 취소 • 환불 │ 가상상점"]],
      [250, [150, "+900원"]],
    ]),
    TODAY,
  );
  assert.deepEqual(brief(r), [["10-24", "가상상점", "INCOME", 900]]);
  assert.equal(r.items[0].refund, true);
});

test("kakaopay: missing amounts never borrow another row or date total", () => {
  const r = parseReceipt(
    lines([
      [100, [40, "10월 • 페이머니"]],
      [150, [40, "24일 토요일 -900원"]],
      [200, [150, "송금 | 카카오페이머니 → 금액없는항목"]],
      [250, [150, "확인할 수 없는 다른 내용"]],
      [300, [150, "-9,000원"]],
      [350, [150, "My 구독 - 다음날금액도없는항목"]],
      [400, [40, "23일 금요일 -800원"]],
      [450, [150, "결제 | 정상항목"]],
      [500, [150, "-800원"]],
    ]),
    TODAY,
  );
  assert.deepEqual(brief(r), [["10-23", "정상항목", "EXPENSE", 800]]);
});

test("OCR digit guesses never rewrite a merchant number or an unreadable amount", () => {
  const r = parseReceipt(
    lines([
      [100, [40, "10월 • 페이머니"]],
      [150, [40, "24일 토요일 -500원"]],
      [200, [150, "결제 | 상품 24 -500원"]],
      [250, [150, "송금 1 일반상호"]],
      [300, [150, "-900원"]],
      [350, [150, "결제 | 숫자오인식"]],
      [400, [150, "-1기125원"]],
    ]),
    TODAY,
  );
  assert.deepEqual(brief(r), [["10-24", "상품 24", "EXPENSE", 500]]);
});

// Actual Android OCR-2 line order/coordinates and missing punctuation/currency suffixes.
// Dates, amounts and names below are synthetic because the shared diagnostic masks all numbers and names.
const KAKAOPAY_ANDROID = lines([
  [49, [74, "4:00 x"]],
  [575, [30, "26일 월요일 -42,000원"]],
  [1102, [71, "mark"]],
  [1321, [71, "mark"]],
  [316, [229, "내역"]],
  [1540, [71, "mark"]],
  [942, [46, "25일 일요일 -4,800원"]],
  [768, [199, "-42,000"]],
  [2272, [72, "mark"]],
  [445, [354, "10월 페이머니"]],
  [698, [179, "송금 카카오페이머니 가상친구"]],
  [1064, [179, "송금 카카오페이머니 가상계좌"]],
  [1131, [191, "-5,100"]],
  [1284, [194, "My 구독 - 가상클라우드"]],
  [1351, [193, "-900"]],
  [1505, [194, "My 구독- 가상이모티콘"]],
  [1571, [198, "-3,900"]],
  [1746, [48, "24일 토요일 -10,000원"]],
  [1937, [198, "-10,000"]],
  [2112, [48, "23일 금요일 -22,000원"]],
  [318, [705, "카드만들기"]],
  [1868, [193, "송금 가상수단 - 가상친구"]],
  [50, [802, "xx00"]],
  [2235, [192, "송금 카카오페이머니 가상계좌"]],
  [2291, [202, "xx0x"]],
]);

test("Android kakaopay: no month dot, no payment pipe or won suffix, and unreadable left logos", () => {
  const result = parseReceipt(KAKAOPAY_ANDROID, TODAY);
  assert.equal(result.source, "kakaopay");
  assert.deepEqual(brief(result), [
    ["10-26", "카카오페이머니 가상친구", "EXPENSE", 42000],
    ["10-25", "카카오페이머니 가상계좌", "EXPENSE", 5100],
    ["10-25", "가상클라우드", "EXPENSE", 900],
    ["10-25", "가상이모티콘", "EXPENSE", 3900],
    ["10-24", "가상수단 - 가상친구", "EXPENSE", 10000],
  ]);
  assert.ok(result.items.every((item) => item.review.length === 0));
  const counts = api.receiptDiagnostics(KAKAOPAY_ANDROID);
  assert.equal(counts.payMonths, 1);
  assert.equal(counts.payDetails, 6);
  assert.equal(counts.amounts, 9);
});

test("missing won is accepted only below a known kakaopay transaction, never a time, unsigned number or date total", () => {
  const result = parseReceipt(
    lines([
      [100, [200, "10월 페이머니"]],
      [200, [40, "26일 월요일 -9,000원"]],
      [300, [190, "송금 가상친구"]],
      [350, [190, "21:02"]],
      [400, [190, "-9,000"]],
      [500, [190, "My 구독 - 가상서비스"]],
      [550, [190, "12345678"]],
      [600, [190, "송금 다른친구"]],
      [650, [40, "25일 일요일 -1,000원"]],
      [700, [190, "결제 가상상점"]],
      [750, [190, "-1,000"]],
    ]),
    TODAY,
  );
  assert.deepEqual(brief(result), [["10-25", "가상상점", "EXPENSE", 1000]]);
});

test("a missing payment divider does not misclassify a Toss merchant as kakaopay", () => {
  const result = parseReceipt(
    lines([
      [100, [100, "채우기"], [400, "보내기"]],
      [200, [40, "10.26"], [150, "송금 가상상점"], [600, "-900원"]],
      [250, [150, "체크카드"], [600, "10,000원"]],
    ]),
    TODAY,
  );
  assert.equal(result.source, "toss");
  assert.deepEqual(brief(result), [["10-26", "송금 가상상점", "EXPENSE", 900]]);
});

// Android Toss OCR-2 coordinates, with synthetic text and numbers. x stands for an unreadable currency glyph.
const TOSS_ANDROID = lines([
  [47, [51, "4:00 xxx"]],
  [169, [52, "← 가상통장"]],
  [343, [43, "10.25 가상카드출금"], [810, "-20,000"]],
  [404, [187, "21:02"], [930, "300원"]],
  [522, [187, "가상친구"], [826, "20,000"]],
  [586, [188, "21:02"], [898, "20,300"]],
  [704, [40, "10.23 가상상점1"], [833, "-1,000x"]],
  [766, [188, "23:38"], [931, "300원"]],
  [884, [162, "가상상점24"], [835, "-2,000x"]],
  [948, [188, "19:31"], [900, "1,3000x"]],
  [1067, [187, "가상상점25"], [839, "-3,000"]],
  [1127, [188, "12:54"], [921, "3,300"]],
  [1246, [187, "가상페이"], [845, "-4,000x"]],
  [1309, [188, "08:10"], [892, "06,3000"]],
  [1430, [43, "10.22 가상택시0"], [830, "-10,0000"]],
  [1490, [188, "02:50"], [888, "10,300"]],
  [1610, [187, "가상노래방"], [834, "-5,000"]],
  [1672, [188, "01:40"], [879, "20,300xx"]],
  [1791, [42, "10.21 가상매장"], [845, "-6,000x"]],
  [1853, [188, "20:57"], [879, "25,300"]],
  [1972, [189, "가상커피"], [837, "-7,000"]],
  [2034, [188, "13:33"], [877, "31,300x"]],
  [2164, [206, "채우기"], [703, "보내기"]],
]);

test("Android Toss: paired time and right balance column recover missing or unreadable won, with mandatory review", () => {
  const result = parseReceipt(TOSS_ANDROID, TODAY);
  assert.equal(result.source, "toss");
  assert.deepEqual(brief(result), [
    ["10-25", "가상카드출금", "EXPENSE", 20000],
    ["10-25", "가상친구", "INCOME", 20000],
    ["10-23", "가상상점1", "EXPENSE", 1000],
    ["10-23", "가상상점24", "EXPENSE", 2000],
    ["10-23", "가상상점25", "EXPENSE", 3000],
    ["10-23", "가상페이", "EXPENSE", 4000],
    ["10-22", "가상노래방", "EXPENSE", 5000],
    ["10-21", "가상매장", "EXPENSE", 6000],
    ["10-21", "가상커피", "EXPENSE", 7000],
  ]);
  assert.ok(result.items.every((item) => item.review.length > 0));
  assert.equal(result.items[3].balance, null);
  assert.equal(result.items[5].balance, null);
  // A misread digit after the comma is never removed or silently turned into the original amount.
  assert.equal(
    result.items.some((item) => item.title === "가상택시0"),
    false,
  );
});

test("Android Toss: header cards, account digits and rates before the first date are never imported", () => {
  const header = lines([
    [313, [56, "가상통장 12345678901234"]],
    [402, [43, "300원"]],
    [524, [107, "2.5x"]],
    [727, [234, "가상 혜택 1x xx"], [910, "xx"]],
    [865, [205, "가상 10x xx + 20x xx"]],
    [921, [190, "가상 카드 혜택"]],
    [1052, [58, "전체"]],
  ]);
  const visible = TOSS_ANDROID.filter(
    (line) => line.y >= 343 && line.y <= 1129,
  ).map((line) => ({ ...line, y: line.y + 842 }));
  const result = parseReceipt(
    [
      ...header,
      ...visible,
      ...lines([[2164, [206, "채우기"], [703, "보내기"]]]),
    ],
    TODAY,
  );
  assert.equal(result.items.length, 5);
  assert.equal(result.items[0].title, "가상카드출금");
});

test("missing bank currency needs a time and a separate right balance column; random numeric text stays rejected", () => {
  const result = parseReceipt(
    lines([
      [100, [40, "10.25 가상상점"], [810, "-2,000"]],
      [160, [187, "다른 내용"], [930, "300"]],
      [250, [187, "가상항목"], [810, "-3,000"]],
      [310, [187, "21:00"], [250, "300"]],
      [400, [187, "채우기"]],
    ]),
    TODAY,
  );
  assert.equal(result.items.length, 0);
});
