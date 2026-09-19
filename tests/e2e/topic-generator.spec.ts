import { expect, test } from "@playwright/test";
import { cleanupTestData } from "./cleanup";
import {
  setNextGroqResponse,
  startGroqMockServer,
  stopGroqMockServer,
} from "./groq-mock-server";

// Topic generation calls the Groq API server-side (from a Server Action), so
// page.route() can't intercept it — playwright.config.ts points
// GROQ_BASE_URL at this local mock server for the whole e2e run instead
// (see tests/e2e/quiz.spec.ts, which uses the same mock server on the same
// port; the two spec files never run concurrently — see playwright.config.ts).
const MOCK_PORT = 4010;

test.beforeAll(() => startGroqMockServer(MOCK_PORT));
test.afterAll(() => stopGroqMockServer());
test.beforeEach(cleanupTestData);
test.afterEach(cleanupTestData);

function mockTopic(title: string, relatedTopics: string[] = []) {
  return {
    title,
    summary: `Summary for ${title}.`,
    content: `## Overview\nMarkdown content about ${title}.`,
    tags: ["Architecture"],
    relatedTopics,
  };
}

function mockReferenceCard(categoryName: string) {
  return {
    summary: `Quick reference for ${categoryName}.`,
    content: `## Key Points\n- Point about ${categoryName}`,
    tags: [],
  };
}

test("generates a category reference card only once, and skips it on later batches", async ({
  page,
}) => {
  const runId = Date.now();
  const categoryName = `E2E Topic Gen Category ${runId}`;
  const existingTopicTitle = `E2E Existing Topic ${runId}`;

  await page.goto("/");
  await page.locator("aside").getByRole("button", { name: "Manage categories" }).click();
  await page.getByRole("button", { name: /add category/i }).click();
  await page.getByLabel("Category name").fill(categoryName);
  await page.getByRole("button", { name: /save category/i }).click();
  await page.waitForLoadState("networkidle");
  await page.reload();

  await page.locator("aside").getByRole("button", { name: "Add topic" }).click();
  await page.getByLabel("Title").fill(existingTopicTitle);
  await page.getByLabel("Category", { exact: true }).selectOption({ label: categoryName });
  await page.getByRole("button", { name: /save topic/i }).click();
  await expect(page.getByRole("heading", { name: existingTopicTitle })).toBeVisible();
  await page.waitForLoadState("networkidle");

  // First batch: category has no reference card yet, so the mock response
  // includes one.
  await setNextGroqResponse(MOCK_PORT, {
    topics: [
      mockTopic(existingTopicTitle), // exact duplicate of the topic just created
      mockTopic(`E2E Circuit Breaker Pattern ${runId}`),
      mockTopic(`E2E Saga Pattern ${runId}`, [`E2E Circuit Breaker Pattern ${runId}`]),
    ],
    categoryReferenceCard: mockReferenceCard(categoryName),
  });

  await page.locator("aside").getByRole("button", { name: "AI Generate Topics" }).click();
  await expect(page.getByText("Existing topics:")).toBeVisible();
  await page.getByLabel("Category", { exact: true }).selectOption({ label: categoryName });
  await page.getByRole("button", { name: "Generate Next 10" }).click();

  await expect(page.getByText("3 new topics suggested.")).toBeVisible();
  await expect(page.getByText("Exact duplicate")).toBeVisible();
  await expect(page.getByText(`${categoryName} — Reference Card`)).toBeVisible();
  await expect(page.getByText("Category Reference Card")).toBeVisible();

  const duplicateCheckbox = page.locator(`#candidate-0`);
  await expect(duplicateCheckbox).not.toBeChecked();
  const sagaCheckbox = page.locator(`li:has-text("E2E Saga Pattern ${runId}") input[type="checkbox"]`);
  await expect(sagaCheckbox).toBeChecked();
  await sagaCheckbox.uncheck();
  const referenceCardCheckbox = page.locator("#category-reference-card");
  await expect(referenceCardCheckbox).toBeChecked();

  await expect(page.getByRole("button", { name: "Add Selected (2)" })).toBeVisible();
  await page.getByRole("button", { name: "Add Selected (2)" }).click();

  await expect(page.getByText("Topics Added")).toBeVisible();
  await expect(page.getByText("1 topic added")).toBeVisible();
  await expect(page.getByText("Plus the category Reference Card.")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByText(`E2E Circuit Breaker Pattern ${runId}`).first(),
  ).toBeVisible();
  await expect(page.getByText(`E2E Saga Pattern ${runId}`)).toHaveCount(0);
  await expect(page.getByText(`${categoryName} — Reference Card`).first()).toBeVisible();

  // Generate again for the same category: it already has a reference card
  // now, so the mock response omits one and the preview shouldn't offer it.
  await setNextGroqResponse(MOCK_PORT, {
    topics: [mockTopic(`E2E Bulkhead Pattern ${runId}`)],
  });
  await page.locator("aside").getByRole("button", { name: "AI Generate Topics" }).click();
  await page.getByLabel("Category", { exact: true }).selectOption({ label: categoryName });
  await page.getByRole("button", { name: "Generate Next 10" }).click();
  await expect(page.getByText("1 new topic suggested.")).toBeVisible();
  await expect(page.getByText("Category Reference Card")).toHaveCount(0);
  await page.getByRole("button", { name: /Add Selected/ }).click();
  await expect(page.getByText("Topics Added")).toBeVisible();
  await expect(page.getByText("1 topic added")).toBeVisible();
});

test("shows a clear error and stays on the config screen when the AI response is malformed", async ({
  page,
}) => {
  const runId = Date.now();
  const categoryName = `E2E Topic Gen Failure ${runId}`;

  await page.goto("/");
  await page.locator("aside").getByRole("button", { name: "Manage categories" }).click();
  await page.getByRole("button", { name: /add category/i }).click();
  await page.getByLabel("Category name").fill(categoryName);
  await page.getByRole("button", { name: /save category/i }).click();
  await page.waitForLoadState("networkidle");
  await page.reload();

  // Malformed: this fresh category has no reference card yet, so one is
  // required in the response — but the mock response omits it.
  await setNextGroqResponse(MOCK_PORT, {
    topics: [mockTopic(`E2E Broken ${runId}`)],
  });

  await page.locator("aside").getByRole("button", { name: "AI Generate Topics" }).click();
  await page.getByLabel("Category", { exact: true }).selectOption({ label: categoryName });
  await page.getByRole("button", { name: "Generate Next 10" }).click();

  await expect(
    page.getByText("Unable to generate topics right now. Please try again."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate Next 10" })).toBeVisible();
});
