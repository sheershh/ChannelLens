import { expect, test } from "@playwright/test";

// Regenerates the README screenshots from demo mode:  SCREENSHOTS=1 npx playwright test screenshots
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to regenerate docs/screenshots");
test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

const OUT = "../docs/screenshots";
const ids = ["UCdemooooooooooooooooooo", "UCdemoffffffffffffffffff", "UCdemommmmmmmmmmmmmmmmmm"];

test("capture README screenshots", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "@orbitlab" })).toBeVisible();
  await page.screenshot({ path: `${OUT}/home.png` });

  await page.goto(`/channel/${ids[0]}`);
  await expect(page.locator("tbody tr")).toHaveCount(20);
  await page.waitForTimeout(2500); // let chart animations finish
  await page.screenshot({ path: `${OUT}/dashboard.png`, fullPage: true });

  await page.goto(`/compare?ids=${ids.join(",")}`);
  await expect(page.getByRole("heading", { name: "Subscriber growth, last 90 days" })).toBeVisible();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/compare.png`, fullPage: true });
});
