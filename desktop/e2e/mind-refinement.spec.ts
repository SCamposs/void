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

test("Mini defers history, keeps drafts and recovers from an offline server", async ({ page }, testInfo) => {
  const state = { ...structuredClone(DEFAULT_MIND_STATE), onboardingComplete: true,
    models: [{ id: "fixture", displayName: "Local model", version: "A0", serverModelId: "fixture", importedAt: "2026-11-18", context: 4096, languages: ["en"] }], selectedModelId: "fixture" };
  await page.addInitScript((fixture) => { if (!localStorage.getItem("void.mind.state.v1")) localStorage.setItem("void.mind.state.v1", JSON.stringify(fixture)); }, state);
  await page.route("http://127.0.0.1:8080/**", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Mind", exact: true }).click();
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  await expect(page.getByRole("button", { name: "New conversation", exact: true })).toBeDisabled();
  await composer.fill("A draft without history");
  await page.getByRole("button", { name: "Conversations", exact: true }).click();
  await expect(page.getByRole("searchbox", { name: "Search conversations" })).toBeFocused();
  await expect(page.getByText("Conversations appear after your first message.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Conversations", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: "Mind", exact: true }).click();
  await expect(composer).toHaveValue("A draft without history");
  await page.reload();
  await page.getByRole("button", { name: "Mind", exact: true }).click();
  await expect(composer).toHaveValue("A draft without history");
  await composer.press("Enter");
  await expect(page.getByRole("alert")).toContainText("local server is unavailable");
  await expect(page.locator(".mind-message--assistant")).toHaveCount(0);
  await page.route("http://127.0.0.1:8080/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/v1/chat/completions") return route.fulfill({ contentType: "text/event-stream", body: 'data: {"choices":[{"delta":{"content":"A recovered response."}}]}\n\ndata: [DONE]\n\n' });
    return route.fulfill({ json: path === "/v1/models" ? { data: [{ id: "fixture" }] } : { status: "ok" } });
  });
  await page.getByRole("button", { name: "Retry response" }).click();
  await expect(page.getByText("A recovered response.", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Rename conversation", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Conversation title" })).toBeFocused();
  await page.getByRole("textbox", { name: "Conversation title" }).fill("My saved conversation");
  await page.getByRole("button", { name: "Save title", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My saved conversation", exact: true })).toBeVisible();
  await composer.fill("Follow-up draft");
  await page.getByRole("button", { name: "New conversation", exact: true }).click();
  await expect(composer).toHaveValue("");
  await composer.fill("Separate draft");
  await page.getByRole("button", { name: "Conversations", exact: true }).click();
  await page.getByRole("button", { name: "My saved conversation", exact: false }).first().click();
  await expect(composer).toHaveValue("Follow-up draft");
  await page.getByRole("button", { name: "Model settings", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Model settings" })).toBeVisible();
  await page.getByRole("combobox", { name: "Mode", exact: true }).click();
  await page.getByRole("option", { name: "External local server" }).click();
  await expect(page.getByRole("dialog", { name: "Model settings" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("mind-settings-desktop.png") });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Model settings", exact: true })).toBeFocused();
  await page.setViewportSize({ width: 720, height: 560 });
  await page.getByRole("button", { name: "Model settings", exact: true }).click();
  const box = await page.getByRole("dialog", { name: "Model settings" }).boundingBox();
  expect(box!.height).toBeLessThan(560);
  await page.screenshot({ path: testInfo.outputPath("mind-settings-compact.png") });
  await page.keyboard.press("Escape");
  await page.route("http://127.0.0.1:8080/health", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({ json: { status: "ok" } });
  });
  await composer.fill("A message interrupted by navigation");
  await composer.press("Enter");
  await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: "Mind", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop", exact: true })).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Response stopped");
  await expect(page.getByText("A message interrupted by navigation", { exact: true })).toBeVisible();
  await expect(page.locator(".mind-generating-line")).toHaveCount(0);
});
