/**
 * 실제 서비스 시작 화면(/) — 서비스 1.0.0 화면이 준비될 때까지 '준비 중'을 명확히 표시한다.
 * 시연(Mock) 화면을 이 주소에서 대신 보여주지 않는다. 시연은 /demo 에서 연다.
 */
import { router } from 'expo-router';
import { Image, Platform, StyleSheet, View } from 'react-native';

import { Button, T } from '@/components/ui';
import { demoRoutes } from '@/demo/routes';
import { colors } from '@/theme';

export default function ServiceStart() {
  return (
    <View style={styles.wrap}>
      <Image source={require('../../assets/brand/logo.png')} style={styles.logo} accessibilityIgnoresInvertColors />
      <T size={22} weight="800" style={styles.center}>
        텅장관리
      </T>
      <T size={15} color={colors.textSub} style={[styles.center, { marginTop: 10, lineHeight: 22 }]}>
        실제 서비스는 준비 중이에요.{'\n'}가입·기록 기능이 열리면 이곳에서 시작할 수 있어요.
      </T>
      {Platform.OS === 'web' && (
        <View style={styles.actions}>
          <Button label="시연 보기" variant="soft" onPress={() => router.push(demoRoutes.home)} />
          <T size={12} color={colors.textMuted} style={styles.center}>
            시연은 예시 데이터로 동작해요
          </T>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 28 },
  logo: { width: 64, height: 64, borderRadius: 18, marginBottom: 16 },
  center: { textAlign: 'center' },
  actions: { marginTop: 28, alignSelf: 'stretch', gap: 10 },
});
