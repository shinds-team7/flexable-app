/**
 * 원격 업데이트 — 스플래시가 떠 있는 동안(최대 3초) 새 버전이 받아지면 바로 적용해, 한 번 켜는 것으로 끝나게 한다.
 * 그보다 늦게 받아진 업데이트는 안내 없이 다음에 앱을 새로 켤 때 expo-updates가 적용한다(쓰는 중에는 다시 불러오지 않는다).
 */
import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

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
    // 3초가 지나면 받는 중이어도 지금 버전으로 연다. 받은 업데이트는 다음 실행 때 적용된다.
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

// 앱에 돌아올 때마다 서버에 묻지 않도록 간격을 둔다.
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

/** 켜 둔 채 다시 돌아왔을 때 새 버전을 미리 받아 둔다. 실행 시 확인은 expo-updates가 한다 */
export function useFetchUpdateOnResume() {
  useEffect(() => {
    if (!enabled) return;
    let busy = false;
    let lastCheck = 0;
    const sub = AppState.addEventListener('change', async (next) => {
      if (next !== 'active' || busy || Date.now() - lastCheck < CHECK_INTERVAL_MS) return;
      busy = true;
      lastCheck = Date.now();
      try {
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // 네트워크 오류 등은 다음에 다시 확인한다. 받지 못해도 다음 실행 때 expo-updates가 다시 받는다.
      } finally {
        busy = false;
      }
    });
    return () => sub.remove();
  }, []);
}
