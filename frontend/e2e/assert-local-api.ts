import { chromium, type FullConfig } from "@playwright/test";

/** 실행 전 앱의 API 주소를 확인해 조작 테스트가 로컬 서버만 사용하게 한다. */
export default async function assertLocalApi(config: FullConfig) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    let receive!: (origin: string) => void;
    const origin = new Promise<string>((resolve) => {
      receive = resolve;
    });
    // 검사 자체는 API에 통신하지 않는다. 시작 화면의 providers 요청으로 주소만 확인한다.
    await page.route("**/api/v1/**", (route) => {
      receive(new URL(route.request().url()).origin);
      return route.fulfill({ status: 404, json: { code: "NOT_FOUND" } });
    });
    await page.goto(config.projects[0].use.baseURL ?? "http://localhost:8081");
    await page
      .getByRole("button", { name: "카카오 로그인", exact: true })
      .click();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const actual = await Promise.race([
        origin,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("E2E: 앱 API 주소를 확인하지 못했어요")),
            15000,
          );
        }),
      ]);
      if (actual !== "http://localhost:8080")
        throw new Error(
          `E2E는 로컬 API만 사용해야 해요. 실제 앱 API: ${actual}. EXPO_PUBLIC_API_URL=http://localhost:8080, EXPO_NO_DOTENV=1로 캐시를 지우고 다시 빌드해 주세요`,
        );
    } finally {
      clearTimeout(timer);
    }
  } finally {
    await browser.close();
  }
}
