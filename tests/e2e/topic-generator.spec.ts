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

function mockPair(title: string, relatedTopics: string[] = []) {
  return {
    topic: {
      title,
      summary: `Summary for ${title}.`,
      content: `## Overview\nMarkdown content about ${title}.`,
      tags: ["Architecture"],
      relatedTopics,
    },
    referenceCard: {
      summary: `Quick reference for ${title}.`,
      content: `## Key Points\n- Point about ${title}`,
      tags: [],
      relatedTopics: [],
    },
  };
}

test("generates, previews, selects, and saves a batch, then generates another", async ({
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

  await setNextGroqResponse(MOCK_PORT, {
    topics: [
      mockPair(existingTopicTitle), // exact duplicate of the topic just created
      mockPair(`E2E Circuit Breaker Pattern ${runId}`),
      mockPair(`E2E Saga Pattern ${runId}`, [`E2E Circuit Breaker Pattern ${runId}`]),
    ],
  });

  await page.locator("aside").getByRole("button", { name: "AI Generate Topics" }).click();
  await expect(page.getByText("Existing topics:")).toBeVisible();
  await page.getByLabel("Category", { exact: true }).selectOption({ label: categoryName });
  await page.getByRole("button", { name: "Generate Next 10" }).click();

  await expect(page.getByText("3 new topics suggested.")).toBeVisible();
  await expect(
    page.getByText("Each includes a companion Reference Card"),
  ).toBeVisible();
  await expect(page.getByText("Exact duplicate")).toBeVisible();

  const duplicateCheckbox = page.locator(`#candidate-0`);
  await expect(duplicateCheckbox).not.toBeChecked();
  const sagaCheckbox = page.locator(`li:has-text("E2E Saga Pattern ${runId}") input[type="checkbox"]`);
  await expect(sagaCheckbox).toBeChecked();
  await sagaCheckbox.uncheck();

  await expect(page.getByRole("button", { name: "Add Selected (1)" })).toBeVisible();
  await page.getByRole("button", { name: "Add Selected (1)" }).click();

  await expect(page.getByText("Topics Added")).toBeVisible();
  await expect(page.getByText("1 topic added")).toBeVisible();
  await expect(page.getByText("Plus 1 companion Reference Card")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByText(`E2E Circuit Breaker Pattern ${runId}`).first(),
  ).toBeVisible();
  await expect(page.getByText(`E2E Saga Pattern ${runId}`)).toHaveCount(0);

  // Generate again for the same category, considering what was just added.
  await setNextGroqResponse(MOCK_PORT, {
    topics: [mockPair(`E2E Bulkhead Pattern ${runId}`)],
  });
  await page.locator("aside").getByRole("button", { name: "AI Generate Topics" }).click();
  await page.getByLabel("Category", { exact: true }).selectOption({ label: categoryName });
  await page.getByRole("button", { name: "Generate Next 10" }).click();
  await expect(page.getByText("1 new topic suggested.")).toBeVisible();
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

  // Malformed: referenceCard missing entirely.
  await setNextGroqResponse(MOCK_PORT, {
    topics: [{ topic: mockPair(`E2E Broken ${runId}`).topic }],
  });

  await page.locator("aside").getByRole("button", { name: "AI Generate Topics" }).click();
  await page.getByLabel("Category", { exact: true }).selectOption({ label: categoryName });
  await page.getByRole("button", { name: "Generate Next 10" }).click();

  await expect(
    page.getByText("Unable to generate topics right now. Please try again."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate Next 10" })).toBeVisible();
});
