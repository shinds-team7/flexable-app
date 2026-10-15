/** 원격 업데이트 배너 — 앱을 켜 둔 사람에게 새 버전이 받아졌다고 알리고, 누르면 바로 다시 불러온다 */
import * as Updates from 'expo-updates';
import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet } from 'react-native';

import { colors, radius } from '@/theme';
import { T } from './ui';

// 입력 중인 화면에서 다시 불러오면 쓰던 내용이 사라지므로 탭 화면에서만 보여 준다.
const SAFE_PATHS = ['/home', '/analysis', '/transactions', '/my'];
// 앱에 돌아올 때마다 서버에 묻지 않도록 간격을 둔다.
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

export function UpdateBanner() {
  const { isUpdatePending } = Updates.useUpdates();
  const pathname = usePathname();
  const [state, setState] = useState<'idle' | 'restarting' | 'failed'>('idle');
  const busy = useRef(false);
  const lastCheck = useRef(0);

  useEffect(() => {
    if (!Updates.isEnabled || __DEV__) return;
    // 실행 시 확인은 expo-updates가 하므로, 켜 둔 채 다시 돌아왔을 때만 확인해 미리 받아 둔다.
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active' || busy.current || Date.now() - lastCheck.current < CHECK_INTERVAL_MS) return;
      busy.current = true;
      lastCheck.current = Date.now();
      try {
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // 네트워크 오류 등은 다음에 다시 확인한다. 받지 못해도 다음 실행 때 적용된다.
      } finally {
        busy.current = false;
      }
    });
    return () => sub.remove();
  }, []);

  if (!isUpdatePending || !SAFE_PATHS.includes(pathname)) return null;

  const message = state === 'failed' ? '적용하지 못했어요' : '새 버전이 준비됐어요';
  const action = state === 'restarting' ? '적용 중…' : state === 'failed' ? '다시 시도' : '지금 적용';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${message}. ${action}`}
      accessibilityState={{ busy: state === 'restarting', disabled: state === 'restarting' }}
      accessibilityLiveRegion="polite"
      disabled={state === 'restarting'}
      onPress={() => {
        setState('restarting');
        Updates.reloadAsync().catch(() => setState('failed'));
      }}
      style={({ pressed }) => [styles.banner, pressed && { opacity: 0.85 }]}
    >
      <T size={14} weight="600" color={colors.text} style={{ flex: 1 }}>
        {message}
      </T>
      <T size={14} weight="700" color={colors.brand}>
        {action}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 16,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
  },
});
