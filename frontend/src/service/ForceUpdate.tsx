/** 필수 업데이트 — 설치된 버전이 최소 버전보다 낮으면 Play 스토어로 안내한다 */
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { AppState, Linking, Modal, Platform, StyleSheet, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { colors, radius, space, type } from '@/theme';

const VERSION_URL = 'https://project2-flex-sh.vercel.app/app-version.json';
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.flexable.app';
const VERSION_PATTERN = /^\d+(\.\d+)*$/;
// 앱에 돌아올 때마다 서버에 묻지 않도록 간격을 둔다.
const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 5000;

function isOlderVersion(current: string, minimum: string) {
  const a = current.split('.').map(Number);
  const b = minimum.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  }
  return false;
}

async function openStore() {
  try {
    await Linking.openURL('market://details?id=com.flexable.app');
  } catch {
    await Linking.openURL(PLAY_URL).catch(() => {});
  }
}

export function ForceUpdate() {
  const [required, setRequired] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android' || !Updates.isEnabled || __DEV__) return;
    const currentVersion = Updates.runtimeVersion;
    if (!currentVersion || !VERSION_PATTERN.test(currentVersion)) return;

    let alive = true;
    let busy = false;
    let lastCheck = 0;
    let controller: AbortController | undefined;
    const checkVersion = async () => {
      if (busy || Date.now() - lastCheck < CHECK_INTERVAL_MS) return;
      busy = true;
      lastCheck = Date.now();
      const request = new AbortController();
      controller = request;
      const timeout = setTimeout(() => request.abort(), TIMEOUT_MS);
      try {
        const response = await fetch(VERSION_URL, { cache: 'no-store', signal: request.signal });
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (!data || typeof data !== 'object' || !('android' in data)) return;
        const android = data.android;
        if (!android || typeof android !== 'object' || !('minVersion' in android)) return;
        const minimum = android.minVersion;
        if (typeof minimum !== 'string' || !VERSION_PATTERN.test(minimum)) return;
        // 유효한 응답만 반영한다. 최소 버전을 내리면 떠 있던 창도 사라진다.
        if (alive && !request.signal.aborted) setRequired(isOlderVersion(currentVersion, minimum));
      } catch {
        // 네트워크 오류·잘못된 설정은 다음에 다시 확인하고, 새로 사용을 막지 않는다.
      } finally {
        clearTimeout(timeout);
        busy = false;
        controller = undefined;
      }
    };

    void checkVersion();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void checkVersion();
    });
    return () => {
      alive = false;
      controller?.abort();
      sub.remove();
    };
  }, []);

  if (!required) return null;

  return (
    <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <T size={type.title} weight="700" accessibilityRole="header">
            새 버전으로 업데이트해 주세요
          </T>
          <T color={colors.textSub} style={styles.message}>
            더 안정적인 새 버전이 나왔어요. Play 스토어에서 업데이트한 뒤 다시 열어 주세요.
          </T>
          <Button label="업데이트하기" accessibilityRole="button" accessibilityLabel="업데이트하기" onPress={openStore} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space[6],
    backgroundColor: 'rgba(16,26,51,0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: space[6],
    borderRadius: radius.lg,
    backgroundColor: colors.card,
  },
  message: {
    marginTop: space[3],
    marginBottom: space[6],
    lineHeight: 23,
  },
});
