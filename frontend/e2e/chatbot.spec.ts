import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

import { session } from "./ui-ux-fixtures";

test("AI 메이트: 실제 답변·서버 카드·확인 뒤에만 배분 저장·약속 설정은 일정 안내부터", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("chatbot.mate", "ANALYST"));
  await session(page);
  const chats: { mate: string; messages: { role: string; text: string }[] }[] =
    [];
  const saved: unknown[] = [];
  await page.route("**/api/v1/chat/messages", async (route) => {
    const body = route.request().postDataJSON();
    chats.push(body);
    const last = body.messages[body.messages.length - 1].text;
    await route.fulfill({
      json: last.includes("주말")
        ? {
            reply:
              "주말 약속이 많군요.\n\n요일별 배분을 **주말 넉넉히**로 바꿀까요?",
            action: {
              type: "DAY_PRESET",
              preset: "WEEKEND",
              label: "주말 넉넉히",
            },
          }
        : { reply: "이번 기간에는 **식비**에 가장 많이 썼어요.", action: null },
    });
  });
  await page.route("**/api/v1/budget/day-weights", async (route) => {
    saved.push(route.request().postDataJSON());
    await route.fulfill({ json: {} });
  });

  await page.goto("/chatbot");
  await page.getByRole("radio", { name: "다정한 친구", exact: true }).click();
  await page.getByRole("button", { name: "선택하고 시작하기" }).click();
  const note = page.getByText(/입력한 잔액·기록 기준으로 답해요/);
  const composer = page.getByPlaceholder("궁금한 내용을 입력해보세요...");
  await expect(note).toBeVisible();
  const noteBox = await note.boundingBox();
  const composerBox = await composer.boundingBox();
  if (!noteBox || !composerBox) throw new Error("AI mate menu layout is missing");
  expect(noteBox.y + noteBox.height).toBeLessThan(composerBox.y);

  // 약속 설정은 일정을 말해 달라는 안내와 예시 질문부터 보여 주고, 누르기 전에는 보내지 않는다
  await page.getByRole("button", { name: "약속 설정", exact: true }).click();
  await expect(
    page.getByText(/앞으로 있을 약속을 날짜와 함께 말해 주세요/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "이번 주 금요일에 친구랑 저녁",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("기능 업데이트 예정이에요")).toHaveCount(0);
  expect(chats).toHaveLength(0);
  await page.getByRole("button", { name: "뒤로 가기", exact: true }).click();

  // 메뉴 질문 → 서버 답변 + /analysis/summary 값으로 그린 카드
  await page.getByRole("button", { name: "지출 흐름", exact: true }).click();
  await page.getByRole("button", { name: "어디에 제일 많이 썼어?" }).click();
  await expect(page.getByText(/가장 많이 썼어요/)).toBeVisible();
  await expect(page.getByText("20,000원", { exact: true })).toBeVisible();
  expect(chats[0].mate).toBe("FRIEND");
  // 화면 안내 말풍선은 보내지 않는다
  expect(chats[0].messages).toEqual([
    { role: "USER", text: "어디에 제일 많이 썼어?" },
  ]);

  // 배분 제안은 [확인]을 누르기 전에는 저장하지 않는다
  const input = page.getByLabel("AI 메이트에게 질문", { exact: true });
  // Shrinking after a reply must keep the input and send button fully visible.
  // Android's actual keyboard still needs a device check.
  await page.setViewportSize({ width: 390, height: 420 });
  await input.focus();
  await expect
    .poll(async () => {
      const field = await input.boundingBox();
      const send = await page
        .getByRole("button", { name: "보내기", exact: true })
        .boundingBox();
      return (
        !!field &&
        !!send &&
        field.height >= 44 &&
        field.y >= 0 &&
        field.y + field.height <= 420 &&
        send.y + send.height <= 420
      );
    })
    .toBe(true);
  await input.fill("주말에 돈을 더 쓰고 싶어");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(page.getByRole("button", { name: "그대로 둘게" })).toBeVisible();
  expect(saved).toHaveLength(0);
  expect(chats[1].messages.map((m) => m.role)).toEqual([
    "USER",
    "MODEL",
    "USER",
  ]);
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await expect(page.getByText(/바꿨어요/)).toBeVisible();
  expect(saved).toEqual([{ preset: "WEEKEND" }]);
});

test("AI 메이트: 답변 실패는 다시 시도할 수 있다", async ({ page }) => {
  await session(page);
  let calls = 0;
  await page.route("**/api/v1/chat/messages", (route) =>
    ++calls === 1
      ? route.fulfill({
          status: 502,
          json: {
            code: "CHAT_FAILED",
            message: "AI 메이트가 답하지 못했어요. 잠시 후 다시 시도해 주세요",
          },
        })
      : route.fulfill({ json: { reply: "다시 답했어요", action: null } }),
  );
  await page.goto("/chatbot");
  await page.getByRole("button", { name: "선택하고 시작하기" }).click();
  await page
    .getByLabel("AI 메이트에게 질문", { exact: true })
    .fill("오늘 얼마 쓸 수 있어?");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(page.getByText(/답하지 못했어요/)).toBeVisible();
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.getByText("다시 답했어요")).toBeVisible();
});

test("AI 메이트: 일정은 한 줄 카드의 [반영]·[수정]을 누른 뒤에만 예정 지출로 저장하고 서버 하루 예산을 보여 준다", async ({
  page,
}) => {
  await session(page);
  const chats: { accepts?: string[]; pending?: { amount?: number } }[] = [];
  const saved: unknown[] = [];
  const schedule = (amount: number | null) => ({
    title: "술약속",
    date: "2026-11-06",
    categoryId: 1,
    category: "식비",
    amount,
    basis: amount == null ? null : { samples: 5, scope: "CATEGORY", days: 90 },
    preview:
      amount == null
        ? null
        : {
            dayBudget: 75935,
            dailyBudgetBefore: 50000,
            dailyBudgetAfter: 48635,
          },
  });
  await page.route("**/api/v1/chat/messages", async (route) => {
    const body = route.request().postDataJSON();
    chats.push(body);
    const last = body.messages[body.messages.length - 1].text;
    await route.fulfill({
      json: last.includes("모임")
        ? {
            reply:
              "모임에는 비슷한 기록이 적어서 예상하기 어려워요. 얼마 정도 쓸 것 같으세요?",
            action: {
              type: "SCHEDULE",
              schedule: { ...schedule(null), title: "모임" },
            },
          }
        : body.pending
          ? {
              reply: "**50,000원**으로 바꿔서 등록할까요?",
              action: { type: "SCHEDULE", schedule: schedule(50000) },
            }
          : {
              reply:
                "금요일(11/6) 술약속에는 **27,300원** 정도 쓸 것 같아요. 등록할까요?",
              action: { type: "SCHEDULE", schedule: schedule(27300) },
            },
    });
  });
  await page.route("**/api/v1/categories?type=EXPENSE", async (route) => {
    await route.fulfill({
      json: [
        {
          id: 1,
          name: "식비",
          type: "EXPENSE",
          icon: "restaurant",
          color: "#0046FF",
          isDefault: true,
        },
        {
          id: 2,
          name: "쇼핑",
          type: "EXPENSE",
          icon: "bag-handle",
          color: "#7A5AF8",
          isDefault: true,
        },
      ],
    });
  });
  await page.route("**/api/v1/scheduled-expenses", async (route) => {
    saved.push(route.request().postDataJSON());
    await route.fulfill({ status: 201, json: {} });
  });
  await page.goto("/chatbot");
  await page.getByRole("button", { name: "선택하고 시작하기" }).click();
  const input = page.getByLabel("AI 메이트에게 질문", { exact: true });
  await input.fill("금요일 저녁에 술약속");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  // 한 줄 카드: 날짜 · 금액 · 카테고리. 처음엔 [반영]만 켜진다
  await expect(
    page.getByRole("button", { name: "금액 27,300원, 바꾸기" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "날짜 11/6(금), 바꾸기" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "카테고리 식비, 바꾸기" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "반영", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "수정", exact: true }),
  ).toBeDisabled();
  expect(chats[0].accepts).toEqual(["SCHEDULE", "INCOME", "EXPENSE"]);
  expect(saved).toHaveLength(0);

  // 말로 고쳐 달라고 하면 제안 내용을 서버에 함께 보내 새 카드를 받는다. 아직 저장하지 않는다.
  await input.fill("5만원으로 해줘");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "금액 50,000원, 바꾸기" }),
  ).toBeVisible();
  expect(chats[1].pending?.amount).toBe(27300);
  expect(saved).toHaveLength(0);

  // 서버가 계산한 날짜별 하루 예산을 등록 뒤에 그대로 보여 준다
  await page.route("**/api/v1/budget/today", async (route) => {
    const res = await route.fetch();
    await route.fulfill({
      json: {
        ...(await res.json()),
        dailyBudget: 48635,
        dayPlans: [{ date: "2026-11-06", planned: 50000, budget: 98635 }],
      },
    });
  });
  await page.getByRole("button", { name: "반영", exact: true }).last().click();
  await expect(page.getByText(/예정 지출로 등록했어요/)).toBeVisible();
  await expect(page.getByText(/98,635원/).first()).toBeVisible();
  expect(saved).toEqual([
    { amount: 50000, categoryId: 1, title: "술약속", date: "2026-11-06" },
  ]);
  await page.unroute("**/api/v1/budget/today");

  // 금액을 예측하지 못하면 금액 칸이 비고, 금액·카테고리를 고치면 [반영]이 꺼지고 [수정]으로 등록한다
  await input.fill("다음 주 금요일 모임");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  const amount = page.getByLabel("금액", { exact: true });
  await expect(amount).toBeVisible();
  const apply = page.getByRole("button", { name: "반영", exact: true }).last();
  const edit = page.getByRole("button", { name: "수정", exact: true }).last();
  await expect(apply).toBeDisabled();
  await expect(edit).toBeDisabled();
  await amount.fill("30000");
  await page
    .getByRole("button", { name: "카테고리 식비, 바꾸기" })
    .last()
    .click();
  await page.getByRole("radio", { name: "쇼핑", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "카테고리 쇼핑, 바꾸기" }),
  ).toBeVisible();
  await expect(apply).toBeDisabled();
  await expect(edit).toBeEnabled();
  await edit.click();
  await expect(
    page.getByText(/모임\*\* 30,000원을|모임 30,000원을/).first(),
  ).toBeVisible();
  expect(saved[1]).toEqual({
    amount: 30000,
    categoryId: 2,
    title: "모임",
    date: "2026-11-06",
  });
});

test("AI 메이트: 처음 들어오면 음성 답변을 쓸지 묻고, 대화 화면 스피커로 바꾼다", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    const spoken: string[] = [];
    w.__spoken = spoken;
    class Utterance {
      text: string;
      lang = "";
      constructor(text: string) {
        this.text = text;
      }
    }
    w.SpeechSynthesisUtterance = Utterance;
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speak: (u: Utterance) => spoken.push(u.text),
        cancel() {},
        pause() {},
        resume() {},
        getVoices: () => [],
        speaking: false,
        pending: false,
        paused: false,
        addEventListener() {},
        removeEventListener() {},
      },
    });
  });
  await session(page);
  await page.addInitScript(() => localStorage.removeItem("chatbot.voiceReply"));
  await page.route("**/api/v1/chat/messages", async (route) => {
    await route.fulfill({
      json: {
        reply:
          "11/6(금) **데이트**에 **56,200원** 정도 쓸 것 같아요. 등록할까요?",
        action: {
          type: "SCHEDULE",
          schedule: {
            title: "데이트",
            date: "2026-11-06",
            categoryId: 1,
            category: "식비",
            amount: 56200,
            basis: { samples: 4, scope: "CATEGORY", days: 90 },
            preview: null,
          },
        },
      },
    });
  });
  await page.goto("/chatbot");
  await page.getByRole("button", { name: "선택하고 시작하기" }).click();
  await expect(page.getByText("AI 음성 답변을 쓸까요?")).toBeVisible();
  await page.getByRole("button", { name: "쓸게요", exact: true }).click();
  await expect(page.getByText("AI 음성 답변을 쓸까요?")).toHaveCount(0);

  const input = page.getByLabel("AI 메이트에게 질문", { exact: true });
  await input.fill("금요일에 데이트");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  const speaker = page.getByRole("switch", { name: "AI 음성 답변" });
  await expect(speaker).toBeVisible();
  await expect(speaker).toHaveAttribute("aria-checked", "true");
  // 예정 지출 확인 질문 한 줄만 읽는다(답변 전체는 읽지 않는다)
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __spoken: string[] }).__spoken,
      ),
    )
    .toEqual(["11월 6일에 데이트로 56,200원을 등록할까요?"]);

  await speaker.click();
  await expect(speaker).toHaveAttribute("aria-checked", "false");
  expect(
    await page.evaluate(() => localStorage.getItem("chatbot.voiceReply")),
  ).toBe("off");
  await input.fill("금요일에 데이트");
  await page.getByRole("button", { name: "보내기", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "반영", exact: true }),
  ).toHaveCount(2);
  expect(
    await page.evaluate(
      () => (window as unknown as { __spoken: string[] }).__spoken,
    ),
  ).toHaveLength(1);
});

test("AI 메이트: 음성 인식 완료 시 한 번 전송하고, 권한 거부·인식 실패는 안내만 한다", async ({
  page,
}) => {
  // 브라우저 음성 인식(webkitSpeechRecognition)을 가짜로 바꾼다. window.__voice로 결과를 고른다.
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__voice = "ok";
    class FakeRecognition extends EventTarget {
      lang = "";
      interimResults = false;
      continuous = false;
      maxAlternatives = 1;
      private fire(type: string, extra: Record<string, unknown> = {}) {
        this.dispatchEvent(Object.assign(new Event(type), extra));
      }
      private result(text: string, isFinal: boolean) {
        const list = Object.assign([{ transcript: text, confidence: 0.9 }], {
          isFinal,
        });
        this.fire("result", { resultIndex: 0, results: [list] });
      }
      start() {
        const mode = w.__voice;
        setTimeout(() => {
          if (mode === "deny") {
            this.fire("error", { error: "not-allowed", message: "" });
            this.fire("end");
            return;
          }
          this.fire("start");
          setTimeout(() => {
            if (mode === "silence")
              this.fire("error", { error: "no-speech", message: "" });
            else {
              this.result("이번 주", false);
              this.result("이번 주 식비 얼마야", true);
            }
            this.fire("end");
          }, 400);
        }, 50);
      }
      stop() {
        this.fire("end");
      }
      abort() {
        this.fire("end");
      }
    }
    w.webkitSpeechRecognition = FakeRecognition;
  });
  await session(page);
  const chats: { messages: { role: string; text: string }[] }[] = [];
  await page.route("**/api/v1/chat/messages", async (route) => {
    chats.push(route.request().postDataJSON());
    await route.fulfill({
      json: { reply: "식비는 20,000원이에요.", action: null },
    });
  });
  await page.goto("/chatbot");
  await page.getByRole("radio", { name: "다정한 친구", exact: true }).click();
  await page.getByRole("button", { name: "선택하고 시작하기" }).click();

  const input = page.getByLabel("AI 메이트에게 질문", { exact: true });
  const mic = page.getByRole("button", {
    name: "음성으로 질문하기",
    exact: true,
  });
  await mic.click();
  // 듣는 동안 안내 줄 없이 빨간 멈춤 버튼만 보인다
  await expect(
    page.getByRole("button", { name: "음성 입력 멈추기", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/^듣고 있어요/)).toHaveCount(0);
  // 최종 인식 결과는 한 번만 자동으로 보낸다.
  await expect(page.getByText("식비는 20,000원이에요.")).toBeVisible();
  await expect(input).toHaveValue("");
  expect(chats).toHaveLength(1);
  expect(chats[0].messages.at(-1)).toEqual({
    role: "USER",
    text: "이번 주 식비 얼마야",
  });

  // 대화 화면에서는 듣는 동안 사용자 쪽에 "…" 말풍선이 뜨고, 끝나면 사라진다
  await mic.click();
  await expect(page.getByLabel("음성을 듣고 있어요")).toBeVisible();
  await expect(page.getByLabel("음성을 듣고 있어요")).toHaveCount(0);
  await expect.poll(() => chats.length).toBe(2);
  await expect(input).toHaveValue("");

  // 권한 거부: 안내하고 글자 입력은 그대로 쓸 수 있다
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__voice = "deny";
  });
  await mic.click();
  await expect(
    page.getByText(/^마이크 권한이 없어 음성 입력을 쓸 수 없어요/),
  ).toBeVisible();
  await input.fill("글자로 물어볼게");
  await expect(page.getByText(/^마이크 권한이 없어/)).toHaveCount(0);

  // 인식 실패: 다시 누르라는 안내, 입력창 글은 지우지 않는다
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__voice = "silence";
  });
  await mic.click();
  await expect(page.getByText(/^말소리를 알아듣지 못했어요/)).toBeVisible();
  await expect(input).toHaveValue("글자로 물어볼게");
});

test("+ 음성 입력: 바로 듣고, 들은 일정은 한 줄 카드 [반영]을 눌러야 예정 지출로 저장한다", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class FakeRecognition extends EventTarget {
      lang = "";
      interimResults = false;
      continuous = false;
      maxAlternatives = 1;
      private fire(type: string, extra: Record<string, unknown> = {}) {
        this.dispatchEvent(Object.assign(new Event(type), extra));
      }
      start() {
        setTimeout(() => {
          this.fire("start");
          setTimeout(() => {
            const list = Object.assign(
              [{ transcript: "금요일에 친구랑 저녁", confidence: 0.9 }],
              { isFinal: true },
            );
            this.fire("result", { resultIndex: 0, results: [list] });
            this.fire("end");
          }, 400);
        }, 50);
      }
      stop() {
        this.fire("end");
      }
      abort() {
        this.fire("end");
      }
    }
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition =
      FakeRecognition;
  });
  await session(page);
  const chats: { accepts?: string[]; messages: { text: string }[] }[] = [];
  const saved: unknown[] = [];
  await page.route("**/api/v1/chat/messages", async (route) => {
    chats.push(route.request().postDataJSON());
    await route.fulfill({
      json: {
        reply: "11/6(금) **친구랑 저녁**에 **32,000원** 정도 쓸 것 같아요.",
        action: {
          type: "SCHEDULE",
          schedule: {
            title: "친구랑 저녁",
            date: "2026-11-06",
            categoryId: 1,
            category: "식비",
            amount: 32000,
            basis: { samples: 6, scope: "CATEGORY", days: 90 },
            preview: null,
          },
        },
      },
    });
  });
  await page.route("**/api/v1/scheduled-expenses", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    saved.push(route.request().postDataJSON());
    await route.fulfill({ status: 201, json: {} });
  });
  await page.goto("/home");
  await page.getByRole("button", { name: "거래 추가", exact: true }).click();
  await page.getByRole("button", { name: "음성 입력", exact: true }).click();
  // 누르자마자 마이크가 켜져 빨간 멈춤 버튼이 보인다
  await expect(
    page.getByRole("button", { name: "음성 입력 멈추기", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "금액 32,000원, 바꾸기" }),
  ).toBeVisible();
  expect(chats).toHaveLength(1);
  expect(chats[0].accepts).toEqual(["SCHEDULE", "INCOME", "EXPENSE"]);
  expect(chats[0].messages).toEqual([
    { role: "USER", text: "금요일에 친구랑 저녁" },
  ]);
  expect(saved).toHaveLength(0);
  await expect(
    page.getByRole("button", { name: "수정", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "반영", exact: true }).click();
  await expect(
    page.getByText("32,000원을 예정 지출로 등록했어요"),
  ).toBeVisible();
  expect(saved).toEqual([
    { amount: 32000, categoryId: 1, title: "친구랑 저녁", date: "2026-11-06" },
  ]);
});
