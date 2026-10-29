import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => { await page.goto("/"); await expect(page.getByRole("heading", { name: "A little space to focus." })).toBeVisible(); });

test("Home identity, navigation size, keyboard dialog and compact layout", async ({ page }, testInfo) => {
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("body")).toHaveCSS("font-family", /Barlow/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-family", /Urbanist/);
  const sidebar = page.locator(".void-sidebar");
  const expanded = (await sidebar.boundingBox())!.width;
  await page.getByRole("button", { name: "Collapse navigation", exact: true }).click();
  expect((await sidebar.boundingBox())!.width).toBeLessThan(expanded);
  await page.getByRole("button", { name: "Expand navigation", exact: true }).click();
  const find = page.getByRole("button", { name: "Find a module", exact: true });
  await find.click();
  const search = page.getByRole("textbox", { name: "Search modules" });
  await expect(search).toBeFocused();
  await search.fill("typing");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("combobox", { name: "Duration", exact: true })).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(search).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Open Home" }).click();
  await page.screenshot({ path: testInfo.outputPath("home-desktop.png") });
  await page.setViewportSize({ width: 760, height: 600 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const compactWidth = (await sidebar.boundingBox())!.width;
  await page.getByRole("button", { name: "Collapse navigation", exact: true }).click();
  expect((await sidebar.boundingBox())!.width).toBeLessThan(compactWidth);
  await expect(page.getByRole("button", { name: "Typing Find your rhythm", exact: false })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("home-compact.png") });
});

test("Shared switch, slider, select, disclosure and safe confirmation preserve settings", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const scanlines = page.getByRole("switch", { name: "Scanlines", exact: true });
  const wasChecked = await scanlines.getAttribute("aria-checked");
  await scanlines.click();
  await expect(scanlines).toHaveAttribute("aria-checked", wasChecked === "true" ? "false" : "true");
  const noise = page.getByRole("slider", { name: "Noise", exact: true });
  const before = Number(await noise.getAttribute("aria-valuenow"));
  await noise.focus(); await page.keyboard.press("ArrowRight");
  await expect(noise).toHaveAttribute("aria-valuenow", String(Number((before + .01).toFixed(2))));
  const texture = page.getByRole("combobox", { name: "Background texture", exact: true });
  await texture.click();
  const popup = page.getByRole("listbox");
  await expect(popup).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("select-open.png") });
  await page.getByRole("option", { name: "Flat", exact: true }).click();
  await expect(texture).toContainText("Flat");
  await page.getByRole("button", { name: "Local data", exact: true }).click();
  await page.getByRole("button", { name: "Reset local data", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("settings.png") });
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(scanlines).toHaveAttribute("aria-checked", wasChecked === "true" ? "false" : "true");
  await expect(texture).toContainText("Flat");
});

test("Typing and embedded Mind keep functional fields and custom controls", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "Typing", exact: true }).click();
  const duration = page.getByRole("combobox", { name: "Duration", exact: true });
  await duration.click(); await page.getByRole("option", { name: "60s", exact: true }).click();
  await expect(duration).toContainText("60s");
  const typingInput = page.getByRole("textbox", { name: /^Type the word / });
  const word = (await typingInput.getAttribute("aria-label"))!.replace("Type the word ", "");
  await typingInput.focus();
  await page.keyboard.type(word);
  await expect(typingInput).toHaveValue(word);
  await page.screenshot({ path: testInfo.outputPath("typing-shared-chrome.png") });
  await page.getByRole("button", { name: "Mind", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Connect a model you control.", exact: true })).toBeVisible();
  await expect(page.locator("select")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Loopback endpoint" }).fill("http://127.0.0.1:9090");
  await expect(page.getByRole("textbox", { name: "Loopback endpoint" })).toHaveValue("http://127.0.0.1:9090");
  await page.getByRole("button", { name: "Let VOID start it" }).click();
  const context = page.getByLabel("Context tokens", { exact: true });
  const contextBefore = Number((await context.inputValue()).replaceAll(",", ""));
  await page.getByRole("button", { name: "Increase Context tokens" }).click();
  await expect.poll(async () => Number((await context.inputValue()).replaceAll(",", ""))).toBe(contextBefore + 512);
  await page.screenshot({ path: testInfo.outputPath("mind-shared-chrome.png") });
});

test("Reduced motion resolves the canonical intro mark without waiting", async ({ page }) => {
  await expect(page.locator(".void-intro")).toHaveCount(0);
  await expect(page.locator(".home-mark path")).toHaveAttribute("d", "M 10 5 L 50 95 L 90 5 L 42 45 L 70 25 L 50 70 L 21.1 5 Z");
});

test("Normal intro finishes in white and allows keyboard dismissal", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  const logo = page.locator(".void-intro .void-logo-path");
  await expect(logo).toBeVisible();
  await expect.poll(async () => logo.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.strokeWidth === "0px" && style.fill === style.stroke;
  }), { intervals: [16], timeout: 3100 }).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("intro-white-final.png") });
  await expect(page.locator(".void-intro")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Skip Intro" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".void-intro")).toHaveCount(0);
});
