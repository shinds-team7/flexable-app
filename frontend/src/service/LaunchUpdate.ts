/** 실행 직후 원격 업데이트 — 스플래시가 떠 있는 동안(최대 3초) 새 버전이 받아지면 바로 적용해, 한 번 켜는 것으로 끝나게 한다 */
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

const WAIT_MS = 3000;
const enabled = Platform.OS !== 'web' && Updates.isEnabled && !__DEV__;
const startedAt = Date.now();

/** 스플래시를 내려도 되면 true. 확인 중이거나 업데이트를 적용하는 중이면 false */
export function useLaunchUpdateSettled() {
  const { isStartupProcedureRunning, isChecking, isDownloading, isUpdatePending } = Updates.useUpdates();
  const [settled, setSettled] = useState(!enabled);
  // 확인이 끝났는데 받을 게 없으면 바로 연다.
  if (!settled && !isStartupProcedureRunning && !isChecking && !isDownloading && !isUpdatePending) setSettled(true);

  useEffect(() => {
    if (!enabled) return;
    // 3초가 지나면 받는 중이어도 지금 버전으로 연다. 받은 업데이트는 배너나 다음 실행 때 적용된다.
    const t = setTimeout(() => setSettled(true), Math.max(0, startedAt + WAIT_MS - Date.now()));
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // 연 뒤에 받아진 업데이트는 쓰는 중에 다시 불러오지 않는다.
    if (settled || !isUpdatePending) return;
    Updates.reloadAsync().catch(() => setSettled(true));
  }, [settled, isUpdatePending]);

  return settled;
}
