/**
 * 시연 경로 — 모든 시연 화면은 /demo 아래에 있다.
 * 실제 서비스가 같은 이름의 경로(/my, /transactions 등)를 쓰므로 시연 화면에서는 반드시 이 helper로 이동한다.
 */
const BASE = '/demo';
const seg = (id: string) => encodeURIComponent(id);

export const demoRoutes = {
  home: BASE,
  home2: `${BASE}/home2`,
  plan: `${BASE}/plan`,
  analysis: `${BASE}/analysis`,
  transactions: `${BASE}/transactions`,
  my: `${BASE}/my`,
  budgetDetail: `${BASE}/budget-detail`,
  notifications: `${BASE}/notifications`,
  memory: `${BASE}/memory`,
  schedule: `${BASE}/schedule`,
  scheduleNew: `${BASE}/schedule/new`,
  tx: (id: string) => `${BASE}/tx/${seg(id)}`,
  settle: (id: string) => `${BASE}/settle/${seg(id)}`,

  onboarding: `${BASE}/onboarding`,
  onboardingAccount: `${BASE}/onboarding/account`,
  onboardingIncome: `${BASE}/onboarding/income`,
  onboardingFixed: `${BASE}/onboarding/fixed`,
  onboardingProtect: `${BASE}/onboarding/protect`,
  onboardingAnalyze: `${BASE}/onboarding/analyze`,

  simulations: `${BASE}/simulations`,
  simPay: `${BASE}/simulations/pay`,
  simPush: `${BASE}/simulations/push`,
} as const;
