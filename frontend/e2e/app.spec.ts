import { expect, type Page, test } from "@playwright/test";

const ORBIT = "UCdemooooooooooooooooooo";
const uniqueEmail = () => `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

async function signUp(page: Page, email: string) {
  // Wait for the client-side navigation to finish before typing.
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  // Next 16 keeps recently visited routes mounted but hidden (React <Activity>), so a hidden
  // login form can coexist with this one: only target what's visible.
  await page.getByLabel("Email").filter({ visible: true }).fill(email);
  await page.getByLabel("Password").filter({ visible: true }).fill("e2e-password-1");
  await page.getByRole("button", { name: "Create account" }).click();
}

test("search an @handle and land on the channel dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/Demo mode/)).toBeVisible();
  await page.getByRole("button", { name: "@orbitlab" }).click();

  await expect(page).toHaveURL(`/channel/${ORBIT}`);
  await expect(page.getByRole("heading", { name: "Orbit Lab", level: 1 })).toBeVisible();
  await expect(page.getByText("Subscribers", { exact: true })).toBeVisible();
  await expect(page.getByText(/daily snapshots since/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent uploads" })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(20);
  await expect(page).toHaveTitle(/Orbit Lab · ChannelLens/);
});

test("free-text search lists matches to pick from", async ({ page }) => {
  await page.goto("/");
  // "channel" matches all three demo channels, so a list appears instead of jumping straight to one.
  await page.getByRole("textbox", { name: /search youtube channels/i }).fill("channel");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("button", { name: /Byte Forge/ }).click();
  await expect(page.getByRole("heading", { name: "Byte Forge", level: 1 })).toBeVisible();
});

test("sign up from a channel page, watch it, see it on the watchlist, then sign out", async ({ page }) => {
  await page.goto(`/channel/${ORBIT}`);
  await page.getByRole("link", { name: "Sign in to track growth" }).click();
  await page.getByRole("link", { name: "Create an account" }).click();
  await signUp(page, uniqueEmail());

  await expect(page).toHaveURL(`/channel/${ORBIT}`);
  await page.getByRole("button", { name: "+ Add to watchlist" }).click();
  await expect(page.getByRole("button", { name: "✓ On your watchlist" })).toBeVisible();

  await page.getByRole("link", { name: "Watchlist", exact: true }).click();
  const card = page.getByRole("listitem").filter({ hasText: "Orbit Lab" });
  await expect(card).toBeVisible();
  await expect(card.getByText(/Added (just now|\d+ minutes? ago)/)).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/watchlist");
  await expect(page.getByText("Sign in to save channels", { exact: false })).toBeVisible();
});

test("watchlist: add by handle, select two, compare", async ({ page }) => {
  await page.goto("/register?next=/watchlist");
  await signUp(page, uniqueEmail());
  await expect(page).toHaveURL("/watchlist");

  const box = page.getByRole("textbox", { name: /search youtube channels/i });
  for (const handle of ["@orbitlab", "@masalamornings"]) {
    await box.fill(handle);
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: handle.slice(1, 6) })).toHaveCount(1, { timeout: 10_000 });
  }
  await page.getByLabel("Select Orbit Lab for comparison").check();
  await page.getByLabel("Select Masala Mornings for comparison").check();
  await page.getByRole("button", { name: "Compare selected (2)" }).click();

  await expect(page).toHaveURL(/\/compare\?ids=/);
  await expect(page.getByRole("columnheader", { name: /Orbit Lab/ })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Masala Mornings/ })).toBeVisible();
  await expect(page.getByText("(leader)").first()).toBeAttached();
  await expect(page.getByRole("heading", { name: "Subscriber growth, last 90 days" })).toBeVisible();
});

test("compare page builds the URL as channels are added and removed", async ({ page }) => {
  await page.goto("/compare");
  const box = page.getByRole("textbox", { name: /search youtube channels/i });
  await box.fill("@orbitlab");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Add one more channel to compare.")).toBeVisible();
  await box.fill("@byteforge");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.locator("table")).toContainText("Avg views / upload");

  await page.getByRole("button", { name: "Remove Orbit Lab" }).click();
  await expect(page).toHaveURL(/ids=UCdemoffff/);
  await expect(page.locator("table")).toHaveCount(0);
});

test("unknown channel shows a clear error", async ({ page }) => {
  await page.goto(`/channel/UC${"z".repeat(22)}`);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Channel not found.");
});

test("auth errors are shown inline", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").filter({ visible: true }).fill("nobody@example.com");
  await page.getByLabel("Password").filter({ visible: true }).fill("wrong-password");
  await page.getByRole("main").getByRole("button", { name: "Sign in" }).click();
  // Next.js adds its own role="alert" route announcer, so look inside <main>.
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Wrong email or password.");
});
