import { expect, test } from "@playwright/test";
import { cleanupTestData } from "./cleanup";

test.beforeEach(cleanupTestData);
test.afterEach(cleanupTestData);

test("creates and deletes an empty category", async ({ page }) => {
  const categoryName = `E2E Quality Gates ${Date.now()}`;
  await page.goto("/");
  await page
    .locator("aside")
    .getByRole("button", { name: "Manage categories" })
    .click();
  await page.getByRole("button", { name: /add category/i }).click();
  await page.getByLabel("Category name").fill(categoryName);
  await page.getByRole("button", { name: /save category/i }).click();
  await expect(page.getByText(categoryName).first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page
    .locator("aside")
    .getByRole("button", { name: "Manage categories" })
    .click();
  await page.getByRole("button", { name: `Delete ${categoryName}` }).click();
  await expect(
    page.getByRole("button", { name: `${categoryName} 0` }),
  ).not.toBeVisible();
});

test("explains why a category containing topics cannot be deleted", async ({
  page,
}) => {
  const categoryName = `E2E Used Category ${Date.now()}`;
  const topicName = `E2E Category Topic ${Date.now()}`;
  await page.goto("/");
  await page
    .locator("aside")
    .getByRole("button", { name: "Manage categories" })
    .click();
  await page.getByRole("button", { name: /add category/i }).click();
  await page.getByLabel("Category name").fill(categoryName);
  await page.getByRole("button", { name: /save category/i }).click();
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(
    page.locator("aside").getByRole("button", { name: "Add topic" }),
  ).toBeVisible();

  await page
    .locator("aside")
    .getByRole("button", { name: "Add topic" })
    .click();
  await expect(page.getByRole("dialog").getByLabel("Title")).toBeVisible();
  await page.getByLabel("Title").fill(topicName);
  await page.getByLabel("Category", { exact: true }).selectOption({ label: categoryName });
  await page.getByRole("button", { name: /save topic/i }).click();
  await expect(page.getByRole("heading", { name: topicName })).toBeVisible();
  await page.waitForLoadState("networkidle");

  await page
    .locator("aside")
    .getByRole("button", { name: "Manage categories" })
    .click();
  await page.getByRole("button", { name: `Delete ${categoryName}` }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
    "Category cannot be deleted because it contains topics.",
  );
});
