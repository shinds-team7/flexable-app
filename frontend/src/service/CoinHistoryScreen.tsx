import { useRef, useState } from "react";
import { View } from "react-native";
import { Button, Card, Screen, T } from "@/components/ui";
import { SubHeader } from "@/components/SubHeader";
import { colors } from "@/theme";
import { sessionGeneration } from "./api/client";
import { getLedger } from "./coinApi";
import { ledgerDetail, ledgerTitle } from "./coinLedger";
import type { CoinLedgerEntry, CoinLedgerPage, CoinWallet } from "./types";
import {
  ErrorNotice,
  Loading,
  money,
  seoulDate,
  toSeoulInput,
  useResource,
} from "./ui";

/** 코인 적립·사용 내역. 홈 캐릭터 영상 위 코인 칩에서 들어온다(GET /coins/ledger, 최신순). */
export function CoinHistoryScreen() {
  const first = useResource<CoinLedgerPage>("/coins/ledger");
  const wallet = useResource<CoinWallet>("/coins");
  // Older pages hang off the first page they were read after; a refetched first page starts over.
  const [older, setOlder] = useState<{
    base: CoinLedgerPage;
    page: CoinLedgerPage;
  }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const lock = useRef(false);

  const base = first.data;
  const extra = base && older?.base === base ? older.page : undefined;
  const items = [...(base?.items ?? []), ...(extra?.items ?? [])];
  const nextBefore = extra ? extra.nextBefore : base?.nextBefore;

  const loadMore = async () => {
    if (lock.current || !base || nextBefore == null) return;
    lock.current = true;
    const generation = sessionGeneration();
    setBusy(true);
    setError(undefined);
    try {
      const page = await getLedger(nextBefore);
      if (generation !== sessionGeneration()) return;
      setOlder({
        base,
        page: {
          items: [...(extra?.items ?? []), ...page.items],
          nextBefore: page.nextBefore,
        },
      });
    } catch (e) {
      if (generation === sessionGeneration()) setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const groups = new Map<string, CoinLedgerEntry[]>();
  items.forEach((e) => {
    const d = toSeoulInput(e.createdAt).slice(0, 10);
    groups.set(d, [...(groups.get(d) ?? []), e]);
  });

  return (
    <View style={{ flex: 1 }}>
      <SubHeader title="코인 내역" fallback="/home" />
      <Screen>
        {wallet.data && (
          <Card>
            <T size={13} color={colors.textSub}>
              보유 코인
            </T>
            <View
              accessible
              accessibilityLabel={`보유 코인 ${wallet.data.balance}개`}
            >
              <T size={24} weight="800" num>
                🪙 {money(wallet.data.balance)}
              </T>
            </View>
          </Card>
        )}
        <ErrorNotice error={first.error} retry={first.retry} />
        {first.loading && !base ? (
          <Loading />
        ) : (
          base && (
            <Card style={{ paddingVertical: 8 }}>
              {groups.size === 0 && (
                <T style={{ paddingVertical: 24, textAlign: "center" }}>
                  코인 내역이 없어요
                </T>
              )}
              {[...groups].map(([date, list], i) => (
                <View
                  key={date}
                  style={
                    i > 0 && {
                      borderTopWidth: 1,
                      borderTopColor: colors.line,
                      marginTop: 6,
                    }
                  }
                >
                  <T
                    size={13}
                    weight="700"
                    style={{ paddingTop: 14, paddingBottom: 6 }}
                  >
                    {date === seoulDate() ? "오늘" : date}
                  </T>
                  {list.map((e) => (
                    <Row key={e.id} entry={e} />
                  ))}
                </View>
              ))}
            </Card>
          )
        )}
        <ErrorNotice error={error} retry={loadMore} />
        {nextBefore != null && (
          <Button
            label="더 보기"
            variant="soft"
            disabled={busy}
            onPress={loadMore}
          />
        )}
      </Screen>
    </View>
  );
}

function Row({ entry }: { entry: CoinLedgerEntry }) {
  const title = ledgerTitle(entry);
  const detail = ledgerDetail(entry);
  const time = toSeoulInput(entry.createdAt).slice(11, 16);
  return (
    <View
      accessible
      accessibilityLabel={[title, detail, time].filter(Boolean).join(", ")}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
      }}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <T
          weight="700"
          num
          color={entry.amount < 0 ? colors.text : colors.brand}
        >
          {title}
        </T>
        {detail !== "" && (
          <T size={12} color={colors.textMuted}>
            {detail}
          </T>
        )}
      </View>
      <T size={12} color={colors.textMuted} num>
        {time}
      </T>
    </View>
  );
}
