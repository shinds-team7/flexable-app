/** 챗봇 화면 시안용 더미 데이터. 서버 값이 아니며 계산하지 않는다. */

export type DummyCategory = { id: string; name: string; icon: string; color: string; amount: number; lastMonth: number };

export const dummyBudget = { todayAvailable: 23500, daysLeft: 5, monthLeft: 117500, monthBudget: 600000 };

export const dummyCategories: DummyCategory[] = [
  { id: 'food', name: '식비', icon: 'restaurant', color: '#0046FF', amount: 182000, lastMonth: 165000 },
  { id: 'delivery', name: '배달', icon: 'bicycle', color: '#FF8A00', amount: 96000, lastMonth: 64000 },
  { id: 'cafe', name: '카페', icon: 'cafe', color: '#8B5CF6', amount: 54000, lastMonth: 61000 },
  { id: 'transport', name: '교통', icon: 'bus', color: '#14B8A6', amount: 48000, lastMonth: 50000 },
  { id: 'shopping', name: '쇼핑', icon: 'bag-handle', color: '#F43F5E', amount: 32000, lastMonth: 58000 },
];

export const dummyExpenseTotal = dummyCategories.reduce((a, c) => a + c.amount, 0);

export const dummyTips = [
  { icon: 'bicycle', title: '배달은 주 2회로', body: '지난달보다 3만 2천 원 더 썼어요. 주 2회로 줄이면 한 달에 약 4만 원을 아낄 수 있어요.' },
  { icon: 'cafe', title: '카페는 잘 지키고 있어요', body: '지난달보다 7천 원 덜 썼어요. 지금처럼만 유지해요.' },
  { icon: 'calendar', title: '요일별 하루 예산 안에서', body: '남은 5일 동안 요일별로 나눈 하루 예산 안에서 쓰면 수입일까지 버틸 수 있어요.' },
];

export type Card = 'budget' | 'top' | 'compare' | 'tips' | 'plan' | 'week';

/** AI 메이트 스타일. 처음 한 번 고르고, 이후엔 설정(톱니)에서만 바꾼다. */
export type MateId = 'analyst' | 'friend' | 'coach';

export const mates: { id: MateId; name: string; desc: string; emoji: string; tint: string }[] = [
  { id: 'analyst', name: '똑똑한 분석가', desc: '데이터로 꼼꼼하게 분석해주는 타입', emoji: '💡', tint: '#EEF3FF' },
  { id: 'friend', name: '다정한 친구', desc: '부드럽고 친절하게 알려주는 타입', emoji: '😊', tint: '#F3F0FF' },
  { id: 'coach', name: '따끔한 조언가', desc: '솔직하고 직설적으로 말해주는 타입', emoji: '🔥', tint: '#FFF2EA' },
];

export type TopicId = 'plan' | 'budget' | 'spend' | 'free';

export const topics: { id: TopicId; title: string; desc: string; icon: string; color: string }[] = [
  { id: 'plan', title: '약속 설정', desc: '지출·저축 관련\n일정을 관리해요', icon: 'calendar', color: '#0046FF' },
  { id: 'budget', title: '예산 변경', desc: '요일별 하루 예산을\n내게 맞게 바꿔요', icon: 'wallet', color: '#0046FF' },
  { id: 'spend', title: '지출 흐름', desc: '지출증감, 과소비신호,\n추천 등을 알려줘요', icon: 'stats-chart', color: '#0046FF' },
  { id: 'free', title: '기타', desc: '궁금한 점을\n자유롭게 물어보세요', icon: 'chatbubble-ellipses', color: '#0046FF' },
];

type Quick = { label: string; card?: Card; reply?: string; follow?: { label: string; reply: string }[] };

/** 메뉴를 고르면 봇이 먼저 하는 말과 바로 누를 수 있는 답. follow는 답 뒤에 이어 누르는 선택지. */
export const topicIntro: Record<TopicId, { text: string; quick: Quick[] }> = {
  plan: {
    text: '어떤 약속이 있나요? 날짜와 약속 종류만 알려 주시면 금액은 입력한 기록 기준으로 추정해 드릴게요.',
    quick: [{ label: '토요일에 친구 약속 있어', card: 'plan' }],
  },
  spend: {
    text: '입력한 기록으로 어떤 걸 볼까요?',
    quick: [
      { label: '어디에 제일 많이 썼어?', card: 'top', reply: '이번 달 기록을 보면 식비에 가장 많이 썼어요.' },
      { label: '지난달이랑 비교해줘', card: 'compare', reply: '지난달 같은 기간 기록과 비교해 봤어요.' },
      { label: '아끼는 방법 알려줘', card: 'tips', reply: '기록을 보고 이번 달에 해 볼 만한 것을 골랐어요.' },
    ],
  },
  budget: {
    text: '하루 예산을 어떻게 바꾸고 싶으세요? 남은 생활비를 요일별로 어떻게 나눌지 정할 수 있어요.',
    quick: [
      {
        label: '주말에 좀 더 쓰고 싶어',
        reply: '요일별 배분을 **주말 넉넉히**로 바꿀까요?\n평일 하루 예산이 조금 줄고 토·일 예산이 늘어나요.',
        follow: [
          { label: '바꿔 줘', reply: '**주말 넉넉히**로 바꿨어요.\n(시안이라 실제 예산은 바뀌지 않아요.)' },
          { label: '그대로 둘게', reply: '알겠어요. 지금 배분을 그대로 둘게요.' },
        ],
      },
      {
        label: '매일 똑같이 나눠 줘',
        reply: '요일별 배분을 **기본 배분**으로 바꿀까요?\n남은 날 하루 예산이 모두 같아져요.',
        follow: [
          { label: '바꿔 줘', reply: '**기본 배분**으로 바꿨어요.\n(시안이라 실제 예산은 바뀌지 않아요.)' },
          { label: '그대로 둘게', reply: '알겠어요. 지금 배분을 그대로 둘게요.' },
        ],
      },
    ],
  },
  free: {
    text: '궁금한 걸 자유롭게 물어보세요!',
    quick: [{ label: '오늘 얼마 쓸 수 있어?', card: 'budget', reply: '입력한 잔액·기록 기준으로 추정한 오늘 금액이에요.' }],
  },
};

/** 약속 흐름. 금액을 적지 않은 약속을 기록 기준으로 추정해 확인받는 시안. */
export const dummyPlan = {
  day: '토요일',
  title: '친구 약속',
  estimate: 40000,
  basis: [
    { icon: 'people', label: '비슷한 약속이 있던 날', value: '3번 · 평소보다 +4만 1천 원' },
    { icon: 'calendar', label: '토요일 하루 평균', value: '평일보다 +1만 2천 원' },
  ],
  options: [30000, 50000, 60000],
};

/** 남은 날 하루 예산. before는 약속 반영 전, after는 잡아 둔 금액별로 미리 적어 둔 값(계산하지 않음). */
export const dummyWeek = {
  days: ['수', '목', '금', '토', '일'],
  today: 0,
  planDay: 3,
  before: [23500, 23500, 23500, 23500, 23500],
  after: {
    30000: [17500, 17500, 17500, 47500, 17500],
    40000: [15500, 15500, 15500, 55500, 15500],
    50000: [13500, 13500, 13500, 63500, 13500],
    60000: [11500, 11500, 11500, 71500, 11500],
  } as Record<number, number[]>,
};
