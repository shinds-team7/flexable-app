/**
 * 캐릭터 홈 상단 — 예산을 잘 지킬수록 부자 캐릭터(Lv.5 다이아), 못 지킬수록 Lv.1(돌)로 강등.
 * 좌우 < > 버튼은 시연용(희미하게 표시) — 누르면 레벨이 바뀐다.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { Animated, Image, Platform, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import type { BudgetSummary } from '@/store/budget';
import { useStore } from '@/store/AppStore';
import { colors } from '@/theme';
import { diffDays } from '@/utils/date';
import { TodayHeroCard } from './HomeContent';
import { T, useAnimValue, useReducedMotion } from './ui';

export type Level = 1 | 2 | 3 | 4 | 5;

/** 레벨별 캐릭터 (원본: status-1 광부 · status-4 츄리닝 · status-5 직장인 · status-2 플렉스 · status-3 왕) */
const LEVELS: Record<Level, { img: ImageSourcePropType; msg: string; bg: string; accent: string }> = {
  1: {
    img: require('../../assets/characters/lv1.png'),
    msg: '예산 초과! 오늘은 한도 안에서만 써요',
    bg: '#EEF2FA',
    accent: '#667085',
  },
  2: {
    img: require('../../assets/characters/lv2.png'),
    msg: '이번 주 빠듯해요. 카페 한 번만 줄여요',
    bg: '#EEF2FA',
    accent: '#8A6A3B',
  },
  3: {
    img: require('../../assets/characters/lv3.png'),
    msg: '잘 버티는 중! 오늘 한도만 지키면 돼요',
    bg: '#EEF2FA',
    accent: '#1D3A8A',
  },
  4: {
    img: require('../../assets/characters/lv4.png'),
    msg: '예산을 잘 지키고 있어요. 이 정도면 플렉스 가능!',
    bg: '#EEF2FA',
    accent: '#A11D2B',
  },
  5: {
    img: require('../../assets/characters/lv5.png'),
    msg: '완벽해요! 예산 관리의 왕이에요',
    bg: '#EEF2FA',
    accent: '#B7791F',
  },
};

/** 이번 주기 소비 속도로 레벨 계산: 지금까지 쓴 돈 ÷ (같은 기간 예산) */
export function levelFromBudget(s: BudgetSummary, today: Date): Level {
  const total = diffDays(s.cycleEnd, s.cycleStart) + 1;
  const elapsed = diffDays(today, s.cycleStart) + 1;
  const expected = (s.cycleBudget * elapsed) / total;
  const pace = expected > 0 ? s.cycleSpent / expected : 1;
  if (s.shortage > 0 || pace > 1.2) return 1;
  if (pace > 1.05) return 2;
  if (pace > 0.95) return 3;
  if (pace > 0.8) return 4;
  return 5;
}

export function CharacterHero() {
  const { summary: s, today } = useStore();
  const auto = levelFromBudget(s, today);
  const [level, setLevel] = useState<Level>(auto);
  // 예산 상태가 바뀌면 시연용으로 바꾼 레벨을 자동 레벨로 되돌린다
  const [prevAuto, setPrevAuto] = useState(auto);
  if (auto !== prevAuto) {
    setPrevAuto(auto);
    setLevel(auto);
  }
  return (
    <CharacterStage level={level} onChange={setLevel}>
      <TodayHeroCard />
    </CharacterStage>
  );
}

/** 위 오늘 카드 + 아래 캐릭터·말풍선·단계 점. onChange가 있으면 시연용 좌우 화살표를 보여준다(실서비스는 없음) */
export function CharacterStage({ level, onChange, children }: { level: Level; onChange?: (level: Level) => void; children: ReactNode }) {

  // 캐릭터 전환: 누른 방향에서 살짝 밀려 들어오며 커진다 (과한 바운스 없이)
  const scale = useAnimValue(1);
  const shift = useAnimValue(0);
  const reduced = useReducedMotion();
  const bump = (d: -1 | 1) => {
    if (reduced) return;
    scale.setValue(0.94);
    shift.setValue(d * 18);
    const cfg = { toValue: 1, friction: 8, tension: 140, useNativeDriver: Platform.OS !== 'web' };
    Animated.parallel([Animated.spring(scale, cfg), Animated.spring(shift, { ...cfg, toValue: 0 })]).start();
  };
  const change = (d: -1 | 1) => {
    const next = Math.min(5, Math.max(1, level + d)) as Level;
    if (next === level || !onChange) return;
    onChange(next);
    bump(d);
  };

  const L = LEVELS[level];

  return (
    <View style={[styles.wrap, { backgroundColor: L.bg }]}>
      {/* 오늘 쓸 수 있는 돈 — 기존 홈과 같은 파란 카드를 맨 위에 */}
      <View style={styles.heroSlot}>{children}</View>

      <View style={styles.bubble}>
        <T size={14} weight="600" numberOfLines={1} style={{ textAlign: 'center', lineHeight: 20 }}>
          {L.msg}
        </T>
        <View style={styles.tail} />
      </View>

      <View style={styles.stage}>
        <Pressable accessibilityRole="button" accessibilityLabel="이전 단계 캐릭터" accessibilityElementsHidden={level === 1 || !onChange} importantForAccessibility={level === 1 || !onChange ? 'no-hide-descendants' : 'auto'} onPress={() => change(-1)} disabled={level === 1 || !onChange} hitSlop={12} style={[styles.arrow, (level === 1 || !onChange) && { opacity: 0 }]}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Animated.View style={{ transform: [{ translateX: shift }, { scale }] }}>
          <Image source={L.img} style={styles.char} resizeMode="contain" />
        </Animated.View>
        <Pressable accessibilityRole="button" accessibilityLabel="다음 단계 캐릭터" accessibilityElementsHidden={level === 5 || !onChange} importantForAccessibility={level === 5 || !onChange ? 'no-hide-descendants' : 'auto'} onPress={() => change(1)} disabled={level === 5 || !onChange} hitSlop={12} style={[styles.arrow, (level === 5 || !onChange) && { opacity: 0 }]}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.dots}>
        {[1, 2, 3, 4, 5].map((n) => (
          <View key={n} style={[styles.dot, n <= level && { backgroundColor: L.accent }]} />
        ))}
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
  arrow: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', opacity: 0.22 },
  char: { width: 220, height: 220 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 2 },
  dot: { width: 22, height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.1)' },
});
