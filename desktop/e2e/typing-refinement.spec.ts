import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Typing", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Duração" })).toBeVisible();
});

test("two-line flow uses actual layout, keeps the active word visible across resizing and preserves focus", async ({ page }, testInfo) => {
  const input = page.getByRole("textbox", { name: /^Digite a palavra / });
  await expect(input).toBeFocused();
  await expect(page.getByRole("timer")).toHaveText("01:00");
  await page.screenshot({ path: testInfo.outputPath("typing-ready.png") });
  await page.keyboard.press("Space");
  await expect(page.locator("[data-active]")).toHaveAttribute("data-word", "0");
  for (let i = 0; i < 22; i++) {
    const word = (await input.getAttribute("aria-label"))!.replace("Digite a palavra ", "");
    await input.pressSequentially(word);
    await input.press("Space");
  }
  await expect(page.getByRole("combobox", { name: "Duração" })).toBeDisabled();
  await expect(page.locator(".typing-viewport")).toHaveJSProperty("scrollTop", await page.locator("[data-active]").evaluate(element => (element as HTMLElement).offsetTop));
  await expect(page.locator(".is-correct")).toHaveCount(22);
  await page.screenshot({ path: testInfo.outputPath("typing-desktop.png") });
  await page.setViewportSize({ width: 760, height: 600 });
  const box = (await page.locator(".typing-viewport").boundingBox())!;
  const active = (await page.locator("[data-active]").boundingBox())!;
  expect(active.y).toBeGreaterThanOrEqual(box.y - 2);
  expect(active.y + active.height).toBeLessThanOrEqual(box.y + box.height + 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("typing-compact.png") });
  await input.press("Control+Enter");
  await expect(page.getByRole("timer")).toHaveText("01:00");
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await expect(page.getByRole("combobox", { name: "Duração" })).toBeEnabled();
});

test("real deadline saves once, retains errors, supports all analyses and starts targeted practice", async ({ page }, testInfo) => {
  await page.getByRole("combobox", { name: "Duração" }).click();
  await page.getByRole("option", { name: "15s", exact: true }).click();
  const input = page.getByRole("textbox", { name: /^Digite a palavra / });
  await input.pressSequentially("zzzz"); await input.press("Space");
  const word = (await input.getAttribute("aria-label"))!.replace("Digite a palavra ", "");
  await input.pressSequentially(word); await input.press("Space");
  await expect(page.getByRole("region", { name: "Resultado do teste" })).toBeVisible({ timeout: 20000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("void.typing.sessions.v2")!));
  expect(saved).toHaveLength(1);
  expect(saved[0].correctWords).toBe(1);
  expect(saved[0].incorrectWords).toBe(1);
  expect(saved[0].wpm).toBeCloseTo((word.length + 1) / 5 * 4, 2);
  await page.getByRole("button", { name: "Histórico de digitação", exact: true }).click();
  await expect(page.getByRole("region", { name: "Resultado do teste" })).toContainText("zzzz");
  for (const name of ["Mapa de ritmo", "Velocidade por palavra", "Estatísticas detalhadas"]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  await expect(page.getByText("Total de ações", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("typing-results.png") });
  await page.getByRole("button", { name: /Praticar 1 palavras difíceis/ }).click();
  await expect(page.getByRole("combobox", { name: "Vocabulário" })).toContainText("Revisão de erros");
  const practice = await page.locator("[data-word]").allTextContents();
  expect(practice).toHaveLength(400);
  expect(new Set(practice).size).toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("void.typing.sessions.v2")!).length)).toBe(1);
});

test("sound preferences survive reload, mute is default, paste cannot start the clock", async ({ page }, testInfo) => {
  await page.evaluate(() => {
    const tracked = window as Window & { typingSoundCount: number };
    tracked.typingSoundCount = 0;
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () { tracked.typingSoundCount++; return original.call(this); };
  });
  const muted = page.getByRole("button", { name: "Ativar som", exact: true });
  await expect(muted).toHaveAttribute("aria-pressed", "false");
  await muted.click();
  await expect(page.getByRole("button", { name: "Desativar som", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Ajustar som", exact: true }).click();
  const slider = page.getByRole("slider", { name: "Volume do teclado" });
  await slider.focus(); await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "40");
  await page.getByRole("button", { name: "Ouvir amostra", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { typingSoundCount: number }).typingSoundCount)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Desativar som", exact: true }).click();
  const before = await page.evaluate(() => (window as Window & { typingSoundCount: number }).typingSoundCount);
  await page.getByRole("textbox", { name: /^Digite a palavra / }).pressSequentially("a");
  expect(await page.evaluate(() => (window as Window & { typingSoundCount: number }).typingSoundCount)).toBe(before);
  await page.keyboard.press("Control+Enter");
  await page.getByRole("button", { name: "Ativar som", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("typing-sound.png") });
  await page.reload();
  await page.getByRole("button", { name: "Typing", exact: true }).click();
  await expect(page.getByRole("button", { name: "Desativar som", exact: true })).toHaveAttribute("aria-pressed", "true");
  const input = page.getByRole("textbox", { name: /^Digite a palavra / });
  const prevented = await input.evaluate(element => {
    const clipboardData = new DataTransfer(); clipboardData.setData("text/plain", "colado");
    return !element.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
  });
  expect(prevented).toBe(true);
  await expect(input).toHaveValue("");
  await expect(page.getByRole("timer")).toHaveText("01:00");
  await expect(page.getByRole("status")).toContainText("colagem");
});

test("accent composition commits once and does not submit words while composing", async ({ page }) => {
  const input = page.getByRole("textbox", { name: /^Digite a palavra / });
  await input.dispatchEvent("compositionstart");
  await input.fill("ac\u0327a\u0303o");
  await input.press("Space");
  await expect(page.locator("[data-active]")).toHaveAttribute("data-word", "0");
  await expect(page.getByRole("combobox", { name: "Duração" })).toBeEnabled();
  await input.dispatchEvent("compositionend", { data: "ação" });
  await expect(input).toHaveValue("ação");
  await expect(page.getByRole("combobox", { name: "Duração" })).toBeDisabled();
});
