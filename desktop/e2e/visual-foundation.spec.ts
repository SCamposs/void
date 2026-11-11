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
  for (const icon of await page.locator(".palette-results > button > svg:first-child").all()) {
    const bounds = (await icon.boundingBox())!;
    expect(bounds.width).toBe(18);
    expect(bounds.height).toBe(18);
  }
  await page.screenshot({ path: testInfo.outputPath("navigation-icons.png") });
  await search.fill("typing");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("combobox", { name: "Duração", exact: true })).toBeVisible();
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

test("Orbit selects stay inside their rows at desktop, compact and enlarged text sizes", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "Orbit", exact: true }).click();
  await page.getByRole("button", { name: "Open Orbit settings", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Orbit settings", exact: true });
  for (const size of [{ width: 1280, height: 800 }, { width: 720, height: 560 }]) {
    await page.setViewportSize(size);
    for (const fontSize of ["16px", "20px"]) {
      await page.evaluate((value) => { document.documentElement.style.fontSize = value; }, fontSize);
      for (const row of await panel.locator(".orbit-setting-row").all()) {
        const field = (await row.getByRole("combobox").boundingBox())!;
        const bounds = (await row.boundingBox())!;
        expect(field.x).toBeGreaterThanOrEqual(bounds.x);
        expect(field.x + field.width).toBeLessThanOrEqual(bounds.x + bounds.width + .5);
      }
    }
  }
  await panel.getByRole("combobox", { name: "Quality", exact: true }).click();
  await page.getByRole("option", { name: "Performance", exact: true }).click();
  await expect(panel.getByRole("combobox", { name: "Quality", exact: true })).toContainText("Performance");
  await page.screenshot({ path: testInfo.outputPath("orbit-select-containment.png") });
});

test("Sidebar width interpolates in both directions and respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const widths = await page.evaluate(async () => {
    const shell = document.querySelector<HTMLElement>(".void-shell")!;
    const sidebar = document.querySelector<HTMLElement>(".void-sidebar")!;
    const toggle = document.querySelector<HTMLButtonElement>(".sidebar-toggle")!;
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const expanded = sidebar.getBoundingClientRect().width;
    const sample = async () => {
      toggle.click();
      await frame(); await frame();
      const animation = shell.getAnimations()[0];
      if (!animation) throw new Error("Sidebar changes without a width transition");
      animation.pause();
      animation.currentTime = Number(animation.effect!.getTiming().duration) / 2;
      const middle = sidebar.getBoundingClientRect().width;
      animation.finish();
      await frame();
      return { middle, end: sidebar.getBoundingClientRect().width };
    };
    const closing = await sample();
    const opening = await sample();
    return { expanded, closing, opening };
  });
  expect(widths.closing.middle).toBeLessThan(widths.expanded);
  expect(widths.closing.middle).toBeGreaterThan(widths.closing.end);
  expect(widths.opening.middle).toBeGreaterThan(widths.closing.end);
  expect(widths.opening.middle).toBeLessThan(widths.expanded);
  expect(widths.opening.end).toBe(widths.expanded);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Collapse navigation", exact: true }).click();
  expect(await page.locator(".void-shell").evaluate((element) => element.getAnimations().length)).toBe(0);
});

test("Settings removes legacy appearance and keeps safe data confirmation", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const oldTheme = JSON.stringify({ fontScale: 1.2, accentIntensity: .7, noise: .25, scanlines: true, backgroundTexture: "radial" });
    localStorage.setItem("void.app.theme.v2", oldTheme);
    localStorage.setItem("void-desktop-theme", oldTheme);
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "A little space to focus." })).toBeVisible();
  await expect(page.locator("html")).toHaveCSS("font-size", "16px");
  await expect(page.locator("body")).toHaveCSS("font-family", /Barlow/);
  await expect(page.locator("body")).toHaveCSS("background-color", "oklch(0 0 0)");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByText("App appearance", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "Noise", exact: true })).toHaveCount(0);
  const automaticUpdates = page.getByRole("switch", { name: "Check for updates automatically" });
  await expect(automaticUpdates).toHaveAttribute("aria-checked", "true");
  await automaticUpdates.click();
  await expect(automaticUpdates).toHaveAttribute("aria-checked", "false");
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(automaticUpdates).toHaveAttribute("aria-checked", "false");
  await automaticUpdates.click();
  await page.getByRole("button", { name: "Local data", exact: true }).click();
  const importAction = page.getByRole("button", { name: "Import app data", exact: true });
  await importAction.focus();
  await expect(importAction).toBeFocused();
  await page.getByRole("button", { name: "Reset local data", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("settings.png") });
});

test("Module switches and sliders keep their keyboard and persistence behavior", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "Stacker", exact: true }).click();
  await page.locator("main").getByRole("button", { name: "Settings", exact: true }).click();
  const ghost = page.getByRole("switch", { name: "Ghost piece", exact: true });
  const beforeGhost = await ghost.getAttribute("aria-checked");
  await ghost.click();
  await expect(ghost).toHaveAttribute("aria-checked", beforeGhost === "true" ? "false" : "true");
  await page.getByRole("button", { name: "Input tuning", exact: true }).click();
  const das = page.getByRole("slider", { name: "DAS", exact: true });
  const before = Number(await das.getAttribute("aria-valuenow"));
  await das.focus(); await page.keyboard.press("ArrowRight");
  await expect(das).toHaveAttribute("aria-valuenow", String(before + 5));
  await page.screenshot({ path: testInfo.outputPath("stacker-shared-controls.png") });
  await page.reload();
  await page.getByRole("button", { name: "Stacker", exact: true }).click();
  await page.locator("main").getByRole("button", { name: "Settings", exact: true }).click();
  await expect(ghost).toHaveAttribute("aria-checked", beforeGhost === "true" ? "false" : "true");
  await page.getByRole("button", { name: "Input tuning", exact: true }).click();
  await expect(das).toHaveAttribute("aria-valuenow", String(before + 5));
});

test("Typing and embedded Mind keep functional fields and custom controls", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "Typing", exact: true }).click();
  const duration = page.getByRole("combobox", { name: "Duração", exact: true });
  await duration.click();
  await page.screenshot({ path: testInfo.outputPath("select-open.png") });
  await page.getByRole("option", { name: "60s", exact: true }).click();
  await expect(duration).toContainText("60s");
  const typingInput = page.getByRole("textbox", { name: /^Digite a palavra / });
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(typingInput).toBeFocused();
  const word = "rápido";
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

test("Normal intro has white terminal styles, self-dismisses and supports Escape", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  const logo = page.locator(".void-intro .void-logo-path");
  await expect(logo).toBeVisible();
  // Complete the actual CSS animations, rather than racing the short final hold.
  const endTimes = await logo.evaluate((element) => element.getAnimations().map((animation) => {
    const end = animation.effect!.getComputedTiming().endTime;
    animation.finish();
    return Number(end);
  }));
  expect(endTimes).toHaveLength(2);
  expect(Math.max(...endTimes)).toBeLessThanOrEqual(3000);
  await expect(logo).toHaveCSS("stroke-width", "0px");
  const terminal = await logo.evaluate((element) => {
    const style = getComputedStyle(element);
    const context = document.createElement("canvas").getContext("2d")!;
    const rgba = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    return { fill: rgba(style.fill), stroke: rgba(style.stroke) };
  });
  // Animation interpolation may serialize OKLab while the stroke stays OKLCH.
  expect(terminal.fill.every((channel, index) => Math.abs(channel - terminal.stroke[index]) <= 1)).toBe(true);
  expect(terminal.fill.slice(0, 3).every((channel) => channel >= 230)).toBe(true);
  expect(terminal.fill[3]).toBe(255);
  await page.locator(".void-intro").evaluate((element) => element.getAnimations({ subtree: true }).forEach((animation) => animation.finish()));
  await expect(page.locator(".intro-wordmark")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: testInfo.outputPath("intro-white-final.png") });
  await expect(page.locator(".void-intro")).toHaveCount(0, { timeout: 4000 });
  await page.reload();
  await expect(page.getByRole("button", { name: "Skip Intro" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".void-intro")).toHaveCount(0);
});
