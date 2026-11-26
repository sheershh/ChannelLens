import { expect, test } from "@playwright/test";

// Runs on desktop and on a phone-sized viewport.
test("home and dashboard render without horizontal overflow", async ({ page }) => {
  for (const path of ["/", "/channel/UCdemommmmmmmmmmmmmmmmmm"]) {
    await page.goto(path);
    await expect(page.getByRole("link", { name: "ChannelLens home" })).toBeVisible();
    if (path !== "/") await expect(page.getByRole("heading", { name: "Masala Mornings", level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
  }
});
