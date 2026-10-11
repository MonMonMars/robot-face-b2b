import { expect, test } from "@playwright/test";

test.describe("control studio smoke", () => {
  test("loads, connects to mock stream, shows presence", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Robot Face" })).toBeVisible();
    await expect(page.locator("#face-canvas")).toBeVisible();

    const streamUrl = page.locator("#stream-url");
    await streamUrl.fill("ws://127.0.0.1:8765/stream");

    await page.getByRole("button", { name: "Connect" }).click();

    await expect(page.locator("#conn-badge")).toHaveClass(/badge--on/, {
      timeout: 20_000,
    });
    await expect(page.locator("#presence-count")).toContainText(/1 connected/i, {
      timeout: 10_000,
    });
  });
});
