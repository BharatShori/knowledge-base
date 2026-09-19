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

// Scopes to the right radio group by its <legend> text before clicking an
// option, since Scope/Number of Questions/Difficulty all reuse short
// labels (e.g. "5") that could otherwise collide with unrelated text.
function selectQuizOption(
  page: import("@playwright/test").Page,
  groupLegend: string,
  optionLabel: string,
) {
  return page
    .locator("fieldset")
    .filter({ hasText: groupLegend })
    .getByText(optionLabel, { exact: true })
    .click();
}

async function createTopicWithContent(
  page: import("@playwright/test").Page,
  title: string,
) {
  await page.goto("/");
  await page.getByRole("button", { name: "Add topic" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Category", { exact: true }).selectOption({ label: "Automation" });
  await page
    .getByLabel("Content", { exact: true })
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
  await setNextGroqResponse(MOCK_PORT, { questions: MOCK_QUESTIONS });

  await page.getByRole("button", { name: "Quiz Me" }).click();
  await expect(page.getByText("Number of Questions")).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "10", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("radio", { name: "practitioner", exact: true }),
  ).toBeChecked();

  await selectQuizOption(page, "Number of Questions", "5");
  await selectQuizOption(page, "Difficulty", "foundation");
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

  await page.getByRole("button", { name: "New Quiz" }).click();
  await expect(page.getByText("Number of Questions")).toBeVisible();
  await page.getByRole("button", { name: /View quiz history/ }).click();
  const historyRow = page
    .locator("li")
    .filter({ hasText: topicTitle })
    .filter({ hasText: "60%" });
  await expect(historyRow).toBeVisible();
  await expect(historyRow).toContainText("foundation");

  await page.getByRole("button", { name: "Exit Quiz" }).click();
  await expect(page.getByRole("heading", { name: topicTitle })).toBeVisible();
});

test("shows a clear error and stays on the config screen when the AI response is malformed", async ({
  page,
}) => {
  const runId = Date.now();
  const topicTitle = `E2E Quiz Failure ${runId}`;
  await createTopicWithContent(page, topicTitle);

  // Malformed: only 4 questions when 5 were requested.
  await setNextGroqResponse(MOCK_PORT, { questions: MOCK_QUESTIONS.slice(0, 4) });

  await page.getByRole("button", { name: "Quiz Me" }).click();
  await selectQuizOption(page, "Number of Questions", "5");
  await page.getByRole("button", { name: "Start Quiz" }).click();

  await expect(
    page.getByText("Unable to generate the quiz right now. Please try again."),
  ).toBeVisible();
  await expect(page.getByText("Number of Questions")).toBeVisible();
});

test("confirms before leaving an in-progress quiz, and resumes it later from the sidebar", async ({
  page,
}) => {
  const runId = Date.now();
  const topicTitle = `E2E Quiz Resume ${runId}`;
  await createTopicWithContent(page, topicTitle);
  await setNextGroqResponse(MOCK_PORT, { questions: MOCK_QUESTIONS });

  // Open the pane from the sidebar (not the per-topic button), so no topic
  // is pre-selected and it must be chosen from the picker.
  await page.getByRole("button", { name: "Quiz", exact: true }).click();
  await expect(page.getByText("Choose a topic")).toBeVisible();
  await page.locator("#quiz-topic-search").fill(topicTitle);
  await page.getByRole("main").getByRole("button", { name: topicTitle }).click();
  await selectQuizOption(page, "Number of Questions", "5");
  await selectQuizOption(page, "Difficulty", "foundation");
  await page.getByRole("button", { name: "Start Quiz" }).click();
  await expect(page.getByText("Question 1 of 5")).toBeVisible();

  // Clicking Exit mid-quiz must confirm before leaving; Stay keeps it open.
  await page.getByRole("button", { name: "Exit Quiz" }).click();
  await expect(page.getByRole("heading", { name: "Leave quiz?" })).toBeVisible();
  await page.getByRole("button", { name: "Stay" }).click();
  await expect(page.getByRole("heading", { name: "Leave quiz?" })).not.toBeVisible();
  await expect(page.getByText("Question 1 of 5")).toBeVisible();

  // Leave Quiz actually exits back to the browse view, saving progress.
  await page.getByRole("button", { name: "Exit Quiz" }).click();
  await page.getByRole("button", { name: "Leave Quiz" }).click();
  await expect(page.getByRole("heading", { name: topicTitle })).toBeVisible();

  // Coming back to the pane surfaces it as resumable.
  await page.getByRole("button", { name: "Quiz", exact: true }).click();
  await expect(page.getByText("Continue a quiz in progress")).toBeVisible();
  const resumeRow = page
    .locator("li")
    .filter({ hasText: topicTitle })
    .filter({ hasText: "answered" });
  await expect(resumeRow).toContainText("0/5 answered");
  await resumeRow.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByText("Question 1 of 5")).toBeVisible();

  // Finish the quiz so no abandoned session is left behind for the user.
  for (let i = 0; i < MOCK_QUESTIONS.length; i++) {
    await page.getByRole("button", { name: "Alpha", exact: true }).click();
    await page.getByRole("button", { name: "Submit Answer" }).click();
    const nextLabel = i === MOCK_QUESTIONS.length - 1 ? "See Results" : "Next Question";
    await page.getByRole("button", { name: nextLabel }).click();
  }
  await expect(page.getByText("Quiz Complete")).toBeVisible();
  await expect(page.getByText("Score: 5 / 5")).toBeVisible();
});

test("confirms before leaving an in-progress quiz via sidebar navigation, not just the pane's own Exit button", async ({
  page,
}) => {
  const runId = Date.now();
  const topicTitle = `E2E Quiz Sidebar Nav ${runId}`;
  await createTopicWithContent(page, topicTitle);
  await setNextGroqResponse(MOCK_PORT, { questions: MOCK_QUESTIONS });

  await page.getByRole("button", { name: "Quiz Me" }).click();
  await selectQuizOption(page, "Number of Questions", "5");
  await page.getByRole("button", { name: "Start Quiz" }).click();
  await expect(page.getByText("Question 1 of 5")).toBeVisible();

  // Clicking a category in the always-visible sidebar mid-quiz must confirm
  // before leaving, the same as the pane's own Exit Quiz button.
  const automationCategory = page.locator('button[title="Automation"]');
  await automationCategory.click();
  await expect(page.getByRole("heading", { name: "Leave quiz?" })).toBeVisible();
  await page.getByRole("button", { name: "Stay" }).click();
  await expect(page.getByRole("heading", { name: "Leave quiz?" })).not.toBeVisible();
  await expect(page.getByText("Question 1 of 5")).toBeVisible();

  await automationCategory.click();
  await page.getByRole("button", { name: "Leave Quiz" }).click();
  await expect(page.getByRole("button", { name: "Quiz Me" })).toBeVisible();
});

test("expands the quiz pane to full screen, hiding the sidebar", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Quiz", exact: true }).click();
  await expect(page.getByText("Number of Questions")).toBeVisible();

  await page.getByRole("button", { name: "Enter full screen" }).click();
  await expect(page.getByRole("button", { name: "Dashboard" })).not.toBeVisible();

  await page.getByRole("button", { name: "Exit full screen" }).click();
  await expect(page.getByRole("button", { name: "Dashboard" })).toBeVisible();
});
