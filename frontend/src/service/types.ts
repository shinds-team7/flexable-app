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
  protectedItems: { name: string; amount: number }[];
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
