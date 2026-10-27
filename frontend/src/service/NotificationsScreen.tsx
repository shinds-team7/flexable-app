import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Card, Screen, T } from "@/components/ui";
import { SubHeader } from "@/components/SubHeader";
import { colors } from "@/theme";
import { useInbox, type InboxItem } from "./inbox";
import { markInboxSeen } from "./inboxStore";
import { ErrorNotice, Loading, seoulDate } from "./ui";

/**
 * 알림함. 헤더 종 아이콘에서 들어온다. 최근 30일의 코인 적립·사용, 고정지출 자동 기록,
 * 오늘 예산 상태, 이 기기에서 보낸 시드머니·기록 알림을 최신순으로 보여 준다. 열면 모두 읽은 것으로 한다.
 */
export function NotificationsScreen() {
  const { id, items, seen, error, loading, retry } = useInbox();
  // 화면을 연 순간의 읽은 시각. 읽음 처리 뒤에도 이번에 새로 온 알림을 표시해 둔다.
  const [opened, setOpened] = useState<number>();
  if (opened === undefined && seen !== undefined) setOpened(seen);
  // 가장 최근 알림 시각까지만 읽음으로 한다. 지금 시각을 쓰면 읽음 기록이 바뀔 때마다 다시 읽고 또 기록하게 된다.
  useFocusEffect(
    useCallback(() => {
      if (!id || !items?.length) return;
      markInboxSeen(id, Math.max(...items.map((i) => i.at))).catch(() => {});
    }, [id, items]),
  );

  const groups = new Map<string, InboxItem[]>();
  (items ?? []).forEach((item) => {
    const d = seoulDay(item.at);
    groups.set(d, [...(groups.get(d) ?? []), item]);
  });

  return (
    <View style={{ flex: 1 }}>
      <SubHeader title="알림함" fallback="/home" />
      <Screen>
        <ErrorNotice error={error} retry={retry} />
        {loading ? (
          <Loading />
        ) : (
          items && (
            <Card style={{ paddingVertical: 8 }}>
              {groups.size === 0 && (
                <T style={{ paddingVertical: 24, textAlign: "center" }}>
                  최근 30일 동안 온 알림이 없어요
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
                  {list.map((item) => (
                    <Row
                      key={item.key}
                      item={item}
                      fresh={opened !== undefined && item.at > opened}
                    />
                  ))}
                </View>
              ))}
            </Card>
          )
        )}
      </Screen>
    </View>
  );
}

function seoulDay(at: number) {
  return new Date(at + 9 * 3600000).toISOString().slice(0, 10);
}

function Row({ item, fresh }: { item: InboxItem; fresh: boolean }) {
  const time = new Date(item.at + 9 * 3600000).toISOString().slice(11, 16);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[fresh ? "새 알림" : "", item.title, item.detail, time]
        .filter(Boolean)
        .join(", ")}
      onPress={() => router.push(item.href)}
      style={styles.row}
    >
      <View style={[styles.icon, { backgroundColor: item.color + "1F" }]}>
        <Ionicons name={item.icon} size={20} color={item.color} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <T weight="700" num numberOfLines={1}>
          {item.title}
        </T>
        {item.detail !== "" && (
          <T size={12} color={colors.textMuted} numberOfLines={2}>
            {item.detail}
          </T>
        )}
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <T size={12} color={colors.textMuted} num>
          {time}
        </T>
        {fresh && <View style={styles.dot} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
});
