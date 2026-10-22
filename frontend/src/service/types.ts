export type Kind = "EXPENSE" | "INCOME";
export type LoginProvider = "email" | "kakao" | "google";
export type User = {
  id: number;
  /** 카카오·Google로 가입하고 이메일 제공에 동의하지 않았으면 null */
  email: string | null;
  onboarded: boolean;
  createdAt: string;
  // Absent on servers deployed before social login; treat as an email account.
  provider?: LoginProvider;
  hasPassword?: boolean;
};
export type AuthResponse = {
  accessToken: string;
  expiresAt: string;
  user: User;
};
export type Category = {
  id: number;
  name: string;
  type: Kind;
  color: string;
  icon: string;
  isDefault: boolean;
};
export type Transaction = {
  id: number;
  type: Kind;
  amount: number;
  categoryId: number;
  category: Pick<Category, "id" | "name" | "color" | "icon">;
  title: string;
  memo: string | null;
  occurredAt: string;
  createdAt: string;
  /** 날짜가 된 고정지출을 서버가 자동 기록한 거래 */
  fromFixed: boolean;
};
export type BudgetSettings = {
  balance: number;
  balanceAt: string;
  payday: number;
  incomeAmount: number;
  cardUnpaid: number;
  fixedExpenses: { name: string; amount: number; day: number }[];
  /** 매달 저축할 돈(화면 이름). 수입일 전날 시드머니 반영 금액의 기준 */
  protectedItems: { name: string; amount: number }[];
  /** 모아둔 돈(시드머니 시작 금액). 이 기능 전 서버는 주지 않고, 보내지 않으면 서버 값이 유지된다 */
  seedBase?: number;
};
export type SeedChoice = "GOAL" | "ALL" | "MANUAL";
export type SeedMoney = {
  base: number;
  saved: number;
  total: number;
  monthlyGoal: number;
  /** 반영할 주기. payday는 수입일, allAmount는 그 전날까지 기록 기준 남은 돈 전부 */
  pending: {
    cycleEnd: string;
    payday: string;
    goalAmount: number;
    allAmount: number;
  } | null;
  entries: {
    cycleEnd: string;
    choice: SeedChoice;
    amount: number;
    createdAt: string;
  }[];
};
export type Today = {
  date: string;
  nextPayday: string;
  daysLeft: number;
  estimatedBalance: number;
  reservedFixed: number;
  cardUnpaid: number;
  protectedTotal: number;
  remaining: number;
  todaySpent: number;
  dailyBudget: number;
  todayAvailable: number;
  shortage: number;
  weekSpent: number;
  weekDaysLeft: number;
  weekAvailable: number;
  cycleStart: string;
  hasTransactions: boolean;
  // Absent on servers deployed before the character score existed.
  characterPoints?: number;
  characterDelta?: number;
};
export type Analysis = {
  from: string;
  to: string;
  expenseTotal: number;
  incomeTotal: number;
  expenseCount: number;
  byCategory: (Pick<Category, "name" | "color" | "icon"> & {
    categoryId: number;
    amount: number;
    count: number;
    ratio: number;
  })[];
  daily: { date: string; expense: number; income: number }[];
};
// Coins and costumes: docs/API.md "코인·코스튬". Servers before 1.4.0 do not have these endpoints.
export type CoinWallet = {
  balance: number;
  passive: {
    collectable: number;
    collectedToday: number;
    dailyLimit: number;
    nextAt: string | null;
  };
  /** null이면 기본 캐릭터(costume-lv1) */
  equippedOutfitId: string | null;
};
export type CoinRewardReason =
  "SIGNUP_GIFT" | "BUDGET_BONUS" | "REFERRAL_INVITER" | "REFUND";
export type CoinReward = {
  id: number;
  reason: CoinRewardReason;
  amount: number;
  /** BUDGET_BONUS일 때 예산을 지킨 날 */
  refDate: string | null;
  createdAt: string;
};
export type CheckIn = { wallet: CoinWallet; rewards: CoinReward[] };
export type CollectResult = { collected: number; wallet: CoinWallet };
export type Outfit = {
  id: string;
  name: string;
  /** 상점 상품만 있다. 레벨 코스튬은 null */
  price: number | null;
  /** 레벨 코스튬만 있다(현재 1~3, 비활성 예비 항목은 5까지). 상점 상품은 null */
  unlockLevel: number | null;
  owned: boolean;
  equipped: boolean;
};
export type OutfitList = {
  balance: number;
  equippedOutfitId: string | null;
  peakLevel: number;
  items: Outfit[];
};
export type Referral = {
  code: string;
  invitedCount: number;
  registered: boolean;
  rewardAmount: number;
};
export type ReferralResult = { amount: number; wallet: CoinWallet };
