import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, ScrollView, View } from "react-native";
import { Button, Card, ConfirmModal, T } from "@/components/ui";
import { colors } from "@/theme";
import { api, ApiError, sessionGeneration } from "./api/client";
import { useSession } from "./Session";
import { readStorage, writeStorage } from "./storage";
import { ErrorNotice, Field, Loading, Page } from "./ui";
import { useServerExtensions } from "./serverExtensions";
import type { ChatRequest, ChatResponse } from "./types";

type Mate = NonNullable<ChatRequest["mate"]>;
type Message = ChatRequest["messages"][number] & {
  action?: ChatResponse["action"];
  applied?: boolean;
};
const MATES = [
  {
    id: "ANALYST" as const,
    name: "똑똑한 분석가",
    description: "입력한 기록을 차분하게 살펴봐요",
  },
  {
    id: "FRIEND" as const,
    name: "다정한 친구",
    description: "따뜻한 말로 함께 정리해요",
  },
  {
    id: "COACH" as const,
    name: "따끔한 조언가",
    description: "실천할 일을 분명하게 짚어봐요",
  },
];
const KEY = "chatbot.mate";
const topics = [
  "오늘 예산을 넘겼어요. 기록을 바탕으로 도움을 주세요",
  "이번 기간 지출 흐름을 알려 주세요",
  "요일별 생활비 배분을 어떻게 바꾸면 좋을까요?",
];

/** #202의 메이트 선택·질문·대화 흐름을 #200의 실제 Gemini API로 연결한다. */
export function ChatbotScreen() {
  const extensions = useServerExtensions();
  if (!extensions.available)
    return (
      <Page title="AI 메이트">
        {extensions.checking ? (
          <Loading />
        ) : (
          <T>
            AI 메이트를 준비 중이에요. 현재는 기록한 지출과 소비 분석을 확인해
            주세요
          </T>
        )}
      </Page>
    );
  return <ChatbotRoom />;
}
function ChatbotRoom() {
  const params = useLocalSearchParams<{ question?: string }>();
  const [mate, setMate] = useState<Mate>("ANALYST");
  const [choosing, setChoosing] = useState(true);
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState(params.question?.slice(0, 1000) ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [proposal, setProposal] = useState<{
    index: number;
    action: NonNullable<ChatResponse["action"]>;
  } | null>(null);
  const [retryBody, setRetryBody] = useState<ChatRequest>();
  const lock = useRef(false);
  const request = useRef<AbortController | null>(null);
  const focus = useRef(0);
  const session = useSession();
  useFocusEffect(
    useCallback(() => {
      ++focus.current;
      setBusy(false);
      lock.current = false;
      return () => {
        ++focus.current;
        request.current?.abort();
        lock.current = false;
      };
    }, []),
  );
  useEffect(() => {
    let alive = true;
    readStorage(KEY)
      .then((saved) => {
        const previous = MATES.find((m) => m.id === saved?.toUpperCase());
        if (alive && previous) {
          setMate(previous.id);
          setChoosing(false);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  const send = async (body: ChatRequest) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    setRetryBody(body);
    const started = focus.current;
    const generation = sessionGeneration();
    const controller = new AbortController();
    request.current = controller;
    try {
      const result = await api<ChatResponse>("/chat/messages", {
        method: "POST",
        body,
        timeoutMs: 40000,
        signal: controller.signal,
      });
      if (started !== focus.current || generation !== sessionGeneration())
        return;
      setMessages((m) => [
        ...m,
        { role: "MODEL", text: result.reply, action: result.action },
      ]);
      setRetryBody(undefined);
    } catch (e) {
      if (started === focus.current && generation === sessionGeneration())
        setError(
          e instanceof ApiError && e.code === "CHAT_UNAVAILABLE"
            ? "AI 메이트를 준비 중이에요. 연결 설정이 끝나면 답변을 받을 수 있어요"
            : e,
        );
    } finally {
      if (started === focus.current && generation === sessionGeneration()) {
        lock.current = false;
        setBusy(false);
      }
    }
  };
  const ask = (text: string) => {
    if (lock.current || !text.trim()) return;
    const next: Message = { role: "USER", text: text.trim().slice(0, 1000) };
    const history = [...messages, next];
    setMessages(history);
    setDraft("");
    void send({
      mate,
      messages: history
        .slice(-20)
        .map((m) => ({ role: m.role, text: m.text.slice(0, 1000) })),
    });
  };
  const choose = (value: Mate) => {
    setMate(value);
    setChoosing(false);
    writeStorage(KEY, value).catch(() => {});
  };
  const apply = async () => {
    const next = proposal;
    setProposal(null);
    if (!next || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    const started = focus.current;
    const generation = sessionGeneration();
    try {
      await api("/budget/day-weights", {
        method: "PUT",
        body: { preset: next.action.preset },
      });
      if (started !== focus.current || generation !== sessionGeneration())
        return;
      session.invalidate();
      setMessages((m) =>
        m.map((item, i) =>
          i === next.index ? { ...item, applied: true } : item,
        ),
      );
    } catch (e) {
      if (started === focus.current) setError(e);
    } finally {
      if (started === focus.current) {
        lock.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <Page
      title="AI 메이트"
      footer={
        ready && !choosing ? (
          <View style={{ gap: 8 }}>
            <Field
              label="AI 메이트에게 질문"
              placeholder="궁금한 내용을 입력해 보세요"
              value={draft}
              onChangeText={setDraft}
              maxLength={1000}
              multiline
              editable={!busy}
            />
            <Button
              label={busy ? "답변을 기다리고 있어요" : "보내기"}
              disabled={busy || !draft.trim()}
              onPress={() => ask(draft)}
            />
          </View>
        ) : undefined
      }
    >
      {!ready ? (
        <T>메이트를 준비하고 있어요</T>
      ) : choosing ? (
        <>
          <Image
            source={require("../../assets/chatbot/mate.png")}
            style={{ width: 140, height: 140, alignSelf: "center" }}
            accessibilityLabel="AI 메이트 캐릭터"
          />
          <T size={20} weight="800">
            함께할 메이트를 골라 주세요
          </T>
          {MATES.map((m) => (
            <Card
              key={m.id}
              accessibilityLabel={m.name}
              onPress={() => choose(m.id)}
              style={{ gap: 8 }}
            >
              <T weight="700">{m.name}</T>
              <T size={13}>{m.description}</T>
            </Card>
          ))}
        </>
      ) : (
        <>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <T weight="700">{MATES.find((m) => m.id === mate)?.name}</T>
            <Button
              label="말투 바꾸기"
              variant="ghost"
              disabled={busy}
              onPress={() => setChoosing(true)}
            />
          </View>
          <Card style={{ gap: 8 }}>
            <T size={13}>
              입력한 잔액·기록 기준으로 도움을 드려요. 질문하면 예산
              요약·카테고리별 지출 합계와 이 대화를 Google Gemini에 보내요. 거래
              제목·메모·개별 거래는 자동으로 보내지 않아요. 대화는 저장하지
              않아요
            </T>
            <T size={13}>
              금액은 앱의 계산 결과를 확인해 주세요. 배분 변경은 확인한 뒤에만
              저장돼요
            </T>
          </Card>
          {messages.length === 0 &&
            topics.map((topic) => (
              <Button
                key={topic}
                label={topic}
                variant="soft"
                disabled={busy}
                onPress={() => ask(topic)}
              />
            ))}
          <ScrollView
            contentContainerStyle={{ gap: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((m, index) => (
              <Card
                key={index}
                style={{
                  gap: 8,
                  backgroundColor:
                    m.role === "USER" ? colors.brandSoft : colors.card,
                  marginLeft: m.role === "USER" ? 24 : 0,
                  marginRight: m.role === "MODEL" ? 24 : 0,
                }}
              >
                <T size={12} weight="700">
                  {m.role === "USER" ? "나" : "AI 메이트"}
                </T>
                <T selectable style={{ lineHeight: 23 }}>
                  {m.text}
                </T>
                {m.action && (
                  <Button
                    label={
                      m.applied
                        ? "배분 변경 완료"
                        : `${m.action.label} 적용 확인`
                    }
                    variant="soft"
                    disabled={busy || m.applied}
                    onPress={() => setProposal({ index, action: m.action! })}
                  />
                )}
              </Card>
            ))}
          </ScrollView>
          {busy && (
            <T accessibilityLiveRegion="polite">
              AI 메이트가 답변을 준비하고 있어요
            </T>
          )}
          <ErrorNotice
            error={error}
            retry={retryBody ? () => void send(retryBody) : undefined}
          />
          {!!messages.length && (
            <Button
              label="새 대화"
              variant="ghost"
              disabled={busy}
              onPress={() => {
                setMessages([]);
                setError(undefined);
                setRetryBody(undefined);
              }}
            />
          )}
        </>
      )}
      <ConfirmModal
        visible={!!proposal}
        title="요일별 배분을 바꿀까요?"
        message={`${proposal?.action.label ?? ""} 배분으로 바꾸면 오늘 하루 예산부터 반영돼요`}
        confirmLabel="확인하고 변경"
        onCancel={() => setProposal(null)}
        onConfirm={() => void apply()}
      />
    </Page>
  );
}
