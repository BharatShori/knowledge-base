import { expect, test } from "@playwright/test";
import { cleanupTestData } from "./cleanup";
import {
  setNextGroqResponse,
  startGroqMockServer,
  stopGroqMockServer,
} from "./groq-mock-server";

// Quiz generation calls the Groq API server-side (from a Server Action), so
// page.route() can't intercept it — playwright.config.ts points
// GROQ_BASE_URL at this local mock server for the whole e2e run instead.
const MOCK_PORT = 4010;

test.beforeAll(() => startGroqMockServer(MOCK_PORT));
test.afterAll(() => stopGroqMockServer());
test.beforeEach(cleanupTestData);
test.afterEach(cleanupTestData);

const MOCK_QUESTIONS = Array.from({ length: 5 }, (_, index) => ({
  question: `Mock question ${index + 1} about the topic?`,
  options: ["Alpha", "Beta", "Gamma", "Delta"],
  correctAnswer: "Alpha",
  explanation: `Alpha is correct for question ${index + 1}.`,
}));

async function createTopicWithContent(
  page: import("@playwright/test").Page,
  title: string,
) {
  await page.goto("/");
  await page.getByRole("button", { name: "Add topic" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Category").selectOption({ label: "Automation" });
  await page
    .getByLabel("Content")
    .fill(
      "Playwright is a browser automation framework. ".repeat(10) +
        "It supports Chromium, Firefox and WebKit for reliable end-to-end testing.",
    );
  await page.getByRole("button", { name: /save topic/i }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test("completes the full quiz flow: config, questions, results, review, and history", async ({
  page,
}) => {
  const runId = Date.now();
  const topicTitle = `E2E Quiz Topic ${runId}`;
  await createTopicWithContent(page, topicTitle);
  await setNextGroqResponse(MOCK_PORT, MOCK_QUESTIONS);

  await page.getByRole("button", { name: "Quiz Me" }).click();
  await expect(page.getByText("Number of Questions")).toBeVisible();
  await expect(page.getByRole("button", { name: "10", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "practitioner", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "5", exact: true }).click();
  await page.getByRole("button", { name: "foundation", exact: true }).click();
  await page.getByRole("button", { name: "Start Quiz" }).click();

  await expect(page.getByText("Question 1 of 5")).toBeVisible();

  // Answer 3 correctly (Alpha) and 2 incorrectly (Beta) for a predictable 60% score.
  const answers = ["Alpha", "Alpha", "Alpha", "Beta", "Beta"];
  for (let i = 0; i < answers.length; i++) {
    await expect(page.getByText(`Question ${i + 1} of 5`)).toBeVisible();
    await page.getByRole("button", { name: answers[i], exact: true }).click();
    await page.getByRole("button", { name: "Submit Answer" }).click();
    await expect(
      page.getByText(answers[i] === "Alpha" ? "Correct!" : "Not quite."),
    ).toBeVisible();
    await expect(
      page.getByText(`Alpha is correct for question ${i + 1}.`),
    ).toBeVisible();
    const nextLabel = i === answers.length - 1 ? "See Results" : "Next Question";
    await page.getByRole("button", { name: nextLabel }).click();
  }

  await expect(page.getByText("Quiz Complete")).toBeVisible();
  await expect(page.getByText("Score: 3 / 5")).toBeVisible();
  await expect(page.getByText("60%")).toBeVisible();
  await expect(page.getByText("3 correct")).toBeVisible();
  await expect(page.getByText("2 incorrect")).toBeVisible();

  await page.getByRole("button", { name: /Review incorrect answers/ }).click();
  await expect(page.getByText("Mock question 4 about the topic?")).toBeVisible();
  await expect(page.getByText("Mock question 5 about the topic?")).toBeVisible();
  await expect(page.getByText("Your answer: Beta")).toHaveCount(2);
  await expect(page.getByText("Correct answer: Alpha")).toHaveCount(2);

  await page.getByRole("button", { name: "Retake Quiz" }).click();
  await expect(page.getByText("Previous attempts")).toBeVisible();
  await expect(page.getByText(/60% · foundation · 5 questions/)).toBeVisible();

  await page.getByRole("button", { name: "Close dialog" }).click();
});

test("shows a clear error and stays on the config screen when the AI response is malformed", async ({
  page,
}) => {
  const runId = Date.now();
  const topicTitle = `E2E Quiz Failure ${runId}`;
  await createTopicWithContent(page, topicTitle);

  // Malformed: only 4 questions when 5 were requested.
  await setNextGroqResponse(MOCK_PORT, MOCK_QUESTIONS.slice(0, 4));

  await page.getByRole("button", { name: "Quiz Me" }).click();
  await page.getByRole("button", { name: "5", exact: true }).click();
  await page.getByRole("button", { name: "Start Quiz" }).click();

  await expect(
    page.getByText("Unable to generate the quiz right now. Please try again."),
  ).toBeVisible();
  await expect(page.getByText("Number of Questions")).toBeVisible();
});
