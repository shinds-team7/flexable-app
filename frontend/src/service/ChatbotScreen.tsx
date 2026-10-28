/** AI 메이트(챗봇) 화면 시안. 더미 데이터만 쓰고 서버를 부르지 않는다. 스타일 선택 → 메뉴 → 대화 3단계. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  type ViewStyle,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Donut } from '@/components/Donut';
import { goBack } from '@/components/SubHeader';
import { T } from '@/components/ui';
import { colors, elevation1, noOutline, pressTransition, radius, space, type } from '@/theme';
import { won } from '@/utils/format';
import {
  dummyBudget,
  dummyCategories,
  dummyExpenseTotal,
  dummyPlan,
  dummyTips,
  dummyWeek,
  mates,
  topicIntro,
  topics,
  type Card,
  type MateId,
  type TopicId,
} from './chatbotDummy';
import { readStorage, writeStorage } from './storage';
import { CategoryIcon } from './ui';

const mateImg = require('../../assets/chatbot/mate.png');
const MATE_KEY = 'chatbot.mate';
const COMPOSER_HINT = '궁금한 내용을 입력해보세요...';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Action = { label: string; run: () => void };
type Msg = { id: number; from: 'bot' | 'me'; text: string; card?: Card; amount?: number; actions?: Action[]; used?: boolean };
type Step = 'loading' | 'select' | 'menu' | 'chat';

export function ChatbotScreen() {
  const [step, setStep] = useState<Step>('loading');
  const [mate, setMate] = useState<MateId>('analyst');
  // 톱니로 스타일 선택을 열었으면 돌아갈 화면(메뉴·대화), 처음 선택이면 null
  const [settingsFrom, setSettingsFrom] = useState<'menu' | 'chat' | null>(null);
  const [thanks, setThanks] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const nextId = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 한 번 고른 스타일은 저장해 두고 다음부터는 메뉴부터 보여 준다.
  useEffect(() => {
    readStorage(MATE_KEY)
      .then((v) => {
        if (mates.some((m) => m.id === v)) {
          setMate(v as MateId);
          setStep('menu');
        } else setStep('select');
      })
      .catch(() => setStep('select'));
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const mateName = mates.find((m) => m.id === mate)!.name;

  const push = (...items: Omit<Msg, 'id'>[]) =>
    setMsgs((m) => [...m, ...items.map((x) => ({ ...x, id: nextId.current++ }))]);

  // 봇 답은 잠깐 입력 중 표시를 보여 준 뒤 붙인다.
  const botSay = (...items: Omit<Msg, 'id'>[]) => {
    setTyping(true);
    timers.current.push(
      setTimeout(() => {
        setTyping(false);
        push(...items);
      }, 900),
    );
  };

  const keep = (amount: number): Action => ({
    label: `${won(amount)}원`,
    run: () => {
      push({ from: 'me', text: `${won(amount)}원 잡아 둬` });
      botSay({
        from: 'bot',
        text: `${dummyPlan.day}에 ${won(amount)}원을 잡아 뒀어요. 나머지는 남은 날에 요일 비중대로 다시 나눴어요.`,
        card: 'week',
        amount,
      });
    },
  });

  const planAsk = () =>
    botSay({
      from: 'bot',
      text: `입력한 기록 기준으로 보면 ${dummyPlan.day} ${dummyPlan.title}이 있던 날엔 평소보다 ${won(dummyPlan.estimate)}원쯤 더 썼어요.\n이만큼 잡아 둘까요?`,
      card: 'plan',
      actions: [
        { ...keep(dummyPlan.estimate), label: `${won(dummyPlan.estimate)}원 잡아 두기` },
        {
          label: '금액 바꾸기',
          run: () => {
            push({ from: 'me', text: '금액을 바꿀래' });
            botSay({ from: 'bot', text: '얼마로 잡아 둘까요?', actions: dummyPlan.options.map(keep) });
          },
        },
        {
          label: '괜찮아',
          run: () => {
            push({ from: 'me', text: '괜찮아' });
            botSay({ from: 'bot', text: '알겠어요. 잡아 두지 않고 지금 하루 예산을 그대로 둘게요.' });
          },
        },
      ],
    });

  const say = (text: string) => {
    push({ from: 'me', text });
    if (text.includes('약속')) return planAsk();
    botSay({ from: 'bot', text: '아직 시안이라 직접 입력한 질문에는 답하지 못해요. 메뉴의 질문을 눌러 보세요.' });
  };

  const startChat = (first: { topic: TopicId } | { text: string }) => {
    timers.current.forEach(clearTimeout);
    setTyping(false);
    setMsgs([]);
    push(
      {
        from: 'bot',
        text: thanks ? `선택해주셔서 고마워요!\n**${mateName}** 모드로\n지금부터 함께할게요.` : `**${mateName}** 모드로 함께할게요.`,
      },
      { from: 'bot', text: '어떤 걸 먼저 확인해볼까요?\n위의 메뉴를 선택하거나\n궁금한 걸 자유롭게 물어보세요!' },
    );
    setThanks(false);
    setStep('chat');
    if ('text' in first) return say(first.text);
    const intro = topicIntro[first.topic];
    push({ from: 'me', text: topics.find((t) => t.id === first.topic)!.title });
    botSay({
      from: 'bot',
      text: intro.text,
      actions: intro.quick.map((q) => ({
        label: q.label,
        run: () => {
          push({ from: 'me', text: q.label });
          if (q.card === 'plan') return planAsk();
          botSay({
            from: 'bot',
            text: q.reply ?? '',
            card: q.card,
            actions: q.follow?.map((f) => ({
              label: f.label,
              run: () => {
                push({ from: 'me', text: f.label });
                botSay({ from: 'bot', text: f.reply });
              },
            })),
          });
        },
      })),
    });
  };

  const act = (msgId: number, a: Action) => {
    setMsgs((m) => m.map((x) => (x.id === msgId ? { ...x, used: true } : x)));
    a.run();
  };

  const chooseMate = (m: MateId) => {
    setMate(m);
    writeStorage(MATE_KEY, m).catch(() => {});
    if (settingsFrom === 'chat') {
      setSettingsFrom(null);
      setStep('chat');
      push({ from: 'bot', text: `**${mates.find((x) => x.id === m)!.name}** 모드로 바꿨어요.` });
    } else if (settingsFrom === 'menu') {
      setSettingsFrom(null);
      setStep('menu');
    } else {
      setThanks(true);
      setStep('menu');
    }
  };

  if (step === 'loading') return <View style={styles.root} />;
  if (step === 'select')
    return (
      <MateSelect
        initial={mate}
        onDone={chooseMate}
        // 톱니에서 들어왔으면 연 화면(메뉴·대화)으로, 처음이면 챗봇을 나간다.
        onBack={() => {
          if (!settingsFrom) return goBack('/home');
          setStep(settingsFrom);
          setSettingsFrom(null);
        }}
      />
    );
  if (step === 'menu')
    return (
      <Menu
        mate={mate}
        onBack={() => goBack('/home')}
        onSettings={() => {
          setSettingsFrom('menu');
          setStep('select');
        }}
        onTopic={(t) => startChat({ topic: t })}
        onSend={(text) => startChat({ text })}
      />
    );
  return (
    <Chat
      mate={mate}
      msgs={msgs}
      typing={typing}
      onBack={() => {
        timers.current.forEach(clearTimeout);
        setTyping(false);
        setStep('menu');
      }}
      onSettings={() => {
        setSettingsFrom('chat');
        setStep('select');
      }}
      onAction={act}
      onSend={say}
    />
  );
}

/** 캐릭터 뒤의 옅은 파란 빛. */
function Hero({ dots }: { dots?: boolean }) {
  return (
    <View style={styles.hero}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 300 200" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="55%" rx="50%" ry="50%">
            <Stop offset="0" stopColor="#CFE0FF" stopOpacity="0.95" />
            <Stop offset="0.6" stopColor="#E4EDFF" stopOpacity="0.6" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx="150" cy="110" rx="150" ry="95" fill="url(#glow)" />
      </Svg>
      <Image source={mateImg} style={styles.heroImg} accessibilityLabel="AI 메이트 캐릭터" />
      {dots && (
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.dot} />
          ))}
        </View>
      )}
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="뒤로 가기" onPress={onPress} hitSlop={10} style={styles.backBtn}>
      <Ionicons name="chevron-back" size={24} color={colors.text} />
    </Pressable>
  );
}

/** 선택·메뉴·대화 공통 헤더. 세 화면이 같은 헤더를 써서 가운데만 바뀌는 한 대화방처럼 보인다. 설정 버튼이 없으면 자리만 둬 제목을 가운데에 맞춘다. */
function RoomHeader({ onBack, onSettings }: { onBack: () => void; onSettings?: () => void }) {
  return (
    <View style={styles.roomHeader}>
      <BackButton onPress={onBack} />
      <T size={17} weight="800" style={[styles.center, { flex: 1 }]}>
        AI 메이트
      </T>
      {onSettings ? <SettingsButton onPress={onSettings} /> : <View style={styles.backBtn} />}
    </View>
  );
}

/** 선택·메뉴·대화의 가운데 내용이 바뀔 때 살짝 올라오며 나타나게 한다. */
function EnterView({ style, children }: { style?: ViewStyle; children: ReactNode }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 260, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [v]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  return <Animated.View style={[{ flex: 1, opacity: v, transform: [{ translateY }] }, style]}>{children}</Animated.View>;
}

/** 메이트 스타일 선택을 연다(메뉴·대화 화면 오른쪽 위). */
function SettingsButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="메이트 스타일 바꾸기" onPress={onPress} hitSlop={10} style={styles.backBtn}>
      <Ionicons name="settings-outline" size={24} color={colors.text} />
    </Pressable>
  );
}

/** 1단계: 처음 한 번만 보이는 스타일 선택. 이후엔 메뉴·대화 화면 톱니에서 들어온다. */
function MateSelect({ initial, onDone, onBack }: { initial: MateId; onDone: (m: MateId) => void; onBack: () => void }) {
  const [sel, setSel] = useState(initial);
  return (
    <View style={styles.root}>
      <RoomHeader onBack={onBack} />
      <EnterView>
        <ScrollView contentContainerStyle={styles.selectContent} showsVerticalScrollIndicator={false}>
          <Hero />
          <View style={{ alignItems: 'center', gap: space[2] }}>
            <T size={22} weight="800" style={styles.center}>
              안녕하세요!{'\n'}내 금융 메이트예요 <T size={22} color={colors.brand}>💙</T>
            </T>
            <T size={type.meta} color={colors.textMuted} style={styles.center}>
              지금부터 어떤 스타일로{'\n'}도와드릴까요?
            </T>
          </View>
          <View style={{ gap: space[3] }}>
            <T size={type.body} weight="800">
              AI 메이트 스타일 선택하기
            </T>
            <View style={{ gap: 10 }} accessibilityRole="radiogroup">
              {mates.map((m) => {
                const on = m.id === sel;
                return (
                  <Pressable
                    key={m.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    onPress={() => setSel(m.id)}
                    style={({ pressed }) => [
                      styles.mateRow,
                      { backgroundColor: m.tint, borderColor: on ? colors.brand : 'transparent' },
                      pressTransition,
                      pressed && { transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <T size={26}>{m.emoji}</T>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T size={15} weight="800">
                        {m.name}
                      </T>
                      <T size={12} color={colors.textMuted}>
                        {m.desc}
                      </T>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={on ? colors.brand : colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onDone(sel)}
            style={({ pressed }) => [styles.cta, pressTransition, pressed && { transform: [{ scale: 0.98 }] }]}
          >
            {/* 웹은 크기를 안 주면 기본 300px 폭으로 그려 버튼 절반만 칠한다 */}
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
              <Defs>
                <LinearGradient id="cta" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#3D7BFF" />
                  <Stop offset="1" stopColor="#0046FF" />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#cta)" />
            </Svg>
            <T size={type.body} weight="800" color={colors.onBrand}>
              선택하고 시작하기
            </T>
          </Pressable>
        </View>
      </EnterView>
    </View>
  );
}

/** 2단계: 무엇을 도와드릴까요? 메뉴 4개 + 자유 질문 입력. */
function Menu({
  mate,
  onBack,
  onSettings,
  onTopic,
  onSend,
}: {
  mate: MateId;
  onBack: () => void;
  onSettings: () => void;
  onTopic: (t: TopicId) => void;
  onSend: (text: string) => void;
}) {
  const m = mates.find((x) => x.id === mate)!;
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <RoomHeader onBack={onBack} onSettings={onSettings} />
      <EnterView>
        <ScrollView contentContainerStyle={styles.menuContent} showsVerticalScrollIndicator={false}>
          {/* 가운데 정렬로 감싸면 Hero가 이미지 폭으로 줄어 배경 빛이 잘린다 */}
          <View style={{ gap: space[2] }}>
            <Hero dots />
            <View style={[styles.modeBadge, { alignSelf: 'center' }]}>
              <T size={12} weight="700" color={colors.brand}>
                {m.emoji} {m.name}
              </T>
            </View>
          </View>
          <View style={{ alignItems: 'center', gap: space[2] }}>
            <T size={20} weight="800">
              무엇을 도와드릴까요?
            </T>
            <T size={type.meta} color={colors.textMuted} style={styles.center}>
              원하는 메뉴를 선택하거나{'\n'}자유롭게 질문해보세요!
            </T>
          </View>
          <View style={styles.grid}>
            {topics.map((t) => (
              <Pressable
                key={t.id}
                accessibilityRole="button"
                onPress={() => onTopic(t.id)}
                style={({ pressed }) => [styles.topic, pressTransition, pressed && { transform: [{ scale: 0.97 }] }]}
              >
                <View style={[styles.topicIcon, { backgroundColor: t.color === colors.brand ? '#EEF3FF' : '#FFF6DB' }]}>
                  <Ionicons name={t.icon as IconName} size={22} color={t.color} />
                </View>
                <T size={type.meta} weight="800" style={styles.center}>
                  {t.title}
                </T>
                <T size={12} color={colors.textMuted} style={[styles.center, { lineHeight: 17 }]}>
                  {t.desc}
                </T>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </EnterView>
      <Composer placeholder={COMPOSER_HINT} onSend={onSend} />
    </KeyboardAvoidingView>
  );
}

/** 3단계: 대화. 헤더에 지금 스타일이 보이고 톱니로 스타일을 바꾼다. */
function Chat({
  mate,
  msgs,
  typing,
  onBack,
  onSettings,
  onAction,
  onSend,
}: {
  mate: MateId;
  msgs: Msg[];
  typing: boolean;
  onBack: () => void;
  onSettings: () => void;
  onAction: (msgId: number, a: Action) => void;
  onSend: (text: string) => void;
}) {
  const scroll = useRef<ScrollView>(null);
  const m = mates.find((x) => x.id === mate)!;
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <RoomHeader onBack={onBack} onSettings={onSettings} />
      <EnterView style={{ backgroundColor: '#F6F8FC' }}>
        <ScrollView
          ref={scroll}
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 메뉴의 캐릭터·스타일 이름을 작게 이어 받아 같은 대화방처럼 보이게 한다 */}
          <View style={styles.chatIntro}>
            <Image source={mateImg} style={styles.chatIntroImg} accessibilityLabel="AI 메이트 캐릭터" />
            <View style={[styles.modeBadge, { alignSelf: 'center' }]}>
              <T size={12} weight="700" color={colors.brand}>
                {m.emoji} {m.name}
              </T>
            </View>
          </View>
          {groupBot(msgs).map((g) =>
            g.from === 'me' ? (
              <MyBubble key={g.items[0].id} text={g.items[0].text} />
            ) : (
              <BotGroup key={g.items[0].id} items={g.items} onAction={onAction} />
            ),
          )}
          {typing && (
            <View style={styles.botRow}>
              <View style={styles.avatarSlot} />
              <TypingBubble />
            </View>
          )}
        </ScrollView>
      </EnterView>
      <Composer placeholder={COMPOSER_HINT} onSend={onSend} />
    </KeyboardAvoidingView>
  );
}

/** 이어진 봇 말풍선은 아바타 하나로 묶는다. */
function groupBot(msgs: Msg[]) {
  const out: { from: Msg['from']; items: Msg[] }[] = [];
  for (const m of msgs) {
    const last = out[out.length - 1];
    if (m.from === 'bot' && last?.from === 'bot') last.items.push(m);
    else out.push({ from: m.from, items: [m] });
  }
  return out;
}

function Composer({ placeholder, onSend }: { placeholder: string; onSend: (text: string) => void }) {
  const [draft, setDraft] = useState('');
  const ready = !!draft.trim();
  const send = () => {
    if (!ready) return;
    onSend(draft.trim());
    setDraft('');
  };
  return (
    <View style={styles.composer}>
      <View style={styles.plus}>
        <Ionicons name="add-circle-outline" size={30} color={colors.brand} />
      </View>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={send}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        style={[styles.input, noOutline]}
        returnKeyType="send"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="보내기"
        onPress={send}
        disabled={!ready}
        style={[styles.send, { backgroundColor: ready ? colors.brand : '#A9C3FF' }]}
      >
        <Ionicons name="arrow-up" size={20} color={colors.onBrand} />
      </Pressable>
    </View>
  );
}

function TypingBubble() {
  const [pulse] = useState(() => new Animated.Value(0.4));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 0.4, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.typing} accessibilityLabel="입력 중">
      <Animated.View style={[styles.typingBar, { opacity: pulse }]} />
    </View>
  );
}

/** **굵게** 표시를 지원하는 말풍선 글자. */
function Rich({ text, color }: { text: string; color?: string }) {
  return (
    <T size={15} color={color} style={{ lineHeight: 22 }}>
      {text.split('**').map((part, i) =>
        i % 2 ? (
          <T key={i} size={15} weight="800" color={color}>
            {part}
          </T>
        ) : (
          part
        ),
      )}
    </T>
  );
}

function MyBubble({ text }: { text: string }) {
  return (
    <View style={[styles.bubble, styles.mine]}>
      <Rich text={text} color={colors.onBrand} />
    </View>
  );
}

function BotGroup({ items, onAction }: { items: Msg[]; onAction: (msgId: number, a: Action) => void }) {
  return (
    <View style={styles.botRow}>
      <View style={styles.avatar}>
        <Image source={mateImg} style={styles.avatarImg} />
      </View>
      <View style={{ flex: 1, gap: space[2] }}>
        {items.map((msg) => (
          <View key={msg.id} style={{ gap: space[2] }}>
            <View style={[styles.bubble, styles.bot]}>
              <Rich text={msg.text} />
            </View>
            {msg.card === 'budget' && <BudgetCard />}
            {msg.card === 'top' && <TopCard />}
            {msg.card === 'compare' && <CompareCard />}
            {msg.card === 'tips' && <TipsCard />}
            {msg.card === 'plan' && <PlanCard />}
            {msg.card === 'week' && msg.amount != null && <WeekCard amount={msg.amount} />}
            {msg.actions && !msg.used && (
              <View style={styles.actions}>
                {msg.actions.map((a, i) => (
                  <Pressable
                    key={a.label}
                    accessibilityRole="button"
                    onPress={() => onAction(msg.id, a)}
                    style={({ pressed }) => [
                      styles.action,
                      i === 0 && styles.actionMain,
                      pressTransition,
                      pressed && { transform: [{ scale: 0.97 }] },
                    ]}
                  >
                    <T size={type.meta} weight="700" color={i === 0 ? colors.onBrand : colors.brand}>
                      {a.label}
                    </T>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function PlanCard() {
  const p = dummyPlan;
  return (
    <View style={styles.card}>
      <View style={styles.between}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <View style={[styles.catIcon, { backgroundColor: colors.warnSoft }]}>
            <Ionicons name="calendar" size={20} color={colors.warn} />
          </View>
          <View>
            <T weight="700">{p.title}</T>
            <T size={type.caption} color={colors.textMuted}>
              이번 주 {p.day}
            </T>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <T size={type.caption} color={colors.textMuted}>
            예상 추가 지출
          </T>
          <T size={22} weight="800" color={colors.warn} num>
            +{won(p.estimate)}원
          </T>
        </View>
      </View>
      <View style={styles.basis}>
        {p.basis.map((b) => (
          <View key={b.label} style={styles.between}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={b.icon as ComponentProps<typeof Ionicons>['name']} size={14} color={colors.textMuted} />
              <T size={type.caption} color={colors.textSub}>
                {b.label}
              </T>
            </View>
            <T size={type.caption} weight="600" num>
              {b.value}
            </T>
          </View>
        ))}
      </View>
      <T size={type.caption} color={colors.textMuted}>
        입력한 기록 기준 추정이라 실제와 다를 수 있어요
      </T>
    </View>
  );
}

const BAR_H = 120;

function WeekCard({ amount }: { amount: number }) {
  const w = dummyWeek;
  const after = w.after[amount] ?? w.before;
  const max = Math.max(...after, ...w.before);
  const other = after[w.today];
  return (
    <View style={styles.card}>
      <T size={type.caption} color={colors.textMuted}>
        남은 날 하루 예산
      </T>
      <View style={styles.bars}>
        {w.days.map((d, i) => {
          const plan = i === w.planDay;
          return (
            <View key={d} style={styles.barCol} accessibilityLabel={`${d}요일 ${won(after[i])}원`}>
              <T size={11} weight={plan ? '800' : '600'} color={plan ? colors.brand : colors.textSub} num>
                {won(after[i])}
              </T>
              <View style={[styles.barArea, { height: BAR_H }]}>
                <View style={[styles.barGhost, { height: (w.before[i] / max) * BAR_H }]} />
                <View
                  style={[
                    styles.bar,
                    { height: (after[i] / max) * BAR_H, backgroundColor: plan ? colors.brand : colors.brand + '55' },
                  ]}
                />
              </View>
              <T size={type.caption} weight={plan || i === w.today ? '700' : '400'} color={plan ? colors.brand : colors.textSub}>
                {i === w.today ? '오늘' : d}
              </T>
              {plan && (
                <View style={styles.planTag}>
                  <T size={10} weight="700" color={colors.warn}>
                    약속
                  </T>
                </View>
              )}
            </View>
          );
        })}
      </View>
      <View style={[styles.basis, { gap: space[2] }]}>
        <View style={styles.between}>
          <T size={type.caption} color={colors.textSub}>
            {w.days[w.planDay]}요일
          </T>
          <T size={type.caption} weight="700" color={colors.brand} num>
            {won(w.before[w.planDay])} → {won(after[w.planDay])}원
          </T>
        </View>
        <View style={styles.between}>
          <T size={type.caption} color={colors.textSub}>
            다른 날
          </T>
          <T size={type.caption} weight="700" num>
            {won(w.before[w.today])} → {won(other)}원
          </T>
        </View>
      </View>
    </View>
  );
}

function BudgetCard() {
  const b = dummyBudget;
  const usedRatio = 1 - b.monthLeft / b.monthBudget;
  return (
    <View style={styles.card}>
      <T size={type.caption} color={colors.textMuted}>
        오늘 쓸 수 있는 돈
      </T>
      <T size={30} weight="800" color={colors.brand} num>
        {won(b.todayAvailable)}원
      </T>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${usedRatio * 100}%`, backgroundColor: colors.brand }]} />
      </View>
      <View style={styles.between}>
        <Stat label="이번 달 남은 예산" value={`${won(b.monthLeft)}원`} />
        <Stat label="남은 날" value={`${b.daysLeft}일`} alignEnd />
      </View>
    </View>
  );
}

function Stat({ label, value, alignEnd }: { label: string; value: string; alignEnd?: boolean }) {
  return (
    <View style={{ alignItems: alignEnd ? 'flex-end' : 'flex-start', gap: 2 }}>
      <T size={type.caption} color={colors.textMuted}>
        {label}
      </T>
      <T size={type.body} weight="700" num>
        {value}
      </T>
    </View>
  );
}

function TopCard() {
  const top = dummyCategories.slice(0, 3);
  return (
    <View style={styles.card}>
      <View style={{ alignItems: 'center' }}>
        <Donut
          size={150}
          stroke={18}
          total={dummyExpenseTotal}
          segments={dummyCategories.map((c) => ({ value: c.amount, color: c.color }))}
        >
          <T size={12} color={colors.textMuted}>
            이번 달 지출
          </T>
          <T size={type.body} weight="800" num>
            {won(dummyExpenseTotal)}원
          </T>
        </Donut>
      </View>
      <View style={{ gap: space[3], marginTop: space[2] }}>
        {top.map((c, i) => {
          const ratio = c.amount / dummyExpenseTotal;
          return (
            <View key={c.id} style={styles.catRow}>
              <T size={type.caption} weight="700" color={colors.textMuted} style={{ width: 14 }}>
                {i + 1}
              </T>
              <View style={[styles.catIcon, { backgroundColor: c.color + '1A' }]}>
                <CategoryIcon icon={c.icon} color={c.color} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={styles.between}>
                  <T weight="600">{c.name}</T>
                  <T weight="700" num>
                    {won(c.amount)}원
                  </T>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: c.color }]} />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function CompareCard() {
  return (
    <View style={styles.card}>
      <View style={styles.between}>
        <T size={type.caption} color={colors.textMuted}>
          카테고리
        </T>
        <T size={type.caption} color={colors.textMuted}>
          지난달 대비
        </T>
      </View>
      {dummyCategories.map((c) => {
        const diff = c.amount - c.lastMonth;
        const up = diff > 0;
        return (
          <View key={c.id} style={styles.catRow}>
            <View style={[styles.catIcon, { backgroundColor: c.color + '1A' }]}>
              <CategoryIcon icon={c.icon} color={c.color} />
            </View>
            <View style={{ flex: 1 }}>
              <T weight="600">{c.name}</T>
              <T size={type.caption} color={colors.textMuted} num>
                {won(c.lastMonth)} → {won(c.amount)}원
              </T>
            </View>
            <View style={[styles.badge, { backgroundColor: up ? colors.dangerSoft : colors.positiveSoft }]}>
              <T size={type.caption} weight="700" color={up ? colors.danger : colors.positive} num>
                {up ? '▲' : '▼'} {won(Math.abs(diff))}
              </T>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function TipsCard() {
  return (
    <View style={[styles.card, { gap: space[4] }]}>
      {dummyTips.map((t) => (
        <View key={t.title} style={{ flexDirection: 'row', gap: space[3] }}>
          <View style={[styles.catIcon, { backgroundColor: colors.brandSoft }]}>
            <Ionicons name={t.icon as ComponentProps<typeof Ionicons>['name']} size={20} color={colors.brand} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T weight="700">{t.title}</T>
            <T size={type.meta} color={colors.textSub}>
              {t.body}
            </T>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.card },
  center: { textAlign: 'center' },
  roomHeader: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
    backgroundColor: colors.card,
  },
  chatIntro: { alignItems: 'center', gap: space[1], paddingBottom: space[2] },
  chatIntroImg: { width: 64, height: 64 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  hero: { height: 210, alignItems: 'center', justifyContent: 'center' },
  heroImg: { width: 180, height: 180 },
  dots: {
    position: 'absolute',
    // 화면 폭과 상관없이 캐릭터(가운데 180px) 오른쪽 위 머리 옆에 붙인다
    top: 28,
    left: '50%',
    marginLeft: 66,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: colors.card,
    ...elevation1,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brand },
  selectContent: { padding: space[5], paddingTop: 0, gap: space[5] },
  mateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  footer: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[5] },
  cta: {
    height: 54,
    borderRadius: radius.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 16px rgba(0,70,255,0.25)',
  },
  menuContent: { padding: space[5], paddingTop: 0, gap: space[5] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  topic: {
    flexBasis: '46%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: space[5],
    paddingHorizontal: space[3],
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: '#EEF1F6',
    ...elevation1,
  },
  topicIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.card,
  },
  plus: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
    backgroundColor: '#F3F5F9',
    fontSize: type.meta,
    color: colors.text,
  },
  send: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  modeBadge: { alignSelf: 'flex-start', paddingHorizontal: space[2], paddingVertical: 2, borderRadius: radius.pill, backgroundColor: '#EEF3FF' },
  listContent: { padding: space[4], gap: space[3] },
  botRow: { flexDirection: 'row', gap: space[2], alignItems: 'flex-start', maxWidth: '92%' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSlot: { width: 40 },
  // 얼굴이 보이게 크게 놓고 살짝 내린다
  avatarImg: { width: 58, height: 58, transform: [{ translateY: 5 }] },
  bubble: { paddingHorizontal: space[4], paddingVertical: space[3], borderRadius: 18, maxWidth: '100%' },
  bot: { alignSelf: 'flex-start', backgroundColor: colors.card, borderTopLeftRadius: 6, ...elevation1 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.brand, borderTopRightRadius: 6, maxWidth: '80%' },
  typing: {
    width: 150,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E6EEFF',
    justifyContent: 'center',
    paddingHorizontal: space[4],
  },
  typingBar: { width: 22, height: 4, borderRadius: 2, backgroundColor: colors.brand },
  card: { backgroundColor: colors.card, borderRadius: radius.soft, padding: space[4], gap: space[3], ...elevation1 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.sunken, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  catIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: space[2], paddingVertical: 4, borderRadius: radius.sm },
  basis: { backgroundColor: colors.sunken, borderRadius: radius.sm, padding: space[3], gap: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  action: {
    paddingHorizontal: 14,
    height: 36,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.card,
  },
  actionMain: { backgroundColor: colors.brand },
  bars: { flexDirection: 'row', gap: space[2], paddingTop: space[1] },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barArea: { width: '100%', maxWidth: 32, justifyContent: 'flex-end' },
  barGhost: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.textMuted,
  },
  bar: { borderRadius: 6 },
  planTag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.sm, backgroundColor: colors.warnSoft },
});
