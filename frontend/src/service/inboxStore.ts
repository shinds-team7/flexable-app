import { useEffect, useState } from "react";
import {
  noteBudget,
  plan,
  type BudgetNote,
  type Planned,
  type ReminderKind,
} from "./inboxRecords";
import { readStorage, writeStorage } from "./storage";

// 알림함의 기기 기록(보낸 기기 알림, 예산 상태, 마지막으로 연 시각). 사용자별로 기기 안에만 두고 서버로 보내지 않는다.
// 코인·고정지출 항목은 저장하지 않고 열 때마다 서버에서 읽는다.
const EMPTY: Planned = { sent: [], pending: [] };
const key = (id: number, part: string) =>
  `flexable.service.inbox.${id}.${part}`;
async function read<T>(id: number, part: string, fallback: T): Promise<T> {
  try {
    const saved = await readStorage(key(id, part));
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(id: number, part: string, value: unknown) {
  return writeStorage(key(id, part), JSON.stringify(value));
}
// 읽고 고쳐 쓰는 일이 섞이지 않게 차례로 처리한다.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>) {
  const run = queue.then(task);
  queue = run.catch(() => {});
  return run;
}
let version = 0;
const listeners = new Set<(v: number) => void>();
function changed() {
  version++;
  listeners.forEach((l) => l(version));
}
/** 기록이 바뀔 때마다 늘어나는 값. 알림함이 기기 기록을 다시 읽는 데 쓴다 */
export function useInboxVersion() {
  const [v, setV] = useState(version);
  useEffect(() => {
    listeners.add(setV);
    return () => {
      listeners.delete(setV);
    };
  }, []);
  return v;
}

// 알림을 예약하는 곳은 사용자를 모르므로, 로그인한 사용자를 여기 둔다.
let owner: number | null = null;
export function setInboxOwner(id: number | null) {
  owner = id;
}

/** 기기 알림을 예약·취소한 뒤 부른다. times가 비면 그 종류의 남은 예약을 지운다 */
export function recordReminders(kind: ReminderKind, times: Date[]) {
  const id = owner;
  if (id === null) return Promise.resolve();
  return serial(async () => {
    const record = await read(id, "planned", EMPTY);
    const now = Date.now();
    await write(
      id,
      "planned",
      plan(record, now, kind, times.map((t) => t.getTime())),
    );
    changed();
  });
}

/** 오늘 쓸 수 있는 돈이 0 이하이면 그 상태를 남긴다 */
export function recordBudget(id: number, date: string, todayAvailable: number) {
  return serial(async () => {
    const notes = await read<BudgetNote[]>(id, "budget", []);
    const next = noteBudget(notes, date, todayAvailable, Date.now());
    if (next === notes) return;
    await write(id, "budget", next);
    changed();
  });
}

/**
 * 알림함에 보여 줄 기기 기록. 처음 열 때는 지금을 마지막으로 연 시각으로 저장해,
 * 알림함이 생기기 전의 코인·고정지출 기록이 모두 안 읽음으로 보이지 않게 한다.
 */
export function readInbox(id: number) {
  return serial(async () => {
    const now = Date.now();
    const planned = plan(await read(id, "planned", EMPTY), now);
    const budget = await read<BudgetNote[]>(id, "budget", []);
    let seen = await read<number | null>(id, "seen", null);
    if (seen === null) {
      seen = now;
      await write(id, "seen", seen);
    }
    return { sent: planned.sent, budget, seen };
  });
}

/** 알림함을 열면 at까지 온 알림을 읽은 것으로 한다 */
export function markInboxSeen(id: number, at: number) {
  return serial(async () => {
    const seen = await read<number | null>(id, "seen", null);
    if (seen !== null && seen >= at) return;
    await write(id, "seen", at);
    changed();
  });
}

/** 로그아웃·탈퇴하면 그 사용자의 알림함 기록을 지운다(거래 임시 저장과 같이) */
export function clearInbox(id: number) {
  return serial(async () => {
    await Promise.all(
      ["planned", "budget", "seen"].map((part) =>
        writeStorage(key(id, part), null),
      ),
    );
    changed();
  });
}
