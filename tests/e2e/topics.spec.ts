import { expect, test } from "@playwright/test";
import { cleanupTestData } from "./cleanup";

test.beforeEach(cleanupTestData);
test.afterEach(cleanupTestData);

test("creates, views, edits, and deletes a topic", async ({ page }) => {
  const runId = Date.now();
  const e2eTag = `e2e-${runId}`;
  const typescriptTag = `typescript-${runId}`;
  await page.goto("/");
  await page.getByRole("button", { name: "Add topic" }).click();
  const topicTitle = `E2E Playwright ${runId}`;
  await page.getByLabel("Title").fill(topicTitle);
  await page.getByLabel("Category").selectOption({ label: "Automation" });
  await page
    .getByLabel("Summary")
    .fill("Browser automation for reliable end-to-end tests.");
  await page
    .getByLabel("Content")
    .fill("## Key concepts\n\n- Browser\n- Locator\n\n**Reliable tests**");
  await page.getByLabel("Tags").fill(`${e2eTag}, ${typescriptTag}`);
  await page.getByRole("button", { name: /save topic/i }).click();
  await expect(page.getByRole("heading", { name: topicTitle })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Key concepts" }),
  ).toBeVisible();
  await expect(page.getByText("Reliable tests")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(e2eTag).first()).toBeVisible();
  await page.getByRole("button", { name: /edit topic/i }).click();
  await page.getByLabel("Title").fill(`${topicTitle} Testing`);
  await page.getByRole("button", { name: /save topic/i }).click();
  await expect(
    page.getByRole("heading", { name: `${topicTitle} Testing` }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder("Search topics...").fill(typescriptTag);
  await expect(
    page.getByRole("button", { name: new RegExp(topicTitle) }).first(),
  ).toBeVisible();
  await page.getByPlaceholder("Search topics...").fill("");
  await page
    .locator("main")
    .getByRole("button", { name: e2eTag, exact: true })
    .click();
  await expect(
    page
      .locator("main")
      .getByRole("button", { name: new RegExp(topicTitle) })
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: /delete topic/i }).click();
  await page.getByRole("button", { name: /confirm delete/i }).click();
  await expect(
    page.getByRole("heading", { name: `${topicTitle} Testing` }),
  ).not.toBeVisible();
});
