import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePathname } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { demoRoutes } from '@/demo/routes';
import { colors } from '@/theme';
import { useStore } from '@/store/AppStore';
import { toKey } from '@/utils/date';
import { T } from './ui';

/** 서비스 로고 (assets/brand/logo.png — 다운로드 받은 flex-logo 기반) */
export function Logo({ size = 30 }: { size?: number }) {
  return <Image source={require('../../assets/brand/logo.png')} style={{ width: size, height: size, borderRadius: size * 0.28 }} />;
}

/** 시연 상단 탭 — 경로는 모두 /demo 아래 */
const TABS = [
  { href: demoRoutes.home, label: '홈', match: (p: string) => p === demoRoutes.home || p.startsWith(demoRoutes.home2) },
  { href: demoRoutes.plan, label: '지출계획', match: (p: string) => p.startsWith(demoRoutes.plan) },
  { href: demoRoutes.analysis, label: '분석', match: (p: string) => p.startsWith(demoRoutes.analysis) || p.startsWith(demoRoutes.transactions) },
  { href: demoRoutes.my, label: '마이페이지', match: (p: string) => p.startsWith(demoRoutes.my) },
] as const;

export function AppHeader() {
  const pathname = usePathname();
  const { scheduled, today, homeStyle } = useStore();
  const homeHref = homeStyle === 'character' ? demoRoutes.home2 : demoRoutes.home;
  const pendingCount = scheduled.filter((x) => x.status === 'planned' && x.date < toKey(today)).length;
  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Pressable style={styles.brand} onPress={() => router.navigate(homeHref)} accessibilityRole="link" accessibilityLabel="텅장관리 홈">
          <Logo />
          <T size={18} weight="800">
            텅장관리
          </T>
          <T size={12} weight="700" color={colors.brand} style={{ marginTop: 2 }}>
            flex-able
          </T>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actions, pressed && { backgroundColor: colors.sunken }]}
          onPress={() => router.push(demoRoutes.notifications)}
          accessibilityRole="button"
          accessibilityLabel={pendingCount > 0 ? `알림, 확인할 일 ${pendingCount}건` : '알림'}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.textSub} />
          {pendingCount > 0 && <View style={styles.dot} />}
        </Pressable>
      </View>
      <View style={styles.nav} accessibilityRole="tablist">
        {TABS.map((t) => {
          const on = t.match(pathname);
          return (
            <Pressable
              key={t.href}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => router.navigate(t.href === demoRoutes.home ? homeHref : t.href)}
            >
              <T size={15} weight={on ? '700' : '500'} color={on ? colors.text : colors.textMuted} numberOfLines={1}>
                {t.label}
              </T>
              <View style={[styles.indicator, on && { backgroundColor: colors.brand }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.line },
  top: { height: 56, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  dot: { position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, borderWidth: 1.5, borderColor: '#fff' },
  nav: { flexDirection: 'row', paddingHorizontal: 8 },
  tab: { flex: 1, alignItems: 'center', paddingTop: 8, minHeight: 44 },
  indicator: { height: 3, width: 28, borderRadius: 2, marginTop: 9, backgroundColor: 'transparent' },
});
