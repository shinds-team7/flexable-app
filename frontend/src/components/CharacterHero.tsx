/**
 * 캐릭터 홈 상단 — 예산을 잘 지킬수록 부자 캐릭터(Lv.5 다이아), 못 지킬수록 Lv.1(돌)로 강등.
 * 아래 게이지로 승급·하락까지 얼마나 남았는지 보여준다. 실서비스는 서버 점수(하루 예산을 지키면 +15, 넘기면 −50),
 * 시연은 이번 주기 소비 속도(쓴 돈 ÷ 같은 기간 예산)로 단계를 정한다.
 * 좌우 < > 버튼은 시연용(희미하게 표시) — 누르면 레벨이 바뀐다.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Image, Platform, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import type { BudgetSummary } from '@/store/budget';
import { useStore } from '@/store/AppStore';
import { colors } from '@/theme';
import { diffDays } from '@/utils/date';
import { TodayHeroCard } from './HomeContent';
import { T, useAnimValue, useReducedMotion } from './ui';

export type Level = 1 | 2 | 3 | 4 | 5;

/** 레벨별 캐릭터(광부 → 왕). img 는 뒤에 쌓인 동전이 적은 순 4장 — 오늘 남은 돈만큼 고른다(coinStage) */
const LEVELS: Record<Level, { img: ImageSourcePropType[]; msg: string; bg: string; accent: string }> = {
  1: {
    img: [
      require('../../assets/characters/lv1-1.png'),
      require('../../assets/characters/lv1-2.png'),
      require('../../assets/characters/lv1-3.png'),
      require('../../assets/characters/lv1-4.png'),
    ],
    msg: '예산 초과! 오늘은 한도 안에서만 써요',
    bg: '#EEF2FA',
    accent: '#667085',
  },
  2: {
    img: [
      require('../../assets/characters/lv2-1.png'),
      require('../../assets/characters/lv2-2.png'),
      require('../../assets/characters/lv2-3.png'),
      require('../../assets/characters/lv2-4.png'),
    ],
    msg: '이번 주 빠듯해요. 카페 한 번만 줄여요',
    bg: '#EEF2FA',
    accent: '#8A6A3B',
  },
  3: {
    img: [
      require('../../assets/characters/lv3-1.png'),
      require('../../assets/characters/lv3-2.png'),
      require('../../assets/characters/lv3-3.png'),
      require('../../assets/characters/lv3-4.png'),
    ],
    msg: '잘 버티는 중! 오늘 한도만 지키면 돼요',
    bg: '#EEF2FA',
    accent: '#1D3A8A',
  },
  4: {
    img: [
      require('../../assets/characters/lv4-1.png'),
      require('../../assets/characters/lv4-2.png'),
      require('../../assets/characters/lv4-3.png'),
      require('../../assets/characters/lv4-4.png'),
    ],
    msg: '예산을 잘 지키고 있어요. 이 정도면 플렉스 가능!',
    bg: '#EEF2FA',
    accent: '#A11D2B',
  },
  5: {
    img: [
      require('../../assets/characters/lv5-1.png'),
      require('../../assets/characters/lv5-2.png'),
      require('../../assets/characters/lv5-3.png'),
      require('../../assets/characters/lv5-4.png'),
    ],
    msg: '완벽해요! 예산 관리의 왕이에요',
    bg: '#EEF2FA',
    accent: '#B7791F',
  },
};

/** 단계별 소비 속도 구간 [승급 쪽 경계, 하락 쪽 경계]. 속도 = 쓴 돈 ÷ 같은 기간 예산(1이면 예산만큼) */
const BANDS: Record<Level, [number, number]> = {
  5: [0, 0.8],
  4: [0.8, 0.95],
  3: [0.95, 1.05],
  2: [1.05, 1.2],
  1: [1.2, 1.5],
};

export type PaceStatus = { level: Level; progress: number; label: string };

/** 캐릭터 뒤 동전 더미 단계(1 = 거의 없음, 4 = 가득) */
export type CoinStage = 1 | 2 | 3 | 4;

/** 오늘 남은 돈 ÷ 하루 예산 → 동전 단계. 아침엔 가득, 쓸수록 줄어든다(70% · 40% · 10% 경계) */
export function coinStage(todayAvailable: number, dailyBudget: number): CoinStage {
  const ratio = dailyBudget > 0 ? todayAvailable / dailyBudget : 0;
  return ratio > 0.7 ? 4 : ratio > 0.4 ? 3 : ratio > 0.1 ? 2 : 1;
}

/** 소비 속도 → 단계와 게이지(0 = 곧 하락, 1 = 곧 승급). short 면 생활비가 모자란 상태라 Lv.1. 시연 캐릭터 홈용 */
export function paceStatus(pace: number, short: boolean): PaceStatus {
  if (short) return { level: 1, progress: 0, label: '남은 생활비가 모자라요' };
  const level: Level = pace <= 0.8 ? 5 : pace <= 0.95 ? 4 : pace <= 1.05 ? 3 : pace <= 1.2 ? 2 : 1;
  const [lo, hi] = BANDS[level];
  const progress = level === 5 ? 1 : Math.min(1, Math.max(0, (hi - pace) / (hi - lo)));
  const diff = Math.round((1 - pace) * 100);
  const label = diff > 0 ? `이번 주기 예산보다 ${diff}% 덜 쓰는 중` : diff < 0 ? `이번 주기 예산보다 ${-diff}% 더 쓰는 중` : '이번 주기 예산만큼 쓰는 중';
  return { level, progress, label };
}

/** 서버 캐릭터 점수(0~400, 100점이 한 단계) → 단계와 게이지. 실서비스용 */
export function pointsStatus(points: number, label: string): PaceStatus {
  const p = Math.min(400, Math.max(0, points));
  const level = Math.min(5, Math.floor(p / 100) + 1) as Level;
  return { level, progress: level === 5 ? 1 : (p % 100) / 100, label };
}

/** 이번 주기 소비 속도로 단계 계산: 지금까지 쓴 돈 ÷ (같은 기간 예산) */
export function statusFromBudget(s: BudgetSummary, today: Date): PaceStatus {
  const total = diffDays(s.cycleEnd, s.cycleStart) + 1;
  const elapsed = diffDays(today, s.cycleStart) + 1;
  const expected = (s.cycleBudget * elapsed) / total;
  const pace = expected > 0 ? s.cycleSpent / expected : 1;
  return paceStatus(pace, s.shortage > 0);
}

export function CharacterHero() {
  const { summary: s, today } = useStore();
  const status = statusFromBudget(s, today);
  const auto = status.level;
  const [level, setLevel] = useState<Level>(auto);
  // 예산 상태가 바뀌면 시연용으로 바꾼 레벨을 자동 레벨로 되돌린다
  const [prevAuto, setPrevAuto] = useState(auto);
  if (auto !== prevAuto) {
    setPrevAuto(auto);
    setLevel(auto);
  }
  return (
    <CharacterStage level={level} coins={coinStage(s.todayAvailable, s.dailyLimit)} onChange={setLevel} gauge={level === auto ? status : { level, progress: 0.5, label: '시연용으로 단계를 바꿨어요' }}>
      <TodayHeroCard />
    </CharacterStage>
  );
}

/** 위 오늘 카드 + 아래 말풍선·캐릭터·승급 게이지. coins 는 캐릭터 뒤 동전 더미 단계. message 가 없으면 단계별 기본 말(시연용, 지금 소비 상태 기준)을 쓴다. onChange가 있으면 시연용 좌우 화살표를 보여준다(실서비스는 없음) */
export function CharacterStage({ level, coins, gauge, message, onChange, children }: { level: Level; coins: CoinStage; gauge: PaceStatus; message?: string; onChange?: (level: Level) => void; children: ReactNode }) {

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
          {message ?? L.msg}
        </T>
        <View style={styles.tail} />
      </View>

      <View style={styles.stage}>
        <Pressable accessibilityRole="button" accessibilityLabel="이전 단계 캐릭터" accessibilityElementsHidden={level === 1 || !onChange} importantForAccessibility={level === 1 || !onChange ? 'no-hide-descendants' : 'auto'} onPress={() => change(-1)} disabled={level === 1 || !onChange} hitSlop={12} style={[styles.arrow, (level === 1 || !onChange) && { opacity: 0 }]}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Animated.View style={{ transform: [{ translateX: shift }, { scale }] }}>
          <Image source={L.img[coins - 1]} style={styles.char} resizeMode="contain" accessible accessibilityRole="image" accessibilityLabel={`Lv.${level} 캐릭터, 오늘 예산 동전 ${coins}/4단계`} />
        </Animated.View>
        <Pressable accessibilityRole="button" accessibilityLabel="다음 단계 캐릭터" accessibilityElementsHidden={level === 5 || !onChange} importantForAccessibility={level === 5 || !onChange ? 'no-hide-descendants' : 'auto'} onPress={() => change(1)} disabled={level === 5 || !onChange} hitSlop={12} style={[styles.arrow, (level === 5 || !onChange) && { opacity: 0 }]}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
      </View>

      <Gauge status={gauge} accent={L.accent} />
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
      <T size={12} color={colors.textSub} style={{ textAlign: 'center' }}>
        {label}
      </T>
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
  gauge: { alignSelf: 'stretch', gap: 6, marginTop: 4, paddingHorizontal: 8 },
  gaugeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { height: 10, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.08)', overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 5 },
});
