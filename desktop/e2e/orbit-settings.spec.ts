import { expect, test, type Locator } from "@playwright/test";

async function expectFieldsContained(panel: Locator) {
  const bounds = (await panel.boundingBox())!;
  for (const field of await panel.getByRole("combobox").all()) {
    const box = (await field.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(bounds.x + 16);
    expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width - 16);
  }
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
}

test("Orbit settings contain fields, preserve controls and dismiss nested layers in order", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Orbit", exact: true }).click();
  const stage = page.locator(".orbit-shell");
  await stage.hover({ position: { x: 20, y: 20 } });
  const trigger = page.getByRole("button", { name: "Open Orbit settings", exact: true });
  await trigger.click();
  const panel = page.getByRole("dialog", { name: "Orbit settings", exact: true });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading")).toHaveCSS("font-family", /Urbanist/);
  await expectFieldsContained(panel);
  await page.screenshot({ path: testInfo.outputPath("orbit-settings-desktop.png") });

  const motion = panel.getByRole("combobox", { name: "Motion", exact: true });
  await motion.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(panel).toBeVisible();
  await expect(motion).toBeFocused();
  await motion.click();
  await page.getByRole("option", { name: "Calm", exact: true }).click();
  await expect(motion).toContainText("Calm");
  await panel.getByRole("combobox", { name: "Quality", exact: true }).click();
  await page.getByRole("option", { name: "Performance", exact: true }).click();
  const sensitivity = panel.getByRole("slider", { name: "Microphone sensitivity" });
  const before = Number(await sensitivity.getAttribute("aria-valuenow"));
  await sensitivity.focus();
  await page.keyboard.press("ArrowRight");
  await expect(sensitivity).toHaveAttribute("aria-valuenow", String(Number((before + .05).toFixed(2))));
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("void.orbit.settings.v2")!).quality)).toBe("performance");

  for (const size of [{ width: 760, height: 600 }, { width: 720, height: 560 }]) {
    await page.setViewportSize(size);
    await expectFieldsContained(panel);
    await expect.poll(async () => {
      const box = (await panel.boundingBox())!;
      return box.x >= 15 && box.y >= 15 && box.x + box.width <= size.width - 15 && box.y + box.height <= size.height - 15;
    }).toBe(true);
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = "20px"; });
  await expectFieldsContained(panel);
  await panel.getByRole("combobox", { name: "Quality", exact: true }).click();
  const list = page.getByRole("listbox");
  await expect(list).toBeVisible();
  const menu = (await list.boundingBox())!;
  expect(menu.x).toBeGreaterThanOrEqual(0);
  expect(menu.x + menu.width).toBeLessThanOrEqual(720);
  await page.screenshot({ path: testInfo.outputPath("orbit-settings-compact-select.png") });
  await page.keyboard.press("Escape");
  await expect(panel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await stage.click({ position: { x: 20, y: 20 } });
  await expect(panel).toHaveCount(0);
  await stage.hover({ position: { x: 20, y: 20 } });
  await trigger.click();
  await panel.getByRole("button", { name: "Close Orbit settings" }).click();
  await expect(trigger).toBeFocused();

  await page.reload();
  await page.getByRole("button", { name: "Orbit", exact: true }).click();
  await stage.hover({ position: { x: 20, y: 20 } });
  await trigger.click();
  await expect(panel.getByRole("combobox", { name: "Motion", exact: true })).toContainText("Calm");
  await expect(panel.getByRole("combobox", { name: "Quality", exact: true })).toContainText("Performance");
});

test("Orbit microphone failure stays readable without overlapping settings", async ({ page }, testInfo) => {
  // A denied browser permission fixture, never a real microphone request.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
      getUserMedia: () => Promise.reject(new DOMException("Permission denied", "NotAllowedError")),
    } });
  });
  await page.setViewportSize({ width: 720, height: 560 });
  await page.goto("/");
  await page.getByRole("button", { name: "Orbit", exact: true }).click();
  await page.locator(".orbit-shell").hover({ position: { x: 20, y: 20 } });
  await page.getByRole("button", { name: "Turn microphone on", exact: true }).click();
  await expect(page.locator(".orbit-audio-notice")).toBeVisible();
  await page.getByRole("button", { name: "Open Orbit settings", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Orbit settings", exact: true });
  const notice = panel.getByRole("status");
  await expect(notice).toHaveText("Microphone unavailable. Orbit continues without audio input.");
  await expect(page.locator(".orbit-audio-notice")).toHaveCount(0);
  await expectFieldsContained(panel);
  const bounds = (await panel.boundingBox())!;
  const note = (await notice.boundingBox())!;
  expect(note.y + note.height).toBeLessThanOrEqual(bounds.y + bounds.height - 16);
  expect(bounds.y).toBeGreaterThanOrEqual(15);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(545);
  await page.screenshot({ path: testInfo.outputPath("orbit-settings-microphone-unavailable.png") });
  await panel.getByRole("button", { name: "Close Orbit settings" }).click();
  await expect(page.locator(".orbit-audio-notice")).toBeVisible();
});
