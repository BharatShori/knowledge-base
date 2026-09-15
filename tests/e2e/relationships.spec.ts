import { expect, test } from "@playwright/test";
import { cleanupTestData } from "./cleanup";

test.beforeEach(cleanupTestData);
test.afterEach(cleanupTestData);

async function createTopic(
  page: import("@playwright/test").Page,
  title: string,
) {
  await page
    .locator("aside")
    .getByRole("button", { name: "Add topic" })
    .click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Category").selectOption({ label: "Automation" });
  await page.getByRole("button", { name: /save topic/i }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test("adds tags, related topics, and sources", async ({ page }) => {
  const primaryTitle = `E2E Relationship primary ${Date.now()}`;
  const relatedTitle = `E2E Relationship related ${Date.now()}`;
  await page.goto("/");
  await createTopic(page, primaryTitle);
  await createTopic(page, relatedTitle);

  await page
    .locator("main")
    .getByRole("button", { name: new RegExp(primaryTitle) })
    .click();
  await page.getByRole("button", { name: "Edit topic" }).click();
  await page.getByLabel(relatedTitle).check();
  await page.getByRole("button", { name: /add source/i }).click();
  await page.getByLabel("Source title 1").fill("Playwright documentation");
  await page.getByLabel("Source URL 1").fill("https://playwright.dev");
  await page.getByRole("button", { name: /save topic/i }).click();
  await expect(page.getByRole("heading", { name: primaryTitle })).toBeVisible();
  await expect(
    page
      .locator("main")
      .getByRole("button", { name: relatedTitle, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Playwright documentation" }),
  ).toHaveAttribute("href", "https://playwright.dev");
});
