/**
 * 시연(/demo) 전용 레이아웃 — Mock 상태(AppStore)는 여기서만 주입한다.
 * 모든 시연 화면 상단에 '시연용 · 예시 데이터' 띠를 둔다(헤더 없는 온보딩·잠금화면 포함).
 */
import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { T } from '@/components/ui';
import { DEMO_VERSION } from '@/demo/version';
import { AppStoreProvider } from '@/store/AppStore';
import { colors } from '@/theme';

export default function DemoLayout() {
  return (
    <AppStoreProvider>
      <View style={styles.banner} accessibilityRole="text" accessibilityLabel={`시연용 화면, 예시 데이터, 버전 ${DEMO_VERSION}`}>
        <T size={12} weight="700" color={colors.brandDark} num>
          시연용 · 예시 데이터 · v{DEMO_VERSION}
        </T>
      </View>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </AppStoreProvider>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.brandSoft, paddingVertical: 4, alignItems: 'center' },
});
