import { test, expect } from "@playwright/test";
import { DEFAULT_MIND_STATE } from "../src/app/modules/mind/storage";

test("Embedded Mind keeps setup controls and the canonical identity", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Mind", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Connect a model you control." })).toBeVisible();
  const modes = page.getByRole("group", { name: "Runtime setup mode" });
  await expect(modes.getByRole("button", { name: "Use running server" })).toHaveAttribute("aria-pressed", "true");
  await modes.getByRole("button", { name: "Let VOID start it" }).click();
  await expect(modes.getByRole("button", { name: "Let VOID start it" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Open VOID Mind" })).toBeDisabled();
  await expect(page.locator(".mind-setup__intro .mind-orbit svg")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("mind-setup-desktop.png") });
  await page.setViewportSize({ width: 720, height: 560 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("mind-setup-compact.png") });
});

test("Embedded Mind preserves saved content, readable messages and composer controls", async ({ page }, testInfo) => {
  const now = "2026-11-11T12:00:00.000Z";
  const state = { ...structuredClone(DEFAULT_MIND_STATE), onboardingComplete: true, activeChatId: "visual-fixture",
    chats: [{ id: "visual-fixture", title: "A focused week", createdAt: now, updatedAt: now, messages: [
      { id: "question", role: "user", content: "Help me plan a focused week.", createdAt: now },
      { id: "answer", role: "assistant", content: "Start with **one priority** each day.\n\n- Protect a focused hour.\n- Leave room to rest.", createdAt: now },
    ] }], models: [{ id: "fixture", displayName: "Local model", version: "A0", importedAt: now, context: 4096, languages: ["en"] }], selectedModelId: "fixture" };
  await page.route("http://127.0.0.1:8080/**", (route) => route.abort());
  await page.addInitScript((fixture) => localStorage.setItem("void.mind.state.v1", JSON.stringify(fixture)), state);
  await page.goto("/");
  await page.getByRole("button", { name: "Mind", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A focused week" })).toBeVisible();
  await expect(page.locator(".mind-message__body").last()).toHaveCSS("font-family", /Barlow/);
  await expect(page.getByText("telemetry off", { exact: true })).toHaveCount(0);
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  const send = page.getByRole("button", { name: "Send message", exact: true });
  await expect(send).toBeDisabled();
  await composer.fill("A draft to keep");
  await expect(send).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("mind-conversation-desktop.png") });
  await page.setViewportSize({ width: 720, height: 560 });
  await expect(composer).toHaveValue("A draft to keep");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("mind-conversation-compact.png") });
});
