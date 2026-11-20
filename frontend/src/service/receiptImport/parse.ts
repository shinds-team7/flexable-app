// 거래내역 스크린샷의 OCR 줄(텍스트와 좌표)을 거래 후보로 바꾼다. expo·ML Kit 모듈을 쓰지 않아 단위 테스트에서 바로 돌린다.
// 지원하는 화면: 토스(날짜 머리글형 / 왼쪽 날짜 열형), 카카오뱅크, 카카오페이. 그 밖의 은행·카드 앱은 "원"이 붙은 금액 행을
// 일반 규칙(parseGeneric)으로 읽는다. 못 읽은 값은 채우지 않고 review에 이유를 남긴다.

export type OcrLine = { text: string; x: number; y: number };
export type ImportSource = "toss" | "kakaobank" | "kakaopay" | "other";
export type ImportCandidate = {
  /** "YYYY-MM-DD". 연도는 화면에 없어 오늘 기준 가장 가까운 과거로 추정한다 */
  date: string;
  title: string;
  amount: number;
  type: "EXPENSE" | "INCOME" | null;
  balance: number | null;
  ownTransfer: boolean;
  refund: boolean;
  /** 사용자가 확인해야 하는 이유. 비어 있지 않으면 확인 전에는 저장하지 않는다 */
  review: string[];
};
export type ParseResult = {
  source: ImportSource | null;
  items: ImportCandidate[];
};

const AMOUNT = /^([+\-−–])?\s*(\d{1,3}(?:,\d{3})*|\d+)\s*원$/;
const PAY_BARE_AMOUNT = /^([+\-−–])\s*(\d{1,3}(?:,\d{3})*|\d+)$/;
// 토스 금액 열의 원 누락·글자 오인식용. 숫자와 쉼표는 고치지 않는다.
const BANK_LOOSE_AMOUNT =
  /^([+\-−–])?\s*(\d{1,3}(?:,\d{3})*|\d+)\s*[가-힣a-zA-Z]{0,2}$/;
const BANK_AMOUNT_SHAPE = /^[+\-−–]?\s*[\d,]+\s*[가-힣a-zA-Z]{0,2}$/;
// 원 없이 숫자만 읽힌 금액. Play 서비스 인식은 토스 금액 열의 원을 자주 빠뜨린다.
const BARE_AMOUNT = /^[+\-−–]?\s*[\d,]+$/;
const TIME = /^\d{1,2}:\d{2}$/;
const DATE_DOT = /^(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?$/;
const DATE_KOR = /^(\d{1,2})\s*월\s*(\d{1,2})\s*일$/;
const DATE_DAY = /^(\d{1,2})\s*일\s*[월화수목금토일]\s*요\s*일/;
const MONTH_HEAD =
  /^(\d{1,2})\s*월\s*(?:[·・•ㆍ]|(?:카카오\s*)?페이\s*머니(?:\s|$))/;
const PAY_ROW =
  /^(결제\s*취소\s*[·・•ㆍ]?\s*환불|결제|충전|송금\s*받기|송금|출금|입금)\s*[|｜│丨]\s*(.+)$/;
const PAY_LOGO = /^[p,]?pay$/i;
const OWN = /내\s*\S*\s*(계좌|통장)|\(내\s*[^)]*\)|충전/;
const REFUND = /취소\s*[·・•ㆍ]?\s*환불/;

const won = (m: RegExpMatchArray) => Number(m[2].replace(/[,\s]/g, ""));
const unsigned = (s: string) => s.replace(/^[+\-−–]\s*/, "");

export const REVIEW_TYPE = "입금인지 출금인지 확인이 필요해요";
export const REVIEW_DATE = "날짜가 인식되지 않았습니다";

/**
 * OCR이 한 줄로 합쳐 준 "10.26 CU 광화문점 -6,800원", "체크카드 잔액 2,336,700원" 같은 줄을
 * 날짜·내용·금액 조각으로 나눈다. 조각의 x는 줄 안의 대략적인 순서만 맞춘다.
 */
export function splitLines(lines: OcrLine[]): OcrLine[] {
  return lines.flatMap((line) => {
    const out: OcrLine[] = [];
    let rest = line.text.trim();
    let x = line.x;
    const date = rest.match(/^(\d{1,2}\s*\.\s*\d{1,2})\s+(\S.*)$/);
    if (date) {
      out.push({ text: date[1], x, y: line.y });
      rest = date[2];
      x += 1;
    }
    const amount = rest.match(
      /^(\S.*?)\s+([+\-−–]?\s*(?:\d{1,3}(?:,\d{3})+|\d+)\s*원)$/,
    );
    if (amount && !/^[+\-−–]?\s*[\d,]+$/.test(amount[1])) {
      out.push({ text: amount[1], x, y: line.y });
      out.push({
        text: amount[2].replace(/\s+/g, ""),
        x: x + 100000,
        y: line.y,
      });
    } else out.push({ text: rest, x, y: line.y });
    return out;
  });
}

/** y가 비슷한 줄을 한 행으로 묶고, 행 안에서는 왼쪽부터 정렬한다. */
export function toRows(input: OcrLine[], tolerance = 14): OcrLine[][] {
  const lines = splitLines(input);
  const sorted = [...lines].sort((a, b) => a.y - b.y);
  const rows: OcrLine[][] = [];
  for (const line of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last[0].y - line.y) <= tolerance) last.push(line);
    else rows.push([line]);
  }
  return rows.map((r) => joinFragments(r.sort((a, b) => a.x - b.x)));
}

/** 날짜와 금액의 기호가 별도 OCR 줄이어도 같은 시각적 행 안에서만 합친다. */
function joinFragments(input: OcrLine[]): OcrLine[] {
  const row = [...input];
  if (!DATE_DOT.test(row[0]?.text ?? "")) {
    for (const count of [2, 3]) {
      if (row.length < count) continue;
      const text = row
        .slice(0, count)
        .map((l) => l.text)
        .join("");
      if (!DATE_DOT.test(text)) continue;
      row.splice(0, count, { ...row[0], text });
      break;
    }
  }
  const end = row.length - 1;
  let amount = end;
  if (row[end]?.text === "원" && end > 0) {
    if (!AMOUNT.test(`${row[end - 1].text}원`)) return row;
    amount--;
  } else if (!AMOUNT.test(row[end]?.text ?? "")) return row;
  if (/^[+\-−–]$/.test(row[amount - 1]?.text ?? "")) amount--;
  if (amount < end) {
    row.splice(amount, row.length - amount, {
      ...row[amount],
      text: row
        .slice(amount)
        .map((l) => l.text)
        .join(""),
    });
  }
  return row;
}

function payDetail(
  text: string,
  allowMissingDivider = false,
): { kind: string; detail: string } | null {
  // 1/I/l은 금액이나 일반 상호에서 바꾸지 않고, 송금 문구와 페이머니 사이의 구분선일 때만 허용한다.
  const normalized = text.replace(
    /^(송금\s*받기|송금|충전|출금|입금)\s+[1Il]\s+(?=카카오\s*페이\s*머니)/,
    "$1 | ",
  );
  const pay = normalized.match(PAY_ROW);
  if (pay) return { kind: pay[1].replace(/\s+/g, ""), detail: pay[2].trim() };
  const subscription = text.match(/^My\s*구독\s*[-－–—·•]\s*(.+)$/i);
  if (subscription) return { kind: "결제", detail: subscription[1].trim() };
  // 화면이 카카오페이로 판별된 뒤에만 구분선 누락을 허용한다. 다른 은행의 송금 상호는 그대로 둔다.
  const missing = allowMissingDivider
    ? text.match(
        /^(결제\s*취소\s*[·・•ㆍ]?\s*환불|송금\s*받기|송금|결제|충전|출금|입금)\s+(?![1Il]\s)(\S.*)$/,
      )
    : null;
  return missing
    ? { kind: missing[1].replace(/\s+/g, ""), detail: missing[2].trim() }
    : null;
}

function payText(row: OcrLine[]): string {
  return row
    .filter((l) => !PAY_LOGO.test(l.text))
    .map((l) => l.text)
    .join(" ");
}

/** 월·일만 있는 날짜의 연도를 오늘 기준 가장 가까운 과거로 정한다. */
export function resolveDate(month: number, day: number, today: string) {
  const [y, m, d] = today.split("-").map(Number);
  const year = month > m || (month === m && day > d) ? y - 1 : y;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

function detect(rows: OcrLine[][]): ImportSource | null {
  const text = rows.map((r) => r.map((l) => l.text).join(" ")).join("\n");
  if (
    /카카오\s*페이\s*머니|카드\s*만들기/.test(text) ||
    rows.some((r) => payDetail(payText(r)))
  )
    return "kakaopay";
  // 거래 행의 "내 토스뱅크 계좌" 같은 문구가 섞이므로 화면 고유 문구만 본다.
  if (/입출금통장|가져오기/.test(text)) return "kakaobank";
  if (/채우기|보내기/.test(text)) return "toss";
  // 잔액 열이 있는 화면은 어느 쪽이든 같은 규칙으로 읽는다.
  if (/잔액/.test(text) || rows.some((r) => r.some((l) => AMOUNT.test(l.text))))
    return "toss";
  // 위아래를 자르면 앱 이름·버튼·원 단위가 모두 사라질 수 있다.
  // 날짜 뒤의 거래/시각/잔액 열이 맞을 때만 기존 토스 규칙으로 읽는다.
  let dated = false;
  let bankPairs = 0;
  const datedPair = rows.some((row, i) => {
    if (
      DATE_DOT.test(row[0]?.text ?? "") ||
      DATE_KOR.test(row.map((l) => l.text).join(" "))
    )
      dated = true;
    const pair =
      hasBankColumns(row, rows[i + 1] ?? []) &&
      BANK_LOOSE_AMOUNT.test(row[row.length - 1].text);
    if (pair) bankPairs++;
    return dated && pair;
  });
  // 날짜가 화면에 하나도 안 보여도 두 거래 이상의 금액·시각·잔액 열이
  // 맞으면 검토할 수 있다. 날짜는 사용자가 직접 고른다.
  return datedPair || bankPairs >= 2 ? "toss" : null;
}

/** 원 없는 금액을 화면 판별과 거래 해석에서 같은 행·열 조건으로 제한한다. */
function hasBankColumns(row: OcrLine[], subRow: OcrLine[]): boolean {
  if (row.length < 2 || subRow.length !== 2) return false;
  const amount = row[row.length - 1];
  const [time, balance] = subRow;
  return (
    TIME.test(time.text) &&
    balance.x > time.x * 2 &&
    amount.x > row[row.length - 2].x * 2 &&
    Math.abs(amount.x - balance.x) <= Math.max(30, amount.x * 0.25) &&
    BANK_AMOUNT_SHAPE.test(balance.text)
  );
}

type Raw = {
  date: string;
  title: string;
  sub: string;
  amountText: string;
  amount: number;
  sign: "+" | "-" | null;
  balance: number | null;
  amountReview?: boolean;
};

function finish(source: ImportSource, raws: Raw[]): ImportCandidate[] {
  // OCR 누락·필터로 거래가 연속하지 않을 수 있다. 잔액 차이가 정확히 맞을 때만 부호 확인에 쓴다.
  return raws.map((r, i) => {
    const review: string[] = [];
    if (!r.date) review.push(REVIEW_DATE);
    let type: ImportCandidate["type"] = null;
    const next = raws[i + 1];
    if (r.sign) type = r.sign === "+" ? "INCOME" : "EXPENSE";
    else if (
      r.balance != null &&
      next?.balance != null &&
      r.balance - next.balance === r.amount
    )
      type = "INCOME";
    else if (
      r.balance != null &&
      next?.balance != null &&
      r.balance - next.balance === -r.amount
    )
      type = "EXPENSE";
    else if (REFUND.test(r.sub) || /입금|급여/.test(r.sub)) type = "INCOME";
    if (type === null) review.push(REVIEW_TYPE);
    let balanceOk = false;
    if (r.balance != null && next?.balance != null && type) {
      const delta = type === "INCOME" ? r.amount : -r.amount;
      balanceOk = r.balance - next.balance === delta;
      // +/-와 금액이 명확하면 앞뒤 잔액 차이만으로 정상 거래를 막지 않는다.
    }
    // 원 자리가 다른 글자로 읽힌 금액은 잔액으로 맞는지 확인될 때만 확인 없이 가져온다.
    if (r.amountReview && !balanceOk)
      review.unshift("금액의 원 표시를 정확히 읽지 못했어요");
    const refund = REFUND.test(r.sub) || REFUND.test(r.title);
    return {
      date: r.date,
      title: r.title,
      amount: r.amount,
      type,
      balance: r.balance,
      ownTransfer: OWN.test(r.sub) || OWN.test(r.title),
      refund,
      review,
    };
  });
}

function parseBalanceStyle(rows: OcrLine[][], today: string): Raw[] {
  const out: Raw[] = [];
  let date: string | null = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const joined = row.map((l) => l.text).join(" ");
    const head = joined.match(DATE_KOR);
    if (head) {
      date = resolveDate(Number(head[1]), Number(head[2]), today);
      continue;
    }
    // 금액이 깨진 행의 날짜도 다음 거래에 이어진다. 숫자를 고쳐 잘못된 금액으로 가져오지는 않는다.
    const dot = row[0]?.text.match(DATE_DOT);
    if (dot) date = resolveDate(Number(dot[1]), Number(dot[2]), today);
    if (TIME.test(row[0]?.text ?? "")) continue;
    // 거래 행: 오른쪽 끝에 금액이 있고 바로 아래 행에 부제와 잔액이 있다.
    const amountLine = row[row.length - 1];
    const subRow = rows[i + 1] ?? [];
    const balLine = subRow[subRow.length - 1];
    // 원 없는 숫자는 날짜가 있고, 아래 행의 시각과 별도 오른쪽 잔액 열이 확인될 때만 후보로 둔다.
    const bankColumns = hasBankColumns(row, subRow);
    const exactAmount = amountLine?.text.match(AMOUNT);
    // 화면 맨 아래 거래는 시각·잔액 줄이 잘릴 수 있다. 날짜가 보이고
    // 금액이 별도 오른쪽 열에 있을 때만 원 없는 숫자를 검토 후보로 남긴다.
    const noMoreTransactionColumns = rows
      .slice(i + 1)
      .every((later) =>
        later.every(
          (line) => !TIME.test(line.text) && !BANK_LOOSE_AMOUNT.test(line.text),
        ),
      );
    const croppedAmount =
      date &&
      noMoreTransactionColumns &&
      row.length >= 2 &&
      amountLine.x > row[row.length - 2].x * 2 &&
      BARE_AMOUNT.test(amountLine.text)
        ? amountLine.text.match(BANK_LOOSE_AMOUNT)
        : null;
    const am =
      exactAmount ??
      (bankColumns ? amountLine.text.match(BANK_LOOSE_AMOUNT) : croppedAmount);
    if (!am || (row.length < 2 && !DATE_DOT.test(row[0].text))) continue;
    const rest = row.slice(0, -1);
    const title = rest
      .filter((l) => !DATE_DOT.test(l.text))
      .map((l) => l.text)
      .join(" ")
      .trim();
    // 화면 위쪽이 잘려 날짜 머리글이 없어도 거래·금액·시각·잔액 열이
    // 모두 맞으면 검토 목록에 남긴다. 날짜는 사용자가 고르기 전까지 비워 둔다.
    if (!title || (!date && !bankColumns)) continue;
    const bm =
      balLine &&
      (unsigned(balLine.text.replace(/^잔액\s*/, "")).match(AMOUNT) ??
        (bankColumns ? balLine.text.match(BANK_LOOSE_AMOUNT) : null));
    const sub = subRow
      .slice(0, bm || bankColumns ? -1 : undefined)
      .map((l) => l.text.replace(/\s*잔액$/, ""))
      .join(" ")
      .trim();
    out.push({
      date: date ?? "",
      title,
      sub,
      amountText: amountLine.text,
      amount: won(am),
      sign: am[1] ? (am[1] === "+" ? "+" : "-") : null,
      balance: bm ? won(bm) : null,
      amountReview:
        !exactAmount && (!BARE_AMOUNT.test(amountLine.text) || !bankColumns),
    });
    if (bm || bankColumns) i++;
  }
  return out;
}

function parsePay(rows: OcrLine[][], today: string): Raw[] {
  const out: Raw[] = [];
  let month: number | null = null;
  let date: string | null = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const joined = payText(row);
    const mh = joined.match(MONTH_HEAD);
    if (mh) month = Number(mh[1]);
    const dm = joined.match(DATE_DAY);
    if (dm && month != null) {
      date = resolveDate(month, Number(dm[1]), today);
      continue;
    }
    const inlineAmount =
      row.length > 1 && row[row.length - 1].text.match(AMOUNT);
    const pm = payDetail(
      inlineAmount ? payText(row.slice(0, -1)) : joined,
      true,
    );
    if (!pm || !date) continue;
    // ML Kit이 왼쪽 로고를 임의 글자로 읽기도 한다. 제목 열의 내용이나 날짜는 건너뛰지 않는다.
    const titleLeft = row.find((l) => !PAY_LOGO.test(l.text))!.x;
    let amountRow = i;
    let amountLine: OcrLine | undefined = inlineAmount
      ? row[row.length - 1]
      : undefined;
    for (let j = i + 1; !amountLine && j < rows.length; j++) {
      const next = rows[j];
      const nextText = payText(next);
      if (DATE_DAY.test(nextText) || MONTH_HEAD.test(nextText)) break;
      if (next.every((l) => PAY_LOGO.test(l.text) && l.x < row[0].x)) continue;
      if (next.every((l) => l.x < titleLeft * 0.65)) continue;
      const content = next.filter((l) => !PAY_LOGO.test(l.text));
      if (
        content.length === 1 &&
        (AMOUNT.test(content[0].text) ||
          (PAY_BARE_AMOUNT.test(content[0].text) &&
            Math.abs(content[0].x - titleLeft) <=
              Math.max(14, titleLeft * 0.25)))
      ) {
        amountLine = content[0];
        amountRow = j;
      }
      break;
    }
    const am =
      amountLine?.text.match(AMOUNT) ?? amountLine?.text.match(PAY_BARE_AMOUNT);
    if (!amountLine || !am) continue;
    const { kind, detail } = pm;
    const arrow = detail.split(/→/);
    const income = am[1] === "+";
    const counterpart =
      arrow.length === 2 ? (income ? arrow[0] : arrow[1]) : detail;
    out.push({
      date,
      title: counterpart.replace(/\([^)]*\)/g, "").trim() || detail,
      sub: `${kind} ${detail}`,
      amountText: amountLine.text,
      amount: won(am),
      sign: am[1] ? (income ? "+" : "-") : null,
      balance: null,
    });
    i = amountRow;
  }
  return out;
}

// 다른 은행·카드·페이 앱 화면용. 연도가 있는 날짜("2026.11.14", "2026-11-14", "2026년 11월 14일")와
// 슬래시 날짜("11/14")도 읽는다. 날짜 뒤에 시각·요일이 붙어 있어도 된다.
const GENERIC_DATE =
  /^(?:(20\d{2}|\d{2})\s*[.\-/년]\s*)?(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*(?:일)?\s*\.?\s*(?:\(?\s*[월화수목금토일]\s*(?:요일)?\s*\)?)?/;
const CLOCK = /(?:^|\s)(?:오전|오후)?\s*\d{1,2}:\d{2}(?::\d{2})?(?=\s|$)/g;
// 목록 위의 합계·잔액 카드는 거래가 아니다
const SUMMARY =
  /^(?:잔액|총|합계|이번\s*달|지난\s*달|이용\s*금액|이용\s*가능|출금\s*가능|결제\s*예정|청구|한도|누적|보유|자산|사용\s*금액|월\s*사용)/;
const INCOME_WORD =
  /입금|송금\s*받|받은|환불|취소|캐시백|페이백|급여|이자|환급/;
const EXPENSE_WORD =
  /출금|결제|승인|이체|송금|자동\s*납부|체크|신용|일시불|할부/;

function genericDate(
  text: string,
  today: string,
): { date: string; rest: string } | null {
  const m = text.trim().match(GENERIC_DATE);
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // 연도 없는 "2/3 할부", "1-2 매장" 같은 내용은 날짜로 보지 않는다. 연도가 없으면 점·월 표기이거나 날짜만 있는 줄이어야 한다
  const after = text.trim().slice(m[0].length).trim();
  const rest = after.replace(CLOCK, " ").trim();
  if (
    !m[1] &&
    /[/-]/.test(m[0]) &&
    rest &&
    !/^(?:오전|오후)?\s*\d{1,2}:\d{2}/.test(after)
  )
    return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = m[1]
    ? `${m[1].length === 2 ? `20${m[1]}` : m[1]}-${pad(month)}-${pad(day)}`
    : resolveDate(month, day, today);
  return { date, rest: text.trim().slice(m[0].length).trim() };
}

/** 한 행에서 날짜를 떼어 낸다. 날짜만 있는 줄은 지우고, 날짜 뒤 내용은 남긴다. */
function takeDate(row: OcrLine[], today: string) {
  let date: string | null = null;
  const rest: OcrLine[] = [];
  for (const line of row) {
    const found: { date: string; rest: string } | null = date
      ? null
      : genericDate(line.text, today);
    if (found) {
      date = found.date;
      const text = found.rest.replace(CLOCK, " ").trim();
      if (text) rest.push({ ...line, text });
    } else rest.push(line);
  }
  return { date, rest };
}

/**
 * 토스·카카오뱅크·카카오페이 규칙으로 못 읽은 화면을 위한 일반 규칙.
 * "원"이 붙은 금액이 행 오른쪽에 있고 같은 행(또는 바로 위 행)에 내용이 있을 때만 거래로 본다.
 * 날짜는 같은 행, 바로 아래 부제 행, 위의 날짜 머리글 순으로 찾는다. 방향을 모르면 확인을 받는다.
 */
function parseGeneric(rows: OcrLine[][], today: string): Raw[] {
  const out: Raw[] = [];
  let date: string | null = null;
  let pendingTitle: string | null = null;
  for (let i = 0; i < rows.length; i++) {
    const { date: rowDate, rest } = takeDate(rows[i], today);
    if (rowDate) date = rowDate;
    const cells = rest
      .map((l) => ({ ...l, text: l.text.replace(CLOCK, " ").trim() }))
      .filter((l) => l.text && l.text !== "원");
    let amountAt = -1;
    for (let k = cells.length - 1; k >= 0; k--) {
      const text = cells[k].text.replace(/\s+/g, "");
      if (AMOUNT.test(text) && !/^잔액/.test(text)) {
        amountAt = k;
        break;
      }
    }
    if (amountAt < 0) {
      // 금액 없는 행은 다음 행 금액의 내용일 수 있다(내용 위, 금액 아래 화면)
      const text = cells
        .map((l) => l.text)
        .join(" ")
        .trim();
      pendingTitle =
        text && !SUMMARY.test(text) && !/^잔액/.test(text) ? text : null;
      continue;
    }
    const am = cells[amountAt].text.replace(/\s+/g, "").match(AMOUNT)!;
    let title = cells
      .slice(0, amountAt)
      .map((l) => l.text)
      .join(" ")
      .trim();
    if (!title && pendingTitle) title = pendingTitle;
    pendingTitle = null;
    if (!title || SUMMARY.test(title) || /^[\d,.\s:+\-−–]+$/.test(title))
      continue;
    // 바로 아래 행이 금액 없는 부제(시각·잔액·결제 수단)면 날짜·잔액·방향 단서로 함께 쓴다
    const next = rows[i + 1];
    let sub = cells
      .slice(amountAt + 1)
      .map((l) => l.text)
      .join(" ");
    let balance: number | null = null;
    let itemDate = rowDate ?? null;
    if (next) {
      const below = takeDate(next, today);
      const belowCells = below.rest.map((l) =>
        l.text.replace(CLOCK, " ").trim(),
      );
      const belowAmounts = belowCells.filter((t) =>
        AMOUNT.test(t.replace(/\s+/g, "")),
      );
      const balanceText = belowCells.find((t) => /^잔액/.test(t));
      const isSubRow =
        belowAmounts.length === 0 ||
        (belowAmounts.length === 1 && !!balanceText);
      if (isSubRow) {
        if (!itemDate && below.date) itemDate = below.date;
        // "잔액 70,000원"은 OCR 줄 나누기에 따라 "잔액"과 금액이 따로 올 수 있다
        const bm =
          balanceText &&
          (balanceText
            .replace(/^잔액\s*/, "")
            .replace(/\s+/g, "")
            .match(AMOUNT) ??
            belowAmounts[0]?.replace(/\s+/g, "").match(AMOUNT));
        if (bm) balance = won(bm);
        sub = [
          sub,
          ...belowCells.filter(
            (t) => t && t !== balanceText && !belowAmounts.includes(t),
          ),
        ]
          .join(" ")
          .trim();
        i++;
      }
    }
    const words = `${title} ${sub}`;
    const sign: Raw["sign"] = am[1]
      ? am[1] === "+"
        ? "+"
        : "-"
      : INCOME_WORD.test(words)
        ? "+"
        : EXPENSE_WORD.test(words)
          ? "-"
          : null;
    out.push({
      date: itemDate ?? date ?? "",
      title,
      sub,
      amountText: cells[amountAt].text,
      amount: won(am),
      sign,
      balance,
    });
  }
  return out;
}

export function parseReceipt(lines: OcrLine[], today: string): ParseResult {
  const rows = toRows(lines);
  const source = detect(rows);
  if (source) {
    const raws =
      source === "kakaopay"
        ? parsePay(rows, today)
        : parseBalanceStyle(rows, today);
    if (raws.length > 0) return { source, items: finish(source, raws) };
  }
  // 아는 화면 규칙으로 못 읽었으면 다른 은행·카드 앱 화면으로 보고 일반 규칙을 쓴다
  const generic = parseGeneric(rows, today);
  if (generic.length === 0) return { source, items: [] };
  return { source: source ?? "other", items: finish("other", generic) };
}

/** 원문 없이 실패한 단계를 구분하는 로컬 진단용 개수만 반환한다. */
export function receiptDiagnostics(lines: OcrLine[]) {
  const rows = toRows(lines);
  const isPay = detect(rows) === "kakaopay";
  return {
    lines: lines.length,
    rows: rows.length,
    amounts: rows
      .flat()
      .filter(
        (l) => AMOUNT.test(l.text) || (isPay && PAY_BARE_AMOUNT.test(l.text)),
      ).length,
    dates: rows
      .flat()
      .filter((l) => DATE_DOT.test(l.text) || DATE_KOR.test(l.text)).length,
    payMonths: rows.filter((r) => MONTH_HEAD.test(payText(r))).length,
    payDays: rows.filter((r) => DATE_DAY.test(payText(r))).length,
    payDetails: rows.filter((r) => payDetail(payText(r), isPay)).length,
  };
}
