/**
 * 캐릭터 홈 상단 UI — 예산을 잘 지키고 출석할수록 높은 단계(광부→마구간지기→상인→기사→귀족→왕족, 6단계), 못 지킬수록 광부.
 * 단계·게이지 값은 부르는 쪽(서비스 홈, 서버 점수 pointsStatus)이 계산해서 넘긴다.
 */
import { useEffect, type ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { colors, motion } from '@/theme';
import { levelName } from './LevelIcon';
import { T, useAnimValue, useReducedMotion } from './ui';

export type Level = 1 | 2 | 3 | 4 | 5 | 6;

/** 지금 있는 최고 단계. 서버 CharacterScore.MAX(500)와 맞춘다 */
export const TOP_LEVEL: Level = 6;

export type PaceStatus = { level: Level; progress: number; label: string };

/** 서버 캐릭터 점수(0~500, 100점이 한 단계) → 단계와 게이지. 실서비스용 */
export function pointsStatus(points: number, label: string): PaceStatus {
  const p = Math.max(0, points);
  const level = Math.min(TOP_LEVEL, Math.floor(p / 100) + 1) as Level;
  return { level, progress: level === TOP_LEVEL ? 1 : (p % 100) / 100, label };
}

/**
 * 적용 중인 코스튬 영상 하나와 승급 게이지. 캐릭터(character)는 서비스가 전달한다(말풍선은 10-22에 뺐다).
 * 출석 달력 버튼(attendance)은 영상 좌측 상단, 코인 잔액(coin)은 우측 상단에 띄운다. 캐릭터를 누르면 상점, 코인 칩을 누르면 코인 내역(여기에 [모으기])이다.
 * character 는 16:9 칸에 화면 폭을 꽉 채워 그린다(영상 가장자리는 무대 색으로 녹아 있다).
 */
export function CharacterStage({ level, character, coin, attendance, gauge, help, children }: { level: Level; character: ReactNode; coin?: ReactNode; attendance?: ReactNode; gauge: PaceStatus; help?: ReactNode; children: ReactNode }) {
  return (
    <View style={[styles.wrap, { backgroundColor: colors.stage }]}>
      <View style={styles.stage}>
        <View style={styles.char}>
          {character}
          {coin && <View style={styles.coin}>{coin}</View>}
          {attendance && <View style={styles.attendance}>{attendance}</View>}
        </View>
      </View>

      {/* 레벨 안내(?)는 게이지 가운데 위 */}
      {help && <View style={styles.help}>{help}</View>}
      <Gauge status={gauge} />

      {/* 오늘 쓸 수 있는 돈 — 캐릭터와 게이지 아래 */}
      <View style={styles.heroSlot}>{children}</View>
    </View>
  );
}

/**
 * 지금 단계(왼쪽 원)에서 다음 단계(오른쪽 원)까지 어디쯤인지. 최고 단계는 오른쪽 원에 '최고'를 보인다. 퍼센트 숫자는 보여 주지 않는다(10-22).
 * 모양은 양 끝 원 두 개를 네이비 테두리 캡슐로 이은 형태(11-08 시안 level-gage). 채움은 단계와 관계없이 블루 하나이고 단계 구분은 원 안 아이콘이 맡는다.
 * 홈이 처음 그려질 때 0에서 지금 값까지 차오르고, 애니메이션 줄이기가 켜져 있으면 바로 채운다.
 */
function Gauge({ status }: { status: PaceStatus }) {
  const { level, progress, label } = status;
  const top = level === TOP_LEVEL;
  const fill = useAnimValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      fill.setValue(progress);
      return;
    }
    const anim = Animated.timing(fill, { toValue: progress, duration: 700, easing: motion.easeOut, useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [progress, reduced, fill]);
  const pct = Math.round(progress * 100);
  return (
    <View
      style={styles.gauge}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={top ? `최고 단계, ${label}` : `${levelName(level)} 단계, 승급 게이지 ${pct}%, ${label}`}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      <View style={styles.capsule}>
        <View style={styles.track}>
          <Animated.View style={[styles.bar, { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}>
            <View style={styles.shine} />
          </Animated.View>
        </View>
      </View>
      {/* 양 끝 원 안의 단계 그림은 새 레벨 이미지(level-icon-1~6)가 들어올 자리라 지금은 비워 둔다 */}
      <View style={styles.badge} />
      <View style={styles.badge}>
        {top && (
          <T size={12} weight="800" color={colors.brand}>
            최고
          </T>
        )}
      </View>
    </View>
  );
}

/** 게이지 양 끝 원 지름 */
const BADGE = 44;
/** 원과 캡슐의 테두리 두께(같게 맞춘다) */
const LINE = 3.5;
/** 빈 칸(시안의 짙은 보라)과 채움 위 광택(시안의 하늘색). 게이지에서만 쓴다 */
const GAUGE_EMPTY = '#3A1B5E';
const GAUGE_SHINE = '#2FB8FF';

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
  heroSlot: { alignSelf: 'stretch', marginTop: 12 },
  // wrap 의 좌우 여백(16)을 상쇄해 화면 끝까지. 넓은 웹 화면에서는 640에서 멈춘다
  stage: { alignItems: 'center', marginHorizontal: -16, alignSelf: 'stretch' },
  coin: { position: 'absolute', top: 12, right: 16 },
  attendance: { position: 'absolute', top: 12, left: 16 },
  char: { width: '100%', maxWidth: 640, aspectRatio: 16 / 9 },
  help: { alignSelf: 'center', marginTop: 2, marginBottom: -13 },
  // 양 끝 원(BADGE) 사이를 캡슐이 잇는다. 캡슐 끝은 원 뒤로 숨는다
  gauge: { alignSelf: 'stretch', height: BADGE, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  capsule: {
    position: 'absolute',
    left: 8 + BADGE / 2,
    right: 8 + BADGE / 2,
    height: 24,
    borderWidth: LINE,
    borderColor: colors.text,
    backgroundColor: colors.card,
    justifyContent: 'center',
    paddingVertical: 3,
    // 채움은 왼쪽 원 중앙에서 시작해 오른쪽 원 중앙에서 끝난다(양 끝은 원 뒤로 숨는다)
    paddingHorizontal: 0,
  },
  track: { flex: 1, borderRadius: 6, backgroundColor: GAUGE_EMPTY, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 6, backgroundColor: colors.brand, overflow: 'hidden' },
  // 채움 위쪽 절반의 밝은 띠(시안의 광택)
  shine: { position: 'absolute', top: 0, left: 6, right: 0, height: '55%', borderBottomLeftRadius: 6, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: GAUGE_SHINE },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    borderWidth: LINE,
    borderColor: colors.text,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    // 원을 캡슐보다 살짝 위로
    transform: [{ translateY: -4 }],
  },
});
