/** 실행 직후 원격 업데이트 — 스플래시가 떠 있는 동안(최대 3초) 새 버전이 받아지면 바로 적용해, 한 번 켜는 것으로 끝나게 한다 */
import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

const WAIT_MS = 3000;
// 적용이 멈춰도 스플래시에 갇히지 않게 이 시간이 지나면 무조건 연다.
const GUARD_MS = 10000;
const enabled = Platform.OS !== 'web' && Updates.isEnabled && !__DEV__;
const startedAt = Date.now();

/** 스플래시를 내려도 되면 true. 확인 중이거나 업데이트를 적용하는 중이면 false */
export function useLaunchUpdateSettled() {
  const { isStartupProcedureRunning, isChecking, isDownloading, isUpdatePending } = Updates.useUpdates();
  const [settled, setSettled] = useState(!enabled);
  const applying = useRef(false);
  // 확인이 끝났는데 받을 게 없으면 바로 연다.
  if (!settled && !isStartupProcedureRunning && !isChecking && !isDownloading && !isUpdatePending) setSettled(true);

  useEffect(() => {
    if (!enabled) return;
    // 3초가 지나면 받는 중이어도 지금 버전으로 연다. 받은 업데이트는 배너나 다음 실행 때 적용된다.
    // 이미 적용을 시작했으면 기다린다(먼저 열면 쓰는 도중 다시 시작된다).
    const wait = setTimeout(() => {
      if (!applying.current) setSettled(true);
    }, Math.max(0, startedAt + WAIT_MS - Date.now()));
    const guard = setTimeout(() => setSettled(true), Math.max(0, startedAt + GUARD_MS - Date.now()));
    return () => {
      clearTimeout(wait);
      clearTimeout(guard);
    };
  }, []);

  useEffect(() => {
    // 연 뒤에 받아진 업데이트는 쓰는 중에 다시 불러오지 않는다.
    if (settled || !isUpdatePending || applying.current) return;
    applying.current = true;
    Updates.reloadAsync().catch(() => setSettled(true));
  }, [settled, isUpdatePending]);

  return settled;
}
