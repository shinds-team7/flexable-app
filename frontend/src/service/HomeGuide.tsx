import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Modal, View } from "react-native";
import { Button, styles as ui, T } from "@/components/ui";
import { colors, floating } from "@/theme";
import { RobotIcon } from "./ServiceHeader";
import { useSession } from "./Session";
import { readStorage, writeStorage } from "./storage";

/**
 * 가입 후 첫 홈 가이드. 처음 가입해 예산 설정을 마친 사용자에게만 한 번 보인다.
 * 온보딩 완료가 이 기기에 "pending"을 남기고, 홈은 가입 선물·출석 모달이 모두 닫힌 뒤 가이드를 띄운다.
 * 끝내거나 건너뛰면 "done"으로 바꿔 다시 띄우지 않는다. 기기마다 따로 저장한다(다른 기기·재설치는 보이지 않음).
 */
const key = (userId: number) => `flexable.service.homeGuide.${userId}`;

/** 온보딩을 처음 마쳤을 때 부른다. 실패해도 가이드만 안 보일 뿐이라 조용히 넘긴다 */
export function markHomeGuidePending(userId: number) {
  return writeStorage(key(userId), "pending").catch(() => {});
}

export function useHomeGuide() {
  const { user } = useSession();
  const id = user?.id;
  const [state, setState] = useState<{ id: number; pending: boolean }>();
  useEffect(() => {
    if (id === undefined) return;
    let alive = true;
    readStorage(key(id))
      .then((v) => alive && setState({ id, pending: v === "pending" }))
      .catch(() => alive && setState({ id, pending: false }));
    return () => {
      alive = false;
    };
  }, [id]);
  const finish = useCallback(() => {
    if (id === undefined) return;
    setState({ id, pending: false });
    void writeStorage(key(id), "done").catch(() => {});
  }, [id]);
  return { pending: state?.id === id && !!state?.pending, finish };
}

/** soft: 아이콘이 글자색이라 연한 바탕에 올린다 */
type Step = { icon: ReactNode; title: string; body: string; soft?: boolean };

export function HomeGuide({
  visible,
  ai,
  onDone,
}: {
  visible: boolean;
  /** AI 메이트를 쓸 수 있는 서버일 때만 그 안내를 넣는다 */
  ai: boolean;
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const steps: Step[] = [
    {
      icon: <Ionicons name="add" size={34} color={colors.onBrand} />,
      title: "+ 버튼으로 거래를 기록해요",
      body: "아래 가운데 + 버튼으로 쓴 돈·받은 돈을 직접 입력하거나 거래내역 이미지로 기록해요",
    },
    ...(ai
      ? [
          {
            icon: <RobotIcon size={34} />,
            soft: true,
            title: "AI 메이트에게 물어보세요",
            body: "오른쪽 위 로봇 버튼을 누르면 AI 메이트가 입력한 잔액·기록 기준으로 예산 질문에 답해요",
          },
        ]
      : []),
    {
      icon: <Ionicons name="shirt-outline" size={32} color={colors.onBrand} />,
      title: "캐릭터를 누르면 상점이에요",
      body: "홈 캐릭터를 누르면 코인으로 코스튬을 사고 바꿔 입힐 수 있어요",
    },
  ];
  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;
  const done = () => {
    setIndex(0);
    onDone();
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={done}
    >
      <View
        style={[
          ui.dim,
          ui.dimBg,
          { justifyContent: "center", padding: 28 },
        ]}
      >
        <View
          style={[ui.dialog, floating, { alignItems: "center" }]}
          accessibilityViewIsModal
        >
          <T size={13} weight="700" color={colors.brandDark}>
            {index + 1} / {steps.length}
          </T>
          <View
            style={{
              marginTop: 14,
              width: 64,
              height: 64,
              borderRadius: 32,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: step.soft ? colors.brandSoft : colors.brand,
            }}
          >
            {step.icon}
          </View>
          <T
            size={20}
            weight="800"
            accessibilityRole="header"
            style={{ marginTop: 16, textAlign: "center" }}
          >
            {step.title}
          </T>
          <T
            size={15}
            color={colors.textSub}
            style={{ marginTop: 8, textAlign: "center", lineHeight: 22 }}
          >
            {step.body}
          </T>
          <View
            style={{ flexDirection: "row", gap: 8, marginTop: 22, width: "100%" }}
          >
            {!last && (
              <Button
                label="건너뛰기"
                variant="soft"
                style={{ flex: 1, height: 48 }}
                onPress={done}
              />
            )}
            <Button
              label={last ? "시작하기" : "다음"}
              style={{ flex: 1, height: 48 }}
              onPress={last ? done : () => setIndex(index + 1)}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
