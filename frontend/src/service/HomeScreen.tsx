import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button, Card, Screen, Sheet, T } from "@/components/ui";
import {
  CharacterStage,
  pointsStatus,
  type Level,
  type PaceStatus,
} from "@/components/CharacterHero";
import { TodayHeroView } from "@/components/TodayHeroView";
import { colors } from "@/theme";
import { useHomeStyle } from "./homeStyle";
import { ErrorNotice, Loading, money, useResource } from "./ui";
import type { Today } from "./types";
export function HomeScreen() {
  const result = useResource<Today>("/budget/today");
  const [basis, setBasis] = useState(false);
  const [style] = useHomeStyle();
  const s = result.data;
  const status = s && statusOf(s);
  const hero = s && (
    <TodayHeroView
      today={new Date(s.date + "T12:00:00")}
      summary={{
        todayAvailable: s.todayAvailable,
        cycleStart: new Date(s.cycleStart + "T12:00:00"),
        cycleEnd: new Date(
          new Date(s.nextPayday + "T12:00:00").getTime() - 86400000,
        ),
        daysLeft: s.daysLeft,
        dailyLimit: s.dailyBudget,
        todayWeight: 100,
        todaySpent: s.todaySpent,
        todayPlanned: [],
      }}
      caption={null}
      showCycle={false}
      footerCaption={`마지막 확인 ${result.confirmedAt?.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }) ?? ""}`}
      onDetails={() => setBasis(true)}
    />
  );
  return (
    <Screen>
      {result.loading && !s && <Loading />}
      <ErrorNotice error={result.error} retry={result.retry} />
      {s && status && (
        <>
          {style === "character" ? (
            <CharacterStage
              level={status.level}
              gauge={status}
              message={messageOf(s, status.level)}
            >
              {hero}
            </CharacterStage>
          ) : (
            hero
          )}
          {s.shortage > 0 && (
            <Card style={{ backgroundColor: colors.dangerSoft }}>
              <T color={colors.danger} weight="700">
                {s.remaining < 0 ? "다음 수입일까지" : "오늘 예산보다"}{" "}
                {money(s.shortage)}원이 부족해요
              </T>
              <T size={13}>예산 설정에서 잔액과 남겨둘 돈을 확인해 보세요</T>
            </Card>
          )}
          <Card style={{ gap: 14 }}>
            <T size={14} color={colors.textSub}>
              이번 주 쓸 수 있는 돈
            </T>
            <T size={26} weight="800">
              {money(s.weekAvailable)}원
            </T>
            <T size={13} color={colors.textMuted}>
              남은 {s.weekDaysLeft}일 · 이번 주 쓴 돈 {money(s.weekSpent)}원
            </T>
            <View style={{ height: 1, backgroundColor: colors.line }} />
            <T size={13} color={colors.textMuted}>
              다음 수입일까지 남은 생활비
            </T>
            <T size={20} weight="700">
              {money(Math.max(0, s.remaining))}원
            </T>
          </Card>
          <Card style={{ gap: 10 }}>
            <T weight="700">요일별 생활비 예산 · 기본 배분</T>
            <T size={13} color={colors.textMuted}>
              하루 {money(s.dailyBudget)}원씩 계산해요
            </T>
            <View style={{ flexDirection: "row", gap: 4 }}>
              {["월", "화", "수", "목", "금", "토", "일"].map((d) => (
                <View key={d} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                  <View
                    style={{
                      width: "100%",
                      height: 28,
                      backgroundColor: colors.brandSoft,
                      borderRadius: 6,
                    }}
                  />
                  <T size={12}>{d}</T>
                </View>
              ))}
            </View>
          </Card>
          {!s.hasTransactions && (
            <Card>
              <T>아직 기록한 거래가 없어요</T>
              <T size={13}>수동으로 첫 거래를 기록해보세요</T>
            </Card>
          )}
          <Button
            label="+ 거래 직접 기록"
            onPress={() => router.push("/transactions/new")}
          />
          <Sheet
            visible={basis}
            onClose={() => setBasis(false)}
            title="오늘 예산의 계산 근거"
          >
            <View style={{ gap: 12 }}>
              {[
                ["추정 잔액", s.estimatedBalance],
                ["남겨둘 고정지출", s.reservedFixed],
                ["카드 미결제액", s.cardUnpaid],
                ["보호 금액", s.protectedTotal],
                ["오늘 쓴 돈", s.todaySpent],
              ].map(([label, n]) => (
                <View
                  key={label}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <T>{label}</T>
                  <T weight="700">{money(Number(n))}원</T>
                </View>
              ))}
              <T size={13}>
                입력한 잔액·기록 기준 추정으로, 실제 은행 잔액과 다를 수 있어요
              </T>
              <Button
                label="예산 설정 수정"
                onPress={() => {
                  setBasis(false);
                  router.push("/onboarding");
                }}
              />
            </View>
          </Sheet>
        </>
      )}
    </Screen>
  );
}
// Mirrors the server rule in docs/API.md: a kept day adds 15 points, an overspent day takes 50, within 0-400.
const UP = 15;
const DOWN = 50;
const MAX = 400;
// The level is earned over days, so warnings come from today's numbers and the rest describe progression.
const LEVEL_MESSAGES: Record<Level, string> = {
  1: "광부에서 시작! 예산을 지키면 조금씩 올라가요",
  2: "한 단계 올라왔어요. 오늘도 한도 안에서 써요",
  3: "잘 버티는 중! 꾸준히 지키면 더 올라가요",
  4: "예산을 잘 지키고 있어요. 이 정도면 플렉스 가능!",
  5: "완벽해요! 예산 관리의 왕이에요",
};
function messageOf(s: Today, level: Level): string {
  if (s.remaining < 0) return "남은 생활비가 모자라요. 예산 설정을 확인해요";
  if (s.todaySpent > s.dailyBudget)
    return "오늘 예산을 넘었어요. 내일은 한도 안에서 써요";
  return LEVEL_MESSAGES[level];
}
function statusOf(s: Today): PaceStatus {
  const points = Math.min(MAX, Math.max(0, s.characterPoints ?? 0));
  const delta = s.characterDelta ?? 0;
  const yesterday =
    delta > 0
      ? `어제 지켜서 +${delta}%`
      : delta < 0
        ? `어제 넘어서 ${delta}%`
        : null;
  const up = Math.min(UP, MAX - points);
  const down = Math.min(DOWN, points);
  const today =
    s.todaySpent <= s.dailyBudget
      ? up > 0
        ? `오늘 지키면 내일 +${up}%`
        : "오늘도 지키면 최고 단계 유지"
      : down > 0
        ? `오늘 예산을 넘어서 내일 -${down}%`
        : "오늘 예산을 넘었어요";
  return pointsStatus(points, yesterday ? `${yesterday} · ${today}` : today);
}
