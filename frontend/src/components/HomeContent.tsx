/** 홈 본문 — 시연 기존 홈(/demo)과 캐릭터 홈(/demo/home2)이 함께 쓴다. top 으로 상단에 요소를 끼워 넣을 수 있다. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScheduleRow } from './ScheduleRow';
import { AddButton, Badge, Card, IconCircle, Screen, SectionTitle, T, useRollingNumber } from './ui';
import { planDailyReserve } from '@/store/budget';
import { useStore } from '@/store/AppStore';
import { colors, pressTransition, radius } from '@/theme';
import { diffDays, endOfWeek, fromKey, md, startOfWeek, toKey, weekLabel } from '@/utils/date';
import { DOW, won } from '@/utils/format';
import { demoRoutes } from '@/demo/routes';

export function HomeContent({ top, hideHero }: { top?: ReactNode; hideHero?: boolean }) {
  const { today, summary, scheduled, plans } = useStore();
  const s = summary;

  const weekEndKey = toKey(endOfWeek(today));
  const thisWeek = scheduled.filter((x) => x.status === 'planned' && x.date >= toKey(today) && x.date <= weekEndKey);
  const toSettle = scheduled.filter((x) => x.status === 'planned' && x.date < toKey(today));
  const upcomingPlans = plans.filter((p) => endOfWeek(fromKey(p.weekStart)) >= today);

  const weekTotal = s.weekSpent + Math.max(0, s.weekAvailable);
  const weekRatio = weekTotal > 0 ? Math.min(1, s.weekSpent / weekTotal) : 0;
  const dPay = diffDays(s.nextPayday, today);

  return (
    <Screen>
      {top}

      {/* 오늘 사용 가능한 금액 */}
      {!hideHero && <TodayHeroCard />}

      {s.shortage > 0 && (
        <Card style={{ backgroundColor: colors.dangerSoft }}>
          <T size={14} weight="700" color={colors.danger}>
            다음 수입일까지 {won(s.shortage)}원이 부족해요
          </T>
          <T size={12} color={colors.textSub} style={{ marginTop: 4 }}>
            예정 지출을 줄이거나 보호 금액을 조정해 보세요
          </T>
        </Card>
      )}

      {/* 이번 주 · 남은 생활비 — 한 묶음 */}
      <View style={styles.panel}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`이번 주 쓸 수 있는 돈 ${won(Math.max(0, s.weekAvailable))}원, 분석 보기`}
          onPress={() => router.navigate({ pathname: demoRoutes.analysis, params: { period: 'week' } })}
          style={({ pressed }) => [styles.panelRow, pressTransition, pressed && styles.panelPressed]}
        >
          <View style={styles.rowBetween}>
            <T size={14} weight="600" color={colors.textSub}>
              이번 주 쓸 수 있는 돈
            </T>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </View>
          <T size={26} weight="800" num style={{ marginTop: 4 }}>
            {won(Math.max(0, s.weekAvailable))}원
          </T>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${weekRatio * 100}%` }]} />
          </View>
          <T size={12} color={colors.textMuted} num>
            {md(startOfWeek(today))}–{md(endOfWeek(today))}에 {won(s.weekSpent)}원 썼어요
            {s.weekScheduled > 0 && (
              <T size={12} weight="600" color={colors.brandDark} num>
                {'\n'}예정된 소비 {won(s.weekScheduled)}원은 따로 빼뒀어요
              </T>
            )}
          </T>
        </Pressable>
        <View style={styles.hair} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`다음 수입일까지 남은 생활비 ${won(Math.max(0, s.remainingNow))}원, 계산 근거 보기`}
          onPress={() => router.push(demoRoutes.budgetDetail)}
          style={({ pressed }) => [styles.panelRow, styles.panelRowSm, pressTransition, pressed && styles.panelPressed]}
        >
          <View style={{ flex: 1 }}>
            <T size={13} color={colors.textMuted}>
              다음 수입일까지 남은 생활비
            </T>
            <T size={17} weight="700" num style={{ marginTop: 2 }}>
              {won(Math.max(0, s.remainingNow))}원
            </T>
          </View>
          <View style={styles.dPill}>
            <T size={12} weight="700" color={colors.brandDark} num>
              D-{dPay}
            </T>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      <DowBudgetCard />

      {/* 지난 일정 정산 요청 */}
      {toSettle.map((x) => (
        <Card key={x.id} onPress={() => router.push(demoRoutes.settle(x.id))} style={styles.settle}>
          <IconCircle name="receipt" color={colors.info} size={40} />
          <View style={{ flex: 1 }}>
            <T size={14} weight="700">
              ‘{x.title}’ 얼마 썼나요?
            </T>
            <T size={12} color={colors.textMuted}>
              예상 {won(x.amount)}원. 실제 결제와 연결하면 다음 예측이 정확해져요
            </T>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Card>
      ))}

      {/* 이번 주 예정된 소비 */}
      <Card>
        <SectionTitle
          title="이번 주 후보 거래"
          right={
            <Pressable accessibilityRole="button" onPress={() => router.push(demoRoutes.schedule)} style={styles.more} hitSlop={8}>
              <T size={13} color={colors.textMuted}>
                {thisWeek.length}건 {won(thisWeek.reduce((a, x) => a + x.amount, 0))}원
              </T>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            </Pressable>
          }
        />
        {thisWeek.length === 0 ? (
          <View style={styles.empty}>
            <T size={14} color={colors.textMuted} style={{ textAlign: 'center', lineHeight: 20 }}>
              이번 주에 예정된 소비가 없어요{'\n'}일정을 적으면 AI가 예상 금액을 미리 빼둘게요
            </T>
          </View>
        ) : (
          <View style={{ gap: 8, marginBottom: 12 }}>
            {thisWeek.map((x) => (
              <ScheduleRow key={x.id} item={x} today={today} />
            ))}
          </View>
        )}
        <AddButton label="소비 일정 추가" onPress={() => router.push(demoRoutes.scheduleNew)} />
      </Card>

      {/* 고액 지출 D-day */}
      <Card>
        <SectionTitle title="다가오는 고액 지출" />
        {upcomingPlans.length === 0 ? (
          <View style={styles.empty}>
            <T size={14} color={colors.textMuted}>
              계획된 고액 지출이 없어요
            </T>
          </View>
        ) : (
          <View style={{ gap: 10, marginBottom: 12 }}>
            {upcomingPlans.map((p) => {
              const ws = fromKey(p.weekStart);
              const dday = diffDays(ws, today);
              return (
                <View key={p.id} style={styles.plan}>
                  <IconCircle name="flag" color={colors.brand} size={42} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T size={15} weight="700">
                      {p.title}
                    </T>
                    <T size={12} color={colors.textMuted}>
                      {weekLabel(ws)}, 하루 {won(planDailyReserve(p, today))}원씩 모으는 중
                    </T>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Badge
                      label={dday <= 0 ? '이번 주' : `D-${dday}`}
                      color={dday <= 7 ? colors.danger : colors.brandDark}
                      bg={dday <= 7 ? colors.dangerSoft : colors.brandSoft}
                    />
                    <T size={14} weight="700">
                      {won(p.amount)}원
                    </T>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        <AddButton label="고액 지출 계획하기" onPress={() => router.navigate(demoRoutes.plan)} />
      </Card>
    </Screen>
  );
}

/** 요일별 하루 예산 — 소비 패턴 분석으로 요일마다 비중(%)을 다르게 배분한 결과 */
export function DowBudgetCard() {
  const { today, summary: s } = useStore();
  const max = Math.max(1, ...s.dowPlan.map((d) => d.weight));
  return (
    <Card>
      <SectionTitle title="요일별 하루 예산" right={<Badge label="소비 패턴 분석" color={colors.brandDark} bg={colors.brandSoft} />} />
      <T size={12} color={colors.textMuted} style={{ marginBottom: 14, lineHeight: 18 }}>
        남은 생활비 {won(Math.max(0, s.remainingNow + s.todaySpent))}원을 요일별 소비 비중으로 나눴어요. 많이 쓰는 요일엔 더, 덜 쓰는 요일엔 덜 배정해요.
      </T>
      <View style={{ gap: 10 }}>
        {s.dowPlan.map((d) => {
          const isToday = toKey(d.date) === toKey(today);
          return (
            <View key={toKey(d.date)} style={styles.dowRow}>
              <T size={13} weight={isToday ? '800' : '600'} color={isToday ? colors.brandDark : colors.textSub} style={{ width: 22 }}>
                {DOW[d.date.getDay()]}
              </T>
              <View style={styles.dowTrack}>
                <View
                  style={[styles.dowFill, { width: `${(d.weight / max) * 100}%`, backgroundColor: isToday ? colors.brand : colors.brandBorder }]}
                />
              </View>
              <T size={12} color={colors.textMuted} num style={{ width: 34, textAlign: 'right' }}>
                {d.weight}%
              </T>
              <T size={13} weight={isToday ? '800' : '600'} num style={{ width: 82, textAlign: 'right' }}>
                {won(d.amount)}원
              </T>
            </View>
          );
        })}
      </View>
      <T size={11} color={colors.textMuted} style={{ marginTop: 12 }}>
        오늘 = 남은 생활비 × {s.todayWeight}% ÷ 남은 기간 비중 합 {s.weightTotal}%
      </T>
    </Card>
  );
}

/** 오늘 쓸 수 있는 돈 — 파란 메인 카드 (기존 홈 / 캐릭터 홈 공용)
 *  화면에서 유일하게 '큰' 요소. 아래 급여 주기 스트립은 수입일~다음 수입일을 하루 한 칸으로 보여준다. */
export function TodayHeroCard() {
  const { today, summary: s, transactions } = useStore();
  const lastPay = transactions.find((t) => t.date === toKey(today) && t.amount < 0);
  const over = s.todayAvailable < 0;
  const shown = useRollingNumber(Math.max(0, s.todayAvailable));

  const totalDays = diffDays(s.cycleEnd, s.cycleStart) + 1;
  const todayIdx = diffDays(today, s.cycleStart);

  return (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <T size={15} weight="700" color={colors.onBrand}>
          오늘 쓸 수 있는 돈
        </T>
        <T size={13} weight="500" color={colors.onBrandSub}>
          {today.getMonth() + 1}월 {today.getDate()}일 {DOW[today.getDay()]}요일
        </T>
      </View>

      <T
        size={44}
        weight="800"
        color={colors.onBrand}
        num
        style={{ marginTop: 6, lineHeight: 52 }}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`오늘 쓸 수 있는 돈 ${won(Math.max(0, s.todayAvailable))}원`}
      >
        {won(shown)}
        <T size={26} weight="700" color={colors.onBrand}>
          원
        </T>
      </T>

      {over ? (
        <T size={13} weight="600" color="#FFE1DE" style={{ marginTop: 2 }} num>
          오늘 {won(-s.todayAvailable)}원 넘게 썼어요. 남은 {s.daysLeft - 1}일에 나눠서 반영할게요
        </T>
      ) : (
        <T size={13} color={colors.onBrandSub} style={{ marginTop: 2 }} num>
          {DOW[today.getDay()]}요일 기준 {won(s.dailyLimit)}원({s.todayWeight}%) 중 {won(s.todaySpent)}원 썼어요
        </T>
      )}
      {/* 급여 주기 스트립 */}
      <View style={styles.cycle} accessible accessibilityLabel={`급여 주기 ${totalDays}일 중 ${todayIdx + 1}일째, 다음 수입일까지 ${s.daysLeft}일`}>
        <View style={styles.ticks}>
          {Array.from({ length: totalDays }, (_, i) => (
            <View
              key={i}
              style={[
                styles.tick,
                i < todayIdx && styles.tickPast,
                i === todayIdx && styles.tickToday,
              ]}
            />
          ))}
        </View>
        <View style={styles.rowBetween}>
          <T size={12} color={colors.onBrandSub} num>
            {md(s.cycleStart)} 급여
          </T>
          <T size={12} weight="700" color={colors.onBrand} num>
            다음 급여까지 {s.daysLeft}일
          </T>
        </View>
      </View>

      {s.todayPlanned.length > 0 && (
        <View style={styles.heroPlan}>
          <Ionicons name="calendar" size={14} color={colors.onBrand} />
          <T size={13} weight="600" color={colors.onBrand} style={{ flex: 1 }} numberOfLines={2} num>
            {s.todayPlanned.map((x) => x.title).join(', ')} {won(s.todayPlanned.reduce((a, x) => a + x.amount, 0))}원은 미리 빼뒀어요
          </T>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [styles.heroFoot, pressed && { opacity: 0.7 }]}
        onPress={() => router.push(demoRoutes.budgetDetail)}
        accessibilityRole="button"
        accessibilityLabel="계산 근거 보기"
      >
        <T size={12} color={colors.onBrandSub} numberOfLines={1} style={{ flex: 1 }} num>
          {lastPay ? `방금 ${lastPay.merchant} ${won(-lastPay.amount)}원 반영 (${lastPay.time})` : '오늘 05:00에 마지막으로 계산했어요'}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <T size={12} weight="700" color={colors.onBrand}>
            계산 근거
          </T>
          <Ionicons name="chevron-forward" size={14} color={colors.onBrand} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.brand, borderRadius: radius.xl, padding: 22, paddingBottom: 14 },
  heroTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  heroBar: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)', marginTop: 12, overflow: 'hidden' },
  heroFill: { height: 4, borderRadius: 2 },
  cycle: { marginTop: 18, gap: 8 },
  ticks: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 16 },
  tick: { flex: 1, height: 10, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.45)' },
  tickPast: { backgroundColor: 'rgba(0,20,90,0.35)' },
  tickToday: { height: 16, backgroundColor: colors.onBrand },
  heroPlan: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brandDeep,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.sm,
  },
  heroFoot: {
    marginTop: 14,
    paddingTop: 12,
    minHeight: 36,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.22)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panel: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden' },
  panelRow: { padding: 20 },
  panelRowSm: { paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  panelPressed: { backgroundColor: colors.brandSofter },
  dowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dowTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.bg, overflow: 'hidden' },
  dowFill: { height: 8, borderRadius: 4 },
  hair: { height: 1, backgroundColor: colors.line, marginHorizontal: 20 },
  dPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.brandSoft },
  settle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.sunken, marginTop: 14, marginBottom: 10, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.brand },
  empty: { paddingVertical: 18, alignItems: 'center', marginBottom: 12 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
