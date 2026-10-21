/**
 * 캐릭터 홈 상단 UI — 예산을 잘 지킬수록 부자 캐릭터(Lv.5), 못 지킬수록 Lv.1(광부).
 * 단계·게이지 값은 부르는 쪽(서비스 홈, 서버 점수 pointsStatus)이 계산해서 넘긴다.
 */
import { useEffect, type ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { colors } from '@/theme';
import { outfitSource } from '@/service/outfits';
import { Button, T, useAnimValue, useReducedMotion } from './ui';

export type Level = 1 | 2 | 3 | 4 | 5;

/** 레벨별 게이지 강조색 */
const ACCENTS: Record<Level, string> = { 1: '#667085', 2: '#8A6A3B', 3: '#1D3A8A', 4: '#A11D2B', 5: '#B7791F' };

export type PaceStatus = { level: Level; progress: number; label: string };

/** 서버 캐릭터 점수(0~400, 100점이 한 단계) → 단계와 게이지. 실서비스용 */
export function pointsStatus(points: number, label: string): PaceStatus {
  const p = Math.min(400, Math.max(0, points));
  const level = Math.min(5, Math.floor(p / 100) + 1) as Level;
  return { level, progress: level === 5 ? 1 : (p % 100) / 100, label };
}

/** 홈 코인 줄 — 잔액과 [모으기]. 서버를 못 받았으면 부르는 쪽이 coin 을 넘기지 않는다 */
export type CoinBar = {
  balance: number;
  /** 지금 받을 수 있는 개수 */
  collectable: number;
  /** collectable 이 0일 때 [모으기] 아래에 보일 안내(다음 적립 시각 등) */
  hint: string;
  busy: boolean;
  onCollect: () => void;
  onCustomize: () => void;
};

/** 적용 중인 코스튬 애니메이션 하나와 승급 게이지. 안내 문구·코인 값은 서비스가 전달한다. */
export function CharacterStage({ level, outfitId, coin, gauge, message, children }: { level: Level; outfitId: string | null; coin?: CoinBar; gauge: PaceStatus; message: string; children: ReactNode }) {
  const accent = ACCENTS[level];

  return (
    <View style={[styles.wrap, { backgroundColor: colors.stage }]}>
      {/* 오늘 쓸 수 있는 돈 — 기존 홈과 같은 파란 카드를 맨 위에 */}
      <View style={styles.heroSlot}>{children}</View>

      <View style={styles.bubble}>
        <T size={14} weight="600" numberOfLines={1} style={{ textAlign: 'center', lineHeight: 20 }}>
          {message}
        </T>
        <View style={styles.tail} />
      </View>

      <View style={styles.stage}>
        <Image source={outfitSource(outfitId)} style={styles.char} contentFit="contain" accessible accessibilityRole="image" accessibilityLabel={`Lv.${level} 캐릭터`} />
      </View>

      {coin && (
        <View style={styles.coinRow}>
          <View style={styles.balance} accessible accessibilityLabel={`코인 ${coin.balance}개`}>
            <T size={15} weight="800" num>{`🪙 ${coin.balance.toLocaleString('ko-KR')}`}</T>
          </View>
          <View style={styles.coinBtns}>
            <Button
              label={coin.collectable > 0 ? `모으기 +${coin.collectable}` : '모으기'}
              disabled={coin.collectable <= 0 || coin.busy}
              onPress={coin.onCollect}
              style={styles.coinBtn}
            />
            <Button label="꾸미기" variant="soft" onPress={coin.onCustomize} style={styles.coinBtn} />
          </View>
          {coin.collectable <= 0 && coin.hint !== '' && (
            <T size={12} color={colors.textMuted}>
              {coin.hint}
            </T>
          )}
        </View>
      )}

      <Gauge status={gauge} accent={accent} />
    </View>
  );
}

/** 지금 단계 안에서 하락(왼쪽) ~ 승급(오른쪽) 사이 어디쯤인지 */
function Gauge({ status, accent }: { status: PaceStatus; accent: string }) {
  const { level, progress, label } = status;
  const top = level === 5;
  const fill = useAnimValue(progress);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) fill.setValue(progress);
    else Animated.timing(fill, { toValue: progress, duration: 600, useNativeDriver: false }).start();
  }, [progress, reduced, fill]);
  const pct = Math.round(progress * 100);
  return (
    <View
      style={styles.gauge}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={top ? `최고 단계, ${label}` : `Lv.${level} 승급 게이지 ${pct}%, ${label}`}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      <View style={styles.gaugeHead}>
        <T size={12} weight="600" color={colors.textMuted}>
          {level === 1 ? 'Lv.1' : `▼ Lv.${level - 1}`}
        </T>
        <T size={13} weight="800" color={accent}>
          {top ? '최고 단계' : `${pct}%`}
        </T>
        <T size={12} weight="600" color={colors.textMuted}>
          {top ? 'Lv.5' : `Lv.${level + 1} ▲`}
        </T>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.bar,
            { backgroundColor: accent, width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Screen 의 좌우·상단 여백(16)을 상쇄해 화면 폭을 꽉 채우고, 아래 항목 바로 위에서 끊는다(gap 12 상쇄)
  wrap: {
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: -12,
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  heroSlot: { alignSelf: 'stretch' },
  bubble: { marginTop: 18, backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, maxWidth: 360 },
  tail: {
    position: 'absolute',
    bottom: -7,
    left: '50%',
    marginLeft: -7,
    width: 14,
    height: 14,
    backgroundColor: '#fff',
    transform: [{ rotate: '45deg' }],
  },
  stage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4, alignSelf: 'stretch' },
  char: { width: 220, height: 220 },
  coinRow: { alignSelf: 'stretch', alignItems: 'center', gap: 8, marginTop: 8 },
  balance: { backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  coinBtns: { flexDirection: 'row', gap: 8 },
  coinBtn: { minHeight: 44, paddingVertical: 8, paddingHorizontal: 18 },
  gauge: { alignSelf: 'stretch', gap: 6, marginTop: 4, paddingHorizontal: 8 },
  gaugeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { height: 10, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.08)', overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 5 },
});
