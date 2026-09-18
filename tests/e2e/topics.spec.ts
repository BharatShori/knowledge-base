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

test("copies a topic as rich text for sharing", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const runId = Date.now();
  const topicTitle = `E2E Copy ${runId}`;
  await page.goto("/");
  await page.getByRole("button", { name: "Add topic" }).click();
  await page.getByLabel("Title").fill(topicTitle);
  await page.getByLabel("Category").selectOption({ label: "Automation" });
  await page.getByLabel("Summary").fill("Summary for copy test.");
  await page.getByLabel("Content").fill("## Notes\n\n- One\n- Two");
  await page.getByRole("button", { name: /save topic/i }).click();
  await expect(page.getByRole("heading", { name: topicTitle })).toBeVisible();
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: /copy topic for sharing/i }).click();
  await expect(
    page.getByRole("button", { name: /copied topic to clipboard/i }),
  ).toBeVisible();

  const html = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (item.types.includes("text/html")) {
        return await (await item.getType("text/html")).text();
      }
    }
    return null;
  });
  expect(html).toContain(`<h1>${topicTitle}</h1>`);
  expect(html).toContain("Summary for copy test.");
  expect(html).toContain("<h2>Notes</h2>");
  expect(html).toContain("<li>One</li>");
});
