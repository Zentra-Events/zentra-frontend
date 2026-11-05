import { test, expect } from "@playwright/test";

test("application launches and main page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/zentra/i);
});

test("main application page loads with navigation", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h1, h2, h3, [data-testid='login-form'], form")).toBeVisible();
});

test("unauthenticated user is redirected to login from root", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/login");
    await expect(page).toHaveURL(/.*\/login/);
});
