import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button, Card, Screen, Sheet, T } from "@/components/ui";
import { TodayHeroView } from "@/components/TodayHeroView";
import { colors } from "@/theme";
import { ErrorNotice, Loading, money, useResource } from "./ui";
import type { Today, Transaction } from "./types";
export function HomeScreen() {
  const result = useResource<Today>("/budget/today");
  const [basis, setBasis] = useState(false);
  const s = result.data;
  const ledger = useResource<{ items: Transaction[] }>(
    s ? `/transactions?from=${s.cycleStart}&to=${s.date}` : null,
  );
  return (
    <Screen>
      {result.loading && !s && <Loading />}
      <ErrorNotice error={result.error} retry={result.retry} />
      {s && (
        <>
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
            caption="입력한 잔액·기록 기준 추정"
            footerCaption={`마지막 확인 ${result.confirmedAt?.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }) ?? ""}`}
            onDetails={() => setBasis(true)}
          />
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
              이번 주 쓴 돈
            </T>
            <T size={26} weight="800">
              {money(s.weekSpent)}원
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
          <ErrorNotice error={ledger.error} retry={ledger.retry} />
          {ledger.data?.items.length === 0 && (
            <Card>
              <T>이번 정산 주기에 기록한 거래가 없어요</T>
              <T size={13}>수동으로 거래를 기록해보세요</T>
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
