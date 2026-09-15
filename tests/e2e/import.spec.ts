import { expect, test } from "@playwright/test";
import { cleanupTestData } from "./cleanup";

test.beforeEach(cleanupTestData);
test.afterEach(cleanupTestData);

test("imports multiple topics from a JSON array", async ({ page }) => {
  const runId = Date.now();
  const firstTitle = `E2E Imported Playwright ${runId}`;
  const secondTitle = `E2E Imported REST API ${runId}`;
  await page.goto("/");
  await page.getByRole("button", { name: /import json/i }).click();
  await page.getByLabel("JSON input").fill(
    JSON.stringify([
      {
        title: firstTitle,
        category: "E2E Import",
        tags: [`e2e-import-${runId}`],
        sources: [{ title: "Playwright docs", url: "https://playwright.dev" }],
      },
      {
        title: secondTitle,
        category: "E2E Import",
        summary: "Imported API notes",
        tags: [`e2e-import-${runId}`],
      },
    ]),
  );
  await page.getByRole("button", { name: /import topics/i }).click();
  await expect(page.getByText("2 topics imported.")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(firstTitle).first()).toBeVisible();
  await expect(page.getByText(secondTitle).first()).toBeVisible();
  await expect(page.getByText(`e2e-import-${runId}`).first()).toBeVisible();
  await page.getByText(firstTitle).first().click();
  await expect(
    page.getByRole("link", { name: "Playwright docs" }),
  ).toHaveAttribute("href", "https://playwright.dev");
});

test("enriches an existing topic and ignores missing related topics", async ({
  page,
}) => {
  const runId = Date.now();
  const title = `E2E Existing topic ${runId}`;
  await page.goto("/");
  await page.getByRole("button", { name: "Add topic" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Category").selectOption({ label: "Automation" });
  await page.getByLabel("Content").fill("Short note");
  await page.getByRole("button", { name: /save topic/i }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: /import json/i }).click();
  await page.getByLabel("JSON input").fill(
    JSON.stringify({
      title,
      category: "Automation",
      content:
        "This is a substantially longer imported explanation that should replace the short note.",
      relatedTopics: ["Topic that does not exist"],
    }),
  );
  await page.getByRole("button", { name: /import topics/i }).click();
  await expect(page.getByText("1 topic imported.")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(
    page.getByText("This is a substantially longer imported explanation"),
  ).toBeVisible();
});
