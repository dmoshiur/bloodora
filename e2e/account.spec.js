import { test, expect } from "@playwright/test";
import { offlineAssets } from "./assets.js";
import { makeT } from "../src/web/i18n.js";

const t = makeT("en");
async function login(page, role = "user") {
  await page.goto("/login");
  await page.getByLabel(t("auth_email"), { exact: true }).fill(`${role}@example.test`);
  await page.getByLabel(t("auth_password"), { exact: true }).fill("test-only-password");
  await page.locator('form[action="/login"] button[type=submit]').click();
  await expect(page).toHaveURL(role === "user" ? /\/dashboard$/ : /\/admin$/);
}
async function menu(page) {
  if (await page.locator(".navbar-toggler").isVisible()) {
    await page.locator(".navbar-toggler").click();
    await expect(page.locator("#navMain")).toHaveClass(/\bshow\b/);
  }
  await page.locator("#account-menu").click();
}
async function noOverflow(page) {
  const size = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, width: innerWidth }));
  expect(size.doc).toBeLessThanOrEqual(size.width + 1);
}

test.beforeEach(async ({ context }) => { await offlineAssets(context); });

test("anonymous direct URLs use login; unknown URLs retain custom 404", async ({ page }) => {
  for (const route of ["/dashboard", "/profile", "/profile/edit", "/admin", "/admin/dashboard", "/shop/admin/orders", "/messages/admin/messages"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('form[action="/login"]')).toBeVisible();
  }
  const response = await page.goto("/not-a-real-page");
  expect(response.status()).toBe(404);
  await expect(page.getByRole("heading", { name: t("err_404_title") })).toBeVisible();
});

test("real login issues one secure Turso session and survives reload/new tabs/history", async ({ page, context }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page);
  const cookie = (await context.cookies()).find((item) => item.name === "connect.sid");
  expect(cookie?.secure).toBe(true);
  expect(cookie?.httpOnly).toBe(true);
  expect((await context.cookies()).some((item) => item.name === "bloodora.session")).toBe(false);
  await expect(page.locator('nav a[href="/login"]')).toHaveCount(0);
  await expect(page.locator('nav a[href="/register"]')).toHaveCount(0);
  await menu(page);
  await expect(page.locator('#navMain a[href="/admin"]')).toHaveCount(0);
  await page.goto("/profile");
  await expect(page.getByText("user@example.test", { exact: false }).first()).toBeVisible();
  expect((await page.reload()).status()).toBe(200);
  await page.goto("/profile/edit");
  await page.goBack(); await expect(page).toHaveURL(/\/profile$/);
  await page.goForward(); await expect(page).toHaveURL(/\/profile\/edit$/);
  const tab = await context.newPage();
  expect((await tab.goto("/dashboard")).status()).toBe(200);
  await tab.close();
  await page.goto("/dashboard");
  await page.screenshot({ path: ".tmp/verified-dashboard-desktop.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("profile edits persist through the real API and invalid phone input is rejected", async ({ page }) => {
  await login(page);
  await page.goto("/profile/edit");
  await page.getByLabel(t("auth_full_name"), { exact: true }).fill("Updated browser name");
  await page.getByLabel(t("common_phone"), { exact: true }).fill("01800000000");
  await page.getByLabel(t("auth_holding"), { exact: true }).fill("Updated address");
  await page.getByRole("button", { name: t("common_save"), exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Updated browser name", exact: true })).toBeVisible();
  await expect(page.getByText("Updated address", { exact: false })).toBeVisible();
  await page.goto("/profile/edit");
  await page.getByLabel(t("common_phone"), { exact: true }).fill("invalid");
  await page.getByRole("button", { name: t("common_save"), exact: true }).click();
  await expect(page.locator("[role=alert]")).toContainText("Invalid phone number");
  await expect(page.locator("[name=phone]")).toHaveValue("invalid");
});

test("normal users are denied admin pages and mutations", async ({ page }) => {
  await login(page);
  for (const route of ["/admin", "/admin/dashboard", "/admin/users", "/admin/settings", "/shop/admin/products", "/messages/admin/messages", "/support/admin/sessions", "/ai-help/admin/config"]) {
    expect((await page.goto(route)).status(), route).toBe(403);
    await expect(page.getByRole("heading", { name: t("err_403_title") })).toBeVisible();
  }
  const response = await page.request.post("/admin/create-admin", { form: { name: "must not save" } });
  expect(response.status()).toBe(403);
});

for (const role of ["admin", "superadmin"]) test(`${role}: every connected admin section renders from the unified app`, async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, role);
  await expect(page.getByRole("heading", { name: t("adm_dashboard"), exact: false })).toBeVisible();
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin$/);
  expect((await page.reload()).status()).toBe(200);
  const links = await page.locator("aside nav a").evaluateAll((elements) => elements.map((element) => element.getAttribute("href")).filter((href) => href?.startsWith("/")));
  for (const route of [...new Set(links)]) {
    expect((await page.goto(route)).status(), route).toBe(200);
    await expect(page.getByRole("heading", { name: t("err_404_title") })).toHaveCount(0);
  }
  await page.goto("/admin/integrations");
  await expect(page.getByRole("heading", { name: "Integrations & SMS" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("logout revokes private history access and Bangla persists", async ({ page, context }) => {
  await login(page);
  await page.goto("/set-language/bn?next=/dashboard");
  await page.locator('.dash-sidebar form[action="/logout"] button').click();
  await expect(page).toHaveURL("https://localhost:4599/");
  await page.goBack();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
  expect((await context.cookies()).some((item) => item.name === "bloodora.session")).toBe(false);
});

test("login return URLs cannot send users to missing/admin pages", async ({ page }) => {
  await page.goto("/login?next=/nonexistent");
  await page.locator("[name=email]").fill("user@example.test");
  await page.locator("[name=password]").fill("test-only-password");
  await page.locator('form[action="/login"] button').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/login"); await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/register"); await expect(page).toHaveURL(/\/dashboard$/);
});

test("Bangla/English account pages stay within mobile, tablet, laptop and desktop viewports", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, "admin");
  for (const lang of ["bn", "en"]) {
    const tr = makeT(lang);
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [route, key] of [["/dashboard", "dash_welcome"], ["/profile", "prof_title"], ["/profile/edit", "prof_edit"], ["/admin", "adm_dashboard"]]) {
        expect((await page.goto(`/set-language/${lang}?next=${route}`)).status()).toBe(200);
        await expect(page.locator("html")).toHaveAttribute("lang", lang);
        const displayName = key === "dash_welcome" ? "Browser" : "Browser admin";
        await expect(page.getByRole("heading", { name: tr(key, { name: displayName }), exact: false })).toBeVisible();
        await noOverflow(page);
      }
      await menu(page);
      await expect(page.locator('#navMain a[href="/profile"]')).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
});

test("registration creates a real account and lands in its dashboard", async ({ page }) => {
  const email = `registered.${Date.now()}@example.test`;
  await page.goto("/register");
  for (const [name, value] of Object.entries({ name: "Registered browser user", phone: "01700000000", email, password: "test-only-password", date_of_birth: "2000-01-01" })) {
    await page.locator(`[name="${name}"]`).fill(value);
  }
  await page.locator("[name=blood_group]").selectOption("O+");
  await page.locator("[name=role]").selectOption("Both");
  await page.locator("[name=division]").selectOption({ index: 1 });
  await page.locator("[name=district]").selectOption({ index: 1 });
  await page.locator("[name=upazila]").selectOption({ index: 1 });
  await page.locator('form[action="/register"] button[type=submit]').click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/profile");
  await expect(page.getByText(email, { exact: false })).toBeVisible();
});

test("CSRF blocks tokenless forms; disabled SMS fails honestly without exposing a code", async ({ page }) => {
  const rejected = await page.request.post("/login", { form: { email: "user@example.test", password: "test-only-password" } });
  expect(rejected.status()).toBe(403);
  await login(page);
  await page.goto("/dashboard/security");
  await expect(page.getByRole("heading", { name: "Phone verification" })).toBeVisible();
  await page.locator('form[action="/dashboard/security/phone/request"] button').click();
  await expect(page.locator("[role=alert]")).toContainText(/SMS|disabled|configured/i);
  await expect(page.locator("body")).not.toContainText(/\b\d{6}\b/);
});

test("password recovery renders and gives the same generic outcome without configured mail", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("user@example.test");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.locator("[role=alert]")).toContainText("If that account exists");
  await expect(page).toHaveURL(/\/forgot-password$/);
});
