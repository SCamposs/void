import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test("Stacker keeps full previews, responsive board and keyboard run flow", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Stacker", exact: true }).click();
  const shell = page.locator(".stacker-shell");
  const board = page.getByRole("img", { name: "Stacker playfield" });
  await expect(board).toBeVisible();
  await expect(shell.locator(".stacker-queue-piece")).toHaveCount(5);
  await page.screenshot({ path: testInfo.outputPath("stacker-ready.png") });
  await shell.getByRole("button", { name: "Start", exact: true }).click();
  await expect(shell.getByText("In flow", { exact: true })).toBeVisible({ timeout: 6000 });
  await expect(board).toBeFocused();
  await page.keyboard.press("c");
  await expect(shell.locator(".stacker-hold")).toHaveClass(/is-locked/);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Space");
  await expect(shell.locator('[data-cell="settled"]')).toHaveCount(4);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await expect(shell.locator('[data-cell="settled"]')).toHaveCount(8);
  await expect(shell.locator('[data-cell="ghost"]')).toHaveCount(4);
  await page.screenshot({ path: testInfo.outputPath("stacker-playing.png") });
  await page.keyboard.press("p");
  await expect(shell.locator(".stacker-state-overlay")).toContainText("Paused");
  await page.keyboard.press("Space");
  await expect(shell.getByText("In flow", { exact: true })).toBeVisible({ timeout: 6000 });
  await page.keyboard.press("r");
  await expect(shell.locator('[data-cell="settled"]')).toHaveCount(0);
  await expect(shell.locator(".stacker-state-overlay")).toContainText("Ready");

  for (const size of [{ width: 760, height: 600 }, { width: 1440, height: 600 }]) {
    await page.setViewportSize(size);
    await expect(shell.locator(".stacker-queue-piece").last()).toBeInViewport();
    const bounds = await board.boundingBox();
    const stage = await shell.locator(".stacker-stage").boundingBox();
    expect(bounds!.height / bounds!.width).toBeCloseTo(2, 1);
    expect(bounds!.x).toBeGreaterThanOrEqual(stage!.x);
    expect(bounds!.y).toBeGreaterThanOrEqual(stage!.y);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(stage!.y + stage!.height);
    const clock = await shell.locator(".stacker-clock").boundingBox();
    expect(clock!.y).toBeGreaterThanOrEqual(stage!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`stacker-${size.width}x${size.height}.png`) });
  }
});

test("line-clear feedback keeps the playfield fixed and honors reduced motion", async ({ page }, testInfo) => {
  await page.addInitScript(() => { localStorage.setItem("void_stacker_opener", "OOOOO"); });
  await page.goto("/");
  await page.getByRole("button", { name: "Stacker", exact: true }).click();
  const shell = page.locator(".stacker-shell");
  await shell.getByRole("button", { name: "Restart", exact: true }).click();
  await shell.getByRole("button", { name: "Start", exact: true }).click();
  await expect(shell.getByText("In flow", { exact: true })).toBeVisible({ timeout: 6000 });
  const before = await shell.locator(".stacker-board").boundingBox();
  for (const moves of [-4, -2, 0, 2, 4]) {
    for (let i = 0; i < Math.abs(moves); i += 1) await page.keyboard.press(moves < 0 ? "ArrowLeft" : "ArrowRight");
    await page.keyboard.press("Space");
  }
  await expect(shell.getByRole("status")).toContainText("ALL CLEAR");
  await expect(shell.locator(".stacker-board-footer")).toContainText("5 pieces");
  await expect(shell.locator('[data-cell="settled"]')).toHaveCount(0);
  expect(await shell.locator(".stacker-board").boundingBox()).toEqual(before);
  await expect(shell.locator(".stacker-particle, .stacker-clear-flash, .stacker-lock-flash, .stacker-drop-trail")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("stacker-all-clear.png") });
});

test("decoded reference sounds follow successful actions and the mute control", async ({ page }, testInfo) => {
  // Enforce the packaged policy, since Vite preview does not send Tauri CSP.
  const { app: { security: { csp } } } = JSON.parse(readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"));
  const policy = Object.entries(csp).map(([key, value]) => `${key} ${value}`).join("; ");
  await page.route("http://tauri.localhost/**", async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `http://127.0.0.1:4173${url.pathname}${url.search}` });
    await route.fulfill({ response, headers: { ...response.headers(), "Content-Security-Policy": policy } });
  });
  await page.addInitScript(() => {
    const recorded = window as unknown as { stackerAudioStarts: number[] };
    recorded.stackerAudioStarts = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function(this: AudioBufferSourceNode, ...args: [number?, number?, number?]) {
      recorded.stackerAudioStarts.push(this.buffer?.duration ?? 0);
      return start.apply(this, args);
    };
  });
  await page.goto("http://tauri.localhost/");
  await page.getByRole("button", { name: "Stacker", exact: true }).click();
  const shell = page.locator(".stacker-shell");
  const starts = () => page.evaluate(() => (window as unknown as { stackerAudioStarts: number[] }).stackerAudioStarts.length);
  await shell.getByRole("button", { name: "Start", exact: true }).click();
  await expect(shell.getByText("In flow", { exact: true })).toBeVisible({ timeout: 6000 });
  expect(await starts()).toBeGreaterThan(0);
  const beforeHold = await starts();
  await page.keyboard.press("c");
  await expect.poll(starts).toBeGreaterThan(beforeHold);
  const held = await starts();
  await page.keyboard.press("c");
  expect(await starts()).toBe(held);
  await shell.getByRole("button", { name: "Mute sound effects", exact: true }).click();
  await page.getByRole("img", { name: "Stacker playfield" }).click();
  const muted = await starts();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Space");
  expect(await starts()).toBe(muted);
  await shell.getByRole("button", { name: "Enable sound effects", exact: true }).click();
  await shell.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(shell.locator(".stacker-state-overlay")).toContainText("Paused");
  await shell.getByRole("button", { name: "Audio", exact: true }).click();
  await expect(shell.getByRole("combobox", { name: "Sound pack", exact: true })).toContainText("VOID glacial");
  const preview = await starts();
  await shell.getByRole("button", { name: "All clear", exact: true }).click();
  await expect.poll(starts).toBeGreaterThan(preview);
  await page.screenshot({ path: testInfo.outputPath("stacker-audio.png") });
  await shell.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("img", { name: "Stacker playfield" })).toBeFocused();
});

test("normal motion ties drop trails and lock flashes to the placed piece", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByRole("button", { name: "Stacker", exact: true }).click();
  const shell = page.locator(".stacker-shell");
  await shell.getByRole("button", { name: "Start", exact: true }).click();
  await expect(shell.getByText("In flow", { exact: true })).toBeVisible({ timeout: 6000 });
  await page.keyboard.press("Space");
  await expect(shell.locator(".stacker-lock-flash")).toHaveCount(4);
  expect(await shell.locator(".stacker-drop-trail").count()).toBeGreaterThan(0);
  await expect(shell.locator('[data-cell="settled"]')).toHaveCount(4);
  await page.screenshot({ path: testInfo.outputPath("stacker-neon-motion.png") });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(shell.locator(".stacker-lock-flash, .stacker-drop-trail")).toHaveCount(0);
});
